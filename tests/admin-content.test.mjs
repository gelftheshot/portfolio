import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import sharp from "sharp";
import profile from "../data/profile.json" with { type: "json" };
import projects from "../data/projects.json" with { type: "json" };
import upwork from "../data/upwork.json" with { type: "json" };
import { AdminContentError, CONTENT_LIMITS, validateContentBundle } from "../lib/admin/content-schema.js";
import { createAdminContentHandlers, createAdminContentService, prepareAdminUploads } from "../lib/server/admin-github.js";

const BASE = "a".repeat(40);
const BASE_TREE = "b".repeat(40);
const TREE = "c".repeat(40);
const COMMIT = "d".repeat(40);
const BLOB = "e".repeat(40);
const environment = { ADMIN_GITHUB_TOKEN: "fixture-token-no-network" };
const now = () => new Date("2026-11-04T12:00:00Z");
const bundle = () => structuredClone({ profile, projects, upwork });
const payload = () => ({ content: bundle(), revision: BASE, uploads: [] });
const stored = { "data/profile.json": profile, "data/projects.json": projects, "data/upwork.json": upwork };

function github({ race = false, badRead = false, failedStatus, thrownError } = {}) {
  const calls = [];
  return {
    calls,
    async fetch(url, options) {
      const parsed = new URL(url);
      const path = parsed.pathname.replace("/repos/gelftheshot/portfolio", "");
      const body = options.body && JSON.parse(options.body);
      calls.push({ url, options, path, body });
      assert.equal(parsed.origin, "https://api.github.com");
      assert.equal(options.redirect, "error");
      assert.equal(options.cache, "no-store");
      assert.equal(options.headers.Authorization, "Bearer fixture-token-no-network");
      assert.equal(options.headers["X-GitHub-Api-Version"], "2026-03-10");
      if (thrownError) throw thrownError;
      if (failedStatus) return new Response("private-provider-diagnostic", { status: failedStatus });
      if (path === "/git/ref/heads/main") return Response.json({ object: { sha: BASE } });
      if (path.startsWith("/contents/")) {
        assert.equal(parsed.searchParams.get("ref"), BASE, "all three reads target the same immutable commit");
        if (badRead) return Response.json({ type: "file", encoding: "base64", content: "!!invalid!!" });
        const content = stored[path.slice("/contents/".length)];
        assert.ok(content, "reads are limited to the three public content paths");
        return Response.json({ type: "file", encoding: "base64", content: Buffer.from(JSON.stringify(content)).toString("base64") });
      }
      if (path === `/git/commits/${BASE}`) return Response.json({ tree: { sha: BASE_TREE } });
      if (path === "/git/blobs") return Response.json({ sha: BLOB });
      if (path === "/git/trees") return Response.json({ sha: TREE });
      if (path === "/git/commits") return Response.json({ sha: COMMIT });
      if (path === "/git/refs/heads/main") return race ? Response.json({ message: "provider-private" }, { status: 422 }) : Response.json({ object: { sha: COMMIT } });
      throw new Error("Unexpected test request");
    },
  };
}
const service = (transport, options = {}) => createAdminContentService({ environment, fetchImpl: transport.fetch, now, ...options });
const writes = (transport) => transport.calls.filter((call) => call.options.method !== "GET");
async function imageUpload(format = "png") {
  const bytes = await sharp({ create: { width: 24, height: 20, channels: 3, background: "#999999" } })[format]().toBuffer();
  const path = `/projects/uploads/${createHash("sha256").update(bytes).digest("hex").slice(0, 24)}.webp`;
  return { bytes, path, upload: { dataBase64: bytes.toString("base64") } };
}

test("current public content validates without losing advanced fields or mutating input", () => {
  const content = bundle();
  const original = JSON.stringify(content);
  const result = validateContentBundle(content, { now: now() });
  assert.equal(JSON.stringify(content), original);
  assert.equal(result.profile.updatedAt, "2026-11-04");
  assert.deepEqual(result.projects[0].caseStudy, projects[0].caseStudy);
  assert.deepEqual(result.profile.certifications, profile.certifications);
  assert.equal(result.upwork.profile.completedJobCount, result.upwork.completedWork.length);
  assert.equal(result.upwork.profile.writtenReviewCount, result.upwork.completedWork.filter((job) => job.feedback).length);
  assert.equal(result.upwork.profile.snapshotDate, upwork.profile.snapshotDate);
});

