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
import { ModalHeader } from '../../../shared/components/ui/ModalHeader';
import { InsetGroupedSection } from '../../../shared/components/ui/InsetGroupedSection';
import { InsetRow } from '../../../shared/components/ui/InsetRow';

const isOutOfRange = (val: number, min: number, max: number) =>
  val > 0 && (val < min || val > max);

export const RegisterVitalsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const { patients, selectedPatient, setSelectedPatient } = usePatientWithActiveShift(user?.empresaId, user?.uid);


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

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!selectedPatient) e.paciente = 'Nenhum paciente vinculado ao plantão ativo';
    if (!paSist.trim()) e.paSist = 'Obrigatório';
    if (!paDiast.trim()) e.paDiast = 'Obrigatório';
    if (!fc.trim()) e.fc = 'Obrigatório';
    if (!fr.trim()) e.fr = 'Obrigatório';
    if (!temp.trim()) e.temp = 'Obrigatório';
    if (!spo2.trim()) e.spo2 = 'Obrigatório';
    setErrors(e);
    if (Object.keys(e).length > 0) {
      if (e.paciente) {
        Alert.alert('Sem paciente', 'Inicie um plantão antes de registrar sinais vitais.');
      } else {
        Alert.alert('Campos obrigatórios', 'Preencha todos os campos antes de salvar.');
      }
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!validate()) return;
    if (!user?.empresaId || !user?.uid) return;

    const ranges = selectedPatient!.faixaSinaisVitais ?? {} as any;
    const paSistNum = Number(paSist);
    const paDiastNum = Number(paDiast);
    const fcNum = Number(fc);
    const frNum = Number(fr);
    const tempNum = Number(temp.replace(',', '.'));
    const spo2Num = Number(spo2);

    const alerta = ranges.paSistolicaMin != null
      ? (isOutOfRange(paSistNum, ranges.paSistolicaMin, ranges.paSistolicaMax) ||
         isOutOfRange(paDiastNum, ranges.paDiastolicaMin, ranges.paDiastolicaMax) ||
         isOutOfRange(fcNum, ranges.fcMin, ranges.fcMax) ||
         isOutOfRange(frNum, ranges.frMin, ranges.frMax) ||
         isOutOfRange(tempNum, ranges.tempMin, ranges.tempMax) ||
         spo2Num < ranges.satO2Min)
      : false;

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
        ...(observacoes.trim() ? { observacoes: observacoes.trim() } : {}),
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
          {/* Apple HIG modal header: Cancelar / Title / Salvar */}
          <View style={{ paddingTop: insets.top }}>
            <ModalHeader
              title="Sinais Vitais"
              onCancel={() => (navigation as any).getParent()?.navigate('NurseHomeStack')}
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
            <Text style={styles.subtitle}>
              Valores fora da faixa do paciente serão sinalizados em vermelho.
            </Text>


            {/* Vitals grid — kept as-is, wrapped in InsetGroupedSection */}
            <InsetGroupedSection header="SINAIS VITAIS">
              <View style={styles.vitalsGridContainer}>
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
              </View>
            </InsetGroupedSection>

            {/* Observações — wrapped in InsetGroupedSection */}
            <InsetGroupedSection header="OBSERVAÇÕES">
              <View style={styles.obsContainer}>
                <TextInput
                  ref={obsRef}
                  value={observacoes}
                  onChangeText={setObservacoes}
                  placeholder="Posição do paciente, contexto, etc."
                  placeholderTextColor={colors.textMuted}
                  style={styles.obsInput}
                  multiline
                  textAlignVertical="top"
                  editable={!isSubmitting}
                />
              </View>
            </InsetGroupedSection>
          </ScrollView>

        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  sectionError: {
    marginTop: -spacing.md,
    marginBottom: spacing.md,
    marginLeft: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  optional: { color: colors.textMuted, fontWeight: '400' },
  inputError: { borderColor: colors.error },
  inputOutOfRange: { borderColor: colors.error, backgroundColor: colors.error + '08' },
  errorText: { color: colors.error, fontSize: fontSize.xs, marginTop: spacing.xs },
  alertText: { color: colors.error, fontSize: fontSize.xs, fontWeight: '600', marginTop: spacing.xs },

  // Vitals grid — unchanged layout
  vitalsGridContainer: {
    padding: spacing.md,
  },
  vitalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  vitalField: { width: '48%', marginBottom: spacing.sm },
  vitalLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  unit: { fontSize: fontSize.xs, color: colors.textMuted },
  vitalInput: {
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },

  // Observações
  obsContainer: {
    padding: spacing.md,
  },
  obsInput: {
    height: 100,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
});
