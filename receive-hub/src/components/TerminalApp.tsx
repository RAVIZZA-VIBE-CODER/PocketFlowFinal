import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  Clipboard,
  Copy,
  Plus,
  Play,
  Search,
  Settings2,
  ShieldCheck,
  TerminalSquare,
  Trash2,
  X,
} from "lucide-react";
import type { ReceivedFile } from "../types";
import { formatBytes } from "../utils/fileValidation";
import { getAllFiles } from "../utils/storage";
import { createPocketAIRouter, type PocketAITaskType } from "../utils/pocketAI";
import { POCKETFLOW_APP_TOOLS } from "../utils/spinoTools";

type TerminalLineKind = "input" | "output" | "error" | "system";

interface TerminalLine {
  id: string;
  kind: TerminalLineKind;
  text: string;
  at: string;
}

interface TerminalSettingsState {
  theme: "pro" | "matrix" | "amber";
  fontSize: number;
  wrapLines: boolean;
  promptName: string;
  nativeMode: "bridge_or_queue" | "queue_only";
}

interface NativeTerminalResult {
  ok?: boolean;
  stdout?: string;
  stderr?: string;
  output?: string;
  code?: number;
  message?: string;
}

interface NativeTerminalBridge {
  runCommand?: (command: string) => Promise<string | NativeTerminalResult> | string | NativeTerminalResult;
  getStatus?: () => Promise<string | NativeTerminalResult> | string | NativeTerminalResult;
}

interface TerminalRequest {
  id: string;
  command: string;
  at: string;
  status: "queued";
  permission: "terminal.request";
}

interface TerminalSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lines: TerminalLine[];
  command: string;
}

interface TerminalCommandCatalogItem {
  id: string;
  label: string;
  command: string;
  group: "daily" | "automation" | "system" | "archive" | "native" | "llm";
  description: string;
  bridge?: boolean;
}

declare global {
  interface Window {
    PocketFlowTerminal?: NativeTerminalBridge;
  }
}

const SETTINGS_KEY = "pocketflow.terminal.settings.v1";
const SESSIONS_KEY = "pocketflow.terminal.sessions.v1";
const ACTIVE_SESSION_KEY = "pocketflow.terminal.activeSession.v1";
const HISTORY_KEY = "pocketflow.terminal.history.v1";
const REQUESTS_KEY = "pocketflow.terminal.requests.v1";
const LLM_CONTEXT_KEY = "pocketflow.terminal.llmContext.v1";
const LEGACY_WELCOME_TEXT = "PocketFlow Terminal ready. Type `help`, run `audit`, or ask Baloss with `ask ...`.";
const CURRENT_WELCOME_TEXT = "PocketFlow Terminal ready. Type `help`, run `audit`, paste commands, or use `install <apk-path>`.";

const DEFAULT_SETTINGS: TerminalSettingsState = {
  theme: "pro",
  fontSize: 13,
  wrapLines: true,
  promptName: "pocketflow",
  nativeMode: "bridge_or_queue",
};

const nowLabel = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const lineId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const createWelcomeLine = (): TerminalLine => ({
  id: lineId(),
  kind: "system",
  text: CURRENT_WELCOME_TEXT,
  at: nowLabel(),
});

