export interface BalossServiceAnswer {
  answer: string;
  sourceLabel: string;
  ok: boolean;
}

type NewsletterProfileLite = {
  id?: string;
  name?: string;
  title?: string;
  enabled?: boolean;
  cadence?: string;
  sendTime?: string;
  sendTimes?: string[];
  sendWeekdays?: number[];
  sendSchedule?: Array<{ weekday?: number; time?: string }>;
};

type NewsletterHealthLite = {
  status?: string;
  summary?: string;
  items?: Array<{
    profileId?: string;
    profileName?: string;
    sendTime?: string;
    status?: string;
    message?: string;
    lastSentAt?: string;
  }>;
};

type TrainDeparture = {
  numeroTreno?: number | string;
  categoriaDescrizione?: string;
  destinazione?: string;
  codOrigine?: string;
  millisDataPartenza?: string | number;
  binarioEffettivoPartenzaDescrizione?: string;
  binarioProgrammatoPartenzaDescrizione?: string;
};

type TrainStop = {
  stazione?: string;
  id?: string;
  programmata?: number;
  effettiva?: number;
  partenza_teorica?: number;
  arrivo_teorico?: number;
  partenzaReale?: number;
  arrivoReale?: number;
  ritardo?: number;
  ritardoPartenza?: number;
  ritardoArrivo?: number;
  binarioEffettivoPartenzaDescrizione?: string;
  binarioProgrammatoPartenzaDescrizione?: string;
  progressivo?: number;
};

type TrainRouteResponse = {
  fermate?: TrainStop[];
};

type ProxyFetchPayload = {
  ok?: boolean;
  text?: string;
  error?: string;
  message?: string;
  status?: number;
};

const NEWSLETTER_PROFILES_KEY = "pocketflow.news.newsletterProfiles.v1";
const NEWSLETTER_HEALTH_KEY = "pocketflow.news.newsletterHealth.v1";
const NEWSLETTER_SCHEDULE_DONE_KEY = "pocketflow.news.newsletterScheduleDone.v1";
const RELAY_ENDPOINT_KEY = "pocketflow.codexRelay.endpoint";
const RELAY_TOKEN_KEY = "pocketflow.codexRelay.token";

const DEFAULT_NEWSLETTER_PROFILES: NewsletterProfileLite[] = [
  {
    id: "newsletter_tanuki_ai_daily",
    name: "Tanuki AI",
    title: "Tanuki AI Daily Brief",
    enabled: true,
    cadence: "daily",
    sendTime: "00:00",
    sendTimes: ["00:00"],
  },
  {
    id: "newsletter_second_life_fashion_daily",
    name: "Second Life Fashion",
    title: "Second Life Studio Fashion Brief",
    enabled: true,
    cadence: "daily",
    sendTime: "18:00",
    sendTimes: ["18:00"],
  },
  {
    id: "newsletter_kapricorn_leaflet",
    name: "Kapricorn Leaflet",
    title: "The Bar Weekly",
    enabled: false,
    cadence: "weekly",
    sendTime: "10:00",
    sendTimes: ["10:00"],
    sendWeekdays: [4],
    sendSchedule: [{ weekday: 4, time: "10:00" }],
  },
];

const stationAliases: Record<string, { label: string; search: string; id?: string }> = {
  portaSusa: { label: "Torino Porta Susa", search: "TORINO PORTA SUSA", id: "S00035" },
  milanoCentrale: { label: "Milano Centrale", search: "MILANO CENTRALE", id: "S01700" },
  milanoRogoredo: { label: "Milano Rogoredo", search: "MILANO ROGOREDO", id: "S01820" },
  milanoGaribaldi: { label: "Milano Porta Garibaldi", search: "MILANO PORTA GARIBALDI", id: "S01645" },
};

const parseJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return (JSON.parse(raw) as T) ?? fallback;
  } catch {
    return fallback;
  }
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s:]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const formatDateTime = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

const formatTime = (value?: number) => {
  if (!value || !Number.isFinite(value)) return "--:--";
  return new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
};

const todayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const newsletterSlotKey = (profileId: string, phase: string, date = new Date(), slot = "default") =>
  `${profileId}:${phase}:${slot}:${todayKey(date)}`;

const normalizeTimes = (times: string[] = [], fallback = "00:00") => {
  const clean = Array.from(new Set(times.filter((time) => /^\d{2}:\d{2}$/.test(String(time)))));
  return clean.length ? clean.sort() : [fallback];
};

