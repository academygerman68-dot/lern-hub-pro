import { useState } from "react";
import { Search, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useClassRoster,
  useClasses,
  useCreateClass,
  useCreateEnrollment,
  useCreateTeacher,
  useEnrollmentsByClass,
  useLevels,
  useRemoveEnrollment,
  useSetProfileStatus,
  useStudents,
  useTeachers,
  useUpdateClass,
} from "@/hooks/use-academy-data";
import type { AccountStatus, AcademyPage, Level, Student } from "@/types/academy";
import { useAcademy } from "./academy-context";
import { QueryState } from "./query-state";
import { PageHeader, Metric, ProgressLine, Status, Surface } from "./primitives";
import { PremiumStudent360 } from "./premium-screens";
import { PremiumDirectorDashboard, PremiumTeacherDashboard } from "./dashboards";
import {
  CalendarPage,
  DirectorReports,
  DirectorSettings,
  Messages,
  TeacherProfile,
} from "./student-extra";
import {
  DirectorAssignmentsPage,
  DirectorCoursesPage,
  MaterialsLibraryPage,
  TeacherAssignmentsPage,
  TeacherAttendancePage,
  TeacherLessonManagerPage,
} from "./learning-pages";
import { DirectorExamsPage, StaffExamsPage } from "./exam-pages";
import { LiveClassesPage } from "./live-pages";
import { FinancePages } from "./finance-pages";
import { useClassSelection } from "./class-selection";
import { AuditPage } from "./workflow-pages";

export function TeacherPages({ page: pageProp }: { page?: AcademyPage } = {}) {
  const { page: contextPage } = useAcademy();
  const page = pageProp ?? contextPage;
  if (page === "classes") return <TeacherClass />;
  if (page === "students") return <TeacherStudents />;
  if (page === "lessons") return <TeacherLessonManagerPage />;
  if (page === "assignments") return <TeacherAssignmentsPage />;
  if (page === "attendance") return <TeacherAttendancePage />;
  if (page === "calendar") return <CalendarPage />;
  if (page === "materials") return <MaterialsLibraryPage />;
  if (page === "exams") return <StaffExamsPage />;
  if (page === "live" || page === "meeting")
    return <LiveClassesPage meeting={page === "meeting"} />;
  if (page === "messages") return <Messages />;
  if (page === "profile") return <TeacherProfile />;
  return <PremiumTeacherDashboard />;
}

