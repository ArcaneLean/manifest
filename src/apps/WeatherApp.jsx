import WeatherView from "../views/WeatherView.jsx";
import { TopBar } from "../components/TopBar.jsx";

export default function WeatherApp({ onHome }) {
  return (
    <>
      <TopBar title="weather" onBack={onHome} />
      <WeatherView />
    </>
  );
}
