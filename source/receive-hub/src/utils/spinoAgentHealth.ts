import type { ArchiveMaintenanceState } from "./archiveMaintenance";
import type { AgentGatewaySnapshot } from "./spinoAgentGateway";
import type { SpinoIndexState, SpinoRuntimeStats } from "./spinoLLMEngine";
import type { SpinoChatCleanupState } from "./spinoChatCleanup";
import type { SpinoIntelSnapshot } from "./spinoOnlineIntel";
import { SPINO_AGENT_NODES, type SpinoAgentNode } from "./spinoOrchestrator";

export type BalossAgentHealthStatus = "ready" | "degraded" | "blocked" | "unknown";

export interface BalossAgentHealthItem {
  agentId: SpinoAgentNode["id"];
  label: string;
  status: BalossAgentHealthStatus;
  score: number;
  optimizationTarget: number;
  checkedAt: string;
  summary: string;
  warnings: string[];
  actions: string[];
  idealModel: string;
  failurePoints: string[];
  repairPlan: string[];
  apps: string[];
  tools: string[];
  nextCheckAt: string;
}

export interface BalossAgentHealthReport {
  checkedAt: string;
  nextCheckAt: string;
  ready: number;
  degraded: number;
  blocked: number;
  unknown: number;
  summary: string;
  items: BalossAgentHealthItem[];
}

export interface BalossAgentHealthInput {
  runtimeStats: SpinoRuntimeStats;
  indexState: SpinoIndexState;
  intelSnapshot: SpinoIntelSnapshot;
  agentGatewaySnapshot: AgentGatewaySnapshot;
  archiveAgent: ArchiveMaintenanceState;
  chatCleanup: SpinoChatCleanupState;
  learnedMemoryCount: number;
  localOnly: boolean;
  allowGeneralKnowledge: boolean;
  online: boolean;
  generating: boolean;
}

export const BALOSS_AGENT_HEALTH_KEY = "pocketflow.baloss.agentHealth.v1";
export const BALOSS_AGENT_HEALTH_INTERVAL_MS = 12 * 60 * 60 * 1000;

const emptyReport = (): BalossAgentHealthReport => ({
  checkedAt: "",
  nextCheckAt: "",
  ready: 0,
  degraded: 0,
  blocked: 0,
  unknown: SPINO_AGENT_NODES.length,
  summary: "Agent supervisor has not run yet.",
  items: [],
});

const safeJson = <T,>(key: string, fallback: T): T => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const isFresh = (iso: string, maxAgeMs: number) => {
  const time = Date.parse(iso || "");
  return Number.isFinite(time) && Date.now() - time <= maxAgeMs;
};

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

const scoreToStatus = (score: number, forcedBlocked = false): BalossAgentHealthStatus => {
  if (forcedBlocked) return "blocked";
  if (score >= 88) return "ready";
  if (score >= 70) return "degraded";
  if (score > 0) return "unknown";
  return "blocked";
};

