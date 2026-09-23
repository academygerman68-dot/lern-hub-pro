import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3, Flag, Headphones } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { isB1ModelltestCode } from "@/lib/b1-exam-readiness";
import { previewStorageKey } from "@/lib/b1-exam-isolation";
import {
  toStudentFacingQuestion,
  type StudentFacingQuestion,
} from "@/lib/b1-student-content";
import { useAllExams, useExam } from "@/hooks/use-academy-data";
import { ExamService } from "@/services/academy-services";
import type { ExamStructureSection } from "@/services/supabase/exam-service";
import { useAcademy } from "./academy-context";
import { QueryState } from "./query-state";
import { ProgressLine, Surface } from "./primitives";

type Phase =
  | "intro"
  | "lesen"
  | "hoeren"
  | "schreiben"
  | "sprechen"
  | "review"
  | "done";

type PreviewState = {
  answers: Record<string, string>;
  flagged: string[];
  phase: Phase;
  teilIndex: number;
  questionIndex: number;
};

const SKILL_ORDER: Phase[] = ["lesen", "hoeren", "schreiben", "sprechen"];

function emptyState(): PreviewState {
  return { answers: {}, flagged: [], phase: "intro", teilIndex: 0, questionIndex: 0 };
}

function loadState(examId: string): PreviewState {
  try {
    const raw = sessionStorage.getItem(previewStorageKey(examId));
    if (!raw) return emptyState();
    return { ...emptyState(), ...JSON.parse(raw) };
  } catch {
    return emptyState();
  }
}

function saveState(examId: string, state: PreviewState) {
  sessionStorage.setItem(previewStorageKey(examId), JSON.stringify(state));
}

