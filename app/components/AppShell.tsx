"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Shared UI palette */
export const UI = {
  bg: "#fbfaf8",
  card: "#ffffff",
  line: "rgba(17,17,17,0.12)",
  muted: "rgba(17,17,17,0.62)",
  ink: "#111111",
  accent: "#ff6a3d",
  accentSoft: "rgba(255,106,61,0.12)",
  shadow: "0 16px 40px rgba(0,0,0,0.08)",
};

export function AppPage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: 18 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>{children}</div>
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

function useIsMobile(maxPx = 860) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxPx}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [maxPx]);

  return isMobile;
}

type NavItem = {
  href: string;
  label: string;
  section?: "main" | "tools";
};

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isMobile = useIsMobile(860);
  const [menuOpen, setMenuOpen] = useState(false);

  // ✅ Keep only what you want users to use
  const navItems: NavItem[] = useMemo(
    () => [
      { href: "/", label: "Dashboard", section: "main" },
      { href: "/health", label: "Health", section: "main" },
      { href: "/tracker", label: "Tracker", section: "main" },
      { href: "/vials", label: "Stock", section: "main" },
      { href: "/calculator", label: "Calculator", section: "tools" },
    ],
    []
  );

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  }

  const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div
      style={{
        border: `1px solid ${UI.line}`,
        borderRadius: 18,
        background: UI.card,
        boxShadow: UI.shadow,
        padding: 14,
        height: isMobile ? "auto" : "calc(100vh - 36px)",
        position: isMobile ? "static" : "sticky",
        top: 18,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "4px 6px 10px 6px" }}>
        <div style={{ fontWeight: 950, color: UI.ink, letterSpacing: -0.2 }}>
          Dose Companion
        </div>
        <div style={{ marginTop: 4, fontWeight: 800, color: UI.muted, fontSize: 13 }}>
          Schedule + injection tracking
        </div>
      </div>

      <div style={{ marginTop: 8, color: "rgba(17,17,17,0.45)", fontWeight: 900, fontSize: 11, padding: "6px 6px" }}>
        MAIN
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {navItems
          .filter((i) => i.section === "main")
          .map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                style={{
                  textDecoration: "none",
                  color: active ? UI.ink : "rgba(17,17,17,0.78)",
                  fontWeight: 950,
                  padding: "10px 10px",
                  borderRadius: 12,
                  background: active ? UI.accentSoft : "transparent",
                  border: active ? `1px solid rgba(255,106,61,0.35)` : "1px solid transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>{item.label}</span>
                <span style={{ opacity: 0.45, fontWeight: 900 }}>→</span>
              </Link>
            );
          })}
      </div>

      <div style={{ marginTop: 12, color: "rgba(17,17,17,0.45)", fontWeight: 900, fontSize: 11, padding: "6px 6px" }}>
        TOOLS
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {navItems
          .filter((i) => i.section === "tools")
          .map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                style={{
                  textDecoration: "none",
                  color: active ? UI.ink : "rgba(17,17,17,0.78)",
                  fontWeight: 950,
                  padding: "10px 10px",
                  borderRadius: 12,
                  background: active ? UI.accentSoft : "transparent",
                  border: active ? `1px solid rgba(255,106,61,0.35)` : "1px solid transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>{item.label}</span>
                <span style={{ opacity: 0.45, fontWeight: 900 }}>→</span>
              </Link>
            );
          })}
      </div>

      <div
        style={{
          marginTop: "auto",
          borderTop: `1px solid rgba(17,17,17,0.08)`,
          paddingTop: 12,
          color: "rgba(17,17,17,0.58)",
          fontWeight: 800,
          fontSize: 12,
        }}
      >
        Tip: Set your schedule once, then log injections as you go.
      </div>
    </div>
  );

  return (
    <main style={{ background: UI.bg, minHeight: "100vh" }}>
      <style jsx global>{`
        html,
        body {
          background: ${UI.bg};
        }
        .safeBottom {
          padding-bottom: env(safe-area-inset-bottom);
        }
        body {
          overscroll-behavior-y: none;
        }
      `}</style>

      <AppPage>
        {/* Header */}
        <div
          className="safeBottom"
          style={{
            border: `1px solid ${UI.line}`,
            borderRadius: 20,
            padding: 14,
            background: "linear-gradient(180deg, #fff 0%, #fff7f3 100%)",
            boxShadow: UI.shadow,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ minWidth: 220 }}>
            <div style={{ fontSize: 28, fontWeight: 950, color: UI.ink, letterSpacing: -0.2 }}>
              {title}
            </div>
            {subtitle ? <div style={{ marginTop: 6, color: UI.muted, fontWeight: 800 }}>{subtitle}</div> : null}
          </div>

          {/* ✅ Menu button: force visible (no grey/opacity issues) */}
          {isMobile ? (
            <button
              onClick={() => setMenuOpen(true)}
              style={{
                padding: "10px 12px",
                borderRadius: 999,
                border: `1px solid ${UI.line}`,
                background: "#fff",
                color: UI.ink,
                fontWeight: 950,
                cursor: "pointer",
                boxShadow: "0 10px 22px rgba(0,0,0,0.06)",
                opacity: 1,
              }}
            >
              ☰ Menu
            </button>
          ) : null}
        </div>

        {/* Layout */}
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "290px 1fr",
            gap: 14,
            alignItems: "start",
          }}
        >
          {!isMobile ? <Sidebar /> : null}
          <div>{children}</div>
        </div>

        {/* Mobile menu sheet */}
        {isMobile && menuOpen ? (
          <GlassOverlay onClose={() => setMenuOpen(false)} align="bottom">
            <div
              onClick={(e) => e.stopPropagation()}
              className="safeBottom"
              style={{
                width: "min(720px, 100%)",
                background: "rgba(255,255,255,0.92)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                border: `1px solid ${UI.line}`,
                borderRadius: 20,
                boxShadow: "0 24px 70px rgba(0,0,0,0.22)",
                overflow: "hidden",
              }}
            >
              <div style={{ width: 44, height: 5, borderRadius: 999, background: "rgba(17,17,17,0.18)", margin: "10px auto 0" }} />

              <div
                style={{
                  padding: 14,
                  borderBottom: `1px solid ${UI.line}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 950, fontSize: 16, color: UI.ink }}>Menu</div>

                {/* ✅ Close button: red + visible */}
                <button
                  onClick={() => setMenuOpen(false)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: `1px solid rgba(255,106,61,0.55)`,
                    background: UI.accent,
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 950,
                    boxShadow: "0 10px 22px rgba(0,0,0,0.10)",
                    opacity: 1,
                  }}
                >
                  Close
                </button>
              </div>

              <div style={{ padding: 12 }}>
                <Sidebar onNavigate={() => setMenuOpen(false)} />
              </div>
            </div>
          </GlassOverlay>
        ) : null}
      </AppPage>
    </main>
  );
}
