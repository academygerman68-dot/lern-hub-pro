import { describe, expect, it } from "vitest";
import { teacherInterfaceLocale, translate } from "@/lib/i18n";
import { localizeInterfaceText } from "@/lib/interface-localization";

describe("teacher German locale", () => {
  it("uses German for teachers without replacing a learner locale", () => {
    expect(teacherInterfaceLocale("teacher", "fr")).toBe("de");
    expect(teacherInterfaceLocale("teacher", "ar")).toBe("de");
    expect(teacherInterfaceLocale("student", "ar")).toBe("ar");
    expect(teacherInterfaceLocale("director", "fr")).toBe("fr");
    expect(teacherInterfaceLocale(null, "fr")).toBe("fr");
  });

  it("translates teacher navigation and course labels into German", () => {
    expect(translate("de", "nav.exams")).toBe("Probeprüfungen");
    expect(translate("de", "shell.teacher")).toBe("Lehrstudio");
    expect(translate("de", "teacher.courses.title")).toBe("Kurse");
    expect(translate("fr", "nav.exams")).toBe("Examens blancs");
    expect(translate("ar", "nav.exams")).not.toBe("Probeprüfungen");
  });

  it("maps known French teacher labels to German and leaves unknown copy unchanged", () => {
    expect(localizeInterfaceText("Cours", "de")).toBe("Kurse");
    expect(localizeInterfaceText("Texte pédagogique libre", "de")).toBe("Texte pédagogique libre");
  });
});
