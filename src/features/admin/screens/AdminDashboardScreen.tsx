import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';

import { db } from '../../../core/config/firebase';
import { Collections } from '../../../shared/constants/firestore';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';

// ════════════════════════════════════════════
// Types
// ════════════════════════════════════════════

interface DashboardMetrics {
  totalPacientes: number;
  pacientesAtivos: number;
  totalProfissionais: number;
  plantoesHoje: number;
  registrosHoje: number;
  intercorrenciasHoje: number;
}

const EMPTY_METRICS: DashboardMetrics = {
  totalPacientes: 0,
  pacientesAtivos: 0,
  totalProfissionais: 0,
  plantoesHoje: 0,
  registrosHoje: 0,
  intercorrenciasHoje: 0,
};

// ════════════════════════════════════════════
// Mock metrics for dev
// ════════════════════════════════════════════

const MOCK_METRICS: DashboardMetrics = {
  totalPacientes: 4,
  pacientesAtivos: 3,
  totalProfissionais: 6,
  plantoesHoje: 2,
  registrosHoje: 18,
  intercorrenciasHoje: 1,
};

// ════════════════════════════════════════════
// Component
// ════════════════════════════════════════════

export const AdminDashboardScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const navigation = useNavigation();

  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [usingMock, setUsingMock] = useState(false);

  const today = new Date();
  const greeting = today.getHours() < 12 ? 'Bom dia' : today.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const dateLabel = today.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const load = useCallback(async () => {
    if (!user?.empresaId) {
      setMetrics(MOCK_METRICS);
      setUsingMock(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const empresaId = user.empresaId;

      // Today boundaries
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const todayTs = Timestamp.fromDate(startOfDay);

      // Fetch patients
      const patSnap = await getDocs(collection(db, Collections.pacientes(empresaId)));
      const totalPacientes = patSnap.size;
      const pacientesAtivos = patSnap.docs.filter((d) => d.data().status === 'ativo').length;

      // Fetch professionals
      const profQ = query(
        collection(db, Collections.USUARIOS),
        where('empresaId', '==', empresaId),
        where('role', '==', 'nurse')
      );
      const profSnap = await getDocs(profQ);
      const totalProfissionais = profSnap.size;

      // Today shifts
      const shiftQ = query(
        collection(db, Collections.plantoes(empresaId)),
        where('checkinTime', '>=', todayTs)
      );
      const shiftSnap = await getDocs(shiftQ);
      const plantoesHoje = shiftSnap.size;

      // Today records — count across all patients
      let registrosHoje = 0;
      let intercorrenciasHoje = 0;

      for (const patDoc of patSnap.docs) {
        const regQ = query(
          collection(db, Collections.registros(empresaId, patDoc.id)),
          where('timestamp', '>=', todayTs)
        );
        const regSnap = await getDocs(regQ);
        registrosHoje += regSnap.size;
        intercorrenciasHoje += regSnap.docs.filter((d) => d.data().type === 'intercorrencia').length;
      }

      const data: DashboardMetrics = {
        totalPacientes,
        pacientesAtivos,
        totalProfissionais,
        plantoesHoje,
        registrosHoje,
        intercorrenciasHoje,
      };

      const isEmpty = Object.values(data).every((v) => v === 0);
      if (isEmpty) {
        setMetrics(MOCK_METRICS);
        setUsingMock(true);
      } else {
        setMetrics(data);
        setUsingMock(false);
      }
    } catch (err) {
      console.error('Dashboard load error', err);
      setMetrics(MOCK_METRICS);
      setUsingMock(true);
    } finally {
      setIsLoading(false);
    }
  }, [user?.empresaId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    load().finally(() => setIsRefreshing(false));
  }, [load]);

  // ════════════════════════════════════════════

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.admin}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.userName}>{user?.nome ?? 'Admin'}</Text>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
        </View>

        {usingMock && (
          <View style={styles.mockBanner}>
            <Text style={styles.mockText}>Dados de exemplo — métricas reais aparecerão aqui.</Text>
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.admin} style={styles.loader} />
        ) : (
          <>
            {/* Main metrics — 2 big cards */}
            <View style={styles.bigCardRow}>
              <MetricCard
                label="Pacientes ativos"
                value={metrics.pacientesAtivos}
                total={metrics.totalPacientes}
                color={colors.admin}
              />
              <MetricCard
                label="Profissionais"
                value={metrics.totalProfissionais}
                color="#8B5CF6"
              />
            </View>

            {/* Today stats */}
            <Text style={styles.sectionTitle}>HOJE</Text>
            <View style={styles.statsRow}>
              <StatCard label="Plantões" value={metrics.plantoesHoje} icon="medical-outline" />
              <StatCard label="Registros" value={metrics.registrosHoje} icon="document-text-outline" />
              <StatCard
                label="Intercorrências"
                value={metrics.intercorrenciasHoje}
                icon="warning-outline"
                isAlert={metrics.intercorrenciasHoje > 0}
              />
            </View>

            {/* Quick actions */}
            <Text style={styles.sectionTitle}>AÇÕES RÁPIDAS</Text>
            <View style={styles.actionsCol}>
              <ActionRow
                label="Ver lista de pacientes"
                hint="Pacientes → Lista"
                onPress={() => (navigation as any).navigate('PatientMgmtStack', { screen: 'PatientList' })}
              />
              <ActionRow
                label="Cadastrar profissional"
                hint="Equipe → Novo"
                onPress={() => (navigation as any).navigate('TeamStack', { screen: 'CreateNurse' })}
              />
              <ActionRow
                label="Vincular família"
                hint="Pacientes → Vincular"
                onPress={() => (navigation as any).navigate('PatientMgmtStack', { screen: 'LinkFamily' })}
              />
              <ActionRow
                label="Gerenciar escalas"
                hint="Equipe → Escalas"
                onPress={() => (navigation as any).navigate('TeamStack', { screen: 'Schedule' })}
              />
              <ActionRow
                label="Financeiro"
                hint="Receitas, despesas e PDF"
                onPress={() => (navigation as any).navigate('Financial')}
              />
              <ActionRow
                label="Exportar relatório"
                hint="Paciente → Exportar PDF"
                onPress={() => (navigation as any).navigate('ExportReport')}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

// ════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════

const MetricCard = ({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total?: number;
  color: string;
}) => (
  <View style={[styles.bigCard, styles.bigCardStrip, { borderLeftColor: color }]}>
    <Text style={styles.bigCardLabel}>{label}</Text>
    <View style={styles.bigCardValueRow}>
      <Text style={[styles.bigCardValue, { color }]}>{value}</Text>
      {total != null && <Text style={styles.bigCardTotal}>/ {total}</Text>}
    </View>
  </View>
);

const StatCard = ({
  label,
  value,
  icon,
  isAlert,
}: {
  label: string;
  value: number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  isAlert?: boolean;
}) => (
  <View style={[styles.statCard, isAlert && styles.statCardAlert]}>
    <Ionicons name={icon} size={20} color={isAlert ? '#DC2626' : colors.textSecondary} style={styles.statIcon} />
    <Text style={[styles.statValue, isAlert && styles.statValueAlert]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const ActionRow = ({ label, hint, onPress }: { label: string; hint: string; onPress?: () => void }) => (
  <TouchableOpacity style={styles.actionRow} activeOpacity={0.7} onPress={onPress}>
    <View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionHint}>{hint}</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
  </TouchableOpacity>
);

// ════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: spacing.lg },
  loader: { marginTop: spacing.xxl },

  // Header
  header: { marginBottom: spacing.lg, paddingTop: spacing.md },
  greeting: { fontSize: fontSize.md, color: colors.textSecondary },
  userName: { fontSize: fontSize.title, fontWeight: '700', color: colors.textPrimary, marginTop: 2 },
  dateLabel: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.xs },

  mockBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  mockText: { fontSize: fontSize.xs, color: '#92400E', fontWeight: '500' },

  // Big cards
  bigCardRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  bigCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  bigCardStrip: { borderLeftWidth: 4 },
  bigCardLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.5 },
  bigCardValueRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.xs },
  bigCardValue: { fontSize: 36, fontWeight: '800' },
  bigCardTotal: { fontSize: fontSize.lg, color: colors.textMuted, fontWeight: '500', marginLeft: 4 },

  // Section
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statCardAlert: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  statIcon: { marginBottom: spacing.xs },
  statValue: { fontSize: fontSize.xxl, fontWeight: '800', color: colors.textPrimary },
  statValueAlert: { color: '#DC2626' },
  statLabel: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '500', marginTop: 2 },

  // Actions
  actionsCol: { gap: spacing.sm, marginBottom: spacing.lg },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  actionHint: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
});
