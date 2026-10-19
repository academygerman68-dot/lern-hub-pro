import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useAdminCreateAccount,
  useAdminDeleteAccount,
  useAdminProfiles,
  useSetProfileRole,
  useSetProfileStatus,
} from "@/hooks/use-academy-data";
import { AuthService } from "@/services/academy-services";
import type { AccountStatus } from "@/types/academy";
import type { Database } from "@/types/database";
import { useAcademy } from "./academy-context";
import { FilterBar, PageHeader, Status, Surface } from "./primitives";
import { QueryState } from "./query-state";

type AppRole = Database["public"]["Enums"]["app_role"];

function roleLabel(role: string) {
  if (role === "admin") return "Administration";
  if (role === "teacher") return "Professeur";
  if (role === "student") return "Étudiant";
  return role;
}

function statusLabel(status: string) {
  if (status === "active") return "Actif";
  if (status === "pending") return "En attente";
  if (status === "restricted") return "Restreint";
  if (status === "suspended") return "Suspendu";
  if (status === "archived") return "Archivé";
  return status;
}

function statusTone(status: string): "green" | "amber" | "red" | "gray" | "blue" {
  if (status === "active") return "green";
  if (status === "pending") return "amber";
  if (status === "restricted") return "blue";
  if (status === "suspended") return "red";
  return "gray";
}