test("optional presentation copy is validated while older profiles remain supported", () => {
  const content = bundle();
  content.profile.introduction = "I build useful AI systems and backend APIs.";
  content.profile.about = "An engineer focused on connected data and workflow automation.";
  content.profile.headline = { first: "AI & backend.", second: "Built to connect." };
  const result = validateContentBundle(content, { now: now() });
  assert.equal(result.profile.introduction, content.profile.introduction);
  assert.equal(result.profile.about, content.profile.about);
  assert.deepEqual(result.profile.headline, content.profile.headline);
  delete content.profile.introduction; delete content.profile.about; delete content.profile.headline;
  assert.doesNotThrow(() => validateContentBundle(content, { now: now() }));
});

test("presentation fields reject excess length, wrong types and unsupported nested fields", async (t) => {
  const mutations = [
    ["long introduction", (p) => { p.introduction = "a".repeat(801); }],
    ["long about copy", (p) => { p.about = "a".repeat(1501); }],
    ["long headline", (p) => { p.headline = { first: "a".repeat(101), second: "Text" }; }],
    ["unsupported nested HTML field", (p) => { p.headline = { first: "Text", second: "Text", html: "<script>example</script>" }; }],
    ["headline prototype field", (p) => { p.headline = JSON.parse('{"first":"Text","second":"Text","__proto__":{}}'); }],
    ["headline wrong type", (p) => { p.headline = { first: {}, second: "Text" }; }],
  ];
  for (const [name, mutate] of mutations) await t.test(name, () => { const content = bundle(); mutate(content.profile); assert.throws(() => validateContentBundle(content, { now: now() }), (error) => error instanceof AdminContentError && error.status === 400); });
});

test("schema bounds content and rejects unsafe fields, paths, links, identities, dates and quotes", async (t) => {
  const mutations = [
    ["unknown root field", (c) => { c.environment = {}; }],
    ["unknown profile field", (c) => { c.profile.apiKey = "private"; }],
    ["duplicate slug", (c) => { c.projects[1].slug = c.projects[0].slug; }],
    ["duplicate employer id", (c) => { c.profile.experience[1].id = c.profile.experience[0].id; }],
    ["reserved employer id", (c) => { c.profile.experience[0].id = "contact"; }],
    ["duplicate review id", (c) => { c.upwork.completedWork[1].id = c.upwork.completedWork[0].id; }],
    ["path traversal", (c) => { c.projects[0].images = ["/projects/../secret.png"]; }],
    ["encoded traversal", (c) => { c.projects[0].images = ["/projects/%2e%2e/secret.png"]; }],
    ["remote image", (c) => { c.projects[0].images = ["https://example.test/image.png"]; }],
    ["script link", (c) => { c.projects[0].website = "javascript:alert(1)"; }],
    ["incomplete link", (c) => { c.projects[0].website = "https:example.test"; }],
    ["credential URL", (c) => { c.projects[0].website = "https://user:fixture@example.test/"; }],
    ["bad date", (c) => { c.upwork.completedWork[0].startDate = "2026-02-31"; }],
    ["bad rating", (c) => { c.upwork.completedWork[0].rating = 99; }],
    ["invented excerpt", (c) => { c.upwork.completedWork[0].feedbackExcerpt = "A sentence absent from this source review"; }],
    ["dangling project reference", (c) => { c.profile.automationFocus.projectEvidence[0].slug = "missing-project"; }],
    ["prototype field", (c) => { c.profile.skills.constructor = ["unsafe"]; }],
    ["credential text", (c) => { c.profile.summary = "sk-proj-" + "a".repeat(40); }],
    ["excluded portfolio reference", (c) => { c.profile.summary = String.fromCharCode(108, 101, 103, 97, 108, 100, 98) + ".ai"; }],
    ["too many projects", (c) => { c.projects = Array.from({ length: 51 }, () => c.projects[0]); }],
  ];
  for (const [name, mutate] of mutations) await t.test(name, () => { const content = bundle(); mutate(content); assert.throws(() => validateContentBundle(content, { now: now() }), (error) => error instanceof AdminContentError && error.status === 400); });
  const large = bundle(); large.profile.summary = "a".repeat(CONTENT_LIMITS.contentBytes);
  assert.throws(() => validateContentBundle(large), (error) => error.status === 413);
});

