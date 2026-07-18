/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { ExternalLink, Globe2, Maximize2, Minimize2, Search, Shield, Star, Trash2, X } from "lucide-react";

interface PocketWebAppProps {
  onNotify?: (message: string, type: "success" | "info" | "warn") => void;
}

interface PocketWebStar {
  id: string;
  title: string;
  url: string;
  domain: string;
  createdAt: string;
}

type SearchEngineId = "google" | "bing" | "yahoo" | "opera";

const STARS_KEY = "pocketflow.pocketweb.starred";
const HISTORY_KEY = "pocketflow.pocketweb.history";
const PRIVATE_MODE_KEY = "pocketflow.pocketweb.privateMode";

const SEARCH_ENGINES: Record<SearchEngineId, { label: string; url: (query: string) => string }> = {
  google: { label: "Google", url: (query) => `https://www.google.com/search?igu=1&q=${encodeURIComponent(query)}` },
  bing: { label: "Bing", url: (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}` },
  yahoo: { label: "Yahoo", url: (query) => `https://search.yahoo.com/search?p=${encodeURIComponent(query)}` },
  opera: { label: "Opera", url: (query) => `https://www.google.com/search?igu=1&client=opera&q=${encodeURIComponent(query)}` },
};

const EMBED_BLOCKED_HOSTS = [
  "youtube.com",
  "youtu.be",
  "accounts.google.com",
  "drive.google.com",
  "docs.google.com",
  "chatgpt.com",
  "openai.com",
  "instagram.com",
  "facebook.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
];

const loadStars = (): PocketWebStar[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STARS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveStars = (stars: PocketWebStar[]) => {
  localStorage.setItem(STARS_KEY, JSON.stringify(stars));
};

const loadHistory = (): PocketWebStar[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveHistory = (history: PocketWebStar[]) => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 40)));
};

const normalizeInput = (raw: string, engine: SearchEngineId) => {
  const value = raw.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (/^localhost(:\d+)?(\/.*)?$/i.test(value) || /^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/i.test(value)) {
    return `http://${value}`;
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(value)) {
    return `https://${value}`;
  }
  return SEARCH_ENGINES[engine].url(value);
};

const getDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] || "search";
  }
};

const displayUrl = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

const isEmbedBlockedHost = (url: string) => {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return EMBED_BLOCKED_HOSTS.some((blockedHost) => host === blockedHost || host.endsWith(`.${blockedHost}`));
  } catch {
    return false;
  }
};

