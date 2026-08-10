import { useEffect, useState } from "react";
import { getNews, type NewsArticle } from "../api/client";
import Pagination from "../components/Pagination";

type Region = "mse" | "global";

// 1 featured story + a 2x3 grid underneath, per page.
const PAGE_SIZE = 7;

function formatDate(iso: string): string {
  const date = new Date(iso);
  const diffHours = (Date.now() - date.getTime()) / (1000 * 60 * 60);
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
  if (diffHours < 24 * 7) return `${Math.floor(diffHours / 24)}d ago`;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function FeaturedStory({ article, badgeLabel }: { article: NewsArticle; badgeLabel: string }) {
  return (
    <div className="card news-featured-card position-relative mb-4 rounded-0">
      <div className="row g-0">
        {article.image_url && (
          <div className="col-md-5 news-featured-media">
            <img src={article.image_url} alt="" />
          </div>
        )}
        <div className={article.image_url ? "col-md-7" : "col-12"}>
          <div className="p-4 d-flex flex-column h-100">
            <span className="news-badge align-self-start mb-3">{badgeLabel}</span>
            <h3 className="fw-bold mb-2" style={{ fontSize: "1.5rem", lineHeight: 1.25 }}>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body text-decoration-none stretched-link"
              >
                {article.headline}
              </a>
            </h3>
            {article.summary && <p className="text-muted mb-2">{article.summary}</p>}
            <p className="news-card-meta text-muted mt-auto mb-0">
              {article.source && <span>{article.source} · </span>}
              {formatDate(article.published_at)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewsGridCard({ article }: { article: NewsArticle }) {
  return (
    <div className="card news-grid-card h-100 position-relative rounded-0">
      {article.image_url && (
        <div className="news-grid-media">
          <img src={article.image_url} alt="" />
        </div>
      )}
      <div className="card-body d-flex flex-column p-3">
        <h3 className="news-card-title mb-2">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-body text-decoration-none stretched-link"
          >
            {article.headline}
          </a>
        </h3>
        <p className="news-card-meta text-muted mt-auto mb-0">
          {article.source && <span>{article.source} · </span>}
          {formatDate(article.published_at)}
        </p>
      </div>
    </div>
  );
}

function NewsPage() {
  const [region, setRegion] = useState<Region>("mse");
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getNews(region)
      .then((rows) => {
        setArticles(rows);
        setPage(1);
      })
      .catch(() => setError("Could not load news right now."))
      .finally(() => setLoading(false));
  }, [region]);


  const totalPages = Math.max(1, Math.ceil(articles.length / PAGE_SIZE));
  const pageArticles = articles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const featured = page === 1 ? pageArticles[0] : null;
  const gridArticles = page === 1 ? pageArticles.slice(1) : pageArticles;

  return (
    <div className="w-100 flex-grow-1 d-flex flex-column">
      <div className="bg-body-secondary py-4 w-100 flex-grow-1">
        <div className="container-fluid px-4">
          <div className="mb-4">
            <h1 className="fw-bold mb-5 mt-3 font-display text-center">Check The Latest News</h1>
            <p className="text-muted mb-0">

            </p>
          </div>

          <ul className="nav news-tabs text-center mb-2 ms-4">
            <li className="nav-item">
              <button
                className={`nav-link rounded-0 ${region === "mse" ? "active" : ""}`}
                onClick={() => setRegion("mse")}
              >
                Macedonian Stock Exchange
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link rounded-0 ${region === "global" ? "active" : ""}`}
                onClick={() => setRegion("global")}
              >
                Global Markets
              </button>
            </li>
          </ul>

          <div className="news-feed-panel rounded-0">
            {loading && (
              <div className="row g-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div className="col-md-4" key={i}>
                    <div className="card news-card-skeleton skeleton h-100 " />
                  </div>
                ))}
              </div>
            )}
            {!loading && error && <div className="alert alert-danger d-inline-block mb-0">{error}</div>}
            {!loading && !error && articles.length === 0 && (
              <p className="text-muted mb-0">No news available yet.</p>
            )}

            {!loading && !error && pageArticles.length > 0 && (
              <>
                {featured && (
                  <FeaturedStory
                    article={featured}
                    badgeLabel={region === "mse" ? "Latest" : "Top Story"}
                  />
                )}
                {gridArticles.length > 0 && (
                  <div className="row row-cols-1 row-cols-md-3 g-3">
                    {gridArticles.map((article) => (
                      <div className="col" key={article.id}>
                        <NewsGridCard article={article} />
                      </div>
                    ))}
                  </div>
                )}
                <Pagination page={page} totalPages={totalPages} onChange={setPage} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NewsPage;
