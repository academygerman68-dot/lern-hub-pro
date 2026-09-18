import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { PaymentProof, PaymentProofStatus } from "@/types/phase3";

const PROOF_SELECT = `
  *,
  student:students (
    id,
    student_code,
    profile:profiles!students_profile_id_fkey (
      first_name,
      last_name,
      email
    )
  ),
  payment:student_payments (
    id,
    amount,
    currency,
    due_date,
    status,
    reference
  )
`;

export type PaymentProofListItem = PaymentProof & {
  student?: {
    id: string;
    student_code: string | null;
    profile: {
      first_name: string;
      last_name: string;
      email: string | null;
    } | null;
  } | null;
  payment?: {
    id: string;
    amount: number;
    currency: string;
    due_date: string | null;
    status: string;
    reference: string | null;
  } | null;
};

function requireClient(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase() as unknown as SupabaseClient;
}

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png"]);

export const SupabasePaymentProofService = {
  async list(filters?: { status?: PaymentProofStatus; studentId?: string }) {
    let query = requireClient()
      .from("payment_proofs")
      .select(PROOF_SELECT)
      .order("created_at", { ascending: false });

    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.studentId) query = query.eq("student_id", filters.studentId);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as PaymentProofListItem[];
  },

  async listMine(studentId: string) {
    return this.list({ studentId });
  },

  async listPending() {
    const { data, error } = await requireClient()
      .from("payment_proofs")
      .select(PROOF_SELECT)
      .in("status", ["pending", "not_approved"])
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PaymentProofListItem[];
  },

  async uploadAndSubmit(input: {
    studentId: string;
    file: File;
    paymentId: string;
    declaredAmount: number;
    operationDate: string;
    operationReference?: string | null;
    studentNote?: string | null;
    paymentMethod?: string | null;
  }) {
    if (!ALLOWED_MIME.has(input.file.type)) {
      throw new Error("Type de fichier non autorisé (PDF, JPEG ou PNG uniquement).");
    }
    if (input.file.size > MAX_PROOF_BYTES) {
      throw new Error("Fichier trop volumineux (max 10 Mo).");
    }
    if (!Number.isFinite(input.declaredAmount) || input.declaredAmount <= 0) {
      throw new Error("Le montant déclaré doit être supérieur à zéro.");
    }
    if (!input.operationDate) throw new Error("La date de l’opération est obligatoire.");

    const supabase = requireClient();
    const ext = input.file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `students/${input.studentId}/payment-proofs/${crypto.randomUUID()}.${ext}`;
    const submittedAt = new Date();
    const deadline = new Date(submittedAt.getTime() + 48 * 60 * 60 * 1000);

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(path, input.file, {
        upsert: false,
        contentType: input.file.type,
      });
    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from("payment_proofs")
      .insert({
        student_id: input.studentId,
        payment_id: input.paymentId,
        storage_bucket: "documents",
        storage_path: path,
        mime_type: input.file.type,
        file_size: input.file.size,
        declared_amount: input.declaredAmount,
        operation_date: input.operationDate,
        operation_reference: input.operationReference?.trim() || null,
        payment_method: input.paymentMethod?.trim() || null,
        status: "pending",
        student_note: input.studentNote ?? null,
        submitted_at: submittedAt.toISOString(),
        validation_deadline: deadline.toISOString(),
      })
      .select(PROOF_SELECT)
      .single();
    if (error) {
      await supabase.storage.from("documents").remove([path]);
      throw error;
    }
    return data as PaymentProofListItem;
  },

  async expireStale() {
    const { data, error } = await requireClient().rpc("expire_stale_payment_proofs");
    if (error) throw error;
    return Number(data ?? 0);
  },

  async uploadAdminReceipt(proofId: string, file: File) {
    if (!ALLOWED_MIME.has(file.type)) {
      throw new Error("Type de fichier non autorisé (PDF, JPEG ou PNG uniquement).");
    }
    if (file.size > MAX_PROOF_BYTES) {
      throw new Error("Fichier trop volumineux (max 10 Mo).");
    }
    const supabase = requireClient();
    const existing = await this.getById(proofId);
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `admin/payment-receipts/${proofId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(path, file, {
      upsert: false,
      contentType: file.type,
    });
    if (uploadError) throw uploadError;
    const { data, error } = await supabase
      .from("payment_proofs")
      .update({
        admin_receipt_bucket: "documents",
        admin_receipt_path: path,
        admin_receipt_mime: file.type,
        updated_at: new Date().toISOString(),
      })
      .eq("id", proofId)
      .select(PROOF_SELECT)
      .single();
    if (error) {
      await supabase.storage.from("documents").remove([path]);
      throw error;
    }
    if (existing?.admin_receipt_path && existing.admin_receipt_bucket) {
      await supabase.storage
        .from(existing.admin_receipt_bucket)
        .remove([existing.admin_receipt_path])
        .catch(() => undefined);
    }
    return data as PaymentProofListItem;
  },

  async getById(proofId: string) {
    const { data, error } = await requireClient()
      .from("payment_proofs")
      .select(PROOF_SELECT)
      .eq("id", proofId)
      .maybeSingle();
    if (error) throw error;
    return data as PaymentProofListItem | null;
  },

  async deleteAdminReceipt(proofId: string) {
    const supabase = requireClient();
    const existing = await this.getById(proofId);
    if (!existing?.admin_receipt_path) return existing;
    const { data, error } = await supabase
      .from("payment_proofs")
      .update({
        admin_receipt_bucket: null,
        admin_receipt_path: null,
        admin_receipt_mime: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", proofId)
      .select(PROOF_SELECT)
      .single();
    if (error) throw error;
    if (existing.admin_receipt_bucket) {
      await supabase.storage
        .from(existing.admin_receipt_bucket)
        .remove([existing.admin_receipt_path])
        .catch(() => undefined);
    }
    return data as PaymentProofListItem;
  },

  async getSignedUrl(
    proof: Pick<PaymentProof, "storage_bucket" | "storage_path">,
    expiresIn = 300,
  ) {
    const { data, error } = await requireClient()
      .storage.from(proof.storage_bucket)
      .createSignedUrl(proof.storage_path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  async getAdminReceiptSignedUrl(
    proof: Pick<PaymentProof, "admin_receipt_bucket" | "admin_receipt_path">,
    expiresIn = 300,
  ) {
    if (!proof.admin_receipt_bucket || !proof.admin_receipt_path) {
      throw new Error("Aucun reçu administratif.");
    }
    const { data, error } = await requireClient()
      .storage.from(proof.admin_receipt_bucket)
      .createSignedUrl(proof.admin_receipt_path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  async review(proofId: string, approve: boolean, adminNote?: string | null) {
    const { data, error } = await requireClient().rpc("review_payment_proof", {
      p_proof_id: proofId,
      p_approve: approve,
      p_admin_note: adminNote ?? null,
    });
    if (error) throw error;
    return data as PaymentProof;
  },
};
