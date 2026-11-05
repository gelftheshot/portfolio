#!/usr/bin/env node
/** Build the downloadable resume from the same public records as the website.
 * No Python, network access, private credentials, or runtime database is needed.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, PDFString, rgb } from "pdf-lib";
import { buildAssistantKnowledge } from "../lib/assistant-knowledge.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STEM = "Lihon-Gebre-Resume";
const A4 = [595.28, 841.89];
const MARGIN = 43;
const BOTTOM = 49;
const INK = rgb(0.08, 0.08, 0.08);
const MUTED = rgb(0.27, 0.27, 0.27);
const RULE = rgb(0.76, 0.76, 0.76);
const SELECTED_JOBS = ["debug-502", "langchain-langgraph-saas", "knowledge-based-rag-chatbot", "ai-agent-development"];

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

function firstSentences(value, count = 1) {
  return plain(value).split(/(?<=[.!?])\s+(?=[A-Z])/).slice(0, count).join(" ");
}

function monthYear(value) {
  const normalized = /^\d{4}-\d{2}$/.test(value || "") ? `${value}-01` : value;
  const date = new Date(`${String(normalized).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? plain(value) : new Intl.DateTimeFormat("en-US", {
    month: "short", year: "numeric", timeZone: "UTC",
  }).format(date);
}

function snapshotDate(value) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? plain(value) : new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
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
  const { profile, clientWork, contact } = knowledge;
  const projects = knowledge.projects.slice(0, 3);
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const updated = fixedDate(profile.updatedAt || knowledge.contentUpdated);
  pdf.setTitle(`${plain(profile.name)} - Resume`);
  pdf.setAuthor(plain(profile.name));
  pdf.setSubject("AI, backend, and automation engineering resume");
  pdf.setCreator("Portfolio shared-data resume generator");
  pdf.setProducer("Portfolio shared-data resume generator");
  pdf.setCreationDate(updated);
  pdf.setModificationDate(updated);

  const styles = {
    name: { size: 25, leading: 29, bold: true, after: 3 },
    position: { size: 11.5, leading: 15, after: 7 },
    contact: { size: 8.7, leading: 12, color: MUTED },
    section: { size: 10, leading: 13, bold: true, before: 13, after: 7 },
    body: { size: 9.4, leading: 13, after: 4 },
    compact: { size: 8.9, leading: 12, after: 4 },
    role: { size: 9.5, leading: 13, bold: true, after: 3 },
    small: { size: 8.2, leading: 11, color: MUTED },
    continued: { size: 16, leading: 20, bold: true, after: 5 },
  };
  const text = [];
  const width = A4[0] - MARGIN * 2;
  const position = /automation/i.test(profile.title) ? profile.title : `${profile.title} | Workflow Automation`;
  let page;
  let y;

  function measure(textValue, font, size) {
    try { return font.widthOfTextAtSize(textValue, size); }
    catch { throw new Error("Resume text needs a Latin transliteration or an embedded Unicode font before publishing."); }
  }

  function newPage(continuation = true) {
    page = pdf.addPage(A4);
    y = A4[1] - 36;
    if (continuation) {
      paragraph(profile.name, "continued", { includeText: false });
      paragraph(position, "contact", { includeText: false });
    }
  }

  function ensureSpace(height) {
    if (y - height < BOTTOM) newPage();
  }

  function wrapRuns(runs, style) {
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
        if (used + pieceWidth > width && used > 0) { lines.push([]); used = 0; }
        if (!used && /^\s+$/.test(piece)) continue;
        // Very long URLs/identifiers still fit the text area without clipping.
        let part = "";
        for (const character of piece) {
          if (measure(part + character, font, style.size) + used > width && part) {
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
    const lines = wrapRuns(runs, style);
    ensureSpace((style.before || 0) + Math.min(lines.length, 2) * style.leading + (style.after || 0));
    y -= style.before || 0;
    for (const line of lines) {
      ensureSpace(style.leading);
      y -= style.leading;
      let x = MARGIN;
      for (const run of line) {
        const runWidth = measure(run.text, run.font, style.size);
        page.drawText(run.text, { x, y, size: style.size, font: run.font, color: style.color || INK });
        if (run.url && safeUrl(run.url)) {
          linkAnnotation(run.url, x, y, runWidth, style.size);
          if (run.text.trim()) page.drawLine({ start: { x, y: y - 1.4 }, end: { x: x + runWidth, y: y - 1.4 }, thickness: 0.35, color: MUTED });
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
  paragraph(position, "position");
  paragraph([{ text: `${profile.location} | ` }, { text: contact.email, url: `mailto:${contact.email}` }], "contact");
  const links = profile.links;
  const websiteLabel = new URL(links.website).host;
  const githubLabel = new URL(links.github).pathname.replace(/^\//, "");
  const linkedInLabel = new URL(links.linkedin).pathname.replace(/^\/in\//, "").replace(/\/$/, "");
  paragraph([
    { text: "Portfolio: " }, { text: websiteLabel, url: links.website },
    { text: "  |  GitHub: " }, { text: githubLabel, url: links.github },
    { text: "  |  LinkedIn: " }, { text: linkedInLabel, url: links.linkedin },
  ], "contact", { text: `Portfolio: ${links.website}\nGitHub: ${links.github}\nLinkedIn: ${links.linkedin}` });
  const upworkUrl = clientWork.source.profileUrl;
  paragraph([{ text: "Upwork: " }, { text: clientWork.profile.displayName, url: upworkUrl }], "contact", { text: `Upwork: ${upworkUrl}` });
  spacer(9);
  page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, color: INK, thickness: 0.7 });

  section("Professional profile");
  paragraph(firstSentences(profile.summary, 2));
  section("Technical skills");
  for (const [category, skills] of Object.entries(profile.skills)) {
    paragraph([{ text: `${category}: `, bold: true }, { text: skills.join(", ") }], "compact");
  }
  const automation = profile.automationFocus?.focusAreas || [];
  if (automation.length) paragraph([{ text: "Automation: ", bold: true }, { text: automation.join(", ") }], "compact");

  section("Employment history");
  for (const item of profile.experience) {
    const title = `${item.company} | ${item.role} | ${item.period}`;
    const description = firstSentences(item.description);
    const focus = `Focus: ${(item.focusAreas || []).slice(0, 4).join(", ")}`;
    keepTogether([[title, "role"], [description, "compact"], [focus, "small"]], 8);
    text.push("");
    paragraph(title, "role"); paragraph(description, "compact"); paragraph(focus, "small"); spacer(8);
  }

  newPage();
  const jobs = clientWork.completedWork || [];
  if (jobs.length) {
    const years = jobs.flatMap((job) => [job.startDate.slice(0, 4), job.endDate.slice(0, 4)]).sort();
    section(`Selected client work - Upwork | ${years[0]}-${years.at(-1)}`);
    const snapshot = clientWork.profile.snapshotDate || clientWork.source.retrievedAt;
    paragraph(`${clientWork.profile.completedJobCount} public completed jobs; ${clientWork.profile.writtenReviewCount} written reviews. ${clientWork.profile.badge}; ${clientWork.profile.jobSuccessPercent}% Job Success (profile snapshot: ${snapshotDate(snapshot)}).`, "compact");
    paragraph([{ text: "Source: " }, { text: "Public Upwork profile and completed work", url: upworkUrl }], "small", { text: `Source: ${upworkUrl}` });
    spacer(8);
    const priority = SELECTED_JOBS.map((id) => jobs.find((job) => job.id === id)).filter(Boolean);
    const selected = [...priority, ...jobs.filter((job) => !SELECTED_JOBS.includes(job.id))].slice(0, 4);
    selected.sort((a, b) => b.endDate.localeCompare(a.endDate));
    for (const job of selected) {
      const period = `${monthYear(job.startDate)} - ${monthYear(job.endDate)}`;
      const client = job.clientName ? `Client account: ${job.clientName}` : "Upwork client";
      const detail = `${period} | ${client} | Client rating: ${job.rating}/${job.ratingScale}`;
      keepTogether([[job.title, "role"], [detail, "compact"]], 7);
      text.push(""); paragraph(job.title, "role"); paragraph(detail, "compact"); spacer(7);
    }
  }

  section("Featured portfolio projects");
  for (const project of projects) {
    const caseUrl = project.caseStudyUrl || `${links.website.replace(/\/$/, "")}/projects/${project.slug}`;
    const role = `Role: ${project.role || profile.title}`;
    keepTogether([[project.title, "role"], [role, "small"], [project.description, "body"], ["Read engineering case study", "small"]], 10);
    text.push(""); paragraph([{ text: project.title, url: caseUrl }], "role");
    paragraph(role, "small"); paragraph(project.description);
    paragraph([{ text: "Read engineering case study", url: caseUrl }], "small", { text: `Case study: ${caseUrl}` });
    spacer(10);
  }

  const certifications = profile.certifications || [];
  if (certifications.length) {
    section("Training and credentials");
    for (const credential of certifications) {
      const title = credential.name || credential.title;
      if (!title) continue;
      const metadata = [credential.provider || credential.issuer, credential.issued ? monthYear(credential.issued) : null].filter(Boolean);
      paragraph([{ text: title, url: credential.url }, { text: metadata.length ? ` | ${metadata.join(" | ")}` : "" }], "compact");
      if (credential.url) text.push(`Credential: ${credential.url}`);
    }
  }
  if (profile.education.length) {
    section("Education");
    for (const item of profile.education) paragraph(`${item.degree} | ${item.institution}`, "compact");
  }
  if (profile.languages.length) {
    section("Languages");
    paragraph(profile.languages.map((item) => `${item.language}: ${item.proficiency}`).join(" | "), "compact");
  }

  const pages = pdf.getPages();
  pages.forEach((item, index) => {
    item.drawLine({ start: { x: MARGIN, y: 30 }, end: { x: A4[0] - MARGIN, y: 30 }, color: RULE, thickness: 0.4 });
    item.drawText(plain(profile.name), { x: MARGIN, y: 18, size: 7.5, font: normal, color: MUTED });
    const number = `${index + 1} / ${pages.length}`;
    item.drawText(number, { x: A4[0] - MARGIN - normal.widthOfTextAtSize(number, 7.5), y: 18, size: 7.5, font: normal, color: MUTED });
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
    await writeFile(resolve(destination, `${STEM}.pdf`), result.pdfBytes);
    await writeFile(resolve(destination, `${STEM}.txt`), result.text, "utf8");
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
