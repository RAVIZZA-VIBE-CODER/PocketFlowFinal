import type { NativeFilePayload, ReceivedFile } from "../types";
import { deleteFileFromStorage, getAllFiles, getFileBlob, saveFileMetadata } from "./storage";

export type ArchiveMaintenanceCadence = "continuous" | "1" | "3" | "4" | "5" | "6" | "7" | "8" | "12" | "24" | "48";

export interface ArchiveMaintenanceConfig {
  enabled: boolean;
  cadence: ArchiveMaintenanceCadence;
  autoDeleteExact: boolean;
  humanReview: boolean;
  malwareScan: boolean;
}

export interface ArchiveDuplicateCandidate {
  id: string;
  name: string;
  size: number;
  kind: "archiveRecord" | "nativeFile";
  location: string;
  receivedAt: string;
  confidence: "exact" | "likely" | "review";
  reason: string;
  deletable: boolean;
}

export interface ArchiveDuplicateGroup {
  id: string;
  key: string;
  title: string;
  keep: ArchiveDuplicateCandidate;
  candidates: ArchiveDuplicateCandidate[];
  confidence: "exact" | "likely" | "review";
}

export interface ArchiveMaintenanceLogEntry {
  id: string;
  at: string;
  action: "scan" | "delete" | "review" | "start" | "stop" | "error" | "threat" | "quarantine" | "override" | "block";
  message: string;
}

export interface ArchiveThreatFinding {
  id: string;
  fileId: string;
  name: string;
  folderPath: string;
  extension: string;
  mimeType: string;
  size: number;
  threatLevel: "low" | "medium" | "high" | "critical";
  scanStatus: "suspected" | "quarantined" | "blocked" | "overridden";
  reasons: string[];
  recommendedAction: string;
  safeReaderRequired: boolean;
  scannedAt: string;
}

export interface ArchiveMaintenanceState {
  config: ArchiveMaintenanceConfig;
  running: boolean;
  lastRunAt: string;
  nextRunAt: string;
  status: string;
  reviewQueue: ArchiveDuplicateGroup[];
  threatQueue: ArchiveThreatFinding[];
  deletedLog: ArchiveMaintenanceLogEntry[];
}

export interface ArchiveMaintenanceScanResult {
  scannedRecords: number;
  duplicateGroups: ArchiveDuplicateGroup[];
  deleted: ArchiveDuplicateCandidate[];
  message: string;
}

const CONFIG_KEY = "pocketflow.spino.archiveAgent.config.v1";
const STATE_KEY = "pocketflow.spino.archiveAgent.state.v1";

export const ARCHIVE_MAINTENANCE_CADENCES: Array<{ value: ArchiveMaintenanceCadence; label: string; ms: number }> = [
  { value: "continuous", label: "Continuous", ms: 15 * 60 * 1000 },
  { value: "1", label: "Every 1h", ms: 1 * 60 * 60 * 1000 },
  { value: "3", label: "Every 3h", ms: 3 * 60 * 60 * 1000 },
  { value: "4", label: "Every 4h", ms: 4 * 60 * 60 * 1000 },
  { value: "5", label: "Every 5h", ms: 5 * 60 * 60 * 1000 },
  { value: "6", label: "Every 6h", ms: 6 * 60 * 60 * 1000 },
  { value: "7", label: "Every 7h", ms: 7 * 60 * 60 * 1000 },
  { value: "8", label: "Every 8h", ms: 8 * 60 * 60 * 1000 },
  { value: "12", label: "Every 12h", ms: 12 * 60 * 60 * 1000 },
  { value: "24", label: "Every 24h", ms: 24 * 60 * 60 * 1000 },
  { value: "48", label: "Every 48h", ms: 48 * 60 * 60 * 1000 },
];

export const DEFAULT_ARCHIVE_MAINTENANCE_CONFIG: ArchiveMaintenanceConfig = {
  enabled: false,
  cadence: "6",
  autoDeleteExact: false,
  humanReview: true,
  malwareScan: true,
};

