import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import StructuredData, { sourceCodeNode } from "@/components/StructuredData";
import { projects } from "@/lib/projects";
import { profile } from "@/lib/profile";
import { absoluteUrl, contentUpdated, homeUrl, personId } from "@/lib/site";
import "../project.css";
import "../case-evidence.css";

export const dynamicParams = false;

function findProject(slug) {
  return projects.find((project) => project.slug === slug);
}

function paragraphs(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function generateStaticParams() {
  return projects.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const project = findProject(slug);
  if (!project) return {};

  const title = `${project.title} — Engineering Case Study | Lihon Gebre`;
  const url = absoluteUrl(`/projects/${project.slug}`);

  // og:image and twitter:image come from ./opengraph-image.jsx (1200x630 PNG with width, height, type and alt).
  // Setting `images` here would override that file, so neither block lists one.
  return {
    title: { absolute: title },
    description: project.description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: project.description,
      url,
      type: "article",
      siteName: "Lihon Gebre",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: project.description,
    },
  };
}

export default async function ProjectPage({ params }) {
  const { slug } = await params;
  const project = findProject(slug);
  if (!project) notFound();

  const projectIndex = projects.findIndex((item) => item.slug === project.slug);
  const previousProject = projects[projectIndex - 1];
  const nextProject = projects[projectIndex + 1];
  const canonical = absoluteUrl(`/projects/${project.slug}`);
  const images = project.images || [];
  const sections = project.technicalSections || [];
  const sources = project.sources || [];
  const caseStudy = project.caseStudy;
  const lastModified = project.updatedAt || contentUpdated;
  const sourceCode = sourceCodeNode(project);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CreativeWork",
        "@id": `${canonical}#case-study`,
        name: `${project.title} — Engineering Case Study`,
        url: canonical,
        description: project.description,
        author: { "@type": "Person", "@id": personId, name: profile.name, url: homeUrl },
        inLanguage: "en",
        genre: "Software engineering case study",
        ...(lastModified ? { dateModified: lastModified } : {}),
        keywords: project.tags || [],
        ...(images.length ? { image: images.map((image) => absoluteUrl(image)) } : {}),
        about: {
          "@type": "SoftwareApplication",
          name: project.title,
          description: project.description,
          applicationCategory: project.category,
          ...(project.website ? { url: project.website } : {}),
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
        ...(sources.length ? {
          citation: sources.map((source) => ({
            "@type": "CreativeWork",
            name: source.title,
            ...(source.url ? { url: source.url } : {}),
          })),
        } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Selected work", item: absoluteUrl("/#work") },
          { "@type": "ListItem", position: 2, name: project.title, item: canonical },
        ],
      },
      ...(sourceCode ? [sourceCode] : []),
    ],
  };

  return (
    <main id="main-content" className="case-page">
      <StructuredData data={structuredData} />
      <article className="section-shell" aria-labelledby="case-title">
        <nav className="case-breadcrumb" aria-label="Breadcrumb">
          <Link href="/#work">Selected work</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{project.title}</span>
        </nav>

        <header className="case-header">
          <p className="eyebrow case-category">{project.category}</p>
          <h1 id="case-title">{project.title}</h1>
          <p className="case-description">{project.description}</p>
          <div className="case-header-bottom">
            {project.role && <p className="case-role"><span>Role</span>{project.role}</p>}
            {project.status && <p className="case-role"><span>Status</span>{project.status}</p>}
            {(project.website || project.github) && (
              <div className="case-actions">
                {project.website && <a className="button button-dark" href={project.website} target="_blank" rel="noopener noreferrer">Visit website <span aria-hidden="true">↗</span></a>}
                {project.github && <a className="button button-light" href={project.github} target="_blank" rel="noopener noreferrer">View source <span aria-hidden="true">↗</span></a>}
              </div>
            )}
          </div>
          {project.sourceNote && <p className="case-source-note">{project.sourceNote}</p>}
        </header>

        {images[0] && (
          <figure className="case-cover">
            <div className={`case-image-frame${project.visualType === "concept" ? " case-image-concept" : ""}`}>
              <Image src={images[0]} alt={project.visualAlt || `${project.title} application overview`} fill priority sizes="(max-width: 760px) 100vw, 1160px" />
            </div>
            <figcaption>{project.visualType === "concept" ? "AI-generated concept illustration." : `${project.title} application screenshot.`}</figcaption>
          </figure>
        )}

        <div className="case-content-layout">
          <aside className="case-sidebar" aria-label="Project focus">
            <p className="eyebrow">PROJECT FOCUS</p>
            {project.tags?.length > 0 && <ul className="case-tags">{project.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
            {project.stack && <div className="case-stack"><h2>Technology</h2><p>{Array.isArray(project.stack) ? project.stack.join(", ") : project.stack}</p></div>}
            <Link className="text-link" href="/#contact">Discuss a project <span aria-hidden="true">↗</span></Link>
          </aside>

          <div className="case-body">
            {caseStudy && (
              <>
                <section className="case-section case-scope" aria-labelledby="case-role-scope">
                  <p className="eyebrow case-section-label">ROLE & SCOPE</p>
                  <h2 id="case-role-scope">Role and scope</h2>
                  <p>{caseStudy.roleContext}</p>
                </section>
                <section className="case-section" aria-labelledby="case-challenge">
                  <p className="eyebrow case-section-label">01 / PROJECT CHALLENGE</p>
                  <h2 id="case-challenge">The problem space</h2>
                  <p>{caseStudy.challenge}</p>
                </section>
              </>
            )}
            <section className="case-section" aria-labelledby="case-overview">
              <p className="eyebrow case-section-label">{caseStudy ? "02 / ENGINEERING CONTEXT" : "01 / OVERVIEW"}</p>
              <h2 id="case-overview">{caseStudy ? "How the pieces connect" : "The project"}</h2>
              {paragraphs(project.detail || project.description).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              {caseStudy && <p>{caseStudy.engineeringContext}</p>}
              {caseStudy?.architecture && (
                <figure className="case-architecture">
                  <div className="case-architecture-viewport" role="region" tabIndex={0} aria-label={`${project.title} explanatory diagram; scroll horizontally on smaller screens`}>
                    <Image src={caseStudy.architecture.src} alt={caseStudy.architecture.alt} width={project.slug === "dr-infinity" ? 1040 : 960} height={390} unoptimized />
                  </div>
                  <figcaption>{caseStudy.architecture.caption}</figcaption>
                  <a className="case-architecture-link" href={caseStudy.architecture.src} target="_blank" rel="noopener noreferrer">Open diagram <span aria-hidden="true">↗</span></a>
                </figure>
              )}
            </section>

            {sections.map((section, index) => (
              <section className="case-section" key={`${project.slug}-${index}`} aria-labelledby={`case-section-${index}`}>
                <p className="eyebrow case-section-label">{String(index + (caseStudy ? 3 : 2)).padStart(2, "0")} / {caseStudy ? "ENGINEERING CONTEXT" : "ENGINEERING"}</p>
                <h2 id={`case-section-${index}`}>{section.title}</h2>
                {paragraphs(section.body).map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
                {section.bullets?.length > 0 && <ul className="case-bullets">{section.bullets.map((bullet, bulletIndex) => <li key={bulletIndex}>{bullet}</li>)}</ul>}
              </section>
            ))}

            {sources.length > 0 && (
              <section className="case-section case-references" aria-labelledby="case-references">
                <p className="eyebrow case-section-label">{caseStudy ? "EVIDENCE & SOURCES" : "SOURCE MATERIAL"}</p>
                <h2 id="case-references">{caseStudy ? "What supports this overview" : "References"}</h2>
                {caseStudy && <p>{caseStudy.evidenceSummary}</p>}
                <ul>{sources.map((source, index) => <li key={`${source.title}-${index}`}>{source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<span aria-hidden="true"> ↗</span></a> : <span>{source.title}</span>}{source.note && <p>{source.note}</p>}</li>)}</ul>
              </section>
            )}
          </div>
        </div>

        {images.length > 1 && (
          <section className="case-gallery" aria-labelledby="case-gallery-title">
            <div className="case-gallery-heading"><p className="eyebrow">A CLOSER LOOK</p><h2 id="case-gallery-title">Inside the application</h2></div>
            <div className="case-gallery-grid">{images.slice(1).map((image, index) => <figure key={`${image}-${index}`}><div className="case-image-frame"><Image src={image} alt={`${project.title} application screenshot ${index + 1}`} fill sizes="(max-width: 760px) 100vw, 580px" /></div><figcaption>{project.title} · Application screenshot {index + 1}</figcaption></figure>)}</div>
          </section>
        )}

        <nav className="case-project-navigation" aria-label="More projects">
          {previousProject && <Link href={`/projects/${previousProject.slug}`}><span className="eyebrow">← PREVIOUS PROJECT</span><strong>{previousProject.title}</strong></Link>}
          {nextProject && <Link className="case-next-project" href={`/projects/${nextProject.slug}`}><span className="eyebrow">NEXT PROJECT →</span><strong>{nextProject.title}</strong></Link>}
        </nav>
      </article>

      <footer className="case-footer section-shell">
        <Link className="footer-name" href="/#home">{profile.name.toLowerCase()}<span>.</span></Link>
        <Link className="text-link" href="/#work">Back to selected work <span aria-hidden="true">↗</span></Link>
      </footer>
    </main>
  );
}
