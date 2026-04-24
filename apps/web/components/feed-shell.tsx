"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Article } from "../lib/api";
import { BookmarkButton } from "./bookmark-button";

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
  const [loadingFeed, setLoadingFeed] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  }, [darkMode]);

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
    setLoadingFeed(true);
    const url = new URL("/news", baseUrl);
    if (nextCategory) {
      url.searchParams.set("category", nextCategory);
    }
    try {
      const response = await fetch(url.toString(), { cache: "no-store" });
      const payload = (await response.json()) as { items: Article[]; nextCursor: string | null };
      if (!nextCategory) {
        setAllArticles(payload.items);
      }
      setArticles(payload.items);
      setCursor(payload.nextCursor);
    } finally {
      setLoadingFeed(false);
    }
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

    setLoadingFeed(true);
    const url = new URL("/search", baseUrl);
    url.searchParams.set("q", nextQuery);
    try {
      const response = await fetch(url.toString(), { cache: "no-store" });
      const payload = (await response.json()) as { items: Article[] };
      setArticles(payload.items);
      setCursor(null);
    } finally {
      setLoadingFeed(false);
    }
  }

  async function selectCategory(nextCategory?: string) {
    setCategory(nextCategory);
    if (!nextCategory) {
      setArticles(allArticles);
    }
    await refreshFeed(nextCategory);
  }

  function articleVisual(article: Article) {
    if (article.imageUrl) {
      return (
        <Link href={`/news/${article.id}`} className="article-visual">
          {/* We intentionally prefer source images when available to make the feed feel alive. */}
          <img src={article.imageUrl} alt={article.title} loading="lazy" />
        </Link>
      );
    }

    return (
      <Link href={`/news/${article.id}`} className="article-visual article-visual-fallback" aria-hidden="true">
        <span>{article.category}</span>
      </Link>
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
              onClick={() => void selectCategory(undefined)}
            >
              All
            </button>
            {categories.map((item) => (
              <button
                type="button"
                key={item.category}
                className={category === item.category ? "chip active" : "chip"}
                onClick={() => void selectCategory(item.category)}
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
              <h2>
                <Link href={`/news/${article.id}`}>{article.title}</Link>
              </h2>
              <p>{article.summary ?? article.description}</p>
              <div className="article-footer">
                <div className="article-footer-links">
                  <Link href={`/news/${article.id}`}>Open article</Link>
                  <a href={article.url} target="_blank" rel="noreferrer">
                    Read source
                  </a>
                </div>
                <BookmarkButton articleId={article.id} />
              </div>
            </article>
          ))}
        </div>
        <div ref={loadMoreRef} className="load-sentinel">
          {loadingFeed ? "Refreshing stories…" : cursor ? "Loading more when you scroll…" : "You’re caught up."}
        </div>
      </div>
    </section>
  );
}
