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
    const result = await gateway.call("agents.files.list", { agentId });
    if (result.ok && result.payload) {
      return result.payload as FileListResult;
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
    const result = await gateway.call("agents.files.get", { agentId, name: fileName });
    if (result.ok && result.payload) {
      return result.payload as FileGetResult;
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
    const result = await gateway.call("agents.files.set", { agentId, name: fileName, content });
    return result.ok === true;
  } catch (err) {
    console.error("Failed to save workspace file:", err);
    return false;
  }
}
