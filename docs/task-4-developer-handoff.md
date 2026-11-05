# Hope, Inc. ERP — Task 4: Hi-Fi mockups and developer handoff

## 1. How to view the mockups

Open [`task-4-hifi-mockups.html`](./task-4-hifi-mockups.html) directly in a modern browser; it is self-contained and needs no server or build. Use the sticky section menu:

- `#login` — Sign In and all requested states
- `#register` — Register/request-access and all requested states
- `#home` — Main page, role variants, loading, empty, and mobile menu
- `#users` — User Management list, row/bulk/empty/error states
- `#dialog` — Add/Edit/View panel and delete/block/unblock/restore confirmations
- `#handoff` — Token, interaction, and accessibility reference

Each state has three labeled viewports: desktop 1440px, tablet 768px, and mobile 375px. Each artboard uses its target CSS width and scales down only to fit the preview frame. For an unscaled preview, use a browser window at least 1540px wide for desktop, 868px for tablet, or 435px for mobile.

## 2. Assumptions

- The repository `main` branch contains only a short project README, not a separate product-context specification. Roles, statuses, modules, and task-specific behavior are taken from the Task 2 and Task 3 handoff documents.
- Roles are Superadmin, Admin, and User. Account statuses are Active, Inactive, and Blocked. Deleted is a soft-delete/list state, not an account status.
- New public email or Google registrations are User/Inactive requests. Either an approved Admin or an approved Superadmin may approve; either role is sufficient. Register does not immediately grant application access.
- The separate Add user flow in Task 3 creates an immediately approved account using an Admin-entered temporary password; the account holder changes it at first sign-in. Admin creates User accounts; Superadmin creates User or Admin accounts.
- Delete is soft and recoverable. Restore preserves the prior status. There is no permanent-delete action.
- The right-side dialog is the Task 1 Modal / dialog pattern composed as a right-anchored form panel. On mobile it is full-screen.
- The only named product areas are Home and User Management. No speculative ERP modules or dashboard metrics are shown.
- Sample names, emails, counts, audit events, dates, and signed-in people are fictional examples and must not be used as live data.
- For the Task 4 Register prototype, password and confirmation fields are shown because this task explicitly requests them; this is a documented change from Task 2, which says Register collects names/email only and password setup follows approval.
- Password requirement shown is the Task 2 minimum of 8 characters. The strength indicator only reflects length and matching; it does not invent additional policy.
- All screens are static visual examples. Form submission, authentication, filtering, and account mutations are not implemented here.

## 3. Token map

All colors, type, spacing, radius, elevation, and control treatments use the Task 1 design-system tokens and named component patterns. No one-off brand color or font is added.

