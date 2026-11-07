# Launch verification — November 4, 2026

Verified locally on the `codex/portfolio-launch` branch:

- `npm test`: 142 passed, no failures or skipped tests.
- `npm run lint`: passed.
- `npm run build`: passed on Next.js 16.4.5 / React 19.3.1.
- `npm audit --omit=dev`: zero reported runtime dependency vulnerabilities. Remaining development-tool advisories are documented in [dependencies.md](dependencies.md).
- All 11 case-study URLs returned HTTP 200; an unknown project returned 404. The homepage's initial HTML contained all 11 project cards and all six employment records, including content inside closed disclosures.
- Homepage JSON-LD parsed successfully. Canonicals matched the configured origin. Robots, sitemap, both public text endpoints, social image, résumé PDF/text and the three explanatory diagrams returned HTTP 200.
- The configured origin override remained aligned across the profile, assistant case-study links and résumé links.
- Chrome checks covered desktop, 390px phone layouts for all case studies, a 320px homepage, the mobile menu, project dialog, disclosures and review scrolling/pause. A case-study grid sizing issue was corrected so diagrams scroll within their own container.
- The résumé PDF was rendered and visually inspected after regeneration. The CV has since been cut to one page; see [resume.md](resume.md).
- One real OpenAI question completed through the local browser interface. A contact-form test was accepted by EmailJS and its matching message was verified in the configured Gmail inbox.
- The Git release excludes real environment files, the legacy Python virtual environment, Python bytecode, Finder metadata and private Upwork preparation notes. Local copies are retained. A redacted staged-source check found only intentional dummy credential fixtures.

The preview is bound to `127.0.0.1` with explicit memory-mode chat limits. These results do not establish public deployment or live shared-Redis acceptance. Production requires the server settings and acceptance steps in [publishing.md](publishing.md) and [chat-operations.md](chat-operations.md). No new external database was provisioned during this verification.
