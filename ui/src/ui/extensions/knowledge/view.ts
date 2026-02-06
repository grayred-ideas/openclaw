/**
 * Knowledge View - UI rendering for the knowledge base module
 * Handles notes, inbox, and references with CRUD operations
 */

import type { GatewayBrowserClient } from "../../gateway.js";

// Extension context type
interface ExtensionContext {
  gateway: GatewayBrowserClient;
}
import {
  loadKnowledgeData,
  saveKnowledgeData,
  getNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  getInboxItems,
  addToInbox,
  deleteInboxItem,
  moveInboxToNote,
  getReferences,
  addReference,
  updateReference,
  deleteReference,
  formatDate,
  formatDateTime,
  type KnowledgeData,
  type Note,
  type InboxItem,
  type Reference,
  type SubTab,
} from "./controller.js";

interface ViewState {
  data: KnowledgeData | null;
  loading: boolean;
  error: string | null;
  activeTab: SubTab;
  selectedNoteId: string | null;
  editingNote: Note | null;
  searchQuery: string;
  selectedCategory: string;
  showCreateModal: boolean;
  modalType: "note" | "inbox" | "reference" | null;
}

export function renderKnowledge(ctx: ExtensionContext): HTMLElement {
  const container = document.createElement("div");
  container.className = "ext-knowledge";

  const state: ViewState = {
    data: null,
    loading: true,
    error: null,
    activeTab: "notes",
    selectedNoteId: null,
    editingNote: null,
    searchQuery: "",
    selectedCategory: "all",
    showCreateModal: false,
    modalType: null,
  };

  async function loadData() {
    state.loading = true;
    state.error = null;
    render();

    try {
      state.data = await loadKnowledgeData(ctx.gateway);
    } catch (e) {
      state.error = e instanceof Error ? e.message : "Failed to load data";
    } finally {
      state.loading = false;
      render();
    }
  }

  async function saveData() {
    if (!state.data) return;
    try {
      await saveKnowledgeData(ctx.gateway, state.data);
    } catch (e) {
      console.error("Failed to save:", e);
      state.error = "Failed to save changes";
      render();
    }
  }

  function render() {
    container.innerHTML = "";
    container.appendChild(renderHeader());
    container.appendChild(renderTabs());

    if (state.loading) {
      container.appendChild(renderLoading());
    } else if (state.error) {
      container.appendChild(renderError(state.error));
    } else {
      container.appendChild(renderActiveTab());
    }

    if (state.showCreateModal) {
      container.appendChild(renderCreateModal());
    }
  }

  function renderHeader(): HTMLElement {
    const header = document.createElement("div");
    header.className = "ext-header";

    const title = document.createElement("h2");
    title.textContent = "📚 Knowledge Base";
    header.appendChild(title);

    const actions = document.createElement("div");
    actions.className = "ext-header-actions";

    // Search input
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search...";
    searchInput.className = "ext-search-input";
    searchInput.value = state.searchQuery;
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = (e.target as HTMLInputElement).value;
      render();
    });
    actions.appendChild(searchInput);

    // Create button
    const createBtn = document.createElement("button");
    createBtn.className = "ext-btn ext-btn-primary";
    createBtn.textContent = "+ New";
    createBtn.addEventListener("click", () => {
      state.modalType =
        state.activeTab === "notes" ? "note" : state.activeTab === "inbox" ? "inbox" : "reference";
      state.showCreateModal = true;
      render();
    });
    actions.appendChild(createBtn);

    header.appendChild(actions);
    return header;
  }

  function renderTabs(): HTMLElement {
    const tabs = document.createElement("div");
    tabs.className = "ext-tabs";

    const tabData: { id: SubTab; label: string; icon: string }[] = [
      { id: "notes", label: "Notes", icon: "📝" },
      { id: "inbox", label: "Inbox", icon: "📥" },
      { id: "references", label: "References", icon: "🔗" },
    ];

    for (const tab of tabData) {
      const btn = document.createElement("button");
      btn.className = `ext-tab ${state.activeTab === tab.id ? "ext-tab-active" : ""}`;

      const count = state.data
        ? tab.id === "notes"
          ? state.data.notes.length
          : tab.id === "inbox"
            ? state.data.inbox.length
            : state.data.references.length
        : 0;

      btn.innerHTML = `${tab.icon} ${tab.label} <span class="ext-tab-badge">${count}</span>`;
      btn.addEventListener("click", () => {
        state.activeTab = tab.id;
        state.selectedNoteId = null;
        state.editingNote = null;
        render();
      });
      tabs.appendChild(btn);
    }

    return tabs;
  }

  function renderActiveTab(): HTMLElement {
    switch (state.activeTab) {
      case "notes":
        return renderNotesTab();
      case "inbox":
        return renderInboxTab();
      case "references":
        return renderReferencesTab();
      default:
        return renderNotesTab();
    }
  }

  // ============== NOTES TAB ==============

  function renderNotesTab(): HTMLElement {
    const content = document.createElement("div");
    content.className = "ext-notes-layout";

    // Sidebar with note list
    const sidebar = document.createElement("div");
    sidebar.className = "ext-notes-sidebar";

    // Category filter
    const categorySelect = document.createElement("select");
    categorySelect.className = "ext-select";
    categorySelect.innerHTML = `<option value="all">All Categories</option>`;
    if (state.data) {
      for (const cat of state.data.categories) {
        categorySelect.innerHTML += `<option value="${cat}" ${state.selectedCategory === cat ? "selected" : ""}>${cat}</option>`;
      }
    }
    categorySelect.addEventListener("change", (e) => {
      state.selectedCategory = (e.target as HTMLSelectElement).value;
      render();
    });
    sidebar.appendChild(categorySelect);

    // Note list
    const noteList = document.createElement("div");
    noteList.className = "ext-note-list";

    const notes = state.data
      ? getNotes(state.data, {
          category: state.selectedCategory,
          search: state.searchQuery,
        })
      : [];

    if (notes.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ext-empty";
      empty.textContent = "No notes found";
      noteList.appendChild(empty);
    } else {
      for (const note of notes) {
        const item = document.createElement("div");
        item.className = `ext-note-item ${state.selectedNoteId === note.id ? "ext-note-item-selected" : ""}`;

        item.innerHTML = `
          <div class="ext-note-item-title">${escapeHtml(note.title)}</div>
          <div class="ext-note-item-meta">
            <span class="ext-note-category">${note.category}</span>
            <span class="ext-note-date">${formatDate(note.updatedAt)}</span>
          </div>
          <div class="ext-note-tags">${note.tags.map((t) => `<span class="ext-tag">#${t}</span>`).join("")}</div>
        `;

        item.addEventListener("click", () => {
          state.selectedNoteId = note.id;
          state.editingNote = null;
          render();
        });

        noteList.appendChild(item);
      }
    }

    sidebar.appendChild(noteList);
    content.appendChild(sidebar);

    // Main content area - note viewer/editor
    const main = document.createElement("div");
    main.className = "ext-notes-main";

    if (state.editingNote) {
      main.appendChild(renderNoteEditor(state.editingNote));
    } else if (state.selectedNoteId && state.data) {
      const note = getNote(state.data, state.selectedNoteId);
      if (note) {
        main.appendChild(renderNoteViewer(note));
      }
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "ext-placeholder";
      placeholder.innerHTML = `
        <div class="ext-placeholder-icon">📝</div>
        <div class="ext-placeholder-text">Select a note or create a new one</div>
      `;
      main.appendChild(placeholder);
    }

    content.appendChild(main);
    return content;
  }

  function renderNoteViewer(note: Note): HTMLElement {
    const viewer = document.createElement("div");
    viewer.className = "ext-note-viewer";

    // Header with actions
    const header = document.createElement("div");
    header.className = "ext-note-header";

    const titleDiv = document.createElement("h3");
    titleDiv.className = "ext-note-title";
    titleDiv.textContent = note.title;
    header.appendChild(titleDiv);

    const actions = document.createElement("div");
    actions.className = "ext-note-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "ext-btn";
    editBtn.textContent = "✏️ Edit";
    editBtn.addEventListener("click", () => {
      state.editingNote = { ...note };
      render();
    });
    actions.appendChild(editBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "ext-btn ext-btn-danger";
    deleteBtn.textContent = "🗑️ Delete";
    deleteBtn.addEventListener("click", async () => {
      if (confirm(`Delete "${note.title}"?`)) {
        state.data = deleteNote(state.data!, note.id);
        state.selectedNoteId = null;
        await saveData();
        render();
      }
    });
    actions.appendChild(deleteBtn);

    header.appendChild(actions);
    viewer.appendChild(header);

    // Meta info
    const meta = document.createElement("div");
    meta.className = "ext-note-meta";
    meta.innerHTML = `
      <span class="ext-note-category">${note.category}</span>
      <span>Updated: ${formatDateTime(note.updatedAt)}</span>
      <span>Created: ${formatDateTime(note.createdAt)}</span>
    `;
    viewer.appendChild(meta);

    // Tags
    if (note.tags.length > 0) {
      const tagsDiv = document.createElement("div");
      tagsDiv.className = "ext-note-tags";
      tagsDiv.innerHTML = note.tags.map((t) => `<span class="ext-tag">#${t}</span>`).join("");
      viewer.appendChild(tagsDiv);
    }

    // Content (render as HTML for markdown-like display)
    const contentDiv = document.createElement("div");
    contentDiv.className = "ext-note-content";
    contentDiv.innerHTML = simpleMarkdown(note.content);
    viewer.appendChild(contentDiv);

    return viewer;
  }

  function renderNoteEditor(note: Note): HTMLElement {
    const editor = document.createElement("div");
    editor.className = "ext-note-editor";

    // Title input
    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "ext-input ext-input-title";
    titleInput.placeholder = "Note title";
    titleInput.value = note.title;
    titleInput.addEventListener("input", (e) => {
      note.title = (e.target as HTMLInputElement).value;
    });
    editor.appendChild(titleInput);

    // Category select
    const categoryRow = document.createElement("div");
    categoryRow.className = "ext-form-row";

    const categoryLabel = document.createElement("label");
    categoryLabel.textContent = "Category:";
    categoryRow.appendChild(categoryLabel);

    const categorySelect = document.createElement("select");
    categorySelect.className = "ext-select";
    if (state.data) {
      for (const cat of state.data.categories) {
        categorySelect.innerHTML += `<option value="${cat}" ${note.category === cat ? "selected" : ""}>${cat}</option>`;
      }
    }
    categorySelect.addEventListener("change", (e) => {
      note.category = (e.target as HTMLSelectElement).value;
    });
    categoryRow.appendChild(categorySelect);
    editor.appendChild(categoryRow);

    // Tags input
    const tagsRow = document.createElement("div");
    tagsRow.className = "ext-form-row";

    const tagsLabel = document.createElement("label");
    tagsLabel.textContent = "Tags (comma-separated):";
    tagsRow.appendChild(tagsLabel);

    const tagsInput = document.createElement("input");
    tagsInput.type = "text";
    tagsInput.className = "ext-input";
    tagsInput.value = note.tags.join(", ");
    tagsInput.addEventListener("input", (e) => {
      note.tags = (e.target as HTMLInputElement).value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    });
    tagsRow.appendChild(tagsInput);
    editor.appendChild(tagsRow);

    // Content textarea
    const contentArea = document.createElement("textarea");
    contentArea.className = "ext-textarea";
    contentArea.placeholder = "Note content (supports markdown)";
    contentArea.value = note.content;
    contentArea.rows = 15;
    contentArea.addEventListener("input", (e) => {
      note.content = (e.target as HTMLTextAreaElement).value;
    });
    editor.appendChild(contentArea);

    // Actions
    const actions = document.createElement("div");
    actions.className = "ext-editor-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "ext-btn";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      state.editingNote = null;
      render();
    });
    actions.appendChild(cancelBtn);

    const saveBtn = document.createElement("button");
    saveBtn.className = "ext-btn ext-btn-primary";
    saveBtn.textContent = "💾 Save";
    saveBtn.addEventListener("click", async () => {
      if (!note.title.trim()) {
        alert("Title is required");
        return;
      }
      state.data = updateNote(state.data!, note.id, {
        title: note.title,
        content: note.content,
        category: note.category,
        tags: note.tags,
      });
      state.editingNote = null;
      await saveData();
      render();
    });
    actions.appendChild(saveBtn);

    editor.appendChild(actions);
    return editor;
  }

  // ============== INBOX TAB ==============

  function renderInboxTab(): HTMLElement {
    const content = document.createElement("div");
    content.className = "ext-inbox-content";

    // Quick capture form
    const captureForm = document.createElement("div");
    captureForm.className = "ext-quick-capture";

    const captureTitle = document.createElement("input");
    captureTitle.type = "text";
    captureTitle.className = "ext-input";
    captureTitle.placeholder = "Quick capture title...";
    captureTitle.id = "inbox-title";

    const captureContent = document.createElement("textarea");
    captureContent.className = "ext-textarea";
    captureContent.placeholder = "Content (optional)";
    captureContent.rows = 3;
    captureContent.id = "inbox-content";

    const captureBtn = document.createElement("button");
    captureBtn.className = "ext-btn ext-btn-primary";
    captureBtn.textContent = "➕ Add to Inbox";
    captureBtn.addEventListener("click", async () => {
      const title = (document.getElementById("inbox-title") as HTMLInputElement).value.trim();
      const captureContentEl = document.getElementById("inbox-content") as HTMLTextAreaElement;

      if (!title) {
        alert("Title is required");
        return;
      }

      state.data = addToInbox(state.data!, {
        title,
        content: captureContentEl.value,
      });
      await saveData();

      // Clear form
      (document.getElementById("inbox-title") as HTMLInputElement).value = "";
      captureContentEl.value = "";
      render();
    });

    captureForm.appendChild(captureTitle);
    captureForm.appendChild(captureContent);
    captureForm.appendChild(captureBtn);
    content.appendChild(captureForm);

    // Inbox items list
    const itemList = document.createElement("div");
    itemList.className = "ext-inbox-list";

    const items = state.data ? getInboxItems(state.data) : [];

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ext-empty";
      empty.innerHTML = `
        <div class="ext-empty-icon">📥</div>
        <div>Inbox is empty</div>
        <div class="ext-empty-hint">Use quick capture above to add items</div>
      `;
      itemList.appendChild(empty);
    } else {
      for (const item of items) {
        const itemEl = document.createElement("div");
        itemEl.className = "ext-inbox-item";

        itemEl.innerHTML = `
          <div class="ext-inbox-item-header">
            <span class="ext-inbox-item-title">${escapeHtml(item.title)}</span>
            <span class="ext-inbox-item-date">${formatDateTime(item.createdAt)}</span>
          </div>
          ${item.content ? `<div class="ext-inbox-item-content">${escapeHtml(item.content)}</div>` : ""}
        `;

        const actions = document.createElement("div");
        actions.className = "ext-inbox-item-actions";

        // Move to notes button
        const moveBtn = document.createElement("button");
        moveBtn.className = "ext-btn ext-btn-small";
        moveBtn.textContent = "📝 To Note";
        moveBtn.addEventListener("click", async () => {
          state.data = moveInboxToNote(state.data!, item.id);
          await saveData();
          render();
        });
        actions.appendChild(moveBtn);

        // Delete button
        const delBtn = document.createElement("button");
        delBtn.className = "ext-btn ext-btn-small ext-btn-danger";
        delBtn.textContent = "🗑️";
        delBtn.addEventListener("click", async () => {
          state.data = deleteInboxItem(state.data!, item.id);
          await saveData();
          render();
        });
        actions.appendChild(delBtn);

        itemEl.appendChild(actions);
        itemList.appendChild(itemEl);
      }
    }

    content.appendChild(itemList);
    return content;
  }

  // ============== REFERENCES TAB ==============

  function renderReferencesTab(): HTMLElement {
    const content = document.createElement("div");
    content.className = "ext-references-content";

    // Add reference form
    const addForm = document.createElement("div");
    addForm.className = "ext-add-form";

    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.className = "ext-input";
    urlInput.placeholder = "URL";
    urlInput.id = "ref-url";

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "ext-input";
    titleInput.placeholder = "Title";
    titleInput.id = "ref-title";

    const notesInput = document.createElement("input");
    notesInput.type = "text";
    notesInput.className = "ext-input";
    notesInput.placeholder = "Notes (optional)";
    notesInput.id = "ref-notes";

    const addBtn = document.createElement("button");
    addBtn.className = "ext-btn ext-btn-primary";
    addBtn.textContent = "🔗 Add Reference";
    addBtn.addEventListener("click", async () => {
      const url = (document.getElementById("ref-url") as HTMLInputElement).value.trim();
      const title = (document.getElementById("ref-title") as HTMLInputElement).value.trim();
      const notes = (document.getElementById("ref-notes") as HTMLInputElement).value;

      if (!url || !title) {
        alert("URL and Title are required");
        return;
      }

      state.data = addReference(state.data!, { url, title, notes });
      await saveData();

      // Clear form
      (document.getElementById("ref-url") as HTMLInputElement).value = "";
      (document.getElementById("ref-title") as HTMLInputElement).value = "";
      (document.getElementById("ref-notes") as HTMLInputElement).value = "";
      render();
    });

    addForm.appendChild(urlInput);
    addForm.appendChild(titleInput);
    addForm.appendChild(notesInput);
    addForm.appendChild(addBtn);
    content.appendChild(addForm);

    // References list
    const refList = document.createElement("div");
    refList.className = "ext-ref-list";

    const refs = state.data ? getReferences(state.data, state.searchQuery) : [];

    if (refs.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ext-empty";
      empty.innerHTML = `
        <div class="ext-empty-icon">🔗</div>
        <div>No references saved</div>
        <div class="ext-empty-hint">Add bookmarks and links above</div>
      `;
      refList.appendChild(empty);
    } else {
      for (const ref of refs) {
        const refEl = document.createElement("div");
        refEl.className = "ext-ref-item";

        refEl.innerHTML = `
          <div class="ext-ref-item-header">
            <a href="${escapeHtml(ref.url)}" target="_blank" class="ext-ref-link">${escapeHtml(ref.title)}</a>
            <span class="ext-ref-date">${formatDate(ref.createdAt)}</span>
          </div>
          <div class="ext-ref-url">${escapeHtml(ref.url)}</div>
          ${ref.notes ? `<div class="ext-ref-notes">${escapeHtml(ref.notes)}</div>` : ""}
        `;

        const actions = document.createElement("div");
        actions.className = "ext-ref-item-actions";

        const delBtn = document.createElement("button");
        delBtn.className = "ext-btn ext-btn-small ext-btn-danger";
        delBtn.textContent = "🗑️";
        delBtn.addEventListener("click", async () => {
          state.data = deleteReference(state.data!, ref.id);
          await saveData();
          render();
        });
        actions.appendChild(delBtn);

        refEl.appendChild(actions);
        refList.appendChild(refEl);
      }
    }

    content.appendChild(refList);
    return content;
  }

  // ============== CREATE MODAL ==============

  function renderCreateModal(): HTMLElement {
    const modal = document.createElement("div");
    modal.className = "ext-modal-overlay";

    const modalContent = document.createElement("div");
    modalContent.className = "ext-modal";

    const title = document.createElement("h3");
    title.textContent =
      state.modalType === "note"
        ? "📝 Create Note"
        : state.modalType === "inbox"
          ? "📥 Quick Capture"
          : "🔗 Add Reference";
    modalContent.appendChild(title);

    if (state.modalType === "note") {
      modalContent.appendChild(renderCreateNoteForm());
    } else if (state.modalType === "inbox") {
      modalContent.appendChild(renderCreateInboxForm());
    } else {
      modalContent.appendChild(renderCreateReferenceForm());
    }

    const closeBtn = document.createElement("button");
    closeBtn.className = "ext-modal-close";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => {
      state.showCreateModal = false;
      state.modalType = null;
      render();
    });
    modalContent.appendChild(closeBtn);

    modal.appendChild(modalContent);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        state.showCreateModal = false;
        state.modalType = null;
        render();
      }
    });

    return modal;
  }

  function renderCreateNoteForm(): HTMLElement {
    const form = document.createElement("div");
    form.className = "ext-create-form";

    form.innerHTML = `
      <input type="text" class="ext-input" placeholder="Title" id="new-note-title">
      <select class="ext-select" id="new-note-category">
        ${state.data?.categories.map((c) => `<option value="${c}">${c}</option>`).join("")}
      </select>
      <input type="text" class="ext-input" placeholder="Tags (comma-separated)" id="new-note-tags">
      <textarea class="ext-textarea" placeholder="Content" rows="8" id="new-note-content"></textarea>
    `;

    const createBtn = document.createElement("button");
    createBtn.className = "ext-btn ext-btn-primary";
    createBtn.textContent = "Create Note";
    createBtn.addEventListener("click", async () => {
      const title = (document.getElementById("new-note-title") as HTMLInputElement).value.trim();
      const category = (document.getElementById("new-note-category") as HTMLSelectElement).value;
      const tags = (document.getElementById("new-note-tags") as HTMLInputElement).value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const content = (document.getElementById("new-note-content") as HTMLTextAreaElement).value;

      if (!title) {
        alert("Title is required");
        return;
      }

      state.data = createNote(state.data!, { title, content, category, tags });
      await saveData();
      state.showCreateModal = false;
      state.modalType = null;
      render();
    });

    form.appendChild(createBtn);
    return form;
  }

  function renderCreateInboxForm(): HTMLElement {
    const form = document.createElement("div");
    form.className = "ext-create-form";

    form.innerHTML = `
      <input type="text" class="ext-input" placeholder="Title" id="new-inbox-title">
      <textarea class="ext-textarea" placeholder="Content (optional)" rows="4" id="new-inbox-content"></textarea>
    `;

    const createBtn = document.createElement("button");
    createBtn.className = "ext-btn ext-btn-primary";
    createBtn.textContent = "Add to Inbox";
    createBtn.addEventListener("click", async () => {
      const title = (document.getElementById("new-inbox-title") as HTMLInputElement).value.trim();
      const content = (document.getElementById("new-inbox-content") as HTMLTextAreaElement).value;

      if (!title) {
        alert("Title is required");
        return;
      }

      state.data = addToInbox(state.data!, { title, content });
      await saveData();
      state.showCreateModal = false;
      state.modalType = null;
      render();
    });

    form.appendChild(createBtn);
    return form;
  }

  function renderCreateReferenceForm(): HTMLElement {
    const form = document.createElement("div");
    form.className = "ext-create-form";

    form.innerHTML = `
      <input type="url" class="ext-input" placeholder="URL" id="new-ref-url">
      <input type="text" class="ext-input" placeholder="Title" id="new-ref-title">
      <input type="text" class="ext-input" placeholder="Notes (optional)" id="new-ref-notes">
    `;

    const createBtn = document.createElement("button");
    createBtn.className = "ext-btn ext-btn-primary";
    createBtn.textContent = "Add Reference";
    createBtn.addEventListener("click", async () => {
      const url = (document.getElementById("new-ref-url") as HTMLInputElement).value.trim();
      const title = (document.getElementById("new-ref-title") as HTMLInputElement).value.trim();
      const notes = (document.getElementById("new-ref-notes") as HTMLInputElement).value;

      if (!url || !title) {
        alert("URL and Title are required");
        return;
      }

      state.data = addReference(state.data!, { url, title, notes });
      await saveData();
      state.showCreateModal = false;
      state.modalType = null;
      render();
    });

    form.appendChild(createBtn);
    return form;
  }

  // ============== HELPERS ==============

  function renderLoading(): HTMLElement {
    const loading = document.createElement("div");
    loading.className = "ext-loading";
    loading.innerHTML = `<div class="ext-spinner"></div><div>Loading...</div>`;
    return loading;
  }

  function renderError(message: string): HTMLElement {
    const error = document.createElement("div");
    error.className = "ext-error";
    error.innerHTML = `<div>❌ ${escapeHtml(message)}</div><button class="ext-btn" onclick="location.reload()">Retry</button>`;
    return error;
  }

  function escapeHtml(str: string): string {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function simpleMarkdown(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/^- (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>")
      .replace(/\n/g, "<br>");
  }

  // Initialize
  loadData();

  return container;
}

// CSS styles for knowledge module
export const knowledgeStyles = `
.ext-knowledge {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.ext-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.ext-header h2 {
  margin: 0;
  font-size: 24px;
}

.ext-header-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

.ext-search-input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  width: 200px;
}

.ext-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  border-bottom: 2px solid #eee;
  padding-bottom: 10px;
}

.ext-tab {
  padding: 10px 20px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  border-radius: 6px;
  transition: all 0.2s;
}

.ext-tab:hover {
  background: #f5f5f5;
}

.ext-tab-active {
  background: #e3f2fd;
  color: #1976d2;
  font-weight: 600;
}

.ext-tab-badge {
  background: #ccc;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  margin-left: 6px;
}

.ext-tab-active .ext-tab-badge {
  background: #1976d2;
  color: white;
}

.ext-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.ext-btn:hover {
  background: #f5f5f5;
}

.ext-btn-primary {
  background: #1976d2;
  color: white;
  border-color: #1565c0;
}

.ext-btn-primary:hover {
  background: #1565c0;
}

.ext-btn-danger {
  color: #d32f2f;
  border-color: #d32f2f;
}

.ext-btn-danger:hover {
  background: #ffebee;
}

.ext-btn-small {
  padding: 4px 10px;
  font-size: 12px;
}

.ext-input, .ext-select, .ext-textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  margin-bottom: 12px;
  box-sizing: border-box;
}

.ext-input-title {
  font-size: 20px;
  font-weight: 600;
}

.ext-textarea {
  resize: vertical;
  min-height: 100px;
  font-family: inherit;
}

/* Notes Layout */
.ext-notes-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 20px;
  min-height: 500px;
}

.ext-notes-sidebar {
  border-right: 1px solid #eee;
  padding-right: 20px;
}

.ext-note-list {
  max-height: 450px;
  overflow-y: auto;
}

.ext-note-item {
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 8px;
  transition: all 0.2s;
}

.ext-note-item:hover {
  background: #f5f5f5;
}

.ext-note-item-selected {
  background: #e3f2fd;
  border: 1px solid #90caf9;
}

.ext-note-item-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.ext-note-item-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #666;
}

.ext-note-category {
  background: #e0e0e0;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
}

.ext-note-tags {
  margin-top: 6px;
}

.ext-tag {
  color: #1976d2;
  font-size: 12px;
  margin-right: 6px;
}

/* Note Viewer/Editor */
.ext-notes-main {
  padding-left: 20px;
}

.ext-note-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.ext-note-title {
  margin: 0;
  font-size: 24px;
}

.ext-note-actions {
  display: flex;
  gap: 8px;
}

.ext-note-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #666;
  margin-bottom: 12px;
}

.ext-note-content {
  background: #fafafa;
  padding: 20px;
  border-radius: 8px;
  line-height: 1.6;
}

.ext-note-content h1, .ext-note-content h2, .ext-note-content h3 {
  margin-top: 0;
}

.ext-note-content code {
  background: #e8e8e8;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.ext-editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.ext-form-row {
  margin-bottom: 12px;
}

.ext-form-row label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
  font-size: 13px;
}

/* Inbox */
.ext-quick-capture {
  background: #f5f5f5;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.ext-inbox-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ext-inbox-item {
  background: white;
  border: 1px solid #eee;
  padding: 16px;
  border-radius: 8px;
}

.ext-inbox-item-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.ext-inbox-item-title {
  font-weight: 600;
}

.ext-inbox-item-date {
  color: #666;
  font-size: 12px;
}

.ext-inbox-item-content {
  color: #444;
  font-size: 14px;
  margin-bottom: 12px;
}

.ext-inbox-item-actions {
  display: flex;
  gap: 8px;
}

/* References */
.ext-add-form {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: 12px;
  margin-bottom: 20px;
  align-items: start;
}

.ext-add-form .ext-input {
  margin-bottom: 0;
}

.ext-ref-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ext-ref-item {
  background: white;
  border: 1px solid #eee;
  padding: 16px;
  border-radius: 8px;
}

.ext-ref-item-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.ext-ref-link {
  font-weight: 600;
  color: #1976d2;
  text-decoration: none;
}

.ext-ref-link:hover {
  text-decoration: underline;
}

.ext-ref-url {
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.ext-ref-notes {
  color: #444;
  font-size: 14px;
}

.ext-ref-item-actions {
  margin-top: 12px;
}

/* Empty states */
.ext-empty, .ext-placeholder {
  text-align: center;
  padding: 40px;
  color: #666;
}

.ext-empty-icon, .ext-placeholder-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.ext-empty-hint {
  font-size: 13px;
  color: #999;
}

/* Loading/Error */
.ext-loading {
  text-align: center;
  padding: 60px;
}

.ext-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #eee;
  border-top-color: #1976d2;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.ext-error {
  text-align: center;
  padding: 40px;
  color: #d32f2f;
}

/* Modal */
.ext-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.ext-modal {
  background: white;
  padding: 24px;
  border-radius: 12px;
  width: 500px;
  max-width: 90vw;
  position: relative;
}

.ext-modal h3 {
  margin-top: 0;
}

.ext-modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #666;
}

.ext-create-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Responsive */
@media (max-width: 768px) {
  .ext-notes-layout {
    grid-template-columns: 1fr;
  }
  
  .ext-notes-sidebar {
    border-right: none;
    border-bottom: 1px solid #eee;
    padding-right: 0;
    padding-bottom: 20px;
  }
  
  .ext-notes-main {
    padding-left: 0;
  }
  
  .ext-add-form {
    grid-template-columns: 1fr;
  }
}
`;
