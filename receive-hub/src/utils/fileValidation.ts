/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FileCategory, ImportDestination } from "../types";

export const BLOCKED_EXTENSIONS = [
  "exe", "bat", "cmd", "sh", "js", "jar", "msi", "apk", "com",
  "scr", "ps1", "vb", "vbs", "wsf", "dll", "dmg", "pkg", "deb", "rpm"
];

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "heic", "svg"];
export const MARKDOWN_EXTENSIONS = ["md", "markdown"];
export const DATA_EXTENSIONS = ["csv", "json"];
export const DOCUMENT_EXTENSIONS = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"];
export const ARCHIVE_EXTENSIONS = ["zip"];

export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  if (parts.length <= 1) return "";
  return parts.pop()?.toLowerCase() || "";
}

export function sanitizeFileName(name: string): string {
  // Replace empty spaces, backslashes, or unsafe chars with underscores
  const clean = name
    .trim()
    .replace(/[\\\s/?:*\"<>|]/g, "_") // replaces restricted NTFS/Android characters
    .replace(/_{2,}/g, "_"); // removes double underscores
  return clean || "received_file";
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export interface ValidationResult {
  ok: boolean;
  category: FileCategory;
  message: string;
  blockedReason?: string;
}

export function validateIncomingFile(
  filename: string,
  size: number,
  maxSingleMb: number = 50
): ValidationResult {
  const ext = getFileExtension(filename);

  // Check empty name
  if (!filename) {
    return {
      ok: false,
      category: "blocked",
      message: "File name is missing.",
      blockedReason: "Invalid filename"
    };
  }

  // Check blocked extension
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    return {
      ok: false,
      category: "blocked",
      message: `File type (.${ext}) is restricted because it contains executable commands or system scripts.`,
      blockedReason: "Executable/script extension blocked for system safety"
    };
  }

  // Check size restrictions
  const maxBytes = maxSingleMb * 1024 * 1024;
  if (size > maxBytes) {
    return {
      ok: false,
      category: "blocked",
      message: `File exceeds the single file limit of ${maxSingleMb} MB.`,
      blockedReason: `Size limit exceeded (${formatBytes(size)})`
    };
  }

  // Classify extension
  let category: FileCategory = "unknownSafe";
  if (IMAGE_EXTENSIONS.includes(ext)) {
    category = "image";
  } else if (MARKDOWN_EXTENSIONS.includes(ext)) {
    category = "markdown";
  } else if (ext === "csv") {
    category = "csv";
  } else if (ext === "json") {
    // Will be sub-classified later dynamically into dashboard or builderPackage if structure matches
    category = "text"; 
  } else if (DOCUMENT_EXTENSIONS.includes(ext)) {
    category = "document";
  } else if (ARCHIVE_EXTENSIONS.includes(ext)) {
    category = "archive";
  }

  return {
    ok: true,
    category,
    message: "File elements are validated."
  };
}

export function suggestDestination(category: FileCategory, filename: string): ImportDestination {
  const ext = getFileExtension(filename).toLowerCase();
  
  if (category === "dashboard") {
    return "dashboardStudio";
  }
  if (category === "builderPackage") {
    return "pocketFlowBuilder";
  }
  if (category === "image") {
    return "assetsLibrary";
  }
  if (category === "markdown") {
    if (filename.toLowerCase().includes("dashboard")) {
      return "dashboardStudio";
    }
    if (filename.toLowerCase().includes("builder")) {
      return "pocketFlowBuilder";
    }
    return "notes";
  }
  if (category === "csv") {
    return "dashboardStudio";
  }
  if (category === "archive") {
    if (filename.toLowerCase().includes("dashboard")) {
      return "dashboardStudio";
    }
    if (filename.toLowerCase().includes("builder")) {
      return "pocketFlowBuilder";
    }
    return "genericStorage";
  }
  
  return "genericStorage";
}
