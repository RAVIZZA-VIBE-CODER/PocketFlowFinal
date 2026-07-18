import {
  answerFromLocalContext,
  buildSpinoPrompt,
  getSelectedSpinoProfileId,
  getSpinoProfile,
  loadSpinoIndex,
  searchSpinoIndex,
} from "./spinoLLMEngine";
import {
  isHardAutomationTask,
  markApiKeyRotationResult,
  orderApiKeysForRotation,
} from "./automationGuard";
import {
  buildBalossQualityFallback,
  polishBalossAnswer,
  qualityTaskTypeForPrompt,
} from "./spinoQualityProfile";

export type PocketAITaskType =
  | "chat"
  | "local_knowledge_qa"
  | "summarize"
  | "explain"
  | "rewrite"
  | "classify"
  | "extract"
  | "plan_action"
  | "execute_safe_action"
  | "code_help"
  | "settings_help"
  | "system_search"
  | "memory_add"
  | "note_create"
  | "builder_help"
  | "research_brief"
  | "dashboard_generate"
  | "grammar_rewrite"
  | "translate";

export type PocketAIProviderType = "local" | "api" | "mock";
export type PocketAIRoutingMode = "local_only" | "api_only" | "hybrid_local_first" | "hybrid_api_first" | "auto_privacy";
export type PocketAIPrivacyLevel = "private" | "local_files" | "notes" | "memory" | "device" | "public";

export interface PocketAIRequest {
  taskType: PocketAITaskType;
  prompt: string;
  messages?: { role: "system" | "user" | "assistant"; content: string }[];
  context?: string;
  attachments?: { name: string; type: string; content?: string }[];
  localKnowledgeMode?: boolean;
  allowedTools?: string[];
  privacyLevel?: PocketAIPrivacyLevel;
  maxTokens?: number;
  temperature?: number;
  requireJson?: boolean;
  sourceFeature?: string;
  actionIntent?: string;
}

export interface PocketAIResponse {
  text: string;
  toolCalls?: unknown[];
  sources?: { title: string; path?: string; excerpt?: string; score?: number }[];
  providerId: string;
  modelId?: string;
  usage?: { promptTokens?: number; completionTokens?: number; costUsd?: number };
  error?: string;
  safetyStatus: "ok" | "blocked" | "needs_confirmation";
  wasFallback?: boolean;
}

export interface PocketAIProvider {
  id: string;
  displayName: string;
  type: PocketAIProviderType;
  isAvailable(): Promise<boolean>;
  getCapabilities(): string[];
  generate(request: PocketAIRequest, onToken?: (token: string) => void): Promise<PocketAIResponse>;
  stop(): void;
  estimateCost?(request: PocketAIRequest): Promise<number>;
  getStatus(): Promise<{ ok: boolean; message: string; modelId?: string }>;
}

export interface PocketAISettings {
  mode: PocketAIRoutingMode;
  defaultLocalProvider: "spinollm";
  defaultApiProvider: "openai_compatible" | "anthropic_compatible" | "gemini_compatible" | "custom_endpoint";
  apiBaseUrl: string;
  apiModel: string;
  selectedApiKeyId: string;
  offlineMode: boolean;
  allowApiFallback: boolean;
  allowLocalFallback: boolean;
  blockLocalFilesToApi: boolean;
  blockMemoryToApi: boolean;
  blockNotesToApi: boolean;
  allowApiForPublicPromptsOnly: boolean;
  warnBeforeRemoteContext: boolean;
  perFeatureRouting: Record<PocketAITaskType, "system" | PocketAIRoutingMode>;
  lastRoutingDecision?: string;
  lastError?: string;
}

export interface PocketAIKeyRecord {
  id: string;
  label: string;
  provider: PocketAISettings["defaultApiProvider"];
  masked: string;
  healthy: boolean;
  createdAt: string;
}

const SETTINGS_KEY = "pocketflow.pocketai.settings";
const KEY_META_KEY = "pocketflow.pocketai.keyMeta";
const KEY_SECRET_PREFIX = "pocketflow.pocketai.secret.";
const KEY_SECRET_PERSIST_PREFIX = "pocketflow.pocketai.persistedSecret.";
const LOCAL_BUSY_KEY = "pocketflow.pocketai.local.busy";

export const POCKET_AI_TASK_TYPES: PocketAITaskType[] = [
  "chat",
  "local_knowledge_qa",
  "summarize",
  "explain",
  "rewrite",
  "classify",
  "extract",
  "plan_action",
  "execute_safe_action",
  "code_help",
  "settings_help",
  "system_search",
  "memory_add",
  "note_create",
  "builder_help",
  "research_brief",
  "dashboard_generate",
  "grammar_rewrite",
  "translate",
];

