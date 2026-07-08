import { authService } from './authService';

export const API_BASE_URL = '/api'; // Vite proxy forwards /api → localhost:5000 in dev; same path works in production

    const FEATURE_FLAGS_ENDPOINT = `${API_BASE_URL}/feature-flags`;


interface LoginCredentials {
  email: string;
  password?: string; // only needed at login
  otp?: string;
  pin?: string;
}

interface SignupCredentials {
  email: string;
  username: string;
  password: string;
}

export interface CreatePasswordSharePayload {
  encryptedData: string;
  iv: string;
  salt?: string;
  expiresAt: string;
  metadata?: {
    website?: string;
    username?: string;
  };
  pin?: string;
}


interface PasswordEntry {
  website: string;
  username: string;
  password: string;
  category?: string;
  notes?: string;
  isFinancial?: boolean;
}

class ApiService {
private handleUnauthorized(message: string = 'Session expired or unauthorized.'): never {
  authService.notifySessionExpired('unauthorized');
  throw new Error(message);
}

private async parseError(response: Response, fallback: string) {
  const contentType = response.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      const error = await response.json();
      return error.error || error.message || fallback;
    }

    const text = await response.text();
    return text.trim() || fallback;
  } catch {
    return fallback;
  }
}

private async parseJson(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(text?.trim() || fallbackMessage);
  }
  return response.json();
}

private normalizePasswords(payload: unknown): PasswordEntry[] {
  if (!Array.isArray(payload)) {
    throw new Error('Invalid password data received from server');
  }

  return payload.map((entry: any) => ({
    ...entry,
    website: typeof entry?.website === 'string' ? entry.website : '',
    username: typeof entry?.username === 'string' ? entry.username : '',
    password: typeof entry?.password === 'string' ? entry.password : '',
    category: typeof entry?.category === 'string' ? entry.category : undefined,
    notes: typeof entry?.notes === 'string' ? entry.notes : '',
    isFinancial: entry?.isFinancial === true,
  }));
}

private getAuthHeaders(): { Authorization: string; 'Content-Type': string } {
  const token = localStorage.getItem('token');
  if (!token) {
    return this.handleUnauthorized('User not authenticated. Token missing.');
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async createPasswordShare(
  passwordId: string,
  payload: CreatePasswordSharePayload
) {
  const token = localStorage.getItem("token");

  if (!token) {
    return this.handleUnauthorized("User not authenticated.");
  }

  const response = await fetch(
    `${API_BASE_URL}/auth/${passwordId}/share`,
    {
      method: "POST",
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    }
  );

  if (response.status === 401) {
    return this.handleUnauthorized('Session expired or unauthorized.');
  }

  if (!response.ok) {
    throw new Error(await this.parseError(response, "Failed to share password"));
  }

  return response.json(); // { shareId }
}



// public access (no auth header)
async getSharedPassword(shareId: string) {
  const response = await fetch(
    `${API_BASE_URL}/auth/share/${shareId}`,
    { method: "GET" }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to access shared password");
  }

  return response.json(); // { encryptedData, iv }
}



async login(credentials: LoginCredentials) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password
    }),
  });

  if (!response.ok) {
    throw new Error(await this.parseError(response, 'Login failed'));
  }

  return await this.parseJson(response, 'Invalid login response'); // returns { message: "Logged in. Proceed to OTP." }
}
async onverifyOtp(email: string, otp: string, otpToken: string) {
  const response = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp, otpToken }), // ✅ Send all three
  });

  if (!response.ok) {
    throw new Error(await this.parseError(response, 'Invalid OTP'));
  }

  return await this.parseJson(response, 'Invalid OTP response'); // { success: true }
}

async verifyPin(email: string, pin: string) {
  const response = await fetch(`${API_BASE_URL}/auth/verify-pin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, pin }),
  });

  const data = await this.parseJson(response, 'Invalid PIN response'); // parse **once**

  if (!response.ok) {
    throw new Error(data.error || 'Invalid PIN');
  }

  if (data.token) {
    localStorage.setItem('token', data.token);
  }

  return data;
}



  async signup(credentials: SignupCredentials) {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Signup failed');
    }

    return response.json();
  }

    async getUserDetails(email: string) {
        const token = localStorage.getItem('token');
    const res = await fetch(`/api/user/?email=${email}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
      }
    );
    if (!res.ok) throw new Error("User fetch failed");
    return res.json();
  }

  async getDashboard() {
    const response = await fetch(`${API_BASE_URL}/dashboard`, {
      headers: this.getAuthHeaders()
    });

    if (response.status === 401) {
      return this.handleUnauthorized('Session expired or unauthorized.');
    }

    if (!response.ok) {
      throw new Error(await this.parseError(response, 'Failed to fetch dashboard'));
    }

    return response.json();
  }




