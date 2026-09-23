import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { sanitizeQuestionMetadataForStudent } from "@/lib/exam-form-fill";
import {
  parseCompletenessReport,
  validateExamAudioFile,
  type ExamCompletenessReport,
} from "@/lib/exam-completeness";
import { resolvePublishedExamCatalog } from "@/lib/exam-catalog-visibility";
import {
  pickLatestAttempt,
  resolveExamParticipantStatus,
  type ExamParticipantRow,
} from "@/lib/exam-participant-status";
import {
  buildOralStoragePath,
  parseOralAnswer,
  validateOralAnswerAudioFile,
} from "@/lib/exam-oral";
import { isManualQuestionType } from "@/lib/exam-writing";
import type { Database, Json } from "@/types/database";

type Exam = Database["public"]["Tables"]["exams"]["Row"];
type ExamSection = Database["public"]["Tables"]["exam_sections"]["Row"];
type ExamQuestion = Database["public"]["Tables"]["exam_questions"]["Row"];
type ExamOption = Database["public"]["Tables"]["exam_question_options"]["Row"];
type ExamAttempt = Database["public"]["Tables"]["exam_attempts"]["Row"];
type ExamAnswer = Database["public"]["Tables"]["exam_answers"]["Row"];
type ExamStatus = Database["public"]["Enums"]["exam_status"];

function requireClient() {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase();
}

export type ExamQuestionType = Database["public"]["Enums"]["exam_question_type"];
export type ExamSkill = Database["public"]["Enums"]["exam_skill"];

export type ExamQuestionWithOptions = ExamQuestion & {
  options: ExamOption[];
};

/** Staff-only view: includes the protected answer key. */
export type ExamStructureQuestion = ExamQuestionWithOptions & {
  answer_key: {
    correct_values: string[];
    explanation: string | null;
    teacher_payload: Json;
  } | null;
};

export type ExamStructureSection = ExamSection & {
  questions: ExamStructureQuestion[];
};

export type ExamSectionWithQuestions = ExamSection & {
  questions: ExamQuestionWithOptions[];
};

export type ExamDetail = Exam & {
  level: { id: string; code: string; name: string } | null;
  sections: ExamSectionWithQuestions[];
};

export type ExamListItem = Exam & {
  level: { id: string; code: string; name: string } | null;
  class: { id: string; name: string } | null;
  question_count?: number;
};

export type SkillBreakdown = Record<string, { score: number; max: number }>;

export type ExamSchreibenItem = {
  questionId: string;
  bankQuestionId: string | null;
  type: string;
  points: number;
  pointsAwarded: number | null;
  pending: boolean;
};

export type ExamResultView = {
  attempt: ExamAttempt;
  exam: ExamListItem | null;
  percentage: number;
  passed: boolean;
  skills: SkillBreakdown;
  correct: number;
  totalObjective: number;
  score: number;
  maxScore: number;
  automaticScore: number;
  automaticMax: number;
  schreibenItems: ExamSchreibenItem[];
  awaitingManual: boolean;
};

export type ExamAttemptReviewItem = {
  question_id: string;
  external_id: string | null;
  skill: string;
  section_title: string;
  type: string;
  prompt: string;
  instruction: string | null;
  passage: string | null;
  points: number;
  student_answer: Json;
  answer_media_bucket?: string | null;
  answer_media_path?: string | null;
  answer_mime_type?: string | null;
  is_correct: boolean | null;
  points_awarded: number | null;
  correct_values: string[] | null;
  correct_form: Record<string, string> | null;
  explanation: string | null;
  options: Array<{ value: string; label: string }>;
  teacher_comment: string | null;
  grading_detail: Json | null;
};

export type ExamAttemptReview = {
  attempt_id: string;
  status: string;
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  skill_breakdown: Json;
  items: ExamAttemptReviewItem[];
};

function parseSkills(raw: Json): SkillBreakdown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: SkillBreakdown = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const score = Number((value as { score?: unknown }).score ?? 0);
      const max = Number((value as { max?: unknown }).max ?? 0);
      out[key] = { score, max };
    }
  }
  return out;
}

