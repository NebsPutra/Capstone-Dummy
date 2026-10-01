import { ImageResponse } from "next/og";
import { markShapes } from "@/components/Logo";

// Link preview for WhatsApp, Instagram, X, Facebook, LinkedIn, etc.
// Same brand as the launch video's end card: orange tile, cream wordmark.
export const alt = "Komunitas: find activities, meet people, build community";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #FB923C 0%, #EA580C 55%, #C2410C 100%)",
          color: "#FFF8ED",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #FB923C, #EA580C)",
              border: "3px solid rgba(255,248,237,0.5)",
              boxShadow: "0 18px 30px rgba(110,35,5,0.45)",
            }}
          >
            <svg width="100" height="100" viewBox="0 0 48 48">
              {markShapes()}
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 104, fontWeight: 800, letterSpacing: -4 }}>
            Komunitas<span style={{ color: "#FED7AA" }}>.</span>
          </div>
        </div>
        <div style={{ marginTop: 40, fontSize: 44, fontWeight: 700 }}>Find Activities. Meet People. Build Community.</div>
        <div style={{ marginTop: 14, fontSize: 30, opacity: 0.85 }}>Temukan Aktivitas. Temui Orang Baru. Bangun Komunitas.</div>
      </div>
    ),
    size
  );
}
