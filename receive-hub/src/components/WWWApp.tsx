/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Globe2, RefreshCw } from "lucide-react";
import { DEFAULT_WWW_URL } from "../utils/wwwDefaults";

interface WWWAppProps {
  onNotify?: (message: string, type: "success" | "info" | "warn") => void;
  onBack?: () => void;
}

export default function WWWApp({ onNotify, onBack }: WWWAppProps) {
  const [frameKey, setFrameKey] = useState(0);
  const monitorUrl = useMemo(
    () => localStorage.getItem("pocketflow.www.monitorUrl") || DEFAULT_WWW_URL,
    [],
  );

  useEffect(() => {
    localStorage.setItem("pocketflow.www.monitorUrl", monitorUrl);
  }, [monitorUrl]);

  const reloadFrame = () => {
    setFrameKey((key) => key + 1);
    onNotify?.("Reloading Tanuki Monitor.", "info");
  };

  const openExternal = () => {
    window.open(monitorUrl, "_blank", "noopener,noreferrer");
    onNotify?.("Opened Tanuki Monitor in browser.", "info");
  };

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col bg-[#070809] animate-fade-in overflow-hidden">
      <div className="sticky top-0 z-30 border-b border-[#252832] bg-[#111216]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="h-12 px-4 rounded-2xl border border-[#2d313d] bg-[#050607] text-slate-200 text-[11px] font-mono font-black uppercase tracking-[0.2em] flex items-center gap-2 active:scale-[0.98] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Menu
          </button>
          <div className="min-w-0 flex-1 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 flex items-center justify-center shrink-0">
              <Globe2 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-white tracking-tight truncate">Tanuki Monitor</h1>
              <p className="mt-1 text-[9px] font-mono uppercase tracking-[0.2em] text-slate-500 truncate">
                PocketFlow web app
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={reloadFrame}
            className="w-12 h-12 rounded-2xl border border-[#2d313d] bg-[#050607] text-slate-300 flex items-center justify-center active:scale-[0.98] transition"
            aria-label="Reload Tanuki Monitor"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={openExternal}
            className="w-12 h-12 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 flex items-center justify-center active:scale-[0.98] transition"
            aria-label="Open Tanuki Monitor in browser"
          >
            <ExternalLink className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-white">
        <iframe
          key={frameKey}
          src={monitorUrl}
          title="Tanuki Web Monitor"
          className="w-full h-full min-h-[calc(100vh-220px)] border-0 bg-white"
          referrerPolicy="no-referrer-when-downgrade"
          sandbox="allow-downloads allow-forms allow-popups allow-same-origin allow-scripts"
        />
      </div>
    </div>
  );
}
