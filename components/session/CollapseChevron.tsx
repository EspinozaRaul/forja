import { TouchableOpacity, View } from 'react-native';
import { colors, spacing } from '../../lib/theme/tokens';

// Minimal linear chevron toggle: a thin two-side "V" drawn with CSS borders,
// rotated to point up (collapse) or down (expand). No emoji, no text.
export function CollapseChevron({ collapsed, onPress }: { collapsed: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{ alignItems: 'center', justifyContent: 'center', padding: spacing.xs }}
    >
      <View
        style={{
          width: 10,
          height: 10,
          borderRightWidth: 1.5,
          borderBottomWidth: 1.5,
          borderColor: colors.text.secondary,
          transform: [{ rotate: collapsed ? '45deg' : '-135deg' }],
        }}
      />
    </TouchableOpacity>
  );
}
