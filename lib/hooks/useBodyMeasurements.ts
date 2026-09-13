import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBodyMeasurements, createBodyMeasurement, deleteBodyMeasurement } from '../db/queries';
import { mutationErrorHandler } from '../utils/mutation-error';
import { useCurrentUserId } from './useCurrentUser';

// ─── Types ──────────────────────────────────────────────

export interface BodyMeasurement {
  id: number;
  date: Date;
  weight: number | null;
  bodyFat: number | null;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  arms: number | null;
  thighs: number | null;
  notes: string | null;
  createdAt: Date;
}

export interface CreateMeasurementInput {
  date: Date;
  weight?: number;
  bodyFat?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  arms?: number;
  thighs?: number;
  notes?: string;
}

// ─── Query Key ──────────────────────────────────────────

const MEASUREMENTS_KEY = ['bodyMeasurements'];

// ─── Hooks ──────────────────────────────────────────────

export function useBodyMeasurements() {
  const userId = useCurrentUserId();
  return useQuery<BodyMeasurement[]>({
    queryKey: [...MEASUREMENTS_KEY, userId],
    queryFn: async () => {
      const results = await getBodyMeasurements();
      
      return results.map((r) => ({
        ...r,
        date: new Date(r.date),
        createdAt: new Date(r.createdAt),
      }));
    },
    enabled: !!userId,
  });
}

export function useCreateMeasurement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateMeasurementInput) => {
      await createBodyMeasurement({
        date: input.date,
        weight: input.weight ?? null,
        bodyFat: input.bodyFat ?? null,
        chest: input.chest ?? null,
        waist: input.waist ?? null,
        hips: input.hips ?? null,
        arms: input.arms ?? null,
        thighs: input.thighs ?? null,
        notes: input.notes ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEASUREMENTS_KEY });
    },
    onError: mutationErrorHandler('Error al guardar medición'),
  });
}

export function useDeleteMeasurement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      await deleteBodyMeasurement(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEASUREMENTS_KEY });
    },
    onError: mutationErrorHandler('Error al eliminar medición'),
  });
}
