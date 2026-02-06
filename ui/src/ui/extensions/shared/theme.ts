/**
 * OpenClaw Design System — Shared Theme
 *
 * Clean, minimal design language inspired by shadcn/ui with HSL color tokens,
 * subtle borders, and modern form styling. Uses CSS custom properties for theming
 * with consistent radius, spacing, and typography.
 *
 * Usage in any Lit component:
 *   import { ocTheme, ocBaseFormStyles, ocCardStyles, ... } from '../shared/theme.js';
 *   static styles = [ocTheme, ocBaseFormStyles, css`/* component-specific */`];
 */

import { css } from "lit";

// ─── Core Design Tokens (shadcn/ui-inspired) ────────────────────────────────
// Clean HSL-based color system with semantic naming conventions.
// Apply ocTheme to :host to inject these into any component's shadow DOM.

export const ocTheme = css`
  :host {
    /* ── shadcn/ui Color System ── */
    --background: hsl(0 0% 100%);
    --foreground: hsl(224 71.4% 4.1%);
    --card: hsl(0 0% 100%);
    --card-foreground: hsl(224 71.4% 4.1%);
    --popover: hsl(0 0% 100%);
    --popover-foreground: hsl(224 71.4% 4.1%);
    
    --primary: hsl(221.2 83.2% 53.3%);
    --primary-foreground: hsl(210 40% 98%);
    --secondary: hsl(210 40% 96%);
    --secondary-foreground: hsl(222.2 84% 4.9%);
    
    --muted: hsl(210 40% 96%);
    --muted-foreground: hsl(215.4 16.3% 46.9%);
    --accent: hsl(210 40% 96%);
    --accent-foreground: hsl(222.2 84% 4.9%);
    
    --destructive: hsl(0 84.2% 60.2%);
    --destructive-foreground: hsl(210 40% 98%);
    
    --border: hsl(214.3 31.8% 91.4%);
    --input: hsl(214.3 31.8% 91.4%);
    --ring: hsl(221.2 83.2% 53.3%);
    
    /* ── Radius System ── */
    --radius: 0.5rem;
    --radius-sm: 0.375rem;
    --radius-md: 0.5rem;
    --radius-lg: 0.75rem;
    --radius-xl: 1rem;
    --radius-full: 9999px;

    /* ── Legacy Compatibility (warm palette) ── */
    --oc-red: hsl(0 84.2% 60.2%);
    --oc-red-hover: hsl(0 84.2% 55%);
    --oc-red-light: hsl(0 93% 94%);
    --oc-red-subtle: hsla(0, 84.2%, 60.2%, 0.08);
    --oc-orange: hsl(20 84% 60%);
    --oc-orange-light: hsl(20 93% 94%);
    --oc-orange-subtle: hsla(20, 84%, 60%, 0.08);

    /* ── Clean Neutral Scale ── */
    --oc-white: hsl(0 0% 100%);
    --oc-gray-50: hsl(210 40% 98%);
    --oc-gray-100: hsl(210 40% 96%);
    --oc-gray-200: hsl(214.3 31.8% 91.4%);
    --oc-gray-300: hsl(213 27% 84%);
    --oc-gray-400: hsl(215 16% 65%);
    --oc-gray-500: hsl(215.4 16.3% 46.9%);
    --oc-gray-600: hsl(215 19% 35%);
    --oc-gray-700: hsl(215 25% 27%);
    --oc-gray-800: hsl(217 33% 17%);
    --oc-gray-900: hsl(224 71.4% 4.1%);

    /* ── Semantic Colors ── */
    --oc-success: hsl(142 76% 36%);
    --oc-success-light: hsl(138 76% 97%);
    --oc-warning: hsl(48 96% 53%);
    --oc-warning-light: hsl(48 100% 96%);
    --oc-danger: hsl(0 84.2% 60.2%);
    --oc-danger-light: hsl(0 93% 94%);
    --oc-info: hsl(221.2 83.2% 53.3%);
    --oc-info-light: hsl(214 95% 93%);

    /* ── Spacing Scale ── */
    --oc-space-xs: 0.25rem;
    --oc-space-sm: 0.5rem;
    --oc-space-md: 0.75rem;
    --oc-space-lg: 1rem;
    --oc-space-xl: 1.25rem;
    --oc-space-2xl: 1.5rem;
    --oc-space-3xl: 2rem;
    --oc-space-4xl: 3rem;

    /* ── Typography (Inter-first system stack) ── */
    --oc-font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      "Helvetica Neue", Arial, sans-serif;
    --oc-font-mono: ui-monospace, "SF Mono", "Fira Code", "Fira Mono", Menlo, monospace;

    --oc-text-xs: 0.75rem;
    --oc-text-sm: 0.875rem;
    --oc-text-base: 1rem;
    --oc-text-md: 1.125rem;
    --oc-text-lg: 1.25rem;
    --oc-text-xl: 1.5rem;
    --oc-text-2xl: 2rem;
    --oc-text-3xl: 2.5rem;

    --oc-leading-tight: 1.25;
    --oc-leading-normal: 1.5;
    --oc-leading-relaxed: 1.625;

    --oc-weight-normal: 400;
    --oc-weight-medium: 500;
    --oc-weight-semibold: 600;
    --oc-weight-bold: 700;

    /* ── Subtle Shadows (layered, not heavy) ── */
    --oc-shadow-xs: 0 1px 2px hsla(0, 0%, 0%, 0.05);
    --oc-shadow-sm: 0 1px 3px hsla(0, 0%, 0%, 0.1), 0 1px 2px hsla(0, 0%, 0%, 0.06);
    --oc-shadow-md: 0 4px 6px hsla(0, 0%, 0%, 0.07), 0 2px 4px hsla(0, 0%, 0%, 0.06);
    --oc-shadow-lg: 0 10px 15px hsla(0, 0%, 0%, 0.1), 0 4px 6px hsla(0, 0%, 0%, 0.05);
    --oc-shadow-xl: 0 20px 25px hsla(0, 0%, 0%, 0.1), 0 8px 10px hsla(0, 0%, 0%, 0.04);

    /* ── Smooth Transitions ── */
    --oc-duration-fast: 150ms;
    --oc-duration-normal: 200ms;
    --oc-duration-slow: 300ms;
    --oc-ease: cubic-bezier(0.4, 0, 0.2, 1);
    --oc-ease-in: cubic-bezier(0.4, 0, 1, 1);
    --oc-ease-out: cubic-bezier(0, 0, 0.2, 1);

    /* ── Focus Ring System ── */
    --focus-ring: 0 0 0 2px hsla(221.2, 83.2%, 53.3%, 0.2);
    --focus-ring-offset: 2px;
  }
