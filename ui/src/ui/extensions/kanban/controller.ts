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
  project?: string; // project name/id
  tags?: string[]; // array of tag strings
};

export type Project = {
  id: string;
  name: string;
  color: string;
};

export type Tag = {
  name: string;
  color: string;
};

export type TasksData = {
  tasks: Task[];
  projects: Project[];
  tags: Tag[];
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

// Load full Kanban data from gateway (with localStorage fallback)
export async function loadKanbanData(gateway: GatewayBrowserClient): Promise<TasksData> {
  try {
    const payload = (await gateway.request("agents.files.get", {
      agentId: "main",
      name: TASKS_FILE,
    })) as FileGetResult;

    if (payload && !payload.file.missing && payload.file.content) {
      const data = JSON.parse(payload.file.content);

      // Handle legacy format (just tasks array)
      if (Array.isArray(data)) {
        const tasks = data.map((t: Task, i: number) => ({
          ...t,
          order: t.order ?? i * 1000,
        }));
        const fullData = await migrateToNewFormat(gateway, { tasks, lastUpdated: Date.now() });
        return fullData;
      }

      // Handle legacy TasksData format
      if (data.tasks && !data.projects) {
        const fullData = await migrateToNewFormat(gateway, data);
        return fullData;
      }

      // Modern format
      const tasks = (data.tasks || []).map((t: Task, i: number) => ({
        ...t,
        order: t.order ?? i * 1000,
      }));

      return {
        tasks,
        projects: data.projects || [],
        tags: data.tags || [],
        lastUpdated: data.lastUpdated || Date.now(),
      };
    }

    // Try localStorage fallback for migration
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      // Migrate to gateway storage
      if (data.tasks?.length || Array.isArray(data)) {
        const legacy = Array.isArray(data) ? { tasks: data, lastUpdated: Date.now() } : data;
        const tasks = (legacy.tasks || []).map((t: Task, i: number) => ({
          ...t,
          order: t.order ?? i * 1000,
        }));
        const fullData = await migrateToNewFormat(gateway, { ...legacy, tasks });
        localStorage.removeItem(STORAGE_KEY);
        return fullData;
      }
    }

    // No data found, start with pre-seeded projects
    return await migrateToNewFormat(gateway, { tasks: [], lastUpdated: Date.now() });
  } catch (err) {
    console.error("Failed to load kanban data:", err);
    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const tasks = Array.isArray(data) ? data : data.tasks || [];
        return {
          tasks: tasks.map((t: Task, i: number) => ({ ...t, order: t.order ?? i * 1000 })),
          projects: [],
          tags: [],
          lastUpdated: Date.now(),
        };
      }
    } catch {
      // ignore
    }

    return {
      tasks: [],
      projects: [],
      tags: [],
      lastUpdated: Date.now(),
    };
  }
}

// Load tasks from gateway (legacy function for backwards compatibility)
export async function loadTasks(gateway: GatewayBrowserClient): Promise<Task[]> {
  const data = await loadKanbanData(gateway);
  return data.tasks;
}

// Migrate to new format with projects pre-seeded from workspace
async function migrateToNewFormat(
  gateway: GatewayBrowserClient,
  legacyData: { tasks: Task[]; lastUpdated: number },
): Promise<TasksData> {
  // Pre-seed projects from workspace/projects/ folder
  const projects = await loadProjectsFromWorkspace(gateway);

  const newData: TasksData = {
    tasks: legacyData.tasks,
    projects,
    tags: getInitialTags(),
    lastUpdated: legacyData.lastUpdated,
  };

  // Save the migrated data
  await saveKanbanData(gateway, newData);
  return newData;
}

// Load projects from workspace/projects/ folder
async function loadProjectsFromWorkspace(gateway: GatewayBrowserClient): Promise<Project[]> {
  const projects: Project[] = [];
  const projectColors = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#f97316",
  ];

  try {
    // Get list of files in projects directory
    const result = (await gateway.request("agents.files.list", {
      agentId: "main",
      path: "projects",
    })) as { files: Array<{ name: string; type: "file" | "directory" }> };

    let colorIndex = 0;
    for (const file of result.files || []) {
      if (file.type === "file" && file.name.endsWith(".md") && file.name !== "README.md") {
        const projectName = file.name.replace(/\.md$/, "");
        projects.push({
          id: crypto.randomUUID(),
          name: projectName,
          color: projectColors[colorIndex % projectColors.length],
        });
        colorIndex++;
      }
    }
  } catch (err) {
    console.log("No projects folder found or error reading it:", err);
  }

  return projects;
}

