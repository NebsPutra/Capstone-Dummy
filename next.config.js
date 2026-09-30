/** @type {import('next').NextConfig} */

// One Content-Security-Policy, kept next to the origins it allows so it's
// obvious why each source is here. Only these external hosts are contacted:
//   *.supabase.co        - REST + Auth + Storage (https) and realtime (wss)
//   *.tile.openstreetmap.org - Leaflet map tiles (images)
//   nominatim.openstreetmap.org, www.emsifa.com - geocoding / Indonesian region lookup
// Fonts are self-hosted by next/font, and Leaflet markers are bundled, so both are 'self'.
// ponytail: script-src keeps 'unsafe-inline' because Next's App Router emits inline
// bootstrap scripts and the theme-flash guard is inline; tighten to a nonce
// (middleware-generated) if the threat model ever needs it.
// Dev only: Next's HMR needs a localhost websocket and React's dev build uses
// eval() for debugging. Production stays strict (no 'unsafe-eval', no ws).
const dev = process.env.NODE_ENV !== "production";
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://nominatim.openstreetmap.org https://www.emsifa.com${dev ? " ws://localhost:* http://localhost:*" : ""}`,
  "worker-src 'self' blob:",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolocation is used for "activities near me"; everything else is denied.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

module.exports = nextConfig;
