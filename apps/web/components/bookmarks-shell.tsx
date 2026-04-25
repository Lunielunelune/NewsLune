"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Article } from "../lib/api";
import { ensureDemoUser } from "../lib/demo-user";
import { ArticleImage } from "./article-image";
import { BookmarkButton } from "./bookmark-button";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export function BookmarksShell() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const userId = await ensureDemoUser();
      const response = await fetch(`${baseUrl}/users/${userId}/bookmarks`, { cache: "no-store" });
      const payload = (await response.json()) as { items: Article[] };
      setArticles(payload.items);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="bookmarks-empty glass-panel">Loading your saved stories…</div>;
  }

  if (articles.length === 0) {
    return (
      <div className="bookmarks-empty glass-panel">
        <h2>No bookmarks yet</h2>
        <p>Save stories from the homepage or article pages and they’ll show up here.</p>
        <Link href="/">Go to live feed</Link>
      </div>
    );
  }

  return (
    <div className="articles-grid">
      {articles.map((article) => (
        <article className="article-card glass-panel" key={article.id}>
          <ArticleImage
            href={`/news/${article.id}`}
            src={article.imageUrl}
            alt={article.title}
            label={article.category}
          />
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
  );
}
