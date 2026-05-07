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

const VIA_OPTIONS = [
  { value: 'oral', label: 'Oral' },
  { value: 'sublingual', label: 'Sublingual' },
  { value: 'topica', label: 'Tópica' },
  { value: 'intramuscular', label: 'IM' },
  { value: 'subcutanea', label: 'SC' },
  { value: 'intravenosa', label: 'IV' },
  { value: 'retal', label: 'Retal' },
  { value: 'inalatoria', label: 'Inalatória' },
] as const;

export const RegisterMedicationScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();

  // Patient selector
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPatientPicker, setShowPatientPicker] = useState(false);

  // Form
  const [medicamento, setMedicamento] = useState('');
  const [dosagem, setDosagem] = useState('');
  const [horario, setHorario] = useState('');
  const [via, setVia] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [recusado, setRecusado] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const dosagemRef = useRef<TextInput>(null);
  const horarioRef = useRef<TextInput>(null);
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
    if (!medicamento.trim()) e.medicamento = 'Informe o medicamento';
    if (!dosagem.trim()) e.dosagem = 'Informe a dosagem';
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
      await registroService.createRecord(user.empresaId, selectedPatient!.id, {
        type: 'medicamento',
        pacienteId: selectedPatient!.id,
        empresaId: user.empresaId,
        profissionalId: user.uid,
        profissionalNome: user.nome,
        medicamento: medicamento.trim(),
        dosagem: dosagem.trim(),
        via,
        prescricaoId: '',
        recusado,
        reacao: undefined,
        observacoes: observacoes.trim() || undefined,
      });

      Alert.alert('Registrado', `Medicamento registrado para ${selectedPatient!.nome}.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar o registro.');
      console.error('RegisterMedication error', error);
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

            <Text style={styles.title}>Registrar Medicamento</Text>
            <View style={styles.separator} />

            <View style={styles.form}>
              {/* Patient selector */}
              <View style={styles.field}>
                <Text style={styles.label}>Paciente</Text>
                <TouchableOpacity
                  style={[styles.selector, errors.paciente && styles.inputError]}
                  onPress={() => setShowPatientPicker(!showPatientPicker)}
                >
                  <Text style={selectedPatient ? styles.selectorText : styles.selectorPlaceholder}>
                    {selectedPatient?.nome ?? 'Selecione o paciente'}
                  </Text>
                </TouchableOpacity>
                {showPatientPicker && (
                  <View style={styles.pickerDropdown}>
                    {patients.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={styles.pickerItem}
                        onPress={() => {
                          setSelectedPatient(p);
                          setShowPatientPicker(false);
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

              {/* Medicamento */}
              <View style={styles.field}>
                <Text style={styles.label}>Medicamento</Text>
                <TextInput
                  value={medicamento}
                  onChangeText={(v) => { setMedicamento(v); setErrors((p) => ({ ...p, medicamento: '' })); }}
                  placeholder="Ex.: Losartana 50mg"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, errors.medicamento && styles.inputError]}
                  returnKeyType="next"
                  onSubmitEditing={() => dosagemRef.current?.focus()}
                  editable={!isSubmitting}
                />
                {errors.medicamento ? <Text style={styles.errorText}>{errors.medicamento}</Text> : null}
              </View>

              {/* Dosagem + Horário lado a lado */}
              <View style={styles.row}>
                <View style={styles.rowHalf}>
                  <Text style={styles.label}>Dosagem</Text>
                  <TextInput
                    ref={dosagemRef}
                    value={dosagem}
                    onChangeText={(v) => { setDosagem(v); setErrors((p) => ({ ...p, dosagem: '' })); }}
                    placeholder="Ex.: 1 comp."
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, errors.dosagem && styles.inputError]}
                    returnKeyType="next"
                    onSubmitEditing={() => horarioRef.current?.focus()}
                    editable={!isSubmitting}
                  />
                  {errors.dosagem ? <Text style={styles.errorText}>{errors.dosagem}</Text> : null}
                </View>
                <View style={styles.rowHalf}>
                  <Text style={styles.label}>Horário</Text>
                  <TextInput
                    ref={horarioRef}
                    value={horario}
                    onChangeText={setHorario}
                    placeholder="12:30"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    keyboardType="numeric"
                    returnKeyType="done"
                    editable={!isSubmitting}
                  />
                </View>
              </View>

              {/* Via */}
              <View style={styles.field}>
                <Text style={styles.sectionLabel}>VIA DE ADMINISTRAÇÃO</Text>
                <View style={styles.chipRow}>
                  {VIA_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.chip, via === opt.value && styles.chipActive]}
                      onPress={() => { setVia(opt.value); setErrors((p) => ({ ...p, via: '' })); }}
                      activeOpacity={0.7}
                      disabled={isSubmitting}
                    >
                      <Text style={[styles.chipText, via === opt.value && styles.chipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.via ? <Text style={styles.errorText}>{errors.via}</Text> : null}
              </View>

              {/* Recusado */}
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setRecusado(!recusado)}
                activeOpacity={0.7}
              >
                <View style={[styles.toggleBox, recusado && styles.toggleBoxActive]}>
                  {recusado && <Text style={styles.toggleCheck}>✓</Text>}
                </View>
                <Text style={styles.toggleLabel}>Paciente recusou o medicamento</Text>
              </TouchableOpacity>

              {/* Observações */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  Observações <Text style={styles.optional}>(opcional)</Text>
                </Text>
                <TextInput
                  ref={obsRef}
                  value={observacoes}
                  onChangeText={setObservacoes}
                  placeholder="Reação, motivo da recusa, etc."
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
  title: { fontSize: fontSize.title, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.35 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: spacing.md },
  form: { marginTop: spacing.lg },
  field: { marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  rowHalf: { flex: 1 },
  sectionLabel: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1, marginBottom: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs + 2 },
  optional: { color: colors.textMuted, fontWeight: '400' },
  input: {
    height: 52, borderRadius: borderRadius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md,
    fontSize: fontSize.md, color: colors.textPrimary,
  },
  inputMultiline: { height: 100, paddingTop: spacing.md },
  inputError: { borderColor: colors.error },
  errorText: { color: colors.error, fontSize: fontSize.xs, marginTop: spacing.xs },

  // Selector
  selector: {
    height: 52, borderRadius: borderRadius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  selectorText: { fontSize: fontSize.md, color: colors.textPrimary },
  selectorPlaceholder: { fontSize: fontSize.md, color: colors.textMuted },
  pickerDropdown: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.md, marginTop: spacing.xs, overflow: 'hidden',
  },
  pickerItem: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pickerItemText: { fontSize: fontSize.md, color: colors.textPrimary },

  // Chips
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: '500' },
  chipTextActive: { color: colors.white },

  // Toggle
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, paddingVertical: spacing.xs },
  toggleBox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  toggleBoxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleCheck: { color: colors.white, fontSize: 14, fontWeight: '700' },
  toggleLabel: { fontSize: fontSize.md, color: colors.textPrimary },

  // Action
  actionArea: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
  submitButton: {
    height: 56, borderRadius: borderRadius.lg, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitText: { color: colors.white, fontSize: fontSize.lg, fontWeight: '600', letterSpacing: 0.3 },
});
