import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import type { GatewayBrowserClient } from "../../gateway.js";
import { icons } from "../../icons.js";
import {
  loadKnowledgeData,
  saveKnowledgeData,
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  getInboxItems,
  addToInbox,
  deleteInboxItem,
  moveInboxToNote,
  getReferences,
  addReference,
  deleteReference,
  formatDate,
  type KnowledgeData,
  type SubTab,
  type Note,
  type InboxItem,
  type Reference,
} from "./controller.js";

@customElement("knowledge-view")
export class KnowledgeView extends LitElement {
  @property({ attribute: false })
  gateway: GatewayBrowserClient | null = null;

  @state() private data: KnowledgeData | null = null;
  @state() private loading = true;
  @state() private saving = false;
  @state() private activeTab: SubTab = "inbox";
  @state() private search = "";
  @state() private selectedCategory = "all";
  @state() private editingNoteId: string | null = null;
  @state() private showCreateModal = false;
  @state() private createType: "note" | "link" | "inbox" = "inbox";

  // Form state
  @state() private formTitle = "";
  @state() private formContent = "";
  @state() private formUrl = "";
  @state() private formCategory = "general";
  @state() private formTags = "";

  static styles = css`
    :host {
      display: block;
      height: 100%;
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-body);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* Main content container - centered and compact */
    .main-container {
      max-width: 900px;
      margin: 0 auto;
      width: 100%;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 20px 0;
      flex-wrap: wrap;
      gap: 12px;
    }

    .title {
      font-size: 20px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--text-strong);
    }

    .title svg {
      width: 24px;
      height: 24px;
      color: var(--muted);
    }

    .icon {
      display: inline-flex;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .icon svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .icon-lg {
      width: 20px;
      height: 20px;
    }

    .icon-xl {
      width: 32px;
      height: 32px;
    }

    .header-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .search-input {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 8px 12px;
      color: var(--text);
      font-size: 14px;
      width: 250px;
      max-width: 300px;
      outline: none;
    }
    .search-input:focus {
      border-color: var(--accent);
    }
    .search-input::placeholder {
      color: var(--muted);
    }

    .tabs {
      display: flex;
      gap: 0;
      padding: 16px 20px 0;
      border-bottom: 1px solid var(--border);
    }

    .tab {
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
      color: var(--text);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.15s;
      background: none;
      border-top: none;
      border-left: none;
      border-right: none;
      display: flex;
      align-items: center;
      gap: 6px;
      opacity: 0.7;
    }
    .tab:hover {
      color: var(--text);
      background: var(--bg-hover);
      opacity: 1;
    }
    .tab.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
      background: var(--accent-subtle);
      opacity: 1;
    }

    .tab-badge {
      background: var(--border);
      padding: 2px 8px;
      border-radius: var(--radius-full);
      font-size: 11px;
      margin-left: 6px;
      color: var(--text);
      font-weight: 500;
      min-width: 18px;
      text-align: center;
    }

    .content {
      flex: 1;
      overflow-y: auto;
      padding: 24px 20px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 9px 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--bg-elevated);
      color: var(--text);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      letter-spacing: -0.01em;
      transition:
        border-color var(--duration-fast) var(--ease-out),
        background var(--duration-fast) var(--ease-out),
        box-shadow var(--duration-fast) var(--ease-out),
        transform var(--duration-fast) var(--ease-out);
    }
    .btn:hover {
      background: var(--bg-hover);
      border-color: var(--border-strong);
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }
    .btn:active {
      transform: translateY(0);
      box-shadow: none;
    }
    .btn svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
      fill: none;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
      flex-shrink: 0;
    }

    .btn-primary {
      background: var(--accent);
      border-color: var(--accent);
      color: white;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      font-weight: 600;
    }
    .btn-primary:hover {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
      box-shadow:
        var(--shadow-md),
        0 0 20px var(--accent-glow);
    }

    .btn-sm {
      padding: 6px 10px;
      font-size: 12px;
    }
    .btn-danger {
      border-color: var(--border);
      background: var(--danger-subtle);
      color: var(--danger);
    }
    .btn-danger:hover {
      background: var(--danger);
      color: white;
      border-color: var(--danger);
      transform: translateY(-1px);
    }

    /* Cards */
    .card-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 16px;
      transition:
        border-color var(--duration-fast) var(--ease-out),
        box-shadow var(--duration-fast) var(--ease-out),
        background var(--duration-fast) var(--ease-out);
    }
    .card:hover {
      border-color: var(--border-strong);
      box-shadow: var(--shadow-sm);
      background: var(--bg-hover);
    }

    .card-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .card-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-strong);
      word-break: break-word;
    }

    .card-meta {
      font-size: 12px;
      color: var(--muted);
      margin-top: 6px;
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .card-content {
      font-size: 14px;
      color: var(--text);
      margin-top: 12px;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.5;
    }

    .card-actions {
      display: flex;
      gap: 6px;
      flex-shrink: 0;
    }

    .tag {
      background: var(--accent-subtle);
      color: var(--accent);
      padding: 2px 8px;
      border-radius: var(--radius-full);
      font-size: 11px;
    }

    .category-badge {
      background: var(--bg-muted);
      color: var(--muted);
      padding: 2px 8px;
      border-radius: var(--radius-full);
      font-size: 11px;
    }

    .link-url {
      font-size: 12px;
      color: var(--accent);
      text-decoration: none;
      word-break: break-all;
    }
    .link-url:hover {
      text-decoration: underline;
    }

    /* Empty state */
    .empty {
      text-align: center;
      padding: 48px 20px;
      color: var(--muted);
    }
    .empty-icon {
      font-size: 32px;
      margin-bottom: 12px;
    }
    .empty-title {
      font-size: 16px;
      font-weight: 500;
      margin-bottom: 8px;
      color: var(--text);
    }
    .empty-text {
      font-size: 13px;
      margin-bottom: 16px;
    }

    /* Quick add bar */
    .quick-add {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
    }

    .quick-add-input {
      flex: 1;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 10px 14px;
      color: var(--text);
      font-size: 14px;
      outline: none;
      max-width: 600px;
    }
    .quick-add-input:focus {
      border-color: var(--accent);
    }
    .quick-add-input::placeholder {
      color: var(--muted);
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal {
      background: var(--card);
      border-radius: var(--radius-lg);
      padding: 24px;
      max-width: 520px;
      width: 90%;
      border: 1px solid var(--border);
      box-shadow: var(--shadow-xl);
    }

    .modal-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-strong);
      margin-bottom: 16px;
    }

    .form-group {
      display: grid;
      gap: 6px;
      margin-bottom: 14px;
    }

    .form-group label {
      color: var(--muted);
      font-size: 13px;
      font-weight: 500;
    }

    .form-input {
      width: 100%;
      box-sizing: border-box;
      background: var(--card);
      border: 1px solid var(--input);
      border-radius: var(--radius-md);
      padding: 8px 12px;
      color: var(--text);
      font-size: 14px;
      font-family: inherit;
      outline: none;
      box-shadow: inset 0 1px 0 var(--card-highlight);
      transition:
        border-color var(--duration-fast) ease,
        box-shadow var(--duration-fast) ease;
    }
    .form-input:focus {
      border-color: var(--ring);
      box-shadow: var(--focus-ring);
    }

    .form-textarea {
      min-height: 100px;
      resize: vertical;
    }

    .form-select {
      background: var(--card);
      border: 1px solid var(--input);
      border-radius: var(--radius-md);
      padding: 8px 12px;
      color: var(--text);
      font-size: 14px;
      cursor: pointer;
      box-shadow: inset 0 1px 0 var(--card-highlight);
    }
    .form-select:focus {
      border-color: var(--ring);
      box-shadow: var(--focus-ring);
      outline: none;
    }

    .modal-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 20px;
    }

    .saving-indicator {
      font-size: 12px;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid var(--border);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    /* Filter bar */
    .filter-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
      flex-wrap: wrap;
      align-items: center;
    }

    .filter-chip {
      padding: 4px 12px;
      border-radius: var(--radius-full);
      font-size: 12px;
      cursor: pointer;
      background: var(--panel);
      border: 1px solid var(--border);
      color: var(--muted);
      transition: all 0.15s;
    }
    .filter-chip:hover {
      border-color: var(--accent);
      color: var(--text);
    }
    .filter-chip.active {
      background: var(--accent);
      color: var(--accent-foreground);
      border-color: var(--accent);
    }

    /* Note editing inline */
    .note-editor {
      background: var(--card);
      border: 1px solid var(--accent);
      border-radius: var(--radius-lg);
      padding: 16px;
      margin-bottom: 8px;
      box-shadow: 0 0 0 3px var(--accent-subtle);
    }

    .note-editor textarea {
      width: 100%;
      box-sizing: border-box;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 8px;
      color: var(--text);
      font-size: 13px;
      font-family: inherit;
      outline: none;
      resize: vertical;
      min-height: 120px;
    }

    @media (max-width: 600px) {
      .main-container {
        max-width: 100%;
        padding: 0 12px;
      }
      .header {
        padding: 12px 0 0;
      }
      .tabs {
        padding: 12px 0 0;
      }
      .content {
        padding: 12px 0;
      }
      .search-input {
        width: 140px;
        max-width: 200px;
      }
      .quick-add-input {
        max-width: none;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadData();
  }

  private async loadData() {
    if (!this.gateway) {
      this.loading = false;
      return;
    }
    this.loading = true;
    this.data = await loadKnowledgeData(this.gateway);
    this.loading = false;
  }

  private async saveData() {
    if (!this.gateway || !this.data) return;
    this.saving = true;
    await saveKnowledgeData(this.gateway, this.data);
    this.saving = false;
  }

  private resetForm() {
    this.formTitle = "";
    this.formContent = "";
    this.formUrl = "";
    this.formCategory = "general";
    this.formTags = "";
    this.showCreateModal = false;
  }

  private handleQuickAdd(e: KeyboardEvent) {
    if (e.key !== "Enter") return;
    const input = e.target as HTMLInputElement;
    const value = input.value.trim();
    if (!value || !this.data) return;

    if (this.activeTab === "inbox") {
      this.data = addToInbox(this.data, { title: value, content: "" });
    } else if (this.activeTab === "references" && value.startsWith("http")) {
      this.data = addReference(this.data, { url: value, title: value, notes: "" });
    } else if (this.activeTab === "notes") {
      this.data = createNote(this.data, {
        title: value,
        content: "",
        category: "general",
        tags: [],
      });
    }

    input.value = "";
    this.saveData();
  }

  private handleCreate() {
    if (!this.data) return;

    if (this.createType === "inbox") {
      this.data = addToInbox(this.data, { title: this.formTitle, content: this.formContent });
    } else if (this.createType === "link") {
      this.data = addReference(this.data, {
        url: this.formUrl,
        title: this.formTitle,
        notes: this.formContent,
      });
    } else if (this.createType === "note") {
      const tags = this.formTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      this.data = createNote(this.data, {
        title: this.formTitle,
        content: this.formContent,
        category: this.formCategory,
        tags,
      });
    }

    this.saveData();
    this.resetForm();
  }

  private handleDeleteInbox(id: string) {
    if (!this.data) return;
    this.data = deleteInboxItem(this.data, id);
    this.saveData();
  }

  private handlePromoteInbox(id: string) {
    if (!this.data) return;
    this.data = moveInboxToNote(this.data, id, "general", []);
    this.saveData();
  }

  private handleDeleteNote(id: string) {
    if (!this.data) return;
    this.data = deleteNote(this.data, id);
    this.editingNoteId = null;
    this.saveData();
  }

  private handleDeleteRef(id: string) {
    if (!this.data) return;
    this.data = deleteReference(this.data, id);
    this.saveData();
  }

  private handleUpdateNote(id: string, field: string, value: string) {
    if (!this.data) return;
    this.data = updateNote(this.data, id, { [field]: value, updatedAt: new Date().toISOString() });
    this.saveData();
  }

  private openCreate(type: "note" | "link" | "inbox") {
    this.createType = type;
    this.resetForm();
    this.showCreateModal = true;
  }

  // --- Render helpers ---

  // Icons are now imported from ../../icons.js

  private renderInboxTab() {
    if (!this.data) return nothing;
    const items = getInboxItems(this.data);

    return html`
      <div class="quick-add">
        <input class="quick-add-input" placeholder="Quick capture — press Enter" @keydown=${this.handleQuickAdd} />
        <button class="btn btn-primary btn-sm" @click=${() => this.openCreate("inbox")}><span class="icon">${icons.plus}</span> Add</button>
      </div>
      ${
        items.length === 0
          ? html`<div class="empty"><div class="empty-icon"><span class="icon icon-xl">${icons.inbox}</span></div><div class="empty-title">Inbox empty</div><div class="empty-text">Capture quick thoughts here. Process them later into notes.</div></div>`
          : html`
          <div class="card-list">
            ${repeat(
              items,
              (i) => i.id,
              (item: InboxItem) => html`
              <div class="card">
                <div class="card-header">
                  <div>
                    <div class="card-title">${item.title}</div>
                    <div class="card-meta"><span>${formatDate(item.createdAt)}</span></div>
                  </div>
                  <div class="card-actions">
                    <button class="btn btn-sm" title="Move to Notes" @click=${() => this.handlePromoteInbox(item.id)}><span class="icon">${icons.arrowRight}</span> Note</button>
                    <button class="btn btn-sm btn-danger" @click=${() => this.handleDeleteInbox(item.id)}><span class="icon">${icons.x}</span></button>
                  </div>
                </div>
                ${item.content ? html`<div class="card-content">${item.content}</div>` : nothing}
              </div>
            `,
            )}
          </div>
        `
      }
    `;
  }

  private renderNotesTab() {
    if (!this.data) return nothing;
    const notes = getNotes(this.data, {
      category: this.selectedCategory,
      search: this.search,
    });

    return html`
      <div class="filter-bar">
        <button class="filter-chip ${this.selectedCategory === "all" ? "active" : ""}" @click=${() => {
          this.selectedCategory = "all";
        }}>All</button>
        ${this.data.categories.map(
          (cat) => html`
          <button class="filter-chip ${this.selectedCategory === cat ? "active" : ""}" @click=${() => {
            this.selectedCategory = cat;
          }}>${cat}</button>
        `,
        )}
        <div style="flex:1"></div>
        <button class="btn btn-primary btn-sm" @click=${() => this.openCreate("note")}><span class="icon">${icons.plus}</span> New Note</button>
      </div>
      ${
        notes.length === 0
          ? html`<div class="empty"><div class="empty-icon"><span class="icon icon-xl">${icons.fileText}</span></div><div class="empty-title">No notes yet</div><div class="empty-text">Create your first note to start building your knowledge base.</div></div>`
          : html`
          <div class="card-list">
            ${repeat(
              notes,
              (n) => n.id,
              (note: Note) =>
                this.editingNoteId === note.id
                  ? this.renderNoteEditor(note)
                  : html`
                <div class="card" @dblclick=${() => {
                  this.editingNoteId = note.id;
                }}>
                  <div class="card-header">
                    <div>
                      <div class="card-title">${note.title}</div>
                      <div class="card-meta">
                        <span class="category-badge">${note.category}</span>
                        ${note.tags.map((t) => html`<span class="tag">${t}</span>`)}
                        <span>${formatDate(note.updatedAt)}</span>
                      </div>
                    </div>
                    <div class="card-actions">
                      <button class="btn btn-sm" @click=${() => {
                        this.editingNoteId = note.id;
                      }}><span class="icon">${icons.edit}</span></button>
                      <button class="btn btn-sm btn-danger" @click=${() => this.handleDeleteNote(note.id)}><span class="icon">${icons.x}</span></button>
                    </div>
                  </div>
                  ${note.content ? html`<div class="card-content">${note.content.slice(0, 200)}${note.content.length > 200 ? "…" : ""}</div>` : nothing}
                </div>
              `,
            )}
          </div>
        `
      }
    `;
  }

  private renderNoteEditor(note: Note) {
    return html`
      <div class="note-editor">
        <div class="form-group">
          <input class="form-input" .value=${note.title}
            @blur=${(e: FocusEvent) => this.handleUpdateNote(note.id, "title", (e.target as HTMLInputElement).value)} />
        </div>
        <div class="form-group">
          <textarea class="form-input form-textarea" .value=${note.content}
            @blur=${(e: FocusEvent) => this.handleUpdateNote(note.id, "content", (e.target as HTMLTextAreaElement).value)}></textarea>
        </div>
        <button class="btn btn-sm" @click=${() => {
          this.editingNoteId = null;
        }}>Done</button>
      </div>
    `;
  }

  private renderReferencesTab() {
    if (!this.data) return nothing;
    const refs = getReferences(this.data, this.search);

    return html`
      <div class="quick-add">
        <input class="quick-add-input" placeholder="Paste URL — press Enter" @keydown=${this.handleQuickAdd} />
        <button class="btn btn-primary btn-sm" @click=${() => this.openCreate("link")}><span class="icon">${icons.plus}</span> Add Link</button>
      </div>
      ${
        refs.length === 0
          ? html`<div class="empty"><div class="empty-icon"><span class="icon icon-xl">${icons.link}</span></div><div class="empty-title">No links saved</div><div class="empty-text">Save URLs, articles, and references here.</div></div>`
          : html`
          <div class="card-list">
            ${repeat(
              refs,
              (r) => r.id,
              (ref: Reference) => html`
              <div class="card">
                <div class="card-header">
                  <div>
                    <div class="card-title">${ref.title}</div>
                    <div class="card-meta">
                      <a class="link-url" href=${ref.url} target="_blank" rel="noopener">${ref.url.slice(0, 60)}${ref.url.length > 60 ? "…" : ""}</a>
                      <span>${formatDate(ref.createdAt)}</span>
                    </div>
                  </div>
                  <div class="card-actions">
                    <button class="btn btn-sm btn-danger" @click=${() => this.handleDeleteRef(ref.id)}><span class="icon">${icons.x}</span></button>
                  </div>
                </div>
                ${ref.notes ? html`<div class="card-content">${ref.notes}</div>` : nothing}
              </div>
            `,
            )}
          </div>
        `
      }
    `;
  }

  private renderCreateModal() {
    if (!this.showCreateModal) return nothing;

    const titles: Record<string, string> = {
      inbox: "Quick Capture",
      note: "New Note",
      link: "Save Link",
    };

    return html`
      <div class="modal-overlay" @click=${() => this.resetForm()}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-title">${titles[this.createType]}</div>
          <div class="form-group">
            <label>Title</label>
            <input class="form-input" placeholder="Title..." .value=${this.formTitle}
              @input=${(e: InputEvent) => {
                this.formTitle = (e.target as HTMLInputElement).value;
              }} />
          </div>
          ${
            this.createType === "link"
              ? html`<div class="form-group"><label>URL</label><input class="form-input" placeholder="https://..." .value=${this.formUrl}
                @input=${(e: InputEvent) => {
                  this.formUrl = (e.target as HTMLInputElement).value;
                }} /></div>`
              : nothing
          }
          <div class="form-group">
            <label>${this.createType === "link" ? "Notes" : "Content"}</label>
            <textarea class="form-input form-textarea" placeholder="Write something..." .value=${this.formContent}
              @input=${(e: InputEvent) => {
                this.formContent = (e.target as HTMLTextAreaElement).value;
              }}></textarea>
          </div>
          ${
            this.createType === "note" && this.data
              ? html`
              <div class="form-group">
                <label>Category</label>
                <select class="form-select" .value=${this.formCategory}
                  @change=${(e: Event) => {
                    this.formCategory = (e.target as HTMLSelectElement).value;
                  }}>
                  ${this.data.categories.map((c) => html`<option value=${c}>${c}</option>`)}
                </select>
              </div>
              <div class="form-group">
                <label>Tags (comma-separated)</label>
                <input class="form-input" placeholder="tag1, tag2" .value=${this.formTags}
                  @input=${(e: InputEvent) => {
                    this.formTags = (e.target as HTMLInputElement).value;
                  }} />
              </div>
            `
              : nothing
          }
          <div class="modal-actions">
            <button class="btn" @click=${() => this.resetForm()}>Cancel</button>
            <button class="btn btn-primary" @click=${() => this.handleCreate()} ?disabled=${!this.formTitle.trim()}>Create</button>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    if (this.loading) {
      return html`
        <div
          style="
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--muted);
            gap: 10px;
          "
        >
          <div class="spinner"></div>
          Loading knowledge base...
        </div>
      `;
    }

