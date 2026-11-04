import { projects } from "@/lib/projects";
import { absoluteUrl, contentUpdated } from "@/lib/site";

export default function sitemap() {
  return ["/", ...projects.map((project) => `/projects/${project.slug}`)].map((path) => ({
    url: absoluteUrl(path),
    lastModified: contentUpdated,
  }));
}
