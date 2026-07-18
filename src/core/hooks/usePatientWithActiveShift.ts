/**
 * Hook que carrega a lista de pacientes e pré-seleciona
 * o paciente do plantão ativo (se houver).
 */
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as patientService from '../services/patientService';
import * as shiftService from '../services/shiftService';
import type { Patient } from '../types';
import { useAuthStore } from './useAuth';

export const usePatientWithActiveShift = (empresaId?: string, uid?: string) => {
  const originalRole = useAuthStore((s) => s.originalRole);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!empresaId || !uid) return;
      Promise.all([
        patientService.listPatientsVisibleTo(empresaId, uid, originalRole),
        shiftService.getActiveShift(empresaId, uid).catch(() => null),
      ]).then(([list, activeShift]) => {
        const result = list;
        setPatients(result);
        // setter funcional: não sobrescreve seleção já feita, sem depender de
        // selectedPatient no closure do useCallback
        if (activeShift?.pacienteId) {
          const match = result.find((p) => p.id === activeShift.pacienteId);
          if (match) setSelectedPatient((prev) => prev ?? match);
        }
      }).catch(console.error);
    }, [empresaId, uid, originalRole])
  );

  return { patients, selectedPatient, setSelectedPatient };
};
