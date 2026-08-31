import type {
  CalendarEvent,
  CreateEvent,
  CreateProject,
  CreateReference,
  CreateTodo,
  CreateWorkspace,
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
  CollaboratorView,
  ShareInput,
  Workspace,
  WorkspaceMemberView,
} from "@stomp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api.js";
import { useWorkspace } from "./workspace.js";

/** Append the active-workspace filter to a list path (`base` may already have a `?query`). */
function useWsPath(base: string): string {
  const { qs } = useWorkspace();
  return base.includes("?") ? `${base}${qs}` : `${base}?${qs.slice(1)}`;
}

const WRITE_KEYS = [
  "home", "todos", "projects", "events", "references", "incoming",
  "tags", "activity", "workspaces", "collab", "shared-with-me", "notifications",
];

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

export const useTodos = (query = "?topLevel=true") => {
  const path = useWsPath(`/todos${query}`);
  return useQuery({ queryKey: ["todos", "list", path], queryFn: () => api.get<Todo[]>(path) });
};

export const useTodo = (id: string | undefined) =>
  useQuery({
    queryKey: ["todos", "one", id],
    queryFn: () => api.get<TodoWithChildren>(`/todos/${id}`),
    enabled: !!id,
  });

export const useProjects = () => {
  const path = useWsPath("/projects");
  return useQuery({ queryKey: ["projects", "list", path], queryFn: () => api.get<ProjectWithCounts[]>(path) });
};

export const useProject = (id: string | undefined) =>
  useQuery({
    queryKey: ["projects", "one", id],
    queryFn: () => api.get<Project>(`/projects/${id}`),
    enabled: !!id,
  });

export const useEvents = () => {
  const path = useWsPath("/events");
  return useQuery({ queryKey: ["events", "list", path], queryFn: () => api.get<CalendarEvent[]>(path) });
};

export const useEvent = (id: string | undefined) =>
  useQuery({
    queryKey: ["events", "one", id],
    queryFn: () => api.get<CalendarEvent>(`/events/${id}`),
    enabled: !!id,
  });

export const useReferences = (query = "") => {
  const path = useWsPath(`/references${query}`);
  return useQuery({ queryKey: ["references", "list", path], queryFn: () => api.get<Reference[]>(path) });
};

export const useReference = (id: string | undefined) =>
  useQuery({
    queryKey: ["references", "one", id],
    queryFn: () => api.get<Reference>(`/references/${id}`),
    enabled: !!id,
  });

export const useIncoming = () => {
  const path = useWsPath("/incoming-items");
  return useQuery({ queryKey: ["incoming", "list", path], queryFn: () => api.get<IncomingItem[]>(path) });
};

export const useWorkspaces = () =>
  useQuery({ queryKey: ["workspaces"], queryFn: () => api.get<Workspace[]>("/workspaces") });

export const useWorkspaceMembers = (id: string | undefined) =>
  useQuery({
    queryKey: ["workspaces", "members", id],
    queryFn: () => api.get<WorkspaceMemberView[]>(`/workspaces/${id}/members`),
    enabled: !!id,
  });

export const useCreateWorkspace = mutation((body: CreateWorkspace) =>
  api.post<Workspace>("/workspaces", body),
);
export const useAddWorkspaceMember = mutation(
  ({ id, body }: { id: string; body: { email: string; role: string } }) =>
    api.post(`/workspaces/${id}/members`, body),
);

export const useTags = () => useQuery({ queryKey: ["tags"], queryFn: () => api.get<Tag[]>("/tags") });

export const useTagItems = (tagId: string | undefined) =>
  useQuery({
    queryKey: ["tags", "items", tagId],
    queryFn: () =>
      api.get<{ tag: Tag; todos: Todo[]; events: CalendarEvent[]; references: Reference[] }>(
        `/tags/${tagId}/items`,
      ),
    enabled: !!tagId,
  });

export const useEntityTags = (entityType: string, entityId: string | undefined) =>
  useQuery({
    queryKey: ["tags", "entity", entityType, entityId],
    queryFn: () => api.get<Tag[]>(`/taggings?entityType=${entityType}&entityId=${entityId}`),
    enabled: !!entityId,
  });

// ─── sharing ─────────────────────────────────────────
export const useCollaborators = (kind: "todo" | "event" | "reference", id: string | undefined) =>
  useQuery({
    queryKey: ["collab", kind, id],
    queryFn: () => api.get<CollaboratorView[]>(`/${kind}s/${id}/collaborators`),
    enabled: !!id,
  });

export const useSharedWithMe = () =>
  useQuery({
    queryKey: ["shared-with-me"],
    queryFn: () =>
      api.get<{ todos: Todo[]; events: CalendarEvent[]; references: Reference[] }>("/shared-with-me"),
  });

export const useAddCollaborator = mutation(
  ({ kind, id, body }: { kind: string; id: string; body: ShareInput }) =>
    api.post(`/${kind}s/${id}/collaborators`, body),
);
export const useRemoveCollaborator = mutation(
  ({ kind, id, userId }: { kind: string; id: string; userId: string }) =>
    api.del(`/${kind}s/${id}/collaborators/${userId}`),
);

// ─── notifications ───────────────────────────────────
export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: number;
  read: boolean;
  transient: boolean;
}

export const useNotifications = () =>
  useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<{ items: NotificationItem[]; unread: number }>("/notifications"),
    refetchInterval: 60_000,
  });

export const useMarkNotificationRead = mutation((id: string) =>
  api.post(`/notifications/${id}/read`),
);
export const useMarkAllNotificationsRead = mutation(() => api.post("/notifications/read-all"));

export const useActivity = (entityType: string, entityId: string | undefined) =>
  useQuery({
    queryKey: ["activity", entityType, entityId],
    queryFn: () =>
      api.get<{ id: string; action: string; actor: string | null; createdAt: number }[]>(
        `/activity?entityType=${entityType}&entityId=${entityId}`,
      ),
    enabled: !!entityId,
  });

type TagLink = { tagId: string; entityType: string; entityId: string };
export const useApplyTag = mutation((body: TagLink) => api.post("/taggings", body));
export const useRemoveTag = mutation((body: TagLink) => api.del("/taggings", body));
export const useCreateTag = mutation((name: string) => api.post<Tag>("/tags", { name }));

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

export const useQuickCapture = () => {
  const invalidate = useInvalidateAll();
  const { active } = useWorkspace();
  return useMutation({
    mutationFn: (title: string) =>
      api.post<IncomingItem>("/incoming-items", { title, workspaceId: active ?? undefined }),
    onSuccess: invalidate,
  });
};
export const useTriage = mutation(({ id, body }: { id: string; body: TriageIncoming }) =>
  api.post<IncomingItem>(`/incoming-items/${id}/triage`, body),
);
