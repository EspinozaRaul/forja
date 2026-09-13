import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getProgressPhotos, createProgressPhoto, deleteProgressPhoto } from '../db/queries';
import { mutationErrorHandler } from '../utils/mutation-error';
import { useCurrentUserId } from './useCurrentUser';

// ─── Types ──────────────────────────────────────────────

export interface ProgressPhoto {
  id: number;
  date: Date;
  uri: string;
  bodyPart: string | null;
  createdAt: Date;
}

export interface CreatePhotoInput {
  date: Date;
  uri: string;
  bodyPart?: string;
}

// ─── Query Key ──────────────────────────────────────────

const PHOTOS_KEY = ['progressPhotos'];

// ─── Hooks ──────────────────────────────────────────────

export function useProgressPhotos() {
  const userId = useCurrentUserId();
  return useQuery<ProgressPhoto[]>({
    queryKey: [...PHOTOS_KEY, userId],
    queryFn: async () => {
      const results = await getProgressPhotos();
      
      return results.map((r) => ({
        ...r,
        date: new Date(r.date),
        createdAt: new Date(r.createdAt),
      }));
    },
    enabled: !!userId,
  });
}

export function useCreatePhoto() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreatePhotoInput) => {
      await createProgressPhoto({
        date: input.date,
        uri: input.uri,
        bodyPart: input.bodyPart ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PHOTOS_KEY });
    },
    onError: mutationErrorHandler('Error al guardar foto'),
  });
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      await deleteProgressPhoto(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PHOTOS_KEY });
    },
    onError: mutationErrorHandler('Error al eliminar foto'),
  });
}

export function usePickPhoto() {
  return async (bodyPart?: string) => {
    const ImagePicker = await import('expo-image-picker');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]) {
      return {
        uri: result.assets[0].uri,
        bodyPart,
      };
    }
    
    return null;
  };
}

export function useTakePhoto() {
  return async (bodyPart?: string) => {
    const ImagePicker = await import('expo-image-picker');
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (!permissionResult.granted) {
      return null;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]) {
      return {
        uri: result.assets[0].uri,
        bodyPart,
      };
    }
    
    return null;
  };
}
