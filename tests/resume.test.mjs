import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, PDFName } from "pdf-lib";
import { buildAssistantKnowledge } from "../lib/assistant-knowledge.js";
import { generateResume } from "../scripts/generate-resume.mjs";

function linkTargets(document) {
  return document.getPages().flatMap((page) => (page.node.Annots()?.asArray() || []).map((reference) => {
    const annotation = document.context.lookup(reference);
    return annotation.lookup(PDFName.of("A")).lookup(PDFName.of("URI")).decodeText();
  }));
}

test("resume is a deterministic two-page PDF with live profile and case-study links", async () => {
  const knowledge = buildAssistantKnowledge();
  const first = await generateResume(knowledge);
  const second = await generateResume(knowledge);
  assert.deepEqual(first.pdfBytes, second.pdfBytes);
  const pdf = await PDFDocument.load(first.pdfBytes);
  assert.equal(first.pageCount, 2);
  assert.equal(pdf.getPageCount(), 2);
  assert.equal(pdf.getAuthor(), knowledge.profile.name);
  const targets = linkTargets(pdf);
  assert.ok(targets.includes(knowledge.profile.links.website));
  assert.ok(targets.includes(`mailto:${knowledge.contact.email}`));
  for (const project of knowledge.projects.slice(0, 3)) assert.ok(targets.includes(project.caseStudyUrl));
  for (const credential of knowledge.profile.certifications) assert.ok(targets.includes(credential.url));
  for (const role of knowledge.profile.experience) assert.ok(first.text.includes(role.company));
});

test("admin changes flow into the generated resume without an independently maintained fact copy", async () => {
  const knowledge = structuredClone(buildAssistantKnowledge());
  knowledge.profile.name = "Updated Portfolio Owner";
  knowledge.profile.title = "Backend Engineer";
  knowledge.profile.updatedAt = "2026-12-01";
  knowledge.profile.links.website = "https://updated-portfolio.example/";
  knowledge.projects[0].title = "New Featured Project";
  knowledge.projects[0].caseStudyUrl = "https://updated-portfolio.example/projects/new-project";
  const result = await generateResume(knowledge);
  const pdf = await PDFDocument.load(result.pdfBytes, { updateMetadata: false });
  assert.equal(pdf.getAuthor(), "Updated Portfolio Owner");
  assert.equal(pdf.getModificationDate().toISOString(), "2026-12-01T00:00:00.000Z");
  assert.ok(result.text.includes("New Featured Project"));
  assert.ok(linkTargets(pdf).includes("https://updated-portfolio.example/projects/new-project"));
  assert.ok(linkTargets(pdf).includes("https://updated-portfolio.example/"));
});

test("longer employment history adds pages rather than silently discarding roles", async () => {
  const knowledge = structuredClone(buildAssistantKnowledge());
  const example = knowledge.profile.experience[0];
  knowledge.profile.experience = Array.from({ length: 30 }, (_, index) => ({
    ...example, id: `role-${index}`, company: `Company ${index + 1}`,
  }));
  const result = await generateResume(knowledge);
  assert.ok(result.pageCount > 2);
  assert.equal((await PDFDocument.load(result.pdfBytes)).getPageCount(), result.pageCount);
  for (let index = 1; index <= 30; index++) assert.ok(result.text.includes(`Company ${index} |`));
});
