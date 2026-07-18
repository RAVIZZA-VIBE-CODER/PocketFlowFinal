import { ReceivedFile } from "../types";

const EDITABLE_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "json",
  "jsonl",
  "csv",
  "tsv",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "html",
  "htm",
  "css",
  "scss",
  "xml",
  "yml",
  "yaml",
  "toml",
  "ini",
  "env",
  "conf",
  "config",
  "log",
  "sql",
  "py",
  "php",
  "pl",
  "rb",
  "go",
  "rs",
  "java",
  "c",
  "cpp",
  "cs",
  "h",
  "hpp",
  "sh",
  "bash",
  "zsh"
]);

const GAME_EXTENSIONS = new Set(["gb", "gbc", "gba", "nds", "iso", "cso", "pbp"]);

export function isReaderEditableFile(file: ReceivedFile): boolean {
  const extension = file.extension.toLowerCase();
  return (
    EDITABLE_EXTENSIONS.has(extension) ||
    file.mimeType.startsWith("text/") ||
    file.mimeType.includes("json") ||
    file.category === "markdown" ||
    file.category === "csv" ||
    file.category === "text"
  );
}

export function isReaderImageFile(file: ReceivedFile): boolean {
  return file.category === "image" || file.mimeType.startsWith("image/");
}

export function isReaderPdfFile(file: ReceivedFile): boolean {
  return file.extension.toLowerCase() === "pdf" || file.mimeType === "application/pdf";
}

export function isReaderArchiveFile(file: ReceivedFile): boolean {
  const name = `${file.name} ${file.safeName}`.toLowerCase();
  return (
    file.category === "archive" ||
    ["zip", "rar", "7z", "tar", "gz", "tgz"].includes(file.extension.toLowerCase()) ||
    name.includes(".zip.")
  );
}

export function isReaderGameFile(file: ReceivedFile): boolean {
  return GAME_EXTENSIONS.has(file.extension.toLowerCase());
}

export function isReaderHtmlFile(file: ReceivedFile): boolean {
  return ["html", "htm"].includes(file.extension.toLowerCase()) || file.mimeType.includes("html");
}

export function isReaderSpreadsheetFile(file: ReceivedFile): boolean {
  return ["csv", "tsv", "xlsx", "xls", "ods"].includes(file.extension.toLowerCase()) || file.category === "csv";
}

export function isReaderMediaFile(file: ReceivedFile): boolean {
  const extension = file.extension.toLowerCase();
  return (
    isReaderImageFile(file) ||
    file.mimeType.startsWith("video/") ||
    file.mimeType.startsWith("audio/") ||
    ["mp4", "mov", "m4v", "webm", "mp3", "wav", "m4a", "ogg"].includes(extension)
  );
}

export function isReaderDesignOrModelFile(file: ReceivedFile): boolean {
  return ["fig", "sketch", "xd", "psd", "ai", "svg", "blend", "fbx", "obj", "glb", "gltf", "stl", "step", "stp", "dwg", "dxf"].includes(file.extension.toLowerCase());
}

export function isReaderPackageInstallerFile(file: ReceivedFile): boolean {
  return ["apk", "ipa", "aab", "xapk"].includes(file.extension.toLowerCase());
}
