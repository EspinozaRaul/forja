import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts, fontSizes, borderWidths} from '../../lib/theme/tokens';
import { EMBER_DOT } from '../../lib/constants/layout';
import { AUTH_CONFIG } from '../../lib/constants/config';
import { supabase } from '../../lib/supabase';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../../lib/hooks/useConfirmDialog';

const MIN_PASSWORD_LENGTH = AUTH_CONFIG.MIN_PASSWORD_LENGTH;

export default function SignupScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { dialog, showAlert } = useConfirmDialog();

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      showAlert(t('common.error'), t('auth.signup.error.emptyFields'));
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert(t('common.error'), t('auth.signup.error.invalidEmail'));
      return;
    }

    if (password !== confirmPassword) {
      showAlert(t('common.error'), t('auth.signup.error.passwordMismatch'));
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      showAlert(t('common.error'), t('auth.signup.error.passwordTooShort'));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      showAlert(t('common.error'), error.message);
    } else {
      showAlert(t('common.success'), t('auth.signup.success.created'));
      router.replace('/auth/login');
    }
  };

  return (
    <>
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.emberDot} />
          <Text style={styles.brandName}>FORJA</Text>
        </View>
        <Text style={styles.title}>{t('auth.signup.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.signup.subtitle')}</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          // @ts-ignore — tintColor works at runtime but isn't in RN types yet
          style={[styles.input, { tintColor: colors.accent.primary }]}
          placeholder={t('auth.signup.email')}
          placeholderTextColor={colors.text.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <View style={styles.passwordContainer}>
          <TextInput
            // @ts-ignore — tintColor works at runtime but isn't in RN types yet
            style={[styles.input, styles.passwordInput, { tintColor: colors.accent.primary }]}
            placeholder={t('auth.signup.password')}
            placeholderTextColor={colors.text.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPassword((p) => !p)}
            style={styles.toggleButton}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color={colors.text.muted}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.passwordContainer}>
          <TextInput
            // @ts-ignore — tintColor works at runtime but isn't in RN types yet
            style={[styles.input, styles.passwordInput, { tintColor: colors.accent.primary }]}
            placeholder={t('auth.signup.confirmPassword')}
            placeholderTextColor={colors.text.muted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
          />
          <TouchableOpacity
            onPress={() => setShowConfirmPassword((p) => !p)}
            style={styles.toggleButton}
          >
            <Ionicons
              name={showConfirmPassword ? 'eye-off' : 'eye'}
              size={20}
              color={colors.text.muted}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignup}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? t('auth.signup.loading') : t('auth.signup.submit')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push('/auth/login')}
        >
          <Text style={styles.linkText}>
            {t('auth.signup.hasAccount')} <Text style={styles.linkBold}>{t('auth.signup.signIn')}</Text>
          </Text>
        </TouchableOpacity>
      </View>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.primary,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  emberDot: {
    width: EMBER_DOT.SIZE,
    height: EMBER_DOT.SIZE,
    borderRadius: borderRadius.full,
    backgroundColor: colors.ember.primary,
  },
  brandName: {
    fontSize: fontSizes.xl,
    fontFamily: fonts.display,
    color: colors.text.primary,
    letterSpacing: 2,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontFamily: fonts.bodySemiBold,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSizes.md,
    color: colors.text.secondary,
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
  button: {
    backgroundColor: colors.accent.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.bg.primary,
    fontSize: fontSizes.md,
    fontFamily: fonts.bodySemiBold,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  linkText: {
    color: colors.text.secondary,
    fontSize: fontSizes.md,
  },
  linkBold: {
    color: colors.accent.primary,
    fontFamily: fonts.bodySemiBold,
  },
});