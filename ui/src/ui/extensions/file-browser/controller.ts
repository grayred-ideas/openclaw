import type { GatewayBrowserClient } from "../../gateway.js";

export type WorkspaceFile = {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
  content?: string;
};

export type FileListResult = {
  agentId: string;
  workspace: string;
  files: WorkspaceFile[];
};

export type FileGetResult = {
  agentId: string;
  workspace: string;
  file: WorkspaceFile;
};

export async function listWorkspaceFiles(
  gateway: GatewayBrowserClient,
  agentId = "main",
): Promise<FileListResult | null> {
  try {
    const result = await gateway.request("agents.files.list", { agentId });
    if (result) {
      return result as FileListResult;
    }
    return null;
  } catch (err) {
    console.error("Failed to list workspace files:", err);
    return null;
  }
}

export async function getWorkspaceFile(
  gateway: GatewayBrowserClient,
  fileName: string,
  agentId = "main",
): Promise<FileGetResult | null> {
  try {
    const result = await gateway.request("agents.files.get", { agentId, name: fileName });
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
  fileName: string,
  content: string,
  agentId = "main",
): Promise<boolean> {
  try {
    await gateway.request("agents.files.set", { agentId, name: fileName, content });
    return true;
  } catch (err) {
    console.error("Failed to save workspace file:", err);
    return false;
  }
}

export async function deleteWorkspaceFile(
  gateway: GatewayBrowserClient,
  fileName: string,
  agentId = "main",
): Promise<boolean> {
  try {
    await gateway.request("agents.files.delete", { agentId, name: fileName });
    return true;
  } catch (err) {
    console.error("Failed to delete workspace file:", err);
    return false;
  }
}

export async function renameWorkspaceFile(
  gateway: GatewayBrowserClient,
  oldName: string,
  newName: string,
  agentId = "main",
): Promise<boolean> {
  try {
    await gateway.request("agents.files.rename", { agentId, name: oldName, newName });
    return true;
  } catch (err) {
    console.error("Failed to rename workspace file:", err);
    return false;
  }
}
