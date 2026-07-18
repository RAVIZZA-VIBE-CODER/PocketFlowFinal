import type { SpinoIndexState, SpinoRuntimeStats } from "./spinoLLMEngine";
import type { SpinoIntelSnapshot } from "./spinoOnlineIntel";

export type SpinoAgentId =
  | "navigator"
  | "cursor"
  | "launcher"
  | "memory"
  | "calendar"
  | "notes"
  | "reader"
  | "research"
  | "browser"
  | "builder"
  | "archive"
  | "dashboard"
  | "settings"
  | "model"
  | "relay"
  | "cloud"
  | "crm"
  | "news"
  | "newsletter"
  | "moltbook"
  | "bigbrain"
  | "server"
  | "cards"
  | "radar"
  | "media"
  | "meeting"
  | "security"
  | "automation"
  | "communications"
  | "market"
  | "weather"
  | "hardware"
  | "system"
  | "voice";

export interface SpinoAgentNode {
  id: SpinoAgentId;
  label: string;
  role: string;
  apps: string[];
  tools: string[];
  localCapable: boolean;
  onlineRequired: boolean;
  permission: "core" | "approved" | "ask-first";
}

export interface SpinoReservedAgentSlot {
  id: string;
  label: string;
  purpose: string;
  status: "reserved";
  activation: string;
}

export interface SpinoRouteDecision {
  primaryAgentId: SpinoAgentId;
  agentLabel: string;
  confidence: number;
  taskType:
    | "chat"
    | "navigation"
    | "cursor"
    | "memory"
    | "calendar"
    | "note"
    | "research"
    | "file"
    | "builder"
    | "dashboard"
    | "settings"
    | "model"
    | "relay"
    | "cloud"
    | "crm"
    | "news"
    | "newsletter"
    | "moltbook"
    | "bigbrain"
    | "server"
    | "cards"
    | "radar"
    | "media"
    | "meeting"
    | "security"
    | "automation"
    | "communication"
    | "market"
    | "weather"
    | "hardware"
    | "system"
    | "voice";
  privacy: "private" | "local_files" | "notes" | "memory" | "device" | "public";
  needsOnline: boolean;
  allowedTools: string[];
  rationale: string;
}

export interface SpinoHeartbeat {
  status: "green" | "yellow" | "red" | "white";
  label: string;
  core: string;
  model: string;
  memory: string;
  research: string;
  agentsReady: number;
  toolsReady: number;
  details: string[];
}

