import { BALOSS_DEFAULT_JOBS, type BalossDurableJob } from "../utils/balossDurableScheduler";
import { SPINO_AGENT_NODES, SPINO_RESERVED_AGENT_SLOTS, type SpinoAgentNode } from "../utils/spinoOrchestrator";
import { POCKETFLOW_APP_TOOLS } from "../utils/spinoTools";
import { TANUKI_SERVER_INVENTORY } from "../data/tanukiServerInventory";
import type { EMapEntity, EMapEntityType, EMapTrainType } from "./types";

const agentType = (agent: SpinoAgentNode): EMapEntityType => {
  if (["server", "automation", "hardware"].includes(agent.id)) return "monitor_agent";
  if (["model", "voice"].includes(agent.id)) return "model";
  if (["memory", "bigbrain"].includes(agent.id)) return "memory";
  if (["archive", "reader", "media"].includes(agent.id)) return "archive";
  if (["security", "settings"].includes(agent.id)) return "security";
  return "agent";
};

const lineForAgent = (agent: SpinoAgentNode) => {
  if (agent.id === "builder") return "builder";
  if (["server", "automation", "hardware"].includes(agent.id)) return "monitor";
  if (["memory", "archive", "reader", "bigbrain", "media", "meeting"].includes(agent.id)) return "memory";
  if (["model", "voice", "research"].includes(agent.id)) return "model";
  if (["news", "newsletter", "moltbook", "crm"].includes(agent.id)) return "automation";
  if (["security", "settings"].includes(agent.id)) return "security";
  return "mainBrain";
};

const trainForType = (type: EMapEntityType, lineId?: string): EMapTrainType => {
  if (type === "memory" || type === "archive" || type === "external_module" || lineId === "memory") return "cargo";
  if (type === "model" || type === "server" || lineId === "server" || lineId === "model") return "shinkansen";
  return "steam";
};

const appMapAlias: Record<string, string> = {
  reader: "app-receive",
};


const avatarForAgent = (agent: SpinoAgentNode, type: EMapEntityType) => {
  const agentId = String(agent.id);
  if (agentId === "builder") return "avatar-builder";
  if (agentId === "cursor" || agentId === "device-control" || agentId === "system") return "avatar-fixer";
  if (agentId === "news") return "avatar-news";
  if (agentId === "newsletter") return "avatar-newsletter";
  if (agentId === "moltbook") return "avatar-moltbook";
  if (agentId === "crm" || agentId === "communications") return "avatar-crm";
  if (agentId === "relay") return "avatar-relay";
  if (agentId === "radar") return "avatar-radar";
  if (agentId === "payments") return "avatar-payments";
  if (type === "monitor_agent") return "avatar-monitor";
  if (type === "memory") return "avatar-memory";
  if (type === "model") return "avatar-model-runner";
  if (type === "security") return "avatar-security";
  return "avatar-agent";
};

const parkingYardEntities: EMapEntity[] = [
  {
    id: "parking-yard-agents",
    name: "Agent Parking Yard",
    type: "queue",
    description: "Holding yard for standby specialist agents. Parked agents wait here instead of freezing on active rails.",
    sourceFile: "receive-hub/src/emap/agentRegistry.ts",
    status: "idle",
    lineId: "unknown",
    stationId: "station-parking-yard-agents",
    avatarId: "avatar-yard",
    dependencies: ["llboss-main-brain"],
    metadata: { parkingYard: true, accepts: ["standby agents", "paused workers"] },
  },
  {
    id: "parking-yard-automation",
    name: "Automation Parking Yard",
    type: "queue",
    description: "Holding yard for paused, parked or not-yet-due automation workers.",
    sourceFile: "receive-hub/src/emap/agentRegistry.ts",
    status: "idle",
    lineId: "automation",
    stationId: "station-parking-yard-automation",
    avatarId: "avatar-yard",
    dependencies: ["llboss-main-brain", "agent-automation"],
    metadata: { parkingYard: true, accepts: ["paused jobs", "parked newsletter agents"] },
  },
  {
    id: "parking-yard-planning",
    name: "Planning Yard",
    type: "queue",
    description: "Waiting-for-planning yard for WTP agents and future route designs.",
    sourceFile: "receive-hub/src/emap/agentRegistry.ts",
    status: "idle",
    lineId: "unknown",
    stationId: "station-parking-yard-planning",
    avatarId: "avatar-yard",
    dependencies: ["llboss-main-brain"],
    metadata: { parkingYard: true, accepts: ["WTP", "reserved slots", "future agents"] },
  },
];

