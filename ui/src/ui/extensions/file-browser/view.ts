import DOMPurify from "dompurify";
import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { marked } from "marked";
import type { GatewayBrowserClient } from "../../gateway.js";
import { icons } from "../../icons.js";
import {
  listWorkspaceContents,
  getWorkspaceFile,
  saveWorkspaceFile,
  deleteWorkspaceFile,
  renameWorkspaceFile,
  createWorkspaceFolder,
  searchWorkspaceFiles,
  joinPath,
  getParentPath,
  getPathBreadcrumbs,
  type WorkspaceFile,
  type WorkspaceFolder,
  type SearchResult,
} from "./controller.js";

@customElement("file-browser-view")
export class FileBrowserView extends LitElement {
  @property({ attribute: false })
  gateway: GatewayBrowserClient | null = null;

  @state()
  private files: WorkspaceFile[] = [];

  @state()
  private folders: WorkspaceFolder[] = [];

  @state()
  private currentPath = "";

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
  private searchResults: SearchResult[] | null = null;

  @state()
  private isSearching = false;

  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  @state()
  private sortBy: "name" | "date" | "size" = "name";

  @state()
  private sortOrder: "asc" | "desc" = "asc";

  @state()
  private sidebarCollapsed = false;

  @state()
  private isCreating = false;

  @state()
  private isCreatingFolder = false;

  @state()
  private isRenaming = false;

  @state()
  private newFileName = "";

  @state()
  private newFolderName = "";

  @state()
  private isDeleting = false;

  @state()
  private showNewDropdown = false;

  @state()
  private showMoreDropdown = false;

  @state()
  private contextMenu: {
    x: number;
    y: number;
    items: Array<{ label: string; action: () => void; icon?: any; danger?: boolean }>;
  } | null = null;

  private get isDirty(): boolean {
    return this.isEditing && this.editedContent !== this.fileContent;
  }

  private get filteredAndSortedItems(): (
    | WorkspaceFile
    | (WorkspaceFolder & { isFolder: boolean })
  )[] {
    const query = this.searchQuery.trim().toLowerCase();

    // Filter folders
    let filteredFolders = [...this.folders];
    if (query) {
      filteredFolders = filteredFolders.filter((f) => f.name.toLowerCase().includes(query));
    }

    // Filter files
    let filteredFiles = [...this.files];
    if (query) {
      filteredFiles = filteredFiles.filter((f) => f.name.toLowerCase().includes(query));
    }

    // Sort folders
    filteredFolders.sort((a, b) => {
      let cmp = 0;
      switch (this.sortBy) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "date":
          cmp = (a.updatedAtMs ?? 0) - (b.updatedAtMs ?? 0);
          break;
        case "size":
          cmp = 0; // folders don't have size
          break;
      }
      return this.sortOrder === "asc" ? cmp : -cmp;
    });

