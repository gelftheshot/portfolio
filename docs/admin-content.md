# Content publishing from the private admin

The admin edits the public profile, employment history, portfolio projects and client feedback. Publication writes these fixed repository files in one Git commit:

- `data/profile.json`
- `data/projects.json`
- `data/upwork.json`

The existing GitHub → Vercel integration deploys the resulting commit. The public website, project pages, discovery text and assistant continue to import the same records. A successful publish confirms a Git commit, not a successful Vercel deployment. Check the deployment before assuming changes are live.

## Server configuration

Set up owner authentication first using [admin-auth.md](admin-auth.md). Without authenticated server access, the content endpoints refuse requests. Before the admin credentials are configured at all, `/api/admin/content` answers 404 like a missing route. A browser-visible login page alone does not grant content access.

| Server variable | Meaning |
| --- | --- |
| `ADMIN_GITHUB_TOKEN` | Fine-grained GitHub token or compatible GitHub App token with repository contents read/write access. Restrict it to this portfolio repository. |
| `ADMIN_GITHUB_REPOSITORY` | Defaults to `gelftheshot/portfolio`; format `owner/repository`. |
| `ADMIN_GITHUB_BRANCH` | Defaults to `main`; use the branch connected to the intended Vercel production project. |

Keep credentials in ignored local environment files for development and in Vercel's server environment for deployment. None of these settings should use a `NEXT_PUBLIC_` prefix. The API never returns the token or changes environment variables, workflow files or executable source.

Without a GitHub publishing token, an authenticated owner can load the current build's public content. The response marks publishing unavailable and returns a null revision. Publishing refuses the request; it never pretends to save changes to browser storage or the deployment's temporary filesystem.

Token creation or installation is an account setup step. This implementation does not create a GitHub credential, expand an existing app's permissions, or silently reuse the developer machine's Git credentials. After adding or rotating a production credential, redeploy so the function uses the intended environment.

## API contract

`GET /api/admin/content` requires an owner session and returns:

```json
{
  "content": { "profile": {}, "projects": [], "upwork": {} },
  "revision": "loaded-git-commit-sha-or-null",
  "repository": "gelftheshot/portfolio",
  "branch": "main",
  "publishingConfigured": true
}
```

The full response contains the existing public records, not the abbreviated example above. Repository reads use one immutable commit SHA for all three files. The server validates the stored data before returning it.

`PUT /api/admin/content` requires an owner session, an Origin matching the validated request Host and the request URL's HTTP/HTTPS scheme, and an `application/json` body. If Host is absent, the request URL supplies the authority. Forwarded host and protocol headers do not expand the accepted origin; see [authentication](admin-auth.md) for proxy requirements.

The request shape is:

```json
{
  "content": { "profile": {}, "projects": [], "upwork": {} },
  "revision": "the-sha-returned-by-GET",
  "uploads": [{ "dataBase64": "base64-image-bytes" }]
}
```

The editor sends the complete content bundle so advanced case-study sections and source notes survive ordinary form edits. Unknown fields are rejected. Profile `updatedAt` is stamped with the UTC publication date. Completed-job and written-feedback counts follow the supplied work records; source retrieval dates and profile snapshot dates stay separate. Review excerpts must be exact substrings of the full source feedback.

Before any repository write, publication also runs the actual résumé generator against the proposed profile, projects and client-work records. If text cannot render with the current résumé font, publication returns `400 invalid_resume` and asks for Latin transliteration or a supported font. It does not silently remove names or publish content that is known to break the deployment's résumé build.

The backend rechecks the target branch before writing. A stale revision returns `409 content_conflict`. It creates one tree and one commit, then advances the branch with `force: false`; a concurrent update also returns a conflict rather than overwriting it. Reload the latest content and reconcile changes before retrying. Failed operations can leave unreferenced Git objects, but those objects do not publish content without a successful branch update.

Successful publication returns:

```json
{
  "revision": "new-git-commit-sha",
  "commitUrl": "https://github.com/owner/repository/commit/sha",
  "message": "Changes committed; Vercel deployment pending."
}
```

The API uses bounded, cancellable HTTPS requests to GitHub with no automatic retries or redirects. Provider response bodies, credentials and raw exception messages are neither logged nor returned. If the browser loses confirmation during publication, reload the repository before retrying; the commit may already have succeeded. Responses are `Cache-Control: no-store`.

## Images and content limits

Each request may contain up to three static PNG, JPEG or WebP images, with a combined raw size of 2 MiB. The overall JSON request is limited to 3,800,000 bytes and the public content bundle to 256 KiB. There may be up to 50 projects, 30 employment records and 100 completed client records.

The client predicts an uploaded image's public path from the first 24 hexadecimal characters of the SHA-256 of its raw bytes:

```text
/projects/uploads/HASH.webp
```

The server derives the path independently. It checks the actual format, rejects animated or undecodable images and inputs exceeding 20 megapixels, applies orientation, resizes inside 1600 × 1600 without enlargement, and re-encodes WebP without retaining metadata. Each uploaded path must be selected in a project's `images` array. Uploads cannot supply a filename, arbitrary path or SVG payload. The processed image and JSON changes enter the same commit. Existing trusted local SVG diagrams remain usable as references, but are not uploadable through this endpoint.

Local image references exclude traversal, query strings and fragments. External links require complete HTTP/HTTPS URLs without credentials. Unique IDs/slugs, array bounds, dates and required nested fields are validated. Removing a project also requires removing references to it in `profile.automationFocus.projectEvidence`.

## Operational scope

This endpoint publishes public portfolio material. It is not an inbox, secret manager, billing interface or a place for private visitor conversations. Never put visitor messages, credentials or private contracts into this public repository.

Content edits do not manufacture review evidence or personal achievements. Preserve source wording, dates and attribution. Check résumé generation separately when profile data changes so downloadable documents remain aligned with the published profile.

Offline tests cover fixed-path reads, validation, conflicts, atomic commit construction, image re-encoding, size limits, authorization ordering, provider failures and cancellation. They do not create GitHub commits or establish a successful live deployment. A real configured publishing check should use an intended reviewable change, followed by inspecting its Git commit and Vercel result.

Primary references: [GitHub repository contents API](https://docs.github.com/en/rest/repos/contents), [Git trees](https://docs.github.com/en/rest/git/trees), [Git commits](https://docs.github.com/en/rest/git/commits), [Git references](https://docs.github.com/en/rest/git/refs), and [Vercel runtime filesystem limits](https://vercel.com/docs/functions/runtimes#file-system-support).
