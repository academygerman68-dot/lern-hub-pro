import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordPage } from "@/components/academy/reset-password-page";
import { useAcademy } from "@/components/academy/academy-context";

export const Route = createFileRoute("/auth/reset-password")({
  component: ResetPasswordRoute,
});

function ResetPasswordRoute() {
  const { ready } = useAcademy();
  if (!ready) return <div className="min-h-screen bg-background" />;
  return <ResetPasswordPage />;
}
