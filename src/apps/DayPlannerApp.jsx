import DayPlannerView from "../views/DayPlannerView.jsx";
import { TopBar } from "../components/TopBar.jsx";

export default function DayPlannerApp({ onHome }) {
  return (
    <>
      <TopBar title="day planner" onBack={onHome} />
      <DayPlannerView />
    </>
  );
}
