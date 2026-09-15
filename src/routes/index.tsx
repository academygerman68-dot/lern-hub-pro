import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Login } from "@/components/academy/login";
import { useAcademy } from "@/components/academy/academy-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "German Language Academy" },
      {
        name: "description",
        content: "Une expérience numérique complète pour apprendre et enseigner l’allemand.",
      },
      { property: "og:title", content: "German Language Academy" },
      {
        property: "og:description",
        content:
          "Cours, classes, examens, progression et gestion de l’académie du niveau A1 au B2.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomeRoute,
});

function HomeRoute() {
  const { ready, role, page } = useAcademy();
  if (!ready) return <div className="min-h-screen bg-background" />;
  if (role) return <Navigate to="/app/$role/$page" params={{ role, page }} />;
  return <Login />;
}
