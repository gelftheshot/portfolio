import Link from "next/link";

// Next.js adds <meta name="robots" content="noindex"> to every 404 response. Clearing the root layout's
// robots, canonical, Open Graph and Twitter values keeps that tag as the only robots signal and stops
// a missing URL from pointing its canonical at the home page.
export const metadata = {
  title: "Page not found",
  description: "This address does not match any page on Lihon Gebre's portfolio.",
  robots: null,
  alternates: null,
  openGraph: null,
  twitter: null,
};

export default function NotFound() {
  return (
    <main id="main-content" className="section-shell section-space" aria-labelledby="not-found-title">
      <p className="eyebrow" style={{ color: "var(--muted)", marginBottom: 22 }}>404</p>
      <h1 id="not-found-title">Page not found</h1>
      <p style={{ marginTop: 24, maxWidth: 560, color: "var(--muted)", fontSize: 18 }}>
        There is no page at this address. The link may be old or mistyped.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 36 }}>
        <Link className="button button-dark" href="/">Go to the home page</Link>
        <Link className="button button-light" href="/#work">View selected work</Link>
      </div>
    </main>
  );
}
