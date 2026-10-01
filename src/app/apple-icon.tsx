import { ImageResponse } from "next/og";
import { markShapes } from "@/components/Logo";

// PNG app icon (iOS home screen / PWA) rendered from the same mark as icon.svg.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "linear-gradient(135deg, #FB923C, #EA580C)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="150" height="150" viewBox="0 0 48 48">
          {markShapes()}
        </svg>
      </div>
    ),
    size
  );
}
