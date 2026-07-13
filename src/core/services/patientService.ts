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
import type {
  Patient,
  Address,
  EmergencyContact,
  VitalSignsRange,
  ResponsibleDoctor,
  Prescription,
} from '../types';

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
// Vital sign defaults
// ════════════════════════════════════════════

/** Faixas-padrão de sinais vitais para idosos (referência ANVISA / SBGG) */
export const DEFAULT_VITAL_SIGNS: VitalSignsRange = {
  paSistolicaMin: 100, paSistolicaMax: 150,
  paDiastolicaMin: 60, paDiastolicaMax: 90,
  fcMin: 50, fcMax: 100,
  frMin: 12, frMax: 22,
  tempMin: 35.5, tempMax: 37.5,
  satO2Min: 92,
};

// ════════════════════════════════════════════
// Onboarding pela família (Fase 1)
// ════════════════════════════════════════════

export interface FamilyMedicationInput {
  medicamento: string;
  dosagem: string;
  via: Prescription['via'];
  frequencia: string;
  horarios: string[];
  observacoes?: string;
}

export interface CreatePatientByFamilyInput {
  nome: string;
  dataNascimento: Date;
  genero: Patient['genero'];
  diagnosticos: string[];
  alergias: string[];
  observacoes?: string;
  tipoAtendimento?: Patient['tipoAtendimento'];
  contatoEmergencia: EmergencyContact;
  contatosAdicionais?: EmergencyContact[];
  medicoResponsavel?: ResponsibleDoctor;
  faixaSinaisVitais: VitalSignsRange;
  medicamentos: FamilyMedicationInput[];
}

const EMPTY_ADDRESS: Address = {
  rua: '', numero: '', bairro: '', cidade: '', estado: '', cep: '',
};

/**
 * Cria o paciente a partir do onboarding da família (dados trazidos por ela,
 * a partir do médico do paciente). Marca proveniência `origemDados: 'familia'`
 * e `validadoPorEquipe: false`. Já entra `ativo` (decisão "ativa na hora").
 *
 * IMPORTANTE: escrita sequencial (paciente → vincula usuário → prescrições)
 * porque as Firestore rules das prescrições dependem do `pacienteId` já
 * vinculado no doc do usuário — um batch não enxergaria esse estado.
 */
/**
 * Cria o "stub" do paciente pelo ADMIN: apenas dados pessoais básicos.
 * Fica marcado como cadastroCompleto: false até a família completar os
 * dados clínicos. NÃO vincula família aqui (o vínculo é feito à parte,
 * via adminUserService.linkExistingFamily).
 */
export interface CreatePatientStubInput {
  nome: string;
  dataNascimento: Date;
  genero: Patient['genero'];
  cpf?: string;
  contatoEmergencia?: EmergencyContact;
}

export const createPatientStub = async (
  empresaId: string,
  criadoPorUid: string,
  input: CreatePatientStubInput
): Promise<string> => {
  const now = Timestamp.now();
  const data: Record<string, unknown> = {
    empresaId,
    nome: input.nome,
    dataNascimento: Timestamp.fromDate(input.dataNascimento),
    cpf: input.cpf ?? '',
    genero: input.genero,
    endereco: EMPTY_ADDRESS,
    contatoEmergencia: input.contatoEmergencia ?? { nome: '', parentesco: '', telefone: '' },
    diagnosticos: [],
    alergias: [],
    tipoAtendimento: 'integral',
    status: 'ativo',
    faixaSinaisVitais: DEFAULT_VITAL_SIGNS,
    origemDados: 'familia',
    criadoPorUid,
    validadoPorEquipe: false,
    cadastroCompleto: false,
    createdAt: now,
    updatedAt: now,
  };
  const ref = await addDoc(collection(db, Collections.pacientes(empresaId)), data);
  return ref.id;
};

/**
 * A família COMPLETA um paciente-stub já existente (criado pelo admin).
 * Atualiza os dados clínicos, marca cadastroCompleto: true e cria as prescrições.
 */
