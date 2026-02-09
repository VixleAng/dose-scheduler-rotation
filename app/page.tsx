"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell, UI } from "./components/AppShell";

type Frequency = "daily" | "weekly" | "twice_weekly" | "three_times_weekly";

type DoseLog = {
  id: number;
  routineId: string;
  routineName: string;
  amountMg: string;
  frequency: Frequency;
  doseDateTime: string; // ISO
  createdAt: string; // ISO
};

type InjectionLog = {
  id: number;
  zoneId: string;
  zoneLabel: string;
  view: "front" | "back";
  routineId: string;
  routineName: string;
  injectedAtISO: string; // ISO
  doseMg?: string;
  notes?: string;
  createdAtISO: string; // ISO
};

type HealthLog = {
  id: number;
  ymd: string; // YYYY-MM-DD
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

type Routine = {
  id: string;
  name: string;
  doseMg?: number | string;
  frequency?: Frequency;
  startDate?: string; // YYYY-MM-DD
  preferredTime?: string; // HH:mm
  reconstitutedOn?: string;
};

type Vial = {
  id: string;
  name: string;
  routineId?: string;
  vialMg: number;
  bacMl: number;
  reconDate: string;
  usedMg: number;
  notes?: string;
  archived?: boolean;
  createdAt: number;
};

type ViewMode = "today" | "week" | "month";
type FilterMode = "all" | "doses" | "injections" | "health";

const ROUTINE_COLORS = ["#2563eb", "#16a34a", "#ea580c", "#7c3aed", "#dc2626", "#0891b2", "#ca8a04"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function ymdFromISO(iso: string) {
  const d = new Date(iso);
  return toYMD(d);
}
function monthLabel(date: Date) {
  return date.toLocaleString(undefined, { month: "long", year: "numeric" });
}
function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
function mondayIndex(jsDay: number) {
  return (jsDay + 6) % 7;
}
function startOfWeek(date: Date) {
  const d = new Date(date);
  const offset = mondayIndex(d.getDay());
  d.setDate(d.getDate() - offset);
  d.setHours(0, 0, 0, 0);
  return d;
}
function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function parseHealthTimeToComparable(timeHHMM: string) {
  const [h, m] = timeHHMM.split(":").map((x) => parseInt(x, 10));
  return (isNaN(h) ? 0 : h) * 100 + (isNaN(m) ? 0 : m);
}
function safeParseArray<T>(s: string | null): T[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as T[]) : [];
  } catch {
    return [];
  }
}
function readFirstArray<T>(keys: string[]): T[] {
  for (const k of keys) {
    const arr = safeParseArray<T>(localStorage.getItem(k));
    if (arr.length) return arr;
  }
  return [];
}

// Planned schedule gaps (cycle) for “twice/three weekly”
function scheduleGaps(freq: Frequency): number[] {
  if (freq === "daily") return [1];
  if (freq === "weekly") return [7];
  if (freq === "twice_weekly") return [3, 4];
  return [2, 2, 3];
}

function badge(text: string, highlight = false) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 999,
        border: highlight ? `1px solid rgba(255,106,61,0.45)` : `1px solid rgba(17,17,17,0.10)`,
        background: highlight ? "rgba(255,106,61,0.10)" : "rgba(255,255,255,0.75)",
        color: UI.ink,
        fontWeight: 950,
        fontSize: 12,
        whiteSpace: "nowrap",
        minHeight: 34,
      }}
    >
      {text}
    </span>
  );
}

function CompactActionLink({ href, children, variant }: { href: string; children: React.ReactNode; variant?: "primary" | "soft" }) {
  const primary = variant === "primary";
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        padding: primary ? "12px 12px" : "10px 12px",
        borderRadius: 999,
        border: primary ? `1px solid rgba(255,106,61,0.55)` : `1px solid rgba(17,17,17,0.10)`,
        background: primary ? UI.accent : "rgba(255,255,255,0.82)",
        color: primary ? "#fff" : UI.ink,
        fontWeight: 950,
        fontSize: 14,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: primary ? 44 : 40,
        boxShadow: primary ? "0 10px 22px rgba(0,0,0,0.10)" : "none",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {children}
    </Link>
  );
}

