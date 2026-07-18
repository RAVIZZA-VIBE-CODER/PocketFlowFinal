import type {
  EMapAvatarInstance,
  EMapEntity,
  EMapEntityStatus,
  EMapEvent,
  EMapEventType,
  EMapHealthSummary,
  EMapRuntimeState,
  EMapStation,
  EMapTrain,
  EMapTrainStatus,
  EMapTrainType,
} from "./types";

const MAX_RECENT_EVENTS = 160;
const STALE_HEARTBEAT_MS = 90_000;

const statusFromEvent = (event: EMapEvent): EMapEntityStatus | undefined => {
  if (event.type === "task_started" || event.type === "tool_call_started" || event.type === "model_call_started" || event.type === "memory_lookup_started") return "busy";
  if (event.type === "monitoring_started") return "monitoring";
  if (event.type === "task_failed" || event.type === "error") return "error";
  if (event.type === "warning" && event.status === "standby") return "sleeping";
  if (event.type === "warning" && event.status === "waiting_planning") return "idle";
  if (event.type === "warning") return "blocked";
  if (event.type === "task_completed" || event.type === "tool_call_completed" || event.type === "model_call_completed" || event.type === "memory_lookup_completed" || event.type === "monitoring_completed") return "idle";
  if (event.type === "agent_heartbeat") return "active";
  return undefined;
};

const trainTypeForEvent = (event: EMapEvent, entity?: EMapEntity): EMapTrainType => {
  const metadataTrain = entity?.metadata?.trainType;
  if (metadataTrain === "steam" || metadataTrain === "shinkansen" || metadataTrain === "cargo") return metadataTrain;
  if (event.type.startsWith("model_")) return "shinkansen";
  if (event.type.startsWith("memory_")) return "cargo";
  if (event.type.startsWith("monitoring_")) return "shinkansen";
  if (event.type.startsWith("tool_")) return "steam";
  return "steam";
};

const trainStatusForEvent = (event: EMapEvent): EMapTrainStatus => {
  if (event.type === "task_failed" || event.type === "error") return "error";
  if (event.status === "standby") return "standby";
  if (event.status === "waiting_planning") return "waiting_planning";
  if (event.type === "warning") return "blocked";
  if (event.type === "monitoring_started") return "monitoring";
  if (event.type.includes("completed")) return "arriving";
  return "moving";
};

const makeTrain = (event: EMapEvent, entity?: EMapEntity): EMapTrain | null => {
  if (event.type === "agent_heartbeat") return null;
  if (!event.fromStationId || !event.toStationId || !event.routeId) return null;
  const timestamp = event.timestamp || Date.now();
  return {
    id: `train-${event.traceId || event.id}`,
    trainType: trainTypeForEvent(event, entity),
    agentIds: [event.agentId],
    traceId: event.traceId,
    routeId: event.routeId,
    fromStationId: event.fromStationId,
    toStationId: event.toStationId,
    progress: event.type.includes("completed") ? 1 : 0,
    speed: event.durationMs ? Math.max(0.18, Math.min(1.6, 4200 / event.durationMs)) : 0.75,
    status: trainStatusForEvent(event),
    payloadType: event.type.startsWith("model_")
      ? "model_call"
      : event.type.startsWith("memory_")
        ? "memory"
        : event.type.startsWith("tool_")
          ? "tool_call"
          : event.type.startsWith("monitoring_")
            ? "monitoring"
            : "task",
    startedAt: timestamp,
    updatedAt: timestamp,
  };
};

const makeAvatar = (event: EMapEvent, entity?: EMapEntity, train?: EMapTrain): EMapAvatarInstance => ({
  id: `avatar-${event.agentId}`,
  agentId: event.agentId,
  avatarId: entity?.avatarId || "avatar-unknown",
  stationId: train ? undefined : event.toStationId || entity?.stationId,
  trainId: train?.id,
  status: event.type === "monitoring_started"
    ? "scanning"
    : event.type === "task_failed" || event.type === "error"
      ? "error"
      : train
        ? "moving"
        : "idle",
  targetEntityId: event.targetEntityId,
  updatedAt: event.timestamp,
});

