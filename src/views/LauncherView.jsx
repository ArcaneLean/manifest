import { CalendarCheck2, ListChecks, Hourglass, Clock, Flame, ChevronRight } from "lucide-react";
import { COLORS } from "../theme/colors.js";
import { useClock } from "../hooks/useClock.js";

const APPS = [
  { key: "today", label: "today", path: "~/today", icon: CalendarCheck2, desc: "day plan · time left" },
  {
    key: "taskmanager",
    label: "task manager",
    path: "~/tasks",
    icon: ListChecks,
    desc: "tasks · matrix · calendar · templates · tags",
  },
  { key: "countdowns", label: "countdowns", path: "~/countdowns", icon: Hourglass, desc: "days until" },
  { key: "hours", label: "hours", path: "~/hours", icon: Clock, desc: "work log" },
  { key: "habits", label: "habits", path: "~/habits", icon: Flame, desc: "streaks · frequency" },
];

export default function LauncherView({ onOpen }) {
  const now = useClock();
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toLowerCase();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.012) 0px, rgba(255,255,255,0.012) 1px, transparent 1px, transparent 2px)",
        fontFamily: "'IBM Plex Mono', monospace",
        color: COLORS.text,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: "420px", padding: "0 0 40px 0" }}>
        <div style={{ padding: "28px 20px 16px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ fontSize: "11px", color: COLORS.dim, letterSpacing: "1px", marginBottom: "6px" }}>
            {dateStr} · {timeStr}
          </div>
          <div style={{ fontSize: "20px", fontWeight: 600, color: COLORS.amber, letterSpacing: "0.5px" }}>
            ~/manifest
          </div>
        </div>

        <div style={{ padding: "20px" }}>
          {APPS.map(({ key, label, path, icon: Icon, desc }) => (
            <button
              key={key}
              onClick={() => onOpen(key)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                background: COLORS.panel,
                border: `1px solid ${COLORS.border}`,
                borderRadius: "8px",
                padding: "16px",
                marginBottom: "12px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Icon size={22} color={COLORS.amber} strokeWidth={1.75} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "15px", color: COLORS.text, fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: "11.5px", color: COLORS.dim, marginTop: "2px" }}>
                  {path} · {desc}
                </div>
              </div>
              <ChevronRight size={16} color={COLORS.dim} strokeWidth={2} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
