/**
 * Tests for gunCollect utility
 */

// Mock Gun.js reference for testing
function createMockGunRef(items, emitDelay = 5) {
    return {
        map() {
            return {
                once(callback) {
                    items.forEach((item, i) => {
                        setTimeout(() => callback(item.data, item.id), emitDelay * (i + 1));
                    });
                }
            };
        }
    };
}

// We test the logic directly since Jest ESM setup may vary
import { gunCollect, gunOnce } from '../../packages/api/src/utils/gunCollect.js';

describe('gunCollect', () => {
    test('collects all items from a Gun.js reference', async () => {
        const mockRef = createMockGunRef([
            { id: 'a', data: { title: 'Paper A' } },
            { id: 'b', data: { title: 'Paper B' } },
            { id: 'c', data: { title: 'Paper C' } }
        ]);

        const results = await gunCollect(mockRef, (d) => d && d.title);
        expect(results).toHaveLength(3);
        expect(results[0]).toHaveProperty('title', 'Paper A');
    });

    test('filters items based on predicate', async () => {
        const mockRef = createMockGunRef([
            { id: 'a', data: { title: 'Good', status: 'VERIFIED' } },
            { id: 'b', data: { title: 'Bad', status: 'DENIED' } },
            { id: 'c', data: { title: 'Good2', status: 'VERIFIED' } }
        ]);

        const results = await gunCollect(mockRef, (d) => d && d.status === 'VERIFIED');
        expect(results).toHaveLength(2);
    });

    test('respects limit option', async () => {
        const items = Array.from({ length: 20 }, (_, i) => ({
            id: `item-${i}`,
            data: { title: `Paper ${i}` }
        }));
        const mockRef = createMockGunRef(items, 2);

        const results = await gunCollect(mockRef, (d) => d && d.title, { limit: 5 });
        expect(results).toHaveLength(5);
    });

    test('resolves with empty array for empty collection', async () => {
        const mockRef = createMockGunRef([]);
        const results = await gunCollect(mockRef, (d) => !!d);
        expect(results).toEqual([]);
    });

    test('resolves within maxWaitMs even if data keeps arriving', async () => {
        const items = Array.from({ length: 100 }, (_, i) => ({
            id: `item-${i}`,
            data: { value: i }
        }));
        const mockRef = createMockGunRef(items, 50); // 50ms apart = 5 seconds total

        const start = Date.now();
        const results = await gunCollect(mockRef, (d) => !!d, { maxWaitMs: 500 });
        const elapsed = Date.now() - start;

        expect(elapsed).toBeLessThan(600); // Should cap at ~500ms
    });
});

describe('gunOnce', () => {
    test('resolves with data from Gun.js .once()', async () => {
        const mockRef = {
            once(callback) {
                setTimeout(() => callback({ title: 'Found' }), 10);
            }
        };

        const result = await gunOnce(mockRef);
        expect(result).toEqual({ title: 'Found' });
    });

    test('resolves with null on timeout', async () => {
        const mockRef = {
            once(callback) {
                // Never calls back
            }
        };

        const result = await gunOnce(mockRef, { maxWaitMs: 100 });
        expect(result).toBeNull();
    });
});
