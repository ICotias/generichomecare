/**
 * Portão de quem tem conta mas ainda não tem tenant.
 *
 * É aqui que a pessoa diz o que ela é, e essa resposta define TUDO:
 *   Empresa  → role admin, cria a empresa, entra no painel de gestão
 *   Família  → role family, cria um tenant invisível, vai cadastrar o paciente
 *
 * O role vem da escolha, nunca do e-mail. O `inferRoleFromEmail` do useAuth é
 * só fallback de contas antigas criadas no Console: como agora existe cadastro
 * aberto, deixar o e-mail decidir o papel seria dar admin para quem escrevesse
 * "admin" no endereço.
 */
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
import { doc, updateDoc, Timestamp } from 'firebase/firestore';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { db } from '../../../core/config/firebase';
import { Collections } from '../../../shared/constants/firestore';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as empresaService from '../../../core/services/empresaService';
import type { UserRole } from '../../../core/types';
import { FormInput, SegmentedControl } from '../../../shared/components/ui';

type Perfil = 'empresa' | 'familia' | 'autonomo';

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

  const [perfil, setPerfil] = useState<Perfil>('empresa');
  const [form, setForm] = useState<FormState>({ nome: '', cnpj: '', cidade: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cnpjRef = useRef<TextInput>(null);
  const cidadeRef = useRef<TextInput>(null);

  const isEmpresa = perfil === 'empresa';
  const isAutonomo = perfil === 'autonomo';

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'nome' && errors.nome) {
      setErrors((prev) => ({ ...prev, nome: undefined, general: undefined }));
    }
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();

    if (!user?.uid) {
      setErrors({ general: 'Sessão inválida. Faça login novamente.' });
      return;
    }
    if (isEmpresa && !form.nome.trim()) {
      setErrors({ nome: 'Informe o nome da empresa' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEmpresa) {
        // O role precisa estar gravado ANTES de criar o tenant: as rules de
        // empresas leem getUserData().role para autorizar a criação.
        await setRole('admin', user.uid);
        const { empresaId } = await empresaService.createEmpresa({
          nome: form.nome.trim(),
          cnpj: form.cnpj.trim() || undefined,
          cidade: form.cidade.trim() || undefined,
          adminUid: user.uid,
        });
        setUser({ ...user, role: 'admin', empresaId, updatedAt: new Date() });
      } else if (isAutonomo) {
        // O papel continua 'nurse': tudo que ele faz em campo já funciona
        // nesse papel. Ser dono do tenant é o que destrava cadastrar paciente.
        await setRole('nurse', user.uid);
        const { empresaId } = await empresaService.createSoloTenant(
          user.uid,
          user.nome || 'Cuidador'
        );
        setUser({ ...user, role: 'nurse', empresaId, updatedAt: new Date() });
      } else {
        await setRole('family', user.uid);
        const { empresaId } = await empresaService.createFamilyTenant(
          user.uid,
          user.nome || 'Família'
        );
        setUser({ ...user, role: 'family', empresaId, updatedAt: new Date() });
      }
      // Sem navegação: o RootNavigator re-renderiza sozinho quando o user
      // ganha empresaId e vai para o destino certo do role.
    } catch (error) {
      console.error('Erro no setup:', error);
      setErrors({ general: 'Não foi possível concluir. Tente novamente.' });
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
            <Text style={styles.title}>Como você vai usar o Benevita?</Text>
            <Text style={styles.subtitle}>
              Isso define o que você vê no aplicativo. Escolha com calma, porque
              não dá para trocar depois.
            </Text>

            <View style={styles.segmentWrapper}>
              <SegmentedControl
                options={[
                  { key: 'empresa', label: 'Empresa' },
                  { key: 'autonomo', label: 'Cuidador' },
                  { key: 'familia', label: 'Família' },
                ]}
                selectedKey={perfil}
                onSelect={(k) => {
                  setPerfil(k as Perfil);
                  setErrors({});
                }}
              />
            </View>

            <View style={styles.explainer}>
              <Text style={styles.explainerText}>
                {isEmpresa
                  ? 'Você administra uma empresa de cuidado domiciliar. Vai cadastrar pacientes, montar a equipe de cuidadores, definir escalas e acompanhar o financeiro.'
                  : isAutonomo
                    ? 'Você atende por conta própria, sem empresa por trás. Vai cadastrar os seus pacientes, registrar o cuidado pelo celular e convidar a família de cada um para acompanhar.'
                    : 'Você cuida de alguém da sua família e quer centralizar as informações em um só lugar. Vai cadastrar o paciente, convidar o cuidador que já atende e acompanhar o cuidado no dia a dia.'}
              </Text>
            </View>

            {isEmpresa ? (
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
              </View>
            ) : (
              <View style={styles.form}>
                <Text style={styles.familyNote}>
                  Não precisamos de mais nada agora. No próximo passo você
                  cadastra a pessoa que recebe o cuidado.
                </Text>
              </View>
            )}

            {errors.general ? (
              <Text style={styles.generalError}>{errors.general}</Text>
            ) : null}
          </ScrollView>

          <View
            style={[styles.actionArea, { paddingBottom: insets.bottom + spacing.lg }]}
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

/** Grava o papel escolhido antes de criar o tenant (as rules dependem dele). */
const setRole = async (role: UserRole, uid: string): Promise<void> => {
  await updateDoc(doc(db, Collections.USUARIOS, uid), {
    role,
    updatedAt: Timestamp.now(),
  });
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
  segmentWrapper: {
    marginTop: spacing.xl,
  },
  explainer: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
  },
  explainerText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  form: {
    marginTop: spacing.xl,
  },
  familyNote: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 20,
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
