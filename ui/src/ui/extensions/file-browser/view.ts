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
      background: var(--bg-primary, #1a1a1a);
      color: var(--text-primary, #e0e0e0);
    }

    .sidebar {
      width: 250px;
      min-width: 200px;
      border-right: 1px solid var(--border-color, #333);
      display: flex;
      flex-direction: column;
      background: var(--bg-secondary, #242424);
    }

    .sidebar-header {
      padding: 16px;
      font-weight: 600;
      font-size: 14px;
      border-bottom: 1px solid var(--border-color, #333);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .sidebar-header svg {
      width: 18px;
      height: 18px;
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
      transition: background 0.15s;
    }

    .file-item:hover {
      background: var(--bg-hover, #2a2a2a);
    }

    .file-item.selected {
      background: var(--bg-selected, #3a3a3a);
      border-left: 3px solid var(--accent-color, #6366f1);
    }

    .file-item.missing {
      opacity: 0.5;
      font-style: italic;
    }

    .file-icon {
      width: 16px;
      height: 16px;
      opacity: 0.7;
    }

    .file-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .file-size {
      font-size: 11px;
      opacity: 0.5;
    }

    .content-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .content-header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color, #333);
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: var(--bg-secondary, #242424);
    }

    .content-title {
      font-weight: 600;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .content-actions {
      display: flex;
      gap: 8px;
    }

    .btn {
      padding: 6px 12px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.15s;
    }

    .btn-primary {
      background: var(--accent-color, #6366f1);
      color: white;
    }

    .btn-primary:hover {
      background: var(--accent-hover, #5558e3);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: var(--bg-tertiary, #333);
      color: var(--text-primary, #e0e0e0);
    }

    .btn-secondary:hover {
      background: var(--bg-hover, #3a3a3a);
    }

    .content-body {
      flex: 1;
      overflow: auto;
      padding: 16px;
    }

    .markdown-preview {
      line-height: 1.6;
      font-size: 14px;
    }

    .markdown-preview h1,
    .markdown-preview h2,
    .markdown-preview h3 {
      margin-top: 24px;
      margin-bottom: 12px;
      font-weight: 600;
    }

    .markdown-preview h1 {
      font-size: 24px;
      border-bottom: 1px solid var(--border-color, #333);
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
      background: var(--bg-tertiary, #333);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 13px;
    }

    .markdown-preview pre {
      background: var(--bg-tertiary, #333);
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
    }

    .markdown-preview pre code {
      background: none;
      padding: 0;
    }

    .markdown-preview blockquote {
      border-left: 3px solid var(--accent-color, #6366f1);
      margin: 12px 0;
      padding-left: 16px;
      opacity: 0.8;
    }

    .markdown-preview table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }

    .markdown-preview th,
    .markdown-preview td {
      border: 1px solid var(--border-color, #333);
      padding: 8px 12px;
      text-align: left;
    }

    .markdown-preview th {
      background: var(--bg-secondary, #242424);
      font-weight: 600;
    }

    .edit-textarea {
      width: 100%;
      height: 100%;
      background: var(--bg-primary, #1a1a1a);
      color: var(--text-primary, #e0e0e0);
      border: none;
      resize: none;
      font-family: monospace;
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
      opacity: 0.5;
      gap: 12px;
    }

    .empty-state svg {
      width: 48px;
      height: 48px;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      opacity: 0.5;
    }

    .error {
      color: #ef4444;
      padding: 16px;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadFiles();
  }

  private async loadFiles() {
    if (!this.gateway) {
      this.error = "No gateway connection";
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
      this.error = "Failed to load files";
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
        <polyline points="10 9 9 9 8 9"></polyline>
      </svg>
    `;
  }

  private renderFolderIcon() {
    return html`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
                ? html`<div class="error">${this.error}</div>`
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
                        <button class="btn btn-secondary" @click=${this.cancelEdit}>Cancel</button>
                        <button
                          class="btn btn-primary"
                          @click=${this.saveFile}
                          ?disabled=${this.isSaving}
                        >
                          ${this.isSaving ? "Saving..." : "Save"}
                        </button>
                      `
                      : html`
                        <button class="btn btn-secondary" @click=${this.toggleEdit}>Edit</button>
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
