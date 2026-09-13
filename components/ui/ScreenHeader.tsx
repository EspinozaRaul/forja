import { View, Text, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps, type ReactNode } from 'react';
import { colors, spacing, fonts, fontSizes, borderWidths } from '../../lib/theme/tokens';

interface ScreenHeaderProps {
  title: string;
  /** Ionicons name for the accent-colored icon after the back arrow. */
  icon?: ComponentProps<typeof Ionicons>['name'];
  /** Renders the back arrow and wires it up. Omit for a header with no back. */
  onBack?: () => void;
  /** Right-side slot (e.g. measurements' add toggle). */
  right?: ReactNode;
  /** Divider under the header. Use ONLY on screens whose header stays fixed while content scrolls. */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shared progress-screen header. Every progress screen uses this so the user
 * orients identically: optional back arrow, optional accent icon, then the title.
 *
 * The header itself owns no top spacing — screens provide the standard vertical
 * rhythm through `<Screen topExtra={spacing.xxl} />`. The divider is opt-in and
 * reserved for headers that stay FIXED while content scrolls; headers that live
 * inside a ScrollView (statistics, measurements) deliberately omit it so nothing
 * scrolls away from a hard edge.
 */
export function ScreenHeader({ title, icon, onBack, right, divider, style }: ScreenHeaderProps) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
        },
        divider && {
          borderBottomWidth: borderWidths.thin,
          borderBottomColor: colors.border.divider,
        },
        style,
      ]}
    >
      <View
        style={{
          flexShrink: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
        }}
      >
        {onBack && (
          <Pressable onPress={onBack} hitSlop={8}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </Pressable>
        )}
        {icon && <Ionicons name={icon} size={24} color={colors.accent.primary} />}
        <Text
          numberOfLines={1}
          style={{
            flexShrink: 1,
            fontSize: fontSizes.xl,
            fontFamily: fonts.bodySemiBold,
            color: colors.text.primary,
          }}
        >
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}
