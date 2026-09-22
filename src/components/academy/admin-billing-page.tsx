import { useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCreatePayment,
  useDeleteAdminReceipt,
  useMarkPaymentOverdue,
  usePaymentProofs,
  usePayments,
  usePendingPaymentProofs,
  useRemindPayment,
  useReviewPaymentProof,
  useSetStudentBillingPlan,
  useStudents,
  useSubscriptions,
  useUploadAdminReceipt,
  useUploadPaymentAdminReceipt,
} from "@/hooks/use-academy-data";
import { PaymentProofService } from "@/services/academy-services";
import type { PaymentProofListItem } from "@/services/supabase/payment-proof-service";
import { computeFinalAmount } from "@/services/supabase/payment-service";
import { SettingsService } from "@/services/supabase/settings-service";
import {
  type BillingCurrency,
  type BillingPlan,
  type InstallmentUxStatus,
  PAYMENT_REJECTION_REASONS,
  type PaymentRejectionReasonId,
  amountToMad,
  billingPeriodLabel,
  billingPlanLabel,
  formatMoneyAmount,
  formatRejectionAdminNote,
  installmentUxLabel,
  installmentUxTone,
  latestProofForPayment,
  resolveActiveBillingFromSubscription,
  resolveInstallmentUxStatus,
  summarizePaymentRow,
} from "@/lib/billing-ux";
import {
  listBillingPeriods,
  parseBillingTariffSettings,
  resolvePlanAmount,
} from "@/lib/subscription-plans";
import { queryKeys } from "@/lib/query-keys";
import type { Database } from "@/types/database";
import { ContentAttachmentUploader, type AttachmentDraft } from "./content-attachment-uploader";
import { DocumentViewer } from "./document-viewer";
import { QueryState } from "./query-state";
import {
  FilterBar,
  FormSection,
  Metric,
  PageHeader,
  SectionHeader,
  Status,
  Surface,
} from "./primitives";

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

