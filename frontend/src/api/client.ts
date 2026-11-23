import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
});

// In-memory cache for read requests. The data only changes once a day (the
// scrape job), so pages that need the same thing -- e.g. /companies on the
// About, Company and Search pages, or revisiting a page -- reuse the first
// response instead of going back to the API. Concurrent identical requests
// share one in-flight promise; failures are dropped so they can be retried.
const GET_CACHE_TTL_MS = 5 * 60 * 1000;
const getCache = new Map<string, { expires: number; promise: Promise<unknown> }>();

function cachedGet<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const key = `${url}?${JSON.stringify(params ?? {})}`;
  const hit = getCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.promise as Promise<T>;

  const promise = api.get<T>(url, { params }).then((r) => r.data);
  getCache.set(key, { expires: Date.now() + GET_CACHE_TTL_MS, promise });
  promise.catch(() => getCache.delete(key));
  return promise;
}

export interface Company {
  id: number;
  name: string;
  instrument_type: string;
}

export interface CompanySeriesPoint {
  trading_date: string;
  close_price: number;
  avg_price: number | null;
  daily_change_pct: number | null;
  high_price: number | null;
  low_price: number | null;
  volume: number;
  sma_5: number | null;
  sma_20: number | null;
  momentum_5d_pct: number | null;
  momentum_20d_pct: number | null;
  volatility_20d_pct: number | null;
  liquidity_ratio_20d: number | null;
  trend_signal: string;
}

export interface ScreenerRow {
  id: number;
  name: string;
  trading_date: string;
  close_price: number;
  avg_price: number | null;
  daily_change_pct: number | null;
  momentum_5d_pct: number | null;
  momentum_20d_pct: number | null;
  volatility_20d_pct: number | null;
  trend_signal: string | null;
}

export interface BondRow {
  id: number;
  name: string;
  as_of_date: string | null;
  last_price: number | null;
}


export interface NewsArticle {
  id: number;
  headline: string;
  category: string | null;
  summary: string | null;
  source: string | null;
  url: string;
  image_url: string | null;
  published_at: string;
}


export interface MseIndex {
  index_code: string;
  index_type: string;
  trading_date: string;
  value: number;
  change_pct: number | null;
  absolute_change: number | null;
  open_value: number | null;
  day_max: number | null;
  day_min: number | null;
  market_cap_mkd: number | null;
  pe_ratio: number | null;
  pb_ratio: number | null;
}

export interface IndexSeriesPoint {
  trading_date: string;
  index_type: string;
  value: number;
  change_pct: number | null;
  absolute_change: number | null;
  open_value: number | null;
  day_max: number | null;
  day_min: number | null;
  market_cap_mkd: number | null;
  pe_ratio: number | null;
  pb_ratio: number | null;
}


export async function getCompanies(): Promise<Company[]> {
  return cachedGet<Company[]>("/companies");
}

export async function getCompanySeries(
  companyId: number,
  since?: string
): Promise<CompanySeriesPoint[]> {
  return cachedGet<CompanySeriesPoint[]>(`/companies/${companyId}/series`, since ? { since } : {});
}

export async function getScreener(): Promise<ScreenerRow[]> {
  return cachedGet<ScreenerRow[]>("/screener");
}

export async function getBonds(): Promise<BondRow[]> {
  return cachedGet<BondRow[]>("/bonds");
}

export async function getIndexes(): Promise<MseIndex[]> {
  return cachedGet<MseIndex[]>("/indexes");
}

export async function getIndexSeries(
  indexCode: string,
  since?: string
): Promise<IndexSeriesPoint[]> {
  return cachedGet<IndexSeriesPoint[]>(`/indexes/${indexCode}/series`, since ? { since } : {});
}

export async function getNews(region: "mse" | "global", limit = 100): Promise<NewsArticle[]> {
  return cachedGet<NewsArticle[]>("/news", { region, limit });
}

export async function sendContactMessage(payload: {
  name: string;
  email: string;
  message: string;
}): Promise<void> {
  await api.post("/contact", payload);
}

export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

export async function sendCompanyChatStream(
  companyId: number,
  message: string,
  history: ChatMessage[],
  onChunk: (text: string) => void
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/companies/${companyId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  if (!response.ok || !response.body) {
    throw new Error("Couldn't reach Gemini.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}