`;

// ─── Base Form Styles (Global Native Element Styling) ───────────────────────
// Apply this to make ALL native form elements look modern and consistent.
// Import this in every component that uses forms.

export const ocBaseFormStyles = css`
  /* ── Native Select Styling ── */
  select {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background: var(--card, var(--oc-white));
    border: 1px solid var(--border, var(--oc-gray-200));
    border-radius: var(--radius, 0.5rem);
    padding: 0.5rem 2.25rem 0.5rem 0.75rem;
    color: var(--foreground, var(--oc-gray-900));
    font-size: var(--oc-text-sm);
    font-family: var(--oc-font-sans);
    line-height: 1.5;
    height: 2.25rem;
    min-width: 120px;
    cursor: pointer;
    outline: none;
    transition:
      border-color var(--oc-duration-fast) var(--oc-ease),
      box-shadow var(--oc-duration-fast) var(--oc-ease);
    /* Custom chevron icon */
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    background-size: 1rem;
  }

  select:hover {
    border-color: var(--oc-gray-300);
  }

  select:focus {
    border-color: var(--ring, var(--primary));
    box-shadow: var(--focus-ring, 0 0 0 2px hsla(221.2, 83.2%, 53.3%, 0.2));
  }

  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--muted, var(--oc-gray-100));
  }

  /* ── Native Input Styling ── */
  input[type="text"],
  input[type="email"], 
  input[type="password"],
  input[type="number"],
  input[type="search"],
  input[type="url"] {
    background: var(--card, var(--oc-white));
    border: 1px solid var(--border, var(--oc-gray-200));
    border-radius: var(--radius, 0.5rem);
    padding: 0.5rem 0.75rem;
    color: var(--foreground, var(--oc-gray-900));
    font-size: var(--oc-text-sm);
    font-family: var(--oc-font-sans);
    line-height: 1.5;
    height: 2.25rem;
    outline: none;
    transition:
      border-color var(--oc-duration-fast) var(--oc-ease),
      box-shadow var(--oc-duration-fast) var(--oc-ease);
  }

  input[type="text"]:hover,
  input[type="email"]:hover,
  input[type="password"]:hover,
  input[type="number"]:hover,
  input[type="search"]:hover,
  input[type="url"]:hover {
    border-color: var(--oc-gray-300);
  }

  input[type="text"]:focus,
  input[type="email"]:focus,
  input[type="password"]:focus,
  input[type="number"]:focus,
  input[type="search"]:focus,
  input[type="url"]:focus {
    border-color: var(--ring, var(--primary));
    box-shadow: var(--focus-ring, 0 0 0 2px hsla(221.2, 83.2%, 53.3%, 0.2));
  }

  input::placeholder {
    color: var(--muted-foreground, var(--oc-gray-500));
  }

  input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--muted, var(--oc-gray-100));
  }

  /* ── Native Textarea Styling ── */
  textarea {
    background: var(--card, var(--oc-white));
    border: 1px solid var(--border, var(--oc-gray-200));
    border-radius: var(--radius, 0.5rem);
    padding: 0.5rem 0.75rem;
    color: var(--foreground, var(--oc-gray-900));
    font-size: var(--oc-text-sm);
    font-family: var(--oc-font-sans);
    line-height: 1.5;
    min-height: 5rem;
    outline: none;
    resize: vertical;
    transition:
      border-color var(--oc-duration-fast) var(--oc-ease),
      box-shadow var(--oc-duration-fast) var(--oc-ease);
  }

  textarea:hover {
    border-color: var(--oc-gray-300);
  }

  textarea:focus {
    border-color: var(--ring, var(--primary));
    box-shadow: var(--focus-ring, 0 0 0 2px hsla(221.2, 83.2%, 53.3%, 0.2));
  }

  textarea::placeholder {
    color: var(--muted-foreground, var(--oc-gray-500));
  }

  textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--muted, var(--oc-gray-100));
  }

  /* ── Native Button Styling ── */
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--oc-space-sm);
    padding: 0.5rem 1rem;
    border: 1px solid var(--border, var(--oc-gray-200));
    border-radius: var(--radius, 0.5rem);
    background: var(--secondary, var(--oc-gray-100));
    color: var(--secondary-foreground, var(--oc-gray-900));
    font-size: var(--oc-text-sm);
    font-weight: var(--oc-weight-medium);
    font-family: var(--oc-font-sans);
    line-height: 1.5;
    height: 2.25rem;
    cursor: pointer;
    outline: none;
    transition:
      background-color var(--oc-duration-fast) var(--oc-ease),
      border-color var(--oc-duration-fast) var(--oc-ease),
      box-shadow var(--oc-duration-fast) var(--oc-ease);
    white-space: nowrap;
  }

  button:hover:not(:disabled) {
    background: var(--accent, var(--oc-gray-200));
    border-color: var(--oc-gray-300);
  }

  button:focus {
    box-shadow: var(--focus-ring, 0 0 0 2px hsla(221.2, 83.2%, 53.3%, 0.2));
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  /* ── Button Variants ── */
  button.btn-primary {
    background: var(--primary, var(--oc-info));
    color: var(--primary-foreground, var(--oc-white));
    border-color: var(--primary, var(--oc-info));
    box-shadow: 0 1px 2px hsla(0, 0%, 0%, 0.05);
  }

  button.btn-primary:hover:not(:disabled) {
    background: hsl(221.2 83.2% 48%);
    border-color: hsl(221.2 83.2% 48%);
    box-shadow: var(--oc-shadow-sm);
  }

  button.btn-secondary {
    background: var(--secondary, var(--oc-gray-100));
    color: var(--secondary-foreground, var(--oc-gray-900));
    border-color: var(--border, var(--oc-gray-200));
  }

  button.btn-ghost {
    background: transparent;
    border-color: transparent;
    color: var(--muted-foreground, var(--oc-gray-600));
  }

  button.btn-ghost:hover:not(:disabled) {
    background: var(--accent, var(--oc-gray-100));
    color: var(--accent-foreground, var(--oc-gray-900));
  }

  button.btn-destructive {
    background: var(--destructive, var(--oc-danger));
    color: var(--destructive-foreground, var(--oc-white));
    border-color: var(--destructive, var(--oc-danger));
  }

  button.btn-destructive:hover:not(:disabled) {
    background: hsl(0 84.2% 55%);
    border-color: hsl(0 84.2% 55%);
  }

  /* ── Button Sizes ── */
  button.btn-sm {
    padding: 0.375rem 0.75rem;
    font-size: var(--oc-text-xs);
    height: 2rem;
  }

  button.btn-lg {
    padding: 0.75rem 1.5rem;
    font-size: var(--oc-text-base);
    height: 2.75rem;
  }

  /* ── Form Groups ── */
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin-bottom: var(--oc-space-lg);
  }

  .form-label {
    font-size: var(--oc-text-sm);
    font-weight: var(--oc-weight-medium);
    color: var(--foreground, var(--oc-gray-900));
    margin-bottom: 0.25rem;
  }

  .form-error {
    font-size: var(--oc-text-xs);
    color: var(--destructive, var(--oc-danger));
    margin-top: 0.25rem;
  }
