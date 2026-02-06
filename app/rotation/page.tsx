"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppShell, AppPage, GlassOverlay, UI } from "../components/AppShell";

type Routine = { id: string; name: string };

type InjectionLog = {
  id: number;
  spotId: string;
  spotLabel: string;
  view: "front" | "back";
  routineId: string;
  routineName: string;
  injectedAtISO: string;
  doseMg?: string;
  notes?: string;
  createdAtISO: string;
};

type Spot = {
  id: string;
  label: string;
  view: "front" | "back";
  group: "abdomen" | "thigh" | "arm" | "glute";
};

const STORAGE_KEYS = {
  routines: "ds_routines_v4",
  logs: "rt_logs_v1",
};

const DEFAULT_ROUTINES: Routine[] = [
  { id: "r1", name: "Routine 1" },
  { id: "r2", name: "Routine 2" },
  { id: "r3", name: "Routine 3" },
  { id: "r4", name: "Routine 4" },
  { id: "r5", name: "Routine 5" },
];

const ROUTINE_COLORS = ["#2563eb", "#16a34a", "#ea580c", "#7c3aed", "#dc2626"];

// Clean, guided spots (no imagery)
const SPOTS: Spot[] = [
  // FRONT
  { id: "f_abd_L", label: "Abdomen — Left", view: "front", group: "abdomen" },
  { id: "f_abd_R", label: "Abdomen — Right", view: "front", group: "abdomen" },
  { id: "f_thigh_L", label: "Thigh — Left", view: "front", group: "thigh" },
  { id: "f_thigh_R", label: "Thigh — Right", view: "front", group: "thigh" },
  { id: "f_arm_L", label: "Upper arm — Left", view: "front", group: "arm" },
  { id: "f_arm_R", label: "Upper arm — Right", view: "front", group: "arm" },

  // BACK
  { id: "b_glute_L", label: "Glute — Left", view: "back", group: "glute" },
  { id: "b_glute_R", label: "Glute — Right", view: "back", group: "glute" },
  { id: "b_arm_L", label: "Upper arm (back) — Left", view: "back", group: "arm" },
  { id: "b_arm_R", label: "Upper arm (back) — Right", view: "back", group: "arm" },
  { id: "b_thigh_L", label: "Thigh (back) — Left", view: "back", group: "thigh" },
  { id: "b_thigh_R", label: "Thigh (back) — Right", view: "back", group: "thigh" },
];