| Screen area | Exact tokens / component references |
|---|---|
| App canvas and main content | `--color-page` `#FAF9F5`; `--color-text-primary` `#202C29`; `--color-text-secondary` `#58635D`; Task 1 Page title, Section title, Body, Small/caption. |
| Main sidebar | `--color-sidebar` `#263D34`; `--color-sidebar-text` `#FFFFFF`; `--color-sidebar-text-secondary` `#D4DED7`; `--color-sidebar-text-disabled` `#BBC8BF`. |
| Cards, forms, panels, tables, dialogs, popovers | `--color-surface` `#FFFEFA`; `--color-border` `#8D9188`; `--shadow-card`; `--shadow-popover`; `--shadow-dialog`; `--radius-md` for cards/controls and `--radius-lg` for dialogs. |
| Primary/hover/pressed actions | `--color-primary-600` `#397E68`; `--color-primary-700` `#2F6D58`; `--color-primary-800` `#245B4B`; white labels use `--color-sidebar-text`. |
| Secondary, ghost, and disabled actions | Surface + `--color-border` + `--color-primary-800`; ghost uses `--color-text-primary`; disabled text uses `--color-text-disabled` on `--color-row-deleted`. |
| Focused controls | 2px `--color-focus` `#245B4B` outline with 2px offset on every keyboard-operable control. |
| Active/success | `--color-success-50` `#E7F1E8`; `--color-success-800` `#285D3E`; visible check icon and label. |
| Inactive/Blocked/error | `--color-danger-50` `#FBEAE7`; `--color-danger-800` `#9F3029`; destructive button `--color-danger-700` `#A63232`, hover `--color-danger-800-solid` `#842727`; visible status/error label and icon. |
| Warning and information | `--color-warning-50` `#FFF2D7` + `--color-warning-800` `#754900`; `--color-info-50` `#E6F0F7` + `--color-info-800` `#205B75`. |
| Role pills | Superadmin `--color-role-superadmin-bg` `#EFEAFA` + `--color-role-superadmin-fg` `#55418B`; Admin `--color-role-admin-bg` `#E7EEF8` + `--color-role-admin-fg` `#315581`; User `--color-role-user-bg` `#E8F1E9` + `--color-role-user-fg` `#315D3E`. |
| Deleted row | `--color-row-deleted` `#F1F0EC`; secondary copy `--color-row-deleted-secondary` `#58635D`; `DELETED` stamp remains visible. |
| Spacing | `--space-1` 4px; `--space-2` 8px; `--space-3` 12px; `--space-4` 16px; `--space-5` 20px; `--space-6` 24px; `--space-8` 32px; `--space-10` 40px; `--space-12` 48px; `--space-16` 64px. |
| Shape | `--radius-sm` 4px for compact controls/badges; `--radius-md` 6px for inputs/buttons/cards/quick actions; `--radius-lg` 10px for dialogs; `--radius-pill` 999px for status/role pills. |
| Elevation | `--shadow-card` on cards; `--shadow-popover` on menus; `--shadow-dialog` on dialog panels. No shadow-only focus/selection. |
| Typography | Inter with `Arial, Helvetica, sans-serif` fallback. Page title 28/36px 600; Section title 20/28px 600; Table header 12/16px 600; Body 14/20px 400; Small/caption 12/16px 400/500; Button 14/20px 600. |

Contrast pairs follow Task 1: normal text ≥4.5:1; large text and meaningful controls/focus ≥3:1. The documented primary white-label pair is 4.82:1; sidebar white is 11.67:1; success, danger, warning, info, and role pairs are ≥6.15:1. Disabled text is not faded.

## 4. Component inventory

| Task 1 name | Screens | Variants and states in Task 4 | Change status |
|---|---|---|---|
| Button | Login, Register, Home, User list, dialog, confirmations | Primary, secondary, danger, ghost, icon; 32/40/48px sizes; default, hover, focus, disabled, loading | Existing component; no new variant. Mobile hit areas are at least 44px. |
| Text input / password input | Login, Register, dialog | Text, search, password; default, focus, validation error, disabled, loading | Existing; Register combines the existing password input with a checklist composition. |
| Checkbox | Login, User list | Checked, unchecked, indeterminate, focused | Existing. |
| Select | User list, dialog | Role/status/filter; default and focused | Existing. |
| Status badge and role pill | Home, User list, dialog | Active, Inactive, Blocked, Deleted; Superadmin, Admin, User | Existing. |
| Data table | User list | Default, hovered, selected, blocked, deleted, loading, empty, error; sortable headers, selection, pagination | Existing; mobile uses the Task 3 stacked-card composition. |
| Modal / dialog | Add/Edit/View; confirmations | Right-anchored form panel, read-only view, destructive confirmation; default, focus, validation, loading, error, unsaved warning | Existing dialog pattern composed as a right-side panel per Task 3; no new component. |
| Sidebar navigation item | Home, User list | Default, hover, active, disabled; desktop expanded, tablet compact, mobile drawer | Existing. |
| Quick Action card | Home | Role-appropriate enabled cards and disabled User Management item; default, hover, focus | Existing. |
| Toast, alert, inline form error | All relevant flows | Success, info, error; field-linked error; live-region status | Existing. |
| Loading skeleton | Home, User list | Greeting/action and table-row skeletons with stable layout | Existing Data table/loading pattern; no new component. |
| Toast viewport | Login, Register, Home, User list, dialog | Top-right region below top bar; success, info, error samples | Existing Toast component/pattern; placement and timing are Task 4 proposals. |
| Register password checklist/strength display | Register | Meets 8 characters, mismatch, loading, error | Composition using existing input, text, and status patterns; **changed/expanded for Task 4** due to conflict with Task 2 Register flow. |
| Inline icon glyphs | All screens | Consistent 16px/20px stroke symbols, always paired with a label or accessible name | **Gap/proposal:** no licensed family is in the repository. Inline SVG glyphs are preview-only until a family is approved. |

