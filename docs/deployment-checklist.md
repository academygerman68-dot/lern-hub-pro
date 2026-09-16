# Deployment checklist — German Language Academy (lern-hub-pro)

Do **not** apply migrations or deploy without explicit approval for the target environment.

## 1. Supabase project

1. Confirm project ref and region.
2. Never put `service_role` in `VITE_*`, client code, logs, or git.
3. Frontend only: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (or publishable key).

### Connect MCP (Cursor) with least privilege

1. Install / enable the Supabase MCP in Cursor.
2. Authenticate with an account that can access the target org/project.
3. Prefer a development branch for schema experiments; apply to production only after review.
4. Use MCP to inspect tables, advisors, and run read-only SQL first.

## 2. Auth URLs

Dashboard → Authentication → URL Configuration:

- Site URL = `VITE_PUBLIC_APP_URL`
- Redirect URLs: local + production `/`, `/auth/callback`, `/auth/reset-password`

Public signup should remain student-only (existing triggers/policies).

## 3. Migrations

Apply in order from `supabase/migrations/` (additive):

1. Existing foundation / phase 2 migrations
2. `20260916120000_phase3_proofs_recordings_outbox.sql`

Commands (local):

```bash
npx supabase db push
# or
npx supabase migration up
```

Remote via Dashboard SQL / CI only with approval.

After apply: regenerate types if desired (`supabase gen types typescript`).

## 4. Storage

Buckets (private): `avatars`, `documents`, `library`, `course-materials`, `recordings`

Conventions:

- Payment proofs: `students/{student_id}/payment-proofs/{uuid}.ext`
- Library: `{uploader}/{uuid}.ext`
- Recordings: `classes/{class_id}/recordings/...`

Use short-lived signed URLs. Teachers must not read `payment-proofs` paths.

## 5. Jitsi / JaaS

- Default: public `meet.jit.si` via `@jitsi/react-sdk` (chat + screen share).
- Room name: `academy-{live_session_id}`
- Leave ≠ end meeting.
- JaaS: set Edge secrets `JAAS_APP_ID`, `JAAS_KEY_ID`, `JAAS_PRIVATE_KEY` and deploy `supabase/functions/jaas-token`.
- No JaaS secrets in `VITE_*`.

## 6. Recordings

- Table `meeting_recordings` + setting `recording_provider`.
- If provider is `none`: UI shows **« Enregistrement non configuré »** and hides impossible actions.
- Never claim a meeting is recorded without a real provider object.

## 7. Email / WhatsApp

- In-app notifications always available.
- Outbox: `notification_outbox` (idempotency_key, attempts, status, error).
- Deploy `supabase/functions/dispatch-outbox` only after setting provider secrets (see `.env.example`).
- Adapters return `not_configured` — never fake send success.

## 8. Branding & i18n

- Public settings: `academy_name`, `logo_url`, `academy_tagline`, `available_languages` (`fr`, `ar`).
- French fallback; Arabic RTL preserved in shell.
- Logo change via settings should propagate via `BrandingProvider`.

## 9. Build & deploy app

```bash
npm ci
npm run typecheck   # or tsc --noEmit
npm run lint
npm test
npm run build
```

Deploy the static build to the host (Lovable / static hosting). Do not force-push Lovable history.

## 10. Rollback

1. App: redeploy previous build artifact.
2. DB: prefer forward-fix migrations; do not drop tables with user data without a backup.
3. Edge Functions: redeploy previous function version or disable cron/triggers.

## 11. Post-deploy smoke

Follow `docs/demo-script.md` end-to-end (admin → proof → approve → live → exam).
