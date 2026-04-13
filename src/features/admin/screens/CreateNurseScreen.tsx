import { useState, useRef } from 'react';
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
import * as adminUserService from '../../../core/services/adminUserService';
import type { RootStackParamList } from '../../../core/navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'CreateNurse'>;

interface FormState {
  nome: string;
  email: string;
  telefone: string;
  coren: string;
  password: string;
}

interface FormErrors {
  nome?: string;
  email?: string;
  telefone?: string;
  password?: string;
  general?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const CreateNurseScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { user } = useAuthStore();

  const [form, setForm] = useState<FormState>({
    nome: '',
    email: '',
    telefone: '',
    coren: '',
    password: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [focused, setFocused] = useState<keyof FormState | null>(null);

  const emailRef = useRef<TextInput>(null);
  const telefoneRef = useRef<TextInput>(null);
  const corenRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [key]: undefined, general: undefined }));
    }
  };

  const validate = (): boolean => {
    const next: FormErrors = {};

    if (!form.nome.trim()) next.nome = 'Informe o nome completo';
    if (!form.email.trim()) {
      next.email = 'Informe o e-mail';
    } else if (!EMAIL_REGEX.test(form.email.trim())) {
      next.email = 'E-mail inválido';
    }
    if (!form.telefone.trim()) next.telefone = 'Informe o telefone';
    if (form.password.length < 8) {
      next.password = 'A senha deve ter ao menos 8 caracteres';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const mapFirebaseError = (code: string): string => {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'Já existe uma conta com este e-mail';
      case 'auth/invalid-email':
        return 'E-mail inválido';
      case 'auth/weak-password':
        return 'Senha muito fraca';
      case 'auth/network-request-failed':
        return 'Falha de rede. Verifique sua conexão';
      default:
        return 'Não foi possível criar a conta. Tente novamente';
    }
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
      await adminUserService.createNurseAccount({
        nome: form.nome.trim(),
        email: form.email.trim().toLowerCase(),
        telefone: form.telefone.trim(),
        coren: form.coren.trim() || undefined,
        password: form.password,
        empresaId: user.empresaId,
      });

      Alert.alert(
        'Conta criada',
        `A conta de ${form.nome.trim()} foi criada com sucesso. Informe ao enfermeiro o e-mail e a senha temporária.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      setErrors({ general: mapFirebaseError(code) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (
    key: keyof FormState,
    label: string,
    options: {
      placeholder: string;
      keyboardType?: 'default' | 'email-address' | 'phone-pad';
      autoCapitalize?: 'none' | 'words';
      textContentType?: 'name' | 'emailAddress' | 'telephoneNumber' | 'newPassword' | 'none';
      secureTextEntry?: boolean;
      ref?: React.RefObject<TextInput | null>;
      onSubmitEditing?: () => void;
      returnKeyType?: 'next' | 'done';
      optional?: boolean;
    }
  ) => {
    const error = errors[key as keyof FormErrors];
    const isFocused = focused === key;

    return (
      <View style={styles.field}>
        <Text style={styles.label}>
          {label}
          {options.optional ? <Text style={styles.optional}> (opcional)</Text> : null}
        </Text>
        <TextInput
          ref={options.ref}
          value={form[key]}
          onChangeText={(value) => updateField(key, value)}
          placeholder={options.placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={options.keyboardType ?? 'default'}
          autoCapitalize={options.autoCapitalize ?? 'none'}
          autoCorrect={false}
          textContentType={options.textContentType ?? 'none'}
          secureTextEntry={options.secureTextEntry}
          returnKeyType={options.returnKeyType ?? 'next'}
          onSubmitEditing={options.onSubmitEditing}
          onFocus={() => setFocused(key)}
          onBlur={() => setFocused(null)}
          style={[
            styles.input,
            isFocused && styles.inputFocused,
            error && styles.inputError,
          ]}
          editable={!isSubmitting}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
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
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                style={styles.backButton}
                hitSlop={8}
              >
                <Text style={styles.backText}>Cancelar</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.title}>Novo enfermeiro</Text>
            <Text style={styles.subtitle}>
              Cadastre uma conta de enfermeiro. O profissional usará o e-mail e a senha
              temporária para entrar no app.
            </Text>

            <View style={styles.form}>
              {renderField('nome', 'Nome completo', {
                placeholder: 'Ex.: Maria da Silva',
                autoCapitalize: 'words',
                textContentType: 'name',
                onSubmitEditing: () => emailRef.current?.focus(),
              })}

              {renderField('email', 'E-mail', {
                placeholder: 'enfermeiro@exemplo.com',
                keyboardType: 'email-address',
                textContentType: 'emailAddress',
                ref: emailRef,
                onSubmitEditing: () => telefoneRef.current?.focus(),
              })}

              {renderField('telefone', 'Telefone', {
                placeholder: '(11) 90000-0000',
                keyboardType: 'phone-pad',
                textContentType: 'telephoneNumber',
                ref: telefoneRef,
                onSubmitEditing: () => corenRef.current?.focus(),
              })}

              {renderField('coren', 'COREN', {
                placeholder: 'Ex.: COREN-SP 123456',
                autoCapitalize: 'none',
                ref: corenRef,
                optional: true,
                onSubmitEditing: () => passwordRef.current?.focus(),
              })}

              {renderField('password', 'Senha temporária', {
                placeholder: 'Mínimo 8 caracteres',
                textContentType: 'newPassword',
                secureTextEntry: true,
                ref: passwordRef,
                returnKeyType: 'done',
                onSubmitEditing: handleSubmit,
              })}

              {errors.general ? (
                <Text style={styles.generalError}>{errors.general}</Text>
              ) : null}
            </View>
          </ScrollView>

          <View
            style={[
              styles.actionArea,
              { paddingBottom: insets.bottom + spacing.lg },
            ]}
          >
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitText}>Criar conta</Text>
              )}
            </TouchableOpacity>
          </View>
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
  inputFocused: {
    borderColor: colors.primary,
  },
  inputError: {
    borderColor: colors.error,
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
