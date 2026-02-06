import fs from "node:fs/promises";
import path from "node:path";
import type { GatewayRequestHandlers } from "./types.js";
import { listAgentIds, resolveAgentWorkspaceDir } from "../../agents/agent-scope.js";
import {
  DEFAULT_AGENTS_FILENAME,
  DEFAULT_BOOTSTRAP_FILENAME,
  DEFAULT_HEARTBEAT_FILENAME,
  DEFAULT_IDENTITY_FILENAME,
  DEFAULT_MEMORY_ALT_FILENAME,
  DEFAULT_MEMORY_FILENAME,
  DEFAULT_SOUL_FILENAME,
  DEFAULT_TOOLS_FILENAME,
  DEFAULT_USER_FILENAME,
} from "../../agents/workspace.js";
import { loadConfig } from "../../config/config.js";
import { normalizeAgentId } from "../../routing/session-key.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateAgentsFilesGetParams,
  validateAgentsFilesListParams,
  validateAgentsFilesSetParams,
  validateAgentsListParams,
  validateAgentsFoldersListParams,
  validateAgentsFoldersCreateParams,
  validateAgentsFoldersDeleteParams,
  validateAgentsFilesUploadParams,
  validateAgentsFilesReadParams,
  validateAgentsFilesWriteParams,
  validateAgentsFilesDeleteParams,
} from "../protocol/index.js";
import { listAgentsForGateway } from "../session-utils.js";

const BOOTSTRAP_FILE_NAMES = [
  DEFAULT_AGENTS_FILENAME,
  DEFAULT_SOUL_FILENAME,
  DEFAULT_TOOLS_FILENAME,
  DEFAULT_IDENTITY_FILENAME,
  DEFAULT_USER_FILENAME,
  DEFAULT_HEARTBEAT_FILENAME,
  DEFAULT_BOOTSTRAP_FILENAME,
] as const;

const MEMORY_FILE_NAMES = [DEFAULT_MEMORY_FILENAME, DEFAULT_MEMORY_ALT_FILENAME] as const;

const CUSTOM_FILE_NAMES = ["tasks.json"] as const;

const ALLOWED_FILE_NAMES = new Set<string>([
  ...BOOTSTRAP_FILE_NAMES,
  ...MEMORY_FILE_NAMES,
  ...CUSTOM_FILE_NAMES,
]);

type FileMeta = {
  size: number;
  updatedAtMs: number;
};

type DirMeta = {
  updatedAtMs: number;
};

async function statFile(filePath: string): Promise<FileMeta | null> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return null;
    }
    return {
      size: stat.size,
      updatedAtMs: Math.floor(stat.mtimeMs),
    };
  } catch {
    return null;
  }
}

async function statDir(dirPath: string): Promise<DirMeta | null> {
  try {
    const stat = await fs.stat(dirPath);
    if (!stat.isDirectory()) {
      return null;
    }
    return {
      updatedAtMs: Math.floor(stat.mtimeMs),
    };
  } catch {
    return null;
  }
}

async function listAgentFiles(workspaceDir: string) {
  const files: Array<{
    name: string;
    path: string;
    missing: boolean;
    size?: number;
    updatedAtMs?: number;
  }> = [];

  for (const name of BOOTSTRAP_FILE_NAMES) {
    const filePath = path.join(workspaceDir, name);
    const meta = await statFile(filePath);
    if (meta) {
      files.push({
        name,
        path: filePath,
        missing: false,
        size: meta.size,
        updatedAtMs: meta.updatedAtMs,
      });
    } else {
      files.push({ name, path: filePath, missing: true });
    }
  }

  const primaryMemoryPath = path.join(workspaceDir, DEFAULT_MEMORY_FILENAME);
  const primaryMeta = await statFile(primaryMemoryPath);
  if (primaryMeta) {
    files.push({
      name: DEFAULT_MEMORY_FILENAME,
      path: primaryMemoryPath,
      missing: false,
      size: primaryMeta.size,
      updatedAtMs: primaryMeta.updatedAtMs,
    });
  } else {
    const altMemoryPath = path.join(workspaceDir, DEFAULT_MEMORY_ALT_FILENAME);
    const altMeta = await statFile(altMemoryPath);
    if (altMeta) {
      files.push({
        name: DEFAULT_MEMORY_ALT_FILENAME,
        path: altMemoryPath,
        missing: false,
        size: altMeta.size,
        updatedAtMs: altMeta.updatedAtMs,
      });
    } else {
      files.push({ name: DEFAULT_MEMORY_FILENAME, path: primaryMemoryPath, missing: true });
    }
  }

  // Custom files (only shown if they exist)
  for (const name of CUSTOM_FILE_NAMES) {
    const filePath = path.join(workspaceDir, name);
    const meta = await statFile(filePath);
    if (meta) {
      files.push({
        name,
        path: filePath,
        missing: false,
        size: meta.size,
        updatedAtMs: meta.updatedAtMs,
      });
    }
  }

  return files;
}