export const SPINO_AGENT_NODES: SpinoAgentNode[] = [
  {
    id: "navigator",
    label: "Navigation Agent",
    role: "Routes between PocketFlow apps, returns to Home, keeps current screen context, and focuses the correct panel.",
    apps: ["Home", "PocketFlow Shell", "All apps"],
    tools: ["open-app", "route-screen", "back-home", "focus-panel"],
    localCapable: true,
    onlineRequired: false,
    permission: "core",
  },
  {
    id: "cursor",
    label: "Cursor Agent",
    role: "Plans owner-approved taps, scrolls, cursor moves, text entry, and visible UI automation inside allowed PocketFlow screens.",
    apps: ["PocketFlow Shell", "Relay", "Reader", "PocketWeb"],
    tools: ["tap-target", "scroll-target", "type-text", "gesture-route", "confirm-action"],
    localCapable: true,
    onlineRequired: false,
    permission: "ask-first",
  },
  {
    id: "launcher",
    label: "Launcher Agent",
    role: "Maintains app launch state, bottom navigation order, active app memory, and phone-first layout behavior.",
    apps: ["Home", "PocketFlow Shell"],
    tools: ["launcher-open", "nav-scroll", "active-app-state"],
    localCapable: true,
    onlineRequired: false,
    permission: "core",
  },
  {
    id: "memory",
    label: "Memory Agent",
    role: "Stores and recalls personal facts, contacts, preferences, work context, and conversation summaries.",
    apps: ["Baloss", "MemoPad", "Reader"],
    tools: ["learn-memory", "recall-memory", "summarize-conversation"],
    localCapable: true,
    onlineRequired: false,
    permission: "core",
  },
  {
    id: "calendar",
    label: "Calendar Agent",
    role: "Unparks from MemoPad/Baloss when a dictated note or prompt needs calendar add, move, remove, or schedule answers.",
    apps: ["MemoPad", "Baloss"],
    tools: ["calendar-add", "calendar-move", "calendar-remove", "calendar-query"],
    localCapable: true,
    onlineRequired: false,
    permission: "approved",
  },
  {
    id: "notes",
    label: "MemoPad Agent",
    role: "Creates notes, voice memos, summaries, task lists, shopping lists, and manual project notes from typed or dictated context.",
    apps: ["MemoPad", "Reader", "Baloss"],
    tools: ["note-create", "note-search", "voice-memo-save", "summary-create", "task-list-create"],
    localCapable: true,
    onlineRequired: false,
    permission: "approved",
  },
  {
    id: "reader",
    label: "Reader Agent",
    role: "Reads files, dashboards, PDFs, images, archives, and sends opened content to memory.",
    apps: ["Reader", "Storage", "Cloud"],
    tools: ["open-reader", "inspect-file", "archive-file", "extract-text"],
    localCapable: true,
    onlineRequired: false,
    permission: "approved",
  },
  {
    id: "research",
    label: "Research Agent",
    role: "Collects current news, weather, markets, BTC/ETH, and web results when internet is allowed.",
    apps: ["PocketWeb", "WWW", "Cloud", "Baloss"],
    tools: ["news-cache", "weather-api", "market-api", "crypto-api", "web-search"],
    localCapable: false,
    onlineRequired: true,
    permission: "ask-first",
  },
  {
    id: "news",
    label: "News Agent",
    role: "Collects approved headlines, summarizes top stories, pins important items, and expires stale news memory after 144 hours.",
    apps: ["News Flow", "Baloss", "PocketWeb"],
    tools: ["news-refresh", "headline-summarize", "news-pin", "news-expire"],
    localCapable: false,
    onlineRequired: true,
    permission: "ask-first",
  },
  {
    id: "market",
    label: "Market Agent",
    role: "Reads public crypto, stock, and market APIs for BTC, ETH, watchlists, and daily movement summaries.",
    apps: ["Home", "Baloss", "PocketWeb"],
    tools: ["crypto-price", "stock-quote", "market-summary", "price-cache"],
    localCapable: false,
    onlineRequired: true,
    permission: "ask-first",
  },
  {
    id: "weather",
    label: "Weather Agent",
    role: "Fetches forecast, current weather, alerts, and location-aware travel conditions when online access is allowed.",
    apps: ["Home", "Baloss"],
    tools: ["weather-current", "weather-forecast", "weather-alerts"],
    localCapable: false,
    onlineRequired: true,
    permission: "ask-first",
  },
  {
    id: "browser",
    label: "Browser Agent",
    role: "Navigates PocketWeb and saved sites without leaking private local context by default.",
    apps: ["PocketWeb", "WWW"],
    tools: ["open-url", "search-web", "save-starred-site"],
    localCapable: false,
    onlineRequired: true,
    permission: "ask-first",
  },
  {
    id: "cloud",
    label: "Cloud Agent",
    role: "Handles Private Transfer Desk links, downloaded assets, Archive handoffs, Reader opening, and cloud status.",
    apps: ["Cloud", "Reader", "Archive"],
    tools: ["cloud-open", "cloud-download", "archive-handoff", "reader-open"],
    localCapable: true,
    onlineRequired: true,
    permission: "approved",
  },
  {
    id: "builder",
    label: "Builder Agent",
    role: "Helps with build order, box numbering, instructions, and project packaging.",
    apps: ["Builder", "Reader", "Storage"],
    tools: ["builder-box-list", "builder-order", "package-export"],
    localCapable: true,
    onlineRequired: false,
    permission: "approved",
  },
  {
    id: "dashboard",
    label: "Dashboard Agent",
    role: "Routes dashboard preview/editing to Reader, keeps dashboards interactive, and avoids legacy Studio-only edits.",
    apps: ["Reader", "Dashboard Studio", "Builder"],
    tools: ["dashboard-preview", "dashboard-source-edit", "dashboard-package"],
    localCapable: true,
    onlineRequired: false,
    permission: "approved",
  },
  {
    id: "archive",
    label: "Archive Agent",
    role: "Keeps downloads, Reader files, Cloud files, and project files organized by type.",
    apps: ["Storage", "Reader", "Cloud"],
    tools: ["archive-save", "archive-search", "archive-sort"],
    localCapable: true,
    onlineRequired: false,
    permission: "approved",
  },
  {
    id: "settings",
    label: "Settings Agent",
    role: "Controls PocketFlow model settings, Groq key pool, app permissions, and owner-approved device toggles.",
    apps: ["Settings", "Baloss", "Connection Booth"],
    tools: ["settings-read", "settings-toggle", "keypool-health", "permission-request"],
    localCapable: true,
    onlineRequired: false,
    permission: "ask-first",
  },
  {
    id: "model",
    label: "Model Agent",
    role: "Manages Baloss LLM model choice, RAM guard, runtime state, token speed, and local/online routing.",
    apps: ["Baloss", "Settings"],
    tools: ["model-select", "model-start", "model-stop", "ram-guard", "token-meter"],
    localCapable: true,
    onlineRequired: false,
    permission: "ask-first",
  },
  {
    id: "relay",
    label: "Relay Agent",
    role: "Pairs approved computers, Codex relay, local preview, sidecar modes, and workspace handoff through signed sessions.",
    apps: ["Relay", "Connection Booth", "PocketWeb"],
    tools: ["relay-sign", "relay-boot", "relay-preview", "sidecar-start", "workspace-handoff"],
    localCapable: true,
    onlineRequired: false,
    permission: "ask-first",
  },
  {
    id: "crm",
    label: "CRM Mail Agent",
    role: "Manages Cia Cia Ciao contacts, mailboxes, lists, send/receive tests, and newsletter contact sync.",
    apps: ["CRM", "News Flow", "Baloss"],
    tools: ["contact-list", "imap-check", "smtp-send", "mailbox-sync", "crm-list-sync"],
    localCapable: true,
    onlineRequired: true,
    permission: "ask-first",
  },
  {
    id: "newsletter",
    label: "Newsletter Agent",
    role: "Composes News Flow newsletters, validates campaign/list health, schedules CRM sends, and reports delivery status.",
    apps: ["News Flow", "CRM", "Baloss"],
    tools: ["campaign-compose", "newsletter-preview", "quality-control", "crm-send", "campaign-health"],
    localCapable: true,
    onlineRequired: true,
    permission: "ask-first",
  },
  {
    id: "moltbook",
    label: "Moltbook Posting Agent",
    role: "Plans and publishes public-safe AI/build updates, comments, reserve queues, and schedule health.",
    apps: ["Moltbook", "Baloss"],
    tools: ["post-plan", "post-publish", "comment-reply", "reserve-queue", "moltbook-health"],
    localCapable: true,
    onlineRequired: true,
    permission: "ask-first",
  },
  {
    id: "bigbrain",
    label: "BigBrain Memory Agent",
    role: "Connects Tommyboy EncyclopediaModule, search helpers, citations, external memory health, and offline RAG.",
    apps: ["Baloss", "Archive", "Reader"],
    tools: ["encyclopedia-search", "rag-pull", "citation-read", "module-health", "memory-push"],
    localCapable: true,
    onlineRequired: false,
    permission: "approved",
  },
  {
    id: "server",
    label: "eMAP Server Agent",
    role: "Checks external server stations, health pages, ports, error cards, and prompt-ready diagnostics inside System Map.",
    apps: ["System Map", "Relay", "Baloss"],
    tools: ["server-scan", "port-health", "error-profile", "fix-prompt", "service-summary"],
    localCapable: true,
    onlineRequired: true,
    permission: "ask-first",
  },
  {
    id: "cards",
    label: "Cards Agent",
    role: "Maintains QR business cards, labels, border colors, saved links, and share-ready card pages.",
    apps: ["Cards", "Reader"],
    tools: ["card-add", "card-edit", "qr-preview", "copy-card-link"],
    localCapable: true,
    onlineRequired: false,
    permission: "approved",
  },
  {
    id: "radar",
    label: "Flight Radar Agent",
    role: "Uses GPS and ADS-B APIs to plot nearby aircraft, refresh radar state, and keep aviation data clearly marked non-navigation.",
    apps: ["Flight Radar", "Home"],
    tools: ["gps-center", "adsb-fetch", "bearing-distance", "radar-refresh"],
    localCapable: false,
    onlineRequired: true,
    permission: "ask-first",
  },
  {
    id: "meeting",
    label: "Meeting Notes Agent",
    role: "Coordinates long recording, live transcription, anonymous speaker labels, summaries, exports, and Reader archive packages.",
    apps: ["Notes", "Reader", "Archive", "Baloss"],
    tools: ["meeting-start", "transcription-stream", "speaker-labels", "meeting-summary", "meeting-export"],
    localCapable: true,
    onlineRequired: false,
    permission: "approved",
  },
  {
    id: "media",
    label: "Media Agent",
    role: "Routes images, audio, recordings, video, screenshots, and voice memos into Reader, Notes, or Archive.",
    apps: ["Reader", "Notes", "Archive"],
    tools: ["media-preview", "audio-transcribe", "image-inspect", "voice-memo-archive"],
    localCapable: true,
    onlineRequired: false,
    permission: "approved",
  },
  {
    id: "security",
    label: "Security Audit Agent",
    role: "Runs authorised safety review, password hygiene, permission checks, and risk notes without credential cracking.",
    apps: ["Settings", "Relay", "Archive"],
    tools: ["permission-audit", "password-strength", "exposure-check", "security-report"],
    localCapable: true,
    onlineRequired: false,
    permission: "ask-first",
  },
  {
    id: "automation",
    label: "Automation Agent",
    role: "Turns natural-language routines into approved app actions, calendar events, notes, recurring checks, and reminders.",
    apps: ["Baloss", "Calendar", "Notes", "Settings"],
    tools: ["routine-plan", "trigger-add", "action-chain", "automation-log"],
    localCapable: true,
    onlineRequired: false,
    permission: "ask-first",
  },
  {
    id: "communications",
    label: "Comms Agent",
    role: "Organizes owner-approved contacts, emails, message drafts, call notes, and communication memory.",
    apps: ["Baloss", "Notes", "Reader"],
    tools: ["contact-memory", "message-draft", "email-summary", "call-note"],
    localCapable: true,
    onlineRequired: false,
    permission: "ask-first",
  },
  {
    id: "hardware",
    label: "Hardware Bridge Agent",
    role: "Checks bridge-reported USB, Bluetooth, Wi-Fi, battery, storage, sensors, and Android permissions when granted.",
    apps: ["Settings", "Connection Booth", "Relay"],
    tools: ["usb-detect", "bluetooth-state", "wifi-state", "battery-state", "storage-state"],
    localCapable: true,
    onlineRequired: false,
    permission: "ask-first",
  },
  {
    id: "system",
    label: "System Agent",
    role: "Controls authorised PocketFlow settings, model power, relay state, and local device modes.",
    apps: ["Settings", "Connection Booth", "Baloss"],
    tools: ["model-power", "settings-toggle", "relay-status"],
    localCapable: true,
    onlineRequired: false,
    permission: "ask-first",
  },
  {
    id: "voice",
    label: "Voice Agent",
    role: "Runs stable dictation, transcription cleanup, TTS fallback, and voice action routing.",
    apps: ["Baloss", "Notes", "Calendar"],
    tools: ["speech-recognition", "text-to-speech", "voice-action-route"],
    localCapable: true,
    onlineRequired: false,
    permission: "approved",
  },
];

