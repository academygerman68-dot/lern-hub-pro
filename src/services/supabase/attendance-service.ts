import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database } from "@/types/database";

type AttendanceMark = Database["public"]["Enums"]["attendance_mark"];

function requireClient() {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase();
}

export const SupabaseAttendanceService = {
  async listSessions(classId: string) {
    const { data, error } = await requireClient()
      .from("attendance_sessions")
      .select("*")
      .eq("class_id", classId)
      .order("session_date", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async openSession(input: {
    classId: string;
    teacherId?: string | null;
    createdBy?: string | null;
    sessionDate?: string;
    notes?: string;
  }) {
    const { data, error } = await requireClient()
      .from("attendance_sessions")
      .insert({
        class_id: input.classId,
        teacher_id: input.teacherId ?? null,
        created_by: input.createdBy ?? null,
        session_date: input.sessionDate ?? new Date().toISOString().slice(0, 10),
        notes: input.notes ?? null,
        starts_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async listRecords(sessionId: string) {
    const { data, error } = await requireClient()
      .from("attendance_records")
      .select("*")
      .eq("session_id", sessionId);
    if (error) throw error;
    return data ?? [];
  },

  async saveRecords(
    sessionId: string,
    records: Array<{ studentId: string; mark: AttendanceMark; note?: string }>,
  ) {
    const payload = records.map((r) => ({
      session_id: sessionId,
      student_id: r.studentId,
      mark: r.mark,
      note: r.note ?? null,
    }));
    const { data, error } = await requireClient()
      .from("attendance_records")
      .upsert(payload, { onConflict: "session_id,student_id" })
      .select("*");
    if (error) throw error;
    return data ?? [];
  },
};
