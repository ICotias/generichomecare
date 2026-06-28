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
import { UserRole } from '../types';

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
  coren?: string;
}

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
}

/**
 * Cria uma conta de enfermeiro no Firebase Auth e um perfil no Firestore.
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
      createdAt: now,
      updatedAt: now,
      status: 'ativo',
    };

    if (input.coren) {
      userData.coren = input.coren;
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
 * Convida uma família: cria a conta no Firebase Auth com senha temporária,
 * SEM paciente vinculado (a família cadastra o paciente no 1º acesso) e com
 * mustChangePassword=true (troca obrigatória no 1º login).
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
      pacienteId: '', // sem paciente — família cadastra no 1º acesso
      parentesco: input.parentesco,
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
