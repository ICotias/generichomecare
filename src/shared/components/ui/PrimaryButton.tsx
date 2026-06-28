import {
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ViewStyle,
} from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'danger';
  style?: ViewStyle;
  icon?: React.ReactNode;
}

export const PrimaryButton = ({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  style,
  icon,
}: PrimaryButtonProps) => {
  const bgColor = variant === 'danger' ? colors.error : colors.primary;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: bgColor },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={loading || disabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={colors.white} size="small" />
      ) : (
        <>
          {icon}
          <Text style={styles.text}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: colors.white,
    fontSize: fontSize.lg,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
