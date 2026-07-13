import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { differenceInYears } from 'date-fns';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import { useFamilyPatientId } from '../../../core/hooks/useFamilyPatientId';
import * as patientService from '../../../core/services/patientService';
import type { Patient } from '../../../core/types';
import { Ionicons } from '@expo/vector-icons';
import { PatientPickerBar } from '../../../shared/components/PatientPickerBar';
import type { PatientInfoStackParamList } from '../../../core/navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<PatientInfoStackParamList, 'PatientInfo'>;

const TIPO_LABELS: Record<Patient['tipoAtendimento'], string> = {
  integral: '24h',
  diurno: 'Diurno',
  noturno: 'Noturno',
  visita: 'Visita',
};

const calcAge = (birth: Date): number => differenceInYears(new Date(), birth);

export const PatientInfoScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { user } = useAuthStore();
  const {
    pacienteId,
    isSimulating,
    patients: simPatients,
    isLoadingPatients,
    selectPatient,
  } = useFamilyPatientId();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!user?.empresaId || !pacienteId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      patientService
        .getPatient(user.empresaId, pacienteId)
        .then(setPatient)
        .catch((err) => console.error('PatientInfo load error', err))
        .finally(() => setIsLoading(false));
    }, [user?.empresaId, pacienteId])
  );

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.family} />
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>Paciente não vinculado</Text>
        <Text style={styles.emptyHint}>Peça ao administrador para vincular seu perfil.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Patient picker (simulação admin) */}
      {isSimulating && (
        <View style={{ paddingTop: insets.top }}>
          <PatientPickerBar
            patients={simPatients}
            selectedId={pacienteId}
            onSelect={selectPatient}
            isLoading={isLoadingPatients}
          />
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: isSimulating ? spacing.md : insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.patientHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{patient.nome.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.patientInfo}>
            <Text style={styles.patientName}>{patient.nome}</Text>
            <Text style={styles.patientMeta}>
              {calcAge(patient.dataNascimento)} anos · {TIPO_LABELS[patient.tipoAtendimento]}
            </Text>
          </View>
        </View>

        {/* Alergias */}
        {patient.alergias.length > 0 && (
          <View style={styles.alertSection}>
            <View style={styles.alertHeader}>
              <Ionicons name="warning-outline" size={16} color="#E65100" />
              <Text style={styles.alertTitle}>ALERGIAS</Text>
            </View>
            <View style={styles.tagRow}>
              {patient.alergias.map((a, i) => (
                <View key={i} style={styles.alertTag}>
                  <Text style={styles.alertTagText}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Diagnósticos */}
        {patient.diagnosticos.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>DIAGNÓSTICOS</Text>
            <View style={styles.tagRow}>
              {patient.diagnosticos.map((d, i) => (
                <View key={i} style={styles.tag}>
                  <Text style={styles.tagText}>{d}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Medicamentos */}
        {patient.medicamentosEmUso && patient.medicamentosEmUso.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>MEDICAMENTOS EM USO</Text>
            <View style={styles.tagRow}>
              {patient.medicamentosEmUso.map((m, i) => (
                <View key={i} style={styles.medTag}>
                  <Ionicons name="medkit-outline" size={14} color="#2E7D32" />
                  <Text style={styles.medTagText}>{m}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Dados */}
        <Text style={styles.sectionTitle}>INFORMAÇÕES</Text>
        <View style={styles.infoCard}>
          <InfoRow label="Gênero" value={patient.genero} />
          <InfoRow label="Tipo" value={TIPO_LABELS[patient.tipoAtendimento]} />
          <InfoRow label="Emergência" value={`${patient.contatoEmergencia.nome} (${patient.contatoEmergencia.parentesco})`} />
          <InfoRow label="Tel. emergência" value={patient.contatoEmergencia.telefone} />
          {patient.observacoes && (
            <InfoRow label="Observações" value={patient.observacoes} last />
          )}
        </View>

        {/* Faixas de sinais vitais */}
        <Text style={styles.sectionTitle}>FAIXAS DE SINAIS VITAIS</Text>
        <View style={styles.infoCard}>
          <InfoRow label="PA Sistólica" value={`${patient.faixaSinaisVitais.paSistolicaMin} a ${patient.faixaSinaisVitais.paSistolicaMax} mmHg`} />
          <InfoRow label="PA Diastólica" value={`${patient.faixaSinaisVitais.paDiastolicaMin} a ${patient.faixaSinaisVitais.paDiastolicaMax} mmHg`} />
          <InfoRow label="FC" value={`${patient.faixaSinaisVitais.fcMin} a ${patient.faixaSinaisVitais.fcMax} bpm`} />
          <InfoRow label="Temp." value={`${patient.faixaSinaisVitais.tempMin} a ${patient.faixaSinaisVitais.tempMax} °C`} />
          <InfoRow label="SpO₂ mín." value={`${patient.faixaSinaisVitais.satO2Min}%`} last />
        </View>

        {/* Link to vitals chart */}
        <TouchableOpacity
          style={styles.chartButton}
          onPress={() => navigation.navigate('VitalsChart')}
          activeOpacity={0.7}
        >
          <Ionicons name="bar-chart-outline" size={18} color={colors.family} />
          <Text style={styles.chartButtonText}>Ver gráfico de sinais vitais</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const InfoRow = ({ label, value, last }: { label: string; value: string; last?: boolean }) => (
  <View style={[styles.infoRow, last && styles.infoRowLast]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: spacing.lg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  emptyText: { fontSize: fontSize.lg, fontWeight: '600', color: colors.textPrimary },
  emptyHint: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.xl },

  // Patient header
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.family + '1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.family },
  patientInfo: { flex: 1 },
  patientName: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary },
  patientMeta: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: 2 },

  // Alert
  alertSection: {
    backgroundColor: '#FFF8E1',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  alertTitle: { fontSize: fontSize.xs, fontWeight: '700', color: '#E65100', letterSpacing: 0.8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  alertTag: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: '#FF9800',
  },
  alertTagText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.white },

  // Section
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },

  // Tags
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.border,
  },
  tagText: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '500' },
  medTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: '#E8F5E9',
    gap: spacing.xs,
  },
  medTagText: { fontSize: fontSize.sm, color: '#2E7D32', fontWeight: '500' },

  // Info card
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { fontSize: fontSize.sm, color: colors.textSecondary, flex: 1 },
  infoValue: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '600', textAlign: 'right', flex: 2 },

  // Chart button
  chartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: borderRadius.full,
    backgroundColor: colors.family + '1A',
    borderWidth: 1,
    borderColor: colors.family,
  },
  chartButtonText: { fontSize: fontSize.md, fontWeight: '600', color: colors.family },
});
