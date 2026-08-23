import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../lib/theme/tokens';

export type IntensityMethod = 'dropset' | 'rest_pause' | 'cluster' | 'superset' | 'partial';

interface IntensityMethodOption {
  id: IntensityMethod;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const INTENSITY_METHODS: IntensityMethodOption[] = [
  {
    id: 'dropset',
    label: 'Drop Set',
    description: 'Reducir peso y continuar sin descanso',
    icon: 'flash',
  },
  {
    id: 'rest_pause',
    label: 'Rest-Pause',
    description: 'Pausa corta y continuar con el mismo peso',
    icon: 'pause',
  },
  {
    id: 'cluster',
    label: 'Cluster',
    description: 'Repeticiones agrupadas con micro-descansos',
    icon: 'ellipse',
  },
  {
    id: 'superset',
    label: 'Super Set',
    description: 'Dos ejercicios alternados sin descanso',
    icon: 'repeat',
  },
  {
    id: 'partial',
    label: 'Parcial',
    description: 'Repeticiones parciales con rango limitado',
    icon: 'resize',
  },
];

interface IntensityMethodPickerProps {
  visible: boolean;
  onSelect: (method: IntensityMethod) => void;
  onClose: () => void;
}

export function IntensityMethodPicker({ visible, onSelect, onClose }: IntensityMethodPickerProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Método de intensidad</Text>
          <Text style={styles.subtitle}>Seleccioná cómo querés registrar esta serie</Text>

          {INTENSITY_METHODS.map((method) => (
            <TouchableOpacity
              key={method.id}
              onPress={() => {
                onSelect(method.id);
                onClose();
              }}
              style={styles.option}
            >
              <Ionicons name={method.icon} size={20} color={colors.accent.primary} style={styles.optionIcon} />
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>{method.label}</Text>
                <Text style={styles.optionDescription}>{method.description}</Text>
              </View>
              <Text style={styles.optionArrow}>›</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: colors.text.muted,
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
    marginBottom: 2,
  },
  optionIcon: {
    width: 32,
    textAlign: 'center',
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  optionDescription: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 1,
  },
  optionArrow: {
    fontSize: 18,
    color: colors.text.muted,
  },
  cancelButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border.divider,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
});
