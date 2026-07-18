/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReceivedFile } from "../types";
import { formatBytes } from "../utils/fileValidation";
import { isReaderEditableFile } from "../utils/readerSupport";
import { 
  X, Calendar, HardDrive, Share2, Clipboard, Download, Trash2, 
  MapPin, AlertCircle, FileText, CheckCircle, ExternalLink, BookOpen, Edit3
} from "lucide-react";

interface FilePreviewSheetProps {
  file: ReceivedFile | null;
  folders: { path: string; name: string }[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onImportTrigger: (fileId: string) => void;
  onMoveFile: (fileId: string, folderPath: string) => void;
  onOpenInReader: (file: ReceivedFile) => void;
  onEditInReader: (file: ReceivedFile) => void;
  onShareFile: (file: ReceivedFile) => void;
}

export default function FilePreviewSheet({
  file,
  folders,
  onClose,
  onDelete,
  onImportTrigger,
  onMoveFile,
  onOpenInReader,
  onEditInReader,
  onShareFile,
}: FilePreviewSheetProps) {
  if (!file) return null;

  const formattedSize = formatBytes(file.size);
  const formattedDate = new Date(file.receivedAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 bg-[#0c0c0d]/90 backdrop-blur-sm flex items-end justify-center z-45 animate-fade-in p-0 select-none">
      <div className="absolute inset-0" onClick={onClose} />

      {/* Slide-out bottom preview sheet */}
      <div className="relative w-full max-w-[420px] bg-[#151619] border-t border-[#2a2c32] rounded-t-[32px] p-6 shadow-2xl z-50 flex flex-col gap-4 animate-slide-up max-h-[92%] overflow-y-auto">
        
        {/* Pull handle decor */}
        <div className="w-12 h-1 bg-[#2a2c32] rounded-full mx-auto" />

        {/* Top title area */}
        <div className="flex items-start justify-between">
          <div className="max-w-[80%]">
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#0c0c0d] text-[#8e9299] border border-[#2a2c32] uppercase tracking-wider">
              Preview Core Package
            </span>
            <h3 className="text-base font-bold text-white mt-1.5 leading-tight truncate pr-2 font-mono">
              {file.name}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 bg-[#0c0c0d] border border-[#2a2c32] text-slate-400 hover:text-white rounded-full cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Basic specifications scroll items */}
        <div className="grid grid-cols-2 gap-2 text-xs bg-[#0c0c0d] border border-[#2a2c32] rounded-2xl p-3">
          <div className="flex flex-col gap-0.5 border-r border-[#2a2c32] pr-2">
            <span className="text-[10px] text-[#8e9299] font-mono uppercase tracking-wider">Size specs</span>
            <span className="text-slate-200 font-bold font-mono text-[11px]">{formattedSize}</span>
          </div>
          <div className="flex flex-col gap-0.5 pl-2">
            <span className="text-[10px] text-[#8e9299] font-mono uppercase tracking-wider">Accepted At</span>
            <span className="text-slate-300 font-medium text-[11px]">{formattedDate}</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[10px] font-mono font-semibold text-[#8e9299] uppercase tracking-widest">
            Storage Folder
          </div>
          <select
            value={file.folderPath || "/"}
            onChange={(e) => onMoveFile(file.id, e.target.value)}
            className="w-full bg-[#0c0c0d] border border-[#2a2c32] rounded-xl py-2 px-3 text-xs text-slate-300 focus:outline-none font-mono"
          >
            {folders.map((folder) => (
              <option key={folder.path} value={folder.path}>
                {folder.path === "/" ? "Inbox Root" : folder.path}
              </option>
            ))}
          </select>
        </div>

        {/* MAIN VISUAL PREVIEW SEGMENT */}
        <div className="bg-[#0c0c0d]/90 border border-[#2a2c32] rounded-2xl p-4 min-h-[140px] flex flex-col justify-center">
          
          {/* Category: images */}
          {file.category === "image" && (
            <div className="flex flex-col items-center">
              {file.objectUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-[#2a2c32] max-h-[220px] w-full flex justify-center bg-[#151619]">
                  <img
                    src={file.objectUrl}
                    alt={file.name}
                    referrerPolicy="no-referrer"
                    className="object-contain max-h-[200px]"
                  />
                </div>
              ) : (
                <div className="py-8 text-[#8e9299] text-xs text-center border border-dashed border-white/10 w-full rounded-xl">
                  Image preview link lost or unloaded during lifecycle
                </div>
              )}
              <div className="text-[10px] text-[#8e9299] text-center mt-2 font-mono">
                PNG Pixel Matrix • Auto asset rendering
              </div>
            </div>
          )}

          {/* Category: Dashboards */}
          {file.category === "dashboard" && (
            <div className="space-y-3 select-none">
              <div className="flex items-center gap-2 text-amber-400 border-b border-[#2a2c32] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider font-mono">
                  📊 Dashboard Specification Sheet
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#8e9299]">Design Title:</span>
                  <span className="text-slate-200 font-semibold truncate max-w-[60%]">
                    {file.metadata?.dashboardTitle || file.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8e9299]">Layout Blocks:</span>
                  <span className="text-amber-400 font-mono font-bold">
                    {file.metadata?.dashboardBlockCount !== undefined ? file.metadata.dashboardBlockCount : 4} Widgets
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8e9299]">Type Category:</span>
                  <span className="text-slate-300">PocketFlow Studio template</span>
                </div>
              </div>

              {/* Graphical demo blocks render in phone wrapper */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="bg-[#151619] border border-[#2a2c32] rounded-xl p-2.5">
                  <div className="text-[9px] text-[#8e9299] uppercase tracking-widest font-mono">Metric Card</div>
                  <div className="text-sm font-bold mt-1 text-slate-200">Revenue</div>
                  <div className="text-[10px] text-emerald-400 font-mono mt-0.5">Mock preview Active</div>
                </div>
                <div className="bg-[#151619] border border-[#2a2c32] rounded-xl p-2.5">
                  <div className="text-[9px] text-[#8e9299] uppercase tracking-widest font-mono">Sparkline chart</div>
                  <div className="text-sm font-bold mt-1 text-slate-200">User Growth</div>
                  <div className="text-[10px] text-amber-500 font-mono mt-0.5">Ready to load</div>
                </div>
              </div>
            </div>
          )}

          {/* Category: Builder Package */}
          {file.category === "builderPackage" && (
            <div className="space-y-3 select-none">
              <div className="flex items-center gap-2 text-[#22c55e] border-b border-[#2a2c32] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider font-mono">
                  ⚙️ Builder Package Graph Nodes
                </span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#8e9299]">Project Workspace:</span>
                  <span className="text-slate-200 font-semibold truncate max-w-[60%]">
                    {file.metadata?.builderProjectName || "Core System Assembly"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8e9299]">Action Box Count:</span>
                  <span className="text-[#22c55e] font-mono font-bold">
                    {file.metadata?.builderBoxCount !== undefined ? file.metadata.builderBoxCount : 8} Nodes
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8e9299]">Agent Pipelines:</span>
                  <span className="text-slate-300">Synchronized Task Engine</span>
                </div>
              </div>

              {/* Graphic flow diagram representation */}
              <div className="flex items-center justify-center p-3.5 bg-[#151619] border border-[#2a2c32] rounded-xl mt-2.5 gap-2 font-mono text-[9px]">
                <span className="px-2 py-1 bg-[#0c0c0d] text-[#8e9299] border border-[#2a2c32] rounded">Archive</span>
                <span className="text-[11px] text-[#22c55e]">➔</span>
                <span className="px-2 py-1 bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30 rounded font-bold">PocketFlow System</span>
              </div>
            </div>
          )}

          {/* Category: Markdown */}
          {file.category === "markdown" && (
            <div className="space-y-2">
              <div className="text-xs text-blue-400 font-mono uppercase tracking-wider border-b border-[#2a2c32] pb-1.5 flex justify-between">
                <span>📝 Markdown Text Stream</span>
                <span>Plain View</span>
              </div>
              <div className="bg-[#151619] rounded-xl p-3 border border-[#2a2c32] max-h-[160px] overflow-y-auto text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">
                {file.metadata?.contentPreview || `# ${file.name}\n\nNo descriptive header details found or content parsed for this payload.`}
              </div>
            </div>
          )}

          {/* Category: CSV */}
          {file.category === "csv" && (
            <div className="space-y-2.5">
              <div className="text-xs text-violet-400 font-mono uppercase tracking-wider border-b border-[#2a2c32] pb-1.5 flex justify-between">
                <span>📊 CSV Structured Columns</span>
                <span>Rows: {file.metadata?.csvRowsCount || 12}</span>
              </div>
              {file.metadata?.csvColumns && file.metadata.csvColumns.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {file.metadata.csvColumns.map((col, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-[#151619] border border-[#2a2c32] rounded text-[10px] text-[#8e9299] font-mono">
                      {col}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-[#8e9299] font-mono">No CSV column metadata scanned.</div>
              )}
              <div className="bg-[#151619] rounded-xl p-2.5 border border-[#2a2c32] max-h-[120px] overflow-y-auto text-[10px] text-[#8e9299] font-mono leading-relaxed whitespace-pre overflow-x-auto">
                {file.metadata?.contentPreview || "ID, MetricName, Timestamp, Count\n001, PageClick, 2026-05-28, 4800"}
              </div>
            </div>
          )}

          {/* Category: ZIP */}
          {file.category === "archive" && (
            <div className="space-y-2.5">
              <div className="text-xs text-cyan-400 font-mono uppercase tracking-focused border-b border-[#2a2c32] pb-1.5">
                🗜️ Safe Archive Sandbox Check
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl p-3.5 flex gap-2.5 items-start">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-bold block mb-0.5">Uncompressed File Sandbox Warnings</span>
                  ZIP package payload remains unzipped inside staging for sandbox defense. Inspect the integrity and origin prior to importing.
                </div>
              </div>
              <span className="text-[10px] text-slate-500 font-mono mt-1 text-center block leading-none">
                File scanning status: Safe placeholder registered
              </span>
            </div>
          )}

          {/* Category: UnknownSafe / document */}
          {(file.category === "unknownSafe" || file.category === "document") && (
            <div className="py-4 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <FileText className="w-10 h-10 text-slate-600" />
              <div>
                <span className="font-bold block text-slate-300">Generic Staged Package</span>
                <span className="text-[10px] font-mono text-[#8e9299] uppercase mt-0.5 block">
                  {file.mimeType || "application/octet-stream"}
                </span>
              </div>
              <p className="text-[11px] text-[#8e9299] mt-1 max-w-[80%] leading-normal">
                No custom visualizers exist for this mime. Ready to be mapped to storage.
              </p>
            </div>
          )}

        </div>

        {/* Audit logging view */}
        <div className="space-y-2">
          <div className="text-[10px] font-mono font-semibold text-[#8e9299] uppercase tracking-widest">
            Inbox Quarantine Audit Logs
          </div>
          <div className="bg-[#0c0c0d] border border-[#2a2c32] rounded-2xl p-3 max-h-[110px] overflow-y-auto space-y-1.5">
            {file.auditLog && file.auditLog.map((log, idx) => (
              <div key={idx} className="flex justify-between text-[10px] font-mono leading-none border-b border-[#2a2c32] pb-1.5 last:border-0 last:pb-0">
                <span className="text-slate-400">{log.type}</span>
                <span className="text-[#8e9299] text-[9px]">{log.detail || "Success"}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions panel */}
        <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-2 mt-3">
          <button
            onClick={() => onDelete(file.id)}
            className="h-11 bg-red-950/15 hover:bg-red-950/30 active:bg-red-950/50 text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-2xl transition cursor-pointer grid place-items-center"
            title="Delete from Inbox"
          >
            <Trash2 className="w-4.5 h-4.5" />
          </button>
          
          <button
            onClick={() => onImportTrigger(file.id)}
            className="h-11 px-4 bg-[#22c55e] hover:bg-emerald-500 font-mono text-xs font-bold rounded-2xl text-black transition shadow-[0_4px_12px_rgba(34,197,94,0.15)] hover:shadow-emerald-500/20 text-center uppercase tracking-wider duration-100 cursor-pointer"
          >
            Assign Import Path
          </button>
          <button
            onClick={() => onShareFile(file)}
            className="col-span-2 h-11 px-4 bg-sky-500/10 border border-sky-500/25 hover:bg-sky-500/15 text-sky-300 font-mono text-xs font-bold rounded-2xl transition uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
          <button
            onClick={() => onOpenInReader(file)}
            className="col-span-2 h-11 px-4 bg-[#0c0c0d] border border-[#2a2c32] hover:border-[#22c55e]/40 text-slate-300 hover:text-[#22c55e] font-mono text-xs font-bold rounded-2xl transition uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            Open in Reader
          </button>
          {isReaderEditableFile(file) && (
            <button
              onClick={() => onEditInReader(file)}
              className="col-span-2 h-11 px-4 bg-amber-500/10 border border-amber-500/25 hover:bg-amber-500/15 text-amber-400 font-mono text-xs font-bold rounded-2xl transition uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"
            >
              <Edit3 className="w-4 h-4" />
              Edit in Reader
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
