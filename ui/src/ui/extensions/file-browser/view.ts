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
  private error: string | null = null;

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
    }

    .sidebar-header {
      padding: 16px;
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
      gap: 10px;
      font-size: 13px;
      transition: background var(--duration-fast) var(--ease-out);
      color: var(--text);
    }

    .file-item:hover {
      background: var(--bg-hover);
    }

    .file-item.selected {
      background: var(--accent-subtle);
      border-left: 3px solid var(--accent);
    }

    .file-item.missing {
      opacity: 0.5;
      font-style: italic;
    }

    .file-icon {
      width: 16px;
      height: 16px;
      color: var(--muted);
    }

    .file-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-size {
      font-size: 11px;
      color: var(--muted);
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
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadFiles();
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

    this.selectedFile = file;
    this.isEditing = false;

    const result = await getWorkspaceFile(this.gateway, file.name);
    if (result?.file.content !== undefined) {
      this.fileContent = result.file.content;
      this.editedContent = result.file.content;
    }
  }

  private toggleEdit() {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.editedContent = this.fileContent;
    }
  }

  private handleContentChange(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    this.editedContent = textarea.value;
  }

  private async saveFile() {
    if (!this.gateway || !this.selectedFile) return;

    this.isSaving = true;
    const success = await saveWorkspaceFile(
      this.gateway,
      this.selectedFile.name,
      this.editedContent,
    );

    if (success) {
      this.fileContent = this.editedContent;
      this.isEditing = false;
    } else {
      alert("Failed to save file");
    }
    this.isSaving = false;
  }

  private cancelEdit() {
    this.editedContent = this.fileContent;
    this.isEditing = false;
  }

  private formatFileSize(bytes?: number): string {
    if (bytes === undefined) return "";
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  private renderMarkdown(content: string): string {
    const rawHtml = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml);
  }

  private renderFileIcon() {
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

  render() {
    return html`
      <div class="sidebar">
        <div class="sidebar-header">
          ${this.renderFolderIcon()}
          Workspace Files
        </div>
        <div class="file-list">
          ${
            this.loading
              ? html`
                  <div class="loading">Loading...</div>
                `
              : this.error
                ? html`<div class="error-state">${this.error}</div>`
                : this.files.length === 0
                  ? html`
                      <div class="empty-state">No files found</div>
                    `
                  : this.files.map(
                      (file) => html`
                      <div
                        class="file-item ${file.missing ? "missing" : ""} ${this.selectedFile?.name === file.name ? "selected" : ""}"
                        @click=${() => this.selectFile(file)}
                      >
                        ${this.renderFileIcon()}
                        <span class="file-name">${file.name}</span>
                        <span class="file-size">${this.formatFileSize(file.size)}</span>
                      </div>
                    `,
                    )
          }
        </div>
      </div>
      <div class="content-area">
        ${
          this.selectedFile
            ? html`
              <div class="content-header">
                <div class="content-title">
                  ${this.renderFileIcon()}
                  ${this.selectedFile.name}
                </div>
                <div class="content-actions">
                  ${
                    this.isEditing
                      ? html`
                        <button class="btn" @click=${this.cancelEdit}>Cancel</button>
                        <button
                          class="btn btn-primary"
                          @click=${this.saveFile}
                          ?disabled=${this.isSaving}
                        >
                          ${this.isSaving ? "Saving..." : "Save"}
                        </button>
                      `
                      : html`
                        <button class="btn" @click=${this.toggleEdit}>Edit</button>
                      `
                  }
                </div>
              </div>
              <div class="content-body">
                ${
                  this.isEditing
                    ? html`
                      <textarea
                        class="edit-textarea"
                        .value=${this.editedContent}
                        @input=${this.handleContentChange}
                      ></textarea>
                    `
                    : html`
                      <div class="markdown-preview">
                        ${unsafeHTML(this.renderMarkdown(this.fileContent))}
                      </div>
                    `
                }
              </div>
            `
            : html`
              <div class="empty-state">
                ${this.renderFileIcon()}
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
