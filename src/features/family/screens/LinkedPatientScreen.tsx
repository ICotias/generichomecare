import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import { useFamilyPatientId } from '../../../core/hooks/useFamilyPatientId';
import * as patientService from '../../../core/services/patientService';
import type { Patient } from '../../../core/types';
import { PatientPickerBar } from '../../../shared/components/PatientPickerBar';

const calcAge = (birthDate: Date): number => {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const ATENDIMENTO_LABELS: Record<string, string> = {
  integral: 'Integral (24h)',
  diurno: 'Diurno',
  noturno: 'Noturno',
  visita: 'Visita',
};

export const LinkedPatientScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPatient = async () => {
      if (!user?.empresaId || !pacienteId) {
        setIsLoading(false);
        return;
      }

      try {
        const p = await patientService.getPatient(user.empresaId, pacienteId);
        setPatient(p);
      } catch (err) {
        console.error('Erro ao carregar paciente vinculado:', err);
        setError('Erro ao carregar dados do paciente.');
      } finally {
        setIsLoading(false);
      }
    };

    setIsLoading(true);
    loadPatient();
  }, [user?.empresaId, pacienteId]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Patient picker (simulação admin) */}
      {isSimulating && (
        <PatientPickerBar
          patients={simPatients}
          selectedId={pacienteId}
          onSelect={selectPatient}
          isLoading={isLoadingPatients}
        />
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={colors.family} />
          <Text style={[styles.backBtnText, { color: colors.family }]}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Paciente</Text>
        <Text style={[styles.titleAccent, { color: colors.family }]}>Vinculado</Text>
        <View style={styles.separator} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.family} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : !patient ? (
        /* Empty state */
        <View style={styles.centered}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="person-outline" size={48} color={colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Nenhum paciente vinculado</Text>
          <Text style={styles.emptySubtitle}>
            Solicite ao administrador para vincular você a um paciente.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Patient card */}
          <View style={styles.patientCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{patient.nome.charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={styles.patientName}>{patient.nome}</Text>
            <Text style={styles.patientAge}>
              {calcAge(patient.dataNascimento)} anos
              {patient.genero ? ` • ${patient.genero.charAt(0).toUpperCase() + patient.genero.slice(1)}` : ''}
            </Text>
            <View style={[styles.statusBadge, patient.status === 'ativo' ? styles.statusActive : styles.statusInactive]}>
              <Text style={[styles.statusText, patient.status === 'ativo' ? styles.statusTextActive : styles.statusTextInactive]}>
                {patient.status === 'ativo' ? 'Ativo' : patient.status === 'alta' ? 'Alta' : 'Inativo'}
              </Text>
            </View>
          </View>

          {/* Info sections */}
          <Text style={styles.sectionLabel}>TIPO DE ATENDIMENTO</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.infoText}>
                {ATENDIMENTO_LABELS[patient.tipoAtendimento] ?? patient.tipoAtendimento}
              </Text>
            </View>
          </View>

          {patient.diagnosticos.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>DIAGNÓSTICOS</Text>
              <View style={styles.infoCard}>
                {patient.diagnosticos.map((d, i) => (
                  <View key={i} style={[styles.infoRow, i > 0 && styles.infoDivider]}>
                    <Ionicons name="medkit-outline" size={18} color={colors.textSecondary} />
                    <Text style={styles.infoText}>{d}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {patient.alergias.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>ALERGIAS</Text>
              <View style={styles.allergyCard}>
                {patient.alergias.map((a, i) => (
                  <View key={i} style={[styles.infoRow, i > 0 && styles.infoDivider]}>
                    <Ionicons name="warning-outline" size={18} color={colors.allergyText} />
                    <Text style={[styles.infoText, { color: colors.allergyText }]}>{a}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {patient.medicamentosEmUso && patient.medicamentosEmUso.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>MEDICAMENTOS EM USO</Text>
              <View style={styles.infoCard}>
                {patient.medicamentosEmUso.map((m, i) => (
                  <View key={i} style={[styles.infoRow, i > 0 && styles.infoDivider]}>
                    <Ionicons name="medical-outline" size={18} color={colors.textSecondary} />
                    <Text style={styles.infoText}>{m}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {patient.observacoes ? (
            <>
              <Text style={styles.sectionLabel}>OBSERVAÇÕES</Text>
              <View style={styles.infoCard}>
                <Text style={styles.observacoesText}>{patient.observacoes}</Text>
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  backBtnText: { fontSize: fontSize.lg, fontWeight: '600' },
  title: { fontSize: fontSize.title, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.35 },
  titleAccent: { fontSize: fontSize.title, fontWeight: '700', letterSpacing: 0.35 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: spacing.md },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  // Error
  errorText: {
    fontSize: fontSize.md,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  // Empty state
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Patient card
  patientCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.family,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.white,
  },
  patientName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  patientAge: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusActive: {
    backgroundColor: '#DCFCE7',
  },
  statusInactive: {
    backgroundColor: '#FEF2F2',
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#16A34A',
  },
  statusTextInactive: {
    color: '#DC2626',
  },

  // Section
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },

  // Info cards
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  allergyCard: {
    backgroundColor: colors.allergyBg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.allergyBorder,
    padding: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  infoDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  infoText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  observacoesText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
