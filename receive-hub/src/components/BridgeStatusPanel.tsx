/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BridgeStatus } from "../types";
import { ShieldCheck, HardDrive, Smartphone, RefreshCw, Cpu, Bluetooth, Pocket } from "lucide-react";

interface BridgeStatusPanelProps {
  status: BridgeStatus;
  onRequestPermission: (permissionKey: string) => void;
  onToggleBridgeMode: () => void;
}

export default function BridgeStatusPanel({
  status,
  onRequestPermission,
  onToggleBridgeMode,
}: BridgeStatusPanelProps) {
  return (
    <div className="bg-[#151619] border border-[#2a2c32] rounded-2xl p-4 shadow-xl backdrop-blur-md select-none">
      <div className="flex items-center justify-between mb-3 border-b border-[#2a2c32] pb-2.5">
        <div className="flex items-center gap-2">
          <Cpu className={`w-4 h-4 ${status.mode === "androidBridge" ? "text-[#22c55e]" : "text-blue-400 animate-pulse"}`} />
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
            System Bridge Status
          </h2>
        </div>
        <button
          onClick={onToggleBridgeMode}
          className="text-[10px] font-mono font-medium px-2 py-1 bg-[#2a2c32] border border-[#2a2c32] text-white hover:text-[#22c55e] hover:border-[#22c55e]/50 active:bg-slate-700/80 rounded-md transition duration-150 flex items-center gap-1.5"
        >
          <RefreshCw className="w-2.5 h-2.5" />
          {status.mode === "androidBridge" ? "Switch Web Mode" : "Attach Bridge"}
        </button>
      </div>

      {/* Main Mode Indicator Card */}
      <div className="bg-[#0c0c0d] rounded-xl p-3 border border-[#2a2c32] mb-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-mono text-[#8e9299] uppercase tracking-widest">
            Active Layer
          </div>
          <div className="text-sm font-semibold text-white tracking-wide mt-0.5">
            {status.mode === "androidBridge" ? "Android Native Shell" : "PWA Web Receiver"}
          </div>
        </div>
        <span
          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
            status.mode === "androidBridge"
              ? "bg-[#22c55e]/15 border-[#22c55e]/30 text-[#22c55e]"
              : "bg-blue-500/15 border-blue-500/30 text-blue-400"
          }`}
        >
          {status.mode === "androidBridge" ? "BRIDGE ACTIVE" : "LOCAL SANDBOX"}
        </span>
      </div>

      {/* Permissions Header */}
      <div className="text-[10px] font-mono font-semibold text-[#8e9299] uppercase tracking-wider mb-2">
        Android Native Permissions
      </div>

      {/* Permissions Grid */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {Object.entries(status.permissions).map(([key, granted]) => (
          <button
            key={key}
            onClick={() => onRequestPermission(key)}
            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition ${
              granted
                ? "bg-[#22c55e]/10 border-[#22c55e]/20 text-[#22c55e]"
                : "bg-[#0c0c0d] border-[#2a2c32] text-[#8e9299] hover:border-slate-600"
            }`}
          >
            <span className="truncate">
              {key === "bluetoothScan" && "Bluetooth Scan"}
              {key === "bluetoothConnect" && "Bluetooth Pair"}
              {key === "readMediaImages" && "Internal Media"}
              {key === "readExternalStorage" && "Downloads Folder"}
              {key === "notifications" && "Push Alerts"}
            </span>
            <div
              className={`w-1.5 h-1.5 rounded-full shrink-0 ml-1.5 ${
                granted ? "bg-[#22c55e] shadow-[0_0_4px_#22c55e]" : "bg-slate-700"
              }`}
            />
          </button>
        ))}
      </div>

      {/* Transport Methods Checklist */}
      <div className="text-[10px] font-mono font-semibold text-[#8e9299] uppercase tracking-wider mb-2">
        Available Input Ports
      </div>
      <div className="space-y-1.5">
        {[
          { key: "filePicker", label: "System File Picker", sub: "Android Intent selector" },
          { key: "dragDrop", label: "Drag & Drop", sub: "Available on desktop layout" },
          { key: "androidShare", label: "Android Share Sheet", sub: "'Send via PocketFlow'" },
          { key: "bluetoothFolderWatch", label: "Bluetooth Watcher", sub: "Folder check receiver" },
          { key: "downloadsWatch", label: "Downloads Watcher", sub: "PWA filesystem watch" },
          { key: "nearbyConnections", label: "Quick Share Nearby", sub: "Peer-to-peer wifi transport" },
        ].map((method) => {
          const isEnabled = status.receiveMethods[method.key as keyof typeof status.receiveMethods];
          return (
            <div
              key={method.key}
              className={`flex items-center justify-between p-2 rounded-xl text-left border ${
                isEnabled
                   ? "bg-[#0c0c0d] border-[#2a2c32] text-slate-200"
                   : "bg-[#0c0c0d]/30 border-dashed border-[#2a2c32] opacity-40 text-slate-500"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5">
                  {method.key.includes("bluetooth") ? (
                    <Bluetooth className="w-3.5 h-3.5" />
                  ) : method.key.includes("FilePay") || method.key.includes("Picker") ? (
                    <Smartphone className="w-3.5 h-3.5" />
                  ) : method.key.includes("Share") ? (
                    <Pocket className="w-3.5 h-3.5" />
                  ) : (
                    <HardDrive className="w-3.5 h-3.5" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-semibold leading-none">{method.label}</div>
                  <div className="text-[9px] text-[#8e9299] leading-none mt-1">{method.sub}</div>
                </div>
              </div>
              <span className="text-[9px] font-mono font-semibold tracking-wider">
                {isEnabled ? "ON" : "OFF"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bluetooth disclaimer */}
      <div className="mt-3 bg-red-500/10 border border border-[#2a2c32] rounded-xl p-2.5 text-[10px] text-red-300">
        <span className="font-semibold block mb-0.5">ℹ️ Bluetooth Limitation Note</span>
        Web Browser sandboxing cannot perform raw Bluetooth file transmissions directly. Real Bluetooth OBEX imports require the PocketFlow Android native wrapper layer.
      </div>
    </div>
  );
}
