import type { GatewayBrowserClient } from "../../gateway.js";

export type TaskStatus = "backlog" | "today" | "next" | "done";
export type TaskPriority = "high" | "medium" | "low";

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  order: number;
  createdAt: number;
  updatedAt: number;
  priority?: TaskPriority;
};

export type TasksData = {
  tasks: Task[];
  lastUpdated: number;
};

const TASKS_FILE = "tasks.json";
const STORAGE_KEY = "openclaw-kanban-tasks"; // Fallback

type FileGetResult = {
  agentId: string;
  workspace: string;
  file: {
    name: string;
    path: string;
    missing: boolean;
    content?: string;
  };
};

// Load tasks from gateway (with localStorage fallback)
export async function loadTasks(gateway: GatewayBrowserClient): Promise<Task[]> {
  try {
    const payload = (await gateway.request("agents.files.get", {
      agentId: "main",
      name: TASKS_FILE,
    })) as FileGetResult;

    if (payload && !payload.file.missing && payload.file.content) {
      const data: TasksData = JSON.parse(payload.file.content);
      // Migrate old tasks without order field
      const tasks = (data.tasks || []).map((t, i) => ({
        ...t,
        order: t.order ?? i * 1000,
      }));
      return tasks;
    }

    // Try localStorage fallback for migration
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data: TasksData = JSON.parse(stored);
      // Migrate to gateway storage
      if (data.tasks?.length) {
        const tasks = data.tasks.map((t, i) => ({
          ...t,
          order: t.order ?? i * 1000,
        }));
        await saveTasks(gateway, tasks);
        localStorage.removeItem(STORAGE_KEY);
        return tasks;
      }
      return data.tasks || [];
    }

    return [];
  } catch (err) {
    console.error("Failed to load tasks:", err);
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: TasksData = JSON.parse(stored);
        return data.tasks || [];
      }
    } catch {
      // ignore
    }
    return [];
  }
}

// Save tasks to gateway (with localStorage fallback)
export async function saveTasks(gateway: GatewayBrowserClient, tasks: Task[]): Promise<boolean> {
  const data: TasksData = {
    tasks,
    lastUpdated: Date.now(),
  };
  const content = JSON.stringify(data, null, 2);

  try {
    await gateway.request("agents.files.set", {
      agentId: "main",
      name: TASKS_FILE,
      content,
    });

    // Clear localStorage if gateway save succeeds
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (err) {
    console.error("Failed to save tasks to gateway:", err);
    // Fallback to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, content);
      return true;
    } catch {
      return false;
    }
  }
}

export function createTask(
  title: string,
  status: TaskStatus = "backlog",
  existingTasks: Task[] = [],
): Task {
  // Find max order in the target status column
  const columnTasks = existingTasks.filter((t) => t.status === status);
  const maxOrder = columnTasks.length > 0 ? Math.max(...columnTasks.map((t) => t.order)) : 0;

  return {
    id: crypto.randomUUID(),
    title,
    status,
    order: maxOrder + 1000,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function updateTask(task: Task, updates: Partial<Task>): Task {
  return {
    ...task,
    ...updates,
    updatedAt: Date.now(),
  };
}

export function moveTask(task: Task, newStatus: TaskStatus, newOrder?: number): Task {
  return updateTask(task, {
    status: newStatus,
    ...(newOrder !== undefined ? { order: newOrder } : {}),
  });
}

export function deleteTask(tasks: Task[], taskId: string): Task[] {
  return tasks.filter((t) => t.id !== taskId);
}

export const COLUMNS: { id: TaskStatus; title: string; color: string }[] = [
  { id: "backlog", title: "Backlog", color: "#6b7280" },
  { id: "today", title: "Today / In Progress", color: "#f59e0b" },
  { id: "next", title: "Next Up", color: "#6366f1" },
  { id: "done", title: "Done", color: "#10b981" },
];

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

export function getTasksByStatus(tasks: Task[], status: TaskStatus): Task[] {
  return tasks.filter((t) => t.status === status).sort((a, b) => a.order - b.order);
}

export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

// Calculate new order for a task being inserted at a specific index
export function calculateOrder(tasks: Task[], insertIndex: number): number {
  if (tasks.length === 0) return 1000;
  if (insertIndex === 0) return tasks[0].order - 1000;
  if (insertIndex >= tasks.length) return tasks[tasks.length - 1].order + 1000;

  const before = tasks[insertIndex - 1].order;
  const after = tasks[insertIndex].order;
  return Math.floor((before + after) / 2);
}
