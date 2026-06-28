import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';

interface FormInputProps extends TextInputProps {
  label?: string;
  /** If true, render in a half-width container (use alongside another FormInput) */
  half?: boolean;
}

export const FormInput = ({ label, half, style, ...props }: FormInputProps) => {
  return (
    <View style={[styles.container, half && styles.halfContainer]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={colors.textMuted}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  halfContainer: {
    flex: 1,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs + 2,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    minHeight: 48,
  },
});
