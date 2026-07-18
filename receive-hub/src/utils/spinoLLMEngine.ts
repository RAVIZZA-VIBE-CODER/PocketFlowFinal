import type { PocketAITaskType } from "./pocketAI";
import { buildBalossQualityContract } from "./spinoQualityProfile";

export type SpinoProfileId = "ultraLow" | "low" | "balanced" | "performance" | "max";

export interface SpinoProfile {
  id: SpinoProfileId;
  label: string;
  nCtx: number;
  topK: number;
  maxAnswerTokens: number;
  threads: number;
  batch: string;
  mmap: boolean;
  mlock: boolean;
}

export interface SpinoModelRecord {
  id: string;
  name: string;
  size: number;
  path: string;
  importedAt: string;
  quantization: string;
  source: "localImport" | "nativeImport" | "downloadConfig";
  parameterClass?: string;
  optimizationStack?: string;
}

export interface SpinoDocumentRecord {
  id: string;
  path: string;
  title: string;
  type: string;
  size: number;
  modifiedAt: number;
  contentHash: string;
  indexedAt: string;
  metadata: Record<string, unknown>;
}

export interface SpinoChunkRecord {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  tokenEstimate: number;
  metadata: {
    sourcePath: string;
    title: string;
    heading?: string;
  };
}

export interface SpinoIndexState {
  knowledgeRoot: string;
  documents: SpinoDocumentRecord[];
  chunks: SpinoChunkRecord[];
  lastIndexedAt?: string;
}

export interface SpinoSearchResult {
  chunk: SpinoChunkRecord;
  document: SpinoDocumentRecord;
  score: number;
}

export interface SpinoRuntimeStats {
  backend: string;
  loaded: boolean;
  loadedModelId?: string;
  modelFileInstalled?: boolean;
  modelFileBytes?: number;
  modelFilePath?: string;
  runtimeEndpoint?: string;
  runtimeKind?: string;
  tokensPerSecond?: number;
  estimatedMemoryMb?: number;
  deviceMemoryAvailableMb?: number;
  swapFreeMb?: number;
  installedModels?: number;
  nativeInferenceInstalled?: boolean;
  phoneRuntimePackaged?: boolean;
  runtimeCanAutostart?: boolean;
  runtimeNeedsStart?: boolean;
  phoneRuntimeOwned?: boolean;
  phoneRuntimeStartedAt?: number;
  phoneRuntimeModelPath?: string;
  generationActive?: boolean;
  queueDepth?: number;
  memoryPressure?: "normal" | "high" | "critical";
  aetherModelInstalled?: boolean;
  recordAudioPermission?: boolean;
  speechRecognizerAvailable?: boolean;
  speechTranscriptionAvailable?: boolean;
  speechOfflinePreferred?: boolean;
  aetherStorageMounted?: boolean;
  aetherStorageWritable?: boolean;
  semanticRetrievalReady?: boolean;
  vectorIndexWritable?: boolean;
  toolBridgeReady?: boolean;
  approvedToolCount?: number;
  fullControlHint?: string;
  crashed?: boolean;
  health?: "healthy" | "busy" | "ready" | "limit" | "disconnected";
  message?: string;
  lastError?: string;
}

export interface AetherStorageStats {
  ok: boolean;
  mounted: boolean;
  writable: boolean;
  root: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  reserveBytes: number;
  reserveFreeBytes: number;
  folders: string[];
  message?: string;
}

const MODELS_KEY = "pocketflow.spinollm.models";
const INDEX_KEY = "pocketflow.spinollm.index";
const SELECTED_MODEL_KEY = "pocketflow.spinollm.selectedModel";
const PROFILE_KEY = "pocketflow.spinollm.profile";

export const SPINO_LEGACY_TINY_MODEL_IDS = new Set([
  "spino_optimized_tinyllama_1_1b_q3_k_s",
  "spino_aether_gemma_2_2b_it_iq3_m",
]);

export const SPINO_LEGACY_TINY_MODEL_NAMES = new Set([
  "TinyLlama-1.1B-Chat-v1.0-Q3_K_S.gguf",
  "gemma-2-2b-it-IQ3_M.gguf",
]);

export const SPINO_OPTIMIZED_MODEL_URL =
  "https://huggingface.co/unsloth/Qwen3.5-9B-GGUF/resolve/main/Qwen3.5-9B-Q5_K_M.gguf?download=true";

export const SPINO_MISTRAL_MODEL_URL =
  "https://huggingface.co/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf?download=true";

