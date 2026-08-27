import { ListChecks, LayoutGrid, Calendar, Repeat, Tag } from "lucide-react";
import { COLORS } from "../theme/colors.js";

// Bottom tab bar for the Task Manager app — its 5 views (all lenses over the
// same task store, see ARCHITECTURE.md §5) fit a standard bottom nav.
// Countdowns and Hours are separate apps launched from the home screen
// (§7 "Navigation shell"), each with a single view and no sub-nav.
export const NAV_HEIGHT = 56;

const NAV_ITEMS = [
  { key: "tasks", label: "tasks", icon: ListChecks },
  { key: "matrix", label: "matrix", icon: LayoutGrid },
  { key: "calendar", label: "calendar", icon: Calendar },
  { key: "templates", label: "templates", icon: Repeat },
  { key: "tags", label: "tags", icon: Tag },
];

export function NavBar({ active, onChange }) {
  return (
    <nav
      style={{
        position: "fixed",
        left: "50%",
        bottom: 0,
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: "420px",
        height: `${NAV_HEIGHT}px`,
        display: "flex",
        background: COLORS.panel,
        borderTop: `1px solid ${COLORS.border}`,
        zIndex: 40,
      }}
    >
      {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
        const isActive = active === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <Icon size={19} color={isActive ? COLORS.amber : COLORS.dim} strokeWidth={isActive ? 2.25 : 1.75} />
          </button>
        );
      })}
    </nav>
  );
}
