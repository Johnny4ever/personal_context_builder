"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProfile, updateProfileFact } from "@/lib/api";
import { isLoggedIn } from "@/lib/auth";
import type { ProfileFact } from "@/lib/types";

const NAV_LINKS = [
  { href: "/drafts", label: "Drafts" },
  { href: "/memories", label: "Memories" },
  { href: "/profile", label: "Profile" },
  { href: "/tokens", label: "Tokens" },
];

export default function ProfilePage() {
  const router = useRouter();
  const [facts, setFacts] = useState<ProfileFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!isLoggedIn()) { router.replace("/login"); return; }
    getProfile().then(setFacts).finally(() => setLoading(false));
  }, [router]);

  async function save(fact: ProfileFact) {
    const newValue = editing[fact.id];
    if (!newValue || newValue === fact.profile_value) {
      setEditing((prev) => { const n = { ...prev }; delete n[fact.id]; return n; });
      return;
    }
    const updated = await updateProfileFact(fact.profile_key, newValue);
    setFacts((prev) => prev.map((f) => f.id === fact.id ? updated : f));
    setEditing((prev) => { const n = { ...prev }; delete n[fact.id]; return n; });
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <nav style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        {NAV_LINKS.map((l) => (
          <a key={l.href} href={l.href} style={{ color: "#2563eb", textDecoration: "none", fontWeight: l.href === "/profile" ? 700 : 400 }}>{l.label}</a>
        ))}
      </nav>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Profile</h1>
      {loading && <p>Loading…</p>}
      {!loading && facts.length === 0 && <p style={{ color: "#6b7280" }}>No profile facts yet. Approve a draft with extracted facts to populate your profile.</p>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {facts.map((fact) => (
            <tr key={fact.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "10px 0", width: 160, fontSize: 13, color: "#6b7280", fontWeight: 600 }}>{fact.profile_key}</td>
              <td style={{ padding: "10px 0" }}>
                {editing[fact.id] !== undefined ? (
                  <input
                    value={editing[fact.id]}
                    onChange={(e) => setEditing((prev) => ({ ...prev, [fact.id]: e.target.value }))}
                    style={{ padding: "4px 8px", border: "1px solid #2563eb", borderRadius: 4, fontSize: 13, width: "100%" }}
                  />
                ) : (
                  <span style={{ fontSize: 13 }}>{fact.profile_value}</span>
                )}
              </td>
              <td style={{ padding: "10px 0", textAlign: "right", whiteSpace: "nowrap" }}>
                {editing[fact.id] !== undefined ? (
                  <>
                    <button onClick={() => save(fact)} style={{ fontSize: 12, background: "#2563eb", color: "white", border: "none", borderRadius: 4, padding: "3px 10px", cursor: "pointer", marginRight: 6 }}>Save</button>
                    <button onClick={() => setEditing((prev) => { const n = { ...prev }; delete n[fact.id]; return n; })} style={{ fontSize: 12, background: "#f3f4f6", border: "none", borderRadius: 4, padding: "3px 10px", cursor: "pointer" }}>Cancel</button>
                  </>
                ) : (
                  <button onClick={() => setEditing((prev) => ({ ...prev, [fact.id]: fact.profile_value }))} style={{ fontSize: 12, background: "none", border: "1px solid #ddd", borderRadius: 4, padding: "3px 10px", cursor: "pointer" }}>Edit</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