export const SPINO_SMALL_MODEL_URL =
  "https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf?download=true";

export const SPINO_SMALL_MODEL: SpinoModelRecord = {
  id: "spino_aether_gemma_2_2b_it_q4_k_m",
  name: "gemma-2-2b-it-Q4_K_M.gguf",
  size: 1708582752,
  path: "/storage/emulated/0/PocketFlow-Aether/models/gemma-2-2b-it-Q4_K_M.gguf",
  importedAt: "optimized-preset",
  quantization: "Q4_K_M",
  source: "downloadConfig",
  parameterClass: "2B fast phone",
  optimizationStack: "Aether mobile low-RAM",
};

export const SPINO_OPTIMIZED_MODEL: SpinoModelRecord = {
  id: "spino_aether_qwen_3_5_9b_q5_k_m",
  name: "Qwen3.5-9B-Q5_K_M.gguf",
  size: 6577841376,
  path: "/storage/emulated/0/PocketFlow-Aether/models/Qwen3.5-9B-Q5_K_M.gguf",
  importedAt: "optimized-preset",
  quantization: "Q5_K_M",
  source: "downloadConfig",
  parameterClass: "9B high-quality phone",
  optimizationStack: "Aether 12GB+ RAM / Baloss agent default",
};

export const SPINO_MISTRAL_MODEL: SpinoModelRecord = {
  id: "spino_aether_mistral_7b_instruct_v03_q4_k_m",
  name: "Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
  size: 4372812000,
  path: "/storage/emulated/0/PocketFlow-Aether/models/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf",
  importedAt: "optimized-preset",
  quantization: "Q4_K_M",
  source: "downloadConfig",
  parameterClass: "7B mobile",
  optimizationStack: "Aether 12GB RAM",
};

export const SPINO_DEFAULT_MODEL = SPINO_OPTIMIZED_MODEL;
export const SPINO_PRESET_MODELS = [SPINO_OPTIMIZED_MODEL, SPINO_MISTRAL_MODEL, SPINO_SMALL_MODEL];

export const SPINO_AETHER_STORAGE_ROOT = "/storage/emulated/0/PocketFlow-Aether";
export const SPINO_DEFAULT_KNOWLEDGE_ROOT = SPINO_AETHER_STORAGE_ROOT;
export const SPINO_AETHER_KNOWLEDGE_TARGET_BYTES = 30 * 1024 * 1024 * 1024;
export const SPINO_FOLDER_LAYOUT = `PocketFlow-Aether/  (phone Aether reserve)
  models/
  datasets/
  language-tools/
  world-reference/
  work-corpus/
  research-cache/
  automation-memory/
  conversation-memory/
  vector-index/
  imports/
  exports/
  temp/`;

export const SPINO_PROFILES: SpinoProfile[] = [
  {
    id: "ultraLow",
    label: "Aether Q5 Tuned",
    nCtx: 1536,
    topK: 2,
    maxAnswerTokens: 80,
    threads: 4,
    batch: "q5-tuned",
    mmap: true,
    mlock: false,
  },
  {
    id: "low",
    label: "Aether Mobile",
    nCtx: 2048,
    topK: 3,
    maxAnswerTokens: 192,
    threads: 3,
    batch: "mobile",
    mmap: true,
    mlock: false,
  },
  {
    id: "balanced",
    label: "Aether Qwen Balanced",
    nCtx: 4096,
    topK: 4,
    maxAnswerTokens: 384,
    threads: 4,
    batch: "balanced",
    mmap: true,
    mlock: false,
  },
  {
    id: "performance",
    label: "Aether Qwen Fast",
    nCtx: 6144,
    topK: 5,
    maxAnswerTokens: 512,
    threads: 6,
    batch: "fast",
    mmap: true,
    mlock: false,
  },
  {
    id: "max",
    label: "Aether Qwen Max",
    nCtx: 8192,
    topK: 6,
    maxAnswerTokens: 640,
    threads: 6,
    batch: "max",
    mmap: true,
    mlock: false,
  },
];

export const getSpinoProfile = (id: string | null | undefined) =>
  SPINO_PROFILES.find((profile) => profile.id === id) || SPINO_PROFILES[0];

