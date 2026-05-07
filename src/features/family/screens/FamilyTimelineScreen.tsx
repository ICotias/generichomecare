import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as registroService from '../../../core/services/registroService';
import * as patientService from '../../../core/services/patientService';
import type { CareRecord, Patient } from '../../../core/types';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '../../../shared/components/EmptyState';

const TYPE_META: Record<string, { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
  medicamento: { label: 'Medicamento', icon: 'medkit-outline', color: '#8B5CF6' },
  sinaisVitais: { label: 'Sinais Vitais', icon: 'heart-outline', color: '#EF4444' },
  alimentacao: { label: 'Alimentação', icon: 'restaurant-outline', color: '#F59E0B' },
  atividade: { label: 'Atividade', icon: 'walk-outline', color: '#10B981' },
  intercorrencia: { label: 'Intercorrência', icon: 'warning-outline', color: '#DC2626' },
  foto: { label: 'Foto', icon: 'camera-outline', color: '#3B82F6' },
};

const formatTime = (date: Date) => {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
};

const getRecordSummary = (record: CareRecord): string => {
  switch (record.type) {
    case 'medicamento':
      return `${record.medicamento} — ${record.dosagem} (${record.via})`;
    case 'sinaisVitais':
      return `PA ${record.paSistolica}/${record.paDiastolica} · FC ${record.fc} · T ${record.temperatura}°C · SpO₂ ${record.satO2}%`;
    case 'alimentacao':
      return `Aceitação: ${record.aceitacao}%${record.hidratacaoMl ? ` · Hidratação: ${record.hidratacaoMl}ml` : ''}`;
    case 'atividade':
      return record.categoria;
    case 'intercorrencia':
      return `${record.tipoIncidente} — ${record.gravidade}`;
    case 'foto':
      return record.fotoClinica ? 'Foto clínica (restrita)' : 'Registro fotográfico';
    default:
      return '';
  }
};

export const FamilyTimelineScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [records, setRecords] = useState<CareRecord[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const familyUser = user as typeof user & { pacienteId?: string };
  const pacienteId = familyUser?.pacienteId;

  const load = useCallback(
    async (silent = false) => {
      if (!user?.empresaId || !pacienteId) {
        setIsLoading(false);
        return;
      }
      if (!silent) setIsLoading(true);

      try {
        const [recs, pat] = await Promise.all([
          registroService.listRecords(user.empresaId, pacienteId, { limitCount: 30 }),
          patientService.getPatient(user.empresaId, pacienteId),
        ]);

        // Filter out clinical photos
        const filtered = recs.filter(
          (r) => !(r.type === 'foto' && r.fotoClinica)
        );
        setRecords(filtered);
        setPatient(pat);
      } catch (err) {
        console.error('FamilyTimeline load error', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user?.empresaId, pacienteId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const firstName = user?.nome?.split(' ')[0] ?? 'Familiar';

  const renderRecord = ({ item }: { item: CareRecord }) => {
    const meta = TYPE_META[item.type] ?? { label: item.type, icon: 'document-text-outline' as const, color: colors.textMuted };
    const summary = getRecordSummary(item);

    return (
      <View style={styles.card}>
        <View style={styles.timeCol}>
          <Text style={styles.timeText}>{formatTime(item.timestamp)}</Text>
          <View style={[styles.timeDot, { backgroundColor: meta.color }]} />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Ionicons name={meta.icon} size={16} color={meta.color} />
            <Text style={styles.cardType}>{meta.label}</Text>
          </View>
          {summary ? (
            <Text style={styles.cardSummary} numberOfLines={2}>{summary}</Text>
          ) : null}
          <Text style={styles.cardNurse}>Por {item.profissionalNome}</Text>
          {item.observacoes ? (
            <Text style={styles.cardObs} numberOfLines={1}>
              Obs: {item.observacoes}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  const todayLabel = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.lg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{getGreeting()},</Text>
        <Text style={styles.name}>{firstName}</Text>
        {patient && (
          <Text style={styles.subtitle}>
            Acompanhando <Text style={styles.subtitleBold}>{patient.nome}</Text>
          </Text>
        )}
        <Text style={styles.today}>{todayLabel}</Text>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.family} />
        </View>
      ) : !pacienteId ? (
        <EmptyState
          title="Paciente não vinculado"
          subtitle="Peça ao administrador para vincular seu perfil a um paciente."
        />
      ) : records.length === 0 ? (
        <EmptyState
          title="Sem registros hoje"
          subtitle="Ainda não há registros para este paciente. Os cuidados aparecerão aqui conforme forem realizados."
        />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          renderItem={renderRecord}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                load(true);
              }}
              tintColor={colors.family}
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  greeting: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.35,
  },
  name: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.family,
    letterSpacing: 0.35,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  subtitleBold: { fontWeight: '700', color: colors.textPrimary },
  today: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textTransform: 'capitalize',
  },

  // List
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Card
  card: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  timeCol: {
    width: 50,
    alignItems: 'center',
    paddingTop: 2,
  },
  timeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  timeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardBody: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardType: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardSummary: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  cardNurse: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  cardObs: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
