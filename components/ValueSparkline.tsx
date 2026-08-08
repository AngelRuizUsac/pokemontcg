import type { ValueSnapshot } from "@/lib/valueHistory";

export default function ValueSparkline({ history }: { history: ValueSnapshot[] }) {
  if (history.length < 2) return null;

  const width = 240;
  const height = 48;
  const values = history.map((s) => s.totalUsd);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = history
    .map((s, i) => {
      const x = (i / (history.length - 1)) * width;
      const y = height - ((s.totalUsd - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const trendUp = values[values.length - 1] >= values[0];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-12">
      <polyline
        points={points}
        fill="none"
        stroke={trendUp ? "#3DDC97" : "#FF6B6B"}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
