// Re-mounts on every navigation, giving each page a short fade + rise
// (disabled automatically for prefers-reduced-motion, see globals.css).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
