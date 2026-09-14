# RLS & security model

## Platform fix

`public.rls_auto_enable()` (event trigger `ensure_rls`) still auto-enables RLS on new `public` tables.

`EXECUTE` revoked from `anon` / `authenticated` / `PUBLIC` so it is not callable via PostgREST.

## Table RLS summary

| Table | SELECT | WRITE |
|-------|--------|-------|
| profiles | self or admin | self (non-privileged fields) or admin |
| students | self, assigned teacher, admin | admin |
| teachers | authenticated (limited), admin | admin |
| levels | active (or admin) | admin |
| courses/modules/units/lessons | published or staff | staff |
| classes | enrolled / assigned teacher / admin | admin |
| enrollments | own / class teacher / admin | admin |
| app_settings | public keys or admin | admin |
| audit_logs | admin | via `write_audit_log` only |
| student_* finance | own or admin | admin |

Privilege escalation on profiles (`role`, `status`, `email`, `archived_at`) is blocked by trigger `profiles_guard_privileged_fields` unless `is_admin()`.

## Storage buckets (private)

`avatars`, `documents`, `library`, `course-materials`, `recordings`

Path conventions:

- `avatars/{user_id}/...`
- `documents/students/{student_id}/...`
- `classes/{class_id}/recordings/...`

## Test scenarios (manual / future automated)

1. Student A cannot SELECT Student B profile / payments
2. Teacher A cannot SELECT unrelated class enrollments
3. Student cannot UPDATE `profiles.role` to `admin`
4. Student cannot UPDATE `student_subscriptions.status`
5. Anon cannot read private tables
6. Admin can manage settings and audit logs

Create test users in the Supabase Auth dashboard (do not commit passwords).
