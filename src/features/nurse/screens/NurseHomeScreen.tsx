import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { differenceInYears } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as patientService from '../../../core/services/patientService';
import * as scheduleService from '../../../core/services/scheduleService';
import type { Patient, Schedule } from '../../../core/types';
import type { NurseHomeStackParamList } from '../../../core/navigation/RootNavigator';
import { EmptyState } from '../../../shared/components/EmptyState';
import { MOCK_PATIENTS } from '../../../core/mocks/patients';

type NavProp = NativeStackNavigationProp<NurseHomeStackParamList, 'NurseHome'>;

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

type NurseSchedule = Schedule & { profissionalNome: string; pacienteNome: string };

const TIPO_LABELS: Record<Patient['tipoAtendimento'], string> = {
  integral: '24h',
  diurno: 'Diurno',
  noturno: 'Noturno',
  visita: 'Visita',
};

const calcAge = (birth: Date): number => differenceInYears(new Date(), birth);

const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia,';
  if (h < 18) return 'Boa tarde,';
  return 'Boa noite,';
};

export const NurseHomeScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { user } = useAuthStore();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [escala, setEscala] = useState<NurseSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadPatients = useCallback(
    async (silent = false) => {
      if (!user?.empresaId) {
        setIsLoading(false);
        return;
      }
      if (!silent) setIsLoading(true);
      setError(null);

      try {
        const list = await patientService.listPatients(user.empresaId);
        setPatients(list.length > 0 ? list : MOCK_PATIENTS);
        if (user.uid) {
          scheduleService
            .listSchedulesForNurse(user.empresaId, user.uid)
            .then(setEscala)
            .catch((e) => console.error('NurseHome escala error', e));
        }
      } catch (err) {
        setError('Não foi possível carregar os pacientes.');
        console.error('NurseHome loadPatients error', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user?.empresaId, user?.uid]
  );

  useFocusEffect(
    useCallback(() => {
      loadPatients();
    }, [loadPatients])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    loadPatients(true);
  };

  const firstName = user?.nome?.split(' ')[0] ?? 'Enfermeiro(a)';

  const filtered = search.trim()
    ? patients.filter((p) => p.nome.toLowerCase().includes(search.toLowerCase().trim()))
    : patients;

  // ── Card com borda esquerda roxa ──
  const renderPatient = ({ item }: { item: Patient }) => {
    const age = calcAge(item.dataNascimento);
    const hasAllergies = item.alergias.length > 0;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('PatientDetail', { patientId: item.id })}
      >
        {/* Borda lateral esquerda roxa */}
        <View style={styles.cardLeftBorder} />

        <View style={styles.cardInner}>
          {/* Avatar */}
          <View style={styles.cardAvatar}>
            <Text style={styles.cardAvatarText}>
              {item.nome.charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.cardContent}>
            <View style={styles.cardTopRow}>
              <Text style={styles.cardName} numberOfLines={1}>
                {item.nome}
              </Text>
              {hasAllergies && (
                <Text style={styles.alertIcon}>⚠</Text>
              )}
            </View>
            <Text style={styles.cardMeta}>
              {age} anos · {TIPO_LABELS[item.tipoAtendimento]}
            </Text>
            {item.diagnosticos.length > 0 && (
              <View style={styles.diagRow}>
                {item.diagnosticos.slice(0, 3).map((d, i) => (
                  <View key={i} style={styles.diagTag}>
                    <Text style={styles.diagTagText}>{d}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Escalinha do enfermeiro (ListHeaderComponent) ──
  const today = new Date().getDay();
  const renderEscalaHeader = () => {
    if (escala.length === 0) return null;
    return (
      <View style={styles.escalaCard}>
        <Text style={styles.escalaTitle}>MINHA ESCALA</Text>
        {escala.map((e) => {
          const isToday = e.diaSemana === today;
          return (
            <View key={e.id} style={[styles.escalaRow, isToday && styles.escalaRowToday]}>
              <View style={[styles.escalaDay, isToday && styles.escalaDayToday]}>
                <Text style={[styles.escalaDayText, isToday && styles.escalaDayTextToday]}>
                  {WEEKDAYS[e.diaSemana]}
                </Text>
              </View>
              <View style={styles.escalaInfo}>
                <Text style={styles.escalaPatient} numberOfLines={1}>{e.pacienteNome}</Text>
                <Text style={styles.escalaTime}>{e.horaInicio} às {e.horaFim}</Text>
              </View>
              {isToday && <Text style={styles.escalaHoje}>Hoje</Text>}
            </View>
          );
        })}
      </View>
    );
  };

  // ════════════════════════════════════════════

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.name}>{firstName}</Text>
        {patients.length > 0 && (
          <Text style={styles.subtitle}>
            Você tem <Text style={styles.subtitleBold}>{patients.length} pacientes</Text> ativos na sua lista.
          </Text>
        )}
      </View>

      {/* Search */}
      {patients.length > 0 && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar paciente..."
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              autoCorrect={false}
            />
          </View>
        </View>
      )}

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
      ) : patients.length === 0 ? (
        <EmptyState
          title="Nenhum paciente"
          subtitle="Não há pacientes cadastrados na empresa ainda. O administrador precisa cadastrar os pacientes."
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderPatient}
          ListHeaderComponent={renderEscalaHeader()}
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
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  greeting: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.35,
  },
  name: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.35,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  subtitleBold: {
    fontWeight: '700',
    color: colors.textPrimary,
  },

  // Search
  searchContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  // searchIcon removed — using Ionicons directly
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    height: '100%',
  },

  // List
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Escalinha
  escalaCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  escalaTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  escalaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  escalaRowToday: {
    backgroundColor: colors.primary + '0F',
    paddingHorizontal: spacing.sm,
  },
  escalaDay: {
    width: 40,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  escalaDayToday: { backgroundColor: colors.primary },
  escalaDayText: { fontSize: fontSize.xs, fontWeight: '700', color: colors.textSecondary },
  escalaDayTextToday: { color: colors.white },
  escalaInfo: { flex: 1 },
  escalaPatient: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary },
  escalaTime: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 1 },
  escalaHoje: { fontSize: fontSize.xs, fontWeight: '700', color: colors.primary },

  // Card — borda esquerda colorida
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardLeftBorder: {
    width: 4,
    backgroundColor: colors.primary,
    borderTopLeftRadius: borderRadius.md,
    borderBottomLeftRadius: borderRadius.md,
  },
  cardInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  cardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardAvatarText: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.primary,
  },
  cardContent: {
    flex: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  alertIcon: {
    fontSize: 16,
    color: colors.warning,
    marginLeft: spacing.xs,
  },
  cardMeta: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Diagnosis tags dentro do card
  diagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  diagTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.border,
  },
  diagTagText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  // Centered
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
