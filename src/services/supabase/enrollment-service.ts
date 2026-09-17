import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database } from "@/types/database";

type EnrollmentRow = Database["public"]["Tables"]["enrollments"]["Row"];
type EnrollmentInsert = Database["public"]["Tables"]["enrollments"]["Insert"];
type EnrollmentStatus = Database["public"]["Enums"]["enrollment_status"];

export type EnrollmentRecord = EnrollmentRow & {
  student?: { id: string; student_code: string | null } | null;
  class?: { id: string; name: string } | null;
};

function requireClient() {
  if (!isSupabaseConfigured) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }
  return getSupabase();
}

export const SupabaseEnrollmentService = {
  async list(): Promise<EnrollmentRecord[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("enrollments")
      .select(
        `
        *,
        student:students!enrollments_student_id_fkey ( id, student_code ),
        class:classes!enrollments_class_id_fkey ( id, name )
      `,
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as EnrollmentRecord[] | null) ?? [];
  },

  async listByStudent(studentId: string): Promise<EnrollmentRecord[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("enrollments")
      .select(
        `
        *,
        class:classes!enrollments_class_id_fkey ( id, name )
      `,
      )
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as EnrollmentRecord[] | null) ?? [];
  },

  async listByClass(classId: string): Promise<EnrollmentRecord[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("enrollments")
      .select(
        `
        *,
        student:students!enrollments_student_id_fkey ( id, student_code )
      `,
      )
      .eq("class_id", classId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as EnrollmentRecord[] | null) ?? [];
  },

  async create(input: {
    studentId: string;
    classId: string;
    status?: EnrollmentStatus;
    startDate?: string | null;
    endDate?: string | null;
  }): Promise<EnrollmentRecord & { movedFromClassNames: string[] }> {
    const supabase = requireClient();
    const today = new Date().toISOString().slice(0, 10);

    // One active group at a time: withdraw other active enrollments first.
    const { data: previous, error: previousError } = await supabase
      .from("enrollments")
      .select(
        `
        id,
        class:classes!enrollments_class_id_fkey ( id, name )
      `,
      )
      .eq("student_id", input.studentId)
      .eq("status", "active")
      .neq("class_id", input.classId);
    if (previousError) throw previousError;

    const movedFromClassNames = (previous ?? [])
      .map((row) => {
        const cls = row.class as { id: string; name: string } | null;
        return cls?.name ?? null;
      })
      .filter((name): name is string => Boolean(name));

    if ((previous ?? []).length > 0) {
      const { error: withdrawError } = await supabase
        .from("enrollments")
        .update({ status: "withdrawn", end_date: today })
        .eq("student_id", input.studentId)
        .eq("status", "active")
        .neq("class_id", input.classId);
      if (withdrawError) throw withdrawError;
    }

    // Re-activate if the student was previously in this class.
    const { data: existingSame } = await supabase
      .from("enrollments")
      .select("id")
      .eq("student_id", input.studentId)
      .eq("class_id", input.classId)
      .maybeSingle();

    if (existingSame?.id) {
      const { data, error } = await supabase
        .from("enrollments")
        .update({
          status: input.status ?? "active",
          start_date: input.startDate ?? today,
          end_date: null,
        })
        .eq("id", existingSame.id)
        .select(
          `
          *,
          student:students!enrollments_student_id_fkey ( id, student_code ),
          class:classes!enrollments_class_id_fkey ( id, name )
        `,
        )
        .single();
      if (error) throw error;
      return { ...(data as EnrollmentRecord), movedFromClassNames };
    }

    const payload: EnrollmentInsert = {
      student_id: input.studentId,
      class_id: input.classId,
      status: input.status ?? "active",
      start_date: input.startDate ?? today,
      end_date: input.endDate ?? null,
    };
    const { data, error } = await supabase
      .from("enrollments")
      .insert(payload)
      .select(
        `
        *,
        student:students!enrollments_student_id_fkey ( id, student_code ),
        class:classes!enrollments_class_id_fkey ( id, name )
      `,
      )
      .single();
    if (error) throw error;
    return { ...(data as EnrollmentRecord), movedFromClassNames };
  },

  async updateStatus(id: string, status: EnrollmentStatus, endDate?: string | null) {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("enrollments")
      .update({
        status,
        end_date: endDate ?? (status === "active" ? null : new Date().toISOString().slice(0, 10)),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async end(id: string): Promise<EnrollmentRow> {
    return this.updateStatus(id, "completed");
  },

  async withdraw(id: string): Promise<EnrollmentRow> {
    return this.updateStatus(id, "withdrawn");
  },

  async suspend(id: string): Promise<EnrollmentRow> {
    return this.updateStatus(id, "suspended");
  },
};
