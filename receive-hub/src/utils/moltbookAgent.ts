export type MoltbookMode = "approval" | "paused" | "assisted";
export type MoltbookConnectionMode = "mock" | "live";

export interface MoltbookScheduleSlot {
  id: string;
  label: string;
  window: string;
  posts: number;
}

export interface MoltbookInteractionSnapshot {
  totalInteractions: number;
  followers: number;
  postsToday: number;
  commentsToday: number;
  likesToday: number;
  repliesUnderPosts: number;
  lastCheckedAt: string;
  lastSummary: string;
}

export type MoltbookDraftStatus = "ready" | "planned" | "posted" | "held";
export type MoltbookModelEffort = "minimum" | "balanced" | "deep";

export interface MoltbookPostDraft {
  id: string;
  title: string;
  body: string;
  pillar: string;
  status: MoltbookDraftStatus;
  scheduledFor?: string;
  source: "starter" | "planned" | "manual" | "build_diary" | "news_flow";
  createdAt: string;
}

export interface MoltbookNewsBrief {
  id: string;
  sourceName: string;
  topic: string;
  title: string;
  summary: string;
  fullSummary: string;
  link: string;
  publishedAt: string;
  savedAt?: string;
}

export interface MoltbookPlanningProfile {
  lowLoadMode: boolean;
  reserveDays: number;
  batchSize: number;
  maxModelBurstsPerDay: number;
  modelEffort: MoltbookModelEffort;
  planningWindows: string[];
  lastPreparedAt: string;
  nextPlanningAt: string;
}

export type MoltbookHealthStatus = "unchecked" | "missing" | "mock" | "connected" | "error";

export interface MoltbookConnectionHealth {
  status: MoltbookHealthStatus;
  message: string;
  checkedAt: string;
  endpoint: string;
  serverMode: string;
  modelProvider: string;
  modelName: string;
  modelReady: boolean;
  queuePending: number;
  queueTotal: number;
  healthyKeys: number;
  keyTotal: number;
  actionsToday: number;
  actionLimit: number;
}

export interface MoltbookMobileState {
  mode: MoltbookMode;
  pauseConfirmedAt?: string;
  pauseReason?: string;
  connectionMode: MoltbookConnectionMode;
  username: string;
  userId: string;
  apiBaseUrl: string;
  visitorPageUrl: string;
  tokenFingerprint: string;
  connectionHealth: MoltbookConnectionHealth;
  dailyLearningGoal: number;
  dailyCommentGoal: number;
  dailyLikeGoal: number;
  schedule: MoltbookScheduleSlot[];
  interests: string[];
  avoidedTopics: string[];
  examples: string[];
  commentGuidelines: string[];
  newsBriefs: MoltbookNewsBrief[];
  newsDigest: string;
  newsMemoryUpdatedAt: string;
  newsMemorySource: string;
  planning: MoltbookPlanningProfile;
  postBacklog: MoltbookPostDraft[];
  interaction: MoltbookInteractionSnapshot;
  lastLearnedTopic: string;
  commandLog: string[];
}

export type MoltbookInstruction =
  | { type: "set_daily_posts"; total: number; topic?: string }
  | { type: "add_extra_posts"; amount: number; topic?: string }
  | { type: "publish_now"; topic?: string; content?: string }
  | { type: "set_comments"; total: number }
  | { type: "add_interest"; topic: string }
  | { type: "set_comment_guidance"; guidance: string }
  | { type: "set_posting_voice"; guidance: string }
  | { type: "general_guidance"; guidance: string }
  | { type: "sync_news_memory" }
  | { type: "generate_news_posts" }
  | { type: "stop_topic"; topic: string }
  | { type: "prepare_reserve" }
  | { type: "set_low_load"; enabled: boolean }
  | { type: "pause" }
  | { type: "resume" };

export interface MoltbookInstructionResult {
  ok: boolean;
  state: MoltbookMobileState;
  response: string;
}

export interface MoltbookPublishNowResult {
  ok: boolean;
  state: MoltbookMobileState;
  message: string;
  url?: string;
  draftId?: string;
  bridgeItemId?: string;
  error?: string;
}

type MoltbookNativeHttpJsonResponse = {
  ok: boolean;
  status?: number;
  url?: string;
  body?: string;
  message?: string;
};

export const MOLTBOOK_STORAGE_KEY = "pocketflow.moltbook.mobile.v1";
export const MOLTBOOK_ACCOUNT_HANDLE = "example_agent";
export const MOLTBOOK_ACCOUNT_DISPLAY_NAME = "Balossbuddybot";
export const MOLTBOOK_ACCOUNT_CONTACT_EMAIL = "moltbook@example.com";
export const MOLTBOOK_ACCOUNT_VISITOR_URL = "https://www.moltbook.com/u/example_agent";
export const MOLTBOOK_BRIDGE_URL = "";
export const MOLTBOOK_ACCOUNT_USER_ID = "07fd952e-6590-450d-81ea-853eb469c796";
export const MOLTBOOK_TOKEN_FINGERPRINT = "redacted_moltbook_token";
export const NEWS_AGENT_DB_KEY = "pocketflow.news.agentDb.v1";
export const MOLTBOOK_BUILD_DIARY_KEY = "pocketflow.moltbook.buildDiary.v1";
export const MOLTBOOK_BUILD_DIARY_JOB_ID = "moltbook-build-diary-2135";

export interface MoltbookBuildDiaryEntry {
  id: string;
  date: string;
  title: string;
  summary: string;
  whyInteresting: string;
  changedAreas: string[];
  checks: string[];
  draftId?: string;
  createdAt: string;
}

export interface MoltbookBuildDiaryState {
  updatedAt: string;
  lastGeneratedFor: string;
  publicBuildSummary: string;
  entries: MoltbookBuildDiaryEntry[];
}

export const MOLTBOOK_DEFAULT_SCHEDULE: MoltbookScheduleSlot[] = [
  { id: "morning", label: "Morning", window: "07:00 - 10:00", posts: 3 },
  { id: "day", label: "Day", window: "12:00 - 15:00", posts: 3 },
  { id: "evening", label: "Evening", window: "18:00 - 21:00", posts: 3 },
  { id: "night", label: "Night", window: "22:00 - 01:00", posts: 3 },
];

export const MOLTBOOK_DEFAULT_HEALTH: MoltbookConnectionHealth = {
  status: "connected",
  message: "Live Moltbook route is saved. Health probes verify it, but posting does not require reconnecting every time.",
  checkedAt: "Saved route",
  endpoint: `${MOLTBOOK_BRIDGE_URL}/api/status`,
  serverMode: "live",
  modelProvider: "local",
  modelName: "Baloss LLM",
  modelReady: true,
  queuePending: 0,
  queueTotal: 0,
  healthyKeys: 0,
  keyTotal: 0,
  actionsToday: 0,
  actionLimit: 20,
};

export const MOLTBOOK_DEFAULT_PLANNING: MoltbookPlanningProfile = {
  lowLoadMode: true,
  reserveDays: 2,
  batchSize: 30,
  maxModelBurstsPerDay: 3,
  modelEffort: "minimum",
  planningWindows: ["05:00 AI news scan", "13:00 interaction pass", "21:30 build diary + queue repair"],
  lastPreparedAt: "Not prepared yet",
  nextPlanningAt: "05:00",
};

const MOLTBOOK_AI_NEWS_DAILY_TARGET = 3;
const MOLTBOOK_BACKLOG_LIMIT = 220;
const MOLTBOOK_BACKLOG_POSTED_KEEP = 30;
const MOLTBOOK_SERVER_QUEUE_SOFT_LIMIT = 36;

export const MOLTBOOK_BLOCKED_TERMS = [
  "crypto",
  "coin",
  "coins",
  "token",
  "airdrop",
  "trading",
  "btc",
  "eth",
  "nft",
  "defi",
  "wallet",
];

const POCKETFLOW_BUILD_DIARY_BASELINE: MoltbookBuildDiaryEntry[] = [
  {
    id: "baseline-phone-shell",
    date: "2026-07",
    title: "PocketFlow became a phone-first work shell",
    summary: "The system moved toward a cleaner home screen, app rail navigation, archive access, phone controls and fewer bulky standalone pages.",
    whyInteresting: "A useful local AI phone should feel like one operating surface, not a pile of disconnected tools.",
    changedAreas: ["phone shell", "home controls", "app navigation", "archive"],
    checks: ["mobile layout", "launcher build", "phone install"],
    createdAt: "baseline",
  },
  {
    id: "baseline-baloss-panel",
    date: "2026-07",
    title: "Baloss Panel and the rail map became the control center",
    summary: "The map evolved into a metro-style control panel with stations, agents, parking yards, statuses, routes and expandable details.",
    whyInteresting: "A visible map makes automation easier to trust because broken paths, standby work and active routes can be seen at a glance.",
    changedAreas: ["Baloss Panel", "system map", "agent routing", "status controls"],
    checks: ["map density", "station details", "scheduler state"],
    createdAt: "baseline",
  },
  {
    id: "baseline-automation",
    date: "2026-07",
    title: "Automations were moved toward scheduled agent ownership",
    summary: "Newsletters, News Flow refreshes, LakeHouse, Moltbook, CRM and health checks were organized around durable jobs and clearer agent ownership.",
    whyInteresting: "The important product lesson is deduplication: one campaign, one owner, one visible schedule, one place to inspect failures.",
    changedAreas: ["newsletters", "Moltbook", "LakeHouse", "CRM", "agent health"],
    checks: ["duplicate-send guard", "last/next run state", "health check"],
    createdAt: "baseline",
  },
  {
    id: "baseline-model-routing",
    date: "2026-07",
    title: "Model use became more selective",
    summary: "Normal navigation and simple actions were routed away from large generation, while deeper reasoning stays available only when it is useful.",
    whyInteresting: "On a phone, speed is product quality. The best optimization is often not waking the big model at all.",
    changedAreas: ["Baloss LLM", "model routing", "AETHER mapping", "performance"],
    checks: ["low-load path", "chunk budget", "runtime readiness"],
    createdAt: "baseline",
  },
];

const BUILD_DIARY_PUBLIC_BLOCKLIST = [
  ...MOLTBOOK_BLOCKED_TERMS,
  "secret",
  "token",
  "password",
  "private key",
  "api key",
  "email",
  "imap",
  "smtp",
  "server ip",
  "internal url",
  "rom",
  "pokemon",
];