const targetNewsletterProfile = (prompt: string, profiles: NewsletterProfileLite[]) => {
  const text = normalizeText(prompt);
  if (/\b(tanuki|ai daily|ai brief)\b/.test(text)) {
    return profiles.find((profile) => /tanuki/i.test(`${profile.id} ${profile.name} ${profile.title}`));
  }
  if (/\b(2nd life|second life|fashion)\b/.test(text)) {
    return profiles.find((profile) => /second|fashion/i.test(`${profile.id} ${profile.name} ${profile.title}`));
  }
  if (/\b(kapricorn|bar weekly|beer)\b/.test(text)) {
    return profiles.find((profile) => /kapricorn|bar weekly/i.test(`${profile.id} ${profile.name} ${profile.title}`));
  }
  return profiles.find((profile) => profile.enabled !== false) || profiles[0];
};

const nextNewsletterSlot = (profile: NewsletterProfileLite, now = new Date()) => {
  const schedule = Array.isArray(profile.sendSchedule) && profile.sendSchedule.length
    ? profile.sendSchedule
        .map((entry) => ({ weekday: Number(entry.weekday), time: String(entry.time || profile.sendTime || "00:00") }))
        .filter((entry) => Number.isInteger(entry.weekday) && entry.weekday >= 0 && entry.weekday <= 6 && /^\d{2}:\d{2}$/.test(entry.time))
    : [];
  const weekdays = Array.isArray(profile.sendWeekdays)
    ? profile.sendWeekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [];
  const times = normalizeTimes([...(profile.sendTimes || []), profile.sendTime || ""].filter(Boolean), profile.sendTime || "00:00");

  for (let offset = 0; offset <= 14; offset += 1) {
    const day = new Date(now);
    day.setDate(now.getDate() + offset);
    const dayEntries = schedule.length
      ? schedule.filter((entry) => entry.weekday === day.getDay()).map((entry) => entry.time)
      : weekdays.length && !weekdays.includes(day.getDay())
        ? []
        : times;
    for (const time of dayEntries.sort()) {
      const [hour = 0, minute = 0] = time.split(":").map(Number);
      const slot = new Date(day);
      slot.setHours(hour, minute, 0, 0);
      if (slot.getTime() > now.getTime()) return { date: slot, time };
    }
  }
  return null;
};

const answerNewsletterStatus = (prompt: string): BalossServiceAnswer => {
  const profiles = parseJson<NewsletterProfileLite[]>(NEWSLETTER_PROFILES_KEY, DEFAULT_NEWSLETTER_PROFILES);
  const mergedProfiles = profiles.length ? profiles : DEFAULT_NEWSLETTER_PROFILES;
  const profile = targetNewsletterProfile(prompt, mergedProfiles) || DEFAULT_NEWSLETTER_PROFILES[0];
  const health = parseJson<NewsletterHealthLite | null>(NEWSLETTER_HEALTH_KEY, null);
  const completed = parseJson<Record<string, string>>(NEWSLETTER_SCHEDULE_DONE_KEY, {});
  const next = nextNewsletterSlot(profile);
  const now = new Date();
  const times = normalizeTimes([...(profile.sendTimes || []), profile.sendTime || ""].filter(Boolean), profile.sendTime || "00:00");
  const todaySent = times
    .map((time) => completed[newsletterSlotKey(String(profile.id || ""), "send", now, time)])
    .find(Boolean);
  const healthItem = health?.items?.find((item) =>
    item.profileId === profile.id || normalizeText(`${item.profileName || ""}`) === normalizeText(`${profile.name || ""}`),
  );
  const status = healthItem?.status || health?.status || "not checked";
  const statusText = healthItem?.message || health?.summary || "";

  return {
    ok: true,
    sourceLabel: "Newsletter service agent",
    answer: [
      `${profile.name || profile.title || "This campaign"} is next planned for ${next ? formatDateTime(next.date) : "no automatic slot found"}.`,
      todaySent ? `Today's ${times.join(", ")} slot is already confirmed.` : `Today status: ${status}${statusText ? ` - ${statusText}` : ""}.`,
      `Schedule: ${times.join(", ")}${profile.sendWeekdays?.length ? ` on weekday ${profile.sendWeekdays.join(", ")}` : " daily"}.`,
    ].join("\n"),
  };
};

const isNewsletterStatusPrompt = (prompt: string) => {
  const text = normalizeText(prompt);
  return /\b(next|when|planned|schedule|scheduled|status|watchdog|sent|send)\b/.test(text) &&
    /\b(newsletter|campaign|tanuki|fashion|second life|2nd life|kapricorn)\b/.test(text);
};

