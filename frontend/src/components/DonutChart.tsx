import React from 'react';

interface DonutChartProps {
  pct: number;
  size?: number;
  color?: string;
  label?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  pct,
  size = 96,
  color = 'var(--accent)',
  label = 'concluído'
}) => {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const strokeDasharray = `${(c * pct) / 100} ${c}`;

  return (
    <div className="donut" style={{ width: `${size}px`, height: `${size}px`, position: 'relative', display: 'grid', placeItems: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--line-2)"
          strokeWidth="10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="c" style={{ position: 'absolute', textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
        <b className="num" style={{ fontSize: '18px', fontWeight: 800 }}>{pct}%</b>
        <small style={{ fontSize: '10px', color: 'var(--muted)' }}>{label}</small>
      </div>
    </div>
  );
};
