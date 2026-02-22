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
  routines: "ds_routines_v4",
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
function ymdOf(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function todayYMD() {
  return ymdOf(new Date());
}
function nowTimeHHMM() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function timeFromISO(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtFreq(f?: Frequency) {
  if (!f) return "—";
  if (f === "daily") return "Daily";
  if (f === "weekly") return "Weekly";
  if (f === "twice_weekly") return "2×/week";
  return "3×/week";
}
function toNum(v: string) {
  const t = v.trim().replace(",", ".");
  if (!t) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

/** ---------- UI Bits ---------- */
function Pill({
  active,
  color,
  label,
  sub,
  onClick,
}: {
  active: boolean;
  color: string;
  label: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: "0 0 auto",
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
        boxShadow: active ? "0 12px 26px rgba(0,0,0,0.07)" : "0 10px 20px rgba(0,0,0,0.05)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 10, height: 10, borderRadius: 99, background: color }} />
      <span style={{ display: "inline-flex", flexDirection: "column", lineHeight: 1.1 }}>
        <span>{label}</span>
        {sub ? <span style={{ fontSize: 12, opacity: 0.65, fontWeight: 900 }}>{sub}</span> : null}
      </span>
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
  const [routines, setRoutines] = useState<Routine[]>(DEFAULT_ROUTINES);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string>(DEFAULT_ROUTINES[0].id);

  const [logs, setLogs] = useState<InjectionLog[]>([]);

  // Log sheet
  const [logSheetOpen, setLogSheetOpen] = useState(false);
  const [logRoutineId, setLogRoutineId] = useState<string>(DEFAULT_ROUTINES[0].id);
  const [logDateYMD, setLogDateYMD] = useState<string>(todayYMD());
  const [logTimeHHMM, setLogTimeHHMM] = useState<string>(nowTimeHHMM());
  const [logSpotId, setLogSpotId] = useState<string>(SPOTS[0].id);
  const [logDoseMg, setLogDoseMg] = useState<string>("");
  const [logNotes, setLogNotes] = useState<string>("");

  // Routine sheet (add/edit)
  const [routineSheetOpen, setRoutineSheetOpen] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [rName, setRName] = useState("");
  const [rDose, setRDose] = useState("");
  const [rFreq, setRFreq] = useState<Frequency>("weekly");
  const [rTime, setRTime] = useState("08:00");
  const [rRecon, setRRecon] = useState("");

  // Edit log sheet
  const [editLogId, setEditLogId] = useState<number | null>(null);
  const editingLog = useMemo(() => logs.find((l) => l.id === editLogId) ?? null, [logs, editLogId]);

  const routineById = useMemo(() => {
    const m: Record<string, Routine> = {};
    routines.forEach((r) => (m[r.id] = r));
    return m;
  }, [routines]);

  const routineColorById = useMemo(() => {
    const m: Record<string, string> = {};
    routines.forEach((r, idx) => (m[r.id] = ROUTINE_COLORS[idx % ROUTINE_COLORS.length]));
    return m;
  }, [routines]);

  const selectedRoutine = useMemo(
    () => routines.find((r) => r.id === selectedRoutineId) ?? routines[0],
    [routines, selectedRoutineId]
  );

  // load
  useEffect(() => {
    try {
      const sr = localStorage.getItem(STORAGE_KEYS.routines);
      const sl = localStorage.getItem(STORAGE_KEYS.injectionLogs);
      if (sr) {
        const parsed = JSON.parse(sr);
        if (Array.isArray(parsed) && parsed.length) setRoutines(parsed);
      }
      if (sl) {
        const parsed = JSON.parse(sl);
        if (Array.isArray(parsed)) setLogs(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  // ensure selectedRoutineId exists after load
  useEffect(() => {
    if (!routines.length) return;
    const exists = routines.some((r) => r.id === selectedRoutineId);
    if (!exists) setSelectedRoutineId(routines[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routines]);

  // save
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.routines, JSON.stringify(routines));
    } catch {}
  }, [routines]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.injectionLogs, JSON.stringify(logs));
    } catch {}
  }, [logs]);

  const todayLogs = useMemo(() => {
    const y = todayYMD();
    return logs
      .filter((l) => String(l.injectedAtISO ?? "").slice(0, 10) === y)
      .slice()
      .sort((a, b) => String(b.injectedAtISO).localeCompare(String(a.injectedAtISO)));
  }, [logs]);

  const recentLogs = useMemo(() => logs.slice(0, 12), [logs]);

  function openLogSheet(preset?: { routineId?: string; spotId?: string }) {
    const rid = preset?.routineId ?? selectedRoutineId;
    const r = routineById[rid] ?? routines[0];

    setLogRoutineId(rid);
    setLogDateYMD(todayYMD());
    setLogTimeHHMM(nowTimeHHMM());

    // Default to routine planned dose
    setLogDoseMg(r?.doseMg ?? "");

    // Keep last selected spot if possible, else fallback
    setLogSpotId(preset?.spotId ?? logSpotId ?? SPOTS[0].id);

    setLogNotes("");
    setLogSheetOpen(true);
  }

  function closeLogSheet() {
    setLogSheetOpen(false);
  }

  function logInjection({ keepOpenForAnother }: { keepOpenForAnother: boolean }) {
    const r = routineById[logRoutineId] ?? routines[0];
    const spot = SPOTS.find((s) => s.id === logSpotId) ?? SPOTS[0];

    const injectedISO = new Date(`${logDateYMD}T${logTimeHHMM}`).toISOString();

    const item: InjectionLog = {
      id: Date.now(),
      spotId: spot.id,
      spotLabel: spot.label,
      view: spot.view,
      routineId: r.id,
      routineName: r.name,
      injectedAtISO: injectedISO,
      doseMg: logDoseMg.trim() ? logDoseMg.trim() : undefined,
      notes: logNotes.trim() ? logNotes.trim() : undefined,
      createdAtISO: new Date().toISOString(),
    };

    setLogs((prev) => [item, ...prev]);

    if (keepOpenForAnother) {
      // keep routine + spot + dose + notes? (notes cleared)
      setLogTimeHHMM(nowTimeHHMM());
      setLogNotes("");
      // date stays the same (today default)
      return;
    }

    closeLogSheet();
  }

  function deleteLog(id: number) {
    setLogs((prev) => prev.filter((x) => x.id !== id));
  }

  /** ---- Routine sheet helpers ---- */
  function openAddRoutine() {
    setEditingRoutineId(null);
    setRName(`Routine ${routines.length + 1}`);
    setRDose("2.5");
    setRFreq("weekly");
    setRTime("08:00");
    setRRecon("");
    setRoutineSheetOpen(true);
  }

  function openEditRoutine(id: string) {
    const r = routineById[id];
    if (!r) return;
    setEditingRoutineId(id);
    setRName(r.name ?? "");
    setRDose(r.doseMg ?? "");
    setRFreq((r.frequency ?? "weekly") as Frequency);
    setRTime(r.preferredTime ?? "08:00");
    setRRecon(r.reconstitutedOn ?? "");
    setRoutineSheetOpen(true);
  }

  function saveRoutine() {
    const name = (rName || "").trim() || "Routine";
    const dose = (rDose || "").trim();
    const doseOk = dose === "" || Number.isFinite(toNum(dose));

    if (!doseOk) return;

    if (!editingRoutineId) {
      const id = `r${Date.now()}`;
      const item: Routine = {
        id,
        name,
        doseMg: dose || undefined,
        frequency: rFreq,
        preferredTime: rTime,
        reconstitutedOn: rRecon || undefined,
      };
      setRoutines((prev) => [...prev, item]);
      setSelectedRoutineId(id);
    } else {
      setRoutines((prev) =>
        prev.map((x) =>
          x.id === editingRoutineId
            ? {
                ...x,
                name,
                doseMg: dose || undefined,
                frequency: rFreq,
                preferredTime: rTime,
                reconstitutedOn: rRecon || undefined,
              }
            : x
        )
      );
    }

    setRoutineSheetOpen(false);
  }

  function deleteRoutine(id: string) {
    if (routines.length <= 1) return;

    // Remove routine
    setRoutines((prev) => prev.filter((r) => r.id !== id));

    // Also keep logs (do NOT delete history automatically) – but rename routine if missing
    setLogs((prev) =>
      prev.map((l) => (l.routineId === id ? { ...l, routineName: l.routineName || "Deleted routine" } : l))
    );

    // Reset selected routine if needed
    if (selectedRoutineId === id) {
      const next = routines.filter((r) => r.id !== id);
      if (next.length) setSelectedRoutineId(next[0].id);
    }
  }

  /** ---- Edit log helpers ---- */
  function openEditLog(id: number) {
    setEditLogId(id);
  }
  function closeEditLog() {
    setEditLogId(null);
  }
  function updateLog(patch: Partial<InjectionLog>) {
    if (editLogId == null) return;
    setLogs((prev) => prev.map((l) => (l.id === editLogId ? { ...l, ...patch } : l)));
  }

  return (
    <AppShell
      title="Tracker"
      subtitle="Pick a routine, log injections fast (1–4+ per day), and edit any entry without redoing it."
    >
      <AppPage>
        <style jsx global>{`
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
            border-color: rgba(225, 6, 0, 0.55) !important;
            box-shadow: 0 0 0 4px rgba(225, 6, 0, 0.12);
          }
        `}</style>

        {/* Routine pills + primary action */}
        <Card
          title="Log injection"
          right={
            <button
              onClick={() => openAddRoutine()}
              style={{
                padding: "10px 12px",
                borderRadius: 999,
                border: `1px solid rgba(17,17,17,0.18)`,
                background: "#fff",
                cursor: "pointer",
                fontWeight: 950,
              }}
            >
              + Add routine
            </button>
          }
        >
          <div style={{ color: UI.muted, fontWeight: 850, fontSize: 13, marginBottom: 10 }}>
            Tap a routine below, then hit <b>Log injection</b>.
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              paddingBottom: 6,
            }}
          >
            {routines.map((r) => {
              const active = r.id === selectedRoutineId;
              const sub = `${(r.doseMg ?? "—")}mg • ${fmtFreq(r.frequency)}`;
              return (
                <Pill
                  key={r.id}
                  active={active}
                  color={routineColorById[r.id]}
                  label={r.name}
                  sub={sub}
                  onClick={() => setSelectedRoutineId(r.id)}
                />
              );
            })}
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={() => openLogSheet({ routineId: selectedRoutineId })}
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
                minWidth: 220,
              }}
            >
              Log injection →
            </button>

            <div style={{ color: UI.muted, fontWeight: 850, fontSize: 13 }}>
              Selected: <span style={{ color: UI.ink, fontWeight: 950 }}>{selectedRoutine?.name ?? "—"}</span>
            </div>
          </div>
        </Card>

        {/* Today */}
        <div style={{ marginTop: 14 }}>
          <Card title={`Today (${todayYMD()})`} right={<span style={{ color: UI.muted, fontWeight: 850, fontSize: 12 }}>Edit or delete anytime</span>}>
            {!todayLogs.length ? (
              <div style={{ color: UI.muted, fontWeight: 850 }}>No injections logged today.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {todayLogs.map((l) => (
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
                        {timeFromISO(l.injectedAtISO)}
                        {l.doseMg ? ` • ${l.doseMg}mg` : ""}
                      </div>
                      {l.notes ? (
                        <div style={{ marginTop: 6, color: "rgba(17,17,17,0.70)", fontWeight: 800, fontSize: 13 }}>
                          {l.notes}
                        </div>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => openEditLog(l.id)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 999,
                          border: `1px solid rgba(17,17,17,0.18)`,
                          background: "#fff",
                          cursor: "pointer",
                          fontWeight: 950,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => deleteLog(l.id)}
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
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Recent */}
        <div style={{ marginTop: 14 }}>
          <Card title="Recent injections" right={<span style={{ color: UI.muted, fontWeight: 850, fontSize: 12 }}>Latest first</span>}>
            {!recentLogs.length ? (
              <div style={{ color: UI.muted, fontWeight: 850 }}>No injections logged yet.</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {recentLogs.map((l) => (
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
                        {String(l.injectedAtISO).slice(0, 10)} • {timeFromISO(l.injectedAtISO)}
                        {l.doseMg ? ` • ${l.doseMg}mg` : ""}
                      </div>
                    </div>

                    <button
                      onClick={() => openEditLog(l.id)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 999,
                        border: `1px solid rgba(17,17,17,0.18)`,
                        background: "#fff",
                        cursor: "pointer",
                        fontWeight: 950,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Routines (low-friction management) */}
        <div style={{ marginTop: 14 }}>
          <Card title="Routines" right={null}>
            <div style={{ display: "grid", gap: 10 }}>
              {routines.map((r) => (
                <div
                  key={r.id}
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
                    <div style={{ fontWeight: 950, color: UI.ink, display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 99, background: routineColorById[r.id] }} />
                      {r.name}
                    </div>
                    <div style={{ color: UI.muted, fontWeight: 850, fontSize: 13, marginTop: 4 }}>
                      {(r.doseMg ?? "—")}mg • {fmtFreq(r.frequency)} • {r.preferredTime ?? "—"}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => openLogSheet({ routineId: r.id })}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 999,
                        border: `1px solid ${UI.accent}`,
                        background: UI.accent,
                        color: "#fff",
                        cursor: "pointer",
                        fontWeight: 950,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Log
                    </button>

                    <button
                      onClick={() => openEditRoutine(r.id)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 999,
                        border: `1px solid rgba(17,17,17,0.18)`,
                        background: "#fff",
                        cursor: "pointer",
                        fontWeight: 950,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => deleteRoutine(r.id)}
                      disabled={routines.length <= 1}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 999,
                        border: `1px solid rgba(220, 38, 38, 0.35)`,
                        background: "rgba(220, 38, 38, 0.10)",
                        color: "#b91c1c",
                        cursor: routines.length <= 1 ? "not-allowed" : "pointer",
                        fontWeight: 950,
                        opacity: routines.length <= 1 ? 0.5 : 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Log sheet */}
        {logSheetOpen ? (
          <GlassOverlay onClose={closeLogSheet} align="bottom">
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(760px, 100%)",
                background: "rgba(255,255,255,0.94)",
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
                  <div style={{ color: UI.muted, fontWeight: 850, marginTop: 4, fontSize: 13 }}>
                    Fast log — you can add multiple per day.
                  </div>
                </div>

                <button
                  onClick={closeLogSheet}
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
                      value={logRoutineId}
                      onChange={(e) => {
                        const rid = e.target.value;
                        setLogRoutineId(rid);
                        const planned = routineById[rid]?.doseMg;
                        setLogDoseMg(planned ?? "");
                      }}
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
                    <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Spot</div>
                    <select
                      value={logSpotId}
                      onChange={(e) => setLogSpotId(e.target.value)}
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
                      {SPOTS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Date</div>
                    <input
                      type="date"
                      value={logDateYMD}
                      onChange={(e) => setLogDateYMD(e.target.value)}
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
                      value={logTimeHHMM}
                      onChange={(e) => setLogTimeHHMM(e.target.value)}
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
                    <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Dose (mg)</div>
                    <input
                      value={logDoseMg}
                      onChange={(e) => setLogDoseMg(e.target.value)}
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
                    <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Notes (optional)</div>
                    <input
                      value={logNotes}
                      onChange={(e) => setLogNotes(e.target.value)}
                      placeholder="Anything to remember…"
                      className="inputPremium"
                      style={{
                        width: "100%",
                        padding: 12,
                        borderRadius: 14,
                        border: `1px solid ${UI.line}`,
                        fontWeight: 900,
                        background: "#fff",
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    border: `1px solid rgba(17,17,17,0.10)`,
                    borderRadius: 18,
                    padding: 12,
                    background: "linear-gradient(180deg, #ffffff 0%, #fff7f3 100%)",
                  }}
                >
                  <div style={{ color: UI.muted, fontWeight: 850, fontSize: 13 }}>
                    You can log multiple injections per day — use <b>Log another</b> for fast repeats.
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={() => logInjection({ keepOpenForAnother: true })}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 16,
                        border: `1px solid rgba(17,17,17,0.18)`,
                        background: "#fff",
                        cursor: "pointer",
                        fontWeight: 950,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Log another
                    </button>

                    <button
                      onClick={() => logInjection({ keepOpenForAnother: false })}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 16,
                        border: `1px solid ${UI.accent}`,
                        background: UI.accent,
                        color: "#fff",
                        cursor: "pointer",
                        fontWeight: 950,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Save & close →
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: 10, color: "rgba(17,17,17,0.60)", fontWeight: 800, fontSize: 12, lineHeight: 1.4 }}>
                  For general informational use only. Double-check calculations and follow professional medical guidance.
                </div>
              </div>
            </div>
          </GlassOverlay>
        ) : null}

        {/* Routine sheet */}
        {routineSheetOpen ? (
          <GlassOverlay onClose={() => setRoutineSheetOpen(false)} align="bottom">
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(760px, 100%)",
                background: "rgba(255,255,255,0.94)",
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
                  <div style={{ fontWeight: 950, fontSize: 16, color: UI.ink }}>
                    {editingRoutineId ? "Edit routine" : "Add routine"}
                  </div>
                  <div style={{ color: UI.muted, fontWeight: 850, marginTop: 4, fontSize: 13 }}>
                    Keep it simple: name + dose + frequency is enough.
                  </div>
                </div>

                <button
                  onClick={() => setRoutineSheetOpen(false)}
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
                    <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Name</div>
                    <input
                      value={rName}
                      onChange={(e) => setRName(e.target.value)}
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
                    <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Dose (mg)</div>
                    <input
                      value={rDose}
                      onChange={(e) => setRDose(e.target.value)}
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
                    {!((rDose || "").trim() === "" || Number.isFinite(toNum(rDose))) ? (
                      <div style={{ marginTop: 6, color: "#b91c1c", fontWeight: 850, fontSize: 12 }}>
                        Please enter a valid number (e.g. 2.5)
                      </div>
                    ) : null}
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Frequency</div>
                    <select
                      value={rFreq}
                      onChange={(e) => setRFreq(e.target.value as Frequency)}
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
                    <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Preferred time</div>
                    <input
                      type="time"
                      value={rTime}
                      onChange={(e) => setRTime(e.target.value)}
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
                  <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Reconstituted on (optional)</div>
                  <input
                    type="date"
                    value={rRecon}
                    onChange={(e) => setRRecon(e.target.value)}
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

                <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button
                    onClick={saveRoutine}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 16,
                      border: `1px solid ${UI.accent}`,
                      background: UI.accent,
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 950,
                    }}
                  >
                    Save routine →
                  </button>
                </div>
              </div>
            </div>
          </GlassOverlay>
        ) : null}

        {/* Edit log sheet */}
        {editingLog ? (
          <GlassOverlay onClose={closeEditLog} align="bottom">
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(760px, 100%)",
                background: "rgba(255,255,255,0.94)",
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
                  <div style={{ fontWeight: 950, fontSize: 16, color: UI.ink }}>Edit injection</div>
                  <div style={{ color: UI.muted, fontWeight: 850, marginTop: 4, fontSize: 13 }}>
                    Change spot, dose, time or notes without deleting.
                  </div>
                </div>

                <button
                  onClick={closeEditLog}
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
                      value={editingLog.routineId}
                      onChange={(e) => {
                        const rid = e.target.value;
                        const r = routineById[rid];
                        updateLog({
                          routineId: rid,
                          routineName: r?.name ?? editingLog.routineName,
                        });
                      }}
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
                    <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Spot</div>
                    <select
                      value={editingLog.spotId}
                      onChange={(e) => {
                        const sid = e.target.value;
                        const s = SPOTS.find((x) => x.id === sid) ?? null;
                        updateLog({
                          spotId: sid,
                          spotLabel: s?.label ?? editingLog.spotLabel,
                          view: (s?.view ?? editingLog.view) as any,
                        });
                      }}
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
                      {SPOTS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Date</div>
                    <input
                      type="date"
                      value={String(editingLog.injectedAtISO).slice(0, 10)}
                      onChange={(e) => {
                        const date = e.target.value;
                        const time = String(editingLog.injectedAtISO).slice(11, 16) || "08:00";
                        const iso = new Date(`${date}T${time}`).toISOString();
                        updateLog({ injectedAtISO: iso });
                      }}
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
                      value={String(editingLog.injectedAtISO).slice(11, 16)}
                      onChange={(e) => {
                        const date = String(editingLog.injectedAtISO).slice(0, 10);
                        const time = e.target.value;
                        const iso = new Date(`${date}T${time}`).toISOString();
                        updateLog({ injectedAtISO: iso });
                      }}
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
                    <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Dose (mg)</div>
                    <input
                      value={editingLog.doseMg ?? ""}
                      onChange={(e) => updateLog({ doseMg: e.target.value })}
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
                    <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Notes (optional)</div>
                    <input
                      value={editingLog.notes ?? ""}
                      onChange={(e) => updateLog({ notes: e.target.value })}
                      placeholder="Anything to remember…"
                      className="inputPremium"
                      style={{
                        width: "100%",
                        padding: 12,
                        borderRadius: 14,
                        border: `1px solid ${UI.line}`,
                        fontWeight: 900,
                        background: "#fff",
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={closeEditLog}
                    style={{
                      padding: "12px 14px",
                      borderRadius: 16,
                      border: `1px solid ${UI.accent}`,
                      background: UI.accent,
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 950,
                    }}
                  >
                    Done →
                  </button>
                </div>
              </div>
            </div>
          </GlassOverlay>
        ) : null}
      </AppPage>
    </AppShell>
  );
}