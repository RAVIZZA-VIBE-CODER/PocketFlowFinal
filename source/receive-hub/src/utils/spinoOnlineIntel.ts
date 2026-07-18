export type SpinoIntelKind = "weather" | "crypto" | "market" | "news" | "research";

export interface SpinoIntelItem {
  id: string;
  kind: SpinoIntelKind;
  title: string;
  summary: string;
  source: string;
  url?: string;
  value?: string;
  change?: string;
  fetchedAt: string;
  expiresAt: string;
  importance: number;
}

export interface SpinoIntelSnapshot {
  status: "idle" | "fresh" | "partial" | "error";
  location: {
    label: string;
    lat: number;
    lon: number;
  };
  items: SpinoIntelItem[];
  sources: string[];
  errors: string[];
  fetchedAt: string;
  expiresAt: string;
  nextRefreshAt: string;
}

const INTEL_KEY = "pocketflow.spino.onlineIntel.v1";
export const SPINO_INTEL_TTL_MS = 144 * 60 * 60 * 1000;
export const SPINO_INTEL_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const DEFAULT_LOCATION = {
  label: "Turin / Piemonte",
  lat: 45.0703,
  lon: 7.6869,
};

const nowIso = () => new Date().toISOString();
const expiresIso = (ttlMs = SPINO_INTEL_TTL_MS) => new Date(Date.now() + ttlMs).toISOString();
const refreshIso = () => new Date(Date.now() + SPINO_INTEL_REFRESH_INTERVAL_MS).toISOString();

const compact = (value: string, max = 220) => {
  const clean = value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trim()}...` : clean;
};

const itemId = (kind: SpinoIntelKind, title: string, source: string) =>
  `${kind}_${source}_${title}`.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 96);

const createItem = (
  kind: SpinoIntelKind,
  title: string,
  summary: string,
  source: string,
  extras: Partial<SpinoIntelItem> = {},
): SpinoIntelItem => ({
  id: extras.id || itemId(kind, title, source),
  kind,
  title: compact(title, 120),
  summary: compact(summary, 260),
  source,
  fetchedAt: nowIso(),
  expiresAt: expiresIso(),
  importance: extras.importance ?? 5,
  ...extras,
});

const emptySnapshot = (): SpinoIntelSnapshot => ({
  status: "idle",
  location: resolveSavedLocation(),
  items: [],
  sources: [],
  errors: [],
  fetchedAt: "",
  expiresAt: "",
  nextRefreshAt: "",
});

const fetchJson = async <T,>(url: string, timeoutMs = 8000): Promise<T> => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
};

const resolveSavedLocation = () => {
  try {
    const saved = JSON.parse(localStorage.getItem("pocketflow.flightRadar.lastPosition") || "null");
    if (typeof saved?.lat === "number" && typeof saved?.lon === "number") {
      return {
        label: saved.source === "native" ? "Phone GPS" : "Saved GPS",
        lat: saved.lat,
        lon: saved.lon,
      };
    }
  } catch {}
  return DEFAULT_LOCATION;
};

export const loadSpinoIntelSnapshot = (): SpinoIntelSnapshot => {
  try {
    const parsed = JSON.parse(localStorage.getItem(INTEL_KEY) || "null");
    if (parsed && Array.isArray(parsed.items)) {
      const now = Date.now();
      const items = parsed.items.filter((item: SpinoIntelItem) => new Date(item.expiresAt).getTime() > now);
      return {
        ...emptySnapshot(),
        ...parsed,
        location: parsed.location || resolveSavedLocation(),
        items,
      };
    }
  } catch {}
  return emptySnapshot();
};

export const saveSpinoIntelSnapshot = (snapshot: SpinoIntelSnapshot) => {
  localStorage.setItem(INTEL_KEY, JSON.stringify(snapshot));
};

export const isSpinoIntelStale = (snapshot: SpinoIntelSnapshot, maxAgeMs = SPINO_INTEL_REFRESH_INTERVAL_MS) => {
  if (!snapshot.fetchedAt || !snapshot.items.length) return true;
  return Date.now() - new Date(snapshot.fetchedAt).getTime() > maxAgeMs;
};

const fetchWeatherIntel = async (location = resolveSavedLocation()) => {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${location.lat}&longitude=${location.lon}` +
    "&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m" +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
    "&timezone=auto";
  const data = await fetchJson<any>(url);
  const current = data?.current || {};
  const daily = data?.daily || {};
  return [
    createItem(
      "weather",
      `Weather ${location.label}`,
      `Now ${current.temperature_2m ?? "--"}°C, feels ${current.apparent_temperature ?? "--"}°C, wind ${current.wind_speed_10m ?? "--"} km/h. Today max ${daily.temperature_2m_max?.[0] ?? "--"}°C, min ${daily.temperature_2m_min?.[0] ?? "--"}°C, rain risk ${daily.precipitation_probability_max?.[0] ?? "--"}%.`,
      "Open-Meteo",
      { importance: 8 },
    ),
  ];
};

