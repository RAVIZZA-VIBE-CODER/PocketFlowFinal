export type AgentGatewayRating = "excellent" | "good" | "slow" | "down" | "unknown";

export interface AgentGatewayHealth {
  ok?: boolean;
  status?: number;
  ms?: number;
  message?: string;
}

export interface AgentGatewaySystem {
  id: string;
  name: string;
  url?: string;
  role?: string;
  health?: AgentGatewayHealth;
  rating: AgentGatewayRating;
  score: number;
}

export interface AgentGatewaySummary {
  items?: number;
  shopItems?: number;
  inventoryItems?: number;
  soldItems?: number;
  contacts?: number;
  materials?: number;
  updatedAt?: string;
}

export interface AgentGatewaySnapshot {
  status: "idle" | "fresh" | "partial" | "error";
  ok: boolean;
  fetchedAt: string;
  systems: AgentGatewaySystem[];
  summary?: AgentGatewaySummary;
  errors: string[];
}

const AGENT_WEBHOOK_URL = "";
const AGENT_TOKEN_KEY = "pocketflow.agentGateway.token.v1";
const AGENT_SNAPSHOT_KEY = "pocketflow.agentGateway.snapshot.v1";

const emptySnapshot = (): AgentGatewaySnapshot => ({
  status: "idle",
  ok: false,
  fetchedAt: "",
  systems: [],
  errors: [],
});

const getNativeAgentToken = async () => {
  try {
    const bridge = window.PocketFlowReceiveBridge as any;
    if (typeof bridge?.getPrivateAgentToken === "function") {
      const result = await bridge.getPrivateAgentToken();
      if (typeof result === "string") return result.trim();
      if (typeof result?.token === "string") return result.token.trim();
    }
  } catch {}
  return "";
};

export const getStoredAgentGatewayToken = async () => {
  const nativeToken = await getNativeAgentToken();
  if (nativeToken) return nativeToken;
  try {
    return (localStorage.getItem(AGENT_TOKEN_KEY) || "").trim();
  } catch {
    return "";
  }
};

export const hasStoredAgentGatewayToken = () => {
  try {
    return Boolean((localStorage.getItem(AGENT_TOKEN_KEY) || "").trim());
  } catch {
    return false;
  }
};

export const saveAgentGatewayToken = (token: string) => {
  const clean = token.trim();
  if (!clean) return false;
  localStorage.setItem(AGENT_TOKEN_KEY, clean);
  return true;
};

export const clearAgentGatewayToken = () => {
  localStorage.removeItem(AGENT_TOKEN_KEY);
};

const withTimeout = async <T,>(task: Promise<T>, timeoutMs = 9000): Promise<T> => {
  let timer = 0;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error("agent gateway timeout")), timeoutMs);
  });
  try {
    return await Promise.race([task, timeout]);
  } finally {
    window.clearTimeout(timer);
  }
};

