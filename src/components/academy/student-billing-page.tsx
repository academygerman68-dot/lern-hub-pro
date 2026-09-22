import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAcademicAccess,
  useMySubscription,
  usePaymentProofs,
  usePayments,
  useStudents,
  useSubmitPaymentProof,
} from "@/hooks/use-academy-data";
import { PaymentProofService, PaymentService } from "@/services/academy-services";
import {
  PAYMENT_PROOF_ACCEPT,
  resolveOwnStudent,
  toPaymentProofUserError,
  validatePaymentProofFile,
  validatePaymentProofSubmitInput,
} from "@/lib/payment-proof";
import {
  type InstallmentUxFilter,
  type InstallmentUxStatus,
  buildVirtualNextInstallment,
  installmentUxLabel,
  installmentUxTone,
  latestProofForPayment,
  matchesInstallmentFilter,
  pickNextInstallment,
  resolveActiveBillingFromSubscription,
  resolveInstallmentUxStatus,
  summarizePaymentRow,
} from "@/lib/billing-ux";
import { billingPeriodLabel, billingPlanLabel, formatMoneyAmount, quoteFlexibleBillingPack } from "@/lib/subscription-plans";
import { useAcademy } from "./academy-context";
import { ContentAttachmentUploader, type AttachmentDraft } from "./content-attachment-uploader";
import { DocumentViewer } from "./document-viewer";
import { QueryState } from "./query-state";
import { FilterBar, PageHeader, SectionHeader, Status, Surface } from "./primitives";

function currentMonthKey(from = new Date()) {
  return `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`;
}

type DocPreview = {
  title: string;
  url: string | null;
  mimeType: string | null;
  loading: boolean;
  error: string | null;
};

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

