# Demo script — German Language Academy

Use seeded QA accounts (password documented in project seed / test login UI). Never put real production secrets here.

Typical pattern (confirm against your seed):

| Role    | Email (example)       |
| ------- | --------------------- |
| Admin   | `admin@gla.academy`   |
| Teacher | `teacher@gla.academy` |
| Student | `student@gla.academy` |

Password: use the seeded QA password shown in the test-login panel (`Gla-…` / env override).

## Prerequisites

1. Migrations applied through phase 3 (`payment_proofs`, `meeting_recordings`, `notification_outbox`).
2. `VITE_SUPABASE_*` + Auth redirect URLs configured.
3. Optional: leave recording/email/WhatsApp unconfigured to verify honest empty states.

## Scenario (12 steps)

1. **Admin login** — Open app → test login or email/password as admin → Dashboard.
2. **Teacher & student** — Navigate Students / Teachers → open or create profiles (or use seeds).
3. **Assign class** — Classes → enroll student in a class taught by the demo teacher.
4. **Block for unpaid** — Ensure student subscription is `suspended` / `past_due` (admin: create pending payment without marking paid, or set subscription status).
5. **Student deposits proof** — Logout → student login → Paiements → select the pending payment, enter the amount and operation date, then upload the PDF/JPEG/PNG avis d’opération → status `pending`. Confirm courses still blocked.
6. **Admin queue** — Admin → Paiements → File des justificatifs → compare declared and expected amounts, operation date/reference, then Voir (signed URL). Access still blocked for student.
7. **Approve** — Approuver → RPC activates subscription + in-app notification.
8. **Access restored** — Student sees notification; academic pages unlock (`has_active_academic_access`).
9. **Teacher scope** — Teacher login → Students list shows only assigned learners; no Subscription / payment proof column; no finance menu.
10. **Jitsi session** — Teacher/Admin → Live → Create session → Join from teacher + student (same `academy-{id}` room). Chat + screen share available. Leave does not complete the session for others.
11. **Library** — Open Materials / library item with signed URL; expired items must not appear for students.
12. **Mock exam** — Student → Exams → start published blanc → submit → view result.

## Expected honest states

- Recording banner: **Enregistrement non configuré** if provider unset.
- Email/WhatsApp: outbox may queue; adapters report not configured — no fake “sent”.
- Fake renew button removed / disabled on legacy premium payments screen.

## Reset tips

- Reject a proof and re-upload, or create a new pending payment.
- Suspend subscription again via admin `student_subscriptions` / mark overdue.
