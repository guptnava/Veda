import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

// Mock undici fetch to simulate NDJSON streaming from Flask
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

let currentResponse = makeResponse(["{\"col1\":1,\"col2\":\"a\"}\n", "{\"col1\":2,\"col2\":\"b\"}\n"]);

vi.mock('undici', () => ({
  fetch: async () => currentResponse,
}));

let app;
beforeAll(async () => {
  const mod = await import('../server.js');
  app = mod.default;
});

describe('download-excel-query streaming', () => {
  it('aggregates NDJSON into an XLSX workbook', async () => {
    currentResponse = makeResponse(["{\"col1\":1,\"col2\":\"a\"}\n", "{\"col1\":2,\"col2\":\"b\"}\n"]);

    const res = await request(app)
      .post('/api/download-excel-query')
      .set('Content-Type', 'application/json')
      .send({ model: 'm', prompt: 'p', mode: 'database' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    // XLSX is a ZIP; verify magic number 'PK' at start
    // supertest returns Buffer in res.body for non-text content
    const buf = res.body instanceof Buffer ? res.body : Buffer.from(res.text || '', 'binary');
    expect(buf.length).toBeGreaterThan(100); // should be non-trivial size
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
  });
});