const createSession = (index: number, title = `term-${index}`): TerminalSession => ({
  id: `terminal-session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  title,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lines: [createWelcomeLine()],
  command: "",
});

const readJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(window.localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
};

const saveJson = (key: string, value: unknown) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const normalizeNativeResult = (result: string | NativeTerminalResult) => {
  if (typeof result === "string") return result || "(no output)";
  const parts = [
    result.stdout,
    result.output,
    result.stderr ? `stderr:\n${result.stderr}` : "",
    typeof result.code === "number" ? `exit code: ${result.code}` : "",
    result.message,
  ].filter(Boolean);
  if (!parts.length) return result.ok === false ? "Command failed without output." : "(no output)";
  return parts.join("\n");
};

const splitCommand = (command: string) => {
  const matches = command.match(/"[^"]*"|'[^']*'|\S+/g) || [];
  return matches.map((part) => part.replace(/^["']|["']$/g, ""));
};

const helpText = `PocketFlow Terminal commands

commands              Show searchable command catalog as text.
audit                 Run a local phone/webview audit.
automations           Check known automation/newsletter/agent state.
bridge                Check native command bridge status.
ls /apps              List installed PocketFlow app routes.
ls /archive           List recent Archive files.
cat /system/info      Show runtime information.
apps                  Show app registry.
files                 Show Archive file count and recent files.
install <apk-path>    Open Android installer for a local APK.
openapp <package>     Launch an installed Android package.
queue <command>       Queue a native terminal request for approved relay.
native <command>      Run through Android/native bridge when available.
ask <question>        Ask local Baloss LLM with this terminal as context.
explain <command>     Ask Baloss to explain a command before running it.
llm status            Check local LLM/router status.
session               Show current terminal page state.
new                   Create a new terminal page.
requests              Show queued terminal requests.
settings              Show terminal settings.
set theme pro|matrix|amber
set font 12..18
set wrap on|off
set native bridge|queue
history               Show command history.
clear                 Clear this terminal session.`;

const COMMAND_CATALOG: TerminalCommandCatalogItem[] = [
  {
    id: "audit",
    label: "Full terminal audit",
    command: "audit",
    group: "daily",
    description: "Check WebView, archive, app routes, queued terminal requests and clipboard support.",
  },
  {
    id: "automations",
    label: "All automations status",
    command: "automations",
    group: "automation",
    description: "Summarize known newsletter, NewsFlow, Moltbook, agent, relay and scraper local state.",
  },
  {
    id: "newsletters",
    label: "Newsletter campaigns",
    command: "automations newsletter",
    group: "automation",
    description: "Filter automation state to campaign/newsletter-related records.",
  },
  {
    id: "agents",
    label: "Agent health",
    command: "automations agent",
    group: "automation",
    description: "Filter automation state to agent health, queues, patrols and watchdog records.",
  },
  {
    id: "bridge",
    label: "Native bridge status",
    command: "bridge",
    group: "system",
    description: "Check whether Android/native command execution is reachable from this shell.",
  },
  {
    id: "llm-status",
    label: "Local LLM status",
    command: "llm status",
    group: "llm",
    description: "Check Baloss/local router readiness and last provider decision.",
  },
  {
    id: "apps",
    label: "List app routes",
    command: "apps",
    group: "system",
    description: "Show registered PocketFlow app tools and summaries.",
  },
  {
    id: "archive",
    label: "Recent Archive files",
    command: "ls /archive",
    group: "archive",
    description: "List recent files visible to the Terminal from PocketFlow Archive.",
  },
  {
    id: "requests",
    label: "Queued terminal requests",
    command: "requests",
    group: "system",
    description: "Show native terminal commands queued for approved execution.",
  },
  {
    id: "install-apk",
    label: "Install APK from path",
    command: "install /sdcard/Download/app.apk",
    group: "native",
    bridge: true,
    description: "Template for opening the Android installer through the native bridge.",
  },
  {
    id: "open-android-settings",
    label: "Open Android settings",
    command: "openapp com.android.settings",
    group: "native",
    bridge: true,
    description: "Launch Android settings package when the native bridge is available.",
  },
  {
    id: "native-processes",
    label: "Native process snapshot",
    command: "native ps -A | head -40",
    group: "native",
    bridge: true,
    description: "Advanced bridge command to inspect running Android processes.",
  },
  {
    id: "explain",
    label: "Explain command first",
    command: "explain native pm list packages",
    group: "llm",
    description: "Ask Baloss to explain a command before running anything dangerous.",
  },
];

const commandCatalogText = () =>
  [
    "PocketFlow command catalog",
    ...COMMAND_CATALOG.map((item) => `${item.command.padEnd(34)} ${item.label} - ${item.description}`),
  ].join("\n");

const themeClassNames: Record<TerminalSettingsState["theme"], string> = {
  pro: "bg-[#050608] text-[#e8edf4] border-[#2f3640]",
  matrix: "bg-[#020805] text-[#b9ffd1] border-[#14532d]",
  amber: "bg-[#100a03] text-[#ffe6a3] border-[#6b4d12]",
};

const promptColors: Record<TerminalSettingsState["theme"], string> = {
  pro: "text-[#7dd3fc]",
  matrix: "text-[#5dff94]",
  amber: "text-[#fbbf24]",
};

const TerminalApp = ({ onNotify }: { onNotify?: (message: string, type: "success" | "info" | "warn") => void }) => {
  const [settings, setSettings] = useState<TerminalSettingsState>(() => ({
    ...DEFAULT_SETTINGS,
    ...readJson<Partial<TerminalSettingsState>>(SETTINGS_KEY, {}),
  }));
  const [sessions, setSessions] = useState<TerminalSession[]>(() => {
    const stored = readJson<TerminalSession[]>(SESSIONS_KEY, []);
    if (stored.length) {
      return stored.map((session) => ({
        ...session,
        command: session.command || "",
        lines: session.lines.map((line) => ({
          ...line,
          text: line.text === LEGACY_WELCOME_TEXT ? CURRENT_WELCOME_TEXT : line.text,
        })),
      }));
    }
    return [createSession(1)];
  });
  const [activeSessionId, setActiveSessionId] = useState(() => readJson<string>(ACTIVE_SESSION_KEY, ""));
  const [history, setHistory] = useState<string[]>(() => readJson<string[]>(HISTORY_KEY, []));
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [files, setFiles] = useState<ReceivedFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState("");
  const outputRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeSession = sessions.find((session) => session.id === activeSessionId) || sessions[0] || createSession(1);
  const lines = activeSession.lines;
  const command = activeSession.command;

  useEffect(() => {
    if (!sessions.some((session) => session.id === activeSessionId) && sessions[0]) {
      setActiveSessionId(sessions[0].id);
    }
  }, [activeSessionId, sessions]);

  useEffect(() => {
    saveJson(SETTINGS_KEY, settings);
  }, [settings]);

  useEffect(() => {
    saveJson(SESSIONS_KEY, sessions.slice(-8));
    saveJson(ACTIVE_SESSION_KEY, activeSession.id);
    saveJson(LLM_CONTEXT_KEY, {
      activeSessionId: activeSession.id,
      activeTitle: activeSession.title,
      updatedAt: new Date().toISOString(),
      sessions: sessions.map((session) => ({
        id: session.id,
        title: session.title,
        updatedAt: session.updatedAt,
        recentLines: session.lines.slice(-16).map((line) => ({ kind: line.kind, text: line.text, at: line.at })),
      })),
    });
  }, [activeSession.id, activeSession.title, sessions]);

  useEffect(() => {
    saveJson(HISTORY_KEY, history.slice(-120));
  }, [history]);

  useEffect(() => {
    let cancelled = false;
    setLoadingFiles(true);
    getAllFiles()
      .then((archiveFiles) => {
        if (!cancelled) setFiles(archiveFiles);
      })
      .catch(() => {
        if (!cancelled) setFiles([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingFiles(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  const bridgeAvailable = typeof window !== "undefined" && typeof window.PocketFlowTerminal?.runCommand === "function";

  const queuedRequests = useMemo(() => readJson<TerminalRequest[]>(REQUESTS_KEY, []), [lines.length]);

  const updateActiveSession = (updater: (session: TerminalSession) => TerminalSession) => {
    setSessions((current) =>
      current.map((session) =>
        session.id === activeSession.id
          ? { ...updater(session), updatedAt: new Date().toISOString() }
          : session,
      ),
    );
  };

  const setActiveCommand = (nextCommand: string | ((current: string) => string)) => {
    updateActiveSession((session) => ({
      ...session,
      command: typeof nextCommand === "function" ? nextCommand(session.command) : nextCommand,
    }));
  };

  const setActiveLines = (nextLines: TerminalLine[] | ((current: TerminalLine[]) => TerminalLine[])) => {
    updateActiveSession((session) => ({
      ...session,
      lines: typeof nextLines === "function" ? nextLines(session.lines) : nextLines,
    }));
  };

  const pushLine = (kind: TerminalLineKind, text: string) => {
    setActiveLines((current) => [...current, { id: lineId(), kind, text, at: nowLabel() }]);
  };

  const createNewSession = () => {
    const nextSession = createSession(sessions.length + 1);
    setSessions((current) => [...current, nextSession].slice(-8));
    setActiveSessionId(nextSession.id);
    onNotify?.("New terminal page opened.", "success");
  };

  const closeSession = (sessionId: string) => {
    if (sessions.length <= 1) {
      setActiveLines([createWelcomeLine()]);
      setActiveCommand("");
      return;
    }
    const remaining = sessions.filter((session) => session.id !== sessionId);
    setSessions(remaining);
    if (activeSession.id === sessionId) setActiveSessionId(remaining[remaining.length - 1]?.id || "");
  };

  const queueRequest = (queuedCommand: string) => {
    const next: TerminalRequest[] = [
      ...readJson<TerminalRequest[]>(REQUESTS_KEY, []),
      {
        id: `terminal-${Date.now()}`,
        command: queuedCommand,
        at: new Date().toISOString(),
        status: "queued",
        permission: "terminal.request",
      },
    ];
    saveJson(REQUESTS_KEY, next);
    return `Queued terminal.request for approved native relay:\n${queuedCommand}`;
  };

  const runNativeCommand = async (nativeCommand: string) => {
    if (!nativeCommand.trim()) return "Usage: native <command>";
    if (settings.nativeMode === "queue_only") return queueRequest(nativeCommand);
    if (!window.PocketFlowTerminal?.runCommand) {
      return `${queueRequest(nativeCommand)}\n\nNative bridge is not exposed in this browser/WebView yet. The Android wrapper must provide window.PocketFlowTerminal.runCommand(command).`;
    }
    const result = await window.PocketFlowTerminal.runCommand(nativeCommand);
    return normalizeNativeResult(result);
  };

  const runBridgeStatus = async () => {
    if (!window.PocketFlowTerminal) {
      return "Native bridge: offline\nBuilt-in web terminal: online\nReal Android shell execution: waiting for native wrapper bridge.";
    }
    if (!window.PocketFlowTerminal.getStatus) {
      return `Native bridge object: present\nrunCommand: ${bridgeAvailable ? "available" : "missing"}\ngetStatus: missing`;
    }
    const result = await window.PocketFlowTerminal.getStatus();
    return `Native bridge status:\n${normalizeNativeResult(result)}`;
  };

  const buildAudit = () => {
    const localKeys = Object.keys(window.localStorage || {});
    const archiveSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
    return [
      "PocketFlow terminal audit",
      `time: ${new Date().toISOString()}`,
      `url: ${window.location.href}`,
      `userAgent: ${navigator.userAgent}`,
      `nativeBridge: ${bridgeAvailable ? "online" : "offline"}`,
      `archiveFiles: ${loadingFiles ? "loading" : files.length}`,
      `archiveSize: ${formatBytes(archiveSize)}`,
      `appRoutes: ${POCKETFLOW_APP_TOOLS.length}`,
      `queuedTerminalRequests: ${readJson<TerminalRequest[]>(REQUESTS_KEY, []).length}`,
      `localStorageKeys: ${localKeys.length}`,
      `clipboardApi: ${navigator.clipboard ? "available" : "unavailable"}`,
    ].join("\n");
  };

  const summarizeStoredAutomationValue = (key: string, rawValue: string) => {
    if (!rawValue) return `${key}: empty`;
    try {
      const parsed = JSON.parse(rawValue);
      if (Array.isArray(parsed)) {
        const named = parsed
          .slice(0, 4)
          .map((item) => {
            if (!item || typeof item !== "object") return "";
            const record = item as Record<string, unknown>;
            const name = record.name || record.label || record.title || record.id || "record";
            const state =
              record.enabled === false
                ? "paused"
                : record.enabled === true
                  ? "enabled"
                  : record.status || record.state || record.mode || "";
            return `${String(name)}${state ? ` (${String(state)})` : ""}`;
          })
          .filter(Boolean);
        return `${key}: ${parsed.length} item${parsed.length === 1 ? "" : "s"}${named.length ? ` / ${named.join(", ")}` : ""}`;
      }
      if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        const markers = [
          ["status", record.status],
          ["state", record.state],
          ["enabled", record.enabled],
          ["running", record.running ?? record.isRunning],
          ["mode", record.mode],
          ["lastRun", record.lastRunAt ?? record.lastRun ?? record.updatedAt ?? record.checkedAt],
          ["nextRun", record.nextRunAt ?? record.nextRun ?? record.nextCheckAt],
          ["active", record.activeProfiles],
          ["due", record.dueSlots],
          ["sent", record.confirmedToday],
          ["queue", record.queuePending ?? record.pending ?? record.queueLength],
        ].filter(([, value]) => value !== undefined && value !== null && value !== "");
        const profileCount = Array.isArray(record.profiles) ? `profiles=${record.profiles.length}` : "";
        const campaignCount = Array.isArray(record.campaigns) ? `campaigns=${record.campaigns.length}` : "";
        const summary = [
          ...markers.map(([label, value]) => `${label}=${String(value)}`),
          profileCount,
          campaignCount,
        ].filter(Boolean);
        return `${key}: ${summary.length ? summary.join(" / ") : "object saved"}`;
      }
      return `${key}: ${String(parsed).slice(0, 120)}`;
    } catch {
      return `${key}: ${rawValue.slice(0, 140)}${rawValue.length > 140 ? "..." : ""}`;
    }
  };

  const buildAutomationStatus = (filter = "") => {
    const normalizedFilter = filter.trim().toLowerCase();
    const keys = Object.keys(window.localStorage || {})
      .filter((key) => /(newsletter|campaign|news|moltbook|agent|automation|relay|scraper|leadfinder|calendar|watchdog|outbox|queue|health)/i.test(key))
      .filter((key) => !normalizedFilter || key.toLowerCase().includes(normalizedFilter))
      .sort();
    if (!keys.length) {
      return normalizedFilter
        ? `No local automation state matched "${normalizedFilter}". Try: automations, automations newsletter, automations agent.`
        : "No automation/newsletter/agent state is visible in local browser storage yet.";
    }
    return [
      "PocketFlow automation status",
      `filter: ${normalizedFilter || "all"}`,
      `records: ${keys.length}`,
      "",
      ...keys.slice(0, 36).map((key) => summarizeStoredAutomationValue(key, window.localStorage.getItem(key) || "")),
      keys.length > 36 ? `\n${keys.length - 36} more records hidden. Use a filter such as \`automations newsletter\` or \`automations agent\`.` : "",
    ].filter(Boolean).join("\n");
  };

  const listArchiveFiles = () => {
    if (loadingFiles) return "Archive is still loading. Run `ls /archive` again in a second.";
    if (!files.length) return "Archive has no files visible to the web terminal.";
    return files
      .slice()
      .sort((a, b) => new Date(b.receivedAt || 0).getTime() - new Date(a.receivedAt || 0).getTime())
      .slice(0, 18)
      .map((file) => `${file.safeName || file.name}  ${formatBytes(file.size || 0)}  ${file.status}  ${file.folderPath || "/"}`)
      .join("\n");
  };

  const buildTerminalContext = () =>
    [
      `Terminal page: ${activeSession.title}`,
      `Native bridge: ${bridgeAvailable ? "online" : "offline"}`,
      `Queued terminal requests: ${readJson<TerminalRequest[]>(REQUESTS_KEY, []).length}`,
      "Recent terminal lines:",
      ...activeSession.lines.slice(-24).map((line) => `[${line.kind}] ${line.text}`),
    ].join("\n");

  const askLocalLLM = async (prompt: string, taskType: PocketAITaskType = "code_help") => {
    if (!prompt.trim()) return "Usage: ask <question> or explain <command>";
    const router = createPocketAIRouter();
    const response = await router.generate({
      taskType,
      prompt,
      context: buildTerminalContext(),
      privacyLevel: "device",
      localKnowledgeMode: true,
      sourceFeature: "terminal",
      allowedTools: ["terminal.read", "terminal.queue", "archive.read", "apps.inspect"],
      maxTokens: 700,
      temperature: 0.15,
    });
    const sourceLine = response.sources?.length
      ? `\n\nSources:\n${response.sources.slice(0, 3).map((source) => `- ${source.title}${source.path ? ` (${source.path})` : ""}`).join("\n")}`
      : "";
    return `Baloss (${response.modelId || response.providerId}):\n${response.text}${sourceLine}`;
  };

  const getLLMStatus = async () => {
    const router = createPocketAIRouter();
    const status = await router.getProviderStatus();
    return [
      "Local LLM terminal link",
      `local: ${status.local.ok ? "ready" : "blocked"} - ${status.local.message}`,
      `model: ${status.local.modelId || "local fallback / bridge selected on demand"}`,
      `api fallback: ${status.api.ok ? "available" : "not active"} - ${status.api.message}`,
      `last decision: ${status.lastDecision || "none yet"}`,
      `last error: ${status.lastError || "none"}`,
    ].join("\n");
  };

  const runBuiltIn = async (rawCommand: string) => {
    const parts = splitCommand(rawCommand);
    const base = (parts[0] || "").toLowerCase();
    const rest = rawCommand.slice(parts[0]?.length || 0).trim();

    if (!base) return "";
    if (base === "help") return helpText;
    if (base === "commands") return commandCatalogText();
    if (base === "new") {
      createNewSession();
      return "Opened a new terminal page.";
    }
    if (base === "session") {
      return [
        `active: ${activeSession.title}`,
        `id: ${activeSession.id}`,
        `created: ${activeSession.createdAt}`,
        `updated: ${activeSession.updatedAt}`,
        `lines: ${activeSession.lines.length}`,
        `open pages: ${sessions.map((session) => session.title).join(", ")}`,
      ].join("\n");
    }
    if (base === "llm") {
      if ((parts[1] || "").toLowerCase() === "status") return getLLMStatus();
      return "Usage: llm status";
    }
    if (base === "ask") return askLocalLLM(rest, "code_help");
    if (base === "explain") return askLocalLLM(`Explain this terminal command, what it changes, and whether it is safe before running it:\n${rest}`, "explain");
    if (base === "audit") return buildAudit();
    if (base === "automations" || base === "automation") return buildAutomationStatus(rest);
    if (base === "bridge") return runBridgeStatus();
    if (base === "date") return new Date().toString();
    if (base === "pwd") return "/pocketflow/phone";
    if (base === "whoami") return "user@pocketflow-phone";
    if (base === "echo") return rest;
    if (base === "apps") {
      return POCKETFLOW_APP_TOOLS.map((app) => `${app.id.padEnd(13)} ${app.label} - ${app.summary}`).join("\n");
    }
    if (base === "files") {
      const total = files.reduce((sum, file) => sum + (file.size || 0), 0);
      return `Archive files: ${files.length}\nArchive size: ${formatBytes(total)}\n\n${listArchiveFiles()}`;
    }
    if (base === "ls") {
      const target = parts[1] || "/";
      if (target === "/" || target === "/pocketflow") return "/apps\n/archive\n/system\n/terminal";
      if (target === "/apps") return POCKETFLOW_APP_TOOLS.map((app) => app.id).join("\n");
      if (target === "/archive") return listArchiveFiles();
      if (target === "/system") return "info\nstorage\nbridge\nsettings";
      if (target === "/terminal") return "history\nrequests\nsettings";
      return `ls: ${target}: no such virtual directory. Try /apps, /archive, /system, /terminal.`;
    }
    if (base === "cat") {
      const target = parts[1] || "";
      if (target === "/system/info") return buildAudit();
      if (target === "/system/bridge") return runBridgeStatus();
      if (target === "/terminal/history") return history.length ? history.map((item, index) => `${index + 1}  ${item}`).join("\n") : "History is empty.";
      if (target === "/terminal/requests") {
        const requests = readJson<TerminalRequest[]>(REQUESTS_KEY, []);
        return requests.length ? requests.map((item) => `${item.id}  ${item.at}  ${item.command}`).join("\n") : "No queued terminal requests.";
      }
      return `cat: ${target || "(missing path)"}: readable virtual files: /system/info, /system/bridge, /terminal/history, /terminal/requests`;
    }
    if (base === "env") {
      return [
        "POCKETFLOW_APP=terminal",
        `POCKETFLOW_NATIVE_BRIDGE=${bridgeAvailable ? "1" : "0"}`,
        `POCKETFLOW_TERMINAL_SESSION=${activeSession.title}`,
        "POCKETFLOW_BALOSS_LINK=1",
        `POCKETFLOW_PROMPT=${settings.promptName}`,
        `POCKETFLOW_NATIVE_MODE=${settings.nativeMode}`,
      ].join("\n");
    }
    if (base === "history") return history.length ? history.map((item, index) => `${index + 1}  ${item}`).join("\n") : "History is empty.";
    if (base === "requests") {
      const requests = readJson<TerminalRequest[]>(REQUESTS_KEY, []);
      return requests.length ? requests.map((item) => `${item.id}  ${item.at}  ${item.command}`).join("\n") : "No queued terminal requests.";
    }
    if (base === "queue") return queueRequest(rest);
    if (base === "install") return runNativeCommand(`install ${rest}`);
    if (base === "openapp") return runNativeCommand(`openapp ${rest}`);
    if (base === "native") return runNativeCommand(rest);
    if (base === "settings") return JSON.stringify(settings, null, 2);
    if (base === "set") {
      const field = parts[1];
      const value = parts[2];
      if (field === "theme" && ["pro", "matrix", "amber"].includes(value)) {
        setSettings((current) => ({ ...current, theme: value as TerminalSettingsState["theme"] }));
        return `Theme set to ${value}.`;
      }
      if (field === "font") {
        const nextSize = Math.max(12, Math.min(18, Number(value) || DEFAULT_SETTINGS.fontSize));
        setSettings((current) => ({ ...current, fontSize: nextSize }));
        return `Font size set to ${nextSize}px.`;
      }
      if (field === "wrap" && ["on", "off"].includes(value)) {
        setSettings((current) => ({ ...current, wrapLines: value === "on" }));
        return `Line wrap ${value}.`;
      }
      if (field === "native" && ["bridge", "queue"].includes(value)) {
        setSettings((current) => ({ ...current, nativeMode: value === "bridge" ? "bridge_or_queue" : "queue_only" }));
        return `Native mode set to ${value === "bridge" ? "bridge or queue" : "queue only"}.`;
      }
      return "Usage: set theme pro|matrix|amber · set font 12..18 · set wrap on|off · set native bridge|queue";
    }

    return runNativeCommand(rawCommand);
  };

  const runCommand = async (submittedCommand = command) => {
    const trimmed = submittedCommand.trim();
    if (!trimmed) return;
    if (trimmed.toLowerCase() === "clear") {
      setActiveLines([]);
      setActiveCommand("");
      return;
    }
    setActiveLines((current) => [...current, { id: lineId(), kind: "input", text: `${settings.promptName} % ${trimmed}`, at: nowLabel() }]);
    if (/^term-\d+$/i.test(activeSession.title)) {
      updateActiveSession((session) => ({
        ...session,
        title: trimmed.slice(0, 18) || session.title,
      }));
    }
    setHistory((current) => [...current.filter((item) => item !== trimmed), trimmed].slice(-120));
    setHistoryCursor(null);
    setActiveCommand("");
    try {
      const output = await runBuiltIn(trimmed);
      if (output) pushLine("output", output);
    } catch (error) {
      pushLine("error", error instanceof Error ? error.message : "Command failed.");
    }
  };

  const copyText = async (text: string, label = "Copied.") => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify?.(label, "success");
    } catch {
      onNotify?.("Clipboard copy is blocked in this shell.", "warn");
    }
  };

  const pasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setActiveCommand((current) => `${current}${text}`);
      inputRef.current?.focus();
    } catch {
      onNotify?.("Clipboard paste is blocked. Long-press the input and paste manually.", "warn");
    }
  };

  const copySession = async () => {
    const text = lines.map((line) => `[${line.at}] ${line.text}`).join("\n");
    await copyText(text, "Terminal session copied.");
  };

  const moveHistory = (direction: "prev" | "next") => {
    if (!history.length) return;
    const nextCursor =
      direction === "prev"
        ? historyCursor === null
          ? history.length - 1
          : Math.max(0, historyCursor - 1)
        : historyCursor === null
          ? null
          : historyCursor >= history.length - 1
            ? null
            : historyCursor + 1;
    setHistoryCursor(nextCursor);
    setActiveCommand(nextCursor === null ? "" : history[nextCursor] || "");
  };

  const filteredCommandCatalog = useMemo(() => {
    const query = commandSearch.trim().toLowerCase();
    if (!query) return COMMAND_CATALOG;
    return COMMAND_CATALOG.filter((item) =>
      [item.label, item.command, item.group, item.description]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [commandSearch]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#0b0d10] text-slate-100 animate-fade-in">
      <div className="shrink-0 border-b border-white/10 bg-[#15171b] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-black text-white">
                <TerminalSquare className="h-4 w-4 text-sky-300" />
                Terminal
              </div>
              <div className="truncate text-[9px] font-mono font-black uppercase tracking-[0.22em] text-slate-500">
                {bridgeAvailable ? "Native bridge online" : "Web audit shell · native queue ready"}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={createNewSession}
              className="grid h-9 w-9 place-items-center rounded-xl border border-sky-300/25 bg-sky-300/10 text-sky-200"
              aria-label="New terminal page"
              data-testid="terminal-new-session"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={() => void runCommand("audit")}
              className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-[9px] font-mono font-black uppercase tracking-[0.18em] text-emerald-200"
            >
              Audit
            </button>
            <button
              onClick={() => setSettingsOpen((open) => !open)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200"
              aria-label="Terminal settings"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        {settingsOpen && (
          <div className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-black/35 p-3 text-[10px] font-mono text-slate-300">
            <div className="flex items-center justify-between gap-2">
              <span className="font-black uppercase tracking-[0.18em] text-slate-500">Theme</span>
              <div className="flex gap-1">
                {(["pro", "matrix", "amber"] as const).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => setSettings((current) => ({ ...current, theme }))}
                    className={`rounded-lg px-2 py-1 uppercase ${settings.theme === theme ? "bg-sky-400 text-black" : "bg-white/5 text-slate-300"}`}
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center justify-between gap-3">
              <span className="font-black uppercase tracking-[0.18em] text-slate-500">Font</span>
              <input
                type="range"
                min="12"
                max="18"
                value={settings.fontSize}
                onChange={(event) => setSettings((current) => ({ ...current, fontSize: Number(event.target.value) }))}
              />
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setSettings((current) => ({ ...current, wrapLines: !current.wrapLines }))}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left"
              >
                Wrap: {settings.wrapLines ? "on" : "off"}
              </button>
              <button
                onClick={() =>
                  setSettings((current) => ({
                    ...current,
                    nativeMode: current.nativeMode === "bridge_or_queue" ? "queue_only" : "bridge_or_queue",
                  }))
                }
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left"
              >
                Native: {settings.nativeMode === "bridge_or_queue" ? "bridge" : "queue"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-b border-white/10 bg-[#0f1115] px-3 py-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setActiveSessionId(session.id)}
              className={`group flex min-w-[118px] max-w-[170px] items-center justify-between gap-2 rounded-2xl border px-3 py-2 text-left font-mono transition ${
                session.id === activeSession.id
                  ? "border-sky-300/45 bg-sky-300/15 text-white"
                  : "border-white/10 bg-white/[0.04] text-slate-400"
              }`}
              data-testid="terminal-session-tab"
            >
              <span className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.12em]">{session.title}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  closeSession(session.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    closeSession(session.id);
                  }
                }}
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-black/35 text-slate-500 group-hover:text-red-200"
                aria-label={`Close ${session.title}`}
              >
                <X className="h-3 w-3" />
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-b border-white/10 bg-[#0b0d10] px-3 py-2">
        <button
          type="button"
          onClick={() => setCommandMenuOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left"
          aria-expanded={commandMenuOpen}
          data-testid="terminal-command-menu-toggle"
        >
          <span className="min-w-0">
            <span className="block text-[9px] font-mono font-black uppercase tracking-[0.2em] text-sky-300">Command finder</span>
            <span className="block truncate text-xs font-semibold text-slate-400">
              Search audits, automations, newsletters, bridge, archive and native templates
            </span>
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${commandMenuOpen ? "rotate-180" : ""}`} />
        </button>
        {commandMenuOpen && (
          <div className="mt-2 rounded-2xl border border-white/10 bg-black/40 p-2" data-testid="terminal-command-menu">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#050608] px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                value={commandSearch}
                onChange={(event) => setCommandSearch(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-600"
                placeholder="Search: newsletter, agent, status, install, archive..."
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <div className="mt-2 max-h-60 space-y-2 overflow-auto pr-1">
              {filteredCommandCatalog.length ? (
                filteredCommandCatalog.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-mono font-black uppercase tracking-[0.18em] text-slate-500">{item.group}</span>
                          {item.bridge && <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-amber-200">bridge</span>}
                        </div>
                        <p className="mt-1 text-sm font-black text-white">{item.label}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-400">{item.description}</p>
                        <code className="mt-2 block rounded-xl border border-sky-300/15 bg-sky-300/5 px-2 py-1 text-[11px] text-sky-200">{item.command}</code>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCommand(item.command);
                            inputRef.current?.focus();
                          }}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-mono font-black uppercase tracking-[0.16em] text-slate-200"
                        >
                          Insert
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCommandMenuOpen(false);
                            void runCommand(item.command);
                          }}
                          className="rounded-xl border border-sky-300/30 bg-sky-300/15 px-3 py-2 text-[9px] font-mono font-black uppercase tracking-[0.16em] text-sky-100"
                        >
                          Run
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-4 text-sm font-semibold text-slate-500">
                  No command matched this search. Try “newsletter”, “agent”, “bridge”, “archive”, or “install”.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 px-3 py-2 text-[9px] font-mono font-black uppercase tracking-[0.16em] text-slate-400">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <ShieldCheck className="mr-1 inline h-3.5 w-3.5 text-emerald-300" />
          Bridge {bridgeAvailable ? "on" : "off"}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">Apps {POCKETFLOW_APP_TOOLS.length}</div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">Queue {queuedRequests.length}</div>
      </div>

      <div
        ref={outputRef}
        className={`mx-3 min-h-0 flex-1 overflow-auto rounded-[24px] border p-3 font-mono shadow-inner ${themeClassNames[settings.theme]}`}
        style={{ fontSize: settings.fontSize }}
        data-testid="terminal-output"
      >
        {lines.length === 0 ? (
          <div className="text-slate-500">Session cleared. Type `help`.</div>
        ) : (
          lines.map((line) => (
            <div key={line.id} className={`mb-2 flex gap-2 ${settings.wrapLines ? "whitespace-pre-wrap break-words" : "whitespace-pre overflow-x-auto"}`}>
              <span className="shrink-0 select-none text-slate-600">{line.at}</span>
              <span
                className={
                  line.kind === "input"
                    ? promptColors[settings.theme]
                    : line.kind === "error"
                      ? "text-red-300"
                      : line.kind === "system"
                        ? "text-slate-400"
                        : "text-inherit"
                }
              >
                {line.text}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 bg-[#101216] p-3">
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button onClick={() => void pasteClipboard()} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-mono font-black uppercase tracking-[0.16em] text-slate-200">
            <Clipboard className="h-3.5 w-3.5" />
            Paste
          </button>
          <button onClick={() => void copySession()} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-mono font-black uppercase tracking-[0.16em] text-slate-200">
            <Copy className="h-3.5 w-3.5" />
            Copy
          </button>
          <button onClick={() => setActiveLines([])} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-mono font-black uppercase tracking-[0.16em] text-slate-200">
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void runCommand();
          }}
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/45 p-2"
        >
          <span className={`pl-2 font-mono text-xs font-black ${promptColors[settings.theme]}`}>{settings.promptName} %</span>
          <input
            ref={inputRef}
            value={command}
            onChange={(event) => setActiveCommand(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp") {
                event.preventDefault();
                moveHistory("prev");
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                moveHistory("next");
              }
              if (event.ctrlKey && event.key.toLowerCase() === "l") {
                event.preventDefault();
                setActiveLines([]);
              }
            }}
            className="min-w-0 flex-1 bg-transparent px-1 py-2 font-mono text-sm text-white outline-none placeholder:text-slate-600"
            placeholder="ls, install /sdcard/Download/app.apk, openapp package.name..."
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            data-testid="terminal-input"
          />
          {command && (
            <button type="button" onClick={() => setActiveCommand("")} className="grid h-9 w-9 place-items-center rounded-xl text-slate-500">
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="submit"
            className="grid h-10 w-10 place-items-center rounded-xl bg-sky-400 text-black shadow-[0_0_24px_rgba(56,189,248,0.35)]"
            aria-label="Run terminal command"
            data-testid="terminal-run"
          >
            <Play className="h-4 w-4 fill-black" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default TerminalApp;
