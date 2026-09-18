import { useState } from "react";
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
import { AccountDeletionService } from "@/services/supabase/account-deletion-service";
import { useAcademy } from "./academy-context";
import { Surface } from "./primitives";

export function DangerZoneAccountDeletion() {
  const { signOut, profile } = useAcademy();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);

  const isAdmin = profile?.role === "admin";
  const canConfirm = confirmation.trim() === "SUPPRIMER";

  async function handleDelete() {
    if (!canConfirm || pending) return;
    setPending(true);
    try {
      await AccountDeletionService.deleteOwnAccount(confirmation);
      toast.success("Compte supprimé définitivement.");
      setOpen(false);
      await signOut();
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "La suppression a échoué. Réessayez ou contactez le support.";
      toast.error(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Surface className="space-y-4 border-destructive/40 p-6">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-destructive uppercase">
            Zone de danger
          </p>
          <h2 className="mt-2 font-semibold">Supprimer définitivement mon compte</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Cette action est irréversible. Vos données personnelles seront supprimées ou
            anonymisées, vos fichiers associés seront retirés, et vous serez déconnecté
            immédiatement.
            {isAdmin
              ? " Si vous êtes le dernier administrateur actif, la suppression sera refusée."
              : null}
          </p>
        </div>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Supprimer définitivement mon compte
        </Button>
      </Surface>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
          if (!next) setConfirmation("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Cette action est définitive et ne peut pas être annulée. Pour confirmer, saisissez
              exactement <span className="font-semibold text-foreground">SUPPRIMER</span>.
            </DialogDescription>
          </DialogHeader>
          <label className="block text-sm">
            Confirmation
            <Input
              className="mt-1"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="SUPPRIMER"
              autoComplete="off"
              disabled={pending}
            />
          </label>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => {
                setOpen(false);
                setConfirmation("");
              }}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!canConfirm || pending}
              onClick={() => void handleDelete()}
            >
              {pending ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