## 5. Layout specifications

| Area | Desktop 1440px | Tablet 768px | Mobile 375px |
|---|---|---|---|
| Page/app shell | 256px expanded sidebar; remaining content; 32px content gutters; content max-width 1200px | 72px compact sidebar / Task 1 drawer behavior at the 768px breakpoint; 24px gutters | Sidebar hidden behind 44px menu trigger; open state is a full-height dismissible drawer; 16px gutters |
| Main content | Centered in available content area, max 1200px | Full available width | Single column, no horizontal page overflow |
| Home quick actions | Two equal columns | Two equal columns where each card remains readable | One column |
| User table | Full table; columns: selection 44px, Name 180px, Email 220px, Role 120px, Status 120px, Created 150px, Last edited 160px, Actions 64px; horizontal scroll if needed | Keep semantic table and headers; horizontal scroll, never compress required copy | Use Task 3 stacked cards; Name/Role/Status first, other fields below; 44px actions |
| User list toolbar | Tabs, search, role filter, add action aligned on a wrapping toolbar | Wrap toolbar and horizontally scroll tabs | Search/filter stack; tabs scroll horizontally |
| Auth card | max-width 440px; 24px padding | max-width 440px; 24px padding | Full width within 16px page gutters; 16px padding |
| Right-side panel | 480px wide, fixed to right, body scrolls | 420px wide, fixed to right | Full-screen panel; sticky header/footer; body scrolls |
| Centered confirmation | Width 440px max | Width min(440px, viewport - 48px) | Full width minus 32px outer gutter; safe action initially focused |
| Breakpoints | 1280px wide layout; 1024px compact/condensed navigation | 768px drawer/tablet mode | 480px single-column controls and near-full-screen dialogs |

## 6. Interaction and motion notes

- Dialog open moves focus to the title/first field, traps Tab/Shift+Tab, closes with Escape unless saving or unsaved changes need confirmation, and returns focus to the invoking control. Backdrop click never discards edits.
- Dialog body scrolls independently; header and footer remain sticky. At mobile the panel is full-screen with the same sticky footer.
- Unsaved changes show `Discard your changes? Your edits haven’t been saved.` Actions: `Keep editing` / `Discard changes`. Escape invokes the same guard.
- Destructive confirmation initially focuses `Cancel`, keeps the safe action first, names the record/count, and prevents duplicate submission while loading.
- Desktop sidebar is expanded; tablet uses the compact navigation/drawer pattern; mobile starts closed behind `Open menu`, with a separate open-drawer state. Selecting a destination closes it.
- Search gives immediate local feedback and debounces remote queries by 250ms. Clear filters clears search, role filter, and sort to All/default sort.
- Changing tab, search, role filter, sort, or page clears selection. Selection is page-scoped and only includes eligible records. After a successful action, update the row/counts, clear selection, and keep the current tab if possible.
- Toasts appear at the top-right of the app content region, below the top bar. Success remains for 6 seconds and can be dismissed. Info remains for 8 seconds and can be dismissed. Errors remain until dismissed/resolved. Important account/permission context uses persistent alerts rather than transient toast.
- Hover/focus transitions use 160ms ease-out for color/border/shadow only; no layout shift. Loading skeletons use a 1200ms opacity pulse only when motion is allowed. `prefers-reduced-motion: reduce` disables transitions and animation without hiding state.

