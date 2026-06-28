import { forwardRef, useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, TextInputProps, StyleProp, ViewStyle } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../core/theme/theme';

interface PasswordInputProps extends Omit<TextInputProps, 'secureTextEntry'> {
  containerStyle?: StyleProp<ViewStyle>;
  hasError?: boolean;
  isFocused?: boolean;
}

/**
 * TextInput de senha com botão "Mostrar/Ocultar".
 * Mantém a API de TextInput (ref, onFocus, onBlur, etc).
 */
export const PasswordInput = forwardRef<TextInput, PasswordInputProps>(
  ({ containerStyle, hasError, isFocused, style, ...rest }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <View
        style={[
          styles.wrapper,
          isFocused && styles.wrapperFocused,
          hasError && styles.wrapperError,
          containerStyle,
        ]}
      >
        <TextInput
          ref={ref}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, style]}
          {...rest}
        />
        <TouchableOpacity
          onPress={() => setVisible((v) => !v)}
          hitSlop={8}
          style={styles.toggle}
          accessibilityRole="button"
          accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
        >
          <Text style={styles.toggleText}>{visible ? 'Ocultar' : 'Mostrar'}</Text>
        </TouchableOpacity>
      </View>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
  },
  wrapperFocused: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  wrapperError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  toggle: {
    paddingLeft: spacing.sm,
  },
  toggleText: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
});
