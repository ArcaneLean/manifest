// Booking a week — both gap modes side by side, a days × codes grid in 30m
// steps, and confirm (which is what moves the week into the bank). See
// ARCHITECTURE.md §7 ("Hours 2.0").
import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { COLORS } from "../../theme/colors.js";
import { dayLabel, weekLabel } from "../../lib/hours2/week.js";
import { earnedByCode } from "../../lib/hours2/earned.js";
import { proposeBooking, validateBooking, bookedByCode, bookedByDay, setCell, UNIT_MIN } from "../../lib/hours2/booking.js";
import { addInto } from "../../lib/hours2/bank.js";
import { ConfirmDialog } from "../../components/ConfirmDialog.jsx";
import { Page, Header, Section, Dot, Badge, timeInputStyle, primaryBtnStyle, secondaryBtnStyle, linkStyle, disabledStyle, fmt, fmtSigned, signColor } from "./ui.jsx";
import { weekInfo, bankBefore, clockContext } from "./model.js";
import { codeLabel, codeColor, pickableCodes, sortCodeIds } from "./codes.js";

function hm(min) {
  if (!min) return "·";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}:${String(m).padStart(2, "0")}` : `${h}`;
}

function modeResult(summary, before, gapMode) {
  const res = earnedByCode(summary.loggedByCode, summary.paid, gapMode);
  if (res.error) return { error: res.error, gap: res.gap };
  const lines = proposeBooking({ earned: res.earned, bank: before, days: summary.bookingDays, loggedByDay: summary.loggedByDay, dayMin: summary.dayMin });
  const bankAfter = addInto(addInto({ ...before }, res.earned), bookedByCode(lines), -1);
  return { earned: res.earned, gap: res.gap, lines, bankAfter };
}

function ModeCard({ title, selected, result, onUse, store, children }) {
  const { codes, projects } = store;
  const booked = result.lines ? bookedByCode(result.lines) : {};
  const ids = result.earned ? sortCodeIds(new Set([...Object.keys(result.earned), ...Object.keys(booked), ...Object.keys(result.bankAfter).filter((k) => result.bankAfter[k])]), codes, projects) : [];
  return (
    <div style={{ border: `1px solid ${selected ? COLORS.amber : COLORS.border}`, borderRadius: "8px", padding: "12px 14px", marginBottom: "10px", background: selected ? COLORS.panel : "transparent" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", gap: "8px" }}>
        <span style={{ fontSize: "12.5px", fontWeight: 600, color: selected ? COLORS.amber : COLORS.text }}>{title}</span>
        {selected ? (
          <Badge color={COLORS.amber}>in grid</Badge>
        ) : (
          <button onClick={onUse} disabled={!!result.error} style={disabledStyle({ ...secondaryBtnStyle, padding: "4px 10px", fontSize: "11px" }, !!result.error)}>
            use this
          </button>
        )}
      </div>
      {children}
      {result.error ? (
        <div style={{ fontSize: "11.5px", color: COLORS.amber }}>{result.error}</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
          <thead>
            <tr style={{ fontSize: "10.5px", color: COLORS.dim }}>
              <th style={{ textAlign: "left", fontWeight: 400, width: "44%" }}>code</th>
              <th style={{ textAlign: "right", fontWeight: 400 }}>earned</th>
              <th style={{ textAlign: "right", fontWeight: 400 }}>book</th>
              <th style={{ textAlign: "right", fontWeight: 400 }}>bank</th>
            </tr>
          </thead>
          <tbody>
            {ids.map((id) => (
              <tr key={id} style={{ fontSize: "11.5px" }}>
                <td style={{ padding: "3px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <Dot color={codeColor(id, codes, projects)} size={6} /> {codeLabel(id, codes, projects)}
                </td>
                <td style={{ textAlign: "right" }}>{fmt(result.earned[id] || 0)}</td>
                <td style={{ textAlign: "right" }}>{fmt(booked[id] || 0)}</td>
                <td style={{ textAlign: "right", color: signColor(result.bankAfter[id] || 0) }}>{fmtSigned(result.bankAfter[id] || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function BookingView({ weekStart, store, now, back }) {
  const { codes, projects, settings, saveBooking, removeBooking, updateSettings } = store;
  const ctx = clockContext(now);
  const info = weekInfo(weekStart, store, ctx);
  const { summary, booking, confirmed } = info;
  const before = bankBefore(store, weekStart);

  const firstLogged = sortCodeIds(Object.keys(summary.loggedByCode), codes, projects)[0];
  const [singleCode, setSingleCode] = useState(
    (booking?.gapMode?.kind === "single" && booking.gapMode.codeId) || settings.gapMode?.codeId || firstLogged || pickableCodes(codes, projects)[0]?.id || ""
  );
  const initialKind = (booking?.gapMode || settings.gapMode || { kind: "proportional" }).kind;
  const [kind, setKind] = useState(initialKind);

  const proportional = modeResult(summary, before, { kind: "proportional" });
  const single = modeResult(summary, before, { kind: "single", codeId: singleCode });
  const results = { proportional, single };
  const current = results[kind];

  const [lines, setLines] = useState(() => (booking ? booking.lines : results[initialKind].lines || []));
  const [extraRows, setExtraRows] = useState([]);
  const [selected, setSelected] = useState(null); // { date, codeId }
  const [confirmUnbook, setConfirmUnbook] = useState(false);

  const use = (k) => {
    setKind(k);
    if (results[k].lines) setLines(results[k].lines);
    setSelected(null);
  };

  const booked = bookedByCode(lines);
  const perDay = bookedByDay(lines);
  const rowIds = sortCodeIds(
    new Set([...Object.keys(booked), ...Object.keys(current.earned || {}), ...Object.keys(before).filter((k) => before[k]), ...extraRows]),
    codes,
    projects
  );
  const bankAfter = current.earned ? addInto(addInto({ ...before }, current.earned), booked, -1) : null;
  const cellMin = (date, codeId) => lines.find((l) => l.date === date && l.codeId === codeId)?.minutes || 0;

  const errors = useMemo(() => {
    const out = [];
    if (current.error) out.push(current.error);
    for (const d of summary.incomplete) out.push(`${dayLabel(d)} isn't clocked out / left yet — fix that day first`);
    out.push(...validateBooking(lines, summary.bookingDays, { dayMin: summary.dayMin }).map((e) => e.replace(/^(\d{4}-\d{2}-\d{2})/, (d) => dayLabel(d))));
    return out;
  }, [current.error, summary, lines]);

  const step = (delta) => {
    if (!selected) return;
    const next = Math.max(0, cellMin(selected.date, selected.codeId) + delta);
    setLines((prev) => setCell(prev, selected.date, selected.codeId, next));
  };
  const fillDay = () => {
    if (!selected) return;
    const room = summary.dayMin - (perDay[selected.date] || 0);
    if (room > 0) setLines((prev) => setCell(prev, selected.date, selected.codeId, cellMin(selected.date, selected.codeId) + room));
  };

  const confirm = () => {
    if (errors.length) return;
    const gapMode = kind === "single" ? { kind: "single", codeId: singleCode } : { kind: "proportional" };
    saveBooking({ weekStart, lines, gapMode, earned: current.earned, confirmedAt: Date.now() });
    updateSettings({ gapMode });
    back();
  };

  const addableCodes = pickableCodes(codes, projects).filter((c) => !rowIds.includes(c.id));
  const bookableDays = summary.bookingDays;
  const cellStyle = (active, bookable) => ({
    textAlign: "center",
    fontSize: "12px",
    padding: "8px 0",
    cursor: bookable ? "pointer" : "default",
    color: bookable ? COLORS.text : COLORS.dim,
    background: active ? `${COLORS.amber}22` : "transparent",
    outline: active ? `1px solid ${COLORS.amber}` : "none",
    borderRadius: "4px",
  });

  return (
    <Page>
      <Header
        title="~/hours/booking"
        sub={weekLabel(weekStart)}
        right={confirmed ? <Badge color={info.stale ? COLORS.amber : COLORS.sage}>{info.stale ? "changed since booked" : "booked"}</Badge> : null}
      />

      <Section label={`gap this week: ${fmtSigned(current.gap ?? proportional.gap)} (paid ${fmt(summary.paid)} − logged ${fmt(summary.logged)})`}>
        <ModeCard title="proportional" selected={kind === "proportional"} result={proportional} onUse={() => use("proportional")} store={store} />
        <ModeCard title="single code" selected={kind === "single"} result={single} onUse={() => use("single")} store={store}>
          <select
            value={singleCode}
            onChange={(e) => {
              setSingleCode(e.target.value);
              if (kind === "single") {
                const r = modeResult(summary, before, { kind: "single", codeId: e.target.value });
                if (r.lines) setLines(r.lines);
              }
            }}
            style={{ ...timeInputStyle, width: "100%", marginBottom: "8px", padding: "5px 6px", fontSize: "12px" }}
          >
            {pickableCodes(codes, projects).map((c) => (
              <option key={c.id} value={c.id}>
                gap → {codeLabel(c.id, codes, projects)}
              </option>
            ))}
          </select>
        </ModeCard>
      </Section>

      <Section label="booking (tap a cell, then ± 30m)">
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "2px", tableLayout: "fixed" }}>
          <thead>
            <tr style={{ fontSize: "10.5px", color: COLORS.dim }}>
              <th style={{ textAlign: "left", fontWeight: 400, width: "32%" }}>code</th>
              {bookableDays.map((d) => (
                <th key={d.date} style={{ fontWeight: 400, color: d.bookable ? COLORS.dim : COLORS.sage }}>
                  {dayLabel(d.date).split(" ")[0]}
                </th>
              ))}
              <th style={{ fontWeight: 400, textAlign: "right" }}>total</th>
            </tr>
          </thead>
          <tbody>
            {rowIds.map((id) => (
              <tr key={id}>
                <td style={{ fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <Dot color={codeColor(id, codes, projects)} size={6} /> {codeLabel(id, codes, projects)}
                </td>
                {bookableDays.map((d) => {
                  const active = selected && selected.date === d.date && selected.codeId === id;
                  return (
                    <td key={d.date} onClick={() => d.bookable && setSelected({ date: d.date, codeId: id })} style={cellStyle(active, d.bookable)}>
                      {d.bookable ? hm(cellMin(d.date, id)) : "—"}
                    </td>
                  );
                })}
                <td style={{ textAlign: "right", fontSize: "11.5px", fontWeight: 600 }}>{hm(booked[id] || 0)}</td>
              </tr>
            ))}
            <tr>
              <td style={{ fontSize: "10.5px", color: COLORS.dim, paddingTop: "6px" }}>day total</td>
              {bookableDays.map((d) => {
                const got = perDay[d.date] || 0;
                const ok = got === (d.bookable ? summary.dayMin : 0);
                return (
                  <td key={d.date} style={{ textAlign: "center", fontSize: "11.5px", paddingTop: "6px", color: ok ? COLORS.sage : COLORS.amber, fontWeight: 600 }}>
                    {d.bookable ? (got ? hm(got) : "0") : "leave"}
                  </td>
                );
              })}
              <td style={{ textAlign: "right", fontSize: "11.5px", paddingTop: "6px", fontWeight: 600, color: Object.values(booked).reduce((a, b) => a + b, 0) === summary.bookable ? COLORS.sage : COLORS.amber }}>
                {hm(Object.values(booked).reduce((a, b) => a + b, 0))}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "12px", minHeight: "34px" }}>
          {selected ? (
            <>
              <span style={{ fontSize: "11.5px", color: COLORS.dim, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {dayLabel(selected.date)} · {codeLabel(selected.codeId, codes, projects)}
              </span>
              <button onClick={() => step(-UNIT_MIN)} style={{ ...secondaryBtnStyle, padding: "6px 8px", display: "flex" }} aria-label="minus 30 minutes">
                <Minus size={14} />
              </button>
              <span style={{ fontSize: "13px", fontWeight: 600, width: "40px", textAlign: "center" }}>{cellMin(selected.date, selected.codeId) ? hm(cellMin(selected.date, selected.codeId)) : "0"}</span>
              <button onClick={() => step(UNIT_MIN)} style={{ ...secondaryBtnStyle, padding: "6px 8px", display: "flex" }} aria-label="plus 30 minutes">
                <Plus size={14} />
              </button>
              <span onClick={fillDay} style={linkStyle}>
                fill day
              </span>
            </>
          ) : (
            <span style={{ fontSize: "11px", color: COLORS.dim }}>tap a cell to adjust it</span>
          )}
        </div>

        {addableCodes.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && setExtraRows((r) => [...r, e.target.value])}
            style={{ ...timeInputStyle, marginTop: "12px", fontSize: "11.5px", padding: "5px 6px" }}
          >
            <option value="">+ add a code row</option>
            {addableCodes.map((c) => (
              <option key={c.id} value={c.id}>
                {codeLabel(c.id, codes, projects)}
              </option>
            ))}
          </select>
        )}
      </Section>

      {bankAfter && (
        <Section label="bank after this booking">
          {rowIds.map((id) => (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "3px 0", fontSize: "12px" }}>
              <Dot color={codeColor(id, codes, projects)} size={6} />
              <span style={{ flex: 1 }}>{codeLabel(id, codes, projects)}</span>
              <span style={{ color: COLORS.dim, fontSize: "11px" }}>
                {fmtSigned(before[id] || 0)} + {fmt(current.earned[id] || 0)} − {fmt(booked[id] || 0)} =
              </span>
              <span style={{ fontWeight: 600, color: signColor(bankAfter[id] || 0), width: "64px", textAlign: "right" }}>{fmtSigned(bankAfter[id] || 0)}</span>
            </div>
          ))}
        </Section>
      )}

      <div style={{ padding: "16px 20px" }}>
        {errors.length > 0 && (
          <div style={{ marginBottom: "12px" }}>
            {errors.map((e, i) => (
              <div key={i} style={{ fontSize: "11.5px", color: COLORS.amber, marginBottom: "3px" }}>
                ! {e}
              </div>
            ))}
          </div>
        )}
        {summary.open.length > 0 && (
          <div style={{ fontSize: "11.5px", color: COLORS.dim, marginBottom: "12px" }}>today is still running — its hours are counted up to now, and the week will be flagged if they change after booking.</div>
        )}
        <div style={{ display: "flex", gap: "10px", justifyContent: "space-between", alignItems: "center" }}>
          {confirmed ? (
            <span onClick={() => setConfirmUnbook(true)} style={linkStyle}>
              unbook
            </span>
          ) : (
            <span />
          )}
          <button onClick={confirm} disabled={errors.length > 0} style={disabledStyle(primaryBtnStyle, errors.length > 0)}>
            {confirmed ? "save & re-confirm" : "confirm booking"}
          </button>
        </div>
      </div>

      {confirmUnbook && (
        <ConfirmDialog
          title="unbook this week?"
          message="Removes the stored booking. The week stops counting toward the bank until it's booked again."
          confirmLabel="unbook"
          onCancel={() => setConfirmUnbook(false)}
          onConfirm={() => {
            removeBooking(weekStart);
            setConfirmUnbook(false);
            back();
          }}
        />
      )}
    </Page>
  );
}
