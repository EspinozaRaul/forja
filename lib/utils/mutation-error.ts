import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Shared error handler for React Query mutations.
 * Shows a haptic feedback + alert on mutation failure.
 *
 * Usage in any useMutation:
 *   onError: mutationErrorHandler('Failed to save routine')
 */
export function mutationErrorHandler(contextMessage: string) {
  return async (error: Error) => {
    if (__DEV__) console.error(`${contextMessage}:`, error);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {
      // Haptics not available
    }
    Alert.alert('Error', contextMessage);
  };
}
