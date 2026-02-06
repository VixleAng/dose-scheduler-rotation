"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function NavButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const pathname = usePathname();

  // Prevent hydration mismatch (SSR-safe)
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const active = mounted && pathname === href;

  // Hide the button for the current page
  if (active) return null;

  return (
    <Link
      href={href}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: "1px solid rgba(17,17,17,0.15)",
        background: "#fff",
        color: "#111",
        fontWeight: 900,
        textDecoration: "none",
        boxShadow: "0 8px 18px rgba(0,0,0,0.06)",
      }}
    >
      {label} →
    </Link>
  );
}

export default function AppHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        border: "1px solid rgba(17,17,17,0.08)",
        background:
          "linear-gradient(180deg, rgba(250,250,250,1) 0%, rgba(255,255,255,1) 100%)",
        borderRadius: 18,
        padding: 14,
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
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>
            {title}
          </h1>
          {subtitle ? (
            <div style={{ color: "#555", marginTop: 6 }}>
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
  );
}
