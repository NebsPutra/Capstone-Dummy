/** Short, human-readable device label from a user-agent ("Chrome · Windows"). */
export function deviceLabel(ua: string | null | undefined): string {
  const s = ua ?? "";
  const browser = /Edg\//.test(s) ? "Edge"
    : /OPR\/|Opera/.test(s) ? "Opera"
    : /SamsungBrowser/.test(s) ? "Samsung Internet"
    : /Firefox\//.test(s) ? "Firefox"
    : /Chrome\//.test(s) ? "Chrome"
    : /Safari\//.test(s) ? "Safari"
    : "";
  const os = /Android/.test(s) ? "Android"
    : /iPhone|iPad|iPod/.test(s) ? "iOS"
    : /Windows/.test(s) ? "Windows"
    : /Mac OS X/.test(s) ? "macOS"
    : /Linux/.test(s) ? "Linux"
    : "";
  return [browser, os].filter(Boolean).join(" · ") || "Unknown device";
}