export const loadSpinoModels = (): SpinoModelRecord[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(MODELS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const ensureOptimizedSpinoModel = (models: SpinoModelRecord[]) => {
  const withoutLegacyTiny = models.filter(
    (model) => !SPINO_LEGACY_TINY_MODEL_IDS.has(model.id) && !SPINO_LEGACY_TINY_MODEL_NAMES.has(model.name),
  );
  const customModels = withoutLegacyTiny.filter(
    (model) => !SPINO_PRESET_MODELS.some((preset) => preset.id === model.id || preset.name === model.name),
  );
  return [...SPINO_PRESET_MODELS, ...customModels];
};

export const saveSpinoModels = (models: SpinoModelRecord[]) => {
  localStorage.setItem(MODELS_KEY, JSON.stringify(models));
};

export const loadSpinoIndex = (): SpinoIndexState => {
  try {
    const parsed = JSON.parse(localStorage.getItem(INDEX_KEY) || "null");
    if (parsed && Array.isArray(parsed.documents) && Array.isArray(parsed.chunks)) {
      return {
        knowledgeRoot: parsed.knowledgeRoot || SPINO_DEFAULT_KNOWLEDGE_ROOT,
        documents: parsed.documents,
        chunks: parsed.chunks,
        lastIndexedAt: parsed.lastIndexedAt,
      };
    }
  } catch {}
  return { knowledgeRoot: SPINO_DEFAULT_KNOWLEDGE_ROOT, documents: [], chunks: [] };
};

export const saveSpinoIndex = (index: SpinoIndexState) => {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
};

export const getSelectedSpinoModelId = () => localStorage.getItem(SELECTED_MODEL_KEY) || "";
export const setSelectedSpinoModelId = (modelId: string) => localStorage.setItem(SELECTED_MODEL_KEY, modelId);
export const getSelectedSpinoProfileId = () => (localStorage.getItem(PROFILE_KEY) as SpinoProfileId | null) || "ultraLow";
export const setSelectedSpinoProfileId = (profileId: SpinoProfileId) => localStorage.setItem(PROFILE_KEY, profileId);

export const detectQuantization = (name: string) => {
  const match = name.match(/Q[2348]_[A-Z]_[A-Z]|Q[2348]_[0-9A-Z]+|Q[2348]/i);
  return match ? match[0].toUpperCase() : "unknown";
};

export const formatSpinoBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

export const estimateModelMemoryMb = (model: SpinoModelRecord | null, profile: SpinoProfile) => {
  if (!model) return 0;
  const modelMb = model.size / 1024 / 1024;
  const contextMb = profile.nCtx <= 1024
    ? 192
    : profile.nCtx <= 2048
      ? 384
      : profile.nCtx <= 4096
        ? 768
        : profile.nCtx <= 6144
          ? 1152
          : 1536;
  return Math.round(modelMb + contextMb);
};

export const canRunSpinoModelSafely = (
  model: SpinoModelRecord | null,
  profile: SpinoProfile,
  availableMb?: number,
  swapFreeMb?: number,
) => {
  const estimatedMb = estimateModelMemoryMb(model, profile);
  if (!model || estimatedMb <= 0) return { ok: false, estimatedMb, safeBudgetMb: 0, message: "No model selected." };
  if (typeof availableMb !== "number" || availableMb <= 0) {
    return { ok: false, estimatedMb, safeBudgetMb: 0, message: "RAM status unavailable. Staying in retrieval mode." };
  }
  const swapAssistMb = Math.min(Math.max(0, swapFreeMb || 0), 512);
  const safeBudgetMb = Math.floor((availableMb + swapAssistMb) * 0.72);
  if (estimatedMb > safeBudgetMb) {
    return {
      ok: false,
      estimatedMb,
      safeBudgetMb,
      message: `Aether RAM guard blocked native load: ${estimatedMb} MB needed, ${safeBudgetMb} MB safe budget.`,
    };
  }
  return { ok: true, estimatedMb, safeBudgetMb, message: "Aether RAM budget is safe." };
};

const simpleHash = async (text: string) => {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text.slice(0, 2_000_000));
  if (crypto?.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  let hash = 0;
  for (let i = 0; i < bytes.length; i += 1) hash = ((hash << 5) - hash + bytes[i]) | 0;
  return Math.abs(hash).toString(16);
};

export const readTextKnowledgeFile = async (file: File) => {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!["txt", "md", "json", "jsonl", "csv", "html", "htm"].includes(extension)) {
    throw new Error(`${file.name} is not supported yet`);
  }
  const maxReadBytes = 3 * 1024 * 1024;
  const blob = file.size > maxReadBytes ? file.slice(0, maxReadBytes) : file;
  return await blob.text();
};

export const chunkSpinoText = (text: string, target = 850, overlap = 130) => {
  const clean = text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00a0]{2,}/g, " ")
    .trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < clean.length) {
    let end = Math.min(cursor + target, clean.length);
    const boundary = clean.slice(cursor, end).lastIndexOf("\n");
    if (boundary > target * 0.45) end = cursor + boundary;
    const chunk = clean.slice(cursor, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= clean.length) break;
    cursor = Math.max(0, end - overlap);
  }
  return chunks;
};

