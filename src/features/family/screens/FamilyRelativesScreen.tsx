/**
 * A titular convida parentes para acompanhar o mesmo paciente.
 * Ex.: dois irmãos que cuidam da mãe.
 *
 * Só aparece para a TITULAR, e só no modo familiar (tenant próprio). Quando há
 * uma empresa por trás, é ela quem controla os acessos ao paciente dela: a
 * empresa é a cliente, é quem paga, e as telas dela já fazem isso.
 *
 * O convidado é acompanhante: lê a timeline, os sinais vitais e o histórico.
 * Não edita o paciente, não mexe no cuidador e não convida mais ninguém. É o
 * que mantém uma pessoa só respondendo pelo cadastro, e o que impede o convite
 * de virar corrente sem fim.
 */
import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as adminUserService from '../../../core/services/adminUserService';
import type { FamilyMember } from '../../../core/services/adminUserService';
import {
  ScreenHeader,
  FormInput,
  InsetGroupedSection,
  InsetRow,
  SelectionListModal,
} from '../../../shared/components/ui';
import { formatPhone, EMAIL_REGEX } from '../../../shared/utils/formatters';
import { mapAuthError } from '../../../shared/utils/authErrors';
import { PARENTESCO_OPTIONS } from '../../../shared/constants/parentesco';

interface FormState {
  nome: string;
  email: string;
  telefone: string;
  parentesco: string;
}

interface FormErrors {
  nome?: string;
  email?: string;
  telefone?: string;
  parentesco?: string;
  general?: string;
}

const EMPTY_FORM: FormState = { nome: '', email: '', telefone: '', parentesco: '' };

/** Sanitiza o telefone para wa.me (só dígitos, com DDI Brasil) */
const toWhatsappNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  return digits.length <= 11 ? `55${digits}` : digits;
};

const buildMessage = (nome: string, email: string, senha: string): string =>
  `Oi, ${nome}! Te dei acesso ao Benevita para você acompanhar o cuidado junto comigo.\n\n` +
  `E-mail: ${email}\nSenha temporária: ${senha}\n\n` +
  'No primeiro acesso o aplicativo pede para você trocar a senha.';

const sendWhatsapp = async (telefone: string, texto: string): Promise<void> => {
  const num = toWhatsappNumber(telefone);
  const text = encodeURIComponent(texto);
  const url = num ? `https://wa.me/${num}?text=${text}` : `https://wa.me/?text=${text}`;
  if (await Linking.canOpenURL(url)) {
    await Linking.openURL(url);
  } else {
    Alert.alert('WhatsApp indisponível', 'Não foi possível abrir o WhatsApp neste dispositivo.');
  }
};

