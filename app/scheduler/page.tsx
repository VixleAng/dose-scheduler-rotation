"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppShell, AppPage, UI } from "../components/AppShell";

type Frequency = "daily" | "weekly" | "twice_weekly" | "three_times_weekly";

type Routine = {
  id: string;
  name: string;
  reconstitutedOn?: string; // YYYY-MM-DD
};

type DoseLog = {
  id: number;
  routineId: string;
  routineName: string;
  amountMg: string; // e.g. "0.25"
  frequency: Frequency;
  doseDateTime: string; // ISO
  createdAt: string; // ISO
};

const STORAGE_KEYS = {
  routines: "ds_routines_v4",
  logs: "ds_logs_v4",
};

const DEFAULT_ROUTINES: Routine[] = [
  { id: "r1", name: "Routine 1" },
  { id: "r2", name: "Routine 2" },
  { id: "r3", name: "Routine 3" },
  { id: "r4", name: "Routine 4" },
  { id: "r5", name: "Routine 5" },
];

const DOSE_MG_QUICK = ["0.1", "0.2", "0.25", "1", "2", "5", "10", "15", "20", "50", "100"];
const ROUTINE_COLORS = ["#2563eb", "#16a34a", "#ea580c", "#7c3aed", "#dc2626"];

/* ---------- helpers ---------- */

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function nowDateTimeLocalValue() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(
    d.getMinutes()
  )}`;
}

function monthLabel(date: Date) {
  return date.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// Monday-first index (Mon=0...Sun=6)
function mondayIndex(daySun0: number) {
  return (daySun0 + 6) % 7;
}

function makeDateTimeLocalForDay(ymd: string, timeHHMM: string) {
  const safe = /^\d{2}:\d{2}$/.test(timeHHMM) ? timeHHMM : "08:00";
  return `${ymd}T${safe}`;
}

function timeFromISO(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isValidMgText(s: string) {
  return /^(\d+(\.\d+)?)$/.test(s.trim());
}

/* ---------- UI bits ---------- */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        marginTop: 14,
        border: `1px solid ${UI.line}`,
        borderRadius: 18,
        padding: 14,
        background: "#fff",
        boxShadow: UI.shadow,
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 10 }}>{title}</div>
      {children}
    </section>
  );
}

function Pill({
  active,
  children,
  onClick,
  tone = "default",
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "solid";
}) {
  const solid = tone === "solid";
  return (
    <button
      onClick={onClick}
      className="pillHover"
      style={{
        padding: "10px 12px",
        borderRadius: 999,
        border: active ? `2px solid ${UI.accent}` : `1px solid ${UI.line}`,
        background: solid ? (active ? UI.accent : UI.ink) : active ? UI.accentSoft : "#fff",
        color: solid ? "#fff" : UI.ink,
        cursor: "pointer",
        fontWeight: 900,
        lineHeight: 1.1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function TinyPill({
  active,
  children,
  onClick,
  disabled,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="pillHover"
      style={{
        padding: "8px 10px",
        borderRadius: 999,
        border: active ? `2px solid ${UI.ink}` : `1px solid ${UI.line}`,
        background: active ? UI.ink : "#fff",
        color: active ? "#fff" : UI.ink,
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 900,
        fontSize: 12,
        opacity: disabled ? 0.55 : 1,
        lineHeight: 1.1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

/* ---------- page ---------- */

export default function SchedulerPage() {
  const [routines, setRoutines] = useState<Routine[]>(DEFAULT_ROUTINES);
  const [selectedRoutineId, setSelectedRoutineId] = useState(DEFAULT_ROUTINES[0].id);
  const [frequency, setFrequency] = useState<Frequency>("weekly");

  const [amountMg, setAmountMg] = useState<string>("0.25");
  const [customAmountMg, setCustomAmountMg] = useState<string>("");
  const [doseDateTimeLocal, setDoseDateTimeLocal] = useState<string>(nowDateTimeLocalValue());

  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedDayYMD, setSelectedDayYMD] = useState<string | null>(null);

  const [dayTime, setDayTime] = useState<string>("08:00");
  const [dayRoutineId, setDayRoutineId] = useState<string>(DEFAULT_ROUTINES[0].id);

  const [pendingMg, setPendingMg] = useState<string | null>(null);
  const [pendingIsCustom, setPendingIsCustom] = useState(false);
  const [dayCustomMg, setDayCustomMg] = useState<string>("");

  const [showRoutineEditor, setShowRoutineEditor] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const todayYMD = useMemo(() => toYMD(new Date()), []);

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

  // Load
  useEffect(() => {
    const sr = localStorage.getItem(STORAGE_KEYS.routines);
    const sl = localStorage.getItem(STORAGE_KEYS.logs);
    if (sr) setRoutines(JSON.parse(sr));
    if (sl) setLogs(JSON.parse(sl));
  }, []);

  // Save
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.routines, JSON.stringify(routines));
  }, [routines]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs));
  }, [logs]);

  // Toast timer
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1100);
    return () => clearTimeout(t);
  }, [toast]);

  // Group logs by day
  const logsByDay = useMemo(() => {
    const map: Record<string, DoseLog[]> = {};
    for (const l of logs) {
      const key = toYMD(new Date(l.doseDateTime));
      if (!map[key]) map[key] = [];
      map[key].push(l);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(a.doseDateTime).getTime() - new Date(b.doseDateTime).getTime());
    }
    return map;
  }, [logs]);

  const dayLogs = selectedDayYMD ? logsByDay[selectedDayYMD] ?? [] : [];

  function addLogForRoutine(dateTimeLocal: string, mg: string, routineId: string) {
    const amount = mg.trim();
    if (!amount) return;

    const r = routineById[routineId] ?? routines[0];

    const item: DoseLog = {
      id: Date.now(),
      routineId: r.id,
      routineName: r.name,
      amountMg: amount,
      frequency,
      doseDateTime: new Date(dateTimeLocal).toISOString(),
      createdAt: new Date().toISOString(),
    };

    setLogs((prev) => [item, ...prev]);
  }

  function logMainForm() {
    const mg = customAmountMg.trim() ? customAmountMg.trim() : amountMg;
    if (!mg) return;

    addLogForRoutine(doseDateTimeLocal, mg, selectedRoutineId);
    setCustomAmountMg("");
    setToast("Saved ✓");
  }

  function deleteLog(id: number) {
    setLogs((prev) => prev.filter((x) => x.id !== id));
  }

  function setRoutineName(id: string, name: string) {
    setRoutines((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)));
  }

  function setRoutineReconstitutedOn(id: string, ymd: string) {
    setRoutines((prev) => prev.map((r) => (r.id === id ? { ...r, reconstitutedOn: ymd } : r)));
  }

  function addRoutine() {
    const newId = `r${Date.now()}`;
    const nextNum = routines.length + 1;
    setRoutines((prev) => [...prev, { id: newId, name: `Routine ${nextNum}` }]);
    setSelectedRoutineId(newId);
    setDayRoutineId(newId);
  }

  function deleteRoutine(id: string) {
    if (routines.length <= 1) return;

    const remaining = routines.filter((r) => r.id !== id);
    setRoutines(remaining);

    if (selectedRoutineId === id) setSelectedRoutineId(remaining[0].id);
    if (dayRoutineId === id) setDayRoutineId(remaining[0].id);

    setLogs((prev) => prev.filter((l) => l.routineId !== id));
  }

  // Calendar cells
  const calendarCells = useMemo(() => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);

    const offset = mondayIndex(start.getDay());
    const daysInMonth = end.getDate();
    const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;

    const cells: Array<{ ymd?: string; dayNum?: number }> = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - offset + 1;
      if (dayNum >= 1 && dayNum <= daysInMonth) {
        const ymd = `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(dayNum)}`;
        cells.push({ ymd, dayNum });
      } else {
        cells.push({});
      }
    }
    return cells;
  }, [calendarMonth]);

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function openDay(ymd: string) {
    setSelectedDayYMD(ymd);
    setDayTime("08:00");
    setDayRoutineId(selectedRoutineId);

    setPendingMg(null);
    setPendingIsCustom(false);
    setDayCustomMg("");
  }

  function pickPresetDose(mg: string) {
    setPendingMg(mg);
    setPendingIsCustom(false);
  }

  function pickCustomDose() {
    if (!dayCustomMg.trim()) return;
    if (!isValidMgText(dayCustomMg)) return;
    setPendingMg(dayCustomMg.trim());
    setPendingIsCustom(true);
  }

  function confirmLogNow() {
    if (!selectedDayYMD) return;
    if (!pendingMg) return;

    const dt = makeDateTimeLocalForDay(selectedDayYMD, dayTime);
    addLogForRoutine(dt, pendingMg, dayRoutineId);

    setToast("Saved ✓");
    setPendingMg(null);
    setPendingIsCustom(false);
    setDayCustomMg("");
  }

  function calendarPreview(items: DoseLog[]) {
    const top = items.slice(0, 2);
    return top.map((l) => ({
      id: l.id,
      label: `${l.routineName} • ${l.amountMg}mg`,
      routineId: l.routineId,
    }));
  }

  return (
    <AppShell title="Dose Scheduler" subtitle="Quick log + a calendar view of your doses.">
      <AppPage>
        <style jsx global>{`
          .pillHover {
            transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease, border-color 160ms ease,
              opacity 160ms ease;
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
            border-color: rgba(255, 106, 61, 0.65) !important;
            box-shadow: 0 0 0 4px rgba(255, 106, 61, 0.12);
          }

          /* Mobile tightening */
          @media (max-width: 520px) {
            .schedTopRow {
              gap: 10px !important;
            }
            .schedHint {
              font-size: 13px !important;
              line-height: 1.3 !important;
            }
            .schedTwoCol {
              grid-template-columns: 1fr !important;
            }
            .routineRow {
              display: grid !important;
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 10px !important;
            }
            .routineBtn {
              width: 100% !important;
              justify-content: center !important;
              padding: 10px 10px !important;
              border-radius: 14px !important;
            }
            .doseChips {
              gap: 8px !important;
            }
            .doseChip {
              padding: 8px 10px !important;
              font-size: 12px !important;
            }
            .calCell {
              height: 86px !important;
              padding: 9px !important;
              border-radius: 14px !important;
            }
          }
        `}</style>

        {/* Toast */}
        {toast && (
          <div
            style={{
              position: "fixed",
              top: 14,
              left: "50%",
              transform: "translateX(-50%)",
              background: UI.ink,
              color: "#fff",
              padding: "10px 14px",
              borderRadius: 999,
              fontWeight: 900,
              zIndex: 100,
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            }}
          >
            {toast}
          </div>
        )}

        {/* Top actions (compact + readable on mobile) */}
        <div
          className="schedTopRow"
          style={{
            marginTop: 12,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div className="schedHint" style={{ color: UI.ink, fontWeight: 900, opacity: 0.82 }}>
            Pick a routine, choose a dose, then log. Tap any day for details.
          </div>

          <TinyPill active={showRoutineEditor} onClick={() => setShowRoutineEditor((v) => !v)}>
            {showRoutineEditor ? "Done" : "Edit routines"}
          </TinyPill>
        </div>

        {/* Routine picker (kept short + 2-column on mobile) */}
        <section style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Routine</div>

          <div className="routineRow" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {routines.map((r) => {
              const active = r.id === selectedRoutineId;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRoutineId(r.id)}
                  className="pillHover routineBtn"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 16,
                    border: active ? `2px solid ${UI.accent}` : `1px solid ${UI.line}`,
                    background: active ? UI.accentSoft : "#fff",
                    color: UI.ink,
                    cursor: "pointer",
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: active ? UI.shadow : "0 10px 24px rgba(0,0,0,0.05)",
                    maxWidth: 260,
                    lineHeight: 1.1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={r.name}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: routineColorById[r.id] }} />
                  {r.name}
                </button>
              );
            })}
          </div>

          {/* Editor */}
          {showRoutineEditor && (
            <Card title="Routine names & reconstitution date">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <div style={{ color: UI.ink, fontWeight: 900 }}>Manage routines</div>

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
                    fontWeight: 900,
                    boxShadow: UI.shadow,
                    whiteSpace: "nowrap",
                  }}
                >
                  + Add routine
                </button>
              </div>

              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                {routines.map((r) => (
                  <div key={r.id} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 99, background: routineColorById[r.id] }} />
                    <input
                      value={r.name}
                      onChange={(e) => setRoutineName(r.id, e.target.value)}
                      className="inputPremium"
                      style={{
                        padding: 10,
                        borderRadius: 12,
                        border: `1px solid ${UI.line}`,
                        minWidth: 220,
                        fontWeight: 900,
                        background: "#fff",
                      }}
                    />

                    <div style={{ fontSize: 12, color: UI.ink, opacity: 0.65, fontWeight: 900 }}>Reconstituted</div>

                    <input
                      type="date"
                      value={r.reconstitutedOn ?? ""}
                      onChange={(e) => setRoutineReconstitutedOn(r.id, e.target.value)}
                      className="inputPremium"
                      style={{ padding: 10, borderRadius: 12, border: `1px solid ${UI.line}`, fontWeight: 900, background: "#fff" }}
                    />

                    <TinyPill active={false} onClick={() => setRoutineReconstitutedOn(r.id, todayYMD)}>
                      Today
                    </TinyPill>

                    <TinyPill active={false} onClick={() => deleteRoutine(r.id)} disabled={routines.length <= 1}>
                      Delete
                    </TinyPill>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </section>

        {/* Quick log (mobile: 1 column, less scrolling) */}
        <Card title="Quick log">
          <div className="schedTwoCol" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Dose */}
            <div>
              <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Dose (mg)</div>

              <div className="doseChips" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {DOSE_MG_QUICK.map((mg) => {
                  const active = amountMg === mg && !customAmountMg.trim();
                  return (
                    <button
                      key={mg}
                      onClick={() => {
                        setAmountMg(mg);
                        setCustomAmountMg("");
                      }}
                      className="pillHover doseChip"
                      style={{
                        padding: "10px 12px",
                        borderRadius: 999,
                        border: active ? `2px solid ${UI.accent}` : `1px solid ${UI.line}`,
                        background: active ? UI.accentSoft : "#fff",
                        cursor: "pointer",
                        fontWeight: 900,
                        color: UI.ink,
                        lineHeight: 1.1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {mg}
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 10 }}>
                <input
                  value={customAmountMg}
                  onChange={(e) => setCustomAmountMg(e.target.value)}
                  placeholder="Custom mg (e.g. 0.35)"
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

            {/* When + Frequency + Save */}
            <div>
              <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>When</div>
              <input
                type="datetime-local"
                value={doseDateTimeLocal}
                onChange={(e) => setDoseDateTimeLocal(e.target.value)}
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

              <div style={{ marginTop: 10, fontWeight: 900, marginBottom: 8, color: UI.ink }}>Frequency</div>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as Frequency)}
                className="inputPremium"
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 14,
                  border: `1px solid ${UI.line}`,
                  fontWeight: 900,
                  background: "#fff",
                }}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="twice_weekly">Twice weekly</option>
                <option value="three_times_weekly">3x weekly</option>
              </select>

              <button
                onClick={logMainForm}
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
                  fontWeight: 900,
                  fontSize: 16,
                  boxShadow: UI.shadow,
                }}
              >
                Save dose →
              </button>
            </div>
          </div>
        </Card>

        {/* Calendar (smaller controls + readable text) */}
        <Card title="Calendar">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 16, color: UI.ink }}>{monthLabel(calendarMonth)}</div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <TinyPill active={false} onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>
                ← Prev
              </TinyPill>

              {/* ✅ this is the one that had the extra ')' in your error */}
              <TinyPill active={false} onClick={() => setCalendarMonth(new Date())}>
                This month
              </TinyPill>

              <TinyPill active={false} onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>
                Next →
              </TinyPill>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
            {weekDays.map((w) => (
              <div key={w} style={{ fontWeight: 900, color: UI.ink, opacity: 0.65, fontSize: 12 }}>
                {w}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
            {calendarCells.map((c, idx) => {
              if (!c.ymd) {
                return (
                  <div
                    key={idx}
                    style={{
                      height: 92,
                      borderRadius: 16,
                      border: `1px solid rgba(17,17,17,0.06)`,
                      background: "rgba(255,255,255,0.6)",
                    }}
                  />
                );
              }

              const items = logsByDay[c.ymd] ?? [];
              const previews = calendarPreview(items);
              const isToday = c.ymd === todayYMD;

              return (
                <button
                  key={c.ymd}
                  onClick={() => openDay(c.ymd!)}
                  className="pillHover calCell"
                  style={{
                    height: 92,
                    borderRadius: 16,
                    border: isToday ? `2px solid ${UI.accent}` : `1px solid ${UI.line}`,
                    background: isToday ? "linear-gradient(180deg, #fff 0%, #fff7f3 100%)" : "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                    padding: 10,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    boxShadow: "0 10px 24px rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 900, color: UI.ink }}>{c.dayNum}</div>
                    {items.length > 0 ? (
                      <div style={{ fontWeight: 900, color: UI.ink, opacity: 0.65, fontSize: 12 }}>{items.length}</div>
                    ) : null}
                  </div>

                  {previews.length ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {previews.map((p) => (
                        <div
                          key={p.id}
                          style={{
                            fontSize: 11,
                            color: UI.ink,
                            opacity: 0.72,
                            fontWeight: 900,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          • {p.label}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "rgba(17,17,17,0.35)", fontWeight: 900 }}>—</div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Day sheet */}
        {selectedDayYMD && (
          <div
            onClick={() => setSelectedDayYMD(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
              padding: 10,
              zIndex: 70,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "rgba(255,255,255,0.9)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                width: "min(900px, 100%)",
                borderRadius: 20,
                border: `1px solid ${UI.line}`,
                boxShadow: "0 24px 70px rgba(0,0,0,0.22)",
                overflow: "hidden",
                maxHeight: "88vh",
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
                  <div style={{ fontSize: 18, fontWeight: 900, color: UI.ink }}>Day details</div>
                  <div style={{ color: UI.ink, opacity: 0.65, fontSize: 13, fontWeight: 900 }}>{selectedDayYMD}</div>
                </div>

                <TinyPill active={false} onClick={() => setSelectedDayYMD(null)}>
                  Close
                </TinyPill>
              </div>

              <div style={{ padding: 14, overflowY: "auto" }}>
                <div className="schedTwoCol" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Time</div>
                    <input
                      type="time"
                      value={dayTime}
                      onChange={(e) => setDayTime(e.target.value)}
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

                  <div>
                    <div style={{ fontWeight: 900, marginBottom: 8, color: UI.ink }}>Routine</div>
                    <select
                      value={dayRoutineId}
                      onChange={(e) => setDayRoutineId(e.target.value)}
                      className="inputPremium"
                      style={{
                        width: "100%",
                        padding: 12,
                        borderRadius: 14,
                        border: `1px solid ${UI.line}`,
                        fontWeight: 900,
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
                </div>

                <div style={{ marginTop: 12, fontWeight: 900, color: UI.ink }}>Pick dose</div>

                <div className="doseChips" style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {DOSE_MG_QUICK.map((mg) => {
                    const active = pendingMg === mg && !pendingIsCustom;
                    return (
                      <button
                        key={mg}
                        onClick={() => pickPresetDose(mg)}
                        className="pillHover doseChip"
                        style={{
                          padding: "10px 12px",
                          borderRadius: 999,
                          border: active ? `2px solid ${UI.accent}` : `1px solid ${UI.line}`,
                          background: active ? UI.accentSoft : "#fff",
                          cursor: "pointer",
                          fontWeight: 900,
                          color: UI.ink,
                        }}
                      >
                        {mg}
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    value={dayCustomMg}
                    onChange={(e) => setDayCustomMg(e.target.value)}
                    placeholder="Custom mg"
                    className="inputPremium"
                    style={{
                      flex: "1 1 220px",
                      padding: 12,
                      borderRadius: 14,
                      border: `1px solid ${UI.line}`,
                      background: "#fff",
                      fontWeight: 900,
                    }}
                  />

                  <TinyPill active={pendingIsCustom} onClick={pickCustomDose}>
                    Use custom
                  </TinyPill>
                </div>

                <button
                  onClick={confirmLogNow}
                  disabled={!pendingMg}
                  className="pillHover"
                  style={{
                    marginTop: 12,
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: 16,
                    border: `1px solid ${UI.accent}`,
                    background: pendingMg ? UI.accent : "rgba(17,17,17,0.18)",
                    color: "#fff",
                    cursor: pendingMg ? "pointer" : "not-allowed",
                    fontWeight: 900,
                    fontSize: 16,
                    boxShadow: UI.shadow,
                  }}
                >
                  Log dose →
                </button>

                <div style={{ marginTop: 14, borderTop: `1px solid ${UI.line}`, paddingTop: 14 }}>
                  <div style={{ fontWeight: 900, color: UI.ink }}>Logs</div>

                  {dayLogs.length === 0 ? (
                    <div style={{ marginTop: 8, color: UI.ink, opacity: 0.65, fontWeight: 900 }}>No dose logs for this day.</div>
                  ) : (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                      {dayLogs.map((l) => (
                        <div
                          key={l.id}
                          style={{
                            border: `1px solid ${UI.line}`,
                            borderRadius: 16,
                            padding: 12,
                            background: "#fff",
                            boxShadow: "0 10px 24px rgba(0,0,0,0.05)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                            <div style={{ fontWeight: 900, color: UI.ink }}>{timeFromISO(l.doseDateTime)}</div>

                            <TinyPill active={false} onClick={() => deleteLog(l.id)}>
                              Delete
                            </TinyPill>
                          </div>

                          <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 900 }}>
                              💉 <span>{l.amountMg}mg</span>
                            </div>
                            <div style={{ fontWeight: 900 }}>
                              🧪 <span>{l.routineName}</span>
                            </div>
                            <div style={{ color: UI.ink, opacity: 0.65, fontWeight: 900 }}>{l.frequency}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </AppPage>
    </AppShell>
  );
}
