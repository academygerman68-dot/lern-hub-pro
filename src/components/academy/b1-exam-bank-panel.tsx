import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Eye, Pencil, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { computeB1ExamReadiness, isB1ModelltestCode } from "@/lib/b1-exam-readiness";
import { ExamService } from "@/services/academy-services";
import type { ExamListItem, ExamStructureSection } from "@/services/supabase/exam-service";
import { usePublishExam } from "@/hooks/use-academy-data";
import { QueryState } from "./query-state";
import { ProgressLine, Status, Surface } from "./primitives";
import { ExamBuilder } from "./exam-builder";

type FilterId = "all" | "ocr" | "audio" | "ready";

type Row = {
  exam: ExamListItem;
  readiness: ReturnType<typeof computeB1ExamReadiness>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function sourceFromMeta(meta: Record<string, unknown> | null) {
  const source = asRecord(meta?.["source"]);
  return {
    ocrText: typeof source?.["ocr_text"] === "string" ? source["ocr_text"] : null,
    page:
      typeof source?.["source_pdf_page"] === "number"
        ? source["source_pdf_page"]
        : typeof source?.["source_pdf_page"] === "string"
          ? source["source_pdf_page"]
          : null,
  };
}

type Props = {
  exams: ExamListItem[];
  alwaysShow?: boolean;
  onOpenBuilder?: (examId: string) => void;
};

export function B1ExamBankPanel({ exams, alwaysShow = true, onOpenBuilder }: Props) {
  const publishExam = usePublishExam();
  const [open, setOpen] = useState(true);
  const [filter, setFilter] = useState<FilterId>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [structure, setStructure] = useState<ExamStructureSection[]>([]);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [structureError, setStructureError] = useState<Error | null>(null);
  const [previewQuestionId, setPreviewQuestionId] = useState<string | null>(null);
  const [editExamId, setEditExamId] = useState<string | null>(null);

  const b1Exams = useMemo(
    () => exams.filter((exam) => isB1ModelltestCode(exam.code)),
    [exams],
  );

  const [structureByExam, setStructureByExam] = useState<Record<string, ExamStructureSection[]>>(
    {},
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
      if (!cancelled) {
        setStructureByExam((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per new B1 exams
  }, [b1Exams.map((e) => e.id).join(",")]);

  const rows: Row[] = useMemo(() => {
    return b1Exams.map((exam) => {
      const sections = structureByExam[exam.id] ?? [];
      const readiness = computeB1ExamReadiness({
        code: exam.code,
        status: exam.status,
        sections,
      });
      return { exam, readiness };
    });
  }, [b1Exams, structureByExam]);

  const filtered = useMemo(() => {
    return rows.filter(({ readiness }) => {
      if (filter === "ocr") return readiness.pagesNeedingReview > 0;
      if (filter === "audio") return readiness.audioReady < readiness.audioTotal;
      if (filter === "ready") return readiness.readyForPublish || readiness.progress >= 90;
      return true;
    });
  }, [rows, filter]);

  useEffect(() => {
    if (!selectedId) {
      setStructure([]);
      setStructureError(null);
      return;
    }
    let cancelled = false;
    setLoadingStructure(true);
    setStructureError(null);
    void ExamService.listExamStructure(selectedId)
      .then((data) => {
        if (!cancelled) {
          setStructure(data);
          setStructureByExam((prev) => ({ ...prev, [selectedId]: data }));
          const firstQ = data.flatMap((s) => s.questions ?? [])[0];
          setPreviewQuestionId(firstQ?.id ?? null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setStructureError(err);
      })
      .finally(() => {
        if (!cancelled) setLoadingStructure(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  if (!alwaysShow && b1Exams.length === 0) return null;

  const selectedRow = rows.find((r) => r.exam.id === selectedId) ?? null;
  const previewQuestion = structure
    .flatMap((s) => (s.questions ?? []).map((q) => ({ section: s, question: q })))
    .find((row) => row.question.id === previewQuestionId);

  const skillTabs = [
    { id: "lesen", label: "Lesen" },
    { id: "hoeren", label: "Hören" },
    { id: "schreiben", label: "Schreiben" },
    { id: "sprechen", label: "Sprechen" },
  ] as const;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-6">
      <Surface className="p-5">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <div>
              <h2 className="text-base font-semibold">Banque B1 (OCR)</h2>
              <p className="text-sm text-muted-foreground">
                Modelltests B1-MT01–15 · brouillons OCR · publication bloquée jusqu’à relecture
              </p>
            </div>
            <ChevronDown
              className={`size-5 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4 space-y-4">
          {b1Exams.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Aucun examen B1-MT importé</p>
              <p className="mt-1">
                Lancez d’abord un dry-run :{" "}
                <code className="text-xs">node scripts/import-b1-exam-bank.mjs --dry-run</code>
                , puis l’import quand la clé service role est disponible. Les audios Drive
                s’attachent via{" "}
                <code className="text-xs">node scripts/attach-b1-audio.mjs</code> après
                inventaire.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["all", "Tous"],
                    ["ocr", "OCR à vérifier"],
                    ["audio", "Audio manquant"],
                    ["ready", "Prêt publication"],
                  ] as const
                ).map(([id, label]) => (
                  <Button
                    key={id}
                    size="sm"
                    variant={filter === id ? "default" : "outline"}
                    onClick={() => setFilter(id)}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[52rem] text-left text-sm">
                  <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Modelltest</th>
                      <th className="py-2 pr-3 font-medium">Statut</th>
                      <th className="py-2 pr-3 font-medium">Progression</th>
                      <th className="py-2 pr-3 font-medium">Placeholders</th>
                      <th className="py-2 pr-3 font-medium">Clés manquantes</th>
                      <th className="py-2 pr-3 font-medium">Audio vérifié</th>
                      <th className="py-2 pr-3 font-medium">Barème</th>
                      <th className="py-2 pr-3 font-medium">Blocages</th>
                      <th className="py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(({ exam, readiness }) => (
                      <tr key={exam.id} className="border-b border-border/60 align-top">
                        <td className="py-3 pr-3">
                          <button
                            type="button"
                            className="font-medium text-foreground hover:underline"
                            onClick={() =>
                              setSelectedId((id) => (id === exam.id ? null : exam.id))
                            }
                          >
                            {exam.code ?? exam.title}
                          </button>
                          <p className="text-xs text-muted-foreground">{exam.title}</p>
                        </td>
                        <td className="py-3 pr-3">
                          <Status tone={exam.status === "published" ? "green" : "amber"}>
                            {exam.status === "published" ? "Publié" : "Brouillon"}
                          </Status>
                        </td>
                        <td className="py-3 pr-3 min-w-[8rem]">
                          <ProgressLine value={readiness.progress} />
                          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                            {readiness.progress}%
                          </p>
                        </td>
                        <td className="py-3 pr-3 tabular-nums">
                          {readiness.placeholderCount > 0 ? (
                            <Status tone="amber">{readiness.placeholderCount}</Status>
                          ) : (
                            <Status tone="green">0</Status>
                          )}
                        </td>
                        <td className="py-3 pr-3 tabular-nums">
                          {readiness.missingKeysCount > 0 ? (
                            <Status tone="amber">{readiness.missingKeysCount}</Status>
                          ) : (
                            <Status tone="green">0</Status>
                          )}
                        </td>
                        <td className="py-3 pr-3 tabular-nums">
                          {readiness.audioVerified}/{readiness.audioSlotsTotal}
                          <p className="text-[10px] text-muted-foreground">
                            fichiers {readiness.audioReady}/{readiness.audioTotal}
                          </p>
                        </td>
                        <td className="py-3 pr-3">
                          {readiness.scoringStatus === "provisional_needs_review" ? (
                            <Status tone="amber">Barème interne, à confirmer</Status>
                          ) : readiness.scoringStatus === "official" ? (
                            <Status tone="green">Officiel</Status>
                          ) : (
                            <Status tone="amber">Inconnu</Status>
                          )}
                        </td>
                        <td className="py-3 pr-3">
                          {readiness.blockers.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <ul className="max-w-[14rem] list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                              {readiness.blockers.slice(0, 3).map((b) => (
                                <li key={b}>{b}</li>
                              ))}
                              {readiness.blockers.length > 3 ? (
                                <li>+{readiness.blockers.length - 3}…</li>
                              ) : null}
                            </ul>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setSelectedId(exam.id)}
                            >
                              <Eye className="mr-1 size-3.5" />
                              Aperçu
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                toast.message("Anomalies", {
                                  description: [
                                    `Placeholders: ${readiness.placeholderCount}`,
                                    `Clés manquantes: ${readiness.missingKeysCount}`,
                                    `OCR à vérifier: ${readiness.pagesNeedingReview}`,
                                    `Audios vérifiés: ${readiness.audioVerified}/${readiness.audioSlotsTotal}`,
                                    `Barème: ${readiness.scoringStatus}`,
                                    `Tests E2E: non exécutés`,
                                    `Blocages: ${readiness.blockers.join(" · ") || "aucun"}`,
                                  ].join(" · "),
                                })
                              }
                            >
                              Voir les anomalies
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedId(exam.id);
                                toast.message("Comparer au PDF", {
                                  description:
                                    "Ouvrez l’aperçu OCR ci-dessous (page source dans les métadonnées). Ne remplacez jamais un placeholder par du texte inventé.",
                                });
                              }}
                            >
                              Comparer au PDF
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedId(exam.id);
                                toast.message("Audios Hören", {
                                  description: `Vérifiés contenu ${readiness.audioVerified}/${readiness.audioSlotsTotal} · Fichiers ${readiness.audioReady}/${readiness.audioTotal} · Statut: needs_review tant que l’annonce Teil n’est pas entendue`,
                                });
                              }}
                            >
                              <Play className="mr-1 size-3.5" />
                              Écouter les audios
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                toast.message("Tester comme étudiant", {
                                  description:
                                    exam.status === "published"
                                      ? "Examen publié — ouvrir le parcours étudiant."
                                      : "Examen en brouillon — utilisez une prévisualisation sécurisée Admin/Teacher. Ne publiez pas pour tester.",
                                })
                              }
                            >
                              Tester comme étudiant
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                toast.message(`Rapport de complétude · ${exam.code}`, {
                                  description: [
                                    `Progression ${readiness.progress}% (ne compte pas audio non vérifié / placeholder / barème provisoire)`,
                                    `Prêt publication: ${readiness.readyForPublish ? "oui" : "non"}`,
                                    `Placeholders ${readiness.placeholderCount}`,
                                    `Clés manquantes ${readiness.missingKeysCount}`,
                                    `Audio contenu ${readiness.audioVerified}/${readiness.audioSlotsTotal}`,
                                    `Barème: Barème pédagogique interne, à confirmer (${readiness.scoringStatus})`,
                                    readiness.blockers.slice(0, 6).join(" · ") || "aucun blocage",
                                  ].join(" · "),
                                })
                              }
                            >
                              Rapport de complétude
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setEditExamId((id) => (id === exam.id ? null : exam.id));
                                onOpenBuilder?.(exam.id);
                              }}
                            >
                              <Pencil className="mr-1 size-3.5" />
                              Modifier
                            </Button>
                            <Button
                              size="sm"
                              disabled={
                                !readiness.readyForPublish ||
                                exam.status === "published" ||
                                publishExam.isPending
                              }
                              title={
                                readiness.readyForPublish
                                  ? "Publier"
                                  : "Publication bloquée — complétude / OCR / audio"
                              }
                              onClick={() =>
                                publishExam.mutate(exam.id, {
                                  onSuccess: () => toast.success("Examen publié"),
                                  onError: (err) => toast.error(err.message),
                                })
                              }
                            >
                              Publier
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {editExamId ? <ExamBuilder examId={editExamId} /> : null}

              {selectedId && selectedRow ? (
                <Surface className="space-y-4 border-primary/20 bg-muted/10 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">
                        Aperçu · {selectedRow.exam.code ?? selectedRow.exam.title}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Progression {selectedRow.readiness.progress}% ·{" "}
                        {selectedRow.readiness.blockers.length} blocage(s)
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
                      Fermer
                    </Button>
                  </div>

                  <QueryState
                    isLoading={loadingStructure}
                    isError={Boolean(structureError)}
                    error={structureError}
                    isEmpty={!loadingStructure && structure.length === 0}
                    emptyTitle="Structure vide"
                    emptyMessage="Aucune section pour cet examen."
                  >
                    <Tabs defaultValue="lesen">
                      <TabsList className="mb-3 flex h-auto flex-wrap gap-1">
                        {skillTabs.map((tab) => (
                          <TabsTrigger key={tab.id} value={tab.id}>
                            {tab.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {skillTabs.map((tab) => {
                        const section = structure.find((s) => s.skill === tab.id);
                        const questions = section?.questions ?? [];
                        return (
                          <TabsContent key={tab.id} value={tab.id} className="space-y-3">
                            <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
                              <div className="space-y-2">
                                {questions.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">
                                    Aucune question {tab.label}.
                                  </p>
                                ) : (
                                  questions.map((q) => {
                                    const meta = asRecord(q.metadata);
                                    const needs =
                                      meta?.["needs_review"] === true ||
                                      meta?.["transcription_status"] === "ocr_unverified";
                                    return (
                                      <button
                                        key={q.id}
                                        type="button"
                                        className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                                          previewQuestionId === q.id
                                            ? "border-primary bg-primary/5"
                                            : "border-border hover:border-primary/40"
                                        }`}
                                        onClick={() => setPreviewQuestionId(q.id)}
                                      >
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="font-medium">
                                            {q.prompt.slice(0, 90)}
                                            {q.prompt.length > 90 ? "…" : ""}
                                          </span>
                                          {needs ? (
                                            <Status tone="amber">OCR</Status>
                                          ) : null}
                                        </div>
                                      </button>
                                    );
                                  })
                                )}
                              </div>

                              <aside className="rounded-md border border-dashed bg-background p-3 text-sm">
                                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                  Panneau OCR
                                </p>
                                {previewQuestion && previewQuestion.section.skill === tab.id ? (
                                  (() => {
                                    const meta = asRecord(previewQuestion.question.metadata);
                                    const { ocrText, page } = sourceFromMeta(meta);
                                    return (
                                      <div className="mt-2 space-y-3">
                                        <div>
                                          <p className="text-xs text-muted-foreground">
                                            Prompt transformé
                                          </p>
                                          <p className="mt-1 whitespace-pre-wrap text-xs leading-5">
                                            {previewQuestion.question.prompt.slice(0, 600)}
                                            {previewQuestion.question.prompt.length > 600
                                              ? "…"
                                              : ""}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-xs text-muted-foreground">
                                            OCR source
                                          </p>
                                          <p className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                                            {ocrText?.slice(0, 800) ?? "—"}
                                            {ocrText && ocrText.length > 800 ? "…" : ""}
                                          </p>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                          Page PDF : {page ?? "—"}
                                        </p>
                                        <p className="text-xs">
                                          needs_review :{" "}
                                          {String(meta?.["needs_review"] ?? "—")} · status :{" "}
                                          {String(meta?.["transcription_status"] ?? "—")}
                                        </p>
                                      </div>
                                    );
                                  })()
                                ) : (
                                  <p className="mt-2 text-xs text-muted-foreground">
                                    Sélectionnez une question.
                                  </p>
                                )}
                              </aside>
                            </div>
                          </TabsContent>
                        );
                      })}
                    </Tabs>
                  </QueryState>
                </Surface>
              ) : null}
            </>
          )}
        </CollapsibleContent>
      </Surface>
    </Collapsible>
  );
}
