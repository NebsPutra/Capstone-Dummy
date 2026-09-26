import { ImageResponse } from "next/og";

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
          <path d="M24 39s-11-9.6-11-18.2a11 11 0 0 1 22 0C35 29.4 24 39 24 39z" fill="#FFF8ED" />
          <circle cx="18.6" cy="21.6" r="2.6" fill="#F97316" />
          <circle cx="24" cy="17.6" r="2.8" fill="#EA580C" />
          <circle cx="29.4" cy="21.6" r="2.6" fill="#C2410C" />
          <path d="M17.2 27.4c1.9-2 4.2-3 6.8-3s4.9 1 6.8 3" stroke="#EA580C" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        </svg>
      </div>
    ),
    size
  );
}
