import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';

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

export const FamilyProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuthStore();

  const initials = (user?.nome ?? 'F').charAt(0).toUpperCase();
  const familyUser = user as typeof user & { parentesco?: string };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[colors.family, '#0891B2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradientHeader, { paddingTop: insets.top + spacing.xl }]}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.headerName}>{user?.nome ?? 'Familiar'}</Text>
        <Text style={styles.headerRole}>
          {familyUser?.parentesco ? `Familiar - ${familyUser.parentesco}` : 'Familiar'}
        </Text>
      </LinearGradient>

      <View style={styles.body}>
        <Text style={styles.sectionLabel}>MINHA CONTA</Text>
        <View style={styles.menuCard}>
          <MenuRow icon="settings-outline" label="Configurações Pessoais" onPress={() => Alert.alert('Em breve', 'Esta funcionalidade será disponibilizada em breve.')} />
          <View style={styles.menuDivider} />
          <MenuRow icon="person-outline" label="Paciente Vinculado" onPress={() => Alert.alert('Em breve', 'Esta funcionalidade será disponibilizada em breve.')} />
        </View>

        <Text style={styles.sectionLabel}>SUPORTE E AJUDA</Text>
        <View style={styles.menuCard}>
          <MenuRow icon="help-circle-outline" label="Central de Ajuda" onPress={() => Alert.alert('Em breve', 'Esta funcionalidade será disponibilizada em breve.')} />
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={signOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
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
  avatarText: { fontSize: 32, fontWeight: '700', color: colors.white },
  headerName: { fontSize: fontSize.xl, fontWeight: '700', color: colors.white },
  headerRole: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.75)',
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  body: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
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
  menuRowText: { flex: 1, fontSize: fontSize.md, fontWeight: '500', color: colors.textPrimary },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.md + 28,
  },
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
  logoutText: { fontSize: fontSize.md, fontWeight: '600', color: colors.error },
});
