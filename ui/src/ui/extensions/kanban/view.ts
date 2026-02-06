import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import type { GatewayBrowserClient } from "../../gateway.js";
import { ocTheme, ocBaseFormStyles } from "../shared/theme.js";
import {
  loadTasks,
  saveTasks,
  loadKanbanData,
  saveKanbanData,
  createTask,
  moveTask,
  deleteTask,
  updateTask,
  createProject,
  createTag,
  processTagsInDescription,
  filterTasks,
  getProjectStats,
  COLUMNS,
  PRIORITY_COLORS,
  getTasksByStatus,
  formatTimeAgo,
  calculateOrder,
  type Task,
  type TaskStatus,
  type TaskPriority,
  type TasksData,
  type Project,
  type Tag,
  type TaskFilter,
} from "./controller.js";

@customElement("kanban-view")
export class KanbanView extends LitElement {
  @property({ attribute: false })
  gateway: GatewayBrowserClient | null = null;

  @state() private tasks: Task[] = [];
  @state() private projects: Project[] = [];
  @state() private tags: Tag[] = [];
  @state() private loading = true;
  @state() private saving = false;
  @state() private editingTaskId: string | null = null;
  // expandedTaskId removed — description always visible
  @state() private newTaskTitle = "";
  @state() private addingToColumn: TaskStatus | null = null;
  @state() private toastMessage: string | null = null;
  @state() private toastType: "error" | "success" = "error";
  @state() private deleteConfirmId: string | null = null;
  @state() private focusedTaskId: string | null = null;
  @state() private draggingTaskId: string | null = null;
  @state() private dragOverColumn: TaskStatus | null = null;
  @state() private dragCardHeight: number = 0;
  @state() private filter: TaskFilter = {};
  @state() private showingNewProjectForm = false;
  @state() private newProjectName = "";

  private editCancelled = false;

