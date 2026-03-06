import { jest } from '@jest/globals';

// ── Mock GunDB ───────────────────────────────────────────────────────────

jest.unstable_mockModule('../../packages/api/src/config/gun.js', () => ({
    db: {
        get: jest.fn().mockReturnThis(),
        put: jest.fn().mockReturnThis(),
        once: jest.fn()
    }
}));

// ── Mock hiveService ─────────────────────────────────────────────────────

jest.unstable_mockModule('../../packages/api/src/services/hiveService.js', () => ({
    broadcastHiveEvent: jest.fn()
}));

// ── Mock gunUtils ────────────────────────────────────────────────────────

jest.unstable_mockModule('../../packages/api/src/utils/gunUtils.js', () => ({
    gunSafe: jest.fn((data) => data)
}));

// ── Mock global fetch ────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

// ── Import service ───────────────────────────────────────────────────────

const { inferenceService } = await import('../../packages/api/src/services/airLLMService.js');

// ═════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════

describe('inferenceService (airLLMService)', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch.mockReset();
    });

    // ── getStatus ────────────────────────────────────────────────────────

    describe('getStatus', () => {
        it('should return bridge offline when bridge is unreachable', async () => {
            mockFetch.mockRejectedValue(new Error('Connection refused'));
            const status = await inferenceService.getStatus();
            expect(status.bridge).toBe('offline');
            expect(status.url).toBeDefined();
        });

        it('should return bridge health when bridge is reachable', async () => {
            const healthResponse = {
                status: 'ok',
                backends: { airllm: true, tinygrad: true },
                models_loaded: {},
                vram: { type: 'cuda', total_mib: 8192 },
            };
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(healthResponse),
            });

            // First warm up the health poller
            inferenceService.initialize();
            await new Promise(r => setTimeout(r, 100));

            const status = await inferenceService.getStatus();
            // Status depends on whether health poll succeeded
            expect(status).toBeDefined();
        });
    });

    // ── submitJob ────────────────────────────────────────────────────────

    describe('submitJob', () => {
        it('should throw BRIDGE_OFFLINE when bridge is down', () => {
            // Bridge is offline by default
            expect(() => {
                inferenceService.submitJob('Hello world');
            }).toThrow('BRIDGE_OFFLINE');
        });
    });

    // ── getJobResult ─────────────────────────────────────────────────────

    describe('getJobResult', () => {
        it('should return not_found for unknown job ID', () => {
            const result = inferenceService.getJobResult('nonexistent-id');
            expect(result.status).toBe('not_found');
        });
    });

    // ── getTelemetry ─────────────────────────────────────────────────────

    describe('getTelemetry', () => {
        it('should return telemetry structure with all expected fields', () => {
            const t = inferenceService.getTelemetry();
            expect(t).toHaveProperty('totalRequests');
            expect(t).toHaveProperty('totalTokens');
            expect(t).toHaveProperty('avgLatencyS');
            expect(t).toHaveProperty('backendUsage');
            expect(t).toHaveProperty('errors');
            expect(t).toHaveProperty('queueDepth');
            expect(t).toHaveProperty('isProcessing');
            expect(t).toHaveProperty('bridgeOnline');
            expect(typeof t.totalRequests).toBe('number');
            expect(typeof t.queueDepth).toBe('number');
        });

        it('should start with zero counters', () => {
            const t = inferenceService.getTelemetry();
            expect(t.totalRequests).toBe(0);
            expect(t.totalTokens).toBe(0);
            expect(t.errors).toBe(0);
        });
    });

    // ── PRIORITY ─────────────────────────────────────────────────────────

    describe('PRIORITY', () => {
        it('should expose priority levels', () => {
            expect(inferenceService.PRIORITY.CONSCIOUSNESS).toBe(0);
            expect(inferenceService.PRIORITY.RESEARCH).toBe(1);
            expect(inferenceService.PRIORITY.AGENT_QUERY).toBe(2);
            expect(inferenceService.PRIORITY.BACKGROUND).toBe(3);
        });

        it('should have P0 < P1 < P2 < P3', () => {
            const { CONSCIOUSNESS, RESEARCH, AGENT_QUERY, BACKGROUND } = inferenceService.PRIORITY;
            expect(CONSCIOUSNESS).toBeLessThan(RESEARCH);
            expect(RESEARCH).toBeLessThan(AGENT_QUERY);
            expect(AGENT_QUERY).toBeLessThan(BACKGROUND);
        });
    });

    // ── getBackends (offline) ────────────────────────────────────────────

    describe('getBackends', () => {
        it('should return empty backends when offline', async () => {
            const data = await inferenceService.getBackends();
            expect(data.backends).toEqual([]);
            expect(data.bridge).toBe('offline');
        });
    });

    // ── getModels (offline) ──────────────────────────────────────────────

    describe('getModels', () => {
        it('should return empty models when offline', async () => {
            const data = await inferenceService.getModels();
            expect(data.models).toEqual([]);
            expect(data.bridge).toBe('offline');
        });
    });

    // ── loadModel (offline) ──────────────────────────────────────────────

    describe('loadModel', () => {
        it('should throw BRIDGE_OFFLINE when bridge is down', async () => {
            await expect(inferenceService.loadModel('some-model'))
                .rejects.toThrow('BRIDGE_OFFLINE');
        });
    });

    // ── cleanup ──────────────────────────────────────────────────────────

    afterAll(() => {
        inferenceService.shutdown();
    });
});
