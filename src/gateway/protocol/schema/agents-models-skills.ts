import { Type } from "@sinclair/typebox";
import { NonEmptyString } from "./primitives.js";

export const ModelChoiceSchema = Type.Object(
  {
    id: NonEmptyString,
    name: NonEmptyString,
    provider: NonEmptyString,
    contextWindow: Type.Optional(Type.Integer({ minimum: 1 })),
    reasoning: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const AgentSummarySchema = Type.Object(
  {
    id: NonEmptyString,
    name: Type.Optional(NonEmptyString),
    identity: Type.Optional(
      Type.Object(
        {
          name: Type.Optional(NonEmptyString),
          theme: Type.Optional(NonEmptyString),
          emoji: Type.Optional(NonEmptyString),
          avatar: Type.Optional(NonEmptyString),
          avatarUrl: Type.Optional(NonEmptyString),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export const AgentsListParamsSchema = Type.Object({}, { additionalProperties: false });

export const AgentsListResultSchema = Type.Object(
  {
    defaultId: NonEmptyString,
    mainKey: NonEmptyString,
    scope: Type.Union([Type.Literal("per-sender"), Type.Literal("global")]),
    agents: Type.Array(AgentSummarySchema),
  },
  { additionalProperties: false },
);

export const AgentsFileEntrySchema = Type.Object(
  {
    name: NonEmptyString,
    path: NonEmptyString,
    missing: Type.Boolean(),
    size: Type.Optional(Type.Integer({ minimum: 0 })),
    updatedAtMs: Type.Optional(Type.Integer({ minimum: 0 })),
    content: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const AgentsFilesListParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
  },
  { additionalProperties: false },
);

export const AgentsFilesListResultSchema = Type.Object(
  {
    agentId: NonEmptyString,
    workspace: NonEmptyString,
    files: Type.Array(AgentsFileEntrySchema),
  },
  { additionalProperties: false },
);

export const AgentsFilesGetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    name: NonEmptyString,
  },
  { additionalProperties: false },
);

export const AgentsFilesGetResultSchema = Type.Object(
  {
    agentId: NonEmptyString,
    workspace: NonEmptyString,
    file: AgentsFileEntrySchema,
  },
  { additionalProperties: false },
);

export const AgentsFilesSetParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    name: NonEmptyString,
    content: Type.String(),
  },
  { additionalProperties: false },
);

export const AgentsFilesSetResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    agentId: NonEmptyString,
    workspace: NonEmptyString,
    file: AgentsFileEntrySchema,
  },
  { additionalProperties: false },
);

export const ModelsListParamsSchema = Type.Object({}, { additionalProperties: false });

export const ModelsListResultSchema = Type.Object(
  {
    models: Type.Array(ModelChoiceSchema),
  },
  { additionalProperties: false },
);

export const SkillsStatusParamsSchema = Type.Object(
  {
    agentId: Type.Optional(NonEmptyString),
  },
  { additionalProperties: false },
);

export const SkillsBinsParamsSchema = Type.Object({}, { additionalProperties: false });

export const SkillsBinsResultSchema = Type.Object(
  {
    bins: Type.Array(NonEmptyString),
  },
  { additionalProperties: false },
);

export const SkillsInstallParamsSchema = Type.Object(
  {
    name: NonEmptyString,
    installId: NonEmptyString,
    timeoutMs: Type.Optional(Type.Integer({ minimum: 1000 })),
  },
  { additionalProperties: false },
);

export const SkillsUpdateParamsSchema = Type.Object(
  {
    skillKey: NonEmptyString,
    enabled: Type.Optional(Type.Boolean()),
    apiKey: Type.Optional(Type.String()),
    env: Type.Optional(Type.Record(NonEmptyString, Type.String())),
  },
  { additionalProperties: false },
);

// ============================================
// Folder APIs
// ============================================

export const AgentsFoldersListParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    path: Type.Optional(Type.String()),
    includeFiles: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const AgentsFolderEntrySchema = Type.Object(
  {
    path: NonEmptyString,
    updatedAtMs: Type.Optional(Type.Integer({ minimum: 0 })),
  },
  { additionalProperties: false },
);

export const AgentsFileMetaSchema = Type.Object(
  {
    path: NonEmptyString,
    name: NonEmptyString,
    size: Type.Integer({ minimum: 0 }),
    updatedAtMs: Type.Optional(Type.Integer({ minimum: 0 })),
    mimeType: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const AgentsFoldersListResultSchema = Type.Object(
  {
    agentId: NonEmptyString,
    workspace: NonEmptyString,
    basePath: NonEmptyString,
    folders: Type.Array(AgentsFolderEntrySchema),
    files: Type.Optional(Type.Array(AgentsFileMetaSchema)),
  },
  { additionalProperties: false },
);

// ============================================
// Search API
// ============================================

export const AgentsFilesSearchParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    query: NonEmptyString,
    searchContent: Type.Optional(Type.Boolean()),
    maxResults: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  },
  { additionalProperties: false },
);

export const AgentsFoldersCreateParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    path: NonEmptyString,
  },
  { additionalProperties: false },
);

