import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';

import { auth, db } from '../../core/config/firebase';
import { useAuthStore } from '../../core/hooks/useAuth';
import { Collections } from '../constants/firestore';
import { colors, spacing, fontSize, borderRadius } from '../../core/theme/theme';
import { PasswordInput } from '../components/PasswordInput';
import { PrimaryButton } from '../components/ui';

/**
 * Troca de senha obrigatória no 1º acesso (conta criada pelo admin com senha
 * temporária). Renderizada como gate no RootNavigator quando
 * user.mustChangePassword === true. Não tem "Cancelar" — é forçada.
 */
export const ChangePasswordScreen = () => {
  const insets = useSafeAreaInsets();
  const { user, setUser, signOut } = useAuthStore();

  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = senha.length > 0 && senha.length < 8;
  const mismatch = confirma.length > 0 && senha !== confirma;
  const valid = senha.length >= 8 && senha === confirma;

  const handleSave = async () => {
    if (!valid || !auth.currentUser || !user) return;
    setLoading(true);
    setError(null);
    try {
      await updatePassword(auth.currentUser, senha);
      await updateDoc(doc(db, Collections.USUARIOS, user.uid), {
        mustChangePassword: false,
        updatedAt: Timestamp.now(),
      });
      setUser({ ...user, mustChangePassword: false });
    } catch (e) {
      const code = (e as { code?: string })?.code ?? '';
      if (code === 'auth/requires-recent-login') {
        Alert.alert(
          'Sessão expirada',
          'Por segurança, entre novamente com a senha temporária para definir a nova senha.',
          [{ text: 'OK', onPress: () => signOut() }]
        );
      } else if (code === 'auth/weak-password') {
        setError('Senha muito fraca. Use ao menos 8 caracteres.');
      } else {
        setError('Não foi possível alterar a senha. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconCircle}>
          <Ionicons name="lock-closed-outline" size={28} color={colors.family} />
        </View>

        <Text style={styles.title}>Crie sua senha</Text>
        <Text style={styles.subtitle}>
          Sua conta foi criada com uma senha temporária. Defina uma senha pessoal
          para continuar.
        </Text>

        <Text style={styles.label}>Nova senha</Text>
        <PasswordInput
          value={senha}
          onChangeText={setSenha}
          placeholder="Mínimo 8 caracteres"
          hasError={tooShort}
        />
        {tooShort && <Text style={styles.hintError}>A senha deve ter ao menos 8 caracteres.</Text>}

        <Text style={[styles.label, { marginTop: spacing.md }]}>Confirmar senha</Text>
        <PasswordInput
          value={confirma}
          onChangeText={setConfirma}
          placeholder="Repita a senha"
          hasError={mismatch}
        />
        {mismatch && <Text style={styles.hintError}>As senhas não coincidem.</Text>}

        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <PrimaryButton
          title="Salvar senha"
          onPress={handleSave}
          disabled={!valid}
          loading={loading}
          style={{ marginTop: spacing.xl, backgroundColor: colors.family }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.family + '1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
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
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs + 2,
  },
  hintError: {
    fontSize: fontSize.xs,
    color: colors.error,
    marginTop: spacing.xs,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.error + '14',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  errorText: { flex: 1, fontSize: fontSize.sm, color: colors.error },
});
