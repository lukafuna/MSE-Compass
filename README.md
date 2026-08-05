# MSE Compass

A dashboard for the Macedonian Stock Exchange that automatically scrapes 
the official daily price lists, calculates key technical indicators—including
moving averages, momentum, volatility, and trend signals—and presents the 
results through a FastAPI backend with a React frontend.

Each listed company also features a Gemini-powered chat
that can answer questions using the company's 
historical market data while comparing it with every other company 
listed on the exchange, providing broader market context rather
than focusing on a single stock.

This platform is designed to make market data more accessible,
easier to understand and give you clear, data-driven insights.
It does not provide investment advice or 
recommendations. 

## What's actually in here

```
backend/
├── scraper/    fetches raw prices/news/indexes from MSE's site + Finnhub
├── database/   Postgres connection + schema + queries
├── analysis/   turns raw prices into SMA/momentum/volatility/trend signals
├── api/        the FastAPI app that serves it all as JSON (and runs the chat)
├── scheduler.py            keeps the pipeline running on a schedule
└── run_scheduled_job.py    same jobs (for GitHub Actions)

frontend/       the React app — company pages, screener, bonds, news, charts
```

## Running it locally

You'll need Python 3.12+, Node, and a Postgres database.

**1. Backend setup**

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your own values — a Postgres
connection, and optionally a couple of API keys (see below).

Point Postgres at the schema files once:

```powershell
psql -f backend/database/news_schema.sql
psql -f backend/database/contact_schema.sql
```

> **Heads up:** `backend/database/schema.sql` — the one that's supposed to
> create `companies`, `company_ohlcv`, `company_analysis`, and `mse_indexes`
> — is currently empty. Those tables exist in the live database some other
> way, but a from-scratch setup won't have them until that file gets its
> `CREATE TABLE` statements back. Worth fixing before anyone else tries to
> set this up.

**2. Get some data into it**

```powershell
python -m backend.main 2026-07-17 2026-07-21   # scrape a date range of prices
python backend/analysis/analysis.py            # turn prices into indicators
python -m backend.scraper.news_loader          # pull in news
python -m backend.scraper.index_parser         # pull in MBI10/OMB index history
```

Each one only needs to be run again for new dates — see "keeping it fresh"
below for the automated version of this.

**3. Run the API**

```powershell
uvicorn backend.api.main:app --reload --port 8000
```

Docs show up at `http://127.0.0.1:8000/docs` for free, courtesy of FastAPI.

**4. Run the frontend**

```powershell
cd frontend
npm install
npm run dev
```

Vite will tell you what port it landed on (usually `5173`, sometimes not if
that's already taken — either is fine, the backend accepts any localhost
port during local dev).

## Environment variables

The two you'll actually
want to go get:

- `FINNHUB_API_KEY` — for global market news. Free key at finnhub.io.
- `GEMINI_API_KEY` — for the "Ask Gemini" chat on company pages. Free key
  at aistudio.google.com/apikey.

Everything else (DB connection, SMTP for the contact form) is optional or
has defaults for local dev.

## Scheduled Jobs

`backend/scheduler.py` is a long-running process that scrapes and
recomputes on a schedule by itself, so you don't have to run those four
commands above by hand every day:

- **Weekdays at 08:05** — stock prices, the MBI10 index, and news.
- **1st of the month at 18:30** — bond prices and the OMB bond index (bonds
  barely trade day to day, so a monthly catch-up is plenty).

Start it and leave it running:

```powershell
python -m backend.scheduler
```

If a run gets missed, it self-heals next time it
runs — it always looks back a few days rather than assuming yesterday
happened.

For a hosted deployment, `backend/run_scheduled_job.py` does the same jobs
but runs once and exits, so a free scheduler like GitHub Actions can trigger
it on a cron instead of paying for a server that sits idle between runs —
see `.github/workflows/scheduled-jobs.yml`.

## Deploying

- **`Dockerfile`** — builds the backend into a container. Works anywhere
  that runs Docker images.
- **`render.yaml`**  — config for Render.
- **Frontend** — it's a static Vite build (`npm run build` → `frontend/dist`),
  so anything that serves static files works: Cloudflare Pages, Vercel,
  Netlify, all have free tiers that are more than enough for this.

Whatever you pick, set `ALLOWED_ORIGINS` on the backend to your frontend's
real URL, and `VITE_API_BASE_URL` on the frontend to your backend's real
URL — otherwise the browser's CORS policy will refuse to let
them talk to each other.

## A couple of things worth knowing

- The indicator math in `analysis.py` is pure — no database, no
  side effects — so anything (the API, a notebook, tests) can call it
  directly on a DataFrame.
- `trend_signal` values like `above_trend` or `crossover_down` are
  descriptive, not a recommendation. Nothing in the backend should ever
  say "buy" or "sell".
