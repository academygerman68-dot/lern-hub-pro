import { createFileRoute, Navigate } from "@tanstack/react-router";
import { ForgotPasswordPage } from "@/components/academy/forgot-password-page";
import { useAcademy } from "@/components/academy/academy-context";

export const Route = createFileRoute("/auth/forgot-password")({
  component: ForgotPasswordRoute,
});

function ForgotPasswordRoute() {
  const { ready, role, page } = useAcademy();
  if (!ready) return <div className="min-h-screen bg-background" />;
  if (role) return <Navigate to="/app/$role/$page" params={{ role, page }} />;
  return <ForgotPasswordPage />;
}
