import { useState, useCallback, useEffect } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import type { RouteProp } from '@react-navigation/native';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as patientService from '../../../core/services/patientService';
import * as registroService from '../../../core/services/registroService';
import { MOCK_PATIENTS } from '../../../core/mocks/patients';
import { buildReportHtml } from '../../../shared/services/reportHtmlBuilder';
import type { Patient, CareRecord, RecordType } from '../../../core/types';

// ════════════════════════════════════════════
// Dynamic imports (may not be installed yet)
// ════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-explicit-any */
let RNHTMLtoPDF: any = null;
let Share: any = null;
try {
  RNHTMLtoPDF = require('react-native-html-to-pdf');
} catch {
  // not installed
}
try {
  Share = require('react-native-share');
} catch {
  // not installed
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ════════════════════════════════════════════
// Types
// ════════════════════════════════════════════

type ScreenParams = { patientId?: string };
type RouteType = RouteProp<{ ExportReport: ScreenParams }, 'ExportReport'>;

// ════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════

const PERIOD_OPTIONS = [
  { value: 7, label: '7 dias' },
  { value: 14, label: '14 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '3 meses' },
] as const;

type PeriodValue = (typeof PERIOD_OPTIONS)[number]['value'];

const RECORD_TYPES: { value: RecordType; label: string; color: string }[] = [
  { value: 'medicamento', label: 'Medicamentos', color: '#8B5CF6' },
  { value: 'sinaisVitais', label: 'Sinais Vitais', color: '#EF4444' },
  { value: 'alimentacao', label: 'Alimentação', color: '#F59E0B' },
  { value: 'atividade', label: 'Atividades', color: '#10B981' },
  { value: 'intercorrencia', label: 'Intercorrências', color: '#DC2626' },
  { value: 'foto', label: 'Fotos', color: '#3B82F6' },
];

// ════════════════════════════════════════════
// Component
// ════════════════════════════════════════════

export const ExportReportScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteType>();
  const { user } = useAuthStore();

  // State
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(
    route.params?.patientId ?? null
  );
  const [period, setPeriod] = useState<PeriodValue>(7);
  const [selectedTypes, setSelectedTypes] = useState<Set<RecordType>>(
    new Set(RECORD_TYPES.map((t) => t.value))
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load patients
  useEffect(() => {
    if (!user?.empresaId) return;
    patientService
      .listPatients(user.empresaId)
      .then((list) => setPatients(list.length > 0 ? list : MOCK_PATIENTS))
      .catch(() => setPatients(MOCK_PATIENTS))
      .finally(() => setIsLoading(false));
  }, [user?.empresaId]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  // Toggle record type
  const toggleType = useCallback((type: RecordType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type); // Keep at least one
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // Select all / deselect all
  const toggleAll = useCallback(() => {
    setSelectedTypes((prev) => {
      if (prev.size === RECORD_TYPES.length) {
        return new Set([RECORD_TYPES[0].value]); // Keep at least one
      }
      return new Set(RECORD_TYPES.map((t) => t.value));
    });
  }, []);

  // Generate PDF
  const handleGenerate = useCallback(async () => {
    if (!RNHTMLtoPDF) {
      Alert.alert(
        'Pacote não instalado',
        'Instale react-native-html-to-pdf:\n\nyarn add react-native-html-to-pdf\nnpx pod-install'
      );
      return;
    }

    if (!selectedPatient || !user?.empresaId) {
      Alert.alert('Selecione um paciente', 'Escolha o paciente para gerar o relatório.');
      return;
    }

    setIsGenerating(true);

    try {
      // Compute date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);

      // Fetch all records (will filter by type in-memory)
      const allRecords = await registroService.listRecords(user.empresaId, selectedPatient.id, {
        limitCount: 500,
      });

      // Filter by date range and selected types
      const filtered = allRecords.filter(
        (r: CareRecord) =>
          selectedTypes.has(r.type) &&
          r.timestamp >= startDate &&
          r.timestamp <= endDate
      );

      // Sort by timestamp ascending for report
      filtered.sort((a: CareRecord, b: CareRecord) => a.timestamp.getTime() - b.timestamp.getTime());

      // Build HTML
      const html = buildReportHtml({
        patient: selectedPatient,
        records: filtered,
        startDate,
        endDate,
      });

      // Generate PDF
      const fileName = `Relatorio_${selectedPatient.nome.replace(/\s+/g, '_')}_${period}dias`;
      const result = await RNHTMLtoPDF.default.convert({
        html,
        fileName,
        directory: 'Documents',
        base64: false,
      });

      if (!result?.filePath) {
        Alert.alert('Erro', 'Não foi possível gerar o PDF.');
        return;
      }

      // Share
      if (Share) {
        await Share.default.open({
          url: Platform.OS === 'android' ? `file://${result.filePath}` : result.filePath,
          type: 'application/pdf',
          title: `Relatório — ${selectedPatient.nome}`,
        });
      } else {
        Alert.alert('PDF gerado', `Salvo em: ${result.filePath}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      if (!msg.includes('User did not share')) {
        Alert.alert('Erro ao gerar PDF', msg);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [selectedPatient, user?.empresaId, period, selectedTypes]);

  // ════════════════════════════════════════════

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backBtnText}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Exportar Relatório</Text>
        <View style={styles.separator} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Patient selector */}
          <Text style={styles.sectionLabel}>PACIENTE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.patientScroll}>
            <View style={styles.chipRow}>
              {patients.filter((p) => p.status === 'ativo').map((p) => {
                const active = selectedPatientId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.patientChip, active && styles.patientChipActive]}
                    onPress={() => setSelectedPatientId(p.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.patientAvatar, active && styles.patientAvatarActive]}>
                      <Text style={[styles.patientInitial, active && styles.patientInitialActive]}>
                        {p.nome.charAt(0)}
                      </Text>
                    </View>
                    <Text style={[styles.patientChipText, active && styles.patientChipTextActive]} numberOfLines={1}>
                      {p.nome.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Period */}
          <Text style={styles.sectionLabel}>PERÍODO</Text>
          <View style={styles.chipRow}>
            {PERIOD_OPTIONS.map((opt) => {
              const active = period === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setPeriod(opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Record types */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel}>TIPOS DE REGISTRO</Text>
            <TouchableOpacity onPress={toggleAll} activeOpacity={0.7}>
              <Text style={styles.toggleAll}>
                {selectedTypes.size === RECORD_TYPES.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chipRowWrap}>
            {RECORD_TYPES.map((rt) => {
              const active = selectedTypes.has(rt.value);
              return (
                <TouchableOpacity
                  key={rt.value}
                  style={[
                    styles.typeChip,
                    { borderColor: active ? rt.color : colors.border },
                    active && { backgroundColor: rt.color + '1A' },
                  ]}
                  onPress={() => toggleType(rt.value)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[styles.typeDot, { backgroundColor: active ? rt.color : colors.border }]}
                  />
                  <Text
                    style={[
                      styles.typeChipText,
                      active && styles.typeChipTextActive,
                      active && { color: rt.color },
                    ]}
                  >
                    {rt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Preview summary */}
          {selectedPatient && (
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Resumo</Text>
              <Text style={styles.previewText}>
                Paciente: <Text style={styles.previewBold}>{selectedPatient.nome}</Text>
              </Text>
              <Text style={styles.previewText}>
                Período: <Text style={styles.previewBold}>Últimos {period} dias</Text>
              </Text>
              <Text style={styles.previewText}>
                Tipos: <Text style={styles.previewBold}>{selectedTypes.size} selecionado(s)</Text>
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* Generate button — fixed bottom */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity
          style={[styles.generateBtn, (!selectedPatient || isGenerating) && styles.generateBtnDisabled]}
          onPress={handleGenerate}
          activeOpacity={0.8}
          disabled={!selectedPatient || isGenerating}
        >
          {isGenerating ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.generateBtnText}>Gerar PDF</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  backBtnText: { fontSize: fontSize.lg, color: colors.primary, fontWeight: '600' },
  title: { fontSize: fontSize.title, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.35 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: spacing.md },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  // Section label
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  toggleAll: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '600' },

  // Patient chips
  patientScroll: { marginBottom: spacing.sm },
  patientChip: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    width: 80,
  },
  patientChipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '0D' },
  patientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  patientAvatarActive: { backgroundColor: colors.primary },
  patientInitial: { fontSize: fontSize.md, fontWeight: '700', color: colors.textSecondary },
  patientInitialActive: { color: colors.white },
  patientChipText: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '500' },
  patientChipTextActive: { color: colors.primary, fontWeight: '700' },

  // Generic chips
  chipRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, fontWeight: '500', color: colors.textPrimary },
  chipTextActive: { color: colors.white },

  // Type chips
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
  },
  typeDot: { width: 8, height: 8, borderRadius: 4 },
  typeChipText: { fontSize: fontSize.sm, fontWeight: '500', color: colors.textPrimary },
  typeChipTextActive: { fontWeight: '600' },

  // Preview
  previewCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  previewTitle: { fontSize: fontSize.sm, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  previewText: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: 4 },
  previewBold: { fontWeight: '600', color: colors.textPrimary },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  generateBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  generateBtnDisabled: { opacity: 0.5 },
  generateBtnText: { fontSize: fontSize.md, fontWeight: '700', color: colors.white },
});
