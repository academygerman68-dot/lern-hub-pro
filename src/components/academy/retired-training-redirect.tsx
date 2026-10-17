import { useEffect } from "react";
import type { AcademyPage } from "@/types/academy";
import { useAcademy } from "./academy-context";
import { Surface } from "./primitives";

/** Old Entraînements URLs land on Examens blancs. Tables and history stay in the database. */
export function RetiredTrainingRedirect() {
  const { navigate } = useAcademy();

  useEffect(() => {
    navigate("exams");
  }, [navigate]);

  return (
    <Surface className="mx-auto max-w-xl space-y-3 p-8">
      <h1 className="font-display text-2xl font-medium">Page déplacée</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Les entraînements ne font plus partie du menu. Les simulations se font dans Examens blancs.
      </p>
      <button
        type="button"
        className="text-sm font-medium text-primary"
        onClick={() => navigate("exams" satisfies AcademyPage)}
      >
        Ouvrir les examens blancs
      </button>
    </Surface>
  );
}
