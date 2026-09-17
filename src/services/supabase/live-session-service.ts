import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database, Json } from "@/types/database";
import {
  buildSessionRoomName,
  getJitsiConfig,
  validateLiveSessionSchedule,
} from "@/lib/jitsi-config";

type LiveSession = Database["public"]["Tables"]["live_sessions"]["Row"];
type LiveSessionStatus = Database["public"]["Enums"]["live_session_status"];
type VideoProvider = Database["public"]["Enums"]["video_provider"];

type SensitiveZoomFields =
  | "zoom_url"
  | "zoom_join_url"
  | "zoom_start_url"
  | "zoom_password"
  | "zoom_meeting_id"
  | "zoom_creating_at";

export type LiveSessionListItem = Omit<LiveSession, SensitiveZoomFields> & {
  class?: {
    id: string;
    name: string;
    teacher_id?: string | null;
    level?: { id: string; code: string; name: string } | null;
  } | null;
  teacher?: {
    id: string;
    profile: { first_name: string; last_name: string } | null;
  } | null;
};

export type LiveJoinTarget = {
  provider: VideoProvider;
  url: string | null;
  room: string | null;
  start_url: string | null;
};

function requireClient() {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase();
}

const SELECT = `
  id, title, class_id, teacher_id, starts_at, ends_at, status,
  meeting_provider, meeting_room, meeting_url, video_provider,
  created_by, created_at, updated_at,
  class:classes (
    id,
    name,
    teacher_id,
    level:levels!classes_level_id_fkey ( id, code, name )
  ),
  teacher:teachers (
    id,
    profile:profiles!teachers_profile_id_fkey ( first_name, last_name )
  )
`;

function parseJoinTarget(raw: Json): LiveJoinTarget {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Impossible de déterminer la visioconférence.");
  }
  const provider = raw["provider"] === "zoom" ? "zoom" : "jitsi";
  const url = typeof raw["url"] === "string" ? raw["url"] : null;
  const room = typeof raw["room"] === "string" ? raw["room"] : null;
  const startUrl = typeof raw["start_url"] === "string" ? raw["start_url"] : null;
  return { provider, url, room, start_url: startUrl };
}

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

  async joinTarget(id: string): Promise<LiveJoinTarget> {
    const { data, error } = await requireClient().rpc("live_session_join_target", {
      p_session_id: id,
    });
    if (error) {
      if (error.message.includes("SESSION_ACCESS_DENIED")) {
        throw new Error("Vous n’êtes pas autorisé à rejoindre cette séance.");
      }
      if (error.message.includes("ZOOM_URL_MISSING")) {
        throw new Error("Le lien Zoom n’est pas encore enregistré.");
      }
      throw error;
    }
    return parseJoinTarget(data);
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
    if (!input.classId) throw new Error("Le groupe est obligatoire.");
    validateLiveSessionSchedule(input.startsAt, input.endsAt);

    const jitsi = getJitsiConfig();
    const supabase = requireClient();
    const id = crypto.randomUUID();
    const room = buildSessionRoomName(id, jitsi.jaasAppId);

    let teacherId = input.teacherId ?? null;
    if (!teacherId) {
      const { data: classRow } = await supabase
        .from("classes")
        .select("teacher_id")
        .eq("id", input.classId)
        .maybeSingle();
      teacherId = classRow?.teacher_id ?? null;
    }

    const provider = jitsi.provider === "jaas" ? "jaas" : "jitsi";

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
        video_provider: "jitsi",
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

  async createEmergencyZoom(id: string) {
    const { data, error } = await requireClient().functions.invoke<{
      ok?: boolean;
      reused?: boolean;
      error?: string;
      message?: string;
    }>("create-emergency-zoom-meeting", { body: { sessionId: id } });
    if (error) {
      const context = (error as { context?: Response }).context;
      if (context && typeof context.clone === "function") {
        const body = (await context
          .clone()
          .json()
          .catch(() => null)) as { message?: string; error?: string } | null;
        if (body?.message) throw new Error(body.message);
      }
      throw new Error(
        "Impossible de créer la réunion Zoom d’urgence. Veuillez réessayer dans quelques instants.",
      );
    }
    if (!data?.ok) {
      throw new Error(
        data?.message ??
          "Impossible de créer la réunion Zoom d’urgence. Veuillez réessayer dans quelques instants.",
      );
    }
    const session = await this.get(id);
    if (!session) throw new Error("La séance est introuvable après la création Zoom.");
    return { session, reused: Boolean(data.reused) };
  },

  async revertToJitsi(id: string) {
    const { data, error } = await requireClient()
      .from("live_sessions")
      .update({ video_provider: "jitsi" })
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) throw error;
    return data as LiveSessionListItem;
  },
};
