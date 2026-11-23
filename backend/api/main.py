import inspect
import json
import logging
import os
import smtplib
import threading
import time
from contextlib import asynccontextmanager
from email.message import EmailMessage
from functools import wraps

import requests
from fastapi import FastAPI, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import Response, StreamingResponse
from datetime import date
from pydantic import BaseModel
from backend.database.db import get_connection, pooled_connection

log = logging.getLogger(__name__)

CACHE_TTL_SECONDS = int(os.getenv("CACHE_TTL_SECONDS", 3600))
# How long browsers may reuse a read response without asking again. Data
# only changes when the daily scrape runs, so a few minutes is harmless and
# makes back/forward navigation and revisits instant.
BROWSER_CACHE_SECONDS = int(os.getenv("BROWSER_CACHE_SECONDS", 300))


def ttl_cache(seconds: int = CACHE_TTL_SECONDS):
    """Tiny in-process cache for read endpoints backed by data that only
    changes once (or twice) a day via the scrape job. Keyed on the
    endpoint's own (normalized) arguments, so /companies/5/series and
    /companies/6/series get separate entries. Not shared across
    processes/instances -- fine here since the API runs as a single
    instance and staleness of up to `seconds` after a scrape is acceptable.

    Stores the already-serialized JSON body, so a hit skips both the DB and
    FastAPI's per-request encoding, and adds a Cache-Control header so the
    browser can reuse the response too. A per-key lock makes concurrent
    misses for the same key (cold start, a page firing parallel requests)
    run the query once instead of once per request."""

    def decorator(fn):
        store: dict[tuple, tuple[float, bytes]] = {}
        locks: dict[tuple, threading.Lock] = {}
        locks_guard = threading.Lock()
        sig = inspect.signature(fn)

        def make_response(body: bytes) -> Response:
            return Response(
                body,
                media_type="application/json",
                headers={"Cache-Control": f"public, max-age={BROWSER_CACHE_SECONDS}"},
            )

        @wraps(fn)
        def wrapper(*args, **kwargs):
            bound = sig.bind(*args, **kwargs)
            bound.apply_defaults()
            key = tuple(bound.arguments.items())

            cached = store.get(key)
            if cached and time.monotonic() < cached[0]:
                return make_response(cached[1])

            with locks_guard:
                lock = locks.setdefault(key, threading.Lock())
            with lock:
                cached = store.get(key)  # filled while we waited?
                if cached and time.monotonic() < cached[0]:
                    return make_response(cached[1])
                body = json.dumps(
                    jsonable_encoder(fn(*args, **kwargs)), separators=(",", ":")
                ).encode()
                store[key] = (time.monotonic() + seconds, body)
                return make_response(body)

        return wrapper

    return decorator


def _warm_cache() -> None:
    """Prime the cache with what the homepage needs, so the first visitor
    after a (re)start doesn't pay for the queries. Runs in the background;
    requests arriving meanwhile wait on the per-key lock instead of
    duplicating the work."""
    for fn, args in [
        (screener, ()),
        (indexes, ()),
        (index_series, ("MBI10",)),
        (index_series, ("OMB",)),
        (list_companies, ()),
    ]:
        try:
            fn(*args)
        except Exception:
            log.exception("Cache warm-up failed for %s%s", fn.__name__, args)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    threading.Thread(target=_warm_cache, daemon=True).start()
    yield


ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app = FastAPI(title="MSE Compass API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"http://localhost:\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)
# JSON payloads (price series, news) shrink ~5-8x compressed. Streaming chat
# responses are text/plain and small chunks; GZip skips bodies < minimum_size.
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.get("/health")
def health():
    return {"status": "ok"}

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
CONTACT_EMAIL = os.getenv("CONTACT_EMAIL", "contact@msecompass.mk")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-flash-latest"
GEMINI_STREAM_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:streamGenerateContent"
CHAT_CONTEXT_ROWS = 150


class ContactRequest(BaseModel):
    name: str
    email: str
    message: str


def _try_email_contact_message(payload: ContactRequest) -> bool:
    """Best-effort SMTP send. Returns whether it went through -- the
    message is already saved in contact_messages either way, so a missing
    /misconfigured SMTP setup never loses a submission."""
    if not (SMTP_HOST and SMTP_USER and SMTP_PASSWORD):
        return False

    msg = EmailMessage()
    msg["Subject"] = f"MSE Compass contact form: {payload.name}"
    msg["From"] = SMTP_USER
    msg["To"] = CONTACT_EMAIL
    msg["Reply-To"] = payload.email
    msg.set_content(f"{payload.message}\n\n— {payload.name} ({payload.email})")

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception:
        log.exception("Contact form: SMTP send failed")
        return False


@app.post("/contact")
def send_contact_message(payload: ContactRequest):
    emailed = _try_email_contact_message(payload)

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO contact_messages (name, email, message, emailed) VALUES (%s, %s, %s, %s)",
                (payload.name, payload.email, payload.message, emailed),
            )
        conn.commit()
    except Exception:
        log.exception("Contact form: failed to save submission")
        raise HTTPException(502, "Failed to send message. Please try again later.")
    finally:
        conn.close()

    return {"status": "sent"}


