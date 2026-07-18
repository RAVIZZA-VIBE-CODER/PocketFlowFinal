export type BalossJobStatus =
  | "idle"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "paused";

export type BalossJobKind =
  | "news_scouter"
  | "newsletter_send"
  | "moltbook_post"
  | "moltbook_build_diary"
  | "archive_maintenance"
  | "agent_health"
  | "bigbrain_sync"
  | "transport_dropbox"
  | "learning_memory"
  | "moltbook_archive_txt";

export interface BalossDurableJob {
  id: string;
  kind: BalossJobKind;
  label: string;
  owner: "news" | "moltbook" | "archive" | "baloss" | "bigbrain";
  enabled: boolean;
  status: BalossJobStatus;
  everyMinutes?: number;
  offsetMinutes?: number;
  dailyAt?: string;
  weekdays?: number[];
  lastRunAt?: string;
  nextRunAt?: string;
  lastMessage?: string;
  failureCount: number;
  priority: number;
}

export interface BalossSchedulerSummary {
  total: number;
  enabled: number;
  running: number;
  failed: number;
  nextJob?: BalossDurableJob;
}

const STORAGE_KEY = "pocketflow.baloss.durableScheduler.v1";

export const BALOSS_DEFAULT_JOBS: BalossDurableJob[] = [
  {
    id: "news-scouter-ai",
    kind: "news_scouter",
    label: "News Flow AI scouter",
    owner: "news",
    enabled: true,
    status: "queued",
    everyMinutes: 120,
    offsetMinutes: 20,
    failureCount: 0,
    priority: 20,
  },
  {
    id: "news-scouter-fashion",
    kind: "news_scouter",
    label: "News Flow fashion scouter",
    owner: "news",
    enabled: true,
    status: "queued",
    everyMinutes: 120,
    offsetMinutes: 80,
    failureCount: 0,
    priority: 20,
  },
  {
    id: "newsletter-tanuki-midnight",
    kind: "newsletter_send",
    label: "Tanuki AI newsletter",
    owner: "news",
    enabled: true,
    status: "queued",
    dailyAt: "00:00",
    failureCount: 0,
    priority: 30,
  },
  {
    id: "newsletter-fashion-18",
    kind: "newsletter_send",
    label: "Fashion newsletter",
    owner: "news",
    enabled: true,
    status: "queued",
    dailyAt: "18:00",
    failureCount: 0,
    priority: 30,
  },
  {
    id: "newsletter-property-20",
    kind: "newsletter_send",
    label: "Property digest newsletter",
    owner: "news",
    enabled: true,
    status: "queued",
    dailyAt: "20:00",
    failureCount: 0,
    priority: 30,
  },
  {
    id: "newsletter-kapricorn-thu-10",
    kind: "newsletter_send",
    label: "Kapricorn weekly leaflet",
    owner: "news",
    enabled: false,
    status: "paused",
    dailyAt: "10:00",
    weekdays: [4],
    failureCount: 0,
    priority: 30,
    lastMessage: "Kapricorn is parked by owner request; do not dispatch automatically.",
  },
  {
    id: "moltbook-posting-window",
    kind: "moltbook_post",
    label: "Moltbook all-day interaction patrol",
    owner: "moltbook",
    enabled: true,
    status: "queued",
    everyMinutes: 20,
    offsetMinutes: 5,
    failureCount: 0,
    priority: 25,
  },
  {
    id: "moltbook-build-diary-2135",
    kind: "moltbook_build_diary",
    label: "PocketFlow build diary post",
    owner: "moltbook",
    enabled: true,
    status: "queued",
    dailyAt: "21:35",
    failureCount: 0,
    priority: 24,
  },
  {
    id: "agent-health-twice-daily",
    kind: "agent_health",
    label: "All-agent health check",
    owner: "baloss",
    enabled: true,
    status: "queued",
    everyMinutes: 720,
    offsetMinutes: 405,
    failureCount: 0,
    priority: 10,
  },
  {
    id: "transport-dropbox-hourly",
    kind: "transport_dropbox",
    label: "Transport Dropbox collector round",
    owner: "baloss",
    enabled: true,
    status: "queued",
    everyMinutes: 60,
    offsetMinutes: 12,
    failureCount: 0,
    priority: 12,
  },
  {
    id: "learning-memory-90",
    kind: "learning_memory",
    label: "Baloss learning memory promotion",
    owner: "baloss",
    enabled: true,
    status: "queued",
    everyMinutes: 90,
    offsetMinutes: 24,
    failureCount: 0,
    priority: 12,
  },
  {
    id: "moltbook-daily-txt-2330",
    kind: "moltbook_archive_txt",
    label: "Moltbook daily TXT archive",
    owner: "moltbook",
    enabled: true,
    status: "queued",
    dailyAt: "23:30",
    failureCount: 0,
    priority: 16,
  },
  {
    id: "archive-maintenance-nightly",
    kind: "archive_maintenance",
    label: "Archive duplicate and safety pass",
    owner: "archive",
    enabled: true,
    status: "queued",
    dailyAt: "03:30",
    failureCount: 0,
    priority: 10,
  },
  {
    id: "bigbrain-health",
    kind: "bigbrain_sync",
    label: "BigBrain module health and index check",
    owner: "bigbrain",
    enabled: true,
    status: "queued",
    everyMinutes: 240,
    offsetMinutes: 155,
    failureCount: 0,
    priority: 15,
  },
];

