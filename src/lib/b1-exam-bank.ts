import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const B1_SCHEMA_VERSION = "b1-scanned-draft-1.0" as const;
export const B1_EXPECTED_EXAM_IDS = [
  "B1-MT01",
  "B1-MT02",
  "B1-MT03",
  "B1-MT04",
  "B1-MT05",
  "B1-MT06",
  "B1-MT07",
  "B1-MT08",
  "B1-MT09",
  "B1-MT10",
  "B1-MT11",
  "B1-MT12",
  "B1-MT13",
  "B1-MT14",
  "B1-MT15",
] as const;

export type B1ExamId = (typeof B1_EXPECTED_EXAM_IDS)[number];
export type B1SectionType = "lesen" | "hoeren" | "schreiben" | "sprechen";

export type B1OcrLine = {
  box?: unknown;
  text?: string;
  confidence?: number;
};

export type B1QuestionSource = {
  source_pdf_page: number;
  printed_page_number?: number | null;
  ocr_text: string;
  ocr_lines: B1OcrLine[];
  transcription_status: "ocr_unverified";
  [key: string]: unknown;
};

export type B1DraftQuestion = {
  id: string;
  order: number;
  type: string;
  prompt: string;
  points: number;
  automatic_grading?: boolean;
  answer_key: null;
  audio?: unknown;
  source: B1QuestionSource;
  [key: string]: unknown;
};

export type B1DraftSection = {
  id: string;
  type: B1SectionType;
  title: string;
  max_points: number | null;
  questions: B1DraftQuestion[];
};

export type B1ExamIntegrity = {
  answer_keys_included: boolean;
  answer_keys_invented: boolean;
  audio_included: boolean;
  manual_review_required: boolean;
  blocking_reasons?: string[];
};

export type B1DraftExam = {
  schema_version: typeof B1_SCHEMA_VERSION | string;
  id: string;
  level: "B1" | string;
  title: string;
  subtitle?: string;
  language?: string;
  status: "draft" | string;
  publishable: boolean;
  duration_minutes?: number | null;
  total_points?: number | null;
  automatic_points?: number | null;
  manual_points?: number | null;
  source?: Record<string, unknown>;
  integrity: B1ExamIntegrity;
  sections: B1DraftSection[];
};

export type B1ExpectedAudio = {
  section: string;
  part: number;
  target_question_id: string;
  preferred_filename: string;
  storage_bucket?: string;
  storage_path?: string;
  status: string;
  sha256?: string | null;
  duration_seconds?: number | null;
};

export type B1Manifest = {
  manifest_version?: string;
  exam_id: string;
  exam_json?: string;
  source_pdf_pages?: number[];
  section_page_map?: Record<string, number[]>;
  expected_audio: B1ExpectedAudio[];
  official_answer_key_source?: Record<string, unknown>;
  quality?: Record<string, unknown>;
};

export type B1ExamBank = {
  schema_version: typeof B1_SCHEMA_VERSION | string;
  delivery_type?: string;
  bank: {
    name: string;
    level: string;
    language?: string;
    exams_count: number;
    source_pdf?: string;
    source_pdf_sha256?: string;
    source_pdf_page_count?: number;
  };
  safety?: {
    status?: string;
    publishable?: boolean;
    ocr_verified?: boolean;
    structured_answer_keys_imported?: boolean;
    audio_files_included?: boolean;
    manual_review_required?: boolean;
  };
  audio_mapping_convention?: Record<string, unknown>;
  exams: B1DraftExam[];
  manifests: B1Manifest[];
  appendices?: Record<string, unknown>;
};

export type B1ValidationIssue = {
  path: string;
  message: string;
  severity?: "error" | "warning";
};

export type B1ValidationStats = {
  exams: number;
  expected_exams: number;
  unique_pages: number;
  expected_pages: number;
  sections_ok: number;
  questions: number;
  non_null_answer_keys: number;
  non_zero_points: number;
  expected_audio: number;
  expected_audio_target: number;
  invented_keys_flagged: number;
  integrity_violations: number;
};

export type B1ValidationResult = {
  ok: boolean;
  issues: B1ValidationIssue[];
  stats: B1ValidationStats;
  data?: B1ExamBank;
};

export type AudiFolderListing = {
  name: string;
  files: string[];
};

