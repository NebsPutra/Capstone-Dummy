import { PageTransition } from "@/components/PageTransition";

// Re-mounts on every navigation: the page spreads out from where you tapped
// (see PageTransition; off for prefers-reduced-motion).
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