const isBrowser = () => typeof window !== "undefined" && !!window.localStorage;

const withNextRuns = (jobs: BalossDurableJob[]): BalossDurableJob[] => {
  const now = new Date();
  return jobs.map((job) => {
    const nextRunMs = Date.parse(job.nextRunAt || "");
    const staleNextRun = Number.isNaN(nextRunMs) || nextRunMs <= now.getTime() - 60_000;
    return {
      ...job,
      nextRunAt: staleNextRun ? computeNextRun(job, now).toISOString() : job.nextRunAt,
    };
  });
};

const BALOSS_JOB_OVERRIDES: Record<string, Partial<BalossDurableJob>> = {
  "news-scouter-ai": { everyMinutes: 120, offsetMinutes: 20 },
  "news-scouter-fashion": { everyMinutes: 120, offsetMinutes: 80 },
  "newsletter-tanuki-midnight": { dailyAt: "00:00" },
  "newsletter-fashion-18": { dailyAt: "18:00" },
  "newsletter-property-20": { dailyAt: "20:00" },
  "newsletter-kapricorn-thu-10": {
    enabled: false,
    status: "paused",
    dailyAt: "10:00",
    weekdays: [4],
    lastMessage: "Kapricorn is parked by owner request; do not dispatch automatically.",
  },
  "moltbook-posting-window": { everyMinutes: 20, offsetMinutes: 5 },
  "moltbook-build-diary-2135": { dailyAt: "21:35" },
  "agent-health-twice-daily": { everyMinutes: 720, offsetMinutes: 405 },
  "transport-dropbox-hourly": { everyMinutes: 60, offsetMinutes: 12 },
  "learning-memory-90": { everyMinutes: 90, offsetMinutes: 24 },
  "moltbook-daily-txt-2330": { dailyAt: "23:30" },
  "bigbrain-health": { everyMinutes: 240, offsetMinutes: 155 },
};

const sortedWeekdays = (weekdays?: number[]) =>
  Array.isArray(weekdays) ? weekdays.map(Number).filter(Number.isFinite).sort((a, b) => a - b).join(",") : "";

const jobSemanticKey = (job: BalossDurableJob) =>
  [
    job.kind,
    job.owner,
    job.label.trim().toLowerCase().replace(/\s+/g, " "),
    job.dailyAt || "",
    job.everyMinutes || "",
    job.offsetMinutes || "",
    sortedWeekdays(job.weekdays),
  ].join("|");

const preferCanonicalJob = (current: BalossDurableJob, candidate: BalossDurableJob) => {
  const currentDefault = BALOSS_DEFAULT_JOBS.some((job) => job.id === current.id);
  const candidateDefault = BALOSS_DEFAULT_JOBS.some((job) => job.id === candidate.id);
  if (candidateDefault && !currentDefault) return candidate;
  if (currentDefault && !candidateDefault) return current;
  const currentRun = Date.parse(current.lastRunAt || "");
  const candidateRun = Date.parse(candidate.lastRunAt || "");
  if (!Number.isNaN(candidateRun) && (Number.isNaN(currentRun) || candidateRun > currentRun)) return candidate;
  return current;
};

const normalizeBalossDurableJobs = (jobs: BalossDurableJob[]): BalossDurableJob[] => {
  const byId = new Map<string, BalossDurableJob>();
  for (const job of jobs) byId.set(job.id, job);
  for (const job of BALOSS_DEFAULT_JOBS) {
    if (!byId.has(job.id)) byId.set(job.id, job);
  }
  const dedupedByFunction = new Map<string, BalossDurableJob>();
  for (const job of byId.values()) {
    const normalized = {
      ...job,
      ...(BALOSS_JOB_OVERRIDES[job.id] || {}),
    };
    const key = jobSemanticKey(normalized);
    const existing = dedupedByFunction.get(key);
    dedupedByFunction.set(key, existing ? preferCanonicalJob(existing, normalized) : normalized);
  }
  return withNextRuns(Array.from(dedupedByFunction.values()));
};

