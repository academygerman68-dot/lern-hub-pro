import { createFileRoute } from "@tanstack/react-router";
import { AuthCallbackPage } from "@/components/academy/auth-callback-page";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});
