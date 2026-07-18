export type EMapEntityType =
  | "main_brain"
  | "agent"
  | "monitor_agent"
  | "model"
  | "tool"
  | "automation"
  | "server"
  | "memory"
  | "archive"
  | "external_module"
  | "queue"
  | "security"
  | "unknown";

export type EMapEntityStatus =
  | "idle"
  | "active"
  | "busy"
  | "error"
  | "offline"
  | "sleeping"
  | "monitoring"
  | "blocked";

export type EMapTrainType = "steam" | "shinkansen" | "cargo";
export type EMapPayloadType = "task" | "model_call" | "tool_call" | "memory" | "file" | "monitoring" | "backup" | "security";

export interface EMapEntity {
  id: string;
  name: string;
  type: EMapEntityType;
  description?: string;
  sourceFile?: string;
  status?: EMapEntityStatus;
  lineId?: string;
  stationId?: string;
  iconId?: string;
  avatarId?: string;
  colorToken?: string;
  dependencies?: string[];
  monitors?: string[];
  monitoredBy?: string[];
  metadata?: Record<string, unknown>;
}

export interface EMapStation {
  id: string;
  entityId: string;
  name: string;
  lineId: string;
  x: number;
  y: number;
  terminal?: boolean;
  transfer?: boolean;
  neighborhood?: string;
}

export interface EMapLine {
  id: string;
  name: string;
  color: string;
  entityIds: string[];
  description?: string;
}

export interface EMapRoute {
  id: string;
  fromStationId: string;
  toStationId: string;
  lineId: string;
  dependency?: boolean;
}

export type EMapEventType =
  | "agent_registered"
  | "agent_heartbeat"
  | "task_started"
  | "task_progress"
  | "task_completed"
  | "task_failed"
  | "tool_call_started"
  | "tool_call_completed"
  | "model_call_started"
  | "model_call_completed"
  | "memory_lookup_started"
  | "memory_lookup_completed"
  | "monitoring_started"
  | "monitoring_completed"
  | "route_changed"
  | "health_changed"
  | "error"
  | "warning";

export interface EMapEvent {
  id: string;
  timestamp: number;
  traceId?: string;
  parentTraceId?: string;
  agentId: string;
  type: EMapEventType;
  fromStationId?: string;
  toStationId?: string;
  targetEntityId?: string;
  routeId?: string;
  status?: string;
  message?: string;
  severity?: "info" | "warning" | "error" | "critical";
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export type EMapTrainStatus =
  | "idle"
  | "standby"
  | "waiting_planning"
  | "departing"
  | "moving"
  | "arriving"
  | "blocked"
  | "error"
  | "offline"
  | "monitoring"
  | "delayed"
  | "carrying_payload"
  | "returning";

export interface EMapTrain {
  id: string;
  trainType: EMapTrainType;
  agentIds: string[];
  traceId?: string;
  routeId: string;
  fromStationId: string;
  toStationId: string;
  progress: number;
  speed: number;
  status: EMapTrainStatus;
  payloadType?: EMapPayloadType;
  startedAt: number;
  updatedAt: number;
}

export type EMapAvatarAnimationState = "idle" | "moving" | "scanning" | "repairing" | "thinking" | "error" | "offline";

export interface EMapAvatarDefinition {
  id: string;
  name: string;
  entityType: EMapEntityType;
  animationStates: EMapAvatarAnimationState[];
  defaultTrainType: EMapTrainType;
  colorToken?: string;
  emojiFallback?: string;
}

export interface EMapAvatarInstance {
  id: string;
  agentId: string;
  avatarId: string;
  stationId?: string;
  trainId?: string;
  status: EMapAvatarAnimationState;
  targetEntityId?: string;
  updatedAt: number;
}

export interface EMapTrace {
  id: string;
  parentTraceId?: string;
  agentId: string;
  label: string;
  status: "running" | "complete" | "failed" | "waiting";
  startedAt: number;
  updatedAt: number;
  eventIds: string[];
}

export interface EMapHealthSummary {
  total: number;
  active: number;
  busy: number;
  monitoring: number;
  blocked: number;
  error: number;
  offline: number;
  stale: number;
}

export interface EMapRuntimeState {
  entities: Record<string, EMapEntity>;
  stations: Record<string, EMapStation>;
  lines: Record<string, EMapLine>;
  routes: Record<string, EMapRoute>;
  activeTrains: Record<string, EMapTrain>;
  activeAvatars: Record<string, EMapAvatarInstance>;
  activeTraces: Record<string, EMapTrace>;
  recentEvents: EMapEvent[];
  healthSummary: EMapHealthSummary;
}
