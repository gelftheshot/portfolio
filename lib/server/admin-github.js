import { createHash } from "node:crypto";
import sharp from "sharp";
import profileData from "../../data/profile.json" with { type: "json" };
import projectsData from "../../data/projects.json" with { type: "json" };
import upworkData from "../../data/upwork.json" with { type: "json" };
import { AdminContentError, CONTENT_LIMITS, validateContentBundle } from "../admin/content-schema.js";
import { CONTACT_EMAIL } from "../contact.js";
import { generateResume } from "../../scripts/generate-resume.mjs";

const FILES = Object.freeze({ profile: "data/profile.json", projects: "data/projects.json", upwork: "data/upwork.json" });
const SHA = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const API_RESPONSE_BYTES = 800_000;
const safeFailure = () => new AdminContentError(503, "repository_unavailable", "Repository access is unavailable. Check the server configuration and try again.");
const conflict = () => new AdminContentError(409, "content_conflict", "The repository changed while you were editing. Reload the latest content before publishing again.");
const invalid = (message) => new AdminContentError(400, "invalid_request", message);

function config(environment) {
  const repository = environment.ADMIN_GITHUB_REPOSITORY?.trim() || "gelftheshot/portfolio";
  const branch = environment.ADMIN_GITHUB_BRANCH?.trim() || "main";
  const token = environment.ADMIN_GITHUB_TOKEN?.trim() || "";
  if (!/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9_.-]{1,100}$/.test(repository) || [".", ".."].includes(repository.split("/")[1])) throw safeFailure();
  if (!branch || ["@", "HEAD"].includes(branch) || branch.length > 120 || /[\s\u0000-\u001f~^:?*[\\]/.test(branch) || branch.includes("..") || branch.includes("@{") || branch.includes("//") || branch.startsWith("/") || branch.startsWith("-") || branch.endsWith("/") || branch.split("/").some((part) => part.startsWith(".") || part.endsWith(".") || part.endsWith(".lock"))) throw safeFailure();
  if (/\s/.test(token)) throw safeFailure();
  return { repository, branch, token };
}

async function readBoundedJSON(response, maximum = API_RESPONSE_BYTES) {
  if (!response.body) throw safeFailure();
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) { await reader.cancel(); throw safeFailure(); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { throw safeFailure(); } finally { reader.releaseLock(); }
}

