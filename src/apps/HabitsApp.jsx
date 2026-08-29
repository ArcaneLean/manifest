import HabitsView from "../views/HabitsView.jsx";
import { TopBar } from "../components/TopBar.jsx";

export default function HabitsApp({ onHome }) {
  return (
    <>
      <TopBar title="habits" onBack={onHome} />
      <HabitsView />
    </>
  );
}