export const POCKET_AI_PROVIDER_LABELS: Record<PocketAISettings["defaultApiProvider"], string> = {
  openai_compatible: "OpenAI-compatible",
  anthropic_compatible: "Anthropic-compatible",
  gemini_compatible: "Gemini-compatible",
  custom_endpoint: "Custom endpoint",
};

export const POCKET_AI_MODE_LABELS: Record<PocketAIRoutingMode, string> = {
  local_only: "Local only",
  api_only: "API only",
  hybrid_local_first: "Hybrid local first",
  hybrid_api_first: "Hybrid API first",
  auto_privacy: "Auto privacy",
};

const defaultFeatureRouting = (): Record<PocketAITaskType, "system" | PocketAIRoutingMode> =>
  POCKET_AI_TASK_TYPES.reduce((acc, task) => {
    acc[task] = "system";
    return acc;
  }, {} as Record<PocketAITaskType, "system" | PocketAIRoutingMode>);

const FAST_LOCAL_TASKS = new Set<PocketAITaskType>([
  "classify",
  "extract",
  "plan_action",
  "execute_safe_action",
  "settings_help",
  "system_search",
  "memory_add",
  "note_create",
]);

const DEEP_REASONING_PATTERN =
  /\b(reason|reasoning|analyse|analyze|analysis|audit|benchmark|architecture|debug|explain|compare|strategy|trade[- ]?off|optimi[sz]e|investigate|research|deep|complex|why|root cause)\b/i;

const QUICK_ACTION_PATTERN =
  /\b(open|show|status|list|start|stop|send|schedule|save|remember|add note|take note|archive|download|copy|move|scan|refresh|check|quick|brief|yes or no)\b/i;

