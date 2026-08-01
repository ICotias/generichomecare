/**
 * Serviço para operações CRUD de pacientes.
 *
 * Estrutura Firestore:
 *   empresas/{empresaId}/pacientes/{pacienteId}
 *
 * Somente admins da empresa podem criar/editar.
 * Familiares leem o paciente vinculado a eles.
 *
 * ISOLAMENTO POR CUIDADOR: o cuidador só lê os pacientes cujo uid está em
 * `enfermeirosAutorizados`. Isso é regra de servidor (firestore.rules), não
 * filtro de tela. Use listPatientsForNurse (array-contains) nas telas do
 * cuidador: listPatients pede a coleção inteira e será NEGADA para ele.
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
  arrayUnion,
  arrayRemove,
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
  UserRole,
  PlanoAutonomo,
} from '../types';
import { LIMITE_PACIENTES, PLANO_LABEL } from '../types';

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
 * Cria o "stub" do paciente pelo ADMIN: apenas dados pessoais básicos.
 * Fica `cadastroCompleto: false` até o admin passar pelo assistente clínico
 * (FamilyOnboardingScreen, rota CompletePatient).
 *
 * O paciente nasce sozinho, de propósito: quem responde pelos dados clínicos
 * no modo empresa é o admin, então a conta da família deixou de ser
 * pré-requisito. Vincular ou convidar a família é ato separado, feito depois
 * pela ficha do paciente.
 */
export interface CreatePatientStubInput {
  nome: string;
  dataNascimento: Date;
  genero: Patient['genero'];
  cpf?: string;
  contatoEmergencia?: EmergencyContact;
  /**
   * Cuidador autônomo: o uid dele, para o paciente já nascer autorizado.
   *
   * É o único modo em que a lista não começa vazia, porque criar e atender são
   * a mesma pessoa. Nos outros, autorizar é ato de um terceiro (a empresa pela
   * escala, a família pelo convite) e a lista nasce vazia de propósito.
   */
  autoAutorizarUid?: string;
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
    // Quem cria e preenche aqui é a equipe, não a família.
    origemDados: 'equipe',
    criadoPorUid,
    validadoPorEquipe: false,
    cadastroCompleto: false,
    // No modo empresa nasce sem cuidador autorizado: autorizar é ato explícito,
    // via escala. No modo autônomo o próprio criador já entra na lista.
    enfermeirosAutorizados: input.autoAutorizarUid ? [input.autoAutorizarUid] : [],
    createdAt: now,
    updatedAt: now,
  };
  const ref = await addDoc(collection(db, Collections.pacientes(empresaId)), data);
  return ref.id;
};

/**
 * COMPLETA um paciente-stub já existente, preenchendo os dados clínicos,
 * marcando cadastroCompleto: true e criando as prescrições.
 *
 * Usado pelo admin no modo empresa (é dele a responsabilidade pelo cadastro) e
 * pela família dona do próprio tenant no modo familiar, onde não há admin.
 */
