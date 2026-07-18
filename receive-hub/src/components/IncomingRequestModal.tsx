/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReceivedFile } from "../types";
import { formatBytes } from "../utils/fileValidation";
import { ShieldAlert, ShieldCheck, Download, XCircle, ArrowRight, Smartphone, Terminal } from "lucide-react";

interface IncomingRequestModalProps {
  file: ReceivedFile | null;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
}

export default function IncomingRequestModal({
  file,
  onAccept,
  onDecline,
}: IncomingRequestModalProps) {
  if (!file) return null;

  const isBlocked = file.status === "blocked";
  const formattedSize = formatBytes(file.size);
  const isDeclined = file.status === "declined";

  // Destination friendly naming
  const destinationMap = {
    dashboardStudio: "Reader",
    pocketFlowBuilder: "PocketFlow Builder ⚙️",
    assetsLibrary: "Assets Library 🖼️",
    notes: "Notes & Reports 📝",
    genericStorage: "Generic Storage 📁",
    keepInInbox: "Inbox Storage 📨",
  };

  const readableDestination = destinationMap[file.suggestedDestination] || "Unknown App";

  return (
    <div className="fixed inset-0 bg-[#0c0c0d]/90 backdrop-blur-sm flex items-end justify-center z-50 animate-fade-in p-0 select-none">
      {/* Tap outside handles declining safely or warning */}
      <div 
        className="absolute inset-0" 
        onClick={() => !isBlocked && onDecline(file.id)} 
      />

      {/* Slide-up bottom card */}
      <div className="relative w-full max-w-[420px] bg-[#151619] border-t border-[#2a2c32] rounded-t-[32px] p-6 shadow-2xl z-55 flex flex-col gap-4 animate-slide-up max-h-[90%] overflow-y-auto">
        
        {/* Pull handle decor */}
        <div className="w-12 h-1 bg-[#2a2c32] rounded-full mx-auto" />

        {/* Header containing warning or normal badge */}
        <div className="flex items-start justify-between">
          <div>
            <span
              className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                isBlocked
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
              }`}
            >
              {isBlocked ? "Blocked File Packet" : "Incoming File Request"}
            </span>
            <h3 className="text-base font-bold text-white mt-1.5 leading-tight tracking-tight">
              {isBlocked ? "Dangerous payload filtered" : "File received from nearby"}
            </h3>
          </div>
          <div className="p-2 bg-[#0c0c0d] border border-[#2a2c32] rounded-xl text-slate-400">
            <Smartphone className="w-5 h-5" />
          </div>
        </div>

        {/* Device detail block */}
        <div className="bg-[#0c0c0d]/90 rounded-xl p-3 border border-[#2a2c32] flex items-center justify-between text-xs text-[#8e9299]">
          <div>
            <span className="font-semibold block text-[10px] text-slate-500 font-mono tracking-wider uppercase">
              Source Device
            </span>
            <span className="text-slate-200 font-semibold">{file.sourceDeviceName || "Unknown device"}</span>
          </div>
          <div className="text-right">
            <span className="font-semibold block text-[10px] text-slate-500 font-mono tracking-wider uppercase">
              Ingress Port
            </span>
            <span className="text-[#22c55e] font-mono text-[11px] font-semibold">
              {file.source === "androidShare" ? "Android Share intent" : file.source === "bluetoothFolder" ? "Bluetooth Sync" : file.source}
            </span>
          </div>
        </div>

        {/* File information panel */}
        <div className="bg-[#0c0c0d]/30 border border-[#2a2c32] rounded-2xl p-4 flex flex-col gap-2">
          {/* File Name */}
          <div className="flex flex-col">
            <span className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-widest">
              File Name
            </span>
            <span className="text-sm font-semibold truncate text-white mt-0.5 pr-2 font-mono">
              {file.name}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-1.5 pt-2.5 border-t border-[#2a2c32]">
            {/* File Format */}
            <div className="flex flex-col">
              <span className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-widest">
                Category
              </span>
              <span className="text-xs font-semibold text-slate-300 mt-0.5 capitalize">
                {file.category === "builderPackage" ? "Builder package" : file.category}
              </span>
            </div>

            {/* Scale */}
            <div className="flex flex-col">
              <span className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-widest">
                File Size
              </span>
              <span className="text-xs font-semibold text-[#22c55e] font-mono mt-0.5">
                {formattedSize}
              </span>
            </div>
          </div>
        </div>

        {/* Security / Suggestion Diagnostic Info */}
        {isBlocked ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3 text-red-200">
            <ShieldAlert className="w-5 h-5 shrink-0 text-red-400 mt-0.5 animate-bounce" />
            <div className="text-xs">
              <span className="font-bold text-red-300 block mb-0.5">Security Quarantine Rules Triggered</span>
              {file.blockedReason || "Dangerous executable commands or script assets filtered automatically for sandbox containment."}
            </div>
          </div>
        ) : (
          <div className="bg-[#22c55e]/10 border border-[#22c55e]/20 rounded-xl p-3.5 flex gap-3 text-emerald-200">
            <ShieldCheck className="w-5 h-5 shrink-0 text-[#22c55e] mt-0.5" />
            <div className="text-xs flex-1">
              <span className="font-bold text-[#22c55e] block mb-0.5">Validation Checklist Passed</span>
              <div className="flex items-center gap-1.5 text-emerald-400/90 font-mono text-[10px] uppercase tracking-wider font-semibold">
                <span>Safe extension</span>
                <span>•</span>
                <span>No buffer scripts</span>
                <span>•</span>
                <span>Suggest: {readableDestination}</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Panel */}
        <div className="flex gap-3.5 mt-2">
          <button
            onClick={() => onDecline(file.id)}
            className="flex-1 py-3.5 px-4 bg-[#2a2c32] hover:bg-[#2a2c32]/80 active:bg-[#2a2c32] text-xs font-mono font-bold rounded-2xl text-slate-300 transition-all select-none border border-transparent text-center uppercase tracking-wider duration-100 cursor-pointer"
          >
            {isBlocked ? "Dismiss Packet" : "Decline Import"}
          </button>
          
          {!isBlocked && (
            <button
              onClick={() => onAccept(file.id)}
              className="flex-1 py-3.5 px-4 bg-[#22c55e] hover:bg-emerald-500 text-xs font-mono font-bold rounded-2xl text-black transition-all shadow-[0_4px_12px_rgba(34,197,94,0.15)] hover:shadow-emerald-500/25 select-none text-center uppercase tracking-wider duration-100 cursor-pointer"
            >
              Accept Import
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
