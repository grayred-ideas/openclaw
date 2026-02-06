import DOMPurify from "dompurify";
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { marked } from "marked";
import type { GatewayBrowserClient } from "../../gateway.js";
import {
  listWorkspaceFiles,
  getWorkspaceFile,
  saveWorkspaceFile,
  deleteWorkspaceFile,
  renameWorkspaceFile,
  type WorkspaceFile,
} from "./controller.js";

@customElement("file-browser-view")
export class FileBrowserView extends LitElement {
  @property({ attribute: false })
  gateway: GatewayBrowserClient | null = null;

  @state()
  private files: WorkspaceFile[] = [];

  @state()
  private selectedFile: WorkspaceFile | null = null;

  @state()
  private fileContent = "";

  @state()
  private editedContent = "";

  @state()
  private isEditing = false;

  @state()
  private isSaving = false;

  @state()
  private loading = true;

  @state()
  private loadingContent = false;

  @state()
  private error: string | null = null;

  @state()
  private saveError: string | null = null;

  @state()
  private saveSuccess = false;

  @state()
  private searchQuery = "";

  @state()
  private sortBy: "name" | "date" | "size" = "name";

  @state()
  private sortOrder: "asc" | "desc" = "asc";

  @state()
  private sidebarCollapsed = false;

  @state()
  private isCreating = false;

  @state()
  private isRenaming = false;

  @state()
  private newFileName = "";

  @state()
  private isDeleting = false;

  private get isDirty(): boolean {
    return this.isEditing && this.editedContent !== this.fileContent;
  }

