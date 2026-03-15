"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getDrafts, approveDraft, dismissDraft, markPrivate } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import type { Draft, SaveMode } from "@/lib/types";

const NAV_LINKS = [
  { href: "/drafts", label: "Drafts" },
  { href: "/memories", label: "Memories" },
  { href: "/profile", label: "Profile" },
  { href: "/tokens", label: "Tokens" },
];

export default function DraftsPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    getDrafts().then(setDrafts).finally(() => setLoading(false));
  }, [router]);

  async function approve(draft: Draft, saveMode: SaveMode, headline: string, detail: string) {
    setActionId(draft.id);
    try {
      await approveDraft(draft.id, {
        save_mode: saveMode,
        summary_text: headline,
        detail_summary: detail || null,
      });
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    } finally { setActionId(null); }
  }

  async function dismiss(id: number) {
    setActionId(id);
    try {
      await dismissDraft(id);
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } finally { setActionId(null); }
  }

  async function markDraftPrivate(id: number) {
    setActionId(id);
    try {
      await markPrivate(id);
      setDrafts((prev) => prev.filter((d) => d.id !== id));
    } finally { setActionId(null); }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <nav style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {NAV_LINKS.map((l) => (
          <a key={l.href} href={l.href} style={{ color: "#2563eb", textDecoration: "none", fontWeight: l.href === "/drafts" ? 700 : 400 }}>{l.label}</a>
        ))}
      </nav>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Drafts ({drafts.length})</h1>
      {loading && <p>Loading…</p>}
      {!loading && drafts.length === 0 && <p style={{ color: "#6b7280" }}>No pending drafts.</p>}
      {drafts.map((draft) => (
        <DraftCard
          key={draft.id}
          draft={draft}
          loading={actionId === draft.id}
          onApprove={(mode, headline, detail) => approve(draft, mode, headline, detail)}
          onDismiss={() => dismiss(draft.id)}
          onPrivate={() => markDraftPrivate(draft.id)}
        />
      ))}
    </div>
  );
}

function DraftCard({
  draft, loading, onApprove, onDismiss, onPrivate,
}: {
  draft: Draft;
  loading: boolean;
  onApprove: (mode: SaveMode, headline: string, detail: string) => void;
  onDismiss: () => void;
  onPrivate: () => void;
}) {
  const [saveMode, setSaveMode] = useState<SaveMode>("summary_only");
  const [headline, setHeadline] = useState(draft.summary_text);
  const [detail, setDetail] = useState(draft.detail_summary ?? "");
  const expiresAt = new Date(draft.expires_at);
  const expiresHours = Math.round((expiresAt.getTime() - Date.now()) / 3_600_000);

  return (
    <div style={{ background: "white", borderRadius: 8, padding: 20, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: "#6b7280" }}>{draft.expires_at ? `Expires in ${expiresHours}h` : ""}</span>
        <span style={{ fontSize: 12, background: "#dbeafe", color: "#1e40af", borderRadius: 4, padding: "2px 6px" }}>awaiting review</span>
      </div>

      {/* Headline field */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Headline — used for search</label>
        <input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          style={{ width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 4, fontSize: 13, boxSizing: "border-box" }}
        />
      </div>

      {/* Detail field */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Details — returned to AI</label>
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={4}
          placeholder="No detail summary — the headline will be used."
          style={{ width: "100%", padding: "6px 8px", border: "1px solid #ddd", borderRadius: 4, fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
        />
      </div>

      {draft.candidate_facts_json && Object.keys(draft.candidate_facts_json).length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Extracted facts</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(draft.candidate_facts_json).map(([k, v]) => (
              <span key={k} style={{ background: "#f3f4f6", borderRadius: 4, padding: "2px 8px", fontSize: 12 }}>{k}: {typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
            ))}
          </div>
        </div>
      )}
      {draft.suggested_tags_json && draft.suggested_tags_json.length > 0 && (
        <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {draft.suggested_tags_json.map((tag) => (
            <span key={tag} style={{ background: "#ede9fe", color: "#6d28d9", borderRadius: 4, padding: "2px 8px", fontSize: 12 }}>#{tag}</span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <select
          value={saveMode}
          onChange={(e) => setSaveMode(e.target.value as SaveMode)}
          style={{ padding: "6px 8px", border: "1px solid #ddd", borderRadius: 4, fontSize: 13 }}
        >
          <option value="summary_only">Summary only</option>
          <option value="summary_and_facts">Summary + facts</option>
          <option value="full_conversation">Full conversation</option>
        </select>
        <button
          onClick={() => onApprove(saveMode, headline, detail)}
          disabled={loading}
          style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 4, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}
        >Save to Memory</button>
        <button
          onClick={onDismiss}
          disabled={loading}
          style={{ background: "#f3f4f6", border: "none", borderRadius: 4, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}
        >Dismiss</button>
        <button
          onClick={onPrivate}
          disabled={loading}
          style={{ background: "#f3f4f6", border: "none", borderRadius: 4, padding: "6px 14px", fontSize: 13, cursor: "pointer" }}
        >Private</button>
      </div>
    </div>
  );
}
