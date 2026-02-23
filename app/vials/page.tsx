"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppShell, AppPage, UI } from "../components/AppShell";

type Frequency = "daily" | "weekly" | "twice_weekly" | "three_times_weekly";

type Routine = {
  id: string;
  name: string;
  doseMg: number; // planned dose per injection
  frequency: Frequency;
  startDate?: string; // YYYY-MM-DD
};

type Vial = {
  id: string;
  name: string; // e.g. Tirz 10mg vial
  routineId?: string;
  vialMg: number; // total mg in vial
  bacMl: number; // water added
  reconDate: string; // YYYY-MM-DD
  usedMg: number; // how much consumed so far
  notes?: string;
  archived?: boolean;
  createdAt: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toNum(v: string) {
  const t = (v ?? "").trim().replace(",", ".");
  if (!t) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

function fmt(n: number, dp = 2) {
  if (!Number.isFinite(n)) return "—";
  const fixed = n.toFixed(dp);
  return fixed.replace(/\.?0+$/, "");
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ✅ Safe frequency label
function freqLabel(freq: any): string {
  const s = typeof freq === "string" ? freq : "";
  return s ? s.split("_").join(" ") : "—";
}

const LS_VIALS = "dosecomp_vials_v1";
const LS_ROUTINES = "ds_routines_v4";

function safeParseArray<T>(s: string | null): T[] | null {
  if (!s) return null;
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as T[]) : null;
  } catch {
    return null;
  }
}

function migrateRoutinesToV4() {
  const TARGET = "ds_routines_v4";
  const LEGACY = ["ds_routines_v3", "ds_routines_v2", "ds_routines", "routines"];

  const current = safeParseArray<any>(localStorage.getItem(TARGET));
  if (!current || current.length === 0) {
    for (const k of LEGACY) {
      const legacyVal = safeParseArray<any>(localStorage.getItem(k));
      if (legacyVal && legacyVal.length > 0) {
        localStorage.setItem(TARGET, JSON.stringify(legacyVal));
        break;
      }
    }
  }

  const finalV4 = safeParseArray<any>(localStorage.getItem(TARGET));
  if (finalV4 && finalV4.length > 0) {
    for (const k of LEGACY) localStorage.removeItem(k);
  }
}

/* -------------------------
   Schedule-accurate run-out helpers
-------------------------- */

function isoDateOnly(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function getDefaultWeekdays(freq: Frequency, anchor: Date) {
  const anchorDow = anchor.getDay(); // 0=Sun..6=Sat
  if (freq === "daily") return [0, 1, 2, 3, 4, 5, 6];
  if (freq === "weekly") return [anchorDow];
  if (freq === "twice_weekly") return [1, 4]; // Mon, Thu
  return [1, 3, 5]; // Mon, Wed, Fri
}

function nextOccurrencesFrom(from: Date, weekdays: number[], count: number): Date[] {
  const out: Date[] = [];
  let cursor = startOfDay(from);

  while (out.length < count) {
    const dow = cursor.getDay();
    if (weekdays.includes(dow)) out.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  return out;
}

function calcRunOutDate(r: Routine, fullShotsLeft: number): string | null {
  if (fullShotsLeft <= 0) return null;

  const anchor = r.startDate ? startOfDay(new Date(r.startDate)) : startOfDay(new Date());
  const weekdays = getDefaultWeekdays(r.frequency, anchor);

  const today = startOfDay(new Date());
  const occurrences = nextOccurrencesFrom(today, weekdays, fullShotsLeft);

  const last = occurrences[fullShotsLeft - 1];
  return last ? isoDateOnly(last) : null;
}

function calcNextDoseDate(r: Routine): string | null {
  const anchor = r.startDate ? startOfDay(new Date(r.startDate)) : startOfDay(new Date());
  const weekdays = getDefaultWeekdays(r.frequency, anchor);

  const today = startOfDay(new Date());
  const next = nextOccurrencesFrom(today, weekdays, 1)[0];
  return next ? isoDateOnly(next) : null;
}

export default function VialsPage() {
  const [vials, setVials] = useState<Vial[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);

  // simple responsive flag (SSR-safe)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 780);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Drawer state
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("Vial");
  const [routineId, setRoutineId] = useState<string>("");
  const [vialMg, setVialMg] = useState("10");
  const [bacMl, setBacMl] = useState("2");
  const [reconDate, setReconDate] = useState(todayISO());
  const [usedMg, setUsedMg] = useState("0");
  const [notes, setNotes] = useState("");

  // Load (with routines migration first)
  useEffect(() => {
    try {
      migrateRoutinesToV4();

      const rv = localStorage.getItem(LS_VIALS);
      const rr = localStorage.getItem(LS_ROUTINES);

      const vv = safeParseArray<Vial>(rv);
      const rrArr = safeParseArray<Routine>(rr);

      if (vv) setVials(vv);

      if (rrArr) {
        const clean = rrArr.filter((r: any) => r && typeof r.id === "string" && typeof r.name === "string");
        setRoutines(clean as Routine[]);
        setRoutineId((clean as any[])[0]?.id ?? "");
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist vials
  useEffect(() => {
    try {
      localStorage.setItem(LS_VIALS, JSON.stringify(vials));
    } catch {}
  }, [vials]);

  const activeVials = useMemo(() => vials.filter((v) => !v.archived), [vials]);

  function vialDerived(v: Vial) {
    const concentration = v.vialMg / v.bacMl; // mg/mL
    const r = routines.find((x) => x.id === v.routineId);
    const dose = (r as any)?.doseMg;
    const remMg = Math.max(0, v.vialMg - v.usedMg);

    let shotsLeftExact = NaN;
    let fullShotsLeft = NaN;

    let nextDoseISO: string | null = null;
    let runOutISO: string | null = null;

    if (dose && dose > 0 && r && (r as any).frequency) {
      shotsLeftExact = remMg / dose;
      fullShotsLeft = Math.floor(shotsLeftExact + 1e-9);

      nextDoseISO = calcNextDoseDate(r as Routine);
      runOutISO = calcRunOutDate(r as Routine, Number.isFinite(fullShotsLeft) ? fullShotsLeft : 0);
    }

    return { concentration, r, dose, remMg, shotsLeftExact, fullShotsLeft, nextDoseISO, runOutISO };
  }

  const lowVialsCount = useMemo(() => {
    let c = 0;
    for (const v of activeVials) {
      const d = vialDerived(v);
      if (Number.isFinite(d.fullShotsLeft) && d.fullShotsLeft <= 2) c++;
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVials, routines]);

  const soonestRunOut = useMemo(() => {
    const dates: string[] = [];
    for (const v of activeVials) {
      const d = vialDerived(v);
      if (d.runOutISO && d.runOutISO !== "—") dates.push(d.runOutISO);
    }
    dates.sort(); // ISO sorts correctly
    return dates[0] ?? "—";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVials, routines]);

  function resetForm() {
    setEditingId(null);
    setName("Vial");
    setRoutineId(routines[0]?.id ?? "");
    setVialMg("10");
    setBacMl("2");
    setReconDate(todayISO());
    setUsedMg("0");
    setNotes("");
  }

  function openNew() {
    resetForm();
    setOpen(true);
  }

  function openEdit(v: Vial) {
    setEditingId(v.id);
    setName(v.name);
    setRoutineId(v.routineId ?? "");
    setVialMg(String(v.vialMg));
    setBacMl(String(v.bacMl));
    setReconDate(v.reconDate);
    setUsedMg(String(v.usedMg));
    setNotes(v.notes ?? "");
    setOpen(true);
  }

  function save() {
    const mg = toNum(vialMg);
    const ml = toNum(bacMl);
    const used = toNum(usedMg);

    if (!Number.isFinite(mg) || mg <= 0) return;
    if (!Number.isFinite(ml) || ml <= 0) return;

    const cleanUsed = Number.isFinite(used) ? clamp(used, 0, mg) : 0;

    if (editingId) {
      setVials((prev) =>
        prev.map((v) =>
          v.id === editingId
            ? {
                ...v,
                name: name.trim() || "Vial",
                routineId: routineId || undefined,
                vialMg: mg,
                bacMl: ml,
                reconDate,
                usedMg: cleanUsed,
                notes: notes.trim() || undefined,
              }
            : v
        )
      );
    } else {
      const next: Vial = {
        id: uid("vial"),
        name: name.trim() || "Vial",
        routineId: routineId || undefined,
        vialMg: mg,
        bacMl: ml,
        reconDate,
        usedMg: cleanUsed,
        notes: notes.trim() || undefined,
        createdAt: Date.now(),
      };
      setVials((prev) => [next, ...prev]);
    }

    setOpen(false);
  }

  function archive(id: string) {
    setVials((prev) => prev.map((v) => (v.id === id ? { ...v, archived: true } : v)));
  }

  function unarchive(id: string) {
    setVials((prev) => prev.map((v) => (v.id === id ? { ...v, archived: false } : v)));
  }

  function adjustUsed(id: string, deltaMg: number) {
    setVials((prev) =>
      prev.map((v) => {
        if (v.id !== id) return v;
        const nextUsed = clamp((v.usedMg ?? 0) + deltaMg, 0, v.vialMg);
        return { ...v, usedMg: nextUsed };
      })
    );
  }

  const card: React.CSSProperties = {
    border: `1px solid ${UI.line}`,
    borderRadius: 18,
    background: UI.card,
    boxShadow: UI.shadow,
    padding: 14,
  };

  const kpiValue: React.CSSProperties = { fontSize: 26, fontWeight: 950, color: UI.ink, letterSpacing: -0.2 };
  const kpiLabel: React.CSSProperties = { marginTop: 6, fontWeight: 850, color: UI.muted, fontSize: 12 };

  const btnPrimary: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 999,
    border: `1px solid rgba(255,106,61,0.55)`,
    background: UI.accent,
    color: "#fff",
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(0,0,0,0.10)",
  };

  const btnSoft: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 999,
    border: `1px solid ${UI.line}`,
    background: "#fff",
    color: UI.ink,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 10px 22px rgba(0,0,0,0.06)",
  };

  const pillMini: React.CSSProperties = {
    padding: "7px 10px",
    borderRadius: 12,
    border: `1px solid rgba(17,17,17,0.14)`,
    background: "#fff",
    color: UI.ink,
    fontWeight: 950,
    cursor: "pointer",
    lineHeight: 1,
    minHeight: 34,
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: 12,
    borderRadius: 14,
    border: `1px solid ${UI.line}`,
    fontWeight: 900,
    background: "#fff",
    color: UI.ink,
    boxSizing: "border-box",
    fontSize: 16,
  };

  return (
    <AppShell title="Stock" subtitle="Know what you have, what’s running low, and what to reorder next.">
      <AppPage>
        {/* KPI row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <div style={card}>
            <div style={kpiValue}>{soonestRunOut}</div>
            <div style={kpiLabel}>Run-out soonest (linked vials)</div>
          </div>

          <div style={{ ...card, border: lowVialsCount > 0 ? `1px solid rgba(255,106,61,0.55)` : `1px solid ${UI.line}` }}>
            <div style={kpiValue}>{lowVialsCount}</div>
            <div style={kpiLabel}>Low vials (≤ 2 shots left)</div>
          </div>

          <div style={card}>
            <div style={kpiValue}>{activeVials.length}</div>
            <div style={kpiLabel}>Total vials (active)</div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={openNew} style={btnPrimary}>
            + Add vial
          </button>

          <div style={{ color: UI.muted, fontWeight: 850, fontSize: 13 }}>
            Tip: Link a vial to a routine to estimate injections left + run-out date.
          </div>
        </div>

        {/* Table */}
        <div style={{ marginTop: 12, ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: 14, borderBottom: `1px solid ${UI.line}`, display: "flex", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontWeight: 950, color: UI.ink }}>Your vials</div>
            <div style={{ color: UI.muted, fontWeight: 850, fontSize: 12 }}>
              {vials.length ? `${activeVials.length} active • ${vials.filter((x) => x.archived).length} archived` : "No vials yet"}
            </div>
          </div>

          {vials.length === 0 ? (
            <div style={{ padding: 14, color: UI.muted, fontWeight: 850, lineHeight: 1.5 }}>
              Add your first vial to start tracking how many injections are left.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
                <thead>
                  <tr style={{ background: "rgba(17,17,17,0.02)" }}>
                    {["Vial", "Routine", "Recon", "Conc.", "Remaining", "Est. left", "Actions"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "12px 14px",
                          fontSize: 12,
                          fontWeight: 950,
                          color: "rgba(17,17,17,0.60)",
                          borderBottom: `1px solid ${UI.line}`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {vials
                    .slice()
                    .sort((a, b) => Number(!!a.archived) - Number(!!b.archived) || (b.createdAt ?? 0) - (a.createdAt ?? 0))
                    .map((v) => {
                      const d = vialDerived(v);
                      const isLow = Number.isFinite(d.fullShotsLeft) && d.fullShotsLeft <= 2;

                      return (
                        <tr key={v.id} style={{ opacity: v.archived ? 0.55 : 1 }}>
                          <td style={{ padding: "12px 14px", borderBottom: `1px solid rgba(17,17,17,0.06)` }}>
                            <div style={{ fontWeight: 950, color: UI.ink }}>{v.name}</div>
                            <div style={{ marginTop: 4, fontWeight: 850, color: UI.muted, fontSize: 12 }}>
                              {fmt(v.vialMg, 1)} mg • {fmt(v.bacMl, 2)} mL
                            </div>
                            {v.notes ? (
                              <div style={{ marginTop: 4, fontWeight: 850, color: "rgba(17,17,17,0.55)", fontSize: 12 }}>
                                {v.notes}
                              </div>
                            ) : null}
                          </td>

                          <td style={{ padding: "12px 14px", borderBottom: `1px solid rgba(17,17,17,0.06)` }}>
                            {d.r ? (
                              <>
                                <div style={{ fontWeight: 950, color: UI.ink }}>{(d.r as any).name ?? "Routine"}</div>
                                <div style={{ marginTop: 4, fontWeight: 850, color: UI.muted, fontSize: 12 }}>
                                  {fmt((d.r as any).doseMg ?? NaN, 2)} mg • {freqLabel((d.r as any).frequency)}
                                </div>
                              </>
                            ) : (
                              <div style={{ fontWeight: 900, color: "rgba(17,17,17,0.55)" }}>Not linked</div>
                            )}
                          </td>

                          <td style={{ padding: "12px 14px", borderBottom: `1px solid rgba(17,17,17,0.06)`, whiteSpace: "nowrap" }}>
                            <div style={{ fontWeight: 900, color: UI.ink }}>{v.reconDate}</div>
                          </td>

                          <td style={{ padding: "12px 14px", borderBottom: `1px solid rgba(17,17,17,0.06)` }}>
                            <div style={{ fontWeight: 950, color: UI.ink }}>{fmt(d.concentration, 2)} mg/mL</div>
                          </td>

                          <td style={{ padding: "12px 14px", borderBottom: `1px solid rgba(17,17,17,0.06)` }}>
                            <div style={{ fontWeight: 950, color: UI.ink }}>{fmt(d.remMg, 1)} mg</div>
                          </td>

                          <td style={{ padding: "12px 14px", borderBottom: `1px solid rgba(17,17,17,0.06)` }}>
                            {Number.isFinite(d.fullShotsLeft) ? (
                              <>
                                <div style={{ fontWeight: 950, color: isLow ? UI.accent : UI.ink }}>{d.fullShotsLeft} shots</div>
                                <div style={{ marginTop: 4, fontWeight: 850, color: UI.muted, fontSize: 12 }}>
                                  Next dose: {d.nextDoseISO ?? "—"} • Run-out: {d.runOutISO ?? "—"}
                                </div>
                              </>
                            ) : (
                              <div style={{ fontWeight: 900, color: "rgba(17,17,17,0.55)" }}>Link a routine</div>
                            )}
                          </td>

                          <td style={{ padding: "12px 14px", borderBottom: `1px solid rgba(17,17,17,0.06)`, whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                              <button onClick={() => openEdit(v)} style={btnSoft}>
                                Edit
                              </button>

                              {!v.archived ? (
                                <>
                                  <button
                                    onClick={() => archive(v.id)}
                                    style={{ ...btnSoft, border: `1px solid rgba(17,17,17,0.18)`, color: "rgba(17,17,17,0.70)" }}
                                  >
                                    Archive
                                  </button>

                                  <div style={{ display: "flex", gap: 8 }}>
                                    <button onClick={() => adjustUsed(v.id, -1)} style={pillMini} title="Decrease used (mg)">
                                      −1
                                    </button>
                                    <button onClick={() => adjustUsed(v.id, +1)} style={pillMini} title="Increase used (mg)">
                                      +1
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <button onClick={() => unarchive(v.id)} style={{ ...btnSoft, border: `1px solid rgba(255,106,61,0.35)`, background: UI.accentSoft }}>
                                  Restore
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Drawer */}
        {open ? (
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              zIndex: 90,
              display: "flex",
              alignItems: isMobile ? "flex-end" : "center",
              justifyContent: "center",
              padding: 12,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(820px, 100%)",
                maxHeight: isMobile ? `calc(88vh - env(safe-area-inset-top))` : "86vh",
                overflow: "hidden",
                background: "rgba(255,255,255,0.92)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                border: `1px solid ${UI.line}`,
                borderRadius: 20,
                boxShadow: "0 24px 70px rgba(0,0,0,0.22)",
                display: "flex",
                flexDirection: "column",
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
                <div>
                  <div style={{ fontWeight: 950, fontSize: 16, color: UI.ink }}>{editingId ? "Edit vial" : "Add vial"}</div>
                  <div style={{ marginTop: 4, fontWeight: 850, color: UI.muted, fontSize: 12 }}>
                    Link to a routine to estimate shots left automatically.
                  </div>
                </div>

                <button
                  onClick={() => setOpen(false)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: `1px solid rgba(255,106,61,0.55)`,
                    background: UI.accent,
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 950,
                    boxShadow: "0 10px 22px rgba(0,0,0,0.10)",
                  }}
                >
                  Close
                </button>
              </div>

              <div style={{ padding: 14, overflow: "auto", WebkitOverflowScrolling: "touch" as any }}>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 950, color: "rgba(17,17,17,0.72)", marginBottom: 8 }}>Vial name</div>
                    <input value={name} onChange={(e) => setName(e.target.value)} style={input} placeholder="e.g. Tirz vial" />
                  </div>

                  <div>
                    <div style={{ fontWeight: 950, color: "rgba(17,17,17,0.72)", marginBottom: 8 }}>Link to routine (optional)</div>
                    <select value={routineId} onChange={(e) => setRoutineId(e.target.value)} style={input}>
                      <option value="">Not linked</option>
                      {routines.map((r: any) => (
                        <option key={r.id} value={r.id}>
                          {r.name} • {fmt(r.doseMg ?? NaN, 2)}mg • {freqLabel(r.frequency)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div style={{ fontWeight: 950, color: "rgba(17,17,17,0.72)", marginBottom: 8 }}>Vial amount (mg)</div>
                    <input value={vialMg} onChange={(e) => setVialMg(e.target.value)} style={input} inputMode="decimal" />
                  </div>

                  <div>
                    <div style={{ fontWeight: 950, color: "rgba(17,17,17,0.72)", marginBottom: 8 }}>BAC water added (mL)</div>
                    <input value={bacMl} onChange={(e) => setBacMl(e.target.value)} style={input} inputMode="decimal" />
                  </div>

                  <div>
                    <div style={{ fontWeight: 950, color: "rgba(17,17,17,0.72)", marginBottom: 8 }}>Reconstituted on</div>
                    <input value={reconDate} onChange={(e) => setReconDate(e.target.value)} style={input} type="date" />
                  </div>

                  <div>
                    <div style={{ fontWeight: 950, color: "rgba(17,17,17,0.72)", marginBottom: 8 }}>Already used (mg)</div>
                    <input value={usedMg} onChange={(e) => setUsedMg(e.target.value)} style={input} inputMode="decimal" />
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={{ fontWeight: 950, color: "rgba(17,17,17,0.72)", marginBottom: 8 }}>Notes (optional)</div>
                    <input value={notes} onChange={(e) => setNotes(e.target.value)} style={input} placeholder="e.g. stored in fridge, batch #" />
                  </div>
                </div>

                <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button onClick={() => setOpen(false)} style={btnSoft}>
                    Cancel
                  </button>
                  <button onClick={save} style={btnPrimary}>
                    Save vial →
                  </button>
                </div>

                <div style={{ marginTop: 12, color: "rgba(17,17,17,0.55)", fontWeight: 850, fontSize: 12, lineHeight: 1.4 }}>
                  For general informational use only. Double-check calculations and follow professional medical guidance.
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </AppPage>
    </AppShell>
  );
}