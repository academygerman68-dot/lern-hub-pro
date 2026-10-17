export type CefrLevel = "A1" | "A2" | "B1" | "B2";

export type CourseCoverage = {
  level: CefrLevel;
  persistedSkeleton: true;
  pedagogicallyComplete: false;
  gap: string;
};

export type ExamInventoryStatus =
  | "published-historical-partial"
  | "internal-draft-ready-for-preprod"
  | "blocked-ocr"
  | "not-implemented"
  | "demo-seed";

export type ExamInventoryItem = {
  code: string;
  level: CefrLevel;
  status: ExamInventoryStatus;
  sittable: boolean;
  reason: string;
};

/** Seeded in 20260914223138: one published placeholder course per level, not a full syllabus. */
export function courseLevelCoverage(): CourseCoverage[] {
  const gap =
    "Squelette publié : un module, une unité, deux leçons d’introduction. Pas d’objectifs, d’exercices ni de corrigés validés.";
  return (["A1", "A2", "B1", "B2"] as const).map((level) => ({
    level,
    persistedSkeleton: true,
    pedagogicallyComplete: false,
    gap,
  }));
}

export function examInventory(): ExamInventoryItem[] {
  const historical = (code: string): ExamInventoryItem => ({
    code,
    level: "A1",
    status: "published-historical-partial",
    sittable: true,
    reason:
      "Banque historique partielle déjà publiée : 40 points automatiques et 10 points manuels. Audio Hören absent. Pas une simulation complète.",
  });
  return [
    historical("A1-01"),
    historical("A1-02"),
    historical("A1-03"),
    {
      code: "A1-SIM-01",
      level: "A1",
      status: "internal-draft-ready-for-preprod",
      sittable: false,
      reason:
        "Simulation interne en brouillon. Parcours et permissions non validés sur une préproduction distincte. Non affiliée au Goethe-Institut.",
    },
    {
      code: "A2-SIM-01",
      level: "A2",
      status: "not-implemented",
      sittable: false,
      reason: "Seulement planifié dans l’inventaire des sources. Aucune banque d’examen.",
    },
    ...Array.from({ length: 15 }, (_, index) => {
      const code = `B1-MT${String(index + 1).padStart(2, "0")}`;
      return {
        code,
        level: "B1" as const,
        status: "blocked-ocr" as const,
        sittable: false,
        reason:
          "Brouillon OCR non publié. Corrigés non vérifiés et 4 pistes audio manquantes par examen.",
      };
    }),
    {
      code: "B2",
      level: "B2",
      status: "not-implemented",
      sittable: false,
      reason:
        "Aucune banque pédagogique B2. Le seed « B2 Mock Exam 01 » est une démo, pas un examen.",
    },
  ];
}
