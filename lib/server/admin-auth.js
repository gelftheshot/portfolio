import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { createChatAbuseGuard } from "./chat-abuse-guard.js";
import { resolveRedisRestConfiguration } from "./redis-config.js";

const derivePassword = promisify(scrypt);
const SESSION_SECONDS = 2 * 60 * 60;
const BODY_BYTES = 4096;
const SCRYPT_PARAMETERS = Object.freeze({ N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
const safeMessage = "Admin access is unavailable until its server configuration is complete.";

export class AdminAuthError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
    this.code = code;
  }
}

const rejectedOrigin = () => new AdminAuthError(403, "admin_origin_rejected", "Use the admin page on this website to continue.");

/** Next.js can use an internal hostname in request.url. Host is the actual
 * authority received by the server; validate it before using it for CSRF checks.
 * Forwarded host/protocol headers never expand the accepted origin here. */
export function requestOrigin(request) {
  try {
    const internal = new URL(request.url);
    if (!["http:", "https:"].includes(internal.protocol) || internal.username || internal.password) throw rejectedOrigin();
    const host = request.headers.get("host");
    if (host === null) return internal.origin;
    if (!host || host.length > 260 || /[\s/\\?#@,%]/.test(host)) throw rejectedOrigin();
    let hostname;
    let port;
    if (host.startsWith("[")) {
      const match = /^\[([0-9a-f:.]+)\](?::([0-9]{1,5}))?$/i.exec(host);
      if (!match) throw rejectedOrigin();
      hostname = `[${match[1]}]`;
      port = match[2];
    } else {
      const match = /^([a-z0-9.-]+)(?::([0-9]{1,5}))?$/i.exec(host);
      if (!match) throw rejectedOrigin();
      hostname = match[1];
      port = match[2];
      const labels = hostname.replace(/\.$/, "").split(".");
      if (hostname.length > 253 || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) throw rejectedOrigin();
    }
    if (port !== undefined && (Number(port) < 1 || Number(port) > 65535)) throw rejectedOrigin();
    const external = new URL(`${internal.protocol}//${host}`);
    // Reject alternate numeric/escaped host spellings rather than silently
    // interpreting a different authority. URL parsing validates IPv6 syntax.
    if (!host.startsWith("[") && external.hostname.toLowerCase() !== hostname.toLowerCase()) throw rejectedOrigin();
    return external.origin;
  } catch (error) {
    if (error instanceof AdminAuthError) throw error;
    throw rejectedOrigin();
  }
}

export function assertSameOrigin(request) {
  if (request.headers.get("origin") !== requestOrigin(request)
    || ["cross-site", "same-site"].includes(request.headers.get("sec-fetch-site"))) throw rejectedOrigin();
  return true;
}

function decode(value, length) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const bytes = Buffer.from(value, "base64url");
  if (bytes.toString("base64url") !== value || (length !== undefined && bytes.length !== length)) return null;
  return bytes;
}

function passwordRecord(value) {
  if (typeof value !== "string") return null;
  const [algorithm, n, r, p, saltText, digestText, extra] = value.split("$");
  if (algorithm !== "scrypt" || n !== "131072" || r !== "8" || p !== "1" || extra !== undefined) return null;
  const salt = decode(saltText, 16);
  const digest = decode(digestText, 32);
  return salt && digest ? { salt, digest } : null;
}

function configuration(environment) {
  const hash = environment.ADMIN_PASSWORD_HASH;
  const password = passwordRecord(hash);
  const secret = decode(environment.ADMIN_SESSION_SECRET);
  const sessionConfigured = Boolean(secret && secret.length >= 32 && secret.length <= 128);
  const production = environment.NODE_ENV === "production";
  let protectionConfigured = !production;
  if (production) {
    try {
      protectionConfigured = Boolean(resolveRedisRestConfiguration(environment));
    } catch { protectionConfigured = false; }
  }
  return {
    hash, password, secret, production,
    passwordConfigured: Boolean(password), sessionConfigured, protectionConfigured,
    configured: Boolean(password && sessionConfigured && protectionConfigured),
  };
}

function summary(config) {
  return {
    configured: config.configured,
    passwordConfigured: config.passwordConfigured,
    sessionConfigured: config.sessionConfigured,
    protectionConfigured: config.protectionConfigured,
  };
}

export async function createAdminPasswordHash(password, { salt = randomBytes(16) } = {}) {
  if (typeof password !== "string" || password.length < 12 || password.length > 256 || /[\u0000-\u001f\u007f]/.test(password)) {
    throw new Error("Choose a password of 12–256 characters without control characters.");
  }
  if (!Buffer.isBuffer(salt) || salt.length !== 16) throw new Error("Invalid password salt");
  const digest = await derivePassword(password, salt, 32, SCRYPT_PARAMETERS);
  return `scrypt$131072$8$1$${salt.toString("base64url")}$${digest.toString("base64url")}`;
}

function sessionKey(config) {
  // Changing either credential invalidates every previously signed session.
  return createHmac("sha256", config.secret).update(`portfolio-admin-session-v1\0${config.hash}`).digest();
}

function signature(payload, config) {
  return createHmac("sha256", sessionKey(config)).update(payload).digest();
}

function cookieName(config) {
  return config.production ? "__Host-portfolio-admin" : "portfolio-admin";
}

function readCookie(request, name) {
  const matches = (request.headers.get("cookie") || "").split(";")
    .map((entry) => entry.trim()).filter((entry) => entry.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  return matches[0].slice(name.length + 1);
}

function signedSession(config, now, nonce) {
  const issued = Math.floor(now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    v: 1, iat: issued, exp: issued + SESSION_SECONDS, nonce: nonce().toString("base64url"),
  })).toString("base64url");
  return `${payload}.${signature(payload, config).toString("base64url")}`;
}

