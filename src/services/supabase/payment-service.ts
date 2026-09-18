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
    profile: {
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
    profile:profiles!students_profile_id_fkey (
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
      })
      .select(PAYMENT_SELECT)
      .single();
    if (error) throw error;
    return data as PaymentListItem;
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
};