export type AudiInventoryRow = {
  folder: string;
  examId: string | null;
  file: string;
  extension: string;
  naturalOrder: number;
  proposedTeil: 1 | 2 | 3 | 4 | null;
  confidence: "certaine" | "à confirmer";
  status: "prêt" | "bloqué" | "ambigu";
  notes: string;
};

export type B1DryRunReport = {
  generated_at: string;
  schema_version: string;
  ok: boolean;
  blocking_issue_count: number;
  warning_count: number;
  issues: B1ValidationIssue[];
  stats: B1ValidationStats;
  exams: Array<{
    id: string;
    title: string;
    page_count: number;
    section_types: string[];
    publication_blockers: string[];
  }>;
  safety: {
    answer_keys_invented: false;
    structured_answer_keys_imported: false;
    publishable: false;
    status: "draft";
  };
  audio_inventory?: {
    rows: AudiInventoryRow[];
    mapped_folders: number;
    blocked_folders: number;
    ambiguous_rows: number;
  };
};

const DEFAULT_BANK_RELATIVE = "../../data/exams/b1-exam-bank/b1-exam-bank.complete.json";
const REQUIRED_SECTIONS: B1SectionType[] = ["lesen", "hoeren", "schreiben", "sprechen"];

function defaultBankPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, DEFAULT_BANK_RELATIVE);
}

export function loadB1ExamBank(path?: string): B1ExamBank {
  const filePath = path ? resolve(path) : defaultBankPath();
  const raw = JSON.parse(readFileSync(filePath, "utf8")) as B1ExamBank;
  return raw;
}

function emptyStats(): B1ValidationStats {
  return {
    exams: 0,
    expected_exams: 15,
    unique_pages: 0,
    expected_pages: 240,
    sections_ok: 0,
    questions: 0,
    non_null_answer_keys: 0,
    non_zero_points: 0,
    expected_audio: 0,
    expected_audio_target: 60,
    invented_keys_flagged: 0,
    integrity_violations: 0,
  };
}