    // Sort files
    filteredFiles.sort((a, b) => {
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

    // Combine: folders first, then files
    return [
      ...filteredFolders.map((f) => ({ ...f, isFolder: true })),
      ...filteredFiles.map((f) => ({ ...f, isFolder: false })),
    ];
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
      width: 260px;
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
      width: 40px;
      min-width: 40px;
      overflow: hidden;
    }

    .sidebar.collapsed .sidebar-title,
    .sidebar.collapsed .file-list,
    .sidebar.collapsed .search-bar {
      display: none;
    }

    .sidebar.collapsed .sidebar-header {
      justify-content: center;
      padding: 12px 8px;
    }

    .sidebar-header {
      padding: 12px 16px;
      font-weight: 600;
      font-size: 14px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: var(--text-strong);
    }

    .sidebar-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sidebar-title svg {
      width: 18px;
      height: 18px;
      color: var(--muted);
      flex-shrink: 0;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
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

    .sidebar-toggle svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .sidebar-toggle:hover {
      background: var(--bg-hover);
      color: var(--text);
    }

    .search-bar {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }

    .search-input {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
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

    .file-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
    }

    .file-item {
      padding: 10px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
      transition: all var(--duration-fast) var(--ease-out);
      color: var(--text);
      margin: 2px 8px;
      border-radius: var(--radius-md);
      border-left: 3px solid transparent;
    }

    .file-item:hover {
      background: var(--bg-hover);
    }

    .file-item.selected {
      background: var(--accent-subtle);
      border-left-color: var(--accent);
    }

    .file-item.missing {
      opacity: 0.5;
      font-style: italic;
    }

    .file-item.folder-item:hover {
      background: var(--bg-hover);
    }

    .folder-icon {
      font-size: 16px;
    }

    .file-icon {
      display: inline-flex;
      width: 16px;
      height: 16px;
      color: var(--muted);
      flex-shrink: 0;
    }

    .search-results-header {
      padding: 8px 16px;
      font-size: 11px;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid var(--border);
    }

    .search-result-item .file-info {
      gap: 4px;
    }

    .search-result-path {
      color: var(--muted);
      font-size: 11px;
    }

    .search-match-preview {
      margin-top: 4px;
      font-size: 11px;
      line-height: 1.4;
    }

    .search-match-line {
      display: flex;
      gap: 6px;
      color: var(--muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .search-line-num {
      color: var(--accent);
      font-family: var(--mono);
      font-size: 10px;
      flex-shrink: 0;
    }

    .search-snippet {
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-icon svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .file-icon-code {
      color: var(--accent);
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

    .inline-form {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 24px;
      max-width: 400px;
      margin: 40px auto 0;
      box-shadow: var(--shadow-md);
    }

    .inline-form h3 {
      margin: 0 0 16px;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-strong);
    }

    .inline-form-input {
      width: 100%;
      padding: 12px 16px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      font-size: 14px;
      outline: none;
      margin-bottom: 16px;
      transition: border-color var(--duration-fast) var(--ease-out);
    }

    .inline-form-input:focus {
      border-color: var(--accent);
    }

    .inline-form-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .inline-form-actions button {
      padding: 10px 20px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all var(--duration-fast) var(--ease-out);
    }

    .inline-form-actions .btn-create {
      background: var(--accent);
      color: var(--primary-foreground);
      border-color: var(--accent);
    }

    .inline-form-actions .btn-cancel {
      background: var(--bg-elevated);
      color: var(--text);
    }

    .content-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .content-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--panel);
      min-height: 56px;
      gap: 16px;
    }

    .content-breadcrumbs {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 500;
      flex: 1;
      min-width: 0;
    }

    .breadcrumb {
      color: var(--muted);
      cursor: pointer;
      transition: color var(--duration-fast) var(--ease-out);
      white-space: nowrap;
    }

    .breadcrumb:hover {
      color: var(--text);
    }

    .breadcrumb.active {
      color: var(--text-strong);
      cursor: default;
    }

    .breadcrumb-separator {
      color: var(--muted);
      user-select: none;
    }

    .content-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
    }

    .content-title {
      font-weight: 600;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-strong);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 7px 14px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      letter-spacing: -0.01em;
      white-space: nowrap;
      transition:
        border-color var(--duration-fast) var(--ease-out),
        background var(--duration-fast) var(--ease-out),
        box-shadow var(--duration-fast) var(--ease-out);
      background: var(--bg-elevated);
      color: var(--text);
    }

    .btn svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .btn:hover {
      background: var(--bg-hover);
      border-color: var(--border-strong);
    }

    .btn-primary {
      background: var(--accent);
      color: var(--primary-foreground);
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
      background: var(--danger-subtle);
      color: var(--danger);
      border-color: transparent;
    }

    .btn-danger:hover {
      background: var(--danger);
      color: white;
      border-color: var(--danger);
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
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .dropdown {
      position: relative;
      display: inline-flex;
    }

    .dropdown-content {
      position: absolute;
      top: 100%;
      left: 0;
      z-index: 100;
      min-width: 160px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      padding: 8px 0;
      margin-top: 4px;
      overflow: hidden;
    }

    .dropdown-content.right-aligned {
      left: auto;
      right: 0;
    }

    .dropdown-item {
      padding: 10px 16px;
      cursor: pointer;
      font-size: 13px;
      color: var(--text);
      transition: background var(--duration-fast) var(--ease-out);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .dropdown-item:hover {
      background: var(--bg-hover);
    }

    .dropdown-item.danger {
      color: var(--danger);
    }

    .dropdown-item.danger:hover {
      background: var(--danger-subtle);
    }

    .dropdown-item svg {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .context-menu {
      position: fixed;
      z-index: 1000;
      min-width: 160px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      box-shadow: var(--shadow-lg);
      padding: 8px 0;
      overflow: hidden;
    }

    .context-menu-item {
      padding: 10px 16px;
      cursor: pointer;
      font-size: 13px;
      color: var(--text);
      transition: background var(--duration-fast) var(--ease-out);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .context-menu-item:hover {
      background: var(--bg-hover);
    }

    .context-menu-item.danger {
      color: var(--danger);
    }

    .context-menu-item.danger:hover {
      background: var(--danger-subtle);
    }

    .context-menu-item svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
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
      background: var(--ok-subtle);
      color: var(--ok);
    }

    .save-error {
      background: var(--danger-subtle);
      color: var(--danger);
    }

    .dirty-indicator {
      color: var(--warn);
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
      fill: none;
      stroke: currentColor;
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `;

  private boundHandleKeyDown = this.handleKeyDown.bind(this);

  connectedCallback() {
    super.connectedCallback();
    this.loadFiles();
    document.addEventListener("keydown", this.boundHandleKeyDown);
    document.addEventListener("click", this.handleDocumentClick.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.boundHandleKeyDown);
    document.removeEventListener("click", this.handleDocumentClick.bind(this));
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
    // Escape to close dropdowns and context menus
    if (e.key === "Escape") {
      this.closeDropdowns();
      this.closeContextMenu();
    }
  }

  private handleDocumentClick(e: Event) {
    const target = e.target as Element;
    // Close dropdowns if clicking outside
    if (!target.closest(".dropdown")) {
      this.closeDropdowns();
    }
    // Close context menu if clicking outside
    if (!target.closest(".context-menu")) {
      this.closeContextMenu();
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

    const result = await listWorkspaceContents(this.gateway, this.currentPath);
    if (result) {
      this.folders = result.folders || [];
      this.files = (result.files || []).filter((f) => !f.missing);
      this.loading = false;
    } else {
      this.error = "Failed to load workspace contents";
      this.loading = false;
    }
  }

  private async selectFile(file: WorkspaceFile) {
    if (!this.gateway || file.missing) return;
    if (this.selectedFile?.path === file.path) return;

    // Check for unsaved changes
    if (this.isDirty) {
      const discard = window.confirm("You have unsaved changes. Discard them and switch files?");
      if (!discard) return;
    }

    this.selectedFile = file;
    this.isEditing = false;
    this.loadingContent = true;
    this.saveError = null;

    const result = await getWorkspaceFile(this.gateway, file.path);
    this.loadingContent = false;

    if (result?.file.content !== undefined) {
      this.fileContent = result.file.content;
      this.editedContent = result.file.content;
    }
  }

  private async navigateToFolder(folderPath: string) {
    // Check for unsaved changes
    if (this.isDirty) {
      const discard = window.confirm("You have unsaved changes. Discard them and switch folders?");
      if (!discard) return;
    }

    this.currentPath = folderPath;
    this.selectedFile = null;
    this.fileContent = "";
    this.editedContent = "";
    this.isEditing = false;
    await this.loadFiles();
  }

  private async navigateToParent() {
    const parentPath = getParentPath(this.currentPath);
    await this.navigateToFolder(parentPath);
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
      this.selectedFile.path,
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
    const filePath = joinPath(this.currentPath, fileName);
    const success = await saveWorkspaceFile(this.gateway, filePath, "");

    if (success) {
      this.isCreating = false;
      this.newFileName = "";
      await this.loadFiles();
      // Select the new file
      const newFile = this.files.find((f) => f.path === filePath);
      if (newFile) {
        await this.selectFile(newFile);
        this.toggleEdit(); // Enter edit mode
      }
    } else {
      this.saveError = "Failed to create file";
    }
  }

  private async createFolder() {
    if (!this.gateway || !this.newFolderName.trim()) return;

    const folderName = this.newFolderName.trim();
    const folderPath = joinPath(this.currentPath, folderName);
    const success = await createWorkspaceFolder(this.gateway, folderPath);

    if (success) {
      this.isCreatingFolder = false;
      this.newFolderName = "";
      await this.loadFiles();
    } else {
      this.saveError = "Failed to create folder";
    }
  }

  private triggerUpload() {
    const input = this.shadowRoot?.querySelector("#file-upload-input") as HTMLInputElement;
    if (input) input.click();
  }

  private async handleFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files || !this.gateway) return;

    for (const file of Array.from(files)) {
      try {
        const text = await file.text();
        const success = await saveWorkspaceFile(this.gateway, file.name, text);
        if (success) {
          this.showToast(`Uploaded: ${file.name}`, "success");
        } else {
          this.showToast(`Failed to upload: ${file.name}`, "error");
        }
      } catch {
        this.showToast(`Failed to read: ${file.name}`, "error");
      }
    }

    input.value = "";
    await this.loadFiles();
  }

  private showToast(message: string, type: "success" | "error" = "success") {
    this.saveSuccess = type === "success";
    this.saveError = type === "error" ? message : null;
    if (type === "success") {
      setTimeout(() => {
        this.saveSuccess = false;
      }, 2000);
    }
  }

  private async deleteFile() {
    if (!this.gateway || !this.selectedFile) return;

    const confirmed = window.confirm(`Delete "${this.selectedFile.name}"? This cannot be undone.`);
    if (!confirmed) return;

    this.isDeleting = true;
    const success = await deleteWorkspaceFile(this.gateway, this.selectedFile.path);
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
    const newPath = joinPath(this.currentPath, newName);
    const success = await renameWorkspaceFile(this.gateway, this.selectedFile.path, newPath);

    if (success) {
      this.isRenaming = false;
      this.newFileName = "";
      await this.loadFiles();
      // Re-select with new path
      const renamedFile = this.files.find((f) => f.path === newPath);
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

  private cancelCreateFolder() {
    this.isCreatingFolder = false;
    this.newFolderName = "";
  }

  private cancelRename() {
    this.isRenaming = false;
    this.newFileName = "";
  }

  private handleSearchInput(e: Event) {
    this.searchQuery = (e.target as HTMLInputElement).value;

    // Clear previous debounce
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }

    const query = this.searchQuery.trim();
    if (query.length < 2) {
      // Clear search results, show normal file list
      this.searchResults = null;
      this.isSearching = false;
      return;
    }

    // Debounce: wait 300ms after typing stops
    this.isSearching = true;
    this.searchDebounceTimer = setTimeout(async () => {
      if (!this.gateway) return;
      const response = await searchWorkspaceFiles(this.gateway, query);
      if (response) {
        this.searchResults = response.results;
      }
      this.isSearching = false;
    }, 300);
  }

  private async openSearchResult(result: SearchResult) {
    // Navigate to the file's folder and select it
    const lastSlash = result.path.lastIndexOf("/");
    const folderPath = lastSlash > 0 ? result.path.substring(0, lastSlash) : "";

    if (folderPath !== this.currentPath) {
      this.currentPath = folderPath;
      await this.loadFiles();
    }

    // Find and select the file
    const file = this.files.find((f) => f.path === result.path);
    if (file) {
      await this.selectFile(file);
    } else {
      // File might not be in the listing yet, load it directly
      if (!this.gateway) return;
      const fileResult = await getWorkspaceFile(this.gateway, result.path);
      if (fileResult?.file) {
        this.selectedFile = fileResult.file;
        this.fileContent = fileResult.file.content ?? "";
        this.editedContent = this.fileContent;
      }
    }

    // Clear search
    this.searchQuery = "";
    this.searchResults = null;
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

  private toggleNewDropdown() {
    this.showNewDropdown = !this.showNewDropdown;
    this.showMoreDropdown = false;
  }

  private toggleMoreDropdown() {
    this.showMoreDropdown = !this.showMoreDropdown;
    this.showNewDropdown = false;
  }

  private closeDropdowns() {
    this.showNewDropdown = false;
    this.showMoreDropdown = false;
  }

  private showContextMenu(
    e: MouseEvent,
    items: Array<{ label: string; action: () => void; icon?: any; danger?: boolean }>,
  ) {
    e.preventDefault();
    e.stopPropagation();
    this.contextMenu = {
      x: e.clientX,
      y: e.clientY,
      items,
    };
  }

  private closeContextMenu() {
    this.contextMenu = null;
  }

  private handleFileContextMenu(e: MouseEvent, file: WorkspaceFile) {
    this.showContextMenu(e, [
      {
        label: "Rename",
        action: () => {
          this.selectedFile = file;
          this.startRename();
          this.closeContextMenu();
        },
        icon: icons.edit,
      },
      {
        label: "Delete",
        action: () => {
          this.selectedFile = file;
          this.deleteFile();
          this.closeContextMenu();
        },
        icon: icons.trash,
        danger: true,
      },
    ]);
  }

  private handleFolderContextMenu(e: MouseEvent, folder: WorkspaceFolder) {
    this.showContextMenu(e, [
      {
        label: "New File Here",
        action: () => {
          this.navigateToFolder(folder.path);
          this.isCreating = true;
          this.closeContextMenu();
        },
        icon: icons.fileText,
      },
      {
        label: "New Folder Here",
        action: () => {
          this.navigateToFolder(folder.path);
          this.isCreatingFolder = true;
          this.closeContextMenu();
        },
        icon: icons.folder,
      },
      {
        label: "Delete Folder",
        action: () => {
          // Note: We'd need to implement folder deletion in the controller
          this.closeContextMenu();
        },
        icon: icons.trash,
        danger: true,
      },
    ]);
  }

  private handleEmptySpaceContextMenu(e: MouseEvent) {
    this.showContextMenu(e, [
      {
        label: "New File",
        action: () => {
          this.isCreating = true;
          this.closeContextMenu();
        },
        icon: icons.fileText,
      },
      {
        label: "New Folder",
        action: () => {
          this.isCreatingFolder = true;
          this.closeContextMenu();
        },
        icon: icons.folder,
      },
      {
        label: "Upload",
        action: () => {
          this.triggerUpload();
          this.closeContextMenu();
        },
        icon: icons.upload,
      },
    ]);
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

    if (ext === "ts" || ext === "js" || ext === "tsx" || ext === "jsx") {
      return html`<span class="file-icon file-icon-code">${icons.fileCode}</span>`;
    }

    // Default file icon for all types
    return html`<span class="file-icon">${icons.fileText}</span>`;
  }

  private renderFolderIcon() {
    return icons.folder;
  }

  private renderPlusIcon() {
    return icons.plus;
  }

  private renderRefreshIcon() {
    return icons.refreshCw;
  }

  private renderMenuIcon() {
    return icons.menu;
  }

  private renderChevronIcon(direction: "left" | "right") {
    return direction === "left" ? icons.chevronLeft : icons.chevronRight;
  }

  private renderTrashIcon() {
    return icons.trash;
  }

  private renderEditIcon() {
    return icons.edit;
  }

  render() {
    return html`
      <!-- Sidebar (slim, navigation only) -->
      <div class="sidebar ${this.sidebarCollapsed ? "collapsed" : ""}">
        <div class="sidebar-header">
          <div class="sidebar-title">
            ${this.renderFolderIcon()}
            <span class="sidebar-header-text">Files</span>
          </div>
          <button
            class="sidebar-toggle"
            @click=${() => (this.sidebarCollapsed = !this.sidebarCollapsed)}
            title="${this.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}"
          >
            ${this.renderChevronIcon(this.sidebarCollapsed ? "right" : "left")}
          </button>
        </div>

        <!-- Search bar -->
        <div class="search-bar">
          <input
            type="text"
            class="search-input"
            placeholder="🔍 Search..."
            .value=${this.searchQuery}
            @input=${this.handleSearchInput}
          />
        </div>

        <!-- File listing -->
        <div 
          class="file-list"
          @contextmenu=${(e: MouseEvent) => this.handleEmptySpaceContextMenu(e)}
        >
          ${
            this.isSearching
              ? html`
                  <div class="loading">Searching...</div>
                `
              : this.searchResults !== null
                ? html`
                  <div class="search-results-header">
                    ${this.searchResults.length} result${this.searchResults.length !== 1 ? "s" : ""}
                  </div>
                  ${
                    this.searchResults.length === 0
                      ? html`
                          <div class="empty-state">No matches found</div>
                        `
                      : this.searchResults.map(
                          (result) => html`
                      <div 
                        class="file-item search-result-item"
                        @click=${() => this.openSearchResult(result)}
                        title="${result.path}"
                      >
                        ${this.renderFileIcon(result.name)}
                        <div class="file-info">
                          <span class="file-name">${result.name}</span>
                          <div class="file-meta">
                            <span class="search-result-path">${result.path}</span>
                          </div>
                          ${
                            result.matches.length > 0
                              ? html`
                            <div class="search-match-preview">
                              ${result.matches.slice(0, 2).map(
                                (m) => html`
                                <div class="search-match-line">
                                  <span class="search-line-num">L${m.line}</span>
                                  <span class="search-snippet">${m.snippet}</span>
                                </div>
                              `,
                              )}
                            </div>
                          `
                              : ""
                          }
                        </div>
                      </div>
                    `,
                        )
                  }
                `
                : this.loading
                  ? html`
                      <div class="loading">Loading...</div>
                    `
                  : this.error
                    ? html`<div class="error-state">${this.error}</div>`
                    : html`
                  ${
                    this.currentPath
                      ? html`
                    <div 
                      class="file-item folder-item"
                      @click=${this.navigateToParent}
                      title="Go back"
                    >
                      <span class="file-icon">${icons.chevronLeft}</span>
                      <div class="file-info">
                        <span class="file-name">..</span>
                      </div>
                    </div>
                  `
                      : ""
                  }
                  ${
                    this.filteredAndSortedItems.length === 0
                      ? html`<div class="empty-state">${this.searchQuery ? "No matching items" : "No items found"}</div>`
                      : this.filteredAndSortedItems.map((item) =>
                          item.isFolder
                            ? html`
                            <div 
                              class="file-item folder-item"
                              @click=${() => this.navigateToFolder(item.path)}
                              @contextmenu=${(e: MouseEvent) => this.handleFolderContextMenu(e, item as WorkspaceFolder)}
                              title="${item.name}"
                            >
                              <span class="folder-icon">📁</span>
                              <div class="file-info">
                                <span class="file-name">${item.name}</span>
                                <div class="file-meta">
                                  <span>${this.formatRelativeTime(item.updatedAtMs)}</span>
                                </div>
                              </div>
                            </div>
                          `
                            : html`
                            <div
                              class="file-item ${item.missing ? "missing" : ""} ${this.selectedFile?.path === item.path ? "selected" : ""}"
                              @click=${() => this.selectFile(item as WorkspaceFile)}
                              @contextmenu=${(e: MouseEvent) => this.handleFileContextMenu(e, item as WorkspaceFile)}
                              title="${item.name}"
                            >
                              ${this.renderFileIcon(item.name)}
                              <div class="file-info">
                                <span class="file-name">${item.name}</span>
                                <div class="file-meta">
                                  <span>${this.formatFileSize(item.size)}</span>
                                  <span>${this.formatRelativeTime(item.updatedAtMs)}</span>
                                </div>
                              </div>
                            </div>
                          `,
                        )
                  }
                `
          }
        </div>
      </div>

      <!-- Content area -->
      <div class="content-area">
        <!-- Content header with breadcrumbs and actions -->
        <div class="content-header">
          <!-- Breadcrumbs -->
          <div class="content-breadcrumbs">
            📁
            ${getPathBreadcrumbs(this.currentPath).map(
              (crumb, index, arr) => html`
              <span 
                class="breadcrumb ${index === arr.length - 1 ? "active" : ""}"
                @click=${index < arr.length - 1 ? () => this.navigateToFolder(crumb.path) : undefined}
              >
                ${crumb.name}
              </span>
              ${
                index < arr.length - 1
                  ? html`
                      <span class="breadcrumb-separator">></span>
                    `
                  : ""
              }
            `,
            )}
            ${
              this.selectedFile
                ? html`
              <span class="breadcrumb-separator">></span>
              <span class="breadcrumb active">${this.selectedFile.name}</span>
            `
                : ""
            }
          </div>

          <!-- Action buttons -->
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
              <!-- Edit mode actions -->
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
              <!-- View mode actions -->
              <div class="dropdown">
                <button class="btn" @click=${this.toggleNewDropdown}>
                  + New ▾
                </button>
                ${
                  this.showNewDropdown
                    ? html`
                  <div class="dropdown-content">
                    <div class="dropdown-item" @click=${() => {
                      this.isCreating = true;
                      this.closeDropdowns();
                    }}>
                      📄 New File
                    </div>
                    <div class="dropdown-item" @click=${() => {
                      this.isCreatingFolder = true;
                      this.closeDropdowns();
                    }}>
                      📁 New Folder
                    </div>
                  </div>
                `
                    : ""
                }
              </div>

              <button class="btn" @click=${this.triggerUpload}>
                ↑ Upload
              </button>

              ${
                this.selectedFile
                  ? html`
                <div class="dropdown">
                  <button class="btn" @click=${this.toggleMoreDropdown}>
                    ⋮ More
                  </button>
                  ${
                    this.showMoreDropdown
                      ? html`
                    <div class="dropdown-content right-aligned">
                      <div class="dropdown-item" @click=${() => {
                        this.startRename();
                        this.closeDropdowns();
                      }}>
                        ✏️ Rename
                      </div>
                      <div class="dropdown-item danger" @click=${() => {
                        this.deleteFile();
                        this.closeDropdowns();
                      }}>
                        🗑️ Delete
                      </div>
                    </div>
                  `
                      : ""
                  }
                </div>
                
                ${
                  !this.isEditing
                    ? html`
                  <button class="btn btn-primary" @click=${this.toggleEdit}>
                    Edit
                  </button>
                `
                    : ""
                }
              `
                  : ""
              }
            `
            }
          </div>
        </div>

        <!-- Content body -->
        <div class="content-body">
          ${this.renderContentBody()}
        </div>

        <!-- Hidden file input for uploads -->
        <input
          type="file"
          multiple
          style="display:none"
          @change=${this.handleFileUpload}
          id="file-upload-input"
        />
      </div>

      <!-- Context menu -->
      ${
        this.contextMenu
          ? html`
        <div 
          class="context-menu" 
          style="left: ${this.contextMenu.x}px; top: ${this.contextMenu.y}px;"
        >
          ${this.contextMenu.items.map(
            (item) => html`
            <div 
              class="context-menu-item ${item.danger ? "danger" : ""}"
              @click=${() => {
                item.action();
                this.closeContextMenu();
              }}
            >
              ${item.icon || ""} ${item.label}
            </div>
          `,
          )}
        </div>
      `
          : ""
      }

      <!-- Mobile menu button -->
      <button
        class="mobile-menu-btn"
        @click=${() => (this.sidebarCollapsed = !this.sidebarCollapsed)}
        style="position: absolute; top: 12px; left: 12px; z-index: 5;"
      >
        ${this.renderMenuIcon()}
      </button>
    `;
  }

  private renderContentBody() {
    // Show inline creation forms
    if (this.isCreating) {
      return html`
        <div class="inline-form">
          <h3>Create New File</h3>
          <input
            type="text"
            class="inline-form-input"
            placeholder="filename.md"
            .value=${this.newFileName}
            @input=${(e: Event) => (this.newFileName = (e.target as HTMLInputElement).value)}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === "Enter") this.createFile();
              if (e.key === "Escape") this.cancelCreate();
            }}
          />
          <div class="inline-form-actions">
            <button class="btn-cancel" @click=${this.cancelCreate}>Cancel</button>
            <button class="btn-create" @click=${this.createFile}>Create File</button>
          </div>
        </div>
      `;
    }

    if (this.isCreatingFolder) {
      return html`
        <div class="inline-form">
          <h3>Create New Folder</h3>
          <input
            type="text"
            class="inline-form-input"
            placeholder="folder-name"
            .value=${this.newFolderName}
            @input=${(e: Event) => (this.newFolderName = (e.target as HTMLInputElement).value)}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === "Enter") this.createFolder();
              if (e.key === "Escape") this.cancelCreateFolder();
            }}
          />
          <div class="inline-form-actions">
            <button class="btn-cancel" @click=${this.cancelCreateFolder}>Cancel</button>
            <button class="btn-create" @click=${this.createFolder}>Create Folder</button>
          </div>
        </div>
      `;
    }

    if (this.isRenaming && this.selectedFile) {
      return html`
        <div class="inline-form">
          <h3>Rename File</h3>
          <input
            type="text"
            class="inline-form-input"
            .value=${this.newFileName}
            @input=${(e: Event) => (this.newFileName = (e.target as HTMLInputElement).value)}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === "Enter") this.renameFile();
              if (e.key === "Escape") this.cancelRename();
            }}
          />
          <div class="inline-form-actions">
            <button class="btn-cancel" @click=${this.cancelRename}>Cancel</button>
            <button class="btn-create" @click=${this.renameFile}>Rename</button>
          </div>
        </div>
      `;
    }

    // Show file content or empty state
    if (!this.selectedFile) {
      return html`
        <div class="empty-state">
          ${this.renderFolderIcon()}
          <span>Select a file to view</span>
        </div>
      `;
    }

    // Show loading, editor, or content
    if (this.loadingContent) {
      return html`
        <div class="content-spinner">
          <div class="spinner"></div>
        </div>
      `;
    }

    if (this.isEditing) {
      return html`
        <textarea
          class="edit-textarea"
          .value=${this.editedContent}
          @input=${this.handleContentChange}
          @keydown=${this.handleTextareaKeydown}
        ></textarea>
      `;
    }

    return this.renderContent();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "file-browser-view": FileBrowserView;
  }
}
