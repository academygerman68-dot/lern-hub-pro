export type GroupUnitProgressStatus = "locked" | "unlocked" | "completed";

export type OrderedUnit = {
  unitId: string;
  title: string;
  moduleTitle: string;
  courseTitle: string;
  levelCode: string | null;
  sortKey: string;
};

export type UnitProgressView = OrderedUnit & {
  status: GroupUnitProgressStatus;
  completedAt: string | null;
  unlockedAt: string | null;
};

/** Flatten course tree into level-scoped ordered chapters (units). */
export function flattenOrderedUnits(
  courses: Array<{
    title: string;
    status?: string | null;
    level?: { code?: string | null } | null;
    modules?: Array<{
      title: string;
      status?: string | null;
      sort_order?: number | null;
      units?: Array<{
        id: string;
        title: string;
        status?: string | null;
        sort_order?: number | null;
      }>;
    }>;
  }>,
  levelCode?: string | null,
): OrderedUnit[] {
  const rows: OrderedUnit[] = [];
  const filtered = courses.filter((c) => {
    if (c.status === "archived") return false;
    if (levelCode && c.level?.code && c.level.code !== levelCode) return false;
    return true;
  });

  for (const course of filtered) {
    const modules = [...(course.modules ?? [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
    for (const mod of modules) {
      if (mod.status === "archived") continue;
      const units = [...(mod.units ?? [])].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
      );
      for (const unit of units) {
        if (unit.status === "archived") continue;
        rows.push({
          unitId: unit.id,
          title: unit.title,
          moduleTitle: mod.title,
          courseTitle: course.title,
          levelCode: course.level?.code ?? null,
          sortKey: `${course.title}:${mod.sort_order ?? 0}:${unit.sort_order ?? 0}:${unit.id}`,
        });
      }
    }
  }
  return rows;
}

export function mergeUnitProgress(
  units: OrderedUnit[],
  progressRows: Array<{
    unit_id: string;
    status: string;
    completed_at?: string | null;
    unlocked_at?: string | null;
  }>,
): UnitProgressView[] {
  const byId = new Map(progressRows.map((row) => [row.unit_id, row]));
  return units.map((unit, index) => {
    const row = byId.get(unit.unitId);
    let status: GroupUnitProgressStatus = "locked";
    if (row?.status === "completed") status = "completed";
    else if (row?.status === "unlocked") status = "unlocked";
    else if (index === 0 && !row) status = "unlocked"; // first chapter open by default
    return {
      ...unit,
      status,
      completedAt: row?.completed_at ?? null,
      unlockedAt: row?.unlocked_at ?? null,
    };
  });
}

/** After completing `unitId`, unlock the next locked unit (if any). */
export function nextUnitToUnlock(
  views: UnitProgressView[],
  completedUnitId: string,
): string | null {
  const index = views.findIndex((row) => row.unitId === completedUnitId);
  if (index < 0) return null;
  for (let i = index + 1; i < views.length; i += 1) {
    if (views[i]!.status === "locked") return views[i]!.unitId;
  }
  return null;
}

export function studentVisibleUnits(views: UnitProgressView[]): UnitProgressView[] {
  return views.filter((row) => row.status === "unlocked" || row.status === "completed");
}

export function groupProgressSummary(views: UnitProgressView[]) {
  const total = views.length;
  const completed = views.filter((row) => row.status === "completed").length;
  const unlocked = views.filter((row) => row.status === "unlocked").length;
  return {
    total,
    completed,
    unlocked,
    locked: Math.max(0, total - completed - unlocked),
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}
