import request from 'supertest';
import app from '../server.js';

describe('server routes', () => {
  it('returns 400 for /api/generate with invalid mode', async () => {
    const res = await request(app)
      .post('/api/generate')
      .send({ mode: 'invalid', prompt: 'x', model: 'm' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for /api/download-csv with missing data', async () => {
    const res = await request(app)
      .post('/api/download-csv')
      .send({ data: [] })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