## 7. Behavior and validation rules

- Login validates on blur, then revalidates on input after the first error. Invalid credentials use the same privacy-safe message whether the email is unknown or password is wrong. Inactive/Blocked status is disclosed only after identity verification.
- Register follows the explicit Task 4 form request: First name, Last name, Email, Password, Confirm password. Validate required fields/email on blur and revalidate on input after first error. Password checklist requires at least 8 characters and matching confirmation; strength label is length-based only. Keep values after errors. Public registration still submits a User/Inactive request and does not grant ERP access.
- Task 2 says Register has no password and post-approval Set Password flow. That prior flow is not included in this Task 4 mockup; see Changes/Open questions.
- Add user requires First name, Last name, Email address, Temporary password, and Role. Password is 8–128 chars per Task 3. Superadmin may choose User or Admin; Admin role is fixed to User. Review-and-create confirmation precedes submission; created account is approved immediately and requires a password change at first sign-in.
- Edit validates on blur, then on input after the first error. Duplicate email is a server error; preserve other fields. On save error, keep the panel open and values intact.
- Search by name/email, debounce remote results 250ms, show result count, and preserve filters on load failure. Sort default is Last edited, newest first. Sortable Name, Email, Role, Status, Created, Last edited expose sort direction and `aria-sort`.
- Status tab counts come from the authorized result set and update after successful actions. Deleted is a soft-delete view. Restore returns a record to its previous status.
- Bulk actions only affect eligible rows; show the eligible count before confirmation. Clear selection after success. Admin cannot mutate Admin/Superadmin records. No role can block/delete its own account.
- Skeletons retain toolbar/header structure and announce loading. Errors retain filter values and provide Retry. Empty/no-access states always have a clear next action.

## 8. Role permission matrix

| Screen/action | Superadmin | Admin | User |
|---|---|---|---|
| Login/Register | Can sign in; public registration creates User/Inactive request | Same | Same |
| Approve new registration | Yes, if account is approved | Yes, if account is approved | No |
| Home | Home, Add User/Admin, View users | Home, Add User, View users | Home; no management actions |
| User Management navigation | Enabled | Enabled | Disabled with explanation |
| Direct User Management URL | Full authorized list | Authorized list; Admin/Superadmin rows view-only | No data; the no-access state offers Back to Home |
| Add account | User or Admin; immediate approval; temporary password | User only; immediate approval; temporary password | No |
| View account | All roles | All roles | No |
| Edit account | All users | Users only | No |
| Block/Unblock | Any user except self | Users except self | No |
| Soft-delete/Restore | Any user except self | Users except self | No |
| Bulk actions | Eligible selected records | Eligible Users only; report eligible count | No |
| Own account | Cannot block/delete self | Cannot block/delete self | User Management unavailable |
| Read-only Admin/Superadmin record | Edit if otherwise allowed | View only; no mutation controls | No access |

Admin and Superadmin approvals are independent alternatives; both are not required. Authorization must be enforced server-side, not inferred from hidden UI controls.

## 9. Data fields

