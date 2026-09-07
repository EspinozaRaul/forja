import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fontSizes , fontWeights, borderWidths} from '../lib/theme/tokens';
import { MODAL, ICON } from '../lib/constants/layout';

export type IntensityMethod = 'dropset' | 'rest_pause' | 'cluster' | 'superset' | 'partial';

interface IntensityMethodOption {
  id: IntensityMethod;
  icon: keyof typeof Ionicons.glyphMap;
}

const INTENSITY_METHODS: IntensityMethodOption[] = [
  { id: 'dropset', icon: 'flash' },
  { id: 'rest_pause', icon: 'pause' },
  { id: 'cluster', icon: 'ellipse' },
  { id: 'superset', icon: 'repeat' },
  { id: 'partial', icon: 'resize' },
];

interface IntensityMethodPickerProps {
  visible: boolean;
  onSelect: (method: IntensityMethod) => void;
  onClose: () => void;
}

export function IntensityMethodPicker({ visible, onSelect, onClose }: IntensityMethodPickerProps) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
        accessibilityLabel="Cerrar selector de método"
        accessibilityRole="button"
      >
        <View style={styles.container}>
          <Text style={styles.title}>{t('methods.title')}</Text>
          <Text style={styles.subtitle}>{t('methods.subtitle')}</Text>

          {INTENSITY_METHODS.map((method) => (
            <TouchableOpacity
              key={method.id}
              onPress={() => {
                onSelect(method.id);
                onClose();
              }}
              style={styles.option}
              accessibilityLabel={`Seleccionar método: ${t(`methods.${method.id}.label`)}`}
              accessibilityRole="button"
            >
              <Ionicons name={method.icon} size={20} color={colors.accent.primary} style={styles.optionIcon} />
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>{t(`methods.${method.id}.label`)}</Text>
                <Text style={styles.optionDescription}>{t(`methods.${method.id}.description`)}</Text>
              </View>
              <Text style={styles.optionArrow}>›</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity onPress={onClose} style={styles.cancelButton} accessibilityLabel="Cancelar" accessibilityRole="button">
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay.default,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    width: '100%',
    maxWidth: MODAL.MAX_WIDTH,
    borderWidth: borderWidths.thin,
    borderColor: colors.border.primary,
  },
  title: {
    fontSize: fontSizes.lg, fontWeight: fontWeights.bold,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: fontSizes.xs, color: colors.text.muted,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xxs,
  },
  optionIcon: {
    width: ICON.SIZE_XL,
    textAlign: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: fontSizes.sm, fontWeight: fontWeights.semibold,
    color: colors.text.primary,
  },
  optionDescription: {
    fontSize: fontSizes.xs, color: colors.text.muted,
    marginTop: spacing.xxs,
  },
  optionArrow: {
    fontSize: fontSizes.lg, color: colors.text.muted,
  },
  cancelButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
  },
  cancelText: {
    fontSize: fontSizes.sm, fontWeight: fontWeights.semibold,
    color: colors.text.secondary,
  },
});
