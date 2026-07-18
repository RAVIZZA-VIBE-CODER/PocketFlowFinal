import { emapLineLabels, emapTokens } from "./tokens";
import type { EMapEntity, EMapLine, EMapRoute, EMapStation } from "./types";

const CANVAS_CENTER = { x: 3000, y: 4500 };

const lineOrder = ["mainBrain", "builder", "fixer", "monitor", "memory", "model", "automation", "server", "security", "unknown"];

const lineGeometry: Record<string, { points: Array<{ x: number; y: number }>; neighborhood: string }> = {
  mainBrain: { points: [{ x: 3000, y: 3500 }, CANVAS_CENTER, { x: 3000, y: 5500 }], neighborhood: "central" },
  builder: { points: [CANVAS_CENTER, { x: 3800, y: 5300 }, { x: 4700, y: 6800 }, { x: 5200, y: 8400 }], neighborhood: "builder-city" },
  fixer: { points: [CANVAS_CENTER, { x: 2300, y: 5800 }, { x: 1900, y: 7200 }, { x: 1250, y: 8400 }], neighborhood: "maintenance-yard" },
  monitor: { points: [CANVAS_CENTER, { x: 4000, y: 5700 }, { x: 4700, y: 7100 }, { x: 5400, y: 8400 }], neighborhood: "watch-ring" },
  memory: { points: [CANVAS_CENTER, { x: 2100, y: 3600 }, { x: 1300, y: 2300 }, { x: 700, y: 850 }], neighborhood: "deep-archive" },
  model: { points: [CANVAS_CENTER, { x: 4000, y: 3600 }, { x: 5000, y: 2400 }, { x: 5400, y: 850 }], neighborhood: "power-line" },
  automation: { points: [CANVAS_CENTER, { x: 3900, y: 5400 }, { x: 4400, y: 6700 }, { x: 5050, y: 8200 }], neighborhood: "automation-loop" },
  server: { points: [CANVAS_CENTER, { x: 2050, y: 4050 }, { x: 1300, y: 3150 }, { x: 650, y: 1850 }], neighborhood: "terminal-depots" },
  security: { points: [CANVAS_CENTER, { x: 2050, y: 5050 }, { x: 1300, y: 6450 }, { x: 650, y: 8200 }], neighborhood: "checkpoint-line" },
  unknown: { points: [CANVAS_CENTER, { x: 3000, y: 3350 }, { x: 3000, y: 2050 }, { x: 3000, y: 800 }], neighborhood: "ghost-yard" },
};

const customEntityPoints: Record<string, { x: number; y: number; neighborhood: string }> = {
  "parking-yard-agents": { x: 980, y: 8500, neighborhood: "agent-parking-yard" },
  "parking-yard-automation": { x: 5350, y: 8400, neighborhood: "automation-parking-yard" },
  "parking-yard-planning": { x: 3000, y: 8350, neighborhood: "planning-yard" },
  "planned-agent-pool": { x: 3000, y: 7900, neighborhood: "planning-yard" },
  "transport-collector-fleet": { x: 4550, y: 7550, neighborhood: "automation-loop" },
  "learning-supervisor": { x: 1450, y: 5050, neighborhood: "learning-loop" },
  "owner-style-teacher": { x: 1180, y: 5600, neighborhood: "learning-loop" },
  "preference-pattern-teacher": { x: 1720, y: 5600, neighborhood: "learning-loop" },
};

const toPoint = (lineId: string, index: number) => {
  const geometry = lineGeometry[lineId] || lineGeometry.unknown;
  const segment = index % Math.max(1, geometry.points.length - 1);
  const lap = Math.floor(index / Math.max(1, geometry.points.length - 1));
  const from = geometry.points[segment];
  const to = geometry.points[segment + 1] || geometry.points[geometry.points.length - 1];
  const laneOffset = lap * 180;
  const t = 0.34 + (index % 3) * 0.22;
  return {
    x: Math.round(from.x + (to.x - from.x) * t + laneOffset),
    y: Math.round(from.y + (to.y - from.y) * t + laneOffset * 0.35),
  };
};

const mergeEntities = (current: EMapEntity, incoming: EMapEntity): EMapEntity => ({
  ...current,
  description: current.description || incoming.description,
  dependencies: [...new Set([...(current.dependencies || []), ...(incoming.dependencies || [])])],
  monitors: [...new Set([...(current.monitors || []), ...(incoming.monitors || [])])],
  monitoredBy: [...new Set([...(current.monitoredBy || []), ...(incoming.monitoredBy || [])])],
  metadata: {
    ...(incoming.metadata || {}),
    ...(current.metadata || {}),
    mergedMapEntityIds: [
      ...new Set([
        ...((current.metadata?.mergedMapEntityIds as string[] | undefined) || []),
        current.id,
        incoming.id,
      ]),
    ],
  },
});

