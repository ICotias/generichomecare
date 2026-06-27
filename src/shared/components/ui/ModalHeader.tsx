import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, spacing, fontSize } from '../../../core/theme/theme';

interface ModalHeaderProps {
  title: string;
  onCancel: () => void;
  onDone?: () => void;
  doneLabel?: string;
  /** Disable the Done button (reduced opacity) */
  doneDisabled?: boolean;
  /** Show spinner instead of Done label */
  isLoading?: boolean;
  /** Accent color for Cancel/Done text. Defaults to colors.primary */
  accentColor?: string;
}

/**
 * Apple-style modal header.
 * "Cancelar" (left) + Title (center) + "OK"/"Salvar" (right, bold)
 */
export const ModalHeader = ({
  title,
  onCancel,
  onDone,
  doneLabel = 'OK',
  doneDisabled,
  isLoading,
  accentColor = colors.primary,
}: ModalHeaderProps) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={onCancel} hitSlop={8} style={styles.side}>
      <Text style={[styles.cancelText, { color: accentColor }]}>Cancelar</Text>
    </TouchableOpacity>

    <Text style={styles.title} numberOfLines={1}>{title}</Text>

    <View style={styles.side}>
      {onDone ? (
        isLoading ? (
          <ActivityIndicator size="small" color={accentColor} />
        ) : (
          <TouchableOpacity
            onPress={onDone}
            disabled={doneDisabled}
            hitSlop={8}
            activeOpacity={0.6}
          >
            <Text
              style={[
                styles.doneText,
                { color: accentColor },
                doneDisabled && styles.doneDisabled,
              ]}
            >
              {doneLabel}
            </Text>
          </TouchableOpacity>
        )
      ) : (
        <View />
      )}
    </View>
  </View>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  side: {
    width: 75,
  },
  cancelText: {
    fontSize: fontSize.md,
    fontWeight: '400',
  },
  title: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  doneText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    textAlign: 'right',
  },
  doneDisabled: {
    opacity: 0.4,
  },
});
