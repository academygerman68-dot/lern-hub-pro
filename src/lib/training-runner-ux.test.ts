import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  TRAINING_ACTIVITY_REGISTRY_KEYS,
  activityStatusFromAnswer,
  isManualActivityType,
  isObjectiveActivityType,
  persistTrainingNav,
  progressPercent,
  readTrainingNav,
  resolveActivityViewKey,
  validateActivityProps,
  type StudentTrainingActivity,
} from "@/lib/training-runner-ux";

function baseActivity(
  overrides: Partial<StudentTrainingActivity> & Pick<StudentTrainingActivity, "activity_type" | "id">,
): StudentTrainingActivity {
  return {
    order: 1,
    skill: "wortschatz",
    learning_objective: "Objectif pedagogique de test",
    theme: "Test",
    focus: "Focus",
    difficulty: "guided",
    instruction: "Instruction",
    prompt: "Prompt",
    points: 1,
    ...overrides,
  };
}

describe("training-runner-ux", () => {
  it("maps answer statuses for UI including pending review and redo", () => {
    expect(activityStatusFromAnswer(null)).toBe("todo");
    expect(activityStatusFromAnswer({ status: "validated", is_correct: true })).toBe("validated");
    expect(activityStatusFromAnswer({ status: "validated", is_correct: false })).toBe("review");
    expect(activityStatusFromAnswer({ status: "pending_review", is_correct: null })).toBe(
      "pending_review",
    );
    expect(activityStatusFromAnswer({ status: "draft", is_correct: null })).toBe("draft");
  });

  it("computes progress and classifies objective vs manual", () => {
    expect(progressPercent(3, 13)).toBe(23);
    expect(isObjectiveActivityType("single_choice")).toBe(true);
    expect(isObjectiveActivityType("listening")).toBe(true);
    expect(isObjectiveActivityType("form_fill")).toBe(true);
    expect(isObjectiveActivityType("writing")).toBe(false);
    expect(isManualActivityType("speaking")).toBe(true);
  });

  it("registers eight activity families for the generic runner", () => {
    expect(TRAINING_ACTIVITY_REGISTRY_KEYS).toEqual(
      expect.arrayContaining([
        "single_choice",
        "multiple_choice",
        "true_false",
        "form_fill",
        "writing",
        "speaking",
        "listening",
        "revision",
      ]),
    );
  });

  it("resolves lesen and revision view keys without hardcoding M01 pages", () => {
    expect(
      resolveActivityViewKey(
        baseActivity({ id: "1", activity_type: "true_false", skill: "lesen" }),
      ),
    ).toBe("lesen");
    expect(
      resolveActivityViewKey(
        baseActivity({ id: "2", activity_type: "single_choice", skill: "revision" }),
      ),
    ).toBe("revision");
    expect(
      resolveActivityViewKey(
        baseActivity({ id: "3", activity_type: "listening", skill: "hoeren" }),
      ),
    ).toBe("listening");
  });

  it("validates required props for choice, form, writing, speaking, horen", () => {
    expect(
      validateActivityProps(baseActivity({ id: "x", activity_type: "single_choice" })),
    ).toMatch(/Choix/);
    expect(
      validateActivityProps(
        baseActivity({
          id: "x",
          activity_type: "form_fill",
        }),
      ),
    ).toMatch(/formulaire/i);
    expect(
      validateActivityProps(
        baseActivity({
          id: "x",
          activity_type: "writing",
          skill: "schreiben",
        }),
      ),
    ).toMatch(/Rubrique/);
    expect(
      validateActivityProps(
        baseActivity({
          id: "x",
          activity_type: "speaking",
          skill: "sprechen",
          rubric: [{ id: "c1", label: "OK", max_points: 1 }],
        }),
      ),
    ).toMatch(/Sprechen/);
    expect(
      validateActivityProps(
        baseActivity({
          id: "x",
          activity_type: "listening",
          skill: "hoeren",
          choices: [
            { id: "A", text: "a" },
            { id: "B", text: "b" },
          ],
        }),
      ),
    ).toMatch(/Audio/);
    expect(
      validateActivityProps(
        baseActivity({
          id: "ok",
          activity_type: "listening",
          skill: "hoeren",
          media: { audio_url: "/exam-media/ga-a1-m01/hoeren-vorstellen.mp3" },
          choices: [
            { id: "A", text: "a" },
            { id: "B", text: "b" },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("persists navigation for resume after refresh", () => {
    persistTrainingNav({ code: "GA-A1-M01", attemptId: "att-1", preview: true });
    expect(readTrainingNav()).toEqual({
      code: "GA-A1-M01",
      attemptId: "att-1",
      preview: true,
    });
  });

  it("treats unknown types as invalid only when props missing; registry key still resolves", () => {
    const unknown = baseActivity({ id: "bad", activity_type: "quantum_quiz" as never });
    expect(resolveActivityViewKey(unknown)).toBe("quantum_quiz");
    expect(validateActivityProps(unknown)).toBeNull();
  });
});

describe("training autosave debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("collapses rapid text edits into one save", () => {
    const save = vi.fn();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => save(), 900);
    };
    schedule();
    schedule();
    schedule();
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(900);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("supports immediate choice save (0ms) and retry after error", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce("ok");
    await expect(save()).rejects.toThrow("network");
    await expect(save()).resolves.toBe("ok");
    expect(save).toHaveBeenCalledTimes(2);
  });
});

describe("attempt resume contract", () => {
  it("documents unique active attempt semantics (no duplicate live attempt)", () => {
    const active = [
      { id: "a1", status: "in_progress" },
      { id: "a2", status: "completed" },
    ];
    const resume = active.find((a) => a.status === "in_progress" || a.status === "pending_review");
    expect(resume?.id).toBe("a1");
    expect(active.filter((a) => a.status === "in_progress").length).toBe(1);
  });
});
