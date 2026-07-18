/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Bot, Download, ExternalLink, Home, Smartphone } from "lucide-react";

const CHATGPT_URL = "https://chatgpt.com/";
const CHATGPT_STORE_URL = "https://play.google.com/store/apps/details?id=com.openai.chatgpt";

interface ChatGPTAppProps {
  onNotify?: (message: string, type: "success" | "info" | "warn") => void;
  onBackHome?: () => void;
}

export default function ChatGPTApp({ onNotify, onBackHome }: ChatGPTAppProps) {
  const isNativeShell = Boolean(window.__pocketflowNativeShell);

  const openChatGPTApp = async (silent = false) => {
    try {
      if (window.PocketFlowReceiveBridge?.openChatGPTApp) {
        const result = await window.PocketFlowReceiveBridge.openChatGPTApp();
        if (!silent) onNotify?.(result.message || "Opening ChatGPT app.", result.ok ? "success" : "warn");
        if (result.ok) return;
      }
      window.location.href = CHATGPT_URL;
    } catch (error) {
      window.location.href = CHATGPT_URL;
    }
  };

  const openOfficialWeb = async (silent = false) => {
    try {
      if (window.PocketFlowReceiveBridge?.openExternalUrl) {
        const result = await window.PocketFlowReceiveBridge.openExternalUrl(CHATGPT_URL);
        if (!silent) onNotify?.(result.message || "Opening ChatGPT in browser.", result.ok ? "success" : "warn");
        if (result.ok) return;
      }
      const opened = window.open(CHATGPT_URL, "_blank", "noopener,noreferrer");
      if (!opened) window.location.href = CHATGPT_URL;
    } catch (error) {
      window.location.href = CHATGPT_URL;
    }
  };

  const openInstallPage = async () => {
    try {
      if (window.PocketFlowReceiveBridge?.openExternalUrl) {
        const result = await window.PocketFlowReceiveBridge.openExternalUrl(CHATGPT_STORE_URL);
        onNotify?.(result.message || "Opening ChatGPT install page.", result.ok ? "success" : "warn");
        if (result.ok) return;
      }
      window.location.href = CHATGPT_STORE_URL;
    } catch (error) {
      window.location.href = CHATGPT_STORE_URL;
    }
  };

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col bg-[#0b0b0c] animate-fade-in select-none overflow-hidden">
      <div className="h-16 shrink-0 border-b border-[#2a2c32] bg-[#111216] px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-white leading-none truncate">ChatGPT</h1>
            <p className="text-[8px] uppercase tracking-[0.22em] text-slate-500 font-mono mt-1 truncate">
              chatgpt.com
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onBackHome}
            className="h-10 rounded-2xl border border-[#2a2c32] bg-[#151619] px-3 text-slate-200 flex items-center justify-center gap-2 active:scale-95 transition"
            title="Back to PocketFlow menu"
          >
            <Home className="w-4 h-4" />
            <span className="text-[9px] font-mono font-black uppercase tracking-widest">Menu</span>
          </button>
          <button
            onClick={() => openChatGPTApp(false)}
            className="w-10 h-10 rounded-2xl border border-emerald-500/30 bg-emerald-500 text-black flex items-center justify-center active:scale-95 transition"
            title="Open ChatGPT app"
          >
            <Smartphone className="w-4 h-4" />
          </button>
          <button
            onClick={openInstallPage}
            className="w-10 h-10 rounded-2xl border border-[#2a2c32] bg-[#151619] text-slate-400 flex items-center justify-center active:scale-95 transition"
            title="Install ChatGPT"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 bg-[#0b0b0c] flex items-center justify-center px-6 text-center">
        <div className="w-full max-w-[340px] rounded-[2rem] border border-emerald-500/25 bg-emerald-500/10 p-5 shadow-2xl shadow-black/40">
          <Smartphone className="w-10 h-10 mx-auto text-emerald-400 mb-3" />
          <p className="text-base font-bold text-white">ChatGPT Launcher</p>
          <p className="text-xs text-slate-400 mt-2 leading-relaxed">
            {isNativeShell
              ? "Open the official ChatGPT app when you need it, or return to PocketFlow without using Android navigation."
              : "Phone mode launches the official Android app. Browser preview can still open ChatGPT web."}
          </p>
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              onClick={() => openChatGPTApp(false)}
              className="h-10 rounded-xl bg-emerald-500 text-black font-mono text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Smartphone className="w-4 h-4" /> App
            </button>
            <button
              onClick={() => isNativeShell ? openInstallPage() : openOfficialWeb(false)}
              className="h-10 rounded-xl border border-[#2a2c32] bg-[#0b0b0c] text-slate-300 font-mono text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
            >
              {isNativeShell ? <Download className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
              {isNativeShell ? "Install" : "Web"}
            </button>
          </div>
          <button
            onClick={onBackHome}
            className="mt-3 h-11 w-full rounded-xl border border-[#2a2c32] bg-[#151619] text-slate-200 font-mono text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" /> Back to PocketFlow Menu
          </button>
        </div>
      </div>
    </div>
  );
}
