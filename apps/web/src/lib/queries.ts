import type {
  CalendarEvent,
  CreateEvent,
  CreateProject,
  CreateReference,
  CreateTodo,
  HomeSummary,
  HotList,
  IncomingItem,
  Project,
  ProjectWithCounts,
  Reference,
  Tag,
  Todo,
  TodoWithChildren,
  TriageIncoming,
  UpdateEvent,
  UpdateReference,
  UpdateTodo,
  Workspace,
} from "@stomp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api.js";

const WRITE_KEYS = ["home", "todos", "projects", "events", "references", "incoming", "tags"];

function useInvalidateAll() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({
      predicate: (q) => WRITE_KEYS.includes(q.queryKey[0] as string),
    });
}

function mutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  return () => {
    const invalidate = useInvalidateAll();
    return useMutation({ mutationFn: fn, onSuccess: invalidate });
  };
}

// ─── queries ─────────────────────────────────────────
export const useHomeSummary = () =>
  useQuery({ queryKey: ["home", "summary"], queryFn: () => api.get<HomeSummary>("/home/summary") });

export const useHotList = () =>
  useQuery({ queryKey: ["home", "hot"], queryFn: () => api.get<HotList>("/home/hot") });

export const useTodos = (query = "?topLevel=true") =>
  useQuery({ queryKey: ["todos", "list", query], queryFn: () => api.get<Todo[]>(`/todos${query}`) });

export const useTodo = (id: string | undefined) =>
  useQuery({
    queryKey: ["todos", "one", id],
    queryFn: () => api.get<TodoWithChildren>(`/todos/${id}`),
    enabled: !!id,
  });

export const useProjects = () =>
  useQuery({ queryKey: ["projects", "list"], queryFn: () => api.get<ProjectWithCounts[]>("/projects") });

export const useProject = (id: string | undefined) =>
  useQuery({
    queryKey: ["projects", "one", id],
    queryFn: () => api.get<Project>(`/projects/${id}`),
    enabled: !!id,
  });

export const useEvents = () =>
  useQuery({ queryKey: ["events", "list"], queryFn: () => api.get<CalendarEvent[]>("/events") });

export const useEvent = (id: string | undefined) =>
  useQuery({
    queryKey: ["events", "one", id],
    queryFn: () => api.get<CalendarEvent>(`/events/${id}`),
    enabled: !!id,
  });

export const useReferences = (query = "") =>
  useQuery({
    queryKey: ["references", "list", query],
    queryFn: () => api.get<Reference[]>(`/references${query}`),
  });

export const useReference = (id: string | undefined) =>
  useQuery({
    queryKey: ["references", "one", id],
    queryFn: () => api.get<Reference>(`/references/${id}`),
    enabled: !!id,
  });

export const useIncoming = () =>
  useQuery({ queryKey: ["incoming", "list"], queryFn: () => api.get<IncomingItem[]>("/incoming-items") });

export const useWorkspaces = () =>
  useQuery({ queryKey: ["workspaces"], queryFn: () => api.get<Workspace[]>("/workspaces") });

export const useTags = () => useQuery({ queryKey: ["tags"], queryFn: () => api.get<Tag[]>("/tags") });

// ─── mutations ───────────────────────────────────────
export const useCreateTodo = mutation((body: CreateTodo) => api.post<Todo>("/todos", body));
export const useUpdateTodo = mutation(({ id, body }: { id: string; body: UpdateTodo }) =>
  api.patch<Todo>(`/todos/${id}`, body),
);
export const useDeleteTodo = mutation((id: string) => api.del(`/todos/${id}`));

export const useCreateProject = mutation((body: CreateProject) =>
  api.post<ProjectWithCounts>("/projects", body),
);

export const useCreateEvent = mutation((body: CreateEvent) => api.post<CalendarEvent>("/events", body));
export const useUpdateEvent = mutation(({ id, body }: { id: string; body: UpdateEvent }) =>
  api.patch<CalendarEvent>(`/events/${id}`, body),
);
export const useDeleteEvent = mutation((id: string) => api.del(`/events/${id}`));

export const useCreateReference = mutation((body: CreateReference) =>
  api.post<Reference>("/references", body),
);
export const useUpdateReference = mutation(({ id, body }: { id: string; body: UpdateReference }) =>
  api.patch<Reference>(`/references/${id}`, body),
);
export const useDeleteReference = mutation((id: string) => api.del(`/references/${id}`));

export const useQuickCapture = mutation((title: string) =>
  api.post<IncomingItem>("/incoming-items", { title }),
);
export const useTriage = mutation(({ id, body }: { id: string; body: TriageIncoming }) =>
  api.post<IncomingItem>(`/incoming-items/${id}/triage`, body),
);
