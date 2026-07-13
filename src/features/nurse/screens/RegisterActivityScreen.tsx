import { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { colors, spacing, fontSize } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import { usePatientWithActiveShift } from '../../../core/hooks/usePatientWithActiveShift';
import { useSaveRecord } from '../../../core/hooks/useSaveRecord';

import { ModalHeader } from '../../../shared/components/ui/ModalHeader';
import { InsetGroupedSection } from '../../../shared/components/ui/InsetGroupedSection';
import { InsetRow } from '../../../shared/components/ui/InsetRow';
import { SelectionListModal, type SelectionItem } from '../../../shared/components/ui/SelectionListModal';
import { SegmentedControl } from '../../../shared/components/ui/SegmentedControl';

const TIPO_OPTIONS: { value: string; label: string }[] = [
  { value: 'banho', label: 'Banho' },
  { value: 'higiene', label: 'Higiene' },
  { value: 'mobilizacao', label: 'Mobilização' },
  { value: 'exercicio', label: 'Exercício' },
  { value: 'lazer', label: 'Lazer' },
  { value: 'outro', label: 'Outro' },
];

const TIPO_SELECTION_ITEMS: SelectionItem[] = TIPO_OPTIONS.map((opt) => ({
  id: opt.value,
  label: opt.label,
}));

const PARTICIPACAO_OPTIONS: { value: string; label: string }[] = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'assistido', label: 'Assistido' },
  { value: 'passivo', label: 'Passivo' },
];

const PARTICIPACAO_SEGMENTS = PARTICIPACAO_OPTIONS.map((opt) => ({
  key: opt.value,
  label: opt.label,
}));

export const RegisterActivityScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { isSubmitting, save } = useSaveRecord('RegisterActivity error');

  const { selectedPatient } = usePatientWithActiveShift(user?.empresaId, user?.uid);

  const [tipo, setTipo] = useState('');
  const [participacao, setParticipacao] = useState('');
  const [duracao, setDuracao] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Modal visibility
  const [showTipoModal, setShowTipoModal] = useState(false);

  const duracaoRef = useRef<TextInput>(null);
  const obsRef = useRef<TextInput>(null);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!selectedPatient) e.paciente = 'Selecione o paciente';
    if (!tipo) e.tipo = 'Selecione o tipo';
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
      successMessage: `Atividade registrada para ${selectedPatient!.nome}.`,
      build: () => ({
        type: 'atividade',
        pacienteId: selectedPatient!.id,
        empresaId: user!.empresaId,
        profissionalId: user!.uid,
        profissionalNome: user!.nome,
        categoria: tipo as 'banho' | 'higiene_oral' | 'mobilidade' | 'fisioterapia' | 'outro',
        ...(participacao ? { participacao } : {}),
        ...(Number(duracao) ? { duracaoMinutos: Number(duracao) } : {}),
        ...(observacoes.trim() ? { observacoes: observacoes.trim() } : {}),
      }),
    });
  };

  // Find selected labels for display
  const tipoLabel = TIPO_OPTIONS.find((o) => o.value === tipo)?.label;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.root}>
          {/* Apple-style modal header: Cancelar / Title / Salvar */}
          <View style={{ paddingTop: insets.top }}>
            <ModalHeader
              title="Atividade"
              onCancel={() => navigation.goBack()}
              onDone={handleSubmit}
              doneLabel="Salvar"
              doneDisabled={isSubmitting}
              isLoading={isSubmitting}
              accentColor={colors.primary}
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* Tipo */}
            <InsetGroupedSection header="TIPO">
              <InsetRow
                label="Tipo"
                value={tipoLabel}
                placeholder="Selecione"
                chevron
                onPress={() => setShowTipoModal(true)}
                valueColor={errors.tipo ? colors.error : undefined}
                last
              />
            </InsetGroupedSection>

            {/* Participação — 3 options, use SegmentedControl */}
            <InsetGroupedSection header="PARTICIPAÇÃO">
              <View style={styles.segmentContainer}>
                <SegmentedControl
                  options={PARTICIPACAO_SEGMENTS}
                  selectedKey={participacao}
                  onSelect={setParticipacao}
                />
              </View>
            </InsetGroupedSection>

            {/* Detalhes */}
            <InsetGroupedSection header="DETALHES">
              <InsetRow
                label="Duração (min)"
                onPress={() => duracaoRef.current?.focus()}
                rightContent={
                  <TextInput
                    ref={duracaoRef}
                    value={duracao}
                    onChangeText={setDuracao}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    style={styles.inlineInput}
                    editable={!isSubmitting}
                    textAlign="right"
                  />
                }
              />
              <InsetRow
                label="Observações"
                onPress={() => obsRef.current?.focus()}
                rightContent={
                  <TextInput
                    ref={obsRef}
                    value={observacoes}
                    onChangeText={setObservacoes}
                    placeholder="Opcional"
                    placeholderTextColor={colors.textMuted}
                    style={styles.inlineInputMultiline}
                    multiline
                    textAlignVertical="top"
                    editable={!isSubmitting}
                    textAlign="right"
                  />
                }
                last
              />
            </InsetGroupedSection>
          </ScrollView>

          {/* Tipo selection modal */}
          <SelectionListModal
            visible={showTipoModal}
            title="Tipo de Atividade"
            items={TIPO_SELECTION_ITEMS}
            selectedId={tipo || null}
            onSelect={(item) => {
              setTipo(item.id);
              setErrors((prev) => ({ ...prev, tipo: '' }));
            }}
            onClose={() => setShowTipoModal(false)}
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
  segmentContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  inlineInput: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    minWidth: 80,
    paddingVertical: 0,
  },
  inlineInputMultiline: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    minWidth: 120,
    maxHeight: 80,
    paddingVertical: 0,
  },
});
