import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  Alert,
} from 'react-native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../../core/config/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../core/hooks/useAuth';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { PasswordInput } from '../../../shared/components/PasswordInput';

const ERROR_MESSAGES: Record<string, string> = {
  'auth/user-not-found': 'Email ou senha incorretos.',
  'auth/wrong-password': 'Email ou senha incorretos.',
  'auth/invalid-credential': 'Email ou senha incorretos.',
  'auth/invalid-login-credentials': 'Email ou senha incorretos.',
  'auth/invalid-email': 'Insira um email válido.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
  'auth/network-request-failed': 'Sem conexão com a internet.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/operation-not-allowed': 'Login não permitido. Contate o administrador.',
};

export const LoginScreen = () => {
  const insets = useSafeAreaInsets();
  const passwordRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);

  const signIn = useAuthStore((state) => state.signIn);

  const handleForgotPassword = async () => {
    Keyboard.dismiss();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError('Insira seu email para recuperar a senha.');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      Alert.alert(
        'Email enviado',
        `Email de recuperação enviado para ${trimmedEmail}`,
      );
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      const code = firebaseError?.code ?? '';
      if (code === 'auth/user-not-found') {
        setError('Nenhuma conta encontrada com este email.');
      } else if (code === 'auth/invalid-email') {
        setError('Email inválido.');
      } else {
        console.warn('Password reset error:', code, firebaseError?.message);
        setError('Erro ao enviar email de recuperação.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    setError('');

    if (!email.trim()) {
      setError('Insira seu email.');
      return;
    }
    if (!password.trim()) {
      setError('Insira sua senha.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err: unknown) {
      const firebaseError = err as { code?: string; message?: string };
      const code = firebaseError?.code ?? '';
      const mapped = ERROR_MESSAGES[code];
      if (mapped) {
        setError(mapped);
      } else if (code) {
        // Código Firebase não mapeado — mostra o código para debug
        console.warn('Firebase auth error:', code, firebaseError?.message);
        setError('Não foi possível conectar. Tente novamente.');
      } else {
        // Erro genérico (rede, timeout, etc.)
        console.error('Login error:', err);
        setError('Erro inesperado. Verifique sua conexão e tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 80, paddingBottom: insets.bottom + spacing.xxl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <View style={styles.logoArea}>
            <View style={styles.logoBox}>
              <Image
                source={require('../../../../assets/logo.png')}
                style={styles.logoImg}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>HomeCare</Text>
            <Text style={styles.tagline}>Gerenciamento de cuidados{'\n'}domiciliares simplificado</Text>
          </View>

          {/* Form card */}
          <View style={styles.formCard}>
            <View style={styles.field}>
              <Text style={styles.label}>E-mail</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedField === 'email' && styles.inputFocused,
                ]}
                placeholder="seu@email.com"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (error) setError('');
                }}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Senha</Text>
              <PasswordInput
                ref={passwordRef}
                placeholder="••••••••"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (error) setError('');
                }}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                isFocused={focusedField === 'password'}
                textContentType="password"
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            {/* Esqueci a senha */}
            <TouchableOpacity style={styles.forgotRow} activeOpacity={0.7} onPress={handleForgotPassword}>
              <Text style={styles.forgotText}>Esqueci a senha</Text>
            </TouchableOpacity>

            {/* Inline Error */}
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Botão Entrar */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.buttonText}>Entrar</Text>
              )}
            </TouchableOpacity>

            {/* Dica */}
            <Text style={styles.hint}>
              Dica: use email contendo &quot;admin&quot;, &quot;nurse&quot; ou &quot;family&quot;
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    flexGrow: 1,
  },

  // Logo area
  logoArea: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  logoImg: {
    width: 72,
    height: 72,
  },
  appName: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.35,
  },
  tagline: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 22,
  },

  // Form card
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },

  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs + 2,
  },
  input: {
    height: 52,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  inputFocused: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },

  // Forgot password
  forgotRow: {
    alignSelf: 'flex-end',
    marginBottom: spacing.md,
  },
  forgotText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primary,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.error + '10',
    borderWidth: 1,
    borderColor: colors.error + '30',
    borderRadius: borderRadius.md,
    padding: spacing.sm + 4,
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.error,
    fontWeight: '500',
  },

  // Button
  button: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  buttonDisabled: {
    backgroundColor: colors.disabled,
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Hint
  hint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 20,
  },
});
