export type SaveMode = "summary_only" | "summary_and_facts" | "full_conversation";
export type DraftStatus = "awaiting_review" | "dismissed" | "private";

export interface User {
  id: number;
  email: string;
  created_at: string;
}

export interface Draft {
  id: number;
  user_id: number;
  summary_text: string;
  candidate_facts_json: Record<string, string> | null;
  suggested_tags_json: string[] | null;
  draft_status: DraftStatus;
  created_at: string;
  reviewed_at: string | null;
  expires_at: string;
}

export interface Memory {
  id: number;
  user_id: number;
  source_platform: string;
  summary_text: string;
  approved_facts_json: Record<string, string> | null;
  tags_json: string[] | null;
  save_mode: SaveMode;
  created_at: string;
  has_embedding: boolean;
}

export interface MemoryList {
  items: Memory[];
  total: number;
}

export interface ProfileFact {
  id: number;
  profile_key: string;
  profile_value: string;
  confidence_score: number | null;
  source_memory_id: number | null;
  updated_at: string;
}

export interface MemoryResult {
  summary: string;
  tags: string[];
  source_platform: string;
  save_mode: string;
  similarity: number;
}

export interface ContextResponse {
  profile_summary: string;
  relevant_memories: MemoryResult[];
}

export interface ApiToken {
  id: number;
  token_name: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
}

export interface ApiTokenCreated extends ApiToken {
  plain_token: string;
}
