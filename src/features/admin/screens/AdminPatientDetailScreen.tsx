import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as patientService from '../../../core/services/patientService';
import type { Patient } from '../../../core/types';
import type { PatientMgmtStackParamList } from '../../../core/navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<PatientMgmtStackParamList, 'AdminPatientDetail'>;
type RoutePropType = RouteProp<PatientMgmtStackParamList, 'AdminPatientDetail'>;

const STATUS_COLORS: Record<Patient['status'], string> = {
  ativo: colors.success,
  inativo: colors.textMuted,
  alta: colors.warning,
};

const STATUS_LABELS: Record<Patient['status'], string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  alta: 'Alta',
};

const TIPO_LABELS: Record<Patient['tipoAtendimento'], string> = {
  integral: '24h (Integral)',
  diurno: 'Diurno',
  noturno: 'Noturno',
  visita: 'Visita',
};

const formatDate = (d: Date): string => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const calcAge = (birth: Date): number => {
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
};

export const AdminPatientDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RoutePropType>();
  const { user } = useAuthStore();

  const patientId = route.params?.patientId;

  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const load = useCallback(async () => {
    if (!user?.empresaId || !patientId) return;
    setIsLoading(true);
    try {
      const p = await patientService.getPatient(user.empresaId, patientId);
      setPatient(p);
    } catch (err) {
      console.error('load patient error', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.empresaId, patientId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleStatusChange = (newStatus: Patient['status']) => {
    if (!user?.empresaId || !patientId || !patient) return;

    Alert.alert(
      'Alterar status',
      `Deseja mudar o status de ${patient.nome} para "${STATUS_LABELS[newStatus]}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            setIsUpdating(true);
            try {
              await patientService.updatePatient(user.empresaId!, patientId!, {
                status: newStatus,
              });
              setPatient((prev) => (prev ? { ...prev, status: newStatus } : prev));
            } catch (err) {
              Alert.alert('Erro', 'Não foi possível atualizar o status.');
              console.error('status update error', err);
            } finally {
              setIsUpdating(false);
            }
          },
        },
      ]
    );
  };

  // ── Info row helper ──
  const InfoRow = ({ label, value }: { label: string; value?: string }) => {
    if (!value) return null;
    return (
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    );
  };

  // ── Section helper ──
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );

  // ── Tag list helper ──
  const TagList = ({ items }: { items: string[] }) => {
    if (!items.length) return <Text style={styles.emptyTag}>Nenhum registrado</Text>;
    return (
      <View style={styles.tagRow}>
        {items.map((item, i) => (
          <View key={i} style={styles.tag}>
            <Text style={styles.tagText}>{item}</Text>
          </View>
        ))}
      </View>
    );
  };

  // ════════════════════════════════════════════
  // Loading / Not found
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

  // ════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════

  const addr = patient.endereco;
  const addressStr = [
    `${addr.rua}, ${addr.numero}`,
    addr.complemento,
    addr.bairro,
    `${addr.cidade} - ${addr.estado}`,
    addr.cep,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={colors.primary} />
            <Text style={styles.backBtnText}>Pacientes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('LinkFamily', { patientId })}
            style={styles.linkBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.linkBtnText}>Vincular família</Text>
          </TouchableOpacity>
        </View>

        {/* Name + status */}
        <Text style={styles.patientName}>{patient.nome}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {calcAge(patient.dataNascimento)} anos · {TIPO_LABELS[patient.tipoAtendimento]}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[patient.status] + '1A' }]}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[patient.status] }]} />
            <Text style={[styles.statusLabel, { color: STATUS_COLORS[patient.status] }]}>
              {STATUS_LABELS[patient.status]}
            </Text>
          </View>
        </View>

        {/* Dados pessoais */}
        <Section title="Dados pessoais">
          <InfoRow label="Nome" value={patient.nome} />
          <InfoRow label="Nascimento" value={formatDate(patient.dataNascimento)} />
          <InfoRow label="CPF" value={patient.cpf} />
          <InfoRow label="Gênero" value={patient.genero.charAt(0).toUpperCase() + patient.genero.slice(1)} />
        </Section>

        {/* Endereço */}
        <Section title="Endereço">
          <Text style={styles.addressText}>{addressStr}</Text>
        </Section>

        {/* Contato de emergência */}
        <Section title="Contato de emergência">
          <InfoRow label="Nome" value={patient.contatoEmergencia.nome} />
          <InfoRow label="Parentesco" value={patient.contatoEmergencia.parentesco} />
          <InfoRow label="Telefone" value={patient.contatoEmergencia.telefone} />
        </Section>

        {/* Dados clínicos */}
        <Section title="Diagnósticos">
          <TagList items={patient.diagnosticos} />
        </Section>

        <Section title="Alergias">
          <TagList items={patient.alergias} />
        </Section>

        {patient.medicamentosEmUso && patient.medicamentosEmUso.length > 0 && (
          <Section title="Medicamentos em uso">
            <TagList items={patient.medicamentosEmUso} />
          </Section>
        )}

        {patient.observacoes ? (
          <Section title="Observações">
            <Text style={styles.obsText}>{patient.observacoes}</Text>
          </Section>
        ) : null}

        {/* Sinais vitais ranges */}
        <Section title="Faixas de sinais vitais">
          <InfoRow
            label="PA Sistólica"
            value={`${patient.faixaSinaisVitais.paSistolicaMin}–${patient.faixaSinaisVitais.paSistolicaMax} mmHg`}
          />
          <InfoRow
            label="PA Diastólica"
            value={`${patient.faixaSinaisVitais.paDiastolicaMin}–${patient.faixaSinaisVitais.paDiastolicaMax} mmHg`}
          />
          <InfoRow
            label="FC"
            value={`${patient.faixaSinaisVitais.fcMin}–${patient.faixaSinaisVitais.fcMax} bpm`}
          />
          <InfoRow
            label="FR"
            value={`${patient.faixaSinaisVitais.frMin}–${patient.faixaSinaisVitais.frMax} irpm`}
          />
          <InfoRow
            label="Temperatura"
            value={`${patient.faixaSinaisVitais.tempMin}–${patient.faixaSinaisVitais.tempMax} °C`}
          />
          <InfoRow label="SpO₂ mínima" value={`${patient.faixaSinaisVitais.satO2Min}%`} />
        </Section>

        {/* Status actions */}
        <View style={styles.statusActions}>
          <Text style={styles.sectionTitle}>Alterar status</Text>
          <View style={styles.statusRow}>
            {(['ativo', 'inativo', 'alta'] as Patient['status'][]).map((s) => {
              const isActive = patient.status === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.statusChip,
                    isActive && { backgroundColor: STATUS_COLORS[s] + '1A', borderColor: STATUS_COLORS[s] },
                  ]}
                  onPress={() => !isActive && handleStatusChange(s)}
                  activeOpacity={isActive ? 1 : 0.7}
                  disabled={isUpdating}
                >
                  {isUpdating && !isActive ? null : (
                    <Text
                      style={[styles.statusChipText, isActive && styles.statusChipTextActive, isActive && { color: STATUS_COLORS[s] }]}
                    >
                      {STATUS_LABELS[s]}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          {isUpdating && <ActivityIndicator style={styles.updatingIndicator} color={colors.primary} />}
        </View>
      </ScrollView>
    </View>
  );
};

// ════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  errorMsg: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
  },
  backLink: {
    marginTop: spacing.md,
  },
  backLinkText: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: '500',
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  backBtnText: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  linkBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.family + '1A',
  },
  linkBtnText: {
    color: colors.family,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },

  // Patient header
  patientName: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.35,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  metaText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },

  // Status badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },

  // Section
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: '500',
    flex: 2,
    textAlign: 'right',
  },

  // Address
  addressText: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 20,
  },

  // Observations
  obsText: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 20,
  },

  // Tags
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.border,
  },
  tagText: {
    fontSize: fontSize.xs,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  emptyTag: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
  },

  // Status actions
  statusActions: {
    marginTop: spacing.xl,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statusChip: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  statusChipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  statusChipTextActive: {
    fontWeight: '600',
  },
  updatingIndicator: {
    marginTop: spacing.sm,
  },
});
