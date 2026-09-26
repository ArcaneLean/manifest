// One day — office visit, lunch/leave toggles, stats, and the segment list
// editor. See ARCHITECTURE.md §7 ("Hours 2.0").
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { COLORS } from "../../theme/colors.js";
import { parseISODate } from "../../lib/dateUtils.js";
import { dayLabel, weekStartOf, addDaysISO, isWeekend } from "../../lib/hours2/week.js";
import { paidMinutes, loggedByCode, sumValues, hasOfficeLunch, isLeave } from "../../lib/hours2/day.js";
import { isConfirmed } from "../../lib/hours2/bank.js";
import { ConfirmDialog } from "../../components/ConfirmDialog.jsx";
import { Page, Header, Section, Stats, PickChip, BracketCheck, Dot, timeInputStyle, primaryBtnStyle, secondaryBtnStyle, linkStyle, fmt, fmtSigned, signColor } from "./ui.jsx";
import { TodayPanel } from "./TodayPanel.jsx";
import { codeLabel, codeColor, pickableCodes, sortCodeIds } from "./codes.js";
import { clockContext } from "./model.js";

function SegmentRow({ seg, store, onChange, onRemove }) {
  const { codes, projects } = store;
  const options = pickableCodes(codes, projects);
  const known = !seg.codeId || options.some((c) => c.id === seg.codeId);
  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "8px" }}>
      <Dot color={seg.codeId ? codeColor(seg.codeId, codes, projects) : COLORS.dim} />
      <select
        value={seg.codeId || ""}
        onChange={(e) => onChange({ ...seg, codeId: e.target.value || null })}
        style={{ ...timeInputStyle, flex: 1, padding: "6px 4px", minWidth: 0 }}
      >
        <option value="">break</option>
        {!known && <option value={seg.codeId}>{codeLabel(seg.codeId, codes, projects)} (archived)</option>}
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {codeLabel(c.id, codes, projects)}
          </option>
        ))}
      </select>
      <input type="time" value={seg.start} onChange={(e) => onChange({ ...seg, start: e.target.value })} style={{ ...timeInputStyle, width: "88px", padding: "6px 4px" }} />
      <span style={{ color: COLORS.dim, fontSize: "11px" }}>–</span>
      <input type="time" value={seg.end || ""} onChange={(e) => onChange({ ...seg, end: e.target.value || null })} style={{ ...timeInputStyle, width: "88px", padding: "6px 4px" }} />
      <span onClick={onRemove} style={{ cursor: "pointer", flexShrink: 0 }} aria-label="remove segment">
        <X size={14} color={COLORS.dim} />
      </span>
    </div>
  );
}

