import ShortlistView from "../views/ShortlistView.jsx";
import { TopBar } from "../components/TopBar.jsx";

export default function ShortlistApp({ onHome }) {
  return (
    <>
      <TopBar title="shortlist" onBack={onHome} />
      <ShortlistView />
    </>
  );
}
