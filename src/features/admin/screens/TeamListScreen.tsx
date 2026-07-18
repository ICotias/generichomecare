import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { collection, getDocs, query, where } from 'firebase/firestore';

import { db } from '../../../core/config/firebase';
import { Collections } from '../../../shared/constants/firestore';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import { formatCoren } from '../../../shared/utils/formatters';
import type { TeamStackParamList } from '../../../core/navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<TeamStackParamList, 'TeamList'>;

interface TeamMember {
  uid: string;
  nome: string;
  email: string;
  telefone?: string;
  coren?: string;
  status: 'ativo' | 'inativo';
}

export const TeamListScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { user } = useAuthStore();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.empresaId) {
      setMembers([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const q = query(
        collection(db, Collections.USUARIOS),
        where('empresaId', '==', user.empresaId),
        where('role', '==', 'nurse')
      );
      const snap = await getDocs(q);
      const list: TeamMember[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            nome: data.nome ?? '',
            email: data.email ?? '',
            telefone: data.telefone,
            coren: formatCoren(data.corenRegistro),
            status: data.status ?? 'ativo',
          };
        })
        // Excluídos da equipe não aparecem na lista
        .filter((m) => m.status !== 'excluido');
      setMembers(list);
    } catch (err) {
      console.error('TeamList load error', err);
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  }, [user?.empresaId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const activeCount = members.filter((m) => m.status === 'ativo').length;

  const renderItem = ({ item }: { item: TeamMember }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.7}
      onPress={() => navigation.navigate('NurseDetail', { nurseId: item.uid })}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.avatar, item.status === 'inativo' && styles.avatarInactive]}>
          <Text style={styles.avatarText}>{item.nome.charAt(0)}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.nome}</Text>
          <Text style={styles.cardEmail}>{item.email}</Text>
          {item.coren && <Text style={styles.cardCoren}>{item.coren}</Text>}
        </View>
      </View>
      <View style={styles.cardRight}>
        <View style={[styles.statusBadge, item.status === 'inativo' && styles.statusBadgeInactive]}>
          <Text style={[styles.statusText, item.status === 'inativo' && styles.statusTextInactive]}>
            {item.status === 'ativo' ? 'Ativo' : 'Inativo'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Equipe</Text>
          <Text style={styles.subtitle}>
            {activeCount} profissional(is) ativo(s)
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.scheduleBtn}
            onPress={() => navigation.navigate('Schedule')}
            activeOpacity={0.7}
          >
            <Ionicons name="calendar-outline" size={16} color={colors.admin} />
            <Text style={styles.scheduleBtnText}>Escalas</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('CreateNurse')}
            activeOpacity={0.7}
          >
            <Text style={styles.addBtnText}>+ Novo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.admin} style={styles.loader} />
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => m.uid}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xxl }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { fontSize: fontSize.title, fontWeight: '700', color: colors.textPrimary },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.admin,
  },
  scheduleBtnText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.admin },
  addBtn: {
    backgroundColor: colors.admin,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  addBtnText: { fontSize: fontSize.sm, fontWeight: '700', color: colors.white },

  loader: { marginTop: spacing.xxl },
  list: { paddingHorizontal: spacing.lg },

  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing.md },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.admin + '1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInactive: { backgroundColor: colors.border },
  avatarText: { fontSize: fontSize.lg, fontWeight: '700', color: colors.admin },
  cardInfo: { flex: 1 },
  cardName: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  cardEmail: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  cardCoren: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: '500', marginTop: 2 },

  cardRight: { alignItems: 'flex-end', gap: spacing.xs },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    backgroundColor: '#DCFCE7',
  },
  statusBadgeInactive: { backgroundColor: '#F3F4F6' },
  statusText: { fontSize: fontSize.xs, fontWeight: '600', color: '#16A34A' },
  statusTextInactive: { color: colors.textMuted },
});
