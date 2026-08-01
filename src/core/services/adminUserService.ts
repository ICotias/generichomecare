/**
 * Serviço para operações administrativas de usuários.
 *
 * ATENÇÃO — Criação de usuário pelo client SDK:
 * O método createUserWithEmailAndPassword do client SDK autentica
 * automaticamente o usuário recém-criado, o que deslogaria o admin.
 *
 * Workaround: inicializamos uma segunda instância do Firebase App
 * (secondaryApp) exclusivamente para criar o usuário, sem afetar
 * a sessão do admin na instância principal. Após criar, deslogamos
 * da instância secundária (não da primária).
 *
 * Solução ideal (futura): Cloud Function + Firebase Admin SDK,
 * que não tem essa limitação e permite maior controle (claims, etc).
 *
 * Ref: https://www.xjavascript.com/blog/firebase-kicks-out-current-user/
 */
import { initializeApp, getApps, getApp, deleteApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  updateDoc,
  Timestamp,
  collection,
  query,
  where,
  getDocs,
  deleteField,
} from 'firebase/firestore';

import { db, firebaseConfig } from '../config/firebase';
import { Collections } from '../../shared/constants/firestore';
import { UserRole, CorenCategoria, CorenRegistro } from '../types';

const SECONDARY_APP_NAME = 'Secondary';

const getSecondaryApp = (): FirebaseApp => {
  const existing = getApps().find((a) => a.name === SECONDARY_APP_NAME);
  if (existing) return existing;
  return initializeApp(firebaseConfig, SECONDARY_APP_NAME);
};

export interface CreateNurseInput {
  email: string;
  password: string;
  nome: string;
  telefone: string;
  empresaId: string;
  /** Registro profissional + atesto de quem conferiu no Cofen */
  coren?: CorenRegistroInput;
  /** UID de quem está criando a conta (autor do atesto do COREN) */
  criadoPorUid: string;
}

/** O que a tela entrega: o service carimba a data e o autor do atesto. */
export interface CorenRegistroInput {
  uf: string;
  numero: string;
  categoria: CorenCategoria;
  verificado: boolean;
}

/**
 * Monta o corenRegistro persistido. O atesto NUNCA vem pronto da tela: quem
 * carimba quem conferiu e quando é o service, a partir do usuário logado.
 */
const buildCorenRegistro = (
  input: CorenRegistroInput,
  criadoPorUid: string,
  now: Timestamp
): Record<string, unknown> => ({
  uf: input.uf,
  numero: input.numero,
  categoria: input.categoria,
  verificado: input.verificado,
  ...(input.verificado ? { verificadoEm: now, verificadoPorUid: criadoPorUid } : {}),
});

export interface CreateFamilyInput {
  email: string;
  password: string;
  nome: string;
  telefone: string;
  empresaId: string;
  pacienteId: string;
  parentesco: string;
}

export interface CreateNurseResult {
  uid: string;
}

export interface FamilyMember {
  uid: string;
  nome: string;
  email: string;
  telefone?: string;
  parentesco?: string;
  pacienteId?: string;
  /** Ausente = titular (contas anteriores ao campo) */
  familiaTitular?: boolean;
}

export interface NurseMember {
  uid: string;
  nome: string;
  email: string;
  telefone?: string;
  corenRegistro?: CorenRegistro;
}

/**
 * Cria uma conta de cuidador no Firebase Auth e um perfil no Firestore.
 *
 * Usa uma app secundária para não desautenticar o admin atual.
 */
export const createNurseAccount = async (
  input: CreateNurseInput
): Promise<CreateNurseResult> => {
  const secondary = getSecondaryApp();
  const secondaryAuth = getAuth(secondary);

  try {
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      input.email,
      input.password
    );

    const uid = cred.user.uid;
    const now = Timestamp.now();

    const userData: Record<string, unknown> = {
      uid,
      email: input.email,
      nome: input.nome,
      role: 'nurse' satisfies UserRole,
      empresaId: input.empresaId,
      telefone: input.telefone,
      // Senha definida pelo admin é temporária: força a troca no 1º acesso.
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
      status: 'ativo',
    };

    if (input.coren) {
      userData.corenRegistro = buildCorenRegistro(input.coren, input.criadoPorUid, now);
    }

    await setDoc(doc(db, Collections.USUARIOS, uid), userData);

    // Desloga da instância secundária para não deixar sessão pendurada.
    await signOut(secondaryAuth);

    return { uid };
  } finally {
    // Limpa a app secundária para liberar recursos.
    // getApp() tenta obter de novo — se já foi removida, ignora.
    try {
      const app = getApp(SECONDARY_APP_NAME);
      await deleteApp(app);
    } catch {
      // noop
    }
  }
};

/**
 * Cria uma conta de familiar no Firebase Auth e um perfil no Firestore.
 * Vincula o familiar ao paciente informado.
 *
 * Usa a mesma técnica de app secundária do createNurseAccount.
 */
