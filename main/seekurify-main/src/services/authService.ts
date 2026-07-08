// src/services/authService.ts

const TOKEN_KEY = 'token';
const SESSION_EXPIRED_EVENT = 'seekurify:session-expired';

export const authService = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  removeToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('googleToken');
  },

  notifySessionExpired(reason: string = 'session_expired') {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { reason } }));
  },

  logout(redirect: boolean = true) {
    this.clearSession();
    if (redirect) {
      window.location.href = '/HomePageBefore';
    }
  },
};

export { SESSION_EXPIRED_EVENT };

/**
 * fetchWithAuth — drop-in replacement for fetch() that:
 *  - Automatically attaches the Bearer token
 *  - On 401/403: fires SESSION_EXPIRED_EVENT → AuthContext logs user out
 *
 * Usage:  const res = await fetchWithAuth('/api/passwords');
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token =
    localStorage.getItem('token') || localStorage.getItem('googleToken');

  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    authService.notifySessionExpired('unauthorized');
  }

  return response;
}