  static styles = [
    ocTheme,
    ocBaseFormStyles,
    css`
      :host {
        display: block;
        height: 100%;
        background: var(--background);
        color: var(--foreground);
        padding: 1.25rem;
        overflow: auto;
        font-family: var(--oc-font-sans);
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1.5rem;
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .title {
        font-size: var(--oc-text-xl);
        font-weight: var(--oc-weight-semibold);
        display: flex;
        align-items: center;
        gap: 0.625rem;
        color: var(--foreground);
      }

      .title svg {
        width: 1.5rem;
        height: 1.5rem;
        color: var(--muted-foreground);
      }

      .title-count {
        font-size: var(--oc-text-sm);
        font-weight: var(--oc-weight-normal);
        color: var(--muted-foreground);
      }

      /* Filter Bar Styles */
      .filter-bar {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 1rem;
        background: var(--card);
        border-radius: var(--radius-lg);
        border: 1px solid var(--border);
        margin-bottom: 1.25rem;
        flex-wrap: wrap;
      }

      .filter-group {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .filter-label {
        font-size: var(--oc-text-sm);
        font-weight: var(--oc-weight-medium);
        color: var(--foreground);
      }

      .active-filters {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        flex-wrap: wrap;
      }

      .filter-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.125rem 0.5rem;
        background: var(--secondary);
        color: var(--secondary-foreground);
        border-radius: var(--radius-full);
        font-size: 0.75rem;
        font-weight: var(--oc-weight-medium);
        cursor: pointer;
        border: 1px solid var(--border);
        transition: background-color var(--oc-duration-fast) var(--oc-ease);
      }

      .filter-pill:hover {
        background: var(--accent);
        color: var(--accent-foreground);
      }

      .filter-pill-close {
        width: 0.875rem;
        height: 0.875rem;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.2);
        color: inherit;
      }

      .clear-filters {
        color: var(--muted-foreground);
        font-size: 0.75rem;
        cursor: pointer;
        text-decoration: underline;
      }

      .clear-filters:hover {
        color: var(--foreground);
      }

      .saving-indicator {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        font-size: 0.75rem;
        color: var(--muted-foreground);
      }

      .spinner {
        width: 0.875rem;
        height: 0.875rem;
        border: 2px solid var(--border);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .board {
        display: flex;
        gap: 1rem;
        height: calc(100% - 4.375rem);
        min-height: 25rem;
      }

      .column {
        flex: 1;
        min-width: 16.25rem;
        max-width: 20rem;
        background: var(--card);
        border-radius: var(--radius-lg);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid var(--border);
        box-shadow: var(--oc-shadow-sm);
      }

      .column-header {
        padding: 0.875rem 1rem;
        font-weight: var(--oc-weight-semibold);
        font-size: var(--oc-text-sm);
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid var(--border);
        background: var(--muted);
      }

      .column-title {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: var(--foreground);
      }

      .column-dot {
        width: 0.625rem;
        height: 0.625rem;
        border-radius: 50%;
      }

      .column-count {
        background: var(--secondary);
        padding: 0.125rem 0.5rem;
        border-radius: var(--radius-full);
        font-size: 0.75rem;
        font-weight: var(--oc-weight-medium);
        color: var(--muted-foreground);
      }

      .column-body {
        flex: 1;
        padding: 0.75rem;
        overflow-y: auto;
        min-height: 6.25rem;
      }

      .task-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        min-height: 3.75rem;
      }

      .empty-message {
        text-align: center;
        padding: 1.5rem 1rem;
        color: var(--muted-foreground);
        font-size: var(--oc-text-sm);
        font-style: italic;
      }

      .task-card {
        background: var(--card);
        border-radius: var(--radius-lg);
        padding: 0;
        transition:
          border-color var(--oc-duration-fast) var(--oc-ease),
          box-shadow var(--oc-duration-fast) var(--oc-ease);
        border: 1px solid var(--border);
        box-shadow: var(--oc-shadow-sm);
        outline: none;
        cursor: grab;
      }

      .task-card:active {
        cursor: grabbing;
      }

      .task-card:hover {
        border-color: var(--oc-gray-300);
        box-shadow: var(--oc-shadow-md);
      }

      .task-card:focus-visible {
        border-color: var(--ring);
        box-shadow: var(--focus-ring);
      }

      .task-card.dragging {
        opacity: 0.3;
      }

      .drag-placeholder {
        border: 2px dashed var(--primary);
        border-radius: var(--radius-lg);
        background: hsla(221.2, 83.2%, 53.3%, 0.1);
        transition: height var(--oc-duration-fast) var(--oc-ease);
      }

      .task-main {
        display: flex;
        align-items: flex-start;
        gap: 0.375rem;
        padding: 0.875rem 0.875rem 0 0.625rem;
      }

      .drag-handle {
        cursor: grab;
        color: var(--muted-foreground);
        opacity: 0;
        padding: 0.25rem 0.125rem;
        flex-shrink: 0;
        transition: opacity var(--oc-duration-fast) var(--oc-ease);
        margin-top: -0.0625rem;
      }

      .task-card:hover .drag-handle {
        opacity: 0.5;
      }

      .drag-handle:hover {
        opacity: 0.8 !important;
      }

      .drag-handle:active {
        cursor: grabbing;
      }

      .drag-handle svg {
        width: 0.75rem;
        height: 0.75rem;
      }

      .task-content {
        flex: 1;
        min-width: 0;
      }

      .task-content-header {
        width: 100%;
      }

      .task-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .task-title {
        font-size: var(--oc-text-sm);
        font-weight: var(--oc-weight-medium);
        line-height: 1.45;
        word-break: break-word;
        color: var(--foreground);
        flex: 1;
      }

      .task-edit-form {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .task-title-input {
        width: 100%;
        box-sizing: border-box;
        background: var(--card);
        border: 1px solid var(--ring);
        border-radius: var(--radius);
        padding: 0.5rem 0.75rem;
        color: var(--foreground);
        font-size: var(--oc-text-sm);
        font-weight: var(--oc-weight-medium);
        font-family: var(--oc-font-sans);
        outline: none;
        box-shadow: var(--focus-ring);
      }

      .task-edit-actions {
        display: flex;
        gap: 0.375rem;
        justify-content: flex-end;
      }

      .task-actions {
        display: flex;
        gap: 0.25rem;
        opacity: 0;
        transition: opacity var(--oc-duration-fast) var(--oc-ease);
        flex-shrink: 0;
      }

      .task-card:hover .task-actions,
      .task-card:focus .task-actions,
      .task-card:focus-within .task-actions {
        opacity: 1;
      }

      .task-action-btn {
        background: none;
        border: none;
        padding: 0.25rem;
        cursor: pointer;
        opacity: 0.6;
        transition:
          opacity var(--oc-duration-fast) var(--oc-ease),
          background-color var(--oc-duration-fast) var(--oc-ease);
        color: var(--muted-foreground);
        border-radius: var(--radius-sm);
      }

      .task-action-btn:hover {
        opacity: 1;
        color: var(--foreground);
        background: var(--accent);
      }

      .task-action-btn.delete:hover {
        color: var(--destructive);
        background: var(--oc-danger-light);
      }

      .task-action-btn svg {
        width: 0.875rem;
        height: 0.875rem;
      }

      .task-body {
        padding: 0.5rem 0.875rem 0.875rem 1.75rem;
      }

      .task-description {
        width: 100%;
        box-sizing: border-box;
        background: var(--background);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 0.375rem 0.5rem;
        color: var(--foreground);
        font-size: 0.75rem;
        font-family: var(--oc-font-sans);
        line-height: 1.5;
        outline: none;
        resize: none;
        overflow: hidden;
        min-height: 2.625rem;
        cursor: text;
        transition:
          border-color var(--oc-duration-fast) var(--oc-ease),
          background-color var(--oc-duration-fast) var(--oc-ease),
          box-shadow var(--oc-duration-fast) var(--oc-ease);
      }

      .task-description:hover {
        border-color: var(--oc-gray-300);
      }

      .task-description:focus {
        border-color: var(--ring);
        box-shadow: var(--focus-ring);
      }

      .task-description::placeholder {
        color: var(--muted-foreground);
      }

      /* Project and Tag Styles */
      .task-project {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.6875rem;
        color: var(--muted-foreground);
      }

      .project-dot {
        width: 0.5rem;
        height: 0.5rem;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .project-select {
        appearance: none;
        -webkit-appearance: none;
        background: var(--background);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 0.25rem 1.5rem 0.25rem 0.5rem;
        color: var(--foreground);
        font-size: 0.6875rem;
        font-family: var(--oc-font-sans);
        outline: none;
        cursor: pointer;
        max-width: 8.75rem;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.375rem center;
        transition: border-color var(--oc-duration-fast) var(--oc-ease);
      }

      .project-select:hover {
        border-color: var(--oc-gray-300);
      }

      .project-select:focus {
        border-color: var(--ring);
        box-shadow: var(--focus-ring);
      }

      .task-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        margin-top: 0.25rem;
      }

      .tag-pill {
        display: inline-flex;
        align-items: center;
        padding: 0.125rem 0.375rem;
        border-radius: var(--radius-full);
        font-size: 0.625rem;
        font-weight: var(--oc-weight-medium);
        color: white;
        cursor: pointer;
        line-height: 1.2;
        transition: filter var(--oc-duration-fast) var(--oc-ease);
      }

      .tag-pill:hover {
        filter: brightness(1.1);
      }

      .new-project-form {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 0.5rem;
        margin-top: 0.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.375rem;
      }

      .new-project-input {
        background: var(--background);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        padding: 0.25rem 0.375rem;
        color: var(--foreground);
        font-size: 0.6875rem;
        font-family: var(--oc-font-sans);
        outline: none;
      }

      .new-project-input:focus {
        border-color: var(--ring);
        box-shadow: var(--focus-ring);
      }

      .new-project-actions {
        display: flex;
        gap: 0.25rem;
        justify-content: flex-end;
      }

      .task-footer {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin-top: 0.625rem;
      }

      .task-footer-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .task-time {
        font-size: 0.6875rem;
        color: var(--muted-foreground);
      }

      .priority-badge {
        display: inline-flex;
        align-items: center;
        padding: 0.125rem 0.625rem;
        border-radius: var(--radius-full);
        font-size: 0.6875rem;
        font-weight: var(--oc-weight-medium);
        cursor: pointer;
        border: 1px solid transparent;
        background: none;
        text-transform: capitalize;
        transition: all var(--oc-duration-fast) var(--oc-ease);
        line-height: 1.5;
        letter-spacing: -0.01em;
      }

      .priority-badge:hover {
        filter: brightness(1.15);
      }

      .priority-badge.none {
        color: var(--muted-foreground);
        font-size: 0.6875rem;
        padding: 0.125rem 0.5rem;
        border: 1px dashed var(--border);
      }

      .priority-badge.none:hover {
        border-color: var(--oc-gray-300);
        color: var(--foreground);
      }

      .add-task-btn {
        width: 100%;
        padding: 0.625rem;
        background: transparent;
        border: 2px dashed var(--border);
        border-radius: var(--radius);
        color: var(--muted-foreground);
        cursor: pointer;
        font-size: var(--oc-text-sm);
        transition: all var(--oc-duration-fast) var(--oc-ease);
        margin-top: 0.5rem;
      }

      .add-task-btn:hover {
        border-color: var(--primary);
        color: var(--primary);
        background: hsla(221.2, 83.2%, 53.3%, 0.05);
      }

      .add-task-form {
        background: var(--card);
        border-radius: var(--radius);
        padding: 0.75rem;
        margin-top: 0.5rem;
        border: 1px solid var(--border);
      }

      .add-task-input {
        width: 100%;
        box-sizing: border-box;
        background: var(--background);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 0.625rem 0.75rem;
        color: var(--foreground);
        font-size: var(--oc-text-sm);
        font-family: var(--oc-font-sans);
        outline: none;
        margin-bottom: 0.625rem;
      }

      .add-task-input:focus {
        border-color: var(--ring);
        box-shadow: var(--focus-ring);
      }

      .add-task-input::placeholder {
        color: var(--muted-foreground);
      }

      .add-task-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: flex-end;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.375rem;
        padding: 0.5rem 1rem;
        border-radius: var(--radius);
        border: 1px solid var(--border);
        cursor: pointer;
        font-size: var(--oc-text-sm);
        font-weight: var(--oc-weight-medium);
        letter-spacing: -0.01em;
        height: 2.25rem;
        transition:
          border-color var(--oc-duration-fast) var(--oc-ease),
          background-color var(--oc-duration-fast) var(--oc-ease),
          box-shadow var(--oc-duration-fast) var(--oc-ease);
        background: var(--secondary);
        color: var(--secondary-foreground);
      }

      .btn:hover:not(:disabled) {
        background: var(--accent);
        border-color: var(--oc-gray-300);
      }

      .btn:focus {
        box-shadow: var(--focus-ring);
      }

      .btn-primary {
        background: var(--primary);
        color: var(--primary-foreground);
        border-color: var(--primary);
        box-shadow: 0 1px 2px hsla(0, 0%, 0%, 0.05);
      }

      .btn-primary:hover:not(:disabled) {
        background: hsl(221.2 83.2% 48%);
        border-color: hsl(221.2 83.2% 48%);
        box-shadow: var(--oc-shadow-sm);
      }

      .btn-danger {
        background: var(--destructive);
        color: var(--destructive-foreground);
        border-color: var(--destructive);
      }

      .btn-danger:hover:not(:disabled) {
        background: hsl(0 84.2% 55%);
        border-color: hsl(0 84.2% 55%);
      }

      .loading {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--muted-foreground);
        gap: 0.625rem;
      }

      .toast {
        position: fixed;
        bottom: 1.25rem;
        right: 1.25rem;
        padding: 0.75rem 1.25rem;
        border-radius: var(--radius);
        font-size: var(--oc-text-sm);
        box-shadow: var(--oc-shadow-lg);
        z-index: 1000;
        animation: toast-in 0.2s ease-out;
      }

      .toast.error {
        background: var(--destructive);
        color: var(--destructive-foreground);
      }

      .toast.success {
        background: var(--oc-success);
        color: white;
      }

      @keyframes toast-in {
        from {
          opacity: 0;
          transform: translateY(0.625rem);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* Delete confirmation modal */
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        animation: fade-in 0.15s ease-out;
      }

      @keyframes fade-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      .modal {
        background: var(--card);
        border-radius: var(--radius-lg);
        padding: 1.5rem;
        max-width: 25rem;
        width: 90%;
        box-shadow: var(--oc-shadow-xl);
        border: 1px solid var(--border);
      }

      .modal-title {
        font-size: var(--oc-text-lg);
        font-weight: var(--oc-weight-semibold);
        color: var(--foreground);
        margin-bottom: 0.75rem;
      }

      .modal-body {
        font-size: var(--oc-text-sm);
        color: var(--muted-foreground);
        margin-bottom: 1.25rem;
      }

      .modal-actions {
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
      }

      /* Responsive */
      @media (max-width: 900px) {
        .board {
          flex-wrap: wrap;
          height: auto;
        }

        .column {
          min-width: calc(50% - 0.5rem);
          max-width: none;
          flex: 1 1 calc(50% - 0.5rem);
        }
      }

      @media (max-width: 600px) {
        :host {
          padding: 0.75rem;
        }

        .column {
          min-width: 100%;
          flex: 1 1 100%;
        }

        .board {
          gap: 0.75rem;
        }
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    this.loadData();
    this.addEventListener("keydown", this.handleGlobalKeydown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("keydown", this.handleGlobalKeydown);
  }

  private handleGlobalKeydown = (e: KeyboardEvent) => {
    if (this.deleteConfirmId || this.editingTaskId || this.addingToColumn) return;
    // Don't capture keys when typing in a textarea/input
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;

    const allTasks = this.getAllTaskElements();
    if (allTasks.length === 0) return;

    const currentIndex = this.focusedTaskId
      ? allTasks.findIndex((el) => el.dataset.taskId === this.focusedTaskId)
      : -1;

    switch (e.key) {
      case "ArrowDown":
      case "j":
        e.preventDefault();
        this.focusTask(allTasks, currentIndex + 1);
        break;
      case "ArrowUp":
      case "k":
        e.preventDefault();
        this.focusTask(allTasks, currentIndex - 1);
        break;
      case "Enter":
        if (this.focusedTaskId) {
          e.preventDefault();
          this.startEditTask(this.focusedTaskId);
        }
        break;
      case "Delete":
      case "Backspace":
        if (this.focusedTaskId && e.target === this.shadowRoot?.activeElement) {
          e.preventDefault();
          this.confirmDelete(this.focusedTaskId);
        }
        break;
      case "e":
        if (this.focusedTaskId) {
          e.preventDefault();
          this.startEditTask(this.focusedTaskId);
        }
        break;
    }
  };

  private getAllTaskElements(): HTMLElement[] {
    return Array.from(this.shadowRoot?.querySelectorAll(".task-card") || []);
  }

  private focusTask(allTasks: HTMLElement[], index: number) {
    if (allTasks.length === 0) return;
    const clampedIndex = Math.max(0, Math.min(index, allTasks.length - 1));
    const taskEl = allTasks[clampedIndex];
    taskEl.focus();
    this.focusedTaskId = taskEl.dataset.taskId || null;
  }

  private async loadData() {
    if (!this.gateway) {
      this.loading = false;
      return;
    }

    this.loading = true;
    try {
      const data = await loadKanbanData(this.gateway);
      this.tasks = data.tasks;
      this.projects = data.projects;
      this.tags = data.tags;
    } catch (err) {
      console.error("Failed to load data:", err);
      this.showToast("Failed to load data", "error");
    }
    this.loading = false;
  }

  private async saveData() {
    if (!this.gateway) return;
    this.saving = true;
    const data: TasksData = {
      tasks: this.tasks,
      projects: this.projects,
      tags: this.tags,
      lastUpdated: Date.now(),
    };
    const success = await saveKanbanData(this.gateway, data);
    this.saving = false;
    if (!success) {
      this.showToast("Failed to save data", "error");
    }
  }

  private showToast(message: string, type: "error" | "success" = "error") {
    this.toastMessage = message;
    this.toastType = type;
    setTimeout(() => {
      this.toastMessage = null;
    }, 3000);
  }

  // --- Native HTML5 Drag and Drop ---

  private handleDragStart(e: DragEvent, taskId: string) {
    if (!e.dataTransfer) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
    // Capture card height for placeholder
    const card = (e.target as HTMLElement).closest(".task-card") as HTMLElement;
    if (card) this.dragCardHeight = card.offsetHeight;
    // Delay so the dragging class applies after the drag image is captured
    requestAnimationFrame(() => {
      this.draggingTaskId = taskId;
    });
  }

  private handleDragEndCleanup() {
    this.draggingTaskId = null;
    this.dragOverColumn = null;
  }

  private handleColumnDragOver(e: DragEvent, status: TaskStatus) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    this.dragOverColumn = status;
  }

  private handleColumnDragLeave(e: DragEvent, status: TaskStatus) {
    // Only clear if actually leaving the column (not entering a child)
    const related = e.relatedTarget as HTMLElement | null;
    const taskList = e.currentTarget as HTMLElement;
    if (!related || !taskList.contains(related)) {
      if (this.dragOverColumn === status) {
        this.dragOverColumn = null;
      }
    }
  }

  private handleColumnDrop(e: DragEvent, newStatus: TaskStatus) {
    e.preventDefault();
    this.dragOverColumn = null;

    const taskId = e.dataTransfer?.getData("text/plain");
    if (!taskId) return;

    const taskIndex = this.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) return;

    const task = this.tasks[taskIndex];

    // Determine insertion index based on drop Y position
    const dropY = e.clientY;
    const taskList = e.currentTarget as HTMLElement;
    const cards = Array.from(taskList.querySelectorAll(".task-card")) as HTMLElement[];
    let insertIndex = cards.length; // Default: append at end

    for (let i = 0; i < cards.length; i++) {
      // Skip the card being dragged
      if (cards[i].dataset.taskId === taskId) continue;
      const rect = cards[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (dropY < midY) {
        // Count how many non-dragged cards are before this one
        insertIndex = cards.slice(0, i).filter((c) => c.dataset.taskId !== taskId).length;
        break;
      }
    }

    const targetColumnTasks = getTasksByStatus(this.tasks, newStatus).filter(
      (t) => t.id !== taskId,
    );
    const newOrder = calculateOrder(targetColumnTasks, insertIndex);

    const statusChanged = task.status !== newStatus;
    const orderChanged = task.order !== newOrder;

    if (statusChanged || orderChanged) {
      const updatedTasks = [...this.tasks];
      updatedTasks[taskIndex] = moveTask(task, newStatus, newOrder);
      this.tasks = updatedTasks;
      this.saveData();
    }

    this.draggingTaskId = null;
  }

  // toggleExpanded removed — description always visible

  private startAddTask(status: TaskStatus) {
    this.addingToColumn = status;
    this.newTaskTitle = "";
    requestAnimationFrame(() => {
      const input = this.shadowRoot?.querySelector(
        `.column[data-status="${status}"] .add-task-input`,
      ) as HTMLInputElement;
      input?.focus();
    });
  }

  private cancelAddTask() {
    this.addingToColumn = null;
    this.newTaskTitle = "";
  }

  private addTask() {
    if (!this.newTaskTitle.trim() || !this.addingToColumn) return;

    const task = createTask(this.newTaskTitle.trim(), this.addingToColumn, this.tasks);
    this.tasks = [...this.tasks, task];
    this.saveData();
    this.showToast("Task added", "success");
    this.cancelAddTask();
  }

  private handleAddTaskKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      this.addTask();
    } else if (e.key === "Escape") {
      this.cancelAddTask();
    }
  }

  private startEditTask(taskId: string) {
    this.editingTaskId = taskId;
    requestAnimationFrame(() => {
      const input = this.shadowRoot?.querySelector(
        `.task-card[data-task-id="${taskId}"] .task-title-input`,
      ) as HTMLInputElement;
      input?.focus();
      input?.select();
    });
  }

  private saveTaskTitle(taskId: string, newTitle: string) {
    if (!newTitle.trim()) {
      this.editingTaskId = null;
      return;
    }

    const taskIndex = this.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex !== -1) {
      const updatedTasks = [...this.tasks];
      updatedTasks[taskIndex] = updateTask(updatedTasks[taskIndex], { title: newTitle.trim() });
      this.tasks = updatedTasks;
      this.saveData();
    }
    this.editingTaskId = null;
  }

  private handleEditKeydown(e: KeyboardEvent, taskId: string) {
    if (e.key === "Enter") {
      e.preventDefault();
      const input = e.target as HTMLInputElement;
      this.saveTaskTitle(taskId, input.value);
    } else if (e.key === "Escape") {
      this.editCancelled = true;
      this.editingTaskId = null;
    }
  }

  private handleEditBlur(e: FocusEvent, taskId: string) {
    if (this.editCancelled) {
      this.editCancelled = false;
      return;
    }
    this.saveTaskTitle(taskId, (e.target as HTMLInputElement).value);
  }

  private updateDescription(taskId: string, description: string) {
    const taskIndex = this.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex !== -1) {
      // Process tags in description and auto-create new ones
      const { newTags } = processTagsInDescription(description, this.tags);
      if (newTags.length > 0) {
        this.tags = [...this.tags, ...newTags];
      }

      // Extract tag names from description for task.tags
      const tagRegex = /#(\w+)/g;
      const tagMatches = Array.from(description.matchAll(tagRegex));
      const taskTags = tagMatches.map((match) => match[1]);

      const updatedTasks = [...this.tasks];
      updatedTasks[taskIndex] = updateTask(updatedTasks[taskIndex], {
        description: description.trim() || undefined,
        tags: taskTags.length > 0 ? taskTags : undefined,
      });
      this.tasks = updatedTasks;
      this.saveData();
    }
  }

  private updatePriority(taskId: string, priority: TaskPriority | "") {
    const taskIndex = this.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex !== -1) {
      const updatedTasks = [...this.tasks];
      updatedTasks[taskIndex] = updateTask(updatedTasks[taskIndex], {
        priority: priority || undefined,
      });
      this.tasks = updatedTasks;
      this.saveData();
    }
  }

  private confirmDelete(taskId: string) {
    this.deleteConfirmId = taskId;
  }

  private cancelDelete() {
    this.deleteConfirmId = null;
  }

  private executeDelete() {
    if (!this.deleteConfirmId) return;
    this.tasks = deleteTask(this.tasks, this.deleteConfirmId);
    this.saveData();
    this.showToast("Task deleted", "success");
    this.deleteConfirmId = null;
    this.focusedTaskId = null;
  }

  // Project management methods
  private updateTaskProject(taskId: string, projectId: string | "") {
    const taskIndex = this.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex !== -1) {
      const updatedTasks = [...this.tasks];
      updatedTasks[taskIndex] = updateTask(updatedTasks[taskIndex], {
        project: projectId || undefined,
      });
      this.tasks = updatedTasks;
      this.saveData();
    }
  }

  private addNewProject(taskId?: string) {
    if (!this.newProjectName.trim()) return;
    const project = createProject(this.newProjectName.trim(), this.projects);
    this.projects = [...this.projects, project];

    // If taskId is provided, assign the new project to that task
    if (taskId) {
      this.updateTaskProject(taskId, project.id);
    }

    this.saveData();
    this.showToast(`Project "${project.name}" created`, "success");
    this.newProjectName = "";
    this.showingNewProjectForm = false;
  }

  private cancelNewProject() {
    this.showingNewProjectForm = false;
    this.newProjectName = "";
  }

  // Filter management methods
  private updateFilter(updates: Partial<TaskFilter>) {
    this.filter = { ...this.filter, ...updates };
  }

  private clearFilter() {
    this.filter = {};
  }

  private removeFilterTag(tag: string) {
    const currentTags = this.filter.tags || [];
    const newTags = currentTags.filter((t) => t !== tag);
    this.updateFilter({ tags: newTags.length > 0 ? newTags : undefined });
  }

  private addFilterTag(tag: string) {
    const currentTags = this.filter.tags || [];
    if (!currentTags.includes(tag)) {
      this.updateFilter({ tags: [...currentTags, tag] });
    }
  }

  private getFilteredTasks(): Task[] {
    return filterTasks(this.tasks, this.filter);
  }

  private renderGripIcon() {
    return html`
      <svg viewBox="0 0 24 24" fill="currentColor">
        <circle cx="9" cy="6" r="1.5"></circle>
        <circle cx="15" cy="6" r="1.5"></circle>
        <circle cx="9" cy="12" r="1.5"></circle>
        <circle cx="15" cy="12" r="1.5"></circle>
        <circle cx="9" cy="18" r="1.5"></circle>
        <circle cx="15" cy="18" r="1.5"></circle>
      </svg>
    `;
  }

  private renderKanbanIcon() {
    return html`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
        <line x1="15" y1="3" x2="15" y2="21"></line>
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

  private renderDeleteIcon() {
    return html`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    `;
  }

  // renderCommentIcon removed — description always visible

  private cyclePriority(task: Task) {
    const cycle: Array<TaskPriority | ""> = ["", "low", "medium", "high"];
    const current = cycle.indexOf(task.priority || "");
    const next = cycle[(current + 1) % cycle.length];
    this.updatePriority(task.id, next);
  }

  private renderPriorityBadge(task: Task) {
    const p = task.priority;
    if (!p) {
      return html`<button class="priority-badge none" title="Set priority" @click=${(e: Event) => {
        e.stopPropagation();
        this.cyclePriority(task);
      }}>—</button>`;
    }
    const color = PRIORITY_COLORS[p];
    return html`<button class="priority-badge" style="background: ${color}20; color: ${color}; border-color: ${color}40;" title="Priority: ${p} (click to change)" @click=${(
      e: Event,
    ) => {
      e.stopPropagation();
      this.cyclePriority(task);
    }}>${p}</button>`;
  }

  private renderTaskProject(task: Task) {
    const currentProject = task.project ? this.projects.find((p) => p.id === task.project) : null;

    return html`
      <div class="task-project" @click=${(e: Event) => e.stopPropagation()}>
        ${
          currentProject
            ? html`
            <div style="display: flex; align-items: center; gap: 4px; cursor: pointer;" 
                 @click=${() => {
                   // Allow clicking on the project name to change it
                   const select = this.shadowRoot?.querySelector(
                     `#project-select-${task.id}`,
                   ) as HTMLSelectElement;
                   if (select) select.style.display = "inline-block";
                 }}>
              <div class="project-dot" style="background: ${currentProject.color}"></div>
              <span>${currentProject.name}</span>
            </div>
          `
            : nothing
        }
        <select 
          id="project-select-${task.id}"
          class="project-select" 
          style="${currentProject ? "display: none;" : ""}"
          .value=${task.project || ""}
          @change=${(e: Event) => {
            const select = e.target as HTMLSelectElement;
            if (select.value === "__new__") {
              this.showingNewProjectForm = true;
            } else {
              this.updateTaskProject(task.id, select.value);
              if (select.value && currentProject) {
                select.style.display = "none";
              }
            }
          }}
          @blur=${(e: Event) => {
            const select = e.target as HTMLSelectElement;
            if (currentProject && !this.showingNewProjectForm) {
              select.style.display = "none";
            }
          }}
        >
          <option value="">No project</option>
          ${this.projects.map(
            (project) => html`
            <option value="${project.id}" ?selected=${task.project === project.id}>
              ${project.name}
            </option>
          `,
          )}
          <option value="__new__">+ New project</option>
        </select>
        ${
          this.showingNewProjectForm
            ? html`
          <div class="new-project-form">
            <input
              type="text"
              class="new-project-input"
              placeholder="Project name..."
              .value=${this.newProjectName}
              @input=${(e: Event) => (this.newProjectName = (e.target as HTMLInputElement).value)}
              @keydown=${(e: KeyboardEvent) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  this.addNewProject(task.id);
                } else if (e.key === "Escape") {
                  this.cancelNewProject();
                }
              }}
            />
            <div class="new-project-actions">
              <button class="btn btn-xs" @click=${this.cancelNewProject}>Cancel</button>
              <button class="btn btn-primary btn-xs" @click=${() => this.addNewProject(task.id)}>Add</button>
            </div>
          </div>
        `
            : nothing
        }
      </div>
    `;
  }

  private renderTaskTags(task: Task) {
    if (!task.tags || task.tags.length === 0) {
      return nothing;
    }

    return html`
      <div class="task-tags">
        ${task.tags.map((tagName) => {
          const tag = this.tags.find((t) => t.name === tagName);
          const color = tag?.color || "#6b7280";
          return html`
            <span 
              class="tag-pill" 
              style="background: ${color}" 
              title="Filter by #${tagName}"
              @click=${(e: Event) => {
                e.stopPropagation();
                this.addFilterTag(tagName);
              }}
            >
              #${tagName}
            </span>
          `;
        })}
      </div>
    `;
  }

  private renderTask(task: Task) {
    const isEditing = this.editingTaskId === task.id;
    const isDragging = this.draggingTaskId === task.id;

    return html`
      <div
        class="task-card ${isDragging ? "dragging" : ""}"
        data-task-id=${task.id}
        tabindex="0"
        draggable=${isEditing ? "false" : "true"}
        @dragstart=${(e: DragEvent) => {
          if (isEditing) {
            e.preventDefault();
            return;
          }
          this.handleDragStart(e, task.id);
        }}
        @dragend=${() => this.handleDragEndCleanup()}
        @focus=${() => (this.focusedTaskId = task.id)}
      >
        <div class="task-main">
          <div class="drag-handle">${this.renderGripIcon()}</div>
          <div class="task-content">
            ${
              isEditing
                ? html`
                  <div class="task-edit-form" @click=${(e: Event) => e.stopPropagation()}>
                    <input
                      type="text"
                      class="task-title-input"
                      draggable="false"
                      .value=${task.title}
                      @dragstart=${(e: DragEvent) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      @mousedown=${(e: MouseEvent) => e.stopPropagation()}
                      @keydown=${(e: KeyboardEvent) => {
                        e.stopPropagation();
                        this.handleEditKeydown(e, task.id);
                      }}
                    />
                    <div class="task-edit-actions">
                      <button class="btn btn-sm" @click=${() => {
                        this.editingTaskId = null;
                      }}>Cancel</button>
                      <button class="btn btn-primary btn-sm" @click=${() => {
                        const input = this.shadowRoot?.querySelector(
                          `.task-card[data-task-id="${task.id}"] .task-title-input`,
                        ) as HTMLInputElement;
                        if (input)
                          this.handleEditBlur({ target: input } as unknown as FocusEvent, task.id);
                      }}>Save</button>
                    </div>
                  </div>
                `
                : html`
                  <div class="task-content-header">
                    <div class="task-title">${task.title}</div>
                    ${this.renderTaskTags(task)}
                  </div>
                `
            }
          </div>
          ${
            !isEditing
              ? html`
                <div class="task-actions">
                  <button
                    class="task-action-btn"
                    title="Edit title (e)"
                    @click=${(e: Event) => {
                      e.stopPropagation();
                      this.startEditTask(task.id);
                    }}
                  >
                    ${this.renderEditIcon()}
                  </button>
                  <button
                    class="task-action-btn delete"
                    title="Delete (Del)"
                    @click=${(e: Event) => {
                      e.stopPropagation();
                      this.confirmDelete(task.id);
                    }}
                  >
                    ${this.renderDeleteIcon()}
                  </button>
                </div>
              `
              : nothing
          }
        </div>
        <div class="task-body" @click=${(e: Event) => e.stopPropagation()}>
          <textarea
            class="task-description"
            placeholder="Add description..."
            draggable="false"
            .value=${task.description || ""}
            @blur=${(e: FocusEvent) =>
              this.updateDescription(task.id, (e.target as HTMLTextAreaElement).value)}
            @keydown=${(e: KeyboardEvent) => e.stopPropagation()}
            @dragstart=${(e: DragEvent) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            @mousedown=${(e: MouseEvent) => e.stopPropagation()}
            rows="2"
            @input=${(e: Event) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = "auto";
              t.style.height = t.scrollHeight + "px";
            }}
            @focus=${(e: Event) => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = "auto";
              t.style.height = t.scrollHeight + "px";
            }}
          ></textarea>
          <div class="task-footer">
            <div class="task-footer-row">
              ${this.renderPriorityBadge(task)}
              ${this.renderTaskProject(task)}
            </div>
            <span class="task-time">${formatTimeAgo(task.createdAt)}</span>
          </div>
        </div>
      </div>
    `;
  }

  private renderColumn(column: (typeof COLUMNS)[0]) {
    const allTasks = getTasksByStatus(this.getFilteredTasks(), column.id);

    return html`
      <div class="column" data-status=${column.id}>
        <div class="column-header">
          <div class="column-title">
            <div class="column-dot" style="background: ${column.color}"></div>
            ${column.title}
          </div>
          <div class="column-count">${allTasks.length}</div>
        </div>
        <div class="column-body">
          ${
            allTasks.length === 0
              ? html`
                  <div class="empty-message">No tasks</div>
                `
              : nothing
          }
          <div
            class="task-list"
            data-status=${column.id}
            @dragover=${(e: DragEvent) => this.handleColumnDragOver(e, column.id)}
            @dragleave=${(e: DragEvent) => this.handleColumnDragLeave(e, column.id)}
            @drop=${(e: DragEvent) => this.handleColumnDrop(e, column.id)}
          >
            ${repeat(
              allTasks,
              (task) => task.id,
              (task) => this.renderTask(task),
            )}
            ${
              this.dragOverColumn === column.id && this.draggingTaskId
                ? html`<div class="drag-placeholder" style="height: ${this.dragCardHeight}px"></div>`
                : nothing
            }
          </div>
          ${
            this.addingToColumn === column.id
              ? html`
                <div class="add-task-form">
                  <input
                    type="text"
                    class="add-task-input"
                    placeholder="Task title..."
                    .value=${this.newTaskTitle}
                    @input=${(e: InputEvent) => (this.newTaskTitle = (e.target as HTMLInputElement).value)}
                    @keydown=${this.handleAddTaskKeydown}
                  />
                  <div class="add-task-actions">
                    <button class="btn" @click=${this.cancelAddTask}>Cancel</button>
                    <button class="btn btn-primary" @click=${this.addTask}>Add</button>
                  </div>
                </div>
              `
              : html`
                <button class="add-task-btn" @click=${() => this.startAddTask(column.id)}>+ Add task</button>
              `
          }
        </div>
      </div>
    `;
  }

  private renderFilterBar() {
    const hasActiveFilters = !!(
      this.filter.project ||
      this.filter.tags?.length ||
      this.filter.priority
    );

    return html`
      <div class="filter-bar">
        <div class="filter-group">
          <span class="filter-label">Project:</span>
          <select 
            class="filter-select" 
            .value=${this.filter.project || "all"}
            @change=${(e: Event) => {
              const value = (e.target as HTMLSelectElement).value;
              this.updateFilter({ project: value === "all" ? undefined : value });
            }}
          >
            <option value="all">All Projects</option>
            ${this.projects.map(
              (project) => html`
              <option value="${project.id}" ?selected=${this.filter.project === project.id}>
                ${project.name}
              </option>
            `,
            )}
          </select>
        </div>

        <div class="filter-group">
          <span class="filter-label">Priority:</span>
          <select 
            class="filter-select" 
            .value=${this.filter.priority || "all"}
            @change=${(e: Event) => {
              const value = (e.target as HTMLSelectElement).value;
              this.updateFilter({
                priority: value === "all" ? undefined : (value as TaskPriority),
              });
            }}
          >
            <option value="all">All Priorities</option>
            <option value="high" ?selected=${this.filter.priority === "high"}>High</option>
            <option value="medium" ?selected=${this.filter.priority === "medium"}>Medium</option>
            <option value="low" ?selected=${this.filter.priority === "low"}>Low</option>
          </select>
        </div>

        ${
          hasActiveFilters
            ? html`
          <div class="active-filters">
            ${
              this.filter.project
                ? (() => {
                    const project = this.projects.find((p) => p.id === this.filter.project);
                    return project
                      ? html`
                <div class="filter-pill" @click=${() => this.updateFilter({ project: undefined })}>
                  <div class="project-dot" style="background: ${project.color}"></div>
                  ${project.name}
                  <div class="filter-pill-close">×</div>
                </div>
              `
                      : nothing;
                  })()
                : nothing
            }
            
            ${
              this.filter.priority
                ? html`
              <div class="filter-pill" @click=${() => this.updateFilter({ priority: undefined })}>
                ${this.filter.priority} priority
                <div class="filter-pill-close">×</div>
              </div>
            `
                : nothing
            }
            
            ${(this.filter.tags || []).map(
              (tag) => html`
              <div class="filter-pill" @click=${() => this.removeFilterTag(tag)}>
                #${tag}
                <div class="filter-pill-close">×</div>
              </div>
            `,
            )}
            
            <span class="clear-filters" @click=${this.clearFilter}>Clear all</span>
          </div>
        `
            : nothing
        }
      </div>
    `;
  }

  private renderDeleteModal() {
    if (!this.deleteConfirmId) return nothing;
    const task = this.tasks.find((t) => t.id === this.deleteConfirmId);
    if (!task) return nothing;

    return html`
      <div class="modal-overlay" @click=${this.cancelDelete}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-title">Delete task?</div>
          <div class="modal-body">
            Are you sure you want to delete "<strong>${task.title}</strong>"? This cannot be undone.
          </div>
          <div class="modal-actions">
            <button class="btn" @click=${this.cancelDelete}>Cancel</button>
            <button class="btn btn-danger" @click=${this.executeDelete}>Delete</button>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    if (this.loading) {
      return html`
        <div class="loading">
          <div class="spinner"></div>
          Loading tasks...
        </div>
      `;
    }

    return html`
      <div class="header">
        <div class="title">
          ${this.renderKanbanIcon()} Tasks
          <span class="title-count">(${this.getFilteredTasks().length}${this.getFilteredTasks().length !== this.tasks.length ? ` of ${this.tasks.length}` : ""})</span>
        </div>
        ${
          this.saving
            ? html`
                <div class="saving-indicator">
                  <div class="spinner"></div>
                  Saving...
                </div>
              `
            : nothing
        }
      </div>
      ${this.renderFilterBar()}
      <div class="board">${COLUMNS.map((col) => this.renderColumn(col))}</div>
      ${this.toastMessage ? html`<div class="toast ${this.toastType}">${this.toastMessage}</div>` : nothing}
      ${this.renderDeleteModal()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "kanban-view": KanbanView;
  }
}
