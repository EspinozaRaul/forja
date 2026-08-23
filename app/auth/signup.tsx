import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, borderRadius, fonts, fontSizes } from '../../lib/theme/tokens';
import { supabase } from '../../lib/supabase';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Completá todos los campos');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Éxito', 'Cuenta creada! Verificá tu email para confirmar.');
      router.replace('/auth/login');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.emberDot} />
          <Text style={styles.brandName}>FORJA</Text>
        </View>
        <Text style={styles.title}>Empezá a forjar</Text>
        <Text style={styles.subtitle}>Creá tu cuenta y registrá tu primer entrenamiento</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.text.muted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor={colors.text.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
          />
          <TouchableOpacity
            onPress={() => setShowPassword((p) => !p)}
            style={styles.toggleButton}
          >
            <Text style={styles.toggleText}>{showPassword ? 'Ocultar' : 'Ver'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.input}
            placeholder="Confirmar contraseña"
            placeholderTextColor={colors.text.muted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
          />
          <TouchableOpacity
            onPress={() => setShowConfirmPassword((p) => !p)}
            style={styles.toggleButton}
          >
            <Text style={styles.toggleText}>{showConfirmPassword ? 'Ocultar' : 'Ver'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignup}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push('/auth/login')}
        >
          <Text style={styles.linkText}>
            ¿Ya tenés cuenta? <Text style={styles.linkBold}>Iniciar sesión</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
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
    padding: spacing.md,
    fontSize: 16,
    color: colors.text.primary,
    borderWidth: 1,
    borderColor: colors.border.primary,
    flex: 1,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border.primary,
  },
  toggleButton: {
    position: 'absolute',
    right: spacing.md,
    padding: spacing.xs,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.muted,
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