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
    <section className="min-h-0 flex-1 overflow-y-auto bg-[#070b09] text-white">
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

      <div className="relative overflow-hidden border-b border-emerald-300/15 bg-[#05130f] px-4 pb-5 pt-4">
        <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute -bottom-20 left-8 h-44 w-44 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[9px] font-black uppercase tracking-[0.32em] text-emerald-300">Archive OS</p>
              <h2 className="mt-2 text-4xl font-black leading-none tracking-tight">File desk</h2>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
                One clean shelf for files, folders, previews, ZIPs, labels and safe quarantine.
              </p>
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex h-14 shrink-0 items-center gap-2 rounded-[1.25rem] bg-emerald-300 px-4 text-[10px] font-mono font-black uppercase tracking-[0.16em] text-[#03130c] shadow-xl shadow-emerald-500/20 active:scale-95"
            >
              <Upload className="h-5 w-5" />
              Add
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {[
              ["Files", liveFiles.length.toString(), "from-emerald-300/20 to-emerald-500/5", "text-emerald-200"],
              ["Folders", Math.max(folders.length - 1, 0).toString(), "from-sky-300/20 to-sky-500/5", "text-sky-200"],
              ["Quarantine", quarantineCount.toString(), "from-amber-300/20 to-amber-500/5", "text-amber-200"],
              ["Size", formatBytes(totalSize), "from-fuchsia-300/15 to-fuchsia-500/5", "text-fuchsia-100"],
            ].map(([label, value, gradient, color]) => (
              <div key={label} className={`rounded-[1.35rem] border border-white/10 bg-gradient-to-br ${gradient} p-4 shadow-lg shadow-black/10`}>
                <div className={`font-mono text-[8px] font-black uppercase tracking-[0.22em] ${color}`}>{label}</div>
                <div className="mt-2 truncate text-2xl font-black">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#08090b] px-4 pb-28">
        <section className="pt-4">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[9px] font-black uppercase tracking-[0.24em] text-slate-500">Folders</div>
            <div className="rounded-full bg-white/[0.05] px-3 py-1 font-mono text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
              {folders.length} rails
            </div>
          </div>
          <div className="-mx-4 mt-3 flex snap-x gap-2 overflow-x-auto px-4 pb-2">
            {folders.map((folder) => {
              const count = folder === "/" ? liveFiles.length : liveFiles.filter((file) => smartFolderPath(file) === folder).length;
              const active = selectedFolder === folder;
              return (
                <button
                  key={folder}
                  type="button"
                  onClick={() => setSelectedFolder(folder)}
                  className={`flex min-w-[150px] snap-start items-center justify-between rounded-[1.25rem] border px-3 py-3 text-left transition ${
                    active
                      ? "border-emerald-300/70 bg-emerald-300 text-[#03130c] shadow-lg shadow-emerald-500/20"
                      : "border-white/10 bg-white/[0.04] text-slate-200 active:bg-white/[0.08]"
                  }`}
                >
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <FolderOpen className="h-4 w-4 shrink-0" />
                    <span className="truncate text-xs font-black">{folderLabel(folder)}</span>
                  </span>
                  <span className={`rounded-full px-2 py-1 font-mono text-[9px] font-black ${active ? "bg-[#03130c]/10" : "bg-white/10"}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="sticky top-0 z-20 -mx-4 border-y border-white/10 bg-[#08090b]/95 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[9px] font-black uppercase tracking-[0.22em] text-emerald-300">{folderLabel(selectedFolder)}</div>
              <h3 className="mt-1 text-3xl font-black">{visibleFiles.length} shown</h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setKindFilter("all");
                setSelectedFolder("/");
              }}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[9px] font-black uppercase tracking-[0.14em] text-slate-300"
            >
              Reset
            </button>
          </div>
          <label className="mt-3 flex h-13 items-center gap-2 rounded-[1.35rem] border border-white/10 bg-[#111317] px-3 shadow-inner shadow-black/30">
            <Search className="h-4 w-4 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search files, labels, folders..."
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-600"
            />
          </label>
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {ARCHIVE_FILTERS.map((filter) => {
              const Icon = iconForKind(filter.id);
              const active = kindFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setKindFilter(filter.id)}
                  className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 font-mono text-[9px] font-black uppercase tracking-[0.12em] transition ${
                    active
                      ? "border-amber-200/80 bg-amber-200 text-[#1d1300] shadow-lg shadow-amber-500/15"
                      : "border-white/10 bg-white/[0.04] text-slate-300"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {filter.label}
                </button>
              );
            })}
          </div>
        </section>

        {visibleFiles.length === 0 ? (
          <div className="mt-5 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-6 text-center shadow-xl shadow-black/20">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] border border-emerald-300/20 bg-emerald-300/10">
              <PackageSearch className="h-8 w-8 text-emerald-200" />
            </div>
            <h4 className="mt-4 text-2xl font-black">No files here</h4>
            <p className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-slate-400">
              Add a public demo file, switch folder, or clear filters. Private phone data is intentionally not bundled.
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-5 inline-flex h-12 items-center gap-2 rounded-2xl bg-emerald-300 px-5 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#03130c]"
            >
              <Upload className="h-4 w-4" />
              Add files
            </button>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {visibleFiles.map((file) => {
              const kind = archiveKind(file);
              const Icon = iconForKind(kind);
              const tracker = file.metadata?.tracker as { code?: string; label?: string; color?: string } | undefined;
              const quarantine = isQuarantined(file);
              return (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => openFile(file, quarantine ? "metadata" : "preview")}
                  className={`group rounded-[1.6rem] border p-4 text-left shadow-lg shadow-black/15 transition active:scale-[0.99] ${
                    quarantine
                      ? "border-amber-300/25 bg-amber-300/10"
                      : "border-white/10 bg-[#111317] hover:border-emerald-300/40"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-[1.15rem] border ${
                      quarantine ? "border-amber-300/30 bg-amber-400/10 text-amber-200" : "border-emerald-300/20 bg-emerald-400/10 text-emerald-200"
                    }`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-black text-white">{file.name}</span>
                      <span className="mt-1 block truncate font-mono text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">
                        {folderLabel(smartFolderPath(file))} / {file.extension || "file"} / {formatBytes(file.size)}
                      </span>
                      <span className="mt-3 flex flex-wrap gap-2">
                        <span className={`rounded-full px-2.5 py-1 font-mono text-[9px] font-black uppercase tracking-[0.12em] ${
                          quarantine ? "bg-amber-300/15 text-amber-200" : "bg-emerald-300/10 text-emerald-200"
                        }`}>
                          {kind}
                        </span>
                        {tracker?.code && (
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 font-mono text-[9px] font-black uppercase tracking-[0.12em] text-slate-300">
                            {tracker.code}
                          </span>
                        )}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
