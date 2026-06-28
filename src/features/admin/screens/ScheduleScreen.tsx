import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { collection, getDocs, query, where } from 'firebase/firestore';

import { db } from '../../../core/config/firebase';
import { Collections } from '../../../shared/constants/firestore';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as scheduleService from '../../../core/services/scheduleService';
import * as patientService from '../../../core/services/patientService';
import { ModalHeader } from '../../../shared/components/ui/ModalHeader';
import { InsetGroupedSection } from '../../../shared/components/ui/InsetGroupedSection';
import { InsetRow } from '../../../shared/components/ui/InsetRow';
import { SelectionListModal } from '../../../shared/components/ui/SelectionListModal';
import type { SelectionItem } from '../../../shared/components/ui/SelectionListModal';

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

// Fallback de demonstração — usado APENAS em __DEV__ (vazio em produção).
const MOCK_SCHEDULE: ScheduleEntry[] = __DEV__ ? [
  { id: 'm1', profissionalNome: 'Ana Paula', pacienteNome: 'Maria Souza', horaInicio: '07:00', horaFim: '13:00', turno: 'manha' },
  { id: 'm2', profissionalNome: 'Bruno Santos', pacienteNome: 'Maria Souza', horaInicio: '19:00', horaFim: '07:00', turno: 'noite' },
  { id: 'm3', profissionalNome: 'Ana Paula', pacienteNome: 'João Silva', horaInicio: '07:00', horaFim: '13:00', turno: 'manha' },
  { id: 'm4', profissionalNome: 'Carla Oliveira', pacienteNome: 'Antônia Ferreira', horaInicio: '13:00', horaFim: '19:00', turno: 'tarde' },
] : [];

const getTurno = (horaInicio: string): 'manha' | 'tarde' | 'noite' => {
  const hour = parseInt(horaInicio.split(':')[0], 10);
  if (hour < 12) return 'manha';
  if (hour < 18) return 'tarde';
  return 'noite';
};

