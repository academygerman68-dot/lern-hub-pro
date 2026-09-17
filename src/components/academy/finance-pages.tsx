import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useAcademicAccess,
  useCreatePayment,
  useMarkPaymentOverdue,
  usePaymentProofs,
  usePayments,
  usePendingPaymentProofs,
  useReviewPaymentProof,
  useStudents,
  useSubmitPaymentProof,
  useSubscriptions,
} from "@/hooks/use-academy-data";
import { PaymentProofService } from "@/services/academy-services";
import { useAcademy } from "./academy-context";
import { DocumentViewer } from "./document-viewer";
import { QueryState } from "./query-state";
import { Metric, PageHeader, Status, Surface } from "./primitives";

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

function proofStatusLabel(status: string) {
  if (status === "pending") return "En attente";
  if (status === "approved" || status === "paid") return "Confirmé";
  if (status === "rejected") return "Refusé";
  if (status === "partial") return "Partiel";
  if (status === "overdue") return "En retard";
  if (status === "cancelled") return "Annulé";
  return status;
}

function ProofReviewQueue() {
  const pendingQuery = usePendingPaymentProofs();
  const review = useReviewPaymentProof();
  const [preview, setPreview] = useState<{
    title: string;
    url: string | null;
    mimeType: string | null;
    loading: boolean;
    error: string | null;
  } | null>(null);

  return (
    <>
      <Surface className="mb-6 p-5">
        <h2 className="font-semibold">File des justificatifs</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Avis d’opération déposés par les étudiants. L’accès reste bloqué jusqu’à validation.
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
              <div
                key={proof.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium">{studentLabel(proof)}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(proof.created_at).toLocaleString("fr-FR")}
                    {proof.student_note ? ` · ${proof.student_note}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Déclaré : {Number(proof.declared_amount).toLocaleString()}{" "}
                    {proof.payment?.currency ?? "MAD"}
                    {proof.payment
                      ? ` · attendu : ${Number(proof.payment.amount).toLocaleString()} ${proof.payment.currency}`
                      : ""}
                    {` · opération du ${proof.operation_date}`}
                    {proof.operation_reference ? ` · réf. ${proof.operation_reference}` : ""}
                  </p>
                  <Status tone="amber">{proofStatusLabel(proof.status)}</Status>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
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
                    }}
                  >
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
                          onSuccess: () => toast.success("Justificatif confirmé · accès rétabli"),
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
                          onSuccess: () => toast.message("Justificatif refusé"),
                          onError: (err) => toast.error(err.message),
                        },
                      );
                    }}
                  >
                    Refuser
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </QueryState>
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
    </>
  );
}

export function FinancePages({ mode }: { mode: string }) {
  const paymentsQuery = usePayments();
  const subscriptionsQuery = useSubscriptions();
  const studentsQuery = useStudents();
  const createPayment = useCreatePayment();
  const markOverdue = useMarkPaymentOverdue();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [amount, setAmount] = useState("1200");
  const [dueDate, setDueDate] = useState("");

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

  const counts = useMemo(() => {
    const rows = paymentsQuery.data ?? [];
    return {
      paid: rows.filter((r) => r.status === "paid").length,
      pending: rows.filter((r) => r.status === "pending" || r.status === "partial").length,
      overdue: rows.filter((r) => r.status === "overdue").length,
      total: rows.reduce((acc, r) => acc + Number(r.amount), 0),
    };
  }, [paymentsQuery.data]);

  if (mode === "subscriptions") {
    return (
      <>
        <PageHeader
          title="Abonnements"
          subtitle="Statut des abonnements étudiants depuis Supabase."
        />
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
        <Metric label="Montant total" value={`${counts.total.toLocaleString()} MAD`} />
        <Metric label="Confirmés" value={String(counts.paid)} />
        <Metric label="En attente" value={String(counts.pending)} />
        <Metric label="En retard" value={String(counts.overdue)} />
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
          <option value="paid">Confirmé</option>
          <option value="overdue">En retard</option>
          <option value="cancelled">Annulé</option>
        </select>
      </div>

      <QueryState
        isLoading={paymentsQuery.isLoading}
        isError={paymentsQuery.isError}
        error={paymentsQuery.error}
        isEmpty={filtered.length === 0}
        emptyTitle="No payments yet"
        emptyMessage="Record a payment for a student to start the subscription workflow."
        onRetry={() => void paymentsQuery.refetch()}
      >
        <div className="space-y-3 md:hidden">
          {filtered.map((row) => (
            <Surface key={row.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{studentLabel(row)}</p>
                  <p className="text-sm text-muted-foreground">
                    {Number(row.amount).toLocaleString()} {row.currency}
                  </p>
                </div>
                <Status tone={paymentTone(row.status)}>{row.status}</Status>
              </div>
              <p className="text-xs text-muted-foreground">
                Due {row.due_date ?? "—"}
                {row.payment_method ? ` · ${row.payment_method}` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
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
          ))}
        </div>
        <Surface className="table-scroll hidden md:block">
          <table className="data-table">
            <thead>
              <tr>
                <th>Étudiant</th>
                <th>Montant</th>
                <th>Échéance</th>
                <th>Payé le</th>
                <th>Méthode</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium">{studentLabel(row)}</td>
                  <td>
                    {Number(row.amount).toLocaleString()} {row.currency}
                  </td>
                  <td>{row.due_date ?? "—"}</td>
                  <td>{row.payment_date ?? "—"}</td>
                  <td>{row.payment_method ?? "—"}</td>
                  <td>
                    <Status tone={paymentTone(row.status)}>{proofStatusLabel(row.status)}</Status>
                  </td>
                  <td className="space-x-1 whitespace-nowrap">
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
              ))}
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
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Montant"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button
                disabled={!studentId || !amount || createPayment.isPending}
                onClick={() => {
                  createPayment.mutate(
                    {
                      studentId,
                      amount: Number(amount),
                      currency: "MAD",
                      dueDate: dueDate || null,
                      paymentMethod: "cash",
                      status: "pending",
                    },
                    {
                      onSuccess: () => {
                        toast.success("Paiement enregistré");
                        setCreateOpen(false);
                        setStudentId("");
                        setAmount("1200");
                        setDueDate("");
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
    </>
  );
}

export function StudentPaymentsPage() {
  const { user } = useAcademy();
  const studentsQuery = useStudents();
  const accessQuery = useAcademicAccess();
  const myStudent = (studentsQuery.data ?? []).find(
    (s) => s.email.toLowerCase() === (user?.email ?? "").toLowerCase(),
  );
  const paymentsQuery = usePayments(myStudent?.id);
  const proofsQuery = usePaymentProofs(myStudent?.id);
  const submitProof = useSubmitPaymentProof();
  const eligiblePayments = (paymentsQuery.data ?? []).filter((payment) =>
    ["pending", "partial", "overdue"].includes(payment.status),
  );
  const [paymentId, setPaymentId] = useState("");
  const selectedPayment = eligiblePayments.find((payment) => payment.id === paymentId);
  const [declaredAmount, setDeclaredAmount] = useState("");
  const [operationDate, setOperationDate] = useState("");
  const [operationReference, setOperationReference] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const accessBlocked = accessQuery.data === false;

  return (
    <>
      <PageHeader title="Votre programme" subtitle="Abonnement, paiements et avis d’opération." />
      {accessBlocked && (
        <Surface className="mb-6 border-destructive/30 bg-alert-soft p-6">
          <h2 className="font-semibold">Accès académique restreint</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Votre abonnement est inactif. Vous pouvez consulter les paiements, déposer un
            justificatif, gérer le profil et l’assistance. Les cours restent bloqués jusqu’à
            validation administrative.
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
        <h2 className="font-semibold">Déposer un avis d’opération</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF, JPEG ou PNG · max 10 Mo. L’accès reste bloqué jusqu’à approbation administrative.
        </p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            Échéance concernée
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={paymentId}
              onChange={(event) => {
                const nextId = event.target.value;
                const payment = eligiblePayments.find((item) => item.id === nextId);
                setPaymentId(nextId);
                setDeclaredAmount(payment ? String(payment.amount) : "");
              }}
            >
              <option value="">Sélectionner un paiement à régler</option>
              {eligiblePayments.map((payment) => (
                <option key={payment.id} value={payment.id}>
                  {Number(payment.amount).toLocaleString()} {payment.currency} · échéance{" "}
                  {payment.due_date ?? "non définie"}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              Montant versé
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={declaredAmount}
                onChange={(event) => setDeclaredAmount(event.target.value)}
                className="mt-1"
              />
            </label>
            <label className="block text-sm">
              Date de l’opération
              <Input
                type="date"
                value={operationDate}
                onChange={(event) => setOperationDate(event.target.value)}
                className="mt-1"
              />
            </label>
          </div>
          <label className="block text-sm">
            Référence de l’opération (optionnel)
            <Input
              value={operationReference}
              onChange={(event) => setOperationReference(event.target.value)}
              className="mt-1"
            />
          </label>
          <label className="block text-sm">
            Fichier
            <Input
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="mt-1"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <label className="block text-sm">
            Note (optionnel)
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" />
          </label>
          <Button
            disabled={
              !myStudent?.id ||
              !selectedPayment ||
              !file ||
              !operationDate ||
              Number(declaredAmount) <= 0 ||
              submitProof.isPending
            }
            onClick={() => {
              if (!myStudent?.id || !file || !selectedPayment) return;
              submitProof.mutate(
                {
                  studentId: myStudent.id,
                  file,
                  paymentId: selectedPayment.id,
                  declaredAmount: Number(declaredAmount),
                  operationDate,
                  operationReference: operationReference || null,
                  studentNote: note || null,
                },
                {
                  onSuccess: () => {
                    toast.success("Justificatif déposé — en attente de validation");
                    setFile(null);
                    setNote("");
                    setPaymentId("");
                    setDeclaredAmount("");
                    setOperationDate("");
                    setOperationReference("");
                  },
                  onError: (err) => toast.error(err.message),
                },
              );
            }}
          >
            Envoyer le justificatif
          </Button>
        </div>
        {(proofsQuery.data?.length ?? 0) > 0 && (
          <div className="mt-6 divide-y border-t">
            {proofsQuery.data?.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-medium">
                    {p.created_at.slice(0, 16).replace("T", " ")}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.student_note || "Sans note"}</p>
                  <p className="text-xs text-muted-foreground">
                    {Number(p.declared_amount).toLocaleString()} {p.payment?.currency ?? "MAD"} ·{" "}
                    {p.operation_date}
                  </p>
                </div>
                <Status tone={paymentTone(p.status)}>{proofStatusLabel(p.status)}</Status>
              </div>
            ))}
          </div>
        )}
      </Surface>

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
          {paymentsQuery.data?.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div>
                <p className="font-medium">
                  {Number(row.amount).toLocaleString()} {row.currency}
                </p>
                <p className="text-sm text-muted-foreground">
                  Échéance {row.due_date ?? "—"}
                  {row.reference ? ` · ${row.reference}` : ""}
                </p>
              </div>
              <Status tone={paymentTone(row.status)}>{row.status}</Status>
            </div>
          ))}
        </Surface>
      </QueryState>
    </>
  );
}