`;

// ─── Card Styles ─────────────────────────────────────────────────────────────

export const ocCardStyles = css`
  .oc-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--oc-space-lg);
    box-shadow: var(--oc-shadow-sm);
    transition:
      border-color var(--oc-duration-fast) var(--oc-ease),
      box-shadow var(--oc-duration-fast) var(--oc-ease);
  }

  .oc-card:hover {
    border-color: var(--oc-gray-300);
    box-shadow: var(--oc-shadow-md);
  }

  .oc-card--flat {
    box-shadow: none;
  }

  .oc-card--flat:hover {
    box-shadow: var(--oc-shadow-sm);
  }

  .oc-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--oc-space-md);
    margin-bottom: var(--oc-space-lg);
  }

  .oc-card__title {
    font-size: var(--oc-text-md);
    font-weight: var(--oc-weight-semibold);
    color: var(--card-foreground);
    margin: 0;
  }

  .oc-card__body {
    font-size: var(--oc-text-sm);
    line-height: var(--oc-leading-normal);
    color: var(--muted-foreground);
  }

  .oc-card__footer {
    display: flex;
    align-items: center;
    gap: var(--oc-space-sm);
    margin-top: var(--oc-space-lg);
    padding-top: var(--oc-space-lg);
    border-top: 1px solid var(--border);
  }

  /* Section card variant — clean shadcn-style */
  .oc-section-card {
    display: flex;
    align-items: flex-start;
    gap: var(--oc-space-lg);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: var(--oc-space-lg);
    box-shadow: var(--oc-shadow-sm);
  }

  .oc-section-card__icon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--muted);
    color: var(--muted-foreground);
  }

  .oc-section-card__content {
    flex: 1;
    min-width: 0;
  }

  .oc-section-card__title {
    font-size: var(--oc-text-md);
    font-weight: var(--oc-weight-semibold);
    color: var(--card-foreground);
    margin: 0 0 var(--oc-space-xs);
  }

  .oc-section-card__desc {
    font-size: var(--oc-text-sm);
    color: var(--muted-foreground);
    line-height: var(--oc-leading-normal);
    margin: 0;
  }