export function StudentPaymentsPage() {
  const { user, profile } = useAcademy();
  const studentsQuery = useStudents();
  const accessQuery = useAcademicAccess();
  const myStudent = resolveOwnStudent(studentsQuery.data ?? [], {
    profileId: profile?.id ?? user?.id ?? null,
    email: user?.email ?? null,
  });
  const studentId = myStudent?.id ?? "";
  const paymentsQuery = usePayments(studentId || undefined);
  const proofsQuery = usePaymentProofs(studentId || undefined);
  const subscriptionQuery = useMySubscription(studentId || undefined);
  const submitProof = useSubmitPaymentProof();

  const [declareOpen, setDeclareOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<InstallmentUxFilter>("all");
  const [declaredAmount, setDeclaredAmount] = useState("");
  const [operationDate, setOperationDate] = useState("");
  const [accountHint, setAccountHint] = useState("");
  const [note, setNote] = useState("");
  const [includeFuturePack, setIncludeFuturePack] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentDraft>({
    kind: "pdf",
    url: "",
    file: null,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [ensuringPayment, setEnsuringPayment] = useState(false);
  const [preview, setPreview] = useState<DocPreview | null>(null);

  const accessBlocked = accessQuery.data === false;
  const billing = resolveActiveBillingFromSubscription(subscriptionQuery.data);
  const payments = paymentsQuery.data ?? [];
  const proofs = proofsQuery.data ?? [];

  const nextInstallment = useMemo(() => {
    const existing = pickNextInstallment(payments, proofs);
    if (existing) {
      return {
        kind: "existing" as const,
        paymentId: existing.payment.id,
        period: existing.payment.billing_period ?? "—",
        amount: Number(existing.payment.amount),
        currency: existing.payment.currency || billing.currency,
        plan: existing.payment.billing_plan ?? billing.plan,
        dueDate: existing.payment.due_date,
        status: existing.status,
        proof: existing.proof,
      };
    }
    const virtual = buildVirtualNextInstallment({
      plan: billing.plan,
      currency: billing.currency,
    });
    return {
      kind: "virtual" as const,
      paymentId: null as string | null,
      period: virtual.period,
      amount: virtual.amount,
      currency: virtual.currency,
      plan: virtual.plan,
      dueDate: virtual.dueDate,
      status: virtual.status as InstallmentUxStatus,
      proof: null,
    };
  }, [payments, proofs, billing.plan, billing.currency]);

  const historyRows = useMemo(() => {
    return payments
      .map((payment) => {
        const proof = latestProofForPayment(proofs, payment.id);
        const status = resolveInstallmentUxStatus(payment, proof);
        return { payment, proof, status };
      })
      .filter((row) => matchesInstallmentFilter(row.status, historyFilter))
      .sort((a, b) => {
        const aKey = a.payment.billing_period ?? a.payment.due_date ?? a.payment.created_at;
        const bKey = b.payment.billing_period ?? b.payment.due_date ?? b.payment.created_at;
        return bKey.localeCompare(aKey);
      });
  }, [payments, proofs, historyFilter]);

  const identityHint =
    !studentsQuery.isLoading && !paymentsQuery.isLoading && !studentId
      ? "Profil étudiant introuvable. Contactez l’administration."
      : null;

  const canDeclare =
    nextInstallment.status === "due" ||
    nextInstallment.status === "overdue" ||
    nextInstallment.status === "rejected";

  const openDeclare = () => {
    setIncludeFuturePack(false);
    setDeclaredAmount(String(nextInstallment.amount));
    setOperationDate("");
    setAccountHint("");
    setNote("");
    setAttachment({ kind: "pdf", url: "", file: null });
    setFormError(null);
    setDeclareOpen(true);
  };

  const resetDeclareForm = () => {
    setIncludeFuturePack(false);
    setAttachment({ kind: "pdf", url: "", file: null });
    setNote("");
    setDeclaredAmount(String(nextInstallment.amount));
    setOperationDate("");
    setAccountHint("");
    setFormError(null);
  };

  const flexibleQuote = useMemo(() => {
    const currency =
      nextInstallment.currency === "EUR" || nextInstallment.currency === "MAD"
        ? nextInstallment.currency
        : "MAD";
    const currentMonth =
      /^\d{4}-\d{2}$/.test(nextInstallment.period) ? nextInstallment.period : currentMonthKey();
    return quoteFlexibleBillingPack({
      currency,
      currentMonth,
      includeFuturePack,
    });
  }, [includeFuturePack, nextInstallment.currency, nextInstallment.period]);

  const handleSubmitProof = async () => {
    if (!studentId) {
      setFormError("Profil étudiant introuvable. Contactez l’administration.");
      return;
    }
    if (!nextInstallment.period || nextInstallment.period === "—") {
      setFormError("Aucune échéance disponible. Contactez l’administration.");
      return;
    }
    if (!attachment.file) {
      setFormError("Joignez un justificatif PDF, JPEG ou PNG.");
      return;
    }
    if (!accountHint.trim()) {
      setFormError("Indiquez les informations permettant d’identifier le compte du virement.");
      return;
    }
    setFormError(null);
    setEnsuringPayment(true);
    try {
      let paymentId = nextInstallment.paymentId;
      if (includeFuturePack || !paymentId) {
        const ensured = await PaymentService.ensureFlexibleBilling({
          includeFuturePack,
          currency: flexibleQuote.currency,
        });
        paymentId = ensured.current_payment_id;
      }
      if (!paymentId) {
        paymentId = await PaymentService.ensureMySubscriptionPayment(nextInstallment.period);
      }
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
            operationReference: accountHint.trim(),
            studentNote: note || null,
            paymentMethod: "bank_transfer",
          },
          {
            onSuccess: () => {
              toast.success(
                includeFuturePack
                  ? "Justificatif envoyé — mois courant + pack 3 mois créés (vérification 48 h)"
                  : "Justificatif envoyé — vérification sous 48 h",
              );
              resetDeclareForm();
              setDeclareOpen(false);
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
      const message =
        err instanceof Error && /PERIOD_OVERLAP/i.test(err.message)
          ? "Période déjà payée ou en cours — aucun chevauchement autorisé."
          : mapped.message;
      setFormError(message);
      toast.error(message);
    } finally {
      setEnsuringPayment(false);
    }
  };

  const openProofDoc = async (
    title: string,
    mime: string | null | undefined,
    getUrl: () => Promise<string>,
  ) => {
    setPreview({ title, url: null, mimeType: mime ?? null, loading: true, error: null });
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
    (!attachment.file
      ? "Joignez un justificatif PDF, JPEG ou PNG."
      : !operationDate
        ? "La date du virement est obligatoire."
        : !accountHint.trim()
          ? "Indiquez comment identifier le compte du virement."
          : !Number.isFinite(Number(declaredAmount)) || Number(declaredAmount) <= 0
            ? "Le montant versé doit être supérieur à zéro."
            : null);

  return (
    <>
      <PageHeader
        eyebrow="Facturation"
        title="Paiements"
        subtitle="Votre abonnement, la prochaine échéance et l’historique — simplement."
      />

      {accessBlocked ? (
        <Surface className="mb-6 border-destructive/30 bg-alert-soft p-5">
          <h2 className="font-semibold">Accès académique restreint</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Régularisez votre échéance pour retrouver l’accès aux cours. Vous pouvez toujours
            déclarer un paiement ici.
          </p>
        </Surface>
      ) : (
        <Surface className="mb-6 border-border bg-success-soft/40 p-5">
          <h2 className="font-semibold">Accès académique actif</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre abonnement est à jour. La prochaine échéance apparaît ci-dessous.
          </p>
        </Surface>
      )}

      <div className="space-y-6">
        <section>
          <SectionHeader
            title="Mon abonnement"
            description="Formule commerciale fixe — sans conversion de devise."
          />
          <Surface className="p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Formule
                </p>
                <p className="mt-1 text-lg font-semibold">{billingPlanLabel(billing.plan)}</p>
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Devise
                </p>
                <p className="mt-1 text-lg font-semibold">{billing.currency}</p>
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Tarif
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {formatMoneyAmount(billing.amount, billing.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Statut
                </p>
                <p className="mt-2">
                  <Status
                    tone={
                      accessBlocked
                        ? "red"
                        : subscriptionQuery.data?.status === "past_due"
                          ? "amber"
                          : "green"
                    }
                  >
                    {accessBlocked
                      ? "Accès restreint"
                      : subscriptionQuery.data?.status === "past_due"
                        ? "En retard"
                        : "Actif"}
                  </Status>
                </p>
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Prochaine échéance
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {billingPeriodLabel(nextInstallment.period, nextInstallment.plan)}
                </p>
              </div>
            </div>
            {billing.pendingEffectivePeriod && billing.pendingPlan ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Changement prévu : {billingPlanLabel(billing.pendingPlan)} ·{" "}
                {billing.pendingCurrency ?? billing.currency} à partir de{" "}
                {billingPeriodLabel(billing.pendingEffectivePeriod, billing.pendingPlan)}.
              </p>
            ) : null}
          </Surface>
        </section>

        <section>
          <SectionHeader
            title="Prochaine échéance"
            description="Une seule action principale : déclarer votre paiement."
          />
          <Surface className="p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Période</p>
                  <p className="mt-1 font-semibold">
                    {billingPeriodLabel(nextInstallment.period, nextInstallment.plan)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Montant attendu</p>
                  <p className="mt-1 font-semibold">
                    {formatMoneyAmount(nextInstallment.amount, nextInstallment.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Date limite</p>
                  <p className="mt-1 font-semibold">
                    {nextInstallment.dueDate
                      ? new Date(`${nextInstallment.dueDate}T12:00:00`).toLocaleDateString("fr-FR")
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Statut</p>
                  <p className="mt-2">
                    <Status tone={installmentUxTone(nextInstallment.status)}>
                      {installmentUxLabel(nextInstallment.status)}
                    </Status>
                  </p>
                </div>
              </div>
              {canDeclare ? (
                <Button size="lg" className="w-full shrink-0 lg:w-auto" onClick={openDeclare}>
                  Déclarer mon paiement
                </Button>
              ) : nextInstallment.status === "pending_review" ? (
                <p className="text-sm text-muted-foreground">
                  Justificatif en cours de vérification (48 h).
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Échéance déjà validée.</p>
              )}
            </div>
          </Surface>
        </section>

        <section>
          <SectionHeader title="Historique" description="Périodes, montants et justificatifs." />
          <FilterBar className="mb-4">
            {(
              [
                ["all", "Tous"],
                ["due", "À régler"],
                ["pending", "En attente"],
                ["validated", "Validés"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={historyFilter === value ? "default" : "outline"}
                onClick={() => setHistoryFilter(value)}
              >
                {label}
              </Button>
            ))}
          </FilterBar>

          <QueryState
            isLoading={studentsQuery.isLoading || paymentsQuery.isLoading}
            isError={studentsQuery.isError || paymentsQuery.isError}
            error={(studentsQuery.error ?? paymentsQuery.error) as Error | null}
            isEmpty={historyRows.length === 0}
            emptyTitle="Aucun paiement"
            emptyMessage="Votre historique apparaîtra après la première échéance."
            onRetry={() => void paymentsQuery.refetch()}
          >
            <div className="space-y-3 md:hidden">
              {historyRows.map(({ payment, proof, status }) => {
                const summary = summarizePaymentRow(payment);
                return (
                  <Surface key={payment.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{summary.periodLabel}</p>
                        <p className="text-sm text-muted-foreground">
                          {summary.expected} · {summary.planLabel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payment.payment_date ||
                            payment.due_date ||
                            payment.created_at.slice(0, 10)}
                        </p>
                      </div>
                      <Status tone={installmentUxTone(status)}>{installmentUxLabel(status)}</Status>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {proof ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            void openProofDoc(
                              `Justificatif · ${summary.periodLabel}`,
                              proof.mime_type,
                              () => PaymentProofService.getSignedUrl(proof),
                            )
                          }
                        >
                          Justificatif
                        </Button>
                      ) : null}
                      {proof?.admin_receipt_path || payment.admin_receipt_path ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            void (async () => {
                              try {
                                if (proof?.admin_receipt_path) {
                                  const url =
                                    await PaymentProofService.getAdminReceiptSignedUrl(proof);
                                  await forceDownloadUrl(url, `recu-${payment.id}`);
                                  return;
                                }
                                const url = await PaymentService.getAdminReceiptSignedUrl(payment);
                                await forceDownloadUrl(url, `recu-${payment.id}`);
                              } catch (err) {
                                toast.error(
                                  err instanceof Error ? err.message : "Téléchargement impossible",
                                );
                              }
                            })();
                          }}
                        >
                          Reçu
                        </Button>
                      ) : null}
                    </div>
                  </Surface>
                );
              })}
            </div>

            <Surface className="table-scroll hidden md:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Période</th>
                    <th>Montant</th>
                    <th>Devise</th>
                    <th>Date</th>
                    <th>Statut</th>
                    <th>Documents</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map(({ payment, proof, status }) => {
                    const summary = summarizePaymentRow(payment);
                    return (
                      <tr key={payment.id}>
                        <td className="font-medium">{summary.periodLabel}</td>
                        <td>{summary.expected}</td>
                        <td>{summary.currency}</td>
                        <td>
                          {payment.payment_date ||
                            payment.due_date ||
                            payment.created_at.slice(0, 10)}
                        </td>
                        <td>
                          <Status tone={installmentUxTone(status)}>
                            {installmentUxLabel(status)}
                          </Status>
                        </td>
                        <td className="space-x-1 whitespace-nowrap">
                          {proof ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                void openProofDoc(
                                  `Justificatif · ${summary.periodLabel}`,
                                  proof.mime_type,
                                  () => PaymentProofService.getSignedUrl(proof),
                                )
                              }
                            >
                              Justificatif
                            </Button>
                          ) : (
                            "—"
                          )}
                          {proof?.admin_receipt_path || payment.admin_receipt_path ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                void (async () => {
                                  try {
                                    if (proof?.admin_receipt_path) {
                                      const url =
                                        await PaymentProofService.getAdminReceiptSignedUrl(proof);
                                      await forceDownloadUrl(url, `recu-${payment.id}`);
                                      return;
                                    }
                                    const url =
                                      await PaymentService.getAdminReceiptSignedUrl(payment);
                                    await forceDownloadUrl(url, `recu-${payment.id}`);
                                  } catch (err) {
                                    toast.error(
                                      err instanceof Error
                                        ? err.message
                                        : "Téléchargement impossible",
                                    );
                                  }
                                })();
                              }}
                            >
                              Reçu
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
        </section>
      </div>

      <Dialog open={declareOpen} onOpenChange={setDeclareOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Déclarer mon paiement</DialogTitle>
            <DialogDescription>
              Les informations d’abonnement sont préremplies. Joignez uniquement le justificatif du
              virement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-lg border border-border/80 bg-muted/40 p-3 text-sm">
            <p>
              <span className="text-muted-foreground">Échéance · </span>
              {billingPeriodLabel(nextInstallment.period, nextInstallment.plan)}
            </p>
            <p>
              <span className="text-muted-foreground">Formule · </span>
              {billingPlanLabel(String(nextInstallment.plan))}
            </p>
            <p>
              <span className="text-muted-foreground">Devise · </span>
              {flexibleQuote.currency}
            </p>
            <p>
              <span className="text-muted-foreground">Mensuel catalogue · </span>
              {formatMoneyAmount(flexibleQuote.monthlyTariff, flexibleQuote.currency)}
            </p>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={includeFuturePack}
                disabled={formBusy}
                onChange={(e) => {
                  const next = e.target.checked;
                  setIncludeFuturePack(next);
                  const quote = quoteFlexibleBillingPack({
                    currency: flexibleQuote.currency,
                    currentMonth: flexibleQuote.currentMonth,
                    includeFuturePack: next,
                  });
                  setDeclaredAmount(String(quote.totalAmount));
                }}
              />
              <span>
                Ajouter 3 mois futurs consécutifs au tarif trimestriel (
                {formatMoneyAmount(flexibleQuote.quarterlyTariff, flexibleQuote.currency)}
                {flexibleQuote.futureMonths.length
                  ? ` · ${flexibleQuote.futureMonths.join(", ")}`
                  : ""}
                ). Sans chevauchement avec les périodes déjà validées.
              </span>
            </label>
            <p>
              <span className="text-muted-foreground">Total attendu · </span>
              {formatMoneyAmount(flexibleQuote.totalAmount, flexibleQuote.currency)}
            </p>
          </div>

          <div className="space-y-3">
            {identityHint ? <p className="text-sm text-destructive">{identityHint}</p> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                Montant versé ({nextInstallment.currency})
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
                Date du virement
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
              Identification du compte (nom / référence / IBAN partiel)
              <Input
                value={accountHint}
                onChange={(event) => setAccountHint(event.target.value)}
                className="mt-1"
                disabled={formBusy}
                placeholder="Ex. Ahmed B. · fin 4521"
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
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={formBusy} onClick={() => setDeclareOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={Boolean(blockReason) || formBusy}
              onClick={() => void handleSubmitProof()}
            >
              {formBusy ? "Envoi…" : "Envoyer le justificatif"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
