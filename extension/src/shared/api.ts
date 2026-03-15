import { getVaultToken, getVaultUrl, setVaultTokens, getVaultRefreshToken } from "./storage";
import type { VaultDraft } from "./types";

async function vaultFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const vaultUrl = await getVaultUrl();
  const token = await getVaultToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${vaultUrl}${path}`, { ...options, headers });

  // Auto-refresh on 401
  if (response.status === 401) {
    const refreshToken = await getVaultRefreshToken();
    if (refreshToken) {
      const refreshResp = await fetch(`${vaultUrl}/api/v1/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (refreshResp.ok) {
        const tokens = await refreshResp.json();
        await setVaultTokens(tokens.access_token, tokens.refresh_token);
        headers["Authorization"] = `Bearer ${tokens.access_token}`;
        return fetch(`${vaultUrl}${path}`, { ...options, headers });
      }
    }
  }

  return response;
}

export async function vaultLogin(
  email: string,
  password: string
): Promise<{ access_token: string; refresh_token: string }> {
  const vaultUrl = await getVaultUrl();
  const response = await fetch(`${vaultUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error("Login failed");
  return response.json();
}

export async function postDraft(draft: {
  summary_text: string;
  detail_summary?: string | null;
  candidate_facts_json: Record<string, string> | null;
  suggested_tags_json: string[] | null;
  source_platform: string;
  platform_conversation_id?: string;
}): Promise<VaultDraft> {
  const response = await vaultFetch("/api/v1/drafts/", {
    method: "POST",
    body: JSON.stringify(draft),
  });
  if (!response.ok) throw new Error(`Failed to create draft: ${response.status}`);
  return response.json();
}

export async function getDraftsCount(): Promise<number> {
  const response = await vaultFetch("/api/v1/drafts/");
  if (!response.ok) return 0;
  const drafts: VaultDraft[] = await response.json();
  return drafts.length;
}
