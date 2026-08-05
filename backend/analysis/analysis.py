"""
analysis.py
-----------
Reads company_ohlcv (+ companies) from Postgres, computes technical
indicators per company, and writes them back into company_analysis --
a companion table your web backend can join straight onto company_ohlcv.

Run this after your OHLCV loader has loaded/updated data:
    python analysis.py                # computes for every company, upserts all
    python analysis.py --since 2026-01-01   # only recompute using data from this date on
                                             # (still needs enough history before it
                                             # for SMA_20 etc. to be non-null early on)

Requires analysis_schema.sql to have been run once against the DB first.

WHAT IT COMPUTES (per company, per trading day)
------------------------------------------------
- sma_5 / sma_20            : simple moving average of close_price over the
                               last 5 / 20 *recorded* trading rows.
- momentum_5d_pct/20d_pct   : % change in close_price vs. N rows back.
- volatility_20d_pct        : std. dev. of daily % returns, last 20 rows.
- avg_volume_20d            : average volume, last 20 rows.
- liquidity_ratio_20d       : fraction of the last 20 rows with volume > 0.
                               Many MSE tickers barely trade -- a "price move"
                               on a zero-volume day is a stale quote, not a
                               real signal, so this flags it.
- trend_signal              : plain descriptive label from the sma_5 vs
                               sma_20 relationship (see _trend_signal). This
                               is a descriptive indicator, not a
                               recommendation -- keep any "what to do" framing
                               in the website's UI/copy, not in this column.

Note the new schema has no ticker "code" column -- companies are identified
by company_id (and name). Everything below is keyed on company_id.

The pure computation function (`build_timeseries`) takes a plain DataFrame
and does no I/O, so a web backend can also `import analysis` and call it
directly on a freshly-queried DataFrame instead of hitting company_analysis.
"""

import logging
import argparse
from datetime import date

import pandas as pd

from backend.database.db import get_connection

log = logging.getLogger(__name__)

SHORT_WINDOW = 5
LONG_WINDOW = 20

UPSERT_SQL = """
    INSERT INTO company_analysis (
        company_id, trading_date, sma_5, sma_20, momentum_5d_pct, momentum_20d_pct,
        volatility_20d_pct, avg_volume_20d, liquidity_ratio_20d, trend_signal
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT (company_id, trading_date) DO UPDATE SET
        sma_5 = EXCLUDED.sma_5,
        sma_20 = EXCLUDED.sma_20,
        momentum_5d_pct = EXCLUDED.momentum_5d_pct,
        momentum_20d_pct = EXCLUDED.momentum_20d_pct,
        volatility_20d_pct = EXCLUDED.volatility_20d_pct,
        avg_volume_20d = EXCLUDED.avg_volume_20d,
        liquidity_ratio_20d = EXCLUDED.liquidity_ratio_20d,
        trend_signal = EXCLUDED.trend_signal,
        computed_at = now()
"""


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_price_history(conn, since: date | None = None) -> pd.DataFrame:
    """Pull every company/day OHLCV row into one tidy DataFrame, oldest first."""
    query = """
        SELECT c.id AS company_id, c.name, o.trading_date, o.close_price, o.volume
        FROM company_ohlcv o
        JOIN companies c ON c.id = o.company_id
        {where}
        ORDER BY c.id, o.trading_date
    """.format(where="WHERE o.trading_date >= %(since)s" if since else "")
    params = {"since": since} if since else None
    df = pd.read_sql(query, conn, params=params)
    df["trading_date"] = pd.to_datetime(df["trading_date"])
    return df


# ---------------------------------------------------------------------------
# Per-company computation
# ---------------------------------------------------------------------------

def _trend_signal(sma_short, sma_long, prev_sma_short, prev_sma_long) -> str:
    """Plain descriptive label from the short-vs-long moving average relationship."""
    if pd.isna(sma_short) or pd.isna(sma_long):
        return "insufficient_data"
    if pd.notna(prev_sma_short) and pd.notna(prev_sma_long):
        crossed_up = prev_sma_short <= prev_sma_long and sma_short > sma_long
        crossed_down = prev_sma_short >= prev_sma_long and sma_short < sma_long
        if crossed_up:
            return "crossover_up"
        if crossed_down:
            return "crossover_down"
    return "above_trend" if sma_short > sma_long else "below_trend"


