# Hope, Inc. ERP design system

> Refines Hope's existing warm cream, evergreen, and botanical-green identity. This is the implementation reference for product UI; it does not replace the existing visual direction.
>
> Visual reference: [Hope ERP style guide sheet](./hope-erp-style-guide.html)

## 1. Principles

- **Warm, not rustic:** retain the cream canvas, evergreen navigation, and clear white surfaces; use green as a purposeful action color rather than decoration on every element.
- **Operational clarity:** prioritize readable data, visible state, and predictable actions over ornamental density.
- **Accessible by default:** never communicate status through color alone; preserve keyboard focus, labels, and contrast in every state.
- **Consistent and restrained:** use the spacing, type, color, and component tokens below instead of one-off values.
- **Responsive:** preserve task-critical information at narrow widths; move secondary content rather than shrinking required text below 12px.

## 2. Color tokens

Contrast ratios are WCAG relative-luminance ratios, rounded to two decimals. For each row, the listed foreground is evaluated against its adjacent background. Text passes at **4.5:1** (normal text) or **3:1** (large text); meaningful component boundaries and focus indicators pass at **3:1**. Ratios are not reduced for disabled content; disabled labels remain readable.

| Token | Hex | Usage / foreground-background pair | Contrast |
|---|---|---|---:|
| `--color-primary-600` | `#397E68` | Primary action background; white label on green | 4.82:1 |
| `--color-primary-700` | `#2F6D58` | Primary hover background; white label on green | 6.09:1 |
| `--color-primary-800` | `#245B4B` | Primary pressed background; white label on green | 7.86:1 |
| `--color-sidebar` | `#263D34` | Sidebar and dark brand surfaces; white primary label | 11.67:1 |
| `--color-sidebar-text` | `#FFFFFF` | Primary navigation text on sidebar | 11.67:1 |
| `--color-sidebar-text-secondary` | `#D4DED7` | Secondary nav text on sidebar | 8.46:1 |
| `--color-sidebar-text-disabled` | `#BBC8BF` | Disabled nav text on sidebar | 6.74:1 |
| `--color-page` | `#FAF9F5` | Warm cream page background; primary text on cream | 13.71:1 |
| `--color-surface` | `#FFFEFA` | Cards, menus, dialogs, and control backgrounds; primary text on surface | 14.31:1 |
| `--color-border` | `#8D9188` | Input, checkbox, selected-surface, and other meaningful boundaries; against cream / white | 3.05:1 / 3.21:1 |
| `--color-text-primary` | `#202C29` | Headings, body, table data on cream / surface | 13.71:1 / 14.31:1 |
| `--color-text-secondary` | `#58635D` | Supporting copy, labels, metadata on cream | 5.94:1 |
| `--color-text-disabled` | `#626B65` | Disabled control labels and unavailable text on cream | 5.23:1 |
| `--color-success-50` | `#E7F1E8` | Active/success badge background | — |
| `--color-success-800` | `#285D3E` | Active/success text and icon on success-50 | 6.66:1 |
| `--color-danger-50` | `#FBEAE7` | Inactive, blocked, delete, and error badge background | — |
| `--color-danger-800` | `#9F3029` | Inactive/blocked/error text and icon on danger-50 | 6.15:1 |
| `--color-danger-700` | `#A63232` | Destructive button background; white label | 6.72:1 |
| `--color-danger-800-solid` | `#842727` | Destructive button hover background; white label | 9.13:1 |
| `--color-warning-50` | `#FFF2D7` | Warning badge and alert background | — |
| `--color-warning-800` | `#754900` | Warning text and icon on warning-50 | 6.99:1 |
| `--color-info-50` | `#E6F0F7` | Informational badge and alert background | — |
| `--color-info-800` | `#205B75` | Informational text and icon on info-50 | 6.46:1 |
| `--color-role-superadmin-bg` | `#EFEAFA` | Superadmin role pill background | — |
| `--color-role-superadmin-fg` | `#55418B` | Superadmin label/icon on role background | 7.08:1 |
| `--color-role-admin-bg` | `#E7EEF8` | Admin role pill background | — |
| `--color-role-admin-fg` | `#315581` | Admin label/icon on role background | 6.55:1 |
| `--color-role-user-bg` | `#E8F1E9` | User role pill background | — |
| `--color-role-user-fg` | `#315D3E` | User label/icon on role background | 6.58:1 |
| `--color-row-deleted` | `#F1F0EC` | Soft-deleted row background; primary text remains readable | 12.67:1 |
| `--color-row-deleted-secondary` | `#58635D` | Soft-deleted row secondary text on deleted background | 5.48:1 |
| `--color-focus` | `#245B4B` | 2px keyboard-focus ring on cream / white | 7.46:1 / 7.86:1 |

