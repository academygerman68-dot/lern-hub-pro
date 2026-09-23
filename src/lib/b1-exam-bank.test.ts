import { describe, expect, it } from "vitest";
import {
  inventoryLocalAudiFolders,
  loadB1ExamBank,
  mapDriveAudiFolderName,
  proposePublicationBlockers,
  validateB1ExamBank,
} from "./b1-exam-bank";
import { detectSprechenRole, splitSchreibenPageBundle } from "./b1-ocr-transform";

/** Inline MT01 Schreiben sample (not the full 9MB bank). */
const MT01_SCHREIBEN_FIXTURE = `SCHREIBEN
Aufgabe 1
Arbeitszeit:20Minuten
IhrCousin,derineineranderenStadtwohnt,hatgeradedasAbiturmiteinersehrgutenNote
bestanden undmochtedasmit einergroBenPartyfeiern.
-Bedanken Sie sichfur die Einladungund sagenSiezu.
-MachenSieVorschlage,wieSiebei denPartyvorbereitungen helfenkonnten.
-SchreibenSie,wannSiekommenundwielangeSiebleibenwerden.
Schreiben Sie eine E-Mail(circa 80Worter).
Schreiben Sieetwas zu allen drei Punkten.
Aufgabe2
Arbeitszeit:25Minuten
SiehabenimFernseheneineDiskussionssendungzumThema，Freundschaftgesehen.
SchreibenSienunIhreMeinung(circa80Worter).
Aufgabe 3
3Arbeitszeit:15Minuten
In IhremDeutschkurswurdegesterneinTestgeschrieben,aberSiewarennicht da.
bittenSie umeinenTermin,andemSiedenTest nachschreibenkonnen.
SchreibenSieeine E-Mail(circa40Worter).
VergessenSienichtdieAnredeunddenGruBamSchluss.
`;

