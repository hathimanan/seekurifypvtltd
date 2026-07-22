import * as dotenv from 'dotenv';
import { getAuthToken, API_URL } from '../helpers/api.helper';
dotenv.config({ path: '.env.test' });

let authToken: string;

const MCP_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
};

async function rpc(body: object, token?: string) {
  const res = await fetch(`${API_URL}/api/mcp`, {
    method: 'POST',
    headers: {
      ...MCP_HEADERS,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return res;
}

async function initialize(token: string) {
  return rpc(
    {
      jsonrpc: '2.0',
      id: 0,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'jest-test-client', version: '1.0.0' },
      },
    },
    token
  );
}

beforeAll(async () => {
  authToken = await getAuthToken();
});

describe('API — MCP Server', () => {
  test('POST /api/mcp without auth returns 401 (plain JSON, not a JSON-RPC envelope)', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toHaveProperty('error');
    expect(data).not.toHaveProperty('jsonrpc');
  });

  test('POST /api/mcp with an invalid token returns 403', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, 'not-a-real-token');
    expect(res.status).toBe(403);
  });

  test('GET /api/mcp returns 405 with a JSON-RPC error envelope', async () => {
    const res = await fetch(`${API_URL}/api/mcp`, { headers: MCP_HEADERS });
    expect(res.status).toBe(405);
    const data = await res.json();
    expect(data.jsonrpc).toBe('2.0');
    expect(data.error.code).toBe(-32000);
  });

  test('DELETE /api/mcp returns 405 with a JSON-RPC error envelope', async () => {
    const res = await fetch(`${API_URL}/api/mcp`, { method: 'DELETE', headers: MCP_HEADERS });
    expect(res.status).toBe(405);
    const data = await res.json();
    expect(data.jsonrpc).toBe('2.0');
    expect(data.error.code).toBe(-32000);
  });

  test('tools/list returns exactly the 4 expected read-only tools', async () => {
    await initialize(authToken);
    const res = await rpc({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, authToken);
    expect(res.status).toBe(200);
    const data = await res.json();
    const names = (data.result?.tools ?? []).map((t: any) => t.name).sort();
    expect(names).toEqual(
      ['ask_security_assistant', 'check_email_breach', 'check_password_breach', 'list_vault_entries'].sort()
    );
  });

  test('check_password_breach with a known HIBP test prefix returns candidate suffixes', async () => {
    await initialize(authToken);
    // "5BAA6" is the SHA-1 prefix for the string "password" — a well-known HIBP test vector.
    const res = await rpc(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'check_password_breach', arguments: { hashPrefix: '5BAA6' } },
      },
      authToken
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    const payload = JSON.parse(data.result.content[0].text);
    expect(Array.isArray(payload.suffixes)).toBe(true);
    expect(payload.suffixes.length).toBeGreaterThan(0);
  });

  test('list_vault_entries never includes the password field, even as a substring', async () => {
    await initialize(authToken);
    const res = await rpc(
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'list_vault_entries', arguments: {} } },
      authToken
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    const rawText: string = data.result.content[0].text;
    expect(rawText).not.toContain('"password"');
  });
});
