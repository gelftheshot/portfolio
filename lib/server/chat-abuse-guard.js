import { createHmac } from "node:crypto";
import { isIP } from "node:net";

const DAY_SECONDS = 86400;
const WINDOW_SECONDS = 60;
const BACKEND_TIMEOUT_MS = 2500;
const PROXIES = new Set(["none", "vercel", "cloudflare", "x-real-ip", "x-forwarded-for"]);

const unavailable = () => ({
  allowed: false,
  status: 503,
  code: "assistant_protection_unavailable",
  message: "The assistant is temporarily unavailable. Please try again later or get in touch.",
});

function denied(scope, retryAfter) {
  return {
    allowed: false,
    status: 429,
    code: scope === "daily" ? "assistant_daily_limit" : "too_many_requests",
    message: scope === "daily"
      ? "The assistant has reached its daily question limit. Please try again later or get in touch."
      : "You’ve sent several questions in a short time. Please try again shortly.",
    retryAfter,
  };
}

function positiveInteger(value, fallback, maximum) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return fallback;
  if (!/^\d+$/.test(text)) throw new Error("Invalid protection limit");
  const number = Number(text);
  if (!Number.isSafeInteger(number) || number < 1 || number > maximum) throw new Error("Invalid protection limit");
  return number;
}

/** Trust is an operator decision; arbitrary forwarded headers are ignored by default. */
export function getChatClientKey(request, trustedProxy = "none") {
  const header = {
    vercel: "x-vercel-forwarded-for",
    cloudflare: "cf-connecting-ip",
    "x-real-ip": "x-real-ip",
    "x-forwarded-for": "x-forwarded-for",
  }[trustedProxy];
  if (!header) return "anonymous";
  const address = request.headers.get(header)?.trim();
  const version = address && isIP(address);
  // Do not take an attacker-controlled first entry from a proxy chain.
  if (!version) return "anonymous";
  if (version === 6) {
    return new URL(`http://[${address}]/`).hostname.slice(1, -1);
  }
  return address;
}

/** Bounded local fallback. Production must explicitly opt into memory mode. */
export function createRateLimiter({
  limit = 20,
  windowMs = 60000,
  now = Date.now,
  getClientKey = () => "anonymous",
} = {}) {
  const buckets = new Map();
  return (request) => {
    const time = now();
    for (const [key, bucket] of buckets) if (bucket.expires <= time) buckets.delete(key);
    const key = getClientKey(request);
    let bucket = buckets.get(key);
    if (!bucket) {
      // Reject new identities at capacity rather than evicting active limits.
      if (buckets.size >= 512) {
        const earliest = Math.min(...Array.from(buckets.values(), (item) => item.expires));
        return Math.max(1, Math.ceil((earliest - time) / 1000));
      }
      bucket = { count: 0, expires: time + windowMs };
      buckets.set(key, bucket);
    }
    if (bucket.count >= limit) return Math.max(1, Math.ceil((bucket.expires - time) / 1000));
    bucket.count += 1;
    return 0;
  };
}

// Both limits are checked and reserved inside one Redis atomic operation. Redis
// time sets the UTC day, so serverless instance clocks cannot split the quota.
export const RESERVE_CHAT_QUOTA_SCRIPT = `
local clientLimit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local dailyLimit = tonumber(ARGV[3])
local seconds = tonumber(redis.call('TIME')[1])
local day = math.floor(seconds / 86400)
local dailyTtl = 86400 - (seconds % 86400)
local storedDay = tonumber(redis.call('HGET', KEYS[2], 'day') or '-1')
local dailyCount = 0
if storedDay == day then
  dailyCount = tonumber(redis.call('HGET', KEYS[2], 'count') or '0')
end
if dailyCount >= dailyLimit then return {2, dailyTtl} end

local clientCount = tonumber(redis.call('GET', KEYS[1]) or '0')
local clientTtl = redis.call('TTL', KEYS[1])
if clientTtl == -1 then
  redis.call('EXPIRE', KEYS[1], window)
  clientTtl = window
end
if clientCount >= clientLimit then return {1, math.max(1, clientTtl)} end

local nextCount = redis.call('INCR', KEYS[1])
if nextCount == 1 or clientTtl < 0 then redis.call('EXPIRE', KEYS[1], window) end
redis.call('HSET', KEYS[2], 'day', day, 'count', dailyCount + 1)
redis.call('EXPIRE', KEYS[2], dailyTtl)
return {0, 0}
`;