describe("B1 exam bank core", () => {
  it("validates 15 exams, 240 unique pages, 4 sections, no invented keys", () => {
    const bank = loadB1ExamBank();
    const result = validateB1ExamBank(bank);

    expect(result.ok, JSON.stringify(result.issues.slice(0, 10), null, 2)).toBe(true);
    expect(result.stats.exams).toBe(15);
    expect(result.stats.unique_pages).toBe(240);
    expect(result.stats.sections_ok).toBe(15);
    expect(result.stats.expected_audio).toBe(60);
    expect(result.stats.non_null_answer_keys).toBe(0);
    expect(result.stats.non_zero_points).toBe(0);
    expect(result.stats.invented_keys_flagged).toBe(0);

    for (const exam of bank.exams) {
      const types = exam.sections.map((s) => s.type).sort().join(",");
      expect(types).toBe("hoeren,lesen,schreiben,sprechen");
      expect(exam.integrity.answer_keys_invented).toBe(false);
      expect(exam.integrity.answer_keys_included).toBe(false);
      expect(exam.publishable).toBe(false);
      expect(exam.status).toBe("draft");

      for (const section of exam.sections) {
        for (const q of section.questions) {
          expect(q.answer_key).toBeNull();
          expect(q.points).toBe(0);
        }
      }

      const blockers = proposePublicationBlockers(exam);
      expect(blockers.length).toBeGreaterThan(0);
      expect(blockers.some((b) => /audio|Hör/i.test(b))).toBe(true);
    }
  });

  it("maps Drive audi folder names to B1-MTnn", () => {
    expect(mapDriveAudiFolderName("audi 1")).toBe("B1-MT01");
    expect(mapDriveAudiFolderName("audi1")).toBe("B1-MT01");
    expect(mapDriveAudiFolderName("Audi 01")).toBe("B1-MT01");
    expect(mapDriveAudiFolderName("AUDI 15")).toBe("B1-MT15");
    expect(mapDriveAudiFolderName("Audio 1")).toBe("B1-MT01");
    expect(mapDriveAudiFolderName("Audio N".replace("N", "7"))).toBe("B1-MT07");
    expect(mapDriveAudiFolderName("Audio7")).toBe("B1-MT07");
    expect(mapDriveAudiFolderName("audio 10")).toBe("B1-MT10");
    expect(mapDriveAudiFolderName("audi 16")).toBeNull();
    expect(mapDriveAudiFolderName("music 1")).toBeNull();
  });

  it("marks ambiguous Teil when filenames are unclear", () => {
    const rows = inventoryLocalAudiFolders([
      {
        name: "audi 2",
        files: ["track-a.mp3", "track-b.mp3", "random.wav"],
      },
      {
        name: "audi 3",
        files: ["teil-1.mp3", "teil-2.mp3", "teil-3.mp3", "teil-4.mp3"],
      },
      {
        name: "not-audi",
        files: ["x.mp3"],
      },
    ]);

    const ambiguous = rows.filter((r) => r.folder === "audi 2");
    expect(ambiguous.length).toBe(3);
    expect(ambiguous.every((r) => r.examId === "B1-MT02")).toBe(true);
    expect(ambiguous.every((r) => r.proposedTeil === null)).toBe(true);
    expect(ambiguous.every((r) => r.confidence === "à confirmer")).toBe(true);
    expect(ambiguous.every((r) => r.status === "ambigu")).toBe(true);

    // Duplicate Teil labels across files → still ambiguous (no unique mapping)
    const clash = inventoryLocalAudiFolders([
      {
        name: "audi 4",
        files: ["teil-1.mp3", "teil-1-copy.mp3", "teil-2.mp3", "teil-3.mp3"],
      },
    ]);
    expect(clash.some((r) => r.proposedTeil === 1)).toBe(true);
    // Two files claim Teil 1 — attach script must not auto-upload without confirmation
    expect(clash.filter((r) => r.proposedTeil === 1)).toHaveLength(2);

    const ready = rows.filter((r) => r.folder === "audi 3");
    expect(ready.every((r) => r.status === "prêt")).toBe(true);
    expect(ready.map((r) => r.proposedTeil).sort()).toEqual([1, 2, 3, 4]);

    const blocked = rows.filter((r) => r.folder === "not-audi");
    expect(blocked.every((r) => r.status === "bloqué")).toBe(true);
  });

  it("splits MT01 Schreiben fixture into 3 tasks without inventing keys", () => {
    const tasks = splitSchreibenPageBundle(MT01_SCHREIBEN_FIXTURE, {
      source_pdf_page: 17,
      ocr_text: MT01_SCHREIBEN_FIXTURE,
      ocr_lines: [],
      transcription_status: "ocr_unverified",
    });

    expect(tasks).toHaveLength(3);
    expect(tasks.map((t) => t.idSuffix)).toEqual(["A1", "A2", "A3"]);
    expect(tasks.every((t) => t.needs_review === true)).toBe(true);
    expect(tasks.every((t) => t.transform_status === "structured")).toBe(true);
    expect(tasks[0]!.requirements.length).toBeGreaterThanOrEqual(3);
    expect(tasks[0]!.recommended_words).toMatch(/80/);
    expect(tasks[2]!.recommended_words).toMatch(/40/);
    // Never invent sample answers / points on the transform result
    for (const task of tasks) {
      expect(task).not.toHaveProperty("sample_answer");
      expect(task).not.toHaveProperty("answer_key");
      expect(task).not.toHaveProperty("points");
    }
  });

  it("detects truncated Kandidat A/B roles", () => {
    expect(detectSprechenRole("SPRECHEN\nandidat\nTeil2")).toBe("A");
    expect(detectSprechenRole("SPRECHEN\nandid\nTeil2")).toBe("A");
    expect(detectSprechenRole("Kandida\nSPRECHEN\nB\nTeil2")).toBe("B");
    expect(detectSprechenRole("Teil 1\nSPRECHEN\nGemeinsam")).toBeNull();
  });
});
