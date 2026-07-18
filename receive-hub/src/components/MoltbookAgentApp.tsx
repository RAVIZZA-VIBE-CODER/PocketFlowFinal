import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Bot,
  ChevronDown,
  CheckCircle2,
  Clock3,
  Eye,
  ExternalLink,
  Link2,
  Plus,
  Send,
  RefreshCw,
  Settings2,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  MOLTBOOK_BLOCKED_TERMS,
  MOLTBOOK_ACCOUNT_CONTACT_EMAIL,
  MOLTBOOK_ACCOUNT_DISPLAY_NAME,
  MOLTBOOK_ACCOUNT_VISITOR_URL,
  MOLTBOOK_BRIDGE_URL,
  applyMoltbookInstruction,
  createMoltbookStarterBacklog,
  getMoltbookReserveStats,
  isMoltbookBlockedTopic,
  loadMoltbookState,
  moltbookDailyPostTarget,
  parseMoltbookInstruction,
  prepareMoltbookTwoDayReserve,
  publishMoltbookNow,
  saveMoltbookState,
  type MoltbookConnectionHealth,
  type MoltbookInstruction,
  type MoltbookMobileState,
  type MoltbookPostDraft,
  type MoltbookScheduleSlot,
} from "../utils/moltbookAgent";

type NotifyType = "success" | "error" | "info";

interface MoltbookAgentAppProps {
  onNotify: (message: string, type?: NotifyType) => void;
}

