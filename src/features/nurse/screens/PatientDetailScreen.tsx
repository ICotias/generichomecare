import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as patientService from '../../../core/services/patientService';
import * as registroService from '../../../core/services/registroService';
import type { Patient } from '../../../core/types';
import type { CareRecord } from '../../../core/types/records';
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

const GUIDE_SECTIONS = [
  { type: 'medicamento' as const, title: 'MEDICAMENTOS', emptyMsg: 'Nenhum medicamento registrado anteriormente' },
  { type: 'sinaisVitais' as const, title: 'SINAIS VITAIS', emptyMsg: 'Nenhuma medição anterior' },
  { type: 'alimentacao' as const, title: 'ALIMENTAÇÃO', emptyMsg: 'Nenhum registro de alimentação' },
  { type: 'atividade' as const, title: 'ATIVIDADES', emptyMsg: 'Nenhuma atividade registrada' },
  { type: 'intercorrencia' as const, title: 'INTERCORRÊNCIAS', emptyMsg: 'Nenhuma intercorrência registrada' },
  { type: 'foto' as const, title: 'FOTOS CLÍNICAS', emptyMsg: 'Nenhuma foto registrada' },
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

const RECORD_TYPE_CONFIG: Record<string, { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; bg: string; label: string }> = {
  medicamento: { icon: 'bandage-outline', color: '#7C3AED', bg: '#F3F0FF', label: 'Medicamento' },
  sinaisVitais: { icon: 'heart-outline', color: '#EF4444', bg: '#FEF2F2', label: 'Sinais Vitais' },
  alimentacao: { icon: 'restaurant-outline', color: '#F59E0B', bg: '#FFFBEB', label: 'Alimentação' },
  atividade: { icon: 'pulse-outline', color: '#10B981', bg: '#F0FDF4', label: 'Atividade' },
  intercorrencia: { icon: 'alert-circle-outline', color: '#DC2626', bg: '#FEF2F2', label: 'Intercorrência' },
  foto: { icon: 'camera-outline', color: '#64748B', bg: '#F1F5F9', label: 'Foto' },
};

const REFEICAO_LABELS: Record<string, string> = {
  cafe: 'Café', cafe_manha: 'Café da manhã', lanche_manha: 'Lanche manhã',
  almoco: 'Almoço', lanche_tarde: 'Lanche tarde', lanche: 'Lanche',
  jantar: 'Jantar', ceia: 'Ceia', outro: 'Outro',
};

const ATIVIDADE_LABELS: Record<string, string> = {
  banho: 'Banho', higiene_oral: 'Higiene oral', troca_fralda: 'Troca de fralda',
  curativo: 'Curativo', reposicionamento: 'Reposicionamento', mobilidade: 'Mobilidade',
  fisioterapia: 'Fisioterapia', outro: 'Outro',
};

const getRecordSummary = (rec: CareRecord): string => {
  switch (rec.type) {
    case 'medicamento':
      return `${rec.medicamento} — ${rec.dosagem}${rec.recusado ? ' (recusado)' : ''}`;
    case 'sinaisVitais':
      return `PA ${rec.paSistolica}/${rec.paDiastolica} · FC ${rec.fc} · SpO₂ ${rec.satO2}%`;
    case 'alimentacao':
      return `${REFEICAO_LABELS[rec.tipoRefeicao] ?? rec.tipoRefeicao} — ${rec.aceitacao}%`;
    case 'atividade':
      return ATIVIDADE_LABELS[rec.categoria] ?? rec.categoria;
    case 'intercorrencia':
      return `${rec.tipoIncidente} — ${rec.gravidade}`;
    case 'foto':
      return rec.fotoClinica ? 'Foto clínica' : 'Foto';
    default:
      return RECORD_TYPE_CONFIG[(rec as any).type]?.label ?? 'Registro';
  }
};

export const PatientDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const { user } = useAuthStore();

  const patientId = route.params?.patientId;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [recordsByType, setRecordsByType] = useState<Record<string, CareRecord[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [photoModal, setPhotoModal] = useState<{ url: string; label: string } | null>(null);

  const load = useCallback(async () => {
    if (!user?.empresaId || !patientId) return;
    setIsLoading(true);
    try {
      const [p, allRecords] = await Promise.all([
        patientService.getPatient(user.empresaId, patientId),
        registroService.listRecords(user.empresaId, patientId, { limitCount: 50 }),
      ]);
      setPatient(p);
      const grouped: Record<string, CareRecord[]> = {};
      GUIDE_SECTIONS.forEach((s) => {
        grouped[s.type] = allRecords.filter((r) => r.type === s.type).slice(0, 5);
      });
      setRecordsByType(grouped);
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

        {/* Guia do Paciente — informações fixas definidas pela família */}
        <Text style={styles.guideTitle}>Guia do Paciente</Text>
        <Text style={styles.guideSubtitle}>Informações fixas definidas pela família</Text>

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

        {/* Histórico recente — últimos registros por categoria */}
        <Text style={styles.guideTitle}>Histórico recente</Text>
        <Text style={styles.guideSubtitle}>Últimos registros dos plantões</Text>

        {GUIDE_SECTIONS.every((s) => (recordsByType[s.type] ?? []).length === 0) && (
          <View style={styles.emptyGuideCard}>
            <Ionicons name="document-text-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyGuideTitle}>Nenhum registro ainda</Text>
            <Text style={styles.emptyGuideMsg}>
              Os registros feitos durante os plantões aparecerão aqui como histórico recente.
            </Text>
          </View>
        )}

        {GUIDE_SECTIONS.filter((s) => (recordsByType[s.type] ?? []).length > 0).map((section) => {
          const records = recordsByType[section.type] ?? [];
          const config = RECORD_TYPE_CONFIG[section.type];
          return (
            <View key={section.type} style={styles.guideSection}>
              <View style={styles.guideSectionHeader}>
                <View style={[styles.guideSectionIcon, { backgroundColor: config.bg }]}>
                  <Ionicons name={config.icon} size={16} color={config.color} />
                </View>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
              <View style={styles.infoCard}>
                {records.map((rec, idx) => {
                  const isPhoto = rec.type === 'foto';
                  const Wrapper = isPhoto ? TouchableOpacity : View;
                  const wrapperProps = isPhoto
                    ? { activeOpacity: 0.7, onPress: () => setPhotoModal({ url: (rec as any).imageUrl, label: getRecordSummary(rec) }) }
                    : {};
                  return (
                    <Wrapper
                      key={rec.id}
                      style={[
                        styles.recordRow,
                        idx === records.length - 1 && styles.infoRowLast,
                      ]}
                      {...wrapperProps}
                    >
                      {isPhoto && (rec as any).imageUrl ? (
                        <Image
                          source={{ uri: (rec as any).imageUrl }}
                          style={styles.photoThumb}
                        />
                      ) : null}
                      <View style={styles.recordInfo}>
                        <Text style={styles.recordTitle}>{getRecordSummary(rec)}</Text>
                        <Text style={styles.recordMeta}>
                          {format(rec.timestamp, "dd/MM · HH:mm", { locale: ptBR })} · {rec.profissionalNome}
                        </Text>
                      </View>
                      {isPhoto && (
                        <Ionicons name="expand-outline" size={18} color={colors.textMuted} />
                      )}
                    </Wrapper>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Photo viewer modal */}
      <Modal
        visible={!!photoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoModal(null)}
      >
        <View style={styles.photoModalOverlay}>
          <TouchableOpacity
            style={styles.photoModalClose}
            onPress={() => setPhotoModal(null)}
            activeOpacity={0.7}
          >
            <View style={styles.photoModalCloseCircle}>
              <Ionicons name="close" size={22} color={colors.white} />
            </View>
          </TouchableOpacity>
          {photoModal && (
            <>
              <Image
                source={{ uri: photoModal.url }}
                style={styles.photoModalImage}
                resizeMode="contain"
              />
              <Text style={styles.photoModalLabel}>{photoModal.label}</Text>
            </>
          )}
        </View>
      </Modal>
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

  // Guide
  guideTitle: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  guideSubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  guideSection: {
    marginBottom: spacing.sm,
  },
  guideSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  guideSectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyGuideCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyGuideTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptyGuideMsg: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
  },

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

  // Recent records
  emptyRecordsText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  recordIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordInfo: {
    flex: 1,
  },
  recordTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  recordMeta: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Photo thumbnail in record row
  photoThumb: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.border,
  },

  // Photo viewer modal
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalClose: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 10,
  },
  photoModalCloseCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalImage: {
    width: Dimensions.get('window').width - 32,
    height: Dimensions.get('window').height * 0.65,
  },
  photoModalLabel: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
