import { ImageResponse } from "next/og";

export const alt = "Lihon Gebre — AI & Backend Engineer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "62px 72px", background: "#f7f7f7", color: "#171717", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #c9c9c9", paddingBottom: 24 }}>
          <span style={{ fontSize: 29, fontWeight: 700, letterSpacing: -1 }}>LIHON GEBRE</span>
          <span style={{ fontSize: 20, color: "#626262" }}>ENGINEERING PORTFOLIO</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", fontSize: 88, lineHeight: 1.06, letterSpacing: -5, fontWeight: 700 }}>AI &amp; Backend</div>
          <div style={{ display: "flex", fontSize: 88, lineHeight: 1.06, letterSpacing: -5, fontWeight: 700 }}>Engineer.</div>
          <div style={{ display: "flex", marginTop: 14, fontSize: 28, color: "#626262" }}>AI systems. APIs. Connected workflows.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 20 }}>
          <span>SELECTED WORK &amp; EXPERIENCE</span>
          <span style={{ color: "#626262" }}>Addis Ababa, Ethiopia</span>
        </div>
      </div>
    ),
    size,
  );
}
