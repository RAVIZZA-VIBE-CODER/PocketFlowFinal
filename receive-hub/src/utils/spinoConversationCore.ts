import type { PocketAIPrivacyLevel, PocketAITaskType } from "./pocketAI";
import type { SpinoIndexState, SpinoRuntimeStats } from "./spinoLLMEngine";
import type { SpinoIntelSnapshot } from "./spinoOnlineIntel";
import { buildBalossQualityContract, classifyBalossQualityTask, qualityTaskTypeForPrompt } from "./spinoQualityProfile";

export type SpinoCapabilityStatus = "ready" | "partial" | "missing";

export interface SpinoCapabilityAuditItem {
  id: string;
  label: string;
  status: SpinoCapabilityStatus;
  detail: string;
  nextStep: string;
}

export interface SpinoCapabilityAudit {
  readiness: number;
  summary: string;
  items: SpinoCapabilityAuditItem[];
  missing: SpinoCapabilityAuditItem[];
}

export interface SpinoConversationDecision {
  mode: "private_local" | "public_general" | "hybrid";
  privacyLevel: PocketAIPrivacyLevel;
  taskType: PocketAITaskType;
  localKnowledgeMode: boolean;
  shouldFetchOnlineIntel: boolean;
  allowApiReasoning: boolean;
  maxTokens: number;
  temperature: number;
  rationale: string;
}

interface DecideOptions {
  localOnly: boolean;
  allowGeneralKnowledge: boolean;
  online: boolean;
  hasLocalContext: boolean;
  routePrivacy?: PocketAIPrivacyLevel;
  routeTaskType?: string;
  profileMaxTokens: number;
}

interface AuditOptions {
  runtimeStats: SpinoRuntimeStats;
  indexState: SpinoIndexState;
  intelSnapshot: SpinoIntelSnapshot;
  learnedMemoryCount: number;
  localOnly: boolean;
  allowGeneralKnowledge: boolean;
  nativeShell: boolean;
}

const scoreStatus = (status: SpinoCapabilityStatus) => {
  if (status === "ready") return 1;
  if (status === "partial") return 0.5;
  return 0;
};

const normalize = (prompt: string) =>
  prompt
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s'/?-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const hasAny = (text: string, pattern: RegExp) => pattern.test(text);