function validSession(request, config, now) {
  if (!config.configured) return false;
  try { if (config.production && !requestOrigin(request).startsWith("https:")) return false; }
  catch { return false; }
  const token = readCookie(request, cookieName(config));
  if (!token || token.length > 1024) return false;
  const [payload, mac, extra] = token.split(".");
  if (extra !== undefined) return false;
  const received = decode(mac, 32);
  const bytes = decode(payload);
  if (!received || !bytes || !timingSafeEqual(received, signature(payload, config))) return false;
  try {
    const session = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    const seconds = Math.floor(now() / 1000);
    return Boolean(
      session?.v === 1 && Number.isSafeInteger(session.iat) && session.iat >= 0
      && Number.isSafeInteger(session.exp) && session.exp === session.iat + SESSION_SECONDS
      && session.iat <= seconds + 30 && session.exp > seconds && decode(session.nonce, 16)
    );
  } catch { return false; }
}

function cookie(config, value, now, clear = false) {
  const maxAge = clear ? 0 : SESSION_SECONDS;
  const expires = clear ? new Date(0) : new Date(now() + SESSION_SECONDS * 1000);
  return `${cookieName(config)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}; Expires=${expires.toUTCString()}${config.production ? "; Secure" : ""}`;
}

function response(body, status = 200, headers = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store", Vary: "Cookie", "X-Robots-Tag": "noindex, nofollow", ...headers,
    },
  });
}

function failure(error) {
  if (error instanceof AdminAuthError) return response({ error: { code: error.code, message: error.message } }, error.status);
  return response({ error: { code: "admin_unavailable", message: "Admin access is temporarily unavailable. Please try again." } }, 503);
}

async function readPassword(request, timeoutMs) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) {
    throw new AdminAuthError(415, "admin_invalid_request", "Please send a JSON sign-in request.");
  }
  if (Number(request.headers.get("content-length")) > BODY_BYTES) {
    throw new AdminAuthError(413, "admin_request_too_large", "The sign-in request is too large.");
  }
  if (!request.body) throw new AdminAuthError(400, "admin_invalid_request", "Enter your admin password.");
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  let timer;
  let cancel;
  const deadline = new Promise((_, reject) => {
    const stop = (status, code, message) => {
      reject(new AdminAuthError(status, code, message));
      void reader.cancel().catch(() => {});
    };
    timer = setTimeout(() => stop(408, "admin_request_timeout", "The sign-in request timed out. Please try again."), timeoutMs);
    cancel = () => stop(400, "admin_request_cancelled", "The sign-in request was cancelled.");
    request.signal.addEventListener("abort", cancel, { once: true });
    if (request.signal.aborted) cancel();
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      length += value.byteLength;
      if (length > BODY_BYTES) {
        await reader.cancel();
        throw new AdminAuthError(413, "admin_request_too_large", "The sign-in request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
  let password;
  try {
    const payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, length)));
    password = payload?.password;
  } catch {
    throw new AdminAuthError(400, "admin_invalid_request", "The sign-in request could not be read.");
  }
  if (typeof password !== "string" || password.length < 1 || password.length > 256) {
    throw new AdminAuthError(400, "admin_invalid_password", "Enter a password of at most 256 characters.");
  }
  return password;
}

