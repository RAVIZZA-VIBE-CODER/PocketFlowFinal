import JSZip from "jszip";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  ExternalLink,
  FileSearch,
  FileText,
  FolderOpen,
  Gamepad2,
  Image,
  Info,
  Maximize2,
  Minimize2,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Table,
  Upload,
  X
} from "lucide-react";
import { ReceivedFile } from "../types";
import { formatBytes } from "../utils/fileValidation";
import { getFileBlobForRecord } from "../utils/storage";
import { extractPackagePreview, PackagePreview } from "../utils/packagePreview";
import {
  isReaderArchiveFile,
  isReaderEditableFile,
  isReaderGameFile,
  isReaderHtmlFile,
  isReaderImageFile,
  isReaderPdfFile,
  isReaderSpreadsheetFile
} from "../utils/readerSupport";
import {
  archiveCapabilityLabel,
  assessArchiveEntryPath,
  assessWorkspaceFile,
  checksumBlobSha256
} from "../utils/fileWorkspace";

type ReaderMode = "workspace" | "preview" | "edit" | "metadata" | "archive";
type WorkspaceFilter = "all" | "archives" | "media" | "docs" | "code" | "risks";
type WorkspaceSort = "name" | "size" | "date" | "kind";

const READER_TEXT_PREVIEW_BYTES = 220_000;
const READER_EDIT_TEXT_BYTES = 1_500_000;
const READER_PACKAGE_PREVIEW_BYTES = 8 * 1024 * 1024;
const READER_ZIP_SCAN_BYTES = 28 * 1024 * 1024;
const READER_ZIP_ENTRY_LIMIT = 90;
const READER_ZIP_TEXT_PREVIEW_LIMIT = 18;
const READER_ZIP_ENTRY_PREVIEW_BYTES = 70_000;

type FolderInputElement = HTMLInputElement & {
  webkitdirectory?: boolean;
  directory?: boolean;
};

type ReaderBridge = {
  openFolder?: () => void;
  openExternal?: (nativeUri: string) => void;
  shareFile?: (nativeUri: string) => void;
  rename?: (nativeUri: string, nextName: string) => void;
  move?: (nativeUri: string, targetUri: string) => void;
  copy?: (nativeUri: string, targetUri: string) => void;
  delete?: (nativeUri: string) => void;
  saveToArchive?: (payload: unknown) => void;
};

declare global {
  interface Window {
    PocketFlowReaderBridge?: ReaderBridge;
  }
}

interface ZipEntryPreview {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  preview?: string;
  blocked?: boolean;
  warnings?: string[];
}

interface ReaderAppProps {
  files: ReceivedFile[];
  activeFile: ReceivedFile | null;
  initialMode?: ReaderMode;
  onSelectFile: (file: ReceivedFile) => void;
  onUploadFile: (file: File) => void;
  onSaveTextEdit: (file: ReceivedFile, content: string) => Promise<void>;
  onNotify: (msg: string, type: "success" | "info" | "warn") => void;
}

