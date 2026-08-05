"""
index_loader.py
----------------
Takes the index data produced by index_scraper.py (MBI10 + OMB daily
value/change history, plus today's valuation extras) and upserts it into
mse_indexes -- the companion table your API's /indexes endpoint reads from.

Run this after (or alongside) your OHLCV scraper:
    python -m backend.scraper.index_parser                            # daily: last 1 month, all indexes
    python -m backend.scraper.index_parser --backfill 24               # backfill: last 24 months
    python -m backend.scraper.index_parser --index-type stock          # MBI10 only
    python -m backend.scraper.index_parser --index-type bond --backfill 2   # OMB only, 2 months

Requires mse_indexes to already exist in the DB (see schema above).

Rows are keyed on (index_code, trading_date) with ON CONFLICT DO UPDATE, so
running this repeatedly is safe -- it just refreshes existing days and adds
new ones. Valuation columns (market cap, P/E, P/B, day range) use COALESCE
on conflict so re-running a small daily pull never blanks out values that
only get populated on the "full" scrape for today's row.
"""

import argparse
import logging

from backend.database.db import get_connection
from backend.scraper.index_scraper import scrape_all_indexes, INDEX_TYPE

log = logging.getLogger(__name__)

UPSERT_INDEX_SQL = """
    INSERT INTO mse_indexes (
        index_code, index_type, trading_date, value, change_pct, absolute_change,
        open_value, day_max, day_min, market_cap_mkd, pe_ratio, pb_ratio
    ) VALUES (%(index_code)s, %(index_type)s, %(trading_date)s, %(value)s, %(change_pct)s,
              %(absolute_change)s, %(open_value)s, %(day_max)s, %(day_min)s,
              %(market_cap_mkd)s, %(pe_ratio)s, %(pb_ratio)s)
    ON CONFLICT (index_code, trading_date) DO UPDATE SET
        value = EXCLUDED.value,
        change_pct = EXCLUDED.change_pct,
        absolute_change = EXCLUDED.absolute_change,
        open_value = COALESCE(EXCLUDED.open_value, mse_indexes.open_value),
        day_max = COALESCE(EXCLUDED.day_max, mse_indexes.day_max),
        day_min = COALESCE(EXCLUDED.day_min, mse_indexes.day_min),
        market_cap_mkd = COALESCE(EXCLUDED.market_cap_mkd, mse_indexes.market_cap_mkd),
        pe_ratio = COALESCE(EXCLUDED.pe_ratio, mse_indexes.pe_ratio),
        pb_ratio = COALESCE(EXCLUDED.pb_ratio, mse_indexes.pb_ratio),
        scraped_at = now()
"""

# Every key the SQL expects -- scraped rows won't all have the valuation
# keys (only the most recent day per index does), so we fill in the gaps
# with None rather than letting executemany choke on a missing key.
_ROW_KEYS = [
    "index_code", "index_type", "trading_date", "value", "change_pct",
    "absolute_change", "open_value", "day_max", "day_min",
    "market_cap_mkd", "pe_ratio", "pb_ratio",
]


def _normalize(rows: list[dict]) -> list[dict]:
    return [{k: row.get(k) for k in _ROW_KEYS} for row in rows]


def save_indexes(conn, rows: list[dict]) -> int:
    normalized = _normalize(rows)
    with conn.cursor() as cur:
        cur.executemany(UPSERT_INDEX_SQL, normalized)
    conn.commit()
    return len(normalized)


def _codes_for(index_type: str) -> list[str]:
    return [code for code, t in INDEX_TYPE.items() if t == index_type]


def main():
    ap = argparse.ArgumentParser(description="Scrape MSE index data (MBI10, OMB) and upsert into mse_indexes")
    ap.add_argument("--backfill", type=int, metavar="MONTHS",
                     help="Months of history to pull per index (default: 1, i.e. daily run)")
    ap.add_argument("--index-type", choices=["stock", "bond", "all"], default="all",
                     help="Which index to scrape: stock (MBI10), bond (OMB), or all (default)")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    months = args.backfill if args.backfill else 1
    codes = None if args.index_type == "all" else _codes_for(args.index_type)
    rows = scrape_all_indexes(months=months, codes=codes)

    if not rows:
        log.warning("No index rows scraped -- nothing to upsert.")
        return

    conn = get_connection()
    try:
        count = save_indexes(conn, rows)
        log.info("Upserted %d index rows (%s, %d month(s) of history)", count, ", ".join(codes or INDEX_TYPE), months)
    finally:
        conn.close()


if __name__ == "__main__":
    main()