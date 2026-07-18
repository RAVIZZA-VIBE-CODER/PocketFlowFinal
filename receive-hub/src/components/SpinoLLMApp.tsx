import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  CloudSun,
  Coins,
  Copy,
  Database,
  Download,
  FileSearch,
  FileText,
  FolderOpen,
  Globe2,
  HardDrive,
  Loader2,
  Mail,
  MessageSquare,
  Mic,
  Newspaper,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Square,
  TrendingUp,
  Trash2,
  Upload,
  UserRound,
  Wrench,
  X,
  Link2,
  Briefcase,
} from "lucide-react";
import {
  SPINO_AETHER_KNOWLEDGE_TARGET_BYTES,
  SPINO_DEFAULT_KNOWLEDGE_ROOT,
  SPINO_DEFAULT_MODEL,
  SPINO_FOLDER_LAYOUT,
  SPINO_LEGACY_TINY_MODEL_IDS,
  SPINO_LEGACY_TINY_MODEL_NAMES,
  SPINO_MISTRAL_MODEL,
  SPINO_MISTRAL_MODEL_URL,
  SPINO_OPTIMIZED_MODEL,
  SPINO_OPTIMIZED_MODEL_URL,
  SPINO_PRESET_MODELS,
  SPINO_PROFILES,
  SPINO_SMALL_MODEL,
  SPINO_SMALL_MODEL_URL,
  type AetherStorageStats,
  type SpinoIndexState,
  type SpinoModelRecord,
  type SpinoProfileId,
  type SpinoRuntimeStats,
  type SpinoSearchResult,
  createSpinoModelRecord,
  canRunSpinoModelSafely,
  ensureOptimizedSpinoModel,
  estimateModelMemoryMb,
  filterSpinoResultsForChat,
  formatSpinoBytes,
  getSelectedSpinoModelId,
  getSelectedSpinoProfileId,
  getSpinoProfile,
  indexSpinoFiles,
  loadSpinoIndex,
  loadSpinoModels,
  saveSpinoIndex,
  saveSpinoModels,
  searchSpinoIndex,
  setSelectedSpinoModelId,
  setSelectedSpinoProfileId,
} from "../utils/spinoLLMEngine";
import { createPocketAIRouter, loadPocketAISettings } from "../utils/pocketAI";
import { handleLifeMemoryPrompt, loadLearnedMemories, upsertLearnedMemory } from "../utils/lifeMemory";
import {
  SPINO_INTEL_REFRESH_INTERVAL_MS,
  answerFromSpinoIntel,
  buildSpinoIntelContextForPrompt,
  fetchSpinoResearchItems,
  isSpinoIntelStale,
  loadSpinoIntelSnapshot,
  refreshSpinoIntel,
  shouldUseSpinoOnlineIntel,
  type SpinoIntelItem,
  type SpinoIntelSnapshot,
} from "../utils/spinoOnlineIntel";
import {
  SPINO_AGENT_NODES,
  buildSpinoHeartbeat,
  buildSpinoReasoningEnvelope,
  classifySpinoIntent,
  type SpinoAgentNode,
  type SpinoHeartbeat,
} from "../utils/spinoOrchestrator";
import { parseSpinoSystemAction, type SpinoSystemAction, type SpinoSystemActionResult } from "../utils/spinoTools";
import { buildDictationUnderstandingContext, normalizeSpinoSpeechInput } from "../utils/spinoSpeech";
import {
  auditSpinoConversationStack,
  buildSpinoConversationCoreContext,
  decideSpinoConversationMode,
} from "../utils/spinoConversationCore";
import {
  SPINO_TASK_AGENT_PROFILES,
  addSpinoTaskAttachments,
  appendSpinoTaskTurn,
  compileSpinoTaskWorkflow,
  createSpinoTaskSession,
  getActiveSpinoTaskId,
  getSpinoTaskAgentProfile,
  inferSpinoTaskModeFromPrompt,
  isBuilderTaskCommand,
  isSpinoTaskChatCommand,
  isWorkflowBuildCommand,
  loadSpinoTaskSessions,
  setActiveSpinoTaskId,
  upsertSpinoTaskSession,
  type SpinoTaskMode,
  type SpinoTaskSession,
} from "../utils/spinoTaskChats";
import { buildSpinoLearningContext } from "../utils/spinoLearning";
import { getAllDashboards } from "../utils/storage";
import {
  buildSpinoPersonalProfileContext,
  emptySpinoBusinessProfile,
  emptySpinoProfileLink,
  loadSpinoPersonalProfile,
  saveSpinoPersonalProfile,
  saveSpinoProfileAsLearnedMemory,
  type SpinoBusinessProfile,
  type SpinoPersonalProfile,
  type SpinoProfileLink,
} from "../utils/spinoPersonalProfile";
import { answerFromSpinoNewsMemory, buildSpinoNewsContext, handleSpinoNewsCommand } from "../utils/spinoNewsControl";
import {
  answerFromAgentGateway,
  buildAgentGatewayContext,
  clearAgentGatewayToken,
  hasStoredAgentGatewayToken,
  loadAgentGatewaySnapshot,
  refreshAgentGatewaySnapshot,
  saveAgentGatewayToken,
  shouldUseAgentGateway,
  type AgentGatewaySnapshot,
} from "../utils/spinoAgentGateway";
import {
  beginPocketAutomationJob,
  completePocketAutomationJob,
  failPocketAutomationJob,
  isHardAutomationTask,
  isPocketAutomationStopRequested,
  type PocketAutomationJob,
} from "../utils/automationGuard";
import {
  ARCHIVE_MAINTENANCE_CADENCES,
  approveArchiveDuplicateGroup,
  blockArchiveThreat,
  dismissArchiveDuplicateGroup,
  loadArchiveMaintenanceState,
  overrideArchiveThreat,
  parseArchiveMaintenanceCommand,
  quarantineArchiveThreat,
  runArchiveMaintenanceScan,
  saveArchiveMaintenanceState,
  setArchiveMaintenanceRunning,
  updateArchiveMaintenanceConfig,
  type ArchiveMaintenanceCadence,
  type ArchiveMaintenanceState,
} from "../utils/archiveMaintenance";
import {
  SPINO_CHAT_HISTORY_KEY,
  buildSpinoCheckpointContext,
  loadSpinoChatCheckpoints,
  loadSpinoChatCleanupState,
  prepareSpinoChatHistoryForStorage,
  runSpinoChatCleanup,
  updateSpinoChatCleanupState,
  type SpinoChatCheckpoint,
  type SpinoChatCleanupState,
} from "../utils/spinoChatCleanup";
import {
  answerFromBalossAgentHealth,
  answerFromBalossSystemStatus,
  buildBalossAgentHealthContext,
  buildBalossAgentHealthReport,
  isBalossAgentHealthDue,
  loadBalossAgentHealthReport,
  wantsBalossAgentHealth,
  wantsBalossSystemStatus,
  type BalossAgentHealthReport,
} from "../utils/spinoAgentHealth";
import {
  buildBalossExperienceContext,
  loadBalossExperienceMemory,
  rememberBalossBuilderWorkflow,
  rememberBalossQa,
} from "../utils/balossExperienceMemory";
import { getMoltbookReserveStats, loadMoltbookState, moltbookDailyPostTarget } from "../utils/moltbookAgent";
import { answerFromBalossServiceAgent, shouldUseBalossServiceAgent } from "../utils/balossServiceAgent";
import {
  loadBalossDurableJobs,
  summarizeBalossScheduler,
  type BalossDurableJob,
} from "../utils/balossDurableScheduler";
import {
  BALOSS_QUALITY_BENCHMARK_CASES,
  buildBalossQualityHistoryEntry,
  clearBalossQualityHistory,
  getBalossQualityTrend,
  loadBalossQualityHistory,
  runBalossQualityBenchmark,
  saveBalossQualityHistoryEntry,
  type BalossQualityHistoryEntry,
  type BalossQualityBenchmarkReport,
} from "../utils/balossQualityBench";

interface SpinoLLMAppProps {
  onNotify?: (message: string, type: "success" | "info" | "warn") => void;
  onSystemAction?: (action: SpinoSystemAction) => SpinoSystemActionResult | Promise<SpinoSystemActionResult>;
}

interface QualitySampleMeta {
  providerId: string;
  modelId?: string;
  durationMs: number;
  at: string;
  error?: string;
}

type DrawerId = "core" | "quality" | "intel" | "agent" | "agentHealth" | "automation" | "knowledge" | "bigbrain" | "memory" | "archiveAgent" | "chatCleanup";
type ChatRole = "user" | "assistant" | "system";
type TaskAgentSelection = SpinoTaskMode | "none";

const AGENT_GATEWAY_REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const BIGBRAIN_ENDPOINT_KEY = "pocketflow.bigbrain.endpoint.v1";
const BIGBRAIN_TARGET_BYTES = 300 * 1024 * 1024 * 1024;

interface BigBrainHelperAgent {
  id: string;
  title: string;
  status: "online" | "standby" | "offline";
  detail: string;
}

interface BigBrainStatus {
  ok: boolean;
  checkedAt: string;
  endpoint: string;
  moduleName: string;
  mode: "bridge" | "offline";
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  message: string;
  helperAgents: BigBrainHelperAgent[];
  cognee?: {
    ok?: boolean;
    installed?: boolean;
    enabled?: boolean;
    version?: string | null;
    mode?: string;
    queued_memories?: number;
    message?: string;
  };
}

const emptyBigBrainStatus = (endpoint: string): BigBrainStatus => ({
  ok: false,
  checkedAt: "",
  endpoint,
  moduleName: "Tommyboy Encyclopedia Module",
  mode: "offline",
  totalBytes: 0,
  usedBytes: 0,
  freeBytes: 0,
  message: "Tommyboy bridge not checked yet.",
  helperAgents: [
    { id: "health", title: "Memory Health Agent", status: "standby", detail: "Checks disk health, manifests, and bridge state." },
    { id: "scout", title: "Index Scout", status: "standby", detail: "Finds likely documents before Baloss asks the main model." },
    { id: "retriever", title: "Context Retriever", status: "standby", detail: "Pulls short cited context instead of loading huge files." },
  ],
  cognee: {
    ok: false,
    installed: false,
    enabled: false,
    mode: "jsonl-queue",
    queued_memories: 0,
    message: "Cognee semantic memory not checked yet.",
  },
});

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  pending?: boolean;
  sourceLabel?: string;
}

interface SpeechResultDetail {
  ok?: boolean;
  transcript?: string;
  confidence?: number;
  message?: string;
  interim?: boolean;
}

interface SpinoVoiceDetail {
  phase?: "ready" | "start" | "done" | "error";
  message?: string;
}

interface SpinoVoiceLevelDetail {
  level?: number;
}

const CHAT_HISTORY_KEY = SPINO_CHAT_HISTORY_KEY;
const SPINO_VISIBLE_CHAT_LIMIT = 80;
const SPINO_STORED_CHAT_LIMIT = 120;
const STRONG_MODEL_DEFAULT_KEY = "pocketflow.spino.strongDefault.v1";
const QWEN_MODEL_DEFAULT_KEY = "pocketflow.spino.qwenDefault.v1";
const QWEN_DEFAULT_PROFILE: SpinoProfileId = "ultraLow";
const LOCAL_ONLY_KEY = "pocketflow.spino.localOnly.v2";
const GENERAL_ALLOWED_KEY = "pocketflow.spino.generalAllowed.v2";
const TASK_AGENT_KEY = "pocketflow.spino.selectedTaskAgent.v1";
const ELEVENLABS_STORAGE_KEY = "pocketflowFinal.public.spino.voiceProviderKey";
const ELEVENLABS_STANDARD_VOICE_ID = "pzxut4zZz4GImZNlqQ3H";
const ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
const SPINO_CHAT_TIMEOUT_MS = 45_000;
const SPINO_NATIVE_IDLE_STOP_MS = 120_000;

function withSpinoTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const taskAgentIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  builder: Bot,
  research: Search,
  email: Mail,
  personal: Database,
  code: FileText,
  automation: Wrench,
  notes: MessageSquare,
};

const loadBoolSetting = (key: string, fallback: boolean) => {
  const stored = localStorage.getItem(key);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return fallback;
};

const buildSpinoLearnedMemoryContext = (query: string, limit = 8) => {
  const terms = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9@._+-]+/i)
    .filter((term) => term.length > 2);
  if (!terms.length) return "";
  const memories = loadLearnedMemories()
    .map((memory) => {
      const haystack = `${memory.kind} ${memory.label} ${memory.value} ${memory.raw} ${memory.tags.join(" ")}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? (term.includes("@") ? 8 : 2) : 0), 0);
      return { memory, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.memory.updatedAt.localeCompare(a.memory.updatedAt))
    .slice(0, limit)
    .map((item) => item.memory);
  if (!memories.length) return "";
  return memories.map((memory, index) => `[M${index + 1}] ${memory.kind.toUpperCase()} / ${memory.label}: ${memory.value}`).join("\n");
};

const dispatchSpinoVoiceEvent = (detail: SpinoVoiceDetail) => {
  window.dispatchEvent(new CustomEvent("pocketflow-spino-voice", { detail }));
};

const LiveVoiceVisualizer = ({
  enabled,
  awake,
  listening,
  speaking,
  thinking,
  level,
  tick,
}: {
  enabled: boolean;
  awake: boolean;
  listening: boolean;
  speaking: boolean;
  thinking: boolean;
  level: number;
  tick: number;
}) => {
  const phase = !enabled ? "offline" : speaking ? "speaking" : thinking ? "thinking" : listening ? "listening" : awake ? "awake" : "standby";
  const normalized = Math.max(0.04, Math.min(1, level));
  const palette = {
    offline: { edge: "border-[#2a2c32]", text: "text-slate-500", main: "#94a3b8", soft: "#475569", glow: "rgba(148,163,184,0.14)", bg: "#0b0d10" },
    standby: { edge: "border-cyan-400/28", text: "text-cyan-100/70", main: "#22d3ee", soft: "#0e7490", glow: "rgba(34,211,238,0.18)", bg: "#020c10" },
    awake: { edge: "border-[#22c55e]/36", text: "text-[#92f8b3]", main: "#22c55e", soft: "#15803d", glow: "rgba(34,197,94,0.22)", bg: "#020f08" },
    listening: { edge: "border-[#34f58a]/48", text: "text-[#b4ffca]", main: "#34f58a", soft: "#16a34a", glow: "rgba(52,245,138,0.30)", bg: "#021209" },
    thinking: { edge: "border-amber-300/40", text: "text-amber-200", main: "#fbbf24", soft: "#b45309", glow: "rgba(251,191,36,0.24)", bg: "#140d02" },
    speaking: { edge: "border-[#64ffd0]/52", text: "text-[#c9fff4]", main: "#64ffd0", soft: "#0d9488", glow: "rgba(100,255,208,0.34)", bg: "#02110d" },
  }[phase];
  const active = phase !== "offline" && phase !== "standby";
  const energy = phase === "offline" ? 0.1 : phase === "standby" ? 0.18 : Math.max(0.34, normalized);
  const sweepOffset = -((tick / (speaking ? 7 : listening ? 10 : 18)) % 90);
  const pulse = 0.88 + Math.sin(tick / 180) * 0.08 + energy * 0.1;
  const waveAmp = active ? 8 + energy * 24 : 4 + energy * 8;
  const waveSpeed = speaking ? 62 : listening ? 82 : thinking ? 120 : 190;
  const wavePoints = Array.from({ length: 42 }, (_, index) => {
    const x = 18 + index * 6.9;
    const primary = Math.sin(index * 0.56 + tick / waveSpeed) * waveAmp;
    const secondary = Math.sin(index * 1.12 + tick / (waveSpeed * 1.42)) * waveAmp * 0.22;
    const y = 67 + primary + secondary;
    return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  const lowWavePoints = Array.from({ length: 32 }, (_, index) => {
    const x = 46 + index * 7.35;
    const y = 67 + Math.sin(index * 0.74 + tick / 160) * (3 + energy * 8);
    return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");

  return (
    <div
      className={`relative h-32 overflow-hidden rounded-[26px] border ${palette.edge}`}
      style={{
        background:
          `radial-gradient(circle at 50% 54%, ${palette.glow} 0%, transparent 42%), ` +
          `linear-gradient(135deg, ${palette.bg} 0%, #06090c 64%, #030405 100%)`,
        boxShadow: `inset 0 0 28px ${palette.glow}, 0 0 ${6 + energy * 16}px ${palette.glow}`,
      }}
    >
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148, 163, 184, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }}
      />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 320 130" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="spinoVoiceLine" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={palette.main} stopOpacity="0" />
            <stop offset="24%" stopColor={palette.main} stopOpacity="0.48" />
            <stop offset="50%" stopColor={palette.main} stopOpacity="1" />
            <stop offset="76%" stopColor={palette.main} stopOpacity="0.48" />
            <stop offset="100%" stopColor={palette.main} stopOpacity="0" />
          </linearGradient>
          <radialGradient id="spinoVoiceCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={palette.main} stopOpacity="0.95" />
            <stop offset="40%" stopColor={palette.main} stopOpacity="0.32" />
            <stop offset="100%" stopColor={palette.main} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="18" y="18" width="284" height="94" rx="28" fill="none" stroke={palette.main} strokeOpacity="0.24" strokeWidth="1.4" />
        <rect x="58" y="36" width="204" height="58" rx="29" fill="none" stroke={palette.soft} strokeOpacity="0.25" strokeWidth="1" />
        <line x1="34" y1="65" x2="286" y2="65" stroke={palette.main} strokeOpacity="0.12" strokeWidth="1" />
        <g opacity={phase === "offline" ? 0.18 : 0.46 + energy * 0.28}>
          <path
            d="M160 65 L160 20"
            stroke={palette.main}
            strokeOpacity="0.46"
            strokeWidth="1"
            strokeDasharray="8 10"
            strokeDashoffset={sweepOffset}
          />
          <path
            d="M160 65 L208 34"
            stroke={palette.main}
            strokeOpacity="0.28"
            strokeWidth="1"
            strokeDasharray="6 8"
            strokeDashoffset={sweepOffset * 0.7}
          />
          <path
            d="M160 65 L111 96"
            stroke={palette.main}
            strokeOpacity="0.22"
            strokeWidth="1"
            strokeDasharray="5 9"
            strokeDashoffset={sweepOffset * 0.5}
          />
        </g>
        <path d={lowWavePoints} fill="none" stroke={palette.soft} strokeOpacity="0.36" strokeWidth="2" strokeLinecap="round" />
        <path
          d={wavePoints}
          fill="none"
          stroke="url(#spinoVoiceLine)"
          strokeWidth={active ? 4.2 : 2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={phase === "offline" ? 0.2 : 0.82}
          style={{ filter: `drop-shadow(0 0 ${6 + energy * 12}px ${palette.main})` }}
        />
        <circle cx="160" cy="65" r={30 * pulse} fill="none" stroke={palette.main} strokeOpacity="0.13" strokeWidth="1.2" />
        <circle cx="160" cy="65" r={15 + energy * 8} fill="url(#spinoVoiceCore)" />
        <circle cx="160" cy="65" r={4 + energy * 4} fill={palette.main} opacity={phase === "offline" ? 0.32 : 0.9} />
      </svg>
      <div className={`absolute bottom-3 left-5 right-5 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.22em] ${palette.text}`}>
        <span>{phase}</span>
        <span>{Math.round(normalized * 100)}%</span>
      </div>
    </div>
  );
};

const Pill = ({ children, tone = "slate" }: { children: React.ReactNode; tone?: "green" | "amber" | "red" | "slate" }) => {
  const toneClass = {
    green: "bg-[#22c55e]/12 text-[#22c55e] border-[#22c55e]/20",
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    red: "bg-red-500/10 text-red-300 border-red-500/20",
    slate: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  }[tone];
  return <span className={`px-2.5 py-1 rounded-full border text-[9px] font-mono font-bold uppercase tracking-wider ${toneClass}`}>{children}</span>;
};

const loadChatHistory = (): ChatMessage[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CHAT_HISTORY_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    const cleanedMessages = parsed.flatMap((message) => {
      if (!message || typeof message !== "object" || typeof message.content !== "string") return [];
      if (!["user", "assistant", "system"].includes(message.role)) return [];
      const contentValue = message.content.trim();
      if (message.pending && !contentValue) return [];
      if (message.role !== "assistant") {
        return [{ ...message, content: contentValue, pending: false }];
      }
      const looksInternal =
        /SPINO CONVERSATION CORE|BALOSS LLM CONVERSATION CORE|BALOSS LLM CENTRAL HUB|ANSWER STYLE|OPERATING RULE|From local Spino memory|From the local knowledge index|I remember this:|Readiness:\s*\d+%|Conversation stack is functional|Conversation stack is usable|native model\/STT|No executable model|General knowledge allowed|Privacy gate|local reasoning model|speech transcription|semantic retrieval|tool permissions/i.test(
          contentValue,
        );
      const cleaned = message.content
        .replace(/^From local Spino memory:\s*/i, "")
        .replace(/^From the local knowledge index, the closest match is:\s*/i, "")
        .replace(/^The local knowledge index found this useful context:\s*/i, "")
        .replace(/^I remember this:\s*/i, "")
        .replace(/\n{2,}Sources:[\s\S]*$/i, "")
        .replace(/\n{2,}Question tracked locally:[\s\S]*$/i, "")
        .split(/\n+/)
        .map((line: string) => line.trim())
        .filter(Boolean)
        .filter((line: string) => !/^(PocketFlow (SpinoLLM|Baloss LLM) conversation memory|SPINO CONVERSATION CORE|BALOSS LLM CONVERSATION CORE|BALOSS LLM CENTRAL HUB|ANSWER STYLE|OPERATING RULE|ROUTE|CONTEXT|USER MESSAGE|Time:|Mode:|Privacy:|Reason:|Readiness:|Model:|Memory:|Research:|Primary agent:|Task:|Tools allowed:|Route reason:|Sources?:|Question tracked locally:)/i.test(line))
        .filter((line: string) => !/(Conversation stack is functional|Conversation stack is usable|native model\/STT|No executable model file active|General knowledge allowed|Privacy gate:|model missing|web memory active|24h cache active)/i.test(line))
        .map((line: string) => line.replace(/^(USER|SPINO|BALOSS):\s*/i, "").trim())
        .filter(Boolean)
        .join("\n\n")
        .trim();
      const content = cleaned.length > 420 ? `${cleaned.slice(0, 420).trim()}...` : cleaned;
      const finalContent = content || (looksInternal ? "" : contentValue);
      if (!finalContent || (looksInternal && !content)) return [];
      return [{ ...message, content: finalContent, pending: false }];
    });
    return cleanedMessages.slice(-SPINO_VISIBLE_CHAT_LIMIT);
  } catch {
    return [];
  }
};

const saveChatHistory = (messages: ChatMessage[]) => {
  const prepared = prepareSpinoChatHistoryForStorage(messages);
  localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(prepared.slice(-SPINO_STORED_CHAT_LIMIT)));
};

const messageTone = (role: ChatRole) =>
  role === "user"
    ? "border-[#22c55e]/25 bg-[#12311e] text-[#d9fbe5]"
    : role === "assistant"
      ? "border-[#2a2c32] bg-[#141518] text-slate-100"
      : "border-amber-500/20 bg-amber-500/8 text-amber-100";

const wantsDetailedSpinoReply = (prompt: string) =>
  /\b(full|detailed|details|deep|analysis|analyze|analyse|plan|steps|step by step|architecture|complete|everything|long answer|explain fully|explain in detail)\b/i.test(prompt);

const wantsResearchSpinoReply = (prompt: string) =>
  /\b(research|ricerca|investigate|compare|sources|links|news|latest|today|market|stock|btc|bitcoin|eth|ethereum|weather|meteo|report|briefing)\b/i.test(prompt);

const wantsDashboardSpinoReply = (prompt: string) =>
  /\b(dashboard|dashboards|chart|charts|widget|widgets|kpi|metrics|telemetry panel|control panel|report page)\b/i.test(prompt);

const wantsQuickSpinoReply = (prompt: string) =>
  /\b(quick|short|brief|simple|fast|one sentence|yes or no|status|what time|how much|price|quando|quanto|dimmi veloce)\b/i.test(prompt);

const wantsSpinoSystemDiagnostics = (prompt: string) =>
  /\b(diagnostic|diagnostics|readiness|runtime|runner|model status|local model|ram|memory pressure|health|efficiency|what missing|missing pieces|stack|debug|why is|why does|why doesn't|system status)\b/i.test(prompt);

const shouldPersistSpinoConversationTurn = (userText: string, assistantText: string) => {
  if (/\b(remember|learn|save this|note this|take note|important|my details|my email|my phone|my contact|calendar|calander|note|task|workflow|builder|project|archive|relay|moltbook|baloss)\b/i.test(userText)) {
    return true;
  }
  return assistantText.length > 900 && wantsDetailedSpinoReply(userText);
};

const SPINO_INTERNAL_MARKERS = [
  /SPINO CONVERSATION CORE/i,
  /BALOSS LLM CONVERSATION CORE/i,
  /BALOSS LLM CENTRAL HUB/i,
  /ANSWER STYLE/i,
  /OPERATING RULE/i,
  /From local Spino memory/i,
  /From the local knowledge index/i,
  /The local knowledge index found/i,
  /I remember this:/i,
  /Question tracked locally/i,
  /Conversation stack is functional/i,
  /Conversation stack is usable/i,
  /Readiness:\s*\d+%/i,
  /native model\/STT/i,
  /No executable model/i,
  /General knowledge allowed/i,
  /Privacy gate/i,
  /local reasoning model/i,
  /speech transcription/i,
  /semantic retrieval/i,
  /tool permissions/i,
];

const hasSpinoInternalLeak = (text: string) => SPINO_INTERNAL_MARKERS.some((marker) => marker.test(text));

const buildDashboardLibraryContext = () => {
  const dashboards = getAllDashboards().slice(0, 8);
  if (!dashboards.length) return "";
  return [
    "EXISTING POCKETFLOW DASHBOARD LIBRARY",
    "Use these as style and structure references when the user asks for dashboard generation. Do not copy private data unless the user asks to reuse it.",
    ...dashboards.map((dashboard, index) => {
      const blocks = [...(dashboard.blocks || [])]
        .sort((left, right) => (left.order || 0) - (right.order || 0))
        .slice(0, 8)
        .map((block) => `${block.type}:${block.title || "untitled"}`)
        .join(", ");
      return `[D${index + 1}] ${dashboard.title}\nGoal: ${dashboard.goal || "not set"}\nDescription: ${dashboard.description || "not set"}\nBlocks: ${blocks || "no blocks"}`;
    }),
  ].join("\n\n");
};

const stripSpinoInternalDiagnostics = (text: string) => {
  const lines = text
    .replace(/^From local Spino memory:\s*/i, "")
    .replace(/^From the local knowledge index, the closest match is:\s*/i, "")
    .replace(/^The local knowledge index found this useful context:\s*/i, "")
    .replace(/^I remember this:\s*/i, "")
    .replace(/\n{2,}Sources:[\s\S]*$/i, "")
    .replace(/\n{2,}Question tracked locally:[\s\S]*$/i, "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(SPINO CONVERSATION CORE|BALOSS LLM CONVERSATION CORE|BALOSS LLM CENTRAL HUB|ANSWER STYLE|OPERATING RULE|ROUTE|CONTEXT|USER MESSAGE|PocketFlow (SpinoLLM|Baloss LLM) conversation memory|Time:|Mode:|Privacy:|Reason:|Readiness:|Model:|Memory:|Research:|Primary agent:|Task:|Tools allowed:|Route reason:|Sources?:|Question tracked locally:)/i.test(line))
    .filter((line) => !/(Conversation stack is functional|Conversation stack is usable|native model\/STT|No executable model file active|General knowledge allowed|Privacy gate:|model missing|web memory active|24h cache active|local reasoning model|speech transcription|semantic retrieval|tool permissions)/i.test(line))
    .filter((line) => !/^(USER|SPINO|BALOSS):\s*$/i.test(line))
    .map((line) => line.replace(/^(USER|SPINO|BALOSS):\s*/i, "").trim())
    .filter(Boolean);

  const joined = lines.join("\n\n").replace(/[ \t]+/g, " ").trim();
  if (!/SPINO CONVERSATION CORE|BALOSS LLM CONVERSATION CORE|ANSWER STYLE|Readiness:|Conversation stack|native model\/STT|No executable model|General knowledge allowed|Privacy gate/i.test(joined)) {
    return joined;
  }
  return "";
};

const normalizeLooseSpinoText = (prompt: string) =>
  prompt
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\b(calander|callendar|calender|callander|cal)\b/g, "calendar")
    .replace(/\b(moltook|moltbbok|multiple)\b/g, "moltbook")
    .replace(/\b(campain|campains)\b/g, "campaign")
    .replace(/\b(news flow|newflow)\b/g, "newsflow")
    .replace(/\b(reaserch|reasrch|reserch)\b/g, "research")
    .replace(/\b(emils|emaiuls)\b/g, "emails")
    .replace(/\b(metting|meating)\b/g, "meeting")
    .replace(/\s+/g, " ")
    .trim();

const routeLooseSpinoPrompt = (prompt: string) => {
  const text = normalizeLooseSpinoText(prompt);
  if (!text) return "I'm here. Send it however it comes out; I'll clean it up and understand the intent.";
  if (/^(hi|hey|hello|ciao|yo|how are you|how are u|how r u|come stai)\b/.test(text)) {
    return "All good. I'm here and ready. Send the idea messy if you need to; I'll read the intent and keep answers short.";
  }
  if (/\b(calendar|appointment|plans|tomorrow|today|meeting at|remind|reminder)\b/.test(text)) {
    return "I understand this as a calendar task. Give me the date, time, title, and notes; if something is missing I'll ask only for that piece.";
  }
  if (/\b(note|notes|voice memo|meeting|transcribe|record)\b/.test(text)) {
    return "I understand this as a notes or meeting task. I can save the note, start a meeting record, or summarize a transcript.";
  }
  if (/\b(newsflow|news|newsletter|campaign|fashion|politics|ai news)\b/.test(text)) {
    return "I understand this as a News Flow task. I can pull news, prepare a newsletter, check campaigns, or adjust topics and lists.";
  }
  if (/\b(moltbook|post|comment|social|agentmoltbook)\b/.test(text)) {
    return "I understand this as a Moltbook task. I can prepare posts, adjust the schedule, check the connection, or draft a reply.";
  }
  if (/\b(crm|email|emails|contact|contacts|list|send mail)\b/.test(text)) {
    return "I understand this as a CRM/email task. I can help with contacts, lists, drafts, sending checks, or mailbox status.";
  }
  if (/\b(builder|workflow|box|prompt architecture|flow map)\b/.test(text)) {
    return "I understand this as a Builder task. I can turn the idea into numbered boxes, workflow order, and export-ready instructions.";
  }
  if (/\b(archive|reader|file|folder|document|dashboard)\b/.test(text)) {
    return "I understand this as a file/archive task. I can find, organize, open in Reader, or prepare files for a build.";
  }
  if (wantsQuickSpinoReply(prompt)) return `I read this as: ${text.slice(0, 110)}. I can help with it. What should I do first?`;
  return "";
};

const isBadGenericSpinoReply = (text: string) =>
  /^(ok[,.\s]+)?(tell me what you need|what do you need me to do|how can i help|i can help with that|sure[,.\s]+what should i do)/i.test(text.trim());

const compactSpinoChatReply = (text: string, prompt: string, overrideMaxChars?: number) => {
  const trimmed = text.trim();
  const routed = routeLooseSpinoPrompt(prompt);
  if (!trimmed) return routed || trimmed;

  const leaked = hasSpinoInternalLeak(trimmed);
  const clean = stripSpinoInternalDiagnostics(trimmed);
  if ((leaked && !clean) || !clean || (routed && isBadGenericSpinoReply(clean))) {
    return routed || "I'm here. Send it naturally and I'll keep it simple.";
  }
  if (wantsDetailedSpinoReply(prompt)) return clean;

  const maxChars = overrideMaxChars ?? (wantsResearchSpinoReply(prompt) ? 820 : wantsQuickSpinoReply(prompt) ? 220 : 360);
  const sentenceLimit = wantsResearchSpinoReply(prompt) ? 5 : wantsQuickSpinoReply(prompt) ? 2 : 3;

  if (clean.length <= maxChars) return clean;
  const sentences = clean
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, sentenceLimit)
    .join(" ")
    .trim();
  const base = sentences || clean;
  if (base.length <= maxChars) return base;
  const cut = base.slice(0, maxChars);
  return `${cut.slice(0, Math.max(0, cut.lastIndexOf(" "))).trim()}...`;
};