test("current roles can omit an end year and review counts follow stored source records", () => {
  const content = bundle(); content.profile.experience[0].endYear = "";
  content.upwork.profile.completedJobCount = 1; content.upwork.profile.writtenReviewCount = 0;
  const checked = validateContentBundle(content, { now: now() });
  assert.equal(Object.hasOwn(checked.profile.experience[0], "endYear"), false);
  assert.equal(checked.upwork.profile.completedJobCount, 10);
  assert.equal(checked.upwork.profile.writtenReviewCount, 9);
});

test("authenticated local snapshot remains readable without publishing credentials and never writes", async () => {
  let calls = 0;
  const local = createAdminContentService({ environment: {}, fetchImpl: () => { calls += 1; throw new Error("No network"); }, now });
  const result = await local.read();
  assert.equal(result.publishingConfigured, false); assert.equal(result.revision, null); assert.equal(result.repository, "gelftheshot/portfolio"); assert.equal(result.content.projects.length, 11);
  assert.equal(result.content.profile.updatedAt, profile.updatedAt);
  await assert.rejects(local.publish(payload()), (error) => error.status === 503 && error.code === "publishing_not_configured");
  assert.equal(calls, 0);
});

test("repository reads use one revision for all three fixed files", async () => {
  const transport = github(); const result = await service(transport).read();
  assert.equal(result.revision, BASE); assert.equal(result.branch, "main"); assert.equal(result.publishingConfigured, true);
  assert.equal(transport.calls.length, 4); assert.equal(writes(transport).length, 0);
  assert.deepEqual(result.content.projects, projects);
});

test("publish commits all three JSON files atomically on top of the loaded revision", async () => {
  const transport = github(); const input = payload(); input.content.projects[0].description = "Updated owner-approved public description.";
  const result = await service(transport).publish(input);
  assert.equal(result.revision, COMMIT); assert.equal(result.commitUrl, `https://github.com/gelftheshot/portfolio/commit/${COMMIT}`);
  assert.equal(result.message, "Changes committed; Vercel deployment pending.");
  const treeCall = transport.calls.find((call) => call.path === "/git/trees");
  assert.equal(treeCall.body.base_tree, BASE_TREE);
  assert.deepEqual(treeCall.body.tree.map((entry) => entry.path), Object.keys(stored));
  assert.equal(JSON.parse(treeCall.body.tree[0].content).updatedAt, "2026-11-04");
  assert.equal(JSON.parse(treeCall.body.tree[1].content)[0].description, input.content.projects[0].description);
  const commitCall = transport.calls.find((call) => call.path === "/git/commits");
  assert.deepEqual(commitCall.body.parents, [BASE]); assert.equal(commitCall.body.tree, TREE);
  assert.deepEqual(transport.calls.at(-1).body, { sha: COMMIT, force: false });
  assert.equal(transport.calls.filter((call) => call.path === "/git/trees").length, 1);
  assert.equal(transport.calls.filter((call) => call.path === "/git/commits").length, 1);
});

test("stale edits are rejected before any GitHub writes and races cannot overwrite main", async () => {
  const stale = github(); const input = payload(); input.revision = "f".repeat(40);
  await assert.rejects(service(stale).publish(input), (error) => error.status === 409);
  assert.equal(stale.calls.length, 1); assert.equal(writes(stale).length, 0);
  const racing = github({ race: true });
  await assert.rejects(service(racing).publish(payload()), (error) => error.status === 409 && error.code === "content_conflict");
  assert.equal(racing.calls.at(-1).body.force, false);
});

test("unsupported resume names fail preflight before any repository write", async (t) => {
  for (const name of ["Portfolio Owner \u{1F600}", "\u120A\u1206\u1295"]) await t.test("unsupported name", async () => {
    const input = payload(); input.content.profile.name = name;
    const transport = github();
    await assert.rejects(service(transport).publish(input), (error) => error.status === 400 && error.code === "invalid_resume" && error.message.includes("Latin transliteration") && !error.message.includes(name));
    assert.equal(writes(transport).length, 0);
  });
});

test("Latin accented names pass resume preflight and remain intact in published data", async () => {
  const input = payload(); input.content.profile.name = "Renée García";
  input.content.projects[0].title = "Système côtier";
  const transport = github();
  const result = await service(transport).publish(input);
  assert.equal(result.revision, COMMIT);
  const tree = transport.calls.find((call) => call.path === "/git/trees").body.tree;
  assert.equal(JSON.parse(tree[0].content).name, "Renée García");
  assert.equal(JSON.parse(tree[1].content)[0].title, "Système côtier");
});