### Contrast and application rules

- Text on solid primary controls is white in every state. Text on semantic/role pills uses the paired foreground token above; do not place white text on pastel backgrounds.
- Use `--color-border` for meaningful control boundaries. A lighter divider can be used only when it is decorative and not the sole indication of a control, grouping, or selected state.
- Render focus as a 2px `--color-focus` outline with a 2px offset. Do not remove the native outline without replacing it.
- Keep status icon and text labels visible alongside semantic color. On dark sidebar surfaces, use the sidebar text tokens, not page text-secondary.
- Do not lower opacity on readable disabled text; use the disabled token and a disabled surface treatment instead.

## 3. Typography

Use **Inter** (open-source, self-host or load through the project's approved font setup) with `Arial, Helvetica, sans-serif` fallbacks. Keep Hope's existing Georgia italic accent for rare editorial/marketing display only; not for ERP data or controls.

| Style | Size / line-height | Weight | Typical use |
|---|---|---:|---|
| Page title | 28px / 36px | 600 | Screen heading |
| Section title | 20px / 28px | 600 | Cards, panels, dialog title |
| Table header | 12px / 16px | 600 | Column label; uppercase only for short, nonessential overlines |
| Body | 14px / 20px | 400 | Main content, inputs, and table cells |
| Small / caption | 12px / 16px | 400 or 500 | Help, metadata, timestamps, field labels |
| Button label | 14px / 20px | 600 | All button sizes |

Use 400 for reading, 500 for emphasized values, and 600 for headings and controls. Use 700 sparingly for short emphasis. Avoid long all-caps text, overly tight tracking, and text smaller than 12px when users need to read it. Numeric columns may use tabular figures (`font-variant-numeric: tabular-nums`).

## 4. Layout, spacing, and elevation

### Spacing scale

Use a 4px base: `--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`, `--space-4: 16px`, `--space-5: 20px`, `--space-6: 24px`, `--space-8: 32px`, `--space-10: 40px`, `--space-12: 48px`, `--space-16: 64px`. Prefer these values for gaps, padding, and section rhythm; use 2px only for optical alignment.

### Shape and shadows

- `--radius-sm: 4px` for compact controls and badges.
- `--radius-md: 6px` for inputs, buttons, cards, and quick actions.
- `--radius-lg: 10px` for dialogs and larger grouped surfaces.
- `--radius-pill: 999px` for status/role pills and toggles.
- `--shadow-card: 0 2px 8px rgb(32 44 41 / 6%), 0 1px 2px rgb(32 44 41 / 5%)`.
- `--shadow-popover: 0 8px 24px rgb(32 44 41 / 12%), 0 2px 6px rgb(32 44 41 / 6%)`.
- `--shadow-dialog: 0 20px 56px rgb(20 32 27 / 22%)`.

Keep the cream canvas mostly flat; elevation indicates layering, not decoration. Do not use shadow as the only focus or selection indicator.

### Grid and responsive behavior

- App shell: `256px` expanded sidebar + `minmax(0, 1fr)` content. Compact sidebar: `72px`; retain accessible names in tooltips and screen-reader labels.
- Main content max-width: `1200px`; center within the content area with 32px desktop gutters. Use 24px page padding at tablet width and 16px at mobile width.
- Standard data table: full available width with a minimum practical column width; allow horizontal scrolling or move low-priority columns into a detail view instead of compressing readable text.
- Breakpoints: `1280px` wide layout; `1024px` compact/condensed navigation; `768px` tablet with sidebar drawer; `480px` single-column mobile controls and dialogs.
- At 768px and below, use a dismissible navigation drawer and keep a visible menu trigger. At 480px, dialogs use near-full-screen width and action buttons stack only when needed.
- Respect reduced-motion preferences; state changes must remain understandable without animation.

## 5. Core components

### Shared interaction states

Use this state contract wherever a component supports that interaction. States not applicable to a static display component are explicitly marked **N/A** rather than simulated as misleading controls.

| State | Appearance / behavior |
|---|---|
| Default | Clear boundary, readable label, correct semantic color; pointer cursor only for actionable elements. |
| Hover | Subtle token-based surface shift; never the only way to discover an action. |
| Focus | 2px visible `--color-focus` outline with offset; keyboard reachable and not clipped. |
| Active | Brief pressed treatment (darker action token or inset/translate by at most 1px); no layout jump. |
| Disabled | Remove activation and tab stop where native semantics allow; use disabled text token and clear disabled semantics. Never imply success. |
| Error | Add danger border/icon, persistent text explanation, and programmatic association (`aria-describedby`); color alone is insufficient. |
| Loading | Keep control dimensions stable, show progress and an announced busy state; prevent duplicate submission. Preserve context and do not invent a completed state. |

### Buttons

- **Anatomy:** label; optional leading/trailing icon; optional progress indicator. Icon-only buttons require a visible tooltip and accessible name.
- **Variants:** primary (`--color-primary-600`), secondary (surface with primary-colored text and 3:1 boundary), danger (`--color-danger-700`), ghost (transparent with visible hover/focus), icon (compact square hit area).
- **Sizes:** small 32px, medium 40px (default), large 48px. Keep 14px labels and at least a 40px touch target where space permits; icon button hit target is 40px minimum.
- **States:** default, hover, focus, active, disabled, error (only when a form action itself has an error; pair with explanation), loading (spinner plus “Saving…”/equivalent, `aria-busy`).
- **Do:** use one primary action per region; make destructive labels explicit (“Delete user”). **Don't:** use vague “OK” for consequential actions, nest buttons, or make color the only difference between actions.

### Text input and password input

- **Anatomy:** visible label, optional required marker, control, optional hint, error text; password adds a show/hide button inside the trailing control area.
- **Variants:** text, search, password. Height 40px medium / 48px large; use 14px input and label text.
- **States:** default, hover boundary, focus ring, active while editing, disabled with readable disabled label, error with inline message, loading only for explicitly asynchronous validation (do not block ordinary typing).
- **Password:** hidden by default; show/hide control toggles `type` without clearing the value, has an explicit “Show password” / “Hide password” accessible name, and does not submit the form.
- **Do:** associate a persistent label and preserve user input on validation errors. **Don't:** rely on placeholder as label, hide errors in a toast, or clear a password when toggling visibility.

### Select

- **Anatomy:** label, selected value, disclosure icon, optional hint/error; menu options include selected and disabled semantics.
- **Variants:** single-select by default; searchable only for long lists; native select when it provides the better accessible experience.
- **States:** default, hover, focus, active/open, disabled, error, loading options with an announced status. N/A: submit loading is owned by the form action.
- **Do:** show the current selection and keyboard selection. **Don't:** use color alone to show selected/disabled options or fake a select with non-keyboardable divs.

### Checkbox

- **Anatomy:** 18px checkbox, label, optional hint/error; indeterminate uses a horizontal mark and programmatic mixed state.
- **Variants:** checked, unchecked, indeterminate, disabled, disabled-because-parent-off.
- **States:** default, hover, focus, active, disabled, error (message associated with group/field); loading is N/A.
- **Disabled because parent is off:** show the checkbox disabled and unchecked, retain readable label, and explain the dependency in nearby help text (for example, “Enable notifications to choose delivery channels”). Do not silently preserve a hidden checked state.
- **Do:** make the label clickable. **Don't:** use a checkmark color as the only checked signal or use indeterminate as a third persisted value.

### Toggle

- **Anatomy:** track, thumb, persistent text label, optional on/off value text and help.
- **Variants:** on, off, disabled. Use only for an immediate binary setting, not for form choices requiring explicit submission.
- **States:** default, hover, focus, active, disabled, error (if a setting cannot be applied, explain why); loading while saving keeps the prior value visible and announces progress.
- **Do:** pair with a clear label and show state text when meaning might be unclear. **Don't:** use a toggle for navigation or actions such as Delete.

### Status badge and role pill

- **Anatomy:** optional status/role icon plus visible text label; compact pill with semantic foreground/background pair.
- **Status variants:** Active/success, Inactive/danger, Blocked/danger, warning, info. Inactive and Blocked remain distinct by label and icon, not color.
- **Role variants:** Superadmin, Admin, User, using the dedicated role color tokens.
- **States:** default; hover/focus/active only if the pill is an actual filter/action; disabled only for actionable pills; error/loading N/A for read-only labels.
- **Do:** preserve the text label at all sizes and use stable status terminology. **Don't:** make a passive badge look like a button or rely on red/green alone.

### Data table

- **Anatomy:** toolbar (search, filters/status tabs, count), semantic column headers, data rows, optional selection column/actions, pagination, and empty/loading/error state.
- **Variants/states:** default, row hover, selected row (tint plus check/selection control), focusable row action, soft-deleted row (`--color-row-deleted` plus “Deleted”/“Deleted on…” text), loading skeleton with announced status, error/retry, and empty state with next step.
- **Header:** 12px semibold text, persistent labels, sortable headers show direction and `aria-sort`; do not encode sort state by color alone.
- **Search box:** label or accessible name, search icon, clear action, and result count. Debounce remote search without delaying visible local feedback.
- **Status tabs with counts:** show label and count (for example, “Active 12”); expose selected state programmatically and visually. Counts update with data.
- **Soft deleted:** use a quiet background shade, keep text contrast, label deletion status, and place restore/permanent-delete actions in a menu with explicit confirmation. Do not fade text or remove the row from the audit context.
- **Do:** align numeric values, offer an empty state and responsive strategy. **Don't:** use color-only selection, hide table headers, or rely on hover to reveal essential information.

### Modal / dialog

- **Anatomy:** accessible title, concise description, content, close control, sticky footer with secondary **Cancel** and primary **Save** (or an explicit task action).
- **Variants:** standard, form, destructive confirmation.
- **States:** default, hover/focus/active controls, disabled action until valid when appropriate, field error retained inline, loading save with stable footer and duplicate-submit prevention. Dialog itself does not have a hover/active state.
- **Behavior:** move focus into dialog, keep tab navigation inside, close on Escape unless a blocking operation is in progress, return focus to the opener; backdrop click may close only for non-destructive, unsaved-safe dialogs.
- **Do:** make footer actions persistent when content scrolls. **Don't:** put multiple primary actions in the footer or discard unsaved data without warning.

### Sidebar navigation item and Quick Action card

- **Sidebar item anatomy:** icon, text label, optional count; active indicator plus `aria-current="page"`.
- **Sidebar variants/states:** default, hover, focus, active, disabled/greyed with reason in accessible description; active and disabled use more than color (indicator/label and semantics). Loading is N/A for a static nav item.
- **Quick Action card anatomy:** icon, title, brief description, optional arrow; whole card is one link or button, not nested actions.
- **Quick Action states:** default, hover, focus, active, disabled with explanation, loading when it triggers an async task; error belongs to the resulting task feedback.
- **Do:** retain labels at compact widths via accessible name/tooltip. **Don't:** make disabled items appear interactive or use tiny icon-only targets.

### Toast, alert, and inline form error

- **Anatomy:** semantic icon, explicit text heading/message, optional action or dismiss control. Inline error is attached to the field/group and referenced with `aria-describedby`.
- **Variants:** success, error, info; warning uses the warning palette when user action is needed.
- **States:** toast/alert appearance is N/A for hover/focus/active/disabled/loading unless it contains a control; controls follow the button contract. Inline error persists until corrected or revalidated.
- **Behavior:** use toast for transient, non-blocking outcomes; auto-dismiss only low-risk success after a generous interval and allow dismissal. Errors and consequential updates remain until dismissed or resolved. Alerts are persistent for important context.
- **Do:** state what happened and what to do next. **Don't:** send form errors only to a toast, interrupt with a toast for every field, or communicate severity with color alone.

### Confirmation dialog: Delete and Block

- **Anatomy:** explicit action title, named target, irreversible/impact explanation, optional reason field for Block, Cancel, and specifically labeled destructive confirmation.
- **Variants:** Delete (danger) and Block (danger; distinct lock icon and “Block” label).
- **States:** default, focus, active, disabled until required input is valid, error with actionable explanation, loading with duplicate submission prevented. Hover follows button states.
- **Do:** identify the exact person/record and consequences; use “Delete [name]” or “Block [name]”. For soft delete, say that it can be restored. **Don't:** use an ambiguous “Confirm”, put Delete beside a likely click target without separation, or make Block indistinguishable from Delete.

## 6. Iconography

- Use one consistent, licensed icon family already present in the project; if none exists, select a small stroke-based family before implementation rather than mixing sets.
- Use 16px icons in controls, 20px in navigation, and 24px only for prominent empty states. Align icons optically to text.
- Icons accompanying text are decorative to assistive technology; icon-only actions need an accessible name and tooltip.
- Pair semantic status icons with a text label. Use distinct, recognizable icons for Active/check, Inactive/minus, Blocked/lock, warning/triangle, info/circle-i, Delete/trash, and Restore/undo.
- Do not use emoji as interface icons, invent unclear glyphs, or use icons as the only affordance for unfamiliar actions.

## 7. Audit stamp pattern

Render audit metadata with the exact verb-first pattern:

`CREATED / EDITED / DELETED · {user} · {date}`

Use one stamp per event, with the event verb visibly uppercase and the user identity and date readable at 12px or larger. Example: `EDITED · Maya Chen · 26 Oct 2026, 14:32`. Use the viewer's locale and timezone; include time for ordered audit events. For system actions, identify `System` rather than inventing a person. Soft-deleted records show the DELETED stamp and remain distinguishable from active records; never imply that a soft delete is permanent.
