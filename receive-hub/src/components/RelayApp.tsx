/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  ExternalLink,
  FileUp,
  FolderOpen,
  KeyRound,
  Link2,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Paperclip,
  PlugZap,
  RefreshCw,
  Send,
  ShieldCheck,
  TerminalSquare,
  Wifi,
  XCircle,
} from "lucide-react";
import { PUBLIC_RELEASE_MODE } from "../utils/publicRelease";

interface RelayAppProps {
  bridgeAvailable: boolean;
  origin: string;
  onNotify?: (message: string, type: "success" | "info" | "warn") => void;
}

type RelayConnectionState = "online" | "checking" | "standby" | "offline";

type RelayFeedKind = "prompt" | "reasoning" | "build" | "system";

interface RelayFeedItem {
  id: string;
  kind: RelayFeedKind;
  title: string;
  body: string;
  at: string;
  timeMs?: number;
  projectId?: string;
  projectLabel?: string;
  state?: "queued" | "syncing" | "running" | "delivered" | "done" | "blocked";
  previewUrl?: string;
}

interface RelayProject {
  id: string;
  label: string;
  detail: string;
  updatedAt?: string;
  active?: boolean;
  pinned?: boolean;
  kind?: string;
}

interface RelayPromptRecord {
  id: string;
  projectId?: string;
  projectLabel?: string;
  prompt?: string;
  source?: string;
  createdAt?: string;
  state?: "queued" | "syncing" | "running" | "delivered" | "done" | "blocked";
  activity?: string;
  error?: string;
  response?: string;
  responseExcerpt?: string;
  lastResponse?: string;
  startedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
  previewUrl?: string;
  outputPath?: string;
}

interface RelayStatusPayload {
  ok?: boolean;
  message?: string;
  startedAt?: string;
  uptimeSeconds?: number;
  queueDepth?: number;
  lastPromptAt?: string | null;
  activeCodexThreadId?: string;
  projectsAvailable?: boolean;
  workerOnline?: boolean;
  workerPid?: number | null;
  preview?: {
    online?: boolean;
    pid?: number | null;
    port?: number;
    urls?: string[];
    recommended?: string[];
  };
  authEnabled?: boolean;
  relayPort?: number;
  requesterIp?: string;
  device?: {
    name?: string;
    platform?: string;
    arch?: string;
  };
  remoteDevices?: Array<{
    id?: string;
    name?: string;
    kind?: string;
    host?: string;
    port?: number;
    url?: string;
    detail?: string;
    online?: boolean;
    checkedAt?: string;
  }>;
  lan?: unknown;
  recommended?: unknown;
}

interface RelayHandoffFile {
  name: string;
  relativePath: string;
  path: string;
  type: string;
  size: number;
}

interface RelayHandoff {
  id: string;
  rootPath: string;
  totalBytes: number;
  files: RelayHandoffFile[];
}

type FolderInputElement = HTMLInputElement & {
  webkitdirectory?: boolean;
  directory?: boolean;
};

const RELAY_PUBLIC_PREFIX = "pocketflowFinal.public.codexRelay";
const RELAY_ENDPOINT_KEY = `${RELAY_PUBLIC_PREFIX}.endpoint`;
const RELAY_DISCOVERED_ENDPOINTS_KEY = `${RELAY_PUBLIC_PREFIX}.discoveredEndpoints`;
const RELAY_TOKEN_KEY = `${RELAY_PUBLIC_PREFIX}.token`;
const RELAY_QUEUE_KEY = `${RELAY_PUBLIC_PREFIX}.localQueue`;
const RELAY_SELECTED_PROJECT_KEY = `${RELAY_PUBLIC_PREFIX}.selectedProjectId`;
const RELAY_PROJECT_PICKER_KEY = `${RELAY_PUBLIC_PREFIX}.projectPickerOpen`;
const RELAY_PING_ONLINE_MS = 15000;
const RELAY_PING_RECOVERY_MS = 10000;
const RELAY_QUEUE_POLL_MS = 5000;
const RELAY_PROJECT_POLL_MS = 7000;
const RELAY_STATUS_TIMEOUT_MS = 6500;
const RELAY_PROJECT_FETCH_LIMIT = 80;
const DEFAULT_RELAY_ENDPOINTS = PUBLIC_RELEASE_MODE ? [] : [
  "http://127.0.0.1:8788",
  "http://localhost:8788",
];

const FALLBACK_CODEX_PROJECTS: RelayProject[] = [
  {
    id: "public-demo-builder",
    label: "Public Builder Demo",
    detail: "Demo project",
    active: true,
    kind: "codex-thread",
  },
  {
    id: "public-demo-release",
    label: "Public Release Demo",
    detail: "Demo project",
    kind: "codex-thread",
  },
  {
    id: "public-demo-archive",
    label: "Public Archive Demo",
    detail: "Demo project",
    kind: "codex-thread",
  },
];

const MAX_RELAY_ATTACHMENT_FILES = 200;
const MAX_RELAY_ATTACHMENT_BYTES = 80 * 1024 * 1024;

const nowTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const formatQueueTime = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return nowTime();
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatBytes = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size >= 10 || index === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
};

const promptTimeMs = (value?: string) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? Date.now() : date.getTime();
};

const trimOrigin = (origin: string) => origin.replace(/^https?:\/\//, "").replace(/\/+$/, "");

const createId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const getCurrentBrowserOrigin = () => {
  if (typeof window === "undefined") return "";
  try {
    return `${window.location.protocol}//${window.location.host}`.replace(/\/+$/, "");
  } catch {
    return "";
  }
};

const normalizeRelayEndpoint = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    const parsed = new URL(withProtocol);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "";
  }
};

const isLoopbackHost = (host: string) => {
  const clean = host.toLowerCase();
  return clean === "localhost" || clean === "127.0.0.1" || clean === "::1" || clean === "[::1]";
};

const isTailscaleHost = (host: string) => {
  const match = host.match(/^100\.(\d{1,3})\./);
  if (!match) return false;
  const second = Number(match[1]);
  return second >= 64 && second <= 127;
};

const isPrivateLanHost = (host: string) => (
  /^10\./.test(host)
  || /^192\.168\./.test(host)
  || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
);

type RelayRouteKind = "public" | "vpn" | "home" | "local" | "unknown";

const relayRouteInfo = (endpoint: string): { kind: RelayRouteKind; label: string; detail: string; remoteReady: boolean } => {
  try {
    const parsed = new URL(normalizeRelayEndpoint(endpoint));
    const host = parsed.hostname;
    if (isLoopbackHost(host)) {
      return {
        kind: "local",
        label: "Local USB / desktop",
        detail: "Works only on this computer or through Android reverse.",
        remoteReady: false,
      };
    }
    if (isTailscaleHost(host) || host.endsWith(".ts.net")) {
      return {
        kind: "vpn",
        label: "VPN remote",
        detail: "Works away from home when both devices are on the VPN.",
        remoteReady: true,
      };
    }
    if (isPrivateLanHost(host)) {
      return {
        kind: "home",
        label: "Home Wi-Fi only",
        detail: "This route will fail on 3G/4G unless a public tunnel or VPN is active.",
        remoteReady: false,
      };
    }
    return {
      kind: "public",
      label: "Public remote",
      detail: "Works from mobile data when the desktop Relay is online.",
      remoteReady: true,
    };
  } catch {
    return {
      kind: "unknown",
      label: "Unknown route",
      detail: "Set a reachable HTTPS relay URL.",
      remoteReady: false,
    };
  }
};

const hostForUrl = (host: string) => (host.includes(":") && !host.startsWith("[") ? `[${host}]` : host);

const relayEndpointFromOrigin = (origin: string) => {
  const normalized = normalizeRelayEndpoint(origin);
  if (!normalized) return "http://localhost:8788";
  try {
    const parsed = new URL(normalized);
    return `http://${hostForUrl(parsed.hostname)}:8788`;
  } catch {
    return "http://localhost:8788";
  }
};

const resolveDeviceRelayEndpoint = (value: string, fallback: string) => {
  const normalized = normalizeRelayEndpoint(value) || normalizeRelayEndpoint(fallback);
  if (!normalized || typeof window === "undefined") return normalized;
  try {
    const parsed = new URL(normalized);
    const pageHost = window.location.hostname;
    const pagePort = window.location.port;
    const runningOnPhoneLan = pageHost && !isLoopbackHost(pageHost) && !isPocketFlowLocalHost();
    const pointsAtThisAppPort = parsed.hostname === pageHost && parsed.port === pagePort && parsed.port !== "8788";
    if ((runningOnPhoneLan && isLoopbackHost(parsed.hostname)) || pointsAtThisAppPort) {
      return `http://${hostForUrl(pageHost)}:8788`;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return normalizeRelayEndpoint(fallback);
  }
};

const relayUrlsFromList = (items: unknown) => (
  Array.isArray(items) ? items : []
)
    .map((item) => (typeof item === "string" ? item : ""))
    .map(normalizeRelayEndpoint)
    .filter(Boolean);

const relayUrlsFromStatus = (payload: { lan?: unknown; recommended?: unknown }) => {
  return rankRelayEndpoints([
    ...relayUrlsFromList(payload?.recommended),
    ...relayUrlsFromList(payload?.lan),
  ]);
};

const bestRelayUrlFromStatus = (payload: { lan?: unknown; recommended?: unknown }) => {
  const urls = relayUrlsFromStatus(payload);
  if (!urls.length) return "";
  const remote = urls.filter((url) => {
    try {
      return relayRouteInfo(url).remoteReady;
    } catch {
      return false;
    }
  });
  return remote[0] || urls[0] || "";
};

const previewOriginFromRelayStatus = (payload: { lan?: unknown; recommended?: unknown; preview?: RelayStatusPayload["preview"] }) => {
  const previewUrls = rankRelayEndpoints([
    ...relayUrlsFromList(payload?.preview?.recommended),
    ...relayUrlsFromList(payload?.preview?.urls),
  ]);
  if (previewUrls.length) {
    return previewUrls[0];
  }
  const bestRelayUrl = bestRelayUrlFromStatus(payload);
  if (!bestRelayUrl) return "";
  try {
    const parsed = new URL(bestRelayUrl);
    return `${parsed.protocol}//${hostForUrl(parsed.hostname)}:3000`;
  } catch {
    return "";
  }
};

const previewOriginFromRelayUrl = (relayUrl: string) => {
  try {
    const parsed = new URL(relayUrl);
    return `${parsed.protocol}//${hostForUrl(parsed.hostname)}:3000`;
  } catch {
    return "";
  }
};

const rewritePreviewUrlToOrigin = (target: string, origin: string) => {
  try {
    const parsed = new URL(target);
    const replacement = new URL(origin);
    parsed.protocol = replacement.protocol;
    parsed.hostname = replacement.hostname;
    parsed.port = replacement.port;
    return parsed.toString();
  } catch {
    return target;
  }
};

const relayAuthHeaders = (token: string, extra?: Record<string, string>) => ({
  ...(extra || {}),
  "x-pocketflow-relay-token": token,
});

const relayAuthQuery = (token: string) => `token=${encodeURIComponent(token)}`;

const fetchWithRelayTimeout = async (url: string, init: RequestInit = {}, timeoutMs = RELAY_STATUS_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: init.signal || controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
};

const relayRouteLabel = (endpoint: string) => {
  return relayRouteInfo(endpoint).label;
};

const shortEndpoint = (endpoint: string) => {
  try {
    const parsed = new URL(normalizeRelayEndpoint(endpoint));
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}`;
  } catch {
    return endpoint || "not set";
  }
};

const routeAttemptLabel = (endpoint: string) => `${relayRouteLabel(endpoint)} ${shortEndpoint(endpoint)}`;

const fetchRelayStatus = async (relayUrl: string, ticket: string) => {
  const endpoint = normalizeRelayEndpoint(relayUrl);
  if (!endpoint) throw new Error("invalid relay url");
  const response = await fetchWithRelayTimeout(`${endpoint}/relay/status?${relayAuthQuery(ticket)}`, {
      cache: "no-store",
      headers: relayAuthHeaders(ticket, { Accept: "application/json" }),
  });
  if (!response.ok) throw new Error(`status ${response.status}`);
  return { endpoint, payload: await response.json() as RelayStatusPayload };
};

const loadStoredRelayEndpoints = () => {
  if (PUBLIC_RELEASE_MODE) return [];
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(RELAY_DISCOVERED_ENDPOINTS_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.map((item) => (typeof item === "string" ? normalizeRelayEndpoint(item) : "")).filter(Boolean)
      : [];
  } catch {
    return [];
  }
};

const pageRelayEndpoint = () => {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  if (!host || isPocketFlowLocalHost()) return "";
  if (isLoopbackHost(host)) return "http://127.0.0.1:8788";
  return `http://${hostForUrl(host)}:8788`;
};

const loadRelayEndpointFromUrl = () => {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return normalizeRelayEndpoint(params.get("relayEndpoint") || params.get("relayHost") || "");
};

const relayEndpointScore = (endpoint: string) => {
  try {
    const route = relayRouteInfo(endpoint);
    const host = new URL(endpoint).hostname;
    const pageHost = typeof window === "undefined" ? "" : window.location.hostname;
    if (route.kind === "public") return 0;
    if (isLoopbackHost(host) && (!pageHost || isPocketFlowLocalHost())) return 0.5;
    // Prefer a reachable home relay over a stale VPN route. Tailscale remains
    // a fallback for mobile-data/off-site use, but it must not delay LAN login.
    if (route.kind === "home") return 1;
    if (route.kind === "vpn") return 2;
    if (isLoopbackHost(host)) return isLoopbackHost(pageHost) ? 2 : 6;
    if (pageHost && !isPocketFlowLocalHost() && host === pageHost) return 3;
    return 8;
  } catch {
    return 9;
  }
};

const rankRelayEndpoints = (endpoints: string[]) => {
  const unique = Array.from(new Set(endpoints.map(normalizeRelayEndpoint).filter(Boolean)));
  return unique.sort((a, b) => {
    const scoreDiff = relayEndpointScore(a) - relayEndpointScore(b);
    return scoreDiff || a.localeCompare(b);
  });
};

const uniqueRelayEndpoints = (endpoints: string[]) => Array.from(new Set(
  endpoints.map(normalizeRelayEndpoint).filter(Boolean),
));

const relayCandidateEndpoints = (current: string, fallback: string) => {
  const urlEndpoint = loadRelayEndpointFromUrl();
  const currentEndpoint = resolveDeviceRelayEndpoint(current, fallback) || "";
  const ranked = rankRelayEndpoints(uniqueRelayEndpoints([
    currentEndpoint,
    ...loadStoredRelayEndpoints(),
    pageRelayEndpoint(),
    fallback,
    ...DEFAULT_RELAY_ENDPOINTS,
  ]).filter((endpoint) => endpoint !== urlEndpoint));
  return urlEndpoint ? [urlEndpoint, ...ranked] : ranked;
};

const storeDiscoveredRelayEndpoints = (endpoints: string[]) => {
  if (PUBLIC_RELEASE_MODE) return;
  if (typeof localStorage === "undefined") return;
  const ranked = rankRelayEndpoints([
    ...endpoints,
    ...loadStoredRelayEndpoints(),
  ]).slice(0, 8);
  localStorage.setItem(RELAY_DISCOVERED_ENDPOINTS_KEY, JSON.stringify(ranked));
};

const isPocketFlowLocalHost = () => (
  typeof window !== "undefined" && window.location.hostname.toLowerCase() === "pocketflow.local"
);

const createRelayTicket = () => {
  const bytes = new Uint8Array(10);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const loadRelayTicket = () => {
  if (PUBLIC_RELEASE_MODE) return "";
  if (typeof window === "undefined") return createRelayTicket();
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("relayToken") || params.get("relayTicket") || "";
  const token = fromUrl.trim() || window.localStorage.getItem(RELAY_TOKEN_KEY) || createRelayTicket();
  window.localStorage.setItem(RELAY_TOKEN_KEY, token);
  return token;
};

const loadStoredEndpoint = () => {
  if (PUBLIC_RELEASE_MODE) return "";
  if (typeof window === "undefined") return "";
  return loadRelayEndpointFromUrl() || window.localStorage.getItem(RELAY_ENDPOINT_KEY) || "";
};

const storeEndpoint = (endpoint: string) => {
  if (PUBLIC_RELEASE_MODE) return;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RELAY_ENDPOINT_KEY, endpoint);
};

const loadStoredProjectId = () => {
  if (PUBLIC_RELEASE_MODE) return FALLBACK_CODEX_PROJECTS[0]?.id || "";
  if (typeof window === "undefined") return "";
  const stored = window.localStorage.getItem(RELAY_SELECTED_PROJECT_KEY) || "";
  return stored;
};

const storeProjectId = (projectId: string) => {
  if (PUBLIC_RELEASE_MODE) return;
  if (typeof window === "undefined" || !projectId) return;
  window.localStorage.setItem(RELAY_SELECTED_PROJECT_KEY, projectId);
};

const loadLocalQueue = (): RelayFeedItem[] => {
  if (PUBLIC_RELEASE_MODE) return [];
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RELAY_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.slice(-12).map((item: RelayFeedItem) => (
          item?.state === "syncing" ? { ...item, state: "queued" } : item
        ))
      : [];
  } catch {
    return [];
  }
};

