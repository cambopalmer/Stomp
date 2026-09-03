import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell.js";
import { Spinner } from "./components/ui.js";
import { useAuth } from "./lib/auth.js";
import { Calendar } from "./routes/Calendar.js";
import { EventDetail } from "./routes/EventDetail.js";
import { Home } from "./routes/Home.js";
import { Incoming } from "./routes/Incoming.js";
import { Learn } from "./routes/Learn.js";
import { Login } from "./routes/Login.js";
import { ProjectDetail } from "./routes/ProjectDetail.js";
import { Projects } from "./routes/Projects.js";
import { ReferenceDetail } from "./routes/ReferenceDetail.js";
import { SharedWithMe } from "./routes/SharedWithMe.js";
import { TagPage } from "./routes/TagPage.js";
import { TodoDetail } from "./routes/TodoDetail.js";
import { Todos } from "./routes/Todos.js";
import { Workspaces } from "./routes/Workspaces.js";

export function App() {
  const auth = useAuth();
  const loc = useLocation();

  if (auth.loading) {
    return <div className="grid min-h-dvh place-items-center"><Spinner /></div>;
  }

  if (!auth.user) {
    return (
      <Routes>
        <Route path="/login" element={<Login mode="login" />} />
        <Route path="/signup" element={<Login mode="signup" />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: loc.pathname }} />} />
      </Routes>
    );
  }

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
        <Route path="/workspaces" element={<Workspaces />} />
        <Route path="/shared" element={<SharedWithMe />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/signup" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </AppShell>
  );
}