const browserDateForViaggiaTreno = (date = new Date()) => {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (value: number) => String(value).padStart(2, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const timezone = `GMT${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
  return `${weekdays[date.getDay()]} ${months[date.getMonth()]} ${pad(date.getDate())} ${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${timezone}`;
};

const fetchText = async (url: string, timeoutMs = 9000) => {
  const proxyErrors: string[] = [];
  for (const proxyUrl of proxyCandidatesFor(url)) {
    try {
      return await fetchProxyText(proxyUrl, timeoutMs);
    } catch (error) {
      proxyErrors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.text();
  } catch (error) {
    const directMessage = error instanceof Error ? error.message : String(error);
    const proxyMessage = proxyErrors.length ? ` Proxy attempts: ${proxyErrors.slice(0, 2).join("; ")}.` : "";
    throw new Error(`${directMessage}.${proxyMessage}`);
  } finally {
    window.clearTimeout(timer);
  }
};

const normalizeRelayEndpoint = (value: string | null | undefined) => {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    const parsed = new URL(withProtocol);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "";
  }
};

const urlParam = (key: string) => {
  try {
    return new URLSearchParams(window.location.search).get(key) || "";
  } catch {
    return "";
  }
};

const proxyCandidatesFor = (targetUrl: string) => {
  const candidates = [`/api/baloss/fetch?url=${encodeURIComponent(targetUrl)}`];
  const relayEndpoint = normalizeRelayEndpoint(
    urlParam("relayEndpoint") || urlParam("relayHost") || window.localStorage.getItem(RELAY_ENDPOINT_KEY),
  );
  const relayToken = urlParam("relayToken") || urlParam("relayTicket") || window.localStorage.getItem(RELAY_TOKEN_KEY) || "";
  if (relayEndpoint) {
    const query = new URLSearchParams({ url: targetUrl });
    if (relayToken) query.set("token", relayToken);
    candidates.push(`${relayEndpoint}/relay/fetch?${query.toString()}`);
  }
  return candidates;
};

const fetchProxyText = async (proxyUrl: string, timeoutMs = 9000) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(proxyUrl, { signal: controller.signal, cache: "no-store", headers: { Accept: "application/json" } });
    const raw = await response.text();
    let payload: ProxyFetchPayload;
    try {
      payload = JSON.parse(raw) as ProxyFetchPayload;
    } catch {
      throw new Error(`proxy returned ${response.status || "non-json"}`);
    }
    if (!response.ok || !payload.ok || typeof payload.text !== "string") {
      throw new Error(payload.error || payload.message || `proxy failed${payload.status ? ` (${payload.status})` : ""}`);
    }
    return payload.text;
  } finally {
    window.clearTimeout(timer);
  }
};

const fetchJson = async <T,>(url: string, timeoutMs = 9000): Promise<T> => JSON.parse(await fetchText(url, timeoutMs)) as T;

const resolveStation = async (station: { label: string; search: string; id?: string }) => {
  if (station.id) return station;
  const text = await fetchText(`https://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/autocompletaStazione/${encodeURIComponent(station.search)}`);
  const first = text.split(/\n+/).find(Boolean);
  const [, id] = (first || "").split("|");
  if (!id) throw new Error(`Station not found: ${station.label}`);
  return { ...station, id };
};

const detectTrainStations = (prompt: string) => {
  const text = normalizeText(prompt);
  const destination = /\b(rogoredo|rofiara|rufiara)\b/.test(text)
    ? stationAliases.milanoRogoredo
    : /\b(garibaldi)\b/.test(text)
      ? stationAliases.milanoGaribaldi
      : stationAliases.milanoCentrale;
  return {
    origin: stationAliases.portaSusa,
    destination,
  };
};

const stopTime = (stop: TrainStop, direction: "departure" | "arrival") =>
  direction === "departure"
    ? stop.partenzaReale || stop.effettiva || stop.partenza_teorica || stop.programmata
    : stop.arrivoReale || stop.effettiva || stop.arrivo_teorico || stop.programmata;

const bookingUrl = (origin: string, destination: string) =>
  `https://www.trenitalia.com/it.html?from=${encodeURIComponent(origin)}&to=${encodeURIComponent(destination)}`;

const answerTrainLookup = async (prompt: string): Promise<BalossServiceAnswer> => {
  if (!navigator.onLine) {
    return {
      ok: false,
      sourceLabel: "Train service agent",
      answer: "I need internet for live train times. You are offline right now, so I cannot check departures or fares.",
    };
  }

  const detected = detectTrainStations(prompt);
  try {
    const [origin, destination] = await Promise.all([resolveStation(detected.origin), resolveStation(detected.destination)]);
    const boardUrl =
      `https://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/partenze/${origin.id}/${encodeURIComponent(browserDateForViaggiaTreno())}`;
    const departures = await fetchJson<TrainDeparture[]>(boardUrl);
    const now = Date.now();
    const candidates = departures
      .filter((departure) => departure.numeroTreno && departure.codOrigine && departure.millisDataPartenza)
      .slice(0, 70);
    const matches: Array<{
      number: string;
      category: string;
      destination: string;
      departure: number;
      arrival: number;
      delay: number;
      platform: string;
    }> = [];

    for (const train of candidates) {
      if (matches.length >= 10) break;
      try {
        const route = await fetchJson<TrainRouteResponse>(
          `https://www.viaggiatreno.it/infomobilita/resteasy/viaggiatreno/andamentoTreno/${train.codOrigine}/${train.numeroTreno}/${train.millisDataPartenza}`,
          7000,
        );
        const stops = route.fermate || [];
        const fromStop = stops.find((stop) => stop.id === origin.id || normalizeText(stop.stazione || "") === normalizeText(origin.label));
        const toStop = stops.find((stop) => stop.id === destination.id || normalizeText(stop.stazione || "") === normalizeText(destination.label));
        if (!fromStop || !toStop) continue;
        if (typeof fromStop.progressivo === "number" && typeof toStop.progressivo === "number" && toStop.progressivo <= fromStop.progressivo) {
          continue;
        }
        const departure = stopTime(fromStop, "departure") || 0;
        const arrival = stopTime(toStop, "arrival") || 0;
        if (!departure || departure < now - 5 * 60 * 1000) continue;
        matches.push({
          number: String(train.numeroTreno),
          category: String(train.categoriaDescrizione || "").trim() || "Train",
          destination: String(train.destinazione || destination.label),
          departure,
          arrival,
          delay: Number(fromStop.ritardoPartenza ?? fromStop.ritardo ?? 0),
          platform: fromStop.binarioEffettivoPartenzaDescrizione || fromStop.binarioProgrammatoPartenzaDescrizione || train.binarioEffettivoPartenzaDescrizione || train.binarioProgrammatoPartenzaDescrizione || "--",
        });
      } catch {
        // Skip individual trains that do not expose route details.
      }
    }

    if (!matches.length) {
      return {
        ok: false,
        sourceLabel: "ViaggiaTreno realtime",
        answer: `I checked ${origin.label} departures but did not find a direct train stopping at ${destination.label} in the visible realtime board. Check Trenitalia for a connection with changes: ${bookingUrl(origin.label, destination.label)}`,
      };
    }

    const lines = matches.map((train, index) => {
      const durationMin = train.arrival && train.departure ? Math.max(0, Math.round((train.arrival - train.departure) / 60000)) : 0;
      const delay = train.delay ? `, ${train.delay > 0 ? "+" : ""}${train.delay} min` : "";
      return `${index + 1}. ${formatTime(train.departure)} -> ${formatTime(train.arrival)} (${durationMin} min) ${train.category} ${train.number}, platform ${train.platform}${delay}`;
    });

    return {
      ok: true,
      sourceLabel: "ViaggiaTreno realtime",
      answer: [
        `Next direct trains I found from ${origin.label} to ${destination.label}:`,
        ...lines,
        `Prices are not exposed by the realtime board. Check live fares here: ${bookingUrl(origin.label, destination.label)}`,
      ].join("\n"),
    };
  } catch {
    const origin = detected.origin;
    const destination = detected.destination;
    return {
      ok: false,
      sourceLabel: "Train service agent",
      answer: `I understood the route as ${origin.label} to ${destination.label}. The live train feed is blocked from this browser unless the PocketFlow proxy or relay is running, so I cannot safely list realtime departures here. Check live trains and fares here: ${bookingUrl(origin.label, destination.label)}`,
    };
  }
};

const isTrainPrompt = (prompt: string) => {
  const text = normalizeText(prompt);
  return /\b(train|trains|treno|treni|rail|departure|departures|porta susa|torino|turin)\b/.test(text) &&
    /\b(milano|milan|rogoredo|rofiara|garibaldi|centrale)\b/.test(text);
};

export const shouldUseBalossServiceAgent = (prompt: string) => isNewsletterStatusPrompt(prompt) || isTrainPrompt(prompt);

export const answerFromBalossServiceAgent = async (prompt: string): Promise<BalossServiceAnswer | null> => {
  if (isNewsletterStatusPrompt(prompt)) return answerNewsletterStatus(prompt);
  if (isTrainPrompt(prompt)) return answerTrainLookup(prompt);
  return null;
};
