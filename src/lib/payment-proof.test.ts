import { describe, expect, it } from "vitest";
import {
  isValidDeclaredAmount,
  paymentProofMimeFromFile,
  resolveOwnStudent,
  studentProofDeadlineHint,
  toPaymentProofUserError,
  validatePaymentProofFile,
  validatePaymentProofSubmitInput,
} from "./payment-proof";

function makeFile(name: string, type: string, size = 12) {
  const bytes = new Uint8Array(size);
  return new File([bytes], name, { type });
}

describe("payment proof file validation", () => {
  it("accepts a valid PDF", () => {
    const file = makeFile("recu.pdf", "application/pdf");
    expect(validatePaymentProofFile(file)).toBeNull();
    expect(paymentProofMimeFromFile(file)).toBe("application/pdf");
  });

  it("accepts a valid JPEG and PNG", () => {
    const jpeg = makeFile("recu.jpg", "image/jpeg");
    const png = makeFile("recu.png", "image/png");
    expect(validatePaymentProofFile(jpeg)).toBeNull();
    expect(validatePaymentProofFile(png)).toBeNull();
  });

  it("rejects a missing file", () => {
    expect(validatePaymentProofFile(null)).toBe("Joignez un justificatif PDF, JPEG ou PNG.");
  });

  it("rejects a wrong file type", () => {
    expect(validatePaymentProofFile(makeFile("notes.docx", "application/msword"))).toBe(
      "Type de fichier non autorisé (PDF, JPEG ou PNG uniquement).",
    );
    expect(validatePaymentProofFile(makeFile("photo.webp", "image/webp"))).toBe(
      "Type de fichier non autorisé (PDF, JPEG ou PNG uniquement).",
    );
  });

  it("normalizes empty mime and image/jpg from the filename", () => {
    expect(paymentProofMimeFromFile(makeFile("avis.pdf", ""))).toBe("application/pdf");
    expect(paymentProofMimeFromFile(makeFile("avis.JPG", "image/jpg"))).toBe("image/jpeg");
  });
});

describe("payment proof submit validation", () => {
  const paymentId = "11111111-2222-3333-4444-555555555555";
  const studentId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

  it("requires a paymentId", () => {
    expect(
      validatePaymentProofSubmitInput({
        studentId,
        paymentId: "",
        file: makeFile("recu.pdf", "application/pdf"),
        declaredAmount: 500,
        operationDate: "2026-09-18",
      }),
    ).toBe("Sélectionnez un mois à payer.");
  });

  it("accepts a complete valid payload", () => {
    expect(
      validatePaymentProofSubmitInput({
        studentId,
        paymentId,
        file: makeFile("recu.pdf", "application/pdf"),
        declaredAmount: "250.50",
        operationDate: "2026-09-18",
      }),
    ).toBeNull();
  });

  it("rejects NaN amounts that would otherwise pass Number(x) <= 0", () => {
    expect(isValidDeclaredAmount("abc")).toBe(false);
    expect(isValidDeclaredAmount(0)).toBe(false);
    expect(isValidDeclaredAmount(10)).toBe(true);
  });
});

describe("student proof deadline copy", () => {
  it("asks to select an installment when none is chosen", () => {
    expect(
      studentProofDeadlineHint({ paymentsLoaded: true, eligibleCount: 2, paymentId: "" }),
    ).toBe("Sélectionnez un mois à payer.");
  });

  it("explains when no installment is available", () => {
    expect(
      studentProofDeadlineHint({ paymentsLoaded: true, eligibleCount: 0, paymentId: "" }),
    ).toBe("Aucun mois à payer n’est disponible. Contactez l’administration.");
  });
});

describe("own student identity", () => {
  const students = [
    { id: "stu-1", email: "old@demo.ma", profileId: "profile-1" },
    { id: "stu-2", email: "other@demo.ma", profileId: "profile-2" },
  ];

  it("matches by profile id even when emails differ", () => {
    expect(resolveOwnStudent(students, { profileId: "profile-1", email: "new@demo.ma" })?.id).toBe(
      "stu-1",
    );
  });
});

describe("payment proof error mapping", () => {
  it("maps a storage failure", () => {
    expect(
      toPaymentProofUserError({ message: "Bucket not found", statusCode: "404" }, "storage")
        .message,
    ).toMatch(/téléversement du justificatif a échoué/i);
  });

  it("maps a storage RLS denial", () => {
    expect(
      toPaymentProofUserError(
        { message: "new row violates row-level security policy", statusCode: "403" },
        "storage",
      ).message,
    ).toMatch(/droits de stockage/i);
  });

  it("maps a DB/RLS insert denial", () => {
    expect(
      toPaymentProofUserError(
        { message: "new row violates row-level security policy", code: "42501" },
        "insert",
      ).message,
    ).toMatch(/enregistrement du justificatif a été refusé/i);
  });

  it("maps a unique open-proof constraint", () => {
    expect(
      toPaymentProofUserError(
        {
          message: "duplicate key value violates unique constraint",
          code: "23505",
          details: "Key (payment_id)=(...) already exists.",
        },
        "insert",
      ).message,
    ).toMatch(/déjà en cours de validation/i);
  });
});
