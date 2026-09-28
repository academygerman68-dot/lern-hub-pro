import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Json } from "@/types/database";

function requireClient() {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase();
}

export type TrainingAttemptKind = "live" | "preview";

export type TrainingLearnerModule = {
  id: string;
  code: string;
  status: string;
  level_code: string;
  preview: boolean;
  definition: Record<string, unknown>;
};

export type TrainingAttemptRow = {
  id: string;
  module_id: string;
  student_id: string | null;
  profile_id: string;
  kind: TrainingAttemptKind;
  status: string;
  current_activity_id: string | null;
  started_at: string;
  completed_at: string | null;
  last_saved_at: string | null;
  summary: Json;
  created_at?: string;
  updated_at?: string;
};

export type TrainingAnswerRow = {
  id: string;
  attempt_id: string;
  activity_id: string;
  activity_type: string;
  status: string;
  answer: Json | null;
  is_correct: boolean | null;
  points_awarded: number | null;
  attempt_count: number;
  first_is_correct: boolean | null;
  best_is_correct: boolean | null;
  feedback_short: string | null;
  explanation: string | null;
  common_error: string | null;
  positive_feedback: string | null;
  teacher_comment: string | null;
  grading_detail: Json | null;
  answer_media_bucket: string | null;
  answer_media_path: string | null;
  answer_mime_type: string | null;
  answer_duration_seconds: number | null;
  answered_at: string | null;
};

function client() {
  return requireClient() as any;
}

export const TrainingService = {
  async listModulesForCatalog(): Promise<
    Array<{ id: string; code: string; title: string; theme: string | null; level_code: string; status: string; estimated_minutes: number }>
  > {
    const { data, error } = await client()
      .from("training_modules")
      .select("id, code, title, theme, level_code, status, estimated_minutes")
      .order("code");
    if (error) throw error;
    return data ?? [];
  },

  async getModuleForLearner(code: string, preview = false): Promise<TrainingLearnerModule> {
    const { data, error } = await client().rpc("get_training_module_for_learner", {
      p_code: code,
      p_preview: preview,
    });
    if (error) throw error;
    return data as TrainingLearnerModule;
  },

  async startOrResume(code: string, kind: TrainingAttemptKind = "live"): Promise<TrainingAttemptRow> {
    const { data, error } = await client().rpc("start_or_resume_training_attempt", {
      p_module_code: code,
      p_kind: kind,
    });
    if (error) throw error;
    return data as TrainingAttemptRow;
  },

  async listAnswers(attemptId: string): Promise<TrainingAnswerRow[]> {
    const { data, error } = await client()
      .from("training_module_answers")
      .select("*")
      .eq("attempt_id", attemptId);
    if (error) throw error;
    return (data ?? []) as TrainingAnswerRow[];
  },

  async getAttempt(attemptId: string): Promise<TrainingAttemptRow | null> {
    const { data, error } = await client()
      .from("training_module_attempts")
      .select("*")
      .eq("id", attemptId)
      .maybeSingle();
    if (error) throw error;
    return data as TrainingAttemptRow | null;
  },

  async saveDraft(input: {
    attemptId: string;
    activityId: string;
    activityType: string;
    answer: Json;
    currentActivityId?: string;
  }): Promise<TrainingAnswerRow> {
    const { data, error } = await client().rpc("save_training_answer_draft", {
      p_attempt_id: input.attemptId,
      p_activity_id: input.activityId,
      p_activity_type: input.activityType,
      p_answer: input.answer,
      p_current_activity_id: input.currentActivityId ?? input.activityId,
    });
    if (error) throw error;
    return data as TrainingAnswerRow;
  },

  async validateObjective(input: {
    attemptId: string;
    activityId: string;
    answer: Json;
  }): Promise<Record<string, unknown>> {
    const { data, error } = await client().rpc("validate_training_objective_answer", {
      p_attempt_id: input.attemptId,
      p_activity_id: input.activityId,
      p_answer: input.answer,
    });
    if (error) throw error;
    return data as Record<string, unknown>;
  },

  async submitManual(input: {
    attemptId: string;
    activityId: string;
    activityType: "writing" | "speaking";
    answer: Json;
    mediaBucket?: string | null;
    mediaPath?: string | null;
    mimeType?: string | null;
    durationSeconds?: number | null;
  }): Promise<TrainingAnswerRow> {
    const { data, error } = await client().rpc("submit_training_manual_answer", {
      p_attempt_id: input.attemptId,
      p_activity_id: input.activityId,
      p_activity_type: input.activityType,
      p_answer: input.answer,
      p_media_bucket: input.mediaBucket ?? null,
      p_media_path: input.mediaPath ?? null,
      p_mime_type: input.mimeType ?? null,
      p_duration_seconds: input.durationSeconds ?? null,
    });
    if (error) throw error;
    return data as TrainingAnswerRow;
  },

  async uploadOral(input: {
    attemptId: string;
    activityId: string;
    file: Blob;
    mimeType: string;
    previousPath?: string | null;
  }): Promise<{ bucket: string; path: string; mimeType: string }> {
    const supabase = requireClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("NOT_AUTHENTICATED");
    const ext = input.mimeType.includes("mp4")
      ? "mp4"
      : input.mimeType.includes("mpeg")
        ? "mp3"
        : input.mimeType.includes("wav")
          ? "wav"
          : "webm";
    const objectId = crypto.randomUUID();
    const path = `${user.id}/${input.attemptId}/${input.activityId}/${objectId}.${ext}`;
    const { error } = await supabase.storage.from("training-oral").upload(path, input.file, {
      contentType: input.mimeType,
      upsert: false,
    });
    if (error) throw error;
    if (input.previousPath && input.previousPath !== path) {
      await supabase.storage.from("training-oral").remove([input.previousPath]).catch(() => undefined);
    }
    return { bucket: "training-oral", path, mimeType: input.mimeType };
  },

  async getOralSignedUrl(bucket: string, path: string): Promise<string> {
    const { data, error } = await requireClient().storage.from(bucket).createSignedUrl(path, 120);
    if (error) throw error;
    return data.signedUrl;
  },

  async completeAttempt(attemptId: string): Promise<TrainingAttemptRow> {
    const { data, error } = await client().rpc("complete_training_attempt", {
      p_attempt_id: attemptId,
    });
    if (error) throw error;
    return data as TrainingAttemptRow;
  },

  async listLiveAttemptsForTeacher(): Promise<
    Array<
      TrainingAttemptRow & {
        module?: { code: string; title: string } | null;
        student?: { id: string } | null;
      }
    >
  > {
    const { data, error } = await client()
      .from("training_module_attempts")
      .select(
        `
        *,
        module:training_modules!training_module_attempts_module_id_fkey ( code, title ),
        student:students!training_module_attempts_student_id_fkey ( id )
      `,
      )
      .eq("kind", "live")
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Array<
      TrainingAttemptRow & {
        module?: { code: string; title: string } | null;
        student?: { id: string } | null;
      }
    >;
  },

  async gradeManual(input: {
    answerId: string;
    points: number;
    teacherComment: string;
    gradingDetail?: Json;
    finalize?: boolean;
  }): Promise<TrainingAnswerRow> {
    const { data, error } = await client().rpc("grade_training_manual_answer", {
      p_answer_id: input.answerId,
      p_points: input.points,
      p_teacher_comment: input.teacherComment,
      p_grading_detail: input.gradingDetail ?? {},
      p_finalize: input.finalize ?? true,
    });
    if (error) throw error;
    return data as TrainingAnswerRow;
  },
};
