import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

// Mock undici fetch to simulate NDJSON streaming
const makeResponse = (lines) => ({
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

let currentResponse = makeResponse(["{\"c1\":1}\n", "{\"c1\":2}\n"]);

vi.mock('undici', () => ({
  fetch: async () => currentResponse,
}));

let app;
beforeAll(async () => {
  const mod = await import('../server.js');
  app = mod.default;
});

describe('download-pdf-query streaming', () => {
  it('aggregates NDJSON and returns a PDF', async () => {
    currentResponse = makeResponse(["{\\"c1\\":1}\\n", "{\\"c1\\":2}\\n"]);
    const res = await request(app)
      .post('/api/download-pdf-query')
      .set('Content-Type', 'application/json')
      .send({ model: 'm', prompt: 'p', mode: 'database' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    const buf = res.body instanceof Buffer ? res.body : Buffer.from(res.text || '', 'binary');
    expect(buf.length).toBeGreaterThan(100);
    // PDF header starts with %PDF-
    expect(buf[0]).toBe(0x25); // '%'
    expect(buf[1]).toBe(0x50); // 'P'
    expect(buf[2]).toBe(0x44); // 'D'
    expect(buf[3]).toBe(0x46); // 'F'
    expect(buf[4]).toBe(0x2D); // '-'
  });
});

