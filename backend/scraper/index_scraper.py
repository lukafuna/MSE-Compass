# backend/scraper/index_scraper.py
import requests
from bs4 import BeautifulSoup
from datetime import date

INDEX_TYPE = {
    "MBI10": "stock",
    "OMB": "bond",
}

def _parse_mk_number(text: str | None) -> float | None:
    """MSE formats numbers like '9.423,43' (dot=thousands, comma=decimal)."""
    if not text:
        return None
    cleaned = text.strip().replace(".", "").replace(",", ".").replace("%", "")
    try:
        return float(cleaned)
    except ValueError:
        return None

def scrape_index_history(index_code: str, months: int = 12) -> list[dict]:
    """Pull daily value/change history straight from MSE's JSON API."""
    url = f"https://www.mse.mk/api/index/{index_code}/{months}"
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    rows = resp.json()

    return [
        {
            "index_code": row["indexCode"],
            "index_type": INDEX_TYPE[index_code],
            "trading_date": row["tradingDate"][:10],  # "2026-07-22T00:00:00" -> "2026-07-22"
            "value": row["value"],
            "change_pct": row.get("valuePerChange"),
            "absolute_change": row.get("valueAbsChange"),
        }
        for row in rows
    ]

def scrape_index_valuation(index_code: str) -> dict:
    """Supplementary data (market cap, P/E, P/B, day range) via HTML -- real selectors."""
    url = f"https://www.mse.mk/mk/indicies/{index_code}/values"
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    data_rows = {}
    for tr in soup.select("#pazarnip tr"):
        tds = tr.find_all("td")
        if len(tds) == 2:
            label = tds[0].get_text(strip=True)
            value = tds[1].get_text(strip=True)
            data_rows[label] = value

    return {
        "open_value": _parse_mk_number(data_rows.get("На отворање")),
        "day_max": _parse_mk_number(data_rows.get("Максимум")),
        "day_min": _parse_mk_number(data_rows.get("Минимум")),
        "market_cap_mkd": _parse_mk_number(data_rows.get("Пазарна капитализација (МКД)")),
        "pe_ratio": _parse_mk_number(data_rows.get("Коефициент цена/добивка")),
        "pb_ratio": _parse_mk_number(data_rows.get("Коефициент цена/книговодствена вредност")),
    }

def scrape_index_full(index_code: str, months: int = 1) -> list[dict]:
    """Combine JSON history + today's valuation extras into upsert-ready rows."""
    history = scrape_index_history(index_code, months=months)
    valuation = scrape_index_valuation(index_code)

    # Only the most recent day gets the valuation snapshot merged in --
    # older days keep the historical value/change only, matching what MSE actually gives us.
    if history:
        history[-1].update(valuation)
    return history

def scrape_all_indexes(months: int = 1, codes: list[str] | None = None) -> list[dict]:
    """codes: which index codes to pull (default: all of INDEX_TYPE)."""
    all_rows = []
    for code in (codes if codes is not None else list(INDEX_TYPE)):
        all_rows.extend(scrape_index_full(code, months=months))
    return all_rows