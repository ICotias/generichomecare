/**
 * Serviço de upload para Firebase Storage.
 *
 * Usa o Firebase JS SDK (compat) para upload de arquivos.
 * O bucket default já está configurado no projeto Firebase.
 *
 * Estrutura no Storage (separação física por sensibilidade):
 *   fotos/{empresaId}/{pacienteId}/publica/{timestamp}_{random}.jpg  → fotos do dia a dia (família pode ver)
 *   fotos/{empresaId}/{pacienteId}/clinica/{timestamp}_{random}.jpg  → fotos clínicas (só equipe)
 *
 * A subpasta é decidida no upload e reforçada pela storage.rules:
 * a família tem leitura negada em /clinica/ independente do Firestore.
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
 *
 * Fotos clínicas vão para a subpasta `clinica/` (acesso restrito à equipe);
 * as demais para `publica/` (visíveis também à família).
 */
export const generatePhotoPath = (
  empresaId: string,
  pacienteId: string,
  fotoClinica = false
): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const pasta = fotoClinica ? 'clinica' : 'publica';
  return `fotos/${empresaId}/${pacienteId}/${pasta}/${timestamp}_${random}.jpg`;
};
