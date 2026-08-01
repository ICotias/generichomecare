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
    tipo: 'empresa',
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
 * Cria o tenant do CUIDADOR AUTÔNOMO: o profissional que atende por conta
 * própria, sem empresa e sem família contratante por trás.
 *
 * Mesma ideia do tenant da família: um `empresas/{id}` invisível na interface,
 * que mantém uma arquitetura só e isola cada cuidador dos demais pelas regras
 * de sempre. O que muda é quem é o dono e quantos pacientes cabem.
 *
 * O papel continua `nurse`, de propósito. Tudo que ele faz em campo (plantão,
 * registro, fila offline) já funciona nesse papel. Ser `ownerUid` é o que
 * destrava criar paciente, preencher o cadastro clínico e convidar a família,
 * via `isTenantOwner` nas rules.
 */
export const createSoloTenant = async (
  nurseUid: string,
  nomeCuidador: string
): Promise<CreateEmpresaResult> => {
  const now = Timestamp.now();
  const primeiroNome = nomeCuidador.trim().split(/\s+/)[0] ?? '';
  const nome = `Atendimento ${primeiroNome}`.trim();
  const empresaId = generateEmpresaId(nome);

  await setDoc(doc(db, Collections.EMPRESAS, empresaId), {
    nome,
    ownerUid: nurseUid,
    tipo: 'autonomo',
    createdAt: now,
    updatedAt: now,
  });

  await updateDoc(doc(db, Collections.USUARIOS, nurseUid), {
    empresaId,
    updatedAt: now,
  });

  return { empresaId };
};

/**
 * Cria o tenant de uma FAMÍLIA que não tem empresa por trás.
 *
 * O tenant existe só como container de dados: é o mesmo `empresas/{id}` do
 * modo empresa, mas nunca aparece na interface. A família não sabe que ele
 * existe. Isso mantém uma arquitetura só, e cada família fica isolada das
 * outras pelas mesmas regras de sempre.
 *
 * `ownerUid` é a família: é o que permite a ela convidar o próprio cuidador
 * e autorizá-lo no paciente (ver isTenantOwner nas rules).
 */
export const createFamilyTenant = async (
  familyUid: string,
  nomeFamilia: string
): Promise<CreateEmpresaResult> => {
  const now = Timestamp.now();
  const nome = `Família ${nomeFamilia.trim().split(/\s+/).pop() ?? ''}`.trim();
  const empresaId = generateEmpresaId(nome);

  await setDoc(doc(db, Collections.EMPRESAS, empresaId), {
    nome,
    ownerUid: familyUid,
    tipo: 'familia',
    createdAt: now,
    updatedAt: now,
  });

  await updateDoc(doc(db, Collections.USUARIOS, familyUid), {
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
