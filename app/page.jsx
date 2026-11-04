import Image from "next/image";
import { HomeStructuredData } from "@/components/StructuredData";
import ProjectGallery from "@/components/ProjectGallery";
import ContactForm from "@/components/ContactForm";
import ClientWork from "@/components/ClientWork";
import AssistantPanel from "@/components/AssistantPanel";
import WorkflowMark from "@/components/WorkflowMark";
import { experience, expertise, profile } from "@/lib/profile";
import "./employment-details.css";
import "./homepage-disclosures.css";

function Arrow({ diagonal = false }) { return <span aria-hidden="true">{diagonal ? "↗" : "↘"}</span>; }

function ExperienceItem({ item }) {
  return (
    <article className="experience-item" id={item.id} aria-labelledby={`${item.id}-role`}>
      <div className="experience-topline">
        <h3 id={`${item.id}-role`}>{item.role}</h3>
        <span className="mono">{item.period}</span>
      </div>
      <p className="experience-company" id={`${item.id}-company`}>{item.company}</p>
      {item.focusAreas?.length > 0 && (
        <ul className="experience-focus" aria-label="Main focus areas">
          {item.focusAreas.slice(0, 3).map((area) => <li key={area}>{area}</li>)}
        </ul>
      )}
      <details className="experience-disclosure">
        <summary aria-describedby={`${item.id}-role ${item.id}-company`}>
          <span className="experience-toggle-closed">Read role details</span>
          <span className="experience-toggle-open">Hide role details</span>
          <svg className="experience-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </summary>
        <div className="experience-detail-content">
          <p className="experience-description">{item.description}</p>
          {item.responsibilities?.length > 0 && (
            <ul className="experience-responsibilities" aria-label="Role focus">
              {item.responsibilities.map((responsibility) => (
                <li key={responsibility.title}>
                  <strong>{responsibility.title}</strong>
                  <p>{responsibility.description}</p>
                </li>
              ))}
            </ul>
          )}
          {item.focusAreas?.length > 3 && (
            <ul className="experience-focus" aria-label="Additional focus areas">
              {item.focusAreas.slice(3).map((area) => <li key={area}>{area}</li>)}
            </ul>
          )}
          {item.tools && <p className="experience-tools">Tools: {item.tools}</p>}
          {item.scopeNote && <p className="experience-scope-note">{item.scopeNote}</p>}
        </div>
      </details>
    </article>
  );
}

function ExpertiseItem({ item, position }) {
  return (
    <article className="expertise-item">
      <span className="mono expertise-number">{String(position).padStart(2, "0")}</span>
      <h3 className={item.number === "04" ? "expertise-automation-title" : undefined}>
        {item.number === "04" && <WorkflowMark />}<span>{item.title}</span>
      </h3>
      <p>{item.description}</p>
      <div className="expertise-tools">{item.tools}</div>
    </article>
  );
}

