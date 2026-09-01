// Pure mapping functions — no React/RN imports, fully testable

export function mapWeightToY(
  weight: number | null,
  chartHeight: number,
  maxWeight: number
): number {
  if (weight == null || maxWeight === 0) return 0;
  return (weight / maxWeight) * chartHeight;
}

export function mapRepsToSize(reps: number | null): number {
  if (reps == null) return 20;
  return Math.min(Math.max(reps * 2, 12), 32);
}

export function mapRirToOpacity(rir: number | null): number {
  if (rir == null) return 0.6;
  return Math.min(Math.max(rir / 10, 0.2), 1.0);
}
