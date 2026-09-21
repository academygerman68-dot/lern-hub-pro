import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GradeAssistSuggestion } from "@/services/supabase/grade-assist-service";
import { gradeAssistCriteriaLabel } from "@/lib/grade-assist-ux";
import { Surface } from "./primitives";

type Props = {
  busy: boolean;
  disabled?: boolean;
  suggestion: GradeAssistSuggestion | null;
  statusMessage: string | null;
  maxScore: number;
  onRequest: () => void;
  onUse: () => void;
  onRegenerate: () => void;
  onIgnore: () => void;
};

export function AiGradeAssistPanel({
  busy,
  disabled,
  suggestion,
  statusMessage,
  maxScore,
  onRequest,
  onUse,
  onRegenerate,
  onIgnore,
}: Props) {
  const displayMax = suggestion?.max_score ?? maxScore;
  const criteriaRows =
    suggestion?.criteria?.length && suggestion.criteria.length > 0
      ? suggestion.criteria
      : Object.entries(suggestion?.criteria_scores ?? {}).map(([key, score]) => ({
          label: gradeAssistCriteriaLabel(key),
          score,
          max_score: displayMax,
        }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || busy}
          onClick={onRequest}
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          {busy ? "Analyse IA en cours…" : "Pré-corriger avec l’IA"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Proposition uniquement — la note n’est jamais publiée automatiquement.
        </p>
      </div>

      {busy ? (
        <Surface className="border-dashed p-4 text-sm text-muted-foreground">
          Analyse IA en cours…
        </Surface>
      ) : null}

      {!busy && statusMessage ? (
        <Surface className="border-amber-500/30 bg-amber-500/5 p-4 text-sm text-foreground">
          {statusMessage}
        </Surface>
      ) : null}

      {!busy && suggestion ? (
        <Surface className="space-y-5 border-primary/25 bg-primary/5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <h4 className="text-sm font-semibold">Proposition IA</h4>
          </div>

          <p className="text-sm">
            Note suggérée :{" "}
            <span className="font-semibold">
              {suggestion.suggested_score} / {displayMax}
            </span>
          </p>

          {criteriaRows.length > 0 ? (
            <section className="space-y-2">
              <h5 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Critères
              </h5>
              <ul className="space-y-1.5 text-sm">
                {criteriaRows.map((row) => (
                  <li
                    key={`${row.label}-${row.max_score}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/50 pb-1.5 last:border-0"
                  >
                    <span>{row.label}</span>
                    <span className="font-medium tabular-nums">
                      {row.score} / {row.max_score}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {suggestion.strengths.length > 0 ? (
            <section className="space-y-2">
              <h5 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                ✅ Points forts
              </h5>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {suggestion.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-3">
            <h5 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              ❌ Erreurs détectées
            </h5>
            {suggestion.errors.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                ✅ Aucune erreur importante détectée.
              </p>
            ) : (
              <div className="grid gap-3">
                {suggestion.errors.map((error, index) => (
                  <div
                    key={`${error.original}-${index}`}
                    className="rounded-xl border border-border/80 bg-background/80 p-3 sm:p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">Erreur {index + 1}</p>
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                        {error.category}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Phrase originale
                        </p>
                        <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted/60 px-2.5 py-2">
                          {error.original}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Correction</p>
                        <p className="mt-1 whitespace-pre-wrap rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 font-medium text-foreground">
                          {error.correction}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Explication</p>
                        <p className="mt-1 whitespace-pre-wrap leading-6">{error.explanation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {suggestion.improvements.length > 0 ? (
            <section className="space-y-2">
              <h5 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                🎯 À améliorer en priorité
              </h5>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {suggestion.improvements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {suggestion.feedback ? (
            <section className="space-y-2">
              <h5 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                💬 Feedback proposé
              </h5>
              <p className="whitespace-pre-wrap text-sm leading-6">{suggestion.feedback}</p>
            </section>
          ) : null}

          {suggestion.model_answer ? (
            <section className="space-y-2">
              <h5 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                📝 Exemple de réponse améliorée
              </h5>
              <p className="whitespace-pre-wrap rounded-xl border border-border/70 bg-background/70 p-3 text-sm leading-6">
                {suggestion.model_answer}
              </p>
              <p className="text-xs text-muted-foreground">
                Exemple pédagogique uniquement — il ne remplace pas la réponse de l’étudiant.
              </p>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" size="sm" onClick={onUse}>
              Utiliser cette proposition
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onRegenerate}>
              Régénérer
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onIgnore}>
              Ignorer
            </Button>
          </div>
        </Surface>
      ) : null}
    </div>
  );
}
