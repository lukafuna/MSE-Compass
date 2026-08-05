import { useEffect, useState } from "react";
import { getCompanies } from "../api/client";

function AboutPage() {
  const [stockCount, setStockCount] = useState<number | null>(null);
  const [bondCount, setBondCount] = useState<number | null>(null);

  useEffect(() => {
    getCompanies()
      .then((companies) => {
        setStockCount(companies.filter((c) => c.instrument_type === "stock").length);
        setBondCount(companies.filter((c) => c.instrument_type === "bond").length);
      })
      .catch(() => {
        setStockCount(null);
        setBondCount(null);
      });
  }, []);

  return (
    <div className="w-100 flex-grow-1 d-flex flex-column">
      <div className="bg-body-secondary py-5 w-100 flex-grow-1">
        <div className="container-fluid px-4">
          <h1 className="mb-5 font-display text-center">About MSE Compass</h1>

          <div className="row g-4">
            <div className="col-lg-6">
              <div className="card rounded-0 border-0 p-4 h-100">
                <h2 className="h4 mb-2">What we track</h2>
                <p className="text-muted mb-0">
                  Daily prices for every listed stock and bond, the MBI10 and
                  OMB indexes, and news from both the MSE itself and global
                  markets. On top of the raw prices, we compute moving
                  averages, momentum, volatility, and trend signals for each
                  company.
                </p>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card rounded-0 border-0 p-4 h-100">
                <h2 className="h4 mb-2">How it works</h2>
                <p className="text-muted mb-0">
                  A scraper pulls the exchange's official daily report each
                  trading day, along with index and news data. From that
                  history we calculate the indicators shown across the site.
                  Stocks update daily; bonds trade thinly enough that we
                  refresh them on a slower, monthly cadence.
                </p>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card rounded-0 border-0 p-4 h-100">
                <h2 className="h4 mb-2">Data sources</h2>
                <p className="text-muted mb-0">
                  Stock, bond, and index prices come straight from the
                  Macedonian Stock Exchange's own published reports and
                  indicies pages. MSE news comes from the exchange's news
                  feed; global market news is pulled from Finnhub.
                </p>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="card rounded-0 border-0 p-4 h-100">
                <h2 className="h4 mb-2">Disclaimer</h2>
                <p className="text-muted mb-0">
                  Data shown on this site is for informational purposes only
                  and is not investment advice.
                </p>
              </div>
            </div>
          </div>


           <div className="row row-cols-2 row-cols-md-4 g-3 my-4">
             <div className="col">
              <div className="card text-center p-3 h-100">
                <p className="text-muted small text-uppercase mb-1">Updates</p>
                <p className="fs-3 fw-bold mb-0">Daily</p>
                <p className="text-muted small mb-0">stocks &amp; indexes</p>
              </div>
            </div>
            <div className="col">
              <div className="card text-center p-3 h-100">
                <p className="text-muted small text-uppercase mb-1">Stocks Tracked</p>
                <p className="fs-3 fw-bold mb-0">{stockCount ?? "—"}</p>
              </div>
            </div>
            <div className="col">
              <div className="card text-center p-3 h-100">
                <p className="text-muted small text-uppercase mb-1">Bonds Tracked</p>
                <p className="fs-3 fw-bold mb-0">{bondCount ?? "—"}</p>
              </div>
            </div>
            <div className="col">
              <div className="card text-center p-3 h-100">
                <p className="text-muted small text-uppercase mb-1">Market Indexes</p>
                <p className="fs-3 fw-bold mb-0">2</p>
                <p className="text-muted small mb-0">MBI10 &amp; OMB</p>
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

export default AboutPage;
