import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as scheduleService from '../../../core/services/scheduleService';

// ════════════════════════════════════════════
// Types & constants
// ════════════════════════════════════════════

interface ScheduleEntry {
  id: string;
  profissionalNome: string;
  pacienteNome: string;
  horaInicio: string;
  horaFim: string;
  turno: 'manha' | 'tarde' | 'noite';
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const TURNO_LABELS = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
const TURNO_COLORS = { manha: '#F59E0B', tarde: '#3B82F6', noite: '#6366F1' };

const MOCK_SCHEDULE: ScheduleEntry[] = [
  { id: 'm1', profissionalNome: 'Ana Paula', pacienteNome: 'Maria Souza', horaInicio: '07:00', horaFim: '13:00', turno: 'manha' },
  { id: 'm2', profissionalNome: 'Bruno Santos', pacienteNome: 'Maria Souza', horaInicio: '19:00', horaFim: '07:00', turno: 'noite' },
  { id: 'm3', profissionalNome: 'Ana Paula', pacienteNome: 'João Silva', horaInicio: '07:00', horaFim: '13:00', turno: 'manha' },
  { id: 'm4', profissionalNome: 'Carla Oliveira', pacienteNome: 'Antônia Ferreira', horaInicio: '13:00', horaFim: '19:00', turno: 'tarde' },
];

/**
 * Determine turno from horaInicio string.
 */
const getTurno = (horaInicio: string): 'manha' | 'tarde' | 'noite' => {
  const hour = parseInt(horaInicio.split(':')[0], 10);
  if (hour < 12) return 'manha';
  if (hour < 18) return 'tarde';
  return 'noite';
};

// ════════════════════════════════════════════
// Component
// ════════════════════════════════════════════

export const ScheduleScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date().getDay();
    return d === 0 ? 1 : d; // Default to Monday if Sunday
  });

  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [usingMock, setUsingMock] = useState(false);

  const loadSchedules = useCallback(
    async (day: number) => {
      if (!user?.empresaId) {
        setEntries(MOCK_SCHEDULE);
        setUsingMock(true);
        setIsLoading(false);
        return;
      }

      try {
        const schedules = await scheduleService.listSchedules(user.empresaId, day);
        if (schedules.length > 0) {
          setEntries(
            schedules.map((s) => ({
              id: s.id,
              profissionalNome: s.profissionalNome,
              pacienteNome: s.pacienteNome,
              horaInicio: s.horaInicio,
              horaFim: s.horaFim,
              turno: getTurno(s.horaInicio),
            }))
          );
          setUsingMock(false);
        } else {
          // Fallback to mock
          setEntries(MOCK_SCHEDULE);
          setUsingMock(true);
        }
      } catch {
        setEntries(MOCK_SCHEDULE);
        setUsingMock(true);
      } finally {
        setIsLoading(false);
      }
    },
    [user?.empresaId]
  );

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadSchedules(selectedDay);
    }, [loadSchedules, selectedDay])
  );

  const handleDayChange = (day: number) => {
    setSelectedDay(day);
    setIsLoading(true);
    loadSchedules(day);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadSchedules(selectedDay);
    setIsRefreshing(false);
  };

  // Get dates for current week
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backRow}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backBtn}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Escalas</Text>
        <Text style={styles.subtitle}>Grade semanal de atendimentos</Text>
        <View style={styles.separator} />
      </View>

      {/* Week day selector */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map((label, idx) => {
          const active = selectedDay === idx;
          const date = new Date(startOfWeek);
          date.setDate(startOfWeek.getDate() + idx);
          const isToday = date.toDateString() === today.toDateString();

          return (
            <TouchableOpacity
              key={idx}
              style={[styles.dayCell, active && styles.dayCellActive]}
              onPress={() => handleDayChange(idx)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>{label}</Text>
              <Text style={[styles.dayNum, active && styles.dayNumActive, isToday && !active && styles.dayNumToday]}>
                {date.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {usingMock && (
        <View style={styles.mockBanner}>
          <Text style={styles.mockText}>Dados de exemplo — cadastre escalas reais no Firestore.</Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.admin} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.admin}
            />
          }
        >
          {entries.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum atendimento agendado para este dia.</Text>
          ) : (
            entries.map((entry) => (
              <View key={entry.id} style={styles.entryCard}>
                <View style={[styles.turnoStrip, { backgroundColor: TURNO_COLORS[entry.turno] }]} />
                <View style={styles.entryContent}>
                  <View style={styles.entryTop}>
                    <Text style={styles.entryProfissional}>{entry.profissionalNome}</Text>
                    <View style={[styles.turnoBadge, { backgroundColor: TURNO_COLORS[entry.turno] + '1A' }]}>
                      <Text style={[styles.turnoBadgeText, { color: TURNO_COLORS[entry.turno] }]}>
                        {TURNO_LABELS[entry.turno]}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.entryPaciente}>Paciente: {entry.pacienteNome}</Text>
                  <Text style={styles.entryHorario}>{entry.horaInicio} — {entry.horaFim}</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  backBtn: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  title: { fontSize: fontSize.title, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: spacing.md },

  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Week selector
  weekRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    gap: 2,
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  dayCellActive: { backgroundColor: colors.admin },
  dayLabel: { fontSize: fontSize.xs, fontWeight: '500', color: colors.textMuted },
  dayLabelActive: { color: colors.white },
  dayNum: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary, marginTop: 4 },
  dayNumActive: { color: colors.white },
  dayNumToday: { color: colors.admin },

  mockBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  mockText: { fontSize: fontSize.xs, color: '#92400E', fontWeight: '500' },

  scrollContent: { paddingHorizontal: spacing.lg },
  emptyText: { fontSize: fontSize.md, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xxl },

  entryCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  turnoStrip: { width: 4 },
  entryContent: { flex: 1, padding: spacing.md },
  entryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryProfissional: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  turnoBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.full },
  turnoBadgeText: { fontSize: fontSize.xs, fontWeight: '600' },
  entryPaciente: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  entryHorario: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
});
