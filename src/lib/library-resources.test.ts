import { describe, expect, it } from "vitest";
import {
  assertTeacherAudienceScope,
  subtypeOptionsForDomain,
  validateAttachmentList,
} from "./library-resources";
import { buildTeacherScope } from "./academy-logic";
import { emptyAttachmentDraft } from "@/components/academy/content-attachment-uploader";

describe("library resources catalogue", () => {
  it("maps active subtype rows to select options by domain", () => {
    const rows = [
      { domain: "academic", code: "cours", label_fr: "Cours", active: true, sort_order: 10 },
      { domain: "academic", code: "exercices", label_fr: "Exercices", active: true, sort_order: 20 },
      {
        domain: "professional",
        code: "visa",
        label_fr: "Visa",
        active: true,
        sort_order: 10,
      },
      {
        domain: "announcements",
        code: "infos",
        label_fr: "Informations importantes",
        active: true,
        sort_order: 30,
      },
      {
        domain: "academic",
        code: "legacy",
        label_fr: "Ancien",
        active: false,
        sort_order: 99,
      },
    ];
    const academicActive = subtypeOptionsForDomain(rows, "academic");
    expect(academicActive).toEqual([
      { code: "cours", label: "Cours" },
      { code: "exercices", label: "Exercices" },
    ]);
    expect(subtypeOptionsForDomain(rows, "announcements").map((r) => r.code)).toEqual(["infos"]);
    expect(subtypeOptionsForDomain(rows, "academic", "legacy").at(-1)).toEqual({
      code: "legacy",
      label: "Ancien (désactivé)",
    });
  });

  it("blocks teacher audience outside assigned groups", () => {
    const scope = buildTeacherScope([{ id: "c1", level: "A1" }]);
    expect(
      assertTeacherAudienceScope({
        isTeacher: true,
        audience: "classes",
        classIds: ["c1"],
        scope,
      }),
    ).toBeNull();
    expect(
      assertTeacherAudienceScope({
        isTeacher: true,
        audience: "classes",
        classIds: ["c1", "other"],
        scope,
      }),
    ).toMatch(/hors de vos groupes/i);
    expect(
      assertTeacherAudienceScope({
        isTeacher: true,
        audience: "everyone",
        scope,
      }),
    ).toMatch(/groupes/i);
  });

  it("requires at least one attachment support when creating", () => {
    expect(validateAttachmentList([])).toMatch(/au moins un support/i);
    const link = emptyAttachmentDraft("link");
    link.url = "https://example.com/visa";
    expect(validateAttachmentList([link])).toBeNull();
  });
});
