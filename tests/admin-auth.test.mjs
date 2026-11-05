import test from "node:test";
import assert from "node:assert/strict";
import { createAdminAuth, createAdminPasswordHash, AdminAuthError, requestOrigin, assertSameOrigin } from "../lib/server/admin-auth.js";

const PASSWORD = "a unique test password 2026";
const HASH = await createAdminPasswordHash(PASSWORD, { salt: Buffer.alloc(16, 1) });
const SECRET = Buffer.alloc(32, 3).toString("base64url");
const BASE = "https://portfolio.example.test";
const env = (extra = {}) => ({ NODE_ENV: "development", ADMIN_PASSWORD_HASH: HASH, ADMIN_SESSION_SECRET: SECRET, ...extra });
const production = (extra = {}) => env({ NODE_ENV: "production", UPSTASH_REDIS_REST_URL: "https://quota.example.test", UPSTASH_REDIS_REST_TOKEN: "fixture-write-token", ...extra });
function signin(password = PASSWORD, { origin = BASE, headers = {}, url = `${BASE}/api/admin/session`, ...rest } = {}) {
  return new Request(url, {
    method: "POST", headers: { "Content-Type": "application/json", ...(origin !== null ? { Origin: origin } : {}), ...headers },
    body: JSON.stringify({ password }), ...rest,
  });
}
const cookie = (response) => response.headers.get("set-cookie")?.split(";")[0];
const privateRequest = (value, extra = {}) => new Request(`${BASE}/api/admin/content`, {
  headers: { Cookie: value || "", Origin: BASE, ...extra },
});

test("password creation requires a long password, unique salt, and supported scrypt parameters", async () => {
  for (const password of ["short", "\u0000this is invalid", "a".repeat(257)]) await assert.rejects(createAdminPasswordHash(password));
  assert.match(HASH, /^scrypt\$131072\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{43}$/);
  const different = await createAdminPasswordHash(PASSWORD, { salt: Buffer.alloc(16, 2) });
  assert.notEqual(HASH, different);
});

test("configuration and unauthenticated status never disclose credential values", async () => {
  const auth = createAdminAuth({ environment: env() });
  assert.deepEqual(auth.getConfiguration(), { configured: true, passwordConfigured: true, sessionConfigured: true, protectionConfigured: true });
  const response = auth.GET(privateRequest());
  assert.deepEqual(await response.json(), { configured: true, authenticated: false });
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.match(response.headers.get("x-robots-tag"), /noindex/);
  const body = JSON.stringify(auth.getConfiguration());
  assert.ok(!body.includes(SECRET) && !body.includes(HASH));
});

test("valid owner login sets an HttpOnly strict cookie and authorizes content reads/mutations", async () => {
  const auth = createAdminAuth({ environment: env() });
  const result = await auth.POST(signin());
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { authenticated: true, configured: true });
  const header = result.headers.get("set-cookie");
  assert.match(header, /^portfolio-admin=/);
  for (const flag of ["Path=/", "HttpOnly", "SameSite=Strict", "Max-Age=7200"]) assert.ok(header.includes(flag));
  assert.ok(!header.includes(PASSWORD));
  const request = privateRequest(cookie(result));
  assert.equal(auth.getSession(request), true);
  assert.equal(auth.assertRequest(request), true);
  assert.equal(auth.assertRequest(request, { mutation: true }), true);
});

test("production always uses shared throttling and a secure host-scoped cookie", async () => {
  let calls = 0;
  const auth = createAdminAuth({
    environment: production({ CHAT_RATE_LIMIT_MODE: "memory", CHAT_TRUSTED_PROXY: "vercel" }),
    fetchImpl: async (url, options) => {
      calls += 1;
      const command = JSON.parse(options.body);
      assert.equal(url, "https://quota.example.test");
      assert.equal(command[0], "EVAL");
      assert.ok(command[3].startsWith("{portfolio-admin-login}:chat:client:"));
      assert.deepEqual(command.slice(-3), [5, 60, 100]);
      return Response.json({ result: [0, 0] });
    },
  });
  const result = await auth.POST(signin());
  assert.equal(result.status, 200);
  assert.equal(calls, 1);
  assert.match(result.headers.get("set-cookie"), /^__Host-portfolio-admin=.*; Secure$/);
  assert.equal(auth.getSession(privateRequest(cookie(result))), true);
  assert.equal(auth.getSession(privateRequest(cookie(result).replace("__Host-portfolio-admin", "portfolio-admin"))), false);
});

