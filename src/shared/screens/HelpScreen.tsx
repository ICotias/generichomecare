import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, fontSize, borderRadius } from '../../core/theme/theme';
import { ScreenHeader } from '../components/ui/ScreenHeader';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_DATA: FaqItem[] = [
  {
    question: 'Como registrar cuidados?',
    answer:
      'Acesse a aba Registros, selecione o paciente e escolha o tipo de registro. Preencha as informações solicitadas e toque em Salvar para confirmar.',
  },
  {
    question: 'Como fazer check-in no plantão?',
    answer:
      'Na aba Plantão, selecione o paciente e toque em Fazer Check-in. O app registrará automaticamente sua localização e horário de entrada.',
  },
  {
    question: 'Como exportar um relatório?',
    answer:
      'No detalhe do paciente, toque em Exportar PDF e configure os filtros de período e tipo de registro desejados.',
  },
  {
    question: 'Como alterar meus dados?',
    answer:
      'Acesse seu perfil e toque em Configurações Pessoais. Lá você pode editar nome, telefone e outras informações.',
  },
  {
    question: 'Como vincular uma família?',
    answer:
      'No painel admin, acesse Pacientes, selecione um paciente e toque em Vincular Família. Informe o email do familiar para enviar o convite.',
  },
  {
    question: 'Esqueci minha senha',
    answer:
      'Na tela de login, toque em Esqueci a senha e informe seu email cadastrado. Você receberá um link para redefinir sua senha.',
  },
];

const FaqRow = ({ item }: { item: FaqItem }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={styles.faqRow}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.faqHeader}>
        <Text style={styles.faqQuestion}>{item.question}</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </View>
      {expanded && <Text style={styles.faqAnswer}>{item.answer}</Text>}
    </TouchableOpacity>
  );
};

export const HelpScreen = () => {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + spacing.xxl,
      }}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title="Central de" subtitle="Ajuda" showBack />

      <View style={styles.body}>
        {/* FAQ icon header */}
        <View style={styles.iconContainer}>
          <Ionicons name="help-circle" size={48} color={colors.primary} />
          <Text style={styles.introText}>Perguntas frequentes</Text>
        </View>

        {/* FAQ items */}
        <View style={styles.faqCard}>
          {FAQ_DATA.map((item, index) => (
            <View key={item.question}>
              {index > 0 && <View style={styles.divider} />}
              <FaqRow item={item} />
            </View>
          ))}
        </View>

        {/* Support footer */}
        <View style={styles.supportContainer}>
          <Text style={styles.supportTitle}>Precisa de mais ajuda?</Text>
          <View style={styles.supportRow}>
            <Ionicons name="mail-outline" size={18} color={colors.primary} />
            <Text style={styles.supportEmail}>suporte@homecare.com</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  introText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: spacing.sm,
  },
  faqCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  faqRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
    marginRight: spacing.sm,
  },
  faqAnswer: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.md,
  },
  supportContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  supportTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  supportEmail: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: '500',
  },
});
