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

    .task-card {
      background: var(--card);
      border-radius: var(--radius-md);
      padding: 12px;
      cursor: grab;
      transition: all var(--duration-fast) var(--ease-out);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
    }

    .task-card:hover {
      border-color: var(--border-strong);
      box-shadow: var(--shadow-md);
    }

    .task-card.sortable-ghost {
      opacity: 0.4;
      background: var(--accent-subtle);
    }

    .task-card.sortable-chosen {
      cursor: grabbing;
      box-shadow: var(--shadow-lg);
      border-color: var(--accent);
    }

    .task-title {
      font-size: 14px;
      line-height: 1.4;
      word-break: break-word;
      color: var(--text);
    }

    .task-title-input {
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--accent);
      border-radius: var(--radius-sm);
      padding: 6px 8px;
      color: var(--text);
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
      transition: opacity var(--duration-fast);
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
      transition: opacity var(--duration-fast);
      color: var(--muted);
    }

    .task-action-btn:hover {
      opacity: 1;
      color: var(--text);
    }

    .task-action-btn.delete:hover {
      color: var(--danger);
    }

    .task-action-btn svg {
      width: 14px;
      height: 14px;
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

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--muted);
    }

    .empty-column {
      text-align: center;
      padding: 20px;
      color: var(--muted);
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
      // Delay sortable init to ensure DOM is ready
      setTimeout(() => this.initSortable(), 0);
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

    const columns = this.shadowRoot?.querySelectorAll(".task-list");
    columns?.forEach((col) => {
      const sortable = Sortable.create(col as HTMLElement, {
        group: "kanban-tasks",
        animation: 150,
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

    if (taskId && newStatus) {
      const taskIndex = this.tasks.findIndex((t) => t.id === taskId);
      if (taskIndex !== -1 && this.tasks[taskIndex].status !== newStatus) {
        const updatedTasks = [...this.tasks];
        updatedTasks[taskIndex] = moveTask(updatedTasks[taskIndex], newStatus);
        this.tasks = updatedTasks;
        this.saveData();
      }
    }
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
      updatedTasks[taskIndex] = {
        ...updatedTasks[taskIndex],
        title: newTitle.trim(),
        updatedAt: Date.now(),
      };
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
      this.editingTaskId = null;
    }
  }

  private handleDeleteTask(taskId: string, e: Event) {
    e.stopPropagation();
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
                @blur=${(e: FocusEvent) => this.saveTaskTitle(task.id, (e.target as HTMLInputElement).value)}
              />
            `
            : html`
              <div class="task-title">${task.title}</div>
              <div class="task-actions">
                <button
                  class="task-action-btn"
                  title="Edit"
                  @click=${(e: Event) => {
                    e.stopPropagation();
                    this.startEditTask(task.id);
                  }}
                >
                  ${this.renderEditIcon()}
                </button>
                <button
                  class="task-action-btn delete"
                  title="Delete"
                  @click=${(e: Event) => this.handleDeleteTask(task.id, e)}
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
      <div class="column" data-status=${column.id}>
        <div class="column-header">
          <div class="column-title">
            <div class="column-dot" style="background: ${column.color}"></div>
            ${column.title}
          </div>
          <div class="column-count">${columnTasks.length}</div>
        </div>
        <div class="column-body">
          <div class="task-list" data-status=${column.id}>
            ${columnTasks.map((task) => this.renderTask(task))}
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
