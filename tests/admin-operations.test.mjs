import test from "node:test";
import assert from "node:assert/strict";
import { createAdminAuth, createAdminPasswordHash } from "../lib/server/admin-auth.js";
import {
  ARCHIVE_CONTACT_SCRIPT, LIST_ADMIN_MESSAGES_SCRIPT, UPDATE_CONTACT_STATUS_SCRIPT,
  DEFAULT_ASSISTANT_SETTINGS, createAdminOperations,
} from "../lib/server/admin-operations.js";

const BASE = "https://portfolio.example.test";
const PRIVATE = "private-contact-marker@example.test";
const UUID = "243df0d5-d851-46e0-89f2-ed231767e473";
const fields = { name: "Portfolio visitor", email: PRIVATE, message: "A private opportunity enquiry." };
const environment = (extra = {}) => ({ NODE_ENV: "development", ...extra });
const shared = (extra = {}) => environment({ NODE_ENV: "production", UPSTASH_REDIS_REST_URL: "https://private-storage.example.test", UPSTASH_REDIS_REST_TOKEN: "private-redis-token", ...extra });
function request(path = "/api/admin/operations", method = "GET", payload, headers = {}) {
  return new Request(`${BASE}${path}`, { method, headers: {
    Origin: BASE, "Content-Type": "application/json", ...headers,
  }, ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}) });
}
const contact = (id = UUID, extra = {}) => request("/api/contact", "POST", { id, ...fields, ...extra });
const handlers = (options = {}) => createAdminOperations({
  environment: environment(), assertRequest: () => true, rateLimit: () => ({ allowed: true }), ...options,
});

function redisFixture() {
  let settings = null;
  const messages = new Map();
  const calls = [];
  let clock = Date.parse("2026-11-04T10:00:00Z");
  function prune() {
    for (const [id, item] of messages) if (item.expires <= clock) messages.delete(id);
  }
  return {
    calls, advance: (ms) => { clock += ms; },
    fetchImpl: async (url, options) => {
      assert.equal(url, "https://private-storage.example.test");
      assert.equal(options.headers.Authorization, "Bearer private-redis-token");
      assert.equal(options.cache, "no-store");
      assert.equal(options.redirect, "error");
      const command = JSON.parse(options.body);
      calls.push(command);
      prune();
      let result;
      if (command[0] === "GET") {
        assert.deepEqual(command, ["GET", "{portfolio-admin-ops}:settings"]);
        result = settings;
      } else if (command[0] === "SET") {
        assert.equal(command[1], "{portfolio-admin-ops}:settings");
        assert.equal(command.length, 3);
        settings = command[2]; result = "OK";
      } else {
        assert.equal(command[0], "EVAL");
        assert.deepEqual(command.slice(2, 5), [2, "{portfolio-admin-ops}:settings", "{portfolio-admin-ops}:messages"]);
        if (command[1] === LIST_ADMIN_MESSAGES_SCRIPT) {
          assert.equal(command.length, 5);
          result = [settings || "", ...[...messages.values()].reverse().map((item) => JSON.stringify(item.record))];
        } else if (command[1] === ARCHIVE_CONTACT_SCRIPT) {
          assert.equal(command.length, 7);
          const incoming = JSON.parse(command[6]);
          assert.equal(incoming.id, command[5]);
          const existing = messages.get(incoming.id);
          if (existing) result = [Object.keys(fields).every((key) => incoming[key] === existing.record[key]) ? 0 : 2, existing.record.createdAt];
          else {
            messages.set(incoming.id, { record: { ...incoming, createdAt: clock }, expires: clock + 30 * 86400_000 });
            while (messages.size > 200) messages.delete(messages.keys().next().value);
            result = [1, clock];
          }
        } else if (command[1] === UPDATE_CONTACT_STATUS_SCRIPT) {
          assert.equal(command.length, 7);
          const existing = messages.get(command[5]);
          if (existing) existing.record.status = command[6];
          result = existing ? JSON.stringify(existing.record) : "";
        } else assert.fail("Only fixed private storage scripts may execute");
      }
      return Response.json({ result });
    },
  };
}

