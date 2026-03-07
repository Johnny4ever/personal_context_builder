import type { ModelProvider } from "./types";

const KEYS = {
  modelApiKey: "model_api_key",
  modelProvider: "model_provider",
  vaultToken: "vault_token",
  vaultRefreshToken: "vault_refresh_token",
  vaultUrl: "vault_url",
} as const;

export async function getApiKey(): Promise<string | null> {
  const result = await chrome.storage.local.get(KEYS.modelApiKey);
  return result[KEYS.modelApiKey] ?? null;
}

export async function setApiKey(key: string): Promise<void> {
  await chrome.storage.local.set({ [KEYS.modelApiKey]: key });
}

export async function getModelProvider(): Promise<ModelProvider> {
  const result = await chrome.storage.local.get(KEYS.modelProvider);
  return result[KEYS.modelProvider] ?? "openai";
}

export async function setModelProvider(provider: ModelProvider): Promise<void> {
  await chrome.storage.local.set({ [KEYS.modelProvider]: provider });
}

export async function getVaultToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(KEYS.vaultToken);
  return result[KEYS.vaultToken] ?? null;
}

export async function setVaultToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [KEYS.vaultToken]: token });
}

export async function getVaultRefreshToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(KEYS.vaultRefreshToken);
  return result[KEYS.vaultRefreshToken] ?? null;
}

export async function setVaultTokens(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  await chrome.storage.local.set({
    [KEYS.vaultToken]: accessToken,
    [KEYS.vaultRefreshToken]: refreshToken,
  });
}

export async function clearVaultTokens(): Promise<void> {
  await chrome.storage.local.remove([KEYS.vaultToken, KEYS.vaultRefreshToken]);
}

export async function getVaultUrl(): Promise<string> {
  const result = await chrome.storage.local.get(KEYS.vaultUrl);
  return result[KEYS.vaultUrl] ?? "http://localhost:8000";
}

export async function setVaultUrl(url: string): Promise<void> {
  await chrome.storage.local.set({ [KEYS.vaultUrl]: url });
}
