"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, AppPage, UI, GlassOverlay } from "../components/AppShell";

/** Storage key MUST stay aligned with Dashboard */
const STORAGE_KEY = "health_entries_v2";

/** Types */
type HealthEntry = {
  id: string;
  dateYMD: string; // YYYY-MM-DD
  timeHM: string; // HH:MM
  createdAtISO: string;

  weightKg?: string;
  restingHr?: string;
  bpSys?: string;
  bpDia?: string;

  waistCm?: string;
  hipsCm?: string;
  chestCm?: string;
  armCm?: string;
  thighCm?: string;

  steps?: string;
  workoutMin?: string;
  intensity?: "light" | "moderate" | "hard";
  workoutType?: string;

  notes?: string;
};

/** Date helpers */
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function jsDayToMonFirst(jsDay: number) {
  // JS: Sun=0..Sat=6 -> Mon=0..Sun=6
  return (jsDay + 6) % 7;
}
function monthLabel(d: Date) {
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}
function dayNameShort(idx: number) {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return names[idx] ?? "";
}

/** Small utils */
function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function safeNum(v?: string) {
  if (!v) return null;
  const n = Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export default function HealthPage() {
  /** Form state */
  const [dateYMD, setDateYMD] = useState<string>(() => toYMD(new Date()));
  const [timeHM, setTimeHM] = useState<string>(() => {
    const d = new Date();
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  });

  const [weightKg, setWeightKg] = useState("");
  const [restingHr, setRestingHr] = useState("");
  const [bpSys, setBpSys] = useState("");
  const [bpDia, setBpDia] = useState("");

  const [waistCm, setWaistCm] = useState("");
  const [hipsCm, setHipsCm] = useState("");
  const [chestCm, setChestCm] = useState("");
  const [armCm, setArmCm] = useState("");
  const [thighCm, setThighCm] = useState("");

  const [steps, setSteps] = useState("");
  const [workoutMin, setWorkoutMin] = useState("");
  const [intensity, setIntensity] = useState<"light" | "moderate" | "hard">("moderate");
  const [workoutType, setWorkoutType] = useState("");

  const [notes, setNotes] = useState("");

  /** Data */
  const [entries, setEntries] = useState<HealthEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  /** Calendar + modal */
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedYMD, setSelectedYMD] = useState<string | null>(null);

  const topRef = useRef<HTMLDivElement | null>(null);

  /** Load */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEntries(JSON.parse(raw));
    } catch {
      setEntries([]);
    }
  }, []);

  /** Persist */
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // ignore
    }
  }, [entries]);

  /** Calendar grid */
  const cal = useMemo(() => {
    const mStart = startOfMonth(month);
    const mEnd = endOfMonth(month);

    const startOffset = jsDayToMonFirst(mStart.getDay());
    const gridStart = addDays(mStart, -startOffset);

    const endOffset = 6 - jsDayToMonFirst(mEnd.getDay());
    const gridEnd = addDays(mEnd, endOffset);

    const days: Date[] = [];
    let d = new Date(gridStart);
    while (d.getTime() <= gridEnd.getTime()) {
      days.push(new Date(d));
      d = addDays(d, 1);
      if (days.length > 60) break;
    }

    return { gridStart, gridEnd, days, mStart };
  }, [month]);

  const todayYMD = useMemo(() => toYMD(new Date()), []);

  /** Counts per day */
  const byDayCount = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of entries) {
      const ymd = e.dateYMD?.slice(0, 10);
      if (!ymd) continue;
      map[ymd] = (map[ymd] ?? 0) + 1;
    }
    return map;
  }, [entries]);

  const heatMax = useMemo(() => {
    let mx = 0;
    for (const k of Object.keys(byDayCount)) mx = Math.max(mx, byDayCount[k] ?? 0);
    return Math.max(1, mx);
  }, [byDayCount]);

  /** Selected day entries */
  const selectedEntries = useMemo(() => {
    if (!selectedYMD) return [];
    return entries
      .filter((e) => e.dateYMD === selectedYMD)
      .slice()
      .sort((a, b) => String(b.createdAtISO).localeCompare(String(a.createdAtISO)));
  }, [entries, selectedYMD]);

  function prevMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }
  function nextMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }
  function goToday() {
    setMonth(startOfMonth(new Date()));
  }

  function resetFormKeepDateTime() {
    setWeightKg("");
    setRestingHr("");
    setBpSys("");
    setBpDia("");

    setWaistCm("");
    setHipsCm("");
    setChestCm("");
    setArmCm("");
    setThighCm("");

    setSteps("");
    setWorkoutMin("");
    setIntensity("moderate");
    setWorkoutType("");

    setNotes("");
  }

  function fillFormFromEntry(e: HealthEntry) {
    setDateYMD(e.dateYMD);
    setTimeHM(e.timeHM);

    setWeightKg(e.weightKg ?? "");
    setRestingHr(e.restingHr ?? "");
    setBpSys(e.bpSys ?? "");
    setBpDia(e.bpDia ?? "");

    setWaistCm(e.waistCm ?? "");
    setHipsCm(e.hipsCm ?? "");
    setChestCm(e.chestCm ?? "");
    setArmCm(e.armCm ?? "");
    setChestCm(e.chestCm ?? "");
    setThighCm(e.thighCm ?? "");

    setSteps(e.steps ?? "");
    setWorkoutMin(e.workoutMin ?? "");
    setIntensity(e.intensity ?? "moderate");
    setWorkoutType(e.workoutType ?? "");

    setNotes(e.notes ?? "");
  }

  function scrollToTopForm() {
    requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function saveEntry() {
    const nowISO = new Date().toISOString();

    const next: HealthEntry = {
      id: editingId ?? uid(),
      dateYMD,
      timeHM,
      createdAtISO: editingId
        ? entries.find((x) => x.id === editingId)?.createdAtISO ?? nowISO
        : nowISO,

      weightKg: weightKg.trim() || undefined,
      restingHr: restingHr.trim() || undefined,
      bpSys: bpSys.trim() || undefined,
      bpDia: bpDia.trim() || undefined,

      waistCm: waistCm.trim() || undefined,
      hipsCm: hipsCm.trim() || undefined,
      chestCm: chestCm.trim() || undefined,
      armCm: armCm.trim() || undefined,
      thighCm: thighCm.trim() || undefined,

      steps: steps.trim() || undefined,
      workoutMin: workoutMin.trim() || undefined,
      intensity,
      workoutType: workoutType.trim() || undefined,

      notes: notes.trim() || undefined,
    };

    setEntries((prev) => {
      const idx = prev.findIndex((x) => x.id === next.id);
      if (idx >= 0) {
        const copy = prev.slice();
        copy[idx] = next;
        return copy;
      }
      return [next, ...prev];
    });

    setEditingId(null);
    resetFormKeepDateTime();
  }

  function startEdit(entry: HealthEntry) {
    setEditingId(entry.id);
    fillFormFromEntry(entry);
    setSelectedYMD(null);
    scrollToTopForm();
  }

  function deleteEntry(entryId: string) {
    setEntries((prev) => prev.filter((x) => x.id !== entryId));
  }

  /** Light “Dashboard-like” surfaces */
  const LIGHT_CARD_BG =
    "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.86) 50%, rgba(255,255,255,0.82) 100%)";
  const LIGHT_TILE_BG =
    "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.80) 100%)";

  return (
    <AppShell title="Health Board" subtitle="Weight, measurements, BP, and exercise — all in one place.">
      <AppPage>
        <style jsx global>{`
          .wrap {
            display: flex;
            flex-direction: column;
            gap: 14px;
            min-height: calc(100vh - 220px);
          }

          .panel {
            border: 1px solid rgba(255, 255, 255, 0.14);
            border-radius: 22px;
            background: rgba(255, 255, 255, 0.06);
            box-shadow: 0 18px 55px rgba(0, 0, 0, 0.55);
            padding: 14px;
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
          }

          /* ✅ Dashboard-like LIGHT cards */
          .lightCard {
            border-radius: 22px;
            border: 1px solid rgba(0, 0, 0, 0.08);
            background: ${LIGHT_CARD_BG};
            box-shadow: 0 18px 55px rgba(0, 0, 0, 0.25);
            padding: 14px;
            color: #121318;
          }

          .hTitle {
            font-weight: 980;
            font-size: 14px;
            margin-bottom: 10px;
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 10px;
          }
          .hSub {
            color: rgba(18, 19, 24, 0.65);
            font-weight: 850;
            font-size: 12px;
          }

          .grid2 {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }
          @media (max-width: 760px) {
            .grid2 {
              grid-template-columns: 1fr;
            }
          }

          label {
            display: block;
            font-weight: 900;
            font-size: 12px;
            color: rgba(18, 19, 24, 0.78);
            margin-bottom: 6px;
          }

          .input {
            width: 100%;
            border-radius: 14px;
            border: 1px solid rgba(0, 0, 0, 0.10);
            background: rgba(0, 0, 0, 0.04);
            padding: 10px 12px;
            font-weight: 850;
            color: #121318;
            outline: none;
          }
          .input:focus {
            border-color: rgba(255, 42, 58, 0.35);
            box-shadow: 0 0 0 3px rgba(255, 42, 58, 0.12);
          }

          .btnRow {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            justify-content: flex-end;
            align-items: center;
          }

          .btn {
            padding: 10px 12px;
            border-radius: 999px;
            border: 1px solid rgba(0, 0, 0, 0.10);
            background: rgba(0, 0, 0, 0.04);
            color: rgba(18, 19, 24, 0.92);
            font-weight: 950;
            cursor: pointer;
          }

          .btnPrimary {
            border: 1px solid rgba(255, 42, 58, 0.55);
            background: ${UI.accent};
            color: #fff;
          }

          .btnDanger {
            border: 1px solid rgba(255, 42, 58, 0.30);
            background: rgba(255, 42, 58, 0.10);
            color: rgba(18, 19, 24, 0.92);
          }

          /* Calendar */
          .calHeader {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 10px;
          }

          .calControls {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
          }

          .iconBtn {
            width: 36px;
            height: 36px;
            border-radius: 12px;
            border: 1px solid rgba(0, 0, 0, 0.10);
            background: rgba(0, 0, 0, 0.04);
            cursor: pointer;
            font-weight: 950;
            color: rgba(18, 19, 24, 0.92);
          }

          .monthPill {
            padding: 9px 12px;
            border-radius: 14px;
            border: 1px solid rgba(0, 0, 0, 0.10);
            background: rgba(0, 0, 0, 0.04);
            color: rgba(18, 19, 24, 0.92);
            font-weight: 950;
            min-width: 180px;
            text-align: center;
          }

          .todayBtn {
            padding: 9px 12px;
            border-radius: 999px;
            border: 1px solid rgba(255, 42, 58, 0.25);
            background: rgba(255, 42, 58, 0.06);
            color: rgba(18, 19, 24, 0.92);
            font-weight: 950;
            cursor: pointer;
          }

          .dowRow {
            display: grid;
            grid-template-columns: repeat(7, minmax(0, 1fr));
            gap: 10px;
            margin: 10px 0;
            color: rgba(18, 19, 24, 0.65);
            font-weight: 900;
            font-size: 12px;
            padding: 0 4px;
          }

          .calGrid {
            display: grid;
            grid-template-columns: repeat(7, minmax(0, 1fr));
            gap: 10px;
          }

          .dayBtn {
            text-align: left;
            border-radius: 16px;
            border: 1px solid rgba(0, 0, 0, 0.10);
            background: ${LIGHT_TILE_BG};
            box-shadow: 0 12px 26px rgba(0, 0, 0, 0.12);
            padding: 10px;
            min-height: 72px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            cursor: pointer;
            transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
          }

          .dayBtn:hover {
            transform: translateY(-1px);
            box-shadow: 0 16px 34px rgba(0, 0, 0, 0.16);
            border-color: rgba(0, 0, 0, 0.14);
          }

          .dayTop {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
          }

          .dayNum {
            font-weight: 980;
            color: rgba(18, 19, 24, 0.92);
            font-size: 14px;
          }

          .outside {
            opacity: 0.55;
          }

          .todayRing {
            box-shadow: 0 0 0 2px rgba(255, 42, 58, 0.18), 0 12px 26px rgba(0, 0, 0, 0.12);
            border-color: rgba(255, 42, 58, 0.28) !important;
          }

          .dotRow {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
          }

          .dot {
            width: 10px;
            height: 10px;
            border-radius: 99px;
            display: inline-block;
            background: rgba(255, 42, 58, 0.28);
          }

          .countBadge {
            font-size: 12px;
            font-weight: 950;
            padding: 2px 8px;
            border-radius: 999px;
            border: 1px solid rgba(0, 0, 0, 0.10);
            background: rgba(0, 0, 0, 0.04);
            color: rgba(18, 19, 24, 0.82);
          }

          /* Modal content */
          .modal {
            width: min(920px, calc(100vw - 28px));
            border-radius: 20px;
            border: 1px solid rgba(0, 0, 0, 0.10);
            background: ${LIGHT_CARD_BG};
            box-shadow: 0 28px 90px rgba(0, 0, 0, 0.35);
            overflow: hidden;
            color: #121318;
          }

          .modalHeader {
            padding: 14px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          }

          .modalBody {
            padding: 14px;
          }

          .entryCard {
            border: 1px solid rgba(0, 0, 0, 0.10);
            background: rgba(0, 0, 0, 0.03);
            border-radius: 16px;
            padding: 12px;
            margin-top: 10px;
            display: flex;
            justify-content: space-between;
            gap: 12px;
          }

          .entryTitle {
            font-weight: 980;
            color: rgba(18, 19, 24, 0.92);
          }

          .entryMeta {
            color: rgba(18, 19, 24, 0.65);
            font-weight: 850;
            font-size: 12px;
            margin-top: 4px;
          }

          .miniBtn {
            padding: 9px 10px;
            border-radius: 999px;
            border: 1px solid rgba(0, 0, 0, 0.10);
            background: rgba(0, 0, 0, 0.04);
            font-weight: 950;
            cursor: pointer;
            color: rgba(18, 19, 24, 0.92);
            white-space: nowrap;
          }
          .miniPrimary {
            border: 1px solid rgba(255, 42, 58, 0.55);
            background: ${UI.accent};
            color: #fff;
          }

          .footerNote {
            padding: 12px 14px;
            border-top: 1px solid rgba(0, 0, 0, 0.08);
            color: rgba(18, 19, 24, 0.55);
            font-weight: 850;
            font-size: 12px;
            line-height: 1.4;
          }
        `}</style>

        <div className="wrap" ref={topRef}>
          {/* Quick add (LIGHT) */}
          <div className="panel">
            <div className="lightCard">
              <div className="hTitle">
                <div>
                  Quick add{" "}
                  {editingId ? (
                    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 950, color: "rgba(255,42,58,0.90)" }}>
                      Editing entry
                    </span>
                  ) : null}
                  <div className="hSub">Everything is stored locally in your browser (no account needed).</div>
                </div>

                <div className="btnRow">
                  <button
                    className="btn"
                    onClick={() => {
                      const d = new Date();
                      setDateYMD(toYMD(d));
                      setTimeHM(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`);
                    }}
                    type="button"
                  >
                    Use now
                  </button>

                  <button className="btn btnPrimary" onClick={saveEntry} type="button">
                    Save entry →
                  </button>
                </div>
              </div>

              <div className="grid2">
                <div>
                  <label>Date</label>
                  <input className="input" type="date" value={dateYMD} onChange={(e) => setDateYMD(e.target.value)} />
                </div>
                <div>
                  <label>Time</label>
                  <input className="input" type="time" value={timeHM} onChange={(e) => setTimeHM(e.target.value)} />
                </div>

                <div>
                  <label>Weight (kg)</label>
                  <input className="input" placeholder="e.g. 78.4" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
                </div>
                <div>
                  <label>Resting HR (bpm)</label>
                  <input className="input" placeholder="e.g. 62" value={restingHr} onChange={(e) => setRestingHr(e.target.value)} />
                </div>

                <div>
                  <label>BP (sys)</label>
                  <input className="input" placeholder="e.g. 120" value={bpSys} onChange={(e) => setBpSys(e.target.value)} />
                </div>
                <div>
                  <label>BP (dia)</label>
                  <input className="input" placeholder="e.g. 80" value={bpDia} onChange={(e) => setBpDia(e.target.value)} />
                </div>
              </div>

              {/* Optional sections (simple + clean) */}
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <details>
                  <summary style={{ cursor: "pointer", fontWeight: 950, color: "rgba(18,19,24,0.82)" }}>
                    Measurements (optional)
                    <span style={{ marginLeft: 8, color: "rgba(18,19,24,0.55)", fontWeight: 850, fontSize: 12 }}>
                      waist / hips / chest / arm / thigh
                    </span>
                  </summary>
                  <div className="grid2" style={{ marginTop: 10 }}>
                    <div>
                      <label>Waist (cm)</label>
                      <input className="input" value={waistCm} onChange={(e) => setWaistCm(e.target.value)} placeholder="e.g. 88" />
                    </div>
                    <div>
                      <label>Hips (cm)</label>
                      <input className="input" value={hipsCm} onChange={(e) => setHipsCm(e.target.value)} placeholder="e.g. 102" />
                    </div>
                    <div>
                      <label>Chest (cm)</label>
                      <input className="input" value={chestCm} onChange={(e) => setChestCm(e.target.value)} placeholder="e.g. 98" />
                    </div>
                    <div>
                      <label>Arm (cm)</label>
                      <input className="input" value={armCm} onChange={(e) => setArmCm(e.target.value)} placeholder="e.g. 31" />
                    </div>
                    <div>
                      <label>Thigh (cm)</label>
                      <input className="input" value={thighCm} onChange={(e) => setThighCm(e.target.value)} placeholder="e.g. 56" />
                    </div>
                  </div>
                </details>

                <details>
                  <summary style={{ cursor: "pointer", fontWeight: 950, color: "rgba(18,19,24,0.82)" }}>
                    Exercise (optional)
                    <span style={{ marginLeft: 8, color: "rgba(18,19,24,0.55)", fontWeight: 850, fontSize: 12 }}>
                      steps / minutes / intensity / type
                    </span>
                  </summary>
                  <div className="grid2" style={{ marginTop: 10 }}>
                    <div>
                      <label>Steps</label>
                      <input className="input" value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="e.g. 8500" />
                    </div>
                    <div>
                      <label>Workout minutes</label>
                      <input className="input" value={workoutMin} onChange={(e) => setWorkoutMin(e.target.value)} placeholder="e.g. 30" />
                    </div>
                    <div>
                      <label>Intensity</label>
                      <select className="input" value={intensity} onChange={(e) => setIntensity(e.target.value as any)}>
                        <option value="light">Light</option>
                        <option value="moderate">Moderate</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                    <div>
                      <label>Type</label>
                      <input className="input" value={workoutType} onChange={(e) => setWorkoutType(e.target.value)} placeholder="e.g. Walk, gym, run" />
                    </div>
                  </div>
                </details>

                <details>
                  <summary style={{ cursor: "pointer", fontWeight: 950, color: "rgba(18,19,24,0.82)" }}>
                    Notes (optional)
                    <span style={{ marginLeft: 8, color: "rgba(18,19,24,0.55)", fontWeight: 850, fontSize: 12 }}>
                      symptoms, sleep, appetite, mood…
                    </span>
                  </summary>
                  <div style={{ marginTop: 10 }}>
                    <label>Notes</label>
                    <textarea className="input" style={{ minHeight: 90, resize: "vertical" }} value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                </details>
              </div>

              {editingId ? (
                <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <div className="hSub">Tip: save updates, or cancel to return to normal add mode.</div>
                  <div className="btnRow">
                    <button
                      className="btn btnDanger"
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        resetFormKeepDateTime();
                      }}
                    >
                      Cancel edit
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Calendar (LIGHT) */}
          <div className="panel">
            <div className="lightCard">
              <div className="calHeader">
                <div>
                  <div style={{ fontWeight: 980, fontSize: 14 }}>History</div>
                  <div className="hSub">Click a day to view entries (and edit).</div>
                </div>

                <div className="calControls">
                  <button className="todayBtn" onClick={goToday} type="button">
                    Today
                  </button>
                  <button className="iconBtn" onClick={prevMonth} aria-label="Previous month" type="button">
                    ‹
                  </button>
                  <div className="monthPill">{monthLabel(month)}</div>
                  <button className="iconBtn" onClick={nextMonth} aria-label="Next month" type="button">
                    ›
                  </button>
                </div>
              </div>

              <div className="dowRow">
                <div>{dayNameShort(0)}</div>
                <div>{dayNameShort(1)}</div>
                <div>{dayNameShort(2)}</div>
                <div>{dayNameShort(3)}</div>
                <div>{dayNameShort(4)}</div>
                <div>{dayNameShort(5)}</div>
                <div>{dayNameShort(6)}</div>
              </div>

              <div className="calGrid">
                {cal.days.map((d) => {
                  const ymd = toYMD(d);
                  const inMonth = d.getMonth() === cal.mStart.getMonth();
                  const isToday = ymd === todayYMD;

                  const c = byDayCount[ymd] ?? 0;
                  const alpha = c > 0 ? clamp(c / heatMax, 0, 1) : 0;

                  // subtle “dashboard-ish” tint on light tiles (very gentle)
                  const heatTint = c > 0 ? `rgba(255,42,58,${0.04 + alpha * 0.10})` : "rgba(0,0,0,0.00)";

                  return (
                    <button
                      key={ymd}
                      type="button"
                      onClick={() => setSelectedYMD(ymd)}
                      className={`dayBtn ${!inMonth ? "outside" : ""} ${isToday ? "todayRing" : ""}`}
                      title={`${ymd}${c ? ` • ${c} entr${c === 1 ? "y" : "ies"}` : ""}`}
                      style={{
                        background: `linear-gradient(180deg, rgba(255,255,255,0.88) 0%, ${heatTint} 100%)`,
                      }}
                    >
                      <div className="dayTop">
                        <div className="dayNum">{d.getDate()}</div>
                      </div>

                      <div className="dotRow">
                        {c > 0 ? <span className="dot" /> : <span style={{ opacity: 0.35 }}>—</span>}
                        {c > 1 ? <span className="countBadge">{c}</span> : null}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 12, color: "rgba(18,19,24,0.60)", fontWeight: 850, fontSize: 12 }}>
                Tip: Click a day to see details and edit.
              </div>
            </div>
          </div>
        </div>

        {/* Center modal */}
        {selectedYMD ? (
          <GlassOverlay onClose={() => setSelectedYMD(null)} align="center">
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modalHeader">
                <div>
                  <div style={{ fontWeight: 980, fontSize: 16 }}>{selectedYMD}</div>
                  <div className="hSub">{selectedEntries.length} health entr{selectedEntries.length === 1 ? "y" : "ies"}</div>
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    className="miniBtn"
                    type="button"
                    onClick={() => {
                      // “Add entry” = set date, jump to form
                      setDateYMD(selectedYMD);
                      setEditingId(null);
                      resetFormKeepDateTime();
                      setSelectedYMD(null);
                      scrollToTopForm();
                    }}
                  >
                    Add entry
                  </button>
                  <button className="miniBtn miniPrimary" type="button" onClick={() => setSelectedYMD(null)}>
                    Close
                  </button>
                </div>
              </div>

              <div className="modalBody">
                {selectedEntries.length === 0 ? (
                  <div style={{ color: "rgba(18,19,24,0.65)", fontWeight: 900 }}>
                    No entries saved on this day.
                  </div>
                ) : (
                  selectedEntries.map((e) => {
                    const bp = e.bpSys || e.bpDia ? `${e.bpSys ?? "—"}/${e.bpDia ?? "—"}` : "—";
                    return (
                      <div key={e.id} className="entryCard">
                        <div>
                          <div className="entryTitle">
                            Entry • {e.timeHM}
                            <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 900, color: "rgba(18,19,24,0.60)" }}>
                              {String(e.createdAtISO).slice(0, 16).replace("T", " ")}
                            </span>
                          </div>

                          <div className="entryMeta">
                            Weight: <b>{e.weightKg ? `${e.weightKg} kg` : "—"}</b> &nbsp;•&nbsp; HR:{" "}
                            <b>{e.restingHr ? `${e.restingHr} bpm` : "—"}</b> &nbsp;•&nbsp; BP: <b>{bp}</b>
                          </div>

                          {e.notes ? <div className="entryMeta" style={{ marginTop: 8 }}>Notes: {e.notes}</div> : null}
                        </div>

                        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                          <button className="miniBtn" type="button" onClick={() => startEdit(e)}>
                            Edit
                          </button>
                          <button className="miniBtn" type="button" onClick={() => deleteEntry(e.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="footerNote">
                For general informational use only. Verify measurements and follow professional guidance.
              </div>
            </div>
          </GlassOverlay>
        ) : null}
      </AppPage>
    </AppShell>
  );
}
