/** Public content only. This module is shared with the editor; it contains no credentials. */
export const CONTENT_LIMITS = Object.freeze({
  requestBytes: 3_800_000,
  contentBytes: 256 * 1024,
  uploadBytes: 2 * 1024 * 1024,
  uploads: 3,
  projects: 50,
  experience: 30,
  reviews: 100,
});

export class AdminContentError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "AdminContentError";
    this.status = status;
    this.code = code;
  }
}

const fail = (path, expectation) => {
  throw new AdminContentError(400, "invalid_content", `Check ${path}: ${expectation}.`);
};
const has = (value, key) => Object.hasOwn(value, key);
function object(value, allowed, required, path) {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(path, "expected an object");
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail(path, "contains an unsupported field");
  if (required.some((key) => !has(value, key))) fail(path, "a required field is missing");
  return value;
}
function string(value, path, maximum = 1000, empty = false) {
  if (typeof value !== "string" || value.length > maximum || (!empty && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail(path, `expected ${empty ? "text" : "nonempty text"} up to ${maximum} characters`);
  return value;
}
function array(value, path, minimum, maximum, check) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) fail(path, `expected ${minimum}–${maximum} items`);
  value.forEach((item, index) => check(item, `${path}[${index + 1}]`));
  return value;
}
const strings = (value, path, maximum = 30, length = 300, minimum = 0) => array(value, path, minimum, maximum, (item, name) => string(item, name, length));
function optional(value, key, check, path) { if (has(value, key)) check(value[key], `${path}.${key}`); }
function unique(value, key, path) {
  const keys = value.map((item) => key ? item[key] : item);
  if (new Set(keys).size !== keys.length) fail(path, "identifiers must be unique");
}
function identifier(value, path) {
  string(value, path, 80);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) fail(path, "use lowercase letters, numbers and single hyphens");
}
function url(value, path) {
  string(value, path, 2048);
  let parsed;
  try { parsed = new URL(value); } catch { fail(path, "expected a complete HTTP or HTTPS URL"); }
  if (!/^https?:\/\//i.test(value) || !["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || /\s/.test(value)) fail(path, "expected an HTTP or HTTPS URL without embedded credentials");
}
export function validateAssetPath(value, path = "image") {
  string(value, path, 240);
  if (!/^\/(?!\/)[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp|gif|avif|svg)$/i.test(value) || value.split("/").some((part) => part === "." || part === "..")) fail(path, "expected a local image path without traversal, query strings or fragments");
  return value;
}
function date(value, path) {
  string(value, path, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) fail(path, "expected a valid YYYY-MM-DD date");
}
function month(value, path) {
  string(value, path, 7);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) fail(path, "expected YYYY-MM");
}
function year(value, path) {
  string(value, path, 4);
  if (!/^(19|20|21)\d{2}$/.test(value)) fail(path, "expected a four-digit year");
}
function number(value, path, minimum, maximum, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum || (integer && !Number.isInteger(value))) fail(path, `expected ${integer ? "an integer" : "a number"} from ${minimum} to ${maximum}`);
}