/** Portable owner authentication. No Next.js or private environment values are serialized. */
export function createAdminAuth({ environment = process.env, getEnvironment = () => environment,
  now = Date.now, nonce = () => randomBytes(16), fetchImpl = globalThis.fetch, rateLimit,
  bodyTimeoutMs = 5000,
} = {}) {
  let verifications = 0;
  const guard = rateLimit || createChatAbuseGuard({
    getEnvironment: () => {
      const env = getEnvironment();
      return {
        NODE_ENV: env.NODE_ENV,
        // The public admin never inherits chat's private-preview memory override.
        CHAT_RATE_LIMIT_MODE: env.NODE_ENV === "production" ? "shared" : "memory",
        UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
        UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,
        KV_REST_API_URL: env.KV_REST_API_URL,
        KV_REST_API_TOKEN: env.KV_REST_API_TOKEN,
        CHAT_TRUSTED_PROXY: env.CHAT_TRUSTED_PROXY,
        CHAT_RATE_LIMIT_NAMESPACE: "portfolio-admin-login",
        CHAT_CLIENT_RATE_LIMIT: "5",
        CHAT_DAILY_REQUEST_LIMIT: "100",
      };
    }, fetchImpl, now,
  });

  function checkOrigin(request) {
    return assertSameOrigin(request);
  }

  function getSession(request) { return validSession(request, configuration(getEnvironment()), now); }

  function assertRequest(request, { mutation = false } = {}) {
    if (mutation) checkOrigin(request);
    const config = configuration(getEnvironment());
    if (!config.configured) throw new AdminAuthError(503, "admin_not_configured", safeMessage);
    if (!validSession(request, config, now)) throw new AdminAuthError(401, "admin_unauthorized", "Sign in to manage your portfolio.");
    return true;
  }

  function GET(request) {
    const config = configuration(getEnvironment());
    return response({ authenticated: validSession(request, config, now), configured: config.configured });
  }

  async function POST(request) {
    try {
      checkOrigin(request);
      const config = configuration(getEnvironment());
      if (!config.configured) throw new AdminAuthError(503, "admin_not_configured", safeMessage);
      if (config.production && !requestOrigin(request).startsWith("https:")) {
        throw new AdminAuthError(503, "admin_https_required", "Admin sign-in requires HTTPS.");
      }
      const admission = await guard(request);
      if (!admission.allowed) {
        const headers = admission.retryAfter ? { "Retry-After": String(admission.retryAfter) } : {};
        return response({ error: {
          code: admission.status === 429 ? "admin_signin_limited" : "admin_protection_unavailable",
          message: admission.status === 429 ? "Too many sign-in attempts. Please try again later." : "Admin sign-in protection is unavailable. Please try again later.",
        } }, admission.status === 429 ? 429 : 503, headers);
      }
      const password = await readPassword(request, bodyTimeoutMs);
      if (verifications >= 2) return response({ error: { code: "admin_signin_busy", message: "Sign-in is busy. Please try again shortly." } }, 429, { "Retry-After": "1" });
      let digest;
      verifications += 1;
      try { digest = await derivePassword(password, config.password.salt, 32, SCRYPT_PARAMETERS); }
      finally { verifications -= 1; }
      if (!timingSafeEqual(digest, config.password.digest)) {
        throw new AdminAuthError(401, "admin_invalid_credentials", "The admin password is incorrect.");
      }
      return response({ authenticated: true, configured: true }, 200, {
        "Set-Cookie": cookie(config, signedSession(config, now, nonce), now),
      });
    } catch (error) { return failure(error); }
  }

  function DELETE(request) {
    try {
      checkOrigin(request);
      const config = configuration(getEnvironment());
      return response({ authenticated: false, configured: config.configured }, 200, {
        "Set-Cookie": cookie(config, "", now, true),
      });
    } catch (error) { return failure(error); }
  }

  return { getSession, assertRequest, checkOrigin, GET, POST, DELETE,
    getConfiguration: () => summary(configuration(getEnvironment())),
  };
}

const ownerAuth = createAdminAuth();
export const adminSession = (request) => ownerAuth.getSession(request);
export const assertAdminRequest = (request, options) => ownerAuth.assertRequest(request, options);
export const getAdminConfiguration = () => ownerAuth.getConfiguration();
export const adminSessionHandlers = { GET: ownerAuth.GET, POST: ownerAuth.POST, DELETE: ownerAuth.DELETE };