const EXACT_ONLY_PATTERN =
  /\b(?:reply|respond|answer|return|say|output)\s+(?:with\s+)?["'`]?([^"'`\n]{1,80}?)["'`]?\s+only[.!?]?\s*$/i;

const GENERIC_EXACT_FORMAT_PATTERN = /^(json|xml|markdown|html|bullet points?|one sentence|short|brief|concise|facts?|details?)$/i;

const extractExactOnlyReply = (prompt: string) => {
  const match = prompt.trim().match(EXACT_ONLY_PATTERN);
  if (!match) return "";
  const literal = match[1].trim().replace(/\s+/g, " ");
  if (!literal || GENERIC_EXACT_FORMAT_PATTERN.test(literal)) return "";
  return literal;
};

const shouldUseNativeReasoning = (request: PocketAIRequest, hasLocalResults: boolean) => {
  if (extractExactOnlyReply(request.prompt)) return false;
  if (FAST_LOCAL_TASKS.has(request.taskType)) return false;
  if (request.taskType === "local_knowledge_qa" && hasLocalResults && !DEEP_REASONING_PATTERN.test(request.prompt)) return false;
  if (QUICK_ACTION_PATTERN.test(request.prompt) && !DEEP_REASONING_PATTERN.test(request.prompt)) return false;
  return true;
};

export const defaultPocketAISettings = (): PocketAISettings => ({
  mode: "auto_privacy",
  defaultLocalProvider: "spinollm",
  defaultApiProvider: "openai_compatible",
  apiBaseUrl: "https://api.openai.com/v1",
  apiModel: "gpt-4.1-mini",
  selectedApiKeyId: "",
  offlineMode: false,
  allowApiFallback: false,
  allowLocalFallback: true,
  blockLocalFilesToApi: true,
  blockMemoryToApi: true,
  blockNotesToApi: true,
  allowApiForPublicPromptsOnly: true,
  warnBeforeRemoteContext: true,
  perFeatureRouting: defaultFeatureRouting(),
});

export const loadPocketAISettings = (): PocketAISettings => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (parsed && typeof parsed === "object") {
      return {
        ...defaultPocketAISettings(),
        ...parsed,
        perFeatureRouting: { ...defaultFeatureRouting(), ...(parsed.perFeatureRouting || {}) },
      };
    }
  } catch {}
  return defaultPocketAISettings();
};

export const savePocketAISettings = (settings: PocketAISettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

export const loadPocketAIKeyMetadata = (): PocketAIKeyRecord[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY_META_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const savePocketAIKeyMetadata = (keys: PocketAIKeyRecord[]) => {
  localStorage.setItem(KEY_META_KEY, JSON.stringify(keys));
};

export const maskApiKey = (key: string) => {
  const clean = key.trim();
  if (clean.length <= 12) return "••••";
  return `${clean.slice(0, 6)}••••${clean.slice(-4)}`;
};

const collectJsonStrings = (value: unknown, output: string[]) => {
  if (typeof value === "string") {
    output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonStrings(item, output));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectJsonStrings(item, output));
  }
};

export const extractApiKeyCandidates = (raw: string) => {
  const jsonStrings: string[] = [];
  const normalized = raw
    .replace(/[\u2018\u2019\u201c\u201d]/g, "\"")
    .replace(/\\n/g, "\n")
    .replace(/[|;]/g, "\n");

  try {
    collectJsonStrings(JSON.parse(normalized), jsonStrings);
  } catch {}

  const searchText = [normalized, ...jsonStrings].join("\n");
  const knownMatches = searchText.match(
    /(gsk_[A-Za-z0-9_-]{10,}|sk-proj-[A-Za-z0-9_-]{12,}|sk-[A-Za-z0-9_-]{12,}|hf_[A-Za-z0-9_-]{12,}|xai-[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{20,})/g,
  ) || [];
  const splitMatches = searchText
    .replace(/[:=]/g, " ")
    .split(/[\s,\n\r]+/)
    .map((part) => part.trim().replace(/^[`"'[\]{}()<>\s]+|[`"'[\]{}()<>\s.,]+$/g, ""))
    .filter((part) => {
      if (part.length < 20) return false;
      if (/^https?:\/\//i.test(part) || part.includes("/") || part.includes(".")) return false;
      if (!/^[A-Za-z0-9_-]+$/.test(part)) return false;
      return /[A-Za-z]/.test(part) && /[0-9]/.test(part);
    });

  return [...new Set([...knownMatches, ...splitMatches])];
};

export const savePocketAIKeySecret = (id: string, key: string) => {
  const clean = key.trim();
  sessionStorage.setItem(`${KEY_SECRET_PREFIX}${id}`, clean);
  localStorage.setItem(`${KEY_SECRET_PERSIST_PREFIX}${id}`, clean);
};

export const loadPocketAIKeySecret = (id: string) => {
  const sessionSecret = sessionStorage.getItem(`${KEY_SECRET_PREFIX}${id}`) || "";
  if (sessionSecret) return sessionSecret;
  const persistedSecret = localStorage.getItem(`${KEY_SECRET_PERSIST_PREFIX}${id}`) || "";
  if (persistedSecret) {
    sessionStorage.setItem(`${KEY_SECRET_PREFIX}${id}`, persistedSecret);
  }
  return persistedSecret;
};

export const deletePocketAIKeySecret = (id: string) => {
  sessionStorage.removeItem(`${KEY_SECRET_PREFIX}${id}`);
  localStorage.removeItem(`${KEY_SECRET_PERSIST_PREFIX}${id}`);
};

export const createPocketAIKeyRecord = (
  label: string,
  key: string,
  provider: PocketAIKeyRecord["provider"],
): PocketAIKeyRecord => ({
  id: `pai_key_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
  label: label.trim() || `${provider.replace("_", " ")} key`,
  provider,
  masked: maskApiKey(key),
  healthy: key.trim().length >= 20,
  createdAt: new Date().toISOString(),
});

export const markPocketAILocalBusy = (taskType: PocketAITaskType) => {
  sessionStorage.setItem(LOCAL_BUSY_KEY, JSON.stringify({ taskType, startedAt: Date.now() }));
};

export const clearPocketAILocalBusy = () => {
  sessionStorage.removeItem(LOCAL_BUSY_KEY);
};

export const readPocketAILocalBusy = (): { busy: boolean; taskType?: PocketAITaskType; ageMs: number } => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(LOCAL_BUSY_KEY) || "null");
    if (parsed?.startedAt) {
      return { busy: true, taskType: parsed.taskType, ageMs: Math.max(0, Date.now() - parsed.startedAt) };
    }
  } catch {}
  return { busy: false, ageMs: 0 };
};

class SpinoLLMProvider implements PocketAIProvider {
  id = "spinollm";
  displayName = "Baloss LLM";
  type: PocketAIProviderType = "local";

  async isAvailable() {
    return true;
  }

  getCapabilities() {
    return [
      "offline",
      "local_knowledge_qa",
      "chat",
      "summarize",
      "settings_help",
      "system_search",
      "research_brief",
      "dashboard_generate",
      "grammar_rewrite",
      "translate",
      "memory_add",
      "note_create",
    ];
  }

  async getStatus() {
    if (window.PocketFlowReceiveBridge?.spinoGetRuntimeStats) {
      const status = await window.PocketFlowReceiveBridge.spinoGetRuntimeStats();
      return { ok: true, message: status.message || "Baloss LLM bridge ready.", modelId: status.loadedModelId };
    }
    return { ok: true, message: "Baloss LLM WebView retrieval ready." };
  }

  stop() {}

  async generate(request: PocketAIRequest, onToken?: (token: string) => void): Promise<PocketAIResponse> {
    markPocketAILocalBusy(request.taskType);
    const exactReply = extractExactOnlyReply(request.prompt);
    const profile = getSpinoProfile(getSelectedSpinoProfileId());
    const index = loadSpinoIndex();
    const results = searchSpinoIndex(request.prompt, index, profile.topK);
    const effectiveTaskType = qualityTaskTypeForPrompt(request.prompt, request.taskType);
    const prompt = buildSpinoPrompt(request.prompt, results, request.context || "", effectiveTaskType);
    const useNativeReasoning = shouldUseNativeReasoning(request, results.length > 0);
    let text = "";
    let providerId = this.id;
    let modelId = useNativeReasoning ? "Baloss retrieval fallback" : "Baloss fast local lane";

    try {
      if (exactReply) {
        text = exactReply;
        providerId = `${this.id}-exact-lane`;
        modelId = "Baloss exact command lane";
      }

      if (useNativeReasoning && window.PocketFlowReceiveBridge?.spinoGenerate) {
        try {
          const native = await window.PocketFlowReceiveBridge.spinoGenerate(prompt, JSON.stringify({
            taskType: effectiveTaskType,
            maxTokens: request.maxTokens || profile.maxAnswerTokens,
            temperature: request.temperature ?? 0.2,
          }));
          if (native?.ok && native.text) {
            text = native.text;
            modelId = "Baloss Qwen 9B reasoning lane";
          }
        } catch {}
      }

      if (!text) {
        text = buildBalossQualityFallback(request.prompt, effectiveTaskType)
          || answerFromLocalContext(request.prompt, results, request.localKnowledgeMode !== false, request.context || "");
        providerId = useNativeReasoning ? `${this.id}-retrieval-fallback` : `${this.id}-fast-lane`;
      }

      text = polishBalossAnswer(text, request.prompt, effectiveTaskType);

      onToken?.(text);
      return {
        text,
        providerId,
        modelId,
        sources: results.map((result) => ({
          title: result.document.title,
          path: result.document.path,
          excerpt: result.chunk.text.slice(0, 240),
          score: result.score,
        })),
        safetyStatus: "ok",
      };
    } finally {
      clearPocketAILocalBusy();
    }
  }
}

class OpenAICompatibleProvider implements PocketAIProvider {
  id: string;
  displayName: string;
  type: PocketAIProviderType = "api";
  private settings: PocketAISettings;

  constructor(settings: PocketAISettings) {
    this.settings = settings;
    this.id = settings.defaultApiProvider;
    this.displayName = `${POCKET_AI_PROVIDER_LABELS[settings.defaultApiProvider]} API`;
  }

  async isAvailable() {
    return !!this.settings.selectedApiKeyId && !!loadPocketAIKeySecret(this.settings.selectedApiKeyId);
  }

  getCapabilities() {
    return ["chat", "summarize", "explain", "rewrite", "classify", "extract", "code_help", "builder_help", "settings_help", "research_brief", "dashboard_generate", "grammar_rewrite", "translate"];
  }

  async getStatus() {
    const available = await this.isAvailable();
    return {
      ok: available,
      message: available ? `API key configured for ${POCKET_AI_PROVIDER_LABELS[this.settings.defaultApiProvider]}.` : "No API key configured.",
      modelId: this.settings.apiModel,
    };
  }

  stop() {}

  private async generateAnthropic(request: PocketAIRequest, apiKey: string) {
    const response = await fetch(`${this.settings.apiBaseUrl.replace(/\/$/, "")}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.settings.apiModel,
        system: "You are PocketAI, the central assistant layer for PocketFlow OS. Be concise and practical.",
        messages: request.messages?.filter((message) => message.role !== "system") || [
          { role: "user", content: [request.context, request.prompt].filter(Boolean).join("\n\n") },
        ],
        max_tokens: request.maxTokens || 512,
        temperature: request.temperature ?? 0.2,
      }),
    });
    if (!response.ok) throw new Error(`API error ${response.status}`);
    const data = await response.json();
    return {
      text: data?.content?.map((part: { text?: string }) => part.text || "").join("") || "",
      usage: {
        promptTokens: data?.usage?.input_tokens,
        completionTokens: data?.usage?.output_tokens,
      },
    };
  }

  private async generateGemini(request: PocketAIRequest, apiKey: string) {
    const base = this.settings.apiBaseUrl.replace(/\/$/, "");
    const endpoint = `${base}/models/${encodeURIComponent(this.settings.apiModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const userText = request.messages?.map((message) => `${message.role.toUpperCase()}: ${message.content}`).join("\n\n")
      || [request.context, request.prompt].filter(Boolean).join("\n\n");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: {
          maxOutputTokens: request.maxTokens || 512,
          temperature: request.temperature ?? 0.2,
          responseMimeType: request.requireJson ? "application/json" : undefined,
        },
      }),
    });
    if (!response.ok) throw new Error(`API error ${response.status}`);
    const data = await response.json();
    return {
      text: data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "",
      usage: {
        promptTokens: data?.usageMetadata?.promptTokenCount,
        completionTokens: data?.usageMetadata?.candidatesTokenCount,
      },
    };
  }

  private async generateOpenAICompatible(request: PocketAIRequest, apiKey: string) {
    const response = await fetch(`${this.settings.apiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.settings.apiModel,
        messages: request.messages?.length
          ? request.messages
          : [
              { role: "system", content: "You are PocketAI, the central assistant layer for PocketFlow OS. Be concise and practical." },
              { role: "user", content: [request.context, request.prompt].filter(Boolean).join("\n\n") },
            ],
        max_tokens: request.maxTokens || 512,
        temperature: request.temperature ?? 0.2,
        response_format: request.requireJson ? { type: "json_object" } : undefined,
      }),
    });
    if (!response.ok) throw new Error(`API error ${response.status}`);
    const data = await response.json();
    return {
      text: data?.choices?.[0]?.message?.content || "",
      usage: {
        promptTokens: data?.usage?.prompt_tokens,
        completionTokens: data?.usage?.completion_tokens,
      },
    };
  }

  async generate(request: PocketAIRequest, onToken?: (token: string) => void): Promise<PocketAIResponse> {
    const keyMeta = loadPocketAIKeyMetadata();
    const hardTask = isHardAutomationTask(request.taskType, request.prompt);
    const selectedFirst = [
      this.settings.selectedApiKeyId,
      ...keyMeta.filter((key) => key.healthy).map((key) => key.id),
      ...keyMeta.map((key) => key.id),
    ].filter(Boolean);
    const tried = new Set<string>();
    const keyIds = selectedFirst.filter((id) => {
      if (tried.has(id)) return false;
      tried.add(id);
      return true;
    });
    const selectedKeyIds = orderApiKeysForRotation(
      keyIds.length > 0 ? keyIds : [this.settings.selectedApiKeyId],
      { taskType: request.taskType, hard: hardTask },
    );
    let lastError = "";

    for (const keyId of selectedKeyIds) {
      const apiKey = loadPocketAIKeySecret(keyId);
      if (!apiKey) continue;
      try {
        const result = this.settings.defaultApiProvider === "anthropic_compatible"
          ? await this.generateAnthropic(request, apiKey)
          : this.settings.defaultApiProvider === "gemini_compatible"
            ? await this.generateGemini(request, apiKey)
            : await this.generateOpenAICompatible(request, apiKey);
        markApiKeyRotationResult(keyId, { ok: true, taskType: request.taskType, hard: hardTask });
        onToken?.(result.text);
        return {
          text: result.text,
          providerId: this.id,
          modelId: this.settings.apiModel,
          usage: result.usage,
          safetyStatus: "ok",
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : "API request failed.";
        markApiKeyRotationResult(keyId, { ok: false, taskType: request.taskType, hard: hardTask, error: lastError });
        const transientLimit = /429|quota|rate|limit|exhausted|too many/i.test(lastError);
        if (!transientLimit) break;
      }
    }

    const apiKey = "";
    if (!apiKey) {
      return {
        text: "",
        providerId: this.id,
        modelId: this.settings.apiModel,
        error: lastError || "No API key configured.",
        safetyStatus: "blocked",
      };
    }
  }
}

