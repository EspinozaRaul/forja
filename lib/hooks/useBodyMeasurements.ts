import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '../db';
import { bodyMeasurements } from '../db/schema';
import { desc, eq } from 'drizzle-orm';
import { mutationErrorHandler } from '../utils/mutation-error';
import { now } from '../utils/date';

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
  return useQuery<BodyMeasurement[]>({
    queryKey: MEASUREMENTS_KEY,
    queryFn: async () => {
      const results = await db
        .select()
        .from(bodyMeasurements)
        .orderBy(desc(bodyMeasurements.date));
      
      return results.map((r) => ({
        ...r,
        date: new Date(r.date),
        createdAt: new Date(r.createdAt),
      }));
    },
  });
}

export function useCreateMeasurement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateMeasurementInput) => {
      const now = new Date();
      await db.insert(bodyMeasurements).values({
        date: input.date,
        weight: input.weight ?? null,
        bodyFat: input.bodyFat ?? null,
        chest: input.chest ?? null,
        waist: input.waist ?? null,
        hips: input.hips ?? null,
        arms: input.arms ?? null,
        thighs: input.thighs ?? null,
        notes: input.notes ?? null,
        createdAt: now,
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
      await db.delete(bodyMeasurements).where(eq(bodyMeasurements.id, id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MEASUREMENTS_KEY });
    },
    onError: mutationErrorHandler('Error al eliminar medición'),
  });
}
