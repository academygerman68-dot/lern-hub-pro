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
        <Surface className="space-y-3 border-primary/25 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <h4 className="text-sm font-semibold">Proposition IA</h4>
          </div>
          <p className="text-sm">
            Note suggérée :{" "}
            <span className="font-semibold">
              {suggestion.suggested_score} / {maxScore}
            </span>
          </p>
          {Object.keys(suggestion.criteria_scores).length > 0 ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Critères</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                {Object.entries(suggestion.criteria_scores).map(([key, value]) => (
                  <li key={key}>
                    {gradeAssistCriteriaLabel(key)} : {value}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {suggestion.strengths.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Points forts</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                {suggestion.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {suggestion.improvements.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">À améliorer</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                {suggestion.improvements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {suggestion.feedback ? (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Feedback proposé</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{suggestion.feedback}</p>
            </div>
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
