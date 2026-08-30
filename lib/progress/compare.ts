import type { SessionExerciseWithSets } from '../db/queries';

export interface ExerciseComparison {
  exerciseId: number;
  name: string;
  unit: string;
  presentInA: boolean;
  presentInB: boolean;
  weightDelta: number | null;
  repsDelta: number | null;
  volumeDelta: number | null;
  bestWeightA: number | null;
  bestWeightB: number | null;
  bestRepsA: number | null;
  bestRepsB: number | null;
}

export interface SessionComparison {
  perExercise: ExerciseComparison[];
  summary: {
    volumeDelta: number;
    setsDelta: number;
    exercisesCount: number;
  };
}

interface ExerciseStats {
  bestWeight: number | null;
  bestReps: number | null;
  volume: number;
  setCount: number;
}

const EMPTY_STATS: ExerciseStats = {
  bestWeight: null,
  bestReps: null,
  volume: 0,
  setCount: 0,
};

/**
 * Aggregate completed sets per exercise.
 *
 * Intensity-method groups (dropset / rest-pause / cluster) store several rows
 * per setNumber (isDropGroup parent + dropOrder children). Chosen behavior:
 * BEST WEIGHT and BEST REPS take the max across ALL completed rows (group
 * children included), and VOLUME counts every completed row. This slightly
 * overweights drop groups versus counting only the heaviest row of a group, but
 * it is predictable and consistent with how volume is tallied elsewhere. Sets
 * that are not completed are excluded entirely.
 */
function collectExerciseStats(exercises: SessionExerciseWithSets[]): Map<number, ExerciseStats> {
  const byExercise = new Map<number, ExerciseStats>();

  for (const se of exercises) {
    const stats = byExercise.get(se.exerciseId) ?? { ...EMPTY_STATS };

    for (const set of se.sets) {
      if (!set.completed) continue;
      stats.setCount += 1;
      if (set.weight != null && set.weight > 0) {
        stats.bestWeight = Math.max(stats.bestWeight ?? 0, set.weight);
      }
      if (set.reps != null && set.reps > 0) {
        stats.bestReps = Math.max(stats.bestReps ?? 0, set.reps);
      }
      if (set.weight != null && set.reps != null) {
        stats.volume += set.weight * set.reps;
      }
    }

    byExercise.set(se.exerciseId, stats);
  }

  return byExercise;
}

export function compareSessions(
  sessionA: SessionExerciseWithSets[],
  sessionB: SessionExerciseWithSets[],
  exerciseNames: Record<number, string>,
  exerciseUnits: Record<number, string>
): SessionComparison {
  const statsA = collectExerciseStats(sessionA);
  const statsB = collectExerciseStats(sessionB);

  const presentInA = new Set(sessionA.map((se) => se.exerciseId));
  const presentInB = new Set(sessionB.map((se) => se.exerciseId));

  // Union of exercises, ordered by A first (its own order), then B-only ones.
  const orderedIds: number[] = [];
  const seen = new Set<number>();
  for (const id of presentInA) {
    orderedIds.push(id);
    seen.add(id);
  }
  for (const id of presentInB) {
    if (!seen.has(id)) orderedIds.push(id);
  }

  const perExercise: ExerciseComparison[] = [];
  let totalVolumeA = 0;
  let totalVolumeB = 0;
  let totalSetsA = 0;
  let totalSetsB = 0;

  for (const exerciseId of orderedIds) {
    const a = statsA.get(exerciseId);
    const b = statsB.get(exerciseId);

    const volumeA = a?.volume ?? 0;
    const volumeB = b?.volume ?? 0;
    totalVolumeA += volumeA;
    totalVolumeB += volumeB;
    totalSetsA += a?.setCount ?? 0;
    totalSetsB += b?.setCount ?? 0;

    // Deltas are B - A. Best-based deltas are null when either side has no
    // completed set; volume deltas are always numeric because a side with no
    // completed sets has zero volume (a dropped exercise reads as negative).
    const weightDelta =
      a?.bestWeight != null && b?.bestWeight != null ? b.bestWeight - a.bestWeight : null;
    const repsDelta =
      a?.bestReps != null && b?.bestReps != null ? b.bestReps - a.bestReps : null;

    perExercise.push({
      exerciseId,
      name: exerciseNames[exerciseId] ?? 'Exercise',
      unit: exerciseUnits[exerciseId] ?? 'kg',
      presentInA: presentInA.has(exerciseId),
      presentInB: presentInB.has(exerciseId),
      weightDelta,
      repsDelta,
      volumeDelta: volumeB - volumeA,
      bestWeightA: a?.bestWeight ?? null,
      bestWeightB: b?.bestWeight ?? null,
      bestRepsA: a?.bestReps ?? null,
      bestRepsB: b?.bestReps ?? null,
    });
  }

  return {
    perExercise,
    summary: {
      volumeDelta: totalVolumeB - totalVolumeA,
      setsDelta: totalSetsB - totalSetsA,
      exercisesCount: orderedIds.length,
    },
  };
}