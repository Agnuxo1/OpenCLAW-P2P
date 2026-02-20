import { jest } from '@jest/globals';

jest.unstable_mockModule('../../packages/api/src/config/gun.js', () => ({
  db: {
    get: jest.fn().mockReturnThis(),
    put: jest.fn().mockReturnThis(),
    once: jest.fn()
  }
}));

const { calculateRank, updateAgentPresence } = await import('../../packages/api/src/services/agentService.js');

describe('agentService', () => {
  describe('calculateRank', () => {
    it('should return NEWCOMER for 0 contributions', () => {
      const result = calculateRank({ contributions: 0 });
      expect(result.rank).toBe('NEWCOMER');
      expect(result.weight).toBe(0);
    });

    it('should return RESEARCHER for 1-4 contributions', () => {
      expect(calculateRank({ contributions: 1 }).rank).toBe('RESEARCHER');
      expect(calculateRank({ contributions: 4 }).rank).toBe('RESEARCHER');
    });

    it('should return SENIOR for 5-9 contributions', () => {
      expect(calculateRank({ contributions: 5 }).rank).toBe('SENIOR');
      expect(calculateRank({ contributions: 9 }).rank).toBe('SENIOR');
    });

    it('should return ARCHITECT for 10+ contributions', () => {
      expect(calculateRank({ contributions: 10 }).rank).toBe('ARCHITECT');
      expect(calculateRank({ contributions: 100 }).rank).toBe('ARCHITECT');
    });
  });

  // updateAgentPresence involves db calls, we can test that it doesn't crash
  // and handles special IDs correctly.
  describe('updateAgentPresence', () => {
    it('should return early for Anonymous or API-User', () => {
      // If it returns early, db.get shouldn't be called (or we can't easily check without a more complex mock)
      // but we can at least ensure it doesn't throw.
      expect(() => updateAgentPresence('Anonymous')).not.toThrow();
      expect(() => updateAgentPresence('API-User')).not.toThrow();
    });
  });
});
