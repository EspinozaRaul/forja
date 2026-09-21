import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { useTranslation } from 'react-i18next';
import { Screen } from '../components/ui/Screen';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { supabase } from '../lib/supabase';
import { extractResetTokens } from '../lib/auth/reset-link';
import { AUTH_CONFIG } from '../lib/constants/config';
import { useConfirmDialog } from '../lib/hooks/useConfirmDialog';
import { colors, spacing, borderRadius, fonts, fontSizes, borderWidths } from '../lib/theme/tokens';

const MIN_PASSWORD_LENGTH = AUTH_CONFIG.MIN_PASSWORD_LENGTH;

/**
 * `applying` — the recovery session from the link is being set.
 * `ready`    — the session is live and the new-password form can be submitted.
 * `unusable` — the link carried no usable pair, or Supabase rejected it.
 */
type Phase = 'applying' | 'ready' | 'unusable';
type UnusableReason = 'missing' | 'invalid';

/**
 * Target of the recovery email's `redirectTo` (`forja://reset-password`).
 *
 * This route lives OUTSIDE the `auth` segment group on purpose: the link must
 * stay exactly as it is allowlisted in the Supabase dashboard, so the root
 * layout's auth gate is what exempts it instead (see `app/_layout.tsx`).
 */
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { dialog, showAlert } = useConfirmDialog();

  // `useLinkingURL` covers both entry points with one value: it starts from the
  // URL that launched the app (cold start from the email link) and then follows
  // every `url` event (app already running). It is the only source that still
  // carries the fragment, which expo-router drops while resolving the route.
  const linkingUrl = Linking.useLinkingURL();
  const tokens = useMemo(() => extractResetTokens(linkingUrl), [linkingUrl]);

  const [phase, setPhase] = useState<Phase>('applying');
  const [unusableReason, setUnusableReason] = useState<UnusableReason>('missing');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tokens) {
      setUnusableReason('missing');
      setPhase('unusable');
      return;
    }

    let cancelled = false;
    setPhase('applying');

    // The recovery link carries its own session: setting it is what makes
    // `updateUser` authorized. An expired or already-consumed token fails here.
    supabase.auth
      .setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken })
      .then(({ error }) => {
        if (cancelled) return;
        if (error) {
          setUnusableReason('invalid');
          setPhase('unusable');
        } else {
          setPhase('ready');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tokens]);

  const goToLogin = () => router.replace('/auth/login');

  const handleSubmit = async () => {
    if (!newPassword || !confirmPassword) {
      showAlert(t('common.error'), t('auth.resetPassword.error.emptyFields'));
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert(t('common.error'), t('auth.resetPassword.error.passwordMismatch'));
      return;
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      showAlert(
        t('common.error'),
        t('auth.resetPassword.error.passwordTooShort', { min: MIN_PASSWORD_LENGTH })
      );
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);

    if (error) {
      showAlert(t('common.error'), t('auth.resetPassword.error.updateFailed'));
    } else {
      showAlert(t('common.success'), t('auth.resetPassword.success'));
      // The recovery session is a real session, so the user lands in the app
      // already signed in.
      router.replace('/(tabs)');
    }
  };

  return (
    <>
      <Screen topExtra={spacing.xxl}>
        <ScreenHeader
          title={t('auth.resetPassword.title')}
          icon="lock-closed"
          onBack={goToLogin}
          divider
        />

        {phase === 'applying' && (
          <View style={styles.centered}>
            <Text style={styles.centeredText}>{t('auth.resetPassword.applying')}</Text>
          </View>
        )}

        {phase === 'ready' && (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.heading}>{t('auth.resetPassword.heading')}</Text>
            <Text style={styles.subtitle}>{t('auth.resetPassword.subtitle')}</Text>

            <View style={styles.form}>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput, { tintColor: colors.accent.primary } as any]}
                  placeholder={t('auth.resetPassword.newPassword')}
                  placeholderTextColor={colors.text.muted}
                  accessibilityLabel={t('auth.resetPassword.newPassword')}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((previous) => !previous)}
                  style={styles.toggleButton}
                  hitSlop={{ top: 8, bottom: 8, left: 0, right: 8 }}
                  accessibilityLabel={
                    showPassword
                      ? t('accessibility.common.hidePassword')
                      : t('accessibility.common.showPassword')
                  }
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color={colors.text.muted}
                  />
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.input, { tintColor: colors.accent.primary } as any]}
                placeholder={t('auth.resetPassword.confirmPassword')}
                placeholderTextColor={colors.text.muted}
                accessibilityLabel={t('auth.resetPassword.confirmPassword')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
              />

              <Button
                title={t('auth.resetPassword.submit')}
                variant="primary"
                onPress={handleSubmit}
                loading={saving}
                disabled={saving}
                style={styles.submitButton}
              />
            </View>
          </ScrollView>
        )}

        {phase === 'unusable' &&
          (unusableReason === 'invalid' ? (
            <EmptyState
              icon="alert-circle-outline"
              title={t('auth.resetPassword.invalidLink.title')}
              message={t('auth.resetPassword.invalidLink.message')}
              action={<Button title={t('auth.resetPassword.backToLogin')} variant="secondary" onPress={goToLogin} />}
            />
          ) : (
            <EmptyState
              icon="link-outline"
              title={t('auth.resetPassword.missingLink.title')}
              message={t('auth.resetPassword.missingLink.message')}
              action={<Button title={t('auth.resetPassword.backToLogin')} variant="secondary" onPress={goToLogin} />}
            />
          ))}
      </Screen>

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

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centeredText: {
    fontSize: fontSizes.md,
    fontFamily: fonts.body,
    color: colors.text.secondary,
  },
  heading: {
    fontSize: fontSizes.xl,
    fontFamily: fonts.bodySemiBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSizes.md,
    fontFamily: fonts.body,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
  },
  form: {
    gap: spacing.md,
  },
  input: {
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSizes.md,
    fontFamily: fonts.body,
    color: colors.text.primary,
    borderWidth: borderWidths.thin,
    borderColor: colors.border.primary,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    borderWidth: borderWidths.thin,
    borderColor: colors.border.primary,
  },
  passwordInput: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  toggleButton: {
    position: 'absolute',
    right: spacing.md,
    padding: spacing.xs,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
});