class MockProvider implements PocketAIProvider {
  id = "mock";
  displayName = "Mock Provider";
  type: PocketAIProviderType = "mock";

  async isAvailable() {
    return true;
  }

  getCapabilities() {
    return POCKET_AI_TASK_TYPES;
  }

  async getStatus() {
    return { ok: true, message: "Mock PocketAI provider ready." };
  }

  stop() {}

  async generate(request: PocketAIRequest, onToken?: (token: string) => void): Promise<PocketAIResponse> {
    const text = `PocketAI mock response for ${request.taskType}: ${request.prompt.slice(0, 160)}`;
    onToken?.(text);
    return { text, providerId: this.id, modelId: "mock", safetyStatus: "ok" };
  }
}

export class PocketAIRouter {
  private settings: PocketAISettings;
  private lastDecision = "";
  private lastError = "";

  constructor(settings = loadPocketAISettings()) {
    this.settings = settings;
  }

  private providers() {
    return {
      spinollm: new SpinoLLMProvider(),
      api: new OpenAICompatibleProvider(this.settings),
      mock: new MockProvider(),
    };
  }

  explainRoutingDecision(request: PocketAIRequest) {
    const mode = this.effectiveMode(request);
    const decision = `mode=${mode}; task=${request.taskType}; privacy=${request.privacyLevel || "private"}`;
    this.lastDecision = decision;
    return decision;
  }

