import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Headphones,
  Send,
  Upload,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LEAD_TEACHER } from "@/data/demo-accounts";
import { queryKeys } from "@/lib/query-keys";
import { getLiveSessionJoinState } from "@/lib/jitsi-config";
import { setLiveSessionId } from "@/lib/live-class-session";
import { openExternalMeeting, videoProviderLabel } from "@/lib/live-meeting";
import { AssignmentService, CourseService, LiveSessionService } from "@/services/academy-services";
import { SettingsService } from "@/services/supabase/settings-service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useClasses,
  useConversationMessages,
  useConversations,
  useCreateClassConversation,
  useLiveSessions,
  useLiveSessionsRealtime,
  useMyExamAttempts,
  useSendMessage,
} from "@/hooks/use-academy-data";
import { Metric, PageHeader, ProgressLine, Status, Surface } from "./primitives";
import { useAcademy } from "./academy-context";
import { QueryState } from "./query-state";

export function Materials() {
  const [type, setType] = useState("All");
  const { data = [] } = useQuery({
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
  const { navigate, role } = useAcademy();
  useLiveSessionsRealtime();
  const sessionsQuery = useLiveSessions();
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  const selected = sessions.find((s) => s.id === selectedId) ?? null;

  const weekStart = useMemo(() => {
    const d = new Date(anchor);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [anchor]);

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  const monthCells = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [anchor]);

  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, typeof sessions>();
    for (const session of sessions) {
      const key = dayKey(new Date(session.starts_at));
      const list = map.get(key) ?? [];
      list.push(session);
      map.set(key, list);
    }
    return map;
  }, [sessions]);

  const teacherName = (session: (typeof sessions)[number]) => {
    const p = session.teacher?.profile;
    if (!p) return "—";
    return `${p.first_name} ${p.last_name}`.trim() || "—";
  };

  const formatRange = (startsAt: string, endsAt: string | null) => {
    const start = new Date(startsAt);
    const end = endsAt ? new Date(endsAt) : null;
    const time = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    return end ? `${time(start)} – ${time(end)}` : time(start);
  };

  const weekdayLabel = (d: Date) =>
    d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });

  const isStaff = role === "director" || role === "teacher";
  const joinState = selected
    ? getLiveSessionJoinState({
        startsAt: selected.starts_at,
        endsAt: selected.ends_at,
        status: selected.status,
        isStaff,
      })
    : null;

  const joinFromCalendar = async () => {
    if (!selected) return;
    try {
      const target = await LiveSessionService.joinTarget(selected.id);
      if (target.provider === "zoom") {
        const href = isStaff ? target.start_url || target.url : target.url;
        if (!href) throw new Error("La réunion Zoom n’est pas encore prête.");
        openExternalMeeting(href);
        return;
      }
      setLiveSessionId(selected.id);
      navigate("meeting");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ouverture impossible");
    }
  };

  return (
    <>
      <PageHeader
        title="Calendrier"
        subtitle="Sessions en direct : groupe, niveau et professeur."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setAnchor((prev) => {
                  const d = new Date(prev);
                  d.setDate(d.getDate() - (view === "week" ? 7 : 30));
                  return d;
                })
              }
            >
              Précédent
            </Button>
            <Button
              size="sm"
              variant={view === "week" ? "default" : "outline"}
              onClick={() => setView("week")}
            >
              Semaine
            </Button>
            <Button
              size="sm"
              variant={view === "month" ? "default" : "outline"}
              onClick={() => setView("month")}
            >
              Mois
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setAnchor((prev) => {
                  const d = new Date(prev);
                  d.setDate(d.getDate() + (view === "week" ? 7 : 30));
                  return d;
                })
              }
            >
              Suivant
            </Button>
          </div>
        }
      />
      <QueryState
        isLoading={sessionsQuery.isLoading}
        isError={sessionsQuery.isError}
        error={sessionsQuery.error}
        isEmpty={false}
        onRetry={() => void sessionsQuery.refetch()}
      >
        {view === "week" ? (
          <Surface className="overflow-x-auto">
            <div className="grid min-w-[720px] grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground">
              {weekDays.map((day) => (
                <div className="p-3 sm:p-4" key={dayKey(day)}>
                  {weekdayLabel(day)}
                </div>
              ))}
            </div>
            <div className="grid min-h-[360px] min-w-[720px] grid-cols-7">
              {weekDays.map((day) => {
                const items = sessionsByDay.get(dayKey(day)) ?? [];
                return (
                  <div key={dayKey(day)} className="space-y-2 border-r p-2">
                    {items.map((session) => (
                      <button
                        key={session.id}
                        type="button"
                        className="w-full rounded-md border-l-2 border-primary bg-secondary p-2 text-left"
                        onClick={() => setSelectedId(session.id)}
                      >
                        <strong className="block text-xs">{session.title}</strong>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {formatRange(session.starts_at, session.ends_at)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {session.class?.name ?? "—"} · {session.class?.level?.code ?? "—"}
                        </p>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </Surface>
        ) : (
          <Surface className="overflow-x-auto p-2 sm:p-4">
            <p className="mb-3 text-sm font-medium capitalize">
              {anchor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </p>
            <div className="grid min-w-[640px] grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
                <div key={d} className="p-2 font-medium">
                  {d}
                </div>
              ))}
              {monthCells.map((day) => {
                const inMonth = day.getMonth() === anchor.getMonth();
                const items = sessionsByDay.get(dayKey(day)) ?? [];
                return (
                  <div
                    key={dayKey(day)}
                    className={`min-h-24 rounded-md border p-1.5 text-left ${inMonth ? "bg-card" : "bg-muted/40 opacity-60"}`}
                  >
                    <p className="mb-1 text-[11px] font-medium">{day.getDate()}</p>
                    <div className="space-y-1">
                      {items.slice(0, 3).map((session) => (
                        <button
                          key={session.id}
                          type="button"
                          className="block w-full truncate rounded bg-secondary px-1 py-0.5 text-[10px]"
                          onClick={() => setSelectedId(session.id)}
                        >
                          {session.title}
                        </button>
                      ))}
                      {items.length > 3 && (
                        <p className="text-[10px] text-muted-foreground">+{items.length - 3}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Surface>
        )}
      </QueryState>

      {selected && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-3">
            <h2 className="text-lg font-semibold">{selected.title}</h2>
            <p className="text-sm text-muted-foreground">
              {formatRange(selected.starts_at, selected.ends_at)} ·{" "}
              {new Date(selected.starts_at).toLocaleDateString("fr-FR")}
            </p>
            <p className="text-sm">
              Groupe : <strong>{selected.class?.name ?? "—"}</strong>
            </p>
            <p className="text-sm">
              Niveau : <strong>{selected.class?.level?.code ?? "—"}</strong>
            </p>
            <p className="text-sm">
              Professeur : <strong>{teacherName(selected)}</strong>
            </p>
            <p className="text-sm">
              Mode : <strong>En ligne</strong>
            </p>
            {isStaff && (
              <p className="text-sm">
                Visioconférence :{" "}
                <strong>
                  {videoProviderLabel(selected.video_provider, selected.video_provider === "zoom")}
                </strong>
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Statut :{" "}
              {selected.status === "live"
                ? "En direct"
                : selected.status === "scheduled"
                  ? "Planifiée"
                  : selected.status === "completed"
                    ? "Terminée"
                    : "Annulée"}
            </p>
            <div className="flex justify-end gap-2">
              {(selected.status === "scheduled" || selected.status === "live") && (
                <Button
                  onClick={() => void joinFromCalendar()}
                  disabled={Boolean(joinState && !joinState.allowed && !isStaff)}
                >
                  Rejoindre le cours
                </Button>
              )}
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

export function Assignments({ detail }: { detail: boolean }) {
  const { navigate } = useAcademy();
  const { data = [] } = useQuery({
    queryKey: ["assignments"],
    queryFn: () => AssignmentService.list(),
  });
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

export function Messages({ counterpart: _counterpart }: { counterpart?: string } = {}) {
  const { role, user } = useAcademy();
  const conversationsQuery = useConversations();
  const classesQuery = useClasses();
  const createConversation = useCreateClassConversation();
  const sendMessage = useSendMessage();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [convName, setConvName] = useState("");
  const [includeTeacher, setIncludeTeacher] = useState(true);

  const conversations = conversationsQuery.data ?? [];
  const active = conversations.find((c) => c.id === activeId) ?? conversations[0] ?? null;
  const activeConversationId = active?.id ?? null;
  const messagesQuery = useConversationMessages(activeConversationId);

  useEffect(() => {
    if (!activeId && conversations[0]?.id) setActiveId(conversations[0].id);
  }, [activeId, conversations]);

  const memberLabel = (c: (typeof conversations)[number]) => {
    const count = c.members?.length ?? 0;
    return `${count} membre${count === 1 ? "" : "s"}`;
  };

  return (
    <>
      <PageHeader
        title="Messagerie"
        subtitle="Conversations de groupe et échanges avec l’équipe."
        action={
          role === "director" ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              + Conversation de groupe
            </Button>
          ) : undefined
        }
      />
      <Surface className="grid min-h-[560px] overflow-hidden md:grid-cols-[17rem_1fr]">
        <aside className="border-r p-3">
          <QueryState
            isLoading={conversationsQuery.isLoading}
            isError={conversationsQuery.isError}
            error={conversationsQuery.error}
            isEmpty={!conversations.length}
            emptyTitle="Aucune conversation"
            emptyMessage={
              role === "director"
                ? "Créez une conversation à partir d’un groupe."
                : "Vous n’êtes membre d’aucune conversation."
            }
            onRetry={() => void conversationsQuery.refetch()}
          >
            {conversations.map((item) => (
              <button
                className={`mb-1 w-full rounded-md p-3 text-left text-sm ${
                  item.id === activeConversationId ? "bg-secondary text-primary" : "hover:bg-muted"
                }`}
                key={item.id}
                type="button"
                onClick={() => setActiveId(item.id)}
              >
                {item.name}
                <small className="mt-1 block text-muted-foreground">
                  {item.class?.name ? `${item.class.name} · ` : ""}
                  {memberLabel(item)}
                </small>
              </button>
            ))}
          </QueryState>
        </aside>
        <div className="flex min-h-[420px] flex-col">
          {active ? (
            <>
              <div className="border-b p-4">
                <strong>{active.name}</strong>
                {active.class?.name && (
                  <small className="ml-2 text-muted-foreground">{active.class.name}</small>
                )}
                {(active.members?.length ?? 0) > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(active.members ?? [])
                      .slice(0, 6)
                      .map((m) =>
                        m.profile ? `${m.profile.first_name} ${m.profile.last_name}`.trim() : "—",
                      )
                      .join(", ")}
                    {(active.members?.length ?? 0) > 6 ? "…" : ""}
                  </p>
                )}
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {(messagesQuery.data ?? []).map((message) => {
                  const mine = message.sender_id === user?.id;
                  const senderName = message.sender
                    ? `${message.sender.first_name} ${message.sender.last_name}`.trim()
                    : "—";
                  return (
                    <div
                      key={message.id}
                      className={`max-w-md rounded-lg p-3 text-sm ${
                        mine ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {!mine && (
                        <p className="mb-1 text-[11px] font-medium opacity-80">{senderName}</p>
                      )}
                      {message.body}
                      <p
                        className={`mt-1 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                      >
                        {new Date(message.created_at).toLocaleString("fr-FR")}
                      </p>
                    </div>
                  );
                })}
                {!messagesQuery.isLoading && !messagesQuery.data?.length && (
                  <p className="text-sm text-muted-foreground">Aucun message pour l’instant.</p>
                )}
              </div>
              <form
                className="flex gap-2 border-t p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!text.trim() || !activeConversationId || !user?.id) return;
                  sendMessage.mutate(
                    {
                      conversationId: activeConversationId,
                      body: text.trim(),
                      senderId: user.id,
                    },
                    {
                      onSuccess: () => setText(""),
                      onError: (err) => toast.error(err.message),
                    },
                  );
                }}
              >
                <Input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Écrire un message…"
                  disabled={!user?.id}
                />
                <Button size="icon" disabled={sendMessage.isPending || !text.trim()}>
                  <Send />
                </Button>
              </form>
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-6 text-sm text-muted-foreground">
              Sélectionnez une conversation
            </div>
          )}
        </div>
      </Surface>

      {createOpen && role === "director" && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <h2 className="text-lg font-semibold">Conversation de groupe</h2>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                const cls = (classesQuery.data ?? []).find((c) => c.id === e.target.value);
                if (cls && !convName) setConvName(cls.name);
              }}
            >
              <option value="">Choisir le groupe</option>
              {(classesQuery.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {item.level}
                </option>
              ))}
            </select>
            <Input
              placeholder="Nom de la conversation"
              value={convName}
              onChange={(e) => setConvName(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeTeacher}
                onChange={(e) => setIncludeTeacher(e.target.checked)}
              />
              Inclure le professeur du groupe
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button
                disabled={!classId || !convName.trim() || createConversation.isPending}
                onClick={() => {
                  createConversation.mutate(
                    {
                      classId,
                      name: convName.trim(),
                      includeTeacher,
                    },
                    {
                      onSuccess: (conv) => {
                        toast.success("Conversation créée");
                        setCreateOpen(false);
                        setClassId("");
                        setConvName("");
                        setActiveId(conv.id);
                      },
                      onError: (err) => toast.error(err.message),
                    },
                  );
                }}
              >
                Créer
              </Button>
            </div>
          </Surface>
        </div>
      )}
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
          <p className="mt-2 text-sm text-muted-foreground">teacher@gla.academy</p>
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
  const qc = useQueryClient();
  const mapQuery = useQuery({
    queryKey: queryKeys.branding.settings,
    queryFn: () => SettingsService.getMap(),
  });
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    const map = mapQuery.data;
    if (!map) return;
    if (typeof map["academy_name"] === "string") setName(map["academy_name"]);
    if (typeof map["academy_tagline"] === "string") setTagline(map["academy_tagline"]);
    if (typeof map["logo_url"] === "string") setLogoUrl(map["logo_url"]);
  }, [mapQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      await SettingsService.upsertPublic("academy_name", name);
      await SettingsService.upsertPublic("academy_tagline", tagline);
      await SettingsService.upsertPublic("logo_url", logoUrl || null);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.branding.settings });
      toast.success("Identité du centre mise à jour");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <PageHeader
        title="Paramètres"
        subtitle="Identité publique, accès et canaux de notification."
      />
      <Surface className="mb-6 space-y-4 p-6">
        <h2 className="font-semibold">Identité du centre</h2>
        <label className="block text-sm">
          Nom
          <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-sm">
          Slogan
          <Input className="mt-1" value={tagline} onChange={(e) => setTagline(e.target.value)} />
        </label>
        <label className="block text-sm">
          URL du logo (ou chemin public)
          <Input className="mt-1" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
        </label>
        <Button disabled={save.isPending} onClick={() => save.mutate()}>
          Enregistrer
        </Button>
      </Surface>
      <Surface className="space-y-5 p-6">
        <div>
          <h2 className="font-semibold">Politique d’accès</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            ACTIVE : accès complet. PAST DUE : avertissement. SUSPENDED : cours, live et examens
            bloqués ; paiements, profil et assistance restent ouverts.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">Canaux externes</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            E-mail / WhatsApp : voir adaptateurs non configurés tant que les secrets Edge ne sont
            pas définis. Les notifications in-app restent toujours disponibles.
          </p>
        </div>
      </Surface>
    </>
  );
}

export function DirectorAssignments() {
  const { data = [] } = useQuery({
    queryKey: ["assignments"],
    queryFn: () => AssignmentService.list(),
  });
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
