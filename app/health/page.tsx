"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AppShell, AppPage, UI } from "../components/AppShell";

type Intensity = "low" | "med" | "high";

type HealthEntry = {
  id: number;
  dateTimeISO: string; // when the entry is for
  createdAtISO: string;

  weightKg?: string;
  restingHr?: string;
  bpSys?: string;
  bpDia?: string;

  waistCm?: string;
  hipsCm?: string;
  chestCm?: string;

  exerciseType?: string;
  exerciseMinutes?: string;
  exerciseIntensity?: Intensity;

  notes?: string;
};

const STORAGE_KEY = "health_entries_v2";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
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

function dateToLocalDateValue(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function timeToLocalTimeValue(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function safeNumText(s: string) {
  const t = s.trim();
  if (!t) return "";
  // allow 12, 12.3, 0.5
  return /^(\d+(\.\d+)?)$/.test(t) ? t : t;
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

export default function HealthPage() {
  const isMobile = useIsMobile(720);

  const [entries, setEntries] = useState<HealthEntry[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Form state
  const [dateVal, setDateVal] = useState<string>(dateToLocalDateValue(new Date()));
  const [timeVal, setTimeVal] = useState<string>(timeToLocalTimeValue(new Date()));

  const [weightKg, setWeightKg] = useState("");
  const [restingHr, setRestingHr] = useState("");
  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");

  const [waistCm, setWaistCm] = useState("");
  const [hipsCm, setHipsCm] = useState("");
  const [chestCm, setChestCm] = useState("");

  const [exerciseType, setExerciseType] = useState("");
  const [exerciseMinutes, setExerciseMinutes] = useState("");
  const [exerciseIntensity, setExerciseIntensity] = useState<Intensity>("low");

  const [notes, setNotes] = useState("");

  // Collapsible sections
  const [openMeasurements, setOpenMeasurements] = useState(false);
  const [openExercise, setOpenExercise] = useState(false);
  const [openNotes, setOpenNotes] = useState(false);

  // Calendar
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [selectedDayYMD, setSelectedDayYMD] = useState<string | null>(null);

  // Load / Save
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setEntries(parsed);
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1100);
    return () => clearTimeout(t);
  }, [toast]);

  const entriesByDay = useMemo(() => {
    const map: Record<string, HealthEntry[]> = {};
    for (const e of entries) {
      const key = toYMD(new Date(e.dateTimeISO));
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => new Date(b.dateTimeISO).getTime() - new Date(a.dateTimeISO).getTime());
    }
    return map;
  }, [entries]);

  const todayYMD = toYMD(new Date());
  const dayEntries = selectedDayYMD ? entriesByDay[selectedDayYMD] ?? [] : [];

  const latest = useMemo(() => {
    if (!entries.length) return null;
    const sorted = [...entries].sort((a, b) => new Date(b.dateTimeISO).getTime() - new Date(a.dateTimeISO).getTime());
    return sorted[0];
  }, [entries]);

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

  function setNowTime() {
    const d = new Date();
    setDateVal(dateToLocalDateValue(d));
    setTimeVal(timeToLocalTimeValue(d));
  }

  function clearForm() {
    setWeightKg("");
    setRestingHr("");
    setBpSys("");
    setBpDia("");
    setWaistCm("");
    setHipsCm("");
    setChestCm("");
    setExerciseType("");
    setExerciseMinutes("");
    setExerciseIntensity("low");
    setNotes("");
    setToast("Cleared");
  }

  function saveEntry() {
    // Create an ISO from local date + time safely
    const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(dateVal) ? dateVal : dateToLocalDateValue(new Date());
    const safeTime = /^\d{2}:\d{2}$/.test(timeVal) ? timeVal : timeToLocalTimeValue(new Date());
    const dtLocal = new Date(`${safeDate}T${safeTime}`);

    const item: HealthEntry = {
      id: Date.now(),
      dateTimeISO: dtLocal.toISOString(),
      createdAtISO: new Date().toISOString(),

      weightKg: safeNumText(weightKg) || undefined,
      restingHr: safeNumText(restingHr) || undefined,
      bpSys: safeNumText(bpSys) || undefined,
      bpDia: safeNumText(bpDia) || undefined,

      waistCm: safeNumText(waistCm) || undefined,
      hipsCm: safeNumText(hipsCm) || undefined,
      chestCm: safeNumText(chestCm) || undefined,

      exerciseType: exerciseType.trim() || undefined,
      exerciseMinutes: safeNumText(exerciseMinutes) || undefined,
      exerciseIntensity: exerciseType.trim() || exerciseMinutes.trim() ? exerciseIntensity : undefined,

      notes: notes.trim() || undefined,
    };

    setEntries((prev) => [item, ...prev]);
    setToast("Saved ✓");
  }

  function deleteEntry(id: number) {
    setEntries((prev) => prev.filter((x) => x.id !== id));
    setToast("Deleted");
  }

  function openDay(ymd: string) {
    setSelectedDayYMD(ymd);
  }

  // ---------- Styles (mobile-first tweaks without CSS files) ----------
  const cardPad = isMobile ? 12 : 14;
  const cardRadius = 18;

  const labelStyle: React.CSSProperties = {
    fontWeight: 900,
    color: isMobile ? "rgba(17,17,17,0.86)" : "rgba(17,17,17,0.74)",
    marginBottom: isMobile ? 6 : 8,
    fontSize: isMobile ? 12 : 13,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontWeight: 900,
    fontSize: isMobile ? 16 : 18,
    color: UI.ink,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    minWidth: 0,
    padding: isMobile ? 11 : 12,
    borderRadius: 14,
    border: `1px solid ${UI.line}`,
    fontWeight: 900,
    background: "#fff",
    color: UI.ink,
    boxSizing: "border-box",
  };

  const pillButton = (active = false): React.CSSProperties => ({
    padding: isMobile ? "10px 12px" : "10px 12px",
    borderRadius: 999,
    border: active ? `2px solid ${UI.accent}` : `1px solid ${UI.line}`,
    background: active ? UI.accentSoft : "#fff",
    cursor: "pointer",
    fontWeight: 900,
    boxShadow: UI.shadow,
    whiteSpace: "nowrap",
    color: UI.ink,
  });

  const collapsibleHeader = (open: boolean): React.CSSProperties => ({
    width: "100%",
    padding: isMobile ? "12px 12px" : "12px 14px",
    borderRadius: 16,
    border: open ? `2px solid ${UI.accent}` : `1px solid ${UI.line}`,
    background: open ? "linear-gradient(180deg,#fff 0%, #fff7f3 100%)" : UI.accentSoft,
    cursor: "pointer",
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    boxShadow: UI.shadow,
    color: UI.ink, // ✅ makes the text readable (was looking “washed out” on mobile)
  });

  const smallMuted: React.CSSProperties = {
    color: isMobile ? "rgba(17,17,17,0.70)" : UI.muted,
    fontWeight: 800,
  };

  // Calendar sizing fix
  const calGap = isMobile ? 6 : 8;
  const calCellH = isMobile ? 66 : 92;

  return (
    <AppShell title="Health Board" subtitle="Weight, measurements, BP, and exercise — all in one place.">
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

        {/* Latest snapshot */}
        <section
          style={{
            marginTop: 12,
            border: `1px solid ${UI.line}`,
            borderRadius: cardRadius,
            padding: cardPad,
            background: "#fff",
            boxShadow: UI.shadow,
          }}
        >
          <div style={sectionTitleStyle}>Latest snapshot</div>

          {!latest ? (
            <div style={{ marginTop: 8, ...smallMuted }}>No entries yet. Add your first check-in below.</div>
          ) : (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ fontWeight: 900 }}>
                  {new Date(latest.dateTimeISO).toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </div>
                <button onClick={() => openDay(toYMD(new Date(latest.dateTimeISO)))} style={pillButton(false)}>
                  View day →
                </button>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", ...smallMuted }}>
                {latest.weightKg ? (
                  <div>
                    ⚖️ <b style={{ color: UI.ink }}>{latest.weightKg}kg</b>
                  </div>
                ) : null}
                {latest.restingHr ? (
                  <div>
                    ❤️ <b style={{ color: UI.ink }}>{latest.restingHr} bpm</b>
                  </div>
                ) : null}
                {latest.bpSys && latest.bpDia ? (
                  <div>
                    🩺 <b style={{ color: UI.ink }}>{latest.bpSys}/{latest.bpDia}</b>
                  </div>
                ) : null}
                {latest.exerciseMinutes ? (
                  <div>
                    🏃 <b style={{ color: UI.ink }}>{latest.exerciseMinutes} min</b>
                  </div>
                ) : null}
              </div>

              {latest.notes ? <div style={{ marginTop: 2, color: "rgba(17,17,17,0.80)", fontWeight: 700 }}>{latest.notes}</div> : null}
            </div>
          )}
        </section>

        {/* New entry */}
        <section
          style={{
            marginTop: 14,
            border: `1px solid ${UI.line}`,
            borderRadius: cardRadius,
            padding: cardPad,
            background: "#fff",
            boxShadow: UI.shadow,
          }}
        >
          <div style={sectionTitleStyle}>New entry</div>

          {/* Date + Time */}
          <div
            style={{
              marginTop: 10,
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
              gap: 10,
            }}
          >
            <div>
              <div style={labelStyle}>Date</div>
              <input type="date" value={dateVal} onChange={(e) => setDateVal(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <div style={labelStyle}>Time</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 110px", gap: 10, alignItems: "center" }}>
                <input type="time" value={timeVal} onChange={(e) => setTimeVal(e.target.value)} style={inputStyle} />
                <button onClick={setNowTime} style={{ ...pillButton(false), width: isMobile ? "100%" : "auto" }}>
                  Now
                </button>
              </div>
            </div>
          </div>

          {/* Core vitals (✅ mobile: 2 columns so the block is smaller) */}
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr",
              gap: isMobile ? 10 : 10,
              alignItems: "start",
            }}
          >
            <div>
              <div style={labelStyle}>Weight (kg)</div>
              <input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="e.g. 78.4" style={inputStyle} />
            </div>

            <div>
              <div style={labelStyle}>Resting HR (bpm)</div>
              <input value={restingHr} onChange={(e) => setRestingHr(e.target.value)} placeholder="e.g. 62" style={inputStyle} />
            </div>

            <div>
              <div style={labelStyle}>BP (sys)</div>
              <input value={bpSys} onChange={(e) => setBpSys(e.target.value)} placeholder="e.g. 120" style={inputStyle} />
            </div>

            <div>
              <div style={labelStyle}>BP (dia)</div>
              <input value={bpDia} onChange={(e) => setBpDia(e.target.value)} placeholder="e.g. 80" style={inputStyle} />
            </div>
          </div>

          {/* Collapsibles */}
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Measurements */}
            <button onClick={() => setOpenMeasurements((v) => !v)} style={collapsibleHeader(openMeasurements)}>
              <span>Measurements (optional)</span>
              <span style={{ color: "rgba(17,17,17,0.70)", fontWeight: 900 }}>{openMeasurements ? "−" : "+"}</span>
            </button>

            {openMeasurements && (
              <div
                style={{
                  border: `1px solid ${UI.line}`,
                  borderRadius: 16,
                  padding: isMobile ? 12 : 14,
                  background: "#fff",
                  boxShadow: UI.shadow,
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={labelStyle}>Waist (cm)</div>
                    <input value={waistCm} onChange={(e) => setWaistCm(e.target.value)} placeholder="Waist" style={inputStyle} />
                  </div>
                  <div>
                    <div style={labelStyle}>Hips (cm)</div>
                    <input value={hipsCm} onChange={(e) => setHipsCm(e.target.value)} placeholder="Hips" style={inputStyle} />
                  </div>
                  <div>
                    <div style={labelStyle}>Chest (cm)</div>
                    <input value={chestCm} onChange={(e) => setChestCm(e.target.value)} placeholder="Chest" style={inputStyle} />
                  </div>
                </div>
              </div>
            )}

            {/* Exercise */}
            <button onClick={() => setOpenExercise((v) => !v)} style={collapsibleHeader(openExercise)}>
              <span>Exercise (optional)</span>
              <span style={{ color: "rgba(17,17,17,0.70)", fontWeight: 900 }}>{openExercise ? "−" : "+"}</span>
            </button>

            {openExercise && (
              <div
                style={{
                  border: `1px solid ${UI.line}`,
                  borderRadius: 16,
                  padding: isMobile ? 12 : 14,
                  background: "#fff",
                  boxShadow: UI.shadow,
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 10 }}>
                  <div>
                    <div style={labelStyle}>Type</div>
                    <input value={exerciseType} onChange={(e) => setExerciseType(e.target.value)} placeholder="walk, gym, yoga..." style={inputStyle} />
                  </div>
                  <div>
                    <div style={labelStyle}>Minutes</div>
                    <input value={exerciseMinutes} onChange={(e) => setExerciseMinutes(e.target.value)} placeholder="e.g. 30" style={inputStyle} />
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={labelStyle}>Intensity</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={() => setExerciseIntensity("low")} style={pillButton(exerciseIntensity === "low")}>
                      LOW
                    </button>
                    <button onClick={() => setExerciseIntensity("med")} style={pillButton(exerciseIntensity === "med")}>
                      MED
                    </button>
                    <button onClick={() => setExerciseIntensity("high")} style={pillButton(exerciseIntensity === "high")}>
                      HIGH
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <button onClick={() => setOpenNotes((v) => !v)} style={collapsibleHeader(openNotes)}>
              <span>Notes (optional)</span>
              <span style={{ color: "rgba(17,17,17,0.70)", fontWeight: 900 }}>{openNotes ? "−" : "+"}</span>
            </button>

            {openNotes && (
              <div
                style={{
                  border: `1px solid ${UI.line}`,
                  borderRadius: 16,
                  padding: isMobile ? 12 : 14,
                  background: "#fff",
                  boxShadow: UI.shadow,
                }}
              >
                <div style={labelStyle}>Notes</div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                  style={{
                    ...inputStyle,
                    minHeight: isMobile ? 90 : 110,
                    resize: "vertical",
                    fontWeight: 800,
                  }}
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1fr 180px",
              gap: 10,
              alignItems: "center",
            }}
          >
            <button
              onClick={saveEntry}
              style={{
                width: "100%",
                padding: isMobile ? "14px 16px" : "14px 16px",
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
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 16,
                border: `1px solid ${UI.line}`,
                background: "#fff",
                cursor: "pointer",
                fontWeight: 900,
                color: UI.ink,
              }}
            >
              Clear
            </button>
          </div>

          <div style={{ marginTop: 10, color: isMobile ? "rgba(17,17,17,0.70)" : UI.muted, fontWeight: 800 }}>
            Everything is stored locally in your browser (no account needed).
          </div>
        </section>

        {/* Calendar */}
        <section
          style={{
            marginTop: 14,
            border: `1px solid ${UI.line}`,
            borderRadius: cardRadius,
            padding: cardPad,
            background: "#fff",
            boxShadow: UI.shadow,
            overflow: "hidden", // IMPORTANT: prevents the “Sunday pill” overflow look on mobile
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontWeight: 900, fontSize: isMobile ? 15 : 16 }}>{monthLabel(calendarMonth)}</div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                style={{ padding: "10px 12px", borderRadius: 999, border: `1px solid ${UI.line}`, cursor: "pointer", fontWeight: 900, background: "#fff", color: UI.ink }}
              >
                ← Prev
              </button>

              <button
                onClick={() => setCalendarMonth(new Date())}
                style={{ padding: "10px 12px", borderRadius: 999, border: `1px solid ${UI.line}`, cursor: "pointer", fontWeight: 900, background: "#fff", color: UI.ink }}
              >
                This month
              </button>

              <button
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                style={{ padding: "10px 12px", borderRadius: 999, border: `1px solid ${UI.line}`, cursor: "pointer", fontWeight: 900, background: "#fff", color: UI.ink }}
              >
                Next →
              </button>
            </div>
          </div>

          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: calGap }}>
            {weekDays.map((w) => (
              <div key={w} style={{ fontWeight: 900, color: "rgba(17,17,17,0.62)", fontSize: isMobile ? 11 : 12 }}>
                {w}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: calGap }}>
            {calendarCells.map((c, idx) => {
              if (!c.ymd) {
                return (
                  <div
                    key={idx}
                    style={{
                      height: calCellH,
                      borderRadius: 16,
                      border: `1px solid rgba(17,17,17,0.06)`,
                      background: "rgba(255,255,255,0.6)",
                    }}
                  />
                );
              }

              const items = entriesByDay[c.ymd] ?? [];
              const isToday = c.ymd === todayYMD;

              return (
                <button
                  key={c.ymd}
                  onClick={() => openDay(c.ymd!)}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    height: calCellH,
                    borderRadius: 16,
                    border: isToday ? `2px solid ${UI.accent}` : `1px solid ${UI.line}`,
                    background: isToday ? "linear-gradient(180deg, #fff 0%, #fff7f3 100%)" : "#fff",
                    cursor: "pointer",
                    textAlign: "left",
                    padding: isMobile ? 8 : 10,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    boxSizing: "border-box",
                    overflow: "hidden",
                    color: UI.ink,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                    <div style={{ fontWeight: 900, fontSize: isMobile ? 12 : 14 }}>{c.dayNum}</div>
                    {items.length > 0 ? (
                      <div style={{ fontWeight: 900, color: "rgba(17,17,17,0.55)", fontSize: isMobile ? 11 : 12 }}>{items.length}</div>
                    ) : null}
                  </div>

                  {items.length ? (
                    <div style={{ fontSize: isMobile ? 11 : 12, color: "rgba(17,17,17,0.62)", fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      • Entry
                    </div>
                  ) : (
                    <div style={{ fontSize: isMobile ? 11 : 12, color: "rgba(17,17,17,0.25)" }}>—</div>
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
                background: "rgba(255,255,255,0.92)",
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
                  <div style={{ fontSize: 18, fontWeight: 900 }}>Day entries</div>
                  <div style={{ color: "rgba(17,17,17,0.62)", fontSize: 13, fontWeight: 800 }}>{selectedDayYMD}</div>
                </div>

                <button
                  onClick={() => setSelectedDayYMD(null)}
                  style={{ padding: "10px 12px", borderRadius: 999, border: `1px solid ${UI.line}`, background: "#fff", cursor: "pointer", fontWeight: 900, color: UI.ink }}
                >
                  Close
                </button>
              </div>

              <div style={{ padding: 14, overflowY: "auto" }}>
                {dayEntries.length === 0 ? (
                  <div style={{ marginTop: 8, color: "rgba(17,17,17,0.62)", fontWeight: 800 }}>No health entries for this day.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {dayEntries.map((h) => (
                      <div key={h.id} style={{ border: `1px solid ${UI.line}`, borderRadius: 16, padding: 12, background: "#fff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <div style={{ fontWeight: 900 }}>
                            {new Date(h.dateTimeISO).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                          <button
                            onClick={() => deleteEntry(h.id)}
                            style={{ padding: "10px 12px", borderRadius: 999, border: `1px solid ${UI.line}`, background: "#fff", cursor: "pointer", fontWeight: 900, color: UI.ink }}
                          >
                            Delete
                          </button>
                        </div>

                        <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap", color: "rgba(17,17,17,0.72)", fontWeight: 800 }}>
                          {h.weightKg ? (
                            <div>
                              ⚖️ <b style={{ color: UI.ink }}>{h.weightKg}kg</b>
                            </div>
                          ) : null}
                          {h.restingHr ? (
                            <div>
                              ❤️ <b style={{ color: UI.ink }}>{h.restingHr} bpm</b>
                            </div>
                          ) : null}
                          {h.bpSys && h.bpDia ? (
                            <div>
                              🩺 <b style={{ color: UI.ink }}>{h.bpSys}/{h.bpDia}</b>
                            </div>
                          ) : null}
                          {h.exerciseMinutes ? (
                            <div>
                              🏃 <b style={{ color: UI.ink }}>{h.exerciseMinutes} min</b>
                            </div>
                          ) : null}
                        </div>

                        {h.notes ? <div style={{ marginTop: 8, color: "rgba(17,17,17,0.78)" }}>{h.notes}</div> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </AppPage>
    </AppShell>
  );
}
