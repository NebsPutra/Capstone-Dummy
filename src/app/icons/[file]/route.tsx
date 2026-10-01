import { ImageResponse } from "next/og";
import { markShapes } from "@/components/Logo";

// PWA install icons: /icons/icon-192.png and /icons/icon-512.png (Android needs both).
// Full-bleed tile with the mark inside the maskable safe zone, so one image serves "any" and "maskable".
const SIZES = [192, 512];

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const size = Number(file.match(/^icon-(\d+)\.png$/)?.[1]);
  if (!SIZES.includes(size)) return new Response("Not found", { status: 404 });
  const mark = Math.round(size * 0.8);
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
        <svg width={mark} height={mark} viewBox="0 0 48 48">
          {markShapes()}
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}
