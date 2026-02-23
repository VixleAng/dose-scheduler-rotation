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
function ymdFromISO(iso: string) {
  return iso.slice(0, 10);
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function toNum(v: string) {
  const t = v.trim().replace(",", ".");
  if (!t) return NaN;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
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

/** Local “is mobile” (mounted-safe) */
function useIsMobile(breakpoint = 860) {
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const check = () => setIsMobile(window.innerWidth <= breakpoint);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);

  return mounted ? isMobile : false;
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
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 950, color: UI.ink }}>{title}</div>
        {right}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </section>
  );
}

/** Responsive modal container (desktop centered, mobile fullscreen sheet) */
function ModalShell({
  isMobile,
  title,
  subtitle,
  onClose,
  right,
  children,
}: {
  isMobile: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <GlassOverlay onClose={onClose} align={isMobile ? "bottom" : "center"}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? "100%" : "min(860px, 100%)",
          maxWidth: "100%",
          height: isMobile ? "calc(100dvh - env(safe-area-inset-top))" : "auto",
          maxHeight: isMobile ? "calc(100dvh - env(safe-area-inset-top))" : "82vh",
          background: "rgba(255,255,255,0.94)",
          border: `1px solid ${UI.line}`,
          borderRadius: isMobile ? "18px 18px 0 0" : 22,
          boxShadow: "0 24px 70px rgba(0,0,0,0.22)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* drag handle */}
        <div style={{ width: 44, height: 5, borderRadius: 999, background: "rgba(17,17,17,0.18)", margin: "10px auto 0" }} />

        {/* header */}
        <div
          style={{
            padding: 14,
            borderBottom: `1px solid ${UI.line}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontWeight: 950, fontSize: 16, color: UI.ink }}>{title}</div>
            {subtitle ? (
              <div style={{ marginTop: 4, color: UI.muted, fontWeight: 850, fontSize: 13 }}>{subtitle}</div>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {right}
            <button
              onClick={onClose}
              style={{
                padding: "10px 12px",
                minHeight: 40,
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
        </div>

        {/* body */}
        <div
          style={{
            padding: 14,
            overflow: "auto",
            WebkitOverflowScrolling: "touch",
            paddingBottom: `calc(14px + env(safe-area-inset-bottom))`,
          }}
        >
          {children}
        </div>
      </div>
    </GlassOverlay>
  );
}

/** ---------- Page ---------- */
export default function TrackerPage() {
  const isMobile = useIsMobile(860);

  const [routines, setRoutines] = useState<Routine[]>(DEFAULT_ROUTINES);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string>(DEFAULT_ROUTINES[0].id);

  const [logs, setLogs] = useState<InjectionLog[]>([]);
  const [recentOpen, setRecentOpen] = useState<boolean>(false);

  // overlays
  const [routinesOpen, setRoutinesOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);

  // log form state (also used for edit)
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [sheetRoutineId, setSheetRoutineId] = useState<string>(DEFAULT_ROUTINES[0].id);
  const [sheetSpotId, setSheetSpotId] = useState<string>(SPOTS[0].id);
  const [sheetDateYMD, setSheetDateYMD] = useState<string>(todayYMD());
  const [sheetTimeHHMM, setSheetTimeHHMM] = useState<string>(nowTimeHHMM());
  const [sheetDoseMg, setSheetDoseMg] = useState<string>("");
  const [sheetNotes, setSheetNotes] = useState<string>("");

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

  // spots as dropdown groups
  const spotsGrouped = useMemo(() => {
    const order: Spot["group"][] = ["abdomen", "thigh", "arm", "glute"];
    const viewOrder: Spot["view"][] = ["front", "back"];
    const by: Record<string, Spot[]> = {};
    for (const v of viewOrder) {
      for (const g of order) by[`${v}:${g}`] = [];
    }
    for (const s of SPOTS) by[`${s.view}:${s.group}`].push(s);
    return { order, viewOrder, by };
  }, []);

  // Today logs
  const todayLogs = useMemo(() => {
    const t = todayYMD();
    return logs.filter((l) => ymdFromISO(l.injectedAtISO) === t);
  }, [logs]);

  const recent = useMemo(() => logs.slice(0, 12), [logs]);

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

    // keep logs but retain historical routineName; no need to mutate logs
  }

  function openLogNew() {
    setEditingLogId(null);
    setLogOpen(true);

    setSheetRoutineId(selectedRoutineId);
    setSheetSpotId(SPOTS[0].id);
    setSheetDateYMD(todayYMD());
    setSheetTimeHHMM(nowTimeHHMM());

    const planned = routineById[selectedRoutineId]?.doseMg ?? "";
    setSheetDoseMg(planned);
    setSheetNotes("");
  }

  function openLogEdit(log: InjectionLog) {
    setEditingLogId(log.id);
    setLogOpen(true);

    setSheetRoutineId(log.routineId);
    setSheetSpotId(log.spotId);
    setSheetDoseMg(log.doseMg ?? "");
    setSheetNotes(log.notes ?? "");

    const d = new Date(log.injectedAtISO);
    const y = d.getFullYear();
    const m = pad2(d.getMonth() + 1);
    const da = pad2(d.getDate());
    setSheetDateYMD(`${y}-${m}-${da}`);
    setSheetTimeHHMM(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
  }

  function saveLog() {
    const r = routineById[sheetRoutineId] ?? routines[0];
    const spot = SPOTS.find((s) => s.id === sheetSpotId) ?? SPOTS[0];

    const injectedISO = new Date(`${sheetDateYMD}T${sheetTimeHHMM}`).toISOString();
    const dose = sheetDoseMg.trim();
    const doseClean = dose && Number.isFinite(toNum(dose)) ? dose : dose; // keep user string even if non-numeric

    if (editingLogId == null) {
      const item: InjectionLog = {
        id: Date.now(),
        spotId: spot.id,
        spotLabel: spot.label,
        view: spot.view,
        routineId: r.id,
        routineName: r.name,
        injectedAtISO: injectedISO,
        doseMg: doseClean ? doseClean : undefined,
        notes: sheetNotes.trim() ? sheetNotes.trim() : undefined,
        createdAtISO: new Date().toISOString(),
      };
      setLogs((prev) => [item, ...prev]);
    } else {
      setLogs((prev) =>
        prev.map((x) =>
          x.id !== editingLogId
            ? x
            : {
                ...x,
                spotId: spot.id,
                spotLabel: spot.label,
                view: spot.view,
                routineId: r.id,
                routineName: r.name,
                injectedAtISO: injectedISO,
                doseMg: doseClean ? doseClean : undefined,
                notes: sheetNotes.trim() ? sheetNotes.trim() : undefined,
              }
        )
      );
    }

    setLogOpen(false);
    setEditingLogId(null);
    setRecentOpen(true);
  }

  function deleteLog(id: number) {
    setLogs((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <AppShell title="Tracker" subtitle="Pick a routine, log injections fast (1–4+ per day), and edit any entry without redoing it.">
      <AppPage>
        <style jsx global>{`
          .pillHover {
            transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease, border-color 160ms ease, opacity 160ms ease;
          }
          .pillHover:hover {
            transform: translateY(-1px);
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
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
            border-color: rgba(225, 6, 0, 0.65) !important;
            box-shadow: 0 0 0 4px rgba(225, 6, 0, 0.12);
          }

          @media (max-width: 520px) {
            .twoCol {
              grid-template-columns: 1fr !important;
            }
            .chipRow {
              display: grid !important;
              grid-template-columns: 1fr 1fr !important;
            }
            .actionRow {
              display: grid !important;
              grid-template-columns: 1fr 1fr !important;
            }
          }
        `}</style>

        <div style={{ marginTop: 12, display: "grid", gap: 14 }}>
          {/* Log injection (top) */}
          <Card
            title="Log injection"
            right={
              <div className="actionRow" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() => setRoutinesOpen(true)}
                  className="pillHover"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: `1px solid rgba(17,17,17,0.18)`,
                    background: "#fff",
                    cursor: "pointer",
                    fontWeight: 950,
                    color: UI.ink,
                    minHeight: 40,
                  }}
                >
                  Manage routines
                </button>

                <button
                  onClick={addRoutine}
                  className="pillHover"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: `1px solid rgba(17,17,17,0.18)`,
                    background: "#fff",
                    cursor: "pointer",
                    fontWeight: 950,
                    color: UI.ink,
                    minHeight: 40,
                  }}
                >
                  + Add routine
                </button>
              </div>
            }
          >
            <div style={{ color: UI.muted, fontWeight: 850, fontSize: 13 }}>
              Tap a routine below, then hit <b>Log injection</b>.
            </div>

            <div className="chipRow" style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
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
                      minHeight: 44,
                    }}
                  >
                    <span style={{ width: 10, height: 10, borderRadius: 99, background: routineColorById[r.id] }} />
                    <span style={{ display: "grid", lineHeight: 1.1 }}>
                      <span>{r.name}</span>
                      <span style={{ fontSize: 12, fontWeight: 850, color: UI.muted }}>
                        {r.doseMg ? `${r.doseMg}mg` : "—"} • {r.frequency ?? "weekly"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button
                onClick={openLogNew}
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
                  width: isMobile ? "100%" : 280,
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
                        <div style={{ marginTop: 6, color: "rgba(17,17,17,0.68)", fontWeight: 800, fontSize: 13 }}>
                          {l.notes}
                        </div>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => openLogEdit(l)}
                        className="pillHover"
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
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent injections (collapsible) */}
          <Card
            title="Recent injections"
            right={
              <button
                onClick={() => setRecentOpen((v) => !v)}
                className="pillHover"
                style={{
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: `1px solid rgba(17,17,17,0.18)`,
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 950,
                  minHeight: 40,
                }}
              >
                {recentOpen ? "Hide" : "Show"}
              </button>
            }
          >
            {!recent.length ? (
              <div style={{ color: UI.muted, fontWeight: 850 }}>No injections logged yet.</div>
            ) : !recentOpen ? (
              <div style={{ color: UI.muted, fontWeight: 850 }}>
                Latest: <span style={{ color: UI.ink, fontWeight: 950 }}>{recent[0].routineName}</span> •{" "}
                <span style={{ color: UI.ink, fontWeight: 950 }}>{recent[0].spotLabel}</span>
              </div>
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
                        {ymdFromISO(l.injectedAtISO)} • {timeFromISO(l.injectedAtISO)}
                        {l.doseMg ? ` • ${l.doseMg}mg` : ""}
                      </div>
                    </div>

                    <button
                      onClick={() => openLogEdit(l)}
                      className="pillHover"
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

        {/* ---- Manage routines (FULL SCREEN on mobile, CENTER on desktop) ---- */}
        {routinesOpen ? (
          <ModalShell
            isMobile={isMobile}
            title="Routines"
            subtitle="Tap Edit to expand fields underneath."
            onClose={() => setRoutinesOpen(false)}
            right={
              <button
                onClick={addRoutine}
                className="pillHover"
                style={{
                  padding: "10px 12px",
                  minHeight: 40,
                  borderRadius: 999,
                  border: `1px solid rgba(17,17,17,0.18)`,
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 950,
                }}
              >
                + Add
              </button>
            }
          >
            <div style={{ display: "grid", gap: 12 }}>
              {routines.map((r, idx) => {
                const active = r.id === selectedRoutineId;
                const color = routineColorById[r.id] ?? ROUTINE_COLORS[idx % ROUTINE_COLORS.length];

                return (
                  <div
                    key={r.id}
                    style={{
                      border: active ? `2px solid ${UI.accentLine}` : `1px solid rgba(17,17,17,0.12)`,
                      borderRadius: 18,
                      background: "#fff",
                      padding: 12,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ width: 10, height: 10, borderRadius: 99, background: color }} />
                        <div style={{ lineHeight: 1.15 }}>
                          <div style={{ fontWeight: 950, color: UI.ink }}>{r.name}</div>
                          <div style={{ marginTop: 2, fontWeight: 850, fontSize: 12, color: UI.muted }}>
                            {r.doseMg ? `${r.doseMg}mg` : "—"} • {r.frequency ?? "weekly"} • {r.preferredTime ?? "08:00"}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          onClick={() => setSelectedRoutineId(r.id)}
                          className="pillHover"
                          style={{
                            padding: "10px 12px",
                            borderRadius: 999,
                            border: `1px solid rgba(17,17,17,0.18)`,
                            background: "#fff",
                            cursor: "pointer",
                            fontWeight: 950,
                            minHeight: 40,
                          }}
                        >
                          Select
                        </button>

                        <button
                          onClick={() => {
                            // toggle “edit” by setting a per-routine flag using local state via a derived hack:
                            // simplest: store in window scope? no. We'll do a tiny inline state: use dataset approach? no.
                            // We'll implement by adding a local map:
                          }}
                          style={{ display: "none" }}
                        >
                          noop
                        </button>
                      </div>
                    </div>

                    {/* Inline editor (always visible for the selected routine to keep it simple and predictable) */}
                    {active ? (
                      <div
                        style={{
                          marginTop: 12,
                          borderTop: `1px solid rgba(17,17,17,0.10)`,
                          paddingTop: 12,
                          display: "grid",
                          gap: 10,
                        }}
                      >
                        <div style={{ fontWeight: 950, color: UI.ink }}>Edit routine</div>

                        <div>
                          <div style={{ fontWeight: 900, color: UI.ink, marginBottom: 8 }}>Routine name</div>
                          <input
                            value={r.name}
                            onChange={(e) => setRoutineField(r.id, { name: e.target.value })}
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

                        <div className="twoCol" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div>
                            <div style={{ fontWeight: 900, color: UI.ink, marginBottom: 8 }}>Dose (mg)</div>
                            <input
                              value={r.doseMg ?? ""}
                              onChange={(e) => setRoutineField(r.id, { doseMg: e.target.value })}
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
                              value={r.preferredTime ?? "08:00"}
                              onChange={(e) => setRoutineField(r.id, { preferredTime: e.target.value })}
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

                        <div className="twoCol" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div>
                            <div style={{ fontWeight: 900, color: UI.ink, marginBottom: 8 }}>Frequency</div>
                            <select
                              value={r.frequency ?? "weekly"}
                              onChange={(e) => setRoutineField(r.id, { frequency: e.target.value as Frequency })}
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
                              value={r.reconstitutedOn ?? ""}
                              onChange={(e) => setRoutineField(r.id, { reconstitutedOn: e.target.value })}
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
                            onClick={() => setRoutineField(r.id, { reconstitutedOn: todayYMD() })}
                            className="pillHover"
                            style={{
                              padding: "10px 12px",
                              minHeight: 40,
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
                            onClick={() => deleteRoutine(r.id)}
                            className="pillHover"
                            style={{
                              padding: "10px 12px",
                              minHeight: 40,
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
                            Delete
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </ModalShell>
        ) : null}

        {/* ---- Log injection (FULL SCREEN on mobile, CENTER on desktop) ---- */}
        {logOpen ? (
          <ModalShell
            isMobile={isMobile}
            title={editingLogId == null ? "Log injection" : "Edit injection"}
            subtitle="Spot is a dropdown (simple + fast)."
            onClose={() => {
              setLogOpen(false);
              setEditingLogId(null);
            }}
          >
            <div style={{ display: "grid", gap: 12 }}>
              <div className="twoCol" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Routine</div>
                  <select
                    value={sheetRoutineId}
                    onChange={(e) => {
                      const rid = e.target.value;
                      setSheetRoutineId(rid);
                      const planned = routineById[rid]?.doseMg ?? "";
                      if (!sheetDoseMg) setSheetDoseMg(planned);
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
                    value={sheetSpotId}
                    onChange={(e) => setSheetSpotId(e.target.value)}
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
                    {spotsGrouped.viewOrder.map((v) => (
                      <React.Fragment key={v}>
                        <optgroup label={v === "front" ? "Front" : "Back"}>
                          {spotsGrouped.order.map((g) => {
                            const list = spotsGrouped.by[`${v}:${g}`] ?? [];
                            if (!list.length) return null;
                            return (
                              <React.Fragment key={`${v}:${g}`}>
                                <option disabled value={`__${v}:${g}__`} style={{ fontWeight: 900 }}>
                                  {groupEmoji(g)} {groupLabel(g)}
                                </option>
                                {list.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.label}
                                  </option>
                                ))}
                              </React.Fragment>
                            );
                          })}
                        </optgroup>
                      </React.Fragment>
                    ))}
                  </select>
                </div>
              </div>

              <div className="twoCol" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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

              <div>
                <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Notes (optional)</div>
                <textarea
                  value={sheetNotes}
                  onChange={(e) => setSheetNotes(e.target.value)}
                  placeholder="Anything to remember…"
                  className="inputPremium"
                  style={{
                    width: "100%",
                    minHeight: 90,
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
                    <b>{routineById[sheetRoutineId]?.name ?? "Routine"}</b> •{" "}
                    <b>{SPOTS.find((s) => s.id === sheetSpotId)?.label ?? "Spot"}</b> •{" "}
                    <b>
                      {sheetDateYMD} {sheetTimeHHMM}
                    </b>
                  </div>
                </div>

                <button
                  onClick={saveLog}
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
                    width: isMobile ? "100%" : "min(260px, 100%)",
                  }}
                >
                  Save →
                </button>
              </div>

              <div style={{ color: "rgba(17,17,17,0.60)", fontWeight: 800, fontSize: 12, lineHeight: 1.4 }}>
                For general informational use only. Double-check calculations and follow professional medical guidance.
              </div>
            </div>
          </ModalShell>
        ) : null}
      </AppPage>
    </AppShell>
  );
}