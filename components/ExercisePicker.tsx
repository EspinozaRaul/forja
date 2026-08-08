import { View, Text, TextInput, TouchableOpacity, FlatList, Modal, ScrollView, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useMemo } from 'react';
import { colors, spacing, borderRadius } from '../lib/theme/tokens';
import { useCreateExercise } from '../lib/hooks/useExercises';
import { useCategories } from '../lib/hooks/useCategories';
import { EXERCISE_IMAGES } from '../lib/assets/exercise-images';
import { EXERCISE_NAMES_ES } from '../lib/db/exercise-names-es';
import type { Exercise } from '../lib/types';

interface ExercisePickerProps {
  visible: boolean;
  exercises: Exercise[];
  onSelect: (exercise: Exercise) => void;
  onMultiSelect?: (exercises: Exercise[]) => void;
  onPreview?: (exercise: Exercise) => void;
  onClose: () => void;
  multiSelect?: boolean;
}

// Muscle group filters — uses dataset "target" field (more accurate than muscle_group)
const MUSCLE_FILTERS = [
  { label: 'Todos', dbValues: null },
  { label: 'Pecho', dbValues: ['pectorals'] },
  { label: 'Espalda', dbValues: ['upper back', 'lats', 'spine', 'traps'] },
  { label: 'Hombros', dbValues: ['delts'] },
  { label: 'Bíceps', dbValues: ['biceps'] },
  { label: 'Tríceps', dbValues: ['triceps'] },
  { label: 'Antebrazos', dbValues: ['forearms'] },
  { label: 'Core', dbValues: ['abs'] },
  { label: 'Cuádriceps', dbValues: ['quads'] },
  { label: 'Isquiotibiales', dbValues: ['hamstrings'] },
  { label: 'Glúteos', dbValues: ['glutes'] },
  { label: 'Pantorrillas', dbValues: ['calves'] },
  { label: 'Cardio', dbValues: ['cardiovascular system'] },
];

function getExerciseName(exercise: Exercise): string {
  return EXERCISE_NAMES_ES[exercise.name] || exercise.name;
}

