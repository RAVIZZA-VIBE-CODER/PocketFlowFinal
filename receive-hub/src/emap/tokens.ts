export const emapTokens = {
  background: {
    base: "#05070A",
    grid: "#101820",
    tunnel: "#141A22",
  },
  lines: {
    mainBrain: "#FFD166",
    builder: "#2DD4BF",
    fixer: "#FF8A3D",
    monitor: "#7C3AED",
    memory: "#22C55E",
    model: "#38BDF8",
    automation: "#F472B6",
    server: "#A3E635",
    security: "#EF4444",
    unknown: "#94A3B8",
  },
  status: {
    idle: "#64748B",
    active: "#22C55E",
    busy: "#FACC15",
    error: "#EF4444",
    offline: "#334155",
    sleeping: "#475569",
    monitoring: "#A78BFA",
    blocked: "#FB7185",
  },
};

export type EMapLineToken = keyof typeof emapTokens.lines;

export const emapLineLabels: Record<string, string> = {
  mainBrain: "Main Brain Line",
  builder: "Builder Line",
  fixer: "Fixer / Maintenance Line",
  monitor: "Monitor Line",
  memory: "Memory / Archive Line",
  model: "Model Line",
  automation: "Automation Line",
  server: "Server / Network Line",
  security: "Security Line",
  unknown: "Future / Unknown Line",
};