export const createFamilyAccount = async (
  input: CreateFamilyInput
): Promise<CreateNurseResult> => {
  const secondary = getSecondaryApp();
  const secondaryAuth = getAuth(secondary);

  try {
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      input.email,
      input.password
    );

    const uid = cred.user.uid;
    const now = Timestamp.now();

    const userData: Record<string, unknown> = {
      uid,
      email: input.email,
      nome: input.nome,
      role: 'family' satisfies UserRole,
      empresaId: input.empresaId,
      telefone: input.telefone,
      pacienteId: input.pacienteId,
      parentesco: input.parentesco,
      familiaTitular: true,
      // Senha definida pelo admin é temporária: força a troca no 1º acesso.
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
      status: 'ativo',
    };

    await setDoc(doc(db, Collections.USUARIOS, uid), userData);
    await signOut(secondaryAuth);

    return { uid };
  } finally {
    try {
      const app = getApp(SECONDARY_APP_NAME);
      await deleteApp(app);
    } catch {
      // noop
    }
  }
};

export interface InviteFamilyInput {
  email: string;
  nome: string;
  telefone: string;
  empresaId: string;
  parentesco: string;
  /**
   * Paciente a que a família será vinculada. No modo empresa o paciente já
   * existe quando o convite sai, então o vínculo nasce pronto e não sobra
   * conta de família sem paciente.
   */
  pacienteId?: string;
}

export interface InviteFamilyResult {
  uid: string;
  tempPassword: string;
}

/**
 * Gera uma senha temporária legível (sem caracteres ambíguos como O/0, l/1).
 */
const generateTempPassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let p = '';
  for (let i = 0; i < 10; i += 1) {
    p += chars[Math.floor(Math.random() * chars.length)];
  }
  return p;
};

/**
 * Convida uma família: cria a conta no Firebase Auth com senha temporária e
 * com mustChangePassword=true (troca obrigatória no 1º login).
 *
 * Com `pacienteId`, a conta já nasce vinculada, que é o caminho normal no modo
 * empresa (o convite sai de dentro da ficha do paciente). Sem ele, a conta fica
 * sem paciente e precisa ser vinculada depois pela LinkFamilyScreen.
 *
 * Retorna a senha temporária para o admin repassar (ex.: via WhatsApp).
 * Usa a app secundária para não deslogar o admin.
 */
export const inviteFamilyAccount = async (
  input: InviteFamilyInput
): Promise<InviteFamilyResult> => {
  const tempPassword = generateTempPassword();
  const secondary = getSecondaryApp();
  const secondaryAuth = getAuth(secondary);

  try {
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      input.email.trim(),
      tempPassword
    );

    const uid = cred.user.uid;
    const now = Timestamp.now();

    const userData: Record<string, unknown> = {
      uid,
      email: input.email.trim().toLowerCase(),
      nome: input.nome,
      role: 'family' satisfies UserRole,
      empresaId: input.empresaId,
      telefone: input.telefone,
      pacienteId: input.pacienteId ?? '',
      parentesco: input.parentesco,
      familiaTitular: true,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
      status: 'ativo',
    };

    await setDoc(doc(db, Collections.USUARIOS, uid), userData);
    await signOut(secondaryAuth);

    return { uid, tempPassword };
  } finally {
    try {
      const app = getApp(SECONDARY_APP_NAME);
      await deleteApp(app);
    } catch {
      // noop
    }
  }
};

export interface InviteNurseInput {
  email: string;
  nome: string;
  telefone: string;
  empresaId: string;
  coren: CorenRegistroInput;
  /** UID de quem convida (autor do atesto do COREN) */
  criadoPorUid: string;
}

export interface InviteNurseResult {
  uid: string;
  tempPassword: string;
}

/**
 * Convida um cuidador com senha temporária e troca obrigatória no 1º acesso.
 * Espelha o inviteFamilyAccount.
 *
 * Usado no modo familiar, onde a família é dona do próprio tenant e convida o
 * cuidador que já cuida do paciente dela. O admin de empresa usa o
 * createNurseAccount (que define a senha à mão).
 *
 * Convidar NÃO dá acesso ao prontuário: quem dá acesso é a autorização no
 * paciente (patientService.authorizeNurse). São dois atos separados de
 * propósito.
 */
export const inviteNurseAccount = async (
  input: InviteNurseInput
): Promise<InviteNurseResult> => {
  const tempPassword = generateTempPassword();
  const secondary = getSecondaryApp();
  const secondaryAuth = getAuth(secondary);

  try {
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      input.email.trim(),
      tempPassword
    );

    const uid = cred.user.uid;
    const now = Timestamp.now();

    const userData: Record<string, unknown> = {
      uid,
      email: input.email.trim().toLowerCase(),
      nome: input.nome,
      role: 'nurse' satisfies UserRole,
      empresaId: input.empresaId,
      telefone: input.telefone,
      corenRegistro: buildCorenRegistro(input.coren, input.criadoPorUid, now),
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
      status: 'ativo',
    };

    await setDoc(doc(db, Collections.USUARIOS, uid), userData);
    await signOut(secondaryAuth);

    return { uid, tempPassword };
  } finally {
    try {
      const app = getApp(SECONDARY_APP_NAME);
      await deleteApp(app);
    } catch {
      // noop
    }
  }
};

