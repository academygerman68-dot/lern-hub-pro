# Database schema — German Academy

Project: `omxemusaqgzkogqvcdfw` (eu-west-1)

## Tables

| Table                   | Purpose                              |
| ----------------------- | ------------------------------------ |
| `profiles`              | App user profile linked to Auth      |
| `students`              | Student entity (`profile_id` unique) |
| `teachers`              | Teacher entity (`profile_id` unique) |
| `levels`                | A1–B2 catalog                        |
| `courses`               | Courses under a level                |
| `modules`               | Course modules                       |
| `units`                 | Module units                         |
| `lessons`               | Unit lessons                         |
| `classes`               | Class groups                         |
| `enrollments`           | Student ↔ class (one active pair)    |
| `app_settings`          | Branding / languages / config        |
| `audit_logs`            | Sensitive action audit trail         |
| `student_subscriptions` | Academic access entitlement          |
| `student_payments`      | Student payments (not payroll)       |
| `invoices`              | Student invoices                     |

## Conventions

- UUID PKs via `gen_random_uuid()`
- `created_at` / `updated_at` (trigger `set_updated_at`)
- Soft-archive via `status` / `archived_at` where relevant
- Money: `numeric(12,2)`
- FK deletes: prefer `RESTRICT` / `SET NULL` over cascade for history

## Seeded data

- Levels: A1, A2, B1, B2
- Default `app_settings` (academy name, languages, timezone, colors, currency)

## Migrations

Versioned under `supabase/migrations/`. Apply with Supabase MCP `apply_migration` or CLI linked to the project.
