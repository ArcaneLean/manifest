// One week — stats, per-code table, the five workdays, and the way into
// booking. See ARCHITECTURE.md §7 ("Hours 2.0").
import { ChevronLeft, ChevronRight } from "lucide-react";
import { COLORS } from "../../theme/colors.js";
import { weekLabel, addWeeks, dayLabel, weekRangeLabel, isoWeekNumber } from "../../lib/hours2/week.js";
import { bookedByCode } from "../../lib/hours2/booking.js";
import { addInto } from "../../lib/hours2/bank.js";
import { Page, Header, Section, Row, Stats, Dot, primaryBtnStyle, secondaryBtnStyle, fmt, fmtSigned, signColor } from "./ui.jsx";
import { WeekBadge } from "./WeeksView.jsx";
import { weekInfo, bankBefore, sumValues, clockContext } from "./model.js";
import { codeLabel, codeColor, sortCodeIds } from "./codes.js";

const KIND_LABEL = { office: "office", home: "home", "office+home": "office+home", leave: "leave" };

function daySpan(d) {
  if (!d.day) return "";
  if (d.day.officeIn) return `${d.day.officeIn}–${d.day.officeOut || "…"}`;
  const segs = (d.day.segments || []).filter((s) => s.codeId);
  if (!segs.length) return "";
  return `${segs[0].start}–${segs[segs.length - 1].end || "…"}`;
}

export default function WeekView({ weekStart, store, now, go, replace }) {
  const ctx = clockContext(now);
  const info = weekInfo(weekStart, store, ctx);
  const { summary: s, booking, confirmed, earnedRes } = info;
  const { codes, projects } = store;
  const before = bankBefore(store, weekStart);
  const booked = confirmed ? bookedByCode(booking.lines) : {};
  const earned = earnedRes.earned || {};
  // The bank moves by the booking's stored earned snapshot, not today's
  // recomputation — a stale week shows the difference below instead.
  const bankAfter = confirmed ? addInto(addInto({ ...before }, booking.earned || {}), booked, -1) : null;
  const codeIds = sortCodeIds(new Set([...Object.keys(s.loggedByCode), ...Object.keys(booked), ...Object.keys(earned)]), codes, projects);
  const left = info.isCurrent ? s.bookable - sumValues(before) - s.paid : null;

  const nav = (n) => replace({ view: "week", weekStart: addWeeks(weekStart, n) });
  const chevron = { cursor: "pointer", padding: "4px" };

  const cell = { fontSize: "11.5px", textAlign: "right", whiteSpace: "nowrap" };
  const head = { ...cell, color: COLORS.dim, fontSize: "10.5px" };

  return (
    <Page>
      <Header
        title={`~/hours/wk${isoWeekNumber(weekStart)}`}
        sub={weekRangeLabel(weekStart)}
        right={
          <div style={{ display: "flex", gap: "4px" }}>
            <span onClick={() => nav(-1)} style={chevron} aria-label="previous week">
              <ChevronLeft size={18} color={COLORS.dim} />
            </span>
            <span onClick={() => nav(1)} style={chevron} aria-label="next week">
              <ChevronRight size={18} color={COLORS.dim} />
            </span>
          </div>
        }
      />

      <Section label={weekLabel(weekStart)} right={<WeekBadge info={info} />}>
        <Stats
          items={[
            { label: "bookable", value: fmt(s.bookable) },
            { label: "paid", value: fmt(s.paid), color: COLORS.amber },
            { label: "logged", value: fmt(s.logged) },
            { label: "diff", value: fmtSigned(s.diff), color: signColor(s.diff) },
          ]}
        />
        {left !== null && (
          <div style={{ fontSize: "11px", color: COLORS.dim, marginTop: "10px" }}>
            bank in {fmtSigned(sumValues(before))} ·{" "}
            {left > 0 ? `${fmt(left)} left to break even` : `break-even reached, ${fmtSigned(-left)} over`}
          </div>
        )}
      </Section>

      <Section label={`per code${confirmed ? "" : " · earned uses " + (info.gapMode.kind === "single" ? "single-code gap" : "proportional gap")}`}>
        {codeIds.length === 0 ? (
          <div style={{ fontSize: "12px", color: COLORS.dim }}>// nothing logged</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr>
                <th style={{ ...head, textAlign: "left", width: "38%" }}>code</th>
                <th style={head}>logged</th>
                <th style={head}>earned</th>
                <th style={head}>booked</th>
                <th style={head}>bank</th>
              </tr>
            </thead>
            <tbody>
              {codeIds.map((id) => (
                <tr key={id}>
                  <td style={{ fontSize: "11.5px", padding: "5px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <Dot color={codeColor(id, codes, projects)} size={6} /> {codeLabel(id, codes, projects)}
                  </td>
                  <td style={cell}>{fmt(s.loggedByCode[id] || 0)}</td>
                  <td style={cell}>{earnedRes.error ? "—" : fmt(earned[id] || 0)}</td>
                  <td style={cell}>{confirmed ? fmt(booked[id] || 0) : "—"}</td>
                  <td style={{ ...cell, color: bankAfter ? signColor(bankAfter[id] || 0) : COLORS.dim }}>{bankAfter ? fmtSigned(bankAfter[id] || 0) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {earnedRes.error && <div style={{ fontSize: "11px", color: COLORS.amber, marginTop: "8px" }}>{earnedRes.error}</div>}
        {info.stale && (
          <div style={{ fontSize: "11px", color: COLORS.amber, marginTop: "8px", lineHeight: 1.5 }}>
            earned was {fmt(sumValues(booking.earned || {}))} when booked, now {fmt(sumValues(earned))} — the bank still uses the booked numbers until you
            re-confirm.
          </div>
        )}
      </Section>

      <div>
        {s.days.map((d) => (
          <Row key={d.date} onClick={() => go({ view: "day", date: d.date })} style={{ opacity: d.isFuture && d.status === "empty" ? 0.5 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "13px", width: "56px", color: d.isToday ? COLORS.amber : COLORS.text }}>{dayLabel(d.date)}</span>
              <span style={{ fontSize: "11px", color: d.kind === "leave" ? COLORS.sage : COLORS.dim, width: "78px" }}>{KIND_LABEL[d.kind] || "—"}</span>
              <span style={{ fontSize: "11.5px", color: COLORS.dim, flex: 1 }}>{daySpan(d)}</span>
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: d.paid ? COLORS.text : COLORS.dim }}>{d.leave ? "" : fmt(d.paid)}</span>
            </div>
            {d.status === "incomplete" && <div style={{ fontSize: "11px", color: COLORS.amber, marginTop: "4px", marginLeft: "66px" }}>not clocked out / left</div>}
            {d.status === "open" && <div style={{ fontSize: "11px", color: COLORS.dim, marginTop: "4px", marginLeft: "66px" }}>running</div>}
          </Row>
        ))}
      </div>

      <div style={{ padding: "18px 20px" }}>
        <button onClick={() => go({ view: "booking", weekStart })} style={confirmed ? secondaryBtnStyle : primaryBtnStyle}>
          {confirmed ? (info.stale ? "review booking (changed) →" : "view booking →") : "book week →"}
        </button>
      </div>
    </Page>
  );
}
