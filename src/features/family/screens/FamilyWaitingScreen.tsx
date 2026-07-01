import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, onSnapshot } from 'firebase/firestore';

import { db } from '../../../core/config/firebase';
import { useAuthStore } from '../../../core/hooks/useAuth';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';

/**
 * Tela mostrada à família que já tem conta mas ainda NÃO tem paciente vinculado.
 * No fluxo família-primeiro (admin cria o paciente), a família aguarda o admin
 * criar/vincular o paciente. Quando isso acontece, o listener detecta e o app
 * avança automaticamente para o cadastro pendente.
 */
export const FamilyWaitingScreen = () => {
  const insets = useSafeAreaInsets();
  const { user, refreshUser, signOut } = useAuthStore();
  const [isChecking, setIsChecking] = useState(false);

  // Detecta em tempo real quando o admin vincular um paciente a esta conta.
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'usuarios', user.uid), (snap) => {
      const data = snap.data();
      if (data?.pacienteId) {
        refreshUser(); // atualiza o store → RootNavigator sai desta tela
      }
    });
    return unsub;
  }, [user?.uid, refreshUser]);

  const handleRefresh = async () => {
    setIsChecking(true);
    try {
      await refreshUser();
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="hourglass-outline" size={40} color={colors.family} />
        </View>

        <Text style={styles.title}>Estamos quase lá</Text>
        <Text style={styles.message}>
          Sua conta foi criada, {user?.nome?.split(' ')[0] ?? ''}! A clínica está preparando o
          acesso ao seu familiar. Assim que estiver pronto, esta tela avança automaticamente.
        </Text>

        <ActivityIndicator color={colors.family} style={styles.spinner} />

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefresh}
          activeOpacity={0.8}
          disabled={isChecking}
        >
          {isChecking ? (
            <ActivityIndicator color={colors.family} />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={18} color={colors.family} />
              <Text style={styles.refreshText}>Verificar agora</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logout} onPress={signOut} activeOpacity={0.7}>
        <Text style={styles.logoutText}>Sair da conta</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.family + '1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  message: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  spinner: { marginBottom: spacing.xl },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    backgroundColor: colors.family + '14',
    borderWidth: 1,
    borderColor: colors.family + '40',
    minWidth: 180,
  },
  refreshText: { color: colors.family, fontSize: fontSize.md, fontWeight: '600' },
  logout: { alignItems: 'center', paddingVertical: spacing.lg },
  logoutText: { color: colors.error, fontSize: fontSize.md, fontWeight: '600' },
});
