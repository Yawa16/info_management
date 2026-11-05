# Hope, Inc. ERP — Task 5 Usability Review

## 1. Introduction and Summary

The purpose of this review is to check the built Hope, Inc. ERP screens
against the approved UI/UX requirements, identify usability and accessibility
issues, and provide developers with a prioritized fix list. It is a review
task: app code is not changed and issues are reported rather than fixed here.

This draft reviews the app available on `UI-UX-Task5`, based on `develop`
commit `b8bc4ea` (2026-11-04). The report author could not review authenticated
screens or roles, and trustworthy screenshot files could not be saved. A
developer separately reported checking the UI for Superadmin, Admin, and User
and finding no issues in the areas checked; the specific screens and actions
were not provided, so that feedback is recorded separately and is not treated
as a complete role-based review.

### Review summary

| Review item | Result |
|---|---|
| Public screens reviewed | Public landing page, Sign In, Register, and Reset Password request |
| Responsive sizes | 1440 × 900, 768 × 900, and 375 × 812 for each public screen |
| Other screens | Password update, set-password, dashboard, and user approvals could not be opened without an authenticated session |
| Roles independently tested for this report | None; no test credentials/accounts were supplied |
| Developer-reported role check | Superadmin, Admin, and User UI checked; no issues reported in the areas checked. Specific screens/actions and evidence were not provided. |
| Registration attempt | Submitted once; the app displayed “Registration is temporarily unavailable. Please contact support.” No successful registration was confirmed. |
| Findings | 1 High, 6 Medium, 1 Low |
| Screenshot files | None retained; the browser's file-export screenshots were visibly cropped/duplicated. See Method and environment. |

### Top five problems

1. Register requires a password before approval, contrary to Task 2's
   name/email-only access request and later password setup.
2. Empty Register fields show no field-linked error on blur; the approved
   validation summary and inline messages were not observed.
3. Auth-page field boundaries, placeholder text, and supporting text fall below
   the approved contrast thresholds.
4. The email focus state does not use the design system's high-contrast focus
   outline.
5. Login's initial focus and keyboard order do not follow the approved sequence.

## 2. Testing Methods and Environment

- Read `README.md` for setup and project context. No separate project-context
  specification was found. The Task 1 design-system Markdown and HTML style
  guide are on `develop`.