`;

// ─── Button Styles ───────────────────────────────────────────────────────────

export const ocButtonStyles = css`
  .oc-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--oc-space-sm);
    padding: 0.5rem 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--secondary);
    color: var(--secondary-foreground);
    cursor: pointer;
    font-size: var(--oc-text-sm);
    font-weight: var(--oc-weight-medium);
    font-family: var(--oc-font-sans);
    line-height: 1.5;
    height: 2.25rem;
    letter-spacing: -0.01em;
    transition:
      background-color var(--oc-duration-fast) var(--oc-ease),
      border-color var(--oc-duration-fast) var(--oc-ease),
      box-shadow var(--oc-duration-fast) var(--oc-ease);
    white-space: nowrap;
  }

  .oc-btn:hover:not(:disabled) {
    background: var(--accent);
    border-color: var(--oc-gray-300);
  }

  .oc-btn:focus {
    box-shadow: var(--focus-ring);
  }

  .oc-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }

  .oc-btn svg {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  /* Primary — clean blue accent */
  .oc-btn--primary {
    background: var(--primary);
    color: var(--primary-foreground);
    border-color: var(--primary);
    box-shadow: 0 1px 2px hsla(0, 0%, 0%, 0.05);
  }

  .oc-btn--primary:hover:not(:disabled) {
    background: hsl(221.2 83.2% 48%);
    border-color: hsl(221.2 83.2% 48%);
    box-shadow: var(--oc-shadow-sm);
  }

  /* Secondary — subtle background */
  .oc-btn--secondary {
    background: var(--secondary);
    color: var(--secondary-foreground);
    border-color: var(--border);
  }

  .oc-btn--secondary:hover:not(:disabled) {
    background: var(--accent);
    border-color: var(--oc-gray-300);
  }

  /* Ghost — transparent */
  .oc-btn--ghost {
    background: transparent;
    border-color: transparent;
    color: var(--muted-foreground);
  }

  .oc-btn--ghost:hover:not(:disabled) {
    background: var(--accent);
    color: var(--accent-foreground);
  }

  /* Destructive — clean red */
  .oc-btn--destructive {
    background: var(--destructive);
    color: var(--destructive-foreground);
    border-color: var(--destructive);
  }

  .oc-btn--destructive:hover:not(:disabled) {
    background: hsl(0 84.2% 55%);
    border-color: hsl(0 84.2% 55%);
  }

  /* Sizes */
  .oc-btn--sm {
    padding: 0.375rem 0.75rem;
    font-size: var(--oc-text-xs);
    height: 2rem;
  }

  .oc-btn--lg {
    padding: 0.75rem 1.5rem;
    font-size: var(--oc-text-base);
    height: 2.75rem;
  }

  .oc-btn--full {
    width: 100%;
  }

  .oc-btn--icon {
    padding: 0.5rem;
    width: 2.25rem;
    height: 2.25rem;
  }

  .oc-btn--icon.oc-btn--sm {
    padding: 0.375rem;
    width: 2rem;
    height: 2rem;
  }
`;

// ─── Input Styles ────────────────────────────────────────────────────────────

export const ocInputStyles = css`
  .oc-input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.75rem;
    background: var(--card);
    border: 1px solid var(--input);
    border-radius: var(--radius);
    color: var(--foreground);
    font-size: var(--oc-text-sm);
    font-family: var(--oc-font-sans);
    line-height: 1.5;
    height: 2.25rem;
    outline: none;
    transition:
      border-color var(--oc-duration-fast) var(--oc-ease),
      box-shadow var(--oc-duration-fast) var(--oc-ease);
  }

  .oc-input:hover {
    border-color: var(--oc-gray-300);
  }

  .oc-input:focus {
    border-color: var(--ring);
    box-shadow: var(--focus-ring);
  }

  .oc-input::placeholder {
    color: var(--muted-foreground);
  }

  .oc-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: var(--muted);
  }

  .oc-input--search {
    padding-left: 2.25rem;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.3-4.3'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: 0.75rem center;
    background-size: 1rem;
  }

  .oc-textarea {
    min-height: 5rem;
    resize: vertical;
  }

  .oc-select {
    appearance: none;
    -webkit-appearance: none;
    padding-right: 2.25rem;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    background-size: 1rem;
    cursor: pointer;
  }

  .oc-form-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin-bottom: var(--oc-space-lg);
  }

  .oc-label {
    font-size: var(--oc-text-sm);
    font-weight: var(--oc-weight-medium);
    color: var(--foreground);
    margin-bottom: 0.25rem;
  }
