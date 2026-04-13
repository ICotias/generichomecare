import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import { useLocation } from '../../../core/hooks/useLocation';
import * as shiftService from '../../../core/services/shiftService';
import { Shift } from '../../../core/types';

export const ShiftCheckinScreen = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { isLoading: isLocationLoading, getCurrentLocation } = useLocation();

  const [activeShift, setActiveShift] = useState<(Shift & { id: string }) | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingShift, setIsLoadingShift] = useState(true);

  const isLoading = isLocationLoading || isProcessing;

  const loadActiveShift = useCallback(async () => {
    if (!user?.empresaId || !user?.uid) return;

    try {
      const shift = await shiftService.getActiveShift(user.empresaId, user.uid);
      setActiveShift(shift);
    } catch (error) {
      console.error('Erro ao carregar plantão:', error);
    } finally {
      setIsLoadingShift(false);
    }
  }, [user?.empresaId, user?.uid]);

  useEffect(() => {
    loadActiveShift();
  }, [loadActiveShift]);

  const handleCheckin = async () => {
    if (!user?.empresaId || !user?.uid) return;

    const location = await getCurrentLocation();
    if (!location) return;

    const now = new Date();
    const timeStr = format(now, "HH:mm", { locale: ptBR });

    Alert.alert(
      'Confirmar Checkin',
      `Iniciar plantão às ${timeStr}?\nLocalização capturada com sucesso.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'default',
          onPress: async () => {
            setIsProcessing(true);
            try {
              // TODO: pacienteId será dinâmico quando tivermos a tela de seleção
              await shiftService.checkin({
                empresaId: user.empresaId,
                pacienteId: 'paciente-placeholder',
                profissionalId: user.uid,
                profissionalNome: user.nome,
                latitude: location.latitude,
                longitude: location.longitude,
              });

              await loadActiveShift();
            } catch (error) {
              console.error('Erro no checkin:', error);
              Alert.alert('Erro', 'Não foi possível registrar o checkin. Tente novamente.');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleCheckout = async () => {
    if (!activeShift || !user?.empresaId) return;

    const location = await getCurrentLocation();
    if (!location) return;

    const checkinTime = format(activeShift.checkinAt, "HH:mm", { locale: ptBR });
    const now = new Date();
    const checkoutTime = format(now, "HH:mm", { locale: ptBR });

    Alert.alert(
      'Finalizar Plantão',
      `Encerrar plantão iniciado às ${checkinTime}?\nHorário de saída: ${checkoutTime}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              await shiftService.checkout({
                shiftId: activeShift.id,
                empresaId: user.empresaId,
                latitude: location.latitude,
                longitude: location.longitude,
              });

              setActiveShift(null);
            } catch (error) {
              console.error('Erro no checkout:', error);
              Alert.alert('Erro', 'Não foi possível registrar o checkout. Tente novamente.');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  if (isLoadingShift) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const hasActiveShift = !!activeShift;

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      {/* Status Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Plantão</Text>
        <View style={[styles.statusBadge, hasActiveShift ? styles.statusActive : styles.statusInactive]}>
          <View style={[styles.statusDot, hasActiveShift ? styles.dotActive : styles.dotInactive]} />
          <Text style={[styles.statusText, hasActiveShift ? styles.statusTextActive : styles.statusTextInactive]}>
            {hasActiveShift ? 'Em andamento' : 'Não iniciado'}
          </Text>
        </View>
      </View>

      {/* Shift Info */}
      <View style={styles.content}>
        {hasActiveShift ? (
          <View style={styles.shiftInfo}>
            <Text style={styles.shiftTimeLabel}>Início do plantão</Text>
            <Text style={styles.shiftTime}>
              {format(activeShift.checkinAt, "HH:mm", { locale: ptBR })}
            </Text>
            <Text style={styles.shiftDate}>
              {format(activeShift.checkinAt, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </Text>

            <View style={styles.durationContainer}>
              <ShiftDuration checkinAt={activeShift.checkinAt} />
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nenhum plantão ativo</Text>
            <Text style={styles.emptySubtitle}>
              Toque no botão abaixo para iniciar seu plantão
            </Text>
          </View>
        )}
      </View>

      {/* Action Button — posicionado na parte inferior (Apple HIG) */}
      <View style={[styles.actionArea, { paddingBottom: insets.bottom + spacing.lg }]}>
        {hasActiveShift ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.checkoutButton]}
            onPress={handleCheckout}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.actionButtonText}>Finalizar Plantão</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.checkinButton]}
            onPress={handleCheckin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.actionButtonText}>Iniciar Plantão</Text>
            )}
          </TouchableOpacity>
        )}

        <Text style={styles.locationHint}>
          Sua localização será registrada automaticamente
        </Text>
      </View>
    </View>
  );
};

/**
 * Componente que mostra duração do plantão em tempo real.
 */
const ShiftDuration = ({ checkinAt }: { checkinAt: Date }) => {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const updateElapsed = () => {
      const now = new Date();
      const diffMs = now.getTime() - checkinAt.getTime();
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      setElapsed(`${hours}h ${minutes.toString().padStart(2, '0')}min`);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 60000);

    return () => clearInterval(interval);
  }, [checkinAt]);

  return (
    <>
      <Text style={styles.durationLabel}>Duração</Text>
      <Text style={styles.durationValue}>{elapsed}</Text>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },

  // Header
  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.35,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  statusActive: {
    backgroundColor: '#DCFCE7',
  },
  statusInactive: {
    backgroundColor: '#F1F5F9',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs + 2,
  },
  dotActive: {
    backgroundColor: colors.success,
  },
  dotInactive: {
    backgroundColor: colors.textMuted,
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  statusTextActive: {
    color: '#166534',
  },
  statusTextInactive: {
    color: colors.textSecondary,
  },

  // Content
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },

  // Shift Info
  shiftInfo: {
    alignItems: 'center',
  },
  shiftTimeLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  shiftTime: {
    fontSize: 64,
    fontWeight: '200',
    color: colors.textPrimary,
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  shiftDate: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  durationContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    width: 200,
  },
  durationLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  durationValue: {
    fontSize: fontSize.xxl,
    fontWeight: '300',
    color: colors.textPrimary,
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Action Area
  actionArea: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  actionButton: {
    height: 56,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  checkinButton: {
    backgroundColor: colors.primary,
  },
  checkoutButton: {
    backgroundColor: colors.error,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  locationHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
