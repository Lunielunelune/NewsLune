import Link from "next/link";
import { BookmarksShell } from "../../components/bookmarks-shell";

export default function BookmarksPage() {
  return (
    <main className="page-shell">
      <section className="subpage-hero">
        <div>
          <span className="eyebrow">Saved Stories</span>
          <h1>My bookmarks, in one calm place.</h1>
          <p>
            Revisit the articles you saved without digging back through the homepage feed.
          </p>
        </div>
        <Link href="/" className="subpage-link">
          Back to live feed
        </Link>
      </section>

      <BookmarksShell />
    </main>
  );
}