    const inboxCount = this.data ? getInboxItems(this.data).length : 0;
    const notesCount = this.data ? this.data.notes.length : 0;
    const refsCount = this.data ? this.data.references.length : 0;

    return html`
      <div class="main-container">
        <div class="header">
          <div class="title"><span class="icon icon-lg">${icons.book}</span> Knowledge</div>
          <div class="header-actions">
            ${
              this.saving
                ? html`
                    <div class="saving-indicator">
                      <div class="spinner"></div>
                      Saving
                    </div>
                  `
                : nothing
            }
            <input class="search-input" placeholder="Search..." .value=${this.search}
              @input=${(e: InputEvent) => {
                this.search = (e.target as HTMLInputElement).value;
              }} />
          </div>
        </div>
        <div class="tabs">
          <button class="tab ${this.activeTab === "inbox" ? "active" : ""}" @click=${() => {
            this.activeTab = "inbox";
          }}>
            <span class="icon">${icons.inbox}</span> Inbox <span class="tab-badge">${inboxCount}</span>
          </button>
          <button class="tab ${this.activeTab === "notes" ? "active" : ""}" @click=${() => {
            this.activeTab = "notes";
          }}>
            <span class="icon">${icons.fileText}</span> Notes <span class="tab-badge">${notesCount}</span>
          </button>
          <button class="tab ${this.activeTab === "references" ? "active" : ""}" @click=${() => {
            this.activeTab = "references";
          }}>
            <span class="icon">${icons.link}</span> Links <span class="tab-badge">${refsCount}</span>
          </button>
        </div>
        <div class="content">
          ${this.activeTab === "inbox" ? this.renderInboxTab() : nothing}
          ${this.activeTab === "notes" ? this.renderNotesTab() : nothing}
          ${this.activeTab === "references" ? this.renderReferencesTab() : nothing}
        </div>
      </div>
      ${this.renderCreateModal()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "knowledge-view": KnowledgeView;
  }
}
