import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import { UserRole } from '../../../core/types';
import type { AdminProfileStackParamList } from '../../../core/navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<AdminProfileStackParamList, 'AdminProfile'>;

const MenuRow = ({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress?: () => void;
}) => (
  <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.6}>
    <Ionicons name={icon} size={20} color={colors.textSecondary} />
    <Text style={styles.menuRowText}>{label}</Text>
    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
  </TouchableOpacity>
);

const ROLE_OPTIONS: { role: UserRole; label: string; styleKey: 'nurse' | 'family' | 'admin' }[] = [
  { role: 'nurse', label: 'Enfermeiro', styleKey: 'nurse' },
  { role: 'family', label: 'Família', styleKey: 'family' },
  { role: 'admin', label: 'Admin', styleKey: 'admin' },
];

export const AdminProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { user, role, signOut, simulateRole } = useAuthStore();

  const initials = (user?.nome ?? 'A').charAt(0).toUpperCase();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      {/* Orange gradient header */}
      <LinearGradient
        colors={[colors.admin, '#EA580C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradientHeader, { paddingTop: insets.top + spacing.xl }]}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.headerName}>{user?.nome ?? 'Admin'}</Text>
        <Text style={styles.headerRole}>Administrador</Text>
      </LinearGradient>

      {/* Menu sections */}
      <View style={styles.body}>
        {/* MINHA CONTA */}
        <Text style={styles.sectionLabel}>MINHA CONTA</Text>
        <View style={styles.menuCard}>
          <MenuRow icon="settings-outline" label="Configurações Pessoais" onPress={() => Alert.alert('Em breve', 'Esta funcionalidade será disponibilizada em breve.')} />
          <View style={styles.menuDivider} />
          <MenuRow
            icon="business-outline"
            label="Empresa"
            onPress={() => Alert.alert('Em breve', 'Esta funcionalidade será disponibilizada em breve.')}
          />
        </View>

        {/* SUPORTE */}
        <Text style={styles.sectionLabel}>SUPORTE</Text>
        <View style={styles.menuCard}>
          <MenuRow icon="help-circle-outline" label="Central de Ajuda" onPress={() => Alert.alert('Em breve', 'Esta funcionalidade será disponibilizada em breve.')} />
        </View>

        {/* Role Switcher */}
        <Text style={styles.sectionLabel}>SIMULAR PERFIL</Text>
        <Text style={styles.sectionHint}>
          Visualize o app como enfermeiro ou familiar para testar.
        </Text>
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

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={signOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// ════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Gradient header
  gradientHeader: {
    alignItems: 'center',
    paddingBottom: spacing.xl + spacing.md,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.white,
  },
  headerName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.white,
  },
  headerRole: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.75)',
    marginTop: spacing.xs,
    fontWeight: '500',
  },

  // Body
  body: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },

  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  sectionHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm + 4,
  },
  menuRowText: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 28,
  },

  // Role grid
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

  // Logout
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.error + '10',
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  logoutText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.error,
  },
});

// Styles acessados dinamicamente via roleStyles[styleKey]. O rule react-native/no-unused-styles
// faz análise estática e não consegue rastrear esse padrão (limitação conhecida do plugin).
// Ref: https://github.com/Intellicode/eslint-plugin-react-native/issues/15
/* eslint-disable react-native/no-unused-styles */
const roleStyles = {
  nurse: StyleSheet.create({
    dot: { backgroundColor: colors.primary },
    activeCard: { borderColor: colors.primary, borderWidth: 2 },
    activeLabel: { color: colors.primary, fontWeight: '600' as const },
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
