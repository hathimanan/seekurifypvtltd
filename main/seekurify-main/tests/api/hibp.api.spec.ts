import * as dotenv from 'dotenv';
import { getAuthToken, API_URL } from '../helpers/api.helper';
dotenv.config({ path: '.env.test' });

let authToken: string;

beforeAll(async () => {
  authToken = await getAuthToken();
});

describe('API — HIBP Breach Detection', () => {
  test('POST /api/hibp/check-all without auth returns 401', async () => {
    const res = await fetch(`${API_URL}/api/hibp/check-all`, {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/hibp/check-all with auth returns results array', async () => {
    const res = await fetch(`${API_URL}/api/hibp/check-all`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    // May be 200 with results, or 200 with empty array if no passwords exist
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('results');
    expect(Array.isArray(data.results)).toBe(true);
  });

  test('GET /api/hibp/check-email without auth returns 401', async () => {
    const res = await fetch(`${API_URL}/api/hibp/check-email`);
    expect(res.status).toBe(401);
  });

  test('GET /api/hibp/check-email with auth returns breaches array', async () => {
    const res = await fetch(`${API_URL}/api/hibp/check-email`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    // HIBP API may be rate-limited in dev; accept 200 or 429
    expect([200, 429, 503]).toContain(res.status);
    if (res.status === 200) {
      const data = await res.json();
      expect(data).toHaveProperty('breaches');
      expect(Array.isArray(data.breaches)).toBe(true);
    }
  });
});
