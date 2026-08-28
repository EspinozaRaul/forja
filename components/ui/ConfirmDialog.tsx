import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts } from '../../lib/theme/tokens';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
  // Optional third option (e.g., "Descartar")
  thirdLabel?: string;
  onThird?: () => void;
  thirdDestructive?: boolean;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
  thirdLabel,
  onThird,
  thirdDestructive = false,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  const hasThird = thirdLabel && onThird;
  const resolvedConfirmLabel = confirmLabel ?? t('common.confirm');
  const resolvedCancelLabel = cancelLabel ?? t('common.cancel');

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}

          {/* 3-button layout */}
          {hasThird ? (
            <View style={styles.actionsThree}>
              <TouchableOpacity
                onPress={onCancel}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>{resolvedCancelLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onThird}
                style={[styles.confirmButton, thirdDestructive && styles.confirmDestructive]}
              >
                <Text style={[styles.confirmText, thirdDestructive && styles.confirmTextDestructive]}>
                  {thirdLabel}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onConfirm}
                style={[styles.confirmButton, destructive && styles.confirmDestructive]}
              >
                <Text style={[styles.confirmText, destructive && styles.confirmTextDestructive]}>
                  {resolvedConfirmLabel}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* 2-button or 1-button layout */
            <View style={styles.actions}>
              {onCancel && (
                <TouchableOpacity
                  onPress={onCancel}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelText}>{resolvedCancelLabel}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={onConfirm}
                style={[
                  styles.confirmButton,
                  destructive && styles.confirmDestructive,
                  !onCancel && styles.confirmSingle,
                ]}
              >
                <Text style={[styles.confirmText, destructive && styles.confirmTextDestructive]}>
                  {resolvedConfirmLabel}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = {
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: 320,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.bodySemiBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center' as const,
  },
  message: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: spacing.sm,
  },
  actionsThree: {
    flexDirection: 'row' as const,
    gap: spacing.xs,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.sm + spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.border.primary,
    alignItems: 'center' as const,
  },
  cancelText: {
    color: colors.text.secondary,
    fontWeight: '600' as const,
    fontSize: 13,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: spacing.sm + spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.accent.primary,
    alignItems: 'center' as const,
  },
  confirmDestructive: {
    backgroundColor: colors.error,
  },
  confirmSingle: {
    flex: 1,
  },
  confirmText: {
    color: colors.bg.primary,
    fontWeight: '700' as const,
    fontSize: 13,
  },
  confirmTextDestructive: {
    color: colors.text.primary,
  },
};