export const AgentsFoldersCreateResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    agentId: NonEmptyString,
    workspace: NonEmptyString,
    folder: AgentsFolderEntrySchema,
  },
  { additionalProperties: false },
);

export const AgentsFoldersDeleteParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    path: NonEmptyString,
    recursive: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const AgentsFoldersDeleteResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    agentId: NonEmptyString,
    workspace: NonEmptyString,
    deleted: NonEmptyString,
  },
  { additionalProperties: false },
);

// ============================================
// Upload API
// ============================================

export const AgentsFilesUploadParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    filename: NonEmptyString,
    content: Type.String(), // base64 encoded
    path: Type.Optional(Type.String()), // subdirectory path
  },
  { additionalProperties: false },
);

export const AgentsFilesUploadResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    agentId: NonEmptyString,
    workspace: NonEmptyString,
    file: AgentsFileMetaSchema,
  },
  { additionalProperties: false },
);

// ============================================
// Extended File APIs (any path in workspace)
// ============================================

export const AgentsFilesReadParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    path: NonEmptyString,
    encoding: Type.Optional(Type.Union([Type.Literal("utf-8"), Type.Literal("base64")])),
  },
  { additionalProperties: false },
);

export const AgentsExtendedFileEntrySchema = Type.Object(
  {
    path: NonEmptyString,
    name: NonEmptyString,
    missing: Type.Boolean(),
    size: Type.Optional(Type.Integer({ minimum: 0 })),
    updatedAtMs: Type.Optional(Type.Integer({ minimum: 0 })),
    mimeType: Type.Optional(Type.String()),
    content: Type.Optional(Type.String()),
    encoding: Type.Optional(Type.Union([Type.Literal("utf-8"), Type.Literal("base64")])),
  },
  { additionalProperties: false },
);

export const AgentsFilesReadResultSchema = Type.Object(
  {
    agentId: NonEmptyString,
    workspace: NonEmptyString,
    file: AgentsExtendedFileEntrySchema,
  },
  { additionalProperties: false },
);

export const AgentsFilesWriteParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    path: NonEmptyString,
    content: Type.String(),
    encoding: Type.Optional(Type.Union([Type.Literal("utf-8"), Type.Literal("base64")])),
  },
  { additionalProperties: false },
);

export const AgentsFilesWriteResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    agentId: NonEmptyString,
    workspace: NonEmptyString,
    file: AgentsFileMetaSchema,
  },
  { additionalProperties: false },
);

export const AgentsFilesDeleteParamsSchema = Type.Object(
  {
    agentId: NonEmptyString,
    path: NonEmptyString,
  },
  { additionalProperties: false },
);

export const AgentsFilesDeleteResultSchema = Type.Object(
  {
    ok: Type.Literal(true),
    agentId: NonEmptyString,
    workspace: NonEmptyString,
    deleted: NonEmptyString,
  },
  { additionalProperties: false },
);
