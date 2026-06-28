import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as patientService from '../../../core/services/patientService';
import { VITAL_SIGNS_PRESETS, type VitalSignsPresetKey } from '../../../core/services/patientService';
import type { PatientMgmtStackParamList } from '../../../core/navigation/RootNavigator';
import type { Patient, VitalSignsRange } from '../../../core/types';
import { ModalHeader } from '../../../shared/components/ui/ModalHeader';
import { InsetGroupedSection } from '../../../shared/components/ui/InsetGroupedSection';
import { InsetRow } from '../../../shared/components/ui/InsetRow';
import { SegmentedControl } from '../../../shared/components/ui/SegmentedControl';
import { formatPhone, formatCPF } from '../../../shared/utils/formatters';

type NavProp = NativeStackNavigationProp<PatientMgmtStackParamList, 'CreatePatient'>;

interface FormState {
  nome: string;
  dataNascimento: Date | null;
  cpf: string;
  genero: Patient['genero'] | '';
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  contatoNome: string;
  contatoParentesco: string;
  contatoTelefone: string;
  diagnosticos: string;
  alergias: string;
  medicamentosEmUso: string;
  tipoAtendimento: Patient['tipoAtendimento'] | '';
  observacoes: string;
}

interface FormErrors {
  [key: string]: string | undefined;
}

const GENERO_SEGMENTS = [
  { key: 'masculino', label: 'Masculino' },
  { key: 'feminino', label: 'Feminino' },
  { key: 'outro', label: 'Outro' },
];

const ATENDIMENTO_SEGMENTS = [
  { key: 'integral', label: '24h' },
  { key: 'diurno', label: 'Diurno' },
  { key: 'noturno', label: 'Noturno' },
  { key: 'visita', label: 'Visita' },
];

const PRESET_SEGMENTS = VITAL_SIGNS_PRESETS.map((p) => ({ key: p.key, label: p.label }));

const CPF_REGEX = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;

// formatPhone e formatCPF importados de shared/utils/formatters

const formatCEP = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const formatDateBR = (d: Date): string => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const splitCSV = (str: string): string[] =>
  str.split(',').map((s) => s.trim()).filter(Boolean);

