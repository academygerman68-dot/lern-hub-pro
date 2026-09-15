# Backend architecture — German Academy

## Role mapping

| Backend (`profiles.role`) | Frontend UI (`Role`) |
| ------------------------- | -------------------- |
| `admin`                   | `director`           |
| `teacher`                 | `teacher`            |
| `student`                 | `student`            |

Public signup can only create `student` (or `teacher` via metadata that is still non-admin). Admin roles are assigned only by privileged backend/admin flows.

## Identity

- Source of truth: Supabase Auth (`auth.users`)
- App profile: `public.profiles` (1:1 with `auth.users.id`)
- Trigger `handle_new_user` creates profiles on signup
- Trigger `handle_new_profile_entity` creates `students` / `teachers` rows
- Email lives in Auth; `profiles.email` is synced via `sync_profile_email`

## Security helpers (SECURITY DEFINER, `search_path=public`)

Used by RLS without recursion on `profiles`:

- `is_admin()`, `is_teacher()`, `is_student()`, `is_active_user()`
- `current_student_id()`, `current_teacher_id()`
- `is_teacher_of_class(class_id)`, `is_enrolled_in_class(class_id)`, `teacher_has_student(student_id)`
- `has_active_academic_access(user_id)`
- `write_audit_log(...)`

Trigger-only functions (`handle_new_user`, `sync_profile_email`, `handle_new_profile_entity`) have EXECUTE revoked from `anon` / `authenticated`.

## Layers

1. Auth + profiles + RLS helpers
2. students / teachers
3. levels → courses → modules → units → lessons
4. classes + enrollments
5. app_settings + audit_logs
6. storage buckets
7. student_payments + student_subscriptions + invoices

## Frontend entry points

- `src/lib/supabase.ts` — single client
- `src/services/supabase/auth-service.ts` — Auth session/profile
- `src/services/supabase/settings-service.ts` — public settings
- Domain mock services remain under `src/services/academy-services.ts` until migrated

## Future Edge Functions

- `generate-jaas-token` — Jitsi JWT (secrets: `JAAS_APP_ID`, `JAAS_KEY_ID`, `JAAS_PRIVATE_KEY`)
- Admin user provisioning (service role server-side only)