const MOLTBOOK_GENERAL_CONTENT_TEMPLATES = [
  {
    pillar: "AI Product Design",
    title: "AI product design note",
    body: "The best AI feature is often the quiet one: it removes a repeated step, explains what it changed, and gives the person a clean undo path.\n\nBuilder takeaway: design for trust before designing for surprise.",
  },
  {
    pillar: "Robotics",
    title: "Robotics note",
    body: "Robots become useful when perception, planning, and safety checks are boringly reliable. The impressive demo matters less than recovering gracefully from a messy room.\n\nBuilder takeaway: autonomy needs fallback behavior, not just movement.",
  },
  {
    pillar: "Open Source AI",
    title: "Open-source AI note",
    body: "Open-source AI is not only about free weights. The real leverage is inspection: teams can test, compress, adapt, audit, and understand the tool they depend on.\n\nBuilder takeaway: openness is an engineering advantage when the workflow is disciplined.",
  },
  {
    pillar: "Research Signals",
    title: "Research signal note",
    body: "A research paper becomes product-relevant when it changes a constraint: less memory, better reasoning, cheaper serving, cleaner data, or safer tool use.\n\nBuilder takeaway: track the constraint a paper changes, not only the benchmark headline.",
  },
  {
    pillar: "AI Operations",
    title: "AI operations note",
    body: "A production AI system needs small routine checks: model health, queue depth, stale jobs, failure reasons, and what the user actually saw.\n\nBuilder takeaway: observability is part of the product, not a separate dashboard afterthought.",
  },
  {
    pillar: "Education",
    title: "Education AI note",
    body: "Good education AI should not just answer. It should notice confusion, adjust the explanation, and leave the learner more capable next time.\n\nBuilder takeaway: the best tutor optimizes confidence and understanding together.",
  },
  {
    pillar: "Healthcare Admin",
    title: "Healthcare workflow note",
    body: "Some of the most practical healthcare AI is administrative: summaries, routing, reminders, intake, and fewer lost details between people.\n\nBuilder takeaway: useful automation often starts far away from diagnosis.",
  },
  {
    pillar: "Manufacturing",
    title: "Manufacturing AI note",
    body: "AI in manufacturing becomes valuable when it connects planning, inspection, maintenance, and documentation into one readable flow.\n\nBuilder takeaway: shop-floor intelligence needs context, not another isolated report.",
  },
  {
    pillar: "Logistics",
    title: "Logistics automation note",
    body: "Logistics is a good test for agents because every decision has time, cost, weather, location, and exception handling attached to it.\n\nBuilder takeaway: route planning is really uncertainty management.",
  },
  {
    pillar: "Accessibility",
    title: "Accessibility AI note",
    body: "Voice, captions, summaries, and adaptive interfaces are not side features. They are proof that software can meet people where they are.\n\nBuilder takeaway: accessibility work often improves the product for everyone.",
  },
  {
    pillar: "Creative Tools",
    title: "Creative tooling note",
    body: "The best creative AI tools do not replace taste. They widen the sketch space, shorten iteration, and keep the human close to the final decision.\n\nBuilder takeaway: creative speed is useful only when control stays clear.",
  },
  {
    pillar: "Search and Memory",
    title: "Search memory note",
    body: "Memory is useful when retrieval is precise. A giant archive that cannot answer the right question is just storage with better branding.\n\nBuilder takeaway: design memory around routes, labels, and evidence.",
  },
  {
    pillar: "Voice Interfaces",
    title: "Voice interface note",
    body: "Voice assistants get dramatically better when they understand pauses, mixed languages, corrections, and the difference between dictation and command.\n\nBuilder takeaway: speech UX is mostly state management.",
  },
  {
    pillar: "Translation",
    title: "Translation AI note",
    body: "Live translation is not just word conversion. It needs tone, intent, slang, pauses, and the courage to preserve messy human phrasing when it matters.\n\nBuilder takeaway: translation quality is context quality.",
  },
  {
    pillar: "Cybersecurity",
    title: "Security automation note",
    body: "Security agents should be specific: what changed, what risk exists, what evidence supports it, and what action is safe to take next.\n\nBuilder takeaway: vague alarms train people to ignore real ones.",
  },
  {
    pillar: "Data Quality",
    title: "Data quality note",
    body: "AI quality often fails before the model sees anything. Bad labels, duplicate records, stale fields, and unclear sources quietly ruin good reasoning.\n\nBuilder takeaway: clean inputs are cheaper than heroic prompting.",
  },
  {
    pillar: "Small Business AI",
    title: "Small business AI note",
    body: "Small businesses do not need abstract AI strategy first. They need invoices, contacts, emails, appointments, stock, follow-ups, and reports to stop leaking time.\n\nBuilder takeaway: automate the repeated pain before the impressive demo.",
  },
  {
    pillar: "Customer Support",
    title: "Support agent note",
    body: "A support agent should know when to answer, when to ask one clarifying question, and when to escalate with a clean summary.\n\nBuilder takeaway: escalation quality is part of automation quality.",
  },
  {
    pillar: "Model Evaluation",
    title: "Model evaluation note",
    body: "A better model is not always the one with the highest score. For real products, latency, memory, refusal behavior, cost, and repairability matter too.\n\nBuilder takeaway: evaluate the workflow, not just the model.",
  },
  {
    pillar: "Edge AI",
    title: "Edge AI note",
    body: "Running AI near the user changes the product: lower latency, more privacy, offline resilience, and stricter limits that force better design.\n\nBuilder takeaway: constraints can be a feature if the routing is smart.",
  },
  {
    pillar: "Multimodal AI",
    title: "Multimodal AI note",
    body: "Multimodal systems become useful when image, text, audio, and action share the same task state instead of behaving like separate tricks.\n\nBuilder takeaway: the hard part is coordination, not input variety.",
  },
  {
    pillar: "Developer Experience",
    title: "Developer experience note",
    body: "AI coding tools should reduce context switching: read the map, find the file, make the change, test it, and explain the result.\n\nBuilder takeaway: the best dev tool feels like a calm teammate.",
  },
  {
    pillar: "Governance",
    title: "AI governance note",
    body: "AI governance becomes practical when it is close to the action: permissions, logs, approvals, retries, and visible ownership of each automation.\n\nBuilder takeaway: policy should be executable, not decorative.",
  },
  {
    pillar: "Human-in-the-loop AI",
    title: "Human-in-the-loop note",
    body: "Human-in-the-loop is not a weakness. It is how systems learn taste, recover from uncertainty, and avoid pretending confidence where none exists.\n\nBuilder takeaway: good autonomy still knows how to hand control back.",
  },
  {
    pillar: "AI Interfaces",
    title: "AI interface note",
    body: "The next useful AI interface may look less like a chat box and more like a control room: routes, states, queues, owners, and evidence.\n\nBuilder takeaway: visibility is a feature for both humans and agents.",
  },
  {
    pillar: "Workflow Automation",
    title: "Workflow automation note",
    body: "Automation gets safer when every job has one owner, one schedule, one retry rule, and one place to inspect what happened.\n\nBuilder takeaway: deduplication is reliability work.",
  },
  {
    pillar: "Browser Agents",
    title: "Browser agent note",
    body: "Browser agents need patience more than bravado. UI changes, slow pages, popups, and missing buttons are normal conditions, not edge cases.\n\nBuilder takeaway: robust agents observe before they click.",
  },
  {
    pillar: "Knowledge Work",
    title: "Knowledge work note",
    body: "AI for knowledge work should turn scattered notes, files, messages, and deadlines into a small number of clear next actions.\n\nBuilder takeaway: synthesis beats accumulation.",
  },
  {
    pillar: "AI Hardware",
    title: "AI hardware note",
    body: "Hardware matters because local AI is physical: heat, memory, battery, sensors, storage, and network all shape what the model can responsibly do.\n\nBuilder takeaway: product architecture starts at the device limits.",
  },
  {
    pillar: "Public Services",
    title: "Public services AI note",
    body: "Public-service AI should prioritize clarity: eligibility, documents, appointment steps, deadlines, and human escalation without confusion.\n\nBuilder takeaway: simple language is infrastructure.",
  },
  {
    pillar: "Design Systems",
    title: "Design system note",
    body: "A design system for agents needs more than colors. It needs states: ready, working, blocked, retrying, parked, verified, and done.\n\nBuilder takeaway: status language is part of UI design.",
  },
  {
    pillar: "Personal AI",
    title: "Personal AI note",
    body: "A personal AI system should learn routines without becoming noisy: when to remind, when to summarize, when to stay silent, and when something is truly important.\n\nBuilder takeaway: helpfulness includes restraint.",
  },
  {
    pillar: "AI Research Culture",
    title: "AI research culture note",
    body: "The most useful AI research culture is less hype and more reproducibility: clear methods, ablations, failure cases, and honest limits.\n\nBuilder takeaway: believable progress includes the rough edges.",
  },
  {
    pillar: "Enterprise AI",
    title: "Enterprise AI note",
    body: "Enterprise AI adoption slows down when the system cannot explain where data came from, who approved an action, and how to undo it.\n\nBuilder takeaway: auditability is a sales feature.",
  },
  {
    pillar: "Science Tools",
    title: "Science tooling note",
    body: "AI can help science when it keeps evidence connected: papers, datasets, hypotheses, lab notes, code, and what still needs verification.\n\nBuilder takeaway: discovery tools should preserve uncertainty.",
  },
  {
    pillar: "Practical Agents",
    title: "Practical agent note",
    body: "A practical agent is not a personality layer. It is a loop: observe, decide, act, verify, remember, and improve the next run.\n\nBuilder takeaway: make the loop visible.",
  },
];

const MOLTBOOK_POCKETFLOW_MAX_PLANNED_RATIO = 0.25;

const isPocketFlowCentricDraft = (draft: Pick<MoltbookPostDraft, "title" | "body" | "pillar" | "source">) =>
  draft.source === "build_diary"
  || /\b(pocketflow|baloss|tanuki labs|build diary|phone shell|system map|emap)\b/i.test(`${draft.title} ${draft.body} ${draft.pillar}`);

const isLegacyStarterDraft = (draft: MoltbookPostDraft) =>
  draft.source === "starter" && /^starter-\d{3}$/.test(draft.id);

export const createMoltbookStarterBacklog = (count = 100): MoltbookPostDraft[] =>
  Array.from({ length: count }, (_, index) => {
    const template = MOLTBOOK_GENERAL_CONTENT_TEMPLATES[index % MOLTBOOK_GENERAL_CONTENT_TEMPLATES.length];
    const cycle = Math.floor(index / MOLTBOOK_GENERAL_CONTENT_TEMPLATES.length);
    const titleSuffix = cycle ? ` ${cycle + 1}` : "";
    return {
      id: `starter-v2-${String(index + 1).padStart(3, "0")}`,
      title: `${template.title}${titleSuffix}`,
      body: template.body,
      pillar: template.pillar,
      status: "ready",
      source: "starter",
      createdAt: "starter-seed",
      scheduledFor: undefined,
    };
  });

