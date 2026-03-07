"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMemories, deleteMemory } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import type { Memory } from "@/lib/types";

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

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    getMemories(page * limit, limit)
      .then((data) => { setMemories(data.items); setTotal(data.total); })
      .finally(() => setLoading(false));
  }, [router, page]);

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
      {loading && <p>Loading…</p>}
      {!loading && memories.length === 0 && <p style={{ color: "#6b7280" }}>No memories yet. Approve a draft to create one.</p>}
      {memories.map((m) => (
        <div key={m.id} style={{ background: "white", borderRadius: 8, padding: 20, marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>{m.source_platform} · {new Date(m.created_at).toLocaleDateString()}</span>
            <span style={{ fontSize: 12, background: "#f3f4f6", borderRadius: 4, padding: "2px 6px" }}>{m.save_mode}</span>
          </div>
          <p style={{ marginBottom: 8 }}>{m.summary_text}</p>
          {m.tags_json && m.tags_json.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {m.tags_json.map((t) => <span key={t} style={{ background: "#ede9fe", color: "#6d28d9", borderRadius: 4, padding: "2px 8px", fontSize: 12 }}>#{t}</span>)}
            </div>
          )}
          <button
            onClick={() => remove(m.id)}
            style={{ fontSize: 12, background: "none", border: "1px solid #fca5a5", color: "#ef4444", borderRadius: 4, padding: "3px 10px", cursor: "pointer" }}
          >Delete</button>
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
