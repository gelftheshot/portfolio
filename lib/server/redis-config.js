const EXPLICIT = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"];
const VERCEL = ["KV_REST_API_URL", "KV_REST_API_TOKEN"];

/** Resolve one complete server-only REST credential pair. An explicitly defined
 * Upstash setting always takes precedence, including an invalid/partial pair;
 * never combine credentials from different integrations or silently fall back. */
export function resolveRedisRestConfiguration(environment) {
  const defined = (keys) => keys.some((key) => environment[key] !== undefined);
  const keys = defined(EXPLICIT) ? EXPLICIT : defined(VERCEL) ? VERCEL : null;
  if (!keys) return null;
  const invalid = () => new Error("Shared Redis is not configured correctly.");
  const [rawUrl, rawToken] = keys.map((key) => environment[key]);
  if (typeof rawUrl !== "string" || typeof rawToken !== "string"
    || !rawUrl.trim() || !rawToken.trim()) throw invalid();
  const token = rawToken.trim();
  let url;
  try { url = new URL(rawUrl.trim()); } catch { throw invalid(); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash
    || /\s/.test(token)) throw invalid();
  return { url: url.href.replace(/\/$/, ""), token, source: keys === EXPLICIT ? "upstash" : "vercel-kv" };
}