async getPasswords(cacheBuster?: number) {
  const token = localStorage.getItem('token');

  if (!token) {
    return this.handleUnauthorized('User not authenticated. Token missing.');
  }

      const url = cacheBuster
    ? `${API_BASE_URL}/passwords?t=${cacheBuster}`
    : `${API_BASE_URL}/passwords`;

  const response = await fetch(url, {
    method: 'GET',
    headers: this.getAuthHeaders(),
     cache: 'no-store',
  });

  if (response.status === 401) {
    return this.handleUnauthorized('Session expired or unauthorized.');
  }

  if (!response.ok) {
    throw new Error(await this.parseError(response, 'Failed to fetch passwords'));
  }

  return this.normalizePasswords(await response.json());
}


async getSIEMEvents() {
  const response = await fetch(`${API_BASE_URL}/siem/events`, {
    method: "GET",
    headers: this.getAuthHeaders(),
  });

  if (response.status === 401) {
    return this.handleUnauthorized('Session expired or unauthorized.');
  }

  if (!response.ok) {
    throw new Error(await this.parseError(response, "Failed to fetch SIEM events"));
  }

  return response.json();
}


  async addPassword(passwordData: PasswordEntry) {
    const response = await fetch(`${API_BASE_URL}/passwords`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(passwordData)
    });

    if (response.status === 401) {
      return this.handleUnauthorized('Session expired or unauthorized.');
    }

    if (!response.ok) {
      throw new Error(await this.parseError(response, 'Failed to add password'));
    }

    const saved = await response.json();
    window.postMessage({ skBridge: true, payload: { type: 'VAULT_UPDATED', action: 'add', entry: { ...saved, password: passwordData.password } } }, '*');
    return saved;
  }


async detectPhishing(emailContent: string) {
  // Debug: Log to see if the method is even being called
  console.log("Attempting to scan:", emailContent.substring(0, 20) + "...");

  const response = await fetch(`${API_BASE_URL}/detect-attacker`, {
    method: 'POST',
    headers: this.getAuthHeaders(), // Ensure this returns { 'Content-Type': 'application/json', ... }
    body: JSON.stringify({ emailContent })
  });

  if (response.status === 401) {
    return this.handleUnauthorized('Session expired or unauthorized.');
  }

  if (!response.ok) {
    throw new Error(await this.parseError(response, 'Backend failed to respond'));
  }

  return response.json();
}

async updatePassword(id: string, passwordData: PasswordEntry & { currentPassword: string }) {
  const token = localStorage.getItem('token');

  if (!token) {
    return this.handleUnauthorized('User not authenticated.');
  }

  const response = await fetch(`${API_BASE_URL}/passwords/${id}`, {
    method: 'PUT',
    headers: this.getAuthHeaders(),
    body: JSON.stringify(passwordData)
  });

  if (response.status === 401) {
    return this.handleUnauthorized('Session expired or unauthorized.');
  }

  if (response.status === 403) {
    throw new Error(await this.parseError(response, 'Forbidden request'));
  }

  if (!response.ok) {
    throw new Error(await this.parseError(response, 'Failed to update password'));
  }

  const updated = await response.json();
  window.postMessage({ skBridge: true, payload: { type: 'VAULT_UPDATED', action: 'update', entry: { ...updated, password: passwordData.password } } }, '*');
  return updated;
}

