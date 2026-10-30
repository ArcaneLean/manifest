// Money helpers for Ledger — see ARCHITECTURE.md §7 ("Ledger"). Every amount
// is stored as integer cents, signed the way the bank shows it (expenses
// negative, refunds positive), so sums never pick up float drift.

const NUMBER = new Intl.NumberFormat("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// "€ 1.234,56" / "−€ 1.234,56". `signed` forces a leading + on positive amounts.
export function formatCents(cents, { signed = false } = {}) {
  const value = Math.round(cents || 0);
  const sign = value < 0 ? "−" : signed && value > 0 ? "+" : "";
  return `${sign}€ ${NUMBER.format(Math.abs(value) / 100)}`;
}

// Plain number for an input field: "1234,56" (no thousands separator, no €).
export function centsToInput(cents) {
  if (cents == null) return "";
  const value = Math.round(cents);
  const abs = Math.abs(value);
  return `${value < 0 ? "-" : ""}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

// Parses what's typed into an amount field into cents, or null if it isn't a
// number. Accepts Dutch ("1.234,56", "12,5") and English ("1234.56") styles
// and an optional €. A bare dot followed by exactly three digits per group
// ("1.234") is a thousands separator, otherwise a dot is the decimal mark.
//
// `defaultSign` (-1 / +1) applies only when no explicit sign was typed, so
// on an expense line "99,24" means −€ 99,24 while "+78,04" stays a refund.
export function parseAmount(input, defaultSign = 1) {
  if (input == null) return null;
  let s = String(input).trim().replace(/€/g, "").replace(/\s/g, "").replace(/−/g, "-");
  if (!s) return null;
  let sign = defaultSign;
  if (s[0] === "+" || s[0] === "-") {
    sign = s[0] === "-" ? -1 : 1;
    s = s.slice(1);
  }
  if (s.endsWith("-")) {
    // Bank exports and the old sheet write "3,65-".
    sign = -1;
    s = s.slice(0, -1);
  }
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d+)?$/.test(s) && !/^\.\d+$/.test(s)) return null;
  return sign * Math.round(parseFloat(s) * 100);
}

export function sumCents(values) {
  let total = 0;
  for (const v of values) total += v || 0;
  return total;
}
