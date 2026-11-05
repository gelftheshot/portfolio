import { DEFAULT_CHAT_MODEL } from "../chat-config.js";
import { validateContactFields } from "../contact.js";
import { assertAdminRequest, assertSameOrigin } from "./admin-auth.js";
import { createChatAbuseGuard } from "./chat-abuse-guard.js";
import { resolveRedisRestConfiguration } from "./redis-config.js";

const NAMESPACE = "portfolio-admin-ops";
const PREFIX = `{${NAMESPACE}}`;
const SETTINGS_KEY = `${PREFIX}:settings`;
const INDEX_KEY = `${PREFIX}:messages`;
const RETENTION_SECONDS = 30 * 86400;
const MESSAGE_LIMIT = 200;
const BODY_BYTES = 32_768;
const BACKEND_BYTES = 7_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const STATUSES = new Set(["new", "read", "archived"]);
const unavailableMessage = "Private settings and messages are temporarily unavailable. Please try again later.";

export const DEFAULT_ASSISTANT_SETTINGS = Object.freeze({ enabled: true, model: DEFAULT_CHAT_MODEL, instructions: "" });

export class AdminOperationsError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "AdminOperationsError";
    this.status = status;
    this.code = code;
  }
}

const unavailable = () => new AdminOperationsError(503, "operations_unavailable", unavailableMessage);
const invalid = (message) => new AdminOperationsError(400, "invalid_request", message);

function object(value) { return value && typeof value === "object" && !Array.isArray(value); }
function onlyKeys(value, keys) { return object(value) && Object.keys(value).every((key) => keys.includes(key)); }

export function validateAssistantSettings(value) {
  if (!onlyKeys(value, ["enabled", "model", "instructions"]) || Object.keys(value).length !== 3
    || typeof value.enabled !== "boolean"
    || typeof value.model !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(value.model)
    || typeof value.instructions !== "string" || value.instructions.length > 2000
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value.instructions)) {
    throw invalid("Use an enabled switch, a model ID of at most 100 characters, and guidance of at most 2,000 characters.");
  }
  return { enabled: value.enabled, model: value.model, instructions: value.instructions.trim() };
}

function defaults(environment, model) {
  return validateAssistantSettings({ ...DEFAULT_ASSISTANT_SETTINGS, model: model || environment.OPENAI_MODEL?.trim() || DEFAULT_CHAT_MODEL });
}

function storageConfiguration(environment) {
  try {
    const redis = resolveRedisRestConfiguration(environment);
    if (!redis && environment.NODE_ENV !== "production") return { mode: "memory" };
    if (!redis) throw unavailable();
    return { mode: "shared", url: redis.url, token: redis.token };
  } catch { throw unavailable(); }
}

function response(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: {
    "Cache-Control": "private, no-store", Vary: "Cookie", "X-Robots-Tag": "noindex, nofollow", ...headers,
  } });
}

function failure(error, contact = false) {
  const known = error && Number.isInteger(error.status) && typeof error.code === "string" && typeof error.message === "string"
    && (["AdminAuthError", "AdminOperationsError"].includes(error.name));
  if (known) return response({ error: { code: error.code, message: error.message } }, error.status);
  return response({ error: { code: contact ? "contact_unavailable" : "operations_unavailable", message: contact
    ? "Your message could not be received here. Please use the email option or try again later."
    : unavailableMessage } }, 503);
}

function sameOrigin(request) {
  try { assertSameOrigin(request); }
  catch { throw new AdminOperationsError(403, "contact_origin_rejected", "Use the contact form on this website to send your message."); }
}

async function boundedJSON(stream, maximum, { signal, timeoutMs = 5000 } = {}) {
  if (!stream) throw invalid("Send a JSON request.");
  const reader = stream.getReader();
  let timer;
  let onAbort;
  const deadline = new Promise((_, reject) => {
    const stop = () => {
      reject(new AdminOperationsError(408, "request_timeout", "The request timed out. Please try again."));
      void reader.cancel().catch(() => {});
    };
    timer = setTimeout(stop, timeoutMs);
    onAbort = stop;
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) stop();
  });
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      length += value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        throw new AdminOperationsError(413, "request_too_large", "The request is too large.");
      }
      chunks.push(value);
    }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, length))); }
    catch { throw invalid("The JSON request could not be read."); }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
    reader.releaseLock();
  }
}

