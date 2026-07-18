/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReceivedFile, ReceiveStatus, FileCategory } from "../types";
import { formatBytes } from "../utils/fileValidation";
import { isReaderEditableFile } from "../utils/readerSupport";
import { 
  Search, FileDown, ShieldAlert, BarChart3, Settings, 
  Image, FileText, CheckCircle2, ShieldQuestion, HelpCircle, BookOpen, Edit3, Share2
} from "lucide-react";

interface InboxListProps {
  files: ReceivedFile[];
  activeFilter: ReceiveStatus | "all" | "blocked" | "pending" | "accepted" | "imported";
  searchTerm: string;
  onFilterChange: (filter: any) => void;
  onSearchChange: (term: string) => void;
  onSelectFile: (id: string) => void;
  onDirectImport: (fileId: string) => void;
  onOpenInReader: (file: ReceivedFile) => void;
  onEditInReader: (file: ReceivedFile) => void;
  onShareFile: (file: ReceivedFile) => void;
}

export default function InboxList({
  files,
  activeFilter,
  searchTerm,
  onFilterChange,
  onSearchChange,
  onSelectFile,
  onDirectImport,
  onOpenInReader,
  onEditInReader,
  onShareFile,
}: InboxListProps) {
  
  // Filter and search computation
  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (file.sourceDeviceName && file.sourceDeviceName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (activeFilter === "all") return matchesSearch && file.status !== "deleted";
    if (activeFilter === "pending") return matchesSearch && file.status === "pending";
    if (activeFilter === "accepted") return matchesSearch && file.status === "accepted";
    if (activeFilter === "imported") return matchesSearch && file.status === "imported";
    if (activeFilter === "blocked") return matchesSearch && file.status === "blocked";
    
    return matchesSearch && file.status === activeFilter;
  });

  // Category Icon Selector
  const getCategoryIcon = (category: FileCategory) => {
    switch (category) {
      case "dashboard":
        return <BarChart3 className="w-4 h-4 text-amber-400" />;
      case "builderPackage":
        return <Settings className="w-4 h-4 text-[#22c55e]" />;
      case "image":
        return <Image className="w-4 h-4 text-emerald-400" />;
      case "markdown":
        return <FileText className="w-4 h-4 text-blue-400" />;
      case "csv":
        return <BarChart3 className="w-4 h-4 text-violet-400" />;
      case "blocked":
        return <ShieldAlert className="w-4 h-4 text-red-400" />;
      default:
        return <HelpCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  // Status Pill styling dictionary
  const statusStyles: Record<ReceiveStatus, { bg: string; text: string; label: string }> = {
    pending: { bg: "bg-amber-500/10 border border-amber-500/20", text: "text-amber-400", label: "Approve Gate" },
    accepted: { bg: "bg-[#22c55e]/10 border border-[#22c55e]/20", text: "text-[#22c55e]", label: "STAGED" },
    declined: { bg: "bg-red-500/10 border border-red-500/15", text: "text-red-400", label: "Declined" },
    blocked: { bg: "bg-rose-500/15 border border-rose-500/30", text: "text-rose-400", label: "QUARANTINED" },
    imported: { bg: "bg-[#22c55e]/10 border border-[#22c55e]/20", text: "text-[#22c55e]", label: "IMPORTED" },
    failed: { bg: "bg-slate-800 border-white/5", text: "text-slate-500", label: "Failed" },
    deleted: { bg: "bg-slate-800 border-white/5", text: "text-slate-500", label: "Deleted" },
  };

  return (
    <div className="flex flex-col flex-1 select-none">
      
      {/* Search Input Area */}
      <div className="relative mb-3.5 px-1">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by packet name or source..."
          className="w-full bg-[#151619] border border-[#2a2c32] hover:border-slate-600 focus:border-[#22c55e]/40 rounded-xl py-2 px-3 pl-9.5 text-xs text-white placeholder-slate-500 transition focus:outline-none font-sans"
        />
        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-4.5 top-1/2 -translate-y-1/2" />
      </div>

      {/* Filter Horizontal Tab bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 mb-2.5 scrollbar-thin scrollbar-thumb-slate-800 px-1 shrink-0 scrollbar-none">
        {[
          { id: "all", label: "All Items" },
          { id: "pending", label: "Approve Gate" },
          { id: "accepted", label: "Staged Inbox" },
          { id: "imported", label: "Imported" },
          { id: "blocked", label: "Quarantine" },
        ].map((tab) => {
          const count = files.filter(f => {
            if (tab.id === "all") return f.status !== "deleted";
            return f.status === tab.id;
          }).length;

          const isActive = activeFilter === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onFilterChange(tab.id as any)}
              className={`px-3 py-1.5 rounded-full text-[11px] font-mono font-medium tracking-wide transition border whitespace-nowrap grow-0 shrink-0 cursor-pointer ${
                isActive
                  ? "bg-[#22c55e]/15 border-[#22c55e]/30 text-[#22c55e] font-semibold"
                  : "bg-[#151619] border border-[#2a2c32] text-[#8e9299] hover:text-slate-300 hover:border-slate-500"
              }`}
            >
              {tab.label} <span className="text-[10px] opacity-60 ml-0.5">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Main Filter Result Cards Feed Container */}
      <div className="flex-1 overflow-y-auto space-y-2 px-1">
        {filteredFiles.length > 0 ? (
          filteredFiles.map((file) => {
            const statusConfig = statusStyles[file.status] || { bg: "bg-slate-800", text: "text-slate-400", label: file.status };
            const isPending = file.status === "pending";
            const isAccepted = file.status === "accepted";

            return (
              <div
                key={file.id}
                onClick={() => onSelectFile(file.id)}
                className="bg-[#151619] border border-[#2a2c32] hover:border-slate-600 rounded-2xl p-3.5 transition duration-150 cursor-pointer flex flex-col gap-2 relative group hover:bg-[#151619]/90 shadow-md active:scale-99"
              >
                {/* Upper line: Category icon, filename, and status badge */}
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="p-2 bg-[#0c0c0d] border border-[#2a2c32] rounded-xl shrink-0">
                      {getCategoryIcon(file.category)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-semibold text-slate-200 truncate pr-1 font-mono leading-snug">
                        {file.name}
                      </h4>
                      {/* Device origin info details */}
                      <span className="text-[9px] text-[#8e9299] font-mono tracking-tight uppercase leading-none block mt-1">
                        From: {file.sourceDeviceName || "Unknown device"} • {formatBytes(file.size)}
                      </span>
                    </div>
                  </div>

                  {/* Right: status pill */}
                  <span
                    className={`text-[8.5px] font-mono font-bold px-2 py-0.5 rounded-md border tracking-wide uppercase ${statusConfig.bg} ${statusConfig.text}`}
                  >
                    {statusConfig.label}
                  </span>
                </div>

                {/* Bottom line: Date, import sugerence, and quick routing tools */}
                <div className="border-t border-[#2a2c32] pt-2.5 mt-0.5 flex items-center justify-between gap-2 text-[10px] text-[#8e9299] font-mono">
                  <span>
                    {new Date(file.receivedAt).toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                    {new Date(file.receivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onShareFile(file);
                      }}
                      title="Share"
                      className="w-8 h-8 rounded-lg border border-[#2a2c32] bg-[#0c0c0d] text-slate-400 hover:text-sky-300 hover:border-sky-500/30 grid place-items-center"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenInReader(file);
                      }}
                      title="Open in Reader"
                      className="w-8 h-8 rounded-lg border border-[#2a2c32] bg-[#0c0c0d] text-slate-400 hover:text-[#22c55e] hover:border-[#22c55e]/30 grid place-items-center"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                    </button>
                    {isReaderEditableFile(file) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditInReader(file);
                        }}
                        title="Edit in Reader"
                        className="w-8 h-8 rounded-lg border border-[#2a2c32] bg-[#0c0c0d] text-slate-400 hover:text-amber-400 hover:border-amber-500/30 grid place-items-center"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isAccepted && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDirectImport(file.id);
                        }}
                        className="px-2.5 h-8 bg-[#22c55e]/10 border border-[#22c55e]/25 text-[#22c55e] hover:bg-[#22c55e]/20 text-[9px] font-bold rounded-lg transition uppercase tracking-wider cursor-pointer active:scale-95"
                      >
                        Route
                      </button>
                    )}
                  </div>

                  {isPending && (
                    <span className="text-amber-500 font-semibold animate-pulse">
                      ▲ Requires Approve
                    </span>
                  )}

                  {file.status === "imported" && (
                    <span className="text-emerald-400 font-semibold flex items-center gap-2">
                      ✓ Imported
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          /* Empty state */
          <div className="py-14 text-center select-none flex flex-col items-center justify-center p-6 border border-dashed border-[#2a2c32] rounded-2xl max-w-full">
            <div className="w-12 h-12 bg-[#151619] border border-[#2a2c32] rounded-2xl flex items-center justify-center text-[#8e9299] mb-3 text-lg">
              📥
            </div>
            <h3 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider">
              Inbox Clear
            </h3>
            <p className="text-[11px] text-[#8e9299] max-w-[80%] leading-relaxed mt-1 mb-3">
              No files received matching the active filter. Choose manually, drag some onto desktop, or toggle simulator.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
