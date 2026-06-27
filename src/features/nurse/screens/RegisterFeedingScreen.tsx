import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import { usePatientWithActiveShift } from '../../../core/hooks/usePatientWithActiveShift';
import * as registroService from '../../../core/services/registroService';
import type { Patient } from '../../../core/types';

import { ModalHeader } from '../../../shared/components/ui/ModalHeader';
import { InsetGroupedSection } from '../../../shared/components/ui/InsetGroupedSection';
import { InsetRow } from '../../../shared/components/ui/InsetRow';
import { SelectionListModal, type SelectionItem } from '../../../shared/components/ui/SelectionListModal';
import { SegmentedControl } from '../../../shared/components/ui/SegmentedControl';

// --- Data ---

const REFEICAO_ITEMS: SelectionItem[] = [
  { id: 'cafe_manha', label: 'Café da manhã' },
  { id: 'almoco', label: 'Almoço' },
  { id: 'lanche', label: 'Lanche' },
  { id: 'jantar', label: 'Jantar' },
  { id: 'ceia', label: 'Ceia' },
  { id: 'outro', label: 'Outro' },
];

const ACEITACAO_SEGMENTS = [
  { key: 'total', label: 'Total' },
  { key: 'parcial', label: 'Parcial' },
  { key: 'recusa', label: 'Recusa' },
];

const VIA_SEGMENTS = [
  { key: 'oral', label: 'Oral' },
  { key: 'sonda', label: 'Sonda' },
];

export const RegisterFeedingScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const { patients, selectedPatient, setSelectedPatient } = usePatientWithActiveShift(user?.empresaId, user?.uid);
  const [showRefeicaoModal, setShowRefeicaoModal] = useState(false);

  const [tipoRefeicao, setTipoRefeicao] = useState('');
  const [aceitacao, setAceitacao] = useState('');
  const [via, setVia] = useState('');
  const [volume, setVolume] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const obsRef = useRef<TextInput>(null);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!selectedPatient) e.paciente = 'Selecione o paciente';
    if (!tipoRefeicao) e.tipoRefeicao = 'Selecione o tipo';
    if (!aceitacao) e.aceitacao = 'Selecione a aceitacao';
    if (!via) e.via = 'Selecione a via';
    setErrors(e);
    if (Object.keys(e).length > 0) {
      Alert.alert(e.paciente ? 'Sem paciente' : 'Campos obrigatórios',
        e.paciente ? 'Inicie um plantão antes de registrar.' : 'Preencha todos os campos antes de salvar.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!validate()) return;
    if (!user?.empresaId || !user?.uid) return;

    setIsSubmitting(true);
    try {
      // Map aceitacao to numeric for Firestore compatibility
      const aceitacaoMap: Record<string, number> = { total: 100, parcial: 50, recusa: 0 };

      await registroService.createRecord(user.empresaId, selectedPatient!.id, {
        type: 'alimentacao',
        pacienteId: selectedPatient!.id,
        empresaId: user.empresaId,
        profissionalId: user.uid,
        profissionalNome: user.nome,
        tipoRefeicao,
        aceitacao: aceitacaoMap[aceitacao] ?? 0,
        consistencia: via === 'sonda' ? 'enteral' : 'normal',
        hidratacaoMl: Number(volume) || 0,
        ...(observacoes.trim() ? { observacoes: observacoes.trim() } : {}),
      });

      Alert.alert('Registrado', `Alimentacao registrada para ${selectedPatient!.nome}.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Nao foi possivel salvar o registro.');
      console.error('RegisterFeeding error', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Derived display values ---

  const refeicaoLabel = REFEICAO_ITEMS.find((r) => r.id === tipoRefeicao)?.label;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.root}>
          {/* Apple-style modal header: Cancelar | Title | Salvar */}
          <ModalHeader
            title="Alimentacao"
            onCancel={() => (navigation as any).getParent()?.navigate('NurseHomeStack')}
            onDone={handleSubmit}
            doneLabel="Salvar"
            doneDisabled={isSubmitting}
            isLoading={isSubmitting}
            accentColor={colors.primary}
          />

          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + spacing.xxl },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* Tipo de Refeicao */}
            <InsetGroupedSection header="TIPO DE REFEICAO">
              <InsetRow
                label="Refeicao"
                value={refeicaoLabel}
                placeholder="Selecione"
                onPress={() => setShowRefeicaoModal(true)}
                chevron
                last
              />
            </InsetGroupedSection>
            {errors.tipoRefeicao ? <Text style={styles.errorText}>{errors.tipoRefeicao}</Text> : null}

            {/* Aceitacao — 3 options → SegmentedControl */}
            <InsetGroupedSection header="ACEITACAO">
              <View style={styles.segmentWrapper}>
                <SegmentedControl
                  options={ACEITACAO_SEGMENTS}
                  selectedKey={aceitacao}
                  onSelect={(key) => {
                    setAceitacao(key);
                    setErrors((prev) => ({ ...prev, aceitacao: '' }));
                  }}
                />
              </View>
            </InsetGroupedSection>
            {errors.aceitacao ? <Text style={styles.errorText}>{errors.aceitacao}</Text> : null}

            {/* Via — 2 options → SegmentedControl */}
            <InsetGroupedSection header="VIA">
              <View style={styles.segmentWrapper}>
                <SegmentedControl
                  options={VIA_SEGMENTS}
                  selectedKey={via}
                  onSelect={(key) => {
                    setVia(key);
                    setErrors((prev) => ({ ...prev, via: '' }));
                  }}
                />
              </View>
            </InsetGroupedSection>
            {errors.via ? <Text style={styles.errorText}>{errors.via}</Text> : null}

            {/* Detalhes: Volume + Observacoes */}
            <InsetGroupedSection header="DETALHES">
              <InsetRow
                label="Volume (ml ou %)"
                rightContent={
                  <TextInput
                    value={volume}
                    onChangeText={setVolume}
                    placeholder="—"
                    placeholderTextColor={colors.textMuted}
                    style={styles.inlineInput}
                    keyboardType="numeric"
                    editable={!isSubmitting}
                    returnKeyType="next"
                    onSubmitEditing={() => obsRef.current?.focus()}
                  />
                }
              />
              <InsetRow
                label="Observacoes"
                last
                rightContent={
                  <TextInput
                    ref={obsRef}
                    value={observacoes}
                    onChangeText={setObservacoes}
                    placeholder="—"
                    placeholderTextColor={colors.textMuted}
                    style={styles.inlineInput}
                    editable={!isSubmitting}
                    returnKeyType="done"
                  />
                }
              />
            </InsetGroupedSection>
          </ScrollView>

          {/* Selection modals */}
          <SelectionListModal
            visible={showRefeicaoModal}
            title="Tipo de Refeicao"
            items={REFEICAO_ITEMS}
            selectedId={tipoRefeicao || null}
            onSelect={(item) => {
              setTipoRefeicao(item.id);
              setErrors((prev) => ({ ...prev, tipoRefeicao: '' }));
            }}
            onClose={() => setShowRefeicaoModal(false)}
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
  },
  segmentWrapper: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inlineInput: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    textAlign: 'right',
    minWidth: 100,
    paddingVertical: 0,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.xs,
    marginTop: -spacing.md,
    marginBottom: spacing.md,
    marginLeft: spacing.md,
  },
});
