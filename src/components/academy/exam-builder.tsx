import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  countHorenAudioReady,
  EXAM_AUDIO_ACCEPT,
  questionHasAudio,
  questionNeedsHorenAudio,
  validateExamAudioFile,
  validateExamCompleteness,
} from "@/lib/exam-completeness";
import {
  countHorenAudioReady as countHorenAudioReadySlots,
  countHorenAudioVerifiedSlots,
  listHorenAudioSlots,
} from "@/lib/horen-audio-slots";
import { examQuestionTypeLabel, examSkillLabel } from "@/lib/exam-labels";
import { useAcademy } from "./academy-context";
import { ExamService } from "@/services/academy-services";
import type {
  ExamQuestionType,
  ExamSkill,
  ExamStructureQuestion,
  ExamStructureSection,
} from "@/services/supabase/exam-service";
import { Status, Surface } from "./primitives";

type ChoiceDraft = { label: string; correct: boolean };

const SKILL_GROUP_ORDER = ["lesen", "hoeren", "schreiben"] as const;

function HorenQuestionAudioRow({
  question,
  skill,
  onChanged,
}: {
  question: ExamStructureQuestion;
  skill: string;
  onChanged: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const ready = questionHasAudio(question);
  const needsAudio = questionNeedsHorenAudio(skill, question.type);

  if (!needsAudio) {
    return (
      <li className="text-sm text-muted-foreground">
        [{examQuestionTypeLabel(question.type)}] {question.prompt.slice(0, 80)}
        {question.prompt.length > 80 ? "…" : ""} · {question.points} pt
      </li>
    );
  }

  const listen = async () => {
    setPreviewError(null);
    setPreviewUrl(null);
    setBusy(true);
    try {
      const url = await ExamService.getQuestionAudioSignedUrl(question);
      if (!url) throw new Error("Aucun audio disponible");
      setPreviewUrl(url);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Lecture impossible");
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File | null) => {
    if (!file) return;
    const reason = validateExamAudioFile(file);
    if (reason) {
      toast.error(reason);
      return;
    }
    setBusy(true);
    try {
      await ExamService.uploadQuestionAudio(question.id, file);
      toast.success(ready ? "Audio remplacé" : "Audio ajouté");
      setPreviewUrl(null);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Téléversement impossible");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-foreground">
            [{examQuestionTypeLabel(question.type)}] {question.prompt.slice(0, 80)}
            {question.prompt.length > 80 ? "…" : ""} · {question.points} pt
          </p>
          <p className="mt-1">
            {ready ? (
              <Status tone="green">✓ Audio disponible</Status>
            ) : (
              <Status tone="amber">⚠ Audio manquant</Status>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept={EXAM_AUDIO_ACCEPT}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              e.target.value = "";
              void upload(file);
            }}
          />
          {!ready ? (
            <Button size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              Ajouter l’audio
            </Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => void listen()}>
                Écouter
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                Remplacer
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm("Supprimer l’audio de cette question ?")) return;
                  setBusy(true);
                  void ExamService.clearQuestionAudio(question.id)
                    .then(async () => {
                      toast.success("Audio supprimé");
                      setPreviewUrl(null);
                      await onChanged();
                    })
                    .catch((err: Error) => toast.error(err.message))
                    .finally(() => setBusy(false));
                }}
              >
                Supprimer
              </Button>
            </>
          )}
        </div>
      </div>
      {previewError ? <p className="text-xs text-destructive">{previewError}</p> : null}
      {previewUrl ? (
        <audio className="w-full" controls src={previewUrl} preload="metadata">
          Votre navigateur ne prend pas en charge l’audio.
        </audio>
      ) : null}
    </li>
  );
}

