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

const isOutOfRange = (val: number, min: number, max: number) =>
  val > 0 && (val < min || val > max);

export const RegisterVitalsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const [paSist, setPaSist] = useState('');
  const [paDiast, setPaDiast] = useState('');
  const [fc, setFc] = useState('');
  const [fr, setFr] = useState('');
  const [temp, setTemp] = useState('');
  const [spo2, setSpo2] = useState('');
  const [glicemia, setGlicemia] = useState('');
  const [dor, setDor] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const paDiastRef = useRef<TextInput>(null);
  const fcRef = useRef<TextInput>(null);
  const frRef = useRef<TextInput>(null);
  const tempRef = useRef<TextInput>(null);
  const spo2Ref = useRef<TextInput>(null);
  const glicemiaRef = useRef<TextInput>(null);
  const dorRef = useRef<TextInput>(null);
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
    if (!paSist.trim()) e.paSist = 'Obrigatório';
    if (!paDiast.trim()) e.paDiast = 'Obrigatório';
    if (!fc.trim()) e.fc = 'Obrigatório';
    if (!fr.trim()) e.fr = 'Obrigatório';
    if (!temp.trim()) e.temp = 'Obrigatório';
    if (!spo2.trim()) e.spo2 = 'Obrigatório';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!validate()) return;
    if (!user?.empresaId || !user?.uid) return;

    const ranges = selectedPatient!.faixaSinaisVitais;
    const paSistNum = Number(paSist);
    const paDiastNum = Number(paDiast);
    const fcNum = Number(fc);
    const frNum = Number(fr);
    const tempNum = Number(temp.replace(',', '.'));
    const spo2Num = Number(spo2);

    const alerta =
      isOutOfRange(paSistNum, ranges.paSistolicaMin, ranges.paSistolicaMax) ||
      isOutOfRange(paDiastNum, ranges.paDiastolicaMin, ranges.paDiastolicaMax) ||
      isOutOfRange(fcNum, ranges.fcMin, ranges.fcMax) ||
      isOutOfRange(frNum, ranges.frMin, ranges.frMax) ||
      isOutOfRange(tempNum, ranges.tempMin, ranges.tempMax) ||
      spo2Num < ranges.satO2Min;

    setIsSubmitting(true);
    try {
      await registroService.createRecord(user.empresaId, selectedPatient!.id, {
        type: 'sinaisVitais',
        pacienteId: selectedPatient!.id,
        empresaId: user.empresaId,
        profissionalId: user.uid,
        profissionalNome: user.nome,
        paSistolica: paSistNum,
        paDiastolica: paDiastNum,
        fc: fcNum,
        fr: frNum,
        temperatura: tempNum,
        satO2: spo2Num,
        alerta,
        observacoes: observacoes.trim() || undefined,
      });

      const msg = alerta
        ? 'Sinais vitais registrados. Alguns valores estão fora da faixa esperada.'
        : 'Sinais vitais registrados com sucesso.';

      Alert.alert('Registrado', msg, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar o registro.');
      console.error('RegisterVitals error', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Vital field renderer ──
  const renderVitalField = (
    label: string,
    value: string,
    setter: (v: string) => void,
    errorKey: string,
    opts: {
      unit: string;
      ref?: React.RefObject<TextInput | null>;
      nextRef?: React.RefObject<TextInput | null>;
      outOfRange?: boolean;
      optional?: boolean;
    }
  ) => (
    <View style={styles.vitalField} key={label}>
      <View style={styles.vitalLabelRow}>
        <Text style={styles.label}>
          {label}
          {opts.optional ? <Text style={styles.optional}> (opc.)</Text> : null}
        </Text>
        <Text style={styles.unit}>{opts.unit}</Text>
      </View>
      <TextInput
        ref={opts.ref}
        value={value}
        onChangeText={(v) => {
          setter(v);
          setErrors((p) => ({ ...p, [errorKey]: '' }));
        }}
        placeholder="—"
        placeholderTextColor={colors.textMuted}
        keyboardType="numeric"
        returnKeyType={opts.nextRef ? 'next' : 'done'}
        onSubmitEditing={() => opts.nextRef?.current?.focus()}
        style={[
          styles.vitalInput,
          errors[errorKey] && styles.inputError,
          opts.outOfRange && styles.inputOutOfRange,
        ]}
        editable={!isSubmitting}
      />
      {errors[errorKey] ? <Text style={styles.errorText}>{errors[errorKey]}</Text> : null}
      {opts.outOfRange && <Text style={styles.alertText}>Fora da faixa</Text>}
    </View>
  );

  const ranges = selectedPatient?.faixaSinaisVitais;

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

            <Text style={styles.title}>Sinais vitais</Text>
            <Text style={styles.subtitle}>
              Valores fora da faixa do paciente serão sinalizados em vermelho.
            </Text>

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

              {/* Vitals grid */}
              <View style={styles.vitalsGrid}>
                {renderVitalField('PA Sist.', paSist, setPaSist, 'paSist', {
                  unit: 'mmHg',
                  nextRef: paDiastRef,
                  outOfRange: ranges ? isOutOfRange(Number(paSist), ranges.paSistolicaMin, ranges.paSistolicaMax) && paSist.length > 0 : false,
                })}
                {renderVitalField('PA Diast.', paDiast, setPaDiast, 'paDiast', {
                  unit: 'mmHg',
                  ref: paDiastRef,
                  nextRef: fcRef,
                  outOfRange: ranges ? isOutOfRange(Number(paDiast), ranges.paDiastolicaMin, ranges.paDiastolicaMax) && paDiast.length > 0 : false,
                })}
                {renderVitalField('FC', fc, setFc, 'fc', {
                  unit: 'bpm',
                  ref: fcRef,
                  nextRef: frRef,
                  outOfRange: ranges ? isOutOfRange(Number(fc), ranges.fcMin, ranges.fcMax) && fc.length > 0 : false,
                })}
                {renderVitalField('FR', fr, setFr, 'fr', {
                  unit: 'irpm',
                  ref: frRef,
                  nextRef: tempRef,
                  outOfRange: ranges ? isOutOfRange(Number(fr), ranges.frMin, ranges.frMax) && fr.length > 0 : false,
                })}
                {renderVitalField('Temp.', temp, setTemp, 'temp', {
                  unit: '°C',
                  ref: tempRef,
                  nextRef: spo2Ref,
                  outOfRange: ranges ? isOutOfRange(Number(temp.replace(',', '.')), ranges.tempMin, ranges.tempMax) && temp.length > 0 : false,
                })}
                {renderVitalField('SpO₂', spo2, setSpo2, 'spo2', {
                  unit: '%',
                  ref: spo2Ref,
                  nextRef: glicemiaRef,
                  outOfRange: ranges ? Number(spo2) < ranges.satO2Min && spo2.length > 0 : false,
                })}
                {renderVitalField('Glicemia', glicemia, setGlicemia, 'glicemia', {
                  unit: 'mg/dL',
                  ref: glicemiaRef,
                  nextRef: dorRef,
                  optional: true,
                })}
                {renderVitalField('Dor (0-10)', dor, setDor, 'dor', {
                  unit: '',
                  ref: dorRef,
                  optional: true,
                })}
              </View>

              {/* Observações */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  Observações <Text style={styles.optional}>(opcional)</Text>
                </Text>
                <TextInput
                  ref={obsRef}
                  value={observacoes}
                  onChangeText={setObservacoes}
                  placeholder="Posição do paciente, contexto, etc."
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
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 22 },
  form: { marginTop: spacing.xl },
  field: { marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs + 2 },
  optional: { color: colors.textMuted, fontWeight: '400' },
  input: {
    height: 52, borderRadius: borderRadius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md,
    fontSize: fontSize.md, color: colors.textPrimary,
  },
  inputMultiline: { height: 100, paddingTop: spacing.md },
  inputError: { borderColor: colors.error },
  inputOutOfRange: { borderColor: colors.error, backgroundColor: colors.error + '08' },
  errorText: { color: colors.error, fontSize: fontSize.xs, marginTop: spacing.xs },
  alertText: { color: colors.error, fontSize: fontSize.xs, fontWeight: '600', marginTop: spacing.xs },

  // Selector
  selector: {
    height: 52, borderRadius: borderRadius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, justifyContent: 'center',
  },
  selectorText: { fontSize: fontSize.md, color: colors.textPrimary },
  selectorPlaceholder: { fontSize: fontSize.md, color: colors.textMuted },
  pickerDropdown: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.md, marginTop: spacing.xs, overflow: 'hidden',
  },
  pickerItem: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  pickerItemText: { fontSize: fontSize.md, color: colors.textPrimary },

  // Vitals grid
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  vitalField: { width: '48%', marginBottom: spacing.sm },
  vitalLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  unit: { fontSize: fontSize.xs, color: colors.textMuted },
  vitalInput: {
    height: 52, borderRadius: borderRadius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md,
    fontSize: fontSize.lg, fontWeight: '600', color: colors.textPrimary, textAlign: 'center',
  },

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
