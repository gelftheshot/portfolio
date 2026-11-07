import { projects } from "@/lib/projects";
import { profile } from "@/lib/profile";
import { upwork } from "@/lib/upwork";
import { CONTACT_EMAIL } from "@/lib/contact";
import { absoluteUrl, contentUpdated, homeUrl, personId, siteCreated } from "@/lib/site";

// Public repositories that hold the code for a portfolio project. Other project repos are left out on purpose.
const publicSourceRepos = new Set([
  "https://github.com/gelftheshot/academic-advisor-ai",
  "https://github.com/gelftheshot/ai-customer-support",
  "https://github.com/gelftheshot/inventory-management-app",
]);

export function sourceCodeNode(project) {
  const repo = project.github?.replace(/\/+$/, "");
  if (!repo || !publicSourceRepos.has(repo)) return null;
  return {
    "@type": "SoftwareSourceCode",
    "@id": absoluteUrl(`/projects/${project.slug}#source-code`),
    name: project.title,
    description: project.description,
    codeRepository: repo,
    url: repo,
    programmingLanguage: "JavaScript",
    author: { "@id": personId },
    subjectOf: { "@id": absoluteUrl(`/projects/${project.slug}#case-study`) },
  };
}

export default function StructuredData({ data }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

export function HomeStructuredData() {
  const profileId = absoluteUrl("/#profile");
  const websiteId = absoluteUrl("/#website");

  return (
    <StructuredData
      data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Person",
            "@id": personId,
            name: profile.name,
            url: homeUrl,
            alternateName: ["gelftheshot", "lihongebre"],
            image: absoluteUrl("/Lihongebre-professional-v1.png"),
            jobTitle: profile.title,
            description: profile.summary,
            email: `mailto:${CONTACT_EMAIL}`,
            address: { "@type": "PostalAddress", addressLocality: "Addis Ababa", addressCountry: "ET" },
            homeLocation: { "@type": "Place", name: profile.location },
            sameAs: [profile.links.github, profile.links.linkedin, upwork.source.profileUrl],
            knowsAbout: ["AI engineering", "Backend engineering", "Infrastructure", "Full-stack development", "Workflow automation", "Retrieval-augmented generation", "APIs", "Python", "Next.js", "PostgreSQL"],
            hasCredential: profile.certifications.map((credential) => ({
              "@type": "EducationalOccupationalCredential",
              name: credential.name,
              url: credential.url,
              credentialCategory: "Training completion",
              publisher: { "@type": "Organization", name: credential.provider },
              ...(credential.credentialId ? { identifier: credential.credentialId } : {}),
            })),
            hasOccupation: profile.experience.map((item) => ({
              "@type": "Role",
              "@id": absoluteUrl(`/#${item.id}`),
              name: `${item.role} at ${item.company}`,
              roleName: item.role,
              startDate: item.startYear,
              endDate: item.endYear,
              url: absoluteUrl(`/#${item.id}`),
              hasOccupation: {
                "@type": "Occupation",
                name: item.role,
                description: [item.description, ...item.responsibilities.map((area) => `${area.title}: ${area.description}`)].join(" "),
                skills: item.focusAreas,
              },
            })),
          },
          {
            "@type": "WebSite",
            "@id": websiteId,
            url: homeUrl,
            name: `${profile.name} | ${profile.title}`,
            inLanguage: "en",
            about: { "@id": personId },
            publisher: { "@id": personId },
            description: "Engineering portfolio with project case studies and an AI assistant that answers questions about Lihon's professional work and experience.",
          },
          {
            "@type": "ProfilePage",
            "@id": profileId,
            url: homeUrl,
            name: `${profile.name} | ${profile.title}`,
            description: "AI, backend, infrastructure, full-stack, and automation projects, with six engineering experience entries spanning 2016–2025 and an AI assistant for visitor questions.",
            dateCreated: siteCreated,
            ...(contentUpdated ? { dateModified: contentUpdated } : {}),
            inLanguage: "en",
            isPartOf: { "@id": websiteId },
            mainEntity: { "@id": personId },
          },
          {
            "@type": "ItemList",
            "@id": absoluteUrl("/#selected-projects"),
            name: "Selected engineering projects",
            numberOfItems: projects.length,
            itemListElement: projects.map((project, index) => ({
              "@type": "ListItem",
              position: index + 1,
              item: {
                "@type": "CreativeWork",
                "@id": absoluteUrl(`/projects/${project.slug}#case-study`),
                url: absoluteUrl(`/projects/${project.slug}`),
                name: project.title,
                description: `${project.role || "Software engineering"} portfolio project. ${project.description}`,
                image: absoluteUrl(project.images[0]),
                author: { "@id": personId },
                keywords: project.tags,
                genre: project.category,
              },
            })),
          },
          {
            "@type": "ItemList",
            "@id": absoluteUrl("/#client-work"),
            name: "Completed Upwork client work and feedback",
            numberOfItems: upwork.completedWork.length,
            itemListElement: upwork.completedWork.map((job, index) => ({
              "@type": "ListItem",
              position: index + 1,
              item: {
                "@type": "CreativeWork",
                "@id": absoluteUrl(`/#client-work-${job.id}`),
                url: absoluteUrl(`/#client-work-${job.id}`),
                name: job.title,
                ...(job.clientName ? { description: `Completed client work for ${job.clientName} on Upwork.` } : {}),
                creator: { "@id": personId },
                temporalCoverage: `${job.startDate}/${job.endDate}`,
                isBasedOn: job.sourceUrl,
                ...(job.rating ? {
                  review: {
                    "@type": "Review",
                    url: job.sourceUrl,
                    ...(job.feedback ? { reviewBody: job.feedbackExcerpt || job.feedback } : {}),
                    reviewRating: { "@type": "Rating", ratingValue: job.rating, bestRating: job.ratingScale, worstRating: 1 },
                  },
                } : {}),
              },
            })),
          },
          ...projects.map(sourceCodeNode).filter(Boolean),
        ],
      }}
    />
  );
}
