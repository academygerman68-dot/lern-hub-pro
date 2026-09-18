import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Payment = Database["public"]["Tables"]["student_payments"]["Row"];
type PaymentStatus = Database["public"]["Enums"]["payment_status"];
type DiscountType = "percent" | "fixed" | null;
type Subscription = Database["public"]["Tables"]["student_subscriptions"]["Row"];

export function computeFinalAmount(
  initialAmount: number,
  discountType?: DiscountType,
  discountValue = 0,
): number {
  if (!discountType || discountValue <= 0) return initialAmount;
  if (discountType === "percent") {
    return Math.max(0, initialAmount * (1 - discountValue / 100));
  }
  return Math.max(0, initialAmount - discountValue);
}

function resolvePaymentStatus(
  finalAmount: number,
  amountPaid: number,
  explicit?: PaymentStatus,
): PaymentStatus {
  if (explicit) return explicit;
  if (amountPaid >= finalAmount && finalAmount > 0) return "paid";
  if (amountPaid > 0) return "partial";
  return "pending";
}

export type PaymentListItem = Payment & {
  student?: {
    id: string;
    student_code: string | null;
    profile_id?: string | null;
    profile: {
      id?: string;
      first_name: string;
      last_name: string;
      email: string | null;
    } | null;
  } | null;
};

function requireClient() {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase();
}

const PAYMENT_SELECT = `
  *,
  student:students (
    id,
    student_code,
    profile_id,
    profile:profiles!students_profile_id_fkey (
      id,
      first_name,
      last_name,
      email
    )
  )
`;

