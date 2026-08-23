import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, borderRadius, fonts, fontSizes } from '../../lib/theme/tokens';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Completá todos los campos');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.replace('/(tabs)');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.emberDot} />
          <Text style={styles.brandName}>FORJA</Text>
        </View>
        <Text style={styles.title}>Tus registros te esperan</Text>
        <Text style={styles.subtitle}>Iniciá sesión para seguir forjando</Text>
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

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? 'Iniciando...' : 'Iniciar sesión'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => router.push('/auth/signup')}
        >
          <Text style={styles.linkText}>
            ¿Sin cuenta? <Text style={styles.linkBold}>Crear cuenta</Text>
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