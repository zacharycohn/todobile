import type { Task } from "@todobile/contracts";
import { describe, expect, it } from "vitest";

import {
  buildDefaultOwnerSelection,
  buildTaskSummary,
  getUrgencyState,
  getVisibleTasks,
  reorderTaskIds
} from "./task-dashboard-view";

const baseTask: Task = {
  id: "11111111-1111-4111-8111-111111111111",
  familyId: "22222222-2222-4222-8222-222222222222",
  details: "Base task",
  category: "do",
  assignee: "Someone",
  status: "active",
  deadlineDate: null,
  scheduledDate: null,
  urls: [],
  createdAt: "2026-04-10T08:00:00.000Z",
  createdByUserId: "33333333-3333-4333-8333-333333333333",
  updatedAt: "2026-04-10T08:00:00.000Z",
  completedAt: null,
  deletedAt: null
};

function createTask(overrides: Partial<Task>): Task {
  return {
    ...baseTask,
    ...overrides
  };
}

describe("task dashboard view helpers", () => {
  it("defaults owner selection to the current user and Somebody", () => {
    expect([...buildDefaultOwnerSelection("Zac")]).toEqual(["Zac", "Someone"]);
    expect([...buildDefaultOwnerSelection("Lauryl")]).toEqual(["Lauryl", "Someone"]);
  });

  it("builds summary counts across open, scheduled, closed, soon, and late slices", () => {
    const tasks = [
      createTask({
        id: "11111111-1111-4111-8111-111111111111",
        details: "Open no dates",
        assignee: "Zac"
      }),
      createTask({
        id: "11111111-1111-4111-8111-111111111112",
        details: "Scheduled",
        assignee: "Someone",
        scheduledDate: "2026-04-15"
      }),
      createTask({
        id: "11111111-1111-4111-8111-111111111113",
        details: "Future due",
        assignee: "Lauryl",
        deadlineDate: "2026-04-20"
      }),
      createTask({
        id: "11111111-1111-4111-8111-111111111114",
        details: "Late task",
        assignee: "Someone",
        deadlineDate: "2026-04-13"
      }),
      createTask({
        id: "11111111-1111-4111-8111-111111111116",
        details: "Soon task",
        assignee: "Someone",
        deadlineDate: "2026-04-15"
      }),
      createTask({
        id: "11111111-1111-4111-8111-111111111115",
        details: "Closed task",
        assignee: "Zac",
        status: "completed",
        completedAt: "2026-04-10T09:00:00.000Z"
      })
    ];

    expect(buildTaskSummary(tasks, "2026-04-14")).toEqual({
      open: 5,
      scheduled: 3,
      closed: 1,
      soon: 2,
      late: 1
    });
  });

  it("returns scheduled tasks only when their dates are in the future", () => {
    const tasks = [
      createTask({
        id: "11111111-1111-4111-8111-111111111121",
        details: "Future scheduled",
        scheduledDate: "2026-04-16",
        assignee: "Zac"
      }),
      createTask({
        id: "11111111-1111-4111-8111-111111111122",
        details: "Future deadline",
        deadlineDate: "2026-04-20",
        assignee: "Someone"
      }),
      createTask({
        id: "11111111-1111-4111-8111-111111111123",
        details: "Today scheduled",
        scheduledDate: "2026-04-14",
        assignee: "Zac"
      }),
      createTask({
        id: "11111111-1111-4111-8111-111111111124",
        details: "Archived scheduled",
        status: "completed",
        scheduledDate: "2026-04-18",
        completedAt: "2026-04-12T08:00:00.000Z"
      })
    ];

    const visible = getVisibleTasks({
      tasks,
      tab: "scheduled",
      selectedAssignees: new Set(["Zac", "Someone", "Lauryl"]),
      search: "",
      today: "2026-04-14",
      orderedTaskIds: []
    });

    expect(visible.map((task) => task.details)).toEqual(["Future scheduled", "Future deadline"]);
  });

  it("filters by selected owners and search text for open tasks", () => {
    const tasks = [
      createTask({
        id: "11111111-1111-4111-8111-111111111131",
        details: "Pick up medicine",
        assignee: "Zac"
      }),
      createTask({
        id: "11111111-1111-4111-8111-111111111132",
        details: "Buy paper towels",
        assignee: "Someone"
      }),
      createTask({
        id: "11111111-1111-4111-8111-111111111133",
        details: "Call daycare",
        assignee: "Lauryl"
      })
    ];

    const visible = getVisibleTasks({
      tasks,
      tab: "open",
      selectedAssignees: new Set(["Zac", "Someone"]),
      search: "paper",
      today: "2026-04-14",
      orderedTaskIds: []
    });

    expect(visible.map((task) => task.details)).toEqual(["Buy paper towels"]);
  });

  it("matches search text against category tags as well as task details", () => {
    const tasks = [
      createTask({
        id: "11111111-1111-4111-8111-111111111161",
        details: "Pick up medicine",
        category: "do",
        assignee: "Zac"
      }),
      createTask({
        id: "11111111-1111-4111-8111-111111111162",
        details: "Buy paper towels",
        category: "buy",
        assignee: "Someone"
      })
    ];

    const visible = getVisibleTasks({
      tasks,
      tab: "open",
      selectedAssignees: new Set(["Zac", "Someone"]),
      search: "buy",
      today: "2026-04-14",
      orderedTaskIds: []
    });

    expect(visible.map((task) => task.details)).toEqual(["Buy paper towels"]);
  });

  it("matches search text against assignee labels too", () => {
    const tasks = [
      createTask({
        id: "11111111-1111-4111-8111-111111111171",
        details: "Pick up medicine",
        category: "do",
        assignee: "Zac"
      }),
      createTask({
        id: "11111111-1111-4111-8111-111111111172",
        details: "Buy paper towels",
        category: "buy",
        assignee: "Someone"
      })
    ];

    const visible = getVisibleTasks({
      tasks,
      tab: "open",
      selectedAssignees: new Set(["Zac", "Someone"]),
      search: "zac",
      today: "2026-04-14",
      orderedTaskIds: []
    });

    expect(visible.map((task) => task.details)).toEqual(["Pick up medicine"]);
  });

  it("applies local task ordering before rendering visible rows", () => {
    const tasks = [
      createTask({
        id: "11111111-1111-4111-8111-111111111141",
        details: "First",
        assignee: "Zac"
      }),
      createTask({
        id: "11111111-1111-4111-8111-111111111142",
        details: "Second",
        assignee: "Someone"
      }),
      createTask({
        id: "11111111-1111-4111-8111-111111111143",
        details: "Third",
        assignee: "Zac"
      })
    ];

    const reordered = reorderTaskIds(
      tasks.map((task) => task.id),
      "11111111-1111-4111-8111-111111111143",
      "11111111-1111-4111-8111-111111111141"
    );

    const visible = getVisibleTasks({
      tasks,
      tab: "open",
      selectedAssignees: new Set(["Zac", "Someone"]),
      search: "",
      today: "2026-04-14",
      orderedTaskIds: reordered
    });

    expect(visible.map((task) => task.details)).toEqual(["Third", "First", "Second"]);
  });

  it("classifies urgency for late and due-soon tasks", () => {
    expect(
      getUrgencyState(
        createTask({
          id: "11111111-1111-4111-8111-111111111151",
          deadlineDate: "2026-04-13"
        }),
        "2026-04-14"
      )
    ).toBe("late");

    expect(
      getUrgencyState(
        createTask({
          id: "11111111-1111-4111-8111-111111111152",
          deadlineDate: "2026-04-15"
        }),
        "2026-04-14"
      )
    ).toBe("due-soon");

    expect(
      getUrgencyState(
        createTask({
          id: "11111111-1111-4111-8111-111111111153",
          scheduledDate: "2026-04-20"
        }),
        "2026-04-14"
      )
    ).toBe("default");
  });
});
