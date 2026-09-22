import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database } from "@/types/database";

type LibraryItem = Database["public"]["Tables"]["library_items"]["Row"];
type LibraryCategory = Database["public"]["Enums"]["library_category"];
type LibraryVisibility = Database["public"]["Enums"]["library_visibility"];
type LibraryDomain = Database["public"]["Enums"]["library_domain"];
type LibraryAudience = Database["public"]["Enums"]["library_audience"] | "classes";

function requireClient() {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase();
}

/** Untyped access for newly migrated tables not yet in generated Database types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromPending(table: "library_item_classes" | "library_subtypes"): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (requireClient() as any).from(table);
}

async function replaceLibraryItemClasses(itemId: string, classIds: string[]) {
  const { error: delError } = await fromPending("library_item_classes")
    .delete()
    .eq("library_item_id", itemId);
  if (delError) throw delError;
  const unique = [...new Set(classIds.filter(Boolean))];
  if (!unique.length) return;
  const { error: insError } = await fromPending("library_item_classes").insert(
    unique.map((classId) => ({ library_item_id: itemId, class_id: classId })),
  );
  if (insError) throw insError;
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

  async listSubtypes(domain?: LibraryDomain) {
    let query = fromPending("library_subtypes")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (domain) query = query.eq("domain", domain);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Array<{
      id: string;
      domain: LibraryDomain;
      code: string;
      label_fr: string;
      sort_order: number;
      active: boolean;
    }>;
  },

  async listClassTargets(libraryItemId: string): Promise<string[]> {
    const { data, error } = await fromPending("library_item_classes")
      .select("class_id")
      .eq("library_item_id", libraryItemId);
    if (error) throw error;
    return ((data ?? []) as Array<{ class_id: string }>).map((row) => row.class_id);
  },

  async create(input: {
    title: string;
    description?: string;
    category?: LibraryCategory;
    domain?: LibraryDomain;
    audience?: LibraryAudience;
    classId?: string | null;
    classIds?: string[];
    levelCode?: string | null;
    subtype?: string | null;
    contentKind?: Database["public"]["Enums"]["media_content_kind"];
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
    const multiIds = [...new Set((input.classIds ?? []).filter(Boolean))];
    if (audience === "classes" && multiIds.length === 0) {
      throw new Error("Sélectionnez au moins un groupe.");
    }

    const { data, error } = await requireClient()
      .from("library_items")
      .insert({
        title: input.title,
        description: input.description ?? null,
        category: input.category ?? "course_material",
        domain: input.domain ?? "academic",
        audience: audience as Database["public"]["Enums"]["library_audience"],
        content_kind: input.contentKind ?? "document",
        class_id:
          audience === "class"
            ? (input.classId ?? null)
            : audience === "classes"
              ? multiIds[0] ?? null
              : null,
        level_code: audience === "everyone" ? null : (input.levelCode ?? null),
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
    if (input.subtype) {
      const { error: subtypeError } = await requireClient()
        .from("library_items")
        .update({ subtype: input.subtype } as never)
        .eq("id", data.id);
      if (subtypeError) throw subtypeError;
    }
    if (audience === "classes") {
      await replaceLibraryItemClasses(data.id, multiIds);
    } else if (audience === "class" && input.classId) {
      await replaceLibraryItemClasses(data.id, [input.classId]);
    }
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
    classIds?: string[];
    levelCode?: string | null;
    subtype?: string | null;
    contentKind?: Database["public"]["Enums"]["media_content_kind"];
    externalUrl?: string | null;
    createdBy?: string | null;
  }) {
    const supabase = requireClient();
    let storagePath = `resources/external/${crypto.randomUUID()}`;
    const storageBucket = "library";
    let mimeType: string | null = null;
    let fileSize: number | null = null;

    if (input.file) {
      const ext = input.file.name.split(".").pop() ?? "bin";
      storagePath = `resources/${crypto.randomUUID()}.${ext}`;
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
      classIds: input.classIds ?? [],
      levelCode: input.levelCode ?? null,
      subtype: input.subtype ?? null,
      ...(input.contentKind !== undefined ? { contentKind: input.contentKind } : {}),
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

  async update(
    id: string,
    patch: {
      title?: string;
      description?: string | null;
      domain?: "academic" | "professional";
      audience?: LibraryAudience;
      levelCode?: string | null;
      classId?: string | null;
      classIds?: string[];
      subtype?: string | null;
      externalUrl?: string | null;
      contentKind?: string;
      storageBucket?: string | null;
      storagePath?: string | null;
      mimeType?: string | null;
      clearFile?: boolean;
    },
  ) {
    const update: Database["public"]["Tables"]["library_items"]["Update"] = {};
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.description !== undefined) update.description = patch.description;
    if (patch.domain !== undefined) update.domain = patch.domain;
    if (patch.audience !== undefined) {
      update.audience = patch.audience as Database["public"]["Enums"]["library_audience"];
    }
    if (patch.levelCode !== undefined) update.level_code = patch.levelCode;
    if (patch.classId !== undefined) update.class_id = patch.classId;
    if (patch.externalUrl !== undefined) update.external_url = patch.externalUrl;
    if (patch.contentKind !== undefined) {
      update.content_kind = patch.contentKind as Database["public"]["Enums"]["media_content_kind"];
    }
    if (patch.clearFile) {
      (update as { storage_bucket?: string | null }).storage_bucket = null;
      (update as { storage_path?: string | null }).storage_path = null;
      update.mime_type = null;
    } else {
      if (patch.storageBucket !== undefined && patch.storageBucket !== null) {
        update.storage_bucket = patch.storageBucket;
      }
      if (patch.storagePath !== undefined && patch.storagePath !== null) {
        update.storage_path = patch.storagePath;
      }
      if (patch.mimeType !== undefined) update.mime_type = patch.mimeType;
    }
    const { data, error } = await requireClient()
      .from("library_items")
      .update(update)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    if (patch.subtype !== undefined) {
      const { error: subtypeError } = await requireClient()
        .from("library_items")
        .update({ subtype: patch.subtype } as never)
        .eq("id", id);
      if (subtypeError) throw subtypeError;
    }

    if (patch.audience === "classes" || patch.classIds) {
      await replaceLibraryItemClasses(id, patch.classIds ?? []);
    } else if (patch.audience === "class" && patch.classId) {
      await replaceLibraryItemClasses(id, [patch.classId]);
    } else if (patch.audience === "everyone" || patch.audience === "level") {
      await replaceLibraryItemClasses(id, []);
    }
    return data;
  },

  async replaceFile(id: string, file: File) {
    const uploaded = await this.uploadFileOnly(file);
    return this.update(id, {
      storageBucket: uploaded.storageBucket,
      storagePath: uploaded.storagePath,
      mimeType: uploaded.mimeType,
      externalUrl: null,
      contentKind: file.type.startsWith("image/") ? "image" : "document",
    });
  },

  async uploadFileOnly(file: File) {
    const supabase = requireClient();
    const ext = file.name.split(".").pop() ?? "bin";
    const storagePath = `library/${crypto.randomUUID()}.${ext}`;
    const uploadOptions = file.type
      ? { upsert: false as const, contentType: file.type }
      : { upsert: false as const };
    const { error } = await supabase.storage
      .from("course-materials")
      .upload(storagePath, file, uploadOptions);
    if (error) throw error;
    return {
      storageBucket: "course-materials" as const,
      storagePath,
      mimeType: file.type || null,
    };
  },
};
