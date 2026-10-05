import type { CalendarEvent, Todo } from "@stomp/shared";
import { describe, expect, it } from "vitest";
import {
  addDays,
  groupByDay,
  isCalendarTodo,
  isOverdue,
  parseShow,
  startOfDay,
  todosOnDay,
} from "./calendar.js";

// all dates local-time, to match the calendar's own day math
const DAY = new Date(2031, 0, 15); // a Wednesday
const at = (d: Date, h = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h).getTime();

const todo = (over: Partial<Todo> = {}): Todo => ({
  id: over.title ?? "t",
  workspaceId: null,
  title: "t",
  notes: null,
  status: "open",
  priority: "none",
  dueAt: at(DAY),
  scheduledFor: null,
  completedAt: null,
  projectId: null,
  parentTodoId: null,
  createdBy: "u",
  assigneeId: null,
  source: "manual",
  sortOrder: 0,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

const event = (title: string, startsAt: number): CalendarEvent =>
  ({ id: title, title, startsAt, endsAt: startsAt + 3_600_000, allDay: false }) as CalendarEvent;

describe("parseShow", () => {
  it("accepts events / todos and defaults everything else to all", () => {
    expect(parseShow("events")).toBe("events");
    expect(parseShow("todos")).toBe("todos");
    expect(parseShow(null)).toBe("all");
    expect(parseShow("bogus")).toBe("all");
  });
});

describe("isCalendarTodo", () => {
  it("needs a due date and an open-ish status", () => {
    expect(isCalendarTodo(todo())).toBe(true);
    expect(isCalendarTodo(todo({ status: "in_progress" }))).toBe(true);
    expect(isCalendarTodo(todo({ status: "blocked" }))).toBe(true);
    expect(isCalendarTodo(todo({ dueAt: null }))).toBe(false);
    expect(isCalendarTodo(todo({ status: "done" }))).toBe(false);
    expect(isCalendarTodo(todo({ status: "cancelled" }))).toBe(false);
  });
});

describe("isOverdue", () => {
  const now = at(DAY, 15);
  it("is due before today's local midnight", () => {
    expect(isOverdue(todo({ dueAt: at(addDays(DAY, -1)) }), now)).toBe(true);
    expect(isOverdue(todo({ dueAt: at(DAY) }), now)).toBe(false); // due today, not overdue yet
    expect(isOverdue(todo({ dueAt: at(addDays(DAY, 1)) }), now)).toBe(false);
  });
  it("never for finished todos", () => {
    expect(isOverdue(todo({ dueAt: at(addDays(DAY, -3)), status: "done" }), now)).toBe(false);
  });
});

describe("todosOnDay", () => {
  it("keeps open todos due within that local day, priority then title", () => {
    const list = [
      todo({ title: "b-low", priority: "low", dueAt: at(DAY, 9) }),
      todo({ title: "a-low", priority: "low", dueAt: at(DAY, 23) }),
      todo({ title: "urgent", priority: "urgent", dueAt: at(DAY) }),
      todo({ title: "tomorrow", dueAt: at(addDays(DAY, 1)) }),
      todo({ title: "done", status: "done" }),
      todo({ title: "undated", dueAt: null }),
    ];
    expect(todosOnDay(list, DAY).map((t) => t.title)).toEqual(["urgent", "a-low", "b-low"]);
  });
});

describe("groupByDay", () => {
  it("merges events and due todos into chronological day groups", () => {
    const tomorrow = addDays(DAY, 1);
    const groups = groupByDay(
      [event("late", at(tomorrow, 18)), event("early", at(DAY, 8))],
      [todo({ title: "due-tomorrow", dueAt: at(tomorrow) }), todo({ title: "finished", status: "done" })],
    );
    expect(groups.map((g) => g.day)).toEqual([startOfDay(DAY).getTime(), startOfDay(tomorrow).getTime()]);
    expect(groups[0]!.events.map((e) => e.title)).toEqual(["early"]);
    expect(groups[0]!.todos).toEqual([]); // the done todo is not a calendar item
    expect(groups[1]!.todos.map((t) => t.title)).toEqual(["due-tomorrow"]);
  });

  it("a day with only a todo still gets a group", () => {
    const groups = groupByDay([], [todo({ title: "solo" })]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.events).toEqual([]);
  });
});
