import {
  mapWeightToY,
  mapRepsToSize,
  mapRirToOpacity,
} from '../../../lib/utils/progression-mapping';

describe('ProgressionBubble mapping functions', () => {
  describe('mapWeightToY', () => {
    it('should return 0 when weight is null', () => {
      expect(mapWeightToY(null, 140, 100)).toBe(0);
    });

    it('should return 0 when maxWeight is 0', () => {
      expect(mapWeightToY(80, 140, 0)).toBe(0);
    });

    it('should map weight to Y position proportionally', () => {
      // 80kg out of 100kg max in 140px chart = 112px
      expect(mapWeightToY(80, 140, 100)).toBe(112);
    });

    it('should return full height when weight equals maxWeight', () => {
      expect(mapWeightToY(100, 140, 100)).toBe(140);
    });

    it('should return 0 when weight is 0', () => {
      expect(mapWeightToY(0, 140, 100)).toBe(0);
    });
  });

  describe('mapRepsToSize', () => {
    it('should return 20 for null reps', () => {
      expect(mapRepsToSize(null)).toBe(20);
    });

    it('should clamp to minimum 12px for low reps', () => {
      expect(mapRepsToSize(1)).toBe(12);
      expect(mapRepsToSize(3)).toBe(12);
    });

    it('should clamp to maximum 32px for high reps', () => {
      expect(mapRepsToSize(20)).toBe(32);
      expect(mapRepsToSize(15)).toBe(30);
    });

    it('should map reps linearly within range', () => {
      expect(mapRepsToSize(10)).toBe(20);
      expect(mapRepsToSize(5)).toBe(12);
      expect(mapRepsToSize(12)).toBe(24);
    });
  });

  describe('mapRirToOpacity', () => {
    it('should return 0.6 for null RIR', () => {
      expect(mapRirToOpacity(null)).toBe(0.6);
    });

    it('should clamp to minimum 0.2 for low RIR', () => {
      expect(mapRirToOpacity(0)).toBe(0.2);
      expect(mapRirToOpacity(1)).toBe(0.2);
    });

    it('should clamp to maximum 1.0 for high RIR', () => {
      expect(mapRirToOpacity(10)).toBe(1.0);
      expect(mapRirToOpacity(15)).toBe(1.0);
    });

    it('should map RIR proportionally within range', () => {
      expect(mapRirToOpacity(5)).toBe(0.5);
      expect(mapRirToOpacity(8)).toBe(0.8);
    });
  });
});
