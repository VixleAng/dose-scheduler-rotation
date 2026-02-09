"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppShell, AppPage, GlassOverlay, UI } from "../components/AppShell";

/** ---------- Types ---------- */
type Frequency = "daily" | "weekly" | "twice_weekly" | "three_times_weekly";

type Routine = {
  id: string;
  name: string;
  reconstitutedOn?: string; // YYYY-MM-DD
  doseMg?: string; // planned dose for this routine
  frequency?: Frequency;
  preferredTime?: string; // "08:00"
};

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

/** ---------- Storage ---------- */
const STORAGE_KEYS = {
  routines: "ds_routines_v4", // shared with older pages (keeps compatibility)
  injectionLogs: "rt_logs_v1",
};

/** ---------- Defaults ---------- */
const DEFAULT_ROUTINES: Routine[] = [
  { id: "r1", name: "Routine 1", doseMg: "2.5", frequency: "weekly", preferredTime: "08:00" },
  { id: "r2", name: "Routine 2", doseMg: "0.25", frequency: "weekly", preferredTime: "08:00" },
];

const ROUTINE_COLORS = ["#2563eb", "#16a34a", "#ea580c", "#7c3aed", "#dc2626"];

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

/** ---------- Helpers ---------- */
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
function timeFromISO(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function daysAgoFromISO(iso?: string) {
  if (!iso) return 9999;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 9999;
  const diff = Date.now() - t;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
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

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="pillHover"
      style={{
        padding: "10px 12px",
        borderRadius: 14,
        border: active ? `2px solid ${UI.accent}` : `1px solid rgba(17,17,17,0.18)`,
        background: active ? UI.accentSoft : "#fff",
        cursor: "pointer",
        fontWeight: 950,
        color: UI.ink,
        boxShadow: active ? "0 12px 26px rgba(0,0,0,0.06)" : "0 10px 22px rgba(0,0,0,0.04)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        border: `1px solid ${UI.line}`,
        borderRadius: 18,
        padding: 14,
        background: UI.card,
        boxShadow: UI.shadow,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ fontWeight: 950, marginBottom: 10, color: UI.ink }}>{title}</div>
        {right}
      </div>
      {children}
    </section>
  );
}

