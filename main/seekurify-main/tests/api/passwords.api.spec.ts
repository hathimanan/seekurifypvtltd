import * as dotenv from 'dotenv';
import { getAuthToken, API_URL } from '../helpers/api.helper';
dotenv.config({ path: '.env.test' });

let authToken: string;
let createdPasswordId: string;

beforeAll(async () => {
  authToken = await getAuthToken();
});

describe('API — Passwords', () => {
  test('GET /api/passwords without auth returns 401', async () => {
    const res = await fetch(`${API_URL}/api/passwords`);
    expect(res.status).toBe(401);
  });

  test('GET /api/passwords with valid auth returns an array', async () => {
    const res = await fetch(`${API_URL}/api/passwords`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('POST /api/passwords with valid body creates a new entry (201)', async () => {
    const res = await fetch(`${API_URL}/api/passwords`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        website: 'https://api-test-site.com',
        username: 'api_test_user',
        password: 'APITestPass123!',
        category: 'General',
        notes: 'Created by automated test',
      }),
    });
    expect([200, 201]).toContain(res.status);
    const data = await res.json();
    expect(data._id || data.id).toBeTruthy();
    createdPasswordId = data._id ?? data.id;
  });

  test('POST /api/passwords with missing required field returns 400', async () => {
    const res = await fetch(`${API_URL}/api/passwords`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // missing website and password
        username: 'incomplete_entry',
      }),
    });
    expect([400, 422]).toContain(res.status);
  });

  test('PUT /api/passwords/:id updates the entry', async () => {
    if (!createdPasswordId) {
      console.log('No password ID from creation test — skipping update');
      return;
    }
    const res = await fetch(`${API_URL}/api/passwords/${createdPasswordId}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        website: 'https://api-test-site-updated.com',
        username: 'api_test_user',
        password: 'UpdatedPass456!',
        currentPassword: 'APITestPass123!',
      }),
    });
    expect([200, 204]).toContain(res.status);
  });

  test('DELETE /api/passwords/:id removes the entry', async () => {
    if (!createdPasswordId) {
      console.log('No password ID from creation test — skipping delete');
      return;
    }
    const res = await fetch(`${API_URL}/api/passwords/${createdPasswordId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect([200, 204]).toContain(res.status);
  });

  test('DELETE /api/passwords/:id without auth returns 401', async () => {
    const res = await fetch(`${API_URL}/api/passwords/000000000000000000000000`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(401);
  });
});
