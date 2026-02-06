import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import Sortable from "sortablejs";
import type { GatewayBrowserClient } from "../../gateway.js";
import {
  loadTasks,
  saveTasks,
  createTask,
  moveTask,
  deleteTask,
  updateTask,
  COLUMNS,
  PRIORITY_COLORS,
  getTasksByStatus,
  formatTimeAgo,
  calculateOrder,
  type Task,
  type TaskStatus,
  type TaskPriority,
} from "./controller.js";

@customElement("kanban-view")
export class KanbanView extends LitElement {
  @property({ attribute: false })
  gateway: GatewayBrowserClient | null = null;

  @state() private tasks: Task[] = [];
  @state() private loading = true;
  @state() private saving = false;
  @state() private editingTaskId: string | null = null;
  @state() private expandedTaskId: string | null = null;
  @state() private newTaskTitle = "";
  @state() private addingToColumn: TaskStatus | null = null;
  @state() private toastMessage: string | null = null;
  @state() private toastType: "error" | "success" = "error";
  @state() private deleteConfirmId: string | null = null;
  @state() private focusedTaskId: string | null = null;

  private sortableInstances: Sortable[] = [];
  private editCancelled = false;

  static styles = css`
    :host {
      display: block;
      height: 100%;
      background: var(--bg);
      color: var(--text);
      padding: 20px;
      overflow: auto;
      font-family: var(--font-body);
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
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

    .title-count {
      font-size: 14px;
      font-weight: 400;
      color: var(--muted);
    }

    .saving-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--muted);
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

    .board {
      display: flex;
      gap: 16px;
      height: calc(100% - 70px);
      min-height: 400px;
    }

    .column {
      flex: 1;
      min-width: 260px;
      max-width: 320px;
      background: var(--panel);
      border-radius: var(--radius-lg);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid var(--border);
    }

    .column-header {
      padding: 14px 16px;
      font-weight: 600;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      background: var(--panel-strong);
    }

    .column-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-strong);
    }

    .column-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .column-count {
      background: var(--bg-muted);
      padding: 2px 8px;
      border-radius: var(--radius-full);
      font-size: 12px;
      font-weight: 500;
      color: var(--muted);
    }

    .column-body {
      flex: 1;
      padding: 12px;
      overflow-y: auto;
      min-height: 100px;
    }

    .task-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 60px;
    }

    .empty-message {
      text-align: center;
      padding: 24px 16px;
      color: var(--muted);
      font-size: 13px;
      font-style: italic;
    }

    .task-card {
      background: var(--card);
      border-radius: var(--radius-md);
      padding: 0;
      transition: all var(--duration-fast) var(--ease-out);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
      outline: none;
    }

    .task-card:hover {
      border-color: var(--border-strong);
      box-shadow: var(--shadow-md);
    }

    .task-card:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px var(--accent-subtle);
    }

    .task-card.sortable-ghost {
      opacity: 0.4;
      background: var(--accent-subtle);
    }

    .task-card.sortable-chosen {
      box-shadow: var(--shadow-lg);
      border-color: var(--accent);
    }

    .task-main {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 12px;
    }

    .drag-handle {
      cursor: grab;
      color: var(--muted);
      opacity: 0.4;
      padding: 2px;
      flex-shrink: 0;
      transition: opacity var(--duration-fast);
    }

    .task-card:hover .drag-handle {
      opacity: 0.8;
    }

    .drag-handle:active {
      cursor: grabbing;
    }

    .drag-handle svg {
      width: 14px;
      height: 14px;
    }

    .task-content {
      flex: 1;
      min-width: 0;
    }

    .task-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .priority-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .task-title {
      font-size: 14px;
      line-height: 1.4;
      word-break: break-word;
      color: var(--text);
      flex: 1;
    }

    .task-title-input {
      width: 100%;
      box-sizing: border-box;
      background: var(--bg);
      border: 1px solid var(--accent);
      border-radius: var(--radius-sm);
      padding: 6px 8px;
      color: var(--text);
      font-size: 14px;
      font-family: inherit;
      outline: none;
    }

    .task-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 6px;
      font-size: 11px;
      color: var(--muted);
    }

    .task-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity var(--duration-fast);
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
      padding: 4px;
      cursor: pointer;
      opacity: 0.6;
      transition: opacity var(--duration-fast);
      color: var(--muted);
      border-radius: var(--radius-sm);
    }

    .task-action-btn:hover {
      opacity: 1;
      color: var(--text);
      background: var(--bg-hover);
    }

    .task-action-btn.delete:hover {
      color: var(--danger);
    }

    .task-action-btn svg {
      width: 14px;
      height: 14px;
    }

    .task-expanded {
      padding: 0 12px 12px 34px;
      border-top: 1px solid var(--border);
      margin-top: 0;
    }

    .task-description {
      margin-top: 8px;
    }

    .task-description-input {
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
      min-height: 60px;
    }

    .task-description-input:focus {
      border-color: var(--accent);
    }

    .task-description-text {
      font-size: 13px;
      color: var(--muted);
      white-space: pre-wrap;
      word-break: break-word;
    }

    .task-description-empty {
      font-size: 13px;
      color: var(--muted);
      font-style: italic;
      cursor: pointer;
    }

    .task-description-empty:hover {
      color: var(--text);
    }

    .priority-select {
      margin-top: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .priority-select label {
      font-size: 12px;
      color: var(--muted);
    }

    .priority-select select {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 4px 8px;
      color: var(--text);
      font-size: 12px;
      cursor: pointer;
    }

    .add-task-btn {
      width: 100%;
      padding: 10px;
      background: transparent;
      border: 2px dashed var(--border);
      border-radius: var(--radius-md);
      color: var(--muted);
      cursor: pointer;
      font-size: 13px;
      transition: all var(--duration-fast) var(--ease-out);
      margin-top: 8px;
    }

    .add-task-btn:hover {
      border-color: var(--accent);
      color: var(--accent);
      background: var(--accent-subtle);
    }

    .add-task-form {
      background: var(--card);
      border-radius: var(--radius-md);
      padding: 12px;
      margin-top: 8px;
      border: 1px solid var(--border);
    }

    .add-task-input {
      width: 100%;
      box-sizing: border-box;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      padding: 10px 12px;
      color: var(--text);
      font-size: 14px;
      font-family: inherit;
      outline: none;
      margin-bottom: 10px;
    }

    .add-task-input:focus {
      border-color: var(--accent);
    }

    .add-task-input::placeholder {
      color: var(--muted);
    }

    .add-task-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
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

    .btn-danger {
      background: var(--danger, #ef4444);
      color: white;
      border-color: var(--danger, #ef4444);
    }

    .btn-danger:hover {
      opacity: 0.9;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--muted);
      gap: 10px;
    }

    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: var(--radius-md);
      font-size: 14px;
      box-shadow: var(--shadow-lg);
      z-index: 1000;
      animation: toast-in 0.2s ease-out;
    }

    .toast.error {
      background: var(--danger, #ef4444);
      color: white;
    }

    .toast.success {
      background: var(--success, #22c55e);
      color: white;
    }

    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(10px);
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
      background: var(--panel);
      border-radius: var(--radius-lg);
      padding: 24px;
      max-width: 400px;
      width: 90%;
      box-shadow: var(--shadow-lg);
      border: 1px solid var(--border);
    }

    .modal-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-strong);
      margin-bottom: 12px;
    }

    .modal-body {
      font-size: 14px;
      color: var(--text);
      margin-bottom: 20px;
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    /* Responsive */
    @media (max-width: 900px) {
      .board {
        flex-wrap: wrap;
        height: auto;
      }

      .column {
        min-width: calc(50% - 8px);
        max-width: none;
        flex: 1 1 calc(50% - 8px);
      }
    }

    @media (max-width: 600px) {
      :host {
        padding: 12px;
      }

      .column {
        min-width: 100%;
        flex: 1 1 100%;
      }

      .board {
        gap: 12px;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadData();
    this.addEventListener("keydown", this.handleGlobalKeydown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.destroySortable();
    this.removeEventListener("keydown", this.handleGlobalKeydown);
  }

  updated(changedProps: Map<string, unknown>) {
    super.updated(changedProps);
    if (!this.loading && (changedProps.has("loading") || changedProps.has("tasks"))) {
      setTimeout(() => this.initSortable(), 0);
    }
  }

  private handleGlobalKeydown = (e: KeyboardEvent) => {
    if (this.deleteConfirmId || this.editingTaskId || this.addingToColumn) return;

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
          this.toggleExpanded(this.focusedTaskId);
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
    this.tasks = await loadTasks(this.gateway);
    this.loading = false;
  }

  private async saveData() {
    if (!this.gateway) return;
    this.saving = true;
    const success = await saveTasks(this.gateway, this.tasks);
    this.saving = false;
    if (!success) {
      this.showToast("Failed to save tasks", "error");
    }
  }

  private showToast(message: string, type: "error" | "success" = "error") {
    this.toastMessage = message;
    this.toastType = type;
    setTimeout(() => {
      this.toastMessage = null;
    }, 3000);
  }

  private destroySortable() {
    this.sortableInstances.forEach((s) => s.destroy());
    this.sortableInstances = [];
  }

  private initSortable() {
    this.destroySortable();

    const columns = this.shadowRoot?.querySelectorAll(".task-list");
    columns?.forEach((col) => {
      const sortable = Sortable.create(col as HTMLElement, {
        group: "kanban-tasks",
        animation: 150,
        handle: ".drag-handle",
        ghostClass: "sortable-ghost",
        chosenClass: "sortable-chosen",
        dragClass: "sortable-drag",
        onEnd: (evt) => this.handleDragEnd(evt),
      });
      this.sortableInstances.push(sortable);
    });
  }

  private handleDragEnd(evt: Sortable.SortableEvent) {
    const taskId = evt.item.dataset.taskId;
    const toEl = evt.to as HTMLElement;
    const newStatus = toEl.dataset.status as TaskStatus;
    const newIndex = evt.newIndex ?? 0;

    if (!taskId) return;

    const taskIndex = this.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex === -1) return;

    const task = this.tasks[taskIndex];
    const targetColumnTasks = getTasksByStatus(this.tasks, newStatus).filter(
      (t) => t.id !== taskId,
    );
    const newOrder = calculateOrder(targetColumnTasks, newIndex);

    // Check if anything changed
    const statusChanged = task.status !== newStatus;
    const orderChanged = evt.oldIndex !== newIndex;

    if (statusChanged || orderChanged) {
      // Destroy Sortable BEFORE state update to prevent conflicts
      this.destroySortable();

      const updatedTasks = [...this.tasks];
      updatedTasks[taskIndex] = moveTask(task, newStatus, newOrder);
      this.tasks = updatedTasks;
      this.saveData();
    }
  }

  private toggleExpanded(taskId: string) {
    this.expandedTaskId = this.expandedTaskId === taskId ? null : taskId;
  }

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
    this.expandedTaskId = null;
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
      const updatedTasks = [...this.tasks];
      updatedTasks[taskIndex] = updateTask(updatedTasks[taskIndex], {
        description: description.trim() || undefined,
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

  private renderExpandIcon() {
    return html`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;
  }

  private renderTask(task: Task) {
    const isEditing = this.editingTaskId === task.id;
    const isExpanded = this.expandedTaskId === task.id;
    const priorityColor = task.priority ? PRIORITY_COLORS[task.priority] : null;

    return html`
      <div
        class="task-card"
        data-task-id=${task.id}
        tabindex="0"
        @focus=${() => (this.focusedTaskId = task.id)}
        @dblclick=${() => this.toggleExpanded(task.id)}
      >
        <div class="task-main">
          <div class="drag-handle">${this.renderGripIcon()}</div>
          <div class="task-content">
            ${
              isEditing
                ? html`
                  <input
                    type="text"
                    class="task-title-input"
                    .value=${task.title}
                    @keydown=${(e: KeyboardEvent) => this.handleEditKeydown(e, task.id)}
                    @blur=${(e: FocusEvent) => this.handleEditBlur(e, task.id)}
                  />
                `
                : html`
                  <div class="task-header">
                    ${
                      priorityColor
                        ? html`<div class="priority-dot" style="background: ${priorityColor}"></div>`
                        : nothing
                    }
                    <div class="task-title">${task.title}</div>
                  </div>
                  <div class="task-meta">
                    <span>${formatTimeAgo(task.createdAt)}</span>
                    ${
                      task.description
                        ? html`
                            <span>· Has notes</span>
                          `
                        : nothing
                    }
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
                    title="Expand"
                    @click=${(e: Event) => {
                      e.stopPropagation();
                      this.toggleExpanded(task.id);
                    }}
                  >
                    ${this.renderExpandIcon()}
                  </button>
                  <button
                    class="task-action-btn"
                    title="Edit (e)"
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
        ${
          isExpanded
            ? html`
              <div class="task-expanded">
                <div class="task-description">
                  <textarea
                    class="task-description-input"
                    placeholder="Add description..."
                    .value=${task.description || ""}
                    @blur=${(e: FocusEvent) =>
                      this.updateDescription(task.id, (e.target as HTMLTextAreaElement).value)}
                  ></textarea>
                </div>
                <div class="priority-select">
                  <label>Priority:</label>
                  <select
                    .value=${task.priority || ""}
                    @change=${(e: Event) =>
                      this.updatePriority(
                        task.id,
                        (e.target as HTMLSelectElement).value as TaskPriority | "",
                      )}
                  >
                    <option value="">None</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
            `
            : nothing
        }
      </div>
    `;
  }

  private renderColumn(column: (typeof COLUMNS)[0]) {
    const columnTasks = getTasksByStatus(this.tasks, column.id);

    return html`
      <div class="column" data-status=${column.id}>
        <div class="column-header">
          <div class="column-title">
            <div class="column-dot" style="background: ${column.color}"></div>
            ${column.title}
          </div>
          <div class="column-count">${columnTasks.length}</div>
        </div>
        <div class="column-body">
          ${
            columnTasks.length === 0
              ? html`
                  <div class="empty-message">No tasks</div>
                `
              : nothing
          }
          <div class="task-list" data-status=${column.id}>
            ${repeat(
              columnTasks,
              (task) => task.id,
              (task) => this.renderTask(task),
            )}
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
          <span class="title-count">(${this.tasks.length})</span>
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
