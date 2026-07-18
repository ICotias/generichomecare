/**
 * Cadastro aberto.
 *
 * Cria a conta no Auth e o perfil no Firestore SEM tenant (`empresaId: ''`).
 * Quem decide o que a pessoa é vem depois, no SetupEmpresaScreen: aqui não
 * perguntamos, para não repetir a mesma pergunta em duas telas.
 *
 * O `role: 'family'` gravado aqui é só um valor inerte para o documento nascer
 * válido. Sem empresaId, papel nenhum abre dado (toda regra exige
 * belongsToCompany), e o Setup grava o papel de verdade logo em seguida.
 */
import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';

import { auth, db } from '../../core/config/firebase';
import { Collections } from '../constants/firestore';
import { colors, spacing, fontSize, borderRadius } from '../../core/theme/theme';
import { FormInput } from '../components/ui';
import { PasswordInput } from '../components/PasswordInput';
import { formatPhone, EMAIL_REGEX } from '../utils/formatters';
import { mapAuthError } from '../utils/authErrors';

interface FormState {
  nome: string;
  email: string;
  telefone: string;
  password: string;
}

interface FormErrors {
  nome?: string;
  email?: string;
  telefone?: string;
  password?: string;
  general?: string;
}

export const SignUpScreen = ({ onBack }: { onBack: () => void }) => {
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState<FormState>({
    nome: '',
    email: '',
    telefone: '',
    password: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const telefoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined, general: undefined }));
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.nome.trim()) next.nome = 'Informe o seu nome completo';
    if (!form.email.trim()) {
      next.email = 'Informe o e-mail';
    } else if (!EMAIL_REGEX.test(form.email.trim())) {
      next.email = 'E-mail inválido';
    }
    if (!form.telefone.trim()) next.telefone = 'Informe o telefone';
    if (form.password.length < 8) next.password = 'A senha deve ter ao menos 8 caracteres';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        form.email.trim().toLowerCase(),
        form.password
      );

      const now = Timestamp.now();
      await setDoc(doc(db, Collections.USUARIOS, cred.user.uid), {
        uid: cred.user.uid,
        email: form.email.trim().toLowerCase(),
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        role: 'family',
        empresaId: '',
        familiaTitular: true,
        status: 'ativo',
        createdAt: now,
        updatedAt: now,
      });

      // Sem navegação: o createUserWithEmailAndPassword já autentica, o
      // onAuthStateChanged carrega o perfil e o RootNavigator manda para o
      // Setup (conta sem tenant).
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      setErrors({
        general: mapAuthError(code, 'Não foi possível criar a conta. Tente novamente'),
      });
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
            <TouchableOpacity onPress={onBack} style={styles.backRow} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color={colors.primary} />
              <Text style={styles.backText}>Entrar</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Criar conta</Text>
            <Text style={styles.subtitle}>
              No próximo passo você diz se administra uma empresa de cuidado ou se
              cuida de alguém da sua família.
            </Text>

            <View style={styles.form}>
              <FormInput
                label="Nome completo"
                value={form.nome}
                onChangeText={(v) => updateField('nome', v)}
                placeholder="Como você se chama"
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
                placeholder="voce@exemplo.com"
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
                placeholder="(00) 00000-0000"
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="telephoneNumber"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!isSubmitting}
                error={errors.telefone}
              />

              <View style={styles.field}>
                <Text style={styles.label}>Senha</Text>
                <PasswordInput
                  ref={passwordRef}
                  value={form.password}
                  onChangeText={(v) => updateField('password', v)}
                  placeholder="Mínimo 8 caracteres"
                  textContentType="newPassword"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  isFocused={passwordFocused}
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
                <Text style={styles.submitText}>Continuar</Text>
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
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: spacing.md,
  },
  backText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '500' },
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
  form: { marginTop: spacing.xl },
  field: { marginBottom: spacing.md },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs + 2,
  },
  errorText: { color: colors.error, fontSize: fontSize.xs, marginTop: spacing.xs },
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
  submitButtonDisabled: { opacity: 0.6 },
  submitText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
