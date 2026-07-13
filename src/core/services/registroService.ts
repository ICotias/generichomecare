/**
 * Serviço para salvar registros de cuidados (imutáveis).
 *
 * Estrutura Firestore:
 *   empresas/{empresaId}/pacientes/{pacienteId}/registros/{registroId}
 *
 * Registros são imutáveis — não podem ser editados nem deletados
 * (garantido pelas Firestore rules).
 */
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  limit as firestoreLimit,
  Timestamp,
  QueryConstraint,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import { Collections } from '../../shared/constants/firestore';
import type { RecordType, CareRecord } from '../types';

// ════════════════════════════════════════════
// Input type
// ════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CreateRecordInput = Record<string, any> & { type: RecordType };

// ════════════════════════════════════════════
// Create
// ════════════════════════════════════════════

/**
 * Salva um registro de cuidado no Firestore.
 * Retorna o ID do documento criado.
 */
export const createRecord = async (
  empresaId: string,
  pacienteId: string,
  input: CreateRecordInput
): Promise<string> => {
  const colRef = collection(db, Collections.registros(empresaId, pacienteId));

  // Denormaliza visibilidade para a família. Fotos clínicas ficam restritas;
  // todo o resto é visível. Esse campo torna a regra de leitura da família
  // "filtrável" (rules não são filtros — sem ele, uma foto clínica no
  // resultado derruba a query inteira com permission-denied).
  const visibleToFamily = !(input.type === 'foto' && input.fotoClinica === true);

  const data = {
    ...input,
    // Garante empresaId/pacienteId no doc: além do caminho, são campos usados
    // por consultas collectionGroup (ex.: dashboard) e pelas regras.
    empresaId,
    pacienteId,
    visibleToFamily,
    timestamp: Timestamp.now(),
    syncStatus: 'synced',
  };

  const docRef = await addDoc(colRef, data);
  return docRef.id;
};

// ════════════════════════════════════════════
// Read
// ════════════════════════════════════════════

/**
 * Lista registros de um paciente, opcionalmente filtrados por tipo.
 */
export const listRecords = async (
  empresaId: string,
  pacienteId: string,
  options?: {
    type?: RecordType;
    limitCount?: number;
    /** Retorna apenas registros com timestamp >= since (ex.: início do dia) */
    since?: Date;
    /** Família: retorna só registros visíveis (exclui fotos clínicas).
     *  Necessário para as rules da família (rules não são filtros). */
    visibleToFamilyOnly?: boolean;
  }
): Promise<CareRecord[]> => {
  const colRef = collection(db, Collections.registros(empresaId, pacienteId));

  const constraints: QueryConstraint[] = [];

  if (options?.type) {
    constraints.push(where('type', '==', options.type));
  }
  if (options?.visibleToFamilyOnly) {
    constraints.push(where('visibleToFamily', '==', true));
  }
  if (options?.since) {
    constraints.push(where('timestamp', '>=', Timestamp.fromDate(options.since)));
  }
  constraints.push(orderBy('timestamp', 'desc'));
  if (options?.limitCount) {
    constraints.push(firestoreLimit(options.limitCount));
  }

  const q = query(colRef, ...constraints);
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const raw = d.data();
    return {
      ...raw,
      id: d.id,
      timestamp: raw.timestamp?.toDate?.() ?? new Date(),
    } as CareRecord;
  });
};
