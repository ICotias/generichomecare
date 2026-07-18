import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Platform,
  TouchableOpacity,
  Modal,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { format } from 'date-fns';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import { useFamilyPatientId } from '../../../core/hooks/useFamilyPatientId';
import * as registroService from '../../../core/services/registroService';
import * as patientService from '../../../core/services/patientService';
import type { CareRecord, Patient, PhotoRecord } from '../../../core/types';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '../../../shared/components/EmptyState';
import { PatientPickerBar } from '../../../shared/components/PatientPickerBar';

const TYPE_META: Record<string, { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string }> = {
  medicamento: { label: 'Medicamento', icon: 'medkit-outline', color: '#8B5CF6' },
  sinaisVitais: { label: 'Sinais Vitais', icon: 'heart-outline', color: '#EF4444' },
  alimentacao: { label: 'Alimentação', icon: 'restaurant-outline', color: '#F59E0B' },
  atividade: { label: 'Atividade', icon: 'walk-outline', color: '#10B981' },
  intercorrencia: { label: 'Intercorrência', icon: 'warning-outline', color: '#DC2626' },
  foto: { label: 'Foto', icon: 'camera-outline', color: '#3B82F6' },
};

const formatTime = (date: Date) => format(date, 'HH:mm');

const getRecordSummary = (record: CareRecord): string => {
  switch (record.type) {
    case 'medicamento':
      return `${record.medicamento} · ${record.dosagem} (${record.via})`;
    case 'sinaisVitais':
      return `PA ${record.paSistolica}/${record.paDiastolica} · FC ${record.fc} · T ${record.temperatura}°C · SpO₂ ${record.satO2}%`;
    case 'alimentacao':
      return `Aceitação: ${record.aceitacao}%${record.hidratacaoMl ? ` · Hidratação: ${record.hidratacaoMl}ml` : ''}`;
    case 'atividade':
      return record.categoria;
    case 'intercorrencia':
      return `${record.tipoIncidente} · ${record.gravidade}`;
    case 'foto':
      return record.fotoClinica ? 'Foto clínica (restrita)' : 'Registro fotográfico';
    default:
      return '';
  }
};

