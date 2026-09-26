// Earned-per-code — the bridge between paid (what I'm entitled to) and booked
// (what goes into the employer's system). See ARCHITECTURE.md §7 ("Hours
// 2.0"). The week's gap (paid − logged, mostly unlogged office time; can be
// negative) is attributed to codes in one of two modes:
//   { kind: "proportional" }           — spread by each code's logged share
//   { kind: "single", codeId }         — all of it on one chosen code
// Either way Σ earned = paid exactly (whole minutes).
import { sumValues } from "./day.js";

// Splits integer `total` over `weights` (non-negative) with largest-remainder
// rounding, so the parts are integers summing exactly to `total` (which may
// be negative). Returns null if every weight is 0 and total isn't.
export function apportion(weights, total) {
  const keys = Object.keys(weights).filter((k) => weights[k] > 0);
  const wsum = keys.reduce((s, k) => s + weights[k], 0);
  if (wsum === 0) return total === 0 ? {} : null;
  const out = {};
  const fracs = [];
  let assigned = 0;
  for (const k of keys) {
    const exact = (total * weights[k]) / wsum;
    const fl = Math.floor(exact);
    out[k] = fl;
    assigned += fl;
    fracs.push([k, exact - fl]);
  }
  // Floor always undershoots, so the remainder is 0..keys.length-1.
  let rest = total - assigned;
  fracs.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  for (let i = 0; rest > 0; i++, rest--) out[fracs[i % fracs.length][0]] += 1;
  return out;
}

export function earnedByCode(logged, paid, gapMode) {
  const loggedTotal = sumValues(logged);
  const gap = paid - loggedTotal;
  const earned = { ...logged };
  if (gap === 0) return { earned, gap };
  if (gapMode && gapMode.kind === "single") {
    if (!gapMode.codeId) return { error: "pick a code for the gap", gap };
    earned[gapMode.codeId] = (earned[gapMode.codeId] || 0) + gap;
    return { earned, gap };
  }
  const shares = apportion(logged, gap);
  if (!shares) return { error: "nothing logged to spread the gap over — put it on one code", gap };
  for (const [k, v] of Object.entries(shares)) earned[k] += v;
  return { earned, gap };
}
