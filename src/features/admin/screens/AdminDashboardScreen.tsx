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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  collection,
  collectionGroup,
  getDocs,
  getCountFromServer,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { db } from '../../../core/config/firebase';
import { Collections } from '../../../shared/constants/firestore';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import type { DashboardStackParamList } from '../../../core/navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<DashboardStackParamList, 'AdminDashboard'>;

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

interface RecentIncident {
  id: string;
  pacienteNome: string;
  tipoIncidente: string;
  gravidade: string;
  timestamp: Date;
}

interface ActiveShiftInfo {
  id: string;
  pacienteNome: string;
  profissionalNome: string;
  checkinAt: Date;
}

const GRAVIDADE_COLOR: Record<string, string> = {
  leve: colors.success,
  moderado: colors.warning,
  grave: colors.error,
};

// ════════════════════════════════════════════
// Component
// ════════════════════════════════════════════

export const AdminDashboardScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { user } = useAuthStore();

  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [recentIncidents, setRecentIncidents] = useState<RecentIncident[]>([]);
  const [activeShifts, setActiveShifts] = useState<ActiveShiftInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const today = new Date();
  const greeting = today.getHours() < 12 ? 'Bom dia' : today.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const dateLabel = today.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const load = useCallback(async () => {
    if (!user?.empresaId) {
      setMetrics(EMPTY_METRICS);
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
      const nomeById: Record<string, string> = {};
      patSnap.docs.forEach((d) => {
        nomeById[d.id] = d.data().nome ?? 'Paciente';
      });

      // Fetch professionals
      const profQ = query(
        collection(db, Collections.USUARIOS),
        where('empresaId', '==', empresaId),
        where('role', '==', 'nurse')
      );
      const profSnap = await getDocs(profQ);
      const totalProfissionais = profSnap.size;

      // Plantões em andamento agora
      const activeQ = query(
        collection(db, Collections.plantoes(empresaId)),
        where('status', '==', 'em_andamento')
      );
      const activeSnap = await getDocs(activeQ);
      const active: ActiveShiftInfo[] = activeSnap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          pacienteNome: x.pacienteNome ?? nomeById[x.pacienteId] ?? 'Paciente',
          profissionalNome: x.profissionalNome ?? 'Profissional',
          checkinAt: x.checkinAt?.toDate?.() ?? new Date(),
        };
      });

      // Plantões iniciados hoje (contagem)
      const shiftQ = query(
        collection(db, Collections.plantoes(empresaId)),
        where('checkinAt', '>=', todayTs)
      );
      const shiftSnap = await getDocs(shiftQ);
      const plantoesHoje = shiftSnap.size;

      // Registros e intercorrências de hoje são apenas CONTAGENS, então usamos
      // count() do Firestore: devolve só o número, sem baixar o corpo dos
      // documentos. Substitui o N+1 (duas queries por paciente) por consultas
      // collectionGroup agregadas. Depende de empresaId no doc do registro
      // (garantido em registroService) e dos índices em firestore.indexes.json.
      const todayRegsQ = query(
        collectionGroup(db, 'registros'),
        where('empresaId', '==', empresaId),
        where('timestamp', '>=', todayTs)
      );
      const registrosHoje = (await getCountFromServer(todayRegsQ)).data().count;

      const todayIncQ = query(
        collectionGroup(db, 'registros'),
        where('empresaId', '==', empresaId),
        where('type', '==', 'intercorrencia'),
        where('timestamp', '>=', todayTs)
      );
      const intercorrenciasHoje = (await getCountFromServer(todayIncQ)).data().count;

      // Só aqui baixamos documentos: as 5 intercorrências mais recentes, que
      // são de fato exibidas na lista.
      const recentIncQ = query(
        collectionGroup(db, 'registros'),
        where('empresaId', '==', empresaId),
        where('type', '==', 'intercorrencia'),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      const recentIncSnap = await getDocs(recentIncQ);
      const incidents: RecentIncident[] = recentIncSnap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          pacienteNome: nomeById[x.pacienteId] ?? 'Paciente',
          tipoIncidente: x.tipoIncidente ?? 'Intercorrência',
          gravidade: x.gravidade ?? '',
          timestamp: x.timestamp?.toDate?.() ?? new Date(),
        };
      });

      setRecentIncidents(incidents);
      setActiveShifts(active);

      setMetrics({
        totalPacientes,
        pacientesAtivos,
        totalProfissionais,
        plantoesHoje,
        registrosHoje,
        intercorrenciasHoje,
      });
    } catch (err) {
      console.error('Dashboard load error', err);
      setMetrics(EMPTY_METRICS);
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

            {/* Plantões em andamento agora */}
            <Text style={styles.sectionTitle}>PLANTÕES EM ANDAMENTO</Text>
            <View style={styles.listCard}>
              {activeShifts.length === 0 ? (
                <Text style={styles.emptyText}>Nenhum plantão em andamento.</Text>
              ) : (
                activeShifts.map((s, idx) => (
                  <View
                    key={s.id}
                    style={[styles.listRow, idx < activeShifts.length - 1 && styles.listRowBorder]}
                  >
                    <View style={[styles.listIcon, { backgroundColor: colors.admin + '1A' }]}>
                      <Ionicons name="time-outline" size={16} color={colors.admin} />
                    </View>
                    <View style={styles.listInfo}>
                      <Text style={styles.listTitle}>{s.pacienteNome}</Text>
                      <Text style={styles.listMeta}>
                        {s.profissionalNome} · desde {format(s.checkinAt, 'HH:mm', { locale: ptBR })}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Intercorrências recentes */}
            <Text style={styles.sectionTitle}>INTERCORRÊNCIAS RECENTES</Text>
            <View style={styles.listCard}>
              {recentIncidents.length === 0 ? (
                <Text style={styles.emptyText}>Nenhuma intercorrência registrada.</Text>
              ) : (
                recentIncidents.map((inc, idx) => (
                  <View
                    key={inc.id}
                    style={[styles.listRow, idx < recentIncidents.length - 1 && styles.listRowBorder]}
                  >
                    <View style={[styles.listIcon, styles.listIconError]}>
                      <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                    </View>
                    <View style={styles.listInfo}>
                      <Text style={styles.listTitle}>{inc.pacienteNome}</Text>
                      <Text style={styles.listMeta}>
                        {inc.tipoIncidente}
                        {inc.gravidade ? ` · ${inc.gravidade}` : ''} ·{' '}
                        {format(inc.timestamp, 'dd/MM HH:mm', { locale: ptBR })}
                      </Text>
                    </View>
                    {inc.gravidade ? (
                      <View
                        style={[
                          styles.gravidadeDot,
                          { backgroundColor: GRAVIDADE_COLOR[inc.gravidade] ?? colors.textMuted },
                        ]}
                      />
                    ) : null}
                  </View>
                ))
              )}
            </View>

            {/* Financeiro */}
            <TouchableOpacity
              style={styles.financeCard}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Financial')}
            >
              <View style={styles.financeIcon}>
                <Ionicons name="cash-outline" size={22} color={colors.white} />
              </View>
              <View style={styles.financeInfo}>
                <Text style={styles.financeTitle}>Financeiro</Text>
                <Text style={styles.financeHint}>Receitas, despesas e relatório do mês</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
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

  // Listas (plantões / intercorrências)
  listCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
  },
  listRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  listIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listIconError: { backgroundColor: '#FEF2F2' },
  listInfo: { flex: 1 },
  listTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary },
  listMeta: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
  gravidadeDot: { width: 8, height: 8, borderRadius: 4 },

  // Financeiro card
  financeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  financeIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.admin,
    justifyContent: 'center',
    alignItems: 'center',
  },
  financeInfo: { flex: 1 },
  financeTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  financeHint: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },

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
});
