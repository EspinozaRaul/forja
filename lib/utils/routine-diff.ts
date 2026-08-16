/**
 * Compares a finished session against its source routine template and reports
 * STRUCTURAL differences only: added/removed exercises, set volume, and order.
 * Weights, reps, RIR, notes, rest time and duration are intentionally ignored —
 * those never trigger the "update routine?" question.
 */

export interface DiffSetRow {
  setNumber: number;
  method: string | null | undefined;
  isDropGroup: boolean;
  dropOrder: number;
}

export interface RoutineDiff {
  hasChanges: boolean;
  removed: { exerciseId: number; name: string }[];
  added: { exerciseId: number; name: string }[];
  volumeChanged: { exerciseId: number; name: string; fromSets: number; toSets: number }[];
  reordered: boolean;
}

interface RoutineExerciseInput {
  id: number;
  exerciseId: number;
  order: number;
  targetSets: number;
}

interface SessionExerciseInput {
  exerciseId: number;
  order: number;
}

interface DetectParams {
  routineExercises: RoutineExerciseInput[];
  sessionExercises: SessionExerciseInput[];
  setsByExercise: Record<number, DiffSetRow[]>;
  exerciseNames: Record<number, string>;
}

/**
 * Counts the "visible" rows for an exercise: plain sets plus drop-group
 * parents. Drop children (dropset / rest_pause / cluster rows with
 * isDropGroup !== true) are NOT counted — a drop group counts as one set.
 */
export function countVisibleSets(rows: DiffSetRow[] | undefined | null): number {
  if (!rows) return 0;
  return rows.filter(
    (s) =>
      s.method === 'linear' ||
      s.method == null ||
      s.method === '' ||
      s.isDropGroup === true
  ).length;
}

export function detectRoutineDiff(params: DetectParams): RoutineDiff {
  const { routineExercises, sessionExercises, setsByExercise, exerciseNames } = params;

  const routineByExercise = new Map(routineExercises.map((r) => [r.exerciseId, r]));
  const sessionByExercise = new Map(sessionExercises.map((s) => [s.exerciseId, s]));

  const name = (exerciseId: number) => exerciseNames[exerciseId] ?? 'Ejercicio desconocido';

  const removed = [...routineByExercise.keys()]
    .filter((exerciseId) => !sessionByExercise.has(exerciseId))
    .map((exerciseId) => ({ exerciseId, name: name(exerciseId) }));

  const added = [...sessionByExercise.keys()]
    .filter((exerciseId) => !routineByExercise.has(exerciseId))
    .map((exerciseId) => ({ exerciseId, name: name(exerciseId) }));

  const volumeChanged: RoutineDiff['volumeChanged'] = [];
  for (const [exerciseId, routineRow] of routineByExercise) {
    if (!sessionByExercise.has(exerciseId)) continue;
    const actualSets = countVisibleSets(setsByExercise[exerciseId]);
    if (actualSets !== routineRow.targetSets) {
      volumeChanged.push({
        exerciseId,
        name: name(exerciseId),
        fromSets: routineRow.targetSets,
        toSets: actualSets,
      });
    }
  }

  // Order changed: compare the exerciseId sequence (by order) restricted to the
  // exercises present in BOTH — purely added/removed rows are their own categories.
  const commonExerciseIds = new Set(
    [...routineByExercise.keys()].filter((exerciseId) => sessionByExercise.has(exerciseId))
  );
  const routineOrder = [...routineExercises]
    .sort((a, b) => a.order - b.order)
    .filter((r) => commonExerciseIds.has(r.exerciseId))
    .map((r) => r.exerciseId);
  const sessionOrder = [...sessionExercises]
    .sort((a, b) => a.order - b.order)
    .filter((s) => commonExerciseIds.has(s.exerciseId))
    .map((s) => s.exerciseId);

  let reordered = false;
  if (routineOrder.length !== sessionOrder.length) {
    reordered = true;
  } else {
    for (let i = 0; i < routineOrder.length; i++) {
      if (routineOrder[i] !== sessionOrder[i]) {
        reordered = true;
        break;
      }
    }
  }

  return {
    hasChanges:
      removed.length > 0 ||
      added.length > 0 ||
      volumeChanged.length > 0 ||
      reordered,
    removed,
    added,
    volumeChanged,
    reordered,
  };
}

export function summarizeDiff(diff: RoutineDiff): string[] {
  const lines: string[] = [];
  for (const item of diff.removed) lines.push(`Eliminado: ${item.name}`);
  for (const item of diff.added) lines.push(`Agregado: ${item.name}`);
  for (const item of diff.volumeChanged) {
    lines.push(`Volumen: ${item.fromSets}→${item.toSets} series en ${item.name}`);
  }
  if (diff.reordered) lines.push('Orden de ejercicios cambiado');
  return lines;
}