const isCasualHealthPrompt = (prompt: string) => {
  const normalized = prompt
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return /^(hey|hi|hello|yo|ciao|buongiorno|buonasera)?\s*(how are (you|u)|come stai|all good|are you ok|status|how is system|how are things)\b/.test(normalized);
};

const buildNaturalSpinoStatusReply = ({
  runtimeStats,
  heartbeat,
  efficiencyRatio,
}: {
  runtimeStats: SpinoRuntimeStats;
  heartbeat: SpinoHeartbeat;
  efficiencyRatio: number;
}) => {
  const pressure = runtimeStats.memoryPressure || "normal";
  const efficiency = runtimeStats.loaded || runtimeStats.nativeInferenceInstalled ? `${efficiencyRatio || "--"}%` : "--%";
  if (runtimeStats.crashed || heartbeat.status === "white") {
    return "I am here, but the local model looks disconnected. Chat is still up; reconnect the runner when you want full local power.";
  }
  if (heartbeat.status === "red" || runtimeStats.health === "limit" || pressure === "critical") {
    return `I am here, but the system is under pressure. RAM is ${pressure}, efficiency around ${efficiency}; I will keep answers short until it cools down.`;
  }
  if (heartbeat.status === "yellow" || runtimeStats.health === "busy" || runtimeStats.generationActive || pressure === "high") {
    return `I am good, just a bit busy. RAM is ${pressure}, system efficiency is around ${efficiency}, so I will stay light and steady.`;
  }
  return `All good. RAM is ${pressure}, system efficiency is around ${efficiency}, and Baloss LLM is ready.`;
};

const NEWSFLOW_STATUS_STORAGE_KEYS = {
  lastRun: "pocketflow.news.lastRunAt.v1",
  nextRun: "pocketflow.news.nextRunAt.v1",
  newsletterProfiles: "pocketflow.news.newsletterProfiles.v1",
  newsletterOutbox: "pocketflow.news.newsletterOutbox.v1",
  newsletterHealth: "pocketflow.news.newsletterHealth.v1",
  newsletterScheduleDone: "pocketflow.news.newsletterScheduleDone.v1",
  newsletterAttempts: "pocketflow.news.newsletterSendAttempts.v1",
};

const readBalossJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
};

const readBalossString = (key: string) => {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(key) || "";
};

const formatBalossTime = (value?: string) => {
  if (!value) return "not logged";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(parsed));
};

const balossJobTone = (job: BalossDurableJob): "green" | "amber" | "red" | "slate" => {
  if (!job.enabled || job.status === "paused") return "slate";
  if (job.status === "failed") return "red";
  if (job.status === "running") return "amber";
  if (job.status === "succeeded") return "green";
  return "amber";
};

const balossJobScheduleLabel = (job: BalossDurableJob) => {
  if (job.dailyAt) {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const days = job.weekdays?.length
      ? `${job.weekdays.map((day) => dayNames[Math.max(0, Math.min(6, Number(day)))]).join(", ")} `
      : "Daily ";
    return `${days}${job.dailyAt}`;
  }
  if (job.everyMinutes) return `Every ${job.everyMinutes} min`;
  return "Manual";
};

const normalizeStatusText = (prompt: string) =>
  prompt
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const wantsCampaignOrMoltbookUpdate = (prompt: string) => {
  const normalized = normalizeStatusText(prompt);
  const asksStatus = /\b(status|update|updates|latest|last|run|runs|working|posted|posting|sent|sending|campaign|campaigns|newsletter|newsletters|news flow|newsflow|moltbook|agentmoltbook)\b/.test(
    normalized,
  );
  const mentionsOps = /\b(moltbook|agentmoltbook|campaign|campaigns|newsletter|newsletters|news flow|newsflow|daily brief|fashion news|tanuki ai|2ndlife|second life|latest run|last run)\b/.test(
    normalized,
  );
  return asksStatus && mentionsOps;
};

const buildCampaignAndMoltbookStatusReply = (prompt: string) => {
  if (!wantsCampaignOrMoltbookUpdate(prompt)) return "";

  const normalized = normalizeStatusText(prompt);
  const includeNews = /\b(campaign|campaigns|newsletter|newsletters|news flow|newsflow|daily brief|fashion news|tanuki ai|2ndlife|second life|latest run|last run|sent|sending)\b/.test(
    normalized,
  );
  const includeMoltbook = /\b(moltbook|agentmoltbook|post|posted|posting|social|latest run|last run)\b/.test(normalized);
  const includeBoth = !includeNews && !includeMoltbook;
  const lines: string[] = [];

  if (includeNews || includeBoth) {
    const profiles = readBalossJson<Record<string, any>[]>(NEWSFLOW_STATUS_STORAGE_KEYS.newsletterProfiles, []);
    const outbox = readBalossJson<Record<string, any>[]>(NEWSFLOW_STATUS_STORAGE_KEYS.newsletterOutbox, []);
    const health = readBalossJson<Record<string, any> | null>(NEWSFLOW_STATUS_STORAGE_KEYS.newsletterHealth, null);
    const attempts = readBalossJson<Record<string, string>>(NEWSFLOW_STATUS_STORAGE_KEYS.newsletterAttempts, {});
    const activeProfiles = profiles.filter((profile) => profile?.enabled !== false);
    const latestBatch = [...outbox].sort((a, b) => {
      const left = Date.parse(String(a.sentAt || a.createdAt || a.generatedAt || ""));
      const right = Date.parse(String(b.sentAt || b.createdAt || b.generatedAt || ""));
      return (Number.isFinite(right) ? right : 0) - (Number.isFinite(left) ? left : 0);
    })[0];
    const lastRun = readBalossString(NEWSFLOW_STATUS_STORAGE_KEYS.lastRun);
    const nextRun = readBalossString(NEWSFLOW_STATUS_STORAGE_KEYS.nextRun);
    const nextCampaigns = activeProfiles
      .slice(0, 3)
      .map((profile) => `${profile.title || profile.name || "Campaign"} at ${profile.sendTime || "unset"}`)
      .join(", ");
    const sendAttempts = Object.keys(attempts).length;

    lines.push(`News Flow: ${activeProfiles.length}/${profiles.length || activeProfiles.length} campaigns active.`);
    lines.push(
      latestBatch
        ? `Last newsletter: ${latestBatch.title || latestBatch.profileTitle || "draft"} - ${latestBatch.status || "saved"} at ${formatBalossTime(
            String(latestBatch.sentAt || latestBatch.createdAt || latestBatch.generatedAt || ""),
          )}.`
        : "Last newsletter: no confirmed send saved in the local outbox yet.",
    );
    lines.push(`Pull runner: last ${formatBalossTime(lastRun)}, next ${formatBalossTime(nextRun)}.`);
    if (nextCampaigns) lines.push(`Next campaign slots: ${nextCampaigns}.`);
    if (health) {
      const state = health.status || health.state || (health.blocked ? "attention" : "ok");
      const issue = health.message || health.summary || health.lastError || "";
      lines.push(`Newsletter watchdog: ${state}${issue ? ` - ${String(issue).slice(0, 110)}` : ""}.`);
    } else if (sendAttempts) {
      lines.push(`Newsletter watchdog: ${sendAttempts} send attempt records saved.`);
    }
  }

  if (includeMoltbook || includeBoth) {
    const moltbook = loadMoltbookState();
    const reserve = getMoltbookReserveStats(moltbook);
    const health = moltbook.connectionHealth;
    lines.push(
      `Moltbook: ${moltbook.mode}, ${health.status}. Target ${moltbookDailyPostTarget(moltbook)}/day; reserve ${reserve.futurePlanned}/${reserve.reserveTarget} planned, ${reserve.ready} ready.`,
    );
    lines.push(
      `Last Moltbook check: ${formatBalossTime(moltbook.interaction.lastCheckedAt)} - ${
        moltbook.interaction.lastSummary || health.message || "no fresh activity summary saved"
      }.`,
    );
    if (health.status !== "connected") {
      lines.push(`Action needed: Moltbook bridge is ${health.status}; posting may not happen until the route is reachable.`);
    }
  }

  if (!lines.length) return "";
  return compactSpinoChatReply(lines.join("\n"), prompt, 760);
};

const isLiveRetryableSpeechMessage = (message = "") => /no speech|no voice|no match|timeout|text captured/i.test(message);
const isLiveBlockingSpeechMessage = (message = "") => /permission|busy|client|stopped|network|unavailable|audio error|could not start/i.test(message);

type TranslationLang = "auto" | "en" | "it" | "es" | "fr" | "de" | "pt";

const TRANSLATION_LANGS: Array<{ id: TranslationLang; label: string; speech?: string }> = [
  { id: "auto", label: "Auto" },
  { id: "en", label: "English", speech: "en-US" },
  { id: "it", label: "Italiano", speech: "it-IT" },
  { id: "es", label: "Español", speech: "es-ES" },
  { id: "fr", label: "Français", speech: "fr-FR" },
  { id: "de", label: "Deutsch", speech: "de-DE" },
  { id: "pt", label: "Português", speech: "pt-PT" },
];

const getTranslationLangLabel = (lang: TranslationLang) =>
  TRANSLATION_LANGS.find((item) => item.id === lang)?.label || lang.toUpperCase();

const detectTranslationLang = (text: string): Exclude<TranslationLang, "auto"> => {
  const lower = text.toLowerCase();
  if (/[àèéìòù]/.test(lower) || /\b(ciao|grazie|perche|perché|come|cosa|quando|dove|sono|voglio|devo|fare|questo|questa)\b/.test(lower)) return "it";
  if (/[¿¡ñ]/.test(lower) || /\b(hola|gracias|porque|cuando|donde|quiero|hacer|esto|esta)\b/.test(lower)) return "es";
  if (/[çœ]/.test(lower) || /\b(bonjour|merci|pourquoi|quand|ou|où|veux|faire|ceci)\b/.test(lower)) return "fr";
  if (/[äöüß]/.test(lower) || /\b(hallo|danke|warum|wann|wo|machen|dies)\b/.test(lower)) return "de";
  if (/\b(ola|olá|obrigado|porque|quando|onde|quero|fazer)\b/.test(lower)) return "pt";
  return "en";
};

const roughTranslationFallback = (text: string, sourceLang: TranslationLang, targetLang: TranslationLang) => {
  const source = sourceLang === "auto" ? detectTranslationLang(text) : sourceLang;
  const dictionaries: Record<string, Record<string, string>> = {
    "it-en": {
      ciao: "hello",
      grazie: "thank you",
      perche: "why",
      "perché": "why",
      come: "how",
      cosa: "what",
      quando: "when",
      dove: "where",
      voglio: "I want",
      devo: "I must",
      fare: "do",
      questo: "this",
      questa: "this",
      funziona: "works",
      sistema: "system",
      telefono: "phone",
      app: "app",
    },
    "en-it": {
      hello: "ciao",
      thanks: "grazie",
      "thank you": "grazie",
      why: "perché",
      how: "come",
      what: "cosa",
      when: "quando",
      where: "dove",
      want: "voglio",
      need: "devo",
      do: "fare",
      this: "questo",
      works: "funziona",
      system: "sistema",
      phone: "telefono",
      app: "app",
    },
  };
  const dictionary = dictionaries[`${source}-${targetLang}`];
  if (!dictionary) return `[translation offline fallback unavailable for ${getTranslationLangLabel(source)} to ${getTranslationLangLabel(targetLang)}] ${text}`;
  let translated = text;
  Object.entries(dictionary)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([from, to]) => {
      translated = translated.replace(new RegExp(`\\b${from}\\b`, "gi"), to);
    });
  return translated;
};

const translateTextOnline = async (text: string, sourceLang: TranslationLang, targetLang: TranslationLang) => {
  const source = sourceLang === "auto" ? detectTranslationLang(text) : sourceLang;
  if (source === targetLang) return { text, source: "same-language", sourceLang: source };
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 9000);
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`${source}|${targetLang}`)}`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`translation ${response.status}`);
    const payload = await response.json();
    const translated = String(payload?.responseData?.translatedText || "").trim();
    if (!translated) throw new Error("empty translation");
    return { text: translated, source: "online", sourceLang: source };
  } finally {
    window.clearTimeout(timer);
  }
};

const DrawerSection = ({
  id,
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  id: DrawerId;
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: (id: DrawerId) => void;
  children: React.ReactNode;
}) => (
  <section className="rounded-[26px] border border-[#2a2c32] bg-[#151619] overflow-hidden">
    <button
      onClick={() => onToggle(id)}
      className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
    >
      <div className="min-w-0">
        <div className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-slate-200">{title}</div>
        <div className="mt-1 text-[10px] text-slate-500 truncate">{subtitle}</div>
      </div>
      <ChevronDown className={`w-4 h-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <div className="border-t border-[#2a2c32] px-4 py-4 space-y-4">{children}</div>}
  </section>
);

