import { mapStudent, type StudentRow } from "@/lib/academy-mappers";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Student } from "@/types/academy";
import type { Database } from "@/types/database";

type StudentUpdate = Database["public"]["Tables"]["students"]["Update"];
type RecordStatus = Database["public"]["Enums"]["record_status"];

const STUDENT_SELECT = `
  id,
  student_code,
  level_code,
  status,
  notes,
  profile:profiles!students_profile_id_fkey (
    id,
    first_name,
    last_name,
    email,
    status
  ),
  enrollments (
    id,
    status,
    class:classes (
      id,
      name,
      schedule_label,
      level:levels ( code )
    )
  ),
  student_subscriptions ( status )
`;

function requireClient() {
  if (!isSupabaseConfigured) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }
  return getSupabase();
}

function mapRows(data: StudentRow[] | null): Student[] {
  return (data ?? []).map(mapStudent);
}

export const SupabaseStudentService = {
  async list(filters?: { status?: RecordStatus; search?: string }): Promise<Student[]> {
    const supabase = requireClient();
    let query = supabase
      .from("students")
      .select(STUDENT_SELECT)
      .order("created_at", { ascending: false });

    if (filters?.status) {
      query = query.eq("status", filters.status);
    } else {
      query = query.neq("status", "archived");
    }

    const { data, error } = await query;
    if (error) throw error;

    let rows = mapRows(data as StudentRow[] | null);
    const search = filters?.search?.trim().toLowerCase();
    if (search) {
      rows = rows.filter(
        (s) =>
          s.name.toLowerCase().includes(search) ||
          s.email.toLowerCase().includes(search) ||
          s.className.toLowerCase().includes(search) ||
          s.id.toLowerCase().includes(search),
      );
    }
    return rows;
  },

  async get(id: string): Promise<Student | null> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("students")
      .select(STUDENT_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapStudent(data as StudentRow) : null;
  },

  async search(query: string): Promise<Student[]> {
    return this.list({ search: query });
  },

  async create(input: {
    profileId: string;
    levelCode?: string | null;
    studentCode?: string | null;
    notes?: string | null;
  }): Promise<Student> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("students")
      .insert({
        profile_id: input.profileId,
        level_code: input.levelCode ?? null,
        student_code: input.studentCode ?? null,
        notes: input.notes ?? null,
        status: "active",
      })
      .select(STUDENT_SELECT)
      .single();
    if (error) throw error;
    return mapStudent(data as StudentRow);
  },

  async update(
    id: string,
    patch: Pick<StudentUpdate, "level_code" | "notes" | "student_code" | "status">,
  ): Promise<Student> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("students")
      .update(patch)
      .eq("id", id)
      .select(STUDENT_SELECT)
      .single();
    if (error) throw error;
    return mapStudent(data as StudentRow);
  },

  async setStatus(id: string, status: RecordStatus): Promise<Student> {
    const supabase = requireClient();
    const patch: StudentUpdate = { status };
    if (status === "archived") patch.archived_at = new Date().toISOString();
    if (status === "active") patch.archived_at = null;
    const { data, error } = await supabase
      .from("students")
      .update(patch)
      .eq("id", id)
      .select(STUDENT_SELECT)
      .single();
    if (error) throw error;
    return mapStudent(data as StudentRow);
  },

  async archive(id: string): Promise<Student> {
    return this.setStatus(id, "archived");
  },

  async suspend(id: string): Promise<Student> {
    return this.setStatus(id, "inactive");
  },

  async reactivate(id: string): Promise<Student> {
    return this.setStatus(id, "active");
  },
};
