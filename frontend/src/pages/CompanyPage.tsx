import { useEffect, useState, type ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getCompanies,
  getCompanySeries,
  type Company,
  type CompanySeriesPoint,
} from "../api/client";
import PriceChart from "../components/PriceChart";
import CompanyChat from "../components/CompanyChat";

function trendBadgeClass(signal: string | null): string {
  switch (signal) {
    case "crossover_up": return "badge bg-success";
    case "crossover_down": return "badge bg-danger";
    case "above_trend": return "badge bg-success-subtle text-success-emphasis border border-success-subtle";
    case "below_trend": return "badge bg-danger-subtle text-danger-emphasis border border-danger-subtle";
    default: return "badge bg-light text-dark";
  }
}

function StatRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="d-flex justify-content-between align-items-center py-2 border-bottom">
      <span className="text-muted small">{label}</span>
      <span className={`fw-bold text-end ${valueClassName ?? ""}`}>{value}</span>
    </div>
  );
}

function trendArrow(signal: string | null): string {
  switch (signal) {
    case "crossover_up":
    case "above_trend":
      return "↑ ";
    case "crossover_down":
    case "below_trend":
      return "↓ ";
    default:
      return "";
  }
}

const PAR_VALUE = 100;

function parBadgeClass(price: number | null): string {
  if (price === null) return "badge bg-light text-dark";
  if (price === PAR_VALUE) return "badge bg-secondary-subtle text-secondary-emphasis border border-secondary-subtle";
  if (price > PAR_VALUE) return "badge bg-success-subtle text-success-emphasis border border-success-subtle";
  return "badge bg-danger-subtle text-danger-emphasis border border-danger-subtle";
}

function parLabel(price: number | null): string {
  if (price === null) return "No quote";
  const diffPct = ((price - PAR_VALUE) / PAR_VALUE) * 100;
  if (diffPct === 0) return "At par";
  return `${diffPct > 0 ? "↑" : "↓"} ${diffPct > 0 ? "+" : ""}${diffPct.toFixed(2)}%`;
}

const HISTORY_DAY_OPTIONS = [3, 5, 10, 20];

function CompanyPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [series, setSeries] = useState<CompanySeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [historyDays, setHistoryDays] = useState(HISTORY_DAY_OPTIONS[0]);
  const [chartHoverIndex, setChartHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!companyId) return;
    const id = Number(companyId);

    setLoading(true);
    setNotFound(false);

    Promise.all([
      getCompanies().then((companies) => companies.find((c) => c.id === id) ?? null),
      getCompanySeries(id).catch(() => null),
    ])
      .then(([companyRow, seriesRows]) => {
        setCompany(companyRow);
        setSeries(seriesRows ?? []);
        if (!seriesRows) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [companyId]);

  if (loading) return <p className="container-fluid px-4 mt-4">Loading...</p>;

  if (notFound || series.length === 0) {
    return (
      <div className="w-100 flex-grow-1 d-flex flex-column">
        <div className="bg-body-secondary py-4 w-100 flex-grow-1">
          <div className="container-fluid px-4">
            <p>No data available for this company.</p>
            <Link to="/stocks">Back to Screener</Link>
          </div>
        </div>
      </div>
    );
  }

  const isBond = company?.instrument_type === "bond";

  const latest = series[series.length - 1];
  const analyzedSeries = series.filter((row) => row.sma_20 !== null);
  const recentRows = [...analyzedSeries].reverse().slice(0, 20);

  const pricedRows = [...series].reverse().filter((row) => row.avg_price !== null);
  const latestPriced = pricedRows[0] ?? null;
  const bondChartSeries = series
    .filter((row) => row.avg_price !== null)
    .map((row) => ({ trading_date: row.trading_date, value: row.avg_price as number }));
  const historyRows = isBond ? pricedRows : recentRows;

  return (
    <div className="w-100 flex-grow-1 d-flex flex-column">
      <div className="bg-body-secondary py-5 w-100 flex-grow-1">
        <div className="container-fluid px-4">
          <h1 className="mb-5">{company?.name ?? `Company #${companyId}`}</h1>

          <div className="row g-4 mb-4">
            <div className="col-lg-6">
              <div className="card  rounded-0 p-4 h-100">
                {isBond ? (
                  <>
                    <h6 className="text-muted text-uppercase small mb-2">Bond Snapshot</h6>
                    <StatRow label="Last Quoted Price" value={latestPriced?.avg_price ?? "—"} />
                    <StatRow label="As Of" value={latestPriced?.trading_date ?? "—"} />
                    <StatRow
                      label="vs Par (100)"
                      value={
                        <span className={parBadgeClass(latestPriced?.avg_price ?? null)}>
                          {parLabel(latestPriced?.avg_price ?? null)}
                        </span>
                      }
                    />
                  </>
                ) : (
                  <>
                    <h6 className="fw-bold text-muted text-uppercase small mb-3">Price</h6>
                    <StatRow
                      label="Avg Price (MSE)"
                      value={
                        <>
                          {latest.avg_price ?? "—"}{" "}
                          <span className={`small ${(latest.daily_change_pct ?? 0) < 0 ? "text-danger" : "text-success"}`}>
                            {(latest.daily_change_pct ?? 0) < 0 ? "↓" : "↑"} {latest.daily_change_pct?.toFixed(2) ?? "—"}%
                          </span>
                        </>
                      }
                    />
                    <StatRow label="Close Price" value={latest.close_price} />

                    <h6 className=" fw-bold text-muted text-uppercase small mb-3 mt-4">Momentum &amp; Trend</h6>

                     <StatRow
                      label="Trend"
                      value={
                        <span className={trendBadgeClass(latest.trend_signal)}>
                          {trendArrow(latest.trend_signal)}{latest.trend_signal ?? "insufficient_data"}
                        </span>
                      }
                    />
                    <StatRow
                      label="Momentum (5d)"
                      value={`${latest.momentum_5d_pct?.toFixed(2) ?? "—"}%`}
                      valueClassName={(latest.momentum_5d_pct ?? 0) < 0 ? "text-danger" : "text-success"}
                    />
                    <StatRow
                      label="Momentum (20d)"
                      value={`${latest.momentum_20d_pct?.toFixed(2) ?? "—"}%`}
                      valueClassName={(latest.momentum_20d_pct ?? 0) < 0 ? "text-danger" : "text-success"}
                    />


                    <h6 className=" fw-bold text-muted text-uppercase small mb-3 mt-4">Technicals</h6>
                    <StatRow label="SMA 5" value={latest.sma_5?.toFixed(2) ?? "—"} />
                    <StatRow label="SMA 20" value={latest.sma_20?.toFixed(2) ?? "—"} />
                    <StatRow label="Volatility (20d)" value={`${latest.volatility_20d_pct?.toFixed(2) ?? "—"}%`} />
                    <StatRow label="Liquidity (20d)" value={latest.liquidity_ratio_20d?.toFixed(2) ?? "—"} />
                  </>
                )}
              </div>
            </div>

            <div className="col-lg-6">

              <div className={`card rounded-0 p-0 overflow-hidden ${isBond ? "h-100" : ""}`}>
                {isBond ? (
                  <PriceChart
                    label={company?.name ?? `Company #${companyId}`}
                    series={bondChartSeries}
                    latestValue={latestPriced?.avg_price ?? null}
                    changePct={null}
                    asOfDate={latestPriced?.trading_date ?? ""}
                    hoverIndex={chartHoverIndex}
                    onHoverIndex={setChartHoverIndex}
                  />
                ) : (
                  <PriceChart
                    label={company?.name ?? `Company #${companyId}`}
                    series={series.map((row) => ({ trading_date: row.trading_date, value: row.close_price }))}
                    latestValue={latest.close_price}
                    changePct={latest.daily_change_pct}
                    asOfDate={latest.trading_date}
                    dayMax={latest.high_price}
                    dayMin={latest.low_price}
                    hoverIndex={chartHoverIndex}
                    onHoverIndex={setChartHoverIndex}
                  />
                )}
              </div>

              {!isBond && (
                <div className="mt-4 ">
                  <CompanyChat
                    companyId={Number(companyId)}
                    companyName={company?.name ?? `Company #${companyId}`}
                  />
                </div>
              )}
            </div>
          </div>

          {isBond && (
            <div className="row g-4 mb-4">
              <div className="col-12">
                <CompanyChat companyId={Number(companyId)} companyName={company?.name ?? `Company #${companyId}`} />
              </div>
            </div>
          )}

          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="mb-0">Recent History</h2>
            {historyRows.length > HISTORY_DAY_OPTIONS[0] && (
              <select
                className="form-select form-select-sm w-auto"
                value={historyDays}
                onChange={(e) => setHistoryDays(Number(e.target.value))}
                aria-label="Number of days to show"
              >
                {HISTORY_DAY_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n} days</option>
                ))}
              </select>
            )}
          </div>
          {historyRows.length === 0 ? (
            <p className="text-muted">
              {isBond
                ? "No quoted price history yet for this bond."
                : "Not enough trading history yet for this company's 20-day analysis window."}
            </p>
          ) : isBond ? (
            <div className="table-responsive">
              <table className="table table-striped table-hover bg-white">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Price</th>
                    <th>vs Par (100)</th>
                  </tr>
                </thead>
                <tbody>
                  {pricedRows.slice(0, historyDays).map((row) => (
                    <tr key={row.trading_date}>
                      <td>{row.trading_date}</td>
                      <td>{row.avg_price}</td>
                      <td>
                        <span className={parBadgeClass(row.avg_price)}>{parLabel(row.avg_price)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover bg-white">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Close</th>
                    <th>Avg Price</th>
                    <th>Daily Chg %</th>
                    <th>Volume</th>
                    <th>Momentum 5d</th>
                    <th>Momentum 20d</th>
                    <th>Volatility 20d</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRows.slice(0, historyDays).map((row) => (
                    <tr key={row.trading_date}>
                      <td>{row.trading_date}</td>
                      <td>{row.close_price}</td>
                      <td>{row.avg_price ?? "—"}</td>
                      <td className={(row.daily_change_pct ?? 0) < 0 ? "text-danger" : "text-success"}>
                        {row.daily_change_pct !== null
                          ? `${(row.daily_change_pct ?? 0) < 0 ? "↓" : "↑"} ${row.daily_change_pct.toFixed(2)}%`
                          : "—"}
                      </td>
                      <td>{row.volume}</td>
                      <td>{row.momentum_5d_pct?.toFixed(2) ?? "—"}%</td>
                      <td>{row.momentum_20d_pct?.toFixed(2) ?? "—"}%</td>
                      <td>{row.volatility_20d_pct?.toFixed(2) ?? "—"}%</td>
                      <td>
                        <span className={trendBadgeClass(row.trend_signal)}>
                          {trendArrow(row.trend_signal)}{row.trend_signal ?? "insufficient_data"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CompanyPage;
