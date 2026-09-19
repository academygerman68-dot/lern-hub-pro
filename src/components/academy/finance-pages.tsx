import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useAcademicAccess,
  useCreatePayment,
  useDeleteAdminReceipt,
  useDeletePaymentAdminReceipt,
  useMarkPaymentOverdue,
  usePaymentProofs,
  usePayments,
  usePendingPaymentProofs,
  useRemindPayment,
  useReviewPaymentProof,
  useStudents,
  useSubmitPaymentProof,
  useSubscriptions,
  useUploadAdminReceipt,
  useUploadPaymentAdminReceipt,
} from "@/hooks/use-academy-data";
import { PaymentProofService, PaymentService } from "@/services/academy-services";
import type { PaymentProofListItem } from "@/services/supabase/payment-proof-service";
import { computeFinalAmount } from "@/services/supabase/payment-service";
import {
  PAYMENT_PROOF_ACCEPT,
  resolveOwnStudent,
  toPaymentProofUserError,
  validatePaymentProofFile,
  validatePaymentProofSubmitInput,
} from "@/lib/payment-proof";
import {
  type BillingCurrency,
  type BillingPlan,
  billingPeriodLabel,
  billingPlanLabel,
  formatMoneyAmount,
  listBillingPeriods,
  planAmount,
} from "@/lib/subscription-plans";
import type { Database } from "@/types/database";
import { useAcademy } from "./academy-context";
import { ContentAttachmentUploader, type AttachmentDraft } from "./content-attachment-uploader";
import { DocumentViewer } from "./document-viewer";
import { QueryState } from "./query-state";
import { Metric, PageHeader, Status, Surface, FormSection, FileDropzoneVisual } from "./primitives";

type DocPreview = {
  title: string;
  url: string | null;
  mimeType: string | null;
  loading: boolean;
  error: string | null;
};

type PaymentStatus = Database["public"]["Enums"]["payment_status"];
type PaymentRow = NonNullable<ReturnType<typeof usePayments>["data"]>[number];

function studentLabel(row: {
  student?: {
    profile?: { first_name?: string; last_name?: string; email?: string | null } | null;
  } | null;
}) {
  const p = row.student?.profile;
  if (!p) return "—";
  const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  return name || p.email || "—";
}

function paymentTone(status: string): "green" | "amber" | "red" {
  if (status === "paid" || status === "approved") return "green";
  if (status === "pending" || status === "partial") return "amber";
  return "red";
}

export function paymentMethodLabel(method: string | null | undefined) {
  if (method === "cash") return "Espèces";
  if (method === "bank_transfer") return "Virement bancaire";
  if (method === "card") return "Carte";
  if (method === "mobile_money") return "Espèces mobile";
  return method ?? "—";
}

export function paymentStatusLabel(status: string) {
  if (status === "pending") return "En attente";
  if (status === "paid" || status === "approved") return "Confirmé";
  if (status === "partial") return "Partiel";
  if (status === "overdue") return "En retard";
  if (status === "cancelled") return "Annulé";
  if (status === "suspended") return "Suspendu";
  if (status === "rejected") return "Refusé";
  return status;
}

function proofStatusLabel(status: string) {
  if (status === "pending") return "En attente de validation";
  if (status === "approved") return "Approuvé";
  if (status === "rejected") return "Refusé";
  if (status === "not_approved") return "Non approuvé (délai dépassé)";
  return paymentStatusLabel(status);
}

function formatDiscount(row: PaymentRow) {
  if (!row.discount_type || Number(row.discount_value) <= 0) return "—";
  if (row.discount_type === "percent") return `${Number(row.discount_value)} %`;
  return formatMoneyAmount(Number(row.discount_value), row.currency || "MAD");
}

function paymentBillingSummary(row: {
  billing_plan?: string | null;
  billing_period?: string | null;
  currency?: string | null;
  amount?: number | null;
  amount_paid?: number | null;
  due_date?: string | null;
}) {
  const plan = billingPlanLabel(row.billing_plan);
  const period = billingPeriodLabel(row.billing_period, row.billing_plan);
  const currency = row.currency || "MAD";
  const expected = formatMoneyAmount(Number(row.amount ?? 0), currency);
  const paid = formatMoneyAmount(Number(row.amount_paid ?? 0), currency);
  return { plan, period, currency, expected, paid };
}

function paymentInitial(row: PaymentRow) {
  return Number(row.initial_amount ?? row.amount);
}

function paymentRemaining(row: PaymentRow) {
  return Math.max(0, Number(row.amount) - Number(row.amount_paid ?? 0));
}

function canRemindPayment(status: string) {
  return (
    status === "pending" || status === "partial" || status === "overdue" || status === "suspended"
  );
}

