import { projects } from "@/lib/projects";
import { absoluteUrl, contentUpdated, homeUrl } from "@/lib/site";

// Each URL reports its own last edit: a project's updatedAt, else the profile's updatedAt.
// An entry with no known date omits <lastmod> rather than inventing one.
function entry(path, lastModified, changeFrequency, priority) {
  return { url: path === "/" ? homeUrl : absoluteUrl(path), ...(lastModified ? { lastModified } : {}), changeFrequency, priority };
}

export default function sitemap() {
  return [
    entry("/", contentUpdated, "monthly", 1),
    ...projects.map((project) => entry(`/projects/${project.slug}`, project.updatedAt || contentUpdated, "yearly", 0.7)),
  ];
}
