import { CalendarDays, GraduationCap, Inbox, ListTodo, FolderKanban } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, ErrorState, Spinner } from "../components/ui.js";
import { useHomeSummary, useProjects } from "../lib/queries.js";

function Tile({
  to,
  title,
  icon: Icon,
  headline,
  lines,
}: {
  to: string;
  title: string;
  icon: typeof ListTodo;
  headline: string;
  lines: string[];
}) {
  return (
    <Link
      to={to}
      className="group rounded-lg border border-border bg-surface p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Icon size={18} className="text-primary" aria-hidden="true" />
          {title}
        </span>
        <span className="tnum text-2xl font-bold">{headline}</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-sm text-muted">
        {lines.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </Link>
  );
}

export function Home() {
  const summary = useHomeSummary();
  const projects = useProjects();

  if (summary.isLoading) return <Spinner />;
  if (summary.isError || !summary.data)
    return <ErrorState error={summary.error} retry={summary.refetch} />;
  const s = summary.data;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Hub</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Tile
          to="/calendar"
          title="Calendar"
          icon={CalendarDays}
          headline={`${s.calendar.today}`}
          lines={[`${s.calendar.today} today`, `${s.calendar.upcoming} upcoming`]}
        />
        <Tile
          to="/todos"
          title="Todos"
          icon={ListTodo}
          headline={`${s.todos.open}`}
          lines={[
            `${s.todos.open} open`,
            `${s.todos.dueToday} due today · ${s.todos.overdue} overdue`,
          ]}
        />
        <Tile
          to="/incoming"
          title="Incoming"
          icon={Inbox}
          headline={`${s.incoming.unread}`}
          lines={[`${s.incoming.unread} to triage`]}
        />
        <Tile
          to="/learn"
          title="Learn"
          icon={GraduationCap}
          headline={`${s.learn.total}`}
          lines={[`${s.learn.total} saved`, `${s.learn.learning} in progress`]}
        />
      </div>

      <Card>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <FolderKanban size={18} className="text-primary" aria-hidden="true" />
          Projects
        </div>
        <ul className="space-y-1 text-sm">
          {projects.data?.map((p) => {
            const total = p.counts.todosOpen + p.counts.todosDone;
            return (
              <li key={p.id} className="flex items-center justify-between">
                <Link to={`/projects/${p.id}`} className="hover:underline">
                  <span
                    className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ background: p.color ?? "var(--color-muted-foreground)" }}
                    aria-hidden="true"
                  />
                  {p.name}
                </Link>
                <span className="tnum text-muted">
                  {p.counts.todosDone}/{total || 0}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
