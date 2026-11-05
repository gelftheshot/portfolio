import test from "node:test";
import assert from "node:assert/strict";
import {
  createChatAbuseGuard,
  createRateLimiter,
  getChatClientKey,
  RESERVE_CHAT_QUOTA_SCRIPT,
} from "../lib/server/chat-abuse-guard.js";

const environment = {
  NODE_ENV: "production",
  UPSTASH_REDIS_REST_URL: "https://quota.example.test",
  UPSTASH_REDIS_REST_TOKEN: "test-token-no-network",
  CHAT_TRUSTED_PROXY: "vercel",
};
const visitor = (ip = "203.0.113.1", headers = {}) => new Request("http://localhost/api/chat", {
  headers: { "x-vercel-forwarded-for": ip, ...headers },
});

async function withinDeadline(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Guard did not finish")), 1000); }),
    ]);
  } finally { clearTimeout(timer); }
}

// A shared REST transport double models the Redis admission contract. State is
// shared between independent guard instances and reserved in one EVAL request.
function redisTransport({ now = () => Date.UTC(2026, 10, 4, 12) } = {}) {
  const clients = new Map();
  const days = new Map();
  const calls = [];
  return {
    calls,
    async fetch(url, options) {
      const command = JSON.parse(options.body);
      calls.push({ url, options, command });
      assert.equal(command[0], "EVAL");
      assert.equal(command[1], RESERVE_CHAT_QUOTA_SCRIPT);
      assert.equal(command[2], 2, "both counters belong to the same atomic operation");
      assert.equal(command.length, 8);
      const [, , , clientKey, dayKey, clientLimit, windowSeconds, dailyLimit] = command;
      const seconds = Math.floor(now() / 1000);
      const day = Math.floor(seconds / 86400);
      const daily = days.get(dayKey);
      const count = daily?.day === day ? daily.count : 0;
      if (count >= dailyLimit) return Response.json({ result: [2, 86400 - (seconds % 86400)] });
      let client = clients.get(clientKey);
      if (!client || client.expires <= seconds) client = { count: 0, expires: seconds + windowSeconds };
      if (client.count >= clientLimit) return Response.json({ result: [1, client.expires - seconds] });
      client.count += 1;
      clients.set(clientKey, client);
      days.set(dayKey, { day, count: count + 1 });
      return Response.json({ result: [0, 0] });
    },
  };
}

test("forwarded IPs cannot manufacture client identities without explicit proxy trust", () => {
  for (const ip of ["203.0.113.1", "203.0.113.2"]) {
    assert.equal(getChatClientKey(visitor(ip, {
      "x-forwarded-for": ip, "x-real-ip": ip, "cf-connecting-ip": ip,
    })), "anonymous");
  }
  const limiter = createRateLimiter({ limit: 1 });
  assert.equal(limiter(visitor("203.0.113.1")), 0);
  assert.ok(limiter(visitor("203.0.113.2")) > 0);
});

test("trusted proxy selection reads only the configured, single-address header", () => {
  assert.equal(getChatClientKey(visitor("203.0.113.8", { "x-forwarded-for": "198.51.100.99" }), "vercel"), "203.0.113.8");
  assert.equal(getChatClientKey(visitor("203.0.113.8", { "cf-connecting-ip": "198.51.100.7" }), "cloudflare"), "198.51.100.7");
  assert.equal(getChatClientKey(visitor("203.0.113.8", { "x-real-ip": "198.51.100.6" }), "x-real-ip"), "198.51.100.6");
  assert.equal(getChatClientKey(visitor("203.0.113.8", { "x-forwarded-for": "198.51.100.5" }), "x-forwarded-for"), "198.51.100.5");
  for (const invalid of ["203.0.113.1, 198.51.100.2", "not-an-ip", "203.0.113.1:443", ""]) {
    assert.equal(getChatClientKey(visitor(invalid), "vercel"), "anonymous");
  }
  assert.equal(getChatClientKey(new Request("http://localhost/api/chat"), "vercel"), "anonymous");
  assert.equal(getChatClientKey(visitor("2001:0DB8:0000:0000:0000:0000:0000:0001"), "vercel"), "2001:db8::1");
});

test("key-only local development uses bounded memory without touching a backend", async () => {
  let calls = 0;
  const guard = createChatAbuseGuard({
    getEnvironment: () => ({ NODE_ENV: "development", CHAT_CLIENT_RATE_LIMIT: "1" }),
    fetchImpl: () => { calls += 1; throw new Error("No network expected"); },
  });
  assert.deepEqual(await guard(visitor()), { allowed: true });
  const denial = await guard(visitor("203.0.113.2"));
  assert.equal(denial.status, 429, "forged headers cannot rotate the default anonymous bucket");
  assert.equal(calls, 0);
});

