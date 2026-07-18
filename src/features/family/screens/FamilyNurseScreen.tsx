/**
 * A família gerencia o enfermeiro que cuida do paciente dela (modo familiar).
 *
 * Só existe para a família DONA do tenant, que se cadastrou sozinha. Quando há
 * uma empresa por trás, é ela quem monta a equipe, e esta tela não aparece.
 *
 * Convidar e autorizar são dois atos, mas aqui acontecem juntos: no modo
 * familiar não existe escala, então convidar o enfermeiro é justamente dizer
 * que ele cuida deste paciente. Remover o acesso é separado, e é imediato.
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
import * as patientService from '../../../core/services/patientService';
import type { NurseMember } from '../../../core/services/adminUserService';
import { ScreenHeader, FormInput } from '../../../shared/components/ui';
import { CorenField, EMPTY_COREN, type CorenFieldValue } from '../../../shared/components/CorenField';
import { formatCoren, formatPhone, EMAIL_REGEX } from '../../../shared/utils/formatters';
import { mapAuthError } from '../../../shared/utils/authErrors';

interface FormState {
  nome: string;
  email: string;
  telefone: string;
}

interface FormErrors {
  nome?: string;
  email?: string;
  telefone?: string;
  corenUf?: string;
  corenNumero?: string;
  corenVerificado?: string;
  general?: string;
}

const EMPTY_FORM: FormState = { nome: '', email: '', telefone: '' };

/** Sanitiza o telefone para wa.me (só dígitos, com DDI Brasil) */
const toWhatsappNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  return digits.length <= 11 ? `55${digits}` : digits;
};

const buildMessage = (nome: string, email: string, senha: string): string =>
  `Oi, ${nome}! Criei um acesso para você no Benevita, para registrarmos o cuidado por lá.\n\n` +
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

