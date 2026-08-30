import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fontSizes } from '../lib/theme/tokens';

type NoteType = 'rendimiento' | 'ajuste' | null;

interface ExerciseNotesProps {
  notes: string | null;
  noteType?: string | null;
  onNotesChange: (notes: string | null, noteType?: string | null) => void;
}

const NOTE_TYPE_META: Record<string, { icon: 'trending-up' | 'options'; color: string }> = {
  rendimiento: { icon: 'trending-up', color: colors.accent.primary },
  ajuste: { icon: 'options', color: colors.warning },
};

function getNoteTypeInfo(type: string | null | undefined) {
  if (!type || !NOTE_TYPE_META[type]) return null;
  return { key: type, ...NOTE_TYPE_META[type] };
}

export function ExerciseNotes({ notes, noteType, onNotesChange }: ExerciseNotesProps) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState(notes ?? '');
  const [selectedType, setSelectedType] = useState<NoteType>((noteType as NoteType) ?? null);
  const { t } = useTranslation();

  useEffect(() => {
    setText(notes ?? '');
    setSelectedType((noteType as NoteType) ?? null);
  }, [notes, noteType]);

  const hasNotes = notes !== null && notes.trim().length > 0;
  const typeInfo = getNoteTypeInfo(noteType);

  const handleBlur = () => {
    onNotesChange(text.trim() || null, selectedType);
    setExpanded(false);
  };

  const handleTypeSelect = (type: NoteType) => {
    const next = selectedType === type ? null : type;
    setSelectedType(next);
  };

  // Collapsed: show type letter or document icon + preview
  if (!expanded) {
    const typeMeta = noteType ? NOTE_TYPE_META[noteType] : null;
    return (
      <TouchableOpacity
        onPress={() => setExpanded(true)}
        style={styles.trigger}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {typeMeta ? (
          <View style={[styles.typeIcon, { backgroundColor: typeMeta.color + '20' }]}>
            <Text style={[styles.typeIconText, { color: typeMeta.color }]}>
              {noteType === 'rendimiento' ? 'R' : 'A'}
            </Text>
          </View>
        ) : (
          <Ionicons
            name={hasNotes ? 'document-text' : 'document-text-outline'}
            size={14}
            color={hasNotes ? colors.accent.primary : colors.text.muted}
          />
        )}
        {hasNotes && (
          <Text style={styles.preview} numberOfLines={1}>
            {notes}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  // Expanded: text input + type selector
  return (
    <View style={styles.container}>
      <Ionicons name="document-text" size={14} color={colors.accent.primary} />
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        onBlur={handleBlur}
        placeholder={t('session.exerciseNotesPlaceholder')}
        placeholderTextColor={colors.text.muted}
        autoFocus
        multiline
      />
      <View style={styles.typeRow}>
        {(['rendimiento', 'ajuste'] as const).map((typeKey) => {
          const meta = NOTE_TYPE_META[typeKey];
          const label = typeKey === 'rendimiento' ? t('session.noteType.rendimiento') : t('session.noteType.ajuste');
          return (
            <TouchableOpacity
              key={typeKey}
              onPress={() => handleTypeSelect(typeKey)}
              style={[
                styles.typeChip,
                selectedType === typeKey && { backgroundColor: meta.color + '25', borderColor: meta.color },
              ]}
            >
              <Ionicons
                name={meta.icon}
                size={11}
                color={selectedType === typeKey ? meta.color : colors.text.muted}
              />
              <Text
                style={[
                  styles.typeChipText,
                  selectedType === typeKey && { color: meta.color },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
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
  typeIcon: {
    width: 16,
    height: 16,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconText: {
    fontSize: 10,
    fontWeight: '700',
  },
  container: {
    backgroundColor: colors.bg.elevated,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginTop: 4,
    gap: 4,
  },
  input: {
    fontSize: 11,
    color: colors.text.primary,
    padding: 0,
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  typeChipText: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.text.muted,
  },
});
