import {
  ASSIGNMENT_SUBMISSION_BUCKET,
  buildAssignmentSubmissionStoragePath,
  mapAssignmentSubmissionError,
} from "@/lib/assignment-submission-storage";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Assignment = Database["public"]["Tables"]["assignments"]["Row"];
type Submission = Database["public"]["Tables"]["assignment_submissions"]["Row"];
type AssignmentStatus = Database["public"]["Enums"]["assignment_status"];
type SubmissionStatus = Database["public"]["Enums"]["submission_status"];
type MediaKind = Database["public"]["Enums"]["media_content_kind"];

export type AssignmentRow = Assignment & {
  level: { id: string; code: string; name: string } | null;
  class: { id: string; name: string } | null;
};

function requireClient() {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase();
}

const SUBMISSION_BUCKET = ASSIGNMENT_SUBMISSION_BUCKET;

async function resolveCurrentStudentId(preferredStudentId?: string): Promise<string> {
  const supabase = requireClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("NOT_AUTHENTICATED");

  const { data, error } = await supabase
    .from("students")
    .select("id")
    .eq("profile_id", user.id)
    .neq("status", "archived")
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("STUDENT_PROFILE_REQUIRED");
  if (preferredStudentId && preferredStudentId !== data.id) {
    throw new Error("STUDENT_ID_MISMATCH");
  }
  return data.id;
}

const ASSIGNMENT_SELECT = `
  *,
  level:levels!assignments_level_id_fkey ( id, code, name ),
  class:classes!assignments_class_id_fkey ( id, name )
`;

