import { Text, View, ScrollView, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useFolders, useRoutines, useCreateFolder, useDeleteFolder } from '../../lib/hooks/useRoutines';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { AnimatedListItem } from '../../components/ui/AnimatedListItem';
import { Button } from '../../components/ui/Button';
import { haptics } from '../../lib/utils/haptics';
import { colors, spacing, borderRadius } from '../../lib/theme/tokens';

const FOLDER_COLORS = ['#00F5A0', '#FF6B6B', '#4ECDC4', '#FFE66D', '#A78BFA', '#F472B6', '#34D399', '#60A5FA'];

export default function RoutinesScreen() {
  const router = useRouter();
  const { data: folders, isLoading: loadingFolders } = useFolders();
  const { data: routines, isLoading: loadingRoutines } = useRoutines();
  const createFolder = useCreateFolder();
  const deleteFolder = useDeleteFolder();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('#00F5A0');

  const isLoading = loadingFolders || loadingRoutines;

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await haptics.press();
      await createFolder.mutateAsync({
        name: newFolderName.trim(),
        description: newFolderDescription.trim() || undefined,
        color: newFolderColor,
      });
      setShowCreateModal(false);
      setNewFolderName('');
      setNewFolderDescription('');
      setNewFolderColor('#00F5A0');
    } catch {
      await haptics.error();
      Alert.alert('Error', 'No se pudo crear la carpeta');
    }
  };

  const handleDeleteFolder = (folderId: number, folderName: string) => {
    Alert.alert(
      'Eliminar carpeta',
      `¿Eliminar "${folderName}"? Las rutinas no se eliminarán, solo se desvincularán.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await haptics.warning();
              await deleteFolder.mutateAsync(folderId);
            } catch {
              await haptics.error();
            }
          },
        },
      ]
    );
  };

  // Routines without a folder
  const unlinkedRoutines = routines?.filter((r) => !r.folderId) ?? [];

  if (isLoading) {
    return <LoadingSpinner message="Cargando rutinas..." />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.bg.card, padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border.primary }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text.primary }}>Mis Rutinas</Text>
      </View>

      <ScrollView style={{ flex: 1, padding: spacing.md }}>
        {/* Folders Section */}
        {folders && folders.length > 0 && (
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 }}>
              Carpetas
            </Text>
            {folders.map((folder, index) => (
              <AnimatedListItem key={folder.id} index={index} delay={80}>
                <TouchableOpacity
                  onPress={() => router.push(`/routine/folder/${folder.id}`)}
                  onLongPress={() => handleDeleteFolder(folder.id, folder.name)}
                  style={{ marginBottom: spacing.sm }}
                >
                  <View style={{
                    backgroundColor: colors.bg.card,
                    borderRadius: borderRadius.lg,
                    padding: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderLeftWidth: 4,
                    borderLeftColor: folder.color || colors.accent.primary,
                  }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text.primary }}>{folder.name}</Text>
                      {folder.description && (
                        <Text style={{ fontSize: 13, color: colors.text.secondary, marginTop: 4 }} numberOfLines={1}>
                          {folder.description}
                        </Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 20, color: colors.text.muted }}>›</Text>
                  </View>
                </TouchableOpacity>
              </AnimatedListItem>
            ))}
          </View>
        )}

        {/* Unlinked Routines Section */}
        {unlinkedRoutines.length > 0 && (
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 }}>
              Sin carpeta
            </Text>
            {unlinkedRoutines.map((routine, index) => (
              <AnimatedListItem key={routine.id} index={index} delay={100}>
                <TouchableOpacity
                  onPress={() => router.push(`/routine/${routine.id}`)}
                  style={{ marginBottom: spacing.sm }}
                >
                  <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text.primary }}>{routine.name}</Text>
                      {routine.description && (
                        <Text style={{ fontSize: 14, color: colors.text.secondary, marginTop: 4 }}>{routine.description}</Text>
                      )}
                    </View>
                    <Text style={{ fontSize: 20, color: colors.text.muted }}>›</Text>
                  </View>
                </TouchableOpacity>
              </AnimatedListItem>
            ))}
          </View>
        )}

        {/* Empty State */}
        {(!folders || folders.length === 0) && unlinkedRoutines.length === 0 && (
          <EmptyState
            title="Sin rutinas"
            message="Creá una carpeta para organizar tus rutinas, o creá una rutina directamente."
          />
        )}
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={{ padding: spacing.md, paddingTop: spacing.sm, backgroundColor: colors.bg.card, borderTopWidth: 1, borderTopColor: colors.border.primary, flexDirection: 'row', gap: spacing.sm }}>
        <TouchableOpacity
          onPress={() => setShowCreateModal(true)}
          style={{ flex: 1, paddingVertical: 14, borderRadius: borderRadius.md, backgroundColor: colors.accent.primary, alignItems: 'center' }}
        >
          <Text style={{ color: colors.bg.primary, fontWeight: '600', fontSize: 14 }}>+ Carpeta</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/routine/create')}
          style={{ flex: 1, paddingVertical: 14, borderRadius: borderRadius.md, backgroundColor: colors.bg.elevated, alignItems: 'center', borderWidth: 1, borderColor: colors.border.light }}
        >
          <Text style={{ color: colors.text.primary, fontWeight: '600', fontSize: 14 }}>+ Rutina</Text>
        </TouchableOpacity>
      </View>

      {/* Create Folder Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.bg.card, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: colors.text.primary, marginBottom: 20 }}>Nueva Carpeta</Text>

            <Text style={{ color: colors.text.secondary, marginBottom: 8 }}>Nombre</Text>
            <TextInput
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Ej: Fútbol, Triatlón, Fuerza..."
              placeholderTextColor={colors.text.muted}
              style={{ backgroundColor: colors.border.primary, borderRadius: borderRadius.md, padding: spacing.md, color: colors.text.primary, marginBottom: spacing.md }}
            />

            <Text style={{ color: colors.text.secondary, marginBottom: 8 }}>Descripción (opcional)</Text>
            <TextInput
              value={newFolderDescription}
              onChangeText={setNewFolderDescription}
              placeholder="Descripción de la carpeta"
              placeholderTextColor={colors.text.muted}
              style={{ backgroundColor: colors.border.primary, borderRadius: borderRadius.md, padding: spacing.md, color: colors.text.primary, marginBottom: spacing.md }}
            />

            <Text style={{ color: colors.text.secondary, marginBottom: 8 }}>Color</Text>
            <View style={{ flexDirection: 'row', marginBottom: 20, flexWrap: 'wrap', gap: spacing.sm }}>
              {FOLDER_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => setNewFolderColor(color)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: color,
                    borderWidth: newFolderColor === color ? 3 : 0,
                    borderColor: colors.text.primary,
                  }}
                />
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                style={{ flex: 1, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.bg.elevated, alignItems: 'center' }}
              >
                <Text style={{ color: colors.text.secondary, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateFolder}
                style={{ flex: 1, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.accent.primary, alignItems: 'center' }}
              >
                <Text style={{ color: colors.bg.primary, fontWeight: '600' }}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