export const callAgentGateway = async <T,>(action: string, payload: Record<string, unknown> = {}, token?: string): Promise<T> => {
  const bearer = token?.trim() || await getStoredAgentGatewayToken();
  if (!bearer) throw new Error("agent gateway token missing");
  const response = await withTimeout(fetch(AGENT_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearer}`,
    },
    cache: "no-store",
    body: JSON.stringify({ action, ...payload }),
  }));
  if (!response.ok) throw new Error(`${action} failed: ${response.status}`);
  return (await response.json()) as T;
};

const rateHealth = (health?: AgentGatewayHealth): { rating: AgentGatewayRating; score: number } => {
  if (!health || typeof health.status !== "number") return { rating: "unknown", score: 40 };
  if (!health.ok || health.status >= 400) return { rating: "down", score: 0 };
  const ms = typeof health.ms === "number" ? health.ms : 999;
  if (ms <= 180) return { rating: "excellent", score: 100 };
  if (ms <= 600) return { rating: "good", score: 78 };
  return { rating: "slow", score: 45 };
};

const normalizeSystems = (systemsPayload: any, healthPayload: any): AgentGatewaySystem[] => {
  const systems = Array.isArray(systemsPayload?.systems)
    ? systemsPayload.systems
    : Array.isArray(systemsPayload)
      ? systemsPayload
      : [];
  const healthSystems = Array.isArray(healthPayload?.systems)
    ? healthPayload.systems
    : Array.isArray(healthPayload)
      ? healthPayload
      : [];
  const healthById = new Map<string, AgentGatewayHealth>();
  healthSystems.forEach((entry: any) => {
    const id = String(entry.id || entry.key || entry.name || "");
    if (!id) return;
    healthById.set(id, entry.health || entry);
  });

  return systems.map((system: any) => {
    const id = String(system.id || system.key || system.name || "system");
    const health = healthById.get(id) || system.health;
    const rated = rateHealth(health);
    return {
      id,
      name: String(system.name || system.label || id),
      url: system.url ? String(system.url) : undefined,
      role: system.role || system.description ? String(system.role || system.description) : undefined,
      health,
      ...rated,
    };
  });
};

export const loadAgentGatewaySnapshot = (): AgentGatewaySnapshot => {
  try {
    const parsed = JSON.parse(localStorage.getItem(AGENT_SNAPSHOT_KEY) || "null");
    if (parsed && Array.isArray(parsed.systems)) return { ...emptySnapshot(), ...parsed };
  } catch {}
  return emptySnapshot();
};

const saveAgentGatewaySnapshot = (snapshot: AgentGatewaySnapshot) => {
  localStorage.setItem(AGENT_SNAPSHOT_KEY, JSON.stringify(snapshot));
};

export const refreshAgentGatewaySnapshot = async () => {
  const errors: string[] = [];
  let pingOk = false;
  let systemsPayload: any = null;
  let healthPayload: any = null;
  let summary: AgentGatewaySummary | undefined;

  try {
    const ping = await callAgentGateway<any>("ping");
    pingOk = Boolean(ping?.ok);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "ping failed");
  }
  try {
    systemsPayload = await callAgentGateway<any>("systems.list");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "systems.list failed");
  }
  try {
    healthPayload = await callAgentGateway<any>("systems.health");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "systems.health failed");
  }
  try {
    const payload = await callAgentGateway<any>("2ls.summary");
    summary = payload?.summary || payload;
  } catch {
    errors.push("2ls.summary unavailable");
  }

  const systems = normalizeSystems(systemsPayload, healthPayload).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const snapshot: AgentGatewaySnapshot = {
    status: systems.length && errors.length ? "partial" : systems.length && pingOk ? "fresh" : "error",
    ok: pingOk && systems.length > 0,
    fetchedAt: new Date().toISOString(),
    systems,
    summary,
    errors,
  };
  saveAgentGatewaySnapshot(snapshot);
  return snapshot;
};

export const shouldUseAgentGateway = (prompt: string) =>
  /\b(tanuki gateway|agent gateway|access panel|systems? health|systems? status|check ratings?|ratings?|2nd\s*life|2ls|openclaw|dashforge|moltbook|private transfer|transfer desk|web monitor|www status|navigate www)\b/i.test(prompt);

export const buildAgentGatewayContext = (snapshot: AgentGatewaySnapshot, limit = 12) => {
  if (!snapshot.systems.length) return "";
  const counts = snapshot.systems.reduce<Record<AgentGatewayRating, number>>((acc, system) => {
    acc[system.rating] += 1;
    return acc;
  }, { excellent: 0, good: 0, slow: 0, down: 0, unknown: 0 });
  return [
    "AUTHORIZED TANUKI WWW AGENT GATEWAY",
    `Fetched: ${snapshot.fetchedAt || "not yet"} / status: ${snapshot.status}`,
    `Ratings: ${counts.excellent} excellent, ${counts.good} good, ${counts.slow} slow, ${counts.down} down, ${counts.unknown} unknown.`,
    snapshot.summary
      ? `2ND LIFE summary: ${snapshot.summary.items ?? "--"} items, ${snapshot.summary.shopItems ?? "--"} shop, ${snapshot.summary.inventoryItems ?? "--"} inventory, updated ${snapshot.summary.updatedAt || "--"}.`
      : "",
    ...snapshot.systems.slice(0, limit).map((system, index) => {
      const health = system.health;
      const ms = typeof health?.ms === "number" ? `${health.ms}ms` : "no timing";
      const status = typeof health?.status === "number" ? `HTTP ${health.status}` : "unknown status";
      return `[G${index + 1}] ${system.name} / ${system.rating.toUpperCase()} / ${status} / ${ms}${system.url ? `\n${system.url}` : ""}`;
    }),
    snapshot.errors.length ? `Gateway issues: ${snapshot.errors.join("; ")}` : "",
  ].filter(Boolean).join("\n\n");
};

export const answerFromAgentGateway = (snapshot: AgentGatewaySnapshot) => {
  if (!snapshot.systems.length) {
    return snapshot.errors.length
      ? `Agent gateway did not return system ratings. ${snapshot.errors[0]}`
      : "Agent gateway has no rated systems yet.";
  }
  const counts = snapshot.systems.reduce<Record<AgentGatewayRating, number>>((acc, system) => {
    acc[system.rating] += 1;
    return acc;
  }, { excellent: 0, good: 0, slow: 0, down: 0, unknown: 0 });
  const top = snapshot.systems.slice(0, 6).map((system) => {
    const ms = typeof system.health?.ms === "number" ? `${system.health.ms}ms` : "no timing";
    return `- ${system.name}: ${system.rating} (${system.health?.status || "?"}, ${ms})`;
  }).join("\n");
  return [
    "Tanuki gateway ratings are live.",
    `${counts.excellent} excellent, ${counts.good} good, ${counts.slow} slow, ${counts.down} down, ${counts.unknown} unknown.`,
    top,
    snapshot.summary ? `2ND LIFE: ${snapshot.summary.items ?? "--"} items, ${snapshot.summary.shopItems ?? "--"} shop items, ${snapshot.summary.inventoryItems ?? "--"} inventory.` : "",
  ].filter(Boolean).join("\n\n");
};
