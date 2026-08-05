"""
news_loader.py
---------------
Takes news scraped by news_scraper.py (MSE) and global_news.py (Finnhub) and
upserts it into news_articles -- the table the API's /news endpoint reads from.

    python -m backend.scraper.news_loader                  # both regions
    python -m backend.scraper.news_loader --region mse
    python -m backend.scraper.news_loader --region global

Requires news_schema.sql to have been run once against the DB first.

Rows are keyed on (region, url) with ON CONFLICT DO UPDATE, so running this
repeatedly is safe -- it just refreshes existing articles and adds new ones.
"""

import argparse
import logging

from backend.database.db import get_connection
from backend.scraper.global_news import fetch_global_news
from backend.scraper.news_scraper import scrape_mse_news

log = logging.getLogger(__name__)

UPSERT_NEWS_SQL = """
    INSERT INTO news_articles (
        region, external_id, headline, category, summary, source, url,
        image_url, published_at
    ) VALUES (%(region)s, %(external_id)s, %(headline)s, %(category)s,
              %(summary)s, %(source)s, %(url)s, %(image_url)s, %(published_at)s)
    ON CONFLICT (region, url) DO UPDATE SET
        external_id  = EXCLUDED.external_id,
        headline     = EXCLUDED.headline,
        category     = EXCLUDED.category,
        summary      = EXCLUDED.summary,
        source       = EXCLUDED.source,
        image_url    = EXCLUDED.image_url,
        published_at = EXCLUDED.published_at,
        scraped_at   = now()
"""

# Scraped rows won't all carry every key (e.g. MSE rows have no external_id/
# summary/image_url) -- fill the gaps with None so executemany doesn't choke.
_ROW_KEYS = [
    "external_id", "headline", "category", "summary",
    "source", "url", "image_url", "published_at",
]


def _normalize(region: str, rows: list[dict]) -> list[dict]:
    normalized = []
    for row in rows:
        item = {k: row.get(k) for k in _ROW_KEYS}
        item["region"] = region
        normalized.append(item)
    return normalized


def save_news(conn, region: str, rows: list[dict]) -> int:
    normalized = _normalize(region, rows)
    if not normalized:
        return 0
    with conn.cursor() as cur:
        cur.executemany(UPSERT_NEWS_SQL, normalized)
    conn.commit()
    return len(normalized)


def load_mse_news(conn) -> int:
    return save_news(conn, "mse", scrape_mse_news())


def load_global_news(conn, category: str = "general") -> int:
    return save_news(conn, "global", fetch_global_news(category=category))


def main():
    ap = argparse.ArgumentParser(description="Scrape/fetch news and upsert into news_articles")
    ap.add_argument("--region", choices=["mse", "global", "all"], default="all")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    conn = get_connection()
    try:
        if args.region in ("mse", "all"):
            count = load_mse_news(conn)
            log.info("Upserted %d MSE news article(s)", count)
        if args.region in ("global", "all"):
            count = load_global_news(conn)
            log.info("Upserted %d global news article(s)", count)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
