import type { GatewayBrowserClient } from "../../gateway.js";

export type WorkspaceFile = {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
  content?: string;
};

export type WorkspaceFolder = {
  name: string;
  path: string;
  updatedAtMs?: number;
};

export type FolderListResult = {
  agentId: string;
  workspace: string;
  basePath: string;
  folders: WorkspaceFolder[];
  files: WorkspaceFile[];
};

export type FileGetResult = {
  agentId: string;
  workspace: string;
  file: WorkspaceFile;
};

export async function listWorkspaceContents(
  gateway: GatewayBrowserClient,
  path = "",
  agentId = "main",
): Promise<FolderListResult | null> {
  try {
    const result = await gateway.request("agents.folders.list", {
      agentId,
      path: path || undefined,
      includeFiles: true,
    });
    if (result) {
      return result as FolderListResult;
    }
    return null;
  } catch (err) {
    console.error("Failed to list workspace contents:", err);
    return null;
  }
}

export async function getWorkspaceFile(
  gateway: GatewayBrowserClient,
  filePath: string,
  agentId = "main",
): Promise<FileGetResult | null> {
  try {
    const result = await gateway.request("agents.files.read", { agentId, path: filePath });
    if (result) {
      return result as FileGetResult;
    }
    return null;
  } catch (err) {
    console.error("Failed to get workspace file:", err);
    return null;
  }
}

export async function saveWorkspaceFile(
  gateway: GatewayBrowserClient,
  filePath: string,
  content: string,
  agentId = "main",
): Promise<boolean> {
  try {
    await gateway.request("agents.files.write", { agentId, path: filePath, content });
    return true;
  } catch (err) {
    console.error("Failed to save workspace file:", err);
    return false;
  }
}

export async function deleteWorkspaceFile(
  gateway: GatewayBrowserClient,
  filePath: string,
  agentId = "main",
): Promise<boolean> {
  try {
    await gateway.request("agents.files.delete", { agentId, path: filePath });
    return true;
  } catch (err) {
    console.error("Failed to delete workspace file:", err);
    return false;
  }
}

export async function createWorkspaceFolder(
  gateway: GatewayBrowserClient,
  folderPath: string,
  agentId = "main",
): Promise<boolean> {
  try {
    await gateway.request("agents.folders.create", { agentId, path: folderPath });
    return true;
  } catch (err) {
    console.error("Failed to create workspace folder:", err);
    return false;
  }
}

export function joinPath(basePath: string, name: string): string {
  if (!basePath || basePath === "/") return name;
  return `${basePath}/${name}`;
}

export function getParentPath(currentPath: string): string {
  if (!currentPath || currentPath === "/" || currentPath === "") return "";
  const parts = currentPath.split("/").filter((p) => p);
  return parts.slice(0, -1).join("/");
}

export function getPathBreadcrumbs(currentPath: string): { name: string; path: string }[] {
  const breadcrumbs = [{ name: "Workspace", path: "" }];

  if (currentPath && currentPath !== "/") {
    const parts = currentPath.split("/").filter((p) => p);
    let path = "";
    for (const part of parts) {
      path = path ? `${path}/${part}` : part;
      breadcrumbs.push({ name: part, path });
    }
  }

  return breadcrumbs;
}

export type SearchResult = {
  path: string;
  name: string;
  type: "filename" | "content";
  matches: Array<{ line: number; snippet: string }>;
};

export type SearchResponse = {
  agentId: string;
  query: string;
  results: SearchResult[];
  total: number;
};

export async function searchWorkspaceFiles(
  gateway: GatewayBrowserClient,
  query: string,
  agentId = "main",
): Promise<SearchResponse | null> {
  try {
    const result = await gateway.request("agents.files.search", {
      agentId,
      query,
      searchContent: true,
      maxResults: 50,
    });
    if (result) {
      return result as SearchResponse;
    }
    return null;
  } catch (err) {
    console.error("Failed to search workspace:", err);
    return null;
  }
}

export async function renameWorkspaceFile(
  gateway: GatewayBrowserClient,
  oldPath: string,
  newPath: string,
  agentId = "main",
): Promise<boolean> {
  try {
    // Read old file content
    const result = await getWorkspaceFile(gateway, oldPath, agentId);
    if (!result?.file.content && result?.file.content !== "") return false;

    // Write to new path
    const saved = await saveWorkspaceFile(gateway, newPath, result.file.content ?? "", agentId);
    if (!saved) return false;

    // Delete old file
    await deleteWorkspaceFile(gateway, oldPath, agentId);
    return true;
  } catch (err) {
    console.error("Failed to rename workspace file:", err);
    return false;
  }
}
