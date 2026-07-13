import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';

import { db } from '../../core/config/firebase';
import { Collections } from '../constants/firestore';
import { colors, spacing, fontSize, borderRadius } from '../../core/theme/theme';
import { useAuthStore } from '../../core/hooks/useAuth';

// ════════════════════════════════════════════
// LGPD Text (Lei Geral de Proteção de Dados)
// ════════════════════════════════════════════

const CONSENT_SECTIONS = [
  {
    title: '1. Dados coletados',
    body: 'O HomeCare App coleta e processa os seguintes dados pessoais: nome completo, CPF, e-mail, telefone, endereço, dados de saúde (diagnósticos, sinais vitais, medicamentos), registros fotográficos e dados de geolocalização para controle de plantões.',
  },
  {
    title: '2. Finalidade do tratamento',
    body: 'Os dados são utilizados exclusivamente para: (a) gestão do cuidado domiciliar dos pacientes; (b) comunicação entre profissionais de saúde e familiares; (c) geração de relatórios clínicos e operacionais; (d) controle de acesso e auditoria.',
  },
  {
    title: '3. Base legal',
    body: 'O tratamento dos dados é fundamentado no Art. 7°, inciso VIII da LGPD (tutela da saúde), Art. 11, inciso II, alínea "f" (proteção da vida e da incolumidade física) e mediante consentimento do titular.',
  },
  {
    title: '4. Compartilhamento',
    body: 'Os dados não são compartilhados com terceiros, exceto quando necessário para cumprimento de obrigação legal ou regulatória. O armazenamento é feito no Firebase (Google Cloud Platform), com servidores na região das Américas.',
  },
  {
    title: '5. Direitos do titular',
    body: 'Conforme a LGPD, você tem direito a: acesso, correção, anonimização, portabilidade, eliminação dos dados pessoais, revogação do consentimento e informação sobre compartilhamento. Solicite pelo e-mail do administrador da empresa.',
  },
  {
    title: '6. Retenção dos dados',
    body: 'Os dados de saúde são retidos conforme exigência do CFM (Conselho Federal de Medicina), no mínimo por 20 anos. Dados de conta podem ser eliminados mediante solicitação, respeitadas as obrigações legais.',
  },
  {
    title: '7. Segurança',
    body: 'Utilizamos criptografia em trânsito (TLS) e em repouso, controle de acesso por role (RBAC), autenticação Firebase Auth, e registros imutáveis de auditoria. Fotos clínicas são restritas a profissionais de saúde.',
  },
];

// ════════════════════════════════════════════
// Component
// ════════════════════════════════════════════

export const LgpdConsentScreen = ({ onAccepted }: { onAccepted: () => void }) => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (event: { nativeEvent: { layoutMeasurement: { height: number }; contentOffset: { y: number }; contentSize: { height: number } } }) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - 40;
    if (isAtEnd) setHasScrolledToEnd(true);
  };

  const handleAccept = async () => {
    if (!user?.uid) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, Collections.USUARIOS, user.uid), {
        lgpdConsentAt: Timestamp.now(),
        lgpdConsentVersion: '1.0',
        updatedAt: Timestamp.now(),
      });
      onAccepted();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      Alert.alert('Erro ao salvar consentimento', msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Termos de Uso e Privacidade</Text>
        <Text style={styles.subtitle}>Lei Geral de Proteção de Dados (LGPD)</Text>
        <View style={styles.separator} />
      </View>

      {/* Scrollable content */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xxl }]}
        showsVerticalScrollIndicator
        onScroll={handleScroll}
        scrollEventThrottle={200}
      >
        <Text style={styles.intro}>
          Ao utilizar o HomeCare App, você consente com o tratamento de seus dados pessoais conforme descrito abaixo. Leia atentamente todos os termos antes de aceitar.
        </Text>

        {CONSENT_SECTIONS.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}

        <View style={styles.versionBox}>
          <Text style={styles.versionText}>Versão 1.0, Abril 2026</Text>
        </View>

        {!hasScrolledToEnd && (
          <Text style={styles.scrollHint}>Role até o final para habilitar o botão de aceite.</Text>
        )}
      </ScrollView>

      {/* Accept button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity
          style={[styles.acceptBtn, (!hasScrolledToEnd || isSaving) && styles.acceptBtnDisabled]}
          onPress={handleAccept}
          activeOpacity={0.8}
          disabled={!hasScrolledToEnd || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.acceptBtnText}>Li e aceito os termos</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.acceptHint}>
          Você pode revogar este consentimento a qualquer momento.
        </Text>
      </View>
    </View>
  );
};

// ════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: fontSize.title, fontWeight: '700', color: colors.textPrimary, letterSpacing: 0.35 },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: spacing.md },

  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  intro: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },

  section: { marginBottom: spacing.lg },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.xs },
  sectionBody: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 22 },

  versionBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  versionText: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: '500' },

  scrollHint: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: spacing.md,
  },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    width: '100%',
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  acceptBtnDisabled: { opacity: 0.4 },
  acceptBtnText: { fontSize: fontSize.md, fontWeight: '700', color: colors.white },
  acceptHint: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: spacing.sm },
});
