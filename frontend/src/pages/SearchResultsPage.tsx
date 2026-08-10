import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getCompanies, getNews, type Company, type NewsArticle } from "../api/client";
import Skeleton from "../components/Skeleton";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function SearchResultsPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const [companies, setCompanies] = useState<Company[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([getCompanies(), getNews("mse"), getNews("global")])
      .then(([companyRows, mseNews, globalNews]) => {
        setCompanies(companyRows);
        setNews([...mseNews, ...globalNews]);
      })
      .catch(() => setError("Could not load search results right now."))
      .finally(() => setLoading(false));
  }, []);

  const trimmed = query.trim().toLowerCase();
  const matchedCompanies = trimmed
    ? companies.filter((c) => c.name.toLowerCase().includes(trimmed))
    : [];
  const matchedNews = trimmed
    ? news.filter((a) => a.headline.toLowerCase().includes(trimmed))
    : [];
  const hasResults = matchedCompanies.length > 0 || matchedNews.length > 0;

  return (
    <div className="w-100 flex-grow-1 d-flex flex-column">
      <div className="bg-body-secondary py-4 w-100 flex-grow-1">
        <div className="container-fluid px-4">
          <h2 className="mb-1">Search results</h2>
          <p className="text-muted mb-4">
            {query ? `Showing results for "${query}"` : "Enter a search term."}
          </p>

          {loading && (
            <>
              <div className="mb-4">
                <h5 className="mb-3">Companies</h5>
                <div className="list-group" style={{ maxWidth: "480px" }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="list-group-item">
                      <Skeleton style={{ width: `${60 - i * 10}%`, height: "0.9rem" }} />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h5 className="mb-3">News</h5>
                <div className="row g-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div className="col-lg-3 col-md-4 col-sm-6" key={i}>
                      <div className="card news-card-skeleton skeleton h-100" />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          {!loading && error && <p className="text-danger">{error}</p>}
          {!loading && !error && !hasResults && query && (
            <p className="text-muted">No results for "{query}".</p>
          )}

          {!loading && !error && matchedCompanies.length > 0 && (
            <div className="mb-4">
              <h5 className="mb-3">Companies</h5>
              <div className="list-group" style={{ maxWidth: "480px" }}>
                {matchedCompanies.map((c) => (
                  <Link
                    key={c.id}
                    to={`/company/${c.id}`}
                    className="list-group-item list-group-item-action"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {!loading && !error && matchedNews.length > 0 && (
            <div>
              <h5 className="mb-3">News</h5>
              <div className="row g-3">
                {matchedNews.map((article) => (
                  <div className="col-lg-3 col-md-4 col-sm-6" key={article.id}>
                    <div className="card news-card h-100 position-relative">
                      {article.image_url && (
                        <img src={article.image_url} className="card-img-top news-card-img" alt="" />
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
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchResultsPage;
