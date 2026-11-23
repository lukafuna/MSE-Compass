"""
Long-running Python-level scheduler for the MSE Compass scrapers.

This is a process, not an OS-level task -- it only runs jobs while it is
alive. Start it in its own terminal/window and leave it running:

    python -m backend.scheduler

Jobs:
    - Weekdays 08:05 local time: stock OHLCV for the trailing 5 days
      (catches up on anything since the last run), the MBI10 stock
      index, news (MSE + global), then recompute indicators. Runs
      before the session opens, so "today" has no report yet -- MSE
      publishes the previous day's official list overnight, and the
      trailing window picks that up (plus self-heals if a run was
      missed, e.g. a holiday). Skipped on weekends since the MSE
      doesn't trade then.
    - 1st of every month, 18:30 local time: bond OHLCV for the trailing
      35 days (catches up on anything since the last run), the OMB
      bond index, then recompute indicators. Bond prices barely move
      day to day, so a monthly catch-up covers it -- no need to hit the
      site daily for these.

Indicators (company_analysis: SMA, momentum, volatility, trend_signal) are
recomputed after every OHLCV scrape -- the screener/bonds pages join onto
that table, so new price rows with no corresponding analysis row show up
as "insufficient_data" until this runs.

All scrape/save steps are wrapped individually so one failing step (e.g. a
network hiccup on news) doesn't stop the others in the same run.
"""

import logging
import sys
from datetime import date, timedelta

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from backend.analysis.analysis import compute_all, load_price_history, save_analysis_to_db
from backend.database.db import get_connection
from backend.main import run as run_ohlcv
from backend.scraper.index_parser import save_indexes
from backend.scraper.index_scraper import INDEX_TYPE, scrape_all_indexes
from backend.scraper.news_loader import load_global_news, load_mse_news

log = logging.getLogger(__name__)


def _codes_for(index_type: str) -> list[str]:
    return [code for code, t in INDEX_TYPE.items() if t == index_type]


def _scrape_and_save_indexes(index_type: str, months: int) -> None:
    rows = scrape_all_indexes(months=months, codes=_codes_for(index_type))
    if not rows:
        log.warning("No %s index rows scraped -- nothing to upsert.", index_type)
        return
    conn = get_connection()
    try:
        count = save_indexes(conn, rows)
        log.info("Upserted %d %s index row(s).", count, index_type)
    finally:
        conn.close()


def _recompute_analysis() -> None:
    """Full recompute (not --since) so rolling windows (SMA_20 etc.) always
    see complete history instead of clipping at an arbitrary cutoff."""
    conn = get_connection()
    try:
        df = load_price_history(conn)
        if df.empty:
            log.warning("No OHLCV rows found -- nothing to analyze.")
            return
        save_analysis_to_db(conn, compute_all(df))
    finally:
        conn.close()


DAILY_LOOKBACK_DAYS = 5


def daily_job() -> None:
    log.info("Daily job starting (stocks + stock index + news)")

    try:
        end = date.today()
        start = end - timedelta(days=DAILY_LOOKBACK_DAYS)
        run_ohlcv(start, end, instrument_types={"stock"})
    except Exception:
        log.exception("Stock OHLCV scrape failed")

    try:
        _scrape_and_save_indexes("stock", months=1)
    except Exception:
        log.exception("Stock index scrape failed")

    try:
        conn = get_connection()
        try:
            count = load_mse_news(conn)
            log.info("Upserted %d MSE news article(s).", count)
        finally:
            conn.close()
    except Exception:
        log.exception("MSE news scrape failed")

    try:
        conn = get_connection()
        try:
            count = load_global_news(conn)
            log.info("Upserted %d global news article(s).", count)
        finally:
            conn.close()
    except Exception:
        log.exception("Global news scrape failed")

    try:
        _recompute_analysis()
    except Exception:
        log.exception("Indicator recompute failed")

    log.info("Daily job finished")


def bonds_job() -> None:
    log.info("Bonds job starting (monthly)")

    try:
        end = date.today()
        start = end - timedelta(days=35)
        run_ohlcv(start, end, instrument_types={"bond"})
    except Exception:
        log.exception("Bond OHLCV scrape failed")

    try:
        # MSE's /api/index/{code}/{months} only accepts 1, 3, 6 or 12 --
        # anything else (e.g. 2) is a 500. 3 covers the monthly cadence.
        _scrape_and_save_indexes("bond", months=3)
    except Exception:
        log.exception("Bond index scrape failed")

    try:
        _recompute_analysis()
    except Exception:
        log.exception("Indicator recompute failed")

    log.info("Bonds job finished")


def main() -> None:
    # Launched headless by Task Scheduler (pythonw, no console) most of the
    # time now -- always log to a file so runs are inspectable, and add a
    # console handler too when one actually exists (e.g. running by hand).
    handlers: list[logging.Handler] = [logging.FileHandler("scheduler.log", encoding="utf-8")]
    if sys.stderr is not None:
        handlers.append(logging.StreamHandler())
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", handlers=handlers)

    scheduler = BlockingScheduler()
    scheduler.add_job(
        daily_job,
        CronTrigger(day_of_week="mon-fri", hour=8, minute=5),
        id="daily_stocks_news_index",
    )
    scheduler.add_job(
        bonds_job,
        CronTrigger(day=1, hour=18, minute=30),
        id="monthly_bonds",
    )

    log.info("Scheduler started (weekdays 08:05 -> stocks/news/index, 1st @ 18:30 -> bonds). Ctrl+C to stop.")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        log.info("Scheduler stopped.")


if __name__ == "__main__":
    main()
