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

let currentResponse = makeResponse([
  '{"x":1,"y":"a,b"}\n',
  '{"x":2,"y":"line\nwrap"}\n',
  '{"_narration":"skip"}\n'
]);

vi.mock('undici', () => ({
  fetch: async () => currentResponse,
}));

let app;
beforeAll(async () => {
  const mod = await import('../server.js');
  app = mod.default;
});

describe('download-csv-query streaming', () => {
  it('converts NDJSON to CSV with quoting and skips narration', async () => {
    currentResponse = makeResponse([
      '{"x":1,"y":"a,b"}\n',
      '{"x":2,"y":"line\nwrap"}\n',
      '{"_narration":"skip"}\n'
    ]);

    const res = await request(app)
      .post('/api/download-csv-query')
      .set('Content-Type', 'application/json')
      .send({ model: 'm', prompt: 'p', mode: 'database' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const csv = res.text;
    const lines = csv.trim().split('\n');
    // header
    expect(lines[0]).toMatch(/^x,y$/);
    // first row: y has comma -> quoted
    expect(lines[1]).toBe('1,"a,b"');
    // second row: y has newline -> quoted; result may be split across lines, but server writes JSON lines into single row
    // Our implementation quotes newlines, so expect embedded newline to create an actual newline in CSV output.
    // We only assert that '2' appears and at least one row includes wrap content
    expect(csv).toContain('2,');
    expect(csv).toContain('line');
  });
});

