import type { CSSProperties } from "react";

function Skeleton({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return <span className={`skeleton d-inline-block ${className}`} style={style} />;
}

export default Skeleton;
