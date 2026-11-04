import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import { absoluteUrl, siteUrl } from "@/lib/site";

const title = "Lihon Gebre — AI & Backend Engineer";
const description = "Lihon Gebre, AI & Backend Engineer in Addis Ababa. Explore AI agents, RAG, APIs and workflow automation, recent client feedback, case studies and a downloadable résumé. Ask his portfolio AI assistant about his work.";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: title, template: "%s | Lihon Gebre" },
  description,
  applicationName: "Lihon Gebre Portfolio",
  authors: [{ name: "Lihon Gebre", url: absoluteUrl("/") }],
  // Points AI agents at the full plain-text profile, including employment details collapsed on the page.
  alternates: { canonical: "/", types: { "text/plain": "/llms-full.txt" } },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: absoluteUrl("/"),
    siteName: "Lihon Gebre",
    title,
    description,
    images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: title }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [absoluteUrl("/opengraph-image")],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  icons: { icon: "/icon.svg" },
};
export default function RootLayout({ children }) {
  return <html lang="en"><body><a className="skip-link" href="#main-content">Skip to content</a><SiteHeader />{children}</body></html>;
}