const DANGEROUS_EXTENSIONS = new Set([
  "exe", "dll", "bat", "cmd", "com", "scr", "msi", "ps1", "vbs", "wsf", "jar", "apk", "dex", "dmg", "pkg", "deb", "rpm",
]);

const SCRIPT_EXTENSIONS = new Set(["js", "jsx", "mjs", "cjs", "sh", "bash", "zsh", "py", "rb", "pl", "php", "hta"]);
const MACRO_EXTENSIONS = new Set(["docm", "xlsm", "pptm", "xlam"]);
const DOCUMENT_EXTENSIONS = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "pages", "epub"]);
const SAFE_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "heic"]);

const normaliseLocator = (value?: unknown) => {
  if (typeof value !== "string") return "";
  try {
    return decodeURIComponent(value.trim()).replace(/^file:\/\//i, "").replace(/\\/g, "/").toLowerCase();
  } catch {
    return value.trim().replace(/^file:\/\//i, "").replace(/\\/g, "/").toLowerCase();
  }
};

const stableFileName = (value = "") => {
  const name = value.trim().toLowerCase();
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  const cleaned = base.replace(/(?:\s*\(\d+\)|-\d+| copy)$/i, "");
  return `${cleaned}${ext}`;
};

const stableHash = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
};

const cadenceMs = (cadence: ArchiveMaintenanceCadence) =>
  ARCHIVE_MAINTENANCE_CADENCES.find((item) => item.value === cadence)?.ms || 6 * 60 * 60 * 1000;

const nextRunFrom = (at: string, cadence: ArchiveMaintenanceCadence) =>
  new Date(new Date(at).getTime() + cadenceMs(cadence)).toISOString();

export const loadArchiveMaintenanceConfig = (): ArchiveMaintenanceConfig => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
    return { ...DEFAULT_ARCHIVE_MAINTENANCE_CONFIG, ...parsed };
  } catch {
    return DEFAULT_ARCHIVE_MAINTENANCE_CONFIG;
  }
};

export const saveArchiveMaintenanceConfig = (config: ArchiveMaintenanceConfig) => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
};

export const loadArchiveMaintenanceState = (): ArchiveMaintenanceState => {
  const config = loadArchiveMaintenanceConfig();
  try {
    const parsed = JSON.parse(localStorage.getItem(STATE_KEY) || "{}");
    return {
      config,
      running: Boolean(parsed.running && config.enabled),
      lastRunAt: parsed.lastRunAt || "",
      nextRunAt: parsed.nextRunAt || "",
      status: parsed.status || "Archive agent stopped.",
      reviewQueue: Array.isArray(parsed.reviewQueue) ? parsed.reviewQueue : [],
      threatQueue: Array.isArray(parsed.threatQueue) ? parsed.threatQueue : [],
      deletedLog: Array.isArray(parsed.deletedLog) ? parsed.deletedLog.slice(0, 40) : [],
    };
  } catch {
    return {
      config,
      running: false,
      lastRunAt: "",
      nextRunAt: "",
      status: "Archive agent stopped.",
      reviewQueue: [],
      threatQueue: [],
      deletedLog: [],
    };
  }
};

export const saveArchiveMaintenanceState = (state: ArchiveMaintenanceState) => {
  saveArchiveMaintenanceConfig(state.config);
  localStorage.setItem(STATE_KEY, JSON.stringify({
    running: state.running,
    lastRunAt: state.lastRunAt,
    nextRunAt: state.nextRunAt,
    status: state.status,
    reviewQueue: state.reviewQueue,
    threatQueue: state.threatQueue,
    deletedLog: state.deletedLog.slice(0, 40),
  }));
};

const archiveCandidateFromRecord = (file: ReceivedFile): ArchiveDuplicateCandidate => {
  const metadata = file.metadata || {};
  const location =
    normaliseLocator(file.appPrivateUri) ||
    normaliseLocator(file.nativeUri) ||
    normaliseLocator(metadata.nativePath) ||
    normaliseLocator(metadata.path) ||
    file.folderPath ||
    "/";
  return {
    id: file.id,
    name: file.name,
    size: Number(file.size || 0),
    kind: "archiveRecord",
    location,
    receivedAt: file.receivedAt || file.acceptedAt || "",
    confidence: "review",
    reason: "Archive record",
    deletable: true,
  };
};

