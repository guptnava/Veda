import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

// Mock undici fetch used by the proxy to simulate NDJSON streaming
let makeResponse = (lines) => ({
  ok: true,
  status: 200,
  body: {
    getReader() {
      const enc = new TextEncoder();
      let i = 0;
      return {
        async read() {
          if (i < lines.length) {
            const chunk = enc.encode(lines[i++]);
            return { value: chunk, done: false };
          }
          return { value: undefined, done: true };
        },
      };
    },
  },
});

let currentResponse = makeResponse(["{\"a\":1}\n", "{\"b\":2}\n"]);

vi.mock('undici', () => ({
  fetch: async () => currentResponse,
}));

let app;
beforeAll(async () => {
  const mod = await import('../server.js');
  app = mod.default;
});

describe('streaming proxy', () => {
  it('streams NDJSON from Flask to client on /api/generate (database mode)', async () => {
    currentResponse = makeResponse(["{\"a\":1}\n", "{\"b\":2}\n"]);
    const res = await request(app)
      .post('/api/generate')
      .set('Content-Type', 'application/json')
      .send({ mode: 'database', prompt: 'test', model: 'm', stream: true });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/x-ndjson');
    expect(res.text).toContain('{"a":1}');
    expect(res.text).toContain('{"b":2}');
  });

  it('converts NDJSON to JSON array for /api/download-json-query and skips narration', async () => {
    currentResponse = makeResponse([
      '{"x":1}\n',
      '{"_narration":"ignore","text":"skip"}\n',
      '{"y":2}\n',
    ]);

    const body = { model: 'm', prompt: 'p', mode: 'database' };
    const res = await request(app)
      .post('/api/download-json-query')
      .set('Content-Type', 'application/json')
      .send(body);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    const arr = JSON.parse(res.text);
    expect(Array.isArray(arr)).toBe(true);
    expect(arr).toHaveLength(2);
    expect(arr[0]).toHaveProperty('x', 1);
    expect(arr[1]).toHaveProperty('y', 2);
  });
});

