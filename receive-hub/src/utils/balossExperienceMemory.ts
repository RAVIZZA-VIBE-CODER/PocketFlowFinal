export type BalossExperienceKind = "qa" | "builder_workflow" | "system_status" | "correction" | "task_pattern";

export interface BalossExperienceMemoryEntry {
  id: string;
  kind: BalossExperienceKind;
  title: string;
  summary: string;
  promptSample: string;
  responseSample?: string;
  tags: string[];
  projectName?: string;
  boxCount?: number;
  lessons: string[];
  uses: number;
  confidence: number;
  createdAt: string;
  updatedAt: string;
}

const EXPERIENCE_KEY = "pocketflow.baloss.experienceMemory.v1";
const MAX_EXPERIENCE_ENTRIES = 500;

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}@._+\-\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const compact = (value: string, max = 220) => {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(0, cut.lastIndexOf(" "))).trim()}...`;
};

const uid = (prefix: string) => {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
};

const safeParse = (): BalossExperienceMemoryEntry[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(EXPERIENCE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && item.id && item.summary) : [];
  } catch {
    return [];
  }
};

export const loadBalossExperienceMemory = () => safeParse();

export const saveBalossExperienceMemory = (entries: BalossExperienceMemoryEntry[]) => {
  const clean = entries
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_EXPERIENCE_ENTRIES);
  localStorage.setItem(EXPERIENCE_KEY, JSON.stringify(clean));
  window.dispatchEvent(new CustomEvent("pocketflow-baloss-experience-updated"));
  return clean;
};

const TAG_ALIASES: Record<string, string[]> = {
  builder: ["builder", "build", "workflow", "flow", "box", "boxes", "architecture", "prompt"],
  dashboard: ["dashboard", "dashforge", "html", "report"],
  relay: ["relay", "codex", "preview", "localhost", "tailscale"],
  moltbook: ["moltbook", "multiple", "agentmoltbook", "post", "comment", "social"],
  notes: ["notes", "note", "meeting", "memo", "transcription", "summary"],
  calendar: ["calendar", "calander", "calender", "appointment", "event", "agenda"],
  news: ["news", "headline", "article", "giornali", "notizie"],
  model: ["model", "llm", "baloss", "spino", "runner", "ram", "tokens"],
  archive: ["archive", "reader", "file", "document", "download"],
  browser: ["browser", "web", "pocketweb", "search"],
  crm: ["crm", "email", "imap", "contact", "mail"],
  server: ["server", "tanuki", "monitor", "health"],
  radar: ["radar", "flight", "airport", "adsb", "plane"],
  phone: ["phone", "android", "realme", "device", "usb"],
  correction: ["fix", "wrong", "issue", "bug", "correct", "remove", "not working"],
};

export const extractBalossExperienceTags = (text: string) => {
  const normalized = normalize(text);
  const found = new Set<string>();
  Object.entries(TAG_ALIASES).forEach(([tag, aliases]) => {
    if (aliases.some((alias) => new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(normalized))) {
      found.add(tag);
    }
  });
  const extraTerms = normalized
    .split(" ")
    .filter((term) => term.length >= 5 && !/^(should|would|could|about|because|there|their|thing|things|system|please)$/.test(term))
    .slice(0, 8);
  extraTerms.forEach((term) => found.add(term));
  return Array.from(found).slice(0, 16);
};

const shouldRememberQa = (prompt: string, answer: string) => {
  const normalized = normalize(prompt);
  if (normalized.length < 10 || answer.trim().length < 12) return false;
  if (/^(hi|hello|ciao|ok|yes|no|thanks|thank you|grazie|how are you|hey how are u)$/.test(normalized)) return false;
  return /\b(remember|learn|status|how|why|fix|builder|workflow|model|relay|moltbook|news|notes|calendar|archive|reader|crm|server|radar|phone|next time|again|same task|correction)\b/i.test(normalized);
};

const scoreEntry = (entry: BalossExperienceMemoryEntry, query: string, queryTags: string[]) => {
  const haystack = normalize(`${entry.kind} ${entry.title} ${entry.summary} ${entry.promptSample} ${entry.responseSample || ""} ${entry.tags.join(" ")} ${entry.lessons.join(" ")}`);
  const terms = normalize(query).split(" ").filter((term) => term.length > 3);
  const tagScore = queryTags.reduce((sum, tag) => sum + (entry.tags.includes(tag) ? 6 : 0), 0);
  const termScore = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
  return tagScore + termScore + Math.min(entry.uses, 10) * 0.25 + entry.confidence * 0.02;
};

const upsertExperience = (entry: Omit<BalossExperienceMemoryEntry, "id" | "uses" | "createdAt" | "updatedAt">) => {
  const now = new Date().toISOString();
  const entries = loadBalossExperienceMemory();
  const normalizedTitle = normalize(entry.title);
  const existing = entries.find((item) =>
    item.kind === entry.kind &&
    (normalize(item.title) === normalizedTitle || item.tags.some((tag) => entry.tags.includes(tag)) && normalize(item.promptSample).slice(0, 80) === normalize(entry.promptSample).slice(0, 80)),
  );
  const nextEntry: BalossExperienceMemoryEntry = existing
    ? {
        ...existing,
        ...entry,
        lessons: Array.from(new Set([...entry.lessons, ...existing.lessons])).slice(0, 8),
        uses: existing.uses + 1,
        confidence: Math.min(100, Math.max(existing.confidence, entry.confidence) + 2),
        updatedAt: now,
      }
    : {
        ...entry,
        id: uid("bmem"),
        uses: 1,
        createdAt: now,
        updatedAt: now,
      };
  return saveBalossExperienceMemory([nextEntry, ...entries.filter((item) => item.id !== nextEntry.id)])[0];
};

export const rememberBalossQa = (prompt: string, answer: string, kind: BalossExperienceKind = "qa") => {
  if (!shouldRememberQa(prompt, answer)) return null;
  const tags = extractBalossExperienceTags(`${prompt} ${answer}`);
  const title = compact(prompt.replace(/\b(please|make sure|can you|could you)\b/gi, "").trim(), 72) || "Reusable answer";
  return upsertExperience({
    kind,
    title,
    summary: compact(answer, 260),
    promptSample: compact(prompt, 360),
    responseSample: compact(answer, 360),
    tags,
    confidence: kind === "correction" ? 82 : 68,
    lessons: [
      tags.includes("correction")
        ? "User corrected this behavior; prefer the corrected pattern next time."
        : "Reuse this context if the user asks for the same kind of task again.",
    ],
  });
};

export const rememberBalossBuilderWorkflow = (input: {
  prompt: string;
  projectName: string;
  boxCount: number;
  summary?: string;
  lessons?: string[];
}) => {
  const tags = Array.from(new Set(["builder", "workflow", ...extractBalossExperienceTags(`${input.prompt} ${input.projectName}`)]));
  return upsertExperience({
    kind: "builder_workflow",
    title: `Builder workflow: ${compact(input.projectName, 64)}`,
    summary: input.summary || `Built ${input.boxCount} ordered Builder boxes for ${input.projectName}.`,
    promptSample: compact(input.prompt, 420),
    responseSample: input.summary,
    tags,
    projectName: input.projectName,
    boxCount: input.boxCount,
    confidence: 86,
    lessons: input.lessons?.length
      ? input.lessons
      : [
          "When a similar Builder task appears, reuse the previous build order and make the new workflow faster.",
          "Keep output numbered, file-divided, and ready for Reader/Relay/Codex handoff.",
        ],
  });
};

export const buildBalossExperienceContext = (prompt: string, limit = 6) => {
  const tags = extractBalossExperienceTags(prompt);
  const entries = loadBalossExperienceMemory()
    .map((entry) => ({ entry, score: scoreEntry(entry, prompt, tags) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.updatedAt.localeCompare(a.entry.updatedAt))
    .slice(0, limit)
    .map((item) => item.entry);

  if (!entries.length) return "";
  return [
    "BALOSS REUSABLE EXPERIENCE MEMORY",
    "Use these as learned patterns. Do not dump them to the user; apply them quietly unless asked.",
    ...entries.map((entry, index) => [
      `[E${index + 1}] ${entry.title}`,
      `Kind: ${entry.kind}; tags: ${entry.tags.slice(0, 8).join(", ")}`,
      `Memory: ${entry.summary}`,
      entry.projectName ? `Previous project: ${entry.projectName}${entry.boxCount ? ` (${entry.boxCount} boxes)` : ""}` : "",
      entry.lessons.length ? `Lesson: ${entry.lessons.slice(0, 2).join(" ")}` : "",
    ].filter(Boolean).join("\n")),
  ].join("\n\n");
};

