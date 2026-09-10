import { useState, useMemo } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts, fontSizes, borderWidths } from '../../lib/theme/tokens';
import { MODAL, EMBER_DOT } from '../../lib/constants/layout';

interface RoutineOption {
  id: number;
  name: string;
  sessionCount: number;
}

interface RoutinePickerModalProps {
  visible: boolean;
  routines: RoutineOption[];
  onSelect: (routineId: number) => void;
  onClose: () => void;
}

/**
 * Bottom-sheet-style modal listing routines with radio selection.
 * Includes search filter and "Seleccionar" confirm button.
 */
export function RoutinePickerModal({
  visible,
  routines,
  onSelect,
  onClose,
}: RoutinePickerModalProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return routines;
    const lower = query.toLowerCase();
    return routines.filter((r) => r.name.toLowerCase().includes(lower));
  }, [routines, query]);

  const handleConfirm = () => {
    if (selectedId != null) {
      onSelect(selectedId);
      onClose();
      setQuery('');
      setSelectedId(null);
    }
  };

  const handleClose = () => {
    onClose();
    setQuery('');
    setSelectedId(null);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      {/* Backdrop */}
      <Pressable
        onPress={handleClose}
        style={{
          flex: 1,
          backgroundColor: colors.overlay.default,
          justifyContent: 'flex-end',
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.bg.card,
            borderTopLeftRadius: borderRadius.xl,
            borderTopRightRadius: borderRadius.xl,
            maxHeight: '70%',
            paddingBottom: spacing.xl,
          }}
        >
          {/* Handle bar */}
          <View
            style={{
              width: MODAL.HANDLE_WIDTH,
              height: MODAL.HANDLE_HEIGHT,
              borderRadius: borderRadius.xs,
              backgroundColor: colors.border.light,
              alignSelf: 'center',
              marginTop: spacing.sm,
              marginBottom: spacing.md,
            }}
          />

          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.lg,
              marginBottom: spacing.md,
            }}
          >
            <Text
              style={{
                fontSize: fontSizes.lg,
                fontFamily: fonts.bodySemiBold,
                color: colors.text.primary,
              }}
            >
              {t('progress.routineCompare.selectRoutine')}
            </Text>
            <Pressable onPress={handleClose} hitSlop={8} accessibilityLabel={t('accessibility.routinePicker.close')} accessibilityRole="button">
              <Ionicons name="close" size={22} color={colors.text.muted} />
            </Pressable>
          </View>

          {/* Search */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.bg.elevated,
              borderRadius: borderRadius.md,
              borderWidth: borderWidths.thin,
              borderColor: colors.border.primary,
              marginHorizontal: spacing.lg,
              marginBottom: spacing.md,
              paddingHorizontal: spacing.sm,
            }}
          >
            <Ionicons name="search" size={18} color={colors.text.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('progress.routineCompare.searchPlaceholder')}
              placeholderTextColor={colors.text.muted}
              style={{
                flex: 1,
                paddingVertical: spacing.sm + spacing.xxs,
                paddingHorizontal: spacing.sm,
                fontSize: fontSizes.sm,
                fontFamily: fonts.body,
                color: colors.text.primary,
              }}
              accessibilityLabel={t('accessibility.routinePicker.search')}
              accessibilityRole="search"
              accessibilityHint={t('accessibility.routinePicker.searchHint')}
            />
          </View>

          {/* Routine list */}
          <ScrollView style={{ maxHeight: 360 }}>
            {filtered.length === 0 ? (
              <Text
                style={{
                  fontSize: fontSizes.sm,
                  color: colors.text.muted,
                  textAlign: 'center',
                  paddingVertical: spacing.lg,
                }}
              >
                {t('progress.routineCompare.noRoutines')}
              </Text>
            ) : (
              filtered.map((routine) => {
                const isSelected = selectedId === routine.id;
                return (
                  <Pressable
                    key={routine.id}
                    onPress={() => setSelectedId(routine.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.sm + spacing.xs,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border.divider,
                    }}
                    accessibilityLabel={`Seleccionar rutina: ${routine.name}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    {/* Radio indicator */}
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: borderRadius.xl,
                        borderWidth: borderWidths.thick,
                        borderColor: isSelected ? colors.accent.primary : colors.border.light,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isSelected && (
                        <View
                          style={{
                            width: EMBER_DOT.SIZE,
                            height: EMBER_DOT.SIZE,
                            borderRadius: borderRadius.md,
                            backgroundColor: colors.accent.primary,
                          }}
                        />
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: fontSizes.sm,
                          fontFamily: fonts.bodySemiBold,
                          color: colors.text.primary,
                        }}
                        numberOfLines={1}
                      >
                        {routine.name}
                      </Text>
                      <Text
                        style={{
                          fontSize: fontSizes.xs,
                          fontFamily: fonts.body,
                          color: colors.text.muted,
                        }}
                      >
                        {routine.sessionCount} {routine.sessionCount === 1 ? 'sesion' : 'sesiones'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {/* Confirm button */}
          <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
            <Pressable
              onPress={handleConfirm}
              disabled={selectedId == null}
              style={{
                backgroundColor: selectedId != null ? colors.accent.primary : colors.bg.elevated,
                borderRadius: borderRadius.md,
                paddingVertical: spacing.sm + spacing.xs,
                alignItems: 'center',
              }}
              accessibilityLabel={t('accessibility.routinePicker.select')}
              accessibilityRole="button"
              accessibilityState={{ disabled: selectedId == null }}
            >
              <Text
                style={{
                  fontSize: fontSizes.sm,
                  fontFamily: fonts.bodySemiBold,
                  color: selectedId != null ? colors.bg.primary : colors.text.muted,
                }}
              >
                {t('progress.routineCompare.select')}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
