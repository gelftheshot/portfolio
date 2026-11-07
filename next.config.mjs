// Points agents that read HTTP headers to the Markdown version of the whole profile.
const markdownAlternate = { key: 'Link', value: '</llms-full.txt>; rel="alternate"; type="text/markdown"' };

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'" },
        ],
      },
      // Only the homepage: its head declares the same Markdown alternate.
      { source: '/', headers: [markdownAlternate] },
    ];
  },
};

export default nextConfig;
