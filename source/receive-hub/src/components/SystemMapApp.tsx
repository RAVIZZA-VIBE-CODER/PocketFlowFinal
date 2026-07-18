import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bot,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Layers3,
  KeyRound,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
  Zap,
} from "lucide-react";
import {
  computeNextRun,
  loadBalossDurableJobs,
  saveBalossDurableJobs,
  type BalossDurableJob,
} from "../utils/balossDurableScheduler";
import {
  PUBLIC_SERVER_INVENTORY,
  PUBLIC_SERVER_RUNTIME_STORAGE_KEY,
  loadPublicServerRuntime,
} from "../data/publicServerInventory";
import { loadBalossAgentHealthReport } from "../utils/spinoAgentHealth";
import { SPINO_AGENT_NODES } from "../utils/spinoOrchestrator";
import { loadSpinoIndex, type AetherStorageStats, type SpinoRuntimeStats } from "../utils/spinoLLMEngine";
import { loadSpinoIntelSnapshot } from "../utils/spinoOnlineIntel";
import { POCKETFLOW_APP_TOOLS, type PocketFlowAppId } from "../utils/spinoTools";
import { getAllBuilderProjects, getAllDashboards, getAllFiles } from "../utils/storage";
import { formatBytes } from "../utils/fileValidation";
import { loadArchiveMaintenanceState, type ArchiveMaintenanceState, type ArchiveThreatFinding } from "../utils/archiveMaintenance";
import { runBalossAgentOutputMaintenance, type BalossAgentOutputState, type BalossOutputRecord } from "../utils/balossAgentOutputs";
import { createEMapRegistrySnapshot, type EMapRegistrySnapshot } from "../emap/agentRegistry";
import { generateEMapMetroGraph } from "../emap/metroLayout";
import { createEMapEvent, createEMapRuntimeState } from "../emap/telemetry";
import type { EMapAvatarInstance, EMapEntity, EMapEvent, EMapLine, EMapRoute, EMapRuntimeState, EMapStation, EMapTrain } from "../emap/types";
import { PixelAvatar } from "../emap/visuals/PixelAvatar";
import { EMAP_BLOCK_LABELS, getBlocksForEntity, getBlocksForPayload, matchesSelectedBlocks, type EMapBlock } from "../emap/blocks";
import { loadPocketNotifications } from "../utils/pocketNotifications";

type MapStatus = "healthy" | "running" | "standby" | "warning" | "blocked" | "unknown";
type MapLayer = "model" | "memory" | "agents" | "automation" | "apps" | "external";
type EMapMenu = "baloss" | "notifications" | "search" | "blocks" | "filters" | "legend" | "health" | "settings" | "dev";
type AgentRuntimeMode = "auto" | "light" | "deep" | "paused";
type AgentPermissionMode = "inherit" | "core" | "approved" | "ask-first";

interface SystemMapAppProps {
  onNotify?: (message: string, type: "success" | "info" | "warn") => void;
  onOpenApp?: (appId: PocketFlowAppId) => void;
}

interface SystemStation {
  id: string;
  label: string;
  layer: MapLayer | "core";
  status: MapStatus;
  statusLabel?: string;
  x: number;
  y: number;
  detail: string;
  metric?: string;
  source: string;
  repair?: string;
  hub?: boolean;
  url?: string;
  functions?: string[];
  group?: string;
  sensitive?: boolean;
  appId?: PocketFlowAppId;
  jobId?: string;
  agentId?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  controlKind?: "automation" | "app" | "agent" | "external" | "model" | "memory" | "hub" | "core";
  appHub?: boolean;
  iconTag?: string;
  links?: string[];
}

interface SystemConnection {
  id: string;
  from: string;
  to: string;
  status: MapStatus;
}

interface SystemSnapshot {
  refreshedAt: string;
  runtimeStats: Partial<SpinoRuntimeStats>;
  aetherStorage: Partial<AetherStorageStats> | null;
  files: number;
  builderProjects: number;
  dashboards: number;
  indexDocs: number;
  indexChunks: number;
  intelItems: number;
  jobs: BalossDurableJob[];
  agentOutputs: BalossAgentOutputState;
  archiveMaintenance: ArchiveMaintenanceState;
  stations: SystemStation[];
  connections: SystemConnection[];
  emapRegistry: EMapRegistrySnapshot;
  emapRuntime: EMapRuntimeState;
}

interface ControlLogEntry {
  id: string;
  stationId: string;
  label: string;
  action: string;
  at: string;
  result: string;
}

interface AgentControlState {
  agentId: string;
  enabled: boolean;
  runtimeMode: AgentRuntimeMode;
  permissionMode: AgentPermissionMode;
  cadence: "auto" | "continuous" | "background" | "manual";
  lastAction?: string;
  lastControlAt?: string;
  restartCount?: number;
}

interface CanvasPointer {
  clientX: number;
  clientY: number;
}

type CanvasGesture =
  | { mode: "pan"; pointerId: number; startX: number; startY: number; viewBox: CanvasViewBox }
  | { mode: "pinch"; initialDistance: number; initialCenter: CanvasPointer; initialCenterSvg: { x: number; y: number }; viewBox: CanvasViewBox };

type CanvasViewBox = { x: number; y: number; width: number; height: number };

const statusTone: Record<MapStatus, { stroke: string; fill: string; text: string; glow: string; label: string }> = {
  healthy: {
    stroke: "#22c55e",
    fill: "rgba(34,197,94,0.18)",
    text: "text-[#8dffb0]",
    glow: "shadow-[0_0_30px_rgba(34,197,94,0.22)]",
    label: "healthy",
  },
  running: {
    stroke: "#67e8f9",
    fill: "rgba(103,232,249,0.18)",
    text: "text-cyan-100",
    glow: "shadow-[0_0_30px_rgba(103,232,249,0.20)]",
    label: "running",
  },
  standby: {
    stroke: "#64748b",
    fill: "rgba(100,116,139,0.12)",
    text: "text-slate-400",
    glow: "shadow-none",
    label: "standby",
  },
  warning: {
    stroke: "#facc15",
    fill: "rgba(250,204,21,0.18)",
    text: "text-amber-200",
    glow: "shadow-[0_0_30px_rgba(250,204,21,0.18)]",
    label: "check",
  },
  blocked: {
    stroke: "#fb7185",
    fill: "rgba(251,113,133,0.18)",
    text: "text-rose-200",
    glow: "shadow-[0_0_30px_rgba(251,113,133,0.20)]",
    label: "blocked",
  },
  unknown: {
    stroke: "#94a3b8",
    fill: "rgba(148,163,184,0.12)",
    text: "text-slate-300",
    glow: "shadow-none",
    label: "unknown",
  },
};

const stationStatusLabel = (station: Pick<SystemStation, "status" | "statusLabel">) =>
  station.statusLabel || statusTone[station.status].label;

const isStationWaitingOrStandby = (station: Pick<SystemStation, "status" | "statusLabel">) =>
  station.status === "standby" || ["WTP", "STB"].includes(stationStatusLabel(station).toUpperCase());

const isStationNeedsCheck = (station: Pick<SystemStation, "status" | "statusLabel">) =>
  station.status === "warning" && !isStationWaitingOrStandby(station);

const jobStatusLabel = (job: BalossDurableJob) => {
  if (!job.enabled || job.status === "paused") return "STB";
  if (job.status === "failed" || job.failureCount > 0) return "ERR";
  if (job.status === "running") return "RUN";
  if (job.nextRunAt && Date.parse(job.nextRunAt) < Date.now() - 10 * 60_000) return "CHECK";
  return "OK";
};

const CANVAS_WIDTH = 6000;
const CANVAS_HEIGHT = 9000;
const OVERVIEW_VIEWBOX = { x: 120, y: 110, width: 5740, height: 8820 };
const PAN_MARGIN_RATIO = 0.22;
const CONTROL_LOG_KEY = "pocketflow.systemMap.controlLog.v1";
const AGENT_CONTROL_KEY = "pocketflow.systemMap.agentControls.v1";
const RUN_AUTOMATIONS_EVENT = "pocketflow:run-scheduled-automations";
const DEV_SIMULATION_ENABLED = Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);

const layerMeta: Record<MapLayer, { label: string; hubLabel: string; color: string; description: string; hubX: number; hubY: number; angle: number; step: number; radius: number }> = {
  model: {
    label: "Model Lane",
    hubLabel: "Model Station",
    color: "#67e8f9",
    description: "Qwen/Baloss runtime, storage reserve, vector index, voice and tool bridge.",
    hubX: 5200,
    hubY: 4500,
    angle: 270,
    step: 68,
    radius: 270,
  },
  memory: {
    label: "Memory Lane",
    hubLabel: "Memory Station",
    color: "#a3e635",
    description: "Reader, Archive, Notes, Builder projects, dashboards and online intel cache.",
    hubX: 1900,
    hubY: 1500,
    angle: 145,
    step: 72,
    radius: 285,
  },
  agents: {
    label: "Agent Lane",
    hubLabel: "Agent Station",
    color: "#facc15",
    description: "Registered Baloss specialist agents and their last supervisor health.",
    hubX: 4100,
    hubY: 1500,
    angle: 195,
    step: 70,
    radius: 285,
  },
  automation: {
    label: "Automation Lane",
    hubLabel: "Automation Station",
    color: "#fb923c",
    description: "Durable scheduled jobs for newsletters, Moltbook, archive, BigBrain and health checks.",
    hubX: 4100,
    hubY: 7500,
    angle: -15,
    step: 70,
    radius: 285,
  },
  apps: {
    label: "App Surface Lane",
    hubLabel: "Apps Station",
    color: "#c084fc",
    description: "PocketFlow app gates exposed to Baloss navigation and tools.",
    hubX: 1900,
    hubY: 7500,
    angle: 30,
    step: 70,
    radius: 285,
  },
  external: {
    label: "External Server Lane",
    hubLabel: "External Servers",
    color: "#38bdf8",
    description: "public server routes, protected apps, mapped ports, runtime endpoints and monitor memories.",
    hubX: 800,
    hubY: 4500,
    angle: 90,
    step: 66,
    radius: 290,
  },
};

const APP_HUB_DEFINITIONS: Array<{
  appId: PocketFlowAppId;
  id: string;
  label: string;
  iconTag: string;
  detail: string;
  metric: string;
  source: string;
  links: string[];
}> = [
  {
    appId: "receive",
    id: "apphub-storage",
    label: "Archive Hub",
    iconTag: "ARC",
    detail: "Central app station for file storage, archive intake, external drives and automatic TXT drop folders.",
    metric: "files + vaults",
    source: "App hub map / Archive storage",
    links: ["archive-files", "moltbook-daily-txt-archive", "transport-memory-dropbox"],
  },
  {
    appId: "builder",
    id: "apphub-builder",
    label: "Builder Hub",
    iconTag: "BLD",
    detail: "Builder app station for project boxes, prompts, voice drafting, implementation packages and handoff status.",
    metric: "build routes",
    source: "App hub map / Builder storage",
    links: ["builder-projects", "agent-builder"],
  },
  {
    appId: "notes",
    id: "apphub-notes",
    label: "MemoPad Hub",
    iconTag: "MEM",
    detail: "Unified notes, dictation, task lists, shopping lists, calendar events and reminder station.",
    metric: "notes/lists/events",
    source: "App hub map / MemoPad",
    links: ["conversation-memory", "transport-memory-dropbox", "transport-collector-fleet"],
  },
  {
    appId: "news",
    id: "apphub-news",
    label: "News Hub",
    iconTag: "NWS",
    detail: "News Flow station for story pulls, newsletter sources, campaign drafts and public intel memory.",
    metric: "digests",
    source: "App hub map / News Flow",
    links: ["online-intel", "job-news-scouter-ai", "job-newsletter-public-midnight"],
  },
  {
    appId: "moltbook",
    id: "apphub-moltbook",
    label: "Moltbook Hub",
    iconTag: "MLT",
    detail: "Moltbook station for posts, comments, queue health, daily summaries and Reader TXT archive export.",
    metric: "posts + comments",
    source: "App hub map / Moltbook",
    links: ["agent-moltbook", "moltbook-daily-txt-archive"],
  },
];

const stationStatusFromHealth = (status?: string): MapStatus => {
  if (status === "ready" || status === "healthy" || status === "connected" || status === "fresh") return "healthy";
  if (status === "running" || status === "busy") return "running";
  if (status === "standby" || status === "sleeping" || status === "idle") return "standby";
  if (status === "queued") return "healthy";
  if (status === "paused") return "unknown";
  if (status === "degraded" || status === "partial") return "warning";
  if (status === "blocked" || status === "failed" || status === "error" || status === "down" || status === "limit") return "blocked";
  return "unknown";
};

const jobStatus = (job: BalossDurableJob): MapStatus => {
  if (!job.enabled) return "unknown";
  if (job.status === "running") return "running";
  if (job.status === "failed" || job.failureCount > 0) return "blocked";
  if (job.status === "paused") return "unknown";
  if (job.nextRunAt && Date.parse(job.nextRunAt) < Date.now() - 10 * 60_000) return "warning";
  return "healthy";
};

const appStatus = (app: { nativeRequired?: boolean; automatable: boolean; readable: boolean }, runtimeStats: Partial<SpinoRuntimeStats>): MapStatus => {
  if (app.nativeRequired && !runtimeStats.toolBridgeReady) return "warning";
  if (app.automatable && app.readable) return "healthy";
  if (app.readable) return "healthy";
  return "unknown";
};

const externalStatus = (health?: string): MapStatus => {
  if (health === "healthy") return "healthy";
  if (health === "checking") return "running";
  if (health === "warning") return "warning";
  if (health === "blocked") return "blocked";
  if (health === "down") return "blocked";
  return "unknown";
};

const compact = (value: string, max = 95) => {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(0, cut.lastIndexOf(" "))).trim()}...`;
};

const readControlLog = (): ControlLogEntry[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONTROL_LOG_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeControlLog = (entries: ControlLogEntry[]) => {
  localStorage.setItem(CONTROL_LOG_KEY, JSON.stringify(entries.slice(0, 80)));
};

const defaultAgentControl = (agentId: string, entity?: EMapEntity): AgentControlState => ({
  agentId,
  enabled: entity?.status !== "blocked" && entity?.status !== "offline",
  runtimeMode: "auto",
  permissionMode: "inherit",
  cadence: entity?.type === "monitor_agent" ? "continuous" : "auto",
});

const readAgentControls = (): Record<string, AgentControlState> => {
  try {
    const parsed = JSON.parse(localStorage.getItem(AGENT_CONTROL_KEY) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, Partial<AgentControlState>>)
        .filter(([agentId]) => typeof agentId === "string" && agentId.length > 0)
        .map(([agentId, value]) => {
          const runtimeMode = value.runtimeMode === "light" || value.runtimeMode === "deep" || value.runtimeMode === "paused" ? value.runtimeMode : "auto";
          const permissionMode = value.permissionMode === "core" || value.permissionMode === "approved" || value.permissionMode === "ask-first" ? value.permissionMode : "inherit";
          const cadence = value.cadence === "continuous" || value.cadence === "background" || value.cadence === "manual" ? value.cadence : "auto";
          return [agentId, {
            agentId,
            enabled: value.enabled !== false,
            runtimeMode,
            permissionMode,
            cadence,
            lastAction: typeof value.lastAction === "string" ? value.lastAction : undefined,
            lastControlAt: typeof value.lastControlAt === "string" ? value.lastControlAt : undefined,
            restartCount: Number.isFinite(value.restartCount) ? Number(value.restartCount) : 0,
          } satisfies AgentControlState];
        }),
    );
  } catch {
    return {};
  }
};

const writeAgentControls = (controls: Record<string, AgentControlState>) => {
  localStorage.setItem(AGENT_CONTROL_KEY, JSON.stringify(controls));
  window.dispatchEvent(new StorageEvent("storage", { key: AGENT_CONTROL_KEY }));
};

const formatTime = (value?: string) => {
  if (!value) return "not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const threatTone = (level: ArchiveThreatFinding["threatLevel"]) => {
  if (level === "critical") return "border-red-400/35 bg-red-500/12 text-red-100";
  if (level === "high") return "border-rose-300/30 bg-rose-400/10 text-rose-100";
  if (level === "medium") return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  return "border-sky-300/25 bg-sky-300/10 text-sky-100";
};

const threatExposureSummary = (finding: ArchiveThreatFinding) => {
  const extension = finding.extension ? `.${finding.extension}` : "unknown extension";
  const executableRisk = ["critical", "high"].includes(finding.threatLevel) || ["apk", "dex", "exe", "dll", "sh", "js", "jar", "ps1", "vbs"].includes(finding.extension);
  const containment =
    finding.scanStatus === "blocked"
      ? "Blocked from normal use."
      : finding.scanStatus === "quarantined"
        ? "Moved to quarantine."
        : finding.safeReaderRequired
          ? "Restricted to Reader safe box until owner decision."
          : "No hard restriction recorded.";
  const exposure =
    finding.scanStatus === "suspected"
      ? executableRisk
        ? "Possible exposure only if the file was opened, installed, executed, or routed outside the safe Reader."
        : "Possible exposure is limited to preview/parse surface unless another app opened it."
      : "Current exposure reduced by the recorded owner decision.";
  return {
    surface: `${extension.toUpperCase()} in ${finding.folderPath || "/"}`,
    containment,
    exposure,
    dataLoss: "No PocketFlow exfiltration log or confirmed data-loss evidence is recorded for this finding.",
  };
};

const dispatchAutomationWake = (reason: string, jobId?: string) => {
  window.dispatchEvent(new CustomEvent(RUN_AUTOMATIONS_EVENT, {
    detail: { reason, jobId, source: "system-map", triggeredAt: Date.now() },
  }));
};

const quadraticPoint = (
  from: { x: number; y: number },
  control: { x: number; y: number },
  to: { x: number; y: number },
  t: number,
) => {
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  };
};

const metroPath = (from: { x: number; y: number }, to: { x: number; y: number }, offset = 0) => {
  const midX = Math.round((from.x + to.x) / 2 + offset);
  if (Math.abs(from.x - to.x) < 18 || Math.abs(from.y - to.y) < 18) {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }
  return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
};

const polylinePath = (points: Array<{ x: number; y: number }>) =>
  points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

const closedPixelPath = (points: Array<{ x: number; y: number }>) => `${polylinePath(points)} Z`;

const islandPathByZone: Record<WorldZoneTheme, string> = {
  memory: "M860 760 C1130 620 1410 670 1650 590 C1920 500 2300 520 2530 660 C2690 800 2600 1040 2790 1240 C2960 1430 2940 1740 2790 1920 C2630 2110 2520 2440 2240 2600 C1970 2760 1680 2520 1420 2540 C1150 2560 890 2430 780 2200 C650 1940 690 1720 610 1480 C520 1200 620 900 860 760 Z",
  agents: "M3060 870 C3320 760 3650 850 3940 770 C4290 670 4920 710 5210 820 C5390 890 5320 1120 5460 1280 C5620 1480 5640 1800 5460 1980 C5260 2180 5020 2410 4770 2640 C4520 2870 4240 2730 3970 2660 C3700 2590 3380 2520 3180 2320 C3000 2140 3170 1840 3090 1580 C3010 1300 2860 1020 3060 870 Z",
  external: "M340 3170 C620 3030 920 3170 1210 3050 C1480 2940 1710 3090 1850 3340 C1990 3600 2240 3890 2310 4200 C2380 4510 2020 4740 1940 5070 C1860 5380 1580 5710 1280 5620 C1030 5540 690 5580 470 5390 C270 5200 360 4860 320 4560 C270 4210 330 3880 300 3580 C270 3360 190 3250 340 3170 Z",
  core: "M2380 3140 C2620 3030 2930 3140 3190 3060 C3460 2980 3730 3110 3850 3330 C3990 3600 3920 3890 4070 4200 C4210 4500 4060 4800 3900 5050 C3730 5320 3680 5700 3440 5920 C3180 6150 2870 5990 2600 5980 C2320 5970 2210 5600 2090 5320 C1970 5040 1870 4750 1940 4450 C2020 4130 2030 3830 2140 3540 C2230 3330 2190 3220 2380 3140 Z",
  model: "M4090 3140 C4430 3090 4720 3200 5050 3210 C5330 3220 5700 3300 5800 3510 C5920 3760 5740 4090 5800 4370 C5870 4720 5710 5060 5600 5380 C5480 5740 5070 5720 4790 5930 C4510 6140 4290 5790 4110 5550 C3910 5280 3740 5010 3810 4680 C3880 4350 3900 4040 3940 3720 C3970 3460 3900 3190 4090 3140 Z",
  apps: "M610 6460 C900 6220 1260 6320 1560 6180 C1860 6040 2190 6110 2370 6360 C2570 6630 2840 6970 2870 7270 C2900 7580 2600 7800 2520 8120 C2430 8480 2100 8710 1770 8620 C1440 8530 1120 8580 820 8460 C520 8340 590 7950 520 7660 C450 7380 500 7080 500 6810 C500 6630 450 6540 610 6460 Z",
  automation: "M3270 6200 C3620 6070 3970 6240 4310 6190 C4710 6130 5270 6200 5530 6350 C5740 6480 5640 6840 5680 7160 C5710 7510 5730 7910 5630 8230 C5530 8580 5200 8710 4870 8640 C4550 8580 4200 8710 3860 8610 C3500 8500 3390 8140 3190 7870 C2970 7560 2840 7290 2930 6930 C3010 6600 3030 6300 3270 6200 Z",
  security: "M410 5880 C700 5750 1010 5890 1300 5840 C1570 5800 1810 6040 1880 6300 C1960 6610 2070 6970 2050 7320 C2030 7670 1860 7990 1690 8300 C1530 8610 1260 8810 980 8660 C740 8530 450 8600 350 8370 C250 8130 390 7820 340 7520 C300 7240 330 6920 330 6610 C330 6320 210 5980 410 5880 Z",
};

const worldIslandPath = (zone: WorldZoneTheme, points: Array<{ x: number; y: number }>) =>
  islandPathByZone[zone] || closedPixelPath(points);

type WorldZoneTheme = "core" | "model" | "memory" | "agents" | "automation" | "apps" | "external" | "security";
type WorldBuildingKind =
  | "castle"
  | "brainLibrary"
  | "modelLab"
  | "archiveLibrary"
  | "agentGuild"
  | "factory"
  | "appVillage"
  | "dock"
  | "parking"
  | "firehouse"
  | "police"
  | "radio"
  | "newspaper"
  | "lakehouse"
  | "tower"
  | "house"
  | "airport"
  | "calendarHall"
  | "crmOffice"
  | "phoneOffice"
  | "weatherStation"
  | "notebook";

const worldZoneColor: Record<WorldZoneTheme, { land: string; edge: string; path: string; water?: string; accent: string }> = {
  core: { land: "#89cf63", edge: "#3b8f3b", path: "#f5dc8a", accent: "#facc15" },
  model: { land: "#d7e9dc", edge: "#5d8792", path: "#e8f6f0", water: "#70d6ff", accent: "#06b6d4" },
  memory: { land: "#86c95f", edge: "#3f8f37", path: "#f4d58a", accent: "#84cc16" },
  agents: { land: "#a9c969", edge: "#7c8f31", path: "#fff2a8", accent: "#eab308" },
  automation: { land: "#caa05a", edge: "#8b5a22", path: "#ffe2b4", accent: "#fb923c" },
  apps: { land: "#7fc261", edge: "#3f8f37", path: "#f2e3ff", accent: "#a855f7" },
  external: { land: "#79bd75", edge: "#2f7d57", path: "#e0f7ff", water: "#38bdf8", accent: "#0ea5e9" },
  security: { land: "#90b96d", edge: "#6f7f43", path: "#fee2e2", accent: "#ef4444" },
};

const worldZones: Array<{ id: WorldZoneTheme; label: string; points: Array<{ x: number; y: number }>; decorations: Array<{ x: number; y: number; kind: "tree" | "rock" | "cloud" | "pipe" | "wave" }> }> = [
  {
    id: "memory",
    label: "Archive Hills",
    points: [{ x: 880, y: 780 }, { x: 2500, y: 520 }, { x: 3000, y: 1650 }, { x: 2320, y: 2650 }, { x: 980, y: 2380 }, { x: 620, y: 1380 }],
    decorations: [{ x: 1050, y: 1180, kind: "tree" }, { x: 1320, y: 1810, kind: "pipe" }, { x: 2140, y: 1420, kind: "tree" }, { x: 2520, y: 940, kind: "cloud" }],
  },
  {
    id: "agents",
    label: "Agent Plaza",
    points: [{ x: 3020, y: 820 }, { x: 5200, y: 760 }, { x: 5600, y: 1840 }, { x: 4540, y: 2780 }, { x: 3180, y: 2360 }],
    decorations: [{ x: 4320, y: 1070, kind: "tree" }, { x: 5050, y: 1680, kind: "pipe" }, { x: 3650, y: 1960, kind: "cloud" }],
  },
  {
    id: "external",
    label: "Server Bay",
    points: [{ x: 360, y: 3200 }, { x: 1660, y: 3040 }, { x: 2380, y: 4200 }, { x: 1580, y: 5650 }, { x: 380, y: 5400 }],
    decorations: [{ x: 700, y: 4100, kind: "wave" }, { x: 1220, y: 3600, kind: "wave" }, { x: 1780, y: 4740, kind: "pipe" }],
  },
  {
    id: "core",
    label: "Baloss Library",
    points: [{ x: 2380, y: 3150 }, { x: 3740, y: 3150 }, { x: 4120, y: 4540 }, { x: 3500, y: 5960 }, { x: 2360, y: 5960 }, { x: 1920, y: 4580 }],
    decorations: [{ x: 2500, y: 3780, kind: "tree" }, { x: 3560, y: 3830, kind: "tree" }, { x: 2220, y: 5100, kind: "rock" }, { x: 3800, y: 5040, kind: "rock" }],
  },
  {
    id: "model",
    label: "Model Peaks",
    points: [{ x: 4100, y: 3140 }, { x: 5740, y: 3300 }, { x: 5650, y: 5440 }, { x: 4550, y: 5940 }, { x: 3800, y: 4700 }],
    decorations: [{ x: 4900, y: 3860, kind: "rock" }, { x: 5350, y: 4620, kind: "rock" }, { x: 4320, y: 5200, kind: "cloud" }],
  },
  {
    id: "apps",
    label: "App Village",
    points: [{ x: 620, y: 6480 }, { x: 2200, y: 6140 }, { x: 2860, y: 7280 }, { x: 2200, y: 8640 }, { x: 620, y: 8420 }],
    decorations: [{ x: 880, y: 7280, kind: "tree" }, { x: 1220, y: 8020, kind: "pipe" }, { x: 1900, y: 6960, kind: "tree" }],
  },
  {
    id: "automation",
    label: "Automation Works",
    points: [{ x: 3280, y: 6200 }, { x: 5550, y: 6250 }, { x: 5620, y: 8660 }, { x: 3700, y: 8620 }, { x: 2860, y: 7380 }],
    decorations: [{ x: 4050, y: 6900, kind: "pipe" }, { x: 4980, y: 7600, kind: "rock" }, { x: 5250, y: 8420, kind: "cloud" }],
  },
  {
    id: "security",
    label: "Safety Ridge",
    points: [{ x: 420, y: 5900 }, { x: 1680, y: 5900 }, { x: 2100, y: 7350 }, { x: 1560, y: 8780 }, { x: 380, y: 8520 }],
    decorations: [{ x: 780, y: 6680, kind: "rock" }, { x: 1260, y: 7460, kind: "rock" }, { x: 620, y: 8120, kind: "cloud" }],
  },
];

const worldIslandVisualScale: Record<WorldZoneTheme, number> = {
  memory: 0.84,
  agents: 0.84,
  external: 0.82,
  core: 0.84,
  model: 0.83,
  apps: 0.82,
  automation: 0.83,
  security: 0.82,
};

const worldZoneCenters: Record<WorldZoneTheme, { x: number; y: number }> = worldZones.reduce((centers, zone) => {
  centers[zone.id] = {
    x: zone.points.reduce((sum, point) => sum + point.x, 0) / zone.points.length,
    y: zone.points.reduce((sum, point) => sum + point.y, 0) / zone.points.length,
  };
  return centers;
}, {} as Record<WorldZoneTheme, { x: number; y: number }>);

const scaledZonePoint = (zone: WorldZoneTheme, point: { x: number; y: number }) => {
  const center = worldZoneCenters[zone];
  const scale = worldIslandVisualScale[zone];
  return {
    x: center.x + (point.x - center.x) * scale,
    y: center.y + (point.y - center.y) * scale,
  };
};

const scaledZonePolygon = (zone: WorldZoneTheme) => {
  const zoneSpec = worldZones.find((item) => item.id === zone);
  return zoneSpec?.points.map((point) => scaledZonePoint(zone, point)) || [];
};

const pointInPolygon = (point: { x: number; y: number }, polygon: Array<{ x: number; y: number }>) => {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index];
    const b = polygon[previous];
    const intersects = (a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
};

const isPointOnZoneLand = (zone: WorldZoneTheme, point: { x: number; y: number }) => pointInPolygon(point, scaledZonePolygon(zone));

const isFootprintOnZoneLand = (zone: WorldZoneTheme, point: { x: number; y: number }, radius = 150) => {
  const samples = [
    point,
    { x: point.x - radius, y: point.y },
    { x: point.x + radius, y: point.y },
    { x: point.x, y: point.y - radius * 0.72 },
    { x: point.x, y: point.y + radius * 0.82 },
  ];
  return samples.every((sample) => isPointOnZoneLand(zone, sample));
};

const safeWorldLot = (zone: WorldZoneTheme, point: { x: number; y: number }) => {
  if (isFootprintOnZoneLand(zone, point)) return point;
  const center = worldZoneCenters[zone];
  for (const factor of [0.62, 0.5, 0.38, 0.26]) {
    const snapped = {
      x: Math.round(center.x + (point.x - center.x) * factor),
      y: Math.round(center.y + (point.y - center.y) * factor),
    };
    if (isFootprintOnZoneLand(zone, snapped)) return snapped;
  }
  return { x: Math.round(center.x), y: Math.round(center.y) };
};

const worldLandLots: Record<WorldZoneTheme, Array<{ x: number; y: number }>> = {
  core: [
    { x: 3000, y: 4500 },
    { x: 2600, y: 4040 },
    { x: 3600, y: 4420 },
    { x: 2520, y: 5320 },
    { x: 3420, y: 5350 },
    { x: 2240, y: 4620 },
    { x: 3800, y: 4920 },
    { x: 3000, y: 3750 },
  ],
  model: [
    { x: 5200, y: 4500 },
    { x: 4680, y: 3820 },
    { x: 5350, y: 4380 },
    { x: 4430, y: 5300 },
    { x: 5100, y: 5100 },
    { x: 4240, y: 4600 },
    { x: 5480, y: 5050 },
    { x: 4860, y: 3420 },
  ],
  memory: [
    { x: 1900, y: 1500 },
    { x: 1540, y: 1260 },
    { x: 1780, y: 1420 },
    { x: 1320, y: 1960 },
    { x: 2240, y: 930 },
    { x: 1150, y: 1440 },
    { x: 2420, y: 1600 },
    { x: 2060, y: 2100 },
  ],
  agents: [
    { x: 4100, y: 1500 },
    { x: 4520, y: 1700 },
    { x: 5050, y: 1250 },
    { x: 3500, y: 2140 },
    { x: 4760, y: 2200 },
    { x: 5200, y: 1780 },
    { x: 3720, y: 1120 },
    { x: 4380, y: 2320 },
  ],
  automation: [
    { x: 4100, y: 7500 },
    { x: 3890, y: 6840 },
    { x: 4980, y: 7580 },
    { x: 5150, y: 6660 },
    { x: 4380, y: 8360 },
    { x: 3500, y: 7600 },
    { x: 5400, y: 8200 },
    { x: 4620, y: 7060 },
  ],
  apps: [
    { x: 1900, y: 7500 },
    { x: 1190, y: 7020 },
    { x: 2140, y: 7380 },
    { x: 930, y: 7700 },
    { x: 1540, y: 7900 },
    { x: 640, y: 8320 },
    { x: 2320, y: 6950 },
    { x: 1880, y: 8120 },
  ],
  external: [
    { x: 800, y: 4500 },
    { x: 620, y: 4200 },
    { x: 1540, y: 5200 },
    { x: 1040, y: 3600 },
    { x: 1840, y: 4580 },
    { x: 860, y: 5000 },
    { x: 1370, y: 3380 },
    { x: 1480, y: 4300 },
  ],
  security: [
    { x: 1040, y: 7920 },
    { x: 780, y: 6500 },
    { x: 1450, y: 7080 },
    { x: 1680, y: 8220 },
    { x: 620, y: 8300 },
    { x: 1710, y: 6350 },
    { x: 1160, y: 7060 },
    { x: 1560, y: 8200 },
  ],
};

const worldHarbors: Record<WorldZoneTheme, { x: number; y: number }> = {
  core: { x: 2220, y: 4500 },
  model: { x: 4050, y: 4700 },
  memory: { x: 2180, y: 2600 },
  agents: { x: 3180, y: 2140 },
  automation: { x: 3280, y: 6500 },
  apps: { x: 2200, y: 6500 },
  external: { x: 620, y: 4200 },
  security: { x: 1880, y: 6300 },
};

const worldHarborAngles: Record<WorldZoneTheme, number> = {
  core: -12,
  model: 24,
  memory: 74,
  agents: -64,
  automation: -36,
  apps: 22,
  external: -86,
  security: 18,
};

const worldBridgeSpans: Array<{ id: string; x: number; y: number; rotate: number; length: number; kind: "road" | "rail" | "wood" }> = [
  { id: "memory-core-bridge", x: 2320, y: 3100, rotate: 80, length: 520, kind: "road" },
  { id: "agents-core-bridge", x: 3270, y: 3040, rotate: -82, length: 520, kind: "road" },
  { id: "external-core-causeway", x: 2020, y: 4460, rotate: -8, length: 520, kind: "wood" },
  { id: "core-model-rail-bridge", x: 3920, y: 4520, rotate: 8, length: 560, kind: "rail" },
  { id: "apps-core-bridge", x: 2280, y: 6100, rotate: -72, length: 560, kind: "road" },
  { id: "automation-core-bridge", x: 3440, y: 6100, rotate: 64, length: 560, kind: "road" },
];

const lotGridKey = (point: { x: number; y: number }) => `${Math.round(point.x / 190)}:${Math.round(point.y / 160)}`;

const landLotForStation = (
  station: SystemStation,
  index: number,
  fallback: { x: number; y: number },
  occupiedLots?: Map<WorldZoneTheme, Set<string>>,
) => {
  const zone = stationWorldTheme(station);
  const catalog = worldLandLots[zone];
  const preferred = station.appHub && appHubVillagePositions[station.id]
    ? appHubVillagePositions[station.id]
    : catalog[index % catalog.length] || fallback;
  const depth = Math.floor(index / Math.max(1, catalog.length));
  const offset = depth
    ? { x: ((index % 3) - 1) * 120, y: (Math.floor(index / 3) % 3 - 1) * 105 }
    : { x: 0, y: 0 };
  const used = occupiedLots?.get(zone) || new Set<string>();
  if (occupiedLots && !occupiedLots.has(zone)) occupiedLots.set(zone, used);
  const base = { x: preferred.x + offset.x, y: preferred.y + offset.y };
  const attempts = [
    base,
    { x: base.x + 180, y: base.y - 90 },
    { x: base.x - 180, y: base.y + 90 },
    { x: base.x + 140, y: base.y + 150 },
    { x: base.x - 140, y: base.y - 150 },
    fallback,
  ];
  for (const attempt of attempts) {
    const lot = safeWorldLot(zone, attempt);
    const key = lotGridKey(lot);
    if (!used.has(key)) {
      used.add(key);
      return lot;
    }
  }
  const center = worldZoneCenters[zone];
  const ring = 220 + (index % 5) * 70;
  const angle = (index * 137.5 * Math.PI) / 180;
  const lot = safeWorldLot(zone, { x: center.x + Math.cos(angle) * ring, y: center.y + Math.sin(angle) * ring });
  used.add(lotGridKey(lot));
  return lot;
};

const appHubVillagePositions: Record<string, { x: number; y: number }> = {
  "apphub-storage": { x: 1190, y: 7020 },
  "apphub-builder": { x: 2140, y: 7380 },
  "apphub-notes": { x: 930, y: 7700 },
  "apphub-news": { x: 1540, y: 7900 },
  "apphub-moltbook": { x: 640, y: 8320 },
};

const stationWorldTheme = (station: Pick<SystemStation, "id" | "label" | "layer" | "controlKind" | "appId">): WorldZoneTheme => {
  const key = `${station.id} ${station.label} ${station.controlKind || ""} ${station.appId || ""}`.toLowerCase();
  if (key.includes("malware") || key.includes("security") || key.includes("safety") || key.includes("emergency") || key.includes("fix")) return "security";
  if (station.layer === "model") return "model";
  if (station.layer === "memory") return "memory";
  if (station.layer === "agents") return "agents";
  if (station.layer === "automation") return "automation";
  if (station.layer === "apps") return "apps";
  if (station.layer === "external") return "external";
  return "core";
};

const stationBuildingKind = (station: SystemStation): WorldBuildingKind => {
  const key = `${station.id} ${station.label} ${station.detail} ${station.appId || ""} ${station.controlKind || ""}`.toLowerCase();
  if (station.layer === "core") return "brainLibrary";
  if (key.includes("parking") || key.includes("yard") || key.includes("planned-agent-pool")) return "parking";
  if (key.includes("malware") || key.includes("police")) return "police";
  if (key.includes("safety") || key.includes("emergency") || key.includes("fixer") || key.includes("security")) return "firehouse";
  if (key.includes("moltbook")) return "radio";
  if (key.includes("news") || key.includes("newsletter") || key.includes("intel")) return "newspaper";
  if (key.includes("lake")) return "lakehouse";
  if (key.includes("radar") || key.includes("flight") || key.includes("airport") || key.includes("plane")) return "airport";
  if (key.includes("calendar") || key.includes("task") || key.includes("schedule")) return "calendarHall";
  if (key.includes("crm") || key.includes("email") || key.includes("contact") || key.includes("mail")) return "crmOffice";
  if (key.includes("phone") || key.includes("message") || key.includes("call") || key.includes("relay")) return "phoneOffice";
  if (key.includes("weather") || key.includes("clock")) return "weatherStation";
  if (key.includes("note") || key.includes("memo") || key.includes("dictation")) return "notebook";
  if (station.appHub && station.appId === "receive") return "archiveLibrary";
  if (station.appHub && station.appId === "builder") return "factory";
  if (station.appHub && station.appId === "notes") return "tower";
  if (station.layer === "model") return "modelLab";
  if (station.layer === "memory") return "archiveLibrary";
  if (station.layer === "agents") return "agentGuild";
  if (station.layer === "automation") return "factory";
  if (station.layer === "external") return "dock";
  if (station.layer === "apps" || station.appHub) return "appVillage";
  return station.hub ? "tower" : "house";
};

const worldPathFor = (from: { x: number; y: number }, to: { x: number; y: number }, bend = 0) => {
  const midX = (from.x + to.x) / 2 + bend;
  const midY = (from.y + to.y) / 2 - bend * 0.2;
  return `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`;
};

const CORE_WORLD_CENTER = { x: 3000, y: 4500 };
const CORE_WORLD_PORTS = {
  north: { x: 3000, y: 3540 },
  south: { x: 3000, y: 5480 },
  west: { x: 2220, y: 4500 },
  east: { x: 3780, y: 4500 },
  northWest: { x: 2380, y: 3820 },
  northEast: { x: 3620, y: 3820 },
  southWest: { x: 2380, y: 5180 },
  southEast: { x: 3620, y: 5180 },
};

const coreWorldPortFor = (target: { x: number; y: number }) => {
  const dx = target.x - CORE_WORLD_CENTER.x;
  const dy = target.y - CORE_WORLD_CENTER.y;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (absY > absX * 1.55) return dy < 0 ? CORE_WORLD_PORTS.north : CORE_WORLD_PORTS.south;
  if (absX > absY * 1.55) return dx < 0 ? CORE_WORLD_PORTS.west : CORE_WORLD_PORTS.east;
  if (dx < 0 && dy < 0) return CORE_WORLD_PORTS.northWest;
  if (dx > 0 && dy < 0) return CORE_WORLD_PORTS.northEast;
  if (dx < 0 && dy > 0) return CORE_WORLD_PORTS.southWest;
  return CORE_WORLD_PORTS.southEast;
};

const coreCableElbow = (port: { x: number; y: number }, target: { x: number; y: number }) => {
  if (port === CORE_WORLD_PORTS.north || port === CORE_WORLD_PORTS.south) return { x: port.x, y: Math.round((port.y + target.y) / 2) };
  if (port === CORE_WORLD_PORTS.west || port === CORE_WORLD_PORTS.east) return { x: Math.round((port.x + target.x) / 2), y: port.y };
  return { x: port.x, y: target.y < CORE_WORLD_CENTER.y ? Math.max(target.y, port.y - 460) : Math.min(target.y, port.y + 460) };
};

const organizedWorldPathFor = (from: { id?: string; x: number; y: number }, to: { id?: string; x: number; y: number }, bend = 0) => {
  if (from.id === "core") {
    const port = coreWorldPortFor(to);
    const elbow = coreCableElbow(port, to);
    return polylinePath([port, elbow, to]);
  }
  if (to.id === "core") {
    const port = coreWorldPortFor(from);
    const elbow = coreCableElbow(port, from);
    return polylinePath([from, elbow, port]);
  }
  return worldPathFor(from, to, bend);
};

const worldConnectionKind = (from: SystemStation, to: SystemStation): WorldRouteKind => {
  const fromZone = stationWorldTheme(from);
  const toZone = stationWorldTheme(to);
  if (fromZone !== toZone && (fromZone === "external" || toZone === "external")) return "sea";
  if (fromZone === "model" || toZone === "model") return "rail";
  if (fromZone === "automation" || toZone === "automation") return "industrial";
  return "road";
};

const organizedTransportPathFor = (from: SystemStation, to: SystemStation, kind: WorldRouteKind) => {
  if (kind !== "sea") return organizedWorldPathFor(from, to, from.id === "core" ? 0 : from.x < to.x ? 90 : -90);
  const fromPort = worldHarbors[stationWorldTheme(from)];
  const toPort = worldHarbors[stationWorldTheme(to)];
  const midX = Math.round((fromPort.x + toPort.x) / 2);
  const midY = Math.round((fromPort.y + toPort.y) / 2);
  const waterBend = fromPort.y < toPort.y ? 260 : -260;
  return polylinePath([
    from,
    safeWorldLot(stationWorldTheme(from), fromPort),
    { x: midX, y: midY + waterBend },
    safeWorldLot(stationWorldTheme(to), toPort),
    to,
  ]);
};

const cityStreetPathFor = (from: { id?: string; x: number; y: number }, to: { id?: string; x: number; y: number }) => {
  if (from.id === "core" || to.id === "core") return organizedWorldPathFor(from, to);
  const dx = Math.abs(from.x - to.x);
  const dy = Math.abs(from.y - to.y);
  if (dx < 120 || dy < 120) return polylinePath([from, to]);
  const horizontalFirst = dx > dy;
  const elbowA = horizontalFirst
    ? { x: Math.round((from.x + to.x) / 2), y: from.y }
    : { x: from.x, y: Math.round((from.y + to.y) / 2) };
  const elbowB = horizontalFirst
    ? { x: Math.round((from.x + to.x) / 2), y: to.y }
    : { x: to.x, y: Math.round((from.y + to.y) / 2) };
  return polylinePath([from, elbowA, elbowB, to]);
};

const worldTerrainFill = (zone: WorldZoneTheme) => {
  if (zone === "model") return "url(#world-map-snow)";
  if (zone === "automation") return "url(#world-map-rocky)";
  if (zone === "security" || zone === "agents") return "url(#world-map-dry-grass)";
  return "url(#world-map-grass)";
};

type WorldRouteKind = "road" | "rail" | "sea" | "industrial";

const worldRouteKind = (id: string): WorldRouteKind => {
  if (id === "central-spine") return "rail";
  if (id === "external") return "sea";
  if (id === "model") return "rail";
  if (id === "automation") return "industrial";
  return "road";
};

const WorldRoute = ({ d, kind, color, main = false, status }: { d: string; kind: WorldRouteKind; color: string; main?: boolean; status?: "healthy" | "warning" | "blocked" | "running" | "standby" | "planned" }) => {
  const blocked = status === "blocked";
  const warning = status === "warning";
  if (kind === "sea") {
    return (
      <g shapeRendering="geometricPrecision">
        <path d={d} fill="none" stroke="#075985" strokeWidth={main ? 26 : 18} strokeLinecap="round" strokeLinejoin="round" opacity="0.22" />
        <path d={d} fill="none" stroke="#e0f2fe" strokeWidth={main ? 10 : 7} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={main ? "2 42" : "2 34"} opacity="0.95" />
        <path d={d} fill="none" stroke="#ffffff" strokeWidth={main ? 5 : 3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={main ? "1 58" : "1 44"} opacity="0.85" />
      </g>
    );
  }
  if (kind === "rail") {
    return (
      <g shapeRendering="crispEdges">
        <path d={d} fill="none" stroke="#1f2937" strokeWidth={main ? 28 : 22} strokeLinecap="round" strokeLinejoin="round" />
        <path d={d} fill="none" stroke="#f8fafc" strokeWidth={main ? 18 : 13} strokeLinecap="round" strokeLinejoin="round" />
        <path d={d} fill="none" stroke="#111827" strokeWidth={main ? 4 : 3} strokeLinecap="butt" strokeLinejoin="miter" strokeDasharray="6 18" />
        <path d={d} fill="none" stroke="#111827" strokeWidth={main ? 14 : 10} strokeLinecap="butt" strokeLinejoin="round" strokeDasharray="2 38" opacity="0.38" />
      </g>
    );
  }
  if (kind === "industrial") {
    return (
      <g shapeRendering="crispEdges">
        <path d={d} fill="none" stroke="#111827" strokeWidth={main ? 34 : 26} strokeLinecap="round" strokeLinejoin="round" opacity={main ? 0.9 : 0.72} />
        <path d={d} fill="none" stroke="#475569" strokeWidth={main ? 24 : 17} strokeLinecap="round" strokeLinejoin="round" />
        <path d={d} fill="none" stroke="#f97316" strokeWidth={main ? 5 : 4} strokeLinecap="butt" strokeLinejoin="miter" strokeDasharray="20 18" />
        <path d={d} fill="none" stroke="#fed7aa" strokeWidth={main ? 3 : 2} strokeLinecap="butt" strokeLinejoin="miter" strokeDasharray="6 32" opacity="0.92" />
      </g>
    );
  }
  return (
    <g shapeRendering="geometricPrecision">
      {main ? (
        <>
          <path d={d} fill="none" stroke={blocked ? "#7f1d1d" : "#111827"} strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" opacity="0.86" />
          <path d={d} fill="none" stroke={blocked ? "#fecaca" : warning ? "#78350f" : "#374151"} strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
          <path d={d} fill="none" stroke={blocked ? "#ef4444" : warning ? "#facc15" : "#f8fafc"} strokeWidth="4" strokeLinecap="butt" strokeLinejoin="miter" strokeDasharray="28 24" opacity="0.88" />
          <path d={d} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.28" />
        </>
      ) : (
        <>
          <path d={d} fill="none" stroke="#8b5a2b" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
          <path d={d} fill="none" stroke={warning ? "#fde68a" : "#f3d38b"} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity="0.86" />
          <path d={d} fill="none" stroke="#fff7ed" strokeWidth="2" strokeLinecap="butt" strokeLinejoin="miter" strokeDasharray="10 18" opacity="0.52" />
        </>
      )}
    </g>
  );
};

const WorldHarbor = ({ zone }: { zone: WorldZoneTheme; key?: React.Key }) => {
  const point = safeWorldLot(zone, worldHarbors[zone]);
  const angle = worldHarborAngles[zone];
  const label = zone === "external" ? "PORT" : zone === "core" ? "MAIN DOCK" : "DOCK";
  return (
    <g transform={`translate(${point.x} ${point.y}) rotate(${angle})`} shapeRendering="geometricPrecision" pointerEvents="none">
      <rect x="-118" y="-34" width="236" height="68" rx="7" fill="#8b5a2b" stroke="#451a03" strokeWidth="6" />
      <rect x="-104" y="-22" width="208" height="44" rx="5" fill="#d6a15d" stroke="#78350f" strokeWidth="3" />
      {[-80, -40, 0, 40, 80].map((slot) => (
        <g key={slot}>
          <rect x={slot - 10} y="18" width="20" height="128" rx="5" fill="#8b5a2b" stroke="#451a03" strokeWidth="4" />
          <rect x={slot - 6} y="34" width="12" height="96" fill="#d6a15d" opacity="0.82" />
          <circle cx={slot} cy="146" r="9" fill="#fef3c7" stroke="#451a03" strokeWidth="3" />
        </g>
      ))}
      <rect x="-66" y="-68" width="132" height="34" rx="6" fill="#f8fafc" stroke="#111827" strokeWidth="4" />
      <text x="0" y="-46" textAnchor="middle" fill="#0f172a" fontFamily="monospace" fontSize="18" fontWeight="950">{label}</text>
      {[-62, 4, 64].map((x, index) => (
        <g key={`boat-${x}`} transform={`translate(${x} ${index % 2 ? 132 : 112})`}>
          <path d="M-20 0H20L10 18H-10Z" fill={index === 1 ? "#38bdf8" : "#f97316"} stroke="#111827" strokeWidth="3" />
          <rect x="-5" y="-12" width="15" height="12" fill="#f8fafc" stroke="#111827" strokeWidth="2" />
        </g>
      ))}
    </g>
  );
};

const WorldBridgeSpan = ({ x, y, rotate, length, kind }: { x: number; y: number; rotate: number; length: number; kind: "road" | "rail" | "wood"; key?: React.Key }) => (
  <g transform={`translate(${x} ${y}) rotate(${rotate})`} shapeRendering="geometricPrecision" pointerEvents="none">
    {kind === "rail" ? (
      <>
        <rect x={-length / 2} y="-34" width={length} height="68" rx="8" fill="#64748b" stroke="#334155" strokeWidth="8" />
        <path d={`M ${-length / 2 + 18} -15 H ${length / 2 - 18} M ${-length / 2 + 18} 15 H ${length / 2 - 18}`} stroke="#111827" strokeWidth="8" strokeLinecap="round" />
        {Array.from({ length: 12 }).map((_, index) => (
          <rect key={index} x={-length / 2 + 32 + index * ((length - 64) / 11) - 5} y="-28" width="10" height="56" fill="#e2e8f0" opacity="0.9" />
        ))}
      </>
    ) : kind === "wood" ? (
      <>
        <rect x={-length / 2} y="-28" width={length} height="56" rx="7" fill="#92400e" stroke="#451a03" strokeWidth="7" />
        {Array.from({ length: 11 }).map((_, index) => (
          <rect key={index} x={-length / 2 + 26 + index * ((length - 52) / 10) - 8} y="-31" width="16" height="62" fill="#fcd34d" opacity="0.55" />
        ))}
        <path d={`M ${-length / 2 + 20} -38 H ${length / 2 - 20} M ${-length / 2 + 20} 38 H ${length / 2 - 20}`} stroke="#78350f" strokeWidth="8" strokeLinecap="round" />
      </>
    ) : (
      <>
        <rect x={-length / 2} y="-38" width={length} height="76" rx="10" fill="#111827" stroke="#475569" strokeWidth="8" />
        <rect x={-length / 2 + 12} y="-27" width={length - 24} height="54" rx="6" fill="#374151" />
        <path d={`M ${-length / 2 + 32} 0 H ${length / 2 - 32}`} stroke="#f8fafc" strokeWidth="5" strokeDasharray="30 24" strokeLinecap="butt" />
        <path d={`M ${-length / 2 + 14} -43 H ${length / 2 - 14} M ${-length / 2 + 14} 43 H ${length / 2 - 14}`} stroke="#9ca3af" strokeWidth="6" strokeLinecap="round" />
      </>
    )}
  </g>
);

type WorldServiceKind = "street" | "alley" | "track" | "fiber" | "dock" | "security";

const serviceKindForLine = (line?: EMapLine, dependency?: boolean): WorldServiceKind => {
  const key = `${line?.id || ""} ${line?.name || ""}`.toLowerCase();
  if (dependency) return "fiber";
  if (key.includes("server") || key.includes("external")) return "dock";
  if (key.includes("security") || key.includes("policy") || key.includes("malware")) return "security";
  if (key.includes("memory") || key.includes("archive")) return "track";
  if (key.includes("agent") || key.includes("automation")) return "street";
  return "alley";
};

const WorldServiceRoute = ({ d, kind, active = false, blocked = false }: { d: string; kind: WorldServiceKind; active?: boolean; blocked?: boolean }) => {
  if (kind === "fiber") {
    return (
      <g shapeRendering="crispEdges">
        <path d={d} fill="none" stroke={blocked ? "#ef4444" : "#94a3b8"} strokeWidth={active ? 5 : 2.4} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 12" opacity={active ? 0.82 : 0.28} />
      </g>
    );
  }
  if (kind === "dock") {
    return (
      <g shapeRendering="crispEdges">
        <path d={d} fill="none" stroke="#075985" strokeWidth={active ? 10 : 6} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="18 18" opacity={active ? 0.82 : 0.36} />
        <path d={d} fill="none" stroke="#e0f2fe" strokeWidth={active ? 4 : 2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 30" opacity="0.76" />
      </g>
    );
  }
  if (kind === "track") {
    return (
      <g shapeRendering="crispEdges">
        <path d={d} fill="none" stroke="#92400e" strokeWidth={active ? 10 : 7} strokeLinecap="round" strokeLinejoin="round" opacity={active ? 0.74 : 0.32} />
        <path d={d} fill="none" stroke="#fef3c7" strokeWidth={active ? 5 : 3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="20 18" opacity="0.76" />
      </g>
    );
  }
  if (kind === "security") {
    return (
      <g shapeRendering="crispEdges">
        <path d={d} fill="none" stroke={blocked ? "#7f1d1d" : "#334155"} strokeWidth={active ? 12 : 8} strokeLinecap="round" strokeLinejoin="round" opacity={active ? 0.78 : 0.36} />
        <path d={d} fill="none" stroke="#fecaca" strokeWidth={active ? 4 : 2.4} strokeLinecap="butt" strokeLinejoin="round" strokeDasharray="16 16" opacity="0.78" />
      </g>
    );
  }
  return (
    <g shapeRendering="crispEdges">
      <path d={d} fill="none" stroke={kind === "street" ? "#8b5a2b" : "#a16207"} strokeWidth={active ? 12 : 7} strokeLinecap="round" strokeLinejoin="round" opacity={active ? 0.76 : 0.28} />
      <path d={d} fill="none" stroke={kind === "street" ? "#f7df9a" : "#fef3c7"} strokeWidth={active ? 6 : 3.5} strokeLinecap="round" strokeLinejoin="round" opacity="0.86" />
      <path d={d} fill="none" stroke="#fff7ed" strokeWidth={active ? 2.5 : 1.6} strokeLinecap="butt" strokeLinejoin="round" strokeDasharray={kind === "street" ? "16 16" : "8 18"} opacity="0.65" />
    </g>
  );
};

type StrategyTileKind = "grass" | "forest" | "mountain" | "crop" | "lake" | "ruin" | "port" | "snow" | "desert";

const strategyTileStyle: Record<StrategyTileKind, { base: string; edge: string; top: string }> = {
  grass: { base: "#80c969", edge: "#3f8f37", top: "#9be57c" },
  forest: { base: "#5fb850", edge: "#166534", top: "#86efac" },
  mountain: { base: "#a8a29e", edge: "#57534e", top: "#f8fafc" },
  crop: { base: "#c7cc55", edge: "#7c842a", top: "#fef3c7" },
  lake: { base: "#38bdf8", edge: "#075985", top: "#bae6fd" },
  ruin: { base: "#d6c2a1", edge: "#7c5b2d", top: "#fef3c7" },
  port: { base: "#8ecae6", edge: "#075985", top: "#92400e" },
  snow: { base: "#dbeafe", edge: "#7dd3fc", top: "#ffffff" },
  desert: { base: "#d6a354", edge: "#92400e", top: "#fde68a" },
};

const WorldStrategyTile = ({ kind, x, y, scale = 1 }: { key?: React.Key; kind: StrategyTileKind; x: number; y: number; scale?: number }) => {
  const style = strategyTileStyle[kind];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} shapeRendering="crispEdges" opacity="0.82">
      <path d="M0 -42L58 -18L58 30L0 58L-58 30L-58 -18Z" fill={style.base} stroke={style.edge} strokeWidth="5" />
      <path d="M0 -42L58 -18L0 4L-58 -18Z" fill={style.top} opacity="0.38" />
      {kind === "forest" && (
        <>
          <path d="M-26 18L-8 -20L10 18Z" fill="#16a34a" stroke="#14532d" strokeWidth="3" />
          <path d="M4 20L24 -24L44 20Z" fill="#22c55e" stroke="#14532d" strokeWidth="3" />
          <rect x="-2" y="16" width="8" height="20" fill="#7c2d12" />
        </>
      )}
      {kind === "mountain" && (
        <>
          <path d="M-34 30L-8 -28L18 30Z" fill="#78716c" stroke="#44403c" strokeWidth="3" />
          <path d="M4 32L32 -24L56 32Z" fill="#a8a29e" stroke="#57534e" strokeWidth="3" />
          <path d="M-8 -28L2 -6H-18Z" fill="#f8fafc" />
        </>
      )}
      {kind === "crop" && [-28, -10, 8, 26].map((line) => <path key={line} d={`M${line} -20V34`} stroke="#fef3c7" strokeWidth="4" strokeDasharray="8 8" />)}
      {kind === "lake" && (
        <>
          <path d="M-32 4C-14 -22 28 -20 40 8C24 36 -22 34 -32 4Z" fill="#0ea5e9" stroke="#075985" strokeWidth="3" />
          <path d="M-18 6C-4 -2 16 0 28 8" stroke="#e0f2fe" strokeWidth="4" fill="none" />
        </>
      )}
      {kind === "ruin" && (
        <>
          <rect x="-24" y="-6" width="16" height="34" fill="#8b7355" stroke="#4b3621" strokeWidth="3" />
          <rect x="4" y="-22" width="16" height="50" fill="#b99b73" stroke="#4b3621" strokeWidth="3" />
          <rect x="24" y="4" width="18" height="24" fill="#8b7355" stroke="#4b3621" strokeWidth="3" />
        </>
      )}
      {kind === "port" && (
        <>
          <rect x="-36" y="10" width="72" height="12" fill="#92400e" stroke="#451a03" strokeWidth="3" />
          <path d="M-18 -10H18L30 8H-30Z" fill="#e0f2fe" stroke="#075985" strokeWidth="3" />
        </>
      )}
    </g>
  );
};

const WorldStationPad = ({ station, radius, compact: isCompact }: { station: SystemStation; radius: number; compact: boolean }) => {
  const theme = worldZoneColor[stationWorldTheme(station)];
  const important = station.layer === "core" || station.hub || station.appHub;
  const padScale = important ? Math.max(0.62, Math.min(1.25, radius / 34)) : Math.max(0.34, Math.min(0.7, radius / 22));
  const routeKind = stationWorldTheme(station);
  const fill = routeKind === "model"
    ? "#e0f2fe"
    : routeKind === "automation"
      ? "#d6a354"
      : routeKind === "security"
        ? "#b9c98a"
        : "#9be57c";
  const stroke = routeKind === "model" ? "#67e8f9" : theme.edge;
  return (
    <g transform={`translate(${station.x} ${station.y + 12}) scale(${padScale})`} pointerEvents="none" shapeRendering="crispEdges" opacity={important ? 0.92 : 0.62}>
      <path d="M0 -74L104 -34L104 54L0 96L-104 54L-104 -34Z" fill={fill} stroke={stroke} strokeWidth="8" />
      <path d="M0 -74L104 -34L0 5L-104 -34Z" fill="#fff7c2" opacity="0.22" />
      <path d="M-72 18H72" stroke={isCompact ? "#f7df9a" : "#8b5a2b"} strokeWidth={isCompact ? "8" : "12"} strokeLinecap="round" opacity="0.72" />
      <path d="M0 -44V70" stroke={isCompact ? "#f7df9a" : "#8b5a2b"} strokeWidth={isCompact ? "6" : "9"} strokeLinecap="round" opacity="0.48" />
      {important && (
        <>
          <rect x="-80" y="-54" width="28" height="24" fill="#fef3c7" stroke="#7c2d12" strokeWidth="4" />
          <rect x="54" y="20" width="30" height="26" fill="#fef3c7" stroke="#7c2d12" strokeWidth="4" />
        </>
      )}
    </g>
  );
};

type WorldMiniKind = "hut" | "archive" | "agent" | "factory" | "dock" | "lab" | "watch" | "villa" | "tower";

const WorldMiniBuilding = ({ kind, x, y, scale = 1, flip = false }: { kind: WorldMiniKind; x: number; y: number; scale?: number; flip?: boolean }) => {
  const roof = kind === "factory" ? "#f97316" : kind === "lab" ? "#67e8f9" : kind === "watch" ? "#ef4444" : kind === "agent" ? "#facc15" : kind === "archive" ? "#22c55e" : kind === "dock" ? "#075985" : "#a855f7";
  const wall = kind === "factory" ? "#fed7aa" : kind === "lab" ? "#ecfeff" : kind === "watch" ? "#fee2e2" : kind === "agent" ? "#fef3c7" : kind === "archive" ? "#bbf7d0" : kind === "dock" ? "#bae6fd" : "#f3e8ff";
  const outline = kind === "dock" ? "#075985" : kind === "archive" ? "#14532d" : kind === "factory" ? "#7c2d12" : "#111827";
  if (kind === "dock") {
    return (
      <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`} shapeRendering="crispEdges" opacity="0.95">
        <rect x="-42" y="28" width="84" height="14" fill="#92400e" stroke="#451a03" strokeWidth="4" />
        <path d="M-34 2H26L44 18 26 34H-42Z" fill={wall} stroke={outline} strokeWidth="4" />
        <rect x="-8" y="-24" width="34" height="26" fill="#e0f2fe" stroke={outline} strokeWidth="4" />
        <rect x="-26" y="12" width="18" height="12" fill="#bfdbfe" stroke={outline} strokeWidth="3" />
      </g>
    );
  }
  if (kind === "factory") {
    return (
      <g transform={`translate(${x} ${y}) scale(${scale})`} shapeRendering="crispEdges" opacity="0.95">
        <rect x="-48" y="24" width="96" height="12" fill="rgba(15,23,42,0.13)" />
        <path d="M-42 28V-12L-18 2V-12L8 2V-12L42 8V28Z" fill={wall} stroke={outline} strokeWidth="4" />
        <rect x="18" y="-46" width="18" height="42" fill={roof} stroke={outline} strokeWidth="4" />
        <rect x="34" y="-58" width="22" height="10" fill="#fff7ed" opacity="0.78" />
        <rect x="-30" y="8" width="18" height="18" fill="#c2410c" stroke={outline} strokeWidth="3" />
        <rect x="0" y="7" width="20" height="19" fill="#c2410c" stroke={outline} strokeWidth="3" />
      </g>
    );
  }
  if (kind === "lab") {
    return (
      <g transform={`translate(${x} ${y}) scale(${scale})`} shapeRendering="crispEdges" opacity="0.95">
        <rect x="-42" y="24" width="84" height="12" fill="rgba(15,23,42,0.13)" />
        <rect x="-34" y="-6" width="68" height="44" fill={wall} stroke={outline} strokeWidth="4" />
        <rect x="-22" y="-40" width="44" height="34" fill={roof} stroke={outline} strokeWidth="4" />
        <rect x="-10" y="-28" width="20" height="12" fill="#e0f2fe" />
        <rect x="-22" y="8" width="16" height="16" fill="#cffafe" stroke={outline} strokeWidth="3" />
        <rect x="8" y="8" width="16" height="16" fill="#cffafe" stroke={outline} strokeWidth="3" />
      </g>
    );
  }
  if (kind === "watch" || kind === "tower") {
    return (
      <g transform={`translate(${x} ${y}) scale(${scale})`} shapeRendering="crispEdges" opacity="0.95">
        <rect x="-34" y="32" width="68" height="10" fill="rgba(15,23,42,0.13)" />
        <rect x="-22" y="-36" width="44" height="70" fill={wall} stroke={outline} strokeWidth="4" />
        <path d="M-32 -36L0 -66 32 -36Z" fill={roof} stroke={outline} strokeWidth="4" />
        <rect x="-9" y="-10" width="18" height="18" fill="#bae6fd" stroke={outline} strokeWidth="3" />
        <rect x="-8" y="16" width="16" height="18" fill="#78350f" stroke={outline} strokeWidth="3" />
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} shapeRendering="crispEdges" opacity="0.95">
      <rect x="-44" y="28" width="88" height="12" fill="rgba(15,23,42,0.13)" />
      <rect x="-34" y="-4" width="68" height="50" fill={wall} stroke={outline} strokeWidth="4" />
      <path d="M-42 -4L0 -40 42 -4Z" fill={roof} stroke={outline} strokeWidth="4" />
      <rect x="-23" y="10" width="14" height="14" fill="#bae6fd" stroke={outline} strokeWidth="3" />
      <rect x="8" y="10" width="14" height="14" fill="#bae6fd" stroke={outline} strokeWidth="3" />
      <rect x="-7" y="24" width="18" height="22" fill="#78350f" stroke={outline} strokeWidth="3" />
      {(kind === "archive" || kind === "agent") && <rect x="-18" y="-18" width="36" height="14" fill={roof} stroke={outline} strokeWidth="3" />}
    </g>
  );
};

type WorldMicroPlaceKind = "office" | "workshop" | "newsstand" | "archive" | "lab" | "security" | "server" | "garage" | "shop" | "queue";

const microPlaceKindFor = (entity?: EMapEntity): WorldMicroPlaceKind => {
  const key = `${entity?.id || ""} ${entity?.name || ""} ${entity?.type || ""}`.toLowerCase();
  if (key.includes("news") || key.includes("moltbook") || key.includes("post")) return "newsstand";
  if (key.includes("builder") || key.includes("deploy") || key.includes("build")) return "workshop";
  if (key.includes("archive") || key.includes("memory") || entity?.type === "memory" || entity?.type === "archive") return "archive";
  if (key.includes("model") || key.includes("llm") || entity?.type === "model") return "lab";
  if (key.includes("server") || key.includes("relay") || entity?.type === "server" || entity?.type === "external_module") return "server";
  if (key.includes("malware") || key.includes("security") || key.includes("policy") || entity?.type === "security") return "security";
  if (key.includes("queue") || key.includes("parking") || key.includes("yard") || entity?.type === "queue") return "queue";
  if (key.includes("automation") || key.includes("agent") || entity?.type === "automation" || entity?.type === "agent" || entity?.type === "monitor_agent") return "garage";
  if (key.includes("calendar") || key.includes("crm") || key.includes("notes")) return "shop";
  return "office";
};

const WorldMicroPlace = ({ kind, label, status, color, selected }: { kind: WorldMicroPlaceKind; label: string; status?: string; color: string; selected: boolean }) => {
  const bad = status === "error" || status === "blocked" || status === "offline";
  const busy = status === "active" || status === "busy" || status === "monitoring";
  const outline = selected ? "#020617" : bad ? "#7f1d1d" : "#1f2937";
  const scale = selected ? 1.28 : 1.04;
  const sign = compact(label.replace(/agent/gi, "").trim() || label, 4).toUpperCase();
  const base = kind === "security" ? "#fee2e2" : kind === "server" ? "#dbeafe" : kind === "archive" ? "#dcfce7" : kind === "lab" ? "#ecfeff" : kind === "newsstand" ? "#e0f2fe" : kind === "workshop" ? "#fed7aa" : "#fef3c7";
  const roof = kind === "security" ? "#ef4444" : kind === "server" ? "#2563eb" : kind === "archive" ? "#22c55e" : kind === "lab" ? "#06b6d4" : kind === "newsstand" ? "#0ea5e9" : kind === "workshop" ? "#f97316" : kind === "queue" ? "#64748b" : color;
  const statusLight = <circle cx="44" cy="-50" r="9" fill={bad ? "#ef4444" : busy ? "#22c55e" : "#facc15"} stroke="#f8fafc" strokeWidth="3" />;
  const signPlate = (
    <>
      <rect x="-38" y="-62" width="76" height="24" rx="4" fill="#f8fafc" stroke={outline} strokeWidth="3" />
      <text x="0" y="-45" textAnchor="middle" fill="#0f172a" fontFamily="monospace" fontSize={sign.length > 3 ? "8" : "10"} fontWeight="950">{sign}</text>
      {statusLight}
    </>
  );
  return (
    <g transform={`scale(${scale})`} shapeRendering="crispEdges">
      <rect x="-54" y="42" width="108" height="14" fill="rgba(15,23,42,0.16)" />
      {kind === "server" ? (
        <>
          <rect x="-46" y="-34" width="92" height="82" fill="#dbeafe" stroke={outline} strokeWidth="4" />
          <rect x="-56" y="-12" width="12" height="60" fill="#93c5fd" stroke={outline} strokeWidth="3" />
          <rect x="44" y="-12" width="12" height="60" fill="#93c5fd" stroke={outline} strokeWidth="3" />
          <rect x="-30" y="-22" width="60" height="12" fill="#1d4ed8" stroke="#1e3a8a" strokeWidth="2" />
          {[-2, 16, 34].map((y) => <rect key={y} x="-30" y={y} width="60" height="12" fill="#93c5fd" stroke="#1e3a8a" strokeWidth="2" />)}
          <rect x="-5" y="22" width="10" height="26" fill="#1e3a8a" />
          <path d="M32 -34V-76M12 -58L32 -76 52 -58" stroke={outline} strokeWidth="4" fill="none" />
        </>
      ) : kind === "garage" || kind === "workshop" ? (
        <>
          <path d="M-58 48V-8L-34 -8V-28L-6 -12V-30L58 2V48Z" fill={base} stroke={outline} strokeWidth="4" />
          <rect x="-44" y="12" width="34" height="36" fill="#78350f" stroke={outline} strokeWidth="3" />
          <rect x="-5" y="14" width="32" height="34" fill="#92400e" stroke={outline} strokeWidth="3" />
          <rect x="34" y="8" width="18" height="16" fill="#bfdbfe" stroke={outline} strokeWidth="3" />
          <rect x="30" y="-48" width="12" height="50" fill={roof} stroke={outline} strokeWidth="3" />
          <rect x="40" y="-60" width="30" height="10" fill="#fed7aa" stroke={outline} strokeWidth="3" />
          <path d="M-42 24H26M-42 36H26" stroke="#fef3c7" strokeWidth="2" />
        </>
      ) : kind === "newsstand" ? (
        <>
          <rect x="-54" y="-4" width="108" height="52" fill={base} stroke={outline} strokeWidth="4" />
          <rect x="-62" y="-34" width="124" height="18" fill="#f8fafc" stroke={outline} strokeWidth="3" />
          {[-52, -28, -4, 20, 44].map((x, index) => <rect key={x} x={x} y="-34" width="18" height="18" fill={index % 2 ? "#0ea5e9" : "#ef4444"} opacity="0.92" />)}
          <path d="M-62 -16H62L48 2H-48Z" fill={roof} stroke={outline} strokeWidth="3" />
          <rect x="-40" y="12" width="20" height="26" fill="#f8fafc" stroke={outline} strokeWidth="2" />
          <rect x="-10" y="12" width="20" height="26" fill="#f8fafc" stroke={outline} strokeWidth="2" />
          <rect x="22" y="10" width="18" height="38" fill="#78350f" stroke={outline} strokeWidth="3" />
          <rect x="-48" y="40" width="38" height="8" fill="#facc15" stroke={outline} strokeWidth="2" />
        </>
      ) : kind === "security" ? (
        <>
          <rect x="-62" y="-4" width="124" height="52" fill={base} stroke={outline} strokeWidth="4" />
          <rect x="-38" y="-42" width="76" height="38" fill={roof} stroke={outline} strokeWidth="4" />
          <rect x="-54" y="14" width="26" height="26" fill="#bfdbfe" stroke={outline} strokeWidth="3" />
          <rect x="-10" y="12" width="20" height="36" fill="#78350f" stroke={outline} strokeWidth="3" />
          <rect x="28" y="14" width="26" height="26" fill="#bfdbfe" stroke={outline} strokeWidth="3" />
          <rect x="-18" y="-32" width="36" height="18" fill="#f8fafc" stroke={outline} strokeWidth="2" />
          <path d="M0 -30V-16M-7 -23H7" stroke="#ef4444" strokeWidth="5" />
          <rect x="-66" y="34" width="24" height="14" fill="#64748b" stroke={outline} strokeWidth="2" />
          <rect x="42" y="34" width="24" height="14" fill="#64748b" stroke={outline} strokeWidth="2" />
        </>
      ) : kind === "archive" ? (
        <>
          <rect x="-58" y="-2" width="116" height="50" fill={base} stroke="#14532d" strokeWidth="4" />
          <path d="M-66 -2L0 -44 66 -2Z" fill="#22c55e" stroke="#14532d" strokeWidth="4" />
          {[-36, -12, 12, 36].map((x) => <rect key={x} x={x - 5} y="6" width="10" height="42" fill="#166534" stroke="#14532d" strokeWidth="2" />)}
          <rect x="-48" y="18" width="96" height="8" fill="#fef3c7" />
          <rect x="-48" y="34" width="96" height="8" fill="#fef3c7" />
        </>
      ) : kind === "lab" ? (
        <>
          <rect x="-54" y="-2" width="108" height="50" fill={base} stroke={outline} strokeWidth="4" />
          <path d="M-34 -2C-30 -42 30 -42 34 -2Z" fill="#67e8f9" stroke={outline} strokeWidth="4" />
          <rect x="-42" y="14" width="20" height="22" fill="#cffafe" stroke={outline} strokeWidth="3" />
          <rect x="-8" y="12" width="16" height="36" fill="#0e7490" stroke={outline} strokeWidth="3" />
          <rect x="22" y="14" width="20" height="22" fill="#cffafe" stroke={outline} strokeWidth="3" />
          <path d="M40 -22V-60M24 -48L40 -60 56 -48" stroke={outline} strokeWidth="3" fill="none" />
          <circle cx="-38" cy="-24" r="8" fill="#f8fafc" stroke={outline} strokeWidth="3" />
        </>
      ) : kind === "shop" ? (
        <>
          <rect x="-52" y="-4" width="104" height="52" fill={base} stroke={outline} strokeWidth="4" />
          <rect x="-58" y="-26" width="116" height="22" fill="#f8fafc" stroke={outline} strokeWidth="3" />
          {[-52, -29, -6, 17, 40].map((x, index) => <rect key={x} x={x} y="-26" width="17" height="22" fill={index % 2 ? color : "#facc15"} opacity="0.9" />)}
          <rect x="-32" y="12" width="22" height="24" fill="#bfdbfe" stroke={outline} strokeWidth="3" />
          <rect x="10" y="10" width="22" height="38" fill="#78350f" stroke={outline} strokeWidth="3" />
          <rect x="-48" y="36" width="26" height="12" fill="#22c55e" stroke={outline} strokeWidth="2" />
        </>
      ) : kind === "queue" ? (
        <>
          <rect x="-58" y="-10" width="116" height="58" fill="#e2e8f0" stroke={outline} strokeWidth="4" />
          <rect x="-38" y="-42" width="76" height="32" fill={roof} stroke={outline} strokeWidth="4" />
          <text x="0" y="-20" textAnchor="middle" fill="#f8fafc" fontFamily="monospace" fontSize="20" fontWeight="950">P</text>
          {[-34, 0, 34].map((x) => <rect key={x} x={x - 12} y="14" width="24" height="16" fill={x === 0 ? "#facc15" : "#38bdf8"} stroke={outline} strokeWidth="2" />)}
          <path d="M-48 4H48M-48 38H48" stroke="#f8fafc" strokeWidth="3" strokeDasharray="12 10" />
        </>
      ) : (
        <>
          <rect x="-50" y="-4" width="100" height="52" fill={base} stroke={outline} strokeWidth="4" />
          <path d="M-58 -4L0 -42 58 -4Z" fill={roof} stroke={outline} strokeWidth="4" />
          <rect x="-36" y="10" width="16" height="18" fill="#bfdbfe" stroke={outline} strokeWidth="3" />
          <rect x="-8" y="10" width="16" height="18" fill="#bfdbfe" stroke={outline} strokeWidth="3" />
          <rect x="22" y="10" width="16" height="18" fill="#bfdbfe" stroke={outline} strokeWidth="3" />
          <rect x="-8" y="25" width="18" height="23" fill="#78350f" stroke={outline} strokeWidth="3" />
          <rect x="-46" y="36" width="20" height="12" fill="#22c55e" stroke="#14532d" strokeWidth="2" />
        </>
      )}
      {signPlate}
    </g>
  );
};

type WorldNpcKind = "walker" | "worker" | "guard" | "porter" | "vendor" | "boat";

const WorldNpc = ({ kind, x, y, color = "#2563eb", path, begin = "0s", animated = true }: { key?: React.Key; kind: WorldNpcKind; x: number; y: number; color?: string; path?: string; begin?: string; animated?: boolean }) => {
  const body = (
    <g transform={`translate(${x} ${y})`} shapeRendering="crispEdges" opacity="0.9">
      {kind === "boat" ? (
        <>
          <path d="M-22 4H22L10 18H-10Z" fill={color} stroke="#0f172a" strokeWidth="3" />
          <rect x="-6" y="-10" width="18" height="14" fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />
        </>
      ) : (
        <>
          <rect x="-8" y="-17" width="16" height="16" fill={kind === "guard" ? "#ef4444" : kind === "worker" ? "#f97316" : kind === "vendor" ? "#22c55e" : color} stroke="#0f172a" strokeWidth="2" />
          <rect x="-7" y="-1" width="14" height="18" fill={kind === "porter" ? "#92400e" : "#fef3c7"} stroke="#0f172a" strokeWidth="2" />
          <rect x="-13" y="7" width="6" height="12" fill="#0f172a" />
          <rect x="7" y="7" width="6" height="12" fill="#0f172a" />
          {kind === "vendor" && <rect x="11" y="-12" width="16" height="9" fill="#facc15" stroke="#0f172a" strokeWidth="2" />}
          {kind === "guard" && <rect x="-15" y="-6" width="8" height="16" fill="#94a3b8" stroke="#0f172a" strokeWidth="2" />}
        </>
      )}
    </g>
  );
  if (!path || !animated) return body;
  return (
    <g>
      {body}
      <animateMotion path={path} dur={kind === "boat" ? "16s" : "12s"} begin={begin} repeatCount="indefinite" rotate="auto" />
    </g>
  );
};

const WorldDistrictLot = ({ x, y, width, height, fill, stroke, label, rotate = 0 }: { key?: React.Key; x: number; y: number; width: number; height: number; fill: string; stroke: string; label: string; rotate?: number }) => (
  <g transform={`translate(${x} ${y}) rotate(${rotate})`} shapeRendering="crispEdges" opacity="0.82">
    <path
      d={`M ${-width / 2 + 34} ${-height / 2} H ${width / 2 - 42} Q ${width / 2} ${-height / 2 + 4} ${width / 2 - 8} ${-height / 2 + 46} V ${height / 2 - 34} Q ${width / 2 - 10} ${height / 2} ${width / 2 - 54} ${height / 2} H ${-width / 2 + 42} Q ${-width / 2} ${height / 2 - 6} ${-width / 2 + 8} ${height / 2 - 50} V ${-height / 2 + 36} Q ${-width / 2 + 8} ${-height / 2 + 2} ${-width / 2 + 34} ${-height / 2} Z`}
      fill={fill}
      stroke={stroke}
      strokeWidth="5"
    />
    <path d={`M ${-width / 2 + 34} 0 H ${width / 2 - 34}`} stroke="#9ca3af" strokeWidth="28" strokeLinecap="round" />
    <path d={`M ${-width / 2 + 44} 0 H ${width / 2 - 44}`} stroke="#f8fafc" strokeWidth="4" strokeDasharray="18 18" opacity="0.85" />
    <path d={`M 0 ${-height / 2 + 24} V ${height / 2 - 24}`} stroke="#9ca3af" strokeWidth="18" strokeLinecap="round" opacity="0.8" />
    <path d={`M 0 ${-height / 2 + 34} V ${height / 2 - 34}`} stroke="#f8fafc" strokeWidth="3" strokeDasharray="12 14" opacity="0.75" />
    <rect x={-width / 2 + 30} y={-height / 2 + 24} width="84" height="48" fill="#fef3c7" stroke="#0f172a" strokeWidth="4" />
    <path d={`M ${-width / 2 + 22} ${-height / 2 + 24} L ${-width / 2 + 72} ${-height / 2 - 4} L ${-width / 2 + 122} ${-height / 2 + 24} Z`} fill="#ef4444" stroke="#0f172a" strokeWidth="4" />
    <rect x={width / 2 - 118} y={-height / 2 + 26} width="78" height="44" fill="#dbeafe" stroke="#0f172a" strokeWidth="4" />
    <path d={`M ${width / 2 - 126} ${-height / 2 + 26} L ${width / 2 - 78} ${-height / 2} L ${width / 2 - 32} ${-height / 2 + 26} Z`} fill={stroke} stroke="#0f172a" strokeWidth="4" />
    {[-1, 0, 1].map((slot) => <rect key={slot} x={-42 + slot * 32} y={height / 2 - 58} width="22" height="42" fill="#cbd5e1" stroke="#64748b" strokeWidth="3" transform={`rotate(12 ${-31 + slot * 32} ${height / 2 - 37})`} />)}
    {label.includes("PARK") || label.includes("CIVIC") ? (
      <g>
        <circle cx="0" cy="0" r="42" fill="#bbf7d0" stroke="#15803d" strokeWidth="5" />
        <circle cx="0" cy="0" r="20" fill="#38bdf8" stroke="#075985" strokeWidth="4" />
        <path d="M-18 -4Q0 -28 18 -4M-12 8Q0 30 12 8" fill="none" stroke="#e0f2fe" strokeWidth="4" />
      </g>
    ) : (
      <g>
        <rect x="-52" y="-36" width="104" height="72" fill="rgba(248,250,252,0.38)" stroke={stroke} strokeWidth="4" />
        <text x="0" y="6" textAnchor="middle" fill="#0f172a" fontFamily="monospace" fontSize="18" fontWeight="950" letterSpacing="2">{label}</text>
      </g>
    )}
  </g>
);

const WorldCivilizationLayer = ({ zone, dense, animated }: { zone: WorldZoneTheme; dense: boolean; animated: boolean }) => {
  const npc = (kind: WorldNpcKind, x: number, y: number, color: string, path?: string, begin?: string) => (
    <WorldNpc key={`${zone}-${kind}-${x}-${y}`} kind={kind} x={x} y={y} color={color} path={path} begin={begin} animated={animated && dense} />
  );
  const lots: Record<WorldZoneTheme, React.ReactNode[]> = {
    memory: [
      <WorldDistrictLot key="memory-stack-yard" x={1660} y={1640} width={460} height={190} fill="rgba(220,252,231,0.52)" stroke="#15803d" label="STACKS" rotate={-8} />,
      <WorldDistrictLot key="memory-index-village" x={2180} y={2180} width={360} height={150} fill="rgba(254,243,199,0.54)" stroke="#a16207" label="INDEX" rotate={10} />,
      npc("porter", 1380, 1540, "#92400e", "M1380 1540 L1660 1640 L2180 2180", "0s"),
      npc("walker", 2020, 1320, "#2563eb", "M2020 1320 L1780 1420 L1540 1260", "2s"),
    ],
    agents: [
      <WorldDistrictLot key="agent-market" x={4550} y={1840} width={520} height={210} fill="rgba(254,240,138,0.48)" stroke="#ca8a04" label="AGENT MKT" rotate={6} />,
      <WorldDistrictLot key="agent-courtyard" x={3800} y={1260} width={330} height={150} fill="rgba(240,253,244,0.5)" stroke="#16a34a" label="PLAZA" rotate={-5} />,
      npc("vendor", 4380, 1760, "#16a34a", "M4380 1760 L4550 1840 L4840 1720", "1s"),
      npc("walker", 3720, 1320, "#eab308", "M3720 1320 L4080 1390 L4520 1700", "3s"),
    ],
    external: [
      <WorldDistrictLot key="external-port" x={1120} y={4620} width={520} height={190} fill="rgba(186,230,253,0.48)" stroke="#0369a1" label="PORT" rotate={-12} />,
      <WorldDistrictLot key="external-customs" x={1560} y={3740} width={330} height={140} fill="rgba(226,232,240,0.5)" stroke="#475569" label="GATE" rotate={8} />,
      npc("boat", 760, 4380, "#0ea5e9", "M760 4380 L1120 4620 L1540 5200", "0s"),
      npc("porter", 1420, 4660, "#92400e", "M1420 4660 L1120 4620 L1560 3740", "2s"),
    ],
    core: [
      <WorldDistrictLot key="core-civic-square" x={3000} y={4880} width={640} height={210} fill="rgba(254,243,199,0.54)" stroke="#ca8a04" label="CIVIC BUS" />,
      <WorldDistrictLot key="core-quiet-park" x={2460} y={3720} width={330} height={140} fill="rgba(187,247,208,0.5)" stroke="#15803d" label="PARK" rotate={-12} />,
      npc("walker", 2620, 4240, "#2563eb", "M2620 4240 L3000 4880 L3420 5350", "0s"),
      npc("guard", 3600, 4460, "#ef4444", "M3600 4460 L3780 4500 L3620 5180", "2s"),
    ],
    model: [
      <WorldDistrictLot key="model-campus" x={4880} y={4180} width={540} height={190} fill="rgba(236,254,255,0.56)" stroke="#0891b2" label="RESEARCH" rotate={8} />,
      <WorldDistrictLot key="model-deadland" x={5200} y={5180} width={420} height={170} fill="rgba(203,213,225,0.52)" stroke="#64748b" label="DEADLAND" rotate={-6} />,
      npc("worker", 4680, 4050, "#06b6d4", "M4680 4050 L4880 4180 L5350 4380", "1s"),
      npc("walker", 5320, 5120, "#64748b", "M5320 5120 L5200 5180 L4430 5300", "4s"),
    ],
    apps: [
      <WorldDistrictLot key="apps-main-street" x={1560} y={7480} width={720} height={190} fill="rgba(243,232,255,0.54)" stroke="#7c3aed" label="MAIN ST" rotate={10} />,
      <WorldDistrictLot key="apps-shops" x={1100} y={8060} width={430} height={170} fill="rgba(254,243,199,0.55)" stroke="#a16207" label="SHOPS" rotate={-8} />,
      npc("vendor", 1220, 7680, "#22c55e", "M1220 7680 L1560 7480 L2070 8060", "0s"),
      npc("walker", 1880, 8160, "#a855f7", "M1880 8160 L1560 7480 L1020 7040", "2s"),
    ],
    automation: [
      <WorldDistrictLot key="automation-industrial" x={4430} y={7420} width={760} height={230} fill="rgba(254,215,170,0.5)" stroke="#c2410c" label="INDUSTRY" rotate={5} />,
      <WorldDistrictLot key="automation-depot" x={5200} y={8280} width={430} height={160} fill="rgba(226,232,240,0.5)" stroke="#475569" label="DEPOT" rotate={-5} />,
      npc("worker", 4100, 7220, "#f97316", "M4100 7220 L4430 7420 L4980 7580", "0s"),
      npc("porter", 5200, 8280, "#92400e", "M5200 8280 L4980 7580 L3890 6840", "3s"),
    ],
    security: [
      <WorldDistrictLot key="security-barracks" x={1160} y={7060} width={520} height={180} fill="rgba(254,226,226,0.52)" stroke="#dc2626" label="BARRACKS" rotate={8} />,
      <WorldDistrictLot key="security-checkpoint" x={1560} y={8200} width={360} height={150} fill="rgba(226,232,240,0.52)" stroke="#475569" label="CHECK" rotate={-5} />,
      npc("guard", 980, 6900, "#ef4444", "M980 6900 L1160 7060 L1560 8200", "0s"),
      npc("worker", 1480, 7640, "#f97316", "M1480 7640 L1450 7080 L780 6500", "2s"),
    ],
  };

  return (
    <g opacity={dense ? 0.92 : 0.18} pointerEvents="none">
      {lots[zone]}
    </g>
  );
};

const worldSettlements = (zone: WorldZoneTheme, dense: boolean) => {
  const mini = (kind: WorldMiniKind, x: number, y: number, scale = 1, flip = false) => (
    <g key={`${zone}-${kind}-${x}-${y}`}>
      <WorldMiniBuilding kind={kind} x={x} y={y} scale={scale} flip={flip} />
    </g>
  );
  const common = {
    memory: [mini("archive", 1540, 1260, 0.92), mini("archive", 1780, 1420, 0.78), mini("hut", 1320, 1960, 0.72), mini("tower", 2240, 930, 0.72)],
    agents: [mini("agent", 4080, 1390, 0.92), mini("hut", 4520, 1700, 0.76), mini("watch", 5050, 1250, 0.7), mini("agent", 3500, 2140, 0.72)],
    external: [mini("dock", 620, 4200, 0.85), mini("dock", 1540, 5200, 0.72, true), mini("watch", 1040, 3600, 0.64), mini("hut", 1840, 4580, 0.64)],
    core: [mini("villa", 2600, 4040, 0.82), mini("tower", 3600, 4420, 0.78), mini("hut", 2520, 5320, 0.68), mini("villa", 3420, 5350, 0.68)],
    model: [mini("lab", 4680, 3820, 0.9), mini("lab", 5350, 4380, 0.72), mini("tower", 4430, 5300, 0.64), mini("hut", 5100, 5100, 0.62)],
    apps: [mini("villa", 1020, 7040, 0.82), mini("villa", 1350, 7160, 0.7), mini("archive", 1750, 7420, 0.7), mini("hut", 2070, 8060, 0.64)],
    automation: [mini("factory", 3890, 6840, 0.9), mini("factory", 4980, 7580, 0.76), mini("watch", 5150, 6660, 0.66), mini("hut", 4380, 8360, 0.62)],
    security: [mini("watch", 780, 6500, 0.84), mini("watch", 1450, 7080, 0.74), mini("hut", 1040, 7920, 0.66), mini("tower", 1680, 8220, 0.62)],
  } satisfies Record<WorldZoneTheme, React.ReactNode[]>;
  const extra = dense ? {
    memory: [mini("hut", 1150, 1440, 0.58), mini("archive", 2420, 1600, 0.58)],
    agents: [mini("agent", 4760, 2200, 0.58), mini("hut", 5200, 1780, 0.56)],
    external: [mini("dock", 860, 5000, 0.56), mini("hut", 1370, 3380, 0.54)],
    core: [mini("villa", 2240, 4620, 0.58), mini("tower", 3800, 4920, 0.56)],
    model: [mini("lab", 4240, 4600, 0.56), mini("watch", 5480, 5050, 0.54)],
    apps: [mini("hut", 760, 7860, 0.55), mini("villa", 2320, 6950, 0.56)],
    automation: [mini("factory", 3500, 7600, 0.56), mini("factory", 5400, 8200, 0.54)],
    security: [mini("watch", 620, 8300, 0.54), mini("hut", 1710, 6350, 0.52)],
  } satisfies Record<WorldZoneTheme, React.ReactNode[]> : undefined;
  return (
    <g opacity={dense ? 1 : 0.72}>
      {common[zone]}
      {extra?.[zone]}
    </g>
  );
};

const worldHabitat = (zone: WorldZoneTheme) => {
  const lake = (key: string, x: number, y: number, width: number, height: number) => (
    <g key={key} transform={`translate(${x} ${y})`} shapeRendering="crispEdges">
      <path d={`M0 ${height * 0.4} C${width * 0.16} ${height * 0.05} ${width * 0.36} -${height * 0.12} ${width * 0.58} ${height * 0.1} C${width * 0.88} -${height * 0.02} ${width * 1.04} ${height * 0.35} ${width * 0.9} ${height * 0.66} C${width * 0.72} ${height * 1.04} ${width * 0.22} ${height * 1.02} 0 ${height * 0.4} Z`} fill="#38bdf8" stroke="#075985" strokeWidth="8" />
      <path d={`M${width * 0.18} ${height * 0.42} C${width * 0.38} ${height * 0.26} ${width * 0.58} ${height * 0.58} ${width * 0.82} ${height * 0.44}`} stroke="#e0f2fe" strokeWidth="6" strokeDasharray="24 22" fill="none" opacity="0.9" />
      <path d={`M${width * 0.26} ${height * 0.65} C${width * 0.42} ${height * 0.76} ${width * 0.62} ${height * 0.76} ${width * 0.74} ${height * 0.62}`} stroke="#bae6fd" strokeWidth="4" fill="none" opacity="0.72" />
    </g>
  );
  const river = (key: string, d: string) => (
    <g key={key} shapeRendering="crispEdges">
      <path d={d} fill="none" stroke="#075985" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#38bdf8" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="#e0f2fe" strokeWidth="6" strokeLinecap="butt" strokeLinejoin="round" strokeDasharray="20 28" opacity="0.85" />
    </g>
  );
  const forest = (key: string, points: Array<{ x: number; y: number }>) => (
    <g key={key}>
      {points.map((point, index) => worldDecoration("tree", point.x, point.y + (index % 2) * 18))}
    </g>
  );
  const terrainPatch = (key: string, d: string, fill: string, stroke: string, opacity = 0.72) => (
    <path key={key} d={d} fill={fill} stroke={stroke} strokeWidth="7" strokeLinejoin="round" opacity={opacity} />
  );
  const tiles = (key: string, items: Array<{ kind: StrategyTileKind; x: number; y: number; s?: number }>) => (
    <g key={key}>
      {items.map((item, index) => <WorldStrategyTile key={`${key}-${index}`} kind={item.kind} x={item.x} y={item.y} scale={item.s || 1} />)}
    </g>
  );
  const beach = (key: string, d: string) => (
    <g key={key} shapeRendering="geometricPrecision">
      <path d={d} fill="none" stroke="#f2c978" strokeWidth="96" strokeLinecap="round" strokeLinejoin="round" opacity="0.34" />
      <path d={d} fill="none" stroke="#ffe8aa" strokeWidth="72" strokeLinecap="round" strokeLinejoin="round" opacity="0.72" />
      <path d={d} fill="none" stroke="#fff7c2" strokeWidth="38" strokeLinecap="round" strokeLinejoin="round" opacity="0.88" />
      <path d={d} fill="none" stroke="#fef3c7" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 42" opacity="0.66" />
      <path d={d} fill="none" stroke="#38bdf8" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="16 32" opacity="0.18" />
    </g>
  );
  const shore = (key: string, d: string) => (
    <g key={key} shapeRendering="geometricPrecision">
      <path d={d} fill="none" stroke="#075985" strokeWidth="86" strokeLinecap="round" strokeLinejoin="round" opacity="0.11" />
      <path d={d} fill="none" stroke="#f2c978" strokeWidth="70" strokeLinecap="round" strokeLinejoin="round" opacity="0.28" />
      <path d={d} fill="none" stroke="#fff0b6" strokeWidth="48" strokeLinecap="round" strokeLinejoin="round" opacity="0.58" />
      <path d={d} fill="none" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 34" opacity="0.62" />
      <path d={d} fill="none" stroke="#0ea5e9" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="18 46" opacity="0.18" />
    </g>
  );
  const mountains = (key: string, peaks: Array<{ x: number; y: number; s?: number }>) => (
    <g key={key} shapeRendering="crispEdges">
      <path
        d={peaks.map((peak, index) => `${index === 0 ? "M" : "L"} ${peak.x} ${peak.y + 52 * (peak.s || 1)}`).join(" ")}
        fill="none"
        stroke="#78716c"
        strokeWidth="24"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.24"
      />
      {peaks.map((peak, index) => {
        const s = peak.s || 1;
        return (
          <g key={`${key}-${index}`} transform={`translate(${peak.x} ${peak.y}) scale(${s})`}>
            <path d="M-42 46L0 -42L42 46Z" fill="#a8a29e" stroke="#57534e" strokeWidth="5" />
            <path d="M0 -42L17 -6H-12Z" fill="#f8fafc" stroke="#e5e7eb" strokeWidth="3" />
            <rect x="-18" y="24" width="36" height="10" fill="#78716c" opacity="0.45" />
          </g>
        );
      })}
    </g>
  );
  const hills = (key: string, bumps: Array<{ x: number; y: number; s?: number }>) => (
    <g key={key} shapeRendering="crispEdges">
      {bumps.map((bump, index) => {
        const s = bump.s || 1;
        return (
          <g key={`${key}-${index}`} transform={`translate(${bump.x} ${bump.y}) scale(${s})`}>
            <path d="M-58 36C-42 -20 34 -24 58 36Z" fill="#6fbf52" stroke="#2f7d32" strokeWidth="5" />
            <path d="M-34 28C-20 0 20 -2 34 28Z" fill="#86d05f" opacity="0.76" />
            <rect x="-10" y="-2" width="8" height="14" fill="#2f7d32" opacity="0.35" />
            <rect x="12" y="6" width="8" height="12" fill="#2f7d32" opacity="0.28" />
          </g>
        );
      })}
    </g>
  );
  const crops = (key: string, x: number, y: number, width: number, height: number, rotate = 0) => (
    <g key={key} transform={`translate(${x} ${y}) rotate(${rotate})`} shapeRendering="crispEdges" opacity="0.88">
      <rect x={-width / 2} y={-height / 2} width={width} height={height} fill="#a3be4f" stroke="#6b7f2a" strokeWidth="5" />
      {Array.from({ length: 5 }).map((_, index) => (
        <path key={index} d={`M ${-width / 2 + 15 + index * (width / 5)} ${-height / 2 + 8} V ${height / 2 - 8}`} stroke="#fef3c7" strokeWidth="5" strokeDasharray="10 12" />
      ))}
      {Array.from({ length: 3 }).map((_, index) => (
        <path key={`h-${index}`} d={`M ${-width / 2 + 10} ${-height / 2 + 18 + index * (height / 3)} H ${width / 2 - 10}`} stroke="#647c22" strokeWidth="3" opacity="0.35" />
      ))}
    </g>
  );
  const coastalRocks = (key: string, rocks: Array<{ x: number; y: number; s?: number }>) => (
    <g key={key}>{rocks.map((rock, index) => worldDecoration("rock", rock.x, rock.y))}</g>
  );
  const bridge = (key: string, x: number, y: number, rotate = 0) => (
    <g key={key} transform={`translate(${x} ${y}) rotate(${rotate})`} shapeRendering="crispEdges">
      <rect x="-70" y="-16" width="140" height="32" fill="#92400e" stroke="#451a03" strokeWidth="5" />
      {[-48, -24, 0, 24, 48].map((offset) => <rect key={offset} x={offset - 5} y="-18" width="10" height="36" fill="#fcd34d" opacity="0.7" />)}
    </g>
  );

  switch (zone) {
    case "memory":
      return (
        <g>
          {terrainPatch("memory-meadow", "M980 940 C1320 760 1780 760 2140 980 C1960 1200 1360 1240 980 940 Z", "#9bd978", "#4d9f45", 0.5)}
          {tiles("memory-strategy-tiles", [
            { kind: "forest", x: 1200, y: 1110, s: 0.72 },
            { kind: "forest", x: 1430, y: 1000, s: 0.68 },
            { kind: "crop", x: 1210, y: 1580, s: 0.82 },
            { kind: "lake", x: 2000, y: 1840, s: 0.72 },
            { kind: "ruin", x: 2320, y: 2060, s: 0.58 },
          ])}
          {shore("memory-north-coast", "M760 1320 C1040 910 1540 720 2150 690")}
          {shore("memory-south-coast", "M920 2240 C1270 2470 1810 2600 2240 2460")}
          {beach("memory-west-beach", "M700 1500 C650 1780 710 2020 920 2240")}
          {river("memory-river", "M2360 720 C2220 1020 2300 1340 2060 1660 C1820 1980 1890 2270 1640 2520")}
          {forest("memory-forest", [{ x: 1320, y: 1080 }, { x: 1510, y: 980 }, { x: 1710, y: 1140 }, { x: 1980, y: 1240 }])}
          {hills("memory-hills", [{ x: 1120, y: 1880, s: 1.2 }, { x: 1320, y: 2020, s: 0.9 }, { x: 1560, y: 2070, s: 0.85 }, { x: 2420, y: 1880, s: 0.75 }])}
          {crops("memory-crops", 1200, 1580, 330, 170, -12)}
          {coastalRocks("memory-coast-rocks", [{ x: 760, y: 2040 }, { x: 2520, y: 2300 }])}
          {lake("memory-lake", 1980, 1840, 230, 130)}
        </g>
      );
    case "agents":
      return (
        <g>
          {terrainPatch("agent-savanna", "M3350 1120 C3820 900 4700 940 5200 1220 C4960 1620 3940 1580 3350 1120 Z", "#c5d873", "#87943a", 0.46)}
          {tiles("agent-strategy-tiles", [
            { kind: "grass", x: 3550, y: 1240, s: 0.72 },
            { kind: "forest", x: 4610, y: 1180, s: 0.62 },
            { kind: "crop", x: 4450, y: 2030, s: 0.82 },
            { kind: "lake", x: 4050, y: 2050, s: 0.66 },
            { kind: "ruin", x: 5100, y: 1860, s: 0.55 },
          ])}
          {shore("agent-north-beach", "M3240 930 C3800 760 4700 760 5200 880")}
          {shore("agent-east-beach", "M5400 1360 C5580 1640 5420 1960 5040 2360")}
          {beach("agent-south-cove", "M3920 2580 C4280 2720 4680 2660 5020 2360")}
          {forest("agent-palms", [{ x: 4620, y: 1180 }, { x: 4950, y: 1480 }, { x: 3550, y: 1840 }])}
          {crops("agent-plains", 4440, 2030, 380, 160, 8)}
          {hills("agent-hills", [{ x: 3600, y: 1160, s: 0.8 }, { x: 3820, y: 1240, s: 0.64 }, { x: 5120, y: 1900, s: 0.7 }])}
          {lake("agent-pond", 4050, 2050, 210, 110)}
        </g>
      );
    case "external":
      return (
        <g>
          {terrainPatch("external-bay-wetland", "M520 3600 C900 3340 1420 3460 1800 3860 C1560 4240 840 4180 520 3600 Z", "#8fd3a4", "#2f7d57", 0.46)}
          {tiles("external-strategy-tiles", [
            { kind: "port", x: 700, y: 4540, s: 0.8 },
            { kind: "lake", x: 1020, y: 3860, s: 0.68 },
            { kind: "forest", x: 1350, y: 3460, s: 0.62 },
            { kind: "ruin", x: 1680, y: 5140, s: 0.58 },
          ])}
          {shore("external-west-coast", "M360 3500 C260 4200 310 5000 500 5350")}
          {shore("external-east-coast", "M1840 3350 C2220 3860 2180 4570 1840 5200")}
          {beach("external-south-beach", "M580 5360 C920 5620 1320 5660 1660 5480")}
          {bridge("external-dock", 690, 4550, -16)}
          {bridge("external-pier", 1480, 5360, 8)}
          {worldDecoration("wave", 980, 3820)}
          {worldDecoration("wave", 1720, 4480)}
          {worldDecoration("rock", 520, 5070)}
          {coastalRocks("external-rocks", [{ x: 420, y: 3380 }, { x: 1960, y: 3700 }, { x: 1720, y: 5460 }])}
          {hills("external-isle-hills", [{ x: 980, y: 3440, s: 0.75 }, { x: 1480, y: 3960, s: 0.68 }])}
        </g>
      );
    case "core":
      return (
        <g>
          {terrainPatch("core-inner-parkland", "M2300 3520 C2700 3260 3380 3290 3820 3660 C3640 4000 2640 4000 2300 3520 Z", "#9edf7a", "#409b3e", 0.5)}
          {tiles("core-strategy-tiles", [
            { kind: "lake", x: 3000, y: 4300, s: 0.9 },
            { kind: "forest", x: 2460, y: 3720, s: 0.72 },
            { kind: "crop", x: 3300, y: 5580, s: 0.78 },
            { kind: "ruin", x: 3660, y: 5000, s: 0.6 },
          ])}
          {shore("core-west-beach", "M2100 3520 C1960 4100 1960 4960 2280 5600")}
          {shore("core-east-beach", "M3800 3460 C4080 4060 4100 4880 3600 5740")}
          {beach("core-south-beach", "M2500 5920 C2860 6060 3280 6060 3560 5800")}
          {lake("core-moat", 2730, 4200, 560, 220)}
          {river("core-river", "M3380 3300 C3220 3720 3320 4240 3000 4520 C2700 4780 2840 5360 2540 5900")}
          {bridge("core-bridge", 3000, 4450, 90)}
          {forest("core-grove", [{ x: 2450, y: 3600 }, { x: 3670, y: 3700 }, { x: 2350, y: 5350 }, { x: 3570, y: 5380 }])}
          {hills("core-hills", [{ x: 2320, y: 4200, s: 0.82 }, { x: 3690, y: 4980, s: 0.8 }])}
          {crops("core-fields", 3280, 5600, 360, 160, 12)}
        </g>
      );
    case "model":
      return (
        <g>
          {terrainPatch("model-frozen-plain", "M4200 3440 C4700 3260 5420 3460 5680 3940 C5240 4140 4620 3980 4200 3440 Z", "#e2f4ef", "#8bb9c3", 0.58)}
          {tiles("model-strategy-tiles", [
            { kind: "snow", x: 4260, y: 3500, s: 0.72 },
            { kind: "mountain", x: 4540, y: 3650, s: 0.72 },
            { kind: "mountain", x: 4920, y: 3940, s: 0.66 },
            { kind: "lake", x: 4480, y: 5080, s: 0.7 },
            { kind: "ruin", x: 5400, y: 4320, s: 0.56 },
          ])}
          {shore("model-ice-shore", "M4150 3330 C4860 3180 5520 3400 5740 3820")}
          {mountains("model-mountains", [{ x: 4320, y: 3520, s: 0.82 }, { x: 4520, y: 3650, s: 1.1 }, { x: 4740, y: 3790, s: 0.9 }, { x: 4900, y: 3920, s: 0.9 }, { x: 5230, y: 4280, s: 0.78 }, { x: 5420, y: 5000, s: 0.72 }])}
          {worldDecoration("rock", 4520, 3650)}
          {worldDecoration("rock", 4900, 3920)}
          {worldDecoration("rock", 5200, 4300)}
          {lake("model-glacier", 4450, 5080, 340, 150)}
        </g>
      );
    case "apps":
      return (
        <g>
          {terrainPatch("apps-village-green", "M740 6700 C1220 6400 1980 6460 2440 6940 C2160 7320 1180 7320 740 6700 Z", "#91d56d", "#3b8f3b", 0.5)}
          {tiles("apps-strategy-tiles", [
            { kind: "forest", x: 860, y: 6820, s: 0.66 },
            { kind: "grass", x: 1220, y: 7040, s: 0.72 },
            { kind: "crop", x: 1880, y: 8120, s: 0.72 },
            { kind: "lake", x: 1200, y: 7920, s: 0.68 },
            { kind: "port", x: 2140, y: 8420, s: 0.62 },
          ])}
          {shore("apps-west-beach", "M600 6800 C510 7420 560 8150 780 8440")}
          {shore("apps-south-coast", "M720 8380 C1100 8580 1700 8620 2150 8460")}
          {beach("apps-east-cove", "M2180 6280 C2600 6620 2800 7040 2760 7420")}
          {forest("apps-village-woods", [{ x: 850, y: 6820 }, { x: 1150, y: 6950 }, { x: 1550, y: 6660 }, { x: 2020, y: 7040 }])}
          {lake("apps-pond", 1200, 7920, 260, 150)}
          {crops("apps-crops", 1880, 8120, 320, 150, -10)}
          {hills("apps-hills", [{ x: 2330, y: 6680, s: 0.7 }, { x: 940, y: 7480, s: 0.78 }])}
        </g>
      );
    case "automation":
      return (
        <g>
          {terrainPatch("automation-dry-basin", "M3300 6420 C3900 6140 5120 6320 5480 6940 C5000 7240 3840 7200 3300 6420 Z", "#d2a464", "#8b5a22", 0.5)}
          {tiles("automation-strategy-tiles", [
            { kind: "desert", x: 3480, y: 6640, s: 0.76 },
            { kind: "mountain", x: 3720, y: 6820, s: 0.62 },
            { kind: "crop", x: 4380, y: 6500, s: 0.72 },
            { kind: "ruin", x: 5050, y: 7460, s: 0.58 },
            { kind: "mountain", x: 4960, y: 8140, s: 0.66 },
          ])}
          {shore("automation-south-shore", "M3650 8460 C4180 8680 5150 8660 5520 8460")}
          {beach("automation-west-cove", "M3060 6660 C2880 7220 3140 7800 3650 8460")}
          {mountains("automation-quarry", [{ x: 3480, y: 6640, s: 0.8 }, { x: 3720, y: 6820, s: 0.62 }, { x: 4960, y: 8140, s: 0.72 }, { x: 5200, y: 7000, s: 0.6 }])}
          {river("automation-canal", "M3550 6400 C3950 6740 3780 7160 4240 7480 C4700 7800 5050 8070 5450 8540")}
          {crops("automation-yard", 4380, 6500, 420, 150, 4)}
          {worldDecoration("pipe", 4050, 6750)}
          {worldDecoration("pipe", 5050, 7460)}
          {worldDecoration("rock", 4560, 8260)}
        </g>
      );
    case "security":
      return (
        <g>
          {terrainPatch("security-badlands", "M520 6220 C960 5920 1560 6080 1840 6620 C1420 7000 840 6880 520 6220 Z", "#a6bd78", "#6f7f43", 0.48)}
          {tiles("security-strategy-tiles", [
            { kind: "mountain", x: 740, y: 6460, s: 0.62 },
            { kind: "mountain", x: 1180, y: 6820, s: 0.68 },
            { kind: "forest", x: 900, y: 8020, s: 0.62 },
            { kind: "ruin", x: 1560, y: 8240, s: 0.56 },
          ])}
          {shore("security-north-shore", "M500 6040 C900 5840 1420 5900 1720 6160")}
          {beach("security-west-cove", "M420 6400 C320 7080 340 7920 620 8420")}
          {mountains("security-rockline", [{ x: 740, y: 6460, s: 0.7 }, { x: 960, y: 6640, s: 0.62 }, { x: 1180, y: 6820, s: 0.78 }, { x: 1580, y: 7380, s: 0.72 }])}
          {hills("security-hills", [{ x: 900, y: 8020, s: 0.7 }, { x: 1560, y: 8240, s: 0.62 }])}
          {worldDecoration("rock", 830, 6350)}
          {worldDecoration("rock", 1240, 6880)}
          {worldDecoration("rock", 1620, 7420)}
        </g>
      );
    default:
      return null;
  }
};

const worldDecoration = (kind: "tree" | "rock" | "cloud" | "pipe" | "wave", x: number, y: number) => {
  if (kind === "tree") {
    return (
      <g key={`${kind}-${x}-${y}`} transform={`translate(${x} ${y}) scale(1.55)`} opacity="0.94" shapeRendering="geometricPrecision">
        <ellipse cx="0" cy="36" rx="34" ry="8" fill="rgba(15,23,42,0.14)" />
        <path d="M-7 6C-5 20 -6 30 -10 42H12C7 28 7 17 9 6Z" fill="#8b5a2b" stroke="#4a2b12" strokeWidth="3" />
        <circle cx="-22" cy="-12" r="24" fill="#16a34a" stroke="#14532d" strokeWidth="3" />
        <circle cx="2" cy="-28" r="27" fill="#65d96f" stroke="#14532d" strokeWidth="3" />
        <circle cx="24" cy="-7" r="24" fill="#22c55e" stroke="#14532d" strokeWidth="3" />
        <circle cx="-2" cy="-5" r="25" fill="#4ade80" opacity="0.9" />
        <path d="M-22 -20C-14 -30 -5 -34 8 -34M12 -14C24 -20 31 -14 36 -6" fill="none" stroke="#bbf7d0" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
      </g>
    );
  }
  if (kind === "rock") {
    return (
      <g key={`${kind}-${x}-${y}`} transform={`translate(${x} ${y}) scale(1.35)`} opacity="0.86" shapeRendering="geometricPrecision">
        <ellipse cx="0" cy="27" rx="40" ry="8" fill="rgba(15,23,42,0.13)" />
        <path d="M-40 24L-18 -14L8 -28L38 20L24 34H-28Z" fill="#94a3b8" stroke="#475569" strokeWidth="5" strokeLinejoin="round" />
        <path d="M-18 -14L0 24L8 -28" fill="none" stroke="#64748b" strokeWidth="4" opacity="0.7" />
        <path d="M8 -28L20 2L38 20" fill="none" stroke="#e2e8f0" strokeWidth="4" opacity="0.68" />
      </g>
    );
  }
  if (kind === "pipe") {
    return (
      <g key={`${kind}-${x}-${y}`} transform={`translate(${x} ${y}) scale(1.55)`} shapeRendering="crispEdges">
        <rect x="-24" y="-18" width="48" height="20" fill="#16a34a" stroke="#14532d" strokeWidth="4" />
        <rect x="-16" y="0" width="32" height="42" fill="#22c55e" stroke="#14532d" strokeWidth="4" />
        <rect x="-9" y="7" width="8" height="28" fill="#86efac" opacity="0.55" />
      </g>
    );
  }
  if (kind === "wave") {
    return (
      <g key={`${kind}-${x}-${y}`} transform={`translate(${x} ${y}) scale(1.35)`} opacity="0.78" shapeRendering="geometricPrecision">
        <path d="M-56 8Q-40 -8 -24 8T8 8T40 8T72 8" fill="none" stroke="#e0f2fe" strokeWidth="8" strokeLinecap="round" />
        <path d="M-42 28Q-26 14 -10 28T22 28T54 28" fill="none" stroke="#bae6fd" strokeWidth="5" strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g key={`${kind}-${x}-${y}`} transform={`translate(${x} ${y}) scale(1.45)`} opacity="0.86" shapeRendering="crispEdges">
      <rect x="-54" y="-6" width="44" height="18" fill="#ffffff" />
      <rect x="-34" y="-20" width="56" height="24" fill="#ffffff" />
      <rect x="10" y="-10" width="56" height="20" fill="#ffffff" />
      <rect x="44" y="0" width="34" height="14" fill="#ffffff" />
    </g>
  );
};

type WorldVehicleKind = "car" | "van" | "bus" | "bike" | "rail" | "ship" | "sailboat" | "rocket" | "drone" | "scanner";

const worldVehicleKindForTrain = (train: EMapTrain): WorldVehicleKind => {
  const key = `${train.id} ${train.trainType} ${train.payloadType || ""} ${train.agentIds.join(" ")}`.toLowerCase();
  if (key.includes("model") || train.payloadType === "model_call" || train.trainType === "shinkansen") return "rocket";
  if (key.includes("server") || key.includes("external") || key.includes("relay")) return "ship";
  if (key.includes("memory") || key.includes("archive") || train.payloadType === "memory") return "sailboat";
  if (key.includes("malware") || key.includes("security") || key.includes("scan")) return "scanner";
  if (key.includes("news") || key.includes("moltbook") || key.includes("post")) return "bike";
  if (key.includes("transport") || key.includes("dropbox") || train.trainType === "cargo") return "bus";
  if (key.includes("builder") || key.includes("deploy") || key.includes("automation")) return "van";
  if (train.payloadType === "monitoring") return "drone";
  return "car";
};

const WorldVehicle = ({ train }: { train: EMapTrain }) => {
  const color = trainStatusColor(train);
  const label = trainAgentTag(train);
  const isBad = trainIsError(train);
  const isWaiting = trainIsWaitingPlanning(train);
  const kind = worldVehicleKindForTrain(train);
  const stroke = isBad ? "#7f1d1d" : "#111827";
  const badgeFill = isBad ? "#ef4444" : isWaiting ? "#facc15" : "#fff7ed";
  const wheel = (x: number, y = 14, r = 6) => <circle key={`${x}-${y}`} cx={x} cy={y} r={r} fill="#111827" stroke="#f8fafc" strokeWidth="2" />;
  const window = (x: number, y: number, w = 12, h = 8) => <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} fill="#e0f2fe" stroke={stroke} strokeWidth="2" />;
  const bodyStripe = <path d="M-24 1H24" stroke="#fff7ed" strokeWidth="3" opacity="0.8" />;
  return (
    <g className={train.status === "monitoring" ? "animate-pulse" : undefined} shapeRendering="crispEdges">
      {kind === "ship" ? (
        <>
          <path d="M-36 2H36L22 22H-18Z" fill={color} stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" />
          <rect x="-8" y="-18" width="28" height="20" fill="#fff7ed" stroke={stroke} strokeWidth="3" />
          <rect x="18" y="-10" width="14" height="12" fill="#bfdbfe" stroke={stroke} strokeWidth="2" />
          <path d="M-38 26Q-16 12 6 26T50 26" fill="none" stroke="#bae6fd" strokeWidth="5" strokeLinecap="round" />
          <path d="M-48 34Q-25 22 -2 34T44 34" fill="none" stroke="#e0f2fe" strokeWidth="3" strokeLinecap="round" />
        </>
      ) : kind === "sailboat" ? (
        <>
          <path d="M-30 8H30L18 22H-18Z" fill="#92400e" stroke={stroke} strokeWidth="3" strokeLinejoin="round" />
          <path d="M0 -36V8" stroke={stroke} strokeWidth="4" />
          <path d="M2 -34L28 4H2Z" fill={color} stroke={stroke} strokeWidth="3" />
          <path d="M-2 -28L-24 4H-2Z" fill="#f8fafc" stroke={stroke} strokeWidth="3" />
          <path d="M-32 27Q-10 16 12 27T48 27" fill="none" stroke="#bae6fd" strokeWidth="4" strokeLinecap="round" />
        </>
      ) : kind === "rocket" ? (
        <>
          <path d="M-28 -11H13L34 0 13 11h-41z" fill={color} stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" />
          <rect x="-12" y="-6" width="16" height="12" fill="#ecfeff" stroke={stroke} strokeWidth="2" />
          <path d="M-30 -10L-46 0 -30 10Z" fill="#f97316" stroke="#7c2d12" strokeWidth="3" />
          <path d="M-10 -13L-2 -26H12L8 -11" fill="#bae6fd" stroke={stroke} strokeWidth="2.5" />
        </>
      ) : kind === "bus" ? (
        <>
          <rect x="-36" y="-16" width="72" height="30" rx="3" fill={color} stroke={stroke} strokeWidth="3.5" />
          <rect x="-31" y="-11" width="18" height="10" fill="#e0f2fe" stroke={stroke} strokeWidth="2" />
          <rect x="-8" y="-11" width="18" height="10" fill="#e0f2fe" stroke={stroke} strokeWidth="2" />
          <rect x="15" y="-11" width="16" height="10" fill="#e0f2fe" stroke={stroke} strokeWidth="2" />
          {bodyStripe}
          {[wheel(-24), wheel(22)]}
          <rect x="-36" y="4" width="7" height="8" fill="#facc15" />
        </>
      ) : kind === "van" ? (
        <>
          <path d="M-34 13V-12H8L22 0H34V13Z" fill={color} stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" />
          {window(-22, -7, 16, 9)}
          {window(0, -7, 14, 9)}
          <rect x="20" y="2" width="10" height="8" fill="#fef3c7" stroke={stroke} strokeWidth="2" />
          <path d="M-28 2H12" stroke="#f8fafc" strokeWidth="3" opacity="0.75" />
          {[wheel(-22), wheel(22)]}
        </>
      ) : kind === "bike" ? (
        <>
          <circle cx="-20" cy="12" r="12" fill="none" stroke={stroke} strokeWidth="4" />
          <circle cx="22" cy="12" r="12" fill="none" stroke={stroke} strokeWidth="4" />
          <path d="M-20 12L-5 -10L22 12H-2L-20 12M-5 -10L4 12" fill="none" stroke={color} strokeWidth="5" strokeLinejoin="round" />
          <circle cx="-5" cy="-18" r="8" fill={color} stroke={stroke} strokeWidth="3" />
          <path d="M-5 -10L-5 2L8 6" stroke="#111827" strokeWidth="4" strokeLinecap="round" />
        </>
      ) : kind === "rail" ? (
        <>
          <rect x="-36" y="-14" width="72" height="28" rx="4" fill={color} stroke={stroke} strokeWidth="3.5" />
          {[-25, -7, 11].map((x) => window(x, -8, 13, 9))}
          <path d="M-42 20H42M-38 28H38" stroke="#475569" strokeWidth="4" />
          {[-28, -10, 8, 26].map((x) => <rect key={x} x={x - 4} y="14" width="8" height="10" fill="#111827" />)}
        </>
      ) : kind === "scanner" ? (
        <>
          <rect x="-22" y="-16" width="44" height="32" rx="4" fill={color} stroke={stroke} strokeWidth="3.5" />
          <rect x="-8" y="-28" width="16" height="14" fill="#f8fafc" stroke={stroke} strokeWidth="2.5" />
          <circle cx="0" cy="0" r="11" fill="#0f172a" stroke="#f8fafc" strokeWidth="3" />
          <circle cx="0" cy="0" r="5" fill={isBad ? "#ef4444" : "#22c55e"} />
          <path d="M-40 -28Q-68 0 -40 28M40 -28Q68 0 40 28" fill="none" stroke={isBad ? "#ef4444" : "#22c55e"} strokeWidth="4" strokeLinecap="round" opacity="0.72" />
        </>
      ) : kind === "drone" ? (
        <>
          <rect x="-18" y="-12" width="36" height="24" rx="5" fill={color} stroke={stroke} strokeWidth="3.5" />
          {window(-7, -5, 14, 10)}
          {[-34, 34].map((x) => (
            <g key={x}>
              <path d={`M${x < 0 ? -18 : 18} -8L${x} -20M${x < 0 ? -18 : 18} 8L${x} 20`} stroke={stroke} strokeWidth="3" />
              <ellipse cx={x} cy="-20" rx="14" ry="5" fill="#f8fafc" stroke={stroke} strokeWidth="2" />
              <ellipse cx={x} cy="20" rx="14" ry="5" fill="#f8fafc" stroke={stroke} strokeWidth="2" />
            </g>
          ))}
        </>
      ) : (
        <>
          <path d="M-30 12V-6L-16 -18H12L30 -4V12Z" fill={color} stroke={stroke} strokeWidth="3.5" strokeLinejoin="round" />
          {window(-12, -11, 15, 9)}
          {window(8, -7, 12, 7)}
          <path d="M-24 2H22" stroke="#f8fafc" strokeWidth="3" opacity="0.72" />
          {[wheel(-20), wheel(20)]}
        </>
      )}
      <rect x="-20" y="-38" width="40" height="17" rx="3" fill={badgeFill} stroke={stroke} strokeWidth="2.5" />
      <text x="0" y="-26" textAnchor="middle" fill="#111827" fontFamily="monospace" fontSize={label.length > 3 ? "6" : "8"} fontWeight="950">{isBad ? "ERR" : isWaiting ? "WTP" : label}</text>
    </g>
  );
};

const WorldBuilding = ({ kind, station, selected, radius }: { kind: WorldBuildingKind; station: SystemStation; selected: boolean; radius: number }) => {
  const theme = worldZoneColor[stationWorldTheme(station)];
  const tone = statusTone[station.status];
  const scale = Math.max(0.9, Math.min(kind === "brainLibrary" ? 2.35 : kind === "castle" ? 2.15 : 1.9, radius / 36));
  const label = station.iconTag || (station.hub ? station.label.split(/\s+/).map((word) => word[0]).join("").slice(0, 3).toUpperCase() : "");
  const outline = selected ? "#111827" : "#1f2937";
  const status = stationStatusLabel(station).slice(0, 3).toUpperCase();

  const windows = (xs: number[], y: number, fill = "#bae6fd") => xs.map((x) => <rect key={`${x}-${y}`} x={x} y={y} width="16" height="22" fill={fill} stroke="#111827" strokeWidth="3" />);
  const shrubs = (xs: number[], y = 48) => xs.map((x) => (
    <g key={`shrub-${x}-${y}`} transform={`translate(${x} ${y})`}>
      <rect x="-7" y="-8" width="14" height="16" fill="#16a34a" stroke="#14532d" strokeWidth="2" />
      <rect x="-11" y="-2" width="22" height="12" fill="#22c55e" stroke="#14532d" strokeWidth="2" />
      <rect x="-3" y="9" width="6" height="12" fill="#7c2d12" />
    </g>
  ));
  const badge = (x: number, y: number, fill = theme.accent, text = label || "PF") => (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-20" y="-16" width="40" height="30" fill={fill} stroke="#111827" strokeWidth="3" />
      <text x="0" y="4" textAnchor="middle" fill="#111827" fontFamily="monospace" fontSize="11" fontWeight="950">{compact(text, 3)}</text>
    </g>
  );
  const stationSign = (text: string, x: number, y: number, width: number, fill: string, textFill = "#ffffff") => (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-width / 2} y="-18" width={width} height="32" fill={fill} stroke="#111827" strokeWidth="4" />
      <text x="0" y="4" textAnchor="middle" fill={textFill} fontFamily="monospace" fontSize={text.length > 9 ? "12" : "15"} fontWeight="950">{text}</text>
    </g>
  );
  const shadow = <rect x="-112" y="74" width="224" height="18" fill="rgba(15,23,42,0.16)" />;

  let shape: React.ReactNode;
  if (kind === "police") {
    shape = (
      <g shapeRendering="crispEdges">
        {shadow}
        <rect x="-108" y="-6" width="216" height="80" fill="#e5e7eb" stroke={outline} strokeWidth="5" />
        <rect x="-132" y="10" width="44" height="64" fill="#dbeafe" stroke={outline} strokeWidth="5" />
        <rect x="88" y="10" width="44" height="64" fill="#dbeafe" stroke={outline} strokeWidth="5" />
        <rect x="-42" y="-36" width="84" height="110" fill="#2563eb" stroke={outline} strokeWidth="5" />
        {stationSign("POLICE", 0, -48, 106, "#1d4ed8")}
        <rect x="-29" y="-4" width="58" height="34" fill="#bae6fd" stroke={outline} strokeWidth="4" />
        <rect x="-14" y="34" width="28" height="40" fill="#93c5fd" stroke={outline} strokeWidth="4" />
        {windows([-92, -62, 62, 92], 18)}
        {badge(-113, 42, "#facc15", "!")}
        {badge(113, 42, "#facc15", "!")}
        {shrubs([-64, -42, 42, 64], 58)}
      </g>
    );
  } else if (kind === "firehouse") {
    shape = (
      <g shapeRendering="crispEdges">
        {shadow}
        <rect x="-118" y="-18" width="236" height="92" fill="#a84636" stroke={outline} strokeWidth="5" />
        <rect x="-42" y="-54" width="84" height="38" fill="#8f372f" stroke={outline} strokeWidth="5" />
        {stationSign("FIRE", 0, -38, 78, "#fef3c7", "#991b1b")}
        <rect x="-95" y="30" width="52" height="44" fill="#7f1d1d" stroke={outline} strokeWidth="4" />
        <rect x="-26" y="30" width="52" height="44" fill="#7f1d1d" stroke={outline} strokeWidth="4" />
        <rect x="43" y="30" width="52" height="44" fill="#7f1d1d" stroke={outline} strokeWidth="4" />
        <rect x="-85" y="38" width="32" height="18" fill="#e0f2fe" stroke={outline} strokeWidth="3" />
        <rect x="-16" y="38" width="32" height="18" fill="#ef4444" stroke={outline} strokeWidth="3" />
        <rect x="53" y="38" width="32" height="18" fill="#ef4444" stroke={outline} strokeWidth="3" />
        {windows([-92, -54, 54, 92], 0, "#bfdbfe")}
        {badge(0, 8, "#fef3c7", "!")}
        {[-88, -55, -20, 16, 52, 86].map((x) => <rect key={`brick-${x}`} x={x} y="-8" width="16" height="5" fill="#fed7aa" opacity="0.45" />)}
      </g>
    );
  } else if (kind === "brainLibrary") {
    shape = (
      <g shapeRendering="crispEdges">
        {shadow}
        <rect x="-154" y="-10" width="308" height="84" fill="#fef3c7" stroke={outline} strokeWidth="6" />
        <rect x="-132" y="6" width="48" height="68" fill="#fde68a" stroke={outline} strokeWidth="5" />
        <rect x="84" y="6" width="48" height="68" fill="#fde68a" stroke={outline} strokeWidth="5" />
        <path d="M-120 -54Q-62 -86 0 -54V-16Q-58 -40 -120 -16Z" fill="#f8fafc" stroke={outline} strokeWidth="5" />
        <path d="M0 -54Q62 -86 120 -54V-16Q58 -40 0 -16Z" fill="#fff7ed" stroke={outline} strokeWidth="5" />
        <path d="M0 -54V-14" stroke={outline} strokeWidth="4" />
        <path d="M-78 -46Q-42 -58 -12 -43M20 -43Q56 -58 92 -46" fill="none" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" />
        {stationSign("BALOSS LIBRARY", 0, -28, 170, "#1f2937")}
        {[-102, -68, -34, 34, 68, 102].map((x) => <rect key={`library-col-${x}`} x={x - 8} y="4" width="16" height="70" fill="#facc15" stroke={outline} strokeWidth="3" />)}
        <rect x="-24" y="24" width="48" height="50" fill="#78350f" stroke={outline} strokeWidth="4" />
        {windows([-142, -116, 116, 142], 18, "#bfdbfe")}
        {badge(-56, 45, "#fde68a", "AI")}
        {badge(56, 45, "#fde68a", "MAP")}
      </g>
    );
  } else if (kind === "castle") {
    shape = (
      <g shapeRendering="crispEdges">
        {shadow}
        <rect x="-92" y="-20" width="184" height="94" fill="#fde68a" stroke={outline} strokeWidth="6" />
        <rect x="-128" y="4" width="44" height="70" fill="#facc15" stroke={outline} strokeWidth="5" />
        <rect x="84" y="4" width="44" height="70" fill="#facc15" stroke={outline} strokeWidth="5" />
        <path d="M-128 4L-106 -34 -84 4M-72 -20L0 -66 72 -20M84 4L106 -34 128 4" fill="#ef4444" stroke={outline} strokeWidth="5" />
        <rect x="-24" y="26" width="48" height="48" fill="#78350f" stroke={outline} strokeWidth="4" />
        {windows([-58, -28, 28, 58], 0)}
        {stationSign("BALOSS", 0, -28, 92, "#facc15", "#111827")}
      </g>
    );
  } else if (kind === "factory") {
    shape = (
      <g shapeRendering="crispEdges">
        {shadow}
        <path d="M-116 74V-2L-70 24V-2L-22 24V-2L116 38V74Z" fill="#fed7aa" stroke="#7c2d12" strokeWidth="5" />
        <rect x="50" y="-62" width="34" height="78" fill="#fb923c" stroke="#7c2d12" strokeWidth="5" />
        <rect x="78" y="-78" width="34" height="12" fill="#fff7ed" opacity="0.8" />
        <rect x="-82" y="36" width="46" height="38" fill="#c2410c" stroke="#7c2d12" strokeWidth="4" />
        <rect x="-14" y="28" width="48" height="46" fill="#c2410c" stroke="#7c2d12" strokeWidth="4" />
        {windows([52, 86], 38, "#fed7aa")}
        {stationSign("WORKS", -18, 2, 84, "#f97316")}
      </g>
    );
  } else if (kind === "parking") {
    shape = (
      <g shapeRendering="crispEdges">
        {shadow}
        <rect x="-118" y="-18" width="236" height="92" fill="#475569" stroke={outline} strokeWidth="5" />
        <rect x="-38" y="-58" width="76" height="40" fill="#f8fafc" stroke={outline} strokeWidth="5" />
        <text x="0" y="-31" textAnchor="middle" fill="#111827" fontFamily="monospace" fontSize="28" fontWeight="950">P</text>
        <path d="M-94 4H94M-94 32H94M-94 58H94" stroke="#f8fafc" strokeWidth="5" strokeDasharray="18 18" />
        {[-70, -20, 30, 76].map((x) => <rect key={`car-${x}`} x={x - 18} y="12" width="36" height="18" fill={x < 0 ? "#facc15" : "#38bdf8"} stroke="#111827" strokeWidth="3" />)}
      </g>
    );
  } else if (kind === "dock") {
    shape = (
      <g shapeRendering="crispEdges">
        <path d="M-112 66H112" stroke="#92400e" strokeWidth="18" />
        <path d="M-82 22V84M-28 14V84M28 14V84M82 22V84" stroke="#78350f" strokeWidth="9" />
        <path d="M-82 4H40L76 30 42 58H-96Z" fill="#bae6fd" stroke="#075985" strokeWidth="6" />
        <rect x="-32" y="-36" width="64" height="40" fill="#e0f2fe" stroke="#075985" strokeWidth="5" />
        {stationSign("DOCK", 0, -48, 74, "#075985")}
      </g>
    );
  } else if (kind === "modelLab") {
    shape = (
      <g shapeRendering="crispEdges">
        {shadow}
        <rect x="-100" y="-6" width="200" height="80" fill="#ecfeff" stroke={outline} strokeWidth="5" />
        <rect x="-38" y="-58" width="76" height="52" fill="#67e8f9" stroke={outline} strokeWidth="5" />
        <rect x="68" y="-72" width="28" height="72" fill="#94a3b8" stroke={outline} strokeWidth="5" />
        <rect x="91" y="-88" width="34" height="12" fill="#f8fafc" opacity="0.8" />
        {windows([-72, -38, 38, 72], 20, "#cffafe")}
        {stationSign("LAB", 0, -18, 74, "#0891b2")}
      </g>
    );
  } else if (kind === "archiveLibrary") {
    shape = (
      <g shapeRendering="crispEdges">
        {shadow}
        <rect x="-106" y="-12" width="212" height="86" fill="#bbf7d0" stroke="#14532d" strokeWidth="5" />
        <path d="M-118 -12L0 -62 118 -12Z" fill="#22c55e" stroke="#14532d" strokeWidth="5" />
        <rect x="-70" y="8" width="140" height="12" fill="#166534" />
        <rect x="-70" y="32" width="140" height="12" fill="#166534" />
        <rect x="-70" y="56" width="140" height="12" fill="#166534" />
        {stationSign("ARCHIVE", 0, -18, 104, "#14532d")}
      </g>
    );
  } else if (kind === "radio") {
    shape = (
      <g shapeRendering="crispEdges">
        {shadow}
        <rect x="-118" y="-6" width="236" height="80" fill="#fee2e2" stroke={outline} strokeWidth="5" />
        <rect x="-52" y="-42" width="104" height="36" fill="#ef4444" stroke={outline} strokeWidth="5" />
        {stationSign("RADIO", 0, -46, 106, "#111827")}
        <path d="M-108 -6L-82 -48H82L108 -6Z" fill="#fb923c" stroke={outline} strokeWidth="5" />
        <rect x="-92" y="18" width="30" height="30" fill="#bae6fd" stroke={outline} strokeWidth="4" />
        <rect x="-42" y="18" width="30" height="30" fill="#bae6fd" stroke={outline} strokeWidth="4" />
        <rect x="62" y="18" width="30" height="30" fill="#bae6fd" stroke={outline} strokeWidth="4" />
        <rect x="16" y="20" width="30" height="54" fill="#78350f" stroke={outline} strokeWidth="4" />
        <path d="M-22 -36V-116M-58 -78L-22 -116 14 -78" stroke="#111827" strokeWidth="6" fill="none" strokeLinecap="square" strokeLinejoin="miter" />
        <path d="M-78 -96Q-120 -66 -78 -36M36 -96Q78 -66 36 -36" fill="none" stroke="#0f172a" strokeWidth="5" strokeLinecap="round" />
        <path d="M-102 -122Q-172 -66 -102 -10M60 -122Q130 -66 60 -10" fill="none" stroke="#0f172a" strokeWidth="4" strokeLinecap="round" opacity="0.72" />
      </g>
    );
  } else if (kind === "agentGuild" || kind === "newspaper") {
    const title = kind === "newspaper" ? "NEWS" : "AGENT";
    const roof = kind === "newspaper" ? "#0ea5e9" : "#facc15";
    shape = (
      <g shapeRendering="crispEdges">
        {shadow}
        <rect x="-102" y="-8" width="204" height="82" fill="#fef3c7" stroke={outline} strokeWidth="5" />
        <path d="M-112 -8L0 -60 112 -8Z" fill={roof} stroke={outline} strokeWidth="5" />
        {stationSign(title, 0, -20, 100, roof, "#111827")}
        {windows([-68, -34, 34, 68], 18)}
        <rect x="-15" y="36" width="30" height="38" fill="#78350f" stroke={outline} strokeWidth="4" />
      </g>
    );
  } else if (kind === "appVillage") {
    const appSign = station.iconTag || compact(station.label.replace(/\s+hub$/i, ""), 5).toUpperCase();
    shape = (
      <g shapeRendering="crispEdges">
        {shadow}
        <rect x="-104" y="8" width="70" height="66" fill="#f3e8ff" stroke="#581c87" strokeWidth="5" />
        <rect x="-16" y="-10" width="84" height="84" fill="#e9d5ff" stroke="#581c87" strokeWidth="5" />
        <path d="M-112 8L-68 -36 -24 8M-28 -10L26 -58 80 -10" fill="#a855f7" stroke="#581c87" strokeWidth="5" />
        {windows([-88, -54, 8, 42], 28, "#ddd6fe")}
        {stationSign(appSign, 26, -22, Math.max(72, appSign.length * 18), "#7c3aed")}
      </g>
    );
  } else if (kind === "lakehouse") {
    shape = (
      <g shapeRendering="crispEdges">
        <rect x="-112" y="70" width="224" height="24" fill="#7dd3fc" />
        <rect x="-74" y="-6" width="148" height="80" fill="#fed7aa" stroke="#78350f" strokeWidth="5" />
        <path d="M-88 -6L0 -64 88 -6Z" fill="#84cc16" stroke="#365314" strokeWidth="5" />
        {windows([-46, -14, 22], 18, "#bfdbfe")}
        <rect x="46" y="34" width="28" height="40" fill="#78350f" stroke="#111827" strokeWidth="4" />
        {stationSign("LAKE", 0, -20, 80, "#365314")}
      </g>
    );
  } else if (kind === "airport") {
    shape = (
      <g shapeRendering="crispEdges">
        {shadow}
        <rect x="-122" y="20" width="244" height="54" fill="#dbeafe" stroke={outline} strokeWidth="5" />
        <rect x="-80" y="-20" width="160" height="48" fill="#f8fafc" stroke={outline} strokeWidth="5" />
        <rect x="-18" y="-70" width="36" height="50" fill="#94a3b8" stroke={outline} strokeWidth="5" />
        <rect x="-36" y="-88" width="72" height="22" fill="#e0f2fe" stroke={outline} strokeWidth="4" />
        <path d="M-114 54H114" stroke="#475569" strokeWidth="10" strokeDasharray="24 16" />
        <path d="M-78 -48L0 -28 78 -48 36 -18 96 10 60 22 0 0 -60 22 -96 10 -36 -18Z" fill="#bae6fd" stroke={outline} strokeWidth="4" />
        {stationSign("AIR", 0, -6, 72, "#2563eb")}
      </g>
    );
  } else if (kind === "calendarHall") {
    shape = (
      <g shapeRendering="crispEdges">
        {shadow}
        <rect x="-104" y="-10" width="208" height="84" fill="#fff7ed" stroke={outline} strokeWidth="5" />
        <rect x="-104" y="-38" width="208" height="34" fill="#ef4444" stroke={outline} strokeWidth="5" />
        {[-68, -24, 20, 64].map((x) => <rect key={x} x={x} y="-55" width="16" height="30" fill="#64748b" stroke={outline} strokeWidth="3" />)}
        {[-64, -22, 20, 62].map((x) => <rect key={`day-${x}`} x={x} y="8" width="28" height="20" fill="#fde68a" stroke="#92400e" strokeWidth="3" />)}
        {[-64, -22, 20, 62].map((x) => <rect key={`day2-${x}`} x={x} y="38" width="28" height="20" fill="#fef3c7" stroke="#92400e" strokeWidth="3" />)}
        {stationSign("CAL", 0, -20, 74, "#facc15", "#111827")}
      </g>
    );
  } else if (kind === "crmOffice") {
    shape = (
      <g shapeRendering="crispEdges">
        {shadow}
        <rect x="-116" y="-16" width="232" height="90" fill="#dbeafe" stroke={outline} strokeWidth="5" />
        <path d="M-116 -16L0 34L116 -16" fill="none" stroke="#2563eb" strokeWidth="8" strokeLinejoin="round" />
        <rect x="-80" y="-56" width="160" height="42" fill="#2563eb" stroke={outline} strokeWidth="5" />
        <text x="0" y="-27" textAnchor="middle" fill="#f8fafc" fontFamily="monospace" fontSize="24" fontWeight="950">CRM</text>
        {windows([-76, -42, 42, 76], 34, "#bfdbfe")}
        <rect x="-18" y="34" width="36" height="40" fill="#1e3a8a" stroke={outline} strokeWidth="4" />
      </g>
    );
  } else if (kind === "phoneOffice") {
    shape = (
      <g shapeRendering="crispEdges">
        {shadow}
        <rect x="-92" y="-30" width="184" height="104" rx="12" fill="#e0f2fe" stroke={outline} strokeWidth="5" />
        <rect x="-50" y="-10" width="100" height="58" rx="8" fill="#0f172a" stroke={outline} strokeWidth="4" />
        <rect x="-36" y="2" width="72" height="32" fill="#38bdf8" />
        <circle cx="0" cy="56" r="8" fill="#f8fafc" stroke={outline} strokeWidth="3" />
        <path d="M-128 -60Q-160 -24 -128 12M128 -60Q160 -24 128 12" fill="none" stroke="#06b6d4" strokeWidth="8" strokeLinecap="round" />
        {stationSign("CALL", 0, -46, 82, "#06b6d4")}
      </g>
    );
  } else if (kind === "weatherStation") {
    shape = (
      <g shapeRendering="crispEdges">
        {shadow}
        <rect x="-92" y="-8" width="184" height="82" fill="#ecfeff" stroke={outline} strokeWidth="5" />
        <path d="M-104 -8L0 -64 104 -8Z" fill="#bae6fd" stroke={outline} strokeWidth="5" />
        <circle cx="-48" cy="24" r="18" fill="#facc15" stroke="#92400e" strokeWidth="4" />
        <rect x="-4" y="16" width="48" height="22" fill="#e0f2fe" stroke="#0284c7" strokeWidth="4" />
        <rect x="-24" y="28" width="92" height="22" fill="#e0f2fe" stroke="#0284c7" strokeWidth="4" />
        <path d="M72 -8V-78M48 -62L72 -78 96 -62" stroke={outline} strokeWidth="5" fill="none" />
        {stationSign("WX", 0, -18, 64, "#0ea5e9")}
      </g>
    );
  } else if (kind === "notebook") {
    shape = (
      <g shapeRendering="crispEdges">
        {shadow}
        <rect x="-92" y="-50" width="184" height="124" rx="8" fill="#fef3c7" stroke={outline} strokeWidth="5" />
        <rect x="-92" y="-50" width="30" height="124" fill="#a855f7" stroke={outline} strokeWidth="5" />
        {[-22, 4, 30, 56].map((y) => <path key={y} d={`M-44 ${y}H64`} stroke="#94a3b8" strokeWidth="4" />)}
        {[-78, -78, -78, -78].map((x, index) => <circle key={index} cx={x} cy={-24 + index * 26} r="6" fill="#f8fafc" stroke={outline} strokeWidth="3" />)}
        <path d="M42 -52L86 -78 100 -54 56 -28Z" fill="#facc15" stroke={outline} strokeWidth="4" />
        {stationSign("NOTE", 8, -70, 86, "#7c3aed")}
      </g>
    );
  } else if (kind === "tower") {
    shape = (
      <g shapeRendering="crispEdges">
        {shadow}
        <rect x="-48" y="-52" width="96" height="126" fill="#fef3c7" stroke={outline} strokeWidth="5" />
        <path d="M-60 -52L0 -104 60 -52Z" fill={theme.accent} stroke={outline} strokeWidth="5" />
        {windows([-24, 8], -24)}
        {windows([-24, 8], 18)}
        <rect x="-12" y="42" width="24" height="32" fill="#78350f" stroke={outline} strokeWidth="4" />
      </g>
    );
  } else {
    shape = (
      <g shapeRendering="crispEdges">
        {shadow}
        <rect x="-78" y="-4" width="156" height="78" fill="#fef3c7" stroke={outline} strokeWidth="5" />
        <path d="M-90 -4L0 -58 90 -4Z" fill={theme.accent} stroke={outline} strokeWidth="5" />
        {windows([-46, -14, 22], 18)}
        <rect x="46" y="34" width="28" height="40" fill="#78350f" stroke={outline} strokeWidth="4" />
      </g>
    );
  }

  return (
    <g transform={`scale(${scale})`} shapeRendering="crispEdges">
      {shape}
      <rect x="74" y="-70" width="44" height="34" fill={tone.stroke} stroke="#fff7ed" strokeWidth="4" />
      <text x="96" y="-48" textAnchor="middle" fill="#111827" fontFamily="monospace" fontSize="12" fontWeight="950">{status}</text>
      {label && <text x="0" y="112" textAnchor="middle" fill="#111827" stroke="#fff7ed" strokeWidth="6" paintOrder="stroke" fontFamily="monospace" fontSize="20" fontWeight="950">{compact(label, 8)}</text>}
    </g>
  );
};

const overviewMetroLines: Array<{ id: string; label: string; color: string; width: number; points: Array<{ x: number; y: number }>; dash?: string }> = [
  {
    id: "central-spine",
    label: "Control Spine",
    color: "#d97706",
    width: 18,
    points: [
      { x: 3000, y: 980 },
      { x: 3000, y: 3000 },
      { x: 3000, y: 3540 },
      { x: 3780, y: 4500 },
      { x: 3000, y: 5480 },
      { x: 3000, y: 6200 },
      { x: 3000, y: 8200 },
    ],
  },
  {
    id: "automation",
    label: "Automation",
    color: "#f97316",
    width: 20,
    points: [
      { x: 620, y: 5200 },
      { x: 1500, y: 5200 },
      { x: 1500, y: 6500 },
      { x: 2900, y: 6500 },
      { x: 4100, y: 7500 },
      { x: 5450, y: 7500 },
    ],
  },
  {
    id: "agents",
    label: "Agents",
    color: "#eab308",
    width: 20,
    points: [
      { x: 620, y: 3000 },
      { x: 1600, y: 3000 },
      { x: 2350, y: 2100 },
      { x: 4100, y: 1500 },
      { x: 5450, y: 1500 },
    ],
  },
  {
    id: "model",
    label: "Model",
    color: "#06b6d4",
    width: 20,
    points: [
      { x: 3000, y: 980 },
      { x: 3000, y: 2600 },
      { x: 3620, y: 3820 },
      { x: 3900, y: 3450 },
      { x: 5200, y: 4500 },
      { x: 5450, y: 4500 },
    ],
  },
  {
    id: "memory",
    label: "Memory",
    color: "#22c55e",
    width: 20,
    points: [
      { x: 620, y: 1600 },
      { x: 1900, y: 1500 },
      { x: 2300, y: 2800 },
      { x: 2380, y: 3820 },
      { x: 2380, y: 5180 },
      { x: 1900, y: 7500 },
      { x: 620, y: 7500 },
    ],
  },
  {
    id: "apps",
    label: "Apps",
    color: "#a855f7",
    width: 20,
    points: [
      { x: 5450, y: 6150 },
      { x: 4600, y: 6150 },
      { x: 4100, y: 6900 },
      { x: 3000, y: 6900 },
      { x: 1900, y: 7500 },
      { x: 620, y: 7500 },
    ],
  },
  {
    id: "external",
    label: "External",
    color: "#0ea5e9",
    width: 20,
    points: [
      { x: 620, y: 4500 },
      { x: 800, y: 4500 },
      { x: 1900, y: 3950 },
      { x: 2220, y: 4500 },
      { x: 3780, y: 4500 },
      { x: 4100, y: 5050 },
      { x: 5450, y: 5050 },
    ],
  },
  {
    id: "security",
    label: "Security",
    color: "#ef4444",
    width: 16,
    points: [
      { x: 620, y: 6000 },
      { x: 1700, y: 6000 },
      { x: 2200, y: 5200 },
      { x: 2380, y: 5180 },
      { x: 3620, y: 3820 },
      { x: 3900, y: 3650 },
      { x: 5450, y: 3650 },
    ],
  },
  {
    id: "server",
    label: "Servers",
    color: "#94a3b8",
    width: 14,
    dash: "34 24",
    points: [
      { x: 620, y: 2300 },
      { x: 1250, y: 2300 },
      { x: 1250, y: 4500 },
      { x: 800, y: 4500 },
      { x: 1250, y: 6700 },
      { x: 620, y: 6700 },
    ],
  },
];

const worldLocalRoads: Array<{ id: string; kind: WorldRouteKind; color: string; points: Array<{ x: number; y: number }> }> = [
  {
    id: "memory-campus-road",
    kind: "road",
    color: "#22c55e",
    points: [
      { x: 930, y: 1500 },
      { x: 1320, y: 1500 },
      { x: 1540, y: 1260 },
      { x: 1780, y: 1420 },
      { x: 2240, y: 930 },
      { x: 2420, y: 1600 },
    ],
  },
  {
    id: "memory-south-road",
    kind: "road",
    color: "#84cc16",
    points: [
      { x: 1320, y: 1960 },
      { x: 1680, y: 2060 },
      { x: 2060, y: 1880 },
      { x: 2300, y: 2800 },
    ],
  },
  {
    id: "agent-plaza-ring",
    kind: "road",
    color: "#eab308",
    points: [
      { x: 3500, y: 2140 },
      { x: 4080, y: 1390 },
      { x: 4520, y: 1700 },
      { x: 5050, y: 1250 },
      { x: 5200, y: 1780 },
      { x: 4760, y: 2200 },
      { x: 3500, y: 2140 },
    ],
  },
  {
    id: "core-library-boulevard",
    kind: "road",
    color: "#facc15",
    points: [
      { x: 2320, y: 4200 },
      { x: 2600, y: 4040 },
      { x: 3000, y: 4450 },
      { x: 3600, y: 4420 },
      { x: 3800, y: 4920 },
      { x: 3420, y: 5350 },
      { x: 2520, y: 5320 },
      { x: 2320, y: 4200 },
    ],
  },
  {
    id: "external-harbor-road",
    kind: "road",
    color: "#0ea5e9",
    points: [
      { x: 620, y: 4200 },
      { x: 690, y: 4550 },
      { x: 860, y: 5000 },
      { x: 1540, y: 5200 },
      { x: 1840, y: 4580 },
    ],
  },
  {
    id: "model-lab-campus",
    kind: "road",
    color: "#06b6d4",
    points: [
      { x: 4240, y: 4600 },
      { x: 4680, y: 3820 },
      { x: 5350, y: 4380 },
      { x: 5480, y: 5050 },
      { x: 4430, y: 5300 },
    ],
  },
  {
    id: "apps-town-loop",
    kind: "road",
    color: "#a855f7",
    points: [
      { x: 760, y: 7860 },
      { x: 1020, y: 7040 },
      { x: 1350, y: 7160 },
      { x: 1750, y: 7420 },
      { x: 2070, y: 8060 },
      { x: 1880, y: 8120 },
      { x: 760, y: 7860 },
    ],
  },
  {
    id: "automation-service-road",
    kind: "industrial",
    color: "#fb923c",
    points: [
      { x: 3500, y: 7600 },
      { x: 3890, y: 6840 },
      { x: 4380, y: 6500 },
      { x: 4980, y: 7580 },
      { x: 5400, y: 8200 },
    ],
  },
  {
    id: "security-patrol-road",
    kind: "road",
    color: "#ef4444",
    points: [
      { x: 620, y: 8300 },
      { x: 780, y: 6500 },
      { x: 1450, y: 7080 },
      { x: 1680, y: 8220 },
      { x: 1040, y: 7920 },
    ],
  },
];

const routeTerminalPoints = overviewMetroLines.flatMap((line) => {
  const first = line.points[0];
  const last = line.points[line.points.length - 1];
  return [
    { id: `${line.id}-start`, point: first, color: line.color, label: line.label.slice(0, 3).toUpperCase(), kind: worldRouteKind(line.id) },
    { id: `${line.id}-end`, point: last, color: line.color, label: line.label.slice(0, 3).toUpperCase(), kind: worldRouteKind(line.id) },
  ];
});

const WorldRouteTerminal = ({ point, color, label, kind }: { point: { x: number; y: number }; color: string; label: string; kind: WorldRouteKind }) => (
  <g transform={`translate(${point.x} ${point.y})`} shapeRendering="crispEdges" pointerEvents="none">
    {kind === "sea" ? (
      <>
        <rect x="-58" y="-16" width="116" height="32" fill="#92400e" stroke="#451a03" strokeWidth="5" />
        <rect x="-38" y="-34" width="76" height="28" fill="#e0f2fe" stroke="#075985" strokeWidth="5" />
      </>
    ) : (
      <>
        <rect x="-44" y="-22" width="88" height="44" fill="#f8fafc" stroke="#111827" strokeWidth="5" />
        <rect x="-34" y="-12" width="68" height="24" fill={color} stroke="#111827" strokeWidth="3" opacity="0.9" />
      </>
    )}
    <text x="0" y="7" textAnchor="middle" fill="#111827" fontFamily="monospace" fontSize="15" fontWeight="950">{label}</text>
  </g>
);

const recordValues = <T,>(record?: Record<string, T>) => Object.values(record || {}) as T[];

const clampViewBox = (box: CanvasViewBox): CanvasViewBox => {
  const width = Math.min(CANVAS_WIDTH, Math.max(360, box.width));
  const height = Math.min(CANVAS_HEIGHT, Math.max(260, box.height));
  const marginX = Math.round(width * PAN_MARGIN_RATIO);
  const marginY = Math.round(height * PAN_MARGIN_RATIO);
  return {
    x: Math.max(-marginX, Math.min(CANVAS_WIDTH - width + marginX, box.x)),
    y: Math.max(-marginY, Math.min(CANVAS_HEIGHT - height + marginY, box.y)),
    width,
    height,
  };
};

const pointerDistance = (a: CanvasPointer, b: CanvasPointer) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

const pointerCenter = (a: CanvasPointer, b: CanvasPointer): CanvasPointer => ({
  clientX: (a.clientX + b.clientX) / 2,
  clientY: (a.clientY + b.clientY) / 2,
});

const screenPointToSvg = (svg: SVGSVGElement, point: CanvasPointer, box: CanvasViewBox) => {
  const rect = svg.getBoundingClientRect();
  return {
    x: box.x + ((point.clientX - rect.left) / rect.width) * box.width,
    y: box.y + ((point.clientY - rect.top) / rect.height) * box.height,
  };
};

const trainPurposeLabel = (train: EMapTrain) => {
  if (train.status === "blocked" || train.status === "error") return "ERR";
  if (train.status === "standby" || train.status === "idle" || train.status === "offline") return "STB";
  if (train.status === "waiting_planning" || train.status === "delayed") return "WTP";
  if (train.payloadType === "model_call") return "MODEL";
  if (train.payloadType === "memory") return "MEM";
  if (train.payloadType === "monitoring") return "MON";
  if (train.payloadType === "tool_call") return "TOOL";
  if (train.trainType === "cargo") return "CARGO";
  if (train.trainType === "shinkansen") return "FAST";
  return "TASK";
};

const trainIsError = (train: EMapTrain) => train.status === "blocked" || train.status === "error";

const trainIsStandby = (train: EMapTrain) => train.status === "standby" || train.status === "idle" || train.status === "offline";

const trainIsWaitingPlanning = (train: EMapTrain) => train.status === "waiting_planning" || train.status === "delayed";

const trainIsStationary = (train: EMapTrain) => trainIsError(train) || trainIsStandby(train) || trainIsWaitingPlanning(train);

const trainStatusColor = (train: EMapTrain) => {
  if (trainIsError(train)) return "#ef4444";
  if (trainIsWaitingPlanning(train)) return "#f59e0b";
  if (trainIsStandby(train)) return "#0f172a";
  return trainAgentColor(train);
};

const trainStatusBadgeTone = (train: EMapTrain) => {
  if (trainIsError(train)) return { fill: "#ef4444", stroke: "#7f1d1d", text: "#fff7ed" };
  if (trainIsWaitingPlanning(train)) return { fill: "#f59e0b", stroke: "#92400e", text: "#111827" };
  if (trainIsStandby(train)) return { fill: "#0f172a", stroke: "#f8fafc", text: "#f8fafc" };
  return { fill: "rgba(3,5,6,0.92)", stroke: "rgba(248,250,252,0.35)", text: "#F8FAFC" };
};

const parkingAvatarOffset = (agentId: string, station?: EMapStation) => {
  if (!station?.neighborhood?.includes("yard")) return { x: 0, y: 0 };
  const hash = Array.from(agentId).reduce((total, char) => total + char.charCodeAt(0), 0);
  const column = hash % 4;
  const row = Math.floor(hash / 4) % 4;
  return {
    x: (column - 1.5) * 26,
    y: row * 24,
  };
};

const agentTagForId = (agentId: string) => {
  const id = agentId.toLowerCase();
  if (id.includes("newsletter-public") || id.includes("public")) return "TNK";
  if (id.includes("newsletter-secondlife") || id.includes("secondlife")) return "2LF";
  if (id.includes("newsletter-lakehouse") || id.includes("lakehouse")) return "LKH";
  if (id.includes("kapricorn")) return "KAP";
  if (id.includes("fashion")) return "FSH";
  if (id.includes("scouter-ai")) return "NAI";
  if (id.includes("health")) return "HLT";
  if (id.includes("dropbox")) return "BOX";
  if (id.includes("daily-txt")) return "TXT";
  if (id.includes("posting-window")) return "PST";
  if (id.includes("malware")) return "MWR";
  if (id.includes("newsletter")) return "NLS";
  if (id.includes("moltbook") || id.includes("multiple")) return "MLT";
  if (id.includes("transport-control")) return "TRN";
  if (id.includes("learning-supervisor")) return "LRN";
  if (id.includes("owner-style")) return "STY";
  if (id.includes("preference-pattern")) return "PRF";
  if (id.includes("parking-yard")) return "PKG";
  if (id.includes("news")) return "NWS";
  if (id.includes("server")) return "SRV";
  if (id.includes("automation")) return "AUT";
  if (id.includes("crm")) return "CRM";
  if (id.includes("relay")) return "RLY";
  if (id.includes("model")) return "MDL";
  if (id.includes("memory")) return "MEM";
  if (id.includes("archive")) return "ARC";
  if (id.includes("bigbrain")) return "BBR";
  if (id.includes("radar")) return "RAD";
  if (id.includes("payment")) return "PAY";
  if (id.includes("security")) return "SEC";
  if (id.includes("system")) return "SYS";
  if (id.includes("hardware")) return "HDW";
  if (id.includes("builder")) return "BLD";
  if (id.includes("voice")) return "VOC";
  if (id.includes("research")) return "RSH";
  return "AGT";
};

const agentColorForTag = (tag: string) => ({
  MLT: "#fb923c",
  TNK: "#06b6d4",
  "2LF": "#f472b6",
  LKH: "#22c55e",
  KAP: "#eab308",
  FSH: "#ec4899",
  NAI: "#38bdf8",
  HLT: "#8b5cf6",
  BOX: "#14b8a6",
  TXT: "#84cc16",
  PST: "#fb923c",
  NWS: "#facc15",
  NLS: "#f472b6",
  SRV: "#38bdf8",
  AUT: "#fb923c",
  MWR: "#fb7185",
  SEC: "#ef4444",
  SYS: "#64748b",
  MDL: "#06b6d4",
  MEM: "#22c55e",
  ARC: "#84cc16",
  BBR: "#a3e635",
  RLY: "#a3e635",
  CRM: "#60a5fa",
  RAD: "#a855f7",
  PAY: "#ef4444",
  BLD: "#f59e0b",
  VOC: "#c084fc",
  RSH: "#0ea5e9",
  TRN: "#14b8a6",
  LRN: "#22c55e",
  STY: "#a3e635",
  PRF: "#84cc16",
  PKG: "#64748b",
}[tag] || "#94a3b8");

const trainAgentTag = (train: EMapTrain) => {
  if (train.agentIds.length > 1) return `+${train.agentIds.length}`;
  return agentTagForId(train.agentIds[0] || "");
};

const trainAgentColor = (train: EMapTrain) => agentColorForTag(trainAgentTag(train));

const farZoomAgentKey = [
  ["MLT", "Moltbook", "moltbook/social automation"],
  ["TNK", "Public", "Public AI newsletter"],
  ["2LF", "2ndLife", "fashion newsletter"],
  ["LKH", "LakeHouse", "property newsletter"],
  ["KAP", "Kapricorn", "weekly parked campaign"],
  ["NWS", "News", "headline collection"],
  ["NLS", "Newsletter", "newsletter composer"],
  ["AUT", "Automation", "clocked jobs"],
  ["SRV", "Server", "external routes"],
  ["RLY", "Relay", "phone/desktop bridge"],
  ["MDL", "Model", "reasoning runtime"],
  ["MEM", "Memory", "local memory"],
  ["ARC", "Archive", "files/archive"],
  ["MWR", "Malware", "file/entry scan"],
  ["SEC", "Security", "permissions/safety"],
  ["CRM", "CRM", "mail/accounts"],
  ["RAD", "Radar", "flight data"],
  ["BLD", "Builder", "builder tasks"],
  ["TRN", "Transport", "summary collectors"],
  ["LRN", "Learning", "Baloss growth loop"],
  ["STY", "Style", "owner writing teacher"],
  ["PRF", "Preference", "owner preference teacher"],
  ["PKG", "Parking", "standby/WTP yard"],
] as const;

const PROOF_WINDOW_MS = 8 * 60 * 60 * 1000;

const jobHeatLevel = (job?: BalossDurableJob) => {
  if (!job) return 0;
  if (job.status === "failed" || job.failureCount >= 2) return 3;
  if (job.failureCount > 0) return 2;
  if (job.status === "running") return 1;
  const nextRunMs = Date.parse(job.nextRunAt || "");
  if (!Number.isNaN(nextRunMs) && nextRunMs < Date.now() - 10 * 60_000) return 2;
  return 0;
};

const stationHeatLevel = (station: SystemStation, job?: BalossDurableJob) => {
  const jobHeat = jobHeatLevel(job);
  if (jobHeat) return jobHeat;
  const detail = `${station.detail} ${station.metric || ""} ${station.repair || ""}`.toLowerCase();
  const latency = detail.match(/(\d+(?:\.\d+)?)\s*ms/);
  const latencyMs = latency ? Number(latency[1]) : 0;
  if (station.status === "blocked") return 3;
  if (isStationNeedsCheck(station) || latencyMs > 1800 || detail.includes("slow") || detail.includes("lag")) return 2;
  if (station.status === "running" || latencyMs > 700 || detail.includes("queue")) return 1;
  return 0;
};

const heatTone = (level: number) => {
  if (level >= 3) return { stroke: "#ef4444", fill: "rgba(239,68,68,0.28)", label: "HOT" };
  if (level === 2) return { stroke: "#f97316", fill: "rgba(249,115,22,0.22)", label: "SLOW" };
  if (level === 1) return { stroke: "#facc15", fill: "rgba(250,204,21,0.16)", label: "BUSY" };
  return { stroke: "transparent", fill: "transparent", label: "" };
};

const isRecentSuccess = (job?: BalossDurableJob) => {
  if (!job?.lastRunAt || job.failureCount > 0 || job.status === "failed") return false;
  const lastRunMs = Date.parse(job.lastRunAt);
  return !Number.isNaN(lastRunMs) && Date.now() - lastRunMs <= PROOF_WINDOW_MS;
};

const outputRecordsForSelection = (
  station: SystemStation | undefined,
  entity: EMapEntity | undefined,
  outputs: BalossAgentOutputState | undefined,
): BalossOutputRecord[] => {
  if (!outputs) return [];
  const key = `${station?.id || ""} ${station?.agentId || ""} ${entity?.id || ""} ${entity?.name || ""}`.toLowerCase();
  if (key.includes("transport") || key.includes("dropbox")) return outputs.transportDropbox.records;
  if (key.includes("build-diary") || key.includes("build diary")) return [outputs.moltbookBuildDiary.record];
  if (key.includes("moltbook-daily") || key.includes("moltbook-archive-writer")) return [outputs.moltbookDailyTxt.record];
  if (key.includes("conversation-memory") || key.includes("learning-supervisor")) return [outputs.learningMemory.supervisor];
  if (key.includes("owner-style")) return [outputs.learningMemory.styleTeacher];
  if (key.includes("preference-pattern")) return [outputs.learningMemory.preferenceTeacher];
  if (key.includes("learning")) {
    return [
      outputs.learningMemory.supervisor,
      outputs.learningMemory.styleTeacher,
      outputs.learningMemory.preferenceTeacher,
    ];
  }
  return [];
};

const blocksForSystemStation = (station: SystemStation): EMapBlock[] => {
  const blocks: EMapBlock[] = [];
  if (station.layer === "agents" || station.controlKind === "agent") blocks.push("agents");
  if (station.controlKind === "model" || station.layer === "model") blocks.push("models");
  if (station.controlKind === "memory" || station.layer === "memory") blocks.push("memory_archive");
  if (station.controlKind === "app" || station.layer === "apps") blocks.push("tools");
  if (station.controlKind === "automation" || station.layer === "automation") blocks.push("automations");
  if (station.controlKind === "external" || station.layer === "external") blocks.push("servers");
  if (station.id.includes("bigbrain") || station.id.includes("aether") || station.id.includes("external-memory")) blocks.push("external_modules");
  if (station.id.includes("security") || station.id.includes("policy") || station.id.includes("permission")) blocks.push("security");
  if (station.status === "running") blocks.push("active_tasks");
  if (station.status === "blocked") blocks.push("errors");
  return [...new Set(blocks)];
};

const stationMatchesBlocks = (station: SystemStation, selectedBlocks: EMapBlock[]) =>
  station.layer === "core" || station.hub || matchesSelectedBlocks(blocksForSystemStation(station), selectedBlocks);

const isYardEMapStation = (station?: EMapStation) => Boolean(station?.neighborhood?.includes("yard"));

const isDetailOnlyEMapEntity = (entity?: EMapEntity) =>
  entity?.metadata?.mapDisplayLevel === "detail" || Boolean(entity?.metadata?.mapMergedFrom);

const dominantStatus = (stations: SystemStation[]): MapStatus => {
  if (stations.some((station) => station.status === "blocked")) return "blocked";
  if (stations.some(isStationNeedsCheck)) return "warning";
  if (stations.some((station) => station.status === "running")) return "running";
  if (stations.some((station) => station.status === "healthy")) return "healthy";
  if (stations.some((station) => station.status === "standby")) return "standby";
  return "unknown";
};

const statusPriority: Record<MapStatus, number> = {
  blocked: 5,
  warning: 4,
  running: 3,
  healthy: 2,
  standby: 1.5,
  unknown: 1,
};

const mergeStationStatus = (current: MapStatus, incoming: MapStatus): MapStatus =>
  statusPriority[incoming] > statusPriority[current] ? incoming : current;

const stationDedupeKey = (station: SystemStation) => {
  const explicit = station.appId || station.jobId || station.agentId || station.url || station.id;
  return `${station.layer}:${station.controlKind || "station"}:${explicit}`.toLowerCase();
};

const mergeStation = (current: SystemStation, incoming: SystemStation): SystemStation => {
  const mergedStatus = mergeStationStatus(current.status, incoming.status);
  const labels = [...new Set([current.label, incoming.label].filter(Boolean))];
  const links = [...new Set([...(current.links || []), ...(incoming.links || [])])];
  const details = [...new Set([current.detail, incoming.detail].filter(Boolean))];
  const sources = [...new Set([current.source, incoming.source].filter(Boolean))];
  return {
    ...current,
    status: mergedStatus,
    statusLabel: current.statusLabel || incoming.statusLabel,
    label: labels[0] || current.label,
    detail: compact(details.join(" / "), 180),
    metric: current.metric || incoming.metric,
    source: compact(sources.join(" + "), 120),
    repair: current.repair || incoming.repair,
    hub: current.hub || incoming.hub,
    url: current.url || incoming.url,
    functions: [...new Set([...(current.functions || []), ...(incoming.functions || [])])],
    group: current.group || incoming.group,
    sensitive: current.sensitive || incoming.sensitive,
    appId: current.appId || incoming.appId,
    jobId: current.jobId || incoming.jobId,
    agentId: current.agentId || incoming.agentId,
    lastRunAt: current.lastRunAt || incoming.lastRunAt,
    nextRunAt: current.nextRunAt || incoming.nextRunAt,
    controlKind: current.controlKind || incoming.controlKind,
    appHub: current.appHub || incoming.appHub,
    iconTag: current.iconTag || incoming.iconTag,
    links,
  };
};

const consolidateStations = (stations: SystemStation[]) => {
  const byKey = new Map<string, SystemStation>();
  for (const station of stations) {
    const key = station.id === "core" || station.hub ? station.id : stationDedupeKey(station);
    const existing = byKey.get(key);
    byKey.set(key, existing ? mergeStation(existing, station) : station);
  }
  return [...byKey.values()];
};

const layerStatusCounts = (stations: SystemStation[], layer: MapLayer) =>
  stations.filter((station) => station.layer === layer && !station.hub).reduce(
    (counts, station) => ({ ...counts, [station.status]: counts[station.status] + 1 }),
    { healthy: 0, running: 0, standby: 0, warning: 0, blocked: 0, unknown: 0 } as Record<MapStatus, number>,
  );

const layoutStations = (sourceStations: SystemStation[]) => {
  const core = sourceStations.find((station) => station.id === "core");
  const children = sourceStations.filter((station) => station.layer !== "core" && !station.hub);
  const occupiedLots = new Map<WorldZoneTheme, Set<string>>();
  const laidOut: SystemStation[] = core
    ? [
        {
          ...core,
          ...safeWorldLot("core", { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }),
          hub: true,
        },
      ]
    : [];

  (Object.keys(layerMeta) as MapLayer[]).forEach((layer) => {
    const meta = layerMeta[layer];
    const layerChildren = children.filter((station) => station.layer === layer);
    const counts = layerStatusCounts(sourceStations, layer);
    const pending = layerChildren.filter(isStationWaitingOrStandby).length;
    const activeIssues = counts.blocked + layerChildren.filter(isStationNeedsCheck).length + counts.unknown;
    const hubStatus = dominantStatus(layerChildren);
    const hubPosition = landLotForStation({ id: `hub-${layer}`, label: meta.hubLabel, layer, status: hubStatus, x: meta.hubX, y: meta.hubY, detail: "", source: "", hub: true }, 0, { x: meta.hubX, y: meta.hubY }, occupiedLots);
    laidOut.push({
      id: `hub-${layer}`,
      label: meta.hubLabel,
      layer,
      hub: true,
      status: hubStatus,
      x: hubPosition.x,
      y: hubPosition.y,
      detail: `${layerChildren.length} connected station${layerChildren.length === 1 ? "" : "s"}. ${meta.description}`,
      metric: activeIssues ? `${activeIssues} need check` : pending ? `${pending} WTP/STB` : `${counts.healthy + counts.running} clear`,
      source: `${meta.label} aggregate`,
      repair: activeIssues
        ? "Open the station list below and inspect blocked, warning or unknown children."
        : pending
          ? "No urgent repair: these child stations are parked, waiting for planning, or standing by."
          : "No issues reported by this sector.",
      controlKind: "hub",
    });

    const center = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 };
    const outwardLength = Math.hypot(meta.hubX - center.x, meta.hubY - center.y) || 1;
    const outward = { x: (meta.hubX - center.x) / outwardLength, y: (meta.hubY - center.y) / outwardLength };
    const perpendicular = { x: -outward.y, y: outward.x };
    const appHubChildren = layer === "apps" ? layerChildren.filter((station) => station.appHub) : [];
    const branchCount = layerChildren.length > 22 ? 6 : layerChildren.length > 12 ? 5 : 4;
    layerChildren.forEach((station, index) => {
      const appHubIndex = appHubChildren.findIndex((item) => item.id === station.id);
      const appHubCount = appHubChildren.length;
      const branch = index % branchCount;
      const depth = Math.floor(index / branchCount);
      const side = branch - (branchCount - 1) / 2;
      const distance = station.appHub ? 520 : 760 + depth * 370;
      const laneOffset = station.appHub
        ? (appHubIndex - (appHubCount - 1) / 2) * 390
        : side * 245;
      const radialFallback = {
        x: Math.round(hubPosition.x + outward.x * distance + perpendicular.x * laneOffset),
        y: Math.round(hubPosition.y + outward.y * distance + perpendicular.y * laneOffset),
      };
      const lot = landLotForStation(station, index, radialFallback, occupiedLots);
      laidOut.push({
        ...station,
        x: lot.x,
        y: lot.y,
      });
    });
  });

  return laidOut;
};

const buildConnections = (stations: SystemStation[]) => {
  const connections: SystemConnection[] = [];
  const connectionKeys = new Set<string>();
  const addConnection = (connection: SystemConnection) => {
    const key = [connection.from, connection.to].sort().join("::");
    if (connectionKeys.has(key)) return;
    connectionKeys.add(key);
    connections.push(connection);
  };
  const ringOrder: MapLayer[] = ["model", "automation", "apps", "external", "memory", "agents"];
  ringOrder.forEach((layer, index) => {
    const nextLayer = ringOrder[(index + 1) % ringOrder.length];
    const from = stations.find((station) => station.id === `hub-${layer}`);
    const to = stations.find((station) => station.id === `hub-${nextLayer}`);
    if (!from || !to) return;
    addConnection({
      id: `interchange-${layer}-${nextLayer}`,
      from: from.id,
      to: to.id,
      status: dominantStatus([from, to]),
    });
  });
  (Object.keys(layerMeta) as MapLayer[]).forEach((layer) => {
    const hub = stations.find((station) => station.id === `hub-${layer}`);
    if (!hub) return;
    addConnection({
      id: `core-${layer}`,
      from: "core",
      to: hub.id,
      status: hub.status,
    });
  });
  (Object.keys(layerMeta) as MapLayer[]).forEach((layer) => {
    const hub = stations.find((station) => station.id === `hub-${layer}`);
    const children = stations.filter((station) => station.layer === layer && !station.hub);
    if (!hub) return;
    children.forEach((station) => {
      addConnection({
        id: `${hub.id}-${station.id}`,
        from: hub.id,
        to: station.id,
        status: station.status,
      });
    });
  });
  stations.forEach((station) => {
    station.links?.forEach((targetId) => {
      const target = stations.find((item) => item.id === targetId);
      if (!target) return;
      addConnection({
        id: `link-${station.id}-${target.id}`,
        from: station.id,
        to: target.id,
        status: dominantStatus([station, target]),
      });
    });
  });
  return connections;
};

const findRouteBetween = (routes: EMapRuntimeState["routes"], fromStationId?: string, toStationId?: string) =>
  Object.values(routes).find((route) => route.fromStationId === fromStationId && route.toStationId === toStationId)
  || Object.values(routes).find((route) => route.fromStationId === toStationId && route.toStationId === fromStationId);

const createRuntimeEvents = (
  registry: EMapRegistrySnapshot,
  graph: Pick<EMapRuntimeState, "stations" | "routes">,
  jobs: BalossDurableJob[],
  runtimeStats: Partial<SpinoRuntimeStats>,
) => {
  const events: EMapEvent[] = [];
  const now = Date.now();
  const entitiesById = new Map(registry.entities.map((entity) => [entity.id, entity]));
  const stationFor = (entityId: string) => entitiesById.get(entityId)?.stationId || `station-${entityId}`;
  const parkingStationFor = (entityId: string, fallback: "agents" | "automation" | "planning" = "agents") => {
    const entity = entitiesById.get(entityId);
    const lot = String(entity?.metadata?.parkingLot || "").toLowerCase();
    if (entity?.metadata?.planned || lot.includes("future") || lot.includes("planning")) return stationFor("parking-yard-planning");
    if (entity?.lineId === "automation" || lot.includes("newsletter") || fallback === "automation") return stationFor("parking-yard-automation");
    return fallback === "planning" ? stationFor("parking-yard-planning") : stationFor("parking-yard-agents");
  };
  const centralStation = stationFor("llboss-main-brain");

  events.push(createEMapEvent({
    id: "emap-heartbeat-llboss",
    type: "agent_heartbeat",
    agentId: "llboss-main-brain",
    fromStationId: centralStation,
    toStationId: centralStation,
    message: "LLBoss control station heartbeat.",
    timestamp: now,
  }));

  if (runtimeStats.generationActive) {
    const target = stationFor("local-model-router");
    const route = findRouteBetween(graph.routes, centralStation, target);
    events.push(createEMapEvent({
      id: "emap-model-call-active",
      type: "model_call_started",
      traceId: "trace-model-active",
      agentId: "local-model-router",
      fromStationId: centralStation,
      toStationId: target,
      routeId: route?.id,
      message: runtimeStats.loadedModelId ? `Reasoning on ${runtimeStats.loadedModelId}` : "Local model generation active.",
      metadata: { tokensPerSecond: runtimeStats.tokensPerSecond, backend: runtimeStats.backend },
      timestamp: now,
    }));
  }

  jobs.forEach((job, index) => {
    const agentId = `automation-${job.id}`;
    const target = stationFor(agentId);
    const ownerAgentId = job.owner === "moltbook" ? "agent-moltbook" : job.owner === "news" ? "agent-news" : job.owner === "archive" ? "agent-archive" : job.owner === "bigbrain" ? "agent-bigbrain" : "agent-automation";
    const ownerStationId = stationFor(ownerAgentId);
    const route = findRouteBetween(graph.routes, ownerStationId, target) || findRouteBetween(graph.routes, centralStation, target);
    const base = {
      agentId,
      fromStationId: ownerStationId,
      toStationId: target,
      routeId: route?.id,
      traceId: `trace-${job.id}`,
      message: job.lastMessage || job.label,
      metadata: { owner: job.owner, kind: job.kind, nextRunAt: job.nextRunAt, failureCount: job.failureCount },
      timestamp: job.lastRunAt ? Date.parse(job.lastRunAt) || now : now,
    };
    if (job.status === "running") {
      events.push(createEMapEvent({ ...base, id: `emap-job-running-${job.id}`, type: "task_started" }));
    } else if (job.status === "failed" || job.failureCount > 0) {
      events.push(createEMapEvent({ ...base, id: `emap-job-failed-${job.id}`, type: "task_failed", severity: "error" }));
    } else if (!job.enabled) {
      const parkingStationId = parkingStationFor(agentId, "automation");
      events.push(createEMapEvent({
        ...base,
        id: `emap-job-standby-${job.id}`,
        type: "warning",
        status: "standby",
        severity: "info",
        fromStationId: parkingStationId,
        toStationId: parkingStationId,
        routeId: undefined,
        message: `${job.label} is parked in the automation yard.`,
      }));
    } else if (job.nextRunAt && Date.parse(job.nextRunAt) < now - 10 * 60_000) {
      const planningStationId = parkingStationFor(agentId, "planning");
      events.push(createEMapEvent({
        ...base,
        id: `emap-job-waiting-plan-${job.id}`,
        type: "warning",
        status: "waiting_planning",
        severity: "warning",
        fromStationId: planningStationId,
        toStationId: planningStationId,
        routeId: undefined,
        message: `${job.label} is waiting for planning / schedule review in the planning yard.`,
      }));
    }
  });

  [
    {
      id: "server",
      agentId: "agent-server",
      from: "agent-automation",
      to: "server-network-hub",
      lineId: "server",
      message: "Server scan patrol: checking public routes, local services, blocked endpoints and monitor memories.",
      ageMs: 12_000,
    },
    {
      id: "automation",
      agentId: "agent-automation",
      from: "agent-news",
      to: "agent-moltbook",
      lineId: "automation",
      message: "Automation scan patrol: checking newsletters, Moltbook queue, due jobs and failed runs.",
      ageMs: 42_000,
    },
    {
      id: "system",
      agentId: "agent-system",
      from: "agent-hardware",
      to: "policy-safety-control",
      lineId: "security",
      message: "System scan patrol: checking phone permissions, storage access, relay readiness and safety controls.",
      ageMs: 72_000,
    },
    {
      id: "model-memory",
      agentId: "agent-model",
      from: "local-model-router",
      to: "bigbrain-external-memory",
      lineId: "memory",
      message: "Model and memory scan patrol: checking runtime, index, memory archive and retrieval health.",
      ageMs: 102_000,
    },
    {
      id: "learning-supervisor",
      agentId: "learning-supervisor",
      from: "conversation-memory",
      to: "learning-supervisor",
      lineId: "memory",
      message: "Learning supervisor patrol: collecting owner corrections, app edits and accepted decisions for safe Baloss growth.",
      ageMs: 18_000,
    },
    {
      id: "malware-files",
      agentId: "agent-malware-files",
      from: "agent-malware-files",
      to: "app-reader",
      lineId: "security",
      message: "Malware file scanner: sweeping imported files, archives, downloads and external storage records.",
      ageMs: 27_000,
    },
  ].forEach((scan) => {
    const fromStationId = stationFor(scan.from);
    const toStationId = stationFor(scan.to);
    const route = findRouteBetween(graph.routes, fromStationId, toStationId);
    events.push(createEMapEvent({
      id: `emap-monitoring-${scan.id}`,
      type: "monitoring_started",
      traceId: `trace-monitor-${scan.id}`,
      agentId: scan.agentId,
      fromStationId: route?.fromStationId || fromStationId,
      toStationId: route?.toStationId || toStationId,
      routeId: route?.id,
      targetEntityId: graph.stations[route?.toStationId || ""]?.entityId || scan.to,
      message: scan.message,
      timestamp: now - scan.ageMs,
      metadata: { patrol: true, zone: scan.id, cadence: "continuous rotating station sweep" },
    }));
  });

  return events;
};

const collectSnapshot = async (): Promise<SystemSnapshot> => {
  const runtimeStats: Partial<SpinoRuntimeStats> = window.PocketFlowReceiveBridge?.spinoGetRuntimeStats
    ? await window.PocketFlowReceiveBridge.spinoGetRuntimeStats().catch(() => ({ backend: "Android bridge", loaded: false, health: "disconnected" as const, message: "Runtime stats failed." }))
    : { backend: "WebView", loaded: false, message: "Native bridge unavailable." };
  const aetherStorage = window.PocketFlowReceiveBridge?.spinoGetAetherStorageStats
    ? await window.PocketFlowReceiveBridge.spinoGetAetherStorageStats().catch(() => null)
    : null;
  const indexState = loadSpinoIndex();
  const healthReport = loadBalossAgentHealthReport();
  let jobs = loadBalossDurableJobs();
  const files = await getAllFiles();
  const builderProjects = getAllBuilderProjects();
  const dashboards = getAllDashboards();
  const intel = loadSpinoIntelSnapshot();
  const archiveMaintenance = loadArchiveMaintenanceState();
  const serverRuntime = loadPublicServerRuntime();
  const agentOutputs = runBalossAgentOutputMaintenance({
    files: files.length,
    builderProjects: builderProjects.length,
    dashboards: dashboards.length,
    indexDocs: indexState.documents.length,
    indexChunks: indexState.chunks.length,
    intelItems: intel.items.length,
    jobs,
    runtimeStats,
    archiveMaintenance,
    serverServiceCount: PUBLIC_SERVER_INVENTORY.length,
  });
  jobs = agentOutputs.jobs;
  const agentControls = readAgentControls();
  const baseRegistry = createEMapRegistrySnapshot(jobs);
  const emapRegistry: EMapRegistrySnapshot = {
    ...baseRegistry,
    entities: baseRegistry.entities.map((entity) => {
      const control = agentControls[entity.id];
      if (!control || !(entity.id.startsWith("agent-") || entity.type === "monitor_agent")) return entity;
      const paused = !control.enabled || control.runtimeMode === "paused" || control.cadence === "manual";
      return {
        ...entity,
        status: paused ? "blocked" : entity.status,
        metadata: {
          ...(entity.metadata || {}),
          controlEnabled: control.enabled,
          runtimeMode: control.runtimeMode,
          permissionOverride: control.permissionMode,
          cadence: control.cadence,
          lastControlAt: control.lastControlAt,
          lastAction: control.lastAction,
          restartCount: control.restartCount || 0,
        },
      };
    }),
  };
  const emapGraph = generateEMapMetroGraph(emapRegistry.entities);
  const emapRuntime = createEMapRuntimeState(
    emapRegistry.entities,
    emapGraph,
    createRuntimeEvents(emapRegistry, emapGraph, jobs, runtimeStats),
  );
  const stations: SystemStation[] = [
    {
      id: "core",
      label: "Baloss Core",
      layer: "core",
      status: runtimeStats.generationActive ? "running" : stationStatusFromHealth(runtimeStats.health || (runtimeStats.loaded ? "ready" : "unknown")),
      x: 520,
      y: 286,
      detail: runtimeStats.message || "Central routing hub for model, memory, tools, apps and automations.",
      metric: runtimeStats.loadedModelId || runtimeStats.backend || "local-first",
      source: "Android bridge / Baloss runtime",
      repair: runtimeStats.health === "disconnected" ? "Open Baloss and start the phone runtime only for reasoning tasks." : "No repair needed unless connected lanes show warnings.",
      controlKind: "core",
    },
  ];

  const modelStations: SystemStation[] = [
    {
      id: "model-runtime",
      label: "Runtime",
      layer: "model",
      status: runtimeStats.generationActive
        ? "running"
        : runtimeStats.loaded
          ? "healthy"
          : runtimeStats.runtimeCanAutostart || runtimeStats.health === "ready"
            ? "standby"
            : runtimeStats.runtimeNeedsStart
              ? "warning"
              : stationStatusFromHealth(runtimeStats.health),
      statusLabel: runtimeStats.runtimeCanAutostart || runtimeStats.health === "ready" ? "STB" : undefined,
      x: 120,
      y: 0,
      detail: runtimeStats.runtimeEndpoint ? `Runtime endpoint ${runtimeStats.runtimeEndpoint}` : runtimeStats.message || "Local model runtime is ready but asleep.",
      metric: runtimeStats.tokensPerSecond ? `${runtimeStats.tokensPerSecond} tok/s` : runtimeStats.loaded ? "loaded" : runtimeStats.runtimeCanAutostart ? "ready idle" : "standby",
      source: "spinoGetRuntimeStats",
      repair: "Keep runtime asleep for navigation; wake only for serious reasoning.",
      controlKind: "model",
    },
    {
      id: "model-file",
      label: "Qwen File",
      layer: "model",
      status: runtimeStats.modelFileInstalled ? "healthy" : "blocked",
      x: 270,
      y: 0,
      detail: runtimeStats.modelFilePath || "Optimized model file path not reported.",
      metric: runtimeStats.modelFileBytes ? `${Math.round(runtimeStats.modelFileBytes / 1024 / 1024 / 1024)} GB` : "missing",
      source: "Android model file check",
      repair: runtimeStats.modelFileInstalled ? "Model file is present." : "Install the configured Qwen model file before high reasoning.",
      controlKind: "model",
    },
    {
      id: "aether-storage",
      label: "Aether",
      layer: "model",
      status: aetherStorage?.mounted ? aetherStorage.writable ? "healthy" : "warning" : "unknown",
      x: 420,
      y: 0,
      detail: aetherStorage?.message || "Aether storage reserve status not reported.",
      metric: aetherStorage?.freeBytes ? `${Math.round(aetherStorage.freeBytes / 1024 / 1024 / 1024)} GB free` : "storage",
      source: "spinoGetAetherStorageStats",
      repair: "Mount and keep the Aether reserve writable for model memory and vectors.",
      controlKind: "model",
    },
    {
      id: "vector-index",
      label: "Vector Index",
      layer: "model",
      status: indexState.documents.length ? "healthy" : "unknown",
      statusLabel: indexState.documents.length ? undefined : "WTP",
      x: 570,
      y: 0,
      detail: `${indexState.documents.length} docs and ${indexState.chunks.length} chunks indexed.`,
      metric: `${indexState.chunks.length} chunks`,
      source: "Baloss local index",
      repair: "Index Reader, notes, archive and work files to improve local answers.",
      controlKind: "model",
    },
    {
      id: "voice-tools",
      label: "Voice Tools",
      layer: "model",
      status: runtimeStats.speechTranscriptionAvailable || runtimeStats.speechRecognizerAvailable ? "healthy" : "warning",
      x: 720,
      y: 0,
      detail: runtimeStats.recordAudioPermission ? "Microphone permission granted." : "Microphone permission not confirmed.",
      metric: runtimeStats.speechOfflinePreferred ? "offline pref" : "speech",
      source: "Android speech bridge",
      repair: "Grant mic permission and keep speech recognizer available for Notes, Builder and Translate.",
      controlKind: "model",
    },
    {
      id: "tool-bridge",
      label: "Tool Bridge",
      layer: "model",
      status: runtimeStats.toolBridgeReady ? "healthy" : runtimeStats.approvedToolCount ? "warning" : "unknown",
      x: 870,
      y: 0,
      detail: `${runtimeStats.approvedToolCount || 0} approved tools reported.`,
      metric: `${runtimeStats.approvedToolCount || 0} tools`,
      source: "Android bridge stats",
      repair: "Expose bridge tools explicitly when new native capabilities are added.",
      controlKind: "model",
    },
  ];

  const memoryStations: SystemStation[] = [
    {
      id: "archive-files",
      label: "Archive",
      layer: "memory",
      status: files.length ? "healthy" : "unknown",
      statusLabel: files.length ? undefined : "STB",
      x: 120,
      y: 0,
      detail: `${files.length} known files in Receive/Reader storage.`,
      metric: `${files.length} files`,
      source: "getAllFiles",
      repair: "Import or rescan files if expected archive items are missing.",
      controlKind: "memory",
      appId: "reader",
    },
    {
      id: "builder-projects",
      label: "Builder",
      layer: "memory",
      status: builderProjects.length ? "healthy" : "unknown",
      statusLabel: builderProjects.length ? undefined : "STB",
      x: 300,
      y: 0,
      detail: `${builderProjects.length} Builder project${builderProjects.length === 1 ? "" : "s"} saved.`,
      metric: `${builderProjects.length} builds`,
      source: "Builder storage",
      repair: "Create Builder maps or import project packages to populate this lane.",
      controlKind: "memory",
      appId: "builder",
    },
    {
      id: "dashboards",
      label: "Dashboards",
      layer: "memory",
      status: dashboards.length ? "healthy" : "unknown",
      x: 480,
      y: 0,
      detail: `${dashboards.length} dashboard${dashboards.length === 1 ? "" : "s"} saved.`,
      metric: `${dashboards.length} boards`,
      source: "Dashboard storage",
      repair: "Open Dashboard Studio if dashboard memory should be present.",
      controlKind: "memory",
      appId: "builder",
    },
    {
      id: "online-intel",
      label: "144h Intel",
      layer: "memory",
      status: stationStatusFromHealth(intel.status),
      statusLabel: intel.errors.length ? "CHECK" : undefined,
      x: 660,
      y: 0,
      detail: `${intel.items.length} cached online intel items. ${intel.errors.length} warning${intel.errors.length === 1 ? "" : "s"}.`,
      metric: `${intel.items.length} items`,
      source: "Baloss online intel cache",
      repair: "Refresh News Flow or Baloss intel when public context goes stale.",
      controlKind: "memory",
      appId: "news",
    },
    {
      id: "conversation-memory",
      label: "Conversation",
      layer: "memory",
      status: runtimeStats.semanticRetrievalReady || indexState.chunks.length || agentOutputs.learningMemory.updatedAt ? "healthy" : "unknown",
      statusLabel: runtimeStats.semanticRetrievalReady || indexState.chunks.length || agentOutputs.learningMemory.updatedAt ? "MEM" : "WTP",
      x: 840,
      y: 0,
      detail: `Conversation and reusable task memory feed local answers and Builder workflows. Learning output root: ${agentOutputs.learningMemory.rootPath}.`,
      metric: runtimeStats.semanticRetrievalReady ? "semantic" : agentOutputs.learningMemory.updatedAt ? "learning txt" : "basic",
      source: "Baloss memory stack + learning output writer",
      repair: "Keep chat cleanup, durable memory compression and learning promotion running.",
      controlKind: "memory",
      appId: "spino",
    },
    {
      id: "moltbook-daily-txt-archive",
      label: "Moltbook Daily TXT",
      layer: "memory",
      status: agentOutputs.moltbookDailyTxt.updatedAt ? "healthy" : "unknown",
      statusLabel: agentOutputs.moltbookDailyTxt.updatedAt ? "TXT" : "WTP",
      x: 1020,
      y: 0,
      detail: `Automatic Reader folder: ${agentOutputs.moltbookDailyTxt.rootPath} with post history, comment history and summary TXT records.`,
      metric: `${agentOutputs.moltbookDailyTxt.counts.planned} planned`,
      source: "Moltbook phone state + Baloss TXT writer",
      repair: agentOutputs.moltbookDailyTxt.updatedAt ? "No repair needed unless Moltbook connection status reports warning." : "Open Baloss Panel once to seed the TXT writer.",
      controlKind: "memory",
      appId: "reader",
      iconTag: "TXT",
      links: ["apphub-moltbook", "apphub-storage", "conversation-memory"],
    },
    {
      id: "transport-memory-dropbox",
      label: "Transport Dropbox",
      layer: "memory",
      status: agentOutputs.transportDropbox.updatedAt ? "healthy" : "unknown",
      statusLabel: agentOutputs.transportDropbox.updatedAt ? "DROP" : "WTP",
      x: 1200,
      y: 0,
      detail: `Shared memory drop box where collector agents leave compact app/server summaries before Baloss Core reads them. Current path: ${agentOutputs.transportDropbox.path}.`,
      metric: `${agentOutputs.transportDropbox.records.length}/${agentOutputs.transportDropbox.collectorCount} reports`,
      source: "Transport collector output writer",
      repair: agentOutputs.transportDropbox.updatedAt ? "No repair needed. Use Run Now on the transport job to refresh immediately." : "Run the Transport Dropbox collector job once.",
      controlKind: "memory",
      appId: "reader",
      iconTag: "BOX",
      links: ["conversation-memory"],
    },
  ];

  const healthByAgent = new Map(healthReport.items.map((item) => [item.agentId, item]));
  const agentStations: SystemStation[] = SPINO_AGENT_NODES.map((agent, index) => {
    const health = healthByAgent.get(agent.id);
    const control = agentControls[`agent-${agent.id}`];
    const paused = Boolean(control && (!control.enabled || control.runtimeMode === "paused" || control.cadence === "manual"));
    const controlDetail = control
      ? `Control: ${control.enabled ? "enabled" : "paused"}, runtime ${control.runtimeMode}, permission ${control.permissionMode}, cadence ${control.cadence}. `
      : "";
    return {
      id: `agent-${agent.id}`,
      label: agent.label.replace(/\s+Agent$/i, ""),
      layer: "agents",
      status: paused ? "unknown" : health ? stationStatusFromHealth(health.status) : "unknown",
      statusLabel: paused ? "STB" : undefined,
      x: 95 + index * 126,
      y: 0,
      detail: compact(`${controlDetail}${health?.summary || agent.role}`),
      metric: control ? `${control.runtimeMode}/${control.cadence}` : health ? `${health.score}%` : agent.permission,
      source: health ? "Agent health report + Baloss Panel controls" : "SPINO_AGENT_NODES registry + Baloss Panel controls",
      repair: paused ? "Start this agent from the Baloss Panel when you want it active again." : health?.repairPlan?.[0] || "Run Baloss Agent Health to update this station.",
      controlKind: "agent",
      agentId: agent.id,
      appId: agent.apps.some((appName) => /moltbook/i.test(appName))
        ? "moltbook"
          : agent.apps.some((appName) => /news/i.test(appName))
            ? "news"
          : agent.apps.some((appName) => /crm/i.test(appName))
            ? "news"
            : "spino",
    };
  });

  const transportStations: SystemStation[] = [{
    id: "transport-collector-fleet",
    label: "Transport Collectors",
    layer: "agents" as const,
    status: agentOutputs.transportDropbox.updatedAt ? "healthy" as const : "unknown" as const,
    statusLabel: agentOutputs.transportDropbox.updatedAt ? "TRN" : "WTP",
    x: 0,
    y: 0,
    detail: `Five staggered low-load transport collectors patrol app/server summary boxes across a 24h cycle and deliver compact state to Baloss Core via ${agentOutputs.transportDropbox.path}.`,
    metric: agentOutputs.transportDropbox.updatedAt ? "5 active" : "parked",
    source: "Baloss transport output writer",
    repair: "Use the Transport Dropbox collector job controls to refresh these summaries.",
    controlKind: "agent" as const,
    agentId: "transport-collector-fleet",
    appId: "systemmap" as PocketFlowAppId,
    iconTag: "TRN",
    links: ["transport-memory-dropbox", "core"],
  }];

  const jobStations: SystemStation[] = jobs.map((job, index) => ({
    id: `job-${job.id}`,
    label: job.label,
    layer: "automation",
    status: jobStatus(job),
    statusLabel: jobStatusLabel(job),
    x: 95 + index * 150,
    y: 0,
    detail: job.lastMessage || `${job.kind} owned by ${job.owner}.`,
    metric: job.dailyAt || (job.everyMinutes ? `${job.everyMinutes}m` : job.status),
    source: "Baloss durable scheduler",
    repair: job.failureCount ? "Open Baloss Automation and inspect the last failure before re-enabling." : "No immediate repair recorded.",
    controlKind: "automation",
    jobId: job.id,
    lastRunAt: job.lastRunAt,
    nextRunAt: job.nextRunAt,
    appId: job.owner === "moltbook"
      ? "moltbook"
      : job.owner === "news"
        ? "news"
        : job.owner === "archive"
          ? "reader"
          : job.owner === "bigbrain"
            ? "reader"
            : "spino",
  }));

  const appHubIds = new Set(APP_HUB_DEFINITIONS.map((hub) => hub.appId));
  const appHubStations: SystemStation[] = APP_HUB_DEFINITIONS.map((hub) => {
    const app = POCKETFLOW_APP_TOOLS.find((item) => item.id === hub.appId);
    return {
      id: hub.id,
      label: hub.label,
      layer: "apps" as const,
      status: app ? appStatus(app, runtimeStats) : "unknown",
      x: 0,
      y: 0,
      detail: hub.detail,
      metric: hub.metric,
      source: hub.source,
      repair: "Open the app for work, or use this station as the monitoring hub for its collectors and archive routes.",
      controlKind: "app" as const,
      appId: hub.appId,
      appHub: true,
      iconTag: hub.iconTag,
      links: hub.links,
    };
  });

  const appStations: SystemStation[] = POCKETFLOW_APP_TOOLS.filter((app) => !appHubIds.has(app.id)).map((app, index) => ({
    id: `app-${app.id}`,
    label: app.label,
    layer: "apps",
    status: appStatus(app, runtimeStats),
    x: 95 + index * 126,
    y: 0,
    detail: compact(app.summary),
    metric: app.automatable ? "auto" : app.readable ? "read" : "view",
    source: "POCKETFLOW_APP_TOOLS registry",
    repair: "If this app gains new tools, add it to the app tool registry so Baloss Panel auto-picks it up.",
    controlKind: "app",
    appId: app.id,
  }));

  const externalStations: SystemStation[] = PUBLIC_SERVER_INVENTORY.map((service, index) => {
    const runtime = serverRuntime[service.id];
    const status = externalStatus(runtime?.health);
    const runtimeParts = [
      runtime?.message,
      runtime?.publicState ? `public ${runtime.publicState}` : "",
      runtime?.localState ? `local ${runtime.localState}` : "",
      runtime?.latencyMs ? `${runtime.latencyMs}ms` : "",
    ].filter(Boolean);
    return {
      id: `external-${service.id}`,
      label: service.label,
      layer: "external",
      status: service.url ? status : "unknown",
      x: 95 + index * 126,
      y: 0,
      detail: compact(runtimeParts.length ? `${service.description} ${runtimeParts.join(" | ")}.` : service.description, 180),
      metric: runtime?.checkedAt ? new Date(runtime.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : service.group,
      source: runtime?.source ? `public monitor memory: ${runtime.source}` : "public server inventory",
      repair: runtime?.needsAction || (service.url ? "Open this station when you need route details, functions or server-check context." : "Add the exact endpoint before live checks can run."),
      url: service.url,
      functions: service.functions,
      group: service.group,
      sensitive: service.sensitive,
      controlKind: "external",
    };
  });

  stations.push(...modelStations, ...memoryStations, ...agentStations, ...transportStations, ...jobStations, ...appHubStations, ...appStations, ...externalStations);
  const consolidatedStations = consolidateStations(stations);
  const laidOutStations = layoutStations(consolidatedStations);
  return {
    refreshedAt: new Date().toISOString(),
    runtimeStats,
    aetherStorage,
    files: files.length,
    builderProjects: builderProjects.length,
    dashboards: dashboards.length,
    indexDocs: indexState.documents.length,
    indexChunks: indexState.chunks.length,
    intelItems: intel.items.length,
    jobs,
    agentOutputs,
    archiveMaintenance,
    stations: laidOutStations,
    connections: buildConnections(laidOutStations),
    emapRegistry,
    emapRuntime,
  };
};

export default function SystemMapApp({ onNotify, onOpenApp }: SystemMapAppProps) {
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState("core");
  const [filter, setFilter] = useState<MapLayer | "all">("all");
  const [statusFilter, setStatusFilter] = useState<MapStatus | "all">("all");
  const [openMenu, setOpenMenu] = useState<EMapMenu | null>(null);
  const [selectedBlocks, setSelectedBlocks] = useState<EMapBlock[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [followActive, setFollowActive] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [devSimulation, setDevSimulation] = useState(false);
  const [farZoomKeyCollapsed, setFarZoomKeyCollapsed] = useState(true);
  const [sideRailCollapsed, setSideRailCollapsed] = useState(true);
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [selectedEMapEntityId, setSelectedEMapEntityId] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    actions: true,
    runs: true,
    telemetry: true,
    repair: true,
    children: true,
    log: false,
    raw: false,
  });
  const [controlLog, setControlLog] = useState<ControlLogEntry[]>(readControlLog);
  const [agentControls, setAgentControls] = useState<Record<string, AgentControlState>>(readAgentControls);
  const [pocketNotifications, setPocketNotifications] = useState(loadPocketNotifications);
  const [viewBox, setViewBox] = useState<CanvasViewBox>(OVERVIEW_VIEWBOX);
  const viewBoxRef = useRef<CanvasViewBox>(viewBox);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pointersRef = useRef<Map<number, CanvasPointer>>(new Map());
  const touchesRef = useRef<Map<number, CanvasPointer>>(new Map());
  const gestureRef = useRef<CanvasGesture | null>(null);
  const touchGestureRef = useRef<CanvasGesture | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingViewBoxRef = useRef<CanvasViewBox | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    viewBoxRef.current = viewBox;
  }, [viewBox]);

  useEffect(() => {
    const syncNotifications = () => setPocketNotifications(loadPocketNotifications());
    window.addEventListener("pocketflow:notifications-updated", syncNotifications);
    return () => window.removeEventListener("pocketflow:notifications-updated", syncNotifications);
  }, []);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSections((current) => ({ ...current, [section]: !current[section] }));
  };

  const recordControl = (station: SystemStation | undefined, action: string, result: string) => {
    if (!station) return;
    const entry: ControlLogEntry = {
      id: `control-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      stationId: station.id,
      label: station.label,
      action,
      result,
      at: new Date().toISOString(),
    };
    setControlLog((current) => {
      const next = [entry, ...current].slice(0, 80);
      writeControlLog(next);
      return next;
    });
  };

  const refresh = async (announce = false) => {
    setRefreshing(true);
    try {
      const next = await collectSnapshot();
      setSnapshot(next);
      if (announce) onNotify?.("Baloss Panel refreshed.", "success");
    } catch {
      onNotify?.("Baloss Panel could not refresh every source.", "warn");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 12_000);
    const onRefresh = () => {
      setAgentControls(readAgentControls());
      void refresh();
    };
    window.addEventListener("storage", onRefresh);
    window.addEventListener("focus", onRefresh);
    window.addEventListener("pocketflow:baloss-durable-jobs-updated", onRefresh);
    window.addEventListener("pocketflow:baloss-agent-outputs-updated", onRefresh);
    window.addEventListener("pocketflow:newsletter-health-updated", onRefresh);
    window.addEventListener("pocketflow:moltbook-updated", onRefresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", onRefresh);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("pocketflow:baloss-durable-jobs-updated", onRefresh);
      window.removeEventListener("pocketflow:baloss-agent-outputs-updated", onRefresh);
      window.removeEventListener("pocketflow:newsletter-health-updated", onRefresh);
      window.removeEventListener("pocketflow:moltbook-updated", onRefresh);
    };
  }, []);

  const selected = snapshot?.stations.find((station) => station.id === selectedId) || snapshot?.stations[0];
  const selectedJob = selected?.jobId ? snapshot?.jobs.find((job) => job.id === selected.jobId) : undefined;
  const selectedHubLayer = selected?.hub && selected.layer !== "core" ? selected.layer : null;
  const activeEMapTrains = recordValues<EMapTrain>(snapshot?.emapRuntime.activeTrains);
  const activeEMapAvatars = recordValues<EMapAvatarInstance>(snapshot?.emapRuntime.activeAvatars);
  const activeTrainKey = activeEMapTrains.map((train) => `${train.id}:${train.updatedAt}`).join("|");
  const search = searchQuery.trim().toLowerCase();
  const blockEntries = Object.entries(EMAP_BLOCK_LABELS) as [EMapBlock, string][];
  const zoomLevel = CANVAS_WIDTH / viewBox.width;
  const forcedDetail = selectedBlocks.length > 0 || Boolean(selectedEMapEntityId);
  const cityOutlineUnlocked = zoomLevel > 1.75 || forcedDetail;
  const cityBlocksUnlocked = zoomLevel > 2.75 || forcedDetail;
  const cityDetailsUnlocked = zoomLevel > 3.6 || (forcedDetail && zoomLevel > 2.25);
  const microDetailsUnlocked = zoomLevel > 4.35 || (forcedDetail && zoomLevel > 3.25);
  const detailsUnlocked = cityBlocksUnlocked;
  const showEMapInspectionLayer = microDetailsUnlocked;
  const showFineLabels = microDetailsUnlocked || zoomLevel > 4.8;
  const showParkingDetail = Boolean(selectedEMapEntityId) || selectedBlocks.length > 0 || zoomLevel > 5.1;
  const showPacketLabels = Boolean(selectedActivityId) || zoomLevel > 4.85;
  const viewportAreaRatio = (viewBox.width * viewBox.height) / (CANVAS_WIDTH * CANVAS_HEIGHT);
  const showDetailedTransport = cityDetailsUnlocked;
  const showMicroTransport = microDetailsUnlocked;
  const detailedConnectionLimit = showMicroTransport ? Math.min(40, Math.max(18, Math.round(15 / Math.max(0.34, viewportAreaRatio)))) : showDetailedTransport ? 16 : 12;
  const overviewMode = !detailsUnlocked && !selectedHubLayer && !search;
  const farZoomKeyEligible = zoomLevel <= 1.72 && selectedBlocks.length === 0;
  const showFarZoomKey = farZoomKeyEligible && !farZoomKeyCollapsed;
  const simulatedTrains = useMemo<EMapTrain[]>(() => {
    if (!DEV_SIMULATION_ENABLED || !devSimulation || !snapshot) return [];
    const now = Date.now();
    const routeValues = recordValues<EMapRoute>(snapshot.emapRuntime.routes);
    const pickRoute = (needle: string) => routeValues.find((route) => route.toStationId.includes(needle)) || routeValues[0];
    return [
      ["sim-builder", "shinkansen", "builder", "task"],
      ["sim-fixer", "steam", "security", "tool_call"],
      ["sim-monitor", "shinkansen", "server", "monitoring"],
      ["sim-memory", "cargo", "bigbrain", "memory"],
      ["sim-model", "shinkansen", "model", "model_call"],
    ].map(([id, trainType, needle, payload]) => {
      const route = pickRoute(String(needle));
      return {
        id,
        trainType: trainType as EMapTrain["trainType"],
        agentIds: [`dev-${needle}`],
        traceId: `trace-${id}`,
        routeId: route?.id || "dev-route",
        fromStationId: route?.fromStationId || "station-llboss-main-brain",
        toStationId: route?.toStationId || "station-llboss-main-brain",
        progress: 0,
        speed: id === "sim-fixer" ? 0.55 : 0.9,
        status: id === "sim-fixer" ? "monitoring" : "moving",
        payloadType: payload as EMapTrain["payloadType"],
        startedAt: now,
        updatedAt: now,
      };
    });
  }, [devSimulation, snapshot]);
  const displayTrains = [
    ...activeEMapTrains.filter((train) =>
      train.status === "moving" ||
      train.status === "monitoring" ||
      train.status === "carrying_payload" ||
      train.status === "blocked" ||
      train.status === "error" ||
      train.status === "departing" ||
      train.status === "arriving",
    ),
    ...simulatedTrains,
  ];
  const hubForTrain = (train: EMapTrain) => {
    const key = `${train.agentIds.join(" ")} ${train.payloadType} ${train.routeId}`.toLowerCase();
    if (key.includes("newsletter") || key.includes("news") || key.includes("moltbook") || key.includes("automation")) return "hub-automation";
    if (key.includes("memory") || key.includes("archive") || key.includes("bigbrain")) return "hub-memory";
    if (key.includes("server") || key.includes("relay")) return "hub-external";
    if (key.includes("model") || train.payloadType === "model_call") return "hub-model";
    if (key.includes("app") || key.includes("tool")) return "hub-apps";
    return "hub-agents";
  };
  const overviewLineForTrain = (train: EMapTrain) => {
    const hub = hubForTrain(train).replace("hub-", "");
    if (hub === "model") return "model";
    if (hub === "memory") return "memory";
    if (hub === "automation") return "automation";
    if (hub === "apps") return "apps";
    if (hub === "external") return "external";
    return "agents";
  };
  const selectedActivity = selectedActivityId ? displayTrains.find((train) => train.id === selectedActivityId) : undefined;
  const selectedEMapEntity = selectedEMapEntityId ? snapshot?.emapRuntime.entities[selectedEMapEntityId] : undefined;
  const selectedEMapStation = selectedEMapEntity?.stationId ? snapshot?.emapRuntime.stations[selectedEMapEntity.stationId] : undefined;
  const selectedOutputRecords = outputRecordsForSelection(selected, selectedEMapEntity, snapshot?.agentOutputs);
  const selectedEMapEvents = selectedEMapEntityId && snapshot
    ? snapshot.emapRuntime.recentEvents.filter((event) => event.agentId === selectedEMapEntityId || event.targetEntityId === selectedEMapEntityId).slice(0, 8)
    : [];
  const selectedAgentControl = selectedEMapEntity
    ? agentControls[selectedEMapEntity.id] || defaultAgentControl(selectedEMapEntity.id, selectedEMapEntity)
    : undefined;
  const selectedEntityControllable = Boolean(selectedEMapEntity && (selectedEMapEntity.id.startsWith("agent-") || selectedEMapEntity.type === "monitor_agent"));
  const jobById = useMemo(() => new Map((snapshot?.jobs || []).map((job) => [job.id, job])), [snapshot?.jobs]);
  const selectedSecurityInspector = Boolean(
    selectedEMapEntity &&
      (selectedEMapEntity.id.includes("malware") ||
        selectedEMapEntity.id.includes("security") ||
        selectedEMapEntity.lineId === "security" ||
        selectedEMapEntity.type === "security"),
  );
  const selectedSecurityFindings = selectedSecurityInspector ? snapshot?.archiveMaintenance.threatQueue || [] : [];
  const selectedSecurityRecentLog = selectedSecurityInspector
    ? snapshot?.archiveMaintenance.deletedLog.filter((entry) => ["threat", "quarantine", "block", "override"].includes(entry.action)).slice(0, 6) || []
    : [];
  const emapEntityBlocks = useMemo(() => {
    const blocks = new Map<string, EMapBlock[]>();
    if (!snapshot) return blocks;
    snapshot.emapRegistry.entities.forEach((entity) => blocks.set(entity.id, getBlocksForEntity(entity)));
    recordValues<EMapEntity>(snapshot.emapRuntime.entities).forEach((entity) => blocks.set(entity.id, getBlocksForEntity(entity)));
    return blocks;
  }, [snapshot]);

  const emapStationBlocks = (stationId: string) => {
    const station = snapshot?.emapRuntime.stations[stationId];
    if (!station) return [];
    return emapEntityBlocks.get(station.entityId) || [];
  };

  const emapStationMatchesBlocks = (stationId: string) =>
    selectedBlocks.length === 0 || matchesSelectedBlocks(emapStationBlocks(stationId), selectedBlocks);

  const emapRouteMatchesBlocks = (route: EMapRoute) =>
    selectedBlocks.length === 0 || emapStationMatchesBlocks(route.fromStationId) || emapStationMatchesBlocks(route.toStationId);

  const emapRouteVisible = (route: EMapRoute) => {
    if (!snapshot) return false;
    const from = snapshot.emapRuntime.stations[route.fromStationId];
    const to = snapshot.emapRuntime.stations[route.toStationId];
    const fromEntity = from ? snapshot.emapRuntime.entities[from.entityId] : undefined;
    const toEntity = to ? snapshot.emapRuntime.entities[to.entityId] : undefined;
    const touchesYard = isYardEMapStation(from) || isYardEMapStation(to);
    const touchesDetailOnly = isDetailOnlyEMapEntity(fromEntity) || isDetailOnlyEMapEntity(toEntity);
    if ((touchesYard || touchesDetailOnly) && !showParkingDetail && !selectedEMapEntityId && !selectedBlocks.length) return false;
    return emapRouteMatchesBlocks(route);
  };

  const trainMatchesBlocks = (train: EMapTrain) => {
    const route = snapshot?.emapRuntime.routes[train.routeId];
    const from = route ? snapshot?.emapRuntime.stations[route.fromStationId] : snapshot?.emapRuntime.stations[train.fromStationId];
    const to = route ? snapshot?.emapRuntime.stations[route.toStationId] : snapshot?.emapRuntime.stations[train.toStationId];
    if ((isYardEMapStation(from) || isYardEMapStation(to)) && !showParkingDetail && !selectedEMapEntityId && !selectedBlocks.length) return false;
    if (selectedBlocks.length === 0) return true;
    const blocks = [
      ...getBlocksForPayload(train.payloadType),
      ...train.agentIds.flatMap((agentId) => emapEntityBlocks.get(agentId) || []),
      ...emapStationBlocks(train.fromStationId),
      ...emapStationBlocks(train.toStationId),
    ];
    if (!trainIsStationary(train) && train.status !== "idle" && train.status !== "offline") blocks.push("active_tasks");
    if (trainIsError(train)) blocks.push("errors");
    return matchesSelectedBlocks([...new Set(blocks)], selectedBlocks);
  };
  const overviewActivityPulses = overviewMode
    ? displayTrains.filter(trainMatchesBlocks).slice(0, 12).map((train, index) => {
        const line = overviewMetroLines.find((item) => item.id === overviewLineForTrain(train)) || overviewMetroLines[0];
        const segment = Math.min(line.points.length - 2, Math.max(0, index % Math.max(1, line.points.length - 1)));
        const from = line.points[segment];
        const to = line.points[segment + 1] || from;
        const t = 0.24 + ((index * 0.19) % 0.56);
        return {
          train,
          color: line.color,
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t,
        };
      })
    : [];

  const avatarMatchesBlocks = (avatar: EMapAvatarInstance) => {
    if (selectedBlocks.length === 0) return true;
    const blocks = [
      ...(emapEntityBlocks.get(avatar.agentId) || []),
      ...(avatar.stationId ? emapStationBlocks(avatar.stationId) : []),
    ];
    if (avatar.status !== "idle" && avatar.status !== "offline") blocks.push("active_tasks");
    if (avatar.status === "error" || avatar.status === "offline") blocks.push("errors");
    return matchesSelectedBlocks([...new Set(blocks)], selectedBlocks);
  };

  const visibleStations = useMemo(
    () =>
      snapshot?.stations.filter((station) => {
        const layerVisible = filter === "all" || station.layer === "core" || station.layer === filter;
        const statusVisible =
          statusFilter === "all" ||
          (statusFilter === "warning" ? isStationNeedsCheck(station) : station.status === statusFilter) ||
          station.layer === "core" ||
          station.hub;
        const searchVisible = !search || `${station.label} ${station.detail} ${station.source}`.toLowerCase().includes(search);
        const activeVisible =
          !showOnlyActive ||
          station.status === "running" ||
          station.status === "blocked" ||
          isStationNeedsCheck(station) ||
          station.id === selectedId ||
          station.layer === "core" ||
          station.hub;
        const blockVisible = stationMatchesBlocks(station, selectedBlocks);
        const detailVisible = station.layer === "core"
          || station.hub
          || station.appHub
          || station.id === selectedId
          || Boolean(search)
          || selectedBlocks.length > 0
          || station.status === "blocked"
          || isStationNeedsCheck(station)
          || zoomLevel > 2.25
          || selectedHubLayer === station.layer;
        return layerVisible && statusVisible && searchVisible && activeVisible && blockVisible && detailVisible;
      }) || [],
    [filter, search, selectedBlocks, selectedHubLayer, selectedId, showOnlyActive, snapshot, statusFilter, zoomLevel],
  );

  const updateJob = (station: SystemStation | undefined, updater: (job: BalossDurableJob) => BalossDurableJob, action: string, result: string) => {
    if (!station?.jobId) return;
    const jobs = loadBalossDurableJobs();
    const target = jobs.find((job) => job.id === station.jobId);
    if (!target) {
      onNotify?.("Automation job was not found in the scheduler.", "warn");
      return;
    }
    saveBalossDurableJobs(jobs.map((job) => (job.id === station.jobId ? updater(job) : job)));
    recordControl(station, action, result);
    onNotify?.(result, "success");
    void refresh();
  };

  const pauseJob = (station: SystemStation | undefined) => {
    updateJob(
      station,
      (job) => ({ ...job, enabled: false, status: "paused", lastMessage: "Paused from Baloss Panel." }),
      "pause",
      `${station?.label || "Automation"} paused.`,
    );
  };

  const resumeJob = (station: SystemStation | undefined) => {
    updateJob(
      station,
      (job) => {
        const resumed = { ...job, enabled: true, status: "queued" as const, failureCount: 0, lastMessage: "Resumed from Baloss Panel." };
        return { ...resumed, nextRunAt: computeNextRun(resumed).toISOString() };
      },
      "resume",
      `${station?.label || "Automation"} resumed.`,
    );
  };

  const runJobNow = (station: SystemStation | undefined) => {
    updateJob(
      station,
      (job) => ({
        ...job,
        enabled: true,
        status: "queued",
        nextRunAt: new Date(Date.now() - 1000).toISOString(),
        lastMessage: "Queued for immediate run from Baloss Panel.",
      }),
      "run now",
      `${station?.label || "Automation"} queued for immediate run.`,
    );
    dispatchAutomationWake(`system map run now${station?.jobId ? ` ${station.jobId}` : ""}`, station?.jobId);
  };

  const restartJob = (station: SystemStation | undefined) => {
    updateJob(
      station,
      (job) => ({
        ...job,
        enabled: true,
        status: "queued",
        failureCount: 0,
        nextRunAt: new Date(Date.now() - 1000).toISOString(),
        lastMessage: "Restart requested from Baloss Panel.",
      }),
      "restart",
      `${station?.label || "Automation"} restarted and queued.`,
    );
    dispatchAutomationWake(`system map restart${station?.jobId ? ` ${station.jobId}` : ""}`, station?.jobId);
  };

  const resetJobErrors = (station: SystemStation | undefined) => {
    updateJob(
      station,
      (job) => ({ ...job, failureCount: 0, status: job.enabled ? "queued" : "paused", lastMessage: "Error counter reset from Baloss Panel." }),
      "reset errors",
      `${station?.label || "Automation"} errors reset.`,
    );
  };

  const requestExternalRecheck = (station: SystemStation | undefined) => {
    if (!station?.id.startsWith("external-")) return;
    const serviceId = station.id.replace(/^external-/, "");
    const runtime = loadPublicServerRuntime();
    runtime[serviceId] = {
      ...runtime[serviceId],
      health: "checking",
      checkedAt: new Date().toISOString(),
      message: "Manual recheck requested from Baloss Panel. Waiting for Public Monitor memory refresh.",
      source: "system-map",
    };
    localStorage.setItem(PUBLIC_SERVER_RUNTIME_STORAGE_KEY, JSON.stringify(runtime));
    window.dispatchEvent(new StorageEvent("storage", { key: PUBLIC_SERVER_RUNTIME_STORAGE_KEY }));
    recordControl(station, "request recheck", "External server recheck marked as checking.");
    onNotify?.("Server station marked for recheck.", "info");
    void refresh();
  };

  const openStationApp = (station: SystemStation | undefined) => {
    if (!station?.appId) return;
    onOpenApp?.(station.appId);
    recordControl(station, "open app", `Opened ${station.appId}.`);
  };

  const recordEntityControl = (entity: EMapEntity | undefined, action: string, result: string) => {
    if (!entity) return;
    const entry: ControlLogEntry = {
      id: `control-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      stationId: entity.stationId || entity.id,
      label: entity.name,
      action,
      result,
      at: new Date().toISOString(),
    };
    setControlLog((current) => {
      const next = [entry, ...current].slice(0, 80);
      writeControlLog(next);
      return next;
    });
  };

  const updateAgentControl = (entity: EMapEntity | undefined, patch: Partial<AgentControlState>, action: string, result: string) => {
    if (!entity) return;
    const now = new Date().toISOString();
    const nextControl: AgentControlState = {
      ...defaultAgentControl(entity.id, entity),
      ...agentControls[entity.id],
      ...patch,
      agentId: entity.id,
      lastAction: action,
      lastControlAt: now,
    };
    const nextControls = { ...agentControls, [entity.id]: nextControl };
    setAgentControls(nextControls);
    writeAgentControls(nextControls);
    recordEntityControl(entity, action, result);
    window.dispatchEvent(new CustomEvent("pocketflow:emap-agent-control", { detail: nextControl }));
    onNotify?.(result, "success");
    void refresh();
  };

  const startSelectedAgent = () => {
    updateAgentControl(
      selectedEMapEntity,
      { enabled: true, runtimeMode: selectedAgentControl?.runtimeMode === "paused" ? "auto" : selectedAgentControl?.runtimeMode || "auto", cadence: selectedAgentControl?.cadence === "manual" ? "auto" : selectedAgentControl?.cadence || "auto" },
      "start agent",
      `${selectedEMapEntity?.name || "Agent"} started from Baloss Panel.`,
    );
  };

  const pauseSelectedAgent = () => {
    updateAgentControl(
      selectedEMapEntity,
      { enabled: false, runtimeMode: "paused", cadence: "manual" },
      "pause agent",
      `${selectedEMapEntity?.name || "Agent"} paused from Baloss Panel.`,
    );
  };

  const restartSelectedAgent = () => {
    updateAgentControl(
      selectedEMapEntity,
      {
        enabled: true,
        runtimeMode: selectedAgentControl?.runtimeMode === "paused" ? "auto" : selectedAgentControl?.runtimeMode || "auto",
        cadence: selectedAgentControl?.cadence === "manual" ? "auto" : selectedAgentControl?.cadence || "auto",
        restartCount: (selectedAgentControl?.restartCount || 0) + 1,
      },
      "restart agent",
      `${selectedEMapEntity?.name || "Agent"} restarted from Baloss Panel.`,
    );
  };

  const setSelectedAgentParameter = <K extends keyof AgentControlState>(key: K, value: AgentControlState[K]) => {
    updateAgentControl(
      selectedEMapEntity,
      { [key]: value } as Partial<AgentControlState>,
      `set ${String(key)}`,
      `${selectedEMapEntity?.name || "Agent"} ${String(key)} set to ${String(value)}.`,
    );
  };

  const visibleIds = new Set(visibleStations.map((station) => station.id));
  const stationById = new Map<string, SystemStation>(
    (snapshot?.stations || []).map((station): [string, SystemStation] => [station.id, station]),
  );
  const candidateConnections = snapshot?.connections.filter((connection) => {
    if (!visibleIds.has(connection.from) || !visibleIds.has(connection.to)) return false;
    const from = stationById.get(connection.from);
    const to = stationById.get(connection.to);
    if (!from || !to) return false;
    const artery = from.id === "core" || to.id === "core" || (from.hub && to.hub);
    if (artery) return true;
    const selectedConnection = from.id === selectedId || to.id === selectedId;
    if (selectedConnection || search || selectedBlocks.length > 0) return true;
    const belongsToOpenHub = Boolean(selectedHubLayer && (from.layer === selectedHubLayer || to.layer === selectedHubLayer));
    if (belongsToOpenHub) return true;
    return zoomLevel > 2.55;
  })
    .sort((a, b) => {
      const aFrom = stationById.get(a.from);
      const aTo = stationById.get(a.to);
      const bFrom = stationById.get(b.from);
      const bTo = stationById.get(b.to);
      const rank = (connection: SystemConnection, from?: SystemStation, to?: SystemStation) => {
        if (connection.status === "blocked" || connection.status === "warning") return 0;
        if (from?.id === selectedId || to?.id === selectedId) return 1;
        if (from?.id === "core" || to?.id === "core") return 2;
        if (from?.hub && to?.hub) return 3;
        if (selectedHubLayer && (from?.layer === selectedHubLayer || to?.layer === selectedHubLayer)) return 4;
        return 5;
      };
      return rank(a, aFrom, aTo) - rank(b, bFrom, bTo);
    }) || [];
  const issueConnections = candidateConnections.filter((connection) => connection.status === "blocked" || connection.status === "warning");
  const visibleConnections = [
    ...issueConnections,
    ...candidateConnections.filter((connection) => connection.status !== "blocked" && connection.status !== "warning"),
  ].slice(0, Math.max(detailedConnectionLimit, issueConnections.length));
  const proofStations = visibleStations
    .filter((station) => {
      const job = station.jobId ? jobById.get(station.jobId) : undefined;
      return station.status === "healthy" && (isRecentSuccess(job) || station.hub || station.appHub);
    })
    .slice(0, 28);
  const proofStationIds = new Set(proofStations.map((station) => station.id));
  const retryStations = visibleStations
    .filter((station) => {
      const job = station.jobId ? jobById.get(station.jobId) : undefined;
      return station.status === "blocked" || Boolean(job && (job.status === "failed" || job.failureCount > 0));
    })
    .slice(0, 18);
  const retryStationIds = new Set(retryStations.map((station) => station.id));
  const dataPacketConnections = visibleConnections
    .filter((connection) => connection.status === "running" || connection.status === "healthy" || connection.status === "warning")
    .slice(0, !showDetailedTransport ? 0 : showPacketLabels ? 12 : 7);
  const parkingYards = useMemo(() => {
    if (!snapshot) return [];
    const entities = recordValues<EMapEntity>(snapshot.emapRuntime.entities);
    const avatars = recordValues<EMapAvatarInstance>(snapshot.emapRuntime.activeAvatars);
    return recordValues<EMapStation>(snapshot.emapRuntime.stations)
      .filter((station) => station.neighborhood?.includes("yard"))
      .map((station) => {
        const yardEntity = snapshot.emapRuntime.entities[station.entityId];
        const parkedAvatars = avatars.filter((avatar) => avatar.stationId === station.id).length;
        const metadataNeedle = station.neighborhood?.includes("automation")
          ? "automation"
          : station.neighborhood?.includes("planning")
            ? "planning"
            : "agent";
        const parkedEntities = entities.filter((entity) => {
          const lot = String(entity.metadata?.parkingLot || "").toLowerCase();
          return entity.stationId === station.id || lot.includes(metadataNeedle) || (metadataNeedle === "planning" && Boolean(entity.metadata?.planned));
        }).length;
        return {
          station,
          label: yardEntity?.name || station.name,
          count: Math.max(parkedAvatars, parkedEntities),
          tone: station.neighborhood?.includes("planning") ? "#f59e0b" : station.neighborhood?.includes("automation") ? "#fb923c" : "#64748b",
        };
      });
  }, [snapshot]);
  const broken = snapshot?.stations.filter((station) => station.status === "blocked").length || 0;
  const needsCheck = snapshot?.stations.filter(isStationNeedsCheck).length || 0;
  const runtimeSlow = [
    snapshot?.runtimeStats.memoryPressure === "high" || snapshot?.runtimeStats.memoryPressure === "critical",
    Boolean(snapshot?.runtimeStats.queueDepth && snapshot.runtimeStats.queueDepth > 2),
    Boolean(snapshot?.runtimeStats.generationActive && snapshot?.runtimeStats.tokensPerSecond && snapshot.runtimeStats.tokensPerSecond < 2),
  ].filter(Boolean).length;
  const running = snapshot?.stations.filter((station) => station.status === "running").length || 0;
  const healthy = snapshot?.stations.filter((station) => station.status === "healthy").length || 0;
  const unknown = snapshot?.stations.filter((station) => station.status === "unknown").length || 0;
  const unreadNotifications = pocketNotifications.filter((item) => !item.read).length;
  const focusedStations = useMemo(
    () =>
      snapshot?.stations.filter((station) => {
        const layerVisible = filter === "all" || station.layer === "core" || station.layer === filter;
        const statusVisible = statusFilter === "all" || (statusFilter === "warning" ? isStationNeedsCheck(station) : station.status === statusFilter);
        const searchVisible = !search || `${station.label} ${station.detail} ${station.source}`.toLowerCase().includes(search);
        const activeVisible = !showOnlyActive || station.status === "running" || station.status === "blocked" || isStationNeedsCheck(station);
        const blockVisible = stationMatchesBlocks(station, selectedBlocks);
        return station.layer !== "core" && !station.hub && layerVisible && statusVisible && searchVisible && activeVisible && blockVisible;
      }) || [],
    [filter, search, selectedBlocks, showOnlyActive, snapshot, statusFilter],
  );
  const selectedChildren = useMemo(() => {
    if (!selected || !snapshot) return [];
    if (selected.id === "core") return snapshot.stations.filter((station) => station.hub && station.layer !== "core");
    if (selected.hub && selected.layer !== "core") {
      return snapshot.stations.filter((station) => station.layer === selected.layer && !station.hub);
    }
    return snapshot.connections
      .filter((connection) => connection.from === selected.id || connection.to === selected.id)
      .map((connection) => snapshot.stations.find((station) => station.id === (connection.from === selected.id ? connection.to : connection.from)))
      .filter(Boolean) as SystemStation[];
  }, [selected, snapshot]);
  const relatedLog = useMemo(
    () => selected ? controlLog.filter((entry) => entry.stationId === selected.id).slice(0, 8) : controlLog.slice(0, 8),
    [controlLog, selected],
  );
  const mapQaReport = useMemo(() => {
    const offLandStations = visibleStations.filter((station) => !isFootprintOnZoneLand(stationWorldTheme(station), station));
    const visibleConnectionIds = new Set(visibleConnections.map((connection) => connection.id));
    const hiddenIssueRoutes = candidateConnections.filter(
      (connection) => (connection.status === "blocked" || connection.status === "warning") && !visibleConnectionIds.has(connection.id),
    );
    const score = Math.max(0, 100 - offLandStations.length * 12 - hiddenIssueRoutes.length * 7 - Math.max(0, visibleConnections.length - detailedConnectionLimit) * 2);
    return {
      score,
      offLandStations: offLandStations.length,
      hiddenIssueRoutes: hiddenIssueRoutes.length,
      visibleRoutes: visibleConnections.length,
    };
  }, [candidateConnections, detailedConnectionLimit, visibleConnections, visibleStations]);

  const SectionButton = ({ id, label }: { id: string; label: string }) => (
    <button
      type="button"
      onClick={() => toggleSection(id)}
      className="flex w-full items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left"
    >
      <span className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#8dffb0]">{label}</span>
      {expandedSections[id] ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
    </button>
  );

  const zoom = (factor: number) => {
    setViewBox((current) => {
      const nextWidth = Math.min(CANVAS_WIDTH, Math.max(420, current.width * factor));
      const nextHeight = Math.min(CANVAS_HEIGHT, Math.max(320, current.height * factor));
      return clampViewBox({
        x: Math.max(0, Math.min(CANVAS_WIDTH - nextWidth, current.x + (current.width - nextWidth) / 2)),
        y: Math.max(0, Math.min(CANVAS_HEIGHT - nextHeight, current.y + (current.height - nextHeight) / 2)),
        width: nextWidth,
        height: nextHeight,
      });
    });
  };

  const resetView = () => {
    setViewBox(OVERVIEW_VIEWBOX);
  };

  const fitToPoints = (points: Array<{ x: number; y: number }>, padding = 140) => {
    if (!points.length) {
      resetView();
      return;
    }
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    const minY = Math.min(...points.map((point) => point.y));
    const maxY = Math.max(...points.map((point) => point.y));
    const width = Math.min(CANVAS_WIDTH, Math.max(420, maxX - minX + padding * 2));
    const height = Math.min(CANVAS_HEIGHT, Math.max(320, maxY - minY + padding * 2));
    setViewBox(clampViewBox({
      x: Math.max(0, Math.min(CANVAS_WIDTH - width, minX - padding)),
      y: Math.max(0, Math.min(CANVAS_HEIGHT - height, minY - padding)),
      width,
      height,
    }));
  };

  const fitVisibleMap = () => {
    const stationPoints = visibleStations.map((station) => ({ x: station.x, y: station.y }));
    const emapPoints = snapshot
      ? recordValues<EMapStation>(snapshot.emapRuntime.stations)
          .filter((station) => emapStationMatchesBlocks(station.id))
          .map((station) => ({ x: station.x, y: station.y }))
      : [];
    fitToPoints([...stationPoints, ...emapPoints], 620);
  };

  const selectStation = (station: SystemStation) => {
    setSelectedId(station.id);
    setSelectedActivityId("");
    setSelectedEMapEntityId("");
    setDetailOpen(true);
    setOpenMenu(null);
    if (station.hub && station.layer !== "core" && snapshot) {
      const branchPoints = snapshot.stations
        .filter((item) => item.id === station.id || (item.layer === station.layer && !item.hub))
        .map((item) => ({ x: item.x, y: item.y }));
      fitToPoints(branchPoints, 520);
    }
  };

  const selectEMapEntity = (entityId: string, activityId = "") => {
    setSelectedEMapEntityId(entityId);
    setSelectedActivityId(activityId);
    setDetailOpen(true);
    setOpenMenu(null);
  };

  const selectTrain = (train: EMapTrain) => {
    const agentId = train.agentIds.find((id) => snapshot?.emapRuntime.entities[id]) || train.agentIds[0] || "";
    if (agentId) {
      selectEMapEntity(agentId, train.id);
      return;
    }
    setSelectedActivityId(train.id);
    setDetailOpen(true);
    setOpenMenu(null);
  };

  const handleTouchSelect = (event: React.TouchEvent<SVGGElement>, action: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    action();
  };

  const stopRailPointer = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const handleRailTap = (event: React.MouseEvent<HTMLButtonElement>, action: () => void) => {
    event.preventDefault();
    event.stopPropagation();
    action();
  };

  const toggleBlock = (block: EMapBlock) => {
    setSelectedBlocks((current) => (current.includes(block) ? current.filter((item) => item !== block) : [...current, block]));
  };

  const scheduleViewBox = (nextBox: CanvasViewBox) => {
    const next = clampViewBox(nextBox);
    pendingViewBoxRef.current = next;
    viewBoxRef.current = next;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const pending = pendingViewBoxRef.current;
      if (!pending) return;
      pendingViewBoxRef.current = null;
      setViewBox(pending);
    });
  };

  useEffect(() => {
    if (!followActive || !snapshot || !displayTrains.length) return;
    const train = displayTrains[0];
    const from = snapshot.emapRuntime.stations[train.fromStationId];
    const to = snapshot.emapRuntime.stations[train.toStationId];
    if (!from || !to) return;
    const x = Math.max(0, Math.min(CANVAS_WIDTH - 520, (from.x + to.x) / 2 - 260));
    const y = Math.max(0, Math.min(CANVAS_HEIGHT - 380, (from.y + to.y) / 2 - 190));
    setViewBox({ x, y, width: 520, height: 380 });
  }, [activeTrainKey, devSimulation, followActive, snapshot]);

  const handleCanvasPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "touch") return;
    event.preventDefault();
    const svg = event.currentTarget;
    pointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    try {
      svg.setPointerCapture(event.pointerId);
    } catch {
      // Android WebView can reject capture during fast multi-touch transitions.
    }
    const pointers = [...pointersRef.current.entries()];
    if (pointers.length >= 2) {
      const first = pointers[0][1];
      const second = pointers[1][1];
      const center = pointerCenter(first, second);
      gestureRef.current = {
        mode: "pinch",
        initialDistance: Math.max(24, pointerDistance(first, second)),
        initialCenter: center,
        initialCenterSvg: screenPointToSvg(svg, center, viewBoxRef.current),
        viewBox: viewBoxRef.current,
      };
      return;
    }
    gestureRef.current = { mode: "pan", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, viewBox: viewBoxRef.current };
  };

  const handleCanvasPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "touch") return;
    if (!pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();
    pointersRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    const gesture = gestureRef.current;
    if (!gesture) return;
    if (pointersRef.current.size >= 2) {
      const pointers = [...pointersRef.current.values()];
      const first = pointers[0];
      const second = pointers[1];
      const center = pointerCenter(first, second);
      const distance = Math.max(24, pointerDistance(first, second));
      const activePinch = gesture.mode === "pinch"
        ? gesture
        : {
            mode: "pinch" as const,
            initialDistance: distance,
            initialCenter: center,
            initialCenterSvg: screenPointToSvg(event.currentTarget, center, viewBoxRef.current),
            viewBox: viewBoxRef.current,
          };
      gestureRef.current = activePinch;
      const rect = event.currentTarget.getBoundingClientRect();
      const scale = activePinch.initialDistance / distance;
      const nextWidth = Math.min(CANVAS_WIDTH, Math.max(360, activePinch.viewBox.width * scale));
      const nextHeight = Math.min(CANVAS_HEIGHT, Math.max(260, activePinch.viewBox.height * scale));
      const centerFractionX = (center.clientX - rect.left) / rect.width;
      const centerFractionY = (center.clientY - rect.top) / rect.height;
      scheduleViewBox({
        x: activePinch.initialCenterSvg.x - nextWidth * centerFractionX,
        y: activePinch.initialCenterSvg.y - nextHeight * centerFractionY,
        width: nextWidth,
        height: nextHeight,
      });
      return;
    }
    if (gesture.mode !== "pan" || gesture.pointerId !== event.pointerId) return;
    const dx = ((event.clientX - gesture.startX) / event.currentTarget.clientWidth) * gesture.viewBox.width;
    const dy = ((event.clientY - gesture.startY) / event.currentTarget.clientHeight) * gesture.viewBox.height;
    scheduleViewBox({
      x: gesture.viewBox.x - dx,
      y: gesture.viewBox.y - dy,
      width: gesture.viewBox.width,
      height: gesture.viewBox.height,
    });
  };

  const stopCanvasGesture = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.pointerType === "touch") return;
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 1) {
      const [remaining] = [...pointersRef.current.entries()];
      gestureRef.current = {
        mode: "pan",
        pointerId: remaining[0],
        startX: remaining[1].clientX,
        startY: remaining[1].clientY,
        viewBox: viewBoxRef.current,
      };
      return;
    }
    if (pointersRef.current.size === 0) gestureRef.current = null;
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const syncTouches = (touches: TouchList) => {
      touchesRef.current.clear();
      Array.from(touches).forEach((touch) => {
        touchesRef.current.set(touch.identifier, { clientX: touch.clientX, clientY: touch.clientY });
      });
      return [...touchesRef.current.entries()];
    };
    const startPan = (entry: [number, CanvasPointer]) => {
      touchGestureRef.current = {
        mode: "pan",
        pointerId: entry[0],
        startX: entry[1].clientX,
        startY: entry[1].clientY,
        viewBox: viewBoxRef.current,
      };
    };
    const startPinch = (first: CanvasPointer, second: CanvasPointer) => {
      const center = pointerCenter(first, second);
      touchGestureRef.current = {
        mode: "pinch",
        initialDistance: Math.max(24, pointerDistance(first, second)),
        initialCenter: center,
        initialCenterSvg: screenPointToSvg(svg, center, viewBoxRef.current),
        viewBox: viewBoxRef.current,
      };
    };
    const onTouchStart = (event: TouchEvent) => {
      if (!event.touches.length) return;
      event.preventDefault();
      const touches = syncTouches(event.touches);
      if (touches.length >= 2) {
        startPinch(touches[0][1], touches[1][1]);
        return;
      }
      startPan(touches[0]);
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!event.touches.length) return;
      event.preventDefault();
      const touches = syncTouches(event.touches);
      const gesture = touchGestureRef.current;
      if (touches.length >= 2) {
        const first = touches[0][1];
        const second = touches[1][1];
        if (!gesture || gesture.mode !== "pinch") startPinch(first, second);
        const active = touchGestureRef.current;
        if (!active || active.mode !== "pinch") return;
        const center = pointerCenter(first, second);
        const distance = Math.max(24, pointerDistance(first, second));
        const rect = svg.getBoundingClientRect();
        const scale = active.initialDistance / distance;
        const nextWidth = Math.min(CANVAS_WIDTH, Math.max(360, active.viewBox.width * scale));
        const nextHeight = Math.min(CANVAS_HEIGHT, Math.max(260, active.viewBox.height * scale));
        const centerFractionX = (center.clientX - rect.left) / rect.width;
        const centerFractionY = (center.clientY - rect.top) / rect.height;
        scheduleViewBox({
          x: active.initialCenterSvg.x - nextWidth * centerFractionX,
          y: active.initialCenterSvg.y - nextHeight * centerFractionY,
          width: nextWidth,
          height: nextHeight,
        });
        return;
      }
      if (!gesture || gesture.mode !== "pan") {
        startPan(touches[0]);
        return;
      }
      const point = touches[0][1];
      const dx = ((point.clientX - gesture.startX) / svg.clientWidth) * gesture.viewBox.width;
      const dy = ((point.clientY - gesture.startY) / svg.clientHeight) * gesture.viewBox.height;
      scheduleViewBox({
        x: gesture.viewBox.x - dx,
        y: gesture.viewBox.y - dy,
        width: gesture.viewBox.width,
        height: gesture.viewBox.height,
      });
    };
    const onTouchEnd = (event: TouchEvent) => {
      event.preventDefault();
      const touches = syncTouches(event.touches);
      if (touches.length >= 2) {
        startPinch(touches[0][1], touches[1][1]);
        return;
      }
      if (touches.length === 1) {
        startPan(touches[0]);
        return;
      }
      touchGestureRef.current = null;
    };
    svg.addEventListener("touchstart", onTouchStart, { passive: false });
    svg.addEventListener("touchmove", onTouchMove, { passive: false });
    svg.addEventListener("touchend", onTouchEnd, { passive: false });
    svg.addEventListener("touchcancel", onTouchEnd, { passive: false });
    return () => {
      svg.removeEventListener("touchstart", onTouchStart);
      svg.removeEventListener("touchmove", onTouchMove);
      svg.removeEventListener("touchend", onTouchEnd);
      svg.removeEventListener("touchcancel", onTouchEnd);
    };
  });

  const copyState = async () => {
    if (!snapshot) return;
    const text = [
      `PocketFlow Baloss Panel ${new Date(snapshot.refreshedAt).toLocaleString()}`,
      `Stations: ${snapshot.stations.length}. Healthy ${healthy}, running ${running}, check ${needsCheck}, blocked ${broken}.`,
      `Runtime slow signals: ${runtimeSlow}.`,
      `Model: ${snapshot.runtimeStats.loadedModelId || snapshot.runtimeStats.backend || "unknown"} / ${snapshot.runtimeStats.health || "unknown"}`,
      `Memory: ${snapshot.files} files, ${snapshot.builderProjects} builder projects, ${snapshot.dashboards} dashboards, ${snapshot.indexChunks} index chunks.`,
      "",
      "Attention:",
      ...snapshot.stations
        .filter((station) => station.status === "blocked" || isStationNeedsCheck(station) || station.status === "unknown")
        .slice(0, 20)
        .map((station) => `- ${station.label}: ${stationStatusLabel(station)}. ${station.detail} Repair: ${station.repair}`),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    onNotify?.("Baloss Panel state copied.", "success");
  };

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden bg-[#7dd3fc] text-slate-950">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        data-map-qa-score={mapQaReport.score}
        data-map-qa-off-land={mapQaReport.offLandStations}
        data-map-qa-hidden-issues={mapQaReport.hiddenIssueRoutes}
        data-map-qa-visible-routes={mapQaReport.visibleRoutes}
        className="absolute inset-0 h-full w-full touch-none select-none overscroll-none bg-[#7dd3fc]"
        style={{ touchAction: "none", overscrollBehavior: "none", WebkitUserSelect: "none" }}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={stopCanvasGesture}
        onPointerCancel={stopCanvasGesture}
        onWheel={(event) => {
          event.preventDefault();
          zoom(event.deltaY > 0 ? 1.12 : 0.88);
        }}
      >
        <defs>
          <pattern id="system-map-grid" width="56" height="56" patternUnits="userSpaceOnUse">
            <path d="M 56 0 L 0 0 0 56" fill="none" stroke="rgba(226,232,240,0.06)" strokeWidth="1" />
          </pattern>
          <pattern id="world-map-grass" width="64" height="64" patternUnits="userSpaceOnUse">
            <rect width="64" height="64" fill="transparent" />
            <rect x="8" y="10" width="10" height="10" fill="rgba(22,101,52,0.30)" />
            <rect x="18" y="20" width="8" height="16" fill="rgba(22,101,52,0.22)" />
            <rect x="38" y="24" width="11" height="11" fill="rgba(22,163,74,0.28)" />
            <rect x="50" y="44" width="10" height="10" fill="rgba(132,204,22,0.30)" />
            <rect x="26" y="48" width="8" height="16" fill="rgba(21,128,61,0.22)" />
          </pattern>
          <pattern id="world-map-sand" width="56" height="56" patternUnits="userSpaceOnUse">
            <rect width="56" height="56" fill="transparent" />
            <rect x="10" y="12" width="8" height="8" fill="rgba(146,64,14,0.24)" />
            <rect x="34" y="28" width="7" height="7" fill="rgba(146,64,14,0.22)" />
            <rect x="46" y="46" width="10" height="7" fill="rgba(180,83,9,0.18)" />
            <rect x="22" y="42" width="7" height="7" fill="rgba(120,53,15,0.16)" />
          </pattern>
          <pattern id="world-map-dry-grass" width="64" height="64" patternUnits="userSpaceOnUse">
            <rect width="64" height="64" fill="transparent" />
            <rect x="8" y="14" width="9" height="9" fill="rgba(101,111,37,0.24)" />
            <rect x="18" y="23" width="7" height="15" fill="rgba(120,113,35,0.18)" />
            <rect x="40" y="18" width="10" height="10" fill="rgba(132,117,38,0.20)" />
            <rect x="48" y="46" width="8" height="8" fill="rgba(63,98,18,0.18)" />
          </pattern>
          <pattern id="world-map-rocky" width="70" height="70" patternUnits="userSpaceOnUse">
            <rect width="70" height="70" fill="transparent" />
            <rect x="8" y="44" width="18" height="12" fill="rgba(92,64,51,0.18)" />
            <rect x="34" y="12" width="14" height="18" fill="rgba(68,64,60,0.20)" />
            <rect x="50" y="48" width="10" height="10" fill="rgba(120,53,15,0.22)" />
            <rect x="20" y="24" width="8" height="8" fill="rgba(254,215,170,0.22)" />
          </pattern>
          <pattern id="world-map-snow" width="72" height="72" patternUnits="userSpaceOnUse">
            <rect width="72" height="72" fill="transparent" />
            <rect x="8" y="18" width="18" height="8" fill="rgba(255,255,255,0.48)" />
            <rect x="24" y="12" width="10" height="8" fill="rgba(14,165,233,0.16)" />
            <rect x="44" y="44" width="20" height="8" fill="rgba(148,163,184,0.20)" />
          </pattern>
          <pattern id="world-map-water-tile" width="72" height="72" patternUnits="userSpaceOnUse">
            <rect width="72" height="72" fill="transparent" />
            <rect x="8" y="18" width="18" height="6" fill="rgba(224,242,254,0.48)" />
            <rect x="26" y="12" width="18" height="6" fill="rgba(224,242,254,0.34)" />
            <rect x="42" y="44" width="20" height="6" fill="rgba(14,165,233,0.16)" />
          </pattern>
          <pattern id="world-map-cliff" width="84" height="84" patternUnits="userSpaceOnUse">
            <rect width="84" height="84" fill="#b66d38" />
            <rect x="0" y="0" width="84" height="14" fill="#d08a4c" opacity="0.72" />
            <rect x="12" y="22" width="14" height="38" fill="#8f4a21" opacity="0.34" />
            <rect x="50" y="16" width="14" height="52" fill="#8f4a21" opacity="0.30" />
            <rect x="28" y="66" width="42" height="8" fill="#7c2d12" opacity="0.22" />
          </pattern>
          <pattern id="world-map-road-stones" width="54" height="28" patternUnits="userSpaceOnUse">
            <rect x="0" y="10" width="18" height="8" fill="rgba(120,53,15,0.28)" />
            <rect x="30" y="10" width="18" height="8" fill="rgba(120,53,15,0.22)" />
          </pattern>
          <filter id="system-map-glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="system-map-heat-glow">
            <feGaussianBlur stdDeviation="10" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker id="retry-arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L6,3 L0,6 Z" fill="#ef4444" />
          </marker>
        </defs>
        <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#7dd3fc" />
        <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#world-map-water-tile)" opacity="0.38" />
        <path d="M-160 6120Q830 5840 1780 6060T3680 5940T6260 6060V9180H-160z" fill="#38bdf8" opacity="0.55" />
        <path d="M-160 0H6160V950Q5230 700 4410 970T2690 880T980 1020T-160 790z" fill="#bae6fd" opacity="0.72" />
        <text x="140" y="168" fill="rgba(15,23,42,0.22)" fontSize="56" fontFamily="monospace" fontWeight="950" letterSpacing="7">
          BALOSS WORLD MAP
        </text>

        {worldZones.map((zone) => {
          const theme = worldZoneColor[zone.id];
          const centerX = zone.points.reduce((sum, point) => sum + point.x, 0) / zone.points.length;
          const centerY = zone.points.reduce((sum, point) => sum + point.y, 0) / zone.points.length;
          const labelX = centerX;
          const labelY = Math.min(...zone.points.map((point) => point.y)) + 130;
          const islandScale = worldIslandVisualScale[zone.id];
          const islandTransform = `translate(${centerX} ${centerY}) scale(${islandScale}) translate(${-centerX} ${-centerY})`;
          const islandPath = worldIslandPath(zone.id, zone.points);
          return (
            <g key={`world-zone-${zone.id}`} opacity={detailsUnlocked ? 0.92 : 1} shapeRendering="crispEdges">
              <g transform={islandTransform}>
                <path
                  d={islandPath}
                  transform="translate(0 86)"
                  fill="url(#world-map-cliff)"
                  stroke="#7c2d12"
                  strokeWidth="18"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={islandPath}
                  fill="#fff1b8"
                  stroke="#7c2d12"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={islandPath}
                  fill="none"
                  stroke="#f8dca0"
                  strokeWidth="96"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.72"
                />
                <path
                  d={islandPath}
                  fill="none"
                  stroke="#fff7c2"
                  strokeWidth="52"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.86"
                />
                <path
                  d={islandPath}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="16"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="26 42"
                  opacity="0.34"
                />
                <path
                  d={islandPath}
                  fill={theme.land}
                  stroke={theme.edge}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter={zone.id === "core" ? "url(#system-map-glow)" : undefined}
                />
                <path
                  d={islandPath}
                  fill={worldTerrainFill(zone.id)}
                  opacity="0.78"
                />
                <path
                  d={islandPath}
                  fill="none"
                  stroke={theme.edge}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="14 42"
                  opacity="0.22"
                />
                {worldHabitat(zone.id)}
                {cityOutlineUnlocked && <WorldCivilizationLayer zone={zone.id} dense={cityDetailsUnlocked} animated={!reducedMotion} />}
                {cityBlocksUnlocked && worldSettlements(zone.id, cityDetailsUnlocked)}
              </g>
              <g transform={`translate(${labelX} ${labelY})`}>
                <rect
                  x={-Math.max(205, zone.label.length * 18)}
                  y="-36"
                  width={Math.max(410, zone.label.length * 36)}
                  height="58"
                  fill="#fff7ed"
                  stroke="#111827"
                  strokeWidth="5"
                  opacity="0.9"
                />
                <text
                  x="0"
                  y="1"
                  textAnchor="middle"
                  fill="#111827"
                  fontFamily="monospace"
                  fontSize="34"
                  fontWeight="950"
                  letterSpacing="4"
                >
                  {zone.label.toUpperCase()}
                </text>
              </g>
              {zone.decorations.map((decoration) => worldDecoration(decoration.kind, decoration.x, decoration.y))}
            </g>
          );
        })}

        <g opacity={0.96}>
          {worldBridgeSpans.map((span) => (
            <WorldBridgeSpan key={span.id} x={span.x} y={span.y} rotate={span.rotate} length={span.length} kind={span.kind} />
          ))}
          {(Object.keys(worldHarbors) as WorldZoneTheme[]).map((zone) => (
            <WorldHarbor key={`world-harbor-${zone}`} zone={zone} />
          ))}
        </g>

        <g opacity={detailsUnlocked ? 0.82 : 1} shapeRendering="crispEdges">
            {cityBlocksUnlocked && worldLocalRoads.map((road) => (
              <g key={`world-local-road-${road.id}`} pointerEvents="none" opacity={cityDetailsUnlocked ? 0.62 : 0.28}>
                <WorldRoute d={polylinePath(road.points)} kind={road.kind} color={road.color} />
              </g>
            ))}
            {overviewMetroLines.map((line) => (
              <g key={`overview-road-${line.id}`} pointerEvents="none" opacity={overviewMode ? 0.58 : 0.36}>
                <WorldRoute d={polylinePath(line.points)} kind={worldRouteKind(line.id)} color={line.color} main />
              </g>
            ))}
            {overviewMode && routeTerminalPoints.map((terminal) => (
              <g key={`world-route-terminal-${terminal.id}`}>
                <WorldRouteTerminal point={terminal.point} color={terminal.color} label={terminal.label} kind={terminal.kind} />
              </g>
            ))}
            {overviewMode && overviewMetroLines.map((line, index) => {
              const terminal = line.points[line.points.length - 1];
              return (
                <g key={`overview-line-label-${line.id}`} transform={`translate(${terminal.x - 130} ${terminal.y + 42 + (index % 2) * 16})`}>
                  <rect x="-8" y="-18" width={line.label.length * 13 + 22} height="28" rx="10" fill="rgba(248,250,252,0.88)" stroke="rgba(15,23,42,0.12)" />
                  <circle cx="7" cy="-4" r="5" fill={line.color} />
                  <text x="20" y="0" fill="#0f172a" fontFamily="monospace" fontSize="18" fontWeight="900">{line.label}</text>
                </g>
              );
            })}
        </g>

        {snapshot && parkingYards.map(({ station, label, count, tone }) => (
          <g key={`parking-yard-${station.id}`} opacity={showParkingDetail ? 0.74 : 0.48} pointerEvents="none">
            {showParkingDetail ? (
              <>
                <rect
                  x={station.x - 150}
                  y={station.y - 72}
                  width="300"
                  height="144"
                  rx="30"
                  fill={`${tone}12`}
                  stroke={tone}
                  strokeWidth="2.6"
                  strokeDasharray="12 12"
                />
                <text x={station.x} y={station.y - 40} textAnchor="middle" fill="#0f172a" fontFamily="monospace" fontSize="10" fontWeight="950" letterSpacing="1">
                  {compact(label, 18)}
                </text>
                <text x={station.x} y={station.y - 22} textAnchor="middle" fill="rgba(15,23,42,0.55)" fontFamily="monospace" fontSize="7" fontWeight="900">
                  YARD / {count}
                </text>
                {[0, 1, 2, 3].map((dot) => (
                  <circle
                    key={`parking-dot-${station.id}-${dot}`}
                    cx={station.x - 72 + (dot % 4) * 48}
                    cy={station.y + 24}
                    r={dot < Math.min(count, 4) ? 9 : 4}
                    fill={dot < Math.min(count, 4) ? tone : "rgba(15,23,42,0.12)"}
                    stroke="#f8fafc"
                    strokeWidth="2"
                  />
                ))}
              </>
            ) : (
              <>
                <rect x={station.x - 48} y={station.y - 22} width="96" height="44" rx="18" fill={`${tone}14`} stroke={tone} strokeWidth="2" strokeDasharray="8 8" />
                <text x={station.x} y={station.y + 4} textAnchor="middle" fill="#0f172a" fontFamily="monospace" fontSize="8" fontWeight="950">
                  YARD {count}
                </text>
              </>
            )}
          </g>
        ))}

        {snapshot && showEMapInspectionLayer && recordValues<EMapRoute>(snapshot.emapRuntime.routes).filter(emapRouteVisible).slice(0, showParkingDetail ? 56 : 36).map((route) => {
          const from = snapshot.emapRuntime.stations[route.fromStationId];
          const to = snapshot.emapRuntime.stations[route.toStationId];
          const line = snapshot.emapRuntime.lines[route.lineId];
          if (!from || !to || !line) return null;
          if (!route.dependency && zoomLevel < 3.15 && !selectedBlocks.length && !selectedEMapEntityId) return null;
          if (route.dependency && !selectedBlocks.length && !selectedEMapEntityId) return null;
          if (route.dependency && zoomLevel < 4.1 && !selectedEMapEntityId) return null;
          const d = cityStreetPathFor(from, to);
          const serviceKind = serviceKindForLine(line, route.dependency);
          return (
            <g
              key={route.id}
              pointerEvents="none"
              opacity={route.dependency ? 0.66 : 0.78}
            >
              <WorldServiceRoute d={d} kind={serviceKind} />
            </g>
          );
        })}

        {snapshot && showMicroTransport && displayTrains.filter(trainMatchesBlocks).map((train) => {
          const route = snapshot.emapRuntime.routes[train.routeId];
          const routeFrom = route ? snapshot.emapRuntime.stations[route.fromStationId] : undefined;
          const routeTo = route ? snapshot.emapRuntime.stations[route.toStationId] : undefined;
          const from = routeFrom || snapshot.emapRuntime.stations[train.fromStationId];
          const to = routeTo || snapshot.emapRuntime.stations[train.toStationId];
          const line = route ? snapshot.emapRuntime.lines[route.lineId] : undefined;
          if (!from || !to) return null;
          const d = cityStreetPathFor(from, to);
          const serviceKind = serviceKindForLine(line, route?.dependency);
          return (
            <g
              key={`active-track-${train.id}`}
              filter="url(#system-map-glow)"
              pointerEvents="none"
            >
              <WorldServiceRoute d={d} kind={serviceKind} active blocked={trainIsError(train)} />
            </g>
          );
        })}

        {snapshot && showMicroTransport && displayTrains.filter(trainMatchesBlocks).map((train) => {
          const route = snapshot.emapRuntime.routes[train.routeId];
          const from = route ? snapshot.emapRuntime.stations[route.fromStationId] : snapshot.emapRuntime.stations[train.fromStationId];
          const to = route ? snapshot.emapRuntime.stations[route.toStationId] : snapshot.emapRuntime.stations[train.toStationId];
          if (!from || !to) return null;
          const midpointX = (from.x + to.x) / 2;
          const midpointY = (from.y + to.y) / 2;
          const bend = from.x < to.x ? 32 : -32;
          const control = { x: midpointX + bend, y: midpointY - bend };
          const d = cityStreetPathFor(from, to);
          const point = quadraticPoint(from, control, to, train.status === "arriving" ? 0.92 : trainIsError(train) ? 0.55 : trainIsWaitingPlanning(train) ? 0.68 : trainIsStandby(train) ? 0.28 : 0.42);
          const duration = Math.max(3.8, Math.min(14, 7 / Math.max(0.35, train.speed)));
          const purpose = trainPurposeLabel(train);
          const badgeTone = trainStatusBadgeTone(train);
          return (
            <g
              key={train.id}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => selectTrain(train)}
              onTouchEnd={(event) => handleTouchSelect(event, () => selectTrain(train))}
              className="cursor-pointer"
            >
              {reducedMotion || trainIsStationary(train) ? (
                <g transform={`translate(${point.x} ${point.y})`}>
                  <circle cx="0" cy="0" r="34" fill="transparent" stroke="rgba(226,232,240,0.32)" strokeWidth="1.5" strokeDasharray="4 5" />
                  <WorldVehicle train={train} />
                  <g transform="translate(0 30)">
                    <rect x="-20" y="-8" width="40" height="16" rx="7" fill={badgeTone.fill} stroke={badgeTone.stroke} strokeWidth="1" />
                    <text x="0" y="4" textAnchor="middle" fill={badgeTone.text} fontFamily="monospace" fontSize="7" fontWeight="900">{purpose}</text>
                  </g>
                </g>
              ) : (
                <g>
                  <circle cx="0" cy="0" r="34" fill="transparent" stroke="rgba(226,232,240,0.32)" strokeWidth="1.5" strokeDasharray="4 5" />
                  <WorldVehicle train={train} />
                  <g transform="translate(0 30)">
                    <rect x="-20" y="-8" width="40" height="16" rx="7" fill={badgeTone.fill} stroke={badgeTone.stroke} strokeWidth="1" />
                    <text x="0" y="4" textAnchor="middle" fill={badgeTone.text} fontFamily="monospace" fontSize="7" fontWeight="900">{purpose}</text>
                  </g>
                  <animateMotion path={d} dur={`${duration}s`} repeatCount={train.status === "arriving" ? "1" : "indefinite"} rotate="auto" />
                </g>
              )}
            </g>
          );
        })}

        {snapshot && showEMapInspectionLayer && recordValues<EMapStation>(snapshot.emapRuntime.stations).filter((station) => emapStationMatchesBlocks(station.id)).map((station) => {
          const entity = snapshot.emapRuntime.entities[station.entityId];
          const line = snapshot.emapRuntime.lines[station.lineId];
          if (!entity || !line) return null;
          const selectedEntity = entity.id === selectedEMapEntityId;
          const important = entity.status === "error" || entity.status === "blocked" || entity.type === "main_brain" || selectedEntity;
          if (!important && zoomLevel < 2.85 && !selectedBlocks.length) return null;
          const showLabel = selectedEntity || entity.type === "main_brain" || (important && zoomLevel > 3.25) || showFineLabels;
          const placeKind = microPlaceKindFor(entity);
          return (
            <g
              key={`emap-station-${station.id}`}
              className="cursor-pointer"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => selectEMapEntity(entity.id)}
              onTouchEnd={(event) => handleTouchSelect(event, () => selectEMapEntity(entity.id))}
            >
              <circle cx={station.x} cy={station.y} r={selectedEntity ? 64 : 48} fill="transparent" />
              <g transform={`translate(${station.x} ${station.y})`}>
                <WorldMicroPlace kind={placeKind} label={entity.name} status={entity.status} color={line.color} selected={selectedEntity} />
              </g>
              {showLabel && (
                <g transform={`translate(${station.x} ${station.y + 58})`}>
                  <rect x="-64" y="-11" width="128" height="22" rx="8" fill="rgba(248,250,252,0.9)" stroke="rgba(15,23,42,0.18)" strokeWidth="1" />
                  <text x="0" y="4" textAnchor="middle" fill="#0f172a" fontFamily="monospace" fontSize="8.2" fontWeight="900">
                    {compact(entity.name, 18)}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {snapshot && showEMapInspectionLayer && activeEMapAvatars.filter(avatarMatchesBlocks).map((avatar) => {
          if (avatar.trainId && !reducedMotion) return null;
          const station = avatar.stationId ? snapshot.emapRuntime.stations[avatar.stationId] : undefined;
          if (!station) return null;
          const entity = snapshot.emapRuntime.entities[avatar.agentId];
          const parkingOffset = parkingAvatarOffset(avatar.agentId, station);
          return (
            <g
              key={avatar.id}
              transform={`translate(${station.x - 11 + parkingOffset.x} ${station.y - 39 + parkingOffset.y})`}
              opacity={avatar.status === "offline" ? 0.42 : 1}
              className="cursor-pointer"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => selectEMapEntity(entity?.id || avatar.agentId)}
              onTouchEnd={(event) => handleTouchSelect(event, () => selectEMapEntity(entity?.id || avatar.agentId))}
            >
              <circle cx="11" cy="11" r="22" fill="transparent" />
              <PixelAvatar avatarId={avatar.avatarId} state={avatar.status} size={22} />
            </g>
          );
        })}

        {showDetailedTransport && visibleConnections.map((connection) => {
          const from = snapshot?.stations.find((station) => station.id === connection.from);
          const to = snapshot?.stations.find((station) => station.id === connection.to);
          if (!from || !to) return null;
          const routeKind = worldConnectionKind(from, to);
          const d = organizedTransportPathFor(from, to, routeKind);
          if (routeKind === "sea") {
            const fromHarbor = safeWorldLot(stationWorldTheme(from), worldHarbors[stationWorldTheme(from)]);
            const toHarbor = safeWorldLot(stationWorldTheme(to), worldHarbors[stationWorldTheme(to)]);
            const seaMidX = Math.round((fromHarbor.x + toHarbor.x) / 2);
            const seaMidY = Math.round((fromHarbor.y + toHarbor.y) / 2) + (fromHarbor.y < toHarbor.y ? 260 : -260);
            return (
              <g
                key={connection.id}
                pointerEvents="none"
                opacity={connection.from === "core" ? 0.88 : 0.72}
                shapeRendering="crispEdges"
              >
                <WorldRoute d={cityStreetPathFor(from, fromHarbor)} kind="road" color="#92400e" status={connection.status} main={connection.from === "core"} />
                <WorldRoute d={polylinePath([fromHarbor, { x: seaMidX, y: seaMidY }, toHarbor])} kind="sea" color="#0ea5e9" status={connection.status} main={connection.from === "core"} />
                <WorldRoute d={cityStreetPathFor(toHarbor, to)} kind="road" color="#92400e" status={connection.status} main={connection.from === "core"} />
              </g>
            );
          }
          return (
            <g
              key={connection.id}
              pointerEvents="none"
              opacity={connection.from === "core" ? 0.88 : 0.72}
              shapeRendering="crispEdges"
            >
              <WorldRoute d={d} kind={routeKind} color="#92400e" status={connection.status} main={connection.from === "core"} />
            </g>
          );
        })}

        {dataPacketConnections.map((connection, index) => {
          const from = snapshot?.stations.find((station) => station.id === connection.from);
          const to = snapshot?.stations.find((station) => station.id === connection.to);
          if (!from || !to) return null;
          const tone = statusTone[connection.status];
          const d = organizedTransportPathFor(from, to, worldConnectionKind(from, to));
          const packetLabel = connection.status === "warning" ? "CHK" : connection.status === "running" ? "RUN" : "OK";
          const fixedX = from.x + (to.x - from.x) * (0.3 + (index % 4) * 0.12);
          const fixedY = from.y + (to.y - from.y) * (0.3 + (index % 4) * 0.12);
          return (
            <g key={`data-packet-${connection.id}`} className="cursor-pointer" onClick={() => selectStation(to)} onPointerDown={(event) => event.stopPropagation()}>
              {reducedMotion ? (
                <g transform={`translate(${fixedX} ${fixedY})`}>
                  <rect x="-14" y="-7" width="28" height="14" rx="7" fill="#f8fafc" stroke={tone.stroke} strokeWidth="2" />
                  {showPacketLabels && <text x="0" y="3" textAnchor="middle" fill="#0f172a" fontFamily="monospace" fontSize="6" fontWeight="950">{packetLabel}</text>}
                </g>
              ) : (
                <g>
                  <rect x="-14" y="-7" width="28" height="14" rx="7" fill="#f8fafc" stroke={tone.stroke} strokeWidth="2" filter="url(#system-map-glow)" />
                  <circle cx="-8" cy="0" r="2.5" fill={tone.stroke} />
                  <circle cx="0" cy="0" r="3" fill={tone.stroke} opacity="0.72" />
                  <circle cx="8" cy="0" r="2.5" fill={tone.stroke} opacity="0.48" />
                  {showPacketLabels && <text x="0" y="-11" textAnchor="middle" fill="#0f172a" stroke="#f8fafc" strokeWidth="3" paintOrder="stroke" fontFamily="monospace" fontSize="6" fontWeight="950">{packetLabel}</text>}
                  <animateMotion path={d} dur={`${5.2 + (index % 5) * 0.7}s`} begin={`${index * 0.35}s`} repeatCount="indefinite" rotate="auto" />
                </g>
              )}
            </g>
          );
        })}

        {overviewActivityPulses.map(({ train, color, x, y }, index) => {
          const pulseColor = trainStatusColor(train);
          return (
            <g
              key={`overview-pulse-${train.id}-${index}`}
              className="cursor-pointer"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => selectTrain(train)}
              onTouchEnd={(event) => handleTouchSelect(event, () => selectTrain(train))}
            >
              <circle cx={x} cy={y} r="30" fill="rgba(248,250,252,0.72)" stroke={color} strokeWidth="5" opacity="0.94" />
              <circle cx={x} cy={y} r="13" fill={pulseColor} stroke={trainIsStandby(train) ? "#f8fafc" : "#0f172a"} strokeWidth="3" opacity="0.98">
                <animate attributeName="r" values="10;15;10" dur={`${3 + (index % 4)}s`} repeatCount="indefinite" />
              </circle>
            </g>
          );
        })}

        {visibleStations.map((station) => {
          const tone = statusTone[station.status];
          const stationJob = station.jobId ? jobById.get(station.jobId) : undefined;
          const heat = heatTone(stationHeatLevel(station, stationJob));
          const proofActive = proofStationIds.has(station.id);
          const retryActive = retryStationIds.has(station.id);
          const selectedStation = station.id === selectedId;
          const isCore = station.layer === "core";
          const isHub = Boolean(station.hub);
          const isAppHub = Boolean(station.appHub);
          const radius = overviewMode
            ? isCore ? 46 : isHub ? 34 : isAppHub ? 30 : selectedStation ? 20 : 12
            : isCore
              ? cityDetailsUnlocked ? 31 : 22
              : isHub
                ? cityDetailsUnlocked ? 24 : 18
                : isAppHub
                  ? cityDetailsUnlocked ? 21 : 16
                : selectedStation
                  ? 16
                  : 10;
          const showLabel = isCore || isHub || isAppHub || selectedStation || (showFineLabels && zoomLevel > 4.4) || (station.status === "blocked" && zoomLevel > 2.4);
          const showMetric = Boolean(station.metric) && showLabel && (selectedStation || ((isHub || isAppHub) && zoomLevel > 2.2) || zoomLevel > 4.8);
          const markerGap = overviewMode ? (isCore ? 34 : isHub ? 28 : isAppHub ? 24 : 18) : (isCore ? 26 : isHub ? 22 : isAppHub ? 20 : 16);
          const heatBadgeX = station.x + radius + markerGap + 22;
          const heatBadgeY = station.y - radius - markerGap;
          const proofBadgeX = station.x - radius - markerGap;
          const proofBadgeY = station.y - radius - markerGap;
          const retryBadgeX = radius + markerGap + 22;
          const retryBadgeY = isCore || isHub || isAppHub ? -(radius + markerGap) : radius + 6;
          const labelYOffset = radius + (overviewMode ? (isCore ? 40 : isHub || isAppHub ? 30 : 24) : isCore ? 30 : isHub ? 24 : isAppHub ? 22 : 18);
          const metricYOffset = labelYOffset + (overviewMode ? 18 : 13);
          const showStationPad = isCore || isHub || isAppHub || selectedStation || station.status === "blocked" || cityDetailsUnlocked;
          return (
            <g
              key={station.id}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => selectStation(station)}
              onTouchEnd={(event) => handleTouchSelect(event, () => selectStation(station))}
              className="cursor-pointer"
            >
              {showStationPad && <WorldStationPad station={station} radius={radius} compact={!cityDetailsUnlocked && !selectedStation} />}
              {heat.label && (
                <g pointerEvents="none">
                  <circle
                    cx={station.x}
                    cy={station.y}
                    r={radius + (overviewMode ? 22 : 14)}
                    fill={heat.fill}
                    stroke={heat.stroke}
                    strokeWidth={overviewMode ? "5" : "3"}
                    opacity={heat.label === "HOT" ? 0.72 : 0.52}
                    filter="url(#system-map-heat-glow)"
                  >
                    {!reducedMotion && <animate attributeName="opacity" values="0.38;0.78;0.38" dur={heat.label === "HOT" ? "1.9s" : "3.2s"} repeatCount="indefinite" />}
                  </circle>
                  {(selectedStation || overviewMode || heat.label === "HOT") && (
                    <g transform={`translate(${heatBadgeX} ${heatBadgeY})`}>
                      <rect x="-22" y="-11" width="44" height="22" rx="8" fill="#fff7ed" stroke={heat.stroke} strokeWidth="2" />
                      <text x="0" y="4" textAnchor="middle" fill="#7c2d12" fontFamily="monospace" fontSize="8" fontWeight="950">{heat.label}</text>
                    </g>
                  )}
                </g>
              )}
              {proofActive && (
                <g pointerEvents="none">
                  <circle
                    cx={station.x}
                    cy={station.y}
                    r={radius + 15}
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth={overviewMode ? "7" : "3"}
                    opacity="0.72"
                  >
                    {!reducedMotion && (
                      <>
                        <animate attributeName="r" values={`${radius + 12};${radius + (overviewMode ? 54 : 32)};${radius + 12}`} dur="3.8s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.74;0.08;0.74" dur="3.8s" repeatCount="indefinite" />
                      </>
                    )}
                  </circle>
                  <g transform={`translate(${proofBadgeX} ${proofBadgeY})`}>
                    <circle cx="0" cy="0" r={overviewMode ? "18" : "10"} fill="#22c55e" stroke="#f8fafc" strokeWidth="3" />
                    <text x="0" y={overviewMode ? "7" : "4"} textAnchor="middle" fill="#052e16" fontFamily="monospace" fontSize={overviewMode ? "14" : "8"} fontWeight="950">OK</text>
                  </g>
                </g>
              )}
              {retryActive && (
                <g pointerEvents="none" transform={`translate(${station.x} ${station.y})`}>
                  <g>
                    <path
                      d={`M ${-(radius + 24)} 0 A ${radius + 24} ${radius + 24} 0 1 1 ${radius + 8} ${-(radius + 18)}`}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth={overviewMode ? "7" : "4"}
                      strokeLinecap="round"
                      markerEnd="url(#retry-arrowhead)"
                    />
                    {!reducedMotion && <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="2.8s" repeatCount="indefinite" />}
                  </g>
                  <g transform={`translate(${retryBadgeX} ${retryBadgeY})`}>
                    <rect x="-20" y="-10" width="40" height="20" rx="8" fill="#fee2e2" stroke="#ef4444" strokeWidth="2" />
                    <text x="0" y="4" textAnchor="middle" fill="#7f1d1d" fontFamily="monospace" fontSize="8" fontWeight="950">RETRY</text>
                  </g>
                </g>
              )}
              <g
                transform={`translate(${station.x} ${station.y})`}
                filter={selectedStation || station.status === "running" ? "url(#system-map-glow)" : undefined}
              >
                <circle
                  cx="0"
                  cy="8"
                  r={radius + (overviewMode ? 20 : 12)}
                  fill={tone.fill}
                  opacity={overviewMode ? 0.24 : selectedStation ? 0.5 : isHub ? 0.28 : 0.16}
                />
                <WorldBuilding kind={stationBuildingKind(station)} station={station} selected={selectedStation} radius={radius} />
              </g>
              {showLabel && (
                <text
                  x={station.x}
                  y={station.y + labelYOffset}
                  textAnchor="middle"
                  fill="#0f172a"
                  stroke="rgba(248,250,252,0.9)"
                  strokeWidth={overviewMode ? "5" : "4"}
                  paintOrder="stroke"
                  fontSize={overviewMode ? isCore ? 34 : isHub ? 24 : isAppHub ? 21 : 13 : isCore ? cityDetailsUnlocked ? 14 : 11 : isHub ? cityDetailsUnlocked ? 11 : 9 : isAppHub ? cityDetailsUnlocked ? 10 : 8 : 8}
                  fontFamily="monospace"
                  fontWeight="900"
                  letterSpacing={isHub || isAppHub ? "1.4" : "0.4"}
                >
                  {compact(station.label, isCore ? 22 : isHub ? 18 : isAppHub ? 16 : 15)}
                </text>
              )}
              {showMetric && (
                <text
                  x={station.x}
                  y={station.y + metricYOffset}
                  textAnchor="middle"
                  fill="rgba(15,23,42,0.72)"
                  fontSize={overviewMode ? "13" : "7"}
                  fontFamily="monospace"
                  fontWeight="800"
                >
                  {compact(station.metric || "", 18)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute inset-0 z-20">
        {showFarZoomKey && (
          <>
          <button
            type="button"
            aria-label="Close train key"
            onClick={() => setFarZoomKeyCollapsed(true)}
            className="pointer-events-auto absolute inset-0 z-20 cursor-default bg-transparent"
          />
          <div className="pointer-events-auto absolute left-1/2 top-[116px] z-30 w-[calc(100%-32px)] -translate-x-1/2 rounded-[22px] border border-slate-900/10 bg-white/88 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.22)] backdrop-blur-xl sm:w-[560px]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[8px] font-mono font-black uppercase tracking-[0.22em] text-slate-500">
                <KeyRound className="h-3.5 w-3.5 text-slate-500" />
                Train key
              </div>
              <div className="flex items-center gap-1.5">
                <div className="text-[7px] font-mono font-black uppercase tracking-widest text-slate-400">far zoom only</div>
                <button
                  type="button"
                  aria-label="Close train key"
                  onClick={() => setFarZoomKeyCollapsed(true)}
                  className="grid h-7 w-7 place-items-center rounded-full border border-slate-900/10 bg-white/80 text-slate-500 shadow-sm"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {farZoomAgentKey.map(([tag, label, detail]) => {
                const color = agentColorForTag(tag);
                return (
                  <div key={tag} className="flex min-w-0 items-center gap-1.5 rounded-xl border border-slate-900/10 bg-white/72 px-2 py-1">
                    <span
                      className="grid h-6 min-w-8 place-items-center rounded-lg border text-[8px] font-mono font-black text-slate-950"
                      style={{ borderColor: color, background: `${color}24` }}
                    >
                      {tag}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[9px] font-black text-slate-800">{label}</span>
                      <span className="block truncate text-[7px] font-mono uppercase tracking-wider text-slate-500">{detail}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex items-center gap-1 overflow-hidden text-[7px] font-mono font-black uppercase tracking-widest text-slate-500">
              <span className="shrink-0">Shapes:</span>
              <span className="truncate rounded-full border border-slate-400 px-1.5 py-0.5">FAST = priority</span>
              <span className="truncate rounded-full border border-slate-400 px-1.5 py-0.5">CARGO = memory</span>
              <span className="truncate rounded-full border border-slate-400 px-1.5 py-0.5">MON = patrol</span>
              <span className="truncate rounded-full border border-slate-900 bg-slate-900 px-1.5 py-0.5 text-white">STB = standby</span>
              <span className="truncate rounded-full border border-amber-500 px-1.5 py-0.5 text-amber-600">WTP = waiting</span>
              <span className="truncate rounded-full border border-red-500 bg-red-500 px-1.5 py-0.5 text-white">ERR = error</span>
            </div>
          </div>
          </>
        )}

        <div className="pointer-events-auto absolute right-2 top-2 flex gap-1.5">
          <button type="button" onClick={() => zoom(0.82)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-black/62 text-lg font-black text-white shadow-lg backdrop-blur-xl">+</button>
          <button type="button" onClick={() => zoom(1.2)} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-black/62 text-lg font-black text-white shadow-lg backdrop-blur-xl">-</button>
          <button type="button" onClick={fitVisibleMap} className="h-9 rounded-xl border border-cyan-300/25 bg-black/62 px-2 text-[7px] font-mono font-black uppercase tracking-widest text-cyan-100 shadow-lg backdrop-blur-xl">Fit</button>
          <button type="button" onClick={() => void refresh(true)} className="grid h-9 w-9 place-items-center rounded-xl border border-[#22c55e]/25 bg-black/62 text-[#8dffb0] shadow-lg backdrop-blur-xl">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="pointer-events-auto absolute bottom-3 left-2 z-40 flex flex-col gap-1.5">
          {sideRailCollapsed ? (
            <button
              type="button"
              onPointerDown={stopRailPointer}
              onClick={(event) => handleRailTap(event, () => setSideRailCollapsed(false))}
              className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-black/68 text-slate-100 shadow-[0_12px_35px_rgba(0,0,0,0.48)] backdrop-blur-xl"
              aria-label="Open map controls"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
          ) : (
            <>
              {farZoomKeyEligible && (
                <button
                  type="button"
                  onPointerDown={stopRailPointer}
                  onClick={(event) => handleRailTap(event, () => setFarZoomKeyCollapsed((value) => !value))}
                  className={`relative grid h-10 w-10 place-items-center rounded-xl border shadow-[0_12px_35px_rgba(0,0,0,0.48)] backdrop-blur-xl ${!farZoomKeyCollapsed ? "border-slate-900/10 bg-white/90 text-slate-700" : "border-white/10 bg-black/62 text-slate-200"}`}
                  aria-label={farZoomKeyCollapsed ? "Open train key" : "Close train key"}
                >
                  <KeyRound className="h-4 w-4" />
                </button>
              )}
              {[
                ["baloss", "Baloss Chat", <Bot className="h-4 w-4" />],
                ["notifications", "Notifications", <Bell className="h-4 w-4" />],
                ["search", "Search", <Search className="h-4 w-4" />],
                ["blocks", "Blocks", <Layers3 className="h-4 w-4" />],
                ["filters", "Filters", <SlidersHorizontal className="h-4 w-4" />],
                ["legend", "Legend", <ShieldCheck className="h-4 w-4" />],
                ["health", "Health", <Activity className="h-4 w-4" />],
                ["settings", "Settings", <Zap className="h-4 w-4" />],
              ].map(([id, label, icon]) => {
                const menuId = id as EMapMenu;
                const active = openMenu === menuId;
                const opensFullApp = id === "baloss";
                return (
                  <button
                    key={id}
                    type="button"
                    onPointerDown={stopRailPointer}
                    onClick={(event) => handleRailTap(event, () => {
                      if (opensFullApp) {
                        setOpenMenu(null);
                        onOpenApp?.("spino");
                        return;
                      }
                      setOpenMenu(active ? null : menuId);
                    })}
                    className={`relative grid h-10 w-10 place-items-center rounded-xl border shadow-[0_12px_35px_rgba(0,0,0,0.48)] backdrop-blur-xl ${active ? "border-[#22c55e]/45 bg-[#22c55e]/20 text-[#8dffb0]" : opensFullApp ? "border-[#22c55e]/25 bg-[#22c55e]/12 text-[#8dffb0]" : "border-white/10 bg-black/62 text-slate-200"}`}
                    aria-label={label as string}
                  >
                    {icon}
                    {id === "blocks" && selectedBlocks.length > 0 && (
                      <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#22c55e] px-1 text-[9px] font-black text-black">
                        {selectedBlocks.length}
                      </span>
                    )}
                    {id === "notifications" && unreadNotifications > 0 && (
                      <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-amber-300 px-1 text-[9px] font-black text-black">
                        {unreadNotifications}
                      </span>
                    )}
                  </button>
                );
              })}
              {DEV_SIMULATION_ENABLED && (
                <button
                  type="button"
                  onPointerDown={stopRailPointer}
                  onClick={(event) => handleRailTap(event, () => setOpenMenu(openMenu === "dev" ? null : "dev"))}
                  className={`grid h-10 w-10 place-items-center rounded-xl border shadow-[0_12px_35px_rgba(0,0,0,0.48)] backdrop-blur-xl ${openMenu === "dev" ? "border-pink-300/45 bg-pink-300/20 text-pink-100" : "border-white/10 bg-black/62 text-slate-200"}`}
                  aria-label="Dev"
                >
                  <Bot className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onPointerDown={stopRailPointer}
                onClick={(event) => handleRailTap(event, () => {
                  setSideRailCollapsed(true);
                  setOpenMenu(null);
                })}
                className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-black/68 text-slate-100 shadow-[0_12px_35px_rgba(0,0,0,0.48)] backdrop-blur-xl"
                aria-label="Collapse map controls"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {openMenu && (
        <div className="absolute left-[68px] bottom-3 z-40 max-h-[70vh] w-[min(390px,calc(100%-84px))] overflow-y-auto rounded-[28px] border border-white/10 bg-[#07090d]/96 p-3 shadow-[0_25px_70px_rgba(0,0,0,0.62)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[8px] font-mono font-black uppercase tracking-[0.22em] text-[#8dffb0]">Control drawer</div>
              <h2 className="text-base font-black text-white">
                {{
                  search: "Search map",
                  baloss: "Baloss Chat",
                  notifications: "Notifications",
                  blocks: "Blocks",
                  filters: "Filters",
                  legend: "Legend",
                  health: "Health",
                  settings: "Settings",
                  dev: "Developer",
                }[openMenu]}
              </h2>
            </div>
            <button type="button" onClick={() => setOpenMenu(null)} className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200" aria-label="Close drawer">
              <X className="h-4 w-4" />
            </button>
          </div>

          {openMenu === "notifications" && (
            <div className="mt-3 space-y-2">
              {pocketNotifications.length ? (
                pocketNotifications.slice(0, 16).map((item) => {
                  const metadata = item.metadata || {};
                  const subsystem = typeof metadata.subsystem === "string" ? metadata.subsystem : "";
                  const diagnosis = typeof metadata.diagnosis === "string" ? metadata.diagnosis : "";
                  const nextFix = typeof metadata.nextFix === "string" ? metadata.nextFix : "";
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (item.actionApp) onOpenApp?.(item.actionApp as PocketFlowAppId);
                      }}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className={`text-[8px] font-mono font-black uppercase tracking-[0.2em] ${
                            item.severity === "critical" ? "text-red-200" : item.severity === "warning" ? "text-amber-200" : item.severity === "success" ? "text-[#8dffb0]" : "text-cyan-100"
                          }`}>
                            {item.source}
                          </div>
                          <div className="mt-1 text-sm font-black text-white">{item.title}</div>
                          <p className="mt-1 text-[11px] leading-4 text-slate-400">{item.message}</p>
                        </div>
                        {!item.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#22c55e]" />}
                      </div>
                      {(subsystem || diagnosis || nextFix) && (
                        <div className="mt-3 space-y-1 rounded-xl border border-white/10 bg-black/20 p-2">
                          {subsystem && <div className="text-[10px] font-bold text-slate-200">{subsystem}</div>}
                          {diagnosis && <div className="text-[10px] leading-4 text-slate-400">{diagnosis}</div>}
                          {nextFix && <div className="text-[9px] font-mono font-black uppercase tracking-[0.14em] text-[#8dffb0]">{nextFix}</div>}
                        </div>
                      )}
                      {item.actionLabel && (
                        <div className="mt-2 text-[8px] font-mono font-black uppercase tracking-[0.18em] text-[#8dffb0]">
                          {item.actionLabel}
                        </div>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-xs font-semibold text-slate-400">
                  No notifications yet. Monitor agents will write here.
                </div>
              )}
            </div>
          )}

          {openMenu === "search" && (
            <div className="mt-3 space-y-3">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search station, agent, server, automation..."
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/35 px-3 text-sm font-semibold text-slate-100 outline-none placeholder:text-slate-600 focus:border-[#22c55e]/45"
              />
              <div className="grid grid-cols-1 gap-2">
                {focusedStations.slice(0, 14).map((station) => (
                  <button key={station.id} type="button" onClick={() => selectStation(station)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="min-w-0 truncate text-sm text-white">{station.label}</strong>
                      <span className={`shrink-0 text-[8px] font-mono font-black uppercase tracking-wider ${statusTone[station.status].text}`}>{stationStatusLabel(station)}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">{station.detail}</p>
                  </button>
                ))}
                {!focusedStations.length && <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs font-semibold text-slate-400">No stations match the current search/filter combination.</div>}
              </div>
            </div>
          )}

          {openMenu === "blocks" && (
            <div className="mt-3 space-y-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedBlocks([]);
                  setFilter("all");
                  setStatusFilter("all");
                  resetView();
                }}
                className="w-full rounded-2xl border border-[#22c55e]/30 bg-[#22c55e]/10 p-3 text-left"
              >
                <div className="text-sm font-black text-white">Show all rails</div>
                <p className="mt-1 text-[11px] leading-4 text-slate-400">Clear block selections without mutating registry or telemetry.</p>
              </button>
              <div className="grid grid-cols-1 gap-2">
                {blockEntries.map(([block, label]) => {
                  const active = selectedBlocks.includes(block);
                  const count = snapshot?.stations.filter((station) => station.layer !== "core" && !station.hub && stationMatchesBlocks(station, [block])).length || 0;
                  return (
                    <button
                      key={block}
                      type="button"
                      onClick={() => toggleBlock(block)}
                      className={`rounded-2xl border p-3 text-left ${active ? "border-[#22c55e]/45 bg-[#22c55e]/14" : "border-white/10 bg-white/[0.04]"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-sm text-white">{label}</strong>
                        <span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-mono font-black uppercase tracking-wider text-slate-300">{count}</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-4 text-slate-400">
                        {active ? "Visible/highlighted now." : "Tap to focus this system block."}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {openMenu === "filters" && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setShowOnlyActive((value) => !value)} className={`rounded-2xl border p-3 text-left ${showOnlyActive ? "border-[#22c55e]/45 bg-[#22c55e]/14 text-[#8dffb0]" : "border-white/10 bg-white/[0.04] text-slate-200"}`}>
                  <div className="text-sm font-black">Active only</div>
                  <div className="mt-1 text-[10px] text-slate-400">Running, needs check, blocked.</div>
                </button>
                <button type="button" onClick={() => setStatusFilter("all")} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left text-slate-200">
                  <div className="text-sm font-black">Clear status</div>
                  <div className="mt-1 text-[10px] text-slate-400">Show every state.</div>
                </button>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {[
                  ["Healthy", healthy, "healthy"],
                  ["Run", running, "running"],
                  ["Check", needsCheck, "warning"],
                  ["Block", broken, "blocked"],
                  ["?", unknown, "unknown"],
                ].map(([label, value, status]) => {
                  const mapStatus = status as MapStatus;
                  const active = statusFilter === mapStatus;
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatusFilter(active ? "all" : mapStatus)}
                      className={`rounded-2xl border px-2 py-2 text-left ${active ? "ring-2 ring-white/35" : ""}`}
                      style={{ borderColor: `${statusTone[mapStatus].stroke}55`, background: statusTone[mapStatus].fill }}
                    >
                      <div className="text-[7px] font-mono font-black uppercase tracking-widest text-slate-400">{label}</div>
                      <div className={`text-base font-black leading-none ${statusTone[mapStatus].text}`}>{value}</div>
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2">
                <button type="button" onClick={() => setFilter("all")} className={`w-full rounded-2xl border p-3 text-left ${filter === "all" ? "border-[#22c55e]/35 bg-[#22c55e]/10" : "border-white/10 bg-white/[0.04]"}`}>
                  <div className="text-sm font-black text-white">All sectors</div>
                </button>
                {(Object.keys(layerMeta) as MapLayer[]).map((layer) => {
                  const meta = layerMeta[layer];
                  const counts = layerStatusCounts(snapshot?.stations || [], layer);
                  return (
                    <button
                      key={layer}
                      type="button"
                      onClick={() => setFilter(layer)}
                      className={`w-full rounded-2xl border p-3 text-left ${filter === layer ? "bg-white/10" : "bg-white/[0.04]"}`}
                      style={{ borderColor: `${meta.color}44` }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-sm" style={{ color: meta.color }}>{meta.hubLabel}</strong>
                        <span className="text-[9px] font-mono text-slate-400">{counts.healthy} ok / {counts.blocked} block</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-4 text-slate-400">{meta.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {openMenu === "legend" && (
            <div className="mt-3 space-y-2">
              {(Object.keys(statusTone) as MapStatus[]).map((status) => (
                <div key={status} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <span className="h-4 w-4 rounded-full" style={{ background: statusTone[status].stroke }} />
                  <div>
                    <div className="text-sm font-black text-white">{statusTone[status].label}</div>
                    <div className="text-[11px] text-slate-400">Rail, station and control state.</div>
                  </div>
                </div>
              ))}
              <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/8 p-3 text-[11px] leading-4 text-slate-300">
                Blocks are view selectors. They never rewrite the registry, telemetry, trains, avatars, queues or monitor data.
              </div>
            </div>
          )}

          {openMenu === "health" && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Stations", snapshot?.stations.length || 0],
                  ["Registry", snapshot?.emapRegistry.entities.length || 0],
                  ["Trains", displayTrains.length],
                  ["Avatars", activeEMapAvatars.length],
                  ["Events", snapshot?.emapRuntime.recentEvents.length || 0],
                  ["Visible", visibleStations.length],
                  ["Need check", needsCheck],
                  ["Runtime slow", runtimeSlow],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <div className="text-[8px] font-mono font-black uppercase tracking-widest text-slate-500">{label}</div>
                    <div className="mt-1 text-xl font-black text-white">{value}</div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => void copyState()} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#22c55e]/30 bg-[#22c55e]/10 p-3 text-[9px] font-mono font-black uppercase tracking-widest text-[#8dffb0]">
                <Copy className="h-4 w-4" />
                Copy Full State
              </button>
            </div>
          )}

          {openMenu === "settings" && (
            <div className="mt-3 grid grid-cols-1 gap-2">
              <button type="button" onClick={() => setFollowActive((value) => !value)} className={`rounded-2xl border p-3 text-left ${followActive ? "border-cyan-300/45 bg-cyan-300/14 text-cyan-100" : "border-white/10 bg-white/[0.04] text-slate-200"}`}>
                <div className="text-sm font-black">Follow active trains</div>
                <div className="mt-1 text-[11px] text-slate-400">Auto-centers on live movement.</div>
              </button>
              <button type="button" onClick={() => setReducedMotion((value) => !value)} className={`rounded-2xl border p-3 text-left ${reducedMotion ? "border-amber-300/45 bg-amber-300/14 text-amber-100" : "border-white/10 bg-white/[0.04] text-slate-200"}`}>
                <div className="text-sm font-black">Reduced motion</div>
                <div className="mt-1 text-[11px] text-slate-400">Pin trains instead of animating them.</div>
              </button>
              <button type="button" onClick={resetView} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left text-slate-200">
                <div className="text-sm font-black">Reset center</div>
                <div className="mt-1 text-[11px] text-slate-400">Return to the default rail view.</div>
              </button>
            </div>
          )}

          {openMenu === "dev" && DEV_SIMULATION_ENABLED && (
            <div className="mt-3 space-y-2">
              <button type="button" onClick={() => setDevSimulation((value) => !value)} className={`w-full rounded-2xl border p-3 text-left ${devSimulation ? "border-pink-300/45 bg-pink-300/14 text-pink-100" : "border-white/10 bg-white/[0.04] text-slate-200"}`}>
                <div className="text-sm font-black">Simulation trains</div>
                <div className="mt-1 text-[11px] text-slate-400">Inject local demo trains only in dev mode.</div>
              </button>
            </div>
          )}
        </div>
      )}

      {detailOpen && (
        <div className="absolute inset-x-2 bottom-2 z-30 max-h-[45vh] overflow-y-auto rounded-[30px] border border-white/10 bg-[#07090d]/94 p-3 shadow-[0_-20px_70px_rgba(0,0,0,0.62)] backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[8px] font-mono font-black uppercase tracking-[0.22em] text-slate-500">
                {selectedEMapEntity ? "Baloss agent station" : selected?.layer === "core" ? "Central interchange" : selected ? layerMeta[selected.layer].hubLabel : "Station"}
              </div>
              <h2 className="truncate text-lg font-black text-white">{selectedEMapEntity?.name || selected?.label || "Loading map"}</h2>
            </div>
            <button type="button" onClick={() => setDetailOpen(false)} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200" aria-label="Close station profile">
              <X className="h-4 w-4" />
            </button>
          </div>

          {selectedEMapEntity && snapshot && (
            <div className="mt-3 rounded-3xl border border-[#22c55e]/20 bg-[#22c55e]/[0.07] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[8px] font-mono font-black uppercase tracking-[0.22em] text-[#8dffb0]">
                    {selectedEMapEntity.type.replace(/_/g, " ")} / {selectedEMapEntity.lineId || "unrouted"}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-200">{selectedEMapEntity.description || "No description recorded for this Baloss Panel entity yet."}</p>
                </div>
                <span className="shrink-0 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[8px] font-mono font-black uppercase tracking-widest text-slate-200">
                  {selectedEMapEntity.status || "unknown"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ["Station", selectedEMapStation?.name || selectedEMapEntity.stationId || "not mapped"],
                  ["Source", selectedEMapEntity.sourceFile || "source not recorded"],
                  ["Avatar", selectedEMapEntity.avatarId || "generic"],
                  ["Dependencies", String(selectedEMapEntity.dependencies?.length || 0)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-black/25 p-2">
                    <div className="text-[7px] font-mono font-black uppercase tracking-widest text-slate-500">{label}</div>
                    <div className="mt-1 truncate text-[11px] font-black text-white">{value}</div>
                  </div>
                ))}
              </div>
              {selectedEntityControllable && selectedAgentControl && (
                <div className="mt-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[7px] font-mono font-black uppercase tracking-widest text-cyan-100">Agent controls</div>
                      <p className="mt-1 text-[10px] leading-4 text-slate-400">
                        Controls only this agent station. It does not reload PocketFlow or restart the whole map.
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-mono font-black uppercase tracking-wider ${selectedAgentControl.enabled ? "border-[#22c55e]/35 bg-[#22c55e]/10 text-[#8dffb0]" : "border-amber-300/35 bg-amber-300/10 text-amber-100"}`}>
                      {selectedAgentControl.enabled ? "enabled" : "paused"}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <button type="button" onClick={startSelectedAgent} className="flex items-center justify-center gap-1 rounded-2xl border border-[#22c55e]/30 bg-[#22c55e]/10 px-2 py-3 text-[8px] font-mono font-black uppercase tracking-widest text-[#8dffb0]">
                      <Play className="h-3.5 w-3.5" />
                      Start
                    </button>
                    <button type="button" onClick={restartSelectedAgent} className="flex items-center justify-center gap-1 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-2 py-3 text-[8px] font-mono font-black uppercase tracking-widest text-cyan-100">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restart
                    </button>
                    <button type="button" onClick={pauseSelectedAgent} className="flex items-center justify-center gap-1 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-2 py-3 text-[8px] font-mono font-black uppercase tracking-widest text-amber-100">
                      <Pause className="h-3.5 w-3.5" />
                      Pause
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2">
                    <label className="rounded-2xl border border-white/10 bg-black/25 p-2">
                      <span className="text-[7px] font-mono font-black uppercase tracking-widest text-slate-500">Runtime</span>
                      <select
                        value={selectedAgentControl.runtimeMode}
                        onChange={(event) => setSelectedAgentParameter("runtimeMode", event.target.value as AgentRuntimeMode)}
                        className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#05070a] px-2 text-xs font-black text-white outline-none"
                      >
                        <option value="auto">Auto route</option>
                        <option value="light">Light/no-model</option>
                        <option value="deep">Deep reasoning</option>
                        <option value="paused">Paused</option>
                      </select>
                    </label>
                    <label className="rounded-2xl border border-white/10 bg-black/25 p-2">
                      <span className="text-[7px] font-mono font-black uppercase tracking-widest text-slate-500">Permission</span>
                      <select
                        value={selectedAgentControl.permissionMode}
                        onChange={(event) => setSelectedAgentParameter("permissionMode", event.target.value as AgentPermissionMode)}
                        className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#05070a] px-2 text-xs font-black text-white outline-none"
                      >
                        <option value="inherit">Inherit registry</option>
                        <option value="core">Core/local only</option>
                        <option value="approved">Approved actions</option>
                        <option value="ask-first">Ask first</option>
                      </select>
                    </label>
                    <label className="rounded-2xl border border-white/10 bg-black/25 p-2">
                      <span className="text-[7px] font-mono font-black uppercase tracking-widest text-slate-500">Cadence</span>
                      <select
                        value={selectedAgentControl.cadence}
                        onChange={(event) => setSelectedAgentParameter("cadence", event.target.value as AgentControlState["cadence"])}
                        className="mt-1 h-10 w-full rounded-xl border border-white/10 bg-[#05070a] px-2 text-xs font-black text-white outline-none"
                      >
                        <option value="auto">Auto</option>
                        <option value="continuous">Continuous patrol</option>
                        <option value="background">Background saver</option>
                        <option value="manual">Manual only</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {[
                      ["Last action", selectedAgentControl.lastAction || "none"],
                      ["Restarts", String(selectedAgentControl.restartCount || 0)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl bg-white/[0.04] px-2 py-1">
                        <div className="truncate text-[7px] font-mono uppercase tracking-wider text-slate-500">{label}</div>
                        <div className="truncate text-[10px] font-black text-slate-200">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedSecurityInspector && (
                <div className="mt-2 rounded-2xl border border-rose-300/25 bg-rose-500/[0.08] p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[7px] font-mono font-black uppercase tracking-widest text-rose-100">Security intelligence</div>
                      <p className="mt-1 text-[10px] leading-4 text-slate-300">
                        Local malware scanner findings from Archive/Reader. These are risk indicators, not proof that the file executed or that data left the phone.
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-mono font-black uppercase tracking-wider ${selectedSecurityFindings.length ? "border-amber-300/35 bg-amber-300/10 text-amber-100" : "border-[#22c55e]/35 bg-[#22c55e]/10 text-[#8dffb0]"}`}>
                      {selectedSecurityFindings.length ? `${selectedSecurityFindings.length} finding${selectedSecurityFindings.length === 1 ? "" : "s"}` : "clear"}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {[
                      ["Last scan", formatTime(snapshot.archiveMaintenance.lastRunAt)],
                      ["Next scan", formatTime(snapshot.archiveMaintenance.nextRunAt)],
                      ["Scanner", snapshot.archiveMaintenance.config.malwareScan ? "enabled" : "disabled"],
                      ["Status", snapshot.archiveMaintenance.running ? "running" : "standby"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-white/10 bg-black/25 px-2 py-1.5">
                        <div className="truncate text-[7px] font-mono uppercase tracking-wider text-slate-500">{label}</div>
                        <div className="truncate text-[10px] font-black text-slate-200">{value}</div>
                      </div>
                    ))}
                  </div>

                  {selectedSecurityFindings.length ? (
                    <div className="mt-2 space-y-2">
                      {selectedSecurityFindings.slice(0, 8).map((finding) => {
                        const exposure = threatExposureSummary(finding);
                        return (
                          <div key={finding.id} className={`rounded-2xl border p-2 ${threatTone(finding.threatLevel)}`}>
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-xs font-black text-white">{finding.name}</div>
                                <div className="mt-0.5 truncate text-[8px] font-mono uppercase tracking-widest text-slate-300">
                                  {finding.threatLevel} / {finding.scanStatus} / {formatBytes(finding.size)}
                                </div>
                              </div>
                              <span className="shrink-0 rounded-full border border-white/15 bg-black/25 px-2 py-1 text-[7px] font-mono font-black uppercase tracking-wider text-slate-100">
                                {finding.extension || "file"}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-1 gap-1">
                              {[
                                ["Surface", exposure.surface],
                                ["Containment", exposure.containment],
                                ["Exposure", exposure.exposure],
                                ["Data loss", exposure.dataLoss],
                                ["Recommended", finding.recommendedAction],
                              ].map(([label, value]) => (
                                <div key={label} className="rounded-xl bg-black/20 px-2 py-1">
                                  <div className="text-[7px] font-mono font-black uppercase tracking-wider text-slate-400">{label}</div>
                                  <div className="mt-0.5 text-[10px] leading-4 text-slate-100">{value}</div>
                                </div>
                              ))}
                            </div>
                            {finding.reasons.length ? (
                              <div className="mt-2 rounded-xl bg-black/20 px-2 py-1">
                                <div className="text-[7px] font-mono font-black uppercase tracking-wider text-slate-400">Why flagged</div>
                                <ul className="mt-1 space-y-1 text-[10px] leading-4 text-slate-100">
                                  {finding.reasons.slice(0, 4).map((reason, index) => (
                                    <li key={`${finding.id}-reason-${index}`}>- {reason}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-2 rounded-2xl border border-[#22c55e]/20 bg-[#22c55e]/8 p-2">
                      <div className="text-[10px] font-black text-[#8dffb0]">No active malware findings in the Archive threat queue.</div>
                      <p className="mt-1 text-[10px] leading-4 text-slate-400">
                        If the yellow check remains, refresh Baloss Panel or run the Archive malware scan from Reader to update the cached agent health report.
                      </p>
                    </div>
                  )}

                  {selectedSecurityRecentLog.length ? (
                    <div className="mt-2 rounded-2xl border border-white/10 bg-black/25 p-2">
                      <div className="text-[7px] font-mono font-black uppercase tracking-widest text-slate-500">Recent security decisions</div>
                      <div className="mt-1 space-y-1">
                        {selectedSecurityRecentLog.map((entry) => (
                          <div key={entry.id} className="flex items-start justify-between gap-2 text-[10px] leading-4 text-slate-300">
                            <span>{entry.message}</span>
                            <span className="shrink-0 font-mono text-slate-500">{formatTime(entry.at)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => onOpenApp?.("reader")} className="rounded-2xl border border-rose-300/30 bg-rose-300/10 px-3 py-3 text-[8px] font-mono font-black uppercase tracking-widest text-rose-100">
                      Open Reader Review
                    </button>
                    <button type="button" onClick={() => void refresh(true)} className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-3 text-[8px] font-mono font-black uppercase tracking-widest text-cyan-100">
                      Refresh Findings
                    </button>
                  </div>
                </div>
              )}
              {selectedOutputRecords.length ? (
                <div className="mt-2 rounded-2xl border border-[#22c55e]/25 bg-[#22c55e]/[0.08] p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-[7px] font-mono font-black uppercase tracking-widest text-[#8dffb0]">Agent output reports</div>
                      <p className="mt-1 text-[10px] leading-4 text-slate-300">
                        TXT-style records written by the foreground-safe Baloss output jobs. Paths are Reader virtual paths until a native file writer is attached.
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-[#22c55e]/30 bg-black/30 px-2 py-1 text-[7px] font-mono font-black uppercase tracking-wider text-[#8dffb0]">
                      {selectedOutputRecords.length} txt
                    </span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {selectedOutputRecords.slice(0, 5).map((record) => (
                      <div key={record.id} className="rounded-2xl border border-white/10 bg-black/25 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-black text-white">{record.label}</div>
                            <div className="mt-0.5 truncate text-[8px] font-mono text-slate-400">{record.path}</div>
                          </div>
                          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[7px] font-mono font-black uppercase tracking-wider text-slate-200">
                            {record.severity}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] leading-4 text-slate-300">{record.summary}</p>
                        <pre className="mt-2 max-h-32 overflow-auto rounded-xl bg-black/40 p-2 text-[9px] leading-4 text-slate-300">{record.txt}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedEMapEntity.metadata && (
                <div className="mt-2 rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="text-[7px] font-mono font-black uppercase tracking-widest text-slate-500">Current metadata</div>
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    {Object.entries(selectedEMapEntity.metadata).slice(0, 8).map(([key, value]) => (
                      <div key={key} className="rounded-xl bg-white/[0.04] px-2 py-1">
                        <div className="truncate text-[7px] font-mono uppercase tracking-wider text-slate-500">{key}</div>
                        <div className="truncate text-[10px] font-black text-slate-200">{String(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/25 p-2">
                <div className="text-[7px] font-mono font-black uppercase tracking-widest text-slate-500">Recent Baloss events</div>
                <div className="mt-1 space-y-1">
                  {selectedEMapEvents.length ? selectedEMapEvents.map((event) => (
                    <p key={event.id} className="text-[10px] leading-4 text-slate-300">
                      <span className="font-mono text-[#8dffb0]">{event.type}</span> {event.message || event.status || ""}
                    </p>
                  )) : (
                    <p className="text-[10px] leading-4 text-slate-500">No recent events recorded for this agent yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedActivity && snapshot && (
            <div className="mt-3 rounded-3xl border border-cyan-300/25 bg-cyan-300/[0.08] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[8px] font-mono font-black uppercase tracking-[0.22em] text-cyan-100">Activity inspector</div>
                  <h3 className="mt-1 truncate text-sm font-black text-white">{selectedActivity.traceId || selectedActivity.id}</h3>
                </div>
                <button type="button" onClick={() => setSelectedActivityId("")} className="rounded-full border border-white/10 px-3 py-1 text-[8px] font-mono font-black uppercase tracking-wider text-slate-300">Clear</button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ["Train", selectedActivity.trainType],
                  ["Status", `${trainPurposeLabel(selectedActivity)} / ${selectedActivity.status}`],
                  ["Payload", selectedActivity.payloadType || "task"],
                  ["Agent", selectedActivity.agentIds.join(", ")],
                  ["From", snapshot.emapRuntime.stations[selectedActivity.fromStationId]?.name || selectedActivity.fromStationId],
                  ["To", snapshot.emapRuntime.stations[selectedActivity.toStationId]?.name || selectedActivity.toStationId],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-black/30 p-2">
                    <div className="text-[7px] font-mono font-black uppercase tracking-widest text-slate-500">{label}</div>
                    <div className="mt-1 truncate text-[11px] font-black text-white">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 rounded-2xl border border-white/10 bg-black/25 p-2">
                <div className="text-[7px] font-mono font-black uppercase tracking-widest text-slate-500">Related events</div>
                <div className="mt-1 space-y-1">
                  {snapshot.emapRuntime.recentEvents
                    .filter((event) => event.traceId === selectedActivity.traceId || event.agentId === selectedActivity.agentIds[0])
                    .slice(0, 5)
                    .map((event) => (
                      <p key={event.id} className="text-[10px] leading-4 text-slate-300">
                        <span className="font-mono text-cyan-100">{event.type}</span> {event.message || event.status || ""}
                      </p>
                    ))}
                </div>
              </div>
            </div>
          )}

          {selected && !selectedEMapEntity && (
            <div className="mt-3 space-y-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs leading-5 text-slate-300">{selected.detail}</p>
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-[8px] font-mono font-black uppercase tracking-widest ${statusTone[selected.status].text}`} style={{ borderColor: `${statusTone[selected.status].stroke}55`, background: statusTone[selected.status].fill }}>
                    {stationStatusLabel(selected)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-2">
                    <div className="text-[7px] font-mono font-black uppercase tracking-widest text-slate-500">Metric</div>
                    <div className="mt-1 text-xs font-black text-white">{selected.metric || "n/a"}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-2">
                    <div className="text-[7px] font-mono font-black uppercase tracking-widest text-slate-500">Source</div>
                    <div className="mt-1 text-[11px] leading-4 text-slate-300">{selected.source}</div>
                  </div>
                </div>
              </div>

              {selectedOutputRecords.length ? (
                <div className="rounded-3xl border border-[#22c55e]/20 bg-[#22c55e]/[0.07] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[8px] font-mono font-black uppercase tracking-[0.22em] text-[#8dffb0]">Output / Reader TXT</div>
                      <p className="mt-1 text-[10px] leading-4 text-slate-300">
                        These are the current agent-written reports that Baloss Core can read instead of rescanning every app.
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-[#22c55e]/30 bg-black/30 px-3 py-1 text-[8px] font-mono font-black uppercase tracking-widest text-[#8dffb0]">
                      {selectedOutputRecords.length}
                    </span>
                  </div>
                  <div className="mt-2 space-y-2">
                    {selectedOutputRecords.slice(0, 5).map((record) => (
                      <div key={record.id} className="rounded-2xl border border-white/10 bg-black/25 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-black text-white">{record.label}</div>
                            <div className="mt-0.5 truncate text-[8px] font-mono text-slate-400">{record.path}</div>
                          </div>
                          <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[7px] font-mono font-black uppercase tracking-wider text-slate-200">
                            {formatTime(record.writtenAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] leading-4 text-slate-300">{record.summary}</p>
                        <pre className="mt-2 max-h-36 overflow-auto rounded-xl bg-black/40 p-2 text-[9px] leading-4 text-slate-300">{record.txt}</pre>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <SectionButton id="actions" label="Actions / Controls" />
              {expandedSections.actions && (
                <div className="rounded-3xl border border-[#22c55e]/15 bg-[#22c55e]/[0.06] p-3">
                  <div className="grid grid-cols-2 gap-2">
                    {selected.appId && (
                      <button type="button" onClick={() => openStationApp(selected)} className="flex items-center justify-center gap-2 rounded-2xl bg-[#22c55e] px-3 py-3 text-[9px] font-mono font-black uppercase tracking-widest text-black">
                        <ExternalLink className="h-4 w-4" />
                        Open App
                      </button>
                    )}
                    {selected.controlKind === "automation" && selectedJob?.enabled && (
                      <button type="button" onClick={() => pauseJob(selected)} className="flex items-center justify-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-3 py-3 text-[9px] font-mono font-black uppercase tracking-widest text-amber-100">
                        <Pause className="h-4 w-4" />
                        Pause
                      </button>
                    )}
                    {selected.controlKind === "automation" && !selectedJob?.enabled && (
                      <button type="button" onClick={() => resumeJob(selected)} className="flex items-center justify-center gap-2 rounded-2xl border border-[#22c55e]/30 bg-[#22c55e]/10 px-3 py-3 text-[9px] font-mono font-black uppercase tracking-widest text-[#8dffb0]">
                        <Play className="h-4 w-4" />
                        Resume
                      </button>
                    )}
                    {selected.controlKind === "automation" && (
                      <>
                        <button type="button" onClick={() => runJobNow(selected)} className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-3 text-[9px] font-mono font-black uppercase tracking-widest text-cyan-100">
                          <Play className="h-4 w-4" />
                          Run Now
                        </button>
                        <button type="button" onClick={() => restartJob(selected)} className="flex items-center justify-center gap-2 rounded-2xl border border-rose-300/30 bg-rose-300/10 px-3 py-3 text-[9px] font-mono font-black uppercase tracking-widest text-rose-100">
                          <RotateCcw className="h-4 w-4" />
                          Restart
                        </button>
                        <button type="button" onClick={() => resetJobErrors(selected)} className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-[9px] font-mono font-black uppercase tracking-widest text-slate-200">
                          Reset Error Count
                        </button>
                      </>
                    )}
                    {selected.controlKind === "external" && (
                      <>
                        {selected.url && !selected.sensitive && (
                          <button type="button" onClick={() => window.open(selected.url, "_blank", "noopener,noreferrer")} className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 px-3 py-3 text-[9px] font-mono font-black uppercase tracking-widest text-cyan-100">
                            <ExternalLink className="h-4 w-4" />
                            Open URL
                          </button>
                        )}
                        <button type="button" onClick={() => requestExternalRecheck(selected)} className="flex items-center justify-center gap-2 rounded-2xl border border-[#22c55e]/30 bg-[#22c55e]/10 px-3 py-3 text-[9px] font-mono font-black uppercase tracking-widest text-[#8dffb0]">
                          <RefreshCw className="h-4 w-4" />
                          Request Check
                        </button>
                      </>
                    )}
                    <button type="button" onClick={() => void refresh(true)} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-[9px] font-mono font-black uppercase tracking-widest text-slate-200">
                      <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                      Refresh Map
                    </button>
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-slate-400">
                    Baloss Panel actions change local scheduler/app state directly. Protected server checks are marked for monitor refresh instead of exposing secrets.
                  </p>
                </div>
              )}

              <SectionButton id="runs" label="Run State / Schedule" />
              {expandedSections.runs && (
                <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      ["Kind", selected.controlKind || selected.layer],
                      ["Status", selectedJob ? `${jobStatusLabel(selectedJob)} / ${selectedJob.status}` : stationStatusLabel(selected)],
                      ["Last run", selectedJob ? formatTime(selectedJob.lastRunAt) : formatTime(selected.lastRunAt)],
                      ["Next run", selectedJob ? formatTime(selectedJob.nextRunAt) : formatTime(selected.nextRunAt)],
                      ["Enabled", selectedJob ? (selectedJob.enabled ? "yes" : "paused") : selected.appId ? "openable" : "n/a"],
                      ["Failures", selectedJob ? String(selectedJob.failureCount) : selected.status === "blocked" ? "needs check" : "n/a"],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-white/10 bg-black/30 p-2">
                        <div className="text-[7px] font-mono font-black uppercase tracking-widest text-slate-500">{label}</div>
                        <div className="mt-1 truncate text-[11px] font-black text-white">{value}</div>
                      </div>
                    ))}
                  </div>
                  {selectedJob?.lastMessage && (
                    <div className="mt-2 rounded-2xl border border-white/10 bg-black/25 p-2">
                      <div className="text-[7px] font-mono font-black uppercase tracking-widest text-slate-500">Last message</div>
                      <p className="mt-1 text-[11px] leading-4 text-slate-300">{selectedJob.lastMessage}</p>
                    </div>
                  )}
                  {(selected.url || selected.functions?.length || selected.group) && (
                    <div className="mt-2 rounded-2xl border border-cyan-300/18 bg-cyan-300/8 p-2">
                      <div className="text-[7px] font-mono font-black uppercase tracking-widest text-cyan-100">
                        {selected.group || "External connection"}
                      </div>
                      <div className="mt-1 truncate text-[10px] font-mono text-slate-300">{selected.url || "Endpoint not configured"}</div>
                      {selected.functions?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {selected.functions.slice(0, 10).map((fn) => (
                            <span key={fn} className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[8px] font-mono font-black uppercase tracking-wider text-slate-300">
                              {fn}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {selected.sensitive ? (
                        <div className="mt-2 text-[10px] leading-4 text-amber-100/80">
                          Sensitive route. Baloss Panel keeps it controllable through status/check state without showing credentials.
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

              <SectionButton id="telemetry" label="Telemetry / Recent Events" />
              {expandedSections.telemetry && (
                <div className="rounded-3xl border border-purple-300/15 bg-purple-300/[0.06] p-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                      <div className="text-[7px] font-mono font-black uppercase tracking-widest text-slate-500">Active</div>
                      <div className="mt-1 text-sm font-black text-[#8dffb0]">{snapshot.emapRuntime.healthSummary.active + snapshot.emapRuntime.healthSummary.busy}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                      <div className="text-[7px] font-mono font-black uppercase tracking-widest text-slate-500">Monitoring</div>
                      <div className="mt-1 text-sm font-black text-purple-100">{snapshot.emapRuntime.healthSummary.monitoring}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                      <div className="text-[7px] font-mono font-black uppercase tracking-widest text-slate-500">Errors</div>
                      <div className="mt-1 text-sm font-black text-rose-100">{snapshot.emapRuntime.healthSummary.error + snapshot.emapRuntime.healthSummary.blocked}</div>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1">
                    {snapshot.emapRuntime.recentEvents.slice(0, 8).map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => {
                          const train = recordValues<EMapTrain>(snapshot.emapRuntime.activeTrains).find((item) => item.traceId === event.traceId || item.agentIds.includes(event.agentId));
                          if (train) setSelectedActivityId(train.id);
                        }}
                        className="w-full rounded-2xl border border-white/10 bg-black/25 p-2 text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[10px] font-mono font-black uppercase tracking-wider text-purple-100">{event.type}</span>
                          <span className="shrink-0 text-[8px] font-mono text-slate-500">{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-400">{event.message || event.agentId}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <SectionButton id="repair" label="Repair / Next Check" />
              {expandedSections.repair && (
                <div className="rounded-2xl border border-amber-300/20 bg-amber-300/8 p-3">
                  <div className="flex items-center gap-2 text-[8px] font-mono font-black uppercase tracking-widest text-amber-200">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Suggested action
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-amber-50/80">{selected.repair}</p>
                </div>
              )}

              <SectionButton id="children" label="Connections / Child Stations" />
              {expandedSections.children && (
                <div className="grid grid-cols-1 gap-2">
                  {selectedChildren.slice(0, 18).map((station) => (
                    <button
                      key={station.id}
                      type="button"
                      onClick={() => selectStation(station)}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="min-w-0 truncate text-xs text-white">{station.label}</strong>
                        <span className={`shrink-0 text-[8px] font-mono font-black uppercase tracking-wider ${statusTone[station.status].text}`}>
                          {stationStatusLabel(station)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-400">{station.detail}</p>
                    </button>
                  ))}
                  {!selectedChildren.length && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs font-semibold text-slate-400">
                      No direct connected station recorded.
                    </div>
                  )}
                </div>
              )}

              <SectionButton id="log" label="Control Log" />
              {expandedSections.log && (
                <div className="space-y-2">
                  {relatedLog.length ? relatedLog.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-white/10 bg-black/25 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="truncate text-[11px] text-white">{entry.action}</strong>
                        <span className="shrink-0 text-[8px] font-mono text-slate-500">{formatTime(entry.at)}</span>
                      </div>
                      <p className="mt-1 text-[10px] leading-4 text-slate-400">{entry.result}</p>
                    </div>
                  )) : (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs font-semibold text-slate-400">
                      No control actions logged for this station yet.
                    </div>
                  )}
                </div>
              )}

              <SectionButton id="raw" label="Raw Debug JSON" />
              {expandedSections.raw && (
                <pre className="max-h-52 overflow-auto rounded-2xl border border-white/10 bg-black/45 p-3 text-[9px] leading-4 text-slate-300">
                  {JSON.stringify({
                    station: selected,
                    job: selectedJob,
                    emapEntity: snapshot.emapRegistry.entities.find((entity) => entity.stationId === selected.id || entity.id === selected.id.replace(/^(agent|app|job|external)-/, "$1-")),
                    relatedEvents: snapshot.emapRuntime.recentEvents.filter((event) => event.agentId === selected.id || event.toStationId === selected.id).slice(0, 8),
                  }, null, 2)}
                </pre>
              )}
            </div>
          )}

          <div className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#8dffb0]">
                {statusFilter === "all" ? "Visible child stations" : `${statusTone[statusFilter].label} child stations`}
              </div>
              <span className="text-[9px] font-mono text-slate-500">
                {snapshot ? new Date(snapshot.refreshedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "loading"}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {focusedStations.slice(0, 18).map((station) => (
                <button
                  key={station.id}
                  type="button"
                  onClick={() => selectStation(station)}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong className="min-w-0 truncate text-xs text-white">{station.label}</strong>
                    <span className={`shrink-0 text-[8px] font-mono font-black uppercase tracking-wider ${statusTone[station.status].text}`}>
                      {stationStatusLabel(station)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-400">{station.detail}</p>
                </button>
              ))}
              {!focusedStations.length && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs font-semibold text-slate-400">
                  No child stations match this sector/status filter.
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-[#22c55e]/15 bg-[#22c55e]/8 p-2 text-[10px] leading-4 text-slate-400">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#8dffb0]" />
            Auto-refreshes from source registries every 12 seconds plus storage, focus and agent events.
          </div>
        </div>
      )}

    </div>
  );
}
