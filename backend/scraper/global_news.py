"""
Fetches general market news from Finnhub (https://finnhub.io/docs/api/company-news
-- general market news endpoint: GET /news?category=general).

Requires FINNHUB_API_KEY to be set (.env or environment).
"""

import os
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv

load_dotenv()

FINNHUB_NEWS_URL = "https://finnhub.io/api/v1/news"


def fetch_global_news(category: str = "general") -> list[dict]:
    """Pull market news from Finnhub. Returns dicts shaped for news_loader.py."""
    api_key = os.getenv("FINNHUB_API_KEY")
    if not api_key:
        raise RuntimeError("FINNHUB_API_KEY is not set -- add it to .env")

    resp = requests.get(
        FINNHUB_NEWS_URL,
        params={"category": category, "token": api_key},
        timeout=15,
    )
    resp.raise_for_status()
    rows = resp.json()

    return [
        {
            "external_id": str(row["id"]),
            "headline": row["headline"],
            "category": row.get("category"),
            "summary": row.get("summary") or None,
            "source": row.get("source"),
            "url": row["url"],
            "image_url": row.get("image") or None,
            "published_at": datetime.fromtimestamp(row["datetime"], tz=timezone.utc),
        }
        for row in rows
        if row.get("url")  # Finnhub occasionally returns filler rows with no url
    ]


if __name__ == "__main__":
    for a in fetch_global_news()[:5]:
        print(a)
