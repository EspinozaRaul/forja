import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fonts, fontSizes } from '../../lib/theme/tokens';
import { supabase } from '../../lib/supabase';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../../lib/hooks/useConfirmDialog';

export default function LoginScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { dialog, showAlert } = useConfirmDialog();

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert(t('common.error'), t('auth.login.error.emptyFields'));
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showAlert(t('common.error'), t('auth.login.error.invalidEmail'));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      showAlert(t('common.error'), error.message);
    } else {
      router.replace('/(tabs)');
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
        <Text style={styles.title}>{t('auth.login.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          // @ts-ignore — tintColor works at runtime but isn't in RN types yet
          style={[styles.input, { tintColor: colors.accent.primary }]}
          placeholder={t('auth.login.email')}
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
            placeholder={t('auth.login.password')}
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

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? t('auth.login.loading') : t('auth.login.submit')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push('/auth/signup')}
        >
          <Text style={styles.linkText}>
            {t('auth.login.noAccount')} <Text style={styles.linkBold}>{t('auth.login.signUp')}</Text>
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
    marginBottom: 40,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  emberDot: {
    width: 10,
    height: 10,
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
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
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
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
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
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  linkText: {
    color: colors.text.secondary,
    fontSize: 14,
  },
  linkBold: {
    color: colors.accent.primary,
    fontWeight: '600',
  },
});