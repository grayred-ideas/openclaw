import type { GatewayBrowserClient } from "../../gateway.js";

export type TaskStatus = "backlog" | "today" | "next" | "done";

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
  priority?: "high" | "medium" | "low";
};

export type TasksData = {
  tasks: Task[];
  lastUpdated: number;
};

const STORAGE_KEY = "openclaw-kanban-tasks";

// Using localStorage for now (backend tasks.json support requires gateway rebuild)
export async function loadTasks(_gateway: GatewayBrowserClient): Promise<Task[]> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data: TasksData = JSON.parse(stored);
      return data.tasks || [];
    }
    return [];
  } catch (err) {
    console.error("Failed to load tasks:", err);
    return [];
  }
}

export async function saveTasks(_gateway: GatewayBrowserClient, tasks: Task[]): Promise<boolean> {
  try {
    const data: TasksData = {
      tasks,
      lastUpdated: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error("Failed to save tasks:", err);
    return false;
  }
}

export function createTask(title: string, status: TaskStatus = "backlog"): Task {
  return {
    id: crypto.randomUUID(),
    title,
    status,
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

export function moveTask(task: Task, newStatus: TaskStatus): Task {
  return updateTask(task, { status: newStatus });
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

export function getTasksByStatus(tasks: Task[], status: TaskStatus): Task[] {
  return tasks.filter((t) => t.status === status);
}
