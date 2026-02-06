# Migration Guide: Adopting the OC Design System

## Quick Start

Each extension needs two changes:

1. **Import shared styles** into `static styles`
2. **Optionally use shared components** (`<oc-card>`, `<oc-button>`, etc.)

The shared styles are **additive** — they won't break existing styles. Migrate incrementally.

---

## Step 1: Import the Theme

Every extension should import `ocTheme` as the first style to inject design tokens:

```ts
import { ocTheme, ocCardStyles, ocButtonStyles, ocEmptyStateStyles, ocTagStyles } from '../shared/theme.js';

static styles = [
  ocTheme,           // always first — provides CSS custom properties
  ocButtonStyles,    // pick what you need
  ocCardStyles,
  css`/* existing component styles */`
];
```

Or import everything at once:

```ts
import { ocAllStyles } from '../shared/theme.js';

static styles = [
  ...ocAllStyles,
  css`/* existing styles */`
];
```

## Step 2: Use Shared Components (Optional)

```ts
import "../shared/components.js";
```

Then in templates:

```html
<oc-card>
  <span slot="header">Section Title</span>
  <p>Content here</p>
  <div slot="footer">
    <oc-tag color="green">Active</oc-tag>
  </div>
</oc-card>

<oc-button variant="primary" full>Save</oc-button>

<oc-empty-state icon="inbox" title="No items" message="Create your first item to get started.">
  <oc-button slot="action" variant="primary">Create</oc-button>
</oc-empty-state>

<oc-header title="Finance" subtitle="Dashboard">
  <svg slot="icon">...</svg>
  <div slot="actions">
    <oc-button variant="secondary" size="sm">Export</oc-button>
  </div>
</oc-header>

<oc-tag color="red">Urgent</oc-tag>
<oc-tag color="orange">Warning</oc-tag>
<oc-tag color="gray" outline>Draft</oc-tag>
```

---

## Per-Extension Migration Plans

### 1. Kanban (`kanban/view.ts`)

**Current state:** Uses existing `--var` CSS custom properties extensively. Well-structured.

**Migration steps:**

1. Add `ocTheme` to `static styles` (first position)
2. Replace `.btn` / `.btn-primary` / `.btn-danger` classes with `oc-btn` classes or `<oc-button>` components
3. Replace `.task-card` background/border/shadow with `oc-card` classes (or keep custom since kanban cards have drag behavior)
4. Replace `.empty-message` with `<oc-empty-state icon="kanban" title="No tasks" />`
5. Replace `.modal` / `.modal-overlay` with `oc-overlay` / `oc-modal` classes
6. Replace `.toast` with `oc-toast` classes
7. Replace `.priority-badge` with `<oc-tag>` component
8. Use `--oc-red` instead of hardcoded accent for the drag placeholder

**What to keep custom:** Drag-and-drop card styling, column layout, grip handles.

```ts
// Before
static styles = css`...all inline styles...`;

// After
import { ocTheme, ocButtonStyles, ocModalStyles, ocToastStyles, ocEmptyStateStyles } from '../shared/theme.js';
import '../shared/components.js';

static styles = [
  ocTheme,
  ocButtonStyles,
  ocModalStyles,
  ocToastStyles,
  ocEmptyStateStyles,
  css`
    /* kanban-specific: columns, drag, task cards */
  `
];
```

### 2. File Browser (`file-browser/view.ts`)

**Current state:** Sidebar + content area layout. Many custom styles.

**Migration steps:**

1. Add `ocTheme` + `ocButtonStyles` + `ocInputStyles` to styles
2. Replace `.btn` classes with `oc-btn` classes
3. Replace `.search-input` with `oc-input oc-input--search` class
4. Replace `.empty-state` with `<oc-empty-state icon="folder" title="Select a file" />`
5. Replace file list item hover/selected styles using OC tokens
6. Sidebar header → use `<oc-header>` or keep custom (sidebar is complex)
7. Sort buttons → use `oc-tab` classes
8. Create file modal → use `oc-modal` classes

**What to keep custom:** Sidebar collapse behavior, markdown preview, code highlighting, textarea editor.

```ts
import { ocTheme, ocButtonStyles, ocInputStyles, ocEmptyStateStyles, ocModalStyles } from '../shared/theme.js';
import '../shared/components.js';

static styles = [
  ocTheme,
  ocButtonStyles,
  ocInputStyles,
  ocEmptyStateStyles,
  ocModalStyles,
  css`
    /* file-browser-specific: sidebar, content area, markdown, code */
  `
];
```

### 3. Finance (`finance/view.ts`)

**Current state:** Most complex extension. Tabs, tables, modals, charts, matching UI.

**Migration steps:**

