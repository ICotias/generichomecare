import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { LineChart } from 'react-native-chart-kit';

import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import { useFamilyPatientId } from '../../../core/hooks/useFamilyPatientId';
import * as registroService from '../../../core/services/registroService';
import * as patientService from '../../../core/services/patientService';
import type { VitalSignsRecord, CareRecord } from '../../../core/types';
import type { Patient, VitalSignsRange } from '../../../core/types';
import { PatientPickerBar } from '../../../shared/components/PatientPickerBar';

// ════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - spacing.lg * 2;

const PERIOD_OPTIONS = [
  { value: 7, label: '7 dias' },
  { value: 14, label: '14 dias' },
  { value: 30, label: '30 dias' },
] as const;

type PeriodValue = (typeof PERIOD_OPTIONS)[number]['value'];

const formatShortDate = (date: Date) =>
  date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

const isVitals = (r: CareRecord): r is VitalSignsRecord => r.type === 'sinaisVitais';

// ════════════════════════════════════════════
// Component
// ════════════════════════════════════════════

export const VitalsChartScreen = () => {
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

  const [vitals, setVitals] = useState<VitalSignsRecord[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodValue>(7);

  const load = useCallback(async () => {
    if (!user?.empresaId || !pacienteId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [recs, pat] = await Promise.all([
        registroService.listRecords(user.empresaId, pacienteId, {
          type: 'sinaisVitais',
          limitCount: 200,
          visibleToFamilyOnly: true,
        }),
        patientService.getPatient(user.empresaId, pacienteId),
      ]);

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - period);

      const filtered = recs
        .filter(isVitals)
        .filter((r) => r.timestamp >= cutoff)
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      setVitals(filtered);
      setPatient(pat);
    } catch (err) {
      console.error('VitalsChart load error', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.empresaId, pacienteId, period]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const ranges = patient?.faixaSinaisVitais;

  // ── Mock data when no real records ──
  const displayVitals =
    vitals.length > 0
      ? vitals
      : generateMockVitals(period, ranges);

  const labels = displayVitals.map((v) => formatShortDate(v.timestamp));
  // Show max 6 labels to avoid clutter
  const labelInterval = Math.max(1, Math.floor(labels.length / 6));
  const displayLabels = labels.map((l, i) => (i % labelInterval === 0 ? l : ''));

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
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backRow}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backBtn}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Sinais Vitais</Text>
        {patient && <Text style={styles.subtitle}>{patient.nome}</Text>}
      </View>

      {/* Period selector */}
      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((opt) => {
          const active = period === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.periodChip, active && styles.periodChipActive]}
              onPress={() => setPeriod(opt.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.periodText, active && styles.periodTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.family} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
          showsVerticalScrollIndicator={false}
        >
          {vitals.length === 0 && (
            <View style={styles.mockBanner}>
              <Text style={styles.mockText}>
                Dados de exemplo — registros reais aparecerão aqui.
              </Text>
            </View>
          )}

          {/* Pressão Arterial */}
          <ChartCard
            title="Pressão Arterial"
            unit="mmHg"
            datasets={[
              { data: displayVitals.map((v) => v.paSistolica), color: () => '#EF4444', label: 'Sistólica' },
              { data: displayVitals.map((v) => v.paDiastolica), color: () => '#3B82F6', label: 'Diastólica' },
            ]}
            labels={displayLabels}
            ranges={ranges ? {
              min: ranges.paDiastolicaMin,
              max: ranges.paSistolicaMax,
            } : undefined}
          />

          {/* FC */}
          <ChartCard
            title="Frequência Cardíaca"
            unit="bpm"
            datasets={[
              { data: displayVitals.map((v) => v.fc), color: () => '#EF4444', label: 'FC' },
            ]}
            labels={displayLabels}
            ranges={ranges ? { min: ranges.fcMin, max: ranges.fcMax } : undefined}
          />

          {/* Temperatura */}
          <ChartCard
            title="Temperatura"
            unit="°C"
            datasets={[
              { data: displayVitals.map((v) => v.temperatura), color: () => '#F59E0B', label: 'Temp' },
            ]}
            labels={displayLabels}
            ranges={ranges ? { min: ranges.tempMin, max: ranges.tempMax } : undefined}
            decimalPlaces={1}
          />

          {/* SpO₂ */}
          <ChartCard
            title="Saturação O₂"
            unit="%"
            datasets={[
              { data: displayVitals.map((v) => v.satO2), color: () => '#06B6D4', label: 'SpO₂' },
            ]}
            labels={displayLabels}
            ranges={ranges ? { min: ranges.satO2Min, max: 100 } : undefined}
          />

          {/* Last reading summary */}
          {displayVitals.length > 0 && (
            <LastReadingCard reading={displayVitals[displayVitals.length - 1]} />
          )}
        </ScrollView>
      )}
    </View>
  );
};