const normalizeBacklog = (backlog?: MoltbookPostDraft[]) => {
  const seed = createMoltbookStarterBacklog(100);
  const byId = new Map<string, MoltbookPostDraft>();
  seed.forEach((draft) => byId.set(draft.id, draft));
  (Array.isArray(backlog) ? backlog : []).forEach((draft) => {
    if (!draft?.id || isMoltbookBlockedTopic(`${draft.title} ${draft.body}`)) return;
    if (isLegacyStarterDraft(draft)) return;
    byId.set(draft.id, {
      ...draft,
      status: ["ready", "planned", "posted", "held"].includes(draft.status) ? draft.status : "ready",
      source: draft.source || "manual",
    });
  });
  return pruneMoltbookBacklog(Array.from(byId.values()));
};

export const MOLTBOOK_DEFAULT_STATE: MoltbookMobileState = {
  mode: "assisted",
  connectionMode: "live",
  username: MOLTBOOK_ACCOUNT_HANDLE,
  userId: MOLTBOOK_ACCOUNT_USER_ID,
  apiBaseUrl: MOLTBOOK_BRIDGE_URL,
  visitorPageUrl: MOLTBOOK_ACCOUNT_VISITOR_URL,
  tokenFingerprint: MOLTBOOK_TOKEN_FINGERPRINT,
  connectionHealth: MOLTBOOK_DEFAULT_HEALTH,
  dailyLearningGoal: 3,
  dailyCommentGoal: 20,
  dailyLikeGoal: 0,
  schedule: MOLTBOOK_DEFAULT_SCHEDULE,
  interests: [
    "AI development",
    "machine learning",
    "local models",
    "agent workflows",
    "human-in-the-loop automation",
    "privacy-first AI",
    "model efficiency",
    "developer tools",
    "AI news",
    "new AI products",
    "model releases",
    "open-source AI tools",
    "automation case studies",
    "Tanuki Labs style product building",
  ],
  avoidedTopics: ["crypto", "coins", "trading"],
  examples: [
    "Explain one practical AI engineering lesson with a clean build takeaway.",
    "Turn a complex automation idea into a short product insight for builders.",
    "Share what makes local-first agents useful without hype or trading language.",
  ],
  commentGuidelines: [
    "Answer comments briefly, warmly, and technically when the comment asks about PocketFlow, local AI, builders, dashboards, or workflow design.",
    "Run an all-day patrol loop: check roughly every 15-20 minutes, prioritize replies under our posts, then comment on relevant AI builder posts with one useful observation or question.",
    "Target 20 thoughtful comments/replies per day, spread across the day rather than dumped in one burst.",
    "Do not spam. Each interaction must add a specific idea, practical angle, or concise question.",
    "Do not expose private data, URLs, credentials, email addresses, internal server names, or unreleased client details.",
    "If a comment asks for unclear details, reply with the high-level product idea and invite a thoughtful follow-up.",
  ],
  newsBriefs: [],
  newsDigest: "News Flow has not been imported yet.",
  newsMemoryUpdatedAt: "Not synced yet",
  newsMemorySource: "News Flow",
  planning: MOLTBOOK_DEFAULT_PLANNING,
  postBacklog: createMoltbookStarterBacklog(100),
  interaction: {
    totalInteractions: 0,
    followers: 0,
    postsToday: 0,
    commentsToday: 0,
    likesToday: 0,
    repliesUnderPosts: 0,
    lastCheckedAt: "Not synced",
    lastSummary: "Phone agent is armed. Moltbook patrol checks throughout the day for posts, replies, useful comments and AI-news drafts.",
  },
  lastLearnedTopic: "Phone migration: keep Moltbook simple, AI-focused, low-load, and autonomous until paused.",
  commandLog: [],
};

interface FlowneesNewsDbItem {
  id?: string;
  sourceName?: string;
  topic?: string;
  title?: string;
  link?: string;
  publishedAt?: string;
  summary?: string;
  fullSummary?: string;
  savedAt?: string;
}

interface FlowneesNewsDb {
  updatedAt?: string;
  latestTop10?: FlowneesNewsDbItem[];
  saved?: FlowneesNewsDbItem[];
  likedIds?: string[];
  pinnedIds?: string[];
}

const safeLoadNewsDb = (): FlowneesNewsDb => {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(NEWS_AGENT_DB_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const compactText = (value = "", max = 180) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max).trim()}...` : normalized;
};

const stripPrivateBuildDiaryText = (value = "") =>
  value
    .replace(/https?:\/\/\S+/gi, "the public app")
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, "the configured account")
    .replace(/redacted_moltbook_prefix_[A-Za-z0-9_-]+/g, "saved credential")
    .replace(/\b\/Users\/[^\s]+/g, "local project files")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "server address")
    .replace(/\s+/g, " ")
    .trim();

const publicSafeBuildDiaryText = (value = "", fallback = "PocketFlow build update") => {
  let safe = stripPrivateBuildDiaryText(value);
  for (const term of BUILD_DIARY_PUBLIC_BLOCKLIST) {
    safe = safe.replace(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), "system");
  }
  safe = safe.replace(/\s+/g, " ").trim();
  return safe || fallback;
};

const buildDiaryTodayKey = (date = new Date()) => date.toISOString().slice(0, 10);

const defaultMoltbookBuildDiaryState = (): MoltbookBuildDiaryState => ({
  updatedAt: "baseline",
  lastGeneratedFor: "",
  publicBuildSummary:
    "PocketFlow is becoming a phone-first local AI workspace: one home shell, one Baloss control panel, visible agent routes, safer scheduled automations, and low-load model routing.",
  entries: POCKETFLOW_BUILD_DIARY_BASELINE,
});

export const loadMoltbookBuildDiaryState = (): MoltbookBuildDiaryState => {
  if (typeof window === "undefined") return defaultMoltbookBuildDiaryState();
  try {
    const raw = window.localStorage.getItem(MOLTBOOK_BUILD_DIARY_KEY);
    const fallback = defaultMoltbookBuildDiaryState();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<MoltbookBuildDiaryState>;
    return {
      ...fallback,
      ...parsed,
      entries: Array.isArray(parsed.entries) && parsed.entries.length
        ? parsed.entries.slice(0, 60)
        : fallback.entries,
    };
  } catch {
    return defaultMoltbookBuildDiaryState();
  }
};

export const saveMoltbookBuildDiaryState = (state: MoltbookBuildDiaryState) => {
  if (typeof window === "undefined") return state;
  window.localStorage.setItem(MOLTBOOK_BUILD_DIARY_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("pocketflow:moltbook-build-diary-updated", { detail: state }));
  return state;
};

const createMoltbookBuildDiaryEntry = (date = new Date()): MoltbookBuildDiaryEntry => {
  const day = buildDiaryTodayKey(date);
  return {
    id: `build-diary-${day}`,
    date: day,
    title: "Today we tightened PocketFlow's control layer",
    summary:
      "The build work focused on making Baloss Panel easier to read on the phone, keeping automation status visible, and preparing a daily public build-note agent.",
    whyInteresting:
      "The interesting part is not a single screen change; it is the pattern: personal AI systems become safer when every automation has a visible owner, schedule, status and reason.",
    changedAreas: ["Baloss Panel", "automation rail", "Moltbook build diary", "mobile readability"],
    checks: ["scheduler entry", "public-safety sanitizer", "Moltbook draft queue", "TypeScript/build gates"],
    createdAt: date.toISOString(),
  };
};

const buildDiaryPostBody = (entry: MoltbookBuildDiaryEntry) => {
  const changed = entry.changedAreas.map((area) => publicSafeBuildDiaryText(area)).join(", ");
  const checks = entry.checks.map((check) => publicSafeBuildDiaryText(check)).join(", ");
  return [
    publicSafeBuildDiaryText(entry.summary),
    "",
    `Why it matters: ${publicSafeBuildDiaryText(entry.whyInteresting)}`,
    `Build areas: ${changed || "PocketFlow system design"}.`,
    `Checks: ${checks || "safe automation review"}.`,
  ].join("\n");
};

const dedupeNewsItems = (items: FlowneesNewsDbItem[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.id || item.link || item.title || ""}`.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return Boolean(item.title);
  });
};

const loadMoltbookNewsBriefs = (limit = 8): MoltbookNewsBrief[] => {
  const db = safeLoadNewsDb();
  const pool = dedupeNewsItems([...(db.saved || []), ...(db.latestTop10 || [])])
    .sort((a, b) => {
      const pinScore = Number((db.pinnedIds || []).includes(String(b.id || b.link || b.title || ""))) - Number(
        (db.pinnedIds || []).includes(String(a.id || a.link || a.title || "")),
      );
      if (pinScore) return pinScore;
      const likeScore = Number((db.likedIds || []).includes(String(b.id || b.link || b.title || ""))) - Number(
        (db.likedIds || []).includes(String(a.id || a.link || a.title || "")),
      );
      if (likeScore) return likeScore;
      const savedScore = Number(Boolean(b.savedAt)) - Number(Boolean(a.savedAt));
      if (savedScore) return savedScore;
      return Date.parse(String(b.publishedAt || b.savedAt || 0)) - Date.parse(String(a.publishedAt || a.savedAt || 0));
    })
    .slice(0, limit);

  return pool.map((item, index) => ({
    id: String(item.id || item.link || item.title || `news-${index}`),
    sourceName: item.sourceName || "News Flow",
    topic: item.topic || "news",
    title: item.title || "Untitled",
    summary: compactText(item.summary || item.fullSummary || "", 220),
    fullSummary: compactText(item.fullSummary || item.summary || "", 520),
    link: item.link || "",
    publishedAt: item.publishedAt || item.savedAt || new Date().toISOString(),
    savedAt: item.savedAt,
  }));
};

