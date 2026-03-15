import {
  getApiKey, setApiKey,
  getModelProvider, setModelProvider,
  getVaultUrl, setVaultUrl,
  getVaultToken, setVaultTokens, clearVaultTokens,
} from "../shared/storage";
import { vaultLogin, getDraftsCount } from "../shared/api";
import type { ModelProvider } from "../shared/types";

// Safe DOM helpers — no innerHTML with user content
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (HTMLElement | Text | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, v);
  }
  for (const child of children) {
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function div(cls: string, ...children: (HTMLElement | Text | string)[]): HTMLDivElement {
  return el("div", { class: cls }, ...children);
}

async function render(): Promise<void> {
  const app = document.getElementById("app")!;
  app.textContent = ""; // safe clear

  const vaultUrl = await getVaultUrl();
  const apiKey = await getApiKey();
  const provider = await getModelProvider();
  const token = await getVaultToken();
  const draftsCount = token ? await getDraftsCount().catch(() => 0) : 0;

  // Status / drafts section
  if (token) {
    const countText = draftsCount > 0
      ? `${draftsCount} draft${draftsCount > 1 ? "s" : ""} awaiting review`
      : "No pending drafts";
    const dashboardUrl = (() => { try { const u = new URL(vaultUrl); u.port = "3000"; u.pathname = "/"; return u.toString(); } catch { return "http://localhost:3000"; } })();
    const link = el("a", { href: dashboardUrl, target: "_blank" }, "Open dashboard →");
    app.append(
      div("section",
        div("drafts-count", countText),
        link,
      )
    );
  } else {
    app.append(div("section", div("status info", "Not logged in to vault")));
  }

  // Vault URL field
  const urlInput = el("input", { id: "vault-url", type: "text", placeholder: "http://localhost:8000" });
  urlInput.value = vaultUrl;
  app.append(div("section", el("label", {}, "Vault URL"), urlInput));

  // Login section
  if (!token) {
    const emailInput = el("input", { id: "vault-email", type: "email", placeholder: "you@example.com" });
    const passInput = el("input", { id: "vault-password", type: "password", placeholder: "••••••••" });
    const loginBtn = el("button", { class: "btn-primary", id: "login-btn" }, "Log in to Vault");
    const loginStatus = div("", "");
    loginStatus.id = "login-status";
    app.append(
      div("section",
        el("label", {}, "Email"), emailInput,
        div("gap", el("label", {}, "Password"), passInput),
        div("gap", loginBtn),
        loginStatus,
      )
    );
  } else {
    const logoutBtn = el("button", { class: "btn-secondary", id: "logout-btn" }, "Log out of Vault");
    app.append(div("section", logoutBtn));
  }

  // Provider select
  const providerSelect = el("select", { id: "provider-select" });
  for (const [val, label] of [["openai", "OpenAI"], ["anthropic", "Anthropic (Claude)"], ["gemini", "Google Gemini (free)"]] as const) {
    const opt = el("option", { value: val }, label);
    if (provider === val) opt.selected = true;
    providerSelect.append(opt);
  }
  app.append(div("section", el("label", {}, "Model provider"), providerSelect));

  // API key
  const apiKeyInput = el("input", { id: "api-key", type: "password", placeholder: "sk-..." });
  apiKeyInput.value = apiKey ?? "";
  const saveBtn = el("button", { class: "btn-secondary", id: "save-settings-btn" }, "Save settings");
  const settingsStatus = div("", "");
  settingsStatus.id = "settings-status";
  app.append(div("section", el("label", {}, "Model API Key"), apiKeyInput, div("gap", saveBtn), settingsStatus));

  // Capture button (only when logged in)
  if (token) {
    const captureBtn = el("button", { class: "btn-primary", id: "capture-btn" }, "Capture current page");
    const captureStatus = div("", "");
    captureStatus.id = "capture-status";
    app.append(div("section", captureBtn, captureStatus));
  }

  bindEvents(!!token);
}

function setStatus(id: string, cls: string, text: string): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `status ${cls}`;
  el.textContent = text;
}

function bindEvents(isLoggedIn: boolean): void {
  document.getElementById("save-settings-btn")?.addEventListener("click", async () => {
    const apiKey = (document.getElementById("api-key") as HTMLInputElement).value.trim();
    const provider = (document.getElementById("provider-select") as HTMLSelectElement).value as ModelProvider;
    const vaultUrl = (document.getElementById("vault-url") as HTMLInputElement).value.trim();
    await setApiKey(apiKey);
    await setModelProvider(provider);
    await setVaultUrl(vaultUrl);
    setStatus("settings-status", "success", "Settings saved");
    setTimeout(() => setStatus("settings-status", "", ""), 2000);
  });

  if (!isLoggedIn) {
    document.getElementById("login-btn")?.addEventListener("click", async () => {
      const email = (document.getElementById("vault-email") as HTMLInputElement).value;
      const password = (document.getElementById("vault-password") as HTMLInputElement).value;
      const vaultUrl = (document.getElementById("vault-url") as HTMLInputElement).value.trim();
      await setVaultUrl(vaultUrl);
      try {
        const tokens = await vaultLogin(email, password);
        await setVaultTokens(tokens.access_token, tokens.refresh_token);
        setStatus("login-status", "success", "Logged in!");
        setTimeout(() => render().catch(() => {}), 800);
      } catch {
        setStatus("login-status", "error", "Login failed — check credentials and vault URL");
      }
    });
  } else {
    document.getElementById("logout-btn")?.addEventListener("click", async () => {
      await clearVaultTokens();
      render().catch(() => {});
    });

    document.getElementById("capture-btn")?.addEventListener("click", async () => {
      setStatus("capture-status", "info", "Capturing…");
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      chrome.tabs.sendMessage(tab.id, { type: "CAPTURE_REQUESTED" }, (response) => {
        if (chrome.runtime.lastError) {
          setStatus("capture-status", "error", "No supported AI page detected");
          return;
        }
        if (response?.type === "CAPTURE_COMPLETE") {
          setStatus("capture-status", "success", "Captured! Check your drafts.");
          setTimeout(() => render().catch(() => {}), 1500);
        } else {
          const msg = response?.payload?.message ?? "Capture failed";
          setStatus("capture-status", "error", msg);
        }
      });
    });
  }
}

render().catch((err) => {
  const app = document.getElementById("app")!;
  app.textContent = `Error: ${err.message}`;
});
