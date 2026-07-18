import React, { useMemo, useRef, useState } from "react";
import {
  Archive,
  Box,
  ChevronLeft,
  FileCode2,
  FileText,
  FolderOpen,
  Image,
  PackageSearch,
  Search,
  ShieldAlert,
  Upload,
} from "lucide-react";
import type { ReceivedFile } from "../types";
import { formatBytes } from "../utils/fileValidation";
import ReaderApp from "./ReaderApp";

type ReaderMode = "workspace" | "preview" | "edit" | "metadata" | "archive";
type ArchiveKind = "all" | "document" | "image" | "archive" | "code" | "quarantine";

interface ArchivePublicAppProps {
  files: ReceivedFile[];
  activeFile: ReceivedFile | null;
  onSelectFile: (file: ReceivedFile) => void;
  onUploadFile: (file: File) => void;
  onSaveTextEdit: (file: ReceivedFile, content: string) => Promise<void>;
  onNotify: (msg: string, type: "success" | "info" | "warn") => void;
}

const isQuarantined = (file: ReceivedFile) => {
  const security = file.metadata?.security as { scanStatus?: string; threatLevel?: string } | undefined;
  return file.status === "blocked" || ["suspected", "quarantined", "blocked"].includes(security?.scanStatus || "");
};

const archiveKind = (file: ReceivedFile): ArchiveKind => {
  if (isQuarantined(file)) return "quarantine";
  if (file.category === "image") return "image";
  if (file.category === "archive" || ["zip", "rar", "7z", "tar", "gz", "tgz"].includes(file.extension.toLowerCase())) return "archive";
  if (["markdown", "csv", "document", "text", "dashboard", "builderPackage"].includes(file.category)) return "document";
  if (["js", "jsx", "ts", "tsx", "json", "css", "html", "py", "md"].includes(file.extension.toLowerCase())) return "code";
  return "all";
};

const smartFolderPath = (file: ReceivedFile) => {
  if (isQuarantined(file)) return "/quarantine";
  if (file.folderPath && file.folderPath !== "/") return file.folderPath;
  const category = archiveKind(file);
  if (category === "image") return "/images";
  if (category === "archive") return "/packages";
  if (category === "code") return "/code";
  if (category === "document") return "/documents";
  return "/inbox";
};

const folderLabel = (path: string) => (
  path === "/" ? "All files" : path.replace(/^\/+/, "").replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
);

const iconForKind = (kind: ArchiveKind) => {
  if (kind === "image") return Image;
  if (kind === "archive") return Archive;
  if (kind === "code") return FileCode2;
  if (kind === "quarantine") return ShieldAlert;
  if (kind === "document") return FileText;
  return Box;
};

const ARCHIVE_FILTERS: Array<{ id: ArchiveKind; label: string }> = [
  { id: "all", label: "All" },
  { id: "document", label: "Documents" },
  { id: "image", label: "Images" },
  { id: "archive", label: "Packages" },
  { id: "code", label: "Code" },
  { id: "quarantine", label: "Quarantine" },
];

