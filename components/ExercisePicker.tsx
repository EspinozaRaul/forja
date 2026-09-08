import { View, Text, TextInput, TouchableOpacity, FlatList, Modal, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useMemo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts, fontSizes, borderWidths} from '../lib/theme/tokens';
import { THUMBNAIL } from '../lib/constants/layout';
import { useCreateExercise, useExerciseStats } from '../lib/hooks/useExercises';
import { useCategories } from '../lib/hooks/useCategories';
import { useSettings } from '../lib/utils/settings';
import { resolveUnit, formatWeight } from '../lib/utils/weight-unit';
import { formatVolume } from '../lib/utils/format';
import { EXERCISE_IMAGES } from '../lib/assets/exercise-images';
import { EXERCISE_NAMES_ES } from '../lib/db/exercise-names-es';
import { getExerciseName } from '../lib/utils/exercise-names';
import type { Exercise } from '../lib/types';
import { ConfirmDialog } from './ui/ConfirmDialog';
import { useConfirmDialog } from '../lib/hooks/useConfirmDialog';

interface ExercisePickerState {
  search: string;
  selectedMuscle: string;
  selectedIds: number[];
}

interface ExercisePickerProps {
  visible: boolean;
  exercises: Exercise[];
  onSelect: (exercise: Exercise) => void;
  onMultiSelect?: (exercises: Exercise[]) => void;
  onClose: () => void;
  mode?: 'single' | 'multi';
  /** @deprecated Use mode instead. Kept for backward compat. */
  multiSelect?: boolean;
  initialSelected?: number[];
  // Controlled state (optional): when provided with onStateChange, the parent
  // owns search/filter/selection so they survive navigating to an exercise
  // preview and coming back. Falls back to internal state when omitted.
  state?: ExercisePickerState;
  onStateChange?: (state: ExercisePickerState) => void;
}

// Muscle group filters — uses dataset "target" field (more accurate than muscle_group)
const MUSCLE_FILTERS = [
  { key: 'all', dbValues: null },
  { key: 'pectorals', dbValues: ['pectorals'] },
  { key: 'back', dbValues: ['upper back', 'lats', 'spine', 'traps'] },
  { key: 'delts', dbValues: ['delts'] },
  { key: 'biceps', dbValues: ['biceps'] },
  { key: 'triceps', dbValues: ['triceps'] },
  { key: 'forearms', dbValues: ['forearms'] },
  { key: 'abs', dbValues: ['abs'] },
  { key: 'quads', dbValues: ['quads'] },
  { key: 'hamstrings', dbValues: ['hamstrings'] },
  { key: 'glutes', dbValues: ['glutes'] },
  { key: 'calves', dbValues: ['calves'] },
  { key: 'cardio', dbValues: ['cardiovascular system'] },
];

function getExerciseNameFromExercise(exercise: Exercise, lang: string): string {
  return getExerciseName(exercise.name, lang);
}

