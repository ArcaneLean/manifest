// Hobbies' record — see ARCHITECTURE.md §7 ("Hobbies"): finished and
// dropped pursuits, latest first.
import { COLORS } from "../../theme/colors.js";
import { forTab } from "../../lib/hobbies/model.js";
import { Page, Header } from "../hours/ui.jsx";
import { Fab } from "../work/ui.jsx";
import { PursuitRow, Empty } from "./PursuitRow.jsx";

function finishedLabel(ms) {
  return new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toLowerCase();
}

export default function DoneView({ store }) {
  const { pursuits, loading, openPursuit, newPursuit } = store;
  const rows = forTab(pursuits, "done");
  const done = rows.filter((p) => p.status === "done").length;

  return (
    <Page>
      <Header title="~/hobbies/done" sub={loading ? "loading…" : [`${done} finished`, rows.length - done ? `${rows.length - done} dropped` : null].filter(Boolean).join(" · ")} />
      {rows.map((p) => (
        <PursuitRow
          key={p.id}
          pursuit={p}
          onOpen={openPursuit}
          extraMeta={p.finishedAt ? <span style={{ fontSize: "10.5px", color: p.status === "done" ? COLORS.sage : COLORS.dim }}>{finishedLabel(p.finishedAt)}</span> : null}
        />
      ))}
      {!loading && rows.length === 0 && <Empty>// nothing finished yet</Empty>}
      <Fab onClick={() => newPursuit({ status: "done" })} label="log a finished one" />
    </Page>
  );
}
