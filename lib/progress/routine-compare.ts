// ─── Routine Comparison Types ──────────────────────────

export interface RoutineSessionSet {
  weight: number | null;
  reps: number | null;
  rir: number | null;
  method: string | null;
}

export interface RoutineSessionExercise {
  sessionId: number;
  exerciseId: number;
  exerciseName: string;
  order: number;
  date: string; // ISO date
  sets: RoutineSessionSet[];
}

export interface RoutinePeriodData {
  periodKey: string; // "2026-01"
  label: string; // "Ene 2026"
  sessions: RoutineSessionExercise[];
}

export interface RoutineComparisonData {
  routineId: number;
  routineName: string;
  periods: RoutinePeriodData[];
  exercises: ExerciseComparisonRow[];
}

export interface ExerciseComparisonRow {
  exerciseId: number;
  exerciseName: string;
  status: 'unchanged' | 'new' | 'removed' | 'order-changed';
  orderInFirstPeriod: number | null;
  orderInLastPeriod: number | null;
  orderDelta: number | null;
  periods: {
    [periodKey: string]: {
      sessions: { date: string; sets: RoutineSessionSet[] }[];
      method: string | null;
    };
  };
}

// ─── Period helpers ────────────────────────────────────

const MONTH_LABELS_ES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

/** Build a human-readable label for a periodKey like "2026-01". */
export function periodLabel(periodKey: string): string {
  const [year, month] = periodKey.split('-');
  const idx = parseInt(month, 10) - 1;
  return `${MONTH_LABELS_ES[idx] ?? month} ${year}`;
}

// ─── buildRoutineComparison ────────────────────────────

interface RawSessionRow {
  sessionId: number;
  exerciseId: number;
  exerciseName: string;
  order: number;
  date: string; // Full date: "2026-07-06"
  periodKey: string; // Month only: "2026-07"
  weight: number | null;
  reps: number | null;
  rir: number | null;
  method: string | null;
}

/**
 * Transform raw DB rows into RoutineComparisonData.
 *
 * Detects exercise changes (new/removed between first and last period),
 * order changes, and method changes across the selected periods.
 */
export function buildRoutineComparison(
  routineId: number,
  routineName: string,
  rows: RawSessionRow[],
  periodKeys: string[]
): RoutineComparisonData {
  // Group rows by periodKey
  const sessionsByPeriod = new Map<string, Map<number, RoutineSessionExercise>>();

  for (const row of rows) {
    let periodMap = sessionsByPeriod.get(row.periodKey);
    if (!periodMap) {
      periodMap = new Map();
      sessionsByPeriod.set(row.periodKey, periodMap);
    }

    let exerciseEntry = periodMap.get(row.sessionId);
    if (!exerciseEntry) {
      exerciseEntry = {
        sessionId: row.sessionId,
        exerciseId: row.exerciseId,
        exerciseName: row.exerciseName,
        order: row.order,
        date: row.date,
        sets: [],
      };
      periodMap.set(row.sessionId, exerciseEntry);
    }

    exerciseEntry.sets.push({
      weight: row.weight,
      reps: row.reps,
      rir: row.rir,
      method: row.method,
    });
  }

  // Build period data in order
  const periods: RoutinePeriodData[] = periodKeys.map((pk) => ({
    periodKey: pk,
    label: periodLabel(pk),
    sessions: Array.from(sessionsByPeriod.get(pk)?.values() ?? []),
  }));

  // Collect all exercise IDs and names across all periods
  const exerciseMap = new Map<number, { name: string; orderInPeriod: Map<string, number> }>();

  for (const period of periods) {
    for (const session of period.sessions) {
      const entry = exerciseMap.get(session.exerciseId);
      if (entry) {
        entry.orderInPeriod.set(period.periodKey, session.order);
      } else {
        const orderMap = new Map<string, number>();
        orderMap.set(period.periodKey, session.order);
        exerciseMap.set(session.exerciseId, { name: session.exerciseName, orderInPeriod: orderMap });
      }
    }
  }

  // Determine first and last period keys
  const firstPeriod = periodKeys[0];
  const lastPeriod = periodKeys[periodKeys.length - 1];

  // Build per-exercise comparison rows
  const exercises: ExerciseComparisonRow[] = Array.from(exerciseMap.entries()).map(
    ([exerciseId, info]) => {
      const orderInFirst = info.orderInPeriod.get(firstPeriod) ?? null;
      const orderInLast = info.orderInPeriod.get(lastPeriod) ?? null;

      let status: ExerciseComparisonRow['status'] = 'unchanged';
      if (orderInFirst != null && orderInLast == null) {
        status = 'removed';
      } else if (orderInFirst == null && orderInLast != null) {
        status = 'new';
      } else if (orderInFirst != null && orderInLast != null && orderInFirst !== orderInLast) {
        status = 'order-changed';
      }

      // Collect per-period session data
      const periodsData: ExerciseComparisonRow['periods'] = {};
      for (const period of periods) {
        const periodSessions = period.sessions
          .filter((s) => s.exerciseId === exerciseId)
          .map((s) => ({ date: s.date, sets: s.sets }));

        // Extract dominant method for this exercise in this period
        const methods = new Set<string>();
        for (const s of periodSessions) {
          for (const set of s.sets) {
            if (set.method) methods.add(set.method);
          }
        }
        const method = methods.size === 1 ? Array.from(methods)[0] : null;

        periodsData[period.periodKey] = {
          sessions: periodSessions,
          method,
        };
      }

      return {
        exerciseId,
        exerciseName: info.name,
        status,
        orderInFirstPeriod: orderInFirst,
        orderInLastPeriod: orderInLast,
        orderDelta:
          orderInFirst != null && orderInLast != null ? orderInLast - orderInFirst : null,
        periods: periodsData,
      };
    }
  );

  return { routineId, routineName, periods, exercises };
}