async function forceDownloadUrl(url: string, filename: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("download_failed");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename || "document";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function AdminReceiptActions({
  proof,
  onChanged,
  onPreview,
}: {
  proof: PaymentProofListItem;
  onChanged: () => void;
  onPreview: (preview: DocPreview) => void;
}) {
  const uploadReceipt = useUploadAdminReceipt();
  const deleteReceipt = useDeleteAdminReceipt();
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = uploadReceipt.isPending || deleteReceipt.isPending;
  const hasReceipt = Boolean(proof.admin_receipt_path);

  const openReceipt = async () => {
    onPreview({
      title: `Reçu admin · ${studentLabel(proof)}`,
      url: null,
      mimeType: proof.admin_receipt_mime ?? null,
      loading: true,
      error: null,
    });
    try {
      const url = await PaymentProofService.getAdminReceiptSignedUrl(proof);
      onPreview({
        title: `Reçu admin · ${studentLabel(proof)}`,
        url,
        mimeType: proof.admin_receipt_mime ?? null,
        loading: false,
        error: null,
      });
    } catch (err) {
      onPreview({
        title: `Reçu admin · ${studentLabel(proof)}`,
        url: null,
        mimeType: proof.admin_receipt_mime ?? null,
        loading: false,
        error: err instanceof Error ? err.message : "Aperçu impossible",
      });
    }
  };

  const downloadReceipt = async () => {
    try {
      const url = await PaymentProofService.getAdminReceiptSignedUrl(proof);
      await forceDownloadUrl(url, `recu-${proof.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Téléchargement impossible");
    }
  };

  const onFile = (file: File | null) => {
    if (!file) return;
    uploadReceipt.mutate(
      { proofId: proof.id, file },
      {
        onSuccess: () => {
          toast.success(hasReceipt ? "Reçu remplacé" : "Reçu téléversé");
          onChanged();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="application/pdf,image/jpeg,image/png"
        onChange={(e) => {
          onFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <span className="text-xs text-muted-foreground">Reçu admin :</span>
      {hasReceipt ? (
        <>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void openReceipt()}>
            Voir
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void downloadReceipt()}
          >
            Télécharger
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            Remplacer
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (!window.confirm("Supprimer le reçu administratif ?")) return;
              deleteReceipt.mutate(proof.id, {
                onSuccess: () => {
                  toast.success("Reçu supprimé");
                  onChanged();
                },
                onError: (err) => toast.error(err.message),
              });
            }}
          >
            Supprimer
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          Joindre un reçu
        </Button>
      )}
    </div>
  );
}

function ProofReviewQueue() {
  const pendingQuery = usePendingPaymentProofs();
  const allProofsQuery = usePaymentProofs();
  const review = useReviewPaymentProof();
  const [preview, setPreview] = useState<DocPreview | null>(null);

  const recentlyReviewed = useMemo(() => {
    return (allProofsQuery.data ?? [])
      .filter((p) => p.status === "approved" || p.status === "rejected")
      .slice(0, 15);
  }, [allProofsQuery.data]);

  const refetchProofs = () => {
    void pendingQuery.refetch();
    void allProofsQuery.refetch();
  };

  const openStudentProof = (proof: PaymentProofListItem) => {
    void (async () => {
      setPreview({
        title: `Justificatif · ${studentLabel(proof)}`,
        url: null,
        mimeType: proof.mime_type ?? null,
        loading: true,
        error: null,
      });
      try {
        const url = await PaymentProofService.getSignedUrl(proof);
        setPreview({
          title: `Justificatif · ${studentLabel(proof)}`,
          url,
          mimeType: proof.mime_type ?? null,
          loading: false,
          error: null,
        });
      } catch (err) {
        setPreview({
          title: `Justificatif · ${studentLabel(proof)}`,
          url: null,
          mimeType: proof.mime_type ?? null,
          loading: false,
          error: err instanceof Error ? err.message : "Aperçu impossible",
        });
      }
    })();
  };

  return (
    <>
      <Surface className="mb-6 p-5">
        <h2 className="font-semibold">File des justificatifs</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Avis d’opération à vérifier sous 48 heures. Au-delà, le statut passe à « non approuvé ».
        </p>
        <QueryState
          isLoading={pendingQuery.isLoading}
          isError={pendingQuery.isError}
          error={pendingQuery.error}
          isEmpty={!pendingQuery.data?.length}
          emptyTitle="Aucun justificatif en attente"
          emptyMessage="Les dépôts étudiants apparaîtront ici."
          onRetry={() => void pendingQuery.refetch()}
        >
          <div className="mt-4 divide-y">
            {pendingQuery.data?.map((proof) => (
              <div key={proof.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{studentLabel(proof)}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(proof.created_at).toLocaleString("fr-FR")}
                      {proof.student_note ? ` · ${proof.student_note}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Déclaré :{" "}
                      {formatMoneyAmount(
                        Number(proof.declared_amount),
                        proof.payment?.currency ?? "MAD",
                      )}
                      {proof.payment
                        ? ` · attendu : ${formatMoneyAmount(Number(proof.payment.amount), proof.payment.currency)}`
                        : ""}
                      {proof.payment?.billing_plan
                        ? ` · ${billingPlanLabel(proof.payment.billing_plan)}`
                        : ""}
                      {proof.payment?.billing_period
                        ? ` · ${billingPeriodLabel(proof.payment.billing_period, proof.payment.billing_plan)}`
                        : ""}
                      {` · opération du ${proof.operation_date}`}
                      {proof.operation_reference ? ` · RIB ${proof.operation_reference}` : ""}
                    </p>
                    <Status tone="amber">{proofStatusLabel(proof.status)}</Status>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openStudentProof(proof)}>
                      Voir
                    </Button>
                    <Button
                      size="sm"
                      disabled={review.isPending}
                      onClick={() => {
                        if (
                          !window.confirm(
                            "Confirmer ce justificatif et activer l’accès de l’étudiant ?",
                          )
                        )
                          return;
                        review.mutate(
                          { proofId: proof.id, approve: true },
                          {
                            onSuccess: () => {
                              toast.success("Justificatif confirmé · accès rétabli");
                              refetchProofs();
                            },
                            onError: (err) => toast.error(err.message),
                          },
                        );
                      }}
                    >
                      Confirmer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={review.isPending}
                      onClick={() => {
                        const note = window.prompt("Motif du refus (obligatoire)");
                        if (note === null) return;
                        if (!note.trim()) {
                          toast.error("Le motif du refus est obligatoire.");
                          return;
                        }
                        review.mutate(
                          {
                            proofId: proof.id,
                            approve: false,
                            adminNote: note.trim(),
                          },
                          {
                            onSuccess: () => {
                              toast.message("Justificatif refusé");
                              refetchProofs();
                            },
                            onError: (err) => toast.error(err.message),
                          },
                        );
                      }}
                    >
                      Refuser
                    </Button>
                  </div>
                </div>
                <AdminReceiptActions
                  proof={proof}
                  onChanged={refetchProofs}
                  onPreview={setPreview}
                />
              </div>
            ))}
          </div>
        </QueryState>
      </Surface>

      {(recentlyReviewed.length > 0 || allProofsQuery.isLoading) && (
        <Surface className="mb-6 p-5">
          <h2 className="font-semibold">Récemment traités</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Justificatifs approuvés ou refusés — joignez ou gérez le reçu administratif.
          </p>
          <div className="mt-4 divide-y">
            {recentlyReviewed.map((proof) => (
              <div key={proof.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{studentLabel(proof)}</p>
                    <p className="text-sm text-muted-foreground">
                      {proof.reviewed_at
                        ? new Date(proof.reviewed_at).toLocaleString("fr-FR")
                        : new Date(proof.created_at).toLocaleString("fr-FR")}
                      {` · ${formatMoneyAmount(Number(proof.declared_amount), proof.payment?.currency ?? "MAD")}`}
                      {proof.payment?.billing_plan
                        ? ` · ${billingPlanLabel(proof.payment.billing_plan)}`
                        : ""}
                    </p>
                    <Status tone={proof.status === "approved" ? "green" : "red"}>
                      {proofStatusLabel(proof.status)}
                    </Status>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => openStudentProof(proof)}>
                    Voir justificatif
                  </Button>
                </div>
                <AdminReceiptActions
                  proof={proof}
                  onChanged={refetchProofs}
                  onPreview={setPreview}
                />
              </div>
            ))}
          </div>
        </Surface>
      )}

      <DocumentViewer
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.title ?? ""}
        url={preview?.url ?? null}
        mimeType={preview?.mimeType}
        loading={preview?.loading}
        error={preview?.error}
      />
    </>
  );
}