  async getProviderStatus() {
    const providers = this.providers();
    return {
      local: await providers.spinollm.getStatus(),
      api: await providers.api.getStatus(),
      mock: await providers.mock.getStatus(),
      lastDecision: this.lastDecision || this.settings.lastRoutingDecision || "",
      lastError: this.lastError || this.settings.lastError || "",
    };
  }

  getAvailableProviders() {
    return Object.values(this.providers());
  }

  private effectiveMode(request: PocketAIRequest): PocketAIRoutingMode {
    if (this.settings.offlineMode) return "local_only";
    const override = this.settings.perFeatureRouting[request.taskType];
    return override && override !== "system" ? override : this.settings.mode;
  }

  private privacyBlocksApi(request: PocketAIRequest) {
    const privacy = request.privacyLevel || "private";
    if (this.settings.allowApiForPublicPromptsOnly && privacy !== "public") return true;
    if (this.settings.blockLocalFilesToApi && privacy === "local_files") return true;
    if (this.settings.blockMemoryToApi && privacy === "memory") return true;
    if (this.settings.blockNotesToApi && privacy === "notes") return true;
    return privacy === "device" || request.taskType === "execute_safe_action";
  }

  private async chooseProvider(request: PocketAIRequest): Promise<PocketAIProvider> {
    const mode = this.effectiveMode(request);
    const providers = this.providers();
    this.lastDecision = this.explainRoutingDecision(request);
    if (mode === "local_only") return providers.spinollm;
    if (mode === "api_only") return this.privacyBlocksApi(request) ? providers.spinollm : providers.api;
    if (mode === "hybrid_api_first") return this.privacyBlocksApi(request) ? providers.spinollm : providers.api;
    if (mode === "auto_privacy") return this.privacyBlocksApi(request) ? providers.spinollm : providers.api;
    return providers.spinollm;
  }

