import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState } from 'react';
import { colors, spacing, borderRadius } from '../lib/theme/tokens';
import type { Set } from '../lib/types';

interface Drop {
  id?: number;
  weight: number | null;
  reps: number | null;
  completed: boolean;
}

interface DropSetLoggerProps {
  parentSet: Set;
  drops: Drop[];
  onUpdateDrop: (dropIndex: number, updates: { reps?: number; weight?: number; completed?: boolean }) => void;
  onAddDrop: () => void;
  onDeleteDrop: (dropIndex: number) => void;
  onCompleteAll: () => void;
  unit?: string;
}

export function DropSetLogger({
  parentSet,
  drops,
  onUpdateDrop,
  onAddDrop,
  onDeleteDrop,
  onCompleteAll,
  unit = 'kg',
}: DropSetLoggerProps) {
  const allCompleted = drops.length > 0 && drops.every((d) => d.completed);

  return (
    <View style={styles.container}>
      {/* Parent set header */}
      <View style={styles.parentHeader}>
        <View style={styles.parentBadge}>
          <Text style={styles.parentBadgeText}>⚡ DROP SET</Text>
        </View>
        <Text style={styles.parentText}>
          Serie #{parentSet.setNumber}
        </Text>
        {allCompleted && (
          <Text style={{ fontSize: 16, color: colors.accent.primary }}>✓</Text>
        )}
      </View>

      {/* Drops list */}
      {drops.map((drop, index) => (
        <View key={index} style={styles.dropRow}>
          <View style={styles.dropIndicator}>
            <View style={[styles.dropDot, drop.completed && styles.dropDotCompleted]} />
            {index < drops.length - 1 && <View style={styles.dropLine} />}
          </View>

          <View style={styles.dropContent}>
            <Text style={styles.dropLabel}>Drop {index + 1}</Text>
            <View style={styles.dropInputs}>
              <TextInput
                style={styles.dropInput}
                keyboardType="numeric"
                placeholder="Reps"
                placeholderTextColor={colors.text.muted}
                value={drop.reps?.toString() ?? ''}
                onChangeText={(text) => {
                  const value = parseInt(text, 10);
                  onUpdateDrop(index, { reps: isNaN(value) ? undefined : value });
                }}
              />
              <TextInput
                style={styles.dropInput}
                keyboardType="decimal-pad"
                placeholder={unit}
                placeholderTextColor={colors.text.muted}
                value={drop.weight?.toString() ?? ''}
                onChangeText={(text) => {
                  const value = parseFloat(text);
                  onUpdateDrop(index, { weight: isNaN(value) ? undefined : value });
                }}
              />
              <TouchableOpacity
                onPress={() => onUpdateDrop(index, { completed: !drop.completed })}
                style={[
                  styles.dropCheck,
                  drop.completed ? styles.dropCheckCompleted : styles.dropCheckIncomplete,
                ]}
              >
                <Text style={{ color: drop.completed ? colors.bg.primary : colors.text.muted, fontSize: 12, fontWeight: '700' }}>
                  {drop.completed ? '✓' : ''}
                </Text>
              </TouchableOpacity>
              {drops.length > 1 && (
                <TouchableOpacity
                  onPress={() => onDeleteDrop(index)}
                  style={styles.dropDelete}
                >
                  <Text style={{ fontSize: 14, color: colors.error }}>×</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      ))}

      {/* Add drop button */}
      <TouchableOpacity onPress={onAddDrop} style={styles.addDropButton}>
        <Text style={{ fontSize: 14, color: colors.accent.secondary }}>+</Text>
        <Text style={styles.addDropText}>Agregar Drop</Text>
      </TouchableOpacity>

      {/* Complete all button */}
      {!allCompleted && drops.length > 0 && (
        <TouchableOpacity onPress={onCompleteAll} style={styles.completeAllButton}>
          <Text style={styles.completeAllText}>Completar todos los drops</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg.secondary,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginLeft: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
    marginBottom: spacing.xs,
  },
  parentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  parentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 184, 0, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  parentBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.warning,
    letterSpacing: 0.5,
  },
  parentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  dropRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  dropIndicator: {
    width: 16,
    alignItems: 'center',
  },
  dropDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border.light,
    marginTop: 6,
  },
  dropDotCompleted: {
    backgroundColor: colors.accent.primary,
  },
  dropLine: {
    width: 1,
    flex: 1,
    backgroundColor: colors.border.primary,
    marginTop: 4,
  },
  dropContent: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  dropLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.muted,
    marginBottom: 4,
  },
  dropInputs: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  dropInput: {
    flex: 1,
    backgroundColor: colors.bg.elevated,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  dropCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropCheckCompleted: {
    backgroundColor: colors.accent.primary,
  },
  dropCheckIncomplete: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border.primary,
  },
  dropDelete: {
    padding: 4,
  },
  addDropButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
  },
  addDropText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent.secondary,
  },
  completeAllButton: {
    backgroundColor: colors.accent.muted,
    borderRadius: borderRadius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  completeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent.primary,
  },
});
