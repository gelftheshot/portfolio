import profileData from "../data/profile.json" with { type: "json" };

const defaultSiteUrl = profileData.links.website;

function resolveSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || defaultSiteUrl;

  try {
    const url = new URL(configuredUrl);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw new Error("Unsupported site URL");
    }
    return url.origin;
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a valid HTTP or HTTPS site URL without credentials.");
  }
}

export const siteUrl = resolveSiteUrl();
export const siteHost = new URL(siteUrl).host;

// Date of the last human edit to the profile record; no fallback, so a missing value stays visible.
export const contentUpdated = profileData.updatedAt;

// Author date of 5a49c03, the commit that first added the homepage (app/page.js; later renamed to page.jsx). Used as ProfilePage.dateCreated.
export const siteCreated = "2024-08-06";

// Next.js writes the home canonical and og:url as the bare origin with no trailing slash.
// Use homeUrl wherever the home page URL is published (sitemap, JSON-LD) so every copy matches.
export const homeUrl = siteUrl;
export const absoluteUrl = (path = "/") => new URL(path, `${siteUrl}/`).toString();
export const personId = absoluteUrl("/#person");