export const indexSpinoFiles = async (
  files: File[],
  current: SpinoIndexState,
  onProgress?: (done: number, total: number, name: string) => void,
) => {
  const documents = [...current.documents];
  const chunks = [...current.chunks];
  let changed = 0;

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    onProgress?.(index, files.length, file.name);
    const text = await readTextKnowledgeFile(file);
    const contentHash = await simpleHash(text);
    const path = (file as any).webkitRelativePath || `${current.knowledgeRoot}/raw/${file.name}`;
    const existing = documents.find((document) => document.path === path);
    if (existing && existing.contentHash === contentHash && existing.modifiedAt === file.lastModified) {
      continue;
    }

    const documentId = existing?.id || `spdoc_${Date.now().toString(36)}_${index}_${Math.random().toString(36).slice(2, 7)}`;
    const documentRecord: SpinoDocumentRecord = {
      id: documentId,
      path,
      title: file.name,
      type: file.name.split(".").pop()?.toLowerCase() || "text",
      size: file.size,
      modifiedAt: file.lastModified,
      contentHash,
      indexedAt: new Date().toISOString(),
      metadata: {
        source: "local_file_picker",
        truncated: file.size > 3 * 1024 * 1024,
      },
    };

    const docIndex = documents.findIndex((document) => document.id === documentId);
    if (docIndex >= 0) documents[docIndex] = documentRecord;
    else documents.push(documentRecord);

    for (let chunkIndex = chunks.length - 1; chunkIndex >= 0; chunkIndex -= 1) {
      if (chunks[chunkIndex].documentId === documentId) chunks.splice(chunkIndex, 1);
    }

    chunkSpinoText(text).forEach((chunkText, chunkIndex) => {
      chunks.push({
        id: `spchunk_${documentId}_${chunkIndex}`,
        documentId,
        chunkIndex,
        text: chunkText,
        tokenEstimate: Math.ceil(chunkText.length / 4),
        metadata: {
          sourcePath: path,
          title: file.name,
          heading: chunkText.match(/^#{1,4}\s+(.+)$/m)?.[1],
        },
      });
    });
    changed += 1;
  }

  const next = {
    ...current,
    documents,
    chunks,
    lastIndexedAt: new Date().toISOString(),
  };
  saveSpinoIndex(next);
  onProgress?.(files.length, files.length, "Complete");
  return { next, changed };
};

const tokenize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);

const buildRetrievalVector = (value: string) => {
  const vector = new Map<string, number>();
  const terms = tokenize(value);

  terms.forEach((term, index) => {
    vector.set(term, (vector.get(term) || 0) + 2);
    if (index < terms.length - 1) {
      const pair = `${term}_${terms[index + 1]}`;
      vector.set(pair, (vector.get(pair) || 0) + 1.4);
    }
    if (term.length > 5) {
      for (let offset = 0; offset <= term.length - 4; offset += 1) {
        const gram = `#${term.slice(offset, offset + 4)}`;
        vector.set(gram, (vector.get(gram) || 0) + 0.45);
      }
    }
  });

  return vector;
};

const cosineSimilarity = (left: Map<string, number>, right: Map<string, number>) => {
  let dot = 0;
  let leftMag = 0;
  let rightMag = 0;
  left.forEach((weight, key) => {
    leftMag += weight * weight;
    dot += weight * (right.get(key) || 0);
  });
  right.forEach((weight) => {
    rightMag += weight * weight;
  });
  if (!leftMag || !rightMag) return 0;
  return dot / (Math.sqrt(leftMag) * Math.sqrt(rightMag));
};