test("private operations require a real owner session, and mutations require exact same origin", async () => {
  const password = "private operations test password";
  const hash = await createAdminPasswordHash(password, { salt: Buffer.alloc(16, 4) });
  const auth = createAdminAuth({ environment: environment({ ADMIN_PASSWORD_HASH: hash, ADMIN_SESSION_SECRET: Buffer.alloc(32, 5).toString("base64url") }) });
  const operations = handlers({ assertRequest: auth.assertRequest });
  const unauthenticated = await operations.GET(request());
  assert.equal(unauthenticated.status, 401);
  assert.doesNotMatch(await unauthenticated.text(), /settings|messages|private-contact/);
  const signed = await auth.POST(request("/api/admin/session", "POST", { password }));
  const Cookie = signed.headers.get("set-cookie").split(";")[0];
  assert.equal((await operations.GET(request(undefined, "GET", undefined, { Cookie }))).status, 200);
  for (const Origin of ["", "https://other.example.test", "https://portfolio.example.test.evil.test"]) {
    const result = await operations.PUT(request(undefined, "PUT", { settings: DEFAULT_ASSISTANT_SETTINGS }, { Cookie, Origin }));
    assert.equal(result.status, 403);
  }
  assert.equal((await operations.PUT(request(undefined, "PUT", { settings: DEFAULT_ASSISTANT_SETTINGS }, { Cookie, "Sec-Fetch-Site": "same-site" }))).status, 403);
  assert.equal((await operations.PUT(request(undefined, "PUT", { settings: DEFAULT_ASSISTANT_SETTINGS }, { Cookie }))).status, 200);
});

test("development preview defaults expose only configuration booleans, with no secret values", async () => {
  const operations = handlers({ environment: environment({ OPENAI_API_KEY: "sk-private-fixture", NEXT_PUBLIC_SERVICE_ID: "service-private", NEXT_PUBLIC_TEMPLATE_ID: "template-private", NEXT_PUBLIC_PUBLIC_KEY: "public-private" }) });
  const result = await operations.GET(request());
  assert.match(result.headers.get("cache-control"), /private, no-store/);
  const payload = await result.json();
  assert.deepEqual(payload, { settings: DEFAULT_ASSISTANT_SETTINGS, messages: [], storage: "memory", configuration: { openAI: true, emailJS: true, storage: false } });
  assert.doesNotMatch(JSON.stringify(payload), /sk-private|service-private|template-private|public-private/);
});

test("settings accept only bounded whitelisted values and do not accept credential editing", async () => {
  const operations = handlers();
  for (const settings of [null, {}, { ...DEFAULT_ASSISTANT_SETTINGS, apiKey: "sk-private" }, { ...DEFAULT_ASSISTANT_SETTINGS, enabled: "true" }, { ...DEFAULT_ASSISTANT_SETTINGS, model: "https://attacker.test" }, { ...DEFAULT_ASSISTANT_SETTINGS, model: "x".repeat(101) }, { ...DEFAULT_ASSISTANT_SETTINGS, instructions: "x".repeat(2001) }, { ...DEFAULT_ASSISTANT_SETTINGS, instructions: "bad\u0000text" }]) {
    assert.equal((await operations.PUT(request(undefined, "PUT", { settings }))).status, 400);
  }
  assert.equal((await operations.PUT(request(undefined, "PUT", { settings: DEFAULT_ASSISTANT_SETTINGS, key: "secret" }))).status, 400);
  const settings = { enabled: false, model: "gpt-6.1-sol", instructions: "  Prefer concise answers.  " };
  assert.equal((await operations.PUT(request(undefined, "PUT", { settings }))).status, 200);
  assert.deepEqual(await operations.readSettings(), { ...settings, instructions: "Prefer concise answers." });
});

test("memory inbox deduplicates UUID submissions, preserves status, and expires after 30 days", async () => {
  let now = Date.parse("2026-11-04T10:00:00Z");
  const operations = handlers({ now: () => now });
  const accepted = await operations.POST(contact());
  assert.equal(accepted.status, 201);
  assert.deepEqual(await accepted.json(), { received: true, id: UUID });
  assert.equal((await operations.POST(contact())).status, 200);
  assert.equal((await operations.POST(contact(UUID, { message: "changed" }))).status, 409);
  const updated = await operations.PATCH(request(`/api/admin/messages/${UUID}`, "PATCH", { status: "archived" }), { params: Promise.resolve({ id: UUID }) });
  assert.equal((await updated.json()).message.status, "archived");
  assert.equal((await operations.POST(contact())).status, 200);
  let payload = await (await operations.GET(request())).json();
  assert.equal(payload.messages.length, 1);
  assert.equal(payload.messages[0].status, "archived");
  now += 30 * 86400_000;
  payload = await (await operations.GET(request())).json();
  assert.deepEqual(payload.messages, []);
  assert.equal((await operations.PATCH(request(undefined, "PATCH", { status: "read" }), { params: { id: UUID } })).status, 404);
});

