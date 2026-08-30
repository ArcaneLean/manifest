import TodayView from "../views/TodayView.jsx";
import { TopBar } from "../components/TopBar.jsx";

export default function TodayApp({ onHome }) {
  return (
    <>
      <TopBar title="today" onBack={onHome} />
      <TodayView />
    </>
  );
}
