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
import { modules, questions, students } from "@/data/mock-data";
import { initials } from "@/lib/academy-logic";
import { ExamService, PaymentService } from "@/services/academy-services";
import { recordPayment } from "@/services/academy-store";
import { toast } from "sonner";
import { useAcademy } from "./academy-context";
import { Eyebrow, PremiumHeader, Ring, SkillBars, Status } from "./premium-kit";

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

export function PremiumStudentDashboard() {
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
  const { navigate, examPublished, lastScore, setLastScore } = useAcademy();
  const [q, setQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [finishing, setFinishing] = useState(false);
  const score = lastScore?.overall ?? 0;
  const finish = async () => {
    setFinishing(true);
    const keyed: Record<number, number> = {};
    for (const [index, value] of Object.entries(answers)) {
      const question = questions[Number(index)];
      if (question) keyed[question.id] = value;
    }
    const result = await ExamService.submit(keyed);
    setLastScore(result);
    setFinishing(false);
    navigate("exam-result");
  };
  if (mode === "exam-result") {
    return (
      <div className="animate-fade-in">
        <PremiumHeader title="A2 Mock Exam" subtitle="Your result · 14 September 2026" />
        <div className="mx-auto max-w-4xl">
          <section className="grid items-center gap-10 rounded-2xl bg-brand p-8 text-primary-foreground md:grid-cols-[auto_1fr] md:p-12">
            <Ring value={score} dark size={190} />
            <div>
              <Eyebrow>Your result</Eyebrow>
              <h2 className="mt-3 font-display text-4xl">
                {score >= 60 ? "Good progress." : "Keep practicing."}
              </h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-primary-foreground/65">
                You scored {score}% ({lastScore?.correct ?? 0}/{lastScore?.total ?? 4} correct).
                Written expression is your clearest opportunity to improve.
              </p>
            </div>
          </section>
          <div className="mt-10 grid gap-10 md:grid-cols-2">
            <div>
              <Eyebrow>Performance by skill</Eyebrow>
              <div className="mt-6">
                {lastScore?.skills ? <SkillBars skills={lastScore.skills} /> : <SkillBars />}
              </div>
            </div>
            <div className="space-y-7">
              <div>
                <Eyebrow>Your strengths</Eyebrow>
                <p className="mt-2 text-sm">
                  Reading comprehension and identifying key information.
                </p>
              </div>
              <div>
                <Eyebrow>Your focus area</Eyebrow>
                <p className="mt-2 text-sm">Sentence structure and connectors in written German.</p>
              </div>
            </div>
          </div>
          <Button className="mt-10" onClick={() => navigate("lesson")}>
            Continue learning <ArrowRight />
          </Button>
        </div>
      </div>
    );
  }
  if (mode === "mock-exam") {
    const question = questions[q];
    if (!question) return null;
    return (
      <div className="animate-fade-in">
        <header className="mb-9 grid grid-cols-[1fr_auto] items-center gap-4 border-b border-border pb-6">
          <button
            onClick={() => navigate("exams")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground"
          >
            <ArrowLeft className="size-4" />
            Exit exam
          </button>
          <div className="flex items-center gap-5">
            <span className="text-sm">A2 · Hören</span>
            <span className="inline-flex items-center gap-2 rounded-full border border-alert/20 bg-alert-soft px-3 py-1.5 text-sm text-alert">
              <Clock3 className="size-4" />
              18:42
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-4xl">
          <div className="flex items-center gap-5">
            <span className="text-sm text-muted-foreground">
              Question {String(q + 1).padStart(2, "0")} / {questions.length}
            </span>
            <div className="h-px flex-1 bg-border">
              <div
                className="h-px bg-primary transition-all"
                style={{ width: `${((q + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>
          <section className="mt-10">
            <Eyebrow>Listen and choose one answer</Eyebrow>
            <h1 className="mt-4 max-w-2xl font-display text-3xl leading-snug">{question.prompt}</h1>
            <div className="mt-8 flex items-center gap-5 rounded-2xl bg-brand p-5 text-primary-foreground">
              <Button size="icon" variant="secondary">
                <Play />
              </Button>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-primary-foreground/15">
                <div className="h-full w-1/3 bg-primary-foreground" />
              </div>
              <span className="text-xs">0:18 / 0:54</span>
              <Volume2 className="size-4" />
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {question.answers.map((answer, index) => (
                <button
                  key={answer}
                  onClick={() => setAnswers({ ...answers, [q]: index })}
                  className={`group flex min-h-20 items-center gap-4 rounded-xl border p-5 text-left text-sm transition ${answers[q] === index ? "border-primary bg-secondary" : "border-border hover:border-primary/40 hover:bg-muted/40"}`}
                >
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-full border ${answers[q] === index ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                  >
                    {String.fromCharCode(65 + index)}
                  </span>
                  {answer}
                </button>
              ))}
            </div>
            <div className="mt-10 flex justify-between">
              <Button variant="outline" disabled={q === 0} onClick={() => setQ(q - 1)}>
                <ArrowLeft />
                Previous
              </Button>
              {q < questions.length - 1 ? (
                <Button onClick={() => setQ(q + 1)}>
                  Next
                  <ArrowRight />
                </Button>
              ) : (
                <Button onClick={() => void finish()} disabled={finishing}>
                  {finishing ? "Scoring…" : "Finish exam"}
                  <Check />
                </Button>
              )}
            </div>
          </section>
        </main>
      </div>
    );
  }
  return (
    <div className="animate-fade-in">
      <PremiumHeader
        title="Prüfungen"
        subtitle="A clear path from foundation to independent German."
      />
      <div className="relative overflow-x-auto pb-4">
        <div className="flex min-w-[650px] items-center px-8">
          <div className="absolute left-14 right-14 top-6 h-px bg-border" />
          {[
            ["A1", "Completed"],
            ["A2", "Current"],
            ["B1", "Locked"],
            ["B2", "Locked"],
          ].map(([level, status], index) => (
            <div className="relative flex flex-1 flex-col items-center" key={level}>
              <span
                className={`z-10 grid size-12 place-items-center rounded-full border-2 bg-background font-display text-lg ${index < 2 ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
              >
                {index === 0 ? (
                  <Check className="size-4" />
                ) : index > 1 ? (
                  <Lock className="size-4" />
                ) : (
                  level
                )}
              </span>
              <strong className="mt-3">{level}</strong>
              <small className="text-muted-foreground">{status}</small>
            </div>
          ))}
        </div>
      </div>
      <section className="mt-10 grid gap-6 xl:grid-cols-[1fr_.44fr]">
        <div className="divide-y divide-border border-y border-border">
          {[
            ["Mock Exam 01", "Ready", "Hören & Lesen"],
            ["Mock Exam 02", examPublished ? "Ready" : "Waiting", "Schreiben & Sprechen"],
            ["Final Assessment", "Locked", "Complete 80% of A2 to unlock"],
          ].map(([name, status, note], index) => (
            <div
              key={name}
              className="grid gap-4 py-6 sm:grid-cols-[auto_1fr_auto] sm:items-center"
            >
              <span
                className={`grid size-11 place-items-center rounded-full ${status === "Locked" || status === "Waiting" ? "bg-muted text-muted-foreground" : "bg-secondary text-primary"}`}
              >
                {status === "Locked" ? (
                  <Lock className="size-4" />
                ) : (
                  <FileText className="size-4" />
                )}
              </span>
              <div>
                <h3 className="font-display text-xl">{name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {note} · {index < 2 ? "4 scored questions" : ""}
                </p>
              </div>
              {status === "Ready" ? (
                <Button onClick={() => navigate("mock-exam")}>
                  Start exam <ArrowRight />
                </Button>
              ) : (
                <Status tone="gray">{status}</Status>
              )}
            </div>
          ))}
        </div>
        <aside className="rounded-2xl bg-secondary/60 p-7">
          <Target className="size-6 text-primary" />
          <h2 className="mt-5 font-display text-2xl">76% ready</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Your reading is above target. Two focused writing sessions will improve your overall
            readiness.
          </p>
          <Button className="mt-7 w-full" variant="outline" onClick={() => navigate("progress")}>
            View readiness
          </Button>
        </aside>
      </section>
    </div>
  );
}

export function PremiumTeacherDashboard() {
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

export function PremiumDirectorDashboard() {
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
  const { navigate, selectedStudentId } = useAcademy();
  const [tab, setTab] = useState("Overview");
  const student = students.find((item) => item.id === selectedStudentId) ?? students[0];
  if (!student) return null;
  const tone =
    student.subscription === "ACTIVE"
      ? "green"
      : student.subscription === "PAST_DUE"
        ? "amber"
        : "red";
  return (
    <div className="animate-fade-in">
      <button
        onClick={() => navigate("students")}
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" />
        Students
      </button>
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="flex min-w-0 items-center gap-5">
          <span className="grid size-20 shrink-0 place-items-center rounded-full bg-secondary font-display text-2xl text-primary">
            {initials(student.name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-4xl">{student.name}</h1>
              <Status tone={tone}>{student.subscription}</Status>
            </div>
            <p className="mt-2 text-muted-foreground">
              {student.level} · {student.className} · Student {student.id}
            </p>
          </div>
        </div>
        <Button variant="outline">Contact student</Button>
      </div>
      <nav className="mt-9 flex gap-1 overflow-x-auto border-b border-border">
        {["Overview", "Learning", "Attendance", "Assignments", "Exams", "Payments"].map((item) => (
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
          <Eyebrow>Learning progress</Eyebrow>
          <div className="mt-5 grid items-center gap-8 sm:grid-cols-[1fr_auto]">
            <div>
              <h2 className="font-display text-4xl">
                {student.level} ·{" "}
                {student.level === "A1"
                  ? "Foundations"
                  : student.level === "A2"
                    ? "Intermediate"
                    : student.level === "B1"
                      ? "Independent"
                      : "Advanced"}
              </h2>
              <p className="mt-3 text-sm text-primary-foreground/60">{student.email}</p>
              <div className="mt-7 grid grid-cols-3 gap-4 border-t border-primary-foreground/10 pt-6">
                <div>
                  <strong className="block text-xl">{student.average}%</strong>
                  <small className="text-primary-foreground/55">average</small>
                </div>
                <div>
                  <strong className="block text-xl">{student.attendance}%</strong>
                  <small className="text-primary-foreground/55">attendance</small>
                </div>
                <div>
                  <strong className="block text-xl">{student.progress}%</strong>
                  <small className="text-primary-foreground/55">progress</small>
                </div>
              </div>
            </div>
            <Ring value={student.progress} dark size={150} />
          </div>
        </div>
        <div className="rounded-2xl bg-success-soft p-7">
          <Eyebrow>Payment status</Eyebrow>
          <CheckCircle2 className="mt-5 size-7 text-success" />
          <h2 className="mt-4 font-display text-2xl">
            Subscription {student.subscription.toLowerCase()}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">A2 Monthly Program</p>
          <div className="mt-6 border-t border-success/15 pt-5">
            <small className="text-muted-foreground">Teacher</small>
            <strong className="mt-1 block">{LEAD_TEACHER}</strong>
          </div>
        </div>
      </section>
      <section className="mt-10 grid gap-9 lg:grid-cols-3">
        <div>
          <Eyebrow>{tab}</Eyebrow>
          <strong className="mt-4 block font-display text-4xl">{student.attendance}%</strong>
          <p className="mt-2 text-sm text-muted-foreground">
            Attendance · class {student.className}
          </p>
        </div>
        <div>
          <Eyebrow>Recent activity</Eyebrow>
          <div className="mt-4 space-y-4 text-sm">
            <p>
              <span className="text-muted-foreground">Today</span>
              <br />
              Completed vocabulary practice
            </p>
            <p>
              <span className="text-muted-foreground">Yesterday</span>
              <br />
              Submitted German Email Writing
            </p>
          </div>
        </div>
        <div>
          <Eyebrow>Next milestone</Eyebrow>
          <h2 className="mt-4 font-display text-2xl">A2 Mock Exam</h2>
          <p className="mt-2 text-sm text-muted-foreground">76% ready · 21 September</p>
        </div>
      </section>
    </div>
  );
}

export function PremiumPayments() {
  const { subscription, setSubscription, session, replaceSession, role } = useAcademy();
  const [paying, setPaying] = useState(false);
  const pay = async () => {
    setPaying(true);
    await PaymentService.pay();
    if (session && role) replaceSession(recordPayment(session, role));
    else setSubscription("ACTIVE");
    setPaying(false);
    toast.success("Payment successful · Access restored");
  };
  return (
    <div className="animate-fade-in">
      <PremiumHeader
        title="Your program"
        subtitle="A clear view of your subscription and payment history."
        action={
          <Button
            variant="outline"
            onClick={() => setSubscription(subscription === "ACTIVE" ? "SUSPENDED" : "ACTIVE")}
          >
            Preview {subscription === "ACTIVE" ? "paused" : "active"} state
          </Button>
        }
      />
      {subscription !== "ACTIVE" && (
        <section className="mb-8 grid gap-7 rounded-2xl bg-brand p-8 text-primary-foreground md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <Eyebrow>Subscription required</Eyebrow>
            <h2 className="mt-3 font-display text-3xl">
              Your learning access is currently paused.
            </h2>
            <p className="mt-3 max-w-xl text-sm text-primary-foreground/65">
              Course materials, live classes and mock exams are temporarily unavailable. Your
              progress is safely preserved.
            </p>
          </div>
          <Button variant="secondary" onClick={() => void pay()} disabled={paying}>
            {paying ? "Restoring access…" : "Renew access"}
            <ArrowRight />
          </Button>
        </section>
      )}
      <section className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <div className="rounded-2xl bg-secondary/60 p-8 sm:p-10">
          <Eyebrow>A2 program</Eyebrow>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
            <div>
              <strong className="font-display text-5xl font-normal">1,200 MAD</strong>
              <span className="ml-2 text-sm text-muted-foreground">/ month</span>
            </div>
            <Status tone={subscription === "ACTIVE" ? "green" : "red"}>{subscription}</Status>
          </div>
          <div className="mt-10 grid gap-5 border-t border-border pt-7 sm:grid-cols-2">
            <div>
              <small className="text-muted-foreground">Next payment</small>
              <strong className="mt-1 block">01 October 2026</strong>
            </div>
            <div>
              <small className="text-muted-foreground">Learning access</small>
              <strong className="mt-1 block">
                {subscription === "ACTIVE" ? "Full access" : "Paused"}
              </strong>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border p-8">
          <Eyebrow>Subscription timeline</Eyebrow>
          <div className="mt-7 space-y-0">
            {[
              ["12 Mar", "Program started"],
              ["01 Sep", "Payment confirmed"],
              ["01 Oct", "Next renewal"],
            ].map(([date, label], i) => (
              <div key={label} className="grid grid-cols-[auto_1fr] gap-4">
                <div className="flex flex-col items-center">
                  <span
                    className={`size-2 rounded-full ${i < 2 ? "bg-primary" : "border border-primary bg-background"}`}
                  />
                  {i < 2 && <span className="h-14 w-px bg-border" />}
                </div>
                <div className="-mt-1">
                  <small className="text-muted-foreground">{date}</small>
                  <p className="text-sm">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mt-12">
        <Eyebrow>Payment history</Eyebrow>
        <div className="mt-5 divide-y divide-border border-y border-border">
          {[
            ["September 2026", "01 Sep 2026"],
            ["August 2026", "01 Aug 2026"],
            ["July 2026", "01 Jul 2026"],
          ].map(([period, date]) => (
            <div
              key={period}
              className="grid grid-cols-[1fr_auto] items-center gap-5 py-5 sm:grid-cols-[1fr_10rem_8rem]"
            >
              <div>
                <strong className="block text-sm">{period}</strong>
                <small className="text-muted-foreground">{date}</small>
              </div>
              <span className="hidden text-sm sm:block">1,200 MAD</span>
              <Status tone="green">Paid</Status>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function PremiumProfile() {
  return (
    <div className="animate-fade-in">
      <PremiumHeader
        title="Ahmed Benali"
        subtitle="A2 · Intermediate German"
        action={<Button variant="outline">Edit profile</Button>}
      />
      <section className="grid gap-8 xl:grid-cols-[.62fr_1.38fr]">
        <div className="rounded-2xl bg-brand p-8 text-primary-foreground">
          <span className="grid size-24 place-items-center rounded-full bg-primary-foreground/10 font-display text-3xl">
            AB
          </span>
          <h2 className="mt-7 font-display text-3xl">Ahmed Benali</h2>
          <p className="mt-2 text-sm text-primary-foreground/60">A2 · Group 02</p>
          <div className="mt-8 space-y-5 border-t border-primary-foreground/10 pt-6 text-sm">
            <p>
              <span className="block text-primary-foreground/45">Teacher</span>
              {LEAD_TEACHER}
            </p>
            <p>
              <span className="block text-primary-foreground/45">Email</span>ahmed.benali@demo.ma
            </p>
            <p>
              <span className="block text-primary-foreground/45">Member since</span>12 March 2026
            </p>
          </div>
        </div>
        <div>
          <Eyebrow>Learning statistics</Eyebrow>
          <div className="mt-6 grid gap-7 sm:grid-cols-2">
            {[
              ["Attendance", "94%", "Consistently excellent"],
              ["Current streak", "12 days", "Your personal best"],
              ["Lessons completed", "42", "of 52 at A2"],
              ["Mock exams", "3", "Average score 77%"],
            ].map(([label, value, note]) => (
              <div key={label} className="border-t border-border pt-5">
                <span className="text-sm text-muted-foreground">{label}</span>
                <strong className="mt-2 block font-display text-4xl font-normal">{value}</strong>
                <small className="text-muted-foreground">{note}</small>
              </div>
            ))}
          </div>
          <div className="mt-12">
            <Eyebrow>Learning timeline</Eyebrow>
            <div className="mt-6 border-l border-border pl-6">
              {[
                ["September", "Reached 68% of A2"],
                ["August", "Completed Alltag module"],
                ["July", "Passed A1 final assessment"],
                ["March", "Joined Deutsch Academy"],
              ].map(([date, event]) => (
                <div className="relative pb-7" key={date}>
                  <span className="absolute -left-[1.68rem] top-1 size-2 rounded-full bg-primary" />
                  <small className="text-muted-foreground">{date} 2026</small>
                  <p className="mt-1 text-sm">{event}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