export function validateB1ExamBank(raw: unknown): B1ValidationResult {
  const issues: B1ValidationIssue[] = [];
  const stats = emptyStats();

  if (!raw || typeof raw !== "object") {
    issues.push({ path: "", message: "Bank must be an object", severity: "error" });
    return { ok: false, issues, stats };
  }

  const bank = raw as B1ExamBank;

  if (bank.schema_version !== B1_SCHEMA_VERSION) {
    issues.push({
      path: "schema_version",
      message: `Expected ${B1_SCHEMA_VERSION}, got ${String(bank.schema_version)}`,
      severity: "error",
    });
  }

  if (!Array.isArray(bank.exams)) {
    issues.push({ path: "exams", message: "exams must be an array", severity: "error" });
    return { ok: false, issues, stats };
  }

  stats.exams = bank.exams.length;
  if (bank.exams.length !== 15) {
    issues.push({
      path: "exams",
      message: `Expected 15 exams, found ${bank.exams.length}`,
      severity: "error",
    });
  }

  if (bank.bank?.exams_count !== 15) {
    issues.push({
      path: "bank.exams_count",
      message: `Expected bank.exams_count 15, found ${String(bank.bank?.exams_count)}`,
      severity: "error",
    });
  }

  if (bank.safety?.structured_answer_keys_imported === true) {
    stats.invented_keys_flagged += 1;
    issues.push({
      path: "safety.structured_answer_keys_imported",
      message: "Structured answer keys must not be imported for scanned drafts",
      severity: "error",
    });
  }

  if (bank.safety?.publishable === true) {
    issues.push({
      path: "safety.publishable",
      message: "Bank safety.publishable must be false",
      severity: "error",
    });
  }

  const examIds = new Set<string>();
  const pageOwners = new Map<number, string>();
  let uniquePages = 0;

  for (const exam of bank.exams) {
    if (!exam?.id) {
      issues.push({ path: "exams", message: "Exam missing id", severity: "error" });
      continue;
    }

    if (!/^B1-MT(0[1-9]|1[0-5])$/.test(exam.id)) {
      issues.push({
        path: exam.id,
        message: "Exam id must match B1-MT01..B1-MT15",
        severity: "error",
      });
    }

    if (examIds.has(exam.id)) {
      issues.push({ path: exam.id, message: "Duplicate exam id", severity: "error" });
    }
    examIds.add(exam.id);

    if (exam.schema_version !== B1_SCHEMA_VERSION) {
      issues.push({
        path: `${exam.id}.schema_version`,
        message: `Expected ${B1_SCHEMA_VERSION}`,
        severity: "error",
      });
    }

    if (exam.level !== "B1") {
      issues.push({ path: `${exam.id}.level`, message: "level must be B1", severity: "error" });
    }

    if (exam.status !== "draft") {
      issues.push({ path: `${exam.id}.status`, message: "status must be draft", severity: "error" });
    }

    if (exam.publishable !== false) {
      issues.push({
        path: `${exam.id}.publishable`,
        message: "publishable must be false",
        severity: "error",
      });
    }

    const integrity = exam.integrity;
    if (!integrity) {
      stats.integrity_violations += 1;
      issues.push({
        path: `${exam.id}.integrity`,
        message: "Missing integrity block",
        severity: "error",
      });
    } else {
      if (integrity.answer_keys_included !== false) {
        stats.integrity_violations += 1;
        issues.push({
          path: `${exam.id}.integrity.answer_keys_included`,
          message: "must be false",
          severity: "error",
        });
      }
      if (integrity.answer_keys_invented !== false) {
        stats.integrity_violations += 1;
        stats.invented_keys_flagged += 1;
        issues.push({
          path: `${exam.id}.integrity.answer_keys_invented`,
          message: "Invented answer keys are forbidden",
          severity: "error",
        });
      }
      if (integrity.audio_included !== false) {
        stats.integrity_violations += 1;
        issues.push({
          path: `${exam.id}.integrity.audio_included`,
          message: "must be false until audio is attached",
          severity: "error",
        });
      }
      if (integrity.manual_review_required !== true) {
        stats.integrity_violations += 1;
        issues.push({
          path: `${exam.id}.integrity.manual_review_required`,
          message: "must be true",
          severity: "error",
        });
      }
    }

    if (!Array.isArray(exam.sections) || exam.sections.length !== 4) {
      issues.push({
        path: `${exam.id}.sections`,
        message: `Expected 4 sections, found ${exam.sections?.length ?? 0}`,
        severity: "error",
      });
    } else {
      const types = exam.sections.map((s) => s.type).sort().join(",");
      const expected = [...REQUIRED_SECTIONS].sort().join(",");
      if (types === expected) {
        stats.sections_ok += 1;
      } else {
        issues.push({
          path: `${exam.id}.sections`,
          message: `Expected sections lesen/hoeren/schreiben/sprechen, found ${types}`,
          severity: "error",
        });
      }

      for (const section of exam.sections) {
        if (!REQUIRED_SECTIONS.includes(section.type as B1SectionType)) {
          issues.push({
            path: `${exam.id}.${section.id}`,
            message: `Unknown section type ${section.type}`,
            severity: "error",
          });
        }
        if (!Array.isArray(section.questions) || section.questions.length < 1) {
          issues.push({
            path: `${section.id}`,
            message: "Section must have at least one question/page",
            severity: "error",
          });
          continue;
        }

        for (const question of section.questions) {
          stats.questions += 1;

          if (question.answer_key !== null) {
            stats.non_null_answer_keys += 1;
            issues.push({
              path: `${question.id}.answer_key`,
              message: "answer_key must be null (no invented keys)",
              severity: "error",
            });
          }

          if (question.points !== 0) {
            stats.non_zero_points += 1;
            issues.push({
              path: `${question.id}.points`,
              message: `points must be 0 (draft), found ${String(question.points)}`,
              severity: "error",
            });
          }

          const page = question.source?.source_pdf_page;
          if (typeof page !== "number" || !Number.isFinite(page)) {
            issues.push({
              path: `${question.id}.source.source_pdf_page`,
              message: "Missing source_pdf_page",
              severity: "error",
            });
          } else {
            const owner = pageOwners.get(page);
            if (owner && owner !== exam.id) {
              issues.push({
                path: `${question.id}.source.source_pdf_page`,
                message: `Page ${page} overlaps between ${owner} and ${exam.id}`,
                severity: "error",
              });
            } else if (!owner) {
              pageOwners.set(page, exam.id);
              uniquePages += 1;
            } else {
              // duplicate page within same exam
              issues.push({
                path: `${question.id}.source.source_pdf_page`,
                message: `Duplicate source_pdf_page ${page} within ${exam.id}`,
                severity: "error",
              });
            }
          }

          if (question.source?.transcription_status !== "ocr_unverified") {
            issues.push({
              path: `${question.id}.source.transcription_status`,
              message: "transcription_status must be ocr_unverified",
              severity: "warning",
            });
          }
        }
      }
    }
  }

  for (const expectedId of B1_EXPECTED_EXAM_IDS) {
    if (!examIds.has(expectedId)) {
      issues.push({
        path: "exams",
        message: `Missing exam ${expectedId}`,
        severity: "error",
      });
    }
  }

  stats.unique_pages = uniquePages;
  if (uniquePages !== 240) {
    issues.push({
      path: "exams",
      message: `Expected 240 unique source_pdf_page values, found ${uniquePages}`,
      severity: "error",
    });
  }

  const manifests = Array.isArray(bank.manifests) ? bank.manifests : [];
  if (manifests.length !== 15) {
    issues.push({
      path: "manifests",
      message: `Expected 15 manifests, found ${manifests.length}`,
      severity: "error",
    });
  }

  let audioCount = 0;
  for (const manifest of manifests) {
    const n = Array.isArray(manifest?.expected_audio) ? manifest.expected_audio.length : 0;
    audioCount += n;
    if (n !== 4) {
      issues.push({
        path: `manifests.${manifest?.exam_id ?? "?"}.expected_audio`,
        message: `Expected 4 audio slots, found ${n}`,
        severity: "error",
      });
    }
    if (manifest?.quality && (manifest.quality as { publishable?: boolean }).publishable === true) {
      issues.push({
        path: `manifests.${manifest.exam_id}.quality.publishable`,
        message: "manifest must not be publishable",
        severity: "error",
      });
    }
    const keySource = manifest?.official_answer_key_source as
      | { structured_keys_imported?: boolean }
      | undefined;
    if (keySource?.structured_keys_imported === true) {
      stats.invented_keys_flagged += 1;
      issues.push({
        path: `manifests.${manifest.exam_id}.official_answer_key_source`,
        message: "structured_keys_imported must be false",
        severity: "error",
      });
    }
  }
  stats.expected_audio = audioCount;
  if (audioCount !== 60) {
    issues.push({
      path: "manifests",
      message: `Expected 60 expected_audio entries, found ${audioCount}`,
      severity: "error",
    });
  }

  const blocking = issues.filter((i) => i.severity !== "warning");
  return {
    ok: blocking.length === 0,
    issues,
    stats,
    data: blocking.length === 0 ? bank : bank,
  };
}

