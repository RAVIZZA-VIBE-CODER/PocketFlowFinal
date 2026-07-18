export type TanukiServerInventoryHealth = "healthy" | "warning" | "blocked" | "down" | "checking" | "unknown";

export interface TanukiServerInventoryService {
  id: string;
  label: string;
  group: string;
  url: string;
  description: string;
  functions: string[];
  sensitive?: boolean;
}

export interface TanukiServerStoredRuntime {
  health?: TanukiServerInventoryHealth;
  message?: string;
  latencyMs?: number;
  checkedAt?: string;
  needsAction?: string;
  source?: string;
  publicState?: string;
  localState?: string;
  evidence?: string[];
}

export const TANUKI_SERVER_RUNTIME_STORAGE_KEY = "pocketflow.publicDemo.serverRuntime.v1";

export const TANUKI_SERVER_INVENTORY: TanukiServerInventoryService[] = [
  {
    id: "public-router",
    label: "Public Router Template",
    group: "Demo",
    url: "",
    description: "Competition-safe placeholder for app, relay and server health routes.",
    functions: ["route registry", "health labels", "agent status mapping"],
  },
  {
    id: "public-agent-gateway",
    label: "Agent Gateway Template",
    group: "Demo",
    url: "",
    description: "No private webhook endpoint is included in the public repository.",
    functions: ["signed action contract", "queue status", "operator review"],
    sensitive: true,
  },
];

export const loadTanukiServerRuntime = () => {
  try {
    const stored = localStorage.getItem(TANUKI_SERVER_RUNTIME_STORAGE_KEY);
    if (!stored) return {} as Record<string, TanukiServerStoredRuntime>;
    return JSON.parse(stored) as Record<string, TanukiServerStoredRuntime>;
  } catch {
    return {} as Record<string, TanukiServerStoredRuntime>;
  }
};
