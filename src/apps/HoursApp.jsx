import HoursView from "../views/HoursView.jsx";
import { TopBar } from "../components/TopBar.jsx";

export default function HoursApp({ onHome }) {
  return (
    <>
      <TopBar title="hours" onBack={onHome} />
      <HoursView />
    </>
  );
}
