import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { SettingsService } from "@/services/supabase/settings-service";
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
import {
  type BillingPlan,
  billingPeriodLabel,
  billingPeriodMonths,
  billingPlanLabel,
  formatMoneyAmount,
  listCandidateStartMonths,
  parseBillingTariffSettings,
  quoteBillingDeclaration,
} from "@/lib/subscription-plans";
import { queryKeys } from "@/lib/query-keys";
import { useAcademy } from "./academy-context";
import { ContentAttachmentUploader, type AttachmentDraft } from "./content-attachment-uploader";
import { DocumentViewer } from "./document-viewer";
import { QueryState } from "./query-state";
import { FilterBar, PageHeader, SectionHeader, Status, Surface } from "./primitives";

function currentMonthKey(from = new Date()) {
  return `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`;
}

function monthOptionLabel(monthKey: string) {
  return billingPeriodLabel(monthKey, "monthly");
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
  // Must share BrandingProvider's getMap cache — listPublic([]) shape collided and crashed.
  const settingsQuery = useQuery({
    queryKey: queryKeys.branding.settings,
    queryFn: () => SettingsService.getMap(),
  });
  const tariffs = useMemo(
    () => parseBillingTariffSettings(settingsQuery.data),
    [settingsQuery.data],
  );

  const [declareOpen, setDeclareOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<InstallmentUxFilter>("all");
  const [declaredAmount, setDeclaredAmount] = useState("");
  const [operationDate, setOperationDate] = useState("");
  const [accountHint, setAccountHint] = useState("");
  const [note, setNote] = useState("");
  const [declarePlan, setDeclarePlan] = useState<BillingPlan>("monthly");
  const [startMonth, setStartMonth] = useState(currentMonthKey());
  const [serverQuote, setServerQuote] = useState<Awaited<
    ReturnType<typeof PaymentService.quoteBillingDeclaration>
  > | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [attachment, setAttachment] = useState<AttachmentDraft>({
    kind: "pdf",
    url: "",
    file: null,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [ensuringPayment, setEnsuringPayment] = useState(false);
  const [preview, setPreview] = useState<DocPreview | null>(null);

  const accessBlocked = accessQuery.data === false;
  const billing = resolveActiveBillingFromSubscription(subscriptionQuery.data, tariffs);
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
      tariffs,
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
  }, [payments, proofs, billing.plan, billing.currency, tariffs]);

  const historyRows = useMemo(() => {
    return payments
      .map((payment) => {
        const proof = latestProofForPayment(proofs, payment.id);
        const status = resolveInstallmentUxStatus(payment, proof);
        return { payment, proof, status };
      })
      .filter((row) => matchesInstallmentFilter(row.status, historyFilter))
      .sort((a, b) => {
        const aKey = a.payment.billing_period ?? a.payment.due_date ?? a.payment.created_at ?? "";
        const bKey = b.payment.billing_period ?? b.payment.due_date ?? b.payment.created_at ?? "";
        return bKey.localeCompare(aKey);
      });
  }, [payments, proofs, historyFilter]);

  const identityHint =
    !studentsQuery.isLoading && !paymentsQuery.isLoading && !studentId
      ? "Profil étudiant introuvable. Contactez l’administration."
      : null;

  const occupiedMonths = useMemo(() => {
    const set = new Set<string>();
    for (const payment of payments) {
      for (const month of billingPeriodMonths(payment.billing_period)) {
        if (["pending", "partial", "overdue", "paid"].includes(payment.status)) {
          set.add(month);
        }
      }
    }
    return [...set].sort();
  }, [payments]);

  const localQuote = useMemo(() => {
    const currency =
      billing.currency === "EUR" || billing.currency === "MAD" ? billing.currency : "MAD";
    return quoteBillingDeclaration({
      plan: declarePlan,
      currency,
      startMonth,
      tariffs,
      occupiedMonths,
    });
  }, [declarePlan, startMonth, billing.currency, tariffs, occupiedMonths]);

  const effectiveQuote = serverQuote
    ? {
        plan: serverQuote.plan,
        currency: (serverQuote.currency === "EUR" || serverQuote.currency === "MAD"
          ? serverQuote.currency
          : "MAD") as "MAD" | "EUR",
        startMonth: serverQuote.startMonth,
        coveredMonths: serverQuote.coveredMonths,
        billingPeriod: serverQuote.billingPeriod,
        expectedAmount: serverQuote.expectedAmount,
        monthlyTariff: serverQuote.monthlyTariff,
        quarterlyTariff: serverQuote.quarterlyTariff,
        available: serverQuote.available,
        conflictMonths: serverQuote.conflictMonths,
        firstEligibleStart: serverQuote.firstEligibleStart,
      }
    : localQuote;

  const startMonthOptions = useMemo(() => listCandidateStartMonths(14), []);

  useEffect(() => {
    if (!declareOpen) return;
    let cancelled = false;
    setQuoteLoading(true);
    void PaymentService.quoteBillingDeclaration({
      plan: declarePlan,
      currency: billing.currency,
      startMonth,
    })
      .then((quote) => {
        if (cancelled) return;
        setServerQuote(quote);
        setDeclaredAmount(String(quote.expectedAmount));
        if (!quote.available && quote.firstEligibleStart && quote.firstEligibleStart !== startMonth) {
          setFormError(
            `Mois de départ indisponible (${quote.conflictMonths.join(", ") || "chevauchement"}). Premier mois éligible : ${monthOptionLabel(quote.firstEligibleStart)}.`,
          );
        } else {
          setFormError(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setServerQuote(null);
        setDeclaredAmount(String(localQuote.expectedAmount));
        setFormError(err instanceof Error ? err.message : "Devis serveur indisponible.");
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [declareOpen, declarePlan, startMonth, billing.currency, localQuote.expectedAmount]);

  const canDeclare = !identityHint;

  const openDeclare = () => {
    setDeclarePlan("monthly");
    setStartMonth(currentMonthKey());
    setServerQuote(null);
    setDeclaredAmount("");
    setOperationDate("");
    setAccountHint("");
    setNote("");
    setAttachment({ kind: "pdf", url: "", file: null });
    setFormError(null);
    setDeclareOpen(true);
  };

  const resetDeclareForm = () => {
    setDeclarePlan("monthly");
    setStartMonth(currentMonthKey());
    setServerQuote(null);
    setAttachment({ kind: "pdf", url: "", file: null });
    setNote("");
    setDeclaredAmount("");
    setOperationDate("");
    setAccountHint("");
    setFormError(null);
  };

  const handleSubmitProof = async () => {
    if (!studentId) {
      setFormError("Profil étudiant introuvable. Contactez l’administration.");
      return;
    }
    if (!effectiveQuote.available) {
      const eligible = effectiveQuote.firstEligibleStart;
      setFormError(
        eligible
          ? `Période indisponible. Choisissez ${monthOptionLabel(eligible)}.`
          : "Aucun mois éligible pour cette formule.",
      );
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
      const ensured = await PaymentService.ensureBillingDeclaration({
        plan: declarePlan,
        startMonth,
        currency: billing.currency,
      });
      const paymentId = ensured.paymentId;
      const expected = Number(
        (ensured.quote as { expected_amount?: number })?.expected_amount ??
          effectiveQuote.expectedAmount,
      );
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
      const declared = Number(declaredAmount);
      if (Number.isFinite(expected) && Number.isFinite(declared) && Math.abs(declared - expected) > 0.009) {
        // Keep submitting — admin reviews amount mismatch via declared vs expected.
        toast.message(
          `Montant déclaré (${declared}) différent du prix attendu (${expected}). L’administration vérifiera l’écart.`,
        );
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
                declarePlan === "quarterly"
                  ? "Justificatif envoyé — trimestre en vérification (48 h)"
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
          ? err.message.replace(/^PERIOD_OVERLAP:\s*/i, "") ||
            "Période déjà payée ou réservée — chevauchement interdit."
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
                  Déclarer un paiement
                </Button>
              ) : (
                <p className="text-sm text-destructive">{identityHint}</p>
              )}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Choisissez une formule mensuelle ou trimestrielle et un mois de départ. Les formules
              sont exclusives (jamais cumulées).
            </p>
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
                          {billingPeriodMonths(payment.billing_period).length > 1
                            ? ` · ${billingPeriodMonths(payment.billing_period).length} mois`
                            : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payment.payment_date ||
                            payment.due_date ||
                            payment.created_at?.slice(0, 10) ||
                            "—"}
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
                            payment.created_at?.slice(0, 10) ||
                            "—"}
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
              Choisissez une formule (mensuelle ou trimestrielle), le mois de départ, puis joignez le
              justificatif. Le prix est calculé côté serveur.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">1. Formule</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["monthly", "Mensuelle", effectiveQuote.monthlyTariff],
                    ["quarterly", "Trimestrielle", effectiveQuote.quarterlyTariff],
                  ] as const
                ).map(([plan, label, amount]) => (
                  <button
                    key={plan}
                    type="button"
                    disabled={formBusy}
                    onClick={() => setDeclarePlan(plan)}
                    className={`rounded-lg border p-3 text-left transition ${
                      declarePlan === plan
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <p className="font-semibold">{label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatMoneyAmount(amount, billing.currency)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {plan === "monthly"
                        ? "Couvre uniquement le mois choisi"
                        : "Couvre le mois choisi + les 2 suivants"}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-sm">
              2. Mois de départ
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={startMonth}
                disabled={formBusy || quoteLoading}
                onChange={(e) => setStartMonth(e.target.value)}
              >
                {startMonthOptions.map((month) => (
                  <option key={month} value={month}>
                    {monthOptionLabel(month)}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-1 rounded-lg border border-border/80 bg-muted/40 p-3 text-sm">
              <p className="font-medium">3. Aperçu</p>
              {quoteLoading ? (
                <p className="text-muted-foreground">Calcul du devis…</p>
              ) : (
                <>
                  <p>
                    <span className="text-muted-foreground">Mois couverts · </span>
                    {effectiveQuote.coveredMonths.map(monthOptionLabel).join(", ") || "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Période · </span>
                    {billingPeriodLabel(effectiveQuote.billingPeriod, declarePlan)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Prix attendu · </span>
                    {formatMoneyAmount(effectiveQuote.expectedAmount, effectiveQuote.currency)}
                  </p>
                  {!effectiveQuote.available ? (
                    <p className="text-destructive">
                      Indisponible
                      {effectiveQuote.conflictMonths.length
                        ? ` (conflit : ${effectiveQuote.conflictMonths.join(", ")})`
                        : ""}
                      {effectiveQuote.firstEligibleStart
                        ? ` — premier mois éligible : ${monthOptionLabel(effectiveQuote.firstEligibleStart)}`
                        : ""}
                      .
                    </p>
                  ) : (
                    <p className="text-muted-foreground">Période confirmée, sans chevauchement.</p>
                  )}
                </>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">4. Justificatif</p>
              {identityHint ? <p className="mb-2 text-sm text-destructive">{identityHint}</p> : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  Montant versé ({billing.currency})
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
              <label className="mt-3 block text-sm">
                Identification du compte (nom / référence / IBAN partiel)
                <Input
                  value={accountHint}
                  onChange={(event) => setAccountHint(event.target.value)}
                  className="mt-1"
                  disabled={formBusy}
                  placeholder="Ex. Ahmed B. · fin 4521"
                />
              </label>
              <div className="mt-3">
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
              </div>
              <label className="mt-3 block text-sm">
                Note (optionnel)
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1"
                  disabled={formBusy}
                />
              </label>
            </div>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            {blockReason && !formError && !formBusy ? (
              <p className="text-sm text-muted-foreground">{blockReason}</p>
            ) : null}
            {!effectiveQuote.available && effectiveQuote.firstEligibleStart ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={formBusy}
                onClick={() => setStartMonth(effectiveQuote.firstEligibleStart!)}
              >
                Utiliser {monthOptionLabel(effectiveQuote.firstEligibleStart)}
              </Button>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" disabled={formBusy} onClick={() => setDeclareOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={
                Boolean(blockReason) ||
                formBusy ||
                quoteLoading ||
                !effectiveQuote.available
              }
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
