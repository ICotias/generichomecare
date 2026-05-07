import { useState, useRef, useCallback } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as patientService from '../../../core/services/patientService';
import type { PatientMgmtStackParamList } from '../../../core/navigation/RootNavigator';
import type { Patient } from '../../../core/types';

type NavProp = NativeStackNavigationProp<PatientMgmtStackParamList, 'CreatePatient'>;

// ════════════════════════════════════════════
// Form state
// ════════════════════════════════════════════

interface FormState {
  // Dados pessoais
  nome: string;
  dataNascimento: string; // DD/MM/AAAA — convertido para Date no submit
  cpf: string;
  genero: Patient['genero'] | '';

  // Endereço
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;

  // Contato de emergência
  contatoNome: string;
  contatoParentesco: string;
  contatoTelefone: string;

  // Clínico
  diagnosticos: string;
  alergias: string;
  medicamentosEmUso: string;
  tipoAtendimento: Patient['tipoAtendimento'] | '';
  observacoes: string;
}

interface FormErrors {
  [key: string]: string | undefined;
}

const GENERO_OPTIONS: { value: Patient['genero']; label: string }[] = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'feminino', label: 'Feminino' },
  { value: 'outro', label: 'Outro' },
];

const ATENDIMENTO_OPTIONS: { value: Patient['tipoAtendimento']; label: string }[] = [
  { value: 'integral', label: '24h' },
  { value: 'diurno', label: 'Diurno' },
  { value: 'noturno', label: 'Noturno' },
  { value: 'visita', label: 'Visita' },
];

const CPF_REGEX = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
const DATE_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;

// ════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════

const formatCPF = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const formatDate = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const formatCEP = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const parseDate = (str: string): Date | null => {
  if (!DATE_REGEX.test(str)) return null;
  const [dd, mm, yyyy] = str.split('/').map(Number);
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return d;
};

const splitCSV = (str: string): string[] =>
  str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

// ════════════════════════════════════════════
// Component
// ════════════════════════════════════════════

