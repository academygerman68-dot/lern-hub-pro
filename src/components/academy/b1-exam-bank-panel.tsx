import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { computeB1ExamReadiness, isB1ModelltestCode } from "@/lib/b1-exam-readiness";
import { ExamService } from "@/services/academy-services";
import type { ExamListItem, ExamStructureSection } from "@/services/supabase/exam-service";
import { usePublishExam } from "@/hooks/use-academy-data";
import { useAcademy } from "./academy-context";
import { ProgressLine, Status, Surface } from "./primitives";

type Props = {
  exams: ExamListItem[];
  alwaysShow?: boolean;
};

function sortB1(a: ExamListItem, b: ExamListItem) {
  return String(a.code ?? "").localeCompare(String(b.code ?? ""), "en");
}

export function B1ExamBankPanel({ exams, alwaysShow = true }: Props) {
  const { navigate } = useAcademy();
  const publishExam = usePublishExam();
  const [structureByExam, setStructureByExam] = useState<Record<string, ExamStructureSection[]>>(
    {},
  );
  const [anomaliesFor, setAnomaliesFor] = useState<string | null>(null);

  const b1Exams = useMemo(
    () => exams.filter((exam) => isB1ModelltestCode(exam.code)).slice().sort(sortB1),
    [exams],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const missing = b1Exams.filter((e) => !structureByExam[e.id]);
      if (missing.length === 0) return;
      const next: Record<string, ExamStructureSection[]> = {};
      await Promise.all(
        missing.slice(0, 15).map(async (exam) => {
          try {
            next[exam.id] = await ExamService.listExamStructure(exam.id);
          } catch {
            next[exam.id] = [];
          }
        }),
      );
      if (!cancelled) setStructureByExam((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per new B1 exams
  }, [b1Exams.map((e) => e.id).join(",")]);

  if (!alwaysShow && b1Exams.length === 0) return null;

  return (
    <Surface className="mb-8 space-y-5 p-5">
      <div>
        <h2 className="text-lg font-semibold">Banque B1 — Modelltests</h2>
        <p className="text-sm text-muted-foreground">
          15 examens indépendants. Aucun OCR ni phrase brute dans ce catalogue.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {b1Exams.map((exam) => {
          const sections = structureByExam[exam.id] ?? [];
          const readiness = computeB1ExamReadiness({
            code: exam.code,
            status: exam.status,
            sections: sections.map((s) => ({
              skill: s.skill,
              title: s.title,
              questions: (s.questions ?? []).map((q) => ({
                id: q.id,
                prompt: q.prompt,
                type: q.type,
                points: q.points,
                sort_order: q.sort_order,
                media_path: q.media_path,
                media_bucket: q.media_bucket,
                metadata: q.metadata,
                options: q.options,
                answer_key: q.answer_key,
                correct_values: q.answer_key?.correct_values ?? null,
              })),
            })),
          });
          const code = exam.code ?? "B1";
          const reviewCount =
            readiness.placeholderCount +
            (readiness.audioSlotsTotal - readiness.audioVerified) +
            (readiness.scoringStatus === "provisional_needs_review" ? 1 : 0);

          return (
            <article
              key={exam.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {code}
                  </p>
                  <h3 className="font-semibold leading-snug">{exam.title}</h3>
                </div>
                <Status tone={exam.status === "published" ? "green" : "amber"}>
                  {exam.status === "published" ? "Publié" : "Brouillon"}
                </Status>
              </div>

              <div>
                <ProgressLine value={readiness.progress} />
                <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                  Progression {readiness.progress}%
                </p>
              </div>

              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>
                  Lesen : {readiness.lesenReady}/{readiness.lesenTotal || 30} questions prêtes
                </li>
                <li>
                  Hören : {readiness.audioReady}/4 pistes téléversées · Vérification :{" "}
                  {readiness.audioVerified}/4 confirmée
                </li>
                <li>Schreiben : {readiness.schreibenTasks}/3 tâches</li>
                <li>Sprechen : {readiness.sprechenTasks} activités</li>
                <li>
                  {reviewCount > 0
                    ? `${reviewCount} élément(s) à vérifier`
                    : "Rien à vérifier"}
                </li>
              </ul>

              {readiness.reviewSummary.length > 0 ? (
                <ul className="space-y-0.5 text-xs text-amber-800 dark:text-amber-200">
                  {readiness.reviewSummary.slice(0, 3).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}

              {anomaliesFor === exam.id ? (
                <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
                  <p className="font-medium">Anomalies</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                    {(readiness.blockers.length ? readiness.blockers : ["Aucune"]).map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2"
                    onClick={() => setAnomaliesFor(null)}
                  >
                    Fermer
                  </Button>
                </div>
              ) : null}

              <div className="mt-auto flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => navigate("b1-exam", { examCode: code })}
                >
                  Ouvrir
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate("b1-exam", { examCode: code, b1Tab: "edit" })}
                >
                  Modifier
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate("b1-preview", { examCode: code })}
                >
                  Tester
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setAnomaliesFor((id) => (id === exam.id ? null : exam.id))}
                >
                  Voir les anomalies
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!readiness.readyForPublish || publishExam.isPending}
                  title={
                    readiness.readyForPublish
                      ? "Publier"
                      : readiness.blockers.slice(0, 5).join(" · ") || "Publication bloquée"
                  }
                  onClick={() => {
                    if (!readiness.readyForPublish) {
                      setAnomaliesFor(exam.id);
                      toast.message("Publication bloquée", {
                        description: readiness.blockers.slice(0, 5).join(" · "),
                      });
                      return;
                    }
                    publishExam.mutate(exam.id, {
                      onSuccess: () => toast.success("Examen publié"),
                      onError: (err) => toast.error(err.message),
                    });
                  }}
                >
                  Publier
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </Surface>
  );
}
