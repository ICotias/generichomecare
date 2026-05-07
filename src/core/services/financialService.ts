/**
 * Serviço financeiro.
 *
 * Estrutura Firestore:
 *   empresas/{empresaId}/financeiro/{financeiroId}
 *
 * Cada documento é um lançamento (receita ou despesa).
 */
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import { Collections } from '../../shared/constants/firestore';
import type { FinancialRecord, TransactionType } from '../types';

// ════════════════════════════════════════════
// Input type
// ════════════════════════════════════════════

export interface CreateFinancialInput {
  tipo: TransactionType;
  categoria: string;
  descricao: string;
  valor: number;
  data: Date;
  pacienteId?: string;
  profissionalId?: string;
}

// ════════════════════════════════════════════
// CRUD
// ════════════════════════════════════════════

/**
 * Cria um novo lançamento financeiro.
 */
export const createEntry = async (
  empresaId: string,
  input: CreateFinancialInput
): Promise<string> => {
  const colRef = collection(db, Collections.financeiro(empresaId));
  const docRef = await addDoc(colRef, {
    ...input,
    empresaId,
    data: Timestamp.fromDate(input.data),
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

/**
 * Lista lançamentos de um mês específico (0-indexed).
 */
export const listEntries = async (
  empresaId: string,
  year: number,
  month: number
): Promise<FinancialRecord[]> => {
  const colRef = collection(db, Collections.financeiro(empresaId));

  // Range do mês
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

  const q = query(
    colRef,
    where('data', '>=', Timestamp.fromDate(startOfMonth)),
    where('data', '<=', Timestamp.fromDate(endOfMonth)),
    orderBy('data', 'desc')
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const raw = d.data();
    return {
      id: d.id,
      empresaId: raw.empresaId,
      tipo: raw.tipo,
      categoria: raw.categoria,
      descricao: raw.descricao,
      valor: raw.valor,
      pacienteId: raw.pacienteId,
      profissionalId: raw.profissionalId,
      data: raw.data?.toDate?.() ?? new Date(),
      createdAt: raw.createdAt?.toDate?.() ?? new Date(),
    };
  });
};