| Field | Type | Required | Allowed values / notes |
|---|---|---:|---|
| `first_name` | string | Yes | 1–80 characters; Task 2 registration and Task 3 Add. |
| `last_name` | string | Yes | 1–80 characters; Task 2 registration and Task 3 Add. |
| `email` | email string | Yes | Normalized lowercase; unique per account. |
| `password` | secret string | Register: Task 4 mock only | At least 8 characters in the checklist. Actual public registration password flow conflicts with Task 2; no raw password stored in application profile. |
| `confirm_password` | secret string | Register: Task 4 mock only | Must match password; not persisted. |
| `temporary_password` | secret string | Add user | 8–128 chars per Task 3; shown only to creator for secure sharing; not persisted in profile. |
| `role` | enum | Yes | `superadmin`, `admin`, `user`; new public registration is always `user`; client input never sets registration role. |
| `status` / `approval_status` | enum | Yes | Account values Active/Inactive/Blocked (implementation values may be `active`, `pending`, `blocked`). Public new accounts are Inactive/pending. Deleted is separate soft-delete metadata. |
| `deleted_at` | timestamp/null | No | Null until soft delete; restore clears deletion marker and preserves prior status. |
| `created_at` | timestamp | Yes | Displayed as localized date/time. |
| `created_by` | user ID/display name | Assumed | Audit stamp actor; confirm backend schema. |
| `updated_at` | timestamp | Yes | Displayed as Last edited; default sort descending. |
| `updated_by` | user ID/display name | Assumed | Audit stamp actor; confirm backend schema. |
| `deleted_by` | user ID/display name | No | Needed to render DELETED stamp; confirm backend schema. |
| `previous_status` | enum | Restore flow | Must be retained for restore; confirm backend schema/soft-delete model. |

Audit display is `CREATED / EDITED / DELETED · {user} · {date}`. Role/status labels must not be inferred from colors.

## 10. Final microcopy table

