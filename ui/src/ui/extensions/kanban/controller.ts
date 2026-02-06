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

const TASKS_FILE = "tasks.json";

export async function loadTasks(gateway: GatewayBrowserClient): Promise<Task[]> {
  try {
    const result = await gateway.call("agents.files.get", {
      agentId: "main",
      name: TASKS_FILE,
    });

    if (result.ok && result.payload) {
      const file = (result.payload as { file: { content?: string } }).file;
      if (file.content) {
        const data: TasksData = JSON.parse(file.content);
        return data.tasks || [];
      }
    }
    return [];
  } catch (err) {
    console.error("Failed to load tasks:", err);
    return [];
  }
}

export async function saveTasks(gateway: GatewayBrowserClient, tasks: Task[]): Promise<boolean> {
  try {
    const data: TasksData = {
      tasks,
      lastUpdated: Date.now(),
    };

    const result = await gateway.call("agents.files.set", {
      agentId: "main",
      name: TASKS_FILE,
      content: JSON.stringify(data, null, 2),
    });

    return result.ok === true;
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