/**
 * Map Drive folder names like "audi 1", "audi1", "Audi 01" → B1-MT01.
 */
export function mapDriveAudiFolderName(name: string): B1ExamId | null {
  if (!name || typeof name !== "string") return null;
  const normalized = name.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const match = normalized.match(/^audi\s*0*([1-9]|1[0-5])$/);
  if (!match) return null;
  const n = Number(match[1]);
  if (n < 1 || n > 15) return null;
  const id = `B1-MT${String(n).padStart(2, "0")}` as B1ExamId;
  return id;
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function fileExtension(file: string): string {
  const idx = file.lastIndexOf(".");
  if (idx <= 0) return "";
  return file.slice(idx).toLowerCase();
}

function detectTeilFromFilename(file: string): 1 | 2 | 3 | 4 | null {
  const base = file.replace(/\.[^.]+$/, "").toLowerCase();
  const patterns: Array<[RegExp, 1 | 2 | 3 | 4]> = [
    [/(?:^|[^a-z0-9])(?:teil[-\s_]?1|teil1|t1|part[-\s_]?1|part1)(?:[^a-z0-9]|$)/i, 1],
    [/(?:^|[^a-z0-9])(?:teil[-\s_]?2|teil2|t2|part[-\s_]?2|part2)(?:[^a-z0-9]|$)/i, 2],
    [/(?:^|[^a-z0-9])(?:teil[-\s_]?3|teil3|t3|part[-\s_]?3|part3)(?:[^a-z0-9]|$)/i, 3],
    [/(?:^|[^a-z0-9])(?:teil[-\s_]?4|teil4|t4|part[-\s_]?4|part4)(?:[^a-z0-9]|$)/i, 4],
  ];
  for (const [re, teil] of patterns) {
    if (re.test(base)) return teil;
  }
  return null;
}

/**
 * Only when exactly 4 files and each clearly maps to a unique 1–4 number.
 */
function numericTeilMap(files: string[]): Map<string, 1 | 2 | 3 | 4> | null {
  if (files.length !== 4) return null;

  const assigned = new Map<string, 1 | 2 | 3 | 4>();
  const used = new Set<number>();

  for (const file of files) {
    const base = file.replace(/\.[^.]+$/, "");
    // Prefer isolated 1-4 tokens (track01, _2_, (3), leading/trailing)
    const matches = [...base.matchAll(/(?:^|[^\d])([1-4])(?!\d)/g)];
    const nums = [...new Set(matches.map((m) => Number(m[1])))] as Array<1 | 2 | 3 | 4>;
    if (nums.length !== 1) return null;
    const n = nums[0]!;
    if (used.has(n)) return null;
    used.add(n);
    assigned.set(file, n);
  }

  if (used.size !== 4) return null;
  return assigned;
}

export function inventoryLocalAudiFolders(rootDirListing: AudiFolderListing[]): AudiInventoryRow[] {
  const rows: AudiInventoryRow[] = [];

  for (const folder of rootDirListing) {
    const examId = mapDriveAudiFolderName(folder.name);
    const files = [...(folder.files ?? [])].sort(naturalCompare);
    const numericMap = numericTeilMap(files);

    files.forEach((file, index) => {
      const fromName = detectTeilFromFilename(file);
      const fromNumeric = numericMap?.get(file) ?? null;
      let proposedTeil: 1 | 2 | 3 | 4 | null = null;
      let confidence: AudiInventoryRow["confidence"] = "à confirmer";
      let notes = "";

      if (fromName) {
        proposedTeil = fromName;
        confidence = "certaine";
        notes = "Teil détecté dans le nom de fichier";
      } else if (fromNumeric) {
        proposedTeil = fromNumeric;
        confidence = "certaine";
        notes = "Teil déduit du numéro (exactement 4 fichiers 1–4)";
      } else {
        proposedTeil = null;
        confidence = "à confirmer";
        notes =
          files.length === 4
            ? "4 fichiers présents mais numérotation/Teil non claire"
            : "Teil non détecté — confirmation manuelle requise";
      }

      let status: AudiInventoryRow["status"];
      if (!examId) {
        status = "bloqué";
        notes = notes ? `${notes}; dossier non mappable vers B1-MTnn` : "dossier non mappable vers B1-MTnn";
      } else if (proposedTeil == null || confidence === "à confirmer") {
        status = "ambigu";
      } else {
        status = "prêt";
      }

      rows.push({
        folder: folder.name,
        examId,
        file,
        extension: fileExtension(file),
        naturalOrder: index + 1,
        proposedTeil,
        confidence,
        status,
        notes,
      });
    });
  }

  return rows;
}

export function proposePublicationBlockers(exam: B1DraftExam): string[] {
  const blockers: string[] = [];

  if (exam.status !== "draft") {
    blockers.push(`status=${String(exam.status)} (attendu: draft)`);
  }
  if (exam.publishable !== false) {
    blockers.push("publishable flag is not false");
  }
  if (!exam.integrity?.manual_review_required) {
    blockers.push("manual_review_required must remain true");
  }
  if (exam.integrity?.answer_keys_included) {
    blockers.push("answer keys included — publication blocked");
  }
  if (exam.integrity?.answer_keys_invented) {
    blockers.push("invented answer keys detected — publication blocked");
  }
  if (!exam.integrity?.audio_included) {
    blockers.push("audios Hören absents");
  }
  if (exam.source && (exam.source as { ocr_verified?: boolean }).ocr_verified === false) {
    blockers.push("OCR non relu ligne par ligne");
  }
  if (Array.isArray(exam.integrity?.blocking_reasons)) {
    for (const reason of exam.integrity.blocking_reasons) {
      if (reason && !blockers.includes(reason)) blockers.push(reason);
    }
  }

  for (const section of exam.sections ?? []) {
    for (const question of section.questions ?? []) {
      if (question.answer_key !== null) {
        blockers.push(`non-null answer_key on ${question.id}`);
      }
      if (question.points !== 0) {
        blockers.push(`non-zero points on ${question.id} (barème non confirmé)`);
      }
    }
  }

  blockers.push("clés de correction structurées non fournies");
  blockers.push("barème non confirmé");

  return [...new Set(blockers)];
}

export function buildB1DryRunReport(
  bank: B1ExamBank,
  audioInventory?: AudiInventoryRow[],
): B1DryRunReport {
  const validation = validateB1ExamBank(bank);
  const issues = validation.issues;
  const blocking = issues.filter((i) => i.severity !== "warning");
  const warnings = issues.filter((i) => i.severity === "warning");

  const exams = (bank.exams ?? []).map((exam) => {
    const pageCount = exam.sections.reduce(
      (n, s) => n + (s.questions?.length ?? 0),
      0,
    );
    return {
      id: exam.id,
      title: exam.title,
      page_count: pageCount,
      section_types: (exam.sections ?? []).map((s) => s.type),
      publication_blockers: proposePublicationBlockers(exam),
    };
  });

  const report: B1DryRunReport = {
    generated_at: new Date().toISOString(),
    schema_version: B1_SCHEMA_VERSION,
    ok: validation.ok,
    blocking_issue_count: blocking.length,
    warning_count: warnings.length,
    issues,
    stats: validation.stats,
    exams,
    safety: {
      answer_keys_invented: false,
      structured_answer_keys_imported: false,
      publishable: false,
      status: "draft",
    },
  };

  if (audioInventory) {
    report.audio_inventory = {
      rows: audioInventory,
      mapped_folders: new Set(audioInventory.filter((r) => r.examId).map((r) => r.folder)).size,
      blocked_folders: new Set(audioInventory.filter((r) => r.status === "bloqué").map((r) => r.folder))
        .size,
      ambiguous_rows: audioInventory.filter((r) => r.status === "ambigu").length,
    };
  }

  return report;
}

export function formatB1DryRunMarkdown(report: B1DryRunReport): string {
  const lines: string[] = [];
  lines.push("# B1 exam bank dry-run");
  lines.push("");
  lines.push(`- Generated: ${report.generated_at}`);
  lines.push(`- Schema: ${report.schema_version}`);
  lines.push(`- OK: ${report.ok ? "yes" : "no"}`);
  lines.push(`- Blocking issues: ${report.blocking_issue_count}`);
  lines.push(`- Warnings: ${report.warning_count}`);
  lines.push("");
  lines.push("## Stats");
  lines.push("");
  lines.push(`| Metric | Value | Expected |`);
  lines.push(`| --- | ---: | ---: |`);
  lines.push(`| Exams | ${report.stats.exams} | ${report.stats.expected_exams} |`);
  lines.push(`| Unique PDF pages | ${report.stats.unique_pages} | ${report.stats.expected_pages} |`);
  lines.push(`| Sections OK | ${report.stats.sections_ok} | 15 |`);
  lines.push(`| Questions/pages | ${report.stats.questions} | 240 |`);
  lines.push(`| Expected audio slots | ${report.stats.expected_audio} | ${report.stats.expected_audio_target} |`);
  lines.push(`| Non-null answer keys | ${report.stats.non_null_answer_keys} | 0 |`);
  lines.push(`| Non-zero points | ${report.stats.non_zero_points} | 0 |`);
  lines.push(`| Invented-key flags | ${report.stats.invented_keys_flagged} | 0 |`);
  lines.push("");
  lines.push("## Safety");
  lines.push("");
  lines.push("- status: draft");
  lines.push("- publishable: false");
  lines.push("- answer_keys_invented: false");
  lines.push("- structured_answer_keys_imported: false");
  lines.push("- NEVER insert exam_answer_keys on import");
  lines.push("");

  if (report.issues.length) {
    lines.push("## Issues");
    lines.push("");
    for (const issue of report.issues.slice(0, 50)) {
      lines.push(`- [${issue.severity ?? "error"}] \`${issue.path}\`: ${issue.message}`);
    }
    if (report.issues.length > 50) {
      lines.push(`- … ${report.issues.length - 50} more`);
    }
    lines.push("");
  }

  lines.push("## Exams (publication blockers sample)");
  lines.push("");
  for (const exam of report.exams.slice(0, 3)) {
    lines.push(`### ${exam.id} — ${exam.title}`);
    lines.push(`- Pages: ${exam.page_count}`);
    lines.push(`- Sections: ${exam.section_types.join(", ")}`);
    lines.push(`- Blockers: ${exam.publication_blockers.slice(0, 4).join("; ")}`);
    lines.push("");
  }

  return lines.join("\n");
}
