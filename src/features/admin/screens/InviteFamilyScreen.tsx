import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, fontSize } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as adminUserService from '../../../core/services/adminUserService';
import {
  ModalHeader,
  InsetGroupedSection,
  InsetRow,
  SelectionListModal,
  PrimaryButton,
} from '../../../shared/components/ui';
import { formatPhone } from '../../../shared/utils/formatters';
import { mapAuthError } from '../../../shared/utils/authErrors';
import { PARENTESCO_OPTIONS } from '../../../shared/constants/parentesco';

/** Sanitiza o telefone para wa.me (só dígitos, com DDI Brasil) */
const toWhatsappNumber = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  return digits.length <= 11 ? `55${digits}` : digits;
};

export const InviteFamilyScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [parentesco, setParentesco] = useState('');
  const [showParentesco, setShowParentesco] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Estado pós-criação
  const [invited, setInvited] = useState<{ email: string; tempPassword: string } | null>(null);

  const emailRef = useRef<TextInput>(null);
  const telRef = useRef<TextInput>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSave = nome.trim().length > 0 && emailValid && parentesco.length > 0;

  const selectedParentesco = PARENTESCO_OPTIONS.find((o) => o.label === parentesco);

  const buildMessage = (em: string, pwd: string) =>
    `Olá, ${nome.trim()}! Você foi convidado(a) para acompanhar o cuidado do seu familiar no app HomeCare.\n\n` +
    `Acesse o app e entre com:\n` +
    `E-mail: ${em}\n` +
    `Senha temporária: ${pwd}\n\n` +
    `No primeiro acesso você criará uma nova senha e cadastrará os dados do paciente.`;

  const handleSave = async () => {
    if (!canSave || !user?.empresaId) return;
    setIsSaving(true);
    try {
      const result = await adminUserService.inviteFamilyAccount({
        email: email.trim(),
        nome: nome.trim(),
        telefone: telefone.trim(),
        empresaId: user.empresaId,
        parentesco,
      });
      setInvited({ email: email.trim().toLowerCase(), tempPassword: result.tempPassword });
    } catch (err) {
      Alert.alert('Erro ao convidar', mapAuthError(err, 'Não foi possível criar o convite'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendWhatsapp = async () => {
    if (!invited) return;
    const num = toWhatsappNumber(telefone);
    const text = encodeURIComponent(buildMessage(invited.email, invited.tempPassword));
    const url = num ? `https://wa.me/${num}?text=${text}` : `https://wa.me/?text=${text}`;
    const ok = await Linking.canOpenURL(url);
    if (ok) {
      await Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp indisponível', 'Não foi possível abrir o WhatsApp neste dispositivo.');
    }
  };

  // ── Tela de sucesso (convite criado) ──
  if (invited) {
    return (
      <View style={styles.root}>
        <View style={{ paddingTop: insets.top }}>
          <ModalHeader
            title="Convite criado"
            onCancel={() => navigation.goBack()}
            accentColor={colors.admin}
          />
        </View>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={48} color={colors.success} />
          </View>
          <Text style={styles.successTitle}>Conta criada para {nome.trim()}</Text>
          <Text style={styles.successSub}>
            Envie os dados de acesso. No primeiro login a família troca a senha e cadastra o paciente.
          </Text>

          <InsetGroupedSection header="DADOS DE ACESSO">
            <InsetRow label="E-mail" value={invited.email} />
            <InsetRow label="Senha temporária" value={invited.tempPassword} last />
          </InsetGroupedSection>

          <PrimaryButton
            title="Enviar no WhatsApp"
            onPress={handleSendWhatsapp}
            icon={<Ionicons name="logo-whatsapp" size={20} color={colors.white} />}
            style={styles.whatsappBtn}
          />
          <TouchableOpacity style={styles.doneLink} onPress={() => navigation.goBack()}>
            <Text style={styles.doneLinkText}>Concluir</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Formulário ──
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top }}>
        <ModalHeader
          title="Convidar Família"
          onCancel={() => navigation.goBack()}
          onDone={handleSave}
          doneLabel="Criar"
          doneDisabled={!canSave}
          isLoading={isSaving}
          accentColor={colors.admin}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          A conta será criada sem paciente. A família cadastra os dados do paciente no primeiro acesso.
        </Text>

        <InsetGroupedSection header="DADOS DO FAMILIAR">
          <InsetRow
            label="Nome"
            rightContent={
              <TextInput
                style={styles.inlineInput}
                value={nome}
                onChangeText={setNome}
                placeholder="Nome completo"
                placeholderTextColor={colors.textMuted}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            }
          />
          <InsetRow
            label="E-mail"
            rightContent={
              <TextInput
                ref={emailRef}
                style={styles.inlineInput}
                value={email}
                onChangeText={setEmail}
                placeholder="email@exemplo.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => telRef.current?.focus()}
              />
            }
          />
          <InsetRow
            label="Telefone"
            rightContent={
              <TextInput
                ref={telRef}
                style={styles.inlineInput}
                value={telefone}
                onChangeText={(v) => setTelefone(formatPhone(v))}
                placeholder="(11) 99999-9999"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />
            }
            last
          />
        </InsetGroupedSection>

        <InsetGroupedSection header="PARENTESCO">
          <InsetRow
            label="Parentesco"
            value={parentesco || 'Selecionar'}
            valueColor={parentesco ? colors.textPrimary : colors.textMuted}
            onPress={() => setShowParentesco(true)}
            chevron
            last
          />
        </InsetGroupedSection>
      </ScrollView>

      <SelectionListModal
        visible={showParentesco}
        title="Parentesco"
        items={PARENTESCO_OPTIONS}
        selectedId={selectedParentesco?.id ?? null}
        onSelect={(item) => {
          setParentesco(item.label);
          setShowParentesco(false);
        }}
        onClose={() => setShowParentesco(false)}
        accentColor={colors.admin}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  intro: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 },
  inlineInput: { flex: 1, fontSize: fontSize.md, color: colors.textPrimary, textAlign: 'right', paddingVertical: 0 },

  successIcon: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.md },
  successTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  successSub: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg, lineHeight: 20 },
  whatsappBtn: { marginTop: spacing.lg, backgroundColor: '#25D366' },
  doneLink: { alignItems: 'center', paddingVertical: spacing.lg },
  doneLinkText: { fontSize: fontSize.md, color: colors.admin, fontWeight: '600' },
});
