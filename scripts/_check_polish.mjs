import fs from "fs";

const checks = {
  academic: "src/components/academy/academic-pages.tsx",
  finance: "src/components/academy/finance-pages.tsx",
  exam: "src/components/academy/exam-pages.tsx",
  live: "src/components/academy/live-pages.tsx",
  cal: "src/components/academy/live-calendar.tsx",
  stu: "src/components/academy/student-extra.tsx",
  ds: "src/components/academy/shared/design-system.tsx",
  prim: "src/components/academy/primitives.tsx",
};

const a = fs.readFileSync(checks.academic, "utf8");
console.log("materials GroupBadge", a.includes("GroupBadge") && a.includes("item.class_id"));
console.log("materials menu", a.includes("Actions ressource"));
console.log("assign badges", a.includes("LevelBadge code={row.level"));
console.log("remises CTA", a.includes("min-h-10 font-semibold shadow-soft"));
console.log("assign FormSection", a.includes('title="Consigne"'));

const fin = fs.readFileSync(checks.finance, "utf8");
console.log("finance FileDrop", fin.includes("FileDropzoneVisual"));
console.log("finance FormSection", (fin.match(/FormSection/g) || []).length);

const exam = fs.readFileSync(checks.exam, "utf8");
console.log("exam ProgressLine import", exam.includes("ProgressLine"));
console.log("exam ProgressLine use", exam.includes("<ProgressLine"));
console.log("exam radio", exam.includes("aria-hidden") && exam.includes("rounded-full bg-primary"));

const live = fs.readFileSync(checks.live, "utf8");
console.log("live ring", live.includes("ring-2 ring-primary"));

const cal = fs.readFileSync(checks.cal, "utf8");
console.log("cal LevelBadge", cal.includes("LevelBadge"));

const stu = fs.readFileSync(checks.stu, "utf8");
console.log("stu Consigne hint", stu.includes("Instructions du professeur"));

const ds = fs.readFileSync(checks.ds, "utf8");
console.log("ds FileDrop", ds.includes("FileDropzoneVisual"));
console.log("prim FileDrop", fs.readFileSync(checks.prim, "utf8").includes("FileDropzoneVisual"));
