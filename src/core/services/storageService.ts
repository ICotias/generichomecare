/**
 * Serviço de upload para Firebase Storage.
 *
 * Usa o Firebase JS SDK (compat) para upload de arquivos.
 * O bucket default já está configurado no projeto Firebase.
 *
 * Estrutura no Storage:
 *   fotos/{empresaId}/{pacienteId}/{timestamp}_{random}.jpg
 *
 * IMPORTANTE: firebase/storage precisa estar importado.
 * O Firebase JS SDK já inclui o módulo de storage.
 */
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';

// ════════════════════════════════════════════
// Upload
// ════════════════════════════════════════════

/**
 * Faz upload de uma imagem a partir de uma URI local (file://).
 * Retorna { downloadUrl, storagePath }.
 */
export const uploadImage = async (
  localUri: string,
  storagePath: string
): Promise<{ downloadUrl: string; storagePath: string }> => {
  // Fetch the local file as a blob
  const response = await fetch(localUri);
  const blob = await response.blob();

  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob);

  const downloadUrl = await getDownloadURL(storageRef);

  return { downloadUrl, storagePath };
};

/**
 * Gera um path único para upload de foto de paciente.
 */
export const generatePhotoPath = (
  empresaId: string,
  pacienteId: string
): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `fotos/${empresaId}/${pacienteId}/${timestamp}_${random}.jpg`;
};
