/**
 * Hook compartilhado pelas telas de registro do enfermeiro.
 *
 * Concentra o fluxo repetido em todas elas: guarda de usuário autenticado,
 * estado de envio, chamada ao offlineQueue (online com fallback offline),
 * alertas de sucesso/erro e o goBack. Cada tela mantém só a sua validação e
 * a montagem do registro (que são realmente diferentes entre elas).
 */
import { useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useAuthStore } from './useAuth';
import { saveRecordWithFallback } from '../services/offlineQueue';
import type { CreateRecordInput } from '../services/registroService';

const OFFLINE_MESSAGE =
  'Sem conexão. O registro foi salvo e será sincronizado automaticamente quando voltar a ter internet.';

interface SaveArgs {
  /** Paciente do registro. */
  pacienteId: string;
  /** Mensagem exibida quando salvo online. */
  successMessage: string;
  /**
   * Monta o registro a ser salvo. Pode ser assíncrona (ex.: processar imagem).
   * Retornar null aborta o salvamento sem erro (a própria função já avisou o
   * usuário, como na falha de processamento de foto).
   */
  build: () => CreateRecordInput | null | Promise<CreateRecordInput | null>;
}

export const useSaveRecord = (errorLabel: string) => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const save = async ({ pacienteId, successMessage, build }: SaveArgs) => {
    if (!user?.empresaId || !user?.uid) return;

    setIsSubmitting(true);
    try {
      const payload = await build();
      if (!payload) return; // build abortou (já avisou o usuário)

      const { online } = await saveRecordWithFallback(
        user.empresaId,
        pacienteId,
        payload,
        user.uid,
        user.role,
      );

      Alert.alert(
        online ? 'Registrado' : 'Salvo offline',
        online ? successMessage : OFFLINE_MESSAGE,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar o registro.');
      console.error(errorLabel, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return { isSubmitting, save };
};
