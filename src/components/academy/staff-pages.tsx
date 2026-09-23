import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useClassRoster,
  useClassSchedules,
  useClasses,
  useCreateClass,
  useCreateEnrollment,
  useCreateTeacher,
  useEnrollmentsByClass,
  useGenerateMonthSessions,
  useLevels,
  usePendingProfiles,
  useRemoveEnrollment,
  useReplaceClassSchedules,
  useSetProfileStatus,
  useStudents,
  useTeachers,
  useUpdateClass,
} from "@/hooks/use-academy-data";
import { formatGroupCodeWithTeacher, suggestGroupCode } from "@/lib/group-code";
import { AuthService } from "@/services/academy-services";
import { WEEKDAY_OPTIONS } from "@/services/supabase/class-schedule-service";
import type { AccountStatus, AcademyPage, Level, Student } from "@/types/academy";
import { useAcademy } from "./academy-context";
import { QueryState } from "./query-state";
import {
  PageHeader,
  Metric,
  ProgressLine,
  Status,
  Surface,
  AvatarName,
  LevelBadge,
  GroupBadge,
} from "./primitives";
import { AdminProfileEditModal } from "./profile/profile-editor";
import { AssignStudentGroupModal } from "./students/assign-group-modal";
import { PremiumStudent360 } from "./premium-screens";
import { PremiumDirectorDashboard, PremiumTeacherDashboard } from "./dashboards";
import {
  CalendarPage,
  DirectorReports,
  DirectorSettings,
  Messages,
  RecordingsPage,
  TeacherProfile,
  AccountSettings,
} from "./student-extra";
import {
  DirectorAssignmentsPage,
  DirectorCoursesPage,
  MaterialsLibraryPage,
} from "./academic-pages";
import { GroupProgressPage } from "./group-progress-page";
import { DirectorExamsPage, StudentExamStaffPreview } from "./exam-pages";
import { B1ExamWorkspace } from "./b1-exam-workspace";
import { LiveClassesPage } from "./live-pages";
import { FinancePages } from "./finance-pages";
import { useClassSelection } from "./class-selection";
import { PeoplePicker } from "./people-picker";
import { AuditPage } from "./workflow-pages";
import { CorrectionsCenter } from "./corrections-center";

function trimTime(value: string | null | undefined) {
  if (!value) return "21:00";
  return value.slice(0, 5);
}

export function TeacherPages({ page: pageProp }: { page?: AcademyPage } = {}) {
  const { page: contextPage } = useAcademy();
  const page = pageProp ?? contextPage;
  if (page === "classes") return <TeacherClass />;
  if (page === "students") return <TeacherStudents />;
  if (page === "courses") return <DirectorCoursesPage />;
  if (page === "lessons") return <GroupProgressPage />;
  if (page === "assignments") return <DirectorAssignmentsPage />;
  if (page === "corrections") return <CorrectionsCenter />;
  if (page === "calendar") return <CalendarPage />;
  if (page === "materials") return <MaterialsLibraryPage />;
  if (page === "exams") return <DirectorExamsPage />;
  if (page === "b1-exam") return <B1ExamWorkspace />;
  if (page === "b1-preview") return <StudentExamStaffPreview />;
  if (page === "live" || page === "meeting")
    return <LiveClassesPage meeting={page === "meeting"} />;
  if (page === "recordings") return <RecordingsPage />;
  if (page === "messages") return <Messages />;
  if (page === "profile") return <TeacherProfile />;
  if (page === "settings") return <AccountSettings />;
  return <PremiumTeacherDashboard />;
}