export function ExercisePicker({ visible, exercises, onSelect, onMultiSelect, onClose, mode, multiSelect: legacyMultiSelect, initialSelected, state: controlledState, onStateChange }: ExercisePickerProps) {
  const { dialog, showAlert } = useConfirmDialog();
  const { t, i18n } = useTranslation();
  const isMulti = mode === 'multi' || (!mode && legacyMultiSelect === true);
  // Internal fallback state — used only when the parent does not control state
  const [internalSearch, setInternalSearch] = useState('');
  const [internalMuscle, setInternalMuscle] = useState('all');
  const [internalIds, setInternalIds] = useState<Set<number>>(new Set(initialSelected ?? []));

  const isControlled = !!controlledState && !!onStateChange;
  const search = isControlled ? controlledState.search : internalSearch;
  const setSearch = (value: string) => {
    if (isControlled) onStateChange({ ...controlledState, search: value });
    else setInternalSearch(value);
  };
  const selectedMuscle = isControlled ? controlledState.selectedMuscle : internalMuscle;
  const setSelectedMuscle = (value: string) => {
    if (isControlled) onStateChange({ ...controlledState, selectedMuscle: value });
    else setInternalMuscle(value);
  };
  const selectedIds = isControlled ? new Set(controlledState.selectedIds) : internalIds;
  const setSelectedIds = (value: Set<number>) => {
    if (isControlled) onStateChange({ ...controlledState, selectedIds: [...value] });
    else setInternalIds(value);
  };

  const [showCreate, setShowCreate] = useState(false);
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const createExercise = useCreateExercise();
  const { data: categories } = useCategories();
  const settings = useSettings();

  const filtered = useMemo(() => {
    let result = exercises;

    // Text search
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter((e) => {
        const nameEs = EXERCISE_NAMES_ES[e.name]?.toLowerCase() || '';
        return (
          e.name.toLowerCase().includes(query) ||
          nameEs.includes(query) ||
          e.muscleGroup?.toLowerCase().includes(query) ||
          e.equipment?.toLowerCase().includes(query)
        );
      });
    }

    // Muscle group filter — match against target field (more accurate)
    if (selectedMuscle !== 'all') {
      const filter = MUSCLE_FILTERS.find(m => m.key === selectedMuscle);
      if (filter?.dbValues) {
        const values = filter.dbValues.map(v => v.toLowerCase());
        result = result.filter((e) => {
          const target = e.targetMuscle?.toLowerCase() || '';
          return values.includes(target);
        });
      }
    }

    return result;
  }, [exercises, search, selectedMuscle]);

  const handleToggleSelect = (exercise: Exercise) => {
    const next = new Set(selectedIds);
    if (next.has(exercise.id)) {
      next.delete(exercise.id);
    } else {
      next.add(exercise.id);
    }
    setSelectedIds(next);
  };

  const handleConfirmMultiSelect = () => {
    const selected = exercises.filter((e) => selectedIds.has(e.id));
    if (selected.length > 0 && onMultiSelect) {
      onMultiSelect(selected);
    }
    setSelectedIds(new Set());
    onClose();
  };

  const handleCreateExercise = async () => {
    if (!newName.trim()) {
      showAlert(t('common.error'), t('exercisePicker.error.nameRequired'));
      return;
    }
    if (!selectedCategoryId) {
      showAlert(t('common.error'), t('exercisePicker.error.categoryRequired'));
      return;
    }
    try {
      const result = await createExercise.mutateAsync({
        name: newName.trim(),
        categoryId: selectedCategoryId,
        description: newDescription.trim() || undefined,
        unit: settings.data.weightUnit,
      });
      onSelect(result[0]);
      setNewName('');
      setNewDescription('');
      setSelectedCategoryId(null);
      setShowCreate(false);
    } catch (error) {
      showAlert(t('common.error'), t('exercisePicker.error.createFailed'));
    }
  };

  const handleCancelCreate = () => {
    setNewName('');
    setNewDescription('');
    setSelectedCategoryId(null);
    setShowCreate(false);
  };

  if (showCreate) {
    return (
      <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
          <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
            <View style={{ backgroundColor: colors.bg.card, borderBottomWidth: 1, borderBottomColor: colors.border.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={handleCancelCreate} style={{ width: 80 }} accessibilityLabel="Cancelar" accessibilityRole="button">
                <Text style={{ color: colors.accent.primary, fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>{t('exercisePicker.newExercise')}</Text>
              <TouchableOpacity onPress={handleCreateExercise} style={{ width: 80, alignItems: 'flex-end' }} accessibilityLabel="Guardar ejercicio" accessibilityRole="button">
                <Text style={{ color: colors.accent.primary, fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold }}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, padding: spacing.md }}>
              <Text style={{ fontSize: fontSizes.sm, color: colors.text.secondary, marginBottom: spacing.sm }}>{t('exercisePicker.nameLabel')}</Text>
              <TextInput
                style={{ backgroundColor: colors.bg.elevated, borderWidth: borderWidths.thin, borderColor: colors.border.primary, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: fontSizes.lg, color: colors.text.primary, marginBottom: spacing.md }}
                placeholder={t('exercisePicker.namePlaceholder')}
                placeholderTextColor={colors.text.muted}
                value={newName}
                onChangeText={setNewName}
                autoFocus
                accessibilityLabel="Nombre del ejercicio"
                accessibilityHint="Ingresa el nombre del nuevo ejercicio"
              />

              <Text style={{ fontSize: fontSizes.sm, color: colors.text.secondary, marginBottom: spacing.sm }}>{t('exercisePicker.descriptionLabel')}</Text>
              <TextInput
                style={{ backgroundColor: colors.bg.elevated, borderWidth: borderWidths.thin, borderColor: colors.border.primary, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: fontSizes.lg, color: colors.text.primary, marginBottom: spacing.md, minHeight: 80, textAlignVertical: 'top' }}
                placeholder={t('exercisePicker.descriptionPlaceholder')}
                placeholderTextColor={colors.text.muted}
                value={newDescription}
                onChangeText={setNewDescription}
                multiline
                accessibilityLabel="Descripción del ejercicio"
                accessibilityHint="Ingresa una descripción del ejercicio"
              />

              <Text style={{ fontSize: fontSizes.sm, color: colors.text.secondary, marginBottom: spacing.sm }}>{t('exercisePicker.categoryLabel')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
                {categories?.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setSelectedCategoryId(cat.id)}
                    style={{ backgroundColor: selectedCategoryId === cat.id ? cat.color : colors.bg.elevated, borderWidth: selectedCategoryId === cat.id ? 0 : 1, borderColor: colors.border.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + spacing.xs, borderRadius: borderRadius.full }}
                    accessibilityLabel={`Categoría: ${cat.name}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedCategoryId === cat.id }}
                  >
                    <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: selectedCategoryId === cat.id ? colors.text.primary : colors.text.secondary }}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
      <ConfirmDialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        confirmLabel={dialog.confirmLabel}
        cancelLabel={dialog.cancelLabel}
        destructive={dialog.destructive}
        onConfirm={dialog.onConfirm}
        onCancel={dialog.onCancel}
      />
      </>
    );
  }

  return (
    <>
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
        <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
          {/* Header */}
          <View style={{ backgroundColor: colors.bg.card, borderBottomWidth: 1, borderBottomColor: colors.border.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity onPress={onClose} style={{ width: 80 }} accessibilityLabel="Cancelar" accessibilityRole="button">
              <Text style={{ color: colors.accent.primary, fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
              {isMulti ? t('exercisePicker.selectCount', { count: selectedIds.size }) : t('exercisePicker.selectTitle')}
            </Text>
            <View style={{ width: 80 }} />
          </View>

          {/* Search */}
          <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm + spacing.xs }}>
            <TextInput
              style={{ backgroundColor: colors.bg.elevated, borderWidth: borderWidths.thin, borderColor: colors.border.primary, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: fontSizes.lg, color: colors.text.primary }}
              placeholder={t('exercisePicker.searchPlaceholder')}
              placeholderTextColor={colors.text.muted}
              value={search}
              onChangeText={setSearch}
              autoFocus
              accessibilityLabel="Buscar ejercicios"
              accessibilityRole="search"
              accessibilityHint="Escribe para buscar ejercicios por nombre o músculo"
            />
          </View>

          {/* Muscle Group Filters */}
          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {MUSCLE_FILTERS.map((muscle) => (
                <TouchableOpacity
                  key={muscle.key}
                  onPress={() => setSelectedMuscle(muscle.key)}
                  style={{
                    backgroundColor: selectedMuscle === muscle.key ? colors.accent.primary : 'transparent',
                    borderWidth: borderWidths.thin,
                    borderColor: selectedMuscle === muscle.key ? colors.accent.primary : colors.border.primary,
                    paddingHorizontal: spacing.sm + spacing.xs,
                    paddingVertical: spacing.xs,
                    borderRadius: borderRadius.full,
                    marginRight: spacing.sm,
                  }}
                  accessibilityLabel={`Filtrar por: ${t(`exercisePicker.muscle.${muscle.key}`)}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selectedMuscle === muscle.key }}
                >
                  <Text style={{
                    fontSize: fontSizes.xs, fontFamily: selectedMuscle === muscle.key ? fonts.bodySemiBold : fonts.body,
                    color: selectedMuscle === muscle.key ? colors.bg.primary : colors.text.muted,
                  }}>
                    {t(`exercisePicker.muscle.${muscle.key}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Results count */}
          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
            <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted }}>
              {t('exercisePicker.resultCount', { count: filtered.length })}
              {isMulti && selectedIds.size > 0 ? ' · ' + t('exercisePicker.selectedCount', { count: selectedIds.size }) : ''}
            </Text>
          </View>

          {/* Create New Button */}
          <TouchableOpacity
            onPress={() => setShowCreate(true)}
            style={{ marginHorizontal: spacing.md, marginBottom: spacing.sm + spacing.xs, backgroundColor: colors.accent.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center' }}
            accessibilityLabel="Crear nuevo ejercicio"
            accessibilityRole="button"
            accessibilityHint="Abre el formulario para crear un nuevo ejercicio"
          >
            <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.bg.primary }}>{t('exercisePicker.createNew')}</Text>
          </TouchableOpacity>

          {/* Exercise List */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}
            ListEmptyComponent={
              <View style={{ paddingVertical: spacing.xxl, alignItems: 'center' }}>
                <Text style={{ color: colors.text.muted, fontSize: fontSizes.sm }}>{t('exercisePicker.noResults')}</Text>
              </View>
            }
            renderItem={({ item }) => {
              const exerciseImage = item.originalId ? EXERCISE_IMAGES[item.originalId] : null;
              const isSelected = selectedIds.has(item.id);
              return (
                <View style={{
                  backgroundColor: isSelected ? colors.bg.selected : colors.bg.card,
                  borderRadius: borderRadius.md,
                  paddingHorizontal: spacing.sm + spacing.xs,
                  paddingVertical: spacing.sm + spacing.xs,
                  marginBottom: spacing.sm,
                  borderWidth: borderWidths.thin,
                  borderColor: isSelected ? colors.accent.primary : colors.border.primary,
                  flexDirection: 'row',
                  alignItems: 'center',
                   gap: spacing.sm + spacing.xxs,
                }}>
                  {/* Checkbox — multi mode only */}
                  {isMulti && (
                    <TouchableOpacity
                      onPress={() => handleToggleSelect(item)}
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: borderRadius.xl,
                        borderWidth: borderWidths.medium,
                        borderColor: isSelected ? colors.accent.primary : colors.border.light,
                        backgroundColor: isSelected ? colors.accent.primary : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      accessibilityLabel={isSelected ? `Desseleccionar ${getExerciseNameFromExercise(item, i18n.language)}` : `Seleccionar ${getExerciseNameFromExercise(item, i18n.language)}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                    >
                      {isSelected && (
                        <Ionicons name="checkmark" size={12} color={colors.bg.primary} />
                      )}
                    </TouchableOpacity>
                  )}

                  {/* Thumbnail — tap to preview inline */}
                  <TouchableOpacity
                    onPress={() => {
                      if (isMulti) {
                        handleToggleSelect(item);
                      } else {
                        setPreviewExercise(item);
                      }
                    }}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm + spacing.xxs }}
                    accessibilityLabel={`Seleccionar ejercicio: ${getExerciseNameFromExercise(item, i18n.language)}`}
                    accessibilityRole="button"
                  >
                    {exerciseImage ? (
                      <Image
                        source={exerciseImage}
                        style={{ width: THUMBNAIL.SIZE_LG, height: THUMBNAIL.SIZE_LG, borderRadius: borderRadius.sm, backgroundColor: colors.bg.elevated, resizeMode: 'contain' }}
                      />
                    ) : (
                      <View style={{ width: THUMBNAIL.SIZE_LG, height: THUMBNAIL.SIZE_LG, borderRadius: borderRadius.sm, backgroundColor: colors.bg.elevated, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: fontSizes.md, color: colors.text.muted, fontFamily: fonts.bodySemiBold }}>Ej</Text>
                      </View>
                    )}
                    <Text style={{ flex: 1, fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary }} numberOfLines={1}>
                      {getExerciseNameFromExercise(item, i18n.language)}
                    </Text>
                  </TouchableOpacity>

                  {/* Add / Select button — single mode only */}
                  {!isMulti && (
                    <TouchableOpacity
                      onPress={() => onSelect(item)}
                      style={{ backgroundColor: colors.accent.primary, borderRadius: borderRadius.sm, paddingHorizontal: spacing.sm + spacing.xs, paddingVertical: spacing.sm }}
                      accessibilityLabel={`Agregar ejercicio: ${getExerciseNameFromExercise(item, i18n.language)}`}
                      accessibilityRole="button"
                    >
                      <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.bg.primary }}>+</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
          />

          {/* Bottom bar — multi mode only */}
          {isMulti && (
            <View style={{
              backgroundColor: colors.bg.card,
              borderTopWidth: 1,
              borderTopColor: colors.border.primary,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.secondary }}>
                {t('exercisePicker.selectedCount', { count: selectedIds.size })}
              </Text>
              <TouchableOpacity
                onPress={handleConfirmMultiSelect}
                disabled={selectedIds.size === 0}
                style={{
                  backgroundColor: selectedIds.size > 0 ? colors.accent.primary : colors.bg.elevated,
                  borderRadius: borderRadius.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.sm + spacing.xs,
                }}
                accessibilityLabel="Confirmar selección"
                accessibilityRole="button"
                accessibilityState={{ disabled: selectedIds.size === 0 }}
              >
                <Text style={{
                  fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold,
                  color: selectedIds.size > 0 ? colors.bg.primary : colors.text.muted,
                }}>
                  {t('exercisePicker.done')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* Exercise Detail Preview — inline overlay */}
      {previewExercise && (
        <ExercisePreview
          exercise={previewExercise}
          visible={!!previewExercise}
          onClose={() => setPreviewExercise(null)}
          onAdd={(exercise) => {
            onSelect(exercise);
            setPreviewExercise(null);
          }}
        />
      )}
    </Modal>
    <ConfirmDialog
      visible={dialog.visible}
      title={dialog.title}
      message={dialog.message}
      confirmLabel={dialog.confirmLabel}
      cancelLabel={dialog.cancelLabel}
      destructive={dialog.destructive}
      onConfirm={dialog.onConfirm}
      onCancel={dialog.onCancel}
    />
    </>
  );
}

// ─── Exercise Preview Overlay ─────────────────────────────
function ExercisePreview({ exercise, visible, onClose, onAdd }: {
  exercise: Exercise;
  visible: boolean;
  onClose: () => void;
  onAdd: (exercise: Exercise) => void;
}) {
  const settings = useSettings();
  const { t, i18n } = useTranslation();
  const { data: stats } = useExerciseStats(exercise.id);
  const unit = resolveUnit(exercise.unit, settings.data.weightUnit);
  const exerciseImage = exercise.originalId ? EXERCISE_IMAGES[exercise.originalId] : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
        {/* Header */}
        <View style={{ backgroundColor: colors.bg.card, borderBottomWidth: 1, borderBottomColor: colors.border.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={onClose} style={{ width: 80 }} accessibilityLabel="Volver" accessibilityRole="button">
            <Text style={{ color: colors.accent.primary, fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold }}>{t('common.back')}</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
            {t('exercisePicker.exercise')}
          </Text>
          <TouchableOpacity onPress={() => onAdd(exercise)} style={{ width: 80, alignItems: 'flex-end' }} accessibilityLabel="Agregar ejercicio" accessibilityRole="button">
            <Text style={{ color: colors.accent.primary, fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold }}>{t('exercisePicker.add')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          {/* Exercise Image */}
          {exerciseImage && (
            <View style={{ backgroundColor: colors.bg.card, alignItems: 'center', paddingVertical: spacing.lg }}>
              <Image
                source={exerciseImage}
                style={{ width: 180, height: 180, borderRadius: borderRadius.md, resizeMode: 'contain' }}
              />
            </View>
          )}

          {/* Exercise Name + Tags */}
          <View style={{ backgroundColor: colors.bg.card, padding: spacing.lg, marginTop: spacing.xs }}>
            <Text style={{ fontSize: fontSizes.xl, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
              {getExerciseName(exercise.name, i18n.language)}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm }}>
              {exercise.muscleGroup && (
                <View style={{ backgroundColor: colors.tag.muscle, paddingHorizontal: spacing.sm + spacing.xxs, paddingVertical: spacing.xs, borderRadius: borderRadius.full }}>
                  <Text style={{ fontSize: fontSizes.xs, color: colors.tag.text }}>{exercise.muscleGroup}</Text>
                </View>
              )}
              {exercise.equipment && (
                <View style={{ backgroundColor: colors.tag.equipment, paddingHorizontal: spacing.sm + spacing.xxs, paddingVertical: spacing.xs, borderRadius: borderRadius.full }}>
                  <Text style={{ fontSize: fontSizes.xs, color: colors.tag.equipmentText }}>{exercise.equipment}</Text>
                </View>
              )}
            </View>
            {exercise.instructionsEs && (
              <Text style={{ fontSize: fontSizes.md, color: colors.text.secondary, marginTop: spacing.md, lineHeight: 20 }}>
                {exercise.instructionsEs}
              </Text>
            )}
          </View>

          {/* Quick Stats */}
          <View style={{ flexDirection: 'row', padding: spacing.md, gap: spacing.sm }}>
            <View style={{ flex: 1, backgroundColor: colors.bg.card, borderRadius: borderRadius.md, padding: spacing.sm, alignItems: 'center' }}>
              <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted }}>{t('progress.max')}</Text>
              <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.accent.primary }}>
                {stats?.maxWeight ? formatWeight(stats.maxWeight, unit) : '-'}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.bg.card, borderRadius: borderRadius.md, padding: spacing.sm, alignItems: 'center' }}>
              <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted }}>{t('progress.volume')}</Text>
              <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.accent.primary }}>
                {stats?.totalVolume ? formatVolume(stats.totalVolume, unit) : '0'}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.bg.card, borderRadius: borderRadius.md, padding: spacing.sm, alignItems: 'center' }}>
              <Text style={{ fontSize: fontSizes.xs, color: colors.text.muted }}>{t('progress.exercises')}</Text>
              <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.accent.primary }}>
                {stats?.totalSessions ?? 0}
              </Text>
            </View>
          </View>

          {/* Add Button */}
          <View style={{ padding: spacing.md }}>
            <TouchableOpacity
              onPress={() => onAdd(exercise)}
              style={{ backgroundColor: colors.accent.primary, borderRadius: borderRadius.md, paddingVertical: spacing.md, alignItems: 'center' }}
              accessibilityLabel="Agregar ejercicio a la rutina"
              accessibilityRole="button"
            >
              <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.bg.primary }}>{t('exercisePicker.addExercise')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