`;

// ─── Tag / Pill Styles ───────────────────────────────────────────────────────

export const ocTagStyles = css`
  .oc-tag {
    display: inline-flex;
    align-items: center;
    gap: var(--oc-space-xs);
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: var(--oc-weight-medium);
    line-height: 1.25;
    white-space: nowrap;
    border: 1px solid transparent;
  }

  .oc-tag--default {
    background: var(--secondary);
    color: var(--secondary-foreground);
  }

  .oc-tag--red {
    background: hsl(0 93% 94%);
    color: hsl(0 84% 45%);
  }

  .oc-tag--orange {
    background: hsl(20 90% 95%);
    color: hsl(20 84% 45%);
  }

  .oc-tag--gray {
    background: var(--muted);
    color: var(--muted-foreground);
  }

  .oc-tag--green {
    background: hsl(138 76% 97%);
    color: hsl(142 76% 30%);
  }

  .oc-tag--blue {
    background: hsl(214 95% 93%);
    color: hsl(221 83% 45%);
  }

  .oc-tag--yellow {
    background: hsl(48 100% 96%);
    color: hsl(48 96% 35%);
  }

  .oc-tag--destructive {
    background: var(--destructive);
    color: var(--destructive-foreground);
  }

  /* Outline variant */
  .oc-tag--outline {
    background: transparent;
    border-color: var(--border);
    color: var(--foreground);
  }

  /* Clickable badge variant */
  .oc-tag--clickable {
    cursor: pointer;
    transition: background-color var(--oc-duration-fast) var(--oc-ease);
  }

  .oc-tag--clickable:hover {
    background: var(--accent);
  }
