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
    phone,
    status
  ),
  classes (
    id,
    name,
    status,
    level:levels ( code )
  )
`;

function requireClient() {
  if (!isSupabaseConfigured) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }
  return getSupabase();
}

const createUserErrors: Record<string, string> = {
  UNAUTHORIZED: "Votre session a expiré. Reconnectez-vous puis réessayez.",
  FORBIDDEN: "Seul un administrateur actif peut créer un professeur.",
  EMAIL_TAKEN: "Un compte existe déjà avec cet e-mail.",
  EMAIL_REQUIRED: "L’adresse e-mail est obligatoire.",
  PASSWORD_TOO_SHORT: "Le mot de passe doit contenir au moins 8 caractères.",
  NAME_REQUIRED: "Le prénom et le nom sont obligatoires.",
  UNSUPPORTED_ROLE: "Seul un compte professeur peut être créé ici.",
  TEACHER_PROFILE_PENDING:
    "Le compte Auth a été créé, mais le profil professeur n’est pas encore disponible.",
  SUPABASE_NOT_CONFIGURED: "Supabase n’est pas configuré.",
  CREATE_USER_FAILED: "Impossible de créer le compte professeur.",
};

async function readFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: Response; message?: string } | null)?.context;
  if (context && typeof context.clone === "function") {
    try {
      const body = (await context.clone().json()) as { error?: string; message?: string };
      const mapped = body.error ? createUserErrors[body.error] : undefined;
      if (mapped) return mapped;
      if (body.message) return body.message;
    } catch {
      // Fall through.
    }
  }
  return "Impossible de créer le professeur. Vérifiez la fonction admin-create-user.";
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

  /**
   * Creates a teacher via the admin-create-user Edge Function (Auth Admin API).
   * The current admin session is never replaced.
   */
  async createViaSignup(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
    specialties?: string[];
  }): Promise<Teacher> {
    const supabase = requireClient();
    const { data, error } = await supabase.functions.invoke<{
      id?: string;
      email?: string;
      error?: string;
    }>("admin-create-user", {
      body: {
        email: input.email,
        password: input.password,
        firstName: input.firstName,
        lastName: input.lastName,
        role: "teacher",
        ...(input.phone?.trim() ? { phone: input.phone.trim() } : {}),
        ...(input.specialties?.length ? { specialties: input.specialties } : {}),
      },
    });
    if (error) throw new Error(await readFunctionError(error));
    const mappedError = data?.error ? createUserErrors[data.error] : undefined;
    if (mappedError) throw new Error(mappedError);

    const email = input.email.trim().toLowerCase();
    const teachers = await this.list();
    const teacher =
      (data?.id ? teachers.find((item) => item.id === data.id) : null) ??
      teachers.find((item) => item.email.toLowerCase() === email) ??
      null;
    if (!teacher) {
      throw new Error(createUserErrors["TEACHER_PROFILE_PENDING"]);
    }
    return teacher;
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
