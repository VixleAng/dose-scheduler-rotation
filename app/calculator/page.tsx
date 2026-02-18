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

function fmtUnits(n: number) {
  if (!Number.isFinite(n)) return "—";
  // show .5 / decimals when needed, otherwise integer
  const isInt = Math.abs(n - Math.round(n)) < 1e-9;
  return isInt ? fmt(n, 0) : fmt(n, 1);
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

/**
 * Premium syringe visual:
 * - tick marks + labels INSIDE the barrel
 * - fill shows "how far to draw"
 * - draw-to line + label pill
 *
 * NOTE: We pass in the "draw-to" units already (can be clamped),
 * and we can optionally show a small "raw units" hint above.
 */
function SyringeVisual({
  units,
  maxUnits,
  rawUnits,
}: {
  units: number; // draw-to (may be clamped)
  maxUnits: SyringeUnits;
  rawUnits?: number; // true units (unclamped)
}) {
  const u = clamp(Number.isFinite(units) ? units : 0, 0, maxUnits);
  const pct = maxUnits <= 0 ? 0 : u / maxUnits;

  const majorStep = 10;
  const minorStep = 1;
  const mediumStep = 5;

  const ticks = useMemo(() => {
    const arr: Array<{ v: number; kind: "major" | "medium" | "minor" }> = [];
    for (let v = 0; v <= maxUnits; v += minorStep) {
      const kind = v % majorStep === 0 ? "major" : v % mediumStep === 0 ? "medium" : "minor";
      arr.push({ v, kind });
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "baseline",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 950, color: UI.ink }}>Visual syringe</div>

        <div style={{ color: UI.muted, fontWeight: 900, fontSize: 12 }}>
          {maxUnits}U syringe • Draw to <b>{fmtUnits(u)}U</b>
          {Number.isFinite(rawUnits ?? NaN) ? (
            <span style={{ marginLeft: 8 }}>
              • True: <b>{fmtUnits(rawUnits!)}U</b>
            </span>
          ) : null}
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          borderRadius: 18,
          border: `1px solid ${UI.line}`,
          background: "#fff",
          padding: 14,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "48px 1fr 34px",
            gap: 10,
            alignItems: "center",
          }}
        >
          {/* Plunger */}
          <div
            style={{
              height: 54,
              borderRadius: 16,
              border: `1px solid ${UI.line}`,
              background: "rgba(255,106,61,0.16)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 950,
              color: UI.ink,
              userSelect: "none",
            }}
            title="Plunger"
          >
            ||
          </div>

          {/* Barrel */}
          <div
            style={{
              position: "relative",
              height: 54,
              borderRadius: 18,
              border: `1px solid ${UI.line}`,
              background: "linear-gradient(180deg,#ffffff 0%, #fafafa 100%)",
              overflow: "hidden",
            }}
            title="Syringe barrel"
          >
            {/* Inner inset */}
            <div
              style={{
                position: "absolute",
                inset: 8,
                borderRadius: 14,
                border: "1px solid rgba(17,17,17,0.08)",
                background: "rgba(255,255,255,0.65)",
                overflow: "hidden",
              }}
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
                    "linear-gradient(180deg, rgba(255, 106, 61, 0.18) 0%, rgba(255, 106, 61, 0.55) 100%)",
                }}
              />

              {/* Ticks + labels INSIDE */}
              <div style={{ position: "absolute", inset: 0 }}>
                {ticks.map((t) => {
                  const xPct = (t.v / maxUnits) * 100;
                  const h = t.kind === "major" ? 22 : t.kind === "medium" ? 16 : 10;
                  const lineOpacity = t.kind === "major" ? 0.55 : t.kind === "medium" ? 0.35 : 0.18;

                  return (
                    <div key={t.v}>
                      <div
                        style={{
                          position: "absolute",
                          left: `${xPct}%`,
                          transform: "translateX(-1px)",
                          bottom: 0,
                          width: 2,
                          height: h,
                          background: `rgba(17,17,17,${lineOpacity})`,
                          borderRadius: 2,
                        }}
                      />
                      {t.kind === "major" && (
                        <div
                          style={{
                            position: "absolute",
                            left: `${xPct}%`,
                            transform: "translateX(-50%)",
                            top: 6,
                            fontSize: 11,
                            fontWeight: 950,
                            color: "rgba(17,17,17,0.55)",
                            userSelect: "none",
                          }}
                        >
                          {t.v}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Draw-to cursor */}
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

              {/* Draw-to label */}
              <div
                style={{
                  position: "absolute",
                  left: `${pct * 100}%`,
                  transform: "translateX(-50%)",
                  top: -10,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(17,17,17,0.10)",
                  background: "rgba(17,17,17,0.92)",
                  color: "#fff",
                  fontWeight: 950,
                  fontSize: 12,
                  boxShadow: "0 10px 24px rgba(0,0,0,0.15)",
                  whiteSpace: "nowrap",
                }}
              >
                {fmtUnits(u)}U
              </div>

              {/* Gloss */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0) 70%)",
                  pointerEvents: "none",
                }}
              />
            </div>
          </div>

          {/* Needle */}
          <div
            style={{
              height: 3,
              background: "rgba(17,17,17,0.55)",
              borderRadius: 999,
            }}
            title="Needle"
          />
        </div>

        <div
          style={{
            marginTop: 10,
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            color: "rgba(17,17,17,0.55)",
            fontWeight: 900,
            fontSize: 12,
          }}
        >
          <div>0U</div>
          <div>{maxUnits}U</div>
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
          U-100 reference: 100 units = 1.00 mL • For reference only, no medical advice.
        </div>
      </div>
    </section>
  );
}

