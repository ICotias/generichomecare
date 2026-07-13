import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { colors, spacing, fontSize } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import { usePatientWithActiveShift } from '../../../core/hooks/usePatientWithActiveShift';
import { useSaveRecord } from '../../../core/hooks/useSaveRecord';
import type { IncidentRecord } from '../../../core/types';

import { ModalHeader } from '../../../shared/components/ui/ModalHeader';
import { InsetGroupedSection } from '../../../shared/components/ui/InsetGroupedSection';
import { InsetRow } from '../../../shared/components/ui/InsetRow';
import { SelectionListModal, type SelectionItem } from '../../../shared/components/ui/SelectionListModal';
import { SegmentedControl } from '../../../shared/components/ui/SegmentedControl';

const TIPO_OPTIONS: { value: IncidentRecord['tipoIncidente']; label: string }[] = [
  { value: 'queda', label: 'Queda' },
  { value: 'erro_medicacao', label: 'Erro Med' },
  { value: 'agitacao', label: 'Agitação' },
  { value: 'dispneia', label: 'Dispneia' },
  { value: 'febre', label: 'Febre' },
  { value: 'outro', label: 'Outro' },
];

const TIPO_SELECTION_ITEMS: SelectionItem[] = TIPO_OPTIONS.map((opt) => ({
  id: opt.value,
  label: opt.label,
}));

const GRAVIDADE_OPTIONS = [
  { key: 'leve', label: 'Leve' },
  { key: 'moderado', label: 'Moderado' },
  { key: 'grave', label: 'Grave' },
];

export const RegisterIncidentScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { isSubmitting, save } = useSaveRecord('RegisterIncident error');

  const { selectedPatient } = usePatientWithActiveShift(user?.empresaId, user?.uid);
  const [showTipoModal, setShowTipoModal] = useState(false);

  const [tipoIncidente, setTipoIncidente] = useState<IncidentRecord['tipoIncidente'] | ''>('');
  const [gravidade, setGravidade] = useState<IncidentRecord['gravidade'] | ''>('');
  const [descricao, setDescricao] = useState('');
  const [medidasTomadas, setMedidasTomadas] = useState('');
  const [notificouFamilia, setNotificouFamilia] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const descRef = useRef<TextInput>(null);
  const medidasRef = useRef<TextInput>(null);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!selectedPatient) e.paciente = 'Selecione o paciente';
    if (!tipoIncidente) e.tipoIncidente = 'Selecione o tipo';
    if (!gravidade) e.gravidade = 'Selecione a gravidade';
    if (!descricao.trim()) e.descricao = 'Descreva a intercorrência';
    setErrors(e);
    if (Object.keys(e).length > 0) {
      Alert.alert(e.paciente ? 'Sem paciente' : 'Campos obrigatórios',
        e.paciente ? 'Inicie um plantão antes de registrar.' : 'Preencha todos os campos antes de salvar.');
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    Keyboard.dismiss();
    if (!validate()) return;

    save({
      pacienteId: selectedPatient!.id,
      successMessage: `Intercorrência registrada para ${selectedPatient!.nome}.`,
      build: () => ({
        type: 'intercorrencia',
        pacienteId: selectedPatient!.id,
        empresaId: user!.empresaId,
        profissionalId: user!.uid,
        profissionalNome: user!.nome,
        tipoIncidente: tipoIncidente as IncidentRecord['tipoIncidente'],
        gravidade: gravidade as IncidentRecord['gravidade'],
        descricao: descricao.trim(),
        ...(medidasTomadas.trim() ? { medidasTomadas: medidasTomadas.trim() } : {}),
        notificouFamilia,
      }),
    });
  };

  const selectedTipoLabel = TIPO_OPTIONS.find((o) => o.value === tipoIncidente)?.label;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={[styles.root, { paddingTop: insets.top }]}>
          <ModalHeader
            title="Intercorrência"
            onCancel={() => navigation.goBack()}
            onDone={handleSubmit}
            doneLabel="Salvar"
            doneDisabled={isSubmitting}
            isLoading={isSubmitting}
            accentColor={colors.primary}
          />

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* Tipo */}
            <InsetGroupedSection header="TIPO">
              <InsetRow
                label="Tipo"
                value={selectedTipoLabel}
                placeholder="Selecione"
                onPress={() => setShowTipoModal(true)}
                chevron
                last
              />
            </InsetGroupedSection>
            {errors.tipoIncidente ? <Text style={styles.errorText}>{errors.tipoIncidente}</Text> : null}

            {/* Gravidade */}
            <InsetGroupedSection header="GRAVIDADE">
              <View style={styles.segmentContainer}>
                <SegmentedControl
                  options={GRAVIDADE_OPTIONS}
                  selectedKey={gravidade}
                  onSelect={(key) => {
                    setGravidade(key as IncidentRecord['gravidade']);
                    setErrors((p) => ({ ...p, gravidade: '' }));
                  }}
                  accentColor={colors.primary}
                />
              </View>
            </InsetGroupedSection>
            {errors.gravidade ? <Text style={styles.errorText}>{errors.gravidade}</Text> : null}

            {/* Descrição + Medidas */}
            <InsetGroupedSection header="DETALHES">
              <View style={styles.textInputRow}>
                <Text style={styles.textInputLabel}>Descrição</Text>
                <TextInput
                  ref={descRef}
                  value={descricao}
                  onChangeText={(t) => {
                    setDescricao(t);
                    setErrors((p) => ({ ...p, descricao: '' }));
                  }}
                  placeholder="O que aconteceu..."
                  placeholderTextColor={colors.textMuted}
                  style={styles.textInput}
                  multiline
                  textAlignVertical="top"
                  editable={!isSubmitting}
                  returnKeyType="next"
                  onSubmitEditing={() => medidasRef.current?.focus()}
                />
              </View>
              <View style={styles.hairline} />
              <View style={styles.textInputRow}>
                <Text style={styles.textInputLabel}>Medidas Tomadas</Text>
                <TextInput
                  ref={medidasRef}
                  value={medidasTomadas}
                  onChangeText={setMedidasTomadas}
                  placeholder="(Opcional)"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.textInput, styles.textInputShort]}
                  multiline
                  textAlignVertical="top"
                  editable={!isSubmitting}
                />
              </View>
            </InsetGroupedSection>
            {errors.descricao ? <Text style={styles.errorText}>{errors.descricao}</Text> : null}

            {/* Notificou Família */}
            <InsetGroupedSection>
              <InsetRow
                label="Notificou Família"
                last
                rightContent={
                  <Switch
                    value={notificouFamilia}
                    onValueChange={setNotificouFamilia}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    disabled={isSubmitting}
                  />
                }
              />
            </InsetGroupedSection>
          </ScrollView>

          {/* Tipo Selection Modal */}
          <SelectionListModal
            visible={showTipoModal}
            title="Tipo de Intercorrência"
            items={TIPO_SELECTION_ITEMS}
            selectedId={tipoIncidente || null}
            onSelect={(item) => {
              setTipoIncidente(item.id as IncidentRecord['tipoIncidente']);
              setErrors((prev) => ({ ...prev, tipoIncidente: '' }));
            }}
            onClose={() => setShowTipoModal(false)}
            accentColor={colors.primary}
          />
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.xs,
    marginTop: -spacing.md,
    marginBottom: spacing.md,
    marginLeft: spacing.md,
  },
  segmentContainer: {
    padding: spacing.md,
  },
  textInputRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  textInputLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  textInput: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    minHeight: 100,
    paddingTop: 0,
  },
  textInputShort: {
    minHeight: 60,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.md,
  },
});
