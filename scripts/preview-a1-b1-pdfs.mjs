import fs from "fs";
import path from "path";
import { PDFParse } from "pdf-parse";

const dir = "data/exams/a1-b1-series/source";
const outDir = "data/exams/a1-b1-series/previews";
fs.mkdirSync(outDir, { recursive: true });

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".pdf"));
for (const file of files) {
  const buf = fs.readFileSync(path.join(dir, file));
  const parser = new PDFParse({ data: buf });
  const data = await parser.getText({ first: 1, last: 12 });
  const info = await parser.getInfo().catch(() => null);
  const pages = info?.total ?? data.pages?.length ?? "?";
  const text = data.text || (data.pages || []).map((p) => p.text).join("\n");
  const lines = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const preview = [`# ${file}`, `pages: ${pages}`, "", ...lines.slice(0, 100)].join("\n");
  const out = path.join(outDir, file.replace(/\.pdf$/i, ".preview.txt"));
  fs.writeFileSync(out, preview, "utf8");
  console.log("WROTE", out, `(${pages} pages, preview ${lines.length} lines)`);
  await parser.destroy?.();
}