test("invalid configuration and malicious publish payloads never reach a write", async (t) => {
  for (const override of [{ ADMIN_GITHUB_REPOSITORY: "owner/../../secret" }, { ADMIN_GITHUB_BRANCH: "main?private" }, { ADMIN_GITHUB_BRANCH: "../main" }, { ADMIN_GITHUB_BRANCH: "main\\secret" }, { ADMIN_GITHUB_BRANCH: "@" }, { ADMIN_GITHUB_BRANCH: "HEAD" }, { ADMIN_GITHUB_TOKEN: "two tokens" }]) await t.test(Object.keys(override)[0], async () => { const transport = github(); await assert.rejects(service(transport, { environment: { ...environment, ...override } }).read(), (error) => error.status === 503); assert.equal(transport.calls.length, 0); });
  for (const mutate of [(p) => { p.path = ".env.local"; }, (p) => { p.content.projects[0].code = "arbitrary code"; }, (p) => { p.revision = null; }, (p) => { p.uploads = Array(4).fill({ dataBase64: "eA==" }); }]) { const transport = github(); const input = payload(); mutate(input); await assert.rejects(service(transport).publish(input), (error) => error.status === 400); assert.equal(writes(transport).length, 0); }
});

test("supported image formats become bounded WebP files with server-derived paths", async (t) => {
  for (const format of ["png", "jpeg", "webp"]) await t.test(format, async () => {
    const image = await imageUpload(format); const content = bundle(); content.projects[0].images.unshift(image.path);
    const files = await prepareAdminUploads([image.upload], content);
    assert.equal(files[0].path, `public${image.path}`);
    const metadata = await sharp(files[0].bytes).metadata(); assert.equal(metadata.format, "webp"); assert.equal(metadata.width, 24); assert.equal(metadata.height, 20); assert.equal(metadata.exif, undefined);
  });
});

test("image publishing places the derived blob in the same tree and commit as content", async () => {
  const image = await imageUpload(); const input = payload(); input.content.projects[0].images.unshift(image.path); input.uploads = [image.upload, image.upload];
  const transport = github(); await service(transport).publish(input);
  const blobs = transport.calls.filter((call) => call.path === "/git/blobs"); assert.equal(blobs.length, 1, "duplicate uploads reuse the same blob");
  assert.equal((await sharp(Buffer.from(blobs[0].body.content, "base64")).metadata()).format, "webp");
  const tree = transport.calls.find((call) => call.path === "/git/trees").body.tree;
  assert.deepEqual(tree.at(-1), { path: `public${image.path}`, mode: "100644", type: "blob", sha: BLOB });
  assert.ok(JSON.parse(tree[1].content)[0].images.includes(image.path));
});