export default function CalculatorPage() {
  const isMobile = useIsMobile(720);

  const [maxUnits, setMaxUnits] = useState<SyringeUnits>(100);

  const [vialMg, setVialMg] = useState<string>("10");
  const [waterMl, setWaterMl] = useState<string>("2");
  const [doseMg, setDoseMg] = useState<string>("2.5");

  const pad = isMobile ? 12 : 14;

  const recon = useMemo(() => {
    const mg = toNum(vialMg);
    const ml = toNum(waterMl);
    const dose = toNum(doseMg);

    if (!Number.isFinite(mg) || !Number.isFinite(ml) || mg <= 0 || ml <= 0) {
      return { ok: false as const };
    }

    const concentration = mg / ml; // mg per mL
    if (!Number.isFinite(dose) || dose <= 0) {
      return { ok: true as const, concentration, mlNeeded: NaN, unitsRaw: NaN };
    }

    const mlNeeded = dose / concentration;
    const unitsRaw = mlNeeded * 100; // U-100 scale
    return { ok: true as const, concentration, mlNeeded, unitsRaw };
  }, [vialMg, waterMl, doseMg]);

  const unitsRaw = recon.ok ? recon.unitsRaw : NaN;
  const unitsClamped = Number.isFinite(unitsRaw) ? clamp(unitsRaw, 0, maxUnits) : 0;
  const overMax = Number.isFinite(unitsRaw) && unitsRaw > maxUnits;

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
        <section
          style={{
            ...card,
            marginTop: 12,
            background: "linear-gradient(180deg,#fff 0%, #fff7f3 100%)",
          }}
        >
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

          <div style={{ marginTop: 12, borderTop: `1px solid ${UI.line}`, paddingTop: 12 }}>
            {!recon.ok ? (
              <div style={{ fontWeight: 950, color: UI.muted }}>Enter a valid vial mg and water mL to calculate.</div>
            ) : (
              <>
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
                      {fmt(recon.concentration, 3)} <span style={{ fontSize: 14, color: UI.muted }}>mg/mL</span>
                    </div>
                  </div>

                  <div style={{ border: `1px solid ${UI.line}`, borderRadius: 16, padding: 12, background: "#fff" }}>
                    <div style={{ color: UI.muted, fontWeight: 950, fontSize: 12 }}>Volume</div>
                    <div style={{ fontWeight: 950, color: UI.ink, fontSize: 18 }}>
                      {fmt(recon.mlNeeded, 3)} <span style={{ fontSize: 14, color: UI.muted }}>mL</span>
                    </div>
                  </div>

                  <div
                    style={{
                      border: `1px solid ${UI.line}`,
                      borderRadius: 16,
                      padding: 12,
                      background: overMax ? "rgba(220, 38, 38, 0.08)" : "#fff7f3",
                    }}
                  >
                    <div style={{ color: UI.muted, fontWeight: 950, fontSize: 12 }}>Units (U-100)</div>
                    <div style={{ fontWeight: 980, color: UI.ink, fontSize: 18 }}>
                      True: {fmtUnits(unitsRaw)}U
                      <div style={{ marginTop: 4, fontSize: 13, fontWeight: 950, color: UI.muted }}>
                        Draw to: {fmtUnits(unitsClamped)}U {overMax ? `(max ${maxUnits}U)` : ""}
                      </div>
                    </div>
                  </div>
                </div>

                {overMax ? (
                  <div
                    style={{
                      marginTop: 10,
                      border: "1px solid rgba(220, 38, 38, 0.18)",
                      background: "rgba(220, 38, 38, 0.06)",
                      borderRadius: 16,
                      padding: 12,
                      color: "rgba(127, 29, 29, 0.92)",
                      fontWeight: 900,
                      lineHeight: 1.35,
                    }}
                  >
                    This dose needs <b>{fmtUnits(unitsRaw)}U</b>, which is bigger than a <b>{maxUnits}U</b> syringe.
                    Use a larger syringe size, or split into multiple draws if appropriate.
                  </div>
                ) : null}
              </>
            )}

            <div
              style={{
                marginTop: 12,
                color: "rgba(17,17,17,0.60)",
                fontWeight: 900,
                fontSize: 12,
                lineHeight: 1.4,
              }}
            >
              For general informational use only. Double-check calculations and follow professional medical guidance.
            </div>
          </div>
        </section>

        <div style={{ marginTop: 12 }}>
          <SyringeVisual units={unitsClamped} rawUnits={unitsRaw} maxUnits={maxUnits} />
        </div>
      </AppPage>
    </AppShell>
  );
}
