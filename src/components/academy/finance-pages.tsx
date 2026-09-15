import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCreatePayment,
  useMarkPaymentOverdue,
  useMarkPaymentPaid,
  usePayments,
  useStudents,
  useSubscriptions,
} from "@/hooks/use-academy-data";
import { useAcademy } from "./academy-context";
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
  if (status === "paid") return "green";
  if (status === "pending" || status === "partial") return "amber";
  return "red";
}

export function FinancePages({ mode }: { mode: string }) {
  const paymentsQuery = usePayments();
  const subscriptionsQuery = useSubscriptions();
  const studentsQuery = useStudents();
  const createPayment = useCreatePayment();
  const markPaid = useMarkPaymentPaid();
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
        <PageHeader title="Subscriptions" subtitle="Student subscription status from Supabase." />
        <QueryState
          isLoading={subscriptionsQuery.isLoading}
          isError={subscriptionsQuery.isError}
          error={subscriptionsQuery.error}
          isEmpty={!subscriptionsQuery.data?.length}
          emptyTitle="No subscriptions"
          emptyMessage="Create a payment and mark it paid to activate a subscription."
          onRetry={() => void subscriptionsQuery.refetch()}
        >
          <Surface className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Starts</th>
                  <th>Expires</th>
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
        title={mode === "invoices" ? "Invoices" : "Payment Management"}
        subtitle="Payments linked to subscriptions and academic access."
        action={<Button onClick={() => setCreateOpen(true)}>+ Record payment</Button>}
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total amount" value={`${counts.total.toLocaleString()} MAD`} />
        <Metric label="Paid" value={String(counts.paid)} />
        <Metric label="Pending" value={String(counts.pending)} />
        <Metric label="Overdue" value={String(counts.overdue)} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search student or reference…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <select
          className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
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
        <Surface className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Amount</th>
                <th>Due</th>
                <th>Paid on</th>
                <th>Method</th>
                <th>Status</th>
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
                    <Status tone={paymentTone(row.status)}>{row.status}</Status>
                  </td>
                  <td className="space-x-1 whitespace-nowrap">
                    {row.status !== "paid" && row.status !== "cancelled" && (
                      <Button
                        size="sm"
                        disabled={markPaid.isPending}
                        onClick={() => {
                          markPaid.mutate(row.id, {
                            onSuccess: () =>
                              toast.success("Payment marked paid · subscription activated"),
                            onError: (err) => toast.error(err.message),
                          });
                        }}
                      >
                        Mark paid
                      </Button>
                    )}
                    {row.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={markOverdue.isPending}
                        onClick={() => {
                          markOverdue.mutate(row.id, {
                            onSuccess: () => toast.success("Marked overdue · access restricted"),
                            onError: (err) => toast.error(err.message),
                          });
                        }}
                      >
                        Mark overdue
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      </QueryState>

      <Surface className="mt-5 p-5">
        <h2 className="font-semibold">Access policy</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-success-soft p-4">
            <Status tone="green">ACTIVE</Status>
            <p className="mt-2 text-sm font-medium">Full academic access</p>
          </div>
          <div className="rounded-md bg-warning-soft p-4">
            <Status tone="amber">PAST DUE</Status>
            <p className="mt-2 text-sm font-medium">Access restricted</p>
          </div>
          <div className="rounded-md bg-alert-soft p-4">
            <Status tone="red">SUSPENDED</Status>
            <p className="mt-2 text-sm font-medium">Learning locked</p>
          </div>
        </div>
      </Surface>

      {createOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
          <Surface className="w-full max-w-lg space-y-4 p-6">
            <h2 className="text-lg font-semibold">Record payment</h2>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            >
              <option value="">Select student</option>
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
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
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
                        toast.success("Payment created");
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
                Create
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
  const myStudent = (studentsQuery.data ?? []).find(
    (s) => s.email.toLowerCase() === (user?.email ?? "").toLowerCase(),
  );
  const paymentsQuery = usePayments(myStudent?.id);
  const accessBlocked =
    myStudent?.subscription === "SUSPENDED" || myStudent?.subscription === "PAST_DUE";

  return (
    <>
      <PageHeader
        title="Your program"
        subtitle="Subscription and payment history from your academy account."
      />
      {accessBlocked && (
        <Surface className="mb-6 border-destructive/30 bg-alert-soft p-6">
          <h2 className="font-semibold">Academic access restricted</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your subscription is {myStudent?.subscription?.toLowerCase()}. You can still view
            payments and profile. Contact administration or wait for a recorded payment to restore
            access.
          </p>
        </Surface>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Surface className="p-5">
          <p className="text-xs text-muted-foreground uppercase">Subscription</p>
          <p className="mt-2 text-2xl font-semibold">{myStudent?.subscription ?? "—"}</p>
        </Surface>
        <Surface className="p-5">
          <p className="text-xs text-muted-foreground uppercase">Payments</p>
          <p className="mt-2 text-2xl font-semibold">{paymentsQuery.data?.length ?? 0}</p>
        </Surface>
      </div>
      <QueryState
        isLoading={studentsQuery.isLoading || paymentsQuery.isLoading}
        isError={studentsQuery.isError || paymentsQuery.isError}
        error={(studentsQuery.error ?? paymentsQuery.error) as Error | null}
        isEmpty={!paymentsQuery.data?.length}
        emptyTitle="No payments yet"
        emptyMessage="When administration records a payment, it will appear here."
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
                  Due {row.due_date ?? "—"}
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