  private get filteredAndSortedFiles(): WorkspaceFile[] {
    let result = [...this.files];

    // Filter by search query
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(query));
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (this.sortBy) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "date":
          cmp = (a.updatedAtMs ?? 0) - (b.updatedAtMs ?? 0);
          break;
        case "size":
          cmp = (a.size ?? 0) - (b.size ?? 0);
          break;
      }
      return this.sortOrder === "asc" ? cmp : -cmp;
    });

    return result;
  }

  static styles = css`
    :host {
      display: flex;
      height: 100%;
      background: var(--bg);
      color: var(--text);
      font-family: var(--font-body);
    }

    .sidebar {
      width: 280px;
      min-width: 200px;
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      background: var(--panel);
      transition:
        width 0.2s ease,
        min-width 0.2s ease;
    }

    .sidebar.collapsed {
      width: 48px;
      min-width: 48px;
    }

    .sidebar.collapsed .sidebar-header-text,
    .sidebar.collapsed .sidebar-toolbar,
    .sidebar.collapsed .file-list,
    .sidebar.collapsed .search-bar,
    .sidebar.collapsed .sort-bar {
      display: none;
    }

    .sidebar-header {
      padding: 12px 16px;
      font-weight: 600;
      font-size: 14px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-strong);
    }

    .sidebar-header svg {
      width: 18px;
      height: 18px;
      color: var(--muted);
      flex-shrink: 0;
    }

    .sidebar-header-text {
      flex: 1;
    }

    .sidebar-toggle {
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: var(--muted);
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .sidebar-toggle:hover {
      background: var(--bg-hover);
      color: var(--text);
    }

    .sidebar-toolbar {
      padding: 8px 12px;
      display: flex;
      gap: 6px;
      border-bottom: 1px solid var(--border);
    }

    .toolbar-btn {
      padding: 6px 10px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      background: var(--card);
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 4px;
      transition: all var(--duration-fast) var(--ease-out);
    }

    .toolbar-btn:hover {
      background: var(--bg-hover);
      border-color: var(--border-strong);
    }

    .toolbar-btn svg {
      width: 14px;
      height: 14px;
    }

    .search-bar {
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
    }

    .search-input {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      padding: 8px 10px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      font-size: 13px;
      outline: none;
      transition: border-color var(--duration-fast) var(--ease-out);
    }

    .search-input:focus {
      border-color: var(--accent);
    }

    .search-input::placeholder {
      color: var(--muted);
    }

    .sort-bar {
      padding: 6px 12px;
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--border);
      font-size: 11px;
    }

    .sort-btn {
      padding: 4px 8px;
      border-radius: var(--radius-sm);
      border: none;
      cursor: pointer;
      background: transparent;
      color: var(--muted);
      font-size: 11px;
      font-weight: 500;
      transition: all var(--duration-fast) var(--ease-out);
    }

    .sort-btn:hover {
      background: var(--bg-hover);
      color: var(--text);
    }

    .sort-btn.active {
      background: var(--accent-subtle);
      color: var(--accent);
    }

    .file-list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
    }

    .file-item {
      padding: 8px 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      transition: background var(--duration-fast) var(--ease-out);
      color: var(--text);
      margin: 2px 8px;
      border-radius: var(--radius-md);
    }

    .file-item:hover {
      background: var(--bg-hover);
    }

    .file-item.selected {
      background: var(--accent-subtle);
      border-left: 3px solid var(--accent);
      padding-left: 9px;
    }

    .file-item.missing {
      opacity: 0.5;
      font-style: italic;
    }

    .file-icon {
      width: 16px;
      height: 16px;
      color: var(--muted);
      flex-shrink: 0;
    }

    .file-icon-md {
      color: var(--accent);
    }

    .file-icon-json {
      color: #f59e0b;
    }

    .file-icon-yaml {
      color: #8b5cf6;
    }

    .file-icon-code {
      color: #3b82f6;
    }

    .file-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .file-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-meta {
      display: flex;
      gap: 8px;
      font-size: 11px;
      color: var(--muted);
    }

    .file-size {
      font-size: 11px;
      color: var(--muted);
    }

    .create-file-form {
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .create-file-form input {
      width: 100%;
      padding: 8px 10px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      font-size: 13px;
      outline: none;
    }

    .create-file-form input:focus {
      border-color: var(--accent);
    }

    .create-file-actions {
      display: flex;
      gap: 6px;
    }

    .create-file-actions button {
      flex: 1;
      padding: 6px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all var(--duration-fast) var(--ease-out);
    }

    .create-file-actions .btn-create {
      background: var(--accent);
      color: var(--accent-foreground);
      border-color: var(--accent);
    }

    .create-file-actions .btn-cancel {
      background: var(--card);
      color: var(--text);
    }

    .content-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .content-header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--panel);
    }

    .content-title {
      font-weight: 600;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-strong);
    }

    .content-actions {
      display: flex;
      gap: 8px;
    }

    .btn {
      padding: 6px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all var(--duration-fast) var(--ease-out);
      background: var(--card);
      color: var(--text);
    }

    .btn:hover {
      background: var(--bg-hover);
      border-color: var(--border-strong);
    }

    .btn-primary {
      background: var(--accent);
      color: var(--accent-foreground);
      border-color: var(--accent);
    }

    .btn-primary:hover {
      background: var(--accent-hover);
      border-color: var(--accent-hover);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-danger {
      background: var(--danger, #ef4444);
      color: white;
      border-color: var(--danger, #ef4444);
    }

    .btn-danger:hover {
      background: var(--danger-hover, #dc2626);
      border-color: var(--danger-hover, #dc2626);
    }

    .btn-icon {
      padding: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-icon svg {
      width: 16px;
      height: 16px;
    }

    .rename-form {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    }

    .rename-form input {
      flex: 1;
      padding: 6px 10px;
      border-radius: var(--radius-md);
      border: 1px solid var(--accent);
      background: var(--bg);
      color: var(--text);
      font-size: 14px;
      font-weight: 600;
      outline: none;
    }

    .content-body {
      flex: 1;
      overflow: auto;
      padding: 20px;
      background: var(--bg);
    }

    .markdown-preview {
      line-height: 1.7;
      font-size: 14px;
      max-width: 800px;
    }

    .markdown-preview h1,
    .markdown-preview h2,
    .markdown-preview h3 {
      margin-top: 24px;
      margin-bottom: 12px;
      font-weight: 600;
      color: var(--text-strong);
    }

    .markdown-preview h1 {
      font-size: 24px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 8px;
    }

    .markdown-preview h2 {
      font-size: 20px;
    }

    .markdown-preview h3 {
      font-size: 16px;
    }

    .markdown-preview p {
      margin: 12px 0;
    }

    .markdown-preview ul,
    .markdown-preview ol {
      margin: 12px 0;
      padding-left: 24px;
    }

    .markdown-preview li {
      margin: 6px 0;
    }

    .markdown-preview code {
      background: var(--bg-muted);
      padding: 2px 6px;
      border-radius: var(--radius-sm);
      font-family: var(--mono);
      font-size: 13px;
    }

    .markdown-preview pre {
      background: var(--bg-muted);
      padding: 16px;
      border-radius: var(--radius-md);
      overflow-x: auto;
      border: 1px solid var(--border);
    }

    .markdown-preview pre code {
      background: none;
      padding: 0;
    }

    .markdown-preview blockquote {
      border-left: 3px solid var(--accent);
      margin: 12px 0;
      padding-left: 16px;
      color: var(--muted);
    }

    .markdown-preview table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }

    .markdown-preview th,
    .markdown-preview td {
      border: 1px solid var(--border);
      padding: 10px 12px;
      text-align: left;
    }

    .markdown-preview th {
      background: var(--panel);
      font-weight: 600;
      color: var(--text-strong);
    }

    .markdown-preview a {
      color: var(--accent);
    }

    .markdown-preview strong {
      color: var(--text-strong);
      font-weight: 600;
    }

    .raw-content {
      font-family: var(--mono);
      font-size: 13px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      background: var(--bg-muted);
      padding: 16px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      overflow-x: auto;
    }

    .raw-content .json-key {
      color: #3b82f6;
    }

    .raw-content .json-string {
      color: #22c55e;
    }

    .raw-content .json-number {
      color: #f59e0b;
    }

    .raw-content .json-boolean,
    .raw-content .json-null {
      color: #8b5cf6;
    }

    .raw-content .yaml-key {
      color: #3b82f6;
    }

    .raw-content .yaml-value {
      color: #22c55e;
    }

    .edit-textarea {
      width: 100%;
      height: 100%;
      background: var(--bg);
      color: var(--text);
      border: none;
      resize: none;
      font-family: var(--mono);
      font-size: 13px;
      line-height: 1.6;
      padding: 0;
      outline: none;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--muted);
      gap: 12px;
    }

    .empty-state svg {
      width: 48px;
      height: 48px;
    }

    .loading,
    .error-state {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--muted);
      padding: 20px;
      text-align: center;
    }

    .error-state {
      color: var(--danger);
    }

    .content-spinner {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--muted);
    }

    .spinner {
      width: 24px;
      height: 24px;
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

    .save-feedback {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      padding: 6px 12px;
      border-radius: var(--radius-md);
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .save-success {
      background: var(--success-subtle, rgba(34, 197, 94, 0.1));
      color: var(--success, #22c55e);
    }

    .save-error {
      background: var(--danger-subtle, rgba(239, 68, 68, 0.1));
      color: var(--danger, #ef4444);
    }

    .dirty-indicator {
      color: var(--warning, #f59e0b);
      font-weight: bold;
      margin-left: 4px;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .sidebar {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        z-index: 10;
        box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
      }

      .sidebar.collapsed {
        width: 0;
        min-width: 0;
        border-right: none;
        overflow: hidden;
      }

      .content-area {
        width: 100%;
      }

      .mobile-menu-btn {
        display: flex;
      }
    }

    @media (min-width: 769px) {
      .mobile-menu-btn {
        display: none;
      }
    }

    .mobile-menu-btn {
      background: none;
      border: none;
      padding: 8px;
      cursor: pointer;
      color: var(--muted);
      border-radius: var(--radius-sm);
      align-items: center;
      justify-content: center;
    }

    .mobile-menu-btn:hover {
      background: var(--bg-hover);
      color: var(--text);
    }

    .mobile-menu-btn svg {
      width: 20px;
      height: 20px;
    }
  `;

  private boundHandleKeyDown = this.handleKeyDown.bind(this);

  connectedCallback() {
    super.connectedCallback();
    this.loadFiles();
    document.addEventListener("keydown", this.boundHandleKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.boundHandleKeyDown);
  }

  private handleKeyDown(e: KeyboardEvent) {
    // Ctrl+S / Cmd+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      if (this.isEditing && this.isDirty && !this.isSaving) {
        e.preventDefault();
        this.saveFile();
      }
    }
    // Escape to cancel edit
    if (e.key === "Escape" && this.isEditing) {
      e.preventDefault();
      this.cancelEdit();
    }
  }

  updated(changedProps: Map<string, unknown>) {
    super.updated(changedProps);
    if (changedProps.has("gateway") && this.gateway) {
      this.loadFiles();
    }
  }

  private async loadFiles() {
    if (!this.gateway) {
      this.error = "Waiting for gateway connection...";
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = null;

    const result = await listWorkspaceFiles(this.gateway);
    if (result) {
      this.files = result.files.filter((f) => !f.missing);
      this.loading = false;
    } else {
      this.error = "Failed to load workspace files";
      this.loading = false;
    }
  }

  private async selectFile(file: WorkspaceFile) {
    if (!this.gateway || file.missing) return;
    if (this.selectedFile?.name === file.name) return;

    // Check for unsaved changes
    if (this.isDirty) {
      const discard = window.confirm("You have unsaved changes. Discard them and switch files?");
      if (!discard) return;
    }

    this.selectedFile = file;
    this.isEditing = false;
    this.loadingContent = true;
    this.saveError = null;

    const result = await getWorkspaceFile(this.gateway, file.name);
    this.loadingContent = false;

    if (result?.file.content !== undefined) {
      this.fileContent = result.file.content;
      this.editedContent = result.file.content;
    }
  }

  private toggleEdit() {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.editedContent = this.fileContent;
      this.saveError = null;
    }
  }

  private handleContentChange(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    this.editedContent = textarea.value;
  }

  private async saveFile() {
    if (!this.gateway || !this.selectedFile) return;

    this.isSaving = true;
    this.saveError = null;

    const success = await saveWorkspaceFile(
      this.gateway,
      this.selectedFile.name,
      this.editedContent,
    );

    this.isSaving = false;

    if (success) {
      this.fileContent = this.editedContent;
      this.isEditing = false;
      this.saveSuccess = true;
      setTimeout(() => {
        this.saveSuccess = false;
      }, 2000);
    } else {
      this.saveError = "Failed to save file. Please try again.";
    }
  }

  private cancelEdit() {
    if (this.isDirty) {
      const discard = window.confirm("Discard unsaved changes?");
      if (!discard) return;
    }
    this.editedContent = this.fileContent;
    this.isEditing = false;
    this.saveError = null;
  }

  private formatFileSize(bytes?: number): string {
    if (bytes === undefined) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  private formatRelativeTime(ms?: number): string {
    if (!ms) return "";
    const now = Date.now();
    const diff = now - ms;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(ms).toLocaleDateString();
  }

  private getFileExtension(name: string): string {
    const parts = name.split(".");
    return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
  }

  private isMarkdownFile(name: string): boolean {
    return this.getFileExtension(name) === "md";
  }

  private async createFile() {
    if (!this.gateway || !this.newFileName.trim()) return;

    const fileName = this.newFileName.trim();
    const success = await saveWorkspaceFile(this.gateway, fileName, "");

    if (success) {
      this.isCreating = false;
      this.newFileName = "";
      await this.loadFiles();
      // Select the new file
      const newFile = this.files.find((f) => f.name === fileName);
      if (newFile) {
        await this.selectFile(newFile);
        this.toggleEdit(); // Enter edit mode
      }
    } else {
      this.saveError = "Failed to create file";
    }
  }

  private async deleteFile() {
    if (!this.gateway || !this.selectedFile) return;

    const confirmed = window.confirm(`Delete "${this.selectedFile.name}"? This cannot be undone.`);
    if (!confirmed) return;

    this.isDeleting = true;
    const success = await deleteWorkspaceFile(this.gateway, this.selectedFile.name);
    this.isDeleting = false;

    if (success) {
      this.selectedFile = null;
      this.fileContent = "";
      this.editedContent = "";
      await this.loadFiles();
    } else {
      this.saveError = "Failed to delete file";
    }
  }

  private async renameFile() {
    if (!this.gateway || !this.selectedFile || !this.newFileName.trim()) return;

    const newName = this.newFileName.trim();
    const success = await renameWorkspaceFile(this.gateway, this.selectedFile.name, newName);

    if (success) {
      this.isRenaming = false;
      this.newFileName = "";
      await this.loadFiles();
      // Re-select with new name
      const renamedFile = this.files.find((f) => f.name === newName);
      if (renamedFile) {
        this.selectedFile = renamedFile;
      }
    } else {
      this.saveError = "Failed to rename file";
    }
  }

  private startRename() {
    if (!this.selectedFile) return;
    this.newFileName = this.selectedFile.name;
    this.isRenaming = true;
  }

  private cancelCreate() {
    this.isCreating = false;
    this.newFileName = "";
  }

  private cancelRename() {
    this.isRenaming = false;
    this.newFileName = "";
  }

  private handleSearchInput(e: Event) {
    this.searchQuery = (e.target as HTMLInputElement).value;
  }

  private toggleSort(by: "name" | "date" | "size") {
    if (this.sortBy === by) {
      this.sortOrder = this.sortOrder === "asc" ? "desc" : "asc";
    } else {
      this.sortBy = by;
      this.sortOrder = "asc";
    }
  }

  private handleTextareaKeydown(e: KeyboardEvent) {
    // Insert tab character instead of moving focus
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      textarea.value = value.substring(0, start) + "  " + value.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 2;
      this.editedContent = textarea.value;
    }
  }

  private renderMarkdown(content: string): string {
    const rawHtml = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml);
  }

  private highlightJson(content: string): string {
    try {
      // Validate JSON first
      JSON.parse(content);
      return content
        .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
        .replace(/: "([^"]*)"/g, ': <span class="json-string">"$1"</span>')
        .replace(/: (-?\d+\.?\d*)/g, ': <span class="json-number">$1</span>')
        .replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>')
        .replace(/: (null)/g, ': <span class="json-null">$1</span>');
    } catch {
      return this.escapeHtml(content);
    }
  }

  private highlightYaml(content: string): string {
    return content
      .split("\n")
      .map((line) => {
        if (line.includes(":")) {
          const [key, ...rest] = line.split(":");
          const value = rest.join(":");
          return `<span class="yaml-key">${this.escapeHtml(key)}</span>:${value ? `<span class="yaml-value">${this.escapeHtml(value)}</span>` : ""}`;
        }
        return this.escapeHtml(line);
      })
      .join("\n");
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  private renderContent(): ReturnType<typeof html> {
    if (!this.selectedFile) return html``;

    const ext = this.getFileExtension(this.selectedFile.name);

    // JSON with highlighting
    if (ext === "json") {
      return html`
        <div class="raw-content">${unsafeHTML(this.highlightJson(this.fileContent))}</div>
      `;
    }

    // YAML with highlighting
    if (ext === "yaml" || ext === "yml") {
      return html`
        <div class="raw-content">${unsafeHTML(this.highlightYaml(this.fileContent))}</div>
      `;
    }

    // Markdown with preview
    if (ext === "md") {
      return html`
        <div class="markdown-preview">
          ${unsafeHTML(this.renderMarkdown(this.fileContent))}
        </div>
      `;
    }

    // Default: raw content
    return html`
      <div class="raw-content">${this.fileContent}</div>
    `;
  }

  private renderFileIcon(fileName?: string) {
    const ext = fileName ? this.getFileExtension(fileName) : "";

    // Markdown
    if (ext === "md") {
      return html`
        <svg
          class="file-icon file-icon-md"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <path d="M8 13h2l1.5 2 1.5-2h2"></path>
        </svg>
      `;
    }

    // JSON
    if (ext === "json") {
      return html`
        <svg
          class="file-icon file-icon-json"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <path d="M8 12a2 2 0 0 0 0 4"></path>
          <path d="M16 12a2 2 0 0 1 0 4"></path>
        </svg>
      `;
    }

    // YAML
    if (ext === "yaml" || ext === "yml") {
      return html`
        <svg
          class="file-icon file-icon-yaml"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <path d="M8 13l2 2v3"></path>
          <path d="M16 13l-2 2"></path>
        </svg>
      `;
    }

    // TypeScript/JavaScript
    if (ext === "ts" || ext === "js" || ext === "tsx" || ext === "jsx") {
      return html`
        <svg
          class="file-icon file-icon-code"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <polyline points="8 13 10 15 8 17"></polyline>
          <line x1="12" y1="17" x2="16" y2="17"></line>
        </svg>
      `;
    }

    // Default file icon
    return html`
      <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
      </svg>
    `;
  }

  private renderFolderIcon() {
    return html`
      <svg
        style="width: 18px; height: 18px"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
      </svg>
    `;
  }

  private renderPlusIcon() {
    return html`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    `;
  }

  private renderRefreshIcon() {
    return html`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="23 4 23 10 17 10"></polyline>
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
      </svg>
    `;
  }

  private renderMenuIcon() {
    return html`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    `;
  }

  private renderChevronIcon(direction: "left" | "right") {
    return html`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
        ${
          direction === "left"
            ? html`
                <polyline points="15 18 9 12 15 6"></polyline>
              `
            : html`
                <polyline points="9 18 15 12 9 6"></polyline>
              `
        }
      </svg>
    `;
  }

  private renderTrashIcon() {
    return html`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    `;
  }

  private renderEditIcon() {
    return html`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;
  }

  render() {
    return html`
      <div class="sidebar ${this.sidebarCollapsed ? "collapsed" : ""}">
        <div class="sidebar-header">
          ${this.renderFolderIcon()}
          <span class="sidebar-header-text">Workspace Files</span>
          <button
            class="sidebar-toggle"
            @click=${() => (this.sidebarCollapsed = !this.sidebarCollapsed)}
            title="${this.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}"
          >
            ${this.renderChevronIcon(this.sidebarCollapsed ? "right" : "left")}
          </button>
        </div>

        <div class="sidebar-toolbar">
          <button class="toolbar-btn" @click=${() => (this.isCreating = true)} title="New file">
            ${this.renderPlusIcon()} New
          </button>
          <button class="toolbar-btn" @click=${() => this.loadFiles()} title="Refresh">
            ${this.renderRefreshIcon()}
          </button>
        </div>

        <div class="search-bar">
          <input
            type="text"
            class="search-input"
            placeholder="Search files..."
            .value=${this.searchQuery}
            @input=${this.handleSearchInput}
          />
        </div>

        <div class="sort-bar">
          <button
            class="sort-btn ${this.sortBy === "name" ? "active" : ""}"
            @click=${() => this.toggleSort("name")}
          >
            Name ${this.sortBy === "name" ? (this.sortOrder === "asc" ? "↑" : "↓") : ""}
          </button>
          <button
            class="sort-btn ${this.sortBy === "date" ? "active" : ""}"
            @click=${() => this.toggleSort("date")}
          >
            Date ${this.sortBy === "date" ? (this.sortOrder === "asc" ? "↑" : "↓") : ""}
          </button>
          <button
            class="sort-btn ${this.sortBy === "size" ? "active" : ""}"
            @click=${() => this.toggleSort("size")}
          >
            Size ${this.sortBy === "size" ? (this.sortOrder === "asc" ? "↑" : "↓") : ""}
          </button>
        </div>

        ${
          this.isCreating
            ? html`
            <div class="create-file-form">
              <input
                type="text"
                placeholder="filename.md"
                .value=${this.newFileName}
                @input=${(e: Event) => (this.newFileName = (e.target as HTMLInputElement).value)}
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === "Enter") this.createFile();
                  if (e.key === "Escape") this.cancelCreate();
                }}
              />
              <div class="create-file-actions">
                <button class="btn-cancel" @click=${this.cancelCreate}>Cancel</button>
                <button class="btn-create" @click=${this.createFile}>Create</button>
              </div>
            </div>
          `
            : ""
        }

        <div class="file-list">
          ${
            this.loading
              ? html`
                  <div class="loading">Loading...</div>
                `
              : this.error
                ? html`<div class="error-state">${this.error}</div>`
                : this.filteredAndSortedFiles.length === 0
                  ? html`<div class="empty-state">${this.searchQuery ? "No matching files" : "No files found"}</div>`
                  : this.filteredAndSortedFiles.map(
                      (file) => html`
                      <div
                        class="file-item ${file.missing ? "missing" : ""} ${this.selectedFile?.name === file.name ? "selected" : ""}"
                        @click=${() => this.selectFile(file)}
                        title="${file.name}"
                      >
                        ${this.renderFileIcon(file.name)}
                        <div class="file-info">
                          <span class="file-name">${file.name}</span>
                          <div class="file-meta">
                            <span>${this.formatFileSize(file.size)}</span>
                            <span>${this.formatRelativeTime(file.updatedAtMs)}</span>
                          </div>
                        </div>
                      </div>
                    `,
                    )
          }
        </div>
      </div>
      <div class="content-area">
        <button
          class="mobile-menu-btn"
          @click=${() => (this.sidebarCollapsed = !this.sidebarCollapsed)}
          style="position: absolute; top: 12px; left: 12px; z-index: 5;"
        >
          ${this.renderMenuIcon()}
        </button>
        ${
          this.selectedFile
            ? html`
              <div class="content-header">
                ${
                  this.isRenaming
                    ? html`
                    <div class="rename-form">
                      ${this.renderFileIcon(this.selectedFile.name)}
                      <input
                        type="text"
                        .value=${this.newFileName}
                        @input=${(e: Event) => (this.newFileName = (e.target as HTMLInputElement).value)}
                        @keydown=${(e: KeyboardEvent) => {
                          if (e.key === "Enter") this.renameFile();
                          if (e.key === "Escape") this.cancelRename();
                        }}
                      />
                      <button class="btn" @click=${this.cancelRename}>Cancel</button>
                      <button class="btn btn-primary" @click=${this.renameFile}>Save</button>
                    </div>
                  `
                    : html`
                    <div class="content-title">
                      ${this.renderFileIcon(this.selectedFile.name)}
                      ${this.selectedFile.name}
                      ${
                        this.isDirty
                          ? html`
                              <span class="dirty-indicator">●</span>
                            `
                          : ""
                      }
                    </div>
                  `
                }
                <div class="content-actions">
                  ${
                    this.saveSuccess
                      ? html`
                          <span class="save-feedback save-success">✓ Saved!</span>
                        `
                      : ""
                  }
                  ${this.saveError ? html`<span class="save-feedback save-error">${this.saveError}</span>` : ""}
                  ${
                    this.isEditing
                      ? html`
                        <button class="btn" @click=${this.cancelEdit}>Cancel</button>
                        <button
                          class="btn btn-primary"
                          @click=${this.saveFile}
                          ?disabled=${this.isSaving || !this.isDirty}
                        >
                          ${this.isSaving ? "Saving..." : "Save"}
                        </button>
                      `
                      : html`
                        <button class="btn btn-icon" @click=${this.startRename} title="Rename">
                          ${this.renderEditIcon()}
                        </button>
                        <button
                          class="btn btn-icon"
                          @click=${this.deleteFile}
                          title="Delete"
                          ?disabled=${this.isDeleting}
                        >
                          ${this.renderTrashIcon()}
                        </button>
                        <button class="btn" @click=${this.toggleEdit}>Edit</button>
                      `
                  }
                </div>
              </div>
              <div class="content-body">
                ${
                  this.loadingContent
                    ? html`
                        <div class="content-spinner">
                          <div class="spinner"></div>
                        </div>
                      `
                    : this.isEditing
                      ? html`
                        <textarea
                          class="edit-textarea"
                          .value=${this.editedContent}
                          @input=${this.handleContentChange}
                          @keydown=${this.handleTextareaKeydown}
                        ></textarea>
                      `
                      : this.renderContent()
                }
              </div>
            `
            : html`
              <div class="empty-state">
                ${this.renderFolderIcon()}
                <span>Select a file to view</span>
              </div>
            `
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "file-browser-view": FileBrowserView;
  }
}
