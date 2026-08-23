import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../lib/theme/tokens';

interface ExerciseNotesProps {
  notes: string | null;
  onNotesChange: (notes: string | null) => void;
}

/**
 * Discreet exercise notes — small notepad icon that expands to show a text input.
 * Used in session view for seat height, shoulder pain notes, etc.
 */
export function ExerciseNotes({ notes, onNotesChange }: ExerciseNotesProps) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState(notes ?? '');

  const hasNotes = notes !== null && notes.trim().length > 0;

  const handleBlur = () => {
    onNotesChange(text.trim() || null);
    setExpanded(false);
  };

  if (!expanded) {
    return (
      <TouchableOpacity
        onPress={() => setExpanded(true)}
        style={styles.trigger}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name={hasNotes ? 'document-text' : 'document-text-outline'}
          size={14}
          color={hasNotes ? colors.accent.primary : colors.text.muted}
        />
        {hasNotes && (
          <Text style={styles.preview} numberOfLines={1}>
            {notes}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      <Ionicons name="document-text" size={14} color={colors.accent.primary} />
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        onBlur={handleBlur}
        placeholder="Nota (altura del asiento, molestia, etc.)"
        placeholderTextColor={colors.text.muted}
        autoFocus
        multiline
      />
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  preview: {
    fontSize: 10,
    color: colors.text.muted,
    maxWidth: 120,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bg.elevated,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginTop: 4,
  },
  input: {
    flex: 1,
    fontSize: 11,
    color: colors.text.primary,
    padding: 0,
  },
});
