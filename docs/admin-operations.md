# Private assistant controls and contact inbox

The Assistant and Inbox tabs at `/admin` use the same owner session as the content editor. All reads require a valid signed session. Settings updates and message status changes also require an exact matching `Origin`; cross-site and sibling-site requests are rejected. Responses are private, uncached, and excluded from indexing.

`GET /api/admin/operations` returns assistant settings, up to 200 private contact messages, the storage mode (`shared` or development-only `memory`), and configuration booleans. Configuration contains no keys, tokens, credentials, or provider configuration values. `PUT /api/admin/operations` accepts only `{ settings: { enabled, model, instructions } }`. The model ID is bounded to 100 safe characters, guidance to 2,000 characters, and enabled to a boolean. Settings do not edit API keys.

`PATCH /api/admin/messages/{id}` accepts only `{ status: "new" | "read" | "archived" }`. Archiving changes the inbox status; it preserves the original expiration. There is no public message-list endpoint and no permanent-delete action.

## Storage

Production requires a complete server-only REST pair: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, or the Vercel Upstash integration's `KV_REST_API_URL` and `KV_REST_API_TOKEN`. The shared resolver gives any defined explicit Upstash setting precedence; blank, partial, or invalid explicit settings fail closed and never fall back to KV aliases. Both values must come from the selected pair. The URL must use HTTPS and contain no credentials, query, or fragment; the write token cannot contain whitespace. Missing, invalid, or unavailable shared storage fails closed. No environment files or external accounts are changed by this implementation. Local development with neither pair defined uses bounded process memory for private previews; restarts discard those settings and messages. A read-only token or TCP connection string cannot replace the REST write credentials.

Private keys use the fixed `{portfolio-admin-ops}` namespace, separate from public assistant quotas, contact quotas, and admin sign-in quotas. Settings persist in Redis. Each message has an individual 30-day TTL. A bounded sorted index retains the newest 200 messages and removes expired references during reads and submissions; overflow also deletes the oldest message values. Message status edits preserve the remaining TTL. Redis calls use fixed commands and fixed Lua scripts, validated UUIDs, no caller-provided Redis keys or URLs, bounded response bodies, timeouts, and no redirects.

Contact names, addresses, and messages stay in the private store. They are never written to the public repository, assistant knowledge files, exports, or logs. No chat transcripts are stored by these controls. Limit Redis credential access to the server and use the storage provider's access controls for the private inbox.

## Contact delivery

The existing EmailJS browser delivery remains active. The form also makes a parallel best-effort `POST /api/contact` with normalized contact fields and a browser-generated UUID. The route validates the same field limits as the form, requires the exact site origin, limits body size and read time, and has its own quota namespace (`portfolio-contact`): five submissions per client per minute and 100 globally per UTC day. Production quota reservation requires shared Redis, regardless of chat's preview settings. Trusted visitor IP handling uses `CHAT_TRUSTED_PROXY`, as the existing assistant guard does.

The public response confirms only receipt and the submission ID. The request shape is `{ id, name, email, message }`, with a version-4 UUID in `id`. Retrying the same UUID with identical normalized fields returns the existing receipt without creating another inbox message. Reusing it for different fields returns a conflict. A matching retry does not reset the message status or extend retention. The form retains the UUID when an unsuccessful attempt is retried with unchanged fields. Its EmailJS submission lock stays active while delivery is pending, including after a confirmation timeout, because that provider cannot cancel requests.

Confirmed EmailJS delivery says the message was **sent**. Private inbox receipt alone says it was **received**. Either confirmation clears the form; without confirmation, fields remain available and errors use safe classifications. The private archive request has a 12-second cancellation deadline; EmailJS retains its existing 20-second confirmation warning. The application sends no additional email from the server.

## Assistant behavior

Before reserving generation quota or calling OpenAI, the server reads private assistant settings. Disabled assistants return a safe 503 response without constructing a provider client. Storage or invalid-settings failures also prevent generation. With no saved settings, the assistant defaults to enabled, the existing `OPENAI_MODEL` (or `gpt-6.1-sol`), and empty additional guidance. The existing `getModel` test injection continues to supply this fallback.

Saved model IDs override that fallback. The existing low reasoning-effort option is applied only to the original default model. Additional guidance is included as bounded style and emphasis data, with explicit instructions that it cannot replace the portfolio's factual, privacy, scope, or safety rules. API responses still use `store: false`.

`createAdminOperations` injects environment, fetch, clock, owner authorization, quota guard, and deadlines for offline tests. `createChatHandler` additionally accepts `getAssistantSettings` so disabled states, provider payloads, and storage failures can be verified without paid calls or external storage.
