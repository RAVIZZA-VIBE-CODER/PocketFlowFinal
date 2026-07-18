import { ReceivedFile } from "../types";

export type WorkspaceRiskLevel = "safe" | "notice" | "warning" | "danger";

export interface WorkspaceFileAssessment {
  kind: string;
  riskLevel: WorkspaceRiskLevel;
  warnings: string[];
  actions: string[];
  nativeRequired: string[];
}

export interface ArchiveEntryAssessment {
  blocked: boolean;
  warnings: string[];
}

const EXECUTABLE_EXTENSIONS = new Set([
  "apk",
  "app",
  "bat",
  "bin",
  "cmd",
  "com",
  "deb",
  "dmg",
  "exe",
  "jar",
  "msi",
  "pkg",
  "ps1",
  "run",
  "sh"
]);

const SCRIPT_EXTENSIONS = new Set([
  "bash",
  "cjs",
  "js",
  "mjs",
  "php",
  "pl",
  "py",
  "rb",
  "sh",
  "ts",
  "zsh"
]);

const WALLET_EXTENSIONS = new Set([
  "dat",
  "json",
  "key",
  "keystore",
  "pem",
  "p12",
  "seed",
  "wallet"
]);

const ARCHIVE_EXTENSIONS = new Set(["zip", "7z", "rar", "tar", "gz", "tgz", "tar.gz"]);
const DESIGN_EXTENSIONS = new Set(["fig", "sketch", "xd", "psd", "ai", "svg", "blend", "fbx", "obj", "glb", "gltf", "stl", "step", "stp", "dwg", "dxf"]);
const MEDIA_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "mp4", "mov", "m4v", "webm", "mp3", "wav", "m4a", "ogg"]);
const DATA_EXTENSIONS = new Set(["csv", "tsv", "json", "jsonl", "xml", "yaml", "yml", "sqlite", "db", "sql"]);
const PACKAGE_EXTENSIONS = new Set(["apk", "ipa", "aab", "xapk"]);

function extensionFor(file: Pick<ReceivedFile, "name" | "extension">): string {
  const explicit = file.extension?.toLowerCase().trim();
  if (explicit) return explicit;
  return file.name.toLowerCase().split(".").pop() || "";
}

function lowerName(file: Pick<ReceivedFile, "name">): string {
  return file.name.toLowerCase();
}

export function isWalletSensitiveFile(file: ReceivedFile): boolean {
  const name = lowerName(file);
  const extension = extensionFor(file);
  return (
    WALLET_EXTENSIONS.has(extension) ||
    name.includes("seed") ||
    name.includes("mnemonic") ||
    name.includes("private-key") ||
    name.includes("private_key") ||
    name.includes("wallet") ||
    name.includes("keystore") ||
    name === ".env" ||
    name.endsWith(".env") ||
    name.includes("secret") ||
    name.includes("recovery")
  );
}

export function workspaceKindForFile(file: ReceivedFile): string {
  const extension = extensionFor(file);
  if (PACKAGE_EXTENSIONS.has(extension)) return "install package";
  if (ARCHIVE_EXTENSIONS.has(extension) || file.category === "archive") return "archive";
  if (DESIGN_EXTENSIONS.has(extension)) return "design/model";
  if (MEDIA_EXTENSIONS.has(extension) || file.category === "image") return "media";
  if (DATA_EXTENSIONS.has(extension) || file.category === "csv" || file.category === "dashboard") return "data";
  if (file.category === "document" || ["pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "epub", "pages"].includes(extension)) return "document";
  if (file.category === "markdown" || file.category === "text") return "text/code";
  return "file";
}

export function assessWorkspaceFile(file: ReceivedFile): WorkspaceFileAssessment {
  const extension = extensionFor(file);
  const warnings: string[] = [];
  const actions = ["preview", "metadata", "checksum", "download copy"];
  const nativeRequired = ["rename", "move", "copy", "delete", "share", "open external", "write to SSD"];
  let riskLevel: WorkspaceRiskLevel = "safe";

  if (isWalletSensitiveFile(file)) {
    warnings.push("Wallet, secret, seed, private key, .env, or recovery-looking file. Keep local and never upload to AI/cloud.");
    riskLevel = "danger";
  }

  if (EXECUTABLE_EXTENSIONS.has(extension)) {
    warnings.push("Executable or installer package. Inspect only; never auto-run from Reader.");
    riskLevel = riskLevel === "danger" ? "danger" : "warning";
    actions.push("inspect only");
  } else if (SCRIPT_EXTENSIONS.has(extension)) {
    warnings.push("Script/code file. Editing is allowed, execution is intentionally unavailable.");
    riskLevel = riskLevel === "danger" ? "danger" : "notice";
  }

  if (ARCHIVE_EXTENSIONS.has(extension) || file.category === "archive") {
    actions.push("list entries", "extract safe copy", "create new ZIP copy");
    nativeRequired.push("encrypted ZIP", "7z/RAR write", "safe replace original archive");
    if (extension !== "zip") {
      warnings.push("Non-ZIP archive support requires the Android/native archive bridge.");
      riskLevel = riskLevel === "safe" ? "notice" : riskLevel;
    }
  }

  if (PACKAGE_EXTENSIONS.has(extension)) {
    warnings.push("APK/IPA/AAB/XAPK packages are inspect-only in PocketFlow Reader.");
    riskLevel = riskLevel === "danger" ? "danger" : "warning";
  }

  return {
    kind: workspaceKindForFile(file),
    riskLevel,
    warnings,
    actions,
    nativeRequired
  };
}

export function assessArchiveEntryPath(path: string, size = 0): ArchiveEntryAssessment {
  const normalized = path.replace(/\\/g, "/");
  const warnings: string[] = [];
  let blocked = false;

  if (!normalized.trim()) {
    blocked = true;
    warnings.push("Empty archive path.");
  }
  if (normalized.startsWith("/") || /^[a-z]:\//i.test(normalized)) {
    blocked = true;
    warnings.push("Absolute archive path blocked.");
  }
  if (normalized.split("/").some((part) => part === "..")) {
    blocked = true;
    warnings.push("Path traversal blocked by Zip Slip protection.");
  }
  if (size > 250 * 1024 * 1024) {
    warnings.push("Very large uncompressed entry. Extract carefully and verify free space first.");
  }

  return { blocked, warnings };
}

export async function checksumBlobSha256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function archiveCapabilityLabel(file: ReceivedFile | null): string {
  if (!file) return "Open a file or folder first.";
  const extension = extensionFor(file);
  if (extension === "zip") return "ZIP inspect/extract and normal ZIP creation are available locally. Encrypted ZIP needs native/zip.js bridge.";
  if (["7z", "rar", "tar", "gz", "tgz", "tar.gz"].includes(extension)) return "Inspect/extract/write requires Android native archive bridge.";
  if (PACKAGE_EXTENSIONS.has(extension)) return "Package installer files are inspect-only.";
  return "Folder and file workspace actions are local-first; destructive operations require Android SAF bridge.";
}