export const searchSpinoIndex = (question: string, index: SpinoIndexState, topK: number): SpinoSearchResult[] => {
  const terms = tokenize(question);
  if (terms.length === 0) return [];
  const documentsById = new Map(index.documents.map((document) => [document.id, document]));
  const questionVector = buildRetrievalVector(question);
  return index.chunks
    .map((chunk) => {
      const fullText = `${chunk.metadata.title} ${chunk.text}`;
      const text = fullText.toLowerCase();
      let lexicalScore = 0;
      for (const term of terms) {
        const matches = text.split(term).length - 1;
        if (matches > 0) lexicalScore += 1 + Math.log(1 + matches);
      }
      const vectorScore = cosineSimilarity(questionVector, buildRetrievalVector(fullText)) * 4;
      const titleBoost = terms.some((term) => chunk.metadata.title.toLowerCase().includes(term)) ? 0.8 : 0;
      const score = lexicalScore + vectorScore + titleBoost;
      const document = documentsById.get(chunk.documentId);
      return document && score > 0.08 ? { chunk, document, score } : null;
    })
    .filter((result): result is SpinoSearchResult => !!result)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
};

const compactSpinoText = (text: string, maxChars: number) => {
  const clean = text.trim();
  if (clean.length <= maxChars) return clean;
  const headChars = Math.max(400, Math.floor(maxChars * 0.35));
  const tailChars = Math.max(600, maxChars - headChars - 72);
  return `${clean.slice(0, headChars).trim()}\n\n[older context compacted]\n\n${clean.slice(-tailChars).trim()}`;
};

const wantsMemoryRecall = (question: string) => {
  const normalized = normalizePrompt(question);
  return /\b(remember|memory|recall|previous|old chat|old conversation|what did i tell|what do you know about me|my details|my email|my phone|my contacts)\b/.test(normalized);
};

const isConversationMemoryResult = (result: SpinoSearchResult) =>
  /conversation memory|conversation-\d+\.txt/i.test(result.document.title) ||
  /^PocketFlow (SpinoLLM|Baloss LLM) conversation memory/i.test(result.chunk.text);

export const filterSpinoResultsForChat = (question: string, results: SpinoSearchResult[]) => {
  if (wantsMemoryRecall(question)) return results;
  return results.filter((result) => !isConversationMemoryResult(result));
};

export const buildSpinoPrompt = (
  question: string,
  results: SpinoSearchResult[],
  extraContext = "",
  taskType?: PocketAITaskType,
) => {
  const usableResults = filterSpinoResultsForChat(question, results);
  const context = usableResults
    .slice(0, 4)
    .map((result, index) => `[${index + 1}] ${result.document.title}\n${compactSpinoText(result.chunk.text, 900)}`)
    .join("\n\n");
  const qualityContract = buildBalossQualityContract(question, taskType);
  const combinedContext = [qualityContract, compactSpinoText(extraContext, 4500), context].filter(Boolean).join("\n\n");
  return `SYSTEM:
You are Baloss LLM, the local-first assistant inside PocketFlow. You can hold normal short conversations, use local phone knowledge, and follow approved PocketFlow tool routes.
Rules:
- Answer briefly and naturally by default: 1-3 short sentences unless the user explicitly asks for detail.
- Answer only the latest USER message. Do not summarize old conversation unless the user asks for memory/recall.
- For greetings, rhetorical questions, and normal chat, answer like a good chatbot: direct, warm, practical, and human-sounding.
- If the user asks "how are you", answer with a short live status such as RAM/efficiency/connection only if available; never dump routing or memory internals.
- If the user asks for news, research, weather, prices, or current events, answer that exact topic; do not substitute crypto or system statistics unless asked.
- If you are missing live data, say what is missing in one sentence and offer the next action.
- Prefer the provided context for personal, phone, calendar, notes, files, and PocketFlow work.
- For public/general questions, answer from general reasoning only when the request is marked public in the conversation core context.
- Do not invent private facts not in context.
- Treat LOCAL BALOSS MEMORY as durable facts the user asked you to remember.
- Use old chat/context silently when relevant; never start with "I remember this" unless the user explicitly asks what you remember.
- Calendar and Notes actions are handled by PocketFlow before this prompt; do not pretend to execute them here.
- If private context is insufficient, say what you need in one short sentence.
- Do not print internal diagnostics, timestamps, mode labels, route names, privacy labels, readiness, "Sources", "Question tracked locally", or old SPINO/BALOSS CONVERSATION CORE text in chat.
- For local recommendations, mention the useful fact directly; cite a source only if it helps.

CONTEXT:
${combinedContext || "No local context retrieved."}

USER:
${question}`;
};

