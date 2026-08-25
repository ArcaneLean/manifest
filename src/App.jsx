import TasksView from "./views/TasksView.jsx";
import { UpdatePrompt } from "./UpdatePrompt.jsx";

// Nav shell (§7 "Navigation shell") isn't decided yet — this renders the
// Tasks view directly until more views land and an IA decision is made.
export default function App() {
  return (
    <>
      <TasksView />
      <UpdatePrompt />
    </>
  );
}
