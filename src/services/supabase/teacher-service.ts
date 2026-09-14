import { mapTeacher, type TeacherRow } from "@/lib/academy-mappers";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Teacher } from "@/types/academy";
import type { Database } from "@/types/database";

type TeacherUpdate = Database["public"]["Tables"]["teachers"]["Update"];
type RecordStatus = Database["public"]["Enums"]["record_status"];

const TEACHER_SELECT = `
  id,
  employee_code,
  specialties,
  status,
  bio,
  profile:profiles!teachers_profile_id_fkey (
    id,
    first_name,
    last_name,
    email,
    status
  ),
  classes (
    id,
    name,
    status
  )
`;

function requireClient() {
  if (!isSupabaseConfigured) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }
  return getSupabase();
}

export const SupabaseTeacherService = {
  async list(): Promise<Teacher[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("teachers")
      .select(TEACHER_SELECT)
      .neq("status", "archived")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as TeacherRow[] | null)?.map(mapTeacher) ?? [];
  },

  async get(id: string): Promise<Teacher | null> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("teachers")
      .select(TEACHER_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapTeacher(data as TeacherRow) : null;
  },

  async create(input: {
    profileId: string;
    specialties?: string[];
    employeeCode?: string | null;
    bio?: string | null;
  }): Promise<Teacher> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("teachers")
      .insert({
        profile_id: input.profileId,
        specialties: input.specialties ?? [],
        employee_code: input.employeeCode ?? null,
        bio: input.bio ?? null,
        status: "active",
      })
      .select(TEACHER_SELECT)
      .single();
    if (error) throw error;
    return mapTeacher(data as TeacherRow);
  },

  async update(
    id: string,
    patch: Pick<TeacherUpdate, "specialties" | "bio" | "employee_code" | "status" | "hourly_rate">,
  ): Promise<Teacher> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("teachers")
      .update(patch)
      .eq("id", id)
      .select(TEACHER_SELECT)
      .single();
    if (error) throw error;
    return mapTeacher(data as TeacherRow);
  },

  async setStatus(id: string, status: RecordStatus): Promise<Teacher> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("teachers")
      .update({
        status,
        archived_at: status === "archived" ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select(TEACHER_SELECT)
      .single();
    if (error) throw error;
    return mapTeacher(data as TeacherRow);
  },

  async archive(id: string): Promise<Teacher> {
    return this.setStatus(id, "archived");
  },

  async suspend(id: string): Promise<Teacher> {
    return this.setStatus(id, "inactive");
  },

  async reactivate(id: string): Promise<Teacher> {
    return this.setStatus(id, "active");
  },

  async listAssignedClasses(teacherId: string) {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("classes")
      .select("id, name, status, schedule_label, room")
      .eq("teacher_id", teacherId)
      .neq("status", "archived")
      .order("name");
    if (error) throw error;
    return data ?? [];
  },
};