export const completePatientByFamily = async (
  empresaId: string,
  pacienteId: string,
  input: CreatePatientByFamilyInput
): Promise<void> => {
  const now = Timestamp.now();

  const patch: Record<string, unknown> = {
    nome: input.nome,
    dataNascimento: Timestamp.fromDate(input.dataNascimento),
    genero: input.genero,
    diagnosticos: input.diagnosticos,
    alergias: input.alergias,
    tipoAtendimento: input.tipoAtendimento ?? 'integral',
    observacoes: input.observacoes ?? '',
    faixaSinaisVitais: input.faixaSinaisVitais,
    contatoEmergencia: input.contatoEmergencia,
    cadastroCompleto: true,
    updatedAt: now,
  };
  if (input.medicoResponsavel) patch.medicoResponsavel = input.medicoResponsavel;
  if (input.contatosAdicionais && input.contatosAdicionais.length > 0) {
    patch.contatosAdicionais = input.contatosAdicionais;
  }

  await updateDoc(doc(db, Collections.pacientes(empresaId), pacienteId), patch);

  // Prescrições (medicamentos de uso contínuo)
  for (const m of input.medicamentos) {
    const presData: Record<string, unknown> = {
      pacienteId,
      medicamento: m.medicamento,
      dosagem: m.dosagem,
      via: m.via,
      frequencia: m.frequencia,
      horarios: m.horarios,
      dataInicio: now,
      ativo: true,
    };
    if (m.observacoes) presData.observacoes = m.observacoes;
    await addDoc(collection(db, Collections.prescricoes(empresaId, pacienteId)), presData);
  }
};

export const createPatientByFamily = async (
  empresaId: string,
  uid: string,
  input: CreatePatientByFamilyInput
): Promise<string> => {
  const now = Timestamp.now();

  // 1. Cria o paciente
  const patientData: Record<string, unknown> = {
    empresaId,
    nome: input.nome,
    dataNascimento: Timestamp.fromDate(input.dataNascimento),
    cpf: '',
    genero: input.genero,
    endereco: EMPTY_ADDRESS,
    contatoEmergencia: input.contatoEmergencia,
    diagnosticos: input.diagnosticos,
    alergias: input.alergias,
    tipoAtendimento: input.tipoAtendimento ?? 'integral',
    status: 'ativo',
    observacoes: input.observacoes ?? '',
    faixaSinaisVitais: input.faixaSinaisVitais,
    origemDados: 'familia',
    criadoPorUid: uid,
    validadoPorEquipe: false,
    createdAt: now,
    updatedAt: now,
  };
  if (input.medicoResponsavel) {
    patientData.medicoResponsavel = input.medicoResponsavel;
  }
  if (input.contatosAdicionais && input.contatosAdicionais.length > 0) {
    patientData.contatosAdicionais = input.contatosAdicionais;
  }

  const patientRef = await addDoc(collection(db, Collections.pacientes(empresaId)), patientData);

  // 2. Vincula o paciente ao usuário família (necessário ANTES das prescrições
  //    para as rules de prescricoes liberarem via getUserData().pacienteId)
  await updateDoc(doc(db, Collections.USUARIOS, uid), {
    pacienteId: patientRef.id,
    updatedAt: now,
  });

  // 3. Cria as prescrições (medicamentos de uso contínuo)
  for (const m of input.medicamentos) {
    const presData: Record<string, unknown> = {
      pacienteId: patientRef.id,
      medicamento: m.medicamento,
      dosagem: m.dosagem,
      via: m.via,
      frequencia: m.frequencia,
      horarios: m.horarios,
      dataInicio: now,
      ativo: true,
    };
    if (m.observacoes) presData.observacoes = m.observacoes;
    await addDoc(collection(db, Collections.prescricoes(empresaId, patientRef.id)), presData);
  }

  return patientRef.id;
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
