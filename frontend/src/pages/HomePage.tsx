import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getScreener,
  getIndexes,
  getIndexSeries,
  type ScreenerRow,
  type MseIndex,
  type IndexSeriesPoint,
} from "../api/client";
import IndexChart from "../components/IndexChart";

const INDEX_CODES = ["MBI10", "OMB"];

function directionClass(pct: number | null): string {
  return (pct ?? 0) < 0 ? "loss" : "gain";
}

function directionArrow(pct: number | null): string {
  return (pct ?? 0) < 0 ? "↓" : "↑";
}

function MoverCard({ row }: { row: ScreenerRow }) {
  return (
    <Link to={`/company/${row.id}`} className="text-decoration-none">
      <div className="card rounded-0 mover-card h-100 text-center">
        <p className="mover-name mb-1">{row.name}</p>
        <p className={`mover-value mb-0 ${directionClass(row.momentum_5d_pct)}`}>
          {directionArrow(row.momentum_5d_pct)}{" "}
          {row.momentum_5d_pct?.toFixed(2) ?? "—"}%
        </p>
      </div>
    </Link>
  );
}

function HomePage() {
  const [topGainers, setTopGainers] = useState<ScreenerRow[]>([]);
  const [topLosers, setTopLosers] = useState<ScreenerRow[]>([]);
  const [mseIndexes, setMseIndexes] = useState<MseIndex[]>([]);
  const [seriesByCode, setSeriesByCode] = useState<Record<string, IndexSeriesPoint[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getScreener(),
      getIndexes(),
      getIndexSeries("MBI10"),
      getIndexSeries("OMB"),
    ])
      .then(([screenerRows, indexRows, mbi10Rows, ombRows]) => {

        const withMomentum = screenerRows.filter((r) => r.momentum_5d_pct !== null);
        const sortedDesc = [...withMomentum].sort(
          (a, b) => (b.momentum_5d_pct ?? 0) - (a.momentum_5d_pct ?? 0)
        );
        const sortedAsc = [...withMomentum].sort(
          (a, b) => (a.momentum_5d_pct ?? 0) - (b.momentum_5d_pct ?? 0)
        );
        setTopGainers(sortedDesc.slice(0, 3));
        setTopLosers(sortedAsc.slice(0, 3));
        setMseIndexes(indexRows);
        setSeriesByCode({ MBI10: mbi10Rows, OMB: ombRows });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="container-fluid px-4 mt-4">Loading...</p>;

  const latestByCode = Object.fromEntries(mseIndexes.map((idx) => [idx.index_code, idx]));

  return (
    <div className="w-100 flex-grow-1 d-flex flex-column bg-body-secondary">
      {/* Hero */}
      <div className="w-100 py-5">
        <div className="container-fluid px-4">
          <div className="row align-items-center mb-5 ms-5">
            <div className="col-lg-6 mb-4 mb-lg-0">
              <h1 className="font-display fw-bold mb-4" style={{ fontSize: "3.25rem", lineHeight: 1.05 }}>
                Smarter Decisions Start with Better Data
              </h1>
              <p className="text-muted mb-5" style={{ maxWidth: "560px" }}>
                A centralized platform for daily prices, market indices, technical
                indicators and company performance — market data made accessible
                so you can make informed decisions. MSE Compass transforms complex market data into clear,
                actionable insights, helping investors track trends, compare companies, monitor portfolio performance,
                and make well-informed investment decisions with confidence.
              </p>
              <div className="d-flex gap-3">
                <Link to="/stocks" className="btn btn-brand text-decoration-none">
                    MSE Stocks
                </Link>
                <Link to="/news" className="btn-outline-ink text-decoration-none">
                  Latest News
                </Link>
              </div>
            </div>
            <div className="col-lg-6">
              <IndexChart codes={INDEX_CODES} seriesByCode={seriesByCode} latestByCode={latestByCode} />
            </div>
          </div>

          <div className="mb-5">
            <h2 className="fw-bold mb-4 text-center font-display">MSE Indexes</h2>
            <div className="d-flex justify-content-center flex-wrap gap-3">
              {mseIndexes.map((idx) => (
                <Link to={`/index/${idx.index_code}`} className="card rounded-0 index-compare-item table-bordered" key={idx.index_code}>
                  <div>
                    <p className=" mb-0 text-center">{idx.index_code}</p>
                  </div>
                  <p className="index-compare-value mb-0 text-center">
                    {idx.value}{" "}
                    <span className={`index-compare-change ${idx.change_pct ? directionClass(idx.change_pct) : "neutral"}`}>
                      {idx.change_pct ? directionArrow(idx.change_pct) : "→"}{" "}
                      {idx.change_pct !== null ? `${idx.change_pct.toFixed(2)}%` : "no data"}
                    </span>
                  </p>
                </Link>
              ))}
            </div>
          </div>

          <div className="text-center ">
            <div className="section-divider mx-auto mb-3 w-100"></div>
            <h2 className="fw-bold mb-4 font-display ">Highest MSE Movers Today</h2>
            <div className="section-divider mx-auto mb-5 w-100"></div>
          </div>


          <div className="row">
            <div className="col-md-6 mb-4 mb-md-0">
              <h2 className="fw-bold mb-5 text-center font-display">Top Gainers</h2>
              <div className="d-flex flex-column gap-3">
                {topGainers.map((row) => (
                  <MoverCard row={row} key={row.id} />
                ))}
              </div>
            </div>
            <div className="col-md-6">
              <h2 className="fw-bold mb-5 text-center font-display">Top Losers</h2>
              <div className="d-flex flex-column gap-3 ">
                {topLosers.map((row) => (
                  <MoverCard row={row} key={row.id} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
