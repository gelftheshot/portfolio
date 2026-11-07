import { absoluteUrl } from "@/lib/site";

// A crawler that matches a named group ignores the "*" group, so every group repeats the disallows.
const disallow = ["/api/", "/admin"];

// Search and user-initiated fetchers for AI answers.
const publicReaders = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
];

// Crawlers that are allowed today through "*"; listed so the allow is explicit.
const namedCrawlers = ["GPTBot", "ClaudeBot", "Google-Extended", "Bingbot", "Applebot", "CCBot"];

export default function robots() {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      ...[...publicReaders, ...namedCrawlers].map((userAgent) => ({ userAgent, allow: "/", disallow })),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
