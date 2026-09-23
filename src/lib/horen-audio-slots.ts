import type { Json } from "@/types/database";

type AudioQuestion = {
  skill?: string | null;
  type?: string | null;
  media_path?: string | null;
  media_bucket?: string | null;
  metadata?: Record<string, unknown> | Json | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function needsHoren(skill: string | null | undefined, type: string | null | undefined): boolean {
  return skill === "hoeren" || type === "listening";
}

function hasAudio(input: AudioQuestion): boolean {
  const path = input.media_path?.trim();
  const bucket = input.media_bucket?.trim();
  if (path && bucket) return true;
  const meta = asRecord(input.metadata);
  const url = meta?.["audio_url"];
  return typeof url === "string" && url.trim().length > 0;
}

/**
 * Count Hören audio by distinct Teil slots (1–4) when audio_slot/teil metadata exists.
 * Classic A1 (no slots) keeps per-question counting.
 */
export function countHorenAudioReady(questions: AudioQuestion[]): {
  ready: number;
  total: number;
  mode: "slots" | "per_question";
} {
  const slots = new Map<number, boolean>();
  let perReady = 0;
  let perTotal = 0;

  for (const q of questions) {
    if (!needsHoren(q.skill, q.type)) continue;
    const meta = asRecord(q.metadata);
    const slot = Number(meta?.["audio_slot"] ?? meta?.["teil"]);
    if (Number.isFinite(slot) && slot >= 1 && slot <= 4) {
      const prev = slots.get(slot) === true;
      slots.set(slot, prev || hasAudio(q));
    } else {
      perTotal += 1;
      if (hasAudio(q)) perReady += 1;
    }
  }

  if (slots.size > 0) {
    const ready = [1, 2, 3, 4].filter((s) => slots.get(s) === true).length;
    return { ready, total: 4, mode: "slots" };
  }
  return { ready: perReady, total: perTotal, mode: "per_question" };
}

/** Distinct Hören slots with content_verified (out of 4 when slot mode). */
export function countHorenAudioVerifiedSlots(questions: AudioQuestion[]): number {
  const bySlot = new Map<number, boolean>();
  for (const q of questions) {
    if (!needsHoren(q.skill, q.type)) continue;
    const meta = asRecord(q.metadata);
    const slot = Number(meta?.["audio_slot"] ?? meta?.["teil"]);
    if (!Number.isFinite(slot) || slot < 1 || slot > 4) continue;
    if (meta?.["audio_verification_status"] === "content_verified") {
      bySlot.set(slot, true);
    } else if (!bySlot.has(slot)) {
      bySlot.set(slot, false);
    }
  }
  return [1, 2, 3, 4].filter((s) => bySlot.get(s) === true).length;
}

/**
 * Authority for student playback remains question media_path / signed URL via getExam.
 * exam_audio_tracks is an admin inventory mirror — detect divergence only.
 */
export function detectHorenTrackInventoryDivergence(input: {
  questionPathsBySlot: Record<number, string | null | undefined>;
  inventoryPathsBySlot: Record<number, string | null | undefined>;
}): string[] {
  const issues: string[] = [];
  for (const slot of [1, 2, 3, 4]) {
    const q = input.questionPathsBySlot[slot]?.trim() || null;
    const inv = input.inventoryPathsBySlot[slot]?.trim() || null;
    if (q && inv && q !== inv) {
      issues.push(`Teil ${slot}: inventory path diverges from question media_path`);
    }
    if (q && !inv) {
      issues.push(`Teil ${slot}: question media present but inventory row missing`);
    }
    if (!q && inv) {
      issues.push(`Teil ${slot}: inventory row without question media_path`);
    }
  }
  return issues;
}

export function listHorenAudioSlots(questions: AudioQuestion[]): Array<{
  part: number;
  hasAudio: boolean;
  verificationStatus: string | null;
  mediaPath: string | null;
  note: string | null;
}> {
  const bySlot = new Map<
    number,
    {
      hasAudio: boolean;
      verificationStatus: string | null;
      mediaPath: string | null;
      note: string | null;
    }
  >();
  for (const q of questions) {
    if (!needsHoren(q.skill, q.type)) continue;
    const meta = asRecord(q.metadata);
    const slot = Number(meta?.["audio_slot"] ?? meta?.["teil"]);
    if (!Number.isFinite(slot) || slot < 1 || slot > 4) continue;
    const status =
      typeof meta?.["audio_verification_status"] === "string"
        ? meta["audio_verification_status"]
        : null;
    const note =
      typeof meta?.["audio_verification_note"] === "string"
        ? meta["audio_verification_note"]
        : null;
    const path = q.media_path?.trim() || null;
    const prev = bySlot.get(slot);
    bySlot.set(slot, {
      hasAudio: Boolean(prev?.hasAudio || hasAudio(q)),
      verificationStatus: status ?? prev?.verificationStatus ?? null,
      mediaPath: path ?? prev?.mediaPath ?? null,
      note: note ?? prev?.note ?? null,
    });
  }
  return [1, 2, 3, 4].map((part) => {
    const hit = bySlot.get(part);
    return {
      part,
      hasAudio: hit?.hasAudio ?? false,
      verificationStatus: hit?.verificationStatus ?? null,
      mediaPath: hit?.mediaPath ?? null,
      note: hit?.note ?? null,
    };
  });
}
