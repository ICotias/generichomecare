/**
 * Lista de pacientes do CUIDADOR AUTÔNOMO, o profissional que atende por conta
 * própria e é dono do próprio tenant.
 *
 * Não é a tela do admin: aqui não há equipe nem escala, e a consulta é a mesma
 * restrita que ele já usa em campo (`array-contains` no uid dele). Rules não
 * são filtros, então consulta ampla seria negada por inteiro.
 *
 * A faixa do plano aparece no cabeçalho porque é o que decide se o botão de
 * novo paciente está disponível. Descobrir o limite só ao tocar seria pior.
 */
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as patientService from '../../../core/services/patientService';
import { LIMITE_PACIENTES, PLANO_LABEL } from '../../../core/types';
import type { Patient } from '../../../core/types';
import type { SoloStackParamList } from '../../../core/navigation/RootNavigator';

type NavProp = NativeStackNavigationProp<SoloStackParamList, 'SoloPatientList'>;

const calcAge = (d: Date) => {
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
};

export const SoloPatientListScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { user } = useAuthStore();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const plano = user?.planoAutonomo ?? 'inicio';
  const limite = LIMITE_PACIENTES[plano];
  const noLimite = limite !== null && patients.length >= limite;

  const load = useCallback(async () => {
    if (!user?.empresaId || !user?.uid) {
      setIsLoading(false);
      return;
    }
    try {
      setPatients(await patientService.listPatientsForNurse(user.empresaId, user.uid));
    } catch (e) {
      console.error('SoloPatientList load error', e);
      setPatients([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.empresaId, user?.uid]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      load();
    }, [load])
  );

  const renderItem = ({ item }: { item: Patient }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('PatientDetail', { patientId: item.id })}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.nome.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.nome}</Text>
        <Text style={styles.cardMeta}>{calcAge(item.dataNascimento)} anos</Text>
      </View>
      {item.cadastroCompleto === false && (
        <View style={styles.pendingTag}>
          <Text style={styles.pendingTagText}>Pendente</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Meus pacientes</Text>
          <Text style={styles.planLine}>
            Plano {PLANO_LABEL[plano]} ·{' '}
            {limite === null ? 'sem limite' : `${patients.length} de ${limite}`}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, noLimite && styles.addButtonOff]}
          onPress={() => navigation.navigate('SoloCreatePatient')}
          disabled={noLimite}
          activeOpacity={0.8}
        >
          <Text style={[styles.addButtonText, noLimite && styles.addButtonTextOff]}>+ Novo</Text>
        </TouchableOpacity>
      </View>

      {noLimite && (
        <View style={styles.limitBanner}>
          <Ionicons name="information-circle-outline" size={18} color={colors.warning} />
          <Text style={styles.limitText}>
            Você atingiu o limite do plano {PLANO_LABEL[plano]}. Fale com a gente para atender
            mais pacientes.
          </Text>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xxl }} />
      ) : (
        <FlatList
          data={patients}
          keyExtractor={(p) => p.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.xxl }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Nenhum paciente ainda</Text>
              <Text style={styles.emptyText}>
                Cadastre quem você atende para começar a registrar o cuidado.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary },
  planLine: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  addButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  addButtonOff: { backgroundColor: colors.border },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: fontSize.sm },
  addButtonTextOff: { color: colors.textMuted },
  limitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.warning + '1A',
  },
  limitText: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary, lineHeight: 18 },
  list: { paddingHorizontal: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.primary, fontWeight: '700', fontSize: fontSize.md },
  cardInfo: { flex: 1 },
  cardName: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  cardMeta: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  pendingTag: {
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.warning + '22',
  },
  pendingTagText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.warning },
  empty: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxl, paddingHorizontal: spacing.xl },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  emptyText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