export const SPINO_RESERVED_AGENT_SLOTS: SpinoReservedAgentSlot[] = [
  {
    id: "payments",
    label: "Payments Agent Slot",
    purpose: "Future invoices, checkout, receipts, and safe finance automations.",
    status: "reserved",
    activation: "Enable only after payment backend and owner approval flow exist.",
  },
  {
    id: "device-control",
    label: "Device Control Agent Slot",
    purpose: "Future approved Android, USB, screen, and hardware controls.",
    status: "reserved",
    activation: "Enable when the native bridge exposes verified controls.",
  },
  {
    id: "design-review",
    label: "Design Review Agent Slot",
    purpose: "Future UI/UX screenshot critique, visual QA, and phone-layout review.",
    status: "reserved",
    activation: "Enable when screenshot review and app preview capture are stable.",
  },
  {
    id: "dataset-curator",
    label: "Dataset Curator Agent Slot",
    purpose: "Future BigBrain dataset import, license review, dedupe, and indexing.",
    status: "reserved",
    activation: "Enable when external modules are mounted and writable.",
  },
  {
    id: "deployment",
    label: "Deployment Agent Slot",
    purpose: "Future deploy, rollback, domain, and production health workflows.",
    status: "reserved",
    activation: "Enable when target hosts and credentials are explicitly connected.",
  },
];

