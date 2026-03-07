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

async function summariseWithOpenAI(
  conversation: CapturedConversation,
  apiKey: string
): Promise<DraftSummary> {
  const prompt = `You are a memory assistant. Summarise the following AI conversation into:
1. A concise summary (1-2 sentences)
2. Key facts about the user as a JSON object (e.g. {"role": "analyst", "skills": "SQL"})
3. Relevant tags as a JSON array (e.g. ["career", "skills"])

Return ONLY valid JSON in this exact format:
{
  "summary": "...",
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
1. A concise summary (1-2 sentences)
2. Key facts about the user as a JSON object
3. Relevant tags as a JSON array

Return ONLY valid JSON: {"summary": "...", "facts": {...}, "tags": [...]}

User: ${conversation.userMessage}
Assistant: ${conversation.assistantMessage}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`Anthropic API error: ${response.status}`);
  const data = await response.json();
  return JSON.parse(data.content[0].text) as DraftSummary;
}

async function handleCapture(
  conversation: CapturedConversation,
  sendResponse: (r: unknown) => void
): Promise<void> {
  const rawText = `${conversation.userMessage}\n${conversation.assistantMessage}`;

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
    const summary =
      provider === "anthropic"
        ? await summariseWithAnthropic(conversation, apiKey)
        : await summariseWithOpenAI(conversation, apiKey);

    // Only the summary, facts, and tags are sent to the vault backend
    const draft = await postDraft({
      summary_text: summary.summary,
      candidate_facts_json: summary.facts,
      suggested_tags_json: summary.tags,
      source_platform: conversation.platform,
      platform_conversation_id: conversation.conversationId,
    });

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