test("production fails closed without shared credentials and never falls back to memory", async () => {
  let calls = 0;
  const guard = createChatAbuseGuard({
    getEnvironment: () => ({ NODE_ENV: "production" }),
    fetchImpl: () => { calls += 1; throw new Error("must not run"); },
  });
  for (let index = 0; index < 3; index += 1) {
    const decision = await guard(visitor());
    assert.equal(decision.status, 503);
    assert.equal(decision.allowed, false);
  }
  assert.equal(calls, 0);
});

test("Vercel Redis integration aliases reserve a shared production quota", async () => {
  const redis = redisTransport();
  const env = {
    NODE_ENV: "production", CHAT_TRUSTED_PROXY: "vercel", CHAT_DAILY_REQUEST_LIMIT: "1",
    KV_REST_API_URL: "https://integration.example.test", KV_REST_API_TOKEN: "integration-write-fixture",
  };
  const first = createChatAbuseGuard({ getEnvironment: () => env, fetchImpl: redis.fetch });
  const second = createChatAbuseGuard({ getEnvironment: () => env, fetchImpl: redis.fetch });
  assert.equal((await first(visitor())).allowed, true);
  assert.equal((await second(visitor("203.0.113.2"))).code, "assistant_daily_limit");
  assert.equal(redis.calls.length, 2);
  assert.equal(redis.calls[0].url, env.KV_REST_API_URL);
  assert.equal(redis.calls[0].options.headers.Authorization, `Bearer ${env.KV_REST_API_TOKEN}`);
});

test("production preview memory mode is explicit and still enforces a daily quota", async () => {
  let now = Date.UTC(2026, 10, 4, 23, 59, 59);
  const guard = createChatAbuseGuard({
    getEnvironment: () => ({ NODE_ENV: "production", CHAT_RATE_LIMIT_MODE: "memory", CHAT_DAILY_REQUEST_LIMIT: "2" }),
    now: () => now,
  });
  assert.equal((await guard(visitor())).allowed, true);
  assert.equal((await guard(visitor())).allowed, true);
  const denial = await guard(visitor());
  assert.equal(denial.code, "assistant_daily_limit");
  assert.equal(denial.retryAfter, 1);
  now += 1000;
  assert.equal((await guard(visitor())).allowed, true, "UTC midnight resets the local daily counter");
});

test("invalid guard configuration is rejected without attempting Redis", async (t) => {
  const cases = [
    { CHAT_RATE_LIMIT_MODE: "disabled" },
    { CHAT_TRUSTED_PROXY: "true" },
    { CHAT_CLIENT_RATE_LIMIT: "0" },
    { CHAT_CLIENT_RATE_LIMIT: "121" },
    { CHAT_DAILY_REQUEST_LIMIT: "-1" },
    { CHAT_DAILY_REQUEST_LIMIT: "1e3" },
    { CHAT_DAILY_REQUEST_LIMIT: "10001" },
    { CHAT_RATE_LIMIT_NAMESPACE: "unsafe{namespace}" },
    { UPSTASH_REDIS_REST_TOKEN: "" },
    { UPSTASH_REDIS_REST_URL: "http://quota.example.test" },
    { UPSTASH_REDIS_REST_URL: "https://user:password@quota.example.test" },
    { UPSTASH_REDIS_REST_URL: "https://quota.example.test?_token=private" },
  ];
  for (const overrides of cases) {
    await t.test(Object.keys(overrides)[0] + ": " + Object.values(overrides)[0], async () => {
      let calls = 0;
      const guard = createChatAbuseGuard({
        getEnvironment: () => ({ ...environment, ...overrides }),
        fetchImpl: () => { calls += 1; throw new Error("must not run"); },
      });
      assert.equal((await guard(visitor())).status, 503);
      assert.equal(calls, 0);
    });
  }
});

test("shared admission sends one atomic EVAL with short-lived pseudonymous client keys", async () => {
  const redis = redisTransport();
  const guard = createChatAbuseGuard({ getEnvironment: () => environment, fetchImpl: redis.fetch });
  assert.deepEqual(await guard(visitor("203.0.113.8")), { allowed: true });
  const { url, options, command } = redis.calls[0];
  assert.equal(redis.calls.length, 1);
  assert.equal(url, environment.UPSTASH_REDIS_REST_URL);
  assert.equal(options.method, "POST");
  assert.equal(options.headers.Authorization, `Bearer ${environment.UPSTASH_REDIS_REST_TOKEN}`);
  assert.equal(options.cache, "no-store");
  assert.equal(options.redirect, "error");
  assert.match(command[3], /^\{portfolio\}:chat:client:[a-f0-9]{64}$/);
  assert.equal(command[4], "{portfolio}:chat:daily");
  assert.deepEqual(command.slice(5), [20, 60, 200]);
  assert.equal(options.body.includes("203.0.113.8"), false);
  assert.equal(options.body.includes("messages"), false, "prompts and conversation text never enter Redis");
});