// ════════════════════════════════════════════
// ChartCard
// ════════════════════════════════════════════

interface DatasetDef {
  data: number[];
  color: (opacity?: number) => string;
  label: string;
}

interface ChartCardProps {
  title: string;
  unit: string;
  datasets: DatasetDef[];
  labels: string[];
  ranges?: { min: number; max: number };
  decimalPlaces?: number;
}

const ChartCard = ({ title, unit, datasets, labels, ranges, decimalPlaces = 0 }: ChartCardProps) => {
  // Get latest value from first dataset
  const lastVal = datasets[0]?.data[datasets[0].data.length - 1];
  const isOutOfRange =
    ranges && lastVal != null ? lastVal < ranges.min || lastVal > ranges.max : false;

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.chartTitle}>{title}</Text>
          <Text style={styles.chartUnit}>{unit}</Text>
        </View>
        {lastVal != null && (
          <View style={[styles.latestBadge, isOutOfRange && styles.latestBadgeAlert]}>
            <Text style={[styles.latestValue, isOutOfRange && styles.latestValueAlert]}>
              {datasets.length === 2
                ? `${datasets[0].data[datasets[0].data.length - 1]}/${datasets[1].data[datasets[1].data.length - 1]}`
                : lastVal.toFixed(decimalPlaces)}
            </Text>
          </View>
        )}
      </View>

      {ranges && (
        <Text style={styles.rangeHint}>
          Faixa normal: {ranges.min}–{ranges.max} {unit}
        </Text>
      )}

      <LineChart
        data={{
          labels,
          datasets: datasets.map((ds) => ({
            data: ds.data.length > 0 ? ds.data : [0],
            color: ds.color,
            strokeWidth: 2,
          })),
        }}
        width={CHART_WIDTH - spacing.md * 2}
        height={180}
        chartConfig={{
          backgroundColor: colors.surface,
          backgroundGradientFrom: colors.surface,
          backgroundGradientTo: colors.surface,
          decimalPlaces,
          color: (opacity = 1) => `rgba(0, 0, 0, ${opacity * 0.3})`,
          labelColor: () => colors.textMuted,
          propsForDots: { r: '3', strokeWidth: '1' },
          propsForBackgroundLines: {
            strokeDasharray: '4,4',
            stroke: colors.border,
          },
        }}
        bezier
        withInnerLines
        withOuterLines={false}
        withVerticalLines={false}
        fromZero={false}
        style={styles.chart}
      />

      {/* Legend */}
      <View style={styles.legendRow}>
        {datasets.map((ds) => (
          <View key={ds.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: ds.color() }]} />
            <Text style={styles.legendText}>{ds.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ════════════════════════════════════════════
// LastReadingCard
// ════════════════════════════════════════════

const LastReadingCard = ({ reading }: { reading: VitalSignsRecord }) => {
  const ts = reading.timestamp;
  const dateStr = ts.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
  const h = ts.getHours().toString().padStart(2, '0');
  const m = ts.getMinutes().toString().padStart(2, '0');

  return (
    <View style={styles.lastCard}>
      <Text style={styles.lastTitle}>Última Aferição</Text>
      <Text style={styles.lastDate}>{dateStr} às {h}:{m}</Text>
      <View style={styles.lastGrid}>
        <VitalBadge label="PA" value={`${reading.paSistolica}/${reading.paDiastolica}`} color="#EF4444" />
        <VitalBadge label="FC" value={`${reading.fc} bpm`} color="#EF4444" />
        <VitalBadge label="Temp" value={`${reading.temperatura}°C`} color="#F59E0B" />
        <VitalBadge label="SpO₂" value={`${reading.satO2}%`} color="#06B6D4" />
        <VitalBadge label="FR" value={`${reading.fr} irpm`} color="#10B981" />
      </View>
      {reading.alerta && (
        <View style={styles.alertBanner}>
          <Text style={styles.alertBannerText}><Ionicons name="warning-outline" size={12} color="#DC2626" /> Alerta ativo nesta leitura</Text>
        </View>
      )}
    </View>
  );
};

const VitalBadge = ({ label, value, color }: { label: string; value: string; color: string }) => (
  <View style={[styles.vitalBadge, { borderColor: color + '33' }]}>
    <Text style={[styles.vitalBadgeLabel, { color }]}>{label}</Text>
    <Text style={styles.vitalBadgeValue}>{value}</Text>
  </View>
);

// ════════════════════════════════════════════
// Mock data generator
// ════════════════════════════════════════════

const generateMockVitals = (days: number, ranges?: VitalSignsRange | null): VitalSignsRecord[] => {
  const result: VitalSignsRecord[] = [];
  const now = new Date();

  for (let i = days; i >= 0; i -= 1) {
    const ts = new Date(now);
    ts.setDate(ts.getDate() - i);
    ts.setHours(8 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60));

    const paSistolica = ranges
      ? randomInRange(ranges.paSistolicaMin, ranges.paSistolicaMax)
      : randomInRange(110, 140);
    const paDiastolica = ranges
      ? randomInRange(ranges.paDiastolicaMin, ranges.paDiastolicaMax)
      : randomInRange(70, 90);

    result.push({
      id: `mock-${i}`,
      pacienteId: '',
      empresaId: '',
      profissionalId: '',
      profissionalNome: 'Enf. Exemplo',
      type: 'sinaisVitais',
      timestamp: ts,
      syncStatus: 'synced',
      paSistolica,
      paDiastolica,
      fc: ranges ? randomInRange(ranges.fcMin, ranges.fcMax) : randomInRange(60, 90),
      fr: ranges ? randomInRange(ranges.frMin, ranges.frMax) : randomInRange(14, 20),
      temperatura: ranges
        ? parseFloat(randomFloatInRange(ranges.tempMin, ranges.tempMax).toFixed(1))
        : parseFloat(randomFloatInRange(36.0, 37.5).toFixed(1)),
      satO2: ranges ? randomInRange(ranges.satO2Min, 100) : randomInRange(94, 99),
      alerta: false,
    });
  }
  return result;
};

const randomInRange = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const randomFloatInRange = (min: number, max: number) =>
  Math.random() * (max - min) + min;

// ════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  backBtn: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },
  title: { fontSize: fontSize.title, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.35 },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: 2 },

  // Period
  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  periodChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodChipActive: { backgroundColor: colors.family, borderColor: colors.family },
  periodText: { fontSize: fontSize.sm, fontWeight: '500', color: colors.textPrimary },
  periodTextActive: { color: colors.white },

  // Scroll
  scrollContent: { paddingHorizontal: spacing.lg },

  // Mock banner
  mockBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  mockText: { fontSize: fontSize.xs, color: '#92400E', fontWeight: '500' },

  // Chart card
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  chartTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  chartUnit: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  rangeHint: { fontSize: fontSize.xs, color: colors.textMuted, marginBottom: spacing.sm },

  latestBadge: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.family + '1A',
  },
  latestBadgeAlert: { backgroundColor: '#FEE2E2' },
  latestValue: { fontSize: fontSize.sm, fontWeight: '700', color: colors.family },
  latestValueAlert: { color: colors.error },

  chart: { marginLeft: -spacing.sm, borderRadius: borderRadius.md },

  legendRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: fontSize.xs, color: colors.textSecondary },

  // Last reading
  lastCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  lastTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  lastDate: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  lastGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  vitalBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    minWidth: 80,
  },
  vitalBadgeLabel: { fontSize: fontSize.xs, fontWeight: '700' },
  vitalBadgeValue: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary, marginTop: 2 },

  alertBanner: {
    marginTop: spacing.sm,
    backgroundColor: '#FEE2E2',
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    alignItems: 'center',
  },
  alertBannerText: { fontSize: fontSize.xs, fontWeight: '600', color: '#DC2626' },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
