import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { useClasses, useStudents, useTeachers } from "@/hooks/use-academy-data";
import { initials } from "@/lib/academy-logic";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Level } from "@/types/academy";
import { QueryState } from "./query-state";
import { Status, Surface } from "./primitives";

export type PeoplePickerPurpose = "enrollment" | "messaging" | "generic";
export type PeoplePickerRole = "student" | "teacher" | "admin";

export interface PeoplePickerProps {
  purpose: PeoplePickerPurpose;
  /** Which role filters to show. Defaults from `purpose`. */
  modes?: PeoplePickerRole[];
  /** Profile IDs (messaging) or student IDs (enrollment), per `excludeKind`. */
  excludeIds?: string[];
  /** How to interpret `excludeIds`. Defaults from `purpose`. */
  excludeKind?: "profile" | "student";
  /** Receives studentId for enrollment, profileId for messaging/generic. */
  onSelect: (id: string) => void;
  selectedId?: string;
  className?: string;
}

type PersonRow = {
  key: string;
  selectId: string;
  profileId: string;
  firstName: string;
  lastName: string;
  role: PeoplePickerRole;
  level?: string | undefined;
  className?: string | undefined;
};

const LEVELS: Level[] = ["A1", "A2", "B1", "B2"];

const ROLE_LABELS: Record<PeoplePickerRole, string> = {
  student: "Étudiant",
  teacher: "Professeur",
  admin: "Admin",
};

const ROLE_TONE: Record<PeoplePickerRole, "blue" | "amber" | "gray"> = {
  student: "blue",
  teacher: "amber",
  admin: "gray",
};

function defaultModes(purpose: PeoplePickerPurpose): PeoplePickerRole[] {
  if (purpose === "enrollment") return ["student"];
  return ["student", "teacher", "admin"];
}