`;

// ─── Header / Date Styles ────────────────────────────────────────────────────

export const ocHeaderStyles = css`
  .oc-page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--oc-space-md);
    margin-bottom: var(--oc-space-2xl);
    flex-wrap: wrap;
  }

  .oc-page-title {
    font-size: var(--oc-text-xl);
    font-weight: var(--oc-weight-bold);
    color: var(--text-strong, var(--oc-gray-900));
    display: flex;
    align-items: center;
    gap: var(--oc-space-sm);
    margin: 0;
  }

  .oc-page-title svg {
    width: 24px;
    height: 24px;
    color: var(--muted, var(--oc-gray-400));
  }

  .oc-page-subtitle {
    font-size: var(--oc-text-sm);
    color: var(--muted, var(--oc-gray-500));
    font-weight: var(--oc-weight-normal);
  }

  /* Prominent date header — like "15.01.2026" */
  .oc-date-header {
    font-size: var(--oc-text-2xl);
    font-weight: var(--oc-weight-bold);
    color: var(--text-strong, var(--oc-gray-900));
    letter-spacing: -0.02em;
    margin: 0;
  }

  .oc-date-header--sm {
    font-size: var(--oc-text-lg);
  }

  .oc-section-header {
    font-size: var(--oc-text-sm);
    font-weight: var(--oc-weight-semibold);
    color: var(--muted, var(--oc-gray-500));
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin: 0 0 var(--oc-space-md);
    padding-bottom: var(--oc-space-sm);
    border-bottom: 1px solid var(--border, var(--oc-gray-200));
  }
