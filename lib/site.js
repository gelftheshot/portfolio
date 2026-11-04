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
export const contentUpdated = "2026-11-04";
export const absoluteUrl = (path = "/") => new URL(path, `${siteUrl}/`).toString();
export const personId = absoluteUrl("/#person");