export const CreatePatientScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { user } = useAuthStore();

  const [form, setForm] = useState<FormState>({
    nome: '',
    dataNascimento: '',
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
  const [focused, setFocused] = useState<string | null>(null);

  // Refs para navegação entre campos
  const refs: Record<string, React.RefObject<TextInput | null>> = {
    dataNascimento: useRef<TextInput>(null),
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
    (key: string, value: string) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      if (errors[key]) {
        setErrors((prev) => ({ ...prev, [key]: undefined, general: undefined }));
      }
    },
    [errors]
  );

  // ── Validation ──
  const validate = (): boolean => {
    const e: FormErrors = {};

    if (!form.nome.trim()) e.nome = 'Informe o nome completo';

    const parsedDate = parseDate(form.dataNascimento);
    if (!form.dataNascimento.trim()) {
      e.dataNascimento = 'Informe a data de nascimento';
    } else if (!parsedDate) {
      e.dataNascimento = 'Data inválida (DD/MM/AAAA)';
    } else if (parsedDate > new Date()) {
      e.dataNascimento = 'Data não pode ser futura';
    }

    if (!form.cpf.trim()) {
      e.cpf = 'Informe o CPF';
    } else if (!CPF_REGEX.test(form.cpf)) {
      e.cpf = 'CPF inválido (000.000.000-00)';
    }

    if (!form.genero) e.genero = 'Selecione o gênero';

    // Endereço mínimo
    if (!form.rua.trim()) e.rua = 'Informe a rua';
    if (!form.numero.trim()) e.numero = 'Nº obrigatório';
    if (!form.bairro.trim()) e.bairro = 'Informe o bairro';
    if (!form.cidade.trim()) e.cidade = 'Informe a cidade';
    if (!form.estado.trim()) e.estado = 'Informe o estado';

    // Contato emergência
    if (!form.contatoNome.trim()) e.contatoNome = 'Informe o nome do contato';
    if (!form.contatoTelefone.trim()) e.contatoTelefone = 'Informe o telefone';

    // Clínico
    if (!form.tipoAtendimento) e.tipoAtendimento = 'Selecione o tipo';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ──
  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!validate()) return;

    if (!user?.empresaId) {
      setErrors({ general: 'Administrador sem empresa vinculada' });
      return;
    }

    setIsSubmitting(true);
    try {
      await patientService.createPatient(user.empresaId, {
        nome: form.nome.trim(),
        dataNascimento: parseDate(form.dataNascimento)!,
        cpf: form.cpf.trim(),
        genero: form.genero as Patient['genero'],
        endereco: {
          rua: form.rua.trim(),
          numero: form.numero.trim(),
          complemento: form.complemento.trim() || undefined,
          bairro: form.bairro.trim(),
          cidade: form.cidade.trim(),
          estado: form.estado.trim().toUpperCase(),
          cep: form.cep.trim(),
        },
        contatoEmergencia: {
          nome: form.contatoNome.trim(),
          parentesco: form.contatoParentesco.trim(),
          telefone: form.contatoTelefone.trim(),
        },
        diagnosticos: splitCSV(form.diagnosticos),
        alergias: splitCSV(form.alergias),
        medicamentosEmUso: splitCSV(form.medicamentosEmUso) || undefined,
        tipoAtendimento: form.tipoAtendimento as Patient['tipoAtendimento'],
        observacoes: form.observacoes.trim() || undefined,
        faixaSinaisVitais: patientService.DEFAULT_VITAL_SIGNS,
      });

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

  // ── Shared field renderer ──
  const renderField = (
    key: string,
    label: string,
    opts: {
      placeholder: string;
      keyboardType?: 'default' | 'numeric' | 'phone-pad';
      autoCapitalize?: 'none' | 'words' | 'characters' | 'sentences';
      ref?: React.RefObject<TextInput | null>;
      nextRef?: React.RefObject<TextInput | null>;
      optional?: boolean;
      formatter?: (raw: string) => string;
      multiline?: boolean;
      hint?: string;
    } = { placeholder: '' }
  ) => {
    const error = errors[key];
    const isFocused = focused === key;

    return (
      <View style={styles.field} key={key}>
        <Text style={styles.label}>
          {label}
          {opts.optional ? <Text style={styles.optional}> (opcional)</Text> : null}
        </Text>
        <TextInput
          ref={opts.ref ?? refs[key]}
          value={(form as unknown as Record<string, string>)[key]}
          onChangeText={(v) => updateField(key, opts.formatter ? opts.formatter(v) : v)}
          placeholder={opts.placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={opts.keyboardType ?? 'default'}
          autoCapitalize={opts.autoCapitalize ?? 'none'}
          autoCorrect={false}
          returnKeyType={opts.nextRef ? 'next' : 'done'}
          onSubmitEditing={() => opts.nextRef?.current?.focus()}
          onFocus={() => setFocused(key)}
          onBlur={() => setFocused(null)}
          multiline={opts.multiline}
          textAlignVertical={opts.multiline ? 'top' : 'center'}
          style={[
            styles.input,
            opts.multiline && styles.inputMultiline,
            isFocused && styles.inputFocused,
            error && styles.inputError,
          ]}
          editable={!isSubmitting}
        />
        {opts.hint && !error ? <Text style={styles.hintText}>{opts.hint}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  };

  // ── Option selector (chip-style) ──
  const renderChipSelector = <T extends string>(
    key: string,
    label: string,
    options: { value: T; label: string }[],
    error?: string
  ) => (
    <View style={styles.field} key={key}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((opt) => {
          const isActive = (form as unknown as Record<string, string>)[key] === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => updateField(key, opt.value)}
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

  // ── Section header ──
  const renderSection = (title: string) => (
    <Text style={styles.sectionTitle}>{title}</Text>
  );

  // ════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════

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
            {/* Header */}
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.backButton}
                hitSlop={8}
              >
                <Text style={styles.backText}>Cancelar</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.title}>Novo paciente</Text>
            <Text style={styles.subtitle}>
              Preencha os dados do paciente para cadastrá-lo no sistema. Os campos de sinais
              vitais usarão valores-padrão que podem ser ajustados depois.
            </Text>

            <View style={styles.form}>
              {/* ── Dados pessoais ── */}
              {renderSection('Dados pessoais')}

              {renderField('nome', 'Nome completo', {
                placeholder: 'Ex.: João da Silva',
                autoCapitalize: 'words',
                nextRef: refs.dataNascimento,
              })}

              {renderField('dataNascimento', 'Data de nascimento', {
                placeholder: 'DD/MM/AAAA',
                keyboardType: 'numeric',
                ref: refs.dataNascimento,
                nextRef: refs.cpf,
                formatter: formatDate,
              })}

              {renderField('cpf', 'CPF', {
                placeholder: '000.000.000-00',
                keyboardType: 'numeric',
                ref: refs.cpf,
                formatter: formatCPF,
              })}

              {renderChipSelector('genero', 'Gênero', GENERO_OPTIONS, errors.genero)}

              {/* ── Endereço ── */}
              {renderSection('Endereço')}

              {renderField('rua', 'Rua', {
                placeholder: 'Ex.: Rua das Flores',
                autoCapitalize: 'words',
                ref: refs.rua,
                nextRef: refs.numero,
              })}

              <View style={styles.row}>
                <View style={styles.rowSmall}>
                  {renderField('numero', 'Nº', {
                    placeholder: '123',
                    keyboardType: 'numeric',
                    ref: refs.numero,
                    nextRef: refs.complemento,
                  })}
                </View>
                <View style={styles.rowLarge}>
                  {renderField('complemento', 'Complemento', {
                    placeholder: 'Apto, bloco…',
                    ref: refs.complemento,
                    nextRef: refs.bairro,
                    optional: true,
                  })}
                </View>
              </View>

              {renderField('bairro', 'Bairro', {
                placeholder: 'Ex.: Centro',
                autoCapitalize: 'words',
                ref: refs.bairro,
                nextRef: refs.cidade,
              })}

              <View style={styles.row}>
                <View style={styles.rowLarge}>
                  {renderField('cidade', 'Cidade', {
                    placeholder: 'Ex.: São Paulo',
                    autoCapitalize: 'words',
                    ref: refs.cidade,
                    nextRef: refs.estado,
                  })}
                </View>
                <View style={styles.rowSmall}>
                  {renderField('estado', 'UF', {
                    placeholder: 'SP',
                    autoCapitalize: 'characters',
                    ref: refs.estado,
                    nextRef: refs.cep,
                  })}
                </View>
              </View>

              {renderField('cep', 'CEP', {
                placeholder: '00000-000',
                keyboardType: 'numeric',
                ref: refs.cep,
                nextRef: refs.contatoNome,
                formatter: formatCEP,
                optional: true,
              })}

              {/* ── Contato de emergência ── */}
              {renderSection('Contato de emergência')}

              {renderField('contatoNome', 'Nome', {
                placeholder: 'Ex.: Maria da Silva',
                autoCapitalize: 'words',
                ref: refs.contatoNome,
                nextRef: refs.contatoParentesco,
              })}

              {renderField('contatoParentesco', 'Parentesco', {
                placeholder: 'Ex.: Filha, Cônjuge',
                autoCapitalize: 'words',
                ref: refs.contatoParentesco,
                nextRef: refs.contatoTelefone,
                optional: true,
              })}

              {renderField('contatoTelefone', 'Telefone', {
                placeholder: '(11) 90000-0000',
                keyboardType: 'phone-pad',
                ref: refs.contatoTelefone,
              })}

              {/* ── Dados clínicos ── */}
              {renderSection('Dados clínicos')}

              {renderChipSelector(
                'tipoAtendimento',
                'Tipo de atendimento',
                ATENDIMENTO_OPTIONS,
                errors.tipoAtendimento
              )}

              {renderField('diagnosticos', 'Diagnósticos', {
                placeholder: 'Ex.: Alzheimer, HAS, DM2',
                autoCapitalize: 'sentences',
                ref: refs.diagnosticos,
                nextRef: refs.alergias,
                hint: 'Separe com vírgula',
                optional: true,
              })}

              {renderField('alergias', 'Alergias', {
                placeholder: 'Ex.: Dipirona, Látex',
                autoCapitalize: 'sentences',
                ref: refs.alergias,
                nextRef: refs.medicamentosEmUso,
                hint: 'Separe com vírgula',
                optional: true,
              })}

              {renderField('medicamentosEmUso', 'Medicamentos em uso', {
                placeholder: 'Ex.: Losartana 50mg, Metformina 850mg',
                autoCapitalize: 'sentences',
                ref: refs.medicamentosEmUso,
                nextRef: refs.observacoes,
                hint: 'Separe com vírgula',
                optional: true,
              })}

              {renderField('observacoes', 'Observações', {
                placeholder: 'Informações adicionais sobre o paciente…',
                autoCapitalize: 'sentences',
                ref: refs.observacoes,
                optional: true,
                multiline: true,
              })}

              {errors.general ? (
                <Text style={styles.generalError}>{errors.general}</Text>
              ) : null}
            </View>
          </ScrollView>

          {/* Submit button */}
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
                <Text style={styles.submitText}>Cadastrar paciente</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

// ════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: spacing.md,
  },
  backButton: {
    paddingVertical: spacing.xs,
  },
  backText: {
    color: colors.primary,
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.35,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  form: {
    marginTop: spacing.xl,
  },

  // Sections
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  // Fields
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs + 2,
  },
  optional: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  input: {
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  inputMultiline: {
    height: 100,
    paddingTop: spacing.md,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  inputError: {
    borderColor: colors.error,
  },
  hintText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
  generalError: {
    color: colors.error,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.md,
  },

  // Rows (side by side fields)
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowSmall: {
    flex: 1,
  },
  rowLarge: {
    flex: 2,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.white,
  },

  // Action Area
  actionArea: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  submitButton: {
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