const fetchCoinbasePrice = async (symbol: "BTC" | "ETH") => {
  const data = await fetchJson<any>(`https://api.coinbase.com/v2/prices/${symbol}-USD/spot`);
  const amount = Number(data?.data?.amount);
  if (!Number.isFinite(amount)) throw new Error(`${symbol} price missing`);
  return createItem(
    "crypto",
    `${symbol}/USD spot`,
    `${symbol} spot price is $${amount.toLocaleString(undefined, { maximumFractionDigits: symbol === "BTC" ? 0 : 2 })}.`,
    "Coinbase",
    { value: `$${amount.toLocaleString(undefined, { maximumFractionDigits: symbol === "BTC" ? 0 : 2 })}`, importance: 9 },
  );
};

const fetchCryptoIntel = async () => {
  try {
    return await Promise.all([fetchCoinbasePrice("BTC"), fetchCoinbasePrice("ETH")]);
  } catch {
    const data = await fetchJson<any[]>(
      "https://api.binance.com/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22%5D",
    );
    return data.map((entry) => {
      const symbol = String(entry.symbol || "").replace("USDT", "");
      const price = Number(entry.lastPrice);
      const change = Number(entry.priceChangePercent);
      return createItem(
        "crypto",
        `${symbol}/USDT spot`,
        `${symbol} spot price is $${price.toLocaleString(undefined, { maximumFractionDigits: symbol === "BTC" ? 0 : 2 })}, 24h ${change.toFixed(2)}%.`,
        "Binance",
        {
          value: `$${price.toLocaleString(undefined, { maximumFractionDigits: symbol === "BTC" ? 0 : 2 })}`,
          change: `${change.toFixed(2)}%`,
          importance: 9,
        },
      );
    });
  }
};

