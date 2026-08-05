"""
Turns parsed OhlcvRow records into rows in market_sections, market_categories,
companies, and company_ohlcv.

Recommended one-time addition to schema.sql for this to be race-safe /
efficient (not strictly required, get_or_create_company falls back to a
plain SELECT either way):

    ALTER TABLE companies ADD CONSTRAINT companies_name_key UNIQUE (name);
"""

from typing import Iterable, Optional

from backend.database.db import get_connection
from backend.scraper.parser import OhlcvRow


def get_or_create_section(cur, name: str) -> int:
    cur.execute("SELECT id FROM market_sections WHERE name = %s", (name,))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        "INSERT INTO market_sections (name) VALUES (%s) RETURNING id",
        (name,),
    )
    return cur.fetchone()[0]


def get_or_create_category(cur, name: str) -> int:
    cur.execute("SELECT id FROM market_categories WHERE name = %s", (name,))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        "INSERT INTO market_categories (name) VALUES (%s) RETURNING id",
        (name,),
    )
    return cur.fetchone()[0]


def get_or_create_company(
    cur, name: str, section_id: int, category_id: int, instrument_type: str
) -> int:
    cur.execute("SELECT id FROM companies WHERE name = %s", (name,))
    row = cur.fetchone()
    if row:
        return row[0]
    cur.execute(
        """
        INSERT INTO companies (name, section_id, category_id, instrument_type)
        VALUES (%s, %s, %s, %s)
        RETURNING id
        """,
        (name, section_id, category_id, instrument_type),
    )
    return cur.fetchone()[0]


def upsert_ohlcv(cur, company_id: int, row: OhlcvRow) -> None:
    cur.execute(
        """
        INSERT INTO company_ohlcv
            (company_id, trading_date, open_price, high_price, low_price,
             close_price, avg_price, daily_change_pct, volume, turnover)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (company_id, trading_date) DO UPDATE SET
            open_price       = EXCLUDED.open_price,
            high_price       = EXCLUDED.high_price,
            low_price        = EXCLUDED.low_price,
            close_price      = EXCLUDED.close_price,
            avg_price        = EXCLUDED.avg_price,
            daily_change_pct = EXCLUDED.daily_change_pct,
            volume           = EXCLUDED.volume,
            turnover         = EXCLUDED.turnover
        """,
        (
            company_id,
            row.trading_date,
            row.open_price,
            row.high_price,
            row.low_price,
            row.close_price,
            row.avg_price,
            row.daily_change_pct,
            row.volume,
            row.turnover,
        ),
    )


def save_rows(rows: Iterable[OhlcvRow], instrument_types: Optional[set[str]] = None) -> int:
    """Persist a batch of parsed rows (typically one report/day) in a single
    transaction. Returns the number of rows saved.

    instrument_types: if given (e.g. {"stock"} or {"bond"}), only rows
    classified as one of these get saved -- everything else in the report is
    skipped. Existing companies keep whatever instrument_type they already
    have in the DB; this only sets it for brand-new companies.
    """
    rows = list(rows)
    if instrument_types is not None:
        rows = [r for r in rows if r.instrument_type in instrument_types]
    if not rows:
        return 0

    section_cache: dict[str, int] = {}
    category_cache: dict[str, int] = {}
    company_cache: dict[str, int] = {}

    with get_connection() as conn:
        with conn.cursor() as cur:
            for row in rows:
                if row.section not in section_cache:
                    section_cache[row.section] = get_or_create_section(cur, row.section)
                if row.category not in category_cache:
                    category_cache[row.category] = get_or_create_category(cur, row.category)

                section_id = section_cache[row.section]
                category_id = category_cache[row.category]

                if row.company not in company_cache:
                    company_cache[row.company] = get_or_create_company(
                        cur, row.company, section_id, category_id, row.instrument_type
                    )
                company_id = company_cache[row.company]

                upsert_ohlcv(cur, company_id, row)
        conn.commit()

    return len(rows)