const formatTimeFromDate = (d: Date): string => {
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
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
    return d === 0 ? 1 : d;
  });

  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [usingMock, setUsingMock] = useState(false);

  // Selectable lists
  const [profissionais, setProfissionais] = useState<SelectionItem[]>([]);
  const [pacientes, setPacientes] = useState<SelectionItem[]>([]);

  useEffect(() => {
    if (!user?.empresaId) return;

    const profQ = query(
      collection(db, Collections.USUARIOS),
      where('empresaId', '==', user.empresaId),
      where('role', '==', 'nurse')
    );
    getDocs(profQ)
      .then((snap) => {
        setProfissionais(snap.docs.map((d) => ({ id: d.id, label: d.data().nome ?? '' })));
      })
      .catch((err) => console.warn('Erro ao carregar profissionais:', err));

    patientService
      .listPatients(user.empresaId)
      .then((list) => setPacientes(list.map((p) => ({ id: p.id, label: p.nome }))))
      .catch((err) => console.warn('Erro ao carregar pacientes:', err));
  }, [user?.empresaId]);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedProfId, setSelectedProfId] = useState<string | null>(null);
  const [selectedPacId, setSelectedPacId] = useState<string | null>(null);
  const [horaInicio, setHoraInicio] = useState(() => { const d = new Date(); d.setHours(7, 0, 0, 0); return d; });
  const [horaFim, setHoraFim] = useState(() => { const d = new Date(); d.setHours(13, 0, 0, 0); return d; });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Picker expansion state
  const [showInicioPicker, setShowInicioPicker] = useState(false);
  const [showFimPicker, setShowFimPicker] = useState(false);

  // Selection modals
  const [showProfList, setShowProfList] = useState(false);
  const [showPacList, setShowPacList] = useState(false);

  const selectedProf = profissionais.find((p) => p.id === selectedProfId);
  const selectedPac = pacientes.find((p) => p.id === selectedPacId);

  const canSubmit = selectedProfId != null && selectedPacId != null;

  const resetForm = () => {
    setSelectedProfId(null);
    setSelectedPacId(null);
    const ini = new Date(); ini.setHours(7, 0, 0, 0);
    const fim = new Date(); fim.setHours(13, 0, 0, 0);
    setHoraInicio(ini);
    setHoraFim(fim);
    setShowInicioPicker(false);
    setShowFimPicker(false);
  };

  const handleCreateSchedule = async () => {
    if (!canSubmit || !selectedProf || !selectedPac) {
      Alert.alert('Campos obrigatórios', 'Selecione o profissional e o paciente.');
      return;
    }

    if (!user?.empresaId) {
      Alert.alert('Erro', 'Empresa não configurada.');
      return;
    }

    setIsSubmitting(true);
    try {
      await scheduleService.createSchedule(user.empresaId, {
        profissionalId: selectedProf.id,
        profissionalNome: selectedProf.label,
        pacienteId: selectedPac.id,
        pacienteNome: selectedPac.label,
        diaSemana: selectedDay as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        horaInicio: formatTimeFromDate(horaInicio),
        horaFim: formatTimeFromDate(horaFim),
      });
      Alert.alert('Escala criada', `${selectedProf.label} → ${selectedPac.label}`, [
        { text: 'OK', onPress: () => { setShowCreateModal(false); resetForm(); loadSchedules(selectedDay); } },
      ]);
    } catch (err) {
      console.error('Erro ao criar escala:', err);
      Alert.alert('Erro', 'Não foi possível criar a escala. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backRow}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
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

      {usingMock && __DEV__ && (
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
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.admin} />
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

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowCreateModal(true)} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color={colors.white} />
      </TouchableOpacity>

      {/* ═══ Create Schedule Modal (Apple HIG) ═══ */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + spacing.md }]}>
            <View style={styles.grabber} />

            <ModalHeader
              title="Nova Escala"
              onCancel={() => { setShowCreateModal(false); resetForm(); }}
              onDone={handleCreateSchedule}
              doneLabel="Salvar"
              doneDisabled={!canSubmit}
              isLoading={isSubmitting}
              accentColor={colors.admin}
            />

            <ScrollView
              contentContainerStyle={styles.modalBody}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <InsetGroupedSection>
                <InsetRow
                  label="Profissional"
                  value={selectedProf?.label}
                  placeholder="Selecionar"
                  chevron
                  onPress={() => setShowProfList(true)}
                />
                <InsetRow
                  label="Paciente"
                  value={selectedPac?.label}
                  placeholder="Selecionar"
                  chevron
                  onPress={() => setShowPacList(true)}
                  last
                />
              </InsetGroupedSection>

              <InsetGroupedSection header="Horário">
                <InsetRow
                  label="Início"
                  value={formatTimeFromDate(horaInicio)}
                  valueColor={colors.admin}
                  onPress={() => { setShowInicioPicker(!showInicioPicker); setShowFimPicker(false); }}
                />
                {showInicioPicker && (
                  <View style={styles.pickerContainer}>
                    <DateTimePicker
                      value={horaInicio}
                      mode="time"
                      display="spinner"
                      minuteInterval={5}
                      onChange={(_: any, d: Date | undefined) => { if (d) setHoraInicio(d); }}
                      locale="pt-BR"
                    />
                  </View>
                )}
                <InsetRow
                  label="Fim"
                  value={formatTimeFromDate(horaFim)}
                  valueColor={colors.admin}
                  onPress={() => { setShowFimPicker(!showFimPicker); setShowInicioPicker(false); }}
                  last
                />
                {showFimPicker && (
                  <View style={styles.pickerContainer}>
                    <DateTimePicker
                      value={horaFim}
                      mode="time"
                      display="spinner"
                      minuteInterval={5}
                      onChange={(_: any, d: Date | undefined) => { if (d) setHoraFim(d); }}
                      locale="pt-BR"
                    />
                  </View>
                )}
              </InsetGroupedSection>

              <InsetGroupedSection>
                <InsetRow
                  label="Dia"
                  value={WEEKDAYS[selectedDay]}
                  last
                />
              </InsetGroupedSection>
            </ScrollView>

            {/* Selection modals — inside parent Modal to avoid nested-modal iOS bug */}
            <SelectionListModal
              visible={showProfList}
              title="Profissional"
              items={profissionais}
              selectedId={selectedProfId}
              onSelect={(item) => setSelectedProfId(item.id)}
              onClose={() => setShowProfList(false)}
              accentColor={colors.admin}
            />

            <SelectionListModal
              visible={showPacList}
              title="Paciente"
              items={pacientes}
              selectedId={selectedPacId}
              onSelect={(item) => setSelectedPacId(item.id)}
              onClose={() => setShowPacList(false)}
              accentColor={colors.admin}
            />
          </View>
        </View>
      </Modal>
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

  weekRow: { flexDirection: 'row', paddingHorizontal: spacing.sm, paddingVertical: spacing.md, gap: 2 },
  dayCell: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: borderRadius.md },
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

  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.admin,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },

  // Modal — Apple-style bottom sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  modalBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  pickerContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
