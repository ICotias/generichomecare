/**
 * @deprecated Este arquivo é ÓRFÃO — não está registrado em nenhum navigator.
 * A FamilyTimelineScreen serve como tela principal da família.
 * TODO: Deletar este arquivo (não foi possível remover via sandbox).
 *
 * FamilyHomeScreen — Tela principal do perfil Família.
 *
 * Exibe:
 *   - Saudação + nome do familiar
 *   - Card do paciente vinculado (nome, idade, diagnósticos, tipo atendimento)
 *   - Status do plantão atual (profissional em atendimento ou sem plantão)
 *   - Últimos 5 registros de cuidado (timeline resumida)
 *   - Próximos medicamentos do dia (baseado em registros recentes)
 *
 * Dados vêm do Firestore com MOCK fallback.
 */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as patientService from '../../../core/services/patientService';
import * as registroService from '../../../core/services/registroService';
import type { Patient, CareRecord } from '../../../core/types';
import { MOCK_PATIENTS } from '../../../core/mocks/patients';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../../core/config/firebase';
import { Collections } from '../../../shared/constants/firestore';

// ════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════

const TYPE_META: Record<string, { label: string; ionicon: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
  medicamento: { label: 'Medicamento', ionicon: 'bandage-outline', color: '#7C3AED' },
  sinaisVitais: { label: 'Sinais Vitais', ionicon: 'heart-outline', color: '#EF4444' },
  alimentacao: { label: 'Alimentação', ionicon: 'restaurant-outline', color: '#F59E0B' },
  atividade: { label: 'Atividade', ionicon: 'pulse-outline', color: '#10B981' },
  intercorrencia: { label: 'Intercorrência', ionicon: 'alert-circle-outline', color: '#DC2626' },
  foto: { label: 'Foto', ionicon: 'camera-outline', color: '#64748B' },
};

const formatTime = (date: Date) => {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
};

const formatDate = (date: Date) => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
};

const calcAge = (birth: Date): number => {
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
};

const getRecordSummary = (record: CareRecord): string => {
  switch (record.type) {
    case 'medicamento':
      return `${record.medicamento ?? 'Medicamento'} — ${record.dosagem ?? ''}`;
    case 'sinaisVitais':
      return `PA ${record.paSistolica ?? '-'}/${record.paDiastolica ?? '-'} · FC ${record.fc ?? '-'}`;
    case 'alimentacao':
      return `Aceitação: ${record.aceitacao ?? '-'}%`;
    case 'atividade':
      return record.categoria ?? 'Atividade realizada';
    case 'intercorrencia':
      return `${record.tipoIncidente ?? 'Intercorrência'} — ${record.gravidade ?? ''}`;
    case 'foto':
      return 'Registro fotográfico';
    default:
      return '';
  }
};

// ════════════════════════════════════════════
// Component
// ════════════════════════════════════════════

interface ShiftInfo {
  profissionalNome: string;
  checkinAt: Date;
}

