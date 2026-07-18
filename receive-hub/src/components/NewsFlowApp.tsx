import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  ChevronDown,
  Copy,
  ExternalLink,
  Heart,
  Link,
  Mail,
  Newspaper,
  Pin,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react";
import { ciaoCrmSeed } from "../data/ciaoCrmSeed";
import {
  computeNextRun,
  loadBalossDurableJobs,
  markBalossJobResult,
  saveBalossDurableJobs,
  type BalossDurableJob,
  type BalossJobStatus,
} from "../utils/balossDurableScheduler";

type NewsItem = {
  id: string;
  sourceId: string;
  sourceName: string;
  topic: NewsTopic;
  title: string;
  link: string;
  publishedAt: string;
  summary: string;
  fullSummary: string;
  fetchedAt: string;
  qualityControl?: NewsQualityControl;
};

type NewsQualityLevel = "green" | "yellow" | "red";

type NewsQualityControl = {
  score: number;
  level: NewsQualityLevel;
  summary: string;
  signals: string[];
  checkedAt: string;
};

type NewsSource = {
  id: string;
  name: string;
  topic: NewsTopic;
  tone: string;
  priority: number;
  feeds: string[];
  officialPages?: string[];
  kind?: "feed" | "official-page" | "radar-snapshot";
  disabled?: boolean;
  disabledReason?: string;
};

type NewsScoutState = {
  cursor: number;
  botIndex: number;
  batchesRun: number;
  lastRunAt: string;
  lastSourceIds: string[];
  lastMode: "manual" | "scheduled" | "newsletter" | "app";
};

type NewsSourceFailure = {
  count: number;
  lastError: string;
  lastFailedAt: string;
  quarantinedUntil?: string;
};

type NewsTopic =
  | "local"
  | "italy"
  | "politics"
  | "ai"
  | "fashion"
  | "geopolitics"
  | "markets"
  | "world"
  | "mobility"
  | "kapricorn"
  | "beer"
  | "alcohol"
  | "parties";

type SavedNewsItem = NewsItem & {
  savedAt: string;
};

type NewsFlowTab = "feed" | "newsletter" | "campaigns" | "settings";

type NewsletterContact = {
  name?: string;
  email: string;
  tags?: string[];
};

type NewsletterContactList = {
  id: string;
  name: string;
  description: string;
  contacts: NewsletterContact[];
  webhookEnabled: boolean;
  webhookToken: string;
  webhookEndpoint: string;
  webhookLastIngestAt?: string;
  createdAt: string;
  updatedAt: string;
};

type NewsletterProfile = {
  id: string;
  name: string;
  topicFilter: string;
  topicFilters: string[];
  customInterests: string[];
  cadence: "daily" | "weekdays" | "manual";
  title: string;
  intro: string;
  sendTime: string;
  sendTimes: string[];
  sendWeekdays?: number[];
  sendSchedule?: Array<{ weekday: number; time: string }>;
  fromAccount: string;
  crmList: string;
  enabled: boolean;
  topCount: number;
  templateName: string;
  logoDataUrl: string;
  signature: string;
  footprint: string;
  headerBgColor: string;
  headerTextColor: string;
  footerBgColor: string;
  footerTextColor: string;
  accentColor: string;
  bodyBgColor: string;
  fontFamily: string;
  lastBuiltAt?: string;
  lastQueuedAt?: string;
  agentId?: string;
  agentName?: string;
  agentStatus?: NewsletterAgentStatus;
  agentAssignedAt?: string;
};

type NewsletterAgentStatus = "active" | "parked" | "backup" | "stale" | "ready";

type NewsletterAgentAssignment = {
  agentId: string;
  agentName: string;
  profileId: string;
  profileName: string;
  status: NewsletterAgentStatus;
  assignedAt: string;
  lastRenamedAt: string;
  jobId: string;
  parkingLot: "newsletter-active" | "newsletter-parking-yard";
  note: string;
};

type PropertyDigestPreferenceSnapshot = {
  updatedAt?: string;
  selectedZone?: string;
  selectedCityIds?: string[];
  filters?: {
    minPrice?: number;
    maxPrice?: number;
    minBedrooms?: number;
    minSqm?: number;
    maxSqm?: number;
    outdoorNeeded?: boolean;
    garageNeeded?: boolean;
    lakeViewOnly?: boolean;
    query?: string;
  };
  likedListingIds?: string[];
  selectedListingIds?: string[];
  viewedListingIds?: string[];
  newsletterPickIds?: string[];
  newsletterPickSummary?: PropertyDigestNewsletterPick[];
};

type PropertyDigestNewsletterPick = {
  id: string;
  title: string;
  town: string;
  price: number;
  sqm?: number;
  bedrooms?: number;
  baths?: number;
  source: string;
  url?: string;
  reason: string;
};

type PropertyDigestNewsletterItem = NewsItem & {
  propertyDigest: PropertyDigestNewsletterPick;
};

type NewsletterWatchdogStatus = "healthy" | "warning" | "error" | "standby";

type NewsletterWatchdogItem = {
  profileId: string;
  profileName: string;
  title: string;
  status: NewsletterWatchdogStatus;
  sendTime: string;
  recipients: number;
  listLabel: string;
  lastSentAt: string;
  lastAttemptAt: string;
  lastError: string;
  message: string;
};

type NewsletterWatchdogReport = {
  kind: "pocketflow.newsletter.watchdog";
  status: NewsletterWatchdogStatus;
  checkedAt: string;
  reason: string;
  summary: string;
  activeProfiles: number;
  dueSlots: number;
  confirmedToday: number;
  failedSlots: number;
  items: NewsletterWatchdogItem[];
};

type NewsPreferenceAgent = {
  kind: "pocketflow.news.preferenceAgent";
  updatedAt: string;
  learnedFrom: number;
  likedCount: number;
  savedCount: number;
  pinnedCount: number;
  topicWeights: Partial<Record<NewsTopic, number>>;
  sourceWeights: Record<string, number>;
  keywordWeights: Record<string, number>;
  styleHints: string[];
};

type Rss2JsonItem = {
  title?: string;
  link?: string;
  pubDate?: string;
  description?: string;
  content?: string;
};

type FeedPayload =
  | { kind: "xml"; text: string }
  | { kind: "rss2json"; items: Rss2JsonItem[] };

type LocalFeedProxyPayload = {
  ok?: boolean;
  text?: string;
  error?: string;
};

const NEWS_ITEMS_KEY = "pocketflow.news.latestTop10.v2";
const NEWS_SAVED_KEY = "pocketflow.news.saved.v1";
const NEWS_LIKED_KEY = "pocketflow.news.likedIds.v1";
const NEWS_PINNED_KEY = "pocketflow.news.pinnedIds.v1";
const NEWS_SEEN_KEY = "pocketflow.news.seenIds.v1";
const NEWS_DB_KEY = "pocketflow.news.agentDb.v1";
const NEWSFLOW_ARCHIVE_KEY = "pocketflow.archive.newsflow.v1";
const NEWS_LAST_RUN_KEY = "pocketflow.news.lastRunAt.v1";
const NEWS_NEXT_RUN_KEY = "pocketflow.news.nextRunAt.v1";
const NEWS_SCHEDULE_DONE_KEY = "pocketflow.news.scheduleDone.v1";
const NEWS_SCOUT_STATE_KEY = "pocketflow.news.scoutState.v1";
const NEWS_GLOBAL_INTERESTS_KEY = "pocketflow.news.globalInterests.v1";
const NEWS_GLOBAL_SOURCES_KEY = "pocketflow.news.globalSources.v1";
const NEWS_SOURCE_FAILURE_KEY = "pocketflow.news.sourceFailures.v1";
const NEWSFLOW_RETRY_QUEUE_KEY = "pocketflow.news.retryQueue.v1";
const NEWS_PREFERENCE_AGENT_KEY = "pocketflow.news.preferenceAgent.v1";
const NEWSLETTER_PROFILES_KEY = "pocketflow.news.newsletterProfiles.v1";
const NEWSLETTER_ACTIVE_PROFILE_KEY = "pocketflow.news.activeNewsletterProfile.v1";
const NEWSLETTER_OUTBOX_KEY = "pocketflow.news.newsletterOutbox.v1";
const NEWSLETTER_MAX_RETRIES_PER_SLOT = 3;
const NEWSLETTER_SCHEDULE_DONE_KEY = "pocketflow.news.newsletterScheduleDone.v1";
const NEWSLETTER_SEND_ATTEMPTS_KEY = "pocketflow.news.newsletterSendAttempts.v1";
const NEWSLETTER_HEALTH_KEY = "pocketflow.news.newsletterHealth.v1";
const NEWSLETTER_AUTOMATION_LOCK_KEY = "pocketflow.news.newsletterAutomationLock.v1";
const NEWSLETTER_PROFILE_REPAIR_KEY = "pocketflow.news.newsletterProfileRepair.v1";
const NEWSLETTER_PROFILE_REPAIR_VERSION = "2026-07-06-single-fashion-public-night";
const KAPRICORN_PAUSE_REPAIR_KEY = "pocketflow.news.kapricornPauseRepair.v1";
const KAPRICORN_PAUSE_REPAIR_VERSION = "2026-07-16-kapricorn-parked-all-schedulers";
const NEWSLETTER_CONTACT_REPAIR_KEY = "pocketflow.news.newsletterContactRepair.v1";
const NEWSLETTER_CONTACT_REPAIR_VERSION = "2026-07-18-public-empty-audience";
const NEWSLETTER_AGENT_POOL_KEY = "pocketflow.news.newsletterAgentPool.v1";
const NEWSLETTER_AGENT_POOL_VERSION = "2026-07-10-campaign-agent-parking";
const NEWSLETTER_ARCHIVE_RESET_KEY = "pocketflow.news.newsletterArchiveReset.v2";
const NEWSLETTER_ARCHIVE_RESET_VERSION = "2026-06-27-fashion-source-reset";
const NEWSLETTER_CONTACT_LISTS_KEY = "pocketflow.news.newsletterContactLists.v1";
const NEWSLETTER_ACTIVE_CONTACT_LIST_KEY = "pocketflow.news.activeNewsletterContactList.v1";
const NEWSLETTER_WEBHOOK_QUEUE_KEY = "pocketflow.news.newsletterWebhookQueue.v1";
const NEWSLETTER_RECIPIENT_AUDIT_KEY = "pocketflow.news.newsletterRecipientAudit.v1";
const PUBLIC_RELEASE_MODE = true;
const LOCAL_CRM_CONTACTS_KEY = "pocketflow.localCrm.contacts.v2";
const LOCAL_CRM_LISTS_KEY = "pocketflow.localCrm.contactLists.v1";
const PROPERTY_DIGEST_PREFERENCES_KEY = "pocketflow.lakehouse.newsletterPreferences.v1";
const PUBLIC_TEMPLATE_NEWS_CONTACT: NewsletterContact = {
  name: "Example Subscriber",
  email: "",
  tags: ["public-template"],
};
const PUBLIC_TEMPLATE_LEGACY_EMAILS: string[] = [];

const DAILY_REFRESH_HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const NEWSLETTER_SEND_GRACE_MINUTES = 10;
const NEWSLETTER_AUTOMATION_LOCK_MS = 4 * 60 * 1000;
const TOP_BRIEF_ITEMS = 10;
const NEWSFLOW_MANUAL_MIN_STORIES = 10;
const MAX_FEED_ITEMS = 480;
const FEED_INITIAL_VISIBLE = 100;
const NEWS_ACTIVE_WINDOW_HOURS = 48;
const NEWS_ACTIVE_WINDOW_MS = NEWS_ACTIVE_WINDOW_HOURS * 60 * 60 * 1000;
const NEWSFLOW_RETRY_DELAY_MS = 30 * 60 * 1000;
const NEWSFLOW_ARCHIVE_SECTION = "newsflow";
const STALE_AFTER_MS = 8 * 60 * 60 * 1000;
const NEWS_SCOUT_BOT_COUNT = 5;
const NEWS_SCOUT_BATCH_SIZE = 1;
const NEWS_MANUAL_PULL_MAX_SOURCES = 8;
const NEWS_MANUAL_RESCUE_MAX_SOURCES = 3;
const NEWS_MANUAL_BATCH_SIZE = 3;
const NEWS_SCOUT_ROTATION_MS = 60 * 60 * 1000;
const NEWS_SOURCE_FAILURE_LIMIT = 2;
const NEWS_SOURCE_QUARANTINE_MS = 12 * 60 * 60 * 1000;
const NEWS_DISABLED_SOURCE_IDS = new Set(["lastampa", "la-stampa"]);
const NEWS_SCOUTER_JOB_IDS = ["news-scouter-ai", "news-scouter-fashion"];

const DEFAULT_NEWSLETTER_INTRO =
  "Dear Public AI lovers, here is today's selected briefing. The date and top stories are generated automatically from News Flow, then you can edit before sending.";

const DEFAULT_NEWSLETTER_SIGNATURE =
  "Public Team\nPocketFlow Press";

const DEFAULT_NEWSLETTER_FOOTPRINT =
  "example.com";

const DEFAULT_NEWSLETTER_FONT = "Arial, sans-serif";
const PUBLIC_TOPIC_FILTERS = ["ai", "ai-labs", "ai-research"];
const PUBLIC_CUSTOM_INTERESTS = [
  "artificial intelligence",
  "AI agents",
  "AI software",
  "builder intelligence",
  "automation",
  "machine learning",
  "language models",
  "robotics",
  "innovation",
  "startup innovation",
  "software innovation",
  "research labs",
];
const PUBLIC_ALLOWED_SOURCE_IDS = new Set([
  "ai-labs",
  "wired-ai",
  "tech-ai",
  "ai-innovation",
]);
const PUBLIC_BLOCKED_TOPICS = new Set<NewsTopic>([
  "italy",
  "politics",
  "local",
  "mobility",
  "geopolitics",
  "markets",
  "world",
  "fashion",
  "kapricorn",
  "beer",
  "alcohol",
  "parties",
]);
const PUBLIC_ALLOWED_TERMS = [
  "ai",
  "artificial intelligence",
  "intelligenza artificiale",
  "openai",
  "anthropic",
  "deepmind",
  "meta ai",
  "google ai",
  "gemini",
  "claude",
  "chatgpt",
  "llm",
  "language model",
  "foundation model",
  "machine learning",
  "deep learning",
  "neural network",
  "agent",
  "automation",
  "robot",
  "robotics",
  "software",
  "developer",
  "startup",
  "innovation",
  "research",
  "model release",
  "builder intelligence",
];
const PUBLIC_BLOCKED_TERMS = [
  "politica",
  "politics",
  "governo",
  "parlamento",
  "election",
  "elezioni",
  "partito",
  "parties",
  "nato",
  "tank",
  "guerra",
  "war",
  "cronaca",
  "torino",
  "milano",
  "fashion",
  "moda",
  "beer",
  "cocktail",
  "bar",
];
const PUBLIC_NEWSLETTER_THEME = {
  pageBg: "#f6f0df",
  shellBg: "#fffaf0",
  cardBg: "#ffffff",
  headerBg: "#0a1f1a",
  text: "#101713",
  muted: "#45534b",
  gold: "#d4af37",
  cyan: "#047b7d",
  green: "#0a1f1a",
  border: "#d8c892",
  softBorder: "#eadfbe",
  font: "Arial, Helvetica, sans-serif",
};
const SECOND_LIFE_LOGO_FALLBACK_SRC = "/brand/second-life-studio-logo.jpg";
const PUBLIC_NEWS_LIST_ID = "public_news";
const SECOND_LIFE_NEWS_LIST_ID = "second_life_news";
const KAPRI_NEWS_LIST_ID = "kapri_news";
const PROPERTY_DIGEST_NEWS_LIST_ID = "news-lago";
const PROPERTY_DIGEST_NEWSLETTER_PROFILE_ID = "newsletter_ricerca_casa_al_lago";
const ITALY_MOBILITY_NEWS_LIST_ID = "italy_mobility_strikes";
const ITALY_MOBILITY_NEWSLETTER_PROFILE_ID = "newsletter_italy_mobility_strikes_weekly";
const NEWSLETTER_PROFILE_JOB_IDS: Record<string, string> = {
  newsletter_public_ai_daily: "newsletter-public-midnight",
  newsletter_second_life_fashion_daily: "newsletter-secondlife-18",
  [PROPERTY_DIGEST_NEWSLETTER_PROFILE_ID]: "newsletter-lakehouse-20",
  newsletter_kapricorn_leaflet: "newsletter-kapricorn-thu-10",
  [ITALY_MOBILITY_NEWSLETTER_PROFILE_ID]: "newsletter-italy-mobility-mon-08",
};

const NEWSLETTER_FONT_OPTIONS = [
  { label: "System UI", value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Arial Black", value: "'Arial Black', Gadget, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', Helvetica, sans-serif" },
  { label: "Segoe UI", value: "'Segoe UI', Arial, sans-serif" },
  { label: "Roboto", value: "Roboto, Arial, sans-serif" },
  { label: "Open Sans", value: "'Open Sans', Arial, sans-serif" },
  { label: "Lato", value: "Lato, Arial, sans-serif" },
  { label: "Montserrat", value: "Montserrat, Arial, sans-serif" },
  { label: "Poppins", value: "Poppins, Arial, sans-serif" },
  { label: "Nunito", value: "Nunito, Arial, sans-serif" },
  { label: "Source Sans 3", value: "'Source Sans 3', 'Source Sans Pro', Arial, sans-serif" },
  { label: "Avenir", value: "Avenir, 'Avenir Next', Arial, sans-serif" },
  { label: "Futura", value: "Futura, 'Trebuchet MS', Arial, sans-serif" },
  { label: "Gill Sans", value: "'Gill Sans', 'Gill Sans MT', Calibri, sans-serif" },
  { label: "Century Gothic", value: "'Century Gothic', Arial, sans-serif" },
  { label: "Optima", value: "Optima, Candara, Arial, sans-serif" },
  { label: "Candara", value: "Candara, Calibri, Segoe, sans-serif" },
  { label: "Calibri", value: "Calibri, Candara, Segoe, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Times", value: "Times, 'Times New Roman', serif" },
  { label: "Palatino", value: "'Palatino Linotype', Palatino, 'Book Antiqua', serif" },
  { label: "Book Antiqua", value: "'Book Antiqua', Palatino, serif" },
  { label: "Garamond", value: "Garamond, Georgia, serif" },
  { label: "Baskerville", value: "Baskerville, Georgia, serif" },
  { label: "Cambria", value: "Cambria, Georgia, serif" },
  { label: "Didot", value: "Didot, 'Bodoni 72', Georgia, serif" },
  { label: "Bodoni 72", value: "'Bodoni 72', Didot, Georgia, serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
  { label: "Lucida Console", value: "'Lucida Console', Monaco, monospace" },
  { label: "Monaco", value: "Monaco, 'Lucida Console', monospace" },
  { label: "Menlo", value: "Menlo, Monaco, 'Courier New', monospace" },
  { label: "Consolas", value: "Consolas, Monaco, 'Courier New', monospace" },
  { label: "SF Mono", value: "'SF Mono', Menlo, Monaco, Consolas, monospace" },
  { label: "Roboto Mono", value: "'Roboto Mono', Consolas, monospace" },
  { label: "Impact", value: "Impact, Charcoal, sans-serif" },
  { label: "Comic Sans MS", value: "'Comic Sans MS', cursive, sans-serif" },
];

const defaultNewsletterProfile = (): NewsletterProfile => ({
  id: "newsletter_public_ai_daily",
  name: "Public AI",
  topicFilter: "ai",
  topicFilters: PUBLIC_TOPIC_FILTERS,
  customInterests: PUBLIC_CUSTOM_INTERESTS,
  cadence: "daily",
  title: "Public AI Daily Brief",
  intro: DEFAULT_NEWSLETTER_INTRO,
  sendTime: "00:00",
  sendTimes: ["00:00"],
  fromAccount: "newsletter@example.com",
  crmList: `list:${PUBLIC_NEWS_LIST_ID}`,
  enabled: true,
  topCount: 10,
  templateName: "PocketFlow Studio AI software house template",
  logoDataUrl: "",
  signature: "PocketFlow Studio\nPocketFlow Press",
  footprint: DEFAULT_NEWSLETTER_FOOTPRINT,
  headerBgColor: PUBLIC_NEWSLETTER_THEME.headerBg,
  headerTextColor: PUBLIC_NEWSLETTER_THEME.text,
  footerBgColor: PUBLIC_NEWSLETTER_THEME.headerBg,
  footerTextColor: PUBLIC_NEWSLETTER_THEME.gold,
  accentColor: PUBLIC_NEWSLETTER_THEME.gold,
  bodyBgColor: PUBLIC_NEWSLETTER_THEME.pageBg,
  fontFamily: PUBLIC_NEWSLETTER_THEME.font,
});

const defaultFashionNewsletterProfile = (): NewsletterProfile => ({
  ...defaultNewsletterProfile(),
  id: "newsletter_second_life_fashion_daily",
  name: "Second Life Fashion",
  topicFilter: "fashion-industry",
  topicFilters: ["fashion-industry"],
  customInterests: [
    "fashion industry",
    "luxury",
    "textile",
    "fabrics",
    "collections",
    "designers",
    "supply chain",
    "made in italy",
  ],
  title: "Second Life Studio Fashion Brief",
  intro:
    "Dear Second Life Studio readers, here is today's fashion and textile intelligence brief. Selected from verified fashion, luxury, textile and industry sources, then reviewed by News Flow before sending.",
  sendTime: "18:00",
  sendTimes: ["18:00"],
  crmList: `list:${SECOND_LIFE_NEWS_LIST_ID}`,
  signature: "2ND Life Studio",
  footprint: "example.com",
  templateName: "Second Life Studio red editorial template",
  headerBgColor: "#ffffff",
  headerTextColor: "#1b1111",
  footerBgColor: "#d9251d",
  footerTextColor: "#ffffff",
  accentColor: "#d9251d",
  bodyBgColor: "#ffffff",
  fontFamily: "Arial, Helvetica, sans-serif",
});

const defaultKapricornNewsletterProfile = (): NewsletterProfile => ({
  ...defaultNewsletterProfile(),
  id: "newsletter_kapricorn_leaflet",
  name: "Kapricorn Leaflet",
  topicFilter: "kapricorn",
  topicFilters: ["kapricorn", "beer-wine", "parties", "alcohol"],
  customInterests: [
    "Kapricorn bar",
    "beer",
    "birra",
    "wine",
    "cocktails",
    "nightlife",
    "aperitivo",
    "Milan events",
    "Torino events",
    "festivals",
    "hospitality",
    "party culture",
    "alcohol",
    "tobacco",
    "bar culture",
  ],
  title: "The Bar Weekly",
  intro:
    "Good drinks, good music, good times. A weekly bar-style leaflet with table notes, drink culture, small offers and nightlife prompts.",
  sendTime: "10:00",
  sendTimes: ["10:00"],
  sendWeekdays: [4],
  sendSchedule: [{ weekday: 4, time: "10:00" }],
  fromAccount: "newsletter@example.com",
  crmList: `list:${KAPRI_NEWS_LIST_ID}`,
  enabled: false,
  topCount: 3,
  templateName: "Kapricorn bar weekly leaflet template",
  logoDataUrl: "",
  signature: "Kapricorn",
  footprint: "Kapricorn leaflet: table rules, coupons, opening notes and bar culture.",
  headerBgColor: "#11100a",
  headerTextColor: "#fff3bf",
  footerBgColor: "#1a1208",
  footerTextColor: "#f8d35c",
  accentColor: "#f7c331",
  bodyBgColor: "#fff8df",
  fontFamily: "Impact, 'Arial Black', Arial, sans-serif",
});

const defaultPropertyDigestNewsletterProfile = (): NewsletterProfile => ({
  ...defaultNewsletterProfile(),
  id: PROPERTY_DIGEST_NEWSLETTER_PROFILE_ID,
  name: "ricerca casa al lago",
  topicFilter: "italy",
  topicFilters: ["italy"],
  customInterests: [
    "case Lago Maggiore",
    "appartamenti Lago Maggiore",
    "Meina",
    "Stresa",
    "Arona",
    "Dormelletto",
    "Castelletto Ticino",
    "2 camere",
    "90-120 mq",
    "terrazzo",
    "giardino",
    "prezzo da 90k",
  ],
  cadence: "daily",
  title: "Ricerca casa al lago",
  intro:
    "Ciao, ecco le 10 migliori case trovate oggi per la ricerca Lago Maggiore: 2+ camere, 90-120 mq, terrazzo o giardino, garage non necessario e prezzo da 90k in su.",
  sendTime: "20:00",
  sendTimes: ["20:00"],
  sendWeekdays: [],
  sendSchedule: [],
  fromAccount: "newsletter@example.com",
  crmList: `list:${PROPERTY_DIGEST_NEWS_LIST_ID}`,
  enabled: true,
  topCount: 10,
  templateName: "Property top 10 digest",
  logoDataUrl: "",
  signature: "Property digest desk",
  footprint: "Daily Lago Maggiore property shortlist generated from the saved property research feed.",
  headerBgColor: "#0b1115",
  headerTextColor: "#f8fafc",
  footerBgColor: "#0b1115",
  footerTextColor: "#9bdcff",
  accentColor: "#38bdf8",
  bodyBgColor: "#f8fafc",
  fontFamily: "Arial, Helvetica, sans-serif",
});

const defaultItalyMobilityNewsletterProfile = (): NewsletterProfile => ({
  ...defaultNewsletterProfile(),
  id: ITALY_MOBILITY_NEWSLETTER_PROFILE_ID,
  name: "Italy Mobility & Strikes",
  topicFilter: "italy-mobility",
  topicFilters: ["italy-mobility"],
  customInterests: [
    "scioperi Italia",
    "scioperi sindacali",
    "sciopero treni",
    "sciopero aerei",
    "sciopero mezzi",
    "trasporto pubblico locale",
    "ritardi treni",
    "ritardi voli",
    "Milano",
    "Torino",
    "Bologna",
    "Roma",
  ],
  cadence: "weekdays",
  title: "Italy Mobility & Strikes Weekly",
  intro:
    "A weekly Italy mobility brief covering official strike notices, rail infomobility, airport flight-board signals and local transport news for Milano, Torino, Bologna and Roma. Official sources are identified in each item; radar data is included only when a recent local radar snapshot exists.",
  sendTime: "08:00",
  sendTimes: ["08:00"],
  sendWeekdays: [1],
  sendSchedule: [{ weekday: 1, time: "08:00" }],
  crmList: `list:${ITALY_MOBILITY_NEWS_LIST_ID}`,
  enabled: true,
  topCount: 12,
  templateName: "Italy mobility and strikes weekly brief",
  signature: "PocketFlow Mobility Desk",
  footprint: "Official MIT, RFI, Trenitalia and airport-board sources, plus local radar context when available.",
  headerBgColor: "#102a43",
  headerTextColor: "#f7fbff",
  footerBgColor: "#102a43",
  footerTextColor: "#9bdcff",
  accentColor: "#0ea5e9",
  bodyBgColor: "#f3f7fb",
  fontFamily: "Arial, Helvetica, sans-serif",
});

const defaultNewsletterProfiles = (): NewsletterProfile[] => [
  defaultNewsletterProfile(),
  defaultFashionNewsletterProfile(),
  defaultKapricornNewsletterProfile(),
  defaultPropertyDigestNewsletterProfile(),
  defaultItalyMobilityNewsletterProfile(),
];

const createNewsletterListId = (name: string) => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 36) || "audience";
  return `${slug}_${Date.now()}`;
};

const createNewsletterWebhookToken = () => {
  const random = typeof crypto !== "undefined" && "getRandomValues" in crypto
    ? Array.from(crypto.getRandomValues(new Uint8Array(12))).map((byte) => byte.toString(16).padStart(2, "0")).join("")
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `nwh_${random}`;
};

const googleNewsRss = (query: string, language = "it", region = "IT") =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${language}&gl=${region}&ceid=${region}:${language}`;

const ITALY_MOBILITY_SOURCE_IDS = [
  "italy-strikes-mit",
  "italy-rfi-infomobility",
  "italy-trenitalia-infomobility",
  "milano-airport-mobility",
  "torino-airport-mobility",
  "bologna-airport-mobility",
  "roma-airport-mobility",
  "milano-local-transport",
  "torino-local-transport",
  "bologna-local-transport",
  "roma-local-transport",
  "italy-radar-context",
] as const;

const RFI_INFOMOBILITY_UPDATES = "https://www.rfi.it/content/rfi/it/news-e-media/infomobilita.rss.updates.xml";
const RFI_INFOMOBILITY_NOTICES = "https://www.rfi.it/content/rfi/it/news-e-media/infomobilita.rss.notices.xml";
const RFI_INFOMOBILITY_LOMBARDIA = "https://www.rfi.it/content/rfi/it/news-e-media/infomobilita.rss.updates.lombardia.xml";
const RFI_INFOMOBILITY_PIEMONTE = "https://www.rfi.it/content/rfi/it/news-e-media/infomobilita.rss.updates.piemonte.xml";
const RFI_INFOMOBILITY_EMILIA_ROMAGNA = "https://www.rfi.it/content/rfi/it/news-e-media/infomobilita.rss.updates.emilia-romagna.xml";
const RFI_INFOMOBILITY_LAZIO = "https://www.rfi.it/content/rfi/it/news-e-media/infomobilita.rss.updates.lazio.xml";
const MIT_STRIKES_RSS = "https://scioperi.mit.gov.it/mit2/public/scioperi/rss";

const NEWS_SOURCES: NewsSource[] = [
  {
    id: "italy-strikes-mit",
    name: "MIT Italy Strike Calendar",
    topic: "mobility",
    tone: "official transport strikes",
    priority: 10,
    feeds: [MIT_STRIKES_RSS, googleNewsRss("scioperi trasporti Italia MIT sciopero treni aerei mezzi")],
    officialPages: ["https://scioperi.mit.gov.it/mit2/public/scioperi"],
    kind: "official-page",
  },
  {
    id: "italy-rfi-infomobility",
    name: "RFI Infomobility",
    topic: "mobility",
    tone: "official railway circulation",
    priority: 10,
    feeds: [
      RFI_INFOMOBILITY_UPDATES,
      RFI_INFOMOBILITY_NOTICES,
      RFI_INFOMOBILITY_LOMBARDIA,
      RFI_INFOMOBILITY_PIEMONTE,
      RFI_INFOMOBILITY_EMILIA_ROMAGNA,
      RFI_INFOMOBILITY_LAZIO,
    ],
    officialPages: ["https://www.rfi.it/it/news-e-media/infomobilita.html"],
    kind: "official-page",
  },
  {
    id: "italy-trenitalia-infomobility",
    name: "Trenitalia Infomobility",
    topic: "mobility",
    tone: "official train delay notices",
    priority: 10,
    feeds: [googleNewsRss("site:trenitalia.com infomobilità ritardi treni sciopero")],
    officialPages: ["https://www.trenitalia.com/it/informazioni/Infomobilita/notizie-infomobilita.app.html?cid=app1"],
    kind: "official-page",
  },
  {
    id: "milano-airport-mobility",
    name: "Milano Airports / SEA",
    topic: "mobility",
    tone: "official Milan airport operations",
    priority: 10,
    feeds: [googleNewsRss("Milano Malpensa Linate voli ritardi scioperi SEA aeroporti")],
    officialPages: ["https://milanairports.com/it"],
    kind: "official-page",
  },
  {
    id: "torino-airport-mobility",
    name: "Torino Airport / SAGAT",
    topic: "mobility",
    tone: "official Torino airport flight board",
    priority: 10,
    feeds: [googleNewsRss("Torino Airport voli ritardi scioperi SAGAT")],
    officialPages: ["https://www.aeroportoditorino.it/it/tofly/voli/partenze-arrivi?orario=oggi&set=arrivi"],
    kind: "official-page",
  },
  {
    id: "bologna-airport-mobility",
    name: "Bologna Airport / BLQ",
    topic: "mobility",
    tone: "official Bologna airport flight board",
    priority: 10,
    feeds: [googleNewsRss("Aeroporto Bologna BLQ voli ritardi scioperi")],
    officialPages: ["https://www.bologna-airport.it/"],
    kind: "official-page",
  },
  {
    id: "roma-airport-mobility",
    name: "Aeroporti di Roma / ADR",
    topic: "mobility",
    tone: "official Rome airport flight board",
    priority: 10,
    feeds: [googleNewsRss("Fiumicino Ciampino voli ritardi scioperi ADR Aeroporti di Roma")],
    officialPages: ["https://www.adr.it/it/pax-fco-voli-in-tempo-reale"],
    kind: "official-page",
  },
  {
    id: "milano-local-transport",
    name: "Milano Local Transport Watch",
    topic: "mobility",
    tone: "Milan ATM and public transport",
    priority: 9,
    feeds: [googleNewsRss("Milano ATM metro tram bus scioperi ritardi viabilità")],
    officialPages: ["https://www.atm.it/mobile/InfoTraffico/Pagine/default.aspx"],
    kind: "official-page",
  },
  {
    id: "torino-local-transport",
    name: "Torino Local Transport Watch",
    topic: "mobility",
    tone: "Torino GTT and public transport",
    priority: 9,
    feeds: [googleNewsRss("Torino GTT metro tram bus scioperi ritardi viabilità")],
    officialPages: ["https://www.gtt.to.it/cms/en/app"],
    kind: "official-page",
  },
  {
    id: "bologna-local-transport",
    name: "Bologna Local Transport Watch",
    topic: "mobility",
    tone: "Bologna TPER and public transport",
    priority: 9,
    feeds: [googleNewsRss("Bologna TPER bus treni scioperi ritardi viabilità")],
    officialPages: ["https://www.tper.it/"],
    kind: "official-page",
  },
  {
    id: "roma-local-transport",
    name: "Roma Local Transport Watch",
    topic: "mobility",
    tone: "Roma ATAC and public transport",
    priority: 9,
    feeds: [googleNewsRss("Roma ATAC metro bus treni scioperi ritardi viabilità")],
    officialPages: ["https://www.atac.roma.it/tempo-reale"],
    kind: "official-page",
  },
  {
    id: "italy-radar-context",
    name: "PocketFlow Radar Context",
    topic: "mobility",
    tone: "local ADS-B radar context",
    priority: 9,
    feeds: [],
    kind: "radar-snapshot",
  },
  {
    id: "corriere",
    name: "Corriere della Sera",
    topic: "italy",
    tone: "italy",
    priority: 7,
    feeds: [
      googleNewsRss("politica economia Italia site:corriere.it"),
      "https://xml2.corriereobjects.it/rss/homepage.xml",
    ],
  },
  {
    id: "torino",
    name: "Torino",
    topic: "local",
    tone: "local",
    priority: 10,
    feeds: [
      googleNewsRss("Torino cronaca trasporti sicurezza economia"),
      googleNewsRss("cronaca Torino site:torinoggi.it OR site:torinotoday.it OR site:ansa.it"),
      "https://www.torinoggi.it/links/rss/argomenti/cronaca-11/rss.xml",
    ],
  },
  {
    id: "milan",
    name: "Milano",
    topic: "local",
    tone: "local",
    priority: 9,
    feeds: [
      googleNewsRss("Milano cronaca politica economia trasporti sicurezza"),
      googleNewsRss("Milano site:milanotoday.it OR site:corriere.it OR site:ilgiorno.it"),
    ],
  },
  {
    id: "italy-politics",
    name: "Italian Politics",
    topic: "politics",
    tone: "politics",
    priority: 8,
    feeds: [
      googleNewsRss("Italia politica governo parlamento economia energia tasse"),
      googleNewsRss("site:ansa.it politica economia Italia"),
    ],
  },
  {
    id: "italian-parties",
    name: "Italian Parties",
    topic: "politics",
    tone: "italian politics parties",
    priority: 10,
    feeds: [
      googleNewsRss("+Europa Radicali Italiani politica diritti parlamento governo Italia"),
      googleNewsRss("site:piueuropa.eu +Europa politica comunicati diritti Italia"),
      googleNewsRss("site:radicali.it Radicali Italiani politica diritti democrazia"),
    ],
  },
  {
    id: "italian-daily-politics",
    name: "Daily Italian Politics",
    topic: "politics",
    tone: "daily italian news",
    priority: 10,
    feeds: [
      googleNewsRss("politica italiana oggi governo parlamento partiti elezioni diritti"),
      googleNewsRss("site:corriere.it politica Italia governo parlamento"),
      googleNewsRss("site:repubblica.it politica Italia governo parlamento"),
      googleNewsRss("site:ilfattoquotidiano.it politica Italia governo parlamento"),
    ],
  },
  {
    id: "pulp-breaking-politics",
    name: "Pulp / Breaking Italy",
    topic: "politics",
    tone: "explainers daily politics",
    priority: 9,
    feeds: [
      googleNewsRss("Pulp Podcast politica Italia attualità"),
      googleNewsRss("Breaking Italy politica Italia attualità"),
      googleNewsRss("site:youtube.com Breaking Italy politica Italia"),
    ],
  },
  {
    id: "torino-politics",
    name: "Torino Politics",
    topic: "politics",
    tone: "local politics",
    priority: 9,
    feeds: [
      googleNewsRss("cronaca Torino politica comune regione Piemonte site:torinoggi.it OR site:torinotoday.it OR site:ansa.it"),
      googleNewsRss("Torino politica consiglio comunale regione Piemonte"),
    ],
  },
  {
    id: "ai-labs",
    name: "AI Labs",
    topic: "ai",
    tone: "ai",
    priority: 10,
    feeds: [
      "https://openai.com/news/rss.xml",
      googleNewsRss("OpenAI Anthropic Google DeepMind Meta AI model research", "en", "US"),
      googleNewsRss("ChatGPT Claude Gemini AI agents OpenAI Anthropic", "en", "US"),
    ],
  },
  {
    id: "wired-ai",
    name: "Wired AI",
    topic: "ai",
    tone: "ai",
    priority: 9,
    feeds: [
      "https://www.wired.com/feed/tag/ai/latest/rss",
      googleNewsRss("site:wired.com artificial intelligence AI OpenAI Anthropic", "en", "US"),
    ],
  },
  {
    id: "tech-ai",
    name: "AI Tech Press",
    topic: "ai",
    tone: "ai",
    priority: 9,
    feeds: [
      "https://techcrunch.com/category/artificial-intelligence/feed/",
      googleNewsRss("AI startup model release robotics automation research breakthrough", "en", "US"),
    ],
  },
  {
    id: "ai-innovation",
    name: "AI Innovation",
    topic: "ai",
    tone: "ai innovation software builders",
    priority: 10,
    feeds: [
      googleNewsRss("AI innovation software agents robotics automation startups research breakthrough", "en", "US"),
      googleNewsRss("artificial intelligence product launch developer tools AI agents innovation", "en", "US"),
      googleNewsRss("site:technologyreview.com artificial intelligence innovation software", "en", "US"),
    ],
  },
  {
    id: "bof-fashion",
    name: "Business of Fashion",
    topic: "fashion",
    tone: "fashion business",
    priority: 10,
    feeds: ["https://www.businessoffashion.com/feed/"],
  },
  {
    id: "wwd-fashion",
    name: "WWD",
    topic: "fashion",
    tone: "designers collections retail",
    priority: 10,
    feeds: ["https://wwd.com/feed/", "https://wwd.com/custom-feed/fashion/"],
  },
  {
    id: "vogue-business-fashion",
    name: "Vogue Business",
    topic: "fashion",
    tone: "luxury fashion innovation",
    priority: 9,
    feeds: [googleNewsRss("site:voguebusiness.com fashion business innovation luxury designers collections", "en", "US")],
  },
  {
    id: "vogue-fashion",
    name: "Vogue",
    topic: "fashion",
    tone: "runway designers collections",
    priority: 9,
    feeds: [
      googleNewsRss("site:vogue.com fashion designers collections runway couture", "en", "US"),
      googleNewsRss("site:vogue.it moda designer collezioni sfilate lusso", "it", "IT"),
    ],
  },
  {
    id: "elle-fashion",
    name: "Elle Fashion",
    topic: "fashion",
    tone: "fashion designers collections",
    priority: 8,
    feeds: [
      googleNewsRss("site:elle.com fashion designers collections runway couture style", "en", "US"),
      googleNewsRss("site:elle.com/it moda designer collezioni sfilate couture", "it", "IT"),
    ],
  },
  {
    id: "harpers-fashion",
    name: "Harper's Bazaar",
    topic: "fashion",
    tone: "luxury fashion runway",
    priority: 8,
    feeds: [
      googleNewsRss("site:harpersbazaar.com fashion runway designers couture collections", "en", "US"),
      googleNewsRss("site:harpersbazaar.com/it moda lusso designer collezioni", "it", "IT"),
    ],
  },
  {
    id: "fashionista",
    name: "Fashionista",
    topic: "fashion",
    tone: "fashion releases designers",
    priority: 8,
    feeds: [
      "https://fashionista.com/.rss/full/",
      googleNewsRss("site:fashionista.com fashion designers collections releases", "en", "US"),
    ],
  },
  {
    id: "lofficiel-fashion",
    name: "L'Officiel",
    topic: "fashion",
    tone: "couture luxury designers",
    priority: 8,
    feeds: [googleNewsRss("site:lofficielusa.com fashion couture designers collections luxury", "en", "US")],
  },
  {
    id: "fashionnetwork",
    name: "FashionNetwork",
    topic: "fashion",
    tone: "fashion business trade",
    priority: 8,
    feeds: [
      googleNewsRss("site:fashionnetwork.com fashion business luxury retail designers", "en", "US"),
      googleNewsRss("site:it.fashionnetwork.com moda lusso retail designer aziende", "it", "IT"),
    ],
  },
  {
    id: "streetwear-fashion",
    name: "Streetwear & Drops",
    topic: "fashion",
    tone: "streetwear releases collaborations",
    priority: 8,
    feeds: [
      googleNewsRss("site:hypebeast.com fashion streetwear release collaboration luxury", "en", "US"),
      googleNewsRss("site:highsnobiety.com fashion streetwear designer release collaboration", "en", "US"),
    ],
  },
  {
    id: "italian-fashion-trade",
    name: "Italian Fashion Trade",
    topic: "fashion",
    tone: "italian fashion business",
    priority: 9,
    feeds: [
      googleNewsRss("site:pambianconews.com moda lusso brand collezioni fashion week", "it", "IT"),
      googleNewsRss("site:mffashion.com moda lusso brand collezioni designer", "it", "IT"),
      googleNewsRss("site:fashionmagazine.it moda lusso brand collezioni retail", "it", "IT"),
    ],
  },
  {
    id: "fashion-dive",
    name: "Fashion Dive",
    topic: "fashion",
    tone: "fashion retail business",
    priority: 9,
    feeds: ["https://www.fashiondive.com/feeds/news/"],
  },
  {
    id: "fashionunited",
    name: "FashionUnited",
    topic: "fashion",
    tone: "global fashion industry",
    priority: 9,
    feeds: [googleNewsRss("site:fashionunited.com fashion industry designers collections apparel textile", "en", "US")],
  },
  {
    id: "drapers-fashion",
    name: "Drapers",
    topic: "fashion",
    tone: "fashion retail trade",
    priority: 8,
    feeds: ["https://www.drapersonline.com/feed", googleNewsRss("site:drapersonline.com fashion retail apparel designers collections", "en", "GB")],
  },
  {
    id: "sourcing-journal",
    name: "Sourcing Journal",
    topic: "fashion",
    tone: "sourcing textiles supply chain",
    priority: 8,
    feeds: [googleNewsRss("site:sourcingjournal.com fashion sourcing textiles fabric apparel supply chain", "en", "US")],
  },
  {
    id: "fibre2fashion",
    name: "Fibre2Fashion",
    topic: "fashion",
    tone: "textiles fabrics apparel",
    priority: 8,
    feeds: [googleNewsRss("site:fibre2fashion.com textiles fabric apparel garment fashion innovation", "en", "US")],
  },
  {
    id: "textile-world",
    name: "Textile World",
    topic: "fashion",
    tone: "textile manufacturing innovation",
    priority: 8,
    feeds: ["https://www.textileworld.com/feed/"],
  },
  {
    id: "just-style",
    name: "Just Style",
    topic: "fashion",
    tone: "apparel industry",
    priority: 8,
    feeds: ["https://www.just-style.com/feed/"],
  },
  {
    id: "theindustry-fashion",
    name: "TheIndustry.fashion",
    topic: "fashion",
    tone: "fashion industry retail",
    priority: 8,
    feeds: ["https://www.theindustry.fashion/feed/"],
  },
  {
    id: "fashion-legal-business",
    name: "Fashion Business Watch",
    topic: "fashion",
    tone: "fashion legal business supply chain",
    priority: 9,
    feeds: [
      googleNewsRss("moda lusso brand Italia caporalato indagati inchiesta Paul Shark Armani Dior Prada Gucci Moncler", "it", "IT"),
      googleNewsRss("fashion luxury brand legal investigation supply chain labor Italy Paul Shark Armani Dior Prada Gucci Moncler", "en", "US"),
    ],
  },
  {
    id: "kapricorn-bar-culture",
    name: "Kapricorn Bar Culture",
    topic: "kapricorn",
    tone: "bar culture",
    priority: 9,
    feeds: [
      googleNewsRss("Kapricorn bar beer nightlife Milano Torino festival Italia"),
      googleNewsRss("pub birra cocktail aperitivo eventi Torino Milano"),
      googleNewsRss("bar industry hospitality trends beer cocktails Europe", "en", "US"),
    ],
  },
  {
    id: "beer-wine-industry",
    name: "Beer Wine Spirits",
    topic: "beer",
    tone: "beer wine spirits",
    priority: 8,
    feeds: [
      googleNewsRss("birra artigianale vino cocktail news Italia"),
      googleNewsRss("beer wine spirits industry Europe", "en", "US"),
      "https://www.thedrinksbusiness.com/feed/",
      "https://vinepair.com/feed/",
    ],
  },
  {
    id: "parties-festivals-italy",
    name: "Parties Festivals Italy",
    topic: "parties",
    tone: "events nightlife",
    priority: 8,
    feeds: [
      googleNewsRss("festival musica eventi nightlife Milano Torino Italia"),
      googleNewsRss("eventi weekend Milano Torino aperitivo festa"),
    ],
  },
  {
    id: "alcohol-hospitality",
    name: "Alcohol Hospitality",
    topic: "alcohol",
    tone: "hospitality",
    priority: 7,
    feeds: [
      googleNewsRss("alcol tabacco horeca bar ristorazione Italia"),
      googleNewsRss("cocktail bar hospitality beverage trends", "en", "US"),
    ],
  },
  {
    id: "geopolitics",
    name: "Geopolitics",
    topic: "geopolitics",
    tone: "risk",
    priority: 9,
    feeds: [
      googleNewsRss("geopolitics war Ukraine Russia Middle East China Taiwan trade energy", "en", "US"),
      googleNewsRss("guerra Ucraina Russia Medio Oriente Cina Taiwan energia commercio"),
    ],
  },
  {
    id: "trade-markets",
    name: "Trade & Markets",
    topic: "markets",
    tone: "markets",
    priority: 8,
    feeds: [
      googleNewsRss("tariffs trade markets oil gas semiconductors shipping supply chain", "en", "US"),
      googleNewsRss("mercati borse petrolio gas commercio dazi supply chain"),
    ],
  },
  {
    id: "wsj",
    name: "Wall Street Journal",
    topic: "markets",
    tone: "markets",
    priority: 7,
    feeds: [
      googleNewsRss("site:wsj.com markets geopolitics trade AI", "en", "US"),
      "https://feeds.a.dj.com/rss/RSSWorldNews.xml",
    ],
  },
  {
    id: "times",
    name: "Times",
    topic: "world",
    tone: "world",
    priority: 6,
    feeds: [
      googleNewsRss("site:nytimes.com geopolitics AI markets", "en", "US"),
      "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
    ],
  },
  {
    id: "cnn",
    name: "CNN",
    topic: "world",
    tone: "world",
    priority: 5,
    feeds: [
      googleNewsRss("site:cnn.com world war markets AI", "en", "US"),
      "https://rss.cnn.com/rss/edition.rss",
    ],
  },
];

const NEWS_FRESH_RESCUE_SOURCES: NewsSource[] = [
  {
    id: "fresh-italy-live",
    name: "Fresh Italy Wire",
    topic: "italy",
    tone: "fresh italy",
    priority: 10,
    feeds: [
      googleNewsRss("Italia oggi ultime notizie politica economia cronaca"),
      googleNewsRss("Torino oggi cronaca politica economia"),
      googleNewsRss("site:ansa.it Torino oggi cronaca politica economia"),
    ],
  },
  {
    id: "fresh-ai-live",
    name: "Fresh AI Wire",
    topic: "ai",
    tone: "fresh ai",
    priority: 10,
    feeds: [
      googleNewsRss("OpenAI Anthropic Google DeepMind AI oggi news", "en", "US"),
      googleNewsRss("AI research startup funding model release today", "en", "US"),
    ],
  },
  {
    id: "fresh-fashion-live",
    name: "Fresh Fashion Wire",
    topic: "fashion",
    tone: "fresh fashion",
    priority: 10,
    feeds: [
      googleNewsRss("fashion industry Vogue Business WWD BoF today", "en", "US"),
      googleNewsRss("moda Italia fashion luxury textile oggi news", "it", "IT"),
    ],
  },
];

const NEWS_MANUAL_RESCUE_SOURCES: NewsSource[] = [
  ...NEWS_FRESH_RESCUE_SOURCES,
  {
    id: "manual-rescue-ai",
    name: "Manual Rescue AI",
    topic: "ai",
    tone: "manual rescue ai",
    priority: 11,
    feeds: [
      googleNewsRss("OpenAI OR Anthropic OR Google DeepMind OR AI research OR machine learning when:2d", "en", "US"),
      googleNewsRss("intelligenza artificiale OpenAI Anthropic startup AI oggi", "it", "IT"),
    ],
  },
  {
    id: "manual-rescue-fashion",
    name: "Manual Rescue Fashion",
    topic: "fashion",
    tone: "manual rescue fashion",
    priority: 11,
    feeds: [
      googleNewsRss("Vogue Business OR WWD OR Business of Fashion OR fashion week OR luxury fashion when:2d", "en", "US"),
      googleNewsRss("moda lusso tessile stilisti collezioni fashion week oggi", "it", "IT"),
    ],
  },
  {
    id: "manual-rescue-politics",
    name: "Manual Rescue Politics",
    topic: "politics",
    tone: "manual rescue politics",
    priority: 10,
    feeds: [
      googleNewsRss("politica italiana governo parlamento Europa Radicali oggi", "it", "IT"),
      googleNewsRss("geopolitics Europe USA trade NATO war today", "en", "US"),
    ],
  },
  {
    id: "manual-rescue-torino",
    name: "Manual Rescue Torino",
    topic: "local",
    tone: "manual rescue local",
    priority: 10,
    feeds: [
      googleNewsRss("Torino cronaca politica economia oggi", "it", "IT"),
      googleNewsRss("Piemonte Torino ultime notizie oggi", "it", "IT"),
    ],
  },
  {
    id: "manual-rescue-markets",
    name: "Manual Rescue Markets",
    topic: "markets",
    tone: "manual rescue markets",
    priority: 9,
    feeds: [
      googleNewsRss("mercati borsa economia bitcoin ethereum oggi", "it", "IT"),
      googleNewsRss("markets stocks bitcoin ethereum economy today", "en", "US"),
    ],
  },
];

const TOPIC_TARGETS: Partial<Record<NewsTopic, number>> = {
  ai: 3,
  fashion: 2,
  politics: 3,
  local: 2,
  mobility: 3,
  geopolitics: 2,
  markets: 1,
  italy: 1,
};

const PERSONAL_KEYWORDS = [
  "torino",
  "turin",
  "piemonte",
  "milano",
  "milan",
  "openai",
  "anthropic",
  "deepmind",
  "artificial intelligence",
  "intelligenza artificiale",
  "ai",
  "llm",
  "model",
  "robot",
  "agent",
  "fashion",
  "moda",
  "textile",
  "fabrics",
  "apparel",
  "clothing",
  "designer",
  "collection",
  "runway",
  "luxury",
  "sourcing",
  "garment",
  "materials",
  "politics",
  "politica",
  "parliament",
  "parlamento",
  "government",
  "governo",
  "partiti",
  "diritti",
  "+europa",
  "più europa",
  "radicali italiani",
  "breaking italy",
  "pulp podcast",
  "war",
  "guerra",
  "ukraine",
  "russia",
  "middle east",
  "china",
  "taiwan",
  "trade",
  "tariff",
  "dazi",
  "markets",
  "borse",
  "oil",
  "gas",
  "energia",
  "sciopero",
  "scioperi",
  "ritardi",
  "treni",
  "ferroviario",
  "aereo",
  "aeroporto",
  "trasporto pubblico",
  "atm",
  "gtt",
  "tper",
  "atac",
];

const NEWS_RESEARCH_FILTERS = [
  { id: "all", label: "All", terms: [] },
  { id: "torino", label: "Torino", terms: ["torino", "turin", "piemonte", "piedmont", "torinoggi", "torinotoday"] },
  { id: "milano", label: "Milano", terms: ["milano", "milan", "lombardia", "milanotoday", "ilgiorno"] },
  {
    id: "italy-mobility",
    label: "Italy mobility & strikes",
    terms: [
      "sciopero",
      "scioperi",
      "sindacale",
      "sciopero treni",
      "sciopero aereo",
      "sciopero mezzi",
      "trasporto pubblico",
      "ferroviario",
      "ritardi",
      "cancellato",
      "cancellazione",
      "infomobilità",
      "milano",
      "torino",
      "bologna",
      "roma",
      "malpensa",
      "linate",
      "fiumicino",
      "ciampino",
    ],
  },
  {
    id: "ai",
    label: "AI",
    terms: [
      "ai labs",
      "openai",
      "anthropic",
      "deepmind",
      "meta ai",
      "google ai",
      "gemini",
      "claude",
      "chatgpt",
      "artificial intelligence",
      "intelligenza artificiale",
      "ai",
      "llm",
      "model",
      "robot",
      "agent",
      "research",
      "breakthrough",
    ],
  },
  { id: "ai-labs", label: "AI labs", terms: ["ai labs", "openai", "anthropic", "deepmind", "meta ai", "google ai", "gemini", "claude", "chatgpt"] },
  {
    id: "ai-research",
    label: "AI research",
    terms: [
      "artificial intelligence",
      "intelligenza artificiale",
      "machine learning",
      "deep learning",
      "neural network",
      "generative ai",
      "language model",
      "large language model",
      "foundation model",
      "ai model",
      "llm",
      "ai agent",
      "robotics",
      "openai",
      "anthropic",
      "deepmind",
      "meta ai",
      "google ai",
    ],
  },
  {
    id: "fashion-industry",
    label: "Fashion",
    terms: [
      "fashion",
      "moda",
      "textile",
      "textiles",
      "fabric",
      "fabrics",
      "apparel",
      "clothing",
      "garment",
      "designer",
      "designers",
      "collection",
      "collections",
      "runway",
      "fashion week",
      "luxury",
      "couture",
      "menswear",
      "womenswear",
      "retail",
      "sourcing",
      "supply chain",
      "materials",
      "innovation",
      "wwd",
      "business of fashion",
      "vogue business",
      "fashionunited",
      "fibre2fashion",
      "textile world",
      "vogue",
      "vogue italia",
      "fashion dive",
      "sourcing journal",
      "drapers",
      "just style",
      "paul shark",
      "caporalato",
      "indagati",
      "indagine",
      "inchiesta",
      "made in italy",
      "luxury brand",
      "prada",
      "gucci",
      "armani",
      "valentino",
      "versace",
      "zegna",
      "moncler",
      "kering",
      "lvmh",
      "dior",
      "chanel",
      "hermes",
      "burberry",
      "zara",
      "inditex",
      "nike",
      "adidas",
      "factory",
      "workers",
      "labor",
      "labour",
      "sustainability",
    ],
  },
  {
    id: "kapricorn",
    label: "Kapricorn",
    terms: ["kapricorn", "beer", "birra", "pub", "bar", "cocktail", "aperitivo", "nightlife", "tavolo", "coupon", "cavallo"],
  },
  {
    id: "beer-wine",
    label: "Beer/Wine",
    terms: ["beer", "birra", "craft beer", "wine", "vino", "spirits", "cocktail", "beverage"],
  },
  {
    id: "parties",
    label: "Parties",
    terms: ["party", "parties", "festival", "festivals", "events", "eventi", "nightlife", "club", "musica", "milano", "torino"],
  },
  {
    id: "alcohol",
    label: "Alcohol",
    terms: ["alcohol", "alcol", "tabacco", "tobacco", "horeca", "hospitality", "bar", "pub"],
  },
  {
    id: "politics",
    label: "Politics",
    terms: [
      "politics",
      "politica",
      "governo",
      "government",
      "parlamento",
      "parliament",
      "partito",
      "partiti",
      "elezioni",
      "elections",
      "diritti",
      "rights",
      "+europa",
      "più europa",
      "radicali italiani",
      "radicali",
      "breaking italy",
      "pulp podcast",
      "corriere",
      "fatto quotidiano",
      "torino politica",
    ],
  },
  { id: "geopolitics", label: "Geopolitics", terms: ["geopolitics", "war", "guerra", "ukraine", "russia", "middle east", "china", "taiwan"] },
  { id: "markets", label: "Markets", terms: ["markets", "mercati", "borsa", "stocks", "trade", "tariff", "dazi", "oil", "gas", "energia", "supply chain"] },
  { id: "italy", label: "Italy", terms: ["italia", "italy", "governo", "politica", "parlamento", "ansa", "corriere"] },
  { id: "world", label: "World", terms: ["world", "cnn", "times", "nytimes", "global", "international"] },
];

const NEWS_FILTER_DISPLAY_ORDER = [
  "all",
  "torino",
  "milano",
  "fashion-industry",
  "kapricorn",
  "beer-wine",
  "parties",
  "alcohol",
  "ai",
  "ai-labs",
  "ai-research",
  "politics",
  "geopolitics",
  "markets",
  "italy",
  "world",
];

const orderedNewsResearchFilters = [...NEWS_RESEARCH_FILTERS].sort(
  (a, b) => NEWS_FILTER_DISPLAY_ORDER.indexOf(a.id) - NEWS_FILTER_DISPLAY_ORDER.indexOf(b.id)
);

const safeJsonParse = <T,>(key: string, fallback: T): T => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const compactNewsItemForStorage = (item: unknown) => {
  if (!item || typeof item !== "object") return item;
  const record = item as Record<string, unknown>;
  return {
    ...record,
    summary: typeof record.summary === "string" ? truncate(record.summary, 420) : record.summary,
    fullSummary: typeof record.fullSummary === "string" ? truncate(record.fullSummary, 800) : record.fullSummary,
  };
};

const compactNewsAgentDbForStorage = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  const compactArray = (key: string, limit: number) =>
    Array.isArray(record[key]) ? record[key].slice(0, limit).map(compactNewsItemForStorage) : record[key];

  return {
    ...record,
    latestTop10: compactArray("latestTop10", 10),
    recent48h: compactArray("recent48h", 40),
    saved: compactArray("saved", 40),
    sources: Array.isArray(record.sources) ? record.sources.slice(0, 80) : record.sources,
  };
};

const minimalNewsAgentDbForStorage = (value: unknown) => {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    kind: record.kind || "pocketflow.news.agentDb",
    updatedAt: record.updatedAt || new Date().toISOString(),
    refreshPlan: record.refreshPlan,
    scoutBots: record.scoutBots,
    archive: record.archive,
    preferenceAgent: record.preferenceAgent,
    newsletterWatchdog: record.newsletterWatchdog,
  };
};

const compactValueForStorage = (key: string, value: unknown) => {
  if (key === NEWS_DB_KEY) return compactNewsAgentDbForStorage(value);
  if (!Array.isArray(value)) return value;
  if (key === NEWSFLOW_ARCHIVE_KEY) return value.slice(0, 160).map(compactNewsItemForStorage);
  if (key === NEWS_ITEMS_KEY) return value.slice(0, 120).map(compactNewsItemForStorage);
  if (key === NEWSLETTER_OUTBOX_KEY) return value.slice(0, 40);
  return value.slice(0, 200);
};

const saveJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    try {
      localStorage.removeItem(key);
      localStorage.setItem(key, JSON.stringify(compactValueForStorage(key, value)));
    } catch {
      if (key === NEWS_DB_KEY) {
        try {
          localStorage.removeItem(key);
          localStorage.setItem(key, JSON.stringify(minimalNewsAgentDbForStorage(value)));
          return;
        } catch {
          // Fall through to the runtime-only path below.
        }
      }
      // Storage quota can be exhausted by local archives. Keep runtime state alive and let the next compact save retry.
    }
  }
};

const isSameJson = (left: unknown, right: unknown) => {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
};

const slugForAgent = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42) || "campaign";

const newsletterProfileJobId = (profile: Pick<NewsletterProfile, "id" | "name" | "title">) =>
  NEWSLETTER_PROFILE_JOB_IDS[profile.id] || `newsletter-campaign-${slugForAgent(profile.id || profile.name || profile.title)}`;

const newsletterProfileSlotJobId = (
  profile: Pick<NewsletterProfile, "id" | "name" | "title">,
  slotIndex: number,
) => {
  const baseId = newsletterProfileJobId(profile);
  return slotIndex === 0 ? baseId : `${baseId}-slot-${slotIndex + 1}`;
};

const newsletterAgentStatusForProfile = (
  profile: Pick<NewsletterProfile, "id"> & Partial<Pick<NewsletterProfile, "enabled">>,
): NewsletterAgentStatus =>
  profile.id === "newsletter_kapricorn_leaflet" && !profile.enabled ? "parked" : "active";

const newsletterAgentNameForProfile = (profile: Pick<NewsletterProfile, "id" | "name" | "title">) =>
  profile.id === "newsletter_kapricorn_leaflet"
    ? "Ready Transport Collector - Kapricorn Weekly"
    : `${profile.name || profile.title || "Newsletter"} Agent`;

const readNewsletterAgentPool = () => {
  const stored = safeJsonParse<
    Record<string, NewsletterAgentAssignment> | { agents?: Record<string, NewsletterAgentAssignment> }
  >(NEWSLETTER_AGENT_POOL_KEY, {});
  return "agents" in stored && stored.agents ? stored.agents : stored as Record<string, NewsletterAgentAssignment>;
};

const newsletterJobFromProfile = (
  profile: NewsletterProfile,
  agent: NewsletterAgentAssignment,
  slot: { time: string; weekdays?: number[] },
  slotIndex: number,
): BalossDurableJob => {
  const normalized = normalizeNewsletterProfile(profile);
  const time = slot.time || normalized.sendTime || "00:00";
  const weekdays = slot.weekdays?.length
    ? normalizeNewsletterWeekdays(slot.weekdays)
    : normalizeNewsletterWeekdays(normalized.sendWeekdays);
  const enabled = normalized.enabled && normalized.cadence !== "manual" && agent.status === "active";
  const job: BalossDurableJob = {
    id: newsletterProfileSlotJobId(normalized, slotIndex),
    kind: "newsletter_send",
    label: `${normalized.name} newsletter / ${time}`,
    owner: "news",
    enabled,
    status: enabled ? "queued" : "paused",
    dailyAt: time,
    weekdays,
    failureCount: 0,
    priority: normalized.id === "newsletter_public_ai_daily" ? 35 : 30,
    lastMessage: enabled
      ? `${agent.agentId} owns send slot ${time} for ${normalized.name}.`
      : `${agent.agentId} is parked; ${normalized.name} will not send automatically.`,
  };
  return { ...job, nextRunAt: computeNextRun(job).toISOString() };
};

const reconcileNewsletterCampaignAgents = (profiles: NewsletterProfile[]) => {
  const now = new Date().toISOString();
  const previousPool = readNewsletterAgentPool();
  const profileIds = new Set(profiles.map((profile) => profile.id));
  const nextPool: Record<string, NewsletterAgentAssignment> = {};

  const assignedProfiles = profiles.map((profile) => {
    const current = previousPool[profile.id];
    const status = newsletterAgentStatusForProfile(profile);
    const agentId = current?.agentId || `newsletter-agent-${slugForAgent(profile.name || profile.title || profile.id)}`;
    const agentName = newsletterAgentNameForProfile(profile);
    const jobId = newsletterProfileJobId(profile);
    const assignment: NewsletterAgentAssignment = {
      agentId,
      agentName,
      profileId: profile.id,
      profileName: profile.name,
      status,
      assignedAt: current?.assignedAt || now,
      lastRenamedAt: current?.profileName === profile.name && current?.agentId === agentId ? current.lastRenamedAt : now,
      jobId,
      parkingLot: status === "active" ? "newsletter-active" : "newsletter-parking-yard",
      note: status === "active"
        ? "Active campaign agent: monitors sources, composes the draft and owns exactly one send slot."
        : "Parked campaign agent: ready but not allowed to dispatch until owner activates it.",
    };
    nextPool[profile.id] = assignment;
    return {
      ...profile,
      agentId: assignment.agentId,
      agentName,
      agentStatus: assignment.status,
      agentAssignedAt: assignment.assignedAt,
    };
  });

  Object.values(previousPool).forEach((assignment) => {
    if (profileIds.has(assignment.profileId)) return;
    nextPool[assignment.profileId] = {
      ...assignment,
      status: "stale",
      parkingLot: "newsletter-parking-yard",
      note: "Stale parked agent: original campaign no longer exists, kept as backup memory.",
    };
  });

  saveJson(NEWSLETTER_AGENT_POOL_KEY, {
    version: NEWSLETTER_AGENT_POOL_VERSION,
    updatedAt: now,
    agents: nextPool,
  });

  const desiredJobs = new Map(
    assignedProfiles.flatMap((profile) => {
      const assignment = nextPool[profile.id];
      const normalized = normalizeNewsletterProfile(profile);
      const slots = normalized.sendSchedule?.length
        ? normalized.sendSchedule.map((entry) => ({ time: entry.time, weekdays: [entry.weekday] }))
        : newsletterSendTimes(normalized).map((time) => ({ time, weekdays: normalized.sendWeekdays }));
      return slots.map((slot, slotIndex) => {
        const job = newsletterJobFromProfile(profile, assignment, slot, slotIndex);
        return [job.id, job] as const;
      });
    }),
  );
  const defaultNewsletterJobIds = new Set(Object.values(NEWSLETTER_PROFILE_JOB_IDS));
  const currentJobs = loadBalossDurableJobs();
  const nonDuplicateJobs = currentJobs.filter((job) => {
    if (job.kind !== "newsletter_send") return true;
    if (desiredJobs.has(job.id)) return false;
    if (defaultNewsletterJobIds.has(job.id)) return false;
    return !job.id.startsWith("newsletter-campaign-");
  });
  saveBalossDurableJobs([...nonDuplicateJobs, ...desiredJobs.values()]);

  const agentDb = safeJsonParse<Record<string, unknown>>(NEWS_DB_KEY, {});
  saveJson(NEWS_DB_KEY, {
    ...agentDb,
    newsletterCampaignAgents: {
      version: NEWSLETTER_AGENT_POOL_VERSION,
      updatedAt: now,
      active: Object.values(nextPool).filter((agent) => agent.status === "active").length,
      parked: Object.values(nextPool).filter((agent) => agent.status !== "active").length,
      agents: Object.values(nextPool),
    },
  });

  return assignedProfiles;
};

const campaignAgentCanRun = (profile: Pick<NewsletterProfile, "agentStatus" | "id">) =>
  (profile.agentStatus || newsletterAgentStatusForProfile(profile)) === "active";

const repairNewsletterProfilesForSingleSchedule = (profiles?: NewsletterProfile[]) => {
  const rawProfiles = Array.isArray(profiles)
    ? profiles
    : safeJsonParse<NewsletterProfile[]>(NEWSLETTER_PROFILES_KEY, []);
  let normalizedProfiles = reconcileNewsletterCampaignAgents(
    normalizeNewsletterProfiles(rawProfiles.length ? rawProfiles : defaultNewsletterProfiles()),
  );
  const needsKapricornPauseRepair = localStorage.getItem(KAPRICORN_PAUSE_REPAIR_KEY) !== KAPRICORN_PAUSE_REPAIR_VERSION;
  if (needsKapricornPauseRepair) {
    normalizedProfiles = reconcileNewsletterCampaignAgents(
      normalizedProfiles.map((profile) =>
        profile.id === "newsletter_kapricorn_leaflet"
          ? { ...profile, enabled: false, agentStatus: "parked" }
          : profile,
      ),
    );
    localStorage.setItem(KAPRICORN_PAUSE_REPAIR_KEY, KAPRICORN_PAUSE_REPAIR_VERSION);
  }
  if (!isSameJson(rawProfiles, normalizedProfiles)) {
    saveJson(NEWSLETTER_PROFILES_KEY, normalizedProfiles);
  }
  localStorage.setItem(NEWSLETTER_PROFILE_REPAIR_KEY, NEWSLETTER_PROFILE_REPAIR_VERSION);
  return normalizedProfiles;
};

const acquireNewsletterAutomationLock = (owner: string) => {
  const now = Date.now();
  const existing = safeJsonParse<{ owner?: string; startedAt?: string; expiresAt?: number } | null>(
    NEWSLETTER_AUTOMATION_LOCK_KEY,
    null,
  );
  if (existing?.expiresAt && existing.expiresAt > now) {
    return null;
  }
  const token = `${owner}-${now}-${Math.random().toString(36).slice(2, 8)}`;
  const lock = {
    owner: token,
    startedAt: new Date(now).toISOString(),
    expiresAt: now + NEWSLETTER_AUTOMATION_LOCK_MS,
  };
  saveJson(NEWSLETTER_AUTOMATION_LOCK_KEY, lock);
  const confirmed = safeJsonParse<typeof lock | null>(NEWSLETTER_AUTOMATION_LOCK_KEY, null);
  return confirmed?.owner === token ? token : null;
};

const releaseNewsletterAutomationLock = (token: string | null) => {
  if (!token) return;
  const existing = safeJsonParse<{ owner?: string } | null>(NEWSLETTER_AUTOMATION_LOCK_KEY, null);
  if (existing?.owner === token) {
    localStorage.removeItem(NEWSLETTER_AUTOMATION_LOCK_KEY);
  }
};

const stripText = (value: string) =>
  value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

const truncate = (value: string, max: number) => {
  if (value.length <= max) return value;
  const clipped = value.slice(0, max - 1).replace(/\s+\S*$/, "");
  return `${clipped}...`;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeTitle = (value: string, sourceName: string) => {
  const text = stripText(value);
  const sourcePattern = new RegExp(`\\s+-\\s+${sourceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  return text
    .replace(sourcePattern, "")
    .replace(/\s+-\s+Google News$/i, "")
    .trim();
};

const itemIdFor = (sourceId: string, title: string, link: string) => {
  const seed = `${sourceId}:${title}:${link}`.toLowerCase();
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return `news_${sourceId}_${hash.toString(36)}`;
};

const readNodeText = (node: Element, selectors: string[]) => {
  for (const selector of selectors) {
    const found = node.querySelector(selector);
    const value = found?.textContent?.trim();
    if (value) return value;
  }
  return "";
};

const readNodeLink = (node: Element) => {
  const direct = readNodeText(node, ["link"]);
  if (direct) return direct;
  const atomLink = node.querySelector("link[href]");
  return atomLink?.getAttribute("href") || "";
};

const buildSummary = (title: string, description: string, sourceName: string) => {
  const cleaned = stripText(description)
    .replace(/^Read full article on\s+/i, "")
    .replace(/\s*Full Coverage on Google News.*$/i, "")
    .replace(/\s*Visualizza la copertura completa su Google News.*$/i, "");
  const base = cleaned || title;
  const compact = truncate(base, 210);
  const full = truncate(
    `${compact}${compact.endsWith(".") ? "" : "."} Source: ${sourceName}. Open the link for the full article and original reporting.`,
    520,
  );
  return {
    summary: compact,
    fullSummary: full,
  };
};

const fetchAttempt = async (url: string, timeoutMs: number) => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    window.clearTimeout(timer);
  }
};

const fetchLocalFeedProxy = async (url: string) => {
  const payload = await fetchAttempt(`/api/newsflow/rss?url=${encodeURIComponent(url)}&t=${Date.now()}`, 6500);
  const parsed = JSON.parse(payload) as LocalFeedProxyPayload;
  if (!parsed.ok || !parsed.text) throw new Error(parsed.error || "Local feed proxy returned no data");
  return parsed.text;
};

const fetchFeedPayload = async (url: string): Promise<FeedPayload> => {
  let lastError = "";
  try {
    const text = await fetchLocalFeedProxy(url);
    if (text.trim().startsWith("<") || text.includes("<item") || text.includes("<entry")) return { kind: "xml", text };
    if (text.trim()) return { kind: "xml", text };
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }

  const rss2JsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
  const attempts = [
    { kind: "xml" as const, url, timeoutMs: 3000 },
    {
      kind: "rss2json" as const,
      url: rss2JsonUrl,
      timeoutMs: 4000,
    },
    {
      kind: "rss2json" as const,
      url: `https://api.allorigins.win/raw?url=${encodeURIComponent(rss2JsonUrl)}`,
      timeoutMs: 5000,
    },
    { kind: "xml" as const, url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, timeoutMs: 3500 },
  ];

  for (const attempt of attempts) {
    try {
      const text = await fetchAttempt(attempt.url, attempt.timeoutMs);
      if (attempt.kind === "rss2json") {
        const parsed = JSON.parse(text);
        if (parsed?.status === "ok" && Array.isArray(parsed.items) && parsed.items.length) {
          return { kind: "rss2json", items: parsed.items };
        }
        throw new Error(parsed?.message || "RSS2JSON empty");
      }
      if (text.trim().startsWith("<") || text.includes("<item") || text.includes("<entry")) return { kind: "xml", text };
      if (text.trim()) return { kind: "xml", text };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError || "Feed unavailable");
};

const fetchOfficialPageText = async (url: string) => {
  let lastError = "";
  try {
    const text = await fetchLocalFeedProxy(url);
    if (text.trim()) return text;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }
  for (const attempt of [
    { url, timeoutMs: 4500 },
    { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, timeoutMs: 6500 },
  ]) {
    try {
      const text = await fetchAttempt(attempt.url, attempt.timeoutMs);
      if (text.trim()) return text;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError || "Official mobility page unavailable");
};

const parseOfficialPageSnapshot = (html: string, source: NewsSource, link: string): NewsItem[] => {
  const document = new DOMParser().parseFromString(html, "text/html");
  const pageTitle = stripText(document.querySelector("title, h1, h2")?.textContent || source.name);
  const bodyText = stripText(document.body?.textContent || html)
    .replace(/\s+/g, " ")
    .trim();
  const mobilityTerms = /scioper|ritard|cancell|infomobil|volo|treno|ferroviar|trasporto|flight|delay|train/i;
  const sentenceCandidates = bodyText
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.length > 35 && mobilityTerms.test(sentence));
  const detail = sentenceCandidates.slice(0, 5).join(" ") || bodyText;
  const title = normalizeTitle(`${source.name}: ${pageTitle}`, source.name);
  const { summary, fullSummary } = buildSummary(title, detail, source.name);
  const fetchedAt = new Date().toISOString();
  return [{
    id: itemIdFor(source.id, title, link),
    sourceId: source.id,
    sourceName: source.name,
    topic: source.topic,
    title,
    link,
    publishedAt: fetchedAt,
    summary,
    fullSummary: `${fullSummary} This is an official live-board snapshot, not a guaranteed historical delay statistic.`,
    fetchedAt,
  }];
};

const readJsonStorage = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
};

const buildRadarMobilitySnapshot = (source: NewsSource): NewsItem[] => {
  const board = readJsonStorage<{
    airport?: { name?: string; iata?: string };
    operations?: { level?: string; liveAircraft?: number; inbound?: number; outbound?: number; estimatedDelay?: string; queueEstimate?: string; updatedAt?: string };
    providerStatus?: string;
    updatedAt?: string;
  }>("pocketflow.publicMobility.lastBoard");
  const aircraft = readJsonStorage<{
    aircraft?: Array<{ callsign?: string; airlineName?: string; distanceNm?: number }>;
    updatedAt?: string;
  }>("pocketflow.flightRadar.lastAircraft");
  if (!board && !aircraft) return [];

  const airportName = board?.airport?.name || board?.airport?.iata || "selected airport";
  const operations = board?.operations;
  const radarCount = aircraft?.aircraft?.length || operations?.liveAircraft || 0;
  const title = `PocketFlow Radar: ${airportName} mobility snapshot`;
  const detail = [
    operations ? `Operational level ${operations.level || "unknown"}; estimated delay ${operations.estimatedDelay || "unknown"}; queue estimate ${operations.queueEstimate || "not available"}.` : "No airport operations board is cached.",
    `Radar cache contains ${radarCount} nearby aircraft${aircraft?.updatedAt ? `, updated ${aircraft.updatedAt}` : ""}.`,
    operations?.inbound !== undefined || operations?.outbound !== undefined
      ? `Inbound ${operations.inbound || 0}, outbound ${operations.outbound || 0}.`
      : "Inbound/outbound counts are not available in the cached board.",
  ].join(" ");
  const fetchedAt = new Date().toISOString();
  const { summary, fullSummary } = buildSummary(title, detail, source.name);
  return [{
    id: itemIdFor(source.id, title, "https://airplanes.live/"),
    sourceId: source.id,
    sourceName: source.name,
    topic: source.topic,
    title,
    link: "https://airplanes.live/",
    publishedAt: board?.updatedAt || aircraft?.updatedAt || fetchedAt,
    summary,
    fullSummary: `${fullSummary} Radar is contextual live data from the existing PocketFlow cache; it is not a strike confirmation.`,
    fetchedAt,
  }];
};

const parseFeed = (xmlText: string, source: NewsSource): NewsItem[] => {
  const document = new DOMParser().parseFromString(xmlText, "text/xml");
  const entries = Array.from(document.querySelectorAll("item, entry"));
  const fetchedAt = new Date().toISOString();

  return entries.map((entry) => {
    const rawTitle = readNodeText(entry, ["title"]);
    const title = normalizeTitle(rawTitle, source.name);
    const link = readNodeLink(entry);
    const published =
      readNodeText(entry, ["pubDate", "published", "updated", "dc\\:date"]) ||
      fetchedAt;
    const description = readNodeText(entry, ["description", "summary", "content\\:encoded"]);
    const { summary, fullSummary } = buildSummary(title, description, source.name);
    const publishedAt = Number.isNaN(Date.parse(published)) ? fetchedAt : new Date(published).toISOString();

    return {
      id: itemIdFor(source.id, title, link),
      sourceId: source.id,
      sourceName: source.name,
      topic: source.topic,
      title,
      link,
      publishedAt,
      summary,
      fullSummary,
      fetchedAt,
    };
  }).filter((item) => item.title && item.link);
};

const parseRss2Json = (items: Rss2JsonItem[], source: NewsSource): NewsItem[] => {
  const fetchedAt = new Date().toISOString();
  return items.map((entry) => {
    const title = normalizeTitle(entry.title || "", source.name);
    const link = entry.link || "";
    const published = entry.pubDate || fetchedAt;
    const { summary, fullSummary } = buildSummary(title, entry.description || entry.content || "", source.name);
    const publishedAt = Number.isNaN(Date.parse(published)) ? fetchedAt : new Date(published).toISOString();
    return {
      id: itemIdFor(source.id, title, link),
      sourceId: source.id,
      sourceName: source.name,
      topic: source.topic,
      title,
      link,
      publishedAt,
      summary,
      fullSummary,
      fetchedAt,
    };
  }).filter((item) => item.title && item.link);
};

const newsSourceFailureMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error || "Unknown feed failure");

const isTransientNewsNetworkMessage = (message = "") => {
  const normalized = message.toLowerCase();
  return [
    "failed to fetch",
    "networkerror",
    "load failed",
    "err_internet_disconnected",
    "err_name_not_resolved",
    "err_network_changed",
    "err_timed_out",
    "internet disconnected",
    "network is unreachable",
    "unknown host",
    "dns",
    "timeout",
    "abort",
    "the operation was aborted",
  ].some((needle) => normalized.includes(needle));
};

const isTransientNewsNetworkError = (error: unknown) =>
  isTransientNewsNetworkMessage(newsSourceFailureMessage(error));

const readNewsSourceFailures = () => {
  const failures = safeJsonParse<Record<string, NewsSourceFailure>>(NEWS_SOURCE_FAILURE_KEY, {});
  let cleaned = false;
  Object.entries(failures).forEach(([sourceId, failure]) => {
    if (failure?.quarantinedUntil && isTransientNewsNetworkMessage(failure.lastError)) {
      failures[sourceId] = {
        count: 0,
        lastError: `${failure.lastError} (network outage guarded; source restored)`,
        lastFailedAt: failure.lastFailedAt,
      };
      cleaned = true;
    }
  });
  if (cleaned) saveJson(NEWS_SOURCE_FAILURE_KEY, failures);
  return failures;
};

const sourceDisabledReason = (source: NewsSource, failures = readNewsSourceFailures()) => {
  if (source.disabled || NEWS_DISABLED_SOURCE_IDS.has(source.id)) {
    return source.disabledReason || "Source disabled by News Flow guard.";
  }
  const failure = failures[source.id];
  if (!failure?.quarantinedUntil) return "";
  const until = Date.parse(failure.quarantinedUntil);
  if (Number.isNaN(until) || until <= Date.now()) return "";
  return `Source quarantined until ${new Date(until).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}: ${failure.lastError}`;
};

const activeSourcePool = (sources: NewsSource[]) => {
  const failures = readNewsSourceFailures();
  return sources.filter((source) => !sourceDisabledReason(source, failures));
};

const enabledNewsSources = (sources: NewsSource[]) =>
  sources.filter((source) => !source.disabled && !NEWS_DISABLED_SOURCE_IDS.has(source.id));

type NewsFlowRetryQueue = {
  createdAt: string;
  nextAttemptAt: string;
  attempts: number;
  lastError: string;
  reason: string;
};

const readNewsFlowRetryQueue = () =>
  safeJsonParse<NewsFlowRetryQueue | null>(NEWSFLOW_RETRY_QUEUE_KEY, null);

const queueNewsFlowRetry = (lastError: string, reason: string) => {
  const previous = readNewsFlowRetryQueue();
  saveJson(NEWSFLOW_RETRY_QUEUE_KEY, {
    createdAt: previous?.createdAt || new Date().toISOString(),
    attempts: (previous?.attempts || 0) + 1,
    lastError,
    reason,
    nextAttemptAt: new Date(Date.now() + NEWSFLOW_RETRY_DELAY_MS).toISOString(),
  });
};

const clearNewsFlowRetry = () => {
  try {
    localStorage.removeItem(NEWSFLOW_RETRY_QUEUE_KEY);
  } catch {
    // localStorage can be unavailable in strict/private contexts.
  }
};

const newsFlowRetryDue = () => {
  const retry = readNewsFlowRetryQueue();
  if (!retry) return false;
  const due = Date.parse(retry.nextAttemptAt || "");
  return Number.isNaN(due) || due <= Date.now();
};

const recordNewsSourceSuccess = (source: NewsSource) => {
  const failures = readNewsSourceFailures();
  if (!failures[source.id]) return;
  delete failures[source.id];
  saveJson(NEWS_SOURCE_FAILURE_KEY, failures);
};

const recordNewsSourceFailure = (source: NewsSource, error: unknown) => {
  if (source.disabled || NEWS_DISABLED_SOURCE_IDS.has(source.id)) return;
  const failures = readNewsSourceFailures();
  const previous = failures[source.id];
  const message = newsSourceFailureMessage(error);
  if (isTransientNewsNetworkError(error)) {
    failures[source.id] = {
      count: previous?.count || 0,
      lastError: message,
      lastFailedAt: new Date().toISOString(),
    };
    saveJson(NEWS_SOURCE_FAILURE_KEY, failures);
    return;
  }
  const count = (previous?.count || 0) + 1;
  failures[source.id] = {
    count,
    lastError: message,
    lastFailedAt: new Date().toISOString(),
    quarantinedUntil: count >= NEWS_SOURCE_FAILURE_LIMIT
      ? new Date(Date.now() + NEWS_SOURCE_QUARANTINE_MS).toISOString()
      : previous?.quarantinedUntil,
  };
  saveJson(NEWS_SOURCE_FAILURE_KEY, failures);
};

const fetchSourceItems = async (source: NewsSource) => {
  if (source.kind === "radar-snapshot") {
    recordNewsSourceSuccess(source);
    return buildRadarMobilitySnapshot(source);
  }
  try {
    const results = await Promise.allSettled([
      ...source.feeds.map(async (feed) => {
        const payload = await fetchFeedPayload(feed);
        return payload.kind === "xml" ? parseFeed(payload.text, source) : parseRss2Json(payload.items, source);
      }),
      ...(source.officialPages || []).map(async (page) =>
        parseOfficialPageSnapshot(await fetchOfficialPageText(page), source, page),
      ),
    ]);
    const items = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
    if (items.length) {
      recordNewsSourceSuccess(source);
      return items;
    }
    const error = results.find((result): result is PromiseRejectedResult => result.status === "rejected")?.reason;
    throw new Error(`${source.name}: ${error instanceof Error ? error.message : "No items"}`);
  } catch (error) {
    recordNewsSourceFailure(source, error);
    throw error;
  }
};

const fetchSourcesInBatches = async (
  sources: NewsSource[],
  options: { ignoreQuarantine?: boolean; batchSize?: number; maxRuntimeMs?: number } = {},
) => {
  const results: PromiseSettledResult<NewsItem[]>[] = [];
  const startedAt = Date.now();
  const batchSize = Math.max(1, options.batchSize || NEWS_SCOUT_BATCH_SIZE);
  for (let index = 0; index < sources.length; index += batchSize) {
    if (options.maxRuntimeMs && Date.now() - startedAt > options.maxRuntimeMs) break;
    const batch = sources.slice(index, index + batchSize);
    const failures = readNewsSourceFailures();
    const runnable = options.ignoreQuarantine
      ? enabledNewsSources(batch)
      : batch.filter((source) => !sourceDisabledReason(source, failures));
    if (!runnable.length) continue;
    const settled = await Promise.allSettled(runnable.map((source) => fetchSourceItems(source)));
    results.push(...settled);
  }
  return results;
};

const sourceFor = (sourceId: string) =>
  [...NEWS_SOURCES, ...NEWS_MANUAL_RESCUE_SOURCES].find((source) => source.id === sourceId);

const activeNewsSources = () => {
  const pool = activeSourcePool(NEWS_SOURCES);
  const savedSelection = safeJsonParse<string[]>(
    NEWS_GLOBAL_SOURCES_KEY,
    pool.filter((source) => source.priority >= 8).map((source) => source.id),
  );
  const selected = Array.from(new Set([
    ...savedSelection,
    ...ITALY_MOBILITY_SOURCE_IDS,
  ]));
  const filtered = pool.filter((source) => selected.includes(source.id));
  return filtered.length ? filtered : pool;
};

const defaultNewsScoutState = (): NewsScoutState => ({
  cursor: 0,
  botIndex: 0,
  batchesRun: 0,
  lastRunAt: "",
  lastSourceIds: [],
  lastMode: "app",
});

const readNewsScoutState = () => ({
  ...defaultNewsScoutState(),
  ...safeJsonParse<Partial<NewsScoutState>>(NEWS_SCOUT_STATE_KEY, {}),
});

const pickScoutSources = (mode: NewsScoutState["lastMode"]) => {
  const sources = mode === "manual"
    ? enabledNewsSources(NEWS_SOURCES)
    : mode === "newsletter"
      ? activeSourcePool(NEWS_SOURCES)
      : activeNewsSources();
  const state = readNewsScoutState();
  if (!sources.length) return { sources: [] as NewsSource[], state };

  const start = Math.max(0, state.cursor || 0) % sources.length;
  const count = Math.min(NEWS_SCOUT_BATCH_SIZE, sources.length);
  const selected = mode === "manual" || mode === "newsletter"
    ? [...sources]
      .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name))
      .slice(0, Math.min(NEWS_MANUAL_PULL_MAX_SOURCES, sources.length))
    : Array.from({ length: count }, (_, index) => sources[(start + index) % sources.length]);
  const nextState: NewsScoutState = {
    cursor: (start + selected.length) % sources.length,
    botIndex: ((state.botIndex || 0) + 1) % NEWS_SCOUT_BOT_COUNT,
    batchesRun: (state.batchesRun || 0) + 1,
    lastRunAt: new Date().toISOString(),
    lastSourceIds: selected.map((source) => source.id),
    lastMode: mode,
  };
  return { sources: selected, state: nextState };
};

const saveNewsScoutState = (state: NewsScoutState) => {
  saveJson(NEWS_SCOUT_STATE_KEY, state);
};

const keywordScore = (item: NewsItem) => {
  const haystack = `${item.title} ${item.summary} ${item.sourceName}`.toLowerCase();
  return PERSONAL_KEYWORDS.reduce((score, keyword) => score + (haystack.includes(keyword.toLowerCase()) ? 3 : 0), 0);
};

const searchableNewsText = (item: NewsItem) =>
  `${item.sourceId} ${item.sourceName} ${item.topic} ${item.title} ${item.summary} ${item.fullSummary}`.toLowerCase();

const QUALITY_STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "into", "after", "over", "under", "about", "says", "will", "their", "they", "them", "have", "has", "were", "was",
  "sono", "della", "delle", "degli", "alla", "alle", "nella", "nelle", "con", "per", "che", "gli", "una", "uno", "del", "nel", "tra",
]);

const significantTitleWords = (title: string) =>
  title
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9à-ÿ]+/gi, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !QUALITY_STOP_WORDS.has(word))
    .slice(0, 9);

const clampQualityScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

const qualityLevelForScore = (score: number): NewsQualityLevel =>
  score > 75 ? "green" : score >= 55 ? "yellow" : "red";

const buildNewsQualityControl = (item: NewsItem, peers: NewsItem[] = []): NewsQualityControl => {
  const source = sourceFor(item.sourceId);
  const haystack = searchableNewsText(item);
  const linkValid = /^https?:\/\//i.test(item.link);
  const published = Date.parse(item.publishedAt);
  const ageHours = Number.isNaN(published) ? null : (Date.now() - published) / 3_600_000;
  const signals: string[] = [];
  let score = 50;

  score += Math.min(24, (source?.priority || 5) * 2.6);
  signals.push(source ? `${source.name} source priority ${source.priority}/10` : "Unknown source priority");

  if (linkValid) {
    score += 8;
    signals.push("Source link present");
  } else {
    score -= 12;
    signals.push("Missing source link");
  }

  const detailLength = `${item.summary} ${item.fullSummary}`.trim().length;
  if (detailLength >= 220) {
    score += 8;
    signals.push("Detailed summary available");
  } else if (detailLength >= 90) {
    score += 4;
    signals.push("Basic summary available");
  } else {
    score -= 8;
    signals.push("Thin summary needs review");
  }

  if (ageHours === null) {
    score -= 6;
    signals.push("Timestamp missing");
  } else if (ageHours < -2) {
    score -= 10;
    signals.push("Future timestamp anomaly");
  } else if (ageHours <= NEWS_ACTIVE_WINDOW_HOURS) {
    score += 8;
    signals.push("Fresh within active news window");
  } else {
    score -= 4;
    signals.push("Older than active news window");
  }

  const titleWords = significantTitleWords(item.title);
  const corroborations = peers
    .filter((peer) => peer.id !== item.id && peer.sourceId !== item.sourceId)
    .filter((peer) => {
      const peerText = searchableNewsText(peer);
      const sharedWords = titleWords.filter((word) => peerText.includes(word)).length;
      return sharedWords >= 2 || (!!item.title && peer.title.toLowerCase().includes(item.title.toLowerCase().slice(0, 24)));
    })
    .slice(0, 3);

  if (corroborations.length >= 2) {
    score += 14;
    signals.push(`Cross-checked by ${corroborations.length} other sources`);
  } else if (corroborations.length === 1) {
    score += 8;
    signals.push(`Cross-checked by ${corroborations[0].sourceName}`);
  } else {
    score -= 3;
    signals.push("No same-feed corroboration yet");
  }

  if (/\b(sponsored|advertorial|paid partnership|partner content|brand content)\b/i.test(haystack)) {
    score -= 14;
    signals.push("Possible sponsored/brand content");
  }
  if (/\b(rumou?r|unconfirmed|allegedly|anonymous sources?|leak|speculation)\b/i.test(haystack)) {
    score -= 7;
    signals.push("Contains unconfirmed-language warning");
  }
  if (/\b(ai generated|generated by ai|synthetic|automated article|machine generated)\b/i.test(haystack)) {
    score -= 10;
    signals.push("Possible AI-generated content wording");
  }
  if (/\b(confirmed|official|court|regulator|filing|statement|fact check|correction|updated)\b/i.test(haystack)) {
    score += 5;
    signals.push("Official/update signal present");
  }

  const finalScore = clampQualityScore(score);
  const level = qualityLevelForScore(finalScore);
  const summary =
    level === "green" ? "Strong source and corroboration signals." :
    level === "yellow" ? "Useful, but keep a human review before sending." :
    "Needs human review before newsletter send.";

  return { score: finalScore, level, summary, signals: signals.slice(0, 5), checkedAt: new Date().toISOString() };
};

const newsQualityControlForItem = (item: NewsItem) => item.qualityControl || buildNewsQualityControl(item);

const applyNewsQualityControl = (items: NewsItem[]) => {
  const pool = [...items];
  return pool.map((item) => ({ ...item, qualityControl: buildNewsQualityControl(item, pool) }));
};

const newsQualityColor = (level: NewsQualityLevel) =>
  level === "green" ? "#047857" : level === "yellow" ? "#b45309" : "#b91c1c";

const newsletterQualityBadgeHtml = (item: NewsItem) => {
  const quality = newsQualityControlForItem(item);
  const color = newsQualityColor(quality.level);
  return `<div style="display:inline-block;margin:7px 0 4px;padding:5px 8px;border-radius:999px;border:1px solid ${color};color:${color};font:900 10px Arial,Helvetica,sans-serif;text-transform:uppercase;letter-spacing:1.4px;">Quality control ${quality.score}%</div>`;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasSearchTerm = (haystack: string, term: string) => {
  const clean = term.toLowerCase().trim();
  if (!clean) return false;
  if (/^[a-z0-9]+$/i.test(clean)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegex(clean)}([^a-z0-9]|$)`, "i").test(haystack);
  }
  return haystack.includes(clean);
};

const RESEARCH_FILTER_TOPIC_ALIASES: Record<string, NewsTopic[]> = {
  ai: ["ai"],
  "ai-labs": ["ai"],
  "ai-research": ["ai"],
  "fashion-industry": ["fashion"],
  kapricorn: ["kapricorn", "beer", "alcohol", "parties"],
  "beer-wine": ["beer", "alcohol"],
  parties: ["parties"],
  alcohol: ["alcohol", "beer"],
  politics: ["politics", "italy"],
  geopolitics: ["geopolitics"],
  markets: ["markets"],
  italy: ["italy"],
  "italy-mobility": ["mobility"],
  world: ["world"],
};

const matchesResearchFilter = (item: NewsItem, filterId: string) => {
  if (filterId === "all") return true;
  if (RESEARCH_FILTER_TOPIC_ALIASES[filterId]?.includes(item.topic)) return true;
  const filter = NEWS_RESEARCH_FILTERS.find((entry) => entry.id === filterId);
  if (!filter) return true;
  const haystack = searchableNewsText(item);
  return filter.terms.some((term) => hasSearchTerm(haystack, term));
};

const isPublicNewsletterProfile = (profile: Pick<NewsletterProfile, "id" | "name" | "title" | "topicFilters">) =>
  profile.id === "newsletter_public_ai_daily" ||
  /public/i.test(`${profile.name || ""} ${profile.title || ""}`) ||
  (Array.isArray(profile.topicFilters) && profile.topicFilters.some((topic) => PUBLIC_TOPIC_FILTERS.includes(topic)));

const isPropertyDigestNewsletterProfile = (profile: Pick<NewsletterProfile, "id" | "name" | "title" | "templateName">) =>
  profile.id === PROPERTY_DIGEST_NEWSLETTER_PROFILE_ID ||
  /ricerca casa al lago/i.test(`${profile.name || ""} ${profile.title || ""} ${profile.templateName || ""}`) ||
  /lakehouse/i.test(`${profile.name || ""} ${profile.title || ""} ${profile.templateName || ""}`);

const propertyDigestMoney = (value: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value || 0);

const normalizePropertyDigestTitleBase = (title?: string) =>
  String(title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(?:n|no|nr|numero|#)?\s*\d+\s*$/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const propertyDigestFeatureLabel = (pick: Pick<PropertyDigestNewsletterPick, "title" | "reason">) => {
  const haystack = `${pick.title || ""} ${pick.reason || ""}`.toLowerCase();
  if (/garden|giardino/.test(haystack)) return "garden";
  if (/terrace|terraz/.test(haystack)) return "terrace";
  if (/lake view|vista lago/.test(haystack)) return "lake-view";
  return "selected";
};

const propertyDigestStyleLabel = (pick: Pick<PropertyDigestNewsletterPick, "title" | "reason">) => {
  const haystack = `${pick.title || ""} ${pick.reason || ""}`.toLowerCase();
  if (/villa|detached|independent|indipendente/.test(haystack)) return "villa";
  if (/townhouse|duplex|schiera/.test(haystack)) return "townhouse";
  if (/penthouse|attico|top floor/.test(haystack)) return "penthouse";
  if (/period|liberty|storico/.test(haystack)) return "period apartment";
  if (/renovation|rinnov/.test(haystack)) return "renovation apartment";
  if (/ready|pronta|turnkey|renovated/.test(haystack)) return "ready apartment";
  return "apartment";
};

const propertyDigestTitleLooksSynthetic = (title?: string) => {
  const normalized = normalizePropertyDigestTitleBase(title);
  if (!normalized) return true;
  if (/\b(?:terrace|garden|balcony|pool)\s+home\b/.test(normalized)) return true;
  if (/\bhome\s+\d+\b/.test(String(title || "").toLowerCase())) return true;
  if (/\b(?:casa lago|lakehouse|lake house)\b/.test(normalized)) return true;
  return false;
};

const descriptivePropertyDigestTitle = (pick: PropertyDigestNewsletterPick, index: number) => {
  const town = pick.town || "Lago Maggiore";
  const feature = propertyDigestFeatureLabel(pick);
  const style = propertyDigestStyleLabel(pick);
  const details = [
    Number(pick.bedrooms) ? `${Number(pick.bedrooms)} camere` : "",
    Number(pick.sqm) ? `${Number(pick.sqm)} m2` : "",
    pick.source ? String(pick.source).replace(/^https?:\/\//, "") : "",
  ].filter(Boolean);
  return `${town} ${feature} ${style}${details.length ? ` - ${details.join(", ")}` : ` ${index + 1}`}`;
};

const diversifyPropertyDigestPicks = (picks: PropertyDigestNewsletterPick[], limit: number) => {
  const selected: PropertyDigestNewsletterPick[] = [];
  const remaining = [...picks];
  const townCounts = new Map<string, number>();
  const maxPerTown = 2;

  while (remaining.length && selected.length < limit) {
    const nextIndex = remaining.findIndex((pick) => (townCounts.get(pick.town || "") || 0) < maxPerTown);
    const [next] = remaining.splice(nextIndex >= 0 ? nextIndex : 0, 1);
    selected.push(next);
    townCounts.set(next.town || "", (townCounts.get(next.town || "") || 0) + 1);
  }

  return selected;
};

const normalizePropertyDigestNewsletterTitles = (picks: PropertyDigestNewsletterPick[]) => {
  const baseCounts = new Map<string, number>();
  picks.forEach((pick) => {
    const base = normalizePropertyDigestTitleBase(pick.title);
    if (base) baseCounts.set(base, (baseCounts.get(base) || 0) + 1);
  });

  return picks.map((pick, index) => {
    const base = normalizePropertyDigestTitleBase(pick.title);
    const titleLooksGeneric = /\b(casa lago|lakehouse|lake house|apartment|appartamento|home)\b/i.test(pick.title || "");
    const shouldRewrite = propertyDigestTitleLooksSynthetic(pick.title) || (base && (baseCounts.get(base) || 0) > 1 && titleLooksGeneric);
    return shouldRewrite ? { ...pick, title: descriptivePropertyDigestTitle(pick, index) } : pick;
  });
};

const readPropertyDigestPreferences = (): PropertyDigestPreferenceSnapshot | null => {
  try {
    const stored = safeJsonParse<PropertyDigestPreferenceSnapshot | null>(PROPERTY_DIGEST_PREFERENCES_KEY, null);
    return stored && typeof stored === "object" ? stored : null;
  } catch {
    return null;
  }
};

const fallbackPropertyDigestPicks = (snapshot?: PropertyDigestPreferenceSnapshot | null): PropertyDigestNewsletterPick[] => {
  const filters = snapshot?.filters || {};
  const minPrice = Number(filters.minPrice) || 90000;
  const minBedrooms = Number(filters.minBedrooms) || 2;
  const minSqm = Number(filters.minSqm) || 90;
  const maxSqm = Number(filters.maxSqm) || 120;
  const towns = [
    "Arona",
    "Dormelletto",
    "Meina",
    "Stresa",
    "Castelletto Ticino",
    "Lesa",
    "Belgirate",
    "Baveno",
    "Verbania",
    "Sesto Calende",
  ];
  const sources = ["Immobiliare.it", "Idealista", "Casa.it", "Trovacasa", "Tecnocasa"];
  return towns.map((town, index) => {
    const hasGarden = index % 2 === 1;
    const price = minPrice + 85000 + index * 22000;
    return {
      id: `lakehouse-fallback-${index + 1}`,
      title: `${town} ${hasGarden ? "garden apartment" : "terrace apartment"}`,
      town,
      price,
      sqm: Math.min(maxSqm, minSqm + 4 + (index % 7) * 3),
      bedrooms: Math.max(minBedrooms, 2 + (index % 2)),
      baths: index % 3 === 0 ? 2 : 1,
      source: sources[index % sources.length],
      url: "https://www.immobiliare.it/",
      reason: `${town}: matches ${minBedrooms}+ bedrooms, ${minSqm}-${maxSqm} m2, ${hasGarden ? "garden" : "terrace"} and price from ${propertyDigestMoney(minPrice)}.`,
    };
  });
};

const propertyDigestPickToNewsletterItem = (pick: PropertyDigestNewsletterPick, index: number): PropertyDigestNewsletterItem => {
  const bedrooms = Number(pick.bedrooms) || 2;
  const sqm = Number(pick.sqm) || 0;
  const baths = Number(pick.baths) || 1;
  const link = pick.url || "https://www.immobiliare.it/";
  const summary = `${pick.town} / ${propertyDigestMoney(pick.price)} / ${bedrooms} bed / ${sqm || "?"} m2 / ${baths} bath.`;
  return {
    id: pick.id || `lakehouse-pick-${index + 1}`,
    sourceId: `lakehouse-${String(pick.source || "portal").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    sourceName: pick.source || "Property Digest",
    topic: "italy",
    title: pick.title || `${pick.town || "Lago Maggiore"} apartment`,
    link,
    publishedAt: new Date().toISOString(),
    summary,
    fullSummary: pick.reason || summary,
    fetchedAt: new Date().toISOString(),
    propertyDigest: { ...pick, url: link, bedrooms, sqm, baths },
  };
};

const selectPropertyDigestNewsletterItems = (profile: NewsletterProfile) => {
  const snapshot = readPropertyDigestPreferences();
  const fromSnapshot = Array.isArray(snapshot?.newsletterPickSummary) ? snapshot.newsletterPickSummary : [];
  const allPicks = [...fromSnapshot, ...fallbackPropertyDigestPicks(snapshot)];
  const byId = new Map<string, PropertyDigestNewsletterPick>();
  allPicks.forEach((pick, index) => {
    const id = pick.id || `${pick.title}-${pick.town}-${index}`;
    if (!byId.has(id)) byId.set(id, { ...pick, id });
  });
  const targetCount = newsletterTargetCount(profile);
  return normalizePropertyDigestNewsletterTitles(diversifyPropertyDigestPicks(Array.from(byId.values()), targetCount))
    .map(propertyDigestPickToNewsletterItem);
};

const isPropertyDigestNewsletterItem = (item: NewsItem): item is PropertyDigestNewsletterItem =>
  Boolean((item as Partial<PropertyDigestNewsletterItem>).propertyDigest);

const matchesPublicAiInnovationBrief = (item: NewsItem) => {
  if (PUBLIC_BLOCKED_TOPICS.has(item.topic)) return false;
  if (!PUBLIC_ALLOWED_SOURCE_IDS.has(item.sourceId) && item.topic !== "ai") return false;
  const haystack = searchableNewsText(item);
  if (PUBLIC_BLOCKED_TERMS.some((term) => hasSearchTerm(haystack, term))) return false;
  return PUBLIC_ALLOWED_TERMS.some((term) => hasSearchTerm(haystack, term));
};

const crmEmailAccounts = () => {
  const base = [...ciaoCrmSeed.accounts];
  if (!base.some((account) => account.address === "newsletter@example.com")) {
    base.push({
      id: "newsletter@example.com",
      label: "newsletter@example.com",
      address: "newsletter@example.com",
      provider: "Cia Cia Ciao CRM",
      imapHost: "mail.example.com",
      smtpHost: "mail.example.com",
      connected: true,
      serverManaged: true,
      unread: 0,
      sentCount: 1,
      lastSync: new Date().toISOString(),
    });
  }
  return base;
};

const defaultNewsletterContactLists = (): NewsletterContactList[] => {
  const now = new Date().toISOString();
  const makeList = (id: string, name: string, description: string): NewsletterContactList => ({
    id,
    name,
    description,
    contacts: [],
    webhookEnabled: false,
    webhookToken: "",
    webhookEndpoint: "",
    createdAt: now,
    updatedAt: now,
  });
  return [
    makeList(PUBLIC_NEWS_LIST_ID, "Public AI list", "Public template audience. Add your own contacts locally."),
    makeList(SECOND_LIFE_NEWS_LIST_ID, "Second Life", "Public template fashion audience."),
    makeList(KAPRI_NEWS_LIST_ID, "Kapri List", "Public template campaign audience."),
    makeList(PROPERTY_DIGEST_NEWS_LIST_ID, "Property Digest", "Public template property audience."),
    makeList(ITALY_MOBILITY_NEWS_LIST_ID, "Italy Mobility & Strikes", "Public template mobility audience."),
  ];
};

const repairPublicNewsletterContacts = (list: NewsletterContactList) => {
  if (PUBLIC_RELEASE_MODE) return list;
  if (list.id !== PUBLIC_NEWS_LIST_ID) return list;
  const targetEmailKey = PUBLIC_TEMPLATE_NEWS_CONTACT.email.toLowerCase();
  const legacyEmailKeys = new Set(PUBLIC_TEMPLATE_LEGACY_EMAILS.map((email) => email.toLowerCase()));
  let changed = false;
  let existingPublicTemplateContact: NewsletterContact | null = null;
  const contacts = (list.contacts || []).filter((contact) => {
    const emailKey = contact.email.trim().toLowerCase();
    if (emailKey === targetEmailKey || legacyEmailKeys.has(emailKey)) {
      existingPublicTemplateContact = {
        ...existingPublicTemplateContact,
        ...contact,
        tags: Array.from(new Set([...(existingPublicTemplateContact?.tags || []), ...(contact.tags || [])])),
      };
      changed = true;
      return false;
    }
    return true;
  });
  const publicTemplateBase: NewsletterContact = existingPublicTemplateContact || { email: PUBLIC_TEMPLATE_NEWS_CONTACT.email };
  const repairedContact: NewsletterContact = {
    ...publicTemplateBase,
    ...PUBLIC_TEMPLATE_NEWS_CONTACT,
    tags: Array.from(new Set([...(publicTemplateBase.tags || []), ...(PUBLIC_TEMPLATE_NEWS_CONTACT.tags || [])])),
  };
  contacts.push(repairedContact);
  if (!existingPublicTemplateContact) changed = true;
  const repairedContacts = contacts.sort((a, b) => a.email.localeCompare(b.email));
  if (!changed && isSameJson(list.contacts, repairedContacts)) return list;
  return {
    ...list,
    contacts: repairedContacts,
    updatedAt: new Date().toISOString(),
  };
};

const normalizeNewsletterContactLists = (lists: NewsletterContactList[]) => {
  const valid = lists
    .filter((list) => list?.id && list?.name)
    .map((list) => {
      const token = list.webhookToken || createNewsletterWebhookToken();
      return {
        ...list,
        contacts: (list.contacts || []).filter((contact) => contact.email),
        description: list.description || "",
        webhookEnabled: Boolean(list.webhookEnabled),
        webhookToken: token,
        webhookEndpoint: list.webhookEndpoint || `/api/newsflow/newsletter-signup/${list.id}?token=${token}`,
        createdAt: list.createdAt || new Date().toISOString(),
        updatedAt: list.updatedAt || new Date().toISOString(),
      };
    });
  const byId = new Map(valid.map((list) => [list.id, list]));
  for (const fallback of defaultNewsletterContactLists()) {
    const existing = byId.get(fallback.id);
    if (!existing) {
      byId.set(fallback.id, fallback);
      continue;
    }
    if (fallback.id === PUBLIC_NEWS_LIST_ID && existing.name === "Public AI News") {
      byId.set(fallback.id, {
        ...existing,
        name: "Public AI list",
        contacts: mergeNewsletterContacts(existing.contacts || [], fallback.contacts),
        updatedAt: new Date().toISOString(),
      });
      continue;
    }
    if ([PUBLIC_NEWS_LIST_ID, SECOND_LIFE_NEWS_LIST_ID, KAPRI_NEWS_LIST_ID, PROPERTY_DIGEST_NEWS_LIST_ID, ITALY_MOBILITY_NEWS_LIST_ID].includes(fallback.id)) {
      byId.set(fallback.id, {
        ...existing,
        contacts: mergeNewsletterContacts(existing.contacts || [], fallback.contacts),
        updatedAt: new Date().toISOString(),
      });
    }
  }
  const repairedLists = Array.from(byId.values()).map(repairPublicNewsletterContacts);
  localStorage.setItem(NEWSLETTER_CONTACT_REPAIR_KEY, NEWSLETTER_CONTACT_REPAIR_VERSION);
  return repairedLists;
};

const newsletterContactListsFromStorage = () => {
  const rawLists = safeJsonParse<NewsletterContactList[]>(NEWSLETTER_CONTACT_LISTS_KEY, []);
  const normalizedLists = normalizeNewsletterContactLists(rawLists);
  if (!isSameJson(rawLists, normalizedLists)) {
    saveJson(NEWSLETTER_CONTACT_LISTS_KEY, normalizedLists);
  }
  return normalizedLists;
};

const newsletterWebhookUrl = (list: NewsletterContactList) => {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  return `${origin}/api/newsflow/newsletter-signup/${encodeURIComponent(list.id)}?token=${encodeURIComponent(list.webhookToken)}`;
};

type NewsletterWebhookQueueItem = NewsletterContact & {
  listId: string;
  token?: string;
  source?: string;
  createdAt: string;
};

type LocalCrmContact = {
  id?: string;
  name?: string;
  email?: string;
  company?: string;
  role?: string;
  phone?: string;
  notes?: string;
  labels?: string[];
  listIds?: string[];
};

type LocalCrmContactList = {
  id: string;
  name: string;
  description?: string;
};

const localCrmContactsFromStorage = () =>
  safeJsonParse<LocalCrmContact[]>(LOCAL_CRM_CONTACTS_KEY, ciaoCrmSeed.contacts as LocalCrmContact[]).filter((contact) => contact.email);

const localCrmListsFromStorage = () =>
  safeJsonParse<LocalCrmContactList[]>(LOCAL_CRM_LISTS_KEY, []).filter((list) => list.id && list.name);

const crmListContactCount = (list: LocalCrmContactList, contacts = localCrmContactsFromStorage()) =>
  contacts.filter((contact) =>
    (contact.listIds || []).includes(list.id) ||
    (contact.labels || []).some((label) => label.toLowerCase() === list.name.toLowerCase())
  ).length;

const crmRecipientLists = (customLists = newsletterContactListsFromStorage()) => {
  const contacts = localCrmContactsFromStorage();
  const localLists = localCrmListsFromStorage();
  const labelNames = Array.from(new Set(contacts.flatMap((contact) => contact.labels || []))).filter(Boolean);
  return [
    ...normalizeNewsletterContactLists(customLists).map((list) => ({
    id: `list:${list.id}`,
    label: list.name,
    count: list.contacts.length,
    description: list.description,
    })),
    { id: "all", label: "All CRM contacts", count: contacts.length, description: "Every CRM contact with an email address." },
    ...localLists.map((list) => ({
      id: `crm_list:${list.id}`,
      label: list.name,
      count: crmListContactCount(list, contacts),
      description: list.description || "Cia Cia Ciao CRM list",
    })),
    ...labelNames.map((label) => ({
      id: `label:${label}`,
      label,
      count: contacts.filter((contact) => (contact.labels || []).includes(label)).length,
      description: "Imported CRM label",
    })),
  ].filter((list, index, all) => all.findIndex((item) => item.id === list.id) === index);
};

const normalizeNewsletterSendTimes = (times: string[], fallback = "00:00") => {
  const clean = Array.from(new Set(times
    .map((time) => time.trim())
    .filter((time) => {
      if (!/^\d{2}:\d{2}$/.test(time)) return false;
      const [hour, minute] = time.split(":").map(Number);
      return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
    })));
  return (clean.length ? clean : [fallback]).sort();
};

const normalizeNewsletterWeekdays = (weekdays?: number[]) =>
  Array.from(
    new Set(
      (Array.isArray(weekdays) ? weekdays : [])
        .map(Number)
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
    ),
  );

const normalizeNewsletterSendSchedule = (schedule?: NewsletterProfile["sendSchedule"]) =>
  Array.from(
    new Map(
      (Array.isArray(schedule) ? schedule : [])
        .map((entry) => ({
          weekday: Number(entry.weekday),
          time: normalizeNewsletterSendTimes([String(entry.time || "")], "00:00")[0] || "00:00",
        }))
        .filter((entry) => Number.isInteger(entry.weekday) && entry.weekday >= 0 && entry.weekday <= 6 && Boolean(entry.time))
        .map((entry) => [`${entry.weekday}-${entry.time}`, entry] as const),
    ).values(),
  );

const normalizeNewsletterProfile = (profile: Partial<NewsletterProfile>): NewsletterProfile => {
  const fallback = defaultNewsletterProfile();
  const next = { ...fallback, ...profile };
  const oldCrmSelection = !next.crmList || next.crmList === "all" || next.crmList.startsWith("label:");
  const allowedTopicIds = new Set(NEWS_RESEARCH_FILTERS.map((filter) => filter.id));
  const topicFilters = Array.from(new Set([
    ...(Array.isArray(next.topicFilters) ? next.topicFilters : []),
    next.topicFilter,
  ].filter((topic): topic is string => Boolean(topic) && allowedTopicIds.has(topic))));
  const normalizedTopicFilters = topicFilters.length ? topicFilters : ["ai-labs"];
  const customInterests = Array.from(new Set((next.customInterests || [])
    .map((interest) => interest.trim())
    .filter(Boolean)));
  const sendTimes = normalizeNewsletterSendTimes([
    ...(Array.isArray(next.sendTimes) ? next.sendTimes : []),
    next.sendTime,
  ].filter(Boolean));
  const sendWeekdays = normalizeNewsletterWeekdays(next.sendWeekdays);
  const sendSchedule = normalizeNewsletterSendSchedule(next.sendSchedule);
  const scheduleTimes = Array.from(new Set(sendSchedule.map((entry) => entry.time)));
  const effectiveSendTimes = scheduleTimes.length ? scheduleTimes : sendTimes;
  return {
    ...next,
    topicFilter: normalizedTopicFilters[0],
    topicFilters: normalizedTopicFilters,
    customInterests,
    sendTime: effectiveSendTimes[0],
    sendTimes: effectiveSendTimes,
    sendWeekdays,
    sendSchedule,
    crmList: oldCrmSelection ? `list:${PUBLIC_NEWS_LIST_ID}` : next.crmList,
    fontFamily: next.fontFamily || DEFAULT_NEWSLETTER_FONT,
  };
};

const canonicalNewsletterProfile = (profile: NewsletterProfile): NewsletterProfile => {
  const identity = `${profile.id} ${profile.name} ${profile.title}`.toLowerCase();
  const isItalyMobility = profile.id === ITALY_MOBILITY_NEWSLETTER_PROFILE_ID || identity.includes("mobility") || identity.includes("scioper");
  const isKapricorn = profile.id === "newsletter_kapricorn_leaflet" || identity.includes("kapricorn") || identity.includes("bar weekly");
  const isFashion = profile.id === "newsletter_second_life_fashion_daily" || identity.includes("second life") || identity.includes("fashion");
  const isPublic = profile.id === "newsletter_public_ai_daily" || identity.includes("public") || identity.includes("ai daily") || identity.includes("ai brief");

  if (isItalyMobility) return normalizeNewsletterProfile({ ...defaultItalyMobilityNewsletterProfile(), ...profile });
  if (isKapricorn) return normalizeNewsletterProfile({ ...defaultKapricornNewsletterProfile(), ...profile });
  if (isFashion) return normalizeNewsletterProfile({ ...defaultFashionNewsletterProfile(), ...profile });
  if (isPublic) return normalizeNewsletterProfile({ ...defaultNewsletterProfile(), ...profile });
  return normalizeNewsletterProfile(profile);
};

const normalizeNewsletterProfiles = (profiles: NewsletterProfile[]) => {
  const normalized = profiles.map(normalizeNewsletterProfile);
  const upgraded = normalized.map((profile) => {
    const isLegacyAi =
      profile.id === "newsletter_public_ai_daily" ||
      profile.name === "Daily AI Brief" ||
      profile.title === "Public AI Daily Brief";
    const isFashion =
      profile.id === "newsletter_second_life_fashion_daily" ||
      /second life/i.test(profile.name || "") ||
      /fashion/i.test(profile.name || "") ||
      /fashion/i.test(profile.title || "");
    const isKapricorn =
      profile.id === "newsletter_kapricorn_leaflet" ||
      /kapricorn/i.test(profile.name || "") ||
      /kapricorn/i.test(profile.title || "");
    const isPropertyDigest =
      profile.id === PROPERTY_DIGEST_NEWSLETTER_PROFILE_ID ||
      /ricerca casa al lago/i.test(profile.name || "") ||
      /ricerca casa al lago/i.test(profile.title || "") ||
      /lakehouse/i.test(profile.name || "") ||
      /lakehouse/i.test(profile.title || "");
    const isItalyMobility =
      profile.id === ITALY_MOBILITY_NEWSLETTER_PROFILE_ID ||
      /mobility/i.test(profile.name || "") ||
      /scioper/i.test(`${profile.name || ""} ${profile.title || ""}`);
    if (isItalyMobility) {
      const fallback = defaultItalyMobilityNewsletterProfile();
      return {
        ...fallback,
        ...profile,
        id: fallback.id,
        name: fallback.name,
        title: fallback.title,
        topicFilter: fallback.topicFilter,
        topicFilters: fallback.topicFilters,
        customInterests: Array.from(new Set([...(profile.customInterests || []), ...fallback.customInterests])),
        sendTime: profile.sendTime || fallback.sendTime,
        sendTimes: profile.sendTimes?.length ? profile.sendTimes : fallback.sendTimes,
        sendWeekdays: profile.sendWeekdays?.length ? profile.sendWeekdays : fallback.sendWeekdays,
        sendSchedule: profile.sendSchedule?.length ? profile.sendSchedule : fallback.sendSchedule,
        crmList: `list:${ITALY_MOBILITY_NEWS_LIST_ID}`,
        enabled: profile.enabled,
        topCount: Math.max(8, profile.topCount || fallback.topCount),
        signature: profile.signature || fallback.signature,
        footprint: profile.footprint || fallback.footprint,
        templateName: fallback.templateName,
        headerBgColor: profile.headerBgColor || fallback.headerBgColor,
        headerTextColor: profile.headerTextColor || fallback.headerTextColor,
        footerBgColor: profile.footerBgColor || fallback.footerBgColor,
        footerTextColor: profile.footerTextColor || fallback.footerTextColor,
        accentColor: profile.accentColor || fallback.accentColor,
        bodyBgColor: profile.bodyBgColor || fallback.bodyBgColor,
        fontFamily: profile.fontFamily || fallback.fontFamily,
      };
    }
    if (isPropertyDigest) {
      const fallback = defaultPropertyDigestNewsletterProfile();
      return {
        ...fallback,
        ...profile,
        id: fallback.id,
        name: fallback.name,
        title: fallback.title,
        intro: profile.intro && !/10 migliori case trovate oggi/i.test(profile.intro) ? profile.intro : fallback.intro,
        topicFilter: fallback.topicFilter,
        topicFilters: fallback.topicFilters,
        customInterests: Array.from(new Set([...(profile.customInterests || []), ...fallback.customInterests])),
        sendTime: profile.sendTime || fallback.sendTime,
        sendTimes: profile.sendTimes?.length ? profile.sendTimes : fallback.sendTimes,
        sendWeekdays: profile.sendWeekdays?.length ? profile.sendWeekdays : fallback.sendWeekdays,
        sendSchedule: profile.sendSchedule?.length ? profile.sendSchedule : fallback.sendSchedule,
        crmList: `list:${PROPERTY_DIGEST_NEWS_LIST_ID}`,
        enabled: profile.enabled,
        topCount: 10,
        signature: profile.signature || fallback.signature,
        footprint: profile.footprint || fallback.footprint,
        templateName: fallback.templateName,
        headerBgColor: profile.headerBgColor || fallback.headerBgColor,
        headerTextColor: profile.headerTextColor || fallback.headerTextColor,
        footerBgColor: profile.footerBgColor || fallback.footerBgColor,
        footerTextColor: profile.footerTextColor || fallback.footerTextColor,
        accentColor: profile.accentColor || fallback.accentColor,
        bodyBgColor: profile.bodyBgColor || fallback.bodyBgColor,
        fontFamily: profile.fontFamily || fallback.fontFamily,
      };
    }
    if (isKapricorn) {
      const fallback = defaultKapricornNewsletterProfile();
      return {
        ...fallback,
        ...profile,
        id: fallback.id,
        name: fallback.name,
        title: !profile.title || /Kapricorn Table Leaflet/i.test(profile.title) ? fallback.title : profile.title,
        intro: profile.intro && !/Kapricorn crew, here is the bar leaflet/i.test(profile.intro) ? profile.intro : fallback.intro,
        topicFilter: "kapricorn",
        topicFilters: fallback.topicFilters,
        sendTime: profile.sendTime || fallback.sendTime,
        sendTimes: profile.sendTimes?.length ? profile.sendTimes : fallback.sendTimes,
        sendWeekdays: profile.sendWeekdays?.length ? profile.sendWeekdays : fallback.sendWeekdays,
        sendSchedule: profile.sendSchedule?.length ? profile.sendSchedule : fallback.sendSchedule,
        crmList: `list:${KAPRI_NEWS_LIST_ID}`,
        enabled: profile.enabled,
        agentStatus: profile.agentStatus,
        topCount: Math.max(3, profile.topCount || 3),
        signature: profile.signature || fallback.signature,
        footprint: profile.footprint || fallback.footprint,
        templateName: fallback.templateName,
        headerBgColor: profile.headerBgColor || fallback.headerBgColor,
        headerTextColor: profile.headerTextColor || fallback.headerTextColor,
        footerBgColor: profile.footerBgColor || fallback.footerBgColor,
        footerTextColor: profile.footerTextColor || fallback.footerTextColor,
        accentColor: profile.accentColor || fallback.accentColor,
        bodyBgColor: profile.bodyBgColor || fallback.bodyBgColor,
        fontFamily: profile.fontFamily || fallback.fontFamily,
      };
    }
    if (isFashion) {
      const fallback = defaultFashionNewsletterProfile();
      const title = !profile.title || /public ai/i.test(profile.title) ? fallback.title : profile.title;
      return {
        ...fallback,
        ...profile,
        id: fallback.id,
        name: fallback.name,
        title,
        intro: profile.intro && !/Public AI lovers/i.test(profile.intro) ? profile.intro : fallback.intro,
        topicFilter: "fashion-industry",
        topicFilters: ["fashion-industry"],
        sendTime: profile.sendTime || fallback.sendTime,
        sendTimes: profile.sendTimes?.length ? profile.sendTimes : fallback.sendTimes,
        sendWeekdays: profile.sendWeekdays?.length ? profile.sendWeekdays : fallback.sendWeekdays,
        sendSchedule: profile.sendSchedule?.length ? profile.sendSchedule : fallback.sendSchedule,
        crmList: `list:${SECOND_LIFE_NEWS_LIST_ID}`,
        enabled: profile.enabled,
        topCount: Math.max(10, profile.topCount || 10),
        signature: profile.signature || fallback.signature,
        footprint: profile.footprint && !/privatebrand/i.test(profile.footprint) ? profile.footprint : fallback.footprint,
        templateName: fallback.templateName,
        headerBgColor: profile.headerBgColor || fallback.headerBgColor,
        headerTextColor: profile.headerTextColor || fallback.headerTextColor,
        footerBgColor: profile.footerBgColor || fallback.footerBgColor,
        footerTextColor: profile.footerTextColor || fallback.footerTextColor,
        accentColor: profile.accentColor || fallback.accentColor,
        bodyBgColor: profile.bodyBgColor || fallback.bodyBgColor,
        fontFamily: profile.fontFamily || fallback.fontFamily,
      };
    }
    if (!isLegacyAi) return profile;
    const fallback = defaultNewsletterProfile();
    return {
      ...fallback,
      ...profile,
      id: fallback.id,
      name: fallback.name,
      topicFilter: "ai",
      topicFilters: PUBLIC_TOPIC_FILTERS,
      customInterests: PUBLIC_CUSTOM_INTERESTS,
      sendTime: profile.sendTime || fallback.sendTime,
      sendTimes: profile.sendTimes?.length ? profile.sendTimes : fallback.sendTimes,
      sendWeekdays: profile.sendWeekdays?.length ? profile.sendWeekdays : fallback.sendWeekdays,
      sendSchedule: profile.sendSchedule?.length ? profile.sendSchedule : fallback.sendSchedule,
      crmList: `list:${PUBLIC_NEWS_LIST_ID}`,
      enabled: profile.enabled,
      topCount: Math.max(10, profile.topCount || 10),
      templateName: fallback.templateName,
      headerBgColor: profile.headerBgColor || fallback.headerBgColor,
      headerTextColor: profile.headerTextColor || fallback.headerTextColor,
      footerBgColor: profile.footerBgColor || fallback.footerBgColor,
      footerTextColor: profile.footerTextColor || fallback.footerTextColor,
      accentColor: profile.accentColor || fallback.accentColor,
      bodyBgColor: profile.bodyBgColor || fallback.bodyBgColor,
      fontFamily: profile.fontFamily || fallback.fontFamily,
      signature: !profile.signature || /PocketFlow Press/i.test(profile.signature) ? fallback.signature : profile.signature,
      footprint: profile.footprint || fallback.footprint,
    };
  });
  const byId = new Map<string, NewsletterProfile>();
  for (const profile of upgraded.map(canonicalNewsletterProfile)) {
    byId.set(profile.id, profile);
  }
  for (const fallback of defaultNewsletterProfiles().map(canonicalNewsletterProfile)) {
    byId.set(fallback.id, { ...fallback, ...(byId.get(fallback.id) || fallback) });
  }
  const orderedIds = [
    PROPERTY_DIGEST_NEWSLETTER_PROFILE_ID,
    ITALY_MOBILITY_NEWSLETTER_PROFILE_ID,
    "newsletter_public_ai_daily",
    "newsletter_second_life_fashion_daily",
    "newsletter_kapricorn_leaflet",
  ];
  return [
    ...orderedIds.map((id) => byId.get(id)).filter((profile): profile is NewsletterProfile => Boolean(profile)),
    ...Array.from(byId.values()).filter((profile) => !orderedIds.includes(profile.id)),
  ];
};

const newsletterAudienceCount = (crmList: string, customLists = newsletterContactListsFromStorage()) => {
  if (crmList.startsWith("list:")) {
    const listId = crmList.slice(5);
    return normalizeNewsletterContactLists(customLists).find((list) => list.id === listId)?.contacts.length || 0;
  }
  const contacts = localCrmContactsFromStorage();
  if (crmList.startsWith("crm_list:")) {
    const listId = crmList.slice(9);
    const list = localCrmListsFromStorage().find((item) => item.id === listId);
    return list ? crmListContactCount(list, contacts) : 0;
  }
  if (crmList === "all") return contacts.length;
  if (crmList.startsWith("label:")) {
    const label = crmList.slice(6);
    return contacts.filter((contact) => (contact.labels || []).includes(label)).length;
  }
  return 0;
};

type NewsletterRecipient = {
  name?: string;
  email: string;
};

type NewsletterDeliveryResult = {
  ok: boolean;
  sent: number;
  endpoint?: string;
  message: string;
  failureKind?: "transport" | "recipient" | "configuration";
};

const normalizeEmail = (email?: string) => (email || "").trim().toLowerCase();

const extractEmail = (value: string) =>
  value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0].toLowerCase() || "";

const isNewsletterDeliverableEmail = (email?: string) => {
  const normalized = normalizeEmail(email);
  return Boolean(normalized && extractEmail(normalized) === normalized);
};

const crmContactSearchText = (contact: LocalCrmContact) =>
  [
    contact.name,
    contact.email,
    contact.company,
    contact.role,
    contact.phone,
    contact.notes,
    ...(contact.labels || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const dedupeNewsletterRecipients = (contacts: NewsletterRecipient[]) => {
  const byEmail = new Map<string, NewsletterRecipient>();
  contacts.forEach((contact) => {
    const email = normalizeEmail(contact.email);
    if (!isNewsletterDeliverableEmail(email) || byEmail.has(email)) return;
    byEmail.set(email, { ...contact, email });
  });
  return Array.from(byEmail.values());
};

const newsletterRecipients = (crmList: string, customLists = newsletterContactListsFromStorage()) => {
  if (crmList.startsWith("list:")) {
    const listId = crmList.slice(5);
    const list = normalizeNewsletterContactLists(customLists).find((item) => item.id === listId);
    return dedupeNewsletterRecipients(list?.contacts || []);
  }

  const contacts = localCrmContactsFromStorage();
  if (crmList.startsWith("crm_list:")) {
    const listId = crmList.slice(9);
    const list = localCrmListsFromStorage().find((item) => item.id === listId);
    if (!list) return [];
    return dedupeNewsletterRecipients(
      contacts
        .filter((contact) =>
          (contact.listIds || []).includes(list.id) ||
          (contact.labels || []).some((label) => label.toLowerCase() === list.name.toLowerCase())
        )
        .map((contact) => ({ name: contact.name, email: contact.email || "" }))
    );
  }

  if (crmList === "all") {
    return dedupeNewsletterRecipients(contacts.map((contact) => ({ name: contact.name, email: contact.email || "" })));
  }

  if (crmList.startsWith("label:")) {
    const label = crmList.slice(6);
    return dedupeNewsletterRecipients(
      contacts
        .filter((contact) => (contact.labels || []).includes(label))
        .map((contact) => ({ name: contact.name, email: contact.email || "" }))
    );
  }

  return [];
};

const newsletterRelayCandidates = () => {
  if (PUBLIC_RELEASE_MODE) return [];
  const candidates = new Set<string>();
  const nativeShell = typeof window !== "undefined" && (window.__pocketflowNativeShell || window.PocketFlowReceiveBridge);
  const isBadPhoneRelayHost = (value: string, allowNativeLoopback = false) => {
    try {
      const parsed = new URL(value);
      return (
        nativeShell &&
        !allowNativeLoopback &&
        (parsed.hostname === "localhost" ||
          parsed.hostname === "127.0.0.1" ||
          parsed.hostname === "::1" ||
          parsed.hostname === "pocketflow.local")
      );
    } catch {
      return true;
    }
  };
  const add = (value?: string | null, options: { allowNativeLoopback?: boolean } = {}) => {
    const clean = (value || "").trim().replace(/\/+$/, "");
    if (clean && !isBadPhoneRelayHost(clean, options.allowNativeLoopback)) candidates.add(clean);
  };
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    if (hostname) add(`${protocol}//${hostname}:8788`);
  }
  // Prefer the reachable LAN relay while the phone is on the same Wi-Fi.
  // Dead Secure Mesh candidates can otherwise delay every campaign by several
  // bridge timeouts before the working route is attempted.
          if (typeof window !== "undefined") {
    add(localStorage.getItem("pocketflow.codexRelay.endpoint"), { allowNativeLoopback: true });
  }
  if (!nativeShell) {
    add("http://127.0.0.1:8788");
    add("http://localhost:8788");
  }
  return Array.from(candidates);
};

const newsletterHtmlToText = (html: string) =>
  stripText(html)
    .replace(/\s*Read source\s*/gi, "\nRead source\n")
    .replace(/\s*Read full source\s*/gi, "\nRead full source\n")
    .replace(/\s*Apri annuncio\s*/gi, "\nApri annuncio\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const sendNewsletterBatchToCrm = async (
  profile: NewsletterProfile,
  batch: ReturnType<typeof buildNewsletterBatch>,
): Promise<NewsletterDeliveryResult> => {
  if (PUBLIC_RELEASE_MODE) {
    return {
      ok: false,
      sent: 0,
      failureKind: "configuration",
      message: "Public release mode: newsletter delivery bridge is disabled. Configure your own CRM/send adapter before sending.",
    };
  }
  const recipients = newsletterRecipients(profile.crmList);
  if (!recipients.length) {
    return {
      ok: false,
      sent: 0,
      failureKind: "recipient",
      message: `No recipients found for ${newsletterListLabel(profile.crmList)}.`,
    };
  }

  const recipientEmails = recipients.map((recipient) => recipient.email);
  const buildPayload = (to: string) => ({
    accountId: profile.fromAccount,
    from: profile.fromAccount,
    to,
    subject: batch.subject,
    body: newsletterHtmlToText(batch.html),
    html: batch.html,
  });

  let nativeBridgeMessage = "";
  if (window.PocketFlowReceiveBridge?.crmSendEmail) {
    try {
      let acceptedCount = 0;
      const failures: string[] = [];
      for (const email of recipientEmails) {
        const result = await window.PocketFlowReceiveBridge.crmSendEmail(buildPayload(email));
        const bridgeResult = result as {
          ok?: boolean;
          message?: string;
          accepted?: unknown[];
          rejected?: unknown[];
          error?: { message?: string };
        } | null | undefined;
        if (bridgeResult?.ok === true) {
          acceptedCount += Array.isArray(bridgeResult.accepted) && bridgeResult.accepted.length ? bridgeResult.accepted.length : 1;
          continue;
        }
        failures.push(`${email}: ${bridgeResult?.message || bridgeResult?.error?.message || "Native CRM bridge returned ok=false."}`);
      }
      if (acceptedCount > 0) {
        return {
          ok: true,
          sent: acceptedCount,
          endpoint: "native-crm-bridge",
          message: failures.length
            ? `Sent ${batch.subject} to ${acceptedCount} recipient${acceptedCount === 1 ? "" : "s"} through the phone CRM bridge. Failed: ${failures.join("; ")}`
            : `Sent ${batch.subject} to ${acceptedCount} recipient${acceptedCount === 1 ? "" : "s"} through the phone CRM bridge.`,
        };
      }
      nativeBridgeMessage = failures.join("; ") || "Native CRM bridge returned ok=false.";
    } catch (error) {
      nativeBridgeMessage = error instanceof Error ? error.message : String(error);
    }
  } else if (window.__pocketflowNativeShell) {
    nativeBridgeMessage = "Native CRM bridge is not exposed in this PocketFlow shell.";
  }

  let lastMessage = "CRM relay unavailable.";
  for (const endpoint of newsletterRelayCandidates()) {
    const url = `${endpoint}/crm/send`;
    try {
      const isMixedHttpFromHttps = typeof window !== "undefined" && window.location.protocol === "https:" && url.startsWith("http:");
      if (isMixedHttpFromHttps && !window.PocketFlowReceiveBridge?.httpJsonPost) {
        lastMessage = `${endpoint} skipped because Android blocks insecure relay calls from PocketFlow HTTPS.`;
        continue;
      }

      let acceptedCount = 0;
      const failures: string[] = [];
      for (const email of recipientEmails) {
        const payload = buildPayload(email);
        const result = isMixedHttpFromHttps && window.PocketFlowReceiveBridge?.httpJsonPost
          ? await window.PocketFlowReceiveBridge.httpJsonPost(url, JSON.stringify(payload), JSON.stringify({ "Content-Type": "application/json" }))
          : await (async () => {
              const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              const body = await response.json().catch(() => ({}));
              return {
                ok: response.ok && body?.ok,
                status: response.status,
                body: JSON.stringify(body),
                message: body?.message || `HTTP ${response.status}`,
              };
            })();
        const parsedBody = typeof result.body === "string" ? JSON.parse(result.body || "{}") : {};
        if (result.ok && parsedBody?.ok !== false) {
          acceptedCount += Array.isArray(parsedBody?.accepted) && parsedBody.accepted.length ? parsedBody.accepted.length : 1;
          continue;
        }
        failures.push(`${email}: ${parsedBody?.message || result?.message || `HTTP ${result?.status || "no status"}`}`);
      }

      if (acceptedCount > 0) {
        try {
          localStorage.setItem("pocketflow.codexRelay.endpoint", endpoint);
        } catch {
          // Best effort: successful relay should be retried first on future mobile wakes.
        }
        return {
          ok: true,
          sent: acceptedCount,
          endpoint,
          message: failures.length
            ? `Sent ${batch.subject} to ${acceptedCount} recipient${acceptedCount === 1 ? "" : "s"}. Failed: ${failures.join("; ")}`
            : `Sent ${batch.subject} to ${acceptedCount} recipient${acceptedCount === 1 ? "" : "s"}.`,
        };
      }
      lastMessage = `${endpoint}: ${failures.join("; ") || "No recipients accepted."}`;
    } catch (error) {
      lastMessage = `${endpoint}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return {
    ok: false,
    sent: 0,
    failureKind: classifyNewsletterDeliveryFailure(nativeBridgeMessage ? `${lastMessage} ${nativeBridgeMessage}` : lastMessage),
    message: nativeBridgeMessage ? `Relay failed: ${lastMessage}. Native CRM bridge failed: ${nativeBridgeMessage}.` : lastMessage,
  };
};

const newsletterTopicLabel = (topicFilter: string) =>
  NEWS_RESEARCH_FILTERS.find((filter) => filter.id === topicFilter)?.label || "Custom feed";

const newsletterTopicIds = (profile: NewsletterProfile) =>
  normalizeNewsletterProfile(profile).topicFilters;

const newsletterTopicSummary = (profile: NewsletterProfile) => {
  const labels = newsletterTopicIds(profile).map(newsletterTopicLabel);
  const interests = profile.customInterests || [];
  return [...labels, ...interests].filter(Boolean).join(", ") || "General";
};

const NEWSLETTER_WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const newsletterSendTimes = (profile: NewsletterProfile) =>
  normalizeNewsletterProfile(profile).sendTimes;

const newsletterSendTimesForDate = (profile: NewsletterProfile, date: Date) => {
  const normalized = normalizeNewsletterProfile(profile);
  const weekday = date.getDay();
  if (normalized.sendSchedule?.length) {
    return normalized.sendSchedule
      .filter((slot) => slot.weekday === weekday)
      .map((slot) => slot.time);
  }
  if (normalized.sendWeekdays?.length && !normalized.sendWeekdays.includes(weekday)) return [];
  return normalized.sendTimes;
};

const newsletterSendTimeSummary = (profile: NewsletterProfile) => {
  const normalized = normalizeNewsletterProfile(profile);
  if (normalized.sendSchedule?.length) {
    return normalized.sendSchedule
      .map((slot) => `${NEWSLETTER_WEEKDAY_LABELS[slot.weekday] || "Day"} ${slot.time}`)
      .join(", ");
  }
  const weekdayPrefix = normalized.sendWeekdays?.length
    ? `${normalized.sendWeekdays.map((day) => NEWSLETTER_WEEKDAY_LABELS[day] || "Day").join("/")} `
    : "";
  return `${weekdayPrefix}${normalized.sendTimes.join(", ")}`;
};

const splitInterestText = (value: string) =>
  Array.from(new Set(value
    .split(/[\n,;]+/)
    .map((interest) => interest.trim())
    .filter(Boolean)));

const matchesNewsletterInterest = (item: NewsItem, profile: NewsletterProfile) => {
  const topicMatch = newsletterTopicIds(profile).some((topic) => matchesResearchFilter(item, topic));
  if (topicMatch) return true;
  const interests = profile.customInterests || [];
  if (!interests.length) return false;
  const text = searchableNewsText(item);
  return interests.some((interest) => hasSearchTerm(text, interest));
};

const newsletterListLabel = (crmList: string, customLists = newsletterContactListsFromStorage()) => {
  if (crmList.startsWith("list:")) {
    const listId = crmList.slice(5);
    return normalizeNewsletterContactLists(customLists).find((list) => list.id === listId)?.name || "Public AI News";
  }
  if (crmList.startsWith("crm_list:")) {
    const listId = crmList.slice(9);
    return localCrmListsFromStorage().find((list) => list.id === listId)?.name || "CRM list";
  }
  if (crmList === "all") return "All CRM contacts";
  if (crmList.startsWith("label:")) return crmList.slice(6);
  return crmList;
};

const newsletterSlotKey = (profileId: string, phase: string, date = new Date(), slot = "default") =>
  `${profileId}:${phase}:${slot}:${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const newsletterTimestampMs = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const newsletterIsoFromValue = (value: unknown) => {
  const ms = newsletterTimestampMs(value);
  return ms ? new Date(ms).toISOString() : "";
};

const isSameNewsletterDay = (value: unknown, day: Date) => {
  const ms = newsletterTimestampMs(value);
  if (!ms) return false;
  const date = new Date(ms);
  return (
    date.getFullYear() === day.getFullYear() &&
    date.getMonth() === day.getMonth() &&
    date.getDate() === day.getDate()
  );
};

const newsletterSlotHasSentBatch = (
  outbox: Array<Record<string, unknown>>,
  profileId: string,
  sendTime: string,
  day = new Date(),
) =>
  outbox.some(
    (entry) =>
      entry.profileId === profileId &&
      (entry.sendTime === sendTime || !entry.sendTime) &&
      entry.status === "sent_to_crm" &&
      isSameNewsletterDay(entry.sentAt || entry.createdAt, day),
  );

const isNewsletterContentWait = (batch?: { status?: string; deliveryError?: string; items?: unknown[] }) => {
  if (!batch) return false;
  const errorText = String(batch.deliveryError || "").toLowerCase();
  return (
    batch.status === "waiting_for_news" ||
    batch.status === "waiting_for_properties" ||
    errorText.includes("no matching stories") ||
    errorText.includes("no matching apartments") ||
    errorText.includes("matching stories ready") ||
    errorText.includes("pull feed again") ||
    errorText.includes("add more sources") ||
    (batch.status === "send_failed" && Array.isArray(batch.items) && batch.items.length === 0)
  );
};

const newsletterFailedAttemptsForSlot = (
  outbox: Array<Record<string, unknown>>,
  profileId: string,
  sendTime: string,
  day = new Date(),
) => outbox.filter(
  (entry) =>
    entry.profileId === profileId &&
    (entry.sendTime === sendTime || !entry.sendTime) &&
    entry.status === "send_failed" &&
    isSameNewsletterDay(entry.failedAt || entry.createdAt, day),
).length;

type NewsletterDeliveryFailureKind = "transport" | "recipient" | "configuration";

type NewsletterCampaignAudit = {
  profileId: string;
  total: number;
  sent: number;
  failed: number;
  waiting: number;
  transportFailures: number;
  recipientFailures: number;
  configurationFailures: number;
  invalidContacts: Array<{ listId: string; listName: string; email: string; name?: string }>;
  repeatedRecipientFailures: Array<{ email: string; count: number; reason: string }>;
  lastFailureReason: string;
};

const classifyNewsletterDeliveryFailure = (message?: string): NewsletterDeliveryFailureKind => {
  const text = String(message || "").toLowerCase();
  if (
    /no recipients found|invalid recipient|recipient validation|mailbox unavailable|user unknown|address rejected|recipient address|5\.1\.1|550|551|553/.test(text)
  ) {
    return "recipient";
  }
  if (/not configured|missing account|missing smtp|smtp auth|authentication|invalid credentials|no sender|from account/.test(text)) {
    return "configuration";
  }
  return "transport";
};

const newsletterFailureRows = (message?: string) =>
  String(message || "")
    .split(/;\s*|\n+/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => ({
      email: extractEmail(row),
      reason: row.replace(/^Failed:\s*/i, "").trim(),
      kind: classifyNewsletterDeliveryFailure(row),
    }))
    .filter((row) => row.email);

const compactNewsletterOutbox = (outbox: Array<Record<string, unknown>>) => {
  const failedCounts = new Map<string, number>();
  return outbox.filter((entry) => {
    if (entry.status !== "send_failed") return true;
    const day = newsletterIsoFromValue(entry.failedAt || entry.createdAt).slice(0, 10) || "unknown-day";
    const key = `${String(entry.profileId || "unknown-profile")}:${String(entry.sendTime || "default")}:${day}`;
    const count = failedCounts.get(key) || 0;
    if (count >= NEWSLETTER_MAX_RETRIES_PER_SLOT) return false;
    failedCounts.set(key, count + 1);
    return true;
  });
};

const buildNewsletterCampaignAudit = (
  profile: NewsletterProfile | undefined,
  batches: Array<Record<string, unknown>>,
  contactLists: NewsletterContactList[],
): NewsletterCampaignAudit => {
  const listId = profile?.crmList?.startsWith("list:") ? profile.crmList.slice(5) : "";
  const list = listId ? contactLists.find((entry) => entry.id === listId) : null;
  const invalidContacts = (list?.contacts || [])
    .filter((contact) => !isNewsletterDeliverableEmail(contact.email))
    .map((contact) => ({
      listId: list?.id || "",
      listName: list?.name || "Campaign list",
      email: contact.email,
      name: contact.name,
    }));
  const repeatedFailures = new Map<string, { count: number; reason: string }>();

  type NewsletterAuditSummary = Omit<NewsletterCampaignAudit, "profileId" | "invalidContacts" | "repeatedRecipientFailures">;
  const summary = batches.reduce<NewsletterAuditSummary>(
    (acc, batch) => {
      const status = String(batch.status || "");
      if (status === "sent_to_crm") acc.sent += 1;
      if (/waiting/i.test(status)) acc.waiting += 1;
      if (status !== "send_failed") return acc;
      acc.failed += 1;
      const failureText = String(batch.deliveryError || "");
      const failureKind = (batch.deliveryFailureKind as NewsletterDeliveryFailureKind | undefined) || classifyNewsletterDeliveryFailure(failureText);
      if (failureKind === "recipient") acc.recipientFailures += 1;
      else if (failureKind === "configuration") acc.configurationFailures += 1;
      else acc.transportFailures += 1;
      acc.lastFailureReason = acc.lastFailureReason || failureText;

      for (const row of newsletterFailureRows(failureText)) {
        if (row.kind !== "recipient") continue;
        const existing = repeatedFailures.get(row.email) || { count: 0, reason: row.reason };
        repeatedFailures.set(row.email, {
          count: existing.count + 1,
          reason: existing.reason || row.reason,
        });
      }
      return acc;
    },
    {
      total: batches.length,
      sent: 0,
      failed: 0,
      waiting: 0,
      transportFailures: 0,
      recipientFailures: 0,
      configurationFailures: 0,
      lastFailureReason: "",
    },
  );

  return {
    profileId: profile?.id || "",
    ...summary,
    invalidContacts,
    repeatedRecipientFailures: Array.from(repeatedFailures.entries())
      .map(([email, value]) => ({ email, ...value }))
      .filter((entry) => entry.count >= NEWSLETTER_MAX_RETRIES_PER_SLOT)
      .sort((a, b) => b.count - a.count),
  };
};

const newsletterTargetCount = (profile: NewsletterProfile) => Math.max(1, profile.topCount || TOP_BRIEF_ITEMS);

const newsletterSlotMinutes = (sendTime: string) => {
  const [hour = 0, minute = 0] = sendTime.split(":").map(Number);
  return hour * 60 + minute;
};

const newsletterSourceTopics = (profile: NewsletterProfile) => {
  const topics = newsletterTopicIds(profile);
  return new Set(
    topics.flatMap((topic) => [topic, ...(RESEARCH_FILTER_TOPIC_ALIASES[topic] || [])]),
  );
};

const newsletterCandidatePool = (feed: NewsItem[], archive: NewsItem[]) =>
  dedupeNewsItems(retainRecentNews([...feed, ...archive]));

const selectNewsletterItems = (
  feed: NewsItem[],
  likedIds: string[],
  profile: NewsletterProfile,
) => {
  if (isPropertyDigestNewsletterProfile(profile)) {
    return selectPropertyDigestNewsletterItems(profile);
  }
  const preferences = newsPreferenceAgentFromStorage();
  const cutoff = Date.now() - NEWS_ACTIVE_WINDOW_HOURS * 60 * 60 * 1000;
  const eligible = retainRecentNews(feed).filter((item) => {
    const timestamp = Date.parse(item.publishedAt);
    return Number.isNaN(timestamp) || timestamp >= cutoff;
  });
  const profileIsPublic = isPublicNewsletterProfile(profile);
  const filtered = eligible.filter((item) =>
    profileIsPublic
      ? matchesPublicAiInnovationBrief(item)
      : matchesNewsletterInterest(item, profile),
  );
  const liked = filtered
    .filter((item) => likedIds.includes(item.id))
    .sort((a, b) => scoreItem(b, preferences) - scoreItem(a, preferences));
  const likedIdsSet = new Set(liked.map((item) => item.id));
  const ranked = filtered
    .filter((item) => !likedIdsSet.has(item.id))
    .sort((a, b) => scoreItem(b, preferences) - scoreItem(a, preferences));
  return [...liked, ...ranked].slice(0, newsletterTargetCount(profile));
};

const runNewsFlowTopicRefresh = async (profile: NewsletterProfile, reason = "newsletter catch-up") => {
  const sourceTopics = newsletterSourceTopics(profile);
  const isMobilityProfile = newsletterTopicIds(profile).includes("italy-mobility");
  const sources = activeSourcePool(NEWS_SOURCES)
    .filter((source) =>
      isPublicNewsletterProfile(profile)
        ? PUBLIC_ALLOWED_SOURCE_IDS.has(source.id)
        : sourceTopics.has(source.topic),
    )
    .sort((a, b) => b.priority - a.priority)
    .slice(0, isMobilityProfile ? ITALY_MOBILITY_SOURCE_IDS.length : NEWS_MANUAL_PULL_MAX_SOURCES);

  if (!sources.length) {
    return {
      items: safeJsonParse<NewsItem[]>(NEWS_ITEMS_KEY, []),
      archive: safeJsonParse<NewsItem[]>(NEWSFLOW_ARCHIVE_KEY, []),
      errors: [`No active sources configured for ${profile.title}.`],
      sources,
    };
  }

  const results = await fetchSourcesInBatches(sources);
  const errors: string[] = [];
  const pulled = results.flatMap((result) => {
    if (result.status === "fulfilled") return result.value;
    errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    return [];
  });
  const existing = safeJsonParse<NewsItem[]>(NEWS_ITEMS_KEY, []);
  const existingArchive = safeJsonParse<NewsItem[]>(NEWSFLOW_ARCHIVE_KEY, []);
  const merged = [...pulled, ...existing, ...existingArchive];
  const archive = persistNewsFlowArchive(merged);
  const feed = buildRecentFeed(merged);
  const runAt = new Date().toISOString();
  const saved = safeJsonParse<SavedNewsItem[]>(NEWS_SAVED_KEY, []);
  const liked = safeJsonParse<string[]>(NEWS_LIKED_KEY, []);
  const pinned = safeJsonParse<string[]>(NEWS_PINNED_KEY, []);

  if (feed.length) {
    saveJson(NEWS_ITEMS_KEY, feed);
    localStorage.setItem(NEWS_LAST_RUN_KEY, runAt);
    localStorage.setItem(NEWS_NEXT_RUN_KEY, nextScheduledRun(new Date()).toISOString());
    updateAgentDb(feed, saved, liked, pinned, undefined, undefined, archive);
    refreshNewsPreferenceAgent(feed, archive, saved, liked, pinned);
    window.dispatchEvent(new CustomEvent("pocketflow:news-db-updated", {
      detail: {
        reason,
        topics: Array.from(sourceTopics),
        sources: sources.map((source) => source.id),
        pulled: pulled.length,
      },
    }));
  }

  return { items: feed, archive, errors, sources };
};

const renderSecondLifeNewsletterHtml = (profile: NewsletterProfile, selected: NewsItem[]) => {
  const today = new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const intro = (profile.intro || defaultFashionNewsletterProfile().intro).replace(/\{\{date\}\}/gi, today);
  const pageBgColor = profile.bodyBgColor || "#ffffff";
  const headerBgColor = profile.headerBgColor || "#ffffff";
  const headerTextColor = profile.headerTextColor || "#171111";
  const footerBgColor = profile.footerBgColor || "#ffffff";
  const footerTextColor = profile.footerTextColor || "#171111";
  const accentColor = profile.accentColor || "#d9251d";
  const fontFamily = profile.fontFamily || "Arial, Helvetica, sans-serif";
  const footprint = profile.footprint || "example.com";
  const logoSrc = profile.logoDataUrl || SECOND_LIFE_LOGO_FALLBACK_SRC;
  const items = selected.map((item, index) => `
    <tr>
      <td style="padding:22px 0;border-bottom:1px solid #ececec;">
        <div style="font:800 11px ${fontFamily};text-transform:uppercase;letter-spacing:2.4px;color:${accentColor};">${String(index + 1).padStart(2, "0")} / ${escapeHtml(item.sourceName)} / ${escapeHtml(item.topic)}</div>
        ${newsletterQualityBadgeHtml(item)}
        <h2 style="margin:9px 0 8px;font:900 25px ${fontFamily};color:${headerTextColor};line-height:1.05;">${escapeHtml(item.title)}</h2>
        <p style="margin:0;font:400 15px ${fontFamily};color:${headerTextColor};line-height:1.58;">${escapeHtml(item.fullSummary || item.summary)}</p>
        <a href="${escapeHtml(item.link)}" style="display:inline-block;margin-top:13px;padding:10px 14px;border-radius:999px;background:#ffffff;color:${accentColor};border:1px solid ${accentColor};text-decoration:none;font:800 10px ${fontFamily};text-transform:uppercase;letter-spacing:2px;">Read full source</a>
      </td>
    </tr>
  `).join("");

  return `
    <div style="background:${pageBgColor};padding:22px;font-family:${fontFamily};color:${headerTextColor};">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:${pageBgColor};border:1px solid #ededed;">
        <tr>
          <td style="padding:26px 26px 20px;text-align:center;background:${headerBgColor};border-top:8px solid ${accentColor};border-bottom:2px solid ${headerTextColor};">
            <img src="${escapeHtml(logoSrc)}" alt="Second Life Studio" style="display:block;max-width:190px;max-height:110px;object-fit:contain;margin:0 auto 18px;" />
            <div style="font:800 10px ${fontFamily};text-transform:uppercase;letter-spacing:3px;color:${accentColor};">${escapeHtml(today)}</div>
            <h1 style="margin:8px 0 5px;font:900 36px ${fontFamily};color:${headerTextColor};line-height:.96;">${escapeHtml(profile.title || "Second Life Studio Fashion Brief")}</h1>
            <div style="font:800 11px ${fontFamily};text-transform:uppercase;letter-spacing:3px;color:${headerTextColor};opacity:.72;">Fashion / Textile / Design Intelligence</div>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px 8px;font:400 16px ${fontFamily};color:${headerTextColor};line-height:1.6;">
            ${escapeHtml(intro).replace(/\n/g, "<br />")}
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 18px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${items}</table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 28px;text-align:center;background:${footerBgColor};color:${footerTextColor};border-top:4px solid ${accentColor};">
            <div style="font:900 13px ${fontFamily};text-transform:uppercase;letter-spacing:2px;white-space:pre-line;color:${footerTextColor};">${escapeHtml(profile.signature || "2ND Life Studio")}</div>
            <div style="margin-top:10px;font:800 11px ${fontFamily};letter-spacing:1.5px;color:${footerTextColor};">${escapeHtml(footprint)}</div>
          </td>
        </tr>
      </table>
    </div>
  `;
};

const renderPublicNewsletterHtml = (profile: NewsletterProfile, selected: NewsItem[]) => {
  const today = new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const intro = (profile.intro || DEFAULT_NEWSLETTER_INTRO).replace(/\{\{date\}\}/gi, today);
  const theme = {
    ...PUBLIC_NEWSLETTER_THEME,
    pageBg: profile.bodyBgColor || PUBLIC_NEWSLETTER_THEME.pageBg,
    headerBg: profile.headerBgColor || PUBLIC_NEWSLETTER_THEME.headerBg,
    text: profile.headerTextColor || PUBLIC_NEWSLETTER_THEME.text,
    gold: profile.accentColor || PUBLIC_NEWSLETTER_THEME.gold,
    footerBg: profile.footerBgColor || profile.headerBgColor || PUBLIC_NEWSLETTER_THEME.headerBg,
    footerText: profile.footerTextColor || PUBLIC_NEWSLETTER_THEME.text,
    font: profile.fontFamily || PUBLIC_NEWSLETTER_THEME.font,
  };
  const fontFamily = theme.font;
  const footprint = profile.footprint || DEFAULT_NEWSLETTER_FOOTPRINT;
  const logoBlock = profile.logoDataUrl
    ? `<img src="${escapeHtml(profile.logoDataUrl)}" alt="PocketFlow Studio" style="display:block;max-width:158px;max-height:76px;object-fit:contain;margin:0 0 18px;" />`
    : `<div style="display:inline-block;padding:10px 14px;border:2px solid ${theme.gold};border-radius:999px;color:${theme.gold};font:900 11px ${fontFamily};letter-spacing:3px;text-transform:uppercase;">PocketFlow Studio</div>`;
  const items = selected.map((item, index) => `
    <tr>
      <td style="padding:0 0 14px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${theme.cardBg};border:1px solid ${theme.softBorder};border-radius:18px;">
          <tr>
            <td style="width:58px;vertical-align:top;padding:18px 0 18px 18px;">
              <div style="width:34px;height:34px;border-radius:999px;background:${theme.gold};color:${theme.green};text-align:center;font:900 13px ${fontFamily};line-height:34px;">${index + 1}</div>
            </td>
            <td style="vertical-align:top;padding:18px 18px 18px 0;">
              <div style="font:900 10px ${fontFamily};text-transform:uppercase;letter-spacing:2.2px;color:${theme.cyan};">${escapeHtml(item.sourceName)} / ${escapeHtml(item.topic)}</div>
              ${newsletterQualityBadgeHtml(item)}
              <h2 style="margin:8px 0 8px;font:900 23px ${fontFamily};color:${theme.text};line-height:1.14;">${escapeHtml(item.title)}</h2>
              <p style="margin:0;font:400 15px ${fontFamily};color:${theme.muted};line-height:1.62;">${escapeHtml(item.fullSummary || item.summary)}</p>
              <a href="${escapeHtml(item.link)}" style="display:inline-block;margin-top:14px;padding:11px 15px;border-radius:999px;background:${theme.green};color:${theme.gold};border:1px solid ${theme.gold};text-decoration:none;font:900 10px ${fontFamily};text-transform:uppercase;letter-spacing:2.2px;">Read source</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join("");

  return `
    <div style="background:${theme.pageBg};padding:22px;font-family:${fontFamily};color:${theme.text};">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:700px;margin:0 auto;background:${theme.shellBg};border:1px solid ${theme.border};border-radius:24px;overflow:hidden;">
        <tr>
          <td style="padding:28px 28px 24px;background:${theme.headerBg};border-bottom:4px solid ${theme.gold};">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="vertical-align:middle;">
                  ${logoBlock}
                  <div style="margin-top:18px;font:900 10px ${fontFamily};text-transform:uppercase;letter-spacing:3.2px;color:${theme.gold};">AI-native software / builder intelligence</div>
                  <h1 style="margin:9px 0 8px;font:900 36px ${fontFamily};color:${profile.headerTextColor || theme.gold};line-height:1.02;">${escapeHtml(profile.title || "Public AI Daily Brief")}</h1>
                  <div style="font:800 11px ${fontFamily};text-transform:uppercase;letter-spacing:2.6px;color:${profile.headerTextColor || "#fffaf0"};">${escapeHtml(today)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px 6px;">
            <div style="padding:18px 18px;border-radius:18px;background:#fff7df;border:1px solid ${theme.border};border-left:6px solid ${theme.gold};font:400 16px ${fontFamily};color:${theme.text};line-height:1.62;">
              ${escapeHtml(intro).replace(/\n/g, "<br />")}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 18px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${items}</table>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 28px;text-align:center;background:${theme.footerBg};border-top:1px solid ${theme.border};">
            <div style="font:900 12px ${fontFamily};text-transform:uppercase;letter-spacing:2.8px;white-space:pre-line;color:${theme.footerText};">${escapeHtml(profile.signature || "PocketFlow Studio")}</div>
            <div style="margin-top:10px;font:800 11px ${fontFamily};letter-spacing:1.8px;color:${theme.footerText};">${escapeHtml(footprint)}</div>
          </td>
        </tr>
      </table>
    </div>
  `;
};

const renderKapricornLeafletHtml = (profile: NewsletterProfile, selected: NewsItem[]) => {
  const today = new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const issueDate = new Date().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
  const issueNo = String(Math.max(1, Math.ceil((Date.now() - yearStart) / (7 * 24 * 60 * 60 * 1000)))).padStart(2, "0");
  const intro = (profile.intro || defaultKapricornNewsletterProfile().intro).replace(/\{\{date\}\}/gi, today);
  const accentColor = profile.accentColor || "#f7c331";
  const gold = "#d6a84f";
  const paper = "#e8d5aa";
  const palePaper = "#f2e4bf";
  const ink = "#11100d";
  const softInk = "#221c16";
  const muted = "#7f6a4d";
  const darkPanel = "#15120e";
  const darkerPanel = "#0c0a08";
  const fontFamily = profile.fontFamily || "Arial, Helvetica, sans-serif";
  const titleFont = profile.fontFamily || "Georgia, 'Times New Roman', serif";
  const footprint = profile.footprint || "Kapricorn leaflet";
  const picks = selected.slice(0, newsletterTargetCount(profile));
  const fallbackEvents = [
    { title: "Friday DJ Night", meta: "Thursday table planning", text: "One clean music cue, one table rule, one offer ready before doors open." },
    { title: "Aperitivo Special", meta: "Weekly bar note", text: "Selected spritz, small plates and a simple reason to stay for one more round." },
    { title: "Cocktail Masterclass", meta: "Staff prompt", text: "Teach one signature move, then turn it into a story the table remembers." },
  ];
  const eventCards: Array<{ title: string; meta: string; text: string; link?: string }> = picks.length ? picks.slice(0, 3).map((item) => ({
    title: item.title,
    meta: `${item.sourceName} / ${item.topic}`,
    text: item.fullSummary || item.summary,
    link: item.link,
  })) : fallbackEvents;
  const eventRows = eventCards.map((item) => `
    <tr>
      <td style="width:46px;padding:0 12px 14px 0;vertical-align:top;">
        <div style="width:34px;height:34px;border:1px solid ${muted};border-radius:999px;text-align:center;font:900 12px ${fontFamily};line-height:34px;color:${gold};">BAR</div>
      </td>
      <td style="padding:0 0 14px;vertical-align:top;">
        <div style="font:950 11px ${fontFamily};text-transform:uppercase;letter-spacing:1.8px;color:${gold};">${escapeHtml(item.title)}</div>
        <div style="margin-top:3px;font:850 9px ${fontFamily};text-transform:uppercase;letter-spacing:1.6px;color:${paper};">${escapeHtml(item.meta)}</div>
        <p style="margin:5px 0 0;font:500 12px ${fontFamily};line-height:1.45;color:#d7c39a;">${escapeHtml(item.text)}</p>
        ${item.link ? `<a href="${escapeHtml(item.link)}" style="display:inline-block;margin-top:6px;color:${gold};font:900 9px ${fontFamily};letter-spacing:1.6px;text-transform:uppercase;text-decoration:none;border-bottom:1px solid ${gold};">Source note</a>` : ""}
      </td>
    </tr>
  `).join("");
  const pulseRows = (picks.length ? picks.slice(0, 4) : []).map((item, index) => `
    <tr>
      <td style="padding:10px 0;border-top:1px solid rgba(17,16,13,.22);">
        <div style="font:950 10px ${fontFamily};text-transform:uppercase;letter-spacing:2px;color:${accentColor};">${String(index + 1).padStart(2, "0")} / ${escapeHtml(item.sourceName)}</div>
        <div style="margin-top:5px;font:950 17px ${titleFont};line-height:1.05;color:${ink};text-transform:uppercase;">${escapeHtml(item.title)}</div>
        <p style="margin:5px 0 0;font:500 12px ${fontFamily};line-height:1.45;color:${softInk};">${escapeHtml(item.fullSummary || item.summary)}</p>
      </td>
    </tr>
  `).join("");

  return `
    <div style="background:#3a2415;padding:22px;font-family:${fontFamily};color:${ink};">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:${paper};border:12px solid #d9c79e;box-shadow:0 18px 40px rgba(0,0,0,.38);">
        <tr>
          <td style="padding:16px 18px 10px;background:${darkPanel};color:${paper};border-bottom:1px solid ${gold};">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="font:900 9px ${fontFamily};text-transform:uppercase;letter-spacing:1.8px;color:${paper};">${escapeHtml(issueDate)}</td>
                <td style="text-align:center;font:900 9px ${fontFamily};text-transform:uppercase;letter-spacing:2px;color:${gold};">ESTD 2026</td>
                <td style="text-align:right;font:900 9px ${fontFamily};text-transform:uppercase;letter-spacing:1.8px;color:${paper};">ISSUE #${issueNo}</td>
              </tr>
            </table>
            <div style="margin:14px 0 5px;border-top:1px solid rgba(214,168,79,.55);border-bottom:1px solid rgba(214,168,79,.55);padding:10px 0;text-align:center;">
              <div style="font:950 42px ${titleFont};line-height:.9;color:${gold};letter-spacing:1.2px;text-transform:uppercase;text-shadow:0 1px 0 #000;">${escapeHtml(profile.title || "The Bar Weekly")}</div>
              <div style="margin-top:8px;font:900 10px ${fontFamily};text-transform:uppercase;letter-spacing:3px;color:${paper};">Cocktails - Events - Offers - Nightlife</div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:${darkPanel};color:${paper};">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="width:43%;padding:16px 18px 18px;vertical-align:top;border-right:1px solid rgba(214,168,79,.35);">
                  <div style="font:950 25px ${fontFamily};line-height:1.02;letter-spacing:1px;text-transform:uppercase;color:${paper};">Good drinks.<br />Good music.<br /><span style="color:${gold};">Good times.</span></div>
                  <p style="margin:12px 0 0;font:500 12px ${fontFamily};line-height:1.55;color:#d7c39a;">${escapeHtml(intro).replace(/\n/g, "<br />")}</p>
                </td>
                <td style="padding:16px 18px 18px;vertical-align:top;">
                  <div style="min-height:118px;border:1px solid rgba(214,168,79,.42);background:${darkerPanel};padding:14px;text-align:center;">
                    <div style="font:900 10px ${fontFamily};text-transform:uppercase;letter-spacing:3px;color:${gold};">Bar Dispatch</div>
                    <div style="margin:12px auto 9px;width:86px;height:86px;border:2px solid ${gold};border-radius:999px;text-align:center;font:950 18px ${titleFont};line-height:86px;color:${gold};">K</div>
                    <div style="font:900 10px ${fontFamily};text-transform:uppercase;letter-spacing:2.2px;color:${paper};">${escapeHtml(today)}</div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 18px 4px;background:${darkPanel};">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="padding:0 12px 14px 0;width:40%;vertical-align:top;">
                  <div style="border:1px dashed ${gold};padding:15px;background:${softInk};color:${paper};text-align:center;">
                    <div style="font:900 10px ${fontFamily};letter-spacing:2.5px;text-transform:uppercase;color:${gold};">Weekly Coupon</div>
                    <div style="margin-top:8px;font:950 48px ${titleFont};line-height:.9;color:${gold};">2x1</div>
                    <div style="font:950 25px ${fontFamily};line-height:1;text-transform:uppercase;color:${paper};">Cocktails</div>
                    <p style="margin:10px 0 0;font:500 11px ${fontFamily};line-height:1.4;color:#d7c39a;">Show this coupon at the bar and get two cocktails for the price of one.</p>
                    <div style="display:inline-block;margin-top:12px;padding:7px 11px;background:${gold};color:${ink};font:950 10px ${fontFamily};text-transform:uppercase;letter-spacing:1.8px;">Code: Barweek</div>
                  </div>
                </td>
                <td style="padding:0 0 14px 12px;vertical-align:top;">
                  <div style="font:950 13px ${fontFamily};letter-spacing:2.6px;text-transform:uppercase;color:${gold};border-bottom:1px solid rgba(214,168,79,.55);padding-bottom:7px;">Upcoming Events</div>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px;">${eventRows}</table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 18px 16px;background:${palePaper};">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="width:52%;padding:0 14px 0 0;vertical-align:top;">
                  <div style="font:950 12px ${fontFamily};text-transform:uppercase;letter-spacing:2.4px;color:${accentColor};">Featured Drink</div>
                  <div style="margin-top:7px;font:950 24px ${titleFont};line-height:1;color:${ink};text-transform:uppercase;">Smoky Negroni</div>
                  <p style="margin:8px 0 0;font:500 12px ${fontFamily};line-height:1.5;color:${softInk};">A darker twist on the classic: smoked orange peel, bitter edge, clean finish.</p>
                  <div style="margin-top:12px;height:68px;border:1px solid rgba(17,16,13,.5);background:${darkPanel};color:${gold};text-align:center;font:950 28px ${titleFont};line-height:68px;">NO PHOTO / HOUSE CARD</div>
                </td>
                <td style="padding:0 0 0 14px;vertical-align:top;">
                  <div style="border:2px solid ${ink};background:${darkPanel};padding:15px;text-align:center;">
                    <div style="font:950 12px ${fontFamily};letter-spacing:2.6px;text-transform:uppercase;color:${gold};">Reserve a Table</div>
                    <p style="margin:9px 0 0;font:500 12px ${fontFamily};line-height:1.45;color:${paper};">Book your table now and make your night unforgettably simple.</p>
                    <div style="display:inline-block;margin-top:12px;padding:8px 11px;background:${gold};color:${ink};font:950 10px ${fontFamily};letter-spacing:1.4px;text-transform:uppercase;">Visit the bar / reserve</div>
                  </div>
                </td>
              </tr>
            </table>
            ${pulseRows ? `<div style="margin-top:15px;font:950 12px ${fontFamily};letter-spacing:2.4px;text-transform:uppercase;color:${ink};border-top:2px solid ${ink};padding-top:11px;">Drink-world pulse</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${pulseRows}</table>` : ""}
          </td>
        </tr>
        <tr>
          <td style="padding:12px 18px;background:${darkPanel};color:${paper};border-top:1px solid ${gold};">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="font:900 10px ${fontFamily};text-transform:uppercase;letter-spacing:1.8px;color:${paper};">${escapeHtml(profile.signature || "Kapricorn")}</td>
                <td style="text-align:center;font:900 10px ${fontFamily};text-transform:uppercase;letter-spacing:1.8px;color:${gold};">Follow us / Table notes</td>
                <td style="text-align:right;font:800 9px ${fontFamily};letter-spacing:1.2px;color:#d7c39a;">${escapeHtml(footprint)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
};

const renderPropertyDigestNewsletterHtml = (profile: NewsletterProfile, selected: NewsItem[]) => {
  const today = new Date().toLocaleDateString("it-IT", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const intro = (profile.intro || defaultPropertyDigestNewsletterProfile().intro).replace(/\{\{date\}\}/gi, today);
  const headerBgColor = profile.headerBgColor || "#0b1115";
  const headerTextColor = profile.headerTextColor || "#f8fafc";
  const accentColor = profile.accentColor || "#38bdf8";
  const footerBgColor = profile.footerBgColor || "#0b1115";
  const footerTextColor = profile.footerTextColor || "#9bdcff";
  const bodyBgColor = profile.bodyBgColor || "#f8fafc";
  const fontFamily = profile.fontFamily || "Arial, Helvetica, sans-serif";
  const propertyRows = selected.map((item, index) => {
    const fallbackPick: PropertyDigestNewsletterPick = {
      id: item.id,
      title: item.title,
      town: item.sourceName,
      price: 0,
      source: item.sourceName,
      url: item.link,
      reason: item.fullSummary || item.summary,
    };
    const pick = isPropertyDigestNewsletterItem(item)
      ? item.propertyDigest
      : fallbackPick;
    const bedrooms = Number(pick.bedrooms) || 2;
    const sqm = Number(pick.sqm) || 0;
    const baths = Number(pick.baths) || 1;
    const link = pick.url || item.link || "https://www.immobiliare.it/";
    return `
      <tr>
        <td style="padding:18px 0;border-bottom:1px solid #d8e4ea;">
          <div style="font:900 11px ${fontFamily};text-transform:uppercase;letter-spacing:2px;color:${accentColor};">${index + 1}. ${escapeHtml(pick.town || "Lago Maggiore")} / ${escapeHtml(pick.source || "Property Digest")}</div>
          <h2 style="margin:8px 0 8px;font:900 24px ${fontFamily};color:#0f172a;line-height:1.05;">${escapeHtml(pick.title || item.title)}</h2>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 10px;">
            <tr>
              <td style="padding:8px 10px;background:#e0f2fe;border:1px solid #bae6fd;font:900 16px ${fontFamily};color:#082f49;">${escapeHtml(propertyDigestMoney(Number(pick.price) || 0))}</td>
              <td style="padding:8px 10px;background:#f8fafc;border:1px solid #d8e4ea;font:800 13px ${fontFamily};color:#334155;text-align:center;">${bedrooms} camere</td>
              <td style="padding:8px 10px;background:#f8fafc;border:1px solid #d8e4ea;font:800 13px ${fontFamily};color:#334155;text-align:center;">${sqm || "?"} mq</td>
              <td style="padding:8px 10px;background:#f8fafc;border:1px solid #d8e4ea;font:800 13px ${fontFamily};color:#334155;text-align:center;">${baths} bagno${baths === 1 ? "" : "i"}</td>
            </tr>
          </table>
          <p style="margin:0;font-size:15px;font-family:${fontFamily};color:#334155;line-height:1.55;">${escapeHtml(pick.reason || item.fullSummary || item.summary)}</p>
          <a href="${escapeHtml(link)}" style="display:inline-block;margin-top:12px;padding:10px 13px;background:#0f172a;color:#ffffff;text-decoration:none;font:900 11px ${fontFamily};text-transform:uppercase;letter-spacing:2px;">Apri annuncio</a>
        </td>
      </tr>
    `;
  }).join("");

  return `
    <div style="background:${bodyBgColor};padding:24px;font-family:${fontFamily};color:#0f172a;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #d8e4ea;">
        <tr>
          <td style="padding:24px 24px 18px;text-align:center;border-bottom:4px solid ${accentColor};background:${headerBgColor};">
            <div style="font:900 10px ${fontFamily};text-transform:uppercase;letter-spacing:3px;color:${accentColor};">${escapeHtml(today)}</div>
            <h1 style="margin:8px 0 0;font:900 38px ${fontFamily};color:${headerTextColor};line-height:1;">${escapeHtml(profile.title)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 24px 8px;font-size:16px;font-family:${fontFamily};color:#334155;line-height:1.6;">
            ${escapeHtml(intro).replace(/\n/g, "<br />")}
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 12px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${propertyRows}</table>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 24px;text-align:center;background:${footerBgColor};color:${footerTextColor};">
            <div style="font:900 12px ${fontFamily};text-transform:uppercase;letter-spacing:2px;white-space:pre-line;">${escapeHtml(profile.signature || "Property digest desk")}</div>
            <div style="margin-top:10px;font:700 10px ${fontFamily};letter-spacing:1px;color:${footerTextColor};opacity:.78;">${escapeHtml(profile.footprint || defaultPropertyDigestNewsletterProfile().footprint)}</div>
          </td>
        </tr>
      </table>
    </div>
  `;
};

const renderNewsletterHtml = (profile: NewsletterProfile, selected: NewsItem[]) => {
  if (isPropertyDigestNewsletterProfile(profile)) {
    return renderPropertyDigestNewsletterHtml(profile, selected);
  }
  if (profile.id === "newsletter_second_life_fashion_daily" || profile.topicFilters?.includes("fashion-industry")) {
    return renderSecondLifeNewsletterHtml(profile, selected);
  }
  if (profile.id === "newsletter_kapricorn_leaflet" || profile.topicFilters?.includes("kapricorn")) {
    return renderKapricornLeafletHtml(profile, selected);
  }
  if (profile.id === "newsletter_public_ai_daily") {
    return renderPublicNewsletterHtml(profile, selected);
  }

  const today = new Date().toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const intro = profile.intro.replace(/\{\{date\}\}/gi, today);
  const headerBgColor = profile.headerBgColor || "#fffaf0";
  const headerTextColor = profile.headerTextColor || "#111111";
  const footerBgColor = profile.footerBgColor || "#151515";
  const footerTextColor = profile.footerTextColor || "#f8f1df";
  const accentColor = profile.accentColor || "#a5832c";
  const bodyBgColor = profile.bodyBgColor || "#f6f0df";
  const footprint = profile.footprint || DEFAULT_NEWSLETTER_FOOTPRINT;
  const fontFamily = profile.fontFamily || DEFAULT_NEWSLETTER_FONT;
  const items = selected.map((item, index) => `
    <tr>
      <td style="padding:18px 0;border-bottom:1px solid #e8dec8;">
        <div style="font:700 11px ${fontFamily};text-transform:uppercase;letter-spacing:2px;color:${accentColor};">${index + 1}. ${escapeHtml(item.sourceName)} / ${escapeHtml(item.topic)}</div>
        ${newsletterQualityBadgeHtml(item)}
        <h2 style="margin:8px 0 6px;font:800 22px ${fontFamily};color:#161616;line-height:1.05;">${escapeHtml(item.title)}</h2>
        <p style="margin:0;font-size:15px;font-family:${fontFamily};color:#3d372f;line-height:1.55;">${escapeHtml(item.fullSummary || item.summary)}</p>
        <a href="${escapeHtml(item.link)}" style="display:inline-block;margin-top:10px;font:800 11px ${fontFamily};text-transform:uppercase;letter-spacing:2px;color:#111;">Read source</a>
      </td>
    </tr>
  `).join("");
  return `
    <div style="background:${bodyBgColor};padding:24px;font-family:${fontFamily};color:#151515;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#fffaf0;border:1px solid #d7cbb3;">
        <tr>
          <td style="padding:24px 24px 18px;text-align:center;border-bottom:3px solid ${accentColor};background:${headerBgColor};">
            ${profile.logoDataUrl ? `<img src="${profile.logoDataUrl}" alt="Newsletter logo" style="max-width:150px;max-height:70px;object-fit:contain;margin-bottom:12px;" />` : ""}
            <div style="font:800 10px ${fontFamily};text-transform:uppercase;letter-spacing:3px;color:${accentColor};">${escapeHtml(today)}</div>
            <h1 style="margin:8px 0 0;font:900 34px ${fontFamily};color:${headerTextColor};line-height:1;">${escapeHtml(profile.title)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:22px 24px 8px;font-size:16px;font-family:${fontFamily};color:#3d372f;line-height:1.6;">
            ${escapeHtml(intro).replace(/\n/g, "<br />")}
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 12px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${items}</table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 24px;text-align:center;background:${footerBgColor};color:${footerTextColor};">
            <div style="font:800 12px ${fontFamily};text-transform:uppercase;letter-spacing:2px;white-space:pre-line;">${escapeHtml(profile.signature)}</div>
            <div style="margin-top:12px;font:700 10px ${fontFamily};letter-spacing:1px;color:${footerTextColor};opacity:.78;">${escapeHtml(footprint)}</div>
          </td>
        </tr>
      </table>
    </div>
  `;
};

const buildNewsletterBatch = (
  profile: NewsletterProfile,
  selected: NewsItem[],
  html: string,
  status: "draft_composed_for_review" | "ready_for_crm_review" | "ready_for_crm_send" | "sent_to_crm" | "send_failed",
) => ({
  id: `newsletter_batch_${Date.now()}_${profile.id}`,
  kind: "pocketflow.newsletter.crmPackage",
  profileId: profile.id,
  profileName: profile.name,
  agentId: profile.agentId || `newsletter-agent-${slugForAgent(profile.name || profile.title || profile.id)}`,
  agentStatus: profile.agentStatus || newsletterAgentStatusForProfile(profile),
  status,
  createdAt: new Date().toISOString(),
  sendTime: profile.sendTime,
  sendTimes: newsletterSendTimes(profile),
  fromAccount: profile.fromAccount,
  crmList: profile.crmList,
  audienceCount: newsletterAudienceCount(profile.crmList),
  subject: profile.title,
  templateName: profile.templateName,
  html,
  items: selected.map(({ id, sourceName, topic, title, link, publishedAt, summary }) => ({
    id,
    sourceName,
    topic,
    title,
    link,
    publishedAt,
    summary,
  })),
});

const parseNewsletterContacts = (raw: string): NewsletterContact[] => {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const fromUnknown = (value: unknown): NewsletterContact | null => {
    if (typeof value === "string") {
      const email = value.trim();
      return email.includes("@") ? { email } : null;
    }
    if (value && typeof value === "object") {
      const entry = value as { email?: unknown; name?: unknown; tags?: unknown };
      if (typeof entry.email !== "string" || !entry.email.includes("@")) return null;
      return {
        email: entry.email.trim(),
        name: typeof entry.name === "string" ? entry.name.trim() : undefined,
        tags: Array.isArray(entry.tags) ? entry.tags.filter((tag): tag is string => typeof tag === "string") : undefined,
      };
    }
    return null;
  };

  try {
    const parsed = JSON.parse(trimmed);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return rows.map(fromUnknown).filter((contact): contact is NewsletterContact => Boolean(contact));
  } catch {
    return trimmed
      .split(/[\n,;]+/)
      .map((email) => email.trim())
      .filter((email) => email.includes("@"))
      .map((email) => ({ email }));
  }
};

const mergeNewsletterContacts = (existing: NewsletterContact[], incoming: NewsletterContact[]) => {
  const byEmail = new Map<string, NewsletterContact>();
  [...existing, ...incoming].forEach((contact) => {
    const key = contact.email.trim().toLowerCase();
    if (!key) return;
    byEmail.set(key, { ...byEmail.get(key), ...contact, email: contact.email.trim() });
  });
  return Array.from(byEmail.values()).sort((a, b) => a.email.localeCompare(b.email));
};

const NEWS_PREFERENCE_STOPWORDS = new Set([
  "with",
  "from",
  "that",
  "this",
  "have",
  "will",
  "into",
  "about",
  "after",
  "before",
  "their",
  "they",
  "them",
  "today",
  "news",
  "says",
  "over",
  "under",
  "more",
  "most",
  "daily",
  "italy",
  "italian",
  "global",
  "local",
  "report",
  "reports",
  "update",
  "updates",
]);

const emptyNewsPreferenceAgent = (): NewsPreferenceAgent => ({
  kind: "pocketflow.news.preferenceAgent",
  updatedAt: new Date().toISOString(),
  learnedFrom: 0,
  likedCount: 0,
  savedCount: 0,
  pinnedCount: 0,
  topicWeights: {},
  sourceWeights: {},
  keywordWeights: {},
  styleHints: ["No explicit likes, pins, or saves learned yet."],
});

const newsPreferenceAgentFromStorage = () =>
  safeJsonParse<NewsPreferenceAgent>(NEWS_PREFERENCE_AGENT_KEY, emptyNewsPreferenceAgent());

const preferenceTokensFor = (item: Pick<NewsItem, "title" | "summary" | "fullSummary" | "sourceName">) =>
  `${item.sourceName} ${item.title} ${item.summary} ${item.fullSummary}`
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9àèéìòùçñüäöß]+/gi, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !NEWS_PREFERENCE_STOPWORDS.has(token))
    .slice(0, 80);

const buildNewsPreferenceAgent = (
  feed: NewsItem[],
  archive: NewsItem[] = safeJsonParse<NewsItem[]>(NEWSFLOW_ARCHIVE_KEY, []),
  saved: SavedNewsItem[] = safeJsonParse<SavedNewsItem[]>(NEWS_SAVED_KEY, []),
  likedIds: string[] = safeJsonParse<string[]>(NEWS_LIKED_KEY, []),
  pinnedIds: string[] = safeJsonParse<string[]>(NEWS_PINNED_KEY, []),
): NewsPreferenceAgent => {
  const byId = new Map<string, NewsItem>();
  [...archive, ...feed].forEach((item) => byId.set(item.id, item));
  saved.forEach((item) => byId.set(item.id, item));

  const weighted: Array<{ item: NewsItem; weight: number }> = [];
  likedIds.forEach((id) => {
    const item = byId.get(id);
    if (item) weighted.push({ item, weight: 4 });
  });
  pinnedIds.forEach((id) => {
    const item = byId.get(id);
    if (item) weighted.push({ item, weight: 5 });
  });
  saved.forEach((item) => weighted.push({ item, weight: 3 }));

  if (!weighted.length) return emptyNewsPreferenceAgent();

  const topicWeights: Partial<Record<NewsTopic, number>> = {};
  const sourceWeights: Record<string, number> = {};
  const keywordWeights: Record<string, number> = {};

  weighted.forEach(({ item, weight }) => {
    topicWeights[item.topic] = (topicWeights[item.topic] || 0) + weight;
    sourceWeights[item.sourceId] = (sourceWeights[item.sourceId] || 0) + weight;
    preferenceTokensFor(item).forEach((token) => {
      keywordWeights[token] = (keywordWeights[token] || 0) + Math.max(1, weight / 2);
    });
  });

  const topKeywords = Object.entries(keywordWeights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 24);
  const topSources = Object.entries(sourceWeights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => sourceFor(id)?.name || id);
  const topTopics = Object.entries(topicWeights)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .map(([topic]) => topic);

  return {
    kind: "pocketflow.news.preferenceAgent",
    updatedAt: new Date().toISOString(),
    learnedFrom: weighted.length,
    likedCount: likedIds.length,
    savedCount: saved.length,
    pinnedCount: pinnedIds.length,
    topicWeights,
    sourceWeights,
    keywordWeights: Object.fromEntries(topKeywords),
    styleHints: [
      `Preferred topics: ${topTopics.join(", ") || "none yet"}.`,
      `Preferred sources: ${topSources.join(", ") || "none yet"}.`,
      `Preferred signals: ${topKeywords.slice(0, 8).map(([token]) => token).join(", ") || "none yet"}.`,
    ],
  };
};

const refreshNewsPreferenceAgent = (
  feed: NewsItem[],
  archive: NewsItem[] = safeJsonParse<NewsItem[]>(NEWSFLOW_ARCHIVE_KEY, []),
  saved: SavedNewsItem[] = safeJsonParse<SavedNewsItem[]>(NEWS_SAVED_KEY, []),
  likedIds: string[] = safeJsonParse<string[]>(NEWS_LIKED_KEY, []),
  pinnedIds: string[] = safeJsonParse<string[]>(NEWS_PINNED_KEY, []),
) => {
  const agent = buildNewsPreferenceAgent(feed, archive, saved, likedIds, pinnedIds);
  saveJson(NEWS_PREFERENCE_AGENT_KEY, agent);
  const agentDb = safeJsonParse<Record<string, unknown>>(NEWS_DB_KEY, {});
  saveJson(NEWS_DB_KEY, { ...agentDb, preferenceAgent: agent });
  window.dispatchEvent(new CustomEvent("pocketflow:news-preferences-updated", { detail: agent }));
  return agent;
};

const preferenceBoost = (item: NewsItem, preferences = newsPreferenceAgentFromStorage()) => {
  const topic = preferences.topicWeights[item.topic] || 0;
  const source = preferences.sourceWeights[item.sourceId] || 0;
  const keywords = preferenceTokensFor(item).reduce((sum, token) => sum + (preferences.keywordWeights[token] || 0), 0);
  return Math.min(34, topic * 0.9 + source * 1.1 + keywords * 0.7);
};

const scoreItem = (item: NewsItem, preferences = newsPreferenceAgentFromStorage()) => {
  const source = sourceFor(item.sourceId);
  const ageHours = Math.max(0, (Date.now() - Date.parse(item.publishedAt)) / 3_600_000);
  const recencyScore = Math.max(0, 18 - ageHours);
  const topicBoost =
    item.topic === "ai" ? 14 :
    item.topic === "fashion" ? 12 :
    item.topic === "politics" ? 12 :
    item.topic === "local" ? 12 :
    item.topic === "geopolitics" ? 11 :
    item.topic === "markets" ? 8 :
    item.topic === "italy" ? 7 :
    3;
  return (source?.priority || 5) * 4 + topicBoost + keywordScore(item) + recencyScore + preferenceBoost(item, preferences);
};

const retainRecentNews = (items: NewsItem[]) => {
  const cutoff = Date.now() - NEWS_ACTIVE_WINDOW_MS;
  return items.filter((item) => {
    const timestamp = newsItemTimestamp(item);
    return Number.isNaN(timestamp) || timestamp >= cutoff;
  });
};

const newsItemTimestamp = (item: NewsItem) => {
  const published = Date.parse(item.publishedAt);
  const fetched = Date.parse(item.fetchedAt);
  return Number.isNaN(published) ? fetched : published;
};

const newestNewsTimestamp = (items: NewsItem[]) => {
  return items.reduce((newest, item) => {
    const timestamp = newsItemTimestamp(item);
    return Number.isNaN(timestamp) ? newest : Math.max(newest, timestamp);
  }, 0);
};

const newsFeedIsStale = (items: NewsItem[], maxAgeMs = STALE_AFTER_MS) => {
  const newest = newestNewsTimestamp(items);
  return !newest || Date.now() - newest > maxAgeMs;
};

const dedupeNewsItems = (items: NewsItem[]) => {
  const seen = new Set<string>();
  return items
    .filter((item) => {
      const key = `${item.title.toLowerCase()}|${item.link.split("?")[0].toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => scoreItem(b) - scoreItem(a));
};

const buildBriefItems = (items: NewsItem[], limit = TOP_BRIEF_ITEMS) => {
  const sorted = dedupeNewsItems(retainRecentNews(items));
  const balanced: NewsItem[] = [];
  const byTopic = new Map<NewsTopic, NewsItem[]>();
  sorted.forEach((item) => {
    const bucket = byTopic.get(item.topic) || [];
    bucket.push(item);
    byTopic.set(item.topic, bucket);
  });

  Object.entries(TOPIC_TARGETS).forEach(([topic, target]) => {
    const bucket = byTopic.get(topic as NewsTopic) || [];
    for (let index = 0; index < target && balanced.length < limit; index++) {
      const next = bucket[index];
      if (next && !balanced.some((item) => item.id === next.id)) balanced.push(next);
    }
  });

  const bySource = new Map<string, NewsItem[]>();
  sorted.forEach((item) => {
    const bucket = bySource.get(item.sourceId) || [];
    bucket.push(item);
    bySource.set(item.sourceId, bucket);
  });
  for (let round = 0; balanced.length < limit && round < 3; round++) {
    for (const source of [...NEWS_SOURCES].sort((a, b) => b.priority - a.priority)) {
      const next = bySource.get(source.id)?.[round];
      if (next && !balanced.some((item) => item.id === next.id)) balanced.push(next);
      if (balanced.length >= limit) break;
    }
  }
  for (const item of sorted) {
    if (balanced.length >= limit) break;
    if (!balanced.some((existing) => existing.id === item.id)) balanced.push(item);
  }
  return balanced.slice(0, limit);
};

const buildRecentFeed = (items: NewsItem[]) => {
  const deduped = dedupeNewsItems(retainRecentNews(items));
  const brief = buildBriefItems(deduped, TOP_BRIEF_ITEMS);
  const briefIds = new Set(brief.map((item) => item.id));
  const byTime = [...deduped].sort((a, b) => newsItemTimestamp(b) - newsItemTimestamp(a));
  return [...brief, ...byTime.filter((item) => !briefIds.has(item.id))].slice(0, MAX_FEED_ITEMS);
};

const persistNewsFlowArchive = (items: NewsItem[]) => {
  const existingArchive = safeJsonParse<NewsItem[]>(NEWSFLOW_ARCHIVE_KEY, []);
  const archived = dedupeNewsItems([...items, ...existingArchive]).sort(
    (a, b) => newsItemTimestamp(b) - newsItemTimestamp(a),
  );
  saveJson(NEWSFLOW_ARCHIVE_KEY, archived);
  window.dispatchEvent(
    new CustomEvent("pocketflow:archive-section-updated", {
      detail: {
        section: NEWSFLOW_ARCHIVE_SECTION,
        storageKey: NEWSFLOW_ARCHIVE_KEY,
        itemCount: archived.length,
        updatedAt: new Date().toISOString(),
      },
    }),
  );
  return archived;
};

const nextScheduledRun = (from = new Date()) => {
  const next = new Date(from);
  for (const hour of DAILY_REFRESH_HOURS) {
    next.setHours(hour, 0, 0, 0);
    if (next.getTime() > from.getTime()) return next;
  }
  next.setDate(next.getDate() + 1);
  next.setHours(DAILY_REFRESH_HOURS[0], 0, 0, 0);
  return next;
};

const dueNewsScouterJobIds = (now = new Date()) => {
  const jobs = loadBalossDurableJobs().filter((job) => job.kind === "news_scouter" && job.enabled);
  const due = jobs.filter((job) => {
    const next = Date.parse(job.nextRunAt || "");
    return Number.isNaN(next) || next <= now.getTime() + 60_000;
  });
  if (due.length) return due.map((job) => job.id);
  const known = jobs.filter((job) => NEWS_SCOUTER_JOB_IDS.includes(job.id)).map((job) => job.id);
  return known.length ? known.slice(0, 1) : [];
};

const markNewsScouterJobs = (
  jobIds: string[],
  status: BalossJobStatus,
  message: string,
  at = new Date(),
) => {
  jobIds.forEach((jobId) => markBalossJobResult(jobId, status, message, at));
};

const newsSlotKey = (date: Date, hour: number) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}:${String(hour).padStart(2, "0")}`;

const getDueNewsSlot = (now = new Date()) => {
  const completed = safeJsonParse<Record<string, string>>(NEWS_SCHEDULE_DONE_KEY, {});
  const due = DAILY_REFRESH_HOURS.filter((hour) => {
    const slot = new Date(now);
    slot.setHours(hour, 0, 0, 0);
    return now.getTime() >= slot.getTime() && !completed[newsSlotKey(now, hour)];
  });
  return due.length ? due[due.length - 1] : null;
};

const markNewsSlotsComplete = (throughHour: number, date = new Date()) => {
  const completed = safeJsonParse<Record<string, string>>(NEWS_SCHEDULE_DONE_KEY, {});
  const runAt = new Date().toISOString();
  DAILY_REFRESH_HOURS.filter((hour) => hour <= throughHour).forEach((hour) => {
    completed[newsSlotKey(date, hour)] = runAt;
  });
  saveJson(NEWS_SCHEDULE_DONE_KEY, completed);
};

const formatDateTime = (value?: unknown) => {
  if (!value) return "Unknown time";
  const dateValue = value instanceof Date || typeof value === "number" ? value : String(value);
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const updateAgentDb = (
  recent: NewsItem[],
  saved: SavedNewsItem[],
  likedIds: string[],
  pinnedIds: string[],
  globalInterests = safeJsonParse<string[]>(NEWS_GLOBAL_INTERESTS_KEY, []),
  preferredSources = safeJsonParse<string[]>(NEWS_GLOBAL_SOURCES_KEY, []),
  archive = safeJsonParse<NewsItem[]>(NEWSFLOW_ARCHIVE_KEY, []),
) => {
  const latestTop10 = buildBriefItems(recent, TOP_BRIEF_ITEMS);
  const scoutState = readNewsScoutState();
  const payload = {
    kind: "pocketflow.news.agentDb",
    updatedAt: new Date().toISOString(),
    refreshPlan: `Personalized brief uses five lightweight scout bots. Each rotation checks ${NEWS_SCOUT_BATCH_SIZE} sources instead of bulk-pulling everything. The durable scouter jobs run automatically at least every two hours, the visible app also recovers stale pulls on startup/focus/online wake, and NewsFlow marks the scouter jobs succeeded or failed after every real pull. Active feed shows ${MAX_FEED_ITEMS} items from the last ${NEWS_ACTIVE_WINDOW_HOURS} hours.`,
    scoutBots: {
      enabled: true,
      bots: NEWS_SCOUT_BOT_COUNT,
      batchSize: NEWS_SCOUT_BATCH_SIZE,
      rotationMinutes: Math.round(NEWS_SCOUT_ROTATION_MS / 60_000),
      batchesRun: scoutState.batchesRun,
      activeBot: `scout-${String((scoutState.botIndex || 0) + 1).padStart(2, "0")}`,
      lastRunAt: scoutState.lastRunAt,
      lastMode: scoutState.lastMode,
      lastSources: scoutState.lastSourceIds,
      policy: "Organic source-by-source polling. Manual Pull and scheduled refreshes advance the cursor instead of creating one RAM-heavy all-source fetch.",
    },
    archive: {
      section: NEWSFLOW_ARCHIVE_SECTION,
      storageKey: NEWSFLOW_ARCHIVE_KEY,
      policy: "No timed deletion. News Flow memory is preserved here for archive search. External backup is paused until explicitly re-enabled.",
      itemCount: archive.length,
      newestAt: archive[0]?.publishedAt || "",
    },
    focus: [
      "Torino",
      "Milano",
      "Bologna",
      "Roma",
      "Italy mobility and strikes",
      "AI labs",
      "AI research",
      "Italian politics",
      "+Europa",
      "Radicali Italiani",
      "Breaking Italy",
      "Pulp Podcast",
      "geopolitics",
      "wars",
      "trade risk",
      "markets",
      ...globalInterests,
    ],
    preferredSources,
    preferenceAgent: newsPreferenceAgentFromStorage(),
    sources: activeSourcePool(NEWS_SOURCES).map(({ id, name, topic, tone, priority, officialPages, kind }) => ({
      id,
      name,
      topic,
      tone,
      priority,
      kind: kind || "feed",
      officialPages: officialPages || [],
    })),
    latestTop10: latestTop10.map(({ id, sourceName, topic, title, link, publishedAt, summary, fullSummary }) => ({
      id,
      sourceName,
      topic,
      title,
      link,
      publishedAt,
      summary,
      fullSummary,
    })),
    recent48h: recent.map(({ id, sourceName, topic, title, link, publishedAt, summary, fullSummary }) => ({
      id,
      sourceName,
      topic,
      title,
      link,
      publishedAt,
      summary,
      fullSummary,
    })),
    saved: saved.map(({ id, sourceName, topic, title, link, publishedAt, summary, fullSummary, savedAt }) => ({
      id,
      sourceName,
      topic,
      title,
      link,
      publishedAt,
      summary,
      fullSummary,
      savedAt,
    })),
    likedIds,
    pinnedIds,
  };
  saveJson(NEWS_DB_KEY, payload);
  window.dispatchEvent(new CustomEvent("pocketflow:news-db-updated", { detail: payload }));
};

export interface NewsFlowRefreshResult {
  ok: boolean;
  items: NewsItem[];
  errors: string[];
  runAt: string;
  nextRun: string;
  message: string;
  scout?: NewsScoutState;
}

export const runNewsFlowRefresh = async (options: { manual?: boolean; reason?: string } = {}): Promise<NewsFlowRefreshResult> => {
  const mode: NewsScoutState["lastMode"] = options.manual
    ? "manual"
    : options.reason?.includes("newsletter")
      ? "newsletter"
      : options.reason
        ? "scheduled"
        : "app";
  const { sources, state: scoutState } = pickScoutSources(mode);
  const manualBatchOptions = options.manual
    ? { ignoreQuarantine: true, batchSize: NEWS_MANUAL_BATCH_SIZE, maxRuntimeMs: 35_000 }
    : { ignoreQuarantine: false };
  const results = await fetchSourcesInBatches(sources, manualBatchOptions);
  const nextErrors: string[] = [];
  let checkedSourceCount = sources.length;
  let rescueItems: NewsItem[] = [];
  let allItems = results.flatMap((result) => {
    if (result.status === "fulfilled") return result.value;
    nextErrors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    return [];
  });
  if (options.manual && (allItems.length < NEWSFLOW_MANUAL_MIN_STORIES || newsFeedIsStale(allItems))) {
    const rescueSources = NEWS_MANUAL_RESCUE_SOURCES.slice(0, NEWS_MANUAL_RESCUE_MAX_SOURCES);
    const rescueResults = await fetchSourcesInBatches(rescueSources, {
      ignoreQuarantine: true,
      batchSize: NEWS_MANUAL_BATCH_SIZE,
      maxRuntimeMs: 18_000,
    });
    checkedSourceCount += rescueSources.length;
    rescueItems = rescueResults.flatMap((result) => {
      if (result.status === "fulfilled") return result.value;
      nextErrors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
      return [];
    });
    allItems = [...rescueItems, ...allItems];
  }
  const existing = safeJsonParse<NewsItem[]>(NEWS_ITEMS_KEY, []);
  const archiveBefore = safeJsonParse<NewsItem[]>(NEWSFLOW_ARCHIVE_KEY, []);
  const mergedItems = [...allItems, ...existing, ...archiveBefore];
  const archive = persistNewsFlowArchive(mergedItems);
  const feed = buildRecentFeed(mergedItems);
  const hadLivePull = allItems.length > 0;
  if (!feed.length) {
    const message = nextErrors[0] || "No news feeds returned data and no cached archive is available.";
    queueNewsFlowRetry(message, options.manual ? "manual pull had no live or archived stories" : options.reason || "scheduled refresh");
    throw new Error(`${message} Retry queued in 30 minutes.`);
  }

  const runAt = new Date().toISOString();
  const now = new Date();
  const dueSlot = getDueNewsSlot(now);
  const nextRun = nextScheduledRun(now).toISOString();
  const saved = safeJsonParse<SavedNewsItem[]>(NEWS_SAVED_KEY, []);
  const liked = safeJsonParse<string[]>(NEWS_LIKED_KEY, []);
  const pinned = safeJsonParse<string[]>(NEWS_PINNED_KEY, []);

  saveJson(NEWS_ITEMS_KEY, feed);
  if (hadLivePull) clearNewsFlowRetry();
  saveNewsScoutState(scoutState);
  localStorage.setItem(NEWS_LAST_RUN_KEY, runAt);
  localStorage.setItem(NEWS_NEXT_RUN_KEY, nextRun);
  updateAgentDb(feed, saved, liked, pinned, undefined, undefined, archive);
  refreshNewsPreferenceAgent(feed, archive, saved, liked, pinned);
  if (dueSlot !== null && !options.manual && allItems.length > 0) markNewsSlotsComplete(dueSlot, now);

  const displayErrors = !hadLivePull && nextErrors.length
    ? [`Live feeds are unavailable right now; showing ${feed.length} archived News Flow stories.`]
    : nextErrors.slice(0, 3);

  const detail: NewsFlowRefreshResult = {
    ok: hadLivePull || feed.length > 0,
    items: feed,
    errors: displayErrors,
    runAt,
    nextRun,
    scout: scoutState,
    message: options.manual
      ? hadLivePull
        ? `Manual pull checked ${checkedSourceCount} sources and imported ${allItems.length} stories.${rescueItems.length ? ` Live rescue added ${rescueItems.length}.` : ""}`
        : `Manual pull checked ${checkedSourceCount} sources but found no fresh live stories. Kept ${feed.length} archived stories visible while bad sources are skipped.`
      : `News scout ${String((scoutState.botIndex || 0) + 1).padStart(2, "0")} refreshed ${sources.length} sources by ${options.reason || "scheduler"}.`,
  };
  window.dispatchEvent(new CustomEvent("pocketflow:news-flow-refreshed", { detail }));
  return detail;
};

export const runNewsFlowScheduledRefresh = async (reason = "scheduler") => {
  const existing = safeJsonParse<NewsItem[]>(NEWS_ITEMS_KEY, []);
  const lastRun = Date.parse(localStorage.getItem(NEWS_LAST_RUN_KEY) || "");
  const scoutState = readNewsScoutState();
  const lastScoutRun = Date.parse(scoutState.lastRunAt || "");
  const stale = Number.isNaN(lastRun) || Date.now() - lastRun > STALE_AFTER_MS;
  const scoutDue = Number.isNaN(lastScoutRun) || Date.now() - lastScoutRun > NEWS_SCOUT_ROTATION_MS;
  const dueSlot = getDueNewsSlot(new Date());
  const checkedAt = new Date();
  const jobIds = dueNewsScouterJobIds(checkedAt);
  if (!dueSlot && existing.length >= TOP_BRIEF_ITEMS && !stale && !scoutDue) {
    return { ok: true, skipped: true, message: "News Flow schedule is current." };
  }
  try {
    const result = await runNewsFlowRefresh({ reason: dueSlot ? reason : "light scout rotation" });
    markNewsScouterJobs(
      jobIds.length ? jobIds : NEWS_SCOUTER_JOB_IDS,
      "succeeded",
      `${result.message} Last successful pull ${result.runAt}; next ${result.nextRun}.`,
      checkedAt,
    );
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    markNewsScouterJobs(
      jobIds.length ? jobIds : NEWS_SCOUTER_JOB_IDS,
      "failed",
      `News Flow auto refresh failed: ${message}`,
      checkedAt,
    );
    throw error;
  }
};

export const runNewsFlowNewsletterAutomation = async (reason = "scheduler") => {
  const lockToken = acquireNewsletterAutomationLock(reason);
  if (!lockToken) {
    return { ok: true, skipped: true, queued: 0, sent: 0, failed: 0, message: "Newsletter automation already running.", reason };
  }
  try {
  let feed = safeJsonParse<NewsItem[]>(NEWS_ITEMS_KEY, []);
  let archive = safeJsonParse<NewsItem[]>(NEWSFLOW_ARCHIVE_KEY, []);
  const likedIds = safeJsonParse<string[]>(NEWS_LIKED_KEY, []);
  const profiles = repairNewsletterProfilesForSingleSchedule();
  const enabledProfiles = profiles.filter((item) => item.enabled && campaignAgentCanRun(item));
  const needsNewsFeedForEnabledProfiles = enabledProfiles.some((profile) => !isPropertyDigestNewsletterProfile(profile));
  const completed = safeJsonParse<Record<string, string>>(NEWSLETTER_SCHEDULE_DONE_KEY, {});
  const attempts = safeJsonParse<Record<string, string>>(NEWSLETTER_SEND_ATTEMPTS_KEY, {});
  let outbox = safeJsonParse<Record<string, unknown>[]>(NEWSLETTER_OUTBOX_KEY, []);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let queued = 0;
  let sent = 0;
  let failed = 0;
  let changed = false;
  let message = "Newsletter schedule is current.";
  const lastRun = Date.parse(localStorage.getItem(NEWS_LAST_RUN_KEY) || "");
  const needsFreshFeed = needsNewsFeedForEnabledProfiles && (
    !feed.length ||
    feed.length < Math.min(MAX_FEED_ITEMS, 80) ||
    Number.isNaN(lastRun) ||
    Date.now() - lastRun > STALE_AFTER_MS
  );

  if (needsFreshFeed) {
    try {
      const refreshed = await runNewsFlowRefresh({ reason: `newsletter ${reason}` });
      feed = refreshed.items;
      message = refreshed.message;
    } catch (error) {
      message = `Newsletter using archived news because refresh failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  archive = safeJsonParse<NewsItem[]>(NEWSFLOW_ARCHIVE_KEY, archive);
  refreshNewsPreferenceAgent(feed, archive);

  for (const rawProfile of enabledProfiles) {
    const profile = normalizeNewsletterProfile(rawProfile);
    const isPropertyDigestProfile = isPropertyDigestNewsletterProfile(profile);
    const cadence = profile.cadence || "daily";
    const hasExplicitSchedule = Boolean((profile.sendSchedule || []).length || (profile.sendWeekdays || []).length);
    if (cadence === "manual") continue;
    if (cadence === "weekdays" && [0, 6].includes(now.getDay()) && !hasExplicitSchedule) continue;

    const sendTimes = newsletterSendTimesForDate(profile, now);
    if (!sendTimes.length) continue;
    const dueSendTimes = sendTimes.filter((sendTime) => {
      const sendMinutes = newsletterSlotMinutes(sendTime);
      const sendKey = newsletterSlotKey(profile.id, "send", now, sendTime);
      const completedWithBatch = Boolean(completed[sendKey]) && newsletterSlotHasSentBatch(outbox, profile.id, sendTime, now);
      return nowMinutes >= sendMinutes && !completedWithBatch;
    });
    let selected = selectNewsletterItems(newsletterCandidatePool(feed, archive), likedIds, profile);
    if (!isPropertyDigestProfile && dueSendTimes.length && selected.length < newsletterTargetCount(profile)) {
      try {
        const refreshed = await runNewsFlowTopicRefresh(profile, `newsletter due ${reason}`);
        feed = refreshed.items.length ? refreshed.items : feed;
        archive = refreshed.archive.length ? refreshed.archive : safeJsonParse<NewsItem[]>(NEWSFLOW_ARCHIVE_KEY, archive);
        selected = selectNewsletterItems(newsletterCandidatePool(feed, archive), likedIds, profile);
        if (selected.length < newsletterTargetCount(profile)) {
          message = `${profile.title} has ${selected.length}/${newsletterTargetCount(profile)} matching stories after ${refreshed.sources.length} source refreshes.`;
        }
      } catch (error) {
        message = `Newsletter topic refresh failed for ${profile.title}: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    if (!selected.length) {
      message = isPropertyDigestProfile
        ? `No matching apartments ready for ${profile.title}. Open the property source and update the research preferences.`
        : `No matching stories ready for ${profile.title}. Pull feed again or add more sources.`;
      for (const sendTime of dueSendTimes) {
        const attemptKey = newsletterSlotKey(profile.id, "attempt", now, sendTime);
        const lastAttempt = Date.parse(attempts[attemptKey] || "");
        if (!Number.isNaN(lastAttempt) && Date.now() - lastAttempt < 5 * 60 * 1000) continue;
        attempts[attemptKey] = new Date().toISOString();
        outbox.unshift({
          id: `newsletter-${profile.id}-${Date.now()}-${sendTime}-empty`,
          profileId: profile.id,
          profileTitle: profile.title,
          subject: profile.title,
          createdAt: new Date().toISOString(),
          sendTime,
          status: isPropertyDigestProfile ? "waiting_for_properties" : "waiting_for_news",
          deliveryError: message,
          items: [],
        });
        changed = true;
      }
      continue;
    }
    const html = renderNewsletterHtml(profile, selected);

    for (const sendTime of sendTimes) {
      const sendMinutes = newsletterSlotMinutes(sendTime);
      const composeStartMinutes = sendMinutes === 0 ? 8 * 60 : Math.max(8 * 60, sendMinutes - 8 * 60);
      const composeDue = nowMinutes >= composeStartMinutes;
      const composeKey = newsletterSlotKey(profile.id, "compose", now, sendTime);
      const sendDue = nowMinutes >= sendMinutes;
      const sendKey = newsletterSlotKey(profile.id, "send", now, sendTime);
      const alreadySentToday = outbox.some(
        (entry) =>
          entry.profileId === profile.id &&
          (entry.sendTime === sendTime || !entry.sendTime) &&
          entry.status === "sent_to_crm" &&
          isSameNewsletterDay(entry.sentAt || entry.createdAt, now),
      );
      if (alreadySentToday && !completed[sendKey]) {
        completed[sendKey] = newsletterIsoFromValue(
          outbox.find(
            (entry) =>
              entry.profileId === profile.id &&
              (entry.sendTime === sendTime || !entry.sendTime) &&
              entry.status === "sent_to_crm" &&
              isSameNewsletterDay(entry.sentAt || entry.createdAt, now),
          )?.sentAt,
        ) || new Date().toISOString();
        completed[composeKey] = completed[composeKey] || completed[sendKey];
        changed = true;
        continue;
      }

      if (sendDue && !completed[sendKey]) {
        const attemptKey = newsletterSlotKey(profile.id, "attempt", now, sendTime);
        const lastAttempt = Date.parse(attempts[attemptKey] || "");
        if (!Number.isNaN(lastAttempt) && Date.now() - lastAttempt < 5 * 60 * 1000) continue;
        const failedAttempts = newsletterFailedAttemptsForSlot(outbox, profile.id, sendTime, now);
        if (failedAttempts >= NEWSLETTER_MAX_RETRIES_PER_SLOT) {
          message = `${profile.title} delivery paused after ${NEWSLETTER_MAX_RETRIES_PER_SLOT} failed attempts for the ${sendTime} slot.`;
          continue;
        }

        const batch = {
          ...buildNewsletterBatch(profile, selected, html, "ready_for_crm_send"),
          sendTime,
        };
        outbox.unshift(batch);
        attempts[attemptKey] = new Date().toISOString();
        queued += 1;
        changed = true;

        const delivery = await sendNewsletterBatchToCrm(profile, batch);
        if (delivery.ok) {
          const sentAt = new Date().toISOString();
          completed[sendKey] = sentAt;
          completed[composeKey] = completed[composeKey] || sentAt;
          outbox = outbox.map((entry) =>
            entry.id === batch.id
              ? { ...entry, status: "sent_to_crm", sentAt, deliveredCount: delivery.sent, deliveryEndpoint: delivery.endpoint }
              : entry,
          );
          sent += delivery.sent;
          message = delivery.message;
        } else {
          outbox = outbox.map((entry) =>
            entry.id === batch.id
              ? {
                  ...entry,
                  status: "send_failed",
                  failedAt: new Date().toISOString(),
                  deliveryError: delivery.message,
                  deliveryFailureKind: delivery.failureKind || "transport",
                }
              : entry,
          );
          failed += 1;
          message = `Newsletter send needs attention: ${delivery.message}`;
        }
      } else if (composeDue && !completed[composeKey]) {
        const batch = {
          ...buildNewsletterBatch(profile, selected, html, "draft_composed_for_review"),
          sendTime,
        };
        outbox.unshift(batch);
        completed[composeKey] = String(batch.createdAt);
        queued += 1;
        changed = true;
        message = `Newsletter draft prepared: ${profile.title}.`;
      }
    }
  }

  if (changed) {
    saveJson(NEWSLETTER_SCHEDULE_DONE_KEY, completed);
    saveJson(NEWSLETTER_SEND_ATTEMPTS_KEY, attempts);
    saveJson(NEWSLETTER_OUTBOX_KEY, compactNewsletterOutbox(outbox).slice(0, 80));
    window.dispatchEvent(new CustomEvent("pocketflow:newsletter-outbox-updated"));
  }

  return {
    ok: failed === 0,
    skipped: !changed,
    queued,
    sent,
    failed,
    message,
    reason,
  };
  } finally {
    releaseNewsletterAutomationLock(lockToken);
  }
};

const syncNewsletterWatchdogWithBalossJobs = (items: NewsletterWatchdogItem[], checkedAt: string) => {
  const at = new Date(checkedAt);
  items.forEach((item) => {
    const jobId = NEWSLETTER_PROFILE_JOB_IDS[item.profileId];
    if (!jobId || item.status === "standby") return;

    const status: BalossJobStatus =
      item.status === "healthy" ? "succeeded" : item.status === "error" ? "failed" : "queued";
    const sendLabel = item.sendTime ? `slot ${item.sendTime}` : "scheduled slot";
    const detail = item.lastError ? `${item.message} ${item.lastError}` : item.message;
    markBalossJobResult(
      jobId,
      status,
      `${item.title}: ${detail} (${sendLabel}, ${item.recipients} recipient${item.recipients === 1 ? "" : "s"}, ${item.listLabel}).`,
      at,
    );
  });
};

export const runNewsFlowNewsletterHealthCheck = (reason = "mobile watchdog"): NewsletterWatchdogReport => {
  const profiles = repairNewsletterProfilesForSingleSchedule();
  const contactLists = newsletterContactListsFromStorage();
  const completed = safeJsonParse<Record<string, string>>(NEWSLETTER_SCHEDULE_DONE_KEY, {});
  const attempts = safeJsonParse<Record<string, string>>(NEWSLETTER_SEND_ATTEMPTS_KEY, {});
  const storedOutbox = safeJsonParse<Record<string, unknown>[]>(NEWSLETTER_OUTBOX_KEY, []);
  const outbox = compactNewsletterOutbox(storedOutbox);
  if (outbox.length !== storedOutbox.length) {
    saveJson(NEWSLETTER_OUTBOX_KEY, outbox.slice(0, 80));
  }
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const enabledProfiles = profiles.filter((profile) => profile.enabled && profile.cadence !== "manual" && campaignAgentCanRun(profile));
  const isWeekend = [0, 6].includes(now.getDay());
  let dueSlots = 0;
  let confirmedToday = 0;
  let failedSlots = 0;

  const items = enabledProfiles.flatMap<NewsletterWatchdogItem>((profile) => {
    const todaysSendTimes = newsletterSendTimesForDate(profile, now);
    if (!todaysSendTimes.length || (profile.cadence === "weekdays" && isWeekend && !(profile.sendSchedule || []).length)) {
      return newsletterSendTimes(profile).map((sendTime) => ({
        profileId: profile.id,
        profileName: profile.name,
        title: profile.title,
        status: "standby",
        sendTime,
        recipients: newsletterAudienceCount(profile.crmList, contactLists),
        listLabel: newsletterListLabel(profile.crmList, contactLists),
        lastSentAt: "",
        lastAttemptAt: "",
        lastError: "",
        message: "Campaign is not scheduled for today.",
      }));
    }

    return todaysSendTimes.map((sendTime) => {
      const [hour = 0, minute = 0] = sendTime.split(":").map(Number);
      const slotMinutes = hour * 60 + minute;
      const sendKey = newsletterSlotKey(profile.id, "send", now, sendTime);
      const attemptKey = newsletterSlotKey(profile.id, "attempt", now, sendTime);
      const recipients = newsletterAudienceCount(profile.crmList, contactLists);
      const matchingBatches = outbox
        .filter(
          (entry) =>
            entry.profileId === profile.id &&
            (entry.sendTime === sendTime || !entry.sendTime) &&
            (isSameNewsletterDay(entry.createdAt, now) ||
              isSameNewsletterDay(entry.sentAt, now) ||
              isSameNewsletterDay(entry.failedAt, now)),
        )
        .sort(
          (a, b) =>
            newsletterTimestampMs(b.sentAt || b.failedAt || b.createdAt) -
            newsletterTimestampMs(a.sentAt || a.failedAt || a.createdAt),
        );
      const latestBatch = matchingBatches[0] as
        | {
            status?: string;
            sentAt?: string;
            failedAt?: string;
            deliveryError?: string;
            deliveryFailureKind?: "transport" | "recipient" | "configuration";
            createdAt?: number | string;
            items?: unknown[];
          }
        | undefined;
      const completedWithBatch = Boolean(completed[sendKey]) && newsletterSlotHasSentBatch(outbox, profile.id, sendTime, now);
      const sentAt = completedWithBatch ? completed[sendKey] : newsletterIsoFromValue(latestBatch?.sentAt);
      const attemptedAt =
        attempts[attemptKey] ||
        newsletterIsoFromValue(latestBatch?.createdAt) ||
        newsletterIsoFromValue(latestBatch?.failedAt);
      const due = nowMinutes >= slotMinutes;
      const graceActive = due && nowMinutes - slotMinutes < NEWSLETTER_SEND_GRACE_MINUTES && !attemptedAt && !sentAt;
      if (due) dueSlots += 1;
      if (sentAt) confirmedToday += 1;

      let status: NewsletterWatchdogStatus = sentAt ? "healthy" : due && !graceActive ? "warning" : "standby";
      let message = sentAt
        ? "Today send confirmed."
        : due
          ? graceActive
            ? "Send window is open; waiting for automation to finish."
            : "Due slot is not confirmed yet."
          : "Waiting for scheduled send window.";
      let lastError = "";

      if (recipients <= 0) {
        status = "warning";
        message = "No recipients in selected list.";
        lastError = "Audience empty";
      }
      if (!sentAt && isNewsletterContentWait(latestBatch)) {
        status = "warning";
        lastError = latestBatch?.deliveryError || "Waiting for matching stories";
        message = "No matching stories yet; source refresh retry is queued.";
      } else if (!sentAt && latestBatch?.status === "send_failed") {
        failedSlots += 1;
        lastError = latestBatch.deliveryError || "CRM send failed";
        if (latestBatch.deliveryFailureKind === "recipient") {
          status = "error";
          message = "Recipient validation failed; inspect the rejected address(es).";
        } else if (latestBatch.deliveryFailureKind === "configuration") {
          status = "error";
          message = "Newsletter delivery is not configured.";
        } else {
          status = "warning";
          message = "Delivery transport unavailable; no send confirmed yet.";
        }
      }

      return {
        profileId: profile.id,
        profileName: profile.name,
        title: profile.title,
        status,
        sendTime,
        recipients,
        listLabel: newsletterListLabel(profile.crmList, contactLists),
        lastSentAt: sentAt,
        lastAttemptAt: attemptedAt,
        lastError,
        message,
      };
    });
  });

  const status: NewsletterWatchdogStatus = !enabledProfiles.length
    ? "standby"
    : items.some((item) => item.status === "error")
      ? "error"
      : items.some((item) => item.status === "warning")
        ? "warning"
        : "healthy";
  const summary =
    status === "healthy"
      ? `${confirmedToday}/${Math.max(1, dueSlots)} due newsletter slot${dueSlots === 1 ? "" : "s"} confirmed.`
      : status === "warning"
        ? "Newsletter watchdog found a campaign that needs attention."
        : status === "error"
          ? "Newsletter watchdog found a failed CRM delivery."
          : "No automatic newsletter campaign is armed.";
  const report: NewsletterWatchdogReport = {
    kind: "pocketflow.newsletter.watchdog",
    status,
    checkedAt: now.toISOString(),
    reason,
    summary,
    activeProfiles: enabledProfiles.length,
    dueSlots,
    confirmedToday,
    failedSlots,
    items,
  };
  saveJson(NEWSLETTER_HEALTH_KEY, report);
  const agentDb = safeJsonParse<Record<string, unknown>>(NEWS_DB_KEY, {});
  saveJson(NEWS_DB_KEY, { ...agentDb, newsletterWatchdog: report });
  syncNewsletterWatchdogWithBalossJobs(items, report.checkedAt);
  window.dispatchEvent(new CustomEvent("pocketflow:newsletter-health-updated", { detail: report }));
  return report;
};

interface NewsFlowAppProps {
  onNotify?: (message: string, type: "success" | "info" | "warn") => void;
}

export default function NewsFlowApp({ onNotify }: NewsFlowAppProps) {
  const [items, setItems] = useState<NewsItem[]>(() => safeJsonParse(NEWS_ITEMS_KEY, []));
  const [savedItems, setSavedItems] = useState<SavedNewsItem[]>(() => safeJsonParse(NEWS_SAVED_KEY, []));
  const [likedIds, setLikedIds] = useState<string[]>(() => safeJsonParse(NEWS_LIKED_KEY, []));
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => safeJsonParse(NEWS_PINNED_KEY, []));
  const [seenIds, setSeenIds] = useState<string[]>(() => safeJsonParse(NEWS_SEEN_KEY, []));
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [dbOpen, setDbOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>(["all"]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [lastRunAt, setLastRunAt] = useState(() => localStorage.getItem(NEWS_LAST_RUN_KEY) || "");
  const [nextRunAt, setNextRunAt] = useState(() => localStorage.getItem(NEWS_NEXT_RUN_KEY) || nextScheduledRun().toISOString());
  const [errors, setErrors] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<NewsFlowTab>("feed");
  const [globalInterests, setGlobalInterests] = useState<string[]>(() => safeJsonParse(NEWS_GLOBAL_INTERESTS_KEY, []));
  const [preferredSources, setPreferredSources] = useState<string[]>(() =>
    safeJsonParse(NEWS_GLOBAL_SOURCES_KEY, activeSourcePool(NEWS_SOURCES).filter((source) => source.priority >= 8).map((source) => source.id)),
  );
  const [profiles, setProfiles] = useState<NewsletterProfile[]>(() => {
    const saved = safeJsonParse<NewsletterProfile[]>(NEWSLETTER_PROFILES_KEY, []);
    return repairNewsletterProfilesForSingleSchedule(saved.length ? saved : defaultNewsletterProfiles());
  });
  const [activeProfileId, setActiveProfileId] = useState(() => localStorage.getItem(NEWSLETTER_ACTIVE_PROFILE_KEY) || "");
  const [contactLists, setContactLists] = useState<NewsletterContactList[]>(() =>
    newsletterContactListsFromStorage(),
  );
  const [activeContactListId, setActiveContactListId] = useState(() =>
    localStorage.getItem(NEWSLETTER_ACTIVE_CONTACT_LIST_KEY) || PUBLIC_NEWS_LIST_ID,
  );
  const [expandedContactListId, setExpandedContactListId] = useState(() =>
    localStorage.getItem(NEWSLETTER_ACTIVE_CONTACT_LIST_KEY) || PUBLIC_NEWS_LIST_ID,
  );
  const [bulkContactsText, setBulkContactsText] = useState("");
  const [quickContactName, setQuickContactName] = useState("");
  const [quickContactEmail, setQuickContactEmail] = useState("");
  const [listContactName, setListContactName] = useState("");
  const [listContactEmail, setListContactEmail] = useState("");
  const [contactFinderQueries, setContactFinderQueries] = useState<Record<string, string>>({});
  const [webhookPayloadText, setWebhookPayloadText] = useState("");
  const [confirmBatch, setConfirmBatch] = useState<ReturnType<typeof buildNewsletterBatch> | null>(null);
  const [newsletterArchiveVersion, setNewsletterArchiveVersion] = useState(0);
  const [newsletterSettingsSavedAt, setNewsletterSettingsSavedAt] = useState<string | null>(null);
  const [expandedCampaignEditorId, setExpandedCampaignEditorId] = useState("");
  const [campaignDrafts, setCampaignDrafts] = useState<Record<string, NewsletterProfile>>({});
  const [newsletterHealth, setNewsletterHealth] = useState<NewsletterWatchdogReport | null>(() =>
    safeJsonParse<NewsletterWatchdogReport | null>(NEWSLETTER_HEALTH_KEY, null),
  );
  const [visibleFeedCount, setVisibleFeedCount] = useState(FEED_INITIAL_VISIBLE);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const refreshRunRef = useRef(0);

  useEffect(() => {
    if (localStorage.getItem(NEWSLETTER_ARCHIVE_RESET_KEY) === NEWSLETTER_ARCHIVE_RESET_VERSION) return;
    saveJson(NEWSLETTER_OUTBOX_KEY, []);
    saveJson(NEWSLETTER_SCHEDULE_DONE_KEY, {});
    const normalizedProfiles = reconcileNewsletterCampaignAgents(normalizeNewsletterProfiles(profiles));
    saveJson(NEWSLETTER_PROFILES_KEY, normalizedProfiles);
    saveJson(NEWSLETTER_CONTACT_LISTS_KEY, normalizeNewsletterContactLists(contactLists));
    localStorage.setItem(NEWSLETTER_ARCHIVE_RESET_KEY, NEWSLETTER_ARCHIVE_RESET_VERSION);
    setProfiles(normalizedProfiles);
    setContactLists(normalizeNewsletterContactLists(contactLists));
    setNewsletterArchiveVersion((version) => version + 1);
    onNotify?.("Newsletter archive reset. AI and Fashion campaigns are clean.", "success");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const activeSourceIds = new Set(activeSourcePool(NEWS_SOURCES).map((source) => source.id));
    const sanitizedSources = preferredSources.filter((sourceId) => activeSourceIds.has(sourceId));
    if (sanitizedSources.length === preferredSources.length) return;
    setPreferredSources(sanitizedSources);
    saveJson(NEWS_GLOBAL_SOURCES_KEY, sanitizedSources);
  }, [preferredSources]);

  useEffect(() => {
    updateAgentDb(items, savedItems, likedIds, pinnedIds, globalInterests, preferredSources);
    refreshNewsPreferenceAgent(items, undefined, savedItems, likedIds, pinnedIds);
  }, [globalInterests, items, likedIds, pinnedIds, preferredSources, savedItems]);

  useEffect(() => {
    const syncNewsletterHealth = (event?: Event) => {
      const detail = (event as CustomEvent<NewsletterWatchdogReport>)?.detail;
      setNewsletterHealth(detail || safeJsonParse<NewsletterWatchdogReport | null>(NEWSLETTER_HEALTH_KEY, null));
      setNewsletterArchiveVersion((version) => version + 1);
    };
    window.addEventListener("pocketflow:newsletter-health-updated", syncNewsletterHealth as EventListener);
    window.addEventListener("pocketflow:newsletter-outbox-updated", syncNewsletterHealth as EventListener);
    setNewsletterHealth(runNewsFlowNewsletterHealthCheck("news screen"));
    return () => {
      window.removeEventListener("pocketflow:newsletter-health-updated", syncNewsletterHealth as EventListener);
      window.removeEventListener("pocketflow:newsletter-outbox-updated", syncNewsletterHealth as EventListener);
    };
  }, []);

  const markSeen = (id: string) => {
    if (seenIds.includes(id)) return;
    const next = [id, ...seenIds].slice(0, MAX_FEED_ITEMS * 2);
    setSeenIds(next);
    saveJson(NEWS_SEEN_KEY, next);
  };

  const refreshNews = async (manual = false) => {
    if (status === "loading" && !manual) return;
    const runId = refreshRunRef.current + 1;
    refreshRunRef.current = runId;
    setStatus("loading");
    setErrors(manual ? ["Manual pull started. Replacing any stale refresh."] : []);
    try {
      const result = await runNewsFlowRefresh({ manual, reason: "news app" });
      if (runId !== refreshRunRef.current) return;
      setItems(result.items);
      setLastRunAt(result.runAt);
      setNextRunAt(result.nextRun);
      setErrors(result.errors);
      setStatus("idle");
      onNotify?.(manual ? "News Flow refreshed." : "News Flow updated.", "success");
    } catch (error) {
      if (runId !== refreshRunRef.current) return;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const fallbackItems = safeJsonParse<NewsItem[]>(NEWS_ITEMS_KEY, []);
      const fallbackArchive = safeJsonParse<NewsItem[]>(NEWSFLOW_ARCHIVE_KEY, []);
      const fallbackFeed = buildRecentFeed([...fallbackItems, ...fallbackArchive]);
      if (fallbackFeed.length) {
        queueNewsFlowRetry(errorMessage, manual ? "manual pull fell back to archive" : "visible refresh fell back to archive");
        setItems(fallbackFeed);
        setStatus("idle");
        setErrors([`Live pull failed, showing archived News Flow memory: ${errorMessage}`]);
        onNotify?.("News Flow is showing archived stories; retry queued in 30 minutes.", "warn");
        return;
      }
      setStatus("error");
      queueNewsFlowRetry(errorMessage, manual ? "manual pull failed" : "visible refresh failed");
      setErrors([`${errorMessage} Retry queued in 30 minutes.`]);
      onNotify?.("News Flow could not refresh any feeds or archive; retry queued.", "warn");
    }
  };

  useEffect(() => {
    const syncFromStorage = (event?: Event) => {
      const detail = (event as CustomEvent<NewsFlowRefreshResult>)?.detail;
      setItems(detail?.items || safeJsonParse(NEWS_ITEMS_KEY, []));
      setLastRunAt(detail?.runAt || localStorage.getItem(NEWS_LAST_RUN_KEY) || "");
      setNextRunAt(detail?.nextRun || localStorage.getItem(NEWS_NEXT_RUN_KEY) || nextScheduledRun().toISOString());
      if (detail?.errors) setErrors(detail.errors);
    };
    window.addEventListener("pocketflow:news-flow-refreshed", syncFromStorage as EventListener);

    const last = Date.parse(lastRunAt);
    const lastScout = Date.parse(readNewsScoutState().lastRunAt || "");
    if (
      newsFlowRetryDue() ||
      items.length < TOP_BRIEF_ITEMS ||
      Number.isNaN(last) ||
      Date.now() - last > STALE_AFTER_MS ||
      Number.isNaN(lastScout) ||
      Date.now() - lastScout > NEWS_SCOUT_ROTATION_MS
    ) {
      void refreshNews(false);
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const next = Date.parse(localStorage.getItem(NEWS_NEXT_RUN_KEY) || "");
      const scout = Date.parse(readNewsScoutState().lastRunAt || "");
      const scoutDue = Number.isNaN(scout) || Date.now() - scout > NEWS_SCOUT_ROTATION_MS;
      const retryDue = newsFlowRetryDue();
      if (retryDue || (!Number.isNaN(next) && Date.now() >= next) || scoutDue) void refreshNews(false);
    }, 180_000);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pocketflow:news-flow-refreshed", syncFromStorage as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSet = (
    id: string,
    values: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    key: string,
  ) => {
    const next = values.includes(id) ? values.filter((item) => item !== id) : [id, ...values];
    setter(next);
    saveJson(key, next);
  };

  const updateGlobalInterests = (value: string) => {
    const next = splitInterestText(value);
    setGlobalInterests(next);
    saveJson(NEWS_GLOBAL_INTERESTS_KEY, next);
  };

  const togglePreferredSource = (sourceId: string) => {
    const next = preferredSources.includes(sourceId)
      ? preferredSources.filter((id) => id !== sourceId)
      : [...preferredSources, sourceId];
    setPreferredSources(next);
    saveJson(NEWS_GLOBAL_SOURCES_KEY, next);
  };

  const toggleFeedFilter = (filterId: string) => {
    if (filterId === "all") {
      setActiveFilters(["all"]);
      return;
    }

    setActiveFilters((current) => {
      const withoutAll = current.filter((id) => id !== "all");
      const next = withoutAll.includes(filterId)
        ? withoutAll.filter((id) => id !== filterId)
        : [...withoutAll, filterId];
      return next.length ? next : ["all"];
    });
  };

  const toggleSaved = (item: NewsItem) => {
    const exists = savedItems.some((saved) => saved.id === item.id);
    const next = exists
      ? savedItems.filter((saved) => saved.id !== item.id)
      : [{ ...item, savedAt: new Date().toISOString() }, ...savedItems].slice(0, 80);
    setSavedItems(next);
    saveJson(NEWS_SAVED_KEY, next);
    onNotify?.(exists ? "Removed from News DB." : "Saved to News DB for Baloss LLM.", exists ? "info" : "success");
  };

  const activeProfile = useMemo(() => {
    const profile = profiles.find((entry) => entry.id === activeProfileId) || profiles[0];
    if (!activeProfileId && profile) {
      localStorage.setItem(NEWSLETTER_ACTIVE_PROFILE_KEY, profile.id);
    }
    return profile;
  }, [activeProfileId, profiles]);

  const crmContacts = useMemo(() => localCrmContactsFromStorage(), [contactLists, activeTab]);
  const crmAccounts = useMemo(() => crmEmailAccounts(), []);
  const crmLists = useMemo(() => crmRecipientLists(contactLists), [contactLists]);
  const newsletterOutbox = useMemo(
    () => safeJsonParse<ReturnType<typeof buildNewsletterBatch>[]>(NEWSLETTER_OUTBOX_KEY, []),
    [activeTab, profiles, confirmBatch, newsletterArchiveVersion],
  );
  const selectedNewsletterOutbox = useMemo(
    () => newsletterOutbox.filter((batch) => batch.profileId === activeProfile?.id),
    [activeProfile?.id, newsletterOutbox],
  );
  const selectedNewsletterAudit = useMemo(
    () => buildNewsletterCampaignAudit(activeProfile, selectedNewsletterOutbox as Array<Record<string, unknown>>, contactLists),
    [activeProfile, contactLists, selectedNewsletterOutbox],
  );
  const activeContactList = useMemo(
    () => contactLists.find((list) => list.id === activeContactListId) || contactLists[0],
    [activeContactListId, contactLists],
  );
  const activeProfileListId = activeProfile?.crmList.startsWith("list:") ? activeProfile.crmList.slice(5) : "";
  const activeProfileContactList = useMemo(
    () => contactLists.find((list) => list.id === activeProfileListId) || null,
    [activeProfileListId, contactLists],
  );
  const newsletterItems = useMemo(
    () => (activeProfile ? selectNewsletterItems(items, likedIds, activeProfile) : []),
    [activeProfile, items, likedIds],
  );
  const activeProfileIsPropertyDigest = Boolean(activeProfile && isPropertyDigestNewsletterProfile(activeProfile));
  const activeProfileItemLabel = activeProfileIsPropertyDigest ? "apartments" : "stories";
  const newsletterHtml = useMemo(
    () => (activeProfile ? renderNewsletterHtml(activeProfile, newsletterItems) : ""),
    [activeProfile, newsletterItems],
  );

  useEffect(() => {
    saveJson(NEWSLETTER_RECIPIENT_AUDIT_KEY, {
      updatedAt: new Date().toISOString(),
      activeProfileId: activeProfile?.id || "",
      audit: selectedNewsletterAudit,
    });
  }, [activeProfile?.id, selectedNewsletterAudit]);

  const saveProfiles = (next: NewsletterProfile[]) => {
    const normalized = reconcileNewsletterCampaignAgents(normalizeNewsletterProfiles(next));
    setProfiles(normalized);
    saveJson(NEWSLETTER_PROFILES_KEY, normalized);
    setNewsletterSettingsSavedAt(new Date().toISOString());
  };

  const saveContactLists = (next: NewsletterContactList[]) => {
    const normalized = normalizeNewsletterContactLists(next);
    setContactLists(normalized);
    saveJson(NEWSLETTER_CONTACT_LISTS_KEY, normalized);
    if (!normalized.some((list) => list.id === activeContactListId)) {
      const fallbackId = normalized[0]?.id || PUBLIC_NEWS_LIST_ID;
      setActiveContactListId(fallbackId);
      localStorage.setItem(NEWSLETTER_ACTIVE_CONTACT_LIST_KEY, fallbackId);
    }
    if (!normalized.some((list) => list.id === expandedContactListId)) {
      setExpandedContactListId(normalized[0]?.id || PUBLIC_NEWS_LIST_ID);
    }
  };

  const createContactList = (name: string, contacts: NewsletterContact[] = []) => {
    const now = new Date().toISOString();
    const token = createNewsletterWebhookToken();
    const id = createNewsletterListId(name);
    return {
      id,
      name,
      description: "Campaign audience. Manual contacts and webhook signups land here.",
      contacts,
      webhookEnabled: true,
      webhookToken: token,
      webhookEndpoint: `/api/newsflow/newsletter-signup/${id}?token=${token}`,
      createdAt: now,
      updatedAt: now,
    };
  };

  const selectProfile = (id: string) => {
    setActiveProfileId(id);
    localStorage.setItem(NEWSLETTER_ACTIVE_PROFILE_KEY, id);
  };

  const selectContactList = (id: string, open = false) => {
    setActiveContactListId(id);
    localStorage.setItem(NEWSLETTER_ACTIVE_CONTACT_LIST_KEY, id);
    if (open) setExpandedContactListId(id);
  };

  const updateProfile = (patch: Partial<NewsletterProfile>) => {
    if (!activeProfile) return;
    saveProfiles(profiles.map((profile) => (profile.id === activeProfile.id ? { ...profile, ...patch } : profile)));
  };

  const updateProfileById = (profileId: string, patch: Partial<NewsletterProfile>) => {
    saveProfiles(profiles.map((profile) => (profile.id === profileId ? { ...profile, ...patch } : profile)));
  };

  const beginCampaignEdit = (profile: NewsletterProfile) => {
    setCampaignDrafts((current) => ({ ...current, [profile.id]: normalizeNewsletterProfile(profile) }));
    selectProfile(profile.id);
    setExpandedCampaignEditorId(profile.id);
  };

  const updateCampaignDraft = (profileId: string, patch: Partial<NewsletterProfile>) => {
    const source = campaignDrafts[profileId] || profiles.find((profile) => profile.id === profileId);
    if (!source) return;
    const nextDraft = normalizeNewsletterProfile({ ...source, ...patch });
    setCampaignDrafts((current) => ({
      ...current,
      [profileId]: nextDraft,
    }));
    saveProfiles(profiles.map((profile) => (profile.id === profileId ? { ...profile, ...nextDraft } : profile)));
  };

  const saveCampaignDraft = (profileId: string) => {
    const draft = campaignDrafts[profileId];
    if (!draft) return;
    updateProfileById(profileId, draft);
    setCampaignDrafts((current) => {
      const next = { ...current };
      delete next[profileId];
      return next;
    });
    setExpandedCampaignEditorId("");
    onNotify?.(`${draft.name} saved.`, "success");
  };

  const cancelCampaignEdit = (profileId: string) => {
    setCampaignDrafts((current) => {
      const next = { ...current };
      delete next[profileId];
      return next;
    });
    setExpandedCampaignEditorId("");
    onNotify?.("Campaign changes discarded.", "info");
  };

  const toggleCampaignEnabled = (profileId: string) => {
    const profile = profiles.find((entry) => entry.id === profileId);
    if (!profile) return;
    updateProfileById(profileId, { enabled: !profile.enabled });
    onNotify?.(`${profile.name} ${profile.enabled ? "paused" : "started"}.`, profile.enabled ? "info" : "success");
  };

  const toggleNewsletterTopic = (topicId: string) => {
    if (!activeProfile) return;
    const selectedTopics = newsletterTopicIds(activeProfile);
    const nextTopics = selectedTopics.includes(topicId)
      ? selectedTopics.filter((topic) => topic !== topicId)
      : [...selectedTopics, topicId];
    const safeTopics = nextTopics.length ? nextTopics : ["ai-labs"];
    updateProfile({ topicFilters: safeTopics, topicFilter: safeTopics[0] });
  };

  const updateNewsletterSendTimes = (times: string[]) => {
    const safeTimes = normalizeNewsletterSendTimes(times);
    if (activeProfile?.sendSchedule?.length) {
      const existingSchedule = normalizeNewsletterSendSchedule(activeProfile.sendSchedule);
      const defaultWeekday = existingSchedule[0]?.weekday ?? activeProfile.sendWeekdays?.[0] ?? new Date().getDay();
      const sendSchedule = safeTimes.map((time, index) => ({
        weekday: existingSchedule[index]?.weekday ?? defaultWeekday,
        time,
      }));
      updateProfile({ sendTime: safeTimes[0], sendTimes: safeTimes, sendSchedule });
      return;
    }
    updateProfile({ sendTime: safeTimes[0], sendTimes: safeTimes, sendSchedule: [] });
  };

  const updateNewsletterSendTime = (index: number, time: string) => {
    if (!activeProfile) return;
    const nextTimes = newsletterSendTimes(activeProfile).map((entry, entryIndex) => (entryIndex === index ? time : entry));
    updateNewsletterSendTimes(nextTimes);
  };

  const addNewsletterSendTime = () => {
    if (!activeProfile) return;
    const existing = newsletterSendTimes(activeProfile);
    const fallback = ["08:00", "12:00", "18:00", "20:00", "00:00"].find((time) => !existing.includes(time)) || "12:00";
    updateNewsletterSendTimes([...existing, fallback]);
  };

  const removeNewsletterSendTime = (index: number) => {
    if (!activeProfile) return;
    const nextTimes = newsletterSendTimes(activeProfile).filter((_, entryIndex) => entryIndex !== index);
    updateNewsletterSendTimes(nextTimes);
  };

  const addProfile = () => {
    const list = createContactList(`Newsletter ${profiles.length + 1} audience`);
    const nextProfile = {
      ...defaultNewsletterProfile(),
      id: `newsletter_${Date.now()}`,
      name: `Newsletter ${profiles.length + 1}`,
      crmList: `list:${list.id}`,
    };
    saveContactLists([list, ...contactLists]);
    saveProfiles([nextProfile, ...profiles]);
    selectProfile(nextProfile.id);
    setActiveContactListId(list.id);
    setActiveTab("settings");
  };

  const duplicateProfile = () => {
    if (!activeProfile) return;
    const sourceList = activeProfileContactList;
    const list = createContactList(`${activeProfile.name} copy audience`, sourceList?.contacts || []);
    const nextProfile = {
      ...activeProfile,
      id: `newsletter_${Date.now()}`,
      name: `${activeProfile.name} Copy`,
      crmList: `list:${list.id}`,
      lastBuiltAt: undefined,
      lastQueuedAt: undefined,
    };
    saveContactLists([list, ...contactLists]);
    saveProfiles([nextProfile, ...profiles]);
    selectProfile(nextProfile.id);
    setActiveContactListId(list.id);
    setActiveTab("settings");
  };

  const deleteProfileById = (profileId: string) => {
    if (profiles.length <= 1) {
      onNotify?.("Keep at least one newsletter campaign.", "warn");
      return;
    }
    const target = profiles.find((profile) => profile.id === profileId);
    if (!target) return;
    const next = profiles.filter((profile) => profile.id !== profileId);
    saveProfiles(next);
    const ownedListId = target.crmList.startsWith("list:") ? target.crmList.slice(5) : "";
    if (ownedListId && ![PUBLIC_NEWS_LIST_ID, SECOND_LIFE_NEWS_LIST_ID, KAPRI_NEWS_LIST_ID, PROPERTY_DIGEST_NEWS_LIST_ID].includes(ownedListId)) {
      saveContactLists(contactLists.filter((list) => list.id !== ownedListId));
    }
    setCampaignDrafts((current) => {
      const nextDrafts = { ...current };
      delete nextDrafts[profileId];
      return nextDrafts;
    });
    setExpandedCampaignEditorId("");
    const nextActiveId = next[0]?.id || "";
    selectProfile(nextActiveId);
    onNotify?.("Newsletter campaign removed.", "info");
  };

  const deleteProfile = () => {
    if (activeProfile) deleteProfileById(activeProfile.id);
  };

  const handleLogoUpload = (file?: File) => {
    if (!file || !activeProfile) return;
    const reader = new FileReader();
    reader.onload = () => updateProfile({ logoDataUrl: String(reader.result || "") });
    reader.readAsDataURL(file);
  };

  const handleCampaignLogoUpload = (profileId: string, file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (campaignDrafts[profileId]) {
        updateCampaignDraft(profileId, { logoDataUrl: String(reader.result || "") });
      } else {
        updateProfileById(profileId, { logoDataUrl: String(reader.result || "") });
      }
      onNotify?.("Campaign image updated.", "success");
    };
    reader.readAsDataURL(file);
  };

  const queueNewsletter = () => {
    if (!activeProfile) return;
    if (!newsletterItems.length) {
      onNotify?.(
        activeProfileIsPropertyDigest
          ? "No property digest apartments are ready yet. Open the property source and save the current search preferences first."
          : `No ${newsletterTopicSummary(activeProfile)} stories are ready yet. Pull fresh news first, then queue the newsletter.`,
        "warn",
      );
      return;
    }
    const batch = buildNewsletterBatch(activeProfile, newsletterItems, newsletterHtml, "ready_for_crm_review");
    setConfirmBatch(batch);
  };

  const confirmQueueNewsletter = () => {
    if (!activeProfile || !confirmBatch) return;
    const createdAt = new Date().toISOString();
    const outbox = safeJsonParse<Record<string, unknown>[]>(NEWSLETTER_OUTBOX_KEY, []);
    const batch = {
      ...confirmBatch,
      confirmedAt: createdAt,
      status: "ready_for_crm_review",
      delivery: {
        sent: 0,
        opened: 0,
        bounced: 0,
        health: "waiting_for_crm_send",
      },
    };
    saveJson(NEWSLETTER_OUTBOX_KEY, [batch, ...outbox].slice(0, 50));
    window.dispatchEvent(new CustomEvent("pocketflow:newsletter-package-ready", { detail: batch }));
    updateProfile({ lastBuiltAt: createdAt, lastQueuedAt: createdAt });
    setConfirmBatch(null);
    onNotify?.("Newsletter package prepared for CRM review.", "success");
  };

  const addContactList = () => {
    const next = createContactList(`Audience ${contactLists.length + 1}`);
    saveContactLists([next, ...contactLists]);
    selectContactList(next.id, true);
    setExpandedContactListId(next.id);
  };

  const updateContactList = (id: string, patch: Partial<NewsletterContactList>) => {
    saveContactLists(contactLists.map((list) => (
      list.id === id ? { ...list, ...patch, updatedAt: new Date().toISOString() } : list
    )));
  };

  const removeContactList = (id: string) => {
    if (id === PUBLIC_NEWS_LIST_ID || contactLists.length <= 1) return;
    const next = contactLists.filter((list) => list.id !== id);
    saveContactLists(next);
    const fallback = `list:${PUBLIC_NEWS_LIST_ID}`;
    saveProfiles(profiles.map((profile) => profile.crmList === `list:${id}` ? { ...profile, crmList: fallback } : profile));
  };

  const importContactsToList = (listId: string) => {
    const targetList = contactLists.find((list) => list.id === listId);
    if (!targetList) return;
    const incoming = parseNewsletterContacts(bulkContactsText);
    if (!incoming.length) {
      onNotify?.("No valid email contacts found in that paste.", "warn");
      return;
    }
    updateContactList(targetList.id, {
      contacts: mergeNewsletterContacts(targetList.contacts, incoming),
    });
    setBulkContactsText("");
    onNotify?.(`${incoming.length} contacts imported into ${targetList.name}.`, "success");
  };

  const importContacts = () => {
    if (!activeContactList) return;
    importContactsToList(activeContactList.id);
  };

  const addManualContactToList = (listId: string) => {
    const targetList = contactLists.find((list) => list.id === listId);
    if (!targetList) return;
    const email = listContactEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      onNotify?.("Add a valid email before saving this contact.", "warn");
      return;
    }
    updateContactList(targetList.id, {
      contacts: mergeNewsletterContacts(targetList.contacts, [{
        name: listContactName.trim() || undefined,
        email,
      }]),
    });
    setListContactName("");
    setListContactEmail("");
    onNotify?.(`Contact added to ${targetList.name}.`, "success");
  };

  const addNewsletterContactToList = (listId: string, contact: NewsletterContact, source = "crm") => {
    const targetList = contactLists.find((list) => list.id === listId);
    if (!targetList) return;
    const email = normalizeEmail(contact.email);
    if (!email || !email.includes("@")) {
      onNotify?.("Add a valid email before saving this contact.", "warn");
      return;
    }
    const before = targetList.contacts.length;
    const nextContact: NewsletterContact = {
      name: contact.name?.trim() || undefined,
      email,
      tags: Array.from(new Set([...(contact.tags || []), source])).filter(Boolean),
    };
    const merged = mergeNewsletterContacts(targetList.contacts, [nextContact]);
    updateContactList(targetList.id, { contacts: merged });
    if (merged.length === before) {
      onNotify?.(`${email} is already in ${targetList.name}.`, "info");
      return;
    }
    setContactFinderQueries((queries) => ({ ...queries, [listId]: "" }));
    onNotify?.(`${email} added to ${targetList.name}.`, "success");
  };

  const addTypedFinderContactToList = (listId: string) => {
    const query = (contactFinderQueries[listId] || "").trim();
    const email = extractEmail(query);
    if (!email) {
      onNotify?.("Type a CRM name or paste a valid email address.", "warn");
      return;
    }
    const name = query
      .replace(email, "")
      .replace(/[<>()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    addNewsletterContactToList(listId, { name: name || undefined, email, tags: ["typed"] }, "typed");
  };

  const removeContactFromList = (listId: string, email: string) => {
    const targetList = contactLists.find((list) => list.id === listId);
    if (!targetList) return;
    updateContactList(targetList.id, {
      contacts: targetList.contacts.filter((contact) => contact.email.toLowerCase() !== email.toLowerCase()),
    });
  };

  const ensureCampaignAudience = () => {
    if (!activeProfile) return null;
    if (activeProfileContactList) {
      setActiveContactListId(activeProfileContactList.id);
      return activeProfileContactList;
    }
    const list = createContactList(`${activeProfile.name} audience`);
    saveContactLists([list, ...contactLists]);
    updateProfile({ crmList: `list:${list.id}` });
    setActiveContactListId(list.id);
    onNotify?.(`Dedicated audience created for ${activeProfile.name}.`, "success");
    return list;
  };

  const addQuickCampaignContact = () => {
    const list = ensureCampaignAudience();
    if (!list) return;
    const contact = parseNewsletterContacts(JSON.stringify([{
      name: quickContactName.trim(),
      email: quickContactEmail.trim(),
      tags: ["manual", activeProfile?.name || "campaign"],
    }]))[0];
    if (!contact) {
      onNotify?.("Enter a valid email for this campaign.", "warn");
      return;
    }
    updateContactList(list.id, {
      contacts: mergeNewsletterContacts(list.contacts, [contact]),
    });
    setQuickContactName("");
    setQuickContactEmail("");
    onNotify?.(`${contact.email} added to ${list.name}.`, "success");
  };

  const importWebhookPayloadToCampaign = () => {
    const list = ensureCampaignAudience();
    if (!list) return;
    const incoming = parseNewsletterContacts(webhookPayloadText).map((contact) => ({
      ...contact,
      tags: Array.from(new Set([...(contact.tags || []), "webhook"])),
    }));
    if (!incoming.length) {
      onNotify?.("No valid webhook contacts found.", "warn");
      return;
    }
    updateContactList(list.id, {
      contacts: mergeNewsletterContacts(list.contacts, incoming),
      webhookLastIngestAt: new Date().toISOString(),
    });
    setWebhookPayloadText("");
    onNotify?.(`${incoming.length} webhook contacts added to ${list.name}.`, "success");
  };

  const copyCampaignWebhook = async () => {
    const list = ensureCampaignAudience();
    if (!list) return;
    try {
      await navigator.clipboard.writeText(newsletterWebhookUrl(list));
      onNotify?.("Campaign webhook copied.", "success");
    } catch {
      onNotify?.("Could not copy webhook URL.", "warn");
    }
  };

  useEffect(() => {
    const ingestQueuedSignups = () => {
      const queue = safeJsonParse<NewsletterWebhookQueueItem[]>(NEWSLETTER_WEBHOOK_QUEUE_KEY, []);
      if (!queue.length) return;
      const now = new Date().toISOString();
      const nextLists = contactLists.map((list) => {
        const accepted = queue.filter((entry) =>
          entry.listId === list.id &&
          list.webhookEnabled &&
          (!entry.token || entry.token === list.webhookToken) &&
          entry.email
        );
        if (!accepted.length) return list;
        return {
          ...list,
          contacts: mergeNewsletterContacts(list.contacts, accepted.map(({ listId: _listId, token: _token, source: _source, createdAt: _createdAt, ...contact }) => ({
            ...contact,
            tags: Array.from(new Set([...(contact.tags || []), "webhook"])),
          }))),
          webhookLastIngestAt: now,
          updatedAt: now,
        };
      });
      const acceptedKeys = new Set(nextLists.flatMap((list) =>
        queue
          .filter((entry) => entry.listId === list.id && list.webhookEnabled && (!entry.token || entry.token === list.webhookToken) && entry.email)
          .map((entry) => `${entry.listId}:${entry.email}:${entry.createdAt}`),
      ));
      if (!acceptedKeys.size) return;
      const remaining = queue.filter((entry) => !acceptedKeys.has(`${entry.listId}:${entry.email}:${entry.createdAt}`));
      saveContactLists(nextLists);
      saveJson(NEWSLETTER_WEBHOOK_QUEUE_KEY, remaining);
      onNotify?.(`${acceptedKeys.size} newsletter signup${acceptedKeys.size === 1 ? "" : "s"} synced from webhook queue.`, "success");
    };

    (window as unknown as {
      PocketFlowNewsletterIntake?: (payload: Omit<NewsletterWebhookQueueItem, "createdAt"> | Omit<NewsletterWebhookQueueItem, "createdAt">[]) => void;
    }).PocketFlowNewsletterIntake = (payload) => {
      const rows = Array.isArray(payload) ? payload : [payload];
      const queue = safeJsonParse<NewsletterWebhookQueueItem[]>(NEWSLETTER_WEBHOOK_QUEUE_KEY, []);
      saveJson(NEWSLETTER_WEBHOOK_QUEUE_KEY, [
        ...queue,
        ...rows.map((row) => ({ ...row, createdAt: new Date().toISOString() })),
      ]);
      ingestQueuedSignups();
    };

    ingestQueuedSignups();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") ingestQueuedSignups();
    }, 60_000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactLists]);

  const copyNewsletterHtml = async () => {
    try {
      await navigator.clipboard.writeText(newsletterHtml);
      onNotify?.("Newsletter HTML copied.", "success");
    } catch {
      onNotify?.("Clipboard unavailable. Preview is still ready.", "warn");
    }
  };

  const orderedItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filters = activeFilters.length ? activeFilters : ["all"];
    return [...items]
      .filter((item) => filters.includes("all") || filters.some((filterId) => matchesResearchFilter(item, filterId)))
      .filter((item) => {
        if (!normalized) return true;
        return searchableNewsText(item).includes(normalized);
      })
      .sort((a, b) => {
        const pinDiff = Number(pinnedIds.includes(b.id)) - Number(pinnedIds.includes(a.id));
        if (pinDiff) return pinDiff;
        return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
      });
  }, [activeFilters, items, pinnedIds, query]);

  const agentDb = useMemo(() => safeJsonParse<Record<string, unknown>>(NEWS_DB_KEY, {}), [items, savedItems, likedIds, pinnedIds]);
  useEffect(() => {
    setVisibleFeedCount(FEED_INITIAL_VISIBLE);
    setShowFullHistory(false);
  }, [activeFilters, activeTab, query]);
  const visibleOrderedItems = activeTab === "feed" && !showFullHistory ? orderedItems.slice(0, visibleFeedCount) : orderedItems;
  const leadItem = visibleOrderedItems[0];
  const secondaryItems = visibleOrderedItems.slice(1);
  const unreadCount = orderedItems.filter((item) => !seenIds.includes(item.id)).length;
  const hasMoreFeedItems = activeTab === "feed" && !showFullHistory && visibleFeedCount < orderedItems.length;

  return (
    <div className="pocketflow-screen-scroll flex-1 min-h-0 min-w-0 overflow-y-auto bg-[#f6f0df] text-[#151515] animate-fade-in">
      <div className="mx-auto w-full max-w-[430px] px-3 pt-4 pb-24">
        <header className="border-b-2 border-[#151515] pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] font-mono font-black uppercase tracking-[0.18em] text-[#5f5748]">
              <Newspaper className="h-4 w-4" />
              PocketFlow Press
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("settings")}
                className={`h-10 rounded-lg px-3 text-[9px] font-mono font-black uppercase tracking-[0.14em] active:scale-[0.98] ${
                  activeTab === "settings"
                    ? "bg-[#b7791f] text-[#151515]"
                    : "border border-[#c8bda5] bg-[#fffaf0] text-[#151515]"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </span>
              </button>
              <button
                onClick={() => void refreshNews(true)}
                className="h-10 rounded-lg bg-[#151515] px-3 text-[10px] font-mono font-black uppercase tracking-[0.16em] text-[#f8f1df] active:scale-[0.98]"
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCw className={`h-4 w-4 ${status === "loading" ? "animate-spin" : ""}`} />
                  Pull
                </span>
              </button>
            </div>
          </div>

          <h1 className="mt-3 text-center font-serif text-[40px] font-black leading-none tracking-tight text-[#111]">
            News Flow
          </h1>
          <div className="mt-2 flex items-center justify-center gap-2 border-y border-[#c8bda5] py-2 text-[9px] font-mono font-black uppercase tracking-[0.16em] text-[#6c6252]">
            <span>{unreadCount} new</span>
            <span className="h-1 w-1 rounded-full bg-[#6c6252]" />
            <span>48h active</span>
            <span className="h-1 w-1 rounded-full bg-[#6c6252]" />
            <span>newsflow archive</span>
            <span className="h-1 w-1 rounded-full bg-[#6c6252]" />
            <span>{lastRunAt ? formatDateTime(lastRunAt) : "Pending"}</span>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#c8bda5] bg-[#fffaf0] px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-[#6c6252]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search brief..."
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#151515] outline-none placeholder:text-[#8e846f]"
            />
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto overscroll-x-contain pb-1 scrollbar-none">
            {orderedNewsResearchFilters.map((filter) => {
              const active = activeFilters.includes(filter.id) || (filter.id === "all" && activeFilters.includes("all"));
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => toggleFeedFilter(filter.id)}
                  aria-pressed={active}
                  className={`shrink-0 rounded-md border px-2.5 py-1 text-[8px] font-mono font-black uppercase tracking-[0.14em] transition active:scale-[0.98] ${
                    active
                      ? "border-[#151515] bg-[#151515] text-[#f8f1df]"
                      : "border-[#c8bda5] bg-[#fffaf0] text-[#423b31]"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {([
              ["feed", "Feed", Newspaper],
              ["newsletter", "Newsletter", Mail],
              ["campaigns", "Campaigns", Send],
              ["settings", "Settings", Settings],
            ] as const).map(([tab, label, Icon]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`h-10 rounded-lg border text-[8px] font-mono font-black uppercase tracking-[0.14em] transition active:scale-[0.98] ${
                  activeTab === tab
                    ? "border-[#151515] bg-[#151515] text-[#f8f1df]"
                    : "border-[#c8bda5] bg-[#fffaf0] text-[#423b31]"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </span>
              </button>
            ))}
          </div>
        </header>

        {activeTab === "feed" && <div className="grid grid-cols-3 border-b border-[#c8bda5] text-center">
          <div className="border-r border-[#c8bda5] py-2">
            <span className="block text-[8px] font-mono uppercase tracking-[0.14em] text-[#796f5e]">Next</span>
            <strong className="block text-[11px] font-black text-[#151515]">{nextRunAt ? formatDateTime(nextRunAt) : "Auto"}</strong>
          </div>
          <div className="border-r border-[#c8bda5] py-2">
            <span className="block text-[8px] font-mono uppercase tracking-[0.14em] text-[#796f5e]">Saved</span>
            <strong className="block text-[11px] font-black text-[#151515]">{savedItems.length}</strong>
          </div>
          <div className="py-2">
            <span className="block text-[8px] font-mono uppercase tracking-[0.14em] text-[#796f5e]">Shown</span>
            <strong className="block text-[11px] font-black text-[#151515]">{visibleOrderedItems.length}</strong>
          </div>
        </div>}

        {errors.length > 0 && (
          <div className="mt-3 rounded-lg bg-[#fff7ed] border border-[#f59e0b]/30 p-3 text-sm text-[#92400e]">
            <strong className="block text-[10px] font-mono uppercase tracking-[0.18em] mb-1">Feed note</strong>
            {errors.slice(0, 2).join(" | ")}
            {errors.length > 2 ? ` | ${errors.length - 2} more source notes hidden.` : ""}
          </div>
        )}

        {activeTab === "feed" && <main className="pt-3">
          {leadItem && (() => {
            const expanded = expandedIds.includes(leadItem.id);
            const unseen = !seenIds.includes(leadItem.id);
            const liked = likedIds.includes(leadItem.id);
            const pinned = pinnedIds.includes(leadItem.id);
            const saved = savedItems.some((savedItem) => savedItem.id === leadItem.id);

            return (
              <article
                data-pf-virtual-card="true"
                className={`border-b-2 pb-4 ${pinned ? "border-[#b7791f]" : "border-[#151515]"}`}
              >
                <button
                  onClick={() => {
                    markSeen(leadItem.id);
                    setExpandedIds((values) => expanded ? values.filter((id) => id !== leadItem.id) : [leadItem.id, ...values]);
                  }}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between gap-2 text-[9px] font-mono font-black uppercase tracking-[0.16em] text-[#7a705f]">
                    <span>{leadItem.sourceName}</span>
                    <span>{leadItem.topic}</span>
                    <span>{unseen ? "New" : formatDateTime(leadItem.publishedAt)}</span>
                  </div>
                  <h2 className={`mt-2 font-serif text-[28px] leading-[0.98] tracking-tight ${unseen ? "font-black text-[#111]" : "font-bold text-[#4a4338]"}`}>
                    {leadItem.title}
                  </h2>
                  <p className="mt-3 text-[15px] leading-6 text-[#3f3a32]">
                    {expanded ? leadItem.fullSummary : leadItem.summary}
                  </p>
                </button>

                <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    onClick={() => toggleSet(leadItem.id, likedIds, setLikedIds, NEWS_LIKED_KEY)}
                    className={`h-9 rounded-lg border px-2.5 text-[9px] font-mono font-black uppercase tracking-[0.12em] ${liked ? "border-rose-700 bg-rose-700 text-white" : "border-[#c8bda5] bg-[#fffaf0] text-[#151515]"}`}
                  >
                    <Heart className={`inline h-3.5 w-3.5 ${liked ? "fill-current" : ""}`} /> Like
                  </button>
                  <button
                    onClick={() => toggleSet(leadItem.id, pinnedIds, setPinnedIds, NEWS_PINNED_KEY)}
                    className={`h-9 rounded-lg border px-2.5 text-[9px] font-mono font-black uppercase tracking-[0.12em] ${pinned ? "border-[#b7791f] bg-[#f6c453] text-black" : "border-[#c8bda5] bg-[#fffaf0] text-[#151515]"}`}
                  >
                    <Pin className={`inline h-3.5 w-3.5 ${pinned ? "fill-current" : ""}`} /> Pin
                  </button>
                  <button
                    onClick={() => toggleSaved(leadItem)}
                    className={`h-9 rounded-lg border px-2.5 text-[9px] font-mono font-black uppercase tracking-[0.12em] ${saved ? "border-[#166534] bg-[#166534] text-white" : "border-[#c8bda5] bg-[#fffaf0] text-[#151515]"}`}
                  >
                    {saved ? <Bookmark className="inline h-3.5 w-3.5 fill-current" /> : <Save className="inline h-3.5 w-3.5" />} Save
                  </button>
                  <a
                    href={leadItem.link}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => markSeen(leadItem.id)}
                    className="h-9 rounded-lg bg-[#151515] px-2.5 text-[9px] font-mono font-black uppercase tracking-[0.12em] text-[#f8f1df] inline-flex items-center gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Read
                  </a>
                </div>
              </article>
            );
          })()}

          <div className="divide-y divide-[#c8bda5]">
          {secondaryItems.map((item, index) => {
            const expanded = expandedIds.includes(item.id);
            const unseen = !seenIds.includes(item.id);
            const liked = likedIds.includes(item.id);
            const pinned = pinnedIds.includes(item.id);
            const saved = savedItems.some((savedItem) => savedItem.id === item.id);

            return (
              <article
                key={item.id}
                data-pf-virtual-card="true"
                className={`py-3 transition ${pinned ? "bg-[#fff5cf]" : ""}`}
                style={{ contentVisibility: "auto", containIntrinsicSize: "260px" } as React.CSSProperties}
              >
                <button
                  onClick={() => {
                    markSeen(item.id);
                    setExpandedIds((values) => expanded ? values.filter((id) => id !== item.id) : [item.id, ...values]);
                  }}
                  className="w-full text-left"
                >
                  <div className="grid grid-cols-[34px_1fr_18px] items-start gap-2">
                    <div className="pt-1 text-center font-serif text-2xl font-black text-[#151515]">
                      {index + 2}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[8px] font-mono uppercase tracking-[0.16em] text-[#7a705f]">
                        <span>{item.sourceName}</span>
                        <span>/</span>
                        <span>{item.topic || "news"}</span>
                        <span>/</span>
                        <span>{unseen ? "New" : formatDateTime(item.publishedAt)}</span>
                      </div>
                      <h2 className={`mt-1 font-serif text-[20px] leading-[1.08] ${unseen ? "font-black text-[#151515]" : "font-semibold text-[#51493d]"}`}>{item.title}</h2>
                      <p className="mt-1.5 text-[13px] leading-5 text-[#4d473c]">{expanded ? item.fullSummary : item.summary}</p>
                    </div>
                    <ChevronDown className={`mt-2 h-4 w-4 text-[#6c6252] transition ${expanded ? "rotate-180" : ""}`} />
                  </div>
                </button>

                <div className="mt-2 ml-[42px] flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    onClick={() => toggleSet(item.id, likedIds, setLikedIds, NEWS_LIKED_KEY)}
                    className={`h-8 rounded-lg border px-2 text-[8px] font-mono font-black uppercase tracking-[0.12em] ${liked ? "border-rose-700 bg-rose-700 text-white" : "border-[#c8bda5] bg-[#fffaf0] text-[#151515]"}`}
                  >
                    <Heart className={`inline h-3 w-3 ${liked ? "fill-current" : ""}`} /> Like
                  </button>
                  <button
                    onClick={() => toggleSet(item.id, pinnedIds, setPinnedIds, NEWS_PINNED_KEY)}
                    className={`h-8 rounded-lg border px-2 text-[8px] font-mono font-black uppercase tracking-[0.12em] ${pinned ? "border-[#b7791f] bg-[#f6c453] text-black" : "border-[#c8bda5] bg-[#fffaf0] text-[#151515]"}`}
                  >
                    <Pin className={`inline h-3 w-3 ${pinned ? "fill-current" : ""}`} /> Pin
                  </button>
                  <button
                    onClick={() => toggleSaved(item)}
                    className={`h-8 rounded-lg border px-2 text-[8px] font-mono font-black uppercase tracking-[0.12em] ${saved ? "border-[#166534] bg-[#166534] text-white" : "border-[#c8bda5] bg-[#fffaf0] text-[#151515]"}`}
                  >
                    {saved ? <Bookmark className="inline h-3 w-3 fill-current" /> : <Save className="inline h-3 w-3" />} Save
                  </button>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => markSeen(item.id)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#151515] px-2 text-[8px] font-mono font-black uppercase tracking-[0.12em] text-[#f8f1df] whitespace-nowrap"
                  >
                    <ExternalLink className="h-3 w-3" /> Read
                  </a>
                </div>
              </article>
            );
          })}
          </div>

          {hasMoreFeedItems && (
            <button
              type="button"
              onClick={() => setShowFullHistory(true)}
              className="mt-4 h-11 w-full rounded-lg border border-[#c8bda5] bg-[#fffaf0] text-[10px] font-mono font-black uppercase tracking-[0.16em] text-[#151515] active:scale-[0.98]"
            >
              Open full history ({orderedItems.length} collected)
            </button>
          )}

          {activeTab === "feed" && showFullHistory && orderedItems.length > FEED_INITIAL_VISIBLE && (
            <button
              type="button"
              onClick={() => {
                setVisibleFeedCount(FEED_INITIAL_VISIBLE);
                setShowFullHistory(false);
              }}
              className="mt-4 h-11 w-full rounded-lg border border-[#c8bda5] bg-[#151515] text-[10px] font-mono font-black uppercase tracking-[0.16em] text-[#f8f1df] active:scale-[0.98]"
            >
              Show latest 100 only
            </button>
          )}

          {!orderedItems.length && (
            <div className="rounded-lg border border-[#c8bda5] bg-[#fffaf0] p-8 text-center text-[#6c6252]">
              {status === "loading" ? "Collecting the first digest..." : "No news in this filter yet."}
            </div>
          )}
        </main>}

        {activeTab === "newsletter" && activeProfile && (
          <main className="space-y-4 pt-4">
            <section className="rounded-lg border-2 border-[#151515] bg-[#fffaf0] p-4 shadow-[5px_5px_0_#151515]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Campaign profiles</p>
                  <h2 className="mt-1 font-serif text-2xl font-black leading-none">Newsletter campaigns</h2>
                  <p className="mt-2 text-xs font-semibold text-[#6c6252]">
                    Pick a campaign, edit its feed, time, sender, list and item count.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addProfile}
                  className="h-11 shrink-0 rounded-lg bg-[#151515] px-3 text-[9px] font-mono font-black uppercase tracking-[0.14em] text-[#f8f1df]"
                >
                  New
                </button>
              </div>

              <div className="mt-4 flex gap-3 overflow-x-auto pb-1 scrollbar-none">
                {profiles.map((profile) => {
                  const selected = activeProfile.id === profile.id;
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => selectProfile(profile.id)}
                      className={`w-[250px] shrink-0 rounded-lg border p-3 text-left transition active:scale-[0.98] ${
                        selected
                          ? "border-[#151515] bg-[#151515] text-[#f8f1df]"
                          : "border-[#c8bda5] bg-[#f6f0df] text-[#151515]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-[11px] font-mono uppercase tracking-[0.16em]">{profile.name}</strong>
                        <span className={`rounded-md px-2 py-1 text-[8px] font-mono font-black uppercase tracking-[0.12em] ${
                          profile.enabled ? "bg-[#166534] text-white" : "bg-[#e8dec8] text-[#6c6252]"
                        }`}>
                          {profile.enabled ? "On" : "Off"}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-semibold">
                        <span className="rounded-md border border-current/15 px-2 py-1">Times {newsletterSendTimeSummary(profile)}</span>
                        <span className="rounded-md border border-current/15 px-2 py-1">
                          {profile.topCount} {isPropertyDigestNewsletterProfile(profile) ? "apartments" : "articles"}
                        </span>
                        <span className="rounded-md border border-current/15 px-2 py-1">{newsletterTopicSummary(profile)}</span>
                        <span className="rounded-md border border-current/15 px-2 py-1">{profile.cadence || "daily"}</span>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap break-words text-[10px] opacity-75">{newsletterListLabel(profile.crmList, contactLists)} / {profile.fromAccount}</p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("settings")}
                  className="h-10 rounded-lg border border-[#151515] bg-[#151515] text-[8px] font-mono font-black uppercase tracking-[0.14em] text-[#f8f1df]"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={duplicateProfile}
                  className="h-10 rounded-lg border border-[#c8bda5] bg-[#f6f0df] text-[8px] font-mono font-black uppercase tracking-[0.14em] text-[#151515]"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={deleteProfile}
                  disabled={profiles.length <= 1}
                  className="h-10 rounded-lg border border-[#c8bda5] bg-[#f6f0df] text-[8px] font-mono font-black uppercase tracking-[0.14em] text-[#151515] disabled:opacity-35"
                >
                  Remove
                </button>
              </div>
            </section>

            <section className="rounded-lg border-2 border-[#151515] bg-[#fffaf0] p-4 shadow-[6px_6px_0_#151515]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Newsletter preview</p>
                  <h2 className="mt-1 font-serif text-2xl font-black leading-none">{activeProfile.title}</h2>
                  <p className="mt-2 text-xs font-semibold text-[#6c6252]">
                    {newsletterItems.length} {activeProfileItemLabel} / {newsletterAudienceCount(activeProfile.crmList, contactLists)} recipients / {activeProfile.fromAccount}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={queueNewsletter}
                  className="h-12 rounded-lg bg-[#151515] px-3 text-[9px] font-mono font-black uppercase tracking-[0.14em] text-[#f8f1df]"
                >
                  <Send className="mr-1.5 inline h-4 w-4" />
                  Prep
                </button>
              </div>
              <div className="mt-3 rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-3 text-[12px] leading-5 text-[#4d473c]">
                {activeProfileIsPropertyDigest
                  ? "Property Digest sends apartment profiles from your saved filters, likes, selected listings and viewed homes. News stories are ignored for this campaign."
                  : "Liked stories from the last 24h are selected first. If there are not enough likes, News Flow ranks by source priority, recency, topic weight and personal relevance."}
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-[#c8bda5] bg-white">
              <div className="flex items-center justify-between border-b border-[#c8bda5] bg-[#151515] px-3 py-2 text-[#f8f1df]">
                <span className="text-[9px] font-mono font-black uppercase tracking-[0.18em]">Receiver view</span>
                <button
                  type="button"
                  onClick={() => void copyNewsletterHtml()}
                  className="rounded-md border border-white/20 px-2 py-1 text-[8px] font-mono font-black uppercase tracking-[0.14em]"
                >
                  Copy HTML
                </button>
              </div>
              <div className="max-h-[620px] overflow-auto bg-white" dangerouslySetInnerHTML={{ __html: newsletterHtml }} />
            </section>
          </main>
        )}

        {activeTab === "campaigns" && (
          <main className="space-y-4 pt-4">
            <section className="rounded-lg border-2 border-[#151515] bg-[#fffaf0] p-4 shadow-[5px_5px_0_#151515]">
              <p className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Campaign station</p>
              <h2 className="mt-1 font-serif text-2xl font-black leading-none">Active newsletters</h2>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-3">
                  <span className="block text-[8px] font-mono uppercase tracking-[0.14em] text-[#796f5e]">Active</span>
                  <strong className="text-xl font-black">{profiles.filter((profile) => profile.enabled).length}</strong>
                </div>
                <div className="rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-3">
                  <span className="block text-[8px] font-mono uppercase tracking-[0.14em] text-[#796f5e]">Queued</span>
                  <strong className="text-xl font-black">{newsletterOutbox.length}</strong>
                </div>
                <div className="rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-3">
                  <span className="block text-[8px] font-mono uppercase tracking-[0.14em] text-[#796f5e]">Lists</span>
                  <strong className="text-xl font-black">{contactLists.length}</strong>
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-[#c8bda5] bg-white/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[8px] font-mono font-black uppercase tracking-[0.16em] text-[#7a705f]">Select campaign</span>
                  <button
                    type="button"
                    onClick={addProfile}
                    className="rounded-md bg-[#151515] px-3 py-2 text-[8px] font-mono font-black uppercase tracking-[0.14em] text-[#f8f1df]"
                  >
                    New
                  </button>
                </div>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {profiles.map((profile) => (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => selectProfile(profile.id)}
                      className={`shrink-0 rounded-xl border-2 px-3 py-2 text-left ${
                        activeProfile?.id === profile.id
                          ? "border-[#151515] bg-[#151515] text-[#f8f1df]"
                          : profile.enabled
                            ? "border-[#166534] bg-[#eefbf2] text-[#151515]"
                            : "border-[#991b1b] bg-[#fff4ef] text-[#151515]"
                      }`}
                    >
                      <span className="block text-[9px] font-mono font-black uppercase tracking-[0.14em]">{profile.name}</span>
                      <span className="mt-1 block text-[9px] font-semibold opacity-75">
                        {profile.enabled ? "On" : "Paused"} / {newsletterSendTimeSummary(profile)}
                      </span>
                    </button>
                  ))}
                </div>
                {activeProfile && (
                  <p className="mt-3 text-[11px] font-semibold text-[#6c6252]">
                    Showing only <span className="font-black text-[#151515]">{activeProfile.name}</span>: editor, schedule, health and archive are filtered to this campaign.
                  </p>
                )}
              </div>
            </section>

            {newsletterHealth && (
              <section
                className={`rounded-lg border-2 p-4 ${
                  newsletterHealth.status === "error"
                    ? "border-[#9f1f1f] bg-[#fff0ee]"
                    : newsletterHealth.status === "warning"
                      ? "border-[#c58a00] bg-[#fff6d8]"
                      : newsletterHealth.status === "healthy"
                        ? "border-[#0d7a3a] bg-[#eefbf2]"
                        : "border-[#c8bda5] bg-[#fffaf0]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">
                      Mobile watchdog
                    </p>
                    <h3 className="mt-1 text-xl font-black">Newsletter health</h3>
                    <p className="mt-1 text-sm font-semibold text-[#5d5649]">{newsletterHealth.summary}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewsletterHealth(runNewsFlowNewsletterHealthCheck("manual campaign check"));
                      onNotify?.("Newsletter watchdog refreshed.", "info");
                    }}
                    className="rounded-lg border border-[#151515] bg-[#151515] px-3 py-2 text-[8px] font-mono font-black uppercase tracking-[0.14em] text-[#f8f1df]"
                  >
                    Check
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                  {[
                    ["State", newsletterHealth.status],
                    ["Active", newsletterHealth.activeProfiles],
                    ["Due", newsletterHealth.dueSlots],
                    ["Sent", newsletterHealth.confirmedToday],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-[#c8bda5] bg-white/50 p-2">
                      <span className="block text-[7px] font-mono uppercase tracking-[0.12em] text-[#796f5e]">{label}</span>
                      <strong className="text-xs font-black uppercase">{value}</strong>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-2">
                  {newsletterHealth.items
                    .filter((item) => !activeProfile?.id || item.profileId === activeProfile.id)
                    .map((item) => (
                    <div key={`${item.profileId}-${item.sendTime}`} className="rounded-lg border border-[#c8bda5] bg-white/55 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <strong className="min-w-0 truncate text-sm">{item.profileName}</strong>
                        <span
                          className={`shrink-0 rounded-md px-2 py-1 text-[7px] font-mono font-black uppercase tracking-[0.12em] ${
                            item.status === "error"
                              ? "bg-[#9f1f1f] text-white"
                              : item.status === "warning"
                                ? "bg-[#ffcf44] text-[#151515]"
                                : item.status === "healthy"
                                  ? "bg-[#0d7a3a] text-white"
                                  : "bg-[#151515] text-[#f8f1df]"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-[#6c6252]">
                        {item.sendTime} / {item.listLabel} / {item.recipients} recipients
                      </p>
                      <p className="mt-1 text-[11px] font-semibold text-[#5d5649]">{item.message}</p>
                      {item.lastError && <p className="mt-1 text-[10px] font-bold text-[#9f1f1f]">{item.lastError}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-3">
              {(activeProfile ? [activeProfile] : []).map((profile) => {
                const normalizedProfile = normalizeNewsletterProfile(profile);
                const audience = newsletterAudienceCount(normalizedProfile.crmList, contactLists);
                const list = normalizedProfile.crmList.startsWith("list:")
                  ? contactLists.find((entry) => entry.id === normalizedProfile.crmList.slice(5))
                  : null;
                const batches = newsletterOutbox.filter((batch) => batch.profileId === normalizedProfile.id);
                const sent = batches.reduce((total, batch) => total + Number((batch as { delivery?: { sent?: number } }).delivery?.sent || 0), 0);
                const opened = batches.reduce((total, batch) => total + Number((batch as { delivery?: { opened?: number } }).delivery?.opened || 0), 0);
                const editorOpen = expandedCampaignEditorId === normalizedProfile.id;
                const campaignDraft = campaignDrafts[normalizedProfile.id] || normalizedProfile;
                const profileIsPropertyDigest = isPropertyDigestNewsletterProfile(normalizedProfile);
                const campaignRunning = Boolean(normalizedProfile.enabled);
                return (
                  <article
                    key={normalizedProfile.id}
                    className={`rounded-lg border-2 p-4 ${
                      campaignRunning
                        ? "border-[#166534] bg-[#f1fbf3] shadow-[4px_4px_0_#166534]"
                        : "border-[#991b1b] bg-[#fff4ef] shadow-[4px_4px_0_#991b1b]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={`text-[9px] font-mono font-black uppercase tracking-[0.18em] ${campaignRunning ? "text-[#166534]" : "text-[#991b1b]"}`}>
                          {campaignRunning ? "Running automatically" : "Stopped / paused"}
                        </p>
                        <h3 className="mt-1 text-lg font-black">{normalizedProfile.name}</h3>
                        <p className="mt-1 text-xs font-semibold text-[#6c6252]">{newsletterSendTimeSummary(normalizedProfile)} / {normalizedProfile.cadence} / {newsletterListLabel(normalizedProfile.crmList, contactLists)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => toggleCampaignEnabled(normalizedProfile.id)}
                          className={`h-12 rounded-xl border-2 px-4 text-[10px] font-mono font-black uppercase tracking-[0.16em] shadow-[2px_2px_0_#151515] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                            campaignRunning
                              ? "border-[#991b1b] bg-[#991b1b] text-white"
                              : "border-[#166534] bg-[#166534] text-white"
                          }`}
                          aria-pressed={campaignRunning}
                        >
                          {campaignRunning ? "Stop" : "Start"}
                        </button>
                        <button
                          type="button"
                          onClick={() => (editorOpen ? cancelCampaignEdit(normalizedProfile.id) : beginCampaignEdit(normalizedProfile))}
                          className="h-10 rounded-lg border border-[#151515] px-3 text-[8px] font-mono font-black uppercase tracking-[0.14em]"
                        >
                          {editorOpen ? "Cancel" : "Edit"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteProfileById(normalizedProfile.id)}
                          disabled={profiles.length <= 1}
                          className="h-9 rounded-lg border border-[#991b1b] px-3 text-[8px] font-mono font-black uppercase tracking-[0.14em] text-[#991b1b] disabled:opacity-35"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div
                      className={`mt-3 rounded-xl border-2 px-3 py-2 text-[10px] font-mono font-black uppercase tracking-[0.12em] ${
                        campaignRunning
                          ? "border-[#166534] bg-white text-[#166534]"
                          : "border-[#991b1b] bg-white text-[#991b1b]"
                      }`}
                    >
                      {campaignRunning
                        ? `Auto-send armed. Next schedule remains ${newsletterSendTimeSummary(normalizedProfile)}.`
                        : `Paused. Schedule saved as ${newsletterSendTimeSummary(normalizedProfile)} and resumes from that slot when started.`}
                    </div>
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                      {[
                        ["Audience", audience],
                        ["Batches", batches.length],
                        ["Sent", sent],
                        ["Opened", opened],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-2">
                          <span className="block text-[7px] font-mono uppercase tracking-[0.12em] text-[#796f5e]">{label}</span>
                          <strong className="text-sm font-black">{value}</strong>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-[11px] font-semibold text-[#6c6252]">
                      Last queued: {normalizedProfile.lastQueuedAt ? formatDateTime(normalizedProfile.lastQueuedAt) : "Not queued yet"}
                    </p>
                    <div className="mt-3 rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-3 text-[11px] font-semibold text-[#6c6252]">
                      <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-[#7a705f]">Signup intake</span>
                      <p className="mt-1">
                        {list?.webhookEnabled ? "Webhook ready" : "Webhook paused"} / {list?.webhookLastIngestAt ? `last ${formatDateTime(list.webhookLastIngestAt)}` : "no web signups yet"}
                      </p>
                    </div>
                    {editorOpen && (
                      <div className="mt-3 space-y-3 rounded-lg border-2 border-[#151515] bg-[#f6f0df] p-3 shadow-[4px_4px_0_#151515]">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Manual campaign editor</p>
                            <h4 className="mt-1 text-base font-black">Text, examples and images</h4>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => saveCampaignDraft(normalizedProfile.id)}
                              className="h-9 rounded-md bg-[#166534] px-3 text-[8px] font-mono font-black uppercase tracking-[0.12em] text-white"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => cancelCampaignEdit(normalizedProfile.id)}
                              className="h-9 rounded-md border border-[#151515] px-3 text-[8px] font-mono font-black uppercase tracking-[0.12em]"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                saveCampaignDraft(normalizedProfile.id);
                                selectProfile(normalizedProfile.id);
                                setActiveTab("settings");
                              }}
                              className="h-9 rounded-md bg-[#151515] px-3 text-[8px] font-mono font-black uppercase tracking-[0.12em] text-[#f8f1df]"
                            >
                              Save & full settings
                            </button>
                          </div>
                        </div>
                        <label className="block">
                          <span className="text-[8px] font-mono font-black uppercase tracking-[0.16em] text-[#7a705f]">Campaign name</span>
                          <input
                            value={campaignDraft.name}
                            onChange={(event) => updateCampaignDraft(normalizedProfile.id, { name: event.target.value })}
                            className="mt-1 h-11 w-full rounded-lg border border-[#c8bda5] bg-[#fffaf0] px-3 text-sm font-bold outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[8px] font-mono font-black uppercase tracking-[0.16em] text-[#7a705f]">Newsletter title</span>
                          <input
                            value={campaignDraft.title}
                            onChange={(event) => updateCampaignDraft(normalizedProfile.id, { title: event.target.value })}
                            className="mt-1 h-11 w-full rounded-lg border border-[#c8bda5] bg-[#fffaf0] px-3 text-sm font-bold outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[8px] font-mono font-black uppercase tracking-[0.16em] text-[#7a705f]">Intro / campaign text</span>
                          <textarea
                            value={campaignDraft.intro}
                            onChange={(event) => updateCampaignDraft(normalizedProfile.id, { intro: event.target.value })}
                            placeholder="Write the campaign opening, examples, tone and instructions here."
                            className="mt-1 min-h-[110px] w-full rounded-lg border border-[#c8bda5] bg-[#fffaf0] p-3 text-xs font-semibold leading-5 outline-none"
                          />
                        </label>
                        <label className="block">
                          <span className="text-[8px] font-mono font-black uppercase tracking-[0.16em] text-[#7a705f]">Examples / interests</span>
                          <textarea
                            value={(campaignDraft.customInterests || []).join("\n")}
                            onChange={(event) => updateCampaignDraft(normalizedProfile.id, { customInterests: splitInterestText(event.target.value) })}
                            placeholder="One per line. Example: table rules, DJ night, cocktail masterclass, specific brands, tone examples..."
                            className="mt-1 min-h-[90px] w-full rounded-lg border border-[#c8bda5] bg-[#fffaf0] p-3 text-xs font-semibold leading-5 outline-none"
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#151515] bg-[#fffaf0] text-[8px] font-mono font-black uppercase tracking-[0.12em]">
                            <Upload className="h-4 w-4" />
                            Add image/logo
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(event) => handleCampaignLogoUpload(normalizedProfile.id, event.target.files?.[0])}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => updateCampaignDraft(normalizedProfile.id, { logoDataUrl: "" })}
                            disabled={!campaignDraft.logoDataUrl}
                            className="h-11 rounded-lg border border-[#991b1b] bg-[#fff0ee] text-[8px] font-mono font-black uppercase tracking-[0.12em] text-[#991b1b] disabled:opacity-35"
                          >
                            <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                            Remove image
                          </button>
                        </div>
                        {campaignDraft.logoDataUrl && (
                          <div className="rounded-lg border border-[#c8bda5] bg-[#fffaf0] p-2">
                            <img src={campaignDraft.logoDataUrl} alt={`${campaignDraft.name} campaign`} className="max-h-32 w-full rounded-md object-contain" />
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block">
                            <span className="text-[8px] font-mono font-black uppercase tracking-[0.16em] text-[#7a705f]">
                              {profileIsPropertyDigest ? "Top apartments" : "Top items"}
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={campaignDraft.topCount}
                              onChange={(event) => updateCampaignDraft(normalizedProfile.id, { topCount: Number(event.target.value) || campaignDraft.topCount })}
                              className="mt-1 h-11 w-full rounded-lg border border-[#c8bda5] bg-[#fffaf0] px-3 text-xs font-black outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[8px] font-mono font-black uppercase tracking-[0.16em] text-[#7a705f]">Rhythm</span>
                            <select
                              value={campaignDraft.cadence || "daily"}
                              onChange={(event) => updateCampaignDraft(normalizedProfile.id, { cadence: event.target.value as NewsletterProfile["cadence"] })}
                              className="mt-1 h-11 w-full rounded-lg border border-[#c8bda5] bg-[#fffaf0] px-3 text-xs font-black outline-none"
                            >
                              <option value="daily">Daily automation</option>
                              <option value="weekdays">Weekdays only</option>
                              <option value="manual">Manual prep only</option>
                            </select>
                          </label>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </section>

            <section className="rounded-lg border border-[#c8bda5] bg-[#fffaf0] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Selected schedule</p>
                  <h3 className="mt-1 text-xl font-black">{activeProfile?.name || "Campaign"} slots</h3>
                  <p className="mt-1 text-sm font-semibold text-[#5d5649]">
                    Only the selected campaign is shown here: send times, audience, sender and latest queue state.
                  </p>
                </div>
                <span className="rounded-md border border-[#c8bda5] bg-white/50 px-2 py-1 text-[8px] font-mono font-black uppercase tracking-[0.14em] text-[#6c6252]">
                  {activeProfile ? newsletterSendTimes(activeProfile).length : 0} slots
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {(activeProfile ? [activeProfile] : []).map((profile) => {
                  const sendTimes = newsletterSendTimes(profile);
                  const batches = selectedNewsletterOutbox.filter((batch) => batch.profileId === profile.id);
                  const latestBatch = batches[0];
                  const audience = newsletterAudienceCount(profile.crmList, contactLists);
                  return (
                    <article key={profile.id} className="rounded-lg border border-[#c8bda5] bg-white/60 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <strong className="block text-sm font-black">{profile.name}</strong>
                          <p className="mt-1 whitespace-pre-wrap break-words text-[11px] font-semibold text-[#6c6252]">
                            {profile.enabled ? "Enabled" : "Paused"} / {profile.cadence} / {newsletterListLabel(profile.crmList, contactLists)} / {profile.fromAccount}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-md border border-[#c8bda5] bg-[#f6f0df] px-2 py-1 text-[7px] font-mono font-black uppercase tracking-[0.12em] text-[#6c6252]">
                          {sendTimes.length} slot{sendTimes.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {sendTimes.map((time) => (
                          <span
                            key={`${profile.id}-${time}`}
                            className="rounded-md border border-[#c8bda5] bg-[#f6f0df] px-2 py-1 text-[8px] font-mono font-black uppercase tracking-[0.12em] text-[#151515]"
                          >
                            {time}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] font-semibold text-[#6c6252]">
                        <div className="rounded-md border border-[#c8bda5] bg-[#f6f0df] p-2">Audience: {audience}</div>
                        <div className="rounded-md border border-[#c8bda5] bg-[#f6f0df] p-2">
                          Last queued: {profile.lastQueuedAt ? formatDateTime(profile.lastQueuedAt) : "Not queued yet"}
                        </div>
                        <div className="rounded-md border border-[#c8bda5] bg-[#f6f0df] p-2">
                          Latest batch: {latestBatch ? `${latestBatch.status} / ${formatDateTime(latestBatch.createdAt)}` : "No batches yet"}
                        </div>
                        <div className="rounded-md border border-[#c8bda5] bg-[#f6f0df] p-2">Sender: {profile.fromAccount}</div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-[#c8bda5] bg-[#fffaf0] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Selected archive</p>
                  <h3 className="mt-1 text-xl font-black">{activeProfile?.name || "Campaign"} delivery log</h3>
                  <p className="mt-1 text-sm font-semibold text-[#5d5649]">
                    Failed rows below are filtered to this campaign only. Transport failures mean relay/CRM connection; recipient failures mean the address needs checking.
                  </p>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-1 text-[8px] font-mono font-black uppercase tracking-[0.14em] ${
                  selectedNewsletterAudit.failed
                    ? "bg-[#fff0ee] text-[#991b1b]"
                    : "bg-[#eefbf2] text-[#166534]"
                }`}>
                  {selectedNewsletterAudit.failed ? `${selectedNewsletterAudit.failed} failed` : "clean"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                {[
                  ["Batches", selectedNewsletterAudit.total],
                  ["Sent", selectedNewsletterAudit.sent],
                  ["Failed", selectedNewsletterAudit.failed],
                  ["Waiting", selectedNewsletterAudit.waiting],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-[#c8bda5] bg-white/60 p-2">
                    <span className="block text-[7px] font-mono uppercase tracking-[0.12em] text-[#796f5e]">{label}</span>
                    <strong className="text-sm font-black">{value}</strong>
                  </div>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  ["Relay / transport", selectedNewsletterAudit.transportFailures],
                  ["Recipient", selectedNewsletterAudit.recipientFailures],
                  ["Config", selectedNewsletterAudit.configurationFailures],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-2">
                    <span className="block text-[7px] font-mono uppercase tracking-[0.12em] text-[#796f5e]">{label}</span>
                    <strong className="text-sm font-black">{value}</strong>
                  </div>
                ))}
              </div>
              {(selectedNewsletterAudit.invalidContacts.length || selectedNewsletterAudit.repeatedRecipientFailures.length) ? (
                <div className="mt-3 space-y-2 rounded-lg border-2 border-[#991b1b] bg-[#fff0ee] p-3">
                  <p className="text-[9px] font-mono font-black uppercase tracking-[0.16em] text-[#991b1b]">Recipient cleanup needed</p>
                  {selectedNewsletterAudit.invalidContacts.map((contact) => (
                    <div key={`${contact.listId}-${contact.email}`} className="flex items-center justify-between gap-2 rounded-md bg-white/70 p-2">
                      <div className="min-w-0">
                        <strong className="block truncate text-[11px] font-black text-[#151515]">{contact.name || contact.email}</strong>
                        <span className="block truncate text-[10px] font-semibold text-[#991b1b]">{contact.email} is not a valid email format.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeContactFromList(contact.listId, contact.email)}
                        className="shrink-0 rounded border border-[#991b1b] px-2 py-1 text-[8px] font-mono font-black uppercase tracking-[0.12em] text-[#991b1b]"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {selectedNewsletterAudit.repeatedRecipientFailures.map((failure) => (
                    <div key={failure.email} className="flex items-center justify-between gap-2 rounded-md bg-white/70 p-2 text-[11px] font-semibold text-[#5d5649]">
                      <span className="min-w-0">
                        <span className="font-black text-[#991b1b]">{failure.email}</span> failed as recipient {failure.count} times. Reason: {failure.reason}
                      </span>
                      {activeProfileContactList && (
                        <button
                          type="button"
                          onClick={() => removeContactFromList(activeProfileContactList.id, failure.email)}
                          className="shrink-0 rounded border border-[#991b1b] px-2 py-1 text-[8px] font-mono font-black uppercase tracking-[0.12em] text-[#991b1b]"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-[#c8bda5] bg-[#eefbf2] p-3 text-[11px] font-semibold text-[#166534]">
                  No invalid email format or repeated recipient bounce found for this selected campaign. If sending failed, it is likely relay/CRM transport or configuration.
                </div>
              )}
              <div className="mt-3 space-y-2">
                {selectedNewsletterOutbox.slice(0, 24).map((batch) => (
                  <div
                    key={batch.id}
                    data-pf-virtual-card="true"
                    className={`rounded-lg border p-3 ${
                      batch.status === "send_failed"
                        ? "border-[#e2aaa3] bg-[#fff0ee]"
                        : batch.status === "sent_to_crm"
                          ? "border-[#9bd7af] bg-[#eefbf2]"
                          : "border-[#c8bda5] bg-[#f6f0df]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <strong className="min-w-0 whitespace-pre-wrap break-words text-sm">{batch.subject}</strong>
                      <span className="shrink-0 rounded-md bg-[#151515] px-2 py-1 text-[7px] font-mono font-black uppercase tracking-[0.12em] text-[#f8f1df]">{batch.status}</span>
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-[#6c6252]">
                      {formatDateTime(batch.createdAt)} / {batch.fromAccount} / {newsletterListLabel(batch.crmList, contactLists)}
                    </p>
                    {(batch as { deliveryError?: string }).deliveryError && (
                      <p className="mt-2 whitespace-pre-wrap break-words rounded-md bg-white/60 p-2 text-[10px] font-semibold text-[#991b1b]">
                        {(batch as { deliveryFailureKind?: string }).deliveryFailureKind || classifyNewsletterDeliveryFailure((batch as { deliveryError?: string }).deliveryError)}: {(batch as { deliveryError?: string }).deliveryError}
                      </p>
                    )}
                  </div>
                ))}
                {!selectedNewsletterOutbox.length && (
                  <div className="rounded-lg border border-dashed border-[#c8bda5] p-4 text-sm font-semibold text-[#6c6252]">
                    No prepared newsletters yet for this campaign.
                  </div>
                )}
              </div>
            </section>
          </main>
        )}

        {activeTab === "settings" && activeProfile && (
          <main className="space-y-4 pt-4">
            <section className="space-y-3 rounded-lg border-2 border-[#151515] bg-[#fffaf0] p-4 shadow-[0_10px_0_rgba(21,21,21,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">News Flow settings</p>
                  <h2 className="mt-1 font-serif text-2xl font-black leading-none">Sources & interests</h2>
                </div>
                <span className="rounded-md border border-[#c8bda5] px-2 py-1 text-[8px] font-mono font-black uppercase tracking-[0.14em] text-[#6c6252]">
                  {newsletterSettingsSavedAt ? `Saved ${formatDateTime(newsletterSettingsSavedAt)}` : "Global"}
                </span>
              </div>
              <label className="block">
                <span className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Custom interests</span>
                <textarea
                  value={globalInterests.join("\n")}
                  onChange={(event) => updateGlobalInterests(event.target.value)}
                  placeholder="One per line: AI hardware, Torino startups, robotics, fashion tech..."
                  className="mt-1 min-h-[92px] w-full rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-3 text-xs font-semibold leading-5 outline-none"
                />
                <span className="mt-1 block text-[10px] font-semibold text-[#7a705f]">
                  These interests are saved into the News Flow agent DB and used as extra context for filtering, newsletters and Baloss research.
                </span>
              </label>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Preferred sources</span>
                  <span className="text-[9px] font-mono font-black uppercase tracking-[0.14em] text-[#7a705f]">
                    {preferredSources.length} selected
                  </span>
                </div>
                <div className="mt-2 grid max-h-[210px] grid-cols-1 gap-2 overflow-y-auto pr-1 scrollbar-none">
                  {activeSourcePool(NEWS_SOURCES).map((source) => {
                    const selected = preferredSources.includes(source.id);
                    return (
                      <button
                        key={source.id}
                        type="button"
                        onClick={() => togglePreferredSource(source.id)}
                        aria-pressed={selected}
                        className={`rounded-lg border px-3 py-2 text-left transition active:scale-[0.99] ${
                          selected
                            ? "border-[#151515] bg-[#151515] text-[#f8f1df]"
                            : "border-[#c8bda5] bg-[#f6f0df] text-[#151515]"
                        }`}
                      >
                        <span className="block text-[10px] font-mono font-black uppercase tracking-[0.14em]">{source.name}</span>
                        <span className="mt-1 block text-[10px] font-semibold opacity-70">
                          {source.topic} / priority {source.priority} / {source.feeds.length} feeds
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-[#c8bda5] bg-[#fffaf0] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Automation profiles</p>
                  <h2 className="mt-1 font-serif text-2xl font-black">Newsletter Settings</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      saveProfiles(profiles);
                      onNotify?.("Newsletter settings saved.", "success");
                    }}
                    className="h-10 rounded-lg border border-[#151515] px-3 text-[9px] font-mono font-black uppercase tracking-[0.14em]"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={addProfile}
                    className="h-10 rounded-lg bg-[#151515] px-3 text-[9px] font-mono font-black uppercase tracking-[0.14em] text-[#f8f1df]"
                  >
                    New
                  </button>
                </div>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => selectProfile(profile.id)}
                    className={`shrink-0 rounded-lg border px-3 py-2 text-left ${
                      activeProfile.id === profile.id ? "border-[#151515] bg-[#151515] text-[#f8f1df]" : "border-[#c8bda5] bg-[#f6f0df] text-[#151515]"
                    }`}
                  >
                    <strong className="block text-[10px] font-mono uppercase tracking-[0.14em]">{profile.name}</strong>
                    <span className="mt-1 block text-[10px] opacity-70">{profile.enabled ? "Enabled" : "Paused"} / {newsletterSendTimeSummary(profile)}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-[#c8bda5] bg-[#fffaf0] p-4">
              <label className="block">
                <span className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Profile name</span>
                <input value={activeProfile.name} onChange={(event) => updateProfile({ name: event.target.value })} className="mt-1 h-12 w-full rounded-lg border border-[#c8bda5] bg-[#f6f0df] px-3 text-sm font-bold outline-none" />
              </label>
              <label className="block">
                <span className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Newsletter title</span>
                <input value={activeProfile.title} onChange={(event) => updateProfile({ title: event.target.value })} className="mt-1 h-12 w-full rounded-lg border border-[#c8bda5] bg-[#f6f0df] px-3 text-sm font-bold outline-none" />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <section className="rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Multi topic feed</span>
                      <p className="mt-1 text-[10px] font-semibold leading-4 text-[#6c6252]">
                        {newsletterTopicIds(activeProfile).length} selected / {newsletterTopicSummary(activeProfile)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 grid max-h-[170px] grid-cols-2 gap-2 overflow-y-auto pr-1 scrollbar-none">
                    {NEWS_RESEARCH_FILTERS.filter((filter) => filter.id !== "all").map((filter) => {
                      const selectedTopics = newsletterTopicIds(activeProfile);
                      const selected = selectedTopics.includes(filter.id);
                      return (
                        <button
                          key={filter.id}
                          type="button"
                          onClick={() => toggleNewsletterTopic(filter.id)}
                          className={`min-h-9 rounded-md border px-2 py-1 text-[8px] font-mono font-black uppercase tracking-[0.12em] ${
                            selected
                              ? "border-[#151515] bg-[#151515] text-[#f8f1df]"
                              : "border-[#c8bda5] bg-[#fffaf0] text-[#151515]"
                          }`}
                        >
                          {filter.label}
                        </button>
                      );
                    })}
                  </div>
                </section>
                <section className="rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Daily send slots</span>
                      <p className="mt-1 text-[10px] font-semibold leading-4 text-[#6c6252]">
                        {newsletterSendTimes(activeProfile).length} post{newsletterSendTimes(activeProfile).length === 1 ? "" : "s"} per active day
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addNewsletterSendTime}
                      className="h-8 rounded-md border border-[#151515] px-2 text-[8px] font-mono font-black uppercase tracking-[0.12em]"
                    >
                      + Time
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {newsletterSendTimes(activeProfile).map((time, index) => (
                      <div key={`${time}_${index}`} className="grid grid-cols-[1fr_auto] gap-2">
                        <input
                          type="time"
                          value={time}
                          onChange={(event) => updateNewsletterSendTime(index, event.target.value)}
                          className="h-11 w-full rounded-lg border border-[#c8bda5] bg-[#fffaf0] px-3 text-xs font-black outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeNewsletterSendTime(index)}
                          disabled={newsletterSendTimes(activeProfile).length <= 1}
                          className="h-11 rounded-lg border border-[#c8bda5] px-3 text-[8px] font-mono font-black uppercase tracking-[0.12em] disabled:opacity-35"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              <label className="block">
                <span className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Extra interests</span>
                <textarea
                  value={(activeProfile.customInterests || []).join("\n")}
                  onChange={(event) => updateProfile({ customInterests: splitInterestText(event.target.value) })}
                  placeholder="One per line or comma separated: robotics, Torino startups, model releases..."
                  className="mt-1 min-h-[86px] w-full rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-3 text-xs font-semibold leading-5 outline-none"
                />
                <span className="mt-1 block text-[10px] font-semibold text-[#7a705f]">
                  Used with the selected topics to pull and rank newsletter stories.
                </span>
              </label>
              <label className="block">
                <span className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Campaign rhythm</span>
                <select
                  value={activeProfile.cadence || "daily"}
                  onChange={(event) => updateProfile({ cadence: event.target.value as NewsletterProfile["cadence"] })}
                  className="mt-1 h-12 w-full rounded-lg border border-[#c8bda5] bg-[#f6f0df] px-3 text-xs font-black outline-none"
                >
                  <option value="daily">Daily automation</option>
                  <option value="weekdays">Weekdays only</option>
                  <option value="manual">Manual prep only</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">From email</span>
                  <select value={activeProfile.fromAccount} onChange={(event) => updateProfile({ fromAccount: event.target.value })} className="mt-1 h-12 w-full rounded-lg border border-[#c8bda5] bg-[#f6f0df] px-3 text-xs font-black outline-none">
                    {crmAccounts.map((account) => <option key={account.id} value={account.address}>{account.address}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">CRM list</span>
                  <select value={activeProfile.crmList} onChange={(event) => updateProfile({ crmList: event.target.value })} className="mt-1 h-12 w-full rounded-lg border border-[#c8bda5] bg-[#f6f0df] px-3 text-xs font-black outline-none">
                    {crmLists.map((list) => <option key={list.id} value={list.id}>{list.label} ({list.count})</option>)}
                  </select>
                </label>
              </div>
              <section className="rounded-lg border-2 border-[#151515] bg-[#f6f0df] p-3 shadow-[4px_4px_0_#151515]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Campaign audience</span>
                    <h3 className="mt-1 truncate text-lg font-black">
                      {activeProfileContactList?.name || "No dedicated audience yet"}
                    </h3>
                    <p className="mt-1 text-[11px] font-semibold text-[#6c6252]">
                      {newsletterAudienceCount(activeProfile.crmList, contactLists)} contacts / {activeProfileContactList?.webhookEnabled ? "webhook on" : "webhook off"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={ensureCampaignAudience}
                    className="h-10 shrink-0 rounded-lg bg-[#151515] px-3 text-[8px] font-mono font-black uppercase tracking-[0.12em] text-[#f8f1df]"
                  >
                    Use own list
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_1fr_auto] gap-2">
                  <input
                    value={quickContactName}
                    onChange={(event) => setQuickContactName(event.target.value)}
                    placeholder="Name"
                    className="h-11 min-w-0 rounded-lg border border-[#c8bda5] bg-[#fffaf0] px-3 text-xs font-bold outline-none"
                  />
                  <input
                    value={quickContactEmail}
                    onChange={(event) => setQuickContactEmail(event.target.value)}
                    placeholder="contact handle"
                    className="h-11 min-w-0 rounded-lg border border-[#c8bda5] bg-[#fffaf0] px-3 text-xs font-bold outline-none"
                  />
                  <button
                    type="button"
                    onClick={addQuickCampaignContact}
                    className="h-11 w-12 rounded-lg bg-[#166534] text-white"
                    aria-label="Add contact to campaign"
                  >
                    <UserPlus className="mx-auto h-4 w-4" />
                  </button>
                </div>
                {activeProfileContactList && (
                  <div className="mt-3 rounded-lg border border-[#c8bda5] bg-[#fffaf0] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[8px] font-mono font-black uppercase tracking-[0.16em] text-[#7a705f]">Signup webhook</span>
                        <p className="mt-1 truncate text-[10px] font-semibold text-[#6c6252]">{newsletterWebhookUrl(activeProfileContactList)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateContactList(activeProfileContactList.id, { webhookEnabled: !activeProfileContactList.webhookEnabled })}
                        className={`h-9 shrink-0 rounded-md px-2 text-[8px] font-mono font-black uppercase tracking-[0.12em] ${
                          activeProfileContactList.webhookEnabled ? "bg-[#166534] text-white" : "border border-[#c8bda5] text-[#151515]"
                        }`}
                      >
                        {activeProfileContactList.webhookEnabled ? "On" : "Off"}
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void copyCampaignWebhook()}
                        className="h-10 rounded-lg border border-[#151515] text-[8px] font-mono font-black uppercase tracking-[0.12em]"
                      >
                        <Copy className="mr-1.5 inline h-3.5 w-3.5" />
                        Copy URL
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const token = createNewsletterWebhookToken();
                          updateContactList(activeProfileContactList.id, {
                            webhookToken: token,
                            webhookEndpoint: `/api/newsflow/newsletter-signup/${activeProfileContactList.id}?token=${token}`,
                          });
                        }}
                        className="h-10 rounded-lg border border-[#c8bda5] text-[8px] font-mono font-black uppercase tracking-[0.12em]"
                      >
                        <Link className="mr-1.5 inline h-3.5 w-3.5" />
                        New token
                      </button>
                    </div>
                    <textarea
                      value={webhookPayloadText}
                      onChange={(event) => setWebhookPayloadText(event.target.value)}
                      placeholder='Webhook test JSON: {"email":"reader@example.com","name":"Reader","tags":["site"]}'
                      className="mt-3 min-h-[82px] w-full rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-3 text-xs font-semibold leading-5 outline-none"
                    />
                    <button
                      type="button"
                      onClick={importWebhookPayloadToCampaign}
                      className="mt-2 h-10 w-full rounded-lg bg-[#151515] text-[8px] font-mono font-black uppercase tracking-[0.14em] text-[#f8f1df]"
                    >
                      Import webhook payload
                    </button>
                    <p className="mt-2 text-[10px] font-semibold leading-4 text-[#6c6252]">
                      External agents can also push to localStorage key <span className="font-mono">{NEWSLETTER_WEBHOOK_QUEUE_KEY}</span>; News Flow syncs valid signups into this campaign.
                    </p>
                  </div>
                )}
              </section>
              <label className="block">
                <span className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Introduction</span>
                <textarea value={activeProfile.intro} onChange={(event) => updateProfile({ intro: event.target.value })} className="mt-1 min-h-[110px] w-full rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-3 text-sm font-semibold leading-6 outline-none" />
              </label>
              <label className="block">
                <span className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Footer signature</span>
                <textarea value={activeProfile.signature} onChange={(event) => updateProfile({ signature: event.target.value })} className="mt-1 min-h-[78px] w-full rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-3 text-sm font-semibold leading-6 outline-none" />
              </label>
              <label className="block">
                <span className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Footer footprint</span>
                <input
                  value={activeProfile.footprint || DEFAULT_NEWSLETTER_FOOTPRINT}
                  onChange={(event) => updateProfile({ footprint: event.target.value })}
                  placeholder="example.com"
                  className="mt-1 h-12 w-full rounded-lg border border-[#c8bda5] bg-[#f6f0df] px-3 text-sm font-bold outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Text font</span>
                <select
                  value={activeProfile.fontFamily || DEFAULT_NEWSLETTER_FONT}
                  onChange={(event) => updateProfile({ fontFamily: event.target.value })}
                  className="mt-1 h-12 w-full rounded-lg border border-[#c8bda5] bg-[#f6f0df] px-3 text-xs font-black outline-none"
                >
                  {NEWSLETTER_FONT_OPTIONS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
                </select>
              </label>
              <section className="rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Campaign colours</h3>
                    <p className="mt-1 text-[11px] font-semibold text-[#6c6252]">Header, footer, accent and page background for this newsletter.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateProfile({
                      headerBgColor: "#fffaf0",
                      headerTextColor: "#111111",
                      footerBgColor: "#151515",
                      footerTextColor: "#f8f1df",
                      accentColor: "#a5832c",
                      bodyBgColor: "#f6f0df",
                    })}
                    className="h-9 shrink-0 rounded-md border border-[#c8bda5] px-2 text-[8px] font-mono font-black uppercase tracking-[0.12em]"
                  >
                    Reset
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {[
                    ["Header bg", "headerBgColor", "#fffaf0"],
                    ["Header text", "headerTextColor", "#111111"],
                    ["Footer bg", "footerBgColor", "#151515"],
                    ["Footer text", "footerTextColor", "#f8f1df"],
                    ["Accent", "accentColor", "#a5832c"],
                    ["Page bg", "bodyBgColor", "#f6f0df"],
                  ].map(([label, key, fallback]) => (
                    <label key={key} className="flex items-center justify-between gap-2 rounded-lg border border-[#c8bda5] bg-[#fffaf0] px-3 py-2">
                      <span className="text-[9px] font-mono font-black uppercase tracking-[0.12em] text-[#4d473c]">{label}</span>
                      <input
                        type="color"
                        value={String(activeProfile[key as keyof NewsletterProfile] || fallback)}
                        onChange={(event) => updateProfile({ [key]: event.target.value } as Partial<NewsletterProfile>)}
                        className="h-8 w-10 rounded border border-[#c8bda5] bg-transparent"
                      />
                    </label>
                  ))}
                </div>
              </section>
              <section className="rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Newsletter lists</h3>
                    <p className="mt-1 text-[11px] font-semibold text-[#6c6252]">Open a list to edit, add, remove, or bulk import contacts.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addContactList}
                    className="h-9 shrink-0 rounded-md bg-[#151515] px-3 text-[8px] font-mono font-black uppercase tracking-[0.12em] text-[#f8f1df]"
                  >
                    New
                  </button>
                </div>
                <div className="mt-3 rounded-lg border border-[#c8bda5] bg-[#fffaf0] p-3">
                  <span className="text-[8px] font-mono font-black uppercase tracking-[0.16em] text-[#7a705f]">Select / manage list</span>
                  <select
                    value={activeContactListId}
                    onChange={(event) => selectContactList(event.target.value, true)}
                    className="mt-2 h-12 w-full rounded-lg border border-[#c8bda5] bg-[#f6f0df] px-3 text-sm font-black outline-none"
                  >
                    {contactLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name} ({list.contacts.length})
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => activeContactList && selectContactList(activeContactList.id, true)}
                      className="h-10 rounded-lg border border-[#151515] text-[8px] font-mono font-black uppercase tracking-[0.12em]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={addContactList}
                      className="h-10 rounded-lg bg-[#151515] text-[8px] font-mono font-black uppercase tracking-[0.12em] text-[#f8f1df]"
                    >
                      Create
                    </button>
                    <button
                      type="button"
                      onClick={() => activeContactList && updateProfile({ crmList: `list:${activeContactList.id}` })}
                      disabled={!activeProfile || !activeContactList}
                      className="h-10 rounded-lg border border-[#166534] bg-[#e7f4df] text-[8px] font-mono font-black uppercase tracking-[0.12em] text-[#166534] disabled:opacity-35"
                    >
                      Use
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] font-semibold leading-4 text-[#6c6252]">
                    Selected list: <span className="font-black text-[#151515]">{activeContactList?.name || "None"}</span>. Use links this audience to the campaign above.
                  </p>
                </div>
                <div className="mt-3 space-y-2">
                  {contactLists.map((list) => {
                    const isExpanded = expandedContactListId === list.id;
                    const isActive = activeContactListId === list.id;
                    const finderQuery = contactFinderQueries[list.id] || "";
                    const finderEmail = extractEmail(finderQuery);
                    const existingEmails = new Set(list.contacts.map((contact) => normalizeEmail(contact.email)));
                    const finderMatches = finderQuery.trim().length >= 2
                      ? crmContacts
                          .filter((contact) => {
                            const email = normalizeEmail(contact.email);
                            return email && !existingEmails.has(email) && crmContactSearchText(contact).includes(finderQuery.trim().toLowerCase());
                          })
                          .slice(0, 8)
                      : [];
                    return (
                      <div
                        key={list.id}
                        className={`overflow-hidden rounded-lg border ${
                          isActive ? "border-[#151515] bg-[#fffaf0]" : "border-[#c8bda5] bg-[#fffaf0]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            selectContactList(list.id);
                            setExpandedContactListId(isExpanded ? "" : list.id);
                          }}
                          className="flex w-full items-center justify-between gap-3 p-3 text-left"
                        >
                          <div className="min-w-0">
                            <strong className="block truncate text-[10px] font-mono font-black uppercase tracking-[0.14em] text-[#151515]">{list.name}</strong>
                            <span className="mt-1 block text-[10px] font-semibold text-[#6c6252]">
                              {list.contacts.length} contacts · {list.webhookEnabled ? "webhook on" : "manual"}
                            </span>
                          </div>
                          <span className="flex shrink-0 items-center gap-2 text-[8px] font-mono font-black uppercase tracking-[0.12em] text-[#7a705f]">
                            {isExpanded ? "Collapse" : "Open"}
                            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="space-y-3 border-t border-[#c8bda5] p-3">
                            <label className="block">
                              <span className="text-[8px] font-mono font-black uppercase tracking-[0.16em] text-[#7a705f]">List name</span>
                              <input
                                value={list.name}
                                onChange={(event) => updateContactList(list.id, { name: event.target.value })}
                                className="mt-1 h-11 w-full rounded-lg border border-[#c8bda5] bg-[#f6f0df] px-3 text-sm font-bold outline-none"
                              />
                            </label>
                            <label className="block">
                              <span className="text-[8px] font-mono font-black uppercase tracking-[0.16em] text-[#7a705f]">Description</span>
                              <input
                                value={list.description}
                                onChange={(event) => updateContactList(list.id, { description: event.target.value })}
                                className="mt-1 h-11 w-full rounded-lg border border-[#c8bda5] bg-[#f6f0df] px-3 text-sm font-bold outline-none"
                              />
                            </label>
                            <div className="rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[8px] font-mono font-black uppercase tracking-[0.16em] text-[#7a705f]">Find CRM contact</span>
                                <span className="text-[9px] font-bold text-[#6c6252]">{crmContacts.length} available</span>
                              </div>
                              <div className="mt-2 flex gap-2">
                                <div className="relative min-w-0 flex-1">
                                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7a705f]" />
                                  <input
                                    value={finderQuery}
                                    onChange={(event) => setContactFinderQueries((queries) => ({
                                      ...queries,
                                      [list.id]: event.target.value,
                                    }))}
                                    placeholder="Type name, email, company or label..."
                                    className="h-11 w-full rounded-lg border border-[#c8bda5] bg-[#fffaf0] pl-9 pr-3 text-xs font-bold outline-none"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => addTypedFinderContactToList(list.id)}
                                  disabled={!finderEmail}
                                  className="h-11 shrink-0 rounded-lg bg-[#151515] px-3 text-[8px] font-mono font-black uppercase tracking-[0.12em] text-[#f8f1df] disabled:opacity-35"
                                >
                                  Add typed
                                </button>
                              </div>
                              {finderQuery.trim().length >= 2 && (
                                <div className="mt-2 space-y-2">
                                  {finderMatches.length ? finderMatches.map((contact) => (
                                    <div key={contact.email} className="flex items-center justify-between gap-2 rounded-lg border border-[#d8cfba] bg-[#fffaf0] p-2">
                                      <div className="min-w-0">
                                        <strong className="block truncate text-[11px] font-black text-[#151515]">{contact.name || contact.email}</strong>
                                        <span className="block truncate text-[10px] font-semibold text-[#6c6252]">{contact.email}</span>
                                        {(contact.company || contact.labels?.length) && (
                                          <span className="block truncate text-[9px] font-mono font-bold uppercase tracking-[0.08em] text-[#8b7e68]">
                                            {[contact.company, ...(contact.labels || [])].filter(Boolean).join(" / ")}
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => addNewsletterContactToList(list.id, {
                                          name: contact.name,
                                          email: contact.email || "",
                                          tags: Array.from(new Set([...(contact.labels || []), "crm"])),
                                        })}
                                        className="flex h-9 shrink-0 items-center gap-1 rounded-md bg-[#166534] px-3 text-[8px] font-mono font-black uppercase tracking-[0.12em] text-white"
                                      >
                                        <UserPlus className="h-3.5 w-3.5" />
                                        Add
                                      </button>
                                    </div>
                                  )) : (
                                    <p className="rounded-md border border-dashed border-[#c8bda5] p-2 text-[10px] font-semibold text-[#7a705f]">
                                      No CRM contact found. Paste an email and use Add typed.
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                              <input
                                value={listContactName}
                                onChange={(event) => setListContactName(event.target.value)}
                                placeholder="Contact name"
                                className="h-11 rounded-lg border border-[#c8bda5] bg-[#f6f0df] px-3 text-xs font-bold outline-none"
                              />
                              <input
                                value={listContactEmail}
                                onChange={(event) => setListContactEmail(event.target.value)}
                                placeholder="contact handle"
                                className="h-11 rounded-lg border border-[#c8bda5] bg-[#f6f0df] px-3 text-xs font-bold outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => addManualContactToList(list.id)}
                                className="h-11 rounded-lg bg-[#151515] px-4 text-[8px] font-mono font-black uppercase tracking-[0.14em] text-[#f8f1df]"
                              >
                                Add
                              </button>
                            </div>
                            <label className="block">
                              <span className="text-[8px] font-mono font-black uppercase tracking-[0.16em] text-[#7a705f]">Bulk JSON / emails</span>
                              <textarea
                                value={bulkContactsText}
                                onChange={(event) => setBulkContactsText(event.target.value)}
                                placeholder='["person@example.com", {"name":"Name","email":"team@example.com"}]'
                                className="mt-1 min-h-[82px] w-full rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-3 text-xs font-semibold leading-5 outline-none"
                              />
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => importContactsToList(list.id)}
                                className="h-11 rounded-lg bg-[#166534] text-[8px] font-mono font-black uppercase tracking-[0.14em] text-white"
                              >
                                Import contacts
                              </button>
                              <button
                                type="button"
                                onClick={() => removeContactList(list.id)}
                                disabled={list.id === PUBLIC_NEWS_LIST_ID || contactLists.length <= 1}
                                className="h-11 rounded-lg border border-[#991b1b] bg-[#fffaf0] text-[8px] font-mono font-black uppercase tracking-[0.14em] text-[#991b1b] disabled:opacity-35"
                              >
                                Remove list
                              </button>
                            </div>
                            <div className="space-y-2 rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-2">
                              {list.contacts.length ? list.contacts.slice(0, 10).map((contact) => (
                                <div key={contact.email} className="flex items-center justify-between gap-2 rounded-md bg-[#fffaf0] px-2 py-2">
                                  <div className="min-w-0">
                                    <strong className="block truncate text-[11px] font-black text-[#151515]">{contact.name || contact.email}</strong>
                                    <span className="block truncate text-[10px] font-semibold text-[#6c6252]">{contact.email}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeContactFromList(list.id, contact.email)}
                                    className="shrink-0 rounded border border-[#991b1b] px-2 py-1 text-[8px] font-mono font-black uppercase tracking-[0.12em] text-[#991b1b]"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )) : (
                                <p className="rounded-md border border-dashed border-[#c8bda5] p-3 text-[11px] font-semibold text-[#7a705f]">No contacts in this list yet.</p>
                              )}
                              {list.contacts.length > 10 && (
                                <p className="px-1 text-[10px] font-semibold text-[#7a705f]">+ {list.contacts.length - 10} more contacts stored in this list.</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#c8bda5] bg-[#f6f0df] text-[9px] font-mono font-black uppercase tracking-[0.14em]">
                  <Upload className="h-4 w-4" />
                  Logo
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => handleLogoUpload(event.target.files?.[0])} />
                </label>
                <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#c8bda5] bg-[#f6f0df] text-[9px] font-mono font-black uppercase tracking-[0.14em]">
                  <Upload className="h-4 w-4" />
                  Template
                  <input type="file" accept=".doc,.docx,.html,.htm" className="hidden" onChange={(event) => updateProfile({ templateName: event.target.files?.[0]?.name || activeProfile.templateName })} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">
                    {activeProfileIsPropertyDigest ? "Top apartments" : "Top stories"}
                  </span>
                  <input type="number" min={1} max={20} value={activeProfile.topCount} onChange={(event) => updateProfile({ topCount: Number(event.target.value) || 10 })} className="mt-1 h-12 w-full rounded-lg border border-[#c8bda5] bg-[#f6f0df] px-3 text-xs font-black outline-none" />
                </label>
                <button
                  type="button"
                  onClick={() => updateProfile({ enabled: !activeProfile.enabled })}
                  className={`mt-5 h-12 rounded-lg border-2 text-[9px] font-mono font-black uppercase tracking-[0.14em] shadow-[2px_2px_0_#151515] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none ${
                    activeProfile.enabled
                      ? "border-[#991b1b] bg-[#991b1b] text-white"
                      : "border-[#166534] bg-[#166534] text-white"
                  }`}
                >
                  {activeProfile.enabled ? "Stop campaign" : "Start campaign"}
                </button>
              </div>
            </section>
          </main>
        )}

        {activeTab === "feed" && <section className="mt-4 rounded-lg bg-[#151515] text-[#f8f1df] border border-[#151515] overflow-hidden">
          <button
            onClick={() => setDbOpen((value) => !value)}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <div>
              <h2 className="text-[10px] font-mono font-black uppercase tracking-[0.22em] text-[#f6c453]">News DB for Baloss LLM</h2>
              <p className="mt-1 text-xs text-[#d8d0bf]">Saved summaries, links, likes and pins.</p>
            </div>
            <ChevronDown className={`w-5 h-5 transition ${dbOpen ? "rotate-180" : ""}`} />
          </button>
          {dbOpen && (
            <div className="border-t border-white/10 p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                  <span className="text-[8px] font-mono uppercase tracking-[0.18em] text-slate-400">Latest</span>
                  <strong className="block mt-1 text-xl">{items.length}</strong>
                </div>
                <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                  <span className="text-[8px] font-mono uppercase tracking-[0.18em] text-slate-400">Pins</span>
                  <strong className="block mt-1 text-xl">{pinnedIds.length}</strong>
                </div>
                <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                  <span className="text-[8px] font-mono uppercase tracking-[0.18em] text-slate-400">Likes</span>
                  <strong className="block mt-1 text-xl">{likedIds.length}</strong>
                </div>
              </div>
              <pre className="max-h-64 overflow-auto rounded-2xl bg-black/35 border border-white/10 p-3 text-[10px] leading-relaxed text-slate-300 whitespace-pre-wrap">
                {JSON.stringify(agentDb, null, 2)}
              </pre>
            </div>
          )}
        </section>}

        <p className="px-4 pt-3 text-center text-[10px] leading-relaxed text-[#6c6252]">
          Summaries are generated from public feed metadata and saved locally for PocketFlow research memory. Open the source link for the full article.
        </p>
      </div>
      {confirmBatch && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-3">
          <section className="w-full max-w-[430px] rounded-t-2xl border-2 border-[#151515] bg-[#fffaf0] p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.35)]">
            <p className="text-[9px] font-mono font-black uppercase tracking-[0.18em] text-[#7a705f]">Double-check before CRM send</p>
            <h2 className="mt-1 font-serif text-2xl font-black leading-none">Confirm newsletter package</h2>
            <div className="mt-4 space-y-2 text-sm font-semibold text-[#423b31]">
              <div className="rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-3">
                <span className="block text-[8px] font-mono font-black uppercase tracking-[0.16em] text-[#7a705f]">Sender email</span>
                {confirmBatch.fromAccount}
              </div>
              <div className="rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-3">
                <span className="block text-[8px] font-mono font-black uppercase tracking-[0.16em] text-[#7a705f]">Selected list</span>
                {newsletterListLabel(confirmBatch.crmList, contactLists)} ({confirmBatch.audienceCount} contacts)
              </div>
              <div className="rounded-lg border border-[#c8bda5] bg-[#f6f0df] p-3">
                <span className="block text-[8px] font-mono font-black uppercase tracking-[0.16em] text-[#7a705f]">Subject / items</span>
                {confirmBatch.subject} / {confirmBatch.items.length} {confirmBatch.profileId === PROPERTY_DIGEST_NEWSLETTER_PROFILE_ID ? "apartments" : "stories"}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setConfirmBatch(null)}
                className="h-12 rounded-lg border border-[#c8bda5] bg-[#f6f0df] text-[9px] font-mono font-black uppercase tracking-[0.14em] text-[#151515]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmQueueNewsletter}
                className="h-12 rounded-lg bg-[#166534] text-[9px] font-mono font-black uppercase tracking-[0.14em] text-white"
              >
                Confirm package
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
