import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Headphones,
  Paperclip,
  Send,
  Upload,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LEAD_TEACHER } from "@/data/demo-accounts";
import { resources } from "@/data/mock-data";
import { AssignmentService, CourseService } from "@/services/academy-services";
import { useQuery } from "@tanstack/react-query";
import { useMyExamAttempts } from "@/hooks/use-academy-data";
import { Metric, PageHeader, ProgressLine, SectionTitle, Status, Surface } from "./primitives";
import { useAcademy } from "./academy-context";
import { QueryState } from "./query-state";

const weekOffsets = ["mt-2", "mt-3", "mt-4", "mt-5", "mt-6", "mt-7", "mt-8"] as const;

export function Materials() {
  const [type, setType] = useState("All");
  const { data = resources } = useQuery({
    queryKey: ["resources"],
    queryFn: CourseService.listResources,
  });
  return (
    <>
      <PageHeader title="Materials" subtitle="Learning resources for every part of your course." />
      <div className="mb-5 flex flex-wrap gap-2">
        {["All", "PDF", "Audio", "Video", "Exercise"].map((item) => (
          <Button
            key={item}
            variant={type === item ? "default" : "outline"}
            size="sm"
            onClick={() => setType(item)}
          >
            {item}
          </Button>
        ))}
      </div>
      <div className="space-y-3">
        {data
          .filter((resource) => type === "All" || resource.type === type)
          .map((resource) => (
            <Surface
              key={resource.title}
              className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
            >
              <span className="grid size-11 place-items-center rounded-md bg-secondary text-primary">
                {resource.type === "Audio" ? (
                  <Headphones />
                ) : resource.type === "Video" ? (
                  <Video />
                ) : (
                  <FileText />
                )}
              </span>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{resource.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {resource.level} · {resource.type} · {resource.date} · {resource.size}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.info(`${resource.title} opened`)}
                >
                  Open
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toast.success("Download prepared")}
                >
                  <Download />
                </Button>
              </div>
            </Surface>
          ))}
      </div>
    </>
  );
}