const learningLoopEntities: EMapEntity[] = [
  {
    id: "learning-supervisor",
    name: "Learning Supervisor",
    type: "monitor_agent",
    description: "Supervisor that coordinates owner-style learning, preference extraction and safe memory promotion into Baloss Core.",
    sourceFile: "receive-hub/src/emap/agentRegistry.ts",
    status: "monitoring",
    lineId: "memory",
    stationId: "station-learning-supervisor",
    avatarId: "avatar-learning",
    dependencies: ["llboss-main-brain", "agent-memory", "agent-research"],
    monitors: ["conversation-memory", "builder-prompts", "notes-voice-drafts", "owner-corrections"],
    metadata: {
      trainType: "cargo",
      supervision: "owner style + preference learning loop",
      reportsTo: "llboss-main-brain",
      cadence: "continuous low-load observation",
      outputPath: "/reader/baloss/learning/YYYY/MM/DD/supervisor.txt",
    },
  },
  {
    id: "owner-style-teacher",
    name: "Owner Style Teacher",
    type: "monitor_agent",
    description: "Learns how Tommy writes, corrects, prioritizes and phrases intent so Baloss can answer and act more like the owner.",
    sourceFile: "receive-hub/src/emap/agentRegistry.ts",
    status: "monitoring",
    lineId: "memory",
    stationId: "station-owner-style-teacher",
    avatarId: "avatar-style-teacher",
    dependencies: ["learning-supervisor", "agent-memory", "app-notes", "app-builder"],
    monitors: ["conversation-turns", "voice-transcripts", "builder-box-edits", "accepted-corrections"],
    metadata: {
      trainType: "cargo",
      learningType: "style mimicry without private leakage",
      reportsTo: "learning-supervisor",
      output: "style rules + phrasing patterns",
      outputPath: "/reader/baloss/learning/YYYY/MM/DD/owner-style.txt",
    },
  },
  {
    id: "preference-pattern-teacher",
    name: "Preference Pattern Teacher",
    type: "monitor_agent",
    description: "Extracts stable preferences, recurring decisions and do-not-repeat mistakes from app usage and conversation memory.",
    sourceFile: "receive-hub/src/emap/agentRegistry.ts",
    status: "monitoring",
    lineId: "memory",
    stationId: "station-preference-pattern-teacher",
    avatarId: "avatar-preference-teacher",
    dependencies: ["learning-supervisor", "agent-memory", "app-reader", "app-systemmap"],
    monitors: ["manual-overrides", "dismissed-suggestions", "campaign-edits", "map-control-actions"],
    metadata: {
      trainType: "cargo",
      learningType: "preference extraction",
      reportsTo: "learning-supervisor",
      output: "stable preference memory + action constraints",
      outputPath: "/reader/baloss/learning/YYYY/MM/DD/preferences.txt",
    },
  },
];

const dependenciesForAgent = (agent: SpinoAgentNode) => {
  const deps = new Set<string>(["llboss-main-brain"]);
  if (agent.onlineRequired) deps.add("server-network-hub");
  if (agent.localCapable) deps.add("local-model-router");
  for (const app of agent.apps) {
    const appTool = POCKETFLOW_APP_TOOLS.find((tool) => tool.label.toLowerCase() === app.toLowerCase());
    if (appTool) deps.add(`app-${appTool.id}`);
  }
  return [...deps];
};

export interface EMapRegistrySnapshot {
  entities: EMapEntity[];
  discoveredFrom: string[];
  plannedEntities: EMapEntity[];
}

