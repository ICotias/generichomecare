import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';

import { colors, spacing, fontSize, borderRadius } from '../../core/theme/theme';
import { useAuthStore } from '../../core/hooks/useAuth';
import { db } from '../../core/config/firebase';
import { ScreenHeader } from '../components/ui/ScreenHeader';

type FieldKey = 'nome' | 'telefone' | 'coren';

export const EditProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, setUser } = useAuthStore();

  const [nome, setNome] = useState(user?.nome ?? '');
  const [telefone, setTelefone] = useState(user?.telefone ?? '');
  const [coren, setCoren] = useState(user?.coren ?? '');
  const [focused, setFocused] = useState<FieldKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const telefoneRef = useRef<TextInput>(null);
  const corenRef = useRef<TextInput>(null);

  const isNurse = user?.role === 'nurse';

  const handleSave = async () => {
    Keyboard.dismiss();

    if (!nome.trim()) {
      setError('O nome é obrigatório.');
      return;
    }

    if (!user?.uid) {
      setError('Sessão inválida. Faça login novamente.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updateData: Record<string, unknown> = {
        nome: nome.trim(),
        telefone: telefone.trim(),
        updatedAt: Timestamp.now(),
      };

      if (isNurse) {
        updateData.coren = coren.trim();
      }

      await updateDoc(doc(db, 'usuarios', user.uid), updateData);

      // Atualiza o estado local
      setUser({
        ...user,
        nome: nome.trim(),
        telefone: telefone.trim(),
        ...(isNurse ? { coren: coren.trim() } : {}),
        updatedAt: new Date(),
      });

      navigation.goBack();
    } catch (err) {
      console.error('Erro ao salvar perfil:', err);
      setError('Não foi possível salvar as alterações. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (
    key: FieldKey,
    label: string,
    value: string,
    onChangeText: (v: string) => void,
    options?: {
      placeholder?: string;
      ref?: React.RefObject<TextInput | null>;
      onSubmitEditing?: () => void;
      returnKeyType?: 'next' | 'done';
      keyboardType?: 'default' | 'phone-pad';
      autoCapitalize?: 'none' | 'words';
    },
  ) => {
    const isFocused = focused === key;

    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        <TextInput
          ref={options?.ref}
          value={value}
          onChangeText={(v) => {
            onChangeText(v);
            if (error) setError(null);
          }}
          placeholder={options?.placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={options?.keyboardType ?? 'default'}
          autoCapitalize={options?.autoCapitalize ?? 'words'}
          autoCorrect={false}
          returnKeyType={options?.returnKeyType ?? 'next'}
          onSubmitEditing={options?.onSubmitEditing}
          onFocus={() => setFocused(key)}
          onBlur={() => setFocused(null)}
          style={[styles.input, isFocused && styles.inputFocused]}
          editable={!isSubmitting}
        />
      </View>
    );
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
              { paddingTop: insets.top + spacing.lg, paddingBottom: spacing.xxl },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <ScreenHeader title="Editar" subtitle="Perfil" showBack />

            <View style={styles.form}>
              {renderField('nome', 'Nome', nome, setNome, {
                placeholder: 'Seu nome completo',
                autoCapitalize: 'words',
                onSubmitEditing: () => telefoneRef.current?.focus(),
              })}

              {renderField('telefone', 'Telefone', telefone, setTelefone, {
                placeholder: '(00) 00000-0000',
                keyboardType: 'phone-pad',
                autoCapitalize: 'none',
                ref: telefoneRef,
                returnKeyType: isNurse ? 'next' : 'done',
                onSubmitEditing: isNurse
                  ? () => corenRef.current?.focus()
                  : handleSave,
              })}

              {isNurse &&
                renderField('coren', 'COREN', coren, setCoren, {
                  placeholder: 'Ex.: 123456-SP',
                  autoCapitalize: 'none',
                  ref: corenRef,
                  returnKeyType: 'done',
                  onSubmitEditing: handleSave,
                })}

              {error ? (
                <Text style={styles.generalError}>{error}</Text>
              ) : null}
            </View>
          </ScrollView>

          <View
            style={[
              styles.actionArea,
              { paddingBottom: insets.bottom + spacing.lg },
            ]}
          >
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSave}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitText}>Salvar</Text>
              )}
            </TouchableOpacity>
          </View>
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
  },
  form: {
    marginTop: spacing.xl,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs + 2,
  },
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
  inputFocused: {
    borderColor: colors.primary,
  },
  generalError: {
    color: colors.error,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.md,
  },
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
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
