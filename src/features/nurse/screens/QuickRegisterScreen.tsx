import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import type { RegisterStackParamList } from '../../../core/navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<RegisterStackParamList, 'QuickRegister'>;

interface RegisterOption {
  key: keyof Omit<RegisterStackParamList, 'QuickRegister'>;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  iconBg: string;
}

const OPTIONS: RegisterOption[] = [
  {
    key: 'RegisterMedication',
    label: 'Medicamento',
    icon: 'bandage-outline',
    iconColor: '#7C3AED',
    iconBg: '#F3F0FF',
  },
  {
    key: 'RegisterVitals',
    label: 'Sinais vitais',
    icon: 'heart-outline',
    iconColor: '#EF4444',
    iconBg: '#FEF2F2',
  },
  {
    key: 'RegisterFeeding',
    label: 'Alimentação',
    icon: 'restaurant-outline',
    iconColor: '#F59E0B',
    iconBg: '#FFFBEB',
  },
  {
    key: 'RegisterActivity',
    label: 'Atividade',
    icon: 'pulse-outline',
    iconColor: '#22C55E',
    iconBg: '#F0FDF4',
  },
  {
    key: 'RegisterIncident',
    label: 'Intercorrência',
    icon: 'alert-circle-outline',
    iconColor: '#EF4444',
    iconBg: '#FEF2F2',
  },
  {
    key: 'RegisterPhoto',
    label: 'Foto',
    icon: 'camera-outline',
    iconColor: '#64748B',
    iconBg: '#F1F5F9',
  },
];

export const QuickRegisterScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();

  return (
    <ScrollView
      style={[styles.root, { paddingTop: insets.top + spacing.lg }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
    >
      {/* Header — Figma two-line title */}
      <View style={styles.header}>
        <Text style={styles.titleLine1}>Novo</Text>
        <Text style={styles.titleLine2}>Registro</Text>
      </View>


      {/* Register type grid */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>O QUE DESEJA REGISTRAR?</Text>
        <View style={styles.grid}>
          {OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => navigation.navigate(opt.key)}
            >
              <View style={[styles.iconCircle, { backgroundColor: opt.iconBg }]}>
                <Ionicons name={opt.icon} size={24} color={opt.iconColor} />
              </View>
              <Text style={styles.cardLabel}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  titleLine1: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  titleLine2: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
    marginTop: -2,
  },

  // Sections
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.md,
  },


  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    width: '47%',
    aspectRatio: 1.2,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
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
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
});
