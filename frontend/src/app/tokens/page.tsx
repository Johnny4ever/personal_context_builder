"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getTokens, createToken, revokeToken } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import type { ApiToken, ApiTokenCreated } from "@/lib/types";

const NAV_LINKS = [
  { href: "/drafts", label: "Drafts" },
  { href: "/memories", label: "Memories" },
  { href: "/profile", label: "Profile" },
  { href: "/tokens", label: "Tokens" },
];

export default function TokensPage() {
  const router = useRouter();
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [created, setCreated] = useState<ApiTokenCreated | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    getTokens().then(setTokens).finally(() => setLoading(false));
  }, [router]);

  async function handleCreate() {
    if (!newName.trim()) return;
    const token = await createToken(newName.trim());
    setCreated(token);
    setTokens((prev) => [token, ...prev]);
    setNewName("");
  }

  async function handleRevoke(id: number) {
    await revokeToken(id);
    setTokens((prev) => prev.map((t) => t.id === id ? { ...t, revoked_at: new Date().toISOString() } : t));
  }

  async function copyToken(value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <nav style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {NAV_LINKS.map((l) => (
          <a key={l.href} href={l.href} style={{ color: "#2563eb", textDecoration: "none", fontWeight: l.href === "/tokens" ? 700 : 400 }}>{l.label}</a>
        ))}
      </nav>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>API Tokens</h1>

      {/* New token created — show once */}
      {created && (
        <div style={{ background: "#dcfce7", border: "1px solid #bbf7d0", borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <p style={{ fontWeight: 600, marginBottom: 8, color: "#166534" }}>Token created — copy it now, it won&apos;t be shown again</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <code style={{ background: "#f0fdf4", padding: "6px 10px", borderRadius: 4, fontSize: 12, flex: 1, overflowX: "auto", wordBreak: "break-all" }}>{created.plain_token}</code>
            <button onClick={() => copyToken(created.plain_token)} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 4, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button onClick={() => setCreated(null)} style={{ marginTop: 8, fontSize: 12, background: "none", border: "none", color: "#6b7280", cursor: "pointer" }}>Dismiss</button>
        </div>
      )}

      {/* Create form */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Token name (e.g. Claude Code)"
          style={{ flex: 1, padding: "8px 10px", border: "1px solid #ddd", borderRadius: 4, fontSize: 13 }}
        />
        <button onClick={handleCreate} style={{ background: "#2563eb", color: "white", border: "none", borderRadius: 4, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>
          Create token
        </button>
      </div>

      {loading && <p>Loading…</p>}
      {!loading && tokens.length === 0 && <p style={{ color: "#6b7280" }}>No tokens yet.</p>}
      {tokens.map((t) => (
        <div key={t.id} style={{ background: "white", borderRadius: 8, padding: 16, marginBottom: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontWeight: 600, fontSize: 14 }}>{t.token_name}</p>
            <p style={{ fontSize: 12, color: "#6b7280" }}>
              Created {new Date(t.created_at).toLocaleDateString()}
              {t.last_used_at && ` · Last used ${new Date(t.last_used_at).toLocaleDateString()}`}
              {t.revoked_at && " · Revoked"}
            </p>
          </div>
          {!t.revoked_at && (
            <button onClick={() => handleRevoke(t.id)} style={{ background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 4, padding: "6px 12px", fontSize: 13, cursor: "pointer" }}>
              Revoke
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
