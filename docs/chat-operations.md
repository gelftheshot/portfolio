# Portfolio assistant admission controls

Local development needs only `OPENAI_API_KEY`. The public production endpoint uses a shared Redis quota before it constructs an OpenAI client. The portfolio itself continues to render if chat is unavailable.

## Server environment

Use these variables in the hosting provider's server environment. None should have a `NEXT_PUBLIC_` prefix.

| Variable | Default | Meaning |
| --- | --- | --- |
| `CHAT_RATE_LIMIT_MODE` | `shared` when `NODE_ENV=production`; `memory` otherwise | `shared` is the production mode. `memory` is an explicit exception for a private local production preview. There is no disabled or fail-open mode. |
| `UPSTASH_REDIS_REST_URL` | Required for shared mode | HTTPS REST endpoint for a persistent Redis database supporting the Upstash command-array protocol and atomic `EVAL`. Embedded credentials, query parameters, and fragments are rejected. |
| `UPSTASH_REDIS_REST_TOKEN` | Required for shared mode | Server-only, write-capable REST token. A read-only token cannot reserve quotas. |
| `CHAT_TRUSTED_PROXY` | `none` | One of `none`, `vercel`, `cloudflare`, `x-real-ip`, or `x-forwarded-for`. Select only the proxy actually securing the deployment. |
| `CHAT_CLIENT_RATE_LIMIT` | `20` | Admitted requests per client bucket in a 60-second fixed window. Integer from 1 to 120. |
| `CHAT_DAILY_REQUEST_LIMIT` | `200` | Global admitted requests per UTC calendar day. Integer from 1 to 10,000. |
| `CHAT_RATE_LIMIT_NAMESPACE` | `portfolio` | Stable shared quota namespace, using 1–64 letters, digits, underscores, or hyphens. All production instances must use the same namespace and limits. |

For a Vercel deployment, a typical server configuration is:

```dotenv
CHAT_RATE_LIMIT_MODE=shared
UPSTASH_REDIS_REST_URL=https://your-database.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-server-only-write-token
CHAT_TRUSTED_PROXY=vercel
CHAT_CLIENT_RATE_LIMIT=20
CHAT_DAILY_REQUEST_LIMIT=200
CHAT_RATE_LIMIT_NAMESPACE=portfolio-production
```

Configure the existing server-side `OPENAI_API_KEY` and optional `OPENAI_MODEL` as well. Restart or redeploy after changing configuration. Never commit actual tokens. Provisioning a Redis database and setting hosting variables are separate operator actions; this implementation does not create external resources.

## Proxy trust

By default all requests use one shared `anonymous` client bucket. Forged `x-forwarded-for`, `x-real-ip`, Cloudflare, or Vercel headers therefore cannot create fresh client identities. This conservative default can limit unrelated visitors together; the daily quota still applies.

`vercel` reads only `x-vercel-forwarded-for`. Vercel documents this as its platform-forwarded client address. Use this setting only when requests actually pass through Vercel's managed boundary.

`cloudflare` reads only `cf-connecting-ip`. The origin must accept requests only through the intended, authenticated Cloudflare proxy or tunnel; an independently reachable origin would let callers forge the header. Worker subrequests can change how this address is populated, so verify the deployed topology first.

The generic `x-real-ip` and `x-forwarded-for` options are for an operator-controlled reverse proxy that **overwrites** the selected header with one validated client IP and prevents direct origin access. Appending an untrusted chain is insufficient. Missing, invalid, or comma-separated values use the shared anonymous bucket. IPv6 spelling is normalized. A header by itself is not proof that a request passed through a trusted proxy.

## Shared quota behavior

Each valid, configured chat request sends one HTTPS `EVAL` command. A Lua script checks the client window and the global daily counter and reserves both in one atomic operation. Concurrent functions and regions using the same Redis database and namespace therefore cannot independently spend the same remaining quota. Redis server time determines UTC midnight rather than each application's clock.

Client counters expire after their 60-second window. The daily counter expires at UTC midnight. Redis stores a counter and a token-keyed HMAC of the selected client address, with no raw IP, question, conversation, API key, email address, or portfolio dataset in the stored keys or values. The database still receives its own authorization token over HTTPS. These counters are pseudonymous operational data, not an anonymity guarantee.

A reservation counts an admitted attempt, including one that later fails, is cancelled, or times out. It is not refunded; a lost backend response can have reserved a slot even though the application refuses the request. OpenAI SDK automatic retries are disabled, so the application does not silently turn one reservation into a second generation attempt.

Client or daily exhaustion returns HTTP `429`, the existing JSON error shape, and `Retry-After`. Missing or invalid shared settings, Redis authorization failures, HTTP errors, malformed responses, and a backend timeout return a safe HTTP `503` before OpenAI is called. Shared mode never falls back to local counters. Quota lookups have a 2.5-second deadline and are cancelled when the caller aborts. Backend error bodies and credentials are neither returned nor logged.

This is a request allowance, not a monetary billing cap. The selected model, input size, and output usage determine the cost of an admitted request. Existing request-size, conversation-size, 45-second generation timeout, and 4,096-output-token limits remain in place. Configure provider spending controls and hosting firewall limits as well: these guards do not eliminate hosting costs, Redis request costs, distributed denial of service, or misuse by many genuine IP addresses. Do not give other services an unrestricted path to the same OpenAI key and assume this route's quota covers them.

Keep the Redis database durable and its quota keys intact. Deleting keys, replacing the database, or changing the namespace resets the allowance. Isolate staging with a separate namespace only when a separate budget is intended. Token rotation changes client pseudonyms; the global counter remains tied to the unchanged namespace. Keep configuration consistent across all production instances.

## Local production preview

`next start` uses `NODE_ENV=production`, so it intentionally refuses chat without shared protection. For a private preview on localhost, explicitly set:

```dotenv
CHAT_RATE_LIMIT_MODE=memory
```

Memory mode retains the per-client and daily checks, but they exist only inside one process and reset on restart. It is not a durable production spending control. Do not carry this override into the public deployment. `next dev` already uses memory mode by default and needs no Redis credentials.

## Verification and operation

`npm test` uses fully mocked Redis HTTP transport and OpenAI calls. It verifies shared counter keys across independent guard instances and concurrent requests, the atomic command contract, limit responses, forged-header handling, configuration failures, cancellation, timeout, and preserved streaming behavior. It does not make a real Redis write or consume OpenAI credits.

After configuring the chosen host and database, an operator should verify the live REST permissions and proxy header behavior before public traffic, then confirm a chat response and the expected `429` responses using a small staging allowance. This operational acceptance check has not been performed by the unit tests. If Redis is unavailable, the visible website and email/contact routes remain usable while the paid assistant fails closed. Removing the OpenAI API key also disables paid generation.

Primary documentation: [Upstash REST command arrays](https://upstash.com/docs/redis/features/restapi), [atomic Lua over REST](https://upstash.com/blog/lua-scripting-on-upstash-redis-atomic-operations-over-http), [Vercel request headers](https://vercel.com/docs/headers/request-headers), and [Cloudflare client IP behavior](https://developers.cloudflare.com/fundamentals/reference/http-headers/).
