import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
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

export type ExamQuestionWithOptions = ExamQuestion & {
  options: ExamOption[];
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

export type ExamResultView = {
  attempt: ExamAttempt;
  exam: ExamListItem | null;
  percentage: number;
  passed: boolean;
  skills: SkillBreakdown;
  correct: number;
  totalObjective: number;
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
    return (data as ExamListItem[] | null) ?? [];
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
    detail.sections = (detail.sections ?? [])
      .map((section) => ({
        ...section,
        questions: (section.questions ?? [])
          .map((q) => ({
            ...q,
            options: (q.options ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
          }))
          .sort((a, b) => a.sort_order - b.sort_order),
      }))
      .sort((a, b) => a.sort_order - b.sort_order);

    return detail;
  },

  async createExam(input: {
    title: string;
    description?: string;
    instructions?: string;
    levelId: string;
    classId?: string | null;
    durationMinutes?: number;
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
    return this.updateExam(id, { status: "published", published_at: new Date().toISOString() });
  },

  async archiveExam(id: string) {
    return this.updateExam(id, { status: "archived" });
  },

  async startAttempt(examId: string): Promise<ExamAttempt> {
    const { data, error } = await requireClient().rpc("start_exam_attempt", { p_exam_id: examId });
    if (error) throw error;
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

  async getResult(attemptId: string): Promise<ExamResultView> {
    const attempt = await this.getAttempt(attemptId);
    if (!attempt) throw new Error("ATTEMPT_NOT_FOUND");
    if (attempt.status === "in_progress") throw new Error("ATTEMPT_NOT_SUBMITTED");

    const exam = await this.getExam(attempt.exam_id);
    const answers = await this.listAnswers(attemptId);
    const skills = parseSkills(attempt.skill_breakdown);
    const objective = answers.filter((a) => a.is_correct !== null);
    const correct = objective.filter((a) => a.is_correct).length;
    const percentage = Number(attempt.percentage ?? 0);
    const pass = Number(exam?.pass_percentage ?? 60);

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
      correct,
      totalObjective: objective.length,
    };
  },

  async setStatus(id: string, status: ExamStatus) {
    if (status === "published") return this.publishExam(id);
    if (status === "archived") return this.archiveExam(id);
    return this.updateExam(id, { status });
  },
};