const fetchMarketIntel = async () => {
  try {
    const symbols = "spy.us,qqq.us,nvda.us,aapl.us,msft.us,tsla.us";
    const data = await fetchJson<{ symbols?: any[] }>(`https://stooq.com/q/l/?s=${symbols}&f=sd2t2ohlcv&h&e=json`);
    const items = (data.symbols || [])
      .filter((entry) => Number.isFinite(Number(entry.close)))
      .slice(0, 8)
      .map((entry) =>
        createItem(
          "market",
          `${String(entry.symbol || "").toUpperCase()} market quote`,
          `Last ${entry.close}, open ${entry.open}, high ${entry.high}, low ${entry.low}, volume ${entry.volume}.`,
          "Stooq",
          { value: String(entry.close), importance: 7 },
        ),
      );
    if (items.length) return items;
  } catch {}

  const yahooSymbols = ["SPY", "QQQ", "NVDA", "AAPL", "MSFT", "TSLA"];
  const results = await Promise.allSettled(
    yahooSymbols.map(async (symbol) => {
      const data = await fetchJson<any>(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=5m`);
      const result = data?.chart?.result?.[0];
      const meta = result?.meta || {};
      const quote = result?.indicators?.quote?.[0] || {};
      const closes = (quote.close || []).filter((value: unknown) => Number.isFinite(Number(value)));
      const last = Number(meta.regularMarketPrice ?? closes[closes.length - 1]);
      const previous = Number(meta.chartPreviousClose ?? meta.previousClose);
      const change = Number.isFinite(last) && Number.isFinite(previous) && previous
        ? `${(((last - previous) / previous) * 100).toFixed(2)}%`
        : "";
      return createItem(
        "market",
        `${symbol} market quote`,
        `Last ${Number.isFinite(last) ? last.toFixed(2) : "--"}${change ? `, session ${change}` : ""}.`,
        "Yahoo Finance chart",
        { value: Number.isFinite(last) ? last.toFixed(2) : undefined, change, importance: 7 },
      );
    }),
  );
  const items = results
    .filter((result): result is PromiseFulfilledResult<SpinoIntelItem> => result.status === "fulfilled")
    .map((result) => result.value);
  if (!items.length) throw new Error("Market quote sources unavailable");
  return items;
};

const fetchGdeltArticles = async (query: string, label: string, limit = 5) => {
  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc" +
    `?query=${encodeURIComponent(query)}` +
    `&mode=artlist&maxrecords=${limit}&format=json&sort=hybridrel`;
  const data = await fetchJson<any>(url);
  return (data?.articles || []).slice(0, limit).map((article: any, index: number) =>
    createItem(
      "news",
      article.title || `${label} headline ${index + 1}`,
      `${article.sourceCommonName || article.domain || "news"}: ${article.title || "Headline unavailable"}`,
      `GDELT / ${label}`,
      {
        url: article.url,
        importance: 6 + Math.max(0, limit - index),
        id: itemId("news", `${label}_${article.title || index}`, article.sourceCommonName || "gdelt"),
      },
    ),
  );
};

export const fetchSpinoResearchItems = async (query: string) => {
  const [gdelt, wiki] = await Promise.allSettled([
    fetchGdeltArticles(query, "research", 5),
    fetchJson<any>(
      `https://en.wikipedia.org/w/api.php?action=query&origin=*&format=json&list=search&srlimit=4&srsearch=${encodeURIComponent(query)}`,
    ),
  ]);
  const newsItems = gdelt.status === "fulfilled" ? gdelt.value : [];
  const wikiItems = wiki.status === "fulfilled"
    ? (wiki.value?.query?.search || []).map((result: any) =>
        createItem(
          "research",
          result.title || "Wikipedia result",
          compact(result.snippet || "Wikipedia summary available."),
          "Wikipedia",
          {
            url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(result.title || "").replace(/\s+/g, "_"))}`,
            importance: 5,
          },
        ),
      )
    : [];
  return [...newsItems, ...wikiItems].slice(0, 8);
};

export const refreshSpinoIntel = async (options: { force?: boolean } = {}) => {
  const current = loadSpinoIntelSnapshot();
  if (!options.force && !isSpinoIntelStale(current)) return current;

  const location = resolveSavedLocation();
  const tasks = await Promise.allSettled([
    fetchWeatherIntel(location),
    fetchCryptoIntel(),
    fetchMarketIntel(),
    fetchGdeltArticles(
      "(Torino OR Turin OR Piemonte OR Piedmont OR Italy OR Italia OR markets OR stocks OR AI OR cybersecurity OR technology)",
      "headlines",
      12,
    ),
  ]);

  const items: SpinoIntelItem[] = [];
  const errors: string[] = [];
  const sources = new Set<string>();
  for (const task of tasks) {
    if (task.status === "fulfilled") {
      task.value.forEach((item) => {
        items.push(item);
        sources.add(item.source);
      });
    } else {
      errors.push(task.reason instanceof Error ? task.reason.message : "source failed");
    }
  }

  const snapshot: SpinoIntelSnapshot = {
    status: items.length && errors.length ? "partial" : items.length ? "fresh" : "error",
    location,
    items: items
      .sort((a, b) => b.importance - a.importance || b.fetchedAt.localeCompare(a.fetchedAt))
      .slice(0, 42),
    sources: Array.from(sources).sort(),
    errors,
    fetchedAt: nowIso(),
    expiresAt: expiresIso(),
    nextRefreshAt: refreshIso(),
  };
  saveSpinoIntelSnapshot(snapshot);
  return snapshot;
};

export const shouldUseSpinoOnlineIntel = (prompt: string) => {
  const normalized = prompt.toLowerCase();
  return /\b(news|headline|today|latest|weather|meteo|forecast|stock|stocks|market|markets|btc|bitcoin|eth|ethereum|crypto|coinbase|research|search|google|what happened|updates?|train|trains|treno|treni|rail|departures?|tickets?|fares?|prices?)\b/.test(normalized);
};

export const buildSpinoIntelContext = (snapshot: SpinoIntelSnapshot, limit = 18) => {
  const liveItems = snapshot.items.filter((item) => new Date(item.expiresAt).getTime() > Date.now()).slice(0, limit);
  if (!liveItems.length) return "";
  return [
    `ONLINE BALOSS LLM 144H INTELLIGENCE`,
    `Fetched: ${snapshot.fetchedAt || "not yet"} / expires: ${snapshot.expiresAt || "not yet"}`,
    `Location anchor: ${snapshot.location.label} (${snapshot.location.lat.toFixed(3)}, ${snapshot.location.lon.toFixed(3)})`,
    ...liveItems.map((item, index) => {
      const value = [item.value, item.change].filter(Boolean).join(" / ");
      return `[O${index + 1}] ${item.kind.toUpperCase()} / ${item.title}${value ? ` (${value})` : ""}\n${item.summary}\nSource: ${item.source}${item.url ? ` / ${item.url}` : ""}`;
    }),
  ].join("\n\n");
};

export const buildSpinoIntelContextForPrompt = (prompt: string, snapshot: SpinoIntelSnapshot, limit = 18) => {
  const normalized = prompt.toLowerCase();
  const wantsWeather = /\b(weather|meteo|forecast|temperature|rain|pioggia|tempo)\b/.test(normalized);
  const wantsCrypto = /\b(btc|bitcoin|eth|ethereum|crypto|coinbase)\b/.test(normalized);
  const wantsMarket = /\b(stock|stocks|market|markets|nasdaq|sp500|s&p|finance|borsa)\b/.test(normalized);
  const wantsNews = /\b(news|headline|latest|today|what happened|updates?|notizie|giornali|week|weekly)\b/.test(normalized);
  const kinds: SpinoIntelKind[] = wantsNews && !wantsMarket && !wantsCrypto
    ? ["news", "research"]
    : wantsWeather
      ? ["weather"]
      : wantsMarket || wantsCrypto
        ? ["market", "crypto"]
        : ["news", "weather", "market"];
  const filtered = snapshot.items.filter((item) => kinds.includes(item.kind));
  return buildSpinoIntelContext({ ...snapshot, items: filtered }, limit);
};

const pickItems = (snapshot: SpinoIntelSnapshot, kinds: SpinoIntelKind[], limit = 8) =>
  snapshot.items
    .filter((item) => kinds.includes(item.kind) && new Date(item.expiresAt).getTime() > Date.now())
    .slice(0, limit);

export const answerFromSpinoIntel = (
  prompt: string,
  snapshot: SpinoIntelSnapshot,
  researchItems: SpinoIntelItem[] = [],
) => {
  const normalized = prompt.toLowerCase();
  const wantsWeather = /\b(weather|meteo|forecast|temperature|rain|pioggia|tempo)\b/.test(normalized);
  const wantsCrypto = /\b(btc|bitcoin|eth|ethereum|crypto|coinbase)\b/.test(normalized);
  const wantsMarket = /\b(stock|stocks|market|markets|nasdaq|sp500|s&p|finance|borsa)\b/.test(normalized);
  const wantsNews = /\b(news|headline|latest|today|what happened|updates?)\b/.test(normalized);
  const wantsResearch = /\b(search|research|google|look up|find)\b/.test(normalized) || researchItems.length > 0;

  const sections: string[] = [];
  const addSection = (title: string, items: SpinoIntelItem[]) => {
    if (!items.length) return;
    sections.push([
      title,
      ...items.map((item) => {
        const value = [item.value, item.change].filter(Boolean).join(" / ");
        return `- ${item.title}${value ? `: ${value}` : ""}. ${item.summary} (${item.source})`;
      }),
    ].join("\n"));
  };

  if (wantsWeather) addSection("Weather", pickItems(snapshot, ["weather"], 3));
  if (wantsCrypto) addSection("Crypto", pickItems(snapshot, ["crypto"], 4));
  if (wantsMarket) addSection("Markets", pickItems(snapshot, ["market", "crypto"], 8));
  if (wantsNews) addSection("Fresh headlines", pickItems(snapshot, ["news"], 8));
  if (wantsResearch) addSection("Online research", researchItems.slice(0, 8));
  if (!sections.length && shouldUseSpinoOnlineIntel(prompt)) {
    const fallbackKinds: SpinoIntelKind[] = wantsNews
      ? ["news", "research"]
      : wantsWeather
        ? ["weather"]
        : wantsMarket || wantsCrypto
          ? ["market", "crypto"]
          : ["news", "weather", "market"];
    addSection("Fresh context", pickItems(snapshot, fallbackKinds, 10));
  }

  if (!sections.length) return null;
  return [
    "I checked the 144-hour online intelligence cache and fresh public sources.",
    sections.join("\n\n"),
    `Cache: ${snapshot.status}; fetched ${snapshot.fetchedAt || "not yet"}; expires ${snapshot.expiresAt || "not yet"}.`,
  ].join("\n\n");
};
