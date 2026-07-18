import type { EMapEntity, EMapPayloadType } from "./types";

export type EMapBlock =
  | "agents"
  | "monitor_agents"
  | "models"
  | "memory_archive"
  | "tools"
  | "automations"
  | "servers"
  | "external_modules"
  | "security"
  | "active_tasks"
  | "errors";

export const EMAP_BLOCK_LABELS: Record<EMapBlock, string> = {
  agents: "Agents",
  monitor_agents: "Monitor Agents",
  models: "Models",
  memory_archive: "Memory / Archive",
  tools: "Tools",
  automations: "Automations",
  servers: "Servers",
  external_modules: "External Modules",
  security: "Security / Permissions",
  active_tasks: "Active Tasks",
  errors: "Error / Offline Systems",
};

export const getBlocksForEntity = (entity: EMapEntity): EMapBlock[] => {
  const blocks: EMapBlock[] = [];
  switch (entity.type) {
    case "agent":
      blocks.push("agents");
      break;
    case "monitor_agent":
      blocks.push("agents", "monitor_agents");
      break;
    case "model":
      blocks.push("models");
      break;
    case "memory":
    case "archive":
      blocks.push("memory_archive");
      break;
    case "tool":
      blocks.push("tools");
      break;
    case "automation":
      blocks.push("automations");
      break;
    case "server":
      blocks.push("servers");
      break;
    case "external_module":
    case "queue":
      blocks.push("external_modules");
      break;
    case "security":
      blocks.push("security");
      break;
    default:
      break;
  }
  if (entity.status === "active" || entity.status === "busy" || entity.status === "monitoring" || entity.metadata?.currentTask) {
    blocks.push("active_tasks");
  }
  if (entity.status === "error" || entity.status === "offline" || entity.status === "blocked") {
    blocks.push("errors");
  }
  return [...new Set(blocks)];
};

export const getBlocksForPayload = (payload?: EMapPayloadType): EMapBlock[] => {
  if (payload === "model_call") return ["models", "active_tasks"];
  if (payload === "memory" || payload === "file" || payload === "backup") return ["memory_archive", "active_tasks"];
  if (payload === "tool_call") return ["tools", "active_tasks"];
  if (payload === "monitoring") return ["monitor_agents", "active_tasks"];
  if (payload === "security") return ["security", "active_tasks"];
  return payload ? ["active_tasks"] : [];
};

export const matchesSelectedBlocks = (blocks: EMapBlock[], selectedBlocks: EMapBlock[]) =>
  selectedBlocks.length === 0 || blocks.some((block) => selectedBlocks.includes(block));

