import {
  mapClass,
  mapClassDetail,
  mapStudent,
  type ClassDetail,
  type ClassRow,
  type StudentRow,
} from "@/lib/academy-mappers";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { AcademyClass, Student } from "@/types/academy";
import type { Database } from "@/types/database";

type ClassInsert = Database["public"]["Tables"]["classes"]["Insert"];
type ClassUpdate = Database["public"]["Tables"]["classes"]["Update"];
type ClassStatus = Database["public"]["Enums"]["class_status"];

const CLASS_SELECT = `
  id,
  name,
  capacity,
  status,
  room,
  schedule_label,
  level:levels!classes_level_id_fkey (
    id,
    code,
    name
  ),
  teacher:teachers!classes_teacher_id_fkey (
    id,
    profile:profiles!teachers_profile_id_fkey (
      id,
      first_name,
      last_name,
      email,
      phone,
      status
    )
  ),
  enrollments (
    id,
    status
  )
`;

function requireClient() {
  if (!isSupabaseConfigured) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }
  return getSupabase();
}

export const SupabaseClassService = {
  async list(): Promise<AcademyClass[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("classes")
      .select(CLASS_SELECT)
      .neq("status", "archived")
      .order("name");
    if (error) throw error;
    return (data as ClassRow[] | null)?.map(mapClass) ?? [];
  },

  async listDetailed(): Promise<ClassDetail[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("classes")
      .select(CLASS_SELECT)
      .neq("status", "archived")
      .order("name");
    if (error) throw error;
    return (data as ClassRow[] | null)?.map(mapClassDetail) ?? [];
  },

  async get(id: string): Promise<ClassDetail | null> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("classes")
      .select(CLASS_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapClassDetail(data as ClassRow) : null;
  },

  async create(input: {
    name: string;
    levelId: string;
    teacherId?: string | null;
    capacity?: number;
    room?: string | null;
    scheduleLabel?: string | null;
    status?: ClassStatus;
    startDate?: string | null;
    endDate?: string | null;
  }): Promise<ClassDetail> {
    const supabase = requireClient();
    const payload: ClassInsert = {
      name: input.name,
      level_id: input.levelId,
      teacher_id: input.teacherId ?? null,
      capacity: input.capacity ?? 20,
      room: input.room ?? null,
      schedule_label: input.scheduleLabel ?? null,
      status: input.status ?? "planned",
      start_date: input.startDate ?? null,
      end_date: input.endDate ?? null,
    };
    const { data, error } = await supabase
      .from("classes")
      .insert(payload)
      .select(CLASS_SELECT)
      .single();
    if (error) throw error;
    return mapClassDetail(data as ClassRow);
  },

  async update(id: string, patch: ClassUpdate): Promise<ClassDetail> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("classes")
      .update(patch)
      .eq("id", id)
      .select(CLASS_SELECT)
      .single();
    if (error) throw error;
    return mapClassDetail(data as ClassRow);
  },

  async archive(id: string): Promise<ClassDetail> {
    return this.update(id, {
      status: "archived",
      archived_at: new Date().toISOString(),
    });
  },

  async listEnrolledStudents(classId: string): Promise<Student[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from("enrollments")
      .select(
        `
        status,
        student:students!enrollments_student_id_fkey (
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
            phone,
            status
          ),
          enrollments (
            id,
            status,
            class:classes (
              id,
              name,
              schedule_label,
              level:levels ( code ),
              teacher:teachers!classes_teacher_id_fkey (
                id,
                profile:profiles!teachers_profile_id_fkey (
                  id,
                  first_name,
                  last_name,
                  email
                )
              )
            )
          ),
          student_subscriptions ( status )
        )
      `,
      )
      .eq("class_id", classId)
      .eq("status", "active");
    if (error) throw error;

    return (data ?? [])
      .map((row) => {
        const student = Array.isArray(row.student) ? row.student[0] : row.student;
        return student ? mapStudent(student as StudentRow) : null;
      })
      .filter((s): s is Student => s != null);
  },
};