| Context | Exact copy |
|---|---|
| Login title/helper | `Sign in to Hope`; `Welcome back. Sign in to continue.` |
| Login fields/actions | `Email`; `Password`; `Show password`; `Remember me`; `Forgot password?`; `Sign in`; `Continue with Google`; `Request access` |
| Login validation | `Enter your email address.`; `Enter a valid email address.`; `Enter your password.`; `Check the highlighted fields.` |
| Invalid credentials | `We couldn't sign you in with those details. Check your email and password, then try again.` |
| Inactive account | `Your account is pending Admin or Superadmin approval. You can sign in after it is approved.` |
| Blocked account | `This account can't sign in right now. Contact your administrator for help.` |
| Temporary lockout | `Sign-in is temporarily locked. Try again later or contact support.` |
| Loading/session | `Signing in…`; `Your session expired. Sign in again to continue.` |
| Register title/helper | `Request access`; `Create your Hope account. New requests need Admin or Superadmin approval.` |
| Register fields/actions | `First name`; `Last name`; `Email`; `Password`; `Confirm password`; `Register`; `Already have an account? Sign in` |
| Password checklist | `At least 8 characters`; `Passwords match`; `Strength: Add a password` / `Strength: Good` |
| Register errors | `Enter your first name.`; `Enter your last name.`; `Enter a valid email address.`; `Password must be at least 8 characters.`; `Passwords don't match.` |
| Existing email | `We couldn't complete this request. If you already have an account, sign in or reset your password. Otherwise check the email and try again.` |
| Register loading/success | `Submitting request…`; `Request submitted`; `Your request is pending Admin or Superadmin approval. We’ll email you after it’s reviewed.` |
| Home header | `Home`; `Good morning, {first name}.`; `Choose an action to get started.` |
| Home actions | `Add user`; `View users`; `Create a User or Admin account with a temporary password.`; `Create a User account with a temporary password.` |
| User Home | `No management shortcuts are available for your role.`; disabled nav reason: `You don’t have access to User Management.` |
| Home loading/empty | `Loading your home page…`; `There’s nothing to show yet. You can still use the actions available to your role.` |
| Shared app controls | `Open menu`; `Close menu`; `{name} · {role}`; `Log out`; `Home`; `User Management` |
| User Management header | `User Management`; `View and manage Hope accounts.`; `Add user` |
| Tabs | `All`; `Active`; `Inactive`; `Blocked`; `Deleted`; counts follow the label |
| Search/filter/sort | `Search users`; `Search by name or email`; `Role`; `All roles`; `Clear filters`; `Sort by Last edited, newest first`; mobile sort options `Last edited, newest first`, `Created, newest first`, `Name, A to Z` |
| Table headings | `Name`; `Email`; `Role`; `Status`; `Created`; `Last edited`; `Actions` |
| Row menu | `Actions for {name}`; `View`; `Edit`; `Block`; `Unblock`; `Delete`; `Restore` |
| Bulk bar | `{n} selected`; `Block`; `Delete`; `Clear selection`; `Select all eligible rows on this page` |
| Loading/empty/error | `Loading users…`; `No users yet. Add a user to get started.`; `No users match your search. Try a different name or email, or clear your filters.`; `No {status} users. Choose another status or clear your filters.`; `We couldn’t load users. Check your connection and try again.`; `Try again` |
| Pagination | `Rows per page`; `Previous`; `Next`; `Showing {start} to {end} of {total}` |
| No access/self-protection | `You don’t have access to User Management. Ask a Superadmin if you need access.`; `Back to Home`; `You can’t block or delete your own account.` |
| Panel headings/actions | `Add user`; `Edit user`; `User details`; `Cancel`; `Review and create`; `Create account`; `Save`; `Close`; `Edit` |
| Panel helper/permission copy | `Create an approved account with a temporary password.`; `Update this account's details.`; `Account details and audit history.`; `Admin may create Users. Superadmin may create Users or Admins.`; `You can view this Admin account, but only a Superadmin may edit it.` |
| Add fields | `First name`; `Last name`; `Email address`; `Temporary password`; `Role`; `User`; `Admin` |
| Edit/view fields | `Full name`; `Email`; `Role`; `Status`; `Active`; `Inactive`; `Blocked` |
| Validation | `Enter a first name (maximum 80 characters).`; `Enter a last name (maximum 80 characters).`; `Enter the user's email address.`; `Enter a valid email address.`; `This email is already in use. Enter a different email address.`; `Temporary password must be between 8 and 128 characters.`; `Check the highlighted fields.` |
| Panel save states | `Creating account…`; `Saving…`; `Saving user…`; `We couldn’t save this user. Check your connection and try again.`; toast `User saved`; toast `Account created`; `Share the temporary password securely. The user must change it at first sign-in.` |
| Add confirmation | `Create this account?`; `{name} will be created as an approved {role}. They must change the temporary password at first sign-in. Share the temporary password securely.` |
| Unsaved warning | `Discard your changes? Your edits haven’t been saved.`; `Keep editing`; `Discard changes` |
| Audit stamps | `CREATED · {user} · {date}`; `EDITED · {user} · {date}`; `DELETED · {user} · {date}` |
| Delete confirmation | `Delete user?`; `{name} ({email}) will be soft-deleted. The record stays in Deleted and can be restored.`; `Cancel`; `Delete user` |
| Block confirmation | `Block user?`; `{name} ({email}) won’t be able to log in until the account is unblocked.`; `Cancel`; `Block user` |
| Unblock confirmation | `Unblock user?`; `{name} will be able to sign in again if the account is Active.`; `Cancel`; `Unblock user` |
| Restore confirmation | `Restore user?`; `{name} will return to the user list with the previous account status.`; `Cancel`; `Restore user` |
| Bulk confirmation | `Delete {n} users?`; `These records will be soft-deleted and can be restored from Deleted.`; `Block {n} users?`; `These users won’t be able to log in until their accounts are unblocked.` |
| Confirmation async/error | `Deleting…`; `Blocking…`; `Unblocking…`; `Restoring…`; `We couldn’t complete this action. Try again.` |
| Toasts | Success `User saved`; info `Selection cleared because the list changed.`; save error `We couldn’t save this user. Check your connection and try again.`; action error `We couldn’t complete this action. Try again.` |

## 11. Accessibility checklist

