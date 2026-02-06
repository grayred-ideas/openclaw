/**
 * OpenClaw Shared Lit Components
 *
 * Reusable web components that implement the OC design system.
 * Import and use in any extension:
 *
 *   import '../shared/components.js';
 *   // then in templates:
 *   html`<oc-card><h3 slot="header">Title</h3><p>Body</p></oc-card>`
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ocTheme } from "./theme.js";

// ─── <oc-card> ───────────────────────────────────────────────────────────────
// Content card with header/body/footer slots.
//
// Usage:
//   <oc-card>
//     <span slot="header">Title</span>
//     <p>Body content</p>
//     <div slot="footer">Footer stuff</div>
//   </oc-card>
//
// Properties:
//   flat     — removes shadow (boolean)
//   padding  — "none" | "sm" | "md" (default) | "lg"

@customElement("oc-card")
export class OcCard extends LitElement {
  @property({ type: Boolean, reflect: true }) flat = false;
  @property({ type: String }) padding: "none" | "sm" | "md" | "lg" = "md";

  static styles = [
    ocTheme,
    css`
      :host {
        display: block;
      }

      .card {
        background: var(--card, var(--oc-white));
        border: 1px solid var(--border, var(--oc-gray-200));
        border-radius: var(--oc-radius-xl);
        box-shadow: var(--oc-shadow-sm);
        overflow: hidden;
        transition:
          border-color var(--oc-duration-fast) var(--oc-ease),
          box-shadow var(--oc-duration-fast) var(--oc-ease);
      }

      :host([flat]) .card {
        box-shadow: none;
      }

      .card:hover {
        border-color: var(--border-strong, var(--oc-gray-300));
      }

      :host(:not([flat])) .card:hover {
        box-shadow: var(--oc-shadow-md);
      }

      .body {
        padding: var(--oc-space-xl);
      }

      :host([padding="none"]) .body {
        padding: 0;
      }
      :host([padding="sm"]) .body {
        padding: var(--oc-space-md);
      }
      :host([padding="lg"]) .body {
        padding: var(--oc-space-2xl);
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--oc-space-md);
        padding: var(--oc-space-lg) var(--oc-space-xl);
        border-bottom: 1px solid var(--border, var(--oc-gray-200));
        font-weight: var(--oc-weight-semibold);
        font-size: var(--oc-text-md);
        color: var(--text-strong, var(--oc-gray-900));
      }

      :host([padding="none"]) .header {
        padding: var(--oc-space-md) var(--oc-space-lg);
      }
      :host([padding="sm"]) .header {
        padding: var(--oc-space-sm) var(--oc-space-md);
      }

      .footer {
        display: flex;
        align-items: center;
        gap: var(--oc-space-sm);
        padding: var(--oc-space-lg) var(--oc-space-xl);
        border-top: 1px solid var(--border, var(--oc-gray-200));
      }

      .header-slot-empty,
      .footer-slot-empty {
        display: none;
      }
    `,
  ];

  render() {
    return html`
      <div class="card">
        <div class="header">
          <slot name="header"></slot>
          <slot name="header-actions"></slot>
        </div>
        <div class="body">
          <slot></slot>
        </div>
        <div class="footer">
          <slot name="footer"></slot>
        </div>
      </div>
    `;
  }
}

// ─── <oc-button> ─────────────────────────────────────────────────────────────
// Button with variant support.
//
// Usage:
//   <oc-button variant="primary" full>Save Changes</oc-button>
//   <oc-button variant="ghost" size="sm">Cancel</oc-button>
//
// Properties:
//   variant  — "default" | "primary" | "secondary" | "ghost" | "danger"
//   size     — "sm" | "md" (default) | "lg"
//   full     — full-width (boolean)
//   disabled — (boolean)

@customElement("oc-button")
export class OcButton extends LitElement {
  @property({ type: String }) variant: "default" | "primary" | "secondary" | "ghost" | "danger" =
    "default";
  @property({ type: String }) size: "sm" | "md" | "lg" = "md";
  @property({ type: Boolean, reflect: true }) full = false;
  @property({ type: Boolean, reflect: true }) disabled = false;

  static styles = [
    ocTheme,
    css`
      :host {
        display: inline-flex;
      }

      :host([full]) {
        display: flex;
        width: 100%;
      }

      button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--oc-space-sm);
        border: 1px solid var(--border, var(--oc-gray-200));
        border-radius: var(--oc-radius-md);
        background: var(--bg-elevated, var(--oc-white));
        color: var(--text, var(--oc-gray-700));
        cursor: pointer;
        font-family: inherit;
        font-weight: var(--oc-weight-medium);
        letter-spacing: -0.01em;
        white-space: nowrap;
        transition:
          background var(--oc-duration-fast) var(--oc-ease),
          border-color var(--oc-duration-fast) var(--oc-ease),
          box-shadow var(--oc-duration-fast) var(--oc-ease),
          transform var(--oc-duration-fast) var(--oc-ease);
      }

      button:hover {
        background: var(--bg-hover, var(--oc-gray-100));
        border-color: var(--border-strong, var(--oc-gray-300));
      }

      button:active {
        transform: scale(0.98);
      }
      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        pointer-events: none;
      }

      ::slotted(svg),
      button ::slotted(svg) {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      /* Sizes */
      .size-sm {
        padding: 6px 12px;
        font-size: var(--oc-text-sm);
      }
      .size-md {
        padding: 10px 20px;
        font-size: var(--oc-text-base);
      }
      .size-lg {
        padding: 14px 28px;
        font-size: var(--oc-text-lg);
      }

      :host([full]) button {
        width: 100%;
      }

      /* Primary */
      .variant-primary {
        background: var(--oc-red);
        color: white;
        border-color: var(--oc-red);
        border-radius: var(--oc-radius-full);
        box-shadow: 0 1px 3px rgba(212, 56, 13, 0.3);
        font-weight: var(--oc-weight-semibold);
      }
      .variant-primary:hover {
        background: var(--oc-red-hover);
        border-color: var(--oc-red-hover);
        box-shadow: 0 4px 12px rgba(212, 56, 13, 0.25);
      }

      /* Secondary */
      .variant-secondary {
        background: var(--oc-gray-100);
        color: var(--oc-gray-700);
        border-color: var(--oc-gray-200);
        border-radius: var(--oc-radius-full);
      }
      .variant-secondary:hover {
        background: var(--oc-gray-200);
        border-color: var(--oc-gray-300);
      }

      /* Ghost */
      .variant-ghost {
        background: transparent;
        border-color: transparent;
        color: var(--muted, var(--oc-gray-500));
      }
      .variant-ghost:hover {
        background: var(--oc-gray-100);
        color: var(--text, var(--oc-gray-700));
        border-color: transparent;
      }

      /* Danger */
      .variant-danger {
        background: var(--oc-danger-light);
        color: var(--oc-danger);
        border-color: transparent;
        border-radius: var(--oc-radius-full);
      }
      .variant-danger:hover {
        background: var(--oc-danger);
        color: white;
      }
    `,
  ];

  render() {
    return html`
      <button
        class="variant-${this.variant} size-${this.size}"
        ?disabled=${this.disabled}
        @click=${(e: Event) => {
          if (this.disabled) e.stopPropagation();
        }}
      >
        <slot></slot>
      </button>
    `;
  }
}

// ─── <oc-empty-state> ────────────────────────────────────────────────────────
// Centered empty state with icon + title + message + optional CTA slot.
//
// Usage:
//   <oc-empty-state
//     icon="inbox"
//     title="Nothing here"
//     message="Add your first item to get started."
//   >
//     <oc-button slot="action" variant="primary">Add Item</oc-button>
//   </oc-empty-state>

@customElement("oc-empty-state")
export class OcEmptyState extends LitElement {
  @property({ type: String }) icon = "";
  @property({ type: String }) title = "";
  @property({ type: String }) message = "";

  static styles = [
    ocTheme,
    css`
      :host {
        display: block;
      }

      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--oc-space-4xl) var(--oc-space-xl);
        text-align: center;
      }

      .icon-container {
        width: 56px;
        height: 56px;
        border-radius: var(--oc-radius-xl);
        background: var(--oc-gray-100);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: var(--oc-space-lg);
        color: var(--oc-gray-400);
      }

      .icon-container ::slotted(svg),
      .icon-container svg {
        width: 28px;
        height: 28px;
      }

      .fallback-icon {
        font-size: 28px;
        line-height: 1;
      }

      .title {
        font-size: var(--oc-text-lg);
        font-weight: var(--oc-weight-semibold);
        color: var(--text-strong, var(--oc-gray-900));
        margin: 0 0 var(--oc-space-sm);
      }

      .message {
        font-size: var(--oc-text-base);
        color: var(--muted, var(--oc-gray-500));
        line-height: var(--oc-leading-normal);
        max-width: 320px;
        margin: 0 0 var(--oc-space-xl);
      }
    `,
  ];

  // Common icon map (simple SVG strings) for convenience
  private static ICON_MAP: Record<string, string> = {
    inbox:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    folder:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
    search:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>',
    check:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    dollar:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    kanban:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
  };

  private renderIcon() {
    const svgStr = OcEmptyState.ICON_MAP[this.icon];
    if (svgStr) {
      const el = document.createElement("div");
      el.innerHTML = svgStr;
      return html`${el.firstElementChild}`;
    }
    return html`
      <span class="fallback-icon">📭</span>
    `;
  }

  render() {
    return html`
      <div class="empty">
        <div class="icon-container">
          <slot name="icon">${this.icon ? this.renderIcon() : nothing}</slot>
        </div>
        ${this.title ? html`<h3 class="title">${this.title}</h3>` : nothing}
        ${this.message ? html`<p class="message">${this.message}</p>` : nothing}
        <slot name="action"></slot>
        <slot></slot>
      </div>
    `;
  }
}

// ─── <oc-tag> ────────────────────────────────────────────────────────────────
// Colored tag/pill.
//
// Usage:
//   <oc-tag color="red">Urgent</oc-tag>
//   <oc-tag color="gray" outline>Draft</oc-tag>

@customElement("oc-tag")
export class OcTag extends LitElement {
  @property({ type: String }) color: "red" | "orange" | "gray" | "green" | "blue" | "yellow" =
    "gray";
  @property({ type: Boolean }) outline = false;

  static styles = [
    ocTheme,
    css`
      :host {
        display: inline-flex;
      }

      .tag {
        display: inline-flex;
        align-items: center;
        gap: var(--oc-space-xs);
        padding: 3px 10px;
        border-radius: var(--oc-radius-full);
        font-size: var(--oc-text-xs);
        font-weight: var(--oc-weight-medium);
        line-height: 1.5;
        white-space: nowrap;
        border: 1px solid transparent;
      }

      .red {
        background: var(--oc-red-light);
        color: var(--oc-red);
      }
      .orange {
        background: var(--oc-orange-light);
        color: var(--oc-orange);
      }
      .gray {
        background: var(--oc-gray-100);
        color: var(--oc-gray-600);
      }
      .green {
        background: var(--oc-success-light);
        color: var(--oc-success);
      }
      .blue {
        background: var(--oc-info-light);
        color: var(--oc-info);
      }
      .yellow {
        background: var(--oc-warning-light);
        color: var(--oc-warning);
      }

      .outline {
        background: transparent;
        border-color: currentColor;
      }
    `,
  ];

  render() {
    return html`
      <span class="tag ${this.color} ${this.outline ? "outline" : ""}">
        <slot></slot>
      </span>
    `;
  }
}

// ─── <oc-header> ─────────────────────────────────────────────────────────────
// Page/section header with optional date display.
//
// Usage:
//   <oc-header title="Finance" subtitle="Dashboard">
//     <svg slot="icon">...</svg>
//     <div slot="actions"><oc-button>Export</oc-button></div>
//   </oc-header>
//
//   <oc-header date="2026-01-15" date-format="dd.mm.yyyy"></oc-header>

@customElement("oc-header")
export class OcHeader extends LitElement {
  @property({ type: String }) title = "";
  @property({ type: String }) subtitle = "";
  @property({ type: String }) date = "";
  @property({ type: String, attribute: "date-format" }) dateFormat:
    | "dd.mm.yyyy"
    | "iso"
    | "relative" = "dd.mm.yyyy";

  static styles = [
    ocTheme,
    css`
      :host {
        display: block;
        margin-bottom: var(--oc-space-2xl);
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--oc-space-md);
        flex-wrap: wrap;
      }

      .title-group {
        display: flex;
        align-items: center;
        gap: var(--oc-space-sm);
      }

      .title-group ::slotted(svg) {
        width: 24px;
        height: 24px;
        color: var(--muted, var(--oc-gray-400));
      }

      h1 {
        font-size: var(--oc-text-xl);
        font-weight: var(--oc-weight-bold);
        color: var(--text-strong, var(--oc-gray-900));
        margin: 0;
      }

      .subtitle {
        font-size: var(--oc-text-sm);
        color: var(--muted, var(--oc-gray-500));
        margin-left: var(--oc-space-sm);
      }

      .date {
        font-size: var(--oc-text-2xl);
        font-weight: var(--oc-weight-bold);
        color: var(--text-strong, var(--oc-gray-900));
        letter-spacing: -0.02em;
      }
    `,
  ];

  private formatDateStr(isoDate: string): string {
    if (!isoDate) return "";
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;

    if (this.dateFormat === "iso") return isoDate;
    if (this.dateFormat === "relative") {
      const diff = Date.now() - d.getTime();
      const days = Math.floor(diff / 86400000);
      if (days === 0) return "Today";
      if (days === 1) return "Yesterday";
      if (days < 7) return `${days} days ago`;
    }
    // dd.mm.yyyy
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  }

  render() {
    return html`
      <div class="header">
        <div class="title-group">
          <slot name="icon"></slot>
          ${
            this.date
              ? html`<span class="date">${this.formatDateStr(this.date)}</span>`
              : html`
                <h1>${this.title}</h1>
                ${this.subtitle ? html`<span class="subtitle">${this.subtitle}</span>` : nothing}
              `
          }
        </div>
        <slot name="actions"></slot>
      </div>
    `;
  }
}

// ─── Declarations ────────────────────────────────────────────────────────────

declare global {
  interface HTMLElementTagNameMap {
    "oc-card": OcCard;
    "oc-button": OcButton;
    "oc-empty-state": OcEmptyState;
    "oc-tag": OcTag;
    "oc-header": OcHeader;
  }
}