/**
 * Recursively list directories under workspace
 */
async function listDirectoriesRecursive(
  baseDir: string,
  currentPath: string = "",
): Promise<Array<{ path: string; updatedAtMs: number }>> {
  const results: Array<{ path: string; updatedAtMs: number }> = [];
  const fullPath = currentPath ? path.join(baseDir, currentPath) : baseDir;

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const relativePath = currentPath ? path.join(currentPath, entry.name) : entry.name;
        const dirFullPath = path.join(fullPath, entry.name);
        const stat = await statDir(dirFullPath);
        if (stat) {
          results.push({ path: relativePath, updatedAtMs: stat.updatedAtMs });
        }
        // Recurse into subdirectories
        const subDirs = await listDirectoriesRecursive(baseDir, relativePath);
        results.push(...subDirs);
      }
    }
  } catch {
    // Directory doesn't exist or not readable
  }

  return results;
}

/**
 * Recursively list files under workspace (optionally filtered by directory)
 */
async function listFilesRecursive(
  baseDir: string,
  subPath: string = "",
): Promise<
  Array<{ path: string; name: string; size: number; updatedAtMs: number; mimeType?: string }>
> {
  const results: Array<{
    path: string;
    name: string;
    size: number;
    updatedAtMs: number;
    mimeType?: string;
  }> = [];
  const fullPath = subPath ? path.join(baseDir, subPath) : baseDir;

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = subPath ? path.join(subPath, entry.name) : entry.name;
      const entryFullPath = path.join(fullPath, entry.name);

      if (entry.isFile()) {
        const stat = await statFile(entryFullPath);
        if (stat) {
          results.push({
            path: relativePath,
            name: entry.name,
            size: stat.size,
            updatedAtMs: stat.updatedAtMs,
            mimeType: guessMimeType(entry.name),
          });
        }
      } else if (entry.isDirectory()) {
        // Recurse into subdirectories
        const subFiles = await listFilesRecursive(baseDir, relativePath);
        results.push(...subFiles);
      }
    }
  } catch {
    // Directory doesn't exist or not readable
  }

  return results;
}

/**
 * Validate that a path is safe (no path traversal, stays within workspace)
 */
function isPathSafe(workspaceDir: string, relativePath: string): boolean {
  if (!relativePath) return false;

  // Normalize and resolve
  const normalized = path.normalize(relativePath);

  // Check for path traversal attempts
  if (normalized.startsWith("..") || normalized.includes("/../") || normalized.includes("\\..\\")) {
    return false;
  }

  // Check that resolved path is within workspace
  const resolved = path.resolve(workspaceDir, normalized);
  const normalizedWorkspace = path.resolve(workspaceDir);

  return resolved.startsWith(normalizedWorkspace + path.sep) || resolved === normalizedWorkspace;
}

/**
 * Guess MIME type from file extension
 */
function guessMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".csv": "text/csv",
    ".json": "application/json",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".html": "text/html",
    ".xml": "application/xml",
    ".zip": "application/zip",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