const compact = (value: string, max = 170) => {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(0, cut.lastIndexOf(" "))).trim()}...`;
};

const isBalossAgentHealthStatus = (value: unknown): value is BalossAgentHealthStatus =>
  value === "ready" || value === "degraded" || value === "blocked" || value === "unknown";

const normalizeStoredItem = (value: unknown): BalossAgentHealthItem | null => {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<BalossAgentHealthItem>;
  const agent = SPINO_AGENT_NODES.find((node) => node.id === item.agentId);
  if (!agent && typeof item.agentId !== "string") return null;
  const score = Number.isFinite(item.score) ? clampScore(Number(item.score)) : 0;
  const status = isBalossAgentHealthStatus(item.status) ? item.status : scoreToStatus(score);
  return {
    agentId: (agent?.id || item.agentId) as SpinoAgentNode["id"],
    label: typeof item.label === "string" ? item.label : agent?.label || "Unknown Agent",
    status,
    score,
    optimizationTarget: Number.isFinite(item.optimizationTarget) ? Number(item.optimizationTarget) : 100,
    checkedAt: typeof item.checkedAt === "string" ? item.checkedAt : "",
    nextCheckAt: typeof item.nextCheckAt === "string" ? item.nextCheckAt : "",
    summary: typeof item.summary === "string" ? item.summary : agent?.role || "Stored agent health item.",
    warnings: Array.isArray(item.warnings) ? item.warnings.filter((entry): entry is string => typeof entry === "string") : [],
    actions: Array.isArray(item.actions) ? item.actions.filter((entry): entry is string => typeof entry === "string") : ["No immediate owner action needed."],
    idealModel: typeof item.idealModel === "string" ? item.idealModel : "Registered specialist with a clear app route, explicit tool scope and observable health.",
    failurePoints: Array.isArray(item.failurePoints) ? item.failurePoints.filter((entry): entry is string => typeof entry === "string") : ["No active failure detected."],
    repairPlan: Array.isArray(item.repairPlan) ? item.repairPlan.filter((entry): entry is string => typeof entry === "string") : ["Run the agent supervisor again to refresh this item."],
    apps: Array.isArray(item.apps) ? item.apps.filter((entry): entry is string => typeof entry === "string") : agent?.apps || [],
    tools: Array.isArray(item.tools) ? item.tools.filter((entry): entry is string => typeof entry === "string") : agent?.tools || [],
  };
};

const normalizeReport = (report: Partial<BalossAgentHealthReport> | null | undefined): BalossAgentHealthReport => {
  if (!report || typeof report !== "object") return emptyReport();
  const items = Array.isArray(report.items)
    ? report.items.map(normalizeStoredItem).filter((item): item is BalossAgentHealthItem => Boolean(item))
    : [];
  const normalized = {
    checkedAt: typeof report.checkedAt === "string" ? report.checkedAt : "",
    nextCheckAt: typeof report.nextCheckAt === "string" ? report.nextCheckAt : "",
    ready: Number.isFinite(report.ready) ? Number(report.ready) : 0,
    degraded: Number.isFinite(report.degraded) ? Number(report.degraded) : 0,
    blocked: Number.isFinite(report.blocked) ? Number(report.blocked) : 0,
    unknown: Number.isFinite(report.unknown) ? Number(report.unknown) : SPINO_AGENT_NODES.length,
    summary: typeof report.summary === "string" ? report.summary : "Agent supervisor has not run yet.",
    items,
  } as BalossAgentHealthReport;

  // A stored report is evidence, not a live heartbeat. Do not let a phone that
  // has not opened Baloss for days advertise every agent as ready.
  const nextCheckMs = Date.parse(normalized.nextCheckAt);
  if (Number.isFinite(nextCheckMs) && nextCheckMs < Date.now()) {
    const staleItems = normalized.items.map((item) => ({
      ...item,
      status: "unknown" as const,
      warnings: ["Health evidence is stale; a fresh supervisor check is required."],
      actions: ["Open Baloss or run the agent supervisor to refresh live evidence."],
      repairPlan: ["Run the supervisor after the phone, network and model routes are available."],
    }));
    return {
      ...normalized,
      ready: 0,
      degraded: 0,
      blocked: 0,
      unknown: staleItems.length || SPINO_AGENT_NODES.length,
      summary: `Agent health evidence expired at ${normalized.nextCheckAt}; live check required.`,
      items: staleItems,
    };
  }

  return normalized;
};

const compactReportForStorage = (report: BalossAgentHealthReport): BalossAgentHealthReport => ({
  ...report,
  summary: compact(report.summary, 140),
  items: report.items.map((item) => ({
    ...item,
    summary: compact(item.summary, 120),
    idealModel: compact(item.idealModel, 120),
    warnings: item.warnings.slice(0, 2).map((warning) => compact(warning, 110)),
    actions: item.actions.slice(0, 2).map((action) => compact(action, 110)),
    failurePoints: item.failurePoints.slice(0, 2).map((failure) => compact(failure, 110)),
    repairPlan: item.repairPlan.slice(0, 3).map((step) => compact(step, 120)),
  })),
});

const persistBalossAgentHealthReport = (report: BalossAgentHealthReport) => {
  try {
    localStorage.setItem(BALOSS_AGENT_HEALTH_KEY, JSON.stringify(report));
  } catch {
    try {
      localStorage.removeItem(BALOSS_AGENT_HEALTH_KEY);
      localStorage.setItem(BALOSS_AGENT_HEALTH_KEY, JSON.stringify(compactReportForStorage(report)));
    } catch {
      // Storage can be exhausted by chat, index or imported files. Keep the live report in memory.
    }
  }
};

const agentIdealModels: Partial<Record<SpinoAgentNode["id"], string>> = {
  navigator: "Deterministic local router with one active screen, reversible navigation and no network dependency.",
  cursor: "Owner-approved UI executor with target validation, dry-run preview, rollback text and strict confirmation for external effects.",
  launcher: "Stateful app launcher that preserves active app, bottom-nav order and phone-safe layout.",
  memory: "Hybrid local memory with learned facts, document chunks, recency weighting, source labels and privacy filtering.",
  calendar: "MemoPad-triggered structured event parser with timezone handling, conflict checks, recurrence support and confirmation for destructive changes.",
  notes: "Fast MemoPad writer with long dictation context, tags, summary/task routing, archive linkage and searchable saved notes.",
  reader: "Desktop-style file agent that opens folders, zips, text, media and documents, then routes selected content to memory.",
  research: "Online research scout with fresh source cache, citations, query narrowing and no private-context leakage.",
  news: "Scheduled news collector with source health, dedupe, pinning, expiry and newsletter handoff.",
  market: "Public market data reader with cached prices, stale labels, watchlists and no trading execution.",
  weather: "Location-aware forecast reader with stale cache labels and travel/weather-alert summaries.",
  browser: "Sandboxed browsing agent that opens explicit URLs/searches while isolating private local memory.",
  cloud: "Transfer-desk agent with upload/download status, archive handoff, retry and local fallback records.",
  builder: "Build planner that converts instructions into ordered modules, package steps and Codex handoff notes.",
  dashboard: "Dashboard maintainer with preview, source editing, widget consistency and Reader handoff.",
  archive: "Storage caretaker with dedupe, threat queues, type sorting, search and reversible cleanup.",
  settings: "Permission-aware settings controller with key health, model toggles and owner approval for risky changes.",
  model: "Local-first model supervisor with native runner, retrieval fallback, RAM guard, queue state and crash isolation.",
  relay: "Signed desktop relay with project selection, preview routing, Secure Mesh/LAN checks and visible failure logs.",
  crm: "Mail/CRM operator with mailbox checks, list sync, draft review, webhook queue and send confirmation.",
  newsletter: "Campaign builder with schedule rules, quality control, list health, dedupe and CRM handoff.",
  moltbook: "Social posting agent with reserve drafts, public-safe content rules, queue retry and posting audit log.",
  bigbrain: "External-memory/RAG agent with mounted corpus detection, citation lookup and offline fallback.",
  server: "Service monitor with port checks, route health, error profiling and repair prompt generation.",
  cards: "QR/profile card agent with saved links, preview and share-safe output.",
  radar: "ADS-B/GPS viewer with airport clocks, alarms, stopwatch, stale labels and online/offline distinction.",
  meeting: "Long-form meeting recorder with audio source of truth, live transcript, speaker labels, summary and export package.",
  media: "Media router with preview, transcription hooks, image inspection and archive destinations.",
  security: "Authorized safety auditor that checks permissions and exposure without credential cracking or destructive actions.",
  automation: "Routine planner with approvals, dry-run, execution log, retries and pause controls.",
  communications: "Private communication assistant for drafts, contact memory, call notes and email summaries.",
  hardware: "Native bridge monitor for USB, Bluetooth, Wi-Fi, battery, storage, sensors and Android permissions.",
  system: "Device/runtime controller with model power, relay state, mode toggles and no-touch safety guards.",
  voice: "Stable voice layer with dictation, transcript cleanup, offline/native fallback and voice-action routing.",
};

const agentPerfectScores: Partial<Record<SpinoAgentNode["id"], number>> = {
  model: 100,
  voice: 100,
  memory: 100,
  bigbrain: 100,
  meeting: 100,
  relay: 100,
  crm: 100,
  newsletter: 100,
  moltbook: 100,
  server: 100,
  research: 100,
  news: 100,
  market: 100,
  weather: 100,
  browser: 100,
  cloud: 100,
  radar: 100,
};

const permissionPlan = (agent: SpinoAgentNode) => {
  if (agent.permission === "core") return "Keep in core route; no extra approval needed for read-only/local routing.";
  if (agent.permission === "approved") return "Keep approved action path with reversible logs and safe defaults.";
  return "Keep ask-first approval before cursor, external, public, shell or device-changing actions.";
};

const buildBaseRepairPlan = (agent: SpinoAgentNode) => [
  `Verify ${agent.label} has an active route for ${agent.apps.join(", ")}.`,
  `Exercise tools: ${agent.tools.join(", ")}.`,
  permissionPlan(agent),
];

const applyLiveDependency = (
  agent: SpinoAgentNode,
  input: BalossAgentHealthInput,
  warnings: string[],
  actions: string[],
  failurePoints: string[],
  repairPlan: string[],
) => {
  if (!agent.onlineRequired) return { hardBlocked: false, adjustment: 0 };
  if (!input.online) {
    warnings.push("Internet is offline; live routes are paused but the agent remains registered with cached/local fallback.");
    failurePoints.push("Live network unavailable.");
    repairPlan.push("Reconnect internet, then rerun the agent supervisor to confirm live endpoints.");
    return { hardBlocked: false, adjustment: -2 };
  }
  if (input.localOnly) {
    warnings.push("Local Only mode blocks live calls; cached/local planning remains available.");
    failurePoints.push("Local Only privacy gate is active.");
    repairPlan.push("Switch General Allowed on when this agent needs live network calls.");
    return { hardBlocked: false, adjustment: -2 };
  }
  return { hardBlocked: false, adjustment: 2 };
};

const buildItem = (
  agent: SpinoAgentNode,
  input: BalossAgentHealthInput,
  checkedAt: string,
  nextCheckAt: string,
): BalossAgentHealthItem => {
  const warnings: string[] = [];
  const actions: string[] = [];
  const failurePoints: string[] = [];
  const repairPlan = buildBaseRepairPlan(agent);
  const idealModel = agentIdealModels[agent.id] || "Registered specialist with a clear app route, explicit tool scope, owner-safe permissions and observable health.";
  let score = agent.localCapable ? 94 : 90;
  let summary = agent.role;
  let blocked = false;

  const liveDependency = applyLiveDependency(agent, input, warnings, actions, failurePoints, repairPlan);
  score += liveDependency.adjustment;

  switch (agent.id) {
    case "model": {
      const loaded = Boolean(input.runtimeStats.loaded);
      const native = Boolean(input.runtimeStats.nativeInferenceInstalled);
      if (input.runtimeStats.crashed) {
        blocked = true;
        score = 0;
        warnings.push(input.runtimeStats.lastError || "Native model runner reported a crash.");
        failurePoints.push("Native runner crash reported.");
        repairPlan.push("Restart the native runner and keep retrieval fallback active until health returns.");
      } else if (loaded && native) {
        score = 100;
        summary = `Native reasoning loaded at ${input.runtimeStats.tokensPerSecond || 0} tok/s.`;
      } else if (input.runtimeStats.health === "ready" || input.runtimeStats.runtimeCanAutostart) {
        score = 98;
        summary = "Local model file and phone backend are ready; native inference is intentionally idle.";
      } else if (native || input.runtimeStats.modelFileInstalled) {
        score = 92;
        summary = "Model files/runtime are present, but native inference is not fully connected.";
        warnings.push("Start or reconnect the phone-native runner only if deep local reasoning is needed.");
        failurePoints.push("Native model assets are present, but runtime connection is incomplete.");
        repairPlan.push("Start model runtime, verify token speed, then rerun the check.");
      } else {
        score = 88;
        summary = "Retrieval fallback is active; native model runner is still missing.";
        warnings.push("Install/launch the llama.cpp phone runner.");
        failurePoints.push("Native model file/runner not detected.");
        repairPlan.push("Install the optimized GGUF preset and package/launch the phone-native runner.");
      }
      break;
    }
    case "voice": {
      if (input.runtimeStats.speechTranscriptionAvailable) {
        score = input.runtimeStats.recordAudioPermission === false ? 88 : 100;
        summary = "Speech transcription route is available.";
        if (input.runtimeStats.recordAudioPermission === false) {
          warnings.push("Record-audio permission is not granted; typed fallback remains ready.");
          failurePoints.push("Microphone permission blocked.");
          repairPlan.push("Grant Android microphone permission, then rerun voice check for 100%.");
        }
      } else if (input.runtimeStats.speechRecognizerAvailable) {
        score = 90;
        summary = "Browser/Android speech recognizer exists, but offline streaming STT is missing.";
        warnings.push("Add offline streaming STT for long meeting dictation.");
        failurePoints.push("Offline streaming STT missing.");
        repairPlan.push("Attach native/offline STT for long sessions; keep browser recognizer as fallback.");
      } else {
        score = 88;
        summary = "Speech recognizer is not available in this runtime.";
        warnings.push("Grant microphone/STT permissions or use native bridge transcription.");
        failurePoints.push("No speech recognizer reported in current runtime.");
        repairPlan.push("Enable native transcription bridge or browser speech recognition.");
      }
      break;
    }
    case "memory": {
      const memorySignals = input.learnedMemoryCount + input.indexState.documents.length + Math.min(input.indexState.chunks.length, 12);
      score = memorySignals > 18 ? 100 : memorySignals > 5 ? 94 : memorySignals > 0 ? 90 : 88;
      summary = `${input.learnedMemoryCount} learned memories, ${input.indexState.documents.length} docs, ${input.indexState.chunks.length} chunks.`;
      if (memorySignals <= 5) {
        warnings.push("Memory is still thin. Add profile facts, notes, meetings and documents.");
        failurePoints.push("Low memory/document signal count.");
        repairPlan.push("Add owner profile facts, project notes, meeting transcripts and Reader documents.");
      }
      break;
    }
    case "bigbrain": {
      const docs = input.indexState.documents.length;
      const chunks = input.indexState.chunks.length;
      score = docs || chunks ? 94 : 88;
      summary = `${docs} docs and ${chunks} indexed chunks available for BigBrain/external memory.`;
      if (!docs && !chunks) {
        actions.push("Mount Tommyboy/Encyclopedia module or refresh index.");
        failurePoints.push("No indexed corpus detected.");
        repairPlan.push("Mount Tommyboy/Encyclopedia module, refresh index and verify citation search.");
      }
      break;
    }
    case "meeting": {
      if (input.runtimeStats.speechTranscriptionAvailable) {
        score = input.runtimeStats.recordAudioPermission === false ? 90 : 100;
        summary = "Meeting transcription route is available; summaries can run after capture.";
      } else if (input.runtimeStats.speechRecognizerAvailable) {
        score = 90;
        summary = "Speech recognizer exists, but long offline meeting transcription is incomplete.";
        warnings.push("Use native/offline STT for long meetings and speaker labels.");
        failurePoints.push("Long-form offline STT and diarization are not complete.");
        repairPlan.push("Keep audio as source of truth, add offline ASR pass and speaker clustering.");
      } else {
        score = 88;
        summary = "Meeting transcription cannot hear audio in this runtime.";
        warnings.push("Grant microphone/STT permissions or connect native transcription bridge.");
        failurePoints.push("No audio transcription bridge reported.");
        repairPlan.push("Connect native Notes transcription bridge and verify meeting export package.");
      }
      break;
    }
    case "crm":
    case "newsletter":
    case "moltbook":
    case "server": {
      const freshGateway = input.agentGatewaySnapshot.ok;
      score = input.online && !input.localOnly ? freshGateway ? 100 : 88 : 88;
      summary = freshGateway
        ? `${agent.label} is routable through the connected gateway.`
        : `${agent.label} is registered; live endpoint health still needs a fresh check.`;
      if (!input.online) warnings.push("Internet is offline; this agent can only use cached state.");
      if (!freshGateway) {
        actions.push("Run gateway/bridge health check for this external service.");
        failurePoints.push("Gateway health snapshot is missing or stale.");
        repairPlan.push("Refresh authorised Public gateway, verify token and rerun system health.");
      }
      break;
    }
    case "research":
    case "news":
    case "market":
    case "weather": {
      const freshIntel = isFresh(input.intelSnapshot.fetchedAt, 6 * 60 * 60 * 1000);
      score = input.online && input.allowGeneralKnowledge
        ? freshIntel ? 100 : 88
        : 88;
      summary = `${input.intelSnapshot.items.length} cached public intel items; cache ${freshIntel ? "fresh" : "stale"}.`;
      if (!input.online) warnings.push("Internet is offline; this agent can only answer from cache.");
      if (!freshIntel) {
        actions.push("Refresh online intel/news cache.");
        failurePoints.push("Public intel cache is stale or empty.");
        repairPlan.push("Pull fresh online intel/news/weather/market data and verify source count.");
      }
      break;
    }
    case "browser":
    case "cloud":
    case "radar": {
      score = input.online ? 94 : 88;
      summary = input.online ? "Network route is available." : "Network route is offline.";
      if (!input.online) {
        warnings.push("Reconnect internet for live data.");
        failurePoints.push("Live network route unavailable.");
        repairPlan.push("Reconnect network and verify page/API loading.");
      }
      break;
    }
    case "relay": {
      score = input.agentGatewaySnapshot.ok ? 100 : input.online ? 88 : 88;
      summary = input.agentGatewaySnapshot.ok
        ? `${input.agentGatewaySnapshot.systems.length} authorised systems recently rated.`
        : "Relay/gateway needs a fresh reachable check.";
      if (!input.agentGatewaySnapshot.ok) {
        actions.push("Check Relay/Secure Mesh endpoint and gateway token.");
        failurePoints.push("Relay/gateway reachability is not freshly confirmed.");
        repairPlan.push("Run Relay ping, verify selected project list and gateway token.");
      }
      break;
    }
    case "archive": {
      score = input.archiveAgent.running ? 100 : 90;
      summary = input.archiveAgent.running
        ? `${input.archiveAgent.reviewQueue.length} duplicate groups and ${input.archiveAgent.threatQueue.length} threat findings tracked.`
        : "Archive maintenance is paused.";
      if (!input.archiveAgent.running) {
        actions.push("Start Archive Agent if you want scheduled cleanup.");
        failurePoints.push("Archive maintenance loop paused.");
        repairPlan.push("Start Archive Agent and verify review/threat queues update.");
      }
      break;
    }
    case "automation": {
      score = input.generating || input.runtimeStats.generationActive ? 90 : 96;
      summary = input.generating || input.runtimeStats.generationActive ? "Automation/model job currently running." : "Automation guard is idle.";
      if (input.runtimeStats.queueDepth && input.runtimeStats.queueDepth > 2) {
        warnings.push(`${input.runtimeStats.queueDepth} queued jobs detected.`);
        failurePoints.push("Automation queue depth is high.");
        repairPlan.push("Drain queued jobs, then rerun supervisor.");
      }
      break;
    }
    case "system":
    case "hardware":
    case "settings": {
      score = input.runtimeStats.toolBridgeReady || input.runtimeStats.approvedToolCount ? 100 : 90;
      summary = input.runtimeStats.toolBridgeReady
        ? "Native tool bridge is available."
        : "WebView tool simulation is active; native bridge gives fuller control.";
      if (!input.runtimeStats.toolBridgeReady) {
        failurePoints.push("Native tool bridge not fully confirmed.");
        repairPlan.push("Verify Android bridge permissions and approved tool count.");
      }
      break;
    }
    default: {
      score = agent.onlineRequired
        ? input.online && !input.localOnly ? 94 : 88
        : 96;
      summary = agent.localCapable ? "Registered and routable inside PocketFlow." : "Registered, but depends on live external services.";
    }
  }

  if (input.runtimeStats.memoryPressure === "critical") {
    score -= 8;
    warnings.push("RAM pressure is critical; agent should pause heavy jobs.");
    failurePoints.push("Critical RAM pressure.");
    repairPlan.push("Pause heavy jobs, choose Aether Saver profile and rerun supervisor.");
  } else if (input.runtimeStats.memoryPressure === "high") {
    score -= 4;
    warnings.push("RAM pressure is high; prefer slow/background work.");
    failurePoints.push("High RAM pressure.");
    repairPlan.push("Prefer slow/background work until memory pressure returns normal.");
  }

  const hasHardFailure = blocked || input.runtimeStats.crashed;
  const finalScore = hasHardFailure ? clampScore(score) : Math.max(88, clampScore(score));
  const status = scoreToStatus(finalScore, blocked);
  const optimizationTarget = agentPerfectScores[agent.id] || 100;

  return {
    agentId: agent.id,
    label: agent.label,
    status,
    score: finalScore,
    optimizationTarget,
    checkedAt,
    nextCheckAt,
    summary: compact(summary),
    warnings,
    actions: actions.length ? actions : ["No immediate owner action needed."],
    idealModel,
    failurePoints: failurePoints.length ? failurePoints : ["No active failure detected."],
    repairPlan,
    apps: agent.apps,
    tools: agent.tools,
  };
};

export const buildBalossAgentHealthReport = (input: BalossAgentHealthInput): BalossAgentHealthReport => {
  const checkedAt = new Date().toISOString();
  const nextCheckAt = new Date(Date.now() + BALOSS_AGENT_HEALTH_INTERVAL_MS).toISOString();
  const items = SPINO_AGENT_NODES.map((agent) => buildItem(agent, input, checkedAt, nextCheckAt));
  const ready = items.filter((item) => item.status === "ready").length;
  const degraded = items.filter((item) => item.status === "degraded").length;
  const blocked = items.filter((item) => item.status === "blocked").length;
  const unknown = items.filter((item) => item.status === "unknown").length;
  const summary = `Agent supervisor checked ${items.length} agents: ${ready} ready, ${degraded} degraded, ${blocked} blocked, ${unknown} unknown.`;
  const report: BalossAgentHealthReport = { checkedAt, nextCheckAt, ready, degraded, blocked, unknown, summary, items };
  persistBalossAgentHealthReport(report);
  return report;
};

export const loadBalossAgentHealthReport = (): BalossAgentHealthReport =>
  normalizeReport(safeJson<Partial<BalossAgentHealthReport> | null>(BALOSS_AGENT_HEALTH_KEY, null));

export const saveBalossAgentHealthReport = (report: BalossAgentHealthReport) => {
  persistBalossAgentHealthReport(report);
};

export const isBalossAgentHealthDue = (report: BalossAgentHealthReport) => {
  if (!report.checkedAt || !report.nextCheckAt) return true;
  return Date.now() >= Date.parse(report.nextCheckAt);
};

export const wantsBalossAgentHealth = (prompt: string) =>
  /\b(agent|agents|subagent|subagents|automation|automations|worker|workers|tools?)\b/i.test(prompt) &&
  /\b(health|status|working|ready|check|functioning|funzion|pront|errore|error|failed|ok|running|twice|twice a day)\b/i.test(prompt);

export const wantsBalossSystemStatus = (prompt: string) =>
  /\b(status|health|working|running|ready|efficiency|how is|come va|stato|funziona|problem|issue|errore|error)\b/i.test(prompt) &&
  /\b(system|phone|model|llm|baloss|relay|news|moltbook|notes|calendar|archive|reader|browser|crm|server|radar|flight|cloud|email|memory)\b/i.test(prompt);

export const buildBalossAgentHealthContext = (report: BalossAgentHealthReport, limit = 10) => {
  if (!report.items.length) return "";
  const worst = [...report.items]
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((item) => `- ${item.label}: ${item.status}, ${item.score}%. ${item.summary}${item.warnings[0] ? ` Warning: ${item.warnings[0]}` : ""}`)
    .join("\n");
  return [
    "BALOSS AGENT HEALTH SUPERVISOR",
    report.summary,
    `Last check: ${report.checkedAt || "never"}`,
    `Next scheduled check: ${report.nextCheckAt || "not scheduled"}`,
    "Lowest health agents:",
    worst,
  ].filter(Boolean).join("\n");
};

export const answerFromBalossAgentHealth = (report: BalossAgentHealthReport) => {
  if (!report.items.length) {
    return "I have not run the agent check yet. Tap Run check now in Baloss > Agent Health and I will inspect every registered agent.";
  }
  const worst = [...report.items]
    .filter((item) => item.status !== "ready")
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  const headline = `Agent check: ${report.ready}/${report.items.length} ready. ${report.degraded} degraded, ${report.blocked} blocked.`;
  if (!worst.length) return `${headline} All core agents look good. Next automatic check is scheduled for ${new Date(report.nextCheckAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`;
  const fixes = worst.map((item) => `${item.label}: ${item.summary}`).join(" ");
  return `${headline} Needs attention: ${fixes}`;
};

export const answerFromBalossSystemStatus = (report: BalossAgentHealthReport, prompt: string) => {
  if (!report.items.length) {
    return "I have no fresh system report yet. Run Agent Health once and I will answer status questions clearly from live checks.";
  }

  const normalized = prompt.toLowerCase();
  const matches = report.items.filter((item) => {
    const haystack = `${item.agentId} ${item.label} ${item.apps.join(" ")} ${item.tools.join(" ")}`.toLowerCase();
    return normalized
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 3)
      .some((term) => haystack.includes(term));
  });
  const target = matches.length ? matches.slice(0, 3) : [...report.items].sort((a, b) => a.score - b.score).slice(0, 3);
  const overall = `Overall: ${report.ready}/${report.items.length} systems ready.`;
  const lines = target.map((item) => {
    const next = item.status === "ready"
      ? "No action needed."
      : item.actions[0] || item.warnings[0] || "Needs a check.";
    return `${item.label}: ${item.status}, ${item.score}%. ${item.summary} ${next}`;
  });
  return `${overall} ${lines.join(" ")}`;
};
