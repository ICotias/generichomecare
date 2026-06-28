import { doc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Collections } from '../../shared/constants/firestore';

export interface CreateEmpresaInput {
  nome: string;
  cnpj?: string;
  cidade?: string;
  adminUid: string;
}

export interface CreateEmpresaResult {
  empresaId: string;
}

/**
 * Cria uma empresa e vincula o admin a ela (atualizando o doc de usuário
 * com o empresaId recém-criado).
 */
export const createEmpresa = async (
  input: CreateEmpresaInput
): Promise<CreateEmpresaResult> => {
  const now = Timestamp.now();
  const empresaId = generateEmpresaId(input.nome);

  const empresaData: Record<string, unknown> = {
    nome: input.nome,
    ownerUid: input.adminUid,
    createdAt: now,
    updatedAt: now,
  };
  if (input.cnpj) empresaData.cnpj = input.cnpj;
  if (input.cidade) empresaData.cidade = input.cidade;

  await setDoc(doc(db, Collections.EMPRESAS, empresaId), empresaData);

  await updateDoc(doc(db, Collections.USUARIOS, input.adminUid), {
    empresaId,
    updatedAt: now,
  });

  return { empresaId };
};

/**
 * Gera um ID legível e único para a empresa, baseado no nome.
 * Ex.: "Clínica Vida" → "clinica-vida-ab12cd"
 */
const generateEmpresaId = (nome: string): string => {
  const slug = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  const rand = Math.random().toString(36).slice(2, 8);
  return `${slug || 'empresa'}-${rand}`;
};