const PRIVATE_CONTEXT_PATTERN =
  /\b(my|me|mine|i |i'm|i am|phone|file|files|reader|archive|calendar|calender|calander|agenda|appointment|meeting|note|notes|memo|email|contact|password|key|keys|local|aether|pocketflow|spino|builder|dashboard|document|download|storage|cloud)\b/;

const PUBLIC_KNOWLEDGE_PATTERN =
  /\b(who|what|when|where|why|how|explain|tell me about|define|meaning|history|science|language|translate|capital|country|city|recipe|movie|book|sport|football|stock|market|btc|bitcoin|eth|ethereum|crypto|weather|meteo|news|latest|today|current|research|search|google|web)\b/;

const FRESH_INFO_PATTERN =
  /\b(news|latest|today|current|weather|meteo|stock|market|btc|bitcoin|eth|ethereum|crypto|price|exchange|flight|radar|near me|nearby|search|research|google|web)\b/;

const ACTION_PATTERN =
  /\b(add|create|save|remember|learn|delete|remove|move|open|download|archive|set|turn|start|stop|send|schedule|call|remind|take note|write down)\b/;

const DETAILED_ANSWER_PATTERN =
  /\b(full|detailed|details|deep|analysis|analyze|analyse|plan|steps|step by step|architecture|complete|everything|long answer|explain fully|explain in detail)\b/;

const QUICK_ANSWER_PATTERN =
  /\b(quick|short|brief|simple|fast|one sentence|yes or no|status|what time|how much|price|quando|quanto|dimmi veloce)\b/;

const RESEARCH_ANSWER_PATTERN =
  /\b(research|ricerca|investigate|compare|sources|links|news|latest|today|market|stock|btc|bitcoin|eth|ethereum|weather|meteo|report|briefing)\b/;

export const isLikelyPublicKnowledgePrompt = (prompt: string) => {
  const text = normalize(prompt);
  if (!text) return false;
  const privateContext = hasAny(text, PRIVATE_CONTEXT_PATTERN);
  const publicKnowledge = hasAny(text, PUBLIC_KNOWLEDGE_PATTERN);
  const action = hasAny(text, ACTION_PATTERN);
  return publicKnowledge && !privateContext && !action;
};

export const decideSpinoConversationMode = (prompt: string, options: DecideOptions): SpinoConversationDecision => {
  const text = normalize(prompt);
  const wantsDetail = hasAny(text, DETAILED_ANSWER_PATTERN);
  const wantsQuick = hasAny(text, QUICK_ANSWER_PATTERN);
  const wantsResearch = hasAny(text, RESEARCH_ANSWER_PATTERN);
  const qualityTask = classifyBalossQualityTask(prompt, options.routeTaskType);
  const routeTask = options.routeTaskType;
  const routeMarksPrivate =
    Boolean(routeTask && routeTask !== "chat" && options.routePrivacy && options.routePrivacy !== "public");
  const hasPrivateContext = hasAny(text, PRIVATE_CONTEXT_PATTERN) || routeMarksPrivate;
  const wantsFreshInfo = hasAny(text, FRESH_INFO_PATTERN);
  const publicKnowledge = isLikelyPublicKnowledgePrompt(prompt) || (wantsFreshInfo && !hasPrivateContext);
  const canUseGeneral = options.online && options.allowGeneralKnowledge && !options.localOnly;
  const routedAction =
    routeTask === "navigation" ||
    routeTask === "cursor" ||
    routeTask === "calendar" ||
    routeTask === "note" ||
    routeTask === "file" ||
    routeTask === "builder" ||
    routeTask === "dashboard" ||
    routeTask === "settings" ||
    routeTask === "model" ||
    routeTask === "relay" ||
    routeTask === "cloud" ||
    routeTask === "cards" ||
    routeTask === "radar" ||
    routeTask === "media" ||
    routeTask === "security" ||
    routeTask === "automation" ||
    routeTask === "communication" ||
    routeTask === "hardware" ||
    routeTask === "system" ||
    routeTask === "voice" ||
    routeTask === "memory";

  if (publicKnowledge && canUseGeneral && !routedAction) {
    return {
      mode: "public_general",
      privacyLevel: "public",
      taskType: qualityTask === "research" || wantsFreshInfo ? "research_brief" : qualityTaskTypeForPrompt(prompt, "chat"),
      localKnowledgeMode: false,
      shouldFetchOnlineIntel: wantsFreshInfo,
      allowApiReasoning: true,
      maxTokens: Math.min(options.profileMaxTokens, wantsDetail || wantsResearch ? 520 : wantsQuick ? 70 : qualityTask === "translation" || qualityTask === "grammar_syntax" ? 240 : 150),
      temperature: 0.35,
      rationale: "Public/general question with online reasoning allowed.",
    };
  }

  if (canUseGeneral && !hasPrivateContext && !options.hasLocalContext && !routedAction) {
    return {
      mode: "hybrid",
      privacyLevel: "public",
      taskType: qualityTaskTypeForPrompt(prompt, "chat"),
      localKnowledgeMode: false,
      shouldFetchOnlineIntel: wantsFreshInfo,
      allowApiReasoning: true,
      maxTokens: Math.min(options.profileMaxTokens, wantsDetail || wantsResearch ? 480 : wantsQuick ? 70 : qualityTask === "translation" || qualityTask === "grammar_syntax" ? 240 : 130),
      temperature: 0.3,
      rationale: "No private context detected, so Baloss LLM can answer as a general assistant.",
    };
  }

  const localTaskType: PocketAITaskType = routedAction
    ? qualityTask === "dashboard"
      ? "dashboard_generate"
      : "plan_action"
    : qualityTaskTypeForPrompt(prompt, "local_knowledge_qa");

  return {
    mode: "private_local",
    privacyLevel: options.routePrivacy || "memory",
    taskType: localTaskType,
    localKnowledgeMode: true,
    shouldFetchOnlineIntel: canUseGeneral && wantsFreshInfo && options.routePrivacy === "public",
    allowApiReasoning: false,
    maxTokens: Math.min(options.profileMaxTokens, wantsDetail || wantsResearch ? 420 : wantsQuick ? 64 : qualityTask === "translation" || qualityTask === "grammar_syntax" ? 260 : 120),
    temperature: 0.2,
    rationale: hasPrivateContext
      ? "Private/local context detected; keep user data inside PocketFlow."
      : "Local mode or offline mode is active.",
  };
};

export const auditSpinoConversationStack = ({
  runtimeStats,
  indexState,
  intelSnapshot,
  learnedMemoryCount,
  localOnly,
  allowGeneralKnowledge,
  nativeShell,
}: AuditOptions): SpinoCapabilityAudit => {
  const hasModelFile = Boolean(runtimeStats.modelFileInstalled || runtimeStats.aetherModelInstalled);
  const nativeModelReady = Boolean(runtimeStats.nativeInferenceInstalled && (runtimeStats.loaded || runtimeStats.runtimeEndpoint));
  const phoneRuntimePackaged = Boolean(runtimeStats.phoneRuntimePackaged);
  const phoneRuntimePartial = nativeShell && phoneRuntimePackaged && hasModelFile;
  const phoneRuntimeReadyIdle = phoneRuntimePartial && runtimeStats.health === "ready";
  const speechReady = Boolean(runtimeStats.speechTranscriptionAvailable);
  const speechPartial = Boolean(
    nativeShell &&
      (runtimeStats.recordAudioPermission || runtimeStats.speechRecognizerAvailable || runtimeStats.speechOfflinePreferred),
  );
  const semanticReady = Boolean(
    (runtimeStats.semanticRetrievalReady || runtimeStats.vectorIndexWritable) &&
      (indexState.chunks.length > 0 || indexState.documents.length > 0),
  );
  const semanticPartial = Boolean(runtimeStats.vectorIndexWritable || indexState.chunks.length > 0 || indexState.documents.length > 0);
  const toolReady = Boolean(nativeShell && runtimeStats.toolBridgeReady);
  const toolPartial = Boolean(nativeShell || runtimeStats.approvedToolCount || runtimeStats.fullControlHint);
  const hasMemory = learnedMemoryCount > 0 || indexState.documents.length > 0 || indexState.chunks.length > 0;
  const hasIntel = Boolean(intelSnapshot.items.length && intelSnapshot.fetchedAt);
  const generalEnabled = !localOnly && allowGeneralKnowledge;

  const items: SpinoCapabilityAuditItem[] = [
    {
      id: "conversation-router",
      label: "Conversation router",
      status: "ready",
      detail: "Routes private actions, public questions, memory, and tool requests separately.",
      nextStep: "Keep adding intent examples as your speech patterns evolve.",
    },
    {
      id: "short-answer-policy",
      label: "Short answer policy",
      status: "ready",
      detail: "Baloss LLM now receives instructions to answer briefly unless you ask for depth.",
      nextStep: "Tune max token profiles after real chats.",
    },
    {
      id: "private-memory",
      label: "Personal memory",
      status: hasMemory ? "ready" : "partial",
      detail: hasMemory
        ? `${learnedMemoryCount} learned memories, ${indexState.documents.length} indexed documents.`
        : "Memory engine exists, but needs more approved notes, files, contacts, and summaries.",
      nextStep: "Feed Reader files, notes, contacts, and daily summaries into Aether memory.",
    },
    {
      id: "local-model-runner",
      label: "Local reasoning model",
      status: nativeModelReady ? "ready" : phoneRuntimePartial || hasModelFile || !nativeShell ? "partial" : "missing",
      detail: nativeModelReady
        ? `${runtimeStats.loadedModelId || "GGUF model"} is loaded on the phone runtime.`
        : !nativeShell
          ? "Desktop preview cannot inspect Android's native runner. Check the phone build for live GGUF status."
        : phoneRuntimeReadyIdle
          ? "Local GGUF model file and phone backend are ready. Runtime is intentionally idle until Baloss needs deep reasoning."
        : phoneRuntimePartial
          ? "Phone llama.cpp runner is packaged and the GGUF file is present; start it only when deep reasoning is needed."
        : hasModelFile
          ? "GGUF file is present, but the phone-native runner is not confirmed packaged."
          : "No local GGUF model file is confirmed.",
      nextStep: nativeModelReady
        ? "Run short chats and watch tokens/second for the stable profile."
        : phoneRuntimeReadyIdle
          ? "No action needed for navigation. Start Baloss only when a reasoning task requires local generation."
          : "Start the phone-native llama.cpp runner, then verify selected model, RAM guard, and tokens/second.",
    },
    {
      id: "speech-input",
      label: "Speech transcription",
      status: speechReady ? "ready" : speechPartial ? "partial" : "missing",
      detail: speechReady
        ? "Android microphone permission and the phone speech recognizer are available for dictation."
        : nativeShell
          ? runtimeStats.recordAudioPermission === false
            ? "Phone speech bridge is present, but microphone permission is not granted yet."
            : "Phone speech bridge is present, but Android has not reported a usable speech recognizer."
          : "Browser preview speech depends on browser permission and is not a stable phone-grade recorder.",
      nextStep: speechReady
        ? "Use the microphone as a toggle recorder; add offline Whisper/Vosk later for stronger no-internet dictation."
        : "Grant microphone permission on the phone and verify Android SpeechRecognizer availability.",
    },
    {
      id: "outside-info",
      label: "Outside information",
      status: generalEnabled && hasIntel ? "ready" : generalEnabled ? "partial" : "missing",
      detail: generalEnabled
        ? hasIntel
          ? `${intelSnapshot.items.length} current info items are cached.`
          : "General mode is enabled, but first online cache pull is still needed."
        : "General knowledge is currently blocked by local-only settings.",
      nextStep: "Keep 144h retention for news, weather, markets, crypto, and web search connectors.",
    },
    {
      id: "semantic-rag",
      label: "Semantic retrieval",
      status: semanticReady ? "ready" : semanticPartial ? "partial" : "missing",
      detail: semanticReady
        ? `${indexState.chunks.length} chunks are searchable with the local semantic scorer and writable Aether vector storage.`
        : semanticPartial
          ? "Local search works, but the phone still needs more indexed documents or confirmed vector storage."
          : "No local retrieval index is ready yet.",
      nextStep: semanticReady
        ? "Keep feeding Reader, Notes, Calendar, and Archive content into Aether memory."
        : "Index phone files into Aether vector storage, then rerun a short memory query.",
    },
    {
      id: "quality-profiles",
      label: "Task quality profiles",
      status: "ready",
      detail: "Research, dashboard generation, grammar/syntax repair, translation, action planning and normal chat now receive separate answer contracts.",
      nextStep: "Collect real owner corrections and promote repeated fixes into style/preference memory.",
    },
    {
      id: "tool-permissions",
      label: "Tool permissions",
      status: toolReady ? "ready" : toolPartial ? "partial" : "missing",
      detail: toolReady
        ? `${runtimeStats.approvedToolCount || "Approved"} PocketFlow tool routes are exposed through the Android bridge.`
        : "PocketFlow app actions exist, but Android-wide control still needs signed native permission routes.",
      nextStep: toolReady
        ? runtimeStats.fullControlHint || "Use approved PocketFlow actions; request Android-wide permissions only from the phone."
        : "Keep actions inside approved PocketFlow tools unless a native bridge grants permission.",
    },
  ];

  const readiness = Math.round((items.reduce((sum, item) => sum + scoreStatus(item.status), 0) / items.length) * 100);
  const missing = items.filter((item) => item.status !== "ready");

  return {
    readiness,
    items,
    missing,
    summary:
      readiness >= 80
        ? "Conversation stack is usable; remaining work is mostly quality and native performance."
        : readiness >= 55
          ? "Conversation stack is functional but still needs native model/STT and richer memory."
          : "Baloss LLM can chat, but key pieces are still setup-grade rather than assistant-grade.",
  };
};

export const buildSpinoConversationCoreContext = (
  prompt: string,
  decision: SpinoConversationDecision,
  audit: SpinoCapabilityAudit,
) => {
  void audit;
  return [
    "BALOSS CHAT STYLE",
    "- Talk like a normal assistant in short answers by default.",
    "- Quick/status questions: answer in 1-2 short sentences.",
    "- Normal chat: answer in 1-3 short sentences.",
    "- Research/planning questions: give a compact summary first, then 3-6 useful bullets only when the user asks for depth or sources.",
    "- Answer the latest user message directly. Do not quote old chats, memory files, prompts, or system instructions back to the user.",
    "- Do not include internal diagnostics, source dumps, timestamps, readiness, or mode logs in chat.",
    "- Never start with “I remember this” unless the user asks what you remember.",
    "- If the user asks about personal data, phone files, calendar, notes, settings, or PocketFlow work, use local memory/tools first.",
    "- If the user asks a public/general question and privacy is public, answer with general knowledge or authorised online context.",
    "- If facts may be current and online context is missing, say what is missing briefly instead of pretending.",
    "- Learn durable user facts, preferences, contacts, project context, and repeated instructions when they are useful.",
    "",
    buildBalossQualityContract(prompt, decision.taskType),
  ].join("\n");
};