function defaultExcludeKind(purpose: PeoplePickerPurpose): "profile" | "student" {
  return purpose === "enrollment" ? "student" : "profile";
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function matchesName(firstName: string, lastName: string, query: string) {
  if (!query) return true;
  const haystack = normalizeSearch(`${firstName} ${lastName} ${lastName} ${firstName}`);
  return haystack.includes(query);
}

function PersonOption({
  person,
  selected,
  onSelect,
}: {
  person: PersonRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const displayName = `${person.lastName} ${person.firstName}`.trim();
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
        selected ? "bg-secondary ring-1 ring-primary/30" : "hover:bg-muted"
      }`}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium text-primary">
        {initials(displayName || "?")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{displayName || "—"}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {[person.level, person.className && person.className !== "—" ? person.className : null]
            .filter(Boolean)
            .join(" · ") || "—"}
        </span>
      </span>
      <Status tone={ROLE_TONE[person.role]}>{ROLE_LABELS[person.role]}</Status>
    </button>
  );
}

export function PeoplePicker({
  purpose,
  modes,
  excludeIds = [],
  excludeKind,
  onSelect,
  selectedId,
  className = "",
}: PeoplePickerProps) {
  const roleModes = modes ?? defaultModes(purpose);
  const idKind = excludeKind ?? defaultExcludeKind(purpose);
  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);

  const [roleFilter, setRoleFilter] = useState<PeoplePickerRole>(roleModes[0] ?? "student");
  const [levelFilter, setLevelFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const studentsQuery = useStudents();
  const teachersQuery = useTeachers();
  const classesQuery = useClasses();

  const adminsQuery = useQuery({
    queryKey: ["profiles", "admins"] as const,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from("profiles")
        .select("id, first_name, last_name, email, role, status")
        .eq("role", "admin")
        .neq("status", "archived")
        .order("last_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: roleFilter === "admin" && isSupabaseConfigured,
  });

  useEffect(() => {
    if (!roleModes.includes(roleFilter)) {
      setRoleFilter(roleModes[0] ?? "student");
    }
  }, [roleFilter, roleModes]);

  useEffect(() => {
    setLevelFilter("");
    setClassFilter("");
    setSearchQuery("");
  }, [roleFilter]);

  const classOptions = useMemo(() => {
    const rows = classesQuery.data ?? [];
    if (!levelFilter) return rows;
    return rows.filter((item) => item.level === levelFilter);
  }, [classesQuery.data, levelFilter]);

  const selectedClassName = useMemo(() => {
    if (!classFilter) return "";
    return classesQuery.data?.find((item) => item.id === classFilter)?.name ?? "";
  }, [classFilter, classesQuery.data]);

  const normalizedQuery = normalizeSearch(searchQuery);

  const results = useMemo((): PersonRow[] => {
    if (roleFilter === "student") {
      return (studentsQuery.data ?? [])
        .filter((student) => {
          if (levelFilter && student.level !== levelFilter) return false;
          if (classFilter && student.classId !== classFilter) return false;
          if (idKind === "student" && excludeSet.has(student.id)) return false;
          if (idKind === "profile" && excludeSet.has(student.profileId)) return false;
          return matchesName(student.firstName, student.lastName, normalizedQuery);
        })
        .map((student) => ({
          key: student.id,
          selectId: purpose === "enrollment" ? student.id : student.profileId,
          profileId: student.profileId,
          firstName: student.firstName,
          lastName: student.lastName,
          role: "student" as const,
          level: student.level,
          className: student.className,
        }))
        .slice(0, 30);
    }

    if (roleFilter === "teacher") {
      return (teachersQuery.data ?? [])
        .filter((teacher) => {
          if (levelFilter && !teacher.levels.includes(levelFilter)) return false;
          if (classFilter && selectedClassName && !teacher.classes.includes(selectedClassName)) {
            return false;
          }
          if (excludeSet.has(teacher.profileId)) return false;
          return matchesName(teacher.firstName, teacher.lastName, normalizedQuery);
        })
        .map((teacher) => ({
          key: teacher.id,
          selectId: teacher.profileId,
          profileId: teacher.profileId,
          firstName: teacher.firstName,
          lastName: teacher.lastName,
          role: "teacher" as const,
          level: teacher.levels.join(", ") || undefined,
          className: teacher.classes.slice(0, 2).join(", ") || undefined,
        }))
        .slice(0, 30);
    }

    return (adminsQuery.data ?? [])
      .filter((admin) => {
        if (excludeSet.has(admin.id)) return false;
        return matchesName(admin.first_name ?? "", admin.last_name ?? "", normalizedQuery);
      })
      .map((admin) => ({
        key: admin.id,
        selectId: admin.id,
        profileId: admin.id,
        firstName: admin.first_name ?? "",
        lastName: admin.last_name ?? "",
        role: "admin" as const,
      }))
      .slice(0, 30);
  }, [
    roleFilter,
    studentsQuery.data,
    teachersQuery.data,
    adminsQuery.data,
    levelFilter,
    classFilter,
    selectedClassName,
    normalizedQuery,
    excludeSet,
    idKind,
    purpose,
  ]);

  const isLoading =
    (roleFilter === "student" && studentsQuery.isLoading) ||
    (roleFilter === "teacher" && teachersQuery.isLoading) ||
    (roleFilter === "admin" && adminsQuery.isLoading);

  const isError =
    (roleFilter === "student" && studentsQuery.isError) ||
    (roleFilter === "teacher" && teachersQuery.isError) ||
    (roleFilter === "admin" && adminsQuery.isError);

  const error = studentsQuery.error ?? teachersQuery.error ?? adminsQuery.error ?? null;

  const showLevelFilter = roleFilter === "student" || roleFilter === "teacher";
  const showClassFilter = roleFilter === "student" || roleFilter === "teacher";
  const showRoleFilter = roleModes.length > 1;

  return (
    <div className={`space-y-3 ${className}`}>
      {showRoleFilter && (
        <div className="flex flex-wrap gap-2">
          {roleModes.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setRoleFilter(mode)}
              className={`rounded-md border px-3 py-1.5 text-sm transition ${
                roleFilter === mode
                  ? "border-primary bg-secondary text-primary"
                  : "border-input bg-background hover:bg-muted"
              }`}
            >
              {ROLE_LABELS[mode]}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {showLevelFilter && (
          <label className="block text-sm">
            Niveau
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={levelFilter}
              onChange={(e) => {
                setLevelFilter(e.target.value);
                setClassFilter("");
              }}
            >
              <option value="">Tous les niveaux</option>
              {LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
        )}

        {showClassFilter && (
          <label className="block text-sm">
            Groupe
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              disabled={classesQuery.isLoading}
            >
              <option value="">Tous les groupes</option>
              {classOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <label className="block text-sm">
        {roleFilter === "student" ? "Rechercher par nom ou prénom" : "Rechercher par nom"}
        <div className="relative mt-1">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={
              roleFilter === "student"
                ? "Nom, prénom…"
                : roleFilter === "teacher"
                  ? "Nom du professeur…"
                  : "Nom de l’administrateur…"
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
      </label>

      <QueryState isLoading={isLoading} isError={isError} error={error}>
        <Surface className="max-h-56 overflow-y-auto p-1">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {normalizedQuery || levelFilter || classFilter
                ? "Aucune personne ne correspond à votre recherche."
                : "Saisissez un nom ou affinez les filtres."}
            </p>
          ) : (
            <div className="space-y-0.5">
              {results.map((person) => (
                <PersonOption
                  key={person.key}
                  person={person}
                  selected={selectedId === person.selectId}
                  onSelect={() => onSelect(person.selectId)}
                />
              ))}
            </div>
          )}
        </Surface>
      </QueryState>
    </div>
  );
}
