import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  useClasses,
  useCreateEnrollment,
  useEnrollmentsByStudent,
  useLevels,
} from "@/hooks/use-academy-data";
import type { Student } from "@/types/academy";
import { FormSection, GroupBadge, LevelBadge, Surface } from "../primitives";
import { QueryState } from "../query-state";

type AssignStudentGroupModalProps = {
  open: boolean;
  student: Pick<Student, "id" | "name" | "classId" | "className" | "level">;
  onClose: () => void;
  onAssigned?: () => void;
};

function humanEnrollmentError(message: string) {
  if (message.includes("FORBIDDEN") || message.includes("permission")) {
    return "Vous n’êtes pas autorisé à modifier cette inscription.";
  }
  if (message.includes("duplicate") || message.includes("unique")) {
    return "Cet étudiant est déjà inscrit dans ce groupe.";
  }
  return message || "Inscription impossible.";
}

export function AssignStudentGroupModal({
  open,
  student,
  onClose,
  onAssigned,
}: AssignStudentGroupModalProps) {
  const classesQuery = useClasses();
  const levelsQuery = useLevels();
  const enrollmentsQuery = useEnrollmentsByStudent(student.id);
  const enroll = useCreateEnrollment();

  const [levelCode, setLevelCode] = useState("");
  const [classId, setClassId] = useState("");
  const [confirmMove, setConfirmMove] = useState(false);

  const activeEnrollment = useMemo(
    () => (enrollmentsQuery.data ?? []).find((row) => row.status === "active") ?? null,
    [enrollmentsQuery.data],
  );
  const currentGroupName = activeEnrollment?.class?.name || student.className || null;
  const currentClassId = activeEnrollment?.class_id || student.classId || null;

  const groupsForLevel = useMemo(
    () =>
      (classesQuery.data ?? []).filter(
        (item) => item.status !== "archived" && (!levelCode || item.level === levelCode),
      ),
    [classesQuery.data, levelCode],
  );

  const selectedGroup = useMemo(
    () => (classesQuery.data ?? []).find((item) => item.id === classId) ?? null,
    [classesQuery.data, classId],
  );

  useEffect(() => {
    if (!open) return;
    setLevelCode(student.level ? String(student.level) : "");
    setClassId("");
    setConfirmMove(false);
  }, [open, student.id, student.level]);

  if (!open) return null;

  const isMove = Boolean(currentClassId && classId && classId !== currentClassId);
  const isSame = Boolean(currentClassId && classId === currentClassId);
  const title = currentClassId ? "Changer de groupe" : "Assigner à un groupe";

  const submit = () => {
    if (!classId || isSame) return;
    if (isMove && !confirmMove) {
      setConfirmMove(true);
      return;
    }
    enroll.mutate(
      { studentId: student.id, classId },
      {
        onSuccess: (result) => {
          const moved = result.movedFromClassNames ?? [];
          toast.success(
            moved.length
              ? `${student.name} inscrit dans le nouveau groupe (retiré de ${moved.join(", ")})`
              : `${student.name} assigné au groupe`,
          );
          setConfirmMove(false);
          onAssigned?.();
          onClose();
        },
        onError: (err) => toast.error(humanEnrollmentError(err.message)),
      },
    );
  };

  return (
    <div className="mobile-modal">
      <Surface className="mobile-modal-panel max-h-[90dvh] space-y-4 overflow-y-auto">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {student.name}
            {currentGroupName ? ` · actuellement ${currentGroupName}` : " · sans groupe"}
          </p>
        </div>

        <QueryState
          isLoading={classesQuery.isLoading || levelsQuery.isLoading}
          isError={classesQuery.isError || levelsQuery.isError}
          error={classesQuery.error ?? levelsQuery.error}
          onRetry={() => {
            void classesQuery.refetch();
            void levelsQuery.refetch();
          }}
        >
          <FormSection
            title="Niveau"
            description="Le niveau CEFR filtre la liste des groupes (distinct du nom de groupe)."
          >
            <div className="flex flex-wrap items-center gap-2">
              {levelCode ? <LevelBadge code={levelCode} /> : null}
            </div>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={levelCode}
              onChange={(e) => {
                setLevelCode(e.target.value);
                setClassId("");
                setConfirmMove(false);
              }}
            >
              <option value="">Tous les niveaux</option>
              {(levelsQuery.data ?? []).map((level) => (
                <option key={level.id} value={level.code}>
                  {level.code} · {level.name}
                </option>
              ))}
            </select>
          </FormSection>

          <FormSection
            title="Groupe"
            description="Instance de classe (ex. A1-SEP-2026), pas le niveau seul."
          >
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setConfirmMove(false);
              }}
            >
              <option value="">Choisir un groupe</option>
              {groupsForLevel.map((item) => (
                <option key={item.id} value={item.id} disabled={item.id === currentClassId}>
                  {item.reference || item.name} · {item.level}
                  {item.id === currentClassId ? " (actuel)" : ""}
                </option>
              ))}
            </select>
          </FormSection>

          {selectedGroup ? (
            <FormSection title="Détails du groupe">
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Niveau</dt>
                  <dd className="mt-1">
                    <LevelBadge code={selectedGroup.level} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Groupe</dt>
                  <dd className="mt-1">
                    <GroupBadge label={selectedGroup.reference || selectedGroup.name} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Professeur</dt>
                  <dd className="mt-1 font-medium">{selectedGroup.teacher || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Horaires</dt>
                  <dd className="mt-1 font-medium">{selectedGroup.schedule || "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Début</dt>
                  <dd className="mt-1 font-medium">{selectedGroup.startDate ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Fin</dt>
                  <dd className="mt-1 font-medium">{selectedGroup.endDate ?? "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Effectif</dt>
                  <dd className="mt-1 font-medium">
                    {selectedGroup.size}/{selectedGroup.capacity} inscrits
                  </dd>
                </div>
              </dl>
            </FormSection>
          ) : null}

          {confirmMove && isMove ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Déplacer cet étudiant de <strong>{currentGroupName || "son groupe actuel"}</strong>{" "}
              vers <strong>{selectedGroup?.reference || selectedGroup?.name}</strong> ? L’ancienne
              inscription active sera retirée.
            </div>
          ) : null}
        </QueryState>

        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button
            variant="outline"
            disabled={enroll.isPending}
            onClick={() => {
              setConfirmMove(false);
              onClose();
            }}
          >
            Annuler
          </Button>
          <Button disabled={!classId || isSame || enroll.isPending} onClick={submit}>
            {enroll.isPending
              ? "Enregistrement…"
              : confirmMove
                ? "Confirmer le déplacement"
                : isMove
                  ? "Changer de groupe"
                  : "Assigner"}
          </Button>
        </div>
      </Surface>
    </div>
  );
}
