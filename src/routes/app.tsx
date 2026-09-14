import { Outlet, createFileRoute, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/academy/shell";
import { useAcademy } from "@/components/academy/academy-context";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { ready, role } = useAcademy();
  if (!ready) return <div className="min-h-screen bg-background" />;
  if (!role) return <Navigate to="/" />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
