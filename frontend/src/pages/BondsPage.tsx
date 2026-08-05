import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getBonds, type BondRow } from "../api/client";

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

const DEFAULT_ROW_COUNT = 10;

function BondsPage() {
  const [rows, setRows] = useState<BondRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getBonds()
      .then(setRows)
      .finally(() => setLoading(false));
  }, []); // empty array = run once, when the page first loads

  if (loading) return <p className="container mt-4">Loading...</p>;

  // Filter by name (case-insensitive), matches typed anywhere in the name
  const filtered = search.trim()
    ? rows.filter((row) =>
        row.name.toLowerCase().includes(search.trim().toLowerCase())
      )
    : rows;

  // Always cap to the first 10 matches. The API already sorts bonds with a
  // recent quote first, so this stays useful rather than surfacing 10
  // never-quoted bonds.
  const visibleRows = filtered.slice(0, DEFAULT_ROW_COUNT);

  return (
    <div className="w-100 flex-grow-1 d-flex flex-column">
      <div className="bg-body-secondary py-4 w-100 flex-grow-1">
        <div className="container">
          <h2 className="mb-3">MSE Bonds</h2>

          <input
            type="text"
            className="form-control mb-3"
            placeholder="Search by bond name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="results-area">
            <table className="table table-striped table-hover bg-white">
              <thead>
                <tr>
                  <th>Bond</th>
                  <th>Last Quoted Price</th>
                  <th>As Of</th>
                  <th>vs Par (100)</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link className="brand-link" to={`/company/${row.id}`}>{row.name}</Link>
                    </td>
                    <td>{row.last_price ?? "—"}</td>
                    <td>{row.as_of_date ?? "—"}</td>
                    <td>
                      <span className={parBadgeClass(row.last_price)}>
                        {parLabel(row.last_price)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {search.trim() && filtered.length === 0 && (
              <p className="text-muted">No bonds match "{search}".</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BondsPage;
