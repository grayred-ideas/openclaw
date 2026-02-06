import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import Sortable from "sortablejs";
import type { GatewayBrowserClient } from "../../gateway.js";
import {
  loadTasks,
  saveTasks,
  createTask,
  moveTask,
  deleteTask,
  COLUMNS,
  getTasksByStatus,
  type Task,
  type TaskStatus,
} from "./controller.js";

@customElement("kanban-view")
export class KanbanView extends LitElement {
  @property({ attribute: false })
  gateway: GatewayBrowserClient | null = null;

  @state()
  private tasks: Task[] = [];

  @state()
  private loading = true;

  @state()
  private editingTaskId: string | null = null;

  @state()
  private newTaskTitle = "";

  @state()
  private addingToColumn: TaskStatus | null = null;

  private sortableInstances: Sortable[] = [];

  static styles = css`
    :host {
      display: block;
      height: 100%;
      background: var(--bg-primary, #1a1a1a);
      color: var(--text-primary, #e0e0e0);
      padding: 16px;
      overflow: auto;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
    }

    .title {
      font-size: 20px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .title svg {
      width: 24px;
      height: 24px;
    }

    .board {
      display: flex;
      gap: 16px;
      height: calc(100% - 60px);
      min-height: 400px;
    }

    .column {
      flex: 1;
      min-width: 250px;
      max-width: 350px;
      background: var(--bg-secondary, #242424);
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .column-header {
      padding: 14px 16px;
      font-weight: 600;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-color, #333);
    }

    .column-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .column-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .column-count {
      background: var(--bg-tertiary, #333);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 500;
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
      min-height: 50px;
    }

    .task-card {
      background: var(--bg-tertiary, #2a2a2a);
      border-radius: 8px;
      padding: 12px;
      cursor: grab;
      transition: all 0.15s;
      border: 1px solid transparent;
    }

    .task-card:hover {
      border-color: var(--border-color, #444);
      transform: translateY(-1px);
    }

    .task-card.sortable-ghost {
      opacity: 0.4;
    }

    .task-card.sortable-chosen {
      cursor: grabbing;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    }

    .task-title {
      font-size: 14px;
      line-height: 1.4;
      word-break: break-word;
    }

    .task-title-input {
      width: 100%;
      background: var(--bg-primary, #1a1a1a);
      border: 1px solid var(--accent-color, #6366f1);
      border-radius: 4px;
      padding: 6px 8px;
      color: inherit;
      font-size: 14px;
      font-family: inherit;
      outline: none;
    }

    .task-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
      gap: 8px;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .task-card:hover .task-actions {
      opacity: 1;
    }

    .task-action-btn {
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      opacity: 0.5;
      transition: opacity 0.15s;
      color: inherit;
    }

    .task-action-btn:hover {
      opacity: 1;
    }

    .task-action-btn.delete:hover {
      color: #ef4444;
    }

    .task-action-btn svg {
      width: 14px;
      height: 14px;
    }

    .add-task-btn {
      width: 100%;
      padding: 10px;
      background: transparent;
      border: 2px dashed var(--border-color, #333);
      border-radius: 8px;
      color: var(--text-secondary, #888);
      cursor: pointer;
      font-size: 13px;
      transition: all 0.15s;
      margin-top: 8px;
    }

    .add-task-btn:hover {
      border-color: var(--accent-color, #6366f1);
      color: var(--accent-color, #6366f1);
    }

    .add-task-form {
      background: var(--bg-tertiary, #2a2a2a);
      border-radius: 8px;
      padding: 12px;
      margin-top: 8px;
    }

    .add-task-input {
      width: 100%;
      background: var(--bg-primary, #1a1a1a);
      border: 1px solid var(--border-color, #333);
      border-radius: 6px;
      padding: 10px 12px;
      color: inherit;
      font-size: 14px;
      font-family: inherit;
      outline: none;
      margin-bottom: 10px;
    }

    .add-task-input:focus {
      border-color: var(--accent-color, #6366f1);
    }

    .add-task-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
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

    .btn-secondary {
      background: var(--bg-tertiary, #333);
      color: var(--text-primary, #e0e0e0);
    }

    .btn-secondary:hover {
      background: var(--bg-hover, #3a3a3a);
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      opacity: 0.5;
    }

    .empty-column {
      text-align: center;
      padding: 20px;
      opacity: 0.4;
      font-size: 13px;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadData();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.destroySortable();
  }

  updated(changedProps: Map<string, unknown>) {
    super.updated(changedProps);
    if (changedProps.has("tasks") && !this.loading) {
      this.initSortable();
    }
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
    await saveTasks(this.gateway, this.tasks);
  }

  private destroySortable() {
    this.sortableInstances.forEach((s) => s.destroy());
    this.sortableInstances = [];
  }

  private initSortable() {
    this.destroySortable();

    requestAnimationFrame(() => {
      const columns = this.shadowRoot?.querySelectorAll(".task-list");
      columns?.forEach((col) => {
        const sortable = Sortable.create(col as HTMLElement, {
          group: "tasks",
          animation: 150,
          ghostClass: "sortable-ghost",
          chosenClass: "sortable-chosen",
          onEnd: (evt) => this.handleDragEnd(evt),
        });
        this.sortableInstances.push(sortable);
      });
    });
  }

  private handleDragEnd(evt: Sortable.SortableEvent) {
    const taskId = evt.item.dataset.taskId;
    const newStatus = evt.to.dataset.status as TaskStatus;

    if (taskId && newStatus) {
      const taskIndex = this.tasks.findIndex((t) => t.id === taskId);
      if (taskIndex !== -1) {
        this.tasks = [
          ...this.tasks.slice(0, taskIndex),
          moveTask(this.tasks[taskIndex], newStatus),
          ...this.tasks.slice(taskIndex + 1),
        ];
        this.saveData();
      }
    }
  }

  private startAddTask(status: TaskStatus) {
    this.addingToColumn = status;
    this.newTaskTitle = "";
    requestAnimationFrame(() => {
      const input = this.shadowRoot?.querySelector(".add-task-input") as HTMLInputElement;
      input?.focus();
    });
  }

  private cancelAddTask() {
    this.addingToColumn = null;
    this.newTaskTitle = "";
  }

  private addTask() {
    if (!this.newTaskTitle.trim() || !this.addingToColumn) return;

    const task = createTask(this.newTaskTitle.trim(), this.addingToColumn);
    this.tasks = [...this.tasks, task];
    this.saveData();
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
  }

  private saveTaskTitle(taskId: string, newTitle: string) {
    if (!newTitle.trim()) return;

    const taskIndex = this.tasks.findIndex((t) => t.id === taskId);
    if (taskIndex !== -1) {
      this.tasks = [
        ...this.tasks.slice(0, taskIndex),
        { ...this.tasks[taskIndex], title: newTitle.trim(), updatedAt: Date.now() },
        ...this.tasks.slice(taskIndex + 1),
      ];
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
      this.editingTaskId = null;
    }
  }

  private handleDeleteTask(taskId: string) {
    this.tasks = deleteTask(this.tasks, taskId);
    this.saveData();
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

  private renderTask(task: Task) {
    const isEditing = this.editingTaskId === task.id;

    return html`
      <div class="task-card" data-task-id=${task.id}>
        ${
          isEditing
            ? html`
              <input
                type="text"
                class="task-title-input"
                .value=${task.title}
                @keydown=${(e: KeyboardEvent) => this.handleEditKeydown(e, task.id)}
                @blur=${(e: FocusEvent) =>
                  this.saveTaskTitle(task.id, (e.target as HTMLInputElement).value)}
              />
            `
            : html`
              <div class="task-title">${task.title}</div>
              <div class="task-actions">
                <button
                  class="task-action-btn"
                  title="Edit"
                  @click=${() => this.startEditTask(task.id)}
                >
                  ${this.renderEditIcon()}
                </button>
                <button
                  class="task-action-btn delete"
                  title="Delete"
                  @click=${() => this.handleDeleteTask(task.id)}
                >
                  ${this.renderDeleteIcon()}
                </button>
              </div>
            `
        }
      </div>
    `;
  }

  private renderColumn(column: (typeof COLUMNS)[0]) {
    const columnTasks = getTasksByStatus(this.tasks, column.id);

    return html`
      <div class="column">
        <div class="column-header">
          <div class="column-title">
            <div class="column-dot" style="background: ${column.color}"></div>
            ${column.title}
          </div>
          <div class="column-count">${columnTasks.length}</div>
        </div>
        <div class="column-body">
          <div class="task-list" data-status=${column.id}>
            ${
              columnTasks.length === 0
                ? html`
                    <div class="empty-column">No tasks</div>
                  `
                : columnTasks.map((task) => this.renderTask(task))
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
                    @input=${(e: InputEvent) =>
                      (this.newTaskTitle = (e.target as HTMLInputElement).value)}
                    @keydown=${this.handleAddTaskKeydown}
                  />
                  <div class="add-task-actions">
                    <button class="btn btn-secondary" @click=${this.cancelAddTask}>Cancel</button>
                    <button class="btn btn-primary" @click=${this.addTask}>Add</button>
                  </div>
                </div>
              `
              : html`
                <button class="add-task-btn" @click=${() => this.startAddTask(column.id)}>
                  + Add task
                </button>
              `
          }
        </div>
      </div>
    `;
  }

  render() {
    if (this.loading) {
      return html`
        <div class="loading">Loading tasks...</div>
      `;
    }

    return html`
      <div class="header">
        <div class="title">${this.renderKanbanIcon()} Tasks</div>
      </div>
      <div class="board">${COLUMNS.map((col) => this.renderColumn(col))}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "kanban-view": KanbanView;
  }
}
