import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

/** null = "Personal" (workspace_id IS NULL). A string is a workspace id. */
type ActiveWorkspace = string | null;
const KEY = "stomp.workspace";

interface Ctx {
  active: ActiveWorkspace;
  setActive: (w: ActiveWorkspace) => void;
  /** Query-string fragment for list endpoints: "" | "&workspaceId=personal" | "&workspaceId=<id>". */
  qs: string;
}

const WorkspaceContext = createContext<Ctx>({ active: null, setActive: () => {}, qs: "" });

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [active, setActiveState] = useState<ActiveWorkspace>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v && v !== "personal" ? v : null;
    } catch {
      return null;
    }
  });

  const setActive = (w: ActiveWorkspace) => {
    setActiveState(w);
    try {
      localStorage.setItem(KEY, w ?? "personal");
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    /* no-op: value is already persisted in setActive */
  }, [active]);

  const qs = active === null ? "&workspaceId=personal" : `&workspaceId=${active}`;

  return (
    <WorkspaceContext.Provider value={{ active, setActive, qs }}>{children}</WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