test("inbox retains at most the latest 200 messages", async () => {
  let clock = 1000;
  const operations = handlers({ now: () => clock++ });
  for (let index = 0; index < 202; index++) {
    const id = `${index.toString(16).padStart(8, "0")}-d851-46e0-89f2-ed231767e473`;
    assert.equal((await operations.POST(contact(id))).status, 201);
  }
  const { messages } = await (await operations.GET(request())).json();
  assert.equal(messages.length, 200);
  assert.equal(messages.at(-1).id.startsWith("00000002"), true);
});

test("shared storage uses only fixed commands, preserves TTL on status edits and never returns private fields publicly", async () => {
  const redis = redisFixture();
  const operations = handlers({ environment: shared(), fetchImpl: redis.fetchImpl });
  assert.deepEqual(await operations.readSettings(), DEFAULT_ASSISTANT_SETTINGS);
  const settings = { enabled: false, model: "gpt-6.1-sol", instructions: "Use short answers." };
  assert.equal((await operations.PUT(request(undefined, "PUT", { settings }))).status, 200);
  assert.deepEqual(await operations.readSettings(), settings);
  const accepted = await operations.POST(contact());
  assert.equal(accepted.status, 201);
  assert.doesNotMatch(await accepted.text(), /private-contact|Portfolio visitor|private opportunity|createdAt/);
  assert.equal((await operations.POST(contact())).status, 200);
  redis.advance(29 * 86400_000);
  const updated = await operations.PATCH(request(undefined, "PATCH", { status: "read" }), { params: Promise.resolve({ id: UUID }) });
  assert.equal((await updated.json()).message.status, "read");
  const inbox = await (await operations.GET(request())).json();
  assert.equal(inbox.storage, "shared");
  assert.equal(inbox.configuration.storage, true);
  assert.equal(inbox.messages[0].email, PRIVATE);
  redis.advance(86400_000);
  assert.deepEqual((await (await operations.GET(request())).json()).messages, []);
  assert.match(ARCHIVE_CONTACT_SCRIPT, /'EX', 2592000/);
  assert.match(ARCHIVE_CONTACT_SCRIPT, /ZCARD.*- 200/);
  assert.match(UPDATE_CONTACT_STATUS_SCRIPT, /'PTTL'/);
  assert.match(UPDATE_CONTACT_STATUS_SCRIPT, /'PX', ttl/);
  assert.equal(redis.calls.some((command) => command[0] === "EVAL" && command[1] === LIST_ADMIN_MESSAGES_SCRIPT), true);
});

test("Vercel integration aliases serve settings, private inbox and the contact admission guard", async () => {
  const redis = redisFixture();
  let admissions = 0;
  const operations = handlers({
    environment: environment({ NODE_ENV: "production", KV_REST_API_URL: "https://private-storage.example.test", KV_REST_API_TOKEN: "private-redis-token" }),
    rateLimit: undefined,
    fetchImpl: async (url, options) => {
      const command = JSON.parse(options.body);
      if (command[0] === "EVAL" && command[3].startsWith("{portfolio-contact}:chat:client:")) {
        admissions += 1;
        assert.equal(url, "https://private-storage.example.test");
        assert.equal(options.headers.Authorization, "Bearer private-redis-token");
        assert.deepEqual(command.slice(-3), [5, 60, 100]);
        return Response.json({ result: [0, 0] });
      }
      return redis.fetchImpl(url, options);
    },
  });
  assert.deepEqual(await operations.readSettings(), DEFAULT_ASSISTANT_SETTINGS);
  assert.equal((await operations.POST(contact())).status, 201);
  assert.equal(admissions, 1);
  const inbox = await (await operations.GET(request())).json();
  assert.equal(inbox.storage, "shared");
  assert.equal(inbox.messages[0].id, UUID);
});

