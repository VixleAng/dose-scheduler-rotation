"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const UI = {
  accent: "#ff7849",
  accentSoft: "#fff1ea",
  line: "rgba(17,17,17,0.08)",
  muted: "rgba(17,17,17,0.55)",
  card: "#ffffff",
  shadow: "0 18px 45px rgba(0,0,0,0.08)",
  ink: "#111",
};

export function AppShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const pathname = usePathname();

  const NavButton = ({
    href,
    label,
  }: {
    href: string;
    label: string;
  }) => {
    const isActive = pathname === href;

    if (isActive) return null;

    return (
      <Link
        href={href}
        style={{
          padding: "10px 14px",
          borderRadius: 999,
          border: `1px solid ${UI.line}`,
          background: "#fff",
          fontWeight: 900,
          textDecoration: "none",
          color: UI.ink,
          transition: "all 150ms ease",
        }}
      >
        {label} →
      </Link>
    );
  };

  return (
    <main
      style={{
        padding: 20,
        maxWidth: 1100,
        margin: "0 auto",
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #fff 0%, #fff8f4 100%)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>
            {title}
          </h1>
          {subtitle && (
            <div style={{ color: UI.muted, marginTop: 6 }}>
              {subtitle}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <NavButton href="/" label="Dashboard" />
          <NavButton href="/scheduler" label="Scheduler" />
          <NavButton href="/rotation" label="Rotation" />
          <NavButton href="/health" label="Health" />
        </div>
      </div>

      {children}
    </main>
  );
}

export function AppPage({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div style={{ marginTop: 20 }}>{children}</div>;
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
        display: "flex",
        justifyContent: "center",
        alignItems:
          align === "bottom" ? "flex-end" : "center",
        padding: 10,
        zIndex: 70,
      }}
    >
      {children}
    </div>
  );
}
