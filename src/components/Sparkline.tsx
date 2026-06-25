interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}

export function Sparkline({ values, width = 60, height = 18, className = "" }: SparklineProps) {
  if (values.length < 2) {
    return <span className={`inline-block text-muted-foreground/50 text-xs ${className}`}>—</span>;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(" ");
  const area = `0,${height} ${points} ${width},${height}`;
  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      <polygon points={area} fill="var(--primary)" fillOpacity={0.18} />
      <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth={1.5} />
    </svg>
  );
}
