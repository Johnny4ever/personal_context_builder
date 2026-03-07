import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "./auth";

const BASE = "/api/v1";

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let response = await fetch(`${BASE}${path}`, { ...options, headers });

  if (response.status === 401) {
    const refresh = getRefreshToken();
    if (refresh) {
      const refreshResp = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (refreshResp.ok) {
        const tokens = await refreshResp.json();
        setTokens(tokens.access_token, tokens.refresh_token);
        headers["Authorization"] = `Bearer ${tokens.access_token}`;
        response = await fetch(`${BASE}${path}`, { ...options, headers });
      } else {
        clearTokens();
        window.location.href = "/login";
      }
    }
  }

  return response;
}

async function json<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiFetch(path, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

// Auth
export const login = (email: string, password: string) =>
  json<{ access_token: string; refresh_token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const getMe = () => json("/auth/me");

// Drafts
export const getDrafts = () => json<import("./types").Draft[]>("/drafts/");
export const getDraft = (id: number) => json<import("./types").Draft>(`/drafts/${id}`);
export const approveDraft = (
  id: number,
  body: { save_mode: string; summary_text?: string; approved_facts_json?: Record<string, string>; tags_json?: string[] }
) => json<import("./types").Memory>(`/drafts/${id}/approve`, { method: "POST", body: JSON.stringify(body) });
export const dismissDraft = (id: number) =>
  apiFetch(`/drafts/${id}`, { method: "DELETE" });
export const markPrivate = (id: number) =>
  json(`/drafts/${id}/private`, { method: "POST" });

// Memories
export const getMemories = (skip = 0, limit = 20) =>
  json<import("./types").MemoryList>(`/memories/?skip=${skip}&limit=${limit}`);
export const getMemory = (id: number) => json<import("./types").Memory>(`/memories/${id}`);
export const deleteMemory = (id: number) => apiFetch(`/memories/${id}`, { method: "DELETE" });

// Profile
export const getProfile = () => json<import("./types").ProfileFact[]>("/profile/");
export const updateProfileFact = (key: string, value: string) =>
  json<import("./types").ProfileFact>(`/profile/${encodeURIComponent(key)}`, {
    method: "PATCH",
    body: JSON.stringify({ profile_value: value }),
  });

// Tokens
export const getTokens = () => json<import("./types").ApiToken[]>("/tokens/");
export const createToken = (name: string, expiresAt?: string) =>
  json<import("./types").ApiTokenCreated>("/tokens/", {
    method: "POST",
    body: JSON.stringify({ token_name: name, expires_at: expiresAt ?? null }),
  });
export const revokeToken = (id: number) => apiFetch(`/tokens/${id}`, { method: "DELETE" });
