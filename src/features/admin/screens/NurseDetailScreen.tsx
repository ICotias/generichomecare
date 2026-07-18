import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

import { db } from '../../../core/config/firebase';
import { Collections } from '../../../shared/constants/firestore';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as patientService from '../../../core/services/patientService';
import type { Patient } from '../../../core/types';
import { formatCoren } from '../../../shared/utils/formatters';
import type { TeamStackParamList } from '../../../core/navigation/RootNavigator';

type RouteType = RouteProp<TeamStackParamList, 'NurseDetail'>;

interface NurseData {
  uid: string;
  nome: string;
  email: string;
  telefone: string;
  coren?: string;
  /** Quem atestou a conferência do COREN no Cofen, e quando */
  corenVerificadoEm?: Date;
  status: string;
  createdAt?: Date;
}

export const NurseDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteType>();
  const nurseId = route.params?.nurseId;

  const { user } = useAuthStore();

  const [nurse, setNurse] = useState<NurseData | null>(null);
  const [authorized, setAuthorized] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isReactivating, setIsReactivating] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const handleDeactivate = () => {
    if (!nurseId) return;

    Alert.alert(
      'Desativar Conta',
      `Tem certeza que deseja desativar a conta de ${nurse?.nome ?? 'este profissional'}? O profissional não poderá mais acessar o app.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar',
          style: 'destructive',
          onPress: async () => {
            setIsDeactivating(true);
            try {
              await updateDoc(doc(db, Collections.USUARIOS, nurseId), { ativo: false, status: 'inativo' });
              // Revoga o acesso aos pacientes: desativar a conta não basta, a
              // leitura do prontuário depende da lista de autorizados.
              if (user?.empresaId) {
                await patientService.deauthorizeNurseEverywhere(user.empresaId, nurseId);
              }
              Alert.alert('Conta desativada', 'O profissional foi desativado com sucesso.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (err) {
              console.error('Erro ao desativar profissional:', err);
              Alert.alert('Erro', 'Não foi possível desativar o profissional. Tente novamente.');
            } finally {
              setIsDeactivating(false);
            }
          },
        },
      ]
    );
  };

  const handleReactivate = () => {
    if (!nurseId) return;
    Alert.alert(
      'Reativar conta',
      `Reativar a conta de ${nurse?.nome ?? 'este profissional'}? Ele volta a poder entrar no app. ` +
        'O acesso aos pacientes NÃO é devolvido automaticamente: escale-o de novo para autorizar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reativar',
          onPress: async () => {
            setIsReactivating(true);
            try {
              await updateDoc(doc(db, Collections.USUARIOS, nurseId), { ativo: true, status: 'ativo' });
              Alert.alert('Conta reativada', 'O profissional já pode acessar o app. Escale-o para dar acesso aos pacientes.', [
                { text: 'OK', onPress: () => load() },
              ]);
            } catch (err) {
              console.error('Erro ao reativar profissional:', err);
              Alert.alert('Erro', 'Não foi possível reativar. Tente novamente.');
            } finally {
              setIsReactivating(false);
            }
          },
        },
      ]
    );
  };

  const handleRemove = () => {
    if (!nurseId) return;
    Alert.alert(
      'Excluir da equipe',
      `Remover ${nurse?.nome ?? 'este profissional'} da equipe? Ele deixará de aparecer na lista.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setIsRemoving(true);
            try {
              await updateDoc(doc(db, Collections.USUARIOS, nurseId), { ativo: false, status: 'excluido' });
              if (user?.empresaId) {
                await patientService.deauthorizeNurseEverywhere(user.empresaId, nurseId);
              }
              Alert.alert('Removido', 'O profissional foi removido da equipe.', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (err) {
              console.error('Erro ao excluir profissional:', err);
              Alert.alert('Erro', 'Não foi possível excluir o profissional. Tente novamente.');
            } finally {
              setIsRemoving(false);
            }
          },
        },
      ]
    );
  };

  const load = useCallback(async () => {
    if (!nurseId) {
      setNurse(null);
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
          coren: formatCoren(d.corenRegistro),
          corenVerificadoEm: d.corenRegistro?.verificadoEm?.toDate?.() ?? undefined,
          status: d.status ?? 'ativo',
          createdAt: d.createdAt?.toDate?.() ?? undefined,
        });
      } else {
        setNurse(null);
      }
      if (user?.empresaId) {
        const pacientes = await patientService
          .listPatientsAuthorizedFor(user.empresaId, nurseId)
          .catch(() => []);
        setAuthorized(pacientes);
      }
    } catch (err) {
      console.error('NurseDetail load error', err);
      setNurse(null);
    } finally {
      setIsLoading(false);
    }
  }, [nurseId, user?.empresaId]);

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
          {nurse.coren ? <InfoRow label="COREN" value={nurse.coren} /> : null}
          {nurse.coren ? (
            <InfoRow
              label="Registro conferido"
              value={
                nurse.corenVerificadoEm
                  ? `Sim, em ${nurse.corenVerificadoEm.toLocaleDateString('pt-BR')}`
                  : 'Não conferido'
              }
            />
          ) : null}
          {nurse.createdAt && (
            <InfoRow
              label="Cadastrado em"
              value={nurse.createdAt.toLocaleDateString('pt-BR')}
              isLast
            />
          )}
        </View>

        {/* Pacientes que este enfermeiro pode acessar */}
        <Text style={styles.sectionTitle}>PACIENTES AUTORIZADOS</Text>
        <View style={styles.infoCard}>
          {authorized.length === 0 ? (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>
                Nenhum paciente. O enfermeiro só enxerga quem estiver aqui, e é a
                escala que autoriza.
              </Text>
            </View>
          ) : (
            authorized.map((p, i) => (
              <InfoRow
                key={p.id}
                label={p.nome}
                value=""
                isLast={i === authorized.length - 1}
              />
            ))
          )}
        </View>

        {/* Deactivate button */}
        {isActive && (
          <TouchableOpacity
            style={[styles.deactivateBtn, isDeactivating && styles.deactivateBtnDisabled]}
            onPress={handleDeactivate}
            activeOpacity={0.8}
            disabled={isDeactivating}
          >
            {isDeactivating ? (
              <ActivityIndicator color={colors.error} />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                <Text style={styles.deactivateBtnText}>Desativar Conta</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Reactivate button — só para conta desativada (não para excluída) */}
        {nurse.status === 'inativo' && (
          <TouchableOpacity
            style={[styles.reactivateBtn, isReactivating && styles.deactivateBtnDisabled]}
            onPress={handleReactivate}
            activeOpacity={0.8}
            disabled={isReactivating}
          >
            {isReactivating ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.primary} />
                <Text style={styles.reactivateBtnText}>Reativar Conta</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Remover da equipe */}
        <TouchableOpacity
          style={[styles.removeBtn, isRemoving && styles.deactivateBtnDisabled]}
          onPress={handleRemove}
          activeOpacity={0.85}
          disabled={isRemoving}
        >
          {isRemoving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="trash-outline" size={20} color={colors.white} />
              <Text style={styles.removeBtnText}>Excluir da equipe</Text>
            </>
          )}
        </TouchableOpacity>
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

  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  emptyRow: {
    paddingVertical: spacing.xs,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 19,
  },
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

  deactivateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.surface,
    height: 52,
  },
  deactivateBtnDisabled: { opacity: 0.5 },
  deactivateBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.error,
  },
  reactivateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    height: 52,
  },
  reactivateBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.primary,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.error,
  },
  removeBtnText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.white,
  },
});
