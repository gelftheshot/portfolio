import test from "node:test";
import assert from "node:assert/strict";
import { resolveRedisRestConfiguration } from "../lib/server/redis-config.js";

const explicit = { UPSTASH_REDIS_REST_URL: "https://explicit.example.test/", UPSTASH_REDIS_REST_TOKEN: "explicit-fixture-token" };
const vercel = { KV_REST_API_URL: "https://integration.example.test/", KV_REST_API_TOKEN: "integration-fixture-token" };

test("Redis configuration resolves complete explicit and Vercel integration pairs", () => {
  assert.equal(resolveRedisRestConfiguration({}), null);
  assert.deepEqual(resolveRedisRestConfiguration(explicit), { url: "https://explicit.example.test", token: explicit.UPSTASH_REDIS_REST_TOKEN, source: "upstash" });
  assert.deepEqual(resolveRedisRestConfiguration(vercel), { url: "https://integration.example.test", token: vercel.KV_REST_API_TOKEN, source: "vercel-kv" });
  assert.deepEqual(resolveRedisRestConfiguration({ ...explicit, ...vercel }), resolveRedisRestConfiguration(explicit));
  assert.deepEqual(resolveRedisRestConfiguration({ UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined, ...vercel }), resolveRedisRestConfiguration(vercel));
});

test("invalid explicit Redis settings never fall back to a valid integration pair", async (t) => {
  const cases = [
    { UPSTASH_REDIS_REST_URL: explicit.UPSTASH_REDIS_REST_URL },
    { UPSTASH_REDIS_REST_TOKEN: explicit.UPSTASH_REDIS_REST_TOKEN },
    { UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "" },
    { ...explicit, UPSTASH_REDIS_REST_URL: "http://explicit.example.test" },
    { ...explicit, UPSTASH_REDIS_REST_TOKEN: "invalid token" },
  ];
  for (const [index, candidate] of cases.entries()) await t.test(String(index), () => {
    assert.throws(() => resolveRedisRestConfiguration({ ...vercel, ...candidate }), { message: "Shared Redis is not configured correctly." });
  });
});

test("Redis aliases require a complete HTTPS REST write-token pair and never mix sources", async (t) => {
  const cases = [
    { KV_REST_API_URL: vercel.KV_REST_API_URL },
    { KV_REST_API_TOKEN: vercel.KV_REST_API_TOKEN },
    { UPSTASH_REDIS_REST_URL: explicit.UPSTASH_REDIS_REST_URL, KV_REST_API_TOKEN: vercel.KV_REST_API_TOKEN },
    { ...vercel, KV_REST_API_URL: "" },
    { ...vercel, KV_REST_API_TOKEN: " " },
    { ...vercel, KV_REST_API_URL: "redis://integration.example.test" },
    { ...vercel, KV_REST_API_URL: "https://user:private@integration.example.test" },
    { ...vercel, KV_REST_API_URL: "https://integration.example.test?token=private" },
    { ...vercel, KV_REST_API_URL: "https://integration.example.test#private" },
    { ...vercel, KV_REST_API_TOKEN: "private\nheader" },
    { ...vercel, KV_REST_API_TOKEN: 123 },
  ];
  for (const [index, candidate] of cases.entries()) await t.test(String(index), () => {
    assert.throws(() => resolveRedisRestConfiguration(candidate), { message: "Shared Redis is not configured correctly." });
  });
  assert.equal(resolveRedisRestConfiguration({ REDIS_URL: "redis://unused", KV_REST_API_READ_ONLY_TOKEN: "unused" }), null);
});
