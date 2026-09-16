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
    return this.list({ status: "pending" });
  },

  async uploadAndSubmit(input: {
    studentId: string;
    file: File;
    paymentId?: string | null;
    studentNote?: string | null;
  }) {
    if (!ALLOWED_MIME.has(input.file.type)) {
      throw new Error("Type de fichier non autorisé (PDF, JPEG ou PNG uniquement).");
    }
    if (input.file.size > MAX_PROOF_BYTES) {
      throw new Error("Fichier trop volumineux (max 10 Mo).");
    }

    const supabase = requireClient();
    const ext = input.file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `students/${input.studentId}/payment-proofs/${crypto.randomUUID()}.${ext}`;

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
        payment_id: input.paymentId ?? null,
        storage_bucket: "documents",
        storage_path: path,
        mime_type: input.file.type,
        file_size: input.file.size,
        status: "pending",
        student_note: input.studentNote ?? null,
      })
      .select(PROOF_SELECT)
      .single();
    if (error) throw error;
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