const storeLocalQueue = (items: RelayFeedItem[]) => {
  if (PUBLIC_RELEASE_MODE) return;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RELAY_QUEUE_KEY, JSON.stringify(items.slice(-18)));
};

const loadProjectPickerOpen = () => {
  if (PUBLIC_RELEASE_MODE) return false;
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(RELAY_PROJECT_PICKER_KEY) !== "0";
};

const storeProjectPickerOpen = (open: boolean) => {
  if (PUBLIC_RELEASE_MODE) return;
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RELAY_PROJECT_PICKER_KEY, open ? "1" : "0");
};

const isSelectableCodexProject = (project?: RelayProject) => (
  Boolean(project?.id)
);

const projectTimeMs = (project: RelayProject) => {
  const date = project.updatedAt ? new Date(project.updatedAt) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
};

const normalizeRelayProjects = (projects: RelayProject[]) => {
  const byId = new Map<string, RelayProject>();
  for (const project of projects) {
    if (!project?.id || !project?.label) continue;
    const current = byId.get(project.id);
    byId.set(project.id, {
      ...current,
      ...project,
      pinned: Boolean(project.pinned || current?.pinned),
      active: Boolean(project.active || current?.active),
    });
  }
  return Array.from(byId.values()).sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.active !== b.active) return a.active ? -1 : 1;
    return projectTimeMs(b) - projectTimeMs(a);
  });
};

const isStaleBlockedRelayItem = (item?: RelayFeedItem) => (
  Boolean(item)
  && item?.state === "blocked"
  && Date.now() - (item.timeMs || 0) > 1000 * 60 * 20
);

