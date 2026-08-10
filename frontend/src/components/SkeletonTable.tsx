import Skeleton from "./Skeleton";

// Mirrors the shape of the real result tables (Screener/Bonds/Company/Index
// history) so the layout doesn't jump once real rows arrive.
function SkeletonTable({ columns, rows = 10 }: { columns: number; rows?: number }) {
  return (
    <table className="table table-striped bg-white mb-0">
      <thead>
        <tr>
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i}>
              <Skeleton style={{ width: "60%", height: "0.85rem" }} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: columns }).map((_, c) => (
              <td key={c}>
                <Skeleton style={{ width: c === 0 ? "80%" : "50%", height: "0.85rem" }} />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default SkeletonTable;
