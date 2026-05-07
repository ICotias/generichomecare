import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  Timestamp,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Collections } from '../../shared/constants/firestore';

interface CreateEvolucaoInput {
  empresaId: string;
  pacienteId: string;
  profissionalId: string;
  plantaoId: string;
  situacao: string;
  ocorrencias: string;
  pendencias: string;
  orientacoes: string;
  observacoesLivres?: string;
}

/**
 * Cria uma evolução (passagem de plantão SBAR) — imutável no Firestore.
 */
export const createEvolucao = async (input: CreateEvolucaoInput): Promise<string> => {
  const collectionPath = Collections.evolucoes(input.empresaId, input.pacienteId);

  const docRef = await addDoc(collection(db, collectionPath), {
    ...input,
    timestamp: Timestamp.now(),
  });

  return docRef.id;
};

/**
 * Lista últimas evoluções de um paciente.
 */
export const listEvolucoes = async (
  empresaId: string,
  pacienteId: string,
  maxResults = 10
) => {
  const collectionPath = Collections.evolucoes(empresaId, pacienteId);

  const constraints: QueryConstraint[] = [
    orderBy('timestamp', 'desc'),
    limit(maxResults),
  ];

  const q = query(collection(db, collectionPath), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      timestamp: data.timestamp?.toDate?.() ?? new Date(),
    };
  });
};