export const SupabaseAssignmentService = {
  async list(classId?: string): Promise<AssignmentRow[]> {
    let query = requireClient()
      .from("assignments")
      .select(ASSIGNMENT_SELECT)
      .is("archived_at", null)
      .order("due_at", {
        ascending: true,
        nullsFirst: false,
      });
    if (classId) query = query.eq("class_id", classId);
    const { data, error } = await query;
    if (error) throw error;
    return (data as AssignmentRow[] | null) ?? [];
  },

  async create(input: {
    levelId: string;
    classId?: string | null;
    title: string;
    description?: string;
    instructions?: string;
    dueAt?: string | null;
    publishedAt?: string | null;
    contentKind?: MediaKind;
    contentUrl?: string | null;
    mimeType?: string | null;
    attachmentBucket?: string | null;
    attachmentPath?: string | null;
    createdBy?: string | null;
    status?: AssignmentStatus;
  }) {
    const status = input.status ?? "draft";
    const { data, error } = await requireClient()
      .from("assignments")
      .insert({
        level_id: input.levelId,
        class_id: input.classId ?? null,
        title: input.title,
        description: input.description ?? null,
        instructions: input.instructions ?? null,
        due_at: input.dueAt ?? null,
        published_at:
          input.publishedAt ?? (status === "published" ? new Date().toISOString() : null),
        content_kind: input.contentKind ?? "pdf",
        content_url: input.contentUrl ?? null,
        mime_type: input.mimeType ?? null,
        attachment_bucket: input.attachmentBucket ?? null,
        attachment_path: input.attachmentPath ?? null,
        created_by: input.createdBy ?? null,
        status,
      })
      .select(ASSIGNMENT_SELECT)
      .single();
    if (error) throw error;
    return data as AssignmentRow;
  },

  async uploadAttachment(file: File) {
    const supabase = requireClient();
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `assignments/${crypto.randomUUID()}.${ext}`;
    const uploadOptions = file.type
      ? { upsert: false as const, contentType: file.type }
      : { upsert: false as const };
    const { error } = await supabase.storage
      .from("course-materials")
      .upload(path, file, uploadOptions);
    if (error) throw error;
    return {
      attachmentBucket: "course-materials" as const,
      attachmentPath: path,
      mimeType: file.type || null,
    };
  },

  async getAttachmentUrl(
    row: Pick<Assignment, "content_url" | "attachment_bucket" | "attachment_path">,
  ) {
    if (row.content_url) return row.content_url;
    if (!row.attachment_bucket || !row.attachment_path) {
      throw new Error("Aucune pièce jointe disponible");
    }
    const { data, error } = await requireClient()
      .storage.from(row.attachment_bucket)
      .createSignedUrl(row.attachment_path, 3600);
    if (error) throw error;
    return data.signedUrl;
  },

  async publish(id: string) {
    const { data, error } = await requireClient()
      .from("assignments")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", id)
      .select(ASSIGNMENT_SELECT)
      .single();
    if (error) throw error;
    return data as AssignmentRow;
  },

  async update(
    id: string,
    patch: {
      title?: string;
      description?: string | null;
      instructions?: string | null;
      dueAt?: string | null;
      publishedAt?: string | null;
      levelId?: string;
      classId?: string | null;
      contentKind?: MediaKind;
      contentUrl?: string | null;
      mimeType?: string | null;
      attachmentBucket?: string | null;
      attachmentPath?: string | null;
      clearAttachment?: boolean;
    },
  ) {
    const update: Database["public"]["Tables"]["assignments"]["Update"] = {};
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.description !== undefined) update.description = patch.description;
    if (patch.instructions !== undefined) update.instructions = patch.instructions;
    if (patch.dueAt !== undefined) update.due_at = patch.dueAt;
    if (patch.publishedAt !== undefined) update.published_at = patch.publishedAt;
    if (patch.levelId !== undefined) update.level_id = patch.levelId;
    if (patch.classId !== undefined) update.class_id = patch.classId;
    if (patch.contentKind !== undefined) update.content_kind = patch.contentKind;
    if (patch.contentUrl !== undefined) update.content_url = patch.contentUrl;
    if (patch.mimeType !== undefined) update.mime_type = patch.mimeType;
    if (patch.clearAttachment) {
      update.attachment_bucket = null;
      update.attachment_path = null;
      update.mime_type = null;
      update.content_url = null;
    } else {
      if (patch.attachmentBucket !== undefined) update.attachment_bucket = patch.attachmentBucket;
      if (patch.attachmentPath !== undefined) update.attachment_path = patch.attachmentPath;
    }
    const { data, error } = await requireClient()
      .from("assignments")
      .update(update)
      .eq("id", id)
      .select(ASSIGNMENT_SELECT)
      .single();
    if (error) throw error;
    return data as AssignmentRow;
  },

  async archive(id: string) {
    const { data, error } = await requireClient()
      .from("assignments")
      .update({ archived_at: new Date().toISOString(), status: "archived" })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async listSubmissions(assignmentId: string): Promise<Submission[]> {
    const { data, error } = await requireClient()
      .from("assignment_submissions")
      .select("*")
      .eq("assignment_id", assignmentId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async uploadSubmissionFile(input: { assignmentId: string; studentId: string; file: File }) {
    const supabase = requireClient();
    const studentId = await resolveCurrentStudentId(input.studentId);
    const path = buildAssignmentSubmissionStoragePath({
      assignmentId: input.assignmentId,
      studentId,
      fileName: input.file.name,
    });
    const uploadOptions = input.file.type
      ? { upsert: false as const, contentType: input.file.type }
      : { upsert: false as const };
    const { error } = await supabase.storage
      .from(SUBMISSION_BUCKET)
      .upload(path, input.file, uploadOptions);
    if (error) throw mapAssignmentSubmissionError(error, "storage");
    return { fileBucket: SUBMISSION_BUCKET, filePath: path, studentId };
  },

  /** Accepts a text answer, a file, or both — at least one is required. */
  async upsertSubmission(input: {
    assignmentId: string;
    studentId: string;
    contentText?: string;
    file?: File;
    status?: SubmissionStatus;
    dueAt?: string | null;
  }) {
    try {
      const status = input.status ?? "submitted";
      const text = input.contentText?.trim() ?? "";
      if (!text && !input.file) {
        throw new Error("Ajoutez une réponse écrite ou un fichier avant de remettre le devoir.");
      }

      // Always derive student_id from the authenticated session (RLS: current_student_id()).
      const studentId = await resolveCurrentStudentId(input.studentId);

      const existing = await requireClient()
        .from("assignment_submissions")
        .select("*")
        .eq("assignment_id", input.assignmentId)
        .eq("student_id", studentId)
        .maybeSingle();
      if (existing.error) throw mapAssignmentSubmissionError(existing.error, "insert");
      const previous = existing.data;

      // Upload first, then upsert submission so file_path is coherent when present.
      const uploaded = input.file
        ? await this.uploadSubmissionFile({
            assignmentId: input.assignmentId,
            studentId,
            file: input.file,
          })
        : null;

      const nowIso = new Date().toISOString();
      const dueMs = input.dueAt ? new Date(input.dueAt).getTime() : null;
      const editedAfterDue =
        dueMs != null && !Number.isNaN(dueMs)
          ? Date.now() > dueMs
          : Boolean(previous?.edited_after_due);

      let version = Number(previous?.version ?? 1);
      let responseVersions = previous?.response_versions ?? [];
      let submittedAt = previous?.submitted_at ?? null;

      if (
        previous &&
        (previous.status === "submitted" || previous.status === "graded" || previous.submitted_at)
      ) {
        // Preserve history — never silent overwrite.
        const history = Array.isArray(responseVersions) ? responseVersions : [];
        responseVersions = [
          ...history,
          {
            version,
            content_text: previous.content_text,
            file_bucket: previous.file_bucket,
            file_path: previous.file_path,
            saved_at:
              previous.last_edited_at ?? previous.updated_at ?? previous.submitted_at ?? nowIso,
          },
        ];
        version += 1;
        submittedAt = previous.submitted_at ?? nowIso;
      } else if (!previous || !previous.submitted_at) {
        submittedAt = status === "submitted" || status === "graded" ? nowIso : null;
        version = 1;
      }

      // Re-open graded work as submitted when student edits again.
      const nextStatus: SubmissionStatus =
        previous?.status === "graded" ? "submitted" : status === "draft" ? "draft" : "submitted";

      const { data, error } = await requireClient()
        .from("assignment_submissions")
        .upsert(
          {
            assignment_id: input.assignmentId,
            student_id: studentId,
            content_text: text || null,
            status: nextStatus,
            submitted_at: submittedAt ?? (nextStatus === "submitted" ? nowIso : null),
            last_edited_at: nowIso,
            version,
            edited_after_due: editedAfterDue,
            response_versions: responseVersions,
            // Clear grade when student revises after correction so teacher re-reviews.
            ...(previous?.status === "graded"
              ? { score: null, feedback: null, graded_at: null, graded_by: null }
              : {}),
            ...(uploaded ? { file_bucket: uploaded.fileBucket, file_path: uploaded.filePath } : {}),
          },
          { onConflict: "assignment_id,student_id" },
        )
        .select("*")
        .single();
      if (error) throw mapAssignmentSubmissionError(error, "insert");
      return data;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.startsWith("Ajoutez une réponse") ||
          error.message.startsWith("Impossible d'") ||
          error.message.startsWith("Impossible d’"))
      ) {
        throw error;
      }
      throw mapAssignmentSubmissionError(error, input.file ? "storage" : "insert");
    }
  },

  async listSubmissionsForStudent(studentId: string): Promise<Submission[]> {
    const { data, error } = await requireClient()
      .from("assignment_submissions")
      .select("*")
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getSubmissionFileUrl(
    submission: Pick<Submission, "file_bucket" | "file_path">,
    expiresIn = 3600,
  ) {
    if (!submission.file_bucket || !submission.file_path) {
      throw new Error("Aucun fichier n’a été déposé pour cette remise.");
    }
    const { data, error } = await requireClient()
      .storage.from(submission.file_bucket)
      .createSignedUrl(submission.file_path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  async grade(input: {
    submissionId: string;
    score: number;
    feedback?: string;
    gradedBy?: string | null;
  }) {
    const { data, error } = await requireClient()
      .from("assignment_submissions")
      .update({
        score: input.score,
        feedback: input.feedback ?? null,
        status: "graded",
        graded_at: new Date().toISOString(),
        graded_by: input.gradedBy ?? null,
      })
      .eq("id", input.submissionId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },
};
