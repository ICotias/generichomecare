/**
 * Fila offline para registros de cuidados.
 *
 * Quando o dispositivo está sem conexão, os registros são salvos
 * no AsyncStorage. Ao reconectar, a fila é processada
 * automaticamente enviando cada item para o Firestore.
 *
 * Estrutura no AsyncStorage:
 *   @homecare/offline_queue → JSON array de QueueItem[]
 *
 * Integração:
 *   - Os screens de registro chamam `enqueueIfOffline()` que tenta
 *     salvar online primeiro. Se falhar por rede, enfileira.
 *   - O `startQueueProcessor()` roda em background e tenta
 *     processar a fila a cada 30s quando há itens pendentes.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

import { createRecord, type CreateRecordInput } from './registroService';
import { logAudit } from './auditService';

// ════════════════════════════════════════════
// Types
// ════════════════════════════════════════════

export interface QueueItem {
  id: string;
  empresaId: string;
  pacienteId: string;
  input: CreateRecordInput;
  createdAt: string; // ISO string
  retries: number;
  lastError?: string;
}

// ════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════

const STORAGE_KEY = '@homecare/offline_queue';
const MAX_RETRIES = 5;
const PROCESS_INTERVAL_MS = 30_000; // 30 seconds

// ════════════════════════════════════════════
// Queue CRUD
// ════════════════════════════════════════════

const generateId = () =>
  `oq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Lê a fila do AsyncStorage.
 */
export const getQueue = async (): Promise<QueueItem[]> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueueItem[]) : [];
  } catch {
    return [];
  }
};

/**
 * Salva a fila inteira no AsyncStorage.
 */
const saveQueue = async (queue: QueueItem[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
};

/**
 * Adiciona um item à fila.
 */
export const enqueue = async (
  empresaId: string,
  pacienteId: string,
  input: CreateRecordInput
): Promise<string> => {
  const item: QueueItem = {
    id: generateId(),
    empresaId,
    pacienteId,
    input,
    createdAt: new Date().toISOString(),
    retries: 0,
  };

  const queue = await getQueue();
  queue.push(item);
  await saveQueue(queue);

  if (__DEV__) {
    console.warn(`[OfflineQueue] Enqueued ${item.id} (type=${input.type}). Queue size: ${queue.length}`);
  }

  return item.id;
};

/**
 * Remove um item da fila (após sync bem-sucedido).
 */
const dequeue = async (itemId: string): Promise<void> => {
  const queue = await getQueue();
  await saveQueue(queue.filter((q) => q.id !== itemId));
};

/**
 * Retorna o número de itens pendentes.
 */
export const getPendingCount = async (): Promise<number> => {
  const queue = await getQueue();
  return queue.length;
};

// ════════════════════════════════════════════
// Network check (simple fetch-based)
// ════════════════════════════════════════════

const isOnline = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch('https://www.googleapis.com/discovery/v1/apis', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
};

// ════════════════════════════════════════════
// Smart save: online first, offline fallback
// ════════════════════════════════════════════

/**
 * Tenta salvar o registro online. Se falhar por rede, enfileira offline.
 * Retorna { online: true, id } ou { online: false, queueId }.
 */
export const saveRecordWithFallback = async (
  empresaId: string,
  pacienteId: string,
  input: CreateRecordInput,
  userId?: string,
  userRole?: string
): Promise<{ online: boolean; id: string }> => {
  try {
    const id = await createRecord(empresaId, pacienteId, input);

    if (userId && userRole) {
      logAudit('create_record', userId, userRole, empresaId, {
        type: input.type,
        pacienteId,
        mode: 'online',
      });
    }

    return { online: true, id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : '';
    const isNetworkError =
      msg.includes('network') ||
      msg.includes('Failed to fetch') ||
      msg.includes('offline') ||
      msg.includes('unavailable') ||
      msg.includes('UNAVAILABLE');

    if (isNetworkError) {
      const queueId = await enqueue(empresaId, pacienteId, input);

      if (userId && userRole) {
        logAudit('create_record', userId, userRole, empresaId, {
          type: input.type,
          pacienteId,
          mode: 'queued_offline',
          queueId,
        });
      }

      return { online: false, id: queueId };
    }

    // Not a network error — rethrow
    throw err;
  }
};

// ════════════════════════════════════════════
// Queue processor
// ════════════════════════════════════════════

let processorInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Processa todos os itens da fila, tentando enviar cada um ao Firestore.
 * Itens que falham são mantidos na fila com retry count incrementado.
 */
export const processQueue = async (): Promise<{ synced: number; failed: number }> => {
  const online = await isOnline();
  if (!online) return { synced: 0, failed: 0 };

  const queue = await getQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      await createRecord(item.empresaId, item.pacienteId, item.input);
      await dequeue(item.id);
      synced++;

      if (__DEV__) {
        console.warn(`[OfflineQueue] Synced ${item.id} (type=${item.input.type})`);
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : 'unknown';

      // Update retry count
      const current = await getQueue();
      const updated = current.map((q) =>
        q.id === item.id
          ? { ...q, retries: q.retries + 1, lastError: msg }
          : q
      );

      // Remove items that exceeded max retries
      const filtered = updated.filter((q) => q.retries <= MAX_RETRIES);
      await saveQueue(filtered);

      if (item.retries + 1 > MAX_RETRIES) {
        console.error(`[OfflineQueue] Dropped ${item.id} after ${MAX_RETRIES} retries: ${msg}`);
      }
    }
  }

  return { synced, failed };
};

/**
 * Inicia o processador de fila em background.
 * Deve ser chamado uma vez no bootstrap do app (ex: App.tsx).
 */
export const startQueueProcessor = (): void => {
  if (processorInterval) return; // Already running

  // Process immediately on start
  processQueue().catch(() => {});

  // Then every 30s
  processorInterval = setInterval(() => {
    processQueue().catch(() => {});
  }, PROCESS_INTERVAL_MS);

  // Also process when app comes back to foreground
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      processQueue().catch(() => {});
    }
  });

  if (__DEV__) {
    console.warn('[OfflineQueue] Processor started');
  }
};

/**
 * Para o processador (para cleanup/testes).
 */
export const stopQueueProcessor = (): void => {
  if (processorInterval) {
    clearInterval(processorInterval);
    processorInterval = null;
  }
};