function asMetaRecord(metadata: Json): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

export const SupabaseExamService = {
  async listPublished(): Promise<ExamListItem[]> {
    const { data, error } = await requireClient()
      .from("exams")
      .select(
        "*, level:levels!exams_level_id_fkey ( id, code, name ), class:classes!exams_class_id_fkey ( id, name )",
      )
      .eq("status", "published")
      .order("published_at", { ascending: false });
    if (error) throw error;
    // Completeness is enforced at publish/start (server) and in the builder UI —
    // never by silently dropping published rows when exam_is_complete fails/missing.
    return resolvePublishedExamCatalog((data as ExamListItem[] | null) ?? []);
  },

  async getExamCompleteness(examId: string): Promise<ExamCompletenessReport> {
    const { data, error } = await requireClient().rpc("exam_completeness_report", {
      p_exam_id: examId,
    });
    if (error) throw error;
    return parseCompletenessReport(data);
  },

  async getQuestionAudioSignedUrl(
    question: Pick<ExamQuestion, "media_bucket" | "media_path" | "metadata">,
    expiresIn = 3600,
  ): Promise<string | null> {
    const meta = asMetaRecord(question.metadata);
    if (question.media_bucket && question.media_path) {
      const { data, error } = await requireClient()
        .storage.from(question.media_bucket)
        .createSignedUrl(question.media_path, expiresIn);
      if (error) throw error;
      return data.signedUrl;
    }
    const external = meta["audio_url"];
    if (typeof external === "string" && external.trim()) return external.trim();
    return null;
  },

  async uploadQuestionAudio(questionId: string, file: File) {
    const fileError = validateExamAudioFile(file);
    if (fileError) throw new Error(fileError);
    const supabase = requireClient();
    const { data: existing, error: loadError } = await supabase
      .from("exam_questions")
      .select("id, media_bucket, media_path, metadata")
      .eq("id", questionId)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!existing) throw new Error("Question introuvable.");

    const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
    const path = `exam-audio/${questionId}/${crypto.randomUUID()}.${ext}`;
    const contentType =
      file.type ||
      (ext === "wav" ? "audio/wav" : ext === "m4a" ? "audio/mp4" : "audio/mpeg");
    const { error: uploadError } = await supabase.storage
      .from("course-materials")
      .upload(path, file, {
        upsert: false,
        contentType,
      });
    if (uploadError) throw uploadError;

    if (existing.media_bucket && existing.media_path) {
      void supabase.storage.from(existing.media_bucket).remove([existing.media_path]);
    }

    const meta = asMetaRecord(existing.metadata);
    delete meta["audio_url"];
    const { data, error } = await supabase
      .from("exam_questions")
      .update({
        media_bucket: "course-materials",
        media_path: path,
        metadata: meta as Json,
      })
      .eq("id", questionId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async clearQuestionAudio(questionId: string) {
    const supabase = requireClient();
    const { data: existing, error: loadError } = await supabase
      .from("exam_questions")
      .select("id, media_bucket, media_path, metadata")
      .eq("id", questionId)
      .maybeSingle();
    if (loadError) throw loadError;
    if (!existing) throw new Error("Question introuvable.");

    if (existing.media_bucket && existing.media_path) {
      const { error: removeError } = await supabase.storage
        .from(existing.media_bucket)
        .remove([existing.media_path]);
      if (removeError) throw removeError;
    }

    const meta = asMetaRecord(existing.metadata);
    delete meta["audio_url"];
    const { data, error } = await supabase
      .from("exam_questions")
      .update({
        media_bucket: null,
        media_path: null,
        metadata: meta as Json,
      })
      .eq("id", questionId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Staff confirmation after real listening of one Hören Teil.
   * Updates all questions sharing the slot + optional exam_audio_tracks inventory row.
   * Playback authority remains question media_path / getExam signed URLs.
   */
  async confirmHorenSlotVerification(input: {
    examId: string;
    partNumber: number;
    verifiedBy: string;
  }) {
    if (input.partNumber < 1 || input.partNumber > 4) {
      throw new Error("Teil Hören invalide (1–4).");
    }
    const supabase = requireClient();
    const structure = await SupabaseExamService.listExamStructure(input.examId);
    const hoerenQs = structure
      .filter((s) => s.skill === "hoeren")
      .flatMap((s) => s.questions ?? [])
      .filter((q) => {
        const meta = asMetaRecord(q.metadata);
        const slot = Number(meta["audio_slot"] ?? meta["teil"]);
        return slot === input.partNumber;
      });
    if (hoerenQs.length === 0) {
      throw new Error(`Aucune question Hören pour le Teil ${input.partNumber}.`);
    }
    const verifiedAt = new Date().toISOString();
    for (const q of hoerenQs) {
      const meta = asMetaRecord(q.metadata);
      meta["audio_verification_status"] = "content_verified";
      meta["audio_verified_at"] = verifiedAt;
      meta["audio_verified_by"] = input.verifiedBy;
      const { error } = await supabase
        .from("exam_questions")
        .update({ metadata: meta as Json })
        .eq("id", q.id);
      if (error) throw error;
    }
    // exam_audio_tracks remains admin inventory only — keep in sync via ops scripts/migration.
    // Playback authority: question media_path → getExam signed URL.
    return { partNumber: input.partNumber, questionCount: hoerenQs.length, verifiedAt };
  },

  async listAll(): Promise<ExamListItem[]> {
    const { data, error } = await requireClient()
      .from("exams")
      .select(
        "*, level:levels!exams_level_id_fkey ( id, code, name ), class:classes!exams_class_id_fkey ( id, name )",
      )
      .neq("status", "archived")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as ExamListItem[] | null) ?? [];
  },

  async getExam(examId: string): Promise<ExamDetail | null> {
    const { data, error } = await requireClient()
      .from("exams")
      .select(
        `
        *,
        level:levels!exams_level_id_fkey ( id, code, name ),
        sections:exam_sections (
          *,
          questions:exam_questions (
            *,
            options:exam_question_options ( * )
          )
        )
      `,
      )
      .eq("id", examId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const detail = data as ExamDetail;
    detail.sections = await Promise.all(
      (detail.sections ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(async (section) => ({
          ...section,
          questions: await Promise.all(
            (section.questions ?? [])
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map(async (q) => {
                const safeMeta = sanitizeQuestionMetadataForStudent(asMetaRecord(q.metadata)) ?? {};
                // Never expose storage paths or scripts — inject a short-lived signed URL when needed.
                delete safeMeta["audio_script"];
                delete safeMeta["media_path"];
                delete safeMeta["media_bucket"];
                try {
                  const signed = await this.getQuestionAudioSignedUrl(q);
                  if (signed) safeMeta["audio_url"] = signed;
                  else delete safeMeta["audio_url"];
                } catch {
                  delete safeMeta["audio_url"];
                  safeMeta["audio_error"] = "Lecture audio indisponible";
                }
                return {
                  ...q,
                  media_bucket: null,
                  media_path: null,
                  metadata: safeMeta as Json,
                  options: (Array.isArray(q.options) ? q.options : [])
                    .filter((o): o is NonNullable<typeof o> => Boolean(o))
                    .slice()
                    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)),
                };
              }),
          ),
        })),
    );

    return detail;
  },

  async createExam(input: {
    title: string;
    description?: string;
    instructions?: string;
    levelId: string;
    classId?: string | null;
    durationMinutes?: number;
    maxAttempts?: number;
    passPercentage?: number;
    isMock?: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
    contentKind?: Database["public"]["Enums"]["media_content_kind"];
    contentUrl?: string | null;
    storageBucket?: string | null;
    storagePath?: string | null;
    mimeType?: string | null;
    status?: ExamStatus;
  }) {
    const status = input.status ?? "draft";
    const { data, error } = await requireClient()
      .from("exams")
      .insert({
        title: input.title,
        description: input.description ?? null,
        instructions: input.instructions ?? null,
        level_id: input.levelId,
        class_id: input.classId ?? null,
        duration_minutes: input.durationMinutes ?? 30,
        max_attempts: Math.max(1, input.maxAttempts ?? 3),
        pass_percentage: input.passPercentage ?? 60,
        is_mock: input.isMock ?? true,
        starts_at: input.startsAt ?? null,
        ends_at: input.endsAt ?? null,
        content_kind: input.contentKind ?? "pdf",
        content_url: input.contentUrl ?? null,
        storage_bucket: input.storageBucket ?? null,
        storage_path: input.storagePath ?? null,
        mime_type: input.mimeType ?? null,
        status,
        published_at: status === "published" ? new Date().toISOString() : null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async uploadExamMaterial(file: File) {
    const supabase = requireClient();
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `mock-exams/${crypto.randomUUID()}.${ext}`;
    const uploadOptions = file.type
      ? { upsert: false as const, contentType: file.type }
      : { upsert: false as const };
    const { error } = await supabase.storage
      .from("course-materials")
      .upload(path, file, uploadOptions);
    if (error) throw error;
    return {
      storageBucket: "course-materials" as const,
      storagePath: path,
      mimeType: file.type || null,
    };
  },

  async getExamMaterialUrl(
    exam: Pick<Exam, "content_url" | "storage_bucket" | "storage_path">,
    expiresIn = 3600,
  ) {
    if (exam.content_url) return exam.content_url;
    if (!exam.storage_bucket || !exam.storage_path) {
      throw new Error("Aucun document disponible");
    }
    const { data, error } = await requireClient()
      .storage.from(exam.storage_bucket)
      .createSignedUrl(exam.storage_path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  async updateExam(id: string, patch: Database["public"]["Tables"]["exams"]["Update"]) {
    const { data, error } = await requireClient()
      .from("exams")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async publishExam(id: string) {
    const { data, error } = await requireClient().rpc("publish_exam", { p_exam_id: id });
    if (error) {
      const message = error.message ?? "";
      if (message.includes("EXAM_INCOMPLETE")) {
        const detail = error.details || message.replace(/^EXAM_INCOMPLETE:\s*/i, "");
        throw new Error(
          `Examen incomplet — publication impossible.${detail ? ` ${detail}` : ""}`,
        );
      }
      throw error;
    }
    return data as Exam;
  },

  async archiveExam(id: string) {
    return this.updateExam(id, { status: "archived" });
  },

  /** Authoring view of an exam: sections, questions, options and answer keys. */
  async listExamStructure(examId: string): Promise<ExamStructureSection[]> {
    const { data, error } = await requireClient()
      .from("exam_sections")
      .select(
        `
        *,
        questions:exam_questions (
          *,
          options:exam_question_options ( * ),
          answer_key:exam_answer_keys ( correct_values, explanation, teacher_payload )
        )
      `,
      )
      .eq("exam_id", examId);
    if (error) throw error;
    const sections = (data as ExamStructureSection[] | null) ?? [];
    return sections
      .map((section) => ({
        ...section,
        questions: (Array.isArray(section.questions) ? section.questions : [])
          .map((question) => {
            const rawKey = (question as { answer_key?: unknown }).answer_key;
            const answerKey = Array.isArray(rawKey)
              ? (rawKey[0] as ExamStructureQuestion["answer_key"])
              : ((rawKey as ExamStructureQuestion["answer_key"]) ?? null);
            const rawOptions = question.options;
            const options = (Array.isArray(rawOptions) ? rawOptions : [])
              .filter((o): o is NonNullable<typeof o> => Boolean(o))
              .slice()
              .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
            return {
              ...question,
              answer_key: answerKey,
              options,
            };
          })
          .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)),
      }))
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  },

  async createSection(input: {
    examId: string;
    title: string;
    skill: ExamSkill;
    description?: string | null;
    sortOrder?: number;
    maxScore?: number;
  }): Promise<ExamSection> {
    const { data, error } = await requireClient()
      .from("exam_sections")
      .insert({
        exam_id: input.examId,
        title: input.title,
        skill: input.skill,
        description: input.description ?? null,
        sort_order: input.sortOrder ?? 0,
        max_score: input.maxScore ?? 0,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async createQuestion(input: {
    sectionId: string;
    type: ExamQuestionType;
    prompt: string;
    points?: number;
    sortOrder?: number;
    metadata?: Json;
  }): Promise<ExamQuestion> {
    const { data, error } = await requireClient()
      .from("exam_questions")
      .insert({
        section_id: input.sectionId,
        type: input.type,
        prompt: input.prompt,
        points: input.points ?? 1,
        sort_order: input.sortOrder ?? 0,
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async uploadOralAnswer(input: {
    attemptId: string;
    questionId: string;
    file: File;
    flagged?: boolean;
  }): Promise<ExamAnswer> {
    const fileError = validateOralAnswerAudioFile(input.file);
    if (fileError) throw new Error(fileError);
    const supabase = requireClient();

    const { data: attempt, error: attemptError } = await supabase
      .from("exam_attempts")
      .select("id, student_id, status")
      .eq("id", input.attemptId)
      .maybeSingle();
    if (attemptError) throw attemptError;
    if (!attempt) throw new Error("Tentative introuvable.");
    if (attempt.status !== "in_progress") {
      throw new Error("La tentative n’est plus modifiable.");
    }

    const { data: existingAnswer } = await supabase
      .from("exam_answers")
      .select("answer_media_bucket, answer_media_path, answer")
      .eq("attempt_id", input.attemptId)
      .eq("question_id", input.questionId)
      .maybeSingle();

    const path = buildOralStoragePath({
      attemptId: input.attemptId,
      studentId: attempt.student_id,
      questionId: input.questionId,
      fileName: input.file.name || "oral.webm",
    });
    const contentType = input.file.type || "audio/webm";
    const { error: uploadError } = await supabase.storage.from("course-materials").upload(path, input.file, {
      upsert: false,
      contentType,
    });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase.rpc("save_exam_oral_answer", {
      p_attempt_id: input.attemptId,
      p_question_id: input.questionId,
      p_bucket: "course-materials",
      p_path: path,
      p_mime_type: contentType,
      p_flagged: input.flagged ?? false,
    });
    if (error) {
      void supabase.storage.from("course-materials").remove([path]);
      throw error;
    }

    const prevBucket = existingAnswer?.answer_media_bucket;
    const prevPath = existingAnswer?.answer_media_path;
    if (prevBucket && prevPath && prevPath !== path) {
      void supabase.storage.from(prevBucket).remove([prevPath]);
    } else {
      const parsed = parseOralAnswer(existingAnswer?.answer);
      if (parsed && parsed.path !== path) {
        void supabase.storage.from(parsed.bucket).remove([parsed.path]);
      }
    }

    return data as ExamAnswer;
  },

  async getAnswerAudioSignedUrl(
    answer: {
      answer?: Json | null;
      answer_media_bucket?: string | null;
      answer_media_path?: string | null;
    },
    expiresIn = 3600,
  ): Promise<string | null> {
    const bucket = answer.answer_media_bucket;
    const path = answer.answer_media_path;
    if (bucket && path) {
      const { data, error } = await requireClient().storage.from(bucket).createSignedUrl(path, expiresIn);
      if (error) throw error;
      return data.signedUrl;
    }
    const parsed = parseOralAnswer(answer.answer);
    if (!parsed) return null;
    const { data, error } = await requireClient()
      .storage.from(parsed.bucket)
      .createSignedUrl(parsed.path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  async createOptions(
    questionId: string,
    options: Array<{ label: string; value: string; sortOrder?: number }>,
  ): Promise<ExamOption[]> {
    if (options.length === 0) return [];
    const { data, error } = await requireClient()
      .from("exam_question_options")
      .insert(
        options.map((option, index) => ({
          question_id: questionId,
          label: option.label,
          value: option.value,
          sort_order: option.sortOrder ?? index + 1,
        })),
      )
      .select("*");
    if (error) throw error;
    return data ?? [];
  },

  async setAnswerKey(questionId: string, correctValues: string[]) {
    const { data, error } = await requireClient()
      .from("exam_answer_keys")
      .upsert(
        { question_id: questionId, correct_values: correctValues },
        { onConflict: "question_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  /** Keeps the section total aligned with the points of its questions. */
  async syncSectionMaxScore(sectionId: string) {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("exam_questions")
      .select("points")
      .eq("section_id", sectionId);
    if (error) throw error;
    const total = (data ?? []).reduce((sum, row) => sum + Number(row.points ?? 0), 0);
    const { error: updateError } = await supabase
      .from("exam_sections")
      .update({ max_score: total })
      .eq("id", sectionId);
    if (updateError) throw updateError;
    return total;
  },

  async deleteQuestion(questionId: string) {
    const { error } = await requireClient().from("exam_questions").delete().eq("id", questionId);
    if (error) throw error;
  },

  async deleteSection(sectionId: string) {
    const { error } = await requireClient().from("exam_sections").delete().eq("id", sectionId);
    if (error) throw error;
  },

  async startAttempt(examId: string): Promise<ExamAttempt> {
    const { data, error } = await requireClient().rpc("start_exam_attempt", { p_exam_id: examId });
    if (error) {
      const message = error.message ?? "";
      if (message.includes("MAX_ATTEMPTS_REACHED")) {
        throw new Error("Vous avez atteint le nombre maximum de tentatives pour cet examen.");
      }
      if (message.includes("EXAM_NOT_ALLOWED")) {
        throw new Error("Cet examen n’est pas disponible pour votre compte.");
      }
      if (message.includes("EXAM_NOT_PUBLISHED")) {
        throw new Error("Cet examen n’est plus publié.");
      }
      if (message.includes("EXAM_INCOMPLETE")) {
        throw new Error(
          "Cet examen n’est pas prêt (audio Hören ou contenu incomplet). Contactez votre professeur.",
        );
      }
      throw error;
    }
    return data as ExamAttempt;
  },

  async getAttempt(attemptId: string): Promise<ExamAttempt | null> {
    const { data, error } = await requireClient()
      .from("exam_attempts")
      .select("*")
      .eq("id", attemptId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async listAnswers(attemptId: string): Promise<ExamAnswer[]> {
    const { data, error } = await requireClient()
      .from("exam_answers")
      .select("*")
      .eq("attempt_id", attemptId);
    if (error) throw error;
    const attempt = await this.getAttempt(attemptId);
    const rows = data ?? [];
    // Hide scoring fields while attempt is still in progress
    if (attempt?.status === "in_progress") {
      return rows.map((row) => ({
        ...row,
        is_correct: null,
        points_awarded: null,
        grading_detail: null,
      }));
    }
    return rows;
  },

  async saveAnswer(input: {
    attemptId: string;
    questionId: string;
    answer: Json;
    flagged?: boolean;
  }) {
    const { data, error } = await requireClient().rpc("save_exam_answer", {
      p_attempt_id: input.attemptId,
      p_question_id: input.questionId,
      p_answer: input.answer,
      p_flagged: input.flagged ?? false,
    });
    if (error) throw error;
    return data as ExamAnswer;
  },

  async submitAttempt(attemptId: string): Promise<ExamAttempt> {
    const { data, error } = await requireClient().rpc("submit_exam_attempt", {
      p_attempt_id: attemptId,
    });
    if (error) throw error;
    return data as ExamAttempt;
  },

  async gradeWritingAnswer(input: {
    attemptId: string;
    questionId: string;
    points: number;
    comment?: string | null;
    gradingDetail?: Json | null;
  }): Promise<ExamAttempt> {
    const { data, error } = await requireClient().rpc("grade_exam_writing_answer", {
      p_attempt_id: input.attemptId,
      p_question_id: input.questionId,
      p_points: input.points,
      p_comment: input.comment ?? null,
      p_grading_detail: input.gradingDetail ?? null,
    });
    if (error) throw error;
    return data as ExamAttempt;
  },

  async getAttemptReview(attemptId: string): Promise<ExamAttemptReview> {
    const { data, error } = await requireClient().rpc("get_exam_attempt_review", {
      p_attempt_id: attemptId,
    });
    if (error) throw error;
    const raw = data as ExamAttemptReview | null;
    if (!raw) throw new Error("REVIEW_NOT_FOUND");
    return {
      ...raw,
      items: Array.isArray(raw.items) ? raw.items : [],
    };
  },

  async listAttemptsForExam(examId: string): Promise<
    Array<
      ExamAttempt & {
        student: {
          id: string;
          profile: { first_name: string; last_name: string; email: string | null } | null;
        } | null;
      }
    >
  > {
    const { data, error } = await requireClient()
      .from("exam_attempts")
      .select(
        `
        *,
        student:students!exam_attempts_student_id_fkey (
          id,
          profile:profiles!students_profile_id_fkey (
            first_name,
            last_name,
            email
          )
        )
      `,
      )
      .eq("exam_id", examId)
      .in("status", ["submitted", "graded", "expired"])
      .order("submitted_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Array<
      ExamAttempt & {
        student: {
          id: string;
          profile: { first_name: string; last_name: string; email: string | null } | null;
        } | null;
      }
    >;
  },

  async listExamParticipantRoster(examId: string): Promise<ExamParticipantRow[]> {
    const { data: exam, error: examError } = await requireClient()
      .from("exams")
      .select("id, class_id, level_id, ends_at")
      .eq("id", examId)
      .single();
    if (examError) throw examError;

    type StudentLite = {
      id: string;
      profile: { first_name: string | null; last_name: string | null; email: string | null } | null;
    };

    let students: StudentLite[] = [];
    if (exam.class_id) {
      const { data, error } = await requireClient()
        .from("enrollments")
        .select(
          `
          student:students!enrollments_student_id_fkey (
            id,
            profile:profiles!students_profile_id_fkey ( first_name, last_name, email )
          )
        `,
        )
        .eq("class_id", exam.class_id)
        .eq("status", "active");
      if (error) throw error;
      students = (data ?? [])
        .map((row) => row.student as unknown as StudentLite | null)
        .filter((s): s is StudentLite => Boolean(s?.id));
    } else if (exam.level_id) {
      const { data: level } = await requireClient()
        .from("levels")
        .select("code")
        .eq("id", exam.level_id)
        .maybeSingle();
      let query = requireClient()
        .from("students")
        .select(
          `
          id,
          profile:profiles!students_profile_id_fkey ( first_name, last_name, email )
        `,
        )
        .neq("status", "archived");
      if (level?.code) query = query.eq("level_code", level.code);
      const { data, error } = await query;
      if (error) throw error;
      students = (data ?? []) as StudentLite[];
    }

    const { data: attempts, error: attemptsError } = await requireClient()
      .from("exam_attempts")
      .select("*")
      .eq("exam_id", examId)
      .order("started_at", { ascending: false });
    if (attemptsError) throw attemptsError;

    const byStudent = new Map<string, ExamAttempt[]>();
    for (const attempt of attempts ?? []) {
      const list = byStudent.get(attempt.student_id) ?? [];
      list.push(attempt as ExamAttempt);
      byStudent.set(attempt.student_id, list);
    }

    const rows: ExamParticipantRow[] = students.map((student) => {
      const latest = pickLatestAttempt(byStudent.get(student.id) ?? []);
      const status = resolveExamParticipantStatus({
        attempt: latest,
        endsAt: exam.ends_at,
      });
      const profile = student.profile;
      const displayName =
        `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
        profile?.email ||
        "Étudiant";
      return {
        studentId: student.id,
        displayName,
        email: profile?.email ?? null,
        status,
        attemptId: latest?.id ?? null,
        attemptStatus: latest?.status ?? null,
        score: latest?.score != null ? Number(latest.score) : null,
        maxScore: latest?.max_score != null ? Number(latest.max_score) : null,
        percentage: latest?.percentage != null ? Number(latest.percentage) : null,
        startedAt: latest?.started_at ?? null,
        submittedAt: latest?.submitted_at ?? null,
      };
    });

    rows.sort((a, b) => a.displayName.localeCompare(b.displayName, "fr"));
    return rows;
  },

  async listMyAttempts(examId?: string): Promise<ExamAttempt[]> {
    let query = requireClient()
      .from("exam_attempts")
      .select("*")
      .order("started_at", { ascending: false });
    if (examId) query = query.eq("exam_id", examId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async listAllAttempts(): Promise<
    Array<
      ExamAttempt & {
        exam: { level: { code: string } | null } | null;
        student: { level_code: string | null } | null;
      }
    >
  > {
    const { data, error } = await requireClient()
      .from("exam_attempts")
      .select(
        `
        *,
        exam:exams!exam_attempts_exam_id_fkey (
          level:levels!exams_level_id_fkey ( code )
        ),
        student:students!exam_attempts_student_id_fkey (
          level_code
        )
      `,
      )
      .in("status", ["submitted", "graded"])
      .order("submitted_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Array<
      ExamAttempt & {
        exam: { level: { code: string } | null } | null;
        student: { level_code: string | null } | null;
      }
    >;
  },

  async getResult(attemptId: string): Promise<ExamResultView> {
    const attempt = await this.getAttempt(attemptId);
    if (!attempt) throw new Error("ATTEMPT_NOT_FOUND");
    if (attempt.status === "in_progress") throw new Error("ATTEMPT_NOT_SUBMITTED");

    const exam = await this.getExam(attempt.exam_id);
    const answers = await this.listAnswers(attemptId);
    const answerByQuestion = new Map(answers.map((a) => [a.question_id, a]));
    const skills = parseSkills(attempt.skill_breakdown);

    const schreibenItems: ExamSchreibenItem[] = [];
    let automaticScore = 0;
    let automaticMax = 0;
    let objectiveCorrect = 0;
    let objectiveTotal = 0;

    for (const section of exam?.sections ?? []) {
      for (const question of section.questions ?? []) {
        const answer = answerByQuestion.get(question.id);
        const meta = asMetaRecord(question.metadata);
        const bankQuestionId =
          typeof meta["bank_question_id"] === "string" ? meta["bank_question_id"] : null;

        if (isManualQuestionType(question.type)) {
          schreibenItems.push({
            questionId: question.id,
            bankQuestionId,
            type: question.type,
            points: Number(question.points),
            pointsAwarded: answer?.points_awarded ?? null,
            pending: answer?.points_awarded == null || answer.is_correct === null,
          });
          continue;
        }

        automaticMax += Number(question.points);
        const awarded = Number(answer?.points_awarded ?? 0);
        automaticScore += awarded;

        if (question.type === "form_fill") {
          schreibenItems.push({
            questionId: question.id,
            bankQuestionId,
            type: question.type,
            points: Number(question.points),
            pointsAwarded: answer?.points_awarded ?? null,
            pending: false,
          });
          continue;
        }

        objectiveTotal += 1;
        if (answer?.is_correct) objectiveCorrect += 1;
      }
    }

    const score = Number(attempt.score ?? automaticScore);
    const maxScore = Number(attempt.max_score ?? automaticMax);
    const percentage = Number(attempt.percentage ?? 0);
    const pass = Number(exam?.pass_percentage ?? 60);
    const awaitingManual =
      attempt.status === "submitted" ||
      attempt.status === "expired" ||
      schreibenItems.some((item) => item.pending);

    return {
      attempt,
      exam: exam
        ? {
            ...exam,
            level: exam.level,
            class: null,
          }
        : null,
      percentage,
      passed: percentage >= pass,
      skills,
      correct: objectiveCorrect,
      totalObjective: objectiveTotal,
      score,
      maxScore,
      automaticScore,
      automaticMax: automaticMax || 40,
      schreibenItems,
      awaitingManual,
    };
  },

  async setStatus(id: string, status: ExamStatus) {
    if (status === "published") return this.publishExam(id);
    if (status === "archived") return this.archiveExam(id);
    return this.updateExam(id, { status });
  },
};
