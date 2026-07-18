import {
  loadBalossDurableJobs,
  markBalossJobResult,
  type BalossDurableJob,
} from "./balossDurableScheduler";
import { getMoltbookReserveStats, loadMoltbookBuildDiaryState, loadMoltbookState } from "./moltbookAgent";
import type { ArchiveMaintenanceState } from "./archiveMaintenance";
import type { SpinoRuntimeStats } from "./spinoLLMEngine";

export interface BalossOutputRecord {
  id: string;
  label: string;
  summary: string;
  path: string;
  writtenAt: string;
  source: string;
  severity: "info" | "success" | "warning" | "error";
  txt: string;
}

export interface TransportDropboxState {
  updatedAt: string;
  path: string;
  collectorCount: number;
  records: BalossOutputRecord[];
}

export interface LearningMemoryState {
  updatedAt: string;
  rootPath: string;
  supervisor: BalossOutputRecord;
  styleTeacher: BalossOutputRecord;
  preferenceTeacher: BalossOutputRecord;
}

export interface MoltbookDailyTxtState {
  updatedAt: string;
  rootPath: string;
  postsPath: string;
  commentsPath: string;
  summaryPath: string;
  record: BalossOutputRecord;
  counts: {
    ready: number;
    planned: number;
    posted: number;
    held: number;
    commentsToday: number;
    postsToday: number;
  };
}

export interface MoltbookBuildDiaryOutputState {
  updatedAt: string;
  rootPath: string;
  record: BalossOutputRecord;
  entryCount: number;
  lastGeneratedFor: string;
}

export interface BalossAgentOutputState {
  updatedAt: string;
  transportDropbox: TransportDropboxState;
  learningMemory: LearningMemoryState;
  moltbookDailyTxt: MoltbookDailyTxtState;
  moltbookBuildDiary: MoltbookBuildDiaryOutputState;
  executedJobIds: string[];
  jobs: BalossDurableJob[];
}

export interface BalossAgentOutputInput {
  files: number;
  builderProjects: number;
  dashboards: number;
  indexDocs: number;
  indexChunks: number;
  intelItems: number;
  jobs: BalossDurableJob[];
  runtimeStats: Partial<SpinoRuntimeStats>;
  archiveMaintenance: ArchiveMaintenanceState;
  serverServiceCount: number;
  checkedAt?: Date;
}

const TRANSPORT_KEY = "pocketflow.baloss.transportDropbox.v1";
const LEARNING_KEY = "pocketflow.baloss.learningMemory.v1";
const MOLTBOOK_TXT_KEY = "pocketflow.baloss.moltbookDailyTxt.v1";

const isBrowser = () => typeof window !== "undefined" && !!window.localStorage;

const todayPathParts = (date: Date) => {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return { yyyy, mm, dd };
};

const readJson = <T,>(key: string, fallback: T): T => {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = <T,>(key: string, value: T) => {
  if (!isBrowser()) return value;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("pocketflow:baloss-agent-outputs-updated", { detail: { key, value } }));
  return value;
};

const compactLine = (label: string, value: string | number | boolean | undefined) =>
  `${label}: ${value === undefined || value === "" ? "n/a" : value}`;

const makeRecord = (
  id: string,
  label: string,
  path: string,
  source: string,
  summary: string,
  lines: string[],
  severity: BalossOutputRecord["severity"] = "success",
  writtenAt = new Date().toISOString(),
): BalossOutputRecord => ({
  id,
  label,
  path,
  source,
  summary,
  writtenAt,
  severity,
  txt: [
    `${label}`,
    compactLine("Updated", writtenAt),
    compactLine("Source", source),
    compactLine("Summary", summary),
    "",
    ...lines,
  ].join("\n"),
});

const blankRecord = (id: string, label: string, path: string): BalossOutputRecord =>
  makeRecord(id, label, path, "Baloss Panel", "Waiting for first foreground refresh.", ["No output has been written yet."], "warning");

const blankTransport = (): TransportDropboxState => ({
  updatedAt: "",
  path: "/reader/dropbox/YYYY/MM/DD/transport-summary.txt",
  collectorCount: 5,
  records: [],
});

const blankLearning = (): LearningMemoryState => ({
  updatedAt: "",
  rootPath: "/reader/baloss/learning/YYYY/MM/DD",
  supervisor: blankRecord("learning-supervisor", "Learning Supervisor", "/reader/baloss/learning/YYYY/MM/DD/supervisor.txt"),
  styleTeacher: blankRecord("owner-style-teacher", "Owner Style Teacher", "/reader/baloss/learning/YYYY/MM/DD/owner-style.txt"),
  preferenceTeacher: blankRecord("preference-pattern-teacher", "Preference Pattern Teacher", "/reader/baloss/learning/YYYY/MM/DD/preferences.txt"),
});

