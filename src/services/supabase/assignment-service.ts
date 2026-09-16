import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Assignment = Database["public"]["Tables"]["assignments"]["Row"];
type Submission = Database["public"]["Tables"]["assignment_submissions"]["Row"];
type AssignmentStatus = Database["public"]["Enums"]["assignment_status"];
type SubmissionStatus = Database["public"]["Enums"]["submission_status"];

function requireClient() {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase();
}

export const SupabaseAssignmentService = {
  async list(classId?: string): Promise<Assignment[]> {
    let query = requireClient()
      .from("assignments")
      .select("*")
      .is("archived_at", null)
      .order("due_at", {
        ascending: true,
        nullsFirst: false,
      });
    if (classId) query = query.eq("class_id", classId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async create(input: {
    classId: string;
    title: string;
    description?: string;
    instructions?: string;
    dueAt?: string | null;
    publishedAt?: string | null;
    attachmentBucket?: string | null;
    attachmentPath?: string | null;
    createdBy?: string | null;
    status?: AssignmentStatus;
  }) {
    const status = input.status ?? "draft";
    const { data, error } = await requireClient()
      .from("assignments")
      .insert({
        class_id: input.classId,
        title: input.title,
        description: input.description ?? null,
        instructions: input.instructions ?? null,
        due_at: input.dueAt ?? null,
        published_at:
          input.publishedAt ?? (status === "published" ? new Date().toISOString() : null),
        attachment_bucket: input.attachmentBucket ?? null,
        attachment_path: input.attachmentPath ?? null,
        created_by: input.createdBy ?? null,
        status,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async uploadAttachment(file: File, createdBy?: string | null) {
    const supabase = requireClient();
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `assignments/${createdBy ?? "staff"}/${crypto.randomUUID()}.${ext}`;
    const uploadOptions = file.type
      ? { upsert: false as const, contentType: file.type }
      : { upsert: false as const };
    const { error } = await supabase.storage.from("documents").upload(path, file, uploadOptions);
    if (error) throw error;
    return { attachmentBucket: "documents" as const, attachmentPath: path };
  },

  async publish(id: string) {
    const { data, error } = await requireClient()
      .from("assignments")
      .update({ status: "published", published_at: new Date().toISOString() })
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

  async upsertSubmission(input: {
    assignmentId: string;
    studentId: string;
    contentText?: string;
    status?: SubmissionStatus;
  }) {
    const status = input.status ?? "submitted";
    const { data, error } = await requireClient()
      .from("assignment_submissions")
      .upsert(
        {
          assignment_id: input.assignmentId,
          student_id: input.studentId,
          content_text: input.contentText ?? null,
          status,
          submitted_at: status === "submitted" ? new Date().toISOString() : null,
        },
        { onConflict: "assignment_id,student_id" },
      )
      .select("*")
      .single();
    if (error) throw error;
    return data;
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
