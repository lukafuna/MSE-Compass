"""
Example end-to-end run: download a date range of reports, parse each one,
and save the results to Postgres.

Usage:
    python -m backend.main                                  # last 7 days, everything
    python -m backend.main 2026-07-01 2026-07-14
    python -m backend.main --type stock                     # stocks only, last 7 days
    python -m backend.main 2026-07-01 2026-07-14 --type bond # bonds only, a range
"""

import argparse
from datetime import date, datetime, timedelta
from typing import Optional

from backend.scraper.parser import parse_report
from backend.database.repository import save_rows
from backend.scraper.scraper import download_range

INSTRUMENT_TYPE_CHOICES = ("stock", "bond", "all")


def run(start: date, end: date, instrument_types: Optional[set[str]] = None) -> None:
    files = download_range(start, end)
    print(f"Downloaded {len(files)} report(s).")

    for path in files:
        rows = parse_report(path)
        saved = save_rows(rows, instrument_types=instrument_types)
        print(f"{path.name}: parsed {len(rows)} rows, saved {saved} rows.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Scrape MSE daily OHLCV reports into company_ohlcv")
    ap.add_argument("start", nargs="?", help="YYYY-MM-DD (default: 7 days ago)")
    ap.add_argument("end", nargs="?", help="YYYY-MM-DD (default: today)")
    ap.add_argument("--type", choices=INSTRUMENT_TYPE_CHOICES, default="all",
                     help="Only save rows of this instrument type (default: all)")
    args = ap.parse_args()

    if args.start and args.end:
        start_date = datetime.strptime(args.start, "%Y-%m-%d").date()
        end_date = datetime.strptime(args.end, "%Y-%m-%d").date()
    else:
        end_date = date.today()
        start_date = end_date - timedelta(days=7)

    types = None if args.type == "all" else {args.type}
    run(start_date, end_date, instrument_types=types)