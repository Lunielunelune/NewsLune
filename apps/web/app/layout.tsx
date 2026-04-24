import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Aperture News",
  description: "Global real-time news intelligence, ranked and delivered with low latency."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-nav">
          <div className="site-nav-inner">
            <Link href="/" className="site-brand">
              Aperture News
            </Link>
            <nav className="site-nav-links">
              <Link href="/">Home</Link>
              <Link href="/bookmarks">My Bookmarks</Link>
              <Link href="/privacy">Privacy</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="site-footer-inner">
            <p>
              Aperture News aggregates headlines, summaries, and metadata from third-party publishers. Copyright in
              the original reporting, images, and linked source material remains with the respective publishers.
            </p>
            <nav className="site-footer-links">
              <Link href="/">Home</Link>
              <Link href="/bookmarks">My Bookmarks</Link>
              <Link href="/privacy">Privacy Policy</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
