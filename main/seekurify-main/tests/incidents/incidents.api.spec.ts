import * as dotenv from 'dotenv';
import { getAuthToken, API_URL } from '../helpers/api.helper';
dotenv.config({ path: '.env.test' });

let authToken: string;
let createdIncidentId: string;

const validIncident = {
  title: 'Test Incident — Credential Breach',
  severity: 'high',
  description: 'SOAR test incident for automated breach response',
  category: 'credential_breach',
};

beforeAll(async () => {
  authToken = await getAuthToken();
});

describe('API — Incidents', () => {
  test('GET /api/incidents without auth returns 401', async () => {
    const res = await fetch(`${API_URL}/api/incidents`);
    expect(res.status).toBe(401);
  });

  test('GET /api/incidents with valid auth returns incidents array', async () => {
    const res = await fetch(`${API_URL}/api/incidents`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('incidents');
    expect(Array.isArray(data.incidents)).toBe(true);
    expect(data).toHaveProperty('total');
  });

  test('GET /api/incidents/stats returns status counts', async () => {
    const res = await fetch(`${API_URL}/api/incidents/stats`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('open');
    expect(data).toHaveProperty('investigating');
    expect(data).toHaveProperty('resolved');
  });

  test('POST /api/incidents creates an incident (201)', async () => {
    const res = await fetch(`${API_URL}/api/incidents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(validIncident),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toHaveProperty('_id');
    expect(data.title).toBe(validIncident.title);
    expect(data.severity).toBe('high');
    expect(data.status).toBe('open');
    expect(Array.isArray(data.timeline)).toBe(true);
    expect(data.timeline).toHaveLength(1);
    createdIncidentId = data._id;
  });

  test('POST /api/incidents with missing title returns 400', async () => {
    const res = await fetch(`${API_URL}/api/incidents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ severity: 'high' }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty('error');
  });

  test('POST /api/incidents with invalid severity returns 400', async () => {
    const res = await fetch(`${API_URL}/api/incidents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', severity: 'extreme' }),
    });
    expect(res.status).toBe(400);
  });

  test('GET /api/incidents/:id returns the created incident', async () => {
    expect(createdIncidentId).toBeTruthy();
    const res = await fetch(`${API_URL}/api/incidents/${createdIncidentId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data._id).toBe(createdIncidentId);
    expect(data.title).toBe(validIncident.title);
  });

  test('PUT /api/incidents/:id updates status to investigating', async () => {
    expect(createdIncidentId).toBeTruthy();
    const res = await fetch(`${API_URL}/api/incidents/${createdIncidentId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'investigating', note: 'Starting investigation' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('investigating');
    const statusChange = data.timeline.find((t: any) => t.action === 'status_changed');
    expect(statusChange).toBeDefined();
    expect(statusChange.to).toBe('investigating');
  });

  test('PUT /api/incidents/:id with invalid status returns 400', async () => {
    expect(createdIncidentId).toBeTruthy();
    const res = await fetch(`${API_URL}/api/incidents/${createdIncidentId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'destroyed' }),
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/incidents/:id/findings with invalid findingId returns 400', async () => {
    expect(createdIncidentId).toBeTruthy();
    const res = await fetch(`${API_URL}/api/incidents/${createdIncidentId}/findings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ findingId: 'not-a-valid-id' }),
    });
    expect(res.status).toBe(400);
  });

  test('GET /api/incidents with status filter returns filtered results', async () => {
    const res = await fetch(`${API_URL}/api/incidents?status=investigating`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.incidents)).toBe(true);
    for (const inc of data.incidents) {
      expect(inc.status).toBe('investigating');
    }
  });

  test('DELETE /api/incidents/:id removes the incident', async () => {
    expect(createdIncidentId).toBeTruthy();
    const res = await fetch(`${API_URL}/api/incidents/${createdIncidentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toBe(true);
  });

  test('GET /api/incidents/:id after deletion returns 404', async () => {
    expect(createdIncidentId).toBeTruthy();
    const res = await fetch(`${API_URL}/api/incidents/${createdIncidentId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(404);
  });
});