def build_timeseries(company_df: pd.DataFrame) -> pd.DataFrame:
    """
    Given one company's rows (any order), return them sorted with indicator
    columns added: sma_short, sma_long, momentum_short_pct, momentum_long_pct,
    volatility_long_pct, avg_volume_long, liquidity_ratio_long, trend_signal.
    """
    ts = company_df.sort_values("trading_date").reset_index(drop=True).copy()

    ts["daily_return"] = ts["close_price"].pct_change()
    ts["sma_short"] = ts["close_price"].rolling(SHORT_WINDOW, min_periods=SHORT_WINDOW).mean()
    ts["sma_long"] = ts["close_price"].rolling(LONG_WINDOW, min_periods=LONG_WINDOW).mean()
    ts["momentum_short_pct"] = ts["close_price"].pct_change(periods=SHORT_WINDOW) * 100
    ts["momentum_long_pct"] = ts["close_price"].pct_change(periods=LONG_WINDOW) * 100
    ts["volatility_long_pct"] = (
        ts["daily_return"].rolling(LONG_WINDOW, min_periods=LONG_WINDOW).std() * 100
    )
    ts["avg_volume_long"] = ts["volume"].rolling(LONG_WINDOW, min_periods=1).mean()
    ts["liquidity_ratio_long"] = ts["volume"].gt(0).rolling(LONG_WINDOW, min_periods=1).mean()

    prev_short = ts["sma_short"].shift(1)
    prev_long = ts["sma_long"].shift(1)
    ts["trend_signal"] = [
        _trend_signal(s, l, ps, pl)
        for s, l, ps, pl in zip(ts["sma_short"], ts["sma_long"], prev_short, prev_long)
    ]
    return ts


def _safe(val, digits=4):
    if pd.isna(val):
        return None
    return round(float(val), digits)


# ---------------------------------------------------------------------------
# Orchestration / DB write
# ---------------------------------------------------------------------------

def compute_all(df: pd.DataFrame) -> dict:
    """df: output of load_price_history. Returns {company_id: computed_timeseries_df}."""
    timeseries_by_company = {}
    for company_id, group in df.groupby("company_id"):
        timeseries_by_company[company_id] = build_timeseries(group)
    return timeseries_by_company


def rows_for_upsert(timeseries_by_company: dict) -> list[tuple]:
    """Flatten computed timeseries into (company_id, trading_date, ...) tuples for executemany."""
    rows = []
    for company_id, ts in timeseries_by_company.items():
        for _, r in ts.iterrows():
            rows.append((
                int(company_id),
                r["trading_date"].date(),
                _safe(r["sma_short"]),
                _safe(r["sma_long"]),
                _safe(r["momentum_short_pct"]),
                _safe(r["momentum_long_pct"]),
                _safe(r["volatility_long_pct"]),
                _safe(r["avg_volume_long"]),
                _safe(r["liquidity_ratio_long"]),
                r["trend_signal"],
            ))
    return rows


def save_analysis_to_db(conn, timeseries_by_company: dict, batch_size: int = 5000):
    rows = rows_for_upsert(timeseries_by_company)
    with conn.cursor() as cur:
        for i in range(0, len(rows), batch_size):
            cur.executemany(UPSERT_SQL, rows[i:i + batch_size])
    conn.commit()
    log.info("Upserted %d company/day analysis rows", len(rows))


def main():
    ap = argparse.ArgumentParser(description="Compute indicators from company_ohlcv and upsert into company_analysis")
    ap.add_argument("--since", help="Only load OHLCV rows from this date on (YYYY-MM-DD). "
                                     "Still needs prior history in the table for SMA_20 etc. "
                                     "to be non-null on the earliest recomputed rows.")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    since = date.fromisoformat(args.since) if args.since else None

    conn = get_connection()
    try:
        df = load_price_history(conn, since=since)
        if df.empty:
            log.warning("No rows found in company_ohlcv -- nothing to compute.")
            return
        timeseries_by_company = compute_all(df)
        save_analysis_to_db(conn, timeseries_by_company)
    finally:
        conn.close()


if __name__ == "__main__":
    main()