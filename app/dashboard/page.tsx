"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell, AppPage, UI, GlassOverlay } from "../components/AppShell";

/** Matches your app */
const STORAGE_KEYS = {
  routines: "ds_routines_v4",
  injectionLogs: "rt_logs_v1",
  healthEntries: "health_entries_v2",
  vials: "dosecomp_vials_v1",
};

type Frequency = "daily" | "weekly" | "twice_weekly" | "three_times_weekly";

type Routine = {
  id: string;
  name?: string;
  doseMg?: number;
  frequency?: Frequency;
};

type InjectionLog = {
  id: number;
  spotLabel?: string;
  view?: "front" | "back";
  routineId: string;
  routineName?: string;
  injectedAtISO: string;
  doseMg?: string;
  notes?: string;
  createdAtISO?: string;
};

type HealthEntry = {
  id: string;
  dateYMD?: string;
  createdAtISO?: string;
  ymd?: string;
  date?: string;
  [k: string]: any;
};

type Vial = {
  id: string;
  name?: string;
  routineId?: string;
  vialMg: number;
  usedMg: number;
  reconDate?: string;
  archived?: boolean;
};

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
  return (jsDay + 6) % 7;
}
const monthFmt = new Intl.DateTimeFormat("en-NZ", { month: "long", year: "numeric" });
function monthLabel(d: Date) {
  return monthFmt.format(d);
}
function dayNameShort(idx: number) {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return names[idx] ?? "";
}
function fmtDose(v?: string) {
  if (!v) return "—";
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? `${n} mg` : v;
}
function ymdFromAnyHealth(e: HealthEntry): string | null {
  if (typeof e.dateYMD === "string" && e.dateYMD.length >= 10) return e.dateYMD.slice(0, 10);
  if (typeof e.ymd === "string" && e.ymd.length >= 10) return e.ymd.slice(0, 10);
  if (typeof e.date === "string" && e.date.length >= 10) return e.date.slice(0, 10);
  if (typeof e.createdAtISO === "string" && e.createdAtISO.length >= 10) return e.createdAtISO.slice(0, 10);
  return null;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Prediction logic */
function buildPredictedInjectionsYMD(
  routines: Routine[],
  logs: InjectionLog[],
  rangeStart: Date,
  rangeEnd: Date
) {
  const lastByRoutine: Record<string, Date | null> = {};
  for (const r of routines) lastByRoutine[r.id] = null;

  for (const l of logs) {
    const t = new Date(l.injectedAtISO);
    if (!Number.isFinite(t.getTime())) continue;
    const prev = lastByRoutine[l.routineId];
    if (!prev || t.getTime() > prev.getTime()) lastByRoutine[l.routineId] = t;
  }

  const out: Record<string, number> = {};
  const start = new Date(rangeStart);
  const end = new Date(rangeEnd);

  for (const r of routines) {
    const freq = r.frequency ?? "weekly";
    const base = lastByRoutine[r.id] ?? new Date();

    const stepSeq =
      freq === "daily"
        ? [1]
        : freq === "weekly"
        ? [7]
        : freq === "twice_weekly"
        ? [3, 4]
        : freq === "three_times_weekly"
        ? [2, 2, 3]
        : [7];

    let cursor = new Date(base);
    let si = 0;

    const genStart = addDays(start, -14);
    if (cursor.getTime() < genStart.getTime()) cursor = genStart;

    let guard = 0;
    while (cursor.getTime() <= end.getTime() && guard < 1200) {
      guard++;
      const step = stepSeq[si % stepSeq.length];
      si++;
      cursor = addDays(cursor, step);

      const t = cursor.getTime();
      if (t < start.getTime() || t > end.getTime()) continue;

      const ymd = toYMD(cursor);
      out[ymd] = (out[ymd] ?? 0) + 1;
    }
  }

  return out;
}

function QuickPill({
  href,
  label,
  badge,
  tone = "neutral",
  onTap,
}: {
  href: string;
  label: string;
  badge?: string;
  tone?: "neutral" | "primary" | "warn";
  onTap: () => void;
}) {
  const base: React.CSSProperties = {
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 12px",
    borderRadius: 999,
    fontWeight: 950,
    cursor: "pointer",
    minHeight: 42,
    gap: 8,
    boxShadow: "0 10px 22px rgba(0,0,0,0.12)",
  };

  const theme =
    tone === "primary"
      ? {
          border: `1px solid rgba(225,6,0,0.35)`,
          background: UI.accent,
          color: "#fff",
          boxShadow: "0 12px 26px rgba(0,0,0,0.18)",
        }
      : tone === "warn"
      ? {
          border: `1px solid rgba(225,6,0,0.22)`,
          background: "rgba(225,6,0,0.10)",
          color: "rgba(0,0,0,0.82)",
        }
      : {
          border: `1px solid rgba(0,0,0,0.08)`,
          background: "rgba(255,255,255,0.88)",
          color: "rgba(0,0,0,0.82)",
        };

  return (
    <Link href={href} onClick={onTap} style={{ ...base, ...theme }}>
      <span>{label}</span>
      {badge ? (
        <span
          style={{
            marginLeft: 2,
            padding: "3px 8px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 950,
            border: "1px solid rgba(0,0,0,0.10)",
            background: "rgba(255,255,255,0.78)",
            color: "rgba(0,0,0,0.70)",
            whiteSpace: "nowrap",
          }}
        >
          {badge}
        </span>
      ) : null}
      <span style={{ opacity: 0.55 }}>→</span>
    </Link>
  );
}

export default function DashboardPage() {
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [logs, setLogs] = useState<InjectionLog[]>([]);
  const [health, setHealth] = useState<HealthEntry[]>([]);
  const [vials, setVials] = useState<Vial[]>([]);

  const [selectedYMD, setSelectedYMD] = useState<string | null>(null);
  const [todayYMD, setTodayYMD] = useState<string>(() => toYMD(new Date())); // client safe

  useEffect(() => {
    setTodayYMD(toYMD(new Date()));
    try {
      const sr = localStorage.getItem(STORAGE_KEYS.routines);
      const sl = localStorage.getItem(STORAGE_KEYS.injectionLogs);
      const sh = localStorage.getItem(STORAGE_KEYS.healthEntries);
      const sv = localStorage.getItem(STORAGE_KEYS.vials);

      if (sr) setRoutines(JSON.parse(sr));
      if (sl) setLogs(JSON.parse(sl));
      if (sh) setHealth(JSON.parse(sh));
      if (sv) setVials(JSON.parse(sv));
    } catch {
      setRoutines([]);
      setLogs([]);
      setHealth([]);
      setVials([]);
    }
  }, []);

  const hasAnyData = useMemo(() => {
    return (routines?.length ?? 0) > 0 || (logs?.length ?? 0) > 0 || (health?.length ?? 0) > 0;
  }, [routines, logs, health]);

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

  const injectionsByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of logs) {
      if (!l?.injectedAtISO) continue;
      const ymd = String(l.injectedAtISO).slice(0, 10);
      if (ymd.length === 10) map[ymd] = (map[ymd] ?? 0) + 1;
    }
    return map;
  }, [logs]);

  const healthByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const h of health) {
      const ymd = ymdFromAnyHealth(h);
      if (!ymd) continue;
      map[ymd] = (map[ymd] ?? 0) + 1;
    }
    return map;
  }, [health]);

  const predictedByDay = useMemo(() => {
    if (!hasAnyData) return {};
    return buildPredictedInjectionsYMD(routines, logs, cal.gridStart, cal.gridEnd);
  }, [hasAnyData, routines, logs, cal.gridStart, cal.gridEnd]);

  const heatByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of cal.days) {
      const ymd = toYMD(d);
      const inj = injectionsByDay[ymd] ?? 0;
      const h = healthByDay[ymd] ?? 0;
      const pred = hasAnyData ? (predictedByDay[ymd] ?? 0) : 0;
      map[ymd] = inj * 1.0 + h * 0.75 + pred * 0.35;
    }
    return map;
  }, [cal.days, injectionsByDay, healthByDay, predictedByDay, hasAnyData]);

  const heatMax = useMemo(() => {
    let mx = 0;
    for (const k of Object.keys(heatByDay)) mx = Math.max(mx, heatByDay[k] ?? 0);
    return Math.max(1, mx);
  }, [heatByDay]);

  function prevMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }
  function nextMonth() {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }
  function goToday() {
    setMonth(startOfMonth(new Date()));
  }

  const dayLogs = useMemo(() => {
    if (!selectedYMD) return [];
    return logs
      .filter((l) => String(l.injectedAtISO ?? "").slice(0, 10) === selectedYMD)
      .slice()
      .sort((a, b) => String(b.injectedAtISO).localeCompare(String(a.injectedAtISO)));
  }, [logs, selectedYMD]);

  const dayHealth = useMemo(() => {
    if (!selectedYMD) return [];
    return health
      .filter((h) => ymdFromAnyHealth(h) === selectedYMD)
      .slice()
      .sort((a, b) => String(b.createdAtISO ?? "").localeCompare(String(a.createdAtISO ?? "")));
  }, [health, selectedYMD]);

  const dayPredCount = useMemo(() => {
    if (!selectedYMD) return 0;
    return hasAnyData ? (predictedByDay[selectedYMD] ?? 0) : 0;
  }, [selectedYMD, predictedByDay, hasAnyData]);

  const lowVials = useMemo(() => {
    const active = (vials ?? []).filter((v) => !v.archived);
    const out: Array<{
      vialId: string;
      vialName: string;
      shotsLeft: number | null;
      remainingMg: number;
      routineName: string | null;
    }> = [];

    for (const v of active) {
      const rem = Math.max(0, (v.vialMg ?? 0) - (v.usedMg ?? 0));
      const r = routines.find((x) => x.id === v.routineId);
      const dose = r?.doseMg;

      if (dose && Number.isFinite(dose) && dose > 0) {
        const shotsLeft = rem / dose;
        if (shotsLeft <= 2.01) {
          out.push({
            vialId: v.id,
            vialName: v.name ?? "Vial",
            shotsLeft,
            remainingMg: rem,
            routineName: r?.name ?? null,
          });
        }
      }
    }

    return out.sort((a, b) => (a.shotsLeft ?? 999) - (b.shotsLeft ?? 999));
  }, [vials, routines]);

  const cta = useMemo(() => {
    if (!selectedYMD) return { primary: "close" as const };
    const needsActivity = dayLogs.length === 0;
    const needsHealth = dayHealth.length === 0;
    const hasAlerts = lowVials.length > 0;
    if (needsActivity) return { primary: "tracker" as const };
    if (needsHealth) return { primary: "health" as const };
    if (hasAlerts) return { primary: "stock" as const };
    return { primary: "close" as const };
  }, [selectedYMD, dayLogs.length, dayHealth.length, lowVials.length]);

  return (
    <AppShell title="Dashboard" subtitle="A clean overview of your routines, signals, and consistency.">
      <AppPage>
        <style jsx global>{`
          .dashWrap {
            display: flex;
            flex-direction: column;
            gap: 14px;
          }

          /* White “Health-style” card */
          .calCard {
            border-radius: 22px;
            background: rgba(255, 255, 255, 0.92);
            box-shadow: 0 22px 70px rgba(0, 0, 0, 0.45);
            border: 1px solid rgba(0, 0, 0, 0.06);
            padding: 14px;
            overflow: hidden;
          }

          .calHeader {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            flex-wrap: wrap;
            margin-bottom: 10px;
          }

          .calTitle {
            display: flex;
            align-items: baseline;
            gap: 10px;
            flex-wrap: wrap;
          }

          .calTitleText {
            font-weight: 980;
            color: rgba(0, 0, 0, 0.85);
            font-size: 16px;
          }

          .calSub {
            color: rgba(0, 0, 0, 0.55);
            font-weight: 850;
            font-size: 12px;
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
            background: rgba(255, 255, 255, 0.85);
            cursor: pointer;
            font-weight: 950;
            color: rgba(0, 0, 0, 0.75);
            box-shadow: 0 10px 22px rgba(0, 0, 0, 0.12);
          }

          .monthPill {
            padding: 9px 12px;
            border-radius: 14px;
            border: 1px solid rgba(0, 0, 0, 0.10);
            background: rgba(255, 255, 255, 0.85);
            color: rgba(0, 0, 0, 0.80);
            font-weight: 950;
            min-width: 180px;
            text-align: center;
            box-shadow: 0 10px 22px rgba(0, 0, 0, 0.12);
          }

          .todayBtn {
            padding: 9px 12px;
            border-radius: 999px;
            border: 1px solid rgba(225, 6, 0, 0.25);
            background: rgba(225, 6, 0, 0.10);
            color: rgba(0, 0, 0, 0.78);
            font-weight: 950;
            cursor: pointer;
            box-shadow: 0 10px 22px rgba(0, 0, 0, 0.12);
          }

          .dowRow {
            display: grid;
            grid-template-columns: repeat(7, minmax(0, 1fr));
            gap: 10px;
            margin-top: 10px;
            margin-bottom: 10px;
            color: rgba(0, 0, 0, 0.55);
            font-weight: 900;
            font-size: 12px;
            padding: 0 4px;
          }

          .grid {
            display: grid;
            grid-template-columns: repeat(7, minmax(0, 1fr));
            gap: 10px;
          }

          /* Light tiles like the other pages */
          .dayBtn {
            text-align: left;
            border-radius: 16px;
            border: 1px solid rgba(0, 0, 0, 0.08);
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(245, 245, 247, 0.98) 100%);
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
            border-color: rgba(0, 0, 0, 0.12);
          }

          .dayNum {
            font-weight: 980;
            color: rgba(0, 0, 0, 0.82);
            font-size: 14px;
          }

          .outside {
            opacity: 0.45;
          }

          .todayRing {
            box-shadow: 0 0 0 2px rgba(225, 6, 0, 0.16), 0 12px 26px rgba(0, 0, 0, 0.12);
            border-color: rgba(225, 6, 0, 0.22) !important;
          }

          .dots {
            display: flex;
            align-items: center;
            gap: 7px;
            margin-top: 8px;
          }

          .dot {
            width: 10px;
            height: 10px;
            border-radius: 99px;
            display: inline-block;
          }

          .legend {
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid rgba(0, 0, 0, 0.08);
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            align-items: center;
            color: rgba(0, 0, 0, 0.60);
            font-weight: 850;
            font-size: 12px;
          }

          .sheet {
            width: min(860px, 100%);
            background: rgba(255, 255, 255, 0.96);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            border: 1px solid rgba(0, 0, 0, 0.10);
            border-radius: 20px;
            box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
            overflow: hidden;
          }

          .sheetHeader {
            padding: 14px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.08);
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
          }

          .muted {
            color: rgba(0, 0, 0, 0.55);
            font-weight: 850;
            font-size: 12px;
          }

          .row {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            padding: 10px 12px;
            border: 1px solid rgba(0, 0, 0, 0.08);
            border-radius: 14px;
            background: rgba(255, 255, 255, 0.92);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.10);
            margin-top: 8px;
          }

          .closeBtn {
            padding: 10px 12px;
            border-radius: 999px;
            border: 1px solid rgba(225, 6, 0, 0.30);
            background: ${UI.accent};
            color: #fff;
            cursor: pointer;
            font-weight: 950;
            box-shadow: 0 10px 22px rgba(0, 0, 0, 0.14);
          }

          .section {
            padding: 14px;
            border-top: 1px solid rgba(0, 0, 0, 0.06);
          }

          .sectionTitle {
            font-weight: 980;
            color: rgba(0, 0, 0, 0.82);
            margin-bottom: 8px;
          }

          .quickRow {
            padding: 14px;
            border-bottom: 1px solid rgba(0, 0, 0, 0.08);
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            align-items: center;
            justify-content: flex-start;
            background: linear-gradient(180deg, rgba(225, 6, 0, 0.08) 0%, rgba(255, 255, 255, 0.85) 100%);
          }

          @media (max-width: 520px) {
            .grid {
              gap: 8px;
            }
            .dayBtn {
              min-height: 66px;
              padding: 9px;
              border-radius: 14px;
            }
            .monthPill {
              min-width: 150px;
            }
          }
        `}</style>

        <div className="dashWrap">
          <div className="calCard">
            <div className="calHeader">
              <div className="calTitle">
                <div className="calTitleText">Calendar</div>
                <div className="calSub">Heat = activity + health {hasAnyData ? "+ predicted" : ""}</div>
              </div>

              <div className="calControls">
                <button className="todayBtn" onClick={goToday}>
                  Today
                </button>
                <button className="iconBtn" onClick={prevMonth} aria-label="Previous month">
                  ‹
                </button>
                <div className="monthPill">{monthLabel(month)}</div>
                <button className="iconBtn" onClick={nextMonth} aria-label="Next month">
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

            <div className="grid">
              {cal.days.map((d) => {
                const ymd = toYMD(d);
                const inMonth = d.getMonth() === cal.mStart.getMonth();

                const inj = injectionsByDay[ymd] ?? 0;
                const h = healthByDay[ymd] ?? 0;
                const pred = hasAnyData ? (predictedByDay[ymd] ?? 0) : 0;
                const showPred = hasAnyData && pred > 0;

                const isToday = ymd === todayYMD;

                const score = heatByDay[ymd] ?? 0;
                const alpha = hasAnyData ? clamp(score / heatMax, 0, 1) : 0;

                // soft red heat wash at the bottom of tile
                const heatTint = hasAnyData
                  ? `rgba(225,6,0,${0.04 + alpha * 0.14})`
                  : "rgba(225,6,0,0.00)";

                return (
                  <button
                    key={ymd}
                    type="button"
                    onClick={() => setSelectedYMD(ymd)}
                    className={`dayBtn ${!inMonth ? "outside" : ""} ${isToday ? "todayRing" : ""}`}
                    title={`${ymd}\nActivity: ${inj}\nHealth: ${h}${hasAnyData ? `\nPredicted: ${pred}` : ""}`}
                    style={{
                      outline: "none",
                      background: `linear-gradient(180deg, rgba(255,255,255,0.98) 0%, ${heatTint} 100%)`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div className="dayNum">{d.getDate()}</div>
                    </div>

                    <div className="dots">
                      {inj > 0 ? <span className="dot" style={{ background: UI.accent }} /> : null}
                      {h > 0 ? <span className="dot" style={{ background: "rgba(0,0,0,0.35)" }} /> : null}
                      {showPred ? <span className="dot" style={{ background: "rgba(225,6,0,0.35)" }} /> : null}

                      {inj === 0 && h === 0 && !showPred ? (
                        <span style={{ opacity: 0.22, fontWeight: 900, color: "rgba(0,0,0,0.55)" }}>—</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="legend">
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span className="dot" style={{ background: UI.accent }} /> Activity
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span className="dot" style={{ background: "rgba(0,0,0,0.35)" }} /> Health
              </span>
              {hasAnyData ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span className="dot" style={{ background: "rgba(225,6,0,0.35)" }} /> Predicted
                </span>
              ) : null}
              <span style={{ marginLeft: "auto", opacity: 0.95 }}>
                Tip: log in <b>Tracker</b> + <b>Health</b> to populate the calendar.
              </span>
            </div>
          </div>
        </div>

        {/* Day details drawer */}
        {selectedYMD ? (
          <GlassOverlay onClose={() => setSelectedYMD(null)} align="bottom">
            <div className="sheet" onClick={(e) => e.stopPropagation()}>
              <div style={{ width: 44, height: 5, borderRadius: 999, background: "rgba(0,0,0,0.14)", margin: "10px auto 0" }} />

              <div className="sheetHeader">
                <div>
                  <div style={{ fontWeight: 980, color: "rgba(0,0,0,0.82)", fontSize: 16 }}>{selectedYMD}</div>
                  <div className="muted">
                    {dayLogs.length} activity • {dayHealth.length} health entries
                    {hasAnyData ? ` • ${dayPredCount} predicted` : ""}
                    {lowVials.length ? ` • ${lowVials.length} stock alert${lowVials.length === 1 ? "" : "s"}` : ""}
                  </div>
                </div>

                <button
                  className="closeBtn"
                  onClick={() => setSelectedYMD(null)}
                  style={{
                    background: cta.primary === "close" ? UI.accent : "rgba(0,0,0,0.06)",
                    color: cta.primary === "close" ? "#fff" : "rgba(0,0,0,0.80)",
                    border:
                      cta.primary === "close"
                        ? "1px solid rgba(225,6,0,0.30)"
                        : "1px solid rgba(0,0,0,0.10)",
                  }}
                >
                  Close
                </button>
              </div>

              <div className="quickRow">
                <QuickPill
                  href="/tracker"
                  label="Go to Tracker"
                  badge={dayLogs.length === 0 ? "Missing" : dayLogs.length ? `${dayLogs.length} logged` : undefined}
                  tone={cta.primary === "tracker" ? "primary" : "neutral"}
                  onTap={() => setSelectedYMD(null)}
                />

                <QuickPill
                  href="/health"
                  label="Go to Health"
                  badge={dayHealth.length === 0 ? "Missing" : dayHealth.length ? `${dayHealth.length} logged` : undefined}
                  tone={cta.primary === "health" ? "primary" : "neutral"}
                  onTap={() => setSelectedYMD(null)}
                />

                <QuickPill
                  href="/vials"
                  label={lowVials.length ? "⚠️ Go to Stock" : "Go to Stock"}
                  badge={lowVials.length ? `${lowVials.length} alert${lowVials.length === 1 ? "" : "s"}` : undefined}
                  tone={cta.primary === "stock" ? "primary" : lowVials.length ? "warn" : "neutral"}
                  onTap={() => setSelectedYMD(null)}
                />

                <QuickPill
                  href="/calculator"
                  label="Calculator"
                  badge={hasAnyData && dayPredCount > 0 ? `+${dayPredCount} pred` : undefined}
                  tone="neutral"
                  onTap={() => setSelectedYMD(null)}
                />
              </div>

              <div className="section">
                <div className="sectionTitle">Activity</div>
                {dayLogs.length === 0 ? (
                  <div className="muted">No activity logged this day.</div>
                ) : (
                  dayLogs.map((l) => (
                    <div key={l.id} className="row">
                      <div>
                        <div style={{ fontWeight: 980, color: "rgba(0,0,0,0.82)" }}>
                          {l.routineName ?? "Routine"} {l.spotLabel ? `• ${l.spotLabel}` : ""}
                        </div>
                        <div className="muted">
                          {String(l.injectedAtISO ?? "").replace("T", " ").slice(0, 16)} • {fmtDose(l.doseMg)}
                        </div>
                        {l.notes ? <div className="muted" style={{ marginTop: 6 }}>{l.notes}</div> : null}
                      </div>
                      <div style={{ fontWeight: 950, color: "rgba(0,0,0,0.55)" }}>●</div>
                    </div>
                  ))
                )}
              </div>

              <div className="section">
                <div className="sectionTitle">Health</div>
                {dayHealth.length === 0 ? (
                  <div className="muted">No health entries logged this day.</div>
                ) : (
                  dayHealth.map((h) => (
                    <div key={h.id} className="row">
                      <div>
                        <div style={{ fontWeight: 980, color: "rgba(0,0,0,0.82)" }}>Health entry</div>
                        <div className="muted">
                          {String(h.createdAtISO ?? h.dateYMD ?? h.ymd ?? h.date ?? "—").slice(0, 16)}
                        </div>
                      </div>
                      <div style={{ fontWeight: 950, color: "rgba(0,0,0,0.55)" }}>◻︎</div>
                    </div>
                  ))
                )}
              </div>

              <div className="section">
                <div className="sectionTitle">Predicted</div>
                {!hasAnyData ? (
                  <div className="muted">Predictions appear once you’ve added routines / logs.</div>
                ) : dayPredCount <= 0 ? (
                  <div className="muted">No predicted activity for this day.</div>
                ) : (
                  <div className="row">
                    <div>
                      <div style={{ fontWeight: 980, color: "rgba(0,0,0,0.82)" }}>
                        {dayPredCount} predicted item{dayPredCount === 1 ? "" : "s"}
                      </div>
                      <div className="muted">Based on your routine frequency and recent logs.</div>
                    </div>
                    <div style={{ fontWeight: 950, color: "rgba(0,0,0,0.55)" }}>✦</div>
                  </div>
                )}
              </div>

              <div className="section">
                <div className="sectionTitle">Stock alerts</div>
                {lowVials.length === 0 ? (
                  <div className="muted">No low-stock items detected.</div>
                ) : (
                  lowVials.map((x) => (
                    <div key={x.vialId} className="row">
                      <div>
                        <div style={{ fontWeight: 980, color: "rgba(0,0,0,0.82)" }}>⚠️ Low stock: {x.vialName}</div>
                        <div className="muted">
                          {x.routineName ? `${x.routineName} • ` : ""}
                          ~{clamp(x.shotsLeft ?? 0, 0, 999).toFixed(1)} left • {x.remainingMg.toFixed(1)} mg remaining
                        </div>
                      </div>
                      <div style={{ fontWeight: 950, color: "rgba(0,0,0,0.55)" }}>🧪</div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ padding: 14, color: "rgba(0,0,0,0.55)", fontWeight: 850, fontSize: 12, lineHeight: 1.4 }}>
                For general informational use only. Verify measurements and follow professional guidance.
              </div>
            </div>
          </GlassOverlay>
        ) : null}
      </AppPage>
    </AppShell>
  );
}
