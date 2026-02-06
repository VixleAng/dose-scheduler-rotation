"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppShell, AppPage, GlassOverlay, UI } from "../components/AppShell";

type HealthLog = {
  id: number;
  ymd: string; // YYYY-MM-DD (local day)
  timeHHMM: string; // local time
  weightKg?: string;
  bpSys?: string;
  bpDia?: string;
  restingHr?: string;

  waistCm?: string;
  hipsCm?: string;
  chestCm?: string;

  exerciseType?: string;
  exerciseMins?: string;
  exerciseIntensity?: "low" | "med" | "high";

  notes?: string;

  createdAtISO: string;
};

const STORAGE_KEY = "hb_logs_v1";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function nowHHMM() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
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

// Monday-first index
function mondayIndex(jsDay: number) {
  return (jsDay + 6) % 7;
}

function hasAnyData(l: Partial<HealthLog>) {
  return Boolean(
    (l.weightKg && l.weightKg.trim()) ||
      ((l.bpSys && l.bpSys.trim()) || (l.bpDia && l.bpDia.trim())) ||
      (l.restingHr && l.restingHr.trim()) ||
      (l.waistCm && l.waistCm.trim()) ||
      (l.hipsCm && l.hipsCm.trim()) ||
      (l.chestCm && l.chestCm.trim()) ||
      (l.exerciseType && l.exerciseType.trim()) ||
      (l.exerciseMins && l.exerciseMins.trim()) ||
      l.exerciseIntensity ||
      (l.notes && l.notes.trim())
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
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
      <div style={{ fontWeight: 900, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

export default function HealthBoardPage() {
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedDayYMD, setSelectedDayYMD] = useState<string | null>(null);

  // Form state (new entry)
  const [ymd, setYmd] = useState<string>(todayYMD());
  const [timeHHMM, setTimeHHMM] = useState<string>(nowHHMM());

  const [weightKg, setWeightKg] = useState("");
  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");
  const [restingHr, setRestingHr] = useState("");

  const [waistCm, setWaistCm] = useState("");
  const [hipsCm, setHipsCm] = useState("");
  const [chestCm, setChestCm] = useState("");

  const [exerciseType, setExerciseType] = useState("");
  const [exerciseMins, setExerciseMins] = useState("");
  const [exerciseIntensity, setExerciseIntensity] = useState<
    "low" | "med" | "high" | ""
  >("");

  const [notes, setNotes] = useState("");

  // Load + save
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setLogs(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  }, [logs]);

  const logsByDay = useMemo(() => {
    const map: Record<string, HealthLog[]> = {};
    for (const l of logs) {
      if (!map[l.ymd]) map[l.ymd] = [];
      map[l.ymd].push(l);
    }
    Object.keys(map).forEach((k) =>
      map[k].sort((a, b) => a.timeHHMM.localeCompare(b.timeHHMM))
    );
    return map;
  }, [logs]);

  const dayLogs = selectedDayYMD ? logsByDay[selectedDayYMD] ?? [] : [];

  // Snapshot (latest)
  const latest = useMemo(() => logs[0], [logs]);

  function resetFormToNow() {
    setYmd(todayYMD());
    setTimeHHMM(nowHHMM());
  }

  function clearForm() {
    setWeightKg("");
    setBpSys("");
    setBpDia("");
    setRestingHr("");
    setWaistCm("");
    setHipsCm("");
    setChestCm("");
    setExerciseType("");
    setExerciseMins("");
    setExerciseIntensity("");
    setNotes("");
  }

  function saveEntry() {
    const entry: Partial<HealthLog> = {
      ymd,
      timeHHMM,
      weightKg,
      bpSys,
      bpDia,
      restingHr,
      waistCm,
      hipsCm,
      chestCm,
      exerciseType,
      exerciseMins,
      exerciseIntensity: exerciseIntensity || undefined,
      notes,
    };

    if (!hasAnyData(entry)) return;

    const item: HealthLog = {
      id: Date.now(),
      ymd,
      timeHHMM,
      weightKg: weightKg.trim() ? weightKg.trim() : undefined,
      bpSys: bpSys.trim() ? bpSys.trim() : undefined,
      bpDia: bpDia.trim() ? bpDia.trim() : undefined,
      restingHr: restingHr.trim() ? restingHr.trim() : undefined,
      waistCm: waistCm.trim() ? waistCm.trim() : undefined,
      hipsCm: hipsCm.trim() ? hipsCm.trim() : undefined,
      chestCm: chestCm.trim() ? chestCm.trim() : undefined,
      exerciseType: exerciseType.trim() ? exerciseType.trim() : undefined,
      exerciseMins: exerciseMins.trim() ? exerciseMins.trim() : undefined,
      exerciseIntensity: exerciseIntensity ? exerciseIntensity : undefined,
      notes: notes.trim() ? notes.trim() : undefined,
      createdAtISO: new Date().toISOString(),
    };

    setLogs((prev) => [item, ...prev]);
    clearForm();
    resetFormToNow();
  }

  function deleteLog(id: number) {
    setLogs((prev) => prev.filter((x) => x.id !== id));
  }

  // Calendar grid
  const grid = useMemo(() => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);

    const offset = mondayIndex(start.getDay());
    const daysInMonth = end.getDate();
    const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;

    const cells: Array<{ ymd?: string; dayNum?: number }> = [];

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - offset + 1;
      if (dayNum >= 1 && dayNum <= daysInMonth) {
        const yyyy = start.getFullYear();
        const mm = pad2(start.getMonth() + 1);
        const dd = pad2(dayNum);
        cells.push({ ymd: `${yyyy}-${mm}-${dd}`, dayNum });
      } else {
        cells.push({});
      }
    }

    return cells;
  }, [calendarMonth]);

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <AppShell
      title="Health Board"
      subtitle="Weight, measurements, BP, and exercise — all in one place."
    >
      <AppPage>
        {/* Premium micro-animations */}
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
            transition: transform 160ms ease, box-shadow 160ms ease,
              background 160ms ease, border-color 160ms ease;
          }
          .pillHover:hover {
            transform: translateY(-1px);
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
          }
          .pulseActive {
            animation: softPulse 1.6s ease-in-out infinite;
          }

          @media (max-width: 980px) {
            .hbGrid2 {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>

        {/* Snapshot */}
        <section
          style={{
            marginTop: 14,
            border: `1px solid ${UI.line}`,
            borderRadius: 18,
            padding: 14,
            background: "linear-gradient(180deg, #fff 0%, #fff7f3 100%)",
            boxShadow: UI.shadow,
          }}
        >
          <div style={{ fontWeight: 900 }}>Latest snapshot</div>
          {latest ? (
            <div
              style={{
                marginTop: 8,
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 900 }}>
                {latest.ymd} • {latest.timeHHMM}
              </div>
              {latest.weightKg ? (
                <div>
                  ⚖️ <b>{latest.weightKg}kg</b>
                </div>
              ) : null}
              {latest.bpSys && latest.bpDia ? (
                <div>
                  🩺{" "}
                  <b>
                    {latest.bpSys}/{latest.bpDia}
                  </b>
                </div>
              ) : null}
              {latest.restingHr ? (
                <div>
                  ❤️ <b>{latest.restingHr} bpm</b>
                </div>
              ) : null}
              {latest.exerciseType ? (
                <div>
                  🏃 <b>{latest.exerciseType}</b>
                  {latest.exerciseMins ? ` • ${latest.exerciseMins} min` : ""}
                  {latest.exerciseIntensity
                    ? ` • ${latest.exerciseIntensity}`
                    : ""}
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ marginTop: 8, color: UI.muted }}>
              No entries yet. Add your first check-in below.
            </div>
          )}
        </section>

        {/* Layout: form + calendar */}
        <section
          className="hbGrid2"
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          {/* FORM */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SectionCard title="New entry">
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 180px" }}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Date</div>
                  <input
                    type="date"
                    value={ymd}
                    onChange={(e) => setYmd(e.target.value)}
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
                <div style={{ flex: "1 1 160px" }}>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>Time</div>
                  <input
                    type="time"
                    value={timeHHMM}
                    onChange={(e) => setTimeHHMM(e.target.value)}
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

                <button
                  onClick={resetFormToNow}
                  className="pillHover"
                  style={{
                    marginTop: 26,
                    padding: "12px 12px",
                    borderRadius: 999,
                    border: `1px solid ${UI.line}`,
                    cursor: "pointer",
                    fontWeight: 900,
                    background: "#fff",
                  }}
                >
                  Now
                </button>
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    Weight (kg)
                  </div>
                  <input
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="e.g. 78.4"
                    style={{
                      width: "100%",
                      padding: 12,
                      borderRadius: 14,
                      border: `1px solid ${UI.line}`,
                      background: "#fff",
                    }}
                  />
                </div>

                <div>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    Resting HR (bpm)
                  </div>
                  <input
                    value={restingHr}
                    onChange={(e) => setRestingHr(e.target.value)}
                    placeholder="e.g. 62"
                    style={{
                      width: "100%",
                      padding: 12,
                      borderRadius: 14,
                      border: `1px solid ${UI.line}`,
                      background: "#fff",
                    }}
                  />
                </div>

                <div>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    BP systolic
                  </div>
                  <input
                    value={bpSys}
                    onChange={(e) => setBpSys(e.target.value)}
                    placeholder="e.g. 120"
                    style={{
                      width: "100%",
                      padding: 12,
                      borderRadius: 14,
                      border: `1px solid ${UI.line}`,
                      background: "#fff",
                    }}
                  />
                </div>

                <div>
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    BP diastolic
                  </div>
                  <input
                    value={bpDia}
                    onChange={(e) => setBpDia(e.target.value)}
                    placeholder="e.g. 80"
                    style={{
                      width: "100%",
                      padding: 12,
                      borderRadius: 14,
                      border: `1px solid ${UI.line}`,
                      background: "#fff",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  borderTop: `1px solid ${UI.line}`,
                  paddingTop: 12,
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 10 }}>
                  Measurements (cm)
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 10,
                  }}
                >
                  <input
                    value={waistCm}
                    onChange={(e) => setWaistCm(e.target.value)}
                    placeholder="Waist"
                    style={{
                      width: "100%",
                      padding: 12,
                      borderRadius: 14,
                      border: `1px solid ${UI.line}`,
                      background: "#fff",
                    }}
                  />
                  <input
                    value={hipsCm}
                    onChange={(e) => setHipsCm(e.target.value)}
                    placeholder="Hips"
                    style={{
                      width: "100%",
                      padding: 12,
                      borderRadius: 14,
                      border: `1px solid ${UI.line}`,
                      background: "#fff",
                    }}
                  />
                  <input
                    value={chestCm}
                    onChange={(e) => setChestCm(e.target.value)}
                    placeholder="Chest"
                    style={{
                      width: "100%",
                      padding: 12,
                      borderRadius: 14,
                      border: `1px solid ${UI.line}`,
                      background: "#fff",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  borderTop: `1px solid ${UI.line}`,
                  paddingTop: 12,
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 10 }}>Exercise</div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 10,
                  }}
                >
                  <input
                    value={exerciseType}
                    onChange={(e) => setExerciseType(e.target.value)}
                    placeholder="Type (walk, gym, yoga…)"
                    style={{
                      width: "100%",
                      padding: 12,
                      borderRadius: 14,
                      border: `1px solid ${UI.line}`,
                      background: "#fff",
                    }}
                  />
                  <input
                    value={exerciseMins}
                    onChange={(e) => setExerciseMins(e.target.value)}
                    placeholder="Minutes"
                    style={{
                      width: "100%",
                      padding: 12,
                      borderRadius: 14,
                      border: `1px solid ${UI.line}`,
                      background: "#fff",
                    }}
                  />
                </div>

                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  {(["low", "med", "high"] as const).map((lvl) => {
                    const active = exerciseIntensity === lvl;
                    return (
                      <button
                        key={lvl}
                        onClick={() => setExerciseIntensity(active ? "" : lvl)}
                        className={`pillHover ${active ? "pulseActive" : ""}`}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 999,
                          border: active
                            ? `2px solid ${UI.accent}`
                            : `1px solid ${UI.line}`,
                          background: active ? UI.accentSoft : "#fff",
                          cursor: "pointer",
                          fontWeight: 900,
                          color: UI.ink,
                        }}
                      >
                        {lvl.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Notes</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes…"
                  style={{
                    width: "100%",
                    minHeight: 90,
                    padding: 12,
                    borderRadius: 14,
                    border: `1px solid ${UI.line}`,
                    resize: "vertical",
                    background: "#fff",
                  }}
                />
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={saveEntry}
                  className="pillHover"
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
                  }}
                >
                  Save entry →
                </button>

                <button
                  onClick={clearForm}
                  className="pillHover"
                  style={{
                    padding: "14px 16px",
                    borderRadius: 16,
                    border: `1px solid ${UI.line}`,
                    background: "#fff",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  Clear
                </button>
              </div>

              <div style={{ marginTop: 10, color: UI.muted, fontSize: 12 }}>
                Everything is stored locally in your browser (no account needed).
              </div>
            </SectionCard>
          </div>

          {/* CALENDAR */}
          <div
            style={{
              border: `1px solid ${UI.line}`,
              borderRadius: 18,
              padding: 14,
              background: "#fff",
              boxShadow: UI.shadow,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 16 }}>
                {monthLabel(calendarMonth)}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() =>
                    setCalendarMonth(
                      new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth() - 1,
                        1
                      )
                    )
                  }
                  className="pillHover"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: `1px solid ${UI.line}`,
                    cursor: "pointer",
                    fontWeight: 900,
                    background: "#fff",
                  }}
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setCalendarMonth(new Date())}
                  className="pillHover"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: `1px solid ${UI.line}`,
                    cursor: "pointer",
                    fontWeight: 900,
                    background: "#fff",
                  }}
                >
                  This month
                </button>
                <button
                  onClick={() =>
                    setCalendarMonth(
                      new Date(
                        calendarMonth.getFullYear(),
                        calendarMonth.getMonth() + 1,
                        1
                      )
                    )
                  }
                  className="pillHover"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: `1px solid ${UI.line}`,
                    cursor: "pointer",
                    fontWeight: 900,
                    background: "#fff",
                  }}
                >
                  Next →
                </button>
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 8,
              }}
            >
              {weekDays.map((w) => (
                <div
                  key={w}
                  style={{ fontWeight: 900, color: UI.muted, fontSize: 12 }}
                >
                  {w}
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 8,
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: 8,
              }}
            >
              {grid.map((c, idx) => {
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

                const entries = logsByDay[c.ymd] ?? [];
                const count = entries.length;
                const isToday = c.ymd === todayYMD();

                return (
                  <button
                    key={c.ymd}
                    onClick={() => setSelectedDayYMD(c.ymd!)}
                    className="pillHover"
                    style={{
                      height: 92,
                      borderRadius: 16,
                      border: isToday
                        ? `2px solid ${UI.accent}`
                        : `1px solid ${UI.line}`,
                      background: isToday
                        ? "linear-gradient(180deg, #fff 0%, #fff7f3 100%)"
                        : "#fff",
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
                      {count > 0 ? (
                        <div style={{ fontWeight: 900, color: UI.muted, fontSize: 12 }}>
                          {count}
                        </div>
                      ) : null}
                    </div>

                    {entries[0] ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: UI.muted,
                          fontWeight: 900,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entries[0].weightKg
                          ? `⚖️ ${entries[0].weightKg}kg`
                          : entries[0].exerciseType
                          ? `🏃 ${entries[0].exerciseType}`
                          : "✅ Logged"}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "rgba(17,17,17,0.25)" }}>—</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Day details (glass overlay + sheet) */}
        {selectedDayYMD && (
          <GlassOverlay onClose={() => setSelectedDayYMD(null)} align="bottom">
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "rgba(255,255,255,0.88)",
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
              <div
                style={{
                  width: 44,
                  height: 5,
                  borderRadius: 999,
                  background: "rgba(17,17,17,0.18)",
                  margin: "10px auto 0",
                }}
              />

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
                  <div style={{ fontSize: 18, fontWeight: 900 }}>Day details</div>
                  <div style={{ color: UI.muted, fontSize: 13 }}>{selectedDayYMD}</div>
                </div>

                <button
                  onClick={() => setSelectedDayYMD(null)}
                  className="pillHover"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: `1px solid ${UI.line}`,
                    background: "#fff",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  Close
                </button>
              </div>

              <div style={{ padding: 14, overflowY: "auto" }}>
                {dayLogs.length === 0 ? (
                  <div style={{ color: UI.muted }}>No health entries for this day.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {dayLogs.map((l) => (
                      <div
                        key={l.id}
                        style={{
                          border: `1px solid ${UI.line}`,
                          borderRadius: 18,
                          padding: 12,
                          background: "#fff",
                          boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <div style={{ fontWeight: 900 }}>{l.timeHHMM}</div>
                          <button
                            onClick={() => deleteLog(l.id)}
                            className="pillHover"
                            style={{
                              padding: "10px 12px",
                              borderRadius: 999,
                              border: `1px solid ${UI.line}`,
                              background: "#fff",
                              cursor: "pointer",
                              fontWeight: 900,
                            }}
                          >
                            Delete
                          </button>
                        </div>

                        <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
                          {l.weightKg ? (
                            <div>
                              ⚖️ <b>{l.weightKg}kg</b>
                            </div>
                          ) : null}
                          {l.bpSys && l.bpDia ? (
                            <div>
                              🩺 <b>{l.bpSys}/{l.bpDia}</b>
                            </div>
                          ) : null}
                          {l.restingHr ? (
                            <div>
                              ❤️ <b>{l.restingHr} bpm</b>
                            </div>
                          ) : null}
                          {l.waistCm ? (
                            <div>
                              📏 Waist <b>{l.waistCm}cm</b>
                            </div>
                          ) : null}
                          {l.hipsCm ? (
                            <div>
                              📏 Hips <b>{l.hipsCm}cm</b>
                            </div>
                          ) : null}
                          {l.chestCm ? (
                            <div>
                              📏 Chest <b>{l.chestCm}cm</b>
                            </div>
                          ) : null}
                          {l.exerciseType ? (
                            <div>
                              🏃 <b>{l.exerciseType}</b>
                              {l.exerciseMins ? ` • ${l.exerciseMins} min` : ""}
                              {l.exerciseIntensity ? ` • ${l.exerciseIntensity}` : ""}
                            </div>
                          ) : null}
                        </div>

                        {l.notes ? <div style={{ marginTop: 8, color: "#333" }}>{l.notes}</div> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </GlassOverlay>
        )}
      </AppPage>
    </AppShell>
  );
}
