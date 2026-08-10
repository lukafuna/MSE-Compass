import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getScreener, type ScreenerRow } from "../api/client";
import SkeletonTable from "../components/SkeletonTable";

function trendBadgeClass(signal: string | null): string {
  switch (signal) {
    case "crossover_up": return "badge bg-success";
    case "crossover_down": return "badge bg-danger";
    case "above_trend": return "badge bg-success-subtle text-success-emphasis border border-success-subtle";
    case "below_trend": return "badge bg-danger-subtle text-danger-emphasis border border-danger-subtle";
    default: return "badge bg-light text-dark";
  }
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

function cmpNullableNumber(a: number | null, b: number | null, dir: "asc" | "desc"): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1; // nulls always last, regardless of direction
  if (b === null) return -1;
  return dir === "asc" ? a - b : b - a;
}

// Three-state cycle: off (default/unsorted) -> desc -> asc -> off -> ...
type SortState = "off" | "desc" | "asc";

const DEFAULT_ROW_COUNT = 10;

function ScreenerPage() {
  const [rows, setRows] = useState<ScreenerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortState, setSortState] = useState<SortState>("off");

  useEffect(() => {
    getScreener()
      .then(setRows)
      .finally(() => setLoading(false));
  }, []); // empty array = run once, when the page first loads

  if (loading) {
    return (
      <div className="w-100 flex-grow-1 d-flex flex-column">
        <div className="bg-body-secondary py-4 w-100 flex-grow-1">
          <div className="container">
            <h2 className="mb-3">MSE Stocks</h2>
            <input
              type="text"
              className="form-control mb-3"
              placeholder="Search by company name..."
              disabled
            />
            <div className="results-area">
              <SkeletonTable columns={9} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  function toggleSort() {
    setSortState((s) => (s === "off" ? "desc" : s === "desc" ? "asc" : "off"));
  }

  const sortIndicator = sortState === "desc" ? " ▼" : sortState === "asc" ? " ▲" : " ⇵";

  // Filter by name (case-insensitive), matches typed anywhere in the name
  const filtered = search.trim()
    ? rows.filter((row) =>
        row.name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : rows;

  const sorted = sortState === "off"
    ? filtered
    : [...filtered].sort((a, b) => cmpNullableNumber(a.daily_change_pct, b.daily_change_pct, sortState));

  // Always cap to the first 10 matches, searching or not.
  const visibleRows = sorted.slice(0, DEFAULT_ROW_COUNT);

  return (
    <div className="w-100 flex-grow-1 d-flex flex-column">
      <div className="bg-body-secondary py-4 w-100 flex-grow-1">
        <div className="container">
          <h2 className="mb-3">MSE Stocks</h2>

          <input
            type="text"
            className="form-control mb-3"
            placeholder="Search by company name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="results-area">
            <table className="table table-striped table-hover bg-white">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Date</th>
                  <th>Close</th>
                  <th>Avg Price</th>
                  <th role="button" className="user-select-none" onClick={toggleSort}>
                    Daily Chg%{sortIndicator}
                  </th>
                  <th>Momentum 5d</th>
                  <th>Momentum 20d</th>
                  <th>Volatility 20d</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link className="brand-link" to={`/company/${row.id}`}>{row.name}</Link>
                    </td>
                    <td>{row.trading_date}</td>
                    <td>{row.close_price}</td>
                    <td>{row.avg_price ?? "—"}</td>
                    <td className={(row.daily_change_pct ?? 0) < 0 ? "text-danger" : "text-success"}>
                      {row.daily_change_pct !== null
                        ? `${(row.daily_change_pct ?? 0) < 0 ? "↓" : "↑"} ${row.daily_change_pct.toFixed(2)}%`
                        : "—"}
                    </td>
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

            {search.trim() && filtered.length === 0 && (
              <p className="text-muted">No companies match "{search}".</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ScreenerPage;