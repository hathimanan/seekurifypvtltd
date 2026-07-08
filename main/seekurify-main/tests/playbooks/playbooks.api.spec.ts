import * as dotenv from 'dotenv';
import { getAuthToken, API_URL } from '../helpers/api.helper';
dotenv.config({ path: '.env.test' });

let authToken: string;
let createdPlaybookId: string;
let runId: string;

const validPlaybook = {
  name: 'Test Breach Playbook',
  description: 'SOAR test playbook',
  enabled: true,
  trigger: {
    eventType: 'breach_detected',
    conditions: { minBreachCount: 1 },
  },
  steps: [
    {
      order: 0,
      action: 'push_alert',
      label: 'Push test alert',
      params: { message: 'Test breach detected on {{payload.website}}' },
      continueOnError: true,
    },
  ],
};

beforeAll(async () => {
  authToken = await getAuthToken();
});

describe('API — Playbooks', () => {
  test('GET /api/playbooks without auth returns 401', async () => {
    const res = await fetch(`${API_URL}/api/playbooks`);
    expect(res.status).toBe(401);
  });

  test('GET /api/playbooks with valid auth returns playbooks array', async () => {
    const res = await fetch(`${API_URL}/api/playbooks`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('playbooks');
    expect(Array.isArray(data.playbooks)).toBe(true);
    expect(data).toHaveProperty('total');
  });

  test('POST /api/playbooks creates a playbook (201)', async () => {
    const res = await fetch(`${API_URL}/api/playbooks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(validPlaybook),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toHaveProperty('_id');
    expect(data.name).toBe(validPlaybook.name);
    expect(data.trigger.eventType).toBe('breach_detected');
    expect(Array.isArray(data.steps)).toBe(true);
    expect(data.steps).toHaveLength(1);
    createdPlaybookId = data._id;
  });

  test('POST /api/playbooks with missing name returns 400', async () => {
    const res = await fetch(`${API_URL}/api/playbooks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: { eventType: 'breach_detected' } }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data).toHaveProperty('error');
  });

  test('POST /api/playbooks with invalid eventType returns 400', async () => {
    const res = await fetch(`${API_URL}/api/playbooks`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bad', trigger: { eventType: 'not_a_real_event' } }),
    });
    expect(res.status).toBe(400);
  });

  test('GET /api/playbooks/:id returns the created playbook', async () => {
    expect(createdPlaybookId).toBeTruthy();
    const res = await fetch(`${API_URL}/api/playbooks/${createdPlaybookId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data._id).toBe(createdPlaybookId);
    expect(data.steps).toHaveLength(1);
  });

  test('PATCH /api/playbooks/:id/toggle disables the playbook', async () => {
    expect(createdPlaybookId).toBeTruthy();
    const res = await fetch(`${API_URL}/api/playbooks/${createdPlaybookId}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.enabled).toBe(false);
  });

  test('PATCH /api/playbooks/:id/toggle re-enables the playbook', async () => {
    expect(createdPlaybookId).toBeTruthy();
    const res = await fetch(`${API_URL}/api/playbooks/${createdPlaybookId}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.enabled).toBe(true);
  });

  test('POST /api/playbooks/:id/run triggers a run and returns runId', async () => {
    expect(createdPlaybookId).toBeTruthy();
    const res = await fetch(`${API_URL}/api/playbooks/${createdPlaybookId}/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ testPayload: { website: 'test.com', breachCount: 10 } }),
    });
    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data).toHaveProperty('runId');
    expect(data.status).toBe('running');
    runId = data.runId;
  });

  test('GET /api/playbook-runs/:id returns run detail', async () => {
    expect(runId).toBeTruthy();
    // Small wait for async run to save
    await new Promise(r => setTimeout(r, 500));
    const res = await fetch(`${API_URL}/api/playbook-runs/${runId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('_id');
    expect(data).toHaveProperty('triggerEventType');
    expect(Array.isArray(data.stepResults)).toBe(true);
  });

  test('GET /api/playbooks/:id/runs returns run history', async () => {
    expect(createdPlaybookId).toBeTruthy();
    const res = await fetch(`${API_URL}/api/playbooks/${createdPlaybookId}/runs`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('runs');
    expect(Array.isArray(data.runs)).toBe(true);
  });

  test('DELETE /api/playbooks/:id removes the playbook', async () => {
    expect(createdPlaybookId).toBeTruthy();
    const res = await fetch(`${API_URL}/api/playbooks/${createdPlaybookId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.deleted).toBe(true);
  });

  test('GET /api/playbooks/:id after deletion returns 404', async () => {
    expect(createdPlaybookId).toBeTruthy();
    const res = await fetch(`${API_URL}/api/playbooks/${createdPlaybookId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(404);
  });
});
