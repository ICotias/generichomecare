import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { format } from 'date-fns';

import { db } from '../../../core/config/firebase';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import { ScreenHeader } from '../../../shared/components/ui/ScreenHeader';
import { Collections } from '../../../shared/constants/firestore';

interface ShiftItem {
  id: string;
  pacienteId: string;
  pacienteNome?: string;
  checkinAt: Date;
  checkoutAt?: Date;
  status: 'em_andamento' | 'finalizado';
}

const formatDuration = (checkin: Date, checkout?: Date): string => {
  const end = checkout ?? new Date();
  const diffMs = end.getTime() - checkin.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}min`;
};

const ShiftCard = ({ item }: { item: ShiftItem }) => {
  const isActive = item.status === 'em_andamento';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.patientName} numberOfLines={1}>
            {item.pacienteNome || item.pacienteId}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: isActive ? colors.info + '15' : colors.success + '15' },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isActive ? colors.info : colors.success },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              { color: isActive ? colors.info : colors.success },
            ]}
          >
            {isActive ? 'Em andamento' : 'Finalizado'}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
          <Text style={styles.infoText}>
            {format(item.checkinAt, 'dd/MM/yyyy')}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color={colors.textMuted} />
          <Text style={styles.infoText}>
            {format(item.checkinAt, 'HH:mm')}
            {' - '}
            {item.checkoutAt ? format(item.checkoutAt, 'HH:mm') : 'Em andamento'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="hourglass-outline" size={16} color={colors.textMuted} />
          <Text style={styles.infoText}>
            {formatDuration(item.checkinAt, item.checkoutAt)}
          </Text>
        </View>
      </View>
    </View>
  );
};

const EmptyState = () => (
  <View style={styles.emptyContainer}>
    <Ionicons name="calendar-outline" size={64} color={colors.textMuted} />
    <Text style={styles.emptyTitle}>Nenhum plantão registrado</Text>
    <Text style={styles.emptySubtitle}>
      Seus plantões aparecerão aqui após o primeiro check-in.
    </Text>
  </View>
);

export const ShiftHistoryScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchShifts = useCallback(async () => {
    if (!user?.uid || !user?.empresaId) {
      setShifts([]);
      setLoading(false);
      return;
    }

    try {
      const collectionPath = Collections.plantoes(user.empresaId);
      const q = query(
        collection(db, collectionPath),
        where('profissionalId', '==', user.uid),
        orderBy('checkinAt', 'desc'),
        limit(20)
      );

      const snapshot = await getDocs(q);
      const results: ShiftItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          pacienteId: data.pacienteId ?? '',
          pacienteNome: data.pacienteNome,
          checkinAt: data.checkinAt?.toDate?.() ?? new Date(),
          checkoutAt: data.checkoutAt?.toDate?.(),
          status: data.status ?? 'em_andamento',
        };
      });

      setShifts(results);
    } catch (error) {
      console.error('Erro ao buscar plantões:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.uid, user?.empresaId]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchShifts();
    setRefreshing(false);
  }, [fetchShifts]);

  if (loading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
        <ScreenHeader title="Meus" subtitle="Plantões" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <ScreenHeader title="Meus" subtitle="Plantões" showBack />

      <FlatList
        data={shifts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ShiftCard item={item} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + spacing.xxl },
          shifts.length === 0 && styles.emptyList,
        ]}
        ListEmptyComponent={EmptyState}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  patientName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  cardBody: {
    gap: spacing.xs + 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
