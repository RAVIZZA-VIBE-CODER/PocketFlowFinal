export type PocketAutomationMode = "background" | "no_touch";
export type PocketAutomationStatus = "running" | "complete" | "failed" | "stopped";

export interface PocketAutomationJob {
  id: string;
  name: string;
  mode: PocketAutomationMode;
  status: PocketAutomationStatus;
  taskType?: string;
  message?: string;
  startedAt: number;
  updatedAt: number;
  estimatedMs: number;
  progress?: number;
}

export interface ApiKeyRuntimeRecord {
  keyId: string;
  lastUsedAt?: number;
  cooldownUntil?: number;
  successCount: number;
  failureCount: number;
  lastError?: string;
}

export const POCKET_AUTOMATION_EVENT = "pocketflow:automation-job";
const API_KEY_RUNTIME_KEY = "pocketflow.apiKey.rotationRuntime";
const STOP_PREFIX = "pocketflow.automation.stop.";
const BASE_KEY_COOLDOWN_MS = 45_000;
const HARD_KEY_COOLDOWN_MS = 90_000;
const RATE_LIMIT_COOLDOWN_MS = 12 * 60_000;

const now = () => Date.now();

const dispatchAutomationJob = (job: PocketAutomationJob) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(POCKET_AUTOMATION_EVENT, { detail: job }));
};

export const beginPocketAutomationJob = (input: {
  name: string;
  mode?: PocketAutomationMode;
  taskType?: string;
  estimatedMs?: number;
  message?: string;
}) => {
  const timestamp = now();
  const job: PocketAutomationJob = {
    id: `auto_${timestamp.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    name: input.name.trim() || "Baloss LLM task",
    mode: input.mode || "background",
    status: "running",
    taskType: input.taskType,
    message: input.message,
    startedAt: timestamp,
    updatedAt: timestamp,
    estimatedMs: input.estimatedMs || (input.mode === "no_touch" ? 12_000 : 6_000),
    progress: 0,
  };
  if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(`${STOP_PREFIX}${job.id}`);
  dispatchAutomationJob(job);
  return job;
};

export const updatePocketAutomationJob = (job: PocketAutomationJob, patch: Partial<PocketAutomationJob>) => {
  const next = { ...job, ...patch, updatedAt: now() };
  dispatchAutomationJob(next);
  return next;
};

export const completePocketAutomationJob = (job: PocketAutomationJob, message?: string) =>
  updatePocketAutomationJob(job, { status: "complete", progress: 100, message: message || `${job.name} completed.` });

export const failPocketAutomationJob = (job: PocketAutomationJob, message?: string) =>
  updatePocketAutomationJob(job, { status: "failed", message: message || `${job.name} could not complete.` });

export const requestPocketAutomationStop = (jobId: string) => {
  if (typeof sessionStorage !== "undefined") sessionStorage.setItem(`${STOP_PREFIX}${jobId}`, "1");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(POCKET_AUTOMATION_EVENT, {
      detail: {
        id: jobId,
        name: "Automation",
        mode: "no_touch",
        status: "stopped",
        startedAt: now(),
        updatedAt: now(),
        estimatedMs: 0,
        progress: 100,
        message: "Stopped by owner override.",
      } satisfies PocketAutomationJob,
    }));
  }
};

export const isPocketAutomationStopRequested = (jobId: string) =>
  typeof sessionStorage !== "undefined" && sessionStorage.getItem(`${STOP_PREFIX}${jobId}`) === "1";

export const isHardAutomationTask = (taskType?: string, prompt = "") => {
  const text = prompt.toLowerCase();
  return [
    "system_search",
    "plan_action",
    "execute_safe_action",
    "builder_help",
    "code_help",
  ].includes(taskType || "") || /\b(build workflow|compile workflow|automate|automation|install|download|scan|research|look up|search|news|market|weather|meteo|stock|crypto)\b/i.test(text);
};

const readApiKeyRuntime = (): ApiKeyRuntimeRecord[] => {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(API_KEY_RUNTIME_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeApiKeyRuntime = (records: ApiKeyRuntimeRecord[]) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(API_KEY_RUNTIME_KEY, JSON.stringify(records.slice(-500)));
};

export const getApiKeyRuntimeSnapshot = () => readApiKeyRuntime();

export const orderApiKeysForRotation = (keyIds: string[], options: { taskType?: string; hard?: boolean } = {}) => {
  const unique = [...new Set(keyIds.filter(Boolean))];
  if (unique.length <= 1) return unique;
  const runtime = readApiKeyRuntime();
  const byId = new Map(runtime.map((item) => [item.keyId, item]));
  const timestamp = now();
  const hard = options.hard || isHardAutomationTask(options.taskType);

  const score = (id: string) => {
    const record = byId.get(id);
    const cooling = record?.cooldownUntil && record.cooldownUntil > timestamp ? 1 : 0;
    const age = timestamp - (record?.lastUsedAt || 0);
    const failPenalty = (record?.failureCount || 0) * 10_000;
    const hardPenalty = hard && cooling ? 1_000_000 : 0;
    return hardPenalty + cooling * 500_000 + failPenalty - age;
  };

  return unique.sort((a, b) => score(a) - score(b));
};

export const markApiKeyRotationResult = (
  keyId: string,
  result: { ok: boolean; taskType?: string; error?: string; hard?: boolean },
) => {
  if (!keyId) return;
  const runtime = readApiKeyRuntime();
  const existing = runtime.find((item) => item.keyId === keyId) || {
    keyId,
    successCount: 0,
    failureCount: 0,
  };
  const hard = result.hard || isHardAutomationTask(result.taskType);
  const rateLimited = /429|quota|rate|limit|exhausted|too many/i.test(result.error || "");
  const cooldownMs = result.ok
    ? hard ? HARD_KEY_COOLDOWN_MS : BASE_KEY_COOLDOWN_MS
    : rateLimited ? RATE_LIMIT_COOLDOWN_MS : HARD_KEY_COOLDOWN_MS;
  const updated: ApiKeyRuntimeRecord = {
    ...existing,
    lastUsedAt: now(),
    cooldownUntil: now() + cooldownMs,
    successCount: existing.successCount + (result.ok ? 1 : 0),
    failureCount: existing.failureCount + (result.ok ? 0 : 1),
    lastError: result.ok ? undefined : result.error,
  };
  writeApiKeyRuntime([updated, ...runtime.filter((item) => item.keyId !== keyId)]);
};
