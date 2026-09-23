import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { computeB1ExamReadiness, isB1ModelltestCode } from "@/lib/b1-exam-readiness";
import { listHorenAudioSlots } from "@/lib/horen-audio-slots";
import { isPlaceholderPrompt } from "@/lib/b1-student-content";
import { useAllExams } from "@/hooks/use-academy-data";
import { ExamService } from "@/services/academy-services";
import type { ExamStructureQuestion, ExamStructureSection } from "@/services/supabase/exam-service";
import { useAcademy } from "./academy-context";
import { ExamBuilder } from "./exam-builder";
import { QueryState } from "./query-state";
import { ProgressLine, Status, Surface } from "./primitives";

function asMeta(m: unknown): Record<string, unknown> {
  return m && typeof m === "object" && !Array.isArray(m) ? (m as Record<string, unknown>) : {};
}

function teilOf(q: ExamStructureQuestion): number {
  const meta = asMeta(q.metadata);
  const n = Number(meta["teil"] ?? meta["audio_slot"] ?? meta["part"] ?? q.sort_order);
  return Number.isFinite(n) ? n : 0;
}

export function B1ExamWorkspace() {
  const { navigate } = useAcademy();
  const examsQuery = useAllExams();
  const search =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const examCode = search.get("examCode")?.trim() || "";
  const initialTab = search.get("b1Tab")?.trim() || "overview";

  const exam = useMemo(
    () =>
      (examsQuery.data ?? []).find(
        (e) => isB1ModelltestCode(e.code) && e.code?.toUpperCase() === examCode.toUpperCase(),
      ) ?? null,
    [examsQuery.data, examCode],
  );

  const [sections, setSections] = useState<ExamStructureSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [tab, setTab] = useState(initialTab);
  const [signedByPart, setSignedByPart] = useState<Record<number, string>>({});

  useEffect(() => {
    setTab(initialTab);
  }, [examCode, initialTab]);

  useEffect(() => {
    let cancelled = false;
    if (!exam?.id) {
      setSections([]);
      return;
    }
    setLoading(true);
    setError(null);
    setSignedByPart({});
    void (async () => {
      try {
        const data = await ExamService.listExamStructure(exam.id);
        if (cancelled) return;
        setSections(data);
        const slots = listHorenAudioSlots(
          data.flatMap((s) =>
            (s.questions ?? []).map((q) => ({
              skill: s.skill,
              type: q.type,
              media_path: q.media_path,
              media_bucket: q.media_bucket,
              metadata: q.metadata,
            })),
          ),
        );
        const signed: Record<number, string> = {};
        for (const slot of slots) {
          if (!slot.mediaPath) continue;
          const q = data
            .flatMap((s) => s.questions ?? [])
            .find((row) => row.media_path === slot.mediaPath);
          if (!q) continue;
          try {
            const url = await ExamService.getQuestionAudioSignedUrl(q);
            if (url) signed[slot.part] = url;
          } catch {
            /* keep empty */
          }
        }
        if (!cancelled) setSignedByPart(signed);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exam?.id]);

  const readiness = computeB1ExamReadiness({
    code: exam?.code ?? examCode,
    status: exam?.status ?? "draft",
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
        answer_key: q.answer_key
          ? {
              correct_values: q.answer_key.correct_values ?? null,
              teacher_payload: q.answer_key.teacher_payload ?? null,
            }
          : null,
        correct_values: q.answer_key?.correct_values ?? null,
      })),
    })),
  });

  const bySkill = (skill: string) => sections.find((s) => s.skill === skill);
  const anomalies = useMemo(() => {
    const out: Array<{
      exam: string;
      skill: string;
      teil: number;
      questionNumber: number;
      questionId: string;
      page: number | null;
      ocrOriginal: string;
      corrected: string;
      options: string[];
      status: string;
    }> = [];
    for (const section of sections) {
      for (const q of section.questions ?? []) {
        const meta = asMeta(q.metadata);
        if (!isPlaceholderPrompt(q.prompt, meta) && meta["review_status"] !== "needs_review") {
          continue;
        }
        const source = asMeta(meta["source"]);
        out.push({
          exam: examCode,
          skill: section.skill,
          teil: teilOf(q),
          questionNumber: q.sort_order,
          questionId: q.id,
          page:
            typeof source["source_pdf_page"] === "number"
              ? source["source_pdf_page"]
              : typeof meta["source_pdf_page"] === "number"
                ? meta["source_pdf_page"]
                : null,
          ocrOriginal: String(meta["ocr_raw_prompt"] ?? meta["ocr_original_prompt"] ?? q.prompt),
          corrected: q.prompt,
          options: (q.options ?? []).map((o) => `${o.label}: ${o.value}`),
          status: String(meta["review_status"] ?? meta["transform_status"] ?? "needs_review"),
        });
      }
    }
    return out;
  }, [sections, examCode]);

  const audioSlots = listHorenAudioSlots(
    sections.flatMap((s) =>
      (s.questions ?? []).map((q) => ({
        skill: s.skill,
        type: q.type,
        media_path: q.media_path,
        media_bucket: q.media_bucket,
        metadata: q.metadata,
      })),
    ),
  );

  if (!examCode) {
    return (
      <Surface className="p-6">
        <p className="text-sm text-muted-foreground">Aucun code examen. Retour au catalogue.</p>
        <Button className="mt-3" onClick={() => navigate("exams")}>
          Banque B1
        </Button>
      </Surface>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("exams")}>
          <ArrowLeft className="mr-1 size-4" />
          Catalogue
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">
            {examCode} · {exam?.title ?? "Examen B1"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Page indépendante — aucune donnée d’un autre Modelltest.
          </p>
        </div>
        <Status tone={exam?.status === "published" ? "green" : "amber"}>
          {exam?.status === "published" ? "Publié" : "Brouillon"}
        </Status>
        <Button
          size="sm"
          onClick={() =>
            navigate("b1-preview", {
              examCode,
              ...(exam?.id ? { examId: exam.id } : {}),
            })
          }
        >
          Tester comme étudiant
        </Button>
      </div>

      <QueryState
        isLoading={examsQuery.isLoading || loading}
        isError={Boolean(error) || examsQuery.isError || (!loading && !exam)}
        error={error ?? examsQuery.error}
        isEmpty={false}
      >
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 flex h-auto flex-wrap gap-1">
            <TabsTrigger value="overview">Vue générale</TabsTrigger>
            <TabsTrigger value="lesen">Lesen</TabsTrigger>
            <TabsTrigger value="hoeren">Hören</TabsTrigger>
            <TabsTrigger value="schreiben">Schreiben</TabsTrigger>
            <TabsTrigger value="sprechen">Sprechen</TabsTrigger>
            <TabsTrigger value="keys">Corrigés</TabsTrigger>
            <TabsTrigger value="ocr">Contrôle de transcription</TabsTrigger>
            <TabsTrigger value="edit">Modifier</TabsTrigger>
            <TabsTrigger value="test">Test étudiant</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <Surface className="space-y-3 p-5">
              <ProgressLine value={readiness.progress} />
              <p className="text-sm text-muted-foreground">
                Progression {readiness.progress}% · Barème pédagogique interne, à confirmer
              </p>
              <ul className="grid gap-2 text-sm sm:grid-cols-2">
                {readiness.progressDetail.map((row) => (
                  <li key={row.label} className="rounded-md border border-border px-3 py-2">
                    {row.label} · {row.earned}/{row.max}
                  </li>
                ))}
              </ul>
              <ul className="text-sm text-muted-foreground">
                <li>Lesen : {readiness.lesenReady}/{readiness.lesenTotal}</li>
                <li>
                  Hören : {readiness.audioReady}/4 pistes · Vérification {readiness.audioVerified}/4
                </li>
                <li>Schreiben : {readiness.schreibenTasks}/3</li>
                <li>Sprechen : {readiness.sprechenTasks}</li>
                <li>Clés objectives : {readiness.confirmedAnswerKeys}/60 module</li>
              </ul>
              {readiness.blockers.length ? (
                <div>
                  <p className="text-sm font-medium">Blocages publication</p>
                  <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                    {readiness.blockers.slice(0, 8).map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Surface>
          </TabsContent>

          {(["lesen", "schreiben", "sprechen"] as const).map((skill) => {
            const section = bySkill(skill);
            const groups = new Map<number, ExamStructureQuestion[]>();
            for (const q of section?.questions ?? []) {
              const t = teilOf(q) || 1;
              if (!groups.has(t)) groups.set(t, []);
              groups.get(t)!.push(q);
            }
            return (
              <TabsContent key={skill} value={skill} className="space-y-3">
                {[...groups.entries()]
                  .sort((a, b) => a[0] - b[0])
                  .map(([teil, qs]) => (
                    <Surface key={teil} className="p-4">
                      <h3 className="font-medium">
                        {skill === "schreiben" ? `Aufgabe ${teil}` : `Teil ${teil}`}
                        {skill === "sprechen" && qs[0]
                          ? (() => {
                              const role = asMeta(qs[0].metadata)["role"];
                              return typeof role === "string" ? ` · candidat ${role}` : "";
                            })()
                          : ""}
                      </h3>
                      <p className="text-xs text-muted-foreground">{qs.length} question(s)</p>
                      <ul className="mt-2 space-y-2 text-sm">
                        {qs.map((q) => (
                          <li key={q.id} className="rounded-md border border-border/70 px-3 py-2">
                            <span className="text-xs text-muted-foreground">#{q.sort_order}</span>{" "}
                            {isPlaceholderPrompt(q.prompt, q.metadata)
                              ? "À vérifier (transcription)"
                              : q.prompt.slice(0, 120)}
                          </li>
                        ))}
                      </ul>
                    </Surface>
                  ))}
              </TabsContent>
            );
          })}

          <TabsContent value="hoeren" className="space-y-3">
            {audioSlots.map((slot) => {
              const qs =
                bySkill("hoeren")?.questions?.filter((q) => teilOf(q) === slot.part) ?? [];
              return (
                <Surface key={slot.part} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium">Hören Teil {slot.part}</h3>
                    <Status
                      tone={
                        slot.verificationStatus === "content_verified"
                          ? "green"
                          : slot.hasAudio
                            ? "amber"
                            : "amber"
                      }
                    >
                      {slot.verificationStatus ?? (slot.hasAudio ? "needs_review" : "missing")}
                    </Status>
                  </div>
                  {slot.note ? (
                    <p className="text-xs text-amber-800 dark:text-amber-200">{slot.note}</p>
                  ) : null}
                  {signedByPart[slot.part] ? (
                    <audio className="w-full" controls src={signedByPart[slot.part]} preload="metadata" />
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {slot.hasAudio
                        ? "URL signée indisponible (droits ou fichier)."
                        : "Piste absente."}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {qs.length} questions associées · 1 lecteur pour ce Teil
                  </p>
                </Surface>
              );
            })}
          </TabsContent>

          <TabsContent value="keys" className="space-y-2">
            <Surface className="p-4 text-sm text-muted-foreground">
              Les clés objectives sont conservées. Statuts distincts dans le payload Teacher :
              structurally_valid / visually_confirmed / needs_review. Aucune clé n’est marquée
              visually_confirmed sans comparaison PDF.
            </Surface>
            {(bySkill("lesen")?.questions ?? [])
              .concat(bySkill("hoeren")?.questions ?? [])
              .map((q) => (
                <div key={q.id} className="rounded-md border border-border px-3 py-2 text-sm">
                  #{q.sort_order} · {q.answer_key?.correct_values?.join(", ") || "—"} ·{" "}
                  <span className="text-xs text-muted-foreground">
                    {String(
                      asMeta(q.answer_key?.teacher_payload)["verification_status"] ??
                        "structurally_valid",
                    )}
                  </span>
                </div>
              ))}
          </TabsContent>

          <TabsContent value="ocr" className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Visible Teacher/Admin uniquement. Les étudiants ne voient jamais ces entrées.
            </p>
            {anomalies.length === 0 ? (
              <Surface className="p-4 text-sm">Aucune anomalie OCR listée.</Surface>
            ) : (
              anomalies.map((a) => (
                <Surface key={a.questionId} className="space-y-2 p-4">
                  <p className="text-sm font-medium">
                    {a.exam} · {a.skill} · Teil {a.teil} · Q{a.questionNumber}
                    {a.page != null ? ` · page ${a.page}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">Statut : {a.status}</p>
                  <label className="block text-xs font-medium">OCR original</label>
                  <Textarea readOnly value={a.ocrOriginal.slice(0, 2000)} className="min-h-24 text-xs" />
                  <label className="block text-xs font-medium">Texte pédagogique</label>
                  <Textarea readOnly value={a.corrected.slice(0, 2000)} className="min-h-20 text-xs" />
                  <p className="text-xs text-muted-foreground">
                    Options : {a.options.slice(0, 8).join(" · ") || "—"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setTab("edit");
                        toast.success("Ouvrez le constructeur ci-dessous pour corriger la question.");
                      }}
                    >
                      Ouvrir le constructeur
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate("exams")}
                    >
                      Retour catalogue (Modifier)
                    </Button>
                  </div>
                </Surface>
              ))
            )}
          </TabsContent>

          <TabsContent value="edit">
            {exam?.id ? <ExamBuilder examId={exam.id} /> : null}
          </TabsContent>

          <TabsContent value="test" className="space-y-3">
            <Surface className="p-5">
              <p className="text-sm text-muted-foreground">
                Ouvre l’aperçu Student isolé pour {examCode} (brouillon autorisé en preview).
              </p>
              <Button
                className="mt-3"
                onClick={() =>
                  navigate("b1-preview", {
                    examCode,
                    ...(exam?.id ? { examId: exam.id } : {}),
                  })
                }
              >                Lancer le test étudiant
              </Button>
            </Surface>
          </TabsContent>
        </Tabs>
      </QueryState>
    </div>
  );
}
