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
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queryKeys } from "@/lib/query-keys";
import { getLiveSessionJoinState } from "@/lib/jitsi-config";
import { setLiveSessionId } from "@/lib/live-class-session";
import {
  openExternalMeeting,
  joinLiveSession,
  videoProviderLabel,
  liveStatusLabel,
  formatLiveTime,
  isLiveSessionExpired,
  isZoomActive,
  zoomMeetingDurationMinutes,
} from "@/lib/live-meeting";
import {
  AssignmentService,
  CourseService,
  LiveSessionService,
  MessagingService,
  RecordingService,
} from "@/services/academy-services";
import { SettingsService } from "@/services/supabase/settings-service";
import { DangerZoneAccountDeletion } from "./danger-zone-account-deletion";
import { DocumentViewer } from "./document-viewer";
import { PeoplePicker } from "./people-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useAddConversationMember,
  useAllExamAttempts,
  useAssignments,
  useClasses,
  useConversationMessages,
  useConversations,
  useCreateClassConversation,
  useCreateRecordingFromUrl,
  useLevels,
  useLiveSessions,
  useLiveSessionsRealtime,
  useUpdateLiveSessionStatus,
  useMyExamAttempts,
  usePayments,
  useRecordings,
  useRemoveConversationMember,
  useSendMessage,
  useStudents,
  useTeachers,
  useUploadRecording,
} from "@/hooks/use-academy-data";
import type { ClassDetail } from "@/lib/academy-mappers";
import type { Student } from "@/types/academy";
import { Metric, PageHeader, ProgressLine, Status, Surface } from "./primitives";
import { useAcademy } from "./academy-context";
import { QueryState } from "./query-state";

type PeriodDays = 30 | 90 | 365;

function settingString(
  map: Record<string, unknown> | undefined,
  key: string,
  fallback = "",
): string {
  const value = map?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return fallback;
}

