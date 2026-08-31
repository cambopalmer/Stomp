import type {
  CalendarEvent,
  CreateProject,
  CreateTodo,
  HomeSummary,
  HotList,
  IncomingItem,
  ProjectWithCounts,
  Reference,
  Todo,
  TodoWithChildren,
  TriageIncoming,
  UpdateTodo,
  Workspace,
} from "@stomp/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api.js";

export const useHomeSummary = () =>
  useQuery({ queryKey: ["home", "summary"], queryFn: () => api.get<HomeSummary>("/home/summary") });

export const useHotList = () =>
  useQuery({ queryKey: ["home", "hot"], queryFn: () => api.get<HotList>("/home/hot") });

export const useTodos = (params = "?topLevel=true") =>
  useQuery({ queryKey: ["todos", params], queryFn: () => api.get<Todo[]>(`/todos${params}`) });

export const useTodo = (id: string | undefined) =>
  useQuery({
    queryKey: ["todos", "one", id],
    queryFn: () => api.get<TodoWithChildren>(`/todos/${id}`),
    enabled: !!id,
  });

export const useProjects = () =>
  useQuery({ queryKey: ["projects"], queryFn: () => api.get<ProjectWithCounts[]>("/projects") });

export const useEvents = () =>
  useQuery({ queryKey: ["events"], queryFn: () => api.get<CalendarEvent[]>("/events") });

export const useReferences = () =>
  useQuery({ queryKey: ["references"], queryFn: () => api.get<Reference[]>("/references") });

export const useIncoming = () =>
  useQuery({ queryKey: ["incoming"], queryFn: () => api.get<IncomingItem[]>("/incoming-items") });

export const useWorkspaces = () =>
  useQuery({ queryKey: ["workspaces"], queryFn: () => api.get<Workspace[]>("/workspaces") });

/** Invalidate everything that a write could have touched. */
function useInvalidateAll() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({
      predicate: (q) =>
        ["home", "todos", "projects", "events", "references", "incoming"].includes(
          q.queryKey[0] as string,
        ),
    });
}

export const useCreateTodo = () => {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: CreateTodo) => api.post<Todo>("/todos", body),
    onSuccess: invalidate,
  });
};

export const useUpdateTodo = () => {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTodo }) =>
      api.patch<Todo>(`/todos/${id}`, body),
    onSuccess: invalidate,
  });
};

export const useDeleteTodo = () => {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => api.del(`/todos/${id}`), onSuccess: invalidate });
};

export const useCreateProject = () => {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: CreateProject) => api.post<ProjectWithCounts>("/projects", body),
    onSuccess: invalidate,
  });
};

export const useQuickCapture = () => {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (title: string) => api.post<IncomingItem>("/incoming-items", { title }),
    onSuccess: invalidate,
  });
};

export const useTriage = () => {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: TriageIncoming }) =>
      api.post<IncomingItem>(`/incoming-items/${id}/triage`, body),
    onSuccess: invalidate,
  });
};
