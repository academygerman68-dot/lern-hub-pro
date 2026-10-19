import { describe, expect, it } from "vitest";
import { teacherInterfaceLocale, translate } from "@/lib/i18n";
import { localizeInterfaceText } from "@/lib/interface-localization";

describe("interface locales for all roles", () => {
  it("lets every role keep the selected interface locale", () => {
    expect(teacherInterfaceLocale("teacher", "fr")).toBe("fr");
    expect(teacherInterfaceLocale("teacher", "ar")).toBe("ar");
    expect(teacherInterfaceLocale("teacher", "en")).toBe("en");
    expect(teacherInterfaceLocale("teacher", "de")).toBe("de");
    expect(teacherInterfaceLocale("student", "ar")).toBe("ar");
    expect(teacherInterfaceLocale("director", "en")).toBe("en");
    expect(teacherInterfaceLocale(null, "fr")).toBe("fr");
  });

  it("translates navigation labels in FR EN DE AR", () => {
    expect(translate("de", "nav.exams")).toBe("Probeprüfungen");
    expect(translate("en", "nav.exams")).toBe("Mock exams");
    expect(translate("fr", "nav.exams")).toBe("Examens blancs");
    expect(translate("ar", "nav.exams")).toBe("الامتحانات");
    expect(translate("en", "shell.teacher")).toBe("Teaching studio");
    expect(translate("de", "teacher.courses.title")).toBe("Kurse");
  });

  it("maps known French teacher labels to German and leaves unknown copy unchanged", () => {
    expect(localizeInterfaceText("Cours", "de")).toBe("Kurse");
    expect(localizeInterfaceText("Texte pédagogique libre", "de")).toBe("Texte pédagogique libre");
  });

  it("keeps English source labels when locale is en", () => {
    expect(localizeInterfaceText("Continue learning", "en")).toBe("Continue learning");
    expect(localizeInterfaceText("Continuer à apprendre", "en")).toBe("Continue learning");
  });
});
