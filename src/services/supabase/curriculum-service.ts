import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database } from "@/types/database";

type ContentStatus = Database["public"]["Enums"]["content_status"];
type CourseContentKind = Database["public"]["Enums"]["course_content_kind"];
type Course = Database["public"]["Tables"]["courses"]["Row"];
type Module = Database["public"]["Tables"]["modules"]["Row"];
type Unit = Database["public"]["Tables"]["units"]["Row"];
type Lesson = Database["public"]["Tables"]["lessons"]["Row"];
type Level = Database["public"]["Tables"]["levels"]["Row"];

function requireClient() {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase();
}

export type CourseTree = Course & {
  level: Pick<Level, "id" | "code" | "name"> | null;
  modules: Array<
    Module & {
      units: Array<Unit & { lessons: Lesson[] }>;
    }
  >;
};

export const SupabaseCurriculumService = {
  async listLevels() {
    const { data, error } = await requireClient()
      .from("levels")
      .select("id, code, name, description, sort_order, is_active")
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw error;
    return data ?? [];
  },

  async listCourses(): Promise<CourseTree[]> {
    const { data, error } = await requireClient()
      .from("courses")
      .select(
        `
        *,
        level:levels!courses_level_id_fkey ( id, code, name ),
        modules (
          *,
          units (
            *,
            lessons ( * )
          )
        )
      `,
      )
      .neq("status", "archived")
      .order("sort_order");
    if (error) throw error;
    return (data as CourseTree[] | null) ?? [];
  },

  async listPublishedModules() {
    const courses = await this.listCourses();
    return courses
      .filter((c) => c.status === "published")
      .flatMap((course) =>
        (course.modules ?? [])
          .filter((m) => m.status === "published")
          .map((module) => ({
            id: module.id,
            title: module.title,
            level: course.level?.code ?? "—",
            courseTitle: course.title,
            lessons: (module.units ?? [])
              .flatMap((u) => u.lessons ?? [])
              .filter((l) => l.status === "published").length,
            progress: 0,
            exercises: 0,
          })),
      );
  },

  async listLessons(filters?: { status?: ContentStatus }) {
    let query = requireClient()
      .from("lessons")
      .select(
        `
        *,
        unit:units!lessons_unit_id_fkey (
          id, title, module_id,
          module:modules!units_module_id_fkey ( id, title, course_id )
        )
      `,
      )
      .order("sort_order");
    if (filters?.status) query = query.eq("status", filters.status);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async getLesson(id: string) {
    const { data, error } = await requireClient()
      .from("lessons")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async createCourse(input: {
    levelId: string;
    title: string;
    description?: string;
    status?: ContentStatus;
    contentKind?: CourseContentKind;
    contentUrl?: string | null;
    storageBucket?: string | null;
    storagePath?: string | null;
    mimeType?: string | null;
  }) {
    const { data, error } = await requireClient()
      .from("courses")
      .insert({
        level_id: input.levelId,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? "draft",
        content_kind: input.contentKind ?? "none",
        content_url: input.contentUrl ?? null,
        storage_bucket: input.storageBucket ?? null,
        storage_path: input.storagePath ?? null,
        mime_type: input.mimeType ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async updateCourse(id: string, patch: Database["public"]["Tables"]["courses"]["Update"]) {
    const { data, error } = await requireClient()
      .from("courses")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async archiveCourse(id: string) {
    return this.updateCourse(id, { status: "archived" });
  },

  async deleteCourse(id: string) {
    const supabase = requireClient();
    const { data: course, error: readError } = await supabase
      .from("courses")
      .select("storage_bucket, storage_path")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (course?.storage_bucket && course.storage_path) {
      await supabase.storage.from(course.storage_bucket).remove([course.storage_path]);
    }
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) throw error;
  },

  async uploadCourseMaterial(file: File, folder = "courses") {
    const supabase = requireClient();
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const uploadOptions = file.type
      ? { upsert: false as const, contentType: file.type }
      : { upsert: false as const };
    const { error } = await supabase.storage
      .from("course-materials")
      .upload(path, file, uploadOptions);
    if (error) throw error;
    return {
      storageBucket: "course-materials" as const,
      storagePath: path,
      mimeType: file.type || null,
    };
  },

  async getCourseMaterialUrl(
    course: Pick<Course, "content_kind" | "content_url" | "storage_bucket" | "storage_path">,
    expiresIn = 3600,
  ) {
    if (course.content_kind === "link" && course.content_url) return course.content_url;
    if (!course.storage_bucket || !course.storage_path) {
      if (course.content_url) return course.content_url;
      throw new Error("Aucun contenu disponible");
    }
    const { data, error } = await requireClient()
      .storage.from(course.storage_bucket)
      .createSignedUrl(course.storage_path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  async createModule(input: { courseId: string; title: string; description?: string }) {
    const { data, error } = await requireClient()
      .from("modules")
      .insert({
        course_id: input.courseId,
        title: input.title,
        description: input.description ?? null,
        status: "draft",
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async createUnit(input: { moduleId: string; title: string; description?: string }) {
    const { data, error } = await requireClient()
      .from("units")
      .insert({
        module_id: input.moduleId,
        title: input.title,
        description: input.description ?? null,
        status: "draft",
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async createLesson(input: {
    unitId: string;
    title: string;
    description?: string;
    contentMarkdown?: string;
    durationMinutes?: number;
  }) {
    const { data, error } = await requireClient()
      .from("lessons")
      .insert({
        unit_id: input.unitId,
        title: input.title,
        description: input.description ?? null,
        content_markdown: input.contentMarkdown ?? null,
        duration_minutes: input.durationMinutes ?? 45,
        status: "draft",
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async updateLesson(id: string, patch: Database["public"]["Tables"]["lessons"]["Update"]) {
    const { data, error } = await requireClient()
      .from("lessons")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async publishLesson(id: string) {
    return this.updateLesson(id, { status: "published" });
  },

  async unpublishLesson(id: string) {
    return this.updateLesson(id, { status: "draft" });
  },

  async ensureDefaultUnitForCourse(courseId: string) {
    const { data: modules, error } = await requireClient()
      .from("modules")
      .select("id, units(id)")
      .eq("course_id", courseId)
      .order("sort_order")
      .limit(1);
    if (error) throw error;
    let moduleId = modules?.[0]?.id;
    if (!moduleId) {
      const created = await this.createModule({ courseId, title: "Module 1" });
      moduleId = created.id;
    }
    const units = (modules?.[0] as { units?: { id: string }[] } | undefined)?.units;
    if (units?.[0]?.id) return units[0].id;
    const unit = await this.createUnit({ moduleId, title: "Unit 1" });
    return unit.id;
  },
};
