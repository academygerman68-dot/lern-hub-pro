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
  useLevels,
  useStudents,
  useTeachers,
} from "@/hooks/use-academy-data";
import type { AcademyPage } from "@/types/academy";
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
import { LEAD_TEACHER } from "@/data/demo-accounts";

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
  const classesQuery = useClasses();
  const primaryClass = classesQuery.data?.[0];
  const rosterQuery = useClassRoster(primaryClass?.id);
  return (
    <>
      <PageHeader
        title="Students"
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
  const classesQuery = useClasses();
  const primaryClass = classesQuery.data?.[0];
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
          <Button onClick={() => navigate("attendance")} disabled={!primaryClass}>
            <UserCheck />
            Take attendance
          </Button>
        }
      />
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
  if (page === "audit") return <Audit />;
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

function Students() {
  const { navigate, role } = useAcademy();
  const isTeacher = role === "teacher";
  const [query, setQuery] = useState("");
  const studentsQuery = useStudents(query);
  const enroll = useCreateEnrollment();
  const classesQuery = useClasses();
  return (
    <>
      <PageHeader
        title="Students"
        subtitle={
          isTeacher
            ? `${studentsQuery.data?.length ?? 0} learners in your classes.`
            : `${studentsQuery.data?.length ?? 0} learners in the academy.`
        }
        action={
          isTeacher ? undefined : (
            <Button
              onClick={() => {
                const studentId = studentsQuery.data?.[0]?.id;
                const classId = classesQuery.data?.[0]?.id;
                if (!studentId || !classId) {
                  toast.message(
                    "Create a class first, then enroll students with existing profiles.",
                  );
                  return;
                }
                enroll.mutate(
                  { studentId, classId },
                  {
                    onSuccess: () => toast.success("Enrollment created"),
                    onError: (err) => toast.error(err.message),
                  },
                );
              }}
            >
              + Enroll in class
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-0 w-full flex-1 sm:min-w-60">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search students…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      <QueryState
        isLoading={studentsQuery.isLoading}
        isError={studentsQuery.isError}
        error={studentsQuery.error}
        isEmpty={!studentsQuery.data?.length}
        emptyMessage="No students found."
      >
        <div className="space-y-3 md:hidden">
          {studentsQuery.data?.map((student) => (
            <Surface
              key={student.id}
              className="space-y-3 p-4"
              onClick={() => navigate("student360", { studentId: student.id })}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{student.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{student.email}</p>
                </div>
                {!isTeacher && (
                  <Status
                    tone={
                      student.subscription === "ACTIVE"
                        ? "green"
                        : student.subscription === "PAST_DUE"
                          ? "amber"
                          : "red"
                    }
                  >
                    {student.subscription}
                  </Status>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <span>Level · {student.level}</span>
                <span className="truncate">Class · {student.className || "—"}</span>
              </div>
            </Surface>
          ))}
        </div>
        <Surface className="table-scroll hidden md:block">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Level</th>
                <th>Class</th>
                <th>Progress</th>
                <th>Attendance</th>
                {!isTeacher && <th>Subscription</th>}
              </tr>
            </thead>
            <tbody>
              {studentsQuery.data?.map((student) => (
                <tr
                  key={student.id}
                  className="cursor-pointer"
                  onClick={() => navigate("student360", { studentId: student.id })}
                >
                  <td>
                    <strong>{student.name}</strong>
                    <small className="block text-muted-foreground">{student.email}</small>
                  </td>
                  <td>{student.level}</td>
                  <td>{student.className}</td>
                  <td>{student.progress || "—"}%</td>
                  <td>{student.attendance || "—"}%</td>
                  {!isTeacher && (
                    <td>
                      <Status
                        tone={
                          student.subscription === "ACTIVE"
                            ? "green"
                            : student.subscription === "PAST_DUE"
                              ? "amber"
                              : "red"
                        }
                      >
                        {student.subscription}
                      </Status>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      </QueryState>
    </>
  );
}

function Classes() {
  const classesQuery = useClasses();
  const levelsQuery = useLevels();
  const teachersQuery = useTeachers();
  const createClass = useCreateClass();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [levelId, setLevelId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [schedule, setSchedule] = useState("");
  const [room, setRoom] = useState("");
  const levelOptions = levelsQuery.data ?? [];
  const teacherOptions = teachersQuery.data ?? [];

  return (
    <>
      <PageHeader
        title="Classes"
        subtitle="Schedules, teachers and capacity across all levels."
        action={<Button onClick={() => setOpen(true)}>+ Create class</Button>}
      />
      <QueryState
        isLoading={classesQuery.isLoading}
        isError={classesQuery.isError}
        error={classesQuery.error}
        isEmpty={!classesQuery.data?.length}
        emptyMessage="No classes yet. Create the first one."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classesQuery.data?.map((item) => (
            <Surface className="p-5" key={item.id}>
              <div className="flex justify-between">
                <span className="grid size-10 place-items-center rounded-md bg-secondary font-semibold text-primary">
                  {item.level}
                </span>
                <Status tone={item.status === "active" ? "green" : "amber"}>{item.status}</Status>
              </div>
              <h2 className="mt-4 text-lg font-semibold">{item.name}</h2>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>
                  Teacher: <strong className="text-foreground">{item.teacher}</strong>
                </p>
                <p>
                  {item.size}/{item.capacity} students · {item.schedule}
                </p>
                <p>{item.room}</p>
              </div>
            </Surface>
          ))}
        </div>
      </QueryState>

      {open && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <h2 className="text-lg font-semibold">Create class</h2>
            <Input
              placeholder="Class name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={levelId}
              onChange={(e) => setLevelId(e.target.value)}
            >
              <option value="">Select level</option>
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
              <option value="">Assign teacher (optional)</option>
              {teacherOptions.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
            <Input
              placeholder="Schedule label"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
            />
            <Input placeholder="Room" value={room} onChange={(e) => setRoom(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!name.trim() || !levelId || createClass.isPending}
                onClick={() => {
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
                        toast.success("Class created");
                        setOpen(false);
                        setName("");
                        setLevelId("");
                        setTeacherId("");
                        setSchedule("");
                        setRoom("");
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

function Teachers() {
  const teachersQuery = useTeachers();
  return (
    <>
      <PageHeader
        title="Teachers"
        subtitle="Faculty overview and assigned classes."
        action={
          <Button
            onClick={() =>
              toast.message("Teachers are created from Auth profiles with role teacher.")
            }
          >
            + Add teacher
          </Button>
        }
      />
      <QueryState
        isLoading={teachersQuery.isLoading}
        isError={teachersQuery.isError}
        error={teachersQuery.error}
        isEmpty={!teachersQuery.data?.length}
        emptyMessage="No teachers found."
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teachersQuery.data?.map((teacher) => (
            <Surface className="p-5" key={teacher.id}>
              <span className="grid size-12 place-items-center rounded-full bg-secondary font-semibold text-primary">
                {teacher.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </span>
              <h2 className="mt-4 font-semibold">{teacher.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{teacher.subject}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {teacher.classes.length ? (
                  teacher.classes.map((item) => <Status key={item}>{item}</Status>)
                ) : (
                  <span className="text-sm text-muted-foreground">No classes assigned</span>
                )}
              </div>
            </Surface>
          ))}
        </div>
      </QueryState>
    </>
  );
}

function Audit() {
  const logs = [
    ["Samira El Mansouri", "activated Ahmed's subscription"],
    [LEAD_TEACHER, "published A2 lesson"],
    ["Director", "changed A2 exam status"],
    ["Finance Admin", "recorded payment"],
    ["Ahmed Benali", "submitted assignment"],
  ];
  return (
    <>
      <PageHeader title="Audit Logs" subtitle="Traceable activity across the academy." />
      <Surface className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Action</th>
              <th>Date</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(([user, action]) => (
              <tr key={`${user}-${action}`}>
                <td className="font-medium">{user}</td>
                <td>{action}</td>
                <td>15 Sep 2026</td>
                <td>09:40</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>
    </>
  );
}
