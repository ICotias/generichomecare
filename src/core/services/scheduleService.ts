/**
 * Serviço de escalas (schedules).
 *
 * Estrutura Firestore:
 *   empresas/{empresaId}/escalas/{escalaId}
 *
 * Cada escala define um profissional atribuído a um paciente
 * em um dia da semana com horário de início e fim.
 */
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  Timestamp,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import { Collections } from '../../shared/constants/firestore';
import type { Schedule } from '../types';

// ════════════════════════════════════════════
// Input type
// ════════════════════════════════════════════

export interface CreateScheduleInput {
  pacienteId: string;
  profissionalId: string;
  profissionalNome: string;
  pacienteNome: string;
  diaSemana: Schedule['diaSemana'];
  horaInicio: string;
  horaFim: string;
}

// ════════════════════════════════════════════
// CRUD
// ════════════════════════════════════════════

/**
 * Cria uma nova escala.
 */
export const createSchedule = async (
  empresaId: string,
  input: CreateScheduleInput
): Promise<string> => {
  const colRef = collection(db, Collections.escalas(empresaId));
  const docRef = await addDoc(colRef, {
    ...input,
    empresaId,
    ativo: true,
    createdAt: Timestamp.now(),
  });
  return docRef.id;
};

/**
 * Lista escalas da empresa, opcionalmente filtradas por dia da semana.
 */
export const listSchedules = async (
  empresaId: string,
  diaSemana?: number
): Promise<(Schedule & { profissionalNome: string; pacienteNome: string })[]> => {
  const colRef = collection(db, Collections.escalas(empresaId));

  const constraints = [];
  if (diaSemana !== undefined) {
    constraints.push(where('diaSemana', '==', diaSemana));
  }
  constraints.push(where('ativo', '==', true));
  constraints.push(orderBy('horaInicio'));

  const q = query(colRef, ...constraints);
  const snap = await getDocs(q);

  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      empresaId: data.empresaId,
      pacienteId: data.pacienteId,
      profissionalId: data.profissionalId,
      profissionalNome: data.profissionalNome ?? '',
      pacienteNome: data.pacienteNome ?? '',
      diaSemana: data.diaSemana,
      horaInicio: data.horaInicio,
      horaFim: data.horaFim,
      ativo: data.ativo,
    };
  });
};

/**
 * Remove (desativa) uma escala.
 */
export const deleteSchedule = async (
  empresaId: string,
  escalaId: string
): Promise<void> => {
  const docRef = doc(db, Collections.escalas(empresaId), escalaId);
  await deleteDoc(docRef);
};
