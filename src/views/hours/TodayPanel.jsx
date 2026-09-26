// Today's quick actions — office arrive/leave and clock in/switch/out — shown
// at the top of the weeks root (and on today's day view) so the everyday
// action never needs a drill-down. See ARCHITECTURE.md §7 ("Hours 2.0").
import { useState } from "react";
import { COLORS } from "../../theme/colors.js";
import { nowHHMM, timeToMinutes } from "../../lib/timeUtils.js";
import { openSegment, paidMinutes, loggedMinutes, isAtOffice } from "../../lib/hours2/day.js";
import { dayLabel } from "../../lib/hours2/week.js";
import { Section, PickChip, primaryBtnStyle, secondaryBtnStyle, timeInputStyle, linkStyle, disabledStyle, fmt } from "./ui.jsx";
import { codeLabel, codeColor, pickableCodes, taskTitle } from "./codes.js";

// Time input + (optionally) an explicit code-or-break picker. No default
// selection, so a quick clock-in can never silently land on the wrong code.
export function TimeAction({ label, time, setTime, pick, setPick, codes, projects, allowBreak, onConfirm, onCancel }) {
  const needsPick = setPick !== undefined;
  const disabled = !time || (needsPick && pick === undefined);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} autoFocus style={{ ...timeInputStyle, alignSelf: "flex-start" }} />
      {needsPick && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {allowBreak && <PickChip label="break" color={COLORS.dim} active={pick === null} onClick={() => setPick(null)} />}
          {pickableCodes(codes, projects).map((c) => (
            <PickChip key={c.id} label={codeLabel(c.id, codes, projects)} color={codeColor(c.id, codes, projects)} active={pick === c.id} onClick={() => setPick(c.id)} />
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={onConfirm} disabled={disabled} style={disabledStyle(primaryBtnStyle, disabled)}>
          {label}
        </button>
        <button onClick={onCancel} style={secondaryBtnStyle}>
          cancel
        </button>
      </div>
    </div>
  );
}

export function TodayPanel({ date, day, now, store, onOpenDay }) {
  const { codes, projects, settings, clockIn, switchSegment, clockOut, arrive, leave } = store;
  const [action, setAction] = useState(null);
  const [time, setTime] = useState("");
  const [pick, setPick] = useState(undefined);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const begin = (a) => {
    setTime(nowHHMM(now));
    setPick(undefined);
    setAction(a);
  };
  const cancel = () => setAction(null);
  const confirm = () => {
    if (!time) return;
    if (action === "arrive") arrive(date, time);
    if (action === "leave") leave(date, time);
    if (action === "in" && pick !== undefined) clockIn(date, time, pick);
    if (action === "switch" && pick !== undefined) switchSegment(date, time, pick);
    if (action === "out") clockOut(date, time);
    setAction(null);
  };

  const open = openSegment(day);
  const atOffice = isAtOffice(day);
  const paid = paidMinutes(day, { lunchMin: settings.lunchMin, nowMin });
  const logged = loggedMinutes(day, nowMin);
  const actionProps = { time, setTime, codes, projects, onConfirm: confirm, onCancel: cancel };

  const labelStyle = { fontSize: "11px", color: COLORS.dim, width: "46px", flexShrink: 0, paddingTop: "7px" };
  const lineStyle = { display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "10px" };
  const textStyle = { fontSize: "12.5px", color: COLORS.text, paddingTop: "6px" };

  let officeBody;
  if (action === "arrive" || action === "leave") officeBody = <TimeAction label={action} {...actionProps} />;
  else if (!day?.officeIn)
    officeBody = (
      <button onClick={() => begin("arrive")} style={secondaryBtnStyle}>
        arrive
      </button>
    );
  else if (atOffice)
    officeBody = (
      <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "12.5px" }}>since {day.officeIn}</span>
        <button onClick={() => begin("leave")} style={secondaryBtnStyle}>
          leave
        </button>
      </div>
    );
  else officeBody = <span style={textStyle}>{day.officeIn}–{day.officeOut}</span>;

  let logBody;
  if (action === "in" || action === "switch" || action === "out")
    logBody = (
      <TimeAction
        label={action === "in" ? "clock in" : action === "switch" ? "switch" : "clock out"}
        {...actionProps}
        pick={pick}
        setPick={action === "out" ? undefined : setPick}
        allowBreak={action === "switch"}
      />
    );
  else if (open) {
    const elapsed = Math.max(0, nowMin - timeToMinutes(open.start));
    logBody = (
      <div>
        <div style={{ fontSize: "12.5px", marginBottom: "8px", paddingTop: "6px" }}>
          {open.codeId ? (
            <span style={{ color: codeColor(open.codeId, codes, projects) }}>
              {codeLabel(open.codeId, codes, projects)}
              {taskTitle(open.taskId, store.workTasks) && <span style={{ color: COLORS.text }}> · {taskTitle(open.taskId, store.workTasks)}</span>}
            </span>
          ) : (
            <span style={{ color: COLORS.dim }}>break</span>
          )}{" "}
          since {open.start} · {fmt(elapsed)}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => begin("switch")} style={primaryBtnStyle}>
            switch →
          </button>
          <button onClick={() => begin("out")} style={secondaryBtnStyle}>
            clock out
          </button>
        </div>
      </div>
    );
  } else
    logBody = (
      <button onClick={() => begin("in")} style={primaryBtnStyle}>
        {day?.segments?.length ? "resume →" : "clock in →"}
      </button>
    );

  return (
    <Section
      label={`today · ${dayLabel(date)}`}
      right={
        onOpenDay && (
          <span onClick={onOpenDay} style={linkStyle}>
            open day →
          </span>
        )
      }
    >
      <div style={lineStyle}>
        <span style={labelStyle}>office</span>
        <div style={{ flex: 1 }}>{officeBody}</div>
      </div>
      <div style={lineStyle}>
        <span style={labelStyle}>log</span>
        <div style={{ flex: 1 }}>{logBody}</div>
      </div>
      <div style={{ fontSize: "11.5px", color: COLORS.dim }}>
        paid so far <span style={{ color: COLORS.amber, fontWeight: 600 }}>{fmt(paid)}</span> · logged{" "}
        <span style={{ color: COLORS.text, fontWeight: 600 }}>{fmt(logged)}</span>
      </div>
    </Section>
  );
}
