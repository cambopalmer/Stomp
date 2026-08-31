# IDENTITY — STOMP (ICM Layer 0)

## What STOMP is

A lightweight, self-hostable personal hub that unifies four things a person juggles daily:

1. **Calendar** — events, today's schedule, later synced with Google/external calendars.
2. **Todos** — tasks with priority, due dates, scheduling, subtasks, assignment.
3. **Incoming** — a triage inbox: quick-capture notes + tasks/events shared to you by others + (later) pulled emails. You process each item into a todo/event or dismiss it.
4. **Learn library** — a tagged link library of references to study, with a learning status.

All four are grouped by **Projects**, which can be **shared** between users. The home screen is a banner + a tile per section; a persistent **"hot & relevant" sidebar** surfaces high-priority, due-today, and overdue items across every section.

## Who it's for

- **Primary user:** the owner (a technical person from a .NET/C#/SQL background) running it locally first, then on cheap hosting.
- **Secondary users:** a small number of people (partner, collaborators) who share specific projects, tasks, and events.
- Not a team/enterprise product. No org hierarchy, no admin console beyond what's needed.

## What STOMP is NOT (v1)

- Not a full email client. Email integration is an inbound feed + basic send, designed now and built in a later phase.
- Not a real-time collaborative editor. Sharing = access + refresh, not live cursors.
- Not a mobile app. Responsive web only.
- Not a note-taking / wiki product. References are links with light metadata, not documents.
- Not multi-tenant SaaS. One deployment = one small circle of trusted users.

## Guiding principles

- **Light foundation, easy to read.** Boring, well-layered code over clever abstractions.
- **Schema-complete, feature-incremental.** The data model supports multi-user, sharing, projects, and integrations from day one; the UI fills in over phases.
- **Portable.** SQLite + a container. No hard dependency on a specific cloud.
- **Human review gates.** Plan before build; resolve open questions first.
