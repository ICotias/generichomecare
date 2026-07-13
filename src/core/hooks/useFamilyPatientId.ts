/**
 * Hook que fornece o pacienteId correto para as telas do familiar.
 *
 * - Familiar real: usa user.pacienteId do Firestore
 * - Admin simulando family: usa simulatedPatientId do auth store,
 *   e expõe lista de pacientes + seletor para o admin escolher
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from './useAuth';
import * as patientService from '../services/patientService';
import type { Patient } from '../types';

interface FamilyPatientResult {
  /** O pacienteId ativo (do user real ou da simulação) */
  pacienteId: string | undefined;
  /** Se está em simulação admin→family */
  isSimulating: boolean;
  /** Lista de pacientes para seleção (só populada em simulação) */
  patients: Patient[];
  /** Se está carregando a lista de pacientes */
  isLoadingPatients: boolean;
  /** Selecionar um paciente (simulação) */
  selectPatient: (id: string) => void;
}

export const useFamilyPatientId = (): FamilyPatientResult => {
  const { user, isSimulating, simulatedPatientId, setSimulatedPatientId } = useAuthStore();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);

  // O pacienteId real do familiar vem do doc Firestore
  const realPacienteId = user?.pacienteId;

  // Em simulação, carregar todos os pacientes para seleção
  useEffect(() => {
    if (!isSimulating || !user?.empresaId) return;

    setIsLoadingPatients(true);
    patientService
      .listPatients(user.empresaId)
      .then((list) => {
        const ativos = list.filter((p) => p.status === 'ativo');
        setPatients(ativos);
        // Auto-selecionar o primeiro se não tem nenhum selecionado.
        // Lê o estado atual via getState para não depender de simulatedPatientId
        // no closure (evita re-fetch a cada seleção).
        const store = useAuthStore.getState();
        if (!store.simulatedPatientId && ativos.length > 0) {
          store.setSimulatedPatientId(ativos[0].id);
        }
      })
      .catch((err) => {
        console.error('useFamilyPatientId: erro ao carregar pacientes', err);
      })
      .finally(() => setIsLoadingPatients(false));
  }, [isSimulating, user?.empresaId]);

  const selectPatient = useCallback(
    (id: string) => {
      setSimulatedPatientId(id);
    },
    [setSimulatedPatientId]
  );

  return {
    pacienteId: isSimulating ? (simulatedPatientId ?? undefined) : realPacienteId,
    isSimulating,
    patients,
    isLoadingPatients,
    selectPatient,
  };
};