const archiveCandidateFromNative = (file: NativeFilePayload): ArchiveDuplicateCandidate => ({
  id: file.id,
  name: file.displayName,
  size: Number(file.size || 0),
  kind: "nativeFile",
  location: normaliseLocator(file.appPrivateUri || file.nativeUri),
  receivedAt: file.receivedAt || "",
  confidence: "review",
  reason: "Native file reference",
  deletable: false,
});

const duplicateKeysForCandidate = (candidate: ArchiveDuplicateCandidate) => {
  const keys = new Set<string>();
  const name = candidate.name.trim().toLowerCase();
  const stableName = stableFileName(candidate.name);
  if (candidate.location) keys.add(`loc:${candidate.location}`);
  if (name && candidate.size > 0) keys.add(`name-size:${name}:${candidate.size}`);
  if (stableName && candidate.size > 0) keys.add(`stable-name-size:${stableName}:${candidate.size}`);
  return keys;
};

const sortNewestFirst = (a: ArchiveDuplicateCandidate, b: ArchiveDuplicateCandidate) =>
  (b.receivedAt || "").localeCompare(a.receivedAt || "");

const textSampleFromBlob = async (blob: Blob | null, maxBytes = 192 * 1024) => {
  if (!blob) return "";
  try {
    return await blob.slice(0, maxBytes).text();
  } catch {
    return "";
  }
};

const signatureFromBlob = async (blob: Blob | null) => {
  if (!blob) return "";
  try {
    const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join(" ");
  } catch {
    return "";
  }
};

const levelRank: Record<ArchiveThreatFinding["threatLevel"], number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const highestLevel = (levels: ArchiveThreatFinding["threatLevel"][]) =>
  levels.sort((a, b) => levelRank[b] - levelRank[a])[0] || "low";

