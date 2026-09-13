import { View, type StyleProp, type ViewStyle } from 'react-native';
import { type ReactNode } from 'react';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '../../lib/theme/tokens';

interface ScreenProps {
  children: ReactNode;
  /** Device edges to keep clear. Default: ['top', 'bottom']. */
  edges?: Edge[];
  /** Breathing room ADDED below the top inset. Default: spacing.sm. */
  topExtra?: number;
  /** Breathing room ADDED above the bottom inset. Default: 0. */
  bottomExtra?: number;
  /** Defaults to colors.bg.primary. */
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shared screen container. Applies the device safe-area insets so every screen
 * inherits the standard by construction — in particular screens that render a
 * custom in-content header (with the native header hidden) cannot collide with
 * the status bar / Dynamic Island.
 *
 * The inset padding is applied AFTER `style` in the style array, so a caller
 * cannot accidentally override it. Route vertical breathing room through
 * `topExtra` / `bottomExtra` — NOT through `style.paddingTop` / `paddingBottom`
 * (those are ignored for the edges handled here).
 *
 * `topExtra` defaults to one small step (`spacing.sm`) so a new screen is born with
 * the standard breathing room instead of flush against the status bar.
 *
 * Screens that keep the NATIVE header (the tab screens) already get the top inset
 * from the header bar and the bottom one from the tab bar: pass `edges={[]}` there.
 */
export function Screen({
  children,
  edges = ['top', 'bottom'],
  topExtra = spacing.sm,
  bottomExtra = 0,
  backgroundColor = colors.bg.primary,
  style,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  // Extra spacing only applies to the edges this screen actually clears: an edge
  // left to the navigator must contribute no padding of its own.
  const paddingTop = edges.includes('top') ? insets.top + topExtra : 0;
  const paddingBottom = edges.includes('bottom') ? insets.bottom + bottomExtra : 0;

  return (
    <View
      style={[
        { flex: 1, backgroundColor },
        style,
        { paddingTop, paddingBottom },
      ]}
    >
      {children}
    </View>
  );
}
