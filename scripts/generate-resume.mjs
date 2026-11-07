#!/usr/bin/env node
/** Build the downloadable resume from the same public records as the website.
 * No Python, network access, private credentials, or runtime database is needed.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, PDFString, rgb } from "pdf-lib";
import { buildAssistantKnowledge } from "../lib/assistant-knowledge.js";
import selection from "../data/resume.json" with { type: "json" };

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STEM = "Lihon-Gebre-CV";
const LEGACY_STEM = "Lihon-Gebre-Resume";
const A4 = [595.28, 841.89];
const MARGIN = 42;
const TOP = 34;
const BOTTOM = 31;
const INK = rgb(0.08, 0.08, 0.08);
const MUTED = rgb(0.27, 0.27, 0.27);

// Standard Helvetica supports selectable Latin text. Keep punctuation simple and
// give a clear error for content that needs an additional embedded font, rather
// than silently omitting names or drawing replacement glyphs.
export function plain(value = "") {
  return String(value)
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, " ")
    .replace(/\u00b7/g, "|")
    .replace(/\u2026/g, "...")
    .replace(/\r\n?/g, "\n")
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "");
}

function monthYear(value) {
  const normalized = /^\d{4}-\d{2}$/.test(value || "") ? `${value}-01` : value;
  const date = new Date(`${String(normalized).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? plain(value) : new Intl.DateTimeFormat("en-US", {
    month: "short", year: "numeric", timeZone: "UTC",
  }).format(date);
}

function fixedDate(value) {
  const result = new Date(`${String(value || "").slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(result.valueOf()) ? new Date("1970-01-01T00:00:00.000Z") : result;
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) && !url.username && !url.password
      ? url.href : null;
  } catch { return null; }
}

/** Returns a PDF and its plain-text companion without changing any files. */
export async function generateResume(knowledge) {
  const { profile, contact, clientWork } = knowledge;
  const experience = selection.experienceIds.map((id) => {
    const record = profile.experience.find((item) => item.id === id);
    if (!record) throw new Error(`Selected CV experience is missing: ${id}`);
    return record;
  });
  const projects = selection.projects.map((item) => {
    const record = item.workId
      ? clientWork.completedWork.find((work) => work.id === item.workId)
      : knowledge.projects.find((project) => project.slug === item.slug);
    if (!record) throw new Error(`Selected CV project source is missing: ${item.workId || item.slug}`);
    return { ...record, ...item };
  });
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const updated = fixedDate(profile.updatedAt || knowledge.contentUpdated);
  pdf.setTitle(`${plain(profile.name)} - CV - ${plain(profile.title)}`);
  pdf.setAuthor(plain(profile.name));
  pdf.setSubject("AI, backend, and automation engineering resume");
  pdf.setCreator("Portfolio shared-data resume generator");
  pdf.setProducer("Portfolio shared-data resume generator");
  pdf.setCreationDate(updated);
  pdf.setModificationDate(updated);

  const styles = {
    name: { size: 24, leading: 26, bold: true, after: 3 },
    position: { size: 11.5, leading: 14, bold: true, after: 4 },
    contact: { size: 10.5, leading: 13, color: MUTED, after: 1 },
    proof: { size: 10.5, leading: 13, bold: true, before: 4, after: 4 },
    section: { size: 11, leading: 14, bold: true, before: 8, after: 4 },
    body: { size: 11, leading: 14, after: 2 },
    bullet: { size: 11, leading: 14, after: 1.5 },
    role: { size: 11, leading: 14, bold: true, before: 4, after: 2 },
    project: { size: 11, leading: 14, bold: true, before: 3, after: 1 },
    continued: { size: 11, leading: 15, bold: true, after: 2 },
  };
  const text = [];
  const width = A4[0] - MARGIN * 2;
  let page;
  let y;

  function measure(textValue, font, size) {
    try { return font.widthOfTextAtSize(textValue, size); }
    catch { throw new Error("Resume text needs a Latin transliteration or an embedded Unicode font before publishing."); }
  }

  function newPage(continuation = true) {
    page = pdf.addPage(A4);
    y = A4[1] - TOP;
    if (continuation) {
      paragraph(profile.name, "continued", { includeText: false });
      spacer(5);
    }
  }

  function ensureSpace(height) {
    if (y - height < BOTTOM) newPage();
  }

  function wrapRuns(runs, style, availableWidth = width) {
    const lines = [[]];
    let used = 0;
    for (const run of runs) {
      const font = run.bold || style.bold ? bold : normal;
      const normalized = plain(run.text);
      const pieces = normalized.match(/\n|[^\S\n]+|[^\s]+/g) || [];
      for (const piece of pieces) {
        if (piece === "\n") { lines.push([]); used = 0; continue; }
        if (!used && /^\s+$/.test(piece)) continue;
        const pieceWidth = measure(piece, font, style.size);
        if (used + pieceWidth > availableWidth && used > 0) { lines.push([]); used = 0; }
        if (!used && /^\s+$/.test(piece)) continue;
        // Very long URLs/identifiers still fit the text area without clipping.
        let part = "";
        for (const character of piece) {
          if (measure(part + character, font, style.size) + used > availableWidth && part) {
            lines.at(-1).push({ ...run, text: part, font });
            lines.push([]);
            used = 0;
            part = "";
          }
          part += character;
        }
        if (part) {
          lines.at(-1).push({ ...run, text: part, font });
          used += measure(part, font, style.size);
        }
      }
    }
    return lines;
  }

  function linkAnnotation(url, x, baseline, runWidth, size) {
    const href = safeUrl(url);
    if (!href || runWidth <= 0) return;
    const annotation = pdf.context.register(pdf.context.obj({
      Type: "Annot", Subtype: "Link", Rect: [x, baseline - 2, x + runWidth, baseline + size],
      Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFString.of(href) },
    }));
    page.node.addAnnot(annotation);
  }

  function paragraph(value, styleName = "body", options = {}) {
    const style = styles[styleName];
    const runs = Array.isArray(value) ? value : [{ text: value }];
    const indent = options.indent || 0;
    const lines = wrapRuns(runs, style, width - indent);
    ensureSpace((style.before || 0) + Math.min(lines.length, 2) * style.leading + (style.after || 0));
    y -= style.before || 0;
    for (const line of lines) {
      ensureSpace(style.leading);
      y -= style.leading;
      let x = MARGIN + indent;
      for (const run of line) {
        const runWidth = measure(run.text, run.font, style.size);
        page.drawText(run.text, { x, y, size: style.size, font: run.font, color: style.color || INK });
        if (run.url && safeUrl(run.url)) {
          linkAnnotation(run.url, x, y, runWidth, style.size);
        }
        x += runWidth;
      }
    }
    y -= style.after || 0;
    if (options.includeText !== false) text.push(plain(options.text || runs.map((run) => run.text).join("")));
  }

  function section(title) {
    ensureSpace(styles.section.before + styles.section.leading + styles.section.after + 35);
    paragraph(title.toUpperCase(), "section");
  }

  function spacer(height) { y -= height; }
  function keepTogether(lines, extra = 0) {
    const height = lines.reduce((sum, [value, styleName]) => {
      const style = styles[styleName];
      return sum + wrapRuns([{ text: value }], style).length * style.leading + (style.after || 0);
    }, extra);
    // Blocks taller than a page flow naturally instead of silently dropping data.
    ensureSpace(Math.min(height, 150));
  }

  newPage(false);
  paragraph(profile.name, "name");
  paragraph(/automation/i.test(profile.title) ? profile.title : `${profile.title} | Workflow Automation`, "position");
  paragraph([{ text: `${profile.location} | ` }, { text: contact.email, url: `mailto:${contact.email}` }], "contact");
  const links = profile.links;
  const linkLabel = (value) => new URL(value).host + new URL(value).pathname.replace(/\/$/, "");
  paragraph([
    { text: linkLabel(links.website), url: links.website },
    { text: " | " }, { text: linkLabel(links.github), url: links.github },
    { text: " | " }, { text: linkLabel(links.linkedin), url: links.linkedin },
  ], "contact");
  paragraph([
    { text: `${clientWork.profile.badge} on Upwork`, url: clientWork.source.profileUrl },
    { text: ` | ${clientWork.profile.completedJobCount} completed jobs | ${clientWork.profile.writtenReviewCount} written client reviews | CS, Addis Ababa University` },
  ], "proof");
  paragraph(profile.resumeSummary);

  section("Selected experience");
  const workYears = clientWork.completedWork.flatMap((work) => [work.startDate.slice(0, 4), work.endDate.slice(0, 4)]).sort();
  paragraph(`${selection.clientWork.title} | Upwork | Selected engagements, ${workYears[0]} - ${workYears.at(-1)}`, "role");
  for (const bullet of selection.clientWork.bullets) paragraph(`- ${bullet}`, "bullet", { indent: 9 });
  for (const item of experience) {
    // Data periods use an unspaced en dash ("2023–2025"); the CV keeps its spaced hyphen ("2023 - 2025").
    const title = `${item.role} | ${item.company} | ${item.period.replace(/\s*[\u2013\u2014]\s*/g, " - ")}`;
    const bullets = item.resumeBullets?.length ? item.resumeBullets : [item.description];
    keepTogether([[title, "role"], ...bullets.map((bullet) => [`- ${bullet}`, "bullet"])], 4);
    text.push("");
    paragraph(title, "role");
    for (const bullet of bullets) paragraph(`- ${bullet}`, "bullet", { indent: 9 });
  }

  section("Selected projects");
  for (const project of projects) {
    const period = project.workId
      ? `${monthYear(project.startDate)} - ${monthYear(project.endDate)}`
      : "Public source";
    const title = `${project.title} | ${period}`;
    keepTogether([[title, "project"], [project.description, "body"]], 4);
    text.push("");
    paragraph(title, "project");
    paragraph(project.description);
    if (project.github) paragraph([{ text: linkLabel(project.github), url: project.github }], "contact");
  }

  section("Education & training");
  const education = profile.education.map((item) => `${item.degree} - ${item.institution}`).join(" | ");
  paragraph(education);
  const credentials = profile.certifications || [];
  const credential = (pattern) => credentials.find((item) => pattern.test(item.name));
  const essentials = credential(/^n8n101/);
  const integrations = credential(/^n8n102/);
  const aws = credential(/^AWS Cloud Practitioner Essentials/);
  const alx = credential(/^ALX Software Engineering/);
  const training = (item, label) => item ? `${label} (${monthYear(item.issued)})` : null;
  const n8nLine = [training(essentials, "n8n101 Essentials"), training(integrations, "n8n102 Integrations")].filter(Boolean);
  const otherLine = [training(aws, "AWS Cloud Practitioner Essentials course"), training(alx, "ALX Backend program")].filter(Boolean);
  if (n8nLine.length) paragraph(n8nLine.join(" | "));
  if (otherLine.length) paragraph(otherLine.join(" | "));

  const pages = pdf.getPages();
  pages.forEach((item, index) => {
    const number = `${index + 1} / ${pages.length}`;
    item.drawText(number, { x: A4[0] - MARGIN - normal.widthOfTextAtSize(number, 9), y: 23, size: 9, font: normal, color: MUTED });
  });
  return {
    pdfBytes: await pdf.save({ useObjectStreams: false, addDefaultPage: false }),
    text: `${text.join("\n").trim()}\n`,
    pageCount: pages.length,
  };
}

export async function writeResume(knowledge = buildAssistantKnowledge(), root = ROOT) {
  const result = await generateResume(knowledge);
  const master = resolve(root, "output", "pdf");
  const publicDirectory = resolve(root, "public");
  await Promise.all([mkdir(master, { recursive: true }), mkdir(publicDirectory, { recursive: true })]);
  for (const destination of [master, publicDirectory]) {
    for (const stem of [STEM, LEGACY_STEM]) {
      await writeFile(resolve(destination, `${stem}.pdf`), result.pdfBytes);
      await writeFile(resolve(destination, `${stem}.txt`), result.text, "utf8");
    }
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await writeResume();
  console.log(JSON.stringify({
    pages: result.pageCount, pdfBytes: result.pdfBytes.length, textCharacters: result.text.length,
    publicPdf: `public/${STEM}.pdf`, publicText: `public/${STEM}.txt`,
  }, null, 2));
}
