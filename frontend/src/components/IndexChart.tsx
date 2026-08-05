import { useState } from "react";
import type { IndexSeriesPoint, MseIndex } from "../api/client";
import PriceChart from "./PriceChart";

interface IndexChartProps {
  codes: string[];
  seriesByCode: Record<string, IndexSeriesPoint[]>;
  latestByCode: Record<string, MseIndex>;
}

function IndexChart({ codes, seriesByCode, latestByCode }: IndexChartProps) {
  const [activeCode, setActiveCode] = useState(codes[0]);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const series = seriesByCode[activeCode] ?? [];
  const latest = latestByCode[activeCode];

  return (
    <div className="card rounded-0 p-0 overflow-hidden" style={{ maxWidth: "590px"}}>
      <div className="d-flex border-bottom" style={{ borderColor: "var(--brand-ink)" }}>
        {codes.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => {
              setActiveCode(code);
              setHoverIndex(null);
            }}
            className={`index-widget-tab ${code === activeCode ? "active" : ""}`}
          >
            {code}
          </button>
        ))}
      </div>

      {latest && (
        <PriceChart
          label={activeCode}
          series={series}
          latestValue={latest.value}
          changePct={latest.change_pct}
          asOfDate={latest.trading_date}
          dayMax={latest.day_max}
          dayMin={latest.day_min}
          hoverIndex={hoverIndex}
          onHoverIndex={setHoverIndex}
          lineColor="#161616"
          areaColor="rgba(37, 99, 235, 0.14)"
          compact
          height={300}
        />
      )}
    </div>
  );
}

export default IndexChart;
