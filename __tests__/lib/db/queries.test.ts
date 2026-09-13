import {
  getExerciseStats,
  getExercisePRs,
  getGlobalStats,
  getLastSessionForRoutine,
  getExerciseSessions,
  getMaxWeightByExerciseIds,
} from '../../../lib/db/queries';

// Mock the database module
jest.mock('../../../lib/db/index', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
}));

import { db } from '../../../lib/db/index';

/**
 * Builds a thenable stand-in for a Drizzle query chain.
 */
function createMockQuery<T extends object>(result: T[]) {
  return {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    then: jest.fn().mockImplementation((resolve: (value: T[]) => unknown) => resolve(result)),
  };
}

/** Queues one `db.select()` result per query the implementation runs. */
function mockSelects(...results: object[][]) {
  const select = db.select as jest.Mock;
  for (const result of results) {
    select.mockReturnValueOnce(createMockQuery(result));
  }
}

describe('Database Queries', () => {
  beforeEach(() => {
    // resetAllMocks, NOT clearAllMocks: `clearAllMocks` leaves the
    // `mockReturnValueOnce` queue intact, so a test that queues more results
    // than the implementation consumes leaks them into the next test and
    // silently shifts every assertion after it.
    jest.resetAllMocks();
  });

  describe('getExerciseStats', () => {
    it('should return stats for an exercise with data', async () => {
      mockSelects([
        { maxWeight: 100, totalVolume: 5000, totalSets: 20, totalSessions: 5 },
      ]);

      const result = await getExerciseStats(1);

      expect(result).toEqual({
        maxWeight: 100,
        totalVolume: 5000,
        totalSessions: 5,
        totalSets: 20,
      });
    });

    it('should return null/zero values when no data exists', async () => {
      mockSelects([
        { maxWeight: null, totalVolume: 0, totalSets: 0, totalSessions: 0 },
      ]);

      const result = await getExerciseStats(999);

      expect(result).toEqual({
        maxWeight: null,
        totalVolume: 0,
        totalSessions: 0,
        totalSets: 0,
      });
    });
  });

  describe('getExercisePRs', () => {
    it('should return personal records for an exercise', async () => {
      mockSelects(
        [{ value: 120, date: new Date('2026-07-20') }],
        [{ weight: 100, reps: 8, volume: 800, date: new Date('2026-07-19') }],
        [{ volume: 2400, date: new Date('2026-07-18'), sessionId: 5 }]
      );

      const result = await getExercisePRs(1);

      expect(result.maxWeight).toEqual({
        value: 120,
        date: new Date('2026-07-20'),
      });
      expect(result.bestSet).toEqual({
        weight: 100,
        reps: 8,
        volume: 800,
        date: new Date('2026-07-19'),
      });
      expect(result.maxVolumeSession).toEqual({
        volume: 2400,
        date: new Date('2026-07-18'),
        sessionId: 5,
      });
      // Epley formula: 100 * (1 + 8/30) = 126.67 → rounded to 127
      expect(result.estimated1RM).toBe(127);
    });

    it('should return null PRs when no data exists', async () => {
      mockSelects([], [], []);

      const result = await getExercisePRs(999);

      expect(result.maxWeight).toBeNull();
      expect(result.bestSet).toBeNull();
      expect(result.maxVolumeSession).toBeNull();
      expect(result.estimated1RM).toBeNull();
    });
  });

  describe('getGlobalStats', () => {
    it('should return global statistics', async () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      // Order matters: it mirrors the Promise.all batch in getGlobalStats.
      mockSelects(
        [{ count: 25 }], // total workouts
        [{ total: 50000 }], // total volume
        [{ count: 120 }], // total completed sets
        [{ total: 18000 }], // total time
        [{ startedAt: today }, { startedAt: yesterday }], // recent sessions (streak)
        [{ name: 'Bench Press', count: 9 }] // most frequent exercise
      );

      const result = await getGlobalStats();

      expect(result.totalWorkouts).toBe(25);
      expect(result.totalVolume).toBe(50000);
      expect(result.totalCompletedSets).toBe(120);
      expect(result.totalTime).toBe(18000);
      expect(result.currentStreak).toBe(2);
      expect(result.mostFrequentExercise).toBe('Bench Press');
    });

    it('should return zero stats when no sessions exist', async () => {
      mockSelects(
        [{ count: 0 }],
        [{ total: 0 }],
        [{ count: 0 }],
        [{ total: 0 }],
        [],
        []
      );

      const result = await getGlobalStats();

      expect(result.totalWorkouts).toBe(0);
      expect(result.totalVolume).toBe(0);
      expect(result.totalCompletedSets).toBe(0);
      expect(result.totalTime).toBe(0);
      expect(result.currentStreak).toBe(0);
      expect(result.mostFrequentExercise).toBeNull();
    });
  });

  describe('getLastSessionForRoutine', () => {
    it('should return last session with exercises and sets', async () => {
      const sets = [
        { id: 1, sessionExerciseId: 1, setNumber: 1, reps: 10, weight: 80 },
        { id: 2, sessionExerciseId: 1, setNumber: 2, reps: 8, weight: 85 },
        { id: 3, sessionExerciseId: 2, setNumber: 1, reps: 12, weight: 40 },
      ];

      mockSelects(
        [
          {
            id: 10,
            routineId: 1,
            startedAt: new Date('2026-07-20'),
            completedAt: new Date('2026-07-20'),
            duration: 3600,
          },
        ],
        [
          { id: 1, sessionId: 10, exerciseId: 1, order: 1 },
          { id: 2, sessionId: 10, exerciseId: 2, order: 2 },
        ],
        sets
      );

      const result = await getLastSessionForRoutine(1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(10);
      expect(result!.exercises).toHaveLength(2);
      expect(result!.exercises[0].sets).toHaveLength(2);
      expect(result!.exercises[1].sets).toHaveLength(1);
    });

    it('should return null when no session exists for routine', async () => {
      mockSelects([]);

      const result = await getLastSessionForRoutine(999);

      expect(result).toBeNull();
    });
  });

  describe('getMaxWeightByExerciseIds', () => {
    it('should return max weight per exercise', async () => {
      mockSelects([
        { exerciseId: 1, maxWeight: 100 },
        { exerciseId: 2, maxWeight: 60.5 },
      ]);

      const result = await getMaxWeightByExerciseIds([1, 2]);

      expect(result).toEqual({ 1: 100, 2: 60.5 });
    });

    it('should omit exercises without recorded weight', async () => {
      mockSelects([]);

      const result = await getMaxWeightByExerciseIds([1, 2]);

      expect(result).toEqual({});
    });

    it('should return empty object for empty id list', async () => {
      const result = await getMaxWeightByExerciseIds([]);

      expect(result).toEqual({});
    });
  });

  describe('getExerciseSessions', () => {
    it('should return session history for an exercise', async () => {
      mockSelects([
        {
          sessionId: 5,
          startedAt: new Date('2026-07-20'),
          duration: 3600,
          volume: 2400,
          setCount: 6,
          completedSets: 5,
        },
        {
          sessionId: 3,
          startedAt: new Date('2026-07-18'),
          duration: 2700,
          volume: 1800,
          setCount: 4,
          completedSets: 4,
        },
      ]);

      const result = await getExerciseSessions(1);

      expect(result).toHaveLength(2);
      expect(result[0].sessionId).toBe(5);
      expect(result[0].volume).toBe(2400);
      expect(result[1].sessionId).toBe(3);
    });

    it('should return empty array when no sessions exist', async () => {
      mockSelects([]);

      const result = await getExerciseSessions(999);

      expect(result).toHaveLength(0);
    });
  });
});