export interface InviteRelativeInput {
  email: string;
  nome: string;
  telefone: string;
  parentesco: string;
  empresaId: string;
  /** Paciente que o parente vai acompanhar (o mesmo de quem convida) */
  pacienteId: string;
}

/**
 * A titular convida um PARENTE para acompanhar o mesmo paciente.
 * Ex.: dois irmãos cuidando da mãe.
 *
 * O convidado nasce acompanhante (`familiaTitular: false`): vê a timeline, os
 * sinais vitais e o histórico, mas não edita o paciente, não mexe no
 * cuidador e não convida mais ninguém. Quem responde pelo cadastro continua
 * sendo uma pessoa só, e o convite não vira corrente sem fim.
 *
 * O `pacienteId` vem de quem convida, nunca digitado pelo convidado: nenhum
 * dado prova parentesco, então o vínculo só nasce de quem já tem autoridade.
 */
export const inviteRelativeAccount = async (
  input: InviteRelativeInput
): Promise<InviteFamilyResult> => {
  const tempPassword = generateTempPassword();
  const secondary = getSecondaryApp();
  const secondaryAuth = getAuth(secondary);

  try {
    const cred = await createUserWithEmailAndPassword(
      secondaryAuth,
      input.email.trim(),
      tempPassword
    );

    const uid = cred.user.uid;
    const now = Timestamp.now();

    await setDoc(doc(db, Collections.USUARIOS, uid), {
      uid,
      email: input.email.trim().toLowerCase(),
      nome: input.nome,
      role: 'family' satisfies UserRole,
      empresaId: input.empresaId,
      telefone: input.telefone,
      pacienteId: input.pacienteId,
      parentesco: input.parentesco,
      familiaTitular: false,
      mustChangePassword: true,
      createdAt: now,
      updatedAt: now,
      status: 'ativo',
    });

    await signOut(secondaryAuth);
    return { uid, tempPassword };
  } finally {
    try {
      const app = getApp(SECONDARY_APP_NAME);
      await deleteApp(app);
    } catch {
      // noop
    }
  }
};

/**
 * Lista os cuidadores de um tenant. Usado pela família dona do tenant
 * (modo familiar) para ver quem ela já convidou.
 */
export const listNurses = async (empresaId: string): Promise<NurseMember[]> => {
  const q = query(
    collection(db, Collections.USUARIOS),
    where('empresaId', '==', empresaId),
    where('role', '==', 'nurse')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      nome: data.nome ?? '',
      email: data.email ?? '',
      telefone: data.telefone,
      corenRegistro: data.corenRegistro,
    };
  });
};

// ════════════════════════════════════════════
// Familiares — consultar, vincular, desvincular
// ════════════════════════════════════════════

/**
 * Lista todos os familiares vinculados a um paciente.
 */
export const listFamilyByPatient = async (
  empresaId: string,
  pacienteId: string
): Promise<FamilyMember[]> => {
  const q = query(
    collection(db, Collections.USUARIOS),
    where('empresaId', '==', empresaId),
    where('role', '==', 'family'),
    where('pacienteId', '==', pacienteId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      nome: data.nome ?? '',
      email: data.email ?? '',
      telefone: data.telefone,
      parentesco: data.parentesco,
      pacienteId: data.pacienteId,
      familiaTitular: data.familiaTitular ?? true,
    };
  });
};

/**
 * Busca um familiar existente (role=family) pelo email na mesma empresa.
 * Retorna null se não encontrar.
 */
export const findFamilyByEmail = async (
  empresaId: string,
  email: string
): Promise<FamilyMember | null> => {
  const q = query(
    collection(db, Collections.USUARIOS),
    where('empresaId', '==', empresaId),
    where('role', '==', 'family'),
    where('email', '==', email.trim().toLowerCase())
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  const data = d.data();
  return {
    uid: d.id,
    nome: data.nome ?? '',
    email: data.email ?? '',
    telefone: data.telefone,
    parentesco: data.parentesco,
    pacienteId: data.pacienteId,
  };
};

/**
 * Vincula um familiar existente a um paciente (atualiza pacienteId + parentesco).
 */
export const linkExistingFamily = async (
  uid: string,
  pacienteId: string,
  parentesco: string
): Promise<void> => {
  await updateDoc(doc(db, Collections.USUARIOS, uid), {
    pacienteId,
    parentesco,
    updatedAt: Timestamp.now(),
  });
};

/**
 * Desvincula um familiar de um paciente (remove pacienteId).
 */
export const unlinkFamily = async (uid: string): Promise<void> => {
  await updateDoc(doc(db, Collections.USUARIOS, uid), {
    pacienteId: deleteField(),
    updatedAt: Timestamp.now(),
  });
};