/* ---------------- helpers ---------------- */

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function nowTimeHHMM() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function toLocalTimeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function toLocalDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}
function daysAgoFromISO(iso?: string) {
  if (!iso) return 9999;
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/* ---------------- UI ---------------- */

function SectionCard({
  title,
  children,
  right,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: `1px solid ${UI.line}`,
        borderRadius: 18,
        padding: 14,
        background: UI.card,
        boxShadow: UI.shadow,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ fontWeight: 900, marginBottom: 10, color: UI.ink }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Pill({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`pillHover ${active ? "pulseActive" : ""}`}
      style={{
        padding: "10px 14px",
        borderRadius: 999,
        border: active ? `2px solid ${UI.accent}` : `1px solid rgba(17,17,17,0.18)`,
        background: active ? UI.accentSoft : "#fff",
        cursor: "pointer",
        fontWeight: 900,
        color: UI.ink,
        boxShadow: active ? "0 10px 26px rgba(0,0,0,0.06)" : "none",
      }}
    >
      {children}
    </button>
  );
}

function groupLabel(g: Spot["group"]) {
  switch (g) {
    case "abdomen":
      return "Abdomen";
    case "thigh":
      return "Thigh";
    case "arm":
      return "Upper arm";
    case "glute":
      return "Glute";
  }
}

function groupEmoji(g: Spot["group"]) {
  switch (g) {
    case "abdomen":
      return "🧩";
    case "thigh":
      return "🦵";
    case "arm":
      return "💪";
    case "glute":
      return "🍑";
  }
}

/* ---------------- Page ---------------- */

export default function RotationPage() {
  const [view, setView] = useState<"front" | "back">("front");
  const [routines, setRoutines] = useState<Routine[]>(DEFAULT_ROUTINES);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string>(DEFAULT_ROUTINES[0].id);
  const [logs, setLogs] = useState<InjectionLog[]>([]);

  // ✅ sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);

  const [sheetRoutineId, setSheetRoutineId] = useState<string>(DEFAULT_ROUTINES[0].id);
  const [sheetDateYMD, setSheetDateYMD] = useState<string>(todayYMD());
  const [sheetTimeHHMM, setSheetTimeHHMM] = useState<string>(nowTimeHHMM());
  const [sheetDoseMg, setSheetDoseMg] = useState<string>("");
  const [sheetNotes, setSheetNotes] = useState<string>("");

  useEffect(() => {
    const sr = localStorage.getItem(STORAGE_KEYS.routines);
    const sl = localStorage.getItem(STORAGE_KEYS.logs);
    if (sr) setRoutines(JSON.parse(sr));
    if (sl) setLogs(JSON.parse(sl));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs));
  }, [logs]);

  const routineColorById = useMemo(() => {
    const m: Record<string, string> = {};
    routines.forEach((r, idx) => (m[r.id] = ROUTINE_COLORS[idx % ROUTINE_COLORS.length]));
    return m;
  }, [routines]);

  const routineById = useMemo(() => {
    const m: Record<string, Routine> = {};
    routines.forEach((r) => (m[r.id] = r));
    return m;
  }, [routines]);

  const spotsForView = useMemo(() => SPOTS.filter((s) => s.view === view), [view]);

  const lastUsedBySpot = useMemo(() => {
    // logs are stored newest-first; first time we see spotId is latest use
    const m: Record<string, string> = {};
    for (const l of logs) {
      if (!m[l.spotId]) m[l.spotId] = l.injectedAtISO;
    }
    return m;
  }, [logs]);

  const recommended = useMemo(() => {
    const candidates = spotsForView.map((s) => {
      const last = lastUsedBySpot[s.id];
      const days = daysAgoFromISO(last);
      return { s, days };
    });
    candidates.sort((a, b) => b.days - a.days);
    return candidates[0] ?? null;
  }, [spotsForView, lastUsedBySpot]);

  const selectedSpot = useMemo(() => {
    if (!selectedSpotId) return null;
    return SPOTS.find((s) => s.id === selectedSpotId) ?? null;
  }, [selectedSpotId]);

  const recent = useMemo(() => logs.slice(0, 12), [logs]);

  function openSheet(spot: Spot) {
    setSelectedSpotId(spot.id);
    setSheetOpen(true);
    setSheetRoutineId(selectedRoutineId);
    setSheetDateYMD(todayYMD());
    setSheetTimeHHMM(nowTimeHHMM());
    setSheetDoseMg("");
    setSheetNotes("");
  }

  function closeSheet() {
    setSheetOpen(false);
    setSelectedSpotId(null);
  }

  function logInjection() {
    if (!selectedSpot) return;

    const r = routineById[sheetRoutineId] ?? routines[0];
    const injectedISO = new Date(`${sheetDateYMD}T${sheetTimeHHMM}`).toISOString();

    const item: InjectionLog = {
      id: Date.now(),
      spotId: selectedSpot.id,
      spotLabel: selectedSpot.label,
      view: selectedSpot.view,
      routineId: r.id,
      routineName: r.name,
      injectedAtISO: injectedISO,
      doseMg: sheetDoseMg.trim() ? sheetDoseMg.trim() : undefined,
      notes: sheetNotes.trim() ? sheetNotes.trim() : undefined,
      createdAtISO: new Date().toISOString(),
    };

    setLogs((prev) => [item, ...prev]);
    closeSheet();
  }

  function deleteLog(id: number) {
    setLogs((prev) => prev.filter((x) => x.id !== id));
  }

  const grouped = useMemo(() => {
    const order: Spot["group"][] = view === "front" ? ["abdomen", "thigh", "arm"] : ["glute", "thigh", "arm"];
    const map: Record<string, Spot[]> = {};
    for (const g of order) map[g] = [];
    for (const s of spotsForView) map[s.group].push(s);
    return { order, map };
  }, [spotsForView, view]);

  return (
    <AppShell title="Injection Rotation" subtitle="Pick a jab spot to log. The app recommends the least recently used spot.">
      <AppPage>
        <style jsx global>{`
          @keyframes softPulse {
            0% { transform: translateZ(0) scale(1); }
            50% { transform: translateZ(0) scale(1.03); }
            100% { transform: translateZ(0) scale(1); }
          }
          .pillHover { transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease, border-color 160ms ease; }
          .pillHover:hover { transform: translateY(-1px); box-shadow: 0 12px 28px rgba(0,0,0,0.08); }
          .pulseActive { animation: softPulse 1.7s ease-in-out infinite; }

          /* Mobile-first container + spacing */
          .rtWrap { width: 100%; max-width: 540px; margin: 0 auto; padding: 12px 14px 96px; }
          @media (min-width: 880px) {
            .rtWrap { max-width: 980px; padding: 16px 18px 80px; }
          }

          /* Layout becomes 2-col only on larger screens */
          .rtGrid { margin-top: 16px; display: grid; grid-template-columns: 1fr; gap: 14px; }
          @media (min-width: 880px) {
            .rtGrid { grid-template-columns: 1.1fr 0.9fr; }
          }

          /* Better tap targets on mobile */
          .rtBtn { min-height: 48px; }

          /* Spots: 1 column on small screens, 2 columns from ~420px */
          .spotGrid { margin-top: 10px; display: grid; grid-template-columns: 1fr; gap: 10px; }
          @media (min-width: 420px) {
            .spotGrid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          }

          /* Inputs: clearer contrast + focus ring */
          .inputPremium { outline: none; transition: box-shadow 160ms ease, border-color 160ms ease; }
          .inputPremium:focus { border-color: rgba(255, 106, 61, 0.65) !important; box-shadow: 0 0 0 4px rgba(255, 106, 61, 0.12); }

          /* Make date/time pickers more readable on mobile */
          input[type="date"], input[type="time"] { -webkit-text-fill-color: #111; }
        `}</style>

        <div className="rtWrap">
          {/* Front / Back */}
          <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Pill active={view === "front"} onClick={() => setView("front")}>
              Front
            </Pill>
            <Pill active={view === "back"} onClick={() => setView("back")}>
              Back
            </Pill>
          </div>

          {/* Routine selector */}
          <section style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Default routine</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {routines.map((r) => {
                const active = r.id === selectedRoutineId;
                const color = routineColorById[r.id] ?? UI.ink;
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedRoutineId(r.id)}
                    className="pillHover rtBtn"
                    style={{
                      padding: "12px 12px",
                      borderRadius: 16,
                      border: active ? `2px solid rgba(17,17,17,0.90)` : `1px solid rgba(17,17,17,0.18)`,
                      background: active ? "rgba(17,17,17,0.92)" : "#fff",
                      color: active ? "#fff" : UI.ink,
                      cursor: "pointer",
                      fontWeight: 900,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow: active ? UI.shadow : "0 6px 18px rgba(0,0,0,0.05)",
                    }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
                    {r.name}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Recommendation */}
          <section
            style={{
              marginTop: 14,
              border: `1px solid rgba(17,17,17,0.16)`,
              borderRadius: 18,
              padding: 14,
              background: "linear-gradient(180deg, #ffffff 0%, #fff7f3 100%)",
              boxShadow: UI.shadow,
            }}
          >
            <div style={{ fontWeight: 900, color: UI.ink }}>Next recommended spot</div>
            {recommended ? (
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 900, color: UI.ink }}>
                  {recommended.s.label}
                  <span style={{ color: "rgba(17,17,17,0.55)", fontWeight: 800, marginLeft: 8, fontSize: 13 }}>
                    (last used {recommended.days >= 9999 ? "never" : `${recommended.days}d ago`})
                  </span>
                </div>

                <button
                  onClick={() => openSheet(recommended.s)}
                  className="pillHover rtBtn"
                  style={{
                    padding: "12px 14px",
                    borderRadius: 999,
                    border: `1px solid ${UI.accent}`,
                    background: UI.accent,
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 900,
                    boxShadow: UI.shadow,
                    minWidth: 150,
                  }}
                >
                  Log here →
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 8, color: "rgba(17,17,17,0.55)" }}>Pick a spot to start your rotation history.</div>
            )}
          </section>

          {/* Main layout */}
          <section className="rtGrid">
            {/* Spot buttons */}
            <SectionCard title="Choose a jab spot" right={<span style={{ color: "rgba(17,17,17,0.55)", fontSize: 12, fontWeight: 900 }}>{view.toUpperCase()}</span>}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {grouped.order.map((g) => {
                  const spots = grouped.map[g] ?? [];
                  return (
                    <div key={g}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                        <div style={{ fontWeight: 900, color: UI.ink }}>
                          {groupEmoji(g)} {groupLabel(g)}
                        </div>
                      </div>

                      <div className="spotGrid">
                        {spots.map((s) => {
                          const last = lastUsedBySpot[s.id];
                          const days = daysAgoFromISO(last);
                          const never = days >= 9999;

                          return (
                            <button
                              key={s.id}
                              onClick={() => openSheet(s)}
                              className="pillHover rtBtn"
                              style={{
                                textAlign: "left",
                                padding: 14,
                                borderRadius: 18,
                                border: `1px solid rgba(17,17,17,0.18)`,
                                background: "#fff",
                                cursor: "pointer",
                                boxShadow: "0 10px 26px rgba(0,0,0,0.06)",
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                <div style={{ fontWeight: 900, color: UI.ink, fontSize: 14 }}>{s.label}</div>
                                <div
                                  style={{
                                    padding: "6px 10px",
                                    borderRadius: 999,
                                    border: `1px solid rgba(17,17,17,0.16)`,
                                    background: never ? "rgba(17,17,17,0.04)" : UI.accentSoft,
                                    fontSize: 12,
                                    fontWeight: 900,
                                    color: UI.ink,
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {never ? "Never" : `${days}d`}
                                </div>
                              </div>

                              <div style={{ color: "rgba(17,17,17,0.60)", fontSize: 12, fontWeight: 800 }}>
                                Tap to log → opens sheet
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            {/* Recent */}
            <SectionCard title="Recent injections">
              {recent.length === 0 ? (
                <div style={{ color: "rgba(17,17,17,0.60)", fontWeight: 700 }}>No injections logged yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {recent.map((l) => {
                    const color = routineColorById[l.routineId] ?? UI.ink;
                    return (
                      <div
                        key={l.id}
                        style={{
                          border: `1px solid rgba(17,17,17,0.16)`,
                          borderRadius: 18,
                          padding: 12,
                          background: "#fff",
                          boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                            <span style={{ width: 10, height: 10, borderRadius: 999, background: color, flex: "0 0 auto" }} />
                            <div style={{ fontWeight: 900, color: UI.ink, fontSize: 13, lineHeight: 1.2 }}>
                              {l.routineName} • {l.spotLabel}
                              {l.doseMg ? <span style={{ color: "rgba(17,17,17,0.55)", fontWeight: 800 }}> • {l.doseMg}mg</span> : null}
                            </div>
                          </div>

                          <button
                            onClick={() => deleteLog(l.id)}
                            className="pillHover rtBtn"
                            style={{
                              padding: "10px 12px",
                              borderRadius: 999,
                              border: `1px solid rgba(17,17,17,0.18)`,
                              background: "#fff",
                              cursor: "pointer",
                              fontWeight: 900,
                              fontSize: 12,
                              boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
                            }}
                          >
                            Delete
                          </button>
                        </div>

                        <div style={{ marginTop: 6, color: "rgba(17,17,17,0.60)", fontSize: 12, fontWeight: 700 }}>
                          {toLocalDateLabel(l.injectedAtISO)} • {toLocalTimeLabel(l.injectedAtISO)} • {l.view}
                        </div>

                        {l.notes ? <div style={{ marginTop: 6, color: "rgba(17,17,17,0.78)", fontSize: 12 }}>{l.notes}</div> : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </section>

          {/* Sheet */}
          {sheetOpen && selectedSpot && (
            <GlassOverlay onClose={closeSheet} align="bottom">
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "rgba(255,255,255,0.90)",
                  backdropFilter: "blur(14px)",
                  WebkitBackdropFilter: "blur(14px)",
                  width: "min(760px, 100%)",
                  borderRadius: 20,
                  border: `1px solid rgba(17,17,17,0.18)`,
                  boxShadow: "0 24px 70px rgba(0,0,0,0.22)",
                  overflow: "hidden",
                  maxHeight: "88vh",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ width: 44, height: 5, borderRadius: 999, background: "rgba(17,17,17,0.22)", margin: "10px auto 0" }} />

                <div
                  style={{
                    padding: 14,
                    borderBottom: `1px solid rgba(17,17,17,0.12)`,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: UI.ink }}>Log injection</div>
                    <div style={{ color: "rgba(17,17,17,0.60)", fontSize: 13, fontWeight: 700 }}>
                      {selectedSpot.label} • {selectedSpot.view}
                    </div>
                  </div>

                  <button
                    onClick={closeSheet}
                    className="pillHover rtBtn"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 999,
                      border: `1px solid rgba(17,17,17,0.18)`,
                      background: "#fff",
                      cursor: "pointer",
                      fontWeight: 900,
                      boxShadow: "0 6px 18px rgba(0,0,0,0.05)",
                    }}
                  >
                    Close
                  </button>
                </div>

                <div style={{ padding: 14, overflowY: "auto" }}>
                  <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Routine</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {routines.map((r) => {
                      const active = r.id === sheetRoutineId;
                      const color = routineColorById[r.id] ?? UI.ink;
                      return (
                        <button
                          key={r.id}
                          onClick={() => setSheetRoutineId(r.id)}
                          className={`pillHover rtBtn ${active ? "pulseActive" : ""}`}
                          style={{
                            padding: "12px 12px",
                            borderRadius: 16,
                            border: active ? `2px solid ${UI.accent}` : `1px solid rgba(17,17,17,0.18)`,
                            background: active ? UI.accentSoft : "#fff",
                            color: UI.ink,
                            cursor: "pointer",
                            fontWeight: 900,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            boxShadow: active ? "0 10px 26px rgba(0,0,0,0.06)" : "0 6px 18px rgba(0,0,0,0.04)",
                          }}
                        >
                          <span style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
                          {r.name}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div style={{ flex: "1 1 180px" }}>
                      <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Date</div>
                      <input
                        type="date"
                        value={sheetDateYMD}
                        onChange={(e) => setSheetDateYMD(e.target.value)}
                        className="inputPremium"
                        style={{
                          width: "100%",
                          padding: 12,
                          borderRadius: 14,
                          border: `1px solid rgba(17,17,17,0.18)`,
                          fontSize: 16,
                          fontWeight: 900,
                          background: "#fff",
                          color: UI.ink,
                        }}
                      />
                    </div>

                    <div style={{ flex: "1 1 160px" }}>
                      <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Time</div>
                      <input
                        type="time"
                        value={sheetTimeHHMM}
                        onChange={(e) => setSheetTimeHHMM(e.target.value)}
                        className="inputPremium"
                        style={{
                          width: "100%",
                          padding: 12,
                          borderRadius: 14,
                          border: `1px solid rgba(17,17,17,0.18)`,
                          fontSize: 16,
                          fontWeight: 900,
                          background: "#fff",
                          color: UI.ink,
                        }}
                      />
                    </div>

                    <button
                      onClick={() => {
                        setSheetDateYMD(todayYMD());
                        setSheetTimeHHMM(nowTimeHHMM());
                      }}
                      className="pillHover rtBtn"
                      style={{
                        padding: "12px 14px",
                        borderRadius: 999,
                        border: `1px solid rgba(17,17,17,0.18)`,
                        background: "#fff",
                        cursor: "pointer",
                        fontWeight: 900,
                        boxShadow: "0 6px 18px rgba(0,0,0,0.04)",
                      }}
                    >
                      Now
                    </button>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Optional dose (mg)</div>
                    <input
                      value={sheetDoseMg}
                      onChange={(e) => setSheetDoseMg(e.target.value)}
                      placeholder="e.g. 5"
                      className="inputPremium"
                      style={{
                        width: "min(220px, 100%)",
                        padding: 12,
                        borderRadius: 14,
                        border: `1px solid rgba(17,17,17,0.18)`,
                        fontSize: 16,
                        background: "#fff",
                        color: UI.ink,
                      }}
                    />
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Notes (optional)</div>
                    <textarea
                      value={sheetNotes}
                      onChange={(e) => setSheetNotes(e.target.value)}
                      placeholder="e.g. Easy today"
                      className="inputPremium"
                      style={{
                        width: "100%",
                        minHeight: 84,
                        padding: 12,
                        borderRadius: 14,
                        border: `1px solid rgba(17,17,17,0.18)`,
                        fontSize: 15,
                        resize: "vertical",
                        background: "#fff",
                        color: UI.ink,
                      }}
                    />
                  </div>

                  <div
                    style={{
                      marginTop: 14,
                      border: `1px solid rgba(17,17,17,0.16)`,
                      borderRadius: 18,
                      padding: 14,
                      background: "linear-gradient(180deg, #ffffff 0%, #fff7f3 100%)",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 900, color: UI.ink }}>Ready to save</div>
                      <div style={{ fontSize: 12, color: "rgba(17,17,17,0.60)", marginTop: 4, fontWeight: 700 }}>
                        <b>{routineById[sheetRoutineId]?.name ?? "Routine"}</b> • <b>{selectedSpot.label}</b> •{" "}
                        <b>
                          {sheetDateYMD} {sheetTimeHHMM}
                        </b>
                      </div>
                    </div>

                    <button
                      onClick={logInjection}
                      className="pillHover rtBtn"
                      style={{
                        padding: "14px 16px",
                        borderRadius: 16,
                        border: `1px solid ${UI.accent}`,
                        background: UI.accent,
                        color: "#fff",
                        cursor: "pointer",
                        fontWeight: 900,
                        fontSize: 16,
                        boxShadow: UI.shadow,
                        width: "min(260px, 100%)",
                      }}
                    >
                      Log injection →
                    </button>
                  </div>
                </div>
              </div>
            </GlassOverlay>
          )}
        </div>
      </AppPage>
    </AppShell>
  );
}