`;

// ─── Empty State Styles ──────────────────────────────────────────────────────

export const ocEmptyStateStyles = css`
  .oc-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--oc-space-4xl) var(--oc-space-xl);
    text-align: center;
  }

  .oc-empty__icon {
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

  .oc-empty__icon svg {
    width: 28px;
    height: 28px;
  }

  .oc-empty__title {
    font-size: var(--oc-text-lg);
    font-weight: var(--oc-weight-semibold);
    color: var(--text-strong, var(--oc-gray-900));
    margin: 0 0 var(--oc-space-sm);
  }

  .oc-empty__message {
    font-size: var(--oc-text-base);
    color: var(--muted, var(--oc-gray-500));
    line-height: var(--oc-leading-normal);
    max-width: 320px;
    margin: 0 0 var(--oc-space-xl);
  }
`;

// ─── Modal Styles ────────────────────────────────────────────────────────────

export const ocModalStyles = css`
  .oc-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: oc-fade-in var(--oc-duration-fast) var(--oc-ease);
  }

  .oc-modal {
    background: var(--card, var(--oc-white));
    border: 1px solid var(--border, var(--oc-gray-200));
    border-radius: var(--oc-radius-xl);
    padding: var(--oc-space-2xl);
    max-width: 480px;
    width: 90%;
    box-shadow: var(--oc-shadow-xl);
    animation: oc-slide-up var(--oc-duration-normal) var(--oc-ease-out);
  }

  .oc-modal__title {
    font-size: var(--oc-text-lg);
    font-weight: var(--oc-weight-semibold);
    color: var(--text-strong, var(--oc-gray-900));
    margin: 0 0 var(--oc-space-xl);
  }

  .oc-modal__actions {
    display: flex;
    gap: var(--oc-space-md);
    justify-content: flex-end;
    margin-top: var(--oc-space-xl);
  }

  @keyframes oc-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes oc-slide-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

// ─── Table Styles ────────────────────────────────────────────────────────────

export const ocTableStyles = css`
  .oc-table {
    width: 100%;
    border-collapse: collapse;
  }

  .oc-table th {
    padding: var(--oc-space-md) var(--oc-space-lg);
    text-align: left;
    font-size: var(--oc-text-xs);
    font-weight: var(--oc-weight-medium);
    color: var(--muted, var(--oc-gray-500));
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid var(--border, var(--oc-gray-200));
  }

  .oc-table td {
    padding: var(--oc-space-md) var(--oc-space-lg);
    border-bottom: 1px solid var(--border, var(--oc-gray-200));
    font-size: var(--oc-text-base);
  }

  .oc-table tbody tr:hover {
    background: var(--oc-gray-50);
  }

  .oc-table tbody tr:last-child td {
    border-bottom: none;
  }
`;

// ─── Tab Navigation Styles ───────────────────────────────────────────────────

export const ocTabStyles = css`
  .oc-tabs {
    display: flex;
    gap: var(--oc-space-xs);
    border-bottom: 1px solid var(--border, var(--oc-gray-200));
    padding-bottom: 0;
    margin-bottom: var(--oc-space-xl);
  }

  .oc-tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: var(--oc-space-sm) var(--oc-space-lg);
    font-size: var(--oc-text-base);
    font-weight: var(--oc-weight-medium);
    color: var(--muted, var(--oc-gray-500));
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all var(--oc-duration-fast) var(--oc-ease);
    margin-bottom: -1px;
  }

  .oc-tab:hover {
    color: var(--text, var(--oc-gray-700));
    background: var(--oc-gray-50);
  }

  .oc-tab--active {
    color: var(--oc-red);
    border-bottom-color: var(--oc-red);
  }

  .oc-tab__badge {
    background: var(--oc-red);
    color: white;
    font-size: var(--oc-text-xs);
    padding: 1px 6px;
    border-radius: var(--oc-radius-full);
    font-weight: var(--oc-weight-semibold);
  }

  .oc-tab svg {
    width: 16px;
    height: 16px;
  }
`;

// ─── Toast Styles ────────────────────────────────────────────────────────────

