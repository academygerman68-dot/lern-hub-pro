import { describe, expect, it } from "vitest";
import { uiPick, uiText } from "@/lib/ui-strings";

describe("ui-strings catalog", () => {
  it("translates page titles across locales", () => {
    expect(uiText("fr", "Examens blancs")).toBe("Examens blancs");
    expect(uiText("en", "Examens blancs")).toBe("Mock exams");
    expect(uiText("de", "Examens blancs")).toBe("Probeprüfungen");
    expect(uiText("ar", "Examens blancs")).toBe("الامتحانات");
  });

  it("resolves from any language variant back to the pack", () => {
    expect(uiText("fr", "Mock exams")).toBe("Examens blancs");
    expect(uiText("de", "Settings")).toBe("Einstellungen");
  });

  it("fills EN/DE for legacy l(fr, ar) via uiPick", () => {
    expect(uiPick("ar", "Devoirs", "الواجبات")).toBe("الواجبات");
    expect(uiPick("en", "Devoirs", "الواجبات")).toBe("Assignments");
    expect(uiPick("de", "Devoirs", "الواجبات")).toBe("Aufgaben");
    expect(uiPick("fr", "Devoirs", "الواجبات")).toBe("Devoirs");
  });

  it("leaves unknown copy unchanged", () => {
    expect(uiText("en", "Texte libre inconnu")).toBe("Texte libre inconnu");
  });
});
