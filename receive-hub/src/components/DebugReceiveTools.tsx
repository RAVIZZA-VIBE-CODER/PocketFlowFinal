/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FileCategory, ReceivedFile } from "../types";
import { Play, ShieldAlert, Cpu, Heart, CheckCircle } from "lucide-react";

interface DebugReceiveToolsProps {
  onSimulateIncoming: (type: string) => void;
  onClearInbox: () => void;
  onExportMetadata: () => void;
  inboxLength: number;
}

export default function DebugReceiveTools({
  onSimulateIncoming,
  onClearInbox,
  onExportMetadata,
  inboxLength,
}: DebugReceiveToolsProps) {
  return (
    <div className="bg-[#151619] border border-[#2a2c32] rounded-2xl p-4 shadow-xl select-none">
      <div className="flex items-center gap-2 mb-3 border-b border-[#2a2c32] pb-2.5">
        <Cpu className="w-4 h-4 text-[#22c55e]" />
        <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
          Developer Simulator
        </h2>
      </div>

      <div className="text-[10px] font-mono text-[#8e9299] uppercase tracking-widest mb-3">
        Simulate Nearby Bluetooth / Android Share Payload
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { id: "dashboard_json", label: "Dashboard JSON", color: "text-amber-400 hover:bg-amber-400/5 hover:border-amber-400/30", sub: "Blocks & Title" },
          { id: "builder_json", label: "Builder Package", color: "text-[#22c55e] hover:bg-[#22c55e]/5 hover:border-[#22c55e]/30", sub: "Complex Graph" },
          { id: "preview_image", label: "System Image", color: "text-emerald-400 hover:bg-emerald-400/5 hover:border-emerald-400/30", sub: "Screenshot Reference" },
          { id: "markdown_note", label: "Markdown Text", color: "text-blue-400 hover:bg-blue-400/5 hover:border-blue-400/30", sub: "Docs & Readme" },
          { id: "csv_report", label: "CSV Dataset", color: "text-violet-400 hover:bg-violet-400/5 hover:border-violet-400/30", sub: "Dashboard Rows" },
          { id: "zip_package", label: "Safe ZIP File", color: "text-sky-400 hover:bg-sky-400/5 hover:border-sky-400/30", sub: "Compressed Archives" },
          { id: "blocked_exe", label: "Restricted EXE", color: "text-red-400 hover:bg-red-400/5 hover:border-red-400/30", sub: "Safety Block" },
          { id: "blocked_apk", label: "Restricted APK", color: "text-rose-400 hover:bg-rose-400/5 hover:border-rose-400/30", sub: "Safety Block" },
          { id: "huge_file", label: "Oversized File", color: "text-slate-400 hover:bg-slate-400/5 hover:border-slate-400/30", sub: "Over 50 MB" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => onSimulateIncoming(item.id)}
            className={`flex flex-col items-start p-2 border border-[#2a2c32] bg-[#0c0c0d] rounded-xl transition text-left cursor-pointer active:scale-98 ${item.color}`}
          >
            <div className="flex items-center gap-1">
              <Play className="w-2.5 h-2.5 fill-current shrink-0" />
              <span className="text-xs font-semibold">{item.label}</span>
            </div>
            <span className="text-[9px] text-[#8e9299] block mt-0.5">{item.sub}</span>
          </button>
        ))}
      </div>

      <div className="border-t border-[#2a2c32] pt-3 flex items-center justify-between gap-2.5">
        <button
          onClick={onExportMetadata}
          disabled={inboxLength === 0}
          className="flex-1 py-2 text-[11px] font-mono font-semibold uppercase tracking-wider bg-[#2a2c32] border border-[#2a2c32] hover:border-[#22c55e]/30 hover:text-[#22c55e] active:bg-[#2a2c32]/80 rounded-xl transition text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed text-center"
        >
          Export Debug JSON
        </button>
        <button
          onClick={onClearInbox}
          disabled={inboxLength === 0}
          className="flex-1 py-2 text-[11px] font-mono font-semibold uppercase tracking-wider bg-[#151619] hover:bg-red-950/30 border border-red-500/20 active:bg-red-900/40 rounded-xl transition text-red-400 disabled:opacity-40 disabled:cursor-not-allowed text-center"
        >
          Clear Inbox
        </button>
      </div>
    </div>
  );
}
