import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { doc, getDoc } from 'firebase/firestore';

import { db } from '../../../core/config/firebase';
import { Collections } from '../../../shared/constants/firestore';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import type { TeamStackParamList } from '../../../core/navigation/RootNavigator';

type RouteType = RouteProp<TeamStackParamList, 'NurseDetail'>;

interface NurseData {
  uid: string;
  nome: string;
  email: string;
  telefone: string;
  coren?: string;
  status: string;
  createdAt?: Date;
}

const MOCK_NURSE: NurseData = {
  uid: 'mock-1',
  nome: 'Ana Paula Costa',
  email: 'ana@homecare.com',
  telefone: '(11) 99999-1111',
  coren: 'COREN-SP 123456',
  status: 'ativo',
  createdAt: new Date(2025, 0, 15),
};

export const NurseDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteType>();
  const nurseId = route.params?.nurseId;

  const [nurse, setNurse] = useState<NurseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  const load = useCallback(async () => {
    if (!nurseId) {
      setNurse(MOCK_NURSE);
      setUsingMock(true);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const snap = await getDoc(doc(db, Collections.USUARIOS, nurseId));
      if (snap.exists()) {
        const d = snap.data();
        setNurse({
          uid: snap.id,
          nome: d.nome ?? '',
          email: d.email ?? '',
          telefone: d.telefone ?? '',
          coren: d.coren,
          status: d.status ?? 'ativo',
          createdAt: d.createdAt?.toDate?.() ?? undefined,
        });
        setUsingMock(false);
      } else {
        setNurse(MOCK_NURSE);
        setUsingMock(true);
      }
    } catch (err) {
      console.error('NurseDetail load error', err);
      setNurse(MOCK_NURSE);
      setUsingMock(true);
    } finally {
      setIsLoading(false);
    }
  }, [nurseId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.admin} />
      </View>
    );
  }

  if (!nurse) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Profissional não encontrado</Text>
      </View>
    );
  }

  const isActive = nurse.status === 'ativo';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backRow} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>Voltar</Text>
        </TouchableOpacity>

        {usingMock && (
          <View style={styles.mockBanner}>
            <Text style={styles.mockBannerText}>Dados de exemplo</Text>
          </View>
        )}

        {/* Profile header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{nurse.nome.charAt(0)}</Text>
          </View>
          <Text style={styles.name}>{nurse.nome}</Text>
          <View style={[styles.statusBadge, !isActive && styles.statusBadgeInactive]}>
            <View style={[styles.statusDot, { backgroundColor: isActive ? colors.success : colors.textMuted }]} />
            <Text style={[styles.statusLabel, !isActive && styles.statusLabelInactive]}>
              {isActive ? 'Ativo' : 'Inativo'}
            </Text>
          </View>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <InfoRow label="E-mail" value={nurse.email} />
          <InfoRow label="Telefone" value={nurse.telefone} />
          {nurse.coren && <InfoRow label="COREN" value={nurse.coren} />}
          {nurse.createdAt && (
            <InfoRow
              label="Cadastrado em"
              value={nurse.createdAt.toLocaleDateString('pt-BR')}
              isLast
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const InfoRow = ({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) => (
  <View style={[styles.infoRow, isLast && styles.infoRowLast]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: spacing.lg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  errorText: { fontSize: fontSize.md, color: colors.textSecondary },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs, marginBottom: spacing.md },
  backText: { fontSize: fontSize.md, color: colors.primary, fontWeight: '600' },

  mockBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  mockBannerText: { fontSize: fontSize.xs, color: '#92400E', fontWeight: '500' },

  profileHeader: { alignItems: 'center', marginBottom: spacing.lg },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.admin + '1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: 30, fontWeight: '700', color: colors.admin },
  name: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: '#DCFCE7',
  },
  statusBadgeInactive: { backgroundColor: '#F3F4F6' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: fontSize.sm, fontWeight: '600', color: '#16A34A' },
  statusLabelInactive: { color: colors.textMuted },

  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  infoValue: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary, textAlign: 'right', flex: 1, marginLeft: spacing.md },
});
