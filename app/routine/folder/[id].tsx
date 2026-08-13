import { Text, View, ScrollView, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, fonts } from '../../../lib/theme/tokens';
import { useFolder, useRoutinesByFolder, useDeleteFolder, useUpdateFolder } from '../../../lib/hooks/useRoutines';
import { useDeleteRoutine } from '../../../lib/hooks/useRoutines';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { AnimatedListItem } from '../../../components/ui/AnimatedListItem';
import { Button } from '../../../components/ui/Button';
import { haptics } from '../../../lib/utils/haptics';

const FOLDER_COLORS = ['#4A6FA5', '#7A9AB5', '#6E9C8A', '#C2A05C', '#9AA4AE', '#3A587F', '#C96F6F', '#22344A'];

export default function FolderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const folderId = Number(id);

  const { data: folders, isLoading: loadingFolder } = useFolder(folderId);
  const { data: routines, isLoading: loadingRoutines } = useRoutinesByFolder(folderId);
  const deleteRoutine = useDeleteRoutine();
  const deleteFolder = useDeleteFolder();
  const updateFolder = useUpdateFolder();

  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState(colors.accent.primary);

  const folder = folders?.[0];

  const handleEditFolder = () => {
    if (!folder) return;
    setEditName(folder.name);
    setEditDescription(folder.description || '');
    setEditColor(folder.color || colors.accent.primary);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    try {
      await haptics.press();
      await updateFolder.mutateAsync({
        id: folderId,
        data: {
          name: editName.trim(),
          description: editDescription.trim() || undefined,
          color: editColor,
        },
      });
      setShowEditModal(false);
    } catch {
      await haptics.error();
    }
  };

  const handleDeleteFolder = () => {
    Alert.alert(
      'Eliminar carpeta',
      `¿Eliminar "${folder?.name}"? Las rutinas no se eliminarán, solo se desvincularán de esta carpeta.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await haptics.warning();
              await deleteFolder.mutateAsync(folderId);
              router.back();
            } catch {
              await haptics.error();
            }
          },
        },
      ]
    );
  };

  const handleDeleteRoutine = (routineId: number, routineName: string) => {
    Alert.alert(
      'Eliminar rutina',
      `¿Eliminar "${routineName}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await haptics.warning();
              await deleteRoutine.mutateAsync(routineId);
            } catch {
              await haptics.error();
            }
          },
        },
      ]
    );
  };

  if (loadingFolder || loadingRoutines) {
    return <LoadingSpinner message="Cargando carpeta..." />;
  }

  if (!folder) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.text.primary, fontSize: 16 }}>Carpeta no encontrada</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.bg.card, paddingTop: insets.top + spacing.sm + spacing.xs, paddingBottom: spacing.sm + spacing.xs, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: spacing.sm + spacing.xs }}>
            <Text style={{ fontSize: 20, color: colors.accent.primary }}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>{folder.name}</Text>
            </View>
            {folder.description && (
              <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.secondary, marginTop: spacing.xs }}>{folder.description}</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity onPress={handleEditFolder} style={{ padding: spacing.sm, marginRight: spacing.xs }}>
              <Text style={{ fontSize: 14, color: colors.text.link, fontFamily: fonts.bodyMedium }}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeleteFolder} style={{ padding: spacing.sm }}>
              <Text style={{ fontSize: 14, color: colors.error, fontFamily: fonts.bodyMedium }}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Routine List */}
      <ScrollView style={{ flex: 1, padding: spacing.md }}>
        {!routines || routines.length === 0 ? (
          <EmptyState
            title="Sin rutinas"
            message="Creá rutinas y vinculalas a esta carpeta."
          />
        ) : (
          routines.map((routine, index) => (
            <AnimatedListItem key={routine.id} index={index} delay={100}>
              <TouchableOpacity
                onPress={() => router.push(`/routine/${routine.id}`)}
                onLongPress={() => handleDeleteRoutine(routine.id, routine.name)}
                style={{ marginBottom: spacing.sm + spacing.xs }}
              >
                <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md + spacing.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>{routine.name}</Text>
                    {routine.description && (
                      <Text style={{ fontSize: 14, fontFamily: fonts.body, color: colors.text.secondary, marginTop: spacing.xs }}>{routine.description}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteRoutine(routine.id, routine.name)}
                    style={{ padding: spacing.sm }}
                  >
                    <Text style={{ fontSize: 18, color: colors.error }}>✕</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </AnimatedListItem>
          ))
        )}
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={{ padding: spacing.md, paddingTop: spacing.sm, backgroundColor: colors.bg.card, borderTopWidth: 1, borderTopColor: colors.border.primary, flexDirection: 'row', gap: spacing.sm + spacing.xs }}>
        <TouchableOpacity
          onPress={() => router.push(`/routine/create?folderId=${folderId}`)}
          style={{ flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.accent.primary, alignItems: 'center' }}
        >
          <Text style={{ color: colors.bg.primary, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>+ Rutina</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/routine/create')}
          style={{ flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.border.primary, alignItems: 'center', borderWidth: 1, borderColor: colors.border.light }}
        >
          <Text style={{ color: colors.text.primary, fontFamily: fonts.bodySemiBold, fontSize: 14 }}>Sin carpeta</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Modal */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.bg.card, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg }}>
            <Text style={{ fontSize: 18, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: 20 }}>Editar Carpeta</Text>

            <Text style={{ color: colors.text.secondary, fontFamily: fonts.bodyMedium, marginBottom: spacing.sm }}>Nombre</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Nombre de la carpeta"
              placeholderTextColor={colors.text.muted}
              style={{ backgroundColor: colors.border.primary, borderRadius: borderRadius.md, padding: spacing.md, color: colors.text.primary, marginBottom: spacing.md }}
            />

            <Text style={{ color: colors.text.secondary, fontFamily: fonts.bodyMedium, marginBottom: spacing.sm }}>Descripción (opcional)</Text>
            <TextInput
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder="Descripción"
              placeholderTextColor={colors.text.muted}
              style={{ backgroundColor: colors.border.primary, borderRadius: borderRadius.md, padding: spacing.md, color: colors.text.primary, marginBottom: spacing.md }}
            />

            <Text style={{ color: colors.text.secondary, fontFamily: fonts.bodyMedium, marginBottom: spacing.sm }}>Color</Text>
            <View style={{ flexDirection: 'row', marginBottom: 20, flexWrap: 'wrap', gap: spacing.sm }}>
              {FOLDER_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => setEditColor(color)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: borderRadius.full,
                    backgroundColor: color,
                    borderWidth: editColor === color ? 3 : 0,
                    borderColor: colors.text.primary,
                  }}
                />
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm + spacing.xs }}>
              <TouchableOpacity
                onPress={() => setShowEditModal(false)}
                style={{ flex: 1, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.border.primary, alignItems: 'center' }}
              >
                <Text style={{ color: colors.text.secondary, fontFamily: fonts.bodySemiBold }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEdit}
                style={{ flex: 1, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.accent.primary, alignItems: 'center' }}
              >
                <Text style={{ color: colors.bg.primary, fontFamily: fonts.bodySemiBold }}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