export const SupabasePaymentService = {
  async list(filters?: { status?: PaymentStatus; studentId?: string; search?: string }) {
    let query = requireClient()
      .from("student_payments")
      .select(PAYMENT_SELECT)
      .order("created_at", { ascending: false });

    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.studentId) query = query.eq("student_id", filters.studentId);

    const { data, error } = await query;
    if (error) throw error;

    let rows = (data ?? []) as PaymentListItem[];
    const search = filters?.search?.trim().toLowerCase();
    if (search) {
      rows = rows.filter((row) => {
        const name =
          `${row.student?.profile?.first_name ?? ""} ${row.student?.profile?.last_name ?? ""}`.toLowerCase();
        const email = row.student?.profile?.email?.toLowerCase() ?? "";
        const ref = row.reference?.toLowerCase() ?? "";
        return name.includes(search) || email.includes(search) || ref.includes(search);
      });
    }
    return rows;
  },

  async listForStudent(studentId: string) {
    return this.list({ studentId });
  },

  async get(id: string) {
    const { data, error } = await requireClient()
      .from("student_payments")
      .select(PAYMENT_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as PaymentListItem | null;
  },

  async create(input: {
    studentId: string;
    amount?: number;
    initialAmount?: number;
    discountType?: DiscountType;
    discountValue?: number;
    amountPaid?: number;
    currency?: string;
    dueDate?: string | null;
    paymentMethod?: string | null;
    reference?: string | null;
    notes?: string | null;
    status?: PaymentStatus;
    createdBy?: string | null;
    adminReceiptBucket?: string | null;
    adminReceiptPath?: string | null;
    adminReceiptMime?: string | null;
  }) {
    const initialAmount = input.initialAmount ?? input.amount ?? 0;
    const discountType = input.discountType ?? null;
    const discountValue = input.discountValue ?? 0;
    const finalAmount =
      input.amount ?? computeFinalAmount(initialAmount, discountType, discountValue);
    const amountPaid = input.amountPaid ?? 0;
    const status = resolvePaymentStatus(finalAmount, amountPaid, input.status);

    const { data, error } = await requireClient()
      .from("student_payments")
      .insert({
        student_id: input.studentId,
        initial_amount: initialAmount,
        discount_type: discountType,
        discount_value: discountValue,
        amount: finalAmount,
        amount_paid: amountPaid,
        currency: input.currency ?? "MAD",
        due_date: input.dueDate ?? null,
        payment_method: input.paymentMethod ?? null,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        status,
        created_by: input.createdBy ?? null,
        admin_receipt_bucket: input.adminReceiptBucket ?? null,
        admin_receipt_path: input.adminReceiptPath ?? null,
        admin_receipt_mime: input.adminReceiptMime ?? null,
      })
      .select(PAYMENT_SELECT)
      .single();
    if (error) throw error;
    return data as PaymentListItem;
  },

  async uploadAdminReceipt(paymentId: string, file: File) {
    const allowed = new Set(["application/pdf", "image/jpeg", "image/png"]);
    if (!allowed.has(file.type)) {
      throw new Error("Type de fichier non autorisé (PDF, JPEG ou PNG).");
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Fichier trop volumineux (max 10 Mo).");
    }
    const supabase = requireClient();
    const existing = await this.get(paymentId);
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `admin/payment-receipts/payments/${paymentId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(path, file, {
      upsert: false,
      contentType: file.type,
    });
    if (uploadError) throw uploadError;
    const { data, error } = await supabase
      .from("student_payments")
      .update({
        admin_receipt_bucket: "documents",
        admin_receipt_path: path,
        admin_receipt_mime: file.type,
      })
      .eq("id", paymentId)
      .select(PAYMENT_SELECT)
      .single();
    if (error) {
      await supabase.storage.from("documents").remove([path]);
      throw error;
    }
    if (existing && "admin_receipt_path" in existing && existing.admin_receipt_path) {
      const bucket =
        (existing as { admin_receipt_bucket?: string | null }).admin_receipt_bucket ?? "documents";
      await supabase.storage
        .from(bucket)
        .remove([existing.admin_receipt_path as string])
        .catch(() => undefined);
    }
    return data as PaymentListItem;
  },

  async deleteAdminReceipt(paymentId: string) {
    const existing = await this.get(paymentId);
    const path = (existing as { admin_receipt_path?: string | null } | null)?.admin_receipt_path;
    const bucket =
      (existing as { admin_receipt_bucket?: string | null } | null)?.admin_receipt_bucket ??
      "documents";
    const { data, error } = await requireClient()
      .from("student_payments")
      .update({
        admin_receipt_bucket: null,
        admin_receipt_path: null,
        admin_receipt_mime: null,
      })
      .eq("id", paymentId)
      .select(PAYMENT_SELECT)
      .single();
    if (error) throw error;
    if (path) {
      await requireClient()
        .storage.from(bucket)
        .remove([path])
        .catch(() => undefined);
    }
    return data as PaymentListItem;
  },

  async getAdminReceiptSignedUrl(
    payment: { admin_receipt_bucket?: string | null; admin_receipt_path?: string | null },
    expiresIn = 300,
  ) {
    if (!payment.admin_receipt_bucket || !payment.admin_receipt_path) {
      throw new Error("Aucun reçu administratif.");
    }
    const { data, error } = await requireClient()
      .storage.from(payment.admin_receipt_bucket)
      .createSignedUrl(payment.admin_receipt_path, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  },

  async markPaid(paymentId: string) {
    const { data, error } = await requireClient().rpc("mark_student_payment_paid", {
      p_payment_id: paymentId,
    });
    if (error) throw error;
    return data as Payment;
  },

  async markOverdue(paymentId: string) {
    const { data, error } = await requireClient().rpc("mark_student_payment_overdue", {
      p_payment_id: paymentId,
    });
    if (error) throw error;
    return data as Payment;
  },

  /** Send an in-app payment reminder to the student. */
  async remindStudent(paymentId: string) {
    const payment = await this.get(paymentId);
    if (!payment) throw new Error("Paiement introuvable.");
    if (payment.status === "paid" || payment.status === "cancelled") {
      throw new Error("Impossible de relancer un paiement déjà réglé ou annulé.");
    }

    const recipientId = payment.student?.profile?.id ?? payment.student?.profile_id ?? null;
    if (!recipientId) throw new Error("Profil étudiant introuvable pour la relance.");

    const remaining = Math.max(0, Number(payment.amount) - Number(payment.amount_paid ?? 0));
    const due = payment.due_date
      ? new Date(payment.due_date).toLocaleDateString("fr-FR")
      : "à convenir";
    const amountLabel = `${remaining.toLocaleString("fr-FR")} ${payment.currency}`;

    const { data, error } = await requireClient().rpc("create_in_app_notification", {
      p_recipient_id: recipientId,
      p_title: "Relance de paiement",
      p_message: `Merci de régulariser votre paiement. Reste dû : ${amountLabel}. Échéance : ${due}. Vous pouvez déposer un justificatif dans Paiements.`,
      p_category: "payment",
      p_link_page: "payments",
      p_link_id: payment.id,
    });
    if (error) throw error;

    const stamp = new Date().toLocaleString("fr-FR");
    const noteLine = `Relance envoyée le ${stamp}`;
    const nextNotes = payment.notes?.includes("Relance envoyée")
      ? payment.notes.replace(/Relance envoyée le[^\n]*/i, noteLine)
      : [payment.notes, noteLine].filter(Boolean).join("\n");

    await requireClient().from("student_payments").update({ notes: nextNotes }).eq("id", paymentId);

    return data;
  },

  async cancel(paymentId: string) {
    const { data, error } = await requireClient()
      .from("student_payments")
      .update({ status: "cancelled" })
      .eq("id", paymentId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },
};

export const SupabaseSubscriptionService = {
  async list(): Promise<
    Array<
      Subscription & {
        student?: {
          id: string;
          profile: { first_name: string; last_name: string; email: string | null } | null;
        } | null;
      }
    >
  > {
    const { data, error } = await requireClient()
      .from("student_subscriptions")
      .select(
        `
        *,
        student:students (
          id,
          profile:profiles!students_profile_id_fkey (
            first_name,
            last_name,
            email
          )
        )
      `,
      )
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async getByStudent(studentId: string) {
    const { data, error } = await requireClient()
      .from("student_subscriptions")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async ensure(studentId: string) {
    const { data, error } = await requireClient().rpc("ensure_student_subscription", {
      p_student_id: studentId,
    });
    if (error) throw error;
    return data as Subscription;
  },

  async setStatus(
    studentId: string,
    status: Database["public"]["Enums"]["subscription_status"],
    extras?: { expiresAt?: string | null; notes?: string | null },
  ) {
    await this.ensure(studentId);
    const patch: Database["public"]["Tables"]["student_subscriptions"]["Update"] = {
      status,
      manually_extended: status === "manually_extended",
    };
    if (extras?.expiresAt !== undefined) patch.expires_at = extras.expiresAt;
    if (extras?.notes !== undefined) patch.notes = extras.notes;
    const { data, error } = await requireClient()
      .from("student_subscriptions")
      .update(patch)
      .eq("student_id", studentId)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },
};

export const SupabaseAccessService = {
  /** Central access check for the current authenticated user (admins/teachers always true). */
  async hasActiveAcademicAccess(userId?: string): Promise<boolean> {
    const args = userId ? { p_user_id: userId } : {};
    const { data, error } = await requireClient().rpc("has_active_academic_access", args);
    if (error) throw error;
    return Boolean(data);
  },

  /** Student-id based check used by staff tooling. */
  async hasAcademicAccess(studentId: string): Promise<boolean> {
    const { data, error } = await requireClient().rpc("has_academic_access", {
      p_student_id: studentId,
    });
    if (error) throw error;
    return Boolean(data);
  },

  /** Records first login and starts the free first-month window for approved students. */
  async recordFirstLogin(): Promise<string | null> {
    const { data, error } = await requireClient().rpc("record_student_first_login");
    if (error) throw error;
    return (data as string | null) ?? null;
  },
};