test("production admin login uses the Vercel integration pair through its private quota guard", async () => {
  let calls = 0;
  const environment = env({ NODE_ENV: "production", KV_REST_API_URL: "https://integration.example.test", KV_REST_API_TOKEN: "integration-auth-fixture" });
  const auth = createAdminAuth({ environment, fetchImpl: async (url, options) => {
    calls += 1;
    assert.equal(url, environment.KV_REST_API_URL);
    assert.equal(options.headers.Authorization, `Bearer ${environment.KV_REST_API_TOKEN}`);
    const command = JSON.parse(options.body);
    assert.ok(command[3].startsWith("{portfolio-admin-login}:chat:client:"));
    return Response.json({ result: [0, 0] });
  } });
  assert.equal(auth.getConfiguration().protectionConfigured, true);
  const signed = await auth.POST(signin());
  assert.equal(signed.status, 200);
  assert.equal(calls, 1);
  assert.equal(auth.getSession(privateRequest(cookie(signed))), true);
  assert.equal(createAdminAuth({ environment: { ...environment, UPSTASH_REDIS_REST_TOKEN: "" } }).getConfiguration().configured, false);
});

test("wrong passwords fail without a cookie and only generic diagnostics are returned", async () => {
  const auth = createAdminAuth({ environment: env() });
  const result = await auth.POST(signin("wrong password fixture"));
  assert.equal(result.status, 401);
  assert.equal(result.headers.get("set-cookie"), null);
  const text = await result.text();
  assert.ok(!text.includes(PASSWORD) && !text.includes(HASH) && !text.includes(SECRET));
  assert.equal(JSON.parse(text).error.code, "admin_invalid_credentials");
});

test("missing, malformed and weak auth configuration fails closed", async () => {
  for (const environment of [env({ ADMIN_PASSWORD_HASH: "" }), env({ ADMIN_PASSWORD_HASH: HASH.replace("131072", "16384") }), env({ ADMIN_SESSION_SECRET: "too-short" }), production({ UPSTASH_REDIS_REST_TOKEN: "" }), production({ UPSTASH_REDIS_REST_URL: "https://user:secret@quota.example.test" })]) {
    const auth = createAdminAuth({ environment, fetchImpl: () => { throw new Error("No network expected"); } });
    assert.equal(auth.getConfiguration().configured, false);
    assert.equal(auth.getSession(privateRequest("forged")), false);
    assert.throws(() => auth.assertRequest(privateRequest()), (error) => error instanceof AdminAuthError && error.status === 503);
    const result = await auth.POST(signin());
    assert.equal(result.status, 503);
    assert.equal(result.headers.get("set-cookie"), null);
  }
});

test("production refuses HTTP sign-in before contacting the quota service", async () => {
  let calls = 0;
  const auth = createAdminAuth({ environment: production(), fetchImpl: () => { calls += 1; throw new Error("No network expected"); } });
  const result = await auth.POST(signin(PASSWORD, { url: "http://portfolio.example.test/api/admin/session", origin: "http://portfolio.example.test" }));
  assert.equal(result.status, 503);
  assert.equal((await result.json()).error.code, "admin_https_required");
  assert.equal(calls, 0);
});

test("all state mutations reject missing, cross-site, same-site sibling, null and malformed origins", async () => {
  const auth = createAdminAuth({ environment: env() });
  for (const origin of [null, "null", "https://attacker.example.test", `${BASE}/path`, `${BASE}, https://attacker.example.test`]) {
    assert.equal((await auth.POST(signin(PASSWORD, { origin }))).status, 403);
    assert.equal(auth.DELETE(new Request(`${BASE}/api/admin/session`, { method: "DELETE", headers: origin === null ? {} : { Origin: origin } })).status, 403);
  }
  for (const site of ["same-site", "cross-site"]) assert.equal((await auth.POST(signin(PASSWORD, { headers: { "Sec-Fetch-Site": site } }))).status, 403);
  assert.throws(() => auth.assertRequest(privateRequest("", { Origin: "https://attacker.example.test" }), { mutation: true }), (error) => error.status === 403);
});

