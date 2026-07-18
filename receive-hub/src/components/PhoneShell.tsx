/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Signal, Wifi, Battery, ChevronLeft, Circle, Square, Bluetooth, Plane } from "lucide-react";
import { NativeDeviceStatus } from "../types";

interface PhoneShellProps {
  children: React.ReactNode;
  wifiEnabled?: boolean;
  bluetoothEnabled?: boolean;
  airplaneMode?: boolean;
  deviceStatus?: NativeDeviceStatus | null;
  onHomeClick?: () => void;
  onBackClick?: () => void;
}

export default function PhoneShell({ 
  children, 
  wifiEnabled = true, 
  bluetoothEnabled = true, 
  airplaneMode = false,
  deviceStatus = null,
  onHomeClick,
  onBackClick 
}: PhoneShellProps) {
  const [time, setTime] = useState("");
  const batteryPct = typeof deviceStatus?.batteryPct === "number" && deviceStatus.batteryPct >= 0
    ? deviceStatus.batteryPct
    : 84;
  const shellLabel = deviceStatus?.model ? deviceStatus.model : "BOB The Builder";
  const batteryTone = batteryPct <= 15 ? "text-red-400" : batteryPct <= 30 ? "text-amber-400" : "text-[#22c55e]";
  const isNativeAndroidShell = deviceStatus?.source === "android"
    || (typeof navigator !== "undefined" && navigator.userAgent.includes("PocketFlowLauncher/"));
  const showVirtualStatusHeader = true;
  const showVirtualSystemControls = !isNativeAndroidShell;
  const showDecorativeEffects = false;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    };
    updateTime();
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="pocketflow-phone-shell bg-[#0c0c0d] flex flex-col items-center justify-center p-0 md:p-6 text-slate-100 antialiased overflow-hidden font-sans">
      {showDecorativeEffects && (
        <>
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      {/* Main physical phone bezel */}
      <div className={`relative w-full max-w-[420px] h-full md:h-[840px] bg-[#151619] md:rounded-[48px] md:border-8 md:border-[#2a2c32] flex flex-col justify-between overflow-hidden ring-1 ring-[#2a2c32] ${showDecorativeEffects ? "shadow-2xl" : "shadow-none"}`}>
        
        {/* Physical top speaker grill accent for desktop preview only */}
        <div className="hidden md:absolute -top-1 left-1/2 -translate-x-1/2 w-40 h-5 bg-[#2a2c32] rounded-b-2xl z-50 flex items-center justify-center pointer-events-none">
          {/* Speaker pill */}
          <div className="w-16 h-1 bg-[#151619] rounded-full mb-1" />
        </div>

        {showVirtualStatusHeader && (
          <div className="bg-[#101114] border-b border-[#2a2c32] h-12 flex items-center justify-between px-6 select-none shrink-0 z-40 shadow-[0_1px_0_rgba(255,255,255,0.02)]">
            {/* Time display */}
            <span className="text-xs font-bold tracking-tight text-white/95 font-mono tabular-nums">
              {time || "18:48"}
            </span>

            {/* System status icons */}
            <div className="flex items-center gap-2">
              <span className="max-w-[92px] truncate text-[9px] font-bold text-[#8e9299] mr-1 tracking-[0.16em] uppercase font-mono">
                {shellLabel}
              </span>
              
              {airplaneMode ? (
                <Plane className="w-3.5 h-3.5 text-amber-400 rotate-45 drop-shadow-[0_0_8px_rgba(245,158,11,0.45)]" strokeWidth={2.5} />
              ) : (
                <>
                  <Signal className={`w-3.5 h-3.5 ${wifiEnabled ? 'text-white/90' : 'text-white/40'}`} strokeWidth={2.5} />
                  {wifiEnabled ? (
                    <Wifi className="w-3.5 h-3.5 text-white/90" strokeWidth={2.5} />
                  ) : (
                    <Wifi className="w-3.5 h-3.5 text-white/20 line-through" strokeWidth={2.5} />
                  )}
                </>
              )}

              {bluetoothEnabled && (
                <Bluetooth className="w-3 h-3 text-sky-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.45)]" strokeWidth={2.5} />
              )}

              <div className="flex items-center gap-0.5">
                <span className="text-[10px] font-mono font-medium text-white/90 tabular-nums">{batteryPct}%</span>
                <Battery className={`w-4 h-4 rotate-0 ${batteryTone}`} strokeWidth={2.5} />
              </div>
            </div>
          </div>
        )}

        {/* Screen/App Core Content Area */}
        <div className="flex-1 min-h-0 w-full max-w-full overflow-hidden bg-[#0c0c0d] flex flex-col relative">
          {children}
        </div>

        {showVirtualSystemControls && (
          <div className="h-12 bg-[#151619] border-t border-[#2a2c32] flex items-center justify-around px-8 select-none shrink-0 z-40">
            <button 
              id="virt-back-btn"
              onClick={onBackClick}
              className="text-slate-400 hover:text-white transition-colors duration-150 py-1 px-3"
            >
              <ChevronLeft className="w-5 h-5 flex items-center" />
            </button>
            <button 
              id="virt-home-btn"
              onClick={onHomeClick}
              className="text-slate-400 hover:text-white transition-colors duration-150 py-1 px-3"
            >
              <Circle className="w-4 h-4" />
            </button>
            <button 
              id="virt-app-btn"
              onClick={onHomeClick} 
              className="text-slate-400 hover:text-white transition-colors duration-150 py-1 px-3"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
