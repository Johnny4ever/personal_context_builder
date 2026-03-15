import { getApiKey, getModelProvider } from "../shared/storage";
import { postDraft } from "../shared/api";
import type { CapturedConversation, DraftSummary, ExtensionMessage } from "../shared/types";

const SENSITIVE_PATTERNS = [
  /password\s*[:=]/i,
  /api[_-]?key\s*[:=]/i,
  /secret\s*[:=]/i,
  /\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b/, // credit card
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
];

function detectSensitiveContent(text: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(text));
}

// Simple hash to deduplicate identical conversation captures
function hashText(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(31, h) + text.charCodeAt(i) | 0;
  }
  return h.toString(16);
}

const CAPTURED_KEY = "captured_hashes";
const CAPTURE_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function isAlreadyCaptured(hash: string): Promise<boolean> {
  const result = await chrome.storage.local.get(CAPTURED_KEY);
  const map: Record<string, number> = result[CAPTURED_KEY] ?? {};
  const now = Date.now();
  return hash in map && now - map[hash] < CAPTURE_TTL_MS;
}

async function markCaptured(hash: string): Promise<void> {
  const result = await chrome.storage.local.get(CAPTURED_KEY);
  const map: Record<string, number> = result[CAPTURED_KEY] ?? {};
  const now = Date.now();
  // Evict old entries
  for (const k of Object.keys(map)) {
    if (now - map[k] >= CAPTURE_TTL_MS) delete map[k];
  }
  map[hash] = now;
  await chrome.storage.local.set({ [CAPTURED_KEY]: map });
}

async function summariseWithOpenAI(
  conversation: CapturedConversation,
  apiKey: string
): Promise<DraftSummary> {
  const prompt = `You are a memory assistant. Summarise the following AI conversation into:
1. A headline: one sentence (≤ 15 words) naming the core topic — used for search
2. A detail: 2-5 sentences covering what was discussed, key decisions, and notable facts or entities — returned to the AI model
3. Key facts about the user as a JSON object (e.g. {"role": "analyst", "skills": "SQL"})
4. Relevant tags as a JSON array (e.g. ["career", "skills"])

Return ONLY valid JSON in this exact format:
{
  "headline": "...",
  "detail": "...",
  "facts": { "key": "value" },
  "tags": ["tag1", "tag2"]
}

Conversation:
User: ${conversation.userMessage}
Assistant: ${conversation.assistantMessage}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  const data = await response.json();
  return JSON.parse(data.choices[0].message.content) as DraftSummary;
}

async function summariseWithAnthropic(
  conversation: CapturedConversation,
  apiKey: string
): Promise<DraftSummary> {
  const prompt = `You are a memory assistant. Summarise the following AI conversation into:
1. A headline: one sentence (≤ 15 words) naming the core topic — used for search
2. A detail: 2-5 sentences covering what was discussed, key decisions, and notable facts or entities
3. Key facts about the user as a JSON object
4. Relevant tags as a JSON array

Return ONLY valid JSON: {"headline": "...", "detail": "...", "facts": {...}, "tags": [...]}

User: ${conversation.userMessage}
Assistant: ${conversation.assistantMessage}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const reason = body?.error?.message ?? JSON.stringify(body);
    throw new Error(`Anthropic ${response.status}: ${reason}`);
  }
  const data = await response.json();
  let text: string = data.content[0].text;
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(text) as DraftSummary;
}

async function summariseWithGemini(
  conversation: CapturedConversation,
  apiKey: string
): Promise<DraftSummary> {
  const prompt = `You are a memory assistant. Summarise the following AI conversation into:
1. A headline: one sentence (≤ 15 words) naming the core topic — used for search
2. A detail: 2-5 sentences covering what was discussed, key decisions, and notable facts or entities
3. Key facts about the user as a JSON object
4. Relevant tags as a JSON array

Return ONLY valid JSON: {"headline": "...", "detail": "...", "facts": {...}, "tags": [...]}

User: ${conversation.userMessage}
Assistant: ${conversation.assistantMessage}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const reason = body?.error?.message ?? JSON.stringify(body);
    throw new Error(`Gemini ${response.status}: ${reason}`);
  }
  const data = await response.json();
  let text: string = data.candidates[0].content.parts[0].text;
  // Strip markdown code fences if present
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  return JSON.parse(text) as DraftSummary;
}

async function handleCapture(
  conversation: CapturedConversation,
  sendResponse: (r: unknown) => void
): Promise<void> {
  const rawText = `${conversation.userMessage}\n${conversation.assistantMessage}`;
  const hash = hashText(rawText);

  if (await isAlreadyCaptured(hash)) {
    sendResponse({
      type: "CAPTURE_FAILED",
      payload: { error: "duplicate", message: "Already captured — continue the conversation to capture new content." },
    });
    return;
  }

  if (detectSensitiveContent(rawText)) {
    sendResponse({
      type: "CAPTURE_FAILED",
      payload: { error: "sensitive_content", message: "Sensitive content detected. Please review before capturing." },
    });
    return;
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    sendResponse({
      type: "CAPTURE_FAILED",
      payload: { error: "no_api_key", message: "No model API key configured. Open the extension popup to set it." },
    });
    return;
  }

  try {
    const provider = await getModelProvider();
    // raw conversation text is summarised HERE in the extension — never sent to vault backend
    let summary: DraftSummary;
    if (provider === "anthropic") {
      summary = await summariseWithAnthropic(conversation, apiKey);
    } else if (provider === "gemini") {
      summary = await summariseWithGemini(conversation, apiKey);
    } else {
      summary = await summariseWithOpenAI(conversation, apiKey);
    }

    // Only the headline, detail, facts, and tags are sent to the vault backend
    const draft = await postDraft({
      summary_text: summary.headline,
      detail_summary: summary.detail,
      candidate_facts_json: summary.facts,
      suggested_tags_json: summary.tags,
      source_platform: conversation.platform,
      platform_conversation_id: conversation.conversationId,
    });

    await markCaptured(hash);
    sendResponse({ type: "CAPTURE_COMPLETE", payload: { draft } });
  } catch (err) {
    sendResponse({
      type: "CAPTURE_FAILED",
      payload: { error: "api_error", message: String(err) },
    });
  }
}

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type === "CAPTURE_REQUESTED") {
      const conversation = message.payload as CapturedConversation;
      handleCapture(conversation, sendResponse);
      return true; // keep message channel open for async response
    }
    return false;
  }
);