test("Next.js internal hostnames use the validated actual Host and preserve the URL scheme", async () => {
  const auth = createAdminAuth({ environment: env() });
  const request = signin(PASSWORD, { url: "http://localhost:3000/api/admin/session", origin: "http://127.0.0.1:3000", headers: { Host: "127.0.0.1:3000" } });
  assert.equal(requestOrigin(request), "http://127.0.0.1:3000");
  assert.equal(assertSameOrigin(request), true);
  assert.equal((await auth.POST(request)).status, 200);
  const secure = signin(PASSWORD, { url: "https://internal.example.test/api/admin/session", origin: BASE, headers: { Host: "portfolio.example.test" } });
  const productionAuth = createAdminAuth({ environment: production(), fetchImpl: async () => Response.json({ result: [0, 0] }) });
  const response = await productionAuth.POST(secure);
  assert.equal(response.status, 200);
  assert.ok(response.headers.get("set-cookie").includes("Secure"));
  assert.equal(requestOrigin(new Request("http://localhost:3000/", { headers: { Host: "[::1]:3000" } })), "http://[::1]:3000");
});

test("actual host checks reject cross-origin and malformed authorities without trusting forwarded headers", async () => {
  const auth = createAdminAuth({ environment: env() });
  const mismatch = signin(PASSWORD, { origin: "https://attacker.example.test", headers: { Host: "portfolio.example.test", "X-Forwarded-Host": "attacker.example.test" } });
  assert.equal((await auth.POST(mismatch)).status, 403);
  const noProtoUpgrade = signin(PASSWORD, { url: "http://localhost:3000/api/admin/session", origin: "https://portfolio.example.test", headers: { Host: "portfolio.example.test", "X-Forwarded-Proto": "https" } });
  assert.equal((await auth.POST(noProtoUpgrade)).status, 403);
  const forwardedOnly = signin(PASSWORD, { url: "http://localhost:3000/api/admin/session", origin: "http://127.0.0.1:3000", headers: { "X-Forwarded-Host": "127.0.0.1:3000" } });
  assert.equal((await auth.POST(forwardedOnly)).status, 403);
  for (const host of ["", "portfolio.example.test/path", "user@portfolio.example.test", "portfolio.example.test,attacker.test", "portfolio.example.test:65536", "portfolio.example.test:0", "portfolio.example.test:abc", "portfolio..example.test", "-portfolio.example.test", "portfolio.example.test%2fattacker.test", "[not-ipv6]", "2130706433:3000"]) {
    assert.throws(() => requestOrigin(new Request("https://internal.example.test/", { headers: { Host: host } })), (error) => error instanceof AdminAuthError && error.status === 403, host);
  }
});

test("expired, malformed, tampered and duplicate session cookies do not authorize", async () => {
  let time = Date.UTC(2026, 10, 4, 12);
  const auth = createAdminAuth({ environment: env(), now: () => time });
  const result = await auth.POST(signin());
  const original = cookie(result);
  assert.equal(auth.getSession(privateRequest(original)), true);
  for (const value of ["portfolio-admin=garbage", `${original}; ${original}`, original + ".extra", original.slice(0, -1) + "!", "portfolio-admin=" + "a".repeat(2000)]) assert.equal(auth.getSession(privateRequest(value)), false);
  const [name, token] = original.split("=");
  const [payload, mac] = token.split(".");
  const data = JSON.parse(Buffer.from(payload, "base64url"));
  data.exp += 86400;
  const tampered = `${name}=${Buffer.from(JSON.stringify(data)).toString("base64url")}.${mac}`;
  assert.equal(auth.getSession(privateRequest(tampered)), false);
  time += 7200 * 1000;
  assert.equal(auth.getSession(privateRequest(original)), false);
  assert.throws(() => auth.assertRequest(privateRequest(original)), (error) => error.status === 401);
  time -= (7200 + 31) * 1000;
  assert.equal(auth.getSession(privateRequest(original)), false);
});