const blankMoltbook = (): MoltbookDailyTxtState => ({
  updatedAt: "",
  rootPath: "/reader/moltbook/YYYY/MM/DD",
  postsPath: "/reader/moltbook/YYYY/MM/DD/posts.txt",
  commentsPath: "/reader/moltbook/YYYY/MM/DD/comments.txt",
  summaryPath: "/reader/moltbook/YYYY/MM/DD/summary.txt",
  record: blankRecord("moltbook-daily-txt", "Moltbook Daily TXT", "/reader/moltbook/YYYY/MM/DD/summary.txt"),
  counts: { ready: 0, planned: 0, posted: 0, held: 0, commentsToday: 0, postsToday: 0 },
});

const blankMoltbookBuildDiary = (): MoltbookBuildDiaryOutputState => ({
  updatedAt: "",
  rootPath: "/reader/moltbook/build-diary",
  record: blankRecord("moltbook-build-diary", "PocketFlow Build Diary", "/reader/moltbook/build-diary/latest.txt"),
  entryCount: 0,
  lastGeneratedFor: "",
});

export const loadTransportDropboxState = () => readJson(TRANSPORT_KEY, blankTransport());
export const loadLearningMemoryState = () => readJson(LEARNING_KEY, blankLearning());
export const loadMoltbookDailyTxtState = () => readJson(MOLTBOOK_TXT_KEY, blankMoltbook());
export const loadMoltbookBuildDiaryOutputState = (): MoltbookBuildDiaryOutputState => {
  const diary = loadMoltbookBuildDiaryState();
  const latest = diary.entries[0];
  if (!latest) return blankMoltbookBuildDiary();
  const record = makeRecord(
    "moltbook-build-diary",
    "PocketFlow Build Diary",
    `/reader/moltbook/build-diary/${latest.date}.txt`,
    "PocketFlow build diary agent",
    latest.summary,
    [
      compactLine("Last generated for", diary.lastGeneratedFor || "not generated"),
      compactLine("Draft id", latest.draftId || "not queued yet"),
      compactLine("Why interesting", latest.whyInteresting),
      compactLine("Changed areas", latest.changedAreas.join(", ")),
      compactLine("Checks", latest.checks.join(", ")),
      "",
      "Baseline system build:",
      diary.publicBuildSummary,
    ],
    "success",
    diary.updatedAt === "baseline" ? new Date().toISOString() : diary.updatedAt,
  );
  return {
    updatedAt: diary.updatedAt,
    rootPath: "/reader/moltbook/build-diary",
    record,
    entryCount: diary.entries.length,
    lastGeneratedFor: diary.lastGeneratedFor,
  };
};

export const writeTransportDropboxSnapshot = (input: BalossAgentOutputInput): TransportDropboxState => {
  const now = input.checkedAt || new Date();
  const writtenAt = now.toISOString();
  const { yyyy, mm, dd } = todayPathParts(now);
  const root = `/reader/dropbox/${yyyy}/${mm}/${dd}`;
  const jobCounts = input.jobs.reduce(
    (counts, job) => ({
      total: counts.total + 1,
      failed: counts.failed + (job.status === "failed" || job.failureCount > 0 ? 1 : 0),
      paused: counts.paused + (!job.enabled || job.status === "paused" ? 1 : 0),
      running: counts.running + (job.status === "running" ? 1 : 0),
    }),
    { total: 0, failed: 0, paused: 0, running: 0 },
  );
  const records = [
    makeRecord(
      "transport-apps",
      "App Summary Collector",
      `${root}/apps-summary.txt`,
      "Baloss Panel app registry",
      `${input.files} files, ${input.builderProjects} builds, ${input.dashboards} dashboards, ${input.indexChunks} chunks.`,
      [
        compactLine("Files", input.files),
        compactLine("Builder projects", input.builderProjects),
        compactLine("Dashboards", input.dashboards),
        compactLine("Indexed docs", input.indexDocs),
        compactLine("Indexed chunks", input.indexChunks),
      ],
      "success",
      writtenAt,
    ),
    makeRecord(
      "transport-automation",
      "Automation Summary Collector",
      `${root}/automation-summary.txt`,
      "Baloss durable scheduler",
      `${jobCounts.total} jobs, ${jobCounts.failed} failed, ${jobCounts.paused} paused.`,
      [
        compactLine("Total jobs", jobCounts.total),
        compactLine("Running jobs", jobCounts.running),
        compactLine("Failed jobs", jobCounts.failed),
        compactLine("Paused jobs", jobCounts.paused),
        compactLine("Next due", input.jobs.filter((job) => job.enabled).sort((a, b) => Date.parse(a.nextRunAt || "") - Date.parse(b.nextRunAt || ""))[0]?.label),
      ],
      jobCounts.failed ? "warning" : "success",
      writtenAt,
    ),
    makeRecord(
      "transport-server",
      "Server Summary Collector",
      `${root}/server-summary.txt`,
      "public server inventory",
      `${input.serverServiceCount} mapped server/app services ready for monitor import.`,
      [
        compactLine("Mapped services", input.serverServiceCount),
        compactLine("Intel cached", input.intelItems),
        compactLine("Runtime backend", input.runtimeStats.backend),
        compactLine("Runtime health", input.runtimeStats.health),
      ],
      "info",
      writtenAt,
    ),
    makeRecord(
      "transport-security",
      "Security Summary Collector",
      `${root}/security-summary.txt`,
      "Archive maintenance state",
      `${input.archiveMaintenance.threatQueue.length} threat findings currently queued.`,
      [
        compactLine("Threat findings", input.archiveMaintenance.threatQueue.length),
        compactLine("Archive scanner", input.archiveMaintenance.config.malwareScan ? "enabled" : "disabled"),
        compactLine("Last scan", input.archiveMaintenance.lastRunAt),
        compactLine("Next scan", input.archiveMaintenance.nextRunAt),
      ],
      input.archiveMaintenance.threatQueue.length ? "warning" : "success",
      writtenAt,
    ),
  ];
  return writeJson(TRANSPORT_KEY, {
    updatedAt: writtenAt,
    path: `${root}/transport-summary.txt`,
    collectorCount: 5,
    records,
  });
};