const extractFirstPreviewUrl = (text: string) => {
  const urls = text.match(/https?:\/\/[^\s`)"']+/g) || [];
  return urls.find((url) => {
    try {
      const parsed = new URL(url.replace(/[`).,\]]+$/g, ""));
      return parsed.port === "3000" || parsed.searchParams.has("app") || parsed.searchParams.has("preview");
    } catch {
      return false;
    }
  })?.replace(/[`).,\]]+$/g, "") || "";
};

const isRelayResultPreviewUrl = (url?: string) => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("app") === "relay"
      && (parsed.searchParams.get("preview") || "").startsWith("relay-result-");
  } catch {
    return url.includes("preview=relay-result-");
  }
};

const relayPromptToFeedItem = (prompt: RelayPromptRecord): RelayFeedItem => {
  const response = (prompt.lastResponse || prompt.responseExcerpt || prompt.response || "").trim();
  const activity = prompt.activity?.trim();
  const error = prompt.error?.trim();
  const base = prompt.prompt || "Empty prompt";
  const body = response
    ? `${base}\n\nCodex:\n${response}`
    : error
      ? `${base}\n\nError:\n${error}`
      : activity
        ? `${base}\n\nRunning:\n${activity}`
        : base;
  return {
    id: `relay-${prompt.id}`,
    kind: prompt.state === "done" ? "build" : "prompt",
    title: prompt.projectLabel || "Codex queued prompt",
    body,
    at: formatQueueTime(prompt.completedAt || prompt.createdAt),
    timeMs: promptTimeMs(prompt.completedAt || prompt.createdAt),
    projectId: prompt.projectId,
    projectLabel: prompt.projectLabel,
    state: prompt.state || "queued",
    previewUrl: prompt.previewUrl || extractFirstPreviewUrl(response || ""),
  };
};

const mergeFeedItems = (current: RelayFeedItem[], incoming: RelayFeedItem[]) => {
  const byId = new Map<string, RelayFeedItem>();
  for (const item of [...current, ...incoming]) {
    byId.set(item.id, item);
  }
  return Array.from(byId.values())
    .sort((a, b) => (b.timeMs || 0) - (a.timeMs || 0))
    .slice(0, 180);
};

const relayStateText = (state?: RelayFeedItem["state"]) => {
  switch (state) {
    case "done":
      return "done";
    case "blocked":
      return "blocked";
    case "running":
      return "running";
    case "queued":
      return "desktop received";
    case "syncing":
      return "sending";
    case "delivered":
      return "delivered";
    default:
      return "ready";
  }
};

const permissionNeededPattern = /(permission|approval|approve|authorize|grant|confirm|sandbox|needs.*approval|requires.*permission|allow)/i;

const splitRelayBody = (body: string) => {
  const [prompt, codex] = body.split(/\n\nCodex:\n/);
  if (codex !== undefined) return { prompt: prompt.trim(), codex: codex.trim(), error: "", running: "" };
  const [errorPrompt, error] = body.split(/\n\nError:\n/);
  if (error !== undefined) return { prompt: errorPrompt.trim(), codex: "", error: error.trim(), running: "" };
  const [runningPrompt, running] = body.split(/\n\nRunning:\n/);
  if (running !== undefined) return { prompt: runningPrompt.trim(), codex: "", error: "", running: running.trim() };
  return { prompt: body.trim(), codex: "", error: "", running: "" };
};

const relayStatusMeta = (item: RelayFeedItem) => {
  const permissionNeeded = item.state === "blocked" && permissionNeededPattern.test(item.body);
  if (permissionNeeded) {
    return {
      label: "PERMISSION NEEDED",
      icon: KeyRound,
      tone: "text-amber-200",
      badge: "border-amber-400/50 bg-amber-400/15 text-amber-200",
      border: "border-amber-400/40",
      permissionNeeded,
    };
  }
  if (item.state === "blocked") {
    return {
      label: "ERROR",
      icon: XCircle,
      tone: "text-red-300",
      badge: "border-red-400/50 bg-red-500/15 text-red-200",
      border: "border-red-400/35",
      permissionNeeded,
    };
  }
  if (item.state === "done" || item.state === "delivered") {
    if (!item.previewUrl) {
      return {
        label: "DONE · NO PREVIEW",
        icon: CheckCircle2,
        tone: "text-amber-200",
        badge: "border-amber-400/45 bg-amber-400/15 text-amber-100",
        border: "border-amber-400/30",
        permissionNeeded,
      };
    }
    return {
      label: "COMPLETED",
      icon: CheckCircle2,
      tone: "text-[#22c55e]",
      badge: "border-[#22c55e]/45 bg-[#22c55e]/15 text-[#22c55e]",
      border: "border-[#22c55e]/35",
      permissionNeeded,
    };
  }
  if (item.state === "syncing" || item.state === "running" || item.state === "queued") {
    return {
      label: "STILL BUILDING",
      icon: item.state === "queued" ? ClipboardList : Loader2,
      tone: "text-cyan-200",
      badge: "border-cyan-300/45 bg-cyan-300/15 text-cyan-100",
      border: "border-cyan-300/30",
      permissionNeeded,
    };
  }
  return {
    label: "READY",
    icon: ClipboardList,
    tone: "text-slate-400",
    badge: "border-[#2a2c32] bg-black/30 text-slate-300",
    border: "border-[#2a2c32]",
    permissionNeeded,
  };
};

const getFileRelativePath = (file: File) => (
  (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
);

const readFileAsRelayPayload = (file: File) => new Promise<{
  name: string;
  relativePath: string;
  type: string;
  size: number;
  data: string;
}>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
  reader.onload = () => {
    const result = String(reader.result || "");
    resolve({
      name: file.name,
      relativePath: getFileRelativePath(file),
      type: file.type || "application/octet-stream",
      size: file.size,
      data: result.includes(",") ? result.split(",").pop() || "" : result,
    });
  };
  reader.readAsDataURL(file);
});

export default function RelayApp({
  bridgeAvailable,
  origin,
  onNotify,
}: RelayAppProps) {
  const [relayTicket] = useState(loadRelayTicket);
  const relayOrigin = useMemo(() => {
    const cleanOrigin = origin.replace(/\/+$/, "");
    const currentOrigin = getCurrentBrowserOrigin();
    if (cleanOrigin && !/pocketflow\.local/i.test(cleanOrigin)) return cleanOrigin;
    return currentOrigin || cleanOrigin || "http://localhost:3000";
  }, [origin]);
  const fallbackRelayEndpoint = useMemo(() => (
    PUBLIC_RELEASE_MODE ? "" : relayEndpointFromOrigin(relayOrigin)
  ), [relayOrigin]);
  const [relayEndpoint, setRelayEndpoint] = useState(() => (
    PUBLIC_RELEASE_MODE ? "" : resolveDeviceRelayEndpoint(loadStoredEndpoint(), fallbackRelayEndpoint) || fallbackRelayEndpoint
  ));
  const [endpointDraft, setEndpointDraft] = useState(() => (
    PUBLIC_RELEASE_MODE ? "" : resolveDeviceRelayEndpoint(loadStoredEndpoint(), fallbackRelayEndpoint) || fallbackRelayEndpoint
  ));
  const [connectionState, setConnectionState] = useState<RelayConnectionState>(PUBLIC_RELEASE_MODE ? "standby" : "checking");
  const [connectionLabel, setConnectionLabel] = useState(PUBLIC_RELEASE_MODE ? "public demo mode" : "checking relay");
  const [connectionDiagnostics, setConnectionDiagnostics] = useState(PUBLIC_RELEASE_MODE ? "Live relay endpoints, private chats, tokens and desktop project sync are disabled in PocketFlowFinal." : "");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [relayStatus, setRelayStatus] = useState<RelayStatusPayload | null>(null);
  const [queueLabel, setQueueLabel] = useState("queue not checked");
  const [lastPingAt, setLastPingAt] = useState(() => new Date());
  const [projects, setProjects] = useState<RelayProject[]>(() => normalizeRelayProjects(FALLBACK_CODEX_PROJECTS));
  const [projectsSource, setProjectsSource] = useState(PUBLIC_RELEASE_MODE ? "public demo" : "local fallback");
  const [projectsSyncedAt, setProjectsSyncedAt] = useState<Date | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState(() => loadStoredProjectId());
  const [promptText, setPromptText] = useState("");
  const [dictationActive, setDictationActive] = useState(false);
  const [dictationInterim, setDictationInterim] = useState("");
  const [dictationStatus, setDictationStatus] = useState("Voice ready.");
  const [isSending, setIsSending] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [showConnectionDetails, setShowConnectionDetails] = useState(false);
  const [showRelayControls, setShowRelayControls] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showMirrorHistory, setShowMirrorHistory] = useState(false);
  const [publicPreviewOrigin, setPublicPreviewOrigin] = useState("");
  const [previewPanelUrl, setPreviewPanelUrl] = useState("");
  const [previewPanelDismissedUrl, setPreviewPanelDismissedUrl] = useState("");
  const mirrorRef = useRef<HTMLElement | null>(null);
  const previewPanelRef = useRef<HTMLElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<FolderInputElement | null>(null);
  const sendLockRef = useRef(false);
  const relayDictationActiveRef = useRef(false);
  const relayDictationRestartTimerRef = useRef<number | null>(null);
  const browserRecognitionRef = useRef<any>(null);
  const relayPingPromiseRef = useRef<Promise<boolean> | null>(null);
  const relaySyncPromiseRef = useRef<Promise<void> | null>(null);
  const wakeLockRef = useRef<{ release?: () => Promise<void> } | null>(null);
  const [feed, setFeed] = useState<RelayFeedItem[]>(() => {
    const stored = loadLocalQueue();
    if (stored.length) return stored;
    return [
      {
        id: "system-ready",
        kind: "system",
        title: PUBLIC_RELEASE_MODE ? "Public relay demo ready" : "Relay shell ready",
        body: PUBLIC_RELEASE_MODE
          ? "This public shell demonstrates the relay interface with sanitized demo projects. Live desktop sync, private chats, tokens and server routes are intentionally removed."
          : "Send prompts from the phone into the selected Codex project. Builds stay on the computer; install to PocketFlow phone only when you choose a phone update.",
        at: nowTime(),
        timeMs: Date.now(),
        state: "queued",
      },
    ];
  });

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const selectedProjectLabel = selectedProject?.label || "Choose Codex project";
  const attachedBytes = attachedFiles.reduce((sum, file) => sum + file.size, 0);
  const attachmentLabel = attachedFiles.length
    ? `${attachedFiles.length} item${attachedFiles.length === 1 ? "" : "s"} · ${formatBytes(attachedBytes)}`
    : "no files attached";
  const latestPhoneItem = feed.find((item) => item.id.startsWith("relay-") || item.id.startsWith("prompt-"));
  const latestMirrorItem = latestPhoneItem || feed[0];
  const mirrorHistoryItems = feed.filter((item) => item.id !== latestMirrorItem?.id);
  const isRelayPromptItem = (item: RelayFeedItem) => item.id.startsWith("relay-") || item.id.startsWith("prompt-");
  const projectMatchesSelected = (item: RelayFeedItem) => {
    if (!selectedProjectId) return false;
    if (item.projectId === selectedProjectId) return true;
    if (item.projectLabel && selectedProject?.label && item.projectLabel === selectedProject.label) return true;
    return item.title === selectedProject?.label || item.title.startsWith(`${selectedProject?.label} ·`);
  };
  const selectedProjectFeedItems = feed.filter((item) => isRelayPromptItem(item) && projectMatchesSelected(item));
  const selectedProjectPreviewItems = selectedProjectFeedItems.filter((item) => item.state === "done" && item.previewUrl);
  const selectedProjectRunnablePreviewItem = selectedProjectPreviewItems.find((item) => !isRelayResultPreviewUrl(item.previewUrl));
  const selectedProjectResultItem = selectedProjectPreviewItems.find((item) => isRelayResultPreviewUrl(item.previewUrl));
  const selectedProjectPreviewItem = selectedProjectRunnablePreviewItem || selectedProjectResultItem || selectedProjectPreviewItems[0];
  const selectedProjectLatestItem = selectedProjectFeedItems[0];
  const selectedProjectChatItems = selectedProjectFeedItems.slice(0, 12);
  const selectedProjectDisplayItem = isStaleBlockedRelayItem(selectedProjectLatestItem)
    ? undefined
    : selectedProjectLatestItem;
  const selectedProjectPreviewIsResult = isRelayResultPreviewUrl(selectedProjectPreviewItem?.previewUrl);
  const latestCompletedPreviewItem = selectedProjectPreviewItem || feed.find((item) => (
    isRelayPromptItem(item) && item.state === "done" && item.previewUrl
  ));
  const selectableProjects = useMemo(
    () => normalizeRelayProjects(projects).filter(isSelectableCodexProject),
    [projects],
  );
  const hasSelectedProjectActivity = Boolean(selectedProjectLatestItem);
  const activeBuildItem = latestPhoneItem && (
    latestPhoneItem.state === "syncing"
    || latestPhoneItem.state === "queued"
    || latestPhoneItem.state === "running"
  )
    ? latestPhoneItem
    : undefined;
  const buildFocusActive = Boolean(activeBuildItem);
  const previewRouteOrigins = useMemo(() => {
    const candidates = [
      previewOriginFromRelayUrl(relayEndpoint),
      publicPreviewOrigin,
      ...relayUrlsFromList(relayStatus?.preview?.urls),
      ...relayUrlsFromList(relayStatus?.preview?.recommended),
    ].filter(Boolean);
    return rankRelayEndpoints(candidates.map((candidate) => candidate.replace(/\/+$/, "")));
  }, [publicPreviewOrigin, relayEndpoint, relayStatus?.preview?.recommended, relayStatus?.preview?.urls]);
  const publicPreviewUrl = useMemo(() => {
    const currentOrigin = getCurrentBrowserOrigin();
    const routePreviewOrigin = previewOriginFromRelayUrl(relayEndpoint);
    const base = previewRouteOrigins[0] || publicPreviewOrigin || routePreviewOrigin || (
      relayOrigin || (
        currentOrigin && !isLoopbackHost(window.location.hostname)
          ? currentOrigin
          : ""
      )
    );
    return `${base.replace(/\/+$/, "")}/?preview=relay-public-view`;
  }, [previewRouteOrigins, publicPreviewOrigin, relayEndpoint, relayOrigin]);
  const activePreviewUrl = selectedProjectPreviewItem?.previewUrl || latestCompletedPreviewItem?.previewUrl || publicPreviewUrl;
  const relayRoute = relayRouteInfo(relayEndpoint);

  useEffect(() => {
    if (!previewPanelUrl) return;
    window.requestAnimationFrame(() => {
      previewPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [previewPanelUrl]);

  const selectProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    storeProjectId(projectId);
    setShowProjectPicker(false);
    storeProjectPickerOpen(false);
    setPreviewPanelDismissedUrl("");
    setPreviewPanelUrl("");
  }, []);

  const toggleProjectPicker = () => {
    setShowProjectPicker((open) => {
      const next = !open;
      storeProjectPickerOpen(next);
      return next;
    });
  };

  useEffect(() => {
    const resolved = resolveDeviceRelayEndpoint(relayEndpoint, fallbackRelayEndpoint) || fallbackRelayEndpoint;
    if (resolved && resolved !== relayEndpoint) {
      setRelayEndpoint(resolved);
      setEndpointDraft(resolved);
      storeEndpoint(resolved);
    }
  }, [fallbackRelayEndpoint, relayEndpoint]);

  const relayInstallerUrl = useMemo(() => {
    const installerOrigin = isPocketFlowLocalHost()
      ? "https://pocketflow.local"
      : getCurrentBrowserOrigin() || relayOrigin;
    const expires = new Date(Date.now() + 1000 * 60 * 45).toISOString();
    const params = new URLSearchParams({
      ticket: relayTicket,
      host: relayEndpoint,
      expires,
      scopes: [
        "archive.read",
        "archive.write",
        "spino.context",
        "browser.preview",
        "codex.workspace",
        "terminal.request",
        "screen.mirror",
        "relay.prompt",
      ].join(","),
    });
    return `${installerOrigin}/local-port-app.html?${params.toString()}`;
  }, [relayEndpoint, relayOrigin, relayTicket]);

  const pushFeed = useCallback((item: RelayFeedItem) => {
    setFeed((current) => {
      const next = [item, ...current].slice(0, 18);
      storeLocalQueue(next);
      return next;
    });
  }, []);

  const patchFeedItem = useCallback((id: string, patch: Partial<RelayFeedItem>) => {
    setFeed((current) => {
      const next = current.map((item) => (
        item.id === id ? { ...item, ...patch } : item
      ));
      storeLocalQueue(next);
      return next;
    });
  }, []);

  const pingRelay = useCallback(async (force = false): Promise<boolean> => {
    if (PUBLIC_RELEASE_MODE) {
      setConnectionState("standby");
      setConnectionLabel("public demo mode");
      setConnectionDiagnostics("Live relay, private chat sync, tokens and project discovery are removed from this public build.");
      setQueueLabel("demo queue only");
      setRelayStatus(null);
      setLastPingAt(new Date());
      return false;
    }
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return false;
    if (relayPingPromiseRef.current) return relayPingPromiseRef.current;
    const run = (async () => {
      const candidates = relayCandidateEndpoints(relayEndpoint, fallbackRelayEndpoint);
      const endpoint = candidates[0];
      if (!endpoint) {
        setConnectionState("offline");
        setConnectionLabel("no relay url");
        setConnectionDiagnostics("No endpoint configured.");
        return false;
      }
      if (force) {
        setConnectionState("checking");
        setConnectionLabel("checking relay");
      } else {
        setConnectionState((current) => (current === "online" || current === "standby" ? current : "checking"));
      }
      const failedRoutes: string[] = [];
      for (const candidate of candidates) {
        try {
          const { endpoint: recoveredEndpoint, payload } = await fetchRelayStatus(candidate, relayTicket);
          const discovered = relayUrlsFromStatus(payload);
          storeDiscoveredRelayEndpoints([recoveredEndpoint, ...discovered]);
          setRelayEndpoint(recoveredEndpoint);
          setEndpointDraft(recoveredEndpoint);
          storeEndpoint(recoveredEndpoint);
          setRelayStatus(payload);
          setPublicPreviewOrigin(previewOriginFromRelayStatus(payload) || previewOriginFromRelayUrl(recoveredEndpoint));
          setConnectionState(payload?.ok ? "online" : "offline");
          setConnectionLabel(
            payload?.workerOnline
              ? "desktop relay + Codex worker online"
              : payload?.ok
                ? "desktop relay online; Codex worker checking"
              : payload?.message || "relay reached but unhealthy",
          );
          setConnectionDiagnostics(
            failedRoutes.length
              ? `Recovered via ${routeAttemptLabel(recoveredEndpoint)} after ${failedRoutes.length} failed route${failedRoutes.length === 1 ? "" : "s"}.`
              : `Connected via ${routeAttemptLabel(recoveredEndpoint)}.`,
          );
          setLastPingAt(new Date());
          return Boolean(payload?.ok);
        } catch (error) {
          failedRoutes.push(`${routeAttemptLabel(candidate)} (${error instanceof Error && error.name === "AbortError" ? "timeout" : "failed"})`);
          // Try the next remembered route.
        }
      }
      setConnectionState("offline");
      setConnectionLabel(bridgeAvailable ? "phone bridge ready, desktop relay unreachable" : "desktop relay unreachable; use Remote URL or VPN");
      setConnectionDiagnostics(failedRoutes.length ? `Tried: ${failedRoutes.slice(0, 4).join(" → ")}` : "No reachable relay route found.");
      setRelayStatus(null);
      setLastPingAt(new Date());
      return false;
    })();
    const tracked = run.finally(() => {
      if (relayPingPromiseRef.current === tracked) relayPingPromiseRef.current = null;
    });
    relayPingPromiseRef.current = tracked;
    return tracked;
  }, [bridgeAvailable, fallbackRelayEndpoint, relayEndpoint, relayTicket]);

  const fetchCodexProjects = useCallback(async () => {
    if (PUBLIC_RELEASE_MODE) {
      setProjects(normalizeRelayProjects(FALLBACK_CODEX_PROJECTS));
      setProjectsSource("public demo");
      setProjectsSyncedAt(null);
      setSelectedProjectId(FALLBACK_CODEX_PROJECTS[0]?.id || "");
      return;
    }
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    const endpoints = relayCandidateEndpoints(relayEndpoint, fallbackRelayEndpoint);
    if (!endpoints.length) {
      setProjectsSource("local fallback");
      return;
    }
    for (const endpoint of endpoints) {
      try {
        const response = await fetchWithRelayTimeout(`${endpoint}/relay/projects?limit=${RELAY_PROJECT_FETCH_LIMIT}&${relayAuthQuery(relayTicket)}`, {
          cache: "no-store",
          headers: relayAuthHeaders(relayTicket, { Accept: "application/json" }),
        });
        if (!response.ok) throw new Error(`status ${response.status}`);
        const payload = await response.json();
        const rawProjects = [
          ...(Array.isArray(payload?.projects) ? payload.projects : []),
          ...(Array.isArray(payload?.threads) ? payload.threads : []),
          ...(Array.isArray(payload?.chats) ? payload.chats : []),
          ...(Array.isArray(payload?.items) ? payload.items : []),
        ];
        const nextProjects = normalizeRelayProjects(rawProjects.filter((project: RelayProject) => project?.id && project?.label));
        if (!payload?.ok || !nextProjects.length) throw new Error("empty project list");
        if (endpoint !== relayEndpoint) {
          setRelayEndpoint(endpoint);
          setEndpointDraft(endpoint);
          storeEndpoint(endpoint);
        }
        setProjects(nextProjects);
        setProjectsSource(payload?.source ? "live codex desktop" : "codex desktop");
        setProjectsSyncedAt(new Date());
        setSelectedProjectId((current) => {
          const nextProjectId = [
            current,
            loadStoredProjectId(),
            nextProjects.find((project: RelayProject) => project.active && isSelectableCodexProject(project))?.id,
            nextProjects.find((project: RelayProject) => isSelectableCodexProject(project))?.id,
            nextProjects[0]?.id,
          ].find((projectId) => (
            projectId
            && nextProjects.some((project: RelayProject) => project.id === projectId)
          )) || "";
          if (nextProjectId) storeProjectId(nextProjectId);
          return nextProjectId;
        });
        return;
      } catch {
        // Try the next remembered/recovery relay URL.
      }
    }
    setProjectsSource((current) => (
      projectsSyncedAt ? `${current.replace(/ stale$/i, "")} stale` : "local fallback"
    ));
  }, [fallbackRelayEndpoint, projectsSyncedAt, relayEndpoint, relayTicket]);

  const fetchPromptQueue = useCallback(async () => {
    if (PUBLIC_RELEASE_MODE) {
      setQueueLabel("demo queue only");
      return;
    }
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    const endpoints = relayCandidateEndpoints(relayEndpoint, fallbackRelayEndpoint);
    if (!endpoints.length) {
      setQueueLabel("no relay url");
      return;
    }
    for (const endpoint of endpoints) {
      try {
        const response = await fetchWithRelayTimeout(`${endpoint}/relay/prompts?limit=180&order=newest&${relayAuthQuery(relayTicket)}`, {
          cache: "no-store",
          headers: relayAuthHeaders(relayTicket, { Accept: "application/json" }),
        });
        if (!response.ok) throw new Error(`status ${response.status}`);
        const payload = await response.json();
        const prompts = Array.isArray(payload?.prompts) ? payload.prompts : [];
        const incoming = prompts
          .filter((prompt: RelayPromptRecord) => prompt?.id)
          .map(relayPromptToFeedItem);
        if (endpoint !== relayEndpoint) {
          setRelayEndpoint(endpoint);
          setEndpointDraft(endpoint);
          storeEndpoint(endpoint);
        }
        setFeed((current) => {
          const next = mergeFeedItems(current, incoming);
          storeLocalQueue(next);
          return next;
        });
        const runningCount = prompts.filter((prompt: RelayPromptRecord) => prompt?.state === "running").length;
        const queuedCount = prompts.filter((prompt: RelayPromptRecord) => prompt?.state === "queued").length;
        setQueueLabel(runningCount ? `${runningCount} running, ${queuedCount} queued` : `${queuedCount} queued`);
        return;
      } catch {
        // Try the next remembered/recovery relay URL.
      }
    }
    setQueueLabel("queue unreachable");
  }, [fallbackRelayEndpoint, relayEndpoint, relayTicket]);

  const refreshRelayNow = useCallback(async () => {
    if (PUBLIC_RELEASE_MODE) {
      setConnectionState("standby");
      setConnectionLabel("public demo mode");
      setConnectionDiagnostics("PocketFlowFinal does not connect to private relays or load personal Codex chats.");
      setQueueLabel("demo queue only");
      return;
    }
    if (relaySyncPromiseRef.current) return relaySyncPromiseRef.current;
    const run = (async () => {
      setIsRefreshing(true);
      setConnectionState("checking");
      setConnectionLabel("checking relay");
      setConnectionDiagnostics("Refreshing relay, chats, and prompt queue...");
      setQueueLabel("checking queue");
      const relayOnline = await pingRelay(true);
      await Promise.all([fetchCodexProjects(), fetchPromptQueue()]);
      if (!relayOnline) {
        setConnectionDiagnostics((current) => current || "Relay did not answer. Check the desktop relay process and try again.");
      }
    })().finally(() => {
      setIsRefreshing(false);
      relaySyncPromiseRef.current = null;
    });
    relaySyncPromiseRef.current = run;
    return run;
  }, [fetchCodexProjects, fetchPromptQueue, pingRelay]);

  useEffect(() => {
    pingRelay();
    const interval = window.setInterval(
      pingRelay,
      connectionState === "online" ? RELAY_PING_ONLINE_MS : RELAY_PING_RECOVERY_MS,
    );
    return () => window.clearInterval(interval);
  }, [connectionState, pingRelay]);

  useEffect(() => {
    const requestWakeLock = async () => {
      const wakeLock = (navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<{ release?: () => Promise<void> }> };
      }).wakeLock;
      if (!wakeLock || document.visibilityState !== "visible") return;
      try {
        wakeLockRef.current = await wakeLock.request("screen");
      } catch {
        wakeLockRef.current = null;
      }
    };
    const releaseWakeLock = () => {
      wakeLockRef.current?.release?.().catch(() => {});
      wakeLockRef.current = null;
    };
    requestWakeLock();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      } else {
        releaseWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      releaseWakeLock();
    };
  }, []);

  useEffect(() => {
    fetchCodexProjects();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchCodexProjects();
    }, RELAY_PROJECT_POLL_MS);
    return () => window.clearInterval(interval);
  }, [fetchCodexProjects]);

  useEffect(() => {
    fetchPromptQueue();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchPromptQueue();
    }, RELAY_QUEUE_POLL_MS);
    return () => window.clearInterval(interval);
  }, [fetchPromptQueue]);

  useEffect(() => {
    const syncRelay = () => {
      pingRelay();
      fetchCodexProjects();
      fetchPromptQueue();
    };
    const syncOnVisible = () => {
      if (document.visibilityState === "visible") syncRelay();
    };
    window.addEventListener("online", syncRelay);
    window.addEventListener("focus", syncRelay);
    document.addEventListener("visibilitychange", syncOnVisible);
    return () => {
      window.removeEventListener("online", syncRelay);
      window.removeEventListener("focus", syncRelay);
      document.removeEventListener("visibilitychange", syncOnVisible);
    };
  }, [fetchCodexProjects, fetchPromptQueue, pingRelay]);

  const saveEndpoint = () => {
    const normalized = normalizeRelayEndpoint(endpointDraft);
    if (!normalized) {
      onNotify?.("Relay URL is not valid.", "warn");
      return;
    }
    setRelayEndpoint(normalized);
    setEndpointDraft(normalized);
    storeEndpoint(normalized);
    onNotify?.(`${relayRouteInfo(normalized).label} saved.`, "success");
  };

  const copyRelayAddress = async () => {
    try {
      await navigator.clipboard.writeText(relayEndpoint);
      onNotify?.("Private relay URL copied.", "success");
    } catch {
      onNotify?.("Copy is not available in this shell.", "warn");
    }
  };

  const copyPairingLink = async () => {
    try {
      await navigator.clipboard.writeText(relayInstallerUrl);
      onNotify?.("Relay pairing link copied.", "success");
    } catch {
      onNotify?.("Copy is not available in this shell.", "warn");
    }
  };

  const openRelayInstaller = async () => {
    if (window.PocketFlowReceiveBridge?.openUrlInMainWebView) {
      const result = await window.PocketFlowReceiveBridge.openUrlInMainWebView(relayInstallerUrl);
      onNotify?.(result.message || "Opening Codex Relay download page.", result.ok ? "success" : "warn");
      return;
    }
    window.location.href = relayInstallerUrl;
  };

  const openCodexDesktop = () => {
    window.location.href = "codex://open";
    onNotify?.("Opening Codex desktop relay target.", "info");
  };

  const openPublicPreview = async () => {
    await openRelayPreview(activePreviewUrl);
  };

  const controlPreviewServer = async (action: "start" | "stop") => {
    const endpoint = normalizeRelayEndpoint(relayEndpoint);
    if (!endpoint) {
      onNotify?.("Relay endpoint is missing.", "warn");
      return;
    }
    try {
      const response = await fetchWithRelayTimeout(`${endpoint}/relay/preview/${action}?${relayAuthQuery(relayTicket)}`, {
        method: "POST",
        cache: "no-store",
        headers: relayAuthHeaders(relayTicket, { Accept: "application/json" }),
      });
      if (!response.ok) throw new Error(`preview ${action} status ${response.status}`);
      const payload = await response.json();
      setRelayStatus((current) => current ? { ...current, preview: payload.preview } : current);
      const online = Boolean(payload?.preview?.online);
      onNotify?.(
        action === "start"
          ? online ? "Desktop preview is running." : "Preview start requested, still checking."
          : online ? "Preview still appears online." : "Desktop preview stopped.",
        online || action === "stop" ? "success" : "warn",
      );
    } catch {
      onNotify?.(`Could not ${action} desktop preview from Relay.`, "warn");
    }
  };

  const resolveRelayPreviewUrl = (target?: string) => {
    const raw = (target || publicPreviewUrl).trim();
    if (!raw) return publicPreviewUrl;
    try {
      const parsed = new URL(raw);
      const routePreviewOrigin = previewOriginFromRelayUrl(relayEndpoint);
      const replacement = previewRouteOrigins.find((origin) => {
        try {
          return !isLoopbackHost(new URL(origin).hostname);
        } catch {
          return false;
        }
      }) || publicPreviewOrigin || routePreviewOrigin || relayOrigin;
      const shouldRewritePrivateLan = replacement && isPrivateLanHost(parsed.hostname) && (() => {
        try {
          const replacementHost = new URL(replacement).hostname;
          return isTailscaleHost(replacementHost);
        } catch {
          return false;
        }
      })();
      if (isLoopbackHost(parsed.hostname) || shouldRewritePrivateLan) {
        if (replacement) {
          const base = new URL(replacement);
          parsed.protocol = base.protocol;
          parsed.hostname = base.hostname;
          parsed.port = base.port;
        }
      }
      return parsed.toString();
    } catch {
      return publicPreviewUrl;
    }
  };

  const openRelayPreview = async (target?: string) => {
    const nextPreviewUrl = resolveRelayPreviewUrl(target);
    setPreviewPanelDismissedUrl("");
    setPreviewPanelUrl(nextPreviewUrl);
    onNotify?.("Preview opened inside Relay.", "success");
  };

  const openRelayPreviewExternally = async (target?: string) => {
    const nextPreviewUrl = resolveRelayPreviewUrl(target || previewPanelUrl || activePreviewUrl);
    if (window.PocketFlowReceiveBridge?.openUrlInMainWebView) {
      const result = await window.PocketFlowReceiveBridge.openUrlInMainWebView(nextPreviewUrl);
      onNotify?.(result.message || "Opening public preview.", result.ok ? "success" : "warn");
      return;
    }
    window.open(nextPreviewUrl, "_blank", "noopener,noreferrer");
    onNotify?.("Opening public preview.", "info");
  };

  const previewRouteTargets = (target?: string) => {
    const resolvedTarget = resolveRelayPreviewUrl(target || activePreviewUrl);
    const routes = previewRouteOrigins.map((origin) => {
      let label = "remote";
      let kind: RelayRouteKind = "public";
      try {
        const host = new URL(origin).hostname;
        const info = relayRouteInfo(origin);
        kind = info.kind;
        if (info.kind === "vpn") label = "vpn";
        else if (info.kind === "home") label = "home only";
        else if (info.kind === "local") label = "device";
      } catch {
        label = "route";
        kind = "unknown";
      }
      return {
        origin,
        kind,
        label,
        url: rewritePreviewUrlToOrigin(resolvedTarget, origin),
      };
    });
    const hasRemoteRoute = routes.some((route) => route.kind === "public" || route.kind === "vpn");
    return routes.filter((route) => !hasRemoteRoute || route.kind !== "home");
  };

  const renderPreviewRouteControls = (target?: string) => {
    const routes = previewRouteTargets(target);
    if (!routes.length) return null;
    return (
      <div className="flex gap-2 overflow-x-auto border-t border-[#202228] bg-[#050607] px-3 py-2">
        <button
          onClick={() => openRelayPreview(target)}
          className="shrink-0 rounded-xl border border-[#2a2c32] bg-[#151619] px-3 py-2 text-[8px] font-mono font-black uppercase tracking-widest text-slate-300 active:scale-[0.98]"
        >
          retry
        </button>
        {routes.map((route) => (
          <button
            key={route.url}
            onClick={() => {
              setPreviewPanelDismissedUrl("");
              setPreviewPanelUrl(route.url);
              onNotify?.(`Preview route: ${route.label}`, "info");
            }}
            className={`shrink-0 rounded-xl border px-3 py-2 text-[8px] font-mono font-black uppercase tracking-widest active:scale-[0.98] ${
              route.url === previewPanelUrl
                ? "border-[#22c55e] bg-[#22c55e] text-black"
                : "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
            }`}
          >
            {route.label}
          </button>
        ))}
      </div>
    );
  };

  useEffect(() => {
    if (!selectedProjectPreviewItem?.previewUrl || !previewPanelUrl) return;
    const nextPreviewUrl = resolveRelayPreviewUrl(selectedProjectPreviewItem.previewUrl);
    if (previewPanelUrl === publicPreviewUrl || isRelayResultPreviewUrl(previewPanelUrl)) {
      setPreviewPanelUrl(nextPreviewUrl);
    }
  }, [publicPreviewUrl, selectedProjectPreviewItem?.previewUrl, previewPanelUrl]);

  const addAttachments = (fileList: FileList | null) => {
    const nextFiles = Array.from(fileList || []);
    if (!nextFiles.length) return;
    setAttachedFiles((current) => {
      const byPath = new Map<string, File>();
      for (const file of current) {
        byPath.set(`${getFileRelativePath(file)}:${file.size}`, file);
      }
      for (const file of nextFiles) {
        byPath.set(`${getFileRelativePath(file)}:${file.size}`, file);
      }
      let next = Array.from(byPath.values()).slice(0, MAX_RELAY_ATTACHMENT_FILES);
      let total = next.reduce((sum, file) => sum + file.size, 0);
      while (total > MAX_RELAY_ATTACHMENT_BYTES && next.length) {
        const removed = next.pop();
        total -= removed?.size || 0;
      }
      if (next.length < byPath.size) {
        onNotify?.("Attachment set was trimmed to fit Relay handoff limits.", "warn");
      }
      return next;
    });
  };

  const uploadAttachments = async (endpoint: string): Promise<RelayHandoff | null> => {
    if (!attachedFiles.length) return null;
    setIsUploadingAttachments(true);
    const files = await Promise.all(attachedFiles.map(readFileAsRelayPayload));
    const response = await fetchWithRelayTimeout(`${endpoint}/relay/handoffs`, {
      method: "POST",
      headers: relayAuthHeaders(relayTicket, {
        "Content-Type": "application/json",
        Accept: "application/json",
      }),
      body: JSON.stringify({
        ticket: relayTicket,
        source: "pocketflow-phone",
        files,
      }),
    });
    if (!response.ok) throw new Error(`handoff status ${response.status}`);
    const payload = await response.json();
    if (!payload?.ok || !payload?.handoff?.rootPath) {
      throw new Error(payload?.message || "handoff failed");
    }
    return payload.handoff as RelayHandoff;
  };

  const createHandoffPromptNote = (handoff: RelayHandoff | null) => {
    if (!handoff) return "";
    const listedFiles = handoff.files
      .slice(0, 24)
      .map((file) => `- ${file.relativePath} (${formatBytes(file.size)})`)
      .join("\n");
    const remainder = handoff.files.length > 24
      ? `\n- ...${handoff.files.length - 24} more file${handoff.files.length - 24 === 1 ? "" : "s"}`
      : "";
    return [
      "",
      "",
      "Attached files/folders for Codex:",
      `Desktop handoff folder: ${handoff.rootPath}`,
      `Manifest: ${handoff.rootPath}/pocketflow-handoff.json`,
      "Use these local files as the source material for this request. If edits are requested, work from the handoff folder or copy the relevant files into the project before editing.",
      "Files:",
      `${listedFiles}${remainder}`,
    ].join("\n");
  };

  const startNativeRelayDictation = useCallback(async () => {
    const locale = "auto";
    if (window.PocketFlowReceiveBridge?.notesStartTranscription) {
      return window.PocketFlowReceiveBridge.notesStartTranscription("relay", locale);
    }
    return window.PocketFlowReceiveBridge?.spinoStartSpeechRecognition?.(locale) || { ok: false, message: "Speech bridge unavailable." };
  }, []);

  const appendDictationToPrompt = useCallback((transcript: string, restartNative: boolean) => {
    const text = transcript.trim();
    if (!text) return;
    setPromptText((current) => {
      const cleanCurrent = current.trimEnd();
      const separator = cleanCurrent ? "\n" : "";
      return `${cleanCurrent}${separator}${text}`;
    });
    setDictationInterim("");
    setDictationStatus("Voice added to Relay prompt.");
    if (restartNative && relayDictationActiveRef.current) {
      if (relayDictationRestartTimerRef.current) window.clearTimeout(relayDictationRestartTimerRef.current);
      relayDictationRestartTimerRef.current = window.setTimeout(() => {
        void startNativeRelayDictation();
      }, 650);
    }
  }, [startNativeRelayDictation]);

  const stopRelayDictation = async () => {
    relayDictationActiveRef.current = false;
    setDictationActive(false);
    setDictationInterim("");
    if (relayDictationRestartTimerRef.current) {
      window.clearTimeout(relayDictationRestartTimerRef.current);
      relayDictationRestartTimerRef.current = null;
    }
    try {
      browserRecognitionRef.current?.stop?.();
    } catch {}
    browserRecognitionRef.current = null;
    try {
      if (window.PocketFlowReceiveBridge?.notesStopTranscription) {
        await window.PocketFlowReceiveBridge.notesStopTranscription();
      } else if (window.PocketFlowReceiveBridge?.spinoStopSpeechRecognition) {
        await window.PocketFlowReceiveBridge.spinoStopSpeechRecognition();
      }
    } catch {}
    setDictationStatus("Voice stopped.");
  };

  const startBrowserRelayDictation = () => {
    const SpeechRecognitionCtor =
      (window as Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition
      || (window as Window & { webkitSpeechRecognition?: any }).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setDictationStatus("No speech engine available here. Use the phone app mic permission.");
      onNotify?.("No speech engine available for Relay.", "warn");
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex || 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript?.trim() || "";
        if (!text) continue;
        if (result.isFinal) finalText = [finalText, text].filter(Boolean).join(" ");
        else interimText = [interimText, text].filter(Boolean).join(" ");
      }
      if (interimText) {
        setDictationInterim(interimText);
        setDictationStatus(`Hearing: ${interimText}`);
      }
      if (finalText) appendDictationToPrompt(finalText, false);
    };
    recognition.onerror = () => {
      if (!relayDictationActiveRef.current) return;
      setDictationStatus("Browser speech paused. Tap mic to retry.");
      void stopRelayDictation();
    };
    recognition.onend = () => {
      if (!relayDictationActiveRef.current) return;
      relayDictationRestartTimerRef.current = window.setTimeout(startBrowserRelayDictation, 650);
    };
    browserRecognitionRef.current = recognition;
    recognition.start();
  };

  const toggleRelayDictation = async () => {
    if (dictationActive) {
      await stopRelayDictation();
      return;
    }
    relayDictationActiveRef.current = true;
    setDictationActive(true);
    setDictationInterim("");
    setDictationStatus("Listening for Relay prompt.");
    if (window.PocketFlowReceiveBridge?.notesStartTranscription || window.PocketFlowReceiveBridge?.spinoStartSpeechRecognition) {
      try {
        const result = await startNativeRelayDictation();
        if (!result?.ok) {
          setDictationStatus(result?.message || "Phone speech bridge unavailable. Trying browser speech.");
          startBrowserRelayDictation();
        }
      } catch {
        setDictationStatus("Phone speech bridge did not answer. Trying browser speech.");
        startBrowserRelayDictation();
      }
      return;
    }
    startBrowserRelayDictation();
  };

  useEffect(() => {
    const handler = (event: Event) => {
      if (!relayDictationActiveRef.current) return;
      const detail = (event as CustomEvent<{ ok?: boolean; mode?: string; transcript?: string; interim?: boolean; message?: string }>).detail || {};
      if (detail.mode && detail.mode !== "relay" && detail.mode !== "spino") return;
      if (!detail.ok || !detail.transcript?.trim()) {
        setDictationStatus(detail.message || "No speech captured yet. Keep talking or tap stop.");
        if (relayDictationRestartTimerRef.current) window.clearTimeout(relayDictationRestartTimerRef.current);
        relayDictationRestartTimerRef.current = window.setTimeout(() => {
          void startNativeRelayDictation();
        }, 900);
        return;
      }
      const transcript = detail.transcript.trim();
      if (detail.interim) {
        setDictationInterim(transcript);
        setDictationStatus(`Hearing: ${transcript}`);
        return;
      }
      appendDictationToPrompt(transcript, true);
    };
    window.addEventListener("pocketflow-notes-speech-result", handler as EventListener);
    window.addEventListener("pocketflow-speech-result", handler as EventListener);
    return () => {
      window.removeEventListener("pocketflow-notes-speech-result", handler as EventListener);
      window.removeEventListener("pocketflow-speech-result", handler as EventListener);
      if (relayDictationRestartTimerRef.current) window.clearTimeout(relayDictationRestartTimerRef.current);
    };
  }, [appendDictationToPrompt, startNativeRelayDictation]);

  const sendPrompt = async () => {
    if (sendLockRef.current) return;
    const prompt = promptText.replace(/%20/g, " ").trim();
    if (!prompt && !attachedFiles.length) return;
    if (!selectedProject) {
      onNotify?.("Choose the Codex project before sending.", "warn");
      return;
    }
    sendLockRef.current = true;
    const endpoints = relayCandidateEndpoints(relayEndpoint, fallbackRelayEndpoint);
    const attachmentStub = attachedFiles.length
      ? `\n\nAttachments waiting for desktop handoff: ${attachmentLabel}`
      : "";
    const promptItem: RelayFeedItem = {
      id: createId("prompt"),
      kind: "prompt",
      title: selectedProject.label,
      body: `${prompt || "Use the attached files/folders."}${attachmentStub}`,
      at: nowTime(),
      timeMs: Date.now(),
      projectId: selectedProject.id,
      projectLabel: selectedProject.label,
      state: "syncing",
    };
    setPromptText("");
    pushFeed(promptItem);
    setShowRelayControls(false);
    window.setTimeout(() => {
      mirrorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    setIsSending(true);
    try {
      let payload: any = null;
      let finalPrompt = "";
      let usedEndpoint = "";
      for (const endpoint of endpoints) {
        try {
          const handoff = await uploadAttachments(endpoint);
          finalPrompt = `${prompt || "Use the attached files/folders."}${createHandoffPromptNote(handoff)}`;
          const response = await fetchWithRelayTimeout(`${endpoint}/relay/prompts`, {
            method: "POST",
            headers: relayAuthHeaders(relayTicket, {
              "Content-Type": "application/json",
              Accept: "application/json",
            }),
            body: JSON.stringify({
              ticket: relayTicket,
              projectId: selectedProject.id,
              projectLabel: selectedProject.label,
              prompt: finalPrompt,
              attachments: handoff ? [handoff] : [],
              source: "pocketflow-phone",
              createdAt: new Date().toISOString(),
            }),
          });
          if (!response.ok) throw new Error(`status ${response.status}`);
          payload = await response.json();
          usedEndpoint = endpoint;
          break;
        } catch {
          // Try the next relay route before falling back to phone-only queue.
        }
      }
      if (!payload || !usedEndpoint) throw new Error("all relay endpoints failed");
      const receipt = typeof payload?.id === "string" ? payload.id.slice(0, 8) : "accepted";
      patchFeedItem(promptItem.id, {
        state: "queued",
        title: `${selectedProject.label} · received`,
        body: `${finalPrompt}\n\nDesktop receipt: ${receipt}. Watch this card for queued, running, done, or blocked.`,
      });
      setAttachedFiles([]);
      if (usedEndpoint !== relayEndpoint) {
        setRelayEndpoint(usedEndpoint);
        setEndpointDraft(usedEndpoint);
        storeEndpoint(usedEndpoint);
      }
      fetchPromptQueue();
      setConnectionState("online");
      setConnectionLabel("prompt queue synced");
      onNotify?.("Prompt sent to Codex Relay.", "success");
    } catch {
      pushFeed({
        id: createId("local"),
        kind: "system",
        title: "Stored locally",
        body: "Desktop relay is not reachable yet. This prompt is saved on the phone queue and can be resent when the private URL is online.",
        at: nowTime(),
        timeMs: Date.now(),
        state: "blocked",
      });
      onNotify?.("Relay offline. Prompt saved on phone.", "warn");
    } finally {
      sendLockRef.current = false;
      setIsSending(false);
      setIsUploadingAttachments(false);
    }
  };

  const connectionColor = connectionState === "online"
    ? "bg-[#22c55e] shadow-[0_0_16px_rgba(34,197,94,0.7)]"
    : connectionState === "checking"
      ? "bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.5)] animate-pulse"
      : connectionState === "standby"
        ? "bg-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.5)]"
        : "bg-red-400 shadow-[0_0_16px_rgba(248,113,113,0.45)]";
  const composerRelayItem = selectedProjectDisplayItem;
  const currentRelayStatus = composerRelayItem ? relayStatusMeta(composerRelayItem) : null;
  const CurrentRelayStatusIcon = currentRelayStatus?.icon || CheckCircle2;

  return (
    <div className="pocketflow-screen-scroll flex-1 min-h-0 min-w-0 flex flex-col bg-gradient-to-b from-[#eaf8ff] via-white to-[#dff4ff] pt-3 pb-28 px-3 space-y-3 animate-fade-in text-slate-950">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-[1.35rem] border border-sky-200 bg-white text-sky-500 shadow-[0_10px_30px_rgba(14,165,233,0.16)] flex items-center justify-center shrink-0">
            <PlugZap className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-black text-slate-950 leading-none truncate">Codex Relay</h1>
            <p className="text-[8px] uppercase tracking-[0.24em] text-sky-500 font-mono mt-1 truncate">
              phone chat to desktop codex
            </p>
          </div>
        </div>
        <button
          onClick={refreshRelayNow}
          disabled={isRefreshing}
          aria-busy={isRefreshing}
          className="shrink-0 rounded-2xl border border-sky-100 bg-white px-3 py-2 flex items-center gap-2 shadow-sm active:scale-[0.98]"
        >
          <span className={`h-3 w-3 rounded-full ${connectionColor}`} />
          <span className="text-[9px] font-mono font-black uppercase tracking-widest text-slate-700">
            {isRefreshing ? "syncing" : connectionState}
          </span>
        </button>
      </div>

      {buildFocusActive ? (
        <section className="order-4 rounded-3xl border border-cyan-300/25 bg-[#061117] p-3 shadow-xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[9px] font-mono font-black uppercase tracking-[0.24em] text-cyan-200">
                build screen
              </div>
              <div className="mt-1 truncate text-xs font-mono text-slate-300">
                {activeBuildItem?.title || selectedProjectLabel} · {activeBuildItem ? relayStatusMeta(activeBuildItem).label : "READY"}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={refreshRelayNow}
                disabled={isRefreshing}
                aria-busy={isRefreshing}
                className="h-10 rounded-2xl border border-[#22c55e]/30 bg-[#22c55e]/15 px-3 text-[9px] font-mono font-black uppercase tracking-widest text-[#22c55e] flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "syncing" : "sync"}
              </button>
              <button
                onClick={() => setShowRelayControls((open) => !open)}
                className="h-10 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-3 text-[9px] font-mono font-black uppercase tracking-widest text-cyan-100 active:scale-[0.98]"
              >
                {showRelayControls ? "hide" : "controls"}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {false ? (
        <section ref={previewPanelRef} className="order-3 rounded-3xl border border-[#22c55e]/30 bg-[#050607] shadow-xl overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-[#202228] bg-[#0c1012] px-3 py-2">
            <div className="min-w-0">
              <div className="text-[8px] font-mono font-black uppercase tracking-[0.24em] text-[#22c55e]">
                live preview
              </div>
              <div className="mt-0.5 truncate text-[10px] font-mono text-slate-400">
                {previewPanelUrl}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => openRelayPreviewExternally(previewPanelUrl)}
                className="h-10 w-10 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-100 flex items-center justify-center active:scale-[0.98]"
                aria-label="Open preview full page"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setPreviewPanelDismissedUrl(previewPanelUrl);
                  setPreviewPanelUrl("");
                }}
                className="h-10 w-10 rounded-2xl border border-[#2a2c32] bg-[#151619] text-slate-300 flex items-center justify-center active:scale-[0.98]"
                aria-label="Close preview panel"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
          {showRelayControls ? renderPreviewRouteControls(previewPanelUrl) : null}
          <iframe
            key={previewPanelUrl}
            title="Relay project preview"
            src={previewPanelUrl}
            className="h-[48vh] min-h-[320px] w-full border-0 bg-white"
            sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts allow-downloads"
          />
        </section>
      ) : null}

      <section className={`${showConnectionDetails ? "" : "hidden"} order-7 rounded-3xl border border-cyan-300/25 bg-[#061117] p-3 shadow-xl space-y-2`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[9px] font-mono font-bold uppercase tracking-[0.24em] text-cyan-200">
              <TerminalSquare className="w-4 h-4" />
              phone to codex
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{connectionLabel}</p>
            {connectionDiagnostics ? (
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{connectionDiagnostics}</p>
            ) : null}
          </div>
          <button
            onClick={() => setShowConnectionDetails((open) => !open)}
            className="h-11 rounded-2xl border border-[#2a2c32] bg-[#151619] px-3 text-[9px] font-mono font-black uppercase tracking-widest text-cyan-100 active:scale-[0.98]"
          >
            {showConnectionDetails ? "hide" : "details"}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-cyan-300/15 bg-black/25 px-3 py-3">
            <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Connection</div>
            <div className={`mt-1 text-[11px] font-mono truncate ${connectionState === "online" ? "text-[#22c55e]" : "text-amber-300"}`}>
              {connectionLabel}
            </div>
            {connectionDiagnostics ? (
              <div className="mt-1 truncate text-[8px] font-mono text-slate-500">{connectionDiagnostics}</div>
            ) : null}
          </div>
          <div className="rounded-2xl border border-cyan-300/15 bg-black/25 px-3 py-3">
            <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Last Check</div>
            <div className="mt-1 text-[11px] font-mono text-slate-200">
              {lastPingAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#22c55e]/25 bg-[#06140d] p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[8px] font-mono font-black uppercase tracking-[0.24em] text-[#22c55e]">
                connected device
              </div>
              <div className="mt-1 truncate text-base font-black text-white">
                {relayStatus?.device?.name || "No desktop linked"}
              </div>
              <div className="mt-1 truncate text-[10px] font-mono text-slate-400">
                {relayRouteLabel(relayEndpoint)} · {shortEndpoint(relayEndpoint)}
              </div>
              <div className={`mt-2 text-[10px] leading-snug ${relayRoute.remoteReady ? "text-[#22c55e]" : "text-amber-200"}`}>
                {relayRoute.detail}
              </div>
            </div>
            <div className={`shrink-0 rounded-full px-3 py-1 text-[8px] font-mono font-black uppercase tracking-widest ${
              connectionState === "online" ? "bg-[#22c55e]/15 text-[#22c55e]" : "bg-amber-400/15 text-amber-300"
            }`}>
              {relayRoute.remoteReady ? "remote" : "home"}
            </div>
          </div>
          {!relayRoute.remoteReady ? (
            <div className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
              This address is not safe for leaving the house. Save a public HTTPS relay URL or VPN address, then the phone can stay connected over 3G/4G while the computer remains on Wi-Fi.
            </div>
          ) : null}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/10 bg-black/25 px-2 py-2">
              <div className="text-[7px] font-mono uppercase tracking-widest text-slate-500">Codex</div>
              <div className={`mt-1 truncate text-[10px] font-mono ${relayStatus?.workerOnline ? "text-[#22c55e]" : "text-amber-300"}`}>
                {relayStatus?.workerOnline ? `worker ${relayStatus.workerPid || ""}` : "offline"}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 px-2 py-2">
              <div className="text-[7px] font-mono uppercase tracking-widest text-slate-500">Queue</div>
              <div className="mt-1 truncate text-[10px] font-mono text-slate-200">
                {queueLabel}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/25 px-2 py-2">
              <div className="text-[7px] font-mono uppercase tracking-widest text-slate-500">Worker</div>
              <div className={`mt-1 truncate text-[10px] font-mono ${relayStatus?.workerOnline ? "text-[#22c55e]" : "text-amber-300"}`}>
                {relayStatus?.workerOnline ? "ready" : "checking"}
              </div>
            </div>
          </div>
        </div>

        {relayStatus?.remoteDevices?.length ? (
          <div className="rounded-2xl border border-cyan-300/20 bg-[#071116] p-3">
            <div className="mb-2 text-[8px] font-mono font-black uppercase tracking-[0.24em] text-cyan-200">
              remote access paths
            </div>
            <div className="space-y-2">
              {relayStatus.remoteDevices.map((device) => (
                <div
                  key={device.id || device.url || device.host}
                  className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-white">
                        {device.name || "Remote device"}
                      </div>
                      <div className="mt-1 truncate text-[10px] font-mono text-slate-400">
                        {device.url || `${device.host || "unknown"}:${device.port || ""}`}
                      </div>
                      <div className="mt-1 text-[10px] leading-snug text-slate-500">
                        {device.detail || "Private remote endpoint."}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[8px] font-mono font-black uppercase tracking-widest ${
                      device.online ? "bg-[#22c55e]/15 text-[#22c55e]" : "bg-amber-400/15 text-amber-300"
                    }`}>
                      {device.online ? "online" : "offline"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {false ? (
        <div className="rounded-2xl border border-[#22c55e]/30 bg-[#07160e] p-3">
          {selectedProjectPreviewItem ? (
            <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[8px] font-mono font-black uppercase tracking-[0.24em] text-[#22c55e]">
                  {selectedProjectPreviewIsResult ? "selected project result" : "selected project preview"}
                </div>
                <div className="mt-1 truncate text-sm font-black text-white">
                  {selectedProjectPreviewItem.title}
                </div>
                <div className="mt-1 truncate text-[10px] font-mono text-slate-500">
                  {resolveRelayPreviewUrl(selectedProjectPreviewItem.previewUrl)}
                </div>
                {renderPreviewRouteControls(selectedProjectPreviewItem.previewUrl)}
              </div>
              <button
                onClick={() => openRelayPreview(selectedProjectPreviewItem.previewUrl)}
                className="h-11 shrink-0 rounded-2xl bg-[#22c55e] px-4 text-[9px] font-mono font-black uppercase tracking-widest text-black flex items-center gap-2 active:scale-[0.98]"
              >
                <ExternalLink className="h-4 w-4" />
                {selectedProjectPreviewIsResult ? "result" : "open"}
              </button>
            </div>
            {selectedProjectPreviewIsResult ? (
              <div className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
                Codex completed this selected project but returned a result page, not a runnable app URL yet. When Codex publishes a localhost/public preview, this panel will switch to the live app preview.
              </div>
            ) : null}
            <div className="mt-3 overflow-hidden rounded-2xl border border-[#22c55e]/20 bg-white">
              <div className="flex items-center justify-between border-b border-[#202228] bg-[#0c1012] px-3 py-2">
                <span className="text-[8px] font-mono font-black uppercase tracking-[0.24em] text-[#22c55e]">
                  {selectedProjectPreviewIsResult ? "embedded codex result" : "embedded project preview"}
                </span>
                <button
                  onClick={() => openRelayPreviewExternally(selectedProjectPreviewItem.previewUrl)}
                  className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-[8px] font-mono font-black uppercase tracking-widest text-cyan-100"
                >
                  full
                </button>
              </div>
              <iframe
                title={`Preview ${selectedProjectPreviewItem.title}`}
                src={resolveRelayPreviewUrl(selectedProjectPreviewItem.previewUrl)}
                className="h-[360px] w-full border-0 bg-white"
                sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts allow-downloads"
              />
            </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#22c55e]/25 bg-black/25 p-4">
              <div className="text-[8px] font-mono font-black uppercase tracking-[0.24em] text-[#22c55e]">
                selected project preview
              </div>
              <div className="mt-2 text-base font-black text-white">
                {selectedProjectLabel}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                {hasSelectedProjectActivity
                  ? "Waiting for Codex to publish a preview URL for this project. When the build returns a localhost/public preview link, it will appear here automatically."
                  : "No build preview has been received for this selected project yet. Send a prompt to Codex or select a project with a completed preview."}
              </p>
              {selectedProjectLatestItem ? (
                <div className="mt-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/10 px-3 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[8px] font-mono font-black uppercase tracking-widest text-cyan-100">
                      {relayStatusMeta(selectedProjectLatestItem).label}
                    </span>
                    <span className="text-[8px] font-mono text-slate-500">{selectedProjectLatestItem.at}</span>
                  </div>
                  <div className="mt-2 max-h-16 overflow-hidden text-xs leading-relaxed text-slate-300 whitespace-pre-line">
                    {selectedProjectLatestItem.body}
                  </div>
                </div>
              ) : null}
              <button
                onClick={() => openRelayPreview(publicPreviewUrl)}
                className="mt-3 h-11 w-full rounded-2xl border border-cyan-300/25 bg-cyan-300/10 text-[9px] font-mono font-black uppercase tracking-widest text-cyan-100 flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <ExternalLink className="h-4 w-4" />
                open phone shell
              </button>
            </div>
          )}
        </div>
        ) : null}

        {latestPhoneItem ? (
          <div className={`rounded-2xl border px-3 py-3 ${
            latestPhoneItem.state === "done"
              ? "border-[#22c55e]/35 bg-[#22c55e]/10"
              : latestPhoneItem.state === "blocked"
                ? "border-red-400/35 bg-red-500/10"
                : "border-cyan-300/25 bg-cyan-300/10"
          }`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 text-[9px] font-mono font-black uppercase tracking-[0.22em] text-slate-400">
                last phone prompt
              </div>
              <span className={`shrink-0 text-[9px] font-mono font-black uppercase tracking-widest ${
                latestPhoneItem.state === "done"
                  ? "text-[#22c55e]"
                  : latestPhoneItem.state === "blocked"
                    ? "text-red-300"
                    : "text-cyan-200"
              }`}>
                {relayStatusMeta(latestPhoneItem).label}
              </span>
            </div>
            <div className="mt-2 max-h-16 overflow-hidden text-xs leading-relaxed text-slate-300 whitespace-pre-line">
              {latestPhoneItem.body}
            </div>
          </div>
        ) : null}

        {showConnectionDetails ? (
        <div className="rounded-2xl border border-[#2a2c32] bg-black/25 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[9px] font-mono font-black uppercase tracking-[0.22em] text-slate-400">
              remote relay url
            </label>
              <span className="text-[8px] font-mono uppercase tracking-widest text-cyan-200">
                public / vpn route
            </span>
          </div>
          <div className="flex gap-2">
            <input
              value={endpointDraft}
              onChange={(event) => setEndpointDraft(event.target.value)}
              className="min-w-0 flex-1 rounded-2xl border border-[#2a2c32] bg-[#050607] px-3 py-3 text-xs font-mono text-slate-100 outline-none focus:border-cyan-300/45"
              placeholder="https://your-public-relay.example"
              spellCheck={false}
            />
            <button
              onClick={saveEndpoint}
              className="shrink-0 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-3 text-[9px] font-mono font-black uppercase tracking-widest text-cyan-100 active:scale-[0.98]"
            >
              save
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={copyRelayAddress}
              className="flex-1 h-10 rounded-2xl border border-[#2a2c32] bg-[#151619] text-slate-200 text-[9px] font-mono font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" />
              copy url
            </button>
            <button
              onClick={copyPairingLink}
              className="flex-1 h-10 rounded-2xl border border-[#2a2c32] bg-[#151619] text-slate-200 text-[9px] font-mono font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Link2 className="w-4 h-4" />
              pairing link
            </button>
          </div>
        </div>
        ) : null}
      </section>

      <section className="order-1 rounded-[2rem] border border-sky-100 bg-white/95 p-4 space-y-3 shadow-[0_18px_50px_rgba(14,165,233,0.12)]">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={toggleProjectPicker}
            className="min-w-0 flex-1 text-left active:scale-[0.99]"
          >
            <div className="text-[9px] font-mono font-black uppercase tracking-[0.24em] text-sky-500">current codex chat</div>
            <div className="mt-1 flex items-center gap-2">
              <div className="min-w-0 truncate text-base font-black text-slate-950">{selectedProjectLabel}</div>
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[7px] font-mono font-black uppercase tracking-widest ${
                connectionState === "online"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                  : "border-amber-200 bg-amber-50 text-amber-600"
              }`}>
                {connectionState === "online" ? "auto sync" : "waiting"}
              </span>
            </div>
            <div className="mt-1 text-[9px] font-mono uppercase tracking-widest text-slate-400">
              {projectsSource} · {selectableProjects.length} project{selectableProjects.length === 1 ? "" : "s"}
              {projectsSyncedAt ? ` · ${projectsSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
            </div>
          </button>
          <button
            onClick={() => {
              refreshRelayNow();
            }}
            disabled={isRefreshing}
            aria-busy={isRefreshing}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-sky-100 bg-sky-50 text-sky-600 active:scale-[0.98]"
            aria-label="Refresh Codex projects"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={toggleProjectPicker}
            className="h-11 rounded-2xl border border-sky-100 bg-white px-3 text-[9px] font-mono font-black uppercase tracking-widest text-sky-600 shadow-sm active:scale-[0.98]"
          >
            {showProjectPicker ? "hide" : "change"}
          </button>
          <button
            onClick={openRelayInstaller}
            className="hidden h-11 rounded-2xl bg-[#22c55e] px-3 text-black text-[9px] font-mono font-black uppercase tracking-[0.18em] items-center justify-center gap-2 active:scale-[0.99]"
          >
            <Download className="w-4 h-4" />
            app
          </button>
        </div>
        {showProjectPicker ? (
        <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1">
          {selectableProjects.map((project) => {
            const active = project.id === selectedProjectId;
            return (
              <button
                key={project.id}
                onClick={() => selectProject(project.id)}
                className={`min-h-[64px] rounded-2xl border px-3 py-2 text-left shadow-sm active:scale-[0.99] ${
                  active
                    ? "border-sky-300 bg-sky-50 text-slate-950"
                    : "border-sky-100 bg-white text-slate-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[12px] font-black leading-tight">{project.label}</div>
                  {project.pinned || project.active ? (
                    <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[7px] font-mono uppercase tracking-widest text-sky-600">
                      {project.pinned ? "pinned" : "active"}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 text-[10px] leading-snug text-slate-400">{project.detail}</div>
              </button>
            );
          })}
        </div>
        ) : null}
      </section>

      <section ref={mirrorRef} className={`${showMirrorHistory ? "" : "hidden"} order-8 rounded-3xl border border-cyan-300/20 bg-[#071014] p-3 space-y-3`}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[9px] font-mono font-black uppercase tracking-[0.24em] text-cyan-200">
              <Activity className="w-4 h-4" />
              codex process mirror
            </div>
            <div className="mt-1 truncate text-[10px] font-mono text-slate-500">
              current build state first · old receipts hidden
            </div>
          </div>
          <button
            onClick={() => {
              pingRelay();
              fetchPromptQueue();
            }}
            className="h-10 w-10 shrink-0 rounded-xl border border-[#2a2c32] bg-[#151619] text-slate-300 grid place-items-center active:scale-[0.98]"
            aria-label="Refresh process mirror"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {latestMirrorItem ? (() => {
          const status = relayStatusMeta(latestMirrorItem);
          const StatusIcon = status.icon;
          const parts = splitRelayBody(latestMirrorItem.body);
          const isMoving = latestMirrorItem.state === "syncing" || latestMirrorItem.state === "running" || latestMirrorItem.state === "queued";
          return (
            <div className={`rounded-3xl border ${status.border} bg-black/35 p-3`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-start gap-3">
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 ${status.tone}`}>
                    <StatusIcon className={`w-5 h-5 ${isMoving ? "animate-spin" : ""}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[8px] font-mono font-black uppercase tracking-[0.24em] text-slate-500">
                      current
                    </div>
                    <div className="mt-1 truncate text-base font-black text-white">
                      {latestMirrorItem.title}
                    </div>
                    <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.18em] text-slate-500">
                      {latestMirrorItem.at} · {queueLabel}
                    </div>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1.5 text-[8px] font-mono font-black uppercase tracking-[0.12em] ${status.badge}`}>
                  {status.label}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-2xl border border-white/10 bg-[#101216] px-3 py-2">
                  <div className="text-[7px] font-mono uppercase tracking-widest text-slate-500">Queue</div>
                  <div className="mt-1 truncate text-[10px] font-mono text-slate-200">{queueLabel}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#101216] px-3 py-2">
                  <div className="text-[7px] font-mono uppercase tracking-widest text-slate-500">Desktop</div>
                  <div className={`mt-1 truncate text-[10px] font-mono ${connectionState === "online" ? "text-[#22c55e]" : "text-amber-300"}`}>
                    {connectionState}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#101216] px-3 py-2">
                  <div className="text-[7px] font-mono uppercase tracking-widest text-slate-500">Result</div>
                  <div className={`mt-1 truncate text-[10px] font-mono ${latestMirrorItem.state === "done" ? "text-[#22c55e]" : "text-slate-500"}`}>
                    {latestMirrorItem.state === "done" ? "received" : "pending"}
                  </div>
                </div>
              </div>

              {parts.prompt ? (
                <div className="mt-3 rounded-2xl border border-[#2a2c32] bg-[#101216] px-3 py-3">
                  <div className="text-[8px] font-mono font-black uppercase tracking-[0.22em] text-slate-500">
                    phone prompt
                  </div>
                  <div className="mt-2 max-h-28 overflow-y-auto text-xs leading-relaxed text-slate-300 whitespace-pre-line">
                    {parts.prompt}
                  </div>
                </div>
              ) : null}

              {parts.running || parts.codex || parts.error ? (
                <div className={`mt-2 rounded-2xl border px-3 py-3 ${
                  parts.error
                    ? "border-red-400/25 bg-red-500/10 text-red-100"
                    : parts.codex
                      ? "border-[#22c55e]/25 bg-[#092014] text-slate-200"
                      : "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
                }`}>
                  <div className="text-[8px] font-mono font-black uppercase tracking-[0.22em] opacity-70">
                    {parts.error ? "error" : parts.codex ? "codex response" : "running"}
                  </div>
                  <div className="mt-2 max-h-32 overflow-y-auto text-xs leading-relaxed whitespace-pre-line">
                    {parts.error || parts.codex || parts.running}
                  </div>
                </div>
              ) : null}

              {latestMirrorItem.state === "done" && !parts.codex ? (
                <div className="mt-2 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
                  Codex finished. Open Codex directly if you need the full desktop result.
                </div>
              ) : null}

              <div className="mt-3 grid grid-cols-2 gap-2">
                {status.permissionNeeded ? (
                  <button
                    onClick={openCodexDesktop}
                    className="h-11 rounded-2xl border border-amber-300/35 bg-amber-300/15 text-[10px] font-mono font-black uppercase tracking-[0.18em] text-amber-100 active:scale-[0.98]"
                  >
                    permission
                  </button>
                ) : null}
                <button
                  onClick={openCodexDesktop}
                  className="h-11 rounded-2xl border border-[#2a2c32] bg-[#151619] text-[10px] font-mono font-black uppercase tracking-[0.18em] text-slate-300 active:scale-[0.98]"
                >
                  codex
                </button>
                <button
                  onClick={() => setShowMirrorHistory((open) => !open)}
                  className="h-11 rounded-2xl border border-[#2a2c32] bg-[#151619] text-[10px] font-mono font-black uppercase tracking-[0.18em] text-slate-300 active:scale-[0.98]"
                >
                  {showMirrorHistory ? "hide history" : `history ${mirrorHistoryItems.length}`}
                </button>
              </div>
            </div>
          );
        })() : null}

        {showMirrorHistory ? (
          <div className={`${buildFocusActive && !showRelayControls ? "max-h-none flex-1 min-h-[34vh]" : "max-h-52"} overflow-y-auto space-y-2 pr-1`}>
            {mirrorHistoryItems.map((item) => {
              const status = relayStatusMeta(item);
              const StatusIcon = status.icon;
              const parts = splitRelayBody(item.body);
              const isMoving = item.state === "syncing" || item.state === "running";
              return (
                <div key={item.id} className={`rounded-2xl border ${status.border} bg-black/25 px-3 py-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex items-start gap-2">
                      <div className={`mt-0.5 ${status.tone}`}>
                        <StatusIcon className={`w-4 h-4 ${isMoving ? "animate-spin" : ""}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono font-black uppercase tracking-[0.16em] text-slate-200 truncate">{item.title}</div>
                        <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.18em] text-slate-600">{item.at}</div>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-mono font-black uppercase tracking-[0.12em] ${status.badge}`}>
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-2 max-h-[4.4rem] overflow-hidden text-[11px] leading-relaxed text-slate-400 whitespace-pre-line">
                    {parts.error || parts.codex || parts.running || parts.prompt}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="order-2 rounded-[2rem] border border-sky-100 bg-white/95 p-3 space-y-3 shadow-[0_18px_50px_rgba(14,165,233,0.14)] backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={toggleProjectPicker}
            className="min-w-0 flex-1 rounded-2xl border border-sky-100 bg-sky-50 px-3 py-3 text-left active:scale-[0.99]"
          >
            <div className="flex items-center gap-2 text-[9px] font-mono font-black uppercase tracking-[0.24em] text-sky-500">
              <MessageSquare className="w-4 h-4" />
              send to
            </div>
            <div className="mt-1 truncate text-sm font-black text-slate-950">{selectedProjectLabel}</div>
            <div className="mt-0.5 text-[10px] text-slate-400">{showProjectPicker ? "Tap a chat below" : "Tap to change chat"}</div>
          </button>
          <button
            onClick={() => setShowAttachments((open) => !open)}
            className={`h-10 rounded-2xl border px-3 text-[9px] font-mono font-black uppercase tracking-widest active:scale-[0.99] ${
              attachedFiles.length || showAttachments
                ? "border-sky-200 bg-sky-50 text-sky-600"
                : "border-sky-100 bg-white text-slate-500"
            }`}
          >
            {attachedFiles.length ? `${attachedFiles.length} files` : showAttachments ? "hide files" : "files"}
          </button>
        </div>
        <div className={`${showProjectPicker ? "grid" : "hidden"} max-h-40 grid-cols-1 gap-2 overflow-y-auto pr-1`}>
          {selectableProjects.map((project) => {
            const active = project.id === selectedProjectId;
            return (
              <button
                key={`chat-chip-${project.id}`}
                type="button"
                onClick={() => selectProject(project.id)}
                className={`min-w-0 rounded-2xl border px-3 py-2 text-left shadow-sm active:scale-[0.98] ${
                  active
                    ? "border-sky-300 bg-sky-50 text-sky-700"
                    : "border-sky-100 bg-white text-slate-500"
                }`}
              >
                <div className="truncate text-[11px] font-black">
                  {project.label}
                </div>
                <div className="mt-0.5 truncate text-[8px] font-mono uppercase tracking-widest opacity-60">
                  {project.active ? "codex active" : project.kind || "chat"}
                </div>
              </button>
            );
          })}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            addAttachments(event.target.files);
            event.target.value = "";
          }}
        />
        <input
          ref={(node) => {
            folderInputRef.current = node;
            if (node) {
              node.webkitdirectory = true;
              node.directory = true;
            }
          }}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            addAttachments(event.target.files);
            event.target.value = "";
          }}
        />
        <div className={`${showAttachments ? "grid" : "hidden"} grid-cols-2 gap-2`}>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="h-11 rounded-2xl border border-sky-100 bg-sky-50 text-sky-600 text-[9px] font-mono font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <FileUp className="w-4 h-4" />
            attach files
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            className="h-11 rounded-2xl border border-sky-100 bg-sky-50 text-sky-600 text-[9px] font-mono font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <FolderOpen className="w-4 h-4" />
            attach folder
          </button>
        </div>
        <div className={`${showAttachments || attachedFiles.length ? "block" : "hidden"} rounded-2xl border px-3 py-2 ${attachedFiles.length ? "border-emerald-200 bg-emerald-50" : "border-sky-100 bg-sky-50"}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex items-center gap-2">
              <Paperclip className={`h-4 w-4 ${attachedFiles.length ? "text-emerald-600" : "text-slate-400"}`} />
              <span className="truncate text-[10px] font-mono uppercase tracking-widest text-slate-600">
                {isUploadingAttachments ? "uploading handoff..." : attachmentLabel}
              </span>
            </div>
            {attachedFiles.length ? (
              <button
                onClick={() => setAttachedFiles([])}
                className="shrink-0 rounded-xl border border-red-400/25 bg-red-500/10 px-2 py-1 text-[8px] font-mono font-black uppercase tracking-widest text-red-200"
              >
                clear
              </button>
            ) : null}
          </div>
          {attachedFiles.length ? (
            <div className="mt-2 max-h-20 overflow-y-auto space-y-1 pr-1">
              {attachedFiles.slice(0, 8).map((file) => (
                <div key={`${getFileRelativePath(file)}:${file.size}`} className="truncate text-[10px] font-mono text-slate-500">
                  {getFileRelativePath(file)} · {formatBytes(file.size)}
                </div>
              ))}
              {attachedFiles.length > 8 ? (
                <div className="text-[10px] font-mono text-slate-600">
                  + {attachedFiles.length - 8} more
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-[auto_1fr_auto] items-end gap-2">
          <button
            type="button"
            onClick={() => void toggleRelayDictation()}
            className={`h-16 w-14 rounded-3xl border text-[9px] font-mono font-black uppercase tracking-[0.14em] flex flex-col items-center justify-center gap-1 active:scale-[0.99] ${
              dictationActive
                ? "border-red-200 bg-red-50 text-red-600"
                : "border-sky-100 bg-sky-50 text-sky-600"
            }`}
            aria-label={dictationActive ? "Stop Relay dictation" : "Start Relay dictation"}
          >
            {dictationActive ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            {dictationActive ? "stop" : "mic"}
          </button>
          <textarea
            value={promptText}
            onChange={(event) => setPromptText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendPrompt();
              }
            }}
            inputMode="text"
            autoCapitalize="sentences"
            className="h-28 w-full resize-none rounded-[1.6rem] border border-sky-100 bg-white px-4 py-4 text-[15px] leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 shadow-inner focus:border-sky-300"
            placeholder={`Tell Codex what to do in ${selectedProjectLabel}...`}
          />
          <button
            onPointerDown={(event) => {
              event.preventDefault();
              sendPrompt();
            }}
            onClick={(event) => {
              event.preventDefault();
              sendPrompt();
            }}
            disabled={(!promptText.trim() && !attachedFiles.length) || isSending || !selectedProject}
            className="h-16 w-20 rounded-[1.6rem] bg-sky-500 disabled:bg-slate-200 disabled:text-slate-400 text-white text-[9px] font-mono font-black uppercase tracking-[0.18em] flex flex-col items-center justify-center gap-1 shadow-[0_12px_30px_rgba(14,165,233,0.28)] active:scale-[0.99]"
          >
            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            send
          </button>
        </div>
        <div className={`rounded-2xl border px-3 py-2 text-[11px] leading-relaxed ${
          dictationActive
            ? "border-sky-200 bg-sky-50 text-sky-700"
            : "border-sky-100 bg-white text-slate-500"
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="font-mono uppercase tracking-widest">{dictationStatus}</span>
              {dictationInterim ? (
                <div className="mt-1 line-clamp-2 text-slate-700">{dictationInterim}</div>
              ) : null}
            </div>
            {promptText.trim() ? (
              <button
                type="button"
                onClick={() => setPromptText("")}
                className="shrink-0 rounded-xl border border-red-400/25 bg-red-500/10 px-2 py-1 text-[8px] font-mono font-black uppercase tracking-widest text-red-200"
              >
                clear
              </button>
            ) : null}
          </div>
        </div>
        <div className={`rounded-[1.6rem] border p-2.5 shadow-sm ${
          currentRelayStatus
            ? `${currentRelayStatus.border} bg-white`
            : "border-sky-100 bg-white"
        }`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex items-center gap-2">
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-sky-100 bg-sky-50 ${currentRelayStatus?.tone || "text-slate-400"}`}>
                <CurrentRelayStatusIcon className={`h-4 w-4 ${composerRelayItem?.state === "running" || composerRelayItem?.state === "queued" || composerRelayItem?.state === "syncing" ? "animate-spin" : ""}`} />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-black text-slate-950">
                  {composerRelayItem?.title || selectedProjectLabel}
                </div>
                <div className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-slate-500">
                  {composerRelayItem
                    ? splitRelayBody(composerRelayItem.body).codex
                      || splitRelayBody(composerRelayItem.body).running
                      || splitRelayBody(composerRelayItem.body).error
                      || splitRelayBody(composerRelayItem.body).prompt
                    : "Ready. Send a prompt and Codex updates will appear here."}
                </div>
              </div>
            </div>
            <span className={`shrink-0 rounded-full border px-2.5 py-1.5 text-[8px] font-mono font-black uppercase tracking-[0.12em] ${currentRelayStatus?.badge || "border-slate-500/30 bg-slate-500/10 text-slate-300"}`}>
              {currentRelayStatus?.label || "ready"}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={refreshRelayNow}
              disabled={isRefreshing}
              aria-busy={isRefreshing}
              className="h-10 rounded-2xl border border-sky-100 bg-sky-50 text-sky-600 text-[9px] font-mono font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "syncing" : "refresh"}
            </button>
            <button
              onClick={() => setShowMirrorHistory((open) => !open)}
              className="h-10 rounded-2xl border border-sky-100 bg-white text-sky-600 text-[9px] font-mono font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              <Activity className="w-4 h-4" />
              {showMirrorHistory ? "hide log" : "open log"}
            </button>
          </div>
        </div>
        <div className="rounded-[1.7rem] border border-sky-100 bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-sky-500">selected chat</p>
              <h3 className="mt-1 truncate text-sm font-black text-slate-950">{selectedProjectLabel}</h3>
            </div>
            <span className="shrink-0 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[8px] font-mono font-black uppercase tracking-[0.12em] text-sky-600">
              {selectedProjectChatItems.length ? `${selectedProjectChatItems.length} shown` : "empty"}
            </span>
          </div>
          {selectedProjectChatItems.length ? (
            <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
              {selectedProjectChatItems.map((item) => {
                const parts = splitRelayBody(item.body);
                const status = relayStatusMeta(item);
                const codexText = parts.codex || parts.running || parts.error;
                return (
                  <div key={`selected-chat-${item.id}`} className="space-y-2">
                    <div className="ml-auto max-w-[92%] rounded-[1.4rem] border border-sky-200 bg-sky-500 px-3 py-2 text-sm leading-relaxed text-white shadow-sm">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-mono text-[8px] font-black uppercase tracking-[0.18em] text-white/80">you</span>
                        <span className="font-mono text-[8px] text-white/70">{item.at}</span>
                      </div>
                      <p className="line-clamp-4 whitespace-pre-wrap">{parts.prompt}</p>
                    </div>
                    {codexText ? (
                      <div className="max-w-[94%] rounded-[1.4rem] border border-sky-100 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-800 shadow-sm">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="font-mono text-[8px] font-black uppercase tracking-[0.18em] text-sky-600">codex</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[7px] font-mono font-black uppercase tracking-[0.12em] ${status.badge}`}>
                            {status.label}
                          </span>
                        </div>
                        <p className="line-clamp-5 whitespace-pre-wrap">{codexText}</p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50 px-3 py-3 text-[11px] leading-relaxed text-slate-500">
              Select a Codex project and send a prompt. The recent phone-to-Codex conversation for that project will stay readable here.
            </div>
          )}
        </div>
        <div className={`${showRelayControls ? "grid" : "hidden"} grid-cols-1 gap-2`}>
          <button
            onClick={refreshRelayNow}
            className="h-12 rounded-2xl border border-sky-100 bg-sky-50 text-sky-600 text-[9px] font-mono font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <RefreshCw className="w-4 h-4" />
            refresh live chats
          </button>
          <button
            onClick={openCodexDesktop}
            className="h-12 rounded-2xl border border-sky-100 bg-white text-sky-600 text-[9px] font-mono font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <ExternalLink className="w-4 h-4" />
            codex
          </button>
          <button
            onClick={openRelayInstaller}
            className="h-12 rounded-2xl border border-sky-100 bg-white text-sky-600 text-[9px] font-mono font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            <Download className="w-4 h-4" />
            relay app
          </button>
        </div>
        <div className={`${showRelayControls ? "block" : "hidden"} rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2 text-[10px] leading-relaxed text-slate-500`}>
          <Wifi className="mr-2 inline h-4 w-4 text-sky-500" />
          After send, a desktop receipt appears in the mirror. Nothing is installed on the phone unless you explicitly run a phone update.
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setShowConnectionDetails((open) => !open)}
            className="h-10 rounded-2xl border border-sky-100 bg-white text-[9px] font-mono font-black uppercase tracking-widest text-sky-600 active:scale-[0.99]"
          >
            {showConnectionDetails ? "hide relay info" : "relay info"}
          </button>
          <button
            onClick={() => setShowRelayControls((open) => !open)}
            className="h-10 rounded-2xl border border-sky-100 bg-white text-[9px] font-mono font-black uppercase tracking-widest text-sky-600 active:scale-[0.99]"
          >
            {showRelayControls ? "hide tools" : "tools"}
          </button>
        </div>
      </section>
    </div>
  );
}
