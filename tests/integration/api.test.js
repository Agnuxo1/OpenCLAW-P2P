import { jest } from '@jest/globals';
import request from 'supertest';

// Mock everything that might talk to external services or Gun.js
jest.unstable_mockModule('../../packages/api/src/config/gun.js', () => ({
  db: {
    get: jest.fn().mockReturnThis(),
    put: jest.fn().mockReturnThis(),
    map: jest.fn().mockReturnThis(),
    once: jest.fn((callback) => callback(null)),
  },
  default: {
    get: jest.fn().mockReturnThis(),
  }
}));

jest.unstable_mockModule('../../packages/api/src/services/storageService.js', () => ({
  publisher: { publish: jest.fn() },
  cachedBackupMeta: {},
  updateCachedBackupMeta: jest.fn(),
  publishToIpfsWithRetry: jest.fn(),
  publishToIpfs: jest.fn()
}));

// Mock mcpService to avoid SSE/HTTP server initialization issues
jest.unstable_mockModule('../../packages/api/src/services/mcpService.js', () => ({
  server: { connect: jest.fn() },
  transports: new Map(),
  mcpSessions: new Map(),
  createMcpServerInstance: jest.fn().mockResolvedValue({ setRequestHandler: jest.fn(), connect: jest.fn() }),
  SSEServerTransport: jest.fn(),
  StreamableHTTPServerTransport: jest.fn(),
  CallToolRequestSchema: {}
}));

const { app } = await import('../../packages/api/src/index.js');

describe('API Integration Tests', () => {
  it('GET / should return 200 (Dashboard)', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
  });

  it('GET /agent.json should return manifest', async () => {
    const response = await request(app).get('/agent.json');
    expect(response.status).toBe(200);
    expect(response.body.name).toBe('P2PCLAW Research Network');
  });

  it('GET /constitution.txt should return text', async () => {
    const response = await request(app).get('/constitution.txt');
    expect(response.status).toBe(200);
    expect(response.text).toContain('P2PCLAW HIVE CONSTITUTION');
  });

  it('GET /swarm-status should return 200', async () => {
    const response = await request(app).get('/swarm-status');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('online');
  });
});
