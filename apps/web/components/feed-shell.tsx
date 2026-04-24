"use client";

import { useEffect, useRef, useState } from "react";
import type { Article } from "../lib/api";

interface CategorySummary {
  category: string;
  count: number;
}

interface FeedShellProps {
  initialArticles: Article[];
  initialCursor: string | null;
  categories: CategorySummary[];
}

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const sseUrl = process.env.NEXT_PUBLIC_SSE_URL ?? "http://localhost:3001/news/stream";

export function FeedShell({ initialArticles, initialCursor, categories }: FeedShellProps) {
  const [articles, setArticles] = useState(initialArticles);
  const [allArticles, setAllArticles] = useState(initialArticles);
  const [cursor, setCursor] = useState(initialCursor);
  const [category, setCategory] = useState<string>();
  const [query, setQuery] = useState("");
  const [newArticlesAvailable, setNewArticlesAvailable] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  }, [darkMode]);

  useEffect(() => {
    const existingUserId = window.localStorage.getItem("demo-user-id");
    if (existingUserId) {
      return;
    }

    const email = `demo-${crypto.randomUUID()}@aperture.local`;
    void fetch(`${baseUrl}/users`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, preferences: { mode: "demo" } })
    })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }

        const user = (await response.json()) as { id: string };
        if (user.id) {
          window.localStorage.setItem("demo-user-id", user.id);
        }
      })
      .catch(() => {
        window.localStorage.setItem("demo-user-id", crypto.randomUUID());
      });
  }, []);

  useEffect(() => {
    const stream = new EventSource(sseUrl);
    stream.addEventListener("news", () => setNewArticlesAvailable(true));
    return () => stream.close();
  }, []);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && cursor && !query) {
        void loadMore();
      }
    });

    observer.observe(target);
    return () => observer.disconnect();
  }, [cursor, query]);

  async function fetchFeed(nextCategory?: string) {
    const url = new URL("/news", baseUrl);
    if (nextCategory) {
      url.searchParams.set("category", nextCategory);
    }
    const response = await fetch(url.toString(), { cache: "no-store" });
    const payload = (await response.json()) as { items: Article[]; nextCursor: string | null };
    if (!nextCategory) {
      setAllArticles(payload.items);
    }
    setArticles(payload.items);
    setCursor(payload.nextCursor);
  }

  async function refreshFeed(nextCategory = category) {
    await fetchFeed(nextCategory);
    setNewArticlesAvailable(false);
  }

  async function loadMore() {
    if (!cursor) {
      return;
    }

    const url = new URL("/news", baseUrl);
    url.searchParams.set("cursor", cursor);
    if (category) {
      url.searchParams.set("category", category);
    }
    const response = await fetch(url.toString(), { cache: "no-store" });
    const payload = (await response.json()) as { items: Article[]; nextCursor: string | null };
    setArticles((current) => [...current, ...payload.items]);
    if (!category) {
      setAllArticles((current) => [...current, ...payload.items]);
    }
    setCursor(payload.nextCursor);
  }

  async function runSearch(nextQuery: string) {
    if (!nextQuery) {
      await refreshFeed();
      return;
    }

    const url = new URL("/search", baseUrl);
    url.searchParams.set("q", nextQuery);
    const response = await fetch(url.toString(), { cache: "no-store" });
    const payload = (await response.json()) as { items: Article[] };
    setArticles(payload.items);
    setCursor(null);
  }

  function selectCategory(nextCategory?: string) {
    setCategory(nextCategory);
    if (nextCategory) {
      setArticles(allArticles.filter((article) => article.category === nextCategory));
      setCursor(null);
    } else {
      setArticles(allArticles);
    }
    void refreshFeed(nextCategory);
  }

  async function saveBookmark(articleId: string) {
    const userId = window.localStorage.getItem("demo-user-id");
    if (!userId) {
      return;
    }

    await fetch(`${baseUrl}/bookmark`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, articleId })
    });
  }

  function articleVisual(article: Article) {
    if (article.imageUrl) {
      return (
        <div className="article-visual">
          {/* We intentionally prefer source images when available to make the feed feel alive. */}
          <img src={article.imageUrl} alt={article.title} loading="lazy" />
        </div>
      );
    }

    return (
      <div className="article-visual article-visual-fallback" aria-hidden="true">
        <span>{article.category}</span>
      </div>
    );
  }

  return (
    <section className="feed-layout">
      <aside className="sidebar glass-panel">
        <button className="mode-toggle" onClick={() => setDarkMode((value) => !value)}>
          {darkMode ? "Light" : "Dark"} Mode
        </button>
        <div className="sidebar-block">
          <span className="sidebar-label">Categories</span>
          <div className="chip-grid">
            <button
              type="button"
              className={!category ? "chip active" : "chip"}
              onClick={() => selectCategory(undefined)}
            >
              All
            </button>
            {categories.map((item) => (
              <button
                type="button"
                key={item.category}
                className={category === item.category ? "chip active" : "chip"}
                onClick={() => selectCategory(item.category)}
              >
                {item.category}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="feed-column">
        <div className="toolbar glass-panel">
          <input
            className="search-input"
            placeholder="Search by story, topic, or source"
            value={query}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);
              void runSearch(nextQuery);
            }}
          />
          {newArticlesAvailable ? (
            <button className="new-indicator" onClick={() => void refreshFeed()}>
              New articles available
            </button>
          ) : (
            <span className="status-text">Live</span>
          )}
        </div>

        <div className="articles-grid">
          {articles.map((article) => (
            <article className="article-card glass-panel" key={article.id}>
              {articleVisual(article)}
              <div className="article-meta">
                <span>{article.category}</span>
                <span>{article.source}</span>
              </div>
              <h2>{article.title}</h2>
              <p>{article.summary ?? article.description}</p>
              <div className="article-footer">
                <a href={article.url} target="_blank" rel="noreferrer">
                  Read source
                </a>
                <button onClick={() => void saveBookmark(article.id)}>Bookmark</button>
              </div>
            </article>
          ))}
        </div>
        <div ref={loadMoreRef} className="load-sentinel">
          {cursor ? "Loading more when you scroll…" : "You’re caught up."}
        </div>
      </div>
    </section>
  );
}
