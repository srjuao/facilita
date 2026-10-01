import React from 'react';

// LineChart SVG Component
interface Series {
  name: string;
  color: string;
  data: number[];
}

interface LineChartProps {
  labels: string[];
  series: Series[];
  h?: number;
  W?: number;
  fmtV?: (v: number) => string;
}

export const LineChart: React.FC<LineChartProps> = ({
  labels,
  series,
  h = 180,
  W = 500,
  fmtV = (v) => String(v)
}) => {
  const pl = 36, pr = 16, pt = 14, pb = 28;
  const allVals = series.flatMap(s => s.data);
  const minV = Math.floor(Math.min(...allVals, 0));
  const maxV = Math.ceil(Math.max(...allVals, 10));
  const n = labels.length;

  const x = (i: number) => pl + ((W - pl - pr) * i) / (n - 1);
  const y = (v: number) => pt + (h - pt - pb) * (1 - (v - minV) / (maxV - minV || 1));

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${h}`} style={{ width: '100%', height: `${h}px` }}>
      {/* Linhas de grade */}
      {[0, 0.5, 1].map((pct, idx) => {
        const val = minV + (maxV - minV) * (1 - pct);
        const yPos = pt + (h - pt - pb) * pct;
        return (
          <g key={idx}>
            <line className="gl" x1={pl} x2={W - pr} y1={yPos} y2={yPos} stroke="var(--line-2)" strokeWidth="1" />
            <text x={pl - 6} y={yPos + 4} textAnchor="end" style={{ fontSize: '11px', fill: 'var(--muted)' }}>
              {fmtV(val)}
            </text>
          </g>
        );
      })}

      {/* Rótulos X */}
      {labels.map((l, i) => (
        <text key={i} x={x(i)} y={h - 6} textAnchor="middle" style={{ fontSize: '11px', fill: 'var(--muted)' }}>
          {l}
        </text>
      ))}

      {/* Linhas dos Dados */}
      {series.map((s, sIdx) => {
        const points = s.data.map((v, i) => `${x(i)},${y(v)}`).join(' ');
        return (
          <g key={sIdx}>
            <polyline points={points} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {s.data.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="4" fill={s.color} stroke="var(--paper)" strokeWidth="2" />
            ))}
          </g>
        );
      })}
    </svg>
  );
};

// HorizontalBars Component
interface HBarRow {
  label: string;
  value: number;
  color?: string;
}

export const HorizontalBars: React.FC<{ rows: HBarRow[]; max?: number; fmtV?: (v: number) => string }> = ({
  rows,
  max = 100,
  fmtV = (v) => `${v}%`
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {rows.map((r, i) => (
        <div key={i} className="hbar" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '180px', minWidth: 0 }}>
            <i style={{ width: '10px', height: '10px', borderRadius: '3px', background: r.color || 'var(--accent)', flex: 'none' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 600 }}>
              {r.label}
            </span>
          </span>
          <div className="bar" style={{ flex: 1, height: '8px', background: 'var(--line-2)', borderRadius: '4px', overflow: 'hidden' }}>
            <i style={{ width: `${Math.min(100, (r.value / max) * 100)}%`, background: r.color || 'var(--accent)', display: 'block', height: '100%', borderRadius: '4px' }} />
          </div>
          <span className="v num" style={{ width: '45px', textAlign: 'right', fontWeight: 700, fontSize: '12px' }}>
            {fmtV(r.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

// GroupedBars Component (Semana normal vs Semana de prova)
interface GroupedBarRow {
  label: string;
  a: number;
  b: number;
}

export const GroupedBars: React.FC<{ rows: GroupedBarRow[]; W?: number }> = ({ rows, W = 440 }) => {
  const H = rows.length * 38 + 24;
  const pl = 118;
  const max = Math.max(...rows.flatMap(r => [r.a, r.b])) * 1.1 || 1;

  const w = (v: number) => ((W - pl - 40) * v) / max;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: `${H}px` }}>
      {rows.map((r, i) => {
        const y = i * 38 + 8;
        return (
          <g key={i}>
            <text x={pl - 8} y={y + 18} textAnchor="end" style={{ fill: 'var(--ink-2)', fontWeight: 600, fontSize: '12px' }}>
              {r.label}
            </text>

            <rect x={pl} y={y} width={w(r.a)} height="11" rx="3" fill="var(--navy-3)" />
            <text x={pl + w(r.a) + 6} y={y + 9} className="num" style={{ fontSize: '11px', fill: 'var(--ink)' }}>
              {r.a}
            </text>

            <rect x={pl} y={y + 14} width={w(r.b)} height="11" rx="3" fill="var(--accent)" />
            <text x={pl + w(r.b) + 6} y={y + 23} className="num" style={{ fontSize: '11px', fill: 'var(--ink)' }}>
              {r.b}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// HeatmapChart Component
export const HeatmapChart: React.FC = () => {
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const steps = ['var(--line-2)', 'var(--accent-soft)', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95'];

  return (
    <div className="hm" style={{ display: 'grid', gridTemplateColumns: '40px repeat(12, 1fr)', gap: '4px', fontSize: '11px' }}>
      <div></div>
      {Array.from({ length: 12 }, (_, s) => (
        <div key={s} className="top" style={{ textAlign: 'center', color: 'var(--muted)' }}>
          {String(s * 2).padStart(2, '0')}h
        </div>
      ))}

      {days.map((day, dIdx) => (
        <React.Fragment key={dIdx}>
          <div className="lab" style={{ display: 'flex', alignItems: 'center', fontWeight: 600, color: 'var(--ink-2)' }}>
            {day}
          </div>
          {Array.from({ length: 12 }, (_, sIdx) => {
            const level = Math.floor(Math.random() * 7);
            return (
              <div
                key={sIdx}
                className="c"
                style={{
                  height: '22px',
                  borderRadius: '4px',
                  background: steps[level]
                }}
                title={`${day} ${sIdx * 2}h-${sIdx * 2 + 2}h`}
              />
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
};