const findAgent = (id: SpinoAgentId) => SPINO_AGENT_NODES.find((agent) => agent.id === id) || SPINO_AGENT_NODES[0];

export const classifySpinoIntent = (prompt: string, onlineAllowed: boolean): SpinoRouteDecision => {
  const text = prompt.toLowerCase();
  const match = (pattern: RegExp) => pattern.test(text);
  let primaryAgentId: SpinoAgentId = "memory";
  let taskType: SpinoRouteDecision["taskType"] = "chat";
  let privacy: SpinoRouteDecision["privacy"] = "memory";
  let needsOnline = false;
  let confidence = 0.54;
  let rationale = "Conversation routed through memory-first chat.";

  if (match(/\b(open|launch|go to|switch to|show me|take me to|home|launcher|main page|navigation|navigate|back)\b/)) {
    primaryAgentId = "navigator";
    taskType = "navigation";
    privacy = "device";
    confidence = 0.78;
    rationale = "App navigation or launcher wording detected.";
  } else if (match(/\b(click|tap|press|hold|long press|scroll|swipe|cursor|mouse|type into|select button|move pointer|touch)\b/)) {
    primaryAgentId = "cursor";
    taskType = "cursor";
    privacy = "device";
    confidence = 0.84;
    rationale = "Touch, cursor, or visible UI automation wording detected.";
  } else if (match(/\b(meeting|call recording|record call|meeting notes|transcribe|transcription|voice memo|dictation|speaker|recording|minutes)\b/)) {
    primaryAgentId = "meeting";
    taskType = "meeting";
    privacy = "notes";
    confidence = 0.9;
    rationale = "Meeting, recording, transcription, or speaker workflow detected.";
  } else if (match(/\b(newsletter|campaign|mailing list|daily brief|crm send|send newsletter|newsletter archive)\b/)) {
    primaryAgentId = "newsletter";
    taskType = "newsletter";
    privacy = "private";
    needsOnline = true;
    confidence = onlineAllowed ? 0.9 : 0.62;
    rationale = onlineAllowed ? "Newsletter campaign workflow detected." : "Newsletter requested, but online access is not allowed.";
  } else if (match(/\b(crm|contact list|imap|smtp|mailbox|email account|cia cia ciao|mail account)\b/)) {
    primaryAgentId = "crm";
    taskType = "crm";
    privacy = "private";
    needsOnline = true;
    confidence = onlineAllowed ? 0.88 : 0.58;
    rationale = onlineAllowed ? "CRM mailbox/contact workflow detected." : "CRM requested, but online access is not allowed.";
  } else if (match(/\b(moltbook|post|comment|followers|agentmoltbook|balossbuddybot|posting agent)\b/)) {
    primaryAgentId = "moltbook";
    taskType = "moltbook";
    privacy = "public";
    needsOnline = true;
    confidence = onlineAllowed ? 0.88 : 0.58;
    rationale = onlineAllowed ? "Moltbook public posting workflow detected." : "Moltbook requested, but online access is not allowed.";
  } else if (match(/\b(bigbrain|tommyboy|encyclopedia|external memory|rag|kiwix|wikidata|offline memory)\b/)) {
    primaryAgentId = "bigbrain";
    taskType = "bigbrain";
    privacy = "local_files";
    confidence = 0.88;
    rationale = "BigBrain or external memory workflow detected.";
  } else if (match(/\b(tanuki server|server monitor|server health|port|service health|moltbook server|crm server|web monitor)\b/)) {
    primaryAgentId = "server";
    taskType = "server";
    privacy = "device";
    needsOnline = true;
    confidence = onlineAllowed ? 0.84 : 0.58;
    rationale = onlineAllowed ? "eMAP external server monitoring workflow detected." : "Server monitoring requested, but online access is not allowed.";
  } else if (match(/\b(cal|calendar|calender|calander|calandar|callendar|callander|calamnder|calamendar|agenda|appointment|event|plans?|schedule|reminder|domani|tomorrow|tommorow|tomorow)\b/)) {
    primaryAgentId = "calendar";
    taskType = "calendar";
    privacy = "notes";
    confidence = 0.9;
    rationale = "Calendar vocabulary detected.";
  } else if (match(/\b(note|notes|memo|voice memo|take note|save this|write this down)\b/)) {
    primaryAgentId = "notes";
    taskType = "note";
    privacy = "notes";
    confidence = 0.86;
    rationale = "Note or memo instruction detected.";
  } else if (match(/\b(reader|file|pdf|docx|zip|folder|archive|download|html|json|csv|spreadsheet|ebook|pages)\b/)) {
    primaryAgentId = match(/\b(cloud|transfer desk|private transfer)\b/)
      ? "cloud"
      : match(/\b(archive|storage|folder|folders|download)\b/)
        ? "archive"
        : "reader";
    taskType = "file";
    privacy = "local_files";
    confidence = 0.8;
    rationale = "File or Reader workflow detected.";
  } else if (match(/\b(image|photo|picture|video|audio|recording|voice memo|screenshot|camera|media)\b/)) {
    primaryAgentId = "media";
    taskType = "media";
    privacy = "local_files";
    confidence = 0.82;
    rationale = "Media, audio, image, or recording workflow detected.";
  } else if (match(/\b(builder|box|node|build order|package|zip|codex instruction|blueprint)\b/)) {
    primaryAgentId = "builder";
    taskType = "builder";
    privacy = "local_files";
    confidence = 0.82;
    rationale = "Builder workflow detected.";
  } else if (match(/\b(dashboard|studio|chart|metric|telemetry|widget)\b/)) {
    primaryAgentId = "dashboard";
    taskType = "dashboard";
    privacy = "local_files";
    confidence = 0.78;
    rationale = "Dashboard or widget workflow detected.";
  } else if (match(/\b(news|headline|newspaper|corriere|la stampa|cnn|wall street journal|wsj|times|cronaca|torino)\b/)) {
    primaryAgentId = "news";
    taskType = "news";
    privacy = "public";
    needsOnline = true;
    confidence = onlineAllowed ? 0.9 : 0.62;
    rationale = onlineAllowed ? "News collection requested." : "News requested, but online access is not allowed.";
  } else if (match(/\b(stock|market|btc|bitcoin|eth|ethereum|coinbase|price|exchange|crypto)\b/)) {
    primaryAgentId = "market";
    taskType = "market";
    privacy = "public";
    needsOnline = true;
    confidence = onlineAllowed ? 0.9 : 0.62;
    rationale = onlineAllowed ? "Market or crypto data requested." : "Market data requested, but online access is not allowed.";
  } else if (match(/\b(weather|meteo|forecast|rain|temperature|wind)\b/)) {
    primaryAgentId = "weather";
    taskType = "weather";
    privacy = "public";
    needsOnline = true;
    confidence = onlineAllowed ? 0.86 : 0.58;
    rationale = onlineAllowed ? "Weather data requested." : "Weather requested, but online access is not allowed.";
  } else if (match(/\b(train|trains|treno|treni|rail|railway|departures?|arrivals?|station|porta susa|rogoredo|milano centrale|milano garibaldi|ticket|tickets|fare|fares|price|prices)\b/)) {
    primaryAgentId = "research";
    taskType = "research";
    privacy = "public";
    needsOnline = true;
    confidence = onlineAllowed ? 0.9 : 0.62;
    rationale = onlineAllowed ? "Live transit or ticket lookup requested." : "Transit lookup requested, but online access is not allowed.";
  } else if (match(/\b(search|research|google|web|browser|youtube|website|url|latest|today)\b/)) {
    primaryAgentId = match(/\b(browser|youtube|website|url|google|bing|yahoo|opera)\b/) ? "browser" : "research";
    taskType = "research";
    privacy = "public";
    needsOnline = true;
    confidence = onlineAllowed ? 0.88 : 0.62;
    rationale = onlineAllowed ? "Live/public research requested." : "Research requested, but online access is not allowed.";
  } else if (match(/\b(cloud|transfer desk|private transfer|download from cloud|cloud file)\b/)) {
    primaryAgentId = "cloud";
    taskType = "cloud";
    privacy = "local_files";
    needsOnline = true;
    confidence = 0.82;
    rationale = "Cloud or Private Transfer Desk workflow detected.";
  } else if (match(/\b(model|llama|gguf|ram|runner|tokens?|groq|api keys?|key pool|aether|spino model|strong model|small model)\b/)) {
    primaryAgentId = "model";
    taskType = "model";
    privacy = "device";
    confidence = 0.86;
    rationale = "Model runtime or key-pool wording detected.";
  } else if (match(/\b(relay|codex|computer|desktop|usb|type c|type-c|sidecar|second screen|screen mode|workspace|terminal|vs code|vscode)\b/)) {
    primaryAgentId = "relay";
    taskType = "relay";
    privacy = "device";
    confidence = 0.84;
    rationale = "Relay, computer connection, or workspace handoff wording detected.";
  } else if (match(/\b(clock|alarm|timer|stopwatch|world time|time zone|timezone|utc|cest|city time)\b/)) {
    primaryAgentId = "radar";
    taskType = "radar";
    privacy = "notes";
    confidence = 0.82;
    rationale = "Airport clock, alarm, or time workflow detected inside Flight Radar.";
  } else if (match(/\b(card|cards|business card|qr|profile link|share profile)\b/)) {
    primaryAgentId = "cards";
    taskType = "cards";
    privacy = "public";
    confidence = 0.84;
    rationale = "Business card or QR workflow detected.";
  } else if (match(/\b(radar|flight|aircraft|plane|planes|adsb|ads-b|airport)\b/)) {
    primaryAgentId = "radar";
    taskType = "radar";
    privacy = "device";
    needsOnline = true;
    confidence = 0.84;
    rationale = "Flight radar or ADS-B workflow detected.";
  } else if (match(/\b(security|audit|password strength|permissions audit|risk|safety|vulnerability|exposure)\b/)) {
    primaryAgentId = "security";
    taskType = "security";
    privacy = "device";
    confidence = 0.76;
    rationale = "Authorised security-audit wording detected.";
  } else if (match(/\b(automation|automate|routine|trigger|every day|recurring|when i|if this|workflow)\b/)) {
    primaryAgentId = "automation";
    taskType = "automation";
    privacy = "device";
    confidence = 0.8;
    rationale = "Automation or routine wording detected.";
  } else if (match(/\b(contact|email|message|whatsapp|call|phone number|address book)\b/)) {
    primaryAgentId = "communications";
    taskType = "communication";
    privacy = "private";
    confidence = 0.76;
    rationale = "Communication or contact workflow detected.";
  } else if (match(/\b(bluetooth|wifi|wi-fi|airplane|battery|storage|sensor|gps|geolocation|hardware|android permission|native bridge)\b/)) {
    primaryAgentId = "hardware";
    taskType = "hardware";
    privacy = "device";
    confidence = 0.8;
    rationale = "Hardware bridge or Android permission wording detected.";
  } else if (match(/\b(model|ram|settings|relay|permission|connection|bluetooth|wifi|system|power|status)\b/)) {
    primaryAgentId = "system";
    taskType = "system";
    privacy = "device";
    confidence = 0.76;
    rationale = "System or runtime control vocabulary detected.";
  } else if (match(/\b(voice|audio|listen|speak|microphone|dictate|live chat|hello|stop)\b/)) {
    primaryAgentId = "voice";
    taskType = "voice";
    privacy = "private";
    confidence = 0.76;
    rationale = "Voice interaction vocabulary detected.";
  } else if (match(/\b(remember|learn|my email|my phone|contact|preference|about me|know about me|what is my|what's my|whats my|do you know my)\b/)) {
    primaryAgentId = "memory";
    taskType = "memory";
    privacy = "memory";
    confidence = 0.9;
    rationale = "Personal memory or learning request detected.";
  }

  const agent = findAgent(primaryAgentId);
  return {
    primaryAgentId,
    agentLabel: agent.label,
    confidence,
    taskType,
    privacy,
    needsOnline,
    allowedTools: agent.tools,
    rationale,
  };
};

export const buildSpinoHeartbeat = ({
  runtimeStats,
  indexState,
  intelSnapshot,
  learnedMemoryCount,
  localOnly,
  allowGeneralKnowledge,
  isGenerating,
  aetherMounted,
}: {
  runtimeStats: SpinoRuntimeStats;
  indexState: SpinoIndexState;
  intelSnapshot: SpinoIntelSnapshot;
  learnedMemoryCount: number;
  localOnly: boolean;
  allowGeneralKnowledge: boolean;
  isGenerating: boolean;
  aetherMounted: boolean;
}): SpinoHeartbeat => {
  const nativeReady = Boolean(runtimeStats.nativeInferenceInstalled && runtimeStats.loaded);
  const modelPresent = Boolean(runtimeStats.modelFileInstalled || runtimeStats.aetherModelInstalled);
  const hasMemory = learnedMemoryCount > 0 || indexState.documents.length > 0;
  const onlineFresh = Boolean(intelSnapshot.items.length && intelSnapshot.fetchedAt);
  const onlineAvailable = typeof navigator !== "undefined" ? navigator.onLine : false;
  const details = [
    nativeReady ? "Native token engine active." : modelPresent ? "Model files installed; native runner pending." : "No executable model file active.",
    hasMemory ? `${learnedMemoryCount} learned memories, ${indexState.documents.length} indexed docs.` : "Memory index needs more personal/work data.",
    onlineFresh ? `${intelSnapshot.items.length} online intel items cached.` : "No fresh online cache.",
    `${SPINO_AGENT_NODES.length} specialist agents registered, including cursor, relay, hardware, and app-control routes.`,
    localOnly ? "Privacy gate: local-only." : allowGeneralKnowledge ? "General knowledge allowed." : "General knowledge blocked.",
  ];

  const status: SpinoHeartbeat["status"] = runtimeStats.crashed
    ? "white"
    : isGenerating
      ? "yellow"
      : nativeReady && hasMemory
        ? "green"
        : modelPresent || hasMemory || onlineFresh
          ? "yellow"
          : "red";

  return {
    status,
    label: status === "green" ? "Heartbeat strong" : status === "yellow" ? "Heartbeat limited" : status === "red" ? "Needs setup" : "Disconnected",
    core: nativeReady ? "Reasoning core: native + routing" : "Reasoning core: routing + retrieval",
    model: nativeReady
      ? `${runtimeStats.loadedModelId || "local model"} loaded`
      : runtimeStats.health === "ready" || runtimeStats.runtimeCanAutostart
        ? "GGUF ready, runtime idle"
        : modelPresent
          ? "GGUF present, runner not confirmed"
          : "model missing",
    memory: aetherMounted ? "Aether mounted" : hasMemory ? "web memory active" : "memory sparse",
    research: onlineFresh ? "144h cache active" : onlineAvailable ? "online available" : "offline",
    agentsReady: SPINO_AGENT_NODES.filter((agent) => agent.localCapable || (agent.onlineRequired && onlineAvailable)).length,
    toolsReady: SPINO_AGENT_NODES.reduce((sum, agent) => sum + agent.tools.length, 0),
    details,
  };
};

export const buildSpinoReasoningEnvelope = (
  prompt: string,
  route: SpinoRouteDecision,
  heartbeat: SpinoHeartbeat,
) => [
  "BALOSS LLM CENTRAL HUB / HEARTBEAT",
  heartbeat.core,
  `Model: ${heartbeat.model}`,
  `Memory: ${heartbeat.memory}`,
  `Research: ${heartbeat.research}`,
  "",
  "ROUTE",
  `Primary agent: ${route.agentLabel}`,
  `Task: ${route.taskType}`,
  `Privacy: ${route.privacy}`,
  `Tools allowed: ${route.allowedTools.join(", ")}`,
  `Route reason: ${route.rationale}`,
  "",
  "OPERATING RULE",
  "Answer normally, but choose the correct PocketFlow agent/tool path before responding. Do not expose hidden reasoning; give the user the result, action status, and next step only.",
  "",
  `USER REQUEST: ${prompt}`,
].join("\n");