export default function SpinoLLMApp({ onNotify, onSystemAction }: SpinoLLMAppProps) {
  const [models, setModels] = useState<SpinoModelRecord[]>(() => ensureOptimizedSpinoModel(loadSpinoModels()));
  const [selectedModelId, setSelectedModelIdState] = useState(() => getSelectedSpinoModelId());
  const [profileId, setProfileIdState] = useState(() => getSelectedSpinoProfileId());
  const [indexState, setIndexState] = useState<SpinoIndexState>(() => loadSpinoIndex());
  const [runtimeStats, setRuntimeStats] = useState<SpinoRuntimeStats>({
    backend: window.PocketFlowReceiveBridge?.spinoGetRuntimeStats ? "Android bridge" : "WebView local index",
    loaded: false,
    message: "Local retrieval is ready. Native llama.cpp inference backend is not loaded.",
  });
  const [runtimeEndpointInput, setRuntimeEndpointInput] = useState("");
  const [indexProgress, setIndexProgress] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChatHistory());
  const [sources, setSources] = useState<SpinoSearchResult[]>([]);
  const [localOnly, setLocalOnly] = useState(() => loadBoolSetting(LOCAL_ONLY_KEY, false));
  const [allowGeneralKnowledge, setAllowGeneralKnowledge] = useState(() => loadBoolSetting(GENERAL_ALLOWED_KEY, true));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [dictationHoldEnabled, setDictationHoldEnabled] = useState(false);
  const [speechDraft, setSpeechDraft] = useState("");
  const [liveVoiceListening, setLiveVoiceListening] = useState(false);
  const [liveVoiceSpeaking, setLiveVoiceSpeaking] = useState(false);
  const [liveVoiceLevel, setLiveVoiceLevel] = useState(0.16);
  const [liveVoiceTick, setLiveVoiceTick] = useState(0);
  const [speechStatus, setSpeechStatus] = useState("");
  const [translatorActive, setTranslatorActive] = useState(false);
  const [translatorSourceLang, setTranslatorSourceLang] = useState<TranslationLang>("auto");
  const [translatorTargetLang, setTranslatorTargetLang] = useState<TranslationLang>("en");
  const [translatorInput, setTranslatorInput] = useState("");
  const [translatorOutput, setTranslatorOutput] = useState("");
  const [translatorStatus, setTranslatorStatus] = useState("Live translator ready.");
  const [translatorBusy, setTranslatorBusy] = useState(false);
  const [liveVoiceEnabled, setLiveVoiceEnabled] = useState(false);
  const [liveVoiceAwake, setLiveVoiceAwake] = useState(false);
  const [liveVoiceStatus, setLiveVoiceStatus] = useState("Live chat removed. Use transcription, then send when ready.");
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState(() => localStorage.getItem(ELEVENLABS_STORAGE_KEY) || "");
  const [elevenLabsStatus, setElevenLabsStatus] = useState(() =>
    localStorage.getItem(ELEVENLABS_STORAGE_KEY) ? "ElevenLabs standard voice ready." : "Android local voice fallback.",
  );
  const [downloadUrl, setDownloadUrl] = useState(SPINO_OPTIMIZED_MODEL_URL);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpinoSearchResult[]>([]);
  const [memoryNote, setMemoryNote] = useState("");
  const [learnedMemoryCount, setLearnedMemoryCount] = useState(() => loadLearnedMemories().length);
  const [experienceMemoryCount, setExperienceMemoryCount] = useState(() => loadBalossExperienceMemory().length);
  const [personalProfile, setPersonalProfile] = useState<SpinoPersonalProfile>(() => loadSpinoPersonalProfile());
  const [profileDraft, setProfileDraft] = useState<SpinoPersonalProfile>(() => loadSpinoPersonalProfile());
  const [showMePanel, setShowMePanel] = useState(false);
  const [taskSessions, setTaskSessions] = useState<SpinoTaskSession[]>(() => loadSpinoTaskSessions());
  const [activeTaskId, setActiveTaskIdState] = useState(() => getActiveSpinoTaskId());
  const [taskAgentMode, setTaskAgentMode] = useState<TaskAgentSelection>(() => {
    const stored = localStorage.getItem(TASK_AGENT_KEY) as TaskAgentSelection | null;
    return stored === "none" || SPINO_TASK_AGENT_PROFILES.some((profile) => profile.id === stored) ? stored : "none";
  });
  const [aetherStorage, setAetherStorage] = useState<AetherStorageStats | null>(null);
  const [intelSnapshot, setIntelSnapshot] = useState<SpinoIntelSnapshot>(() => loadSpinoIntelSnapshot());
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelStatus, setIntelStatus] = useState("");
  const [agentGatewaySnapshot, setAgentGatewaySnapshot] = useState<AgentGatewaySnapshot>(() => loadAgentGatewaySnapshot());
  const [agentGatewayLoading, setAgentGatewayLoading] = useState(false);
  const [agentGatewayStatus, setAgentGatewayStatus] = useState("");
  const [agentGatewayTokenInput, setAgentGatewayTokenInput] = useState("");
  const [agentGatewayTokenReady, setAgentGatewayTokenReady] = useState(() => hasStoredAgentGatewayToken());
  const [bigBrainEndpoint, setBigBrainEndpoint] = useState(() => localStorage.getItem(BIGBRAIN_ENDPOINT_KEY) || "http://127.0.0.1:7450");
  const [bigBrainStatus, setBigBrainStatus] = useState<BigBrainStatus>(() => emptyBigBrainStatus(localStorage.getItem(BIGBRAIN_ENDPOINT_KEY) || "http://127.0.0.1:7450"));
  const [bigBrainQuery, setBigBrainQuery] = useState("");
  const [bigBrainSearch, setBigBrainSearch] = useState<Array<{ title?: string; text?: string; path?: string; score?: number }>>([]);
  const [bigBrainBusy, setBigBrainBusy] = useState(false);
  const [showToolPanel, setShowToolPanel] = useState(false);
  const [showChatControls, setShowChatControls] = useState(false);
  const [selectedAgentReviewId, setSelectedAgentReviewId] = useState<string | null>(null);
  const [qualitySampleOutputById, setQualitySampleOutputById] = useState<Record<string, string>>({});
  const [qualitySampleMetaById, setQualitySampleMetaById] = useState<Record<string, QualitySampleMeta>>({});
  const [qualityLiveBusy, setQualityLiveBusy] = useState(false);
  const [qualityLiveStatus, setQualityLiveStatus] = useState("");
  const [qualityHistory, setQualityHistory] = useState<BalossQualityHistoryEntry[]>(() => loadBalossQualityHistory());
  const [qualityReport, setQualityReport] = useState<BalossQualityBenchmarkReport>(() =>
    runBalossQualityBenchmark({ dashboardCount: getAllDashboards().length }),
  );
  const [openDrawers, setOpenDrawers] = useState<Record<DrawerId, boolean>>({
    core: true,
    quality: false,
    intel: false,
    agent: false,
    agentHealth: false,
    automation: false,
    knowledge: false,
    bigbrain: false,
    archiveAgent: false,
    chatCleanup: false,
    memory: false,
  });
  const [archiveAgent, setArchiveAgent] = useState<ArchiveMaintenanceState>(() => loadArchiveMaintenanceState());
  const [archiveAgentBusy, setArchiveAgentBusy] = useState(false);
  const [chatCleanup, setChatCleanup] = useState<SpinoChatCleanupState>(() => loadSpinoChatCleanupState());
  const [chatCheckpoints, setChatCheckpoints] = useState<SpinoChatCheckpoint[]>(() => loadSpinoChatCheckpoints());
  const [chatCleanupBusy, setChatCleanupBusy] = useState(false);
  const [agentHealthReport, setAgentHealthReport] = useState<BalossAgentHealthReport>(() => loadBalossAgentHealthReport());
  const [agentHealthBusy, setAgentHealthBusy] = useState(false);
  const [durableJobs, setDurableJobs] = useState<BalossDurableJob[]>(() => loadBalossDurableJobs());
  const modelInputRef = useRef<HTMLInputElement>(null);
  const knowledgeInputRef = useRef<HTMLInputElement>(null);
  const taskFileInputRef = useRef<HTMLInputElement>(null);
  const taskFolderInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const isGeneratingRef = useRef(false);
  const generationStartedAtRef = useRef<number | null>(null);
  const isDictatingRef = useRef(false);
  const dictationHoldEnabledRef = useRef(false);
  const recognitionActiveRef = useRef(false);
  const dictatedPromptRef = useRef("");
  const liveVoiceEnabledRef = useRef(false);
  const liveVoiceAwakeRef = useRef(false);
  const liveVoiceListeningRef = useRef(false);
  const liveVoiceSpeakingRef = useRef(false);
  const liveQuietRetryRef = useRef(0);
  const liveListenTimerRef = useRef<number | null>(null);
  const dictationListenTimerRef = useRef<number | null>(null);
  const translatorActiveRef = useRef(false);
  const translatorListenTimerRef = useRef<number | null>(null);
  const runtimeAutoStartRef = useRef(false);
  const runtimeAutoStartAttemptRef = useRef(0);
  const browserRecognitionRef = useRef<any>(null);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const elevenLabsAudioRef = useRef<HTMLAudioElement | null>(null);
  const elevenLabsAudioUrlRef = useRef<string | null>(null);
  const nativeShell = Boolean(window.__pocketflowNativeShell);
  const activeTaskIdRef = useRef(activeTaskId);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) || models[0] || null,
    [models, selectedModelId],
  );
  const profile = getSpinoProfile(profileId);
  const activeTask = useMemo(
    () => taskSessions.find((session) => session.id === activeTaskId) || null,
    [activeTaskId, taskSessions],
  );
  const selectedTaskAgent = useMemo(
    () => (taskAgentMode === "none" ? null : getSpinoTaskAgentProfile(taskAgentMode)),
    [taskAgentMode],
  );
  const intelItemsByKind = useMemo(
    () =>
      intelSnapshot.items.reduce<Record<string, SpinoIntelItem[]>>((acc, item) => {
        acc[item.kind] = [...(acc[item.kind] || []), item];
        return acc;
      }, {}),
    [intelSnapshot.items],
  );
  const schedulerSummary = useMemo(() => summarizeBalossScheduler(durableJobs), [durableJobs]);
  const sortedDurableJobs = useMemo(
    () =>
      [...durableJobs].sort((a, b) => {
        const priorityDiff = b.priority - a.priority;
        const nextDiff = Date.parse(a.nextRunAt || "") - Date.parse(b.nextRunAt || "");
        if (a.status === "failed" && b.status !== "failed") return -1;
        if (b.status === "failed" && a.status !== "failed") return 1;
        return Number.isFinite(nextDiff) && nextDiff !== 0 ? nextDiff : priorityDiff;
      }),
    [durableJobs],
  );

  useEffect(() => {
    const refreshDurableJobs = () => setDurableJobs(loadBalossDurableJobs());
    window.addEventListener("pocketflow:baloss-durable-jobs-updated", refreshDurableJobs);
    window.addEventListener("pocketflow:newsletter-health-updated", refreshDurableJobs);
    window.addEventListener("storage", refreshDurableJobs);
    return () => {
      window.removeEventListener("pocketflow:baloss-durable-jobs-updated", refreshDurableJobs);
      window.removeEventListener("pocketflow:newsletter-health-updated", refreshDurableJobs);
      window.removeEventListener("storage", refreshDurableJobs);
    };
  }, []);

  const refreshOnlineIntel = async (force = false) => {
    if (!navigator.onLine) {
      setIntelStatus("Offline. Baloss LLM will keep the last public cache until it expires. Long-term learning is separate.");
      return loadSpinoIntelSnapshot();
    }
    setIntelLoading(true);
    setIntelStatus(force ? "Refreshing online sources..." : "Checking source freshness...");
    try {
      const next = await refreshSpinoIntel({ force });
      setIntelSnapshot(next);
      setIntelStatus(
        next.status === "fresh"
          ? `Fresh: ${next.items.length} items from ${next.sources.length} sources.`
          : next.status === "partial"
            ? `Partial refresh: ${next.items.length} items, ${next.errors.length} source issue${next.errors.length === 1 ? "" : "s"}.`
            : "Online sources did not answer yet.",
      );
      return next;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Online intelligence refresh failed.";
      setIntelStatus(message);
      return loadSpinoIntelSnapshot();
    } finally {
      setIntelLoading(false);
    }
  };

  const refreshAgentGateway = async () => {
    if (!navigator.onLine) {
      setAgentGatewayStatus("Offline. Tanuki gateway will refresh when internet is back.");
      return agentGatewaySnapshot;
    }
    setAgentGatewayLoading(true);
    setAgentGatewayStatus("Checking authorised Tanuki systems...");
    try {
      const next = await refreshAgentGatewaySnapshot();
      setAgentGatewaySnapshot(next);
      const down = next.systems.filter((system) => system.rating === "down").length;
      const slow = next.systems.filter((system) => system.rating === "slow").length;
      setAgentGatewayStatus(`${next.systems.length} systems rated. ${down} down, ${slow} slow.`);
      return next;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tanuki gateway refresh failed.";
      setAgentGatewayStatus(message);
      return agentGatewaySnapshot;
    } finally {
      setAgentGatewayLoading(false);
    }
  };

  const runAgentHealthCheck = (reason: "manual" | "scheduled" | "startup" = "manual") => {
    setAgentHealthBusy(true);
    try {
      const report = buildBalossAgentHealthReport({
        runtimeStats,
        indexState,
        intelSnapshot,
        agentGatewaySnapshot,
        archiveAgent,
        chatCleanup,
        learnedMemoryCount: learnedMemoryCount + experienceMemoryCount,
        localOnly,
        allowGeneralKnowledge,
        online: navigator.onLine,
        generating: isGenerating || Boolean(runtimeStats.generationActive),
      });
      setAgentHealthReport(report);
      if (reason === "manual") {
        onNotify?.(report.summary, report.blocked ? "warn" : report.degraded ? "info" : "success");
      }
      return report;
    } finally {
      setAgentHealthBusy(false);
    }
  };

  const saveAgentGatewayTokenFromInput = () => {
    const saved = saveAgentGatewayToken(agentGatewayTokenInput);
    setAgentGatewayTokenReady(saved || hasStoredAgentGatewayToken());
    setAgentGatewayTokenInput("");
    setAgentGatewayStatus(saved ? "Private gateway token saved on this device." : "Paste the private gateway token first.");
  };

  const forgetAgentGatewayToken = () => {
    clearAgentGatewayToken();
    setAgentGatewayTokenReady(false);
    setAgentGatewayStatus("Private gateway token removed from this device.");
  };

  const refreshBigBrainStatus = async (endpointOverride?: string) => {
    const endpoint = (endpointOverride || bigBrainEndpoint || "http://127.0.0.1:7450").replace(/\/+$/, "");
    setBigBrainBusy(true);
    localStorage.setItem(BIGBRAIN_ENDPOINT_KEY, endpoint);
    setBigBrainEndpoint(endpoint);
    try {
      const [healthResponse, storageResponse, modulesResponse] = await Promise.all([
        fetch(`${endpoint}/health`),
        fetch(`${endpoint}/storage`),
        fetch(`${endpoint}/modules`),
      ]);
      if (!healthResponse.ok || !storageResponse.ok || !modulesResponse.ok) {
        throw new Error("BigBrain bridge responded but one endpoint failed.");
      }
      const health = await healthResponse.json();
      const storage = await storageResponse.json();
      const modules = await modulesResponse.json();
      const cognee = await fetch(`${endpoint}/cognee/status`)
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null);
      const encyclopediaModule =
        (Array.isArray(modules?.modules) ? modules.modules : []).find((item: any) => /encyclopedia|tommyboy/i.test(`${item?.slot || ""} ${item?.name || ""}`)) ||
        (Array.isArray(modules?.modules) ? modules.modules[0] : null);
      const totalBytes = Number(storage?.total_bytes || storage?.totalBytes || 0);
      const freeBytes = Number(storage?.free_bytes || storage?.freeBytes || 0);
      const usedBytes = Number(storage?.used_bytes || storage?.usedBytes || Math.max(0, totalBytes - freeBytes));
      const moduleName = encyclopediaModule?.name || health?.module || "Tommyboy Encyclopedia Module";
      setBigBrainStatus({
        ok: true,
        checkedAt: new Date().toISOString(),
        endpoint,
        moduleName,
        mode: "bridge",
        totalBytes,
        usedBytes,
        freeBytes,
        message: "BigBrain mode active through the external memory bridge. Baloss can search, read, and cite connected Tommyboy data.",
        helperAgents: [
          { id: "health", title: "Memory Health Agent", status: "online", detail: "Bridge reachable. Tracks storage, manifests, checksums, and module presence." },
          { id: "scout", title: "Index Scout", status: "online", detail: "Uses bridge search before the main LLM, so Baloss asks less and gets cleaner context." },
          { id: "retriever", title: "Context Retriever", status: "online", detail: "Pulls short cited snippets from Tommyboy instead of loading raw multi-GB files." },
        ],
        cognee: cognee || emptyBigBrainStatus(endpoint).cognee,
      });
      return true;
    } catch (error) {
      setBigBrainStatus({
        ...emptyBigBrainStatus(endpoint),
        checkedAt: new Date().toISOString(),
        message: error instanceof Error ? error.message : "BigBrain bridge offline.",
        helperAgents: [
          { id: "health", title: "Memory Health Agent", status: "offline", detail: "Waiting for Tommyboy bridge or Android module mount." },
          { id: "scout", title: "Index Scout", status: "standby", detail: "Will activate when /search is reachable." },
          { id: "retriever", title: "Context Retriever", status: "standby", detail: "Will activate when /read is reachable." },
        ],
        cognee: emptyBigBrainStatus(endpoint).cognee,
      });
      return false;
    } finally {
      setBigBrainBusy(false);
    }
  };

  const searchBigBrain = async () => {
    const query = bigBrainQuery.trim();
    if (!query) return;
    const endpoint = (bigBrainEndpoint || "http://127.0.0.1:7450").replace(/\/+$/, "");
    setBigBrainBusy(true);
    try {
      const response = await fetch(`${endpoint}/search?q=${encodeURIComponent(query)}&module=encyclopedia&limit=5`);
      if (!response.ok) throw new Error("BigBrain search failed.");
      const data = await response.json();
      setBigBrainSearch(Array.isArray(data?.results) ? data.results : []);
    } catch (error) {
      setBigBrainSearch([
        {
          title: "Search unavailable",
          text: error instanceof Error ? error.message : "Tommyboy bridge search is offline.",
          path: endpoint,
        },
      ]);
    } finally {
      setBigBrainBusy(false);
    }
  };

  const ramGuard = canRunSpinoModelSafely(
    selectedModel,
    profile,
    runtimeStats.deviceMemoryAvailableMb,
    runtimeStats.swapFreeMb,
  );
  const spinoHeartbeat = useMemo(
    () =>
      buildSpinoHeartbeat({
        runtimeStats,
        indexState,
        intelSnapshot,
        learnedMemoryCount: learnedMemoryCount + experienceMemoryCount,
        localOnly,
        allowGeneralKnowledge,
        isGenerating,
        aetherMounted: Boolean(aetherStorage?.ok && aetherStorage.writable),
      }),
    [runtimeStats, indexState, intelSnapshot, learnedMemoryCount, experienceMemoryCount, localOnly, allowGeneralKnowledge, isGenerating, aetherStorage],
  );
  const conversationAudit = useMemo(
    () =>
      auditSpinoConversationStack({
        runtimeStats,
        indexState,
        intelSnapshot,
        learnedMemoryCount: learnedMemoryCount + experienceMemoryCount,
        localOnly,
        allowGeneralKnowledge,
        nativeShell,
      }),
    [runtimeStats, indexState, intelSnapshot, learnedMemoryCount, experienceMemoryCount, localOnly, allowGeneralKnowledge, nativeShell],
  );

  useEffect(() => {
    const checkIfDue = () => {
      const latest = loadBalossAgentHealthReport();
      if (isBalossAgentHealthDue(latest)) {
        runAgentHealthCheck(latest.checkedAt ? "scheduled" : "startup");
      }
    };
    checkIfDue();
    const timer = window.setInterval(checkIfDue, 60 * 1000);
    window.addEventListener("focus", checkIfDue);
    document.addEventListener("visibilitychange", checkIfDue);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", checkIfDue);
      document.removeEventListener("visibilitychange", checkIfDue);
    };
  }, [
    runtimeStats,
    indexState,
    intelSnapshot,
    agentGatewaySnapshot,
    archiveAgent,
    chatCleanup,
    learnedMemoryCount,
    experienceMemoryCount,
    localOnly,
    allowGeneralKnowledge,
    isGenerating,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => saveChatHistory(messages), 260);
    return () => window.clearTimeout(timer);
  }, [messages]);

  useEffect(() => {
    void refreshBigBrainStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_ONLY_KEY, String(localOnly));
  }, [localOnly]);

  useEffect(() => {
    localStorage.setItem(GENERAL_ALLOWED_KEY, String(allowGeneralKnowledge));
  }, [allowGeneralKnowledge]);

  useEffect(() => {
    localStorage.setItem(TASK_AGENT_KEY, taskAgentMode);
  }, [taskAgentMode]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages, isGenerating]);

  useEffect(() => {
    if (!isGenerating) {
      generationStartedAtRef.current = null;
      return;
    }
    generationStartedAtRef.current = Date.now();
    const timer = window.setTimeout(() => {
      if (!isGeneratingRef.current) return;
      setIsGenerating(false);
      setMessages((current) =>
        current.map((message) =>
          message.pending
            ? {
                ...message,
                content: message.content || "Stopped to keep the phone responsive. Try again with a shorter request.",
                pending: false,
                sourceLabel: message.sourceLabel || "Runtime guard",
              }
            : message,
        ),
      );
      void refreshNativeStats();
      onNotify?.("Baloss LLM was taking too long, so I stopped the stuck answer.", "warn");
    }, SPINO_CHAT_TIMEOUT_MS + 3500);
    return () => window.clearTimeout(timer);
  }, [isGenerating, onNotify]);

  useEffect(() => {
    const handler = () => setLearnedMemoryCount(loadLearnedMemories().length);
    window.addEventListener("pocketflow-life-memory-updated", handler);
    return () => window.removeEventListener("pocketflow-life-memory-updated", handler);
  }, []);

  useEffect(() => {
    const run = async () => {
      const current = loadSpinoIntelSnapshot();
      setIntelSnapshot(current);
      if (navigator.onLine && isSpinoIntelStale(current)) {
        await refreshOnlineIntel(false);
      }
    };
    void run();
    const timer = window.setInterval(() => {
      if (navigator.onLine) void refreshOnlineIntel(false);
    }, SPINO_INTEL_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const run = async () => {
      const current = loadAgentGatewaySnapshot();
      setAgentGatewaySnapshot(current);
      if (!navigator.onLine || !hasStoredAgentGatewayToken()) return;
      const fetchedAt = current.fetchedAt ? new Date(current.fetchedAt).getTime() : 0;
      const stale = !fetchedAt || Date.now() - fetchedAt > AGENT_GATEWAY_REFRESH_INTERVAL_MS;
      if (!current.systems.length || stale) {
        const next = await refreshAgentGatewaySnapshot();
        setAgentGatewaySnapshot(next);
        const down = next.systems.filter((system) => system.rating === "down").length;
        const slow = next.systems.filter((system) => system.rating === "slow").length;
        setAgentGatewayStatus(`${next.systems.length} Tanuki systems cached. ${down} down, ${slow} slow.`);
      }
    };
    void run();
    const timer = window.setInterval(() => {
      if (navigator.onLine && hasStoredAgentGatewayToken()) void run();
    }, AGENT_GATEWAY_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!archiveAgent.running || archiveAgentBusy) return;
    const checkDue = () => {
      if (!archiveAgent.running || archiveAgentBusy) return;
      const nextTime = archiveAgent.nextRunAt ? new Date(archiveAgent.nextRunAt).getTime() : 0;
      if (!nextTime || Date.now() >= nextTime) {
        void runArchiveAgentScan("scheduled");
      }
    };
    checkDue();
    const timer = window.setInterval(checkDue, 60 * 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archiveAgent.running, archiveAgent.nextRunAt, archiveAgentBusy]);

  useEffect(() => {
    if (!chatCleanup.enabled || chatCleanupBusy) return;
    const checkDue = () => {
      const result = runSpinoChatCleanup(false);
      setChatCleanup(loadSpinoChatCleanupState());
      setChatCheckpoints(loadSpinoChatCheckpoints());
      if (result.changed) {
        setMessages(loadChatHistory());
      }
    };
    checkDue();
    const timer = window.setInterval(checkDue, 5 * 60 * 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatCleanup.enabled, chatCleanup.cadenceHours, chatCleanupBusy]);

  useEffect(() => {
    const next = ensureOptimizedSpinoModel(models);
    if (next.length !== models.length) {
      persistModels(next);
      return;
    }
    if (!localStorage.getItem(QWEN_MODEL_DEFAULT_KEY)) {
      setSelectedModelIdState(SPINO_DEFAULT_MODEL.id);
      setSelectedSpinoModelId(SPINO_DEFAULT_MODEL.id);
      setProfileIdState(QWEN_DEFAULT_PROFILE);
      setSelectedSpinoProfileId(QWEN_DEFAULT_PROFILE);
      setDownloadUrl(SPINO_OPTIMIZED_MODEL_URL);
      localStorage.setItem(QWEN_MODEL_DEFAULT_KEY, "1");
      localStorage.setItem(STRONG_MODEL_DEFAULT_KEY, "1");
      return;
    }
    if (!localStorage.getItem(STRONG_MODEL_DEFAULT_KEY)) {
      const shouldUpgradeDefault =
        !selectedModelId ||
        selectedModelId === SPINO_SMALL_MODEL.id ||
        selectedModelId === SPINO_MISTRAL_MODEL.id ||
        SPINO_LEGACY_TINY_MODEL_IDS.has(selectedModelId);
      if (shouldUpgradeDefault) {
        setSelectedModelIdState(SPINO_OPTIMIZED_MODEL.id);
        setSelectedSpinoModelId(SPINO_OPTIMIZED_MODEL.id);
        setProfileIdState(QWEN_DEFAULT_PROFILE);
        setSelectedSpinoProfileId(QWEN_DEFAULT_PROFILE);
        setDownloadUrl(SPINO_OPTIMIZED_MODEL_URL);
      }
      localStorage.setItem(STRONG_MODEL_DEFAULT_KEY, "1");
      return;
    }
    if (!selectedModelId || SPINO_LEGACY_TINY_MODEL_IDS.has(selectedModelId)) {
      setSelectedModelIdState(SPINO_DEFAULT_MODEL.id);
      setSelectedSpinoModelId(SPINO_DEFAULT_MODEL.id);
      setProfileIdState(QWEN_DEFAULT_PROFILE);
      setSelectedSpinoProfileId(QWEN_DEFAULT_PROFILE);
      setDownloadUrl(SPINO_OPTIMIZED_MODEL_URL);
      return;
    }
    const selectedIsLegacyTiny = models.some(
      (model) =>
        model.id === selectedModelId &&
        (SPINO_LEGACY_TINY_MODEL_IDS.has(model.id) || SPINO_LEGACY_TINY_MODEL_NAMES.has(model.name)),
    );
    if (selectedIsLegacyTiny) {
      setSelectedModelIdState(SPINO_DEFAULT_MODEL.id);
      setSelectedSpinoModelId(SPINO_DEFAULT_MODEL.id);
      setProfileIdState(QWEN_DEFAULT_PROFILE);
      setSelectedSpinoProfileId(QWEN_DEFAULT_PROFILE);
      setDownloadUrl(SPINO_OPTIMIZED_MODEL_URL);
    }
  }, [models, selectedModelId]);

  const persistModels = (next: SpinoModelRecord[]) => {
    setModels(next);
    saveSpinoModels(next);
  };

  const selectSpinoModel = (modelId: string, profileOverride?: typeof profile.id) => {
    setSelectedModelIdState(modelId);
    setSelectedSpinoModelId(modelId);
    const nextProfile = profileOverride || (modelId === SPINO_OPTIMIZED_MODEL.id ? QWEN_DEFAULT_PROFILE : profile.id);
    setProfileIdState(nextProfile);
    setSelectedSpinoProfileId(nextProfile);
    setDownloadUrl(modelId === SPINO_OPTIMIZED_MODEL.id
      ? SPINO_OPTIMIZED_MODEL_URL
      : modelId === SPINO_MISTRAL_MODEL.id
        ? SPINO_MISTRAL_MODEL_URL
        : SPINO_SMALL_MODEL_URL);
    localStorage.setItem(STRONG_MODEL_DEFAULT_KEY, "1");
  };

  const toggleDrawer = (id: DrawerId) => {
    setOpenDrawers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const buildQualityReport = (sampleOutputById = qualitySampleOutputById) =>
    runBalossQualityBenchmark({
      dashboardCount: getAllDashboards().length,
      sampleOutputById,
    });

  const qualityDimensionLabel = (dimension: string) => dimension.replace(/_/g, " ");

  const qualityTrend = useMemo(() => getBalossQualityTrend(qualityHistory), [qualityHistory]);

  const refreshQualityReport = () => {
    setQualityReport(buildQualityReport());
  };

  const resetQualityHistory = () => {
    clearBalossQualityHistory();
    setQualityHistory([]);
    setQualityLiveStatus("Quality history cleared. Run Live Local to create a fresh baseline.");
  };

  const runLiveQualityBenchmark = async () => {
    if (qualityLiveBusy) return;
    setQualityLiveBusy(true);
    setQualityLiveStatus("Starting local Baloss answer samples...");
    const nextOutputs: Record<string, string> = {};
    const nextMeta: Record<string, QualitySampleMeta> = {};
    const baseSettings = loadPocketAISettings();
    const router = createPocketAIRouter({
      ...baseSettings,
      mode: "local_only",
      offlineMode: true,
      allowApiFallback: false,
      allowLocalFallback: true,
      perFeatureRouting: {
        ...baseSettings.perFeatureRouting,
        chat: "local_only",
        research_brief: "local_only",
        dashboard_generate: "local_only",
        grammar_rewrite: "local_only",
        translate: "local_only",
        plan_action: "local_only",
        execute_safe_action: "local_only",
      },
    });

    try {
      for (const item of BALOSS_QUALITY_BENCHMARK_CASES) {
        setQualityLiveStatus(`Running ${item.label}...`);
        const started = performance.now();
        try {
          const context = [
            "BALOSS LIVE QUALITY SAMPLE",
            "Answer the prompt normally. Do not mention this benchmark. Follow the active quality contract and keep the answer phone-readable.",
            wantsDashboardSpinoReply(item.prompt) ? buildDashboardLibraryContext() : "",
          ].filter(Boolean).join("\n\n");
          const response = await withSpinoTimeout(
            router.generate({
              taskType: item.expectedTaskType,
              prompt: item.prompt,
              context,
              localKnowledgeMode: false,
              privacyLevel: "public",
              maxTokens: item.expectedQualityTask === "dashboard" ? 520 : item.expectedQualityTask === "research" ? 420 : 220,
              temperature: item.expectedQualityTask === "grammar_syntax" || item.expectedQualityTask === "translation" ? 0.1 : 0.2,
              sourceFeature: "Baloss Quality Bench",
            }),
            28_000,
            `${item.label} live quality sample timed out.`,
          );
          nextOutputs[item.id] = response.error ? `Error: ${response.error}` : response.text;
          nextMeta[item.id] = {
            providerId: response.providerId,
            modelId: response.modelId,
            durationMs: Math.round(performance.now() - started),
            at: new Date().toISOString(),
            error: response.error,
          };
        } catch (error) {
          nextOutputs[item.id] = `Error: ${error instanceof Error ? error.message : "Live sample failed."}`;
          nextMeta[item.id] = {
            providerId: "baloss-live-bench",
            durationMs: Math.round(performance.now() - started),
            at: new Date().toISOString(),
            error: error instanceof Error ? error.message : "Live sample failed.",
          };
        }
        setQualitySampleOutputById({ ...nextOutputs });
        setQualitySampleMetaById({ ...nextMeta });
        setQualityReport(buildQualityReport(nextOutputs));
      }
      const finalReport = runBalossQualityBenchmark({
        dashboardCount: getAllDashboards().length,
        sampleOutputById: nextOutputs,
      });
      const historyEntry = buildBalossQualityHistoryEntry(finalReport, {
        sampleOutputById: nextOutputs,
        sampleMetaById: nextMeta,
      });
      setQualityHistory(saveBalossQualityHistoryEntry(historyEntry));
      setQualityReport(finalReport);
      setQualityLiveStatus(`Live local samples complete: ${finalReport.passed}/${finalReport.total} routes at ${finalReport.score}%.`);
      onNotify?.(`Baloss live quality bench: ${finalReport.score}%`, finalReport.score >= 85 ? "success" : "warn");
    } finally {
      setQualityLiveBusy(false);
    }
  };

  const toggleToolPanel = () => {
    setShowMePanel(false);
    setShowToolPanel((prev) => {
      const next = !prev;
      if (next) {
        setOpenDrawers({
          core: true,
          quality: true,
          intel: true,
          agent: true,
          agentHealth: true,
          automation: true,
          knowledge: true,
          bigbrain: true,
          archiveAgent: true,
          chatCleanup: true,
          memory: true,
        });
      }
      return next;
    });
  };

  const openMePanel = () => {
    setShowToolPanel(false);
    setProfileDraft(personalProfile);
    setShowMePanel(true);
  };

  const saveMePanel = () => {
    const next = saveSpinoPersonalProfile(profileDraft);
    saveSpinoProfileAsLearnedMemory(next);
    setPersonalProfile(next);
    setProfileDraft(next);
    setLearnedMemoryCount(loadLearnedMemories().length);
    setShowMePanel(false);
    onNotify?.("Baloss LLM personal profile saved.", "success");
  };

  const updateProfileField = (key: keyof SpinoPersonalProfile, value: string) => {
    setProfileDraft((current) => ({ ...current, [key]: value }));
  };

  const updateBusiness = (id: string, patch: Partial<SpinoBusinessProfile>) => {
    setProfileDraft((current) => ({
      ...current,
      businesses: current.businesses.map((business) => (business.id === id ? { ...business, ...patch } : business)),
    }));
  };

  const updateProfileLink = (id: string, patch: Partial<SpinoProfileLink>) => {
    setProfileDraft((current) => ({
      ...current,
      links: current.links.map((link) => (link.id === id ? { ...link, ...patch } : link)),
    }));
  };

  const persistArchiveAgent = (next: ArchiveMaintenanceState) => {
    setArchiveAgent(next);
    saveArchiveMaintenanceState(next);
    return next;
  };

  const listNativeArchiveFilesForAgent = async () => {
    try {
      return await window.PocketFlowReceiveBridge?.listNativeReceivedFiles?.() || [];
    } catch {
      return [];
    }
  };

  const runArchiveAgentScan = async (mode: "manual" | "scheduled" = "manual", stateOverride?: ArchiveMaintenanceState) => {
    if (archiveAgentBusy) return null;
    setArchiveAgentBusy(true);
    try {
      const nativeFiles = await listNativeArchiveFilesForAgent();
      const { state, result } = await runArchiveMaintenanceScan(stateOverride || archiveAgent, nativeFiles);
      setArchiveAgent(state);
      if (mode === "manual") onNotify?.(result.message, result.deleted.length ? "success" : "info");
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Archive maintenance scan failed.";
      const next = {
        ...archiveAgent,
        status: message,
      };
      persistArchiveAgent(next);
      onNotify?.(message, "warn");
      return null;
    } finally {
      setArchiveAgentBusy(false);
    }
  };

  const toggleArchiveAgentRunning = (running: boolean) => {
    const next = setArchiveMaintenanceRunning(archiveAgent, running);
    setArchiveAgent(next);
    onNotify?.(next.status, running ? "success" : "info");
  };

  const updateArchiveAgentCadence = (cadence: ArchiveMaintenanceCadence) => {
    const next = updateArchiveMaintenanceConfig(archiveAgent, { cadence });
    setArchiveAgent(next);
  };

  const runChatCleanupNow = async () => {
    if (chatCleanupBusy) return;
    setChatCleanupBusy(true);
    try {
      const result = runSpinoChatCleanup(true);
      setChatCleanup(loadSpinoChatCleanupState());
      setChatCheckpoints(result.checkpoints);
      setMessages(loadChatHistory());
      onNotify?.(result.message, result.changed ? "success" : "info");
    } finally {
      setChatCleanupBusy(false);
    }
  };

  const toggleChatCleanupRunning = (enabled: boolean) => {
    const next = updateSpinoChatCleanupState({
      enabled,
      lastResult: enabled ? "Chat cleanup agent enabled." : "Chat cleanup agent paused.",
    });
    setChatCleanup(next);
    onNotify?.(next.lastResult, enabled ? "success" : "info");
  };

  const updateChatCleanupCadence = (cadenceHours: number) => {
    const next = updateSpinoChatCleanupState({
      cadenceHours,
      lastResult: `Chat cleanup cadence set to every ${cadenceHours}h.`,
    });
    setChatCleanup(next);
  };

  const handleApproveArchiveGroup = async (groupId: string) => {
    const next = await approveArchiveDuplicateGroup(archiveAgent, groupId);
    setArchiveAgent(next);
    onNotify?.(next.status, "success");
  };

  const handleDismissArchiveGroup = (groupId: string) => {
    const next = dismissArchiveDuplicateGroup(archiveAgent, groupId);
    setArchiveAgent(next);
    onNotify?.(next.status, "info");
  };

  const handleArchiveThreatAction = async (fileId: string, action: "quarantine" | "block" | "override") => {
    const next =
      action === "quarantine"
        ? await quarantineArchiveThreat(archiveAgent, fileId)
        : action === "block"
          ? await blockArchiveThreat(archiveAgent, fileId)
          : await overrideArchiveThreat(archiveAgent, fileId);
    setArchiveAgent(next);
    onNotify?.(next.status, action === "override" ? "info" : "warn");
  };

  const selectTaskSession = (taskId: string) => {
    activeTaskIdRef.current = taskId;
    setActiveTaskIdState(taskId);
    setActiveSpinoTaskId(taskId);
    if (!taskId) {
      setTaskAgentMode("none");
      return;
    }
    const selected = taskSessions.find((session) => session.id === taskId) || loadSpinoTaskSessions().find((session) => session.id === taskId);
    const profile = getSpinoTaskAgentProfile(selected?.agentId || selected?.mode);
    if (profile) setTaskAgentMode(profile.id);
  };

  const createTaskSession = (mode: TaskAgentSelection = taskAgentMode, seed?: string) => {
    if (mode === "none") {
      selectTaskSession("");
      onNotify?.("Baloss LLM is in normal chat mode.", "info");
      return null;
    }
    const profile = getSpinoTaskAgentProfile(mode) || SPINO_TASK_AGENT_PROFILES[0];
    const session = createSpinoTaskSession(seed || profile.starter, profile.id);
    setTaskAgentMode(profile.id);
    setTaskSessions((prev) => upsertSpinoTaskSession(prev, session));
    selectTaskSession(session.id);
    onNotify?.(`${profile.shortLabel} chat started: ${session.title}`, "success");
    return session;
  };

  const createBuilderTaskSession = (seed = "Builder task") => {
    return createTaskSession("builder", seed);
  };

  const recordTaskTurn = (role: "user" | "assistant", content: string, taskId = activeTaskIdRef.current) => {
    if (!taskId || !content.trim()) return;
    setTaskSessions((prev) => appendSpinoTaskTurn(prev, taskId, role, content));
  };

  const ensureTaskSessionForPrompt = (prompt: string) => {
    const current = activeTaskIdRef.current
      ? taskSessions.find((session) => session.id === activeTaskIdRef.current)
      : null;
    if (current) return current;
    if (isWorkflowBuildCommand(prompt) || isBuilderTaskCommand(prompt)) return createBuilderTaskSession(prompt);
    if (isSpinoTaskChatCommand(prompt)) return createTaskSession(inferSpinoTaskModeFromPrompt(prompt), prompt);
    if (taskAgentMode !== "none" && /\b(start|new|create|open)\b.*\b(chat|task)\b/i.test(prompt)) {
      return createTaskSession(taskAgentMode, prompt);
    }
    return null;
  };

  const handleAttachTaskFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const task = activeTask || createTaskSession(taskAgentMode === "none" ? "builder" : taskAgentMode, "Task with uploaded instructions");
    if (!task) return;
    setIndexProgress("Indexing task files...");
    try {
      const { next, changed } = await indexSpinoFiles(files, indexState, (done, total, name) => {
        setIndexProgress(`${done}/${total} ${name}`);
      });
      setIndexState(next);
      const result = await addSpinoTaskAttachments(loadSpinoTaskSessions(), task.id, files);
      setTaskSessions(result.sessions);
      selectTaskSession(task.id);
      setIndexProgress("");
      onNotify?.(`Attached ${result.added} task file${result.added === 1 ? "" : "s"} and indexed ${changed}.`, "success");
    } catch (error) {
      setIndexProgress("");
      onNotify?.(error instanceof Error ? error.message : "Task file upload failed.", "warn");
    } finally {
      if (taskFileInputRef.current) taskFileInputRef.current.value = "";
      if (taskFolderInputRef.current) taskFolderInputRef.current.value = "";
    }
  };

  const handleCompileTaskWorkflow = async (taskId = activeTaskIdRef.current) => {
    const session = loadSpinoTaskSessions().find((item) => item.id === taskId);
    if (!session) {
      onNotify?.("Start a Builder task chat first.", "warn");
      return null;
    }
    const compiled = await compileSpinoTaskWorkflow(session);
    const workflowFile = new File([compiled.markdown], compiled.archiveFile.name, {
      type: "text/markdown",
      lastModified: Date.now(),
    });
    const { next } = await indexSpinoFiles([workflowFile], indexState);
    setIndexState(next);
    setTaskSessions(loadSpinoTaskSessions());
    rememberBalossBuilderWorkflow({
      prompt: session.turns.map((turn) => `${turn.role}: ${turn.content}`).join("\n").slice(0, 1800),
      projectName: compiled.project.projectName,
      boxCount: compiled.project.boxes.length,
      summary: `Compiled ${compiled.project.boxes.length} ordered Builder boxes from task chat "${session.title}".`,
    });
    setExperienceMemoryCount(loadBalossExperienceMemory().length);
    onNotify?.(`Workflow saved: ${compiled.project.boxes.length} Builder boxes in Archive.`, "success");
    return compiled;
  };

  const appendMessage = (role: ChatRole, content: string, pending = false, sourceLabel?: string) => {
    const message: ChatMessage = {
      id: `${role}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      role,
      content,
      createdAt: new Date().toISOString(),
      pending,
      sourceLabel,
    };
    setMessages((prev) => [...prev, message]);
    return message.id;
  };

  const updateMessage = (id: string, nextContent: string, pending = false, sourceLabel?: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === id
          ? {
              ...message,
              content: nextContent,
              pending,
              sourceLabel: sourceLabel ?? message.sourceLabel,
            }
          : message,
      ),
    );
  };

  const deferSpinoWork = (work: () => void | Promise<void>, delayMs = 160) => {
    window.setTimeout(() => {
      void Promise.resolve(work()).catch((error) => {
        console.warn("Deferred Baloss LLM work failed", error);
      });
    }, delayMs);
  };

  const streamAssistant = async (assistantId: string, text: string, sourceLabel?: string) => {
    updateMessage(assistantId, text, false, sourceLabel);
    recordTaskTurn("assistant", text);
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  };

  const refreshNativeStats = async () => {
    if (!window.PocketFlowReceiveBridge?.spinoGetRuntimeStats) return null;
    try {
      const result = await window.PocketFlowReceiveBridge.spinoGetRuntimeStats();
      setRuntimeStats({
        backend: result.backend || "Android bridge",
        loaded: !!result.loaded,
        loadedModelId: result.loadedModelId,
        installedModels: result.installedModels,
        modelFileInstalled: result.modelFileInstalled,
        modelFileBytes: result.modelFileBytes,
        modelFilePath: result.modelFilePath,
        runtimeEndpoint: result.runtimeEndpoint,
        runtimeKind: result.runtimeKind,
        nativeInferenceInstalled: result.nativeInferenceInstalled,
        phoneRuntimePackaged: result.phoneRuntimePackaged,
        phoneRuntimeOwned: result.phoneRuntimeOwned,
        phoneRuntimeStartedAt: result.phoneRuntimeStartedAt,
        phoneRuntimeModelPath: result.phoneRuntimeModelPath,
        generationActive: result.generationActive,
        queueDepth: result.queueDepth,
        tokensPerSecond: result.tokensPerSecond,
        estimatedMemoryMb: result.estimatedMemoryMb,
        deviceMemoryAvailableMb: result.deviceMemoryAvailableMb,
        swapFreeMb: result.swapFreeMb,
        memoryPressure: result.memoryPressure,
        aetherModelInstalled: result.aetherModelInstalled,
        recordAudioPermission: result.recordAudioPermission,
        speechRecognizerAvailable: result.speechRecognizerAvailable,
        speechTranscriptionAvailable: result.speechTranscriptionAvailable,
        speechOfflinePreferred: result.speechOfflinePreferred,
        aetherStorageMounted: result.aetherStorageMounted,
        aetherStorageWritable: result.aetherStorageWritable,
        semanticRetrievalReady: result.semanticRetrievalReady,
        vectorIndexWritable: result.vectorIndexWritable,
        toolBridgeReady: result.toolBridgeReady,
        approvedToolCount: result.approvedToolCount,
        fullControlHint: result.fullControlHint,
        crashed: result.crashed,
        health: result.health,
        lastError: result.lastError,
        message: result.message,
      });
      if (result.runtimeEndpoint) setRuntimeEndpointInput(result.runtimeEndpoint);
      return result;
    } catch {
      setRuntimeStats((prev) => ({ ...prev, message: "Native stats unavailable. WebView index remains active." }));
      return null;
    }
  };

  const refreshAetherStorage = async () => {
    if (!window.PocketFlowReceiveBridge?.spinoGetAetherStorageStats) {
      setAetherStorage({
        ok: false,
        mounted: false,
        writable: false,
        root: SPINO_DEFAULT_KNOWLEDGE_ROOT,
        totalBytes: 0,
        freeBytes: 0,
        usedBytes: 0,
        reserveBytes: 0,
        reserveFreeBytes: 0,
        folders: [],
        message: "Aether learning storage is available on the phone build.",
      });
      return;
    }
    try {
      const result = await window.PocketFlowReceiveBridge.spinoGetAetherStorageStats();
      setAetherStorage(result);
      if (result.ok && result.root && indexState.knowledgeRoot !== result.root) {
        handleSetKnowledgeRoot(result.root);
      }
    } catch {
      setAetherStorage((prev) => prev || null);
    }
  };

  const ensureSelectedPhoneRuntime = async (source: "auto" | "manual" = "auto") => {
    if (!nativeShell || !selectedModel) return null;
    if (!window.PocketFlowReceiveBridge?.spinoStartPhoneRuntime || !window.PocketFlowReceiveBridge?.spinoLoadModel) return null;
    if (runtimeAutoStartRef.current) return null;

    const now = Date.now();
    if (source === "auto" && now - runtimeAutoStartAttemptRef.current < 45000) return null;
    runtimeAutoStartRef.current = true;
    runtimeAutoStartAttemptRef.current = now;

    try {
      const stats = await refreshNativeStats();
      const guard = canRunSpinoModelSafely(
        selectedModel,
        profile,
        stats?.deviceMemoryAvailableMb ?? runtimeStats.deviceMemoryAvailableMb,
        stats?.swapFreeMb ?? runtimeStats.swapFreeMb,
      );

      if (!guard.ok) {
        setRuntimeStats((prev) => ({
          ...prev,
          loaded: false,
          estimatedMemoryMb: guard.estimatedMb,
          memoryPressure: "critical",
          health: "limit",
          message: `${guard.message} Baloss LLM will stay in retrieval mode until a lighter profile is selected.`,
        }));
        if (source === "manual") onNotify?.("Aether RAM guard blocked this model profile.", "warn");
        return null;
      }

      if (!stats?.nativeInferenceInstalled) {
        setRuntimeStats((prev) => ({
          ...prev,
          message: `Starting ${selectedModel.parameterClass || selectedModel.name} on the phone runtime...`,
        }));
        const startResult = await window.PocketFlowReceiveBridge.spinoStartPhoneRuntime(selectedModel.id, profile.id);
        if (startResult.runtimeEndpoint) setRuntimeEndpointInput(startResult.runtimeEndpoint);
        if (!startResult.ok) {
          setRuntimeStats((prev) => ({
            ...prev,
            nativeInferenceInstalled: false,
            loaded: false,
            health: "disconnected",
            message: startResult.message || "Phone runtime did not answer yet.",
          }));
          if (source === "manual") onNotify?.(startResult.message || "Phone runtime did not answer yet.", "warn");
          return startResult;
        }
      }

      const loadResult = await window.PocketFlowReceiveBridge.spinoLoadModel(selectedModel.id, profile.id);
      const nextStats = await refreshNativeStats();
      setRuntimeStats((prev) => ({
        ...prev,
        loaded: !!loadResult.loaded || !!nextStats?.loaded,
        loadedModelId: selectedModel.id,
        runtimeEndpoint: nextStats?.runtimeEndpoint || prev.runtimeEndpoint,
        runtimeKind: nextStats?.runtimeKind || prev.runtimeKind,
        estimatedMemoryMb: estimateModelMemoryMb(selectedModel, profile),
        message: loadResult.message || nextStats?.message || "Baloss LLM phone runtime is ready.",
      }));
      if (source === "manual") onNotify?.(loadResult.message || "Baloss LLM phone runtime is ready.", loadResult.ok ? "success" : "warn");
      return loadResult;
    } finally {
      runtimeAutoStartRef.current = false;
    }
  };

  useEffect(() => {
    void refreshAetherStorage();
    void refreshNativeStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nativeShell, selectedModel?.id, profile.id]);

  useEffect(() => {
    if (!nativeShell || !window.PocketFlowReceiveBridge?.spinoStopPhoneRuntime) return undefined;
    return () => {
      void window.PocketFlowReceiveBridge?.spinoStopPhoneRuntime?.();
    };
  }, [nativeShell]);

  useEffect(() => {
    if (!nativeShell || !runtimeStats.phoneRuntimeOwned || isGenerating || runtimeStats.generationActive) return undefined;
    if (!window.PocketFlowReceiveBridge?.spinoStopPhoneRuntime) return undefined;
    const timer = window.setTimeout(() => {
      void window.PocketFlowReceiveBridge?.spinoStopPhoneRuntime?.().then(() => refreshNativeStats());
    }, SPINO_NATIVE_IDLE_STOP_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nativeShell, runtimeStats.phoneRuntimeOwned, runtimeStats.generationActive, isGenerating]);

  const rememberConversationTurn = async (userText: string, assistantText: string) => {
    const experience = rememberBalossQa(userText, assistantText);
    if (experience) setExperienceMemoryCount(loadBalossExperienceMemory().length);
    if (!shouldPersistSpinoConversationTurn(userText, assistantText)) return;

    const body = [
      "PocketFlow Baloss LLM conversation memory",
      `Time: ${new Date().toISOString()}`,
      `Mode: ${localOnly ? "local_only" : "general_allowed"}`,
      "",
      `USER: ${userText}`,
      "",
      `BALOSS: ${assistantText}`,
    ].join("\n");

    try {
      await window.PocketFlowReceiveBridge?.spinoWriteConversationMemory?.(userText, assistantText);
    } catch {
      // Keep the web-side memory path alive even if the native helper is missing.
    }

    const blob = new File([body], `conversation-${Date.now()}.txt`, {
      type: "text/plain",
      lastModified: Date.now(),
    });
    const { next } = await indexSpinoFiles([blob], indexState);
    setIndexState(next);
  };

  const queueConversationMemory = (userText: string, assistantText: string) => {
    deferSpinoWork(() => rememberConversationTurn(userText, assistantText), 350);
  };

  const submitPrompt = async (rawPrompt?: string): Promise<string | null> => {
    const originalPrompt = (rawPrompt ?? question).trim();
    const normalizedPrompt = normalizeSpinoSpeechInput(originalPrompt);
    const trimmed = normalizedPrompt.text;
    if (!trimmed || isGenerating) return null;
    const cameFromDictation = Boolean(dictatedPromptRef.current && originalPrompt.includes(dictatedPromptRef.current));
    const taskForPrompt = ensureTaskSessionForPrompt(trimmed);

    setQuestion("");
    dictatedPromptRef.current = "";
    setSpeechStatus("");
    setSpeechDraft("");
    setIsGenerating(true);
    setSources([]);
    appendMessage("user", trimmed);
    if (taskForPrompt || activeTaskIdRef.current) {
      recordTaskTurn("user", trimmed, taskForPrompt?.id || activeTaskIdRef.current);
    }
    const assistantId = appendMessage("assistant", "", true);
    const route = classifySpinoIntent(trimmed, !localOnly && allowGeneralKnowledge && navigator.onLine);
    const includeSystemDiagnostics = wantsSpinoSystemDiagnostics(trimmed);
    const earlyConversationDecision = decideSpinoConversationMode(trimmed, {
      localOnly,
      allowGeneralKnowledge,
      online: navigator.onLine,
      hasLocalContext: false,
      routePrivacy: route.privacy,
      routeTaskType: route.taskType,
      profileMaxTokens: profile.maxAnswerTokens,
    });
    const reasoningEnvelope = includeSystemDiagnostics ? buildSpinoReasoningEnvelope(trimmed, route, spinoHeartbeat) : "";
    const plannedSystemAction = parseSpinoSystemAction(trimmed);
    const plannedServiceAgent = shouldUseBalossServiceAgent(trimmed);
    const plannedOnlineIntel =
      plannedServiceAgent ||
      earlyConversationDecision.shouldFetchOnlineIntel ||
      shouldUseSpinoOnlineIntel(trimmed) ||
      route.needsOnline ||
      /\b(search|research|google|look up|find|cerca|ricerca|news|market|weather|meteo|stock|crypto|train|trains|treno|treni|rail|departures)\b/i.test(trimmed);
    const plannedAgentGateway = shouldUseAgentGateway(trimmed);
    const noTouchAutomation = isWorkflowBuildCommand(trimmed) || !!plannedSystemAction || ["plan_action", "execute_safe_action", "builder_help"].includes(route.taskType);
    const guardedAutomation = noTouchAutomation || isHardAutomationTask(route.taskType, trimmed) || plannedOnlineIntel || plannedAgentGateway;
    const automationJob: PocketAutomationJob | null = guardedAutomation
      ? beginPocketAutomationJob({
          name: noTouchAutomation ? route.agentLabel || "Baloss LLM action" : "Baloss research",
          mode: noTouchAutomation ? "no_touch" : "background",
          taskType: route.taskType,
          estimatedMs: noTouchAutomation ? 14_000 : 7_000,
          message: noTouchAutomation ? "Protected action running." : "Background research running.",
        })
      : null;
    let automationSucceeded = false;
    let automationMessage = "";

    try {
      if (isCasualHealthPrompt(trimmed)) {
        const responseText = buildNaturalSpinoStatusReply({
          runtimeStats,
          heartbeat: spinoHeartbeat,
          efficiencyRatio,
        });
        await streamAssistant(assistantId, responseText, "Baloss LLM health");
        queueConversationMemory(trimmed, responseText);
        automationSucceeded = true;
        automationMessage = responseText;
        return responseText;
      }

      if (plannedServiceAgent) {
        const serviceAnswer = await answerFromBalossServiceAgent(trimmed);
        if (serviceAnswer) {
          const responseText = compactSpinoChatReply(serviceAnswer.answer, trimmed, serviceAnswer.answer.length > 520 ? 980 : undefined);
          await streamAssistant(assistantId, responseText, serviceAnswer.sourceLabel);
          queueConversationMemory(trimmed, responseText);
          if (serviceAnswer.ok) onNotify?.("Baloss LLM used the service agent.", "success");
          automationSucceeded = serviceAnswer.ok;
          automationMessage = responseText;
          return responseText;
        }
      }

      const campaignMoltbookStatus = buildCampaignAndMoltbookStatusReply(trimmed);
      if (campaignMoltbookStatus) {
        await streamAssistant(assistantId, campaignMoltbookStatus, "Baloss operations status");
        queueConversationMemory(trimmed, campaignMoltbookStatus);
        automationSucceeded = true;
        automationMessage = campaignMoltbookStatus;
        return campaignMoltbookStatus;
      }

      if (wantsBalossAgentHealth(trimmed)) {
        const activeReport = isBalossAgentHealthDue(agentHealthReport)
          ? runAgentHealthCheck("manual")
          : agentHealthReport;
        const responseText = compactSpinoChatReply(answerFromBalossAgentHealth(activeReport), trimmed);
        await streamAssistant(assistantId, responseText, "Baloss agent supervisor");
        queueConversationMemory(trimmed, responseText);
        automationSucceeded = activeReport.blocked === 0;
        automationMessage = responseText;
        return responseText;
      }

      if (wantsBalossSystemStatus(trimmed)) {
        const activeReport = isBalossAgentHealthDue(agentHealthReport)
          ? runAgentHealthCheck("manual")
          : agentHealthReport;
        const responseText = compactSpinoChatReply(answerFromBalossSystemStatus(activeReport, trimmed), trimmed);
        await streamAssistant(assistantId, responseText, "Baloss system status");
        queueConversationMemory(trimmed, responseText);
        automationSucceeded = activeReport.blocked === 0;
        automationMessage = responseText;
        return responseText;
      }

      if (isWorkflowBuildCommand(trimmed)) {
        const compiled = await handleCompileTaskWorkflow(taskForPrompt?.id || activeTaskIdRef.current);
        if (compiled) {
          const responseText = compactSpinoChatReply(
            `Workflow built and saved. ${compiled.project.boxes.length} ordered Builder boxes were created in "${compiled.project.projectName}", and the handoff package is in Archive under Projects.`,
            trimmed,
          );
          await streamAssistant(assistantId, responseText, "Builder Task Agent");
          queueConversationMemory(trimmed, responseText);
          automationSucceeded = true;
          automationMessage = "Workflow package saved to Builder and Archive.";
          return responseText;
        }
      }

      const archiveCommand = parseArchiveMaintenanceCommand(trimmed);
      if (archiveCommand) {
        let responseText = "";
        if (archiveCommand.type === "stop") {
          const next = setArchiveMaintenanceRunning(archiveAgent, false);
          setArchiveAgent(next);
          responseText = "Archive agent stopped. Nothing will be deleted until you restart it.";
        } else {
          let next = archiveAgent;
          const validCadence = ARCHIVE_MAINTENANCE_CADENCES.some((item) => item.value === archiveCommand.cadence);
          if (validCadence && archiveCommand.cadence) {
            next = updateArchiveMaintenanceConfig(next, { cadence: archiveCommand.cadence });
          }
          next = setArchiveMaintenanceRunning(next, true);
          setArchiveAgent(next);
          const result = await runArchiveAgentScan("manual", next);
          responseText = result
            ? `${result.message} Cadence: ${ARCHIVE_MAINTENANCE_CADENCES.find((item) => item.value === next.config.cadence)?.label || "custom"}.`
            : `Archive agent started. Cadence: ${ARCHIVE_MAINTENANCE_CADENCES.find((item) => item.value === next.config.cadence)?.label || "custom"}.`;
        }
        responseText = compactSpinoChatReply(responseText, trimmed);
        await streamAssistant(assistantId, responseText, "Archive maintenance");
        queueConversationMemory(trimmed, responseText);
        automationSucceeded = true;
        automationMessage = responseText;
        return responseText;
      }

      const lifeMemoryAction = handleLifeMemoryPrompt(trimmed);
      if (lifeMemoryAction) {
        const responseText = compactSpinoChatReply(lifeMemoryAction.response, trimmed);
        await streamAssistant(assistantId, responseText, route.agentLabel);
        queueConversationMemory(trimmed, responseText);
        if (lifeMemoryAction.type === "calendar_added") {
          onNotify?.("Baloss LLM added this to Calendar.", "success");
        } else if (lifeMemoryAction.type === "calendar_removed") {
          onNotify?.("Baloss LLM removed this from Calendar.", "info");
        } else if (lifeMemoryAction.type === "calendar_moved") {
          onNotify?.("Baloss LLM moved this Calendar event.", "success");
        } else if (lifeMemoryAction.type === "note_added") {
          onNotify?.("Baloss LLM saved this in Notes.", "success");
        } else if (lifeMemoryAction.type === "memory_saved") {
          setLearnedMemoryCount(loadLearnedMemories().length);
          onNotify?.("Baloss LLM learned this locally.", "success");
        } else if (lifeMemoryAction.type === "memory_answer") {
          onNotify?.("Baloss LLM searched local memory.", "info");
        }
        automationSucceeded = true;
        automationMessage = responseText;
        return responseText;
      }

      const newsCommand = handleSpinoNewsCommand(trimmed);
      if (newsCommand) {
        const responseText = compactSpinoChatReply(newsCommand.response, trimmed);
        await streamAssistant(assistantId, responseText, newsCommand.sourceLabel);
        queueConversationMemory(trimmed, responseText);
        onNotify?.("Baloss LLM saved news into Notes.", "success");
        automationSucceeded = true;
        automationMessage = responseText;
        return responseText;
      }

      const systemAction = plannedSystemAction;
      if (systemAction) {
        const result = onSystemAction
          ? await onSystemAction(systemAction)
          : { ok: false, response: systemAction.response };
        const responseText = compactSpinoChatReply(result.response || systemAction.response, trimmed);
        await streamAssistant(assistantId, responseText, "PocketFlow system tools");
        queueConversationMemory(trimmed, responseText);
        onNotify?.(responseText, result.ok ? "success" : "info");
        automationSucceeded = !!result.ok;
        automationMessage = responseText;
        return responseText;
      }

      let activeAgentGateway = agentGatewaySnapshot;
      if (plannedAgentGateway) {
        activeAgentGateway = await refreshAgentGateway();
        if (!activeAgentGateway.systems.length && activeAgentGateway.errors.some((error) => /token missing/i.test(error))) {
          const responseText = compactSpinoChatReply("Tanuki gateway token is not set on this device. Open Tools > Online Intel and paste the private token once.", trimmed);
          await streamAssistant(assistantId, responseText, "Tanuki agent gateway");
          queueConversationMemory(trimmed, responseText);
          automationSucceeded = false;
          automationMessage = responseText;
          return responseText;
        }
        if (/\b(rating|ratings|health|status|online|down|slow|check)\b/i.test(trimmed)) {
          const responseText = compactSpinoChatReply(answerFromAgentGateway(activeAgentGateway), trimmed);
          await streamAssistant(assistantId, responseText, "Tanuki agent gateway");
          queueConversationMemory(trimmed, responseText);
          onNotify?.("Baloss LLM checked authorised Tanuki system ratings.", "success");
          automationSucceeded = true;
          automationMessage = "Tanuki gateway ratings refreshed.";
          return responseText;
        }
      }

      const wantsOnlineIntel = plannedOnlineIntel;
      let activeIntel = intelSnapshot;
      let researchItems: SpinoIntelItem[] = [];
      if (navigator.onLine && (wantsOnlineIntel || (!localOnly && allowGeneralKnowledge && isSpinoIntelStale(activeIntel)))) {
        activeIntel = await refreshOnlineIntel(wantsOnlineIntel && isSpinoIntelStale(activeIntel, 5 * 60 * 1000));
      }
      if (navigator.onLine && /\b(search|research|google|look up|find|cerca|ricerca)\b/i.test(trimmed)) {
        try {
          researchItems = await fetchSpinoResearchItems(trimmed);
        } catch {
          researchItems = [];
        }
      }
      if (route.taskType === "news") {
        const newsAnswer = answerFromSpinoNewsMemory(trimmed, 8);
        if (newsAnswer) {
          const responseText = compactSpinoChatReply(newsAnswer.response, trimmed);
          await streamAssistant(assistantId, responseText, newsAnswer.sourceLabel);
          queueConversationMemory(trimmed, responseText);
          onNotify?.("Baloss LLM answered from News Flow.", "info");
          automationSucceeded = true;
          automationMessage = "News Flow answer completed.";
          return responseText;
        }
      }
      const onlineAnswer = wantsOnlineIntel ? answerFromSpinoIntel(trimmed, activeIntel, researchItems) : null;
      if (onlineAnswer) {
        const responseText = compactSpinoChatReply(onlineAnswer, trimmed);
        await streamAssistant(assistantId, responseText, researchItems.length ? `${route.agentLabel} + live intel` : route.agentLabel);
        queueConversationMemory(trimmed, responseText);
        onNotify?.("Baloss LLM used fresh online intelligence.", "info");
        automationSucceeded = true;
        automationMessage = "Online intelligence refreshed.";
        return responseText;
      }

      const wantsNewsContext = /\b(news|article|headline|notizie|giornali|articolo|wired|openai|anthropic|torino|milano|geopolitics|markets?)\b/i.test(trimmed);
      const wantsDeepLocalContext =
        includeSystemDiagnostics ||
        route.taskType !== "chat" ||
        isWorkflowBuildCommand(trimmed) ||
        isBuilderTaskCommand(trimmed) ||
        wantsNewsContext ||
        /\b(remember|memory|recall|previous|old chat|old conversation|what did i tell|what do you know about me|project history|checkpoint|archive|file|document|reader|builder|calendar|note|moltbook|campaign|newsletter|system|health|status|agent|automation)\b/i.test(trimmed);
      const rawResults = wantsDeepLocalContext ? searchSpinoIndex(trimmed, indexState, profile.topK) : [];
      const results = filterSpinoResultsForChat(trimmed, rawResults);
      const learnedMemoryContext = wantsDeepLocalContext ? buildSpinoLearnedMemoryContext(trimmed, 8) : "";
      const experienceMemoryContext = wantsDeepLocalContext ? buildBalossExperienceContext(trimmed, 6) : "";
      const shouldUseCheckpointContext =
        includeSystemDiagnostics ||
        isWorkflowBuildCommand(trimmed) ||
        isBuilderTaskCommand(trimmed) ||
        /\b(remember|memory|recall|previous|old chat|old conversation|what did i tell|what do you know about me|project history|checkpoint)\b/i.test(trimmed);
      const checkpointContext = shouldUseCheckpointContext ? buildSpinoCheckpointContext(trimmed, 4) : "";
      const personalProfileContext = wantsDeepLocalContext ? buildSpinoPersonalProfileContext(personalProfile) : "";
      const newsMemoryContext = wantsNewsContext ? buildSpinoNewsContext(trimmed, 8) : "";
      const conversationDecision = decideSpinoConversationMode(trimmed, {
        localOnly,
        allowGeneralKnowledge,
        online: navigator.onLine,
        hasLocalContext: Boolean(results.length || learnedMemoryContext),
        routePrivacy: route.privacy,
        routeTaskType: route.taskType,
        profileMaxTokens: profile.maxAnswerTokens,
      });
      setSources(results);
      const pocketAISettings = loadPocketAISettings();
      const router = createPocketAIRouter({
        ...pocketAISettings,
        mode: conversationDecision.allowApiReasoning ? "auto_privacy" : "hybrid_local_first",
        allowLocalFallback: true,
        blockLocalFilesToApi: true,
        blockMemoryToApi: true,
        blockNotesToApi: true,
        perFeatureRouting: {
          ...pocketAISettings.perFeatureRouting,
          chat: conversationDecision.allowApiReasoning ? "auto_privacy" : "hybrid_local_first",
          system_search: conversationDecision.allowApiReasoning ? "hybrid_api_first" : "local_only",
          research_brief: conversationDecision.allowApiReasoning ? "hybrid_api_first" : "local_only",
          local_knowledge_qa: conversationDecision.allowApiReasoning ? "hybrid_local_first" : "local_only",
          dashboard_generate: "hybrid_local_first",
          grammar_rewrite: conversationDecision.allowApiReasoning ? "hybrid_local_first" : "local_only",
          translate: conversationDecision.allowApiReasoning ? "hybrid_local_first" : "local_only",
          plan_action: "local_only",
          execute_safe_action: "local_only",
          memory_add: "local_only",
          note_create: "local_only",
        },
      });
      const indexedContext = results.map((result, index) => `[${index + 1}] ${result.document.title}\n${result.chunk.text}`).join("\n\n");
      const onlineContext = wantsDeepLocalContext && !localOnly && allowGeneralKnowledge ? buildSpinoIntelContextForPrompt(trimmed, activeIntel, 16) : "";
      const agentGatewayContext = wantsDeepLocalContext && activeAgentGateway.systems.length
        ? buildAgentGatewayContext(activeAgentGateway, plannedAgentGateway ? 17 : 8)
        : "";
      const dictationContext = cameFromDictation || normalizedPrompt.changed
        ? buildDictationUnderstandingContext(originalPrompt)
        : "";
      const conversationCoreContext = buildSpinoConversationCoreContext(trimmed, conversationDecision, conversationAudit);
      const dashboardLibraryContext = wantsDashboardSpinoReply(trimmed) ? buildDashboardLibraryContext() : "";
      const agentHealthContext = wantsDeepLocalContext ? buildBalossAgentHealthContext(agentHealthReport, 8) : "";
      const activeTaskForContext =
        taskForPrompt ||
        (activeTaskIdRef.current ? loadSpinoTaskSessions().find((session) => session.id === activeTaskIdRef.current) : null) ||
        activeTask;
      const taskAgentForContext = getSpinoTaskAgentProfile(activeTaskForContext?.agentId || activeTaskForContext?.mode) || selectedTaskAgent;
      const learningContext = wantsDeepLocalContext
        ? buildSpinoLearningContext(trimmed, {
            activeTask: activeTaskForContext,
            selectedTaskAgent: taskAgentForContext,
          })
        : "";
      const bigBrainContext = wantsDeepLocalContext && bigBrainStatus.ok
        ? [
            "BIGBRAIN EXTERNAL MEMORY",
            `${bigBrainStatus.moduleName} is connected through ${bigBrainStatus.endpoint}.`,
            `Approx drive usage: ${formatSpinoBytes(bigBrainStatus.usedBytes)} used, ${formatSpinoBytes(bigBrainStatus.freeBytes)} free. Target knowledge fill: ${formatSpinoBytes(BIGBRAIN_TARGET_BYTES)}.`,
            "Use this module as offline general knowledge and research memory. Prefer bridge search/read results, cite sources when available, and keep answers brief unless the user asks for a deep report.",
            `Helper agents online: ${bigBrainStatus.helperAgents.filter((agent) => agent.status === "online").map((agent) => agent.title).join(", ") || "none"}.`,
          ].join("\n")
        : "";
      const context = [
        dictationContext,
        conversationCoreContext,
        learningContext,
        experienceMemoryContext,
        reasoningEnvelope,
        personalProfileContext,
        learnedMemoryContext ? `LOCAL BALOSS MEMORY\n${learnedMemoryContext}` : "",
        checkpointContext,
        dashboardLibraryContext,
        newsMemoryContext,
        agentHealthContext,
        agentGatewayContext,
        bigBrainContext,
        onlineContext,
        indexedContext,
      ].filter(Boolean).join("\n\n");
      const response = await withSpinoTimeout(
        router.generate({
          taskType: conversationDecision.taskType,
          prompt: trimmed,
          context,
          localKnowledgeMode: conversationDecision.localKnowledgeMode,
          allowedTools: route.allowedTools,
          actionIntent: `${route.primaryAgentId}:${route.taskType}`,
          privacyLevel: learnedMemoryContext ? "memory" : conversationDecision.privacyLevel,
          maxTokens: conversationDecision.maxTokens,
          temperature: conversationDecision.temperature,
          sourceFeature: "Baloss LLM",
        }),
        SPINO_CHAT_TIMEOUT_MS,
        "Baloss LLM took too long and was stopped so the phone stays responsive.",
      );

      const answerText = compactSpinoChatReply(response.error || response.text || "No answer generated.", trimmed);
      const sourceParts = [
        learnedMemoryContext ? "Baloss LLM memory" : "",
        onlineContext ? "144h online intel" : "",
        conversationDecision.mode === "public_general" ? "general reasoning" : "",
        results.length > 0 ? `${results.length} local source${results.length === 1 ? "" : "s"}` : "",
      ].filter(Boolean);
      const sourceLabel = sourceParts.length ? `${route.agentLabel} / ${sourceParts.join(" + ")}` : route.agentLabel;
      await streamAssistant(assistantId, answerText, sourceLabel);
      queueConversationMemory(trimmed, answerText);
      automationSucceeded = !response.error;
      automationMessage = answerText || "Baloss LLM answer completed.";
      return answerText;
    } catch (error) {
      const message = compactSpinoChatReply(error instanceof Error ? error.message : "Baloss LLM could not complete this request.", trimmed);
      await streamAssistant(assistantId, message, "Runtime error");
      onNotify?.(message, "warn");
      automationSucceeded = false;
      automationMessage = message;
      return message;
	    } finally {
	      setMessages((current) =>
	        current.map((message) =>
	          message.id === assistantId && message.pending
	            ? {
	                ...message,
	                content: message.content || "Stopped before completing. Try again with a shorter request.",
	                pending: false,
	                sourceLabel: message.sourceLabel || "Timeout guard",
	              }
	            : message,
	        ),
	      );
	      if (automationJob && !isPocketAutomationStopRequested(automationJob.id)) {
        if (automationSucceeded) {
          completePocketAutomationJob(automationJob, automationMessage || `${automationJob.name} completed.`);
        } else {
          failPocketAutomationJob(automationJob, automationMessage || `${automationJob.name} failed.`);
        }
      }
      setIsGenerating(false);
    }
  };

  const clearLiveListenTimer = () => {
    if (liveListenTimerRef.current !== null) {
      window.clearTimeout(liveListenTimerRef.current);
      liveListenTimerRef.current = null;
    }
  };

  const clearDictationListenTimer = () => {
    if (dictationListenTimerRef.current !== null) {
      window.clearTimeout(dictationListenTimerRef.current);
      dictationListenTimerRef.current = null;
    }
  };

  const clearTranslatorListenTimer = () => {
    if (translatorListenTimerRef.current !== null) {
      window.clearTimeout(translatorListenTimerRef.current);
      translatorListenTimerRef.current = null;
    }
  };

  const appendTranscriptToPrompt = (transcript: string) => {
    const normalized = normalizeSpinoSpeechInput(transcript);
    const clean = normalized.text;
    if (!clean) return;
    setQuestion((current) => {
      const existing = current.trim();
      const next = !existing
        ? clean
        : existing.toLowerCase().endsWith(clean.toLowerCase())
          ? current
          : `${existing} ${clean}`;
      dictatedPromptRef.current = next.trim();
      return next;
    });
  };

  const translateLiveTranscript = async (transcript: string) => {
    const normalized = normalizeSpinoSpeechInput(transcript);
    const clean = normalized.text;
    if (!clean) return;
    setTranslatorInput(clean);
    setTranslatorBusy(true);
    setTranslatorStatus(`Translating ${getTranslationLangLabel(translatorSourceLang)} to ${getTranslationLangLabel(translatorTargetLang)}...`);
    try {
      const result = await translateTextOnline(clean, translatorSourceLang, translatorTargetLang);
      setTranslatorOutput(result.text);
      setTranslatorStatus(
        result.source === "same-language"
          ? "Source and target are the same language."
          : `Translated live from ${getTranslationLangLabel(result.sourceLang as TranslationLang)} to ${getTranslationLangLabel(translatorTargetLang)}.`,
      );
    } catch {
      const sourceLabel = getTranslationLangLabel(translatorSourceLang);
      const targetLabel = getTranslationLangLabel(translatorTargetLang);
      try {
        const router = createPocketAIRouter({
          ...loadPocketAISettings(),
          mode: "hybrid_local_first",
          allowLocalFallback: true,
          allowApiFallback: false,
        });
        const local = await router.generate({
          taskType: "translate",
          prompt: `Translate from ${sourceLabel} to ${targetLabel}. Return only the translated text.\n\n${clean}`,
          context: "Live translator fallback. Preserve meaning, tone, names, numbers, dates and formatting.",
          localKnowledgeMode: false,
          privacyLevel: "public",
          maxTokens: 260,
          temperature: 0.1,
          sourceFeature: "Baloss Live Translate",
        });
        if (local.text && !local.error) {
          setTranslatorOutput(local.text.trim());
          setTranslatorStatus(`Online translation failed. Baloss translated locally to ${targetLabel}.`);
        } else {
          throw new Error(local.error || "local translation empty");
        }
      } catch {
        const fallback = roughTranslationFallback(clean, translatorSourceLang, translatorTargetLang);
        setTranslatorOutput(fallback);
        setTranslatorStatus("Online and local translation failed. Showing rough dictionary fallback.");
      }
    } finally {
      setTranslatorBusy(false);
      if (translatorActiveRef.current) {
        clearTranslatorListenTimer();
        translatorListenTimerRef.current = window.setTimeout(() => {
          if (!translatorActiveRef.current || recognitionActiveRef.current) return;
          void handleStartDictation();
        }, 750);
      }
    }
  };

  const toggleLiveTranslator = async () => {
    const next = !translatorActiveRef.current;
    translatorActiveRef.current = next;
    setTranslatorActive(next);
    clearTranslatorListenTimer();
    if (!next) {
      await stopSpinoVoice();
      setTranslatorStatus("Live translator stopped.");
      setSpeechStatus("Translation microphone stopped.");
      isDictatingRef.current = false;
      setIsDictating(false);
      return;
    }
    liveVoiceEnabledRef.current = false;
    setLiveVoiceEnabled(false);
    dictationHoldEnabledRef.current = false;
    setDictationHoldEnabled(false);
    clearLiveListenTimer();
    clearDictationListenTimer();
    setTranslatorStatus("Live translator listening. Speak, then pause.");
    setSpeechStatus("Translation mic active. Speak, then pause.");
    await handleStartDictation();
  };

  const copyTranslationOutput = async () => {
    const text = translatorOutput.trim();
    if (!text) {
      onNotify?.("No translated text yet.", "warn");
      return;
    }
    await navigator.clipboard.writeText(text);
    onNotify?.("Translation copied.", "success");
  };

  const speakTranslationOutput = async () => {
    const text = translatorOutput.trim();
    if (!text) {
      onNotify?.("No translated text to speak.", "warn");
      return;
    }
    await speakSpino(text);
  };


  const stopElevenLabsAudio = () => {
    if (elevenLabsAudioRef.current) {
      elevenLabsAudioRef.current.pause();
      elevenLabsAudioRef.current.src = "";
      elevenLabsAudioRef.current = null;
    }
    if (elevenLabsAudioUrlRef.current) {
      URL.revokeObjectURL(elevenLabsAudioUrlRef.current);
      elevenLabsAudioUrlRef.current = null;
    }
  };

  const saveElevenLabsApiKey = (value: string) => {
    const next = value.trim();
    setElevenLabsApiKey(next);
    if (next) {
      localStorage.setItem(ELEVENLABS_STORAGE_KEY, next);
      setElevenLabsStatus("ElevenLabs standard voice ready.");
      onNotify?.("Baloss LLM voice set to ElevenLabs standard voice.", "success");
    } else {
      localStorage.removeItem(ELEVENLABS_STORAGE_KEY);
      setElevenLabsStatus("Android local voice fallback.");
      onNotify?.("ElevenLabs key removed. Baloss LLM will use local voice fallback.", "info");
    }
  };

  const speakWithElevenLabs = async (text: string): Promise<boolean> => {
    const apiKey = elevenLabsApiKey.trim() || localStorage.getItem(ELEVENLABS_STORAGE_KEY) || "";
    if (!apiKey || !navigator.onLine) return false;

    stopElevenLabsAudio();
    setElevenLabsStatus("Preparing ElevenLabs voice.");

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_STANDARD_VOICE_ID}?output_format=mp3_44100_128`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": apiKey,
          },
          body: JSON.stringify({
            text,
            model_id: ELEVENLABS_MODEL_ID,
            voice_settings: {
              stability: 0.45,
              similarity_boost: 0.82,
              style: 0.18,
              use_speaker_boost: true,
            },
          }),
        },
      );

      if (!response.ok) {
        setElevenLabsStatus(`ElevenLabs unavailable (${response.status}). Local voice fallback.`);
        return false;
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      elevenLabsAudioRef.current = audio;
      elevenLabsAudioUrlRef.current = audioUrl;
      audio.onended = () => {
        setElevenLabsStatus("ElevenLabs standard voice ready.");
        stopElevenLabsAudio();
        dispatchSpinoVoiceEvent({ phase: "done", message: "ElevenLabs voice finished." });
      };
      audio.onerror = () => {
        setElevenLabsStatus("ElevenLabs audio playback failed. Local voice fallback.");
        stopElevenLabsAudio();
        dispatchSpinoVoiceEvent({ phase: "error", message: "ElevenLabs audio playback failed." });
      };
      dispatchSpinoVoiceEvent({ phase: "start", message: "ElevenLabs voice speaking." });
      await audio.play();
      return true;
    } catch {
      setElevenLabsStatus("ElevenLabs request blocked. Local voice fallback.");
      stopElevenLabsAudio();
      return false;
    }
  };

  const speakSpino = async (text: string): Promise<boolean> => {
    const cleanText = text.replace(/\s+/g, " ").trim();
    if (!cleanText) return false;

    const elevenLabsSpoke = await speakWithElevenLabs(cleanText);
    if (elevenLabsSpoke) return true;

    if (window.PocketFlowReceiveBridge?.spinoSpeak) {
      const result = await window.PocketFlowReceiveBridge.spinoSpeak(cleanText);
      if (!result.ok && result.message) {
        setLiveVoiceStatus(result.message);
      }
      return result.ok;
    }

    if ("speechSynthesis" in window && "SpeechSynthesisUtterance" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = navigator.language || "en-US";
      utterance.rate = 0.96;
      utterance.pitch = 1;
      utterance.onend = () => {
        dispatchSpinoVoiceEvent({ phase: "done", message: "Browser voice finished." });
      };
      speechSynthesisRef.current = utterance;
      window.speechSynthesis.speak(utterance);
      return true;
    }

    return false;
  };

  const stopSpinoVoice = async () => {
    clearLiveListenTimer();
    clearDictationListenTimer();
    recognitionActiveRef.current = false;
    try {
      browserRecognitionRef.current?.abort?.();
    } catch {}
    browserRecognitionRef.current = null;
    liveVoiceListeningRef.current = false;
    setLiveVoiceListening(false);
    setLiveVoiceSpeaking(false);
    stopElevenLabsAudio();
    if (window.PocketFlowReceiveBridge?.spinoStopSpeechRecognition) {
      await window.PocketFlowReceiveBridge.spinoStopSpeechRecognition();
    }
    if (window.PocketFlowReceiveBridge?.spinoStopSpeaking) {
      await window.PocketFlowReceiveBridge.spinoStopSpeaking();
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const scheduleLiveListen = (delayMs = 700) => {
    clearLiveListenTimer();
    if (!liveVoiceEnabledRef.current || isGeneratingRef.current) return;
    liveListenTimerRef.current = window.setTimeout(() => {
      if (!liveVoiceEnabledRef.current || liveVoiceListeningRef.current || isGeneratingRef.current || liveVoiceSpeakingRef.current) return;
      void handleStartDictation();
    }, delayMs);
  };

  const scheduleDictationListen = (delayMs = 700) => {
    clearDictationListenTimer();
    if (!dictationHoldEnabledRef.current) return;
    dictationListenTimerRef.current = window.setTimeout(() => {
      if (!dictationHoldEnabledRef.current || liveVoiceEnabledRef.current || recognitionActiveRef.current) return;
      void handleStartDictation();
    }, delayMs);
  };

  const handleLiveTranscript = async (transcript: string) => {
    const normalized = transcript.toLowerCase().trim();
    const heardWake = /\b(hello|hey spino|spino|ciao)\b/.test(normalized);
    const heardStop = /\b(stop|sleep|standby|basta|fermati)\b/.test(normalized);

    if (heardStop) {
      setLiveVoiceAwake(false);
      liveVoiceAwakeRef.current = false;
      liveQuietRetryRef.current = 0;
      setLiveVoiceStatus("Standby. Say hello when you need me.");
      await speakSpino("Okay. I am on standby. Say hello when you need me.");
      return;
    }

    if (!liveVoiceAwakeRef.current) {
      if (heardWake) {
        setLiveVoiceAwake(true);
        liveVoiceAwakeRef.current = true;
        liveQuietRetryRef.current = 0;
        setLiveVoiceStatus("Awake. Ask me normally, or say stop.");
        await speakSpino("I am here.");
        return;
      }
      setLiveVoiceStatus("Live on. Standby for hello.");
      scheduleLiveListen(1800);
      return;
    }

    setLiveVoiceStatus(`Heard: ${transcript}`);
    const answer = await submitPrompt(transcript);
    if (answer) {
      setLiveVoiceStatus("Speaking answer...");
      const speaking = await speakSpino(answer);
      if (!speaking) {
        scheduleLiveListen(1400);
      }
    } else {
      scheduleLiveListen(1400);
    }
  };

  const toggleLiveVoice = async () => {
    const currentlyEnabled = liveVoiceEnabledRef.current;
    const next = !currentlyEnabled;
    setLiveVoiceEnabled(next);
    liveVoiceEnabledRef.current = next;
    if (!next) {
      setLiveVoiceAwake(false);
      liveVoiceAwakeRef.current = false;
      liveQuietRetryRef.current = 0;
      setLiveVoiceStatus("Live chat off.");
      await stopSpinoVoice();
      isDictatingRef.current = false;
      setIsDictating(false);
      return;
    }
    dictationHoldEnabledRef.current = false;
    setDictationHoldEnabled(false);
    clearDictationListenTimer();
    isDictatingRef.current = false;
    setIsDictating(false);
    setLiveVoiceAwake(true);
    liveVoiceAwakeRef.current = true;
    liveQuietRetryRef.current = 0;
    setLiveVoiceStatus("Live chat on. Speak normally, or say stop to pause.");
    scheduleLiveListen(250);
  };

  useEffect(() => {
    const browserSpeech = "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<SpeechResultDetail>).detail || {};
      liveVoiceListeningRef.current = false;
      setLiveVoiceListening(false);
      if (translatorActiveRef.current) {
        if (!detail.ok || !detail.transcript?.trim()) {
          recognitionActiveRef.current = false;
          isDictatingRef.current = true;
          setIsDictating(true);
          setSpeechDraft("");
          setTranslatorStatus(detail.message ? `${detail.message} Translator stays on; speak again.` : "Translator stays on. Speak again.");
          clearTranslatorListenTimer();
          translatorListenTimerRef.current = window.setTimeout(() => {
            if (!translatorActiveRef.current || recognitionActiveRef.current) return;
            void handleStartDictation();
          }, 850);
          return;
        }
        const transcript = detail.transcript.trim();
        if (detail.interim) {
          setSpeechDraft(transcript);
          setTranslatorInput(transcript);
          setTranslatorStatus(`Hearing: ${transcript}`);
          return;
        }
        recognitionActiveRef.current = false;
        isDictatingRef.current = true;
        setIsDictating(true);
        setSpeechDraft("");
        void translateLiveTranscript(transcript);
        return;
      }
      if (!detail.ok || !detail.transcript?.trim()) {
        const message = detail.message || "";
        recognitionActiveRef.current = false;
        if (!dictationHoldEnabledRef.current) {
          isDictatingRef.current = false;
          setIsDictating(false);
        } else {
          isDictatingRef.current = true;
          setIsDictating(true);
        }
        setSpeechDraft("");
        if (detail.message && !dictationHoldEnabledRef.current) {
          setSpeechStatus(detail.message);
          onNotify?.(detail.message, "warn");
        }
        if (dictationHoldEnabledRef.current) {
          setSpeechStatus(message ? `${message} Recording stays on; keep talking or tap mic to stop.` : "Recording stays on. Keep talking or tap mic to stop.");
          scheduleDictationListen(750);
        }
        return;
      }
      const transcript = detail.transcript.trim();
      if (detail.interim) {
        setSpeechDraft(transcript);
        setSpeechStatus(`Hearing: ${transcript}`);
        return;
      }
      recognitionActiveRef.current = false;
      if (dictationHoldEnabledRef.current) {
        isDictatingRef.current = true;
        setIsDictating(true);
      } else {
        isDictatingRef.current = false;
        setIsDictating(false);
      }
      setSpeechDraft("");
      const confidenceLabel = typeof detail.confidence === "number" && detail.confidence > 0
        ? `Voice ${Math.round(detail.confidence * 100)}%`
        : browserSpeech
          ? "Browser dictation"
          : "Phone dictation";
      appendTranscriptToPrompt(transcript);
      setSpeechStatus(
        dictationHoldEnabledRef.current
          ? `${confidenceLabel}: transcript added. Recording stays on.`
          : `${confidenceLabel}: transcript added. Review and tap Send.`,
      );
      if (dictationHoldEnabledRef.current) {
        scheduleDictationListen(650);
      }
    };

    window.addEventListener("pocketflow-speech-result", handler as EventListener);
    return () => window.removeEventListener("pocketflow-speech-result", handler as EventListener);
  }, [onNotify, nativeShell, dictationHoldEnabled]);

  useEffect(() => {
    isGeneratingRef.current = isGenerating;
    isDictatingRef.current = isDictating;
    dictationHoldEnabledRef.current = dictationHoldEnabled;
    liveVoiceEnabledRef.current = liveVoiceEnabled;
    liveVoiceAwakeRef.current = liveVoiceAwake;
    liveVoiceSpeakingRef.current = liveVoiceSpeaking;
    translatorActiveRef.current = translatorActive;
  }, [isGenerating, isDictating, dictationHoldEnabled, liveVoiceEnabled, liveVoiceAwake, liveVoiceSpeaking, translatorActive]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<SpinoVoiceDetail>).detail || {};
      if (detail.phase === "ready" && detail.message) {
        setLiveVoiceStatus(detail.message);
      }
      if (detail.phase === "start") {
        setLiveVoiceSpeaking(true);
        setLiveVoiceLevel(0.72);
        if (detail.message) setLiveVoiceStatus(detail.message);
      }
      if (detail.phase === "done" && liveVoiceEnabledRef.current) {
        setLiveVoiceSpeaking(false);
        setLiveVoiceLevel(liveVoiceAwakeRef.current ? 0.28 : 0.16);
        setLiveVoiceStatus(liveVoiceAwakeRef.current ? "Listening..." : "Standby listening for hello.");
        scheduleLiveListen(400);
      }
      if (detail.phase === "error") {
        setLiveVoiceSpeaking(false);
        setLiveVoiceStatus(detail.message || "Voice output unavailable.");
        if (liveVoiceEnabledRef.current) scheduleLiveListen(900);
      }
    };
    window.addEventListener("pocketflow-spino-voice", handler as EventListener);
    return () => window.removeEventListener("pocketflow-spino-voice", handler as EventListener);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<SpinoVoiceLevelDetail>).detail || {};
      if (typeof detail.level === "number" && liveVoiceEnabledRef.current) {
        setLiveVoiceLevel(Math.max(0.08, Math.min(1, detail.level)));
      }
    };
    window.addEventListener("pocketflow-spino-level", handler as EventListener);
    return () => window.removeEventListener("pocketflow-spino-level", handler as EventListener);
  }, []);

  useEffect(() => {
    if (!liveVoiceEnabled && !isGenerating) {
      setLiveVoiceTick(0);
      return;
    }
    const timer = window.setInterval(() => {
      setLiveVoiceTick((value) => value + 80);
      if (liveVoiceSpeaking) {
        setLiveVoiceLevel(0.38 + Math.random() * 0.5);
      } else if (isGenerating) {
        setLiveVoiceLevel(0.22 + Math.random() * 0.22);
      } else if (!liveVoiceListening) {
        setLiveVoiceLevel((value) => Math.max(0.12, value * 0.86));
      }
    }, 80);
    return () => window.clearInterval(timer);
  }, [liveVoiceEnabled, liveVoiceListening, liveVoiceSpeaking, isGenerating]);

  useEffect(() => () => {
    clearLiveListenTimer();
    clearDictationListenTimer();
    clearTranslatorListenTimer();
    translatorActiveRef.current = false;
    recognitionActiveRef.current = false;
    try {
      browserRecognitionRef.current?.abort?.();
    } catch {}
    browserRecognitionRef.current = null;
    stopElevenLabsAudio();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const handleImportModel = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".gguf")) {
      onNotify?.("Baloss LLM accepts GGUF model files only.", "warn");
      return;
    }
    let record = createSpinoModelRecord(file);
    if (window.PocketFlowReceiveBridge?.spinoRegisterImportedModel) {
      try {
        const native = await window.PocketFlowReceiveBridge.spinoRegisterImportedModel(file.name, file.size, record.path);
        if (native.ok && native.model) {
          record = {
            ...record,
            id: native.model.id,
            path: native.model.path,
            importedAt: native.model.importedAt,
            source: "nativeImport",
          };
        }
      } catch {
        // Keep local import metadata if the native helper is unavailable.
      }
    }
    const next = [...models.filter((model) => model.name !== record.name), record];
    persistModels(next);
    setSelectedModelIdState(record.id);
    setSelectedSpinoModelId(record.id);
    onNotify?.(`Imported model reference: ${record.name}`, "success");
  };

  const handleDeleteModel = async (modelId: string) => {
    if (window.PocketFlowReceiveBridge?.spinoDeleteModel) {
      try {
        await window.PocketFlowReceiveBridge.spinoDeleteModel(modelId);
      } catch {
        // Local registry update still happens below.
      }
    }
    const next = models.filter((model) => model.id !== modelId);
    persistModels(next);
    if (selectedModelId === modelId) {
      setSelectedModelIdState(next[0]?.id || "");
      setSelectedSpinoModelId(next[0]?.id || "");
    }
    onNotify?.("Model removed from Baloss LLM.", "info");
  };

  const handleSaveRuntimeEndpoint = async () => {
    if (!window.PocketFlowReceiveBridge?.spinoSetRuntimeEndpoint) {
      onNotify?.("Runtime endpoint control is available only inside the installed phone app.", "warn");
      return;
    }
    const result = await window.PocketFlowReceiveBridge.spinoSetRuntimeEndpoint(runtimeEndpointInput.trim());
    await refreshNativeStats();
    onNotify?.(result.message || "Baloss LLM runtime endpoint checked.", result.ok ? "success" : "warn");
  };

  const handleStartPhoneRuntime = async () => {
    if (!selectedModel) {
      onNotify?.("Select a GGUF model before starting the phone runtime.", "warn");
      return;
    }
    if (!window.PocketFlowReceiveBridge?.spinoStartPhoneRuntime) {
      onNotify?.("Phone-native runtime control is available only in the installed PocketFlow app.", "warn");
      return;
    }
    const result = await window.PocketFlowReceiveBridge.spinoStartPhoneRuntime(selectedModel.id, profile.id);
    await refreshNativeStats();
    if (result.runtimeEndpoint) setRuntimeEndpointInput(result.runtimeEndpoint);
    onNotify?.(result.message || "Phone runtime start requested.", result.ok ? "success" : "warn");
  };

  const handleStopPhoneRuntime = async () => {
    if (!window.PocketFlowReceiveBridge?.spinoStopPhoneRuntime) {
      onNotify?.("Phone-native runtime control is available only in the installed PocketFlow app.", "warn");
      return;
    }
    const result = await window.PocketFlowReceiveBridge.spinoStopPhoneRuntime();
    await refreshNativeStats();
    onNotify?.(result.message || "Phone runtime stopped.", result.ok ? "success" : "warn");
  };

  const handleLoadModel = async () => {
    if (!selectedModel) {
      onNotify?.("Import a GGUF model before loading Baloss LLM.", "warn");
      return;
    }
    const freshStats = await refreshNativeStats();
    const guard = canRunSpinoModelSafely(
      selectedModel,
      profile,
      freshStats?.deviceMemoryAvailableMb ?? runtimeStats.deviceMemoryAvailableMb,
      freshStats?.swapFreeMb ?? runtimeStats.swapFreeMb,
    );
    if (!guard.ok) {
      if (window.PocketFlowReceiveBridge?.spinoUnloadModel) {
        try {
          await window.PocketFlowReceiveBridge.spinoUnloadModel();
        } catch {
          // Ignore bridge unload failures; the UX still needs the RAM guard message.
        }
      }
      setRuntimeStats((prev) => ({
        ...prev,
        loaded: false,
        loadedModelId: undefined,
        estimatedMemoryMb: guard.estimatedMb,
        memoryPressure: "critical",
        health: "limit",
        message: `${guard.message} Baloss LLM will use local retrieval memory only.`,
      }));
      onNotify?.("Aether RAM guard kept Baloss LLM in no-lag retrieval mode.", "warn");
      return;
    }
    if (!window.PocketFlowReceiveBridge?.spinoLoadModel) {
      setRuntimeStats({
        backend: "WebView local index",
        loaded: false,
        loadedModelId: selectedModel.id,
        estimatedMemoryMb: estimateModelMemoryMb(selectedModel, profile),
        message: "Native llama.cpp backend is not installed yet. Retrieval mode is available.",
      });
      onNotify?.("Model reference selected. Native inference backend is pending.", "info");
      return;
    }
    if (window.PocketFlowReceiveBridge?.spinoStartPhoneRuntime && !freshStats?.nativeInferenceInstalled) {
      const startResult = await window.PocketFlowReceiveBridge.spinoStartPhoneRuntime(selectedModel.id, profile.id);
      if (startResult.runtimeEndpoint) setRuntimeEndpointInput(startResult.runtimeEndpoint);
      if (!startResult.ok) {
        onNotify?.(startResult.message || "Phone runtime did not start yet.", "warn");
      }
    }
    const result = await window.PocketFlowReceiveBridge.spinoLoadModel(selectedModel.id, profile.id);
    const nextStats = await refreshNativeStats();
    setRuntimeStats((prev) => ({
      ...prev,
      backend: "Android bridge",
      loaded: !!result.loaded,
      loadedModelId: selectedModel.id,
      runtimeEndpoint: nextStats?.runtimeEndpoint || prev.runtimeEndpoint,
      runtimeKind: nextStats?.runtimeKind || prev.runtimeKind,
      estimatedMemoryMb: estimateModelMemoryMb(selectedModel, profile),
      message: result.message,
    }));
    onNotify?.(result.message || "Baloss LLM model load requested.", result.ok ? "success" : "warn");
  };

  const handleDownloadOptimizedModel = async () => {
    const url = downloadUrl.trim() || SPINO_OPTIMIZED_MODEL_URL;
    if (!/^https?:\/\//.test(url)) {
      onNotify?.("Model URL is not valid.", "warn");
      return;
    }
    if (window.PocketFlowReceiveBridge?.openExternalUrl) {
      const result = await window.PocketFlowReceiveBridge.openExternalUrl(url);
      onNotify?.(result.message || "Opening model download.", result.ok ? "success" : "warn");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    onNotify?.("Opening model download.", "info");
  };

  const handleUnloadModel = async () => {
    if (window.PocketFlowReceiveBridge?.spinoUnloadModel) {
      await window.PocketFlowReceiveBridge.spinoUnloadModel();
    }
    setRuntimeStats((prev) => ({ ...prev, loaded: false, loadedModelId: undefined, message: "Model unloaded." }));
    onNotify?.("Baloss LLM model unloaded.", "info");
  };

  const handleIndexFiles = async (fileList: FileList | null) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;
    setIndexProgress("Preparing local index...");
    try {
      const { next, changed } = await indexSpinoFiles(files, indexState, (done, total, name) => {
        setIndexProgress(`${done}/${total} ${name}`);
      });
      setIndexState(next);
      setIndexProgress("");
      onNotify?.(`Indexed ${changed} changed document${changed === 1 ? "" : "s"}.`, "success");
    } catch (error) {
      setIndexProgress("");
      onNotify?.(error instanceof Error ? error.message : "Indexing failed.", "warn");
    }
  };

  const handleClearIndex = () => {
    const next = { ...indexState, documents: [], chunks: [], lastIndexedAt: new Date().toISOString() };
    setIndexState(next);
    saveSpinoIndex(next);
    setSources([]);
    setSearchResults([]);
    onNotify?.("Baloss LLM index cleared.", "info");
  };

  const handleSetKnowledgeRoot = (value: string) => {
    const next = { ...indexState, knowledgeRoot: value.trim() || SPINO_DEFAULT_KNOWLEDGE_ROOT };
    setIndexState(next);
    saveSpinoIndex(next);
  };

  const handleSearch = () => {
    setSearchResults(searchSpinoIndex(searchQuery, indexState, profile.topK));
  };

  const handleCreateMemory = async () => {
    const note = memoryNote.trim();
    if (!note) return;
    upsertLearnedMemory({
      kind: "fact",
      label: note.length > 48 ? `${note.slice(0, 48).trim()}...` : note,
      value: note,
      raw: note,
      tags: ["spino", "manual", "fact"],
      source: "manual",
    });
    const blob = new File([note], `memory-${new Date().toISOString().slice(0, 10)}.txt`, {
      type: "text/plain",
      lastModified: Date.now(),
    });
    const { next } = await indexSpinoFiles([blob], indexState);
    setIndexState(next);
    setMemoryNote("");
    setLearnedMemoryCount(loadLearnedMemories().length);
    onNotify?.("Memory added to local Baloss LLM.", "success");
  };

  const startBrowserDictation = () => {
    const SpeechRecognitionCtor =
      (window as Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition
      || (window as Window & { webkitSpeechRecognition?: any }).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      recognitionActiveRef.current = false;
      if (liveVoiceEnabledRef.current) {
        liveVoiceListeningRef.current = false;
        setLiveVoiceListening(false);
        setLiveVoiceEnabled(true);
        setLiveVoiceStatus("Live mode is on. Internal microphone is available in the phone app, not this browser preview.");
      } else {
        isDictatingRef.current = false;
        setIsDictating(false);
        onNotify?.("Dictation is not available in this browser shell.", "warn");
      }
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    const translatorSpeechLang = TRANSLATION_LANGS.find((lang) => lang.id === translatorSourceLang)?.speech;
    recognition.lang = translatorActiveRef.current && translatorSpeechLang ? translatorSpeechLang : navigator.language || "en-US";
    recognition.continuous = dictationHoldEnabledRef.current;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    let suppressEndRetry = false;
    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";
      let confidence = 0;
      for (let index = event.resultIndex || 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript?.trim() || "";
        if (!text) continue;
        if (result.isFinal) {
          finalTranscript = `${finalTranscript} ${text}`.trim();
          confidence = result?.[0]?.confidence || confidence;
        } else {
          interimTranscript = `${interimTranscript} ${text}`.trim();
        }
      }
      const transcript = finalTranscript || interimTranscript;
      window.dispatchEvent(new CustomEvent("pocketflow-speech-result", {
        detail: {
          ok: Boolean(transcript),
          transcript,
          confidence,
          interim: !finalTranscript,
          message: transcript ? "Browser transcription ready." : "No speech text captured.",
        },
      }));
    };
    recognition.onerror = () => {
      if (liveVoiceEnabledRef.current) {
        liveVoiceListeningRef.current = false;
        setLiveVoiceListening(false);
        setLiveVoiceEnabled(true);
        suppressEndRetry = true;
        setLiveVoiceStatus("Live mode is active. Browser preview cannot keep the microphone open; use the installed phone app for internal voice.");
      } else if (dictationHoldEnabledRef.current) {
        recognitionActiveRef.current = false;
        isDictatingRef.current = true;
        setIsDictating(true);
        setSpeechStatus("Continuous dictation on. Reopening microphone...");
        scheduleDictationListen(850);
      } else {
        recognitionActiveRef.current = false;
        isDictatingRef.current = false;
        setIsDictating(false);
        onNotify?.("Dictation could not start.", "warn");
      }
    };
    recognition.onend = () => {
      browserRecognitionRef.current = null;
      if (suppressEndRetry) {
        recognitionActiveRef.current = false;
        liveVoiceListeningRef.current = false;
        setLiveVoiceListening(false);
        isDictatingRef.current = false;
        setIsDictating(false);
        return;
      }
      if (liveVoiceEnabledRef.current) {
        recognitionActiveRef.current = false;
        liveVoiceListeningRef.current = false;
        setLiveVoiceListening(false);
        if (!liveVoiceSpeakingRef.current && !isGeneratingRef.current) scheduleLiveListen(700);
      } else if (dictationHoldEnabledRef.current) {
        recognitionActiveRef.current = false;
        isDictatingRef.current = true;
        setIsDictating(true);
        scheduleDictationListen(650);
      } else {
        recognitionActiveRef.current = false;
        isDictatingRef.current = false;
        setIsDictating(false);
      }
    };
    browserRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      browserRecognitionRef.current = null;
      recognitionActiveRef.current = false;
      if (liveVoiceEnabledRef.current) {
        liveVoiceListeningRef.current = false;
        setLiveVoiceListening(false);
        setLiveVoiceStatus("Microphone could not start in this browser preview. Live mode remains active for the installed phone app.");
      } else if (dictationHoldEnabledRef.current) {
        recognitionActiveRef.current = false;
        isDictatingRef.current = true;
        setIsDictating(true);
        setSpeechStatus("Continuous dictation on. Reopening microphone...");
        scheduleDictationListen(850);
      } else {
        recognitionActiveRef.current = false;
        isDictatingRef.current = false;
        setIsDictating(false);
        onNotify?.("Dictation could not start.", "warn");
      }
    }
  };

  const handleStartDictation = async () => {
    if (recognitionActiveRef.current) return;
    recognitionActiveRef.current = true;
    isDictatingRef.current = true;
    setIsDictating(true);
    setSpeechDraft("");
    setSpeechStatus(dictationHoldEnabledRef.current ? "Continuous dictation on. Speak naturally; tap mic to stop." : "Listening for transcription...");
    if (window.PocketFlowReceiveBridge?.spinoStartSpeechRecognition) {
      let result: { ok: boolean; message?: string };
      try {
        const translatorSpeechLang = TRANSLATION_LANGS.find((lang) => lang.id === translatorSourceLang)?.speech;
        result = await window.PocketFlowReceiveBridge.spinoStartSpeechRecognition(
          translatorActiveRef.current && translatorSpeechLang ? translatorSpeechLang : "auto",
        );
      } catch {
        result = { ok: false, message: "Internal microphone bridge did not answer." };
      }
      if (!result.ok) {
        recognitionActiveRef.current = false;
        if (dictationHoldEnabledRef.current) {
          isDictatingRef.current = true;
          setIsDictating(true);
          setSpeechStatus(result.message ? `${result.message} Continuous dictation will retry.` : "Continuous dictation will retry.");
          scheduleDictationListen(850);
        } else {
          isDictatingRef.current = false;
          setIsDictating(false);
          setSpeechStatus(result.message || "Dictation is unavailable.");
          onNotify?.(result.message || "Dictation is unavailable.", "warn");
        }
      }
      return;
    }
    startBrowserDictation();
  };

  const toggleDictationHold = async () => {
    const next = !dictationHoldEnabledRef.current;
    dictationHoldEnabledRef.current = next;
    setDictationHoldEnabled(next);
    if (!next) {
      clearDictationListenTimer();
      recognitionActiveRef.current = false;
      isDictatingRef.current = false;
      setIsDictating(false);
      setSpeechDraft("");
      setSpeechStatus("Transcription off.");
      try {
        browserRecognitionRef.current?.abort?.();
      } catch {}
      browserRecognitionRef.current = null;
      if (window.PocketFlowReceiveBridge?.spinoStopSpeechRecognition) {
        await window.PocketFlowReceiveBridge.spinoStopSpeechRecognition();
      }
      return;
    }

    liveVoiceEnabledRef.current = false;
    setLiveVoiceEnabled(false);
    clearLiveListenTimer();
    recognitionActiveRef.current = false;
    isDictatingRef.current = true;
    setIsDictating(true);
    setSpeechStatus("Continuous dictation on. Speak naturally; tap the microphone again to stop.");
    void handleStartDictation();
  };

  const clearComposerDraft = async () => {
    if (dictationHoldEnabledRef.current) {
      await toggleDictationHold();
    }
    setQuestion("");
    setSpeechDraft("");
    setSpeechStatus("Draft cleared. Dictate again or type normally.");
    onNotify?.("Baloss draft cleared.", "info");
  };

  const canDownload = downloadUrl.trim().length > 8 && /^https?:\/\//.test(downloadUrl.trim());
  const modelFilePresent = runtimeStats.modelFileInstalled ?? Boolean(runtimeStats.aetherModelInstalled);
  const runtimeReadyIdle = Boolean(modelFilePresent && (runtimeStats.health === "ready" || runtimeStats.runtimeCanAutostart) && !runtimeStats.nativeInferenceInstalled && !runtimeStats.loaded);
  const runtimeTone = runtimeStats.crashed
    ? "slate"
    : runtimeReadyIdle
      ? "green"
    : runtimeStats.nativeInferenceInstalled === false && selectedModel
      ? "amber"
      : runtimeStats.nativeInferenceInstalled === false || !runtimeStats.loaded
        ? "slate"
        : runtimeStats.health === "limit" || runtimeStats.memoryPressure === "critical"
          ? "red"
          : runtimeStats.health === "busy" || runtimeStats.generationActive
            ? "amber"
            : "green";
  const runtimeLabel = runtimeTone === "green"
    ? runtimeReadyIdle ? "Ready Idle" : "Healthy"
    : runtimeTone === "amber"
      ? runtimeStats.nativeInferenceInstalled === false ? "Configured" : "Busy"
      : runtimeTone === "red"
        ? "Limit"
        : "Offline";
  const estimatedMemoryMb = runtimeStats.estimatedMemoryMb || estimateModelMemoryMb(selectedModel, profile);
  const availableMemoryMb = typeof runtimeStats.deviceMemoryAvailableMb === "number"
    ? runtimeStats.deviceMemoryAvailableMb + Math.min(runtimeStats.swapFreeMb || 0, 512)
    : ramGuard.safeBudgetMb;
  const efficiencyRatio = availableMemoryMb && estimatedMemoryMb
    ? Math.max(0, Math.min(100, Math.round((1 - (estimatedMemoryMb / Math.max(1, availableMemoryMb))) * 100)))
    : 0;
  const quickSubtitle = runtimeStats.nativeInferenceInstalled === false
    ? runtimeReadyIdle ? "Phone backend ready" : "Local retrieval ready"
    : runtimeStats.loaded
      ? `Loaded ${selectedModel?.parameterClass || "model"}`
      : "Chat ready";
  const heartbeatClass = {
    green: "border-[#22c55e]/35 bg-[#22c55e]/10 text-[#22c55e]",
    yellow: "border-amber-500/35 bg-amber-500/10 text-amber-300",
    red: "border-red-500/35 bg-red-500/10 text-red-300",
    white: "border-slate-300/25 bg-white/8 text-slate-200",
  }[spinoHeartbeat.status];
  const selectedAgentReview = useMemo(() => {
    const agent = SPINO_AGENT_NODES.find((item) => item.id === selectedAgentReviewId);
    if (!agent) return null;
    const healthItem = agentHealthReport.items.find((item) => item.agentId === agent.id);

    const onlineBlocked = agent.onlineRequired && (!navigator.onLine || localOnly);
    const permissionWarning = agent.permission === "ask-first" ? "Owner approval required before this agent performs touch, cursor, shell or external actions." : "";
    const modelWarning = agent.id === "model" && !runtimeStats.loaded ? "Native model runner is not loaded; retrieval fallback is active." : "";
    const speechWarning = agent.id === "voice" && !runtimeStats.speechTranscriptionAvailable ? "Offline streaming STT runtime is still missing." : "";
    const memoryWarning = agent.id === "memory" && learnedMemoryCount === 0 && indexState.documents.length === 0 ? "Memory is sparse. Add personal/work files or notes for better recall." : "";
    const warnings = [
      onlineBlocked ? "Online route blocked by offline state or local-only mode." : "",
      permissionWarning,
      modelWarning,
      speechWarning,
      memoryWarning,
    ].filter(Boolean);

    const health: "healthy" | "busy" | "warning" | "blocked" = onlineBlocked
      ? "blocked"
      : isGenerating && (agent.id === "model" || agent.id === "automation")
        ? "busy"
        : warnings.length
          ? "warning"
          : "healthy";

    const healthLabel = {
      healthy: "Ready",
      busy: "Running",
      warning: "Needs review",
      blocked: "Blocked",
    }[health];

    const actionsByAgent: Partial<Record<SpinoAgentNode["id"], string[]>> = {
      memory: [
        `${learnedMemoryCount} learned memories available`,
        `${indexState.documents.length} indexed documents`,
        chatCheckpoints.length ? `${chatCheckpoints.length} chat checkpoints retained` : "No checkpoints yet",
      ],
      research: [
        `${intelSnapshot.items.length} online intel items cached`,
        intelSnapshot.fetchedAt ? `Last refresh ${new Date(intelSnapshot.fetchedAt).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "No online refresh yet",
        intelSnapshot.errors.length ? `${intelSnapshot.errors.length} source warnings` : "No source warnings",
      ],
      news: [
        `${intelItemsByKind.news?.length || 0} news items in current cache`,
        allowGeneralKnowledge ? "General research allowed" : "General research blocked",
      ],
      model: [
        runtimeStats.loaded ? `Loaded ${runtimeStats.loadedModelId || selectedModel?.name || "selected model"}` : "Model not loaded",
        `${runtimeStats.tokensPerSecond || 0} tok/s reported`,
        `${runtimeStats.memoryPressure || "normal"} memory pressure`,
      ],
      relay: [
        "Relay app controls desktop handoff and previews",
        "Prompt receipts stay in Relay process mirror",
      ],
      archive: [
        archiveAgent.config.enabled ? `Archive agent ${archiveAgent.config.cadence}` : "Archive agent paused",
        `${archiveAgent.reviewQueue.length} duplicate groups tracked`,
        `${archiveAgent.threatQueue.length} suspicious files tracked`,
      ],
      voice: [
        isDictating ? "Dictation active" : "Dictation idle",
        speechStatus || "No current speech status",
      ],
      calendar: ["Natural language add, move, remove and query routes enabled"],
      notes: ["Note and voice memo save routes enabled"],
      radar: ["Flight Radar data can be queried through Baloss LLM when online"],
    };

    const actions = actionsByAgent[agent.id] || [
      `Controls ${agent.apps.join(", ")}`,
      `${agent.tools.length} tools registered`,
      agent.localCapable ? "Can run locally" : "Needs online connection",
    ];

    const timeline = [
      { label: "Opened", value: new Date().toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }) },
      { label: "Heartbeat", value: spinoHeartbeat.label },
      { label: "Runtime", value: runtimeStats.message || runtimeLabel },
      { label: "Permission", value: agent.permission },
    ];

    return { agent, health, healthLabel, warnings, actions, timeline, healthItem };
  }, [
    allowGeneralKnowledge,
    agentHealthReport.items,
    archiveAgent.config.cadence,
    archiveAgent.config.enabled,
    archiveAgent.reviewQueue.length,
    archiveAgent.threatQueue.length,
    chatCheckpoints.length,
    indexState.documents.length,
    intelItemsByKind.news,
    intelSnapshot.errors.length,
    intelSnapshot.fetchedAt,
    intelSnapshot.items.length,
    isDictating,
    isGenerating,
    learnedMemoryCount,
    localOnly,
    runtimeLabel,
    runtimeStats.loaded,
    runtimeStats.loadedModelId,
    runtimeStats.memoryPressure,
    runtimeStats.message,
    runtimeStats.speechTranscriptionAvailable,
    runtimeStats.tokensPerSecond,
    selectedAgentReviewId,
    selectedModel?.name,
    spinoHeartbeat.label,
    speechStatus,
  ]);
  return (
    <div className="relative h-full min-h-0 min-w-0 bg-[#05070a] text-slate-100 animate-fade-in overflow-hidden overscroll-contain flex flex-col">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(34,197,94,0.22),transparent_34%),radial-gradient(circle_at_88%_8%,rgba(6,182,212,0.12),transparent_30%),linear-gradient(180deg,rgba(7,9,13,0.68),rgba(5,7,10,1))]" />
      <input
        ref={taskFileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => void handleAttachTaskFiles(event.target.files)}
      />
      <input
        ref={taskFolderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => void handleAttachTaskFiles(event.target.files)}
        {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
      />
      <div className="relative shrink-0 px-4 pt-2.5 pb-2.5 border-b border-[#22c55e]/15 bg-black/35 shadow-[0_18px_60px_rgba(0,0,0,0.36)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl border border-[#22c55e]/35 bg-[#22c55e]/12 text-[#8dffb0] flex items-center justify-center shadow-[0_0_32px_rgba(34,197,94,0.14)]">
              <Bot className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[22px] leading-none font-black tracking-tight text-white">Baloss</h1>
              <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.26em] text-slate-500 truncate">
                Panel chat / {quickSubtitle}
              </div>
            </div>
          </div>
          <Pill tone={runtimeTone}>{runtimeLabel}</Pill>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 overflow-y-auto px-3 pt-3 pb-3 space-y-3">
          {messages.length === 0 && (
            <div className="rounded-[26px] border border-[#22c55e]/15 bg-black/35 px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-3xl border border-[#22c55e]/25 bg-[#22c55e]/10 text-[#22c55e] flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-100">Baloss LLM ready</div>
                  <div className="mt-1 text-[11px] leading-5 text-slate-500">Write or dictate. The chat stays in one solid scroll area.</div>
                </div>
              </div>
            </div>
          )}
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] rounded-[24px] border px-4 py-3 ${messageTone(message.role)}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-slate-500">
                    {message.role === "user" ? "You" : message.role === "assistant" ? "Baloss" : "System"}
                  </div>
                  {message.sourceLabel && (
                    <span className="text-[8px] font-mono uppercase tracking-wider text-slate-500">{message.sourceLabel}</span>
                  )}
                </div>
                <div className="mt-1.5 whitespace-pre-wrap text-[15px] leading-6 text-inherit">
                  {message.content || (message.pending ? "Thinking..." : "")}
                </div>
                {message.pending && (
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Processing
                  </div>
                )}
              </div>
            </div>
          ))}

          {sources.length > 0 && (
            <div className="rounded-[24px] border border-[#2a2c32] bg-[#111317] p-4">
              <div className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-slate-500">Active sources</div>
              <div className="mt-3 space-y-2">
                {sources.slice(0, 3).map((source) => (
                  <div key={source.chunk.id} className="rounded-2xl border border-[#202228] bg-[#0c0d10] px-3 py-3">
                    <div className="text-xs font-bold text-slate-200 truncate">{source.document.title}</div>
                    <div className="mt-1 text-[10px] font-mono text-slate-500">
                      score {source.score.toFixed(2)} / chunk {source.chunk.chunkIndex + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        <div ref={chatEndRef} />
      </div>

        <div className="relative shrink-0 border-t border-[#22c55e]/15 bg-[#05070a]/96 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] space-y-1.5 shadow-[0_-18px_60px_rgba(0,0,0,0.34)] backdrop-blur-xl">
          {speechStatus && (
            <div className="rounded-2xl border border-[#22c55e]/20 bg-[#22c55e]/10 px-3 py-1 text-[9px] leading-4 text-[#c8f8d7] line-clamp-2">
              {speechStatus}
            </div>
          )}

          {showChatControls && !showToolPanel && (
            <div className={`rounded-[24px] border p-3 space-y-3 ${translatorActive ? "border-cyan-300/35 bg-cyan-300/10" : "border-[#202228] bg-[#0d0f12]"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[9px] font-mono font-black uppercase tracking-[0.2em] text-cyan-200">
                    <Globe2 className="w-3.5 h-3.5" />
                    Live Translate
                  </div>
                  <div className="mt-1 text-[10px] leading-4 text-slate-500 line-clamp-2">
                    {translatorStatus}
                  </div>
                </div>
                <button
                  onClick={() => void toggleLiveTranslator()}
                  disabled={translatorBusy}
                  className={`h-10 shrink-0 rounded-2xl px-3 text-[9px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5 ${
                    translatorActive
                      ? "border border-red-400/35 bg-red-500/12 text-red-200"
                      : "border border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
                  } disabled:opacity-60`}
                >
                  {translatorActive ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  {translatorActive ? "Stop" : "Start"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="mb-1 block text-[8px] font-mono font-black uppercase tracking-[0.18em] text-slate-500">From</span>
                  <select
                    value={translatorSourceLang}
                    onChange={(event) => setTranslatorSourceLang(event.target.value as TranslationLang)}
                    disabled={translatorActive}
                    className="w-full h-9 rounded-xl border border-[#2a2c32] bg-[#07080a] px-2 text-[10px] font-mono text-slate-200 outline-none disabled:opacity-60"
                  >
                    {TRANSLATION_LANGS.map((lang) => (
                      <option key={lang.id} value={lang.id}>{lang.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1 block text-[8px] font-mono font-black uppercase tracking-[0.18em] text-slate-500">To</span>
                  <select
                    value={translatorTargetLang}
                    onChange={(event) => setTranslatorTargetLang(event.target.value as TranslationLang)}
                    className="w-full h-9 rounded-xl border border-[#2a2c32] bg-[#07080a] px-2 text-[10px] font-mono text-slate-200 outline-none"
                  >
                    {TRANSLATION_LANGS.filter((lang) => lang.id !== "auto").map((lang) => (
                      <option key={lang.id} value={lang.id}>{lang.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              {(translatorInput || translatorOutput || translatorBusy) && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="min-h-[58px] rounded-2xl border border-[#2a2c32] bg-[#07080a] p-2">
                    <div className="text-[8px] font-mono font-black uppercase tracking-widest text-slate-500">Heard</div>
                    <div className="mt-1 text-[11px] leading-5 text-slate-300 line-clamp-4">{translatorInput || "Waiting for speech..."}</div>
                  </div>
                  <div className="min-h-[58px] rounded-2xl border border-cyan-300/20 bg-cyan-300/8 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[8px] font-mono font-black uppercase tracking-widest text-cyan-200">Translated</div>
                      {translatorBusy && <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-200" />}
                    </div>
                    <div className="mt-1 text-[11px] leading-5 text-cyan-50 line-clamp-4">{translatorOutput || "Translation will appear here."}</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => void copyTranslationOutput()}
                  className="h-9 rounded-xl border border-[#2a2c32] bg-[#111317] text-[8px] font-mono font-black uppercase tracking-wider text-slate-300 flex items-center justify-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </button>
                <button
                  onClick={() => void speakTranslationOutput()}
                  className="h-9 rounded-xl border border-[#2a2c32] bg-[#111317] text-[8px] font-mono font-black uppercase tracking-wider text-slate-300 flex items-center justify-center gap-1"
                >
                  <Play className="w-3.5 h-3.5" />
                  Speak
                </button>
                <button
                  onClick={() => {
                    setQuestion((current) => [current.trim(), translatorOutput.trim()].filter(Boolean).join(current.trim() ? "\n" : ""));
                    onNotify?.("Translation added to chat box.", "success");
                  }}
                  disabled={!translatorOutput.trim()}
                  className="h-9 rounded-xl border border-[#22c55e]/25 bg-[#22c55e]/10 text-[8px] font-mono font-black uppercase tracking-wider text-[#8dffb0] disabled:opacity-45"
                >
                  To Chat
                </button>
              </div>
            </div>
          )}

          {showChatControls && !showToolPanel && (
          <div className="rounded-[22px] border border-[#202228] bg-[#0d0f12] p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[9px] font-mono font-black uppercase tracking-[0.2em] text-[#22c55e]">Task Chats</div>
                <div className="mt-0.5 text-[10px] text-slate-500 truncate">
                  {activeTask
                    ? `${activeTask.agentLabel || "Task"} · ${activeTask.title} · ${activeTask.turns.length} turns`
                    : taskAgentMode === "none"
                      ? "None selected. Normal chat only."
                      : `${selectedTaskAgent?.shortLabel || "Task"} agent selected. New chat starts a persistent thread.`}
                </div>
              </div>
              <button
                onClick={() => createTaskSession()}
                disabled={taskAgentMode === "none"}
                className="h-8 shrink-0 rounded-xl border border-[#22c55e]/25 bg-[#22c55e]/10 px-2 text-[8px] font-mono font-black uppercase tracking-wider text-[#22c55e] disabled:opacity-40 flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                New
              </button>
            </div>
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => {
                  setTaskAgentMode("none");
                  selectTaskSession("");
                }}
                className={`h-9 shrink-0 rounded-xl border px-3 text-[8px] font-mono font-black uppercase tracking-wider ${
                  taskAgentMode === "none"
                    ? "border-slate-400/35 bg-slate-400/10 text-slate-100"
                    : "border-[#2a2c32] text-slate-500"
                }`}
              >
                None
              </button>
              {SPINO_TASK_AGENT_PROFILES.map((agent) => {
                const AgentIcon = taskAgentIconMap[agent.id] || Bot;
                const active = taskAgentMode === agent.id;
                return (
                  <button
                    key={agent.id}
                    onClick={() => {
                      setTaskAgentMode(agent.id);
                      const matchingTask = taskSessions.find((session) => session.agentId === agent.id || session.mode === agent.id);
                      if (matchingTask && !activeTask) selectTaskSession(matchingTask.id);
                    }}
                    title={agent.description}
                    className="h-9 shrink-0 rounded-xl border px-2.5 text-[8px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5"
                    style={{
                      borderColor: active ? `${agent.color}80` : "#2a2c32",
                      background: active ? `${agent.color}1f` : "#111317",
                      color: active ? agent.color : "#94a3b8",
                    }}
                  >
                    <AgentIcon className="h-3.5 w-3.5" />
                    {agent.shortLabel}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1.5">
              <select
                value={activeTaskId}
                onChange={(event) => selectTaskSession(event.target.value)}
                className="min-w-0 h-9 rounded-xl border border-[#2a2c32] bg-[#07080a] px-2 text-[10px] font-mono text-slate-200 outline-none"
              >
                <option value="">No active task</option>
                {taskSessions.map((session) => (
                  <option key={session.id} value={session.id}>{session.agentLabel ? `${session.agentLabel}: ` : ""}{session.title}</option>
                ))}
              </select>
              <button
                onClick={() => taskFileInputRef.current?.click()}
                className="h-9 rounded-xl border border-[#2a2c32] bg-[#111317] px-2 text-[8px] font-mono font-black uppercase tracking-wider text-slate-300 flex items-center gap-1"
              >
                <Upload className="h-3.5 w-3.5" />
                Files
              </button>
              <button
                onClick={() => taskFolderInputRef.current?.click()}
                className="h-9 rounded-xl border border-[#2a2c32] bg-[#111317] px-2 text-[8px] font-mono font-black uppercase tracking-wider text-slate-300 flex items-center gap-1"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Folder
              </button>
              <button
                onClick={() => void handleCompileTaskWorkflow()}
                disabled={!activeTask}
                className="h-9 rounded-xl bg-amber-500 px-2 text-[8px] font-mono font-black uppercase tracking-wider text-black disabled:opacity-45 flex items-center gap-1"
              >
                <Download className="h-3.5 w-3.5" />
                Build
              </button>
            </div>
          </div>
          )}

          {showChatControls && !showToolPanel && (
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            <button
              onClick={openMePanel}
              className="h-9 shrink-0 rounded-full border border-[#22c55e]/30 bg-[#22c55e]/12 px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-[#8dffb0] flex items-center gap-2"
            >
              <UserRound className="w-3.5 h-3.5" />
              Me
            </button>
            <button
              onClick={() => setLocalOnly((value) => !value)}
              className={`h-9 shrink-0 rounded-full border px-3 text-[10px] font-mono font-bold uppercase tracking-wider ${
                localOnly ? "border-[#22c55e]/30 bg-[#22c55e]/12 text-[#22c55e]" : "border-[#2a2c32] text-slate-500"
              }`}
            >
              Local only
            </button>
            <button
              onClick={() => setAllowGeneralKnowledge((value) => !value)}
              className={`h-9 shrink-0 rounded-full border px-3 text-[10px] font-mono font-bold uppercase tracking-wider ${
                allowGeneralKnowledge ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-[#2a2c32] text-slate-500"
              }`}
            >
              General allowed
            </button>
            <button
              onClick={toggleToolPanel}
              aria-expanded={showToolPanel}
              className={`h-9 shrink-0 rounded-full border px-3 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-2 ${
                showToolPanel ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200" : "border-[#2a2c32] text-slate-500"
              }`}
            >
              Tools
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showToolPanel ? "rotate-180" : ""}`} />
            </button>
          </div>
          )}

          {showMePanel && (
            <div className="absolute left-3 right-3 top-[4.35rem] bottom-[4.35rem] z-40 overflow-y-auto overscroll-contain rounded-[24px] border border-[#22c55e]/25 bg-[#0d0f12] p-3 space-y-3 shadow-[0_24px_80px_rgba(0,0,0,0.62)]">
              <div className="sticky top-0 z-10 rounded-[20px] border border-[#2a2c32] bg-[#111317]/95 p-3 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-[0.22em] text-[#8dffb0]">
                      <UserRound className="w-4 h-4" />
                      Me profile
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500 truncate">
                      Baloss LLM uses this private local profile to adapt answers, notes, research and work suggestions.
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={saveMePanel}
                      className="h-10 rounded-2xl bg-[#22c55e] px-3 text-[10px] font-mono font-black uppercase tracking-wider text-black flex items-center gap-1.5"
                    >
                      <Save className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={() => setShowMePanel(false)}
                      className="h-10 w-10 rounded-2xl border border-[#2a2c32] bg-[#0c0d10] text-slate-300 flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <section className="grid grid-cols-2 gap-2">
                {[
                  ["displayName", "Title / name", "PocketFlow User"],
                  ["age", "Age", "Age or birth notes"],
                  ["constitution", "Constitution", "Body, health, rhythm notes"],
                  ["character", "Character", "How you are / how to work with you"],
                ].map(([key, label, placeholder]) => (
                  <label key={key} className={key === "displayName" || key === "character" ? "col-span-2" : ""}>
                    <span className="block mb-1 text-[9px] font-mono font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
                    <input
                      value={String(profileDraft[key as keyof SpinoPersonalProfile] || "")}
                      onChange={(event) => updateProfileField(key as keyof SpinoPersonalProfile, event.target.value)}
                      placeholder={placeholder}
                      className="w-full h-11 rounded-2xl border border-[#2a2c32] bg-[#07080a] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600"
                    />
                  </label>
                ))}
              </section>

              <section className="space-y-2">
                {[
                  ["likes", "Likings", "Things you like, favorite styles, topics, food, places, habits..."],
                  ["dislikes", "Avoid", "Things Baloss LLM should avoid suggesting or doing."],
                  ["hobbies", "Hobbies", "Interests, skills, sports, music, projects."],
                  ["knowledge", "Knowledge", "What you know well and what you are learning."],
                  ["workStyle", "Work style", "How you prefer to work, pace, priorities, habits."],
                  ["communicationStyle", "Communication style", "Short answers, direct tone, languages, how Baloss LLM should speak to you."],
                ].map(([key, label, placeholder]) => (
                  <label key={key} className="block">
                    <span className="block mb-1 text-[9px] font-mono font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
                    <textarea
                      value={String(profileDraft[key as keyof SpinoPersonalProfile] || "")}
                      onChange={(event) => updateProfileField(key as keyof SpinoPersonalProfile, event.target.value)}
                      placeholder={placeholder}
                      rows={2}
                      className="w-full rounded-2xl border border-[#2a2c32] bg-[#07080a] px-3 py-2.5 text-sm leading-5 text-slate-100 outline-none resize-none placeholder:text-slate-600"
                    />
                  </label>
                ))}
              </section>

              <section className="rounded-[22px] border border-[#2a2c32] bg-[#111317] p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-[0.2em] text-amber-300">
                    <Briefcase className="w-4 h-4" />
                    Businesses
                  </div>
                  <button
                    onClick={() => setProfileDraft((current) => ({ ...current, businesses: [...current.businesses, emptySpinoBusinessProfile()] }))}
                    className="h-9 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 text-[9px] font-mono font-black uppercase tracking-wider text-amber-200 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
                {profileDraft.businesses.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-[#2a2c32] px-3 py-4 text-xs text-slate-500">
                    No businesses yet. Add one and describe what you do there.
                  </div>
                )}
                {profileDraft.businesses.map((business) => (
                  <div key={business.id} className="rounded-2xl border border-[#2a2c32] bg-[#07080a] p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={business.name}
                        onChange={(event) => updateBusiness(business.id, { name: event.target.value })}
                        placeholder="Business name"
                        className="min-w-0 h-10 rounded-xl border border-[#2a2c32] bg-[#050608] px-3 text-xs text-slate-100 outline-none"
                      />
                      <input
                        value={business.role}
                        onChange={(event) => updateBusiness(business.id, { role: event.target.value })}
                        placeholder="Your role"
                        className="min-w-0 h-10 rounded-xl border border-[#2a2c32] bg-[#050608] px-3 text-xs text-slate-100 outline-none"
                      />
                    </div>
                    <input
                      value={business.link}
                      onChange={(event) => updateBusiness(business.id, { link: event.target.value })}
                      placeholder="Website / link"
                      className="w-full h-10 rounded-xl border border-[#2a2c32] bg-[#050608] px-3 text-xs text-slate-100 outline-none"
                    />
                    <textarea
                      value={business.description}
                      onChange={(event) => updateBusiness(business.id, { description: event.target.value })}
                      placeholder="What this business does and how Baloss LLM should describe it."
                      rows={3}
                      className="w-full rounded-xl border border-[#2a2c32] bg-[#050608] px-3 py-2 text-xs leading-5 text-slate-100 outline-none resize-none"
                    />
                    <button
                      onClick={() => setProfileDraft((current) => ({ ...current, businesses: current.businesses.filter((item) => item.id !== business.id) }))}
                      className="h-8 rounded-xl border border-red-500/30 bg-red-500/10 px-3 text-[8px] font-mono font-black uppercase tracking-wider text-red-300"
                    >
                      Remove business
                    </button>
                  </div>
                ))}
              </section>

              <section className="rounded-[22px] border border-[#2a2c32] bg-[#111317] p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-[0.2em] text-cyan-200">
                    <Link2 className="w-4 h-4" />
                    Links
                  </div>
                  <button
                    onClick={() => setProfileDraft((current) => ({ ...current, links: [...current.links, emptySpinoProfileLink()] }))}
                    className="h-9 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 text-[9px] font-mono font-black uppercase tracking-wider text-cyan-200 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
                {profileDraft.links.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-[#2a2c32] px-3 py-4 text-xs text-slate-500">
                    No links yet. Add websites, social pages, business cards, docs or references.
                  </div>
                )}
                {profileDraft.links.map((link) => (
                  <div key={link.id} className="rounded-2xl border border-[#2a2c32] bg-[#07080a] p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={link.label}
                        onChange={(event) => updateProfileLink(link.id, { label: event.target.value })}
                        placeholder="Label"
                        className="min-w-0 h-10 rounded-xl border border-[#2a2c32] bg-[#050608] px-3 text-xs text-slate-100 outline-none"
                      />
                      <input
                        value={link.url}
                        onChange={(event) => updateProfileLink(link.id, { url: event.target.value })}
                        placeholder="URL"
                        className="min-w-0 h-10 rounded-xl border border-[#2a2c32] bg-[#050608] px-3 text-xs text-slate-100 outline-none"
                      />
                    </div>
                    <input
                      value={link.description}
                      onChange={(event) => updateProfileLink(link.id, { description: event.target.value })}
                      placeholder="Why this link matters"
                      className="w-full h-10 rounded-xl border border-[#2a2c32] bg-[#050608] px-3 text-xs text-slate-100 outline-none"
                    />
                    <button
                      onClick={() => setProfileDraft((current) => ({ ...current, links: current.links.filter((item) => item.id !== link.id) }))}
                      className="h-8 rounded-xl border border-red-500/30 bg-red-500/10 px-3 text-[8px] font-mono font-black uppercase tracking-wider text-red-300"
                    >
                      Remove link
                    </button>
                  </div>
                ))}
              </section>

              <label className="block">
                <span className="block mb-1 text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#8dffb0]">Big personal document</span>
                <textarea
                  value={profileDraft.freeform}
                  onChange={(event) => updateProfileField("freeform", event.target.value)}
                  placeholder="Write anything Baloss LLM should learn about you, your businesses, contacts, preferences, operating rules, projects, tone, goals, private context..."
                  rows={12}
                  className="w-full min-h-[260px] rounded-[22px] border border-[#22c55e]/20 bg-[#07080a] px-3 py-3 text-sm leading-6 text-slate-100 outline-none resize-y placeholder:text-slate-600"
                />
              </label>
            </div>
          )}

          {!showToolPanel && (
          <div className="rounded-[26px] border border-[#22c55e]/18 bg-black/42 p-2.5 shadow-[0_18px_50px_rgba(0,0,0,0.28)] backdrop-blur-xl">
            {speechDraft && (
              <div className="mb-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/8 px-3 py-2 text-[11px] leading-5 text-cyan-100">
                <span className="font-mono uppercase tracking-[0.16em] text-cyan-300">Transcribing</span>
                <span className="ml-2 text-slate-300">{speechDraft}</span>
              </div>
            )}
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Write to Baloss LLM or dictate into this box..."
              rows={1}
              className="w-full min-h-[40px] max-h-[74px] bg-transparent border-0 p-0 text-[15px] leading-6 text-slate-100 outline-none resize-none placeholder:text-slate-500"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <button
                  onClick={() => void toggleDictationHold()}
                  disabled={isGenerating && !dictationHoldEnabled}
                  aria-pressed={dictationHoldEnabled}
                  className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${
                    dictationHoldEnabled || isDictating
                      ? "border-[#22c55e]/45 bg-[#22c55e]/18 text-[#8dffb0] shadow-[0_0_22px_rgba(34,197,94,0.18)]"
                      : "border-white/10 bg-[#0c0d10] text-slate-300"
                  } disabled:opacity-60`}
                  title={dictationHoldEnabled ? "Stop transcription" : "Start transcription"}
                >
                  {isDictating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setShowChatControls((value) => !value)}
                  aria-expanded={showChatControls}
                  className={`w-11 h-11 rounded-2xl border flex items-center justify-center ${
                    showChatControls
                      ? "border-[#22c55e]/45 bg-[#22c55e]/14 text-[#8dffb0]"
                      : "border-white/10 bg-[#0c0d10] text-slate-300"
                  }`}
                  title="Open Baloss chat tools"
                >
                  <Wrench className="w-5 h-5" />
                </button>
                {(question.trim() || speechDraft.trim()) && (
                  <button
                    onClick={() => void clearComposerDraft()}
                    className="h-11 rounded-2xl border border-red-500/25 bg-red-500/10 px-3 text-[10px] font-mono font-black uppercase tracking-[0.16em] text-red-200 flex items-center gap-1.5"
                    title="Clear dictated or typed draft"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear
                  </button>
                )}
              </div>
              <button
                onClick={() => void submitPrompt()}
                disabled={isGenerating || !question.trim()}
                className="h-11 shrink-0 px-5 rounded-2xl bg-[#22c55e] text-black text-[11px] font-mono font-black uppercase tracking-[0.18em] disabled:opacity-60 flex items-center gap-2 shadow-[0_14px_36px_rgba(34,197,94,0.2)]"
              >
                <MessageSquare className="w-4 h-4" />
                {isGenerating ? "Answering" : "Send"}
              </button>
            </div>
          </div>
          )}

          {showToolPanel && (
            <div className="absolute left-3 right-3 top-[4.35rem] bottom-[4.35rem] z-30 overflow-y-auto overscroll-contain rounded-[24px] border border-[#202228] bg-[#0d0f12] p-2 space-y-2 shadow-[0_24px_80px_rgba(0,0,0,0.56)]">
              <div className="sticky top-0 z-10 rounded-[20px] border border-[#2a2c32] bg-[#111317]/95 p-3 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono font-black uppercase tracking-[0.22em] text-cyan-200">Baloss LLM details</div>
                    <div className="mt-1 text-[10px] text-slate-500 truncate">All diagnostics are open. Collapse any section or close this panel.</div>
                  </div>
                  <button
                    onClick={() => setShowToolPanel(false)}
                    className="h-10 shrink-0 rounded-2xl border border-[#2a2c32] bg-[#0c0d10] px-3 text-[10px] font-mono font-black uppercase tracking-wider text-slate-200"
                  >
                    Collapse
                  </button>
                </div>
              </div>
              {selectedAgentReview && (
                <section className="rounded-[24px] border border-cyan-400/30 bg-[#071217] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[9px] font-mono font-black uppercase tracking-[0.24em] text-cyan-200">Agent full review</div>
                      <h2 className="mt-2 text-2xl font-black leading-tight text-white">{selectedAgentReview.agent.label}</h2>
                      <p className="mt-2 text-[12px] leading-6 text-slate-400">{selectedAgentReview.agent.role}</p>
                    </div>
                    <button
                      onClick={() => setSelectedAgentReviewId(null)}
                      className="h-11 w-11 shrink-0 rounded-2xl border border-[#2a2c32] bg-[#0c0d10] text-slate-300 flex items-center justify-center active:scale-[0.98]"
                      aria-label="Close agent review"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className={`rounded-2xl border p-3 ${
                      selectedAgentReview.healthItem?.status === "ready" || selectedAgentReview.health === "healthy"
                        ? "border-[#22c55e]/35 bg-[#22c55e]/10"
                        : selectedAgentReview.healthItem?.status === "degraded" || selectedAgentReview.health === "busy"
                          ? "border-amber-400/35 bg-amber-400/10"
                          : selectedAgentReview.healthItem?.status === "blocked" || selectedAgentReview.health === "blocked"
                            ? "border-red-500/35 bg-red-500/10"
                            : "border-yellow-300/35 bg-yellow-300/10"
                    }`}>
                      <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Optimization</div>
                      <div className="mt-1 text-lg font-black text-white">
                        {selectedAgentReview.healthItem ? `${selectedAgentReview.healthItem.score}%` : selectedAgentReview.healthLabel}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
                      <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Target</div>
                      <div className="mt-1 text-lg font-black text-white">
                        {selectedAgentReview.healthItem?.optimizationTarget || 100}%
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
                      <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Mode</div>
                      <div className="mt-1 text-sm font-black text-slate-100">{selectedAgentReview.agent.localCapable ? "Local capable" : "Online route"}</div>
                    </div>
                    <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
                      <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Tools</div>
                      <div className="mt-1 text-sm font-black text-slate-100">{selectedAgentReview.agent.tools.length} registered</div>
                    </div>
                  </div>

                  {selectedAgentReview.healthItem && (
                    <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/8 p-3">
                      <div className="text-[9px] font-mono font-black uppercase tracking-[0.22em] text-cyan-200">Ideal operating model</div>
                      <p className="mt-2 text-[11px] leading-5 text-slate-300">{selectedAgentReview.healthItem.idealModel}</p>
                    </div>
                  )}

                  {selectedAgentReview.healthItem && (
                    <div className="mt-4 grid grid-cols-1 gap-2">
                      <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-3">
                        <div className="text-[9px] font-mono font-black uppercase tracking-[0.22em] text-red-200">Failure points</div>
                        <div className="mt-3 space-y-2">
                          {selectedAgentReview.healthItem.failurePoints.map((failure) => (
                            <div key={failure} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] leading-5 text-slate-300">
                              {failure}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-[#22c55e]/20 bg-[#22c55e]/5 p-3">
                        <div className="text-[9px] font-mono font-black uppercase tracking-[0.22em] text-[#8dffb0]">Repair plan</div>
                        <div className="mt-3 space-y-2">
                          {selectedAgentReview.healthItem.repairPlan.map((step, index) => (
                            <div key={`${index}-${step}`} className="grid grid-cols-[28px_1fr] gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] leading-5 text-slate-300">
                              <span className="font-mono text-[#22c55e]">{index + 1}</span>
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
                    <div className="text-[9px] font-mono font-black uppercase tracking-[0.22em] text-slate-300">Actions / updates</div>
                    <div className="mt-3 space-y-2">
                      {selectedAgentReview.actions.map((action) => (
                        <div key={action} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] leading-5 text-slate-300">
                          {action}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
                    <div className="text-[9px] font-mono font-black uppercase tracking-[0.22em] text-slate-300">Warnings</div>
                    <div className="mt-3 space-y-2">
                      {selectedAgentReview.warnings.length ? selectedAgentReview.warnings.map((warning) => (
                        <div key={warning} className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[11px] leading-5 text-amber-100">
                          {warning}
                        </div>
                      )) : (
                        <div className="rounded-xl border border-[#22c55e]/20 bg-[#22c55e]/10 px-3 py-2 text-[11px] leading-5 text-[#8dffb0]">
                          No active warnings for this agent.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
                    <div className="text-[9px] font-mono font-black uppercase tracking-[0.22em] text-slate-300">Timeline / timestamps</div>
                    <div className="mt-3 space-y-2">
                      {selectedAgentReview.timeline.map((item) => (
                        <div key={item.label} className="grid grid-cols-[92px_1fr] gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[10px] leading-5">
                          <span className="font-mono uppercase tracking-widest text-slate-500">{item.label}</span>
                          <span className="text-slate-300">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-2">
                    <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
                      <div className="text-[9px] font-mono font-black uppercase tracking-[0.22em] text-slate-300">Apps</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedAgentReview.agent.apps.map((app) => (
                          <span key={app} className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-[9px] font-mono uppercase tracking-wider text-cyan-100">{app}</span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
                      <div className="text-[9px] font-mono font-black uppercase tracking-[0.22em] text-slate-300">Tool map</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedAgentReview.agent.tools.map((tool) => (
                          <span key={tool} className="rounded-xl border border-[#22c55e]/20 bg-[#22c55e]/10 px-2 py-1 text-[9px] font-mono uppercase tracking-wider text-[#8dffb0]">{tool}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              )}
          <DrawerSection
            id="core"
            title="Core"
            subtitle="reasoning hub, heartbeat and specialist agents"
            open={openDrawers.core}
            onToggle={toggleDrawer}
          >
            <div className={`rounded-2xl border p-3 ${heartbeatClass}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[9px] font-mono uppercase tracking-widest opacity-70">Baloss central heartbeat</div>
                  <div className="mt-1 text-sm font-black truncate">{spinoHeartbeat.label}</div>
                </div>
                <div className="h-3 w-3 shrink-0 rounded-full bg-current shadow-[0_0_18px_currentColor]" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] leading-5">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="font-mono uppercase tracking-widest opacity-60">Model</div>
                  <div className="mt-1 font-bold text-slate-100">{spinoHeartbeat.model}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="font-mono uppercase tracking-widest opacity-60">Memory</div>
                  <div className="mt-1 font-bold text-slate-100">{spinoHeartbeat.memory}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="font-mono uppercase tracking-widest opacity-60">Research</div>
                  <div className="mt-1 font-bold text-slate-100">{spinoHeartbeat.research}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="font-mono uppercase tracking-widest opacity-60">Agents</div>
                  <div className="mt-1 font-bold text-slate-100">{spinoHeartbeat.agentsReady} / {SPINO_AGENT_NODES.length}</div>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {spinoHeartbeat.details.map((detail) => (
                  <div key={detail} className="text-[10px] leading-5 text-slate-300/80">{detail}</div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
              <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Reasoning core rule</div>
              <p className="mt-2 text-[11px] leading-5 text-slate-400">
                Baloss LLM is the central hub. Every message now passes through privacy routing first, then uses local memory/tools for personal work or authorised general reasoning for public questions.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SPINO_AGENT_NODES.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgentReviewId(agent.id)}
                  className={`rounded-2xl border p-3 text-left active:scale-[0.98] ${
                    selectedAgentReviewId === agent.id
                      ? "border-cyan-300/55 bg-cyan-300/12"
                      :
                    agent.onlineRequired && (!navigator.onLine || localOnly)
                      ? "border-amber-500/20 bg-amber-500/8"
                      : "border-[#2a2c32] bg-[#0c0d10]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-200 truncate">{agent.label}</div>
                    <span className={`h-2 w-2 rounded-full ${agent.permission === "core" ? "bg-[#22c55e]" : agent.permission === "approved" ? "bg-cyan-300" : "bg-amber-300"}`} />
                  </div>
                  <p className="mt-2 line-clamp-3 text-[10px] leading-5 text-slate-500">{agent.role}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[8px] font-mono uppercase tracking-widest text-slate-600">
                    <span>{agent.localCapable ? "local" : "online"} / {agent.tools.length} tools</span>
                    <span className="text-cyan-300">review</span>
                  </div>
                </button>
              ))}
            </div>
          </DrawerSection>

          <DrawerSection
            id="quality"
            title="Quality Bench"
            subtitle={`${qualityReport.passed}/${qualityReport.total} routes · ${qualityReport.score}% · ${qualityReport.dashboardCount} dashboards`}
            open={openDrawers.quality}
            onToggle={toggleDrawer}
          >
            <div className={`rounded-2xl border p-3 ${
              qualityReport.score >= 90
                ? "border-[#22c55e]/30 bg-[#22c55e]/10"
                : qualityReport.score >= 75
                  ? "border-amber-400/30 bg-amber-400/10"
                  : "border-red-400/30 bg-red-400/10"
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Deterministic quality audit</div>
                  <div className="mt-1 text-sm font-black text-slate-100 truncate">{qualityReport.summary}</div>
                  <p className="mt-1 text-[10px] leading-5 text-slate-500">
                    Checks route selection, quality contracts, fallback shape, dashboard memory and hidden-prompt cleanup without waking the model.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  <button
                    onClick={refreshQualityReport}
                    className="h-10 rounded-2xl border border-[#22c55e]/30 bg-[#22c55e]/10 px-3 text-[8px] font-mono font-black uppercase tracking-wider text-[#8dffb0] flex items-center justify-center gap-2 active:scale-[0.99]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Check
                  </button>
                  <button
                    onClick={() => void runLiveQualityBenchmark()}
                    disabled={qualityLiveBusy}
                    className="h-10 rounded-2xl bg-[#22c55e] px-3 text-[8px] font-mono font-black uppercase tracking-wider text-black flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-60"
                  >
                    {qualityLiveBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Live Local
                  </button>
                </div>
              </div>
              {(qualityLiveStatus || Object.keys(qualitySampleOutputById).length > 0) && (
                <div className="mt-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/8 px-3 py-2 text-[10px] leading-5 text-cyan-100">
                  {qualityLiveStatus || `${Object.keys(qualitySampleOutputById).length} live sample${Object.keys(qualitySampleOutputById).length === 1 ? "" : "s"} loaded.`}
                </div>
              )}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="text-lg font-black text-[#22c55e]">{qualityReport.score}%</div>
                  <div className="text-[7px] font-mono uppercase tracking-widest text-slate-500">Score</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="text-lg font-black text-cyan-200">{qualityReport.passed}/{qualityReport.total}</div>
                  <div className="text-[7px] font-mono uppercase tracking-widest text-slate-500">Passed</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="text-lg font-black text-purple-100">{qualityReport.dashboardCount}</div>
                  <div className="text-[7px] font-mono uppercase tracking-widest text-slate-500">Dashboards</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {Object.entries(qualityReport.dimensionScores).map(([dimension, rawScore]) => {
                  const score = Number(rawScore);
                  return (
                    <div
                      key={dimension}
                      className={`rounded-xl border px-2 py-1.5 ${
                        score >= 90
                          ? "border-[#22c55e]/20 bg-[#22c55e]/8"
                          : score >= 75
                            ? "border-amber-300/20 bg-amber-300/8"
                            : "border-red-300/20 bg-red-300/8"
                      }`}
                    >
                      <div className="text-[8px] font-mono font-black uppercase tracking-wider text-slate-500">
                        {qualityDimensionLabel(dimension)}
                      </div>
                      <div className={`text-sm font-black ${score >= 85 ? "text-[#8dffb0]" : "text-amber-200"}`}>{score}%</div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[8px] font-mono font-black uppercase tracking-widest text-slate-500">Quality trend</div>
                    <div className="mt-1 text-[11px] font-bold text-slate-200">
                      {qualityTrend
                        ? `Latest ${qualityTrend.latestScore}%${qualityTrend.delta === undefined ? "" : ` · ${qualityTrend.delta >= 0 ? "+" : ""}${qualityTrend.delta}% from previous`} · best ${qualityTrend.bestScore}%`
                        : "No saved live baseline yet."}
                    </div>
                    <p className="mt-1 text-[10px] leading-5 text-slate-500">
                      {qualityTrend?.weakestLabel
                        ? `${qualityTrend.weakestLabel} / ${qualityDimensionLabel(qualityTrend.weakestDimension || "unknown")}: ${qualityTrend.weakestRecommendation}`
                        : "Run Live Local to save the first real-answer sample and find the weakest route."}
                    </p>
                  </div>
                  {qualityHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={resetQualityHistory}
                      className="h-9 shrink-0 rounded-2xl border border-red-400/20 bg-red-400/10 px-3 text-[8px] font-mono font-black uppercase tracking-wider text-red-100"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {qualityHistory.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {qualityHistory.slice(0, 6).map((entry) => (
                      <div key={entry.id} className="min-w-[118px] rounded-2xl border border-white/10 bg-black/25 p-2">
                        <div className={`text-sm font-black ${entry.score >= 85 ? "text-[#8dffb0]" : "text-amber-200"}`}>{entry.score}%</div>
                        <div className="mt-0.5 text-[7px] font-mono uppercase tracking-wider text-slate-500">
                          {new Date(entry.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <div className="mt-1 text-[8px] font-mono uppercase tracking-wider text-slate-400">
                          {entry.liveSamples} live · {entry.passed}/{entry.total}
                        </div>
                        <div className="mt-1 truncate text-[7px] font-mono uppercase tracking-wider text-slate-500">
                          weak {qualityDimensionLabel(entry.weakestDimension || "unknown")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {qualityReport.results.map((result) => {
                const failedChecks = result.checks.filter((check) => !check.passed);
                const liveMeta = qualitySampleMetaById[result.id];
                const hasLiveSample = Boolean(qualitySampleOutputById[result.id]);
                const tone =
                  result.score >= 90
                    ? "border-[#22c55e]/25 bg-[#22c55e]/8"
                    : result.score >= 75
                      ? "border-amber-400/25 bg-amber-400/8"
                      : "border-red-400/25 bg-red-400/8";
                return (
                  <div key={result.id} className={`rounded-2xl border p-3 ${tone}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-200 truncate">{result.label}</div>
                        <div className="mt-1 text-[9px] font-mono uppercase tracking-wider text-slate-500">
                          {result.routedQualityTask} / {result.routedTaskType}{hasLiveSample ? " / live" : " / contract"}
                        </div>
                        <div className="mt-1 text-[8px] font-mono uppercase tracking-wider text-slate-600">
                          weakest: {qualityDimensionLabel(result.weakestDimension)}
                        </div>
                      </div>
                      <div className={`shrink-0 text-[10px] font-mono font-black ${
                        result.passed ? "text-[#8dffb0]" : "text-amber-200"
                      }`}>
                        {result.score}%
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.entries(result.dimensionScores)
                        .filter(([, rawScore]) => Number(rawScore) < 100)
                        .map(([dimension, rawScore]) => {
                          const score = Number(rawScore);
                          return (
                            <span
                              key={`${result.id}-${dimension}`}
                              className={`rounded-full border px-2 py-1 text-[7px] font-mono font-black uppercase tracking-wider ${
                                score >= 85
                                  ? "border-[#22c55e]/20 bg-[#22c55e]/8 text-[#8dffb0]"
                                  : "border-amber-300/20 bg-amber-300/8 text-amber-100"
                              }`}
                            >
                              {qualityDimensionLabel(dimension)} {score}%
                            </span>
                          );
                        })}
                    </div>
                    {failedChecks.length ? (
                      <div className="mt-2 space-y-1">
                        {failedChecks.map((check) => (
                          <div key={check.label} className="rounded-xl border border-red-400/15 bg-red-400/8 px-2 py-1.5 text-[9px] leading-4 text-red-100">
                            {check.label} [{qualityDimensionLabel(check.dimension)}]: {check.detail}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 rounded-xl border border-[#22c55e]/15 bg-[#22c55e]/8 px-2 py-1.5 text-[9px] leading-4 text-[#8dffb0]">
                        Route, contract and output cleanup checks passed.
                      </div>
                    )}
                    <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-2 py-1.5 text-[9px] leading-4 text-slate-500">
                      {result.fallbackPreview || result.contractPreview}
                    </div>
                    <div className="mt-2 rounded-xl border border-cyan-300/12 bg-cyan-300/8 px-2 py-1.5 text-[9px] leading-4 text-cyan-100">
                      {result.recommendation}
                    </div>
                    {liveMeta && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[8px] font-mono uppercase tracking-wider text-slate-500">
                        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">{liveMeta.providerId}</span>
                        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">{liveMeta.modelId || "model unknown"}</span>
                        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1">{Math.round(liveMeta.durationMs / 100) / 10}s</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </DrawerSection>

          <DrawerSection
            id="agentHealth"
            title="Agent Health"
            subtitle={
              agentHealthReport.checkedAt
                ? `${agentHealthReport.ready}/${SPINO_AGENT_NODES.length} ready · next ${new Date(agentHealthReport.nextCheckAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                : "twice-daily supervisor for every Baloss agent"
            }
            open={openDrawers.agentHealth}
            onToggle={toggleDrawer}
          >
            <div className={`rounded-2xl border p-3 ${
              agentHealthReport.blocked
                ? "border-red-500/30 bg-red-500/10"
                : agentHealthReport.degraded || agentHealthReport.unknown
                  ? "border-amber-500/30 bg-amber-500/10"
                  : "border-[#22c55e]/30 bg-[#22c55e]/10"
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Twice daily supervisor</div>
                  <div className="mt-1 text-sm font-black text-slate-100 truncate">{agentHealthReport.summary}</div>
                  <div className="mt-1 text-[10px] leading-5 text-slate-500">
                    Last check: {agentHealthReport.checkedAt ? new Date(agentHealthReport.checkedAt).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "never"}.
                  </div>
                </div>
                <button
                  onClick={() => runAgentHealthCheck("manual")}
                  disabled={agentHealthBusy}
                  className="h-11 shrink-0 rounded-2xl bg-[#22c55e] px-3 text-[9px] font-mono font-black uppercase tracking-wider text-black flex items-center gap-2 disabled:opacity-60"
                >
                  {agentHealthBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Check
                </button>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="text-lg font-black text-[#22c55e]">{agentHealthReport.ready}</div>
                  <div className="text-[7px] font-mono uppercase tracking-widest text-slate-500">Ready</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="text-lg font-black text-amber-300">{agentHealthReport.degraded}</div>
                  <div className="text-[7px] font-mono uppercase tracking-widest text-slate-500">Degraded</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="text-lg font-black text-red-300">{agentHealthReport.blocked}</div>
                  <div className="text-[7px] font-mono uppercase tracking-widest text-slate-500">Blocked</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="text-lg font-black text-slate-300">{agentHealthReport.unknown}</div>
                  <div className="text-[7px] font-mono uppercase tracking-widest text-slate-500">Unknown</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {(agentHealthReport.items.length ? agentHealthReport.items : []).map((item) => {
                const color =
                  item.status === "ready" ? "text-[#22c55e]" :
                  item.status === "degraded" ? "text-amber-300" :
                  item.status === "blocked" ? "text-red-300" :
                  "text-slate-400";
                return (
                  <button
                    key={item.agentId}
                    onClick={() => setSelectedAgentReviewId(item.agentId)}
                    className="w-full rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3 text-left active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-200 truncate">{item.label}</div>
                        <p className="mt-1 text-[10px] leading-5 text-slate-500 line-clamp-2">{item.summary}</p>
                      </div>
                      <div className={`shrink-0 text-[9px] font-mono font-black uppercase tracking-widest ${color}`}>
                        {item.score}%
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
                      <div
                        className={`h-full rounded-full ${item.status === "ready" ? "bg-[#22c55e]" : item.status === "blocked" ? "bg-red-400" : "bg-amber-300"}`}
                        style={{ width: `${Math.max(0, Math.min(100, item.score))}%` }}
                      />
                    </div>
                    {(item.warnings.length > 0 || item.actions.length > 0) && (
                      <div className="mt-2 rounded-xl border border-[#202228] bg-black/25 px-2 py-1.5 text-[9px] leading-4 text-slate-500">
                        {item.warnings[0] || item.actions[0]}
                      </div>
                    )}
                    <div className="mt-2 rounded-xl border border-[#202228] bg-black/20 px-2 py-1.5 text-[9px] leading-4 text-slate-500">
                      Target {item.optimizationTarget}% · {item.failurePoints[0]} · {item.repairPlan[0]}
                    </div>
                  </button>
                );
              })}
              {!agentHealthReport.items.length && (
                <div className="rounded-2xl border border-dashed border-[#2a2c32] bg-[#0c0d10] p-4 text-center text-[11px] text-slate-500">
                  No report yet. Tap Check to inspect every registered Baloss agent.
                </div>
              )}
            </div>
          </DrawerSection>

          <DrawerSection
            id="automation"
            title="Automation Clock"
            subtitle={
              schedulerSummary.nextJob
                ? `${schedulerSummary.enabled}/${schedulerSummary.total} armed · next ${schedulerSummary.nextJob.label} ${formatBalossTime(schedulerSummary.nextJob.nextRunAt)}`
                : "scheduled agents, newsletters and maintenance jobs"
            }
            open={openDrawers.automation}
            onToggle={toggleDrawer}
          >
            <div className={`rounded-2xl border p-3 ${
              schedulerSummary.failed
                ? "border-red-500/30 bg-red-500/10"
                : schedulerSummary.running
                  ? "border-amber-500/30 bg-amber-500/10"
                  : "border-[#22c55e]/30 bg-[#22c55e]/10"
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Clocked automations</div>
                  <div className="mt-1 text-sm font-black text-slate-100 truncate">
                    {schedulerSummary.failed
                      ? `${schedulerSummary.failed} job${schedulerSummary.failed === 1 ? "" : "s"} need attention`
                      : schedulerSummary.nextJob
                        ? `Next: ${schedulerSummary.nextJob.label}`
                        : "No scheduled jobs are armed"}
                  </div>
                  <div className="mt-1 text-[10px] leading-5 text-slate-500">
                    Android wakes PocketFlow about every 15 minutes. CRM sends still need the native CRM bridge or relay to answer.
                  </div>
                </div>
                <button
                  onClick={() => setDurableJobs(loadBalossDurableJobs())}
                  className="h-11 shrink-0 rounded-2xl bg-[#22c55e] px-3 text-[9px] font-mono font-black uppercase tracking-wider text-black flex items-center gap-2 active:scale-[0.99]"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="text-lg font-black text-[#22c55e]">{schedulerSummary.enabled}</div>
                  <div className="text-[7px] font-mono uppercase tracking-widest text-slate-500">Armed</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="text-lg font-black text-amber-300">{schedulerSummary.running}</div>
                  <div className="text-[7px] font-mono uppercase tracking-widest text-slate-500">Running</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="text-lg font-black text-red-300">{schedulerSummary.failed}</div>
                  <div className="text-[7px] font-mono uppercase tracking-widest text-slate-500">Failed</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="text-lg font-black text-slate-300">{schedulerSummary.total}</div>
                  <div className="text-[7px] font-mono uppercase tracking-widest text-slate-500">Total</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {sortedDurableJobs.map((job) => (
                <div key={job.id} className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-200 truncate">{job.label}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-slate-500">
                        <span>{job.owner}</span>
                        <span>{balossJobScheduleLabel(job)}</span>
                        <span>{job.enabled ? "enabled" : "paused"}</span>
                      </div>
                    </div>
                    <Pill tone={balossJobTone(job)}>{job.status}</Pill>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/10 bg-black/25 p-2">
                      <div className="text-[7px] font-mono uppercase tracking-widest text-slate-600">Last</div>
                      <div className="mt-1 text-[10px] font-bold text-slate-300">{formatBalossTime(job.lastRunAt)}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/25 p-2">
                      <div className="text-[7px] font-mono uppercase tracking-widest text-slate-600">Next</div>
                      <div className="mt-1 text-[10px] font-bold text-slate-300">{formatBalossTime(job.nextRunAt)}</div>
                    </div>
                  </div>
                  <div className="mt-2 rounded-xl border border-[#202228] bg-black/20 px-2 py-1.5 text-[9px] leading-4 text-slate-500">
                    {job.lastMessage || "No result logged yet."}
                    {job.failureCount > 0 ? ` Failure count: ${job.failureCount}.` : ""}
                  </div>
                </div>
              ))}
              {!sortedDurableJobs.length && (
                <div className="rounded-2xl border border-dashed border-[#2a2c32] bg-[#0c0d10] p-4 text-center text-[11px] text-slate-500">
                  No durable automation jobs are registered yet.
                </div>
              )}
            </div>
          </DrawerSection>

          <DrawerSection
            id="intel"
            title="Online Intel"
            subtitle={
              intelSnapshot.fetchedAt
                ? `${intelSnapshot.status} cache, ${intelSnapshot.items.length} live items`
                : "news, weather, markets and crypto refresh"
            }
            open={openDrawers.intel}
            onToggle={toggleDrawer}
          >
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
                <div className="flex items-center gap-2 text-[#22c55e]">
                  <Newspaper className="w-4 h-4" />
                  <span className="text-[9px] font-mono uppercase tracking-widest">Headlines</span>
                </div>
                <div className="mt-2 text-xl font-black text-white">{intelItemsByKind.news?.length || 0}</div>
                <div className="mt-1 text-[10px] text-slate-500">GDELT newspaper scan</div>
              </div>
              <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
                <div className="flex items-center gap-2 text-cyan-300">
                  <CloudSun className="w-4 h-4" />
                  <span className="text-[9px] font-mono uppercase tracking-widest">Weather</span>
                </div>
                <div className="mt-2 text-xl font-black text-white">{intelItemsByKind.weather?.length || 0}</div>
                <div className="mt-1 text-[10px] text-slate-500">{intelSnapshot.location.label}</div>
              </div>
              <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
                <div className="flex items-center gap-2 text-amber-300">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-[9px] font-mono uppercase tracking-widest">Markets</span>
                </div>
                <div className="mt-2 text-xl font-black text-white">{intelItemsByKind.market?.length || 0}</div>
                <div className="mt-1 text-[10px] text-slate-500">stock watchlist</div>
              </div>
              <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
                <div className="flex items-center gap-2 text-orange-300">
                  <Coins className="w-4 h-4" />
                  <span className="text-[9px] font-mono uppercase tracking-widest">Crypto</span>
                </div>
                <div className="mt-2 text-xl font-black text-white">{intelItemsByKind.crypto?.length || 0}</div>
                <div className="mt-1 text-[10px] text-slate-500">Coinbase/Binance fallback</div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">144h Public Cache</div>
                  <div className="mt-1 text-sm font-bold text-slate-200 truncate">
                    {intelSnapshot.fetchedAt ? `Fetched ${new Date(intelSnapshot.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "No pull yet"}
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500 truncate">
                    {intelSnapshot.sources.length ? intelSnapshot.sources.join(", ") : "Open-Meteo, Coinbase, Stooq, GDELT and Wikipedia are ready."}
                  </div>
                </div>
                <button
                  onClick={() => void refreshOnlineIntel(true)}
                  disabled={intelLoading}
                  className="h-11 px-4 rounded-2xl bg-[#22c55e] text-black text-[10px] font-mono font-black uppercase tracking-wider flex items-center gap-2 disabled:opacity-60"
                >
                  {intelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Refresh
                </button>
              </div>
              {(intelStatus || intelSnapshot.errors.length > 0) && (
                <div className="mt-3 rounded-2xl border border-[#202228] bg-[#090a0c] px-3 py-2 text-[11px] leading-5 text-slate-400">
                  {intelStatus || `${intelSnapshot.errors.length} source issue${intelSnapshot.errors.length === 1 ? "" : "s"} during last pull.`}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
              <div className="flex items-center gap-2 text-slate-200">
                <Globe2 className="w-4 h-4 text-[#22c55e]" />
                <span className="text-[10px] font-mono uppercase tracking-widest">How Baloss LLM Uses It</span>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">
                Ask for news, weather, BTC/ETH, markets, or research. Baloss LLM refreshes online when possible, keeps useful items for 144 hours, then prunes stale bulk automatically.
              </p>
            </div>

            <div className="rounded-2xl border border-cyan-400/25 bg-cyan-400/8 p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-cyan-200">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-[10px] font-mono font-black uppercase tracking-widest">Tanuki WWW Gateway</span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500 truncate">
                    {agentGatewaySnapshot.fetchedAt
                      ? `${agentGatewaySnapshot.systems.length} systems rated ${new Date(agentGatewaySnapshot.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : "Paste the private token once, then Baloss LLM can check authorised systems."}
                  </div>
                </div>
                <button
                  onClick={() => void refreshAgentGateway()}
                  disabled={agentGatewayLoading}
                  className="h-10 shrink-0 rounded-2xl bg-cyan-300 px-3 text-[9px] font-mono font-black uppercase tracking-wider text-black flex items-center gap-2 disabled:opacity-60"
                >
                  {agentGatewayLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Rate
                </button>
              </div>

              <div className="grid grid-cols-5 gap-1.5">
                {(["excellent", "good", "slow", "down", "unknown"] as const).map((rating) => {
                  const count = agentGatewaySnapshot.systems.filter((system) => system.rating === rating).length;
                  const color =
                    rating === "excellent" ? "text-[#22c55e]" :
                    rating === "good" ? "text-cyan-200" :
                    rating === "slow" ? "text-amber-300" :
                    rating === "down" ? "text-red-300" :
                    "text-slate-500";
                  return (
                    <div key={rating} className="rounded-xl border border-[#2a2c32] bg-[#07080a] p-2 text-center">
                      <div className={`text-lg font-black ${color}`}>{count}</div>
                      <div className="mt-0.5 text-[7px] font-mono uppercase tracking-widest text-slate-600">{rating}</div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                <input
                  value={agentGatewayTokenInput}
                  onChange={(event) => setAgentGatewayTokenInput(event.target.value)}
                  type="password"
                  placeholder={agentGatewayTokenReady ? "Token saved on this device" : "Paste private bearer token"}
                  className="min-w-0 h-10 rounded-2xl border border-[#2a2c32] bg-[#07080a] px-3 text-xs text-slate-100 outline-none placeholder:text-slate-600"
                />
                <button
                  onClick={saveAgentGatewayTokenFromInput}
                  className="h-10 rounded-2xl border border-[#22c55e]/30 bg-[#22c55e]/10 px-3 text-[8px] font-mono font-black uppercase tracking-wider text-[#8dffb0]"
                >
                  Save
                </button>
                <button
                  onClick={forgetAgentGatewayToken}
                  className="h-10 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 text-[8px] font-mono font-black uppercase tracking-wider text-red-300"
                >
                  Clear
                </button>
              </div>

              {(agentGatewayStatus || agentGatewaySnapshot.errors.length > 0) && (
                <div className="rounded-2xl border border-[#202228] bg-[#090a0c] px-3 py-2 text-[10px] leading-5 text-slate-400">
                  {agentGatewayStatus || agentGatewaySnapshot.errors.slice(0, 2).join("; ")}
                </div>
              )}

              <div className="max-h-52 overflow-y-auto overscroll-contain rounded-2xl border border-[#202228] bg-[#07080a] p-2 space-y-1.5">
                {agentGatewaySnapshot.systems.length === 0 ? (
                  <div className="px-2 py-4 text-[10px] leading-5 text-slate-500">
                    No gateway ratings cached yet. Tap Rate after saving the private token.
                  </div>
                ) : (
                  agentGatewaySnapshot.systems.slice(0, 17).map((system) => {
                    const color =
                      system.rating === "excellent" ? "text-[#22c55e]" :
                      system.rating === "good" ? "text-cyan-200" :
                      system.rating === "slow" ? "text-amber-300" :
                      system.rating === "down" ? "text-red-300" :
                      "text-slate-500";
                    return (
                      <div key={system.id} className="rounded-xl border border-[#202228] bg-black/20 px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 text-[10px] font-bold text-slate-200 truncate">{system.name}</div>
                          <div className={`shrink-0 text-[8px] font-mono font-black uppercase tracking-wider ${color}`}>
                            {system.rating}
                          </div>
                        </div>
                        <div className="mt-1 text-[9px] font-mono text-slate-600 truncate">
                          {system.health?.status ? `HTTP ${system.health.status}` : "status --"} / {typeof system.health?.ms === "number" ? `${system.health.ms}ms` : "timing --"}
                          {system.url ? ` / ${system.url}` : ""}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </DrawerSection>

          <DrawerSection
            id="agent"
            title="Agent"
            subtitle="Model, RAM guard, installs and runtime"
            open={openDrawers.agent}
            onToggle={toggleDrawer}
          >
            <div className="grid grid-cols-3 gap-2">
              <div className={`rounded-2xl border p-3 ${modelFilePresent ? "border-[#22c55e]/30 bg-[#22c55e]/10" : "border-amber-500/30 bg-amber-500/10"}`}>
                <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Model File</div>
                <div className={`mt-1 text-sm font-black ${modelFilePresent ? "text-[#22c55e]" : "text-amber-300"}`}>
                  {modelFilePresent ? "Installed" : "Missing"}
                </div>
                <div className="mt-1 text-[8px] font-mono text-slate-500 truncate">
                  {modelFilePresent ? formatSpinoBytes(runtimeStats.modelFileBytes || selectedModel?.size || 0) : selectedModel?.path || "Aether models"}
                </div>
              </div>
              <div className={`rounded-2xl border p-3 ${runtimeStats.nativeInferenceInstalled || runtimeReadyIdle ? "border-[#22c55e]/30 bg-[#22c55e]/10" : "border-amber-500/30 bg-amber-500/10"}`}>
                <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Token Engine</div>
                <div className={`mt-1 text-sm font-black ${runtimeStats.nativeInferenceInstalled || runtimeReadyIdle ? "text-[#22c55e]" : "text-amber-300"}`}>
                  {runtimeStats.nativeInferenceInstalled ? "Native" : runtimeReadyIdle ? "Ready" : "Retrieval"}
                </div>
                <div className="mt-1 text-[8px] font-mono text-slate-500">
                  {runtimeStats.loaded ? "Loaded" : runtimeReadyIdle ? "Idle" : `${runtimeStats.tokensPerSecond || 0} tok/s`}
                </div>
              </div>
              <div className={`rounded-2xl border p-3 ${
                efficiencyRatio > 30 ? "border-[#22c55e]/30 bg-[#22c55e]/10" : efficiencyRatio > 10 ? "border-amber-500/30 bg-amber-500/10" : "border-red-500/30 bg-red-500/10"
              }`}>
                <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Efficiency</div>
                <div className={`mt-1 text-sm font-black ${efficiencyRatio > 30 ? "text-[#22c55e]" : efficiencyRatio > 10 ? "text-amber-300" : "text-red-300"}`}>
                  {modelFilePresent && (runtimeStats.nativeInferenceInstalled || runtimeReadyIdle) ? runtimeReadyIdle ? "Ready" : `${efficiencyRatio}%` : "Standby"}
                </div>
                <div className="mt-1 text-[8px] font-mono text-slate-500">{runtimeStats.memoryPressure || "normal"} RAM</div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3 text-[11px] leading-6 text-slate-400">
              Backend: <span className="text-slate-200">{runtimeStats.backend}</span>. Estimated memory:{" "}
              <span className="text-slate-200">{estimatedMemoryMb} MB</span>. Safe budget:{" "}
              <span className={ramGuard.ok ? "text-[#22c55e]" : "text-amber-300"}>{ramGuard.safeBudgetMb || "--"} MB</span>.{" "}
              {runtimeStats.message || "Ready."}
            </div>

            <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Local token runner</div>
                  <div className="mt-1 text-sm font-bold text-slate-200 truncate">
                    {runtimeStats.runtimeEndpoint || "Auto-discovery"}
                  </div>
                  <div className="mt-1 text-[9px] font-mono text-slate-500 truncate">
                    {runtimeStats.runtimeKind || "llama.cpp / OpenAI-compatible / Ollama"}
                  </div>
                </div>
                <Pill tone={runtimeStats.nativeInferenceInstalled || runtimeReadyIdle ? "green" : "amber"}>
                  {runtimeStats.nativeInferenceInstalled ? "Connected" : runtimeReadyIdle ? "Ready idle" : "Needed"}
                </Pill>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  value={runtimeEndpointInput}
                  onChange={(event) => setRuntimeEndpointInput(event.target.value)}
                  placeholder="http://127.0.0.1:8080"
                  className="min-w-0 h-11 rounded-2xl border border-[#2a2c32] bg-[#07080a] px-3 text-sm text-slate-200 outline-none placeholder:text-slate-600"
                />
                <button
                  onClick={() => void handleSaveRuntimeEndpoint()}
                  className="h-11 rounded-2xl bg-[#22c55e] px-4 text-[10px] font-mono font-black uppercase tracking-wider text-black"
                >
                  Test
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => void handleStartPhoneRuntime()}
                  className="h-11 rounded-2xl bg-[#22c55e] px-3 text-[10px] font-mono font-black uppercase tracking-wider text-black flex items-center justify-center gap-2"
                >
                  <Play className="h-4 w-4" />
                  Start On Phone
                </button>
                <button
                  onClick={() => void handleStopPhoneRuntime()}
                  className="h-11 rounded-2xl border border-[#2a2c32] bg-[#111215] px-3 text-[10px] font-mono font-black uppercase tracking-wider text-slate-200 flex items-center justify-center gap-2"
                >
                  <Square className="h-4 w-4" />
                  Stop
                </button>
              </div>
              <div className="text-[10px] leading-5 text-slate-500">
                Start On Phone boots the packaged ARM64 llama.cpp runtime against the selected GGUF model. Baloss LLM uses this device first, then falls back to retrieval if the runner is off.
              </div>
            </div>

            <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Baloss LLM voice</div>
                  <div className="mt-1 text-sm font-bold text-slate-200 truncate">ElevenLabs standard</div>
                  <div className="mt-1 text-[9px] font-mono text-slate-500 truncate">{ELEVENLABS_STANDARD_VOICE_ID}</div>
                </div>
                <Pill tone={elevenLabsApiKey.trim() && navigator.onLine ? "green" : "slate"}>
                  {elevenLabsApiKey.trim() ? "Online" : "Fallback"}
                </Pill>
              </div>
              <input
                value={elevenLabsApiKey}
                onChange={(event) => setElevenLabsApiKey(event.target.value)}
                onBlur={(event) => saveElevenLabsApiKey(event.target.value)}
                placeholder="Paste ElevenLabs API key for this voice"
                type="password"
                className="w-full h-11 rounded-2xl border border-[#2a2c32] bg-[#07080a] px-3 text-sm text-slate-200 outline-none placeholder:text-slate-600"
              />
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 text-[10px] leading-5 text-slate-500 truncate">{elevenLabsStatus}</div>
                <button
                  onClick={() => void speakSpino("Hello. Baloss LLM voice is ready.")}
                  className="h-9 shrink-0 rounded-2xl border border-[#2a2c32] bg-white/5 px-3 text-[9px] font-mono font-bold uppercase tracking-wider text-slate-300"
                >
                  Test
                </button>
              </div>
            </div>

            {!ramGuard.ok && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-[11px] text-red-200">
                {ramGuard.message} Native load stays blocked so the phone remains responsive.
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Selected model</span>
                <select
                  value={selectedModel?.id || ""}
                  onChange={(event) => selectSpinoModel(event.target.value)}
                  className="mt-1 w-full h-11 rounded-2xl border border-[#2a2c32] bg-[#0c0d10] px-3 text-sm text-slate-200 outline-none"
                >
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">RAM profile</span>
                <select
                  value={profile.id}
                  onChange={(event) => {
                    const next = event.target.value as typeof profile.id;
                    setProfileIdState(next);
                    setSelectedSpinoProfileId(next);
                  }}
                  className="mt-1 w-full h-11 rounded-2xl border border-[#2a2c32] bg-[#0c0d10] px-3 text-sm text-slate-200 outline-none"
                >
                  {SPINO_PROFILES.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={handleLoadModel} className="h-11 rounded-2xl bg-[#22c55e] text-black text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                <Play className="w-4 h-4" /> Load
              </button>
              <button onClick={handleUnloadModel} className="h-11 rounded-2xl border border-[#2a2c32] bg-white/5 text-slate-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                <Square className="w-4 h-4" /> Unload
              </button>
            </div>

            <input ref={modelInputRef} type="file" accept=".gguf" className="hidden" onChange={(event) => handleImportModel(event.target.files?.[0] as File)} />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button onClick={() => modelInputRef.current?.click()} className="h-11 rounded-2xl bg-amber-500 text-black text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" /> Import .gguf
              </button>
              <button
                disabled={!canDownload}
                onClick={handleDownloadOptimizedModel}
                className="w-12 rounded-2xl border border-[#2a2c32] bg-[#0c0d10] text-slate-300 flex items-center justify-center disabled:opacity-40"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SPINO_PRESET_MODELS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => selectSpinoModel(preset.id, preset.id === SPINO_OPTIMIZED_MODEL.id ? QWEN_DEFAULT_PROFILE : "low")}
                  className={`rounded-2xl border p-3 text-left ${selectedModel?.id === preset.id ? "border-[#22c55e]/40 bg-[#22c55e]/10" : "border-[#2a2c32] bg-[#0c0d10]"}`}
                >
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-200">{preset.parameterClass}</div>
                  <div className="mt-1 text-[9px] font-mono text-slate-500">{formatSpinoBytes(preset.size)}</div>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {models.map((model) => (
                <div key={model.id} className="flex items-center gap-2 rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
                  <button
                    onClick={() => selectSpinoModel(model.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="text-sm font-bold text-slate-200 truncate">{model.name}</div>
                    <div className="mt-1 text-[9px] font-mono text-slate-500">{formatSpinoBytes(model.size)} / {model.quantization}</div>
                  </button>
                  <button onClick={() => handleDeleteModel(model.id)} className="w-10 h-10 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-300 flex items-center justify-center">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </DrawerSection>

          <DrawerSection
            id="knowledge"
            title="Knowledge"
            subtitle="Aether storage, index files and local search"
            open={openDrawers.knowledge}
            onToggle={toggleDrawer}
          >
            <div className={`rounded-2xl border p-3 ${aetherStorage?.ok ? "border-[#22c55e]/30 bg-[#22c55e]/10" : "border-amber-500/20 bg-amber-500/10"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Aether learning memory</div>
                  <div className="mt-1 text-sm font-bold text-slate-200 truncate">{aetherStorage?.root || SPINO_DEFAULT_KNOWLEDGE_ROOT}</div>
                </div>
                <Pill tone={aetherStorage?.ok && aetherStorage.writable ? "green" : "amber"}>
                  {aetherStorage?.ok && aetherStorage.writable ? "Mounted" : "Check"}
                </Pill>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="text-sm font-bold text-white">{formatSpinoBytes(aetherStorage?.totalBytes || 0)}</div>
                  <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Store</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="text-sm font-bold text-white">{formatSpinoBytes(SPINO_AETHER_KNOWLEDGE_TARGET_BYTES)}</div>
                  <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Knowledge Target</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="text-sm font-bold text-white">{formatSpinoBytes(aetherStorage?.reserveBytes || 0)}</div>
                  <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Reserved</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="text-sm font-bold text-white">{formatSpinoBytes(aetherStorage?.reserveFreeBytes || 0)}</div>
                  <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Free</div>
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-6 text-slate-400">
                {aetherStorage?.message || "Aether storage is reserved for curated retrieval learning, language tools, automation memory, conversation memory, research cache, and model files."}
              </p>
              <button
                onClick={() => void refreshAetherStorage()}
                className="mt-3 h-10 w-full rounded-2xl border border-[#2a2c32] bg-white/5 text-slate-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Refresh Aether memory
              </button>
            </div>

            <label className="block">
              <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Knowledge root folder</span>
              <input
                value={indexState.knowledgeRoot}
                onChange={(event) => handleSetKnowledgeRoot(event.target.value)}
                className="mt-1 w-full h-11 rounded-2xl border border-[#2a2c32] bg-[#0c0d10] px-3 text-sm text-slate-200 outline-none"
              />
            </label>

            <input
              ref={knowledgeInputRef}
              type="file"
              multiple
              accept=".txt,.md,.json,.jsonl,.csv,.html,.htm"
              className="hidden"
              onChange={(event) => void handleIndexFiles(event.target.files)}
            />

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => knowledgeInputRef.current?.click()} className="h-10 rounded-2xl bg-[#22c55e] text-black text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" /> Scan files
              </button>
              <button onClick={handleClearIndex} className="h-10 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-300 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                <Trash2 className="w-4 h-4" /> Clear
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-2">
                <div className="text-sm font-bold text-white">{indexState.documents.length}</div>
                <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Docs</div>
              </div>
              <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-2">
                <div className="text-sm font-bold text-white">{indexState.chunks.length}</div>
                <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Chunks</div>
              </div>
              <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-2">
                <div className="text-sm font-bold text-white">{formatSpinoBytes(JSON.stringify(indexState).length)}</div>
                <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Index</div>
              </div>
            </div>

            <div className="text-[10px] font-mono text-slate-500">
              {indexProgress || `Last indexed: ${indexState.lastIndexedAt ? new Date(indexState.lastIndexedAt).toLocaleString() : "never"}`}
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search local knowledge"
                className="min-w-0 h-11 rounded-2xl border border-[#2a2c32] bg-[#0c0d10] px-3 text-sm text-slate-200 outline-none"
              />
              <button onClick={handleSearch} className="w-12 rounded-2xl border border-[#2a2c32] bg-[#0c0d10] text-slate-300 flex items-center justify-center">
                <Search className="w-4 h-4" />
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((result) => (
                  <div key={result.chunk.id} className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                      <FileSearch className="w-4 h-4 text-[#22c55e]" />
                      <span className="truncate">{result.document.title}</span>
                    </div>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500 line-clamp-3">{result.chunk.text}</p>
                  </div>
                ))}
              </div>
            )}

            <pre className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3 text-[9px] text-slate-500 whitespace-pre-wrap overflow-x-auto">{SPINO_FOLDER_LAYOUT}</pre>
          </DrawerSection>

          <DrawerSection
            id="bigbrain"
            title="BigBrain"
            subtitle={bigBrainStatus.ok ? "Tommyboy external memory online" : "Tommyboy bridge or disk not reachable"}
            open={openDrawers.bigbrain}
            onToggle={toggleDrawer}
          >
            <div className={`rounded-2xl border p-3 ${bigBrainStatus.ok ? "border-[#22c55e]/30 bg-[#22c55e]/10" : "border-amber-500/20 bg-amber-500/10"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">External encyclopedia module</div>
                  <div className="mt-1 text-sm font-bold text-slate-100 truncate">{bigBrainStatus.moduleName}</div>
                  <div className="mt-1 text-[10px] leading-5 text-slate-500 line-clamp-2">{bigBrainStatus.message}</div>
                </div>
                <Pill tone={bigBrainStatus.ok ? "green" : "amber"}>
                  {bigBrainStatus.ok ? "BigBrain on" : "Standby"}
                </Pill>
              </div>

              <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-2">
                <div className="flex items-center justify-between text-[9px] font-mono uppercase tracking-widest text-slate-500">
                  <span>Fill target</span>
                  <span>{formatSpinoBytes(bigBrainStatus.usedBytes)} / {formatSpinoBytes(BIGBRAIN_TARGET_BYTES)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#22c55e]"
                    style={{ width: `${Math.min(100, Math.round((bigBrainStatus.usedBytes / BIGBRAIN_TARGET_BYTES) * 100))}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="text-sm font-bold text-white">{formatSpinoBytes(bigBrainStatus.usedBytes)}</div>
                  <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Used</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="text-sm font-bold text-white">{formatSpinoBytes(bigBrainStatus.freeBytes)}</div>
                  <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Free</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-2">
                  <div className="text-sm font-bold text-white">{bigBrainStatus.mode === "bridge" ? "API" : "Off"}</div>
                  <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Mode</div>
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[9px] font-mono uppercase tracking-widest text-cyan-200">Cognee semantic memory</div>
                    <div className="mt-1 text-[11px] leading-5 text-slate-400 line-clamp-2">
                      {bigBrainStatus.cognee?.message || "Optional semantic recall layer for Baloss agent memory."}
                    </div>
                  </div>
                  <Pill tone={bigBrainStatus.cognee?.ok ? "green" : "amber"}>
                    {bigBrainStatus.cognee?.ok ? "Active" : bigBrainStatus.cognee?.installed ? "Queued" : "Install"}
                  </Pill>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-black/25 p-2">
                    <div className="text-xs font-bold text-white">{bigBrainStatus.cognee?.version || "none"}</div>
                    <div className="text-[7px] font-mono uppercase tracking-widest text-slate-500">Version</div>
                  </div>
                  <div className="rounded-xl bg-black/25 p-2">
                    <div className="text-xs font-bold text-white">{bigBrainStatus.cognee?.mode || "queue"}</div>
                    <div className="text-[7px] font-mono uppercase tracking-widest text-slate-500">Mode</div>
                  </div>
                  <div className="rounded-xl bg-black/25 p-2">
                    <div className="text-xs font-bold text-white">{bigBrainStatus.cognee?.queued_memories ?? 0}</div>
                    <div className="text-[7px] font-mono uppercase tracking-widest text-slate-500">Queued</div>
                  </div>
                </div>
              </div>
            </div>

            <label className="block">
              <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">BigBrain bridge endpoint</span>
              <div className="mt-1 grid grid-cols-[1fr_auto] gap-2">
                <input
                  value={bigBrainEndpoint}
                  onChange={(event) => setBigBrainEndpoint(event.target.value)}
                  placeholder="http://127.0.0.1:7450"
                  className="min-w-0 h-11 rounded-2xl border border-[#2a2c32] bg-[#0c0d10] px-3 text-sm text-slate-200 outline-none"
                />
                <button
                  onClick={() => void refreshBigBrainStatus()}
                  disabled={bigBrainBusy}
                  className="w-12 rounded-2xl border border-[#2a2c32] bg-[#0c0d10] text-slate-300 flex items-center justify-center disabled:opacity-50"
                >
                  {bigBrainBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </button>
              </div>
            </label>

            <div className="grid gap-2">
              {bigBrainStatus.helperAgents.map((agent) => (
                <div key={agent.id} className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                      {agent.id === "health" ? <ShieldCheck className="w-4 h-4 text-[#22c55e]" /> : agent.id === "scout" ? <Search className="w-4 h-4 text-cyan-300" /> : <Database className="w-4 h-4 text-amber-300" />}
                      <span>{agent.title}</span>
                    </div>
                    <Pill tone={agent.status === "online" ? "green" : agent.status === "offline" ? "red" : "slate"}>
                      {agent.status}
                    </Pill>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-slate-500">{agent.detail}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-[11px] leading-5 text-amber-100">
              Tommyboy is still Mac OS Extended/HFS+. Direct Android plug-and-read needs an HFS+ reader/provider or a future exFAT migration. BigBrain works now through the local bridge, so Baloss can use the disk without guessing paths.
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                value={bigBrainQuery}
                onChange={(event) => setBigBrainQuery(event.target.value)}
                placeholder="Test Tommyboy search"
                className="min-w-0 h-11 rounded-2xl border border-[#2a2c32] bg-[#0c0d10] px-3 text-sm text-slate-200 outline-none"
              />
              <button onClick={() => void searchBigBrain()} disabled={bigBrainBusy} className="w-12 rounded-2xl border border-[#2a2c32] bg-[#0c0d10] text-slate-300 flex items-center justify-center disabled:opacity-50">
                <Search className="w-4 h-4" />
              </button>
            </div>

            {bigBrainSearch.length > 0 && (
              <div className="space-y-2">
                {bigBrainSearch.map((result, index) => (
                  <div key={`${result.path || result.title || "result"}-${index}`} className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
                    <div className="text-sm font-bold text-slate-200 truncate">{result.title || result.path || "BigBrain result"}</div>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500 line-clamp-3">{result.text || result.path || "No preview text available yet."}</p>
                  </div>
                ))}
              </div>
            )}
          </DrawerSection>

          <DrawerSection
            id="archiveAgent"
            title="Archive Agent"
            subtitle={
              archiveAgent.running
                ? `${ARCHIVE_MAINTENANCE_CADENCES.find((item) => item.value === archiveAgent.config.cadence)?.label || "Scheduled"} · ${archiveAgent.reviewQueue.length} dupes · ${archiveAgent.threatQueue.length} threats`
                : "duplicate checks, malware badges, quarantine and safe cleanup"
            }
            open={openDrawers.archiveAgent}
            onToggle={toggleDrawer}
          >
            <div className={`rounded-2xl border p-3 ${archiveAgent.running ? "border-[#22c55e]/30 bg-[#22c55e]/10" : "border-[#2a2c32] bg-[#0c0d10]"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Archive maintenance</div>
                  <div className="mt-1 text-sm font-bold text-slate-100 truncate">{archiveAgent.running ? "Running slow checks" : "Stopped"}</div>
                  <div className="mt-1 text-[10px] leading-5 text-slate-500 line-clamp-2">{archiveAgent.status}</div>
                </div>
                <Pill tone={archiveAgent.running ? "green" : "slate"}>
                  {archiveAgent.running ? "On" : "Off"}
                </Pill>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => toggleArchiveAgentRunning(true)}
                  disabled={archiveAgent.running}
                  className="h-10 rounded-2xl bg-[#22c55e] text-black text-[10px] font-mono font-black uppercase tracking-wider disabled:opacity-45 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Start
                </button>
                <button
                  onClick={() => toggleArchiveAgentRunning(false)}
                  disabled={!archiveAgent.running}
                  className="h-10 rounded-2xl border border-red-500/25 bg-red-500/10 text-red-300 text-[10px] font-mono font-black uppercase tracking-wider disabled:opacity-45 flex items-center justify-center gap-2"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              </div>
              <button
                onClick={() => void runArchiveAgentScan("manual")}
                disabled={archiveAgentBusy}
                className="mt-2 h-10 w-full rounded-2xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-100 text-[10px] font-mono font-black uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {archiveAgentBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Run check now
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Check rate</span>
                <select
                  value={archiveAgent.config.cadence}
                  onChange={(event) => updateArchiveAgentCadence(event.target.value as ArchiveMaintenanceCadence)}
                  className="mt-1 w-full h-11 rounded-2xl border border-[#2a2c32] bg-[#0c0d10] px-3 text-sm text-slate-200 outline-none"
                >
                  {ARCHIVE_MAINTENANCE_CADENCES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </label>
              <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
                <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Next check</div>
                <div className="mt-2 text-sm font-bold text-slate-200">
                  {archiveAgent.nextRunAt ? new Date(archiveAgent.nextRunAt).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }) : "None"}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setArchiveAgent(updateArchiveMaintenanceConfig(archiveAgent, { humanReview: !archiveAgent.config.humanReview }))}
                className={`rounded-2xl border p-3 text-left ${archiveAgent.config.humanReview ? "border-amber-500/30 bg-amber-500/10" : "border-[#2a2c32] bg-[#0c0d10]"}`}
              >
                <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-200">Human review</div>
                <div className="mt-1 text-[10px] leading-5 text-slate-500">{archiveAgent.config.humanReview ? "Unsure files wait for you." : "Review queue hidden."}</div>
              </button>
              <button
                onClick={() => setArchiveAgent(updateArchiveMaintenanceConfig(archiveAgent, { autoDeleteExact: !archiveAgent.config.autoDeleteExact }))}
                className={`rounded-2xl border p-3 text-left ${archiveAgent.config.autoDeleteExact ? "border-red-500/35 bg-red-500/10" : "border-[#2a2c32] bg-[#0c0d10]"}`}
              >
                <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-200">Auto delete exact</div>
                <div className="mt-1 text-[10px] leading-5 text-slate-500">{archiveAgent.config.autoDeleteExact ? "Exact duplicate records can be removed." : "No automatic deletes."}</div>
              </button>
              <button
                onClick={() => setArchiveAgent(updateArchiveMaintenanceConfig(archiveAgent, { malwareScan: !archiveAgent.config.malwareScan }))}
                className={`rounded-2xl border p-3 text-left ${archiveAgent.config.malwareScan ? "border-cyan-400/35 bg-cyan-400/10" : "border-[#2a2c32] bg-[#0c0d10]"}`}
              >
                <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-200">Malware guard</div>
                <div className="mt-1 text-[10px] leading-5 text-slate-500">{archiveAgent.config.malwareScan ? "Badge suspicious files." : "Security scan paused."}</div>
              </button>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Threat review</div>
                  <div className="mt-1 text-sm font-black text-white">{archiveAgent.threatQueue.length} flagged</div>
                </div>
                <ShieldCheck className="w-5 h-5 text-red-300" />
              </div>
              <div className="mt-3 space-y-2">
                {archiveAgent.threatQueue.slice(0, 5).map((finding) => (
                  <div key={finding.id} className="rounded-2xl border border-red-500/20 bg-[#090a0c] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-100 truncate">{finding.name}</div>
                        <div className="mt-1 text-[10px] leading-5 text-slate-500 line-clamp-2">
                          {finding.reasons.join(" ")}
                        </div>
                      </div>
                      <Pill tone={finding.threatLevel === "critical" || finding.threatLevel === "high" ? "red" : "amber"}>
                        {finding.threatLevel}
                      </Pill>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <button
                        onClick={() => void handleArchiveThreatAction(finding.fileId, "quarantine")}
                        className="h-9 rounded-xl border border-amber-400/25 bg-amber-400/10 text-amber-200 text-[9px] font-mono font-black uppercase tracking-wider"
                      >
                        Quarantine
                      </button>
                      <button
                        onClick={() => void handleArchiveThreatAction(finding.fileId, "block")}
                        className="h-9 rounded-xl border border-red-500/30 bg-red-500/15 text-red-200 text-[9px] font-mono font-black uppercase tracking-wider"
                      >
                        Block
                      </button>
                      <button
                        onClick={() => void handleArchiveThreatAction(finding.fileId, "override")}
                        className="h-9 rounded-xl border border-[#2a2c32] bg-white/5 text-slate-300 text-[9px] font-mono font-black uppercase tracking-wider"
                      >
                        Override
                      </button>
                    </div>
                  </div>
                ))}
                {archiveAgent.threatQueue.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-[#2a2c32] bg-[#090a0c] p-4 text-center text-[11px] text-slate-500">
                    No malware indicators waiting for review.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Human check window</div>
                  <div className="mt-1 text-sm font-black text-white">{archiveAgent.reviewQueue.length} groups</div>
                </div>
                <HardDrive className="w-5 h-5 text-[#22c55e]" />
              </div>
              <div className="mt-3 space-y-2">
                {archiveAgent.reviewQueue.slice(0, 4).map((group) => (
                  <div key={group.id} className="rounded-2xl border border-[#202228] bg-[#090a0c] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-100 truncate">{group.title}</div>
                        <div className="mt-1 text-[10px] leading-5 text-slate-500">
                          Keep {group.keep.name}. Review {group.candidates.length} duplicate{group.candidates.length === 1 ? "" : "s"}.
                        </div>
                      </div>
                      <Pill tone={group.confidence === "exact" ? "green" : "amber"}>{group.confidence}</Pill>
                    </div>
                    <div className="mt-2 space-y-1">
                      {group.candidates.slice(0, 3).map((candidate) => (
                        <div key={candidate.id} className="text-[10px] leading-5 text-slate-500 truncate">
                          {candidate.deletable ? "Can delete" : "Manual"} · {candidate.name} · {formatSpinoBytes(candidate.size)}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => void handleApproveArchiveGroup(group.id)}
                        className="h-9 rounded-xl bg-[#22c55e] text-black text-[9px] font-mono font-black uppercase tracking-wider"
                      >
                        Delete dupes
                      </button>
                      <button
                        onClick={() => handleDismissArchiveGroup(group.id)}
                        className="h-9 rounded-xl border border-[#2a2c32] bg-white/5 text-slate-300 text-[9px] font-mono font-black uppercase tracking-wider"
                      >
                        Keep all
                      </button>
                    </div>
                  </div>
                ))}
                {archiveAgent.reviewQueue.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-[#2a2c32] bg-[#090a0c] p-4 text-center text-[11px] text-slate-500">
                    Nothing waiting for human review.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
              <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Recent actions</div>
              <div className="mt-2 space-y-2">
                {archiveAgent.deletedLog.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="text-[10px] leading-5 text-slate-500">
                    <span className="font-mono uppercase tracking-wider text-slate-400">{entry.action}</span>
                    {" · "}
                    {entry.message}
                  </div>
                ))}
                {archiveAgent.deletedLog.length === 0 && (
                  <div className="text-[10px] leading-5 text-slate-500">No archive maintenance actions yet.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] leading-6 text-amber-100">
              Safe rule: native phone files are flagged for review, not physically removed, until the Android bridge exposes a signed delete permission. PocketFlow Archive records can be removed after review.
            </div>
          </DrawerSection>

          <DrawerSection
            id="chatCleanup"
            title="Chat Cleanup"
            subtitle={`${chatCheckpoints.length} checkpoints, ${chatCleanup.enabled ? `every ${chatCleanup.cadenceHours}h` : "paused"}`}
            open={openDrawers.chatCleanup}
            onToggle={toggleDrawer}
          >
            <div className="rounded-2xl border border-[#22c55e]/20 bg-[#22c55e]/8 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-mono font-black uppercase tracking-[0.22em] text-[#8dffb0]">
                    Breadcrumb memory cleaner
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-slate-400">
                    Cleans chat logs and old reasoning scratch only. It does not touch passwords, API keys, Archive, Reader files, apps, calendar, notes, or learned profile memory.
                  </p>
                </div>
                <button
                  onClick={() => toggleChatCleanupRunning(!chatCleanup.enabled)}
                  className={`h-11 shrink-0 rounded-2xl px-4 text-[10px] font-mono font-black uppercase tracking-wider ${
                    chatCleanup.enabled
                      ? "border border-red-500/30 bg-red-500/10 text-red-300"
                      : "border border-[#22c55e]/30 bg-[#22c55e]/12 text-[#8dffb0]"
                  }`}
                >
                  {chatCleanup.enabled ? "Pause" : "Start"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <label className="block">
                <span className="mb-1 block text-[9px] font-mono font-black uppercase tracking-[0.18em] text-slate-500">Rate of checks</span>
                <select
                  value={chatCleanup.cadenceHours}
                  onChange={(event) => updateChatCleanupCadence(Number(event.target.value))}
                  className="w-full h-11 rounded-2xl border border-[#2a2c32] bg-[#0c0d10] px-3 text-sm text-slate-200 outline-none"
                >
                  {[1, 3, 4, 5, 6, 7, 8, 12, 24, 36, 48].map((hours) => (
                    <option key={hours} value={hours}>Every {hours}h</option>
                  ))}
                </select>
              </label>
              <button
                onClick={() => void runChatCleanupNow()}
                disabled={chatCleanupBusy}
                className="self-end h-11 rounded-2xl bg-[#22c55e] px-4 text-[10px] font-mono font-black uppercase tracking-wider text-black flex items-center gap-2 disabled:opacity-60"
              >
                {chatCleanupBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Clean
              </button>
            </div>

            <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
              <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Last action</div>
              <div className="mt-2 text-[11px] leading-5 text-slate-400">{chatCleanup.lastResult}</div>
              <div className="mt-1 text-[10px] text-slate-600">
                {chatCleanup.lastRunAt ? `Last run ${new Date(chatCleanup.lastRunAt).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "Not run yet"}
              </div>
            </div>

            <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">Checkpoints</div>
                <Pill tone={chatCheckpoints.length ? "green" : "slate"}>{chatCheckpoints.length}</Pill>
              </div>
              <div className="mt-3 max-h-56 overflow-y-auto overscroll-contain space-y-2">
                {chatCheckpoints.slice(0, 8).map((checkpoint) => (
                  <div key={checkpoint.id} className="rounded-2xl border border-[#202228] bg-[#07080a] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-200">
                        {checkpoint.from.slice(0, 10)} → {checkpoint.to.slice(0, 10)}
                      </div>
                      <span className="text-[9px] font-mono text-slate-600">{checkpoint.messageCount} msg</span>
                    </div>
                    <p className="mt-2 line-clamp-4 text-[10px] leading-5 text-slate-500">{checkpoint.summary}</p>
                  </div>
                ))}
                {chatCheckpoints.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-[#2a2c32] px-3 py-4 text-[10px] leading-5 text-slate-500">
                    No checkpoints yet. They appear when older chat context is compressed.
                  </div>
                )}
              </div>
            </div>
          </DrawerSection>

          <DrawerSection
            id="memory"
            title="Memory"
            subtitle={`${learnedMemoryCount} facts · ${experienceMemoryCount} reusable lessons`}
            open={openDrawers.memory}
            onToggle={toggleDrawer}
          >
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                value={memoryNote}
                onChange={(event) => setMemoryNote(event.target.value)}
                placeholder="Add simple local memory entry"
                className="min-w-0 h-11 rounded-2xl border border-[#2a2c32] bg-[#0c0d10] px-3 text-sm text-slate-200 outline-none"
              />
              <button onClick={() => void handleCreateMemory()} className="w-12 rounded-2xl bg-[#22c55e] text-black flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3 text-[11px] leading-6 text-slate-400">
              Baloss LLM separates actions from learning: calendar words add, move, remove or answer plans; note words save to Notes; personal facts, contacts, emails, phone numbers and preferences are stored as local memory. Useful Q/A and Builder workflows become reusable lessons for next time.
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
                <div className="flex items-center gap-2 text-slate-200">
                  <ShieldCheck className="w-4 h-4 text-[#22c55e]" />
                  <span className="text-[10px] font-mono uppercase tracking-widest">Local mode</span>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  Keeps replies anchored to local files, memory, notes, and saved plans.
                </p>
              </div>
              <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0d10] p-3">
                <div className="flex items-center gap-2 text-slate-200">
                  <FolderOpen className="w-4 h-4 text-amber-300" />
                  <span className="text-[10px] font-mono uppercase tracking-widest">Voice actions</span>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  Dictated commands are transcribed, then routed through the same calendar and notes automation path.
                </p>
              </div>
              <div className="col-span-2 rounded-2xl border border-[#22c55e]/20 bg-[#22c55e]/8 p-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#22c55e]">Learning examples</div>
                <p className="mt-2 text-[11px] leading-5 text-slate-400">
                  “My email is…”, “Marco phone is…”, “I prefer…”, “Remember that…” are saved locally. Ask “what is my email?” or “what do you know about me?” to retrieve them.
                </p>
              </div>
              <div className="col-span-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/8 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-cyan-200">Reusable task memory</div>
                  <div className="text-sm font-black text-slate-100">{experienceMemoryCount}</div>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-slate-400">
                  Repeated Builder, Relay, Moltbook, model and system-status tasks are matched against previous lessons so Baloss can answer faster and avoid old mistakes.
                </p>
              </div>
            </div>
          </DrawerSection>
            </div>
          )}
        </div>
    </div>
  );
}
