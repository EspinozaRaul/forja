import { Text, View, ScrollView } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useCategories } from '../../lib/hooks/useCategories';
import { useCreateExercise } from '../../lib/hooks/useExercises';
import { useSettings } from '../../lib/utils/settings';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { colors, spacing, fonts } from '../../lib/theme/tokens';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../../lib/hooks/useConfirmDialog';

export default function CreateExerciseScreen() {
  const router = useRouter();
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const createExercise = useCreateExercise();
  const settings = useSettings();
  const { dialog, showAlert } = useConfirmDialog();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [errors, setErrors] = useState<{ name?: string; category?: string }>({});

  const validate = () => {
    const newErrors: { name?: string; category?: string } = {};
    if (!name.trim()) {
      newErrors.name = 'Exercise name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Exercise name must be at least 2 characters';
    }
    if (!selectedCategoryId) {
      newErrors.category = 'Please select a category';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      await createExercise.mutateAsync({
        name: name.trim(),
        categoryId: selectedCategoryId!,
        description: description.trim() || undefined,
        unit: settings.data.weightUnit,
      });
      router.back();
    } catch (error) {
      showAlert('Error', 'Failed to create exercise. Please try again.');
    }
  };

  if (categoriesLoading) {
    return <LoadingSpinner message="Loading categories..." />;
  }

  return (
    <>
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg.primary, padding: spacing.md }} className="flex-1 bg-dark-bg p-4">
      <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md }} className="text-lg font-semibold text-dark-text-primary mb-4">Create New Exercise</Text>

      <Input
        label="Exercise Name"
        placeholder="e.g., Bench Press"
        value={name}
        onChangeText={setName}
        error={errors.name}
      />

      <Input
        label="Description (optional)"
        placeholder="e.g., Barbell bench press for chest"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
      />

      <Text style={{ fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.text.secondary, marginBottom: spacing.sm }} className="text-sm font-medium text-dark-text-secondary mb-2">Category *</Text>
      {errors.category && (
        <Text style={{ color: colors.error, fontSize: 14, marginBottom: spacing.sm }} className="text-red-500 text-sm mb-2">{errors.category}</Text>
      )}
      <View className="flex-row flex-wrap mb-4">
        {categories?.map((category) => (
          <Button
            key={category.id}
            title={category.name}
            variant={selectedCategoryId === category.id ? 'primary' : 'secondary'}
            onPress={() => setSelectedCategoryId(category.id)}
            className="mr-2 mb-2"
          />
        ))}
      </View>

      <Button
        title="Create Exercise"
        onPress={handleSubmit}
        loading={createExercise.isPending}
        disabled={createExercise.isPending}
      />
    </ScrollView>
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
