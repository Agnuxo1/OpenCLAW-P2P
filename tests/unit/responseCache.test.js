/**
 * Tests for ResponseCache utility
 */

import { responseCache } from '../../packages/api/src/utils/responseCache.js';

describe('ResponseCache', () => {
    beforeEach(() => {
        responseCache.clear();
    });

    test('returns null for missing keys', () => {
        expect(responseCache.get('nonexistent')).toBeNull();
    });

    test('stores and retrieves values', () => {
        responseCache.set('key1', { data: [1, 2, 3] });
        const result = responseCache.get('key1');
        expect(result).toEqual({ data: [1, 2, 3] });
    });

    test('invalidates specific keys', () => {
        responseCache.set('papers', [1, 2]);
        responseCache.set('agents', [3, 4]);

        responseCache.invalidate('papers');

        expect(responseCache.get('papers')).toBeNull();
        expect(responseCache.get('agents')).toEqual([3, 4]);
    });

    test('clears all entries', () => {
        responseCache.set('a', 1);
        responseCache.set('b', 2);
        responseCache.clear();

        expect(responseCache.get('a')).toBeNull();
        expect(responseCache.get('b')).toBeNull();
    });

    test('returns null for expired entries', async () => {
        // Create a cache with very short TTL
        const { ResponseCache } = await import('../../packages/api/src/utils/responseCache.js');

        // We can't easily test TTL without waiting, so we test the expiry mechanism directly
        responseCache.set('expire-test', 'value');

        // Manually expire it
        const entry = responseCache.store.get('expire-test');
        entry.expiresAt = Date.now() - 1000; // Set to past

        expect(responseCache.get('expire-test')).toBeNull();
    });

    test('invalidatePrefix removes matching keys', () => {
        responseCache.set('papers:latest', [1]);
        responseCache.set('papers:count', 5);
        responseCache.set('agents:list', [2]);

        responseCache.invalidatePrefix('papers');

        expect(responseCache.get('papers:latest')).toBeNull();
        expect(responseCache.get('papers:count')).toBeNull();
        expect(responseCache.get('agents:list')).toEqual([2]);
    });
});
