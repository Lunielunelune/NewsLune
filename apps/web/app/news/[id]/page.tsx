import Link from "next/link";
import { notFound } from "next/navigation";
import { BookmarkButton } from "../../../components/bookmark-button";
import { getArticle, getNews } from "../../../lib/api";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function articleBody(article: Awaited<ReturnType<typeof getArticle>>) {
  const raw = article?.content ?? article?.summary ?? article?.description ?? "";
  return raw
    .split(/\n+/)
    .flatMap((block) => block.split(/(?<=[.!?])\s+(?=[A-Z0-9“"'])/))
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getArticle(id);

  if (!article) {
    notFound();
  }

  const [relatedResponse] = await Promise.all([getNews(article.category)]);
  const related = relatedResponse.items.filter((item) => item.id !== article.id).slice(0, 4);
  const paragraphs = articleBody(article);

  return (
    <main className="article-page-shell">
      <nav className="article-nav">
        <Link href="/">Back to Aperture</Link>
      </nav>

      <article className="article-page">
        <header className="article-hero glass-panel">
          <div className="article-hero-copy">
            <div className="article-kicker">
              <span>{article.category}</span>
              <span>{article.source}</span>
            </div>
            <h1>{article.title}</h1>
            <p className="article-summary">{article.summary ?? article.description}</p>
            <p className="article-attribution">
              Source attribution: {article.source}. Copyright in the original article and associated source media
              remains with the publisher.
            </p>
            <div className="article-detail-meta">
              <span>{formatDate(article.publishedAt)}</span>
              <div className="article-detail-actions">
                <BookmarkButton articleId={article.id} className="article-action-button" />
                <a className="article-source-link" href={article.url} target="_blank" rel="noreferrer">
                  Read original source
                </a>
              </div>
            </div>
          </div>

          {article.imageUrl ? (
            <div className="article-hero-visual">
              <img src={article.imageUrl} alt={article.title} />
            </div>
          ) : (
            <div className="article-hero-visual article-hero-fallback" aria-hidden="true">
              <span>{article.category}</span>
            </div>
          )}
        </header>

        <div className="article-body-layout">
          <section className="article-body glass-panel">
            {paragraphs.map((paragraph, index) => (
              <p key={`${article.id}-${index}`}>{paragraph}</p>
            ))}

            {paragraphs.length === 0 ? (
              <p>{article.description ?? "This article currently does not include a full body."}</p>
            ) : null}
          </section>

          <aside className="article-side-column">
            {article.entities?.length ? (
              <section className="article-side-panel glass-panel">
                <h2>Key entities</h2>
                <div className="article-token-grid">
                  {article.entities.map((entity) => (
                    <span key={`${entity.type}-${entity.text}`} className="article-token">
                      {entity.text}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {article.keywords?.length ? (
              <section className="article-side-panel glass-panel">
                <h2>Keywords</h2>
                <div className="article-token-grid">
                  {article.keywords.map((keyword) => (
                    <span key={keyword} className="article-token">
                      {keyword}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </article>

      {related.length > 0 ? (
        <section className="related-section">
          <div className="related-header">
            <h2>Related in {article.category}</h2>
            <Link href="/">Back to live feed</Link>
          </div>
          <div className="articles-grid">
            {related.map((item) => (
              <article className="article-card glass-panel" key={item.id}>
                {item.imageUrl ? (
                  <Link href={`/news/${item.id}`} className="article-visual">
                    <img src={item.imageUrl} alt={item.title} loading="lazy" />
                  </Link>
                ) : (
                  <Link href={`/news/${item.id}`} className="article-visual article-visual-fallback" aria-hidden="true">
                    <span>{item.category}</span>
                  </Link>
                )}
                <div className="article-meta">
                  <span>{item.category}</span>
                  <span>{item.source}</span>
                </div>
                <h2>
                  <Link href={`/news/${item.id}`}>{item.title}</Link>
                </h2>
                <p>{item.summary ?? item.description}</p>
                <p className="article-attribution">Source copyright and full article rights belong to {item.source}.</p>
                <div className="article-footer">
                  <div className="article-footer-links">
                    <Link href={`/news/${item.id}`}>Open article</Link>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      Read source
                    </a>
                  </div>
                  <BookmarkButton articleId={item.id} />
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
