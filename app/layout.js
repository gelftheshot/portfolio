import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import { homeUrl, siteUrl } from "@/lib/site";
import { profile } from "@/lib/profile";

const title = profile.name + " — " + profile.title;
const description = profile.introduction || profile.summary;

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: "%s | " + profile.name },
  description,
  applicationName: "Lihon Gebre Portfolio",
  authors: [{ name: profile.name, url: homeUrl }],
  // Points AI agents at the full Markdown profile, including employment details collapsed on the page.
  alternates: { canonical: "/", types: { "text/markdown": "/llms-full.txt" } },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: homeUrl,
    siteName: "Lihon Gebre",
    title,
    description,
    // No images here: app/opengraph-image.jsx supplies og:image with its width, height, type and alt,
    // and twitter:image falls back to the same file.
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  icons: { icon: "/icon.svg" },
};
export default function RootLayout({ children }) {
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a><SiteHeader />{children}</body></html>;
}