export const ocToastStyles = css`
  .oc-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 14px 20px;
    border-radius: var(--oc-radius-lg);
    font-size: var(--oc-text-md);
    font-weight: var(--oc-weight-medium);
    box-shadow: var(--oc-shadow-lg);
    z-index: 1100;
    animation: oc-toast-in var(--oc-duration-normal) var(--oc-ease-out);
    color: white;
  }

  .oc-toast--success {
    background: var(--oc-success);
  }

  .oc-toast--error {
    background: var(--oc-danger);
  }

  .oc-toast--info {
    background: var(--oc-info);
  }

  @keyframes oc-toast-in {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

// ─── Utility Styles ──────────────────────────────────────────────────────────

export const ocUtilities = css`
  /* Flexbox */
  .oc-flex { display: flex; }
  .oc-flex-col { display: flex; flex-direction: column; }
  .oc-items-center { align-items: center; }
  .oc-justify-between { justify-content: space-between; }
  .oc-justify-center { justify-content: center; }
  .oc-gap-xs { gap: var(--oc-space-xs); }
  .oc-gap-sm { gap: var(--oc-space-sm); }
  .oc-gap-md { gap: var(--oc-space-md); }
  .oc-gap-lg { gap: var(--oc-space-lg); }
  .oc-gap-xl { gap: var(--oc-space-xl); }
  .oc-flex-1 { flex: 1; min-width: 0; }
  .oc-flex-wrap { flex-wrap: wrap; }
  .oc-flex-shrink-0 { flex-shrink: 0; }

  /* Spacing */
  .oc-mb-sm { margin-bottom: var(--oc-space-sm); }
  .oc-mb-md { margin-bottom: var(--oc-space-md); }
  .oc-mb-lg { margin-bottom: var(--oc-space-lg); }
  .oc-mb-xl { margin-bottom: var(--oc-space-xl); }
  .oc-mt-lg { margin-top: var(--oc-space-lg); }

  /* Text */
  .oc-text-muted { color: var(--muted, var(--oc-gray-500)); }
  .oc-text-strong { color: var(--text-strong, var(--oc-gray-900)); }
  .oc-text-accent { color: var(--oc-red); }
  .oc-text-sm { font-size: var(--oc-text-sm); }
  .oc-text-xs { font-size: var(--oc-text-xs); }
  .oc-font-mono { font-family: var(--oc-font-mono); }
  .oc-font-semibold { font-weight: var(--oc-weight-semibold); }
  .oc-font-bold { font-weight: var(--oc-weight-bold); }
  .oc-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .oc-text-center { text-align: center; }
  .oc-break-word { word-break: break-word; }

  /* Layout */
  .oc-w-full { width: 100%; }
  .oc-min-w-0 { min-width: 0; }

  /* Spinner */
  .oc-spinner {
    width: 20px;
    height: 20px;
    border: 2px solid var(--border, var(--oc-gray-200));
    border-top-color: var(--oc-red);
    border-radius: 50%;
    animation: oc-spin 0.8s linear infinite;
  }

  .oc-spinner--sm { width: 14px; height: 14px; }
  .oc-spinner--lg { width: 32px; height: 32px; border-width: 3px; }

  @keyframes oc-spin {
    to { transform: rotate(360deg); }
  }

  /* Divider */
  .oc-divider {
    height: 1px;
    background: var(--border, var(--oc-gray-200));
    margin: var(--oc-space-lg) 0;
    border: none;
  }

  /* Screen reader only */
  .oc-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
`;

// ─── Combined "all styles" export ────────────────────────────────────────────
// For quick adoption — import { ocAllStyles } from '../shared/theme.js';

export const ocAllStyles = [
  ocTheme,
  ocBaseFormStyles,
  ocCardStyles,
  ocButtonStyles,
  ocInputStyles,
  ocTagStyles,
  ocHeaderStyles,
  ocEmptyStateStyles,
  ocModalStyles,
  ocTableStyles,
  ocTabStyles,
  ocToastStyles,
  ocUtilities,
];