function TeacherStudents() {
  const { classesQuery, primaryClass, selector } = useClassSelection();
  const rosterQuery = useClassRoster(primaryClass?.id);
  return (
    <>
      <PageHeader
        title="Étudiants"
        action={selector}
        subtitle={primaryClass ? `Assignés via ${primaryClass.name}` : "Étudiants de vos groupes"}
      />
      <QueryState
        isLoading={classesQuery.isLoading || rosterQuery.isLoading}
        isError={classesQuery.isError || rosterQuery.isError}
        error={(classesQuery.error ?? rosterQuery.error) as Error | null}
        isEmpty={!rosterQuery.data?.length}
        emptyTitle="Aucun étudiant assigné"
        emptyMessage="Les étudiants apparaissent ici dès qu’ils sont inscrits dans vos groupes."
        onRetry={() => {
          void classesQuery.refetch();
          void rosterQuery.refetch();
        }}
      >
        <Surface className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Étudiant</th>
                <th>Niveau</th>
                <th>Groupe</th>
                <th>Abonnement</th>
              </tr>
            </thead>
            <tbody>
              {rosterQuery.data?.map((student) => (
                <tr key={student.id}>
                  <td>
                    <strong>{student.name}</strong>
                    <small className="block text-muted-foreground">{student.email}</small>
                  </td>
                  <td>{student.level}</td>
                  <td>{student.className}</td>
                  <td>
                    <Status tone={student.subscription === "ACTIVE" ? "green" : "amber"}>
                      {student.subscription === "ACTIVE"
                        ? "Actif"
                        : student.subscription === "PAST_DUE"
                          ? "En retard"
                          : "Suspendu"}
                    </Status>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      </QueryState>
    </>
  );
}

function TeacherClass() {
  const { classesQuery, primaryClass, selector } = useClassSelection();
  const rosterQuery = useClassRoster(primaryClass?.id);
  const enrolled = rosterQuery.data?.length ?? primaryClass?.size ?? 0;
  const capacity = primaryClass?.capacity ?? 0;
  const remaining = Math.max(0, capacity - enrolled);
  const isFull = capacity > 0 && enrolled >= capacity;

  return (
    <>
      <PageHeader
        title={primaryClass?.name ?? "Mon groupe"}
        subtitle={
          primaryClass
            ? `${enrolled}/${capacity} inscrits · ${remaining} place${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""} · ${primaryClass.schedule} · ${primaryClass.teacher}`
            : "Groupes qui vous sont assignés"
        }
        action={isFull ? <Status tone="red">Complet</Status> : undefined}
      />
      {selector}
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Metric label="Inscrits" value={String(enrolled || "—")} />
        <Metric label="Capacité" value={capacity ? String(capacity) : "—"} />
        <Metric label="Places restantes" value={capacity ? String(remaining) : "—"} />
      </div>
      <QueryState
        isLoading={classesQuery.isLoading || rosterQuery.isLoading}
        isError={classesQuery.isError || rosterQuery.isError}
        error={(classesQuery.error ?? rosterQuery.error) as Error | null}
        isEmpty={!rosterQuery.data?.length}
        emptyMessage="Aucun étudiant inscrit dans ce groupe pour le moment."
      >
        <Surface className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Étudiant</th>
                <th>Progression</th>
                <th>Moyenne</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {rosterQuery.data?.map((student) => (
                <tr key={student.id}>
                  <td>
                    <strong>{student.name}</strong>
                    <small className="block text-muted-foreground">
                      {student.email || student.id}
                    </small>
                  </td>
                  <td>
                    <div className="w-28">
                      <ProgressLine value={student.progress} />
                    </div>
                  </td>
                  <td>{student.average || "—"}%</td>
                  <td>
                    <Status tone="green">Actif</Status>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      </QueryState>
    </>
  );
}

export function DirectorPages({ page: pageProp }: { page?: AcademyPage } = {}) {
  const { page: contextPage } = useAcademy();
  const page = pageProp ?? contextPage;
  if (page === "students") return <Students />;
  if (page === "student360") return <PremiumStudent360 />;
  if (page === "classes") return <Classes />;
  if (page === "teachers") return <Teachers />;
  if (page === "courses" || page === "levels") return <DirectorCoursesPage />;
  if (page === "exams") return <DirectorExamsPage />;
  if (page === "b1-exam") return <B1ExamWorkspace />;
  if (page === "b1-preview") return <StudentExamStaffPreview />;
  if (page === "payments" || page === "subscriptions" || page === "invoices" || page === "payroll")
    return <FinancePages mode={page === "payroll" ? "payments" : page} />;
  if (page === "audit") return <AuditPage />;
  if (page === "materials") return <MaterialsLibraryPage />;
  if (page === "assignments") return <DirectorAssignmentsPage />;
  if (page === "corrections") return <CorrectionsCenter />;
  if (page === "calendar") return <CalendarPage />;
  if (page === "live" || page === "meeting")
    return <LiveClassesPage meeting={page === "meeting"} />;
  if (page === "recordings") return <RecordingsPage />;
  if (page === "messages") return <Messages />;
  if (page === "reports") return <DirectorReports />;
  if (page === "settings") return <DirectorSettings />;
  return <PremiumDirectorDashboard />;
}

function accountStatusLabel(status: AccountStatus) {
  switch (status) {
    case "pending":
      return "En attente";
    case "restricted":
      return "Restreint";
    case "suspended":
      return "Suspendu";
    case "archived":
      return "Archivé";
    default:
      return "Actif";
  }
}

function accountStatusTone(status: AccountStatus): "green" | "amber" | "red" | "gray" {
  switch (status) {
    case "active":
      return "green";
    case "pending":
    case "restricted":
      return "amber";
    case "suspended":
      return "red";
    default:
      return "gray";
  }
}

function subscriptionLabel(status: Student["subscription"]) {
  switch (status) {
    case "PAST_DUE":
      return "Impayé";
    case "SUSPENDED":
      return "Suspendu";
    default:
      return "Actif";
  }
}

function classStatusLabel(status: string) {
  switch (status) {
    case "active":
      return "Actif";
    case "planned":
      return "Planifié";
    case "completed":
      return "Terminé";
    case "archived":
      return "Archivé";
    default:
      return status;
  }
}

function adminActionError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("FORBIDDEN")) return "Action réservée à l’administration.";
  if (message.includes("CANNOT_SELF_LOCK"))
    return "Vous ne pouvez pas verrouiller votre propre compte.";
  if (message.includes("PROFILE_NOT_FOUND")) return "Profil introuvable.";
  if (message.includes("duplicate") || message.includes("already exists")) {
    return "Cet enregistrement existe déjà.";
  }
  return message;
}

function Students() {
  const { navigate } = useAcademy();
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState<Student | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [assignGroupOpen, setAssignGroupOpen] = useState(false);
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [classId, setClassId] = useState("");
  const [enrollLevelFilter, setEnrollLevelFilter] = useState("");
  const [confirmStatus, setConfirmStatus] = useState<AccountStatus | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);

  const pendingQuery = usePendingProfiles();
  const studentsQuery = useStudents(query);
  const allStudents = useStudents();
  const classesQuery = useClasses();
  const teachersQuery = useTeachers();
  const enroll = useCreateEnrollment();
  const setProfileStatus = useSetProfileStatus();

  const groupsForLevel = useMemo(
    () => (classesQuery.data ?? []).filter((item) => !levelFilter || item.level === levelFilter),
    [classesQuery.data, levelFilter],
  );

  const filtered = (studentsQuery.data ?? []).filter((student) => {
    if (levelFilter && student.level !== levelFilter) return false;
    if (groupFilter && student.classId !== groupFilter) return false;
    if (teacherFilter && (student.teacherName ?? "") !== teacherFilter) return false;
    if (statusFilter && student.accountStatus !== statusFilter) return false;
    return true;
  });

  const teacherNames = Array.from(
    new Set(
      (allStudents.data ?? [])
        .map((s) => s.teacherName)
        .filter((name): name is string => Boolean(name)),
    ),
  ).sort();

  const applyPendingStatus = (profileId: string, status: AccountStatus, label: string) => {
    setProfileStatus.mutate(
      { profileId, status },
      {
        onSuccess: () => toast.success(label),
        onError: (err) => toast.error(adminActionError(err)),
      },
    );
  };

  const applyStatus = (status: AccountStatus) => {
    if (!detail?.profileId) return;
    setProfileStatus.mutate(
      { profileId: detail.profileId, status },
      {
        onSuccess: () => {
          toast.success(`Statut mis à jour · ${accountStatusLabel(status)}`);
          setDetail({ ...detail, accountStatus: status });
          setConfirmStatus(null);
        },
        onError: (err) => toast.error(adminActionError(err)),
      },
    );
  };

  const requestPasswordReset = async (email: string) => {
    if (!email.trim()) return;
    setResettingPassword(true);
    try {
      await AuthService.requestReset(email.trim());
      toast.success("Lien de réinitialisation envoyé.");
    } catch {
      toast.error("Impossible d'envoyer le lien de réinitialisation.");
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Étudiants"
        subtitle={`${filtered.length} apprenant${filtered.length > 1 ? "s" : ""} dans l’académie.`}
        action={<Button onClick={() => setEnrollmentOpen(true)}>+ Inscrire dans un groupe</Button>}
      />

      {(pendingQuery.data?.length ?? 0) > 0 && (
        <Surface className="mb-5 space-y-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Comptes en attente de validation</h2>
            <Status tone="amber">{pendingQuery.data?.length ?? 0}</Status>
          </div>
          <div className="space-y-2">
            {pendingQuery.data?.map((profile) => (
              <div
                key={profile.id}
                className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {profile.first_name} {profile.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {profile.email}
                    {profile.phone ? ` · ${profile.phone}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={setProfileStatus.isPending}
                    onClick={() =>
                      applyPendingStatus(profile.id, "active", "Compte accepté · actif")
                    }
                  >
                    Accepter
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={setProfileStatus.isPending}
                    onClick={() =>
                      applyPendingStatus(profile.id, "archived", "Compte refusé · archivé")
                    }
                  >
                    Refuser
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={setProfileStatus.isPending}
                    onClick={() => applyPendingStatus(profile.id, "suspended", "Compte suspendu")}
                  >
                    Suspendre
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Surface>
      )}

      {enrollmentOpen && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <h2 className="font-semibold">Inscrire un étudiant dans un groupe</h2>
            <QueryState
              isLoading={classesQuery.isLoading}
              isError={classesQuery.isError}
              error={classesQuery.error}
            >
              <PeoplePicker purpose="enrollment" selectedId={studentId} onSelect={setStudentId} />
              <label className="block text-sm">
                Niveau
                <select
                  className="mt-1 w-full rounded-md border bg-background p-2"
                  value={enrollLevelFilter}
                  onChange={(e) => {
                    setEnrollLevelFilter(e.target.value);
                    setClassId("");
                  }}
                >
                  <option value="">Tous les niveaux</option>
                  {(["A1", "A2", "B1", "B2"] as Level[]).map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                Groupe
                <select
                  className="mt-1 w-full rounded-md border bg-background p-2"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  <option value="">Choisir un groupe</option>
                  {(classesQuery.data ?? [])
                    .filter((item) => !enrollLevelFilter || item.level === enrollLevelFilter)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.reference || item.name} · {item.level}
                      </option>
                    ))}
                </select>
              </label>
            </QueryState>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={enroll.isPending}
                onClick={() => setEnrollmentOpen(false)}
              >
                Annuler
              </Button>
              <Button
                disabled={!studentId || !classId || enroll.isPending || classesQuery.isError}
                onClick={() =>
                  enroll.mutate(
                    { studentId, classId },
                    {
                      onSuccess: (result) => {
                        const moved = result.movedFromClassNames ?? [];
                        toast.success(
                          moved.length > 0
                            ? `Inscription enregistrée (retiré de ${moved.join(", ")})`
                            : "Inscription enregistrée",
                        );
                        setEnrollmentOpen(false);
                        setStudentId("");
                        setClassId("");
                      },
                      onError: (err) => toast.error(adminActionError(err)),
                    },
                  )
                }
              >
                Confirmer l’inscription
              </Button>
            </div>
          </Surface>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-0 w-full flex-1 sm:min-w-60">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher un étudiant…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <select
          className="h-10 min-h-11 rounded-md border border-input bg-background px-3 text-sm sm:min-h-10"
          value={levelFilter}
          onChange={(e) => {
            setLevelFilter(e.target.value);
            setGroupFilter("");
          }}
        >
          <option value="">Tous les niveaux</option>
          {(["A1", "A2", "B1", "B2"] as Level[]).map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <select
          className="h-10 min-h-11 rounded-md border border-input bg-background px-3 text-sm sm:min-h-10"
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
        >
          <option value="">Tous les groupes</option>
          {groupsForLevel.map((item) => (
            <option key={item.id} value={item.id}>
              {item.reference || item.name}
              {item.level ? ` · ${item.level}` : ""}
            </option>
          ))}
        </select>
        <select
          className="h-10 min-h-11 rounded-md border border-input bg-background px-3 text-sm sm:min-h-10"
          value={teacherFilter}
          onChange={(e) => setTeacherFilter(e.target.value)}
        >
          <option value="">Tous les professeurs</option>
          {teacherNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="h-10 min-h-11 rounded-md border border-input bg-background px-3 text-sm sm:min-h-10"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actif</option>
          <option value="pending">En attente</option>
          <option value="restricted">Restreint</option>
          <option value="suspended">Suspendu</option>
          <option value="archived">Archivé</option>
        </select>
      </div>

      <QueryState
        isLoading={studentsQuery.isLoading}
        isError={studentsQuery.isError}
        error={studentsQuery.error}
        isEmpty={!filtered.length}
        emptyTitle="Aucun étudiant"
        emptyMessage="Aucun étudiant trouvé."
      >
        <div className="space-y-3 md:hidden">
          {filtered.map((student) => (
            <Surface key={student.id} className="space-y-3 p-4" onClick={() => setDetail(student)}>
              <div className="flex items-start justify-between gap-3">
                <AvatarName
                  name={`${student.firstName} ${student.lastName}`.trim() || student.name}
                  subtitle={student.email}
                />
                <Status tone={accountStatusTone(student.accountStatus)}>
                  {accountStatusLabel(student.accountStatus)}
                </Status>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <LevelBadge code={student.level} />
                <GroupBadge label={student.className || null} />
              </div>
            </Surface>
          ))}
        </div>
        <Surface className="table-scroll hidden md:block">
          <table className="data-table">
            <thead>
              <tr>
                <th>Étudiant</th>
                <th>E-mail</th>
                <th>Niveau</th>
                <th>Groupe</th>
                <th>Professeur</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => (
                <tr key={student.id} className="cursor-pointer" onClick={() => setDetail(student)}>
                  <td>
                    <AvatarName
                      name={`${student.lastName} ${student.firstName}`.trim() || student.name}
                      subtitle={student.email || null}
                      size="sm"
                    />
                  </td>
                  <td onClick={(event) => event.stopPropagation()}>
                    {student.email ? (
                      <a
                        className="text-sm text-muted-foreground transition-colors hover:text-primary"
                        href={`mailto:${student.email}`}
                      >
                        {student.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <LevelBadge code={student.level} />
                  </td>
                  <td>
                    <GroupBadge label={student.className || null} />
                  </td>
                  <td className="text-muted-foreground">{student.teacherName || "—"}</td>
                  <td>
                    <Status tone={accountStatusTone(student.accountStatus)}>
                      {accountStatusLabel(student.accountStatus)}
                    </Status>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      </QueryState>

      {detail && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel max-h-[90vh] space-y-4 overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  {detail.lastName} {detail.firstName}
                </h2>
                <p className="text-sm text-muted-foreground">{detail.email}</p>
              </div>
              <Status tone={accountStatusTone(detail.accountStatus)}>
                {accountStatusLabel(detail.accountStatus)}
              </Status>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Téléphone</span>
                <br />
                {detail.phone ? (
                  <a className="text-primary underline" href={`tel:${detail.phone}`}>
                    {detail.phone}
                  </a>
                ) : (
                  "—"
                )}
              </p>
              <p>
                <span className="text-muted-foreground">E-mail</span>
                <br />
                {detail.email ? (
                  <a className="text-primary underline" href={`mailto:${detail.email}`}>
                    {detail.email}
                  </a>
                ) : (
                  "—"
                )}
              </p>
              <p>
                <span className="text-muted-foreground">Niveau</span>
                <br />
                <span className="mt-1 inline-block">
                  <LevelBadge code={detail.level} />
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Groupe</span>
                <br />
                <span className="mt-1 inline-block">
                  <GroupBadge label={detail.className || null} />
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Professeur</span>
                <br />
                {detail.teacherName || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Abonnement</span>
                <br />
                {subscriptionLabel(detail.subscription)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => navigate("student360", { studentId: detail.id })}
              >
                Voir le profil
              </Button>
              <Button
                onClick={() => {
                  if (detail.profileId) setEditProfileOpen(true);
                }}
                disabled={!detail.profileId}
              >
                Modifier le profil
              </Button>
              <Button variant="secondary" onClick={() => setAssignGroupOpen(true)}>
                {detail.classId ? "Changer de groupe" : "Assigner à un groupe"}
              </Button>
              {detail.email ? (
                <Button
                  variant="outline"
                  disabled={resettingPassword}
                  onClick={() => void requestPasswordReset(detail.email)}
                >
                  Réinitialiser le mot de passe
                </Button>
              ) : null}
              <Button
                variant="outline"
                disabled={detail.accountStatus === "active" || setProfileStatus.isPending}
                onClick={() => setConfirmStatus("active")}
              >
                Activer
              </Button>
              <Button
                variant="outline"
                disabled={detail.accountStatus === "restricted" || setProfileStatus.isPending}
                onClick={() => setConfirmStatus("restricted")}
              >
                Restreindre
              </Button>
              <Button
                variant="outline"
                disabled={detail.accountStatus === "suspended" || setProfileStatus.isPending}
                onClick={() => setConfirmStatus("suspended")}
              >
                Suspendre
              </Button>
              <Button variant="outline" onClick={() => setDetail(null)}>
                Fermer
              </Button>
            </div>
          </Surface>
        </div>
      )}

      {confirmStatus && detail && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <h2 className="font-semibold">Confirmer le changement de statut</h2>
            <p className="text-sm text-muted-foreground">
              Passer {detail.lastName} {detail.firstName} en « {accountStatusLabel(confirmStatus)} »
              ?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmStatus(null)}>
                Annuler
              </Button>
              <Button
                disabled={setProfileStatus.isPending}
                onClick={() => applyStatus(confirmStatus)}
              >
                Confirmer
              </Button>
            </div>
          </Surface>
        </div>
      )}

      {detail?.profileId ? (
        <AdminProfileEditModal
          open={editProfileOpen}
          onClose={() => {
            setEditProfileOpen(false);
            void studentsQuery.refetch();
          }}
          profileId={detail.profileId}
          email={detail.email}
        />
      ) : null}

      {detail ? (
        <AssignStudentGroupModal
          open={assignGroupOpen}
          student={detail}
          onClose={() => setAssignGroupOpen(false)}
          onAssigned={() => {
            void studentsQuery.refetch();
            void allStudents.refetch();
            setDetail(null);
          }}
        />
      ) : null}
    </>
  );
}

function Classes() {
  const classesQuery = useClasses();
  const levelsQuery = useLevels();
  const teachersQuery = useTeachers();
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const createEnrollment = useCreateEnrollment();
  const removeEnrollment = useRemoveEnrollment();
  const replaceSchedules = useReplaceClassSchedules();
  const generateMonth = useGenerateMonthSessions();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [reference, setReference] = useState("");
  const [levelId, setLevelId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [schedule, setSchedule] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [addStudentId, setAddStudentId] = useState("");
  const [weekdayDraft, setWeekdayDraft] = useState<number[]>([]);
  const [startTimeDraft, setStartTimeDraft] = useState("21:00");
  const [endTimeDraft, setEndTimeDraft] = useState("23:00");

  const rosterQuery = useClassRoster(selectedId);
  const enrollmentsQuery = useEnrollmentsByClass(selectedId);
  const schedulesQuery = useClassSchedules(selectedId);
  const levelOptions = levelsQuery.data ?? [];
  const teacherOptions = teachersQuery.data ?? [];
  const selected = classesQuery.data?.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    const rows = schedulesQuery.data ?? [];
    if (!selectedId || schedulesQuery.isLoading) return;
    setWeekdayDraft(rows.map((r) => r.weekday));
    setStartTimeDraft(trimTime(rows[0]?.start_time) || "21:00");
    setEndTimeDraft(trimTime(rows[0]?.end_time) || "23:00");
  }, [selectedId, schedulesQuery.data, schedulesQuery.isLoading]);

  // Suggest a readable group code on create when level/teacher/start change.
  // Never overwrite an existing reference while editing.
  useEffect(() => {
    if (!open || editingId) return;
    const level = levelOptions.find((row) => row.id === levelId);
    if (!level?.code) return;
    const teacher = teacherOptions.find((row) => row.id === teacherId);
    const asOf = startDate ? new Date(`${startDate}T12:00:00`) : new Date();
    const next = suggestGroupCode({
      levelCode: level.code,
      teacherName: teacher?.name ?? null,
      existingReferences: (classesQuery.data ?? []).map((c) => c.reference),
      asOf: Number.isNaN(asOf.getTime()) ? new Date() : asOf,
    });
    setReference(next);
  }, [
    open,
    editingId,
    levelId,
    teacherId,
    startDate,
    levelOptions,
    teacherOptions,
    classesQuery.data,
  ]);

  const resetForm = () => {
    setName("");
    setReference("");
    setLevelId("");
    setTeacherId("");
    setSchedule("");
    setStartDate("");
    setEndDate("");
    setFormError(null);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (id: string) => {
    const item = classesQuery.data?.find((c) => c.id === id);
    if (!item) return;
    setEditingId(id);
    setName(item.name);
    setReference(item.reference ?? "");
    setLevelId(item.levelId ?? "");
    setTeacherId(item.teacherId ?? "");
    setSchedule(item.schedule === "—" ? "" : item.schedule);
    setStartDate(item.startDate ?? "");
    setEndDate(item.endDate ?? "");
    setFormError(null);
    setOpen(true);
  };

  const groupFormError = () => {
    if (!reference.trim()) return "La référence du groupe est obligatoire.";
    if (!name.trim()) return "Le nom du groupe est obligatoire.";
    if (!levelId) return "Choisissez le niveau du groupe.";
    if (startDate && endDate && endDate < startDate) {
      return "La date de fin doit suivre la date de début.";
    }
    return null;
  };

  const saveGroupError = (err: unknown) => {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("classes_reference_unique") || message.includes("duplicate key")) {
      return "Cette référence de groupe est déjà utilisée.";
    }
    return adminActionError(err);
  };

  const enrollmentIdForStudent = (studentId: string) => {
    const row = (enrollmentsQuery.data ?? []).find(
      (e) => e.student_id === studentId && e.status === "active",
    );
    return row?.id;
  };

  const toggleWeekday = (day: number) => {
    setWeekdayDraft((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  };

  const saveSchedules = (weekdays: number[]) => {
    if (!selected) return;
    replaceSchedules.mutate(
      {
        classId: selected.id,
        weekdays,
        startTime: startTimeDraft,
        endTime: endTimeDraft,
      },
      {
        onSuccess: () => {
          toast.success(
            weekdays.length === 0 ? "Créneaux retirés" : "Créneaux du groupe mis à jour",
          );
          if (weekdays.length > 0) {
            const now = new Date();
            generateMonth.mutate(
              {
                classId: selected.id,
                year: now.getFullYear(),
                month: now.getMonth() + 1,
              },
              {
                onSuccess: (count) =>
                  toast.success(
                    typeof count === "number"
                      ? `${count} séance(s) du mois générée(s)`
                      : "Séances du mois régénérées",
                  ),
                onError: (err) => toast.error(adminActionError(err)),
              },
            );
          }
        },
        onError: (err) => toast.error(adminActionError(err)),
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Groupes"
        subtitle="Classes, professeurs associés et effectifs."
        action={<Button onClick={openCreate}>+ Créer un groupe</Button>}
      />
      <QueryState
        isLoading={classesQuery.isLoading}
        isError={classesQuery.isError}
        error={classesQuery.error}
        isEmpty={!classesQuery.data?.length}
        emptyTitle="Aucun groupe"
        emptyMessage="Aucun groupe pour le moment. Créez le premier."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classesQuery.data?.map((item) => (
            <Surface
              className="cursor-pointer p-5"
              key={item.id}
              onClick={() => setSelectedId(item.id)}
            >
              <div className="flex justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <LevelBadge code={item.level} />
                  <GroupBadge label={item.reference || item.name} />
                  {item.teacher && item.teacher !== "—" ? (
                    <span className="text-xs text-muted-foreground">{item.teacher}</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {item.capacity > 0 && item.size >= item.capacity && (
                    <Status tone="red">Complet</Status>
                  )}
                  <Status tone={item.status === "active" ? "green" : "amber"}>
                    {classStatusLabel(item.status)}
                  </Status>
                </div>
              </div>
              <h2 className="mt-4 text-lg font-semibold tracking-tight">{item.name}</h2>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <div className="pt-1">
                  <AvatarName
                    name={item.teacher && item.teacher !== "—" ? item.teacher : "Non assigné"}
                    size="sm"
                    subtitle="Professeur"
                  />
                </div>
                <p>
                  Du {item.startDate ?? "—"} au {item.endDate ?? "—"}
                </p>
                <p>
                  {item.size}/{item.capacity} inscrits · {Math.max(0, item.capacity - item.size)}{" "}
                  place
                  {Math.max(0, item.capacity - item.size) !== 1 ? "s" : ""} restante
                  {Math.max(0, item.capacity - item.size) !== 1 ? "s" : ""}
                </p>
                <p>{item.schedule}</p>
              </div>
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(item.id);
                  }}
                >
                  Modifier
                </Button>
              </div>
            </Surface>
          ))}
        </div>
      </QueryState>

      {open && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <h2 className="text-lg font-semibold">
              {editingId ? "Modifier le groupe" : "Créer un groupe"}
            </h2>
            <label className="block text-sm">
              Code du groupe
              <Input
                className="mt-1"
                placeholder="Ex. A1-SEP26-WB-01"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Format suggéré : niveau-période-initiales-numéro. Les codes existants restent
                inchangés si vous changez de professeur.
                {teacherId
                  ? ` Affichage : ${formatGroupCodeWithTeacher(
                      reference,
                      teacherOptions.find((t) => t.id === teacherId)?.name,
                    )}`
                  : ""}
              </span>
            </label>
            <label className="block text-sm">
              Niveau
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={levelId}
                onChange={(e) => setLevelId(e.target.value)}
              >
                <option value="">Choisir un niveau</option>
                {levelOptions.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.code} · {level.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Groupe
              <Input
                className="mt-1"
                placeholder="Nom du groupe"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Professeur
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
              >
                <option value="">Associer un professeur (optionnel)</option>
                {teacherOptions.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                Date de début
                <Input
                  className="mt-1"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Date de fin
                <Input
                  className="mt-1"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </label>
            </div>
            <label className="block text-sm">
              Horaires
              <Input
                className="mt-1"
                placeholder="Horaires (libellé libre, optionnel)"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
              />
            </label>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setOpen(false);
                  resetForm();
                }}
              >
                Annuler
              </Button>
              <Button
                disabled={
                  !reference.trim() ||
                  !name.trim() ||
                  !levelId ||
                  createClass.isPending ||
                  updateClass.isPending
                }
                onClick={() => {
                  const invalid = groupFormError();
                  if (invalid) {
                    setFormError(invalid);
                    return;
                  }
                  setFormError(null);
                  if (editingId) {
                    updateClass.mutate(
                      {
                        id: editingId,
                        patch: {
                          name: name.trim(),
                          reference: reference.trim(),
                          level_id: levelId,
                          teacher_id: teacherId || null,
                          schedule_label: schedule || null,
                          start_date: startDate || null,
                          end_date: endDate || null,
                        },
                      },
                      {
                        onSuccess: () => {
                          toast.success("Groupe mis à jour");
                          setOpen(false);
                          resetForm();
                        },
                        onError: (err) => {
                          const message = saveGroupError(err);
                          setFormError(message);
                          toast.error(message);
                        },
                      },
                    );
                    return;
                  }
                  createClass.mutate(
                    {
                      name: name.trim(),
                      reference: reference.trim(),
                      levelId,
                      teacherId: teacherId || null,
                      scheduleLabel: schedule || null,
                      startDate: startDate || null,
                      endDate: endDate || null,
                      status: "active",
                    },
                    {
                      onSuccess: () => {
                        toast.success("Groupe créé");
                        setOpen(false);
                        resetForm();
                      },
                      onError: (err) => {
                        const message = saveGroupError(err);
                        setFormError(message);
                        toast.error(message);
                      },
                    },
                  );
                }}
              >
                {editingId ? "Enregistrer" : "Créer"}
              </Button>
            </div>
          </Surface>
        </div>
      )}

      {selected && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel max-h-[90vh] space-y-4 overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{selected.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {selected.level} · {selected.teacher} · {selected.size}/{selected.capacity}{" "}
                  étudiants
                </p>
              </div>
              <Button variant="outline" onClick={() => setSelectedId(null)}>
                Fermer
              </Button>
            </div>

            <label className="block text-sm">
              Professeur du groupe
              <select
                className="mt-1 w-full rounded-md border bg-background p-2"
                value={selected.teacherId ?? ""}
                onChange={(e) => {
                  const next = e.target.value || null;
                  updateClass.mutate(
                    { id: selected.id, patch: { teacher_id: next } },
                    {
                      onSuccess: () =>
                        toast.success(next ? "Professeur associé" : "Professeur retiré"),
                      onError: (err) => toast.error(adminActionError(err)),
                    },
                  );
                }}
              >
                <option value="">Aucun professeur</option>
                {teacherOptions.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-3 rounded-md border border-border p-3">
              <div>
                <h3 className="text-sm font-semibold">Créneaux hebdomadaires</h3>
                <p className="text-xs text-muted-foreground">
                  Sélectionnez les jours du groupe, ou retirez tous les créneaux.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map((day) => {
                  const active = weekdayDraft.includes(day.value);
                  return (
                    <Button
                      key={day.value}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      onClick={() => toggleWeekday(day.value)}
                    >
                      {day.label}
                    </Button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">
                  Début
                  <Input
                    className="mt-1"
                    type="time"
                    value={startTimeDraft}
                    onChange={(e) => setStartTimeDraft(e.target.value)}
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Fin
                  <Input
                    className="mt-1"
                    type="time"
                    value={endTimeDraft}
                    onChange={(e) => setEndTimeDraft(e.target.value)}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={
                    weekdayDraft.length === 0 ||
                    replaceSchedules.isPending ||
                    generateMonth.isPending
                  }
                  onClick={() => saveSchedules(weekdayDraft)}
                >
                  Enregistrer les créneaux
                </Button>
                <Button
                  variant="outline"
                  disabled={replaceSchedules.isPending}
                  onClick={() => {
                    if (!window.confirm("Retirer tous les créneaux hebdomadaires de ce groupe ?")) {
                      return;
                    }
                    setWeekdayDraft([]);
                    saveSchedules([]);
                  }}
                >
                  Retirer les créneaux
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <PeoplePicker
                purpose="enrollment"
                selectedId={addStudentId}
                excludeIds={(rosterQuery.data ?? []).map((student) => student.id)}
                excludeKind="student"
                onSelect={setAddStudentId}
              />
              <div className="flex justify-end">
                <Button
                  disabled={!addStudentId || createEnrollment.isPending}
                  onClick={() =>
                    createEnrollment.mutate(
                      { studentId: addStudentId, classId: selected.id },
                      {
                        onSuccess: (result) => {
                          const moved = result.movedFromClassNames ?? [];
                          toast.success(
                            moved.length > 0
                              ? `Étudiant ajouté (retiré de ${moved.join(", ")})`
                              : "Étudiant ajouté au groupe",
                          );
                          setAddStudentId("");
                        },
                        onError: (err) => toast.error(adminActionError(err)),
                      },
                    )
                  }
                >
                  Ajouter au groupe
                </Button>
              </div>
            </div>

            <QueryState
              isLoading={rosterQuery.isLoading || enrollmentsQuery.isLoading}
              isError={rosterQuery.isError || enrollmentsQuery.isError}
              error={rosterQuery.error ?? enrollmentsQuery.error}
              isEmpty={!rosterQuery.data?.length}
              emptyMessage="Aucun étudiant inscrit dans ce groupe."
            >
              <Surface className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Étudiant</th>
                      <th>Niveau</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rosterQuery.data?.map((student) => (
                      <tr key={student.id}>
                        <td>
                          <strong>
                            {student.lastName} {student.firstName}
                          </strong>
                          <small className="block text-muted-foreground">{student.email}</small>
                        </td>
                        <td>{student.level}</td>
                        <td>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={removeEnrollment.isPending}
                            onClick={() => {
                              const enrollmentId = enrollmentIdForStudent(student.id);
                              if (!enrollmentId) {
                                toast.error("Inscription introuvable");
                                return;
                              }
                              if (
                                !window.confirm(
                                  `Retirer ${student.lastName} ${student.firstName} de ce groupe ?`,
                                )
                              ) {
                                return;
                              }
                              removeEnrollment.mutate(
                                {
                                  enrollmentId,
                                  classId: selected.id,
                                  studentId: student.id,
                                },
                                {
                                  onSuccess: () => toast.success("Étudiant retiré du groupe"),
                                  onError: (err) => toast.error(adminActionError(err)),
                                },
                              );
                            }}
                          >
                            Retirer
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Surface>
            </QueryState>
          </Surface>
        </div>
      )}
    </>
  );
}

function Teachers() {
  const teachersQuery = useTeachers();
  const classesQuery = useClasses();
  const studentsQuery = useStudents();
  const updateClass = useUpdateClass();
  const createTeacher = useCreateTeacher();
  const setProfileStatus = useSetProfileStatus();

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editTeacherProfileOpen, setEditTeacherProfileOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [assignClassId, setAssignClassId] = useState("");

  const filtered = (teachersQuery.data ?? []).filter((teacher) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      teacher.name.toLowerCase().includes(q) ||
      teacher.email.toLowerCase().includes(q) ||
      (teacher.phone ?? "").toLowerCase().includes(q) ||
      teacher.classes.some((c) => c.toLowerCase().includes(q))
    );
  });

  const selected = teachersQuery.data?.find((t) => t.id === selectedId) ?? null;
  const teacherGroups = (classesQuery.data ?? []).filter((c) => c.teacherId === selectedId);
  const unassignedGroups = (classesQuery.data ?? []).filter((c) => c.teacherId !== selectedId);

  return (
    <>
      <PageHeader
        title="Professeurs"
        subtitle="Équipe pédagogique, groupes et niveaux."
        action={<Button onClick={() => setOpen(true)}>+ Ajouter un professeur</Button>}
      />
      <div className="mb-4">
        <div className="relative min-w-0 w-full sm:max-w-md">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Rechercher un professeur…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <QueryState
        isLoading={teachersQuery.isLoading}
        isError={teachersQuery.isError}
        error={teachersQuery.error}
        isEmpty={!filtered.length}
        emptyTitle="Aucun professeur"
        emptyMessage="Aucun professeur trouvé."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((teacher) => (
            <Surface
              className="cursor-pointer p-5"
              key={teacher.id}
              onClick={() => setSelectedId(teacher.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <AvatarName
                  name={teacher.name}
                  subtitle={teacher.email || teacher.subject || null}
                />
                <Status tone={accountStatusTone(teacher.accountStatus)}>
                  {accountStatusLabel(teacher.accountStatus)}
                </Status>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {teacher.levels.length ? (
                  teacher.levels.map((level) => <LevelBadge key={level} code={level} />)
                ) : (
                  <span className="text-sm text-muted-foreground">Aucun niveau</span>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {teacher.classes.length ? (
                  teacher.classes.slice(0, 3).map((c) => <GroupBadge key={c} label={c} />)
                ) : (
                  <span className="text-sm text-muted-foreground">Aucun groupe assigné</span>
                )}
                {teacher.classes.length > 3 ? (
                  <span className="text-xs text-muted-foreground">
                    +{teacher.classes.length - 3}
                  </span>
                ) : null}
              </div>
            </Surface>
          ))}
        </div>
      </QueryState>

      {open && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <h2 className="text-lg font-semibold">Ajouter un professeur</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Prénom"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <Input
                placeholder="Nom"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <Input
              placeholder="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              placeholder="Téléphone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              placeholder="Mot de passe initial (min. 8 caractères)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              Le mot de passe n’est jamais réaffiché. Preférez ensuite « Réinitialiser le mot de
              passe » depuis la fiche.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button
                disabled={
                  !firstName.trim() ||
                  !lastName.trim() ||
                  !email.trim() ||
                  password.length < 8 ||
                  createTeacher.isPending
                }
                onClick={() =>
                  createTeacher.mutate(
                    {
                      firstName: firstName.trim(),
                      lastName: lastName.trim(),
                      email: email.trim(),
                      password,
                      ...(phone.trim() ? { phone: phone.trim() } : {}),
                    },
                    {
                      onSuccess: () => {
                        toast.success("Compte créé. Envoyez un lien de réinitialisation.");
                        setOpen(false);
                        setFirstName("");
                        setLastName("");
                        setEmail("");
                        setPhone("");
                        setPassword("");
                      },
                      onError: (err) => toast.error(adminActionError(err)),
                    },
                  )
                }
              >
                Créer le compte
              </Button>
            </div>
          </Surface>
        </div>
      )}

      {selected && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel max-h-[90vh] space-y-4 overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{selected.name}</h2>
                <p className="text-sm text-muted-foreground">{selected.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Status tone={accountStatusTone(selected.accountStatus)}>
                  {accountStatusLabel(selected.accountStatus)}
                </Status>
                <Button
                  size="sm"
                  disabled={!selected.profileId}
                  onClick={() => setEditTeacherProfileOpen(true)}
                >
                  Modifier le profil
                </Button>
              </div>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Téléphone</span>
                <br />
                {selected.phone ? (
                  <a className="text-primary underline" href={`tel:${selected.phone}`}>
                    {selected.phone}
                  </a>
                ) : (
                  "—"
                )}
              </p>
              <p>
                <span className="text-muted-foreground">E-mail</span>
                <br />
                {selected.email ? (
                  <a className="text-primary underline" href={`mailto:${selected.email}`}>
                    {selected.email}
                  </a>
                ) : (
                  "—"
                )}
              </p>
              <p>
                <span className="text-muted-foreground">Niveaux</span>
                <br />
                {selected.levels.join(", ") || "—"}
              </p>
            </div>

            <div>
              <h3 className="mb-2 font-medium">Groupes assignés</h3>
              {teacherGroups.length ? (
                <div className="space-y-2">
                  {teacherGroups.map((group) => {
                    const groupStudents = (studentsQuery.data ?? []).filter(
                      (s) => s.classId === group.id || s.className === group.name,
                    );
                    return (
                      <Surface key={group.id} className="space-y-2 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <GroupBadge label={group.name} />
                              <LevelBadge code={group.level} />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {groupStudents.length} étudiant
                              {groupStudents.length > 1 ? "s" : ""}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updateClass.isPending}
                            onClick={() =>
                              updateClass.mutate(
                                { id: group.id, patch: { teacher_id: null } },
                                {
                                  onSuccess: () => toast.success("Professeur retiré du groupe"),
                                  onError: (err) => toast.error(adminActionError(err)),
                                },
                              )
                            }
                          >
                            Retirer
                          </Button>
                        </div>
                        {groupStudents.length ? (
                          <ul className="space-y-2">
                            {groupStudents.map((student) => (
                              <li key={student.id}>
                                <AvatarName
                                  size="sm"
                                  name={`${student.lastName} ${student.firstName}`.trim()}
                                />
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Aucun étudiant dans ce groupe.
                          </p>
                        )}
                      </Surface>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun groupe assigné.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                className="h-10 min-w-48 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                value={assignClassId}
                onChange={(e) => setAssignClassId(e.target.value)}
              >
                <option value="">Assigner un groupe…</option>
                {unassignedGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                    {group.teacherId ? ` (actuellement : ${group.teacher})` : ""}
                  </option>
                ))}
              </select>
              <Button
                disabled={!assignClassId || updateClass.isPending}
                onClick={() =>
                  updateClass.mutate(
                    { id: assignClassId, patch: { teacher_id: selected.id } },
                    {
                      onSuccess: () => {
                        toast.success("Groupe assigné");
                        setAssignClassId("");
                      },
                      onError: (err) => toast.error(adminActionError(err)),
                    },
                  )
                }
              >
                Assigner
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={selected.accountStatus === "active" || setProfileStatus.isPending}
                onClick={() => {
                  if (!selected.profileId) return;
                  if (!window.confirm(`Activer le compte de ${selected.name} ?`)) return;
                  setProfileStatus.mutate(
                    { profileId: selected.profileId, status: "active" },
                    {
                      onSuccess: () => toast.success("Compte activé"),
                      onError: (err) => toast.error(adminActionError(err)),
                    },
                  );
                }}
              >
                Activer
              </Button>
              <Button
                variant="outline"
                disabled={selected.accountStatus === "restricted" || setProfileStatus.isPending}
                onClick={() => {
                  if (!selected.profileId) return;
                  if (!window.confirm(`Restreindre le compte de ${selected.name} ?`)) return;
                  setProfileStatus.mutate(
                    { profileId: selected.profileId, status: "restricted" },
                    {
                      onSuccess: () => toast.success("Compte restreint"),
                      onError: (err) => toast.error(adminActionError(err)),
                    },
                  );
                }}
              >
                Restreindre
              </Button>
              <Button
                variant="outline"
                disabled={selected.accountStatus === "suspended" || setProfileStatus.isPending}
                onClick={() => {
                  if (!selected.profileId) return;
                  if (!window.confirm(`Suspendre le compte de ${selected.name} ?`)) return;
                  setProfileStatus.mutate(
                    { profileId: selected.profileId, status: "suspended" },
                    {
                      onSuccess: () => toast.success("Compte suspendu"),
                      onError: (err) => toast.error(adminActionError(err)),
                    },
                  );
                }}
              >
                Suspendre
              </Button>
              <Button variant="outline" onClick={() => setSelectedId(null)}>
                Fermer
              </Button>
            </div>
          </Surface>
        </div>
      )}

      {selected?.profileId ? (
        <AdminProfileEditModal
          open={editTeacherProfileOpen}
          onClose={() => {
            setEditTeacherProfileOpen(false);
            void teachersQuery.refetch();
          }}
          profileId={selected.profileId}
          email={selected.email}
        />
      ) : null}
    </>
  );
}
