import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Switch,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import { usePatientWithActiveShift } from '../../../core/hooks/usePatientWithActiveShift';
import { useSaveRecord } from '../../../core/hooks/useSaveRecord';
import { ModalHeader } from '../../../shared/components/ui/ModalHeader';
import { InsetGroupedSection } from '../../../shared/components/ui/InsetGroupedSection';
import { InsetRow } from '../../../shared/components/ui/InsetRow';

// Teto seguro abaixo do limite de 1 MB por documento do Firestore.
// A imagem é guardada como data URI base64 dentro do próprio registro.
const MAX_BASE64_CHARS = 700_000; // ~0,7 MB

/**
 * Redimensiona e comprime a imagem, retornando base64 (JPEG).
 * Usa expo-image-manipulator quando disponível (resultado menor e previsível);
 * caso contrário cai no base64 já devolvido pelo image-picker.
 */
const prepareBase64 = async (
  uri: string,
  fallbackBase64: string | null
): Promise<string | null> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ImageManipulator: any = require('expo-image-manipulator');
    const out = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1000 } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    if (out?.base64) return out.base64 as string;
  } catch {
    // expo-image-manipulator não instalado — usa o base64 do picker
  }
  return fallbackBase64;
};

export const RegisterPhotoScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { isSubmitting, save } = useSaveRecord('RegisterPhoto error');

  const { selectedPatient } = usePatientWithActiveShift(user?.empresaId, user?.uid);


  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [fotoClinica, setFotoClinica] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const pickImage = async (source: 'camera' | 'gallery') => {
    // ── expo-image-picker integration ──
    // Install first: npx expo install expo-image-picker
    // Then uncomment the import at the top and replace this stub.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ImagePicker: any = null;
    try {
      ImagePicker = require('expo-image-picker');
    } catch {
      Alert.alert(
        'Dependência necessária',
        'Instale expo-image-picker:\nnpx expo install expo-image-picker'
      );
      return;
    }

    const permResult =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permResult.granted) {
      Alert.alert(
        'Permissão necessária',
        `Permita acesso à ${source === 'camera' ? 'câmera' : 'galeria'} nas configurações.`
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            quality: 0.5,
            allowsEditing: true,
            aspect: [4, 3],
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            quality: 0.5,
            allowsEditing: true,
            aspect: [4, 3],
            mediaTypes: ['images'],
            base64: true,
          });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 ?? null);
      setErrors((p) => ({ ...p, image: '' }));
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!selectedPatient) e.paciente = 'Selecione o paciente';
    if (!imageUri) e.image = 'Selecione ou tire uma foto';
    setErrors(e);
    if (Object.keys(e).length > 0) {
      Alert.alert(e.paciente ? 'Sem paciente' : 'Campos obrigatórios',
        e.paciente ? 'Inicie um plantão antes de registrar.' : 'Preencha todos os campos antes de salvar.');
      return false;
    }
    return true;
  };

  const handleSubmit = () => {
    Keyboard.dismiss();
    if (!validate()) return;

    save({
      pacienteId: selectedPatient!.id,
      successMessage: `Foto registrada para ${selectedPatient!.nome}.`,
      build: async () => {
        // Comprime e converte para base64 (guardado no próprio registro Firestore)
        const base64 = await prepareBase64(imageUri!, imageBase64);

        if (!base64) {
          Alert.alert('Erro', 'Não foi possível processar a imagem. Tente novamente.');
          return null;
        }

        if (base64.length > MAX_BASE64_CHARS) {
          Alert.alert(
            'Foto muito grande',
            'A imagem ficou grande demais para salvar. Tire a foto novamente com menos zoom ou recorte uma área menor.'
          );
          return null;
        }

        const imageUrl = `data:image/jpeg;base64,${base64}`;

        return {
          type: 'foto',
          pacienteId: selectedPatient!.id,
          empresaId: user!.empresaId,
          profissionalId: user!.uid,
          profissionalNome: user!.nome,
          imageUrl,
          fotoClinica,
          ...(observacoes.trim() ? { observacoes: observacoes.trim() } : {}),
        };
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.root}>
          {/* ── Apple-style Modal Header ── */}
          <View style={{ paddingTop: insets.top }}>
            <ModalHeader
              title="Registro Fotográfico"
              onCancel={() => navigation.goBack()}
              onDone={handleSubmit}
              doneLabel="Salvar"
              doneDisabled={isSubmitting}
              isLoading={isSubmitting}
              accentColor={colors.primary}
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >

            {/* ── Foto ── */}
            <InsetGroupedSection header="FOTO">
              <View style={styles.photoContent}>
                {imageUri ? (
                  <View style={styles.previewWrap}>
                    <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => setImageUri(null)}
                      hitSlop={8}
                    >
                      <Ionicons name="close" size={18} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.pickerArea}>
                    <Ionicons name="camera-outline" size={40} color={colors.textMuted} />
                    <Text style={styles.pickerHint}>Selecione uma opção abaixo</Text>
                  </View>
                )}
                {errors.image ? <Text style={[styles.errorText, { paddingHorizontal: spacing.md }]}>{errors.image}</Text> : null}

                <View style={styles.sourceRow}>
                  <TouchableOpacity
                    style={styles.sourceButton}
                    onPress={() => pickImage('camera')}
                    disabled={isSubmitting}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="camera" size={20} color={colors.primary} />
                    <Text style={styles.sourceLabel}>Câmera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.sourceButton}
                    onPress={() => pickImage('gallery')}
                    disabled={isSubmitting}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="images" size={20} color={colors.primary} />
                    <Text style={styles.sourceLabel}>Galeria</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </InsetGroupedSection>

            {/* ── Foto Clínica ── */}
            <InsetGroupedSection>
              <InsetRow
                label="Foto clínica"
                last
                rightContent={
                  <Switch
                    value={fotoClinica}
                    onValueChange={setFotoClinica}
                    trackColor={{ false: colors.border, true: '#93C5FD' }}
                    thumbColor={fotoClinica ? colors.primary : colors.textMuted}
                    disabled={isSubmitting}
                  />
                }
              />
            </InsetGroupedSection>
            {fotoClinica && (
              <Text style={styles.switchHint}>
                Fotos clínicas não são visíveis para a família no app
              </Text>
            )}

            {/* ── Observações ── */}
            <InsetGroupedSection header="OBSERVAÇÕES">
              <View style={styles.textAreaWrap}>
                <TextInput
                  value={observacoes}
                  onChangeText={setObservacoes}
                  placeholder="Contexto da foto, local, evolução do ferimento..."
                  placeholderTextColor={colors.textMuted}
                  style={styles.textArea}
                  multiline
                  textAlignVertical="top"
                  editable={!isSubmitting}
                />
              </View>
            </InsetGroupedSection>
          </ScrollView>

        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.xs,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    marginLeft: spacing.md,
  },

  // Photo content inside InsetGroupedSection
  photoContent: {
    padding: spacing.md,
  },
  pickerArea: {
    height: 160,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pickerHint: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  // Preview
  previewWrap: {
    position: 'relative',
  },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: borderRadius.md,
  },
  removeBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Source buttons (Câmera / Galeria)
  sourceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  sourceButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sourceLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // Switch hint
  switchHint: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
    marginLeft: spacing.md,
    lineHeight: 16,
  },

  // Text area for observações
  textAreaWrap: {
    padding: spacing.md,
  },
  textArea: {
    height: 100,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
});