const Field = ({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) => (
  <label className="block">
    <span className="mb-2 block text-[10px] font-mono font-black uppercase tracking-[0.24em] text-zinc-500">
      {label}
    </span>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded-sm border border-white/10 bg-[#080808] px-4 py-3 text-sm font-semibold text-zinc-100 outline-none transition focus:border-[#FF4D00]/60"
    />
  </label>
);

const TextAreaField = ({
  label,
  value,
  onChange,
  placeholder,
  minHeight = "min-h-24",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}) => (
  <label className="block">
    <span className="mb-2 block text-[10px] font-mono font-black uppercase tracking-[0.24em] text-zinc-500">
      {label}
    </span>
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={`${minHeight} w-full resize-y rounded-sm border border-white/10 bg-[#080808] px-4 py-3 text-sm font-semibold leading-6 text-zinc-100 outline-none transition focus:border-[#FF4D00]/60`}
    />
  </label>
);

const Section = ({
  title,
  subtitle,
  children,
  defaultOpen = true,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-sm border border-white/10 bg-[#0E0E0E] shadow-sm">
      <button
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <h2 className="truncate text-[10px] font-mono font-black uppercase tracking-[0.22em] text-white">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{subtitle}</p>
        </div>
        <ChevronDown className={`h-5 w-5 shrink-0 text-[#FF4D00] transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-white/10 p-4">{children}</div>}
    </section>
  );
};

const PillButton = ({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`min-h-11 rounded-sm border px-3 py-2.5 text-[9px] font-mono font-black uppercase tracking-[0.16em] transition ${
      active
        ? "border-[#FF4D00]/60 bg-[#FF4D00]/12 text-[#FF4D00]"
        : "border-white/10 bg-black/30 text-zinc-500"
    }`}
  >
    {children}
  </button>
);

const DraftPreviewCard = ({
  draft,
  onChange,
  onRemove,
}: {
  key?: React.Key;
  draft: MoltbookPostDraft;
  onChange?: (patch: Partial<MoltbookPostDraft>) => void;
  onRemove?: () => void;
}) => (
  <div className="rounded-sm border border-white/10 bg-black/25 p-3">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        {onChange ? (
          <div className="space-y-2">
            <input
              value={draft.title}
              onChange={(event) => onChange({ title: event.target.value })}
              className="w-full rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-sm font-black text-white outline-none focus:border-[#FF4D00]/60"
            />
            <input
              value={draft.pillar}
              onChange={(event) => onChange({ pillar: event.target.value })}
              className="w-full rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-mono font-black uppercase tracking-[0.18em] text-[#FF4D00] outline-none focus:border-[#FF4D00]/60"
            />
          </div>
        ) : (
          <>
            <div className="whitespace-pre-wrap break-words text-sm font-black text-white">{draft.title}</div>
            <div className="mt-1 text-[10px] font-mono font-black uppercase tracking-[0.18em] text-[#FF4D00]">
              {draft.pillar}
            </div>
          </>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <select
          value={draft.status}
          onChange={(event) => onChange?.({ status: event.target.value as MoltbookPostDraft["status"] })}
          disabled={!onChange}
          className={`max-w-[96px] rounded-sm border bg-black/30 px-2 py-2 text-[8px] font-mono font-black uppercase tracking-[0.12em] outline-none ${
            draft.status === "planned"
              ? "border-[#FF4D00]/25 text-[#FF4D00]"
              : "border-white/10 text-zinc-300"
          }`}
        >
          <option value="ready">Ready</option>
          <option value="planned">Planned</option>
          <option value="posted">Posted</option>
          <option value="held">Held</option>
        </select>
        {onRemove && (
          <button
            onClick={onRemove}
            className="grid h-9 w-9 place-items-center rounded-sm border border-red-500/25 bg-red-500/10 text-red-300"
            title="Remove draft"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
    {onChange ? (
      <textarea
        value={draft.body}
        onChange={(event) => onChange({ body: event.target.value })}
        className="mt-3 min-h-24 w-full resize-y rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-xs leading-5 text-zinc-300 outline-none focus:border-[#FF4D00]/60"
      />
    ) : (
      <p className="mt-3 whitespace-pre-wrap break-words text-xs leading-5 text-zinc-400">{draft.body}</p>
    )}
    {draft.scheduledFor && (
      <div className="mt-3 text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-500">
        {new Date(draft.scheduledFor).toLocaleString()}
      </div>
    )}
  </div>
);

type NativeHttpJsonResponse = {
  ok: boolean;
  status?: number;
  body?: string;
  message?: string;
  url?: string;
};

type MoltbookStatusPayload = {
  status?: string;
  counters?: {
    total_actions?: number;
    total_interactions?: number;
    posts?: number;
    comments?: number;
    likes?: number;
    failed_actions?: number;
  };
  stats_today?: {
    total_actions?: number;
    posts?: number;
    comments?: number;
    likes?: number;
    failed?: number;
  };
  settings?: {
    provider_mode?: "groq" | "ollama";
    ollama_model?: string;
    ollama_base_url?: string;
    moltbook_mode?: "mock" | "real";
    moltbook_api_base_url?: string;
    moltbook_token_fingerprint?: string;
    moltbook_user_id?: string;
    moltbook_username?: string;
    daily_action_limit?: number;
  };
  keys?: {
    total?: number;
    active?: number;
    healthy?: number;
  };
  model?: {
    provider?: "groq" | "local" | "ollama";
    name?: string;
    localRequired?: boolean;
    apiKeysRequired?: boolean;
  };
  moltbook?: {
    mode?: "mock" | "real";
    connected?: boolean;
    username?: string;
  };
  queue?: {
    pending?: number;
    pending_approval_count?: number;
    queued?: number;
    executed?: number;
    failed?: number;
    total?: number;
    total_items?: number;
  };
  auth?: {
    configured?: boolean;
    valid?: boolean;
    statusCode?: number;
    agentName?: string;
    message?: string;
  };
  connection_status?: {
    pending_approval_count?: number;
    total_items?: number;
    stats_today?: {
      total_actions?: number;
      posts?: number;
      comments?: number;
      likes?: number;
      failed?: number;
    };
  };
  last_interaction?: {
    at?: string;
    summary?: string;
    type?: string;
  };
};

const normalizeEndpoint = (value: string) => value.trim().replace(/\/+$/g, "");
const MOLTBOOK_CHECK_TIMEOUT_MS = 2800;
const MOLTBOOK_POST_TIMEOUT_MS = 6500;
const getSavedMoltbookEndpoint = (value?: string) => normalizeEndpoint(value || MOLTBOOK_BRIDGE_URL);

const withMoltbookUiTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timer: number | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) window.clearTimeout(timer);
  }
};

const buildSavedLiveHealth = (
  endpoint: string,
  current: MoltbookConnectionHealth,
  message = "Live Moltbook route is saved. The last health probe was slow, so posting will retry through the saved bridge.",
): MoltbookConnectionHealth => ({
  ...current,
  status: "connected",
  message,
  checkedAt: new Date().toLocaleString(),
  endpoint: `${endpoint}/api/status`,
  serverMode: "live",
  modelProvider: "local",
  modelName: current.modelName || "Baloss LLM",
  modelReady: true,
});

const normalizeVisitorPage = (url: string) => {
  const value = url.trim();
  if (!value) return "https://moltbook.com";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
};

const getNativeBridge = () =>
  typeof window === "undefined"
    ? undefined
    : (
        window as Window & {
          PocketFlowReceiveBridge?: {
            httpJsonGet?: (url: string) => Promise<NativeHttpJsonResponse>;
            httpJsonPost?: (url: string, body: string, headersJson?: string) => Promise<NativeHttpJsonResponse>;
            openPocketBrowser?: (url: string) => Promise<{ ok?: boolean; message?: string }>;
            openExternalUrl?: (url: string) => Promise<{ ok?: boolean; message?: string }>;
          };
        }
      ).PocketFlowReceiveBridge;

const readJsonEndpoint = async (url: string): Promise<MoltbookStatusPayload> => {
  const bridge = getNativeBridge();
  if (bridge?.httpJsonGet) {
    const result = await withMoltbookUiTimeout(
      bridge.httpJsonGet(url),
      MOLTBOOK_CHECK_TIMEOUT_MS,
      "Moltbook native health check",
    );
    if (!result.ok) {
      throw new Error(result.message || `HTTP ${result.status || 0}`);
    }
    return JSON.parse(result.body || "{}") as MoltbookStatusPayload;
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), MOLTBOOK_CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
    return JSON.parse(text || "{}") as MoltbookStatusPayload;
  } finally {
    window.clearTimeout(timer);
  }
};

const postJsonEndpoint = async (url: string, body: unknown) => {
  const bridge = getNativeBridge();
  const encodedBody = JSON.stringify(body);
  if (bridge?.httpJsonPost) {
    const result = await withMoltbookUiTimeout(
      bridge.httpJsonPost(
        url,
        encodedBody,
        JSON.stringify({ "Content-Type": "application/json", Accept: "application/json" }),
      ),
      MOLTBOOK_POST_TIMEOUT_MS,
      "Moltbook native POST",
    );
    const parsed = result.body ? JSON.parse(result.body) : {};
    if (!result.ok) throw new Error(result.message || (parsed as { message?: string }).message || `HTTP ${result.status || 0}`);
    return parsed;
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), MOLTBOOK_POST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: encodedBody,
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
    return text ? JSON.parse(text) : {};
  } finally {
    window.clearTimeout(timer);
  }
};

const buildHealthFromPayload = (endpoint: string, payload: MoltbookStatusPayload): MoltbookConnectionHealth => {
  const settings = payload.settings || {};
  const keys = payload.keys || {};
  const model = payload.model || {};
  const moltbook = payload.moltbook || {};
  const queue: {
    pending?: number;
    pending_approval_count?: number;
    queued?: number;
    executed?: number;
    failed?: number;
    total?: number;
    total_items?: number;
  } = payload.queue || payload.connection_status || {};
  const stats = payload.stats_today || payload.connection_status?.stats_today || payload.counters || {};
  const hasToken = Boolean(settings.moltbook_token_fingerprint || settings.moltbook_user_id || settings.moltbook_username);
  const connected = Boolean(payload.status === "ok" || payload.auth?.valid || moltbook.connected);
  const mode = moltbook.mode || settings.moltbook_mode || (connected || hasToken ? "live" : "unknown");
  const modelProvider = model.provider === "groq" || settings.provider_mode === "groq" ? "groq" : "local";
  const modelName = model.name || settings.ollama_model || "Baloss LLM";
  const status =
    mode === "mock"
      ? "mock"
      : connected || hasToken
        ? "connected"
        : "error";
  const message =
    status === "mock"
      ? "Moltbook server is reachable, but it is in mock/sandbox mode. It will not post live."
      : status === "connected"
        ? `Moltbook is live and routed through ${modelProvider === "local" ? "the local Baloss LLM" : "Groq fallback"}. API keys are not required for the local route.`
        : "Moltbook server answered, but no live account token/user was reported.";

  return {
    status,
    message,
    checkedAt: new Date().toLocaleString(),
    endpoint,
    serverMode: mode,
    modelProvider,
    modelName,
    modelReady: modelProvider === "local" || Number(keys.healthy ?? 0) > 0,
    queuePending: Number(queue.pending ?? queue.pending_approval_count ?? queue.queued ?? 0),
    queueTotal: Number(queue.total ?? queue.total_items ?? 0)
      || Number(queue.queued ?? 0) + Number(queue.executed ?? 0) + Number(queue.failed ?? 0),
    healthyKeys: Number(keys.healthy ?? 0),
    keyTotal: Number(keys.total ?? 0),
    actionsToday: Number(stats.total_actions ?? 0),
    actionLimit: Number(settings.daily_action_limit ?? 20),
  };
};

const MoltbookAgentApp = ({ onNotify }: MoltbookAgentAppProps) => {
  const [state, setState] = useState<MoltbookMobileState>(() => loadMoltbookState());
  const [screenMode, setScreenMode] = useState<"backend" | "visitor">("backend");
  const [interestDraft, setInterestDraft] = useState("");
  const [avoidedDraft, setAvoidedDraft] = useState("");
  const [exampleDraft, setExampleDraft] = useState("");
  const [commentGuidelineDraft, setCommentGuidelineDraft] = useState("");
  const [planningWindowDraft, setPlanningWindowDraft] = useState("");
  const [commandDraft, setCommandDraft] = useState("");
  const [agentReply, setAgentReply] = useState(
    "Ready. Tell Moltbook what to post, when to post, how often, and how to answer comments.",
  );
  const [manualDraft, setManualDraft] = useState({
    title: "",
    pillar: "Manual",
    body: "",
  });
  const [checking, setChecking] = useState(false);
  const [autoCheckedConnection, setAutoCheckedConnection] = useState(false);

  const totalPosts = useMemo(
    () => state.schedule.reduce((total, slot) => total + Number(slot.posts || 0), 0),
    [state.schedule],
  );

  const blockedSummary = useMemo(() => MOLTBOOK_BLOCKED_TERMS.join(", "), []);
  const reserveStats = useMemo(() => getMoltbookReserveStats(state), [state]);
  const plannedDrafts = useMemo(
    () => state.postBacklog.filter((draft) => draft.status === "planned"),
    [state.postBacklog],
  );
  const readyDrafts = useMemo(
    () => state.postBacklog.filter((draft) => draft.status === "ready"),
    [state.postBacklog],
  );
  const nextPlannedDraft = useMemo(
    () =>
      state.postBacklog
        .filter((draft) => draft.status === "planned")
        .sort((a, b) => Date.parse(a.scheduledFor || "") - Date.parse(b.scheduledFor || ""))[0],
    [state.postBacklog],
  );
  const lastInteractionSummary = state.interaction.lastSummary?.trim()
    || (state.interaction.lastCheckedAt && state.interaction.lastCheckedAt !== "Not synced"
      ? "Moltbook activity was checked from the phone. Open Interactions for the full editable dashboard."
      : "Not synced yet. Run Check Moltbook Connection when the live endpoint is ready.");
  const visitorPage = useMemo(() => {
    if (state.visitorPageUrl?.trim()) return normalizeVisitorPage(state.visitorPageUrl);
    return MOLTBOOK_ACCOUNT_VISITOR_URL;
  }, [state.username, state.visitorPageUrl]);

  const updateState = (patch: Partial<MoltbookMobileState>) => {
    setState((current) => {
      const next = { ...current, ...patch };
      saveMoltbookState(next);
      return next;
    });
  };

  useEffect(() => {
    const syncMoltbookState = (event: Event) => {
      const detail = (event as CustomEvent<MoltbookMobileState>).detail;
      setState(detail || loadMoltbookState());
    };
    window.addEventListener("pocketflow:moltbook-updated", syncMoltbookState as EventListener);
    return () => window.removeEventListener("pocketflow:moltbook-updated", syncMoltbookState as EventListener);
  }, []);

  const updateScheduleSlot = (slotId: string, patch: Partial<MoltbookScheduleSlot>) => {
    const nextSchedule = state.schedule.map((slot) => (slot.id === slotId ? { ...slot, ...patch } : slot));
    updateState({ schedule: nextSchedule });
  };

  const updateSchedule = (slotId: string, posts: number) => {
    updateScheduleSlot(slotId, { posts: Math.max(0, Math.min(12, posts)) });
  };

  const addScheduleSlot = () => {
    updateState({
      schedule: [
        ...state.schedule,
        {
          id: `custom-${Date.now()}`,
          label: "Custom",
          window: "09:00 - 10:00",
          posts: 1,
        },
      ],
    });
  };

  const removeScheduleSlot = (slotId: string) => {
    updateState({ schedule: state.schedule.filter((slot) => slot.id !== slotId) });
  };

  const addInterest = () => {
    const value = interestDraft.trim();
    if (!value) return;
    const lower = value.toLowerCase();
    if (isMoltbookBlockedTopic(lower)) {
      onNotify("Blocked: Moltbook is restricted to AI and machine-learning topics.", "error");
      return;
    }
    updateState({ interests: [...state.interests, value] });
    setInterestDraft("");
  };

  const addExample = () => {
    const value = exampleDraft.trim();
    if (!value) return;
    const lower = value.toLowerCase();
    if (isMoltbookBlockedTopic(lower)) {
      onNotify("Example rejected because it contains a blocked trading/coin topic.", "error");
      return;
    }
    updateState({ examples: [...state.examples, value] });
    setExampleDraft("");
  };

  const addCommentGuideline = () => {
    const value = commentGuidelineDraft.trim();
    if (!value) return;
    updateState({
      commentGuidelines: [
        value,
        ...state.commentGuidelines.filter((item) => item.toLowerCase() !== value.toLowerCase()),
      ].slice(0, 12),
    });
    setCommentGuidelineDraft("");
  };

  const addAvoidedTopic = () => {
    const value = avoidedDraft.trim();
    if (!value) return;
    updateState({ avoidedTopics: Array.from(new Set([...state.avoidedTopics, value])) });
    setAvoidedDraft("");
  };

  const addPlanningWindow = () => {
    const value = planningWindowDraft.trim();
    if (!value) return;
    updateState({
      planning: {
        ...state.planning,
        planningWindows: [...state.planning.planningWindows, value],
      },
    });
    setPlanningWindowDraft("");
  };

  const updatePostDraft = (draftId: string, patch: Partial<MoltbookPostDraft>) => {
    updateState({
      postBacklog: state.postBacklog.map((draft) => (draft.id === draftId ? { ...draft, ...patch } : draft)),
    });
  };

  const removePostDraft = (draftId: string) => {
    updateState({ postBacklog: state.postBacklog.filter((draft) => draft.id !== draftId) });
  };

  const addManualPostDraft = () => {
    const title = manualDraft.title.trim();
    const body = manualDraft.body.trim();
    const pillar = manualDraft.pillar.trim() || "Manual";
    if (!title || !body) {
      onNotify("Manual draft needs a title and body.", "error");
      return;
    }
    if (isMoltbookBlockedTopic(`${title} ${body} ${pillar}`)) {
      onNotify("Manual draft rejected because it contains a blocked trading/coin topic.", "error");
      return;
    }
    const now = new Date();
    updateState({
      postBacklog: [
        {
          id: `manual-${now.getTime()}`,
          title,
          body,
          pillar,
          status: "ready",
          source: "manual",
          createdAt: now.toISOString(),
        },
        ...state.postBacklog,
      ],
    });
    setManualDraft({ title: "", pillar: "Manual", body: "" });
  };

  const syncMoltbookSettingsToBridge = async (nextState: MoltbookMobileState) => {
    if (nextState.connectionMode !== "live") return;
    const endpoint = normalizeEndpoint(nextState.apiBaseUrl);
    if (!endpoint) return;
    await postJsonEndpoint(`${endpoint}/api/settings`, {
      moltbook_mode: "real",
      provider_mode: "ollama",
      ollama_model: "baloss-llm",
      daily_post_limit: moltbookDailyPostTarget(nextState),
      daily_comment_limit: Math.max(20, Math.round(nextState.dailyCommentGoal || 0)),
      daily_like_limit: 0,
      daily_research_limit: Math.max(3, Math.round(nextState.dailyLearningGoal || 0)),
      daily_ai_news_posts: 3,
      patrol_interval_minutes: 20,
      server_queue_soft_limit: 36,
      interaction_mode: "all_day_patrol",
      comment_distribution: "spread across the day, check replies first, then AI builder conversations; never dump all comments in one burst",
      posting_distribution: "spread posts across morning, day, evening and late night; rotate AI news, model releases, robotics, open-source tools, product design, research, automation, privacy and developer workflows; keep PocketFlow/build-diary posts occasional, never a repeated block",
      interests: nextState.interests.join("\n"),
      tone: [
        "human, analytical, curious, reflective, casual when natural, specific, trustworthy, low-hype",
        "broad AI/technology commentary first; PocketFlow only as an occasional concrete build example",
      ].join("\n"),
      comment_guidelines: nextState.commentGuidelines.join("\n"),
      news_digest: nextState.newsDigest,
      autonomous_mode_enabled: nextState.mode !== "paused",
      agent_mode: nextState.mode === "approval" ? "approval" : "autonomous",
      human_approval_required: nextState.mode === "approval",
      auto_execute_approved: nextState.mode !== "approval",
      minimum_delay_minutes: nextState.planning.lowLoadMode ? 150 : 45,
      random_delay_min_minutes: nextState.planning.lowLoadMode ? 45 : 10,
      random_delay_max_minutes: nextState.planning.lowLoadMode ? 180 : 40,
    });
  };

  const addCommandLogEntry = async () => {
    const value = commandDraft.trim();
    if (!value) return;
    const instruction: MoltbookInstruction =
      parseMoltbookInstruction(value) || { type: "general_guidance", guidance: value };
    const result = applyMoltbookInstruction(instruction, state);
    setState(result.state);
    setCommandDraft("");
    setAgentReply(result.response);
    try {
      await syncMoltbookSettingsToBridge(result.state);
      if (instruction.type === "publish_now") {
        setAgentReply("Publishing now. Waiting for Moltbook live bridge confirmation...");
        const publishResult = await publishMoltbookNow({
          instruction,
          state: result.state,
          reason: "pocketflow-moltbook-chat-command",
        });
        setState(publishResult.state);
        setAgentReply(publishResult.message);
        onNotify(publishResult.message, publishResult.ok ? "success" : "error");
        return;
      }
      onNotify(result.response, result.ok ? "success" : "error");
    } catch (error) {
      const message = error instanceof Error ? error.message : "bridge sync failed";
      setAgentReply(`${result.response} Bridge sync still needs attention: ${message}`);
      onNotify("Instruction saved locally. Live bridge sync failed.", "error");
    }
  };

  const saveAll = () => {
    saveMoltbookState(state);
    onNotify("Moltbook mobile control saved on this phone.", "success");
  };

  const prepareReserve = () => {
    const result = prepareMoltbookTwoDayReserve(state);
    setState(result.state);
    onNotify(`Moltbook prepared ${result.assigned} backup posts with minimum model effort.`, "success");
  };

  const restoreStarterBacklog = () => {
    const postBacklog = createMoltbookStarterBacklog(100);
    updateState({
      postBacklog,
      planning: {
        ...state.planning,
        lowLoadMode: true,
        modelEffort: "minimum",
        lastPreparedAt: "Starter queue restored",
        nextPlanningAt: "05:00",
      },
      commandLog: [`${new Date().toLocaleString()}: restored 100 Moltbook starter drafts.`, ...state.commandLog].slice(0, 30),
    });
    onNotify("Moltbook starter queue restored: 100 low-load drafts ready.", "success");
  };

  useEffect(() => {
    setState((current) => {
      const stats = getMoltbookReserveStats(current);
      const nextWindowTime = Date.parse(current.planning.nextPlanningAt);
      const planningDue = Number.isFinite(nextWindowTime) && nextWindowTime <= Date.now();
      if (!current.planning.lowLoadMode || (!stats.missing && !planningDue)) return current;
      const result = prepareMoltbookTwoDayReserve(current);
      return result.state;
    });
  }, []);

  const simulateRefresh = () => {
    updateState({
      interaction: {
        ...state.interaction,
        lastCheckedAt: new Date().toLocaleString(),
      },
    });
    onNotify("Moltbook stats refreshed locally. Live account sync needs the server token/bridge.", "info");
  };

  const openVisitorPage = async () => {
    const bridge = getNativeBridge();
    try {
      if (bridge?.openPocketBrowser) {
        const result = await bridge.openPocketBrowser(visitorPage);
        if (result?.ok === false) throw new Error(result.message || "Pocket browser did not open.");
        onNotify("Opening Moltbook public profile in PocketWeb.", "success");
        return;
      }
      if (bridge?.openExternalUrl) {
        const result = await bridge.openExternalUrl(visitorPage);
        if (result?.ok === false) throw new Error(result.message || "External browser did not open.");
        onNotify("Opening Moltbook public profile.", "success");
        return;
      }
      window.open(visitorPage, "_blank", "noopener,noreferrer");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "Could not open Moltbook profile.", "error");
    }
  };

  const queuePhoneTestDrafts = () => {
    const now = new Date();
    const createdAt = now.toISOString();
    const phoneTestDrafts: MoltbookPostDraft[] = [1, 2, 3].map((number) => ({
      id: `phone-test-${now.getTime()}-${number}`,
      title: `Phone connector test ${number}`,
      pillar: "Phone Migration",
      body:
        "PocketFlow phone connector test. This draft verifies the mobile Moltbook queue path and must stay held until the live Moltbook API endpoint and token are connected.",
      status: "held",
      source: "manual",
      createdAt,
    }));
    updateState({
      postBacklog: [...phoneTestDrafts, ...state.postBacklog].slice(0, 140),
      commandLog: [
        `${now.toLocaleString()}: queued 3 held phone connector test drafts; live publishing blocked until endpoint/token are connected.`,
        ...state.commandLog,
      ].slice(0, 80),
    });
    onNotify("Queued 3 phone test drafts locally. Live posting needs the Moltbook endpoint/token first.", "info");
  };

  const runPostTest = async () => {
    setAgentReply("Publishing the next Moltbook draft now...");
    const liveState = {
      ...state,
      apiBaseUrl: getSavedMoltbookEndpoint(state.apiBaseUrl),
      connectionMode: "live" as const,
      connectionHealth: buildSavedLiveHealth(getSavedMoltbookEndpoint(state.apiBaseUrl), state.connectionHealth),
    };
    setState(liveState);
    try {
      await syncMoltbookSettingsToBridge(liveState);
    } catch {
      // The publish call below will report the real bridge error if the endpoint is unreachable.
    }
    const result = await publishMoltbookNow({ state: liveState, reason: "pocketflow-moltbook-post-button" });
    setState(result.state);
    setAgentReply(result.message);
    onNotify(result.message, result.ok ? "success" : "error");
  };

  const checkConnection = async () => {
    if (checking) return;
    const endpoint = getSavedMoltbookEndpoint(state.apiBaseUrl);
    if (!endpoint) {
      return;
    }

    setChecking(true);
    try {
      const url = `${endpoint}/api/status`;
      const payload = await readJsonEndpoint(url);
      const connectionHealth = buildHealthFromPayload(url, payload);
      const settings = payload.settings || {};
      const stats = payload.stats_today || payload.connection_status?.stats_today || payload.counters || {};
      const lastInteraction = payload.last_interaction;
      const totalInteractions = Number(
        payload.counters?.total_interactions
          ?? payload.counters?.total_actions
          ?? state.interaction.totalInteractions
          ?? 0,
      );
      updateState({
        connectionHealth,
        connectionMode: "live",
        apiBaseUrl: endpoint,
        username: payload.moltbook?.username || settings.moltbook_username || state.username,
        userId: settings.moltbook_user_id || state.userId,
        tokenFingerprint: settings.moltbook_token_fingerprint || state.tokenFingerprint,
        interaction: {
          ...state.interaction,
          totalInteractions,
          postsToday: Number(stats.posts ?? state.interaction.postsToday),
          commentsToday: Number(stats.comments ?? state.interaction.commentsToday),
          likesToday: Number(stats.likes ?? state.interaction.likesToday),
          lastCheckedAt: lastInteraction?.at
            ? new Date(lastInteraction.at).toLocaleString()
            : new Date().toLocaleString(),
          lastSummary: lastInteraction?.summary
            || (totalInteractions
              ? `Live sync found ${totalInteractions.toLocaleString()} total Moltbook interactions.`
              : state.interaction.lastSummary),
        },
      });
      onNotify(
        connectionHealth.status === "connected"
          ? "Moltbook live connection verified."
          : connectionHealth.message,
        connectionHealth.status === "error" ? "error" : "success",
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Moltbook endpoint did not answer quickly.";
      const connectionHealth = buildSavedLiveHealth(
        endpoint,
        state.connectionHealth,
        `Live route saved. Health probe was slow or unavailable (${detail}); posting will retry through the bridge.`,
      );
      updateState({ connectionHealth, connectionMode: "live", apiBaseUrl: endpoint });
      onNotify("Moltbook route kept live; health probe will retry in the background.", "info");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (autoCheckedConnection || state.connectionMode !== "live" || checking) return;
    setAutoCheckedConnection(true);
    const timer = window.setTimeout(() => {
      void checkConnection();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [autoCheckedConnection, checking, state.apiBaseUrl, state.connectionMode]);

  const healthTone =
    state.connectionHealth.status === "connected"
      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
      : state.connectionHealth.status === "mock"
        ? "border-[#FF4D00]/35 bg-[#FF4D00]/10 text-[#FF4D00]"
        : "border-red-500/35 bg-red-500/10 text-red-300";

  const dashboardCards = [
    ["Interactions", state.interaction.totalInteractions ? state.interaction.totalInteractions.toLocaleString() : "Not synced"],
    ["Followers", state.interaction.followers ? state.interaction.followers.toLocaleString() : "0"],
    ["Today", `${state.interaction.postsToday}p / ${state.interaction.commentsToday}c`],
    ["Mode", state.mode],
  ];

  if (screenMode === "visitor") {
    return (
      <div className="pocketflow-screen-scroll flex-1 min-h-0 bg-[#050505] text-zinc-100 px-4 py-5 space-y-4">
        <header className="relative overflow-hidden rounded-sm border border-white/10 bg-[#0E0E0E] p-4 shadow-sm">
          <div className="absolute left-0 top-0 h-full w-[3px] bg-[#FF4D00]" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-mono font-black uppercase tracking-[0.3em] text-[#FF4D00]">
                02 / visitor activity
              </div>
              <h1 className="mt-1 truncate font-serif text-3xl font-black italic tracking-tight text-white">
                Moltbook
              </h1>
              <p className="mt-1 truncate text-[10px] font-mono font-black uppercase tracking-[0.22em] text-zinc-500">
                {visitorPage.replace(/^https?:\/\//i, "")}
              </p>
            </div>
            <button
              onClick={() => setScreenMode("backend")}
              className="flex h-12 shrink-0 items-center gap-2 rounded-sm border border-[#FF4D00]/35 bg-[#FF4D00]/10 px-4 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-[#FF4D00]"
            >
              <Settings2 className="h-4 w-4" />
              App
            </button>
          </div>
        </header>

        <section className="overflow-hidden rounded-sm border border-white/10 bg-[#0E0E0E]">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2 text-[10px] font-mono font-black uppercase tracking-[0.2em] text-zinc-500">
                  <Eye className="h-4 w-4 text-[#FF4D00]" />
                  <span className="truncate">live public profile</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-zinc-300">
                  Moltbook blocks embedded frames, so PocketFlow opens the real public page directly and keeps this return panel ready.
                </p>
              </div>
              <button
                onClick={openVisitorPage}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-sm border border-[#FF4D00]/35 bg-[#FF4D00]/10 text-[#FF4D00]"
                title="Open Moltbook profile"
              >
                <ExternalLink className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Profile", "agentmoltbook"],
                ["Followers", "117"],
                ["Posts", "20"],
                ["Comments", "50"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-sm border border-white/10 bg-black/30 p-4">
                  <div className="text-[10px] font-mono font-black uppercase tracking-[0.22em] text-zinc-500">{label}</div>
                  <div className="mt-2 truncate text-xl font-black text-white">{value}</div>
                </div>
              ))}
            </div>
            <div className="rounded-sm border border-emerald-500/20 bg-emerald-500/8 p-4">
              <div className="flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-[0.22em] text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                public activity verified
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-300">
                The public account was reachable as Balossbuddybot / @agentmoltbook. Recent public comments were visible, while the phone-side
                posting API is still not connected locally.
              </p>
            </div>
            <button
              onClick={openVisitorPage}
              className="flex w-full items-center justify-center gap-3 rounded-sm bg-[#FF4D00] px-5 py-4 font-mono text-[11px] font-black uppercase tracking-[0.22em] text-black"
            >
              <ExternalLink className="h-5 w-5" />
              Open Moltbook Page
            </button>
          </div>
        </section>

        <div className="rounded-sm border border-white/10 bg-black/25 p-4 text-xs leading-5 text-zinc-400">
          Use App to return to the mobile control panel after checking the public page.
        </div>
      </div>
    );
  }

  return (
    <div className="pocketflow-screen-scroll flex-1 min-h-0 bg-[#050505] text-zinc-100 px-3 py-4 pb-6 space-y-3">
      <header className="relative overflow-hidden rounded-sm border border-white/10 bg-[#0E0E0E] p-4 shadow-sm">
        <div className="absolute left-0 top-0 h-full w-[3px] bg-[#FF4D00]" />
        <div className="pointer-events-none absolute right-[-70px] top-[-90px] h-56 w-56 rounded-full border border-[#FF4D00]/10" />
        <div className="pointer-events-none absolute right-8 top-8 h-16 w-16 rounded-full border border-emerald-500/10" />
        <div className="space-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-sm border border-[#FF4D00]/35 bg-[#FF4D00]/10 text-[#FF4D00]">
              <Bot className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[9px] font-mono font-black uppercase tracking-[0.22em] text-zinc-500">
                01 / mobile control panel
              </div>
              <h1 className="mt-1 font-serif text-3xl font-black italic tracking-tight text-white">Moltbook</h1>
              <p className="mt-1 truncate text-[10px] font-mono font-black uppercase tracking-[0.2em] text-zinc-500">
                ai posting agent
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              onClick={() => setScreenMode("visitor")}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-sm border border-[#FF4D00]/35 bg-[#FF4D00]/10 px-2 py-2 text-[9px] font-mono font-black uppercase tracking-[0.14em] text-[#FF4D00]"
            >
              <Eye className="h-4 w-4" />
              Site
            </button>
            <button
              onClick={queuePhoneTestDrafts}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-2 py-2 text-[9px] font-mono font-black uppercase tracking-[0.14em] text-emerald-300"
            >
              <Plus className="h-4 w-4" />
              Test
            </button>
            <button
              onClick={runPostTest}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-sm border border-sky-400/35 bg-sky-400/10 px-2 py-2 text-[9px] font-mono font-black uppercase tracking-[0.14em] text-sky-200"
            >
              <Send className="h-4 w-4" />
              Post
            </button>
            <div className={`flex min-h-11 items-center justify-center rounded-sm border px-2 py-2 text-center text-[8px] font-mono font-black uppercase tracking-[0.12em] ${healthTone}`}>
              {state.connectionMode === "live" ? "live armed" : state.connectionHealth.status}
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-mono font-black uppercase tracking-[0.24em] text-emerald-300">
              Moltbook command chat
            </div>
            <h2 className="mt-1 text-lg font-black text-white">Tell the agent what to do</h2>
            <p className="mt-2 text-xs leading-5 text-zinc-400">
              Examples: post 3 times a day about local AI, answer comments briefly, stop posting about crypto, prepare reserve queue.
            </p>
          </div>
          <span className="shrink-0 rounded-sm border border-emerald-400/25 bg-black/30 px-3 py-2 text-[9px] font-mono font-black uppercase tracking-[0.14em] text-emerald-200">
            Baloss LLM
          </span>
        </div>
        <textarea
          value={commandDraft}
          onChange={(event) => setCommandDraft(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void addCommandLogEntry();
            }
          }}
          placeholder="Give Moltbook a natural instruction..."
          className="mt-4 min-h-28 w-full resize-y rounded-sm border border-white/10 bg-black/40 px-4 py-3 text-sm leading-6 text-zinc-100 outline-none focus:border-emerald-400/60"
        />
        <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
          <button
            onClick={() => void addCommandLogEntry()}
            className="flex min-h-12 items-center justify-center gap-2 rounded-sm bg-emerald-500 px-4 py-3 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-black"
          >
            <Send className="h-4 w-4" />
            Apply
          </button>
          <button
            onClick={() => {
              setCommandDraft("Moltbook: low load mode, prepare enough reserve posts for two days, no hurry.");
            }}
            className="rounded-sm border border-white/10 bg-black/25 px-4 py-3 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300"
          >
            Low load
          </button>
          <button
            onClick={() => {
              setCommandDraft("Moltbook: answer comments in a short, clear, friendly technical voice. Never expose private data.");
            }}
            className="rounded-sm border border-white/10 bg-black/25 px-4 py-3 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-zinc-300"
          >
            Comment voice
          </button>
        </div>
        <div className="mt-3 rounded-sm border border-white/10 bg-black/25 p-3 text-sm leading-6 text-zinc-200">
          <span className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">Agent</span>
          <p className="mt-1">{agentReply}</p>
        </div>
      </section>

      <section className="rounded-sm border border-white/10 bg-[#101010] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-mono font-black uppercase tracking-[0.24em] text-[#FF4D00]">
              dashboard
            </div>
            <h2 className="mt-1 text-lg font-black text-white">Moltbook status</h2>
          </div>
          <button
            onClick={saveAll}
            className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-sm bg-[#FF4D00] px-4 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-black"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {dashboardCards.map(([label, value]) => (
            <div key={label} className="rounded-sm border border-white/10 bg-black/25 p-3">
              <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">{label}</div>
              <div className="mt-1 truncate text-lg font-black text-white">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-sm border border-[#FF4D00]/25 bg-[#FF4D00]/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-mono font-black uppercase tracking-[0.24em] text-[#FF4D00]">
              planned
            </div>
            <h2 className="mt-1 text-xl font-black text-white">
              {reserveStats.planned}/{reserveStats.reserveTarget} queued
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">
              {nextPlannedDraft
                ? `${nextPlannedDraft.title}${nextPlannedDraft.scheduledFor ? ` • ${new Date(nextPlannedDraft.scheduledFor).toLocaleString()}` : ""}`
                : "No scheduled draft yet. Open Reserve Queue to prepare the next two days."}
            </p>
          </div>
          <span className="shrink-0 rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-mono font-black uppercase tracking-[0.16em] text-white">
            {totalPosts}/day
          </span>
        </div>
      </section>

      <section className="rounded-sm border border-white/10 bg-[#0E0E0E] p-4">
        <div className="text-[10px] font-mono font-black uppercase tracking-[0.24em] text-zinc-500">
          last interaction
        </div>
        <div className="mt-2 text-base font-black text-white">{state.interaction.lastCheckedAt}</div>
        <p className="mt-2 text-sm leading-6 text-zinc-400">{lastInteractionSummary}</p>
      </section>

      <Section title="Connection" subtitle="Account visibility, no secrets printed." defaultOpen={false}>
        <div className="grid grid-cols-1 gap-3">
          <div className="grid grid-cols-2 gap-2">
            <PillButton active={state.connectionMode === "mock"} onClick={() => updateState({ connectionMode: "mock" })}>
              Mock
            </PillButton>
            <PillButton active={state.connectionMode === "live"} onClick={() => updateState({ connectionMode: "live" })}>
              Live
            </PillButton>
          </div>
          <Field label="Username / handle" value={state.username} onChange={(username) => updateState({ username })} placeholder="Not connected" />
          <Field label="User id" value={state.userId} onChange={(userId) => updateState({ userId })} placeholder="Not connected" />
          <Field label="API base URL" value={state.apiBaseUrl} onChange={(apiBaseUrl) => updateState({ apiBaseUrl })} placeholder="Moltbook endpoint" />
          <Field
            label="Visitor page URL"
            value={state.visitorPageUrl}
            onChange={(visitorPageUrl) => updateState({ visitorPageUrl })}
            placeholder="https://moltbook.com/your-profile"
          />
          <Field
            label="Token fingerprint"
            value={state.tokenFingerprint}
            onChange={(tokenFingerprint) => updateState({ tokenFingerprint })}
            placeholder="Only fingerprint, never the token"
          />
          <button
            onClick={checkConnection}
            disabled={checking}
            className="flex w-full items-center justify-center gap-2 rounded-sm border border-[#FF4D00]/30 bg-[#FF4D00]/10 px-4 py-4 font-mono text-xs font-black uppercase tracking-[0.2em] text-[#FF4D00] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            Check Moltbook Connection
          </button>
          <div className={`rounded-sm border p-4 text-sm leading-6 ${healthTone}`}>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-[0.22em]">
              {state.connectionHealth.status === "connected" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              Connection health
            </div>
            <p className="text-zinc-100">{state.connectionHealth.message}</p>
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-zinc-300 sm:grid-cols-2">
              <div className="rounded-sm bg-black/25 p-3">
                <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">Mode</div>
                <div className="mt-1 font-black">{state.connectionHealth.serverMode}</div>
              </div>
              <div className="rounded-sm bg-black/25 p-3">
                <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">Checked</div>
                <div className="mt-1 font-black">{state.connectionHealth.checkedAt}</div>
              </div>
              <div className="rounded-sm bg-black/25 p-3">
                <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">Queue</div>
                <div className="mt-1 font-black">
                  {state.connectionHealth.queuePending}/{state.connectionHealth.queueTotal}
                </div>
              </div>
              <div className="rounded-sm bg-black/25 p-3">
                <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-500">Model</div>
                <div className="mt-1 font-black">
                  {state.connectionHealth.modelProvider === "local" ? "local" : state.connectionHealth.modelProvider}
                </div>
                <div className="mt-1 truncate text-[11px] font-mono text-zinc-400">
                  {state.connectionHealth.modelName}
                </div>
              </div>
            </div>
            {state.connectionHealth.endpoint && (
              <div className="mt-3 flex items-start gap-2 rounded-sm bg-black/25 p-3 text-xs text-zinc-300">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-all">{state.connectionHealth.endpoint}</span>
              </div>
            )}
          </div>
          <div className="rounded-sm border border-white/10 bg-black/25 p-4 text-sm leading-6 text-zinc-400">
            Imported identity: <b className="text-white">{MOLTBOOK_ACCOUNT_DISPLAY_NAME}</b>{" "}
            <b className="text-[#FF4D00]">{state.username || "@BalossBuddyBot"}</b>. Contact email known as{" "}
            <b className="text-white">{MOLTBOOK_ACCOUNT_CONTACT_EMAIL}</b>. Live mode uses the phone-stored Tailscale bridge and local Baloss LLM route; no Groq key pool is required for Moltbook posting. If the bridge is offline, drafts queue and retry.
          </div>
        </div>
      </Section>

      <Section title="Reserve Queue" subtitle="Low-load planning before the day starts." defaultOpen={false}>
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-sm border border-[#FF4D00]/25 bg-[#FF4D00]/10 p-4">
            <div className="absolute right-[-24px] top-[-50px] h-32 w-32 rounded-full border border-[#FF4D00]/15" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[10px] font-mono font-black uppercase tracking-[0.24em] text-emerald-300">
                  02 / low load mode
                </div>
                <h3 className="mt-2 text-2xl font-black">
                  {reserveStats.planned}/{reserveStats.reserveTarget} planned
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  Moltbook keeps at least two days of backup posts ready, then schedules them slowly at night and 05:00 so the model does not rush or overload the phone.
                </p>
              </div>
              <span className="rounded-sm border border-emerald-400/30 bg-black/30 px-3 py-2 text-[10px] font-mono font-black uppercase tracking-[0.18em] text-emerald-200">
                {state.planning.modelEffort}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 min-[430px]:grid-cols-4">
              {[
                ["Ready", reserveStats.ready],
                ["Held", reserveStats.held],
                ["Posted", reserveStats.posted],
                ["Total", reserveStats.total],
              ].map(([label, value]) => (
                <div key={label} className="rounded-sm border border-white/10 bg-black/25 p-3 text-center">
                  <div className="text-[9px] font-mono uppercase tracking-[0.18em] text-zinc-500">{label}</div>
                  <div className="mt-1 text-lg font-black">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={prepareReserve}
              className="flex min-h-14 items-center justify-center rounded-sm bg-[#FF4D00] px-4 py-3 text-center font-mono text-[10px] font-black uppercase tracking-[0.16em] text-black"
            >
              Prepare 2-day reserve
            </button>
            <button
              onClick={restoreStarterBacklog}
              className="flex min-h-14 items-center justify-center rounded-sm border border-white/10 bg-white/[0.03] px-4 py-3 text-center font-mono text-[10px] font-black uppercase tracking-[0.16em] text-zinc-200"
            >
              Restore 100 starter drafts
            </button>
          </div>

          <div className="rounded-sm border border-white/10 bg-black/25 p-4">
            <div className="text-[10px] font-mono font-black uppercase tracking-[0.22em] text-zinc-500">
              Planning windows
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {state.planning.planningWindows.map((windowLabel, index) => (
                <button
                  key={`${windowLabel}-${index}`}
                  onClick={() =>
                    updateState({
                      planning: {
                        ...state.planning,
                        planningWindows: state.planning.planningWindows.filter((_, itemIndex) => itemIndex !== index),
                      },
                    })
                  }
                  className="rounded-sm border border-[#FF4D00]/20 bg-[#FF4D00]/10 px-3 py-2 text-left text-xs font-bold text-[#FF4D00]"
                  title="Tap to remove planning window"
                >
                  {windowLabel}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={planningWindowDraft}
                onChange={(event) => setPlanningWindowDraft(event.target.value)}
                placeholder="Add planning window"
                className="min-w-0 flex-1 rounded-sm border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold outline-none focus:border-[#FF4D00]/50"
              />
              <button onClick={addPlanningWindow} className="grid h-12 w-14 place-items-center rounded-sm bg-[#FF4D00] text-black">
                <Plus className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-zinc-300">
              <div className="grid grid-cols-1 gap-2">
                <PillButton
                  active={state.planning.lowLoadMode}
                  onClick={() =>
                    updateState({
                      planning: { ...state.planning, lowLoadMode: !state.planning.lowLoadMode },
                    })
                  }
                >
                  Low Load {state.planning.lowLoadMode ? "On" : "Off"}
                </PillButton>
                <label className="block">
                  <span className="mb-2 block text-[10px] font-mono font-black uppercase tracking-[0.24em] text-zinc-500">
                    Model effort
                  </span>
                  <select
                    value={state.planning.modelEffort}
                    onChange={(event) =>
                      updateState({
                        planning: {
                          ...state.planning,
                          modelEffort: event.target.value as MoltbookMobileState["planning"]["modelEffort"],
                        },
                      })
                    }
                    className="w-full rounded-sm border border-white/10 bg-[#080808] px-4 py-3 text-sm font-semibold text-zinc-100 outline-none transition focus:border-[#FF4D00]/60"
                  >
                    <option value="minimum">Minimum</option>
                    <option value="balanced">Balanced</option>
                    <option value="deep">Deep</option>
                  </select>
                </label>
              </div>
              <Field
                label="Reserve days"
                value={String(state.planning.reserveDays)}
                onChange={(value) =>
                  updateState({ planning: { ...state.planning, reserveDays: Math.max(1, Math.min(7, Number(value) || 1)) } })
                }
              />
              <Field
                label="Batch size"
                value={String(state.planning.batchSize)}
                onChange={(value) =>
                  updateState({ planning: { ...state.planning, batchSize: Math.max(1, Math.min(96, Number(value) || 1)) } })
                }
              />
              <Field
                label="Max model bursts"
                value={String(state.planning.maxModelBurstsPerDay)}
                onChange={(value) =>
                  updateState({
                    planning: {
                      ...state.planning,
                      maxModelBurstsPerDay: Math.max(0, Math.min(12, Number(value) || 0)),
                    },
                  })
                }
              />
              <Field
                label="Last prepared"
                value={state.planning.lastPreparedAt}
                onChange={(lastPreparedAt) => updateState({ planning: { ...state.planning, lastPreparedAt } })}
              />
              <Field
                label="Next planning"
                value={state.planning.nextPlanningAt}
                onChange={(nextPlanningAt) => updateState({ planning: { ...state.planning, nextPlanningAt } })}
              />
            </div>
          </div>

          <div>
            <div className="mb-3 text-[10px] font-mono font-black uppercase tracking-[0.22em] text-[#7f92b2]">
              planned queue
            </div>
            <div className="space-y-2">
              {plannedDrafts.length ? (
                plannedDrafts.map((draft) => (
                  <DraftPreviewCard
                    key={draft.id}
                    draft={draft}
                    onChange={(patch) => updatePostDraft(draft.id, patch)}
                    onRemove={() => removePostDraft(draft.id)}
                  />
                ))
              ) : (
                <div className="rounded-sm border border-dashed border-white/10 p-4 text-sm text-zinc-500">
                  No planned drafts yet. Tap prepare to fill the reserve.
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-3 text-[10px] font-mono font-black uppercase tracking-[0.22em] text-[#7f92b2]">
              ready backups
            </div>
            <div className="space-y-2">
              {readyDrafts.map((draft) => (
                <DraftPreviewCard
                  key={draft.id}
                  draft={draft}
                  onChange={(patch) => updatePostDraft(draft.id, patch)}
                  onRemove={() => removePostDraft(draft.id)}
                />
              ))}
            </div>
          </div>

          <div className="rounded-sm border border-white/10 bg-black/25 p-4">
            <div className="text-[10px] font-mono font-black uppercase tracking-[0.22em] text-zinc-500">
              add manual draft
            </div>
            <div className="mt-3 grid gap-3">
              <Field
                label="Title"
                value={manualDraft.title}
                onChange={(title) => setManualDraft((current) => ({ ...current, title }))}
                placeholder="Manual post title"
              />
              <Field
                label="Pillar"
                value={manualDraft.pillar}
                onChange={(pillar) => setManualDraft((current) => ({ ...current, pillar }))}
                placeholder="AI development"
              />
              <TextAreaField
                label="Body"
                value={manualDraft.body}
                onChange={(body) => setManualDraft((current) => ({ ...current, body }))}
                placeholder="Write the post draft by hand..."
              />
              <button
                onClick={addManualPostDraft}
                className="w-full rounded-sm bg-[#FF4D00] px-4 py-4 font-mono text-xs font-black uppercase tracking-[0.22em] text-black"
              >
                Add Manual Draft
              </button>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Posting Plan" subtitle="Simple day plan: 3 posts in each time window." defaultOpen={false}>
        <div className="space-y-3">
          {state.schedule.map((slot) => (
          <div key={slot.id} className="rounded-sm border border-white/10 bg-black/25 p-3">
              <div className="grid gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    value={slot.label}
                    onChange={(event) => updateScheduleSlot(slot.id, { label: event.target.value })}
                    className="w-full rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-base font-black text-white outline-none focus:border-[#FF4D00]/60"
                  />
                  <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 shrink-0 text-zinc-500" />
                    <input
                      value={slot.window}
                      onChange={(event) => updateScheduleSlot(slot.id, { window: event.target.value })}
                      className="min-w-0 flex-1 rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-300 outline-none focus:border-[#FF4D00]/60"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-[44px_1fr_44px_44px] items-center gap-2">
                  <button
                    onClick={() => updateSchedule(slot.id, slot.posts - 1)}
                    className="grid h-10 place-items-center rounded-sm border border-white/10 text-xl font-black text-zinc-300"
                  >
                    -
                  </button>
                  <div className="min-w-0 rounded-sm border border-white/10 bg-black/30 py-2 text-center text-2xl font-black">{slot.posts}</div>
                  <button
                    onClick={() => updateSchedule(slot.id, slot.posts + 1)}
                    className="grid h-10 place-items-center rounded-sm border border-[#FF4D00]/35 text-xl font-black text-[#FF4D00]"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeScheduleSlot(slot.id)}
                    className="grid h-10 place-items-center rounded-sm border border-red-500/25 bg-red-500/10 text-red-300"
                    title="Remove slot"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={addScheduleSlot}
            className="flex w-full items-center justify-center gap-2 rounded-sm border border-[#FF4D00]/30 bg-[#FF4D00]/10 px-4 py-4 font-mono text-xs font-black uppercase tracking-[0.2em] text-[#FF4D00]"
          >
            <Plus className="h-4 w-4" />
            Add Posting Slot
          </button>
          <div className="grid grid-cols-1 gap-3">
            <Field label="Comments/day" value={String(state.dailyCommentGoal)} onChange={(value) => updateState({ dailyCommentGoal: Number(value) || 0 })} />
            <Field label="Likes/day" value={String(state.dailyLikeGoal)} onChange={(value) => updateState({ dailyLikeGoal: Number(value) || 0 })} />
          </div>
          <Field label="Learn new things/day" value={String(state.dailyLearningGoal)} onChange={(value) => updateState({ dailyLearningGoal: Number(value) || 1 })} />
        </div>
      </Section>

      <Section title="Interests" subtitle="AI-only topics. Crypto and coin content is blocked." defaultOpen={false}>
        <div className="flex flex-wrap gap-2">
          {state.interests.map((interest) => (
            <button
              key={interest}
              onClick={() => updateState({ interests: state.interests.filter((item) => item !== interest) })}
              className="rounded-sm border border-[#FF4D00]/20 bg-[#FF4D00]/10 px-3 py-2 text-xs font-bold text-[#FF4D00]"
            >
              {interest}
            </button>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            value={interestDraft}
            onChange={(event) => setInterestDraft(event.target.value)}
            placeholder="Add interest"
            className="min-w-0 flex-1 rounded-sm border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold outline-none focus:border-[#FF4D00]/50"
          />
          <button onClick={addInterest} className="grid h-12 w-14 place-items-center rounded-sm bg-[#FF4D00] text-black">
            <Plus className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 rounded-sm border border-red-500/20 bg-red-500/10 p-4 text-xs leading-5 text-red-200">
          <Ban className="mb-2 h-4 w-4" />
          Blocked terms: {blockedSummary}.
        </div>
        <div className="mt-3 rounded-sm border border-amber-500/25 bg-amber-500/10 p-4">
            <div className="text-[10px] font-mono font-black uppercase tracking-[0.22em] text-amber-300">
              avoided topics
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {state.avoidedTopics.length ? state.avoidedTopics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => updateState({ avoidedTopics: state.avoidedTopics.filter((item) => item !== topic) })}
                  className="rounded-sm border border-amber-500/25 bg-black/25 px-3 py-2 text-left text-xs font-bold text-amber-100"
                  title="Tap to remove avoided topic"
                >
                  {topic}
                </button>
              )) : (
                <span className="text-xs text-amber-100/70">No avoided topics set.</span>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={avoidedDraft}
                onChange={(event) => setAvoidedDraft(event.target.value)}
                placeholder="Add avoided topic"
                className="min-w-0 flex-1 rounded-sm border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold outline-none focus:border-amber-400/50"
              />
              <button onClick={addAvoidedTopic} className="grid h-12 w-14 place-items-center rounded-sm bg-amber-400 text-black">
                <Plus className="h-5 w-5" />
              </button>
            </div>
        </div>
      </Section>

      <Section title="Examples" subtitle="Post styles to remix, rewrite, and queue." defaultOpen={false}>
        <div className="space-y-2">
          {state.examples.map((example, index) => (
            <div key={`${example}-${index}`} className="rounded-sm border border-white/10 bg-black/25 p-4">
              <div className="flex items-start gap-3">
                <textarea
                  value={example}
                  onChange={(event) =>
                    updateState({
                      examples: state.examples.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)),
                    })
                  }
                  className="min-h-20 min-w-0 flex-1 resize-y rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-sm leading-6 text-zinc-200 outline-none focus:border-[#FF4D00]/60"
                />
                <button
                  onClick={() => updateState({ examples: state.examples.filter((_, itemIndex) => itemIndex !== index) })}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-red-500/25 bg-red-500/10 text-red-300"
                  title="Remove example"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <textarea
          value={exampleDraft}
          onChange={(event) => setExampleDraft(event.target.value)}
          placeholder="Paste an example post style to reuse..."
          className="mt-4 min-h-28 w-full resize-none rounded-sm border border-white/10 bg-black/40 px-4 py-3 text-sm leading-6 text-slate-100 outline-none focus:border-[#FF4D00]/50"
        />
        <button onClick={addExample} className="mt-3 w-full rounded-sm bg-[#FF4D00] px-4 py-4 font-mono text-xs font-black uppercase tracking-[0.22em] text-black">
          Add Example
        </button>
      </Section>

      <Section title="Comment Brain" subtitle="How Moltbook answers replies and comments." defaultOpen={false}>
        <div className="space-y-2">
          {state.commentGuidelines.map((guideline, index) => (
            <div key={`${guideline}-${index}`} className="rounded-sm border border-white/10 bg-black/25 p-4">
              <div className="flex items-start gap-3">
                <textarea
                  value={guideline}
                  onChange={(event) =>
                    updateState({
                      commentGuidelines: state.commentGuidelines.map((item, itemIndex) =>
                        itemIndex === index ? event.target.value : item,
                      ),
                    })
                  }
                  className="min-h-20 min-w-0 flex-1 resize-y rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-sm leading-6 text-zinc-200 outline-none focus:border-emerald-400/60"
                />
                <button
                  onClick={() => updateState({ commentGuidelines: state.commentGuidelines.filter((_, itemIndex) => itemIndex !== index) })}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-red-500/25 bg-red-500/10 text-red-300"
                  title="Remove comment rule"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
        <textarea
          value={commentGuidelineDraft}
          onChange={(event) => setCommentGuidelineDraft(event.target.value)}
          placeholder="Add how Moltbook should answer comments..."
          className="mt-4 min-h-24 w-full resize-none rounded-sm border border-white/10 bg-black/40 px-4 py-3 text-sm leading-6 text-slate-100 outline-none focus:border-emerald-400/50"
        />
        <button onClick={addCommentGuideline} className="mt-3 w-full rounded-sm bg-emerald-500 px-4 py-4 font-mono text-xs font-black uppercase tracking-[0.22em] text-black">
          Add Comment Rule
        </button>
      </Section>

      <Section title="Interactions" subtitle="Follower and engagement dashboard." defaultOpen={false}>
        <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
          <Field
            label="Total interactions"
            value={String(state.interaction.totalInteractions)}
            onChange={(value) => updateState({ interaction: { ...state.interaction, totalInteractions: Number(value) || 0 } })}
          />
          <Field
            label="Followers"
            value={String(state.interaction.followers)}
            onChange={(value) => updateState({ interaction: { ...state.interaction, followers: Number(value) || 0 } })}
          />
          <Field
            label="Posts today"
            value={String(state.interaction.postsToday)}
            onChange={(value) => updateState({ interaction: { ...state.interaction, postsToday: Number(value) || 0 } })}
          />
          <Field
            label="Comments"
            value={String(state.interaction.commentsToday)}
            onChange={(value) => updateState({ interaction: { ...state.interaction, commentsToday: Number(value) || 0 } })}
          />
          <Field
            label="Likes"
            value={String(state.interaction.likesToday)}
            onChange={(value) => updateState({ interaction: { ...state.interaction, likesToday: Number(value) || 0 } })}
          />
          <Field
            label="Replies"
            value={String(state.interaction.repliesUnderPosts)}
            onChange={(value) => updateState({ interaction: { ...state.interaction, repliesUnderPosts: Number(value) || 0 } })}
          />
          <Field
            label="Checked"
            value={state.interaction.lastCheckedAt}
            onChange={(lastCheckedAt) => updateState({ interaction: { ...state.interaction, lastCheckedAt } })}
          />
        </div>
        <div className="mt-3">
          <TextAreaField
            label="Last interaction summary"
            value={state.interaction.lastSummary}
            onChange={(lastSummary) => updateState({ interaction: { ...state.interaction, lastSummary } })}
            minHeight="min-h-20"
          />
        </div>
        <button
          onClick={simulateRefresh}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-sm border border-[#FF4D00]/30 bg-[#FF4D00]/10 px-4 py-4 font-mono text-xs font-black uppercase tracking-[0.2em] text-[#FF4D00]"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Stats
        </button>
      </Section>

      <Section title="Controls" subtitle="Safe operation mode for phone use." defaultOpen={false}>
        <div className="grid grid-cols-1 gap-2">
          <PillButton active={state.mode === "approval"} onClick={() => updateState({ mode: "approval" })}>
            Approval
          </PillButton>
          <PillButton active={state.mode === "assisted"} onClick={() => updateState({ mode: "assisted" })}>
            Assisted
          </PillButton>
          <PillButton active={state.mode === "paused"} onClick={() => updateState({ mode: "paused" })}>
            Paused
          </PillButton>
        </div>
        <div className="mt-4 rounded-sm border border-[#FF4D00]/20 bg-[#FF4D00]/10 p-4 text-sm leading-6 text-zinc-100">
          <ShieldCheck className="mb-2 h-5 w-5" />
          Assisted mode keeps Moltbook armed on the phone. Paused stops dispatch. Approval is still available when you want manual review before posting.
        </div>
        <div className="mt-3 rounded-sm border border-white/10 bg-black/25 p-4">
          <div className="flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-[0.24em] text-[#7f92b2]">
            <Sparkles className="h-4 w-4" />
            daily learning
          </div>
          <textarea
            value={state.lastLearnedTopic}
            onChange={(event) => updateState({ lastLearnedTopic: event.target.value })}
            className="mt-3 min-h-24 w-full resize-y rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-sm leading-6 text-zinc-300 outline-none focus:border-[#FF4D00]/60"
          />
        </div>
      </Section>

      <Section title="Instruction Log" subtitle="Baloss LLM instructions applied to Moltbook." defaultOpen={false}>
        <div className="space-y-2">
          {state.commandLog.length ? (
            state.commandLog.map((entry, index) => (
              <div key={`${entry}-${index}`} className="rounded-sm border border-white/10 bg-black/25 p-4">
                <div className="flex items-start gap-3">
                  <textarea
                    value={entry}
                    onChange={(event) =>
                      updateState({
                        commandLog: state.commandLog.map((item, itemIndex) =>
                          itemIndex === index ? event.target.value : item,
                        ),
                      })
                    }
                    className="min-h-20 min-w-0 flex-1 resize-y rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-sm leading-6 text-zinc-300 outline-none focus:border-[#FF4D00]/60"
                  />
                  <button
                    onClick={() => updateState({ commandLog: state.commandLog.filter((_, itemIndex) => itemIndex !== index) })}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-red-500/25 bg-red-500/10 text-red-300"
                    title="Remove command"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-sm border border-dashed border-white/10 p-4 text-sm text-zinc-500">
              No Moltbook instructions applied yet.
            </div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2">
          <button
            onClick={() => updateState({ commandLog: [] })}
            className="rounded-sm border border-red-500/25 bg-red-500/10 px-4 py-4 font-mono text-xs font-black uppercase tracking-[0.22em] text-red-300"
          >
            Clear Log
          </button>
        </div>
      </Section>

    </div>
  );
};

export default MoltbookAgentApp;
