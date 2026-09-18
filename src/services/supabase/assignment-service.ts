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

const SUBMISSION_BUCKET = "course-materials";

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
    const ext = input.file.name.split(".").pop() ?? "bin";
    const path = `submissions/${input.assignmentId}/${input.studentId}/${crypto.randomUUID()}.${ext}`;
    const uploadOptions = input.file.type
      ? { upsert: false as const, contentType: input.file.type }
      : { upsert: false as const };
    const { error } = await supabase.storage
      .from(SUBMISSION_BUCKET)
      .upload(path, input.file, uploadOptions);
    if (error) throw error;
    return { fileBucket: SUBMISSION_BUCKET, filePath: path };
  },

  /** Accepts a text answer, a file, or both — at least one is required. */
  async upsertSubmission(input: {
    assignmentId: string;
    studentId: string;
    contentText?: string;
    file?: File;
    status?: SubmissionStatus;
  }) {
    const status = input.status ?? "submitted";
    const text = input.contentText?.trim() ?? "";
    if (!text && !input.file) {
      throw new Error("Ajoutez une réponse écrite ou un fichier avant de remettre le devoir.");
    }
    const uploaded = input.file
      ? await this.uploadSubmissionFile({
          assignmentId: input.assignmentId,
          studentId: input.studentId,
          file: input.file,
        })
      : null;
    const { data, error } = await requireClient()
      .from("assignment_submissions")
      .upsert(
        {
          assignment_id: input.assignmentId,
          student_id: input.studentId,
          content_text: text || null,
          status,
          submitted_at: status === "submitted" ? new Date().toISOString() : null,
          // Omitted when no new file so a previous upload is preserved.
          ...(uploaded ? { file_bucket: uploaded.fileBucket, file_path: uploaded.filePath } : {}),
        },
        { onConflict: "assignment_id,student_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data;
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
