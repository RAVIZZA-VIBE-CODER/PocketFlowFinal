import React, { useState } from "react";
import { SlidersVertical, RefreshCw, BarChart3, HelpCircle, Table, Link, Plus, Trash2, Clipboard } from "lucide-react";
import { Dashboard, DashboardBlock, ChartBlockContent } from "../../types";
import ChartRenderer from "./ChartRenderer";

interface ChartsForgeProps {
  dashboards: Dashboard[];
  onAddBlockToDashboard: (dashId: string, block: Omit<DashboardBlock, "id" | "createdAt" | "updatedAt" | "order">) => void;
  onNotify: (msg: string, status: "success" | "error" | "info" | "warning") => void;
  isLight?: boolean;
}

export default function ChartsForge({
  dashboards,
  onAddBlockToDashboard,
  onNotify,
  isLight = false,
}: ChartsForgeProps) {
  const [chartName, setChartName] = useState("Operational Network Performance");
  const [chartType, setChartType] = useState<"bar" | "line" | "area" | "pie">("line");
  const [labelsInput, setLabelsInput] = useState("Jan, Feb, Mar, Apr, May, Jun");
  const [valuesInput, setValuesInput] = useState("120, 240, 180, 290, 210, 340");
  const [yAxisLabel, setYAxisLabel] = useState("Packets Stream Latency (ms)");
  const [notes, setNotes] = useState("Analyzed bluetooth scanner efficiency curves inside sandbox.");
  const [linkTargetDashboardId, setLinkTargetDashboardId] = useState("");

  const parseLabels = () => labelsInput.split(",").map((l) => l.trim()).filter(Boolean);
  const parseValues = () => valuesInput.split(",").map((v) => parseFloat(v.trim()) || 0);

  const handleImportCSVText = (csvString: string) => {
    try {
      // Very robust simple csv parser
      const lines = csvString.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) {
        onNotify("Incomplete CSV content. Make sure you have headings and values.", "warning");
        return;
      }
      const headerMatched = lines[0].split(",").map(h => h.trim());
      const firstRow = lines[1].split(",").map(r => r.trim());

      const numericIndexes: number[] = [];
      const textIndexes: number[] = [];

      firstRow.forEach((val, idx) => {
        if (!isNaN(parseFloat(val))) {
          numericIndexes.push(idx);
        } else {
          textIndexes.push(idx);
        }
      });

      if (numericIndexes.length === 0) {
        onNotify("Could not determine numerical rows inside the CSV. Paste clean tuples.", "error");
        return;
      }

      // We will map text index to label and first numeric index to value
      const targetLabelIdx = textIndexes[0] ?? 0;
      const targetValueIdx = numericIndexes[0] ?? 1;

      const parsedLabels: string[] = [];
      const parsedValues: number[] = [];

      // read actual records
      lines.slice(1).forEach((l) => {
        const parts = l.split(",");
        if (parts.length > Math.max(targetLabelIdx, targetValueIdx)) {
          parsedLabels.push(parts[targetLabelIdx].trim());
          parsedValues.push(parseFloat(parts[targetValueIdx].trim()) || 0);
        }
      });

      if (parsedLabels.length > 0 && parsedValues.length > 0) {
        setLabelsInput(parsedLabels.join(", "));
        setValuesInput(parsedValues.join(", "));
        setYAxisLabel(headerMatched[targetValueIdx] || "Numerical Values");
        onNotify("Sprinkled CSV datasets perfectly!", "success");
      }
    } catch {
      onNotify("Parsing CSV failed. Check separators and delimiters.", "error");
    }
  };

  const handleLinkToDashboard = () => {
    if (!linkTargetDashboardId) {
      onNotify("Select a destination dashboard to mount the chart.", "warning");
      return;
    }

    const labels = parseLabels();
    const values = parseValues();

    if (labels.length === 0 || values.length === 0) {
      onNotify("Your chart doesn't have valid labels or numerical value lists.", "error");
      return;
    }

    const chartBlock: Omit<DashboardBlock, "id" | "createdAt" | "updatedAt" | "order"> = {
      type: "chart",
      title: chartName,
      chartContent: {
        chartType,
        labels,
        values,
        yAxisLabel,
        notes,
      },
    };

    onAddBlockToDashboard(linkTargetDashboardId, chartBlock);
    onNotify("Chart attached to target dashboard successfully!", "success");
  };

  return (
    <div className="space-y-4 select-none">
      <div className="flex items-center gap-1.5 border-b border-dashed border-zinc-800 pb-2.5">
        <SlidersVertical className="w-4 h-4 text-amber-500 shrink-0" />
        <h4 className={`text-xs font-mono font-bold uppercase tracking-wider ${isLight ? "text-slate-800" : "text-white"}`}>
          SVG Chart Studio Laboratory
        </h4>
      </div>

      {/* SVG Canvas Preview */}
      <div className={`p-4 rounded-xl border flex flex-col justify-center gap-3 ${
        isLight ? "bg-slate-50 border-slate-200" : "bg-black/40 border-[#2a2c32]"
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-zinc-500 block uppercase tracking-widest">Active Canvas Output</span>
          <span className="text-[9px] font-mono bg-amber-500/10 border border-amber-500/25 text-amber-500 px-2 py-0.5 rounded-full uppercase">
            {chartType} vectors
          </span>
        </div>

        <div className="py-2 flex justify-center items-center">
          <ChartRenderer
            content={{
              chartType,
              labels: parseLabels(),
              values: parseValues(),
              yAxisLabel,
              notes,
            }}
            accentColor="#18d6d6"
            isLight={isLight}
          />
        </div>

        <div className="border-t border-dashed border-[#2a2c32] pt-2 mt-1">
          <h5 className={`text-[10.5px] font-mono font-bold leading-tight ${isLight ? "text-slate-800" : "text-white"}`}>{chartName}</h5>
          {yAxisLabel && <p className="text-[8.5px] font-mono text-emerald-500 uppercase mt-0.5 tracking-wider">{yAxisLabel}</p>}
          {notes && <p className="text-[9.5px] text-[#8e9299] leading-tight select-none mt-1">{notes}</p>}
        </div>
      </div>

      {/* Editor settings */}
      <div className="space-y-3.5 pt-1">
        <div>
          <label className="text-[9px] font-mono font-semibold text-slate-500 uppercase tracking-widest block mb-1">
            Display Title
          </label>
          <input
            type="text"
            value={chartName}
            onChange={(e) => setChartName(e.target.value)}
            className={`w-full text-xs font-mono py-2 px-3 rounded-xl border focus:outline-none ${
              isLight ? "bg-white border-slate-300 focus:border-amber-500" : "bg-[#0c0c0d] border-[#2a2c32] text-white focus:border-amber-500/40"
            }`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] font-mono font-semibold text-slate-500 uppercase tracking-widest block mb-1">
              Plot Segment Design
            </label>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as any)}
              className={`w-full text-xs font-mono py-2 px-2.5 rounded-xl border focus:outline-none ${
                isLight ? "bg-white border-slate-300" : "bg-[#0c0c0d] border-[#2a2c32] text-white"
              }`}
            >
              <option value="line">Line Plot</option>
              <option value="bar">Bar Vector</option>
              <option value="area">Area Volume Spark</option>
              <option value="pie">Radial Pie/Donut</option>
            </select>
          </div>

          <div>
            <label className="text-[9px] font-mono font-semibold text-slate-500 uppercase tracking-widest block mb-1">
              Y-Axis scale label
            </label>
            <input
              type="text"
              value={yAxisLabel}
              onChange={(e) => setYAxisLabel(e.target.value)}
              className={`w-full text-xs font-mono py-2 px-3 rounded-xl border focus:outline-none ${
                isLight ? "bg-white border-slate-300 focus:border-amber-500" : "bg-[#0c0c0d] border-[#2a2c32] text-white focus:border-amber-500/40"
              }`}
            />
          </div>
        </div>

        {/* CSV Paste Hub */}
        <div className={`p-3 rounded-xl border space-y-2 ${isLight ? "bg-slate-50 border-slate-200" : "bg-[#0c0c0d] border-[#2a2c32]"}`}>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[9px] font-mono uppercase tracking-widest text-[#8e9299]">Spreadsheet Paste Hub</span>
            <button
              onClick={() => {
                const dummy = `Product, Revenue, Sold\nBluetooth Cables, 120, 30\nAnvil Case, 280, 50\nPocket Sensor, 190, 42\nOperating Hub, 310, 80\nTelemetry Tool, 250, 45\nMemory Card, 380, 90`;
                handleImportCSVText(dummy);
              }}
              className="text-[8.5px] font-mono text-amber-500 hover:underline cursor-pointer"
            >
              Load Demo CSV
            </button>
          </div>
          <textarea
            rows={2}
            placeholder="Paste raw csv rows here... e.g. Jan,120\nFeb,190\nMar,140"
            onChange={(e) => handleImportCSVText(e.target.value)}
            className={`w-full text-[9.5px] font-mono p-2 rounded-lg border focus:outline-none ${
              isLight ? "bg-white border-slate-300" : "bg-zinc-900 border-[#2a2c32] text-slate-300"
            }`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] font-mono font-semibold text-slate-500 uppercase tracking-widest block mb-0.5">X-Axes Labels (Comma)</label>
            <input
              type="text"
              value={labelsInput}
              onChange={(e) => setLabelsInput(e.target.value)}
              className={`w-full text-[10px] font-mono py-1.5 px-2.5 rounded-lg border focus:outline-none ${
                isLight ? "bg-white border-slate-300" : "bg-zinc-900 border-[#2a2c32] text-white"
              }`}
            />
          </div>
          <div>
            <label className="text-[9px] font-mono font-semibold text-slate-500 uppercase tracking-widest block mb-0.5">Y-Axes Values (Comma)</label>
            <input
              type="text"
              value={valuesInput}
              onChange={(e) => setValuesInput(e.target.value)}
              className={`w-full text-[10px] font-mono py-1.5 px-2.5 rounded-lg border focus:outline-none ${
                isLight ? "bg-white border-slate-300" : "bg-zinc-900 border-[#2a2c32] text-white"
              }`}
            />
          </div>
        </div>

        <div>
          <label className="text-[9px] font-mono font-semibold text-slate-500 uppercase tracking-widest block mb-1">
            Chart Commentary
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`w-full text-xs font-mono py-2 px-3 rounded-xl border focus:outline-none ${
              isLight ? "bg-white border-slate-300 focus:border-amber-500" : "bg-[#0c0c0d] border-[#2a2c32] text-white focus:border-amber-500/40"
            }`}
          />
        </div>

        {/* Bind and Link */}
        <div className={`p-3.5 rounded-2xl border flex flex-col gap-3 ${
          isLight ? "bg-amber-100/30 border-amber-500/10" : "bg-amber-500/5 border-amber-500/10"
        }`}>
          <div>
            <label className="text-[9px] font-mono font-semibold text-slate-500 uppercase tracking-widest block mb-1">
              Select Destination Dashboard Page
            </label>
            <select
              value={linkTargetDashboardId}
              onChange={(e) => setLinkTargetDashboardId(e.target.value)}
              className={`w-full text-xs font-mono py-2 px-2.5 rounded-xl border focus:outline-none ${
                isLight ? "bg-white border-slate-300" : "bg-[#0c0c0d] border-[#2a2c32] text-white"
              }`}
            >
              <option value="">-- Choose Dashboard --</option>
              {dashboards.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({d.blocks.length} elements)
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleLinkToDashboard}
            className="py-3 px-4 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-mono font-bold rounded-xl transition uppercase tracking-wider text-center flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Link className="w-4 h-4 stroke-[2.5]" /> Link Visual Chart
          </button>
        </div>
      </div>
    </div>
  );
}