export default function PocketWebApp({ onNotify }: PocketWebAppProps) {
  const [stars, setStars] = useState<PocketWebStar[]>(() => loadStars());
  const [history, setHistory] = useState<PocketWebStar[]>(() => loadHistory());
  const [privateMode, setPrivateMode] = useState(() => localStorage.getItem(PRIVATE_MODE_KEY) === "1");
  const [query, setQuery] = useState("");
  const [engine, setEngine] = useState<SearchEngineId>("google");
  const [activeUrl, setActiveUrl] = useState("");
  const [frameKey, setFrameKey] = useState(0);
  const [frameBlocked, setFrameBlocked] = useState(false);
  const [fullPage, setFullPage] = useState(false);
  const nativeShell = Boolean(window.__pocketflowNativeShell);

  const suggestions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const seen = new Set<string>();
    const merged = [...stars, ...history].filter((entry) => {
      if (seen.has(entry.url)) return false;
      seen.add(entry.url);
      return true;
    });
    if (!needle) return merged.slice(0, 6);
    return merged
      .filter((star) => `${star.title} ${star.domain} ${star.url}`.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [query, stars, history]);

  const isStarred = activeUrl && stars.some((star) => star.url === activeUrl);

  const rememberHistory = (url: string) => {
    if (privateMode) return;
    const nextEntry: PocketWebStar = {
      id: `phist_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      title: getDomain(url),
      url,
      domain: getDomain(url),
      createdAt: new Date().toISOString(),
    };
    const next = [nextEntry, ...history.filter((entry) => entry.url !== url)].slice(0, 40);
    setHistory(next);
    saveHistory(next);
  };

  const navigate = async (raw = query) => {
    const nextUrl = normalizeInput(raw, engine);
    if (!nextUrl) return;
    setActiveUrl(nextUrl);
    setQuery(nextUrl);
    setFrameBlocked(false);
    rememberHistory(nextUrl);
    setFrameKey((value) => value + 1);

    if (nativeShell && isEmbedBlockedHost(nextUrl) && window.PocketFlowReceiveBridge?.openPocketBrowser) {
      const result = await window.PocketFlowReceiveBridge.openPocketBrowser(nextUrl);
      onNotify?.(result.message || "Opening direct PocketWeb view.", result.ok ? "success" : "warn");
    } else if (isEmbedBlockedHost(nextUrl)) {
      setFrameBlocked(true);
      onNotify?.("This site blocks embedded preview. Use Direct on the phone PocketFlow app.", "warn");
    }
  };

  const openDirect = async (raw = activeUrl || query) => {
    const nextUrl = normalizeInput(raw, engine);
    if (!nextUrl) return;
    setActiveUrl(nextUrl);
    setQuery(nextUrl);
    rememberHistory(nextUrl);
    setFrameBlocked(false);

    if (window.PocketFlowReceiveBridge?.openPocketBrowser) {
      const result = await window.PocketFlowReceiveBridge.openPocketBrowser(nextUrl);
      onNotify?.(result.message || "Opening direct PocketWeb view.", result.ok ? "success" : "warn");
      return;
    }

    setFrameBlocked(true);
    onNotify?.("Direct PocketWeb needs the phone native shell. Desktop preview cannot bypass frame blocks.", "warn");
  };

  const clearTab = () => {
    setActiveUrl("");
    setQuery("");
    setFrameBlocked(false);
    setFullPage(false);
    setFrameKey((value) => value + 1);
    onNotify?.("PocketWeb tab cleared.", "info");
  };

  const togglePrivateMode = () => {
    const next = !privateMode;
    setPrivateMode(next);
    localStorage.setItem(PRIVATE_MODE_KEY, next ? "1" : "0");
    onNotify?.(next ? "PocketWeb private mode on." : "PocketWeb normal mode on.", "info");
  };

  const toggleStar = () => {
    if (!activeUrl) return;
    const existing = stars.find((star) => star.url === activeUrl);
    const next = existing
      ? stars.filter((star) => star.url !== activeUrl)
      : [
          {
            id: `pweb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
            title: getDomain(activeUrl),
            url: activeUrl,
            domain: getDomain(activeUrl),
            createdAt: new Date().toISOString(),
          },
          ...stars,
        ];
    setStars(next);
    saveStars(next);
    onNotify?.(existing ? "Removed from PocketWeb stars." : "Saved to PocketWeb stars.", existing ? "info" : "success");
  };

  const removeStar = (id: string) => {
    const next = stars.filter((star) => star.id !== id);
    setStars(next);
    saveStars(next);
  };

  const removeHistory = (id: string) => {
    const next = history.filter((entry) => entry.id !== id);
    setHistory(next);
    saveHistory(next);
  };

  const renderBlockedPanel = (fullscreen = false) => (
    <div className="h-full bg-[#070809] text-slate-200 flex items-center justify-center p-6 text-center">
      <div className={`${fullscreen ? "max-w-sm" : "max-w-xs"} rounded-3xl border border-[#2a2c32] bg-[#151619] p-5`}>
        <Globe2 className="w-10 h-10 mx-auto text-cyan-300" />
        <h2 className="mt-3 text-lg font-black text-white">Direct browser required</h2>
        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
          {activeUrl ? getDomain(activeUrl) : "This site"} blocks embedded preview. On the phone, Direct opens it inside PocketFlow native WebView instead of an external browser.
        </p>
        <button
          onClick={() => void openDirect(activeUrl)}
          className="mt-4 w-full h-12 rounded-2xl bg-cyan-400 text-black text-[10px] font-mono font-black uppercase tracking-widest flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Open Direct
        </button>
      </div>
    </div>
  );

  const renderPocketWebViewport = (fullscreen = false) => {
    if (activeUrl && (frameBlocked || isEmbedBlockedHost(activeUrl))) {
      return renderBlockedPanel(fullscreen);
    }

    if (activeUrl) {
      return (
        <>
          <iframe
            key={`${frameKey}-${fullscreen ? "full" : "inline"}`}
            title={fullscreen ? "PocketWeb full page viewport" : "PocketWeb browser viewport"}
            src={activeUrl}
            sandbox="allow-forms allow-scripts allow-same-origin allow-downloads allow-popups allow-popups-to-escape-sandbox"
            allow="fullscreen; clipboard-read; clipboard-write; geolocation; microphone; camera"
            referrerPolicy={privateMode ? "no-referrer" : "strict-origin-when-cross-origin"}
            onLoad={() => setFrameBlocked(false)}
            onError={() => setFrameBlocked(true)}
            className="w-full h-full border-0 bg-white"
          />
          {frameBlocked && (
            <div className="absolute inset-0 bg-[#070809] text-slate-200 flex items-center justify-center p-6 text-center">
              <div className={`${fullscreen ? "max-w-sm" : "max-w-xs"} rounded-3xl border border-[#2a2c32] bg-[#151619] p-5`}>
                <Globe2 className="w-10 h-10 mx-auto text-cyan-300" />
                <h2 className="mt-3 text-lg font-black text-white">Site blocked preview</h2>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  This website rejects embedded browser preview. PocketWeb kept you inside this screen and did not open another page.
                </p>
              </div>
            </div>
          )}
        </>
      );
    }

    return (
      <div className="h-full bg-[#070809] text-slate-200 flex flex-col items-center justify-center p-6 text-center">
        <Globe2 className="w-12 h-12 text-cyan-300" />
        <h2 className="mt-4 text-lg font-black text-white">Pocket Search</h2>
        <p className="mt-2 text-xs text-slate-500 max-w-xs leading-relaxed">
          Type a domain or search phrase. Results stay inside this PocketWeb screen; starred sites and normal-mode recents appear as suggestions.
        </p>
        {stars.length > 0 && (
          <div className="mt-6 w-full max-w-xs space-y-2">
            {stars.slice(0, 4).map((star) => (
              <div key={star.id} className="grid grid-cols-[1fr_auto] gap-2">
                <button
                  onClick={() => void navigate(star.url)}
                  className="min-w-0 rounded-xl border border-[#2a2c32] bg-[#151619] p-3 text-left"
                >
                  <span className="block text-xs font-bold text-white truncate">{star.title}</span>
                  <span className="block text-[9px] font-mono text-slate-500 truncate">{displayUrl(star.url)}</span>
                </button>
                <button
                  onClick={() => removeStar(star.id)}
                  className="w-11 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        {!privateMode && history.length > 0 && (
          <div className="mt-4 w-full max-w-xs space-y-2">
            <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500 text-left">Recent</div>
            {history.slice(0, 4).map((entry) => (
              <div key={entry.id} className="grid grid-cols-[1fr_auto] gap-2">
                <button
                  onClick={() => void navigate(entry.url)}
                  className="min-w-0 rounded-xl border border-[#2a2c32] bg-[#151619] p-3 text-left"
                >
                  <span className="block text-xs font-bold text-white truncate">{entry.title}</span>
                  <span className="block text-[9px] font-mono text-slate-500 truncate">{displayUrl(entry.url)}</span>
                </button>
                <button
                  onClick={() => removeHistory(entry.id)}
                  className="w-11 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 min-w-0 bg-[#070809] text-slate-100 flex flex-col animate-fade-in overflow-hidden">
      {fullPage && activeUrl && (
        <div className="fixed inset-0 z-[999] bg-[#070809] text-slate-100 flex flex-col">
          <div className="shrink-0 h-14 border-b border-[#2a2c32] bg-[#0c0c0d] px-3 flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 flex items-center justify-center shrink-0">
              <Globe2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[8px] font-mono uppercase tracking-[0.22em] text-cyan-300">PocketWeb full page</div>
              <div className="mt-0.5 text-[10px] font-mono text-slate-400 truncate">{displayUrl(activeUrl)}</div>
            </div>
            <button
              onClick={() => setFullPage(false)}
              className="w-11 h-11 rounded-2xl border border-[#2a2c32] bg-[#151619] text-cyan-300 flex items-center justify-center"
              title="Exit full page"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                setFullPage(false);
                clearTab();
              }}
              className="w-11 h-11 rounded-2xl border border-[#2a2c32] bg-[#151619] text-slate-300 flex items-center justify-center"
              title="Close page"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 min-h-0 bg-white relative">
            {renderPocketWebViewport(true)}
          </div>
        </div>
      )}

      <div className="shrink-0 border-b border-[#2a2c32] bg-[#151619] px-4 py-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 flex items-center justify-center">
              <Globe2 className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black text-white leading-none tracking-tight">PocketWeb</h1>
              <p className="mt-1 text-[9px] font-mono uppercase tracking-[0.24em] text-slate-500 truncate">
                Pocket browser
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleStar}
              disabled={!activeUrl}
              className={`w-11 h-11 rounded-2xl border flex items-center justify-center transition disabled:opacity-35 ${
                isStarred ? "border-amber-400/40 bg-amber-400/15 text-amber-300" : "border-[#2a2c32] bg-[#0c0c0d] text-slate-300"
              }`}
              title="Star current website"
            >
              <Star className={`w-5 h-5 ${isStarred ? "fill-current" : ""}`} />
            </button>
            <button
              onClick={clearTab}
              className="w-11 h-11 rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] text-slate-300 flex items-center justify-center"
              title="Clear tab"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void navigate();
          }}
          className="grid grid-cols-[1fr_auto_auto] gap-2"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search or enter a full domain"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full h-12 rounded-2xl bg-[#0c0c0d] border border-[#2a2c32] pl-10 pr-3 text-sm text-slate-100 outline-none focus:border-cyan-400/50 font-mono"
            />
          </div>
          <button className="h-12 px-4 rounded-2xl bg-cyan-400 text-black text-[10px] font-mono font-black uppercase tracking-widest">
            Go
          </button>
          <button
            type="button"
            onClick={() => {
              const nextUrl = normalizeInput(activeUrl || query, engine);
              if (!nextUrl) {
                onNotify?.("Open a webpage first.", "warn");
                return;
              }
              if (!activeUrl) {
                void navigate(nextUrl).then(() => setFullPage(true));
                return;
              }
              setFullPage(true);
            }}
            className="h-12 w-12 rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] text-cyan-300 flex items-center justify-center"
            title="Open full page"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
        </form>

        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={togglePrivateMode}
            className={`shrink-0 px-3 py-2 rounded-xl border text-[9px] font-mono font-bold uppercase tracking-wider ${
              privateMode ? "border-amber-400/40 bg-amber-400/10 text-amber-300" : "border-[#22c55e]/30 bg-[#22c55e]/10 text-[#22c55e]"
            }`}
          >
            {privateMode ? "Private" : "Normal"}
          </button>
          {(Object.keys(SEARCH_ENGINES) as SearchEngineId[]).map((id) => (
            <button
              key={id}
              onClick={() => setEngine(id)}
              className={`shrink-0 px-3 py-2 rounded-xl border text-[9px] font-mono font-bold uppercase tracking-wider ${
                engine === id ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300" : "border-[#2a2c32] bg-[#0c0c0d] text-slate-500"
              }`}
            >
              {SEARCH_ENGINES[id].label}
            </button>
          ))}
        </div>

        {suggestions.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            {suggestions.map((star) => (
              <button
                key={star.id}
                onClick={() => void navigate(star.url)}
                className="shrink-0 max-w-[190px] rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-left"
              >
                <span className="block text-[10px] font-bold text-amber-200 truncate">{star.title}</span>
                <span className="block text-[8px] font-mono text-slate-500 truncate">{displayUrl(star.url)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-b border-[#2a2c32] bg-[#0c0c0d] px-4 py-2 flex items-center gap-2">
        <Shield className="w-4 h-4 text-[#22c55e]" />
        <span className="min-w-0 flex-1 text-[9px] font-mono uppercase tracking-widest text-slate-500 truncate">
          {activeUrl ? displayUrl(activeUrl) : privateMode ? "Private tab ready" : "Browser tab ready"}
        </span>
        {activeUrl && (
          <button
            onClick={() => void openDirect(activeUrl)}
            className="shrink-0 text-[9px] font-mono font-black uppercase tracking-widest text-cyan-300"
          >
            Direct
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 bg-white relative">
        {renderPocketWebViewport(false)}
      </div>
    </div>
  );
}
