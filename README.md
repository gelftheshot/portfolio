# Lihon Gebre’s portfolio

A monochrome, scrolling portfolio with 11 project case studies, six employment records, public client feedback, downloadable résumé files, and an OpenAI assistant grounded in the same public content.

The application uses Next.js **16.4.5**, React **19.3.1**, and the ESLint CLI. Use Node.js **24**, as recorded in `.nvmrc`, and the committed npm lockfile.

The existing project origin is [portfolio-one-rose-74.vercel.app](https://portfolio-one-rose-74.vercel.app). That address identifies the deployment target; it does not mean the latest local changes have been deployed or accepted.

## Local development

```sh
nvm use
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). Copy `.env.example` to the ignored `.env.local` and fill only the settings you need. The public portfolio renders without an API key; the assistant reports that it is unavailable until configured.

## Site origin and public content

Set `NEXT_PUBLIC_SITE_URL` to the public origin before building. The default is `https://portfolio-one-rose-74.vercel.app`. `lib/site.js` and `lib/profile.js` use that single setting for public profile links, case-study links, contact and résumé links, canonicals, structured data, social metadata, sitemap entries, and text exports. Keep build and runtime environments aligned. Changing the origin requires a rebuild and regeneration of saved résumé/data exports; those static files do not rewrite themselves at runtime.

- `data/profile.json`: professional facts, six roles, skills, education, listed training credentials, and profile links.
- `data/projects.json` (exported by `lib/projects.js`): all 11 projects, technical context, sources, and featured case-study scope notes. Preserve the distinction between product capabilities and personal contributions.
- `data/upwork.json`: public completed work and feedback. Keep exact titles, dates, ratings, client account attributions, and quotation wording; retain dated snapshots rather than claiming live statistics.
- `lib/assistant-knowledge.js`: shared public knowledge and evidence boundaries. It does not establish missing achievements, deployment metrics, current availability, or independent credential verification.

Refresh the portable assistant dataset after content edits:

```sh
npm run assistant:export
```

This writes `embeding/data.json`. The legacy Python embedding scripts are not used by the website or assistant. No embedding service or vector database is needed for this portfolio’s chat.

## Résumé downloads

The website serves `public/Lihon-Gebre-Resume.pdf` and `public/Lihon-Gebre-Resume.txt`. Both are generated from the shared public knowledge records:

```sh
npm run resume:build
```

This runs the Node-based `scripts/generate-resume.mjs` using the shared public knowledge records. The build automatically regenerates both the assistant dataset and résumé before compiling Next.js, so admin content edits update the downloads too. Working copies go under ignored `output/pdf/`; public PDF/text go into `public/`. Current content fits two pages; longer histories add pages without dropping roles. Provide the same `NEXT_PUBLIC_SITE_URL` when overriding the origin, and review the career facts before publication. The old Python generator is retained as a legacy tool and is not required by builds.

## AI assistant configuration

Local `npm run dev` needs a server-side key in `.env.local`:

```dotenv
OPENAI_API_KEY=your-server-side-key
```

The configured default is `gpt-6.1-sol` through the OpenAI Responses API with streamed output and low reasoning effort. `OPENAI_MODEL` optionally selects another Responses-compatible model; overrides use the selected model’s default reasoning settings. Model access and API billing are account configuration, not supplied by this repository.

Public production chat requires the shared admission guard described in [docs/chat-operations.md](docs/chat-operations.md). Configure `CHAT_RATE_LIMIT_MODE=shared`, `UPSTASH_REDIS_REST_URL`, and a server-only `UPSTASH_REDIS_REST_TOKEN`. Use `CHAT_TRUSTED_PROXY=vercel` only on the existing Vercel deployment. Missing or unavailable shared protection rejects chat before paid generation; it does not prevent the portfolio from rendering. Local process memory is not a public production quota.

The key is never placed in a `NEXT_PUBLIC_` variable. Requests use `store: false`; that setting is not a claim of zero provider retention. This application keeps the current conversation in browser component memory, sends bounded recent turns with follow-ups, and offers stop and reset controls. Request and output limits, timeouts, and shared quotas are operational safeguards, not a monetary billing cap.

## Contact delivery

The form uses EmailJS. Set these public identifiers before building browser code:

```dotenv
NEXT_PUBLIC_SERVICE_ID=your-service-id
NEXT_PUBLIC_TEMPLATE_ID=your-template-id
NEXT_PUBLIC_PUBLIC_KEY=your-public-key
```

Keep the recipient fixed to `lihongebre@gmail.com` in the EmailJS template. Use the service’s verified sender and `{{reply_to}}` for Reply-To. The form supplies `user_name`, `user_email`, and `message`, plus common name/email aliases. If the provider has an origin allowlist, include the production origin and only the local origins needed for testing.

Confirm the sending service is authorized, then check an actual form message in the receiving mailbox. A successful API response means the service accepted the request; it does not prove inbox delivery. The visible **Use your email app** fallback opens a draft with the visitor’s unsent details and remains available when form delivery fails. No message is sent by opening that draft.

## Checks and local production preview

```sh
npm test
npm run lint
npm run build
CHAT_RATE_LIMIT_MODE=memory npm run start -- --hostname 127.0.0.1
```

The memory-mode exception is only for this private loopback preview. Never set it on a public deployment. Tests use mocked OpenAI and Redis transport; they do not validate real credentials, consume API credits, or confirm live Redis/email acceptance. Run the commands and inspect their results for the current revision before release.

Follow [docs/publishing.md](docs/publishing.md) for the existing Vercel deployment and production acceptance checks. Private Upwork drafts and sync notes under `docs/upwork-*drafts.*` and `docs/upwork-sync-log.md` are ignored preparation files, not public content. Keep all real credentials in local or hosting environment settings.

## Private admin

The `/admin` workspace manages the profile, projects, employment, reviews, AI controls and contact inbox. Public content publishes as one validated GitHub commit; private inbox messages and AI settings stay in server-only Redis storage. Owner authentication and production configuration are required; there is no default production password. Follow [docs/admin.md](docs/admin.md) for setup, drafts, publishing and data retention.