function groupLabel(studentId: string, students: Array<{ id: string; className?: string }>) {
  return students.find((s) => s.id === studentId)?.className ?? "—";
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

function paymentRemaining(row: PaymentRow) {
  return Math.max(0, Number(row.amount) - Number(row.amount_paid ?? 0));
}

function canRemindPayment(status: string) {
  return (
    status === "pending" || status === "partial" || status === "overdue" || status === "suspended"
  );
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

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept="application/pdf,image/jpeg,image/png"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          e.target.value = "";
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

function RejectProofDialog({
  proof,
  open,
  onOpenChange,
}: {
  proof: PaymentProofListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const review = useReviewPaymentProof();
  const [reasonId, setReasonId] = useState<PaymentRejectionReasonId>("wrong_amount");
  const [comment, setComment] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refuser le justificatif</DialogTitle>
          <DialogDescription>
            L’étudiant sera notifié avec le motif. Il pourra déposer un nouveau justificatif.
          </DialogDescription>
        </DialogHeader>
        <label className="block text-sm">
          Motif
          <select
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={reasonId}
            onChange={(e) => setReasonId(e.target.value as PaymentRejectionReasonId)}
          >
            {PAYMENT_REJECTION_REASONS.map((reason) => (
              <option key={reason.id} value={reason.id}>
                {reason.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Commentaire (optionnel)
          <Input value={comment} onChange={(e) => setComment(e.target.value)} className="mt-1" />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            disabled={!proof || review.isPending}
            onClick={() => {
              if (!proof) return;
              review.mutate(
                {
                  proofId: proof.id,
                  approve: false,
                  adminNote: formatRejectionAdminNote(reasonId, comment),
                },
                {
                  onSuccess: () => {
                    toast.success("Justificatif refusé · étudiant notifié");
                    onOpenChange(false);
                    setComment("");
                  },
                  onError: (err) => toast.error(err.message),
                },
              );
            }}
          >
            Confirmer le refus
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FinancePages({ mode }: { mode: string }) {
  const paymentsQuery = usePayments();
  const subscriptionsQuery = useSubscriptions();
  const studentsQuery = useStudents();
  const pendingQuery = usePendingPaymentProofs();
  const allProofsQuery = usePaymentProofs();
  // Share BrandingProvider cache (getMap Record). listPublic array on same key crashed parse.
  const settingsQuery = useQuery({
    queryKey: queryKeys.branding.settings,
    queryFn: () => SettingsService.getMap(),
  });
  const tariffs = useMemo(
    () => parseBillingTariffSettings(settingsQuery.data),
    [settingsQuery.data],
  );
  const catalogAmount = (plan: BillingPlan, currency: BillingCurrency) =>
    resolvePlanAmount(plan, currency, tariffs);
  const createPayment = useCreatePayment();
  const markOverdue = useMarkPaymentOverdue();
  const remindPayment = useRemindPayment();
  const review = useReviewPaymentProof();
  const setBillingPlan = useSetStudentBillingPlan();
  const uploadPaymentReceipt = useUploadPaymentAdminReceipt();

  const [tab, setTab] = useState(
    mode === "subscriptions" ? "subscriptions" : mode === "invoices" ? "history" : "due",
  );
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [rejectProof, setRejectProof] = useState<PaymentProofListItem | null>(null);
  const [preview, setPreview] = useState<DocPreview | null>(null);
  const [planEdit, setPlanEdit] = useState<{
    studentId: string;
    plan: BillingPlan;
    currency: BillingCurrency;
    applyMode: "immediate" | "next_period";
  } | null>(null);

  const [studentId, setStudentId] = useState("");
  const [billingPlan, setBillingPlanForm] = useState<BillingPlan>("monthly");
  const [currency, setCurrency] = useState<BillingCurrency>("MAD");
  const [billingPeriod, setBillingPeriod] = useState(
    () => listBillingPeriods("monthly", 1)[0] ?? "",
  );
  const [initialAmount, setInitialAmount] = useState(String(catalogAmount("monthly", "MAD")));
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
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const [replaceReceiptId, setReplaceReceiptId] = useState<string | null>(null);

  const students = studentsQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];
  const proofs = allProofsQuery.data ?? [];

  const metrics = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let toCollectMad = 0;
    let collectedMonthMad = 0;
    let overdue = 0;
    for (const row of payments) {
      const remaining = paymentRemaining(row);
      if (row.status === "pending" || row.status === "partial" || row.status === "overdue") {
        toCollectMad += amountToMad(remaining, row.currency);
      }
      if (row.status === "overdue") overdue += 1;
      if (row.status === "paid") {
        const paidAt = (row.payment_date ?? row.updated_at ?? "").slice(0, 7);
        if (paidAt === monthKey) {
          const amount = Number(row.amount_paid ?? row.amount);
          collectedMonthMad += amountToMad(amount, row.currency);
        }
      }
    }
    return {
      toCollect: formatMoneyAmount(toCollectMad, "MAD"),
      pendingProofs: pendingQuery.data?.length ?? 0,
      overdue,
      collectedMonth: formatMoneyAmount(collectedMonthMad, "MAD"),
    };
  }, [payments, pendingQuery.data]);

  const dueRows = useMemo(() => {
    return payments
      .map((payment) => {
        const proof = latestProofForPayment(proofs, payment.id);
        const status = resolveInstallmentUxStatus(payment, proof);
        return { payment, proof, status };
      })
      .filter((row) => row.status !== "validated")
      .filter((row) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return studentLabel(row.payment).toLowerCase().includes(q);
      })
      .sort((a, b) => (a.payment.due_date ?? "").localeCompare(b.payment.due_date ?? ""));
  }, [payments, proofs, search]);

  const historyRows = useMemo(() => {
    return payments.filter((row) => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return studentLabel(row).toLowerCase().includes(q);
    });
  }, [payments, search]);

  const computedFinal = useMemo(() => {
    const initial = Number(initialAmount) || 0;
    const discount = Number(discountValue) || 0;
    const type = discountMode === "none" ? null : discountMode;
    return computeFinalAmount(initial, type, discount);
  }, [initialAmount, discountMode, discountValue]);

  const applyPlanDefaults = (plan: BillingPlan, nextCurrency: BillingCurrency) => {
    setBillingPlanForm(plan);
    setCurrency(nextCurrency);
    setInitialAmount(String(catalogAmount(plan, nextCurrency)));
    const periods = listBillingPeriods(plan, 6);
    setBillingPeriod((prev) => (periods.includes(prev) ? prev : (periods[0] ?? "")));
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

  const resetCreateForm = () => {
    setStudentId("");
    setBillingPlanForm("monthly");
    setCurrency("MAD");
    setBillingPeriod(listBillingPeriods("monthly", 1)[0] ?? "");
    setInitialAmount(String(catalogAmount("monthly", "MAD")));
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

  const renderInstallmentCard = (
    payment: PaymentRow,
    status: InstallmentUxStatus,
    extras?: ReactNode,
  ) => {
    const summary = summarizePaymentRow(payment);
    return (
      <Surface key={payment.id} className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{studentLabel(payment)}</p>
            <p className="text-sm text-muted-foreground">
              {groupLabel(payment.student_id, students)} · {summary.planLabel} ·{" "}
              {summary.periodLabel}
            </p>
            <p className="text-sm text-muted-foreground">
              Attendu {summary.expected} · Versé {summary.paid}
            </p>
          </div>
          <Status tone={installmentUxTone(status)}>{installmentUxLabel(status)}</Status>
        </div>
        {extras}
      </Surface>
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="Facturation"
        title="Centre de facturation"
        subtitle="Échéances, justificatifs, historique et abonnements."
        action={<Button onClick={() => setCreateOpen(true)}>+ Enregistrer un paiement</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="À encaisser" value={metrics.toCollect} />
        <Metric label="Justificatifs à vérifier" value={String(metrics.pendingProofs)} />
        <Metric label="Paiements en retard" value={String(metrics.overdue)} />
        <Metric label="Encaissé ce mois" value={metrics.collectedMonth} />
      </div>

      <FilterBar className="mb-4">
        <Input
          placeholder="Rechercher un étudiant…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
      </FilterBar>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="due">Échéances</TabsTrigger>
          <TabsTrigger value="proofs">
            Justificatifs à vérifier
            {metrics.pendingProofs > 0 ? ` (${metrics.pendingProofs})` : ""}
          </TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
          <TabsTrigger value="subscriptions">Abonnements</TabsTrigger>
        </TabsList>

        <TabsContent value="due" className="space-y-4">
          <QueryState
            isLoading={paymentsQuery.isLoading}
            isError={paymentsQuery.isError}
            error={paymentsQuery.error}
            isEmpty={dueRows.length === 0}
            emptyTitle="Aucune échéance ouverte"
            emptyMessage="Les échéances à régler apparaîtront ici."
            onRetry={() => void paymentsQuery.refetch()}
          >
            <div className="space-y-3 md:hidden">
              {dueRows.map(({ payment, status }) =>
                renderInstallmentCard(
                  payment,
                  status,
                  <div className="flex flex-wrap gap-2">
                    {canRemindPayment(payment.status) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={remindPayment.isPending}
                        onClick={() =>
                          remindPayment.mutate(payment.id, {
                            onSuccess: () => toast.success("Relance envoyée"),
                            onError: (err) => toast.error(err.message),
                          })
                        }
                      >
                        Relancer
                      </Button>
                    ) : null}
                    {payment.status === "pending" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={markOverdue.isPending}
                        onClick={() =>
                          markOverdue.mutate(payment.id, {
                            onSuccess: () => toast.success("Marqué en retard"),
                            onError: (err) => toast.error(err.message),
                          })
                        }
                      >
                        Marquer en retard
                      </Button>
                    ) : null}
                  </div>,
                ),
              )}
            </div>
            <Surface className="table-scroll hidden md:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Étudiant</th>
                    <th>Groupe</th>
                    <th>Formule</th>
                    <th>Période</th>
                    <th>Attendu</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dueRows.map(({ payment, status }) => {
                    const summary = summarizePaymentRow(payment);
                    return (
                      <tr key={payment.id}>
                        <td className="font-medium">{studentLabel(payment)}</td>
                        <td>{groupLabel(payment.student_id, students)}</td>
                        <td>{summary.planLabel}</td>
                        <td>{summary.periodLabel}</td>
                        <td>{summary.expected}</td>
                        <td>
                          <Status tone={installmentUxTone(status)}>
                            {installmentUxLabel(status)}
                          </Status>
                        </td>
                        <td className="space-x-1 whitespace-nowrap">
                          {canRemindPayment(payment.status) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={remindPayment.isPending}
                              onClick={() =>
                                remindPayment.mutate(payment.id, {
                                  onSuccess: () => toast.success("Relance envoyée"),
                                  onError: (err) => toast.error(err.message),
                                })
                              }
                            >
                              Relancer
                            </Button>
                          ) : null}
                          {payment.status === "pending" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={markOverdue.isPending}
                              onClick={() =>
                                markOverdue.mutate(payment.id, {
                                  onSuccess: () => toast.success("Marqué en retard"),
                                  onError: (err) => toast.error(err.message),
                                })
                              }
                            >
                              Retard
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Surface>
          </QueryState>
        </TabsContent>

        <TabsContent value="proofs" className="space-y-4">
          <QueryState
            isLoading={pendingQuery.isLoading}
            isError={pendingQuery.isError}
            error={pendingQuery.error}
            isEmpty={!pendingQuery.data?.length}
            emptyTitle="Aucun justificatif en attente"
            emptyMessage="Les dépôts étudiants apparaîtront ici."
            onRetry={() => void pendingQuery.refetch()}
          >
            <div className="space-y-3">
              {pendingQuery.data?.map((proof) => (
                <Surface key={proof.id} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{studentLabel(proof)}</p>
                      <p className="text-sm text-muted-foreground">
                        {groupLabel(proof.student_id, students)}
                        {proof.payment?.billing_plan
                          ? ` · ${billingPlanLabel(proof.payment.billing_plan)}`
                          : ""}
                        {proof.payment?.billing_period
                          ? ` · ${billingPeriodLabel(proof.payment.billing_period, proof.payment.billing_plan)}`
                          : ""}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Attendu{" "}
                        {proof.payment
                          ? formatMoneyAmount(Number(proof.payment.amount), proof.payment.currency)
                          : "—"}
                        {" · "}Déclaré{" "}
                        {formatMoneyAmount(
                          Number(proof.declared_amount),
                          proof.payment?.currency ?? "MAD",
                        )}
                        {" · "}Opération {proof.operation_date}
                        {proof.operation_reference ? ` · Compte ${proof.operation_reference}` : ""}
                      </p>
                    </div>
                    <Status tone="amber">À vérifier</Status>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => openStudentProof(proof)}>
                      Voir le fichier
                    </Button>
                    <Button
                      size="sm"
                      disabled={review.isPending}
                      onClick={() => {
                        if (!window.confirm("Valider ce justificatif et activer l’accès ?")) return;
                        review.mutate(
                          { proofId: proof.id, approve: true },
                          {
                            onSuccess: () => toast.success("Validé · étudiant notifié"),
                            onError: (err) => toast.error(err.message),
                          },
                        );
                      }}
                    >
                      Valider
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={review.isPending}
                      onClick={() => setRejectProof(proof)}
                    >
                      Refuser
                    </Button>
                  </div>
                  <AdminReceiptActions
                    proof={proof}
                    onChanged={() => {
                      void pendingQuery.refetch();
                      void allProofsQuery.refetch();
                    }}
                    onPreview={setPreview}
                  />
                </Surface>
              ))}
            </div>
          </QueryState>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <QueryState
            isLoading={paymentsQuery.isLoading}
            isError={paymentsQuery.isError}
            error={paymentsQuery.error}
            isEmpty={historyRows.length === 0}
            emptyTitle="Aucun historique"
            emptyMessage="Les paiements enregistrés apparaîtront ici."
            onRetry={() => void paymentsQuery.refetch()}
          >
            <div className="space-y-3 md:hidden">
              {historyRows.map((payment) => {
                const proof = latestProofForPayment(proofs, payment.id);
                const status = resolveInstallmentUxStatus(payment, proof);
                return renderInstallmentCard(payment, status);
              })}
            </div>
            <Surface className="table-scroll hidden md:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Étudiant</th>
                    <th>Période</th>
                    <th>Formule</th>
                    <th>Montant</th>
                    <th>Statut</th>
                    <th>Reçu</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((payment) => {
                    const summary = summarizePaymentRow(payment);
                    const proof = latestProofForPayment(proofs, payment.id);
                    const status = resolveInstallmentUxStatus(payment, proof);
                    return (
                      <tr key={payment.id}>
                        <td className="font-medium">{studentLabel(payment)}</td>
                        <td>{summary.periodLabel}</td>
                        <td>{summary.planLabel}</td>
                        <td>{summary.expected}</td>
                        <td>
                          <Status tone={installmentUxTone(status)}>
                            {installmentUxLabel(status)}
                          </Status>
                        </td>
                        <td>
                          {payment.admin_receipt_path ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setReplaceReceiptId(payment.id);
                                replaceFileRef.current?.click();
                              }}
                            >
                              Gérer
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setReplaceReceiptId(payment.id);
                                replaceFileRef.current?.click();
                              }}
                            >
                              Ajouter
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
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <SectionHeader
            title="Abonnements"
            description="Formule et devise appartiennent à l’abonnement. Un changement peut prendre effet à la prochaine période."
          />
          <QueryState
            isLoading={subscriptionsQuery.isLoading}
            isError={subscriptionsQuery.isError}
            error={subscriptionsQuery.error}
            isEmpty={!subscriptionsQuery.data?.length}
            emptyTitle="Aucun abonnement"
            emptyMessage="Les abonnements étudiants apparaîtront ici."
            onRetry={() => void subscriptionsQuery.refetch()}
          >
            <div className="space-y-3 md:hidden">
              {subscriptionsQuery.data?.map((row) => {
                const billing = resolveActiveBillingFromSubscription(row, tariffs);
                return (
                  <Surface key={row.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{studentLabel(row)}</p>
                        <p className="text-sm text-muted-foreground">
                          {billingPlanLabel(billing.plan)} · {billing.currency} ·{" "}
                          {formatMoneyAmount(billing.amount, billing.currency)}
                        </p>
                        {billing.pendingEffectivePeriod ? (
                          <p className="text-xs text-muted-foreground">
                            Changement prévu{" "}
                            {billingPeriodLabel(
                              billing.pendingEffectivePeriod,
                              billing.pendingPlan,
                            )}
                          </p>
                        ) : null}
                      </div>
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
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setPlanEdit({
                          studentId: row.student_id,
                          plan: billing.plan,
                          currency: billing.currency,
                          applyMode: "next_period",
                        })
                      }
                    >
                      Modifier formule
                    </Button>
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
                    <th>Devise</th>
                    <th>Tarif</th>
                    <th>Statut</th>
                    <th>Changement prévu</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptionsQuery.data?.map((row) => {
                    const billing = resolveActiveBillingFromSubscription(row, tariffs);
                    return (
                      <tr key={row.id}>
                        <td className="font-medium">{studentLabel(row)}</td>
                        <td>{billingPlanLabel(billing.plan)}</td>
                        <td>{billing.currency}</td>
                        <td>{formatMoneyAmount(billing.amount, billing.currency)}</td>
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
                        <td>
                          {billing.pendingEffectivePeriod
                            ? billingPeriodLabel(
                                billing.pendingEffectivePeriod,
                                billing.pendingPlan,
                              )
                            : "—"}
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setPlanEdit({
                                studentId: row.student_id,
                                plan: billing.plan,
                                currency: billing.currency,
                                applyMode: "next_period",
                              })
                            }
                          >
                            Modifier
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Surface>
          </QueryState>
        </TabsContent>
      </Tabs>

      {createOpen ? (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <h2 className="text-lg font-semibold">Enregistrer un paiement</h2>
            <FormSection title="Étudiant">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
              >
                <option value="">Choisir un étudiant</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.email}
                  </option>
                ))}
              </select>
            </FormSection>
            <FormSection title="Formule">
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={billingPlan}
                  onChange={(e) => applyPlanDefaults(e.target.value as BillingPlan, currency)}
                >
                  <option value="monthly">
                    Mensuelle ({formatMoneyAmount(catalogAmount("monthly", currency), currency)})
                  </option>
                  <option value="quarterly">
                    Trimestrielle ({formatMoneyAmount(catalogAmount("quarterly", currency), currency)})
                  </option>
                </select>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={currency}
                  onChange={(e) =>
                    applyPlanDefaults(billingPlan, e.target.value as BillingCurrency)
                  }
                >
                  <option value="MAD">MAD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              <select
                className="mt-3 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={billingPeriod}
                onChange={(e) => setBillingPeriod(e.target.value)}
              >
                {listBillingPeriods(billingPlan, 8).map((period) => (
                  <option key={period} value={period}>
                    {billingPeriodLabel(period, billingPlan)}
                  </option>
                ))}
              </select>
            </FormSection>
            <FormSection title="Montant">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={initialAmount}
                onChange={(e) => setInitialAmount(e.target.value)}
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={discountMode}
                  onChange={(e) => setDiscountMode(e.target.value as "none" | "percent" | "fixed")}
                >
                  <option value="none">Sans remise</option>
                  <option value="percent">Remise %</option>
                  <option value="fixed">Remise fixe</option>
                </select>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountValue}
                  disabled={discountMode === "none"}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="Remise"
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Final : {formatMoneyAmount(computedFinal, currency)}
              </p>
              <Input
                className="mt-3"
                type="number"
                min="0"
                step="0.01"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="Montant payé"
              />
            </FormSection>
            <FormSection title="Détails">
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="cash">Espèces</option>
                  <option value="bank_transfer">Virement</option>
                  <option value="card">Carte</option>
                </select>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                >
                  <option value="pending">En attente</option>
                  <option value="paid">Confirmé</option>
                  <option value="partial">Partiel</option>
                  <option value="overdue">En retard</option>
                </select>
              </div>
              <Input
                className="mt-3"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Référence"
              />
              <Input
                className="mt-3"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              <Input
                className="mt-3"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note"
              />
              <div className="mt-3">
                <ContentAttachmentUploader
                  kinds={["pdf", "image"]}
                  showKindSelect={false}
                  value={receiptAttachment}
                  onChange={setReceiptAttachment}
                />
              </div>
            </FormSection>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  resetCreateForm();
                }}
              >
                Annuler
              </Button>
              <Button
                disabled={!studentId || createPayment.isPending}
                onClick={() => {
                  createPayment.mutate(
                    {
                      studentId,
                      initialAmount: Number(initialAmount) || 0,
                      discountType: discountMode === "none" ? null : discountMode,
                      discountValue: Number(discountValue) || 0,
                      amountPaid: Number(amountPaid) || 0,
                      currency,
                      dueDate: dueDate || null,
                      paymentMethod,
                      reference: reference || null,
                      notes: note || null,
                      status: paymentStatus,
                      billingPlan,
                      billingPeriod,
                    },
                    {
                      onSuccess: (created) => {
                        const finish = () => {
                          toast.success("Paiement enregistré");
                          setCreateOpen(false);
                          resetCreateForm();
                        };
                        const receiptFile = receiptAttachment.file;
                        if (receiptFile) {
                          uploadPaymentReceipt.mutate(
                            { paymentId: created.id, file: receiptFile },
                            {
                              onSuccess: () => finish(),
                              onError: (err) => {
                                toast.error(
                                  err instanceof Error
                                    ? `Paiement créé, reçu non téléversé : ${err.message}`
                                    : "Paiement créé, reçu non téléversé",
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
      ) : null}

      <Dialog open={Boolean(planEdit)} onOpenChange={(open) => !open && setPlanEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la formule</DialogTitle>
            <DialogDescription>
              Les anciennes échéances restent inchangées. Préférez une prise d’effet à la prochaine
              période.
            </DialogDescription>
          </DialogHeader>
          {planEdit ? (
            <div className="space-y-3">
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={planEdit.plan}
                onChange={(e) => setPlanEdit({ ...planEdit, plan: e.target.value as BillingPlan })}
              >
                <option value="monthly">Mensuelle</option>
                <option value="quarterly">Trimestrielle</option>
              </select>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={planEdit.currency}
                onChange={(e) =>
                  setPlanEdit({ ...planEdit, currency: e.target.value as BillingCurrency })
                }
              >
                <option value="MAD">MAD</option>
                <option value="EUR">EUR</option>
              </select>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={planEdit.applyMode}
                onChange={(e) =>
                  setPlanEdit({
                    ...planEdit,
                    applyMode: e.target.value as "immediate" | "next_period",
                  })
                }
              >
                <option value="next_period">À partir de la prochaine période</option>
                <option value="immediate">Immédiat (n’altère pas le passé)</option>
              </select>
              <p className="text-sm text-muted-foreground">
                Tarif :{" "}
                {formatMoneyAmount(catalogAmount(planEdit.plan, planEdit.currency), planEdit.currency)}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanEdit(null)}>
              Annuler
            </Button>
            <Button
              disabled={!planEdit || setBillingPlan.isPending}
              onClick={() => {
                if (!planEdit) return;
                setBillingPlan.mutate(
                  {
                    studentId: planEdit.studentId,
                    billingPlan: planEdit.plan,
                    billingCurrency: planEdit.currency,
                    applyMode: planEdit.applyMode,
                  },
                  {
                    onSuccess: () => {
                      toast.success(
                        planEdit.applyMode === "immediate"
                          ? "Formule mise à jour"
                          : "Changement planifié pour la prochaine période",
                      );
                      setPlanEdit(null);
                    },
                    onError: (err) => toast.error(err.message),
                  },
                );
              }}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RejectProofDialog
        proof={rejectProof}
        open={Boolean(rejectProof)}
        onOpenChange={(open) => !open && setRejectProof(null)}
      />

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
