"""
Parses a single MSE daily report (.xls) into a flat list of OhlcvRow records,
each tagged with its market section, market category, and company name.

Report layout (as published by the MSE, e.g. https://www.mse.mk/en/reports):

    МАКЕДОНСКА БЕРЗА НА ХАРТИИ ОД ВРЕДНОСТ
    Дневна официјална листа број 129 од 14.07.2026
    Хартија од вредност | Просечна цена | % пром. | Куповна цена | ... (header row)
    Официјален пазар                                  <- market SECTION (no data)
    Супер котација - обични акции                     <- market CATEGORY (no data)
    Комерцијална банка Скопје   25264.39   0   ...     <- company row (data)
    Берзанска котација - обични акции                 <- market CATEGORY (no data)
    Алкалоид Скопје   22499.06   0.18   ...            <- company row (data)
    ...
    Редовен пазар                                     <- market SECTION (no data)
    Слободен пазар - обични акции                     <- market CATEGORY (no data)
    Караорман Скопје   1891   0   ...                  <- company row (data)
    Вкупен промет на сите пазарни сегменти: ...       <- STOP marker, everything below is
    МБИ10 ...                                             index/FX data, not company rows
    ОМБ ...
    1 EUR = 61,6035 МКД

Section/category rows are identified structurally: every column except the
name (column 0) is empty. Company rows always carry at least a price.
"""

import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Optional

import pandas as pd

# Column indices in the raw sheet (0-indexed)
COL_NAME = 0
COL_AVG_PRICE = 1
COL_PCT_CHANGE = 2
COL_BUY_PRICE = 3
COL_SELL_PRICE = 4
COL_MAX_PRICE = 5
COL_MIN_PRICE = 6
COL_LAST_PRICE = 7
COL_VOLUME = 8
COL_TURNOVER_1000 = 9
COL_NOTE = 10

DATE_RE = re.compile(r"(\d{2})\.(\d{2})\.(\d{4})")

# The two top-level market divisions used by the MSE. Everything else that
# looks like a header (see _is_header_row) is treated as a category within
# whichever of these two sections we last saw.
TOP_LEVEL_SECTIONS = {
    "Официјален пазар",
    "Редовен пазар",
}

# Once we hit a row starting with any of these, company data has ended.
STOP_MARKERS = ("Вкупен промет",)

# Category rows for bonds all carry this root somewhere in the label, e.g.
# "Берзанска котација - обврзници" (confirmed against a live report -- see
# repository.py for the one known DB mismatch this doesn't retroactively fix).
BOND_CATEGORY_MARKER = "обврзниц"


def classify_instrument_type(category: str) -> str:
    return "bond" if BOND_CATEGORY_MARKER in category.lower() else "stock"


@dataclass
class OhlcvRow:
    section: str
    category: str
    company: str
    trading_date: date
    instrument_type: str
    open_price: Optional[float]
    high_price: Optional[float]
    low_price: Optional[float]
    close_price: Optional[float]
    avg_price: Optional[float]  # MSE's "Просечна цена" -- what MSE's own ticker displays
    daily_change_pct: Optional[float]  # MSE's own "% пром." for the day, vs. our derived momentum indicators
    volume: Optional[int]
    turnover: Optional[float]  # full MKD amount (file stores it in thousands)


def _to_float(val) -> Optional[float]:
    if pd.isna(val):
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _to_int(val) -> Optional[int]:
    f = _to_float(val)
    return int(f) if f is not None else None


def _extract_report_date(df: pd.DataFrame) -> date:
    """The date sits in the 'Дневна официјална листа број N од DD.MM.YYYY' line,
    normally row 1, but we scan the first few rows defensively."""
    for i in range(min(5, len(df))):
        cell = df.iat[i, COL_NAME]
        if isinstance(cell, str):
            m = DATE_RE.search(cell)
            if m:
                d, mo, y = m.groups()
                return date(int(y), int(mo), int(d))
    raise ValueError("Could not find the report date in the sheet header")


def _is_header_row(df: pd.DataFrame, i: int) -> bool:
    """Section/category rows carry a label in column 0 and nothing else."""
    return df.iloc[i, COL_AVG_PRICE:].isna().all()


def parse_report(path: Path) -> list[OhlcvRow]:
    df = pd.read_excel(path, header=None)
    report_date = _extract_report_date(df)

    rows: list[OhlcvRow] = []
    current_section: Optional[str] = None
    current_category: Optional[str] = None

    for i in range(len(df)):
        name = df.iat[i, COL_NAME]
        if not isinstance(name, str) or not name.strip():
            continue
        name = name.strip()

        if name.startswith(STOP_MARKERS):
            break  # rest of the sheet is index/FX summary data, not companies

        if _is_header_row(df, i):
            if name in TOP_LEVEL_SECTIONS:
                current_section = name
                current_category = None
            else:
                current_category = name
            continue

        if current_section is None or current_category is None:
            # Defensive: a data row showed up before we saw a section/category.
            continue

        turnover_1000 = _to_float(df.iat[i, COL_TURNOVER_1000])

        rows.append(
            OhlcvRow(
                section=current_section,
                category=current_category,
                company=name,
                trading_date=report_date,
                instrument_type=classify_instrument_type(current_category),
                # The MSE daily report does not publish an opening price.
                open_price=None,
                high_price=_to_float(df.iat[i, COL_MAX_PRICE]),
                low_price=_to_float(df.iat[i, COL_MIN_PRICE]),
                close_price=_to_float(df.iat[i, COL_LAST_PRICE]),
                avg_price=_to_float(df.iat[i, COL_AVG_PRICE]),
                daily_change_pct=_to_float(df.iat[i, COL_PCT_CHANGE]),
                volume=_to_int(df.iat[i, COL_VOLUME]),
                turnover=(turnover_1000 * 1000) if turnover_1000 is not None else None,
            )
        )

    return rows


if __name__ == "__main__":
    import sys

    for r in parse_report(Path(sys.argv[1])):
        print(r)