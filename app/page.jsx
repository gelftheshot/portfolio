import Image from "next/image";
import { HomeStructuredData } from "@/components/StructuredData";
import ProjectGallery from "@/components/ProjectGallery";
import ContactForm from "@/components/ContactForm";
import ClientWork from "@/components/ClientWork";
import AssistantPanel from "@/components/AssistantPanel";
import WorkflowMark from "@/components/WorkflowMark";
import FooterTrail from "@/components/FooterTrail";
import { experience, expertise, profile } from "@/lib/profile";
import { projects } from "@/lib/projects";
import { upwork } from "@/lib/upwork";
import "./employment-details.css";
import "./homepage-disclosures.css";

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const HERO_STACK = ["Python", "Django", "Node.js", "LangChain", "AWS"];

function Arrow({ diagonal = false }) { return <span aria-hidden="true">{diagonal ? "↗" : "↘"}</span>; }

function countWord(value) { return NUMBER_WORDS[value] ?? String(value); }
function capitalize(text) { return text.charAt(0).toUpperCase() + text.slice(1); }
function sectionNumber(position) { return String(position).padStart(2, "0"); }

function yearRange(items) {
  const years = items.flatMap((item) => [item.startYear, item.endYear]).map(Number).filter((year) => year > 0);
  return years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "";
}

function lastContractMonth(work = []) {
  const last = work.map((item) => item.endDate).filter(Boolean).sort().at(-1);
  if (!last) return "";
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${last}T00:00:00Z`));
}

function responsibilityText(entry) {
  if (typeof entry === "string") return entry;
  return entry?.description || entry?.title || "";
}

function ExperienceItem({ item }) {
  const responsibilities = (item.responsibilities || []).map(responsibilityText).filter(Boolean);
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
          {item.description && <p className="experience-description">{item.description}</p>}
          {responsibilities.length > 0 && (
            <ul className="experience-responsibilities" aria-label="Role focus">
              {responsibilities.map((text, index) => <li key={`${index}-${text}`}><p>{text}</p></li>)}
            </ul>
          )}
          {item.focusAreas?.length > 3 && (
            <ul className="experience-focus" aria-label="Additional focus areas">
              {item.focusAreas.slice(3).map((area) => <li key={area}>{area}</li>)}
            </ul>
          )}
          {item.tools && <p className="experience-tools">Tools: {item.tools}</p>}
        </div>
      </details>
    </article>
  );
}

function EarlierRoles({ items }) {
  if (!items.length) return null;
  return (
    <details className="section-more experience-more">
      <summary>
        <span className="experience-more-summary">
          <span className="experience-more-label">
            <span className="section-more-closed">Show {countWord(items.length)} earlier {items.length === 1 ? "role" : "roles"}</span>
            <span className="section-more-open">Hide earlier roles</span>
          </span>
          <span className="experience-more-roles">
            {items.map((item) => (
              <span className="experience-more-role" key={item.id}>
                <span>{item.role}<span className="experience-more-company"> · {item.company}</span></span>
                <span className="mono">{item.period}</span>
              </span>
            ))}
          </span>
        </span>
        <span className="section-more-symbol" aria-hidden="true">+</span>
      </summary>
      <div className="experience-more-list">
        {items.map((item) => <ExperienceItem item={item} key={item.id} />)}
      </div>
    </details>
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

function credentialDate(value) {
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${value}-01T00:00:00Z`));
}

function CertificationItem({ credential }) {
  return (
    <li className="training-credential">
      <div className="training-credential-copy">
        <a href={credential.url} target="_blank" rel="noreferrer">{credential.name} <span aria-hidden="true">↗</span></a>
        <p>{credential.provider}</p>
      </div>
      <div className="training-credential-dates mono">
        <span>Issued <time dateTime={credential.issued}>{credentialDate(credential.issued)}</time></span>
        {credential.expires && <span>Expires <time dateTime={credential.expires}>{credentialDate(credential.expires)}</time></span>}
      </div>
    </li>
  );
}