function validateProfile(value) {
  const path = "profile";
  const required = ["name", "title", "location", "summary", "skills", "education", "languages", "workPreferences", "links", "experience", "expertise", "automationFocus", "professionalFocus", "certifications"];
  object(value, [...required, "updatedAt", "introduction", "about", "headline", "resumeSummary", "faq"], required, path);
  for (const key of ["name", "title", "location"]) string(value[key], `${path}.${key}`, 200);
  string(value.summary, `${path}.summary`, 5000);
  optional(value, "resumeSummary", (x, n) => string(x, n, 1200), path);
  optional(value, "introduction", (x, n) => string(x, n, 800), path);
  optional(value, "about", (x, n) => string(x, n, 1500), path);
  optional(value, "headline", (headline, name) => {
    object(headline, ["first", "second"], ["first", "second"], name);
    string(headline.first, `${name}.first`, 100);
    string(headline.second, `${name}.second`, 100);
  }, path);
  optional(value, "faq", (x, n) => array(x, n, 0, 20, (item, name) => {
    object(item, ["question", "answer"], ["question", "answer"], name);
    string(item.question, `${name}.question`, 300);
    string(item.answer, `${name}.answer`, 2000);
  }), path);
  object(value.skills, Object.keys(value.skills || {}).filter((key) => !["__proto__", "constructor", "prototype"].includes(key)), [], `${path}.skills`);
  if (Object.keys(value.skills).length > 20) fail(`${path}.skills`, "expected at most 20 categories");
  for (const [key, entries] of Object.entries(value.skills)) { string(key, "skills category", 80); strings(entries, "skills category entries", 50, 150); }
  array(value.education, `${path}.education`, 0, 20, (item, name) => { object(item, ["institution", "degree"], ["institution", "degree"], name); string(item.institution, `${name}.institution`, 200); string(item.degree, `${name}.degree`, 300); });
  array(value.languages, `${path}.languages`, 0, 20, (item, name) => { object(item, ["language", "proficiency"], ["language", "proficiency"], name); string(item.language, `${name}.language`, 100); string(item.proficiency, `${name}.proficiency`, 100); });
  object(value.workPreferences, ["environment", "availability"], [], `${path}.workPreferences`);
  for (const key of Object.keys(value.workPreferences)) string(value.workPreferences[key], `${path}.workPreferences.${key}`, 300, true);
  object(value.links, ["website", "github", "linkedin", "upwork", "contact", "resume", "resumeText"], ["website", "github", "linkedin", "contact"], `${path}.links`);
  for (const key of Object.keys(value.links)) url(value.links[key], `${path}.links.${key}`);
  array(value.experience, `${path}.experience`, 0, CONTENT_LIMITS.experience, (item, name) => {
    const fields = ["id", "company", "role", "period", "startYear", "endYear", "description", "responsibilities", "focusAreas", "tools", "resumeBullets"];
    object(item, fields, ["id", "company", "role", "period", "startYear", "description", "responsibilities", "focusAreas"], name);
    identifier(item.id, `${name}.id`);
    if (["home", "assistant", "work", "experience", "client-work", "about", "certifications", "faq", "contact", "main-content"].includes(item.id) || /^(project-|client-work-)/.test(item.id) || /^faq-\d+$/.test(item.id)) fail(`${name}.id`, "this identifier is reserved");
    for (const key of ["company", "role", "period"]) string(item[key], `${name}.${key}`, 200);
    year(item.startYear, `${name}.startYear`);
    if (item.endYear === "" || item.endYear === null) delete item.endYear;
    optional(item, "endYear", year, name);
    if (item.endYear && item.endYear < item.startYear) fail(`${name}.endYear`, "must not precede the start year");
    string(item.description, `${name}.description`, 5000);
    optional(item, "resumeBullets", (x, n) => strings(x, n, 6, 500, 1), name);
    array(item.responsibilities, `${name}.responsibilities`, 0, 20, (area, areaName) => { object(area, ["title", "description"], ["title", "description"], areaName); string(area.title, `${areaName}.title`, 200); string(area.description, `${areaName}.description`, 4000); });
    strings(item.focusAreas, `${name}.focusAreas`, 30, 200);
    optional(item, "tools", (x, n) => string(x, n, 2000, true), name);
  });
  unique(value.experience, "id", `${path}.experience`);
  array(value.expertise, `${path}.expertise`, 0, 20, (item, name) => {
    object(item, ["number", "title", "description", "tools"], ["number", "title", "description", "tools"], name);
    string(item.number, `${name}.number`, 2); if (!/^\d{2}$/.test(item.number)) fail(`${name}.number`, "expected a two-digit identifier");
    string(item.title, `${name}.title`, 200); string(item.description, `${name}.description`, 3000); string(item.tools, `${name}.tools`, 2000, true);
  });
  unique(value.expertise, "number", `${path}.expertise`);
  object(value.automationFocus, ["status", "summary", "focusAreas", "projectEvidence"], ["summary", "focusAreas", "projectEvidence"], `${path}.automationFocus`);
  optional(value.automationFocus, "status", (x, n) => string(x, n, 200), `${path}.automationFocus`);
  string(value.automationFocus.summary, `${path}.automationFocus.summary`, 5000);
  strings(value.automationFocus.focusAreas, `${path}.automationFocus.focusAreas`, 30, 200);
  array(value.automationFocus.projectEvidence, `${path}.automationFocus.projectEvidence`, 0, 50, (item, name) => { object(item, ["slug", "title", "description"], ["slug", "title", "description"], name); identifier(item.slug, `${name}.slug`); string(item.title, `${name}.title`, 200); string(item.description, `${name}.description`, 3000); });
  strings(value.professionalFocus, `${path}.professionalFocus`, 30, 1000);
  array(value.certifications, `${path}.certifications`, 0, 30, (item, name) => {
    object(item, ["name", "provider", "issued", "expires", "url", "source", "verification", "credentialId"], ["name", "provider", "issued", "url", "source", "verification"], name);
    string(item.name, `${name}.name`, 300); string(item.provider, `${name}.provider`, 200); month(item.issued, `${name}.issued`); optional(item, "expires", month, name); url(item.url, `${name}.url`); string(item.verification, `${name}.verification`, 2000);
    optional(item, "credentialId", (x, n) => string(x, n, 300), name);
    object(item.source, ["name", "url", "checkedAt"], ["name", "url", "checkedAt"], `${name}.source`); string(item.source.name, `${name}.source.name`, 200); url(item.source.url, `${name}.source.url`); date(item.source.checkedAt, `${name}.source.checkedAt`);
  });
  optional(value, "updatedAt", date, path);
}

