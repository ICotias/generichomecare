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
import { doc, setDoc, Timestamp } from 'firebase/firestore';

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

export interface CreateNurseResult {
  uid: string;
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
