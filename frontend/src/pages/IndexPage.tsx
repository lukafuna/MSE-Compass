import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getIndexSeries, type IndexSeriesPoint } from "../api/client";

const HISTORY_DAY_OPTIONS = [3, 5, 10, 20];

function IndexPage() {
  const { indexCode } = useParams<{ indexCode: string }>();
  const [series, setSeries] = useState<IndexSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [historyDays, setHistoryDays] = useState(HISTORY_DAY_OPTIONS[0]);

  useEffect(() => {
    if (!indexCode) return;

    setLoading(true);
    setNotFound(false);

    getIndexSeries(indexCode)
      .then((rows) => setSeries(rows))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [indexCode]);

  if (loading) return <p className="container-fluid px-4 mt-4">Loading...</p>;

  if (notFound || series.length === 0) {
    return (
      <div className="w-100 flex-grow-1 d-flex flex-column">
        <div className="bg-body-secondary py-4 w-100 flex-grow-1">
          <div className="container-fluid px-4">
            <p>No data available for this index.</p>
            <Link to="/">Back to Home</Link>
          </div>
        </div>
      </div>
    );
  }

  const latest = series[series.length - 1];
  const recentRows = [...series].reverse().slice(0, 20);

  return (
    <div className="w-100 flex-grow-1 d-flex flex-column">
      {/* Hero section */}
      <div className="bg-body-secondary py-5 w-100 flex-grow-1">
        <div className="container-fluid px-4">
          <h1 className="mb-1 fw-bold">{indexCode}</h1>
          <p className="text-muted mb-4 text-uppercase small">{latest.index_type} index</p>

          <div className="row mb-4">
            <div className="col-md-4 mb-3 mb-md-0">
              <div className="card text-center p-3 h-100">
                <h6 className="text-muted">Value</h6>
                <p className="fs-4 mb-0">{latest.value}</p>
              </div>
            </div>
            <div className="col-md-4 mb-3 mb-md-0">
              <div className="card text-center p-3 h-100">
                <h6 className="text-muted">Change %</h6>
                <p className={`fs-4 mb-0 ${(latest.change_pct ?? 0) < 0 ? "text-danger" : "text-success"}`}>
                  {latest.change_pct?.toFixed(2) ?? "—"}%
                </p>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card text-center p-3 h-100">
                <h6 className="text-muted">Absolute Change</h6>
                <p className={`fs-4 mb-0 ${(latest.absolute_change ?? 0) < 0 ? "text-danger" : "text-success"}`}>
                  {latest.absolute_change?.toFixed(2) ?? "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="row mb-4">
            <div className="col-md-3 mb-3 mb-md-0">
              <div className="card text-center p-3 h-100">
                <h6 className="text-muted">Day Range</h6>
                <p className="fs-6 mb-0">
                  {latest.day_min ?? "—"} – {latest.day_max ?? "—"}
                </p>
              </div>
            </div>
            <div className="col-md-3 mb-3 mb-md-0">
              <div className="card text-center p-3 h-100">
                <h6 className="text-muted">Market Cap (MKD)</h6>
                <p className="fs-6 mb-0">{latest.market_cap_mkd ?? "—"}</p>
              </div>
            </div>
            <div className="col-md-3 mb-3 mb-md-0">
              <div className="card text-center p-3 h-100">
                <h6 className="text-muted">P/E Ratio</h6>
                <p className="fs-6 mb-0">{latest.pe_ratio ?? "—"}</p>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card text-center p-3 h-100">
                <h6 className="text-muted">P/B Ratio</h6>
                <p className="fs-6 mb-0">{latest.pb_ratio ?? "—"}</p>
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="mb-0">Recent History</h2>
            {recentRows.length > HISTORY_DAY_OPTIONS[0] && (
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
          <div className="table-responsive">
            <table className="table table-striped table-hover bg-white">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Value</th>
                  <th>Change %</th>
                  <th>Absolute Change</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.slice(0, historyDays).map((row) => (
                  <tr key={row.trading_date}>
                    <td>{row.trading_date}</td>
                    <td>{row.value}</td>
                    <td>{row.change_pct?.toFixed(2) ?? "—"}%</td>
                    <td>{row.absolute_change?.toFixed(2) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IndexPage;