export function AdminAccountsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAcademy();
  const [roleFilter, setRoleFilter] = useState<"all" | AppRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AccountStatus>("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("student");
  const [newPhone, setNewPhone] = useState("");

  const profilesQuery = useAdminProfiles({
    role: roleFilter,
    status: statusFilter,
    search,
  });
  const setStatus = useSetProfileStatus();
  const setRole = useSetProfileRole();
  const createAccount = useAdminCreateAccount();
  const deleteAccount = useAdminDeleteAccount();

  const selected = useMemo(
    () => (profilesQuery.data ?? []).find((row) => row.id === selectedId) ?? null,
    [profilesQuery.data, selectedId],
  );

  const resetCreate = () => {
    setCreateOpen(false);
    setNewEmail("");
    setNewPassword("");
    setNewFirstName("");
    setNewLastName("");
    setNewRole("student");
    setNewPhone("");
  };

  const runStatus = (profileId: string, status: AccountStatus) => {
    setStatus.mutate(
      { profileId, status },
      {
        onSuccess: () => toast.success(`Statut : ${statusLabel(status)}`),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const total = profilesQuery.data?.length ?? 0;

  return (
    <div className="space-y-5">
      {embedded ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Tous les comptes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Étudiants, professeurs et administration — y compris les nouveaux comptes. Changez les
              accès (rôle) et le statut depuis « Gérer ».
            </p>
            {!profilesQuery.isLoading ? (
              <p className="mt-1 text-xs text-muted-foreground">{total} compte{total > 1 ? "s" : ""}</p>
            ) : null}
          </div>
          <Button onClick={() => setCreateOpen(true)}>+ Créer un compte</Button>
        </div>
      ) : (
        <PageHeader
          title="Comptes & accès"
          subtitle="Liste de tous les comptes — rôles, restriction, réinitialisation mot de passe, suppression."
          action={<Button onClick={() => setCreateOpen(true)}>+ Créer un compte</Button>}
        />
      )}

      <FilterBar>
        <Input
          placeholder="Rechercher nom ou e-mail…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as "all" | AppRole)}
        >
          <option value="all">Tous les rôles</option>
          <option value="admin">Administration</option>
          <option value="teacher">Professeurs</option>
          <option value="student">Étudiants</option>
        </select>
        <select
          className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | AccountStatus)}
        >
          <option value="all">Tous les statuts</option>
          <option value="active">Actif</option>
          <option value="pending">En attente</option>
          <option value="restricted">Restreint</option>
          <option value="suspended">Suspendu</option>
          <option value="archived">Archivé</option>
        </select>
      </FilterBar>

      <QueryState
        isLoading={profilesQuery.isLoading}
        isError={profilesQuery.isError}
        error={profilesQuery.error}
        isEmpty={!profilesQuery.data?.length}
        emptyTitle="Aucun compte"
        emptyMessage="Aucun profil ne correspond aux filtres."
        onRetry={() => void profilesQuery.refetch()}
      >
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Compte</th>
                <th className="px-4 py-3 font-medium">E-mail</th>
                <th className="px-4 py-3 font-medium">Téléphone</th>
                <th className="px-4 py-3 font-medium">Rôle / accès</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Langue</th>
                <th className="px-4 py-3 font-medium">Créé</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {(profilesQuery.data ?? []).map((row) => (
                <tr key={row.id} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {row.first_name} {row.last_name}
                      {row.id === user?.id ? (
                        <span className="ml-2 text-xs text-muted-foreground">(vous)</span>
                      ) : null}
                    </p>
                    {row.status === "pending" ? (
                      <p className="text-xs text-amber-700 dark:text-amber-400">Nouveau / à valider</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground" dir="ltr">
                    {row.email || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground" dir="ltr">
                    {row.phone || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="flex h-9 w-full min-w-[9.5rem] rounded-md border border-input bg-background px-2 text-sm"
                      value={row.role}
                      disabled={setRole.isPending || row.id === user?.id}
                      aria-label={`Rôle de ${row.first_name} ${row.last_name}`}
                      onChange={(e) => {
                        const role = e.target.value as AppRole;
                        setRole.mutate(
                          { profileId: row.id, role },
                          {
                            onSuccess: () => toast.success(`Accès : ${roleLabel(role)}`),
                            onError: (err) => toast.error(err.message),
                          },
                        );
                      }}
                    >
                      <option value="student">Étudiant</option>
                      <option value="teacher">Professeur</option>
                      <option value="admin">Administration</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <Status tone={statusTone(row.status)}>{statusLabel(row.status)}</Status>
                  </td>
                  <td className="px-4 py-3 uppercase text-muted-foreground">
                    {row.language || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(row.created_at).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline" onClick={() => setSelectedId(row.id)}>
                      Gérer
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>

      {selected && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel max-h-[90dvh] space-y-4 overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {selected.first_name} {selected.last_name}
                </h2>
                <p className="text-sm text-muted-foreground" dir="ltr">
                  {selected.email}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
                Fermer
              </Button>
            </div>

            <dl className="grid gap-2 text-sm sm:grid-cols-[7rem_1fr]">
              <dt className="text-muted-foreground">Téléphone</dt>
              <dd dir="ltr">{selected.phone || "—"}</dd>
              <dt className="text-muted-foreground">Langue</dt>
              <dd className="uppercase">{selected.language || "—"}</dd>
              <dt className="text-muted-foreground">Créé le</dt>
              <dd>{new Date(selected.created_at).toLocaleString("fr-FR")}</dd>
            </dl>

            <label className="block text-sm">
              Accès (rôle)
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selected.role}
                disabled={setRole.isPending || selected.id === user?.id}
                onChange={(e) => {
                  const role = e.target.value as AppRole;
                  setRole.mutate(
                    { profileId: selected.id, role },
                    {
                      onSuccess: () =>
                        toast.success(
                          `Accès mis à jour : ${roleLabel(role)}. Un étudiant peut devenir professeur ou admin.`,
                        ),
                      onError: (err) => toast.error(err.message),
                    },
                  );
                }}
              >
                <option value="student">Étudiant</option>
                <option value="teacher">Professeur</option>
                <option value="admin">Administration</option>
              </select>
              <span className="mt-1 block text-xs text-muted-foreground">
                Ex. passer un compte étudiant en professeur ou en administration.
              </span>
            </label>

            <div className="space-y-2">
              <p className="text-sm font-medium">Statut du compte</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["active", "Activer"],
                    ["pending", "En attente"],
                    ["restricted", "Restreindre"],
                    ["suspended", "Suspendre"],
                    ["archived", "Archiver"],
                  ] as const
                ).map(([status, label]) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={selected.status === status ? "default" : "outline"}
                    disabled={
                      setStatus.isPending ||
                      selected.status === status ||
                      (selected.id === user?.id &&
                        (status === "suspended" || status === "archived" || status === "pending"))
                    }
                    onClick={() => runStatus(selected.id, status)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Restreindre limite l’accès académique ; suspendre bloque la connexion ; archiver
                retire le compte des listes actives.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button
                variant="outline"
                disabled={!selected.email}
                onClick={() => {
                  void AuthService.requestReset(selected.email!)
                    .then(() => toast.success("E-mail de réinitialisation envoyé"))
                    .catch((err: Error) => toast.error(err.message));
                }}
              >
                Envoyer e-mail mot de passe
              </Button>
              <Button
                variant="outline"
                className="text-destructive"
                disabled={deleteAccount.isPending || selected.id === user?.id}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Supprimer définitivement le compte de ${selected.first_name} ${selected.last_name} ? Tapez SUPPRIMER dans l’étape suivante.`,
                    )
                  ) {
                    return;
                  }
                  const typed = window.prompt('Pour confirmer, tapez "SUPPRIMER"');
                  if (typed !== "SUPPRIMER") {
                    toast.message("Suppression annulée");
                    return;
                  }
                  deleteAccount.mutate(selected.id, {
                    onSuccess: () => {
                      toast.success("Compte supprimé");
                      setSelectedId(null);
                    },
                    onError: (err) => toast.error(err.message),
                  });
                }}
              >
                Supprimer le compte
              </Button>
            </div>
          </Surface>
        </div>
      )}

      {createOpen && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel max-h-[90dvh] space-y-4 overflow-y-auto">
            <h2 className="text-lg font-semibold">Créer un compte</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Prénom"
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
              />
              <Input
                placeholder="Nom"
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
              />
            </div>
            <Input
              type="email"
              dir="ltr"
              placeholder="e-mail"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Mot de passe initial (min. 8)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              placeholder="Téléphone (facultatif)"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
            <label className="block text-sm">
              Rôle
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as AppRole)}
              >
                <option value="student">Étudiant</option>
                <option value="teacher">Professeur</option>
                <option value="admin">Administration</option>
              </select>
            </label>
            <p className="text-xs text-muted-foreground">
              Le compte est créé actif avec e-mail déjà confirmé. L’utilisateur pourra changer son
              mot de passe via « mot de passe oublié ».
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetCreate}>
                Annuler
              </Button>
              <Button
                disabled={
                  createAccount.isPending ||
                  !newEmail.trim() ||
                  !newFirstName.trim() ||
                  !newLastName.trim() ||
                  newPassword.length < 8
                }
                onClick={() => {
                  createAccount.mutate(
                    {
                      email: newEmail.trim(),
                      password: newPassword,
                      firstName: newFirstName.trim(),
                      lastName: newLastName.trim(),
                      role: newRole,
                      ...(newPhone.trim() ? { phone: newPhone.trim() } : {}),
                      activate: true,
                    },
                    {
                      onSuccess: () => {
                        toast.success("Compte créé");
                        resetCreate();
                      },
                      onError: (err) => toast.error(err.message),
                    },
                  );
                }}
              >
                {createAccount.isPending ? "Création…" : "Créer"}
              </Button>
            </div>
          </Surface>
        </div>
      )}
    </div>
  );
}