// Get initial tag colors
function getInitialTags(): Tag[] {
  return [
    { name: "urgent", color: "#ef4444" },
    { name: "bug", color: "#f97316" },
    { name: "feature", color: "#10b981" },
    { name: "enhancement", color: "#3b82f6" },
    { name: "documentation", color: "#8b5cf6" },
    { name: "research", color: "#06b6d4" },
    { name: "review", color: "#f59e0b" },
  ];
}

// Save full kanban data to gateway (with localStorage fallback)
export async function saveKanbanData(
  gateway: GatewayBrowserClient,
  data: TasksData,
): Promise<boolean> {
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
    console.error("Failed to save kanban data to gateway:", err);
    // Fallback to localStorage
    try {
      localStorage.setItem(STORAGE_KEY, content);
      return true;
    } catch {
      return false;
    }
  }
}

// Save tasks to gateway (legacy function for backwards compatibility)
export async function saveTasks(gateway: GatewayBrowserClient, tasks: Task[]): Promise<boolean> {
  // This is a legacy function - we'll load existing data and just update tasks
  try {
    const existingData = await loadKanbanData(gateway);
    const newData: TasksData = {
      ...existingData,
      tasks,
      lastUpdated: Date.now(),
    };
    return await saveKanbanData(gateway, newData);
  } catch (err) {
    console.error("Failed in saveTasks:", err);
    return false;
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

// Project management functions
export function createProject(name: string, existingProjects: Project[] = []): Project {
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];
  const usedColors = existingProjects.map((p) => p.color);
  const availableColors = colors.filter((c) => !usedColors.includes(c));
  const color =
    availableColors.length > 0
      ? availableColors[0]
      : colors[existingProjects.length % colors.length];

  return {
    id: crypto.randomUUID(),
    name: name.trim(),
    color,
  };
}

export function updateProject(project: Project, updates: Partial<Project>): Project {
  return { ...project, ...updates };
}

export function deleteProject(projects: Project[], projectId: string): Project[] {
  return projects.filter((p) => p.id !== projectId);
}

// Tag management functions
export function createTag(name: string, existingTags: Tag[] = []): Tag {
  const colors = ["#ef4444", "#f97316", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#6b7280"];
  const usedColors = existingTags.map((t) => t.color);
  const availableColors = colors.filter((c) => !usedColors.includes(c));
  const color =
    availableColors.length > 0 ? availableColors[0] : colors[existingTags.length % colors.length];

  return {
    name: name.trim(),
    color,
  };
}

export function updateTag(tag: Tag, updates: Partial<Tag>): Tag {
  return { ...tag, ...updates };
}

export function deleteTag(tags: Tag[], tagName: string): Tag[] {
  return tags.filter((t) => t.name !== tagName);
}

// Add tag to task description and auto-create if needed
export function processTagsInDescription(
  description: string,
  existingTags: Tag[],
): { description: string; newTags: Tag[] } {
  const tagRegex = /#(\w+)/g;
  const matches = Array.from(description.matchAll(tagRegex));
  const newTags: Tag[] = [];

  for (const match of matches) {
    const tagName = match[1];
    const tagExists = existingTags.some((t) => t.name === tagName);
    const newTagExists = newTags.some((t) => t.name === tagName);

    if (!tagExists && !newTagExists) {
      newTags.push(createTag(tagName, [...existingTags, ...newTags]));
    }
  }

  return { description, newTags };
}

// Filtering functions
export type TaskFilter = {
  project?: string;
  tags?: string[];
  priority?: TaskPriority;
};

export function filterTasks(tasks: Task[], filter: TaskFilter): Task[] {
  return tasks.filter((task) => {
    // Project filter
    if (filter.project && filter.project !== "all") {
      if (!task.project || task.project !== filter.project) {
        return false;
      }
    }

    // Tag filter
    if (filter.tags && filter.tags.length > 0) {
      const taskTags = task.tags || [];
      const hasAllTags = filter.tags.every((filterTag) => taskTags.includes(filterTag));
      if (!hasAllTags) {
        return false;
      }
    }

    // Priority filter
    if (filter.priority) {
      if (task.priority !== filter.priority) {
        return false;
      }
    }

    return true;
  });
}

// Get project stats
export function getProjectStats(
  tasks: Task[],
  projectId: string,
): { total: number; done: number; inProgress: number } {
  const projectTasks = tasks.filter((t) => t.project === projectId);
  return {
    total: projectTasks.length,
    done: projectTasks.filter((t) => t.status === "done").length,
    inProgress: projectTasks.filter((t) => t.status === "today").length,
  };
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