function resolveAgentIdOrError(agentIdRaw: string, cfg: ReturnType<typeof loadConfig>) {
  const agentId = normalizeAgentId(agentIdRaw);
  const allowed = new Set(listAgentIds(cfg));
  if (!allowed.has(agentId)) {
    return null;
  }
  return agentId;
}

export const agentsHandlers: GatewayRequestHandlers = {
  "agents.list": ({ params, respond }) => {
    if (!validateAgentsListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.list params: ${formatValidationErrors(validateAgentsListParams.errors)}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const result = listAgentsForGateway(cfg);
    respond(true, result, undefined);
  },

  "agents.files.list": async ({ params, respond }) => {
    if (!validateAgentsFilesListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.files.list params: ${formatValidationErrors(
            validateAgentsFilesListParams.errors,
          )}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const agentId = resolveAgentIdOrError(String(params.agentId ?? ""), cfg);
    if (!agentId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const files = await listAgentFiles(workspaceDir);
    respond(true, { agentId, workspace: workspaceDir, files }, undefined);
  },

  "agents.files.get": async ({ params, respond }) => {
    if (!validateAgentsFilesGetParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.files.get params: ${formatValidationErrors(
            validateAgentsFilesGetParams.errors,
          )}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const agentId = resolveAgentIdOrError(String(params.agentId ?? ""), cfg);
    if (!agentId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }
    const name = String(params.name ?? "").trim();
    if (!ALLOWED_FILE_NAMES.has(name)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `unsupported file "${name}"`),
      );
      return;
    }
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const filePath = path.join(workspaceDir, name);
    const meta = await statFile(filePath);
    if (!meta) {
      respond(
        true,
        {
          agentId,
          workspace: workspaceDir,
          file: { name, path: filePath, missing: true },
        },
        undefined,
      );
      return;
    }
    const content = await fs.readFile(filePath, "utf-8");
    respond(
      true,
      {
        agentId,
        workspace: workspaceDir,
        file: {
          name,
          path: filePath,
          missing: false,
          size: meta.size,
          updatedAtMs: meta.updatedAtMs,
          content,
        },
      },
      undefined,
    );
  },

  "agents.files.set": async ({ params, respond }) => {
    if (!validateAgentsFilesSetParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.files.set params: ${formatValidationErrors(
            validateAgentsFilesSetParams.errors,
          )}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const agentId = resolveAgentIdOrError(String(params.agentId ?? ""), cfg);
    if (!agentId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }
    const name = String(params.name ?? "").trim();
    if (!ALLOWED_FILE_NAMES.has(name)) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `unsupported file "${name}"`),
      );
      return;
    }
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    await fs.mkdir(workspaceDir, { recursive: true });
    const filePath = path.join(workspaceDir, name);
    const content = String(params.content ?? "");
    await fs.writeFile(filePath, content, "utf-8");
    const meta = await statFile(filePath);
    respond(
      true,
      {
        ok: true,
        agentId,
        workspace: workspaceDir,
        file: {
          name,
          path: filePath,
          missing: false,
          size: meta?.size,
          updatedAtMs: meta?.updatedAtMs,
          content,
        },
      },
      undefined,
    );
  },

  // ============================================
  // NEW: Folder APIs
  // ============================================

  "agents.folders.list": async ({ params, respond }) => {
    if (!validateAgentsFoldersListParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.folders.list params: ${formatValidationErrors(
            validateAgentsFoldersListParams.errors,
          )}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const agentId = resolveAgentIdOrError(String(params.agentId ?? ""), cfg);
    if (!agentId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);

    // Optional: filter by path
    const subPath = params.path ? String(params.path).trim() : "";
    if (subPath && !isPathSafe(workspaceDir, subPath)) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid path"));
      return;
    }

    const baseDir = subPath ? path.join(workspaceDir, subPath) : workspaceDir;
    const folders = await listDirectoriesRecursive(baseDir, "");

    // Also list files in directories if requested
    const includeFiles = params.includeFiles === true;
    let files: Awaited<ReturnType<typeof listFilesRecursive>> = [];
    if (includeFiles) {
      files = await listFilesRecursive(baseDir, "");
    }

    respond(
      true,
      {
        agentId,
        workspace: workspaceDir,
        basePath: subPath || "/",
        folders,
        ...(includeFiles ? { files } : {}),
      },
      undefined,
    );
  },

  "agents.folders.create": async ({ params, respond }) => {
    if (!validateAgentsFoldersCreateParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.folders.create params: ${formatValidationErrors(
            validateAgentsFoldersCreateParams.errors,
          )}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const agentId = resolveAgentIdOrError(String(params.agentId ?? ""), cfg);
    if (!agentId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const folderPath = String(params.path ?? "").trim();

    if (!folderPath || !isPathSafe(workspaceDir, folderPath)) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid path"));
      return;
    }

    const fullPath = path.join(workspaceDir, folderPath);

    try {
      await fs.mkdir(fullPath, { recursive: true });
      const meta = await statDir(fullPath);
      respond(
        true,
        {
          ok: true,
          agentId,
          workspace: workspaceDir,
          folder: {
            path: folderPath,
            updatedAtMs: meta?.updatedAtMs,
          },
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INTERNAL_ERROR, `failed to create folder: ${String(err)}`),
      );
    }
  },

  "agents.folders.delete": async ({ params, respond }) => {
    if (!validateAgentsFoldersDeleteParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.folders.delete params: ${formatValidationErrors(
            validateAgentsFoldersDeleteParams.errors,
          )}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const agentId = resolveAgentIdOrError(String(params.agentId ?? ""), cfg);
    if (!agentId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const folderPath = String(params.path ?? "").trim();

    if (!folderPath || !isPathSafe(workspaceDir, folderPath)) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid path"));
      return;
    }

    const fullPath = path.join(workspaceDir, folderPath);

    // Check it's a directory
    const meta = await statDir(fullPath);
    if (!meta) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, "folder not found"));
      return;
    }

    const recursive = params.recursive === true;

    try {
      if (recursive) {
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        // Check if empty
        const entries = await fs.readdir(fullPath);
        if (entries.length > 0) {
          respond(
            false,
            undefined,
            errorShape(ErrorCodes.INVALID_REQUEST, "folder not empty (use recursive: true)"),
          );
          return;
        }
        await fs.rmdir(fullPath);
      }
      respond(
        true,
        {
          ok: true,
          agentId,
          workspace: workspaceDir,
          deleted: folderPath,
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INTERNAL_ERROR, `failed to delete folder: ${String(err)}`),
      );
    }
  },

  // ============================================
  // NEW: Upload API (base64)
  // ============================================

  "agents.files.upload": async ({ params, respond }) => {
    if (!validateAgentsFilesUploadParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.files.upload params: ${formatValidationErrors(
            validateAgentsFilesUploadParams.errors,
          )}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const agentId = resolveAgentIdOrError(String(params.agentId ?? ""), cfg);
    if (!agentId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const filename = String(params.filename ?? "").trim();
    const destPath = params.path ? String(params.path).trim() : "";
    const contentBase64 = String(params.content ?? "");

    if (!filename) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "filename required"));
      return;
    }

    // Validate destination path if provided
    const relativePath = destPath ? path.join(destPath, filename) : filename;
    if (!isPathSafe(workspaceDir, relativePath)) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid path"));
      return;
    }

    const fullPath = path.join(workspaceDir, relativePath);

    try {
      // Ensure parent directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      // Decode base64 and write
      const buffer = Buffer.from(contentBase64, "base64");
      await fs.writeFile(fullPath, buffer);

      const meta = await statFile(fullPath);
      respond(
        true,
        {
          ok: true,
          agentId,
          workspace: workspaceDir,
          file: {
            path: relativePath,
            name: filename,
            size: meta?.size ?? buffer.length,
            updatedAtMs: meta?.updatedAtMs,
            mimeType: guessMimeType(filename),
          },
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INTERNAL_ERROR, `failed to upload file: ${String(err)}`),
      );
    }
  },

  // ============================================
  // NEW: Extended file APIs (any path in workspace)
  // ============================================

  "agents.files.read": async ({ params, respond }) => {
    if (!validateAgentsFilesReadParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.files.read params: ${formatValidationErrors(
            validateAgentsFilesReadParams.errors,
          )}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const agentId = resolveAgentIdOrError(String(params.agentId ?? ""), cfg);
    if (!agentId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const filePath = String(params.path ?? "").trim();

    if (!filePath || !isPathSafe(workspaceDir, filePath)) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid path"));
      return;
    }

    const fullPath = path.join(workspaceDir, filePath);
    const meta = await statFile(fullPath);

    if (!meta) {
      respond(
        true,
        {
          agentId,
          workspace: workspaceDir,
          file: { path: filePath, name: path.basename(filePath), missing: true },
        },
        undefined,
      );
      return;
    }

    // For binary files, return base64
    const encoding = params.encoding === "base64" ? "base64" : "utf-8";
    const asBinary = encoding === "base64";

    try {
      let content: string;
      if (asBinary) {
        const buffer = await fs.readFile(fullPath);
        content = buffer.toString("base64");
      } else {
        content = await fs.readFile(fullPath, "utf-8");
      }

      respond(
        true,
        {
          agentId,
          workspace: workspaceDir,
          file: {
            path: filePath,
            name: path.basename(filePath),
            missing: false,
            size: meta.size,
            updatedAtMs: meta.updatedAtMs,
            mimeType: guessMimeType(filePath),
            content,
            encoding,
          },
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INTERNAL_ERROR, `failed to read file: ${String(err)}`),
      );
    }
  },

  "agents.files.write": async ({ params, respond }) => {
    if (!validateAgentsFilesWriteParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.files.write params: ${formatValidationErrors(
            validateAgentsFilesWriteParams.errors,
          )}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const agentId = resolveAgentIdOrError(String(params.agentId ?? ""), cfg);
    if (!agentId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const filePath = String(params.path ?? "").trim();
    const content = String(params.content ?? "");
    const encoding = params.encoding === "base64" ? "base64" : "utf-8";

    if (!filePath || !isPathSafe(workspaceDir, filePath)) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid path"));
      return;
    }

    const fullPath = path.join(workspaceDir, filePath);

    try {
      // Ensure parent directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });

      if (encoding === "base64") {
        const buffer = Buffer.from(content, "base64");
        await fs.writeFile(fullPath, buffer);
      } else {
        await fs.writeFile(fullPath, content, "utf-8");
      }

      const meta = await statFile(fullPath);
      respond(
        true,
        {
          ok: true,
          agentId,
          workspace: workspaceDir,
          file: {
            path: filePath,
            name: path.basename(filePath),
            missing: false,
            size: meta?.size,
            updatedAtMs: meta?.updatedAtMs,
            mimeType: guessMimeType(filePath),
          },
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INTERNAL_ERROR, `failed to write file: ${String(err)}`),
      );
    }
  },

  "agents.files.delete": async ({ params, respond }) => {
    if (!validateAgentsFilesDeleteParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid agents.files.delete params: ${formatValidationErrors(
            validateAgentsFilesDeleteParams.errors,
          )}`,
        ),
      );
      return;
    }
    const cfg = loadConfig();
    const agentId = resolveAgentIdOrError(String(params.agentId ?? ""), cfg);
    if (!agentId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }
    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    const filePath = String(params.path ?? "").trim();

    if (!filePath || !isPathSafe(workspaceDir, filePath)) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid path"));
      return;
    }

    const fullPath = path.join(workspaceDir, filePath);
    const meta = await statFile(fullPath);

    if (!meta) {
      respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, "file not found"));
      return;
    }

    try {
      await fs.unlink(fullPath);
      respond(
        true,
        {
          ok: true,
          agentId,
          workspace: workspaceDir,
          deleted: filePath,
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INTERNAL_ERROR, `failed to delete file: ${String(err)}`),
      );
    }
  },
};
