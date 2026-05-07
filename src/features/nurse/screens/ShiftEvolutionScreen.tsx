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
import * as shiftService from '../../../core/services/shiftService';
import * as evolucaoService from '../../../core/services/evolucaoService';
import type { Patient } from '../../../core/types';
import { MOCK_PATIENTS } from '../../../core/mocks/patients';

const SBAR_FIELDS = [
  {
    key: 'situacao',
    letter: 'S',
    title: 'Situação',
    placeholder: 'Como está o paciente agora?',
    hint: 'Estado atual, nível de consciência, queixas...',
  },
  {
    key: 'ocorrencias',
    letter: 'B',
    title: 'Background',
    placeholder: 'O que aconteceu neste plantão?',
    hint: 'Eventos relevantes, medicações administradas...',
  },
  {
    key: 'pendencias',
    letter: 'A',
    title: 'Avaliação',
    placeholder: 'Pendências e pontos de atenção',
    hint: 'Exames pendentes, medicações a confirmar...',
  },
  {
    key: 'orientacoes',
    letter: 'R',
    title: 'Recomendação',
    placeholder: 'Orientações para o próximo plantão',
    hint: 'O que o próximo profissional precisa saber...',
  },
];

export const ShiftEvolutionScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const [form, setForm] = useState<Record<string, string>>({
    situacao: '',
    ocorrencias: '',
    pendencias: '',
    orientacoes: '',
    observacoesLivres: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fieldRefs = useRef<Record<string, TextInput | null>>({});

  useFocusEffect(
    useCallback(() => {
      if (!user?.empresaId) return;
      patientService
        .listPatients(user.empresaId)
        .then((list) => setPatients(list.length > 0 ? list : MOCK_PATIENTS))
        .catch(console.error);
    }, [user?.empresaId])
  );

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!selectedPatient) e.paciente = 'Selecione o paciente';
    SBAR_FIELDS.forEach((f) => {
      if (!form[f.key]?.trim()) e[f.key] = `${f.title} é obrigatório`;
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!validate()) return;
    if (!user?.empresaId || !user?.uid) return;

    setIsSubmitting(true);
    try {
      // Busca plantão ativo (opcional — se não tiver, usa 'sem-plantao')
      const activeShift = await shiftService
        .getActiveShift(user.empresaId, user.uid)
        .catch(() => null);

      await evolucaoService.createEvolucao({
        empresaId: user.empresaId,
        pacienteId: selectedPatient!.id,
        profissionalId: user.uid,
        plantaoId: activeShift?.id ?? 'sem-plantao',
        situacao: form.situacao.trim(),
        ocorrencias: form.ocorrencias.trim(),
        pendencias: form.pendencias.trim(),
        orientacoes: form.orientacoes.trim(),
        observacoesLivres: form.observacoesLivres?.trim() || undefined,
      });

      Alert.alert(
        'Evolução registrada',
        `Passagem de plantão para ${selectedPatient!.nome} salva com sucesso.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar a evolução.');
      console.error('ShiftEvolution error', error);
    } finally {
      setIsSubmitting(false);
    }
  };

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

            <Text style={styles.titleLine1}>Evolução do</Text>
            <Text style={styles.titleLine2}>Plantão</Text>
            <Text style={styles.subtitle}>Passagem de plantão — método SBAR</Text>

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

              {/* SBAR fields */}
              {SBAR_FIELDS.map((sbar, idx) => (
                <View key={sbar.key} style={styles.field}>
                  <View style={styles.sbarHeader}>
                    <View style={styles.sbarBadge}>
                      <Text style={styles.sbarLetter}>{sbar.letter}</Text>
                    </View>
                    <Text style={styles.sbarTitle}>{sbar.title}</Text>
                  </View>
                  <Text style={styles.sbarHint}>{sbar.hint}</Text>
                  <TextInput
                    ref={(ref) => { fieldRefs.current[sbar.key] = ref; }}
                    value={form[sbar.key]}
                    onChangeText={(t) => updateField(sbar.key, t)}
                    placeholder={sbar.placeholder}
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.input,
                      styles.inputMultiline,
                      errors[sbar.key] && styles.inputError,
                    ]}
                    multiline
                    textAlignVertical="top"
                    editable={!isSubmitting}
                    returnKeyType={idx < SBAR_FIELDS.length - 1 ? 'next' : 'done'}
                  />
                  {errors[sbar.key] ? (
                    <Text style={styles.errorText}>{errors[sbar.key]}</Text>
                  ) : null}
                </View>
              ))}

              {/* Observações livres (opcional) */}
              <View style={styles.field}>
                <Text style={styles.label}>Observações adicionais</Text>
                <TextInput
                  value={form.observacoesLivres}
                  onChangeText={(t) => updateField('observacoesLivres', t)}
                  placeholder="Informações extras que não se encaixam no SBAR..."
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
                <>
                  <Ionicons name="checkmark-circle-outline" size={22} color={colors.white} style={{ marginRight: 6 }} />
                  <Text style={styles.submitText}>Assinar e Fechar Turno</Text>
                </>

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
  titleLine1: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  titleLine2: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
    marginTop: -2,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  form: { marginTop: spacing.sm },
  field: { marginBottom: spacing.lg },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs + 2,
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
  inputMultiline: { height: 100, paddingTop: spacing.md },
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

  // SBAR header
  sbarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sbarBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sbarLetter: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.white,
  },
  sbarTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sbarHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    lineHeight: 16,
  },

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
    flexDirection: 'row',
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
