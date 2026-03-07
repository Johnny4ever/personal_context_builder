import type { CapturedConversation, ExtensionMessage } from "../shared/types";

function extractLastExchange(): CapturedConversation | null {
  // ChatGPT conversation turns — selector may need updating if DOM changes
  const turns = document.querySelectorAll('article[data-testid^="conversation-turn"]');
  if (turns.length < 2) return null;

  let lastUserMsg = "";
  let lastAssistantMsg = "";

  turns.forEach((turn) => {
    const isUser = turn.getAttribute("data-testid")?.includes("user");
    const text = (turn as HTMLElement).innerText.trim();
    if (isUser) {
      lastUserMsg = text;
    } else {
      lastAssistantMsg = text;
    }
  });

  if (!lastUserMsg && !lastAssistantMsg) return null;

  // Attempt to get conversation ID from URL
  const match = window.location.pathname.match(/\/c\/([a-zA-Z0-9-]+)/);
  const conversationId = match?.[1];

  return {
    platform: "chatgpt",
    userMessage: lastUserMsg,
    assistantMessage: lastAssistantMsg,
    conversationId,
  };
}

function injectCaptureButton(): void {
  if (document.getElementById("vault-capture-btn")) return;

  const btn = document.createElement("button");
  btn.id = "vault-capture-btn";
  btn.textContent = "Capture to Vault";
  btn.style.cssText = `
    position: fixed;
    bottom: 80px;
    right: 20px;
    z-index: 9999;
    background: #2563eb;
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

  const message: ExtensionMessage = {
    type: "CAPTURE_REQUESTED",
    payload: conversation,
  };

  chrome.runtime.sendMessage(message, (response: ExtensionMessage) => {
    if (response?.type === "CAPTURE_COMPLETE") {
      showToast("Saved to review queue in vault!", "success");
    } else if (response?.type === "CAPTURE_FAILED") {
      const payload = response.payload as { message: string };
      showToast(payload.message || "Capture failed", "error");
    }
  });
}

function showToast(message: string, type: "success" | "error" | "warning"): void {
  const colours = { success: "#166534", error: "#991b1b", warning: "#713f12" };
  const bg = { success: "#dcfce7", error: "#fee2e2", warning: "#fef9c3" };

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

// Page leave prompt
window.addEventListener("beforeunload", (event) => {
  const conversation = extractLastExchange();
  if (conversation) {
    event.preventDefault();
    chrome.runtime.sendMessage({ type: "PAGE_LEAVE_CAPTURE_PROMPT", payload: conversation });
  }
});

// Wait for DOM to settle before injecting button
setTimeout(injectCaptureButton, 2000);

// Re-inject on SPA navigation
const observer = new MutationObserver(() => {
  if (!document.getElementById("vault-capture-btn")) {
    setTimeout(injectCaptureButton, 1000);
  }
});
observer.observe(document.body, { childList: true, subtree: true });
