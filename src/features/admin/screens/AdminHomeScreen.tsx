import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import { UserRole } from '../../../core/types';
import type { RootStackParamList } from '../../../core/navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'AdminHome'>;

const ROLE_OPTIONS: { role: UserRole; label: string; styleKey: 'nurse' | 'family' | 'admin' }[] = [
  { role: 'nurse', label: 'Enfermeiro', styleKey: 'nurse' },
  { role: 'family', label: 'Família', styleKey: 'family' },
  { role: 'admin', label: 'Admin', styleKey: 'admin' },
];

export const AdminHomeScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { user, role, signOut, simulateRole } = useAuthStore();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Painel Admin</Text>
        <Text style={styles.greeting}>Olá, {user?.nome || 'Admin'}</Text>
      </View>

      {/* Role Switcher */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Simular perfil</Text>
        <View style={styles.roleGrid}>
          {ROLE_OPTIONS.map(({ role: optionRole, label, styleKey }) => {
            const isActive = role === optionRole;
            return (
              <TouchableOpacity
                key={optionRole}
                style={[styles.roleCard, isActive && roleStyles[styleKey].activeCard]}
                onPress={() => simulateRole(optionRole)}
                activeOpacity={0.7}
              >
                <View style={[styles.roleDot, roleStyles[styleKey].dot]} />
                <Text style={[styles.roleLabel, isActive && roleStyles[styleKey].activeLabel]}>
                  {label}
                </Text>
                {isActive && <Text style={styles.activeTag}>Ativo</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Ações */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Gestão</Text>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={() => navigation.navigate('CreateNurse')}
          activeOpacity={0.6}
        >
          <View style={styles.actionIconWrap}>
            <Text style={styles.actionIcon}>+</Text>
          </View>
          <View style={styles.actionTextWrap}>
            <Text style={styles.actionLabel}>Cadastrar enfermeiro</Text>
            <Text style={styles.actionHint}>Cria conta e perfil no app</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Placeholder */}
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          Demais funcionalidades do admin serão construídas na Fase 3
        </Text>
      </View>

      {/* Logout */}
      <View style={[styles.actionArea, { paddingBottom: insets.bottom + spacing.lg }]}>
        <TouchableOpacity style={styles.logoutButton} onPress={signOut} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Sair</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.35,
  },
  greeting: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // Section
  section: {
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  roleGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  roleCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  roleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  roleLabel: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  activeTag: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },

  // Actions
  actionsSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIcon: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '400',
    lineHeight: 24,
  },
  actionTextWrap: {
    flex: 1,
  },
  actionLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  actionHint: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: fontSize.xl,
    color: colors.textMuted,
    fontWeight: '300',
  },

  // Placeholder
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  placeholderText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Action Area
  actionArea: {
    paddingHorizontal: spacing.lg,
  },
  logoutButton: {
    height: 52,
    backgroundColor: colors.error,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});

// Styles acessados dinamicamente via roleStyles[styleKey]. O rule react-native/no-unused-styles
// faz análise estática e não consegue rastrear esse padrão (limitação conhecida do plugin).
// Ref: https://github.com/Intellicode/eslint-plugin-react-native/issues/15
/* eslint-disable react-native/no-unused-styles */
const roleStyles = {
  nurse: StyleSheet.create({
    dot: { backgroundColor: colors.nurse },
    activeCard: { borderColor: colors.nurse, borderWidth: 2 },
    activeLabel: { color: colors.nurse, fontWeight: '600' as const },
  }),
  family: StyleSheet.create({
    dot: { backgroundColor: colors.family },
    activeCard: { borderColor: colors.family, borderWidth: 2 },
    activeLabel: { color: colors.family, fontWeight: '600' as const },
  }),
  admin: StyleSheet.create({
    dot: { backgroundColor: colors.admin },
    activeCard: { borderColor: colors.admin, borderWidth: 2 },
    activeLabel: { color: colors.admin, fontWeight: '600' as const },
  }),
};
