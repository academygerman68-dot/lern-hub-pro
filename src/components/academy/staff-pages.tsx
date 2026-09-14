import { useState } from "react";
import { ClipboardCheck, FilePlus2, Search, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LEAD_TEACHER } from "@/data/demo-accounts";
import { classes, lessons, students, teachers } from "@/data/mock-data";
import { StudentService } from "@/services/academy-services";
import { useQuery } from "@tanstack/react-query";
import type { AcademyPage } from "@/types/academy";
import { useAcademy } from "./academy-context";
import { Metric, PageHeader, ProgressLine, Status, Surface } from "./primitives";
import {
  PremiumDirectorDashboard,
  PremiumStudent360,
  PremiumTeacherDashboard,
} from "./premium-screens";
import {
  CalendarPage,
  DirectorAssignments,
  DirectorReports,
  DirectorSettings,
  Materials,
  Messages,
  StaffExams,
  TeacherProfile,
} from "./student-extra";

export function TeacherPages({ page: pageProp }: { page?: AcademyPage } = {}) {
  const { page: contextPage } = useAcademy();
  const page = pageProp ?? contextPage;
  if (page === "classes") return <TeacherClass />;
  if (page === "lessons") return <LessonManager />;
  if (page === "assignments") return <Grading />;
  if (page === "attendance") return <Attendance />;
  if (page === "calendar") return <CalendarPage />;
  if (page === "materials") return <Materials />;
  if (page === "exams") return <StaffExams />;
  if (page === "messages") return <Messages />;
  if (page === "profile") return <TeacherProfile />;
  return <PremiumTeacherDashboard />;
}

