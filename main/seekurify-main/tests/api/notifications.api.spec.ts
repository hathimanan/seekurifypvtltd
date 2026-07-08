import * as dotenv from 'dotenv';
import { getAuthToken, API_URL } from '../helpers/api.helper';
dotenv.config({ path: '.env.test' });

let authToken: string;

beforeAll(async () => {
  authToken = await getAuthToken();
});

describe('API — Notifications', () => {
  test('GET /api/notifications without auth returns 401', async () => {
    const res = await fetch(`${API_URL}/api/notifications`);
    expect(res.status).toBe(401);
  });

  test('GET /api/notifications with auth returns notifications and unreadCount', async () => {
    const res = await fetch(`${API_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('notifications');
    expect(data).toHaveProperty('unreadCount');
    expect(Array.isArray(data.notifications)).toBe(true);
    expect(typeof data.unreadCount).toBe('number');
  });

  test('GET /api/notifications/unread-count returns a count number', async () => {
    const res = await fetch(`${API_URL}/api/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.count).toBe('number');
    expect(data.count).toBeGreaterThanOrEqual(0);
  });

  test('PATCH /api/notifications/mark-read with empty ids marks all as read', async () => {
    // First mark all as read
    const patchRes = await fetch(`${API_URL}/api/notifications/mark-read`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: [] }),
    });
    expect(patchRes.status).toBe(200);
    const patchData = await patchRes.json();
    expect(typeof patchData.updated).toBe('number');

    // Unread count should now be 0
    const countRes = await fetch(`${API_URL}/api/notifications/unread-count`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const countData = await countRes.json();
    expect(countData.count).toBe(0);
  });

  test('PATCH /api/notifications/mark-read without auth returns 401', async () => {
    const res = await fetch(`${API_URL}/api/notifications/mark-read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [] }),
    });
    expect(res.status).toBe(401);
  });
});
