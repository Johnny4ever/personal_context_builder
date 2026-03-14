"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMemories, deleteMemory, queryContext, vectorizeMemory } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import type { Memory, MemoryResult } from "@/lib/types";

const NAV_LINKS = [
  { href: "/drafts", label: "Drafts" },
  { href: "/memories", label: "Memories" },
  { href: "/profile", label: "Profile" },
  { href: "/tokens", label: "Tokens" },
];

export default function MemoriesPage() {
  const router = useRouter();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const limit = 20;
  const [vectorizingId, setVectorizingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemoryResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    getMemories(page * limit, limit)
      .then((data) => { setMemories(data.items); setTotal(data.total); })
      .finally(() => setLoading(false));
  }, [router, page]);

  async function vectorize(id: number) {
    setVectorizingId(id);
    try {
      await vectorizeMemory(id);
      setMemories((prev) => prev.map((m) => m.id === id ? { ...m, has_embedding: true } : m));
    } finally {
      setVectorizingId(null);
    }
  }

  async function search() {
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    setSearching(true);
    setSearchError("");
    try {
      const res = await queryContext(searchQuery.trim());
      setSearchResults(res.relevant_memories);
    } catch (e) {
      setSearchError(String(e));
      setSearchResults(null);
    } finally {
      setSearching(false);
    }
  }

  async function remove(id: number) {
    await deleteMemory(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
    setTotal((t) => t - 1);
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <nav style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {NAV_LINKS.map((l) => (
          <a key={l.href} href={l.href} style={{ color: "#2563eb", textDecoration: "none", fontWeight: l.href === "/memories" ? 700 : 400 }}>{l.label}</a>
        ))}
      </nav>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Memories ({total})</h1>

      {/* Semantic search */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults(null); }}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search memories semantically…"
          style={{ flex: 1, padding: "8px 10px", border: "1px solid #ddd", borderRadius: 4, fontSize: 13 }}
        />
        <button onClick={search} disabled={searching} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 4, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>
          {searching ? "Searching…" : "Search"}
        </button>
        {searchResults !== null && (
          <button onClick={() => { setSearchResults(null); setSearchQuery(""); }} style={{ background: "#f3f4f6", border: "none", borderRadius: 4, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>Clear</button>
        )}
      </div>
      {searchError && <p style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{searchError}</p>}

      {/* Search results */}
      {searchResults !== null && (
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>
            {searchResults.length === 0 ? "No matching memories found." : `${searchResults.length} relevant memories`}
          </p>
          {searchResults.map((r, i) => (
            <div key={i} style={{ background: "#eff6ff", borderRadius: 8, padding: 16, marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>{r.source_platform}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <span style={{
                    fontSize: 11, borderRadius: 4, padding: "2px 6px",
                    background: r.similarity >= 70 ? "#dcfce7" : r.similarity >= 45 ? "#fef9c3" : "#fee2e2",
                    color: r.similarity >= 70 ? "#166534" : r.similarity >= 45 ? "#854d0e" : "#991b1b",
                  }}>{r.similarity}% match</span>
                  <span style={{ fontSize: 12, background: "#dbeafe", color: "#1e40af", borderRadius: 4, padding: "2px 6px" }}>{r.save_mode}</span>
                </div>
              </div>
              <p style={{ fontSize: 14, marginBottom: 6 }}>{r.summary}</p>
              {r.tags.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {r.tags.map((t) => <span key={t} style={{ background: "#ede9fe", color: "#6d28d9", borderRadius: 4, padding: "2px 8px", fontSize: 12 }}>#{t}</span>)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {loading && <p>Loading…</p>}
      {!loading && memories.length === 0 && <p style={{ color: "#6b7280" }}>No memories yet. Approve a draft to create one.</p>}
      {memories.map((m) => (
        <div key={m.id} style={{ background: "white", borderRadius: 8, padding: 20, marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>{m.source_platform} · {new Date(m.created_at).toLocaleDateString()}</span>
            <div style={{ display: "flex", gap: 6 }}>
              {m.has_embedding
                ? <span style={{ fontSize: 11, background: "#dcfce7", color: "#166534", borderRadius: 4, padding: "2px 6px" }}>vectorized</span>
                : <span style={{ fontSize: 11, background: "#fef9c3", color: "#854d0e", borderRadius: 4, padding: "2px 6px" }}>no vector</span>
              }
              <span style={{ fontSize: 12, background: "#f3f4f6", borderRadius: 4, padding: "2px 6px" }}>{m.save_mode}</span>
            </div>
          </div>
          <p style={{ marginBottom: 8 }}>{m.summary_text}</p>
          {m.tags_json && m.tags_json.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {m.tags_json.map((t) => <span key={t} style={{ background: "#ede9fe", color: "#6d28d9", borderRadius: 4, padding: "2px 8px", fontSize: 12 }}>#{t}</span>)}
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            {!m.has_embedding && (
              <button
                onClick={() => vectorize(m.id)}
                disabled={vectorizingId === m.id}
                style={{ fontSize: 12, background: "none", border: "1px solid #86efac", color: "#16a34a", borderRadius: 4, padding: "3px 10px", cursor: "pointer" }}
              >{vectorizingId === m.id ? "Vectorizing…" : "Vectorize"}</button>
            )}
            <button
              onClick={() => remove(m.id)}
              style={{ fontSize: 12, background: "none", border: "1px solid #fca5a5", color: "#ef4444", borderRadius: 4, padding: "3px 10px", cursor: "pointer" }}
            >Delete</button>
          </div>
        </div>
      ))}
      {total > limit && (
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
          <button disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
