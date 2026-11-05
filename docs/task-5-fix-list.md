# Hope, Inc. ERP — Task 5 Fix List

## 1. Introduction

This fix list records recommended changes from the Task 5 usability review.
It is a report only; no application code has been changed. Each issue from
the review has exactly one corresponding row below, prioritized by severity
and estimated effort.

See the
[Task 5 usability review](./task-5-usability-review.md) for reproduction
steps and evidence details. Rows are ordered by severity, then effort.

## 2. Fix Before Release

| ID | Severity | Screen | Problem (one sentence) | Recommended fix (specific, with token or component names) | Likely file or component | Effort (S, M, L) | Acceptance check (a short testable statement a tester can verify) | Status |
|---|---|---|---|---|---|---|---|---|
| UX-001 | High | Register | Registration requires a password before the access request is approved. | Match Task 2: collect First name, Last name, and Email only; preserve the post-approval Set Password flow and its existing password rules. | `components/AuthForm.tsx`; confirm auth action flow before implementation | M | Register has exactly the three approved fields; a visitor can request access without setting a password, and the password step is only available after approval. | Open |

## 3. Fix Next

| ID | Severity | Screen | Problem (one sentence) | Recommended fix (specific, with token or component names) | Likely file or component | Effort (S, M, L) | Acceptance check (a short testable statement a tester can verify) | Status |
|---|---|---|---|---|---|---|---|---|
| UX-002 | Medium | Login, Register, Reset Password | Auth typography uses Arial only and places multiple labels and support strings below the approved sizes. | Use the approved Inter-first font stack with Arial fallback; set field labels and readable small copy to at least 12px, body/input text to 14px, and button labels to 14px. | `app/globals.css`; approved font setup in `app/layout.tsx` if needed | S | Computed auth typography uses Inter when available, has no readable text below 12px, and uses 14px body, input, and button text. | Open |
| UX-004 | Medium | Login, Register, Reset Password | Several normal text and input boundaries are below the approved contrast thresholds. | Replace auth-page low-contrast colors with `--color-text-secondary`, `--color-border`, and other approved pairs; set placeholder opacity to 1 and verify each pair at 4.5:1 for text and 3:1 for meaningful boundaries. | `app/globals.css` | S | Automated contrast checks report at least 4.5:1 for normal text and 3:1 for input boundaries on the auth screens. | Open |
| UX-005 | Medium | Login, Register, Reset Password | The keyboard focus treatment is a low-contrast border and translucent shadow rather than the approved focus outline. | Add a consistent `:focus-visible` treatment using `2px solid var(--color-focus)` and `outline-offset: 2px`; do not suppress the outline without this replacement. | `app/globals.css` | S | Every keyboard-focused auth control has a visible 2px `--color-focus` outline with the required offset and at least 3:1 contrast. | Open |
| UX-006 | Medium | Login, Register, Reset Password | Several mobile auth links and the Remember me checkbox target are shorter than 44px. | Expand link and checkbox label hit areas to at least 44 × 44px at mobile breakpoints while preserving visible text and logical spacing. | `app/globals.css`; `components/AuthForm.tsx` | S | At 375px, Forgot password, Register/Sign in, support links, and the Remember me target each measure at least 44 × 44px. | Open |
| UX-007 | Medium | Login | Initial focus and the order of the Forgot password link do not match the approved keyboard sequence. | Set initial focus to Email on Login and Reset Password and First name on Register; move Forgot password after Remember me in the Login tab order. | `components/AuthForm.tsx` | S | Reloading Login focuses Email; Tab follows Email → Password → Show/Hide → Remember me → Forgot password → Sign In. | Open |
| UX-003 | Medium | Register | Empty required fields do not show the approved field-linked validation message on blur. | Implement Task 2's on-blur validation and revalidate on input after the first error; render the summary and inline messages with `aria-describedby` and focus the summary on submit. | `components/AuthForm.tsx` | M | Blurring an empty First name shows the specified message associated with that input; after submit, the summary receives focus and corrected input clears its error. | Open |

## 4. Nice to Have

| ID | Severity | Screen | Problem (one sentence) | Recommended fix (specific, with token or component names) | Likely file or component | Effort (S, M, L) | Acceptance check (a short testable statement a tester can verify) | Status |
|---|---|---|---|---|---|---|---|---|
| UX-008 | Low | Login, Register, Reset Password | Auth headings and helper copy differ from the Task 2 approved wording. | Align headings, helper text, and secondary links with Task 2's microcopy after the approval-policy wording is confirmed. | `components/AuthForm.tsx`; `app/reset-password/page.tsx` | S | The default Login, Register, and Reset Password copy matches the approved text and stays neutral about whether an email exists. | Open |

## 5. Conclusion

The fix list contains one row for each of the eight reported review issues.
All statuses begin as `Open`. Reprioritize only if the product owner or
development team confirms a change in impact or release risk.