function validateProjects(value) {
  array(value, "projects", 1, CONTENT_LIMITS.projects, (item, path) => {
    const fields = ["slug", "title", "category", "description", "detail", "role", "tags", "tagsLabel", "images", "visualType", "visualAlt", "website", "caseStudy", "technicalSections", "sources", "stack", "status", "github", "portrait", "updatedAt", "sourceNote"];
    object(item, fields, ["slug", "title", "category", "description", "images", "tags"], path);
    identifier(item.slug, `${path}.slug`);
    for (const key of ["title", "category"]) string(item[key], `${path}.${key}`, 200);
    string(item.description, `${path}.description`, 3000);
    for (const key of ["role", "tagsLabel", "visualAlt", "status"]) optional(item, key, (x, n) => string(x, n, 600, true), path);
    optional(item, "detail", (x, n) => Array.isArray(x) ? strings(x, n, 20, 8000) : string(x, n, 16000, true), path);
    optional(item, "stack", (x, n) => Array.isArray(x) ? strings(x, n, 50, 200) : string(x, n, 3000, true), path);
    strings(item.tags, `${path}.tags`, 30, 150);
    array(item.images, `${path}.images`, 1, 20, validateAssetPath);
    for (const key of ["website", "github"]) optional(item, key, url, path);
    optional(item, "visualType", (x, n) => { if (!["concept", "screenshot"].includes(x)) fail(n, "expected concept or screenshot"); }, path);
    optional(item, "portrait", (x, n) => { if (typeof x !== "boolean") fail(n, "expected a boolean"); }, path);
    optional(item, "updatedAt", date, path);
    optional(item, "sourceNote", (x, n) => string(x, n, 600, true), path);
    optional(item, "caseStudy", (study, name) => {
      object(study, ["roleContext", "challenge", "engineeringContext", "evidenceSummary", "architecture"], ["roleContext", "challenge", "engineeringContext", "evidenceSummary"], name);
      for (const key of ["roleContext", "challenge", "engineeringContext", "evidenceSummary"]) string(study[key], `${name}.${key}`, 8000);
      optional(study, "architecture", (diagram, diagramName) => { object(diagram, ["src", "alt", "caption"], ["src", "alt", "caption"], diagramName); validateAssetPath(diagram.src, `${diagramName}.src`); string(diagram.alt, `${diagramName}.alt`, 1500); string(diagram.caption, `${diagramName}.caption`, 3000); }, name);
    }, path);
    optional(item, "technicalSections", (sections, name) => array(sections, name, 0, 30, (section, sectionName) => {
      object(section, ["title", "body", "bullets"], ["title", "body"], sectionName); string(section.title, `${sectionName}.title`, 300); strings(section.body, `${sectionName}.body`, 20, 8000); optional(section, "bullets", (x, n) => strings(x, n, 30, 3000), sectionName);
    }), path);
    optional(item, "sources", (sources, name) => array(sources, name, 0, 30, (source, sourceName) => { object(source, ["title", "url", "note"], ["title"], sourceName); string(source.title, `${sourceName}.title`, 300); optional(source, "url", url, sourceName); optional(source, "note", (x, n) => string(x, n, 4000, true), sourceName); }), path);
  });
  unique(value, "slug", "projects");
}

