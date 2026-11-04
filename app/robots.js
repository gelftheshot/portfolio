import { absoluteUrl } from "@/lib/site";

export default function robots() {
  const publicReaders = [
    "OAI-SearchBot",
    "ChatGPT-User",
    "Claude-SearchBot",
    "Claude-User",
    "PerplexityBot",
    "Perplexity-User",
  ];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: "/api/" },
      ...publicReaders.map((userAgent) => ({ userAgent, allow: "/", disallow: "/api/" })),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