export function FinancePages({ mode }: { mode: string }) {
  const paymentsQuery = usePayments();
  const subscriptionsQuery = useSubscriptions();
  const studentsQuery = useStudents();
  const createPayment = useCreatePayment();
  const markOverdue = useMarkPaymentOverdue();
  const remindPayment = useRemindPayment();
  const uploadPaymentReceipt = useUploadPaymentAdminReceipt();
  const deletePaymentReceipt = useDeletePaymentAdminReceipt();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [billingPlan, setBillingPlan] = useState<BillingPlan>("monthly");
  const [currency, setCurrency] = useState<BillingCurrency>("MAD");
  const [billingPeriod, setBillingPeriod] = useState(
    () => listBillingPeriods("monthly", 1)[0] ?? "",
  );
  const [initialAmount, setInitialAmount] = useState(String(planAmount("monthly", "MAD")));
  const [discountMode, setDiscountMode] = useState<"none" | "percent" | "fixed">("none");
  const [discountValue, setDiscountValue] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("pending");
  const [dueDate, setDueDate] = useState("");
  const [receiptAttachment, setReceiptAttachment] = useState<AttachmentDraft>({
    kind: "pdf",
    url: "",
    file: null,
  });
  const [replaceReceiptId, setReplaceReceiptId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocPreview | null>(null);
  const replaceFileRef = useRef<HTMLInputElement>(null);

  const applyPlanDefaults = (plan: BillingPlan, nextCurrency: BillingCurrency) => {
    setBillingPlan(plan);
    setCurrency(nextCurrency);
    setInitialAmount(String(planAmount(plan, nextCurrency)));
    const periods = listBillingPeriods(plan, 6);
    setBillingPeriod((prev) => (periods.includes(prev) ? prev : (periods[0] ?? "")));
  };

  const sendReminder = (row: PaymentRow) => {
    remindPayment.mutate(row.id, {
      onSuccess: () => toast.success(`Relance envoyée à ${studentLabel(row)}`),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Relance impossible"),
    });
  };

  const openPaymentReceipt = async (row: PaymentRow) => {
    setPreview({
      title: `Reçu · ${studentLabel(row)}`,
      url: null,
      mimeType: row.admin_receipt_mime ?? null,
      loading: true,
      error: null,
    });
    try {
      const url = await PaymentService.getAdminReceiptSignedUrl(row);
      setPreview({
        title: `Reçu · ${studentLabel(row)}`,
        url,
        mimeType: row.admin_receipt_mime ?? null,
        loading: false,
        error: null,
      });
    } catch (err) {
      setPreview({
        title: `Reçu · ${studentLabel(row)}`,
        url: null,
        mimeType: row.admin_receipt_mime ?? null,
        loading: false,
        error: err instanceof Error ? err.message : "Aperçu impossible",
      });
    }
  };

  const downloadPaymentReceipt = async (row: PaymentRow) => {
    try {
      const url = await PaymentService.getAdminReceiptSignedUrl(row);
      await forceDownloadUrl(url, `recu-paiement-${row.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Téléchargement impossible");
    }
  };

  const receiptActions = (row: PaymentRow) => {
    if (!row.admin_receipt_path) {
      return (
        <Button
          size="sm"
          variant="outline"
          disabled={uploadPaymentReceipt.isPending}
          onClick={() => {
            setReplaceReceiptId(row.id);
            replaceFileRef.current?.click();
          }}
        >
          Ajouter reçu
        </Button>
      );
    }
    return (
      <>
        <Button size="sm" variant="secondary" onClick={() => void openPaymentReceipt(row)}>
          Voir
        </Button>
        <Button size="sm" variant="outline" onClick={() => void downloadPaymentReceipt(row)}>
          Télécharger
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={uploadPaymentReceipt.isPending}
          onClick={() => {
            setReplaceReceiptId(row.id);
            replaceFileRef.current?.click();
          }}
        >
          Remplacer
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={deletePaymentReceipt.isPending}
          onClick={() => {
            if (!window.confirm("Supprimer le reçu administratif ?")) return;
            deletePaymentReceipt.mutate(row.id, {
              onSuccess: () => toast.success("Reçu supprimé"),
              onError: (err) => toast.error(err.message),
            });
          }}
        >
          Supprimer reçu
        </Button>
      </>
    );
  };

  const computedFinal = useMemo(() => {
    const initial = Number(initialAmount) || 0;
    const discount = Number(discountValue) || 0;
    const type = discountMode === "none" ? null : discountMode;
    return computeFinalAmount(initial, type, discount);
  }, [initialAmount, discountMode, discountValue]);

  const filtered = useMemo(() => {
    let rows = paymentsQuery.data ?? [];
    if (statusFilter !== "all") rows = rows.filter((r) => r.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => {
        const name = studentLabel(r).toLowerCase();
        return name.includes(q) || (r.reference ?? "").toLowerCase().includes(q);
      });
    }
    return rows;
  }, [paymentsQuery.data, search, statusFilter]);

  const stats = useMemo(() => {
    const rows = paymentsQuery.data ?? [];
    const byCurrency = new Map<string, { expected: number; collected: number; paid: number }>();
    for (const r of rows) {
      const code = (r.currency || "MAD").toUpperCase();
      const bucket = byCurrency.get(code) ?? { expected: 0, collected: 0, paid: 0 };
      bucket.expected += Number(r.amount);
      bucket.collected += Number(r.amount_paid ?? 0);
      if (r.status === "paid") bucket.paid += Number(r.amount_paid ?? r.amount);
      byCurrency.set(code, bucket);
    }
    const formatBuckets = (key: "expected" | "collected" | "paid") => {
      const parts = [...byCurrency.entries()].map(([code, bucket]) =>
        formatMoneyAmount(bucket[key], code),
      );
      return parts.length ? parts.join(" · ") : "—";
    };
    return {
      paidLabel: formatBuckets("paid"),
      expectedVsCollected: `${formatBuckets("expected")} / ${formatBuckets("collected")}`,
      overdue: rows.filter((r) => r.status === "overdue").length,
      partial: rows.filter((r) => r.status === "partial").length,
    };
  }, [paymentsQuery.data]);

  const resetCreateForm = () => {
    setStudentId("");
    setBillingPlan("monthly");
    setCurrency("MAD");
    setBillingPeriod(listBillingPeriods("monthly", 1)[0] ?? "");
    setInitialAmount(String(planAmount("monthly", "MAD")));
    setDiscountMode("none");
    setDiscountValue("");
    setAmountPaid("");
    setPaymentMethod("cash");
    setReference("");
    setNote("");
    setPaymentStatus("pending");
    setDueDate("");
    setReceiptAttachment({ kind: "pdf", url: "", file: null });
  };

  if (mode === "subscriptions") {
    return (
      <>
        <PageHeader title="Abonnements" subtitle="Statut des abonnements étudiants." />
        <QueryState
          isLoading={subscriptionsQuery.isLoading}
          isError={subscriptionsQuery.isError}
          error={subscriptionsQuery.error}
          isEmpty={!subscriptionsQuery.data?.length}
          emptyTitle="Aucun abonnement"
          emptyMessage="Créez un paiement et confirmez-le pour activer un abonnement."
          onRetry={() => void subscriptionsQuery.refetch()}
        >
          <Surface className="table-scroll overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Étudiant</th>
                  <th>Statut</th>
                  <th>Début</th>
                  <th>Expiration</th>
                </tr>
              </thead>
              <tbody>
                {subscriptionsQuery.data?.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium">{studentLabel(row)}</td>
                    <td>
                      <Status
                        tone={
                          row.status === "active" || row.status === "grace_period"
                            ? "green"
                            : row.status === "past_due"
                              ? "amber"
                              : "red"
                        }
                      >
                        {row.status}
                      </Status>
                    </td>
                    <td>{row.starts_at?.slice(0, 10) ?? "—"}</td>
                    <td>{row.expires_at?.slice(0, 10) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Surface>
        </QueryState>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={mode === "invoices" ? "Factures" : "Paiements"}
        subtitle="Paiements liés aux abonnements et à l’accès académique."
        action={<Button onClick={() => setCreateOpen(true)}>+ Enregistrer un paiement</Button>}
      />
      <ProofReviewQueue />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total encaissé" value={stats.paidLabel} />
        <Metric label="En retard" value={String(stats.overdue)} />
        <Metric label="Partiels" value={String(stats.partial)} />
        <Metric label="Attendu vs encaissé" value={stats.expectedVsCollected} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Rechercher un étudiant ou une référence…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <select
          className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="partial">Partiel</option>
          <option value="paid">Confirmé</option>
          <option value="overdue">En retard</option>
          <option value="cancelled">Annulé</option>
          <option value="suspended">Suspendu</option>
        </select>
      </div>

      <QueryState
        isLoading={paymentsQuery.isLoading}
        isError={paymentsQuery.isError}
        error={paymentsQuery.error}
        isEmpty={filtered.length === 0}
        emptyTitle="Aucun paiement"
        emptyMessage="Enregistrez un paiement pour démarrer le suivi d’abonnement."
        onRetry={() => void paymentsQuery.refetch()}
      >
        <div className="space-y-3 md:hidden">
          {filtered.map((row) => {
            const billing = paymentBillingSummary(row);
            return (
              <Surface key={row.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{studentLabel(row)}</p>
                    <p className="text-sm text-muted-foreground">
                      {billing.plan} · {billing.period}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Attendu {billing.expected} · Versé {billing.paid}
                    </p>
                  </div>
                  <Status tone={paymentTone(row.status)}>{paymentStatusLabel(row.status)}</Status>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Initial : {formatMoneyAmount(paymentInitial(row), row.currency)}</span>
                  <span>Remise : {formatDiscount(row)}</span>
                  <span>Payé : {billing.paid}</span>
                  <span>Reste : {formatMoneyAmount(paymentRemaining(row), row.currency)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Mois / période {row.due_date ?? billing.period}
                  {row.payment_method ? ` · ${paymentMethodLabel(row.payment_method)}` : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {receiptActions(row)}
                  {canRemindPayment(row.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={remindPayment.isPending}
                      onClick={() => sendReminder(row)}
                    >
                      Relancer
                    </Button>
                  )}
                  {row.status === "pending" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={markOverdue.isPending}
                      onClick={() => {
                        markOverdue.mutate(row.id, {
                          onSuccess: () => toast.success("Marqué en retard · accès restreint"),
                          onError: (err) => toast.error(err.message),
                        });
                      }}
                    >
                      Marquer en retard
                    </Button>
                  )}
                </div>
              </Surface>
            );
          })}
        </div>
        <Surface className="table-scroll hidden md:block">
          <table className="data-table">
            <thead>
              <tr>
                <th>Étudiant</th>
                <th>Formule</th>
                <th>Période</th>
                <th>Devise</th>
                <th>Attendu</th>
                <th>Versé</th>
                <th>Reste</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const billing = paymentBillingSummary(row);
                return (
                  <tr key={row.id}>
                    <td className="font-medium">{studentLabel(row)}</td>
                    <td>{billing.plan}</td>
                    <td>{billing.period}</td>
                    <td>{billing.currency}</td>
                    <td>{billing.expected}</td>
                    <td>{billing.paid}</td>
                    <td>{formatMoneyAmount(paymentRemaining(row), row.currency)}</td>
                    <td>
                      <Status tone={paymentTone(row.status)}>
                        {paymentStatusLabel(row.status)}
                      </Status>
                    </td>
                    <td className="space-x-1 whitespace-nowrap">
                      {receiptActions(row)}
                      {canRemindPayment(row.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={remindPayment.isPending}
                          onClick={() => sendReminder(row)}
                        >
                          Relancer
                        </Button>
                      )}
                      {row.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={markOverdue.isPending}
                          onClick={() => {
                            markOverdue.mutate(row.id, {
                              onSuccess: () => toast.success("Marqué en retard · accès restreint"),
                              onError: (err) => toast.error(err.message),
                            });
                          }}
                        >
                          Marquer en retard
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Surface>
      </QueryState>

      <Surface className="mt-5 p-4 sm:p-5">
        <h2 className="font-semibold">Politique d’accès</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-success-soft p-4">
            <Status tone="green">ACTIF</Status>
            <p className="mt-2 text-sm font-medium">Accès académique complet</p>
          </div>
          <div className="rounded-md bg-warning-soft p-4">
            <Status tone="amber">EN RETARD</Status>
            <p className="mt-2 text-sm font-medium">Accès restreint</p>
          </div>
          <div className="rounded-md bg-alert-soft p-4">
            <Status tone="red">SUSPENDU</Status>
            <p className="mt-2 text-sm font-medium">Apprentissage verrouillé</p>
          </div>
        </div>
      </Surface>

      {createOpen && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <h2 className="text-lg font-semibold">Enregistrer un paiement</h2>

            <FormSection title="Étudiant" description="Sélectionnez le compte étudiant concerné.">
              <label className="block text-sm">
                Étudiant
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                >
                  <option value="">Choisir un étudiant</option>
                  {(studentsQuery.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.email}
                    </option>
                  ))}
                </select>
              </label>
            </FormSection>

            <FormSection title="Formule" description="Mensuel ou trimestriel, en MAD ou EUR.">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  Formule
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={billingPlan}
                    onChange={(e) => applyPlanDefaults(e.target.value as BillingPlan, currency)}
                  >
                    <option value="monthly">
                      Mensuel ({formatMoneyAmount(planAmount("monthly", currency), currency)})
                    </option>
                    <option value="quarterly">
                      Trimestriel ({formatMoneyAmount(planAmount("quarterly", currency), currency)})
                    </option>
                  </select>
                </label>
                <label className="block text-sm">
                  Devise
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={currency}
                    onChange={(e) =>
                      applyPlanDefaults(billingPlan, e.target.value as BillingCurrency)
                    }
                  >
                    <option value="MAD">MAD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </label>
              </div>
              <label className="mt-3 block text-sm">
                Mois / période
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={billingPeriod}
                  onChange={(e) => setBillingPeriod(e.target.value)}
                >
                  {listBillingPeriods(billingPlan, 8).map((period) => (
                    <option key={period} value={period}>
                      {billingPeriodLabel(period, billingPlan)}
                    </option>
                  ))}
                </select>
              </label>
            </FormSection>

            <FormSection title="Montant" description="Montant initial avant remise.">
              <label className="block text-sm">
                Montant initial ({currency})
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={initialAmount}
                  onChange={(e) => setInitialAmount(e.target.value)}
                  className="mt-1"
                />
              </label>
            </FormSection>

            <FormSection title="Remise" description="Optionnelle — pourcentage ou montant fixe.">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  Type de remise
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={discountMode}
                    onChange={(e) =>
                      setDiscountMode(e.target.value as "none" | "percent" | "fixed")
                    }
                  >
                    <option value="none">Aucune</option>
                    <option value="percent">Pourcentage (%)</option>
                    <option value="fixed">Montant fixe ({currency})</option>
                  </select>
                </label>
                <label className="block text-sm">
                  Valeur remise
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    disabled={discountMode === "none"}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="mt-1"
                  />
                </label>
              </div>
              <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                Montant final :{" "}
                <span className="font-semibold">{formatMoneyAmount(computedFinal, currency)}</span>
              </div>
              <label className="block text-sm">
                Montant payé ({currency})
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="mt-1"
                />
              </label>
            </FormSection>

            <FormSection title="Méthode" description="Mode de règlement et références.">
              <label className="block text-sm">
                Méthode de paiement
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="cash">Espèces</option>
                  <option value="bank_transfer">Virement bancaire</option>
                  <option value="card">Carte</option>
                  <option value="mobile_money">Espèces mobile</option>
                </select>
              </label>
              <label className="block text-sm">
                Référence
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="mt-1"
                />
              </label>
              <label className="block text-sm">
                Note
                <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" />
              </label>
            </FormSection>

            <FormSection title="Statut & échéance">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  Statut
                  <select
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                  >
                    <option value="pending">En attente</option>
                    <option value="partial">Partiel</option>
                    <option value="paid">Confirmé</option>
                    <option value="overdue">En retard</option>
                    <option value="cancelled">Annulé</option>
                    <option value="suspended">Suspendu</option>
                  </select>
                </label>
                <label className="block text-sm">
                  Mois à payer (échéance)
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1"
                  />
                </label>
              </div>
            </FormSection>

            <FormSection
              title="Reçu administratif"
              description="PDF ou image (JPEG/PNG). Zone de dépôt bien visible — facultatif."
            >
              <FileDropzoneVisual
                title="Déposez le reçu administratif"
                hint="PDF ou image (JPEG/PNG) — facultatif"
                className="!py-4"
              >
                <ContentAttachmentUploader
                  kinds={["pdf", "image"]}
                  value={receiptAttachment}
                  onChange={setReceiptAttachment}
                  disabled={createPayment.isPending || uploadPaymentReceipt.isPending}
                  uploading={createPayment.isPending || uploadPaymentReceipt.isPending}
                  requiredFileWhenNew={false}
                  showKindSelect={false}
                />
              </FileDropzoneVisual>
            </FormSection>

            <div className="sticky bottom-0 -mx-1 flex justify-end gap-2 border-t bg-card/95 px-1 pt-4 pb-1 backdrop-blur-sm">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button
                disabled={
                  !studentId ||
                  !initialAmount ||
                  createPayment.isPending ||
                  uploadPaymentReceipt.isPending
                }
                onClick={() => {
                  const discountType = discountMode === "none" ? null : discountMode;
                  const receiptFile = receiptAttachment.file;
                  createPayment.mutate(
                    {
                      studentId,
                      initialAmount: Number(initialAmount),
                      discountType,
                      discountValue: discountMode === "none" ? 0 : Number(discountValue) || 0,
                      amount: computedFinal,
                      amountPaid: Number(amountPaid) || 0,
                      currency,
                      dueDate: dueDate || null,
                      paymentMethod,
                      reference: reference || null,
                      notes: note || null,
                      status: paymentStatus,
                      billingPlan,
                      billingPeriod: billingPeriod || null,
                    },
                    {
                      onSuccess: (created) => {
                        const finish = () => {
                          toast.success("Paiement enregistré");
                          setCreateOpen(false);
                          resetCreateForm();
                        };
                        if (receiptFile && created?.id) {
                          uploadPaymentReceipt.mutate(
                            { paymentId: created.id, file: receiptFile },
                            {
                              onSuccess: () => finish(),
                              onError: (err) => {
                                toast.error(
                                  err instanceof Error
                                    ? `Paiement créé, mais reçu non téléversé : ${err.message}`
                                    : "Paiement créé, mais reçu non téléversé",
                                );
                                setCreateOpen(false);
                                resetCreateForm();
                              },
                            },
                          );
                          return;
                        }
                        finish();
                      },
                      onError: (err) => toast.error(err.message),
                    },
                  );
                }}
              >
                Enregistrer
              </Button>
            </div>
          </Surface>
        </div>
      )}
      <input
        ref={replaceFileRef}
        type="file"
        className="hidden"
        accept="application/pdf,image/jpeg,image/png"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          e.target.value = "";
          if (!file || !replaceReceiptId) return;
          uploadPaymentReceipt.mutate(
            { paymentId: replaceReceiptId, file },
            {
              onSuccess: () => toast.success("Reçu mis à jour"),
              onError: (err) => toast.error(err.message),
              onSettled: () => setReplaceReceiptId(null),
            },
          );
        }}
      />
      <DocumentViewer
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.title ?? ""}
        url={preview?.url ?? null}
        mimeType={preview?.mimeType}
        loading={preview?.loading}
        error={preview?.error}
      />
    </>
  );
}

export function StudentPaymentsPage() {
  const { user, profile } = useAcademy();
  const studentsQuery = useStudents();
  const accessQuery = useAcademicAccess();
  const myStudent = resolveOwnStudent(studentsQuery.data ?? [], {
    profileId: profile?.id ?? user?.id ?? null,
    email: user?.email ?? null,
  });
  const paymentsQuery = usePayments(myStudent?.id);
  const studentId = myStudent?.id || paymentsQuery.data?.[0]?.student_id || "";
  const proofsQuery = usePaymentProofs(studentId || undefined);
  const submitProof = useSubmitPaymentProof();
  const [billingPlan, setBillingPlan] = useState<BillingPlan>("monthly");
  const [currency, setCurrency] = useState<BillingCurrency>("MAD");
  const [billingPeriod, setBillingPeriod] = useState(
    () => listBillingPeriods("monthly", 1)[0] ?? "",
  );
  const [declaredAmount, setDeclaredAmount] = useState(String(planAmount("monthly", "MAD")));
  const [operationDate, setOperationDate] = useState("");
  const [operationReference, setOperationReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [note, setNote] = useState("");
  const [attachment, setAttachment] = useState<AttachmentDraft>({
    kind: "pdf",
    url: "",
    file: null,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [ensuringPayment, setEnsuringPayment] = useState(false);
  const [preview, setPreview] = useState<DocPreview | null>(null);
  const accessBlocked = accessQuery.data === false;
  const hasNotApproved = (proofsQuery.data ?? []).some((p) => p.status === "not_approved");
  const expectedAmount = planAmount(billingPlan, currency);
  const periodOptions = useMemo(() => listBillingPeriods(billingPlan, 8), [billingPlan]);

  const applyStudentPlan = (plan: BillingPlan, nextCurrency: BillingCurrency) => {
    setBillingPlan(plan);
    setCurrency(nextCurrency);
    setDeclaredAmount(String(planAmount(plan, nextCurrency)));
    const periods = listBillingPeriods(plan, 8);
    setBillingPeriod((prev) => (periods.includes(prev) ? prev : (periods[0] ?? "")));
  };

  const identityHint =
    !studentsQuery.isLoading && !paymentsQuery.isLoading && !studentId
      ? "Profil étudiant introuvable. Contactez l’administration."
      : null;

  const resetProofForm = () => {
    setAttachment({ kind: "pdf", url: "", file: null });
    setNote("");
    setDeclaredAmount(String(planAmount(billingPlan, currency)));
    setOperationDate("");
    setOperationReference("");
    setPaymentMethod("bank_transfer");
    setFormError(null);
  };

  const handleSubmitProof = async () => {
    if (!studentId) {
      setFormError("Profil étudiant introuvable. Contactez l’administration.");
      return;
    }
    if (!billingPeriod) {
      setFormError("Sélectionnez un mois à payer.");
      return;
    }
    if (!attachment.file) {
      setFormError("Joignez un justificatif PDF, JPEG ou PNG.");
      return;
    }
    setFormError(null);
    setEnsuringPayment(true);
    try {
      const paymentId = await PaymentService.ensureBillingPayment({
        billingPlan,
        currency,
        period: billingPeriod,
        amount: expectedAmount,
      });
      const reason = validatePaymentProofSubmitInput({
        studentId,
        paymentId,
        declaredAmount,
        operationDate,
        file: attachment.file,
      });
      if (reason) {
        setFormError(reason);
        return;
      }
      await new Promise<void>((resolve, reject) => {
        submitProof.mutate(
          {
            studentId,
            file: attachment.file!,
            paymentId,
            declaredAmount: Number(declaredAmount),
            operationDate,
            operationReference: operationReference || null,
            studentNote: note || null,
            paymentMethod,
          },
          {
            onSuccess: () => {
              toast.success("Justificatif envoyé");
              resetProofForm();
              void proofsQuery.refetch();
              void paymentsQuery.refetch();
              resolve();
            },
            onError: (err) => {
              const mapped = toPaymentProofUserError(err, "generic");
              setFormError(mapped.message);
              toast.error(mapped.message);
              reject(err);
            },
          },
        );
      });
    } catch (err) {
      const mapped = toPaymentProofUserError(err, "generic");
      setFormError(mapped.message);
      toast.error(mapped.message);
    } finally {
      setEnsuringPayment(false);
    }
  };

  const openProofDoc = async (
    title: string,
    mime: string | null | undefined,
    getUrl: () => Promise<string>,
  ) => {
    setPreview({
      title,
      url: null,
      mimeType: mime ?? null,
      loading: true,
      error: null,
    });
    try {
      const url = await getUrl();
      setPreview({ title, url, mimeType: mime ?? null, loading: false, error: null });
    } catch (err) {
      setPreview({
        title,
        url: null,
        mimeType: mime ?? null,
        loading: false,
        error: err instanceof Error ? err.message : "Aperçu impossible",
      });
    }
  };

  const formBusy = submitProof.isPending || ensuringPayment;
  const blockReason =
    identityHint ||
    (!billingPeriod
      ? "Sélectionnez un mois à payer."
      : !attachment.file
        ? "Joignez un justificatif PDF, JPEG ou PNG."
        : !operationDate
          ? "La date de l’opération est obligatoire."
          : !Number.isFinite(Number(declaredAmount)) || Number(declaredAmount) <= 0
            ? "Le montant déclaré doit être supérieur à zéro."
            : null);

  return (
    <>
      <PageHeader title="Votre programme" subtitle="Abonnement, paiements et avis d’opération." />
      {accessBlocked && (
        <Surface className="mb-6 border-destructive/30 bg-alert-soft p-6">
          <h2 className="font-semibold">Accès académique restreint</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre abonnement n’est plus à jour pour le mois en cours. Vous pouvez consulter les
            paiements, déposer un justificatif, gérer le profil et l’assistance. Les cours restent
            bloqués après la 2ᵉ séance du mois suivant votre première connexion, jusqu’à
            régularisation du paiement.
          </p>
        </Surface>
      )}
      {hasNotApproved && (
        <Surface className="mb-6 border-destructive/40 bg-alert-soft p-6">
          <h2 className="font-semibold">Paiement non approuvé</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Un justificatif n’a pas été validé dans le délai de 48 heures. Déposez un nouveau
            justificatif ou contactez le support. Votre compte n’est pas supprimé.
          </p>
        </Surface>
      )}
      {!accessBlocked && !hasNotApproved && (
        <Surface className="mb-6 border-border bg-success-soft/40 p-6">
          <h2 className="font-semibold">Accès académique actif</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Le premier mois après votre première connexion correspond au règlement déjà effectué
            hors plateforme. Pour les mois suivants, un paiement valide est requis afin de conserver
            l’accès.
          </p>
        </Surface>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Surface className="p-5">
          <p className="text-xs text-muted-foreground uppercase">Abonnement</p>
          <p className="mt-2 text-2xl font-semibold">{myStudent?.subscription ?? "—"}</p>
        </Surface>
        <Surface className="p-5">
          <p className="text-xs text-muted-foreground uppercase">Paiements</p>
          <p className="mt-2 text-2xl font-semibold">{paymentsQuery.data?.length ?? 0}</p>
        </Surface>
      </div>

      <Surface className="mb-6 p-5">
        <h2 className="font-semibold">Déclarer un paiement</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisissez votre formule, la devise et le mois à payer, puis joignez le justificatif
          (PDF/JPEG/PNG · max 10 Mo). Validation sous 48 heures.
        </p>
        <div className="mt-4 space-y-3">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmitProof();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                Formule
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={billingPlan}
                  disabled={formBusy}
                  onChange={(e) => applyStudentPlan(e.target.value as BillingPlan, currency)}
                >
                  <option value="monthly">
                    Mensuel — {formatMoneyAmount(planAmount("monthly", currency), currency)}
                  </option>
                  <option value="quarterly">
                    Trimestriel — {formatMoneyAmount(planAmount("quarterly", currency), currency)}
                  </option>
                </select>
              </label>
              <label className="block text-sm">
                Devise
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={currency}
                  disabled={formBusy}
                  onChange={(e) => applyStudentPlan(billingPlan, e.target.value as BillingCurrency)}
                >
                  <option value="MAD">MAD</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
            </div>
            <label className="block text-sm">
              Mois à payer
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={billingPeriod}
                required
                disabled={formBusy}
                onChange={(event) => {
                  setBillingPeriod(event.target.value);
                  setFormError(null);
                }}
              >
                <option value="">Sélectionner un mois / une période</option>
                {periodOptions.map((period) => (
                  <option key={period} value={period}>
                    {billingPeriodLabel(period, billingPlan)}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-muted-foreground">
              Montant attendu :{" "}
              <span className="font-medium text-foreground">
                {formatMoneyAmount(expectedAmount, currency)}
              </span>{" "}
              ({billingPlanLabel(billingPlan)})
            </p>
            {identityHint ? <p className="text-sm text-destructive">{identityHint}</p> : null}
            <label className="block text-sm">
              Moyen de paiement
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={paymentMethod}
                disabled={formBusy}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="bank_transfer">Virement</option>
                <option value="cash">Espèces</option>
                <option value="card">Carte</option>
                <option value="mobile">Paiement mobile</option>
                <option value="other">Autre</option>
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                Montant versé ({currency})
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={declaredAmount}
                  onChange={(event) => setDeclaredAmount(event.target.value)}
                  className="mt-1"
                  disabled={formBusy}
                />
              </label>
              <label className="block text-sm">
                Date de l’opération
                <Input
                  type="date"
                  value={operationDate}
                  onChange={(event) => setOperationDate(event.target.value)}
                  className="mt-1"
                  disabled={formBusy}
                />
              </label>
            </div>
            <label className="block text-sm">
              RIB du compte ayant effectué le virement
              <Input
                value={operationReference}
                onChange={(event) => setOperationReference(event.target.value)}
                className="mt-1"
                disabled={formBusy}
                placeholder="Ex. 007 …"
              />
            </label>
            <ContentAttachmentUploader
              kinds={["pdf", "image"]}
              showKindSelect={false}
              accept={PAYMENT_PROOF_ACCEPT}
              validateFile={validatePaymentProofFile}
              value={attachment}
              onChange={(next) => {
                setAttachment(next);
                setFormError(null);
              }}
              disabled={formBusy}
              uploading={formBusy}
            />
            <label className="block text-sm">
              Note (optionnel)
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1"
                disabled={formBusy}
              />
            </label>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            {blockReason && !formError && !formBusy ? (
              <p className="text-sm text-muted-foreground">{blockReason}</p>
            ) : null}
            <Button type="submit" disabled={Boolean(blockReason) || formBusy}>
              {formBusy ? "Envoi en cours…" : "Envoyer le justificatif"}
            </Button>
          </form>
        </div>
        {(proofsQuery.data?.length ?? 0) > 0 && (
          <div className="mt-6 divide-y border-t">
            {proofsQuery.data?.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {(p.submitted_at ?? p.created_at).slice(0, 16).replace("T", " ")}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.student_note || "Sans note"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoneyAmount(Number(p.declared_amount), p.payment?.currency ?? "MAD")}
                    {p.payment?.billing_plan
                      ? ` · ${billingPlanLabel(p.payment.billing_plan)}`
                      : ""}
                    {p.payment?.billing_period
                      ? ` · ${billingPeriodLabel(p.payment.billing_period, p.payment.billing_plan)}`
                      : ""}{" "}
                    · {p.operation_date}
                    {p.operation_reference ? ` · RIB ${p.operation_reference}` : ""}
                    {p.validation_deadline
                      ? ` · limite validation ${p.validation_deadline.slice(0, 16).replace("T", " ")}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void openProofDoc(`Justificatif · ${p.operation_date}`, p.mime_type, () =>
                        PaymentProofService.getSignedUrl(p),
                      )
                    }
                  >
                    Voir
                  </Button>
                  {p.admin_receipt_path ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void openProofDoc(
                            `Reçu · ${p.operation_date}`,
                            p.admin_receipt_mime,
                            () => PaymentProofService.getAdminReceiptSignedUrl(p),
                          )
                        }
                      >
                        Voir reçu
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void (async () => {
                            try {
                              const url = await PaymentProofService.getAdminReceiptSignedUrl(p);
                              await forceDownloadUrl(url, `recu-${p.id}`);
                            } catch (err) {
                              toast.error(
                                err instanceof Error ? err.message : "Téléchargement impossible",
                              );
                            }
                          })();
                        }}
                      >
                        Télécharger reçu
                      </Button>
                    </>
                  ) : null}
                  <Status
                    tone={
                      p.status === "approved"
                        ? "green"
                        : p.status === "not_approved" || p.status === "rejected"
                          ? "red"
                          : "amber"
                    }
                  >
                    {proofStatusLabel(p.status)}
                  </Status>
                </div>
              </div>
            ))}
          </div>
        )}
      </Surface>

      <DocumentViewer
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.title ?? ""}
        url={preview?.url ?? null}
        mimeType={preview?.mimeType}
        loading={preview?.loading}
        error={preview?.error}
      />

      <QueryState
        isLoading={studentsQuery.isLoading || paymentsQuery.isLoading}
        isError={studentsQuery.isError || paymentsQuery.isError}
        error={(studentsQuery.error ?? paymentsQuery.error) as Error | null}
        isEmpty={!paymentsQuery.data?.length}
        emptyTitle="Aucun paiement"
        emptyMessage="Lorsqu’un paiement est enregistré, il apparaîtra ici."
        onRetry={() => void paymentsQuery.refetch()}
      >
        <Surface className="divide-y">
          {paymentsQuery.data?.map((row) => {
            const billing = paymentBillingSummary(row);
            return (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div>
                  <p className="font-medium">
                    {billing.expected} · {billing.plan}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {billing.period}
                    {row.due_date ? ` · à régler avant ${row.due_date}` : ""}
                    {` · versé ${billing.paid}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {row.admin_receipt_path && row.status === "paid" ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          void openProofDoc(`Reçu administratif`, row.admin_receipt_mime, () =>
                            PaymentService.getAdminReceiptSignedUrl(row),
                          )
                        }
                      >
                        Voir
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void (async () => {
                            try {
                              const url = await PaymentService.getAdminReceiptSignedUrl(row);
                              await forceDownloadUrl(url, `recu-${row.id}`);
                            } catch (err) {
                              toast.error(
                                err instanceof Error ? err.message : "Téléchargement impossible",
                              );
                            }
                          })();
                        }}
                      >
                        Télécharger
                      </Button>
                    </>
                  ) : null}
                  <Status tone={paymentTone(row.status)}>{paymentStatusLabel(row.status)}</Status>
                </div>
              </div>
            );
          })}
        </Surface>
      </QueryState>
    </>
  );
}