export const completePatient = async (
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
    // Nasce sem cuidador autorizado. No modo familiar, a própria família
    // autoriza depois, ao convidar o cuidador dela.
    enfermeirosAutorizados: [],
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
 * Lista todos os pacientes ativos da empresa. USO ADMIN.
 *
 * Para o cuidador esta consulta é negada pelas rules (ele não pode varrer a
 * empresa inteira). Nas telas do cuidador, use listPatientsForNurse.
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

/**
 * Lista os pacientes ATIVOS em que o cuidador está autorizado.
 *
 * O array-contains não é conveniência de tela: as rules exigem que a consulta
 * já venha restrita ao uid, senão negam a leitura. Ordenação em memória para
 * não exigir índice composto (array-contains + orderBy).
 */
/**
 * Erro de faixa estourada do cuidador autônomo. Tipado para a tela distinguir
 * "não cabe no seu plano" de "deu erro", que pedem mensagens bem diferentes.
 */
export class PatientQuotaError extends Error {
  constructor(
    readonly plano: PlanoAutonomo,
    readonly limite: number,
    readonly atuais: number
  ) {
    super(
      `O plano ${PLANO_LABEL[plano]} permite ${limite} paciente${limite > 1 ? 's' : ''} ativo${limite > 1 ? 's' : ''}. Você já tem ${atuais}.`
    );
    this.name = 'PatientQuotaError';
  }
}

/**
 * Barra a criação de paciente acima da faixa contratada.
 *
 * ponytail: a checagem é no cliente, não nas rules. Contar documentos exigiria
 * uma consulta que a linguagem das rules não faz, e a alternativa (manter um
 * contador denormalizado no tenant) traz problema de consistência que não se
 * paga aqui. O risco real é baixo: quem burlaria precisaria chamar a API na
 * mão, e o teto é comercial, não de segurança. O que as rules garantem é o
 * isolamento entre tenants, e isso continua inteiro.
 *
 * Evolução, se virar problema: mover para uma Cloud Function que cria o
 * paciente e conta no servidor.
 */
export const assertPatientQuota = async (
  empresaId: string,
  nurseUid: string,
  plano: PlanoAutonomo = 'inicio'
): Promise<void> => {
  const limite = LIMITE_PACIENTES[plano];
  if (limite === null) return;

  const atuais = await listPatientsForNurse(empresaId, nurseUid);
  if (atuais.length >= limite) {
    throw new PatientQuotaError(plano, limite, atuais.length);
  }
};

export const listPatientsForNurse = async (
  empresaId: string,
  nurseUid: string
): Promise<Patient[]> => {
  const q = query(
    collection(db, Collections.pacientes(empresaId)),
    where('enfermeirosAutorizados', 'array-contains', nurseUid),
    where('status', '==', 'ativo')
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => docToPatient(d.id, d.data()))
    .sort((a, b) => a.nome.localeCompare(b.nome));
};

/**
 * Lista os pacientes que o usuário PODE ver, escolhendo a consulta certa para
 * o papel. Cuidador recebe só os autorizados; admin e família recebem a
 * lista da empresa.
 *
 * Recebe o papel REAL (originalRole), não o simulado: durante a simulação
 * admin → cuidador, o uid continua sendo o do admin e não está em nenhuma
 * lista de autorizados, então a consulta restrita voltaria vazia.
 */
export const listPatientsVisibleTo = async (
  empresaId: string,
  uid: string,
  role: UserRole | null
): Promise<Patient[]> =>
  role === 'nurse' ? listPatientsForNurse(empresaId, uid) : listPatients(empresaId);

// ════════════════════════════════════════════
// Autorização de cuidadores
// ════════════════════════════════════════════

/**
 * Autoriza um cuidador a acessar o paciente. Idempotente (arrayUnion).
 *
 * Quem chama é o dono do tenant: o admin da empresa (que escala e cobre
 * faltas) ou a família, no modo familiar. As rules recusam qualquer outro.
 */
export const authorizeNurse = async (
  empresaId: string,
  pacienteId: string,
  nurseUid: string
): Promise<void> => {
  await updateDoc(doc(db, Collections.pacientes(empresaId), pacienteId), {
    enfermeirosAutorizados: arrayUnion(nurseUid),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Remove a autorização de um cuidador no paciente. Idempotente (arrayRemove).
 * O acesso cai na próxima leitura: as rules consultam o doc do paciente.
 */
export const deauthorizeNurse = async (
  empresaId: string,
  pacienteId: string,
  nurseUid: string
): Promise<void> => {
  await updateDoc(doc(db, Collections.pacientes(empresaId), pacienteId), {
    enfermeirosAutorizados: arrayRemove(nurseUid),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Lista os pacientes da empresa em que um cuidador está autorizado.
 * USO ADMIN: alimenta a tela de detalhe do cuidador.
 */
export const listPatientsAuthorizedFor = async (
  empresaId: string,
  nurseUid: string
): Promise<Patient[]> => {
  const q = query(
    collection(db, Collections.pacientes(empresaId)),
    where('enfermeirosAutorizados', 'array-contains', nurseUid)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => docToPatient(d.id, d.data()))
    .sort((a, b) => a.nome.localeCompare(b.nome));
};

/**
 * Revoga o acesso de um cuidador a TODOS os pacientes da empresa.
 *
 * Chamado ao desativar ou excluir o cuidador: sem isso, ele continuaria
 * lendo o prontuário dos pacientes em cuja lista ainda constava, porque a
 * autorização vive no paciente, não no status da conta. Desativar sem revogar
 * seria cosmético.
 */
export const deauthorizeNurseEverywhere = async (
  empresaId: string,
  nurseUid: string
): Promise<void> => {
  const autorizados = await listPatientsAuthorizedFor(empresaId, nurseUid);
  await Promise.all(
    autorizados.map((p) => deauthorizeNurse(empresaId, p.id, nurseUid))
  );
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
    // Default para docs anteriores ao isolamento: sem a lista, ninguém é
    // autorizado. Fail-closed de propósito — o backfill preenche.
    enfermeirosAutorizados: data.enfermeirosAutorizados ?? [],
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
  } as Patient;
};