async function readPayload(request, bodyTimeoutMs) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) {
    throw new AdminOperationsError(415, "invalid_content_type", "Send a JSON request.");
  }
  if (Number(request.headers.get("content-length")) > BODY_BYTES) {
    throw new AdminOperationsError(413, "request_too_large", "The request is too large.");
  }
  return boundedJSON(request.body, BODY_BYTES, { signal: request.signal, timeoutMs: bodyTimeoutMs });
}

// Message values have individual TTLs. The index is bounded at 200, and every
// list/insert removes expired references. All message keys share one Redis slot.
export const LIST_ADMIN_MESSAGES_SCRIPT = `
local ids = redis.call('ZREVRANGE', KEYS[2], 0, 200)
local result = {redis.call('GET', KEYS[1]) or ''}
for _, id in ipairs(ids) do
  local message = redis.call('GET', KEYS[2] .. ':message:' .. id)
  if message then table.insert(result, message)
  else redis.call('ZREM', KEYS[2], id) end
end
return result
`;

export const ARCHIVE_CONTACT_SCRIPT = `
local key = KEYS[2] .. ':message:' .. ARGV[1]
local existing = redis.call('GET', key)
if existing then
  local old = cjson.decode(existing)
  local incoming = cjson.decode(ARGV[2])
  if old.name ~= incoming.name or old.email ~= incoming.email or old.message ~= incoming.message then return {2, 0} end
  return {0, old.createdAt}
end
local ids = redis.call('ZRANGE', KEYS[2], 0, 200)
for _, id in ipairs(ids) do
  if redis.call('EXISTS', KEYS[2] .. ':message:' .. id) == 0 then redis.call('ZREM', KEYS[2], id) end
end
local clock = redis.call('TIME')
local created = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local record = cjson.decode(ARGV[2])
record.createdAt = created
redis.call('SET', key, cjson.encode(record), 'EX', 2592000)
redis.call('ZADD', KEYS[2], created, ARGV[1])
redis.call('EXPIRE', KEYS[2], 2592000)
local overflow = redis.call('ZCARD', KEYS[2]) - 200
if overflow > 0 then
  local old = redis.call('ZRANGE', KEYS[2], 0, math.min(overflow, 201) - 1)
  for _, id in ipairs(old) do
    redis.call('DEL', KEYS[2] .. ':message:' .. id)
    redis.call('ZREM', KEYS[2], id)
  end
end
return {1, created}
`;

export const UPDATE_CONTACT_STATUS_SCRIPT = `
local key = KEYS[2] .. ':message:' .. ARGV[1]
local raw = redis.call('GET', key)
if not raw then redis.call('ZREM', KEYS[2], ARGV[1]); return '' end
local ttl = redis.call('PTTL', key)
if ttl <= 0 then redis.call('DEL', key); redis.call('ZREM', KEYS[2], ARGV[1]); return '' end
local record = cjson.decode(raw)
record.status = ARGV[2]
local updated = cjson.encode(record)
redis.call('SET', key, updated, 'PX', ttl)
return updated
`;

function storedMessage(raw) {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    const validation = validateContactFields(value);
    if (!onlyKeys(value, ["id", "name", "email", "message", "createdAt", "status"])
      || !UUID.test(value.id) || !validation.valid || !STATUSES.has(value.status)
      || !Number.isSafeInteger(value.createdAt) || value.createdAt < 0) throw unavailable();
    return { id: value.id, ...validation.fields, createdAt: new Date(value.createdAt).toISOString(), status: value.status };
  } catch { throw unavailable(); }
}