export default function HomeDashboard() {
  const [view, setView] = useState<ViewMode>("month");
  const [filter, setFilter] = useState<FilterMode>("all");

  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [weekAnchor, setWeekAnchor] = useState<Date>(new Date());
  const [selectedDayYMD, setSelectedDayYMD] = useState<string | null>(null);

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>([]);
  const [injLogs, setInjLogs] = useState<InjectionLog[]>([]);
  const [healthLogs, setHealthLogs] = useState<HealthLog[]>([]);
  const [vials, setVials] = useState<Vial[]>([]);

  // Hydration-safe date chip
  const [dateChip, setDateChip] = useState<string>("");

  const todayYMD = useMemo(() => toYMD(new Date()), []);

  const routineColorById = useMemo(() => {
    const map: Record<string, string> = {};
    (routines ?? []).forEach((r, idx) => {
      map[r.id] = ROUTINE_COLORS[idx % ROUTINE_COLORS.length];
    });
    return map;
  }, [routines]);

  useEffect(() => {
    // date chip after mount (prevents hydration mismatch)
    try {
      const s = new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "2-digit" });
      setDateChip(s);
    } catch {
      setDateChip("");
    }

    const rr = readFirstArray<Routine>(["ds_routines_v4", "ds_routines_v3", "ds_routines_v2", "ds_routines", "routines"]);
    setRoutines(rr);

    const dl = readFirstArray<DoseLog>(["ds_logs_v4", "ds_logs_v3", "ds_logs_v2", "ds_logs", "doseLogs"]);
    setDoseLogs(dl);

    const il = readFirstArray<InjectionLog>(["rt_logs_clean_v1", "rt_logs_v1", "rotation_logs_v1"]);
    setInjLogs(il);

    const hl = readFirstArray<HealthLog>(["health_entries_v2", "health_entries_v1", "hb_logs_v1"]);
    setHealthLogs(hl);

    const vv = readFirstArray<Vial>(["dosecomp_vials_v1"]);
    setVials(vv);
  }, []);

  const dosesByDay = useMemo(() => {
    const map: Record<string, DoseLog[]> = {};
    for (const d of doseLogs) {
      const key = ymdFromISO(d.doseDateTime);
      if (!map[key]) map[key] = [];
      map[key].push(d);
    }
    Object.keys(map).forEach((k) =>
      map[k].sort((a, b) => new Date(a.doseDateTime).getTime() - new Date(b.doseDateTime).getTime())
    );
    return map;
  }, [doseLogs]);

  const injectionsByDay = useMemo(() => {
    const map: Record<string, InjectionLog[]> = {};
    for (const i of injLogs) {
      const key = ymdFromISO(i.injectedAtISO);
      if (!map[key]) map[key] = [];
      map[key].push(i);
    }
    Object.keys(map).forEach((k) =>
      map[k].sort((a, b) => new Date(a.injectedAtISO).getTime() - new Date(b.injectedAtISO).getTime())
    );
    return map;
  }, [injLogs]);

  const healthByDay = useMemo(() => {
    const map: Record<string, HealthLog[]> = {};
    for (const h of healthLogs) {
      if (!map[h.ymd]) map[h.ymd] = [];
      map[h.ymd].push(h);
    }
    Object.keys(map).forEach((k) =>
      map[k].sort((a, b) => parseHealthTimeToComparable(a.timeHHMM) - parseHealthTimeToComparable(b.timeHHMM))
    );
    return map;
  }, [healthLogs]);

  const plannedByDay = useMemo(() => {
    const map: Record<string, { routineId: string; routineName: string }[]> = {};
    const start = addDays(new Date(), -60);
    const end = addDays(new Date(), 120);

    const inRange = (d: Date) => d.getTime() >= start.getTime() && d.getTime() <= end.getTime();

    for (const r of routines) {
      const freq = r.frequency as Frequency | undefined;
      if (!freq) continue;

      const anchor = r.startDate ? new Date(`${r.startDate}T00:00:00`) : new Date();
      anchor.setHours(0, 0, 0, 0);

      const gaps = scheduleGaps(freq);

      let cur = new Date(anchor);
      cur.setHours(0, 0, 0, 0);
      while (cur.getTime() > start.getTime()) {
        const back = gaps[gaps.length - 1] || 1;
        cur = addDays(cur, -back);
      }

      let gi = 0;
      let guard = 0;
      while (cur.getTime() <= end.getTime() && guard < 2000) {
        if (inRange(cur)) {
          const ymd = toYMD(cur);
          if (!map[ymd]) map[ymd] = [];
          map[ymd].push({ routineId: r.id, routineName: r.name });
        }
        const step = gaps[gi % gaps.length] || 1;
        gi++;
        cur = addDays(cur, step);
        guard++;
      }
    }

    return map;
  }, [routines]);

  const nextPlanned = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i <= 60; i++) {
      const d = addDays(today, i);
      const ymd = toYMD(d);
      const items = plannedByDay[ymd] ?? [];
      if (items.length) return { ymd, item: items[0] };
    }
    return null;
  }, [plannedByDay]);

  const activeVials = useMemo(() => (vials ?? []).filter((v) => !v.archived), [vials]);
  const stockRemainingMg = useMemo(() => {
    const rem = activeVials.reduce((s, v) => s + Math.max(0, (v.vialMg ?? 0) - (v.usedMg ?? 0)), 0);
    return Math.round(rem * 10) / 10;
  }, [activeVials]);

  const todayDoseCount = (dosesByDay[todayYMD] ?? []).length;
  const todayInjCount = (injectionsByDay[todayYMD] ?? []).length;
  const todayHealthCount = (healthByDay[todayYMD] ?? []).length;

  const weekStart = useMemo(() => startOfWeek(weekAnchor), [weekAnchor]);

  const weekCounts = useMemo(() => {
    let doses = 0,
      inj = 0,
      health = 0;
    for (let i = 0; i < 7; i++) {
      const ymd = toYMD(addDays(weekStart, i));
      doses += (dosesByDay[ymd] ?? []).length;
      inj += (injectionsByDay[ymd] ?? []).length;
      health += (healthByDay[ymd] ?? []).length;
    }
    return { doses, inj, health, total: doses + inj + health };
  }, [weekStart, dosesByDay, injectionsByDay, healthByDay]);

  const selectedDoses = selectedDayYMD ? dosesByDay[selectedDayYMD] ?? [] : [];
  const selectedInj = selectedDayYMD ? injectionsByDay[selectedDayYMD] ?? [] : [];
  const selectedHealth = selectedDayYMD ? healthByDay[selectedDayYMD] ?? [] : [];
  const selectedPlanned = selectedDayYMD ? plannedByDay[selectedDayYMD] ?? [] : [];

  const monthGrid = useMemo(() => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    const offset = mondayIndex(start.getDay());
    const daysInMonth = end.getDate();
    const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;

    const cells: { date: Date; inMonth: boolean; ymd: string }[] = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - offset + 1;
      const d = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), dayNum);
      const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
      cells.push({ date: d, inMonth, ymd: toYMD(d) });
    }
    return cells;
  }, [calendarMonth]);

  const heroCard: React.CSSProperties = {
    border: `1px solid ${UI.line}`,
    borderRadius: 18,
    background: "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,247,243,0.92) 100%)",
    boxShadow: UI.shadow,
    padding: 16,
  };

  const subtleCard: React.CSSProperties = {
    border: `1px solid ${UI.line}`,
    borderRadius: 18,
    background: UI.card,
    boxShadow: UI.shadow,
    padding: 14,
  };

  return (
    <AppShell title="Dashboard" subtitle="Doses, injections, and health check-ins — one overview.">
      <style jsx>{`
        .chipRow {
          margin-top: 10px;
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
        }

        /* Quick actions bar (top, compact) */
        .qaBar {
          margin-top: 10px;
          border: 1px solid rgba(17, 17, 17, 0.1);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.72);
          box-shadow: 0 16px 34px rgba(0, 0, 0, 0.06);
          overflow: hidden;
        }
        .qaSummary {
          cursor: pointer;
          list-style: none;
          user-select: none;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 14px;
          font-weight: 950;
          color: rgba(17, 17, 17, 0.92);
        }
        .qaSummary::-webkit-details-marker {
          display: none;
        }
        .qaHint {
          font-weight: 900;
          font-size: 12px;
          color: rgba(17, 17, 17, 0.55);
        }
        .qaInner {
          padding: 12px 14px 14px;
          border-top: 1px solid rgba(17, 17, 17, 0.08);
          background: rgba(255, 255, 255, 0.78);
        }
        .qaGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .qaTip {
          margin-top: 10px;
          color: rgba(17, 17, 17, 0.6);
          font-weight: 850;
          font-size: 12px;
          line-height: 1.35;
        }

        @media (max-width: 900px) {
          .qaGrid {
            grid-template-columns: 1fr;
          }
          .chipRow {
            gap: 8px;
          }
        }
        @media (max-width: 420px) {
          .chipRow {
            gap: 6px;
          }
        }
      `}</style>

      {/* TOP QUICK ACTIONS (one dropdown, near menu/header) */}
      <details className="qaBar">
        <summary className="qaSummary">
          <span>Quick actions</span>
          <span className="qaHint">Tap to open</span>
        </summary>

        <div className="qaInner">
          <div className="qaGrid">
            <CompactActionLink href="/tracker" variant="primary">
              Open Tracker →
            </CompactActionLink>

            <CompactActionLink href="/vials">Open Stock →</CompactActionLink>
            <CompactActionLink href="/health">Health check-in →</CompactActionLink>
            <CompactActionLink href="/tracker">+ Log dose</CompactActionLink>
            <CompactActionLink href="/tracker">+ Log injection</CompactActionLink>
          </div>

          <div className="qaTip">
            Tip: Keep <b>Tracker</b> as your daily workflow. <b>Stock</b> helps you plan purchases.
          </div>
        </div>
      </details>

      {/* HERO (overview only now) */}
      <div style={{ marginTop: 12, ...heroCard }}>
        <div style={{ fontWeight: 950, fontSize: 16, color: UI.ink }}>Overview</div>
        <div style={{ marginTop: 2, color: "rgba(17,17,17,0.62)", fontWeight: 850, fontSize: 12 }}>
          Today at a glance + your stock status — without the noise.
        </div>

        <div className="chipRow">
          {badge(dateChip ? dateChip : "—")}
          {badge(`Today • Doses ${todayDoseCount}`)}
          {badge(`Today • Injections ${todayInjCount}`)}
          {badge(`Today • Health ${todayHealthCount}`)}
          {badge(`Week • Total entries ${weekCounts.total}`)}
          {badge(`Stock • Active vials ${activeVials.length}`, true)}
          {badge(`Stock • Remaining ${stockRemainingMg} mg`, true)}
        </div>

        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid rgba(17,17,17,0.08)",
            color: "rgba(17,17,17,0.72)",
            fontWeight: 850,
            fontSize: 13,
            lineHeight: 1.45,
          }}
        >
          <div style={{ fontWeight: 950, color: UI.ink, marginBottom: 6 }}>Today check-in</div>

          {todayHealthCount > 0 ? (
            <div>Nice — you’ve already added a health check-in today.</div>
          ) : (
            <div>No check-in yet today — add one when you’re ready.</div>
          )}

          {nextPlanned ? (
            <div style={{ marginTop: 6 }}>
              Next scheduled injection:{" "}
              <span style={{ fontWeight: 950, color: UI.ink }}>
                {new Date(`${nextPlanned.ymd}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "2-digit",
                })}
              </span>{" "}
              <span style={{ color: "rgba(17,17,17,0.62)" }}>({nextPlanned.item.routineName})</span>
            </div>
          ) : (
            <div style={{ marginTop: 6 }}>Set a routine in Tracker to see scheduled injections here.</div>
          )}

          <div style={{ marginTop: 6, color: "rgba(17,17,17,0.60)" }}>
            Link a vial to a routine on <b>Stock</b> for run-out estimates.
          </div>
        </div>
      </div>

      {/* CALENDAR */}
      <div style={{ marginTop: 14, ...subtleCard }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontWeight: 950, color: UI.ink }}>Calendar</div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["today", "week", "month"] as ViewMode[]).map((v) => {
              const active = view === v;
              return (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: active ? `1px solid rgba(255,106,61,0.45)` : `1px solid ${UI.line}`,
                    background: active ? "rgba(17,17,17,0.92)" : "#fff",
                    color: active ? "#fff" : UI.ink,
                    fontWeight: 950,
                    cursor: "pointer",
                    minHeight: 44,
                  }}
                >
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["all", "doses", "injections", "health"] as FilterMode[]).map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  padding: "9px 12px",
                  borderRadius: 999,
                  border: active ? `1px solid rgba(255,106,61,0.45)` : `1px solid rgba(17,17,17,0.10)`,
                  background: active ? "rgba(255,106,61,0.12)" : "rgba(255,255,255,0.75)",
                  color: UI.ink,
                  fontWeight: 950,
                  cursor: "pointer",
                  minHeight: 40,
                }}
              >
                {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Month controls */}
        {view === "month" ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 950, color: UI.ink }}>{monthLabel(calendarMonth)}</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: `1px solid ${UI.line}`,
                    background: "#fff",
                    fontWeight: 950,
                    cursor: "pointer",
                    minHeight: 44,
                  }}
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setCalendarMonth(new Date())}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: `1px solid ${UI.line}`,
                    background: "#fff",
                    fontWeight: 950,
                    cursor: "pointer",
                    minHeight: 44,
                  }}
                >
                  This month
                </button>
                <button
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 999,
                    border: `1px solid ${UI.line}`,
                    background: "#fff",
                    fontWeight: 950,
                    cursor: "pointer",
                    minHeight: 44,
                  }}
                >
                  Next →
                </button>
              </div>
            </div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} style={{ fontWeight: 900, fontSize: 12, color: "rgba(17,17,17,0.55)", paddingLeft: 6 }}>
                  {d}
                </div>
              ))}

              {monthGrid.map((cell, idx) => {
                const ymd = cell.ymd;
                const isToday = ymd === todayYMD;
                const isSelected = selectedDayYMD === ymd;

                const hasDose = (dosesByDay[ymd] ?? []).length > 0;
                const hasInj = (injectionsByDay[ymd] ?? []).length > 0;
                const hasHealth = (healthByDay[ymd] ?? []).length > 0;

                const planned = plannedByDay[ymd] ?? [];

                const showDose = filter === "all" || filter === "doses";
                const showInj = filter === "all" || filter === "injections";
                const showHealth = filter === "all" || filter === "health";

                const hasAny = (showDose && hasDose) || (showInj && hasInj) || (showHealth && hasHealth) || planned.length > 0;

                return (
                  <button
                    key={`${ymd}_${idx}`}
                    onClick={() => setSelectedDayYMD(ymd)}
                    style={{
                      textAlign: "left",
                      borderRadius: 16,
                      border: isSelected ? `2px solid rgba(255,106,61,0.55)` : `1px solid rgba(17,17,17,0.10)`,
                      background: cell.inMonth ? "#fff" : "rgba(255,255,255,0.55)",
                      padding: 10,
                      cursor: "pointer",
                      minHeight: 74,
                      boxShadow: isSelected ? "0 18px 40px rgba(0,0,0,0.10)" : "none",
                      opacity: cell.inMonth ? 1 : 0.65,
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 950, color: UI.ink }}>{cell.date.getDate()}</div>
                      {isToday ? (
                        <span
                          style={{
                            fontWeight: 950,
                            fontSize: 11,
                            padding: "5px 8px",
                            borderRadius: 999,
                            background: "rgba(255,106,61,0.14)",
                            border: "1px solid rgba(255,106,61,0.35)",
                          }}
                        >
                          Today
                        </span>
                      ) : null}
                    </div>

                    {hasAny ? (
                      <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {showDose && hasDose ? <span style={{ width: 10, height: 10, borderRadius: 999, background: "#111" }} /> : null}
                        {showInj && hasInj ? <span style={{ width: 10, height: 10, borderRadius: 999, background: "rgba(255,106,61,0.95)" }} /> : null}
                        {showHealth && hasHealth ? <span style={{ width: 10, height: 10, borderRadius: 999, background: "rgba(17,17,17,0.40)" }} /> : null}

                        {planned.slice(0, 3).map((p) => (
                          <span
                            key={p.routineId}
                            title={`Planned: ${p.routineName}`}
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 999,
                              border: `2px solid ${routineColorById[p.routineId] || "rgba(17,17,17,0.35)"}`,
                              background: "transparent",
                            }}
                          />
                        ))}

                        {planned.length > 3 ? (
                          <span style={{ fontWeight: 950, fontSize: 11, color: "rgba(17,17,17,0.55)" }}>+{planned.length - 3}</span>
                        ) : null}
                      </div>
                    ) : (
                      <div style={{ marginTop: 10, color: "rgba(17,17,17,0.30)", fontWeight: 900, fontSize: 12 }}>—</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {view === "today" ? (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(17,17,17,0.08)" }}>
            <button
              onClick={() => setSelectedDayYMD(todayYMD)}
              style={{
                width: "100%",
                padding: "12px 12px",
                borderRadius: 16,
                border: `1px solid rgba(17,17,17,0.10)`,
                background: "rgba(255,255,255,0.75)",
                fontWeight: 950,
                cursor: "pointer",
                minHeight: 46,
              }}
            >
              Jump to today
            </button>
          </div>
        ) : null}

        {view === "week" ? (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(17,17,17,0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}
                style={{
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: `1px solid ${UI.line}`,
                  background: "#fff",
                  fontWeight: 950,
                  cursor: "pointer",
                  minHeight: 44,
                }}
              >
                ← Prev week
              </button>
              <button
                onClick={() => setWeekAnchor(new Date())}
                style={{
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: `1px solid ${UI.line}`,
                  background: "#fff",
                  fontWeight: 950,
                  cursor: "pointer",
                  minHeight: 44,
                }}
              >
                This week
              </button>
              <button
                onClick={() => setWeekAnchor(addDays(weekAnchor, +7))}
                style={{
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: `1px solid ${UI.line}`,
                  background: "#fff",
                  fontWeight: 950,
                  cursor: "pointer",
                  minHeight: 44,
                }}
              >
                Next week →
              </button>
            </div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }}>
              {Array.from({ length: 7 }).map((_, i) => {
                const d = addDays(weekStart, i);
                const ymd = toYMD(d);
                const isToday = ymd === todayYMD;
                const isSelected = selectedDayYMD === ymd;

                const hasDose = (dosesByDay[ymd] ?? []).length > 0;
                const hasInj = (injectionsByDay[ymd] ?? []).length > 0;
                const hasHealth = (healthByDay[ymd] ?? []).length > 0;
                const planned = plannedByDay[ymd] ?? [];

                const showDose = filter === "all" || filter === "doses";
                const showInj = filter === "all" || filter === "injections";
                const showHealth = filter === "all" || filter === "health";

                const hasAny = (showDose && hasDose) || (showInj && hasInj) || (showHealth && hasHealth) || planned.length > 0;

                return (
                  <button
                    key={ymd}
                    onClick={() => setSelectedDayYMD(ymd)}
                    style={{
                      textAlign: "left",
                      borderRadius: 16,
                      border: isSelected ? `2px solid rgba(255,106,61,0.55)` : `1px solid rgba(17,17,17,0.10)`,
                      background: "#fff",
                      padding: 10,
                      cursor: "pointer",
                      minHeight: 74,
                      boxShadow: isSelected ? "0 18px 40px rgba(0,0,0,0.10)" : "none",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 950, color: UI.ink, fontSize: 12 }}>{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
                      {isToday ? <span style={{ fontWeight: 950, fontSize: 11, color: UI.accent }}>Today</span> : null}
                    </div>

                    <div style={{ marginTop: 6, fontWeight: 950, color: UI.ink }}>{d.getDate()}</div>

                    {hasAny ? (
                      <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {showDose && hasDose ? <span style={{ width: 10, height: 10, borderRadius: 999, background: "#111" }} /> : null}
                        {showInj && hasInj ? <span style={{ width: 10, height: 10, borderRadius: 999, background: "rgba(255,106,61,0.95)" }} /> : null}
                        {showHealth && hasHealth ? <span style={{ width: 10, height: 10, borderRadius: 999, background: "rgba(17,17,17,0.40)" }} /> : null}
                        {planned.slice(0, 2).map((p) => (
                          <span
                            key={p.routineId}
                            title={`Planned: ${p.routineName}`}
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: 999,
                              border: `2px solid ${routineColorById[p.routineId] || "rgba(17,17,17,0.35)"}`,
                              background: "transparent",
                            }}
                          />
                        ))}
                        {planned.length > 2 ? (
                          <span style={{ fontWeight: 950, fontSize: 11, color: "rgba(17,17,17,0.55)" }}>+{planned.length - 2}</span>
                        ) : null}
                      </div>
                    ) : (
                      <div style={{ marginTop: 10, color: "rgba(17,17,17,0.30)", fontWeight: 900, fontSize: 12 }}>—</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Day details */}
        {selectedDayYMD ? (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(17,17,17,0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontWeight: 950, color: UI.ink }}>
                Day details •{" "}
                {new Date(`${selectedDayYMD}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "2-digit",
                  year: "numeric",
                })}
              </div>
              <button
                onClick={() => setSelectedDayYMD(null)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 999,
                  border: `1px solid rgba(255,106,61,0.55)`,
                  background: UI.accent,
                  color: "#fff",
                  fontWeight: 950,
                  cursor: "pointer",
                  minHeight: 44,
                }}
              >
                Close
              </button>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div style={{ ...subtleCard }}>
                <div style={{ fontWeight: 950, marginBottom: 8 }}>Planned</div>
                {selectedPlanned.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {selectedPlanned.map((p) => (
                      <div key={p.routineId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 999, border: `2px solid ${routineColorById[p.routineId] || "rgba(17,17,17,0.35)"}` }} />
                        <div style={{ fontWeight: 900, color: UI.ink }}>{p.routineName}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "rgba(17,17,17,0.55)", fontWeight: 850 }}>No planned injections.</div>
                )}
              </div>

              <div style={{ ...subtleCard }}>
                <div style={{ fontWeight: 950, marginBottom: 8 }}>Dose logs</div>
                {selectedDoses.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {selectedDoses.map((d) => (
                      <div key={d.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 900, color: UI.ink }}>{d.routineName}</div>
                        <div style={{ fontWeight: 900, color: "rgba(17,17,17,0.62)" }}>
                          {d.amountMg} mg • {timeLabel(d.doseDateTime)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "rgba(17,17,17,0.55)", fontWeight: 850 }}>No dose logs.</div>
                )}
              </div>

              <div style={{ ...subtleCard }}>
                <div style={{ fontWeight: 950, marginBottom: 8 }}>Injection logs</div>
                {selectedInj.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {selectedInj.map((i) => (
                      <div key={i.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontWeight: 900, color: UI.ink }}>{i.routineName}</div>
                        <div style={{ fontWeight: 900, color: "rgba(17,17,17,0.62)" }}>
                          {i.zoneLabel} • {timeLabel(i.injectedAtISO)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "rgba(17,17,17,0.55)", fontWeight: 850 }}>No injection logs.</div>
                )}
              </div>

              <div style={{ ...subtleCard, gridColumn: "1 / -1" }}>
                <div style={{ fontWeight: 950, marginBottom: 8 }}>Health check-ins</div>
                {selectedHealth.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {selectedHealth.map((h) => (
                      <div key={h.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontWeight: 900, color: UI.ink }}>
                          {h.timeHHMM}{" "}
                          <span style={{ color: "rgba(17,17,17,0.55)" }}>
                            {h.weightKg ? `• ${h.weightKg}kg` : ""}
                            {h.restingHr ? ` • HR ${h.restingHr}` : ""}
                          </span>
                        </div>
                        <div style={{ color: "rgba(17,17,17,0.55)", fontWeight: 850 }}>{h.notes ? h.notes : ""}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "rgba(17,17,17,0.55)", fontWeight: 850 }}>No health check-ins.</div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 12, color: "rgba(17,17,17,0.55)", fontWeight: 850, fontSize: 12, lineHeight: 1.4 }}>
          For general informational use only. Double-check calculations and follow professional medical guidance.
        </div>
      </div>
    </AppShell>
  );
}
