"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * HelixX UI
 * - Background + sidebar = dark glass
 * - Content surfaces (cards/inputs) = light "dashboard" tone
 */
export const UI = {
  // Text for LIGHT surfaces (cards)
  ink: "rgba(17,17,17,0.92)",
  muted: "rgba(17,17,17,0.62)",
  line: "rgba(17,17,17,0.12)",

  // Text for DARK surfaces (sidebar/background)
  inkOnDark: "rgba(255,255,255,0.92)",
  mutedOnDark: "rgba(255,255,255,0.62)",
  lineOnDark: "rgba(255,255,255,0.10)",

  // Brand
  accent: "#E10600",
  accentGlow: "rgba(225,6,0,0.18)",
  accentSoft: "rgba(225,6,0,0.10)",
  accentLine: "rgba(225,6,0,0.55)",

  // App background
  bg: "#0B0B0D",

  // Light surfaces (content)
  card: "rgba(255,255,255,0.92)",
  cardSolid: "#FFFFFF",

  // Dark surfaces (sidebar)
  sideCard: "linear-gradient(180deg, rgba(21,21,24,0.76) 0%, rgba(21,21,24,0.62) 100%)",

  // Shadows
  shadow: "0 22px 70px rgba(0,0,0,0.60)",
  shadowSoft: "0 12px 28px rgba(0,0,0,0.35)",
};

export function GlassOverlay({
  onClose,
  align = "center",
  children,
}: {
  onClose: () => void;
  align?: "center" | "bottom";
  children: React.ReactNode;
}) {
  // ✅ Stop background scroll while overlay is open (mobile polish)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: align === "bottom" ? "flex-end" : "center",
        justifyContent: "center",
        padding: 14,
        paddingBottom: `calc(14px + env(safe-area-inset-bottom))`,
      }}
    >
      {children}
    </div>
  );
}

export function AppPage({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1200, margin: "0 auto" }}>{children}</div>;
}

