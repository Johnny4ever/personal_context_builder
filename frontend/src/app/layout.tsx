import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Context Vault",
  description: "Your personal AI memory vault",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: 0, background: "#f8fafc" }}>
        {children}
      </body>
    </html>
  );
}
