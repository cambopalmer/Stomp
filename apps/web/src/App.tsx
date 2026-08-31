import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell.js";
import { Calendar } from "./routes/Calendar.js";
import { Home } from "./routes/Home.js";
import { Incoming } from "./routes/Incoming.js";
import { Learn } from "./routes/Learn.js";
import { Projects } from "./routes/Projects.js";
import { Signup } from "./routes/Signup.js";
import { Todos } from "./routes/Todos.js";

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/todos" element={<Todos />} />
        <Route path="/incoming" element={<Incoming />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </AppShell>
  );
}
