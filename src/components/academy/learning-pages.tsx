import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useAssignments,
  useClasses,
  useClassRoster,
  useCourseModules,
  useCourses,
  useCreateAssignment,
  useCreateCourse,
  useCreateLesson,
  useLessons,
  useLevels,
  useLibrary,
  usePublishLesson,
  useSaveAttendance,
  useUploadLibraryItem,
} from "@/hooks/use-academy-data";
import { LibraryService } from "@/services/academy-services";
import { useAcademy } from "./academy-context";
import { QueryState } from "./query-state";
import { PageHeader, Status, Surface } from "./primitives";

export function DirectorCoursesPage() {
  const coursesQuery = useCourses();
  const levelsQuery = useLevels();
  const createCourse = useCreateCourse();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [levelId, setLevelId] = useState("");

  return (
    <>
      <PageHeader
        title="Course Management"
        subtitle="Curriculum structure across A1–B2 from Supabase."
        action={<Button onClick={() => setOpen(true)}>+ Create course</Button>}
      />
      <QueryState
        isLoading={coursesQuery.isLoading}
        isError={coursesQuery.isError}
        error={coursesQuery.error}
        isEmpty={!coursesQuery.data?.length}
        emptyTitle="No courses yet"
        emptyMessage="Create the first course for a CEFR level."
        onRetry={() => void coursesQuery.refetch()}
      >
        <div className="space-y-3">
          {coursesQuery.data?.map((course) => {
            const moduleCount = (course.modules ?? []).length;
            const lessonCount = (course.modules ?? []).reduce(
              (acc, mod) =>
                acc +
                (mod.units ?? []).reduce((uAcc, unit) => uAcc + (unit.lessons ?? []).length, 0),
              0,
            );
            return (
              <Surface className="p-5" key={course.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {course.level?.code ?? "—"}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">{course.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {moduleCount} modules · {lessonCount} lessons · status {course.status}
                    </p>
                  </div>
                  <Status tone={course.status === "published" ? "green" : "amber"}>
                    {course.status}
                  </Status>
                </div>
              </Surface>
            );
          })}
        </div>
      </QueryState>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
          <Surface className="w-full max-w-lg space-y-4 p-6">
            <h2 className="text-lg font-semibold">Create course</h2>
            <Input
              placeholder="Course title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={levelId}
              onChange={(e) => setLevelId(e.target.value)}
            >
              <option value="">Select level</option>
              {(levelsQuery.data ?? []).map((level) => (
                <option key={level.id} value={level.id}>
                  {level.code} · {level.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!title.trim() || !levelId || createCourse.isPending}
                onClick={() => {
                  createCourse.mutate(
                    { title: title.trim(), levelId },
                    {
                      onSuccess: () => {
                        toast.success("Course created");
                        setOpen(false);
                        setTitle("");
                        setLevelId("");
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

export function TeacherLessonManagerPage() {
  const lessonsQuery = useLessons();
  const coursesQuery = useCourses();
  const createLesson = useCreateLesson();
  const publishLesson = usePublishLesson();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [courseId, setCourseId] = useState("");

  return (
    <>
      <PageHeader
        title="Lesson Manager"
        subtitle="Create and publish lessons stored in Supabase."
        action={<Button onClick={() => setOpen(true)}>+ Create lesson</Button>}
      />
      <QueryState
        isLoading={lessonsQuery.isLoading}
        isError={lessonsQuery.isError}
        error={lessonsQuery.error}
        isEmpty={!lessonsQuery.data?.length}
        emptyTitle="No lessons"
        emptyMessage="Create a lesson linked to a course unit."
        onRetry={() => void lessonsQuery.refetch()}
      >
        <div className="space-y-3">
          {lessonsQuery.data?.map((lesson) => (
            <Surface
              className="flex flex-wrap items-center justify-between gap-3 p-4"
              key={lesson.id}
            >
              <div>
                <h2 className="font-semibold">{lesson.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {lesson.description ?? "No description"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Status tone={lesson.status === "published" ? "green" : "amber"}>
                  {lesson.status}
                </Status>
                {lesson.status !== "published" && (
                  <Button
                    size="sm"
                    disabled={publishLesson.isPending}
                    onClick={() =>
                      publishLesson.mutate(lesson.id, {
                        onSuccess: () => toast.success("Lesson published"),
                        onError: (err) => toast.error(err.message),
                      })
                    }
                  >
                    Publish
                  </Button>
                )}
              </div>
            </Surface>
          ))}
        </div>
      </QueryState>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4">
          <Surface className="w-full max-w-lg space-y-4 p-6">
            <h2 className="text-lg font-semibold">Create lesson</h2>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">Select course</option>
              {(coursesQuery.data ?? []).map((course) => (
                <option key={course.id} value={course.id}>
                  {course.level?.code} · {course.title}
                </option>
              ))}
            </select>
            <Input
              placeholder="Lesson title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Markdown content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!title.trim() || !courseId || createLesson.isPending}
                onClick={() => {
                  createLesson.mutate(
                    {
                      courseId,
                      title: title.trim(),
                      ...(content.trim() ? { contentMarkdown: content.trim() } : {}),
                    },
                    {
                      onSuccess: () => {
                        toast.success("Lesson created as draft");
                        setOpen(false);
                        setTitle("");
                        setContent("");
                        setCourseId("");
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

export function MaterialsLibraryPage() {
  const libraryQuery = useLibrary();
  const upload = useUploadLibraryItem();
  const levelsQuery = useLevels();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [levelCode, setLevelCode] = useState("");

  return (
    <>
      <PageHeader title="Materials" subtitle="Private library files via Supabase Storage." />
      <Surface className="mb-5 space-y-3 p-5">
        <h2 className="text-sm font-semibold">Upload material</h2>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={levelCode}
          onChange={(e) => setLevelCode(e.target.value)}
        >
          <option value="">Level (optional)</option>
          {(levelsQuery.data ?? []).map((level) => (
            <option key={level.id} value={level.code}>
              {level.code}
            </option>
          ))}
        </select>
        <Input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          accept=".pdf,.mp3,.mp4,.png,.jpg,.jpeg,.zip"
        />
        <Button
          disabled={!file || !title.trim() || upload.isPending}
          onClick={() => {
            if (!file) return;
            const category = file.type.includes("audio")
              ? ("audio" as const)
              : file.type.includes("video")
                ? ("video" as const)
                : file.type.includes("pdf")
                  ? ("pdf" as const)
                  : ("course_material" as const);
            upload.mutate(
              {
                file,
                title: title.trim(),
                levelCode: levelCode || null,
                category,
              },
              {
                onSuccess: () => {
                  toast.success("Material uploaded");
                  setFile(null);
                  setTitle("");
                },
                onError: (err) => toast.error(err.message),
              },
            );
          }}
        >
          Upload to library
        </Button>
      </Surface>

      <QueryState
        isLoading={libraryQuery.isLoading}
        isError={libraryQuery.isError}
        error={libraryQuery.error}
        isEmpty={!libraryQuery.data?.length}
        emptyTitle="Library is empty"
        emptyMessage="Upload a PDF, audio or video to get started."
        onRetry={() => void libraryQuery.refetch()}
      >
        <div className="space-y-3">
          {libraryQuery.data?.map((item) => (
            <Surface
              className="flex flex-wrap items-center justify-between gap-3 p-4"
              key={item.id}
            >
              <div>
                <h2 className="font-semibold">{item.title}</h2>
                <p className="text-sm text-muted-foreground">
                  {item.level} · {item.type} · {item.size}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void (async () => {
                    try {
                      if (!item.storage_path) {
                        toast.error("File path missing");
                        return;
                      }
                      const url = await LibraryService.getSignedUrl({
                        storage_bucket: item.storage_bucket ?? "library",
                        storage_path: item.storage_path,
                      });
                      window.open(url, "_blank", "noopener,noreferrer");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Open failed");
                    }
                  })();
                }}
              >
                Open
              </Button>
            </Surface>
          ))}
        </div>
      </QueryState>
    </>
  );
}

export function TeacherAttendancePage() {
  const classesQuery = useClasses();
  const primaryClass = classesQuery.data?.[0];
  const rosterQuery = useClassRoster(primaryClass?.id);
  const saveAttendance = useSaveAttendance();
  const [marks, setMarks] = useState<Record<string, "present" | "absent" | "late" | "excused">>({});

  const roster = rosterQuery.data ?? [];
  const counts = useMemo(() => {
    const values = roster.map((s) => marks[s.id] ?? "present");
    return {
      present: values.filter((v) => v === "present").length,
      late: values.filter((v) => v === "late").length,
      absent: values.filter((v) => v === "absent").length,
    };
  }, [marks, roster]);

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle={primaryClass ? `${primaryClass.name} · Today` : "Select a class"}
        action={
          <Button
            disabled={!primaryClass || saveAttendance.isPending || roster.length === 0}
            onClick={() => {
              if (!primaryClass) return;
              saveAttendance.mutate(
                {
                  classId: primaryClass.id,
                  records: roster.map((student) => ({
                    studentId: student.id,
                    mark: marks[student.id] ?? "present",
                  })),
                },
                {
                  onSuccess: () => toast.success("Attendance saved to database"),
                  onError: (err) => toast.error(err.message),
                },
              );
            }}
          >
            Save attendance
          </Button>
        }
      />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Surface className="p-4 text-sm">
          Present <strong className="ml-2 text-lg">{counts.present}</strong>
        </Surface>
        <Surface className="p-4 text-sm">
          Late <strong className="ml-2 text-lg">{counts.late}</strong>
        </Surface>
        <Surface className="p-4 text-sm">
          Absent <strong className="ml-2 text-lg">{counts.absent}</strong>
        </Surface>
      </div>
      <QueryState
        isLoading={classesQuery.isLoading || rosterQuery.isLoading}
        isError={classesQuery.isError || rosterQuery.isError}
        error={(classesQuery.error ?? rosterQuery.error) as Error | null}
        isEmpty={roster.length === 0}
        emptyTitle="No enrolled students"
        emptyMessage="Enroll students in this class before taking attendance."
      >
        <Surface className="divide-y">
          {roster.map((student) => (
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center" key={student.id}>
              <span className="flex-1 font-medium">{student.name}</span>
              <div className="flex flex-wrap gap-2">
                {(["present", "absent", "late", "excused"] as const).map((item) => (
                  <Button
                    key={item}
                    size="sm"
                    variant={(marks[student.id] ?? "present") === item ? "default" : "outline"}
                    onClick={() => setMarks({ ...marks, [student.id]: item })}
                  >
                    {item}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </Surface>
      </QueryState>
    </>
  );
}

export function StudentLearningPage() {
  const { navigate } = useAcademy();
  const modulesQuery = useCourseModules();
  return (
    <>
      <PageHeader title="My Courses" subtitle="Published curriculum from your academy." />
      <QueryState
        isLoading={modulesQuery.isLoading}
        isError={modulesQuery.isError}
        error={modulesQuery.error}
        isEmpty={!modulesQuery.data?.length}
        emptyTitle="No published modules"
        emptyMessage="Courses appear here once staff publishes curriculum."
        onRetry={() => void modulesQuery.refetch()}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {modulesQuery.data?.map((module) => (
            <Surface key={module.id} className="p-5">
              <p className="text-xs font-medium text-muted-foreground uppercase">{module.level}</p>
              <h2 className="mt-2 text-lg font-semibold">{module.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {module.courseTitle} · {module.lessons} lessons
              </p>
              <Button className="mt-4" variant="outline" onClick={() => navigate("lesson")}>
                Open lessons
              </Button>
            </Surface>
          ))}
        </div>
      </QueryState>
    </>
  );
}

export function TeacherAssignmentsPage() {
  const classesQuery = useClasses();
  const create = useCreateAssignment();
  const [title, setTitle] = useState("");
  const [classId, setClassId] = useState("");
  const effectiveClassId = classId || classesQuery.data?.[0]?.id;
  const listQuery = useAssignments(effectiveClassId);

  return (
    <>
      <PageHeader title="Assignments" subtitle="Publish real class assignments to Supabase." />
      <Surface className="mb-5 space-y-3 p-5">
        <Input
          placeholder="Assignment title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          <option value="">Select class</option>
          {(classesQuery.data ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <Button
          disabled={!title.trim() || !classId || create.isPending}
          onClick={() => {
            create.mutate(
              { classId, title: title.trim(), status: "published" },
              {
                onSuccess: () => {
                  toast.success("Assignment published");
                  setTitle("");
                  void listQuery.refetch();
                },
                onError: (err) => toast.error(err.message),
              },
            );
          }}
        >
          Create & publish
        </Button>
      </Surface>
      <QueryState
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        error={listQuery.error}
        isEmpty={!listQuery.data?.length}
        emptyTitle="No assignments"
        emptyMessage="Create an assignment for a class."
        onRetry={() => void listQuery.refetch()}
      >
        <div className="space-y-3">
          {listQuery.data?.map((item) => (
            <Surface className="p-4" key={item.id}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{item.title}</h2>
                  <p className="text-sm text-muted-foreground">Due {item.due}</p>
                </div>
                <Status>{item.status}</Status>
              </div>
            </Surface>
          ))}
        </div>
      </QueryState>
    </>
  );
}

export function DirectorAssignmentsPage() {
  const listQuery = useAssignments();
  return (
    <>
      <PageHeader title="Assignments" subtitle="Academy-wide homework pipeline." />
      <QueryState
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        error={listQuery.error}
        isEmpty={!listQuery.data?.length}
        emptyTitle="No assignments"
        emptyMessage="Teachers publish assignments from their class workspace."
        onRetry={() => void listQuery.refetch()}
      >
        <Surface className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.data?.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium">{row.title}</td>
                  <td>{row.due}</td>
                  <td>
                    <Status>{row.status}</Status>
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

export function StudentAssignmentsPage({ detail }: { detail: boolean }) {
  const { navigate } = useAcademy();
  const listQuery = useAssignments();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = listQuery.data?.find((a) => a.id === selectedId) ?? listQuery.data?.[0];

  if (detail && selected) {
    return (
      <>
        <button
          type="button"
          onClick={() => navigate("assignments")}
          className="mb-5 text-sm text-muted-foreground"
        >
          ← Assignments
        </button>
        <PageHeader title={selected.title} subtitle={`Due ${selected.due}`} />
        <Surface className="p-6">
          <p className="text-sm leading-7 text-muted-foreground">
            {selected.description || "Follow your teacher’s instructions and submit your work."}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            File submission UI will upload to Storage in the next wave. Status: {selected.status}
          </p>
        </Surface>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Assignments" subtitle="Homework assigned to your classes." />
      <QueryState
        isLoading={listQuery.isLoading}
        isError={listQuery.isError}
        error={listQuery.error}
        isEmpty={!listQuery.data?.length}
        emptyTitle="No assignments yet"
        emptyMessage="When your teacher publishes homework, it will appear here."
        onRetry={() => void listQuery.refetch()}
      >
        <div className="space-y-3">
          {listQuery.data?.map((row) => (
            <Surface
              key={row.id}
              className="flex cursor-pointer items-center justify-between gap-3 p-4"
              onClick={() => {
                setSelectedId(row.id);
                navigate("assignment-detail");
              }}
            >
              <div>
                <h2 className="font-semibold">{row.title}</h2>
                <p className="text-sm text-muted-foreground">Due {row.due}</p>
              </div>
              <Status>{row.status}</Status>
            </Surface>
          ))}
        </div>
      </QueryState>
    </>
  );
}
