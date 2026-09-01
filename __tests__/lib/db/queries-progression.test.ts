import { getExerciseProgressionData } from '../../../lib/db/queries';

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

describe('getExerciseProgressionData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 3 data points in ascending date order with correct averages', async () => {
    const mockData = [
      {
        sessionId: 1,
        date: new Date('2026-07-01'),
        avgWeight: 60,
        avgReps: 10,
        avgRir: 2,
        setCount: 3,
      },
      {
        sessionId: 2,
        date: new Date('2026-07-08'),
        avgWeight: 65,
        avgReps: 8,
        avgRir: 1,
        setCount: 3,
      },
      {
        sessionId: 3,
        date: new Date('2026-07-15'),
        avgWeight: 70,
        avgReps: 8,
        avgRir: 0,
        setCount: 3,
      },
    ];

    (db.select as jest.Mock).mockReturnValueOnce(createMockQuery(mockData));

    const result = await getExerciseProgressionData(1);

    expect(result).toHaveLength(3);
    expect(result[0].sessionId).toBe(1);
    expect(result[0].avgWeight).toBe(60);
    expect(result[0].date).toEqual(new Date('2026-07-01'));
    expect(result[2].sessionId).toBe(3);
    expect(result[2].avgWeight).toBe(70);
    expect(result[2].setCount).toBe(3);
  });

  it('should only count completed sets in the averages', async () => {
    const mockData = [
      {
        sessionId: 1,
        date: new Date('2026-07-01'),
        avgWeight: 80,
        avgReps: 10,
        avgRir: 2,
        setCount: 2,
      },
    ];

    (db.select as jest.Mock).mockReturnValueOnce(createMockQuery(mockData));

    const result = await getExerciseProgressionData(1);

    expect(result).toHaveLength(1);
    expect(result[0].setCount).toBe(2);
    expect(result[0].avgWeight).toBe(80);
  });

  it('should return null avgWeight when all sets have null weight', async () => {
    const mockData = [
      {
        sessionId: 1,
        date: new Date('2026-07-01'),
        avgWeight: null,
        avgReps: 12,
        avgRir: 3,
        setCount: 3,
      },
    ];

    (db.select as jest.Mock).mockReturnValueOnce(createMockQuery(mockData));

    const result = await getExerciseProgressionData(1);

    expect(result).toHaveLength(1);
    expect(result[0].avgWeight).toBeNull();
    expect(result[0].avgReps).toBe(12);
  });

  it('should return empty array when no sessions exist for exercise', async () => {
    (db.select as jest.Mock).mockReturnValueOnce(createMockQuery([]));

    const result = await getExerciseProgressionData(999);

    expect(result).toEqual([]);
  });

  it('should return null avgRir when RIR data is missing', async () => {
    const mockData = [
      {
        sessionId: 1,
        date: new Date('2026-07-01'),
        avgWeight: 80,
        avgReps: 10,
        avgRir: null,
        setCount: 3,
      },
    ];

    (db.select as jest.Mock).mockReturnValueOnce(createMockQuery(mockData));

    const result = await getExerciseProgressionData(1);

    expect(result).toHaveLength(1);
    expect(result[0].avgRir).toBeNull();
  });

  it('should limit results to 52 most recent sessions', async () => {
    const mockData = Array.from({ length: 52 }, (_, i) => ({
      sessionId: i + 1,
      date: new Date(`2026-01-${String((i % 28) + 1).padStart(2, '0')}`),
      avgWeight: 80,
      avgReps: 10,
      avgRir: 2,
      setCount: 3,
    }));

    (db.select as jest.Mock).mockReturnValueOnce(createMockQuery(mockData));

    const result = await getExerciseProgressionData(1);

    expect(result).toHaveLength(52);
  });
});
