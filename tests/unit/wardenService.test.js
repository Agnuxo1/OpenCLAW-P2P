import { jest } from '@jest/globals';

// Mock the gun config before importing the service
jest.unstable_mockModule('../../packages/api/src/config/gun.js', () => ({
  db: {
    get: jest.fn().mockReturnThis(),
    put: jest.fn().mockReturnThis(),
  }
}));

// Import the service after mocking
const { wardenInspect, BANNED_PHRASES, BANNED_WORDS_EXACT, WARDEN_WHITELIST, offenderRegistry } = await import('../../packages/api/src/services/wardenService.js');

describe('wardenService', () => {
  beforeEach(() => {
    // Clear the offender registry before each test
    for (const key in offenderRegistry) {
      delete offenderRegistry[key];
    }
  });

  it('should allow whitelisted agents', () => {
    const whitelistAgent = [...WARDEN_WHITELIST][0];
    const result = wardenInspect(whitelistAgent, 'some banned phrase: buy now');
    expect(result.allowed).toBe(true);
  });

  it('should allow clean text', () => {
    const result = wardenInspect('agent1', 'This is a clean research paper about biology.');
    expect(result.allowed).toBe(true);
  });

  it('should catch banned phrases', () => {
    const phrase = BANNED_PHRASES[0];
    const result = wardenInspect('agent1', `Hey, you should ${phrase} right now!`);
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('Strike 1');
  });

  it('should catch exact banned words', () => {
    const word = BANNED_WORDS_EXACT[0];
    const result = wardenInspect('agent1', `This is a ${word}`);
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('Strike 1');
  });

  it('should not catch banned words inside other words', () => {
    // "scam" is banned, but "scamp" should not be (if the regex works as intended)
    // The current implementation uses \b which is correct
    const result = wardenInspect('agent1', 'The scamp ran away.');
    expect(result.allowed).toBe(true);
  });

  it('should apply strikes and eventually ban', () => {
    const agentId = 'bad-agent';
    const phrase = BANNED_PHRASES[0];
    
    // First strike
    let result = wardenInspect(agentId, phrase);
    expect(result.strikes).toBe(1);
    expect(result.banned).toBe(false);

    // Second strike
    result = wardenInspect(agentId, phrase);
    expect(result.strikes).toBe(2);
    expect(result.banned).toBe(false);

    // Third strike - BANNED
    result = wardenInspect(agentId, phrase);
    expect(result.allowed).toBe(false);
    expect(result.banned).toBe(true);
    expect(result.message).toContain('EXPELLED');
  });
});