test("unused, oversized, forged and path-injected uploads do not create blobs", async (t) => {
  const image = await imageUpload();
  const cases = [
    ["unused", [image.upload]],
    ["path injection", [{ ...image.upload, path: ".env.local" }]],
    ["bad base64", [{ dataBase64: "not:base64" }]],
    ["SVG", [{ dataBase64: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>').toString("base64") }]],
    ["undecodable", [{ dataBase64: Buffer.from([255, 216, 255, 0, 0]).toString("base64") }]],
  ];
  for (const [name, uploads] of cases) await t.test(name, async () => { const transport = github(); const input = payload(); input.uploads = uploads; if (name !== "unused") input.content.projects[0].images.unshift(image.path); await assert.rejects(service(transport).publish(input), (error) => [400, 413].includes(error.status)); assert.equal(writes(transport).length, 0); });
  const oversized = Buffer.alloc(CONTENT_LIMITS.uploadBytes + 1); oversized.set([137, 80, 78, 71, 13, 10, 26, 10]);
  await assert.rejects(prepareAdminUploads([{ dataBase64: oversized.toString("base64") }], bundle()), (error) => error.status === 413);
});

test("compressed images exceeding the decoded pixel budget are rejected before writes", async () => {
  const bytes = await sharp({ create: { width: 4500, height: 4500, channels: 3, background: "#888888" } }).png().toBuffer();
  assert.ok(bytes.length < CONTENT_LIMITS.uploadBytes);
  const path = `/projects/uploads/${createHash("sha256").update(bytes).digest("hex").slice(0, 24)}.webp`;
  const input = payload(); input.content.projects[0].images.unshift(path); input.uploads = [{ dataBase64: bytes.toString("base64") }];
  const transport = github();
  await assert.rejects(service(transport).publish(input), (error) => error.status === 400 && error.message.includes("20 megapixels"));
  assert.equal(writes(transport).length, 0);
});

test("provider errors, malformed stored files and timeouts do not expose credentials or diagnostics", async () => {
  for (const transport of [github({ failedStatus: 403 }), github({ badRead: true }), github({ thrownError: new Error("private-provider-diagnostic") })]) {
    await assert.rejects(service(transport).read(), (error) => error.status === 503 && !/private-provider|fixture-token/.test(error.message));
  }
  const slow = createAdminContentService({ environment, timeoutMs: 10, fetchImpl: async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("private timeout")), { once: true })) });
  let keepAlive;
  try { await assert.rejects(Promise.race([slow.read(), new Promise((_resolve, reject) => { keepAlive = setTimeout(() => reject(new Error("Test deadline exceeded")), 1000); })]), (error) => error.status === 503 && !error.message.includes("private")); } finally { clearTimeout(keepAlive); }
  const abort = new AbortController(); abort.abort(); const transport = github(); await assert.rejects(service(transport).read({ signal: abort.signal }), (error) => error.status === 503); assert.equal(transport.calls.length, 0);
});

class FixtureAuthError extends Error { constructor(status = 401) { super("Sign in to continue."); this.status = status; this.code = "unauthorized"; } }
const request = (body, headers = {}) => new Request("https://portfolio.example/api/admin/content", { method: "PUT", headers: { "Content-Type": "application/json", Origin: "https://portfolio.example", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });

test("route guards run before reading or publishing data and all responses are no-store", async () => {
  let serviceCalls = 0;
  const handlers = createAdminContentHandlers({ authErrorClass: FixtureAuthError, assertRequest: () => { throw new FixtureAuthError(); }, service: { read: () => { serviceCalls += 1; }, publish: () => { serviceCalls += 1; } } });
  for (const response of [await handlers.GET(new Request("https://portfolio.example/api/admin/content")), await handlers.PUT(request("bad json"))]) { assert.equal(response.status, 401); assert.equal(response.headers.get("cache-control"), "no-store"); }
  assert.equal(serviceCalls, 0);
});

test("route accepts valid guarded content and rejects missing/invalid/oversized JSON", async () => {
  const mutations = []; const handlers = createAdminContentHandlers({ authErrorClass: FixtureAuthError, assertRequest: (_request, options) => mutations.push(options.mutation), service: { read: async () => ({ revision: BASE }), publish: async (body) => ({ revision: body.revision }) } });
  assert.equal((await handlers.GET(new Request("https://portfolio.example/api/admin/content"))).status, 200);
  const ok = await handlers.PUT(request(payload())); assert.equal(ok.status, 200); assert.equal(ok.headers.get("cache-control"), "no-store"); assert.deepEqual(mutations, [false, true]);
  assert.equal((await handlers.PUT(request("{}", { "Content-Type": "text/plain" }))).status, 415);
  assert.equal((await handlers.PUT(request("{}", { "Content-Type": "application/json-invalid" }))).status, 415);
  assert.equal((await handlers.PUT(request("not json"))).status, 400);
  assert.equal((await handlers.PUT(request("{}", { "Content-Length": String(CONTENT_LIMITS.requestBytes + 1) }))).status, 413);
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(CONTENT_LIMITS.requestBytes + 1)); controller.close(); } });
  const large = new Request("https://portfolio.example/api/admin/content", { method: "PUT", headers: { "Content-Type": "application/json" }, body: stream, duplex: "half" });
  assert.equal((await handlers.PUT(large)).status, 413);
});

test("unrecognized route exceptions return a safe generic error", async () => {
  const handlers = createAdminContentHandlers({ assertRequest: () => true, service: { read: async () => { throw new Error("private-provider-diagnostic"); } } });
  const response = await handlers.GET(new Request("https://portfolio.example/api/admin/content"));
  assert.equal(response.status, 503); assert.equal((await response.text()).includes("private-provider"), false);
});