function Certifications({ credentials = [] }) {
  if (!credentials.length) return null;
  const item = (credential) => <CertificationItem credential={credential} key={`${credential.name}:${credential.url}`} />;
  return (
    <section id="certifications" className="training-credentials" aria-labelledby="training-title">
      <h3 id="training-title"><WorkflowMark /> Certifications &amp; training</h3>
      <ul aria-label="Featured certifications and training">{credentials.slice(0, 3).map(item)}</ul>
      {credentials.length > 3 && (
        <details className="section-more training-more">
          <summary>
            <span className="section-more-closed">Read more certifications</span>
            <span className="section-more-open">Show fewer certifications</span>
            <span className="section-more-symbol" aria-hidden="true">+</span>
          </summary>
          <ul aria-label="More certifications and training">{credentials.slice(3).map(item)}</ul>
        </details>
      )}
    </section>
  );
}

function SkillGroups({ skills }) {
  const groups = Object.entries(skills || {}).filter(([, items]) => Array.isArray(items) && items.length > 0);
  if (!groups.length) return null;
  return (
    <dl className="about-skills">
      {groups.map(([group, items]) => (
        <div key={group}>
          <dt>{group}</dt>
          <dd className="mono">{items.join(" / ")}</dd>
        </div>
      ))}
    </dl>
  );
}

