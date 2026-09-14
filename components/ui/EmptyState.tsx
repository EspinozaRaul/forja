import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type ReactNode } from 'react';
import { colors, spacing, fonts, fontSizes } from '../../lib/theme/tokens';

interface EmptyStateProps {
  /**
   * Either a rendered node, or an Ionicons glyph name. A bare string is accepted
   * on purpose: `ReactNode` includes strings, so passing a glyph name used to
   * compile and then crash at runtime with "Text strings must be rendered within
   * a <Text> component". Handling it here removes that trap for every caller.
   */
  icon?: ReactNode | keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  /**
   * Optional call to action rendered under the message (e.g. the Retry button
   * in `QueryState`). Kept here so a failed load and a genuinely empty list
   * stay visually identical instead of growing a second empty-screen design.
   */
  action?: ReactNode;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  const iconNode =
    typeof icon === 'string'
      ? <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={48} color={colors.text.muted} />
      : icon;
  return (
    <View 
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, backgroundColor: colors.bg.primary }} 
      className="flex-1 items-center justify-center py-12 px-6 bg-dark-bg"
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={`${title}${message ? `. ${message}` : ''}`}
    >
      {iconNode && <View style={{ marginBottom: spacing.md }} className="mb-4">{iconNode}</View>}
      <Text style={{ fontSize: fontSizes.lg, fontFamily: fonts.bodySemiBold, color: colors.text.secondary, marginBottom: spacing.sm }} className="text-lg font-semibold text-dark-text-secondary mb-2">{title}</Text>
      {message && (
        <Text style={{ fontSize: fontSizes.md, fontFamily: fonts.body, color: colors.text.muted, textAlign: 'center' }} className="text-sm text-dark-text-muted text-center">{message}</Text>
      )}
      {action && <View style={{ marginTop: spacing.lg }}>{action}</View>}
    </View>
  );
}
