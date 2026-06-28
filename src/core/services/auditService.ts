/**
 * Serviço de log de auditoria (client-side).
 *
 * Grava cada evento em três lugares:
 *   1. Buffer em memória (debug rápido / admin in-app)
 *   2. Console (apenas em __DEV__)
 *   3. Coleção `auditLog` no Firestore (persistente)
 *
 * As rules permitem que cada usuário CRIE seus próprios logs
 * (request.resource.data.userId == auth.uid), sem update/delete.
 * Quando Cloud Functions estiverem disponíveis, o ideal é mover a
 * escrita para o Admin SDK (server-side) e capturar IP/origem.
 *
 * Estrutura do log:
 *   auditLog/{logId}
 *     - action: string (ex: 'create_record', 'login', 'lgpd_consent')
 *     - userId: string
 *     - userRole: string
 *     - empresaId: string
 *     - details: Record<string, unknown>
 *     - timestamp: serverTimestamp()
 */

import { Timestamp, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'lgpd_consent'
  | 'create_record'
  | 'create_patient'
  | 'update_patient'
  | 'create_nurse'
  | 'create_family'
  | 'shift_checkin'
  | 'shift_checkout'
  | 'export_report'
  | 'create_evolucao';

export interface AuditEntry {
  action: AuditAction;
  userId: string;
  userRole: string;
  empresaId: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

// ════════════════════════════════════════════
// In-memory buffer (will be persisted when Cloud Functions are ready)
// ════════════════════════════════════════════

const auditBuffer: AuditEntry[] = [];
const MAX_BUFFER = 200;

/**
 * Persiste o evento no Firestore (fire-and-forget).
 * Falhas não devem quebrar o fluxo do usuário — apenas logam em dev.
 */
const persistToFirestore = (entry: AuditEntry): void => {
  // Sem userId não há como satisfazer as rules (userId == auth.uid)
  if (!entry.userId) return;

  addDoc(collection(db, 'auditLog'), {
    action: entry.action,
    userId: entry.userId,
    userRole: entry.userRole,
    empresaId: entry.empresaId,
    details: entry.details ?? {},
    timestamp: serverTimestamp(),
  }).catch((err) => {
    if (__DEV__) {
      console.warn('[AUDIT] Falha ao persistir no Firestore:', err);
    }
  });
};

/**
 * Registra um evento de auditoria.
 *
 * Salva em memória, console (dev) e persiste no Firestore.
 */
export const logAudit = (
  action: AuditAction,
  userId: string,
  userRole: string,
  empresaId: string,
  details?: Record<string, unknown>
): void => {
  const entry: AuditEntry = {
    action,
    userId,
    userRole,
    empresaId,
    details,
    timestamp: new Date(),
  };

  // Buffer in memory
  if (auditBuffer.length >= MAX_BUFFER) {
    auditBuffer.shift(); // Remove oldest
  }
  auditBuffer.push(entry);

  // Console log for dev
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(
      `[AUDIT] ${action} | user=${userId} | role=${userRole} | empresa=${empresaId}`,
      details ? JSON.stringify(details) : ''
    );
  }

  // Persistência durável
  persistToFirestore(entry);
};

/**
 * Retorna os logs de auditoria em memória (para debug/admin).
 */
export const getAuditBuffer = (): readonly AuditEntry[] => auditBuffer;

/**
 * Limpa o buffer (para testes).
 */
export const clearAuditBuffer = (): void => {
  auditBuffer.length = 0;
};

/**
 * Prepara um payload para Cloud Function (futuro).
 */
export const serializeForCloudFunction = (entry: AuditEntry) => ({
  ...entry,
  timestamp: Timestamp.fromDate(entry.timestamp),
});
