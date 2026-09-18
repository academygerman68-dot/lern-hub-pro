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

  /**
   * Update title / schedule only — keeps meeting room & Zoom as-is.
   * Checks obvious overlaps for the same group or same teacher.
   */
  async updateSchedule(
    id: string,
    input: {
      title?: string;
      startsAt: string;
      endsAt: string | null;
      /** Actor profile id — excluded from notifications. */
      actorProfileId?: string | null;
    },
  ): Promise<LiveSessionListItem> {
    const supabase = requireClient();
    const current = await this.get(id);
    if (!current) throw new Error("Séance introuvable.");
    if (current.status === "cancelled") {
      throw new Error("Impossible de modifier une séance annulée.");
    }

    const title = (input.title ?? current.title).trim();
    if (!title) throw new Error("Le titre de la réunion est obligatoire.");
    validateLiveSessionSchedule(input.startsAt, input.endsAt);

    const newStart = new Date(input.startsAt).getTime();
    const newEnd = input.endsAt ? new Date(input.endsAt).getTime() : newStart + 2 * 60 * 60_000;

    const orParts = [
      current.class_id ? `class_id.eq.${current.class_id}` : null,
      current.teacher_id ? `teacher_id.eq.${current.teacher_id}` : null,
    ].filter(Boolean) as string[];

    if (orParts.length > 0) {
      const { data: candidates, error: conflictError } = await supabase
        .from("live_sessions")
        .select("id, title, starts_at, ends_at, class_id, teacher_id, status")
        .neq("id", id)
        .neq("status", "cancelled")
        .or(orParts.join(","));
      if (conflictError) throw conflictError;

      for (const row of candidates ?? []) {
        const otherStart = new Date(row.starts_at).getTime();
        const otherEnd = row.ends_at
          ? new Date(row.ends_at).getTime()
          : otherStart + 2 * 60 * 60_000;
        const overlaps = newStart < otherEnd && otherStart < newEnd;
        if (!overlaps) continue;
        if (current.class_id && row.class_id === current.class_id) {
          throw new Error(
            "Ce créneau chevauche une autre séance du même groupe. Choisissez un autre horaire.",
          );
        }
        if (current.teacher_id && row.teacher_id === current.teacher_id) {
          throw new Error(
            "Ce créneau chevauche une autre séance du même professeur. Choisissez un autre horaire.",
          );
        }
      }
    }

    const { data, error } = await supabase
      .from("live_sessions")
      .update({
        title,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
      })
      .eq("id", id)
      .select(SELECT)
      .single();
    if (error) {
      if (error.message.includes("permission") || error.code === "42501") {
        throw new Error("Vous n’êtes pas autorisé à modifier cette séance.");
      }
      throw new Error("Impossible d’enregistrer le nouvel horaire.");
    }

    const updated = data as LiveSessionListItem;
    await this.notifyScheduleChange({
      session: updated,
      previousStartsAt: current.starts_at,
      previousEndsAt: current.ends_at,
      actorProfileId: input.actorProfileId ?? null,
    }).catch(() => undefined);

    return updated;
  },

  async notifyScheduleChange(input: {
    session: LiveSessionListItem;
    previousStartsAt: string;
    previousEndsAt: string | null;
    actorProfileId?: string | null;
  }) {
    const session = input.session;
    const className = session.class?.name ?? "votre groupe";
    const weekday = new Date(session.starts_at).toLocaleDateString("fr-FR", {
      weekday: "long",
    });
    const fmt = (iso: string) =>
      new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const range = session.ends_at
      ? `${fmt(session.starts_at)}–${fmt(session.ends_at)}`
      : fmt(session.starts_at);
    const message = `L’horaire du cours ${className} a été modifié : ${weekday} ${range}.`;
    const title = "Horaire de cours modifié";

    const supabase = requireClient();
    const recipientIds = new Set<string>();

    if (session.class_id) {
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("student:students!enrollments_student_id_fkey ( profile_id )")
        .eq("class_id", session.class_id)
        .eq("status", "active");
      for (const row of enrollments ?? []) {
        const student = row.student as { profile_id?: string } | null;
        if (student?.profile_id) recipientIds.add(student.profile_id);
      }
    }

    if (session.teacher_id) {
      const { data: teacher } = await supabase
        .from("teachers")
        .select("profile_id")
        .eq("id", session.teacher_id)
        .maybeSingle();
      if (teacher?.profile_id) recipientIds.add(teacher.profile_id);
    }

    if (input.actorProfileId) recipientIds.delete(input.actorProfileId);

    await Promise.all(
      [...recipientIds].map((recipientId) =>
        supabase.rpc("create_in_app_notification", {
          p_recipient_id: recipientId,
          p_title: title,
          p_message: message,
          p_category: "live",
          p_link_page: "live",
          p_link_id: session.id,
        }),
      ),
    );
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

  async generateMonthSessions(classId: string, year: number, month: number) {
    if (!classId) throw new Error("Le groupe est obligatoire.");
    if (!Number.isInteger(year) || year < 2000) throw new Error("Année invalide.");
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error("Mois invalide.");
    const { data, error } = await requireClient().rpc("generate_class_month_sessions", {
      p_class_id: classId,
      p_year: year,
      p_month: month,
    });
    if (error) throw error;
    return typeof data === "number" ? data : Number(data ?? 0);
  },

  async listParticipants(sessionId: string) {
    const { data, error } = await requireClient()
      .from("live_session_participants")
      .select(
        `
        session_id,
        profile_id,
        added_by,
        created_at,
        profile:profiles!live_session_participants_profile_id_fkey (
          id, first_name, last_name, email
        )
      `,
      )
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async addParticipant(sessionId: string, profileId: string, addedBy?: string | null) {
    const { data, error } = await requireClient()
      .from("live_session_participants")
      .upsert(
        {
          session_id: sessionId,
          profile_id: profileId,
          added_by: addedBy ?? null,
        },
        { onConflict: "session_id,profile_id" },
      )
      .select(
        `
        session_id,
        profile_id,
        added_by,
        created_at,
        profile:profiles!live_session_participants_profile_id_fkey (
          id, first_name, last_name, email
        )
      `,
      )
      .single();
    if (error) throw error;
    return data;
  },

  async removeParticipant(sessionId: string, profileId: string) {
    const { error } = await requireClient()
      .from("live_session_participants")
      .delete()
      .eq("session_id", sessionId)
      .eq("profile_id", profileId);
    if (error) throw error;
  },
};