const canonicalizeMapEntities = (entities: EMapEntity[]) => {
  const aliases = new Map<string, string>();
  entities.forEach((entity) => {
    const alias = entity.metadata?.mapAliasOf;
    if (typeof alias === "string" && alias.trim()) aliases.set(entity.id, alias);
  });

  const resolve = (id: string): string => {
    let current = id;
    const seen = new Set<string>();
    while (aliases.has(current) && !seen.has(current)) {
      seen.add(current);
      current = aliases.get(current) || current;
    }
    return current;
  };

  const byId = new Map<string, EMapEntity>();
  entities.forEach((entity) => {
    const canonicalId = resolve(entity.id);
    const rewritten: EMapEntity = {
      ...entity,
      id: canonicalId,
      dependencies: (entity.dependencies || []).map(resolve).filter((dependency) => dependency !== canonicalId),
      metadata: { ...(entity.metadata || {}), mapMergedFrom: entity.id === canonicalId ? undefined : entity.id },
    };
    const existing = byId.get(canonicalId);
    byId.set(canonicalId, existing ? mergeEntities(existing, rewritten) : rewritten);
  });

  return [...byId.values()];
};

export const generateEMapMetroGraph = (entities: EMapEntity[]) => {
  const mapEntities = canonicalizeMapEntities(entities);
  const byLine = new Map<string, EMapEntity[]>();
  for (const entity of mapEntities) {
    const lineId = entity.lineId || "unknown";
    byLine.set(lineId, [...(byLine.get(lineId) || []), entity]);
  }

  const lines: Record<string, EMapLine> = {};
  for (const lineId of lineOrder) {
    const lineEntities = byLine.get(lineId) || [];
    if (!lineEntities.length && lineId !== "fixer") continue;
    lines[lineId] = {
      id: lineId,
      name: emapLineLabels[lineId] || `${lineId} Line`,
      color: emapTokens.lines[lineId as keyof typeof emapTokens.lines] || emapTokens.lines.unknown,
      entityIds: lineEntities.map((entity) => entity.id),
      description: `${lineEntities.length} discovered eMAP entit${lineEntities.length === 1 ? "y" : "ies"}.`,
    };
  }

  const stations: Record<string, EMapStation> = {};
  const routes: Record<string, EMapRoute> = {};
  const routeKeys = new Set<string>();
  const entityStation = new Map<string, string>();
  const addRoute = (route: EMapRoute) => {
    const pairKey = [route.fromStationId, route.toStationId].sort().join("::");
    const key = `${route.lineId}:${route.dependency ? "dependency" : "line"}:${pairKey}`;
    if (routeKeys.has(key)) return;
    routeKeys.add(key);
    routes[route.id] = route;
  };

  stations["station-llboss-main-brain"] = {
    id: "station-llboss-main-brain",
    entityId: "llboss-main-brain",
    name: "LLBoss Main Brain",
    lineId: "mainBrain",
    x: CANVAS_CENTER.x,
    y: CANVAS_CENTER.y,
    transfer: true,
    neighborhood: "central",
  };
  entityStation.set("llboss-main-brain", "station-llboss-main-brain");

  for (const lineId of lineOrder) {
    const lineEntities = (byLine.get(lineId) || []).filter((entity) => entity.id !== "llboss-main-brain");
    lineEntities.forEach((entity, index) => {
      const customPoint = customEntityPoints[entity.id];
      const point = customPoint || toPoint(lineId, index);
      const stationId = entity.stationId || `station-${entity.id}`;
      stations[stationId] = {
        id: stationId,
        entityId: entity.id,
        name: entity.name,
        lineId,
        x: point.x,
        y: point.y,
        terminal: index === lineEntities.length - 1,
        neighborhood: customPoint?.neighborhood || lineGeometry[lineId]?.neighborhood || "unknown",
      };
      entityStation.set(entity.id, stationId);

      const previousStationId = index === 0 ? "station-llboss-main-brain" : (lineEntities[index - 1].stationId || `station-${lineEntities[index - 1].id}`);
      addRoute({
        id: `route-${previousStationId}-${stationId}`,
        fromStationId: previousStationId,
        toStationId: stationId,
        lineId,
      });
    });
  }

  for (const entity of entities) {
    const fromStationId = entityStation.get(entity.id);
    if (!fromStationId) continue;
    for (const dependency of entity.dependencies || []) {
      if (dependency === "llboss-main-brain" || dependency.startsWith("parking-yard-")) continue;
      const toStationId = entityStation.get(dependency);
      if (!toStationId || toStationId === fromStationId) continue;
      const fromStation = stations[fromStationId];
      const toStation = stations[toStationId];
      if (fromStation?.lineId && toStation?.lineId && fromStation.lineId === toStation.lineId) continue;
      const id = `dependency-${toStationId}-${fromStationId}`;
      addRoute({
        id,
        fromStationId: toStationId,
        toStationId: fromStationId,
        lineId: entity.lineId || "unknown",
        dependency: true,
      });
    }
  }

  return { stations, lines, routes };
};