@app.get("/companies")
@ttl_cache()
def list_companies():
    with pooled_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, instrument_type FROM companies ORDER BY name")
            return [{"id": r[0], "name": r[1], "instrument_type": r[2]} for r in cur.fetchall()]

@app.get("/companies/{company_id}/series")
@ttl_cache()
def company_series(company_id: int, since: date | None = None):
    with pooled_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT o.trading_date, o.close_price, o.avg_price, o.daily_change_pct,
                       o.high_price, o.low_price, o.volume,
                       a.sma_5, a.sma_20, a.momentum_5d_pct, a.momentum_20d_pct,
                       a.volatility_20d_pct, a.liquidity_ratio_20d, a.trend_signal
                FROM company_ohlcv o
                LEFT JOIN company_analysis a
                    ON a.company_id = o.company_id AND a.trading_date = o.trading_date
                WHERE o.company_id = %s
                  AND (%s::date IS NULL OR o.trading_date >= %s::date)
                ORDER BY o.trading_date
            """, (company_id, since, since))
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
            if not rows:
                raise HTTPException(404, "No data for this company")
            return [dict(zip(cols, r)) for r in rows]

@app.get("/screener")
@ttl_cache()
def screener():
    with pooled_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT DISTINCT ON (c.id)
                    c.id, c.name, o.trading_date, o.close_price, o.avg_price, o.daily_change_pct,
                    a.momentum_5d_pct, a.momentum_20d_pct,
                    a.volatility_20d_pct, a.trend_signal
                FROM companies c
                JOIN company_ohlcv o ON o.company_id = c.id
                LEFT JOIN company_analysis a
                    ON a.company_id = o.company_id AND a.trading_date = o.trading_date
                WHERE c.instrument_type = 'stock'
                ORDER BY c.id, o.trading_date DESC
            """)
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, r)) for r in cur.fetchall()]


@app.get("/bonds")
@ttl_cache()
def bonds():
    """MSE bonds essentially never trade on-exchange (volume is 0 on every
    recorded row) and most never get a fresh quote either -- so the
    stock-style momentum/volatility/trend columns are meaningless here
    (either 0% or "insufficient_data" for every row). What's actually
    informative given the data we have is each bond's most recent quoted
    price (MSE's "avg_price") and how it compares to par (100, the
    standard % of face value bonds are quoted at). Bonds that have never
    been quoted are still listed, just with nulls, but sorted after ones
    that have data."""
    with pooled_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    c.id, c.name,
                    lp.trading_date AS as_of_date,
                    lp.avg_price AS last_price
                FROM companies c
                LEFT JOIN LATERAL (
                    SELECT o.trading_date, o.avg_price
                    FROM company_ohlcv o
                    WHERE o.company_id = c.id AND o.avg_price IS NOT NULL
                    ORDER BY o.trading_date DESC
                    LIMIT 1
                ) lp ON true
                WHERE c.instrument_type = 'bond'
                ORDER BY lp.avg_price IS NULL, lp.trading_date DESC NULLS LAST, c.name
            """)
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, r)) for r in cur.fetchall()]


@app.get("/news")
@ttl_cache()
def news(region: str = "mse", limit: int = 30):
    if region not in ("mse", "global"):
        raise HTTPException(400, "region must be 'mse' or 'global'")
    with pooled_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, headline, category, summary, source, url, image_url, published_at
                FROM news_articles
                WHERE region = %s
                ORDER BY published_at DESC
                LIMIT %s
            """, (region, limit))
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, r)) for r in cur.fetchall()]


