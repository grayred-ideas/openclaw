/**
 * Knowledge Controller - Data loading and API interactions
 * Handles all data operations for the knowledge base module
 */

import type { GatewayBrowserClient } from "../../gateway.js";

// Type definitions
export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface InboxItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface Reference {
  id: string;
  url: string;
  title: string;
  notes: string;
  createdAt: string;
}

export interface KnowledgeData {
  notes: Note[];
  inbox: InboxItem[];
  references: Reference[];
  categories: string[];
  tags: string[];
}

export type SubTab = "inbox" | "notes" | "references";

const DATA_FILE = "knowledge/knowledge-index.json";

/**
 * Load knowledge data from workspace
 */
export async function loadKnowledgeData(gateway: GatewayBrowserClient): Promise<KnowledgeData> {
  try {
    const result = await gateway.request("agents.files.read", {
      agentId: "main",
      path: DATA_FILE,
    });
    const res = result as { file?: { content?: string; missing?: boolean } } | null;
    if (res?.file && !res.file.missing && res.file.content) {
      return JSON.parse(res.file.content);
    }
  } catch (e) {
    console.warn("Knowledge data not found, using defaults:", e);
  }
  return getDefaultData();
}

/**
 * Save knowledge data to workspace
 */
export async function saveKnowledgeData(
  gateway: GatewayBrowserClient,
  data: KnowledgeData,
): Promise<void> {
  await gateway.request("agents.files.write", {
    agentId: "main",
    path: DATA_FILE,
    content: JSON.stringify(data, null, 2),
  });
}

/**
 * Get default empty data structure
 */
