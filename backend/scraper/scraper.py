"""
Downloads daily report files from the Macedonian Stock Exchange
(https://www.mse.mk/en/reports).

URL pattern (confirmed from the site's own download links):
    https://www.mse.mk/Repository/Reports/{year}/{dd}.{mm}.{yyyy}mk.xls

MSE doesn't trade on weekends or public holidays, so those dates simply
won't have a report (usually a 404, occasionally a tiny placeholder file
instead of a real error) -- we treat both as "no report" and move on.
"""

import time
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import requests

BASE_URL = "https://www.mse.mk/Repository/Reports/{year}/{dd:02d}.{mm:02d}.{year}mk.xls"
DOWNLOAD_DIR = Path(__file__).parent / "downloads"

# Below this size, the file isn't a real report (MSE sometimes serves a
# near-empty stub on non-trading days instead of a clean 404).
MIN_VALID_SIZE_BYTES = 2000

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; mse-scraper/1.0)"}


def build_url(report_date: date) -> str:
    return BASE_URL.format(year=report_date.year, dd=report_date.day, mm=report_date.month)


def download_report(
    report_date: date,
    dest_dir: Path = DOWNLOAD_DIR,
    session: Optional[requests.Session] = None,
    force: bool = False,
) -> Optional[Path]:
    """
    Download a single day's report.
    Returns the saved file path, or None if there's no report for that date
    (weekend, holiday, or not yet published).
    """
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / f"{report_date:%d_%m_%Y}mk.xls"

    if dest_path.exists() and not force:
        return dest_path

    sess = session or requests
    resp = sess.get(build_url(report_date), headers=HEADERS, timeout=20)

    if resp.status_code == 404:
        return None
    resp.raise_for_status()

    if len(resp.content) < MIN_VALID_SIZE_BYTES:
        return None

    dest_path.write_bytes(resp.content)
    return dest_path


def download_range(
    start: date,
    end: date,
    dest_dir: Path = DOWNLOAD_DIR,
    pause_seconds: float = 0.3,
) -> list[Path]:
    """Download every daily report between start and end (inclusive), skipping weekends."""
    saved: list[Path] = []
    with requests.Session() as sess:
        current = start
        while current <= end:
            if current.weekday() < 5:  # Mon-Fri; MSE doesn't publish weekend reports
                path = download_report(current, dest_dir, sess)
                if path:
                    saved.append(path)
                time.sleep(pause_seconds)
            current += timedelta(days=1)
    return saved


if __name__ == "__main__":
    # Example: pull the last 7 calendar days.
    today = date.today()
    files = download_range(today - timedelta(days=7), today)
    for f in files:
        print("Saved:", f)