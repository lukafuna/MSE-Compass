CREATE TABLE IF NOT EXISTS market_sections (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS market_categories (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS companies (
    id               SERIAL PRIMARY KEY,
    name             VARCHAR(200) NOT NULL UNIQUE,
    section_id       INTEGER NOT NULL REFERENCES market_sections(id),
    category_id      INTEGER NOT NULL REFERENCES market_categories(id),
    instrument_type  TEXT DEFAULT 'stock'
);

CREATE TABLE IF NOT EXISTS company_ohlcv (
    id                 SERIAL PRIMARY KEY,
    company_id         INTEGER NOT NULL REFERENCES companies(id),
    trading_date       DATE NOT NULL,
    open_price         NUMERIC(12, 2),
    high_price         NUMERIC(12, 2),
    low_price          NUMERIC(12, 2),
    close_price        NUMERIC(12, 2),
    volume             BIGINT,
    turnover           NUMERIC(18, 2),
    avg_price          NUMERIC,
    daily_change_pct   NUMERIC,
    UNIQUE (company_id, trading_date)
);

CREATE TABLE IF NOT EXISTS company_analysis (
    id                     SERIAL PRIMARY KEY,
    company_id             INTEGER NOT NULL REFERENCES companies(id),
    trading_date           DATE NOT NULL,
    sma_5                  NUMERIC(12, 4),
    sma_20                 NUMERIC(12, 4),
    momentum_5d_pct        NUMERIC(9, 4),
    momentum_20d_pct       NUMERIC(9, 4),
    volatility_20d_pct     NUMERIC(9, 4),
    avg_volume_20d         NUMERIC(18, 4),
    liquidity_ratio_20d    NUMERIC(5, 4),
    trend_signal           VARCHAR(20),
    computed_at            TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (company_id, trading_date)
);

CREATE INDEX IF NOT EXISTS idx_company_analysis_company ON company_analysis (company_id);
CREATE INDEX IF NOT EXISTS idx_company_analysis_date ON company_analysis (trading_date);

CREATE TABLE IF NOT EXISTS mse_indexes (
    id                SERIAL PRIMARY KEY,
    index_code        TEXT NOT NULL,
    index_type        TEXT NOT NULL DEFAULT 'stock',
    trading_date      DATE NOT NULL,
    value             NUMERIC(14, 2) NOT NULL,
    change_pct        NUMERIC(6, 2),
    absolute_change   NUMERIC(14, 2),
    open_value        NUMERIC(14, 2),
    day_max           NUMERIC(14, 2),
    day_min           NUMERIC(14, 2),
    market_cap_mkd    NUMERIC(20, 2),
    pe_ratio          NUMERIC(8, 2),
    pb_ratio          NUMERIC(8, 2),
    scraped_at        TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (index_code, trading_date)
);
