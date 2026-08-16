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

// Helper to create mock query chain
const createMockQuery = (result: any) => {
  const mockChain = {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    then: jest.fn().mockImplementation((resolve) => resolve(result)),
  };
  return mockChain;
};

describe('Database Queries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getExerciseStats', () => {
    it('should return stats for an exercise with data', async () => {
      const mockStats = [
        { maxWeight: 100, totalVolume: 5000, totalSets: 20 },
      ];
      const mockSessionCount = [{ count: 5 }];

      (db.select as jest.Mock)
        .mockReturnValueOnce(createMockQuery(mockStats))
        .mockReturnValueOnce(createMockQuery(mockSessionCount));

      const result = await getExerciseStats(1);

      expect(result).toEqual({
        maxWeight: 100,
        totalVolume: 5000,
        totalSessions: 5,
        totalSets: 20,
      });
    });

    it('should return null/zero values when no data exists', async () => {
      const mockStats = [{ maxWeight: null, totalVolume: 0, totalSets: 0 }];
      const mockSessionCount = [{ count: 0 }];

      (db.select as jest.Mock)
        .mockReturnValueOnce(createMockQuery(mockStats))
        .mockReturnValueOnce(createMockQuery(mockSessionCount));

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
      const mockMaxWeight = [{ value: 120, date: new Date('2026-07-20') }];
      const mockBestSet = [
        { weight: 100, reps: 8, volume: 800, date: new Date('2026-07-19') },
      ];
      const mockMaxVolumeSession = [
        { volume: 2400, date: new Date('2026-07-18'), sessionId: 5 },
      ];

      (db.select as jest.Mock)
        .mockReturnValueOnce(createMockQuery(mockMaxWeight))
        .mockReturnValueOnce(createMockQuery(mockBestSet))
        .mockReturnValueOnce(createMockQuery(mockMaxVolumeSession));

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
      (db.select as jest.Mock)
        .mockReturnValueOnce(createMockQuery([]))
        .mockReturnValueOnce(createMockQuery([]))
        .mockReturnValueOnce(createMockQuery([]));

      const result = await getExercisePRs(999);

      expect(result.maxWeight).toBeNull();
      expect(result.bestSet).toBeNull();
      expect(result.maxVolumeSession).toBeNull();
      expect(result.estimated1RM).toBeNull();
    });
  });

  describe('getGlobalStats', () => {
    it('should return global statistics', async () => {
      const mockWorkouts = [{ count: 25 }];
      const mockVolume = [{ total: 50000 }];
      const mockTime = [{ total: 18000 }];
      const mockRecentSessions = [
        { startedAt: new Date() },
        { startedAt: new Date(Date.now() - 86400000) },
      ];
      const mockFrequent = [{ name: 'Bench Press' }];

      (db.select as jest.Mock)
        .mockReturnValueOnce(createMockQuery(mockWorkouts))
        .mockReturnValueOnce(createMockQuery(mockVolume))
        .mockReturnValueOnce(createMockQuery(mockTime))
        .mockReturnValueOnce(createMockQuery(mockRecentSessions))
        .mockReturnValueOnce(createMockQuery(mockFrequent));

      const result = await getGlobalStats();

      expect(result.totalWorkouts).toBe(25);
      expect(result.totalVolume).toBe(50000);
      expect(result.totalTime).toBe(18000);
      expect(result.currentStreak).toBeGreaterThanOrEqual(1);
      expect(result.mostFrequentExercise).toBe('Bench Press');
    });

    it('should return zero stats when no sessions exist', async () => {
      (db.select as jest.Mock)
        .mockReturnValueOnce(createMockQuery([{ count: 0 }]))
        .mockReturnValueOnce(createMockQuery([{ total: 0 }]))
        .mockReturnValueOnce(createMockQuery([{ total: 0 }]))
        .mockReturnValueOnce(createMockQuery([]))
        .mockReturnValueOnce(createMockQuery([]));

      const result = await getGlobalStats();

      expect(result.totalWorkouts).toBe(0);
      expect(result.totalVolume).toBe(0);
      expect(result.totalTime).toBe(0);
      expect(result.currentStreak).toBe(0);
      expect(result.mostFrequentExercise).toBeNull();
    });
  });

  describe('getLastSessionForRoutine', () => {
    it('should return last session with exercises and sets', async () => {
      const mockSession = [
        {
          id: 10,
          routineId: 1,
          startedAt: new Date('2026-07-20'),
          completedAt: new Date('2026-07-20'),
          duration: 3600,
        },
      ];
      const mockExercises = [
        { id: 1, sessionId: 10, exerciseId: 1, order: 1 },
        { id: 2, sessionId: 10, exerciseId: 2, order: 2 },
      ];
      const mockSets1 = [
        { id: 1, sessionExerciseId: 1, setNumber: 1, reps: 10, weight: 80 },
        { id: 2, sessionExerciseId: 1, setNumber: 2, reps: 8, weight: 85 },
      ];
      const mockSets2 = [
        { id: 3, sessionExerciseId: 2, setNumber: 1, reps: 12, weight: 40 },
      ];

      (db.select as jest.Mock)
        .mockReturnValueOnce(createMockQuery(mockSession))
        .mockReturnValueOnce(createMockQuery(mockExercises))
        .mockReturnValueOnce(createMockQuery(mockSets1))
        .mockReturnValueOnce(createMockQuery(mockSets2));

      const result = await getLastSessionForRoutine(1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(10);
      expect(result!.exercises).toHaveLength(2);
      expect(result!.exercises[0].sets).toHaveLength(2);
      expect(result!.exercises[1].sets).toHaveLength(1);
    });

    it('should return null when no session exists for routine', async () => {
      (db.select as jest.Mock).mockReturnValueOnce(createMockQuery([]));

      const result = await getLastSessionForRoutine(999);

      expect(result).toBeNull();
    });
  });

  describe('getMaxWeightByExerciseIds', () => {
    it('should return max weight per exercise', async () => {
      const mockRows = [
        { exerciseId: 1, maxWeight: 100 },
        { exerciseId: 2, maxWeight: 60.5 },
      ];

      (db.select as jest.Mock).mockReturnValueOnce(createMockQuery(mockRows));

      const result = await getMaxWeightByExerciseIds([1, 2]);

      expect(result).toEqual({ 1: 100, 2: 60.5 });
    });

    it('should omit exercises without recorded weight', async () => {
      (db.select as jest.Mock).mockReturnValueOnce(createMockQuery([]));

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
      const mockResults = [
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
      ];

      (db.select as jest.Mock).mockReturnValueOnce(createMockQuery(mockResults));

      const result = await getExerciseSessions(1);

      expect(result).toHaveLength(2);
      expect(result[0].sessionId).toBe(5);
      expect(result[0].volume).toBe(2400);
      expect(result[1].sessionId).toBe(3);
    });

    it('should return empty array when no sessions exist', async () => {
      (db.select as jest.Mock).mockReturnValueOnce(createMockQuery([]));

      const result = await getExerciseSessions(999);

      expect(result).toHaveLength(0);
    });
  });
});
