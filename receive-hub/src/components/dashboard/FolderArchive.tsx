import React, { useState } from "react";
import { Folder, FolderPlus, Trash2, ChevronRight, Clipboard, Edit3, FolderX, BookOpen } from "lucide-react";
import { Dashboard } from "../../types";

interface FolderArchiveProps {
  dashboards: Dashboard[];
  onSelectDashboard: (dash: Dashboard) => void;
  onDeleteDashboard: (id: string) => void;
  onDuplicateDashboard: (dash: Dashboard) => void;
  onOpenDashboardInReader?: (dash: Dashboard) => void;
  onNotify: (msg: string, status: "success" | "error" | "info" | "warning") => void;
  isLight?: boolean;
}

export default function FolderArchive({
  dashboards,
  onSelectDashboard,
  onDeleteDashboard,
  onDuplicateDashboard,
  onOpenDashboardInReader,
  onNotify,
  isLight = false,
}: FolderArchiveProps) {
  const [folders, setFolders] = useState<{ id: string; name: string }[]>(() => {
    try {
      const saved = localStorage.getItem("pocketflow.dashboard.folders");
      return saved ? JSON.parse(saved) : [
        { id: "f1", name: "Executive Statistics" },
        { id: "f2", name: "Bluetooth Intake Logs" },
        { id: "f3", name: "Operational Feeds" },
      ];
    } catch {
      return [];
    }
  });

  const [expandedFolder, setExpandedFolder] = useState<string | null>("f1");
  const [newFolderName, setNewFolderName] = useState("");
  const [isAddingFolder, setIsAddingFolder] = useState(false);

  // Map each dashboard to a folder. If never mapped, standard fallback (first folder or general)
  const [dashboardFolderMap, setDashboardFolderMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("pocketflow.dashboard.foldermap");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const saveFolderMap = (newMap: Record<string, string>) => {
    setDashboardFolderMap(newMap);
    localStorage.setItem("pocketflow.dashboard.foldermap", JSON.stringify(newMap));
  };

  const saveFolders = (newFolders: typeof folders) => {
    setFolders(newFolders);
    localStorage.setItem("pocketflow.dashboard.folders", JSON.stringify(newFolders));
  };

  const handleAddFolder = () => {
    if (!newFolderName.trim()) return;
    const newId = "f_" + Math.random().toString(36).substring(2, 9);
    const updated = [...folders, { id: newId, name: newFolderName.trim() }];
    saveFolders(updated);
    setNewFolderName("");
    setIsAddingFolder(false);
    onNotify("Folder created successfully!", "success");
  };

  const handleDeleteFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = folders.filter((f) => f.id !== id);
    saveFolders(updated);
    // relocate mapped dashboards
    const newMap = { ...dashboardFolderMap };
    Object.keys(newMap).forEach((key) => {
      if (newMap[key] === id) {
        delete newMap[key];
      }
    });
    saveFolderMap(newMap);
    onNotify("Folder deleted successfully", "info");
  };

  const handleRemoveFromFolder = (dashboardId: string) => {
    const newMap = { ...dashboardFolderMap };
    delete newMap[dashboardId];
    saveFolderMap(newMap);
    onNotify("Dashboard removed from folder grouping", "info");
  };

  return (
    <div className="space-y-4 select-none">
      <div className="flex items-center justify-between">
        <h3 className={`text-xs font-mono font-bold uppercase tracking-wider ${isLight ? "text-slate-800" : "text-amber-500"}`}>
          Grouped Repositories
        </h3>
        <button
          onClick={() => setIsAddingFolder(!isAddingFolder)}
          className={`flex items-center gap-1 text-[10px] font-mono font-bold border rounded-lg px-2 py-1 transition cursor-pointer ${
            isLight
              ? "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
              : "bg-[#0c0c0d] hover:bg-[#151619] border-[#2a2c32] text-slate-400 hover:text-white"
          }`}
        >
          <FolderPlus className="w-3 h-3 text-amber-500" /> New Folder
        </button>
      </div>

      {isAddingFolder && (
        <div className={`p-3 rounded-xl border space-y-2 animate-fade-in ${isLight ? "bg-slate-50 border-slate-200" : "bg-[#0c0c0d] border-[#2a2c32]"}`}>
          <label className="text-[8.5px] font-mono uppercase tracking-widest text-slate-500 block">Directory Label</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g. Finances..."
              className={`w-full text-xs font-mono py-1.5 px-2.5 rounded-lg border focus:outline-none ${
                isLight
                  ? "bg-white border-slate-300 focus:border-amber-500"
                  : "bg-zinc-900 border-[#2a2c32] text-white focus:border-amber-500/50"
              }`}
            />
            <button
              onClick={handleAddFolder}
              className="px-3 bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-mono font-bold rounded-lg transition"
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Folders List */}
      <div className="space-y-2">
        {folders.map((folder) => {
          // Find dashboards belonging to this folder. 
          // If folder id is "f1", we also assign unmapped dashboards to "f1" for easy onboarding!
          const belongs = dashboards.filter((d) => {
            const fId = dashboardFolderMap[d.id];
            return fId === folder.id || (!fId && folder.id === "f1");
          });

          const isExpanded = expandedFolder === folder.id;

          return (
            <div
              key={folder.id}
              className={`rounded-xl border overflow-hidden ${
                isLight ? "bg-white border-slate-200" : "bg-[#151619] border-[#2a2c32]"
              }`}
            >
              <div
                onClick={() => setExpandedFolder(isExpanded ? null : folder.id)}
                className={`p-3 flex items-center justify-between cursor-pointer hover:bg-opacity-80 transition ${
                  isLight ? "bg-slate-50 hover:bg-slate-100" : "bg-[#131417] hover:bg-[#151619]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-amber-500 fill-amber-500/10 shrink-0" />
                  <span className={`text-[11.5px] font-mono font-bold ${isLight ? "text-slate-800" : "text-white"}`}>
                    {folder.name}
                  </span>
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                    isLight ? "bg-slate-200 text-slate-600" : "bg-[#0c0c0d] text-slate-400"
                  }`}>
                    {belongs.length}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {folder.id !== "f1" && (
                    <button
                      onClick={(e) => handleDeleteFolder(folder.id, e)}
                      className="p-1 hover:text-red-400 text-slate-500 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <ChevronRight className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`} />
                </div>
              </div>

              {isExpanded && (
                <div className={`p-2 space-y-1.5 border-t border-dashed ${
                  isLight ? "border-slate-100 bg-slate-50/55" : "border-[#2a2c32] bg-[#0c0c0d]/35"
                }`}>
                  {belongs.length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic p-3 text-center">
                      Folder is empty. Open "Create" to build some dashboards!
                    </p>
                  ) : (
                    belongs.map((dash) => (
                      <div
                        key={dash.id}
                        className={`p-3 rounded-lg border group transition-all duration-100 ${
                          isLight
                            ? "bg-white hover:bg-slate-100/50 border-slate-200"
                            : "bg-[#0c0c0d] hover:bg-zinc-900 border-[#2a2c32]/50 hover:border-[#2a2c32]"
                        }`}
                      >
                        <div onClick={() => onSelectDashboard(dash)} className="cursor-pointer min-w-0 space-y-0.5 select-none">
                          <h4 className={`text-[11.5px] font-mono font-bold truncate ${isLight ? "text-slate-900" : "text-white group-hover:text-amber-400"}`}>
                            {dash.title}
                          </h4>
                          <p className="text-[9px] text-slate-500 truncate">{dash.description}</p>
                          <div className="flex flex-wrap gap-1 mt-0.5 whitespace-nowrap">
                            <span className={`text-[8px] font-mono px-1 py-0.2 rounded border ${
                              isLight ? "bg-slate-100 border-slate-200 text-slate-600" : "bg-[#151619] border-zinc-800 text-slate-400"
                            }`}>
                              {dash.blocks.length} elements
                            </span>
                            {dash.tags.slice(0, 2).map((tag, i) => (
                              <span key={i} className={`text-[8px] font-mono px-1 py-0.2 rounded border uppercase tracking-wider ${
                                isLight ? "bg-amber-100/80 border-amber-200 text-amber-700" : "bg-amber-500/10 border-amber-500/20 text-amber-500"
                              }`}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Interactive operations */}
                        <div
                          style={{ display: "grid", gridTemplateColumns: "36px 36px 36px 36px 36px minmax(0, 1fr)", gap: 6, alignItems: "center" }}
                          className="mt-3 select-none"
                        >
                          <button
                            type="button"
                            onClick={() => onSelectDashboard(dash)}
                            title="Edit dashboard"
                            style={{ width: 36, height: 36, minWidth: 36 }}
                            className={`h-9 rounded-lg border transition hover:scale-105 cursor-pointer grid place-items-center ${
                              isLight ? "border-slate-200 hover:bg-slate-200 text-slate-600" : "border-zinc-800 hover:bg-zinc-900 text-slate-400 hover:text-amber-400"
                            }`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenDashboardInReader?.(dash)}
                            title="Open in Reader"
                            style={{ width: 36, height: 36, minWidth: 36 }}
                            className={`h-9 rounded-lg border transition hover:scale-105 cursor-pointer grid place-items-center ${
                              isLight ? "border-slate-200 hover:bg-slate-200 text-slate-600" : "border-zinc-800 hover:bg-zinc-900 text-slate-400 hover:text-[#22c55e]"
                            }`}
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onDuplicateDashboard(dash)}
                            title="Duplicate dashboard"
                            style={{ width: 36, height: 36, minWidth: 36 }}
                            className={`h-9 rounded-lg border transition hover:scale-105 cursor-pointer grid place-items-center ${
                              isLight ? "border-slate-200 hover:bg-slate-200 text-slate-600" : "border-zinc-800 hover:bg-zinc-900 text-slate-400"
                            }`}
                          >
                            <Clipboard className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveFromFolder(dash.id)}
                            title="Remove from folder"
                            style={{ width: 36, height: 36, minWidth: 36 }}
                            className={`h-9 rounded-lg border transition hover:scale-105 cursor-pointer grid place-items-center ${
                              isLight ? "border-slate-200 hover:bg-slate-200 text-slate-600" : "border-zinc-800 hover:bg-zinc-900 text-slate-400 hover:text-amber-400"
                            }`}
                          >
                            <FolderX className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete "${dash.title}"?`)) {
                                onDeleteDashboard(dash.id);
                              }
                            }}
                            title="Delete dashboard"
                            style={{ width: 36, height: 36, minWidth: 36 }}
                            className={`h-9 rounded-lg border transition hover:scale-105 cursor-pointer grid place-items-center ${
                              isLight ? "border-red-200 hover:bg-red-50 text-red-500" : "border-red-500/25 bg-red-500/5 hover:bg-red-500/10 text-red-400"
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          
                          <select
                            style={{ height: 36, minWidth: 0 }}
                            value={dashboardFolderMap[dash.id] || "f1"}
                            onChange={(e) => {
                              const updatedMap = { ...dashboardFolderMap, [dash.id]: e.target.value };
                              saveFolderMap(updatedMap);
                              onNotify("Relocated dashboard direction", "success");
                            }}
                            className={`min-w-0 h-9 text-[9.5px] font-mono px-2 rounded-lg border focus:outline-none ${
                              isLight ? "bg-white border-slate-200 text-slate-600" : "bg-black border-zinc-800 text-slate-400"
                            }`}
                          >
                            {folders.map((f) => (
                              <option key={f.id} value={f.id}>
                                Move to {f.name.slice(0, 10)}...
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