const uniqueEntities = (entities: EMapEntity[]) => {
  const byId = new Map<string, EMapEntity>();
  for (const entity of entities) {
    const existing = byId.get(entity.id);
    if (!existing) {
      byId.set(entity.id, entity);
      continue;
    }
    byId.set(entity.id, {
      ...existing,
      description: existing.description || entity.description,
      dependencies: [...new Set([...(existing.dependencies || []), ...(entity.dependencies || [])])],
      monitors: [...new Set([...(existing.monitors || []), ...(entity.monitors || [])])],
      monitoredBy: [...new Set([...(existing.monitoredBy || []), ...(entity.monitoredBy || [])])],
      metadata: { ...(existing.metadata || {}), ...(entity.metadata || {}) },
    });
  }
  return [...byId.values()];
};

export const createEMapRegistrySnapshot = (jobs: BalossDurableJob[] = BALOSS_DEFAULT_JOBS): EMapRegistrySnapshot => {
  const entities: EMapEntity[] = [
    {
      id: "llboss-main-brain",
      name: "LLBoss Main Brain",
      type: "main_brain",
      description: "Central PocketFlow intelligence balance station: dispatches model, memory, tools and automation lanes.",
      sourceFile: "receive-hub/src/components/SystemMapApp.tsx",
      status: "active",
      lineId: "mainBrain",
      stationId: "station-llboss-main-brain",
      avatarId: "avatar-main-brain",
      colorToken: "mainBrain",
      dependencies: [],
      metadata: { role: "central station", production: true },
    },
    {
      id: "local-model-router",
      name: "Local Model Router",
      type: "model",
      description: "Baloss runtime/model routing layer for local and API reasoning paths.",
      sourceFile: "receive-hub/src/utils/spinoLLMEngine.ts",
      status: "sleeping",
      lineId: "model",
      avatarId: "avatar-model-runner",
      dependencies: ["llboss-main-brain"],
      metadata: { trainType: "shinkansen" },
    },
    {
      id: "policy-safety-control",
      name: "Policy / Safety Control",
      type: "security",
      description: "Permission and safety checkpoint for owner-approved automation and native actions.",
      sourceFile: "receive-hub/src/utils/spinoOrchestrator.ts",
      status: "idle",
      lineId: "security",
      avatarId: "avatar-security",
      dependencies: ["llboss-main-brain"],
    },
    {
      id: "server-network-hub",
      name: "Server / Network Hub",
      type: "server",
      description: "Public/private route hub for Tanuki server, relay, API and monitor surfaces.",
      sourceFile: "receive-hub/src/data/tanukiServerInventory.ts",
      status: "idle",
      lineId: "server",
      avatarId: "avatar-server",
      dependencies: ["llboss-main-brain", "policy-safety-control"],
    },
  ];

  for (const agent of SPINO_AGENT_NODES) {
    const type = agentType(agent);
    const lineId = lineForAgent(agent);
    entities.push({
      id: `agent-${agent.id}`,
      name: agent.label,
      type,
      description: agent.role,
      sourceFile: "receive-hub/src/utils/spinoOrchestrator.ts",
      status: agent.onlineRequired ? "idle" : "sleeping",
      lineId,
      stationId: `station-agent-${agent.id}`,
      avatarId: avatarForAgent(agent, type),
      colorToken: lineId,
      dependencies: dependenciesForAgent(agent),
      monitors: agent.id === "server" ? ["external-server-services", "automation-scheduler"] : undefined,
      metadata: {
        permission: agent.permission,
        onlineRequired: agent.onlineRequired,
        localCapable: agent.localCapable,
        tools: agent.tools,
        apps: agent.apps,
        trainType: trainForType(type, lineId),
      },
    });
  }

  for (const app of POCKETFLOW_APP_TOOLS) {
    entities.push({
      id: `app-${app.id}`,
      name: app.label,
      type: "tool",
      description: app.summary,
      sourceFile: "receive-hub/src/utils/spinoTools.ts",
      status: app.nativeRequired ? "idle" : "sleeping",
      lineId:
        app.id === "systemmap"
          ? "monitor"
          : app.id === "builder"
            ? "builder"
            : app.id === "reader" || app.id === "receive"
              ? "memory"
              : "mainBrain",
      stationId: `station-app-${app.id}`,
      avatarId: "avatar-tool",
      dependencies: ["llboss-main-brain"],
      metadata: {
        aliases: app.aliases,
        readable: app.readable,
        automatable: app.automatable,
        nativeRequired: app.nativeRequired,
        mapAliasOf: appMapAlias[app.id],
        mapDisplayLevel: appMapAlias[app.id] ? "detail" : undefined,
      },
    });
  }

  for (const job of jobs) {
    entities.push({
      id: `automation-${job.id}`,
      name: job.label,
      type: "automation",
      description: `${job.kind} owned by ${job.owner}.`,
      sourceFile: "receive-hub/src/utils/balossDurableScheduler.ts",
      status: job.enabled ? (job.status === "running" ? "busy" : job.status === "failed" ? "error" : "idle") : "sleeping",
      lineId: "automation",
      stationId: `station-automation-${job.id}`,
      avatarId: job.owner === "news" ? "avatar-newsletter" : job.owner === "moltbook" ? "avatar-moltbook" : "avatar-agent",
      dependencies: [
            "llboss-main-brain",
            job.owner === "moltbook"
              ? "agent-moltbook"
              : job.owner === "news"
                ? "agent-news"
                  : "agent-automation",
          ],
      metadata: {
        kind: job.kind,
        owner: job.owner,
        enabled: job.enabled,
        lastRunAt: job.lastRunAt,
        nextRunAt: job.nextRunAt,
        failureCount: job.failureCount,
        campaignAgent: job.kind === "newsletter_send",
        campaignAgentName: job.kind === "newsletter_send" ? `${job.label} Agent` : undefined,
        monitors: job.kind === "newsletter_send" ? [`newsletter-job-${job.id}`, "newsletter-dedupe-lock", "crm-send-handoff"] : undefined,
        trainType: job.owner === "archive" || job.owner === "bigbrain" ? "cargo" : "steam",
      },
    });
  }

  for (const service of TANUKI_SERVER_INVENTORY) {
    entities.push({
      id: `server-${service.id}`,
      name: service.label,
      type: "server",
      description: service.description,
      sourceFile: "receive-hub/src/data/tanukiServerInventory.ts",
      status: service.url ? "idle" : "offline",
      lineId: "server",
      stationId: `station-server-${service.id}`,
      avatarId: "avatar-server",
      dependencies: ["server-network-hub"],
      monitoredBy: ["agent-server"],
      metadata: { group: service.group, url: service.url, functions: service.functions, sensitive: service.sensitive, trainType: "shinkansen" },
    });
  }

  entities.push(...parkingYardEntities, ...learningLoopEntities);

  entities.push(
    {
      id: "agent-malware-files",
      name: "Malware File Scanner",
      type: "monitor_agent",
      description: "Continuous file-level malware scanner for Reader, Archive, downloads, imported files and external storage records.",
      sourceFile: "receive-hub/src/emap/agentRegistry.ts",
      status: "idle",
      lineId: "security",
      stationId: "station-agent-malware-files",
      avatarId: "avatar-malware",
      dependencies: ["policy-safety-control", "app-reader", "agent-archive"],
      monitors: ["reader-archive-files", "downloaded-files", "external-storage-records"],
      metadata: { trainType: "cargo", scanType: "file-malware", cadence: "continuous sweep" },
    },
    {
      id: "agent-malware-entrypoints",
      name: "Malware Entry Scanner",
      type: "monitor_agent",
      description: "Continuous entry-point scanner for web routes, relay intake, server endpoints, installed app bridges and automation gates.",
      sourceFile: "receive-hub/src/emap/agentRegistry.ts",
      status: "idle",
      lineId: "security",
      stationId: "station-agent-malware-entrypoints",
      avatarId: "avatar-malware",
      dependencies: ["policy-safety-control", "server-network-hub", "agent-relay"],
      monitors: ["relay-intake", "public-server-routes", "native-bridge-entrypoints", "automation-gates"],
      metadata: { trainType: "shinkansen", scanType: "entrypoint-malware", cadence: "continuous sweep" },
    },
    {
      id: "bigbrain-external-memory",
      name: "BigBrain / Tommyboy External Memory",
      type: "external_module",
      description: "ExternalEmpowermentsController memory, corpus, API, quick backup and semantic queue.",
      sourceFile: "ExternalEmpowermentsController/empowerment/core.py",
      status: "idle",
      lineId: "memory",
      stationId: "station-bigbrain-external-memory",
      avatarId: "avatar-memory",
      dependencies: ["agent-bigbrain", "app-reader"],
      metadata: { trainType: "cargo", module: "ExternalEmpowermentsController" },
    },
    {
      id: "codex-relay-queue",
      name: "Codex Relay Queue",
      type: "queue",
      description: "Desktop relay queue and worker event stream used by phone-to-Codex handoffs.",
      sourceFile: "receive-hub/scripts/codex-relay-server.mjs",
      status: "idle",
      lineId: "server",
      stationId: "station-codex-relay-queue",
      avatarId: "avatar-server",
      dependencies: ["agent-relay", "server-network-hub"],
      metadata: { trainType: "cargo", queue: "prompt-queue.jsonl" },
    },
  );

  entities.push(
    {
      id: "transport-collector-fleet",
      name: "Transport Collector Fleet",
      type: "monitor_agent",
      description: "Grouped low-load collectors that patrol app/server summary boxes during a 24h round and deliver compact state to Baloss Core.",
      sourceFile: "receive-hub/src/emap/agentRegistry.ts",
      status: "idle",
      lineId: "automation",
      stationId: "station-transport-collector-fleet",
      avatarId: "avatar-transport",
      dependencies: ["agent-automation", "app-systemmap", "app-reader"],
      monitors: ["app-hubs", "server-summary-boxes", "automation-run-state", "reader-archive-summaries"],
      metadata: {
        trainType: "cargo",
        cadence: "5 collectors staggered across 24h",
        collectorCount: 5,
        planned: false,
        parkingLot: "transport-active-yard",
        route: "app/server summary boxes -> Reader memory dropbox -> Baloss Core",
        jobId: "transport-dropbox-hourly",
        outputPath: "/reader/dropbox/YYYY/MM/DD/transport-summary.txt",
      },
    },
    {
      id: "moltbook-archive-writer",
      name: "Moltbook Archive Writer",
      type: "automation",
      description: "Writer that converts daily Moltbook posts/comments into TXT-style folders inside Reader by year/month/day.",
      sourceFile: "receive-hub/src/emap/agentRegistry.ts",
      status: "idle",
      lineId: "memory",
      stationId: "station-moltbook-archive-writer",
      avatarId: "avatar-moltbook",
      dependencies: ["agent-moltbook", "app-moltbook", "app-reader"],
      monitors: ["moltbook-post-history", "moltbook-comment-history", "reader-moltbook-daily-txt"],
      metadata: {
        trainType: "cargo",
        cadence: "daily export",
        planned: false,
        route: "Moltbook -> daily summary -> Reader /moltbook/YYYY/MM/DD",
        jobId: "moltbook-daily-txt-2330",
        outputPath: "/reader/moltbook/YYYY/MM/DD/summary.txt",
      },
    },
  );

  const plannedEntities: EMapEntity[] = SPINO_RESERVED_AGENT_SLOTS.length
    ? [{
        id: "planned-agent-pool",
        name: "Planned Agent Pool",
        type: "queue",
        description: `${SPINO_RESERVED_AGENT_SLOTS.length} reserved agent slots parked here until a real app, credential or bridge exists.`,
        sourceFile: "receive-hub/src/utils/spinoOrchestrator.ts",
        status: "idle",
        lineId: "unknown",
        stationId: "station-planned-agent-pool",
        avatarId: "avatar-yard",
        dependencies: ["parking-yard-planning"],
        metadata: {
          planned: true,
          ready: true,
          parkingLot: "future-agent-parking-yard",
          reservedSlots: SPINO_RESERVED_AGENT_SLOTS.map((slot) => ({
            id: slot.id,
            label: slot.label,
            purpose: slot.purpose,
            activation: slot.activation,
          })),
        },
      }]
    : [];

  return {
    entities: uniqueEntities([...entities, ...plannedEntities]),
    plannedEntities,
    discoveredFrom: [
      "receive-hub/src/utils/spinoOrchestrator.ts",
      "receive-hub/src/utils/spinoTools.ts",
      "receive-hub/src/utils/balossDurableScheduler.ts",
      "receive-hub/src/data/tanukiServerInventory.ts",
      "receive-hub/scripts/codex-relay-server.mjs",
      "ExternalEmpowermentsController/empowerment/core.py",
    ],
  };
};
