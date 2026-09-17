import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Lock,
  Play,
  Target,
  TrendingUp,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEAD_TEACHER } from "@/data/demo-accounts";
import { modules } from "@/data/mock-data";
import { initials } from "@/lib/academy-logic";
import { useSetProfileStatus, useStudent, useStudents } from "@/hooks/use-academy-data";
import { useAcademy } from "./academy-context";
import { StudentExamsPage } from "./exam-pages";
import { QueryState } from "./query-state";
import { Eyebrow, PremiumHeader, Ring, SkillBars, Status } from "./premium-kit";
import { Surface } from "./primitives";
import { toast } from "sonner";

const momentum = [
  { d: "M", v: 35 },
  { d: "T", v: 58 },
  { d: "W", v: 42 },
  { d: "T", v: 76 },
  { d: "F", v: 61 },
  { d: "S", v: 88 },
  { d: "S", v: 68 },
];
const revenue = [
  { m: "Apr", v: 142 },
  { m: "May", v: 151 },
  { m: "Jun", v: 148 },
  { m: "Jul", v: 166 },
  { m: "Aug", v: 174 },
  { m: "Sep", v: 184.5 },
];

export function LegacyPremiumStudentDashboard() {
  const { navigate } = useAcademy();
  return (
    <div className="animate-fade-in">
      <PremiumHeader title="Hallo, Ahmed." subtitle="Your German journey continues." />
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,.75fr)]">
        <div className="relative overflow-hidden rounded-2xl bg-brand p-7 text-primary-foreground sm:p-10">
          <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
            <div>
              <Eyebrow>Current level</Eyebrow>
              <div className="mt-4 flex items-baseline gap-4">
                <span className="font-display text-7xl font-normal">A2</span>
                <span className="text-sm text-primary-foreground/60">Intermediate German</span>
              </div>
              <p className="mt-7 max-w-sm text-sm leading-6 text-primary-foreground/65">
                You have built a strong everyday foundation. Your next chapter is confident
                workplace conversation.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => navigate("lesson")}>
                  Continue learning <ArrowRight />
                </Button>
                <button
                  className="text-sm text-primary-foreground/70 transition hover:text-primary-foreground"
                  onClick={() => navigate("progress")}
                >
                  View progress
                </button>
              </div>
            </div>
            <Ring value={68} dark />
          </div>
          <span className="absolute right-7 top-7 h-px w-14 bg-alert" />
        </div>
        <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-7">
          <div>
            <div className="flex items-center justify-between">
              <Eyebrow>Next lesson</Eyebrow>
              <span className="size-2 rounded-full bg-success" />
            </div>
            <h2 className="mt-5 font-display text-3xl font-normal">Im Büro</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              German for real-world conversations.
            </p>
          </div>
          <div className="mt-8 border-t border-border pt-6">
            <div className="flex items-end justify-between">
              <div>
                <strong className="font-display text-3xl font-normal">18:00</strong>
                <p className="mt-1 text-sm text-muted-foreground">Today · {LEAD_TEACHER}</p>
              </div>
              <CalendarDays className="size-5 text-primary" />
            </div>
            <Button className="mt-6 w-full" onClick={() => navigate("lesson")}>
              Continue learning <ArrowRight />
            </Button>
          </div>
        </div>
      </section>
      <section className="mt-12 grid gap-8 xl:grid-cols-[1.35fr_.65fr]">
        <div>
          <div className="mb-5 flex items-center justify-between">
            <Eyebrow>Today</Eyebrow>
            <span className="text-xs text-muted-foreground">Monday, 14 September</span>
          </div>
          <div className="divide-y divide-border border-y border-border">
            {(
              [
                ["18:00", "Live class", "A2 · Group 02", "live"],
                ["20 min", "Vocabulary practice", "Workplace expressions", "lesson"],
                ["Due tomorrow", "Homework", "Write a professional email", "assignments"],
              ] as const
            ).map(([time, title, note, to], i) => (
              <button
                key={title}
                onClick={() => navigate(to)}
                className="group grid w-full grid-cols-[5.5rem_1fr_auto] items-center gap-4 py-5 text-left"
              >
                <span className="text-xs text-muted-foreground">{time}</span>
                <span>
                  <strong className="block text-sm font-medium">{title}</strong>
                  <small className="text-muted-foreground">{note}</small>
                </span>
                <span className="grid size-8 place-items-center rounded-full border border-border transition group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                  <ChevronRight className="size-4" />
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-secondary/60 p-7">
          <Eyebrow>Next milestone</Eyebrow>
          <div className="mt-5 flex items-center justify-between">
            <div>
              <h3 className="font-display text-2xl font-normal">A2 Mock Exam</h3>
              <p className="mt-1 text-sm text-muted-foreground">21 September</p>
            </div>
            <strong className="text-xl text-primary">76%</strong>
          </div>
          <div className="mt-5 h-1 overflow-hidden rounded-full bg-border">
            <div className="h-full w-[76%] bg-primary" />
          </div>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            You are ready in Lesen and Hören. Focus next on written expression.
          </p>
          <Button className="mt-6 w-full" variant="outline" onClick={() => navigate("exams")}>
            Prepare for exam
          </Button>
        </div>
      </section>
      <section className="mt-12 grid gap-8 border-t border-border pt-10 xl:grid-cols-[1.35fr_.65fr]">
        <div>
          <div className="flex items-end justify-between">
            <div>
              <Eyebrow>Learning momentum</Eyebrow>
              <h2 className="mt-3 font-display text-2xl font-normal">A steady week of practice.</h2>
            </div>
            <div className="text-right">
              <strong className="text-2xl font-medium">5h 42m</strong>
              <p className="text-xs text-success">+18% this week</p>
            </div>
          </div>
          <div className="mt-6 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={momentum}>
                <defs>
                  <linearGradient id="momentumFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="d"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <YAxis hide />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  fill="url(#momentumFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <Eyebrow>Skill balance</Eyebrow>
          <h2 className="mt-3 mb-7 font-display text-2xl font-normal">
            Your strongest edge is reading.
          </h2>
          <SkillBars />
        </div>
      </section>
      <div className="mt-12 flex flex-col items-start justify-between gap-5 rounded-2xl bg-primary p-7 text-primary-foreground sm:flex-row sm:items-center">
        <div>
          <p className="font-display text-2xl">Small steps. Real fluency.</p>
          <p className="mt-1 text-sm text-primary-foreground/65">
            Continue where you left off in Arbeit · Im Büro.
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate("lesson")}>
          Continue your journey <ArrowRight />
        </Button>
      </div>
    </div>
  );
}

export function PremiumLearning() {
  const { navigate, subscription } = useAcademy();
  return (
    <div className="animate-fade-in">
      <PremiumHeader
        title="A2 — German Intermediate"
        subtitle="Build confidence for everyday life, work and travel."
        action={
          <div className="hidden sm:block">
            <Ring value={68} size={92} />
          </div>
        }
      />
      {subscription !== "ACTIVE" && (
        <div className="mb-10 grid gap-6 rounded-2xl bg-brand p-7 text-primary-foreground md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <Eyebrow>Subscription required</Eyebrow>
            <h2 className="mt-3 font-display text-3xl">
              Your learning access is currently paused.
            </h2>
            <p className="mt-3 max-w-xl text-sm text-primary-foreground/65">
              Course materials, live classes and mock exams are temporarily unavailable.
            </p>
          </div>
          <Button variant="secondary" onClick={() => navigate("payments")}>
            Renew access <ArrowRight />
          </Button>
        </div>
      )}
      <div className={subscription !== "ACTIVE" ? "pointer-events-none opacity-45" : ""}>
        <div className="grid gap-8 border-y border-border py-7 sm:grid-cols-3">
          <div>
            <Eyebrow>Course progress</Eyebrow>
            <strong className="mt-2 block text-2xl font-medium">36 of 52</strong>
            <span className="text-xs text-muted-foreground">lessons complete</span>
          </div>
          <div>
            <Eyebrow>Learning time</Eyebrow>
            <strong className="mt-2 block text-2xl font-medium">28 hours</strong>
            <span className="text-xs text-muted-foreground">estimated remaining</span>
          </div>
          <div>
            <Eyebrow>Next milestone</Eyebrow>
            <strong className="mt-2 block text-2xl font-medium">Mock Exam</strong>
            <span className="text-xs text-muted-foreground">76% ready</span>
          </div>
        </div>
        <section className="mt-12 space-y-4">
          {modules.map((m, i) => {
            const complete = m.progress === 100,
              locked = i > 2;
            return (
              <button
                key={m.id}
                disabled={locked}
                onClick={() => navigate("lesson")}
                className={`group grid w-full gap-5 rounded-2xl border p-5 text-left transition duration-200 sm:grid-cols-[5rem_minmax(0,1fr)_12rem_auto] sm:items-center sm:p-7 ${i === 1 ? "border-primary bg-secondary/45 shadow-soft" : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-card"} ${locked ? "opacity-55" : ""}`}
              >
                <span className="font-display text-4xl text-muted-foreground">0{i + 1}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-3">
                    <strong className="font-display text-2xl font-normal">{m.title}</strong>
                    {complete && <CheckCircle2 className="size-4 text-success" />}
                    {locked && <Lock className="size-4" />}
                  </span>
                  <small className="mt-2 block text-muted-foreground">
                    {m.lessons} lessons · {m.exercises} exercises · {3 + i}h estimated
                  </small>
                </span>
                <span>
                  <span className="mb-2 flex justify-between text-xs">
                    <span>
                      {locked
                        ? "Locked"
                        : complete
                          ? "Completed"
                          : i === 1
                            ? "In progress"
                            : "Available"}
                    </span>
                    <b>{m.progress}%</b>
                  </span>
                  <span className="block h-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full bg-primary" style={{ width: `${m.progress}%` }} />
                  </span>
                </span>
                <span className="grid size-9 place-items-center rounded-full border border-border transition group-hover:bg-primary group-hover:text-primary-foreground">
                  <ChevronRight className="size-4" />
                </span>
              </button>
            );
          })}
        </section>
      </div>
    </div>
  );
}

export function PremiumLesson() {
  const { navigate } = useAcademy();
  const [section, setSection] = useState("Vocabulary");
  return (
    <div className="animate-fade-in">
      <button
        onClick={() => navigate("courses")}
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        A2 / Arbeit / Im Büro
      </button>
      <PremiumHeader
        title="Im Büro"
        subtitle="German for real-world conversations."
        action={<Status>Lesson 04 / 07</Status>}
      />
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,.65fr)]">
        <div>
          <div className="group relative grid aspect-video place-items-center overflow-hidden rounded-2xl bg-brand text-primary-foreground">
            <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(var(--media-grid)_1px,transparent_1px),linear-gradient(90deg,var(--media-grid)_1px,transparent_1px)] [background-size:48px_48px]" />
            <button className="relative grid size-20 place-items-center rounded-full border border-primary-foreground/30 bg-primary-foreground/10 backdrop-blur transition group-hover:scale-105 group-hover:bg-primary-foreground/20">
              <Play className="ml-1 size-7" />
            </button>
            <div className="absolute bottom-0 left-0 right-0 flex items-center gap-4 border-t border-primary-foreground/10 bg-brand/85 px-5 py-4">
              <Play className="size-4" />
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-primary-foreground/15">
                <div className="h-full w-[42%] bg-primary-foreground" />
              </div>
              <span className="text-xs text-primary-foreground/65">08:24 / 19:40</span>
            </div>
          </div>
          <nav className="mt-7 flex gap-1 overflow-x-auto border-b border-border">
            {["Vocabulary", "Grammar", "Listening", "Practice", "Homework"].map((x) => (
              <button
                key={x}
                onClick={() => setSection(x)}
                className={`shrink-0 border-b-2 px-4 py-3 text-sm transition ${section === x ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {x}
              </button>
            ))}
          </nav>
          <div className="py-8">
            <Eyebrow>{section}</Eyebrow>
            <h2 className="mt-3 font-display text-2xl">Useful language for the workplace.</h2>
            <div className="mt-7 divide-y divide-border border-y border-border">
              {[
                ["die Besprechung", "the meeting"],
                ["eine Rückmeldung geben", "to give feedback"],
                ["zuständig sein für", "to be responsible for"],
              ].map(([de, en]) => (
                <div key={de} className="grid gap-2 py-4 sm:grid-cols-2">
                  <strong className="font-medium">{de}</strong>
                  <span className="text-sm text-muted-foreground">{en}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <aside>
          <div className="rounded-2xl bg-secondary/60 p-7">
            <Eyebrow>What you’ll learn</Eyebrow>
            <ul className="mt-6 space-y-4">
              {[
                "Workplace vocabulary",
                "Useful expressions",
                "Dative prepositions",
                "Natural pronunciation",
              ].map((x, i) => (
                <li key={x} className="flex gap-3 text-sm">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-5 rounded-2xl border border-border p-7">
            <div className="flex justify-between text-sm">
              <span>Lesson progress</span>
              <strong>75%</strong>
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-3/4 bg-primary" />
            </div>
            <Button className="mt-6 w-full">
              Continue lesson <ArrowRight />
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function PremiumExams({ mode }: { mode: string }) {
  return <StudentExamsPage mode={mode} />;
}

export function LegacyPremiumTeacherDashboard() {
  const { navigate } = useAcademy();
  return (
    <div className="animate-fade-in">
      <PremiumHeader
        title="Good morning, Anna."
        subtitle="Your teaching day, clearly arranged."
        action={
          <div className="hidden text-right sm:block">
            <Eyebrow>Monday</Eyebrow>
            <strong className="mt-1 block">14 September</strong>
          </div>
        }
      />
      <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-2xl bg-brand p-8 text-primary-foreground">
          <Eyebrow>Today</Eyebrow>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-5">
            <div>
              <h2 className="font-display text-4xl">3 classes</h2>
              <p className="mt-2 text-sm text-primary-foreground/65">
                Your next class begins in 42 minutes.
              </p>
            </div>
            <Button variant="secondary" onClick={() => navigate("classes")}>
              Open schedule <ArrowRight />
            </Button>
          </div>
          <div className="mt-9 divide-y divide-primary-foreground/10 border-y border-primary-foreground/10">
            {[
              ["17:00", "A1 Group 01", "Room 3"],
              ["18:00", "A2 Group 02", "Online"],
              ["19:30", "B1 Group 01", "Room 2"],
            ].map(([time, name, place]) => (
              <div key={name} className="grid grid-cols-[5rem_1fr_auto] py-4 text-sm">
                <span className="text-primary-foreground/55">{time}</span>
                <strong>{name}</strong>
                <span className="text-primary-foreground/55">{place}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-3 xl:grid-cols-1">
          <div className="rounded-2xl bg-secondary/60 p-6">
            <Eyebrow>Assignments</Eyebrow>
            <strong className="mt-3 block font-display text-4xl">8</strong>
            <p className="text-sm text-muted-foreground">waiting for review</p>
          </div>
          <div className="rounded-2xl border border-border p-6">
            <Eyebrow>Students</Eyebrow>
            <strong className="mt-3 block font-display text-4xl">42</strong>
            <p className="text-sm text-muted-foreground">across three classes</p>
          </div>
          <div className="rounded-2xl border border-border p-6">
            <Eyebrow>Attendance</Eyebrow>
            <strong className="mt-3 block font-display text-4xl">91%</strong>
            <p className="text-sm text-success">+2% this month</p>
          </div>
        </div>
      </section>
      <section className="mt-12 grid gap-10 xl:grid-cols-[1fr_1fr]">
        <div>
          <Eyebrow>Students requiring attention</Eyebrow>
          <div className="mt-5 divide-y divide-border border-y border-border">
            {[
              ["Lina Idrissi", "2 missed sessions", "Attendance"],
              ["Omar Tazi", "Writing score 58%", "Learning"],
              ["Sara Bennis", "Assignment overdue", "Assignment"],
            ].map(([name, note, type]) => (
              <button
                key={name}
                onClick={() => navigate("classes")}
                className="group grid w-full grid-cols-[1fr_auto] items-center py-5 text-left"
              >
                <span>
                  <strong className="block text-sm">{name}</strong>
                  <small className="text-muted-foreground">{note}</small>
                </span>
                <span className="text-xs text-primary">
                  {type} <ChevronRight className="ml-1 inline size-3" />
                </span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <Eyebrow>Recent submissions</Eyebrow>
          <div className="mt-5 divide-y divide-border border-y border-border">
            {[
              ["Ahmed Benali", "German Email Writing", "8 min ago"],
              ["Yasmine Alaoui", "Listening Exercise", "24 min ago"],
              ["Mehdi Amrani", "Vocabulary Practice", "1 hour ago"],
            ].map(([name, work, time]) => (
              <button
                key={name}
                onClick={() => navigate("assignments")}
                className="grid w-full grid-cols-[1fr_auto] py-5 text-left"
              >
                <span>
                  <strong className="block text-sm">{name}</strong>
                  <small className="text-muted-foreground">{work}</small>
                </span>
                <span className="text-xs text-muted-foreground">{time}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function LegacyPremiumDirectorDashboard() {
  return (
    <div className="animate-fade-in">
      <PremiumHeader
        title="Overview"
        subtitle="The academy is growing steadily this month."
        action={<Button variant="outline">September 2026</Button>}
      />
      <section className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-2xl bg-brand p-8 text-primary-foreground sm:p-10">
          <Eyebrow>Students</Eyebrow>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
            <div>
              <strong className="font-display text-7xl font-normal">243</strong>
              <p className="mt-2 text-sm text-primary-foreground/60">
                active learners · +12 this month
              </p>
            </div>
            <TrendingUp className="size-8 text-success" />
          </div>
          <div className="mt-8 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenue}>
                <Area
                  dataKey="v"
                  type="monotone"
                  stroke="var(--primary-foreground)"
                  strokeWidth={2}
                  fill="var(--director-fill)"
                />
                <XAxis
                  dataKey="m"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "var(--director-tick)", fontSize: 11 }}
                />
                <YAxis hide />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="divide-y divide-border rounded-2xl border border-border px-7">
          {[
            ["Revenue", "184,500 MAD", "+6.2%"],
            ["Attendance", "91%", "+2.0%"],
            ["Learning performance", "78%", "+3.4%"],
            ["Active classes", "16", "stable"],
          ].map(([label, value, trend]) => (
            <div className="py-6" key={label}>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-xs text-success">{trend}</span>
              </div>
              <strong className="mt-2 block text-2xl font-medium">{value}</strong>
            </div>
          ))}
        </div>
      </section>
      <section className="mt-12 grid gap-10 xl:grid-cols-[1.15fr_.85fr]">
        <div>
          <div className="flex items-end justify-between">
            <div>
              <Eyebrow>Revenue trend</Eyebrow>
              <h2 className="mt-3 font-display text-2xl">Healthy, predictable growth.</h2>
            </div>
            <span className="text-sm text-muted-foreground">MAD · thousands</span>
          </div>
          <div className="mt-6 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenue}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="m" axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="v" fill="var(--primary)" radius={[3, 3, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <Eyebrow>Level distribution</Eyebrow>
          <div className="mt-4 h-52">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={[
                    { n: "A1", v: 72 },
                    { n: "A2", v: 81 },
                    { n: "B1", v: 54 },
                    { n: "B2", v: 36 },
                  ]}
                  dataKey="v"
                  nameKey="n"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={3}
                >
                  {[
                    "var(--primary)",
                    "var(--chart-2)",
                    "var(--chart-3)",
                    "var(--muted-foreground)",
                  ].map((c) => (
                    <Cell key={c} fill={c} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["A1", 72],
              ["A2", 81],
              ["B1", 54],
              ["B2", 36],
            ].map(([x, n]) => (
              <div className="flex justify-between border-b border-border pb-2" key={x}>
                <span>{x}</span>
                <b>{n}</b>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mt-12 border-t border-border pt-9">
        <Eyebrow>Recent activity</Eyebrow>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          {[
            ["Enrollment", "12 new students joined in September"],
            ["Academics", "A2 Mock Exam 02 was published"],
            ["Finance", "231 subscriptions are currently active"],
          ].map(([type, text]) => (
            <div key={type}>
              <span className="text-xs text-primary">{type}</span>
              <p className="mt-2 text-sm leading-6">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function PremiumStudent360() {
  const { navigate, selectedStudentId, role } = useAcademy();
  const [tab, setTab] = useState("Aperçu");
  const [confirmStatus, setConfirmStatus] = useState<"active" | "restricted" | "suspended" | null>(
    null,
  );
  const studentQuery = useStudent(selectedStudentId);
  const setProfileStatus = useSetProfileStatus();
  const student = studentQuery.data ?? null;
  const isDirector = role === "director";

  const accountTone =
    student?.accountStatus === "active"
      ? "green"
      : student?.accountStatus === "restricted"
        ? "amber"
        : student?.accountStatus === "suspended"
          ? "red"
          : "gray";

  const accountLabel =
    student?.accountStatus === "restricted"
      ? "Restreint"
      : student?.accountStatus === "suspended"
        ? "Suspendu"
        : student?.accountStatus === "archived"
          ? "Archivé"
          : "Actif";

  const applyStatus = (status: "active" | "restricted" | "suspended") => {
    if (!student?.profileId) return;
    setProfileStatus.mutate(
      { profileId: student.profileId, status },
      {
        onSuccess: () => {
          toast.success(
            `Statut mis à jour · ${status === "active" ? "Actif" : status === "restricted" ? "Restreint" : "Suspendu"}`,
          );
          setConfirmStatus(null);
          void studentQuery.refetch();
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  if (studentQuery.isLoading || studentQuery.isError || !student) {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => navigate("students")}
          className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="size-4" />
          Étudiants
        </button>
        <QueryState
          isLoading={studentQuery.isLoading}
          isError={studentQuery.isError || (!studentQuery.isLoading && !student)}
          error={studentQuery.error}
          isEmpty={!student}
          emptyMessage="Étudiant introuvable."
        >
          {null}
        </QueryState>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <button
        onClick={() => navigate("students")}
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" />
        Étudiants
      </button>
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="flex min-w-0 items-center gap-5">
          <span className="grid size-20 shrink-0 place-items-center rounded-full bg-secondary font-display text-2xl text-primary">
            {initials(student.name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-4xl">
                {student.lastName} {student.firstName}
              </h1>
              <Status tone={accountTone}>{accountLabel}</Status>
            </div>
            <p className="mt-2 text-muted-foreground">
              {student.level} · {student.className} · {student.teacherName || "Sans professeur"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {student.email ? (
            <Button variant="outline" asChild>
              <a href={`mailto:${student.email}`}>Écrire</a>
            </Button>
          ) : null}
          {student.phone ? (
            <Button variant="outline" asChild>
              <a href={`tel:${student.phone}`}>Appeler</a>
            </Button>
          ) : null}
        </div>
      </div>

      <section className="mt-8 grid gap-4 rounded-2xl border border-border bg-card p-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <small className="text-muted-foreground">E-mail</small>
          <p className="mt-1 font-medium">
            {student.email ? (
              <a className="text-primary underline" href={`mailto:${student.email}`}>
                {student.email}
              </a>
            ) : (
              "—"
            )}
          </p>
        </div>
        <div>
          <small className="text-muted-foreground">Téléphone</small>
          <p className="mt-1 font-medium">
            {student.phone ? (
              <a className="text-primary underline" href={`tel:${student.phone}`}>
                {student.phone}
              </a>
            ) : (
              "—"
            )}
          </p>
        </div>
        <div>
          <small className="text-muted-foreground">Groupe</small>
          <p className="mt-1 font-medium">{student.className}</p>
        </div>
        <div>
          <small className="text-muted-foreground">Abonnement</small>
          <p className="mt-1 font-medium">{student.subscription}</p>
        </div>
      </section>

      {isDirector && student.profileId ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={student.accountStatus === "active" || setProfileStatus.isPending}
            onClick={() => setConfirmStatus("active")}
          >
            Activer
          </Button>
          <Button
            variant="outline"
            disabled={student.accountStatus === "restricted" || setProfileStatus.isPending}
            onClick={() => setConfirmStatus("restricted")}
          >
            Restreindre
          </Button>
          <Button
            variant="outline"
            disabled={student.accountStatus === "suspended" || setProfileStatus.isPending}
            onClick={() => setConfirmStatus("suspended")}
          >
            Suspendre
          </Button>
        </div>
      ) : null}

      <nav className="mt-9 flex gap-1 overflow-x-auto border-b border-border">
        {["Aperçu", "Apprentissage", "Présence", "Devoirs", "Examens", "Paiements"].map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`shrink-0 border-b-2 px-4 py-3 text-sm transition ${tab === item ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          >
            {item}
          </button>
        ))}
      </nav>
      <section className="mt-9 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <div className="rounded-2xl bg-brand p-8 text-primary-foreground">
          <Eyebrow>Progression</Eyebrow>
          <div className="mt-5 grid items-center gap-8 sm:grid-cols-[1fr_auto]">
            <div>
              <h2 className="font-display text-4xl">
                {student.level} ·{" "}
                {student.level === "A1"
                  ? "Fondations"
                  : student.level === "A2"
                    ? "Intermédiaire"
                    : student.level === "B1"
                      ? "Indépendant"
                      : "Avancé"}
              </h2>
              <p className="mt-3 text-sm text-primary-foreground/60">{student.email}</p>
              <div className="mt-7 grid grid-cols-3 gap-4 border-t border-primary-foreground/10 pt-6">
                <div>
                  <strong className="block text-xl">{student.average || "—"}%</strong>
                  <small className="text-primary-foreground/55">moyenne</small>
                </div>
                <div>
                  <strong className="block text-xl">{student.attendance || "—"}%</strong>
                  <small className="text-primary-foreground/55">présence</small>
                </div>
                <div>
                  <strong className="block text-xl">{student.progress || "—"}%</strong>
                  <small className="text-primary-foreground/55">progression</small>
                </div>
              </div>
            </div>
            <Ring value={student.progress} dark size={150} />
          </div>
        </div>
        <div className="rounded-2xl bg-success-soft p-7">
          <Eyebrow>Statut abonnement</Eyebrow>
          <CheckCircle2 className="mt-5 size-7 text-success" />
          <h2 className="mt-4 font-display text-2xl">{student.subscription}</h2>
          <p className="mt-2 text-sm text-muted-foreground">Compte · {accountLabel}</p>
          <div className="mt-6 border-t border-success/15 pt-5">
            <small className="text-muted-foreground">Professeur</small>
            <strong className="mt-1 block">{student.teacherName || "—"}</strong>
          </div>
        </div>
      </section>
      <section className="mt-10 grid gap-9 lg:grid-cols-3">
        <div>
          <Eyebrow>{tab}</Eyebrow>
          <strong className="mt-4 block font-display text-4xl">{student.attendance || "—"}%</strong>
          <p className="mt-2 text-sm text-muted-foreground">
            Présence · groupe {student.className}
          </p>
        </div>
        <div>
          <Eyebrow>Coordonnées</Eyebrow>
          <div className="mt-4 space-y-3 text-sm">
            <p>
              <span className="text-muted-foreground">Nom</span>
              <br />
              {student.lastName} {student.firstName}
            </p>
            <p>
              <span className="text-muted-foreground">Téléphone</span>
              <br />
              {student.phone || "—"}
            </p>
          </div>
        </div>
        <div>
          <Eyebrow>Parcours</Eyebrow>
          <h2 className="mt-4 font-display text-2xl">{student.level}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {student.className} · {student.teacherName || "Sans professeur"}
          </p>
        </div>
      </section>

      {confirmStatus && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <h2 className="font-semibold">Confirmer le changement de statut</h2>
            <p className="text-sm text-muted-foreground">
              Passer {student.lastName} {student.firstName} en «{" "}
              {confirmStatus === "active"
                ? "Actif"
                : confirmStatus === "restricted"
                  ? "Restreint"
                  : "Suspendu"}{" "}
              » ?
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
    </div>
  );
}

export function PremiumPayments() {
  const { navigate } = useAcademy();
  return (
    <div className="animate-fade-in">
      <PremiumHeader
        title="Votre programme"
        subtitle="Utilisez la page Paiements pour l’historique réel et le dépôt de justificatif."
        action={<Button onClick={() => navigate("payments")}>Ouvrir les paiements</Button>}
      />
      <Surface className="p-6 text-sm text-muted-foreground">
        Le renouvellement fictif est désactivé. Déposez un avis d’opération ou contactez
        l’administration pour rétablir l’accès.
      </Surface>
    </div>
  );
}

export function PremiumProfile() {
  const { user } = useAcademy();
  const studentsQuery = useStudents();
  const myStudent = (studentsQuery.data ?? []).find(
    (s) => s.email.toLowerCase() === (user?.email ?? "").toLowerCase(),
  );
  const displayName = user?.name?.trim() || user?.email || "Profil";
  const initialsText = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="animate-fade-in">
      <PremiumHeader
        title={displayName}
        subtitle={`${myStudent?.level ?? "—"} · ${myStudent?.className || "Sans classe"}`}
      />
      <section className="grid gap-8 xl:grid-cols-[.62fr_1.38fr]">
        <div className="rounded-2xl bg-brand p-8 text-primary-foreground">
          <span className="grid size-24 place-items-center rounded-full bg-primary-foreground/10 font-display text-3xl">
            {initialsText || "?"}
          </span>
          <h2 className="mt-7 font-display text-3xl">{displayName}</h2>
          <p className="mt-2 text-sm text-primary-foreground/60">
            {myStudent?.level ?? "—"} · {myStudent?.className || "Sans classe"}
          </p>
          <div className="mt-8 space-y-5 border-t border-primary-foreground/10 pt-6 text-sm">
            <p>
              <span className="block text-primary-foreground/45">E-mail</span>
              {user?.email || "—"}
            </p>
            <p>
              <span className="block text-primary-foreground/45">Abonnement</span>
              {myStudent?.subscription ?? "—"}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-border p-8 text-sm text-muted-foreground">
          Les informations affichées proviennent de votre compte Supabase (profil et fiche
          étudiant). L’accès aux cours dépend de la validation de votre abonnement.
        </div>
      </section>
    </div>
  );
}
