import { File } from "megajs";
import fs from "fs";
import path from "path";

const url = "https://mega.nz/folder/LEFC3BbR#NBHEPxuWb1ynXKpj3zXvvA";
const outDir = "data/exams/a1-b1-series/source";

const targets = [
  ["A1-B1", "Grammatik", "Deutsch Übungsgrammatik für die Grundstufe PLUS.pdf"],
  ["A1", "Deutsch Intensiv Grammatik A1.pdf"],
  ["A2", "Wortschatz und Grammatik A2.pdf"],
  ["B1", "Wortschatz & Grammatik B1 Neu.pdf"],
];

function findPath(node, parts) {
  let cur = node;
  for (const part of parts) {
    cur = (cur.children || []).find((child) => child.name === part);
    if (!cur) return null;
  }
  return cur;
}

function safeName(name) {
  return name.replace(/[<>:"|?*]/g, "_");
}

fs.mkdirSync(outDir, { recursive: true });

const root = File.fromURL(url);
await root.loadAttributes();

for (const parts of targets) {
  const file = findPath(root, parts);
  if (!file) {
    console.log("MISSING", parts.join("/"));
    continue;
  }
  const dest = path.join(outDir, safeName(file.name));
  if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
    console.log("SKIP", dest, `${(fs.statSync(dest).size / 1024 / 1024).toFixed(1)}MB`);
    continue;
  }
  console.log("DOWNLOAD", file.name, `${(file.size / 1024 / 1024).toFixed(1)}MB`);
  await new Promise((resolve, reject) => {
    const stream = file.download();
    const ws = fs.createWriteStream(dest);
    stream.pipe(ws);
    stream.on("error", reject);
    ws.on("finish", resolve);
    ws.on("error", reject);
  });
  console.log("OK", dest, `${(fs.statSync(dest).size / 1024 / 1024).toFixed(1)}MB`);
}
