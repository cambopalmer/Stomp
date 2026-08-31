# Glossary

| Term | Meaning in STOMP |
|---|---|
| **Section** | One of the four top-level areas: Calendar, Todos, Incoming, Learn. Each has a landing page. |
| **Home / hub** | The root screen: banner + one tile per section + the hot sidebar. |
| **Tile** | A card on the home screen linking to a section landing page, showing a count + a few relevant items. |
| **Hot & relevant sidebar** | Persistent right-hand panel. Surfaces: high-priority open todos, items due today, overdue items, un-triaged incoming. Ranked by urgency. |
| **Todo** | A task. Has status, priority, optional `due_at` (deadline) and `scheduled_for` (day you plan to do it), optional parent (subtask), optional assignee and project. |
| **Event** | A calendar entry with start/end, optional recurrence (later), optional external sync fields. |
| **Incoming item** | Something awaiting triage: a quick capture, or a todo/event another user shared to you, or (later) a pulled email. Triage = convert to a todo/event, or dismiss. |
| **Reference** | A link to something to learn. Title, URL, description, learning status, tags. |
| **Project** | A named grouping that can hold todos, events, references, and incoming items. Personal (no workspace) or attached to a workspace. Can be shared. |
| **Workspace** | An optional container with its own members. Items carry a nullable `workspace_id`; `NULL` = personal (private to creator). Workspace membership grants visibility to that workspace's projects. A user can belong to several. |
| **Personal item** | An item with `workspace_id = NULL`. Visible only to its creator (and assignee, and anyone granted an explicit item/project share). |
| **Collaborator / member** | A user granted a role (`owner`/`admin`/`editor`/`viewer` for workspaces; `owner`/`editor`/`viewer` for projects and items) on a workspace, project, or individual top-level item. |
| **Effective role** | For a workspace project: the stronger of the user's workspace role and any per-project role. |
| **Notification** | A reserved record (calendar reminder, past-due, needs-attention, share invite, assignment). Table exists from Phase 0; producers and UI land Phase 2+. |
| **Owner** | The user who created an entity. Always has full access. |
| **Integration account** | A stored connection to an external provider (Gmail, Google Calendar). Designed in v1, activated in a later phase. |
| **Activity log** | Append-only record of who changed what, for audit and change history. |
| **ICM** | Interpretable Context Methodology — the planning approach used in `planning/`. |
| **Today** | For the sidebar and landing pages: `scheduled_for` = today's date in the user's timezone, OR `due_at` within today, OR an event occurring today. |
