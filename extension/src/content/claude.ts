import type { CapturedConversation, ExtensionMessage } from "../shared/types";

function extractLastExchange(): CapturedConversation | null {
  // Claude uses different selectors — these may need updating if DOM changes.
  // Fallback approach: look for human and assistant turn containers.
  const humanTurns = document.querySelectorAll('[data-testid="human-turn"], .human-turn, [class*="HumanTurn"]');
  const assistantTurns = document.querySelectorAll('[data-testid="ai-turn"], .assistant-turn, [class*="AssistantTurn"]');

  if (humanTurns.length === 0 && assistantTurns.length === 0) {
    // Generic fallback: scan for alternating message blocks
    return extractFallback();
  }

  const lastUser = humanTurns[humanTurns.length - 1] as HTMLElement | undefined;
  const lastAssistant = assistantTurns[assistantTurns.length - 1] as HTMLElement | undefined;

  if (!lastUser && !lastAssistant) return null;

  const match = window.location.pathname.match(/\/chat\/([a-zA-Z0-9-]+)/);

  return {
    platform: "claude",
    userMessage: lastUser?.innerText.trim() ?? "",
    assistantMessage: lastAssistant?.innerText.trim() ?? "",
    conversationId: match?.[1],
  };
}

function extractFallback(): CapturedConversation | null {
  // Last-resort: get all text content from the main chat area
  const chatArea = document.querySelector("main") ?? document.body;
  const text = (chatArea as HTMLElement).innerText.trim();
  if (!text) return null;
  return {
    platform: "claude",
    userMessage: "(full page text — selector update needed)",
    assistantMessage: text.slice(-2000),
  };
}

function injectCaptureButton(): void {
  if (document.getElementById("vault-capture-btn-claude")) return;

  const btn = document.createElement("button");
  btn.id = "vault-capture-btn-claude";
  btn.textContent = "Capture to Vault";
  btn.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    z-index: 9999;
    background: #7c3aed;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 13px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  `;

  btn.addEventListener("click", triggerCapture);
  document.body.appendChild(btn);
}

function triggerCapture(): void {
  const conversation = extractLastExchange();
  if (!conversation) {
    alert("No conversation found to capture.");
    return;
  }

  chrome.runtime.sendMessage(
    { type: "CAPTURE_REQUESTED", payload: conversation } as ExtensionMessage,
    (response: ExtensionMessage) => {
      if (response?.type === "CAPTURE_COMPLETE") {
        showToast("Saved to review queue in vault!", "success");
      } else if (response?.type === "CAPTURE_FAILED") {
        const payload = response.payload as { message: string };
        showToast(payload.message || "Capture failed", "error");
      }
    }
  );
}

function showToast(message: string, type: "success" | "error"): void {
  const colours = { success: "#166534", error: "#991b1b" };
  const bg = { success: "#dcfce7", error: "#fee2e2" };

  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 140px;
    right: 20px;
    z-index: 10000;
    background: ${bg[type]};
    color: ${colours[type]};
    border-radius: 8px;
    padding: 10px 16px;
    font-size: 13px;
    font-family: system-ui, sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    max-width: 280px;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

window.addEventListener("beforeunload", () => {
  const conversation = extractLastExchange();
  if (conversation) {
    chrome.runtime.sendMessage({ type: "PAGE_LEAVE_CAPTURE_PROMPT", payload: conversation });
  }
});

setTimeout(injectCaptureButton, 2000);

const observer = new MutationObserver(() => {
  if (!document.getElementById("vault-capture-btn-claude")) {
    setTimeout(injectCaptureButton, 1000);
  }
});
observer.observe(document.body, { childList: true, subtree: true });
