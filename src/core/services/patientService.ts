/**
 * Serviço para operações CRUD de pacientes.
 *
 * Estrutura Firestore:
 *   empresas/{empresaId}/pacientes/{pacienteId}
 *
 * Somente admins da empresa podem criar/editar.
 * Enfermeiros e familiares podem ler (com restrições nas rules).
 */
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import { Collections } from '../../shared/constants/firestore';
import type { Patient, Address, EmergencyContact, VitalSignsRange } from '../types';

// ════════════════════════════════════════════
// Input types
// ════════════════════════════════════════════

export interface CreatePatientInput {
  nome: string;
  dataNascimento: Date;
  cpf: string;
  genero: Patient['genero'];
  endereco: Address;
  contatoEmergencia: EmergencyContact;
  diagnosticos: string[];
  alergias: string[];
  medicamentosEmUso?: string[];
  tipoAtendimento: Patient['tipoAtendimento'];
  observacoes?: string;
  faixaSinaisVitais: VitalSignsRange;
}

export interface UpdatePatientInput extends Partial<CreatePatientInput> {
  status?: Patient['status'];
}

// ════════════════════════════════════════════
// Vital sign presets
// ════════════════════════════════════════════

export type VitalSignsPresetKey = 'idoso_padrao' | 'hipertenso' | 'cardiopata' | 'pos_cirurgico';

export interface VitalSignsPreset {
  key: VitalSignsPresetKey;
  label: string;
  descricao: string;
  ranges: VitalSignsRange;
}

export const VITAL_SIGNS_PRESETS: VitalSignsPreset[] = [
  {
    key: 'idoso_padrao',
    label: 'Idoso padrão',
    descricao: 'Faixas gerais para idosos (ANVISA / SBGG)',
    ranges: {
      paSistolicaMin: 100, paSistolicaMax: 150,
      paDiastolicaMin: 60, paDiastolicaMax: 90,
      fcMin: 50, fcMax: 100,
      frMin: 12, frMax: 22,
      tempMin: 35.5, tempMax: 37.5,
      satO2Min: 92,
    },
  },
  {
    key: 'hipertenso',
    label: 'Hipertenso',
    descricao: 'PA tolerante, FC mais restrita',
    ranges: {
      paSistolicaMin: 110, paSistolicaMax: 160,
      paDiastolicaMin: 65, paDiastolicaMax: 95,
      fcMin: 55, fcMax: 90,
      frMin: 12, frMax: 22,
      tempMin: 35.5, tempMax: 37.5,
      satO2Min: 93,
    },
  },
  {
    key: 'cardiopata',
    label: 'Cardiopata',
    descricao: 'FC e SpO₂ com faixas mais restritas',
    ranges: {
      paSistolicaMin: 100, paSistolicaMax: 140,
      paDiastolicaMin: 60, paDiastolicaMax: 85,
      fcMin: 55, fcMax: 85,
      frMin: 14, frMax: 22,
      tempMin: 35.5, tempMax: 37.5,
      satO2Min: 94,
    },
  },
  {
    key: 'pos_cirurgico',
    label: 'Pós-cirúrgico',
    descricao: 'Temperatura e FR mais sensíveis',
    ranges: {
      paSistolicaMin: 95, paSistolicaMax: 145,
      paDiastolicaMin: 55, paDiastolicaMax: 90,
      fcMin: 55, fcMax: 100,
      frMin: 14, frMax: 24,
      tempMin: 36.0, tempMax: 37.3,
      satO2Min: 93,
    },
  },
];

/** Faixas-padrão de sinais vitais para idosos (referência ANVISA / SBGG) */
export const DEFAULT_VITAL_SIGNS: VitalSignsRange = VITAL_SIGNS_PRESETS[0].ranges;

// ════════════════════════════════════════════
// CRUD
// ════════════════════════════════════════════

/**
 * Cria um novo paciente na subcollection da empresa.
 */
export const createPatient = async (
  empresaId: string,
  input: CreatePatientInput
): Promise<string> => {
  const now = Timestamp.now();

  const data = {
    ...input,
    empresaId,
    dataNascimento: Timestamp.fromDate(input.dataNascimento),
    status: 'ativo' as const,
    createdAt: now,
    updatedAt: now,
  };

  const colRef = collection(db, Collections.pacientes(empresaId));
  const docRef = await addDoc(colRef, data);
  return docRef.id;
};

/**
 * Atualiza campos de um paciente existente.
 */
export const updatePatient = async (
  empresaId: string,
  pacienteId: string,
  input: UpdatePatientInput
): Promise<void> => {
  const docRef = doc(db, Collections.pacientes(empresaId), pacienteId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {
    ...input,
    updatedAt: serverTimestamp(),
  };

  if (input.dataNascimento) {
    updates.dataNascimento = Timestamp.fromDate(input.dataNascimento);
  }

  await updateDoc(docRef, updates);
};

/**
 * Busca um paciente pelo ID.
 */
export const getPatient = async (
  empresaId: string,
  pacienteId: string
): Promise<Patient | null> => {
  const docRef = doc(db, Collections.pacientes(empresaId), pacienteId);
  const snap = await getDoc(docRef);

  if (!snap.exists()) return null;

  return docToPatient(snap.id, snap.data());
};

/**
 * Lista todos os pacientes ativos da empresa.
 */
export const listPatients = async (
  empresaId: string,
  options?: { includeInactive?: boolean }
): Promise<Patient[]> => {
  const colRef = collection(db, Collections.pacientes(empresaId));

  const q = options?.includeInactive
    ? query(colRef, orderBy('nome'))
    : query(colRef, where('status', '==', 'ativo'), orderBy('nome'));

  const snap = await getDocs(q);
  return snap.docs.map((d) => docToPatient(d.id, d.data()));
};

// ════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const docToPatient = (id: string, data: Record<string, any>): Patient => {
  return {
    ...data,
    id,
    dataNascimento: data.dataNascimento?.toDate?.() ?? new Date(),
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
  } as Patient;
};
