"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Shared UI palette (FIXED: stronger contrast, readable muted text) */
export const UI = {
  bg: "#fbfaf8",
  card: "#ffffff",
  line: "rgba(17,17,17,0.12)",
  muted: "rgba(17,17,17,0.62)", // ✅ darker than before
  ink: "#111111",
  accent: "#ff6a3d",
  accentSoft: "rgba(255,106,61,0.14)",
  shadow: "0 16px 40px rgba(0,0,0,0.08)",
};

function NavButton({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const active = mounted && pathname === href;

  // Hide the current page button (cleaner on mobile)
  if (active) return null;

  return (
    <Link
      href={href}
      className="swotNavBtn"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 999,
        border: `1px solid ${UI.line}`,
        background: UI.card,
        color: UI.ink,
        fontWeight: 900,
        textDecoration: "none",
        boxShadow: "0 10px 22px rgba(0,0,0,0.06)",
        whiteSpace: "nowrap",
      }}
    >
      <span>{label}</span>
      <span aria-hidden style={{ opacity: 0.8 }}>
        →
      </span>
    </Link>
  );
}

export function AppPage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 18 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

export function GlassOverlay({
  children,
  onClose,
  align = "center",
}: {
  children: React.ReactNode;
  onClose: () => void;
  align?: "center" | "bottom";
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 80,
        display: "flex",
        justifyContent: "center",
        alignItems: align === "bottom" ? "flex-end" : "center",
        padding: 10,
      }}
    >
      {children}
    </div>
  );
}

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const header = useMemo(
    () => (
      <div
        style={{
          border: `1px solid ${UI.line}`,
          borderRadius: 20,
          padding: 14,
          background: "linear-gradient(180deg, #fff 0%, #fff7f3 100%)",
          boxShadow: UI.shadow,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ minWidth: 220 }}>
            {/* ✅ FIXED: title is no longer washed out */}
            <div style={{ fontSize: 28, fontWeight: 950, color: UI.ink, letterSpacing: -0.2 }}>
              {title}
            </div>

            {subtitle ? (
              <div style={{ marginTop: 6, color: UI.muted, fontWeight: 800 }}>
                {subtitle}
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <NavButton href="/" label="Dashboard" />
            <NavButton href="/scheduler" label="Scheduler" />
            <NavButton href="/rotation" label="Rotation" />
            <NavButton href="/health" label="Health" />
          </div>
        </div>
      </div>
    ),
    [title, subtitle]
  );

  return (
    <main style={{ background: UI.bg, minHeight: "100vh" }}>
      {/* Global helpers */}
      <style jsx global>{`
        .swotNavBtn {
          transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease, border-color 160ms ease;
        }
        .swotNavBtn:hover {
          transform: translateY(-1px);
          box-shadow: 0 14px 30px rgba(0, 0, 0, 0.10);
        }

        /* ✅ Mobile: make nav buttons smaller + tighter */
        @media (max-width: 420px) {
          .swotNavBtn {
            padding: 8px 10px !important;
            font-size: 13px !important;
          }
        }
      `}</style>

      <AppPage>
        {header}
        <div style={{ marginTop: 14 }}>{children}</div>
      </AppPage>
    </main>
  );
}