function getDefaultData(): KnowledgeData {
  return {
    notes: [
      {
        id: "note-001",
        title: "Welcome to Knowledge Base",
        content:
          "# Welcome!\n\nThis is your personal knowledge base. Use it to capture:\n\n- **Notes** - Long-form thoughts and documentation\n- **Inbox** - Quick captures to process later\n- **References** - Bookmarks and external links\n\nGet started by creating your first note!",
        tags: ["getting-started"],
        category: "general",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    inbox: [],
    references: [],
    categories: ["general", "projects", "ideas", "reference", "meetings"],
    tags: ["getting-started"],
  };
}

/**
 * Generate a unique ID
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format date with time
 */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============== NOTES CRUD ==============

/**
 * Get all notes, optionally filtered
 */
export function getNotes(
  data: KnowledgeData,
  options?: { category?: string; tag?: string; search?: string },
): Note[] {
  let notes = [...data.notes];

  if (options?.category && options.category !== "all") {
    notes = notes.filter((n) => n.category === options.category);
  }

  if (options?.tag) {
    notes = notes.filter((n) => n.tags.includes(options.tag));
  }

  if (options?.search) {
    const searchLower = options.search.toLowerCase();
    notes = notes.filter(
      (n) =>
        n.title.toLowerCase().includes(searchLower) ||
        n.content.toLowerCase().includes(searchLower) ||
        n.tags.some((t) => t.toLowerCase().includes(searchLower)),
    );
  }

  // Sort by updated date descending
  return notes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Get a single note by ID
 */
export function getNote(data: KnowledgeData, noteId: string): Note | undefined {
  return data.notes.find((n) => n.id === noteId);
}

/**
 * Create a new note
 */
export function createNote(
  data: KnowledgeData,
  note: Omit<Note, "id" | "createdAt" | "updatedAt">,
): KnowledgeData {
  const newData = JSON.parse(JSON.stringify(data)) as KnowledgeData;
  const now = new Date().toISOString();

  const newNote: Note = {
    ...note,
    id: generateId("note"),
    createdAt: now,
    updatedAt: now,
  };

  newData.notes.push(newNote);

  // Add any new tags to the master list
  for (const tag of note.tags) {
    if (!newData.tags.includes(tag)) {
      newData.tags.push(tag);
    }
  }

  return newData;
}

/**
 * Update an existing note
 */
export function updateNote(
  data: KnowledgeData,
  noteId: string,
  updates: Partial<Omit<Note, "id" | "createdAt">>,
): KnowledgeData {
  const newData = JSON.parse(JSON.stringify(data)) as KnowledgeData;
  const index = newData.notes.findIndex((n) => n.id === noteId);

  if (index >= 0) {
    newData.notes[index] = {
      ...newData.notes[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Add any new tags
    if (updates.tags) {
      for (const tag of updates.tags) {
        if (!newData.tags.includes(tag)) {
          newData.tags.push(tag);
        }
      }
    }
  }

  return newData;
}

/**
 * Delete a note
 */
export function deleteNote(data: KnowledgeData, noteId: string): KnowledgeData {
  const newData = JSON.parse(JSON.stringify(data)) as KnowledgeData;
  newData.notes = newData.notes.filter((n) => n.id !== noteId);
  return newData;
}

// ============== INBOX CRUD ==============

/**
 * Get all inbox items
 */
export function getInboxItems(data: KnowledgeData): InboxItem[] {
  return [...data.inbox].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/**
 * Add item to inbox
 */
export function addToInbox(
  data: KnowledgeData,
  item: Omit<InboxItem, "id" | "createdAt">,
): KnowledgeData {
  const newData = JSON.parse(JSON.stringify(data)) as KnowledgeData;

  const newItem: InboxItem = {
    ...item,
    id: generateId("inbox"),
    createdAt: new Date().toISOString(),
  };

  newData.inbox.push(newItem);
  return newData;
}

/**
 * Delete inbox item
 */
export function deleteInboxItem(data: KnowledgeData, itemId: string): KnowledgeData {
  const newData = JSON.parse(JSON.stringify(data)) as KnowledgeData;
  newData.inbox = newData.inbox.filter((i) => i.id !== itemId);
  return newData;
}

/**
 * Move inbox item to notes
 */
export function moveInboxToNote(
  data: KnowledgeData,
  itemId: string,
  category: string = "general",
  tags: string[] = [],
): KnowledgeData {
  const item = data.inbox.find((i) => i.id === itemId);
  if (!item) return data;

  // Create note from inbox item
  let newData = createNote(data, {
    title: item.title,
    content: item.content,
    category,
    tags,
  });

  // Delete from inbox
  newData = deleteInboxItem(newData, itemId);

  return newData;
}

// ============== REFERENCES CRUD ==============

/**
 * Get all references
 */
export function getReferences(data: KnowledgeData, search?: string): Reference[] {
  let refs = [...data.references];

  if (search) {
    const searchLower = search.toLowerCase();
    refs = refs.filter(
      (r) =>
        r.title.toLowerCase().includes(searchLower) ||
        r.url.toLowerCase().includes(searchLower) ||
        r.notes.toLowerCase().includes(searchLower),
    );
  }

  return refs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Add a reference
 */
export function addReference(
  data: KnowledgeData,
  ref: Omit<Reference, "id" | "createdAt">,
): KnowledgeData {
  const newData = JSON.parse(JSON.stringify(data)) as KnowledgeData;

  const newRef: Reference = {
    ...ref,
    id: generateId("ref"),
    createdAt: new Date().toISOString(),
  };

  newData.references.push(newRef);
  return newData;
}

/**
 * Update a reference
 */
export function updateReference(
  data: KnowledgeData,
  refId: string,
  updates: Partial<Omit<Reference, "id" | "createdAt">>,
): KnowledgeData {
  const newData = JSON.parse(JSON.stringify(data)) as KnowledgeData;
  const index = newData.references.findIndex((r) => r.id === refId);

  if (index >= 0) {
    newData.references[index] = {
      ...newData.references[index],
      ...updates,
    };
  }

  return newData;
}

/**
 * Delete a reference
 */
export function deleteReference(data: KnowledgeData, refId: string): KnowledgeData {
  const newData = JSON.parse(JSON.stringify(data)) as KnowledgeData;
  newData.references = newData.references.filter((r) => r.id !== refId);
  return newData;
}

// ============== SEARCH ==============

/**
 * Search across all content types
 */
export function searchAll(
  data: KnowledgeData,
  query: string,
): { notes: Note[]; inbox: InboxItem[]; references: Reference[] } {
  if (!query.trim()) {
    return { notes: [], inbox: [], references: [] };
  }

  const searchLower = query.toLowerCase();

  const notes = data.notes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchLower) ||
      n.content.toLowerCase().includes(searchLower) ||
      n.tags.some((t) => t.toLowerCase().includes(searchLower)),
  );

  const inbox = data.inbox.filter(
    (i) =>
      i.title.toLowerCase().includes(searchLower) || i.content.toLowerCase().includes(searchLower),
  );

  const references = data.references.filter(
    (r) =>
      r.title.toLowerCase().includes(searchLower) ||
      r.url.toLowerCase().includes(searchLower) ||
      r.notes.toLowerCase().includes(searchLower),
  );

  return { notes, inbox, references };
}

// ============== CATEGORIES ==============

/**
 * Add a new category
 */
export function addCategory(data: KnowledgeData, category: string): KnowledgeData {
  if (data.categories.includes(category)) return data;

  const newData = JSON.parse(JSON.stringify(data)) as KnowledgeData;
  newData.categories.push(category);
  return newData;
}
