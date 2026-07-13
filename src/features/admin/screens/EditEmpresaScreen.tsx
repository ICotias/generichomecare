import { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';

import { db } from '../../../core/config/firebase';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import { FormInput } from '../../../shared/components/ui';

interface FormState {
  nome: string;
  cnpj: string;
  cidade: string;
}

interface FormErrors {
  nome?: string;
  general?: string;
}

export const EditEmpresaScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [form, setForm] = useState<FormState>({ nome: '', cnpj: '', cidade: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const cnpjRef = useRef<TextInput>(null);
  const cidadeRef = useRef<TextInput>(null);

  // Load current empresa data
  useEffect(() => {
    const loadEmpresa = async () => {
      if (!user?.empresaId) {
        setIsLoading(false);
        setErrors({ general: 'Empresa não encontrada.' });
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'empresas', user.empresaId));
        if (snap.exists()) {
          const data = snap.data();
          setForm({
            nome: data.nome ?? '',
            cnpj: data.cnpj ?? '',
            cidade: data.cidade ?? '',
          });
        } else {
          setErrors({ general: 'Dados da empresa não encontrados.' });
        }
      } catch (err) {
        console.error('Erro ao carregar empresa:', err);
        setErrors({ general: 'Erro ao carregar dados da empresa.' });
      } finally {
        setIsLoading(false);
      }
    };

    loadEmpresa();
  }, [user?.empresaId]);

  const updateField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'nome' && errors.nome) {
      setErrors((prev) => ({ ...prev, nome: undefined, general: undefined }));
    }
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!form.nome.trim()) {
      setErrors({ nome: 'Informe o nome da empresa' });
      return;
    }
    if (!user?.empresaId) {
      setErrors({ general: 'Empresa não vinculada. Faça login novamente.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'empresas', user.empresaId), {
        nome: form.nome.trim(),
        cnpj: form.cnpj.trim() || null,
        cidade: form.cidade.trim() || null,
        updatedAt: Timestamp.now(),
      });
      Alert.alert('Empresa atualizada', 'As alterações foram salvas com sucesso.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Erro ao atualizar empresa:', error);
      setErrors({ general: 'Não foi possível salvar as alterações. Tente novamente.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

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
            {/* Header */}
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color={colors.primary} />
              <Text style={styles.backBtnText}>Voltar</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Editar</Text>
            <Text style={styles.titleAccent}>Empresa</Text>

            <View style={styles.form}>
              <FormInput
                label="Nome da empresa"
                value={form.nome}
                onChangeText={(v) => updateField('nome', v)}
                placeholder="Ex.: Clínica Cuidar Bem"
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => cnpjRef.current?.focus()}
                editable={!isSubmitting}
                error={errors.nome}
              />

              <FormInput
                ref={cnpjRef}
                label="CNPJ"
                optional
                value={form.cnpj}
                onChangeText={(v) => updateField('cnpj', v)}
                placeholder="00.000.000/0000-00"
                autoCapitalize="none"
                keyboardType="numeric"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => cidadeRef.current?.focus()}
                editable={!isSubmitting}
              />

              <FormInput
                ref={cidadeRef}
                label="Cidade"
                optional
                value={form.cidade}
                onChangeText={(v) => updateField('cidade', v)}
                placeholder="Ex.: São Paulo"
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                editable={!isSubmitting}
              />

              {errors.general ? (
                <Text style={styles.generalError}>{errors.general}</Text>
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
              onPress={handleSubmit}
              disabled={isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitText}>Salvar Alterações</Text>
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
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  backBtnText: {
    fontSize: fontSize.lg,
    color: colors.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.35,
  },
  titleAccent: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 0.35,
    marginBottom: spacing.sm,
  },
  form: {
    marginTop: spacing.xl,
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