const normalizePrompt = (question: string) =>
  question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const isGreetingPrompt = (question: string) => {
  const normalized = normalizePrompt(question);
  return /^(hi|hello|hey|yo|ciao|buongiorno|buonasera|salve|hola|good morning|good evening|how are you|come stai)\b/.test(normalized);
};

const isIdentityPrompt = (question: string) => {
  const normalized = normalizePrompt(question);
  return /(who are you|what are you|chi sei|cosa sei|what can you do|cosa puoi fare|talk to me|parla con me)/.test(normalized);
};

const isConversationalPrompt = (question: string) => {
  const normalized = normalizePrompt(question);
  return /^(how are you|come stai|tell me|parlami|i think|i feel|i want|i need|i am|i'm|sono|vorrei|mi serve|let's|lets|we need|can we|could we|help me)\b/.test(normalized);
};

export const buildSpinoConversationFallback = (question: string, localOnly: boolean) => {
  if (isGreetingPrompt(question)) {
    return "All good, I am here and ready.";
  }

  if (isIdentityPrompt(question)) {
    return [
      "I am Baloss LLM inside PocketFlow.",
      localOnly
        ? "I can chat, remember local notes, search Aether memory, and help with approved PocketFlow actions while staying offline."
        : "I can chat, remember local notes, search Aether memory, and use approved online reasoning when needed.",
    ].join("\n\n");
  }

  if (isConversationalPrompt(question)) {
    return "I understand. Tell me the next thing you want to do, or say it naturally as an action.";
  }

  return localOnly
    ? "I can answer from local context, but I need a clearer question."
    : "Ask me directly what you want to know or what action you want me to take.";
};

const compactLocalAnswerSnippet = (text: string, maxChars = 260) => {
  const internalDiagnosticLine =
    /^(PocketFlow (SpinoLLM|Baloss LLM) conversation memory|SPINO CONVERSATION CORE|BALOSS LLM CONVERSATION CORE|BALOSS CHAT STYLE|ANSWER STYLE|OPERATING RULES|ROUTE|CONTEXT|USER MESSAGE|Time:|Mode:|Sources?:|Question tracked locally:|Readiness:|Privacy:|Reason:|Model:|Memory:|Research:|Agents?:|Tools allowed:)/i;
  const internalDiagnosticContent =
    /(Conversation stack is functional|native model\/STT|No executable model|General knowledge allowed|model missing|speech transcription|semantic retrieval|tool permissions|readiness\s*:\s*\d+%|public\/general question)/i;
  const cleanLines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !internalDiagnosticLine.test(line))
    .filter((line) => !internalDiagnosticContent.test(line))
    .map((line) => line.replace(/^(USER|SPINO|BALOSS):\s*/i, "").trim())
    .filter(Boolean);
  const joined = cleanLines.join(" ").replace(/\s+/g, " ").trim();
  if (joined.length <= maxChars) return joined;
  const cut = joined.slice(0, maxChars);
  return `${cut.slice(0, Math.max(0, cut.lastIndexOf(" "))).trim()}...`;
};

export const answerFromLocalContext = (question: string, results: SpinoSearchResult[], localOnly: boolean, extraContext = "") => {
  const usableResults = filterSpinoResultsForChat(question, results);
  if (usableResults.length === 0 && extraContext.trim()) {
    if (!wantsMemoryRecall(question)) {
      return buildSpinoConversationFallback(question, localOnly);
    }
    const memory = compactLocalAnswerSnippet(extraContext, 240);
    return memory ? `I have this saved: ${memory}` : buildSpinoConversationFallback(question, localOnly);
  }
  if (usableResults.length === 0) {
    return buildSpinoConversationFallback(question, localOnly);
  }
  const first = usableResults[0];
  const excerpt = compactLocalAnswerSnippet(first.chunk.text, 260);
  const sourceNames = usableResults.map((result) => result.document.title).filter((title, index, list) => list.indexOf(title) === index);
  const sourceLabel = sourceNames.slice(0, 2).join(", ");
  return excerpt
    ? `I found this in ${sourceLabel}: ${excerpt}`
    : `I found a local match in ${sourceLabel}, but I need a clearer question.`;
};

export const createSpinoModelRecord = (file: File): SpinoModelRecord => ({
  id: `spmodel_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
  name: file.name,
  size: file.size,
  path: `${SPINO_AETHER_STORAGE_ROOT}/models/${file.name}`,
  importedAt: new Date().toISOString(),
  quantization: detectQuantization(file.name),
  source: "localImport",
});
