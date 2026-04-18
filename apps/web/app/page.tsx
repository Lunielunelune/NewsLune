import { FeedShell } from "../components/feed-shell";
import { getCategories, getNews } from "../lib/api";

export default async function HomePage() {
  const [news, categories] = await Promise.all([getNews(), getCategories()]);

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Near Real-Time Global Coverage</span>
          <h1>A quieter interface for a very loud world.</h1>
          <p>
            Aperture streams, deduplicates, enriches, and ranks breaking stories across the globe so readers
            can move from signal to understanding in seconds.
          </p>
        </div>
        <div className="hero-orb" aria-hidden="true" />
      </section>

      <FeedShell initialArticles={news.items} initialCursor={news.nextCursor} categories={categories.items} />
    </main>
  );
}

