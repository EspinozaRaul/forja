import * as Haptics from 'expo-haptics';

export async function impactAsync(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) {
  try {
    await Haptics.impactAsync(style);
  } catch (error) {
    // Haptics not available on this device
    console.log('Haptics not available:', error);
  }
}

export async function notificationAsync(type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) {
  try {
    await Haptics.notificationAsync(type);
  } catch (error) {
    // Haptics not available on this device
    console.log('Haptics not available:', error);
  }
}

export async function selectionAsync() {
  try {
    await Haptics.selectionAsync();
  } catch (error) {
    // Haptics not available on this device
    console.log('Haptics not available:', error);
  }
}

// Convenience functions for common actions
export const haptics = {
  // Light feedback for selections
  select: () => selectionAsync(),
  
  // Medium feedback for starting/completing actions
  success: () => notificationAsync(Haptics.NotificationFeedbackType.Success),
  
  // Heavy feedback for destructive actions
  warning: () => notificationAsync(Haptics.NotificationFeedbackType.Warning),
  
  // Error feedback
  error: () => notificationAsync(Haptics.NotificationFeedbackType.Error),
  
  // Impact feedback for button presses
  press: () => impactAsync(Haptics.ImpactFeedbackStyle.Light),
  
  // Impact feedback for completing sets
  complete: () => impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  
  // Heavy impact for ending sessions
  heavy: () => impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
};