export const computeNextRun = (
  job: Pick<BalossDurableJob, "dailyAt" | "weekdays" | "everyMinutes" | "offsetMinutes" | "lastRunAt">,
  from = new Date(),
): Date => {
  if (job.dailyAt) {
    const [hour, minute] = job.dailyAt.split(":").map((part) => Number(part));
    const next = new Date(from);
    next.setHours(Number.isFinite(hour) ? hour : 0, Number.isFinite(minute) ? minute : 0, 0, 0);
    if (next <= from) next.setDate(next.getDate() + 1);
    if (job.weekdays?.length) {
      const allowed = new Set(job.weekdays.map((day) => Math.max(0, Math.min(6, Number(day)))));
      while (!allowed.has(next.getDay())) next.setDate(next.getDate() + 1);
    }
    return next;
  }

  if (job.everyMinutes && Number.isFinite(job.offsetMinutes)) {
    const dayStart = new Date(from);
    dayStart.setHours(0, 0, 0, 0);
    const offsetMs = Math.max(0, Number(job.offsetMinutes || 0)) * 60_000;
    const intervalMs = Math.max(1, job.everyMinutes) * 60_000;
    let next = new Date(dayStart.getTime() + offsetMs);
    while (next <= from) next = new Date(next.getTime() + intervalMs);
    return next;
  }

  const base = job.lastRunAt ? new Date(job.lastRunAt) : from;
  const next = new Date(base);
  next.setMinutes(next.getMinutes() + (job.everyMinutes ?? 60));
  return next <= from ? new Date(from.getTime() + (job.everyMinutes ?? 60) * 60_000) : next;
};

export const loadBalossDurableJobs = (): BalossDurableJob[] => {
  if (!isBrowser()) return normalizeBalossDurableJobs(BALOSS_DEFAULT_JOBS);

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return resetBalossDurableJobs();
    const parsed = JSON.parse(raw) as BalossDurableJob[];
    if (!Array.isArray(parsed)) return resetBalossDurableJobs();
    const normalized = normalizeBalossDurableJobs(parsed);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return resetBalossDurableJobs();
  }
};

export const saveBalossDurableJobs = (jobs: BalossDurableJob[]): BalossDurableJob[] => {
  const normalized = withNextRuns(jobs);
  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent("pocketflow:baloss-durable-jobs-updated", { detail: normalized }));
  }
  return normalized;
};

export const resetBalossDurableJobs = (): BalossDurableJob[] =>
  saveBalossDurableJobs(normalizeBalossDurableJobs(BALOSS_DEFAULT_JOBS));

export const upsertBalossDurableJob = (job: BalossDurableJob): BalossDurableJob[] => {
  const jobs = loadBalossDurableJobs();
  const exists = jobs.some((item) => item.id === job.id);
  const next = exists ? jobs.map((item) => (item.id === job.id ? job : item)) : [...jobs, job];
  return saveBalossDurableJobs(next);
};

export const markBalossJobResult = (
  jobId: string,
  status: BalossJobStatus,
  message: string,
  at = new Date(),
): BalossDurableJob[] => {
  const jobs = loadBalossDurableJobs().map((job) => {
    if (job.id !== jobId) return job;
    const repeatedFailure = status === "failed" && job.status === "failed" && job.lastMessage === message;
    const failureCount = status === "failed" ? (repeatedFailure ? job.failureCount : job.failureCount + 1) : 0;
    const updated = {
      ...job,
      status,
      lastRunAt: at.toISOString(),
      lastMessage: message,
      failureCount,
    };
    return {
      ...updated,
      nextRunAt: computeNextRun(updated, at).toISOString(),
    };
  });
  return saveBalossDurableJobs(jobs);
};

export const summarizeBalossScheduler = (
  jobs: BalossDurableJob[] = loadBalossDurableJobs(),
): BalossSchedulerSummary => {
  const enabledJobs = jobs.filter((job) => job.enabled);
  const nextJob = enabledJobs
    .filter((job) => job.nextRunAt)
    .sort((a, b) => new Date(a.nextRunAt ?? 0).getTime() - new Date(b.nextRunAt ?? 0).getTime())[0];

  return {
    total: jobs.length,
    enabled: enabledJobs.length,
    running: jobs.filter((job) => job.status === "running").length,
    failed: jobs.filter((job) => job.status === "failed").length,
    nextJob,
  };
};
