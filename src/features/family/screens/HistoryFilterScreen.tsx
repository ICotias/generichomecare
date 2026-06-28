import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import { useFamilyPatientId } from '../../../core/hooks/useFamilyPatientId';
import * as registroService from '../../../core/services/registroService';
import type { CareRecord, RecordType } from '../../../core/types';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '../../../shared/components/EmptyState';
import { PatientPickerBar } from '../../../shared/components/PatientPickerBar';

const FILTER_OPTIONS: { value: RecordType | 'todos'; label: string; icon?: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'medicamento', label: 'Med', icon: 'medkit-outline' },
  { value: 'sinaisVitais', label: 'Vitais', icon: 'heart-outline' },
  { value: 'alimentacao', label: 'Alim', icon: 'restaurant-outline' },
  { value: 'atividade', label: 'Ativ', icon: 'walk-outline' },
  { value: 'intercorrencia', label: 'Inter', icon: 'warning-outline' },
];

const TYPE_LABELS: Record<string, string> = {
  medicamento: 'Medicamento',
  sinaisVitais: 'Sinais Vitais',
  alimentacao: 'Alimentação',
  atividade: 'Atividade',
  intercorrencia: 'Intercorrência',
  foto: 'Foto',
};

const formatDate = (date: Date) =>
  date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

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

export const HistoryFilterScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const {
    pacienteId,
    isSimulating,
    patients: simPatients,
    isLoadingPatients,
    selectPatient,
  } = useFamilyPatientId();

  const [records, setRecords] = useState<CareRecord[]>([]);
  const [filter, setFilter] = useState<RecordType | 'todos'>('todos');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!user?.empresaId || !pacienteId) {
        setIsLoading(false);
        return;
      }
      if (!silent) setIsLoading(true);

      try {
        const typeFilter = filter === 'todos' ? undefined : filter;
        const recs = await registroService.listRecords(user.empresaId, pacienteId, {
          type: typeFilter,
          limitCount: 50,
          visibleToFamilyOnly: true,
        });
        // Hide clinical photos from family
        setRecords(recs.filter((r) => !(r.type === 'foto' && r.fotoClinica)));
      } catch (err) {
        console.error('HistoryFilter load error', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user?.empresaId, pacienteId, filter]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const renderRecord = ({ item }: { item: CareRecord }) => {
    const summary = getRecordSummary(item);
    return (
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardType}>{TYPE_LABELS[item.type] ?? item.type}</Text>
          <Text style={styles.cardDate}>
            {formatDate(item.timestamp)} · {formatTime(item.timestamp)}
          </Text>
        </View>
        {summary ? (
          <Text style={styles.cardSummary} numberOfLines={2}>{summary}</Text>
        ) : null}
        <Text style={styles.cardNurse}>Por {item.profissionalNome}</Text>
        {item.observacoes ? (
          <Text style={styles.cardObs} numberOfLines={2}>{item.observacoes}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + (isSimulating ? 0 : spacing.lg) }]}>
      {/* Patient picker (simulação admin) */}
      {isSimulating && (
        <PatientPickerBar
          patients={simPatients}
          selectedId={pacienteId}
          onSelect={selectPatient}
          isLoading={isLoadingPatients}
        />
      )}

      <View style={[styles.header, isSimulating && { marginTop: spacing.md }]}>
        <Text style={styles.title}>Histórico</Text>
        <Text style={styles.subtitle}>Navegue por tipo de registro</Text>
      </View>

      {/* Filter chips */}
      <View style={styles.filterWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_OPTIONS.map((opt) => {
          const active = filter === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(opt.value)}
              activeOpacity={0.7}
            >
              {opt.icon && (
                <Ionicons
                  name={opt.icon}
                  size={14}
                  color={active ? colors.white : colors.textPrimary}
                />
              )}
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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
          title="Sem registros"
          subtitle={filter === 'todos'
            ? 'Ainda não há registros para este paciente.'
            : `Nenhum registro do tipo "${TYPE_LABELS[filter]}" encontrado.`}
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
              onRefresh={() => { setIsRefreshing(true); load(true); }}
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
  title: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.35,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // Filter
  filterWrap: {
    height: 64,
    marginBottom: spacing.md,
  },
  filterScroll: {
    flexGrow: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    height: 40,
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.family,
    borderColor: colors.family,
  },
  filterText: { fontSize: fontSize.xs, fontWeight: '500', color: colors.textPrimary },
  filterTextActive: { color: colors.white },

  // List
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardType: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textPrimary },
  cardDate: { fontSize: fontSize.xs, color: colors.textMuted },
  cardSummary: { fontSize: fontSize.sm, color: colors.textPrimary, lineHeight: 18 },
  cardNurse: { fontSize: fontSize.xs, color: colors.textSecondary },
  cardObs: { fontSize: fontSize.sm, color: colors.textSecondary, fontStyle: 'italic', lineHeight: 18 },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
