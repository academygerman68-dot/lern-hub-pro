import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database } from "@/types/database";

type ClassSchedule = Database["public"]["Tables"]["class_schedules"]["Row"];

function requireClient() {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase();
}

export const WEEKDAY_OPTIONS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 7, label: "Dim" },
] as const;

export function formatScheduleLabel(
  weekdays: number[],
  startTime: string,
  endTime: string,
): string {
  if (weekdays.length === 0) return "";
  const labels = WEEKDAY_OPTIONS.filter((d) => weekdays.includes(d.value)).map((d) => d.label);
  return `${labels.join("–")} ${startTime}–${endTime}`;
}

export const SupabaseClassScheduleService = {
  async listByClass(classId: string): Promise<ClassSchedule[]> {
    const { data, error } = await requireClient()
      .from("class_schedules")
      .select("*")
      .eq("class_id", classId)
      .order("weekday", { ascending: true });
    if (error) throw error;
    return (data as ClassSchedule[] | null) ?? [];
  },

  /**
   * Replace all weekly slots for a class.
   * Pass an empty weekdays array to clear the schedule.
   */
  async replaceForClass(input: {
    classId: string;
    weekdays: number[];
    startTime: string;
    endTime: string;
    titleTemplate?: string;
    timezone?: string;
  }): Promise<ClassSchedule[]> {
    const classId = input.classId;
    if (!classId) throw new Error("Groupe obligatoire.");
    const startTime = input.startTime.trim();
    const endTime = input.endTime.trim();
    const weekdays = [...new Set(input.weekdays)].filter((d) => d >= 1 && d <= 7).sort();

    if (weekdays.length > 0) {
      if (!startTime || !endTime) throw new Error("Horaires obligatoires.");
      if (endTime <= startTime) throw new Error("L’heure de fin doit être après le début.");
    }

    const client = requireClient();
    const { error: deleteError } = await client
      .from("class_schedules")
      .delete()
      .eq("class_id", classId);
    if (deleteError) throw deleteError;

    if (weekdays.length === 0) {
      await client.from("classes").update({ schedule_label: null }).eq("id", classId);
      return [];
    }

    const rows = weekdays.map((weekday) => ({
      class_id: classId,
      weekday,
      start_time: startTime,
      end_time: endTime,
      title_template: input.titleTemplate ?? "Cours allemand",
      timezone: input.timezone ?? "Africa/Casablanca",
    }));

    const { data, error } = await client
      .from("class_schedules")
      .insert(rows)
      .select("*")
      .order("weekday", { ascending: true });
    if (error) throw error;

    const label = formatScheduleLabel(weekdays, startTime, endTime);
    await client.from("classes").update({ schedule_label: label }).eq("id", classId);

    return (data as ClassSchedule[] | null) ?? [];
  },
};
