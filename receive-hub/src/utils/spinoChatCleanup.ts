export const SPINO_CHAT_HISTORY_KEY = "pocketflow.spino.chat.v2";

export interface SpinoStoredChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  pending?: boolean;
  sourceLabel?: string;
}

export interface SpinoChatCheckpoint {
  id: string;
  createdAt: string;
  from: string;
  to: string;
  messageCount: number;
  summary: string;
  keywords: string[];
  importantExcerpts: string[];
}

export interface SpinoChatCleanupState {
  enabled: boolean;
  cadenceHours: number;
  lastRunAt: string;
  lastResult: string;
}

export interface SpinoChatCleanupResult {
  changed: boolean;
  removedMessages: number;
  cleanedMessages: number;
  checkpoint?: SpinoChatCheckpoint;
  checkpoints: SpinoChatCheckpoint[];
  message: string;
}

const CHECKPOINTS_KEY = "pocketflow.spino.chatCheckpoints.v1";
const CLEANUP_STATE_KEY = "pocketflow.spino.chatCleanup.v1";
const DEFAULT_PRESERVE_MESSAGES = 140;
const MAX_STORED_MESSAGES = 190;
const MAX_CHECKPOINTS = 80;

const defaultCleanupState = (): SpinoChatCleanupState => ({
  enabled: true,
  cadenceHours: 24,
  lastRunAt: "",
  lastResult: "Chat cleanup has not run yet.",
});

