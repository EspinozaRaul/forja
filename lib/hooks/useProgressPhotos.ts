import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../db';
import { progressPhotos } from '../db/schema';
import { desc, eq } from 'drizzle-orm';
import * as ImagePicker from 'expo-image-picker';

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
  return useQuery<ProgressPhoto[]>({
    queryKey: PHOTOS_KEY,
    queryFn: async () => {
      const results = await db
        .select()
        .from(progressPhotos)
        .orderBy(desc(progressPhotos.date));
      
      return results.map((r) => ({
        ...r,
        date: new Date(r.date),
        createdAt: new Date(r.createdAt),
      }));
    },
  });
}

export function useCreatePhoto() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreatePhotoInput) => {
      const now = new Date();
      await db.insert(progressPhotos).values({
        date: input.date,
        uri: input.uri,
        bodyPart: input.bodyPart ?? null,
        createdAt: now,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PHOTOS_KEY });
    },
  });
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      await db.delete(progressPhotos).where(eq(progressPhotos.id, id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PHOTOS_KEY });
    },
  });
}

export function usePickPhoto() {
  return async (bodyPart?: string) => {
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
