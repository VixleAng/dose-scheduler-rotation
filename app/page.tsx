"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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

type Routine = {
  id: string;
  name: string;
  reconstitutedOn?: string;
};

type ViewMode = "today" | "week" | "month";
type FilterMode = "all" | "doses" | "injections" | "health";

const STORAGE_KEYS = {
  routines: "ds_routines_v4",
  doseLogs: "ds_logs",
  injectionLogs: "rt_logs_v1",
  healthLogs: "hb_logs_v1",
};

const ROUTINE_COLORS = ["#2563eb", "#16a34a", "#ea580c", "#7c3aed", "#dc2626", "#0891b2", "#ca8a04"];

/** Warm “health app” palette */
const UI = {
  bg: "#fbfaf8",
  card: "#ffffff",
  line: "rgba(17,17,17,0.10)",
  muted: "#4b5563", // ✅ darker for mobile readability
  ink: "#111",
  accent: "#ff6a3d",
  accentSoft: "rgba(255,106,61,0.14)",
  shadow: "0 16px 40px rgba(0,0,0,0.08)",
};

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

function isSameYMD(a: string, b: string) {
  return a === b;
}

function parseHealthTimeToComparable(timeHHMM: string) {
  const [h, m] = timeHHMM.split(":").map((x) => parseInt(x, 10));
  return (isNaN(h) ? 0 : h) * 100 + (isNaN(m) ? 0 : m);
}

/**
 * ✅ NAV BUTTON (mobile compact)
 * - avoids hydration mismatch by waiting until mounted
 * - hides current page button
 */
