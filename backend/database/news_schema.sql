-- One row per news article, from either the MSE news scraper (region='mse')
-- or the Finnhub general-news API (region='global'). Sharing one table keeps
-- /news simple: one query, filtered by region.
--
-- MSE articles are deduped on (region, url) since the scraper has no stable
-- numeric id to key on. Finnhub articles carry their own numeric id in
-- external_id, but url still doubles as the natural key across both regions.

CREATE TABLE IF NOT EXISTS news_articles (
    id            SERIAL PRIMARY KEY,
    region        VARCHAR(10) NOT NULL CHECK (region IN ('mse', 'global')),
    external_id   TEXT,               -- Finnhub's numeric news id; NULL for MSE
    headline      TEXT NOT NULL,
    category      TEXT,               -- MSE's category label / Finnhub's news category
    summary       TEXT,               -- Finnhub only; MSE's listing page has none
    source        TEXT,               -- e.g. 'MSE', or Finnhub's source (Reuters, etc.)
    url           TEXT NOT NULL,
    image_url     TEXT,
    published_at  TIMESTAMPTZ NOT NULL,
    scraped_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (region, url)
);

CREATE INDEX IF NOT EXISTS idx_news_articles_region_published
    ON news_articles (region, published_at DESC);