export default function ArchivePublicApp({
  files,
  activeFile,
  onSelectFile,
  onUploadFile,
  onSaveTextEdit,
  onNotify,
}: ArchivePublicAppProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerMode, setReaderMode] = useState<ReaderMode>("preview");
  const [selectedFolder, setSelectedFolder] = useState("/");
  const [kindFilter, setKindFilter] = useState<ArchiveKind>("all");
  const [query, setQuery] = useState("");

  const liveFiles = useMemo(() => files.filter((file) => file.status !== "deleted"), [files]);
  const folders = useMemo(() => {
    const counts = new Map<string, number>();
    liveFiles.forEach((file) => counts.set(smartFolderPath(file), (counts.get(smartFolderPath(file)) || 0) + 1));
    return ["/", ...Array.from(counts.keys()).sort()];
  }, [liveFiles]);

  const visibleFiles = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return liveFiles
      .filter((file) => selectedFolder === "/" || smartFolderPath(file) === selectedFolder)
      .filter((file) => kindFilter === "all" || archiveKind(file) === kindFilter)
      .filter((file) => {
        if (!normalizedQuery) return true;
        return [
          file.name,
          file.extension,
          file.category,
          file.sourceDeviceName,
          smartFolderPath(file),
          String((file.metadata?.tracker as { code?: string; label?: string } | undefined)?.code || ""),
          String((file.metadata?.tracker as { code?: string; label?: string } | undefined)?.label || ""),
        ].some((value) => value?.toLowerCase().includes(normalizedQuery));
      })
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
  }, [kindFilter, liveFiles, query, selectedFolder]);

  const quarantineCount = liveFiles.filter(isQuarantined).length;
  const totalSize = liveFiles.reduce((sum, file) => sum + (file.size || 0), 0);

  const openFile = (file: ReceivedFile, mode: ReaderMode = "preview") => {
    onSelectFile(file);
    setReaderMode(mode);
    setReaderOpen(true);
  };

  if (readerOpen) {
    return (
      <section className="flex min-h-0 flex-1 flex-col bg-[#08090b]">
        <div className="shrink-0 border-b border-[#24272c] bg-[#101114]/95 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setReaderOpen(false)}
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[#2a2c32] bg-[#0c0d0f] px-4 text-[10px] font-mono font-black uppercase tracking-[0.14em] text-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
              Archive
            </button>
            <div className="min-w-0 flex-1 text-right">
              <div className="truncate text-sm font-black text-white">{activeFile?.name || "Archive Reader"}</div>
              <div className="truncate text-[9px] font-mono uppercase tracking-[0.18em] text-slate-500">viewer / editor / metadata</div>
            </div>
          </div>
        </div>
        <ReaderApp
          files={files}
          activeFile={activeFile}
          initialMode={readerMode}
          onSelectFile={(file) => openFile(file, "preview")}
          onUploadFile={onUploadFile}
          onSaveTextEdit={onSaveTextEdit}
          onNotify={onNotify}
        />
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#080f0c] text-white">
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          Array.from(event.target.files || []).forEach(onUploadFile);
          event.currentTarget.value = "";
        }}
      />

      <div className="shrink-0 border-b border-emerald-400/15 bg-[#06120d] px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.42em] text-emerald-300">Archive / Reader</p>
            <h2 className="mt-2 text-4xl font-black tracking-tight">File desk</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-300">
              Public-safe archive shell with folders, previews, metadata, ZIP inspection, and quarantine visibility.
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-14 items-center gap-3 rounded-2xl bg-emerald-400 px-5 text-[11px] font-mono font-black uppercase tracking-[0.18em] text-[#04110b] shadow-lg shadow-emerald-500/20"
          >
            <Upload className="h-5 w-5" />
            Add files
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Files", liveFiles.length.toString()],
            ["Folders", Math.max(folders.length - 1, 0).toString()],
            ["Quarantine", quarantineCount.toString()],
            ["Size", formatBytes(totalSize)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="font-mono text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</div>
              <div className="mt-1 text-2xl font-black">{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[240px_1fr]">
        <aside className="min-h-0 overflow-auto border-b border-white/10 bg-[#0b0c10] p-4 md:border-b-0 md:border-r">
          <div className="font-mono text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">Folders</div>
          <div className="mt-3 space-y-2">
            {folders.map((folder) => {
              const count = folder === "/" ? liveFiles.length : liveFiles.filter((file) => smartFolderPath(file) === folder).length;
              const active = selectedFolder === folder;
              return (
                <button
                  key={folder}
                  type="button"
                  onClick={() => setSelectedFolder(folder)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition ${
                    active ? "border-emerald-300/50 bg-emerald-400/15 text-emerald-100" : "border-white/10 bg-white/[0.03] text-slate-300"
                  }`}
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <FolderOpen className="h-4 w-4 shrink-0" />
                    <span className="truncate text-xs font-black">{folderLabel(folder)}</span>
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-1 font-mono text-[9px] font-black">{count}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-h-0 overflow-auto bg-[#08090b] p-4 pb-24">
          <div className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-white/10 bg-[#08090b]/95 p-4 backdrop-blur">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="font-mono text-[9px] font-black uppercase tracking-[0.22em] text-emerald-300">{folderLabel(selectedFolder)}</div>
                <h3 className="mt-1 text-2xl font-black">{visibleFiles.length} shown</h3>
              </div>
              <div className="flex flex-1 flex-col gap-3 sm:flex-row lg:max-w-2xl">
                <label className="flex h-12 flex-1 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3">
                  <Search className="h-4 w-4 text-slate-500" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search files, labels, folders..."
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-600"
                  />
                </label>
                <select
                  value={kindFilter}
                  onChange={(event) => setKindFilter(event.target.value as ArchiveKind)}
                  className="h-12 rounded-2xl border border-white/10 bg-[#111317] px-3 text-xs font-black text-white outline-none"
                >
                  {ARCHIVE_FILTERS.map((filter) => <option key={filter.id} value={filter.id}>{filter.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {visibleFiles.length === 0 ? (
            <div className="mt-6 rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] p-10 text-center">
              <PackageSearch className="mx-auto h-10 w-10 text-slate-500" />
              <h4 className="mt-4 text-2xl font-black">No files in this view</h4>
              <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-slate-400">
                Add public demo files, switch folder, or clear filters. Private phone data is intentionally not bundled in this repository.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {visibleFiles.map((file) => {
                const kind = archiveKind(file);
                const Icon = iconForKind(kind);
                const tracker = file.metadata?.tracker as { code?: string; label?: string; color?: string } | undefined;
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => openFile(file, isQuarantined(file) ? "metadata" : "preview")}
                    className="group rounded-[1.5rem] border border-white/10 bg-[#111317] p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-300/40 hover:bg-[#142019]"
                  >
                    <div className="flex items-start gap-3">
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
                        kind === "quarantine" ? "border-amber-300/30 bg-amber-400/10 text-amber-200" : "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
                      }`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-black text-white">{file.name}</span>
                        <span className="mt-1 block truncate font-mono text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                          {folderLabel(smartFolderPath(file))} / {file.extension || "file"} / {formatBytes(file.size)}
                        </span>
                        {tracker?.code && (
                          <span className="mt-2 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 font-mono text-[9px] font-black uppercase tracking-[0.12em] text-slate-300">
                            {tracker.code}
                          </span>
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