- Task 2 and Task 3 references were read from the `origin/UI-UX-Task3` branch
  because those files are not on `develop`:
  [Task 2 — Authentication wireframes](https://github.com/Yawa16/info_management/blob/UI-UX-Task3/docs/task-2-auth-wireframes.md)
  and
  [Task 3 — Main page and User Management wireframes](https://github.com/Yawa16/info_management/blob/UI-UX-Task3/docs/task-3-main-and-user-management.md).
- Task 4's mockup and handoff files are not present on `develop`, so they were
  not used as acceptance criteria.
- Started the local app with `npm run dev` at `http://localhost:3000`. The app
  loaded. `.env.local` existed; its contents were not inspected. A registration
  submission was attempted and returned “Registration is temporarily
  unavailable. Please contact support.” Environment-variable presence was
  checked without exposing values; `NEXT_PUBLIC_SITE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` were missing. No valid credentials, password-reset
  email, or OAuth action was used.
- Used the integrated Playwright browser at 1440 × 900, 768 × 900, and
  375 × 812. Checked visible page content, document width, controls, and
  anonymous redirects. At each size, the four public screens had no horizontal
  page overflow.
- Tested keyboard Tab order on Sign In. Measured text, field-boundary, and
  focus colors from computed browser styles and calculated WCAG contrast using
  relative luminance; ratios below are measured against the actual white form
  background.
- No screen-reader testing or external accessibility scanner was available.
  The report author did not test role-based or server-response states. A
  developer separately reported a role-based UI check; details and supporting
  evidence were not provided.
- Screenshot files are not included. `page.screenshot` exports from the
  integrated browser were visually clipped or duplicated even when the
  inspected DOM had the requested viewport dimensions. Those exports were
  removed rather than attached as misleading evidence. Consequently the
  screenshot requirement remains incomplete.

## 3. Testing Objectives

This review aims to:

- Check the reachable built screens at desktop, tablet, and mobile sizes.
- Compare observed behavior and presentation with the approved Task 1 to Task
  4 requirements that are available.
- Check keyboard usability, contrast, responsive layout, and microcopy.
- Record only observed defects, with steps, expected behavior, actual
  behavior, severity, and evidence.
- Give developers a prioritized fix list and clearly mark untested screens,
  roles, and states.

### Task 5 in plain language

Task 5 asks you to act like a UI/UX tester: use the real, built app; compare
what you can actually use with the approved designs; record problems with
clear evidence; and give developers a prioritized list of improvements. It is
a review, not a coding task. Do not repair the app as part of this task, and do
not claim a screen, role, or state was tested if you could not reach it.

The deliverables are:

1. A review report explaining what you tested, what worked, what issues you
   observed, and what you could not test.
2. A fix list with one recommended, testable fix for every reported issue.
3. Screenshots that support the findings you cite.

The draft findings are not a complete review yet. Continue the steps below
before treating the deliverables as ready to submit.

## 4. Step-by-Step Procedure for Completing Task 5

1. **Stay on the Task 5 branch.** Confirm the branch is `UI-UX-Task5` and that
   you are not working on `main` or `develop`. Keep changes limited to the Task
   5 report, fix list, and screenshot files.
2. **Gather the approved references.** Read the project context and Task 1 to
   Task 3 design documents. Task 4 mockups/handoff are not on `develop`, so
   note that limitation and use them only if your team confirms the Task 4
   branch is the approved source. Resolve conflicting approval wording with
   the product owner or instructor rather than guessing.
3. **Prepare a safe test environment.** Follow the README and ask the DB Admin
   for test accounts or seed data in the approved development Supabase project.
   The current local registration is blocked because `.env.local` is missing
   `NEXT_PUBLIC_SITE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Ask the DB Admin or
   project owner to configure those locally from the approved development
   credentials. Do not paste keys into chat, screenshots, source code, or Git.
   Do not use production accounts or submit real personal data.
4. **Start the app and confirm it is healthy.** Run `npm run dev`, open the
   local URL from the terminal, and check the README's health endpoint if the
   development database is configured. If setup, login, or a route is blocked,
   record the exact blocker and mark those screens/states “Not reviewed”.
5. **Make a route checklist.** Visit each built route from the Route table in
   this report. Distinguish public routes, redirect aliases, protected pages,
   forms, API routes, and callbacks. Do not count a redirect as a review of
   the destination's protected screen.
6. **Test each reachable UI at all three sizes.** Use viewport widths 1440px,
   768px, and 375px. For every actual screen, check for clipped text, overlap,
   horizontal scrolling, controls outside the viewport, and responsive
   navigation/table/dialog behavior. Record the exact size for each finding.
7. **Test roles and states without guessing.** With approved test accounts,
   sign in separately as Superadmin, Admin, and User. For every role, try only
   the actions permitted by the Task 3 matrix and verify forbidden actions are
   blocked. Test states that can be reached safely: default, keyboard focus,
   validation, loading, empty, error, and success. Do not create/delete/block
   real accounts or send real emails without permission.
8. **Check accessibility and design details.** Use keyboard navigation,
   inspect visible labels and announced errors, check focus handling, touch
   target sizes, heading/table semantics, and text size. Measure text contrast
   against its actual background; do not estimate. Compare colors, typography,
   spacing, radii, shadows, and component behavior to the relevant Task 1 to
   Task 4 section.
9. **Capture evidence as you test.** Save a reasonably small screenshot for
   each issue that needs visual evidence, using descriptive names such as
   `login-focus-375.png`. Verify that each saved image shows the actual route,
   viewport, and problem before referencing it. If screenshots cannot be
   captured reliably, say so and do not cite nonexistent files.
10. **Write only observed findings.** For each issue, record its ID, screen,
    state, role, viewport, reproducible steps, expected behavior with a
    document/section reference, actual behavior, severity, heuristic or WCAG
    criterion, and screenshot filename if available. Put uncertain items under
    “Needs confirmation,” not in the issue totals.
11. **Prioritize the fixes.** Use the exact Critical / High / Medium / Low
    definitions in the task brief. In the fix list, order by severity and then
    effort, recommend existing approved tokens/components, and give every row
    a testable acceptance check. Each review issue ID must appear exactly once
    in the fix list, with no extra IDs.
12. **Do the final check before asking to publish.** Confirm all built screens
    are either reviewed at all three sizes or marked Not reviewed with a
    reason; compare issue IDs and totals between the two reports; verify cited
    screenshots exist; and run `git status`. Only the Task 5 deliverables
    should be listed. Then show the status and ask before committing or pushing.

## 5. Scope and Routes Reviewed

Routes are listed as paths rather than App Router route-group names.

| Route | Source | Review status |
|---|---|---|
| `/` | `app/page.tsx` | Reviewed as the public landing page at all three sizes. This is not the authenticated Task 3 Home screen. |
| `/login` | `app/login/page.tsx` | Reviewed at all three sizes: default screen, keyboard order, and focus styling. Wrong credentials, pending/blocked notices, loading, and successful sign-in were not tested. |
| `/sign-in` | `app/(auth)/sign-in/page.tsx` | Source-inspected redirect to `/login`; not a separate screen. |
| `/register` | `app/register/page.tsx` | Reviewed at all three sizes: default screen and empty-field focus/blur behavior. No valid registration data was submitted. |
| `/reset-password` | `app/reset-password/page.tsx` | Reviewed at all three sizes: default request screen. No email was submitted. |
| `/reset-password/update` | `app/reset-password/update/page.tsx` | Opened without a recovery session; redirected to `/reset-password?notice=invalid-link`. The password-update screen itself was not reviewed. |
| `/set-password` | `app/set-password/page.tsx` | Redirected to `/login` without a password-change session; screen not reviewed. |
| `/dashboard` | `app/(protected)/dashboard/page.tsx` | Redirected to `/login` without an approved session; screen not reviewed. |
| `/users` | `app/(protected)/users/page.tsx` | Redirected to `/login` without an approved Admin/Superadmin session; screen not reviewed. |
| `/auth/callback` | `app/auth/callback/route.ts` | Authentication callback, not a screen; not exercised without a valid callback/session. |
| `/api/health` | `app/api/health/route.ts` | API endpoint, not a screen; not called. |

The Task 3 right-side Add/Edit/View panel, confirmation dialogs, full User
Management table, and mobile cards were not visually accessible in this
session. The checked-in `/users` page source contains a pending-approval list
and create-user form; whether other UI is available behind a role-specific
state needs confirmation.

## 6. Findings by Screen

### UX-001 — Register collects a password before approval

- **Screen / state:** Register, default
- **Role:** Unauthenticated visitor
- **Size:** 1440 × 900, 768 × 900, and 375 × 812
- **Severity:** High
- **Heuristic:** Consistency and standards; error prevention
- **Steps:** Open `/register` and inspect the required fields.
- **Expected:** Task 2, “Screen 2 — Register” and “What happens after
  registration”: First name, Last name, and Email only; password setup follows
  approval. The task brief also identifies Task 2's name/email-only request
  flow as the reference.
- **Actual:** A required Password field is shown on Register, with an
  eight-character minimum. This asks for a password before the access request
  is approved.
- **Evidence:** No trustworthy screenshot file retained; see Method and
  environment.

### UX-002 — Auth typography is smaller than the approved system

- **Screen / state:** Login, Register, and Reset Password request, default
- **Role:** Unauthenticated visitor
- **Size:** All three requested sizes; representative measured at 375 × 812
- **Severity:** Medium
- **Heuristic / criterion:** Consistency and standards; Task 1 typography
  requirements
- **Steps:** Open each public auth route and inspect labels, links, helper text,
  and button labels.
- **Expected:** Task 1 design system §3 and the style guide's typography
  samples specify Inter with Arial fallback, 12px minimum readable small
  text, 14px body/control text, and 14px button labels.
- **Actual:** The page uses Arial without Inter. At 375px, auth field labels
  are 11px, the Forgot password link is 10px, footer copy is 11px, and the
  primary button label is 13px. These differ from the approved scale.
- **Evidence:** No trustworthy screenshot file retained; see Method and
  environment.

### UX-003 — Register has no field error on blur

- **Screen / state:** Register, empty First name field after focus then blur
- **Role:** Unauthenticated visitor
- **Size:** 375 × 812
- **Severity:** Medium
- **Heuristic / criterion:** Error prevention and error recovery; WCAG 2.2
  3.3.1 Error Identification
- **Steps:** Open `/register`, focus First name, then move focus to Last name
  without entering a value.
- **Expected:** Task 2, “Shared layout and interaction rules” and “Screen 2 —
  Register”: validate on blur, show a field error, and associate it with the
  field. After an error first appears, revalidate on input.
- **Actual:** First name remains `aria-invalid="false"` with no
  `aria-describedby`, visible field error, or alert after blur. The input has
  a native required constraint, but the specified on-blur feedback was not
  shown.
- **Evidence:** No trustworthy screenshot file retained; see Method and
  environment.

### UX-004 — Auth text and field boundaries do not meet contrast requirements

- **Screen / state:** Login, default
- **Role:** Unauthenticated visitor
- **Size:** 375 × 812 (the same auth styles are used at desktop and tablet)
- **Severity:** Medium
- **Heuristic / criterion:** WCAG 2.2 1.4.3 Contrast (Minimum) and 1.4.11
  Non-text Contrast; Task 1 §2
- **Steps:** Open `/login` and inspect the email field, placeholder, helper,
  Forgot password link, and footer.
- **Expected:** Task 1 §2 and the style guide: normal text at least 4.5:1 and
  meaningful control boundaries at least 3:1.
- **Actual:** Measured against the white form background: email placeholder
  2.00:1; helper 3.73:1; footer 3.52:1; Forgot password link 4.43:1; default
  input border 1.26:1. The input boundary uses `#E2E6DF` rather than the
  approved `--color-border` (`#8D9188`).
- **Evidence:** No trustworthy screenshot file retained; measured browser
  styles are recorded above.

### UX-005 — Email focus indicator is too low-contrast

- **Screen / state:** Login, Email focused
- **Role:** Unauthenticated visitor using keyboard
- **Size:** 375 × 812
- **Severity:** Medium
- **Heuristic / criterion:** Visibility of system status; WCAG 2.2 2.4.11
  Focus Appearance; Task 1 shared interaction states
- **Steps:** Open `/login`, focus Email with the keyboard, and inspect its
  border and focus treatment.
- **Expected:** Task 1 requires a 2px `--color-focus` (`#245B4B`) outline with
  a 2px offset; the documented contrast on white is 7.86:1.
- **Actual:** The field has no outline. Its 1px focus border measures 2.84:1;
  its translucent shadow measures 1.15:1 against white. Both are below the
  3:1 meaningful-focus threshold, and the treatment is not the approved focus
  token.
- **Evidence:** No trustworthy screenshot file retained; computed focused
  styles and contrast are recorded above.

### UX-006 — Auth links and checkbox miss the mobile hit-area target

- **Screen / state:** Login, Register, and Reset Password request, default
- **Role:** Unauthenticated visitor
- **Size:** 375 × 812
- **Severity:** Medium
- **Heuristic / criterion:** Flexibility and efficiency; Task 2 shared-layout
  rule for 44 × 44px mobile hit areas
- **Steps:** Open each auth route at 375px and inspect small actionable
  controls.
- **Expected:** Task 2 requires at least 44 × 44px hit areas for links and
  checkboxes on mobile.
- **Actual:** Login's Forgot password link is 80 × 15px; its Remember me label
  is 94 × 17px around a 14 × 14px checkbox; Register is 44 × 13px; and the
  support link is 87 × 11px. The primary Sign In button (327 × 46px) and Show
  password button (51 × 45px) meet the height target.
- **Evidence:** No trustworthy screenshot file retained; measured browser
  bounds are recorded above.

### UX-007 — Login focus and Tab order differ from the approved sequence

- **Screen / state:** Login, initial load and keyboard navigation
- **Role:** Unauthenticated visitor using keyboard
- **Size:** 375 × 812
- **Severity:** Medium
- **Heuristic / criterion:** Consistency and standards; WCAG 2.2 2.4.3 Focus
  Order
- **Steps:** Reload `/login`; press Tab repeatedly and note the focused
  control.
- **Expected:** Task 2, “Shared layout and interaction rules” and “Screen 1 —
  Login”: initial focus Email; sequence Email → Password → Show/Hide →
  Remember me → Reset-Password? → Sign In.
- **Actual:** Initial focus is the document body. Tab first reaches the Home
  brand link; after Email it reaches Forgot password before Password.
- **Evidence:** No trustworthy screenshot file retained; the keyboard sequence
  was recorded during browser testing.

### UX-008 — Auth headings and helper copy differ from Task 2

- **Screen / state:** Login, Register, and Reset Password request, default
- **Role:** Unauthenticated visitor
- **Size:** 1440 × 900, 768 × 900, and 375 × 812
- **Severity:** Low
- **Heuristic:** Match with real world; consistency and standards
- **Steps:** Open the public auth routes and compare the visible heading,
  helper, and secondary link copy with Task 2.
- **Expected:** Task 2 screens specify Login heading `Sign In`; Register
  heading `Register` and helper `Request access to Hope.`; and Reset Password
  heading `Reset-Password?` with conditional, privacy-neutral helper text.
- **Actual:** The app displays `Welcome back` / `Sign in to your Hope, Inc. ERP
  account`, `Create your account` / `Join Hope, Inc. ERP`, and `Reset password`
  / `We’ll send you a secure link to reset it`. The intent is understandable,
  but the strings and framing do not match the approved wireframe copy.
- **Evidence:** No trustworthy screenshot file retained; see Method and
  environment.

## 7. What Works Well

- The four public screens loaded at all three requested widths without
  horizontal page overflow.
- A developer reported no UI issues in the Superadmin, Admin, and User areas
  they checked. The specific screens and actions were not supplied, so this is
  informal, unverified feedback rather than evidence that all role-specific
  flows passed.
- Auth fields have visible labels, email/password input types, and useful
  autocomplete values. The password visibility control has a descriptive
  accessible name.
- The main submit buttons and password visibility button have at least 44px
  height on mobile.
- Anonymous visits to `/dashboard`, `/users`, and `/set-password` returned to
  `/login`; protected content was not displayed in the tested session.
- The app does not expose a user-existence message on the default Reset
  Password screen. The actual submitted-response state remains unverified.

## 8. Needs Confirmation and Open Questions

1. **Approval policy conflict:** The Task 5 brief says an approved Admin or
   Superadmin can approve registration. The Task 2 wireframe source on
   `origin/UI-UX-Task3` contains wording that says Superadmin-only in one
   section and both Admin and Superadmin in another. README and the current
   Register note say Admin or Superadmin. Confirm whether either approved role
   is sufficient before treating all copy as final.
2. **Authenticated screens:** The developer reported checking the UI for
   Superadmin, Admin, and User and finding no issues in the areas checked, but
   did not provide the specific screens or actions. Confirm that coverage and
   provide safe test accounts or a seeded development environment if more
   testing is needed. The Home role variants, pending approvals, full User
   Management, search, filters, row/bulk actions, pagination, dialogs,
   confirmation flows, and permission denials remain unverified by this
   report.
3. **Password screens:** A valid recovery session and a `must_change_password`
   account are needed to review `/reset-password/update` and `/set-password`,
   including password rules, mismatch, loading, and success states.
4. **Authentication outcomes:** Wrong credentials, pending/blocked account
   notices, Google OAuth, and reset-email responses were not tested. No
   credentials were supplied, and submitting forms could reach the configured
   Supabase project.
5. **Task 3 Home and User Management implementation:** Source inspection shows
   `/dashboard` is a static welcome/sign-out screen. `/users` contains a
   pending-approval list and create-user form, rather than the Task 3
   role-aware management table and dialogs. Because both routes redirect
   without an authenticated role, treat this as a source-based observation
   requiring confirmation, not a scored visual finding.
6. **Screenshots:** Provide a browser session or screenshot method that writes
   accurate viewport captures into the workspace to complete the required
   evidence folder.

## 9. Conclusion

The public landing, Sign In, Register, and Reset Password request screens were
reviewed at the requested sizes. The review found eight issues: one High, six
Medium, and one Low. A developer separately reported no UI issues in the
Superadmin, Admin, and User areas they checked, but the specific scope was not
provided and the result was not independently verified. Other role-specific
and authenticated flows remain unverified, and screenshot evidence is
incomplete. Complete the follow-up steps and verify all findings and
screenshots before submitting this review as final.
