import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as empresaService from '../../../core/services/empresaService';
import { FormInput } from '../../../shared/components/ui';

interface FormState {
  nome: string;
  cnpj: string;
  cidade: string;
}

interface FormErrors {
  nome?: string;
  general?: string;
}

export const SetupEmpresaScreen = () => {
  const insets = useSafeAreaInsets();
  const { user, setUser } = useAuthStore();

  const [form, setForm] = useState<FormState>({ nome: '', cnpj: '', cidade: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cnpjRef = useRef<TextInput>(null);
  const cidadeRef = useRef<TextInput>(null);

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'nome' && errors.nome) {
      setErrors((prev) => ({ ...prev, nome: undefined, general: undefined }));
    }
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!form.nome.trim()) {
      setErrors({ nome: 'Informe o nome da empresa' });
      return;
    }
    if (!user?.uid) {
      setErrors({ general: 'Sessão inválida. Faça login novamente.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { empresaId } = await empresaService.createEmpresa({
        nome: form.nome.trim(),
        cnpj: form.cnpj.trim() || undefined,
        cidade: form.cidade.trim() || undefined,
        adminUid: user.uid,
      });

      // Atualiza o user em memória para que RootNavigator re-renderize
      // e deixe o admin entrar no painel principal.
      setUser({ ...user, empresaId, updatedAt: new Date() });
    } catch (error) {
      console.error('Erro ao criar empresa:', error);
      setErrors({ general: 'Não foi possível criar a empresa. Tente novamente.' });
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
              { paddingTop: insets.top + spacing.xl, paddingBottom: spacing.xxl },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Vamos configurar sua empresa</Text>
            <Text style={styles.subtitle}>
              Para começar, identifique a empresa que você administra. Você poderá
              cadastrar enfermeiros e famílias ligados a ela.
            </Text>

            <View style={styles.form}>
              <FormInput
                label="Nome da empresa"
                value={form.nome}
                onChangeText={(v) => updateField('nome', v)}
                placeholder="Ex.: Clínica Cuidar Bem"
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => cnpjRef.current?.focus()}
                editable={!isSubmitting}
                error={errors.nome}
              />

              <FormInput
                ref={cnpjRef}
                label="CNPJ"
                optional
                value={form.cnpj}
                onChangeText={(v) => updateField('cnpj', v)}
                placeholder="00.000.000/0000-00"
                autoCapitalize="none"
                keyboardType="numeric"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => cidadeRef.current?.focus()}
                editable={!isSubmitting}
              />

              <FormInput
                ref={cidadeRef}
                label="Cidade"
                optional
                value={form.cidade}
                onChangeText={(v) => updateField('cidade', v)}
                placeholder="Ex.: São Paulo"
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                editable={!isSubmitting}
              />

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
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
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