- [x] Persistent visible labels above every input; placeholders are examples, not labels.
- [x] Field errors are adjacent, text-based, and associated with inputs using `aria-describedby`; invalid controls use `aria-invalid`.
- [x] Keyboard order follows visual order. A visible 2px `--color-focus` ring appears in examples on Login, Register, Home, list, and dialog controls.
- [x] Dialog behavior specifies focus entry, focus trap, Escape, unsaved-change guard, and focus return.
- [x] Row action menus have accessible names `Actions for {name}`; icon-only controls have names/tooltips.
- [x] Toasts use polite live announcements; important errors persist. Loading uses `aria-busy` and an announced status.
- [x] Mobile buttons, links, menu controls, checkboxes, and row actions target at least 44×44px.
- [x] Status badges and role pills pair labels with icons; color is never the sole signal.
- [x] Normal text/background pairs meet ≥4.5:1; large text/control boundaries/focus meet ≥3:1 using Task 1 contrast pairs.
- [x] Tables use semantic header cells, visible sort direction, `aria-sort`, and an accessible selection checkbox label.
- [x] Sidebar drawer has `Open menu`/`Close menu`; disabled User Management explains why.
- [x] Reduced motion removes nonessential transitions/pulses without removing status.

## 12. Assets

- Icons are inline SVG previews using one consistent 1.75px rounded-stroke style: `home`, `users`, `menu`, `close`, `search`, `filter`, `sort`, `sort-up`, `sort-down`, `plus`, `left`, `right`, `more`, `check`, `minus`, `lock`, `trash`, `undo`, `alert`, `info`, `success`, `eye`, `mail`, `key`, `user`, `clock`, `logout`, `spinner`.
- Task 1 requires a licensed icon family already in the project or a deliberate selection before implementation; none is defined in the repository. Treat these inline icons as mockup assets only and replace with the approved family when selected.
- No standalone logo or font file exists in Task 4 scope. The HTML uses a text wordmark and the Task 1 Inter/system fallback stack. Developers should load Inter through the project's approved/self-hosted font setup; no external runtime dependency is introduced here.

## 13. Suggested build order and acceptance criteria

1. **Foundation and shell:** Load Task 1 tokens/type, build responsive app shell/sidebar/top bar. Pass when desktop shows 256px sidebar, tablet compact/drawer behavior, and mobile menu opens/closes without overflow.
2. **Auth forms:** Build Login and Register from approved fields and states. Pass when blur/input validation, privacy-safe login error, account status notices, lockout, loading, session expiry, register password checklist, and request confirmation match this handoff.
3. **Home:** Add role-aware greeting and Quick Actions. Pass when Superadmin/Admin/User see only their permitted actions and loading/empty states retain navigation.
4. **User list:** Build tabs/counts, search/filter, semantic sortable table, row menu, selection/bulk actions, pagination, mobile cards. Pass when state changes clear selection appropriately and Admin cannot mutate Admin/Superadmin records.
5. **Dialog and confirmations:** Build Add/Edit/View side panel and confirmations. Pass when focus management, validation, sticky footer, save/error/loading, unsaved warning, safe initial focus, self-protection, and restore semantics work.
6. **Feedback/accessibility QA:** Add toasts/live regions and test at 1440px, 768px, 375px plus keyboard and reduced motion. Pass when no text clips/overflows, contrast meets ratios, and all empty/error/no-access states provide a next action.

### Testable acceptance checklist

- [ ] Every listed screen/state appears at desktop 1440px, tablet 768px, and mobile 375px.
- [ ] Login shows all 9 requested states; inactive/blocked states only follow verified identity; invalid-credential text is privacy-safe.
- [ ] Register shows all 8 requested states and password checklist/strength/mismatch; its divergence from Task 2 is approved before implementation.
- [ ] Main page includes Superadmin/Admin/User variants, all navigation states, loading, empty, tablet icons, and mobile closed/open menu.
- [ ] User list includes all specified toolbar, status, row, checkbox, bulk, pagination, mobile, skeleton, empty, no-access, and error states.
- [ ] Dialog includes Add/Edit/View, focus, validation, create/edit saving, save success/error, unsaved warning, read-only mode, audit stamps, and Delete/Block/Unblock/Restore confirmations.
- [ ] No user-facing content is clipped or horizontally overflows its page/artboard at the three requested widths.
- [ ] Icons are consistent; every role/status has text; no color-only state exists.
- [ ] Toasts, focus, contrast, mobile target size, keyboard flow, reduced motion, and dialog focus management pass the checklist.
- [ ] Server-side role permissions and audit data match the displayed permission matrix.

