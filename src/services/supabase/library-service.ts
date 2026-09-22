import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database } from "@/types/database";

type LibraryItem = Database["public"]["Tables"]["library_items"]["Row"];
type LibraryCategory = Database["public"]["Enums"]["library_category"];
type LibraryVisibility = Database["public"]["Enums"]["library_visibility"];
type LibraryDomain = Database["public"]["Enums"]["library_domain"];
type LibraryAudience = Database["public"]["Enums"]["library_audience"] | "classes";
type MediaKind = Database["public"]["Enums"]["media_content_kind"];

export type LibraryAttachmentRow = {
  id: string;
  library_item_id: string;
  sort_order: number;
  content_kind: MediaKind;
  storage_bucket: string | null;
  storage_path: string | null;
  mime_type: string | null;
  file_size: number | null;
  external_url: string | null;
  text_body: string | null;
  label: string | null;
};

export type LibraryAttachmentInput = {
  contentKind: MediaKind;
  file?: File | null;
  externalUrl?: string | null;
  textBody?: string | null;
  label?: string | null;
  /** Keep existing stored file when editing without re-upload. */
  existing?: Partial<LibraryAttachmentRow> | null;
};

function requireClient() {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase();
}

/** Untyped access for tables not yet fully mirrored in generated Database types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fromPending(table: "library_item_classes" | "library_subtypes" | "library_item_attachments"): any {
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

async function uploadLibraryFile(file: File) {
  const supabase = requireClient();
  const ext = file.name.split(".").pop() ?? "bin";
  const storagePath = `resources/${crypto.randomUUID()}.${ext}`;
  const uploadOptions = file.type
    ? { upsert: false as const, contentType: file.type }
    : { upsert: false as const };
  const { error: uploadError } = await supabase.storage
    .from("library")
    .upload(storagePath, file, uploadOptions);
  if (uploadError) throw uploadError;
  return {
    storageBucket: "library",
    storagePath,
    mimeType: file.type || null,
    fileSize: file.size,
  };
}

async function replaceAttachments(itemId: string, attachments: LibraryAttachmentInput[]) {
  const { error: delError } = await fromPending("library_item_attachments")
    .delete()
    .eq("library_item_id", itemId);
  if (delError) throw delError;

  const rows = [];
  for (let i = 0; i < attachments.length; i += 1) {
    const att = attachments[i]!;
    let storageBucket = att.existing?.storage_bucket ?? null;
    let storagePath = att.existing?.storage_path ?? null;
    let mimeType = att.existing?.mime_type ?? null;
    let fileSize = att.existing?.file_size ?? null;
    let externalUrl = att.externalUrl?.trim() || att.existing?.external_url || null;
    const textBody = att.textBody?.trim() || att.existing?.text_body || null;

    if (att.file) {
      const uploaded = await uploadLibraryFile(att.file);
      storageBucket = uploaded.storageBucket;
      storagePath = uploaded.storagePath;
      mimeType = uploaded.mimeType;
      fileSize = uploaded.fileSize;
      externalUrl = null;
    } else if (att.contentKind === "link") {
      storageBucket = null;
      storagePath = null;
      mimeType = null;
      fileSize = null;
    } else if (att.contentKind === "text") {
      storageBucket = null;
      storagePath = null;
      mimeType = "text/plain";
      fileSize = null;
      externalUrl = null;
    }

    rows.push({
      library_item_id: itemId,
      sort_order: i,
      content_kind: att.contentKind,
      storage_bucket: storageBucket,
      storage_path: storagePath,
      mime_type: mimeType,
      file_size: fileSize,
      external_url: externalUrl,
      text_body: textBody,
      label: att.label ?? null,
    });
  }

  if (!rows.length) return [];
  const { data, error } = await fromPending("library_item_attachments").insert(rows).select("*");
  if (error) throw error;
  return (data ?? []) as LibraryAttachmentRow[];
}

function primaryFieldsFromAttachments(attachments: LibraryAttachmentInput[]) {
  const primary = attachments[0];
  if (!primary) {
    return {
      contentKind: "document" as MediaKind,
      storagePath: `resources/external/${crypto.randomUUID()}`,
      storageBucket: "library",
      mimeType: null as string | null,
      fileSize: null as number | null,
      externalUrl: null as string | null,
      descriptionExtra: null as string | null,
    };
  }
  return {
    contentKind: primary.contentKind,
    storagePath: primary.existing?.storage_path ?? `resources/external/${crypto.randomUUID()}`,
    storageBucket: primary.existing?.storage_bucket ?? "library",
    mimeType: primary.existing?.mime_type ?? null,
    fileSize: primary.existing?.file_size ?? null,
    externalUrl: primary.externalUrl?.trim() || primary.existing?.external_url || null,
    descriptionExtra: primary.contentKind === "text" ? primary.textBody?.trim() || null : null,
  };
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

  async listSubtypes(domain?: LibraryDomain, opts?: { includeInactive?: boolean }) {
    let query = fromPending("library_subtypes")
      .select("*")
      .order("sort_order", { ascending: true });
    if (domain) query = query.eq("domain", domain);
    if (!opts?.includeInactive) query = query.eq("active", true);
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

  async upsertSubtype(input: {
    id?: string;
    domain: LibraryDomain;
    code: string;
    labelFr: string;
    sortOrder?: number;
    active?: boolean;
  }) {
    const code = input.code.trim().toLowerCase().replace(/\s+/g, "_");
    if (!code) throw new Error("Code sous-type requis.");
    const label = input.labelFr.trim();
    if (!label) throw new Error("Libellé sous-type requis.");
    const row = {
      domain: input.domain,
      code,
      label_fr: label,
      sort_order: input.sortOrder ?? 0,
      active: input.active ?? true,
    };
    if (input.id) {
      const { data, error } = await fromPending("library_subtypes")
        .update(row)
        .eq("id", input.id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await fromPending("library_subtypes")
      .upsert(row, { onConflict: "domain,code" })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async setSubtypeActive(id: string, active: boolean) {
    const { data, error } = await fromPending("library_subtypes")
      .update({ active })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async listClassTargets(libraryItemId: string): Promise<string[]> {
    const { data, error } = await fromPending("library_item_classes")
      .select("class_id")
      .eq("library_item_id", libraryItemId);
    if (error) throw error;
    return ((data ?? []) as Array<{ class_id: string }>).map((row) => row.class_id);
  },

  async listAttachments(libraryItemId: string): Promise<LibraryAttachmentRow[]> {
    const { data, error } = await fromPending("library_item_attachments")
      .select("*")
      .eq("library_item_id", libraryItemId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []) as LibraryAttachmentRow[];
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
    contentKind?: MediaKind;
    language?: string;
    visibility?: LibraryVisibility;
    storagePath: string;
    storageBucket?: string;
    mimeType?: string | null;
    fileSize?: number | null;
    externalUrl?: string | null;
    createdBy?: string | null;
    attachments?: LibraryAttachmentInput[];
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

    const visibility = input.visibility ?? "academy";
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
        visibility,
        storage_path: input.storagePath,
        storage_bucket: input.storageBucket ?? "library",
        mime_type: input.mimeType ?? null,
        file_size: input.fileSize ?? null,
        external_url: input.externalUrl ?? null,
        created_by: input.createdBy ?? null,
        published_at: visibility === "staff" || visibility === "private" ? null : new Date().toISOString(),
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
    if (input.attachments?.length) {
      await replaceAttachments(data.id, input.attachments);
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
    contentKind?: MediaKind;
    externalUrl?: string | null;
    createdBy?: string | null;
    visibility?: LibraryVisibility;
    attachments?: LibraryAttachmentInput[];
  }) {
    const attachments =
      input.attachments && input.attachments.length
        ? input.attachments
        : [
            {
              contentKind: input.contentKind ?? (input.externalUrl ? "link" : "document"),
              file: input.file ?? null,
              externalUrl: input.externalUrl ?? null,
            } satisfies LibraryAttachmentInput,
          ];

    // Upload files first so primary row can mirror first attachment.
    const prepared: LibraryAttachmentInput[] = [];
    for (const att of attachments) {
      if (att.file) {
        const uploaded = await uploadLibraryFile(att.file);
        prepared.push({
          ...att,
          file: null,
          existing: {
            id: "",
            library_item_id: "",
            sort_order: 0,
            content_kind: att.contentKind,
            storage_bucket: uploaded.storageBucket,
            storage_path: uploaded.storagePath,
            mime_type: uploaded.mimeType,
            file_size: uploaded.fileSize,
            external_url: null,
            text_body: att.textBody ?? null,
            label: att.label ?? null,
          },
        });
      } else {
        prepared.push(att);
      }
    }

    const primary = primaryFieldsFromAttachments(prepared);
    if (
      primary.contentKind !== "link" &&
      primary.contentKind !== "text" &&
      !prepared.some((a) => a.existing?.storage_path || a.file)
    ) {
      throw new Error("Fichier ou lien requis.");
    }
    if (primary.contentKind === "link" && !primary.externalUrl) {
      throw new Error("Lien requis.");
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
      contentKind: primary.contentKind,
      storagePath: primary.storagePath,
      storageBucket: primary.storageBucket,
      mimeType: primary.mimeType,
      fileSize: primary.fileSize,
      externalUrl: primary.externalUrl,
      visibility: input.visibility ?? "academy",
      createdBy: input.createdBy ?? null,
      attachments: prepared,
    });
  },

  async getSignedUrl(
    item: Pick<LibraryItem, "storage_bucket" | "storage_path" | "external_url"> & {
      external_url?: string | null;
    },
    expiresIn = 3600,
  ) {
    if (item.external_url) return item.external_url;
    if (!item.storage_bucket || !item.storage_path) {
      throw new Error("Aucun fichier associé.");
    }
    const { data, error } = await requireClient()
      .storage.from(item.storage_bucket)
      .createSignedUrl(item.storage_path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  async getAttachmentSignedUrl(att: LibraryAttachmentRow, expiresIn = 3600) {
    if (att.external_url) return att.external_url;
    if (!att.storage_bucket || !att.storage_path) {
      throw new Error("Aucun fichier associé.");
    }
    const { data, error } = await requireClient()
      .storage.from(att.storage_bucket)
      .createSignedUrl(att.storage_path, expiresIn);
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
      domain?: LibraryDomain;
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
      visibility?: LibraryVisibility;
      attachments?: LibraryAttachmentInput[];
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
      update.content_kind = patch.contentKind as MediaKind;
    }
    if (patch.visibility !== undefined) {
      update.visibility = patch.visibility;
      if (patch.visibility === "staff" || patch.visibility === "private") {
        update.published_at = null;
      } else if (!update.published_at) {
        update.published_at = new Date().toISOString();
      }
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

    if (patch.attachments) {
      const prepared: LibraryAttachmentInput[] = [];
      for (const att of patch.attachments) {
        if (att.file) {
          const uploaded = await uploadLibraryFile(att.file);
          prepared.push({
            ...att,
            file: null,
            existing: {
              id: att.existing?.id ?? "",
              library_item_id: id,
              sort_order: 0,
              content_kind: att.contentKind,
              storage_bucket: uploaded.storageBucket,
              storage_path: uploaded.storagePath,
              mime_type: uploaded.mimeType,
              file_size: uploaded.fileSize,
              external_url: null,
              text_body: att.textBody ?? null,
              label: att.label ?? null,
            },
          });
        } else {
          prepared.push(att);
        }
      }
      await replaceAttachments(id, prepared);
      const primary = prepared[0];
      if (primary?.existing?.storage_path || primary?.externalUrl || primary?.contentKind === "text") {
        await requireClient()
          .from("library_items")
          .update({
            content_kind: primary.contentKind,
            storage_bucket: primary.existing?.storage_bucket ?? "library",
            storage_path: primary.existing?.storage_path ?? `resources/external/${crypto.randomUUID()}`,
            mime_type: primary.existing?.mime_type ?? null,
            external_url: primary.externalUrl?.trim() || primary.existing?.external_url || null,
          })
          .eq("id", id);
      }
    }
    return data;
  },

  async replaceFile(id: string, file: File) {
    const uploaded = await uploadLibraryFile(file);
    return this.update(id, {
      storageBucket: uploaded.storageBucket,
      storagePath: uploaded.storagePath,
      mimeType: uploaded.mimeType,
      externalUrl: null,
      contentKind: file.type.startsWith("image/") ? "image" : "document",
    });
  },

  async uploadFileOnly(file: File) {
    const uploaded = await uploadLibraryFile(file);
    return {
      storageBucket: uploaded.storageBucket as "library",
      storagePath: uploaded.storagePath,
      mimeType: uploaded.mimeType,
    };
  },
};
