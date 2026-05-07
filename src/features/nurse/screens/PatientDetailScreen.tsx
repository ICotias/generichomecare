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
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as patientService from '../../../core/services/patientService';
import type { Patient } from '../../../core/types';
import type {
  NurseHomeStackParamList,
  NurseTabParamList,
} from '../../../core/navigation/RootNavigator';

type NavProp = CompositeNavigationProp<
  NativeStackNavigationProp<NurseHomeStackParamList, 'PatientDetail'>,
  BottomTabNavigationProp<NurseTabParamList>
>;
type RoutePropType = RouteProp<NurseHomeStackParamList, 'PatientDetail'>;

const TIPO_LABELS: Record<Patient['tipoAtendimento'], string> = {
  integral: '24h',
  diurno: 'Diurno',
  noturno: 'Noturno',
  visita: 'Visita',
};

const calcAge = (birth: Date): number => {
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
};

interface QuickAction {
  key: string;
  label: string;
  ionicon: React.ComponentProps<typeof Ionicons>['name'];
  bgColor: string;
  iconColor: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { key: 'medication', label: 'Medicamento', ionicon: 'bandage-outline', bgColor: '#F3F0FF', iconColor: '#7C3AED' },
  { key: 'vitals', label: 'Sinais vitais', ionicon: 'heart-outline', bgColor: '#FEF2F2', iconColor: '#EF4444' },
  { key: 'feeding', label: 'Alimentação', ionicon: 'restaurant-outline', bgColor: '#FFFBEB', iconColor: '#F59E0B' },
  { key: 'activity', label: 'Atividade', ionicon: 'pulse-outline', bgColor: '#F0FDF4', iconColor: '#10B981' },
  { key: 'incident', label: 'Intercorrência', ionicon: 'alert-circle-outline', bgColor: '#FEF2F2', iconColor: '#DC2626' },
  { key: 'photo', label: 'Foto', ionicon: 'camera-outline', bgColor: '#F1F5F9', iconColor: '#64748B' },
];

const STATUS_LABELS: Record<Patient['status'], string> = {
  ativo: 'ATIVO',
  inativo: 'INATIVO',
  alta: 'ALTA',
};

const STATUS_COLORS: Record<Patient['status'], string> = {
  ativo: colors.success,
  inativo: colors.textMuted,
  alta: colors.warning,
};

