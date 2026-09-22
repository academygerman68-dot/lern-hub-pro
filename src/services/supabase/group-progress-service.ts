import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  flattenOrderedUnits,
  mergeUnitProgress,
  nextUnitToUnlock,
  type UnitProgressView,
} from "@/lib/group-progress";
import { SupabaseCurriculumService } from "@/services/supabase/curriculum-service";

function requireClient() {
  if (!isSupabaseConfigured) throw new Error("SUPABASE_NOT_CONFIGURED");
  return getSupabase();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function progressTable(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (requireClient() as any).from("class_curriculum_progress");
}

export const SupabaseGroupProgressService = {
  async listForClass(classId: string, levelCode?: string | null): Promise<UnitProgressView[]> {
    const courses = await SupabaseCurriculumService.listCourses();
    const ordered = flattenOrderedUnits(courses, levelCode ?? null);
    const { data, error } = await progressTable()
      .select("unit_id, status, completed_at, unlocked_at")
      .eq("class_id", classId);
    if (error) throw error;

    const views = mergeUnitProgress(ordered, data ?? []);
    // Persist default unlock of first chapter when missing.
    const first = views[0];
    if (first && first.status === "unlocked") {
      const existing = (data ?? []).some(
        (row: { unit_id: string }) => row.unit_id === first.unitId,
      );
      if (!existing) {
        await progressTable().upsert(
          {
            class_id: classId,
            unit_id: first.unitId,
            status: "unlocked",
            unlocked_at: new Date().toISOString(),
          },
          { onConflict: "class_id,unit_id" },
        );
      }
    }
    return views;
  },

  async markCompleted(input: {
    classId: string;
    unitId: string;
    updatedBy?: string | null;
    levelCode?: string | null;
  }) {
    const views = await this.listForClass(input.classId, input.levelCode);
    const current = views.find((row) => row.unitId === input.unitId);
    if (!current) throw new Error("Chapitre introuvable pour ce parcours.");
    if (current.status === "locked") {
      throw new Error("Ce chapitre est encore verrouillé pour le groupe.");
    }

    const now = new Date().toISOString();
    const { error } = await progressTable().upsert(
      {
        class_id: input.classId,
        unit_id: input.unitId,
        status: "completed",
        completed_at: now,
        unlocked_at: current.unlockedAt ?? now,
        updated_by: input.updatedBy ?? null,
      },
      { onConflict: "class_id,unit_id" },
    );
    if (error) throw error;

    const nextId = nextUnitToUnlock(
      views.map((row) =>
        row.unitId === input.unitId ? { ...row, status: "completed" as const } : row,
      ),
      input.unitId,
    );
    if (nextId) {
      const { error: unlockError } = await progressTable().upsert(
        {
          class_id: input.classId,
          unit_id: nextId,
          status: "unlocked",
          unlocked_at: now,
          updated_by: input.updatedBy ?? null,
        },
        { onConflict: "class_id,unit_id" },
      );
      if (unlockError) throw unlockError;
    }

    return this.listForClass(input.classId, input.levelCode);
  },

  async unlockUnit(input: {
    classId: string;
    unitId: string;
    updatedBy?: string | null;
    levelCode?: string | null;
  }) {
    const now = new Date().toISOString();
    const { error } = await progressTable().upsert(
      {
        class_id: input.classId,
        unit_id: input.unitId,
        status: "unlocked",
        unlocked_at: now,
        updated_by: input.updatedBy ?? null,
      },
      { onConflict: "class_id,unit_id" },
    );
    if (error) throw error;
    return this.listForClass(input.classId, input.levelCode);
  },
};