function apiClient(configuration, fetchImpl, signal) {
  return async (path, { method = "GET", body, refUpdate = false } = {}) => {
    if (signal.aborted) throw safeFailure();
    const response = await fetchImpl(`https://api.github.com/repos/${configuration.repository}${path}`, {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${configuration.token}`,
        "X-GitHub-Api-Version": "2026-03-10",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      redirect: "error",
      signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (refUpdate && [409, 422].includes(response.status)) throw conflict();
      throw safeFailure();
    }
    return readBoundedJSON(response);
  };
}

const branchPath = (branch) => branch.split("/").map(encodeURIComponent).join("/");
function sha(value) { if (typeof value !== "string" || !SHA.test(value)) throw safeFailure(); return value; }
async function head(api, branch) { return sha((await api(`/git/ref/heads/${branchPath(branch)}`)).object?.sha); }

function decodeStoredFile(response) {
  if (response?.type !== "file" || response.encoding !== "base64" || typeof response.content !== "string" || response.content.length > CONTENT_LIMITS.contentBytes * 1.5) throw safeFailure();
  const encoded = response.content.replace(/\s/g, "");
  if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw safeFailure();
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.toString("base64") !== encoded || bytes.length > CONTENT_LIMITS.contentBytes) throw safeFailure();
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { throw safeFailure(); }
}

function validateStoredContent(content, now) {
  // Reads preserve the published update date; only a publish stamps today's date.
  const previousDate = content?.profile?.updatedAt;
  try {
    const checked = validateContentBundle(content, { now });
    if (previousDate === undefined) delete checked.profile.updatedAt;
    else checked.profile.updatedAt = previousDate;
    return checked;
  } catch { throw new AdminContentError(503, "stored_content_invalid", "Stored portfolio content could not be loaded safely. Check the repository content format."); }
}

function publishInput(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).some((key) => !["content", "revision", "uploads"].includes(key))) throw invalid("Send portfolio content, its loaded revision, and optional image uploads.");
  if (typeof payload.revision !== "string" || !SHA.test(payload.revision)) throw invalid("Reload the latest repository content before publishing.");
  const uploads = payload.uploads ?? [];
  if (!Array.isArray(uploads) || uploads.length > CONTENT_LIMITS.uploads) throw invalid("Attach at most three images per publish.");
  return { ...payload, uploads };
}

async function preflightResume(content) {
  // Use only the proposed records; a successful old-build resume says nothing
  // about whether newly edited names or descriptions fit the deployed font.
  const website = content.profile.links.website.replace(/\/$/, "");
  try {
    await generateResume({
      profile: content.profile,
      clientWork: content.upwork,
      contact: { email: CONTACT_EMAIL },
      projects: content.projects.map((project) => ({ ...project, caseStudyUrl: `${website}/projects/${project.slug}` })),
      contentUpdated: content.profile.updatedAt,
    });
  } catch {
    throw new AdminContentError(400, "invalid_resume", "Resume text needs Latin transliteration or a supported font before publishing. Check the names and text used in the resume.");
  }
}

function imageType(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpeg";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export async function prepareAdminUploads(uploads, content, { signal } = {}) {
  const references = new Set(content.projects.flatMap((project) => project.images));
  const files = new Map();
  let total = 0;
  for (const upload of uploads) {
    if (signal?.aborted) throw safeFailure();
    if (!upload || typeof upload !== "object" || Array.isArray(upload) || Object.keys(upload).some((key) => key !== "dataBase64") || typeof upload.dataBase64 !== "string" || !upload.dataBase64 || upload.dataBase64.length > Math.ceil(CONTENT_LIMITS.uploadBytes / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(upload.dataBase64)) throw invalid("Upload a valid PNG, JPEG, or WebP image.");
    const bytes = Buffer.from(upload.dataBase64, "base64");
    if (bytes.toString("base64") !== upload.dataBase64) throw invalid("The image encoding is invalid.");
    total += bytes.length;
    if (total > CONTENT_LIMITS.uploadBytes) throw new AdminContentError(413, "uploads_too_large", "Image uploads must total 2 MB or less per publish.");
    const format = imageType(bytes);
    if (!format) throw invalid("Only PNG, JPEG, and WebP images can be uploaded.");
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 24);
    const publicPath = `/projects/uploads/${hash}.webp`;
    if (!references.has(publicPath)) throw invalid("Each attached image must be selected in a project before publishing.");
    if (files.has(publicPath)) continue;
    let output;
    try {
      const image = sharp(bytes, { limitInputPixels: 20_000_000, failOn: "error" });
      const metadata = await image.metadata();
      if (metadata.format !== format || (metadata.pages && metadata.pages !== 1)) throw new Error("Unsupported image");
      output = await image.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    } catch { throw invalid("The image could not be decoded safely. Use a static PNG, JPEG, or WebP under 20 megapixels."); }
    if (signal?.aborted) throw safeFailure();
    if (output.length > CONTENT_LIMITS.uploadBytes) throw new AdminContentError(413, "uploads_too_large", "The processed image is too large to publish.");
    files.set(publicPath, { path: `public${publicPath}`, bytes: output });
  }
  return [...files.values()];
}

export function createAdminContentService({
  environment = process.env,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
  snapshot = () => ({ profile: profileData, projects: projectsData, upwork: upworkData }),
  timeoutMs = 20_000,
} = {}) {
  async function operation(callback, externalSignal) {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    externalSignal?.addEventListener("abort", onAbort, { once: true });
    if (externalSignal?.aborted) controller.abort();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();
    try {
      if (controller.signal.aborted) throw safeFailure();
      return await callback(config(environment), controller.signal);
    } catch (error) {
      if (error instanceof AdminContentError) throw error;
      throw safeFailure();
    } finally { clearTimeout(timer); externalSignal?.removeEventListener("abort", onAbort); }
  }
  return {
    read({ signal } = {}) {
      return operation(async (configuration, operationSignal) => {
        const info = { repository: configuration.repository, branch: configuration.branch, publishingConfigured: Boolean(configuration.token) };
        if (!configuration.token) return { ...info, content: validateStoredContent(snapshot(), now()), revision: null };
        const api = apiClient(configuration, fetchImpl, operationSignal);
        const revision = await head(api, configuration.branch);
        const entries = await Promise.all(Object.entries(FILES).map(async ([key, path]) => [key, decodeStoredFile(await api(`/contents/${path}?ref=${revision}`))]));
        return { ...info, content: validateStoredContent(Object.fromEntries(entries), now()), revision };
      }, signal);
    },
    publish(payload, { signal } = {}) {
      return operation(async (configuration, operationSignal) => {
        if (!configuration.token) throw new AdminContentError(503, "publishing_not_configured", "Publishing is not configured. Add the server-only GitHub repository credential first.");
        const input = publishInput(payload);
        const content = validateContentBundle(input.content, { now: now() });
        const api = apiClient(configuration, fetchImpl, operationSignal);
        const current = await head(api, configuration.branch);
        if (current !== input.revision) throw conflict();
        await preflightResume(content);
        const images = await prepareAdminUploads(input.uploads, content, { signal: operationSignal });
        const base = await api(`/git/commits/${current}`);
        const baseTree = sha(base.tree?.sha);
        const imageEntries = [];
        // All content and image validation finishes before the first GitHub write.
        for (const image of images) {
          const blob = await api("/git/blobs", { method: "POST", body: { content: image.bytes.toString("base64"), encoding: "base64" } });
          imageEntries.push({ path: image.path, mode: "100644", type: "blob", sha: sha(blob.sha) });
        }
        const tree = await api("/git/trees", { method: "POST", body: {
          base_tree: baseTree,
          tree: [
            ...Object.entries(FILES).map(([key, path]) => ({ path, mode: "100644", type: "blob", content: `${JSON.stringify(content[key], null, 2)}\n` })),
            ...imageEntries,
          ],
        } });
        const commit = await api("/git/commits", { method: "POST", body: { message: "Update portfolio content from admin", tree: sha(tree.sha), parents: [current] } });
        const revision = sha(commit.sha);
        const updated = await api(`/git/refs/heads/${branchPath(configuration.branch)}`, { method: "PATCH", body: { sha: revision, force: false }, refUpdate: true });
        if (sha(updated.object?.sha) !== revision) throw safeFailure();
        return { revision, commitUrl: `https://github.com/${configuration.repository}/commit/${revision}`, message: "Changes committed; Vercel deployment pending." };
      }, signal);
    },
  };
}

