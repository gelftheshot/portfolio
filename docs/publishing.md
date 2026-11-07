# Publishing the portfolio

Use the existing Vercel project serving the public portfolio at `https://www.lihongebre.com`. This guide documents the release process; it does not record a completed deployment, passing checks, or live service acceptance.

## 1. Prepare the release

Use Node.js 24 and the committed lockfile:

```sh
nvm use
npm ci
npm test
npm run lint
npm run build
```

The project uses Next.js 16.4.5, React 19.3.1, and ESLint via `npm run lint`. Resolve failures before publishing. Review the current diff and include the intended public source/assets only. Credentials, `.env.local`, private Upwork preparation drafts, sync notes, and generated working directories belong outside the public commit.

If professional content or the origin changed, regenerate the saved public artifacts before the final checks:

```sh
npm run assistant:export
npm run resume:build
```

`resume:build` runs `scripts/generate-resume.mjs`. The Node generator runs automatically before production builds; Python and ReportLab are not required. Review the one-page `public/Lihon-Gebre-CV.pdf` and `public/Lihon-Gebre-CV.txt` (the previous Resume paths are aliases), including career dates, listed credentials, and links. Provide the same `NEXT_PUBLIC_SITE_URL` in the export shell when overriding the default origin.

For a private production preview only:

```sh
CHAT_RATE_LIMIT_MODE=memory npm run start -- --hostname 127.0.0.1
```

Keep that process bound to loopback. Public deployment requires shared quota protection.

## 2. Configure the existing Vercel project

Use the connected GitHub repository and the existing project rather than creating a second portfolio deployment. Confirm the intended production branch and Node.js 24 runtime. Use the Next.js framework preset, `npm ci` for installation, and `npm run build` for building. Do not configure a static export: `/api/chat` requires a server runtime.

Set the following in the correct Vercel environment scope before rebuilding:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Set to the adopted public origin, `https://www.lihongebre.com`. |
| `OPENAI_API_KEY` | Server-only key for the portfolio assistant. Leave unset if launching without paid chat. |
| `OPENAI_MODEL` | Optional Responses-compatible model override. |
| `CHAT_RATE_LIMIT_MODE` | `shared` for public production chat. |
| `UPSTASH_REDIS_REST_URL` | HTTPS Redis REST endpoint supporting atomic command execution. |
| `UPSTASH_REDIS_REST_TOKEN` | Server-only, write-capable token for that Redis endpoint. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Complete pair injected by Vercel's Upstash integration, used when neither explicit Upstash REST variable is defined. Partial or invalid explicit settings do not fall back. |
| `CHAT_TRUSTED_PROXY` | `vercel` only while traffic is served through Vercel’s managed proxy. |
| `CHAT_CLIENT_RATE_LIMIT` | Requests per client per minute; default 20. |
| `CHAT_DAILY_REQUEST_LIMIT` | Global admitted requests per UTC day; default 200. |
| `CHAT_RATE_LIMIT_NAMESPACE` | Stable production namespace shared across instances, for example `portfolio-production`. |
| `NEXT_PUBLIC_SERVICE_ID` | Public EmailJS service identifier. |
| `NEXT_PUBLIC_TEMPLATE_ID` | Public EmailJS template identifier. |
| `NEXT_PUBLIC_PUBLIC_KEY` | Public EmailJS key. |

Read [chat-operations.md](chat-operations.md) before enabling public chat. It covers quota reservations, trusted proxy boundaries, failure behavior, limits, and staging validation. Do not use `CHAT_RATE_LIMIT_MODE=memory` on a public preview or production deployment. Do not expose OpenAI or Redis credentials through browser-prefixed variables.

`NEXT_PUBLIC_SITE_URL` is the single configured origin for generated and runtime public links. Set it before the build and keep the runtime value consistent. A domain change also requires regenerated résumé/data exports. Do not use a localhost or temporary deployment URL as the production canonical origin. Preview deployments should keep the intended production canonical origin and remain protected from indexing through host settings where appropriate.

After the changes are approved, push the reviewed release to the repository/branch connected to this Vercel project, inspect the resulting deployment, and promote only the intended revision. Local checks do not establish that any of these publishing steps occurred.

## 3. Check the deployed revision

- Open the homepage on desktop and mobile. Check navigation, disclosure sections, all 11 project case-study routes, image galleries, and résumé downloads.
- Confirm the three featured projects retain the distinction between listed roles, public/documented product context, and individual contribution evidence. Keep generated concept images and explanatory diagrams labeled.
- Confirm `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`, project canonicals, structured data, and social metadata use the intended public origin. Verify the résumé PDF/text links resolve.
- Test the assistant with a short portfolio question after configuring real service credentials. Confirm response streaming, stop/reset behavior, and links. Verify Redis permissions and trusted proxy handling using the staging procedure in [chat-operations.md](chat-operations.md); mocked tests do not prove live operation.
- Confirm a real contact-form message in the receiving mailbox and verify the email-app fallback. EmailJS acceptance alone does not prove receipt.
- Check host logs for configuration or runtime errors without copying credentials or private visitor data into public issues.

If shared protection is missing or unavailable, chat should fail closed while the public portfolio remains usable. The site can launch with chat disabled until that service is configured and accepted. No current deployment, Redis acceptance, or mailbox delivery is asserted by this checklist.

## 4. Optional discovery follow-up

After confirming the public deployment, update the GitHub profile/repository website link to the adopted origin. A verified site owner can submit `/sitemap.xml` through Google Search Console and Bing Webmaster Tools and inspect representative project pages. These are separate account actions; the application does not perform them automatically.

Maintain consistent public facts across the website, résumé, GitHub, LinkedIn, and Upwork. Crawlable HTML, source links, and accurate metadata help people and automated readers inspect the work, but do not guarantee indexing, rankings, AI citations, or hiring selection. Stronger documented personal contributions and evidence remain the priority when adding content.