export const CreatePatientScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { user } = useAuthStore();

  const [form, setForm] = useState<FormState>({
    nome: '',
    dataNascimento: null,
    cpf: '',
    genero: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    contatoNome: '',
    contatoParentesco: '',
    contatoTelefone: '',
    diagnosticos: '',
    alergias: '',
    medicamentosEmUso: '',
    tipoAtendimento: '',
    observacoes: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<VitalSignsPresetKey>('idoso_padrao');
  const [customRanges, setCustomRanges] = useState<VitalSignsRange>(VITAL_SIGNS_PRESETS[0].ranges);

  // Refs
  const refs: Record<string, React.RefObject<TextInput | null>> = {
    cpf: useRef<TextInput>(null),
    rua: useRef<TextInput>(null),
    numero: useRef<TextInput>(null),
    complemento: useRef<TextInput>(null),
    bairro: useRef<TextInput>(null),
    cidade: useRef<TextInput>(null),
    estado: useRef<TextInput>(null),
    cep: useRef<TextInput>(null),
    contatoNome: useRef<TextInput>(null),
    contatoParentesco: useRef<TextInput>(null),
    contatoTelefone: useRef<TextInput>(null),
    diagnosticos: useRef<TextInput>(null),
    alergias: useRef<TextInput>(null),
    medicamentosEmUso: useRef<TextInput>(null),
    observacoes: useRef<TextInput>(null),
  };

  const updateField = useCallback(
    (key: string, value: string | Date | null) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      if (errors[key]) {
        setErrors((prev) => ({ ...prev, [key]: undefined, general: undefined }));
      }
    },
    [errors]
  );

  // (removed index helpers — SegmentedControl uses key-based selection)

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.nome.trim()) e.nome = 'Informe o nome completo';
    if (!form.dataNascimento) {
      e.dataNascimento = 'Informe a data de nascimento';
    } else if (form.dataNascimento > new Date()) {
      e.dataNascimento = 'Data não pode ser futura';
    }
    if (!form.cpf.trim()) {
      e.cpf = 'Informe o CPF';
    } else if (!CPF_REGEX.test(form.cpf)) {
      e.cpf = 'CPF inválido (000.000.000-00)';
    }
    if (!form.genero) e.genero = 'Selecione o gênero';
    if (!form.rua.trim()) e.rua = 'Informe a rua';
    if (!form.numero.trim()) e.numero = 'Nº obrigatório';
    if (!form.bairro.trim()) e.bairro = 'Informe o bairro';
    if (!form.cidade.trim()) e.cidade = 'Informe a cidade';
    if (!form.estado.trim()) e.estado = 'Informe o estado';
    if (!form.contatoNome.trim()) e.contatoNome = 'Informe o nome do contato';
    if (!form.contatoTelefone.trim()) e.contatoTelefone = 'Informe o telefone';
    if (!form.tipoAtendimento) e.tipoAtendimento = 'Selecione o tipo';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!validate()) return;
    if (!user?.empresaId) {
      setErrors({ general: 'Administrador sem empresa vinculada' });
      return;
    }

    setIsSubmitting(true);
    try {
      const patientData: Record<string, unknown> = {
        nome: form.nome.trim(),
        dataNascimento: form.dataNascimento!,
        cpf: form.cpf.trim(),
        genero: form.genero as Patient['genero'],
        endereco: {
          rua: form.rua.trim(),
          numero: form.numero.trim(),
          bairro: form.bairro.trim(),
          cidade: form.cidade.trim(),
          estado: form.estado.trim().toUpperCase(),
          cep: form.cep.trim(),
          ...(form.complemento.trim() ? { complemento: form.complemento.trim() } : {}),
        },
        contatoEmergencia: {
          nome: form.contatoNome.trim(),
          parentesco: form.contatoParentesco.trim(),
          telefone: form.contatoTelefone.trim(),
        },
        diagnosticos: splitCSV(form.diagnosticos),
        alergias: splitCSV(form.alergias),
        tipoAtendimento: form.tipoAtendimento as Patient['tipoAtendimento'],
        faixaSinaisVitais: customRanges,
      };

      const meds = splitCSV(form.medicamentosEmUso);
      if (meds.length > 0) patientData.medicamentosEmUso = meds;
      const obs = form.observacoes.trim();
      if (obs) patientData.observacoes = obs;

      await patientService.createPatient(user.empresaId, patientData as any);

      Alert.alert('Paciente cadastrado', `${form.nome.trim()} foi adicionado com sucesso.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      const msg = (error as Error)?.message ?? 'Erro desconhecido';
      setErrors({ general: `Não foi possível cadastrar. ${msg}` });
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
          <View style={{ paddingTop: insets.top }}>
            <ModalHeader
              title="Novo Paciente"
              onCancel={() => navigation.goBack()}
              onDone={handleSubmit}
              doneLabel="Cadastrar"
              doneDisabled={isSubmitting}
              isLoading={isSubmitting}
              accentColor={colors.primary}
            />
          </View>

          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Dados pessoais */}
            <InsetGroupedSection header="DADOS PESSOAIS">
              <InsetRow
                label="Nome"
                rightContent={
                  <TextInput
                    style={styles.inlineInput}
                    value={form.nome}
                    onChangeText={(v) => updateField('nome', v)}
                    placeholder="Nome completo"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => refs.cpf?.current?.focus()}
                  />
                }
              />
              <InsetRow
                label="Nascimento"
                value={form.dataNascimento ? formatDateBR(form.dataNascimento) : 'Selecionar'}
                valueColor={form.dataNascimento ? colors.textPrimary : colors.textMuted}
                onPress={() => setShowDatePicker(!showDatePicker)}
              />
              {showDatePicker && (
                <View style={styles.pickerContainer}>
                  <DateTimePicker
                    value={form.dataNascimento ?? new Date(1950, 0, 1)}
                    mode="date"
                    display="spinner"
                    maximumDate={new Date()}
                    onChange={(_e: any, date: Date | undefined) => {
                      if (date) updateField('dataNascimento', date);
                    }}
                    locale="pt-BR"
                  />
                </View>
              )}
              <InsetRow
                label="CPF"
                rightContent={
                  <TextInput
                    ref={refs.cpf}
                    style={styles.inlineInput}
                    value={form.cpf}
                    onChangeText={(v) => updateField('cpf', formatCPF(v))}
                    placeholder="000.000.000-00"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />
                }
                last
              />
            </InsetGroupedSection>
            {errors.nome ? <Text style={styles.errorText}>{errors.nome}</Text> : null}
            {errors.dataNascimento ? <Text style={styles.errorText}>{errors.dataNascimento}</Text> : null}
            {errors.cpf ? <Text style={styles.errorText}>{errors.cpf}</Text> : null}

            {/* Gênero — SegmentedControl */}
            <InsetGroupedSection header="GÊNERO">
              <View style={styles.segmentedContainer}>
                <SegmentedControl
                  options={GENERO_SEGMENTS}
                  selectedKey={form.genero || ''}
                  onSelect={(key) => updateField('genero', key)}
                  accentColor={colors.primary}
                />
              </View>
            </InsetGroupedSection>
            {errors.genero ? <Text style={styles.errorText}>{errors.genero}</Text> : null}

            {/* Endereço */}
            <InsetGroupedSection header="ENDEREÇO">
              <InsetRow
                label="Rua"
                rightContent={
                  <TextInput
                    ref={refs.rua}
                    style={styles.inlineInput}
                    value={form.rua}
                    onChangeText={(v) => updateField('rua', v)}
                    placeholder="Rua das Flores"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => refs.numero?.current?.focus()}
                  />
                }
              />
              <InsetRow
                label="Nº"
                rightContent={
                  <TextInput
                    ref={refs.numero}
                    style={styles.inlineInput}
                    value={form.numero}
                    onChangeText={(v) => updateField('numero', v)}
                    placeholder="123"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    returnKeyType="next"
                    onSubmitEditing={() => refs.complemento?.current?.focus()}
                  />
                }
              />
              <InsetRow
                label="Complemento"
                rightContent={
                  <TextInput
                    ref={refs.complemento}
                    style={styles.inlineInput}
                    value={form.complemento}
                    onChangeText={(v) => updateField('complemento', v)}
                    placeholder="Apto, bloco…"
                    placeholderTextColor={colors.textMuted}
                    returnKeyType="next"
                    onSubmitEditing={() => refs.bairro?.current?.focus()}
                  />
                }
              />
              <InsetRow
                label="Bairro"
                rightContent={
                  <TextInput
                    ref={refs.bairro}
                    style={styles.inlineInput}
                    value={form.bairro}
                    onChangeText={(v) => updateField('bairro', v)}
                    placeholder="Centro"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => refs.cidade?.current?.focus()}
                  />
                }
              />
              <InsetRow
                label="Cidade"
                rightContent={
                  <TextInput
                    ref={refs.cidade}
                    style={styles.inlineInput}
                    value={form.cidade}
                    onChangeText={(v) => updateField('cidade', v)}
                    placeholder="São Paulo"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => refs.estado?.current?.focus()}
                  />
                }
              />
              <InsetRow
                label="UF"
                rightContent={
                  <TextInput
                    ref={refs.estado}
                    style={styles.inlineInput}
                    value={form.estado}
                    onChangeText={(v) => updateField('estado', v)}
                    placeholder="SP"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    returnKeyType="next"
                    onSubmitEditing={() => refs.cep?.current?.focus()}
                  />
                }
              />
              <InsetRow
                label="CEP"
                rightContent={
                  <TextInput
                    ref={refs.cep}
                    style={styles.inlineInput}
                    value={form.cep}
                    onChangeText={(v) => updateField('cep', formatCEP(v))}
                    placeholder="00000-000"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                    returnKeyType="next"
                    onSubmitEditing={() => refs.contatoNome?.current?.focus()}
                  />
                }
                last
              />
            </InsetGroupedSection>

            {/* Contato de emergência */}
            <InsetGroupedSection header="CONTATO DE EMERGÊNCIA">
              <InsetRow
                label="Nome"
                rightContent={
                  <TextInput
                    ref={refs.contatoNome}
                    style={styles.inlineInput}
                    value={form.contatoNome}
                    onChangeText={(v) => updateField('contatoNome', v)}
                    placeholder="Maria da Silva"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => refs.contatoParentesco?.current?.focus()}
                  />
                }
              />
              <InsetRow
                label="Parentesco"
                rightContent={
                  <TextInput
                    ref={refs.contatoParentesco}
                    style={styles.inlineInput}
                    value={form.contatoParentesco}
                    onChangeText={(v) => updateField('contatoParentesco', v)}
                    placeholder="Filha, Cônjuge…"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => refs.contatoTelefone?.current?.focus()}
                  />
                }
              />
              <InsetRow
                label="Telefone"
                rightContent={
                  <TextInput
                    ref={refs.contatoTelefone}
                    style={styles.inlineInput}
                    value={form.contatoTelefone}
                    onChangeText={(v) => updateField('contatoTelefone', formatPhone(v))}
                    placeholder="(11) 90000-0000"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                  />
                }
                last
              />
            </InsetGroupedSection>

            {/* Tipo de atendimento — SegmentedControl */}
            <InsetGroupedSection header="TIPO DE ATENDIMENTO">
              <View style={styles.segmentedContainer}>
                <SegmentedControl
                  options={ATENDIMENTO_SEGMENTS}
                  selectedKey={form.tipoAtendimento || ''}
                  onSelect={(key) => updateField('tipoAtendimento', key)}
                  accentColor={colors.primary}
                />
              </View>
            </InsetGroupedSection>
            {errors.tipoAtendimento ? <Text style={styles.errorText}>{errors.tipoAtendimento}</Text> : null}

            {/* Dados clínicos */}
            <InsetGroupedSection header="DADOS CLÍNICOS">
              <InsetRow
                label="Diagnósticos"
                rightContent={
                  <TextInput
                    ref={refs.diagnosticos}
                    style={styles.inlineInput}
                    value={form.diagnosticos}
                    onChangeText={(v) => updateField('diagnosticos', v)}
                    placeholder="Alzheimer, HAS…"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="sentences"
                    returnKeyType="next"
                    onSubmitEditing={() => refs.alergias?.current?.focus()}
                  />
                }
              />
              <InsetRow
                label="Alergias"
                rightContent={
                  <TextInput
                    ref={refs.alergias}
                    style={styles.inlineInput}
                    value={form.alergias}
                    onChangeText={(v) => updateField('alergias', v)}
                    placeholder="Dipirona, Látex…"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="sentences"
                    returnKeyType="next"
                    onSubmitEditing={() => refs.medicamentosEmUso?.current?.focus()}
                  />
                }
              />
              <InsetRow
                label="Medicamentos"
                rightContent={
                  <TextInput
                    ref={refs.medicamentosEmUso}
                    style={styles.inlineInput}
                    value={form.medicamentosEmUso}
                    onChangeText={(v) => updateField('medicamentosEmUso', v)}
                    placeholder="Losartana 50mg…"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="sentences"
                  />
                }
                last
              />
            </InsetGroupedSection>
            <Text style={styles.hintText}>Separe itens com vírgula</Text>

            {/* Observações */}
            <InsetGroupedSection header="OBSERVAÇÕES">
              <View style={styles.textAreaContainer}>
                <TextInput
                  ref={refs.observacoes}
                  style={styles.textArea}
                  value={form.observacoes}
                  onChangeText={(v) => updateField('observacoes', v)}
                  placeholder="Informações adicionais sobre o paciente…"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="sentences"
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </InsetGroupedSection>

            {/* Perfil de sinais vitais — SegmentedControl */}
            <InsetGroupedSection header="PERFIL DE SINAIS VITAIS">
              <View style={styles.segmentedContainer}>
                <SegmentedControl
                  options={PRESET_SEGMENTS}
                  selectedKey={selectedPreset}
                  onSelect={(key) => {
                    const preset = VITAL_SIGNS_PRESETS.find((p) => p.key === key);
                    if (preset) {
                      setSelectedPreset(preset.key);
                      setCustomRanges(preset.ranges);
                    }
                  }}
                  accentColor={colors.primary}
                />
              </View>
              <Text style={styles.presetHint}>
                {VITAL_SIGNS_PRESETS.find((p) => p.key === selectedPreset)?.descricao}
              </Text>
              <VitalRow label="PA Sistólica" min={customRanges.paSistolicaMin} max={customRanges.paSistolicaMax} unit="mmHg" />
              <VitalRow label="PA Diastólica" min={customRanges.paDiastolicaMin} max={customRanges.paDiastolicaMax} unit="mmHg" />
              <VitalRow label="Freq. Cardíaca" min={customRanges.fcMin} max={customRanges.fcMax} unit="bpm" />
              <VitalRow label="Freq. Respiratória" min={customRanges.frMin} max={customRanges.frMax} unit="irpm" />
              <VitalRow label="Temperatura" min={customRanges.tempMin} max={customRanges.tempMax} unit="°C" />
              <VitalRow label="SpO₂ mínima" min={customRanges.satO2Min} unit="%" last />
            </InsetGroupedSection>

            <View style={styles.rangesNote}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
              <Text style={styles.rangesNoteText}>
                Valores podem ser ajustados depois no detalhe do paciente.
              </Text>
            </View>

            {errors.general ? (
              <Text style={styles.generalError}>{errors.general}</Text>
            ) : null}
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

// Sub-component for vital signs display
const VitalRow = ({ label, min, max, unit, last }: { label: string; min: number; max?: number; unit: string; last?: boolean }) => (
  <View style={[vitalStyles.row, !last && vitalStyles.rowBorder]}>
    <Text style={vitalStyles.label}>{label}</Text>
    <View style={vitalStyles.values}>
      <Text style={vitalStyles.value}>{min}</Text>
      {max != null && (
        <>
          <Text style={vitalStyles.dash}>–</Text>
          <Text style={vitalStyles.value}>{max}</Text>
        </>
      )}
      <Text style={vitalStyles.unit}>{unit}</Text>
    </View>
  </View>
);

const vitalStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  values: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  value: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  dash: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  unit: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginLeft: 2,
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  inlineInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    textAlign: 'right',
    paddingVertical: 0,
  },
  segmentedContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  pickerContainer: {
    paddingBottom: spacing.sm,
  },
  textAreaContainer: {
    padding: spacing.md,
  },
  textArea: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    minHeight: 80,
    paddingVertical: 0,
  },
  hintText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    marginLeft: spacing.sm,
  },
  presetHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    marginLeft: spacing.sm,
  },
  generalError: {
    color: colors.error,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  rangesNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  rangesNoteText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    flex: 1,
  },
});
