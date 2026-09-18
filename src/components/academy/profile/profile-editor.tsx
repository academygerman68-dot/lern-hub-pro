import { useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useAdminUpdateProfile,
  useProfile,
  useRemoveProfileAvatar,
  useUpdateMyProfile,
  useUploadProfileAvatar,
} from "@/hooks/use-academy-data";
import { initials } from "@/lib/academy-logic";
import { AuthService, ProfileService } from "@/services/academy-services";
import { useAcademy } from "../academy-context";
import { FormSection, Surface } from "../primitives";

type ProfileEditorProps = {
  /** Target profile id — defaults to current user when mode is "self". */
  profileId: string;
  mode: "self" | "admin";
  email?: string | null;
  /** Compact layout for modals */
  compact?: boolean;
  /** Open directly in edit mode (admin modal). */
  defaultEditing?: boolean;
  onSaved?: () => void;
};

export function ProfileEditor({
  profileId,
  mode,
  email,
  compact = false,
  defaultEditing = false,
  onSaved,
}: ProfileEditorProps) {
  const { refreshProfile, user } = useAcademy();
  const profileQuery = useProfile(profileId);
  const updateMine = useUpdateMyProfile();
  const updateAdmin = useAdminUpdateProfile();
  const uploadAvatar = useUploadProfileAvatar();
  const removeAvatar = useRemoveProfileAvatar();
  const fileRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(defaultEditing);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  const profile = profileQuery.data;
  const displayEmail = email ?? profile?.email ?? user?.email ?? "";

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.first_name ?? "");
    setLastName(profile.last_name ?? "");
    setPhone(profile.phone ?? "");
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    void ProfileService.getAvatarSignedUrl(profile?.avatar_url).then((url) => {
      if (!cancelled) setAvatarUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.avatar_url]);

  const busy =
    updateMine.isPending ||
    updateAdmin.isPending ||
    uploadAvatar.isPending ||
    removeAvatar.isPending;

  const fullName = `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "—";

  const startEdit = () => {
    if (!profile) return;
    setFirstName(profile.first_name ?? "");
    setLastName(profile.last_name ?? "");
    setPhone(profile.phone ?? "");
    setFieldError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    if (!profile) return;
    setFirstName(profile.first_name ?? "");
    setLastName(profile.last_name ?? "");
    setPhone(profile.phone ?? "");
    setFieldError(null);
    setEditing(false);
  };

  const save = () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      setFieldError("Le prénom et le nom sont obligatoires.");
      return;
    }
    setFieldError(null);
    const payload = { firstName: fn, lastName: ln, phone: phone.trim() || null };

    if (mode === "self") {
      updateMine.mutate(payload, {
        onSuccess: async () => {
          toast.success("Profil mis à jour");
          setEditing(false);
          await refreshProfile();
          onSaved?.();
        },
        onError: (err) => toast.error(err.message),
      });
      return;
    }

    updateAdmin.mutate(
      { profileId, ...payload },
      {
        onSuccess: () => {
          toast.success("Profil mis à jour");
          setEditing(false);
          void profileQuery.refetch();
          onSaved?.();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const onPickAvatar = (file: File | null) => {
    if (!file) return;
    uploadAvatar.mutate(
      { profileId, file },
      {
        onSuccess: async () => {
          toast.success("Photo mise à jour");
          if (mode === "self") await refreshProfile();
          void profileQuery.refetch();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const onRemoveAvatar = () => {
    if (!window.confirm("Supprimer la photo de profil ?")) return;
    removeAvatar.mutate(profileId, {
      onSuccess: async () => {
        toast.success("Photo supprimée");
        setAvatarUrl(null);
        if (mode === "self") await refreshProfile();
        void profileQuery.refetch();
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const submitPassword = async () => {
    if (newPassword.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    setPasswordBusy(true);
    try {
      await AuthService.updatePassword(newPassword);
      toast.success("Mot de passe mis à jour");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de changer le mot de passe.");
    } finally {
      setPasswordBusy(false);
    }
  };

  if (profileQuery.isLoading) {
    return (
      <Surface className="h-40 animate-pulse bg-muted/40 p-6">
        <span className="sr-only">Chargement</span>
      </Surface>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <Surface className="space-y-2 p-6">
        <p className="font-medium">Profil indisponible</p>
        <p className="text-sm text-muted-foreground">
          Impossible de charger les informations personnelles.
        </p>
        <Button size="sm" variant="outline" onClick={() => void profileQuery.refetch()}>
          Réessayer
        </Button>
      </Surface>
    );
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      <Surface className={compact ? "p-5" : "p-6"}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="size-20 rounded-full object-cover ring-2 ring-border sm:size-24"
                />
              ) : (
                <span className="grid size-20 place-items-center rounded-full bg-primary text-lg font-semibold text-primary-foreground sm:size-24 sm:text-xl">
                  {initials(fullName) || "?"}
                </span>
              )}
              {editing ? (
                <button
                  type="button"
                  className="absolute -right-1 -bottom-1 grid size-9 place-items-center rounded-full border bg-card text-foreground shadow-soft"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  aria-label="Changer la photo"
                >
                  <Camera className="size-4" />
                </button>
              ) : null}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                e.target.value = "";
                onPickAvatar(file);
              }}
            />
            {editing && profile.avatar_url ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-destructive"
                disabled={busy}
                onClick={onRemoveAvatar}
              >
                <Trash2 className="size-3.5" />
                Supprimer
              </Button>
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{fullName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{displayEmail || "—"}</p>
              </div>
              {!editing ? (
                <Button size="sm" onClick={startEdit}>
                  Modifier
                </Button>
              ) : null}
            </div>

            {!editing ? (
              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Prénom</dt>
                  <dd className="mt-0.5 font-medium">{profile.first_name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Nom</dt>
                  <dd className="mt-0.5 font-medium">{profile.last_name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Téléphone</dt>
                  <dd className="mt-0.5 font-medium">{profile.phone || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">E-mail</dt>
                  <dd className="mt-0.5 font-medium">{displayEmail || "—"}</dd>
                </div>
              </dl>
            ) : (
              <div className="mt-5 space-y-4">
                <FormSection title="Identité" description="Informations visibles par l’académie.">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm">
                      Prénom
                      <Input
                        className="mt-1"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        disabled={busy}
                        autoComplete="given-name"
                      />
                    </label>
                    <label className="block text-sm">
                      Nom
                      <Input
                        className="mt-1"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        disabled={busy}
                        autoComplete="family-name"
                      />
                    </label>
                  </div>
                  <label className="block text-sm">
                    Téléphone
                    <Input
                      className="mt-1"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={busy}
                      autoComplete="tel"
                      placeholder="+212…"
                    />
                  </label>
                  <label className="block text-sm">
                    E-mail
                    <Input className="mt-1" value={displayEmail} readOnly disabled />
                    <span className="mt-1 block text-xs text-muted-foreground">
                      L’e-mail est géré par l’authentification et n’est pas modifiable ici.
                    </span>
                  </label>
                  {fieldError ? <p className="text-sm text-destructive">{fieldError}</p> : null}
                </FormSection>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" disabled={busy} onClick={cancelEdit}>
                    Annuler
                  </Button>
                  <Button type="button" disabled={busy} onClick={save}>
                    {busy ? "Enregistrement…" : "Enregistrer"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Surface>

      {mode === "self" ? (
        <Surface className="space-y-3 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Mot de passe</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Changement sécurisé — le mot de passe n’est jamais affiché.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPasswordOpen((v) => !v)}
              type="button"
            >
              {passwordOpen ? "Fermer" : "Changer le mot de passe"}
            </Button>
          </div>
          {passwordOpen ? (
            <div className="grid max-w-md gap-3">
              <label className="block text-sm">
                Nouveau mot de passe
                <Input
                  type="password"
                  className="mt-1"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={passwordBusy}
                />
              </label>
              <label className="block text-sm">
                Confirmer
                <Input
                  type="password"
                  className="mt-1"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={passwordBusy}
                />
              </label>
              <Button
                type="button"
                className="w-fit"
                disabled={passwordBusy}
                onClick={() => void submitPassword()}
              >
                {passwordBusy ? "Mise à jour…" : "Mettre à jour le mot de passe"}
              </Button>
            </div>
          ) : null}
        </Surface>
      ) : null}
    </div>
  );
}

/** Admin dialog shell — open from student/teacher detail. */
export function AdminProfileEditModal({
  profileId,
  email,
  open,
  onClose,
}: {
  profileId: string;
  email?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="mobile-modal">
      <Surface className="mobile-modal-panel max-h-[90dvh] space-y-4 overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Modifier le profil</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Prénom, nom, téléphone et photo — sans changer le rôle.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Fermer
          </Button>
        </div>
        <ProfileEditor
          profileId={profileId}
          mode="admin"
          email={email ?? null}
          compact
          defaultEditing
          onSaved={onClose}
        />
      </Surface>
    </div>
  );
}
