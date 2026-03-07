export type ModelProvider = "openai" | "anthropic";

export interface CapturedConversation {
  platform: string;
  userMessage: string;
  assistantMessage: string;
  conversationId?: string;
}

export interface DraftSummary {
  summary: string;
  facts: Record<string, string>;
  tags: string[];
}

export interface VaultDraft {
  id: number;
  summary_text: string;
  candidate_facts_json: Record<string, string> | null;
  suggested_tags_json: string[] | null;
  draft_status: string;
  expires_at: string;
}

export type MessageType =
  | "CAPTURE_REQUESTED"
  | "CAPTURE_COMPLETE"
  | "CAPTURE_FAILED"
  | "PAGE_LEAVE_CAPTURE_PROMPT"
  | "GET_DRAFTS_COUNT";

export interface ExtensionMessage {
  type: MessageType;
  payload?: unknown;
}