export default function Home() {
  const featuredExpertise = expertise.filter((item) => ["01", "02", "04"].includes(item.number));
  const moreExpertise = expertise.filter((item) => !["01", "02", "04"].includes(item.number));

  return (
    <main id="main-content">
      <HomeStructuredData />
      <section id="home" className="hero section-shell" aria-labelledby="hero-title">
        <div className="hero-main">
          <div className="hero-copy">
            <p className="eyebrow hero-eyebrow"><WorkflowMark /> <span>AI & BACKEND ENGINEER · AUTOMATION IN FOCUS</span></p>
            <h1 id="hero-title">AI & backend.<br /><span>Built to connect.</span></h1>
            <p className="hero-description">I’m Lihon Gebre. I build AI agents, retrieval systems, and backend APIs, with workflow automation that connects tools and data.</p>
            <div className="hero-actions"><a className="button button-dark" href="#assistant">Ask my AI assistant <Arrow diagonal /></a><a className="text-link" href="/Lihon-Gebre-Resume.pdf" download>Download résumé <span aria-hidden="true">↓</span></a></div>
            <p className="hero-assistant-note">Explore my work with the portfolio assistant, or <a href="#contact">discuss a role or project</a>.</p>
          </div>
          <figure className="hero-portrait">
            <div className="portrait-frame"><Image src="/Lihongebre-professional-v1.png" alt="Lihon Gebre" width={1122} height={1402} priority sizes="(max-width: 540px) 120px, (max-width: 760px) 200px, (max-width: 1050px) 250px, 290px" /><span className="portrait-mark" aria-hidden="true">LG.</span></div>
            <figcaption><span>Lihon Gebre</span><span>Addis Ababa, Ethiopia <Arrow diagonal /></span></figcaption>
          </figure>
        </div>
        <div className="hero-footnote"><span>AI SYSTEMS / CONNECTED APIS / WORKFLOW AUTOMATION</span><a href="#work">SCROLL TO EXPLORE <span aria-hidden="true">↓</span></a></div>
      </section>
      <AssistantPanel />
      <section id="work" className="work-section section-shell section-space" aria-labelledby="work-title">
        <div className="section-heading"><div><p className="eyebrow section-label">01 / SELECTED WORK</p><h2 id="work-title">Ideas, made real.</h2></div><p>AI systems, connected data, and useful software. <br />Explore the engineering behind the workflows.</p></div>
        <ProjectGallery />
        <div className="work-footer"><span>More code, experiments, and things in progress.</span><a className="text-link" href="https://github.com/gelftheshot" target="_blank" rel="noreferrer">Find me on GitHub <Arrow diagonal /></a></div>
      </section>
      <section id="experience" className="experience-section section-space" aria-labelledby="experience-title">
        <div className="section-shell split-section">
          <div className="section-intro">
            <p className="eyebrow section-label">02 / EXPERIENCE</p>
            <h2 id="experience-title">Always building.<br /><span>Always learning.</span></h2>
            <p>Employment history from 2016 to 2025, with completed client work through June 2026. My focus spans AI, backend systems, infrastructure, and automation.</p>
            <a className="text-link" href="https://linkedin.com/in/lihongebre" target="_blank" rel="noreferrer">Connect on LinkedIn <Arrow diagonal /></a>
          </div>
          <div className="experience-list">
            {experience.slice(0, 3).map((item) => <ExperienceItem item={item} key={item.id} />)}
            {experience.length > 3 && (
              <details className="section-more experience-more">
                <summary>
                  <span className="section-more-closed">Read more employment history</span>
                  <span className="section-more-open">Show less employment history</span>
                  <span className="section-more-symbol" aria-hidden="true">+</span>
                </summary>
                <div className="experience-more-list">
                  {experience.slice(3).map((item) => <ExperienceItem item={item} key={item.id} />)}
                </div>
              </details>
            )}
          </div>
        </div>
      </section>
      <ClientWork />
      <section id="about" className="about-section section-shell section-space" aria-labelledby="about-title">
        <div className="about-intro"><div><p className="eyebrow section-label">04 / A LITTLE ABOUT ME</p><h2 id="about-title">Curious by nature.<br /><span>Engineer by practice.</span></h2></div><div className="about-copy"><p>I’m a software engineer based in Addis Ababa, Ethiopia, working at the intersection of web development, AI, and infrastructure.</p></div></div>
        <div className="training-credentials" aria-labelledby="training-title">
          <h3 id="training-title"><WorkflowMark /> Automation training</h3>
          <ul>{profile.certifications.map((credential) => <li key={credential.name}><a href={credential.url} target="_blank" rel="noreferrer">{credential.name} <span aria-hidden="true">↗</span></a><span className="mono">{credential.issued}</span></li>)}</ul>
          <p>Training credentials listed on my <a href={profile.links.upwork} target="_blank" rel="noreferrer">Upwork profile</a>. Follow a credential to view its issuer record.</p>
        </div>
        <div className="expertise-grid expertise-highlights">
          {featuredExpertise.map((item, index) => <ExpertiseItem item={item} position={index + 1} key={item.number} />)}
        </div>
        <details className="section-more about-more">
          <summary>
            <span className="section-more-closed">Read more about my skills</span>
            <span className="section-more-open">Show less about my skills</span>
            <span className="section-more-symbol" aria-hidden="true">+</span>
          </summary>
          <div className="about-copy about-more-copy"><p>My work spans AI engineering, backend development, infrastructure, and workflow automation. I focus on connecting APIs, keeping data in sync, and making repetitive processes easier to maintain, with validation and human review where they matter.</p></div>
          <div className="expertise-grid expertise-more-grid">
            {moreExpertise.map((item, index) => <ExpertiseItem item={item} position={featuredExpertise.length + index + 1} key={item.number} />)}
          </div>
        </details>
      </section>
      <section id="contact" className="contact-section section-space" aria-labelledby="contact-title"><div className="section-shell split-section"><div className="contact-copy"><p className="eyebrow section-label">05 / GET IN TOUCH</p><h2 id="contact-title">Good things start<br />with a conversation<span className="contact-period">.</span></h2><p>Have an AI project, a workflow to simplify, or a role in mind? I’d love to hear what you’re building.</p><div className="contact-socials"><a className="text-link" href="https://github.com/gelftheshot" target="_blank" rel="noreferrer">GitHub <Arrow diagonal /></a><a className="text-link" href="https://linkedin.com/in/lihongebre" target="_blank" rel="noreferrer">LinkedIn <Arrow diagonal /></a></div></div><ContactForm /></div></section>
      <footer className="site-footer section-shell"><a className="footer-name" href="#home">lihon gebre<span>.</span></a><span>© {new Date().getFullYear()} Lihon Gebre</span><a className="back-top" href="#home">Back to top <span aria-hidden="true">↑</span></a></footer>
    </main>
  );
}