export default function ReaderApp({
  files,
  activeFile,
  initialMode = "preview",
  onSelectFile,
  onUploadFile,
  onSaveTextEdit,
  onNotify
}: ReaderAppProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<FolderInputElement>(null);
  const [mode, setMode] = useState<ReaderMode>(initialMode);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState("");
  const [isLoadingBlob, setIsLoadingBlob] = useState(false);
  const [isZipWorking, setIsZipWorking] = useState(false);
  const [isFullscreenReader, setIsFullscreenReader] = useState(false);
  const [packagePreview, setPackagePreview] = useState<PackagePreview | null>(null);
  const [zipEntries, setZipEntries] = useState<ZipEntryPreview[]>([]);
  const [fileSearch, setFileSearch] = useState("");
  const [browserFolder, setBrowserFolder] = useState("/");
  const [htmlFrameKey, setHtmlFrameKey] = useState(0);
  const [workspaceFilter, setWorkspaceFilter] = useState<WorkspaceFilter>("all");
  const [workspaceSort, setWorkspaceSort] = useState<WorkspaceSort>("name");
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [checksumResult, setChecksumResult] = useState<string | null>(null);
  const [includeManifest, setIncludeManifest] = useState(true);
  const [compressionLevel, setCompressionLevel] = useState(6);

  const recentFiles = files
    .filter((file) => file.status !== "deleted")
    .slice()
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
    .slice(0, 8);

  const filePathForBrowser = (file: ReceivedFile) => {
    const relativePath = typeof file.metadata?.relativePath === "string" ? file.metadata.relativePath.replace(/^\/+/, "") : "";
    if (relativePath) return relativePath;
    const folder = (file.folderPath || "/").replace(/^\/+|\/+$/g, "");
    return folder ? `${folder}/${file.name}` : file.name;
  };

  const browsableFiles = useMemo(() => (
    files
      .filter((file) => file.status !== "deleted")
      .slice()
      .sort((a, b) => filePathForBrowser(a).localeCompare(filePathForBrowser(b)))
  ), [files]);

  const childFolders = useMemo(() => {
    const current = browserFolder === "/" ? "" : browserFolder.replace(/^\/+|\/+$/g, "");
    const children = new Set<string>();
    browsableFiles.forEach((file) => {
      const parts = filePathForBrowser(file).split("/").filter(Boolean);
      const currentParts = current ? current.split("/") : [];
      const inside = currentParts.every((part, index) => parts[index] === part);
      if (!inside || parts.length <= currentParts.length + 1) return;
      children.add(`/${parts.slice(0, currentParts.length + 1).join("/")}`);
    });
    return Array.from(children).sort((a, b) => a.localeCompare(b));
  }, [browserFolder, browsableFiles]);

  const visibleFolderChips = useMemo(() => {
    const currentParts = browserFolder.split("/").filter(Boolean);
    const parent = currentParts.length > 0 ? `/${currentParts.slice(0, -1).join("/")}` : "/";
    return Array.from(new Set(["/", parent || "/", browserFolder, ...childFolders]))
      .filter(Boolean)
      .slice(0, 28);
  }, [browserFolder, childFolders]);

  const visibleBrowserFiles = useMemo(() => {
    const query = fileSearch.trim().toLowerCase();
    const current = browserFolder === "/" ? "" : browserFolder.replace(/^\/+|\/+$/g, "");
    const filtered = browsableFiles.filter((file) => {
      const path = filePathForBrowser(file);
      const lower = `${path} ${file.name} ${file.extension} ${file.category}`.toLowerCase();
      if (query && !lower.includes(query)) return false;
      const assessment = assessWorkspaceFile(file);
      if (workspaceFilter === "archives" && !isReaderArchiveFile(file)) return false;
      if (workspaceFilter === "media" && !["image"].includes(file.category) && !file.mimeType.startsWith("video/") && !file.mimeType.startsWith("audio/")) return false;
      if (workspaceFilter === "docs" && !["document", "markdown", "csv", "dashboard"].includes(file.category)) return false;
      if (workspaceFilter === "code" && assessment.kind !== "text/code") return false;
      if (workspaceFilter === "risks" && assessment.riskLevel === "safe") return false;
      if (query) return true;
      const parts = path.split("/").filter(Boolean);
      const currentParts = current ? current.split("/") : [];
      const inside = currentParts.every((part, index) => parts[index] === part);
      return inside && parts.length === currentParts.length + 1;
    });
    return filtered.sort((a, b) => {
      if (workspaceSort === "size") return b.size - a.size;
      if (workspaceSort === "date") return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
      if (workspaceSort === "kind") return assessWorkspaceFile(a).kind.localeCompare(assessWorkspaceFile(b).kind) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  }, [browserFolder, browsableFiles, fileSearch, workspaceFilter, workspaceSort]);

  const security = activeFile?.metadata?.security;
  const isSecurityFlagged = Boolean(security && ["suspected", "quarantined", "blocked"].includes(security.scanStatus || ""));
  const isBlockedBySecurity = security?.scanStatus === "blocked";
  const isEditable = activeFile ? isReaderEditableFile(activeFile) && !isSecurityFlagged : false;
  const displayText = textContent || activeFile?.metadata?.contentPreview || "";
  const activeFileIndex = activeFile ? recentFiles.findIndex((file) => file.id === activeFile.id) : -1;
  const isPackagedPreviewFile = activeFile
    ? ["pptx", "docx", "epub", "pages"].includes(activeFile.extension.toLowerCase())
    : false;
  const extension = activeFile?.extension.toLowerCase() || "";
  const activeFileIsZip = activeFile
    ? activeFile.extension.toLowerCase() === "zip" ||
      activeFile.mimeType.includes("zip") ||
      `${activeFile.name} ${activeFile.safeName}`.toLowerCase().includes(".zip.")
    : false;
  const activeFileIsIncompleteZipDownload = activeFile
    ? `${activeFile.name} ${activeFile.safeName}`.toLowerCase().includes(".zip.oplusdownload") && activeFile.size <= 0
    : false;
  const activeFileIsGame = activeFile ? isReaderGameFile(activeFile) : false;
  const isCodeLikeFile = activeFile
    ? ["js", "jsx", "ts", "tsx", "css", "scss", "xml", "yml", "yaml", "sql", "py", "rb", "go", "rs", "java", "c", "cpp", "h", "sh", "log"].includes(extension)
    : false;
  const activeWorkspaceAssessment = activeFile ? assessWorkspaceFile(activeFile) : null;
  const selectedFiles = useMemo(() => browsableFiles.filter((file) => selectedFileIds.includes(file.id)), [browsableFiles, selectedFileIds]);
  const bridgeAvailable = typeof window !== "undefined" && Boolean(window.PocketFlowReaderBridge);

  const parseJsonPreview = () => {
    try {
      return JSON.parse(displayText);
    } catch {
      return null;
    }
  };

  const dashboardPreview = () => {
    const parsed = parseJsonPreview();
    const dashboard = parsed?.dashboard || parsed;
    if (!dashboard || typeof dashboard !== "object") return null;
    const blocks = Array.isArray(dashboard.blocks) ? dashboard.blocks : [];
    const hasDashboardShape = dashboard.title || dashboard.dashboardTitle || blocks.length > 0 || dashboard.goal;
    if (!hasDashboardShape) return null;
    return {
      title: dashboard.title || dashboard.dashboardTitle || activeFile?.metadata?.dashboardTitle || activeFile?.name || "Dashboard",
      description: dashboard.description || dashboard.goal || "PocketFlow dashboard package",
      blocks: blocks.slice(0, 8),
    };
  };

  const renderFormattedText = (text: string, fullscreen: boolean) => {
    const lines = text.split(/\r?\n/);
    return (
      <article className={`${fullscreen ? "min-h-full max-w-3xl mx-auto" : "min-h-[260px]"} rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] px-4 py-4 text-slate-200 leading-relaxed`}>
        {lines.length === 0 || !text.trim() ? (
          <p className="text-xs text-slate-500">No readable text preview.</p>
        ) : (
          lines.map((line, index) => {
            const clean = line.trim();
            if (!clean) return <div key={index} className="h-3" />;
            if (/^#{1,3}\s+/.test(clean)) {
              return <h2 key={index} className="mt-3 first:mt-0 text-base font-bold text-white">{clean.replace(/^#{1,3}\s+/, "")}</h2>;
            }
            if (/^[-*]\s+/.test(clean)) {
              return <p key={index} className="pl-3 text-xs text-slate-300">• {clean.replace(/^[-*]\s+/, "")}</p>;
            }
            return <p key={index} className="text-xs text-slate-300">{clean}</p>;
          })
        )}
      </article>
    );
  };

  const renderDashboardPreview = (fullscreen: boolean) => {
    const preview = dashboardPreview();
    if (!preview) return null;
    return (
      <div className={`${fullscreen ? "max-w-4xl mx-auto" : ""} rounded-3xl border border-[#22c55e]/35 bg-[#07140f] p-4 space-y-4`}>
        <div className="rounded-2xl border border-[#22c55e]/25 bg-[#102018] p-4">
          <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-[#22c55e]">Dashboard Design Preview</div>
          <h2 className="mt-2 text-xl font-bold text-white leading-tight">{preview.title}</h2>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed">{preview.description}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {preview.blocks.length > 0 ? preview.blocks.map((block: any, index: number) => (
            <section key={block.id || index} className="min-h-[112px] rounded-2xl border border-[#184b3a] bg-[#0b2a20] p-3">
              <div className="text-[9px] font-mono uppercase tracking-widest text-[#22c55e]">{block.type || `Block ${index + 1}`}</div>
              <h3 className="mt-2 text-sm font-bold text-slate-100">{block.title || block.name || `Section ${index + 1}`}</h3>
              <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                {block.metricContent?.description || block.insightContent?.summary || block.headerContent?.subtitle || block.noteContent?.body || "Dashboard element ready for Studio rendering."}
              </p>
            </section>
          )) : (
            <div className="rounded-2xl border border-dashed border-[#184b3a] p-4 text-xs text-slate-400">No block list found in this dashboard package.</div>
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    setMode(initialMode);
    setHtmlFrameKey((key) => key + 1);
    setChecksumResult(null);
  }, [initialMode, activeFile?.id]);

  useEffect(() => {
    if (!isFullscreenReader) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsFullscreenReader(false);
      if (event.key === "ArrowLeft") navigateReaderFile(-1);
      if (event.key === "ArrowRight") navigateReaderFile(1);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreenReader, activeFileIndex, recentFiles.length]);

  useEffect(() => {
    let cancelled = false;
    let nextUrl: string | null = null;

    const loadFile = async () => {
      setTextContent("");
      setBlobUrl(null);
      setPackagePreview(null);
      setZipEntries([]);
      if (!activeFile) return;

      setIsLoadingBlob(true);
      try {
        const blob = await getFileBlobForRecord(activeFile);
        if (cancelled) return;

        if (blob) {
          nextUrl = URL.createObjectURL(blob);
          setBlobUrl(nextUrl);

          const extension = activeFile.extension.toLowerCase();
          const wantsText = isReaderEditableFile(activeFile) || isReaderHtmlFile(activeFile) || activeFile.category === "csv";
          if (wantsText) {
            try {
              const limit = mode === "edit" ? READER_EDIT_TEXT_BYTES : READER_TEXT_PREVIEW_BYTES;
              const truncated = blob.size > limit;
              const source = truncated ? blob.slice(0, limit) : blob;
              const text = await source.text();
              if (cancelled) return;
              setTextContent(truncated
                ? `${text}\n\n--- PocketFlow preview truncated at ${formatBytes(limit)}. Open fullscreen/edit only when needed. ---`
                : text
              );
            } catch {
              setTextContent(activeFile.metadata?.contentPreview || "");
            }
          }

          if (["pptx", "docx", "epub", "pages"].includes(extension)) {
            if (blob.size <= READER_PACKAGE_PREVIEW_BYTES) {
              try {
                setPackagePreview(await extractPackagePreview(blob, activeFile.extension));
              } catch {
                setPackagePreview(null);
              }
            } else {
              setPackagePreview({
                entries: [],
                sections: [{
                  name: "Large document",
                  text: `${activeFile.name}\n\nThis document is ${formatBytes(blob.size)}. PocketFlow skipped deep package extraction to keep Archive responsive on phone.`
                }]
              });
            }
          }

          if (extension === "zip" || activeFile.mimeType.includes("zip")) {
            if (blob.size > READER_ZIP_SCAN_BYTES) {
              setZipEntries([{
                name: activeFile.name,
                path: activeFile.name,
                size: blob.size,
                isDirectory: false,
                preview: `Large ZIP (${formatBytes(blob.size)}). PocketFlow skipped deep entry scanning to keep Archive responsive on phone.`,
                blocked: false,
                warnings: ["Open this ZIP from Archive when you specifically need to inspect entries."],
              }]);
              return;
            }
            try {
              const zip = await JSZip.loadAsync(blob);
              const entries = Object.values(zip.files).slice(0, READER_ZIP_ENTRY_LIMIT);
              const previews: ZipEntryPreview[] = [];
              let textPreviewCount = 0;
              for (const entry of entries) {
                if (cancelled) return;
                const entryData = (entry as JSZip.JSZipObject & { _data?: { uncompressedSize?: number } })._data;
                const entrySize = entryData?.uncompressedSize || 0;
                const entryAssessment = assessArchiveEntryPath(entry.name, entrySize);
                const nameParts = entry.name.split("/").filter(Boolean);
                const leafName = nameParts[nameParts.length - 1] || entry.name;
                const lower = entry.name.toLowerCase();
                const canPreview = textPreviewCount < READER_ZIP_TEXT_PREVIEW_LIMIT
                  && !entry.dir
                  && !entryAssessment.blocked
                  && entrySize <= READER_ZIP_ENTRY_PREVIEW_BYTES
                  && /\.(txt|md|markdown|json|csv|tsv|html|htm|css|js|jsx|ts|tsx|xml|yml|yaml|log)$/i.test(lower);
                let preview = "";
                if (canPreview) {
                  textPreviewCount += 1;
                  try {
                    preview = (await entry.async("text")).slice(0, 900);
                  } catch {
                    preview = "";
                  }
                }
                previews.push({
                  name: leafName,
                  path: entry.name,
                  size: entrySize,
                  isDirectory: entry.dir,
                  preview,
                  blocked: entryAssessment.blocked,
                  warnings: entryAssessment.warnings,
                });
              }
              setZipEntries(previews);
            } catch {
              setZipEntries([]);
            }
          }
        } else {
          setTextContent(activeFile.metadata?.contentPreview || "");
          setBlobUrl(activeFile.objectUrl || null);
        }
      } finally {
        if (!cancelled) setIsLoadingBlob(false);
      }
    };

    loadFile();
    return () => {
      cancelled = true;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [activeFile, mode]);

  const handleUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []) as File[];
    if (!selected.length) return;
    selected.forEach((file) => onUploadFile(file));
    event.target.value = "";
    onNotify(`Opened ${selected.length} file${selected.length === 1 ? "" : "s"} in Reader.`, "success");
  };

  const handleFolderUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []) as File[];
    if (!selected.length) return;
    selected.forEach((file) => onUploadFile(file));
    const firstPath = (selected[0] as File & { webkitRelativePath?: string }).webkitRelativePath || selected[0].name;
    const root = firstPath.split("/").filter(Boolean)[0];
    if (root) setBrowserFolder(`/${root}`);
    setMode("archive");
    event.target.value = "";
    onNotify(`Opened folder with ${selected.length} file${selected.length === 1 ? "" : "s"}.`, "success");
  };

  const fileFromZipEntry = (path: string, blob: Blob) => {
    const name = path.split("/").filter(Boolean).pop() || "zip-entry.bin";
    const file = new File([blob], name, { type: blob.type || "application/octet-stream" });
    Object.defineProperty(file, "relativePath", {
      value: `${activeFile?.safeName || activeFile?.name || "zip"}/${path}`.replace(/^\/+/, ""),
      configurable: true,
    });
    return file;
  };

  const importZipEntry = async (path: string) => {
    if (!activeFile || !activeFileIsZip) return;
    const blob = await getFileBlobForRecord(activeFile);
    if (!blob) {
      onNotify("ZIP blob is not available in storage yet.", "warn");
      return;
    }
    setIsZipWorking(true);
    try {
      const entryAssessment = assessArchiveEntryPath(path);
      if (entryAssessment.blocked) {
        onNotify("Blocked unsafe ZIP path. Reader will not extract path traversal entries.", "warn");
        return;
      }
      const zip = await JSZip.loadAsync(blob);
      const entry = zip.file(path);
      if (!entry) {
        onNotify("ZIP entry could not be opened.", "warn");
        return;
      }
      const entryBlob = await entry.async("blob");
      onUploadFile(fileFromZipEntry(path, entryBlob));
      onNotify(`Opened ${path.split("/").pop() || "ZIP entry"} from ZIP.`, "success");
    } catch {
      onNotify("ZIP entry could not be extracted.", "warn");
    } finally {
      setIsZipWorking(false);
    }
  };

  const importZipEntries = async () => {
    if (!activeFile || !activeFileIsZip) return;
    const blob = await getFileBlobForRecord(activeFile);
    if (!blob) {
      onNotify("ZIP blob is not available in storage yet.", "warn");
      return;
    }
    setIsZipWorking(true);
    try {
      const zip = await JSZip.loadAsync(blob);
      const entries = Object.values(zip.files)
        .filter((entry) => !entry.dir && !assessArchiveEntryPath(entry.name).blocked)
        .slice(0, 180);
      for (const entry of entries) {
        const entryBlob = await entry.async("blob");
        onUploadFile(fileFromZipEntry(entry.name, entryBlob));
      }
      setMode("archive");
      onNotify(`Imported ${entries.length} ZIP entr${entries.length === 1 ? "y" : "ies"} into Reader.`, "success");
    } catch {
      onNotify("ZIP could not be extracted.", "warn");
    } finally {
      setIsZipWorking(false);
    }
  };

  const selectedOrCurrentFolderFiles = () => {
    if (selectedFiles.length > 0) return selectedFiles;
    const current = browserFolder === "/" ? "" : browserFolder.replace(/^\/+|\/+$/g, "");
    return browsableFiles.filter((file) => {
      const path = filePathForBrowser(file);
      return current ? path === current || path.startsWith(`${current}/`) : true;
    });
  };

  const notifyBridgeRequired = (action: string) => {
    onNotify(`${action} needs the Android Reader Bridge. Browser mode keeps this as a safe local copy only.`, "info");
  };

  const toggleSelectedFile = (fileId: string) => {
    setSelectedFileIds((current) => current.includes(fileId) ? current.filter((id) => id !== fileId) : [...current, fileId]);
  };

  const generateActiveChecksum = async () => {
    if (!activeFile) return;
    const blob = await getFileBlobForRecord(activeFile);
    if (!blob) {
      onNotify("File blob is not available for checksum yet.", "warn");
      return;
    }
    try {
      setChecksumResult(await checksumBlobSha256(blob));
      onNotify("SHA-256 checksum generated locally.", "success");
    } catch {
      onNotify("Checksum needs secure browser crypto support.", "warn");
    }
  };

  const handleOpenExternal = () => {
    if (!activeFile?.nativeUri || !window.PocketFlowReaderBridge?.openExternal) {
      notifyBridgeRequired("Open external");
      return;
    }
    window.PocketFlowReaderBridge.openExternal(activeFile.nativeUri);
  };

  const compressCurrentFolder = async () => {
    const current = browserFolder === "/" ? "" : browserFolder.replace(/^\/+|\/+$/g, "");
    const folderFiles = selectedOrCurrentFolderFiles();
    if (!folderFiles.length) {
      onNotify("No files in this folder to compress.", "warn");
      return;
    }
    setIsZipWorking(true);
    try {
      const zip = new JSZip();
      for (const file of folderFiles) {
        const blob = await getFileBlobForRecord(file);
        const path = filePathForBrowser(file);
        if (blob) {
          zip.file(path, blob);
        } else if (file.metadata?.contentPreview) {
          zip.file(path, String(file.metadata.contentPreview));
        }
      }
      if (includeManifest) {
        zip.file("pocketflow-manifest.json", JSON.stringify({
          createdAt: new Date().toISOString(),
          source: "PocketFlow Reader",
          encrypted: false,
          note: "Browser ZIP export. Password-protected AES ZIP requires the Android/native bridge.",
          files: folderFiles.map((file) => ({
            name: file.name,
            path: filePathForBrowser(file),
            size: file.size,
            category: file.category,
            riskLevel: assessWorkspaceFile(file).riskLevel
          }))
        }, null, 2));
      }
      const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: compressionLevel } });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${(selectedFiles.length ? "reader-selection" : current || "reader-folder").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "reader-folder"}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      onNotify(`Compressed ${folderFiles.length} file${folderFiles.length === 1 ? "" : "s"} into normal ZIP copy.`, "success");
    } catch {
      onNotify("Could not create ZIP from this folder.", "warn");
    } finally {
      setIsZipWorking(false);
    }
  };

  const handleSave = async () => {
    if (!activeFile || !isEditable) return;
    await onSaveTextEdit(activeFile, textContent);
    onNotify("Reader edit saved.", "success");
  };

  const navigateReaderFile = (direction: -1 | 1) => {
    if (recentFiles.length === 0) return;
    const baseIndex = activeFileIndex >= 0 ? activeFileIndex : 0;
    const nextIndex = (baseIndex + direction + recentFiles.length) % recentFiles.length;
    onSelectFile(recentFiles[nextIndex]);
  };

  const renderPreview = (fullscreen = false) => {
    if (!activeFile) {
      return (
        <div className={`${fullscreen ? "min-h-full" : "h-full min-h-[260px]"} grid place-items-center rounded-2xl border border-dashed border-[#2a2c32] bg-[#0c0c0d]`}>
          <div className="text-center">
            <BookOpen className="w-10 h-10 mx-auto text-slate-600 mb-3" />
            <div className="text-xs font-mono font-bold uppercase tracking-widest text-slate-300">No File Open</div>
          </div>
        </div>
      );
    }

    if (isLoadingBlob) {
      return <div className="text-xs font-mono text-slate-500 p-4">Loading file...</div>;
    }

    if (isBlockedBySecurity) {
      return (
        <div className={`${fullscreen ? "min-h-full" : "min-h-[260px]"} rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-100`}>
          <ShieldAlert className="w-8 h-8 text-red-300 mb-3" />
          <div className="text-sm font-mono font-black uppercase tracking-widest">Blocked by Archive Guard</div>
          <p className="mt-3 text-xs leading-6 text-red-100/80">
            This file is blocked from normal preview. Override it from Archive only if you own the file and understand the risk.
          </p>
          {security?.reasons?.length ? (
            <ul className="mt-3 space-y-1 text-[11px] leading-5 text-red-100/75">
              {security.reasons.slice(0, 4).map((reason, index) => <li key={index}>- {reason}</li>)}
            </ul>
          ) : null}
        </div>
      );
    }

    if (isReaderImageFile(activeFile) && blobUrl) {
      return (
        <div className={`${fullscreen ? "min-h-full" : "h-full min-h-[260px]"} rounded-2xl border border-[#2a2c32] bg-[#050607] grid place-items-center overflow-auto p-3`}>
          <img src={blobUrl} alt={activeFile.name} className={`${fullscreen ? "max-w-full" : "max-h-full max-w-full"} object-contain rounded-xl shadow-2xl`} />
        </div>
      );
    }

    if (isReaderPdfFile(activeFile) && blobUrl) {
      return (
        <div className={`${fullscreen ? "h-[calc(100vh-112px)] min-h-[720px]" : "h-[560px] min-h-[420px]"} rounded-2xl border border-[#2a2c32] bg-[#111] overflow-hidden`}>
          <iframe
            src={`${blobUrl}#toolbar=1&navpanes=0&view=FitH`}
            title={activeFile.name}
            className="h-full w-full bg-white"
          />
        </div>
      );
    }

    if (isReaderHtmlFile(activeFile)) {
      const htmlSource = displayText || "<main style='font-family:monospace;padding:24px'>No HTML source available.</main>";
      return (
        <div className={`rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] overflow-hidden ${fullscreen ? "h-[calc(100vh-132px)] min-h-[720px]" : "h-[560px] min-h-[420px]"}`}>
          <div className="h-10 px-2 border-b border-[#2a2c32] bg-[#101114] flex items-center justify-between gap-2">
            <div className="min-w-0 text-[9px] font-mono uppercase tracking-widest text-[#22c55e] truncate">
              Interactive HTML Dashboard
            </div>
            <div className="shrink-0 flex items-center gap-1.5">
              <button
                onClick={() => setHtmlFrameKey((key) => key + 1)}
                title="Reload HTML preview"
                className="h-8 w-8 rounded-lg border border-[#2a2c32] bg-[#0c0c0d] text-slate-400 grid place-items-center"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              {blobUrl && (
                <a
                  href={blobUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Open HTML in browser tab"
                  className="h-8 w-8 rounded-lg border border-[#2a2c32] bg-[#0c0c0d] text-slate-400 grid place-items-center"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
            <iframe
              key={`${activeFile.id}-${htmlFrameKey}`}
              title={activeFile.name}
              sandbox="allow-same-origin allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads allow-top-navigation-by-user-activation"
              src={blobUrl || undefined}
              srcDoc={blobUrl ? undefined : htmlSource}
              className="h-[calc(100%-40px)] w-full bg-white"
            />
        </div>
      );
    }

    const dashboard = renderDashboardPreview(fullscreen);
    if (dashboard) return dashboard;

    if (activeFileIsIncompleteZipDownload) {
      return (
        <div className={`${fullscreen ? "max-w-4xl mx-auto" : ""} rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 space-y-3`}>
          <div className="text-[9px] font-mono font-black uppercase tracking-[0.22em] text-amber-200">Incomplete ZIP download</div>
          <h2 className="text-lg font-bold text-white">{activeFile.name}</h2>
          <p className="text-[11px] leading-5 text-amber-50/85">
            Reader can see the file record, but Android saved it as a 0-byte <span className="font-mono">.oplusdownload</span> placeholder. There is no ZIP content to open yet.
          </p>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-[10px] leading-5 text-slate-300">
            Finish or repeat the download until the file has a real size and ends as <span className="font-mono">.zip</span>. PocketFlow will keep it archived until the paused game system is restored.
          </div>
        </div>
      );
    }

    if (activeFileIsGame) {
      const gameSystem = activeFile.extension.toLowerCase() === "nds"
        ? "Nintendo DS"
        : ["gb", "gbc", "gba"].includes(activeFile.extension.toLowerCase())
          ? "Game Boy / Game Boy Advance"
          : "PSP";
      return (
        <div className={`${fullscreen ? "max-w-4xl mx-auto" : ""} rounded-2xl border border-cyan-200/25 bg-cyan-200/10 p-4 space-y-3`}>
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-200/30 bg-cyan-200/10 text-cyan-100">
              <Gamepad2 className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="text-[9px] font-mono font-black uppercase tracking-[0.22em] text-cyan-200">Archived game file</div>
              <h2 className="mt-1 truncate text-lg font-bold text-white">{activeFile.name}</h2>
              <p className="mt-1 text-[11px] leading-5 text-slate-300">
                Reader can store and inspect this game file. The game player is paused for now, so this file remains in the archive until we restore that system.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="font-mono uppercase tracking-wider text-slate-500">System</div>
              <div className="mt-1 font-black text-cyan-100">{gameSystem}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="font-mono uppercase tracking-wider text-slate-500">Size</div>
              <div className="mt-1 font-black text-cyan-100">{formatBytes(activeFile.size)}</div>
            </div>
            <div className="col-span-2 rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="font-mono uppercase tracking-wider text-slate-500">Archive path</div>
              <div className="mt-1 break-words font-mono text-slate-300">{filePathForBrowser(activeFile)}</div>
            </div>
          </div>
        </div>
      );
    }

    if (activeFileIsZip) {
      return (
        <div className={`${fullscreen ? "max-w-4xl mx-auto" : ""} rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] p-4 space-y-3`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[9px] font-mono font-black uppercase tracking-[0.22em] text-amber-300">ZIP Archive</div>
              <h2 className="mt-1 truncate text-lg font-bold text-white">{activeFile.name}</h2>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                {zipEntries.length ? `${zipEntries.length} entries ready. Open single files or import the ZIP into Reader.` : "Reading ZIP entries..."}
              </p>
            </div>
            <button
              onClick={() => setMode("archive")}
              className="shrink-0 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-[9px] font-mono font-black uppercase tracking-wider text-amber-200"
            >
              browse
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={importZipEntries}
              disabled={isZipWorking || !zipEntries.some((entry) => !entry.isDirectory && !entry.blocked)}
              className="h-11 rounded-xl bg-[#22c55e] text-black text-[9px] font-mono font-black uppercase tracking-wider disabled:bg-slate-800 disabled:text-slate-600"
            >
              {isZipWorking ? "working" : "unzip all"}
            </button>
            <button
              onClick={() => setMode("archive")}
              className="h-11 rounded-xl border border-[#2a2c32] bg-[#151619] text-slate-300 text-[9px] font-mono font-black uppercase tracking-wider"
            >
              open entries
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {zipEntries.slice(0, 8).map((entry) => (
              <div key={`preview-${entry.path}`} className="rounded-xl border border-[#2a2c32] bg-[#151619] px-3 py-2">
                <div className="truncate text-[10px] font-mono text-slate-300">{entry.path}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (isPackagedPreviewFile) {
      const extension = activeFile.extension.toUpperCase();
      const sections = packagePreview?.sections || [];
      const packageKind = activeFile.extension === "pptx"
        ? "slides"
        : activeFile.extension === "epub"
          ? "book"
          : activeFile.extension === "docx"
            ? "document"
            : "package";
      return (
        <div className="space-y-3">
          <div className={`rounded-2xl border border-[#2a2c32] ${packageKind === "book" ? "bg-[#17140d]" : "bg-[#0c0c0d]"} p-4`}>
            <div className="flex items-start justify-between gap-3 border-b border-[#2a2c32] pb-3">
              <div className="min-w-0">
                <div className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                  {extension} {packageKind === "slides" ? "slide deck" : packageKind === "book" ? "book reader" : "page preview"}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  {sections.length > 0
                    ? `${sections.length} readable ${activeFile.extension === "pptx" ? "slides" : "sections"} extracted`
                    : "Package opened, but no readable XML text was found yet."}
                </div>
              </div>
              <span className="shrink-0 text-[9px] font-mono uppercase text-slate-500">
                {packagePreview?.entries.length || 0} entries
              </span>
            </div>

            {sections.length > 0 ? (
              <div className={`mt-3 space-y-3 ${fullscreen ? "" : "max-h-[520px] overflow-auto pr-1"}`}>
                {sections.map((section, index) => (
                  <section
                    key={`${section.name}-${index}`}
                    className={`rounded-xl border p-4 ${
                      packageKind === "slides"
                        ? "aspect-video bg-white text-black border-slate-300 shadow-xl"
                        : packageKind === "book"
                          ? "bg-[#f4ead6] text-[#21170f] border-amber-900/20 shadow-xl"
                          : "bg-[#f7f7f2] text-[#151515] border-slate-300 shadow-xl"
                    }`}
                  >
                    <div className={`text-[10px] font-mono font-bold uppercase tracking-widest mb-2 ${packageKind === "slides" ? "text-sky-700" : "text-amber-700"}`}>
                      {activeFile.extension === "pptx" ? `Slide ${index + 1}` : section.name}
                    </div>
                    <pre className={`whitespace-pre-wrap leading-relaxed ${packageKind === "slides" ? "text-[15px] font-bold" : "text-[13px] font-serif"}`}>
                      {section.text}
                    </pre>
                  </section>
                ))}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-[#2a2c32] p-4 text-[11px] text-slate-500 font-mono">
                {isLoadingBlob ? "Extracting package preview..." : `${activeFile.name}\nNo readable preview extracted yet.`}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (isReaderSpreadsheetFile(activeFile)) {
      const rows = (displayText || "Column A,Column B,Column C\nNo preview,Open editor,Ready")
        .split(/\r?\n/)
        .slice(0, fullscreen ? 80 : 8)
        .map((row) => row.split(activeFile.extension === "tsv" ? "\t" : ","));
      return (
        <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] overflow-auto">
          <table className="w-full text-left text-[10px] font-mono">
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b border-[#2a2c32] last:border-0">
                  {row.slice(0, 6).map((cell, cellIndex) => (
                    <td key={cellIndex} className={`px-3 py-2 ${rowIndex === 0 ? "text-amber-400 font-bold" : "text-slate-300"}`}>
                      {cell.trim() || "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (["json"].includes(extension)) {
      const parsed = parseJsonPreview();
      if (parsed) {
        const entries = Object.entries(parsed).slice(0, 40);
        return (
          <div className={`${fullscreen ? "max-w-4xl mx-auto" : ""} rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] p-4 space-y-3`}>
            <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-[#22c55e]">Structured JSON Preview</div>
            <div className="space-y-2">
              {entries.map(([key, value]) => (
                <div key={key} className="rounded-xl border border-[#2a2c32] bg-[#151619] p-3">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-amber-400">{key}</div>
                  <div className="mt-1 text-xs text-slate-300 break-words">
                    {typeof value === "object" ? JSON.stringify(value).slice(0, 240) : String(value)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      }
    }

    if (!isCodeLikeFile && displayText) {
      return renderFormattedText(displayText, fullscreen);
    }

    return (
      <pre className={`${fullscreen ? "min-h-full text-[12px]" : "h-full min-h-[260px] text-[11px]"} overflow-auto rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] p-4 text-slate-300 whitespace-pre-wrap leading-relaxed`}>
        {displayText || `${activeFile.name}\nNo readable preview extracted yet.`}
      </pre>
    );
  };

  const renderWorkspaceHome = () => {
    const riskFiles = browsableFiles.filter((file) => assessWorkspaceFile(file).riskLevel !== "safe");
    const archiveFiles = browsableFiles.filter((file) => isReaderArchiveFile(file));
    const activeWarnings = activeWorkspaceAssessment?.warnings || [];
    return (
      <div className="space-y-3">
        <section className="rounded-3xl border border-[#2a2c32] bg-[#0c0c0d] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[9px] font-mono font-black uppercase tracking-[0.24em] text-[#22c55e]">File Workspace</div>
              <h2 className="mt-2 text-xl font-black text-white leading-tight">Reader, archive guard, and local file desk</h2>
              <p className="mt-2 text-[11px] leading-5 text-slate-400">
                Phone-first file workspace for folders, previews, checksums, normal ZIP copies, and safe archive inspection.
              </p>
            </div>
            <span className={`shrink-0 rounded-full border px-3 py-1 text-[8px] font-mono font-black uppercase tracking-wider ${
              bridgeAvailable ? "border-[#22c55e]/35 bg-[#22c55e]/10 text-[#22c55e]" : "border-amber-300/25 bg-amber-300/10 text-amber-200"
            }`}>
              {bridgeAvailable ? "bridge live" : "browser safe"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              onClick={() => inputRef.current?.click()}
              className="rounded-2xl border border-[#22c55e]/25 bg-[#22c55e]/10 p-3 text-left"
            >
              <Upload className="w-4 h-4 text-[#22c55e]" />
              <div className="mt-2 text-[9px] font-mono font-black uppercase text-[#22c55e]">Open Files</div>
              <div className="mt-1 text-[9px] text-slate-500">local picker</div>
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="rounded-2xl border border-[#2a2c32] bg-[#151619] p-3 text-left"
            >
              <FolderOpen className="w-4 h-4 text-slate-300" />
              <div className="mt-2 text-[9px] font-mono font-black uppercase text-slate-200">Open Folder</div>
              <div className="mt-1 text-[9px] text-slate-500">nested browse</div>
            </button>
            <button
              onClick={() => window.PocketFlowReaderBridge?.openFolder ? window.PocketFlowReaderBridge.openFolder() : notifyBridgeRequired("SSD / Android folder access")}
              className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-3 text-left"
            >
              <Archive className="w-4 h-4 text-amber-200" />
              <div className="mt-2 text-[9px] font-mono font-black uppercase text-amber-200">SSD Vault</div>
              <div className="mt-1 text-[9px] text-slate-500">bridge required</div>
            </button>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-[#2a2c32] bg-[#151619] p-3">
            <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Loaded files</div>
            <div className="mt-1 text-2xl font-black text-white">{browsableFiles.length}</div>
          </div>
          <div className="rounded-2xl border border-[#2a2c32] bg-[#151619] p-3">
            <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Archives</div>
            <div className="mt-1 text-2xl font-black text-white">{archiveFiles.length}</div>
          </div>
          <div className="rounded-2xl border border-[#2a2c32] bg-[#151619] p-3">
            <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Selected</div>
            <div className="mt-1 text-2xl font-black text-white">{selectedFiles.length}</div>
          </div>
          <div className={`rounded-2xl border p-3 ${riskFiles.length ? "border-amber-300/25 bg-amber-300/10" : "border-[#2a2c32] bg-[#151619]"}`}>
            <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Warnings</div>
            <div className={`mt-1 text-2xl font-black ${riskFiles.length ? "text-amber-200" : "text-white"}`}>{riskFiles.length}</div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[9px] font-mono font-black uppercase tracking-[0.22em] text-slate-300">Batch Actions</div>
              <div className="mt-1 text-[10px] text-slate-500">
                {selectedFiles.length ? `${selectedFiles.length} selected` : "Select files below, or actions use the current folder."}
              </div>
            </div>
            <button
              onClick={() => setSelectedFileIds([])}
              disabled={!selectedFileIds.length}
              className="rounded-xl border border-[#2a2c32] bg-[#151619] px-3 py-2 text-[9px] font-mono font-black uppercase tracking-wider text-slate-400 disabled:opacity-40"
            >
              clear
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={compressCurrentFolder}
              disabled={isZipWorking || (!selectedFiles.length && !browsableFiles.length)}
              className="rounded-xl bg-[#22c55e] px-3 py-3 text-[9px] font-mono font-black uppercase tracking-wider text-black disabled:bg-slate-800 disabled:text-slate-600"
            >
              {isZipWorking ? "working" : selectedFiles.length ? "zip selected" : "zip folder"}
            </button>
            <button
              onClick={() => notifyBridgeRequired("Encrypted ZIP")}
              className="rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-3 text-[9px] font-mono font-black uppercase tracking-wider text-amber-200"
            >
              encrypted zip
            </button>
            <button
              onClick={() => notifyBridgeRequired("Move/copy/delete")}
              className="rounded-xl border border-[#2a2c32] bg-[#151619] px-3 py-3 text-[9px] font-mono font-black uppercase tracking-wider text-slate-300"
            >
              move / copy
            </button>
            <button
              onClick={() => notifyBridgeRequired("Share/open external")}
              className="rounded-xl border border-[#2a2c32] bg-[#151619] px-3 py-3 text-[9px] font-mono font-black uppercase tracking-wider text-slate-300"
            >
              share / open
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="rounded-xl border border-[#2a2c32] bg-[#151619] px-3 py-2">
              <div className="text-[8px] font-mono uppercase tracking-widest text-slate-600">Compression</div>
              <input
                type="range"
                min="1"
                max="9"
                value={compressionLevel}
                onChange={(event) => setCompressionLevel(Number(event.target.value))}
                className="mt-2 w-full"
              />
              <div className="text-[9px] text-slate-400">Level {compressionLevel}</div>
            </label>
            <label className="rounded-xl border border-[#2a2c32] bg-[#151619] px-3 py-2 flex items-center gap-3">
              <input
                type="checkbox"
                checked={includeManifest}
                onChange={(event) => setIncludeManifest(event.target.checked)}
              />
              <span className="text-[9px] font-mono uppercase tracking-wider text-slate-300">include manifest</span>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="rounded-xl border border-[#2a2c32] bg-[#151619] px-3 py-2">
              <div className="text-[8px] font-mono uppercase tracking-widest text-slate-600">Filter</div>
              <select
                value={workspaceFilter}
                onChange={(event) => setWorkspaceFilter(event.target.value as WorkspaceFilter)}
                className="mt-1 w-full bg-transparent text-[10px] text-slate-200 outline-none"
              >
                <option value="all">All</option>
                <option value="archives">Archives</option>
                <option value="media">Media</option>
                <option value="docs">Docs</option>
                <option value="code">Code</option>
                <option value="risks">Risks</option>
              </select>
            </label>
            <label className="rounded-xl border border-[#2a2c32] bg-[#151619] px-3 py-2">
              <div className="text-[8px] font-mono uppercase tracking-widest text-slate-600">Sort</div>
              <select
                value={workspaceSort}
                onChange={(event) => setWorkspaceSort(event.target.value as WorkspaceSort)}
                className="mt-1 w-full bg-transparent text-[10px] text-slate-200 outline-none"
              >
                <option value="name">Name</option>
                <option value="date">Newest</option>
                <option value="size">Size</option>
                <option value="kind">Kind</option>
              </select>
            </label>
          </div>

          <div className="space-y-2 max-h-72 overflow-auto pr-1">
            {visibleBrowserFiles.map((file) => {
              const assessment = assessWorkspaceFile(file);
              const selected = selectedFileIds.includes(file.id);
              const tracker = file.metadata?.tracker as { code?: string; label?: string; color?: string } | undefined;
              return (
                <div key={`workspace-${file.id}`} className={`rounded-xl border px-3 py-2 ${selected ? "border-[#22c55e]/35 bg-[#22c55e]/10" : "border-[#2a2c32] bg-[#151619]"}`}>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelectedFile(file.id)}
                      className="shrink-0"
                      aria-label={`Select ${file.name}`}
                    />
                    <button onClick={() => onSelectFile(file)} className="min-w-0 flex-1 text-left">
                      <div className="truncate text-[10px] font-mono font-bold text-slate-200">{file.name}</div>
                      <div className="truncate text-[8px] font-mono uppercase tracking-wider text-slate-600">
                        {assessment.kind} · {formatBytes(file.size)} · {filePathForBrowser(file)}
                      </div>
                    </button>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-[7px] font-mono font-black uppercase ${
                      assessment.riskLevel === "danger" ? "bg-red-500/15 text-red-200" :
                      assessment.riskLevel === "warning" ? "bg-amber-300/15 text-amber-200" :
                      assessment.riskLevel === "notice" ? "bg-sky-300/15 text-sky-200" :
                      "bg-[#22c55e]/10 text-[#22c55e]"
                    }`}>
                      {assessment.riskLevel}
                    </span>
                    {tracker?.code ? (
                      <span
                        className="shrink-0 rounded-full px-2 py-1 text-[7px] font-mono font-black uppercase text-white"
                        style={{ backgroundColor: tracker.color || "#334155" }}
                        title={tracker.label || tracker.code}
                      >
                        {tracker.code}
                      </span>
                    ) : null}
                  </div>
                  {assessment.warnings.length ? (
                    <div className="mt-2 text-[9px] leading-4 text-amber-100/75">
                      {assessment.warnings[0]}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!visibleBrowserFiles.length ? (
              <div className="rounded-xl border border-dashed border-[#2a2c32] p-3 text-[10px] text-slate-600">
                No files match this workspace view.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] p-3">
          <div className="text-[9px] font-mono font-black uppercase tracking-[0.22em] text-amber-300">Capability Map</div>
          <p className="mt-2 text-[11px] leading-5 text-slate-400">{archiveCapabilityLabel(activeFile)}</p>
          {activeWarnings.length ? (
            <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-[10px] leading-5 text-amber-100/80">
              {activeWarnings.map((warning, index) => <div key={index}>- {warning}</div>)}
            </div>
          ) : null}
        </section>
      </div>
    );
  };

  const renderArchiveExplorer = () => {
    return (
      <div className="space-y-3">
        <section className="rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[9px] font-mono font-black uppercase tracking-[0.22em] text-[#22c55e]">Folder Browser</div>
              <div className="mt-1 text-[10px] font-mono text-slate-500 truncate">{browserFolder}</div>
            </div>
            <button
              onClick={compressCurrentFolder}
              disabled={isZipWorking || !browsableFiles.length}
              className="shrink-0 rounded-xl border border-[#22c55e]/25 bg-[#22c55e]/10 px-3 py-2 text-[9px] font-mono font-black uppercase tracking-wider text-[#22c55e] disabled:opacity-40"
            >
              {isZipWorking ? "working" : "zip folder"}
            </button>
          </div>

          <label className="mt-3 flex h-10 items-center gap-2 rounded-xl border border-[#2a2c32] bg-[#151619] px-3">
            <Search className="h-4 w-4 shrink-0 text-slate-500" />
            <input
              value={fileSearch}
              onChange={(event) => setFileSearch(event.target.value)}
              placeholder="Find file..."
              className="min-w-0 flex-1 bg-transparent text-xs text-slate-200 outline-none placeholder:text-slate-600"
            />
          </label>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {visibleFolderChips.map((folder) => (
              <button
                key={folder}
                onClick={() => {
                  setBrowserFolder(folder);
                  setFileSearch("");
                }}
                className={`shrink-0 rounded-xl border px-3 py-2 text-[9px] font-mono font-black uppercase tracking-wider ${
                  browserFolder === folder
                    ? "border-[#22c55e]/45 bg-[#22c55e]/15 text-[#22c55e]"
                    : "border-[#2a2c32] bg-[#151619] text-slate-500"
                }`}
              >
                {folder === "/" ? "root" : folder.split("/").filter(Boolean).pop()}
              </button>
            ))}
          </div>

          <div className="mt-3 max-h-72 overflow-y-auto space-y-2 pr-1">
            {!fileSearch && childFolders.map((folder) => (
              <button
                key={`folder-${folder}`}
                onClick={() => setBrowserFolder(folder)}
                className="flex w-full items-center gap-3 rounded-xl border border-[#2a2c32] bg-[#151619] px-3 py-2 text-left"
              >
                <FolderOpen className="h-4 w-4 shrink-0 text-[#22c55e]" />
                <div className="min-w-0">
                  <div className="truncate text-[10px] font-mono font-black uppercase tracking-wider text-slate-200">
                    {folder.split("/").filter(Boolean).pop()}
                  </div>
                  <div className="text-[8px] font-mono uppercase tracking-wider text-slate-600">folder</div>
                </div>
              </button>
            ))}
            {visibleBrowserFiles.map((file) => (
              <button
                key={file.id}
                onClick={() => onSelectFile(file)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${
                  activeFile?.id === file.id
                    ? "border-[#22c55e]/35 bg-[#22c55e]/10"
                    : "border-[#2a2c32] bg-[#151619]"
                }`}
              >
                <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[10px] font-mono font-bold text-slate-200">{file.name}</div>
                  <div className="truncate text-[8px] font-mono uppercase tracking-wider text-slate-600">
                    {filePathForBrowser(file)} · {formatBytes(file.size)}
                  </div>
                </div>
                {(() => {
                  const tracker = file.metadata?.tracker as { code?: string; color?: string } | undefined;
                  return tracker?.code ? (
                    <span className="shrink-0 rounded-full px-2 py-1 text-[7px] font-mono font-black text-white" style={{ backgroundColor: tracker.color || "#334155" }}>
                      {tracker.code}
                    </span>
                  ) : null;
                })()}
                <span className="shrink-0 text-[8px] font-mono uppercase text-slate-600">{file.extension || file.category}</span>
              </button>
            ))}
            {!childFolders.length && !visibleBrowserFiles.length ? (
              <div className="rounded-xl border border-dashed border-[#2a2c32] p-3 text-[10px] text-slate-600">
                No files found here.
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[9px] font-mono font-black uppercase tracking-[0.22em] text-amber-300">ZIP Contents</div>
              <div className="mt-1 text-[10px] text-slate-500">
                {activeFileIsZip ? `${zipEntries.length} entries inside ${activeFile?.name}` : "Open a ZIP file to inspect entries."}
              </div>
            </div>
            {activeFileIsZip ? (
              <button
                onClick={importZipEntries}
                disabled={isZipWorking || !zipEntries.some((entry) => !entry.isDirectory && !entry.blocked)}
                className="shrink-0 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-[9px] font-mono font-black uppercase tracking-wider text-amber-200 disabled:opacity-40"
              >
                unzip all
              </button>
            ) : null}
          </div>

          {activeFileIsZip && zipEntries.length ? (
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {zipEntries.map((entry) => (
                <div key={entry.path} className={`rounded-xl border px-3 py-2 ${entry.blocked ? "border-red-500/25 bg-red-500/10" : "border-[#2a2c32] bg-[#151619]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[10px] font-mono font-bold text-slate-200">{entry.path}</div>
                      <div className="mt-0.5 text-[8px] font-mono uppercase tracking-wider text-slate-600">
                        {entry.blocked ? "blocked path" : entry.isDirectory ? "folder" : `${formatBytes(entry.size)} · zip entry`}
                      </div>
                    </div>
                    {!entry.isDirectory ? (
                      <button
                        onClick={() => importZipEntry(entry.path)}
                        disabled={isZipWorking || entry.blocked}
                        className="shrink-0 rounded-lg border border-[#22c55e]/25 bg-[#22c55e]/10 px-2 py-1.5 text-[8px] font-mono font-black uppercase tracking-wider text-[#22c55e] disabled:opacity-40"
                      >
                        open
                      </button>
                    ) : null}
                  </div>
                  {entry.preview ? (
                    <pre className="mt-2 max-h-24 overflow-hidden whitespace-pre-wrap rounded-lg border border-[#2a2c32] bg-[#0c0c0d] p-2 text-[9px] leading-relaxed text-slate-400">
                      {entry.preview}
                    </pre>
                  ) : null}
                  {entry.warnings?.length ? (
                    <div className="mt-2 text-[9px] leading-4 text-amber-100/75">
                      {entry.warnings.map((warning, index) => <div key={index}>- {warning}</div>)}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#2a2c32] p-3 text-[10px] text-slate-600">
              ZIP packages can be inspected here, opened entry by entry, or imported all at once.
            </div>
          )}
        </section>
      </div>
    );
  };

  const renderFullscreenContent = () => {
    if (mode === "edit") {
      return (
        <div className="h-full min-h-0 flex flex-col gap-3">
          <textarea
            value={textContent}
            onChange={(event) => setTextContent(event.target.value)}
            disabled={!activeFile || !isEditable}
            spellCheck={false}
            className="flex-1 min-h-[560px] rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] p-4 text-[12px] text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-[#22c55e]/40 disabled:text-slate-600"
          />
          <button
            onClick={handleSave}
            disabled={!activeFile || !isEditable}
            className="shrink-0 h-12 rounded-2xl bg-[#22c55e] disabled:bg-slate-800 disabled:text-slate-600 text-black text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Edit
          </button>
        </div>
      );
    }

    if (mode === "workspace") return renderWorkspaceHome();

    if (mode === "metadata") {
      return (
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] p-4 space-y-2">
            {(activeFile
              ? [
                  ["Name", activeFile.name],
                  ["MIME", activeFile.mimeType || "unknown"],
                  ["Extension", activeFile.extension || "none"],
                  ["Category", activeFile.category],
                  ["Status", activeFile.status],
                  ["Folder", activeFile.folderPath || "/"],
                  ["Workspace Kind", activeWorkspaceAssessment?.kind || "file"],
                  ["Workspace Risk", activeWorkspaceAssessment?.riskLevel || "safe"],
                  ["Source", activeFile.source],
                  ["Received", new Date(activeFile.receivedAt).toLocaleString()],
                  ["SHA-256", checksumResult || "not generated"]
                ]
              : [["Reader", "No active file"]]
            ).map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-3 border-b border-[#18191d] last:border-0 pb-3 last:pb-0">
                <span className="text-[9px] font-mono uppercase tracking-widest text-slate-600">{label}</span>
                <span className="text-xs text-slate-300 text-right break-all">{value}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (mode === "archive") return renderArchiveExplorer();

    return renderPreview(true);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden animate-fade-in bg-[#070809]">
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-[#18191d] bg-[#101114]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#22c55e]" />
              Reader
            </h1>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest truncate">
              {activeFile ? activeFile.name : "Universal file workspace"}
            </p>
          </div>
          <button
            onClick={() => setIsFullscreenReader(true)}
            disabled={!activeFile}
            title="Full screen reader"
            className="shrink-0 h-10 w-10 rounded-xl border border-[#2a2c32] bg-[#0c0c0d] text-slate-400 disabled:text-slate-700 disabled:border-[#18191d] grid place-items-center"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            className="shrink-0 h-10 px-3 rounded-xl bg-[#22c55e] text-black text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Files
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            className="shrink-0 h-10 px-3 rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/10 text-[#22c55e] text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-2"
          >
            <FolderOpen className="w-4 h-4" />
            Folder
          </button>
          <input ref={inputRef} type="file" multiple onChange={handleUploadChange} className="hidden" />
          <input
            ref={folderInputRef}
            type="file"
            multiple
            onChange={handleFolderUploadChange}
            className="hidden"
            webkitdirectory=""
            directory=""
          />
        </div>
      </div>

      <div className="shrink-0 px-4 py-2 border-b border-[#18191d] bg-[#0c0c0d] flex gap-2 overflow-x-auto scrollbar-none">
        {[
          { id: "workspace", label: "Workspace", icon: FolderOpen },
          { id: "preview", label: "Viewer", icon: FileSearch },
          { id: "edit", label: "Editor", icon: Edit3, disabled: activeFile ? !isEditable : true },
          { id: "metadata", label: "Metadata", icon: Info },
          { id: "archive", label: "Archive", icon: Archive }
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              disabled={tab.disabled}
              onClick={() => setMode(tab.id as ReaderMode)}
              className={`shrink-0 px-3 py-2 rounded-xl border text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                mode === tab.id
                  ? "bg-[#22c55e] text-black border-[#22c55e]"
                  : tab.disabled
                    ? "bg-[#101114] text-slate-700 border-[#2a2c32]"
                    : "bg-[#151619] text-slate-400 border-[#2a2c32]"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[116px_minmax(0,1fr)] overflow-hidden">
        <aside className="pocketflow-screen-scroll border-r border-[#18191d] bg-[#101114] p-2">
          <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500 font-bold mb-2">Recent</div>
          <div className="space-y-1.5">
            {recentFiles.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#2a2c32] p-2 text-[9px] text-slate-600">Empty</div>
            ) : (
              recentFiles.map((file) => (
                <button
                  key={file.id}
                  onClick={() => onSelectFile(file)}
                  className={`w-full rounded-xl border p-2 text-left ${
                    activeFile?.id === file.id
                      ? "bg-[#22c55e]/10 border-[#22c55e]/30"
                      : "bg-[#0c0c0d] border-[#2a2c32]"
                  }`}
                >
                  <div className="text-[9px] font-mono font-bold text-slate-200 truncate">{file.name}</div>
                  <div className="text-[8px] font-mono uppercase text-slate-600 truncate">{file.extension || file.category}</div>
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="pocketflow-screen-scroll min-w-0 p-3 space-y-3">
          {activeFile && (isSecurityFlagged || (activeWorkspaceAssessment?.warnings.length || 0) > 0) && (
            <div className="rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3 flex items-start gap-3">
              <ShieldAlert className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono font-black uppercase tracking-widest text-amber-200">
                  Reader Safe Box
                </div>
                <p className="mt-1 text-[11px] leading-5 text-amber-100/80">
                  {security?.recommendedAction || activeWorkspaceAssessment?.warnings[0] || "Suspicious file opened in restricted preview mode. Edit and project routing stay disabled until owner override."}
                </p>
              </div>
            </div>
          )}
          {activeFile && (
            <div className="rounded-2xl border border-[#2a2c32] bg-[#151619] p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-mono font-bold text-white truncate">{activeFile.name}</div>
                <div className="text-[9px] font-mono text-slate-500 uppercase">
                  {activeFile.category} / {formatBytes(activeFile.size)}
                </div>
              </div>
              {blobUrl && (
                <a
                  href={blobUrl}
                  download={activeFile.name}
                  className="shrink-0 w-9 h-9 rounded-xl border border-[#2a2c32] bg-[#0c0c0d] text-slate-400 grid place-items-center"
                  title="Download file"
                >
                  <Download className="w-4 h-4" />
                </a>
              )}
              <button
                onClick={() => setIsFullscreenReader(true)}
                title="Full screen reader"
                className="shrink-0 w-9 h-9 rounded-xl border border-[#2a2c32] bg-[#0c0c0d] text-slate-400 hover:text-[#22c55e] grid place-items-center"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {mode === "workspace" && renderWorkspaceHome()}

          {mode === "preview" && renderPreview()}

          {mode === "edit" && (
            <div className="space-y-2">
              <textarea
                value={textContent}
                onChange={(event) => setTextContent(event.target.value)}
                disabled={!activeFile || !isEditable}
                spellCheck={false}
                className="w-full min-h-[360px] rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] p-4 text-[11px] text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-[#22c55e]/40 disabled:text-slate-600"
              />
              <button
                onClick={handleSave}
                disabled={!activeFile || !isEditable}
                className="w-full py-3 rounded-2xl bg-[#22c55e] disabled:bg-slate-800 disabled:text-slate-600 text-black text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Edit
              </button>
            </div>
          )}

          {mode === "metadata" && (
            <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] p-3 space-y-2">
              {(activeFile
                ? [
                    ["Name", activeFile.name],
                    ["MIME", activeFile.mimeType || "unknown"],
                    ["Extension", activeFile.extension || "none"],
                    ["Category", activeFile.category],
                    ["Status", activeFile.status],
                    ["Folder", activeFile.folderPath || "/"],
                    ["Workspace Kind", activeWorkspaceAssessment?.kind || "file"],
                    ["Workspace Risk", activeWorkspaceAssessment?.riskLevel || "safe"],
                    ["Source", activeFile.source],
                    ["Tracker", (activeFile.metadata?.tracker as { code?: string; label?: string } | undefined)?.label || (activeFile.metadata?.tracker as { code?: string } | undefined)?.code || "not assigned"],
                    ["Received", new Date(activeFile.receivedAt).toLocaleString()],
                    ["SHA-256", checksumResult || "not generated"]
                  ]
                : [["Reader", "No active file"]]
              ).map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-3 border-b border-[#18191d] last:border-0 pb-2 last:pb-0">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-slate-600">{label}</span>
                  <span className="text-[10px] text-slate-300 text-right break-all">{value}</span>
                </div>
              ))}
              {activeFile ? (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    onClick={generateActiveChecksum}
                    className="rounded-xl bg-[#22c55e] px-3 py-3 text-[9px] font-mono font-black uppercase tracking-wider text-black"
                  >
                    sha-256
                  </button>
                  <button
                    onClick={handleOpenExternal}
                    className="rounded-xl border border-[#2a2c32] bg-[#151619] px-3 py-3 text-[9px] font-mono font-black uppercase tracking-wider text-slate-300"
                  >
                    open external
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {mode === "archive" && renderArchiveExplorer()}

          {activeFile && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-[#2a2c32] bg-[#0c0c0d] p-2">
                <FileText className="w-4 h-4 text-slate-500 mb-1" />
                <div className="text-[8px] font-mono uppercase text-slate-600">Docs</div>
                <div className="text-[10px] text-slate-300">Best effort</div>
              </div>
              <div className="rounded-xl border border-[#2a2c32] bg-[#0c0c0d] p-2">
                <Table className="w-4 h-4 text-slate-500 mb-1" />
                <div className="text-[8px] font-mono uppercase text-slate-600">Sheets</div>
                <div className="text-[10px] text-slate-300">{isReaderSpreadsheetFile(activeFile) ? "Ready" : "Standby"}</div>
              </div>
              <div className="rounded-xl border border-[#2a2c32] bg-[#0c0c0d] p-2">
                <Image className="w-4 h-4 text-slate-500 mb-1" />
                <div className="text-[8px] font-mono uppercase text-slate-600">Media</div>
                <div className="text-[10px] text-slate-300">{isReaderImageFile(activeFile) ? "Preview" : "Stored"}</div>
              </div>
            </div>
          )}
        </main>
      </div>

      {isFullscreenReader && (
        <div className="fixed inset-0 z-[120] bg-[#070809] text-white flex flex-col">
          <div className="shrink-0 border-b border-[#2a2c32] bg-[#101114] px-3 py-3 flex items-center gap-2">
            <button
              onClick={() => navigateReaderFile(-1)}
              disabled={recentFiles.length < 2}
              title="Previous file"
              className="w-10 h-10 rounded-xl border border-[#2a2c32] bg-[#0c0c0d] text-slate-400 disabled:text-slate-700 grid place-items-center"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-mono font-bold text-white truncate">
                {activeFile?.name || "Reader Full Screen"}
              </div>
              <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">
                {mode} / scroll freely
              </div>
            </div>
            <button
              onClick={() => navigateReaderFile(1)}
              disabled={recentFiles.length < 2}
              title="Next file"
              className="w-10 h-10 rounded-xl border border-[#2a2c32] bg-[#0c0c0d] text-slate-400 disabled:text-slate-700 grid place-items-center"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsFullscreenReader(false)}
              title="Exit full screen"
              className="w-10 h-10 rounded-xl bg-[#22c55e] text-black grid place-items-center"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsFullscreenReader(false)}
              title="Close full screen"
              className="w-10 h-10 rounded-xl border border-[#2a2c32] bg-[#0c0c0d] text-slate-400 grid place-items-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="shrink-0 px-3 py-2 border-b border-[#18191d] bg-[#0c0c0d] flex gap-2 overflow-x-auto scrollbar-none">
            {[
              { id: "workspace", label: "Workspace", icon: FolderOpen },
              { id: "preview", label: "Viewer", icon: FileSearch },
              { id: "edit", label: "Editor", icon: Edit3, disabled: activeFile ? !isEditable : true },
              { id: "metadata", label: "Metadata", icon: Info },
              { id: "archive", label: "Archive", icon: Archive }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={`fullscreen-${tab.id}`}
                  disabled={tab.disabled}
                  onClick={() => setMode(tab.id as ReaderMode)}
                  className={`shrink-0 px-3 py-2 rounded-xl border text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                    mode === tab.id
                      ? "bg-[#22c55e] text-black border-[#22c55e]"
                      : tab.disabled
                        ? "bg-[#101114] text-slate-700 border-[#2a2c32]"
                        : "bg-[#151619] text-slate-400 border-[#2a2c32]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-h-0 overflow-auto overscroll-contain touch-pan-y p-3">
            <div className="min-h-full">
              {renderFullscreenContent()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