function NavButton({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const active = mounted && pathname === href;
  if (active) return null;

  return (
    <Link href={href} className="navBtn">
      {label} <span className="arrow">→</span>
    </Link>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
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
      <div style={{ fontWeight: 900, marginBottom: 10, color: UI.ink }}>{title}</div>
      {children}
    </div>
  );
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="btnPrimary"
      style={{
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

function SoftLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="btnSoft"
      style={{
        textDecoration: "none",
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

  const todayYMD = useMemo(() => toYMD(new Date()), []);

  const routineColorById = useMemo(() => {
    const map: Record<string, string> = {};
    (routines ?? []).forEach((r, idx) => {
      map[r.id] = ROUTINE_COLORS[idx % ROUTINE_COLORS.length];
    });
    return map;
  }, [routines]);

  useEffect(() => {
    const sr = localStorage.getItem(STORAGE_KEYS.routines);
    const sd = localStorage.getItem(STORAGE_KEYS.doseLogs);
    const si = localStorage.getItem(STORAGE_KEYS.injectionLogs);
    const sh = localStorage.getItem(STORAGE_KEYS.healthLogs);

    if (sr) setRoutines(JSON.parse(sr));
    if (sd) setDoseLogs(JSON.parse(sd));
    if (si) setInjLogs(JSON.parse(si));
    if (sh) setHealthLogs(JSON.parse(sh));
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

  const latestHealth = useMemo(() => healthLogs[0] ?? null, [healthLogs]);
  const todayHealth = useMemo(() => (healthByDay[todayYMD] ?? [])[0] ?? null, [healthByDay, todayYMD]);

  const selectedDoses = selectedDayYMD ? dosesByDay[selectedDayYMD] ?? [] : [];
  const selectedInj = selectedDayYMD ? injectionsByDay[selectedDayYMD] ?? [] : [];
  const selectedHealth = selectedDayYMD ? healthByDay[selectedDayYMD] ?? [] : [];

  const monthGrid = useMemo(() => {
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

  const weekDays = useMemo(() => {
    const start = startOfWeek(weekAnchor);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = addDays(start, i);
      return { date: d, ymd: toYMD(d) };
    });
  }, [weekAnchor]);

  const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const todayTimeline = useMemo(() => {
    const doses = (dosesByDay[todayYMD] ?? []).map((x) => ({
      kind: "dose" as const,
      timeISO: x.doseDateTime,
      title: `${x.amountMg}mg`,
      routineId: x.routineId,
      routineName: x.routineName,
      subtitle: `${timeLabel(x.doseDateTime)} • ${x.frequency}`,
    }));

    const injs = (injectionsByDay[todayYMD] ?? []).map((x) => ({
      kind: "inj" as const,
      timeISO: x.injectedAtISO,
      title: x.zoneLabel,
      routineId: x.routineId,
      routineName: x.routineName,
      subtitle: `${timeLabel(x.injectedAtISO)} • ${x.view}${x.doseMg ? ` • ${x.doseMg}mg` : ""}`,
    }));

    const health = (healthByDay[todayYMD] ?? []).map((h) => ({
      kind: "health" as const,
      timeISO: new Date(`${todayYMD}T${h.timeHHMM}`).toISOString(),
      title: "Health check-in",
      routineId: "health",
      routineName: "Health",
      subtitle: `${h.timeHHMM}${h.weightKg ? ` • ${h.weightKg}kg` : ""}${
        h.bpSys && h.bpDia ? ` • ${h.bpSys}/${h.bpDia}` : ""
      }${h.exerciseType ? ` • ${h.exerciseType}` : ""}`,
    }));

    const all = [...doses, ...injs, ...health].sort(
      (a, b) => new Date(a.timeISO).getTime() - new Date(b.timeISO).getTime()
    );

    const filtered =
      filter === "all"
        ? all
        : filter === "doses"
        ? all.filter((x) => x.kind === "dose")
        : filter === "injections"
        ? all.filter((x) => x.kind === "inj")
        : all.filter((x) => x.kind === "health");

    return filtered;
  }, [dosesByDay, injectionsByDay, healthByDay, todayYMD, filter]);

  function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
    return (
      <button onClick={onClick} className={`chip ${active ? "chipActive" : ""}`}>
        {children}
      </button>
    );
  }

  function SmallChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
    return (
      <button onClick={onClick} className={`chip chipSmall ${active ? "chipSmallActive" : ""}`}>
        {children}
      </button>
    );
  }

  function dayTotal(ymd: string) {
    const d = dosesByDay[ymd]?.length ?? 0;
    const i = injectionsByDay[ymd]?.length ?? 0;
    const h = healthByDay[ymd]?.length ?? 0;
    if (filter === "doses") return d;
    if (filter === "injections") return i;
    if (filter === "health") return h;
    return d + i + h;
  }

  function DayCardMini({ ymd, dayNumLabel }: { ymd: string; dayNumLabel: string }) {
    const doses = dosesByDay[ymd] ?? [];
    const injs = injectionsByDay[ymd] ?? [];
    const health = healthByDay[ymd] ?? [];

    const showD = filter === "all" || filter === "doses";
    const showI = filter === "all" || filter === "injections";
    const showH = filter === "all" || filter === "health";

    const total = dayTotal(ymd);
    const isToday = isSameYMD(ymd, todayYMD);
    const firstHealth = health[0];

    return (
      <button onClick={() => setSelectedDayYMD(ymd)} className={`dayCard ${isToday ? "dayCardToday" : ""}`} title="Tap to view day">
        <div className="dayCardTop">
          <div style={{ fontWeight: 900, color: UI.ink }}>{dayNumLabel}</div>
          {total > 0 && <div className="dayCardCount">{total}</div>}
        </div>

        {showH && health.length > 0 && (
          <div className="miniRow miniRowHealth" title="Health entry">
            <span style={{ fontWeight: 900, color: UI.ink }}>Health</span>
            <span className="miniMuted">{firstHealth?.timeHHMM}</span>
            <span className="miniMuted">
              {firstHealth?.weightKg ? `⚖️ ${firstHealth.weightKg}kg` : firstHealth?.exerciseType ? `🏃 ${firstHealth.exerciseType}` : "✅ Logged"}
            </span>
          </div>
        )}

        {showD &&
          doses.slice(0, 2).map((x) => {
            const color = routineColorById[x.routineId] ?? UI.ink;
            return (
              <div key={x.id} className="miniRow" title={`${x.routineName} • ${x.amountMg}mg`}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
                <span style={{ fontWeight: 900, color: UI.ink }}>Dose</span>
                <span className="miniMuted">{x.routineName}</span>
                <span style={{ color: UI.ink }}>• {x.amountMg}mg</span>
              </div>
            );
          })}

        {showI &&
          injs.slice(0, 1).map((x) => {
            const color = routineColorById[x.routineId] ?? UI.ink;
            return (
              <div key={x.id} className="miniRow" title={`${x.routineName} • ${x.zoneLabel}`}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />
                <span style={{ fontWeight: 900, color: UI.ink }}>Inj</span>
                <span className="miniMuted">{x.routineName}</span>
                <span style={{ color: UI.ink }}>• {x.zoneLabel}</span>
              </div>
            );
          })}

        {total > 3 && <div className="miniMuted" style={{ fontSize: 12 }}>+ more</div>}
      </button>
    );
  }

  function TodayHealthCard() {
    const show = todayHealth || latestHealth;

    if (!show) {
      return (
        <SectionCard title="Today Health">
          <div style={{ marginTop: 4, color: UI.muted }}>No health entry yet. Add a quick check-in.</div>
          <div style={{ marginTop: 12 }}>
            <PrimaryLink href="/health">Go to Health Board →</PrimaryLink>
          </div>
        </SectionCard>
      );
    }

    const h = todayHealth ?? latestHealth!;
    const label = todayHealth ? "Today Health" : "Latest Health";

    return (
      <div style={{ border: `1px solid ${UI.line}`, borderRadius: 18, padding: 14, background: "#fff7f3", boxShadow: UI.shadow }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontWeight: 900, color: UI.ink }}>{label}</div>
          <SoftLink href="/health">Open →</SoftLink>
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", color: UI.ink }}>
          <div style={{ fontWeight: 900 }}>
            {h.ymd} • {h.timeHHMM}
          </div>
          {h.weightKg ? (
            <div>
              ⚖️ <b>{h.weightKg}kg</b>
            </div>
          ) : null}
          {h.bpSys && h.bpDia ? (
            <div>
              🩺 <b>{h.bpSys}/{h.bpDia}</b>
            </div>
          ) : null}
          {h.restingHr ? (
            <div>
              ❤️ <b>{h.restingHr} bpm</b>
            </div>
          ) : null}
          {h.exerciseType ? (
            <div>
              🏃 <b>{h.exerciseType}</b>
              {h.exerciseMins ? ` • ${h.exerciseMins} min` : ""}
              {h.exerciseIntensity ? ` • ${h.exerciseIntensity}` : ""}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <main style={{ padding: 18, maxWidth: 1100, margin: "0 auto", background: UI.bg, minHeight: "100vh" }}>
      <style jsx global>{`
        /* ---- Mobile polish ---- */
        :root {
          --dayMinH: 122px;
        }

        @media (max-width: 860px) {
          :root {
            --dayMinH: 104px;
          }
        }

        @media (max-width: 520px) {
          :root {
            --dayMinH: 86px;
          }
        }

        .navWrap {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .navBtn {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid ${UI.line};
          background: ${UI.card};
          color: ${UI.ink};
          font-weight: 900;
          text-decoration: none;
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.06);
          display: inline-flex;
          gap: 8px;
          align-items: center;
          white-space: nowrap;
        }

        .btnPrimary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid ${UI.accent};
          background: ${UI.accent};
          color: #fff;
          font-weight: 900;
        }

        .btnSoft {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 9px 10px;
          border-radius: 12px;
          border: 1px solid ${UI.line};
          background: #fff;
          color: ${UI.ink};
          font-weight: 900;
        }

        .chip {
          padding: 10px 12px;
          border-radius: 999px;
          border: 1px solid ${UI.line};
          background: #fff;
          color: ${UI.ink};
          font-weight: 900;
          cursor: pointer;
        }
        .chipActive {
          border-color: ${UI.ink};
          background: ${UI.ink};
          color: #fff;
        }

        .chipSmall {
          padding: 8px 10px;
          font-size: 12px;
          background: #fff;
        }
        .chipSmallActive {
          background: ${UI.accentSoft};
          border-color: ${UI.ink};
          color: ${UI.ink};
        }

        .topGrid {
          margin-top: 14px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        /* ✅ mobile: top cards stack */
        @media (max-width: 820px) {
          .topGrid {
            grid-template-columns: 1fr;
          }
        }

        /* ✅ mobile: nav becomes 2-column compact buttons */
        @media (max-width: 520px) {
          h1 {
            font-size: 24px !important;
          }
          .navWrap {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            width: 100%;
          }
          .navBtn {
            justify-content: center;
            padding: 10px 10px;
            border-radius: 14px;
          }
          .arrow {
            display: none;
          }
        }

        .quickGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 10px;
        }
        @media (max-width: 520px) {
          .quickGrid {
            grid-template-columns: 1fr 1fr;
          }
        }

        .dayCard {
          border-radius: 16px;
          border: 1px solid ${UI.line};
          background: #fff;
          cursor: pointer;
          text-align: left;
          padding: 10px;
          min-height: var(--dayMinH);
          display: flex;
          flex-direction: column;
          gap: 6px;
          overflow: hidden;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.05);
        }
        .dayCardToday {
          border: 2px solid ${UI.ink};
        }
        .dayCardTop {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }
        .dayCardCount {
          font-size: 12px;
          color: ${UI.muted};
          font-weight: 900;
        }

        .miniRow {
          font-size: 12px;
          border: 1px solid ${UI.line};
          border-radius: 12px;
          padding: 6px 8px;
          display: flex;
          gap: 8px;
          align-items: center;
          background: #fafafa;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .miniRowHealth {
          background: #fff7f3;
        }
        .miniMuted {
          color: ${UI.muted};
          font-weight: 800;
        }

        .controlBar {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
        }

        @media (max-width: 520px) {
          .controlBar {
            flex-direction: column;
            align-items: stretch;
          }
          .controlRow {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }
          .jumpBtn {
            width: 100%;
          }
        }

        .calNav {
          display: flex;
          gap: 10px;
        }
        @media (max-width: 520px) {
          .calNav {
            width: 100%;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 8px;
          }
          .calNav button {
            padding: 10px 8px !important;
            border-radius: 14px !important;
          }
        }

        /* prevent horizontal scroll */
        body {
          overflow-x: hidden;
        }
      `}</style>

      {/* Shared header/nav */}
      <div
        style={{
          border: `1px solid ${UI.line}`,
          borderRadius: 18,
          padding: 14,
          background: "linear-gradient(180deg, #fff 0%, #fff7f3 100%)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: UI.ink }}>Dashboard</h1>
            <div style={{ color: UI.muted, marginTop: 6, fontWeight: 600 }}>
              Doses, injections, and health check-ins — one overview.
            </div>
          </div>

          <div className="navWrap">
            <NavButton href="/" label="Dashboard" />
            <NavButton href="/scheduler" label="Scheduler" />
            <NavButton href="/rotation" label="Rotation" />
            <NavButton href="/health" label="Health" />
          </div>
        </div>
      </div>

      {/* Top cards */}
      <section className="topGrid">
        <TodayHealthCard />

        <SectionCard title="Quick actions">
          <div className="quickGrid">
            <SoftLink href="/scheduler">+ Log dose</SoftLink>
            <SoftLink href="/rotation">+ Log injection</SoftLink>
            <SoftLink href="/health">+ Health check-in</SoftLink>
          </div>

          <div style={{ marginTop: 10, color: UI.muted, fontSize: 12, fontWeight: 700 }}>
            Tip: Use <b>Today</b> view for a timeline, and <b>Week</b> for planning.
          </div>
        </SectionCard>
      </section>

      {/* Controls */}
      <section style={{ marginTop: 14, border: `1px solid ${UI.line}`, borderRadius: 16, padding: 12, background: "#fff", boxShadow: UI.shadow }}>
        <div className="controlBar">
          <div className="controlRow">
            <Chip active={view === "today"} onClick={() => setView("today")}>
              Today
            </Chip>
            <Chip active={view === "week"} onClick={() => setView("week")}>
              Week
            </Chip>
            <Chip active={view === "month"} onClick={() => setView("month")}>
              Month
            </Chip>
          </div>

          <div className="controlRow">
            <SmallChip active={filter === "all"} onClick={() => setFilter("all")}>
              All
            </SmallChip>
            <SmallChip active={filter === "doses"} onClick={() => setFilter("doses")}>
              Doses
            </SmallChip>
            <SmallChip active={filter === "injections"} onClick={() => setFilter("injections")}>
              Injections
            </SmallChip>
            <SmallChip active={filter === "health"} onClick={() => setFilter("health")}>
              Health
            </SmallChip>

            <button
              className="jumpBtn"
              onClick={() => {
                setCalendarMonth(new Date());
                setWeekAnchor(new Date());
              }}
              style={{
                padding: "8px 10px",
                borderRadius: 999,
                border: `1px solid ${UI.line}`,
                background: "#fff",
                cursor: "pointer",
                fontWeight: 900,
                fontSize: 12,
                color: UI.ink,
              }}
            >
              Jump to today
            </button>
          </div>
        </div>

        {/* TODAY VIEW */}
        {view === "today" && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 16, color: UI.ink }}>Today ({todayYMD})</div>
              <button
                onClick={() => setSelectedDayYMD(todayYMD)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: `1px solid ${UI.line}`,
                  background: "#fff",
                  cursor: "pointer",
                  fontWeight: 900,
                  color: UI.ink,
                }}
              >
                Open day details →
              </button>
            </div>

            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              {todayTimeline.length === 0 ? (
                <div style={{ color: UI.muted, fontWeight: 700 }}>Nothing logged for today yet.</div>
              ) : (
                todayTimeline.map((item, idx) => {
                  const kindLabel = item.kind === "dose" ? "Dose" : item.kind === "inj" ? "Inj" : "Health";
                  const badgeBg = item.kind === "health" ? "#fff7f3" : item.kind === "dose" ? "#fafafa" : "#fff";
                  const dotColor = item.kind === "health" ? UI.accent : routineColorById[item.routineId] ?? UI.ink;

                  return (
                    <div
                      key={idx}
                      style={{
                        border: `1px solid ${UI.line}`,
                        borderRadius: 16,
                        padding: 12,
                        background: badgeBg,
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ width: 10, height: 10, borderRadius: 999, background: dotColor }} />
                        <span style={{ fontWeight: 900, color: UI.ink }}>{kindLabel}</span>
                        <span style={{ color: UI.muted, fontWeight: 900 }}>{item.routineName}</span>
                        <span style={{ fontWeight: 900, color: UI.ink }}>{item.title}</span>
                        <span style={{ color: UI.muted, fontSize: 12, fontWeight: 700 }}>{item.subtitle}</span>
                      </div>

                      <button
                        onClick={() => setSelectedDayYMD(todayYMD)}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 12,
                          border: `1px solid ${UI.line}`,
                          background: "#fff",
                          cursor: "pointer",
                          fontWeight: 900,
                          color: UI.ink,
                        }}
                      >
                        View day
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* WEEK VIEW */}
        {view === "week" && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 16, color: UI.ink }}>Week of {toYMD(startOfWeek(weekAnchor))}</div>

              <div className="calNav">
                <button
                  onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}
                  style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${UI.line}`, background: "#fff", cursor: "pointer", fontWeight: 900, color: UI.ink }}
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setWeekAnchor(new Date())}
                  style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${UI.line}`, background: "#fff", cursor: "pointer", fontWeight: 900, color: UI.ink }}
                >
                  This week
                </button>
                <button
                  onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}
                  style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${UI.line}`, background: "#fff", cursor: "pointer", fontWeight: 900, color: UI.ink }}
                >
                  Next →
                </button>
              </div>
            </div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
              {weekDayLabels.map((w) => (
                <div key={w} style={{ fontWeight: 900, color: UI.muted, fontSize: 12 }}>
                  {w}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
              {weekDays.map((d) => (
                <DayCardMini key={d.ymd} ymd={d.ymd} dayNumLabel={`${d.date.getDate()}`} />
              ))}
            </div>
          </div>
        )}

        {/* MONTH VIEW */}
        {view === "month" && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 16, color: UI.ink }}>{monthLabel(calendarMonth)}</div>

              <div className="calNav">
                <button
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                  style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${UI.line}`, background: "#fff", cursor: "pointer", fontWeight: 900, color: UI.ink }}
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setCalendarMonth(new Date())}
                  style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${UI.line}`, background: "#fff", cursor: "pointer", fontWeight: 900, color: UI.ink }}
                >
                  This month
                </button>
                <button
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                  style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${UI.line}`, background: "#fff", cursor: "pointer", fontWeight: 900, color: UI.ink }}
                >
                  Next →
                </button>
              </div>
            </div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
              {weekDayLabels.map((w) => (
                <div key={w} style={{ fontWeight: 900, color: UI.muted, fontSize: 12 }}>
                  {w}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
              {monthGrid.map((c, idx) => {
                if (!c.ymd) {
                  return <div key={idx} style={{ minHeight: "var(--dayMinH)", borderRadius: 16, border: `1px solid ${UI.line}`, background: "#fafafa" }} />;
                }
                return <DayCardMini key={c.ymd} ymd={c.ymd} dayNumLabel={`${c.dayNum}`} />;
              })}
            </div>
          </div>
        )}
      </section>

      {/* Day details sheet */}
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
              background: "#fff",
              width: "min(900px, 100%)",
              borderRadius: 18,
              border: `1px solid ${UI.line}`,
              boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
              overflow: "hidden",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ width: 44, height: 5, borderRadius: 999, background: "#e5e5e5", margin: "10px auto 0" }} />

            <div style={{ padding: 14, borderBottom: `1px solid ${UI.line}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: UI.ink }}>Day details</div>
                <div style={{ color: UI.muted, fontSize: 13, fontWeight: 700 }}>{selectedDayYMD}</div>
              </div>

              <button onClick={() => setSelectedDayYMD(null)} style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${UI.line}`, background: "#fff", cursor: "pointer", fontWeight: 900, color: UI.ink }}>
                Close
              </button>
            </div>

            <div style={{ padding: 14, overflowY: "auto" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <PrimaryLink href="/scheduler">Add / edit doses →</PrimaryLink>
                <SoftLink href="/rotation">Add / edit injections →</SoftLink>
                <SoftLink href="/health">Add / edit health →</SoftLink>
              </div>

              {(filter === "all" || filter === "health") && (
                <>
                  <div style={{ marginTop: 14, fontWeight: 900, fontSize: 16, color: UI.ink }}>Health</div>
                  {selectedHealth.length === 0 ? (
                    <div style={{ color: UI.muted, marginTop: 6, fontWeight: 700 }}>No health entries for this day.</div>
                  ) : (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                      {selectedHealth.map((h) => (
                        <div key={h.id} style={{ border: `1px solid ${UI.line}`, borderRadius: 16, padding: 12, background: "#fff7f3" }}>
                          <div style={{ fontWeight: 900, color: UI.ink }}>{h.timeHHMM}</div>
                          <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap", color: UI.ink }}>
                            {h.weightKg ? (
                              <div>
                                ⚖️ <b>{h.weightKg}kg</b>
                              </div>
                            ) : null}
                            {h.bpSys && h.bpDia ? (
                              <div>
                                🩺 <b>{h.bpSys}/{h.bpDia}</b>
                              </div>
                            ) : null}
                            {h.restingHr ? (
                              <div>
                                ❤️ <b>{h.restingHr} bpm</b>
                              </div>
                            ) : null}
                            {h.exerciseType ? (
                              <div>
                                🏃 <b>{h.exerciseType}</b>
                                {h.exerciseMins ? ` • ${h.exerciseMins} min` : ""}
                                {h.exerciseIntensity ? ` • ${h.exerciseIntensity}` : ""}
                              </div>
                            ) : null}
                          </div>
                          {h.notes ? <div style={{ marginTop: 8, color: "#444" }}>{h.notes}</div> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {(filter === "all" || filter === "doses") && (
                <>
                  <div style={{ marginTop: 16, fontWeight: 900, fontSize: 16, color: UI.ink }}>Doses</div>
                  {selectedDoses.length === 0 ? (
                    <div style={{ color: UI.muted, marginTop: 6, fontWeight: 700 }}>No doses for this day.</div>
                  ) : (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                      {selectedDoses.map((x) => {
                        const color = routineColorById[x.routineId] ?? UI.ink;
                        return (
                          <div key={x.id} style={{ border: `1px solid ${UI.line}`, borderRadius: 16, padding: 12, background: "#fafafa" }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                              <span style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
                              <div style={{ fontWeight: 900, color: UI.ink }}>
                                {x.routineName} • {x.amountMg}mg
                              </div>
                            </div>
                            <div style={{ color: UI.muted, fontSize: 12, marginTop: 4, fontWeight: 700 }}>
                              {timeLabel(x.doseDateTime)} • {x.frequency}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {(filter === "all" || filter === "injections") && (
                <>
                  <div style={{ marginTop: 16, fontWeight: 900, fontSize: 16, color: UI.ink }}>Injections</div>
                  {selectedInj.length === 0 ? (
                    <div style={{ color: UI.muted, marginTop: 6, fontWeight: 700 }}>No injections for this day.</div>
                  ) : (
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
                      {selectedInj.map((x) => {
                        const color = routineColorById[x.routineId] ?? UI.ink;
                        return (
                          <div key={x.id} style={{ border: `1px solid ${UI.line}`, borderRadius: 16, padding: 12, background: "#fff" }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                              <span style={{ width: 10, height: 10, borderRadius: 999, background: color }} />
                              <div style={{ fontWeight: 900, color: UI.ink }}>
                                {x.routineName} • {x.zoneLabel}
                                {x.doseMg ? <span style={{ color: UI.muted, fontWeight: 800 }}> • {x.doseMg}mg</span> : null}
                              </div>
                            </div>
                            <div style={{ color: UI.muted, fontSize: 12, marginTop: 4, fontWeight: 700 }}>
                              {timeLabel(x.injectedAtISO)} • {x.view}
                            </div>
                            {x.notes ? <div style={{ marginTop: 8, color: "#444", fontSize: 12 }}>{x.notes}</div> : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
