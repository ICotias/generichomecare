import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, fontSize } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';

export const FamilyHomeScreen = () => {
  const { user, signOut } = useAuthStore();

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Olá, {user?.nome || 'Familiar'}</Text>
      <Text style={styles.role}>Perfil: Família</Text>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Tela da família será construída na Fase 2</Text>
      </View>
      <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    paddingTop: 60,
  },
  greeting: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.family,
  },
  role: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
  },
  logoutButton: {
    backgroundColor: colors.error,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoutText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
