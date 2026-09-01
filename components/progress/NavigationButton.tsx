import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius, fonts, fontSizes } from '../../lib/theme/tokens';

interface NavigationButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  onPress: () => void;
}

export function NavigationButton({ icon, label, description, onPress }: NavigationButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.bg.card,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border.primary,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: borderRadius.md,
          backgroundColor: colors.accent.muted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={20} color={colors.accent.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.bodySemiBold, color: colors.text.primary }}>
          {label}
        </Text>
        <Text style={{ fontSize: fontSizes.xs, fontFamily: fonts.body, color: colors.text.muted, marginTop: 2 }}>
          {description}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.text.muted} />
    </Pressable>
  );
}