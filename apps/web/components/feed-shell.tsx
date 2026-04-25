"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import type { Article } from "../lib/api";
import { ArticleImage } from "./article-image";
import { BookmarkButton } from "./bookmark-button";

interface CategorySummary {
  category: string;
  count: number;
}

interface FeedShellProps {
  initialArticles: Article[];
  initialCursor: string | null;
  categories: CategorySummary[];
  initialCategory?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
const sseUrl = process.env.NEXT_PUBLIC_SSE_URL ?? "http://localhost:3001/news/stream";
const cardDensityStorageKey = "index-one-card-columns";

export function FeedShell({ initialArticles, initialCursor, categories, initialCategory }: FeedShellProps) {
  const [articles, setArticles] = useState(initialArticles);
  const [cursor, setCursor] = useState(initialCursor);
  const [category, setCategory] = useState<string | undefined>(initialCategory);
  const [query, setQuery] = useState("");
  const [newArticlesAvailable, setNewArticlesAvailable] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [cardColumns, setCardColumns] = useState<2 | 3 | 4>(3);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
  }, [darkMode]);

  useEffect(() => {
    setArticles(initialArticles);
    setCursor(initialCursor);
    setCategory(initialCategory);
  }, [initialArticles, initialCursor, initialCategory]);

  useEffect(() => {
    const stream = new EventSource(sseUrl);
    stream.addEventListener("news", () => setNewArticlesAvailable(true));
    return () => stream.close();
  }, []);

  useEffect(() => {
    const savedValue = window.localStorage.getItem(cardDensityStorageKey);
    if (savedValue === "2" || savedValue === "3" || savedValue === "4") {
      setCardColumns(Number(savedValue) as 2 | 3 | 4);
    }
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

  function articleVisual(article: Article) {
    return (
      <ArticleImage
        href={`/news/${article.id}`}
        src={article.imageUrl}
        alt={article.title}
        label={article.category}
      />
    );
  }

  function updateCardColumns(nextValue: 2 | 3 | 4) {
    setCardColumns(nextValue);
    window.localStorage.setItem(cardDensityStorageKey, String(nextValue));
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
            <Link href="/" className={!category ? "chip active" : "chip"}>
              All
            </Link>
            {categories.map((item) => (
              <Link
                key={item.category}
                className={category === item.category ? "chip active" : "chip"}
                href={`/?category=${encodeURIComponent(item.category)}`}
              >
                {item.category}
              </Link>
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
          <div className="toolbar-actions">
            <div className="density-control" aria-label="Card size">
              {[2, 3, 4].map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cardColumns === value ? "density-chip active" : "density-chip"}
                  onClick={() => updateCardColumns(value as 2 | 3 | 4)}
                >
                  {value}
                </button>
              ))}
            </div>
            {newArticlesAvailable ? (
              <button className="new-indicator" onClick={() => void refreshFeed()}>
                New articles available
              </button>
            ) : (
              <span className="status-text">Live</span>
            )}
          </div>
        </div>

        <div className="articles-grid" style={{ "--card-columns": cardColumns } as CSSProperties}>
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
              <p className="article-attribution">Source copyright and full article rights belong to {article.source}.</p>
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
