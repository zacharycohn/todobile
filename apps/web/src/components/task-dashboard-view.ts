import type { Task } from "@todobile/contracts";

export type DashboardTab = "open" | "scheduled" | "closed";
export type UrgencyState = "default" | "due-soon" | "late";
export type AssigneeValue = Task["assignee"];

export function buildDefaultOwnerSelection(currentAssignee: AssigneeValue) {
  return new Set<AssigneeValue>([currentAssignee, "Someone"]);
}

function isFutureDate(value: string | null, today: string) {
  return Boolean(value && value > today);
}

function isTodayOrTomorrow(value: string | null, today: string) {
  if (!value) return false;
  if (value === today) return true;

  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return value === tomorrow.toISOString().slice(0, 10);
}

export function isScheduledTask(task: Task, today: string) {
  if (task.status !== "active") return false;
  return isFutureDate(task.scheduledDate, today) || isFutureDate(task.deadlineDate, today);
}

export function isLateTask(task: Task, today: string) {
  return task.status === "active" && Boolean(task.deadlineDate && task.deadlineDate < today);
}

export function getUrgencyState(task: Task, today: string): UrgencyState {
  if (isLateTask(task, today)) return "late";
  if (
    task.status === "active" &&
    (isTodayOrTomorrow(task.deadlineDate, today) || isTodayOrTomorrow(task.scheduledDate, today))
  ) {
    return "due-soon";
  }

  return "default";
}

export function buildTaskSummary(tasks: Task[], today: string) {
  return {
    open: tasks.filter((task) => task.status === "active").length,
    scheduled: tasks.filter((task) => isScheduledTask(task, today)).length,
    closed: tasks.filter((task) => task.status !== "active").length,
    soon: tasks.filter((task) => getUrgencyState(task, today) === "due-soon").length,
    late: tasks.filter((task) => isLateTask(task, today)).length
  };
}

export function reorderTaskIds(taskIds: string[], sourceId: string, targetId: string) {
  if (sourceId === targetId) return taskIds;

  const next = [...taskIds];
  const sourceIndex = next.indexOf(sourceId);
  const targetIndex = next.indexOf(targetId);

  if (sourceIndex === -1 || targetIndex === -1) {
    return taskIds;
  }

  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

function applyTaskOrder(tasks: Task[], orderedTaskIds: string[]) {
  if (orderedTaskIds.length === 0) {
    return tasks;
  }

  const rank = new Map(orderedTaskIds.map((taskId, index) => [taskId, index]));
  return [...tasks].sort((left, right) => {
    const leftRank = rank.get(left.id);
    const rightRank = rank.get(right.id);

    if (leftRank === undefined && rightRank === undefined) return 0;
    if (leftRank === undefined) return 1;
    if (rightRank === undefined) return -1;
    return leftRank - rightRank;
  });
}

export function getVisibleTasks({
  tasks,
  tab,
  selectedAssignees,
  search,
  today,
  orderedTaskIds
}: {
  tasks: Task[];
  tab: DashboardTab;
  selectedAssignees: Set<AssigneeValue>;
  search: string;
  today: string;
  orderedTaskIds: string[];
}) {
  const normalizedSearch = search.trim().toLowerCase();

  const filtered = tasks.filter((task) => {
    if (tab === "open" && task.status !== "active") return false;
    if (tab === "scheduled" && !isScheduledTask(task, today)) return false;
    if (tab === "closed" && task.status === "active") return false;
    if (!selectedAssignees.has(task.assignee)) return false;
    if (
      normalizedSearch &&
      ![
        task.details.toLowerCase(),
        task.category.toLowerCase(),
        task.assignee.toLowerCase()
      ].some((value) =>
        value.includes(normalizedSearch)
      )
    ) {
      return false;
    }
    return true;
  });

  return applyTaskOrder(filtered, orderedTaskIds);
}
