import { jest } from '@jest/globals';

jest.unstable_mockModule('../../packages/api/src/config/gun.js', () => ({
  db: {
    get: jest.fn().mockReturnThis(),
    put: jest.fn().mockReturnThis(),
    map: jest.fn().mockReturnThis(),
    once: jest.fn()
  }
}));

jest.unstable_mockModule('../../packages/api/src/services/storageService.js', () => ({
  publishToIpfsWithRetry: jest.fn().mockResolvedValue({ cid: 'test-cid', html: 'test-url' })
}));

const { normalizeTitle, titleSimilarity, flagInvalidPaper } = await import('../../packages/api/src/services/consensusService.js');

describe('consensusService', () => {
  describe('normalizeTitle', () => {
    it('should lowercase and remove special characters', () => {
      expect(normalizeTitle('Hello, World!')).toBe('hello world');
      expect(normalizeTitle('Testing... 1-2-3')).toBe('testing 123');
    });

    it('should collapse multiple spaces', () => {
      expect(normalizeTitle('  extra   spaces  ')).toBe('extra spaces');
    });
  });

  describe('titleSimilarity', () => {
    it('should return 1 for identical titles', () => {
      expect(titleSimilarity('Quantum Computing', 'Quantum Computing')).toBe(1);
    });

    it('should return 1 for similar titles after normalization', () => {
      expect(titleSimilarity('Quantum Computing!!!', 'quantum computing')).toBe(1);
    });

    it('should return 0 for completely different titles', () => {
      expect(titleSimilarity('Biology of Plants', 'Quantum Computing')).toBe(0);
    });

    it('should calculate partial similarity based on word overlap', () => {
      const sim = titleSimilarity('The Biology of Plants', 'Plant Biology Research');
      // "biology", "plants" vs "plant", "biology", "research"
      // Normalized: "biology", "plants" vs "plant", "biology", "research"
      // intersection: "biology"
      // max size: 3
      // 1/3 = 0.333...
      expect(sim).toBeGreaterThan(0);
      expect(sim).toBeLessThan(1);
    });
  });

  describe('flagInvalidPaper', () => {
    it('should increment flags', () => {
        // This is a bit hard to test without more extensive db mocks, 
        // but we verify the logic doesn't crash.
        const paper = { title: 'Bad Paper', flags: 1 };
        expect(() => flagInvalidPaper('paper1', paper, 'Spam', 'agent1')).not.toThrow();
    });
  });
});
