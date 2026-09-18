import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ExamService } from "@/services/academy-services";
import type {
  ExamQuestionType,
  ExamSkill,
  ExamStructureSection,
} from "@/services/supabase/exam-service";
import { Surface } from "./primitives";

type ChoiceDraft = { label: string; correct: boolean };

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

  const isQcm = qType === "single_choice" || qType === "multiple_choice";

  return (
    <Surface className="mt-4 space-y-4 border-dashed p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Constructeur QCM / Writing</h3>
          <p className="text-sm text-muted-foreground">
            Ajoutez des sections, questions et réponses. Les QCM sont corrigés automatiquement.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void reload()} disabled={loading}>
          Actualiser
        </Button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}

      <div className="space-y-3">
        {sections.map((section) => (
          <div key={section.id} className="rounded-lg border border-border p-3">
            <p className="font-medium">
              {section.title}{" "}
              <span className="text-xs text-muted-foreground">
                · {section.skill} · {section.questions?.length ?? 0} question(s)
              </span>
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {(section.questions ?? []).map((q) => (
                <li key={q.id}>
                  [{q.type}] {q.prompt.slice(0, 80)}
                  {q.prompt.length > 80 ? "…" : ""} · {q.points} pt
                </li>
              ))}
            </ul>
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
            <option value="lesen">Lecture (Lesen)</option>
            <option value="hoeren">Écoute (Hören)</option>
            <option value="schreiben">Écriture (Schreiben)</option>
            <option value="sprechen">Oral (Sprechen)</option>
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
            <option value="single_choice">QCM — une bonne réponse</option>
            <option value="multiple_choice">QCM — plusieurs bonnes réponses</option>
            <option value="writing">Writing — texte libre</option>
          </select>
        </label>
        <label className="block text-sm">
          Énoncé
          <Textarea
            className="mt-1"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Question ou consigne"
          />
        </label>
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
