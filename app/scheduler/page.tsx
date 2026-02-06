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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function nowDateTimeLocalValue() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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

  // Mutations
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

  // Calendar
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
  const todayYMD = toYMD(new Date());

  function calendarPreview(items: DoseLog[]) {
    const top = items.slice(0, 2);
    return top.map((l) => ({
      id: l.id,
      label: `${l.routineName} • ${l.amountMg}mg`,
      routineId: l.routineId,
    }));
  }

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

  return (
    <AppShell title="Dose Scheduler" subtitle="Quick log + a calendar view of your doses.">
      <AppPage>
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

        {/* Top actions */}
        <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ color: UI.muted, fontWeight: 800 }}>
            Pick a routine, choose a dose, then log. Tap any day for details.
          </div>

          <button
            onClick={() => setShowRoutineEditor((v) => !v)}
            style={{
              padding: "10px 12px",
              borderRadius: 999,
              border: `1px solid ${UI.line}`,
              background: "#fff",
              cursor: "pointer",
              fontWeight: 900,
              boxShadow: UI.shadow,
            }}
          >
            {showRoutineEditor ? "Done" : "Edit routines"}
          </button>
        </div>

        {/* Routine picker */}
        <section style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Routine</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {routines.map((r) => {
              const active = r.id === selectedRoutineId;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRoutineId(r.id)}
                  style={{
                    padding: "12px 12px",
                    borderRadius: 16,
                    border: active ? `2px solid ${UI.accent}` : `1px solid ${UI.line}`,
                    background: active ? UI.accentSoft : "#fff",
                    color: UI.ink,
                    cursor: "pointer",
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: UI.shadow,
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: routineColorById[r.id] }} />
                  {r.name}
                </button>
              );
            })}
          </div>

          {/* Editor */}
          {showRoutineEditor && (
            <div style={{ marginTop: 12, border: `1px solid ${UI.line}`, borderRadius: 16, padding: 14, background: "#fff", boxShadow: UI.shadow }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontWeight: 900 }}>Routine names & reconstitution date</div>

                <button
                  onClick={addRoutine}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: `1px solid ${UI.accent}`,
                    background: UI.accent,
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 900,
                    boxShadow: UI.shadow,
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
                      style={{ padding: 10, borderRadius: 12, border: `1px solid ${UI.line}`, minWidth: 220 }}
                    />

                    <div style={{ fontSize: 12, color: UI.muted, fontWeight: 800 }}>Reconstituted</div>
                    <input
                      type="date"
                      value={r.reconstitutedOn ?? ""}
                      onChange={(e) => setRoutineReconstitutedOn(r.id, e.target.value)}
                      style={{ padding: 10, borderRadius: 12, border: `1px solid ${UI.line}` }}
                    />

                    <button
                      onClick={() => setRoutineReconstitutedOn(r.id, todayYMD)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 999,
                        border: `1px solid ${UI.line}`,
                        background: "#fff",
                        cursor: "pointer",
                        fontWeight: 900,
                      }}
                    >
                      Today
                    </button>

                    <button
                      onClick={() => deleteRoutine(r.id)}
                      disabled={routines.length <= 1}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 999,
                        border: `1px solid ${UI.line}`,
                        background: "#fff",
                        cursor: routines.length <= 1 ? "not-allowed" : "pointer",
                        fontWeight: 900,
                        opacity: routines.length <= 1 ? 0.5 : 1,
                      }}
                    >
                      Delete routine
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Quick log */}
        <section style={{ marginTop: 14, border: `1px solid ${UI.line}`, borderRadius: 18, padding: 14, background: "#fff", boxShadow: UI.shadow }}>
          <div style={{ fontWeight: 900 }}>Quick log</div>

          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Dose (mg)</div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {DOSE_MG_QUICK.map((mg) => {
                  const active = amountMg === mg && !customAmountMg.trim();
                  return (
                    <button
                      key={mg}
                      onClick={() => {
                        setAmountMg(mg);
                        setCustomAmountMg("");
                      }}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 999,
                        border: active ? `2px solid ${UI.accent}` : `1px solid ${UI.line}`,
                        background: active ? UI.accentSoft : "#fff",
                        cursor: "pointer",
                        fontWeight: 900,
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
                  style={{ width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${UI.line}` }}
                />
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 900, marginBottom: 8 }}>When</div>
              <input
                type="datetime-local"
                value={doseDateTimeLocal}
                onChange={(e) => setDoseDateTimeLocal(e.target.value)}
                style={{ width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${UI.line}`, fontWeight: 900 }}
              />

              <div style={{ marginTop: 10, fontWeight: 900, marginBottom: 8 }}>Frequency</div>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as Frequency)}
                style={{ width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${UI.line}`, fontWeight: 900, background: "#fff" }}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="twice_weekly">Twice weekly</option>
                <option value="three_times_weekly">3x weekly</option>
              </select>

              <button
                onClick={logMainForm}
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
        </section>

        {/* Calendar */}
        <section style={{ marginTop: 14, border: `1px solid ${UI.line}`, borderRadius: 18, padding: 14, background: "#fff", boxShadow: UI.shadow }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{monthLabel(calendarMonth)}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                style={{ padding: "10px 12px", borderRadius: 999, border: `1px solid ${UI.line}`, cursor: "pointer", fontWeight: 900, background: "#fff" }}
              >
                ← Prev
              </button>
              <button
                onClick={() => setCalendarMonth(new Date())}
                style={{ padding: "10px 12px", borderRadius: 999, border: `1px solid ${UI.line}`, cursor: "pointer", fontWeight: 900, background: "#fff" }}
              >
                This month
              </button>
              <button
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                style={{ padding: "10px 12px", borderRadius: 999, border: `1px solid ${UI.line}`, cursor: "pointer", fontWeight: 900, background: "#fff" }}
              >
                Next →
              </button>
            </div>
          </div>

          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
            {weekDays.map((w) => (
              <div key={w} style={{ fontWeight: 900, color: UI.muted, fontSize: 12 }}>
                {w}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
            {calendarCells.map((c, idx) => {
              if (!c.ymd) {
                return <div key={idx} style={{ height: 92, borderRadius: 16, border: `1px solid rgba(17,17,17,0.06)`, background: "rgba(255,255,255,0.6)" }} />;
              }

              const items = logsByDay[c.ymd] ?? [];
              const previews = calendarPreview(items);
              const isToday = c.ymd === todayYMD;

              return (
                <button
                  key={c.ymd}
                  onClick={() => openDay(c.ymd!)}
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
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 900 }}>{c.dayNum}</div>
                    {items.length > 0 ? <div style={{ fontWeight: 900, color: UI.muted, fontSize: 12 }}>{items.length}</div> : null}
                  </div>

                  {previews.length ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      {previews.map((p) => (
                        <div key={p.id} style={{ fontSize: 11, color: UI.muted, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          • {p.label}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "rgba(17,17,17,0.25)" }}>—</div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

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

              <div style={{ padding: 14, borderBottom: `1px solid ${UI.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>Day details</div>
                  <div style={{ color: UI.muted, fontSize: 13 }}>{selectedDayYMD}</div>
                </div>

                <button
                  onClick={() => setSelectedDayYMD(null)}
                  style={{ padding: "10px 12px", borderRadius: 999, border: `1px solid ${UI.line}`, background: "#fff", cursor: "pointer", fontWeight: 900 }}
                >
                  Close
                </button>
              </div>

              <div style={{ padding: 14, overflowY: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>Time</div>
                    <input
                      type="time"
                      value={dayTime}
                      onChange={(e) => setDayTime(e.target.value)}
                      style={{ width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${UI.line}`, fontWeight: 900, background: "#fff" }}
                    />
                  </div>

                  <div>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>Routine</div>
                    <select
                      value={dayRoutineId}
                      onChange={(e) => setDayRoutineId(e.target.value)}
                      style={{ width: "100%", padding: 12, borderRadius: 14, border: `1px solid ${UI.line}`, fontWeight: 900, background: "#fff" }}
                    >
                      {routines.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: 12, fontWeight: 900 }}>Pick dose</div>
                <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {DOSE_MG_QUICK.map((mg) => {
                    const active = pendingMg === mg && !pendingIsCustom;
                    return (
                      <button
                        key={mg}
                        onClick={() => pickPresetDose(mg)}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 999,
                          border: active ? `2px solid ${UI.accent}` : `1px solid ${UI.line}`,
                          background: active ? UI.accentSoft : "#fff",
                          cursor: "pointer",
                          fontWeight: 900,
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
                    style={{ flex: "1 1 220px", padding: 12, borderRadius: 14, border: `1px solid ${UI.line}`, background: "#fff" }}
                  />
                  <button
                    onClick={pickCustomDose}
                    style={{ padding: "12px 14px", borderRadius: 999, border: `1px solid ${UI.line}`, background: "#fff", cursor: "pointer", fontWeight: 900 }}
                  >
                    Use custom
                  </button>
                </div>

                <button
                  onClick={confirmLogNow}
                  disabled={!pendingMg}
                  style={{
                    marginTop: 12,
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: 16,
                    border: `1px solid ${UI.accent}`,
                    background: pendingMg ? UI.accent : "rgba(17,17,17,0.2)",
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
                  <div style={{ fontWeight: 900 }}>Logs</div>

                  {dayLogs.length === 0 ? (
                    <div style={{ marginTop: 8, color: UI.muted }}>No dose logs for this day.</div>
                  ) : (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                      {dayLogs.map((l) => (
                        <div key={l.id} style={{ border: `1px solid ${UI.line}`, borderRadius: 16, padding: 12, background: "#fff" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                            <div style={{ fontWeight: 900 }}>{timeFromISO(l.doseDateTime)}</div>
                            <button
                              onClick={() => deleteLog(l.id)}
                              style={{ padding: "10px 12px", borderRadius: 999, border: `1px solid ${UI.line}`, background: "#fff", cursor: "pointer", fontWeight: 900 }}
                            >
                              Delete
                            </button>
                          </div>

                          <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
                            <div>
                              💉 <b>{l.amountMg}mg</b>
                            </div>
                            <div>
                              🧪 <b>{l.routineName}</b>
                            </div>
                            <div style={{ color: UI.muted, fontWeight: 800 }}>{l.frequency}</div>
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