function CommonQuestions({ items, number }) {
  return (
    <section id="faq" className="faq-section section-space" aria-labelledby="faq-title">
      <div className="section-shell split-section">
        <div className="section-intro">
          <p className="eyebrow section-label">{number} / QUESTIONS</p>
          <h2 id="faq-title">Common questions</h2>
        </div>
        <div className="faq-list">
          {items.map((item, index) => (
            <div className="faq-item" key={item.question}>
              <h3 id={`faq-${index + 1}`}>{item.question}</h3>
              {item.answer.split(/\n{2,}/).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const featuredExpertise = expertise.filter((item) => ["01", "02", "04"].includes(item.number));
  const moreExpertise = expertise.filter((item) => !["01", "02", "04"].includes(item.number));
  const experienceYears = yearRange(experience);
  const lastContract = lastContractMonth(upwork?.completedWork);
  const questions = (Array.isArray(profile.faq) ? profile.faq : [])
    .filter((item) => typeof item?.question === "string" && item.question.trim() && typeof item?.answer === "string" && item.answer.trim());
  const contactNumber = sectionNumber(questions.length ? 6 : 5);

  return (
    <main id="main-content">
      <HomeStructuredData />
      <section id="home" className="hero section-shell" aria-labelledby="hero-title">
        <div className="hero-main">
          <div className="hero-copy">
            <p className="eyebrow hero-eyebrow"><WorkflowMark /> <span>AUTOMATION IN FOCUS</span></p>
            <h1 id="hero-title">{profile.name}{" "}<br /><span>{profile.title}</span></h1>
            <p className="hero-description">{profile.introduction || profile.summary}</p>
            <div className="hero-actions"><a className="button button-dark" href="#assistant">Ask my AI assistant <Arrow diagonal /></a><a className="text-link" href="/Lihon-Gebre-CV.pdf" download>Download résumé <span aria-hidden="true">↓</span></a></div>
            <p className="hero-assistant-note">The assistant below answers questions about my work. To discuss a role or project, <a href="#contact">send me a message</a>.</p>
          </div>
          <figure className="hero-portrait">
            <div className="portrait-frame"><Image src="/Lihongebre-professional-v1.png" alt={profile.name} width={1122} height={1402} priority sizes="(max-width: 540px) 120px, (max-width: 760px) 200px, (max-width: 1050px) 250px, 290px" /><span className="portrait-mark" aria-hidden="true">LG.</span></div>
            <figcaption><span>{profile.name}</span><span>{profile.location} <Arrow diagonal /></span></figcaption>
          </figure>
        </div>
        <div className="hero-footnote"><span>{HERO_STACK.join(" / ").toUpperCase()}</span><a href="#work">SCROLL TO EXPLORE <span aria-hidden="true">↓</span></a></div>
      </section>
      <AssistantPanel />
      <section id="work" className="work-section section-shell section-space" aria-labelledby="work-title">
        <div className="section-heading"><div><p className="eyebrow section-label">01 / PROJECTS</p><h2 id="work-title">Selected work</h2></div><p>{capitalize(countWord(projects.length))} projects. <br />Open a card for a short summary, or go to its full case study.</p></div>
        <ProjectGallery />
        <div className="work-footer"><span>Coursework and smaller experiments are on GitHub.</span><a className="text-link" href={profile.links.github} target="_blank" rel="noreferrer">Find me on GitHub <Arrow diagonal /></a></div>
      </section>
      <section id="experience" className="experience-section section-space" aria-labelledby="experience-title">
        <div className="section-shell split-section">
          <div className="section-intro">
            <p className="eyebrow section-label">02 / EMPLOYMENT</p>
            <h2 id="experience-title">Experience{experienceYears && <>, <span>{experienceYears}</span></>}</h2>
            <p>
              Roles are listed from newest to oldest.
              {lastContract && <> My last completed Upwork contract ended in {lastContract}. Reviews from those clients are in the next section.</>}
            </p>
            <a className="text-link" href={profile.links.linkedin} target="_blank" rel="noreferrer">Connect on LinkedIn <Arrow diagonal /></a>
          </div>
          <div className="experience-list">
            {experience.slice(0, 3).map((item) => <ExperienceItem item={item} key={item.id} />)}
            <EarlierRoles items={experience.slice(3)} />
          </div>
        </div>
      </section>
      <ClientWork />
      <section id="about" className="about-section section-shell section-space" aria-labelledby="about-title">
        <div className="about-intro"><div><p className="eyebrow section-label">04 / SKILLS &amp; TRAINING</p><h2 id="about-title">About</h2></div><div className="about-copy"><p>{profile.about || profile.summary}</p></div></div>
        <Certifications credentials={profile.certifications} />
        <div className="expertise-grid expertise-highlights">
          {featuredExpertise.map((item, index) => <ExpertiseItem item={item} position={index + 1} key={item.number} />)}
        </div>
        <details className="section-more about-more">
          <summary>
            <span className="section-more-closed">Read more about my skills</span>
            <span className="section-more-open">Show less about my skills</span>
            <span className="section-more-symbol" aria-hidden="true">+</span>
          </summary>
          <SkillGroups skills={profile.skills} />
          {moreExpertise.length > 0 && (
            <div className="expertise-grid expertise-more-grid">
              {moreExpertise.map((item, index) => <ExpertiseItem item={item} position={featuredExpertise.length + index + 1} key={item.number} />)}
            </div>
          )}
        </details>
      </section>
      {questions.length > 0 && <CommonQuestions items={questions} number={sectionNumber(5)} />}
      <section id="contact" className="contact-section section-space" aria-labelledby="contact-title"><div className="section-shell split-section"><div className="contact-copy"><p className="eyebrow section-label">{contactNumber} / GET IN TOUCH</p><h2 id="contact-title">Contact</h2><p>Write to me about an engineering role, remote or in Addis Ababa, or about an AI or backend project. I reply by email.</p><div className="contact-socials"><a className="text-link" href={profile.links.github} target="_blank" rel="noreferrer">GitHub <Arrow diagonal /></a><a className="text-link" href={profile.links.linkedin} target="_blank" rel="noreferrer">LinkedIn <Arrow diagonal /></a></div></div><ContactForm /></div></section>
      <footer className="site-footer">
        <div className="section-shell">
          <FooterTrail />
          <div className="footer-meta"><a className="footer-name" href="#home">{profile.name.toLowerCase()}<span>.</span></a><span>© {new Date().getFullYear()} {profile.name}</span><a className="back-top" href="#home">Back to top <span aria-hidden="true">↑</span></a></div>
        </div>
      </footer>
    </main>
  );
}
