import { describe, expect, it } from "vitest";
import {
  isFileContentKind,
  isTextContentKind,
  isValidHttpUrl,
  libraryCategoryForKind,
  validateFileForKind,
  validateTextContentBody,
} from "./academic-content";

describe("academic content helpers", () => {
  it("accepts http and https URLs only", () => {
    expect(isValidHttpUrl("https://example.com/doc")).toBe(true);
    expect(isValidHttpUrl("http://example.com")).toBe(true);
    expect(isValidHttpUrl("ftp://example.com")).toBe(false);
    expect(isValidHttpUrl("not-a-url")).toBe(false);
  });

  it("maps library kinds to existing categories", () => {
    expect(libraryCategoryForKind("poster")).toBe("announcement");
    expect(libraryCategoryForKind("pdf")).toBe("pdf");
    expect(libraryCategoryForKind("document")).toBe("course_material");
    expect(libraryCategoryForKind("text")).toBe("course_material");
  });

  it("rejects mismatched files", () => {
    const pdf = new File(["%PDF"], "notes.pdf", { type: "application/pdf" });
    const image = new File(["img"], "photo.png", { type: "image/png" });
    expect(validateFileForKind(pdf, "pdf")).toBeNull();
    expect(validateFileForKind(image, "pdf")).toBe("Choisissez un fichier PDF.");
    expect(validateFileForKind(image, "image")).toBeNull();
    expect(validateFileForKind(pdf, "text")).toBe("Ce type de contenu n’accepte pas de fichier.");
  });

  it("validates text-only content bodies", () => {
    expect(isTextContentKind("text")).toBe(true);
    expect(isFileContentKind("text")).toBe(false);
    expect(isFileContentKind("pdf")).toBe(true);
    expect(validateTextContentBody("")).toBe("Saisissez le texte (ex. sujet d’expression écrite).");
    expect(validateTextContentBody("ab")).toBe("Le texte est trop court.");
    expect(validateTextContentBody("Beschreiben Sie Ihren Alltag.")).toBeNull();
  });
});