function responseError(error, authErrorClass) {
  const recognized = error instanceof AdminContentError || (authErrorClass && error instanceof authErrorClass);
  return Response.json({ error: { code: recognized ? error.code : "admin_unavailable", message: recognized ? error.message : "The admin service is unavailable. Please try again." } }, { status: recognized ? error.status : 503, headers: { "Cache-Control": "no-store" } });
}

async function readPublishRequest(request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new AdminContentError(415, "invalid_content_type", "Send a JSON publish request.");
  const size = Number(request.headers.get("content-length"));
  if (size > CONTENT_LIMITS.requestBytes) throw new AdminContentError(413, "request_too_large", "The publish request is too large.");
  if (!request.body) throw invalid("Send portfolio content to publish.");
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > CONTENT_LIMITS.requestBytes) { await reader.cancel(); throw new AdminContentError(413, "request_too_large", "The publish request is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))); } catch { throw invalid("The publish request is not valid JSON."); }
}

/** Injectable transport/auth boundaries keep route tests offline. */
export function createAdminContentHandlers({ assertRequest, authErrorClass, service = createAdminContentService() } = {}) {
  return {
    async GET(request) {
      try { await assertRequest(request, { mutation: false }); return Response.json(await service.read({ signal: request.signal }), { headers: { "Cache-Control": "no-store" } }); }
      catch (error) { return responseError(error, authErrorClass); }
    },
    async PUT(request) {
      try { await assertRequest(request, { mutation: true }); const payload = await readPublishRequest(request); return Response.json(await service.publish(payload, { signal: request.signal }), { headers: { "Cache-Control": "no-store" } }); }
      catch (error) { return responseError(error, authErrorClass); }
    },
  };
}