export const scanArchiveFileForThreats = async (file: ReceivedFile): Promise<ArchiveThreatFinding | null> => {
  const extension = file.extension.toLowerCase();
  const mimeType = (file.mimeType || "").toLowerCase();
  const priorStatus = file.metadata?.security?.scanStatus;
  if (priorStatus === "overridden" || priorStatus === "blocked" || priorStatus === "quarantined") {
    return priorStatus === "overridden" ? null : {
      id: `threat_${file.id}`,
      fileId: file.id,
      name: file.name,
      folderPath: file.folderPath || "/",
      extension,
      mimeType,
      size: Number(file.size || 0),
      threatLevel: file.metadata?.security?.threatLevel === "critical" ? "critical" : "high",
      scanStatus: priorStatus,
      reasons: Array.isArray(file.metadata?.security?.reasons) ? file.metadata!.security!.reasons! : ["Owner action already applied."],
      recommendedAction: String(file.metadata?.security?.recommendedAction || "Review owner decision."),
      safeReaderRequired: Boolean(file.metadata?.security?.safeReaderRequired),
      scannedAt: String(file.metadata?.security?.scannedAt || new Date().toISOString()),
    };
  }

  const reasons: string[] = [];
  const levels: ArchiveThreatFinding["threatLevel"][] = [];
  const blob = await getFileBlob(file.id);
  const signature = await signatureFromBlob(blob);
  const textSample = [
    file.metadata?.contentPreview ? String(file.metadata.contentPreview) : "",
    await textSampleFromBlob(blob),
  ].join("\n").slice(0, 220_000);
  const lowerText = textSample.toLowerCase();

  if (DANGEROUS_EXTENSIONS.has(extension)) {
    reasons.push(`Executable/system extension .${extension} should not run inside PocketFlow.`);
    levels.push(extension === "apk" || extension === "dex" ? "critical" : "high");
  }
  if (SCRIPT_EXTENSIONS.has(extension)) {
    reasons.push(`Script extension .${extension} can execute commands if launched outside Reader.`);
    levels.push("high");
  }
  if (MACRO_EXTENSIONS.has(extension)) {
    reasons.push(`Macro-enabled Office file .${extension} can carry automation malware.`);
    levels.push("high");
  }
  if (signature.startsWith("4d 5a")) {
    reasons.push("Windows executable signature detected.");
    levels.push("critical");
  }
  if (signature.startsWith("7f 45 4c 46")) {
    reasons.push("Linux/Android ELF executable signature detected.");
    levels.push("critical");
  }
  if (signature.startsWith("64 65 78 0a")) {
    reasons.push("Android DEX bytecode signature detected.");
    levels.push("critical");
  }
  if (extension === "pdf" && /\/(javascript|js|openaction|launch|embeddedfile)\b/i.test(textSample)) {
    reasons.push("PDF contains JavaScript, launch action, or embedded-file indicators.");
    levels.push("high");
  }
  if (extension === "svg" && /<script\b|onload\s*=|onerror\s*=|javascript:/i.test(textSample)) {
    reasons.push("SVG contains script/event-handler indicators.");
    levels.push("high");
  }
  if (["html", "htm"].includes(extension) && /<script\b|javascript:|eval\s*\(|document\.write\s*\(/i.test(textSample)) {
    reasons.push("HTML contains active script. Reader safe box is required before interaction.");
    levels.push("medium");
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension) && /(\.exe|\.dll|\.bat|\.cmd|\.ps1|\.vbs|\.apk|\.dex)\b/i.test(textSample)) {
    reasons.push("Archive preview mentions executable or script payloads.");
    levels.push("high");
  }
  if (SAFE_IMAGE_EXTENSIONS.has(extension) && /executable|application\/x-msdownload|application\/vnd\.android\.package-archive/.test(mimeType)) {
    reasons.push("Image extension does not match executable MIME type.");
    levels.push("critical");
  }
  if (DOCUMENT_EXTENSIONS.has(extension) && DANGEROUS_EXTENSIONS.has(String(file.safeName || "").split(".").pop()?.toLowerCase() || "")) {
    reasons.push("Safe-looking document name has dangerous normalized extension.");
    levels.push("high");
  }

  if (!reasons.length) {
    const cleanSecurity = {
      scanStatus: "clean" as const,
      threatLevel: "clean" as const,
      scannedAt: new Date().toISOString(),
      scanner: "PocketFlow heuristic scanner v1",
      reasons: [],
      recommendedAction: "No local heuristic threat indicators found.",
      safeReaderRequired: false,
    };
    if (file.metadata?.security?.scanStatus !== "clean") {
      await saveFileMetadata({ ...file, metadata: { ...file.metadata, security: cleanSecurity } });
    }
    return null;
  }

  const scannedAt = new Date().toISOString();
  const threatLevel = highestLevel(levels);
  const finding: ArchiveThreatFinding = {
    id: `threat_${file.id}`,
    fileId: file.id,
    name: file.name,
    folderPath: file.folderPath || "/",
    extension,
    mimeType,
    size: Number(file.size || 0),
    threatLevel,
    scanStatus: "suspected",
    reasons,
    recommendedAction: threatLevel === "critical" ? "Block or quarantine. Open only inside Reader safe box if absolutely required." : "Quarantine or open in Reader safe box for inspection.",
    safeReaderRequired: true,
    scannedAt,
  };

  await saveFileMetadata({
    ...file,
    metadata: {
      ...file.metadata,
      security: {
        scanStatus: "suspected",
        threatLevel,
        scannedAt,
        scanner: "PocketFlow heuristic scanner v1",
        reasons,
        recommendedAction: finding.recommendedAction,
        safeReaderRequired: true,
      },
    },
    auditLog: [
      ...file.auditLog,
      { type: "file.validated", at: scannedAt, detail: `Security scan suspected ${threatLevel}: ${reasons[0]}` },
    ],
  });

  return finding;
};

export const scanArchiveThreats = async (records: ReceivedFile[]) => {
  const findings: ArchiveThreatFinding[] = [];
  for (const file of records.filter((item) => item.status !== "deleted")) {
    const finding = await scanArchiveFileForThreats(file);
    if (finding && finding.scanStatus !== "overridden") findings.push(finding);
  }
  return findings;
};

export const buildArchiveDuplicateGroups = (
  records: ReceivedFile[],
  nativeFiles: NativeFilePayload[] = [],
): ArchiveDuplicateGroup[] => {
  const candidates = [
    ...records
      .filter((file) => file.status !== "deleted" && file.category !== "blocked")
      .map(archiveCandidateFromRecord),
    ...nativeFiles.map(archiveCandidateFromNative),
  ];

  const groupsByKey = new Map<string, ArchiveDuplicateCandidate[]>();
  candidates.forEach((candidate) => {
    duplicateKeysForCandidate(candidate).forEach((key) => {
      const group = groupsByKey.get(key) || [];
      group.push(candidate);
      groupsByKey.set(key, group);
    });
  });

  const seenGroupIds = new Set<string>();
  return Array.from(groupsByKey.entries())
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => {
      const unique = Array.from(new Map(group.map((item) => [item.id, item])).values()).sort(sortNewestFirst);
      const keep = unique[0];
      const candidatesToDelete = unique.slice(1).map((candidate) => {
        const exact = key.startsWith("loc:") || key.startsWith("name-size:");
        return {
          ...candidate,
          confidence: exact ? "exact" as const : "likely" as const,
          reason: exact
            ? "Same source/path or exact filename and size."
            : "Same cleaned filename and size. Needs human review if names differ.",
        };
      });
      const confidence: ArchiveDuplicateGroup["confidence"] = candidatesToDelete.every((item) => item.confidence === "exact") ? "exact" : "likely";
      const id = `dup_${stableHash(`${key}:${unique.map((item) => item.id).join("|")}`)}`;
      return {
        id,
        key,
        title: stableFileName(keep.name) || keep.name,
        keep,
        candidates: candidatesToDelete,
        confidence,
      };
    })
    .filter((group) => {
      if (seenGroupIds.has(group.id)) return false;
      seenGroupIds.add(group.id);
      return group.candidates.length > 0;
    })
    .slice(0, 80);
};