function useIsMobile(breakpoint = 980) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const nav = useMemo(
    () => [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/health", label: "Health Log" },
      { href: "/tracker", label: "Tracker" },
      { href: "/vials", label: "Stock Manager" },
      { href: "/calculator", label: "Calculator" },
    ],
    []
  );

  return (
    <aside
      style={{
        borderRadius: 22,
        border: `1px solid ${UI.lineOnDark}`,
        background: UI.sideCard,
        boxShadow: UI.shadow,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Brand */}
      <div
        style={{
          padding: "14px 14px 10px",
          borderBottom: `1px solid rgba(255,255,255,0.08)`,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(225,6,0,0.10) 100%)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid rgba(225,6,0,0.35)",
            background: "#0b0b0d",
            boxShadow: "0 12px 26px rgba(0,0,0,0.55)",
            flex: "0 0 auto",
          }}
        >
          <img
            src="/icons/icon-192.png"
            alt="HelixX"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>

        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontWeight: 980, fontSize: 15, color: UI.inkOnDark }}>HelixX</div>
          <div style={{ marginTop: 2, fontWeight: 850, fontSize: 11, color: UI.mutedOnDark }}>
            Precision tracking intelligence
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onNavigate?.()}
              style={{
                textDecoration: "none",
                color: UI.inkOnDark,
                fontWeight: 920,
                padding: "12px 12px",
                minHeight: 44,
                borderRadius: 14,
                border: active ? `1px solid ${UI.accentLine}` : `1px solid ${UI.lineOnDark}`,
                background: active
                  ? "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(225,6,0,0.14) 100%)"
                  : "rgba(255,255,255,0.04)",
                boxShadow: UI.shadowSoft,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                transition:
                  "transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease, background 120ms ease",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0px)";
              }}
            >
              <span>{item.label}</span>
              <span style={{ opacity: 0.55, fontWeight: 950 }}>→</span>
            </Link>
          );
        })}
      </div>

      {/* Footer hint */}
      <div
        style={{
          marginTop: "auto",
          padding: 12,
          borderTop: `1px solid rgba(255,255,255,0.08)`,
          color: UI.mutedOnDark,
          fontWeight: 800,
          fontSize: 12,
          lineHeight: 1.35,
        }}
      >
        HelixX helps you track routines, signals,
        <br />
        and consistency over time.
      </div>
    </aside>
  );
}

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile(980);
  const [menuOpen, setMenuOpen] = useState(false);

  // App background (single source of truth)
  useEffect(() => {
    document.body.style.background = UI.bg;
    document.body.style.margin = "0";
    document.body.style.color = UI.inkOnDark;
  }, []);

  // ✅ Register service worker for PWA (safe: only runs in browser + if supported)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
      } catch {
        // no-op (don’t crash the app if SW fails)
      }
    };

    // slight delay avoids fighting initial hydration
    const t = window.setTimeout(register, 400);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: isMobile ? "14px 12px 22px" : "18px 18px 28px",
        paddingBottom: isMobile
          ? `calc(22px + env(safe-area-inset-bottom))`
          : "28px",
        background:
          `radial-gradient(880px 520px at 16% 18%, rgba(225,6,0,0.16) 0%, rgba(225,6,0,0.06) 28%, rgba(0,0,0,0) 62%),` +
          `radial-gradient(900px 620px at 84% 12%, rgba(255,42,42,0.10) 0%, rgba(0,0,0,0) 58%),` +
          `radial-gradient(780px 520px at 55% 90%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0) 60%),` +
          `${UI.bg}`,
      }}
    >
      <AppPage>
        {/* Header */}
        <div
          style={{
            border: `1px solid rgba(255,255,255,0.10)`,
            borderRadius: 22,
            padding: isMobile ? 12 : 14,
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)",
            boxShadow: UI.shadow,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div style={{ minWidth: 220 }}>
            <div
              style={{
                fontSize: isMobile ? 24 : 28,
                fontWeight: 950,
                color: UI.inkOnDark,
                letterSpacing: -0.2,
              }}
            >
              {title}
            </div>
            {subtitle ? (
              <div style={{ marginTop: 6, color: UI.mutedOnDark, fontWeight: 800 }}>
                {subtitle}
              </div>
            ) : null}
          </div>

          {isMobile ? (
            <button
              onClick={() => setMenuOpen(true)}
              style={{
                padding: "10px 12px",
                minHeight: 44,
                borderRadius: 999,
                border: `1px solid rgba(255,255,255,0.14)`,
                background: "rgba(255,255,255,0.06)",
                color: UI.inkOnDark,
                fontWeight: 950,
                cursor: "pointer",
                boxShadow: "0 10px 22px rgba(0,0,0,0.25)",
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
            alignItems: "stretch",
          }}
        >
          {!isMobile ? <Sidebar /> : null}
          <div style={{ minHeight: 1 }}>{children}</div>
        </div>

        {/* Mobile menu */}
        {isMobile && menuOpen ? (
          <GlassOverlay onClose={() => setMenuOpen(false)} align="bottom">
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(720px, 100%)",
                maxHeight: "82vh",
                overflow: "auto",
                background: "rgba(21,21,24,0.92)",
                border: `1px solid rgba(255,255,255,0.12)`,
                borderRadius: 22,
                boxShadow: "0 24px 70px rgba(0,0,0,0.40)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 5,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.18)",
                  margin: "10px auto 0",
                }}
              />

              <div
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                  padding: 14,
                  borderBottom: `1px solid rgba(255,255,255,0.10)`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  background: "rgba(21,21,24,0.92)",
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
                }}
              >
                <div style={{ fontWeight: 950, fontSize: 16, color: UI.inkOnDark }}>Menu</div>

                <button
                  onClick={() => setMenuOpen(false)}
                  style={{
                    padding: "10px 12px",
                    minHeight: 44,
                    borderRadius: 999,
                    border: `1px solid ${UI.accentLine}`,
                    background: UI.accent,
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 950,
                  }}
                >
                  Close
                </button>
              </div>

              <div style={{ padding: 12 }}>
                <Sidebar onNavigate={() => setMenuOpen(false)} />
              </div>

              <div style={{ height: 12 }} />
            </div>
          </GlassOverlay>
        ) : null}
      </AppPage>
    </main>
  );
}