export function ExercisePicker({ visible, exercises, onSelect, onMultiSelect, onPreview, onClose, multiSelect = false }: ExercisePickerProps) {
  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string>('Todos');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const createExercise = useCreateExercise();
  const { data: categories } = useCategories();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

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
    if (selectedMuscle !== 'Todos') {
      const filter = MUSCLE_FILTERS.find(m => m.label === selectedMuscle);
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
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(exercise.id)) {
        next.delete(exercise.id);
      } else {
        next.add(exercise.id);
      }
      return next;
    });
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
      Alert.alert('Error', 'El nombre del ejercicio es obligatorio');
      return;
    }
    if (!selectedCategoryId) {
      Alert.alert('Error', 'Seleccioná una categoría');
      return;
    }
    try {
      const result = await createExercise.mutateAsync({
        name: newName.trim(),
        categoryId: selectedCategoryId,
        description: newDescription.trim() || undefined,
      });
      onSelect(result[0]);
      setNewName('');
      setNewDescription('');
      setSelectedCategoryId(null);
      setShowCreate(false);
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear el ejercicio');
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
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
          <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
            <View style={{ backgroundColor: colors.bg.card, borderBottomWidth: 1, borderBottomColor: colors.border.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={handleCancelCreate} style={{ width: 80 }}>
                <Text style={{ color: colors.accent.primary, fontSize: 16, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text.primary }}>Nuevo Ejercicio</Text>
              <TouchableOpacity onPress={handleCreateExercise} style={{ width: 80, alignItems: 'flex-end' }}>
                <Text style={{ color: colors.accent.primary, fontSize: 16, fontWeight: '600' }}>Guardar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1, padding: spacing.md }}>
              <Text style={{ fontSize: 14, color: colors.text.secondary, marginBottom: spacing.sm }}>Nombre *</Text>
              <TextInput
                style={{ backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.primary, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 16, color: colors.text.primary, marginBottom: spacing.md }}
                placeholder="Ej: Press con mancuerna"
                placeholderTextColor={colors.text.muted}
                value={newName}
                onChangeText={setNewName}
                autoFocus
              />

              <Text style={{ fontSize: 14, color: colors.text.secondary, marginBottom: spacing.sm }}>Descripción (opcional)</Text>
              <TextInput
                style={{ backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.primary, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 16, color: colors.text.primary, marginBottom: spacing.md, minHeight: 80, textAlignVertical: 'top' }}
                placeholder="Breve descripción del ejercicio"
                placeholderTextColor={colors.text.muted}
                value={newDescription}
                onChangeText={setNewDescription}
                multiline
              />

              <Text style={{ fontSize: 14, color: colors.text.secondary, marginBottom: spacing.sm }}>Categoría *</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: 24 }}>
                {categories?.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setSelectedCategoryId(cat.id)}
                    style={{ backgroundColor: selectedCategoryId === cat.id ? cat.color : colors.bg.elevated, borderWidth: selectedCategoryId === cat.id ? 0 : 1, borderColor: colors.border.primary, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: borderRadius.full }}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '600', color: selectedCategoryId === cat.id ? colors.text.primary : colors.text.secondary }}>
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg.primary }}>
        <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
          {/* Header */}
          <View style={{ backgroundColor: colors.bg.card, borderBottomWidth: 1, borderBottomColor: colors.border.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity onPress={onClose} style={{ width: 80 }}>
              <Text style={{ color: colors.accent.primary, fontSize: 16, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text.primary }}>
              {multiSelect ? `Seleccionar (${selectedIds.size})` : 'Seleccionar Ejercicio'}
            </Text>
            {multiSelect && selectedIds.size > 0 ? (
              <TouchableOpacity onPress={handleConfirmMultiSelect} style={{ width: 80, alignItems: 'flex-end' }}>
                <Text style={{ color: colors.accent.primary, fontSize: 16, fontWeight: '700' }}>Listo</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 80 }} />
            )}
          </View>

          {/* Search */}
          <View style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm + spacing.xs }}>
            <TextInput
              style={{ backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.primary, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 16, color: colors.text.primary }}
              placeholder="Buscar ejercicios..."
              placeholderTextColor={colors.text.muted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>

          {/* Muscle Group Filters */}
          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {MUSCLE_FILTERS.map((muscle) => (
                <TouchableOpacity
                  key={muscle.label}
                  onPress={() => setSelectedMuscle(muscle.label)}
                  style={{
                    backgroundColor: selectedMuscle === muscle.label ? colors.accent.primary : 'transparent',
                    borderWidth: 1,
                    borderColor: selectedMuscle === muscle.label ? colors.accent.primary : colors.border.primary,
                    paddingHorizontal: spacing.sm + spacing.xs,
                    paddingVertical: borderRadius.sm,
                    borderRadius: borderRadius.full,
                    marginRight: borderRadius.sm,
                  }}
                >
                  <Text style={{
                    fontSize: 12,
                    fontWeight: selectedMuscle === muscle.label ? '700' : '500',
                    color: selectedMuscle === muscle.label ? colors.bg.primary : colors.text.muted,
                  }}>
                    {muscle.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Results count */}
          <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
            <Text style={{ fontSize: 12, color: colors.text.muted }}>
              {filtered.length + ' ejercicio' + (filtered.length !== 1 ? 's' : '')}
              {multiSelect && selectedIds.size > 0 ? ' · ' + selectedIds.size + ' seleccionado' + (selectedIds.size !== 1 ? 's' : '') : ''}
            </Text>
          </View>

          {/* Create New Button */}
          <TouchableOpacity
            onPress={() => setShowCreate(true)}
            style={{ marginHorizontal: spacing.md, marginBottom: spacing.sm + spacing.xs, backgroundColor: colors.accent.primary, borderRadius: borderRadius.md, paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.bg.primary }}>+ Crear Ejercicio Nuevo</Text>
          </TouchableOpacity>

          {/* Exercise List */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 24 }}
            ListEmptyComponent={
              <View style={{ paddingVertical: 48, alignItems: 'center' }}>
                <Text style={{ color: colors.text.muted, fontSize: 14 }}>No se encontraron ejercicios</Text>
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
                  paddingVertical: 10,
                  marginBottom: spacing.sm,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.accent.primary : colors.border.primary,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  {/* Thumbnail — tap to preview */}
                  <TouchableOpacity
                    onPress={() => onPreview?.(item)}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  >
                    {exerciseImage ? (
                      <Image
                        source={exerciseImage}
                        style={{ width: 48, height: 48, borderRadius: borderRadius.sm, backgroundColor: colors.bg.elevated, resizeMode: 'contain' }}
                      />
                    ) : (
                      <View style={{ width: 48, height: 48, borderRadius: borderRadius.sm, backgroundColor: colors.bg.elevated, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 14, color: colors.text.muted, fontWeight: '600' }}>Ej</Text>
                      </View>
                    )}
                    <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.text.primary }} numberOfLines={1}>
                      {getExerciseName(item)}
                    </Text>
                  </TouchableOpacity>

                  {/* Add / Select button */}
                  {multiSelect ? (
                    <TouchableOpacity
                      onPress={() => handleToggleSelect(item)}
                      style={{
                        backgroundColor: isSelected ? colors.accent.primary : colors.border.primary,
                        borderRadius: borderRadius.sm,
                        paddingHorizontal: 14,
                        paddingVertical: spacing.sm,
                        borderWidth: isSelected ? 0 : 1,
                        borderColor: colors.border.light,
                      }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: '700', color: isSelected ? colors.bg.primary : colors.text.secondary }}>
                        {isSelected ? '✓' : '+'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => onSelect(item)}
                      style={{ backgroundColor: colors.accent.primary, borderRadius: borderRadius.sm, paddingHorizontal: 14, paddingVertical: spacing.sm }}
                    >
                      <Text style={{ fontSize: 18, fontWeight: '700', color: colors.bg.primary }}>+</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
