import type { ReactNode } from "react";
import { LoginShell } from "./login-shell";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <LoginShell title={title} {...(subtitle ? { subtitle } : {})} {...(footer ? { footer } : {})}>
      {children}
    </LoginShell>
  );
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5a4.8 4.8 0 0 1-2.1 3.1l3.4 2.6c2-1.8 3.1-4.5 3.1-7.7 0-.7-.1-1.4-.2-2.1H12z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 5-.9 6.8-2.4l-3.4-2.6c-.9.6-2 1-3.4 1a5.9 5.9 0 0 1-5.6-4.1L3 16.5A10 10 0 0 0 12 22z"
      />
      <path fill="#FBBC05" d="M6.4 13.9a6 6 0 0 1 0-3.8L3 7.5a10 10 0 0 0 0 9z" />
      <path
        fill="#4285F4"
        d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3 7.5l3.4 2.6A5.9 5.9 0 0 1 12 6.1z"
      />
    </svg>
  );
}
