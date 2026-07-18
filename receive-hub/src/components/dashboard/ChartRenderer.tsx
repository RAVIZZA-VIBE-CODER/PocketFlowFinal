import React from "react";
import { ChartBlockContent } from "../../types";

interface ChartRendererProps {
  content: ChartBlockContent;
  primaryColor?: string;
  accentColor?: string;
  isLight?: boolean;
}

export default function ChartRenderer({
  content,
  primaryColor = "#031a20",
  accentColor = "#18d6d6",
  isLight = false,
}: ChartRendererProps) {
  const { chartType, labels = [], values = [], yAxisLabel } = content;

  if (labels.length === 0 || values.length === 0) {
    return (
      <div className={`p-4 text-center rounded-xl border text-[11px] ${
        isLight ? "bg-slate-50 border-slate-200 text-slate-400" : "bg-zinc-900/30 border-[#2a2c32] text-slate-500"
      }`}>
        No data series loaded
      </div>
    );
  }

  const maxValue = Math.max(...values, 10);
  const chartHeight = 85;
  const totalWidth = 280;
  const leftOffset = 25;
  const rightOffset = 15;
  const topOffset = 10;
  const bottomOffset = 15;
  
  const usableWidth = totalWidth - leftOffset - rightOffset;
  const usableHeight = chartHeight - topOffset - bottomOffset;

  const colors = [accentColor, "#3B82F6", "#10B981", "#EF4444", "#F59E0B", "#8B5CF6"];

  if (chartType === "pie") {
    const total = values.reduce((sum, val) => sum + val, 0) || 1;
    let accumulatedAngle = 0;

    return (
      <div className="flex flex-col items-center gap-3 pt-2">
        <svg width="150" height="130" viewBox="0 0 150 130" className="overflow-visible select-none">
          {values.map((val, idx) => {
            const percentage = (val / total) * 100;
            const angle = (val / total) * 360;
            if (angle === 0) return null;

            const radStart = ((accumulatedAngle - 90) * Math.PI) / 180;
            const radEnd = ((accumulatedAngle + angle - 90) * Math.PI) / 180;
            
            const radius = 45;
            const cx = 75;
            const cy = 65;

            const startX = cx + radius * Math.cos(radStart);
            const startY = cy + radius * Math.sin(radStart);
            const endX = cx + radius * Math.cos(radEnd);
            const endY = cy + radius * Math.sin(radEnd);

            const largeArcFlag = angle > 180 ? 1 : 0;
            const pathData = angle >= 359.9
              ? `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${cy - radius} Z`
              : `M ${cx} ${cy} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;

            accumulatedAngle += angle;
            const color = colors[idx % colors.length];

            return (
              <path
                key={idx}
                d={pathData}
                fill={color}
                className="transition-all hover:opacity-85 duration-100"
                title={`${labels[idx]}: ${val}`}
              />
            );
          })}
          <circle cx="75" cy="65" r="20" fill={isLight ? "#ffffff" : "#151619"} />
        </svg>

        <div className={`grid grid-cols-2 gap-x-3 gap-y-1 w-full text-[10px] p-2 rounded-xl ${isLight ? "bg-slate-50" : "bg-black/10"}`}>
          {values.map((val, idx) => (
            <div key={idx} className="flex items-center justify-between select-none">
              <div className="flex items-center gap-1.5 truncate max-w-[80px]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors[idx % colors.length] }} />
                <span className={`truncate leading-none ${isLight ? "text-slate-600 font-medium" : "text-slate-400"}`}>{labels[idx]}</span>
              </div>
              <span className={`font-mono text-[9px] font-bold ${isLight ? "text-slate-700" : "text-slate-200"}`}>
                {val} ({(val / total * 100).toFixed(0)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (chartType === "bar") {
    const barCount = values.length;
    const barOuterWidth = usableWidth / barCount;
    const barInnerWidth = Math.max(4, barOuterWidth - 12);

    return (
      <svg width="100%" height={chartHeight} viewBox={`0 0 ${totalWidth} ${chartHeight}`} className="overflow-visible select-none my-1">
        {/* Helper guidelines */}
        <line x1={leftOffset} y1={topOffset} x2={totalWidth - rightOffset} y2={topOffset} stroke={isLight ? "#f1f5f9" : "#2a2c32"} strokeDasharray="3,3" />
        <line x1={leftOffset} y1={(usableHeight / 2) + topOffset} x2={totalWidth - rightOffset} y2={(usableHeight / 2) + topOffset} stroke={isLight ? "#e2e8f0" : "#2a2c32"} strokeDasharray="3,3" />
        
        {/* Data Bars */}
        {values.map((val, idx) => {
          const barHeight = (val / maxValue) * usableHeight;
          const x = leftOffset + (idx * barOuterWidth) + (barOuterWidth - barInnerWidth) / 2;
          const y = chartHeight - bottomOffset - barHeight;

          return (
            <g key={idx} className="group">
              <rect
                x={x}
                y={y}
                width={barInnerWidth}
                height={Math.max(2, barHeight)}
                fill={accentColor}
                rx="1"
                className="transition-all hover:opacity-85 duration-100 cursor-pointer"
              />
              <text
                x={x + barInnerWidth / 2}
                y={y - 3}
                fill={isLight ? "#0f172a" : "#22c55e"}
                fontSize="7"
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="middle"
              >
                {val}
              </text>
              <text
                x={leftOffset + (idx * barOuterWidth) + barOuterWidth / 2}
                y={chartHeight - 3}
                fill={isLight ? "#64748b" : "#8e9299"}
                fontSize="7"
                textAnchor="middle"
                className="font-mono font-bold"
              >
                {labels[idx]}
              </text>
            </g>
          );
        })}
        {/* Baseline */}
        <line x1={leftOffset} y1={chartHeight - bottomOffset} x2={totalWidth - rightOffset} y2={chartHeight - bottomOffset} stroke={isLight ? "#cbd5e1" : "#334155"} strokeWidth="1" />
      </svg>
    );
  }

  // Line / Area SVG Renderer
  const points = values.map((val, idx) => {
    const x = leftOffset + (usableWidth > 0 ? (idx / (values.length - 1)) * usableWidth : 0);
    const y = chartHeight - bottomOffset - (val / maxValue) * usableHeight;
    return `${x},${y}`;
  }).join(" ");

  const areaPoints = [
    `${leftOffset},${chartHeight - bottomOffset}`,
    ...values.map((val, idx) => {
      const x = leftOffset + (usableWidth > 0 ? (idx / (values.length - 1)) * usableWidth : 0);
      const y = chartHeight - bottomOffset - (val / maxValue) * usableHeight;
      return `${x},${y}`;
    }),
    `${leftOffset + usableWidth},${chartHeight - bottomOffset}`
  ].join(" ");

  return (
    <svg width="100%" height={chartHeight} viewBox={`0 0 ${totalWidth} ${chartHeight}`} className="overflow-visible select-none my-1">
      <defs>
        <linearGradient id={`grad-${accentColor}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accentColor} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>

      {/* Helper guidelines */}
      <line x1={leftOffset} y1={topOffset} x2={totalWidth - rightOffset} y2={topOffset} stroke={isLight ? "#f1f5f9" : "#2a2c32"} strokeDasharray="3,3" />
      <line x1={leftOffset} y1={(usableHeight / 2) + topOffset} x2={totalWidth - rightOffset} y2={(usableHeight / 2) + topOffset} stroke={isLight ? "#e2e8f0" : "#2a2c32"} strokeDasharray="3,3" />

      {/* Area cumulative background */}
      {chartType === "area" && (
        <polygon points={areaPoints} fill={`url(#grad-${accentColor})`} opacity="0.12" />
      )}

      {/* Vector Line */}
      <polyline
        fill="none"
        stroke={accentColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />

      {/* Data points */}
      {values.map((val, idx) => {
        const x = leftOffset + (usableWidth > 0 ? (idx / (values.length - 1)) * usableWidth : 0);
        const y = chartHeight - bottomOffset - (val / maxValue) * usableHeight;

        return (
          <g key={idx} className="group">
            <circle
              cx={x}
              cy={y}
              r="3.5"
              fill={isLight ? "#ffffff" : "#151619"}
              stroke={accentColor}
              strokeWidth="1.5"
              className="cursor-pointer transition-all hover:r-[5]"
            />
            <text
              x={x}
              y={y - 6}
              fill={isLight ? "#0f172a" : "#22c55e"}
              fontSize="7"
              fontFamily="monospace"
              fontWeight="bold"
              textAnchor="middle"
            >
              {val}
            </text>
            <text
              x={x}
              y={chartHeight - 3}
              fill={isLight ? "#64748b" : "#8e9299"}
              fontSize="7"
              textAnchor="middle"
              className="font-mono font-bold"
            >
              {labels[idx]}
            </text>
          </g>
        );
      })}
      {/* Baseline */}
      <line x1={leftOffset} y1={chartHeight - bottomOffset} x2={totalWidth - rightOffset} y2={chartHeight - bottomOffset} stroke={isLight ? "#cbd5e1" : "#334155"} strokeWidth="1" />
    </svg>
  );
}