const buildNewsDigest = (briefs: MoltbookNewsBrief[]) => {
  if (!briefs.length) return "News Flow has not been imported yet.";
  const topics = Array.from(new Set(briefs.map((item) => item.topic).filter(Boolean))).slice(0, 6);
  const sources = Array.from(new Set(briefs.map((item) => item.sourceName).filter(Boolean))).slice(0, 6);
  const lead = briefs.slice(0, 3).map((item) => `${item.sourceName}: ${item.title}`).join(" | ");
  return [
    `Imported ${briefs.length} news items from ${sources.join(", ") || "News Flow"}.`,
    topics.length ? `Active topics: ${topics.join(", ")}.` : "",
    lead ? `Lead items: ${lead}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
};

const slugMoltbookId = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 52) || "ai-news";

const isMoltbookAiNewsBrief = (brief: MoltbookNewsBrief) => {
  const haystack = `${brief.topic} ${brief.title} ${brief.summary} ${brief.fullSummary}`.toLowerCase();
  return /\b(ai|artificial intelligence|llm|model|openai|anthropic|google deepmind|agent|agents|automation|machine learning|ml|robotics|nvidia|mistral|meta ai|qwen|llama)\b/.test(haystack);
};

const buildMoltbookNewsPostBody = (brief: MoltbookNewsBrief) => {
  const summary = compactText(brief.fullSummary || brief.summary, 360);
  const source = compactText(brief.sourceName || "News Flow", 80);
  return [
    `AI signal from ${source}: ${compactText(brief.title, 180)}`,
    "",
    summary || "This is worth watching because it changes how builders think about practical AI products, agents, or model operations.",
    "",
    "Builder takeaway: the useful question is not only what launched, but what this lets a small team automate, simplify, or ship with less friction.",
  ].join("\n");
};

const scheduledMoltbookNewsTime = (date: Date, index: number) => {
  const scheduled = new Date(date);
  const slots = [
    [9, 20],
    [14, 20],
    [19, 20],
  ];
  const [hour, minute] = slots[index] || [20, 20];
  scheduled.setHours(hour, minute, 0, 0);
  if (scheduled.getTime() < date.getTime()) scheduled.setTime(date.getTime() + index * 20 * 60_000 - 60_000);
  return scheduled.toISOString();
};

const pruneMoltbookBacklog = (backlog: MoltbookPostDraft[]) => {
  const seen = new Set<string>();
  const active: MoltbookPostDraft[] = [];
  const posted: MoltbookPostDraft[] = [];
  [...backlog]
    .sort((a, b) => Date.parse(b.createdAt || b.scheduledFor || "0") - Date.parse(a.createdAt || a.scheduledFor || "0"))
    .forEach((draft) => {
      const key = `${draft.title}\n${draft.body}`.toLowerCase().replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      if (draft.status === "posted") {
        if (posted.length < MOLTBOOK_BACKLOG_POSTED_KEEP) posted.push(draft);
        return;
      }
      if (active.length < MOLTBOOK_BACKLOG_LIMIT) active.push(draft);
    });
  return [...active, ...posted];
};

export const ensureMoltbookAiNewsDrafts = (
  checkedAt = new Date(),
  initialState = loadMoltbookState(),
) => {
  const briefs = loadMoltbookNewsBriefs(16);
  const aiBriefs = briefs
    .filter(isMoltbookAiNewsBrief)
    .filter((brief) => !isMoltbookBlockedTopic(`${brief.title} ${brief.summary} ${brief.fullSummary}`))
    .slice(0, MOLTBOOK_AI_NEWS_DAILY_TARGET);
  const day = checkedAt.toISOString().slice(0, 10);
  const existingIds = new Set(initialState.postBacklog.map((draft) => draft.id));
  const drafts: MoltbookPostDraft[] = aiBriefs.map((brief, index) => ({
    id: `ai-news-${day}-${slugMoltbookId(brief.id || brief.title)}`,
    title: `AI news ${index + 1}: ${compactText(brief.title, 72)}`,
    body: buildMoltbookNewsPostBody(brief),
    pillar: "AI News",
    status: "planned",
    scheduledFor: scheduledMoltbookNewsTime(checkedAt, index),
    source: "news_flow",
    createdAt: checkedAt.toISOString(),
  }));
  const created = drafts.filter((draft) => !existingIds.has(draft.id));
  const nextBacklog = pruneMoltbookBacklog([
    ...drafts,
    ...initialState.postBacklog.filter((draft) => !drafts.some((newsDraft) => newsDraft.id === draft.id)),
  ]);
  const state: MoltbookMobileState = {
    ...initialState,
    mode: initialState.mode === "paused" ? "paused" : "assisted",
    dailyCommentGoal: Math.max(20, Math.round(initialState.dailyCommentGoal || 0)),
    dailyLearningGoal: Math.max(3, Math.round(initialState.dailyLearningGoal || 0)),
    newsBriefs: briefs.slice(0, 12),
    newsDigest: buildNewsDigest(briefs),
    newsMemoryUpdatedAt: checkedAt.toLocaleString(),
    newsMemorySource: "News Flow AI shortlist",
    interests: Array.from(new Set([...initialState.interests, "AI news", "new AI products", "model releases", "agent tooling"])),
    postBacklog: nextBacklog,
    commandLog: [
      `${checkedAt.toLocaleString()}: prepared ${created.length}/${MOLTBOOK_AI_NEWS_DAILY_TARGET} AI-news Moltbook posts from NewsFlow.`,
      ...initialState.commandLog,
    ].slice(0, 30),
  };
  saveMoltbookState(state);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pocketflow:moltbook-updated", { detail: state }));
  }
  return {
    state,
    briefs: aiBriefs,
    created: created.length,
    planned: drafts.length,
    message: drafts.length
      ? `Prepared ${drafts.length} AI-news Moltbook posts from NewsFlow.`
      : "NewsFlow did not have enough AI news yet for Moltbook posts.",
  };
};

const hydrateMoltbookIdentity = (state: MoltbookMobileState): MoltbookMobileState => {
  const visitorPageUrl = state.visitorPageUrl?.trim();
  const savedUsername = state.username?.trim();
  const savedBridge = state.apiBaseUrl?.trim();
  const staleBridge =
    !savedBridge
    || savedBridge.includes("moltbook.com")
    || savedBridge.includes("sandbox")
    || savedBridge.includes("localhost")
    || savedBridge.includes("127.0.0.1");
  const normalizedUsername =
    !savedUsername || savedUsername === "@BalossBuddyBot" || savedUsername === "BalossBuddyBot"
      ? MOLTBOOK_ACCOUNT_HANDLE
      : savedUsername.replace(/^@+/, "");
  const liveBridge = staleBridge ? MOLTBOOK_BRIDGE_URL : savedBridge;
  const savedHealth = state.connectionHealth || MOLTBOOK_DEFAULT_HEALTH;
  const healthEndpoint = savedHealth.endpoint || `${liveBridge}/api/status`;
  const staleHealth =
    !savedHealth.endpoint
    || savedHealth.status === "missing"
    || savedHealth.status === "mock"
    || savedHealth.serverMode === "mock"
    || savedHealth.endpoint.includes("moltbook.com")
    || savedHealth.endpoint.includes("sandbox")
    || savedHealth.endpoint.includes("localhost")
    || savedHealth.endpoint.includes("127.0.0.1");
  const connectionHealth: MoltbookConnectionHealth = staleHealth
    ? { ...MOLTBOOK_DEFAULT_HEALTH, endpoint: `${liveBridge}/api/status` }
    : {
        ...savedHealth,
        endpoint: healthEndpoint,
        serverMode: savedHealth.serverMode === "mock" ? "live" : savedHealth.serverMode,
        modelProvider: "local",
        modelName: savedHealth.modelName || "Baloss LLM",
        modelReady: savedHealth.modelReady !== false,
      };
  const ownerPaused = state.mode === "paused" && Boolean(state.pauseConfirmedAt);
  return {
    ...state,
    mode: state.mode === "approval" || (state.mode === "paused" && !ownerPaused) ? "assisted" : state.mode,
    pauseConfirmedAt: ownerPaused ? state.pauseConfirmedAt : undefined,
    pauseReason: ownerPaused ? state.pauseReason : undefined,
    username: normalizedUsername,
    connectionMode: staleBridge || state.connectionMode === "mock" ? "live" : state.connectionMode,
    apiBaseUrl: liveBridge,
    connectionHealth,
    userId: state.userId?.trim() || MOLTBOOK_ACCOUNT_USER_ID,
    tokenFingerprint: state.tokenFingerprint?.trim() || MOLTBOOK_TOKEN_FINGERPRINT,
    visitorPageUrl:
      !visitorPageUrl || visitorPageUrl === "https://moltbook.com" || visitorPageUrl.includes("x.com/BalossBuddyBot")
        ? MOLTBOOK_ACCOUNT_VISITOR_URL
        : visitorPageUrl,
  };
};

const numberWords: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  venti: 20,
  twenty: 20,
};

export const isMoltbookBlockedTopic = (topic: string) => {
  const normalized = topic.toLowerCase();
  return MOLTBOOK_BLOCKED_TERMS.some((term) => normalized.includes(term));
};

export const distributeMoltbookPosts = (total: number): MoltbookScheduleSlot[] => {
  const cleanTotal = Math.max(0, Math.min(48, Math.round(total || 0)));
  const base = Math.floor(cleanTotal / MOLTBOOK_DEFAULT_SCHEDULE.length);
  const remainder = cleanTotal % MOLTBOOK_DEFAULT_SCHEDULE.length;
  return MOLTBOOK_DEFAULT_SCHEDULE.map((slot, index) => ({
    ...slot,
    posts: base + (index < remainder ? 1 : 0),
  }));
};

const normalizeMoltbookSchedule = (schedule?: MoltbookScheduleSlot[]) => {
  const incoming = Array.isArray(schedule) && schedule.length ? schedule : MOLTBOOK_DEFAULT_SCHEDULE;
  const valid = incoming
    .filter((slot) => slot?.id && slot?.window)
    .map((slot) => ({
      ...slot,
      posts: Math.max(0, Math.min(12, Math.round(Number(slot.posts || 0)))),
    }));
  const total = valid.reduce((sum, slot) => sum + slot.posts, 0);
  const legacyTwelvePerDay =
    valid.length === 4
    && total === 12
    && valid.every((slot) => ["morning", "day", "evening", "night"].includes(slot.id) && slot.posts === 3);

  if (!valid.length || total < 10 || total > 14 || legacyTwelvePerDay) {
    return MOLTBOOK_DEFAULT_SCHEDULE;
  }

  return valid;
};

export const loadMoltbookState = (): MoltbookMobileState => {
  if (typeof window === "undefined") return MOLTBOOK_DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(MOLTBOOK_STORAGE_KEY);
    if (!raw) return MOLTBOOK_DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<MoltbookMobileState>;
    return hydrateMoltbookIdentity({
      ...MOLTBOOK_DEFAULT_STATE,
      ...parsed,
      schedule: normalizeMoltbookSchedule(parsed.schedule),
      interests: Array.isArray(parsed.interests) && parsed.interests.length ? parsed.interests : MOLTBOOK_DEFAULT_STATE.interests,
      avoidedTopics: Array.isArray(parsed.avoidedTopics) ? parsed.avoidedTopics : MOLTBOOK_DEFAULT_STATE.avoidedTopics,
      examples: Array.isArray(parsed.examples) && parsed.examples.length ? parsed.examples : MOLTBOOK_DEFAULT_STATE.examples,
      commentGuidelines: Array.isArray(parsed.commentGuidelines) && parsed.commentGuidelines.length ? parsed.commentGuidelines : MOLTBOOK_DEFAULT_STATE.commentGuidelines,
      newsBriefs: Array.isArray((parsed as { newsBriefs?: MoltbookNewsBrief[] }).newsBriefs)
        ? (parsed as { newsBriefs?: MoltbookNewsBrief[] }).newsBriefs!.slice(0, 12)
        : MOLTBOOK_DEFAULT_STATE.newsBriefs,
      newsDigest: typeof (parsed as { newsDigest?: string }).newsDigest === "string"
        ? (parsed as { newsDigest?: string }).newsDigest!
        : MOLTBOOK_DEFAULT_STATE.newsDigest,
      newsMemoryUpdatedAt: typeof (parsed as { newsMemoryUpdatedAt?: string }).newsMemoryUpdatedAt === "string"
        ? (parsed as { newsMemoryUpdatedAt?: string }).newsMemoryUpdatedAt!
        : MOLTBOOK_DEFAULT_STATE.newsMemoryUpdatedAt,
      newsMemorySource: typeof (parsed as { newsMemorySource?: string }).newsMemorySource === "string"
        ? (parsed as { newsMemorySource?: string }).newsMemorySource!
        : MOLTBOOK_DEFAULT_STATE.newsMemorySource,
      planning: { ...MOLTBOOK_DEFAULT_PLANNING, ...(parsed.planning || {}) },
      postBacklog: normalizeBacklog(parsed.postBacklog),
      interaction: { ...MOLTBOOK_DEFAULT_STATE.interaction, ...(parsed.interaction || {}) },
      connectionHealth: { ...MOLTBOOK_DEFAULT_HEALTH, ...(parsed.connectionHealth || {}) },
      commandLog: Array.isArray(parsed.commandLog) ? parsed.commandLog : [],
    });
  } catch {
    return MOLTBOOK_DEFAULT_STATE;
  }
};

export const moltbookDailyPostTarget = (state: Pick<MoltbookMobileState, "schedule">) =>
  state.schedule.reduce((total, slot) => total + Number(slot.posts || 0), 0);

const scheduleDatesForReserve = (state: MoltbookMobileState) => {
  const slots = state.schedule.filter((slot) => slot.posts > 0);
  const now = new Date();
  const dates: string[] = [];
  let catchUpIndex = 0;
  for (let day = 0; day < state.planning.reserveDays; day += 1) {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + day);
    slots.forEach((slot) => {
      const [startRaw = "09:00", endRaw = "10:00"] = slot.window.split("-").map((part) => part.trim());
      const [startHour = "09", startMinute = "00"] = startRaw.split(":");
      const [endHour = "10", endMinute = "00"] = endRaw.split(":");
      const windowStart = new Date(targetDate);
      windowStart.setHours(Number(startHour), Number(startMinute), 0, 0);
      const windowEnd = new Date(targetDate);
      windowEnd.setHours(Number(endHour), Number(endMinute), 0, 0);
      if (windowEnd <= windowStart) windowEnd.setDate(windowEnd.getDate() + 1);
      const spacingMs = Math.max(15 * 60 * 1000, (windowEnd.getTime() - windowStart.getTime()) / (slot.posts + 1));
      for (let index = 0; index < slot.posts; index += 1) {
        const scheduled = new Date(windowStart.getTime() + spacingMs * (index + 1));
        if (day === 0 && scheduled <= now) {
          scheduled.setTime(
            catchUpIndex === 0
              ? now.getTime() - 60 * 1000
              : now.getTime() + catchUpIndex * 20 * 60 * 1000,
          );
          catchUpIndex += 1;
        }
        dates.push(scheduled.toISOString());
      }
    });
  }
  return dates;
};

export const getMoltbookReserveStats = (state: MoltbookMobileState) => {
  const dailyTarget = moltbookDailyPostTarget(state);
  const reserveTarget = dailyTarget * state.planning.reserveDays;
  const ready = state.postBacklog.filter((draft) => draft.status === "ready").length;
  const planned = state.postBacklog.filter((draft) => draft.status === "planned").length;
  const futurePlanned = state.postBacklog.filter((draft) => draft.status === "planned" && draft.scheduledFor && Date.parse(draft.scheduledFor) > Date.now()).length;
  const held = state.postBacklog.filter((draft) => draft.status === "held").length;
  const posted = state.postBacklog.filter((draft) => draft.status === "posted").length;
  return {
    dailyTarget,
    reserveTarget,
    ready,
    planned,
    futurePlanned,
    held,
    posted,
    total: state.postBacklog.length,
    missing: Math.max(0, reserveTarget - futurePlanned),
  };
};

const pickDiverseReadyDraftIds = (backlog: MoltbookPostDraft[], need: number) => {
  const ready = backlog
    .filter((draft) => draft.status === "ready")
    .sort((a, b) => {
      const pocketScore = Number(isPocketFlowCentricDraft(a)) - Number(isPocketFlowCentricDraft(b));
      if (pocketScore) return pocketScore;
      return `${a.pillar} ${a.title}`.localeCompare(`${b.pillar} ${b.title}`);
    });
  const selected: MoltbookPostDraft[] = [];
  const usedIds = new Set<string>();
  const pillarCounts = new Map<string, number>();
  const pocketLimit = Math.max(1, Math.floor(Math.max(need, 1) * MOLTBOOK_POCKETFLOW_MAX_PLANNED_RATIO));

  while (selected.length < need) {
    const pocketSelected = selected.filter(isPocketFlowCentricDraft).length;
    const candidates = ready
      .filter((draft) => !usedIds.has(draft.id))
      .filter((draft) => !isPocketFlowCentricDraft(draft) || pocketSelected < pocketLimit);
    if (!candidates.length) break;

    const next = candidates.sort((a, b) => {
      const pillarDelta = (pillarCounts.get(a.pillar) || 0) - (pillarCounts.get(b.pillar) || 0);
      if (pillarDelta) return pillarDelta;
      const sourceDelta = Number(a.source === "starter") - Number(b.source === "starter");
      if (sourceDelta) return sourceDelta;
      return Date.parse(a.createdAt || "0") - Date.parse(b.createdAt || "0");
    })[0];
    selected.push(next);
    usedIds.add(next.id);
    pillarCounts.set(next.pillar, (pillarCounts.get(next.pillar) || 0) + 1);
  }

  return new Set(selected.map((draft) => draft.id));
};

export const prepareMoltbookTwoDayReserve = (initialState = loadMoltbookState()) => {
  const scheduleDates = scheduleDatesForReserve(initialState);
  const stats = getMoltbookReserveStats(initialState);
  const need = Math.min(stats.missing || stats.reserveTarget, scheduleDates.length);
  let assigned = 0;
  const diverseReadyIds = pickDiverseReadyDraftIds(initialState.postBacklog, need);
  const nextBacklog = initialState.postBacklog.map((draft) => {
    if (assigned >= need || draft.status !== "ready" || !diverseReadyIds.has(draft.id)) return draft;
    const scheduledFor = scheduleDates[assigned];
    assigned += 1;
    return {
      ...draft,
      status: "planned" as MoltbookDraftStatus,
      scheduledFor,
    };
  });
  const now = new Date();
  const nextPlanning = new Date(now);
  nextPlanning.setDate(now.getDate() + 1);
  nextPlanning.setHours(5, 0, 0, 0);
  const state: MoltbookMobileState = {
    ...initialState,
    mode: initialState.mode === "paused" ? "paused" : "assisted",
    planning: {
      ...initialState.planning,
      lowLoadMode: true,
      reserveDays: 2,
      modelEffort: "minimum",
      batchSize: Math.max(30, initialState.planning.batchSize || 30),
      maxModelBurstsPerDay: Math.max(3, initialState.planning.maxModelBurstsPerDay || 3),
      lastPreparedAt: now.toLocaleString(),
      nextPlanningAt: nextPlanning.toLocaleString(),
    },
    postBacklog: nextBacklog,
    commandLog: [
      `${now.toLocaleString()}: prepared ${assigned} Moltbook backup posts with minimum model effort.`,
      ...initialState.commandLog,
    ].slice(0, 30),
  };
  saveMoltbookState(state);
  return { state, assigned, stats: getMoltbookReserveStats(state) };
};

export const saveMoltbookState = (state: MoltbookMobileState) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MOLTBOOK_STORAGE_KEY, JSON.stringify(state));
};

export const ensureMoltbookBuildDiaryDraft = (
  checkedAt = new Date(),
  initialState = loadMoltbookState(),
) => {
  const day = buildDiaryTodayKey(checkedAt);
  let diary = loadMoltbookBuildDiaryState();
  const existingDraft = initialState.postBacklog.find((draft) => draft.id === `build-diary-${day}`);
  const existingEntry = diary.entries.find((entry) => entry.id === `build-diary-${day}`);
  if (existingDraft && diary.lastGeneratedFor === day) {
    return {
      state: initialState,
      diary,
      entry: existingEntry,
      draft: existingDraft,
      created: false,
      message: "PocketFlow build diary draft already exists for today.",
    };
  }

  const entry = existingEntry || createMoltbookBuildDiaryEntry(checkedAt);
  const scheduledFor = new Date(checkedAt);
  scheduledFor.setHours(21, 45, 0, 0);
  if (scheduledFor.getTime() < checkedAt.getTime()) {
    scheduledFor.setTime(checkedAt.getTime() - 60_000);
  }

  const draft: MoltbookPostDraft = existingDraft || {
    id: `build-diary-${day}`,
    title: publicSafeBuildDiaryText(entry.title, "PocketFlow build diary"),
    body: buildDiaryPostBody(entry),
    pillar: "PocketFlow Build Diary",
    status: "planned",
    scheduledFor: scheduledFor.toISOString(),
    source: "build_diary",
    createdAt: checkedAt.toISOString(),
  };
  const state: MoltbookMobileState = {
    ...initialState,
    mode: initialState.mode === "paused" ? "paused" : "assisted",
    postBacklog: existingDraft
      ? initialState.postBacklog.map((item) => (item.id === existingDraft.id ? { ...existingDraft, ...draft } : item))
      : [draft, ...initialState.postBacklog].slice(0, 150),
    commandLog: [
      `${checkedAt.toLocaleString()}: PocketFlow build diary ${existingDraft ? "refreshed" : "queued"} for Moltbook.`,
      ...initialState.commandLog,
    ].slice(0, 30),
  };
  diary = saveMoltbookBuildDiaryState({
    ...diary,
    updatedAt: checkedAt.toISOString(),
    lastGeneratedFor: day,
    publicBuildSummary:
      "PocketFlow is becoming a phone-first local AI workspace with one Baloss control panel, visible agent routes, safer scheduled automations, and low-load model routing.",
    entries: [
      { ...entry, draftId: draft.id },
      ...diary.entries.filter((item) => item.id !== entry.id),
    ].slice(0, 60),
  });
  saveMoltbookState(state);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pocketflow:moltbook-updated", { detail: state }));
  }
  return {
    state,
    diary,
    entry: { ...entry, draftId: draft.id },
    draft,
    created: !existingDraft,
    message: existingDraft
      ? "PocketFlow build diary draft refreshed."
      : "PocketFlow build diary draft queued for today's extra Moltbook post.",
  };
};

const extractNumber = (prompt: string): number | null => {
  const digitMatch = prompt.match(/\b(\d{1,2})\b/);
  if (digitMatch) return Number(digitMatch[1]);
  const word = Object.keys(numberWords).find((item) => new RegExp(`\\b${item}\\b`, "i").test(prompt));
  return word ? numberWords[word] : null;
};

const extractTopicAfter = (prompt: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match?.[1]) {
      return match[1]
        .replace(/[.!?]+$/g, "")
        .replace(/\b(today|tomorrow|per day|a day|daily|from now on)\b/gi, "")
        .trim();
    }
  }
  return "";
};

export const parseMoltbookInstruction = (prompt: string): MoltbookInstruction | null => {
  const normalized = prompt.toLowerCase();
  const mentionsMoltbook = /\b(moltbook|multipoke|multi poke|posting agent|social agent)\b/i.test(prompt);
  const immediatePostCommand = /\b(post|publish|send|share|pubblica|posta)\b/i.test(prompt) && /\b(now|immediately|right now|today|tonight|adesso|ora|subito|do it|fallo)\b/i.test(prompt);
  const obviousPostingCommand = /\b(post|posting|comment|comments|reply|answer|respond|rispondi|commenta|pubblica|posta)\b/i.test(prompt) && /\b(about|regarding|topic|argument|times?|daily|a day|per day|style|tone|how|when|what|now|immediately|adesso|ora|subito)\b/i.test(prompt);
  if (!mentionsMoltbook && !obviousPostingCommand) return null;

  if (immediatePostCommand) {
    const content = extractTopicAfter(prompt, [
      /(?:saying|with text|text|body|content)\s*[:\-]?\s+(.+)$/i,
      /(?:about|regarding|on)\s+(.+)$/i,
      /(?:post|publish|send|share|pubblica|posta)\s+(?:now|immediately|right now|today|tonight|adesso|ora|subito)?\s*[:\-]?\s+(.+)$/i,
    ]);
    const cleanContent = content
      .replace(/\b(moltbook|multipoke|multi poke|posting agent|social agent)\b/gi, "")
      .replace(/\b(now|immediately|right now|adesso|ora|subito|do it|fallo)\b/gi, "")
      .trim();
    return {
      type: "publish_now",
      content: cleanContent || undefined,
      topic: cleanContent || undefined,
    };
  }

  const explicitPauseCommand =
    mentionsMoltbook
    && /\b(pause|stop|disable|shut(?:\s+down)?|turn\s+off)\b/i.test(prompt)
    && /\b(moltbook|multipoke|multi poke|posting agent|social agent|automation|runner)\b/i.test(prompt)
    && !/\b(after|failed?|failures?|limit|threshold|about|topic|argument|argomento|regarding|on)\b/i.test(prompt);
  if (explicitPauseCommand) {
    return { type: "pause" };
  }
  if (/\b(resume|start|restart|continue|activate)\b/i.test(prompt) && !/\bpost\b/i.test(prompt)) {
    return { type: "resume" };
  }

  if (/\b(backup|reserve|queue|prepare|plan|preplan|pre-plan)\b/i.test(prompt)) {
    return { type: "prepare_reserve" };
  }

  if (/\b(low load|low-load|minimum effort|least effort|no rush|no hurry|do not overload|don't overload)\b/i.test(prompt)) {
    return { type: "set_low_load", enabled: true };
  }

  if (/\b(stop|remove|avoid|block|no more|do not|don't)\b/i.test(prompt) && /\b(about|topic|argument|argomento|regarding|on)\b/i.test(prompt)) {
    const topic =
      extractTopicAfter(prompt, [
        /(?:about|topic|argument|argomento|regarding|on)\s+(.+)$/i,
        /(?:stop|remove|avoid|block|no more|do not|don't)\s+(.+)$/i,
      ]) || "that topic";
    return { type: "stop_topic", topic };
  }

  if (/\b(comment|comments|commentare|commenti)\b/i.test(prompt)) {
    const total = extractNumber(prompt);
    if (total !== null) return { type: "set_comments", total };
  }

  if (/\b(answer|reply|respond|rispondi|comment reply|commenti|comments)\b/i.test(prompt) && /\b(how|style|tone|say|saying|with|like|answer)\b/i.test(prompt)) {
    const guidance = prompt
      .replace(/\b(moltbook|multipoke|multi poke|posting agent|social agent)\b/gi, "")
      .replace(/^\s*(tell|set|make|ask)\s+/i, "")
      .trim();
    if (guidance) return { type: "set_comment_guidance", guidance };
  }

  if (/\b(style|tone|voice|write like|sound like|writing)\b/i.test(prompt) && /\b(post|posting|moltbook|agent)\b/i.test(prompt)) {
    const guidance = prompt
      .replace(/\b(moltbook|multipoke|multi poke|posting agent|social agent)\b/gi, "")
      .replace(/^\s*(tell|set|make|ask)\s+/i, "")
      .trim();
    if (guidance) return { type: "set_posting_voice", guidance };
  }

  if (/\b(add|include|focus|interest|interests|talk about|post|posting|regarding|on)\b/i.test(prompt)) {
    const topic = extractTopicAfter(prompt, [
      /(?:about|regarding|on|interest(?:s)?|focus(?: on)?|talk about)\s+(.+)$/i,
      /(?:add|include)\s+(.+)$/i,
    ]);
    const amount = extractNumber(prompt);
    if (/\b(extra|more|additional)\b/i.test(prompt) && /\bpost/i.test(prompt) && amount !== null) {
      return { type: "add_extra_posts", amount, topic: topic || undefined };
    }
    if (/\bpost/i.test(prompt) && /\b(times?|posts?)\b/i.test(prompt) && amount !== null && !/\bextra|more|additional\b/i.test(prompt)) {
      return { type: "set_daily_posts", total: amount, topic: topic || undefined };
    }
    if (topic) return { type: "add_interest", topic };
  }

  if (mentionsMoltbook) {
    return { type: "general_guidance", guidance: prompt.trim() };
  }

  return null;
};

export const applyMoltbookInstruction = (
  instruction: MoltbookInstruction,
  initialState = loadMoltbookState(),
): MoltbookInstructionResult => {
  let state = initialState;
  let response = "";

  const addCommandLog = (entry: string) => {
    state = {
      ...state,
      commandLog: [entry, ...state.commandLog].slice(0, 30),
    };
  };

  const addInterest = (topic?: string) => {
    if (!topic || topic === "that topic") return;
    if (isMoltbookBlockedTopic(topic)) return;
    const exists = state.interests.some((item) => item.toLowerCase() === topic.toLowerCase());
    if (!exists) state = { ...state, interests: [...state.interests, topic] };
  };

  if (instruction.type === "set_daily_posts") {
    addInterest(instruction.topic);
    state = { ...state, schedule: distributeMoltbookPosts(instruction.total), mode: "assisted" };
    response = `Moltbook updated: ${instruction.total} posts/day${instruction.topic ? `, focused on ${instruction.topic}` : ""}. Autonomous phone mode stays armed.`;
  } else if (instruction.type === "add_extra_posts") {
    const currentTotal = state.schedule.reduce((total, slot) => total + slot.posts, 0);
    addInterest(instruction.topic);
    state = { ...state, schedule: distributeMoltbookPosts(currentTotal + instruction.amount), mode: "assisted" };
    response = `Moltbook updated: added ${instruction.amount} extra posts/day${instruction.topic ? ` about ${instruction.topic}` : ""}. New total: ${currentTotal + instruction.amount}/day.`;
  } else if (instruction.type === "publish_now") {
    addInterest(instruction.topic);
    state = { ...state, mode: "assisted" };
    response = "Moltbook publish-now requested. I will only mark it posted after the live bridge confirms execution.";
  } else if (instruction.type === "set_comments") {
    state = { ...state, dailyCommentGoal: Math.max(0, Math.min(80, instruction.total)), mode: "assisted" };
    response = `Moltbook updated: comment target set to ${state.dailyCommentGoal}/day. Autonomous phone mode stays armed.`;
  } else if (instruction.type === "set_comment_guidance") {
    const guidance = instruction.guidance.trim();
    state = {
      ...state,
      commentGuidelines: guidance
        ? [guidance, ...state.commentGuidelines.filter((item) => item.toLowerCase() !== guidance.toLowerCase())].slice(0, 12)
        : state.commentGuidelines,
      mode: "assisted",
    };
    response = guidance
      ? `Moltbook comment guidance saved: ${guidance}`
      : "Moltbook comment guidance was empty, so nothing changed.";
  } else if (instruction.type === "set_posting_voice") {
    const guidance = instruction.guidance.trim();
    state = {
      ...state,
      examples: guidance
        ? [guidance, ...state.examples.filter((item) => item.toLowerCase() !== guidance.toLowerCase())].slice(0, 20)
        : state.examples,
      mode: "assisted",
    };
    response = guidance
      ? `Moltbook posting voice saved: ${guidance}`
      : "Moltbook posting voice was empty, so nothing changed.";
  } else if (instruction.type === "add_interest") {
    if (isMoltbookBlockedTopic(instruction.topic)) {
      return {
        ok: false,
        state,
        response: "Moltbook refused that topic because crypto/coins/trading content is blocked.",
      };
    }
    addInterest(instruction.topic);
    response = `Moltbook interest added: ${instruction.topic}.`;
  } else if (instruction.type === "stop_topic") {
    const topic = instruction.topic.trim();
    state = {
      ...state,
      interests: state.interests.filter((item) => item.toLowerCase() !== topic.toLowerCase()),
      avoidedTopics: Array.from(new Set([...state.avoidedTopics, topic])),
      mode: "assisted",
    };
    response = `Moltbook will avoid: ${topic}. I removed matching interests and kept posting armed.`;
  } else if (instruction.type === "prepare_reserve") {
    const result = prepareMoltbookTwoDayReserve(state);
    state = result.state;
    response = `Moltbook prepared ${result.assigned} queued posts. Reserve: ${result.stats.planned}/${result.stats.reserveTarget}, model effort minimum.`;
  } else if (instruction.type === "set_low_load") {
    state = {
      ...state,
      mode: "assisted",
      planning: {
        ...state.planning,
        lowLoadMode: instruction.enabled,
        modelEffort: instruction.enabled ? "minimum" : state.planning.modelEffort,
        maxModelBurstsPerDay: instruction.enabled ? 2 : state.planning.maxModelBurstsPerDay,
      },
    };
    response = instruction.enabled
      ? "Moltbook low-load mode enabled. It plans slowly, keeps a reserve queue, and avoids urgent generation."
      : "Moltbook low-load mode disabled.";
  } else if (instruction.type === "pause") {
    state = {
      ...state,
      mode: "paused",
      pauseConfirmedAt: new Date().toISOString(),
      pauseReason: "Explicit owner pause command",
    };
    response = "Moltbook paused. No posting/comment queue should dispatch.";
  } else if (instruction.type === "resume") {
    state = { ...state, mode: "assisted", pauseConfirmedAt: undefined, pauseReason: undefined };
    response = "Moltbook resumed in autonomous assisted mode.";
  } else if (instruction.type === "general_guidance") {
    const guidance = instruction.guidance.trim();
    state = {
      ...state,
      commandLog: guidance ? [`${new Date().toLocaleString()}: ${guidance}`, ...state.commandLog].slice(0, 30) : state.commandLog,
      mode: "assisted",
    };
    response = guidance
      ? "Moltbook saved that instruction. It will use it as operating context for future posts and replies."
      : "Moltbook did not receive an instruction.";
  }

  addCommandLog(`${new Date().toLocaleString()}: ${response}`);
  saveMoltbookState(state);

  return { ok: true, state, response };
};

type MoltbookAutomationResult = {
  ok: boolean;
  posted: number;
  failed: number;
  skipped: boolean;
  message: string;
  state: MoltbookMobileState;
};

const normalizeMoltbookEndpoint = (value: string) => value.trim().replace(/\/+$/g, "");

const getMoltbookNativeBridge = () =>
  typeof window === "undefined"
    ? undefined
    : (
        window as Window & {
          PocketFlowReceiveBridge?: {
            httpJsonGet?: (url: string) => Promise<MoltbookNativeHttpJsonResponse>;
            httpJsonPost?: (url: string, body: string, headersJson?: string) => Promise<MoltbookNativeHttpJsonResponse>;
          };
        }
      ).PocketFlowReceiveBridge;

const parseMoltbookResponseBody = (text?: string) => {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text || "" };
  }
};

const readMoltbookJson = async (url: string, timeoutMs = 3500) => {
  const bridge = getMoltbookNativeBridge();
  if (bridge?.httpJsonGet) {
    const result = await bridge.httpJsonGet(url);
    const parsed = parseMoltbookResponseBody(result.body);
    if (!result.ok) throw new Error((parsed as { message?: string })?.message || result.message || `HTTP ${result.status || 0}`);
    return parsed as Record<string, unknown>;
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    const text = await response.text();
    const parsed = parseMoltbookResponseBody(text);
    if (!response.ok) throw new Error((parsed as { message?: string })?.message || `HTTP ${response.status}`);
    return parsed as Record<string, unknown>;
  } finally {
    window.clearTimeout(timer);
  }
};

const postMoltbookJson = async (url: string, body: unknown, timeoutMs = 8000) => {
  const bridge = getMoltbookNativeBridge();
  const encodedBody = JSON.stringify(body);
  if (bridge?.httpJsonPost) {
    const result = await bridge.httpJsonPost(
      url,
      encodedBody,
      JSON.stringify({ "Content-Type": "application/json", Accept: "application/json" }),
    );
    const parsed = parseMoltbookResponseBody(result.body);
    if (!result.ok) throw new Error((parsed as { message?: string })?.message || result.message || `HTTP ${result.status || 0}`);
    return parsed as Record<string, unknown>;
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: encodedBody,
      signal: controller.signal,
    });
    const text = await response.text();
    const parsed = parseMoltbookResponseBody(text);
    if (!response.ok) throw new Error((parsed as { message?: string })?.message || `HTTP ${response.status}`);
    return parsed as Record<string, unknown>;
  } finally {
    window.clearTimeout(timer);
  }
};

const isMoltbookNetworkError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || "");
  return /failed to fetch|networkerror|load failed|abort|timed out|timeout|network request failed|connection|offline/i.test(message);
};

const buildHealthFromMoltbookStatus = (
  endpoint: string,
  payload: Record<string, unknown>,
): MoltbookConnectionHealth => {
  const settings = (payload.settings || {}) as Record<string, unknown>;
  const moltbook = (payload.moltbook || {}) as Record<string, unknown>;
  const auth = (payload.auth || {}) as Record<string, unknown>;
  const agent = (payload.agent || {}) as Record<string, unknown>;
  const queue = (payload.queue || payload.connection_status || {}) as Record<string, unknown>;
  const stats = (payload.stats_today || payload.counters || {}) as Record<string, unknown>;
  const model = (payload.model || {}) as Record<string, unknown>;
  const statusText = String(payload.status || payload.mode || "");
  const bridge = String(payload.bridge || "");
  const currentObjective = String(agent.currentObjective || "");
  const nextAction = String(agent.nextAction || "");
  const serverManaged = bridge.includes("moltbook-agent-pocketflow")
    && (
      agent.isRunning === true
      || /moltbook automation/i.test(currentObjective)
      || /verified plan step/i.test(nextAction)
    );
  const mode = String(moltbook.mode || settings.moltbook_mode || payload.serverMode || payload.mode || "unknown");
  const connected = Boolean(
    payload.ok
    || auth.valid
    || payload.connected
    || moltbook.connected
    || serverManaged
    || statusText === "ok"
    || statusText === "connected"
    || statusText === "online",
  );
  const status: MoltbookHealthStatus = mode === "mock" ? "mock" : connected ? "connected" : "error";
  return {
    ...MOLTBOOK_DEFAULT_HEALTH,
    status,
    message:
      status === "connected"
        ? serverManaged
          ? "Tanuki server Moltbook agent is running and authenticated."
          : "Moltbook live bridge reachable."
        : status === "mock"
          ? "Moltbook bridge reachable, but still in mock mode."
          : String(payload.message || "Moltbook bridge did not report connected."),
    checkedAt: new Date().toLocaleString(),
    endpoint,
    serverMode: mode || String(payload.serverMode || payload.mode || (connected ? "live" : "unknown")),
    modelProvider: String(model.provider || settings.provider_mode || payload.modelProvider || "local"),
    modelName: String(model.name || settings.ollama_model || payload.modelName || "Baloss LLM"),
    modelReady: Boolean(payload.modelReady ?? connected),
    queuePending: Number(queue.pending || queue.pending_approval_count || queue.queued || payload.queuePending || 0),
    queueTotal: Number(queue.total || queue.total_items || payload.queueTotal || 0)
      || Number(queue.queued || 0) + Number(queue.executed || 0) + Number(queue.failed || 0),
    healthyKeys: 0,
    keyTotal: 0,
    actionsToday: Number(stats.total_actions || payload.actionsToday || 0),
    actionLimit: Number(settings.daily_action_limit || payload.actionLimit || 20),
  };
};

const isMoltbookServerManagedStatus = (payload: Record<string, unknown>) => {
  const bridge = String(payload.bridge || "");
  const agent = (payload.agent || {}) as Record<string, unknown>;
  const currentObjective = String(agent.currentObjective || "");
  const nextAction = String(agent.nextAction || "");
  return (
    bridge.includes("moltbook-agent-pocketflow")
    && (
      agent.isRunning === true
      || /moltbook automation/i.test(currentObjective)
      || /verified plan step/i.test(nextAction)
    )
  );
};

const pickMoltbookPublishDraft = (
  state: MoltbookMobileState,
  instruction?: Extract<MoltbookInstruction, { type: "publish_now" }>,
): { draft: MoltbookPostDraft; state: MoltbookMobileState; temporary: boolean } | null => {
  const now = new Date();
  const content = instruction?.content?.trim();
  if (content) {
    const title = content.length > 72 ? `${content.slice(0, 69).trim()}...` : content;
    const draft: MoltbookPostDraft = {
      id: `instant-${now.getTime()}`,
      title: title || "Immediate Moltbook update",
      body: content,
      pillar: instruction?.topic || "Manual instruction",
      status: "planned",
      scheduledFor: now.toISOString(),
      source: "manual",
      createdAt: now.toISOString(),
    };
    return {
      draft,
      state: {
        ...state,
        postBacklog: [draft, ...state.postBacklog].slice(0, 140),
      },
      temporary: true,
    };
  }

  const draft =
    state.postBacklog.find((item) => item.status === "planned")
    || state.postBacklog.find((item) => item.status === "ready")
    || state.postBacklog.find((item) => item.status === "held");

  return draft ? { draft, state, temporary: false } : null;
};

const extractMoltbookQueueItemId = (queued: Record<string, unknown>): string => {
  const item = (queued.item || queued) as Record<string, unknown>;
  return String(item.id || queued.itemId || queued.queueId || queued.id || "");
};

export const publishMoltbookNow = async (
  options: {
    instruction?: Extract<MoltbookInstruction, { type: "publish_now" }>;
    state?: MoltbookMobileState;
    reason?: string;
  } = {},
): Promise<MoltbookPublishNowResult> => {
  const now = new Date();
  let state = options.state || loadMoltbookState();

  if (state.mode === "paused") {
    return { ok: false, state, message: "Moltbook is paused. Resume it before posting." };
  }

  const picked = pickMoltbookPublishDraft(state, options.instruction);
  if (!picked) {
    state = prepareMoltbookTwoDayReserve(state).state;
  }
  const publishTarget = picked || pickMoltbookPublishDraft(state, options.instruction);
  if (!publishTarget) {
    return { ok: false, state, message: "No Moltbook draft is ready to post." };
  }

  state = publishTarget.state;
  const { draft } = publishTarget;
  if (isMoltbookBlockedTopic(`${draft.title} ${draft.body} ${draft.pillar}`)) {
    const message = "Moltbook refused to post because the draft contains a blocked topic.";
    state = {
      ...state,
      commandLog: [`${now.toLocaleString()}: ${message}`, ...state.commandLog].slice(0, 30),
    };
    saveMoltbookState(state);
    return { ok: false, state, message, draftId: draft.id };
  }

  const endpoint = normalizeMoltbookEndpoint(state.apiBaseUrl || MOLTBOOK_BRIDGE_URL);
  state = {
    ...state,
    apiBaseUrl: endpoint,
    connectionMode: "live",
  };
  try {
    const health = buildHealthFromMoltbookStatus(endpoint, await readMoltbookJson(`${endpoint}/api/status`));
    if (health.status !== "connected") {
      state = {
        ...state,
        connectionHealth: health,
        commandLog: [`${now.toLocaleString()}: Moltbook publish blocked: ${health.message}`, ...state.commandLog].slice(0, 30),
      };
      saveMoltbookState(state);
      return { ok: false, state, message: health.message, draftId: draft.id };
    }
    if (health.queuePending > MOLTBOOK_SERVER_QUEUE_SOFT_LIMIT) {
      const message = `Moltbook bridge queue has ${health.queuePending} pending items. Posting is blocked until queue hygiene runs.`;
      state = {
        ...state,
        connectionHealth: health,
        commandLog: [`${now.toLocaleString()}: ${message}`, ...state.commandLog].slice(0, 30),
      };
      saveMoltbookState(state);
      return { ok: false, state, message, draftId: draft.id };
    }

    const queued = await postMoltbookJson(`${endpoint}/api/queue`, {
      action_type: "moltbook_post",
      platform: "moltbook",
      status: "approved",
      requires_approval: false,
      scheduled_for: now.toISOString(),
      source: options.reason || "pocketflow-phone-command",
      title: draft.title,
      content: `${draft.title}\n\n${draft.body}`,
    });
    const itemId = extractMoltbookQueueItemId(queued);
    if (!itemId) throw new Error("Bridge did not return a queue item id.");

    const executed = await postMoltbookJson(`${endpoint}/api/queue/${encodeURIComponent(itemId)}/execute`, {});
    const url = String(executed.url || executed.target_url || "");
    const message = `Posted now: ${draft.title}${url ? ` (${url})` : ""}.`;
    state = {
      ...state,
      connectionHealth: health,
      postBacklog: state.postBacklog.map((itemDraft) =>
        itemDraft.id === draft.id
          ? { ...itemDraft, status: "posted" as MoltbookDraftStatus, scheduledFor: itemDraft.scheduledFor || now.toISOString() }
          : itemDraft,
      ),
      interaction: {
        ...state.interaction,
        postsToday: Number(state.interaction.postsToday || 0) + 1,
        totalInteractions: Number(state.interaction.totalInteractions || 0) + 1,
        lastCheckedAt: now.toLocaleString(),
        lastSummary: message,
      },
      commandLog: [`${now.toLocaleString()}: ${message}`, ...state.commandLog].slice(0, 30),
    };
    saveMoltbookState(state);
    window.dispatchEvent(new CustomEvent("pocketflow:moltbook-updated", { detail: state }));
    return { ok: true, state, message, url, draftId: draft.id, bridgeItemId: itemId };
  } catch (error) {
    const message = `Moltbook did not post: ${error instanceof Error ? error.message : String(error)}`;
    state = {
      ...state,
      connectionHealth: {
        ...state.connectionHealth,
        status: "connected",
        message: "Live route is saved, but the bridge did not answer this post attempt. It will retry when the bridge responds.",
        checkedAt: now.toLocaleString(),
        endpoint: `${endpoint}/api/status`,
        serverMode: "live",
        modelProvider: "local",
        modelName: state.connectionHealth.modelName || "Baloss LLM",
        modelReady: true,
      },
      commandLog: [`${now.toLocaleString()}: ${message}`, ...state.commandLog].slice(0, 30),
    };
    saveMoltbookState(state);
    return {
      ok: false,
      state,
      message,
      error: error instanceof Error ? error.message : String(error),
      draftId: draft.id,
    };
  }
};

export const runMoltbookDueAutomation = async (options: { reason?: string; maxPosts?: number } = {}): Promise<MoltbookAutomationResult> => {
  const now = new Date();
  let state = loadMoltbookState();

  if (state.mode === "paused") {
    return { ok: true, posted: 0, failed: 0, skipped: true, message: "Moltbook is paused.", state };
  }

  state = ensureMoltbookAiNewsDrafts(now, state).state;

  const reserveStats = getMoltbookReserveStats(state);
  if (reserveStats.planned < Math.min(6, reserveStats.reserveTarget)) {
    state = prepareMoltbookTwoDayReserve(state).state;
  }

  const dueDrafts = state.postBacklog
    .filter((draft) => draft.status === "planned" && draft.scheduledFor && Date.parse(draft.scheduledFor) <= now.getTime())
    .sort((a, b) => Date.parse(a.scheduledFor || "") - Date.parse(b.scheduledFor || ""))
    .slice(0, Math.max(1, Math.min(options.maxPosts || 3, 6)));

  if (!dueDrafts.length) {
    return { ok: true, posted: 0, failed: 0, skipped: true, message: "No Moltbook posts are due.", state };
  }

  const endpoint = normalizeMoltbookEndpoint(state.apiBaseUrl || MOLTBOOK_BRIDGE_URL);
  let health: MoltbookConnectionHealth;
  let statusPayload: Record<string, unknown>;
  try {
    statusPayload = await readMoltbookJson(`${endpoint}/api/status`);
    health = buildHealthFromMoltbookStatus(endpoint, statusPayload);
  } catch (error) {
    const networkDeferred = isMoltbookNetworkError(error);
    health = {
      ...MOLTBOOK_DEFAULT_HEALTH,
      status: "error",
      endpoint,
      checkedAt: now.toLocaleString(),
      message: networkDeferred
        ? "Moltbook bridge unreachable. Automation deferred until the network/relay returns."
        : error instanceof Error ? error.message : String(error),
    };
    state = {
      ...state,
      connectionHealth: health,
      commandLog: [
        `${now.toLocaleString()}: Moltbook due-post check ${networkDeferred ? "deferred" : "failed"}: ${health.message}`,
        ...state.commandLog,
      ].slice(0, 30),
    };
    saveMoltbookState(state);
    return {
      ok: networkDeferred,
      posted: 0,
      failed: networkDeferred ? 0 : dueDrafts.length,
      skipped: networkDeferred,
      message: health.message,
      state,
    };
  }

  if (isMoltbookServerManagedStatus(statusPayload)) {
    state = {
      ...state,
      connectionHealth: health,
      interaction: {
        ...state.interaction,
        lastCheckedAt: now.toLocaleString(),
        lastSummary: "Tanuki server Moltbook agent is running; phone runner stood down to avoid duplicate post attempts.",
      },
      commandLog: [
        `${now.toLocaleString()}: Moltbook server agent already running; skipped phone due-post dispatch.`,
        ...state.commandLog,
      ].slice(0, 30),
    };
    saveMoltbookState(state);
    window.dispatchEvent(new CustomEvent("pocketflow:moltbook-updated", { detail: state }));
    return {
      ok: true,
      posted: 0,
      failed: 0,
      skipped: true,
      message: "Tanuki server Moltbook agent is running; phone did not duplicate posting attempts.",
      state,
    };
  }

  if (health.queuePending > MOLTBOOK_SERVER_QUEUE_SOFT_LIMIT) {
    const message = `Moltbook bridge queue has ${health.queuePending} pending items. Phone patrol stood down until queue hygiene clears it.`;
    state = {
      ...state,
      connectionHealth: health,
      interaction: {
        ...state.interaction,
        lastCheckedAt: now.toLocaleString(),
        lastSummary: message,
      },
      commandLog: [`${now.toLocaleString()}: ${message}`, ...state.commandLog].slice(0, 30),
    };
    saveMoltbookState(state);
    window.dispatchEvent(new CustomEvent("pocketflow:moltbook-updated", { detail: state }));
    return {
      ok: true,
      posted: 0,
      failed: 0,
      skipped: true,
      message,
      state,
    };
  }

  let posted = 0;
  let failed = 0;
  let networkFailures = 0;
  const postedIds = new Set<string>();
  const logEntries: string[] = [];

  for (const draft of dueDrafts) {
    try {
      const queued = await postMoltbookJson(`${endpoint}/api/queue`, {
        action_type: "moltbook_post",
        platform: "moltbook",
        status: "approved",
        requires_approval: false,
        scheduled_for: now.toISOString(),
        source: "pocketflow-phone-automation",
        title: draft.title,
        content: `${draft.title}\n\n${draft.body}`,
      });
      const itemId = extractMoltbookQueueItemId(queued);
      if (!itemId) throw new Error("Bridge did not return a queue item id.");
      await postMoltbookJson(`${endpoint}/api/queue/${encodeURIComponent(itemId)}/execute`, {});
      posted += 1;
      postedIds.add(draft.id);
      logEntries.push(`${now.toLocaleString()}: posted scheduled Moltbook draft "${draft.title}".`);
    } catch (error) {
      failed += 1;
      const networkDeferred = isMoltbookNetworkError(error);
      if (networkDeferred) networkFailures += 1;
      logEntries.push(`${now.toLocaleString()}: ${networkDeferred ? "deferred" : "failed"} Moltbook draft "${draft.title}": ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  state = {
    ...state,
    connectionHealth: health,
    postBacklog: state.postBacklog.map((draft) =>
      postedIds.has(draft.id)
        ? { ...draft, status: "posted" as MoltbookDraftStatus }
        : draft,
    ),
    interaction: {
      ...state.interaction,
      postsToday: state.interaction.postsToday + posted,
      totalInteractions: state.interaction.totalInteractions + posted,
      lastCheckedAt: now.toLocaleString(),
      lastSummary: posted
        ? `Posted ${posted} scheduled Moltbook update${posted === 1 ? "" : "s"}.`
        : state.interaction.lastSummary,
    },
    commandLog: [...logEntries, ...state.commandLog].slice(0, 30),
  };
  saveMoltbookState(state);
  window.dispatchEvent(new CustomEvent("pocketflow:moltbook-updated", { detail: state }));
  if (posted === 0 && failed > 0 && networkFailures === failed) {
    return {
      ok: true,
      posted: 0,
      failed: 0,
      skipped: true,
      message: "Moltbook bridge unreachable. Due posts are still queued and will retry when Relay/network returns.",
      state,
    };
  }
  return {
    ok: failed === 0,
    posted,
    failed,
    skipped: false,
    message: posted
      ? `Moltbook posted ${posted} due update${posted === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}.`
      : `Moltbook found ${dueDrafts.length} due post${dueDrafts.length === 1 ? "" : "s"}, but none posted.`,
    state,
  };
};
