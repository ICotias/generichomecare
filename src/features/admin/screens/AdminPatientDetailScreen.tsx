import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as patientService from '../../../core/services/patientService';
import * as adminUserService from '../../../core/services/adminUserService';
import * as registroService from '../../../core/services/registroService';
import type { FamilyMember } from '../../../core/services/adminUserService';
import type { Patient, VitalSignsRange } from '../../../core/types';
import type { CareRecord } from '../../../core/types/records';
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

// ── Histórico de registros: ícone/cor/resumo por tipo ──
const RECORD_TYPE_CONFIG: Record<
  string,
  { icon: React.ComponentProps<typeof Ionicons>['name']; color: string; bg: string }
> = {
  medicamento: { icon: 'bandage-outline', color: '#7C3AED', bg: '#F3F0FF' },
  sinaisVitais: { icon: 'heart-outline', color: '#EF4444', bg: '#FEF2F2' },
  alimentacao: { icon: 'restaurant-outline', color: '#F59E0B', bg: '#FFFBEB' },
  atividade: { icon: 'pulse-outline', color: '#10B981', bg: '#F0FDF4' },
  intercorrencia: { icon: 'alert-circle-outline', color: '#DC2626', bg: '#FEF2F2' },
  foto: { icon: 'camera-outline', color: '#64748B', bg: '#F1F5F9' },
};

const DEFAULT_RECORD_CONFIG = { icon: 'document-text-outline' as const, color: colors.textMuted, bg: colors.border };

