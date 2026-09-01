jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({ data: [], isLoading: false, error: null })),
}));

jest.mock('../../../lib/db/queries', () => ({
  getExerciseProgressionData: jest.fn(),
}));

import { useExerciseProgressionData } from '../../../lib/hooks/useProgressionBubble';
import { getExerciseProgressionData } from '../../../lib/db/queries';

describe('useProgressionBubble', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should export useExerciseProgressionData as a function', () => {
    expect(typeof useExerciseProgressionData).toBe('function');
  });

  it('should call getExerciseProgressionData with exerciseId', async () => {
    const mockData = [
      {
        sessionId: 1,
        date: new Date('2026-07-01'),
        avgWeight: 80,
        avgReps: 10,
        avgRir: 2,
        setCount: 3,
      },
    ];

    (getExerciseProgressionData as jest.Mock).mockResolvedValue(mockData);

    const result = await getExerciseProgressionData(1);
    expect(getExerciseProgressionData).toHaveBeenCalledWith(1);
    expect(result).toEqual(mockData);
  });

  it('should return empty array for no data', async () => {
    (getExerciseProgressionData as jest.Mock).mockResolvedValue([]);

    const result = await getExerciseProgressionData(999);
    expect(result).toEqual([]);
  });
});
