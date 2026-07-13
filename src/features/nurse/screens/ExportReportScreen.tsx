import { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

import { colors, spacing } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as patientService from '../../../core/services/patientService';
import * as registroService from '../../../core/services/registroService';
import { MOCK_PATIENTS } from '../../../core/mocks/patients';
import { buildReportHtml } from '../../../shared/services/reportHtmlBuilder';
import type { Patient, CareRecord, RecordType } from '../../../core/types';

import { ModalHeader } from '../../../shared/components/ui/ModalHeader';
import { InsetGroupedSection } from '../../../shared/components/ui/InsetGroupedSection';
import { InsetRow } from '../../../shared/components/ui/InsetRow';
import { SelectionListModal, type SelectionItem } from '../../../shared/components/ui/SelectionListModal';
import { SegmentedControl } from '../../../shared/components/ui/SegmentedControl';

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

const PERIOD_SEGMENTS = [
  { key: '7', label: '7 dias' },
  { key: '14', label: '14 dias' },
  { key: '30', label: '30 dias' },
  { key: '90', label: '3 meses' },
];

const RECORD_TYPES: { value: RecordType; label: string; icon: string }[] = [
  { value: 'medicamento', label: 'Medicamentos', icon: 'medkit-outline' },
  { value: 'sinaisVitais', label: 'Sinais Vitais', icon: 'heart-outline' },
  { value: 'alimentacao', label: 'Alimentação', icon: 'restaurant-outline' },
  { value: 'atividade', label: 'Atividades', icon: 'walk-outline' },
  { value: 'intercorrencia', label: 'Intercorrências', icon: 'warning-outline' },
  { value: 'foto', label: 'Fotos', icon: 'camera-outline' },
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
  const [period, setPeriod] = useState('7');
  const [selectedTypes, setSelectedTypes] = useState<Set<RecordType>>(
    new Set(RECORD_TYPES.map((t) => t.value))
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showPatientPicker, setShowPatientPicker] = useState(false);

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

  // Patient items for SelectionListModal
  const patientItems: SelectionItem[] = patients
    .filter((p) => p.status === 'ativo')
    .map((p) => ({ id: p.id, label: p.nome }));

  // Toggle record type
  const toggleType = useCallback((type: RecordType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
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
      const periodDays = parseInt(period, 10);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

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
      const fileName = `Relatorio_${selectedPatient.nome.replace(/\s+/g, '_')}_${periodDays}dias`;
      const result = await RNHTMLtoPDF.generatePDF({
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
        const shareModule = Share.default ?? Share;
        await shareModule.open({
          url: Platform.OS === 'android' ? `file://${result.filePath}` : result.filePath,
          type: 'application/pdf',
          title: `Relatório de ${selectedPatient.nome}`,
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

  const periodLabel = PERIOD_SEGMENTS.find((s) => s.key === period)?.label ?? '';

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top }}>
        <ModalHeader
          title="Exportar Relatório"
          onCancel={() => navigation.goBack()}
          onDone={handleGenerate}
          doneLabel="Gerar"
          doneDisabled={!selectedPatient || isGenerating}
          isLoading={isGenerating}
          accentColor={colors.primary}
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Paciente — drill-down row */}
          <InsetGroupedSection header="PACIENTE">
            <InsetRow
              label="Paciente"
              value={selectedPatient?.nome}
              placeholder="Selecione"
              chevron
              onPress={() => setShowPatientPicker(true)}
              last
            />
          </InsetGroupedSection>

          {/* Período — segmented control */}
          <InsetGroupedSection header="PERÍODO">
            <View style={styles.segmentWrapper}>
              <SegmentedControl
                options={PERIOD_SEGMENTS}
                selectedKey={period}
                onSelect={setPeriod}
              />
            </View>
          </InsetGroupedSection>

          {/* Tipos de registro — switches */}
          <InsetGroupedSection header="TIPOS DE REGISTRO">
            {RECORD_TYPES.map((rt, idx) => (
              <InsetRow
                key={rt.value}
                label={rt.label}
                last={idx === RECORD_TYPES.length - 1}
                rightContent={
                  <Switch
                    value={selectedTypes.has(rt.value)}
                    onValueChange={() => toggleType(rt.value)}
                    trackColor={{ false: colors.border, true: colors.primary }}
                  />
                }
              />
            ))}
          </InsetGroupedSection>

          {/* Resumo */}
          {selectedPatient && (
            <InsetGroupedSection header="RESUMO">
              <InsetRow label="Paciente" value={selectedPatient.nome} />
              <InsetRow label="Período" value={`Últimos ${periodLabel}`} />
              <InsetRow label="Tipos" value={`${selectedTypes.size} selecionado(s)`} last />
            </InsetGroupedSection>
          )}
        </ScrollView>
      )}

      {/* Selection modal */}
      <SelectionListModal
        visible={showPatientPicker}
        title="Paciente"
        items={patientItems}
        selectedId={selectedPatientId}
        onSelect={(item) => {
          setSelectedPatientId(item.id);
        }}
        onClose={() => setShowPatientPicker(false)}
      />
    </View>
  );
};

// ════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  segmentWrapper: {
    padding: spacing.md,
  },
});