test("production missing/malformed storage and backend outages fail closed without disclosing secrets or PII", async () => {
  for (const env of [environment({ NODE_ENV: "production" }), shared({ UPSTASH_REDIS_REST_URL: "http://private-storage.example.test" }), shared({ UPSTASH_REDIS_REST_URL: "https://user:secret@private-storage.example.test" }), shared({ UPSTASH_REDIS_REST_TOKEN: "" })]) {
    const operations = handlers({ environment: env, fetchImpl: () => { assert.fail("No request to invalid backend"); } });
    assert.equal((await operations.GET(request())).status, 503);
    await assert.rejects(operations.readSettings(), { status: 503 });
    assert.equal((await operations.POST(contact())).status, 503);
  }
  for (const fetchImpl of [async () => { throw new Error(`private-redis-token ${PRIVATE}`); }, async () => Response.json({ error: `private-redis-token ${PRIVATE}` }), async () => Response.json({ result: ["", "corrupted private-contact-marker@example.test"] }), async () => new Response("private-redis-token", { status: 500 })]) {
    const operations = handlers({ environment: shared(), fetchImpl });
    const result = await operations.GET(request());
    assert.equal(result.status, 503);
    assert.doesNotMatch(await result.text(), /private-redis-token|private-contact-marker/);
  }
});

test("contact requires same origin, bounded valid JSON, a UUID, and successful admission", async () => {
  const operations = handlers();
  const foreign = request("/api/contact", "POST", { id: UUID, ...fields }, { Origin: "https://other.example.test" });
  assert.equal((await operations.POST(foreign)).status, 403);
  assert.equal((await operations.POST(contact("../../injected"))).status, 400);
  assert.equal((await operations.POST(contact(UUID, { email: "bad\r\nBcc: secret@example.test" }))).status, 400);
  assert.equal((await operations.POST(contact(UUID, { message: "m".repeat(5001) }))).status, 400);
  assert.equal((await operations.POST(request("/api/contact", "POST", {}, { "Content-Length": "32769" }))).status, 413);
  assert.equal((await operations.POST(request("/api/contact", "POST", {}, { "Content-Type": "text/plain" }))).status, 415);
  const malformed = new Request(`${BASE}/api/contact`, { method: "POST", headers: { Origin: BASE, "Content-Type": "application/json" }, body: "{" });
  assert.equal((await operations.POST(malformed)).status, 400);
  const denied = handlers({ rateLimit: () => ({ allowed: false, status: 429, retryAfter: 30 }) });
  const limited = await denied.POST(contact());
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "30");
  assert.deepEqual((await (await denied.GET(request())).json()).messages, []);
  const unavailable = handlers({ rateLimit: () => { throw new Error(PRIVATE); } });
  const result = await unavailable.POST(contact());
  assert.equal(result.status, 503);
  assert.doesNotMatch(await result.text(), /private-contact-marker/);
});

test("contact quotas have their own namespace and force shared production limits", async () => {
  const calls = [];
  const operations = createAdminOperations({ environment: shared({ CHAT_RATE_LIMIT_MODE: "memory" }), assertRequest: () => true,
    fetchImpl: async (url, options) => {
      const command = JSON.parse(options.body);
      calls.push(command);
      if (command[1] === ARCHIVE_CONTACT_SCRIPT) return Response.json({ result: [1, Date.now()] });
      assert.ok(command[3].startsWith("{portfolio-contact}:chat:client:"));
      assert.deepEqual(command.slice(-3), [5, 60, 100]);
      return Response.json({ result: [0, 0] });
    },
  });
  assert.equal((await operations.POST(contact())).status, 201);
  assert.equal(calls.length, 2);
});

test("contact origin uses validated actual Host when Next.js exposes an internal URL hostname", async () => {
  const operations = handlers();
  const local = (headers) => new Request("http://localhost:3000/api/contact", { method: "POST",
    headers: { Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000", "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ id: UUID, ...fields }),
  });
  assert.equal((await operations.POST(local())).status, 201);
  assert.equal((await operations.POST(local({ Origin: "http://localhost:3000" }))).status, 403);
  assert.equal((await operations.POST(local({ Host: "bad.example,127.0.0.1:3000" }))).status, 403);
  assert.equal((await operations.POST(local({ Origin: "https://foreign.example.test", "X-Forwarded-Host": "foreign.example.test", "X-Forwarded-Proto": "https" }))).status, 403);
});

test("slow bodies time out without archiving or returning private text", async () => {
  const operations = handlers({ bodyTimeoutMs: 5 });
  const slow = new Request(`${BASE}/api/contact`, { method: "POST", headers: { Origin: BASE, "Content-Type": "application/json" },
    body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"name":"private')); } }), duplex: "half" });
  const result = await operations.POST(slow);
  assert.equal(result.status, 408);
  assert.equal((await result.json()).error.code, "request_timeout");
  assert.deepEqual((await (await operations.GET(request())).json()).messages, []);
});
