"use client";

import Image from "next/image";
import Link from "next/link";
import { projects } from "@/lib/projects";
import { useEffect, useRef, useState } from "react";

function Arrow({ direction = "diagonal" }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {direction === "diagonal" ? (
        <path d="M6 18 18 6M6 6h12v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d={direction === "left" ? "M19 12H5m7-7-7 7 7 7" : "M5 12h14m-7-7 7 7-7 7"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export default function ProjectGallery() {
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [imageIndex, setImageIndex] = useState(0);
  const isConceptImage = selectedProject?.visualType === "concept" && imageIndex === 0;

  useEffect(() => {
    if (!selectedProject) return;

    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();

    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, [selectedProject]);

  function openProject(project, event) {
    openerRef.current = event.currentTarget;
    setImageIndex(0);
    setSelectedProject(project);
  }

  function handleDialogClose() {
    setSelectedProject(null);
    openerRef.current?.focus({ preventScroll: true });
  }

  function moveImage(offset) {
    setImageIndex((current) => (current + offset + selectedProject.images.length) % selectedProject.images.length);
  }

  function renderProjectCard(project, index) {
    return (
      <article id={`project-${project.slug}`} className={`project-card${project.visualType === "concept" ? " project-card-concept" : ""}${project.portrait && project.visualType !== "concept" ? " project-card-portrait" : ""}`} key={project.slug}>
        <button className={`project-preview${project.visualType === "concept" ? " project-preview-concept" : ""}`} type="button" onClick={(event) => openProject(project, event)} aria-label={`Explore ${project.title}`}>
          <Image src={project.images[0]} alt={project.visualAlt || `${project.title} application preview`} width={1360} height={610} className="project-screenshot" sizes={index < 3 ? "(max-width: 760px) 100vw, (max-width: 1050px) 50vw, 33vw" : "(max-width: 760px) 100vw, 50vw"} />
          {project.visualType === "concept" && <span className="project-visual-label">Concept illustration</span>}
          <span className="project-open"><Arrow /></span>
        </button>
        <div className="project-meta">
          <span className="eyebrow">{project.category}</span>
          <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        </div>
        <h3><button className="project-title" type="button" onClick={(event) => openProject(project, event)}>{project.title}</button></h3>
        {project.role && <p className="project-role">{project.role}{project.status && <span className="project-status">{project.status}</span>}</p>}
        <p className="project-description">{project.description}</p>
        <ul className="project-tags" aria-label={`${project.title} ${project.tagsLabel || "technologies"}`}>
          {project.tags.map((tag) => <li key={tag}>{tag}</li>)}
        </ul>
        <Link className="project-case-link text-link" href={`/projects/${project.slug}`} aria-label={`Read ${project.title} case study`}>Read case study <Arrow direction="right" /></Link>
      </article>
    );
  }

  return (
    <>
      <div className="project-grid portfolio-highlights">
        {projects.slice(0, 3).map(renderProjectCard)}
      </div>
      <details className="section-more portfolio-more">
        <summary>
          <span className="section-more-closed">Read more portfolio</span>
          <span className="section-more-open">Show less portfolio</span>
          <span className="section-more-symbol" aria-hidden="true">+</span>
        </summary>
        <div className="project-grid">
          {projects.slice(3).map((project, index) => renderProjectCard(project, index + 3))}
        </div>
      </details>

      <dialog ref={dialogRef} className="project-dialog" aria-labelledby="project-dialog-title" onClose={handleDialogClose} onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current.close(); }}>
        {selectedProject && (
          <div className="dialog-inner">
            <div className="dialog-header">
              <div>
                <p className="eyebrow">{selectedProject.category}</p>
                <h2 id="project-dialog-title">{selectedProject.title}</h2>
              </div>
              <button className="dialog-close" type="button" aria-label="Close project details" onClick={() => dialogRef.current.close()} autoFocus>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className={`dialog-image${isConceptImage ? " dialog-image-concept" : ""}`}>
              <Image src={selectedProject.images[imageIndex]} alt={isConceptImage ? (selectedProject.visualAlt || `${selectedProject.title} concept illustration`) : `${selectedProject.title}, application screenshot ${selectedProject.visualType === "concept" ? imageIndex : imageIndex + 1} of ${selectedProject.images.length - (selectedProject.visualType === "concept" ? 1 : 0)}`} width={1360} height={610} sizes="(max-width: 760px) 95vw, 900px" />
            </div>
            <span className="project-visual-label">{isConceptImage ? "Concept illustration" : "Application screenshot"}</span>
            {selectedProject.images.length > 1 && (
              <div className="dialog-controls">
                <button className="button button-light" type="button" aria-label="Previous image" onClick={() => moveImage(-1)}><Arrow direction="left" /></button>
                <span aria-live="polite" aria-atomic="true">{imageIndex + 1} / {selectedProject.images.length}</span>
                <button className="button button-light" type="button" aria-label="Next image" onClick={() => moveImage(1)}><Arrow direction="right" /></button>
              </div>
            )}
            <div className="dialog-details">
              <p>{selectedProject.detail}</p>
              {selectedProject.role && <p><strong>Role:</strong> {selectedProject.role}</p>}
              {selectedProject.status && <p><strong>Status:</strong> {selectedProject.status}</p>}
              {selectedProject.stack && <p><strong>Built with:</strong> {selectedProject.stack}</p>}
            </div>
            {selectedProject.technicalSections?.length > 0 && (
              <div className="dialog-technical-sections">
                {selectedProject.technicalSections.slice(0, 2).map((section) => (
                  <section key={section.title}>
                    <h3>{section.title}</h3>
                    {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                    {section.bullets?.length > 0 && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
                  </section>
                ))}
              </div>
            )}
            <div className="dialog-links">
              <Link className="button button-light" href={`/projects/${selectedProject.slug}`}>Read full case study <Arrow direction="right" /></Link>
              {selectedProject.website && <a className="button button-dark" href={selectedProject.website} target="_blank" rel="noopener noreferrer">Visit live website <Arrow /></a>}
              {selectedProject.github && <a className="button button-dark" href={selectedProject.github} target="_blank" rel="noopener noreferrer">View source on GitHub <Arrow /></a>}
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