function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function B1StudentRunner({ mode = "preview" }: { mode?: "preview" | "live" }) {
  const { navigate } = useAcademy();
  const examsQuery = useAllExams();
  const search =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const examCode = search.get("examCode")?.trim() || "";
  const examIdParam =
    search.get("examId")?.trim() ||
    (mode === "live" && typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem("ga_active_exam_id")
      : null) ||
    "";

  const listExam = useMemo(() => {
    const rows = examsQuery.data ?? [];
    if (examIdParam) return rows.find((e) => e.id === examIdParam) ?? null;
    if (examCode) {
      return (
        rows.find(
          (e) => isB1ModelltestCode(e.code) && e.code?.toUpperCase() === examCode.toUpperCase(),
        ) ?? null
      );
    }
    return null;
  }, [examsQuery.data, examCode, examIdParam]);

  const examId = listExam?.id ?? "";
  const examQuery = useExam(examId || undefined);

  const [sections, setSections] = useState<ExamStructureSection[]>([]);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [structureError, setStructureError] = useState<Error | null>(null);
  const [state, setState] = useState<PreviewState>(emptyState());
  const [audioByTeil, setAudioByTeil] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!examId) return;
    setState(loadState(examId));
    return () => {
      // Keep preview answers for resume within the same exam session.
    };
  }, [examId]);

  useEffect(() => {
    let cancelled = false;
    if (!examId) return;
    setLoadingStructure(true);
    void (async () => {
      try {
        // Prefer staff structure for draft preview; fall back to getExam.
        let data: ExamStructureSection[] = [];
        try {
          data = await ExamService.listExamStructure(examId);
        } catch {
          const detail = await ExamService.getExam(examId);
          data = (detail?.sections ?? []) as ExamStructureSection[];
        }
        if (cancelled) return;
        setSections(data);

        const signed: Record<number, string> = {};
        const hoeren = data.find((s) => s.skill === "hoeren");
        for (const q of hoeren?.questions ?? []) {
          const meta =
            q.metadata && typeof q.metadata === "object"
              ? (q.metadata as Record<string, unknown>)
              : {};
          const teil = Number(meta["audio_slot"] ?? meta["teil"]);
          if (![1, 2, 3, 4].includes(teil) || signed[teil]) continue;
          if (typeof meta["audio_url"] === "string") {
            signed[teil] = meta["audio_url"];
            continue;
          }
          try {
            const url = await ExamService.getQuestionAudioSignedUrl(q);
            if (url) signed[teil] = url;
          } catch {
            /* ignore */
          }
        }
        if (!cancelled) setAudioByTeil(signed);
      } catch (e) {
        if (!cancelled) setStructureError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) setLoadingStructure(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId]);

  useEffect(() => {
    if (!examId) return;
    saveState(examId, state);
  }, [examId, state]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (state.phase !== "intro" && state.phase !== "done") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [state.phase]);

  const studentQuestions = useMemo(() => {
    const out: StudentFacingQuestion[] = [];
    for (const section of sections) {
      for (const q of section.questions ?? []) {
        out.push(
          toStudentFacingQuestion({
            id: q.id,
            prompt: q.prompt,
            type: q.type,
            skill: section.skill,
            sort_order: q.sort_order,
            metadata: q.metadata,
            options: (q.options ?? []).map((o) => ({
              id: o.id,
              label: o.label,
              value: o.value,
              text: o.label,
            })),
          }),
        );
      }
    }
    return out;
  }, [sections]);

  const bySkillTeil = useMemo(() => {
    const map = new Map<string, Map<number, StudentFacingQuestion[]>>();
    for (const q of studentQuestions) {
      if (!map.has(q.skill)) map.set(q.skill, new Map());
      const teil = q.teil ?? 1;
      const inner = map.get(q.skill)!;
      if (!inner.has(teil)) inner.set(teil, []);
      inner.get(teil)!.push(q);
    }
    for (const inner of map.values()) {
      for (const list of inner.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return map;
  }, [studentQuestions]);

  const currentSkill = state.phase === "intro" || state.phase === "review" || state.phase === "done"
    ? null
    : state.phase;

  const teile = currentSkill
    ? [...(bySkillTeil.get(currentSkill)?.keys() ?? [])].sort((a, b) => a - b)
    : [];
  const currentTeil = teile[state.teilIndex] ?? teile[0] ?? 1;
  const questionsInTeil =
    currentSkill && bySkillTeil.get(currentSkill)?.get(currentTeil)
      ? bySkillTeil.get(currentSkill)!.get(currentTeil)!
      : [];
  const currentQ = questionsInTeil[state.questionIndex] ?? null;

  const answeredCount = Object.keys(state.answers).length;
  const totalAccessible = studentQuestions.filter((q) => q.accessible).length;

  const goBackCatalog = () => {
    if (mode === "preview") navigate("b1-exam", { examCode: listExam?.code ?? examCode });
    else navigate("exams");
  };

  const setAnswer = (questionId: string, value: string) => {
    setState((prev) => ({
      ...prev,
      answers: { ...prev.answers, [questionId]: value },
    }));
  };

  const toggleFlag = (questionId: string) => {
    setState((prev) => {
      const has = prev.flagged.includes(questionId);
      return {
        ...prev,
        flagged: has ? prev.flagged.filter((id) => id !== questionId) : [...prev.flagged, questionId],
      };
    });
  };

  const nextQuestion = () => {
    if (state.questionIndex + 1 < questionsInTeil.length) {
      setState((p) => ({ ...p, questionIndex: p.questionIndex + 1 }));
      return;
    }
    if (state.teilIndex + 1 < teile.length) {
      setState((p) => ({ ...p, teilIndex: p.teilIndex + 1, questionIndex: 0 }));
      return;
    }
    const idx = SKILL_ORDER.indexOf(state.phase as (typeof SKILL_ORDER)[number]);
    if (idx >= 0 && idx + 1 < SKILL_ORDER.length) {
      setState((p) => ({
        ...p,
        phase: SKILL_ORDER[idx + 1]!,
        teilIndex: 0,
        questionIndex: 0,
      }));
      return;
    }
    setState((p) => ({ ...p, phase: "review" }));
  };

  const prevQuestion = () => {
    if (state.questionIndex > 0) {
      setState((p) => ({ ...p, questionIndex: p.questionIndex - 1 }));
      return;
    }
    if (state.teilIndex > 0) {
      const prevTeil = teile[state.teilIndex - 1]!;
      const prevList =
        currentSkill && bySkillTeil.get(currentSkill)?.get(prevTeil)
          ? bySkillTeil.get(currentSkill)!.get(prevTeil)!
          : [];
      setState((p) => ({
        ...p,
        teilIndex: p.teilIndex - 1,
        questionIndex: Math.max(0, prevList.length - 1),
      }));
      return;
    }
    const idx = SKILL_ORDER.indexOf(state.phase as (typeof SKILL_ORDER)[number]);
    if (idx > 0) {
      const prevSkill = SKILL_ORDER[idx - 1]!;
      const prevTeile = [...(bySkillTeil.get(prevSkill)?.keys() ?? [])].sort((a, b) => a - b);
      const lastTeil = prevTeile[prevTeile.length - 1] ?? 1;
      const lastList = bySkillTeil.get(prevSkill)?.get(lastTeil) ?? [];
      setState((p) => ({
        ...p,
        phase: prevSkill,
        teilIndex: Math.max(0, prevTeile.length - 1),
        questionIndex: Math.max(0, lastList.length - 1),
      }));
      return;
    }
    setState((p) => ({ ...p, phase: "intro" }));
  };

  if (!examCode && !examIdParam) {
    return (
      <Surface className="p-6">
        <p className="text-sm">Aucun examen sélectionné.</p>
        <Button className="mt-3" onClick={() => navigate("exams")}>
          Retour
        </Button>
      </Surface>
    );
  }

  return (
    <QueryState
      isLoading={examsQuery.isLoading || loadingStructure || examQuery.isLoading}
      isError={Boolean(structureError) || (!loadingStructure && !examId)}
      error={structureError}
      isEmpty={false}
    >
      <div className="mx-auto max-w-5xl pb-16">
        <header className="sticky top-0 z-20 mb-6 border-b border-border bg-background/95 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={goBackCatalog}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground"
            >
              <ArrowLeft className="size-4" />
              Quitter
            </button>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="truncate text-sm font-medium">
                {listExam?.title ?? examCode}{" "}
                {mode === "preview" ? "· Aperçu" : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                {state.phase === "intro"
                  ? "Introduction"
                  : state.phase === "review"
                    ? "Vérification"
                    : `${state.phase} · Teil ${currentTeil}`}
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
              <Clock3 className="size-4" />
              {listExam?.duration_minutes ?? 165} min
            </span>
          </div>
          <ProgressLine
            className="mt-4"
            value={totalAccessible ? (answeredCount / totalAccessible) * 100 : 0}
          />
        </header>

        {state.phase === "intro" ? (
          <Surface className="space-y-4 p-6 sm:p-8">
            <h1 className="text-2xl font-semibold">
              Examen blanc B1 – Modelltest {examCode.replace(/^B1-MT/i, "")}
            </h1>
            <p className="text-sm text-muted-foreground">
              Quatre modules : Lesen, Hören, Schreiben, Sprechen. Durée indicative{" "}
              {listExam?.duration_minutes ?? 165} minutes. Enregistrez régulièrement vos réponses.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Naviguez Teil par Teil — pas de bloc unique de 30 questions.</li>
              <li>Hören : un lecteur audio par Teil.</li>
              <li>Vous pouvez marquer une question à revoir avant la remise.</li>
            </ul>
            <Button
              onClick={() =>
                setState((p) => ({
                  ...p,
                  phase: "lesen",
                  teilIndex: 0,
                  questionIndex: 0,
                }))
              }
            >
              Commencer
            </Button>
          </Surface>
        ) : null}

        {state.phase === "review" ? (
          <Surface className="space-y-4 p-6">
            <h2 className="text-xl font-semibold">Vérification finale</h2>
            <p className="text-sm text-muted-foreground">
              Réponses enregistrées : {answeredCount}/{totalAccessible}
            </p>
            {SKILL_ORDER.map((skill) => {
              const qs = studentQuestions.filter((q) => q.skill === skill);
              const missing = qs.filter((q) => q.accessible && !state.answers[q.id]);
              const flagged = qs.filter((q) => state.flagged.includes(q.id));
              return (
                <div key={skill} className="rounded-md border border-border p-3 text-sm">
                  <p className="font-medium capitalize">{skill}</p>
                  <p className="text-muted-foreground">
                    Non répondues : {missing.length} · À revoir : {flagged.length}
                  </p>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setState((p) => ({ ...p, phase: "lesen" }))}>
                Retour
              </Button>
              <Button
                onClick={() => {
                  setState((p) => ({ ...p, phase: "done" }));
                  toast.success(
                    mode === "preview"
                      ? "Aperçu terminé (aucune remise réelle)"
                      : "Remise enregistrée",
                  );
                }}
              >
                Remettre définitivement
              </Button>
            </div>
          </Surface>
        ) : null}

        {state.phase === "done" ? (
          <Surface className="space-y-3 p-6">
            <h2 className="text-xl font-semibold">Remise effectuée</h2>
            <p className="text-sm text-muted-foreground">
              {mode === "preview"
                ? "Mode aperçu — aucune tentative officielle créée."
                : "Votre tentative a été soumise."}
            </p>
            <Button onClick={goBackCatalog}>Retour</Button>
          </Surface>
        ) : null}

        {currentSkill && currentQ ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_12rem]">
            <Surface className="p-6 sm:p-8">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {currentSkill} · Teil {currentTeil} · Question {state.questionIndex + 1}/
                {questionsInTeil.length}
              </p>
              {currentQ.instruction ? (
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{currentQ.instruction}</p>
              ) : null}
              {currentQ.passage ? (
                <div className="mt-4 whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-4 text-sm leading-6">
                  {currentQ.passage}
                </div>
              ) : null}

              {currentSkill === "hoeren" && audioByTeil[currentTeil] ? (
                <div className="mt-5 rounded-md border border-dashed p-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Headphones className="size-4" />
                    Audio Teil {currentTeil}
                  </div>
                  <audio
                    key={`${currentTeil}-${audioByTeil[currentTeil]}`}
                    className="mt-3 w-full"
                    controls
                    src={audioByTeil[currentTeil]}
                    preload="metadata"
                  />
                </div>
              ) : null}

              {currentQ.accessible ? (
                <>
                  <h2 className="mt-4 text-xl font-semibold leading-snug">{currentQ.prompt}</h2>
                  {currentQ.role ? (
                    <p className="mt-2 text-sm font-medium">Rôle : Kandidat {currentQ.role}</p>
                  ) : null}
                  {currentQ.requirements.length ? (
                    <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground">
                      {currentQ.requirements.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-6 space-y-3">
                    {(currentQ.type === "single_choice" ||
                      currentQ.type === "true_false" ||
                      currentQ.type === "listening" ||
                      currentQ.type === "matching") &&
                      currentQ.choices.map((option) => {
                        const selected = state.answers[currentQ.id] === option.value;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm ${
                              selected
                                ? "border-primary bg-primary/5 font-medium"
                                : "border-border hover:border-primary/40"
                            }`}
                            onClick={() => setAnswer(currentQ.id, option.value)}
                          >
                            <span className="font-medium">{option.label}</span>
                            <span>{option.text}</span>
                          </button>
                        );
                      })}

                    {(currentQ.type === "writing" ||
                      currentQ.type === "text" ||
                      currentQ.type === "speaking") && (
                      <div>
                        <Textarea
                          value={state.answers[currentQ.id] ?? ""}
                          onChange={(e) => setAnswer(currentQ.id, e.target.value)}
                          className="min-h-40"
                          placeholder={
                            currentQ.type === "speaking"
                              ? "Notes / script (enregistrement optionnel plus tard)"
                              : "Votre texte…"
                          }
                        />
                        <p className="mt-2 text-xs text-muted-foreground">
                          {countWords(state.answers[currentQ.id] ?? "")} mots
                          {currentQ.recommendedWords
                            ? ` · recommandé ${currentQ.recommendedWords}`
                            : ""}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="mt-6 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  {currentQ.inaccessibleReason}
                </div>
              )}

              <div className="mt-8 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={prevQuestion}>
                  Précédent
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (currentQ) toggleFlag(currentQ.id);
                  }}
                >
                  <Flag className="mr-1 size-3.5" />
                  {currentQ && state.flagged.includes(currentQ.id)
                    ? "Retirer le marquage"
                    : "Marquer à revoir"}
                </Button>
                <Button onClick={nextQuestion}>Enregistrer et continuer</Button>
              </div>
            </Surface>

            <aside className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Palette</p>
              <div className="grid grid-cols-5 gap-1 lg:grid-cols-3">
                {questionsInTeil.map((q, idx) => (
                  <button
                    key={q.id}
                    type="button"
                    className={`rounded border px-1 py-1.5 text-xs tabular-nums ${
                      idx === state.questionIndex
                        ? "border-primary bg-primary/10"
                        : state.answers[q.id]
                          ? "border-green-600/40"
                          : "border-border"
                    }`}
                    onClick={() => setState((p) => ({ ...p, questionIndex: idx }))}
                  >
                    {idx + 1}
                    {state.flagged.includes(q.id) ? "*" : ""}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-1 pt-2">
                {SKILL_ORDER.map((skill) => (
                  <Button
                    key={skill}
                    size="sm"
                    variant={state.phase === skill ? "default" : "ghost"}
                    onClick={() =>
                      setState((p) => ({
                        ...p,
                        phase: skill,
                        teilIndex: 0,
                        questionIndex: 0,
                      }))
                    }
                  >
                    {skill}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setState((p) => ({ ...p, phase: "review" }))}
                >
                  Vérification
                </Button>
              </div>
            </aside>
          </div>
        ) : null}

        {currentSkill && !currentQ ? (
          <Surface className="p-6 text-sm text-muted-foreground">
            Aucune question accessible dans ce module pour l’instant.
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" onClick={prevQuestion}>
                Précédent
              </Button>
              <Button onClick={nextQuestion}>Continuer</Button>
            </div>
          </Surface>
        ) : null}
      </div>
    </QueryState>
  );
}
