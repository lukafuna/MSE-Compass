function directionClass(pct: number | null): string {
  return (pct ?? 0) < 0 ? "text-danger" : "text-success";
}

function directionArrow(pct: number | null): string {
  return (pct ?? 0) < 0 ? "↓" : "↑";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`;
}

const WIDTH = 900;
const DEFAULT_HEIGHT = 260;
const PAD_LEFT = 60;
const PAD_TOP = 12;
const PAD_BOTTOM = 24;
const CHART_WIDTH = WIDTH - PAD_LEFT;
const GRID_LINES = 5;
const X_TICKS = 5;

export interface PricePoint {
  trading_date: string;
  value: number;
}

export interface PriceChartProps {
  label: string;
  series: PricePoint[];
  latestValue: number | null;
  changePct: number | null;
  asOfDate: string;
  dayMax?: number | null;
  dayMin?: number | null;
  hoverIndex: number | null;
  onHoverIndex: (index: number | null) => void;
  /** Line/point color override (default matches the existing slate look). */
  lineColor?: string;
  /** When set, fills the area under the line with this color. */
  areaColor?: string;
  /** Compact mode: no per-point dots, no axis tick labels -- just the line
   *  and its dashed gridlines, for use in small widgets like the homepage
   *  hero. Defaults to false so existing full-size charts are unaffected. */
  compact?: boolean;
  /** SVG viewBox height (default 260). Width stays fixed; a taller value
   *  just gives the line more vertical room. */
  height?: number;
}

function PriceChart({
  series,
  latestValue,
  changePct,
  asOfDate,
  dayMax,
  dayMin,
  hoverIndex,
  onHoverIndex,
  lineColor = "#495464",
  areaColor,
  compact = false,
  height = DEFAULT_HEIGHT,
}: PriceChartProps) {
  const chartHeight = height - PAD_TOP - PAD_BOTTOM;

  const values = series.map((p) => p.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = max - min || 1;

  const xFor = (i: number) => PAD_LEFT + (i / (series.length - 1)) * CHART_WIDTH;
  const yFor = (v: number) => PAD_TOP + chartHeight - ((v - min) / range) * chartHeight;

  const points = series.map((p, i) => `${xFor(i)},${yFor(p.value)}`).join(" ");

  const gridValues = Array.from({ length: GRID_LINES + 1 }, (_, i) => min + (range * i) / GRID_LINES);
  const tickIndexes = Array.from({ length: X_TICKS }, (_, i) =>
    Math.round(((series.length - 1) * i) / (X_TICKS - 1))
  );

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (series.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const ratio = Math.min(Math.max((mouseX - PAD_LEFT) / CHART_WIDTH, 0), 1);
    onHoverIndex(Math.round(ratio * (series.length - 1)));
  }

  const hoverPoint = hoverIndex !== null ? series[hoverIndex] : null;

  return (
    <div className="p-3">
      <div className="d-flex justify-content-between align-items-baseline flex-wrap mb-3 gap-2">
        <div>
          <span className="fw-bold me-2">{latestValue ?? "—"}</span>
          <span className={directionClass(changePct)}>
            {changePct?.toFixed(2) ?? "—"}% {directionArrow(changePct)}
          </span>

        </div>
        <span className=" text-muted small ms-2">{formatDate(asOfDate)}</span>
        {(dayMax != null || dayMin != null) && (
          <div className="text-muted small">
            Max: {dayMax ?? "—"} &nbsp; Min: {dayMin ?? "—"}
          </div>
        )}
      </div>

      {series.length > 1 ? (
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          className="w-100"
          style={{ aspectRatio: `${WIDTH} / ${height}`, height: "auto", maxWidth: "100%", display: "block" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => onHoverIndex(null)}
        >
          {gridValues.map((v, i) => {
            const y = yFor(v);
            return (
              <g key={i}>
                <line x1={PAD_LEFT} y1={y} x2={WIDTH} y2={y} stroke="#dee2e6" strokeDasharray="3,3" />
                {!compact && (
                  <text x={PAD_LEFT - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#6c757d">
                    {v.toFixed(2)}
                  </text>
                )}
              </g>
            );
          })}

          {!compact &&
            tickIndexes.map((idx, i) => (
              <text key={i} x={xFor(idx)} y={height - 4} textAnchor="middle" fontSize="10" fill="#6c757d">
                {formatDate(series[idx].trading_date)}
              </text>
            ))}

          {areaColor && (
            <polygon
              points={`${PAD_LEFT},${height - PAD_BOTTOM} ${points} ${WIDTH},${height - PAD_BOTTOM}`}
              fill={areaColor}
              stroke="none"
            />
          )}
          <polyline points={points} fill="none" stroke={lineColor} strokeWidth="1.5" />
          {!compact &&
            series.map((p, i) => (
              <circle key={i} cx={xFor(i)} cy={yFor(p.value)} r="2" fill={lineColor} />
            ))}

          {hoverPoint && hoverIndex !== null && (
            <g>
              <line
                x1={xFor(hoverIndex)}
                y1={PAD_TOP}
                x2={xFor(hoverIndex)}
                y2={height - PAD_BOTTOM}
                stroke="#adb5bd"
              />
              {(() => {
                const tw = 110;
                const th = 36;
                let tx = xFor(hoverIndex) + 8;
                if (tx + tw > WIDTH) tx = xFor(hoverIndex) - tw - 8;
                const ty = PAD_TOP + 4;
                return (
                  <g>
                    <rect x={tx} y={ty} width={tw} height={th} fill="#495464" opacity="0.9" rx="3" />
                    <text x={tx + 6} y={ty + 14} fontSize="10" fill="#fff">
                      {formatDate(hoverPoint.trading_date)}
                    </text>
                    <text x={tx + 6} y={ty + 28} fontSize="11" fill="#fff" fontWeight="bold">
                      {hoverPoint.value}
                    </text>
                  </g>
                );
              })()}
            </g>
          )}
        </svg>
      ) : (
        <div className="d-flex align-items-center justify-content-center text-muted" style={{ minHeight: "200px" }}>
          No history yet
        </div>
      )}
    </div>
  );
}

export default PriceChart;
