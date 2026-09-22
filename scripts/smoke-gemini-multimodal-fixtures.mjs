/**
 * Local smoke helpers for Gemini multimodal readiness (no secrets required).
 * Run: node scripts/smoke-gemini-multimodal-fixtures.mjs
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), "tmp", "gemini-multimodal-smoke");
mkdirSync(outDir, { recursive: true });

// 1x1 PNG (red pixel)
const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const pngPath = join(outDir, "sample.png");
writeFileSync(pngPath, Buffer.from(pngBase64, "base64"));

// Minimal valid PDF with German text for OCR-like multimodal prompts
const pdf = `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 68 >>stream
BT /F1 18 Tf 40 100 Td (Ich heisse Anna und wohne in Berlin.) Tj ET
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000385 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
454
%%EOF
`;
const pdfPath = join(outDir, "sample.pdf");
writeFileSync(pdfPath, pdf, "utf8");

const png = readFileSync(pngPath);
const pdfBuf = readFileSync(pdfPath);

function looksMultimodal(name, bytes) {
  const lower = name.toLowerCase();
  const okExt =
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".pdf");
  return okExt && bytes.length > 0 && bytes.length < 15 * 1024 * 1024;
}

const cases = [
  { name: "sample.png", bytes: png, expect: true },
  { name: "sample.pdf", bytes: pdfBuf, expect: true },
  { name: "notes.docx", bytes: Buffer.from("PK"), expect: false },
];

let failed = 0;
for (const c of cases) {
  const got = looksMultimodal(c.name, c.bytes);
  const ok = got === c.expect;
  console.log(`${ok ? "OK" : "FAIL"} ${c.name} size=${c.bytes.length} multimodal=${got}`);
  if (!ok) failed += 1;
}

console.log(`Fixtures written to ${outDir}`);
console.log(
  failed === 0
    ? "Smoke fixtures ready. Live Gemini call requires teacher JWT + GEMINI_API_KEY on the Edge Function (already deployed)."
    : `Smoke failed (${failed})`,
);
process.exit(failed === 0 ? 0 : 1);