@app.get("/indexes")
@ttl_cache()
def indexes():
    with pooled_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT DISTINCT ON (index_code)
                    index_code, index_type, trading_date, value, change_pct,
                    absolute_change, open_value, day_max, day_min,
                    market_cap_mkd, pe_ratio, pb_ratio
                FROM mse_indexes
                ORDER BY index_code, trading_date DESC
            """)
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, r)) for r in cur.fetchall()]


@app.get("/indexes/{index_code}/series")
@ttl_cache()
def index_series(index_code: str, since: date | None = None):
    with pooled_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT trading_date, index_type, value, change_pct, absolute_change,
                       open_value, day_max, day_min, market_cap_mkd, pe_ratio, pb_ratio
                FROM mse_indexes
                WHERE index_code = %s
                  AND (%s::date IS NULL OR trading_date >= %s::date)
                ORDER BY trading_date
            """, (index_code, since, since))
            cols = [d[0] for d in cur.description]
            rows = cur.fetchall()
            if not rows:
                raise HTTPException(404, "No data for this index")
            return [dict(zip(cols, r)) for r in rows]


class ChatMessage(BaseModel):
    role: str  # "user" or "model"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []


def _fetch_chat_context(company_id: int) -> tuple[dict, list[dict]]:
    with pooled_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, instrument_type FROM companies WHERE id = %s", (company_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Company not found")
            company = {"id": row[0], "name": row[1], "instrument_type": row[2]}

            cur.execute("""
                SELECT o.trading_date, o.close_price, o.avg_price, o.daily_change_pct,
                       o.high_price, o.low_price, o.volume,
                       a.sma_5, a.sma_20, a.momentum_5d_pct, a.momentum_20d_pct,
                       a.volatility_20d_pct, a.liquidity_ratio_20d, a.trend_signal
                FROM company_ohlcv o
                LEFT JOIN company_analysis a
                    ON a.company_id = o.company_id AND a.trading_date = o.trading_date
                WHERE o.company_id = %s
                ORDER BY o.trading_date DESC
                LIMIT %s
            """, (company_id, CHAT_CONTEXT_ROWS))
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, r)) for r in cur.fetchall()]
            rows.reverse()  # oldest first, easier for the model to reason about trends
            return company, rows


def _fetch_market_snapshot() -> list[dict]:
    """Latest trading day on record for every listing, for cross-company comparisons."""
    with pooled_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT DISTINCT ON (o.company_id)
                       c.id AS company_id, c.name, c.instrument_type,
                       o.trading_date, o.close_price, o.avg_price, o.daily_change_pct,
                       a.sma_5, a.sma_20, a.momentum_5d_pct, a.momentum_20d_pct,
                       a.volatility_20d_pct, a.trend_signal
                FROM company_ohlcv o
                JOIN companies c ON c.id = o.company_id
                LEFT JOIN company_analysis a
                    ON a.company_id = o.company_id AND a.trading_date = o.trading_date
                ORDER BY o.company_id, o.trading_date DESC
            """)
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, r)) for r in cur.fetchall()]


def _rows_to_csv(rows: list[dict]) -> str:
    if not rows:
        return "(no data)"
    header = list(rows[0].keys())
    lines = [",".join(header)]
    lines += [",".join("" if r[c] is None else str(r[c]) for c in header) for r in rows]
    return "\n".join(lines)


def _build_chat_system_prompt(company: dict, rows: list[dict], snapshot: list[dict]) -> str:
    csv_data = _rows_to_csv(rows) if rows else "(no trading data recorded yet)"
    snapshot_csv = _rows_to_csv(snapshot)

    return f"""You are the data assistant embedded in MSE Compass, a Macedonian Stock Exchange \
