"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppShell, AppPage, UI } from "../components/AppShell";

type SyringeUnits = 50 | 100;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toNum(v: string) {
  const t = v.trim().replace(",", ".");
  if (!t) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function fmt(n: number, dp = 2) {
  if (!Number.isFinite(n)) return "—";
  const fixed = n.toFixed(dp);
  return fixed.replace(/\.?0+$/, "");
}

function useIsMobile(maxPx = 720) {
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

function SyringeRuler({
  units,
  maxUnits,
}: {
  units: number;
  maxUnits: SyringeUnits;
}) {
  const u = clamp(Number.isFinite(units) ? units : 0, 0, maxUnits);
  const pct = maxUnits <= 0 ? 0 : u / maxUnits;

  // ticks: show minor=1, medium=5, major=10
  // for performance on mobile, render ticks using simple loop, but keep it lightweight
  const ticks = useMemo(() => {
    const arr: Array<{ v: number; isMajor: boolean; isMedium: boolean }> = [];
    for (let v = 0; v <= maxUnits; v += 1) {
      const isMajor = v % 10 === 0;
      const isMedium = !isMajor && v % 5 === 0;
      arr.push({ v, isMajor, isMedium });
    }
    return arr;
  }, [maxUnits]);

  return (
    <section
      style={{
        border: `1px solid ${UI.line}`,
        borderRadius: 18,
        background: "linear-gradient(180deg,#fff 0%, #fff7f3 100%)",
        padding: 14,
        boxShadow: UI.shadow,
      }}
    >
      {/* Header row (keep it minimal) */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "baseline",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 950, color: UI.ink }}>Visual syringe (with tick marks)</div>
        <div style={{ color: UI.muted, fontWeight: 900, fontSize: 12 }}>
          Selected: {maxUnits} unit syringe
        </div>
      </div>

      {/* Syringe block */}
      <div
        style={{
          marginTop: 12,
          borderRadius: 18,
          border: `1px solid ${UI.line}`,
          background: "#fff",
          padding: 14,
        }}
      >
        {/* Tick ruler */}
        <div style={{ position: "relative", height: 46, userSelect: "none" }}>
          {/* baseline */}
          <div
            style={{
              position: "absolute",
              left: 6,
              right: 6,
              top: 28,
              height: 2,
              background: "rgba(17,17,17,0.10)",
              borderRadius: 999,
            }}
          />

          {ticks.map((t) => {
            const xPct = (t.v / maxUnits) * 100;
            const height = t.isMajor ? 24 : t.isMedium ? 16 : 10;
            const top = 28 - height;

            return (
              <div key={t.v}>
                <div
                  style={{
                    position: "absolute",
                    left: `calc(${xPct}% + 6px)`,
                    transform: "translateX(-1px)",
                    top,
                    width: 2,
                    height,
                    background: t.isMajor
                      ? "rgba(17,17,17,0.65)"
                      : t.isMedium
                      ? "rgba(17,17,17,0.38)"
                      : "rgba(17,17,17,0.18)",
                    borderRadius: 2,
                  }}
                />
                {t.isMajor && (
                  <div
                    style={{
                      position: "absolute",
                      left: `calc(${xPct}% + 6px)`,
                      transform: "translateX(-50%)",
                      top: 0,
                      fontSize: 12,
                      fontWeight: 950,
                      color: "rgba(17,17,17,0.70)",
                    }}
                  >
                    {t.v}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Barrel row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "44px 1fr 26px",
            gap: 10,
            alignItems: "center",
            marginTop: 10,
          }}
        >
          {/* Plunger */}
          <div
            style={{
              height: 40,
              borderRadius: 14,
              border: `1px solid ${UI.line}`,
              background: "rgba(255,106,61,0.16)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 950,
              color: UI.ink,
            }}
            title="Plunger"
          >
            ||
          </div>

          {/* Barrel (fill INSIDE the barrel) */}
          <div
            style={{
              position: "relative",
              height: 40,
              borderRadius: 18,
              border: `1px solid ${UI.line}`,
              background: "linear-gradient(180deg,#ffffff 0%, #fafafa 100%)",
              overflow: "hidden",
            }}
            title="Syringe barrel"
          >
            {/* Fill */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${pct * 100}%`,
                background:
                  "linear-gradient(180deg, rgba(255, 106, 61, 0.22) 0%, rgba(255, 106, 61, 0.52) 100%)",
              }}
            />
            {/* Cursor line */}
            <div
              style={{
                position: "absolute",
                left: `${pct * 100}%`,
                top: 0,
                bottom: 0,
                width: 2,
                background: UI.accent,
                opacity: 0.95,
              }}
            />
            {/* Gloss */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.70) 0%, rgba(255,255,255,0) 62%)",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Needle tip (tiny) */}
          <div
            style={{
              height: 2,
              background: "rgba(17,17,17,0.55)",
              borderRadius: 999,
            }}
            title="Needle"
          />
        </div>

        {/* Footer row */}
        <div
          style={{
            marginTop: 10,
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            color: "rgba(17,17,17,0.65)",
            fontWeight: 900,
            fontSize: 12,
          }}
        >
          <div>0 units</div>
          <div>{maxUnits} units</div>
        </div>

        <div
          style={{
            marginTop: 10,
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ color: UI.muted, fontWeight: 900, fontSize: 12 }}>
            Minor: 1 • Medium: 5 • Major: 10 • U-100: 100 units = 1.00 mL
          </div>

          <div
            style={{
              padding: "9px 12px",
              borderRadius: 999,
              border: `1px solid ${UI.line}`,
              background: UI.ink,
              color: "#fff",
              fontWeight: 950,
              fontSize: 12,
            }}
          >
            Draw to: {fmt(u, 0)} units
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          textAlign: "center",
          color: "rgba(17,17,17,0.45)",
          fontWeight: 900,
          fontSize: 12,
        }}
      >
        Dose Converter is a unit-conversion and reference tool. No medical advice.
      </div>
    </section>
  );
}

export default function CalculatorPage() {
  const isMobile = useIsMobile(720);

  // Only syringe sizes you want: 50U and 100U
  const [maxUnits, setMaxUnits] = useState<SyringeUnits>(100);

  // Reconstitution inputs
  const [vialMg, setVialMg] = useState<string>("10");
  const [waterMl, setWaterMl] = useState<string>("2");
  const [doseMg, setDoseMg] = useState<string>("2.5");

  const pad = isMobile ? 12 : 14;

  // Calculations
  const recon = useMemo(() => {
    const mg = toNum(vialMg);
    const ml = toNum(waterMl);
    const dose = toNum(doseMg);

    if (!Number.isFinite(mg) || !Number.isFinite(ml) || mg <= 0 || ml <= 0) {
      return { ok: false as const };
    }

    const concentration = mg / ml; // mg per mL
    if (!Number.isFinite(dose) || dose <= 0) {
      return { ok: true as const, concentration, mlNeeded: NaN, units: NaN };
    }

    const mlNeeded = dose / concentration;
    const units = mlNeeded * 100; // U-100 scale
    return { ok: true as const, concentration, mlNeeded, units };
  }, [vialMg, waterMl, doseMg]);

  const unitsClamped = clamp(
    Number.isFinite(recon.ok ? recon.units : NaN) ? (recon as any).units : 0,
    0,
    maxUnits
  );

  const card: React.CSSProperties = {
    border: `1px solid ${UI.line}`,
    borderRadius: 18,
    background: "#fff",
    boxShadow: UI.shadow,
    padding: pad,
  };

  const label: React.CSSProperties = {
    fontWeight: 950,
    color: isMobile ? "rgba(17,17,17,0.86)" : "rgba(17,17,17,0.72)",
    marginBottom: 8,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 12,
    borderRadius: 14,
    border: `1px solid ${UI.line}`,
    fontWeight: 950,
    background: "#fff",
    color: UI.ink,
    boxSizing: "border-box",
    fontSize: 16,
  };

  const optionBtn = (active = false): React.CSSProperties => ({
    padding: "10px 12px",
    borderRadius: 14,
    border: active ? `2px solid ${UI.accent}` : `1px solid ${UI.line}`,
    background: active ? "linear-gradient(180deg,#fff 0%, #fff7f3 100%)" : "#fff",
    cursor: "pointer",
    fontWeight: 950,
    color: UI.ink,
    boxShadow: "0 10px 24px rgba(0,0,0,0.06)",
    minWidth: 86,
    textAlign: "center",
  });

  const sizePill = (active = false): React.CSSProperties => ({
    padding: "10px 12px",
    borderRadius: 999,
    border: active ? `2px solid ${UI.accent}` : `1px solid ${UI.line}`,
    background: active ? UI.accentSoft : "#fff",
    cursor: "pointer",
    fontWeight: 950,
    color: UI.ink,
    boxShadow: "0 10px 24px rgba(0,0,0,0.06)",
    whiteSpace: "nowrap",
  });

  return (
    <AppShell title="Calculator" subtitle="Reconstitution math + syringe units (U-100).">
      <AppPage>
        {/* Mobile/contrast polish + try to un-grey the Menu button */}
        <style jsx global>{`
          /* Make text/buttons feel less washed out on mobile */
          @media (max-width: 720px) {
            body {
              -webkit-text-size-adjust: 100%;
            }
          }

          /* Try to fix “Menu” looking disabled (covers common patterns) */
          button[aria-label="Menu"],
          button[aria-label="menu"],
          button:has(> span:contains("Menu")),
          .menuBtn,
          .appMenuBtn,
          .appShellMenuBtn {
            opacity: 1 !important;
            filter: none !important;
          }
        `}</style>

        {/* Top: syringe size selection (replaces “Reconstitution” weirdness) */}
        <section style={{ ...card, marginTop: 12, background: "linear-gradient(180deg,#fff 0%, #fff7f3 100%)" }}>
          <div style={{ fontWeight: 950, color: UI.ink, fontSize: 16 }}>Select a Syringe Size</div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => setMaxUnits(50)} style={sizePill(maxUnits === 50)}>
              0.50 mL <span style={{ color: UI.muted, fontWeight: 950 }}>• 50 units</span>
            </button>
            <button onClick={() => setMaxUnits(100)} style={sizePill(maxUnits === 100)}>
              1.0 mL <span style={{ color: UI.muted, fontWeight: 950 }}>• 100 units</span>
            </button>
          </div>

          <div style={{ marginTop: 10, color: UI.muted, fontWeight: 900 }}>
            Tip: Choose vial + BAC water, enter dose, then read the <b>Draw to</b> units.
          </div>
        </section>

        {/* Inputs: Vial + BAC side-by-side (boxed), dose below */}
        <section style={{ ...card, marginTop: 12 }}>
          <div style={{ fontWeight: 950, fontSize: 16, color: UI.ink }}>Reconstitution</div>
          <div style={{ color: UI.muted, fontWeight: 900, marginTop: 6 }}>
            Choose vial + BAC water, enter dose, then read the draw-to units.
          </div>

          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 12,
            }}
          >
            {/* Vial box */}
            <div style={{ border: `1px solid ${UI.line}`, borderRadius: 16, padding: 12, background: "#fff" }}>
              <div style={label}>Vial amount (mg)</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {["5", "10", "15", "30", "50"].map((v) => (
                  <button key={v} onClick={() => setVialMg(v)} style={optionBtn(vialMg === v)}>
                    {v} mg
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 10 }}>
                <input
                  value={vialMg}
                  onChange={(e) => setVialMg(e.target.value)}
                  placeholder="Custom mg"
                  style={inputStyle}
                  inputMode="decimal"
                />
              </div>
            </div>

            {/* BAC box */}
            <div style={{ border: `1px solid ${UI.line}`, borderRadius: 16, padding: 12, background: "#fff" }}>
              <div style={label}>BAC water (mL)</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {["1", "2", "3", "5", "10"].map((v) => (
                  <button key={v} onClick={() => setWaterMl(v)} style={optionBtn(waterMl === v)}>
                    {v} mL
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 10 }}>
                <input
                  value={waterMl}
                  onChange={(e) => setWaterMl(e.target.value)}
                  placeholder="Custom mL"
                  style={inputStyle}
                  inputMode="decimal"
                />
              </div>
            </div>
          </div>

          {/* Dose */}
          <div style={{ marginTop: 12 }}>
            <div style={label}>Dose (mg)</div>
            <input
              value={doseMg}
              onChange={(e) => setDoseMg(e.target.value)}
              placeholder="e.g. 2.5"
              style={inputStyle}
              inputMode="decimal"
            />
          </div>

          {/* Results (simple lines, premium + compact) */}
          <div style={{ marginTop: 12, borderTop: `1px solid ${UI.line}`, paddingTop: 12 }}>
            {!recon.ok ? (
              <div style={{ fontWeight: 950, color: UI.muted }}>
                Enter a valid vial mg and water mL to calculate.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
                  gap: 10,
                }}
              >
                <div style={{ border: `1px solid ${UI.line}`, borderRadius: 16, padding: 12, background: "#fff" }}>
                  <div style={{ color: UI.muted, fontWeight: 950, fontSize: 12 }}>Concentration</div>
                  <div style={{ fontWeight: 950, color: UI.ink, fontSize: 18 }}>
                    {fmt((recon as any).concentration, 3)} <span style={{ fontSize: 14, color: UI.muted }}>mg/mL</span>
                  </div>
                </div>

                <div style={{ border: `1px solid ${UI.line}`, borderRadius: 16, padding: 12, background: "#fff" }}>
                  <div style={{ color: UI.muted, fontWeight: 950, fontSize: 12 }}>Volume</div>
                  <div style={{ fontWeight: 950, color: UI.ink, fontSize: 18 }}>
                    {fmt((recon as any).mlNeeded, 3)} <span style={{ fontSize: 14, color: UI.muted }}>mL</span>
                  </div>
                </div>

                <div style={{ border: `1px solid ${UI.line}`, borderRadius: 16, padding: 12, background: "#fff7f3" }}>
                  <div style={{ color: UI.muted, fontWeight: 950, fontSize: 12 }}>Units (U-100)</div>
                  <div style={{ fontWeight: 980, color: UI.ink, fontSize: 18 }}>
                    {fmt(unitsClamped, 0)}{" "}
                    <span style={{ fontSize: 12, color: UI.muted, fontWeight: 950 }}>
                      (clamped to {maxUnits}U syringe)
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: 12, color: "rgba(17,17,17,0.60)", fontWeight: 900, fontSize: 12, lineHeight: 1.4 }}>
              For general informational use only. Double-check calculations and follow professional medical guidance.
            </div>
          </div>
        </section>

        {/* Syringe guide: ONE ruler only, full-width, sits at the bottom on desktop and mobile */}
        <div style={{ marginTop: 12 }}>
          <SyringeRuler units={unitsClamped} maxUnits={maxUnits} />
        </div>
      </AppPage>
    </AppShell>
  );
}
