import fs from "node:fs/promises";
import path from "node:path";
import type { GatewayRequestHandlers } from "./types.js";
import { resolveAgentWorkspaceDir, listAgentIds } from "../../agents/agent-scope.js";
import { loadConfig } from "../../config/config.js";
import { normalizeAgentId } from "../../routing/session-key.js";
import { ErrorCodes, errorShape, formatValidationErrors } from "../protocol/index.js";

// Gmail API - requires nodemailer and imap packages
// These are optional dependencies that need to be installed:
// npm install nodemailer imap
// npm install -D @types/nodemailer @types/imap

type GmailAccount = {
  email: string;
  appPassword: string;
};

type GmailMessage = {
  id: string;
  uid: number;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  hasAttachments: boolean;
  labels?: string[];
};

type GmailAttachment = {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
};

type GmailMessageDetail = GmailMessage & {
  body: string;
  bodyHtml?: string;
  attachments: GmailAttachment[];
};

// Get Gmail config from OpenClaw config
function getGmailConfig(): { accounts: Record<string, GmailAccount> } | null {
  const cfg = loadConfig();
  const gmailConfig = (cfg as { gmail?: { accounts?: Record<string, GmailAccount> } }).gmail;
  if (!gmailConfig?.accounts) {
    return null;
  }
  return { accounts: gmailConfig.accounts };
}

function getGmailAccount(accountId: string): GmailAccount | null {
  const config = getGmailConfig();
  if (!config) return null;
  return config.accounts[accountId] || null;
}

function resolveAgentIdOrError(agentIdRaw: string, cfg: ReturnType<typeof loadConfig>) {
  const agentId = normalizeAgentId(agentIdRaw);
  const allowed = new Set(listAgentIds(cfg));
  if (!allowed.has(agentId)) {
    return null;
  }
  return agentId;
}

// Validate path is safe (no traversal)
function isPathSafe(workspaceDir: string, relativePath: string): boolean {
  if (!relativePath) return false;
  const normalized = path.normalize(relativePath);
  if (normalized.startsWith("..") || normalized.includes("/../") || normalized.includes("\\..\\")) {
    return false;
  }
  const resolved = path.resolve(workspaceDir, normalized);
  const normalizedWorkspace = path.resolve(workspaceDir);
  return resolved.startsWith(normalizedWorkspace + path.sep) || resolved === normalizedWorkspace;
}

// Dynamic import for optional dependencies
let nodemailer: typeof import("nodemailer") | null = null;
let Imap: typeof import("imap") | null = null;

async function loadDependencies(): Promise<{
  nodemailer: typeof import("nodemailer");
  Imap: typeof import("imap");
} | null> {
  if (nodemailer && Imap) {
    return { nodemailer, Imap };
  }
  try {
    nodemailer = await import("nodemailer");
    Imap = (await import("imap")).default;
    return { nodemailer, Imap };
  } catch {
    return null;
  }
}

