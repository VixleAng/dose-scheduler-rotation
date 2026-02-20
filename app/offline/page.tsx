"use client";

import Link from "next/link";
import { AppShell, AppPage, UI } from "../components/AppShell";

export default function OfflinePage() {
  return (
    <AppShell title="Offline" subtitle="You’re not connected right now.">
      <AppPage>
        <div
          style={{
            borderRadius: 22,
            background: "rgba(255,255,255,0.92)",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 22px 70px rgba(0,0,0,0.45)",
            padding: 16,
            color: "rgba(0,0,0,0.85)",
          }}
        >
          <div style={{ fontWeight: 980, fontSize: 16 }}>No internet connection</div>
          <div style={{ marginTop: 8, color: "rgba(0,0,0,0.60)", fontWeight: 850, lineHeight: 1.45 }}>
            Some parts of HelixX can still work if they’ve been cached already.
            When you’re back online, refresh the app.
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href="/dashboard"
              style={{
                textDecoration: "none",
                padding: "10px 12px",
                minHeight: 44,
                borderRadius: 999,
                border: `1px solid ${UI.accentLine}`,
                background: UI.accent,
                color: "#fff",
                fontWeight: 950,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </AppPage>
    </AppShell>
  );
}