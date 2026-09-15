import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site">
      <SiteHeader />
      <main className="site-main app-shell">
        <div className="app-frame">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
