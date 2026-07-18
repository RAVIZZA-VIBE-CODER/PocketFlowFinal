export type PublicServerInventoryHealth = "healthy" | "warning" | "blocked" | "down" | "checking" | "unknown";

export interface PublicServerInventoryService {
  id: string;
  label: string;
  group: string;
  url: string;
  description: string;
  functions: string[];
  sensitive?: boolean;
}

export interface PublicServerStoredRuntime {
  health?: PublicServerInventoryHealth;
  message?: string;
  latencyMs?: number;
  checkedAt?: string;
  needsAction?: string;
  source?: string;
  publicState?: string;
  localState?: string;
  evidence?: string[];
}

export const PUBLIC_SERVER_RUNTIME_STORAGE_KEY = "pocketflow.publicDemo.serverRuntime.v1";

export const PUBLIC_SERVER_INVENTORY: PublicServerInventoryService[] = [
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

export const loadPublicServerRuntime = () => {
  try {
    const stored = localStorage.getItem(PUBLIC_SERVER_RUNTIME_STORAGE_KEY);
    if (!stored) return {} as Record<string, PublicServerStoredRuntime>;
    return JSON.parse(stored) as Record<string, PublicServerStoredRuntime>;
  } catch {
    return {} as Record<string, PublicServerStoredRuntime>;
  }
};
