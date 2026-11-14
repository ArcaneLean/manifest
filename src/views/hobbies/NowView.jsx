// Hobbies' default tab — see ARCHITECTURE.md §7 ("Hobbies"): what's going on
// right now (active), then what's on hold (paused).
import { Play, Pause } from "lucide-react";
import { COLORS } from "../../theme/colors.js";
import { forTab } from "../../lib/hobbies/model.js";
import { Page, Header, linkStyle } from "../hours/ui.jsx";
import { Fab } from "../work/ui.jsx";
import { PursuitRow, Empty } from "./PursuitRow.jsx";
import { GroupLabel } from "./ui.jsx";

export default function NowView({ store }) {
  const { pursuits, loading, openPursuit, newPursuit, setStatus, goTab } = store;
  const rows = forTab(pursuits, "now");
  const active = rows.filter((p) => p.status === "active");
  const paused = rows.filter((p) => p.status === "paused");
  const queued = forTab(pursuits, "next");

  const sub = loading ? "loading…" : [`${active.length} active`, paused.length ? `${paused.length} paused` : null, queued.length ? `${queued.length} up next` : null].filter(Boolean).join(" · ");

  return (
    <Page>
      <Header title="~/hobbies" sub={sub} />
      {active.map((p) => (
        <PursuitRow key={p.id} pursuit={p} onOpen={openPursuit} actions={[{ icon: Pause, label: `pause ${p.title}`, onClick: () => setStatus(p.id, "paused") }]} />
      ))}
      {paused.length > 0 && <GroupLabel>paused</GroupLabel>}
      {paused.map((p) => (
        <PursuitRow key={p.id} pursuit={p} onOpen={openPursuit} actions={[{ icon: Play, label: `resume ${p.title}`, onClick: () => setStatus(p.id, "active") }]} />
      ))}
      {!loading && rows.length === 0 && <Empty>// nothing on the go — + to add one{queued.length ? "" : ", or park an idea"}</Empty>}
      {!loading && queued.length > 0 && (
        <div style={{ padding: "16px 20px", fontSize: "12px", color: COLORS.dim }}>
          up next: <span style={{ color: COLORS.text }}>{queued[0].title}</span> ·{" "}
          <span onClick={() => goTab("next")} style={linkStyle}>
            queue →
          </span>
        </div>
      )}
      <Fab onClick={() => newPursuit({ status: "active" })} label="add hobby" />
    </Page>
  );
}
