import { Text, View, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts, fontSizes, borderWidths } from '../../../lib/theme/tokens';
import { useFolder, useRoutinesByFolder, useDeleteFolder, useUpdateFolder, useUpdateRoutine, useDeleteRoutine } from '../../../lib/hooks/useRoutines';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../components/ui/EmptyState';
import { AnimatedListItem } from '../../../components/ui/AnimatedListItem';
import { haptics } from '../../../lib/utils/haptics';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../../../lib/hooks/useConfirmDialog';

export default function FolderDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const folderId = Number(id);

  // Guard against NaN from malformed route params
  if (isNaN(folderId)) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.text.primary, fontSize: fontSizes.lg }}>{t('common.invalidId')}</Text>
      </View>
    );
  }

  const { data: folders, isLoading: loadingFolder } = useFolder(folderId);
  const { data: routines, isLoading: loadingRoutines } = useRoutinesByFolder(folderId);
  const deleteRoutine = useDeleteRoutine();
  const deleteFolder = useDeleteFolder();
  const updateFolder = useUpdateFolder();
  const updateRoutine = useUpdateRoutine();
  const { dialog, showAlert, showConfirm } = useConfirmDialog();

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
      showAlert(t('common.error'), t('routine.folder.saveFailed'));
    }
  };

  const handleDeleteFolder = () => {
    showConfirm(
      t('routine.folder.deleteFolderTitle'),
      t('routine.folder.deleteFolderMessage', { name: folder?.name }),
      async () => {
        try {
          await haptics.warning();
          await deleteFolder.mutateAsync(folderId);
          router.back();
        } catch {
          await haptics.error();
        }
      },
      { confirmLabel: t('common.delete'), destructive: true }
    );
  };

  const handleDeleteRoutine = (routineId: number, routineName: string) => {
    showConfirm(
      t('routine.folder.deleteRoutineTitle'),
      t('routine.folder.deleteRoutineMessage', { name: routineName }),
      async () => {
        try {
          await haptics.warning();
          await deleteRoutine.mutateAsync(routineId);
        } catch {
          await haptics.error();
        }
      },
      { confirmLabel: t('common.delete'), destructive: true }
    );
  };

  const handleUnlinkRoutine = (routineId: number, routineName: string) => {
    showConfirm(
      t('routine.folder.unlinkTitle'),
      t('routine.folder.unlinkMessage', { name: routineName }),
      async () => {
        try {
          await haptics.press();
          await updateRoutine.mutateAsync({
            id: routineId,
            data: { folderId: null },
          });
        } catch {
          await haptics.error();
        }
      },
      { confirmLabel: t('routine.folder.remove') }
    );
  };

  if (loadingFolder || loadingRoutines) {
    return <LoadingSpinner message={t('routine.folder.loading')} />;
  }

  if (!folder) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.text.primary, fontSize: fontSizes.lg }}>{t('routine.folder.notFound')}</Text>
      </View>
    );
  }

  return (
    <>
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.bg.card, paddingTop: insets.top + spacing.sm + spacing.xs, paddingBottom: spacing.sm + spacing.xs, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border.primary }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: spacing.sm + spacing.xs }}>
            <Text style={{ fontSize: fontSizes.xl, color: colors.accent.primary }}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>{folder.name}</Text>
            </View>
            {folder.description && (
              <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.body, color: colors.text.secondary, marginTop: spacing.xs }}>{folder.description}</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity onPress={handleEditFolder} style={{ padding: spacing.sm, marginRight: spacing.xs }}>
              <Text style={{ fontSize: fontSizes.sm, color: colors.text.link, fontFamily: fonts.bodyMedium }}>{t('common.edit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeleteFolder} style={{ padding: spacing.sm }}>
              <Text style={{ fontSize: fontSizes.sm, color: colors.error, fontFamily: fonts.bodyMedium }}>{t('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Routine List */}
      <ScrollView style={{ flex: 1, padding: spacing.md }}>
        {!routines || routines.length === 0 ? (
          <EmptyState
            title={t('routine.folder.emptyTitle')}
            message={t('routine.folder.emptyMessage')}
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
                    <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>{routine.name}</Text>
                    {routine.description && (
                      <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.body, color: colors.text.secondary, marginTop: spacing.xs }}>{routine.description}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleUnlinkRoutine(routine.id, routine.name)}
                    style={{ padding: spacing.sm }}
                  >
                    <Text style={{ fontSize: fontSizes.lg, color: colors.text.muted }}>✕</Text>
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
          <Text style={{ color: colors.bg.primary, fontFamily: fonts.bodySemiBold, fontSize: fontSizes.md }}>+ {t('routine.folder.newRoutine')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/routine/create')}
          style={{ flex: 1, paddingVertical: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.border.primary, alignItems: 'center', borderWidth: borderWidths.thin, borderColor: colors.border.light }}
        >
          <Text style={{ color: colors.text.primary, fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm }}>{t('routine.folder.noFolder')}</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Modal */}
      <Modal accessible={true} visible={showEditModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: colors.overlay.default, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.bg.card, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg }}>
            <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md + spacing.xs }}>{t('routine.folder.editTitle')}</Text>

            <Text style={{ color: colors.text.secondary, fontFamily: fonts.bodyMedium, marginBottom: spacing.sm }}>{t('routine.folder.name')}</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder={t('routine.folder.namePlaceholder')}
              placeholderTextColor={colors.text.muted}
              style={{ backgroundColor: colors.border.primary, borderRadius: borderRadius.md, padding: spacing.md, color: colors.text.primary, marginBottom: spacing.md }}
            />

            <Text style={{ color: colors.text.secondary, fontFamily: fonts.bodyMedium, marginBottom: spacing.sm }}>{t('routine.folder.descriptionOptional')}</Text>
            <TextInput
              value={editDescription}
              onChangeText={setEditDescription}
              placeholder={t('routine.folder.descriptionPlaceholder')}
              placeholderTextColor={colors.text.muted}
              style={{ backgroundColor: colors.border.primary, borderRadius: borderRadius.md, padding: spacing.md, color: colors.text.primary, marginBottom: spacing.md }}
            />

            <Text style={{ color: colors.text.secondary, fontFamily: fonts.bodyMedium, marginBottom: spacing.sm }}>{t('routine.folder.color')}</Text>
            <View style={{ flexDirection: 'row', marginBottom: spacing.md + spacing.xs, flexWrap: 'wrap', gap: spacing.sm }}>
              {colors.folders.map((color) => (
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
                <Text style={{ color: colors.text.secondary, fontFamily: fonts.bodySemiBold }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEdit}
                style={{ flex: 1, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.accent.primary, alignItems: 'center' }}
              >
                <Text style={{ color: colors.bg.primary, fontFamily: fonts.bodySemiBold }}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
