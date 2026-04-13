import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Collections } from '../../shared/constants/firestore';
import { Shift } from '../types';

interface CheckinData {
  empresaId: string;
  pacienteId: string;
  profissionalId: string;
  profissionalNome: string;
  latitude: number;
  longitude: number;
}

interface CheckoutData {
  shiftId: string;
  empresaId: string;
  latitude: number;
  longitude: number;
}

/**
 * Registra checkin de um plantão no Firestore.
 * Retorna o ID do documento criado.
 */
export const checkin = async (data: CheckinData): Promise<string> => {
  const collectionPath = Collections.plantoes(data.empresaId);

  const docRef = await addDoc(collection(db, collectionPath), {
    empresaId: data.empresaId,
    pacienteId: data.pacienteId,
    profissionalId: data.profissionalId,
    profissionalNome: data.profissionalNome,
    checkinAt: Timestamp.now(),
    checkinLat: data.latitude,
    checkinLng: data.longitude,
    status: 'em_andamento',
  });

  return docRef.id;
};

/**
 * Registra checkout de um plantão existente.
 */
export const checkout = async (data: CheckoutData): Promise<void> => {
  const collectionPath = Collections.plantoes(data.empresaId);
  const docRef = doc(db, collectionPath, data.shiftId);

  await updateDoc(docRef, {
    checkoutAt: Timestamp.now(),
    checkoutLat: data.latitude,
    checkoutLng: data.longitude,
    status: 'finalizado',
  });
};

/**
 * Busca plantão em andamento do profissional.
 * Retorna null se não houver plantão ativo.
 */
export const getActiveShift = async (
  empresaId: string,
  profissionalId: string
): Promise<(Shift & { id: string }) | null> => {
  const collectionPath = Collections.plantoes(empresaId);

  const q = query(
    collection(db, collectionPath),
    where('profissionalId', '==', profissionalId),
    where('status', '==', 'em_andamento')
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const docSnap = snapshot.docs[0];
  const data = docSnap.data();

  return {
    id: docSnap.id,
    empresaId: data.empresaId,
    pacienteId: data.pacienteId,
    profissionalId: data.profissionalId,
    profissionalNome: data.profissionalNome,
    checkinAt: data.checkinAt?.toDate?.() ?? new Date(),
    checkinLat: data.checkinLat,
    checkinLng: data.checkinLng,
    checkoutAt: data.checkoutAt?.toDate?.(),
    checkoutLat: data.checkoutLat,
    checkoutLng: data.checkoutLng,
    status: data.status,
  };
};
