import { ImageResponse } from "next/og";
import { profile } from "@/lib/profile";
import { siteHost } from "@/lib/site";

export const alt = `${profile.name}, ${profile.title}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "62px 72px", background: "#f7f7f7", color: "#171717", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #c9c9c9", paddingBottom: 24 }}>
          <span style={{ fontSize: 29, fontWeight: 700, letterSpacing: -1 }}>{profile.name.toUpperCase()}</span>
          <span style={{ fontSize: 20, color: "#626262" }}>ENGINEERING PORTFOLIO</span>
        </div>
        <div style={{ display: "flex", maxWidth: 900, fontSize: 96, lineHeight: 1.06, letterSpacing: -5, fontWeight: 700 }}>{profile.title}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 20 }}>
          <span>{siteHost}</span>
          <span style={{ color: "#626262" }}>{profile.location}</span>
        </div>
      </div>
    ),
    size,
  );
}
