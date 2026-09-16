import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database } from "@/types/database";

type LibraryItem = Database["public"]["Tables"]["library_items"]["Row"];
type LibraryCategory = Database["public"]["Enums"]["library_category"];
type LibraryVisibility = Database["public"]["Enums"]["library_visibility"];

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
    levelCode?: string | null;
    language?: string;
    visibility?: LibraryVisibility;
    storagePath: string;
    storageBucket?: string;
    mimeType?: string | null;
    fileSize?: number | null;
    createdBy?: string | null;
    expiresAt?: string | null;
    publishedAt?: string | null;
  }) {
    const { data, error } = await requireClient()
      .from("library_items")
      .insert({
        title: input.title,
        description: input.description ?? null,
        category: input.category ?? "course_material",
        level_code: input.levelCode ?? null,
        language: input.language ?? "de",
        visibility: input.visibility ?? "academy",
        storage_path: input.storagePath,
        storage_bucket: input.storageBucket ?? "library",
        mime_type: input.mimeType ?? null,
        file_size: input.fileSize ?? null,
        created_by: input.createdBy ?? null,
        expires_at: input.expiresAt ?? null,
        published_at: input.publishedAt ?? new Date().toISOString(),
      } as never)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async uploadAndCreate(input: {
    file: File;
    title: string;
    description?: string;
    category?: LibraryCategory;
    levelCode?: string | null;
    createdBy?: string | null;
  }) {
    const supabase = requireClient();
    const ext = input.file.name.split(".").pop() ?? "bin";
    const path = `${input.createdBy ?? "staff"}/${crypto.randomUUID()}.${ext}`;
    const uploadOptions = input.file.type
      ? { upsert: false as const, contentType: input.file.type }
      : { upsert: false as const };
    const { error: uploadError } = await supabase.storage
      .from("library")
      .upload(path, input.file, uploadOptions);
    if (uploadError) throw uploadError;

    return this.create({
      title: input.title,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      levelCode: input.levelCode ?? null,
      storagePath: path,
      storageBucket: "library",
      mimeType: input.file.type || null,
      fileSize: input.file.size,
      createdBy: input.createdBy ?? null,
    });
  },

  async getSignedUrl(item: Pick<LibraryItem, "storage_bucket" | "storage_path">, expiresIn = 3600) {
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