export const FamilyRelativesScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [relatives, setRelatives] = useState<FamilyMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showParentescoPicker, setShowParentescoPicker] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const telefoneRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    if (!user?.empresaId || !user?.pacienteId) {
      setIsLoading(false);
      return;
    }
    try {
      const lista = await adminUserService.listFamilyByPatient(
        user.empresaId,
        user.pacienteId
      );
      // A própria titular não entra na lista de convidados.
      setRelatives(lista.filter((f) => f.uid !== user.uid));
    } catch (err) {
      console.error('FamilyRelatives load error', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.empresaId, user?.pacienteId, user?.uid]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const update = (key: keyof FormState, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    setErrors((p) => ({ ...p, [key]: undefined, general: undefined }));
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.nome.trim()) next.nome = 'Informe o nome';
    if (!form.email.trim()) {
      next.email = 'Informe o e-mail';
    } else if (!EMAIL_REGEX.test(form.email.trim())) {
      next.email = 'E-mail inválido';
    }
    if (!form.telefone.trim()) next.telefone = 'Informe o telefone';
    if (!form.parentesco) next.parentesco = 'Informe o parentesco com o paciente';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleInvite = async () => {
    Keyboard.dismiss();
    if (!validate()) return;
    if (!user?.empresaId || !user?.pacienteId) {
      setErrors({ general: 'Cadastre o paciente antes de convidar um parente.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { tempPassword } = await adminUserService.inviteRelativeAccount({
        nome: form.nome.trim(),
        email: form.email.trim().toLowerCase(),
        telefone: form.telefone.trim(),
        parentesco: form.parentesco,
        empresaId: user.empresaId,
        pacienteId: user.pacienteId,
      });

      const nome = form.nome.trim();
      const email = form.email.trim().toLowerCase();
      const telefone = form.telefone;

      setShowForm(false);
      setForm(EMPTY_FORM);
      await load();

      Alert.alert(
        'Parente convidado',
        `${nome} já pode entrar com:\n\nE-mail: ${email}\nSenha temporária: ${tempPassword}\n\n` +
          'No primeiro acesso ele troca a senha.',
        [
          { text: 'Depois', style: 'cancel' },
          {
            text: 'Enviar no WhatsApp',
            onPress: () => sendWhatsapp(telefone, buildMessage(nome, email, tempPassword)),
          },
        ]
      );
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      setErrors({
        general: mapAuthError(code, 'Não foi possível convidar. Tente novamente'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.family} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title="Familiares" subtitle="Quem acompanha" showBack />

        {!user?.pacienteId ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>
              Cadastre o paciente primeiro. Depois você pode convidar parentes
              para acompanhar junto com você.
            </Text>
          </View>
        ) : (
          <>
            {relatives.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptyText}>
                  Só você acompanha por enquanto. Convide um parente para ver a
                  timeline, os sinais vitais e o histórico junto com você.
                </Text>
              </View>
            ) : (
              relatives.map((r) => (
                <View key={r.uid} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName}>{r.nome}</Text>
                      <Text style={styles.cardMeta}>{r.email}</Text>
                      {r.parentesco ? (
                        <Text style={styles.cardMeta}>
                          {PARENTESCO_OPTIONS.find((p) => p.id === r.parentesco)?.label ??
                            r.parentesco}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[styles.badge, r.familiaTitular && styles.badgeTitular]}>
                      <Text
                        style={[styles.badgeText, r.familiaTitular && styles.badgeTextTitular]}
                      >
                        {r.familiaTitular ? 'Titular' : 'Acompanha'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}

            {showForm ? (
              <View style={styles.form}>
                <Text style={styles.formTitle}>Convidar parente</Text>
                <Text style={styles.formSubtitle}>
                  Ele vai acompanhar o cuidado com você: vê a timeline, os sinais
                  vitais e o histórico. Quem edita o cadastro e cuida do
                  cuidador continua sendo você.
                </Text>

                <FormInput
                  label="Nome completo"
                  value={form.nome}
                  onChangeText={(v) => update('nome', v)}
                  placeholder="Ex.: João da Silva"
                  autoCapitalize="words"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                  editable={!isSubmitting}
                  error={errors.nome}
                />

                <FormInput
                  ref={emailRef}
                  label="E-mail"
                  value={form.email}
                  onChangeText={(v) => update('email', v)}
                  placeholder="parente@exemplo.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  onSubmitEditing={() => telefoneRef.current?.focus()}
                  editable={!isSubmitting}
                  error={errors.email}
                />

                <FormInput
                  ref={telefoneRef}
                  label="Telefone"
                  value={form.telefone}
                  onChangeText={(v) => update('telefone', formatPhone(v))}
                  placeholder="(00) 00000-0000"
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  editable={!isSubmitting}
                  error={errors.telefone}
                />

                <InsetGroupedSection>
                  <InsetRow
                    label="Parentesco com o paciente"
                    value={PARENTESCO_OPTIONS.find((p) => p.id === form.parentesco)?.label}
                    placeholder="Selecionar"
                    chevron
                    last
                    onPress={isSubmitting ? undefined : () => setShowParentescoPicker(true)}
                  />
                </InsetGroupedSection>
                {errors.parentesco ? (
                  <Text style={styles.fieldError}>{errors.parentesco}</Text>
                ) : null}

                {errors.general ? (
                  <Text style={styles.generalError}>{errors.general}</Text>
                ) : null}

                <TouchableOpacity
                  style={[styles.submitButton, isSubmitting && styles.disabled]}
                  onPress={handleInvite}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.submitText}>Convidar</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowForm(false);
                    setErrors({});
                  }}
                  disabled={isSubmitting}
                  activeOpacity={0.6}
                >
                  <Text style={styles.cancelText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowForm(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="person-add-outline" size={20} color={colors.family} />
                <Text style={styles.addButtonText}>Convidar parente</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      <SelectionListModal
        visible={showParentescoPicker}
        title="Parentesco"
        items={PARENTESCO_OPTIONS}
        selectedId={form.parentesco || null}
        onSelect={(item) => update('parentesco', item.id)}
        onClose={() => setShowParentescoPicker(false)}
        accentColor={colors.family}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  scrollContent: { paddingHorizontal: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  cardInfo: { flex: 1 },
  cardName: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  cardMeta: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  badge: {
    backgroundColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeTitular: { backgroundColor: colors.family + '18' },
  badgeText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textMuted },
  badgeTextTitular: { color: colors.family },
  emptyText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.family + '12',
    borderWidth: 1,
    borderColor: colors.family + '30',
  },
  addButtonText: { fontSize: fontSize.md, fontWeight: '600', color: colors.family },
  form: { marginTop: spacing.sm },
  formTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },
  formSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  fieldError: {
    color: colors.error,
    fontSize: fontSize.xs,
    marginTop: -spacing.md,
    marginBottom: spacing.md,
    marginHorizontal: spacing.md,
  },
  generalError: {
    color: colors.error,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  submitButton: {
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.family,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitText: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
  cancelButton: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { fontSize: fontSize.md, color: colors.textSecondary },
  disabled: { opacity: 0.6 },
});