function TeacherStudents() {
  const { classesQuery, primaryClass, selector } = useClassSelection();
  const rosterQuery = useClassRoster(primaryClass?.id);
  return (
    <>
      <PageHeader
        title="Students"
        action={selector}
        subtitle={primaryClass ? `Assigned via ${primaryClass.name}` : "Students in your classes"}
      />
      <QueryState
        isLoading={classesQuery.isLoading || rosterQuery.isLoading}
        isError={classesQuery.isError || rosterQuery.isError}
        error={(classesQuery.error ?? rosterQuery.error) as Error | null}
        isEmpty={!rosterQuery.data?.length}
        emptyTitle="No assigned students"
        emptyMessage="Students appear here once they are enrolled in your classes."
        onRetry={() => {
          void classesQuery.refetch();
          void rosterQuery.refetch();
        }}
      >
        <Surface className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Level</th>
                <th>Class</th>
                <th>Subscription</th>
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
                      {student.subscription}
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
  const { navigate } = useAcademy();
  const { classesQuery, primaryClass, selector } = useClassSelection();
  const rosterQuery = useClassRoster(primaryClass?.id);

  return (
    <>
      <PageHeader
        title={primaryClass?.name ?? "My class"}
        subtitle={
          primaryClass
            ? `${rosterQuery.data?.length ?? 0} students · ${primaryClass.schedule} · ${primaryClass.teacher}`
            : "Classes assigned to you"
        }
        action={
          <Button onClick={() => primaryClass && navigate("attendance", { classId: primaryClass.id })} disabled={!primaryClass}>
            <UserCheck />
            Take attendance
          </Button>
        }
      />
      {selector}
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Metric label="Enrolled" value={String(rosterQuery.data?.length ?? "—")} />
        <Metric label="Level" value={primaryClass?.level ?? "—"} />
        <Metric label="Room" value={primaryClass?.room ?? "—"} />
      </div>
      <QueryState
        isLoading={classesQuery.isLoading || rosterQuery.isLoading}
        isError={classesQuery.isError || rosterQuery.isError}
        error={(classesQuery.error ?? rosterQuery.error) as Error | null}
        isEmpty={!rosterQuery.data?.length}
        emptyMessage="No enrolled students in this class yet."
      >
        <Surface className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Attendance</th>
                <th>Progress</th>
                <th>Average</th>
                <th>Status</th>
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
                  <td>{student.attendance || "—"}%</td>
                  <td>
                    <div className="w-28">
                      <ProgressLine value={student.progress} />
                    </div>
                  </td>
                  <td>{student.average || "—"}%</td>
                  <td>
                    <Status tone="green">Active</Status>
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
  if (page === "payments" || page === "subscriptions" || page === "invoices" || page === "payroll")
    return <FinancePages mode={page === "payroll" ? "payments" : page} />;
  if (page === "audit") return <AuditPage />;
  if (page === "materials") return <MaterialsLibraryPage />;
  if (page === "assignments") return <DirectorAssignmentsPage />;
  if (page === "calendar") return <CalendarPage />;
  if (page === "live" || page === "meeting")
    return <LiveClassesPage meeting={page === "meeting"} />;
  if (page === "messages") return <Messages counterpart="Ahmed Benali" />;
  if (page === "reports") return <DirectorReports />;
  if (page === "settings") return <DirectorSettings />;
  return <PremiumDirectorDashboard />;
}

function accountStatusLabel(status: AccountStatus) {
  switch (status) {
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
    case "restricted":
      return "amber";
    case "suspended":
      return "red";
    default:
      return "gray";
  }
}

function Students() {
  const { navigate } = useAcademy();
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState<Student | null>(null);
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [classId, setClassId] = useState("");
  const [confirmStatus, setConfirmStatus] = useState<AccountStatus | null>(null);

  const studentsQuery = useStudents(query);
  const allStudents = useStudents();
  const classesQuery = useClasses();
  const teachersQuery = useTeachers();
  const enroll = useCreateEnrollment();
  const setProfileStatus = useSetProfileStatus();

  const filtered = (studentsQuery.data ?? []).filter((student) => {
    if (levelFilter && student.level !== levelFilter) return false;
    if (groupFilter && student.classId !== groupFilter && student.className !== groupFilter)
      return false;
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
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Étudiants"
        subtitle={`${filtered.length} apprenant${filtered.length > 1 ? "s" : ""} dans l’académie.`}
        action={<Button onClick={() => setEnrollmentOpen(true)}>+ Inscrire dans un groupe</Button>}
      />

      {enrollmentOpen && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <h2 className="font-semibold">Inscrire un étudiant dans un groupe</h2>
            <QueryState
              isLoading={allStudents.isLoading || classesQuery.isLoading}
              isError={allStudents.isError || classesQuery.isError}
              error={allStudents.error ?? classesQuery.error}
            >
              <label className="block text-sm">
                Étudiant
                <select
                  className="mt-1 w-full rounded-md border bg-background p-2"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                >
                  <option value="">Choisir un étudiant</option>
                  {allStudents.data?.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.lastName} {student.firstName} · {student.email}
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
                  {classesQuery.data?.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
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
                disabled={
                  !studentId ||
                  !classId ||
                  enroll.isPending ||
                  allStudents.isError ||
                  classesQuery.isError
                }
                onClick={() =>
                  enroll.mutate(
                    { studentId, classId },
                    {
                      onSuccess: () => {
                        toast.success("Inscription enregistrée");
                        setEnrollmentOpen(false);
                        setStudentId("");
                        setClassId("");
                      },
                      onError: (err) => toast.error(err.message),
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
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
        >
          <option value="">Tous les niveaux</option>
          {(["A1", "A2", "B1", "B2"] as Level[]).map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
        >
          <option value="">Tous les groupes</option>
          {classesQuery.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
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
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actif</option>
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
        emptyMessage="Aucun étudiant trouvé."
      >
        <div className="space-y-3 md:hidden">
          {filtered.map((student) => (
            <Surface
              key={student.id}
              className="space-y-3 p-4"
              onClick={() => setDetail(student)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {student.lastName} {student.firstName}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">{student.email}</p>
                </div>
                <Status tone={accountStatusTone(student.accountStatus)}>
                  {accountStatusLabel(student.accountStatus)}
                </Status>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <span>Niveau · {student.level}</span>
                <span className="truncate">Groupe · {student.className || "—"}</span>
              </div>
            </Surface>
          ))}
        </div>
        <Surface className="table-scroll hidden md:block">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Prénom</th>
                <th>E-mail</th>
                <th>Téléphone</th>
                <th>Niveau</th>
                <th>Groupe</th>
                <th>Professeur</th>
                <th>Statut compte</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => (
                <tr
                  key={student.id}
                  className="cursor-pointer"
                  onClick={() => setDetail(student)}
                >
                  <td>
                    <strong>{student.lastName || "—"}</strong>
                  </td>
                  <td>{student.firstName || "—"}</td>
                  <td>{student.email || "—"}</td>
                  <td>{student.phone || "—"}</td>
                  <td>{student.level}</td>
                  <td>{student.className}</td>
                  <td>{student.teacherName || "—"}</td>
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
                {detail.level}
              </p>
              <p>
                <span className="text-muted-foreground">Groupe</span>
                <br />
                {detail.className}
              </p>
              <p>
                <span className="text-muted-foreground">Professeur</span>
                <br />
                {detail.teacherName || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Abonnement</span>
                <br />
                {detail.subscription}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => navigate("student360", { studentId: detail.id })}
              >
                Fiche 360°
              </Button>
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
              <Button disabled={setProfileStatus.isPending} onClick={() => applyStatus(confirmStatus)}>
                Confirmer
              </Button>
            </div>
          </Surface>
        </div>
      )}
    </>
  );
}

function Classes() {
  const classesQuery = useClasses();
  const levelsQuery = useLevels();
  const teachersQuery = useTeachers();
  const studentsQuery = useStudents();
  const createClass = useCreateClass();
  const updateClass = useUpdateClass();
  const createEnrollment = useCreateEnrollment();
  const removeEnrollment = useRemoveEnrollment();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [levelId, setLevelId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [schedule, setSchedule] = useState("");
  const [room, setRoom] = useState("");
  const [addStudentId, setAddStudentId] = useState("");

  const rosterQuery = useClassRoster(selectedId);
  const enrollmentsQuery = useEnrollmentsByClass(selectedId);
  const levelOptions = levelsQuery.data ?? [];
  const teacherOptions = teachersQuery.data ?? [];
  const selected = classesQuery.data?.find((item) => item.id === selectedId) ?? null;

  const resetForm = () => {
    setName("");
    setLevelId("");
    setTeacherId("");
    setSchedule("");
    setRoom("");
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
    setLevelId(item.levelId ?? "");
    setTeacherId(item.teacherId ?? "");
    setSchedule(item.schedule === "—" ? "" : item.schedule);
    setRoom(item.room === "—" ? "" : item.room);
    setOpen(true);
  };

  const enrollmentIdForStudent = (studentId: string) => {
    const row = (enrollmentsQuery.data ?? []).find(
      (e) => e.student_id === studentId && e.status === "active",
    );
    return row?.id;
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
        emptyMessage="Aucun groupe pour le moment. Créez le premier."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classesQuery.data?.map((item) => (
            <Surface
              className="cursor-pointer p-5"
              key={item.id}
              onClick={() => setSelectedId(item.id)}
            >
              <div className="flex justify-between">
                <span className="grid size-10 place-items-center rounded-md bg-secondary font-semibold text-primary">
                  {item.level}
                </span>
                <Status tone={item.status === "active" ? "green" : "amber"}>{item.status}</Status>
              </div>
              <h2 className="mt-4 text-lg font-semibold">{item.name}</h2>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>
                  Professeur : <strong className="text-foreground">{item.teacher}</strong>
                </p>
                <p>
                  {item.size}/{item.capacity} étudiants · {item.schedule}
                </p>
                <p>{item.room}</p>
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
            <Input
              placeholder="Nom du groupe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
            <Input
              placeholder="Horaires"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
            />
            <Input placeholder="Salle" value={room} onChange={(e) => setRoom(e.target.value)} />
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
                disabled={!name.trim() || !levelId || createClass.isPending || updateClass.isPending}
                onClick={() => {
                  if (editingId) {
                    updateClass.mutate(
                      {
                        id: editingId,
                        patch: {
                          name: name.trim(),
                          level_id: levelId,
                          teacher_id: teacherId || null,
                          schedule_label: schedule || null,
                          room: room || null,
                        },
                      },
                      {
                        onSuccess: () => {
                          toast.success("Groupe mis à jour");
                          setOpen(false);
                          resetForm();
                        },
                        onError: (err) => toast.error(err.message),
                      },
                    );
                    return;
                  }
                  createClass.mutate(
                    {
                      name: name.trim(),
                      levelId,
                      teacherId: teacherId || null,
                      scheduleLabel: schedule || null,
                      room: room || null,
                      status: "active",
                    },
                    {
                      onSuccess: () => {
                        toast.success("Groupe créé");
                        setOpen(false);
                        resetForm();
                      },
                      onError: (err) => toast.error(err.message),
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
                      onSuccess: () => toast.success(next ? "Professeur associé" : "Professeur retiré"),
                      onError: (err) => toast.error(err.message),
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

            <div className="flex flex-wrap gap-2">
              <select
                className="h-10 min-w-48 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                value={addStudentId}
                onChange={(e) => setAddStudentId(e.target.value)}
              >
                <option value="">Ajouter un étudiant…</option>
                {studentsQuery.data
                  ?.filter((s) => !(rosterQuery.data ?? []).some((r) => r.id === s.id))
                  .map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.lastName} {student.firstName}
                    </option>
                  ))}
              </select>
              <Button
                disabled={!addStudentId || createEnrollment.isPending}
                onClick={() =>
                  createEnrollment.mutate(
                    { studentId: addStudentId, classId: selected.id },
                    {
                      onSuccess: () => {
                        toast.success("Étudiant ajouté au groupe");
                        setAddStudentId("");
                      },
                      onError: (err) => toast.error(err.message),
                    },
                  )
                }
              >
                Ajouter
              </Button>
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
                            variant="outline"
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
                                  onError: (err) => toast.error(err.message),
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
                <span className="grid size-12 place-items-center rounded-full bg-secondary font-semibold text-primary">
                  {[teacher.firstName, teacher.lastName]
                    .filter(Boolean)
                    .map((part) => part[0])
                    .join("") || "?"}
                </span>
                <Status tone={accountStatusTone(teacher.accountStatus)}>
                  {accountStatusLabel(teacher.accountStatus)}
                </Status>
              </div>
              <h2 className="mt-4 font-semibold">{teacher.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{teacher.email || teacher.subject}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {teacher.levels.length ? (
                  teacher.levels.map((level) => <Status key={level}>{level}</Status>)
                ) : (
                  <span className="text-sm text-muted-foreground">Aucun niveau</span>
                )}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {teacher.classes.length
                  ? `${teacher.classes.length} groupe${teacher.classes.length > 1 ? "s" : ""}`
                  : "Aucun groupe assigné"}
              </p>
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
              placeholder="Mot de passe temporaire"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
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
                      onSuccess: (result) => {
                        if (result && "needsEmailConfirmation" in result) {
                          toast.success(
                            "Compte créé. Une confirmation e-mail a été envoyée au professeur.",
                          );
                        } else {
                          toast.success("Professeur créé");
                        }
                        setOpen(false);
                        setFirstName("");
                        setLastName("");
                        setEmail("");
                        setPhone("");
                        setPassword("");
                      },
                      onError: (err) => toast.error(err.message),
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
              <Status tone={accountStatusTone(selected.accountStatus)}>
                {accountStatusLabel(selected.accountStatus)}
              </Status>
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
                    const count = (studentsQuery.data ?? []).filter(
                      (s) => s.classId === group.id || s.className === group.name,
                    ).length;
                    return (
                      <Surface key={group.id} className="flex items-center justify-between gap-3 p-3">
                        <div>
                          <strong>{group.name}</strong>
                          <p className="text-sm text-muted-foreground">
                            {group.level} · {count} étudiant{count > 1 ? "s" : ""}
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
                                onError: (err) => toast.error(err.message),
                              },
                            )
                          }
                        >
                          Retirer
                        </Button>
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
                      onError: (err) => toast.error(err.message),
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
                      onError: (err) => toast.error(err.message),
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
                      onError: (err) => toast.error(err.message),
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
                      onError: (err) => toast.error(err.message),
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
    </>
  );
}