const logEntry = (action: ArchiveMaintenanceLogEntry["action"], message: string): ArchiveMaintenanceLogEntry => ({
  id: `archive_log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
  at: new Date().toISOString(),
  action,
  message,
});

export const runArchiveMaintenanceScan = async (
  state: ArchiveMaintenanceState,
  nativeFiles: NativeFilePayload[] = [],
): Promise<{ state: ArchiveMaintenanceState; result: ArchiveMaintenanceScanResult }> => {
  const records = await getAllFiles();
  const groups = buildArchiveDuplicateGroups(records, nativeFiles);
  const threatQueue = state.config.malwareScan ? await scanArchiveThreats(records) : [];
  const deleted: ArchiveDuplicateCandidate[] = [];

  if (state.config.autoDeleteExact) {
    const deleteCandidates = groups
      .flatMap((group) => group.confidence === "exact" ? group.candidates : [])
      .filter((candidate) => candidate.deletable);
    for (const candidate of deleteCandidates) {
      await deleteFileFromStorage(candidate.id);
      deleted.push(candidate);
    }
  }

  const remainingGroups = deleted.length
    ? groups
        .map((group) => ({
          ...group,
          candidates: group.candidates.filter((candidate) => !deleted.some((item) => item.id === candidate.id)),
        }))
        .filter((group) => group.candidates.length > 0)
    : groups;
  const reviewQueue = state.config.humanReview ? remainingGroups : [];
  const now = new Date().toISOString();
  const message = deleted.length
    ? `Removed ${deleted.length} exact duplicate${deleted.length === 1 ? "" : "s"}. ${reviewQueue.length} duplicate group${reviewQueue.length === 1 ? "" : "s"} and ${threatQueue.length} threat${threatQueue.length === 1 ? "" : "s"} need review.`
    : reviewQueue.length
      ? `Found ${reviewQueue.length} duplicate group${reviewQueue.length === 1 ? "" : "s"} and ${threatQueue.length} threat${threatQueue.length === 1 ? "" : "s"} for review.`
      : threatQueue.length
        ? `Security scan flagged ${threatQueue.length} file${threatQueue.length === 1 ? "" : "s"} for review.`
        : `Scan complete. No duplicates or malware indicators found in ${records.length + nativeFiles.length} files.`;
  const nextState: ArchiveMaintenanceState = {
    ...state,
    lastRunAt: now,
    nextRunAt: state.running ? nextRunFrom(now, state.config.cadence) : "",
    status: message,
    reviewQueue,
    threatQueue,
    deletedLog: [
      logEntry("scan", message),
      ...threatQueue.map((finding) => logEntry("threat", `${finding.threatLevel.toUpperCase()} suspicion: ${finding.name}`)),
      ...deleted.map((candidate) => logEntry("delete", `Deleted duplicate record: ${candidate.name}`)),
      ...state.deletedLog,
    ].slice(0, 40),
  };
  saveArchiveMaintenanceState(nextState);
  return {
    state: nextState,
    result: {
      scannedRecords: records.length + nativeFiles.length,
      duplicateGroups: reviewQueue,
      deleted,
      message,
    },
  };
};

export const approveArchiveDuplicateGroup = async (
  state: ArchiveMaintenanceState,
  groupId: string,
): Promise<ArchiveMaintenanceState> => {
  const group = state.reviewQueue.find((item) => item.id === groupId);
  if (!group) return state;
  const deleted: ArchiveDuplicateCandidate[] = [];
  for (const candidate of group.candidates.filter((item) => item.deletable)) {
    await deleteFileFromStorage(candidate.id);
    deleted.push(candidate);
  }
  const message = deleted.length
    ? `Deleted ${deleted.length} reviewed duplicate${deleted.length === 1 ? "" : "s"} from ${group.title}.`
    : `Marked ${group.title} reviewed. Native files need manual deletion.`;
  const nextState: ArchiveMaintenanceState = {
    ...state,
    status: message,
    reviewQueue: state.reviewQueue.filter((item) => item.id !== groupId),
    deletedLog: [logEntry(deleted.length ? "delete" : "review", message), ...state.deletedLog].slice(0, 40),
  };
  saveArchiveMaintenanceState(nextState);
  return nextState;
};

export const dismissArchiveDuplicateGroup = (state: ArchiveMaintenanceState, groupId: string): ArchiveMaintenanceState => {
  const group = state.reviewQueue.find((item) => item.id === groupId);
  const message = group ? `Kept duplicate group for now: ${group.title}.` : "Review group dismissed.";
  const nextState: ArchiveMaintenanceState = {
    ...state,
    status: message,
    reviewQueue: state.reviewQueue.filter((item) => item.id !== groupId),
    deletedLog: [logEntry("review", message), ...state.deletedLog].slice(0, 40),
  };
  saveArchiveMaintenanceState(nextState);
  return nextState;
};

const updateFileSecurityDecision = async (
  state: ArchiveMaintenanceState,
  fileId: string,
  decision: "quarantined" | "blocked" | "overridden",
): Promise<ArchiveMaintenanceState> => {
  const files = await getAllFiles();
  const file = files.find((item) => item.id === fileId);
  const finding = state.threatQueue.find((item) => item.fileId === fileId);
  const name = file?.name || finding?.name || "file";
  if (!file) {
    const nextMissing = {
      ...state,
      threatQueue: state.threatQueue.filter((item) => item.fileId !== fileId),
      deletedLog: [logEntry("review", `Security record cleared for missing file: ${name}`), ...state.deletedLog].slice(0, 40),
    };
    saveArchiveMaintenanceState(nextMissing);
    return nextMissing;
  }

  const now = new Date().toISOString();
  const nextFile: ReceivedFile = {
    ...file,
    status: decision === "blocked" ? "blocked" : file.status,
    blockedReason: decision === "blocked" ? "Blocked by PocketFlow Archive malware guard." : file.blockedReason,
    folderPath: decision === "quarantined" ? "/quarantine" : file.folderPath,
    metadata: {
      ...file.metadata,
      security: {
        ...(file.metadata?.security || {}),
        scanStatus: decision,
        ownerDecisionAt: now,
        safeReaderRequired: decision !== "overridden",
      },
    },
    auditLog: [
      ...file.auditLog,
      {
        type: decision === "blocked" ? "file.blocked" : "file.validated",
        at: now,
        detail:
          decision === "quarantined"
            ? "Owner quarantined after security scan."
            : decision === "blocked"
              ? "Owner blocked after security scan."
              : "Owner overrode security scan and allowed file.",
      },
    ],
  };
  await saveFileMetadata(nextFile);

  const action = decision === "quarantined" ? "quarantine" : decision === "blocked" ? "block" : "override";
  const message =
    decision === "quarantined"
      ? `Quarantined ${name}.`
      : decision === "blocked"
        ? `Blocked ${name}.`
        : `Owner override allowed ${name}.`;
  const nextState: ArchiveMaintenanceState = {
    ...state,
    status: message,
    threatQueue: state.threatQueue.filter((item) => item.fileId !== fileId),
    deletedLog: [logEntry(action, message), ...state.deletedLog].slice(0, 40),
  };
  saveArchiveMaintenanceState(nextState);
  return nextState;
};

export const quarantineArchiveThreat = (state: ArchiveMaintenanceState, fileId: string) =>
  updateFileSecurityDecision(state, fileId, "quarantined");

export const blockArchiveThreat = (state: ArchiveMaintenanceState, fileId: string) =>
  updateFileSecurityDecision(state, fileId, "blocked");

export const overrideArchiveThreat = (state: ArchiveMaintenanceState, fileId: string) =>
  updateFileSecurityDecision(state, fileId, "overridden");

export const updateArchiveMaintenanceConfig = (
  state: ArchiveMaintenanceState,
  patch: Partial<ArchiveMaintenanceConfig>,
): ArchiveMaintenanceState => {
  const config = { ...state.config, ...patch };
  const now = new Date().toISOString();
  const nextState = {
    ...state,
    config,
    running: config.enabled ? state.running : false,
    nextRunAt: config.enabled && state.running ? nextRunFrom(state.lastRunAt || now, config.cadence) : "",
  };
  saveArchiveMaintenanceState(nextState);
  return nextState;
};

export const setArchiveMaintenanceRunning = (
  state: ArchiveMaintenanceState,
  running: boolean,
): ArchiveMaintenanceState => {
  const now = new Date().toISOString();
  const config = { ...state.config, enabled: running };
  const nextState: ArchiveMaintenanceState = {
    ...state,
    config,
    running,
    nextRunAt: running ? nextRunFrom(now, config.cadence) : "",
    status: running ? "Archive agent running. Next slow scan scheduled." : "Archive agent stopped.",
    deletedLog: [logEntry(running ? "start" : "stop", running ? "Archive agent started." : "Archive agent stopped."), ...state.deletedLog].slice(0, 40),
  };
  saveArchiveMaintenanceState(nextState);
  return nextState;
};

export const parseArchiveMaintenanceCommand = (prompt: string) => {
  const text = prompt.toLowerCase();
  if (!/\b(archive|archives|files|duplicate|duplicates|clean|cleaner|cleanup|dedupe|deduplicate)\b/.test(text)) return null;
  if (/\b(stop|pause|block|disable|turn off)\b/.test(text)) return { type: "stop" as const };
  if (/\b(start|enable|turn on|run|scan|check|clean)\b/.test(text)) {
    const hourMatch = text.match(/\b(?:every|each)\s+(\d{1,2})\s*(?:h|hour|hours)\b/);
    const cadence = hourMatch?.[1] as ArchiveMaintenanceCadence | undefined;
    return { type: "start" as const, cadence };
  }
  return null;
};
