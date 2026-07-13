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
import type { TeamStackParamList } from '../../../core/navigation/RootNavigator';
import { PasswordInput } from '../../../shared/components/PasswordInput';
import { FormInput } from '../../../shared/components/ui';
import { formatPhone, EMAIL_REGEX } from '../../../shared/utils/formatters';
import { mapAuthError } from '../../../shared/utils/authErrors';

type NavProp = NativeStackNavigationProp<TeamStackParamList, 'CreateNurse'>;

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
      setErrors({ general: mapAuthError(code, 'Não foi possível criar a conta. Tente novamente') });
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
              <FormInput
                label="Nome completo"
                value={form.nome}
                onChangeText={(v) => updateField('nome', v)}
                placeholder="Ex.: Maria da Silva"
                autoCapitalize="words"
                autoCorrect={false}
                textContentType="name"
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                editable={!isSubmitting}
                error={errors.nome}
              />

              <FormInput
                ref={emailRef}
                label="E-mail"
                value={form.email}
                onChangeText={(v) => updateField('email', v)}
                placeholder="enfermeiro@exemplo.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="emailAddress"
                returnKeyType="next"
                onSubmitEditing={() => telefoneRef.current?.focus()}
                editable={!isSubmitting}
                error={errors.email}
              />

              <FormInput
                ref={telefoneRef}
                label="Telefone"
                value={form.telefone}
                onChangeText={(v) => updateField('telefone', formatPhone(v))}
                placeholder="(11) 90000-0000"
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="telephoneNumber"
                returnKeyType="next"
                onSubmitEditing={() => corenRef.current?.focus()}
                editable={!isSubmitting}
                error={errors.telefone}
              />

              <FormInput
                ref={corenRef}
                label="COREN"
                optional
                value={form.coren}
                onChangeText={(v) => updateField('coren', v)}
                placeholder="Ex.: COREN-SP 123456"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!isSubmitting}
              />

              <View style={styles.field}>
                <Text style={styles.label}>Senha temporária</Text>
                <PasswordInput
                  ref={passwordRef}
                  value={form.password}
                  onChangeText={(value) => updateField('password', value)}
                  placeholder="Mínimo 8 caracteres"
                  textContentType="newPassword"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                  isFocused={focused === 'password'}
                  hasError={!!errors.password}
                  editable={!isSubmitting}
                />
                {errors.password ? (
                  <Text style={styles.errorText}>{errors.password}</Text>
                ) : null}
              </View>

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
