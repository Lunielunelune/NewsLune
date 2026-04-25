import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="page-shell policy-page">
      <section className="subpage-hero">
        <div>
          <span className="eyebrow">Privacy Policy</span>
          <h1>How Index One handles reader data.</h1>
          <p>
            This policy explains what limited information Index One stores, how third-party publisher content is
            handled, and how bookmarks work in the current product operated by Studio by Lune.
          </p>
        </div>
        <Link href="/" className="subpage-link">
          Back to live feed
        </Link>
      </section>

      <section className="policy-layout">
        <article className="policy-panel glass-panel">
          <h2>Information we collect</h2>
          <p>
            Index One stores a minimal demo user record and bookmark associations so saved articles can be shown
            back to you inside the product. We also process article metadata such as titles, summaries, categories,
            publication timestamps, and source links to operate the news feed.
          </p>

          <h2>Bookmarks and local storage</h2>
          <p>
            The current experience creates a lightweight demo user identifier in your browser local storage. That
            identifier is used to associate saved stories with your session. If you clear browser storage, your demo
            bookmark identity may reset.
          </p>

          <h2>Publisher content and links</h2>
          <p>
            Index One displays aggregated metadata, excerpts, and source images when available from publisher RSS
            feeds or source page metadata. Original articles, photography, logos, and full reporting remain the
            intellectual property of their respective publishers. Readers should use the source link to access the
            original publication.
          </p>

          <h2>Infrastructure and operational logs</h2>
          <p>
            Like most web services, the platform may retain operational logs, request metadata, and error telemetry
            for reliability, abuse prevention, and debugging. This data is used to operate the service and improve
            uptime.
          </p>

          <h2>Your choices</h2>
          <p>
            You can stop using the service at any time, clear local browser storage to remove the demo user
            identifier, and avoid using bookmark features if you do not want bookmark data stored.
          </p>

          <h2>Contact and changes</h2>
          <p>
            Index One is operated by Studio by Lune. Update this policy as product functionality evolves and add your
            preferred public contact information here if you want a reader-facing support channel.
          </p>
        </article>
      </section>
    </main>
  );
}
