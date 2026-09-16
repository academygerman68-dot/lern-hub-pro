/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Canonical public app origin for Auth redirects (e.g. https://your-app.lovable.app). */
  readonly VITE_PUBLIC_APP_URL?: string;
  /** Show one-click seeded account buttons (student/teacher/admin). */
  readonly VITE_ENABLE_TEST_LOGIN?: string;
  /** Shared password for seeded QA accounts (optional override). */
  readonly VITE_TEST_ACCOUNT_PASSWORD?: string;
  /** Dev-only: set "true" with missing Supabase env to enable offline demo login buttons. */
  readonly VITE_ENABLE_DEMO_AUTH?: string;
  /** Jitsi domain — use 8x8.vc with JaaS, or meet.jit.si for public. */
  readonly VITE_JITSI_DOMAIN?: string;
  /** Public 8x8 JaaS app id (vpaas-magic-cookie-…). Not a secret. */
  readonly VITE_JAAS_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