export const FamilyTimelineScreen = () => {
  const insets = useSafeAreaInsets();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const {
    pacienteId,
    isSimulating,
    patients: simPatients,
    isLoadingPatients,
    selectPatient,
  } = useFamilyPatientId();

  const [records, setRecords] = useState<CareRecord[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [photoModal, setPhotoModal] = useState<{ url: string; label: string } | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!user?.empresaId || !pacienteId) {
        setIsLoading(false);
        return;
      }
      if (!silent) setIsLoading(true);

      try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const [recs, pat] = await Promise.all([
          registroService.listRecords(user.empresaId, pacienteId, {
            since: startOfToday,
            limitCount: 100,
            visibleToFamilyOnly: true,
          }),
          patientService.getPatient(user.empresaId, pacienteId),
        ]);

        // Filter out clinical photos
        const filtered = recs.filter(
          (r) => !(r.type === 'foto' && r.fotoClinica)
        );
        setRecords(filtered);
        setPatient(pat);
      } catch (err) {
        console.error('FamilyTimeline load error', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user?.empresaId, pacienteId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const firstName = user?.nome?.split(' ')[0] ?? 'Familiar';

  const renderRecord = ({ item }: { item: CareRecord }) => {
    const meta = TYPE_META[item.type] ?? { label: item.type, icon: 'document-text-outline' as const, color: colors.textMuted };
    const summary = getRecordSummary(item);
    const isPhoto = item.type === 'foto';
    const photoUrl = isPhoto ? (item as PhotoRecord).imageUrl : undefined;

    const cardContent = (
      <View style={isPhoto && photoUrl ? styles.cardBodyRow : undefined}>
        <View style={isPhoto && photoUrl ? styles.cardBodyText : undefined}>
          <View style={styles.cardHeader}>
            <Ionicons name={meta.icon} size={16} color={meta.color} />
            <Text style={styles.cardType}>{meta.label}</Text>
          </View>
          {!isPhoto && summary ? (
            <Text style={styles.cardSummary} numberOfLines={2}>{summary}</Text>
          ) : null}
          <Text style={styles.cardNurse}>Por {item.profissionalNome}</Text>
          {item.observacoes ? (
            <Text style={styles.cardObs} numberOfLines={1}>
              Obs: {item.observacoes}
            </Text>
          ) : null}
        </View>
        {isPhoto && photoUrl && (
          <Image source={{ uri: photoUrl }} style={styles.photoThumb} resizeMode="cover" />
        )}
      </View>
    );

    return (
      <View style={styles.card}>
        <View style={styles.timeCol}>
          <Text style={styles.timeText}>{formatTime(item.timestamp)}</Text>
          <View style={[styles.timeDot, { backgroundColor: meta.color }]} />
        </View>
        {isPhoto && photoUrl ? (
          <TouchableOpacity
            style={styles.cardBody}
            activeOpacity={0.8}
            onPress={() => setPhotoModal({ url: photoUrl, label: `Foto · ${formatTime(item.timestamp)}` })}
          >
            {cardContent}
          </TouchableOpacity>
        ) : (
          <View style={styles.cardBody}>
            {cardContent}
          </View>
        )}
      </View>
    );
  };

  const todayLabel = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <View style={[styles.root, { paddingTop: insets.top + (isSimulating ? 0 : spacing.lg) }]}>
      {/* Patient picker (simulação admin) */}
      {isSimulating && (
        <PatientPickerBar
          patients={simPatients}
          selectedId={pacienteId}
          onSelect={selectPatient}
          isLoading={isLoadingPatients}
        />
      )}

      {/* Header */}
      <View style={[styles.header, isSimulating && { marginTop: spacing.md }]}>
        <Text style={styles.greeting}>{getGreeting()},</Text>
        <Text style={styles.name}>{firstName}</Text>
        {patient && (
          <Text style={styles.subtitle}>
            Acompanhando <Text style={styles.subtitleBold}>{patient.nome}</Text>
          </Text>
        )}
        <Text style={styles.today}>{todayLabel}</Text>
      </View>

      {/* Cadastro pendente — só a TITULAR completa os dados. O acompanhante
          convidado só lê: mostrar o card a ele levaria a um permission-denied
          no fim do wizard, com o trabalho todo perdido. */}
      {!isSimulating && user?.familiaTitular !== false && patient && patient.cadastroCompleto === false && (
        <TouchableOpacity
          style={styles.pendingCard}
          activeOpacity={0.85}
          onPress={() => pacienteId && navigation.navigate('CompletePatient', { patientId: pacienteId })}
        >
          <View style={styles.pendingIcon}>
            <Ionicons name="clipboard-outline" size={20} color={colors.white} />
          </View>
          <View style={styles.pendingTextWrap}>
            <Text style={styles.pendingTitle}>Cadastro pendente</Text>
            <Text style={styles.pendingSub}>
              Complete os dados de {patient.nome} para começar o acompanhamento.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.family} />
        </TouchableOpacity>
      )}

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.family} />
        </View>
      ) : !pacienteId ? (
        <EmptyState
          title="Paciente não vinculado"
          subtitle="Peça ao administrador para vincular seu perfil a um paciente."
        />
      ) : records.length === 0 ? (
        <EmptyState
          title="Sem registros hoje"
          subtitle="Ainda não há registros para este paciente. Os cuidados aparecerão aqui conforme forem realizados."
        />
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          renderItem={renderRecord}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                load(true);
              }}
              tintColor={colors.family}
            />
          }
        />
      )}

      {/* Fullscreen photo modal */}
      <Modal visible={!!photoModal} transparent animationType="fade" onRequestClose={() => setPhotoModal(null)}>
        <View style={styles.photoModalOverlay}>
          <TouchableOpacity style={styles.photoModalClose} onPress={() => setPhotoModal(null)} activeOpacity={0.8}>
            <View style={styles.photoModalCloseCircle}>
              <Ionicons name="close" size={20} color={colors.white} />
            </View>
          </TouchableOpacity>
          {photoModal && (
            <>
              <Image
                source={{ uri: photoModal.url }}
                style={styles.photoModalImage}
                resizeMode="contain"
              />
              <Text style={styles.photoModalLabel}>{photoModal.label}</Text>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.md },

  // Cadastro pendente
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.family + '14',
    borderWidth: 1,
    borderColor: colors.family + '40',
  },
  pendingIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.family,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingTextWrap: { flex: 1 },
  pendingTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  pendingSub: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  greeting: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.35,
  },
  name: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.family,
    letterSpacing: 0.35,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  subtitleBold: { fontWeight: '700', color: colors.textPrimary },
  today: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textTransform: 'capitalize',
  },

  // List
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Card
  card: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  timeCol: {
    width: 50,
    alignItems: 'center',
    paddingTop: 2,
  },
  timeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  timeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardBody: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardType: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardSummary: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  cardNurse: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  cardObs: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Photo
  cardBodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardBodyText: {
    flex: 1,
    gap: spacing.xs,
  },
  photoThumb: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.border,
  },

  // Photo modal
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalClose: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 10,
  },
  photoModalCloseCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalImage: {
    width: SCREEN_W - 32,
    height: SCREEN_H * 0.65,
  },
  photoModalLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.sm,
    marginTop: spacing.md,
    fontWeight: '500',
  },
});