const safeJson = <T,>(key: string, fallback: T): T => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const saveJson = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const compact = (value: string, max = 220) => {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(0, cut.lastIndexOf(" "))).trim()}...`;
};

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9@.+-]+/i)
    .filter((token) => token.length > 3 && !COMMON_WORDS.has(token));

const COMMON_WORDS = new Set([
  "about", "after", "again", "also", "because", "been", "being", "build", "chat", "could",
  "from", "have", "just", "like", "make", "more", "need", "should", "that", "this", "when",
  "with", "work", "would", "your", "able", "able", "della", "sono", "come", "cosa", "fare",
]);

const cleanAssistantScratch = (content: string) => {
  const cleaned = content
    .replace(/^From local Spino memory:\s*/i, "")
    .replace(/^From the local knowledge index, the closest match is:\s*/i, "")
    .replace(/^The local knowledge index found this useful context:\s*/i, "")
    .replace(/\n{2,}Sources:[\s\S]*$/i, "")
    .replace(/\n{2,}Question tracked locally:[\s\S]*$/i, "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(PocketFlow Baloss LLM conversation memory|Time:|Mode:|Sources?:|Question tracked locally:|BALOSS CENTRAL HEARTBEAT|CONVERSATION READINESS|ONLINE BALOSS LLM 144H INTELLIGENCE|AUTHORIZED TANUKI WWW AGENT GATEWAY)$/i.test(line))
    .filter((line) => !/^(LOCAL REASONING MODEL|SPEECH TRANSCRIPTION|SEMANTIC RETRIEVAL|TOOL PERMISSIONS)\s+(MISSING|PARTIAL|READY)$/i.test(line))
    .map((line) => line.replace(/^(USER|SPINO):\s*/i, "").trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
  return cleaned.length > 1400 ? `${cleaned.slice(0, 1400).trim()}...` : cleaned;
};

const normalizeMessage = (message: SpinoStoredChatMessage): SpinoStoredChatMessage | null => {
  if (!message || typeof message.content !== "string" || message.pending) return null;
  const content = message.role === "assistant" ? cleanAssistantScratch(message.content) : message.content.trim();
  if (!content) return null;
  return {
    ...message,
    content,
    createdAt: message.createdAt || new Date().toISOString(),
  };
};

const dedupeConsecutive = (messages: SpinoStoredChatMessage[]) => {
  const next: SpinoStoredChatMessage[] = [];
  for (const message of messages) {
    const previous = next[next.length - 1];
    if (previous && previous.role === message.role && previous.content.trim() === message.content.trim()) continue;
    next.push(message);
  }
  return next;
};

const buildCheckpoint = (messages: SpinoStoredChatMessage[]): SpinoChatCheckpoint | null => {
  if (!messages.length) return null;
  const from = messages[0]?.createdAt || new Date().toISOString();
  const to = messages[messages.length - 1]?.createdAt || from;
  const userMessages = messages.filter((message) => message.role === "user").map((message) => message.content);
  const assistantMessages = messages.filter((message) => message.role === "assistant").map((message) => message.content);
  const allText = [...userMessages, ...assistantMessages].join(" ");
  const keywords = Array.from(new Set(tokenize(allText))).slice(0, 12);
  const importantExcerpts = [
    ...userMessages.filter((line) => /\b(need|important|remember|build|fix|plan|calendar|archive|relay|model|agent|research|notes?)\b/i.test(line)).slice(-5),
    ...assistantMessages.filter((line) => /\b(done|saved|created|fixed|plan|summary|next)\b/i.test(line)).slice(-3),
  ].map((line) => compact(line, 180));
  const summary = [
    userMessages.length ? `User focus: ${compact(userMessages.slice(-5).join(" / "), 360)}` : "",
    assistantMessages.length ? `Baloss LLM outcome: ${compact(assistantMessages.slice(-4).join(" / "), 320)}` : "",
    keywords.length ? `Keywords: ${keywords.join(", ")}` : "",
  ].filter(Boolean).join("\n");
  return {
    id: `chk_${new Date(to).getTime().toString(36)}_${messages.length}`,
    createdAt: new Date().toISOString(),
    from,
    to,
    messageCount: messages.length,
    summary: summary || "Older chat context checkpoint.",
    keywords,
    importantExcerpts,
  };
};

export const loadSpinoChatCheckpoints = () => {
  const checkpoints = safeJson<SpinoChatCheckpoint[]>(CHECKPOINTS_KEY, []);
  return Array.isArray(checkpoints) ? checkpoints : [];
};

export const saveSpinoChatCheckpoints = (checkpoints: SpinoChatCheckpoint[]) => {
  saveJson(CHECKPOINTS_KEY, checkpoints.slice(0, MAX_CHECKPOINTS));
};

export const loadSpinoChatCleanupState = () => ({
  ...defaultCleanupState(),
  ...safeJson<Partial<SpinoChatCleanupState>>(CLEANUP_STATE_KEY, {}),
});

export const saveSpinoChatCleanupState = (state: SpinoChatCleanupState) => {
  saveJson(CLEANUP_STATE_KEY, state);
};

export const updateSpinoChatCleanupState = (patch: Partial<SpinoChatCleanupState>) => {
  const next = { ...loadSpinoChatCleanupState(), ...patch };
  saveSpinoChatCleanupState(next);
  return next;
};

export const buildSpinoCheckpointContext = (query: string, limit = 4) => {
  const terms = tokenize(query);
  const checkpoints = loadSpinoChatCheckpoints()
    .map((checkpoint) => {
      const haystack = `${checkpoint.summary} ${checkpoint.keywords.join(" ")} ${checkpoint.importantExcerpts.join(" ")}`.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { checkpoint, score };
    })
    .filter((item) => item.score > 0 || terms.length === 0)
    .sort((a, b) => b.score - a.score || b.checkpoint.createdAt.localeCompare(a.checkpoint.createdAt))
    .slice(0, limit)
    .map((item) => item.checkpoint);
  if (!checkpoints.length) return "";
  return [
    "BALOSS LONG-TERM CHAT CHECKPOINTS",
    "Use these as breadcrumb context only. They are summaries of old chat/reasoning, not passwords, files, apps, or archives.",
    ...checkpoints.map((checkpoint, index) =>
      `[C${index + 1}] ${checkpoint.from.slice(0, 10)} to ${checkpoint.to.slice(0, 10)} / ${checkpoint.messageCount} messages\n${checkpoint.summary}`,
    ),
  ].join("\n\n");
};

export const prepareSpinoChatHistoryForStorage = (messages: SpinoStoredChatMessage[]) => {
  const normalized = dedupeConsecutive(messages.map(normalizeMessage).filter((message): message is SpinoStoredChatMessage => Boolean(message)));
  if (normalized.length <= MAX_STORED_MESSAGES) return normalized;
  const oldMessages = normalized.slice(0, normalized.length - DEFAULT_PRESERVE_MESSAGES);
  const checkpoint = buildCheckpoint(oldMessages);
  if (checkpoint) {
    const existing = loadSpinoChatCheckpoints();
    const alreadySaved = existing.some((item) => item.id === checkpoint.id || (item.from === checkpoint.from && item.to === checkpoint.to));
    if (!alreadySaved) saveSpinoChatCheckpoints([checkpoint, ...existing]);
  }
  return normalized.slice(-DEFAULT_PRESERVE_MESSAGES);
};

export const runSpinoChatCleanup = (force = false): SpinoChatCleanupResult => {
  const state = loadSpinoChatCleanupState();
  const checkpointsBefore = loadSpinoChatCheckpoints();
  if (!force && !state.enabled) {
    return {
      changed: false,
      removedMessages: 0,
      cleanedMessages: 0,
      checkpoints: checkpointsBefore,
      message: "Chat cleanup is paused.",
    };
  }
  if (!force && state.lastRunAt) {
    const dueAt = new Date(state.lastRunAt).getTime() + state.cadenceHours * 60 * 60 * 1000;
    if (Date.now() < dueAt) {
      return {
        changed: false,
        removedMessages: 0,
        cleanedMessages: 0,
        checkpoints: checkpointsBefore,
        message: "Chat cleanup is not due yet.",
      };
    }
  }

  const raw = safeJson<SpinoStoredChatMessage[]>(SPINO_CHAT_HISTORY_KEY, []);
  const normalized = dedupeConsecutive(raw.map(normalizeMessage).filter((message): message is SpinoStoredChatMessage => Boolean(message)));
  const prepared = prepareSpinoChatHistoryForStorage(normalized);
  const checkpointsAfter = loadSpinoChatCheckpoints();
  const checkpoint = checkpointsAfter.find((item) => !checkpointsBefore.some((previous) => previous.id === item.id));
  const removedMessages = Math.max(0, raw.length - prepared.length);
  const cleanedMessages = Math.max(0, raw.length - normalized.length);
  const changed = removedMessages > 0 || cleanedMessages > 0 || Boolean(checkpoint);
  saveJson(SPINO_CHAT_HISTORY_KEY, prepared);
  const message = checkpoint
    ? `Created checkpoint and kept latest ${prepared.length} chat messages.`
    : changed
      ? `Cleaned chat log and kept ${prepared.length} messages.`
      : "Chat log already clean.";
  updateSpinoChatCleanupState({
    lastRunAt: new Date().toISOString(),
    lastResult: message,
  });
  return {
    changed,
    removedMessages,
    cleanedMessages,
    checkpoint,
    checkpoints: checkpointsAfter,
    message,
  };
};