/** All network/storage dependencies are injectable; private data never enters the repository. */
export function createAdminOperations({ environment = process.env, getEnvironment = () => environment,
  fetchImpl = globalThis.fetch, now = Date.now, assertRequest = assertAdminRequest,
  rateLimit, timeoutMs = 2500, bodyTimeoutMs = 5000,
} = {}) {
  const memory = { settings: null, messages: new Map() };
  const guard = rateLimit || createChatAbuseGuard({ getEnvironment: () => {
    const env = getEnvironment();
    return {
      NODE_ENV: env.NODE_ENV, CHAT_RATE_LIMIT_MODE: env.NODE_ENV === "production" ? "shared" : "memory",
      UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,
      KV_REST_API_URL: env.KV_REST_API_URL, KV_REST_API_TOKEN: env.KV_REST_API_TOKEN,
      CHAT_TRUSTED_PROXY: env.CHAT_TRUSTED_PROXY, CHAT_RATE_LIMIT_NAMESPACE: "portfolio-contact",
      CHAT_CLIENT_RATE_LIMIT: "5", CHAT_DAILY_REQUEST_LIMIT: "100",
    };
  }, fetchImpl, now, timeoutMs });

  async function command(config, args, signal) {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(onAbort, timeoutMs);
    timer.unref?.();
    try {
      if (signal?.aborted) throw unavailable();
      const result = await fetchImpl(config.url, {
        method: "POST", headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
        body: JSON.stringify(args), signal: controller.signal, redirect: "error", cache: "no-store",
      });
      if (!result.ok) { await result.body?.cancel(); throw unavailable(); }
      const payload = await boundedJSON(result.body, BACKEND_BYTES, { signal: controller.signal, timeoutMs });
      if (!object(payload) || Object.hasOwn(payload, "error") || !Object.hasOwn(payload, "result")) throw unavailable();
      return payload.result;
    } catch { throw unavailable(); }
    finally { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); }
  }

  function pruneMemory() {
    const cutoff = now() - RETENTION_SECONDS * 1000;
    for (const [id, value] of memory.messages) if (value.createdAt <= cutoff) memory.messages.delete(id);
    while (memory.messages.size > MESSAGE_LIMIT) memory.messages.delete(memory.messages.keys().next().value);
  }

  async function readSettings(signal, fallbackModel) {
    const env = getEnvironment();
    const config = storageConfiguration(env);
    const raw = config.mode === "memory" ? memory.settings : await command(config, ["GET", SETTINGS_KEY], signal);
    if (raw === null) return defaults(env, fallbackModel);
    try { return validateAssistantSettings(typeof raw === "string" ? JSON.parse(raw) : raw); }
    catch { throw unavailable(); }
  }

  async function GET(request) {
    try {
      assertRequest(request);
      const env = getEnvironment();
      const config = storageConfiguration(env);
      let settings;
      let messages;
      if (config.mode === "memory") {
        pruneMemory();
        settings = memory.settings || defaults(env);
        messages = [...memory.messages.values()].reverse().map(storedMessage);
      } else {
        const values = await command(config, ["EVAL", LIST_ADMIN_MESSAGES_SCRIPT, 2, SETTINGS_KEY, INDEX_KEY], request.signal);
        if (!Array.isArray(values) || values.length < 1 || values.length > MESSAGE_LIMIT + 1 || typeof values[0] !== "string") throw unavailable();
        try { settings = values[0] ? validateAssistantSettings(JSON.parse(values[0])) : defaults(env); }
        catch { throw unavailable(); }
        messages = values.slice(1).map(storedMessage);
      }
      return response({ settings, messages, storage: config.mode, configuration: {
        openAI: Boolean(env.OPENAI_API_KEY?.trim()),
        emailJS: Boolean(env.NEXT_PUBLIC_SERVICE_ID?.trim() && env.NEXT_PUBLIC_TEMPLATE_ID?.trim() && env.NEXT_PUBLIC_PUBLIC_KEY?.trim()),
        storage: config.mode === "shared",
      } });
    } catch (error) { return failure(error); }
  }

  async function PUT(request) {
    try {
      assertRequest(request, { mutation: true });
      const payload = await readPayload(request, bodyTimeoutMs);
      if (!onlyKeys(payload, ["settings"]) || Object.keys(payload).length !== 1) throw invalid("Send only assistant settings.");
      const settings = validateAssistantSettings(payload.settings);
      const config = storageConfiguration(getEnvironment());
      if (config.mode === "memory") memory.settings = settings;
      else if (await command(config, ["SET", SETTINGS_KEY, JSON.stringify(settings)], request.signal) !== "OK") throw unavailable();
      return response({ settings });
    } catch (error) { return failure(error); }
  }

  async function PATCH(request, { params } = {}) {
    try {
      assertRequest(request, { mutation: true });
      const id = (await params)?.id;
      if (typeof id !== "string" || !UUID.test(id)) throw invalid("Choose a valid message.");
      const payload = await readPayload(request, bodyTimeoutMs);
      if (!onlyKeys(payload, ["status"]) || Object.keys(payload).length !== 1 || !STATUSES.has(payload.status)) throw invalid("Choose new, read, or archived status.");
      const config = storageConfiguration(getEnvironment());
      let value;
      if (config.mode === "memory") {
        pruneMemory();
        value = memory.messages.get(id);
        if (value) { value.status = payload.status; value = storedMessage(value); }
      } else {
        const raw = await command(config, ["EVAL", UPDATE_CONTACT_STATUS_SCRIPT, 2, SETTINGS_KEY, INDEX_KEY, id, payload.status], request.signal);
        if (typeof raw !== "string") throw unavailable();
        value = raw ? storedMessage(raw) : null;
      }
      if (!value) throw new AdminOperationsError(404, "message_not_found", "This message has expired or is no longer available.");
      return response({ message: value });
    } catch (error) { return failure(error); }
  }

  async function POST(request) {
    try {
      sameOrigin(request);
      const payload = await readPayload(request, bodyTimeoutMs);
      if (!onlyKeys(payload, ["id", "name", "email", "message"]) || typeof payload.id !== "string" || !UUID.test(payload.id)) throw invalid("Send your contact details and a valid submission ID.");
      const validation = validateContactFields(payload);
      if (!validation.valid) throw invalid(validation.message);
      const config = storageConfiguration(getEnvironment());
      const admission = await guard(request);
      if (admission?.allowed !== true) {
        const limited = admission?.status === 429;
        return response({ error: { code: limited ? "contact_rate_limited" : "contact_protection_unavailable", message: limited
          ? "Several messages have been received recently. Please try again later or use the email option."
          : "Your message could not be received here. Please use the email option or try again later." } }, limited ? 429 : 503,
        limited && Number.isSafeInteger(admission.retryAfter) ? { "Retry-After": String(admission.retryAfter) } : {});
      }
      const record = { id: payload.id, ...validation.fields, status: "new" };
      let created;
      if (config.mode === "memory") {
        pruneMemory();
        const existing = memory.messages.get(record.id);
        if (existing) {
          if (["name", "email", "message"].some((key) => record[key] !== existing[key])) throw new AdminOperationsError(409, "contact_id_conflict", "This submission ID was already used. Refresh the page before sending a new message.");
          created = false;
        } else {
          memory.messages.set(record.id, { ...record, createdAt: now() });
          pruneMemory();
          created = true;
        }
      } else {
        const value = await command(config, ["EVAL", ARCHIVE_CONTACT_SCRIPT, 2, SETTINGS_KEY, INDEX_KEY, record.id, JSON.stringify(record)], request.signal);
        if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isSafeInteger) || ![0, 1, 2].includes(value[0]) || value[1] < 0) throw unavailable();
        if (value[0] === 2) throw new AdminOperationsError(409, "contact_id_conflict", "This submission ID was already used. Refresh the page before sending a new message.");
        created = value[0] === 1;
      }
      return response({ received: true, id: record.id }, created ? 201 : 200);
    } catch (error) { return failure(error, true); }
  }

  return { GET, PUT, PATCH, POST, readSettings };
}

const operations = createAdminOperations();
export const getAssistantSettings = (request, { model } = {}) => operations.readSettings(request?.signal, model);
export const operationsHandlers = { GET: operations.GET, PUT: operations.PUT };
export const messageStatusHandler = operations.PATCH;
export const contactHandler = operations.POST;