function formatMoney(amount: number, currency: string) {
  const code = currency.trim() || "MAD";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString("fr-FR")} ${code}`;
  }
}

function withinPeriod(iso: string | null | undefined, cutoff: Date) {
  if (!iso) return false;
  return new Date(iso).getTime() >= cutoff.getTime();
}

function studentMatchesFilters(
  student: Student,
  classes: ClassDetail[],
  filters: { level: string; classId: string; teacherId: string },
) {
  if (filters.level && student.level !== filters.level) return false;
  if (filters.classId && student.classId !== filters.classId) return false;
  if (filters.teacherId) {
    const klass = classes.find((item) => item.id === student.classId);
    if (klass?.teacherId !== filters.teacherId) return false;
  }
  return true;
}

function classMatchesFilters(
  klass: ClassDetail,
  filters: { level: string; classId: string; teacherId: string },
) {
  if (filters.level && klass.level !== filters.level) return false;
  if (filters.classId && klass.id !== filters.classId) return false;
  if (filters.teacherId && klass.teacherId !== filters.teacherId) return false;
  return true;
}

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

export function CalendarPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { navigate, role } = useAcademy();
  useLiveSessionsRealtime();
  const sessionsQuery = useLiveSessions();
  const classesQuery = useClasses();
  const teachersQuery = useTeachers();
  const updateStatus = useUpdateLiveSessionStatus();
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");

  const sessions = useMemo(() => {
    const now = Date.now();
    return (sessionsQuery.data ?? []).filter((s) => {
      if (isLiveSessionExpired(s, now)) return false;
      if (classFilter && s.class_id !== classFilter) return false;
      if (teacherFilter && s.teacher_id !== teacherFilter) return false;
      return true;
    });
  }, [sessionsQuery.data, classFilter, teacherFilter]);
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
      await joinLiveSession(selected.id, {
        isStaff,
        onJitsi: (id) => {
          setLiveSessionId(id);
          navigate("meeting");
        },
        resolveTarget: (id) => LiveSessionService.joinTarget(id),
      });
      if (isStaff && selected.status === "scheduled") {
        updateStatus.mutate({ id: selected.id, status: "live" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ouverture impossible");
    }
  };

  const sessionMetaLine = (session: (typeof sessions)[number]) => {
    const duration = zoomMeetingDurationMinutes(session.starts_at, session.ends_at);
    const zoom = isZoomActive(session.video_provider);
    return `${formatRange(session.starts_at, session.ends_at)} · ${session.class?.name ?? "—"} · ${teacherName(session)} · ${videoProviderLabel(session.video_provider, zoom)} · ${liveStatusLabel(session.status)} · ${duration} min`;
  };

  const viewControls = (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          setAnchor((prev) => {
            const d = new Date(prev);
            if (view === "week") d.setDate(d.getDate() - 7);
            else d.setMonth(d.getMonth() - 1);
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
            if (view === "week") d.setDate(d.getDate() + 7);
            else d.setMonth(d.getMonth() + 1);
            return d;
          })
        }
      >
        Suivant
      </Button>
    </div>
  );

  return (
    <>
      {embedded ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium">Planning intégré</h3>
          {viewControls}
        </div>
      ) : (
        <PageHeader
          title="Calendrier"
          subtitle="Planning des cours en direct : heure, groupe, professeur, statut."
          action={viewControls}
        />
      )}
      <div className="mb-4 flex flex-wrap gap-2">
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
        >
          <option value="">Tous les groupes</option>
          {(classesQuery.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={teacherFilter}
          onChange={(e) => setTeacherFilter(e.target.value)}
        >
          <option value="">Tous les professeurs</option>
          {(teachersQuery.data ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
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
                        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                          {sessionMetaLine(session)}
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
                          {formatRange(session.starts_at, session.ends_at)} ·{" "}
                          {session.class?.name ?? "—"} · {liveStatusLabel(session.status)}
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
          <Surface className="mobile-modal-panel space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold">{selected.title}</h2>
              <Status
                tone={
                  selected.status === "live"
                    ? "green"
                    : selected.status === "scheduled"
                      ? "amber"
                      : "red"
                }
              >
                {liveStatusLabel(selected.status)}
              </Status>
            </div>
            <dl className="text-sm">
              <div className="grid grid-cols-[minmax(0,7rem)_1fr] gap-x-3 gap-y-2">
                <dt className="text-muted-foreground">Date</dt>
                <dd>{new Date(selected.starts_at).toLocaleDateString("fr-FR")}</dd>
                <dt className="text-muted-foreground">Horaire</dt>
                <dd>{formatRange(selected.starts_at, selected.ends_at)}</dd>
                <dt className="text-muted-foreground">Durée</dt>
                <dd>{zoomMeetingDurationMinutes(selected.starts_at, selected.ends_at)} min</dd>
                <dt className="text-muted-foreground">Groupe</dt>
                <dd>{selected.class?.name ?? "—"}</dd>
                <dt className="text-muted-foreground">Professeur</dt>
                <dd>{teacherName(selected)}</dd>
                <dt className="text-muted-foreground">Visioconférence</dt>
                <dd>
                  {videoProviderLabel(
                    selected.video_provider,
                    isZoomActive(selected.video_provider),
                  )}
                </dd>
              </div>
            </dl>
            {joinState && !joinState.allowed && !isStaff && joinState.reason === "too_early" && (
              <p className="text-sm text-amber-700">
                Accès possible uniquement à partir de l’heure de début du créneau.
              </p>
            )}
            <div className="flex justify-end gap-2">
              {(selected.status === "scheduled" || selected.status === "live") && (
                <Button
                  onClick={() => void joinFromCalendar()}
                  disabled={Boolean(joinState && !joinState.allowed && !isStaff)}
                >
                  {isStaff ? (selected.status === "live" ? "Rejoindre" : "Démarrer") : "Rejoindre"}
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
  const levelsQuery = useLevels();
  const createConversation = useCreateClassConversation();
  const sendMessage = useSendMessage();
  const addMember = useAddConversationMember();
  const removeMember = useRemoveConversationMember();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [levelId, setLevelId] = useState("");
  const [classId, setClassId] = useState("");
  const [convName, setConvName] = useState("");
  const [includeTeacher, setIncludeTeacher] = useState(true);
  const [addProfileId, setAddProfileId] = useState("");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<{
    title: string;
    url: string | null;
    mimeType: string | null;
    loading: boolean;
    error: string | null;
  } | null>(null);

  const conversations = useMemo(() => conversationsQuery.data ?? [], [conversationsQuery.data]);
  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.name.toLowerCase().includes(q));
  }, [conversations, search]);
  const active = conversations.find((c) => c.id === activeId) ?? conversations[0] ?? null;
  const activeConversationId = active?.id ?? null;
  const messagesQuery = useConversationMessages(activeConversationId);
  const classesForLevel = useMemo(
    () => (classesQuery.data ?? []).filter((c) => !levelId || c.levelId === levelId),
    [classesQuery.data, levelId],
  );

  useEffect(() => {
    if (!activeId && conversations[0]?.id) setActiveId(conversations[0].id);
  }, [activeId, conversations]);

  const memberLabel = (c: (typeof conversations)[number]) => {
    const count = c.members?.length ?? 0;
    return `${count} membre${count === 1 ? "" : "s"}`;
  };

  const openAttachment = async (messageId: string) => {
    const message = (messagesQuery.data ?? []).find((m) => m.id === messageId);
    if (!message?.attachment_path) return;
    const title = message.attachment_name ?? "Pièce jointe";
    setPreview({
      title,
      url: null,
      mimeType: message.attachment_mime ?? null,
      loading: true,
      error: null,
    });
    try {
      const url = await MessagingService.getAttachmentSignedUrl(message);
      setPreview({
        title,
        url,
        mimeType: message.attachment_mime ?? null,
        loading: false,
        error: null,
      });
    } catch (err) {
      setPreview({
        title,
        url: null,
        mimeType: message.attachment_mime ?? null,
        loading: false,
        error: err instanceof Error ? err.message : "Aperçu impossible",
      });
    }
  };

  const memberProfileIds = useMemo(
    () => (active?.members ?? []).map((member) => member.profile_id),
    [active?.members],
  );

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
          <Input
            className="mb-3"
            placeholder="Rechercher une conversation…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <QueryState
            isLoading={conversationsQuery.isLoading}
            isError={conversationsQuery.isError}
            error={conversationsQuery.error}
            isEmpty={!filteredConversations.length}
            emptyTitle="Aucune conversation"
            emptyMessage={
              search.trim()
                ? "Aucune conversation ne correspond à votre recherche."
                : role === "director"
                  ? "Créez une conversation à partir d’un groupe."
                  : "Vous n’êtes membre d’aucune conversation."
            }
            onRetry={() => void conversationsQuery.refetch()}
          >
            {filteredConversations.map((item) => (
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
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <strong>{active.name}</strong>
                    {active.class?.name && (
                      <small className="ml-2 text-muted-foreground">{active.class.name}</small>
                    )}
                    {(active.members?.length ?? 0) > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {(active.members ?? [])
                          .slice(0, 6)
                          .map((m) =>
                            m.profile
                              ? `${m.profile.first_name} ${m.profile.last_name}`.trim()
                              : "—",
                          )
                          .join(", ")}
                        {(active.members?.length ?? 0) > 6 ? "…" : ""}
                      </p>
                    )}
                  </div>
                  {role === "director" && (
                    <Button size="sm" variant="outline" onClick={() => setMembersOpen(true)}>
                      Gérer les membres
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {(messagesQuery.data ?? []).map((message) => {
                  const mine = message.sender_id === user?.id;
                  const senderName = message.sender
                    ? `${message.sender.first_name} ${message.sender.last_name}`.trim()
                    : "—";
                  const isImage = Boolean(message.attachment_mime?.startsWith("image/"));
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
                      {message.body ? <p>{message.body}</p> : null}
                      {message.attachment_path ? (
                        <button
                          type="button"
                          className={`mt-2 block text-left text-xs underline ${
                            mine ? "text-primary-foreground/90" : "text-primary"
                          }`}
                          onClick={() => void openAttachment(message.id)}
                        >
                          {isImage
                            ? `Image · ${message.attachment_name ?? "aperçu"}`
                            : `PDF · ${message.attachment_name ?? "fichier"}`}
                        </button>
                      ) : null}
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
                className="space-y-2 border-t p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if ((!text.trim() && !file) || !activeConversationId || !user?.id) return;
                  sendMessage.mutate(
                    {
                      conversationId: activeConversationId,
                      body: text.trim(),
                      senderId: user.id,
                      file,
                    },
                    {
                      onSuccess: () => {
                        setText("");
                        setFile(null);
                      },
                      onError: (err) => toast.error(err.message),
                    },
                  );
                }}
              >
                {file ? (
                  <p className="text-xs text-muted-foreground">
                    Pièce jointe : {file.name}{" "}
                    <button type="button" className="underline" onClick={() => setFile(null)}>
                      retirer
                    </button>
                  </p>
                ) : null}
                <div className="flex gap-2">
                  <Input
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="Écrire un message…"
                    disabled={!user?.id}
                  />
                  <label className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-input bg-background hover:bg-muted">
                    <input
                      type="file"
                      className="hidden"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                    <Upload className="size-4" />
                  </label>
                  <Button size="icon" disabled={sendMessage.isPending || (!text.trim() && !file)}>
                    <Send />
                  </Button>
                </div>
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
            <label className="block text-sm">
              Niveau
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={levelId}
                onChange={(e) => {
                  setLevelId(e.target.value);
                  setClassId("");
                }}
              >
                <option value="">Choisir le niveau</option>
                {(levelsQuery.data ?? []).map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.code} · {level.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Groupe
              <select
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={classId}
                disabled={!levelId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  const cls = classesForLevel.find((c) => c.id === e.target.value);
                  if (cls && !convName) setConvName(cls.name);
                }}
              >
                <option value="">Choisir le groupe</option>
                {classesForLevel.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
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
              <Button
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  setLevelId("");
                  setClassId("");
                  setConvName("");
                }}
              >
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
                        setLevelId("");
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

      {membersOpen && role === "director" && active && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <h2 className="text-lg font-semibold">Membres · {active.name}</h2>
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Membres actuels</h3>
              <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                {(active.members ?? []).length === 0 ? (
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                    Aucun membre pour le moment.
                  </p>
                ) : (
                  (active.members ?? []).map((m) => (
                    <div
                      key={m.profile_id}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <span>
                        {m.profile
                          ? `${m.profile.first_name} ${m.profile.last_name}`.trim()
                          : m.profile_id}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={removeMember.isPending}
                        onClick={() =>
                          removeMember.mutate(
                            { conversationId: active.id, profileId: m.profile_id },
                            {
                              onSuccess: () => toast.success("Membre retiré"),
                              onError: (err) => toast.error(err.message),
                            },
                          )
                        }
                      >
                        Retirer
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Ajouter un membre</h3>
              <PeoplePicker
                purpose="messaging"
                selectedId={addProfileId}
                excludeIds={memberProfileIds}
                excludeKind="profile"
                onSelect={setAddProfileId}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMembersOpen(false)}>
                Fermer
              </Button>
              <Button
                disabled={!addProfileId || addMember.isPending}
                onClick={() =>
                  addMember.mutate(
                    { conversationId: active.id, profileId: addProfileId, role: "member" },
                    {
                      onSuccess: () => {
                        toast.success("Membre ajouté");
                        setAddProfileId("");
                      },
                      onError: (err) => toast.error(err.message),
                    },
                  )
                }
              >
                Ajouter
              </Button>
            </div>
          </Surface>
        </div>
      )}

      <DocumentViewer
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview?.title ?? ""}
        url={preview?.url ?? null}
        mimeType={preview?.mimeType}
        loading={preview?.loading}
        error={preview?.error}
      />
    </>
  );
}

export function TeacherProfile() {
  const { user } = useAcademy();
  const teachersQuery = useTeachers();
  const classesQuery = useClasses();
  const sessionsQuery = useLiveSessions();
  const assignmentsQuery = useAssignments();

  const me = (teachersQuery.data ?? []).find(
    (teacher) => teacher.email.toLowerCase() === (user?.email ?? "").toLowerCase(),
  );
  const myClasses = (classesQuery.data ?? []).filter((item) => item.teacherId === me?.id);
  const classIds = new Set(myClasses.map((item) => item.id));
  const weekStart = useMemo(() => {
    const d = new Date();
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    return d;
  }, [weekStart]);
  const sessionsThisWeek = (sessionsQuery.data ?? []).filter((session) => {
    if (!classIds.has(session.class_id)) return false;
    const start = new Date(session.starts_at);
    return start >= weekStart && start < weekEnd && session.status !== "cancelled";
  });
  const publishedAssignments = (assignmentsQuery.data ?? []).filter(
    (item) => (!item.classId || classIds.has(item.classId)) && item.status === "Publié",
  );
  const studentCount = myClasses.reduce((total, item) => total + item.size, 0);
  const levels = me?.levels.length ? me.levels.join(" / ") : "—";

  return (
    <>
      <PageHeader
        title={me?.name ?? user?.name ?? "Profil enseignant"}
        subtitle={`Profil pédagogique · ${levels}`}
      />
      <QueryState
        isLoading={teachersQuery.isLoading || classesQuery.isLoading}
        isError={teachersQuery.isError || classesQuery.isError}
        error={(teachersQuery.error ?? classesQuery.error) as Error | null}
        isEmpty={!me}
        emptyTitle="Profil introuvable"
        emptyMessage="Votre fiche enseignant n’a pas encore été créée par l’administration."
        onRetry={() => {
          void teachersQuery.refetch();
          void classesQuery.refetch();
        }}
      >
        <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
          <Surface className="p-6">
            <h2 className="font-semibold">{me?.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{me?.email || "—"}</p>
            {me?.phone ? <p className="mt-2 text-sm text-muted-foreground">{me.phone}</p> : null}
            <p className="mt-4 text-sm">
              {myClasses.length
                ? `Groupes assignés : ${myClasses.map((item) => item.name).join(", ")}`
                : "Aucun groupe assigné"}
            </p>
          </Surface>
          <div className="grid gap-4 sm:grid-cols-3">
            <Metric label="Étudiants" value={String(studentCount)} />
            <Metric label="Séances cette semaine" value={String(sessionsThisWeek.length)} />
            <Metric
              label="Devoirs publiés"
              value={String(publishedAssignments.length)}
              icon={<CheckCircle2 />}
            />
          </div>
        </div>
      </QueryState>
    </>
  );
}

export function DirectorReports() {
  const studentsQuery = useStudents();
  const paymentsQuery = usePayments();
  const classesQuery = useClasses();
  const teachersQuery = useTeachers();
  const attemptsQuery = useAllExamAttempts();
  const assignmentsQuery = useAssignments();
  const sessionsQuery = useLiveSessions();

  const [periodDays, setPeriodDays] = useState<PeriodDays>(90);
  const [levelFilter, setLevelFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");

  const cutoff = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - periodDays);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [periodDays]);

  const filters = useMemo(
    () => ({ level: levelFilter, classId: classFilter, teacherId: teacherFilter }),
    [levelFilter, classFilter, teacherFilter],
  );

  const classes = classesQuery.data ?? [];
  const students = studentsQuery.data ?? [];
  const filteredStudents = useMemo(
    () => students.filter((student) => studentMatchesFilters(student, classes, filters)),
    [students, classes, filters],
  );
  const filteredStudentIds = useMemo(
    () => new Set(filteredStudents.map((student) => student.id)),
    [filteredStudents],
  );

  const filteredPayments = useMemo(() => {
    return (paymentsQuery.data ?? []).filter((payment) => {
      if (!filteredStudentIds.has(payment.student_id)) return false;
      return withinPeriod(payment.created_at, cutoff);
    });
  }, [paymentsQuery.data, filteredStudentIds, cutoff]);

  const filteredAttempts = useMemo(() => {
    return (attemptsQuery.data ?? []).filter((attempt) => {
      if (!filteredStudentIds.has(attempt.student_id)) return false;
      const submittedAt = attempt.submitted_at ?? attempt.started_at;
      return withinPeriod(submittedAt, cutoff);
    });
  }, [attemptsQuery.data, filteredStudentIds, cutoff]);

  const currency = useMemo(() => {
    const sample = paymentsQuery.data?.[0];
    return sample?.currency?.trim() || "MAD";
  }, [paymentsQuery.data]);

  const paymentStats = useMemo(() => {
    const expected = filteredPayments.reduce((acc, row) => acc + Number(row.amount ?? 0), 0);
    const collected = filteredPayments.reduce((acc, row) => {
      if (row.status === "paid") {
        return acc + Number(row.amount_paid ?? row.amount ?? 0);
      }
      return acc + Number(row.amount_paid ?? 0);
    }, 0);
    const paidCount = filteredPayments.filter((row) => row.status === "paid").length;
    const overdueCount = filteredPayments.filter((row) => row.status === "overdue").length;
    return { expected, collected, paidCount, overdueCount };
  }, [filteredPayments]);

  const hasCreatedAt = filteredStudents.some((student) => Boolean(student.createdAt));

  const enrollmentChart = useMemo(() => {
    if (hasCreatedAt) {
      const buckets = new Map<string, number>();
      for (const student of filteredStudents) {
        if (!student.createdAt || !withinPeriod(student.createdAt, cutoff)) continue;
        const weekStart = new Date(student.createdAt);
        const day = (weekStart.getDay() + 6) % 7;
        weekStart.setDate(weekStart.getDate() - day);
        const label = weekStart.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
        buckets.set(label, (buckets.get(label) ?? 0) + 1);
      }
      return Array.from(buckets.entries())
        .map(([label, count]) => ({ label, count }))
        .slice(-12);
    }
    const levels = ["A1", "A2", "B1", "B2"] as const;
    return levels.map((level) => ({
      label: level,
      count: filteredStudents.filter((student) => student.level === level).length,
    }));
  }, [filteredStudents, hasCreatedAt, cutoff]);

  const revenueChart = useMemo(() => {
    const buckets = new Map<string, { collected: number; expected: number }>();
    for (const payment of filteredPayments) {
      const label = new Date(payment.created_at).toLocaleDateString("fr-FR", {
        month: "short",
        year: "2-digit",
      });
      const current = buckets.get(label) ?? { collected: 0, expected: 0 };
      current.expected += Number(payment.amount ?? 0);
      if (payment.status === "paid") {
        current.collected += Number(payment.amount_paid ?? payment.amount ?? 0);
      } else {
        current.collected += Number(payment.amount_paid ?? 0);
      }
      buckets.set(label, current);
    }
    return Array.from(buckets.entries()).map(([label, values]) => ({
      label,
      collected: Math.round(values.collected),
      expected: Math.round(values.expected),
    }));
  }, [filteredPayments]);

  const examByLevel = useMemo(() => {
    const levels = ["A1", "B1"] as const;
    return levels.map((level) => {
      const rows = filteredAttempts.filter((attempt) => {
        const examLevel = attempt.exam?.level?.code;
        const studentLevel = attempt.student?.level_code;
        return examLevel === level || studentLevel === level;
      });
      if (!rows.length) return { level, average: null, count: 0 };
      const average = Math.round(
        rows.reduce((acc, row) => acc + Number(row.percentage ?? 0), 0) / rows.length,
      );
      return { level, average, count: rows.length };
    });
  }, [filteredAttempts]);

  const progressionByLevel = useMemo(() => {
    const levels = ["A1", "A2", "B1", "B2"] as const;
    const studentBest = new Map<string, number>();
    for (const attempt of filteredAttempts) {
      const pct = Number(attempt.percentage ?? 0);
      const prev = studentBest.get(attempt.student_id) ?? 0;
      if (pct > prev) studentBest.set(attempt.student_id, pct);
    }
    return levels.map((level) => {
      const levelStudents = filteredStudents.filter((student) => student.level === level);
      if (!levelStudents.length) return { level, average: 0, count: 0 };
      const scores = levelStudents
        .map((student) => studentBest.get(student.id))
        .filter((value): value is number => value != null);
      const average =
        scores.length > 0
          ? Math.round(scores.reduce((acc, value) => acc + value, 0) / scores.length)
          : 0;
      return { level, average, count: levelStudents.length };
    });
  }, [filteredAttempts, filteredStudents]);

  const groupPerformance = useMemo(() => {
    const studentBest = new Map<string, number>();
    for (const attempt of filteredAttempts) {
      const pct = Number(attempt.percentage ?? 0);
      const prev = studentBest.get(attempt.student_id) ?? 0;
      if (pct > prev) studentBest.set(attempt.student_id, pct);
    }
    const assignmentCounts = new Map<string, number>();
    for (const assignment of assignmentsQuery.data ?? []) {
      if (!assignment.classId) continue;
      assignmentCounts.set(assignment.classId, (assignmentCounts.get(assignment.classId) ?? 0) + 1);
    }
    return classes
      .filter((klass) => classMatchesFilters(klass, filters))
      .map((klass) => {
        const roster = filteredStudents.filter((student) => student.classId === klass.id);
        const scores = roster
          .map((student) => studentBest.get(student.id))
          .filter((value): value is number => value != null);
        const avgProgress =
          scores.length > 0
            ? Math.round(scores.reduce((acc, value) => acc + value, 0) / scores.length)
            : null;
        const liveCount = (sessionsQuery.data ?? []).filter(
          (session) => session.class_id === klass.id && withinPeriod(session.starts_at, cutoff),
        ).length;
        return {
          id: klass.id,
          name: klass.name,
          level: klass.level,
          size: roster.length || klass.size,
          teacher: klass.teacher,
          schedule: klass.schedule,
          avgProgress,
          assignments: assignmentCounts.get(klass.id) ?? 0,
          liveSessions: liveCount,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [
    classes,
    filters,
    filteredStudents,
    filteredAttempts,
    assignmentsQuery.data,
    sessionsQuery.data,
    cutoff,
  ]);

  const isLoading =
    studentsQuery.isLoading ||
    paymentsQuery.isLoading ||
    classesQuery.isLoading ||
    attemptsQuery.isLoading;

  const isError =
    studentsQuery.isError || paymentsQuery.isError || classesQuery.isError || attemptsQuery.isError;

  const firstError =
    studentsQuery.error ?? paymentsQuery.error ?? classesQuery.error ?? attemptsQuery.error ?? null;

  const retryAll = () => {
    void studentsQuery.refetch();
    void paymentsQuery.refetch();
    void classesQuery.refetch();
    void attemptsQuery.refetch();
    void assignmentsQuery.refetch();
    void sessionsQuery.refetch();
  };

  const hasExamData = filteredAttempts.length > 0;

  return (
    <>
      <PageHeader
        title="Rapports"
        subtitle="Indicateurs calculés à partir des données de l’académie — filtres appliqués côté client."
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={periodDays}
          onChange={(event) => setPeriodDays(Number(event.target.value) as PeriodDays)}
        >
          <option value={30}>30 jours</option>
          <option value={90}>90 jours</option>
          <option value={365}>365 jours</option>
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={levelFilter}
          onChange={(event) => setLevelFilter(event.target.value)}
        >
          <option value="">Tous les niveaux</option>
          {["A1", "A2", "B1", "B2"].map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={classFilter}
          onChange={(event) => setClassFilter(event.target.value)}
        >
          <option value="">Tous les groupes</option>
          {classes.map((klass) => (
            <option key={klass.id} value={klass.id}>
              {klass.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={teacherFilter}
          onChange={(event) => setTeacherFilter(event.target.value)}
        >
          <option value="">Tous les professeurs</option>
          {(teachersQuery.data ?? []).map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.name}
            </option>
          ))}
        </select>
      </div>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={firstError}
        isEmpty={!filteredStudents.length && !filteredPayments.length}
        emptyTitle="Aucune donnée sur la période"
        emptyMessage="Élargissez la période ou retirez les filtres pour afficher les indicateurs."
        onRetry={retryAll}
      >
        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Étudiants filtrés"
            value={String(filteredStudents.length)}
            note={`Sur ${students.length} inscrits`}
          />
          <Metric
            label="Revenus encaissés"
            value={formatMoney(paymentStats.collected, currency)}
            note={`Attendu : ${formatMoney(paymentStats.expected, currency)}`}
          />
          <Metric
            label="Paiements réglés"
            value={String(paymentStats.paidCount)}
            note={`${paymentStats.overdueCount} en retard`}
          />
          <Metric
            label="Tentatives d’examens"
            value={String(filteredAttempts.length)}
            note={hasExamData ? "Soumis ou corrigés" : "Aucune tentative"}
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <Surface className="p-5">
            <h2 className="font-semibold">
              {hasCreatedAt ? "Tendance des inscriptions" : "Répartition par niveau"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasCreatedAt
                ? `Nouveaux étudiants sur ${periodDays} jours`
                : "Effectifs par niveau (dates d’inscription indisponibles)"}
            </p>
            <div className="mt-4 h-52">
              {enrollmentChart.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={enrollmentChart}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={11} />
                    <YAxis allowDecimals={false} width={32} fontSize={11} />
                    <Tooltip formatter={(value: number) => [value, "Étudiants"]} />
                    <Area
                      dataKey="count"
                      type="monotone"
                      stroke="var(--primary)"
                      fill="var(--secondary)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="grid h-full place-items-center text-sm text-muted-foreground">
                  Aucune inscription sur la période.
                </p>
              )}
            </div>
          </Surface>

          <Surface className="p-5">
            <h2 className="font-semibold">Revenus encaissés vs attendus</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Paiements sur la période sélectionnée
            </p>
            <div className="mt-4 h-52">
              {revenueChart.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChart}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={11} />
                    <YAxis hide />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        formatMoney(value, currency),
                        name === "collected" ? "Encaissé" : "Attendu",
                      ]}
                    />
                    <Bar
                      dataKey="expected"
                      fill="var(--muted)"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey="collected"
                      fill="var(--primary)"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="grid h-full place-items-center text-sm text-muted-foreground">
                  Aucun paiement sur la période.
                </p>
              )}
            </div>
          </Surface>

          <Surface className="p-5">
            <h2 className="font-semibold">Paiements réglés vs en retard</h2>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-lg border bg-secondary/40 p-4 text-center">
                <p className="text-3xl font-semibold text-primary">{paymentStats.paidCount}</p>
                <p className="mt-1 text-sm text-muted-foreground">Réglés</p>
              </div>
              <div className="rounded-lg border bg-secondary/40 p-4 text-center">
                <p className="text-3xl font-semibold text-destructive">
                  {paymentStats.overdueCount}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">En retard</p>
              </div>
            </div>
          </Surface>

          <Surface className="p-5">
            <h2 className="font-semibold">Résultats examens A1 vs B1</h2>
            {hasExamData ? (
              <div className="mt-4 space-y-4">
                {examByLevel.map((row) => (
                  <div key={row.level}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{row.level}</span>
                      <strong>{row.average != null ? `${row.average} %` : "—"}</strong>
                    </div>
                    <ProgressLine value={row.average ?? 0} />
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.count} tentative{row.count === 1 ? "" : "s"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">
                Aucune tentative d’examen soumise pour les filtres actuels.
              </p>
            )}
          </Surface>

          <Surface className="p-5 xl:col-span-2">
            <h2 className="font-semibold">Progression moyenne par niveau</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Moyenne des meilleurs scores d’examens par étudiant
            </p>
            <div className="mt-4 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progressionByLevel}>
                  <CartesianGrid vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="level" axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} width={32} fontSize={11} />
                  <Tooltip formatter={(value: number) => [`${value} %`, "Progression moyenne"]} />
                  <Bar
                    dataKey="average"
                    fill="var(--primary)"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Surface>
        </div>

        <Surface className="mt-5 overflow-x-auto p-5">
          <h2 className="font-semibold">Performance par groupe</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Taille, professeur, horaire, progression moyenne et activité
          </p>
          <table className="data-table mt-4">
            <thead>
              <tr>
                <th>Groupe</th>
                <th>Niveau</th>
                <th>Effectif</th>
                <th>Professeur</th>
                <th>Horaire</th>
                <th>Progression moyenne</th>
                <th>Devoirs</th>
                <th>Cours live</th>
              </tr>
            </thead>
            <tbody>
              {groupPerformance.length ? (
                groupPerformance.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium">{row.name}</td>
                    <td>{row.level}</td>
                    <td>{row.size}</td>
                    <td>{row.teacher}</td>
                    <td>{row.schedule}</td>
                    <td>{row.avgProgress != null ? `${row.avgProgress} %` : "—"}</td>
                    <td>{row.assignments}</td>
                    <td>{row.liveSessions}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center text-muted-foreground">
                    Aucun groupe ne correspond aux filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Surface>
      </QueryState>
    </>
  );
}

export function DirectorSettings() {
  const qc = useQueryClient();
  const { user, profile } = useAcademy();
  const mapQuery = useQuery({
    queryKey: queryKeys.branding.settings,
    queryFn: () => SettingsService.getMap(),
  });

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [academyEmail, setAcademyEmail] = useState("");
  const [academyPhone, setAcademyPhone] = useState("");
  const [academyAddress, setAcademyAddress] = useState("");
  const [timezone, setTimezone] = useState("Africa/Casablanca");
  const [currency, setCurrency] = useState("MAD");
  const [defaultCapacity, setDefaultCapacity] = useState("20");
  const [courseDuration, setCourseDuration] = useState("90");
  const [meetingProvider, setMeetingProvider] = useState("jitsi");
  const [defaultPrice, setDefaultPrice] = useState("1200");
  const [paymentDueDay, setPaymentDueDay] = useState("1");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyWhatsapp, setNotifyWhatsapp] = useState(false);
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [defaultLanguage, setDefaultLanguage] = useState("fr");

  useEffect(() => {
    const map = mapQuery.data;
    if (!map) return;
    setName(settingString(map, "academy_name", ""));
    setTagline(settingString(map, "academy_tagline", ""));
    setLogoUrl(settingString(map, "logo_url", ""));
    setAcademyEmail(settingString(map, "support_email", ""));
    setAcademyPhone(settingString(map, "support_phone", ""));
    setAcademyAddress(settingString(map, "academy_address", ""));
    setTimezone(settingString(map, "timezone", "Africa/Casablanca"));
    setCurrency(settingString(map, "currency", "MAD"));
    setDefaultCapacity(settingString(map, "default_class_capacity", "20"));
    setCourseDuration(settingString(map, "default_course_duration_minutes", "90"));
    setMeetingProvider(settingString(map, "default_meeting_provider", "jitsi"));
    setDefaultPrice(settingString(map, "default_payment_amount", "1200"));
    setPaymentDueDay(settingString(map, "payment_due_day", "1"));
    setNotifyEmail(settingString(map, "notifications_email_enabled", "true") === "true");
    setNotifyWhatsapp(settingString(map, "notifications_whatsapp_enabled", "false") === "true");
    setNotifyInApp(settingString(map, "notifications_in_app_enabled", "true") === "true");
    setDefaultLanguage(settingString(map, "default_language", "fr"));
  }, [mapQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      await SettingsService.upsertPublic("academy_name", name);
      await SettingsService.upsertPublic("academy_tagline", tagline);
      await SettingsService.upsertPublic("logo_url", logoUrl || null);
      await SettingsService.upsertPublic("support_email", academyEmail || null);
      await SettingsService.upsertPublic("support_phone", academyPhone || null);
      await SettingsService.upsertPublic("academy_address", academyAddress || null);
      await SettingsService.upsertPublic("timezone", timezone);
      await SettingsService.upsertPublic("currency", currency);
      await SettingsService.upsertPublic("default_class_capacity", defaultCapacity);
      await SettingsService.upsertPublic("default_course_duration_minutes", courseDuration);
      await SettingsService.upsertPublic("default_meeting_provider", meetingProvider);
      await SettingsService.upsertPublic("default_payment_amount", defaultPrice);
      await SettingsService.upsertPublic("payment_due_day", paymentDueDay);
      await SettingsService.upsertPublic(
        "notifications_email_enabled",
        notifyEmail ? "true" : "false",
      );
      await SettingsService.upsertPublic(
        "notifications_whatsapp_enabled",
        notifyWhatsapp ? "true" : "false",
      );
      await SettingsService.upsertPublic(
        "notifications_in_app_enabled",
        notifyInApp ? "true" : "false",
      );
      await SettingsService.upsertPublic("default_language", defaultLanguage);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.branding.settings });
      toast.success("Paramètres enregistrés");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <PageHeader
        title="Paramètres"
        subtitle="Configuration de l’académie, de la pédagogie et des notifications."
      />
      <QueryState
        isLoading={mapQuery.isLoading}
        isError={mapQuery.isError}
        error={mapQuery.error}
        isEmpty={false}
        onRetry={() => void mapQuery.refetch()}
      >
        <Tabs defaultValue="profil" className="space-y-5">
          <TabsList className="flex h-auto flex-wrap gap-1">
            <TabsTrigger value="profil">Profil</TabsTrigger>
            <TabsTrigger value="academie">Académie</TabsTrigger>
            <TabsTrigger value="pedagogie">Pédagogie</TabsTrigger>
            <TabsTrigger value="reunions">Réunions</TabsTrigger>
            <TabsTrigger value="paiements">Paiements</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="apparence">Apparence</TabsTrigger>
            <TabsTrigger value="securite">Sécurité</TabsTrigger>
          </TabsList>

          <TabsContent value="profil">
            <Surface className="space-y-4 p-6">
              <h2 className="font-semibold">Votre profil</h2>
              <label className="block text-sm">
                Nom
                <Input className="mt-1" value={user?.name ?? ""} readOnly />
              </label>
              <label className="block text-sm">
                E-mail
                <Input className="mt-1" value={user?.email ?? ""} readOnly />
              </label>
              <label className="block text-sm">
                Téléphone
                <Input className="mt-1" value={profile?.phone ?? "—"} readOnly />
              </label>
              <p className="text-sm text-muted-foreground">
                Contactez le support pour modifier l’e-mail ou le numéro de téléphone de votre
                compte.
              </p>
            </Surface>
          </TabsContent>

          <TabsContent value="academie">
            <Surface className="space-y-4 p-6">
              <h2 className="font-semibold">Identité du centre</h2>
              <label className="block text-sm">
                Nom public
                <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="block text-sm">
                Slogan
                <Input
                  className="mt-1"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                URL du logo
                <Input
                  className="mt-1"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                E-mail de contact
                <Input
                  className="mt-1"
                  type="email"
                  value={academyEmail}
                  onChange={(e) => setAcademyEmail(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Téléphone
                <Input
                  className="mt-1"
                  value={academyPhone}
                  onChange={(e) => setAcademyPhone(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Adresse
                <Input
                  className="mt-1"
                  value={academyAddress}
                  onChange={(e) => setAcademyAddress(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Fuseau horaire
                <Input
                  className="mt-1"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Devise
                <Input
                  className="mt-1"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                />
              </label>
            </Surface>
          </TabsContent>

          <TabsContent value="pedagogie">
            <Surface className="space-y-4 p-6">
              <h2 className="font-semibold">Pédagogie</h2>
              <label className="block text-sm">
                Capacité par défaut d’un groupe
                <Input
                  className="mt-1"
                  type="number"
                  min={1}
                  value={defaultCapacity}
                  onChange={(e) => setDefaultCapacity(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Durée d’un cours (minutes)
                <Input
                  className="mt-1"
                  type="number"
                  min={15}
                  value={courseDuration}
                  onChange={(e) => setCourseDuration(e.target.value)}
                />
              </label>
            </Surface>
          </TabsContent>

          <TabsContent value="reunions">
            <Surface className="space-y-4 p-6">
              <h2 className="font-semibold">Réunions en ligne</h2>
              <label className="block text-sm">
                Fournisseur par défaut
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={meetingProvider}
                  onChange={(e) => setMeetingProvider(e.target.value)}
                >
                  <option value="jitsi">Jitsi</option>
                  <option value="zoom">Zoom</option>
                </select>
              </label>
              <p className="text-sm text-muted-foreground">
                Ce réglage s’applique aux nouvelles séances planifiées. Zoom peut être activé en
                urgence depuis le calendrier des cours live.
              </p>
            </Surface>
          </TabsContent>

          <TabsContent value="paiements">
            <Surface className="space-y-4 p-6">
              <h2 className="font-semibold">Paiements</h2>
              <label className="block text-sm">
                Montant mensuel par défaut
                <Input
                  className="mt-1"
                  type="number"
                  min={0}
                  value={defaultPrice}
                  onChange={(e) => setDefaultPrice(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Devise
                <Input
                  className="mt-1"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                Jour d’échéance (du mois)
                <Input
                  className="mt-1"
                  type="number"
                  min={1}
                  max={28}
                  value={paymentDueDay}
                  onChange={(e) => setPaymentDueDay(e.target.value)}
                />
              </label>
            </Surface>
          </TabsContent>

          <TabsContent value="notifications">
            <Surface className="space-y-5 p-6">
              <h2 className="font-semibold">Notifications</h2>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">E-mail</p>
                  <p className="text-xs text-muted-foreground">
                    Rappels et confirmations par e-mail
                  </p>
                </div>
                <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">WhatsApp</p>
                  <p className="text-xs text-muted-foreground">
                    Messages WhatsApp si le canal est activé
                  </p>
                </div>
                <Switch checked={notifyWhatsapp} onCheckedChange={setNotifyWhatsapp} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Dans l’application</p>
                  <p className="text-xs text-muted-foreground">
                    Notifications visibles dans l’espace académie
                  </p>
                </div>
                <Switch checked={notifyInApp} onCheckedChange={setNotifyInApp} />
              </div>
            </Surface>
          </TabsContent>

          <TabsContent value="apparence">
            <Surface className="space-y-4 p-6">
              <h2 className="font-semibold">Apparence</h2>
              <label className="block text-sm">
                Langue par défaut
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={defaultLanguage}
                  onChange={(e) => setDefaultLanguage(e.target.value)}
                >
                  <option value="fr">Français</option>
                  <option value="ar">Arabe</option>
                </select>
              </label>
              <p className="text-sm text-muted-foreground">
                Chaque utilisateur peut changer la langue depuis la barre de navigation. La langue
                par défaut s’applique aux nouveaux comptes et aux visiteurs.
              </p>
            </Surface>
          </TabsContent>

          <TabsContent value="securite" className="space-y-5">
            <Surface className="space-y-3 p-6">
              <h2 className="font-semibold">Sécurité du compte</h2>
              <p className="text-sm text-muted-foreground">
                Gérez les actions sensibles liées à votre compte administrateur. La suppression est
                définitive et protégée par une confirmation forte.
              </p>
            </Surface>
            <DangerZoneAccountDeletion />
          </TabsContent>
        </Tabs>

        <div className="mt-4 flex justify-end">
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            Enregistrer les paramètres
          </Button>
        </div>
      </QueryState>
    </>
  );
}

/** Shared settings for student / teacher (account + security). */
export function AccountSettings() {
  const { user, profile } = useAcademy();

  return (
    <>
      <PageHeader title="Paramètres" subtitle="Compte, sécurité et suppression définitive." />
      <Tabs defaultValue="compte" className="space-y-5">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="compte">Compte</TabsTrigger>
          <TabsTrigger value="securite">Sécurité</TabsTrigger>
        </TabsList>

        <TabsContent value="compte">
          <Surface className="space-y-4 p-6">
            <h2 className="font-semibold">Votre compte</h2>
            <label className="block text-sm">
              Nom
              <Input className="mt-1" value={user?.name ?? ""} readOnly />
            </label>
            <label className="block text-sm">
              E-mail
              <Input className="mt-1" value={user?.email ?? ""} readOnly />
            </label>
            <label className="block text-sm">
              Téléphone
              <Input className="mt-1" value={profile?.phone ?? "—"} readOnly />
            </label>
            <p className="text-sm text-muted-foreground">
              Contactez le support pour modifier l’e-mail ou le numéro de téléphone de votre compte.
            </p>
          </Surface>
        </TabsContent>

        <TabsContent value="securite" className="space-y-5">
          <Surface className="space-y-3 p-6">
            <h2 className="font-semibold">Sécurité du compte</h2>
            <p className="text-sm text-muted-foreground">
              Les actions ci-dessous sont définitives. Une confirmation forte est exigée avant toute
              suppression.
            </p>
          </Surface>
          <DangerZoneAccountDeletion />
        </TabsContent>
      </Tabs>
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
      <PageHeader title="Devoirs" subtitle="Suivi des devoirs publiés dans toute l’académie." />
      <Surface className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Devoir</th>
              <th>Étudiant</th>
              <th>Statut</th>
              <th>Note</th>
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

export function RecordingsPage() {
  const { role, user } = useAcademy();
  const isStaff = role === "director" || role === "teacher";
  const classesQuery = useClasses();
  const sessionsQuery = useLiveSessions();
  const recordingsQuery = useRecordings();
  const createFromUrl = useCreateRecordingFromUrl();
  const uploadRecording = useUploadRecording();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [classId, setClassId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"link" | "upload">("link");

  const pastSessions = useMemo(
    () =>
      (sessionsQuery.data ?? []).filter(
        (s) => s.status === "completed" && (!classId || s.class_id === classId),
      ),
    [sessionsQuery.data, classId],
  );

  const openRecording = async (id: string) => {
    const row = (recordingsQuery.data ?? []).find((r) => r.id === id);
    if (!row) return;
    try {
      const url = await RecordingService.getPlayUrl(row);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lecture impossible");
    }
  };

  return (
    <>
      <PageHeader
        title="Rediffusions"
        subtitle="Enregistrements des cours — visibles uniquement pour le groupe concerné."
        action={
          isStaff ? (
            <Button onClick={() => setOpen(true)}>+ Ajouter une rediffusion</Button>
          ) : undefined
        }
      />
      <QueryState
        isLoading={recordingsQuery.isLoading}
        isError={recordingsQuery.isError}
        error={recordingsQuery.error}
        isEmpty={!recordingsQuery.data?.length}
        emptyTitle="Aucune rediffusion"
        emptyMessage={
          isStaff
            ? "Attachez un lien ou un fichier à une séance terminée."
            : "Les rediffusions de votre groupe apparaîtront ici."
        }
        onRetry={() => void recordingsQuery.refetch()}
      >
        <div className="space-y-3">
          {(recordingsQuery.data ?? []).map((row) => (
            <Surface key={row.id} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <h2 className="font-semibold">{row.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {row.external_url ? "Lien externe" : "Fichier uploadé"} ·{" "}
                  {new Date(row.created_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <Button onClick={() => void openRecording(row.id)}>
                {row.external_url ? "Ouvrir" : "Lire / télécharger"}
              </Button>
            </Surface>
          ))}
        </div>
      </QueryState>

      {open && isStaff && (
        <div className="mobile-modal">
          <Surface className="mobile-modal-panel space-y-4">
            <h2 className="text-lg font-semibold">Nouvelle rediffusion</h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={mode === "link" ? "default" : "outline"}
                onClick={() => setMode("link")}
              >
                Lien externe
              </Button>
              <Button
                size="sm"
                variant={mode === "upload" ? "default" : "outline"}
                onClick={() => setMode("upload")}
              >
                Upload
              </Button>
            </div>
            <Input placeholder="Titre" value={title} onChange={(e) => setTitle(e.target.value)} />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setSessionId("");
              }}
            >
              <option value="">Groupe</option>
              {(classesQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.level}
                </option>
              ))}
            </select>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
            >
              <option value="">Séance (optionnel)</option>
              {pastSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} · {new Date(s.starts_at).toLocaleDateString("fr-FR")}
                </option>
              ))}
            </select>
            {mode === "link" ? (
              <Input
                placeholder="https://…"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
              />
            ) : (
              <Input
                type="file"
                accept="video/*,audio/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button
                disabled={
                  !title.trim() ||
                  !classId ||
                  createFromUrl.isPending ||
                  uploadRecording.isPending ||
                  (mode === "link" ? !externalUrl.trim() : !file) ||
                  !user?.id
                }
                onClick={() => {
                  if (mode === "link") {
                    createFromUrl.mutate(
                      {
                        title: title.trim(),
                        externalUrl: externalUrl.trim(),
                        classId,
                        liveSessionId: sessionId || null,
                        createdBy: user?.id ?? null,
                      },
                      {
                        onSuccess: () => {
                          toast.success("Rediffusion ajoutée");
                          setOpen(false);
                          setTitle("");
                          setExternalUrl("");
                          setSessionId("");
                        },
                        onError: (err) => toast.error(err.message),
                      },
                    );
                    return;
                  }
                  if (!file || !user?.id) return;
                  uploadRecording.mutate(
                    {
                      title: title.trim(),
                      file,
                      classId,
                      liveSessionId: sessionId || null,
                      createdBy: user.id,
                    },
                    {
                      onSuccess: () => {
                        toast.success("Rediffusion uploadée");
                        setOpen(false);
                        setTitle("");
                        setFile(null);
                        setSessionId("");
                      },
                      onError: (err) => toast.error(err.message),
                    },
                  );
                }}
              >
                Enregistrer
              </Button>
            </div>
          </Surface>
        </div>
      )}
    </>
  );
}
