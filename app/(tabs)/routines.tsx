import { Text, View, ScrollView, TouchableOpacity, Modal, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFolders, useRoutines, useCreateFolder, useDeleteFolder, useUpdateRoutine } from '../../lib/hooks/useRoutines';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { AnimatedListItem } from '../../components/ui/AnimatedListItem';
import { Button } from '../../components/ui/Button';
import { haptics } from '../../lib/utils/haptics';
import { colors, spacing, borderRadius, fonts, fontSizes, borderWidths } from '../../lib/theme/tokens';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../../lib/hooks/useConfirmDialog';

export default function RoutinesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: folders, isLoading: loadingFolders } = useFolders();
  const { data: routines, isLoading: loadingRoutines } = useRoutines();
  const createFolder = useCreateFolder();
  const deleteFolder = useDeleteFolder();
  const updateRoutine = useUpdateRoutine();
  const { dialog, showAlert, showConfirm } = useConfirmDialog();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(colors.accent.primary);
  const [movingRoutineId, setMovingRoutineId] = useState<number | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);

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
      setNewFolderColor(colors.accent.primary);
    } catch {
      await haptics.error();
      showAlert(t('common.error'), t('tabs.routines.folderCreateError'));
    }
  };

  const handleDeleteFolder = (folderId: number, folderName: string) => {
    showConfirm(
      t('tabs.routines.deleteFolderTitle'),
      t('tabs.routines.deleteFolderMessage', { name: folderName }),
      async () => {
        try {
          await haptics.warning();
          await deleteFolder.mutateAsync(folderId);
        } catch {
          await haptics.error();
          showAlert(t('common.error'), t('tabs.routines.deleteFolderError'));
        }
      },
      { confirmLabel: t('common.delete'), destructive: true }
    );
  };

  const handleMoveToFolder = (routineId: number) => {
    setMovingRoutineId(routineId);
    setShowMoveModal(true);
  };

  const handleSelectFolder = async (folderId: number | null) => {
    if (movingRoutineId == null) return;
    try {
      await haptics.press();
      await updateRoutine.mutateAsync({
        id: movingRoutineId,
        data: { folderId: folderId ?? undefined },
      });
      setShowMoveModal(false);
      setMovingRoutineId(null);
    } catch {
      await haptics.error();
      showAlert(t('common.error'), t('tabs.routines.moveError'));
    }
  };

  // Routines without a folder
  const unlinkedRoutines = routines?.filter((r) => !r.folderId) ?? [];

  if (isLoading) {
    return <LoadingSpinner message={t('tabs.routines.loading')} />;
  }

  return (
    <>
    <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      {/* Header */}
      <View style={{ backgroundColor: colors.bg.card, padding: spacing.md + spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border.primary }}>
        <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>{t('tabs.routines.title')}</Text>
      </View>

      <ScrollView style={{ flex: 1, padding: spacing.md }}>
        {/* Folders Section */}
        {folders && folders.length > 0 && (
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodyMedium, color: colors.text.secondary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 }}>
              {t('tabs.routines.folders')}
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
                    padding: spacing.md + spacing.xs,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderLeftWidth: 4,
                    borderLeftColor: folder.color || colors.accent.primary,
                  }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>{folder.name}</Text>
                      {folder.description && (
                        <Text style={{ fontSize: fontSizes.sm, fontFamily: fonts.body, color: colors.text.secondary, marginTop: spacing.xs }} numberOfLines={1}>
                          {folder.description}
                        </Text>
                      )}
                    </View>
                    <Text style={{ fontSize: fontSizes.xl, color: colors.text.muted }}>›</Text>
                  </View>
                </TouchableOpacity>
              </AnimatedListItem>
            ))}
          </View>
        )}

        {/* Unlinked Routines Section */}
        {unlinkedRoutines.length > 0 && (
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodyMedium, color: colors.text.secondary, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 }}>
              {t('tabs.routines.noFolder')}
            </Text>
            {unlinkedRoutines.map((routine, index) => (
              <AnimatedListItem key={routine.id} index={index} delay={100}>
                <TouchableOpacity
                  onPress={() => router.push(`/routine/${routine.id}`)}
                  onLongPress={() => handleMoveToFolder(routine.id)}
                  style={{ marginBottom: spacing.sm }}
                >
                  <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, padding: spacing.md + spacing.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>{routine.name}</Text>
                      {routine.description && (
                        <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.body, color: colors.text.secondary, marginTop: spacing.xs }}>{routine.description}</Text>
                      )}
                    </View>
                    <Text style={{ fontSize: fontSizes.xl, color: colors.text.muted }}>›</Text>
                  </View>
                </TouchableOpacity>
              </AnimatedListItem>
            ))}
          </View>
        )}

        {/* Empty State */}
        {(!folders || folders.length === 0) && unlinkedRoutines.length === 0 && (
          <EmptyState
            title={t('tabs.routines.emptyTitle')}
            message={t('tabs.routines.emptyMessage')}
          />
        )}
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={{ padding: spacing.md, paddingTop: spacing.sm, backgroundColor: colors.bg.card, borderTopWidth: 1, borderTopColor: colors.border.primary, flexDirection: 'row', gap: spacing.sm }}>
        <Button
          title={`+ ${t('tabs.routines.newFolder')}`}
          onPress={() => setShowCreateModal(true)}
          variant="primary"
          compact
          style={{ flex: 1 }}
        />
        <Button
          title={`+ ${t('tabs.routines.newRoutine')}`}
          onPress={() => router.push('/routine/create')}
          variant="secondary"
          compact
          style={{ flex: 1 }}
        />
      </View>

      {/* Create Folder Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: colors.overlay.default, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.bg.card, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg }}>
            <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md + spacing.xs }}>{t('tabs.routines.newFolderTitle')}</Text>

            <Text style={{ color: colors.text.secondary, fontFamily: fonts.bodyMedium, marginBottom: spacing.sm }}>{t('tabs.routines.name')}</Text>
            <TextInput
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder={t('tabs.routines.namePlaceholder')}
              placeholderTextColor={colors.text.muted}
              style={{ backgroundColor: colors.border.primary, borderRadius: borderRadius.md, padding: spacing.md, color: colors.text.primary, marginBottom: spacing.md }}
            />

            <Text style={{ color: colors.text.secondary, fontFamily: fonts.bodyMedium, marginBottom: spacing.sm }}>{t('tabs.routines.descriptionOptional')}</Text>
            <TextInput
              value={newFolderDescription}
              onChangeText={setNewFolderDescription}
              placeholder={t('tabs.routines.descriptionPlaceholder')}
              placeholderTextColor={colors.text.muted}
              style={{ backgroundColor: colors.border.primary, borderRadius: borderRadius.md, padding: spacing.md, color: colors.text.primary, marginBottom: spacing.md }}
            />

            <Text style={{ color: colors.text.secondary, fontFamily: fonts.bodyMedium, marginBottom: spacing.sm }}>{t('tabs.routines.color')}</Text>
            <View style={{ flexDirection: 'row', marginBottom: spacing.md + spacing.xs, flexWrap: 'wrap', gap: spacing.sm }}>
              {colors.folders.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => setNewFolderColor(color)}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: borderRadius.full,
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
                <Text style={{ color: colors.text.secondary, fontFamily: fonts.bodySemiBold }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateFolder}
                style={{ flex: 1, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.accent.primary, alignItems: 'center' }}
              >
                <Text style={{ color: colors.bg.primary, fontFamily: fonts.bodySemiBold }}>{t('tabs.routines.create')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Move to Folder Modal */}
      <Modal visible={showMoveModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: colors.overlay.default, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.bg.card, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg }}>
            <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.primary, marginBottom: spacing.md + spacing.xs }}>{t('tabs.routines.moveToFolder')}</Text>

            {folders && folders.length > 0 && (
              <View style={{ marginBottom: spacing.md }}>
                <Text style={{ color: colors.text.secondary, fontFamily: fonts.bodyMedium, marginBottom: spacing.sm }}>{t('tabs.routines.selectFolder')}</Text>
                {folders.map((folder) => (
                  <TouchableOpacity
                    key={folder.id}
                    onPress={() => handleSelectFolder(folder.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      padding: spacing.md,
                      backgroundColor: colors.bg.elevated,
                      borderRadius: borderRadius.sm,
                      marginBottom: spacing.xs,
                      borderLeftWidth: 3,
                      borderLeftColor: folder.color || colors.accent.primary,
                    }}
                  >
                    <Text style={{ flex: 1, fontSize: fontSizes.md, color: colors.text.primary }}>{folder.name}</Text>
                    <Text style={{ fontSize: fontSizes.md, color: colors.text.muted }}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TouchableOpacity
                onPress={() => { setShowMoveModal(false); setMovingRoutineId(null); }}
                style={{ flex: 1, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.bg.elevated, alignItems: 'center' }}
              >
                <Text style={{ color: colors.text.secondary, fontFamily: fonts.bodySemiBold }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleSelectFolder(null)}
                style={{ flex: 1, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.bg.elevated, alignItems: 'center', borderWidth: borderWidths.thin, borderColor: colors.border.light }}
              >
                <Text style={{ color: colors.text.primary, fontFamily: fonts.bodySemiBold }}>{t('tabs.routines.noFolder')}</Text>
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