export default function DayView({ date, store, now, go, replace }) {
  const { worklog, codes, projects, settings, updateDay, clearDay, bookings } = store;
  const ctx = clockContext(now);
  const isToday = date === ctx.todayISO;
  const day = worklog[date] || { date, segments: [] };
  const nowMin = isToday ? ctx.nowMin : undefined;

  const [draft, setDraft] = useState(null); // segments being edited, or null
  const [confirmClear, setConfirmClear] = useState(false);
  useEffect(() => setDraft(null), [date]);

  const segments = draft || day.segments || [];
  const preview = { ...day, segments };
  const paid = paidMinutes(preview, { lunchMin: settings.lunchMin, nowMin });
  const byCode = loggedByCode(preview, nowMin);
  const logged = sumValues(byCode);
  const booked = isConfirmed(bookings[weekStartOf(date)]);

  const patch = (p) => updateDay(date, (d) => ({ ...d, ...p }));

  const nav = (n) => {
    let next = addDaysISO(date, n);
    while (isWeekend(next)) next = addDaysISO(next, n);
    replace({ view: "day", date: next });
  };

  const startEdit = () => setDraft((day.segments || []).map((s) => ({ ...s })));
  const editRow = (i, next) => setDraft((prev) => prev.map((s, idx) => (idx === i ? next : s)));
  const removeRow = (i) => setDraft((prev) => prev.filter((_, idx) => idx !== i));
  const addRow = () =>
    setDraft((prev) => {
      const base = prev || [];
      const last = base[base.length - 1];
      const start = last?.end || last?.start || day.officeIn || "09:00";
      return [...base, { start, end: null, codeId: last?.codeId ?? pickableCodes(codes, projects)[0]?.id ?? null }];
    });
  const saveEdit = () => {
    const cleaned = draft.filter((s) => s.start).sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
    updateDay(date, (d) => ({ ...d, segments: cleaned }));
    setDraft(null);
  };

  const full = parseISODate(date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }).toLowerCase();
  const chevron = { cursor: "pointer", padding: "4px" };

  return (
    <Page>
      <Header
        title={`~/hours/${dayLabel(date).replace(" ", "")}`}
        sub={full}
        right={
          <div style={{ display: "flex", gap: "4px" }}>
            <span onClick={() => nav(-1)} style={chevron} aria-label="previous day">
              <ChevronLeft size={18} color={COLORS.dim} />
            </span>
            <span onClick={() => nav(1)} style={chevron} aria-label="next day">
              <ChevronRight size={18} color={COLORS.dim} />
            </span>
          </div>
        }
      />

      {booked && (
        <div style={{ padding: "10px 20px", fontSize: "11.5px", color: COLORS.amber, borderBottom: `1px solid ${COLORS.border}` }}>
          this week is booked — changing hours here flags it for re-confirming
        </div>
      )}

      {isToday && !isLeave(day) && <TodayPanel date={date} day={worklog[date]} now={now} store={store} />}

      <Section label="stats">
        <Stats
          items={[
            { label: "paid", value: isLeave(day) ? "leave" : fmt(paid), color: COLORS.amber },
            { label: "logged", value: fmt(logged) },
            { label: "gap", value: fmtSigned(paid - logged), color: signColor(paid - logged) },
          ]}
        />
        {Object.keys(byCode).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "12px" }}>
            {sortCodeIds(Object.keys(byCode), codes, projects).map((id) => (
              <PickChip key={id} label={`${codeLabel(id, codes, projects)} ${fmt(byCode[id])}`} color={codeColor(id, codes, projects)} active />
            ))}
          </div>
        )}
      </Section>

      <Section label="office">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
          <input
            type="time"
            aria-label="arrived"
            value={day.officeIn || ""}
            onChange={(e) => patch({ officeIn: e.target.value || null })}
            style={{ ...timeInputStyle, width: "124px" }}
          />
          <span style={{ color: COLORS.dim, fontSize: "11px" }}>–</span>
          <input
            type="time"
            aria-label="left"
            value={day.officeOut || ""}
            onChange={(e) => patch({ officeOut: e.target.value || null })}
            style={{ ...timeInputStyle, width: "124px" }}
          />
          {(day.officeIn || day.officeOut) && (
            <span onClick={() => patch({ officeIn: null, officeOut: null, officeLunch: undefined })} style={linkStyle}>
              clear
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
          {day.officeIn && <BracketCheck checked={hasOfficeLunch(day)} onChange={(v) => patch({ officeLunch: v })} label={`office lunch (−${settings.lunchMin}m)`} />}
          <BracketCheck checked={isLeave(day)} onChange={(v) => patch({ dayOff: v ? "leave" : null })} label="leave day" />
        </div>
        {!day.officeIn && !isLeave(day) && <div style={{ fontSize: "11px", color: COLORS.dim, marginTop: "10px" }}>no office visit — a home day: only logged work counts as paid</div>}
      </Section>

      <Section
        label="logged"
        right={
          !draft && (
            <span onClick={startEdit} style={linkStyle}>
              edit
            </span>
          )
        }
      >
        {draft ? (
          <>
            {draft.map((seg, i) => (
              <SegmentRow key={i} seg={seg} store={store} onChange={(next) => editRow(i, next)} onRemove={() => removeRow(i)} />
            ))}
            <div onClick={addRow} style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11.5px", color: COLORS.dim, cursor: "pointer", margin: "4px 0 14px" }}>
              <Plus size={12} /> add segment
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setDraft(null)} style={secondaryBtnStyle}>
                cancel
              </button>
              <button onClick={saveEdit} style={primaryBtnStyle}>
                save
              </button>
            </div>
          </>
        ) : segments.length === 0 ? (
          <div style={{ fontSize: "12px", color: COLORS.dim }}>
            // nothing logged ·{" "}
            <span onClick={() => { startEdit(); addRow(); }} style={linkStyle}>
              add
            </span>
          </div>
        ) : (
          segments.map((seg, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "5px 0", fontSize: "12.5px" }}>
              <Dot color={seg.codeId ? codeColor(seg.codeId, codes, projects) : COLORS.dim} />
              <span style={{ color: COLORS.dim, width: "96px" }}>
                {seg.start}–{seg.end || "…"}
              </span>
              <span style={{ flex: 1, color: seg.codeId ? COLORS.text : COLORS.dim }}>{seg.codeId ? codeLabel(seg.codeId, codes, projects) : "break"}</span>
            </div>
          ))
        )}
      </Section>

      {worklog[date] && (
        <div style={{ padding: "16px 20px" }}>
          <span onClick={() => setConfirmClear(true)} style={linkStyle}>
            clear day
          </span>
        </div>
      )}

      {confirmClear && (
        <ConfirmDialog
          title="clear this day?"
          message={`Removes the office visit, leave flag and every logged segment on ${full}.`}
          confirmLabel="clear"
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            clearDay(date);
            setDraft(null);
            setConfirmClear(false);
          }}
        />
      )}
    </Page>
  );
}