function configuration(environment) {
  const mode = environment.CHAT_RATE_LIMIT_MODE?.trim() || (environment.NODE_ENV === "production" ? "shared" : "memory");
  if (!["shared", "memory"].includes(mode)) throw new Error("Invalid protection mode");
  const trustedProxy = environment.CHAT_TRUSTED_PROXY?.trim() || "none";
  if (!PROXIES.has(trustedProxy)) throw new Error("Invalid trusted proxy");
  const namespace = environment.CHAT_RATE_LIMIT_NAMESPACE?.trim() || "portfolio";
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(namespace)) throw new Error("Invalid protection namespace");
  const result = {
    mode,
    trustedProxy,
    namespace,
    clientLimit: positiveInteger(environment.CHAT_CLIENT_RATE_LIMIT, 20, 120),
    dailyLimit: positiveInteger(environment.CHAT_DAILY_REQUEST_LIMIT, 200, 10000),
  };
  if (mode === "shared") {
    const url = new URL(environment.UPSTASH_REDIS_REST_URL?.trim() || "");
    const token = environment.UPSTASH_REDIS_REST_TOKEN?.trim();
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !token) {
      throw new Error("Shared protection is not configured");
    }
    result.url = url.href.replace(/\/$/, "");
    result.token = token;
  }
  return result;
}

function memoryGuard(config, now) {
  const perClient = createRateLimiter({
    limit: config.clientLimit,
    now,
    getClientKey: (request) => getChatClientKey(request, config.trustedProxy),
  });
  let activeDay;
  let dailyCount = 0;
  return (request) => {
    const seconds = Math.floor(now() / 1000);
    const day = Math.floor(seconds / DAY_SECONDS);
    if (day !== activeDay) { activeDay = day; dailyCount = 0; }
    if (dailyCount >= config.dailyLimit) return denied("daily", DAY_SECONDS - (seconds % DAY_SECONDS));
    const retryAfter = perClient(request);
    if (retryAfter) return denied("client", retryAfter);
    dailyCount += 1;
    return { allowed: true };
  };
}

function sharedGuard(config, fetchImpl, timeoutMs) {
  return async (request) => {
    const client = getChatClientKey(request, config.trustedProxy);
    const digest = createHmac("sha256", config.token).update(client).digest("hex");
    const prefix = `{${config.namespace}}:chat`;
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    request.signal.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();
    try {
      if (request.signal.aborted) throw new Error("Cancelled protection request");
      const response = await fetchImpl(config.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
        body: JSON.stringify([
          "EVAL", RESERVE_CHAT_QUOTA_SCRIPT, 2,
          `${prefix}:client:${digest}`, `${prefix}:daily`,
          config.clientLimit, WINDOW_SECONDS, config.dailyLimit,
        ]),
        signal: controller.signal,
        cache: "no-store",
        redirect: "error",
      });
      if (!response.ok) throw new Error("Protection backend rejected request");
      const payload = await response.json();
      const result = payload?.result;
      if (payload?.error || !Array.isArray(result) || result.length !== 2 || !result.every(Number.isSafeInteger)) {
        throw new Error("Invalid protection response");
      }
      const [decision, retryAfter] = result;
      if (decision === 0 && retryAfter === 0) return { allowed: true };
      if ([1, 2].includes(decision) && retryAfter >= 1 && retryAfter <= DAY_SECONDS) {
        return denied(decision === 2 ? "daily" : "client", retryAfter);
      }
      throw new Error("Invalid protection decision");
    } catch {
      // Never fall back to local counters or expose Redis errors/credentials.
      return unavailable();
    } finally {
      clearTimeout(timer);
      request.signal.removeEventListener("abort", onAbort);
    }
  };
}

/** No network in local development; production fails closed without shared config. */
export function createChatAbuseGuard({
  getEnvironment = () => process.env,
  fetchImpl = globalThis.fetch,
  now = Date.now,
  timeoutMs = BACKEND_TIMEOUT_MS,
} = {}) {
  let guard;
  return async (request) => {
    if (!guard) {
      try {
        const config = configuration(getEnvironment());
        guard = config.mode === "shared" ? sharedGuard(config, fetchImpl, timeoutMs) : memoryGuard(config, now);
      } catch {
        guard = unavailable;
      }
    }
    return guard(request);
  };
}
