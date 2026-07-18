/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ReceivedFile, ImportDestination } from "../types";
import { 
  X, BookOpen, Settings, Image, FileText, FolderClosed, 
  Inbox, HelpCircle, Check, ArrowRight 
} from "lucide-react";

interface ImportDestinationSheetProps {
  file: ReceivedFile | null;
  onClose: () => void;
  onConfirmImport: (fileId: string, destination: ImportDestination) => void;
}

export default function ImportDestinationSheet({
  file,
  onClose,
  onConfirmImport,
}: ImportDestinationSheetProps) {
  if (!file) return null;

  const destinations: {
    id: ImportDestination;
    label: string;
    description: string;
    icon: React.ComponentType<any>;
    color: string;
    badge?: string;
  }[] = [
    {
      id: "dashboardStudio",
      label: "Reader",
      description: "Open dashboard files, HTML reports, CSV inputs, and editable previews.",
      icon: BookOpen,
      color: "border-emerald-500/30 text-emerald-400",
      badge: "Suggested for Dashboards",
    },
    {
      id: "pocketFlowBuilder",
      label: "PocketFlow Builder",
      description: "Map graph connectors, boxes, and task agent pipelines.",
      icon: Settings,
      color: "border-[#22c55e]/30 text-[#22c55e]",
      badge: "Suggested for Builder Pack",
    },
    {
      id: "assetsLibrary",
      label: "Assets Library",
      description: "Store reference images, mock vectors, and UI layouts.",
      icon: Image,
      color: "border-emerald-500/30 text-emerald-400",
      badge: "Suggested for Images",
    },
    {
      id: "notes",
      label: "Notes & Reports",
      description: "Attach text streams, instruction headers, and journals.",
      icon: FileText,
      color: "border-blue-500/30 text-blue-400",
    },
    {
      id: "genericStorage",
      label: "Generic File Storage",
      description: "Save documents, archives, and unknown attachments natively.",
      icon: FolderClosed,
      color: "border-[#2a2c32] text-slate-400",
    },
    {
      id: "keepInInbox",
      label: "Keep in Inbox Only",
      description: "Retain metadata inside Archive without moving.",
      icon: Inbox,
      color: "border-gray-500/35 text-slate-400",
    },
  ];

  return (
    <div className="fixed inset-0 bg-[#0c0c0d]/90 backdrop-blur-sm flex items-end justify-center z-50 animate-fade-in p-0 select-none">
      <div className="absolute inset-0" onClick={onClose} />

      {/* Sheet panel */}
      <div className="relative w-full max-w-[420px] bg-[#151619] border-t border-[#2a2c32] rounded-t-[32px] p-6 shadow-2xl z-55 flex flex-col gap-4 animate-slide-up max-h-[88%] overflow-y-auto">
        
        {/* Pull handle decor */}
        <div className="w-12 h-1 bg-[#2a2c32] rounded-full mx-auto" />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#0c0c0d] text-[#8e9299] border border-[#2a2c32] uppercase tracking-wider">
              Import Routing Map
            </span>
            <h3 className="text-base font-bold text-white mt-1.5 leading-tight tracking-tight">
              Route to pocketflow application
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 bg-[#0c0c0d] border border-[#2a2c32] text-slate-400 hover:text-white rounded-full cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected file brief banner */}
        <div className="bg-[#0c0c0d] border border-[#2a2c32] rounded-xl p-3 flex justify-between items-center text-xs">
          <div>
            <span className="text-slate-500 font-mono block text-[9px] uppercase">Routing item</span>
            <span className="text-slate-300 font-semibold truncate font-mono block max-w-[200px]">{file.name}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 font-mono block text-[9px] uppercase">Category</span>
            <span className="text-[#22c55e] capitalize font-semibold block">{file.category}</span>
          </div>
        </div>

        {/* Suggestion explanation */}
        <div className="text-[11px] text-slate-400 leading-relaxed font-sans mb-1 bg-[#0c0c0d]/80 rounded-xl p-2.5 border border-[#2a2c32]">
          👉 Select which destination sub-system inside the <span className="text-slate-200 font-semibold">PocketFlow OS</span> should import this package.
        </div>

        {/* List of Destination Cards */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {destinations.map((dest) => {
            const isSuggested = file.suggestedDestination === dest.id;
            const IconComponent = dest.icon;

            return (
              <button
                key={dest.id}
                onClick={() => onConfirmImport(file.id, dest.id)}
                className={`w-full text-left p-3.5 border rounded-2xl transition-all cursor-pointer flex gap-3.5 relative items-center active:scale-99 ${
                  isSuggested 
                    ? `border-[#22c55e] bg-[#22c55e]/5 text-[#22c55e] ring-1 ring-[#22c55e]/20` 
                    : "border-[#2a2c32] hover:border-slate-500 bg-[#0c0c0d] hover:bg-[#0c0c0d]/80"
                }`}
              >
                {/* Icon wrapper */}
                <div className="p-2.5 bg-[#0c0c0d] border border-[#2a2c32] rounded-xl shrink-0 text-slate-350">
                  <IconComponent className="w-4 h-4" />
                </div>

                {/* Info */}
                <div className="flex-1 pr-8">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white tracking-wide">{dest.label}</span>
                    {dest.badge && (
                      <span className="text-[8px] px-1.5 py-0.5 bg-[#22c55e]/10 border border-[#22c55e]/25 text-[#22c55e] font-bold uppercase rounded font-mono tracking-wide scale-95 shrink-0">
                        {dest.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight mt-1">
                    {dest.description}
                  </p>
                </div>

                {/* Right arrow or Check indicator */}
                <div className="absolute right-4 text-slate-500">
                  {isSuggested ? (
                    <Check className="w-4.5 h-4.5 text-[#22c55e] shrink-0" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
                  )}
                </div>

              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