export const writeLearningMemorySnapshot = (input: BalossAgentOutputInput): LearningMemoryState => {
  const now = input.checkedAt || new Date();
  const writtenAt = now.toISOString();
  const { yyyy, mm, dd } = todayPathParts(now);
  const root = `/reader/baloss/learning/${yyyy}/${mm}/${dd}`;
  const ownerSignals = [
    `${input.builderProjects} Builder projects`,
    `${input.files} Reader/archive files`,
    `${input.dashboards} dashboards`,
    `${input.intelItems} intel items`,
  ];
  const supervisor = makeRecord(
    "learning-supervisor",
    "Learning Supervisor",
    `${root}/supervisor.txt`,
    "Baloss memory + app map",
    `Collected ${ownerSignals.join(", ")} for low-load Baloss growth.`,
    [
      "Purpose: collect owner corrections, app edits and accepted decisions before safe memory promotion.",
      compactLine("Semantic retrieval", input.runtimeStats.semanticRetrievalReady ? "ready" : "not confirmed"),
      compactLine("Indexed chunks", input.indexChunks),
      compactLine("Aether/model runtime", input.runtimeStats.loadedModelId || input.runtimeStats.backend),
    ],
    "success",
    writtenAt,
  );
  const styleTeacher = makeRecord(
    "owner-style-teacher",
    "Owner Style Teacher",
    `${root}/owner-style.txt`,
    "Notes, Builder and Baloss chat patterns",
    "Tracks phrasing, correction style, urgency and UI taste without exposing private raw text.",
    [
      "Current style anchors: direct, phone-first, visual, low-bulk, control-panel oriented.",
      "Do-not-repeat: bulky app sprawl, unclear status labels, duplicate sends, hidden errors.",
      "Promotion rule: summarize patterns; do not copy private conversation verbatim.",
    ],
    "info",
    writtenAt,
  );
  const preferenceTeacher = makeRecord(
    "preference-pattern-teacher",
    "Preference Pattern Teacher",
    `${root}/preferences.txt`,
    "Manual overrides and repeated product decisions",
    "Extracts stable preferences and action constraints for future Baloss routing.",
    [
      "Stable preference: one central Baloss Panel, fewer bulky apps, clear controls.",
      "Stable preference: agents in parking yards when standby; errors red; standby black; WTP yellow.",
      "Stable preference: normal navigation must avoid waking the big model.",
      compactLine("Newsletter duplicate-risk jobs", input.jobs.filter((job) => /newsletter/i.test(job.label) && job.enabled).length),
    ],
    "success",
    writtenAt,
  );
  return writeJson(LEARNING_KEY, { updatedAt: writtenAt, rootPath: root, supervisor, styleTeacher, preferenceTeacher });
};

