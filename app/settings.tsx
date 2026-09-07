import { Text, View, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '../lib/i18n';
import { colors, spacing, borderRadius, fonts, fontSizes, borderWidths } from '../lib/theme/tokens';
import { useSettings, type WeightUnit, type AppLanguage } from '../lib/utils/settings';
import { useAuth } from '../lib/hooks/useAuth';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { haptics } from '../lib/utils/haptics';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../lib/hooks/useConfirmDialog';

function SectionHeader({ title }: { title: string }) {
  return (
    <Text
      style={{
        fontSize: fontSizes.sm, fontFamily: fonts.bodySemiBold,
        color: colors.text.secondary,
        textTransform: 'uppercase',
        marginBottom: spacing.sm,
        marginTop: spacing.lg,
        marginHorizontal: spacing.md,
      }}
    >
      {title}
    </Text>
  );
}

function Row({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.border.divider,
      }}
    >
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: settings, isLoading, update } = useSettings();
  const { user, signOut } = useAuth();
  const { dialog, showAlert, showConfirm } = useConfirmDialog();

  if (isLoading) {
    return <LoadingSpinner message={t('common.loading')} />;
  }

  const handleLanguageChange = async (lang: AppLanguage) => {
    if (lang === settings.language) return;
    await haptics.select();
    i18n.changeLanguage(lang);
    await update({ language: lang });
  };

  const handleUnitChange = async (unit: WeightUnit) => {
    if (unit === settings.weightUnit) return;
    await haptics.select();
    await update({ weightUnit: unit });
  };

  const handleToggle = async (patch: Partial<{ hapticsEnabled: boolean; soundEnabled: boolean }>) => {
    await haptics.select();
    await update(patch);
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      await haptics.error();
      showAlert(t('common.error'), t('settings.signOutFailed'));
      return;
    }
    router.replace('/auth/login');
  };

  const handleDeleteAccount = async () => {
    const { deleteAccount } = useAuth();
    const { error } = await deleteAccount();
    if (error) {
      await haptics.error();
      showAlert(t('common.error'), t('settings.deleteAccountFailed'));
      return;
    }
    router.replace('/auth/login');
  };

  return (
    <>
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg.primary }} contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <SectionHeader title={t('settings.title')} />
      <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, marginHorizontal: spacing.md, borderWidth: borderWidths.thin, borderColor: colors.border.primary }}>
        <Row first>
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>{t('settings.language')}</Text>
          </View>
          <View style={{ flexDirection: 'row', backgroundColor: colors.bg.elevated, borderRadius: borderRadius.md, borderWidth: borderWidths.thin, borderColor: colors.border.primary, overflow: 'hidden' }}>
            {(['es', 'en'] as const).map((lang) => {
              const active = settings.language === lang;
              return (
                <TouchableOpacity
                  key={lang}
                  onPress={() => handleLanguageChange(lang)}
                  style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: active ? colors.accent.primary : 'transparent' }}
                >
                  <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: active ? colors.bg.primary : colors.text.secondary }}>
                    {t(`settings.languageOptions.${lang}`)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Row>
        <Row>
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>{t('settings.weightUnit')}</Text>
            <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.muted, marginTop: spacing.xxs }}>{t('settings.weightUnitDefault')}</Text>
          </View>
          <View style={{ flexDirection: 'row', backgroundColor: colors.bg.elevated, borderRadius: borderRadius.md, borderWidth: borderWidths.thin, borderColor: colors.border.primary, overflow: 'hidden' }}>
            {(['kg', 'lbs'] as const).map((unit) => {
              const active = settings.weightUnit === unit;
              return (
                <TouchableOpacity
                  key={unit}
                  onPress={() => handleUnitChange(unit)}
                  style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: active ? colors.accent.primary : 'transparent' }}
                >
                  <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: active ? colors.bg.primary : colors.text.secondary }}>
                    {unit}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Row>
        <Row>
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>{t('settings.vibration')}</Text>
            <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.muted, marginTop: spacing.xxs }}>{t('settings.vibrationDescription')}</Text>
          </View>
          <Switch
            value={settings.hapticsEnabled}
            onValueChange={(value) => handleToggle({ hapticsEnabled: value })}
            trackColor={{ true: colors.accent.primary, false: colors.border.primary }}
            thumbColor={colors.text.primary}
          />
        </Row>
        <Row>
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>{t('settings.sound')}</Text>
            <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.muted, marginTop: spacing.xxs }}>{t('settings.soundDescription')}</Text>
          </View>
          <Switch
            value={settings.soundEnabled}
            onValueChange={(value) => handleToggle({ soundEnabled: value })}
            trackColor={{ true: colors.accent.primary, false: colors.border.primary }}
            thumbColor={colors.text.primary}
          />
        </Row>
      </View>

      <SectionHeader title={t('settings.account')} />
      <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, marginHorizontal: spacing.md, borderWidth: borderWidths.thin, borderColor: colors.border.primary }}>
        <Row first>
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>Email</Text>
          </View>
          <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.body, color: colors.text.secondary, flexShrink: 1 }} numberOfLines={1}>
            {user?.email ?? '—'}
          </Text>
        </Row>
        <Row>
          <TouchableOpacity onPress={() => showConfirm(
            t('settings.signOut'),
            t('settings.signOutConfirm'),
            handleSignOut,
            { confirmLabel: t('settings.signOut'), destructive: true }
          )} style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.xs }}>
            <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.error }}>{t('settings.signOut')}</Text>
          </TouchableOpacity>
        </Row>
      </View>

      <SectionHeader title={t('settings.dangerZone')} />
      <View style={{ backgroundColor: colors.bg.card, borderRadius: borderRadius.lg, marginHorizontal: spacing.md, borderWidth: borderWidths.thin, borderColor: colors.error }}>
        <Row first>
          <TouchableOpacity onPress={() => showConfirm(
            t('settings.deleteAccount'),
            t('settings.deleteAccountConfirm'),
            handleDeleteAccount,
            { confirmLabel: t('settings.deleteAccount'), destructive: true }
          )} style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.xs }}>
            <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.error }}>{t('settings.deleteAccount')}</Text>
            <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.muted, marginTop: spacing.xxs }}>{t('settings.deleteAccountDescription')}</Text>
          </TouchableOpacity>
        </Row>
      </View>
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