export function CalendarPage() {
  const events = [
    "A2 German|18:00",
    "Grammar|18:00",
    "Vocabulary Lab|17:30",
    "Speaking|19:00",
    "Assignment due|20:00",
    "Mock Exam|10:00",
    "",
  ];
  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Your classes, exams and deadlines for September 2026."
        action={
          <div className="flex gap-2">
            <Button size="sm">Week</Button>
            <Button size="sm" variant="outline">
              Month
            </Button>
          </div>
        }
      />
      <Surface className="overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground">
          {["Mon 14", "Tue 15", "Wed 16", "Thu 17", "Fri 18", "Sat 19", "Sun 20"].map((day) => (
            <div className="p-4" key={day}>
              {day}
            </div>
          ))}
        </div>
        <div className="grid min-h-[430px] min-w-[760px] grid-cols-7">
          {events.map((event, index) => {
            const offset = weekOffsets[index] ?? "mt-2";
            const [title, time] = event.split("|");
            return (
              <div key={`${event}-${index}`} className="border-r p-2">
                {event && (
                  <div
                    className={`${offset} rounded-md border-l-2 border-primary bg-secondary p-3`}
                  >
                    <strong className="text-xs">{title}</strong>
                    <p className="mt-1 text-[11px] text-muted-foreground">{time}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Surface>
    </>
  );
}

export function Assignments({ detail }: { detail: boolean }) {
  const { navigate } = useAcademy();
  const { data = [] } = useQuery({ queryKey: ["assignments"], queryFn: () => AssignmentService.list() });
  if (detail) {
    return (
      <>
        <button
          onClick={() => navigate("assignments")}
          className="mb-5 flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          Assignments
        </button>
        <PageHeader title="German Email Writing" subtitle="A2 · Module 2 · Due tomorrow" />
        <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
          <Surface className="p-6">
            <h2 className="font-semibold">Instructions</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Write a professional email to your colleague explaining that you will be late for a
              meeting. Use at least 100 words and include an appropriate greeting and closing.
            </p>
            <h3 className="mt-7 text-sm font-semibold">Attached files</h3>
            <div className="mt-3 flex items-center gap-3 rounded-md border p-3">
              <FileText className="text-primary" />
              <span className="flex-1 text-sm">Writing_Guide_A2.pdf</span>
              <Download className="size-4" />
            </div>
          </Surface>
          <Surface className="p-6">
            <h2 className="font-semibold">Your submission</h2>
            <label className="mt-4 grid cursor-pointer place-items-center rounded-lg border border-dashed p-8 text-center">
              <Upload className="text-primary" />
              <span className="mt-2 text-sm font-medium">Upload your work</span>
              <small className="mt-1 text-muted-foreground">PDF or DOCX · max 10 MB</small>
              <input
                type="file"
                className="hidden"
                onChange={() => toast.success("File attached")}
              />
            </label>
            <Button
              className="mt-4 w-full"
              onClick={() => toast.success("Assignment submitted successfully")}
            >
              Submit assignment
            </Button>
          </Surface>
        </div>
      </>
    );
  }
  return (
    <>
      <PageHeader title="Assignments" subtitle="Track your homework, submissions and grades." />
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Homework</th>
              <th>Deadline</th>
              <th>Status</th>
              <th>Grade</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={row.id}>
                <td className="font-medium">{row.title}</td>
                <td>{row.due}</td>
                <td>
                  <Status tone={index === 0 ? "amber" : index === 1 ? "blue" : "green"}>
                    {row.status}
                  </Status>
                </td>
                <td>{row.grade ?? "—"}</td>
                <td>
                  <Button size="sm" variant="ghost" onClick={() => navigate("assignment-detail")}>
                    View
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function Progress() {
  const attemptsQuery = useMyExamAttempts();
  const graded = (attemptsQuery.data ?? []).filter(
    (a) => a.status === "graded" || a.status === "submitted",
  );
  const skillTotals = useMemo(() => {
    const totals: Record<string, { score: number; max: number }> = {};
    for (const attempt of graded) {
      const breakdown = attempt.skill_breakdown;
      if (!breakdown || typeof breakdown !== "object" || Array.isArray(breakdown)) continue;
      for (const [skill, value] of Object.entries(breakdown)) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        const score = Number((value as { score?: unknown }).score ?? 0);
        const max = Number((value as { max?: unknown }).max ?? 0);
        totals[skill] = {
          score: (totals[skill]?.score ?? 0) + score,
          max: (totals[skill]?.max ?? 0) + max,
        };
      }
    }
    return totals;
  }, [graded]);
  const avg =
    graded.length > 0
      ? Math.round(graded.reduce((acc, a) => acc + Number(a.percentage ?? 0), 0) / graded.length)
      : null;
  const skillLabels: Record<string, string> = {
    lesen: "Lesen",
    hoeren: "Hören",
    schreiben: "Schreiben",
    sprechen: "Sprechen",
    grammatik: "Grammatik",
    wortschatz: "Wortschatz",
  };

  return (
    <>
      <PageHeader
        title="My Progress"
        subtitle="Derived from submitted exam attempts — no invented percentages."
      />
      <QueryState
        isLoading={attemptsQuery.isLoading}
        isError={attemptsQuery.isError}
        error={attemptsQuery.error}
        isEmpty={graded.length === 0}
        emptyTitle="Not enough data yet"
        emptyMessage="Complete a mock exam to unlock real skill progress."
        onRetry={() => void attemptsQuery.refetch()}
      >
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <Surface className="p-6">
            <h2 className="font-semibold">Exam average</h2>
            <p className="mt-4 font-display text-5xl">{avg ?? "—"}%</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Across {graded.length} submitted attempt{graded.length === 1 ? "" : "s"}.
            </p>
            <div className="mt-6 space-y-3">
              {graded.slice(0, 5).map((attempt) => (
                <div key={attempt.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {new Date(attempt.submitted_at ?? attempt.started_at).toLocaleDateString()}
                  </span>
                  <span className="font-medium">{Number(attempt.percentage ?? 0).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </Surface>
          <Surface className="p-6">
            <h2 className="font-semibold">Skill breakdown</h2>
            <div className="mt-5 space-y-4">
              {Object.entries(skillTotals).map(([skill, value]) => {
                const pct = value.max > 0 ? Math.round((value.score / value.max) * 100) : 0;
                return (
                  <div key={skill}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{skillLabels[skill] ?? skill}</span>
                      <strong>{pct}%</strong>
                    </div>
                    <ProgressLine value={pct} />
                  </div>
                );
              })}
              {Object.keys(skillTotals).length === 0 && (
                <p className="text-sm text-muted-foreground">No skill scores yet.</p>
              )}
            </div>
          </Surface>
        </div>
      </QueryState>
    </>
  );
}

export function Messages({ counterpart = LEAD_TEACHER }: { counterpart?: string }) {
  const [msgs, setMsgs] = useState([
    `Guten Tag! Your last assignment was very good.`,
    "Danke! Ich werde die Korrekturen ansehen.",
  ]);
  const [text, setText] = useState("");
  return (
    <>
      <PageHeader title="Messages" subtitle="Stay connected with teachers and administration." />
      <Surface className="grid min-h-[600px] overflow-hidden md:grid-cols-[17rem_1fr]">
        <aside className="border-r p-3">
          {[`${counterpart} · Teacher`, "Administration", "A2 Group"].map((item, index) => (
            <button
              className={`mb-1 w-full rounded-md p-3 text-left text-sm ${index === 0 ? "bg-secondary text-primary" : "hover:bg-muted"}`}
              key={item}
            >
              {item}
              <small className="mt-1 block text-muted-foreground">
                {index === 0 ? "10 min ago" : "Yesterday"}
              </small>
            </button>
          ))}
        </aside>
        <div className="flex flex-col">
          <div className="border-b p-4">
            <strong>{counterpart}</strong>
            <small className="ml-2 text-success">● Online</small>
          </div>
          <div className="flex-1 space-y-3 p-5">
            {msgs.map((message, index) => (
              <div
                key={`${message}-${index}`}
                className={`max-w-md rounded-lg p-3 text-sm ${index % 2 ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {message}
              </div>
            ))}
          </div>
          <form
            className="flex gap-2 border-t p-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (text) {
                setMsgs([...msgs, text]);
                setText("");
              }
            }}
          >
            <Button variant="ghost" size="icon" type="button">
              <Paperclip />
            </Button>
            <Input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Write a message…"
            />
            <Button size="icon">
              <Send />
            </Button>
          </form>
        </div>
      </Surface>
    </>
  );
}

export function TeacherProfile() {
  return (
    <>
      <PageHeader title={LEAD_TEACHER} subtitle="Faculty profile · A2 / B1" />
      <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
        <Surface className="p-6">
          <h2 className="font-semibold">{LEAD_TEACHER}</h2>
          <p className="mt-2 text-sm text-muted-foreground">anna@demo.ma</p>
          <p className="mt-4 text-sm">Assigned classes: A2-G2, B1-G1</p>
        </Surface>
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric label="Students" value="42" />
          <Metric label="Classes this week" value="6" />
          <Metric label="Assignments to grade" value="8" icon={<CheckCircle2 />} />
        </div>
      </div>
    </>
  );
}

export function DirectorReports() {
  return (
    <>
      <PageHeader title="Reports" subtitle="Academy performance snapshots for September 2026." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Metric label="Enrollment growth" value="+12" note="New students this month" />
        <Metric label="Revenue" value="184,500 MAD" note="+6.2% vs August" />
        <Metric label="Attendance" value="91%" note="Across 16 classes" />
        <Metric label="Exam pass rate" value="78%" note="A2 mock exams" />
        <Metric label="Overdue invoices" value="12" note="14,400 MAD" />
        <Metric label="Teacher utilization" value="86%" />
      </div>
    </>
  );
}

export function DirectorSettings() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Academy defaults for access, billing and exams." />
      <Surface className="space-y-5 p-6">
        <div>
          <h2 className="font-semibold">Access policy</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            ACTIVE students keep full access. PAST DUE receive a warning. SUSPENDED learners are
            locked out of live class, exams and materials.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">Billing</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Default program fee is 1,200 MAD / month. Invoices are generated on the 1st.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">Exam publication</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Publishing an exam immediately unlocks it on the student Prüfung page.
          </p>
        </div>
      </Surface>
    </>
  );
}

export function DirectorAssignments() {
  const { data = [] } = useQuery({ queryKey: ["assignments"], queryFn: () => AssignmentService.list() });
  return (
    <>
      <PageHeader title="Assignments" subtitle="Academy-wide homework pipeline." />
      <Surface className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Assignment</th>
              <th>Student</th>
              <th>Status</th>
              <th>Grade</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id}>
                <td>{row.title}</td>
                <td>{row.studentName ?? "—"}</td>
                <td>
                  <Status>{row.status}</Status>
                </td>
                <td>{row.grade ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>
    </>
  );
}
