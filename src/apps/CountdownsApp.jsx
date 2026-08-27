import CountdownsView from "../views/CountdownsView.jsx";
import { TopBar } from "../components/TopBar.jsx";

export default function CountdownsApp({ onHome }) {
  return (
    <>
      <TopBar title="countdowns" onBack={onHome} />
      <CountdownsView />
    </>
  );
}
