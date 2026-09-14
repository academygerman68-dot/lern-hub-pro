import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Login } from "@/components/academy/login";
import { useAcademy } from "@/components/academy/academy-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Deutsch Academy — German Learning Center" },
      {
        name: "description",
        content:
          "A complete digital learning experience for German students, teachers and academy directors.",
      },
      { property: "og:title", content: "Deutsch Academy — German Learning Center" },
      {
        property: "og:description",
        content: "Courses, classes, exams, progress and academy management from A1 to B2.",
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
