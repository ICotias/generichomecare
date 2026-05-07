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
import type { Patient, IncidentRecord } from '../../../core/types';
import { MOCK_PATIENTS } from '../../../core/mocks/patients';

const TIPO_OPTIONS: { value: IncidentRecord['tipoIncidente']; label: string }[] = [
  { value: 'queda', label: 'Queda' },
  { value: 'erro_medicacao', label: 'Erro Med' },
  { value: 'agitacao', label: 'Agitação' },
  { value: 'dispneia', label: 'Dispneia' },
  { value: 'febre', label: 'Febre' },
  { value: 'outro', label: 'Outro' },
];

const GRAVIDADE_OPTIONS: {
  value: IncidentRecord['gravidade'];
  label: string;
  activeColor: string;
  activeBg: string;
}[] = [
  { value: 'leve', label: 'Leve', activeColor: colors.white, activeBg: '#6B7280' },
  { value: 'moderado', label: 'Moderado', activeColor: colors.white, activeBg: '#DC2626' },
  { value: 'grave', label: 'Grave', activeColor: colors.white, activeBg: '#7F1D1D' },
];

export const RegisterIncidentScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const [tipoIncidente, setTipoIncidente] = useState<IncidentRecord['tipoIncidente'] | ''>('');
  const [gravidade, setGravidade] = useState<IncidentRecord['gravidade'] | ''>('');
  const [descricao, setDescricao] = useState('');
  const [medidasTomadas, setMedidasTomadas] = useState('');
  const [notificouFamilia, setNotificouFamilia] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const descRef = useRef<TextInput>(null);
  const medidasRef = useRef<TextInput>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user?.empresaId) return;
      patientService.listPatients(user.empresaId).then((list) => setPatients(list.length > 0 ? list : MOCK_PATIENTS)).catch(console.error);
    }, [user?.empresaId])
  );

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!selectedPatient) e.paciente = 'Selecione o paciente';
    if (!tipoIncidente) e.tipoIncidente = 'Selecione o tipo';
    if (!gravidade) e.gravidade = 'Selecione a gravidade';
    if (!descricao.trim()) e.descricao = 'Descreva a intercorrência';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!validate()) return;
    if (!user?.empresaId || !user?.uid) return;

    setIsSubmitting(true);
    try {
      await registroService.createRecord(user.empresaId, selectedPatient!.id, {
        type: 'intercorrencia',
        pacienteId: selectedPatient!.id,
        empresaId: user.empresaId,
        profissionalId: user.uid,
        profissionalNome: user.nome,
        tipoIncidente: tipoIncidente as IncidentRecord['tipoIncidente'],
        gravidade: gravidade as IncidentRecord['gravidade'],
        descricao: descricao.trim(),
        medidasTomadas: medidasTomadas.trim() || undefined,
        notificouFamilia,
        observacoes: undefined,
      });

      Alert.alert('Registrado', `Intercorrência registrada para ${selectedPatient!.nome}.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar o registro.');
      console.error('RegisterIncident error', error);
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

            <Text style={styles.title}>Intercorrência</Text>
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

              {/* Tipo */}
              <View style={styles.field}>
                <Text style={styles.sectionLabel}>TIPO</Text>
                <View style={styles.chipRow}>
                  {TIPO_OPTIONS.map((opt) => {
                    const isActive = tipoIncidente === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.chip, isActive && styles.chipActive]}
                        onPress={() => {
                          setTipoIncidente(opt.value);
                          setErrors((p) => ({ ...p, tipoIncidente: '' }));
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
                {errors.tipoIncidente ? (
                  <Text style={styles.errorText}>{errors.tipoIncidente}</Text>
                ) : null}
              </View>

              {/* Gravidade */}
              <View style={styles.field}>
                <Text style={styles.sectionLabel}>GRAVIDADE</Text>
                <View style={styles.chipRow}>
                  {GRAVIDADE_OPTIONS.map((opt) => {
                    const isActive = gravidade === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[
                          styles.chip,
                          isActive && { backgroundColor: opt.activeBg, borderColor: opt.activeBg },
                        ]}
                        onPress={() => {
                          setGravidade(opt.value);
                          setErrors((p) => ({ ...p, gravidade: '' }));
                        }}
                        activeOpacity={0.7}
                        disabled={isSubmitting}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            isActive && styles.gravChipTextActive,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {errors.gravidade ? <Text style={styles.errorText}>{errors.gravidade}</Text> : null}
              </View>

              {/* Descrição Detalhada */}
              <View style={styles.field}>
                <Text style={styles.label}>Descrição Detalhada</Text>
                <TextInput
                  ref={descRef}
                  value={descricao}
                  onChangeText={(t) => {
                    setDescricao(t);
                    setErrors((p) => ({ ...p, descricao: '' }));
                  }}
                  placeholder="O que aconteceu..."
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, styles.inputTall, errors.descricao && styles.inputError]}
                  multiline
                  textAlignVertical="top"
                  editable={!isSubmitting}
                  returnKeyType="next"
                  onSubmitEditing={() => medidasRef.current?.focus()}
                />
                {errors.descricao ? <Text style={styles.errorText}>{errors.descricao}</Text> : null}
              </View>

              {/* Medidas Tomadas */}
              <View style={styles.field}>
                <Text style={styles.label}>Medidas Tomadas</Text>
                <TextInput
                  ref={medidasRef}
                  value={medidasTomadas}
                  onChangeText={setMedidasTomadas}
                  placeholder=""
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, styles.inputMultiline]}
                  multiline
                  textAlignVertical="top"
                  editable={!isSubmitting}
                />
              </View>

              {/* Notificou Família? — Checkbox */}
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setNotificouFamilia(!notificouFamilia)}
                activeOpacity={0.7}
                disabled={isSubmitting}
              >
                <View style={[styles.checkbox, notificouFamilia && styles.checkboxActive]}>
                  {notificouFamilia && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>Notificou Família?</Text>
              </TouchableOpacity>
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
  inputTall: { height: 120, paddingTop: spacing.md },
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
  gravChipTextActive: { color: colors.white, fontWeight: '600' },

  // Checkbox
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  checkmark: { color: colors.white, fontSize: 14, fontWeight: '700' },
  checkboxLabel: { fontSize: fontSize.md, color: colors.textPrimary, fontWeight: '500' },

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