  async generate(request: PocketAIRequest, onToken?: (token: string) => void): Promise<PocketAIResponse> {
    const providers = this.providers();
    const primary = await this.chooseProvider(request);
    const mode = this.effectiveMode(request);
    let response = await primary.generate(request, onToken);

    const canApiFallback =
      primary.id === "spinollm" &&
      (mode === "hybrid_local_first" || mode === "auto_privacy") &&
      this.settings.allowApiFallback &&
      !this.privacyBlocksApi(request) &&
      (await providers.api.isAvailable());

    if ((response.error || response.text.includes("does not have enough local information")) && canApiFallback) {
      response = await providers.api.generate(request, onToken);
      response.wasFallback = true;
    }

    const canLocalFallback =
      primary.type === "api" &&
      this.settings.allowLocalFallback &&
      (response.error || !response.text);

    if (canLocalFallback) {
      response = await providers.spinollm.generate(request, onToken);
      response.wasFallback = true;
    }

    this.lastError = response.error || "";
    const next = { ...this.settings, lastRoutingDecision: this.lastDecision, lastError: this.lastError };
    savePocketAISettings(next);
    return response;
  }

  stopCurrent() {}
}

export const createPocketAIRouter = (settings = loadPocketAISettings()) => new PocketAIRouter(settings);