export const FamilyNurseScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [nurses, setNurses] = useState<NurseMember[]>([]);
  const [authorizedUids, setAuthorizedUids] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [coren, setCoren] = useState<CorenFieldValue>(EMPTY_COREN);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const telefoneRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    if (!user?.empresaId || !user?.pacienteId) {
      setIsLoading(false);
      return;
    }
    try {
      const [lista, paciente] = await Promise.all([
        adminUserService.listNurses(user.empresaId),
        patientService.getPatient(user.empresaId, user.pacienteId),
      ]);
      setNurses(lista);
      setAuthorizedUids(paciente?.enfermeirosAutorizados ?? []);
    } catch (err) {
      console.error('FamilyNurse load error', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.empresaId, user?.pacienteId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.nome.trim()) next.nome = 'Informe o nome do enfermeiro';
    if (!form.email.trim()) {
      next.email = 'Informe o e-mail';
    } else if (!EMAIL_REGEX.test(form.email.trim())) {
      next.email = 'E-mail inválido';
    }
    if (!form.telefone.trim()) next.telefone = 'Informe o telefone';
    if (!coren.uf) next.corenUf = 'Selecione a UF do conselho';
    if (!coren.numero.trim()) next.corenNumero = 'Informe o número do COREN';
    if (!coren.verificado) {
      next.corenVerificado = 'Consulte o registro no Cofen e confirme a conferência';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleInvite = async () => {
    Keyboard.dismiss();
    if (!validate()) return;
    if (!user?.empresaId || !user?.uid || !user?.pacienteId) {
      setErrors({ general: 'Cadastre o paciente antes de convidar o enfermeiro.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { uid, tempPassword } = await adminUserService.inviteNurseAccount({
        nome: form.nome.trim(),
        email: form.email.trim().toLowerCase(),
        telefone: form.telefone.trim(),
        empresaId: user.empresaId,
        coren: {
          uf: coren.uf,
          numero: coren.numero.trim(),
          categoria: coren.categoria,
          verificado: coren.verificado,
        },
        criadoPorUid: user.uid,
      });

      // Convidar e autorizar são atos separados: a conta existe, mas só passa
      // a enxergar o paciente depois desta linha.
      await patientService.authorizeNurse(user.empresaId, user.pacienteId, uid);

      const nome = form.nome.trim();
      const email = form.email.trim().toLowerCase();
      const telefone = form.telefone;

      setShowForm(false);
      setForm(EMPTY_FORM);
      setCoren(EMPTY_COREN);
      await load();

      Alert.alert(
        'Enfermeiro convidado',
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

  const handleRevoke = (nurse: NurseMember) => {
    if (!user?.empresaId || !user?.pacienteId) return;
    Alert.alert(
      'Remover acesso',
      `${nurse.nome} deixa de ver os dados do paciente agora. A conta continua existindo, e você pode liberar de novo depois.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover acesso',
          style: 'destructive',
          onPress: async () => {
            try {
              await patientService.deauthorizeNurse(
                user.empresaId,
                user.pacienteId!,
                nurse.uid
              );
              await load();
            } catch (err) {
              console.error('revoke error', err);
              Alert.alert('Erro', 'Não foi possível remover o acesso.');
            }
          },
        },
      ]
    );
  };

  const handleAuthorize = async (nurse: NurseMember) => {
    if (!user?.empresaId || !user?.pacienteId) return;
    try {
      await patientService.authorizeNurse(user.empresaId, user.pacienteId, nurse.uid);
      await load();
    } catch (err) {
      console.error('authorize error', err);
      Alert.alert('Erro', 'Não foi possível liberar o acesso.');
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
        <ScreenHeader title="Enfermeiro" subtitle="Quem cuida" showBack />

        {!user?.pacienteId ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>
              Cadastre o paciente primeiro. Depois disso você pode convidar o
              enfermeiro que cuida dele.
            </Text>
          </View>
        ) : (
          <>
            {nurses.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.emptyText}>
                  Nenhum enfermeiro ainda. Convide quem já cuida do paciente para
                  que ele registre o cuidado por aqui.
                </Text>
              </View>
            ) : (
              nurses.map((n) => {
                const autorizado = authorizedUids.includes(n.uid);
                return (
                  <View key={n.uid} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardName}>{n.nome}</Text>
                        <Text style={styles.cardMeta}>{n.email}</Text>
                        {formatCoren(n.corenRegistro) ? (
                          <Text style={styles.cardMeta}>{formatCoren(n.corenRegistro)}</Text>
                        ) : null}
                      </View>
                      <View
                        style={[styles.badge, !autorizado && styles.badgeOff]}
                      >
                        <Text
                          style={[styles.badgeText, !autorizado && styles.badgeTextOff]}
                        >
                          {autorizado ? 'Com acesso' : 'Sem acesso'}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.cardAction}
                      onPress={() => (autorizado ? handleRevoke(n) : handleAuthorize(n))}
                      activeOpacity={0.6}
                    >
                      <Text
                        style={[styles.cardActionText, autorizado && styles.cardActionDanger]}
                      >
                        {autorizado ? 'Remover acesso' : 'Liberar acesso'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}

            {showForm ? (
              <View style={styles.form}>
                <Text style={styles.formTitle}>Convidar enfermeiro</Text>
                <Text style={styles.formSubtitle}>
                  Ele recebe um acesso próprio e passa a registrar o cuidado no
                  aplicativo. Você pode remover o acesso quando quiser.
                </Text>

                <FormInput
                  label="Nome completo"
                  value={form.nome}
                  onChangeText={(v) => {
                    setForm((p) => ({ ...p, nome: v }));
                    setErrors((p) => ({ ...p, nome: undefined, general: undefined }));
                  }}
                  placeholder="Ex.: Maria da Silva"
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
                  onChangeText={(v) => {
                    setForm((p) => ({ ...p, email: v }));
                    setErrors((p) => ({ ...p, email: undefined, general: undefined }));
                  }}
                  placeholder="enfermeiro@exemplo.com"
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
                  onChangeText={(v) => {
                    setForm((p) => ({ ...p, telefone: formatPhone(v) }));
                    setErrors((p) => ({ ...p, telefone: undefined, general: undefined }));
                  }}
                  placeholder="(00) 00000-0000"
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  editable={!isSubmitting}
                  error={errors.telefone}
                />

                <CorenField
                  value={coren}
                  onChange={(next) => {
                    setCoren(next);
                    setErrors((p) => ({
                      ...p,
                      corenUf: undefined,
                      corenNumero: undefined,
                      corenVerificado: undefined,
                      general: undefined,
                    }));
                  }}
                  editable={!isSubmitting}
                  accentColor={colors.family}
                  errors={{
                    uf: errors.corenUf,
                    numero: errors.corenNumero,
                    verificado: errors.corenVerificado,
                  }}
                />

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
                <Ionicons name="add-circle-outline" size={20} color={colors.family} />
                <Text style={styles.addButtonText}>Convidar enfermeiro</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
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
    backgroundColor: colors.family + '18',
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeOff: { backgroundColor: colors.border },
  badgeText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.family },
  badgeTextOff: { color: colors.textMuted },
  cardAction: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  cardActionText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.family },
  cardActionDanger: { color: colors.error },
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
    marginTop: spacing.lg,
  },
  submitText: { color: colors.white, fontSize: fontSize.md, fontWeight: '600' },
  cancelButton: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { fontSize: fontSize.md, color: colors.textSecondary },
  disabled: { opacity: 0.6 },
});
