import { useState, useCallback } from 'react';
import { differenceInYears } from 'date-fns';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as patientService from '../../../core/services/patientService';
import type { Patient } from '../../../core/types';
import type { PatientMgmtStackParamList } from '../../../core/navigation/RootNavigator';
import { EmptyState } from '../../../shared/components/EmptyState';

type NavProp = NativeStackNavigationProp<PatientMgmtStackParamList, 'PatientList'>;

const STATUS_COLORS: Record<Patient['status'], string> = {
  ativo: colors.success,
  inativo: colors.textMuted,
  alta: colors.warning,
};

const STATUS_LABELS: Record<Patient['status'], string> = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  alta: 'Alta',
};

const TIPO_LABELS: Record<Patient['tipoAtendimento'], string> = {
  integral: '24h',
  diurno: 'Diurno',
  noturno: 'Noturno',
  visita: 'Visita',
};

export const PatientListScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { user } = useAuthStore();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadPatients = useCallback(
    async (silent = false) => {
      if (!user?.empresaId) return;
      if (!silent) setIsLoading(true);
      setError(null);

      try {
        const list = await patientService.listPatients(user.empresaId, {
          includeInactive: true,
        });
        setPatients(list);
      } catch (err) {
        setError('Não foi possível carregar os pacientes.');
        console.error('loadPatients error', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user?.empresaId]
  );

  // Recarrega ao focar a tela (ex.: após criar paciente)
  useFocusEffect(
    useCallback(() => {
      loadPatients();
    }, [loadPatients])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    loadPatients(true);
  };

  // Filtro de busca
  const filtered = search.trim()
    ? patients.filter((p) => p.nome.toLowerCase().includes(search.toLowerCase().trim()))
    : patients;

  const calcAge = (birth: Date): number => differenceInYears(new Date(), birth);

  // ── Card renderer ──
  const renderPatient = ({ item }: { item: Patient }) => {
    const age = calcAge(item.dataNascimento);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('AdminPatientDetail', { patientId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName} numberOfLines={1}>
              {item.nome}
            </Text>
            <Text style={styles.cardMeta}>
              {age} anos · {TIPO_LABELS[item.tipoAtendimento]}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '1A' }]}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] }]} />
            <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
              {STATUS_LABELS[item.status]}
            </Text>
          </View>
        </View>
        {item.diagnosticos.length > 0 && (
          <Text style={styles.cardDiag} numberOfLines={1}>
            {item.diagnosticos.join(', ')}
          </Text>
        )}
        {item.cadastroCompleto === false && (
          <View style={styles.pendingTag}>
            <Ionicons name="time-outline" size={13} color={colors.warning} />
            <Text style={styles.pendingTagText}>Aguardando família</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Pacientes</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('CreatePatient')}
          activeOpacity={0.8}
        >
          <Text style={styles.addButtonText}>+ Novo</Text>
        </TouchableOpacity>
      </View>

      {/* Convidar família — fluxo principal: a família entra e cadastra o paciente */}
      <TouchableOpacity
        style={styles.inviteButton}
        onPress={() => navigation.navigate('InviteFamily')}
        activeOpacity={0.8}
      >
        <Ionicons name="person-add-outline" size={18} color={colors.primary} />
        <Text style={styles.inviteButtonText}>Convidar família</Text>
      </TouchableOpacity>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar paciente…"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCorrect={false}
        />
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <EmptyState
          title="Erro ao carregar"
          subtitle={error}
          actionLabel="Tentar novamente"
          onAction={() => loadPatients()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? 'Nenhum resultado' : 'Nenhum paciente'}
          subtitle={
            search
              ? `Nenhum paciente encontrado para "${search}".`
              : 'Cadastre o primeiro paciente para começar.'
          }
          actionLabel={search ? undefined : '+ Cadastrar paciente'}
          onAction={search ? undefined : () => navigation.navigate('CreatePatient')}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderPatient}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </View>
  );
};

// ════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.35,
  },
  addButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
  },
  addButtonText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },

  // Convidar família (CTA do fluxo principal)
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '14',
    borderWidth: 1,
    borderColor: colors.primary + '33',
  },
  inviteButtonText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },

  // Search
  searchContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  searchInput: {
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },

  // List
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  cardName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  cardMeta: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardDiag: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  pendingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    backgroundColor: colors.warning + '1A',
  },
  pendingTagText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.warning,
  },

  // Status badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
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

  // Centered loading
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