export const writeMoltbookDailyTxtSnapshot = (checkedAt = new Date()): MoltbookDailyTxtState => {
  const writtenAt = checkedAt.toISOString();
  const { yyyy, mm, dd } = todayPathParts(checkedAt);
  const root = `/reader/moltbook/${yyyy}/${mm}/${dd}`;
  const state = loadMoltbookState();
  const reserve = getMoltbookReserveStats(state);
  const today = checkedAt.toISOString().slice(0, 10);
  const todaysDrafts = state.postBacklog.filter((draft) => (draft.scheduledFor || draft.createdAt || "").slice(0, 10) === today);
  const postedToday = state.postBacklog.filter((draft) => draft.status === "posted" && (draft.scheduledFor || draft.createdAt || "").slice(0, 10) === today);
  const record = makeRecord(
    "moltbook-daily-txt",
    "Moltbook Daily TXT",
    `${root}/summary.txt`,
    "Moltbook phone state",
    `${reserve.planned} planned, ${reserve.ready} ready, ${postedToday.length} posted today, ${state.interaction.commentsToday} comments tracked.`,
    [
      compactLine("Mode", state.mode),
      compactLine("Account", state.username),
      compactLine("Connection", state.connectionHealth.status),
      compactLine("Bridge", state.connectionHealth.endpoint),
      compactLine("Daily target", reserve.dailyTarget),
      compactLine("Reserve target", reserve.reserveTarget),
      compactLine("Ready", reserve.ready),
      compactLine("Planned", reserve.planned),
      compactLine("Posted total", reserve.posted),
      compactLine("Held", reserve.held),
      "",
      "Today drafts:",
      ...(todaysDrafts.length
        ? todaysDrafts.slice(0, 20).map((draft) => `- [${draft.status}] ${draft.title} (${draft.scheduledFor || draft.createdAt})`)
        : ["- No drafts scheduled for this local day."]),
      "",
      "Recent command log:",
      ...(state.commandLog.length ? state.commandLog.slice(0, 8).map((line) => `- ${line}`) : ["- No command log entries."]),
    ],
    state.connectionHealth.status === "error" ? "warning" : "success",
    writtenAt,
  );
  return writeJson(MOLTBOOK_TXT_KEY, {
    updatedAt: writtenAt,
    rootPath: root,
    postsPath: `${root}/posts.txt`,
    commentsPath: `${root}/comments.txt`,
    summaryPath: `${root}/summary.txt`,
    record,
    counts: {
      ready: reserve.ready,
      planned: reserve.planned,
      posted: reserve.posted,
      held: reserve.held,
      commentsToday: state.interaction.commentsToday,
      postsToday: state.interaction.postsToday,
    },
  });
};

const isDue = (job: BalossDurableJob, now: Date) =>
  job.enabled && job.nextRunAt && Date.parse(job.nextRunAt) <= now.getTime();

export const runBalossAgentOutputMaintenance = (input: BalossAgentOutputInput): BalossAgentOutputState => {
  const now = input.checkedAt || new Date();
  let jobs = input.jobs;
  const executedJobIds: string[] = [];

  const runJob = (jobId: string, writer: () => void, message: string) => {
    const job = jobs.find((item) => item.id === jobId);
    const stateMissing =
      jobId === "transport-dropbox-hourly"
        ? !loadTransportDropboxState().updatedAt
        : jobId === "learning-memory-90"
          ? !loadLearningMemoryState().updatedAt
          : !loadMoltbookDailyTxtState().updatedAt;
    if (!job || (!isDue(job, now) && !stateMissing)) return;
    try {
      writer();
      jobs = markBalossJobResult(jobId, "succeeded", message, now);
      executedJobIds.push(jobId);
    } catch (error) {
      jobs = markBalossJobResult(jobId, "failed", error instanceof Error ? error.message : String(error), now);
      executedJobIds.push(jobId);
    }
  };

  runJob("transport-dropbox-hourly", () => writeTransportDropboxSnapshot(input), "Transport Dropbox refreshed app/server/security summaries.");
  runJob("learning-memory-90", () => writeLearningMemorySnapshot(input), "Baloss learning memory snapshots refreshed.");
  runJob("moltbook-daily-txt-2330", () => writeMoltbookDailyTxtSnapshot(now), "Moltbook daily TXT snapshot refreshed.");

  return {
    updatedAt: now.toISOString(),
    transportDropbox: loadTransportDropboxState(),
    learningMemory: loadLearningMemoryState(),
    moltbookDailyTxt: loadMoltbookDailyTxtState(),
    moltbookBuildDiary: loadMoltbookBuildDiaryOutputState(),
    executedJobIds,
    jobs: executedJobIds.length ? loadBalossDurableJobs() : jobs,
  };
};