export const gmailHandlers: GatewayRequestHandlers = {
  /**
   * List Gmail accounts configured
   */
  "gmail.accounts.list": async ({ respond }) => {
    const config = getGmailConfig();
    if (!config) {
      respond(true, { accounts: [] }, undefined);
      return;
    }
    const accounts = Object.entries(config.accounts).map(([id, acc]) => ({
      id,
      email: acc.email,
    }));
    respond(true, { accounts }, undefined);
  },

  /**
   * List messages from a Gmail account
   */
  "gmail.messages.list": async ({ params, respond }) => {
    const accountId = String(params.account ?? "").trim();
    const query = String(params.query ?? "ALL").trim();
    const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
    const folder = String(params.folder ?? "INBOX").trim();

    if (!accountId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "account required"));
      return;
    }

    const account = getGmailAccount(accountId);
    if (!account) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.NOT_FOUND, `account "${accountId}" not found`),
      );
      return;
    }

    const deps = await loadDependencies();
    if (!deps) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INTERNAL_ERROR,
          "Gmail dependencies not installed (nodemailer, imap)",
        ),
      );
      return;
    }

    try {
      const messages = await listMessages(deps.Imap, account, folder, query, limit);
      respond(true, { account: accountId, folder, messages }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INTERNAL_ERROR, `failed to list messages: ${String(err)}`),
      );
    }
  },

  /**
   * Get a specific message with attachments
   */
  "gmail.messages.get": async ({ params, respond }) => {
    const accountId = String(params.account ?? "").trim();
    const messageId = String(params.messageId ?? "").trim();
    const folder = String(params.folder ?? "INBOX").trim();

    if (!accountId || !messageId) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "account and messageId required"),
      );
      return;
    }

    const account = getGmailAccount(accountId);
    if (!account) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.NOT_FOUND, `account "${accountId}" not found`),
      );
      return;
    }

    const deps = await loadDependencies();
    if (!deps) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INTERNAL_ERROR,
          "Gmail dependencies not installed (nodemailer, imap)",
        ),
      );
      return;
    }

    try {
      const message = await getMessage(deps.Imap, account, folder, messageId);
      if (!message) {
        respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, "message not found"));
        return;
      }
      respond(true, { account: accountId, message }, undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INTERNAL_ERROR, `failed to get message: ${String(err)}`),
      );
    }
  },

  /**
   * Save an attachment to workspace
   */
  "gmail.attachments.save": async ({ params, respond }) => {
    const accountId = String(params.account ?? "").trim();
    const messageId = String(params.messageId ?? "").trim();
    const attachmentId = String(params.attachmentId ?? "").trim();
    const destPath = String(params.destPath ?? "").trim();
    const agentIdRaw = String(params.agentId ?? "main").trim();
    const folder = String(params.folder ?? "INBOX").trim();

    if (!accountId || !messageId || !attachmentId || !destPath) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          "account, messageId, attachmentId, and destPath required",
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const agentId = resolveAgentIdOrError(agentIdRaw, cfg);
    if (!agentId) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown agent id"));
      return;
    }

    const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    if (!isPathSafe(workspaceDir, destPath)) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid destination path"));
      return;
    }

    const account = getGmailAccount(accountId);
    if (!account) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.NOT_FOUND, `account "${accountId}" not found`),
      );
      return;
    }

    const deps = await loadDependencies();
    if (!deps) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INTERNAL_ERROR,
          "Gmail dependencies not installed (nodemailer, imap)",
        ),
      );
      return;
    }

    try {
      const attachmentData = await getAttachment(
        deps.Imap,
        account,
        folder,
        messageId,
        attachmentId,
      );
      if (!attachmentData) {
        respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, "attachment not found"));
        return;
      }

      const fullPath = path.join(workspaceDir, destPath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, attachmentData.content);

      respond(
        true,
        {
          ok: true,
          account: accountId,
          messageId,
          attachmentId,
          savedTo: destPath,
          filename: attachmentData.filename,
          size: attachmentData.content.length,
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INTERNAL_ERROR, `failed to save attachment: ${String(err)}`),
      );
    }
  },

  /**
   * Send an email
   */
  "gmail.send": async ({ params, respond }) => {
    const accountId = String(params.account ?? "").trim();
    const to = String(params.to ?? "").trim();
    const subject = String(params.subject ?? "").trim();
    const body = String(params.body ?? "").trim();
    const attachmentPaths = Array.isArray(params.attachmentPaths) ? params.attachmentPaths : [];
    const agentIdRaw = String(params.agentId ?? "main").trim();

    if (!accountId || !to || !subject) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "account, to, and subject required"),
      );
      return;
    }

    const account = getGmailAccount(accountId);
    if (!account) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.NOT_FOUND, `account "${accountId}" not found`),
      );
      return;
    }

    const deps = await loadDependencies();
    if (!deps) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INTERNAL_ERROR,
          "Gmail dependencies not installed (nodemailer, imap)",
        ),
      );
      return;
    }

    // Resolve attachment paths
    const cfg = loadConfig();
    const agentId = resolveAgentIdOrError(agentIdRaw, cfg);
    const workspaceDir = agentId ? resolveAgentWorkspaceDir(cfg, agentId) : null;

    const attachments: Array<{ filename: string; path: string }> = [];
    for (const attachmentPath of attachmentPaths) {
      const pathStr = String(attachmentPath).trim();
      if (!pathStr) continue;

      let fullPath = pathStr;
      if (workspaceDir && !path.isAbsolute(pathStr)) {
        if (!isPathSafe(workspaceDir, pathStr)) {
          respond(
            false,
            undefined,
            errorShape(ErrorCodes.INVALID_REQUEST, `invalid attachment path: ${pathStr}`),
          );
          return;
        }
        fullPath = path.join(workspaceDir, pathStr);
      }

      try {
        await fs.access(fullPath);
        attachments.push({
          filename: path.basename(fullPath),
          path: fullPath,
        });
      } catch {
        respond(
          false,
          undefined,
          errorShape(ErrorCodes.NOT_FOUND, `attachment not found: ${pathStr}`),
        );
        return;
      }
    }

    try {
      const transporter = deps.nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: account.email,
          pass: account.appPassword,
        },
      });

      const info = await transporter.sendMail({
        from: account.email,
        to,
        subject,
        text: body,
        attachments,
      });

      respond(
        true,
        {
          ok: true,
          account: accountId,
          messageId: info.messageId,
          to,
          subject,
          attachmentCount: attachments.length,
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INTERNAL_ERROR, `failed to send email: ${String(err)}`),
      );
    }
  },
};