function validateUpwork(value) {
  object(value, ["source", "profile", "completedWork"], ["source", "profile", "completedWork"], "upwork");
  object(value.source, ["name", "profileUrl", "retrievedAt", "method"], ["name", "profileUrl", "retrievedAt", "method"], "upwork.source");
  string(value.source.name, "upwork.source.name", 200); url(value.source.profileUrl, "upwork.source.profileUrl"); date(value.source.retrievedAt, "upwork.source.retrievedAt"); string(value.source.method, "upwork.source.method", 4000);
  const fields = ["snapshotDate", "displayName", "title", "jobSuccessPercent", "badge", "completedJobCount", "totalJobCount", "writtenReviewCount", "feedbackEntryCount"];
  object(value.profile, fields, ["displayName", "title", "badge", "completedJobCount", "totalJobCount", "writtenReviewCount"], "upwork.profile");
  optional(value.profile, "snapshotDate", date, "upwork.profile");
  for (const key of ["displayName", "title", "badge"]) string(value.profile[key], `upwork.profile.${key}`, 400, key === "badge");
  optional(value.profile, "jobSuccessPercent", (x, n) => number(x, n, 0, 100), "upwork.profile");
  optional(value.profile, "feedbackEntryCount", (x, n) => number(x, n, 0, 10000, true), "upwork.profile");
  for (const key of ["completedJobCount", "totalJobCount", "writtenReviewCount"]) number(value.profile[key], `upwork.profile.${key}`, 0, 10000, true);
  array(value.completedWork, "upwork.completedWork", 0, CONTENT_LIMITS.reviews, (item, path) => {
    const keys = ["id", "title", "period", "startDate", "endDate", "clientName", "clientNameSource", "rating", "ratingScale", "feedback", "sourceUrl", "feedbackExcerpt"];
    object(item, keys, ["id", "title", "period", "startDate", "endDate", "rating", "ratingScale", "sourceUrl"], path);
    identifier(item.id, `${path}.id`); string(item.title, `${path}.title`, 400); string(item.period, `${path}.period`, 200); date(item.startDate, `${path}.startDate`); date(item.endDate, `${path}.endDate`);
    if (item.endDate < item.startDate) fail(`${path}.endDate`, "must not precede the start date");
    optional(item, "clientName", (x, n) => string(x, n, 200, true), path); optional(item, "clientNameSource", (x, n) => string(x, n, 300, true), path);
    number(item.ratingScale, `${path}.ratingScale`, 1, 10); number(item.rating, `${path}.rating`, 0, item.ratingScale); url(item.sourceUrl, `${path}.sourceUrl`);
    optional(item, "feedback", (x, n) => { if (x !== null) string(x, n, 12000, true); }, path);
    optional(item, "feedbackExcerpt", (x, n) => string(x, n, 12000, true), path);
    if (item.feedbackExcerpt && !item.feedback?.includes(item.feedbackExcerpt)) fail(`${path}.feedbackExcerpt`, "must be an exact excerpt of the full feedback");
  });
  unique(value.completedWork, "id", "upwork.completedWork");
  value.profile.completedJobCount = value.completedWork.length;
  value.profile.writtenReviewCount = value.completedWork.filter((item) => item.feedback?.trim()).length;
  value.profile.totalJobCount = Math.max(value.profile.totalJobCount, value.completedWork.length);
}

export function validateContentBundle(input, { now = new Date() } = {}) {
  let serialized;
  try { serialized = JSON.stringify(input); } catch { fail("content", "expected JSON content"); }
  if (typeof serialized !== "string" || new TextEncoder().encode(serialized).length > CONTENT_LIMITS.contentBytes) throw new AdminContentError(413, "content_too_large", "Portfolio content must be smaller than 256 KB.");
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}|sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{30,}/.test(serialized)) fail("content", "credentials cannot be published as portfolio content");
  const excludedReference = String.fromCharCode(108, 101, 103, 97, 108, 100, 98);
  if (serialized.toLowerCase().includes(excludedReference)) fail("content", "contains a reference excluded from this portfolio");
  const content = JSON.parse(serialized);
  object(content, ["profile", "projects", "upwork"], ["profile", "projects", "upwork"], "content");
  validateProfile(content.profile); validateProjects(content.projects); validateUpwork(content.upwork);
  const slugs = new Set(content.projects.map((project) => project.slug));
  if (content.profile.automationFocus.projectEvidence.some((project) => !slugs.has(project.slug))) fail("profile.automationFocus.projectEvidence", "each referenced project must exist");
  const timestamp = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(timestamp.valueOf())) throw new Error("Invalid clock");
  content.profile.updatedAt = timestamp.toISOString().slice(0, 10);
  return content;
}
