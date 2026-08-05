"""
Scrapes the MSE's public news listing (https://www.mse.mk/mk/news/latest).

Page structure (confirmed from the live page): under <div id="news-content">
each article is a pair of consecutive <div class="row"> elements --

    <div class="row">
        <div class="col-md-1"><a href="/mk/news/22/7/2026/some-slug">22.7.2026</a></div>
        <div class="col-md-11"><a href="/mk/news/22/7/2026/some-slug"><b>Headline text</b></a></div>
    </div>
    <div class="row">
        <div class="col-md-1"></div>
        <div class="col-md-11"><p class="news-headline">Category label</p></div>
    </div>

The listing page only carries headline/category/date/url -- no summary body,
so we don't fetch each article's detail page (keeps this to one request).
"""

from datetime import date, datetime

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.mse.mk"
NEWS_URL = f"{BASE_URL}/mk/news/latest"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; mse-scraper/1.0)"}


def _parse_date(text: str) -> date:
    return datetime.strptime(text.strip(), "%d.%m.%Y").date()


def scrape_mse_news() -> list[dict]:
    """Pull the latest MSE news items. Returns dicts shaped for news_loader.py."""
    resp = requests.get(NEWS_URL, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    content = soup.select_one("#news-content")
    if content is None:
        return []

    rows = content.select(":scope > .row")
    articles = []

    for i, row in enumerate(rows):
        date_link = row.select_one(".col-md-1 a")
        if not date_link:
            continue  # this row is a category-label row, already consumed below

        headline_link = row.select_one(".col-md-11 a")
        if not headline_link:
            continue

        category = None
        if i + 1 < len(rows):
            label = rows[i + 1].select_one(".news-headline")
            if label:
                category = label.get_text(strip=True)

        href = date_link["href"]
        articles.append({
            "headline": headline_link.get_text(strip=True),
            "category": category,
            "url": href if href.startswith("http") else BASE_URL + href,
            "published_at": _parse_date(date_link.get_text(strip=True)),
            "source": "MSE",
        })

    return articles


if __name__ == "__main__":
    for a in scrape_mse_news():
        print(a)
