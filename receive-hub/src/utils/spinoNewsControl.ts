import { upsertLifeNote } from "./lifeMemory";

interface NewsDbItem {
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

interface NewsAgentDb {
  updatedAt?: string;
  focus?: string[];
  latestTop10?: NewsDbItem[];
  recent148h?: NewsDbItem[];
  saved?: NewsDbItem[];
  likedIds?: string[];
  pinnedIds?: string[];
}

export interface SpinoNewsCommandResult {
  response: string;
  sourceLabel: string;
}

const NEWS_DB_KEY = "pocketflow.news.agentDb.v1";

const safeLoadNewsDb = (): NewsAgentDb => {
  try {
    const parsed = JSON.parse(localStorage.getItem(NEWS_DB_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const compact = (value = "", max = 320) => {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
};

const NEWS_STOP_WORDS = new Set([
  "about",
  "article",
  "articles",
  "brief",
  "briefing",
  "current",
  "give",
  "giornali",
  "headline",
  "headlines",
  "latest",
  "news",
  "notizie",
  "oggi",
  "please",
  "show",
  "summarize",
  "summary",
  "tell",
  "today",
  "updates",
  "week",
  "weekly",
  "were",
  "what",
  "whats",
]);

const newsSearchTerms = (prompt: string) =>
  normalize(prompt)
    .split(/\s+/)
    .filter((term) => term.length > 3 && !NEWS_STOP_WORDS.has(term));

const scoreNewsItem = (item: NewsDbItem, prompt: string) => {
  const terms = newsSearchTerms(prompt);
  const haystack = normalize(`${item.title || ""} ${item.topic || ""} ${item.sourceName || ""} ${item.summary || ""} ${item.fullSummary || ""}`);
  if (!terms.length) return 1;
  return terms.reduce((total, term) => total + (haystack.includes(term) ? 2 : 0), 0);
};

const relevantNewsItems = (prompt: string, limit = 8) => {
  const db = safeLoadNewsDb();
  const pool = [...(db.saved || []), ...(db.latestTop10 || []), ...(db.recent148h || [])];
  return Array.from(new Map(pool.filter((item) => item.title).map((item) => [item.id || item.link || item.title, item])).values())
    .map((item) => ({ item, score: scoreNewsItem(item, prompt) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || String(b.item.publishedAt || b.item.savedAt || "").localeCompare(String(a.item.publishedAt || a.item.savedAt || "")))
    .slice(0, limit)
    .map(({ item }) => item);
};

export const buildSpinoNewsContext = (prompt: string, limit = 8) => {
  const db = safeLoadNewsDb();
  const deduped = relevantNewsItems(prompt, limit)
    .map((item, index) => {
      const marked = db.pinnedIds?.includes(item.id || "") ? "Pinned" : db.likedIds?.includes(item.id || "") ? "Liked" : item.savedAt ? "Saved" : "Latest";
      return `[N${index + 1}] ${marked} / ${item.topic || "news"} / ${item.sourceName || "source"}\n${item.title || "Untitled"}\n${compact(item.fullSummary || item.summary || "", 520)}\n${item.link || ""}`;
    });
  if (!deduped.length) return "";
  return [
    "BALOSS NEWS MEMORY",
    `Updated: ${db.updatedAt || "unknown"}`,
    `Focus: ${(db.focus || []).join(", ") || "personalized news"}`,
    ...deduped,
  ].join("\n\n");
};

export const answerFromSpinoNewsMemory = (prompt: string, limit = 6): SpinoNewsCommandResult | null => {
  const db = safeLoadNewsDb();
  const selected = relevantNewsItems(prompt, limit);
  if (!selected.length) return null;
  const broad = newsSearchTerms(prompt).length === 0;
  const title = broad ? "Here are the main News Flow items I have:" : "Here is the closest News Flow briefing:";
  const body = selected
    .map((item, index) => {
      const source = [item.sourceName, item.topic].filter(Boolean).join(" / ") || "news";
      return `${index + 1}. ${item.title || "Untitled"}\n${compact(item.fullSummary || item.summary || "No summary available yet.", 260)}\n${source}${item.link ? ` · ${item.link}` : ""}`;
    })
    .join("\n\n");
  return {
    sourceLabel: "News Flow",
    response: [
      title,
      body,
      `Updated: ${db.updatedAt || "unknown"}. Use Pull in News Flow if you want me to refresh before answering.`,
    ].join("\n\n"),
  };
};

export const handleSpinoNewsCommand = (prompt: string): SpinoNewsCommandResult | null => {
  const normalized = normalize(prompt);
  const isNews = /\b(news|article|headline|notizie|giornali|articolo|ricerca)\b/.test(normalized);
  const wantsSave = /\b(pin|save|saved|note|notes|salva|appunta|memorizza)\b/.test(normalized);
  if (!isNews || !wantsSave) return null;
  const db = safeLoadNewsDb();
  const pool = [...(db.saved || []), ...(db.latestTop10 || []), ...(db.recent148h || [])];
  const selected = Array.from(new Map(pool.filter((item) => item.title).map((item) => [item.id || item.link || item.title, item])).values())
    .map((item) => ({ item, score: scoreNewsItem(item, prompt) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((entry) => entry.item);
  if (!selected.length) {
    return {
      sourceLabel: "News memory",
      response: "I do not have news items to save yet. Open News and refresh once, then ask me again.",
    };
  }
  const body = selected
    .map((item, index) => `${index + 1}. ${item.title}\n${compact(item.fullSummary || item.summary || "", 600)}\n${item.link || "No link"}`)
    .join("\n\n");
  const note = upsertLifeNote({
    title: `News pin - ${selected[0]?.topic || "research"}`,
    body,
    tags: ["spino", "news", "article-pin"],
    source: "spino",
  });
  return {
    sourceLabel: "News control",
    response: `Saved ${selected.length} news item${selected.length === 1 ? "" : "s"} into Notes as "${note.title}".`,
  };
};
