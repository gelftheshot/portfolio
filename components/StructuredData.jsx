import { projects } from "@/lib/projects";
import { profile } from "@/lib/profile";
import { upwork } from "@/lib/upwork";
import { absoluteUrl, contentUpdated, personId } from "@/lib/site";

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
            url: absoluteUrl("/"),
            image: absoluteUrl("/Lihongebre-professional-v1.png"),
            jobTitle: profile.title,
            description: profile.summary,
            homeLocation: { "@type": "Place", name: profile.location },
            sameAs: [profile.links.github, profile.links.linkedin, upwork.source.profileUrl],
            knowsAbout: ["AI engineering", "Backend engineering", "Infrastructure", "Full-stack development", "Workflow automation", "Retrieval-augmented generation", "APIs", "Python", "Next.js", "PostgreSQL"],
            hasOccupation: profile.experience.map((item) => ({
              "@type": "Role",
              "@id": absoluteUrl(`/#${item.id}`),
              name: `${item.role} — ${item.company}`,
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
            url: absoluteUrl("/"),
            name: profile.name + " — " + profile.title,
            inLanguage: "en",
            about: { "@id": personId },
            publisher: { "@id": personId },
            description: "Engineering portfolio with project case studies and an AI assistant that answers questions about Lihon's professional work and experience.",
          },
          {
            "@type": "ProfilePage",
            "@id": profileId,
            url: absoluteUrl("/"),
            name: profile.name + " — " + profile.title,
            description: "AI, backend, infrastructure, full-stack, and automation projects, with six engineering experience entries spanning 2016–2025 and an AI assistant for visitor questions.",
            dateModified: contentUpdated,
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
        ],
      }}
    />
  );
}