## Changes from wireframes

- **Register:** Task 4 explicitly requires Password, Confirm password, password rules/strength, and password-mismatch states. Task 2 says Register collects First name, Last name, and Email only, and password is set after approval. This mockup follows the Task 4-only scope for the visual Register form and preserves the User/Inactive request-for-access outcome. Product owner must confirm which flow is authoritative before implementation.
- Password checklist follows the Task 2 approved minimum of 8 characters; it does not add length/character classes not in Task 2. Strength is a simple presentation of that single rule and matching confirmation.
- Main page and User Management follow Task 3's role variants, account creation rules, soft delete, mobile cards, and no-speculative-modules decisions. No other approved wireframe structure or microcopy is intentionally changed.

## Gaps found in Task 1

- **Icon family:** Task 1 says to use a licensed family already present, or select one before implementation, but the project contains no approved family. This HTML uses consistent inline SVG previews. Smallest addition: select/license one stroke family and map the listed icon names to it.
- **Toast/alert placement and timing:** component anatomy/behavior exists, but no exact placement/duration is tokenized. Task 4 proposes top-right below top bar, 6s success, 8s info, persistent errors; confirm with product/accessibility before shipping.
- **Overlay color:** Task 1 defines dialog shadow but no overlay token. Mockup uses a tint derived from `--color-sidebar` with opacity; smallest addition is a named overlay token if the implementation requires a reusable value.
- **Password strength visualization:** no Task 1 component exists. Mockup is a checklist/text strength composition; use no additional color or new component until approved.
- **Task 3-created temporary passwords:** temporary credential sharing and forced change behavior are product requirements, but backend fields/storage and secure sharing channel are not specified.

## Open questions

1. Should Register include a password, or should the Task 2 name/email request flow remain authoritative with password setup after approval? This is a blocking product decision because Task 4 and Task 2 conflict.
2. Confirm lockout threshold, duration, and recovery path; Task 4 requests a lockout state but Task 2 leaves policy pending.
3. Confirm whether Admin and Superadmin approval remains either/or for new registration; the latest Task 2 update says either approved role can approve.
4. Confirm status backend values and mapping: UI Active/Inactive/Blocked vs database `approved`/`pending`/`blocked`.
5. Confirm whether `deleted_at`, `deleted_by`, `previous_status`, `created_by`, and `updated_by` exist or require a schema change.
6. Confirm approved icon family/license, Inter delivery approach, and toast timing/placement.
7. Set account recovery/support destination and approval notification behavior.
8. Confirm the Superadmin-only ability to create Admin accounts and corresponding server-side implementation, which Task 3 identifies as a follow-up.

## Items not completed / limitations

- These are static, self-contained visual mockups, not interactive product forms. No authentication, account data, search, mutation, or live toast behavior is wired.
- The Login `Forgot password?` link points to this handoff reference because the recovery destination is not in the requested Task 4 screen list; replace that preview destination with the approved recovery flow in the application.
- The repository main branch does not contain a standalone project-context document; task role/status/module assumptions were taken from Task 2/3 and the main README.
- Final browser checks at 1440px, 768px, and 375px verified 60 states across 180 labeled artboards, zero page-width overflow, unique element IDs, named controls, and valid field/ARIA references. The mobile search placeholder fits its full field. Automated contrast checks for the documented text, role, status, focus, and action token pairs passed the stated Task 1 thresholds. These checks do not replace manual zoom, keyboard, screen-reader, and cross-browser review.
- Register-password conflict is not resolved by this design artifact; implementation should wait for product owner decision.