analytics app. The user is currently viewing one specific listing: {company['name']} \
(id {company['id']}, instrument type: {company['instrument_type']}) -- but you have access to \
the whole exchange below and can compare it against, or answer questions about, any other \
listed company or bond.

Below is the currently-viewed listing's daily trading/analysis data, oldest to newest, as CSV \
(most recent {len(rows)} trading days on record):
{csv_data}

Below is a market-wide snapshot: the most recent trading day on record for every company and \
bond on the exchange, one row each, as CSV:
{snapshot_csv}

Field notes:
- close_price / avg_price / high_price / low_price are in MKD.
- daily_change_pct is the close-to-close percentage change.
- sma_5 / sma_20 are simple moving averages of close_price over 5 and 20 trading days.
- momentum_5d_pct / momentum_20d_pct are percentage price change over that trailing window.
- volatility_20d_pct is 20-day realized volatility.
- liquidity_ratio_20d compares recent volume to its 20-day average.
- trend_signal is descriptive only (e.g. above_trend, crossover_up) -- it is not a recommendation.
- Bonds on the MSE trade very rarely: many rows will have null avg_price/volume and \
insufficient_data for the stock-style indicators. That's expected, not missing data -- for \
bonds, avg_price (the quoted price vs. its par value of 100) is the most meaningful field.
- The market-wide snapshot only has each listing's latest values, no history -- for deeper, \
day-by-day history you only have it for the currently-viewed listing (the first table above). \
If asked for historical detail on a different company, say you only have its latest snapshot.

Answer the user's questions using only the data above. Be concise and specific, citing actual \
numbers and dates when useful. If something isn't answerable from this data, say so plainly \
instead of guessing. Do not give personalized investment, buy, or sell advice -- you may \
describe what the data shows, but if a question drifts toward "should I buy/sell", note that \
this is informational only, not financial advice.

You're replying inside a small chat bubble in the app, not a document. Write in plain, \
conversational prose only -- no markdown at all: no headings, no bold/italic asterisks, no \
bullet or numbered lists, no horizontal rules, no tables. Use line breaks between short \
paragraphs if needed, nothing fancier. Keep it tight -- a few sentences unless the user \
explicitly asks for a detailed breakdown."""


def _stream_gemini_reply(system_prompt: str, contents: list[dict]):
    try:
        with requests.post(
            GEMINI_STREAM_URL,
            params={"key": GEMINI_API_KEY, "alt": "sse"},
            json={
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "contents": contents,
            },
            timeout=30,
            stream=True,
        ) as resp:
            resp.raise_for_status()
            buffer = b""
            for raw_chunk in resp.iter_content(chunk_size=None):
                buffer += raw_chunk
                while b"\n" in buffer:
                    line_bytes, buffer = buffer.split(b"\n", 1)
                    line = line_bytes.decode("utf-8").rstrip("\r")
                    if not line or not line.startswith("data: "):
                        continue
                    chunk = json.loads(line[len("data: "):])
                    try:
                        text = chunk["candidates"][0]["content"]["parts"][0]["text"]
                    except (KeyError, IndexError):
                        continue
                    yield text
    except Exception:
        log.exception("Gemini chat request failed")
        yield "Sorry, I couldn't reach Gemini just now. Please try again."


@app.post("/companies/{company_id}/chat")
def company_chat(company_id: int, payload: ChatRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(500, "Chat is not configured (missing GEMINI_API_KEY).")

    company, rows = _fetch_chat_context(company_id)
    snapshot = _fetch_market_snapshot()
    system_prompt = _build_chat_system_prompt(company, rows, snapshot)

    contents = [{"role": m.role, "parts": [{"text": m.content}]} for m in payload.history]
    contents.append({"role": "user", "parts": [{"text": payload.message}]})

    # Content-Encoding: identity opts out of GZipMiddleware, which buffers
    # streamed chunks and would make the reply arrive all at once.
    return StreamingResponse(
        _stream_gemini_reply(system_prompt, contents),
        media_type="text/plain",
        headers={"Content-Encoding": "identity", "Cache-Control": "no-store"},
    )