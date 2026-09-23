import { describe, expect, it } from "vitest";
import { loadB1ExamBank } from "./b1-exam-bank";
import {
  extractMatchingItems,
  extractSingleChoiceItems,
  extractTrueFalseStatements,
  transformB1Exam,
  transformB1ExamBank,
  transformHoerenSection,
  transformLesenSection,
  transformSchreibenSection,
  transformSprechenSection,
} from "./b1-structure-transform";

describe("B1 structure transform", () => {
  it("recovers unnumbered Lesen Teil2 stems 8–9 after numbered 7", () => {
    const ocr = `Beispiel
Hotelmanagerwurdengefragt,
wohin sie am liebstenreisen.
welcheTouristensieamsympathischstenfinden.
wosiegern arbeiten wurden.
7In diesemText gehtes darum,...
wasfurTouristen ausverschiedenenLandern
typisch ist.
warum dieJapanergernreisen.
welcheSprache man alsTouristlernen sollte.
DieDeutschen erkennt man...
anihreramerikanischenKleidung.
anihrenSommerschuhen.
anderKombinationvonSocken undSommer-
schuhen.
Osterreicher...
sindbei HotelmanagernbeliebteralsDeutscheund
Amerikaner.
machenkeinenbesonderenEindruck aufdieHotel-
manager.
haben dasReisenbessergelernt.`;
    const items = extractSingleChoiceItems(ocr, 7, 9);
    expect(items.get(7)?.prompt).toMatch(/diesemText|darum/i);
    expect(items.get(7)?.options).toHaveLength(3);
    expect(items.get(8)?.prompt).toMatch(/Deutschen erkennt/i);
    expect(items.get(8)?.options).toHaveLength(3);
    expect(items.get(9)?.prompt).toMatch(/Osterreicher/i);
    expect(items.get(9)?.options).toHaveLength(3);
  });

  it("recovers matching situations when OCR drops tens digit", () => {
    const ocr = `13AnnaliebtdasAbenteuerund hatvor,eineexotischeReisezuunternehmen.
14TimhatgroBesInteresseanaltenBurgenundSchlossern.
5MartinistHobbykoch,deshalbmochteerimUrlaubauchdieauslandischeKuche
naherkennenlernen.
6IlseundihredreiFreundinnensindromantischeTypen.SiewollengemeinsamimJuni
Urlaub machen.
Jutta hateinanstrengendesJahrhintersichundwurdegernetwasBesonderesfur
ihre Gesundheit tun.
8BenverbringtseinenUrlaubamliebstenineinemHotel,dochnicht imSuden,weiler
keine Hitze mag.
19LeonieundAndreasverreisennieohne ihrenHundMax.
a
UrlaubamMeer-Adria Italien Lido di Jesolo Wohnung
b
bewusst.er.leben MARE Vitality Hotel`;
    const items = extractMatchingItems(ocr, 13, 19);
    expect(items.get(13)?.prompt).toMatch(/Anna/i);
    expect(items.get(15)?.prompt).toMatch(/Martin/i);
    expect(items.get(16)?.prompt).toMatch(/Ilse/i);
    expect(items.get(17)?.prompt).toMatch(/Jutta/i);
    expect(items.get(18)?.prompt).toMatch(/Ben/i);
    expect(items.get(19)?.prompt).toMatch(/Leonie/i);
  });

  it("extracts 6 Lesen Teil1 RF statements from MT01 fixture pattern", () => {
    const prompt = `1
Teil 1
LESEN
Beispiel
Clemens'MutterkommtausdemLibanon.
Richtig
Falsch
ClemenskannsichkaumnochandieZeitimLibanonerinnern.
Richtig
Falsch
Clemens'HausinPortugal lagamMeer.
Richtig
Falsch
Clemens besuchte einen englischsprachigen Kindergarten.
Richtig
Falsch
InBerlinwohnteClemensbiszuseinemsiebtenLebensjahr.
Richtig
Falsch
Clemensmeint,esgibtgroBeUnterschiedezwischenBerlin
Richtig
Falsch
undNewYork.
InNewYorkfuhltsichClemensjetztwiezuHause.
Richtig
Falsch
ZertifikatB1neu`;
    const { statements, transform_status } = extractTrueFalseStatements(prompt, 6);
    expect(statements).toHaveLength(6);
    expect(statements[0]).toMatch(/Libanon/i);
    expect(statements[0]).toMatch(/erinnern|Clemens/i);
    expect(statements[0]).not.toMatch(/Kofferpacken|Berlingeblieben/i);
    expect(statements[4]).toMatch(/Berlin|NewYork/i);
    expect(statements.every((s) => s.length > 5)).toBe(true);
    expect(["structured", "needs_review"]).toContain(transform_status);
  });

  it("MT01 Lesen Q1 is remembrance statement not passage fragment", () => {
    const bank = loadB1ExamBank();
    const mt01 = bank.exams.find((e) => e.id === "B1-MT01") ?? bank.exams[0]!;
    const lesen = transformLesenSection(mt01);
    expect(lesen[0]!.prompt).toMatch(/Clemens|Libanon|erinnern/i);
    expect(lesen[0]!.prompt).not.toMatch(/Kofferpacken|Berlingeblieben/i);
    expect(lesen[0]!.type).toBe("true_false");
    expect(lesen[0]!.options?.map((o) => o.text)).toEqual(["Richtig", "Falsch"]);
    expect(lesen[0]!.passage || lesen[0]!.metadata.passage).toBeTruthy();
    expect(lesen[0]!.teil).toBe(1);
  });

  it("MT01 Hören derives Text-based Teil1 prompts with few placeholders", () => {
    const bank = loadB1ExamBank();
    const mt01 = bank.exams.find((e) => e.id === "B1-MT01") ?? bank.exams[0]!;
    const hoeren = transformHoerenSection(mt01);
    expect(hoeren).toHaveLength(30);
    expect(hoeren[0]!.prompt).toMatch(/M[oö]bel|Sonderangebot/i);
    expect(hoeren[0]!.audio_slot).toBe(1);
    expect(hoeren.filter((q) => q.transform_status === "placeholder").length).toBeLessThan(5);
    expect(hoeren.filter((q) => q.audio_slot === 1)).toHaveLength(10);
    expect(hoeren.filter((q) => q.audio_slot === 4)).toHaveLength(8);
  });

  it("Sprechen keeps Teil2 A and B as separate activities", () => {
    const bank = loadB1ExamBank();
    const mt01 = bank.exams.find((e) => e.id === "B1-MT01") ?? bank.exams[0]!;
    const sprechen = transformSprechenSection(mt01);
    const teil2 = sprechen.filter((q) => q.teil === 2);
    expect(teil2.some((q) => q.role === "A")).toBe(true);
    expect(teil2.some((q) => q.role === "B")).toBe(true);
    expect(teil2.find((q) => q.role === "A")!.id).not.toBe(teil2.find((q) => q.role === "B")!.id);
  });

  it("produces 15×30 Lesen, 15×30 Hören, 45 Schreiben, Sprechen A/B split", () => {
    const bank = loadB1ExamBank();
    const { bank: structured, stats } = transformB1ExamBank(bank);

    expect(stats.exams).toBe(15);
    expect(stats.lesen_total).toBe(15 * 30);
    expect(stats.hoeren_total).toBe(15 * 30);
    expect(stats.schreiben_total).toBe(15 * 3);
    expect(stats.verified).toBe(0);

    for (const exam of structured.exams) {
      const lesen = exam.sections.find((s) => s.type === "lesen")!;
      const hoeren = exam.sections.find((s) => s.type === "hoeren")!;
      const schreiben = exam.sections.find((s) => s.type === "schreiben")!;
      const sprechen = exam.sections.find((s) => s.type === "sprechen")!;

      expect(lesen.questions).toHaveLength(30);
      expect(hoeren.questions).toHaveLength(30);
      expect(schreiben.questions).toHaveLength(3);
      expect(sprechen.questions.some((q) => q.teil === 2 && q.role === "A")).toBe(true);
      expect(sprechen.questions.some((q) => q.teil === 2 && q.role === "B")).toBe(true);
      expect(sprechen.questions.some((q) => q.teil === 1)).toBe(true);

      // Never merge A/B into one question
      const teil2 = sprechen.questions.filter((q) => q.teil === 2);
      expect(teil2.length).toBeGreaterThanOrEqual(2);
      expect(teil2.every((q) => q.role === "A" || q.role === "B" || q.role == null)).toBe(true);
      // Real OCR sheets (not placeholders) when roles detected
      const realA = teil2.find((q) => q.role === "A");
      const realB = teil2.find((q) => q.role === "B");
      expect(realA && realB).toBeTruthy();
      expect(realA!.id).not.toBe(realB!.id);

      for (const q of [...lesen.questions, ...hoeren.questions]) {
        expect(q.answer_key).toBeNull();
        expect(q.review_status).toBe("needs_review");
        expect(q.points_rubric).toBe("provisional_needs_review");
      }

      // Lesen types by range
      expect(lesen.questions.slice(0, 6).every((q) => q.type === "true_false")).toBe(true);
      expect(lesen.questions.slice(6, 12).every((q) => q.type === "single_choice")).toBe(true);
      expect(lesen.questions.slice(12, 19).every((q) => q.type === "matching")).toBe(true);
      expect(lesen.questions.slice(19, 26).every((q) => q.type === "true_false")).toBe(true);
      expect(lesen.questions.slice(26, 30).every((q) => q.type === "single_choice")).toBe(true);

      // Hören audio slots
      expect(hoeren.questions.filter((q) => q.audio_slot === 1)).toHaveLength(10);
      expect(hoeren.questions.filter((q) => q.audio_slot === 2)).toHaveLength(5);
      expect(hoeren.questions.filter((q) => q.audio_slot === 3)).toHaveLength(7);
      expect(hoeren.questions.filter((q) => q.audio_slot === 4)).toHaveLength(8);
      expect(hoeren.questions.every((q) => q.type === "listening")).toBe(true);
    }
  });

  it("keeps original OCR source metadata and never invents answer keys", () => {
    const bank = loadB1ExamBank();
    const exam = transformB1Exam(bank.exams[0]!);
    const lesen = transformLesenSection(bank.exams[0]!);
    const hoeren = transformHoerenSection(bank.exams[0]!);
    const schreiben = transformSchreibenSection(bank.exams[0]!);
    const sprechen = transformSprechenSection(bank.exams[0]!);

    expect(lesen).toHaveLength(30);
    expect(hoeren).toHaveLength(30);
    expect(schreiben).toHaveLength(3);
    expect(sprechen.length).toBeGreaterThanOrEqual(3);

    for (const q of exam.sections.flatMap((s) => s.questions)) {
      expect(q.answer_key).toBeNull();
      expect(q.metadata.needs_review).toBe(true);
      expect(q.metadata.source).toBeTruthy();
      expect(q.review_status).not.toBe("verified");
    }
  });
});
