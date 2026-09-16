import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database } from "@/types/database";

type LibraryItem = Database["public"]["Tables"]["library_items"]["Row"];
type LibraryCategory = Database["public"]["Enums"]["library_category"];
type LibraryVisibility = Database["public"]["Enums"]["library_visibility"];
type LibraryDomain = Database["public"]["Enums"]["library_domain"];
type LibraryAudience = Database["public"]["Enums"]["library_audience"];

function requireClient() {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase();
}

export const SupabaseLibraryService = {
  async list(): Promise<LibraryItem[]> {
    const { data, error } = await requireClient()
      .from("library_items")
      .select("*")
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: {
    title: string;
    description?: string;
    category?: LibraryCategory;
    domain?: LibraryDomain;
    audience?: LibraryAudience;
    classId?: string | null;
    levelCode?: string | null;
    language?: string;
    visibility?: LibraryVisibility;
    storagePath: string;
    storageBucket?: string;
    mimeType?: string | null;
    fileSize?: number | null;
    externalUrl?: string | null;
    createdBy?: string | null;
  }) {
    const audience = input.audience ?? "everyone";
    if (audience === "level" && !input.levelCode) {
      throw new Error("Le niveau est obligatoire pour une ressource ciblée.");
    }
    if (audience === "class" && !input.classId) {
      throw new Error("Le groupe est obligatoire pour une ressource ciblée.");
    }

    const { data, error } = await requireClient()
      .from("library_items")
      .insert({
        title: input.title,
        description: input.description ?? null,
        category: input.category ?? "course_material",
        domain: input.domain ?? "academic",
        audience,
        class_id: audience === "class" ? (input.classId ?? null) : null,
        level_code: input.levelCode ?? null,
        language: input.language ?? "de",
        visibility: input.visibility ?? "academy",
        storage_path: input.storagePath,
        storage_bucket: input.storageBucket ?? "library",
        mime_type: input.mimeType ?? null,
        file_size: input.fileSize ?? null,
        external_url: input.externalUrl ?? null,
        created_by: input.createdBy ?? null,
      })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async uploadAndCreate(input: {
    file?: File | null;
    title: string;
    description?: string;
    category?: LibraryCategory;
    domain?: LibraryDomain;
    audience?: LibraryAudience;
    classId?: string | null;
    levelCode?: string | null;
    externalUrl?: string | null;
    createdBy?: string | null;
  }) {
    const supabase = requireClient();
    let storagePath = `external/${crypto.randomUUID()}`;
    let storageBucket = "library";
    let mimeType: string | null = null;
    let fileSize: number | null = null;

    if (input.file) {
      const ext = input.file.name.split(".").pop() ?? "bin";
      storagePath = `${input.createdBy ?? "staff"}/${crypto.randomUUID()}.${ext}`;
      const uploadOptions = input.file.type
        ? { upsert: false as const, contentType: input.file.type }
        : { upsert: false as const };
      const { error: uploadError } = await supabase.storage
        .from("library")
        .upload(storagePath, input.file, uploadOptions);
      if (uploadError) throw uploadError;
      mimeType = input.file.type || null;
      fileSize = input.file.size;
    } else if (!input.externalUrl?.trim()) {
      throw new Error("Fichier ou lien requis.");
    }

    return this.create({
      title: input.title,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.domain !== undefined ? { domain: input.domain } : {}),
      ...(input.audience !== undefined ? { audience: input.audience } : {}),
      classId: input.classId ?? null,
      levelCode: input.levelCode ?? null,
      storagePath,
      storageBucket,
      mimeType,
      fileSize,
      externalUrl: input.externalUrl?.trim() || null,
      createdBy: input.createdBy ?? null,
    });
  },

  async getSignedUrl(
    item: Pick<LibraryItem, "storage_bucket" | "storage_path" | "external_url">,
    expiresIn = 3600,
  ) {
    if (item.external_url) return item.external_url;
    const { data, error } = await requireClient()
      .storage.from(item.storage_bucket)
      .createSignedUrl(item.storage_path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  async archive(id: string) {
    const { data, error } = await requireClient()
      .from("library_items")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },
};