async deletePassword(id: string) {
  const token = localStorage.getItem('token');
  if (!token) {
    return this.handleUnauthorized('User not authenticated. Token missing.')
  }

  const resp = await fetch(`${API_BASE_URL}/passwords/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (resp.status === 401) {
    return this.handleUnauthorized('Session expired or unauthorized.');
  }

  if (!resp.ok) {
    throw new Error(await this.parseError(resp, 'Failed to delete password'));
  }

  // Notify the extension side panel to remove the entry instantly
  window.postMessage({ skBridge: true, payload: { type: 'VAULT_UPDATED', action: 'delete', id } }, '*');

  const contentType = resp.headers.get('content-type') || '';
  if (resp.status === 204 || !contentType.includes('application/json')) return;
  return resp.json();
}



 async getFlags(token: string) {
  const res = await fetch(FEATURE_FLAGS_ENDPOINT, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 401) {
    return this.handleUnauthorized('Session expired or unauthorized.');
  }
  return res.json();
}


async toggleFlag(token: string, key: string, payload: { enabled: boolean; rolloutPercentage: number }) {
  const res = await fetch(`${API_BASE_URL}/feature-flags/toggle`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ key, ...payload })
  });
  if (res.status === 401) {
    return this.handleUnauthorized('Session expired or unauthorized.');
  }
  return res.json();
}



  // Score all stored credentials using the risk engine.
  // Returns RiskScoreResult[] ordered to match the stored vault.
  async scoreAllCredentials(): Promise<{
    _id: string;
    score: number;
    level: string;
    factors: Record<string, number>;
    reasons: string[];
    summary: string;
  }[]> {
    const response = await fetch(`${API_BASE_URL}/risk-score/score-all`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    if (response.status === 401 || response.status === 403) {
      return this.handleUnauthorized('Session expired. Please log in again.');
    }
    if (!response.ok) {
      throw new Error(await this.parseError(response, 'Risk scoring failed'));
    }
    const data = await response.json();
    return data.results;
  }

  // Check all stored passwords for breaches via HIBP k-anonymity (server-side SHA-1 hashing).
  // Returns [{ _id, isBreached, breachCount }]
  async checkAllBreaches(): Promise<{ _id: string; isBreached: boolean; breachCount: number }[]> {
    const response = await fetch(`${API_BASE_URL}/hibp/check-all`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    if (response.status === 401 || response.status === 403) {
      return this.handleUnauthorized('Session expired. Please log in again.');
    }
    if (!response.ok) {
      throw new Error(await this.parseError(response, 'Breach check failed'));
    }
    const data = await response.json();
    return data.results;
  }

  // Check the authenticated user's email against HIBP breached accounts.
  // Returns [{ Name, Title, BreachDate, PwnCount, DataClasses }]
  async checkEmailBreaches(): Promise<{ Name: string; Title: string; BreachDate: string; PwnCount: number; DataClasses: string[] }[]> {
    const response = await fetch(`${API_BASE_URL}/hibp/check-email`, {
      headers: this.getAuthHeaders(),
    });
    if (response.status === 401 || response.status === 403) {
      return this.handleUnauthorized('Session expired. Please log in again.');
    }
    if (!response.ok) {
      throw new Error(await this.parseError(response, 'Email breach check failed'));
    }
    const data = await response.json();
    return data.breaches;
  }

  // Fetch recent notifications + unread count for the current user.
  async getNotifications(): Promise<{
    notifications: { _id: string; message: string; type: string; read: boolean; createdAt: string }[];
    unreadCount: number;
  }> {
    const response = await fetch(`${API_BASE_URL}/notifications`, {
      headers: this.getAuthHeaders(),
    });
    if (response.status === 401 || response.status === 403) {
      return this.handleUnauthorized('Session expired.');
    }
    if (!response.ok) throw new Error(await this.parseError(response, 'Failed to fetch notifications'));
    return response.json();
  }

  // Poll just the unread count — lightweight, safe to call on an interval.
  async getUnreadNotificationCount(): Promise<number> {
    const response = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
      headers: this.getAuthHeaders(),
    });
    if (!response.ok) return 0;
    const data = await response.json();
    return data.count ?? 0;
  }

  // Mark specific notifications (or ALL if ids is empty) as read.
  async markNotificationsRead(ids: string[] = []): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/notifications/mark-read`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ ids }),
    });
    if (!response.ok) throw new Error(await this.parseError(response, 'Failed to mark notifications read'));
  }

  // ── SOAR: Playbooks ────────────────────────────────────────────────────────
  async getPlaybooks(workspaceId?: string) {
    const url = workspaceId ? `${API_BASE_URL}/playbooks?workspaceId=${workspaceId}` : `${API_BASE_URL}/playbooks`;
    const res = await fetch(url, { headers: this.getAuthHeaders() });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to fetch playbooks'));
    return res.json();
  }

  async createPlaybook(data: Record<string, unknown>) {
    const res = await fetch(`${API_BASE_URL}/playbooks`, {
      method: 'POST', headers: this.getAuthHeaders(), body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to create playbook'));
    return res.json();
  }

  async updatePlaybook(id: string, data: Record<string, unknown>) {
    const res = await fetch(`${API_BASE_URL}/playbooks/${id}`, {
      method: 'PUT', headers: this.getAuthHeaders(), body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to update playbook'));
    return res.json();
  }

  async togglePlaybook(id: string, enabled: boolean) {
    const res = await fetch(`${API_BASE_URL}/playbooks/${id}/toggle`, {
      method: 'PATCH', headers: this.getAuthHeaders(), body: JSON.stringify({ enabled }),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to toggle playbook'));
    return res.json();
  }

  async deletePlaybook(id: string) {
    const res = await fetch(`${API_BASE_URL}/playbooks/${id}`, {
      method: 'DELETE', headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to delete playbook'));
    return res.json();
  }

  async runPlaybook(id: string, testPayload?: Record<string, unknown>) {
    const res = await fetch(`${API_BASE_URL}/playbooks/${id}/run`, {
      method: 'POST', headers: this.getAuthHeaders(), body: JSON.stringify({ testPayload: testPayload || {} }),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to run playbook'));
    return res.json();
  }

  async getPlaybookRuns(params?: { playbookId?: string; status?: string; page?: number }) {
    const q = new URLSearchParams();
    if (params?.playbookId) q.set('playbookId', params.playbookId);
    if (params?.status) q.set('status', params.status);
    if (params?.page) q.set('page', String(params.page));
    const res = await fetch(`${API_BASE_URL}/playbook-runs?${q}`, { headers: this.getAuthHeaders() });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to fetch playbook runs'));
    return res.json();
  }

  async getPlaybookRun(id: string) {
    const res = await fetch(`${API_BASE_URL}/playbook-runs/${id}`, { headers: this.getAuthHeaders() });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to fetch playbook run'));
    return res.json();
  }

  async getRunsForPlaybook(playbookId: string, limit = 20) {
    const res = await fetch(`${API_BASE_URL}/playbooks/${playbookId}/runs?limit=${limit}`, { headers: this.getAuthHeaders() });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to fetch runs'));
    return res.json();
  }

  // ── SOAR: Incidents ────────────────────────────────────────────────────────
  async getIncidents(params?: { status?: string; severity?: string; category?: string; page?: number }) {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.severity) q.set('severity', params.severity);
    if (params?.category) q.set('category', params.category);
    if (params?.page) q.set('page', String(params.page));
    const res = await fetch(`${API_BASE_URL}/incidents?${q}`, { headers: this.getAuthHeaders() });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to fetch incidents'));
    return res.json();
  }

  async getIncidentStats() {
    const res = await fetch(`${API_BASE_URL}/incidents/stats`, { headers: this.getAuthHeaders() });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to fetch incident stats'));
    return res.json();
  }

  async createIncident(data: Record<string, unknown>) {
    const res = await fetch(`${API_BASE_URL}/incidents`, {
      method: 'POST', headers: this.getAuthHeaders(), body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to create incident'));
    return res.json();
  }

  async getIncident(id: string) {
    const res = await fetch(`${API_BASE_URL}/incidents/${id}`, { headers: this.getAuthHeaders() });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to fetch incident'));
    return res.json();
  }

  async updateIncident(id: string, data: Record<string, unknown>) {
    const res = await fetch(`${API_BASE_URL}/incidents/${id}`, {
      method: 'PUT', headers: this.getAuthHeaders(), body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to update incident'));
    return res.json();
  }

  async deleteIncident(id: string) {
    const res = await fetch(`${API_BASE_URL}/incidents/${id}`, {
      method: 'DELETE', headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to delete incident'));
    return res.json();
  }

  async addFindingToIncident(incidentId: string, findingId: string) {
    const res = await fetch(`${API_BASE_URL}/incidents/${incidentId}/findings`, {
      method: 'POST', headers: this.getAuthHeaders(), body: JSON.stringify({ findingId }),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to attach finding'));
    return res.json();
  }

  async removeFindingFromIncident(incidentId: string, findingId: string) {
    const res = await fetch(`${API_BASE_URL}/incidents/${incidentId}/findings/${findingId}`, {
      method: 'DELETE', headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to detach finding'));
    return res.json();
  }

  // ── SOAR: Integrations ─────────────────────────────────────────────────────
  async getIntegrations(type?: 'slack' | 'jira' | 'webhook') {
    const url = type ? `${API_BASE_URL}/integrations?type=${type}` : `${API_BASE_URL}/integrations`;
    const res = await fetch(url, { headers: this.getAuthHeaders() });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to fetch integrations'));
    return res.json();
  }

  async createIntegration(data: { name: string; type: string; config: Record<string, unknown>; workspaceId?: string | null }) {
    const res = await fetch(`${API_BASE_URL}/integrations`, {
      method: 'POST', headers: this.getAuthHeaders(), body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to create integration'));
    return res.json();
  }

  async updateIntegration(id: string, data: Partial<{ name: string; type: string; config: Record<string, unknown>; workspaceId: string | null; enabled: boolean }>) {
    const res = await fetch(`${API_BASE_URL}/integrations/${id}`, {
      method: 'PUT', headers: this.getAuthHeaders(), body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to update integration'));
    return res.json();
  }

  async deleteIntegration(id: string) {
    const res = await fetch(`${API_BASE_URL}/integrations/${id}`, {
      method: 'DELETE', headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to delete integration'));
    return res.json();
  }

  async testIntegration(id: string): Promise<{ ok: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/integrations/${id}/test`, {
      method: 'POST', headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to test integration'));
    return res.json();
  }

  async getScanJobs(page = 1, limit = 20) {
    const res = await fetch(`${API_BASE_URL}/scan-jobs?page=${page}&limit=${limit}`, {
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to fetch scan jobs'));
    return res.json();
  }

  async getScanJob(id: string) {
    const res = await fetch(`${API_BASE_URL}/scan-jobs/${id}`, { headers: this.getAuthHeaders() });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to fetch scan job'));
    return res.json();
  }

  async runScanJob() {
    const res = await fetch(`${API_BASE_URL}/scan-jobs/run`, {
      method: 'POST', headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to start scan'));
    return res.json();
  }

  logout() {
    authService.clearSession();
  }

  isAuthenticated() {
    return !!localStorage.getItem('token');
  }

  // ── Firewall ──────────────────────────────────────────────────────────────────
  async getFirewallRules() {
    const res = await fetch(`${API_BASE_URL}/firewall/rules`, { headers: this.getAuthHeaders() });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to fetch rules'));
    return res.json();
  }

  async createFirewallRule(data: Record<string, unknown>) {
    const res = await fetch(`${API_BASE_URL}/firewall/rules`, {
      method: 'POST', headers: this.getAuthHeaders(), body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to create rule'));
    return res.json();
  }

  async updateFirewallRule(id: string, data: Record<string, unknown>) {
    const res = await fetch(`${API_BASE_URL}/firewall/rules/${id}`, {
      method: 'PUT', headers: this.getAuthHeaders(), body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to update rule'));
    return res.json();
  }

  async toggleFirewallRule(id: string, enabled: boolean) {
    const res = await fetch(`${API_BASE_URL}/firewall/rules/${id}/toggle`, {
      method: 'PATCH', headers: this.getAuthHeaders(), body: JSON.stringify({ enabled }),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to toggle rule'));
    return res.json();
  }

  async deleteFirewallRule(id: string) {
    const res = await fetch(`${API_BASE_URL}/firewall/rules/${id}`, {
      method: 'DELETE', headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to delete rule'));
    return res.json();
  }

  async inspectRequest(data: Record<string, unknown>) {
    const res = await fetch(`${API_BASE_URL}/firewall/inspect`, {
      method: 'POST', headers: this.getAuthHeaders(), body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await this.parseError(res, 'Inspection failed'));
    return res.json();
  }

  async getFirewallEvents(params?: { verdict?: string; severity?: string; page?: number }) {
    const q = new URLSearchParams();
    if (params?.verdict)  q.set('verdict',  params.verdict);
    if (params?.severity) q.set('severity', params.severity);
    if (params?.page)     q.set('page',     String(params.page));
    const res = await fetch(`${API_BASE_URL}/firewall/events?${q}`, { headers: this.getAuthHeaders() });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to fetch events'));
    return res.json();
  }

  async getFirewallStats() {
    const res = await fetch(`${API_BASE_URL}/firewall/stats`, { headers: this.getAuthHeaders() });
    if (!res.ok) throw new Error(await this.parseError(res, 'Failed to fetch stats'));
    return res.json();
  }
}

export const apiService = new ApiService();