export const FamilyHomeScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, signOut } = useAuthStore();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [records, setRecords] = useState<CareRecord[]>([]);
  const [activeShift, setActiveShift] = useState<ShiftInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Family user has pacienteId in their profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const familyUser = user as any;
  const pacienteId: string | undefined = familyUser?.pacienteId;

  const loadData = useCallback(async () => {
    if (!user?.empresaId) {
      setIsLoading(false);
      return;
    }

    try {
      // 1. Load patient
      let loadedPatient: Patient | null = null;

      if (pacienteId) {
        loadedPatient = await patientService.getPatient(user.empresaId, pacienteId);
      }

      // Fallback to first mock patient if no linked patient
      if (!loadedPatient) {
        loadedPatient = MOCK_PATIENTS[0];
      }
      setPatient(loadedPatient);

      // 2. Load recent records (exclude fotoClinica)
      const targetPacienteId = loadedPatient.id;
      try {
        const allRecords = await registroService.listRecords(
          user.empresaId,
          targetPacienteId,
          { limitCount: 10 }
        );
        // Filter out clinical photos — family can't see them
        const filtered = allRecords.filter(
          (r) => !(r.type === 'foto' && r.fotoClinica === true)
        );
        setRecords(filtered.slice(0, 5));
      } catch {
        setRecords([]);
      }

      // 3. Check active shift for this patient
      try {
        const plantoesRef = collection(db, Collections.plantoes(user.empresaId));
        const q = query(
          plantoesRef,
          where('status', '==', 'em_andamento'),
          where('pacienteId', '==', targetPacienteId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setActiveShift({
            profissionalNome: data.profissionalNome ?? 'Profissional',
            checkinAt: data.checkinAt?.toDate?.() ?? new Date(),
          });
        } else {
          setActiveShift(null);
        }
      } catch {
        setActiveShift(null);
      }
    } catch (error) {
      console.error('FamilyHome load error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.empresaId, pacienteId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.family} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.family}
        />
      }
    >
      {/* Greeting */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{getGreeting()},</Text>
        <Text style={styles.userName}>{user?.nome || 'Familiar'}</Text>
      </View>

      {/* Patient Card */}
      {patient && (
        <TouchableOpacity
          style={styles.patientCard}
          activeOpacity={0.7}
          onPress={() => {
            // Navigate to patient info within family tabs
            const nav = navigation as { navigate: (screen: string) => void };
            nav.navigate('PatientInfoStack');
          }}
        >
          <View style={styles.patientHeader}>
            <View style={styles.patientAvatar}>
              <Text style={styles.patientInitial}>
                {patient.nome.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.patientInfo}>
              <Text style={styles.patientName}>{patient.nome}</Text>
              <Text style={styles.patientAge}>
                {calcAge(patient.dataNascimento)} anos · {patient.genero === 'feminino' ? 'F' : 'M'}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>

          <View style={styles.patientDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Atendimento</Text>
              <View style={styles.detailBadge}>
                <Text style={styles.detailBadgeText}>{patient.tipoAtendimento}</Text>
              </View>
            </View>
            {patient.diagnosticos.length > 0 && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Diagnósticos</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {patient.diagnosticos.join(', ')}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      )}

      {/* Active Shift Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PLANTÃO ATUAL</Text>
        {activeShift ? (
          <View style={styles.shiftCard}>
            <View style={styles.shiftDot} />
            <View style={styles.shiftInfo}>
              <Text style={styles.shiftProfissional}>{activeShift.profissionalNome}</Text>
              <Text style={styles.shiftTime}>
                Em atendimento desde {formatTime(activeShift.checkinAt)}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.noShiftCard}>
            <Text style={styles.noShiftText}>Nenhum profissional em atendimento no momento</Text>
          </View>
        )}
      </View>

      {/* Recent Records */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ÚLTIMOS REGISTROS</Text>
          <TouchableOpacity
            onPress={() => {
              const nav = navigation as { navigate: (screen: string) => void };
              nav.navigate('HistoryStack');
            }}
            hitSlop={8}
          >
            <Text style={styles.seeAll}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        {records.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Nenhum registro recente</Text>
          </View>
        ) : (
          records.map((record) => {
            const meta = TYPE_META[record.type] ?? { label: record.type, ionicon: 'document-outline' as const, color: colors.textMuted };
            return (
              <View key={record.id} style={styles.recordCard}>
                <View style={[styles.recordIcon, { backgroundColor: meta.color + '1A' }]}>
                  <Ionicons name={meta.ionicon} size={18} color={meta.color} />
                </View>
                <View style={styles.recordContent}>
                  <View style={styles.recordTop}>
                    <Text style={styles.recordType}>{meta.label}</Text>
                    <Text style={styles.recordTime}>
                      {formatDate(record.timestamp)} · {formatTime(record.timestamp)}
                    </Text>
                  </View>
                  <Text style={styles.recordSummary} numberOfLines={1}>
                    {getRecordSummary(record)}
                  </Text>
                  {record.profissionalNome && (
                    <Text style={styles.recordProfissional}>
                      por {record.profissionalNome}
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={signOut} activeOpacity={0.8}>
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  greeting: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  userName: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.family,
    letterSpacing: -0.5,
    marginTop: -2,
  },

  // Patient Card
  patientCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.family + '1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  patientInitial: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.family,
  },
  patientInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  patientName: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  patientAge: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    color: colors.textMuted,
    fontWeight: '300',
  },
  patientDetails: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.xs + 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  detailBadge: {
    backgroundColor: colors.family + '1A',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  detailBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.family,
    textTransform: 'capitalize',
  },

  // Sections
  section: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  seeAll: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.family,
    marginBottom: spacing.sm,
  },

  // Shift
  shiftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  shiftDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#16A34A',
  },
  shiftInfo: { flex: 1 },
  shiftProfissional: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#166534',
  },
  shiftTime: {
    fontSize: fontSize.sm,
    color: '#15803D',
    marginTop: 2,
  },
  noShiftCard: {
    backgroundColor: '#F1F5F9',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  noShiftText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // Records
  recordCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  recordIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordIconText: { fontSize: 18 },
  recordContent: { flex: 1 },
  recordTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordType: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  recordTime: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  recordSummary: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  recordProfissional: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Empty
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  // Logout
  logoutButton: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  logoutText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.error,
  },
});