1. Add `ocTheme` + all relevant style modules
2. Replace `.tabs` / `.tab` with `oc-tabs` / `oc-tab` classes (accent becomes red)
3. Replace `.card` with `oc-card` class (same shape, just uses OC tokens)
4. Replace `.btn` hierarchy with `oc-btn` classes
5. Replace `table` styles with `oc-table` class
6. Replace `.status` badges with `<oc-tag>` components:
   - `.status.matched` → `<oc-tag color="green">Matched</oc-tag>`
   - `.status.unmatched` → `<oc-tag color="yellow">Unmatched</oc-tag>`
7. Replace `.stat-card` with `<oc-card>` or keep custom for layout
8. Replace `.modal-backdrop` / `.modal` with `oc-overlay` / `oc-modal`
9. Replace `.toast` with `oc-toast` classes
10. Replace `.empty-state` with `<oc-empty-state>`
11. Replace `.company-btn` active state to use `--oc-red` instead of `--accent`
12. Form inputs → `oc-input` / `oc-select` classes

**What to keep custom:** Chart bars, matching container grid, suggestion items, company dots.

```ts
import { ocAllStyles } from '../shared/theme.js';
import '../shared/components.js';

static styles = [
  ...ocAllStyles,
  css`
    /* finance-specific: charts, matching, company selector */
  `
];
```

### 4. Knowledge (`knowledge/view.ts`)

**Current state:** Clean tab-based layout. Cards, tags, quick-add bar.

**Migration steps:**

1. Add `ocTheme` + relevant modules
2. Replace `.tabs` / `.tab` with `oc-tabs` / `oc-tab` classes
3. Replace `.card` with `oc-card` class
4. Replace `.tag` with `<oc-tag color="red">` component
5. Replace `.category-badge` with `<oc-tag color="gray">`
6. Replace `.btn` hierarchy with `oc-btn` classes
7. Replace `.filter-chip` with `oc-tab` or keep custom (filter chips are specific)
8. Replace `.empty` with `<oc-empty-state>`
9. Replace `.modal-overlay` / `.modal` with `oc-overlay` / `oc-modal`
10. Replace `.quick-add-input` with `oc-input` class
11. Replace `.form-input` / `.form-textarea` with `oc-input` / `oc-textarea`

**What to keep custom:** Note editor inline, filter chips (unless using tabs).

```ts
import { ocTheme, ocButtonStyles, ocCardStyles, ocInputStyles, ocTagStyles,
         ocTabStyles, ocEmptyStateStyles, ocModalStyles } from '../shared/theme.js';
import '../shared/components.js';

static styles = [
  ocTheme,
  ocButtonStyles,
  ocCardStyles,
  ocInputStyles,
  ocTagStyles,
  ocTabStyles,
  ocEmptyStateStyles,
  ocModalStyles,
  css`
    /* knowledge-specific: note editor, filter chips */
  `
];
```

---

## CSS Class Mapping Cheat Sheet

| Old Class           | New Class                     | Notes                      |
| ------------------- | ----------------------------- | -------------------------- |
| `.btn`              | `.oc-btn`                     |                            |
| `.btn-primary`      | `.oc-btn--primary`            | Now pill-shaped, red       |
| `.btn-danger`       | `.oc-btn--danger`             |                            |
| `.btn-sm`           | `.oc-btn--sm`                 |                            |
| `.card`             | `.oc-card`                    | 16px radius, subtle shadow |
| `.card-header`      | `.oc-card__header`            |                            |
| `.card-title`       | `.oc-card__title`             |                            |
| `.tab`              | `.oc-tab`                     |                            |
| `.tab.active`       | `.oc-tab--active`             | Red underline              |
| `.tag`              | `.oc-tag--red` (etc)          | Use `<oc-tag>` component   |
| `.status.matched`   | `<oc-tag color="green">`      |                            |
| `.status.unmatched` | `<oc-tag color="yellow">`     |                            |
| `.empty-state`      | `.oc-empty`                   | Or use `<oc-empty-state>`  |
| `.modal-overlay`    | `.oc-overlay`                 |                            |
| `.modal`            | `.oc-modal`                   |                            |
| `.toast`            | `.oc-toast`                   |                            |
| `.form-input`       | `.oc-input`                   |                            |
| `.search-input`     | `.oc-input .oc-input--search` |                            |
| `table`             | `.oc-table`                   |                            |
| `.spinner`          | `.oc-spinner`                 |                            |

## Design Token Mapping

| Existing Var      | OC Token                | Use                                         |
| ----------------- | ----------------------- | ------------------------------------------- |
| `--accent`        | `--oc-red`              | Primary accent (was blue-ish, now warm red) |
| `--accent-hover`  | `--oc-red-hover`        |                                             |
| `--accent-subtle` | `--oc-red-subtle`       |                                             |
| `--radius-lg`     | `--oc-radius-xl` (16px) | Cards get more generous rounding            |
| `--radius-md`     | `--oc-radius-md` (8px)  | Buttons, inputs                             |
| `--shadow-sm`     | `--oc-shadow-sm`        | Warmer, subtler                             |

**Note:** The OC tokens work alongside existing `--var` properties. Extensions can gradually switch references without breaking anything.
