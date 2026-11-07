import { projects } from "@/lib/projects";
import { profile } from "@/lib/profile";
import { upwork } from "@/lib/upwork";
import { absoluteUrl, contentUpdated } from "@/lib/site";

export const dynamic = "force-static";

export function GET() {
  const text = [
    `# ${profile.name}`,
    "",
    `> ${profile.title} based in ${profile.location}. This optional index points to public portfolio content and project descriptions.`,
    "",
    `Portfolio: ${absoluteUrl("/")}`,
    `Content updated: ${contentUpdated}`,
    `Résumé PDF: ${absoluteUrl("/Lihon-Gebre-CV.pdf")}`,
    `Résumé text: ${absoluteUrl("/Lihon-Gebre-CV.txt")}`,
    "",
    profile.summary,
    "",
    "## Complete public profile in one fetch",
    "",
    `- [Full public portfolio text](${absoluteUrl("/llms-full.txt")}): Professional summary, skills, education, languages, employment responsibilities, every project and its technical descriptions, completed client work with feedback, source references, and contact links.`,
    "",
    "## Automation focus",
    "",
    `- [Automation focus](${absoluteUrl("/#about")}): ${profile.automationFocus.summary}`,
    "",
    "## Employment history",
    "",
    ...profile.experience.flatMap((item) => [
      `### ${item.role} — ${item.company} (${item.period})`,
      "",
      `[View this role](${absoluteUrl(`/#${item.id}`)})`,
      item.description,
      ...(item.scopeNote ? [item.scopeNote] : []),
      "",
      ...item.responsibilities.map((area) => `- ${area.title}: ${area.description}`),
      "",
      `Engineering focus: ${item.focusAreas.join(", ")}.`,
      "",
    ]),
    "",
    "## Completed client work and feedback",
    "",
    `[Client work and reviews](${absoluteUrl("/#client-work")})`,
    `Source: [Upwork profile](${upwork.source.profileUrl}); snapshot retrieved ${upwork.source.retrievedAt}.`,
    `Selected collection: ${upwork.profile.completedJobCount} completed jobs and ${upwork.profile.writtenReviewCount} written client reviews, checked ${upwork.source.retrievedAt}.`,
    `Aggregate profile indicators checked ${upwork.profile.snapshotDate}: ${upwork.profile.badge}, ${upwork.profile.totalJobCount} jobs, ${upwork.profile.feedbackEntryCount} client feedback entries. Feedback entries are not necessarily written reviews.`,
    "",
    ...upwork.completedWork.flatMap((job) => [
      `### ${job.title}`,
      `${job.period}. Client rating: ${job.rating}/${job.ratingScale}.`,
      ...(job.clientName ? [`Upwork client account: ${job.clientName}.`] : []),
      ...(job.feedback ? [`Client feedback${job.feedbackExcerpt ? " (excerpt)" : ""}: ${job.feedbackExcerpt || job.feedback}`] : ["Client rating provided without written feedback."]),
      `[View source](${job.sourceUrl})`,
      "",
    ]),
    "## Portfolio AI assistant",
    "",
    `- [Ask the portfolio assistant](${absoluteUrl("/#assistant")}): Ask questions about Lihon's engineering approach, listed experience, and projects. Answers use the shared professional profile and project records, with links to relevant case studies.`,
    "",
    "## Professional profiles",
    "",
    `- [GitHub](${profile.links.github})`,
    `- [LinkedIn](${profile.links.linkedin})`,
    `- [Upwork](${upwork.source.profileUrl})`,
    "",
    "## Projects",
    "",
    ...projects.flatMap((project) => [
      `- [${project.title}](${absoluteUrl(`/projects/${project.slug}`)}): ${project.role || "Software engineering"}. ${project.description}`,
    ]),
    "",
    "The linked pages contain project context, technical descriptions, and references. Listed roles do not establish ownership of every product feature. The featured overviews separate product challenges, engineering context, and evidence scope; individual deliverables, dates, and measured results remain unspecified unless explicitly documented. Explanatory diagrams and concept artwork are illustrations, not proof of production behavior.",
    "",
  ].join("\n");

  return new Response(text, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
