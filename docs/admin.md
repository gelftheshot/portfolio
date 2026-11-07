# Portfolio admin

Open /admin for profile, projects, employment, reviews, assistant settings and the private contact inbox. Admin routes require an owner session; public content and private operational data use separate stores.

## First setup

1. Run **npm run admin:setup** in an interactive terminal. Choose a unique password of at least 12 characters. The command prints a salted password hash and a random session secret for Vercel. Keep them private. **npm run admin:setup -- --write-local** instead saves the two settings to the ignored .env.local, preserving existing settings and escaping dollar signs correctly for Next.js. This creates or replaces admin credentials; it does not change OpenAI or EmailJS values.
2. Configure ADMIN_PASSWORD_HASH and ADMIN_SESSION_SECRET in the intended Vercel project's server environment. Use the raw values printed for Vercel, not the escaped dotenv representation.
3. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to a durable, private Redis REST database, or connect the Vercel Upstash integration and use its injected KV_REST_API_URL and KV_REST_API_TOKEN pair. Any defined explicit Upstash variable takes precedence; a partial or invalid pair does not fall back. Production sign-in requires shared throttling. Assistant settings and visitor messages also use this database; restrict token access to trusted server operators.
4. To publish content, set ADMIN_GITHUB_TOKEN to a fine-grained token restricted to this repository with **Contents: read and write**. The default target is gelftheshot/portfolio, branch main. An alternative requires server-side ADMIN_GITHUB_REPOSITORY and ADMIN_GITHUB_BRANCH; browsers cannot select arbitrary repositories or files. Account credential creation and permissions are separate operator steps.
5. Redeploy, then sign in at /admin. Verify the configured project and branch before publishing an intended small change.

No real credential is provided by the code. There is no default production password, localhost authentication bypass, or public admin registration. A missing configuration keeps access locked: /admin and every /api/admin/* route answer 404 until the password hash, the session secret and, in production, the shared Redis credentials are all valid. A 404 at /admin after a deploy therefore means the setup is incomplete. For local development, use your local credentials and npm run dev; private inbox/settings are memory-only without Redis and reset on restart.

## Content editing and publication

The editor loads the latest immutable Git revision. Valid public content drafts are saved in the current browser; they contain no inbox messages, assistant settings, session cookies or passwords. Download a content draft before clearing browser data or resolving a conflict. Invalid structured JSON must be fixed before publishing. The first three projects are featured, and ordering controls set that priority.

Publishing validates all three public JSON datasets and new image files, writes one versioned commit, and lets the existing GitHub → Vercel integration deploy it. Stale revisions are rejected instead of overwriting newer work. A successful commit is followed by a build; it is not an immediate live update. When a published change alters a public fact, copy it to LinkedIn, Upwork and GitHub the same day and log it in [surface-sync.md](surface-sync.md).

The build runs assistant:export and the Node-based resume:build automatically before Next.js. Public pages, AI knowledge, crawler text and résumé downloads therefore derive from the same source revision. Current résumé content fits on one page; longer histories paginate. The previous Python generator remains a legacy development tool and is not used by production builds.

Project uploads accept PNG, JPEG and WebP, up to three new files and 2 MiB raw data per publish. The server validates and resizes them, strips metadata, and stores WebP under derived public paths. Existing case-study details and source notes are preserved. Editing a project sets its updatedAt to the current UTC date, which the sitemap and the case-study JSON-LD use; the Source note field is shown as one muted line under the project buttons. Keep public facts, review quotations and source dates accurate.

## Private operations

The AI controls change the enabled state, model ID and bounded tone/emphasis guidance. Credentials remain in Vercel. Disabling the assistant stops generation before a provider client is constructed. These settings are private Redis records and do not create Git commits.

The contact form retains its EmailJS delivery and also attempts a private inbox receipt. The UI distinguishes sent email from an inbox-only receipt. Inbox messages expire after 30 days and are capped at 200; email copies have separate mailbox retention. Reading or archiving a message preserves its expiration. Reply opens a draft in the owner's email app. Messages never become assistant knowledge or public repository files.

Sessions are signed, expire after two hours, and use secure HttpOnly cookies on production HTTPS. Changing either admin credential invalidates existing sessions. Signing out clears this browser's cookie; a previously copied stateless token may remain valid until expiry or credential rotation. Every private API read authorizes the owner, and mutations require the actual same site origin. Server credentials are never returned to the dashboard.

Detailed contracts and offline checks: [authentication](admin-auth.md), [content publishing](admin-content.md), [private operations](admin-operations.md). Mocked tests verify behavior without creating real GitHub commits, writing a production Redis database or sending test email.
