import { projects } from "@/lib/projects";
import { profile } from "@/lib/profile";
import { upwork } from "@/lib/upwork";
import { absoluteUrl, contentUpdated, homeUrl } from "@/lib/site";

export const dynamic = "force-static";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function paragraphs(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function sentence(text) {
  const value = String(text).trim();
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function definition() {
  const years = profile.experience.flatMap((item) => [Number(item.startYear), Number(item.endYear)]).filter(Number.isFinite);
  const lastClientJob = upwork.completedWork.map((job) => job.endDate).filter(Boolean).sort().at(-1);
  const [year, month] = lastClientJob ? lastClientJob.split("-") : [];
  const article = /^[aeiou]/i.test(profile.title) ? "an" : "a";
  return `${profile.name} is ${article} ${profile.title} based in ${profile.location}, with software jobs from ${Math.min(...years)} to ${Math.max(...years)}`
    + `${lastClientJob ? ` and completed Upwork jobs through ${MONTHS[Number(month) - 1]} ${year}` : ""} (contact: <${profile.links.contact}>).`;
}

export function GET() {
  const faq = Array.isArray(profile.faq) ? profile.faq.filter((item) => item?.question && item?.answer) : [];
  const text = [
    `# ${profile.name}`,
    "",
    `> ${definition()}`,
    "",
    profile.summary,
    "",
    `- [Portfolio](${homeUrl})`,
    `- [Full profile in one Markdown file](${absoluteUrl("/llms-full.txt")}): the complete text of the site, with every case study and client review.`,
    `- [CV (PDF)](${absoluteUrl("/Lihon-Gebre-CV.pdf")})`,
    `- [CV (plain text)](${absoluteUrl("/Lihon-Gebre-CV.txt")})`,
    `- Last updated: ${contentUpdated}`,
    "",
    ...(faq.length ? [
      "## Questions and answers",
      "",
      ...faq.flatMap((item) => [`### ${item.question}`, "", ...paragraphs(item.answer).flatMap((answer) => [answer, ""])]),
    ] : []),
    "## Employment history",
    "",
    ...profile.experience.flatMap((item) => [
      `### ${item.company}: ${item.role} (${item.period})`,
      "",
      `[See this role on the portfolio](${absoluteUrl(`/#${item.id}`)})`,
      "",
      item.description,
      "",
      ...item.responsibilities.map((area) => `- ${area.title}: ${area.description}`),
      "",
    ]),
    "## Automation focus",
    "",
    `[Read on the portfolio](${absoluteUrl("/#about")})`,
    "",
    profile.automationFocus.summary,
    "",
    "## Client work on Upwork",
    "",
    `[Client work and reviews on the portfolio](${absoluteUrl("/#client-work")}). [Upwork profile](${upwork.source.profileUrl}).`,
    "",
    `Upwork profile on ${upwork.profile.snapshotDate}: ${upwork.profile.badge}, with ${upwork.profile.completedJobCount} of ${upwork.profile.totalJobCount} jobs completed. Clients left ${upwork.profile.writtenReviewCount} written reviews on the jobs listed here.`,
    "",
    ...upwork.completedWork.flatMap((job) => [
      `### ${job.title}`,
      `${job.period}. Rating ${job.rating}/${job.ratingScale}.${job.clientName ? ` Client: ${job.clientName}.` : ""}`,
      job.feedback ? `Feedback${job.feedbackExcerpt ? " (excerpt)" : ""}: ${job.feedbackExcerpt || job.feedback}` : "No written feedback.",
      `[Upwork record](${job.sourceUrl})`,
      "",
    ]),
    "## Projects",
    "",
    ...projects.map((project) => `- [${project.title}](${absoluteUrl(`/projects/${project.slug}`)}): ${sentence(project.description)}`
      + `${project.role ? ` Role: ${sentence(project.role)}` : ""}${project.sourceNote ? ` ${sentence(project.sourceNote)}` : ""}`),
    "",
    "## Portfolio assistant",
    "",
    `- [Ask the portfolio assistant](${absoluteUrl("/#assistant")}): a chat on the homepage that answers from the same records and links to the case studies.`,
    "",
    "## Professional profiles",
    "",
    `- [GitHub](${profile.links.github})`,
    `- [LinkedIn](${profile.links.linkedin})`,
    `- [Upwork](${upwork.source.profileUrl})`,
    "",
    "## Notes",
    "",
    "- Lihon maintains the records behind this index.",
    "- Project roles describe his part in each project, not employment by the product's company.",
    "- The full profile file ends with more reading notes.",
    "",
  ].join("\n");

  return new Response(text, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
