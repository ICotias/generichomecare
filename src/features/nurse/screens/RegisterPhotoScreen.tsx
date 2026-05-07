import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
// expo-image-picker must be installed: npx expo install expo-image-picker
// import * as ImagePicker from 'expo-image-picker';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as patientService from '../../../core/services/patientService';
import * as registroService from '../../../core/services/registroService';
import * as storageService from '../../../core/services/storageService';
import type { Patient } from '../../../core/types';
import { MOCK_PATIENTS } from '../../../core/mocks/patients';

export const RegisterPhotoScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [fotoClinica, setFotoClinica] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      if (!user?.empresaId) return;
      patientService.listPatients(user.empresaId).then((list) => setPatients(list.length > 0 ? list : MOCK_PATIENTS)).catch(console.error);
    }, [user?.empresaId])
  );

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
            quality: 0.7,
            allowsEditing: true,
            aspect: [4, 3],
          })
        : await ImagePicker.launchImageLibraryAsync({
            quality: 0.7,
            allowsEditing: true,
            aspect: [4, 3],
            mediaTypes: ['images'],
          });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setErrors((p) => ({ ...p, image: '' }));
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!selectedPatient) e.paciente = 'Selecione o paciente';
    if (!imageUri) e.image = 'Selecione ou tire uma foto';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!validate()) return;
    if (!user?.empresaId || !user?.uid) return;

    setIsSubmitting(true);
    try {
      // Upload image to Firebase Storage
      const storagePath = storageService.generatePhotoPath(
        user.empresaId,
        selectedPatient!.id
      );

      let imageUrl = imageUri!;
      let imagePath = storagePath;

      try {
        const uploadResult = await storageService.uploadImage(imageUri!, storagePath);
        imageUrl = uploadResult.downloadUrl;
        imagePath = uploadResult.storagePath;
      } catch (uploadErr) {
        // If upload fails (e.g. Storage not configured), save with local URI as fallback
        if (__DEV__) console.warn('[RegisterPhoto] Storage upload failed, using local URI:', uploadErr);
      }

      await registroService.createRecord(user.empresaId, selectedPatient!.id, {
        type: 'foto',
        pacienteId: selectedPatient!.id,
        empresaId: user.empresaId,
        profissionalId: user.uid,
        profissionalNome: user.nome,
        imageUrl,
        imagePath,
        fotoClinica,
        observacoes: observacoes.trim() || undefined,
      });

      Alert.alert('Registrado', `Foto registrada para ${selectedPatient!.nome}.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar o registro.');
      console.error('RegisterPhoto error', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.root}>
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
              <Ionicons name="arrow-back" size={20} color={colors.primary} />
              <Text style={styles.backText}>Voltar</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Registro Fotográfico</Text>
            <View style={styles.separator} />
            <Text style={styles.subtitle}>Capturar foto vinculada ao paciente</Text>

            <View style={styles.form}>
              {/* Patient selector */}
              <View style={styles.field}>
                <Text style={styles.label}>Paciente</Text>
                <TouchableOpacity
                  style={[styles.selector, errors.paciente && styles.inputError]}
                  onPress={() => setShowPicker(!showPicker)}
                >
                  <Text style={selectedPatient ? styles.selectorText : styles.selectorPlaceholder}>
                    {selectedPatient?.nome ?? 'Selecione o paciente'}
                  </Text>
                </TouchableOpacity>
                {showPicker && (
                  <View style={styles.pickerDropdown}>
                    {patients.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={styles.pickerItem}
                        onPress={() => {
                          setSelectedPatient(p);
                          setShowPicker(false);
                          setErrors((prev) => ({ ...prev, paciente: '' }));
                        }}
                      >
                        <Text style={styles.pickerItemText}>{p.nome}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {errors.paciente ? <Text style={styles.errorText}>{errors.paciente}</Text> : null}
              </View>

              {/* Image picker area */}
              <View style={styles.field}>
                <Text style={styles.sectionLabel}>FOTO</Text>
                {imageUri ? (
                  <View style={styles.previewWrap}>
                    <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => setImageUri(null)}
                      hitSlop={8}
                    >
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.pickerArea}>
                    <Text style={styles.pickerEmoji}>📷</Text>
                    <Text style={styles.pickerHint}>Selecione uma opção abaixo</Text>
                  </View>
                )}
                {errors.image ? <Text style={styles.errorText}>{errors.image}</Text> : null}

                <View style={styles.sourceRow}>
                  <TouchableOpacity
                    style={styles.sourceButton}
                    onPress={() => pickImage('camera')}
                    disabled={isSubmitting}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sourceIcon}>📸</Text>
                    <Text style={styles.sourceLabel}>Câmera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.sourceButton}
                    onPress={() => pickImage('gallery')}
                    disabled={isSubmitting}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sourceIcon}>🖼️</Text>
                    <Text style={styles.sourceLabel}>Galeria</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Foto clínica switch */}
              <View style={styles.switchRow}>
                <View style={styles.switchInfo}>
                  <Text style={styles.switchLabel}>Foto clínica</Text>
                  <Text style={styles.switchHint}>
                    Fotos clínicas não são visíveis para a família no app
                  </Text>
                </View>
                <Switch
                  value={fotoClinica}
                  onValueChange={setFotoClinica}
                  trackColor={{ false: colors.border, true: '#93C5FD' }}
                  thumbColor={fotoClinica ? colors.primary : colors.textMuted}
                  disabled={isSubmitting}
                />
              </View>

              {/* Observações */}
              <View style={styles.field}>
                <Text style={styles.label}>
                  Observações <Text style={styles.optional}>(opcional)</Text>
                </Text>
                <TextInput
                  value={observacoes}
                  onChangeText={setObservacoes}
                  placeholder="Contexto da foto, local, evolução do ferimento..."
                  placeholderTextColor={colors.textMuted}
                  style={[styles.input, styles.inputMultiline]}
                  multiline
                  textAlignVertical="top"
                  editable={!isSubmitting}
                />
              </View>
            </View>
          </ScrollView>

          <View style={[styles.actionArea, { paddingBottom: insets.bottom + spacing.lg }]}>
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitText}>Salvar Registro</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: spacing.lg },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.xs, marginBottom: spacing.md },
  backText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '500' },
  title: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.35,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  form: { marginTop: spacing.xl },
  field: { marginBottom: spacing.md },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs + 2,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  optional: { color: colors.textMuted, fontWeight: '400' },
  input: {
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  inputMultiline: { height: 100, paddingTop: spacing.md },
  inputError: { borderColor: colors.error },
  errorText: { color: colors.error, fontSize: fontSize.xs, marginTop: spacing.xs },

  // Selector
  selector: {
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  selectorText: { fontSize: fontSize.md, color: colors.textPrimary },
  selectorPlaceholder: { fontSize: fontSize.md, color: colors.textMuted },
  pickerDropdown: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  pickerItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pickerItemText: { fontSize: fontSize.md, color: colors.textPrimary },

  // Image picker area
  pickerArea: {
    height: 180,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pickerEmoji: { fontSize: 40 },
  pickerHint: { fontSize: fontSize.sm, color: colors.textMuted },

  // Preview
  previewWrap: { position: 'relative', marginBottom: spacing.sm },
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
  removeBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },

  // Source buttons (Câmera / Galeria)
  sourceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sourceButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sourceIcon: { fontSize: 20 },
  sourceLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary },

  // Switch
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  switchInfo: { flex: 1, marginRight: spacing.md },
  switchLabel: { fontSize: fontSize.md, fontWeight: '600', color: colors.textPrimary },
  switchHint: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },

  // Action
  actionArea: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  submitButton: {
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