function HorenSlotVerificationPanel({
  examId,
  questions,
  onChanged,
}: {
  examId: string;
  questions: Array<{
    skill: string;
    type: string;
    media_path?: string | null;
    media_bucket?: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
  onChanged: () => Promise<void>;
}) {
  const { user } = useAcademy();
  const slots = listHorenAudioSlots(questions);
  const [busySlot, setBusySlot] = useState<number | null>(null);
  const [previewBySlot, setPreviewBySlot] = useState<Record<number, string>>({});

  const listen = async (part: number) => {
    const sample = questions.find((q) => {
      if (q.skill !== "hoeren" && q.type !== "listening") return false;
      const meta = q.metadata ?? {};
      const slot = Number(meta["audio_slot"] ?? meta["teil"]);
      return slot === part && questionHasAudio(q);
    });
    if (!sample) {
      toast.error(`Aucune piste pour le Teil ${part}`);
      return;
    }
    setBusySlot(part);
    try {
      const url = await ExamService.getQuestionAudioSignedUrl({
        media_bucket: sample.media_bucket ?? null,
        media_path: sample.media_path ?? null,
        metadata: sample.metadata as never,
      });
      if (!url) throw new Error("URL signée indisponible");
      setPreviewBySlot((prev) => ({ ...prev, [part]: url }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lecture impossible");
    } finally {
      setBusySlot(null);
    }
  };

  const confirm = async (part: number) => {
    if (
      !window.confirm(
        `Confirmer que vous avez réellement écouté la piste Hören Teil ${part} et qu’elle correspond à cet examen ?`,
      )
    ) {
      return;
    }
    const verifiedBy = user?.email || user?.id || "staff";
    setBusySlot(part);
    try {
      await ExamService.confirmHorenSlotVerification({
        examId,
        partNumber: part,
        verifiedBy,
      });
      toast.success(`Teil ${part} marqué vérifié par écoute`);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Confirmation impossible");
    } finally {
      setBusySlot(null);
    }
  };

  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-sm font-semibold">Hören — 4 pistes (autorité = media_path questions)</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Inventaire `exam_audio_tracks` éventuel = miroir admin uniquement. Ne confirmez une piste
        qu’après écoute réelle. La confirmation enregistre qui / quand.
      </p>
      <ul className="mt-3 space-y-3">
        {slots.map((slot) => (
          <li key={slot.part} className="rounded-md border border-border/70 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">Teil {slot.part}</p>
                <p className="text-xs text-muted-foreground">
                  {slot.hasAudio ? slot.mediaPath || "fichier présent" : "piste absente"}
                  {slot.verificationStatus
                    ? ` · ${slot.verificationStatus}`
                    : " · needs_review"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busySlot === slot.part || !slot.hasAudio}
                  onClick={() => void listen(slot.part)}
                >
                  Écouter
                </Button>
                <Button
                  size="sm"
                  disabled={
                    busySlot === slot.part ||
                    !slot.hasAudio ||
                    slot.verificationStatus === "content_verified"
                  }
                  onClick={() => void confirm(slot.part)}
                >
                  Confirmer l’écoute
                </Button>
              </div>
            </div>
            {previewBySlot[slot.part] ? (
              <audio
                className="mt-2 w-full"
                controls
                src={previewBySlot[slot.part]}
                preload="metadata"
              >
                Votre navigateur ne prend pas en charge l’audio.
              </audio>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ExamBuilder({ examId }: { examId: string }) {
  const [sections, setSections] = useState<ExamStructureSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionSkill, setSectionSkill] = useState<ExamSkill>("lesen");
  const [activeSectionId, setActiveSectionId] = useState<string>("");
  const [qType, setQType] = useState<ExamQuestionType>("single_choice");
  const [prompt, setPrompt] = useState("");
  const [points, setPoints] = useState("1");
  const [choices, setChoices] = useState<ChoiceDraft[]>([
    { label: "", correct: true },
    { label: "", correct: false },
  ]);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await ExamService.listExamStructure(examId);
      setSections(data);
      if (!activeSectionId && data[0]) setActiveSectionId(data[0].id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  const isQcm = qType === "single_choice" || qType === "multiple_choice" || qType === "true_false";

  const flatQuestions = useMemo(
    () =>
      sections.flatMap((section) =>
        (section.questions ?? []).map((q) => ({
          id: q.id,
          prompt: q.prompt,
          type: q.type,
          points: Number(q.points),
          media_path: q.media_path,
          media_bucket: q.media_bucket,
          metadata:
            q.metadata && typeof q.metadata === "object" && !Array.isArray(q.metadata)
              ? (q.metadata as Record<string, unknown>)
              : null,
          skill: section.skill,
          sectionTitle: section.title,
          correct_values: q.answer_key?.correct_values ?? null,
          teacher_payload:
            q.answer_key?.teacher_payload &&
            typeof q.answer_key.teacher_payload === "object" &&
            !Array.isArray(q.answer_key.teacher_payload)
              ? (q.answer_key.teacher_payload as Record<string, unknown>)
              : null,
        })),
      ),
    [sections],
  );

  const completeness = useMemo(() => validateExamCompleteness(flatQuestions), [flatQuestions]);
  const horenStats = useMemo(() => countHorenAudioReady(flatQuestions), [flatQuestions]);
  const horenSlotMode = useMemo(
    () => countHorenAudioReadySlots(flatQuestions).mode === "slots",
    [flatQuestions],
  );
  const horenVerified = useMemo(
    () => (horenSlotMode ? countHorenAudioVerifiedSlots(flatQuestions) : null),
    [flatQuestions, horenSlotMode],
  );

  const skillGroups = useMemo(() => {
    const groups = new Map<
      string,
      { skill: string; count: number; points: number; sections: ExamStructureSection[] }
    >();
    for (const section of sections) {
      const key = section.skill || "other";
      const existing = groups.get(key) ?? {
        skill: key,
        count: 0,
        points: 0,
        sections: [] as ExamStructureSection[],
      };
      const qs = section.questions ?? [];
      existing.count += qs.length;
      existing.points += qs.reduce((sum, q) => sum + Number(q.points ?? 0), 0);
      existing.sections.push(section);
      groups.set(key, existing);
    }
    const ordered = SKILL_GROUP_ORDER.filter((s) => groups.has(s)).map((s) => groups.get(s)!);
    for (const [key, value] of groups) {
      if (!(SKILL_GROUP_ORDER as readonly string[]).includes(key)) ordered.push(value);
    }
    return ordered;
  }, [sections]);

  return (
    <Surface className="mt-4 space-y-4 border-dashed p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Constructeur d’examen</h3>
          <p className="text-sm text-muted-foreground">
            Sections, questions, barème et audios Hören. Publication bloquée si incomplet.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void reload()} disabled={loading}>
          Actualiser
        </Button>
      </div>

      {!loading ? (
        <div
          className={`rounded-lg border p-3 text-sm ${
            completeness.ok
              ? "border-success/30 bg-success-soft/40"
              : "border-amber-200 bg-warning-soft/50"
          }`}
        >
          <p className="font-medium">
            {completeness.ok ? "Examen complet — prêt à publier" : "Examen incomplet"}
          </p>
          <p className="mt-1 text-muted-foreground">
            {horenSlotMode
              ? `Hören : ${horenStats.ready}/4 pistes disponibles${
                  horenVerified != null
                    ? ` · ${horenVerified}/4 pistes vérifiées par écoute`
                    : ""
                }`
              : `Écoute : ${horenStats.ready} / ${horenStats.total} audios prêts`}
          </p>
          {!completeness.ok ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {completeness.issues.slice(0, 8).map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
              {completeness.issues.length > 8 ? (
                <li>+ {completeness.issues.length - 8} autre(s)…</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}

      {!loading && horenSlotMode ? (
        <HorenSlotVerificationPanel
          examId={examId}
          questions={flatQuestions.map((q) => ({
            skill: String(q.skill),
            type: String(q.type),
            media_path: q.media_path,
            media_bucket: q.media_bucket,
            metadata: q.metadata,
          }))}
          onChanged={reload}
        />
      ) : null}

      {loading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}

      <div className="space-y-4">
        {skillGroups.map((group) => (
          <div key={group.skill} className="space-y-2">
            <p className="text-sm font-semibold">
              {examSkillLabel(group.skill)}{" "}
              <span className="font-normal text-muted-foreground">
                · {group.count} question{group.count > 1 ? "s" : ""} · {group.points} pt
                {group.points > 1 ? "s" : ""}
                {group.skill === "hoeren"
                  ? horenSlotMode
                    ? ` · ${horenStats.ready}/4 pistes`
                    : ` · ${horenStats.ready}/${horenStats.total} audios prêts`
                  : ""}
              </span>
            </p>
            {group.sections.map((section) => (
              <div key={section.id} className="rounded-lg border border-border p-3">
                <p className="font-medium">
                  {section.title}{" "}
                  <span className="text-xs text-muted-foreground">
                    · {examSkillLabel(section.skill)} · {section.questions?.length ?? 0} question(s)
                  </span>
                </p>
                <ul className="mt-2 space-y-2">
                  {(section.questions ?? []).map((q) => (
                    <HorenQuestionAudioRow
                      key={q.id}
                      question={q}
                      skill={section.skill}
                      onChanged={reload}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
        {!loading && sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune section — créez la première ci-dessous.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          Nouvelle section
          <Input
            className="mt-1"
            placeholder="Titre de section (ex. Compréhension, Expression écrite)"
            value={sectionTitle}
            onChange={(e) => setSectionTitle(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Compétence
          <select
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={sectionSkill}
            onChange={(e) => setSectionSkill(e.target.value as ExamSkill)}
          >
            <option value="lesen">{examSkillLabel("lesen")}</option>
            <option value="hoeren">{examSkillLabel("hoeren")}</option>
            <option value="schreiben">{examSkillLabel("schreiben")}</option>
            <option value="sprechen">{examSkillLabel("sprechen")}</option>
            <option value="grammatik">Grammaire</option>
            <option value="wortschatz">Vocabulaire</option>
          </select>
        </label>
        <div className="flex items-end">
          <Button
            disabled={!sectionTitle.trim() || saving}
            onClick={() => {
              void (async () => {
                setSaving(true);
                try {
                  const created = await ExamService.createSection({
                    examId,
                    title: sectionTitle.trim(),
                    skill: sectionSkill,
                    sortOrder: sections.length + 1,
                  });
                  setSectionTitle("");
                  setActiveSectionId(created.id);
                  toast.success("Section ajoutée");
                  await reload();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Création impossible");
                } finally {
                  setSaving(false);
                }
              })();
            }}
          >
            Ajouter la section
          </Button>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <h4 className="font-medium">Ajouter une question</h4>
        <label className="block text-sm">
          Section
          <select
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={activeSectionId}
            onChange={(e) => setActiveSectionId(e.target.value)}
          >
            <option value="">Choisir une section</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Type
          <select
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={qType}
            onChange={(e) => setQType(e.target.value as ExamQuestionType)}
          >
            <option value="true_false">{examQuestionTypeLabel("true_false")}</option>
            <option value="single_choice">{examQuestionTypeLabel("single_choice")}</option>
            <option value="multiple_choice">{examQuestionTypeLabel("multiple_choice")}</option>
            <option value="listening">{examQuestionTypeLabel("listening")}</option>
            <option value="writing">{examQuestionTypeLabel("writing")}</option>
            <option value="speaking">{examQuestionTypeLabel("speaking")}</option>
          </select>
        </label>
        <label className="block text-sm">
          {qType === "writing"
            ? "Consigne d’expression écrite"
            : qType === "speaking"
              ? "Consigne d’expression orale (Sprechen)"
              : "Énoncé"}
          <Textarea
            className="mt-1"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              qType === "writing"
                ? "Tapez uniquement le sujet / la consigne — aucun fichier requis"
                : qType === "speaking"
                  ? "Ex. Présentez-vous en 1–2 minutes. Parlez de votre famille et de votre ville."
                  : "Question ou consigne"
            }
          />
        </label>
        {qType === "writing" ? (
          <p className="text-xs text-muted-foreground">
            Type rédaction : saisissez le texte, ajoutez les points, puis publiez l’examen quand
            il est complet.
          </p>
        ) : null}
        {qType === "speaking" ? (
          <p className="text-xs text-muted-foreground">
            Section orale facultative : l’étudiant enregistre ou dépose un audio privé. Sans
            question « speaking », les examens existants restent inchangés.
          </p>
        ) : null}
        <label className="block text-sm">
          Points
          <Input
            className="mt-1"
            type="number"
            min={0.5}
            step={0.5}
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </label>
        {isQcm ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Choix</p>
            {choices.map((choice, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder={`Choix ${index + 1}`}
                  value={choice.label}
                  onChange={(e) => {
                    const next = [...choices];
                    next[index] = { ...next[index]!, label: e.target.value };
                    setChoices(next);
                  }}
                />
                <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                  <input
                    type={qType === "single_choice" ? "radio" : "checkbox"}
                    name="correct-choice"
                    checked={choice.correct}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setChoices((prev) =>
                        prev.map((c, i) =>
                          qType === "single_choice"
                            ? { ...c, correct: i === index }
                            : i === index
                              ? { ...c, correct: checked }
                              : c,
                        ),
                      );
                    }}
                  />
                  Correct
                </label>
              </div>
            ))}
            {choices.length < 6 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setChoices((prev) => [...prev, { label: "", correct: false }])}
              >
                + Choix
              </Button>
            ) : null}
          </div>
        ) : null}
        <Button
          disabled={!activeSectionId || !prompt.trim() || saving}
          onClick={() => {
            void (async () => {
              setSaving(true);
              try {
                const section = sections.find((s) => s.id === activeSectionId);
                const question = await ExamService.createQuestion({
                  sectionId: activeSectionId,
                  type: qType,
                  prompt: prompt.trim(),
                  points: Number(points) || 1,
                  sortOrder: (section?.questions?.length ?? 0) + 1,
                  ...(qType === "speaking"
                    ? {
                        metadata: {
                          instruction: prompt.trim(),
                          rubric: {
                            task_completion: 4,
                            fluency: 2,
                            pronunciation: 2,
                            vocabulary: 2,
                          },
                        },
                      }
                    : {}),
                });
                if (isQcm) {
                  const filled = choices.filter((c) => c.label.trim());
                  if (filled.length < 2) throw new Error("Ajoutez au moins deux choix.");
                  const correct = filled.filter((c) => c.correct);
                  if (correct.length < 1) throw new Error("Marquez au moins une bonne réponse.");
                  await ExamService.createOptions(
                    question.id,
                    filled.map((c, i) => ({
                      label: c.label.trim(),
                      value: `opt_${i + 1}`,
                      sortOrder: i + 1,
                    })),
                  );
                  await ExamService.setAnswerKey(
                    question.id,
                    filled
                      .map((c, i) => (c.correct ? `opt_${i + 1}` : null))
                      .filter((v): v is string => Boolean(v)),
                  );
                }
                await ExamService.syncSectionMaxScore(activeSectionId);
                setPrompt("");
                setChoices([
                  { label: "", correct: true },
                  { label: "", correct: false },
                ]);
                toast.success("Question ajoutée");
                await reload();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Création impossible");
              } finally {
                setSaving(false);
              }
            })();
          }}
        >
          Ajouter la question
        </Button>
      </div>
    </Surface>
  );
}
