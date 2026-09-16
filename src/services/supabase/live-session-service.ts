import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database } from "@/types/database";
import {
  buildSessionRoomName,
  getJitsiConfig,
  validateLiveSessionSchedule,
} from "@/lib/jitsi-config";

type LiveSession = Database["public"]["Tables"]["live_sessions"]["Row"];
type LiveSessionStatus = Database["public"]["Enums"]["live_session_status"];

export type LiveSessionListItem = LiveSession & {
  class?: { id: string; name: string; teacher_id?: string | null } | null;
  teacher?: {
    id: string;
    profile: { first_name: string; last_name: string } | null;
  } | null;
};

function requireClient() {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase();
}

const SELECT = `
  *,
  class:classes ( id, name, teacher_id ),
  teacher:teachers (
    id,
    profile:profiles!teachers_profile_id_fkey ( first_name, last_name )
  )
`;

export const SupabaseLiveSessionService = {
  async list(filters?: { classId?: string; status?: LiveSessionStatus }) {
    let query = requireClient()
      .from("live_sessions")
      .select(SELECT)
      .order("starts_at", { ascending: true });

    if (filters?.classId) query = query.eq("class_id", filters.classId);
    if (filters?.status) query = query.eq("status", filters.status);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as LiveSessionListItem[];
  },

  async get(id: string) {
    const { data, error } = await requireClient()
      .from("live_sessions")
      .select(SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as LiveSessionListItem | null;
  },

  async create(input: {
    title: string;
    classId: string;
    teacherId?: string | null;
    startsAt: string;
    endsAt?: string | null;
    createdBy?: string | null;
  }) {
    const title = input.title.trim();
    if (!title) throw new Error("Le titre de la réunion est obligatoire.");
    if (!input.classId) throw new Error("La classe est obligatoire.");
    validateLiveSessionSchedule(input.startsAt, input.endsAt);

    const jitsi = getJitsiConfig();
    const supabase = requireClient();
    const id = crypto.randomUUID();
    const room = buildSessionRoomName(id);

    let teacherId = input.teacherId ?? null;
    if (!teacherId) {
      const { data: classRow } = await supabase
        .from("classes")
        .select("teacher_id")
        .eq("id", input.classId)
        .maybeSingle();
      teacherId = classRow?.teacher_id ?? null;
    }

    const provider = jitsi.requiresJwt ? "jaas" : "jitsi";

    const { data, error } = await supabase
      .from("live_sessions")
      .insert({
        id,
        title,
        class_id: input.classId,
        teacher_id: teacherId,
        starts_at: input.startsAt,
        ends_at: input.endsAt ?? null,
        meeting_provider: provider,
        meeting_room: room,
        meeting_url: `https://${jitsi.domain}/${room}`,
        created_by: input.createdBy ?? null,
        status: "scheduled",
      })
      .select(SELECT)
      .single();
    if (error) throw error;
    return data as LiveSessionListItem;
  },

  async updateStatus(id: string, status: LiveSessionStatus) {
    const { data, error } = await requireClient()
      .from("live_sessions")
      .update({ status })
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    return data as LiveSessionListItem;
  },
};
