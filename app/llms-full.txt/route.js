import { profile } from "@/lib/profile";
import { upwork } from "@/lib/upwork";
import { CONTACT_EMAIL } from "@/lib/contact";
import { absoluteUrl, contentUpdated, homeUrl } from "@/lib/site";
import { buildAssistantKnowledge } from "@/lib/assistant-knowledge";

export const dynamic = "force-static";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function paragraphs(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function sentence(text) {
  const value = String(text).trim();
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function monthYear(isoDate) {
  const [year, month] = isoDate.split("-");
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

function opening() {
  const years = profile.experience.flatMap((item) => [Number(item.startYear), Number(item.endYear)]).filter(Number.isFinite);
  const lastClientJob = upwork.completedWork.map((job) => job.endDate).filter(Boolean).sort().at(-1);
  const article = /^[aeiou]/i.test(profile.title) ? "an" : "a";
  return `${profile.name} is ${article} ${profile.title} in ${profile.location}, with software roles from ${Math.min(...years)} to ${Math.max(...years)}`
    + `${lastClientJob ? ` and Upwork client work through ${monthYear(lastClientJob)}` : ""} (contact form: <${profile.links.contact}>).`;
}

function faqLines() {
  const items = Array.isArray(profile.faq) ? profile.faq.filter((item) => item?.question && item?.answer) : [];
  if (!items.length) return [];
  return [
    "## Questions and answers",
    "",
    ...items.flatMap((item) => [`### ${item.question}`, "", ...paragraphs(item.answer).flatMap((answer) => [answer, ""])]),
  ];
}

function projectLines(project, ownNotes) {
  const notes = ownNotes.get(project.slug) || [];
  return [
    `### ${project.title}`,
    "",
    `Case study: ${absoluteUrl(`/projects/${project.slug}`)}`,
    `Category: ${project.category}`,
    ...(project.role ? [`Role: ${project.role}`] : []),
    ...(project.sourceNote ? [sentence(project.sourceNote)] : []),
    "",
    project.description,
    "",
    ...paragraphs(project.detail).flatMap((paragraph) => [paragraph, ""]),
    ...(project.caseStudy ? [
      "#### Role and scope",
      "",
      project.caseStudy.roleContext,
      "",
      "#### Project challenge",
      "",
      project.caseStudy.challenge,
      "",
      "#### Engineering context",
      "",
      project.caseStudy.engineeringContext,
      ...(project.caseStudy.architecture ? [
        `Explanatory diagram: ${absoluteUrl(project.caseStudy.architecture.src)}`,
        project.caseStudy.architecture.alt,
        project.caseStudy.architecture.caption,
      ] : []),
      "",
      "#### Evidence scope",
      "",
      project.caseStudy.evidenceSummary,
      "",
    ] : []),
    ...(project.tags?.length ? [`Technical focus: ${project.tags.join(", ")}.`, ""] : []),
    ...(project.stack ? [`Technology: ${paragraphs(project.stack).join(", ")}`, ""] : []),
    ...(project.website ? [`Website: ${project.website}`] : []),
    ...(project.github ? [`Source repository: ${project.github}`] : []),
    "",
    ...(project.technicalSections || []).flatMap((section) => [
      `#### ${section.title}`,
      "",
      ...paragraphs(section.body).flatMap((paragraph) => [paragraph, ""]),
      ...(section.bullets || []).map((bullet) => `- ${bullet}`),
      "",
    ]),
    ...(project.sources?.length ? [
      "#### References",
      "",
      ...project.sources.flatMap((source) => [
        source.url ? `- [${source.title}](${source.url})` : `- ${source.title}`,
        ...(source.note ? [`  ${source.note}`] : []),
      ]),
      "",
    ] : []),
    ...(notes.length ? ["#### Source notes", "", ...notes.map((line) => `- ${line}`), ""] : []),
  ];
}

/** Maps each project slug to the boundary lines written for that project alone.
 * Boundary lines shared by several projects are omitted; the reading notes cover them. */
function projectNotes(projects) {
  const uses = new Map();
  for (const line of projects.flatMap((project) => project.sourceBoundaries || [])) uses.set(line, (uses.get(line) || 0) + 1);
  return new Map(projects.map((project) => [project.slug, (project.sourceBoundaries || []).filter((line) => uses.get(line) === 1)]));
}

export function GET() {
  const knowledge = buildAssistantKnowledge();
  const notes = projectNotes(knowledge.projects);
  const text = [
    `# ${profile.name}`,
    "",
    opening(),
    "",
    `Portfolio: ${homeUrl}`,
    `CV (PDF): ${absoluteUrl("/Lihon-Gebre-CV.pdf")}`,
    `CV (text): ${absoluteUrl("/Lihon-Gebre-CV.txt")}`,
    `Last updated: ${contentUpdated}`,
    "",
    "## Summary",
    "",
    profile.summary,
    "",
    ...(profile.introduction || profile.about ? [
      "In his own words:",
      "",
      ...[profile.introduction, profile.about].filter(Boolean).flatMap((quote) => [`> ${quote}`, ">"]).slice(0, -1),
      "",
    ] : []),
    "Main areas of work:",
    "",
    ...profile.professionalFocus.map((focus) => `- ${focus}`),
    "",
    ...faqLines(),
    "## Skills",
    "",
    ...Object.entries(profile.skills).flatMap(([category, skills]) => [
      `### ${category}`,
      "",
      ...skills.map((skill) => `- ${skill}`),
      "",
    ]),
    "## Engineering expertise",
    "",
    ...profile.expertise.flatMap((area) => [
      `### ${area.title}`,
      "",
      area.description,
      `Tools and focus: ${area.tools}`,
      "",
    ]),
    "## Automation focus",
    "",
    profile.automationFocus.summary,
    "",
    ...profile.automationFocus.focusAreas.map((area) => `- ${area}`),
    "",
    ...profile.automationFocus.projectEvidence.map((project) => `- [${project.title}](${absoluteUrl(`/projects/${project.slug}`)}): ${project.description}`),
    "",
    "## Employment history",
    "",
    ...profile.experience.flatMap((item) => [
      `### ${item.company}: ${item.role}`,
      "",
      `Period: ${item.period}`,
      `On the portfolio: ${absoluteUrl(`/#${item.id}`)}`,
      "",
      item.description,
      "",
      ...(item.tools ? [`Tools: ${item.tools}`, ""] : []),
      ...item.responsibilities.flatMap((area) => [
        `#### ${area.title}`,
        "",
        area.description,
        "",
      ]),
      `Engineering focus: ${item.focusAreas.join(", ")}.`,
      "",
    ]),
    "## Education",
    "",
    ...profile.education.map((item) => `- ${item.degree}, ${item.institution}`),
    "",
    "## Certifications and training",
    "",
    ...(profile.certifications || []).flatMap((credential) => [
      `### ${credential.name}`,
      "",
      `Provider: ${credential.provider}. Issued: ${credential.issued}.${credential.expires ? ` Expires: ${credential.expires}.` : ""}${credential.credentialId ? ` Credential ID: ${credential.credentialId}.` : ""}`,
      `Credential link: ${credential.url}`,
      "",
    ]),
    "## Languages",
    "",
    ...profile.languages.map((item) => `- ${item.language}: ${item.proficiency}`),
    "",
    "## Portfolio projects",
    "",
    ...knowledge.projects.flatMap((project) => projectLines(project, notes)),
    "## Client work on Upwork",
    "",
    `Profile: ${upwork.source.profileUrl}`,
    `Upwork headline: ${upwork.profile.title}`,
    "",
    `As of ${upwork.profile.snapshotDate} the profile is ${upwork.profile.badge}, with ${upwork.profile.completedJobCount} of ${upwork.profile.totalJobCount} jobs completed. The completed jobs below include ${upwork.profile.writtenReviewCount} written reviews.`,
    "",
    ...upwork.completedWork.flatMap((job) => [
      `### ${job.title}`,
      "",
      `Period: ${job.period}`,
      ...(job.clientName ? [`Client: ${job.clientName} (Upwork)`] : []),
      `Rating: ${job.rating} out of ${job.ratingScale}`,
      ...(job.feedback ? ["", "Client feedback:", job.feedback] : ["Rating only, with no written feedback."]),
      `Source: ${job.sourceUrl}`,
      "",
    ]),
    "## Contact and links",
    "",
    `- Contact form: ${profile.links.contact}`,
    `- Email: ${CONTACT_EMAIL}`,
    `- GitHub: ${profile.links.github}`,
    `- LinkedIn: ${profile.links.linkedin}`,
    `- Upwork: ${upwork.source.profileUrl}`,
    "",
    "## Reading notes",
    "",
    "- Lihon keeps these records. The website and its chat assistant use the same ones.",
    "- Credential links open the record on the platform that issued each one.",
    "- Course completions are training. They are not exam certifications or university degrees.",
    "- Employment dates appear as recorded, mostly as years.",
    "- A project role names Lihon's part in that project. It does not mean the product's company employed him, or that he built the whole system alone.",
    "- Some project covers are generated concept art, not screenshots of the product. The diagrams explain a design; they do not show a running system.",
    "- Client feedback is quoted exactly as written on Upwork, spelling included. A rating with no written feedback is not a testimonial.",
    `- Upwork figures date from ${upwork.profile.snapshotDate} and may have changed.`,
    "- Where this file gives no figure or date, none is recorded.",
    "",
  ].join("\n");

  return new Response(text, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
