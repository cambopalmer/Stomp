import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell.js";
import { Calendar } from "./routes/Calendar.js";
import { EventDetail } from "./routes/EventDetail.js";
import { Home } from "./routes/Home.js";
import { Incoming } from "./routes/Incoming.js";
import { Learn } from "./routes/Learn.js";
import { ProjectDetail } from "./routes/ProjectDetail.js";
import { Projects } from "./routes/Projects.js";
import { ReferenceDetail } from "./routes/ReferenceDetail.js";
import { Signup } from "./routes/Signup.js";
import { TagPage } from "./routes/TagPage.js";
import { TodoDetail } from "./routes/TodoDetail.js";
import { Todos } from "./routes/Todos.js";

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/calendar/:id" element={<EventDetail />} />
        <Route path="/todos" element={<Todos />} />
        <Route path="/todos/:id" element={<TodoDetail />} />
        <Route path="/incoming" element={<Incoming />} />
        <Route path="/learn" element={<Learn />} />
        <Route path="/learn/:id" element={<ReferenceDetail />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:id" element={<ProjectDetail />} />
        <Route path="/tags/:name" element={<TagPage />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </AppShell>
  );
}