test("rotating either password hash or session secret invalidates earlier sessions", async () => {
  const environment = env();
  const auth = createAdminAuth({ environment });
  const original = cookie(await auth.POST(signin()));
  assert.equal(auth.getSession(privateRequest(original)), true);
  environment.ADMIN_SESSION_SECRET = Buffer.alloc(32, 4).toString("base64url");
  assert.equal(auth.getSession(privateRequest(original)), false);
  environment.ADMIN_SESSION_SECRET = SECRET;
  environment.ADMIN_PASSWORD_HASH = await createAdminPasswordHash("a different test password", { salt: Buffer.alloc(16, 4) });
  assert.equal(auth.getSession(privateRequest(original)), false);
});

test("local login throttles before password work and ignores forged client headers", async () => {
  const auth = createAdminAuth({ environment: env(), fetchImpl: () => { throw new Error("Must stay local"); } });
  for (let index = 0; index < 5; index += 1) {
    const response = await auth.POST(signin("incorrect fixture", { headers: { "X-Forwarded-For": `203.0.113.${index}` } }));
    assert.equal(response.status, 401);
  }
  const response = await auth.POST(signin());
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get("retry-after")) >= 1);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("shared exhaustion or backend failures never fall back to memory and never leak provider messages", async () => {
  for (const fetchImpl of [async () => Response.json({ result: [1, 42] }), async () => Response.json({ error: "private provider message fixture" }, { status: 401 }), async () => { throw new Error("private network message fixture"); }]) {
    const auth = createAdminAuth({ environment: production(), fetchImpl });
    const result = await auth.POST(signin());
    assert.ok([429, 503].includes(result.status));
    assert.equal(result.headers.get("set-cookie"), null);
    const text = await result.text();
    assert.ok(!text.includes("private") && !text.includes("fixture-write-token"));
  }
});

test("invalid and oversized sign-in payloads are bounded before password work", async () => {
  const auth = createAdminAuth({ environment: env(), rateLimit: async () => ({ allowed: true }) });
  const requests = [
    [new Request(`${BASE}/api/admin/session`, { method: "POST", headers: { Origin: BASE }, body: "plain" }), 415],
    [signin(PASSWORD, { headers: { "Content-Length": "5000" } }), 413],
    [new Request(`${BASE}/api/admin/session`, { method: "POST", headers: { Origin: BASE, "Content-Type": "application/json" }, body: "{" }), 400],
    [signin("a".repeat(257)), 400],
    [signin("a".repeat(5000)), 413],
  ];
  for (const [request, status] of requests) assert.equal((await auth.POST(request)).status, status);
});

test("stalled and cancelled request bodies stop without issuing sessions", async () => {
  let cancelled = false;
  const auth = createAdminAuth({ environment: env(), bodyTimeoutMs: 20, rateLimit: async () => ({ allowed: true }) });
  const stream = new ReadableStream({ cancel() { cancelled = true; } });
  const request = new Request(`${BASE}/api/admin/session`, { method: "POST", headers: { Origin: BASE, "Content-Type": "application/json" }, body: stream, duplex: "half" });
  const result = await auth.POST(request);
  assert.equal(result.status, 408);
  assert.equal(cancelled, true);
  const controller = new AbortController();
  controller.abort();
  const aborted = signin(PASSWORD, { signal: controller.signal });
  assert.equal((await auth.POST(aborted)).status, 400);
});

test("parallel password checks are bounded instead of allocating unlimited scrypt work", async () => {
  const auth = createAdminAuth({ environment: env(), rateLimit: async () => ({ allowed: true }) });
  const results = await Promise.all([auth.POST(signin()), auth.POST(signin()), auth.POST(signin())]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 200, 429]);
  const busy = results.find((result) => result.status === 429);
  assert.equal((await busy.json()).error.code, "admin_signin_busy");
});

test("logout is same-origin, expires the correct cookie, and works after configuration removal", async () => {
  const environment = production();
  const auth = createAdminAuth({ environment });
  environment.ADMIN_PASSWORD_HASH = "";
  const request = new Request(`${BASE}/api/admin/session`, { method: "DELETE", headers: { Origin: BASE } });
  const result = auth.DELETE(request);
  assert.equal(result.status, 200);
  assert.match(result.headers.get("set-cookie"), /^__Host-portfolio-admin=;/);
  assert.ok(result.headers.get("set-cookie").includes("Max-Age=0"));
  assert.ok(result.headers.get("set-cookie").includes("Secure"));
  assert.deepEqual(await result.json(), { authenticated: false, configured: false });
});
