import { createFileRoute } from "@tanstack/react-router";
import { AcademyApp } from "@/components/academy/app";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Deutsch Academy — German Learning Center" },
    { name: "description", content: "A complete digital learning experience for German students, teachers and academy directors." },
    { property: "og:title", content: "Deutsch Academy — German Learning Center" },
    { property: "og:description", content: "Courses, classes, exams, progress and academy management from A1 to B2." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ]}),
  component: AcademyApp,
});