const computeHealthSummary = (entities: Record<string, EMapEntity>, recentEvents: EMapEvent[]): EMapHealthSummary => {
  const now = Date.now();
  const lastHeartbeat = new Map<string, number>();
  for (const event of recentEvents) {
    if (event.type === "agent_heartbeat") lastHeartbeat.set(event.agentId, event.timestamp);
  }
  const summary: EMapHealthSummary = { total: 0, active: 0, busy: 0, monitoring: 0, blocked: 0, error: 0, offline: 0, stale: 0 };
  for (const entity of Object.values(entities)) {
    summary.total += 1;
    const status = entity.status || "idle";
    if (status === "active") summary.active += 1;
    if (status === "busy") summary.busy += 1;
    if (status === "monitoring") summary.monitoring += 1;
    if (status === "blocked") summary.blocked += 1;
    if (status === "error") summary.error += 1;
    if (status === "offline") summary.offline += 1;
    const heartbeat = lastHeartbeat.get(entity.id);
    if (heartbeat && now - heartbeat > STALE_HEARTBEAT_MS) summary.stale += 1;
  }
  return summary;
};

export const createEMapRuntimeState = (
  entities: EMapEntity[],
  graph: { stations: Record<string, EMapStation>; lines: EMapRuntimeState["lines"]; routes: EMapRuntimeState["routes"] },
  events: EMapEvent[] = [],
): EMapRuntimeState => {
  const state: EMapRuntimeState = {
    entities: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
    stations: graph.stations,
    lines: graph.lines,
    routes: graph.routes,
    activeTrains: {},
    activeAvatars: {},
    activeTraces: {},
    recentEvents: [],
    healthSummary: { total: entities.length, active: 0, busy: 0, monitoring: 0, blocked: 0, error: 0, offline: 0, stale: 0 },
  };
  return events.reduce((current, event) => ingestEMapEvent(current, event), state);
};

export const ingestEMapEvent = (state: EMapRuntimeState, event: EMapEvent): EMapRuntimeState => {
  const entity = state.entities[event.agentId];
  const nextEntities = { ...state.entities };
  const nextStatus = statusFromEvent(event);
  if (entity && nextStatus) {
    nextEntities[event.agentId] = {
      ...entity,
      status: nextStatus,
      metadata: { ...(entity.metadata || {}), lastHeartbeat: event.type === "agent_heartbeat" ? event.timestamp : entity.metadata?.lastHeartbeat, currentTask: event.message || entity.metadata?.currentTask },
    };
  }

  const train = makeTrain(event, entity);
  const nextTrains = { ...state.activeTrains };
  if (train) {
    if (event.type.includes("completed")) {
      nextTrains[train.id] = { ...train, status: "arriving", progress: 1 };
    } else {
      nextTrains[train.id] = train;
    }
  }

  const nextAvatars = { ...state.activeAvatars };
  if (entity) nextAvatars[`avatar-${event.agentId}`] = makeAvatar(event, entity, train || undefined);

  const traceId = event.traceId || `trace-${event.id}`;
  const nextTraces = { ...state.activeTraces };
  if (event.type === "task_started" || event.type === "tool_call_started" || event.type === "model_call_started" || event.type === "memory_lookup_started" || event.type === "monitoring_started") {
    nextTraces[traceId] = {
      id: traceId,
      parentTraceId: event.parentTraceId,
      agentId: event.agentId,
      label: event.message || event.type.replace(/_/g, " "),
      status: "running",
      startedAt: event.timestamp,
      updatedAt: event.timestamp,
      eventIds: [event.id],
    };
  } else if (nextTraces[traceId]) {
    nextTraces[traceId] = {
      ...nextTraces[traceId],
      status: event.type.includes("failed") || event.type === "error" ? "failed" : event.type.includes("completed") ? "complete" : nextTraces[traceId].status,
      updatedAt: event.timestamp,
      eventIds: [...nextTraces[traceId].eventIds, event.id],
    };
  }

  const recentEvents = [event, ...state.recentEvents].slice(0, MAX_RECENT_EVENTS);
  return {
    ...state,
    entities: nextEntities,
    activeTrains: nextTrains,
    activeAvatars: nextAvatars,
    activeTraces: nextTraces,
    recentEvents,
    healthSummary: computeHealthSummary(nextEntities, recentEvents),
  };
};

export const createEMapEvent = (input: Omit<EMapEvent, "id" | "timestamp"> & { id?: string; timestamp?: number; type: EMapEventType }) => ({
  ...input,
  id: input.id || `emap-event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  timestamp: input.timestamp || Date.now(),
});