// ============================================
// IMAP Helper Functions
// ============================================

async function listMessages(
  ImapConstructor: typeof import("imap"),
  account: GmailAccount,
  folder: string,
  query: string,
  limit: number,
): Promise<GmailMessage[]> {
  return new Promise((resolve, reject) => {
    const imap = new (ImapConstructor as unknown as new (config: object) => import("imap"))({
      user: account.email,
      password: account.appPassword,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    const messages: GmailMessage[] = [];

    imap.once("ready", () => {
      imap.openBox(folder, true, (err) => {
        if (err) {
          imap.end();
          reject(err);
          return;
        }

        // Search for messages
        imap.search([query], (searchErr, results) => {
          if (searchErr) {
            imap.end();
            reject(searchErr);
            return;
          }

          if (!results || results.length === 0) {
            imap.end();
            resolve([]);
            return;
          }

          // Get the last N results
          const uids = results.slice(-limit).reverse();

          const fetch = imap.fetch(uids, {
            bodies: ["HEADER.FIELDS (FROM TO SUBJECT DATE)"],
            struct: true,
          });

          fetch.on("message", (msg, seqno) => {
            let header = "";
            let hasAttachments = false;
            let uid = 0;

            msg.on("body", (stream) => {
              stream.on("data", (chunk) => {
                header += chunk.toString("utf8");
              });
            });

            msg.once("attributes", (attrs) => {
              uid = attrs.uid;
              // Check for attachments in structure
              if (attrs.struct) {
                hasAttachments = checkForAttachments(attrs.struct);
              }
            });

            msg.once("end", () => {
              const parsed = parseHeader(header);
              messages.push({
                id: String(uid),
                uid,
                subject: parsed.subject || "(no subject)",
                from: parsed.from || "",
                to: parsed.to || "",
                date: parsed.date || "",
                snippet: "", // Would need to fetch body for snippet
                hasAttachments,
              });
            });
          });

          fetch.once("error", (fetchErr) => {
            imap.end();
            reject(fetchErr);
          });

          fetch.once("end", () => {
            imap.end();
            resolve(messages);
          });
        });
      });
    });

    imap.once("error", reject);
    imap.connect();
  });
}

async function getMessage(
  ImapConstructor: typeof import("imap"),
  account: GmailAccount,
  folder: string,
  messageId: string,
): Promise<GmailMessageDetail | null> {
  return new Promise((resolve, reject) => {
    const imap = new (ImapConstructor as unknown as new (config: object) => import("imap"))({
      user: account.email,
      password: account.appPassword,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    imap.once("ready", () => {
      imap.openBox(folder, true, (err) => {
        if (err) {
          imap.end();
          reject(err);
          return;
        }

        const uid = parseInt(messageId, 10);
        if (isNaN(uid)) {
          imap.end();
          resolve(null);
          return;
        }

        const fetch = imap.fetch([uid], {
          bodies: ["HEADER", "TEXT", ""],
          struct: true,
        });

        let message: GmailMessageDetail | null = null;

        fetch.on("message", (msg) => {
          let header = "";
          let body = "";
          let struct: unknown = null;

          msg.on("body", (stream, info) => {
            let buffer = "";
            stream.on("data", (chunk) => {
              buffer += chunk.toString("utf8");
            });
            stream.once("end", () => {
              if (info.which === "HEADER") {
                header = buffer;
              } else if (info.which === "TEXT") {
                body = buffer;
              }
            });
          });

          msg.once("attributes", (attrs) => {
            struct = attrs.struct;
          });

          msg.once("end", () => {
            const parsed = parseHeader(header);
            const attachments = extractAttachmentInfo(struct);
            message = {
              id: messageId,
              uid,
              subject: parsed.subject || "(no subject)",
              from: parsed.from || "",
              to: parsed.to || "",
              date: parsed.date || "",
              snippet: body.substring(0, 200),
              hasAttachments: attachments.length > 0,
              body,
              attachments,
            };
          });
        });

        fetch.once("error", (fetchErr) => {
          imap.end();
          reject(fetchErr);
        });

        fetch.once("end", () => {
          imap.end();
          resolve(message);
        });
      });
    });

    imap.once("error", reject);
    imap.connect();
  });
}

async function getAttachment(
  ImapConstructor: typeof import("imap"),
  account: GmailAccount,
  folder: string,
  messageId: string,
  attachmentId: string,
): Promise<{ filename: string; content: Buffer } | null> {
  return new Promise((resolve, reject) => {
    const imap = new (ImapConstructor as unknown as new (config: object) => import("imap"))({
      user: account.email,
      password: account.appPassword,
      host: "imap.gmail.com",
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
    });

    imap.once("ready", () => {
      imap.openBox(folder, true, (err) => {
        if (err) {
          imap.end();
          reject(err);
          return;
        }

        const uid = parseInt(messageId, 10);
        if (isNaN(uid)) {
          imap.end();
          resolve(null);
          return;
        }

        // Fetch the specific body part
        const fetch = imap.fetch([uid], {
          bodies: [attachmentId],
          struct: true,
        });

        let attachmentData: Buffer | null = null;
        let filename = "attachment";

        fetch.on("message", (msg) => {
          msg.on("body", (stream, info) => {
            const chunks: Buffer[] = [];
            stream.on("data", (chunk) => {
              chunks.push(chunk);
            });
            stream.once("end", () => {
              if (info.which === attachmentId) {
                attachmentData = Buffer.concat(chunks);
              }
            });
          });

          msg.once("attributes", (attrs) => {
            // Try to get filename from structure
            if (attrs.struct) {
              const attachmentInfo = findAttachmentById(attrs.struct, attachmentId);
              if (attachmentInfo?.filename) {
                filename = attachmentInfo.filename;
              }
            }
          });
        });

        fetch.once("error", (fetchErr) => {
          imap.end();
          reject(fetchErr);
        });

        fetch.once("end", () => {
          imap.end();
          if (attachmentData) {
            resolve({ filename, content: attachmentData });
          } else {
            resolve(null);
          }
        });
      });
    });

    imap.once("error", reject);
    imap.connect();
  });
}

// ============================================
// Header Parsing Helpers
// ============================================

function parseHeader(header: string): {
  subject?: string;
  from?: string;
  to?: string;
  date?: string;
} {
  const result: { subject?: string; from?: string; to?: string; date?: string } = {};
  const lines = header.split(/\r?\n/);
  let currentField = "";
  let currentValue = "";

  for (const line of lines) {
    if (/^\s/.test(line)) {
      // Continuation of previous field
      currentValue += " " + line.trim();
    } else {
      // Save previous field
      if (currentField && currentValue) {
        const field = currentField.toLowerCase();
        if (field === "subject") result.subject = currentValue;
        else if (field === "from") result.from = currentValue;
        else if (field === "to") result.to = currentValue;
        else if (field === "date") result.date = currentValue;
      }
      // Start new field
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        currentField = match[1];
        currentValue = match[2];
      } else {
        currentField = "";
        currentValue = "";
      }
    }
  }

  // Save last field
  if (currentField && currentValue) {
    const field = currentField.toLowerCase();
    if (field === "subject") result.subject = currentValue;
    else if (field === "from") result.from = currentValue;
    else if (field === "to") result.to = currentValue;
    else if (field === "date") result.date = currentValue;
  }

  return result;
}

function checkForAttachments(struct: unknown): boolean {
  if (!struct) return false;
  if (Array.isArray(struct)) {
    for (const part of struct) {
      if (checkForAttachments(part)) return true;
    }
    return false;
  }
  if (typeof struct === "object" && struct !== null) {
    const s = struct as Record<string, unknown>;
    if (s.disposition && typeof s.disposition === "object") {
      const disp = s.disposition as { type?: string };
      if (disp.type?.toLowerCase() === "attachment") return true;
    }
    if (s.parts && Array.isArray(s.parts)) {
      return checkForAttachments(s.parts);
    }
  }
  return false;
}

function extractAttachmentInfo(struct: unknown, partPath = ""): GmailAttachment[] {
  const attachments: GmailAttachment[] = [];
  if (!struct) return attachments;

  if (Array.isArray(struct)) {
    for (let i = 0; i < struct.length; i++) {
      const childPath = partPath ? `${partPath}.${i + 1}` : String(i + 1);
      attachments.push(...extractAttachmentInfo(struct[i], childPath));
    }
    return attachments;
  }

  if (typeof struct === "object" && struct !== null) {
    const s = struct as Record<string, unknown>;
    let isAttachment = false;
    let filename = "";

    if (s.disposition && typeof s.disposition === "object") {
      const disp = s.disposition as { type?: string; params?: { filename?: string } };
      if (disp.type?.toLowerCase() === "attachment") {
        isAttachment = true;
        filename = disp.params?.filename || "";
      }
    }

    if (isAttachment && partPath) {
      attachments.push({
        id: partPath,
        filename: filename || `attachment_${partPath}`,
        mimeType: `${s.type || "application"}/${s.subtype || "octet-stream"}`,
        size: typeof s.size === "number" ? s.size : 0,
      });
    }

    if (s.parts && Array.isArray(s.parts)) {
      attachments.push(...extractAttachmentInfo(s.parts, partPath));
    }
  }

  return attachments;
}

function findAttachmentById(struct: unknown, attachmentId: string): { filename?: string } | null {
  if (!struct) return null;

  if (Array.isArray(struct)) {
    for (const part of struct) {
      const result = findAttachmentById(part, attachmentId);
      if (result) return result;
    }
    return null;
  }

  if (typeof struct === "object" && struct !== null) {
    const s = struct as Record<string, unknown>;
    if (s.partID === attachmentId) {
      let filename = "";
      if (s.disposition && typeof s.disposition === "object") {
        const disp = s.disposition as { params?: { filename?: string } };
        filename = disp.params?.filename || "";
      }
      return { filename };
    }
    if (s.parts && Array.isArray(s.parts)) {
      return findAttachmentById(s.parts, attachmentId);
    }
  }

  return null;
}

// Export types for schema
export type { GmailAccount, GmailMessage, GmailMessageDetail, GmailAttachment };
