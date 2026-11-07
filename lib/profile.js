import profileData from "../data/profile.json" with { type: "json" };
import { absoluteUrl } from "./site.js";

// Shared by the visible portfolio and its assistant to keep professional facts aligned.
export const profile = {
  ...profileData,
  links: {
    ...profileData.links,
    website: absoluteUrl("/"),
    contact: absoluteUrl("/#contact"),
    resume: absoluteUrl("/Lihon-Gebre-CV.pdf"),
    resumeText: absoluteUrl("/Lihon-Gebre-CV.txt"),
  },
};
export const experience = profile.experience;
export const expertise = profile.expertise;
