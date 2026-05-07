import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as patientService from '../../../core/services/patientService';
import * as registroService from '../../../core/services/registroService';
import type { Patient } from '../../../core/types';
import { MOCK_PATIENTS } from '../../../core/mocks/patients';

const REFEICAO_OPTIONS: { value: string; label: string }[] = [
  { value: 'cafe_manha', label: 'Café da manhã' },
  { value: 'almoco', label: 'Almoço' },
  { value: 'lanche', label: 'Lanche' },
  { value: 'jantar', label: 'Jantar' },
  { value: 'ceia', label: 'Ceia' },
  { value: 'outro', label: 'Outro' },
];

const ACEITACAO_OPTIONS: { value: string; label: string }[] = [
  { value: 'total', label: 'Total' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'recusa', label: 'Recusa' },
];

const VIA_OPTIONS: { value: string; label: string }[] = [
  { value: 'oral', label: 'Oral' },
  { value: 'sonda', label: 'Sonda' },
];

export const RegisterFeedingScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const [tipoRefeicao, setTipoRefeicao] = useState('');
  const [aceitacao, setAceitacao] = useState('');
  const [via, setVia] = useState('');
  const [volume, setVolume] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const obsRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user?.empresaId) return;
      patientService.listPatients(user.empresaId).then((list) => setPatients(list.length > 0 ? list : MOCK_PATIENTS)).catch(console.error);
    }, [user?.empresaId])
  );

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!selectedPatient) e.paciente = 'Selecione o paciente';
    if (!tipoRefeicao) e.tipoRefeicao = 'Selecione o tipo';
    if (!aceitacao) e.aceitacao = 'Selecione a aceitação';
    if (!via) e.via = 'Selecione a via';
    setErrors(e);
    return Object.keys(e).length === 0;
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
        intercorrencia: undefined,
        observacoes: observacoes.trim() || undefined,
      });

      Alert.alert('Registrado', `Alimentação registrada para ${selectedPatient!.nome}.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar o registro.');
      console.error('RegisterFeeding error', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderChips = (
    key: string,
    sectionLabel: string,
    options: { value: string; label: string }[],
    selected: string,
    onSelect: (v: string) => void,
    error?: string
  ) => (
    <View style={styles.field} key={key}>
      <Text style={styles.sectionLabel}>{sectionLabel}</Text>
      <View style={styles.chipRow}>
        {options.map((opt) => {
          const isActive = selected === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => {
                onSelect(opt.value);
                setErrors((p) => ({ ...p, [key]: '' }));
              }}
              activeOpacity={0.7}
              disabled={isSubmitting}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.root}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
              <Ionicons name="arrow-back" size={20} color={colors.primary} />
              <Text style={styles.backText}>Voltar</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Alimentação</Text>
            <View style={styles.separator} />

            <View style={styles.form}>
              {/* Patient selector */}
              <View style={styles.field}>
                <Text style={styles.label}>Paciente</Text>
                <TouchableOpacity
                  style={[styles.selector, errors.paciente && styles.inputError]}
                  onPress={() => setShowPicker(!showPicker)}
                >
                  <Text style={selectedPatient ? styles.selectorText : styles.selectorPlaceholder}>
                    {selectedPatient?.nome ?? 'Selecione o paciente'}
                  </Text>
                  <Text style={styles.chevron}>⌃</Text>
                </TouchableOpacity>
                {showPicker && (
                  <View style={styles.pickerDropdown}>
                    {patients.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={styles.pickerItem}
                        onPress={() => {
                          setSelectedPatient(p);
                          setShowPicker(false);
                          setErrors((prev) => ({ ...prev, paciente: '' }));
                        }}
                      >
                        <Text style={styles.pickerItemText}>{p.nome}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {errors.paciente ? <Text style={styles.errorText}>{errors.paciente}</Text> : null}
              </View>

              {renderChips('tipoRefeicao', 'TIPO DE REFEIÇÃO', REFEICAO_OPTIONS, tipoRefeicao, setTipoRefeicao, errors.tipoRefeicao)}
              {renderChips('aceitacao', 'ACEITAÇÃO', ACEITACAO_OPTIONS, aceitacao, setAceitacao, errors.aceitacao)}
              {renderChips('via', 'VIA', VIA_OPTIONS, via, setVia, errors.via)}

              {/* Volume aproximado */}
              <View style={styles.field}>
                <Text style={styles.label}>Volume Aproximado (ml ou %)</Text>
                <TextInput
                  value={volume}
                  onChangeText={setVolume}
                  placeholder=""
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, styles.inputMultiline]}
                  editable={!isSubmitting}
                />
              </View>

              {/* Observações */}
              <View style={styles.field}>
                <Text style={styles.label}>Observações</Text>
                <TextInput
                  ref={obsRef}
                  value={observacoes}
                  onChangeText={setObservacoes}
                  placeholder=""
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, styles.inputMultiline]}
                  multiline
                  textAlignVertical="top"
                  editable={!isSubmitting}
                />
              </View>
            </View>
          </ScrollView>

          <View style={[styles.actionArea, { paddingBottom: insets.bottom + spacing.lg }]}>
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitText}>Salvar Registro</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: spacing.lg },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.xs, marginBottom: spacing.md },
  backText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '500' },
  title: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.35,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.primary,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  form: { marginTop: spacing.md },
  field: { marginBottom: spacing.lg },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs + 2,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  input: {
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  inputMultiline: { height: 80, paddingTop: spacing.md },
  inputError: { borderColor: colors.error },
  errorText: { color: colors.error, fontSize: fontSize.xs, marginTop: spacing.xs },

  // Selector
  selector: {
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorText: { fontSize: fontSize.md, color: colors.textPrimary, flex: 1 },
  selectorPlaceholder: { fontSize: fontSize.md, color: colors.textMuted, flex: 1 },
  chevron: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    transform: [{ rotate: '180deg' }],
  },
  pickerDropdown: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  pickerItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pickerItemText: { fontSize: fontSize.md, color: colors.textPrimary },

  // Chips
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '500' },
  chipTextActive: { color: colors.white },

  // Action
  actionArea: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  submitButton: {
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