/** ---------- Page ---------- */
export default function TrackerPage() {
  const [tab, setTab] = useState<"schedule" | "injections">("schedule");

  // routines shared for both sections
  const [routines, setRoutines] = useState<Routine[]>(DEFAULT_ROUTINES);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string>(DEFAULT_ROUTINES[0].id);

  // injection state
  const [view, setView] = useState<"front" | "back">("front");
  const [logs, setLogs] = useState<InjectionLog[]>([]);

  // sheet
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [sheetRoutineId, setSheetRoutineId] = useState<string>(DEFAULT_ROUTINES[0].id);
  const [sheetDateYMD, setSheetDateYMD] = useState<string>(todayYMD());
  const [sheetTimeHHMM, setSheetTimeHHMM] = useState<string>(nowTimeHHMM());
  const [sheetDoseMg, setSheetDoseMg] = useState<string>("");
  const [sheetNotes, setSheetNotes] = useState<string>("");

  const selectedRoutine = useMemo(
    () => routines.find((r) => r.id === selectedRoutineId) ?? routines[0],
    [routines, selectedRoutineId]
  );

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

  // load
  useEffect(() => {
    const sr = localStorage.getItem(STORAGE_KEYS.routines);
    const sl = localStorage.getItem(STORAGE_KEYS.injectionLogs);
    if (sr) setRoutines(JSON.parse(sr));
    if (sl) setLogs(JSON.parse(sl));
  }, []);

  // save
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.routines, JSON.stringify(routines));
  }, [routines]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.injectionLogs, JSON.stringify(logs));
  }, [logs]);

  function setRoutineField(id: string, patch: Partial<Routine>) {
    setRoutines((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRoutine() {
    const nextIdx = routines.length + 1;
    const id = `r${Date.now()}`;
    setRoutines((prev) => [
      ...prev,
      {
        id,
        name: `Routine ${nextIdx}`,
        doseMg: "2.5",
        frequency: "weekly",
        preferredTime: "08:00",
      },
    ]);
    setSelectedRoutineId(id);
  }

  function deleteRoutine(id: string) {
    setRoutines((prev) => {
      const next = prev.filter((r) => r.id !== id);
      if (!next.length) return prev;
      if (selectedRoutineId === id) setSelectedRoutineId(next[0].id);
      return next;
    });
  }

  // injection helpers
  const spotsForView = useMemo(() => SPOTS.filter((s) => s.view === view), [view]);

  const lastUsedBySpot = useMemo(() => {
    const map: Record<string, string | undefined> = {};
    for (const l of logs) {
      if (!map[l.spotId]) map[l.spotId] = l.injectedAtISO;
    }
    return map;
  }, [logs]);

  const recommended = useMemo(() => {
    if (!spotsForView.length) return null;
    let best: { s: Spot; days: number } | null = null;
    for (const s of spotsForView) {
      const last = lastUsedBySpot[s.id];
      const days = daysAgoFromISO(last);
      if (!best || days > best.days) best = { s, days };
    }
    return best;
  }, [spotsForView, lastUsedBySpot]);

  function openSheet(spot: Spot) {
    setSelectedSpotId(spot.id);
    setSheetOpen(true);
    setSheetRoutineId(selectedRoutineId);
    setSheetDateYMD(todayYMD());
    setSheetTimeHHMM(nowTimeHHMM());

    // nice touch: prefill dose from plan (user can edit)
    const planned = routineById[selectedRoutineId]?.doseMg;
    setSheetDoseMg(planned ?? "");
    setSheetNotes("");
  }

  function closeSheet() {
    setSheetOpen(false);
    setSelectedSpotId(null);
  }

  const selectedSpot = useMemo(
    () => (selectedSpotId ? SPOTS.find((s) => s.id === selectedSpotId) ?? null : null),
    [selectedSpotId]
  );

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
    setTab("injections");
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

  const recent = useMemo(() => logs.slice(0, 8), [logs]);

  return (
    <AppShell title="Tracker" subtitle="Set your schedule once, then log injections with rotation guidance.">
      <AppPage>
        <style jsx global>{`
          @keyframes softPulse {
            0% {
              transform: translateZ(0) scale(1);
            }
            50% {
              transform: translateZ(0) scale(1.02);
            }
            100% {
              transform: translateZ(0) scale(1);
            }
          }
          .pillHover {
            transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease, border-color 160ms ease, opacity 160ms ease;
          }
          .pillHover:hover {
            transform: translateY(-1px);
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
          }
          .pulseActive {
            animation: softPulse 1.8s ease-in-out infinite;
          }

          .inputPremium {
            outline: none;
            transition: box-shadow 160ms ease, border-color 160ms ease;
            color: ${UI.ink};
          }
          .inputPremium::placeholder {
            color: rgba(17, 17, 17, 0.42);
            font-weight: 800;
          }
          .inputPremium:focus {
            border-color: rgba(255, 106, 61, 0.65) !important;
            box-shadow: 0 0 0 4px rgba(255, 106, 61, 0.12);
          }

          @media (max-width: 520px) {
            .twoCol {
              grid-template-columns: 1fr !important;
            }
            .routineGrid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
            .spotGrid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>

        {/* Top tabs */}
        <div
          style={{
            marginTop: 12,
            border: `1px solid ${UI.line}`,
            borderRadius: 18,
            padding: 12,
            background: "#fff",
            boxShadow: UI.shadow,
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Chip active={tab === "schedule"} onClick={() => setTab("schedule")}>
              Schedule setup
            </Chip>
            <Chip active={tab === "injections"} onClick={() => setTab("injections")}>
              Injections
            </Chip>
          </div>

          <div style={{ color: UI.muted, fontWeight: 850, fontSize: 13 }}>
            Routine: <span style={{ color: UI.ink, fontWeight: 950 }}>{selectedRoutine?.name ?? "—"}</span>
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 14,
          }}
        >
          {tab === "schedule" ? (
            <>
              <Card
                title="Your schedule"
                right={
                  <button
                    onClick={addRoutine}
                    className="pillHover"
                    style={{
                      padding: "10px 12px",
                      borderRadius: 999,
                      border: `1px solid ${UI.accent}`,
                      background: UI.accent,
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 950,
                      boxShadow: UI.shadow,
                      whiteSpace: "nowrap",
                    }}
                  >
                    + Add routine
                  </button>
                }
              >
                <div
                  className="routineGrid"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  {routines.map((r) => {
                    const active = r.id === selectedRoutineId;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setSelectedRoutineId(r.id)}
                        className={`pillHover ${active ? "pulseActive" : ""}`}
                        style={{
                          textAlign: "left",
                          padding: 12,
                          borderRadius: 16,
                          border: active ? `2px solid ${UI.accent}` : `1px solid rgba(17,17,17,0.18)`,
                          background: active ? UI.accentSoft : "#fff",
                          cursor: "pointer",
                          fontWeight: 950,
                          color: UI.ink,
                          boxShadow: "0 10px 22px rgba(0,0,0,0.05)",
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                          <span style={{ width: 10, height: 10, borderRadius: 99, background: routineColorById[r.id] }} />
                          {r.name}
                        </span>

                        <span style={{ color: "rgba(17,17,17,0.45)", fontWeight: 900 }}>→</span>
                      </button>
                    );
                  })}
                </div>

                {/* Editor */}
                <div
                  className="twoCol"
                  style={{
                    marginTop: 12,
                    display: "grid",
                    gridTemplateColumns: "1.2fr 0.8fr",
                    gap: 12,
                    alignItems: "start",
                  }}
                >
                  <div
                    style={{
                      border: `1px solid rgba(17,17,17,0.10)`,
                      borderRadius: 18,
                      padding: 14,
                      background: "linear-gradient(180deg, #fff 0%, #fff7f3 100%)",
                    }}
                  >
                    <div style={{ fontWeight: 950, color: UI.ink }}>Setup for “{selectedRoutine?.name ?? "Routine"}”</div>
                    <div style={{ marginTop: 6, color: UI.muted, fontWeight: 850, fontSize: 13 }}>
                      This is your plan going forward. You’ll use it when logging injections.
                    </div>

                    <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 900, color: UI.ink, marginBottom: 8 }}>Routine name</div>
                        <input
                          value={selectedRoutine?.name ?? ""}
                          onChange={(e) => setRoutineField(selectedRoutineId, { name: e.target.value })}
                          className="inputPremium"
                          style={{
                            width: "100%",
                            padding: 12,
                            borderRadius: 14,
                            border: `1px solid ${UI.line}`,
                            fontWeight: 950,
                            background: "#fff",
                          }}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 900, color: UI.ink, marginBottom: 8 }}>Dose (mg)</div>
                          <input
                            value={selectedRoutine?.doseMg ?? ""}
                            onChange={(e) => setRoutineField(selectedRoutineId, { doseMg: e.target.value })}
                            placeholder="e.g. 2.5"
                            inputMode="decimal"
                            className="inputPremium"
                            style={{
                              width: "100%",
                              padding: 12,
                              borderRadius: 14,
                              border: `1px solid ${UI.line}`,
                              fontWeight: 950,
                              background: "#fff",
                            }}
                          />
                        </div>

                        <div>
                          <div style={{ fontWeight: 900, color: UI.ink, marginBottom: 8 }}>Preferred time</div>
                          <input
                            value={selectedRoutine?.preferredTime ?? "08:00"}
                            onChange={(e) => setRoutineField(selectedRoutineId, { preferredTime: e.target.value })}
                            type="time"
                            className="inputPremium"
                            style={{
                              width: "100%",
                              padding: 12,
                              borderRadius: 14,
                              border: `1px solid ${UI.line}`,
                              fontWeight: 950,
                              background: "#fff",
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 900, color: UI.ink, marginBottom: 8 }}>Frequency</div>
                          <select
                            value={selectedRoutine?.frequency ?? "weekly"}
                            onChange={(e) => setRoutineField(selectedRoutineId, { frequency: e.target.value as Frequency })}
                            className="inputPremium"
                            style={{
                              width: "100%",
                              padding: 12,
                              borderRadius: 14,
                              border: `1px solid ${UI.line}`,
                              fontWeight: 950,
                              background: "#fff",
                            }}
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="twice_weekly">Twice weekly</option>
                            <option value="three_times_weekly">3× per week</option>
                          </select>
                        </div>

                        <div>
                          <div style={{ fontWeight: 900, color: UI.ink, marginBottom: 8 }}>Reconstituted on</div>
                          <input
                            type="date"
                            value={selectedRoutine?.reconstitutedOn ?? ""}
                            onChange={(e) => setRoutineField(selectedRoutineId, { reconstitutedOn: e.target.value })}
                            className="inputPremium"
                            style={{
                              width: "100%",
                              padding: 12,
                              borderRadius: 14,
                              border: `1px solid ${UI.line}`,
                              fontWeight: 950,
                              background: "#fff",
                            }}
                          />
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          onClick={() => setRoutineField(selectedRoutineId, { reconstitutedOn: todayYMD() })}
                          className="pillHover"
                          style={{
                            padding: "10px 12px",
                            borderRadius: 999,
                            border: `1px solid ${UI.line}`,
                            background: "#fff",
                            cursor: "pointer",
                            fontWeight: 950,
                          }}
                        >
                          Set “Reconstituted” to Today
                        </button>

                        <button
                          onClick={() => deleteRoutine(selectedRoutineId)}
                          className="pillHover"
                          style={{
                            padding: "10px 12px",
                            borderRadius: 999,
                            border: `1px solid rgba(220, 38, 38, 0.35)`,
                            background: "rgba(220, 38, 38, 0.10)",
                            color: "#b91c1c",
                            cursor: routines.length <= 1 ? "not-allowed" : "pointer",
                            fontWeight: 950,
                            opacity: routines.length <= 1 ? 0.5 : 1,
                          }}
                          disabled={routines.length <= 1}
                        >
                          Delete routine
                        </button>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      border: `1px solid rgba(17,17,17,0.10)`,
                      borderRadius: 18,
                      padding: 14,
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontWeight: 950, color: UI.ink }}>Quick start</div>
                    <div style={{ marginTop: 6, color: UI.muted, fontWeight: 850, fontSize: 13, lineHeight: 1.35 }}>
                      When you’re ready, jump to <b>Injections</b> and tap a spot to log.
                    </div>

                    <button
                      onClick={() => setTab("injections")}
                      className="pillHover"
                      style={{
                        marginTop: 12,
                        width: "100%",
                        padding: "14px 16px",
                        borderRadius: 16,
                        border: `1px solid ${UI.accent}`,
                        background: UI.accent,
                        color: "#fff",
                        cursor: "pointer",
                        fontWeight: 950,
                        fontSize: 15,
                        boxShadow: UI.shadow,
                      }}
                    >
                      Go to Injections →
                    </button>

                    <div style={{ marginTop: 10, color: "rgba(17,17,17,0.58)", fontWeight: 850, fontSize: 12 }}>
                      Note: Dashboard calendar can read your planned schedule later (we’re storing it on-device now).
                    </div>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <>
              <Card
                title="Injections"
                right={
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <Chip active={view === "front"} onClick={() => setView("front")}>
                      Front
                    </Chip>
                    <Chip active={view === "back"} onClick={() => setView("back")}>
                      Back
                    </Chip>
                  </div>
                }
              >
                {/* Routine select (needed for logging) */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  {routines.map((r) => {
                    const active = r.id === selectedRoutineId;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setSelectedRoutineId(r.id)}
                        className="pillHover"
                        style={{
                          padding: "10px 12px",
                          borderRadius: 999,
                          border: active ? `2px solid ${UI.accent}` : `1px solid rgba(17,17,17,0.18)`,
                          background: active ? UI.accentSoft : "#fff",
                          cursor: "pointer",
                          fontWeight: 950,
                          color: UI.ink,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 10,
                          boxShadow: "0 10px 22px rgba(0,0,0,0.05)",
                        }}
                      >
                        <span style={{ width: 10, height: 10, borderRadius: 99, background: routineColorById[r.id] }} />
                        {r.name}
                      </button>
                    );
                  })}
                </div>

                {/* Recommended */}
                <div
                  style={{
                    marginTop: 12,
                    border: `1px solid rgba(17,17,17,0.10)`,
                    borderRadius: 18,
                    padding: 14,
                    background: "linear-gradient(180deg, #ffffff 0%, #fff7f3 100%)",
                  }}
                >
                  <div style={{ fontWeight: 950, color: UI.ink }}>Recommended next spot</div>

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
                      <div style={{ fontSize: 16, fontWeight: 950, color: UI.ink }}>
                        {recommended.s.label}
                        <span style={{ color: "rgba(17,17,17,0.55)", fontWeight: 850, marginLeft: 8, fontSize: 13 }}>
                          (last used {recommended.days >= 9999 ? "never" : `${recommended.days}d ago`})
                        </span>
                      </div>

                      <button
                        onClick={() => openSheet(recommended.s)}
                        className="pillHover"
                        style={{
                          padding: "12px 14px",
                          borderRadius: 999,
                          border: `1px solid ${UI.accent}`,
                          background: UI.accent,
                          color: "#fff",
                          cursor: "pointer",
                          fontWeight: 950,
                          boxShadow: UI.shadow,
                          minWidth: 160,
                        }}
                      >
                        Log here →
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginTop: 8, color: "rgba(17,17,17,0.55)" }}>
                      Pick a spot to start your rotation history.
                    </div>
                  )}
                </div>

                {/* Spots */}
                <div style={{ marginTop: 14, display: "grid", gap: 14 }}>
                  {grouped.order.map((g) => {
                    const spots = grouped.map[g] ?? [];
                    return (
                      <div key={g}>
                        <div style={{ fontWeight: 950, color: UI.ink, marginBottom: 8 }}>
                          {groupEmoji(g)} {groupLabel(g)}
                        </div>

                        <div
                          className="spotGrid"
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                            gap: 12,
                          }}
                        >
                          {spots.map((s) => {
                            const last = lastUsedBySpot[s.id];
                            const days = daysAgoFromISO(last);
                            const never = days >= 9999;

                            return (
                              <button
                                key={s.id}
                                onClick={() => openSheet(s)}
                                className="pillHover"
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
                                <div style={{ fontWeight: 950, color: UI.ink, fontSize: 14 }}>{s.label}</div>
                                <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                                  <div
                                    style={{
                                      padding: "6px 10px",
                                      borderRadius: 999,
                                      border: `1px solid rgba(17,17,17,0.12)`,
                                      background: never ? "rgba(17,17,17,0.04)" : "rgba(255,106,61,0.10)",
                                      color: never ? "rgba(17,17,17,0.58)" : "rgba(17,17,17,0.75)",
                                      fontWeight: 900,
                                      fontSize: 12,
                                    }}
                                  >
                                    {never ? "Never used" : `Last: ${days}d ago`}
                                  </div>

                                  <span style={{ opacity: 0.4, fontWeight: 900 }}>→</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Recent injections */}
              <Card title="Recent injections" right={<span style={{ color: UI.muted, fontWeight: 850, fontSize: 12 }}>Latest first</span>}>
                {!recent.length ? (
                  <div style={{ color: UI.muted, fontWeight: 850 }}>No injections logged yet.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {recent.map((l) => (
                      <div
                        key={l.id}
                        style={{
                          border: `1px solid rgba(17,17,17,0.10)`,
                          borderRadius: 16,
                          padding: 12,
                          background: "#fff",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 950, color: UI.ink }}>
                            {l.routineName} • {l.spotLabel}
                          </div>
                          <div style={{ color: UI.muted, fontWeight: 850, fontSize: 13, marginTop: 4 }}>
                            {l.injectedAtISO.slice(0, 10)} • {timeFromISO(l.injectedAtISO)}
                            {l.doseMg ? ` • ${l.doseMg}mg` : ""}
                          </div>
                          {l.notes ? (
                            <div style={{ marginTop: 6, color: "rgba(17,17,17,0.68)", fontWeight: 800, fontSize: 13 }}>
                              {l.notes}
                            </div>
                          ) : null}
                        </div>

                        <button
                          onClick={() => deleteLog(l.id)}
                          className="pillHover"
                          style={{
                            padding: "10px 12px",
                            borderRadius: 999,
                            border: `1px solid rgba(220, 38, 38, 0.35)`,
                            background: "rgba(220, 38, 38, 0.10)",
                            color: "#b91c1c",
                            cursor: "pointer",
                            fontWeight: 950,
                            whiteSpace: "nowrap",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>

        {/* Sheet */}
        {sheetOpen && selectedSpot ? (
          <GlassOverlay onClose={closeSheet} align="bottom">
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(760px, 100%)",
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
                <div>
                  <div style={{ fontWeight: 950, fontSize: 16, color: UI.ink }}>Log injection</div>
                  <div style={{ color: UI.muted, fontWeight: 850, marginTop: 4, fontSize: 13 }}>{selectedSpot.label}</div>
                </div>

                <button
                  onClick={closeSheet}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: `1px solid rgba(220,38,38,0.35)`,
                    background: "rgba(220,38,38,0.10)",
                    color: "#b91c1c",
                    cursor: "pointer",
                    fontWeight: 950,
                  }}
                >
                  Close
                </button>
              </div>

              <div style={{ padding: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Routine</div>
                    <select
                      value={sheetRoutineId}
                      onChange={(e) => setSheetRoutineId(e.target.value)}
                      className="inputPremium"
                      style={{
                        width: "100%",
                        padding: 12,
                        borderRadius: 14,
                        border: `1px solid ${UI.line}`,
                        fontWeight: 950,
                        background: "#fff",
                      }}
                    >
                      {routines.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Dose (mg)</div>
                    <input
                      value={sheetDoseMg}
                      onChange={(e) => setSheetDoseMg(e.target.value)}
                      placeholder="e.g. 2.5"
                      inputMode="decimal"
                      className="inputPremium"
                      style={{
                        width: "100%",
                        padding: 12,
                        borderRadius: 14,
                        border: `1px solid ${UI.line}`,
                        fontWeight: 950,
                        background: "#fff",
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
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
                        border: `1px solid ${UI.line}`,
                        fontWeight: 950,
                        background: "#fff",
                      }}
                    />
                  </div>

                  <div>
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
                        border: `1px solid ${UI.line}`,
                        fontWeight: 950,
                        background: "#fff",
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Notes (optional)</div>
                  <textarea
                    value={sheetNotes}
                    onChange={(e) => setSheetNotes(e.target.value)}
                    placeholder="Anything to remember…"
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
                    <div style={{ fontWeight: 950, color: UI.ink }}>Ready to save</div>
                    <div style={{ fontSize: 12, color: "rgba(17,17,17,0.60)", marginTop: 4, fontWeight: 750 }}>
                      <b>{routineById[sheetRoutineId]?.name ?? "Routine"}</b> • <b>{selectedSpot.label}</b> •{" "}
                      <b>
                        {sheetDateYMD} {sheetTimeHHMM}
                      </b>
                    </div>
                  </div>

                  <button
                    onClick={logInjection}
                    className="pillHover"
                    style={{
                      padding: "14px 16px",
                      borderRadius: 16,
                      border: `1px solid ${UI.accent}`,
                      background: UI.accent,
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 950,
                      fontSize: 16,
                      boxShadow: UI.shadow,
                      width: "min(260px, 100%)",
                    }}
                  >
                    Log injection →
                  </button>
                </div>

                <div style={{ marginTop: 10, color: "rgba(17,17,17,0.60)", fontWeight: 800, fontSize: 12, lineHeight: 1.4 }}>
                  For general informational use only. Double-check calculations and follow professional medical guidance.
                </div>
              </div>
            </div>
          </GlassOverlay>
        ) : null}
      </AppPage>
    </AppShell>
  );
}
