import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';

export interface SelectionItem {
  id: string;
  label: string;
  subtitle?: string;
}

interface SelectionListModalProps {
  visible: boolean;
  title: string;
  items: SelectionItem[];
  selectedId: string | null;
  onSelect: (item: SelectionItem) => void;
  onClose: () => void;
  accentColor?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Apple-style inline selection list with push/pop animation.
 *
 * Unlike a <Modal>, this renders as an absolute-positioned overlay
 * that slides in from the right — the same pattern iOS uses when you
 * tap a drill-down row inside a modal sheet (e.g. Calendar → New Event
 * → tap "Calendar" row).
 *
 * This avoids the React Native nested-Modal bug on iOS.
 */
export const SelectionListModal = ({
  visible,
  title,
  items,
  selectedId,
  onSelect,
  onClose,
  accentColor = colors.primary,
}: SelectionListModalProps) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  // Don't render at all if never opened (avoids covering touch targets)
  if (!visible && (slideAnim as any)._value === SCREEN_WIDTH) return null;

  return (
    <Animated.View
      style={[
        styles.overlay,
        { transform: [{ translateX: slideAnim }] },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* Header — "< Voltar" + Title */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={8}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color={accentColor} />
          <Text style={[styles.backText, { color: accentColor }]}>Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isSelected = item.id === selectedId;
          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() => {
                onSelect(item);
                onClose();
              }}
              activeOpacity={0.6}
            >
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                {item.subtitle ? (
                  <Text style={styles.rowSubtitle}>{item.subtitle}</Text>
                ) : null}
              </View>
              {isSelected && (
                <Ionicons name="checkmark" size={22} color={accentColor} />
              )}
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        style={styles.list}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 85,
  },
  backText: {
    fontSize: fontSize.md,
    fontWeight: '400',
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    flex: 1,
  },
  headerSpacer: {
    width: 85,
  },
  list: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  rowLabel: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  rowSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