function TeacherClass() {
  const { navigate } = useAcademy();
  return (
    <>
      <PageHeader
        title="A2 Group 2"
        subtitle={`15 students · Tuesday & Thursday · 18:00 – 19:30 · ${LEAD_TEACHER}`}
        action={
          <Button onClick={() => navigate("attendance")}>
            <UserCheck />
            Take attendance
          </Button>
        }
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Metric label="Average progress" value="72%" />
        <Metric label="Attendance" value="93%" />
        <Metric label="Class average" value="79%" />
      </div>
      <Surface className="overflow-x-auto">
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
            {students
              .filter((student) => student.level === "A2")
              .map((student) => (
                <tr key={student.id}>
                  <td>
                    <strong>{student.name}</strong>
                    <small className="block text-muted-foreground">{student.id}</small>
                  </td>
                  <td>{student.attendance}%</td>
                  <td>
                    <div className="w-28">
                      <ProgressLine value={student.progress} />
                    </div>
                  </td>
                  <td>{student.average}%</td>
                  <td>
                    <Status tone="green">Active</Status>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </Surface>
    </>
  );
}

function LessonManager() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageHeader
        title="Lessons"
        subtitle="Build and publish course content for your classes."
        action={
          <Button onClick={() => setOpen(true)}>
            <FilePlus2 />
            Create lesson
          </Button>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        {lessons.map((lesson) => (
          <Surface className="p-5" key={lesson.id}>
            <Status tone={lesson.status === "DRAFT" ? "gray" : "green"}>{lesson.status}</Status>
            <h2 className="mt-4 font-semibold">{lesson.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {lesson.level} · {lesson.module} · {lesson.resources} resources
            </p>
            <Button variant="outline" size="sm" className="mt-5">
              Edit lesson
            </Button>
          </Surface>
        ))}
      </div>
      {open && (
        <div className="modal-backdrop">
          <Surface className="modal-panel p-6">
            <h2 className="text-xl font-semibold">Create lesson</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Title
                <Input className="mt-2" placeholder="Lesson title" />
              </label>
              <label className="text-sm font-medium">
                Level
                <Input className="mt-2" defaultValue="A2" />
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                Module
                <Input className="mt-2" placeholder="Module" />
              </label>
              <label className="text-sm font-medium sm:col-span-2">
                Description
                <Textarea className="mt-2" placeholder="Learning objectives…" />
              </label>
            </div>
            <div className="mt-7 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setOpen(false);
                  toast.success("Lesson published");
                }}
              >
                Publish lesson
              </Button>
            </div>
          </Surface>
        </div>
      )}
    </>
  );
}

function Grading() {
  const [grade, setGrade] = useState("82");
  const [selected, setSelected] = useState(false);
  if (selected) {
    return (
      <>
        <PageHeader title="Grade assignment" subtitle="Ahmed Benali · German Email Writing" />
        <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
          <Surface className="p-6">
            <h2 className="font-semibold">Student response</h2>
            <p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted-foreground">
              {`Sehr geehrte Frau Schneider,\n\nleider komme ich heute ungefähr 15 Minuten später zur Besprechung. Mein Bus hat Verspätung. Bitte beginnen Sie ohne mich.\n\nMit freundlichen Grüßen,\nAhmed Benali`}
            </p>
          </Surface>
          <Surface className="p-6">
            <label className="text-sm font-medium">
              Grade / 100
              <Input
                className="mt-2"
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
              />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Feedback
              <Textarea
                className="mt-2"
                defaultValue="Sehr gut strukturiert. Achte noch auf die Wortstellung."
              />
            </label>
            <Button
              className="mt-5 w-full"
              onClick={() => {
                toast.success("Marked as graded");
                setSelected(false);
              }}
            >
              Mark as graded
            </Button>
          </Surface>
        </div>
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Assignments to grade"
        subtitle="Review student work and provide actionable feedback."
      />
      <Surface className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Assignment</th>
              <th>Submitted</th>
              <th>Grade</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {students.slice(0, 8).map((student, index) => (
              <tr key={student.id}>
                <td className="font-medium">{student.name}</td>
                <td>{index % 2 ? "Listening Exercise" : "German Email Writing"}</td>
                <td>
                  {index + 10} Sep · {16 + index}:20
                </td>
                <td>{index < 2 ? "—" : `${74 + index}%`}</td>
                <td>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(true)}>
                    {index < 2 ? "Grade" : "Review"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>
    </>
  );
}

function Attendance() {
  const [states, setStates] = useState<Record<string, string>>({});
  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="A2 Group 2 · Today, 18:00"
        action={<Button onClick={() => toast.success("Attendance saved")}>Save attendance</Button>}
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Metric label="Present" value="12" />
        <Metric label="Late" value="2" />
        <Metric label="Absent" value="1" />
      </div>
      <Surface className="divide-y">
        {students
          .filter((student) => student.level === "A2")
          .map((student) => (
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center" key={student.id}>
              <span className="flex-1 font-medium">{student.name}</span>
              <div className="flex flex-wrap gap-2">
                {["Present", "Absent", "Late", "Excused"].map((item) => (
                  <Button
                    key={item}
                    size="sm"
                    variant={(states[student.id] ?? "Present") === item ? "default" : "outline"}
                    onClick={() => setStates({ ...states, [student.id]: item })}
                  >
                    {item}
                  </Button>
                ))}
              </div>
            </div>
          ))}
      </Surface>
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
  if (page === "courses" || page === "levels") return <Courses />;
  if (page === "exams") return <ExamManagement />;
  if (page === "payments" || page === "subscriptions" || page === "invoices")
    return <Finance mode={page} />;
  if (page === "audit") return <Audit />;
  if (page === "materials") return <Materials />;
  if (page === "assignments") return <DirectorAssignments />;
  if (page === "calendar") return <CalendarPage />;
  if (page === "messages") return <Messages counterpart="Ahmed Benali" />;
  if (page === "reports") return <DirectorReports />;
  if (page === "settings") return <DirectorSettings />;
  return <PremiumDirectorDashboard />;
}

function Students() {
  const { navigate } = useAcademy();
  const [query, setQuery] = useState("");
  const { data = students } = useQuery({ queryKey: ["students"], queryFn: StudentService.list });
  return (
    <>
      <PageHeader
        title="Students"
        subtitle="Manage enrollment, progress and access for 243 learners."
        action={
          <Button onClick={() => toast.success("Add student form opened")}>+ Add student</Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search students…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>
      <Surface className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Level</th>
              <th>Class</th>
              <th>Progress</th>
              <th>Attendance</th>
              <th>Subscription</th>
            </tr>
          </thead>
          <tbody>
            {data
              .filter((student) => student.name.toLowerCase().includes(query.toLowerCase()))
              .map((student) => (
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
                  <td>{student.progress}%</td>
                  <td>{student.attendance}%</td>
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
                </tr>
              ))}
          </tbody>
        </table>
      </Surface>
    </>
  );
}

function Classes() {
  return (
    <>
      <PageHeader
        title="Classes"
        subtitle="Schedules, teachers and capacity across all levels."
        action={<Button>+ Create class</Button>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {classes.map((item) => (
          <Surface className="p-5" key={item.id}>
            <div className="flex justify-between">
              <span className="grid size-10 place-items-center rounded-md bg-secondary font-semibold text-primary">
                {item.level}
              </span>
              <Status tone="green">Active</Status>
            </div>
            <h2 className="mt-4 text-lg font-semibold">{item.id}</h2>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>
                Teacher: <strong className="text-foreground">{item.teacher}</strong>
              </p>
              <p>
                {item.size} students · {item.schedule}
              </p>
              <p>{item.room}</p>
            </div>
          </Surface>
        ))}
      </div>
    </>
  );
}

function Teachers() {
  return (
    <>
      <PageHeader
        title="Teachers"
        subtitle="Faculty overview and assigned classes."
        action={<Button>+ Add teacher</Button>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {teachers.map((teacher) => (
          <Surface className="p-5" key={teacher.id}>
            <span className="grid size-12 place-items-center rounded-full bg-secondary font-semibold text-primary">
              {teacher.name
                .split(" ")
                .map((part) => part[0])
                .join("")}
            </span>
            <h2 className="mt-4 font-semibold">{teacher.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{teacher.subject}</p>
            <div className="mt-4 flex gap-2">
              {teacher.classes.map((item) => (
                <Status key={item}>{item}</Status>
              ))}
            </div>
          </Surface>
        ))}
      </div>
    </>
  );
}

function Courses() {
  return (
    <>
      <PageHeader
        title="Course Management"
        subtitle="Curriculum structure across A1 to B2."
        action={<Button>+ Create module</Button>}
      />
      <div className="space-y-3">
        {[
          "A1 · Foundations",
          "A2 · Everyday German",
          "B1 · Independent German",
          "B2 · Advanced German",
        ].map((label, index) => (
          <Surface className="p-5" key={label}>
            <div className="flex items-center gap-4">
              <span className="grid size-11 place-items-center rounded-md bg-primary font-semibold text-primary-foreground">
                {label.slice(0, 2)}
              </span>
              <div className="flex-1">
                <h2 className="font-semibold">{label}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {5 + index} modules → {24 + index * 4} units → {52 + index * 7} lessons →
                  materials → exercises
                </p>
              </div>
              <Button variant="outline" size="sm">
                Manage
              </Button>
            </div>
          </Surface>
        ))}
      </div>
    </>
  );
}

function ExamManagement() {
  const { examPublished, setExamPublished } = useAcademy();
  const [create, setCreate] = useState(false);
  return (
    <>
      <PageHeader
        title="Exam Management"
        subtitle="Create assessments, manage question banks and publication."
        action={<Button onClick={() => setCreate(true)}>+ Create Exam</Button>}
      />
      <div className="space-y-3">
        {["A1 Mock Exam 01", "A2 Mock Exam 01", "A2 Mock Exam 02", "B2 Mock Exam 01"].map(
          (title, index) => (
            <Surface className="flex items-center gap-4 p-5" key={title}>
              <span className="grid size-10 place-items-center rounded-md bg-secondary text-primary">
                <ClipboardCheck />
              </span>
              <div className="flex-1">
                <h2 className="font-semibold">{title}</h2>
                <p className="text-xs text-muted-foreground">
                  Hören · scored questions · 30 minutes · Pass 60%
                </p>
              </div>
              <Status tone={(index === 2 && !examPublished) || index === 3 ? "gray" : "green"}>
                {(index === 2 && !examPublished) || index === 3 ? "DRAFT" : "PUBLISHED"}
              </Status>
            </Surface>
          ),
        )}
      </div>
      {create && (
        <div className="modal-backdrop">
          <Surface className="modal-panel p-6">
            <h2 className="text-xl font-semibold">Create Exam</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {["Level", "Skill", "Questions", "Duration", "Passing score"].map((label) => (
                <label className="text-sm font-medium" key={label}>
                  {label}
                  <Input
                    className="mt-2"
                    defaultValue={label === "Level" ? "A2" : label === "Skill" ? "Hören" : ""}
                  />
                </label>
              ))}
            </div>
            <div className="mt-7 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreate(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setExamPublished(true);
                  setCreate(false);
                  toast.success("Exam published · Student access updated");
                }}
              >
                {examPublished ? "Publish again" : "Publish exam"}
              </Button>
            </div>
          </Surface>
        </div>
      )}
    </>
  );
}

function Finance({ mode }: { mode: string }) {
  const { session } = useAcademy();
  const [status, setStatus] = useState("PAST DUE");
  const title =
    mode === "subscriptions"
      ? "Subscription Management"
      : mode === "invoices"
        ? "Invoices"
        : "Payment Management";
  const rows = session?.invoices ?? [];
  return (
    <>
      <PageHeader
        title={title}
        subtitle="Payments, subscriptions and invoices are tracked as distinct business records."
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Revenue this month" value="184,500 MAD" />
        <Metric label="Paid" value="231" />
        <Metric label="Pending" value="7" />
        <Metric label="Overdue" value="12" />
      </div>
      <Surface className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>{mode === "invoices" ? "Invoice" : "Student"}</th>
              <th>{mode === "subscriptions" ? "Plan" : "Period"}</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="font-medium">{mode === "invoices" ? row.id : row.studentName}</td>
                <td>{mode === "subscriptions" ? "A2 Monthly" : row.period}</td>
                <td>{row.amount.toLocaleString("en-US")} MAD</td>
                <td>{row.date}</td>
                <td>
                  <Status
                    tone={
                      row.status === "PAID" ? "green" : row.status === "PENDING" ? "amber" : "red"
                    }
                  >
                    {row.status}
                  </Status>
                </td>
                <td>
                  {row.studentName === "Lina Idrissi" ? (
                    <span className="space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toast.success("Reminder sent")}
                      >
                        Send reminder
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setStatus("ACTIVE");
                          toast.success("Payment marked as paid · Access active");
                        }}
                      >
                        Mark paid
                      </Button>
                    </span>
                  ) : (
                    <Button size="sm" variant="ghost">
                      View
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            <tr>
              <td className="font-medium">Lina Idrissi</td>
              <td>A2 Monthly</td>
              <td>1,200 MAD</td>
              <td>01 Sep 2026</td>
              <td>
                <Status tone={status === "PAST DUE" ? "amber" : "green"}>{status}</Status>
              </td>
              <td className="space-x-1">
                <Button size="sm" variant="outline" onClick={() => toast.success("Reminder sent")}>
                  Send reminder
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setStatus("ACTIVE");
                    toast.success("Payment marked as paid · Access active");
                  }}
                >
                  Mark paid
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </Surface>
      <Surface className="mt-5 p-5">
        <h2 className="font-semibold">Access policy</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-success-soft p-4">
            <Status tone="green">ACTIVE</Status>
            <p className="mt-2 text-sm font-medium">Full access</p>
          </div>
          <div className="rounded-md bg-warning-soft p-4">
            <Status tone="amber">PAST DUE</Status>
            <p className="mt-2 text-sm font-medium">Warning</p>
          </div>
          <div className="rounded-md bg-alert-soft p-4">
            <Status tone="red">SUSPENDED</Status>
            <p className="mt-2 text-sm font-medium">Restricted access</p>
          </div>
        </div>
      </Surface>
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
            {logs.map((row, index) => (
              <tr key={row[1]}>
                <td className="font-medium">{row[0]}</td>
                <td>{row[1]}</td>
                <td>13 Sep 2026</td>
                <td>
                  {18 - index}:2{index}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>
    </>
  );
}