const getRecordSummary = (rec: CareRecord): string => {
  switch (rec.type) {
    case 'medicamento':
      return `${rec.medicamento} — ${rec.dosagem}${rec.recusado ? ' (recusado)' : ''}`;
    case 'sinaisVitais':
      return `PA ${rec.paSistolica}/${rec.paDiastolica} · FC ${rec.fc} · SpO₂ ${rec.satO2}%`;
    case 'alimentacao':
      return `Alimentação — ${rec.aceitacao}%`;
    case 'atividade':
      return rec.categoria;
    case 'intercorrencia':
      return `${rec.tipoIncidente} — ${rec.gravidade}`;
    case 'foto':
      return rec.fotoClinica ? 'Foto clínica' : 'Foto';
    default:
      return 'Registro';
  }
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
  const [isEditingVitals, setIsEditingVitals] = useState(false);
  const [editedRanges, setEditedRanges] = useState<VitalSignsRange | null>(null);
  const [isSavingVitals, setIsSavingVitals] = useState(false);
  const [linkedFamily, setLinkedFamily] = useState<FamilyMember[]>([]);
  const [records, setRecords] = useState<CareRecord[]>([]);

  const load = useCallback(async () => {
    if (!user?.empresaId || !patientId) return;
    setIsLoading(true);
    try {
      const [p, family, recs] = await Promise.all([
        patientService.getPatient(user.empresaId, patientId),
        adminUserService.listFamilyByPatient(user.empresaId, patientId),
        registroService.listRecords(user.empresaId, patientId, { limitCount: 30 }),
      ]);
      setPatient(p);
      setLinkedFamily(family);
      setRecords(recs);
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

  const handleEditVitals = () => {
    if (!patient) return;
    setEditedRanges({ ...patient.faixaSinaisVitais });
    setIsEditingVitals(true);
  };

  const handleSaveVitals = async () => {
    if (!user?.empresaId || !patientId || !editedRanges) return;
    setIsSavingVitals(true);
    try {
      await patientService.updatePatient(user.empresaId, patientId, {
        faixaSinaisVitais: editedRanges,
      } as any);
      setPatient((prev) => (prev ? { ...prev, faixaSinaisVitais: editedRanges } : prev));
      setIsEditingVitals(false);
      Alert.alert('Atualizado', 'Faixas de sinais vitais atualizadas com sucesso.');
    } catch (err) {
      Alert.alert('Erro', 'Não foi possível atualizar as faixas.');
      console.error('vitals update error', err);
    } finally {
      setIsSavingVitals(false);
    }
  };

  const handleUnlinkFamily = (member: FamilyMember) => {
    Alert.alert(
      'Desvincular familiar',
      `Deseja desvincular ${member.nome} deste paciente?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: async () => {
            try {
              await adminUserService.unlinkFamily(member.uid);
              setLinkedFamily((prev) => prev.filter((f) => f.uid !== member.uid));
              Alert.alert('Desvinculado', `${member.nome} foi desvinculado com sucesso.`);
            } catch (err) {
              Alert.alert('Erro', 'Não foi possível desvincular o familiar.');
              console.error('unlink family error', err);
            }
          },
        },
      ]
    );
  };

  const updateRange = (key: keyof VitalSignsRange, value: string) => {
    if (!editedRanges) return;
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setEditedRanges((prev) => prev ? { ...prev, [key]: num } : prev);
    }
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

        {patient.cadastroCompleto === false && (
          <View style={styles.pendingBanner}>
            <Ionicons name="time-outline" size={18} color={colors.warning} />
            <Text style={styles.pendingBannerText}>
              Cadastro pendente — aguardando a família completar os dados clínicos.
            </Text>
          </View>
        )}

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

        {/* Familiares vinculados */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Familiares vinculados</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('LinkFamily', { patientId })}
              activeOpacity={0.7}
              hitSlop={8}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.family} />
            </TouchableOpacity>
          </View>
          <View style={styles.sectionCard}>
            {linkedFamily.length === 0 ? (
              <Text style={styles.emptyTag}>Nenhum familiar vinculado</Text>
            ) : (
              linkedFamily.map((member, idx) => (
                <View
                  key={member.uid}
                  style={[styles.familyRow, idx < linkedFamily.length - 1 && styles.familyRowBorder]}
                >
                  <View style={styles.familyInfo}>
                    <Text style={styles.familyName}>{member.nome}</Text>
                    <Text style={styles.familyMeta}>
                      {member.parentesco ?? 'Familiar'} · {member.email}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleUnlinkFamily(member)}
                    activeOpacity={0.7}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </View>

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

        {/* Histórico de registros */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Histórico de registros</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('ExportReport', { patientId })}
              activeOpacity={0.7}
              hitSlop={8}
            >
              <Text style={styles.exportLink}>Exportar PDF</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.sectionCard}>
            {records.length === 0 ? (
              <Text style={styles.emptyTag}>Nenhum registro ainda</Text>
            ) : (
              records.map((rec, idx) => {
                const cfg = RECORD_TYPE_CONFIG[rec.type] ?? DEFAULT_RECORD_CONFIG;
                return (
                  <View
                    key={rec.id}
                    style={[styles.recordRow, idx < records.length - 1 && styles.familyRowBorder]}
                  >
                    <View style={[styles.recordIcon, { backgroundColor: cfg.bg }]}>
                      <Ionicons name={cfg.icon} size={16} color={cfg.color} />
                    </View>
                    <View style={styles.recordInfo}>
                      <Text style={styles.recordTitle}>{getRecordSummary(rec)}</Text>
                      <Text style={styles.recordMeta}>
                        {format(rec.timestamp, "dd/MM · HH:mm", { locale: ptBR })} · {rec.profissionalNome}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* Sinais vitais ranges */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Faixas de sinais vitais</Text>
            {!isEditingVitals && (
              <TouchableOpacity onPress={handleEditVitals} activeOpacity={0.7} hitSlop={8}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.sectionCard}>
            {isEditingVitals && editedRanges ? (
              <>
                <EditableVitalRow label="PA Sist." minKey="paSistolicaMin" maxKey="paSistolicaMax" unit="mmHg" ranges={editedRanges} onChange={updateRange} />
                <EditableVitalRow label="PA Diast." minKey="paDiastolicaMin" maxKey="paDiastolicaMax" unit="mmHg" ranges={editedRanges} onChange={updateRange} />
                <EditableVitalRow label="FC" minKey="fcMin" maxKey="fcMax" unit="bpm" ranges={editedRanges} onChange={updateRange} />
                <EditableVitalRow label="FR" minKey="frMin" maxKey="frMax" unit="irpm" ranges={editedRanges} onChange={updateRange} />
                <EditableVitalRow label="Temp." minKey="tempMin" maxKey="tempMax" unit="°C" ranges={editedRanges} onChange={updateRange} />
                <EditableVitalRow label="SpO₂ mín." minKey="satO2Min" unit="%" ranges={editedRanges} onChange={updateRange} />
                <View style={styles.vitalActions}>
                  <TouchableOpacity
                    style={styles.vitalCancelBtn}
                    onPress={() => setIsEditingVitals(false)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.vitalCancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.vitalSaveBtn, isSavingVitals && { opacity: 0.5 }]}
                    onPress={handleSaveVitals}
                    activeOpacity={0.8}
                    disabled={isSavingVitals}
                  >
                    {isSavingVitals ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.vitalSaveText}>Salvar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <InfoRow label="PA Sistólica" value={`${patient.faixaSinaisVitais.paSistolicaMin}–${patient.faixaSinaisVitais.paSistolicaMax} mmHg`} />
                <InfoRow label="PA Diastólica" value={`${patient.faixaSinaisVitais.paDiastolicaMin}–${patient.faixaSinaisVitais.paDiastolicaMax} mmHg`} />
                <InfoRow label="FC" value={`${patient.faixaSinaisVitais.fcMin}–${patient.faixaSinaisVitais.fcMax} bpm`} />
                <InfoRow label="FR" value={`${patient.faixaSinaisVitais.frMin}–${patient.faixaSinaisVitais.frMax} irpm`} />
                <InfoRow label="Temperatura" value={`${patient.faixaSinaisVitais.tempMin}–${patient.faixaSinaisVitais.tempMax} °C`} />
                <InfoRow label="SpO₂ mínima" value={`${patient.faixaSinaisVitais.satO2Min}%`} />
              </>
            )}
          </View>
        </View>

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
// Sub-components
// ════════════════════════════════════════════

const EditableVitalRow = ({
  label,
  minKey,
  maxKey,
  unit,
  ranges,
  onChange,
}: {
  label: string;
  minKey: keyof VitalSignsRange;
  maxKey?: keyof VitalSignsRange;
  unit: string;
  ranges: VitalSignsRange;
  onChange: (key: keyof VitalSignsRange, value: string) => void;
}) => (
  <View style={styles.editVitalRow}>
    <Text style={styles.editVitalLabel}>{label}</Text>
    <View style={styles.editVitalInputs}>
      <TextInput
        style={styles.editVitalInput}
        value={String(ranges[minKey])}
        onChangeText={(v) => onChange(minKey, v)}
        keyboardType="decimal-pad"
        selectTextOnFocus
      />
      {maxKey && (
        <>
          <Text style={styles.editVitalDash}>–</Text>
          <TextInput
            style={styles.editVitalInput}
            value={String(ranges[maxKey])}
            onChangeText={(v) => onChange(maxKey, v)}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
        </>
      )}
      <Text style={styles.editVitalUnit}>{unit}</Text>
    </View>
  </View>
);

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
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.warning + '1A',
  },
  pendingBannerText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 18,
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

  // Family rows
  familyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
  },
  familyRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  familyInfo: {
    flex: 1,
  },
  familyName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  familyMeta: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Histórico de registros
  exportLink: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
  },
  recordIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
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

  // Vitals section header
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  // Editable vital rows
  editVitalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  editVitalLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  editVitalInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editVitalInput: {
    width: 52,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.xs,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  editVitalDash: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  editVitalUnit: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginLeft: 2,
    minWidth: 30,
  },

  // Vital action buttons
  vitalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  vitalCancelBtn: {
    flex: 1,
    height: 40,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vitalCancelText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  vitalSaveBtn: {
    flex: 1,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vitalSaveText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.white,
  },
});
