import { COLORS } from "../theme/colors.js";
import { IS_PREVIEW, PREVIEW_INFO, CHANNEL } from "../lib/channel.js";

// Always-visible strip across the top of a PR preview, so it can't be
// mistaken for the real app — see ARCHITECTURE.md §7 ("PR previews").
// Renders nothing on main.
export function PreviewBand() {
  if (!IS_PREVIEW) return null;
  const label = PREVIEW_INFO.pr ? `#${PREVIEW_INFO.pr}` : CHANNEL;
  return (
    <div
      style={{
        background: COLORS.amber,
        color: COLORS.bg,
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.5px",
        padding: "3px 12px",
        textAlign: "center",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      PREVIEW {label}
      {PREVIEW_INFO.branch && ` · ${PREVIEW_INFO.branch}`} · own data
    </div>
  );
}
