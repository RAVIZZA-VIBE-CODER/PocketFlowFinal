export type BalossReadinessState = "ready" | "partial" | "missing";

export type BalossRuntimeOwner = "native" | "web" | "bridge" | "external-memory";

export interface BalossRuntimeRequirement {
  id: string;
  label: string;
  state: BalossReadinessState;
  owner: BalossRuntimeOwner;
  why: string;
  nextStep: string;
}

export interface BalossExecutionStep {
  id: number;
  title: string;
  status: "done" | "next" | "planned";
  replaces: string;
  result: string;
}

export const BALOSS_RUNTIME_REQUIREMENTS: BalossRuntimeRequirement[] = [
  {
    id: "native-model-runner",
    label: "Native local model runner",
    state: "partial",
    owner: "native",
    why: "The UI can select models, but reliable autonomous use still needs one Android-side llama.cpp supervisor with RAM guard, crash recovery, and token-per-second telemetry.",
    nextStep: "Move model lifecycle into a foreground Android service and expose /model/status, /model/start, /model/stop, and /model/generate.",
  },
  {
    id: "streaming-stt",
    label: "Streaming speech transcription",
    state: "missing",
    owner: "native",
    why: "Browser speech recognition cuts off and cannot reliably diarize long meetings.",
    nextStep: "Install a native streaming STT pipeline with speaker segments, rolling files, and post-call summary jobs.",
  },
  {
    id: "durable-scheduler",
    label: "Durable automation scheduler",
    state: "partial",
    owner: "native",
    why: "Newsletters, news pulls, Moltbook, and health checks still have browser-timer/localStorage code paths that stop when the WebView sleeps.",
    nextStep: "Replace app-local timers with one SQLite-backed job queue driven by Android WorkManager/AlarmManager.",
  },
  {
    id: "tool-registry",
    label: "Approved tool/action registry",
    state: "partial",
    owner: "web",
    why: "Agents know app names and verbs, but there is not yet one permissioned action catalog with dry-run, approval, execution, and audit logs.",
    nextStep: "Create a tool registry shared by Baloss, agents, Relay, Reader, CRM, News Flow, Notes, and Archive.",
  },
  {
    id: "memory-gateway",
    label: "Phone + BigBrain memory gateway",
    state: "partial",
    owner: "external-memory",
    why: "Tommyboy/BigBrain search exists, but Baloss needs one stable RAG gateway with citations instead of guessing local paths.",
    nextStep: "Use the ExternalEmpowermentsController API as the only way to search, read, cite, push, and pull external memory.",
  },
  {
    id: "agent-monitor",
    label: "Agent health monitor",
    state: "partial",
    owner: "bridge",
    why: "Health cards exist, but all agents are not yet checked by one watchdog with retry and isolation rules.",
    nextStep: "Run a twice-daily agent audit plus immediate checks after job failures, with stale/blocked/ready status per agent.",
  },
  {
    id: "archive-safety",
    label: "Archive dedupe and safe reader",
    state: "partial",
    owner: "web",
    why: "Archive cleanup, malware badges, safe Reader, and duplicate review exist as separate ideas instead of one review workflow.",
    nextStep: "Unify archive bot findings, quarantine, duplicate removal, and Reader safe-box opening into one review queue.",
  },
  {
    id: "relay-result-bridge",
    label: "Relay result and preview bridge",
    state: "partial",
    owner: "bridge",
    why: "Relay can send prompts, but project results, preview URLs, logs, and permission-needed states are not yet a durable chat transcript.",
    nextStep: "Persist every relay job with target project, status, preview URL, log URL, error, and permission request payload.",
  },
];

export const BALOSS_EXECUTION_STEPS: BalossExecutionStep[] = [
  {
    id: 1,
    title: "Chat hygiene and answer style",
    status: "done",
    replaces: "Diagnostic memory snippets leaking into normal chat answers.",
    result: "Baloss filters internal readiness/model/STT diagnostics before using local memory as a chat answer.",
  },
  {
    id: 2,
    title: "Runtime readiness registry",
    status: "done",
    replaces: "Hard-coded status copy spread across UI screens.",
    result: "One typed map tracks ready, partial, and missing runtime pieces.",
  },
  {
    id: 3,
    title: "Durable scheduler",
    status: "next",
    replaces: "Browser timers and localStorage-only jobs for News Flow, newsletters, Moltbook, and health checks.",
    result: "A native queue should run jobs while the app is locked, asleep, or switching Wi-Fi/mobile data.",
  },
  {
    id: 4,
    title: "Meeting speech pipeline",
    status: "planned",
    replaces: "Short browser dictation sessions that stop before long calls finish.",
    result: "Long recordings, live transcript, voice 1/2/3 diarization, audio files, summaries, and Reader folders.",
  },
  {
    id: 5,
    title: "Memory and BigBrain RAG bridge",
    status: "planned",
    replaces: "Ad hoc archive searches and path guesses.",
    result: "Baloss searches phone memory and Tommyboy through one citation-returning API.",
  },
  {
    id: 6,
    title: "Unified agent tool permissions",
    status: "planned",
    replaces: "Agents calling feature-specific helpers without one shared permission contract.",
    result: "Every agent action has owner, scope, dry-run, approval, execution log, rollback, and health reporting.",
  },
];

export const getBalossReadinessScore = (requirements = BALOSS_RUNTIME_REQUIREMENTS) => {
  const weights: Record<BalossReadinessState, number> = {
    ready: 1,
    partial: 0.55,
    missing: 0,
  };
  const total = requirements.reduce((sum, requirement) => sum + weights[requirement.state], 0);
  return Math.round((total / Math.max(1, requirements.length)) * 100);
};
