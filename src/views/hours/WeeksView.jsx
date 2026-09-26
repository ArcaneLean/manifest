// Hours root — bank, today's quick actions, one row per week. See
// ARCHITECTURE.md §7 ("Hours 2.0").
import { COLORS } from "../../theme/colors.js";
import { weekLabel, isWeekend } from "../../lib/hours2/week.js";
import { Page, Header, Section, Row, Badge } from "./ui.jsx";
import { TodayPanel } from "./TodayPanel.jsx";
import { fmt, fmtSigned, signColor, linkStyle } from "./ui.jsx";
import { weekInfo, weeksToShow, bankNow, bankBefore, sumValues, clockContext } from "./model.js";

export const STATUS_BADGE = {
  booked: { label: "booked", color: COLORS.sage },
  changed: { label: "changed since booked", color: COLORS.amber },
  unbooked: { label: "unbooked", color: COLORS.amber },
  current: { label: "this week", color: COLORS.dim },
  future: { label: "upcoming", color: COLORS.dim },
};

export function WeekBadge({ info }) {
  if (!info.inBank) return <Badge>before bank start</Badge>;
  const b = STATUS_BADGE[info.status];
  return <Badge color={b.color}>{b.label}</Badge>;
}

export default function WeeksView({ store, now, go }) {
  const ctx = clockContext(now);
  const bank = bankNow(store);
  const bankTotal = sumValues(bank);
  const weeks = weeksToShow(store, ctx).map((w) => weekInfo(w, store, ctx));
  const loading = store.loading;
  const dateStr = now.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }).toLowerCase();
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <Page>
      <Header title="~/hours" sub={`${dateStr} · ${timeStr}`} />

      <Section
        label="bank"
        right={
          <span onClick={() => go({ view: "bank" })} style={linkStyle}>
            {store.settings.opening ? "per code →" : "set opening balance →"}
          </span>
        }
      >
        <div
          onClick={() => go({ view: "bank" })}
          style={{
            fontSize: "28px",
            fontWeight: 600,
            color: signColor(bankTotal),
            textShadow: `0 0 8px ${bankTotal >= 0 ? COLORS.sage : COLORS.amberDim}`,
            cursor: "pointer",
          }}
        >
          {loading ? "—" : fmtSigned(bankTotal)}
        </div>
      </Section>

      {!isWeekend(ctx.todayISO) && (
        <TodayPanel date={ctx.todayISO} day={store.worklog[ctx.todayISO]} now={now} store={store} onOpenDay={() => go({ view: "day", date: ctx.todayISO })} />
      )}

      <div>
        {weeks.map((info) => {
          const { summary: s } = info;
          const left = info.isCurrent ? s.bookable - sumValues(bankBefore(store, info.weekStart)) - s.paid : null;
          return (
            <Row key={info.weekStart} onClick={() => go({ view: "week", weekStart: info.weekStart })} style={{ opacity: info.inBank ? 1 : 0.55 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "13px", color: COLORS.text }}>{weekLabel(info.weekStart)}</span>
                <WeekBadge info={info} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: COLORS.dim }}>
                <span>
                  bookable {fmt(s.bookable)} · paid <span style={{ color: COLORS.text }}>{fmt(s.paid)}</span>
                </span>
                <span style={{ color: signColor(s.diff), fontWeight: 600 }}>{fmtSigned(s.diff)}</span>
              </div>
              {left !== null && (
                <div style={{ fontSize: "11px", color: COLORS.dim, marginTop: "4px" }}>
                  {left > 0 ? `${fmt(left)} left to break even (incl. bank)` : `break-even reached (${fmtSigned(-left)} over, incl. bank)`}
                </div>
              )}
              {s.incomplete.length > 0 && (
                <div style={{ fontSize: "11px", color: COLORS.amber, marginTop: "4px" }}>{s.incomplete.length} day(s) not clocked out</div>
              )}
            </Row>
          );
        })}
      </div>
    </Page>
  );
}