export const PatientDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const { user } = useAuthStore();

  const patientId = route.params?.patientId;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.empresaId || !patientId) return;
    setIsLoading(true);
    try {
      const p = await patientService.getPatient(user.empresaId, patientId);
      setPatient(p);
    } catch (err) {
      console.error('PatientDetail load error', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.empresaId, patientId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const QUICK_ACTION_SCREEN: Record<string, string> = {
    medication: 'RegisterMedication',
    vitals: 'RegisterVitals',
    feeding: 'RegisterFeeding',
    activity: 'RegisterActivity',
    incident: 'RegisterIncident',
    photo: 'RegisterPhoto',
  };

  const handleQuickAction = (key: string) => {
    const screen = QUICK_ACTION_SCREEN[key];
    if (screen) {
      navigation.navigate('RegisterStack', { screen } as never);
    }
  };

  // ════════════════════════════════════════════

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorMsg}>Paciente não encontrado</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backBtnText}>Voltar</Text>
        </TouchableOpacity>

        {/* Patient header — avatar + info */}
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

        {/* Alergias destaque (card amarelo) */}
        {patient.alergias.length > 0 && (
          <View style={styles.alertSection}>
            <View style={styles.alertHeader}>
              <Ionicons name="alert-circle" size={18} color="#E65100" />
              <Text style={styles.alertTitle}>ALERGIAS REGISTRADAS</Text>
            </View>
            <View style={styles.alertTagRow}>
              {patient.alergias.map((a, i) => (
                <View key={i} style={styles.alertTag}>
                  <Text style={styles.alertTagText}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Ações rápidas — grid 3x2 com ícones */}
        <Text style={styles.sectionTitle}>AÇÕES RÁPIDAS</Text>
        <View style={styles.actionsGrid}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.key}
              style={[styles.actionCard, { backgroundColor: action.bgColor }]}
              activeOpacity={0.7}
              onPress={() => handleQuickAction(action.key)}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: action.bgColor }]}>
                <Ionicons name={action.ionicon} size={22} color={action.iconColor} />
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

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

        {/* Medicamentos em uso — tags com ícone */}
        {patient.medicamentosEmUso && patient.medicamentosEmUso.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>MEDICAMENTOS EM USO</Text>
            <View style={styles.tagRow}>
              {patient.medicamentosEmUso.map((m, i) => (
                <View key={i} style={styles.medTag}>
                  <Ionicons name="bandage-outline" size={14} color="#2E7D32" />
                  <Text style={styles.medTagText}>{m}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Dados pessoais & contato — card unificado */}
        <Text style={styles.sectionTitle}>DADOS PESSOAIS & CONTATO</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <View style={styles.statusBadge}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[patient.status] }]} />
              <Text style={[styles.statusText, { color: STATUS_COLORS[patient.status] }]}>
                {STATUS_LABELS[patient.status]}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Emergência</Text>
            <Text style={styles.infoValue}>{patient.contatoEmergencia.telefone}</Text>
          </View>

          {patient.observacoes ? (
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <Text style={styles.infoLabel}>Observações</Text>
              <Text style={styles.infoValueWrap}>{patient.observacoes}</Text>
            </View>
          ) : null}
        </View>

        {/* Exportar relatório */}
        <TouchableOpacity
          style={styles.exportBtn}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('ExportReport', { patientId: patient.id })}
        >
          <Text style={styles.exportBtnText}>Exportar Relatório PDF</Text>
        </TouchableOpacity>

        {/* Sinais vitais ranges */}
        <Text style={styles.sectionTitle}>FAIXAS DE SINAIS VITAIS</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>PA Sistólica</Text>
            <Text style={styles.infoValue}>
              {patient.faixaSinaisVitais.paSistolicaMin}–{patient.faixaSinaisVitais.paSistolicaMax} mmHg
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>PA Diastólica</Text>
            <Text style={styles.infoValue}>
              {patient.faixaSinaisVitais.paDiastolicaMin}–{patient.faixaSinaisVitais.paDiastolicaMax} mmHg
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>FC</Text>
            <Text style={styles.infoValue}>
              {patient.faixaSinaisVitais.fcMin}–{patient.faixaSinaisVitais.fcMax} bpm
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Temp.</Text>
            <Text style={styles.infoValue}>
              {patient.faixaSinaisVitais.tempMin}–{patient.faixaSinaisVitais.tempMax} °C
            </Text>
          </View>
          <View style={[styles.infoRow, styles.infoRowLast]}>
            <Text style={styles.infoLabel}>SpO₂ mín.</Text>
            <Text style={styles.infoValue}>{patient.faixaSinaisVitais.satO2Min}%</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

// ════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: spacing.lg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorMsg: { fontSize: fontSize.lg, color: colors.textSecondary },
  backLink: { marginTop: spacing.md },
  backLinkText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '500' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.xs, marginBottom: spacing.md },
  backBtnText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '500' },

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
    backgroundColor: colors.primary + '1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.primary },
  patientInfo: { flex: 1 },
  patientName: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary },
  patientMeta: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: 2 },

  // Alert section (alergias) — card amarelo
  alertSection: {
    backgroundColor: '#FFF8E1',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  alertIconCircle: { fontSize: 16 },
  alertTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: '#E65100',
    letterSpacing: 0.8,
  },
  alertTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  alertTag: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: '#FF9800',
  },
  alertTagText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.white },

  // Section title (UPPERCASE)
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },

  // Quick actions — grid 3x2
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  actionCard: {
    width: '31%',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: { fontSize: fontSize.xs, fontWeight: '500', color: colors.textPrimary },

  // Tags
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.border,
  },
  tagText: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '500' },

  // Med tags — com ícone
  medTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: '#E8F5E9',
    gap: spacing.xs,
  },
  medTagIcon: { fontSize: 14 },
  medTagText: { fontSize: fontSize.sm, color: '#2E7D32', fontWeight: '500' },

  // Export button
  exportBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  exportBtnText: { fontSize: fontSize.md, fontWeight: '700', color: colors.white },

  // Info card unificado
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
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
  infoValue: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '600', textAlign: 'right' },
  infoValueWrap: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '500', flex: 2, textAlign: 'right' },

  // Status badge inline
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: fontSize.sm, fontWeight: '700' },
});