test("independent instances share a global quota under concurrent requests", async () => {
  const redis = redisTransport();
  const config = { ...environment, CHAT_DAILY_REQUEST_LIMIT: "3", CHAT_CLIENT_RATE_LIMIT: "1" };
  const instances = Array.from({ length: 4 }, () => createChatAbuseGuard({ getEnvironment: () => config, fetchImpl: redis.fetch }));
  const decisions = await Promise.all(Array.from({ length: 20 }, (_, index) => instances[index % 4](visitor(`203.0.113.${index + 1}`))));
  assert.equal(decisions.filter(({ allowed }) => allowed).length, 3);
  assert.equal(decisions.filter(({ code }) => code === "assistant_daily_limit").length, 17);
  assert.equal(new Set(redis.calls.map(({ command }) => command[4])).size, 1, "all instances reserve the same daily counter");
  assert.equal(redis.calls.length, 20, "each admission uses a single atomic command");
});

test("per-client rejections do not consume the global allowance", async () => {
  const redis = redisTransport();
  const guard = createChatAbuseGuard({
    getEnvironment: () => ({ ...environment, CHAT_DAILY_REQUEST_LIMIT: "2", CHAT_CLIENT_RATE_LIMIT: "1" }),
    fetchImpl: redis.fetch,
  });
  assert.equal((await guard(visitor("203.0.113.1"))).allowed, true);
  const clientDenial = await guard(visitor("203.0.113.1"));
  assert.equal(clientDenial.code, "too_many_requests");
  assert.equal(clientDenial.retryAfter, 60);
  assert.equal((await guard(visitor("203.0.113.2"))).allowed, true);
  assert.equal((await guard(visitor("203.0.113.3"))).code, "assistant_daily_limit");
});

test("shared quotas reset from backend UTC time, not the application's clock", async () => {
  let redisNow = Date.UTC(2026, 10, 4, 23, 59, 59);
  const redis = redisTransport({ now: () => redisNow });
  const guard = createChatAbuseGuard({
    getEnvironment: () => ({ ...environment, CHAT_DAILY_REQUEST_LIMIT: "1" }),
    fetchImpl: redis.fetch,
    now: () => Date.UTC(1999, 0, 1),
  });
  assert.equal((await guard(visitor())).allowed, true);
  assert.equal((await guard(visitor())).retryAfter, 1);
  redisNow += 1000;
  assert.equal((await guard(visitor())).allowed, true);
});

test("Redis errors and malformed replies fail closed without leaking backend details", async (t) => {
  const cases = [
    ["authentication", () => Response.json({ error: "Private token detail" }, { status: 401 })],
    ["server failure", () => Response.json({ error: "Private backend detail" }, { status: 500 })],
    ["Redis command failure", () => Response.json({ error: "Private script detail" })],
    ["invalid JSON", () => new Response("Private not-json detail")],
    ["missing result", () => Response.json({})],
    ["unexpected shape", () => Response.json({ result: [0] })],
    ["unknown decision", () => Response.json({ result: [4, 30] })],
    ["invalid allowance", () => Response.json({ result: [0, 30] })],
    ["invalid retry", () => Response.json({ result: [1, 0] })],
    ["string decision", () => Response.json({ result: ["0", "0"] })],
    ["network exception", () => { throw new Error("Private network detail"); }],
  ];
  for (const [label, result] of cases) {
    await t.test(label, async () => {
      const guard = createChatAbuseGuard({ getEnvironment: () => environment, fetchImpl: async () => result() });
      const decision = await guard(visitor());
      assert.equal(decision.status, 503);
      assert.equal(decision.allowed, false);
      assert.doesNotMatch(JSON.stringify(decision), /Private|test-token-no-network|quota\.example/);
    });
  }
});

test("backend timeout aborts transport and returns a safe unavailable decision", async () => {
  let signal;
  const guard = createChatAbuseGuard({
    getEnvironment: () => environment,
    timeoutMs: 15,
    fetchImpl: async (_, options) => {
      signal = options.signal;
      await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
      throw new Error("Private timeout detail");
    },
  });
  const decision = await withinDeadline(guard(visitor()));
  assert.equal(decision.status, 503);
  assert.equal(signal.aborted, true);
});

test("a cancelled chat request also cancels its pending quota lookup", async () => {
  const caller = new AbortController();
  let signal;
  let started;
  const ready = new Promise((resolve) => { started = resolve; });
  const guard = createChatAbuseGuard({
    getEnvironment: () => environment,
    fetchImpl: async (_, options) => {
      signal = options.signal;
      started();
      await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
      throw new Error("Cancelled");
    },
  });
  const decision = guard(new Request("http://localhost/api/chat", { signal: caller.signal }));
  await withinDeadline(ready);
  caller.abort();
  assert.equal((await withinDeadline(decision)).allowed, false);
  assert.equal(signal.aborted, true);
});
