import type { ReceivedFile } from "../types";

export interface ArchiveTracker {
  code: string;
  app: string;
  niche: string;
  section: string;
  label: string;
  color: string;
  createdAt: string;
}

export interface ArchiveTrackerInput {
  app?: string;
  niche?: string;
  section?: string;
  label?: string;
  color?: string;
  createdAt?: string;
}

const TRACKER_COLORS = [
  "#2f80ed",
  "#0f9f6e",
  "#d97706",
  "#8b5cf6",
  "#dc4c64",
  "#0891b2",
  "#65a30d",
  "#c2410c",
];

const cleanSegment = (value: unknown, fallback: string) => {
  const cleaned = String(value || "")
    .trim()
    .replace(/[_/\\-]+/g, " ")
    .replace(/[^a-z0-9 ]/gi, "")
    .replace(/\s+/g, " ");
  return cleaned || fallback;
};

const codeSegment = (value: string, fallback: string) => {
  const compact = value.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return (compact.slice(0, 4) || fallback).padEnd(3, "X");
};

const colorFor = (app: string, niche: string) => {
  let hash = 0;
  for (const char of `${app}:${niche}`) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return TRACKER_COLORS[Math.abs(hash) % TRACKER_COLORS.length];
};

export const createArchiveTracker = (input: ArchiveTrackerInput = {}): ArchiveTracker => {
  const app = cleanSegment(input.app, "system");
  const niche = cleanSegment(input.niche, "general");
  const section = cleanSegment(input.section, "document");
  return {
    code: `${codeSegment(app, "SYS")}-${codeSegment(niche, "GEN")}-${codeSegment(section, "DOC")}`,
    app,
    niche,
    section,
    label: input.label || `${app} · ${niche} · ${section}`,
    color: input.color || colorFor(app, niche),
    createdAt: input.createdAt || new Date().toISOString(),
  };
};

const sectionFromFile = (file: ReceivedFile) => {
  const haystack = `${file.name} ${file.category} ${file.metadata?.section || ""}`.toLowerCase();
  if (/contact|email|phone|lead/.test(haystack)) return "contacts";
  if (/analys|audit|score|review|status|monitor/.test(haystack)) return "analysis";
  if (/agent|mesh|scout|crawl|queue/.test(haystack)) return "agents";
  if (/list|export|csv|crm/.test(haystack)) return "exports";
  return "documents";
};

const nicheFromFile = (file: ReceivedFile) => {
  const metadata = file.metadata || {};
  if (typeof metadata.sector === "string" && metadata.sector.trim()) return metadata.sector;
  if (typeof metadata.niche === "string" && metadata.niche.trim()) return metadata.niche;
  const tracker = metadata.tracker as Partial<ArchiveTracker> | undefined;
  if (tracker?.niche) return tracker.niche;
  const parts = (file.folderPath || "").split("/").filter(Boolean);
  const reportsIndex = parts.findIndex((part) => part.toLowerCase() === "generated reports");
  return reportsIndex >= 0 && parts[reportsIndex + 1] ? parts[reportsIndex + 1] : "general";
};

export const trackerForFile = (file: ReceivedFile, override: ArchiveTrackerInput = {}) => {
  const existing = file.metadata?.tracker as Partial<ArchiveTracker> | undefined;
  return createArchiveTracker({
    app: override.app || existing?.app || (typeof file.metadata?.sourceApp === "string" ? file.metadata.sourceApp : "archive"),
    niche: override.niche || existing?.niche || nicheFromFile(file),
    section: override.section || existing?.section || sectionFromFile(file),
    label: override.label || existing?.label,
    color: override.color || existing?.color,
    createdAt: existing?.createdAt,
  });
};

export const withArchiveTrackerMetadata = (file: ReceivedFile, override: ArchiveTrackerInput = {}): ReceivedFile => ({
  ...file,
  metadata: {
    ...file.metadata,
    tracker: trackerForFile(file, override),
  },
});
