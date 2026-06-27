import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import { useLocation } from '../../../core/hooks/useLocation';
import * as shiftService from '../../../core/services/shiftService';
import * as patientService from '../../../core/services/patientService';
import { Shift, Patient } from '../../../core/types';
import { MOCK_PATIENTS } from '../../../core/mocks/patients';
import { PrimaryButton } from '../../../shared/components/ui';

export const ShiftCheckinScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { isLoading: isLocationLoading, getCurrentLocation } = useLocation();

  const [activeShift, setActiveShift] = useState<(Shift & { id: string }) | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingShift, setIsLoadingShift] = useState(true);

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);

  const isLoading = isLocationLoading || isProcessing;

  useFocusEffect(
    useCallback(() => {
      if (!user?.empresaId) return;
      setIsLoadingPatients(true);
      patientService
        .listPatients(user.empresaId)
        .then((list) => {
          const result = list.length > 0 ? list : MOCK_PATIENTS;
          setPatients(result);
          setSelectedPatient((prev) => prev ?? (result.length > 0 ? result[0] : null));
        })
        .catch(() => {
          setPatients(MOCK_PATIENTS);
          setSelectedPatient((prev) => prev ?? MOCK_PATIENTS[0]);
        })
        .finally(() => setIsLoadingPatients(false));
    }, [user?.empresaId])
  );

  const loadActiveShift = useCallback(async () => {
    if (!user?.empresaId || !user?.uid) {
      setIsLoadingShift(false);
      return;
    }
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
    if (!selectedPatient) {
      Alert.alert('Selecione o paciente', 'Escolha o paciente antes de iniciar o plantão.');
      return;
    }

    const location = await getCurrentLocation();
    if (!location) return;

    const now = new Date();
    const timeStr = format(now, 'HH:mm', { locale: ptBR });

    Alert.alert(
      'Confirmar Checkin',
      `Iniciar plantão às ${timeStr}?\nPaciente: ${selectedPatient.nome}\nLocalização capturada com sucesso.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'default',
          onPress: async () => {
            setIsProcessing(true);
            try {
              await shiftService.checkin({
                empresaId: user.empresaId,
                pacienteId: selectedPatient.id,
                pacienteNome: selectedPatient.nome,
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

    const checkinTime = format(activeShift.checkinAt, 'HH:mm', { locale: ptBR });
    const now = new Date();
    const checkoutTime = format(now, 'HH:mm', { locale: ptBR });

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

  if (isLoadingShift || isLoadingPatients) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const hasActiveShift = !!activeShift;
  const activePatientName = hasActiveShift
    ? patients.find((p) => p.id === activeShift.pacienteId)?.nome ?? 'Paciente'
    : '';

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      {/* Two-line header */}
      <View style={styles.header}>
        <Text style={styles.titleLine1}>Meu</Text>
        <Text style={styles.titleLine2}>Plantão</Text>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        {hasActiveShift ? (
          /* ── Active shift card ── */
          <View style={styles.shiftCard}>
            <View style={styles.iconCircleLarge}>
              <Ionicons name="time-outline" size={40} color={colors.primary} />
            </View>

            <Text style={styles.shiftStatus}>Em Plantão</Text>

            <Text style={styles.shiftTime}>
              {format(activeShift.checkinAt, 'HH:mm', { locale: ptBR })}
            </Text>
            <Text style={styles.shiftDate}>
              {format(activeShift.checkinAt, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </Text>

            <View style={styles.patientBadge}>
              <Ionicons name="person-outline" size={14} color={colors.primary} />
              <Text style={styles.patientBadgeText}>{activePatientName}</Text>
            </View>

            <View style={styles.durationContainer}>
              <ShiftDuration checkinAt={activeShift.checkinAt} />
            </View>

            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={16} color={colors.success} />
              <Text style={styles.locationText}>Localização capturada</Text>
            </View>
          </View>
        ) : (
          /* ── No active shift ── */
          <View style={styles.shiftCard}>
            <View style={styles.iconCircleLarge}>
              <Ionicons name="time-outline" size={40} color={colors.primary} />
            </View>

            <Text style={styles.shiftStatus}>Fora de Plantão</Text>
            <Text style={styles.emptySubtitle}>
              Selecione o paciente e inicie seu plantão
            </Text>

            {/* Patient selector */}
            <View style={styles.patientSelector}>
              <Text style={styles.sectionLabel}>PACIENTE</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.patientChipRow}
              >
                {patients.filter((p) => p.status === 'ativo').map((p) => {
                  const isSelected = selectedPatient?.id === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.patientChip, isSelected && styles.patientChipActive]}
                      onPress={() => setSelectedPatient(p)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.patientChipText, isSelected && styles.patientChipTextActive]}>
                        {p.nome}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={16} color={colors.success} />
              <Text style={styles.locationText}>Localização capturada</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom action */}
      <View style={[styles.actionArea, { paddingBottom: insets.bottom + spacing.lg }]}>
        {hasActiveShift ? (
          <View style={styles.activeActions}>
            <TouchableOpacity
              style={styles.evolutionButton}
              onPress={() => (navigation as any).navigate('ShiftEvolution')}
              activeOpacity={0.7}
            >
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              <Text style={styles.evolutionButtonText}>Passagem de Plantão (SBAR)</Text>
            </TouchableOpacity>
            <PrimaryButton
              title="Finalizar Plantão"
              onPress={handleCheckout}
              loading={isLoading}
              variant="danger"
            />
          </View>
        ) : (
          <PrimaryButton
            title="Fazer Check-in"
            onPress={handleCheckin}
            loading={isLoading}
            disabled={!selectedPatient}
          />
        )}
      </View>
    </View>
  );
};

const ShiftDuration = ({ checkinAt }: { checkinAt: Date }) => {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    // checkinAt pode vir como Timestamp do Firestore — garantir conversão
    const safeDate = checkinAt instanceof Date ? checkinAt : new Date(checkinAt as any);
    const updateElapsed = () => {
      const now = new Date();
      const diffMs = now.getTime() - safeDate.getTime();
      if (diffMs < 0) { setElapsed('0h 00min'); return; }
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      setElapsed(`${hours}h ${minutes.toString().padStart(2, '0')}min`);
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [checkinAt]);

  return (
    <>
      <Text style={styles.durationLabel}>DURAÇÃO</Text>
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

  header: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  titleLine1: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  titleLine2: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
    marginTop: -2,
  },

  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },

  // Shift card
  shiftCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  iconCircleLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  shiftStatus: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  shiftTime: {
    fontSize: 48,
    fontWeight: '200',
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  shiftDate: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  patientBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.md,
    backgroundColor: colors.primary + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  patientBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  durationContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    width: '100%',
  },
  durationLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 1,
  },
  durationValue: {
    fontSize: fontSize.xxl,
    fontWeight: '300',
    color: colors.textPrimary,
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  locationText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  // Patient selector
  patientSelector: {
    width: '100%',
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  patientChipRow: {
    gap: spacing.sm,
  },
  patientChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  patientChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  patientChipText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  patientChipTextActive: {
    color: colors.white,
  },

  // Action area
  activeActions: {
    gap: spacing.sm,
  },
  evolutionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  evolutionButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.primary,
  },
  actionArea: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
