// Hobbies' ideas — see ARCHITECTURE.md §7 ("Hobbies"): things you might do,
// newest first, with a quick-add line. Queue or start one from its row.
import { useState } from "react";
import { Play, ListPlus } from "lucide-react";
import { forTab } from "../../lib/hobbies/model.js";
import { Page, Header } from "../hours/ui.jsx";
import { Fab, fieldStyle } from "../work/ui.jsx";
import { PursuitRow, Empty } from "./PursuitRow.jsx";

export default function IdeasView({ store }) {
  const { pursuits, loading, openPursuit, newPursuit, addPursuit, setStatus } = store;
  const rows = forTab(pursuits, "ideas");
  const [text, setText] = useState("");

  const quickAdd = () => {
    const title = text.trim();
    if (!title) return;
    addPursuit({ title, status: "idea" });
    setText("");
  };

  return (
    <Page>
      <Header title="~/hobbies/ideas" sub={loading ? "loading…" : `${rows.length} idea${rows.length === 1 ? "" : "s"}`} />
      <div style={{ padding: "12px 20px" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") quickAdd();
          }}
          placeholder="+ jot an idea (enter)"
          aria-label="quick add idea"
          className="task-input"
          style={fieldStyle}
        />
      </div>
      {rows.map((p) => (
        <PursuitRow
          key={p.id}
          pursuit={p}
          onOpen={openPursuit}
          actions={[
            { icon: ListPlus, label: `queue ${p.title}`, onClick: () => setStatus(p.id, "queued") },
            { icon: Play, label: `start ${p.title}`, onClick: () => setStatus(p.id, "active") },
          ]}
        />
      ))}
      {!loading && rows.length === 0 && <Empty>// no ideas parked yet</Empty>}
      <Fab onClick={() => newPursuit({ status: "idea" })} label="add idea" />
    </Page>
  );
}
