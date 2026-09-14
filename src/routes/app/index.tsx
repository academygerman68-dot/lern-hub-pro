import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAcademy } from "@/components/academy/academy-context";

export const Route = createFileRoute("/app/")({
  component: AppIndex,
});

function AppIndex() {
  const { role, page } = useAcademy();
  if (!role) return <Navigate to="/" />;
  return <Navigate to="/app/$role/$page" params={{ role, page }} />;
}
