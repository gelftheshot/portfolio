import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PDFDocument, PDFName } from "pdf-lib";
import { buildAssistantKnowledge } from "../lib/assistant-knowledge.js";
import { generateResume, writeResume } from "../scripts/generate-resume.mjs";

function linkTargets(document) {
  return document.getPages().flatMap((page) => (page.node.Annots()?.asArray() || []).map((reference) => {
    const annotation = document.context.lookup(reference);
    return annotation.lookup(PDFName.of("A")).lookup(PDFName.of("URI")).decodeText();
  }));
}

test("selected CV is deterministic, one page, and links to its source evidence", async () => {
  const knowledge = buildAssistantKnowledge();
  const first = await generateResume(knowledge);
  const second = await generateResume(knowledge);
  assert.deepEqual(first.pdfBytes, second.pdfBytes);
  const pdf = await PDFDocument.load(first.pdfBytes);
  assert.equal(first.pageCount, 1);
  assert.equal(pdf.getPageCount(), 1);
  assert.equal(pdf.getAuthor(), knowledge.profile.name);
  const targets = linkTargets(pdf);
  for (const url of [knowledge.profile.links.website, knowledge.profile.links.github, knowledge.profile.links.linkedin,
    `mailto:${knowledge.contact.email}`, knowledge.clientWork.source.profileUrl,
    "https://github.com/gelftheshot/academic-advisor-ai"]) assert.ok(targets.includes(url));
  assert.match(first.text, /AI & Backend Engineer \| Workflow Automation/);
  assert.match(first.text, /Selected engagements, 2024 - 2026/);
  assert.match(first.text, /AxonTech/);
  assert.match(first.text, /Mar 2023 - Nov 2024/);
  assert.match(first.text, /10 completed jobs \| 9 written client reviews/);
  assert.match(first.text, /Cloud Practitioner Essentials course/);
  assert.doesNotMatch(first.text, /Axious|CONFIRM|DRAFT|vercel\.app|100%|15 jobs|12 client feedback entries|undefined|2024 - present/i);
});

test("selected employer content, identity, and dated proof stay connected to shared records", async () => {
  const knowledge = structuredClone(buildAssistantKnowledge());
  knowledge.profile.name = "Updated Portfolio Owner";
  knowledge.profile.title = "Backend Engineer";
  knowledge.profile.updatedAt = "2026-12-01";
  knowledge.profile.links.website = "https://updated-portfolio.example/";
  knowledge.profile.resumeSummary = "Backend engineer focused on service integrations and data systems.";
  knowledge.profile.experience[0].resumeBullets = ["Integrated application data with service interfaces."];
  knowledge.profile.experience.find((role) => role.id === "axious-tech").company = "Updated Employer";
  knowledge.clientWork.profile.totalJobCount = 12;
  knowledge.clientWork.profile.completedJobCount = 11;
  knowledge.clientWork.profile.writtenReviewCount = 10;
  knowledge.projects.find((project) => project.slug === "academic-advisor-ai").github = "https://github.com/example/updated-advisor";
  const result = await generateResume(knowledge);
  const pdf = await PDFDocument.load(result.pdfBytes, { updateMetadata: false });
  assert.equal(pdf.getAuthor(), "Updated Portfolio Owner");
  assert.equal(pdf.getModificationDate().toISOString(), "2026-12-01T00:00:00.000Z");
  assert.ok(linkTargets(pdf).includes("https://updated-portfolio.example/"));
  assert.ok(linkTargets(pdf).includes("https://github.com/example/updated-advisor"));
  assert.ok(result.text.includes(knowledge.profile.resumeSummary));
  assert.ok(result.text.includes(knowledge.profile.experience[0].resumeBullets[0]));
  assert.ok(result.text.includes("Updated Employer"));
  assert.ok(result.text.includes("11 completed jobs | 10 written client reviews"));
});

test("CV curation stays concise and missing selected source records fail explicitly", async () => {
  const knowledge = structuredClone(buildAssistantKnowledge());
  knowledge.profile.experience.push({ ...knowledge.profile.experience[0], id: "additional-role", company: "Additional Employer" });
  assert.ok(!(await generateResume(knowledge)).text.includes("Additional Employer"));
  knowledge.profile.experience = knowledge.profile.experience.filter((item) => item.id !== "alx-africa");
  await assert.rejects(generateResume(knowledge), /Selected CV experience is missing: alx-africa/);
});

test("prebuild writes the selected CV and preserves previous download URLs as identical aliases", async () => {
  const root = await mkdtemp(join(tmpdir(), "portfolio-cv-"));
  try {
    await writeResume(buildAssistantKnowledge(), root);
    for (const extension of ["pdf", "txt"]) {
      const current = await readFile(join(root, "public", `Lihon-Gebre-CV.${extension}`));
      assert.deepEqual(await readFile(join(root, "public", `Lihon-Gebre-Resume.${extension}`)), current);
      assert.deepEqual(await readFile(join(root, "output", "pdf", `Lihon-Gebre-CV.${extension}`)), current);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
