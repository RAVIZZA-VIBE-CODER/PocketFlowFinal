/**
 * Public competition shell for PocketFlowFinal.
 * Private phone-only apps, contacts, wallet state and live sending bridges are intentionally excluded.
 */
import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bot,
  BookOpen,
  Cable,
  FileCode2,
  Globe2,
  Map,
  MessageSquareText,
  Newspaper,
  RadioTower,
  TerminalSquare,
} from "lucide-react";
import type { ReceivedFile } from "./types";
import type { PocketFlowAppId, SpinoSystemActionResult } from "./utils/spinoTools";
import { getAllFiles, initDB, saveFileBlob, saveFileMetadata } from "./utils/storage";
import { getFileExtension, sanitizeFileName } from "./utils/fileValidation";
import { publicReleaseStateIsCurrent, resetPublicReleaseBrowserState } from "./utils/publicRelease";
import "./index.css";

const BuilderApp = lazy(() => import("./components/BuilderApp"));
const ArchivePublicApp = lazy(() => import("./components/ArchivePublicApp"));
const SpinoLLMApp = lazy(() => import("./components/SpinoLLMApp"));
const CalenotesApp = lazy(() => import("./components/CalenotesApp"));
const NewsFlowApp = lazy(() => import("./components/NewsFlowApp"));
const MoltbookAgentApp = lazy(() => import("./components/MoltbookAgentApp"));
const RelayApp = lazy(() => import("./components/RelayApp"));
const SecondScreenApp = lazy(() => import("./components/SecondScreenApp"));
const TerminalApp = lazy(() => import("./components/TerminalApp"));
const PocketWebApp = lazy(() => import("./components/PocketWebApp"));
const SystemMapApp = lazy(() => import("./components/SystemMapApp"));

type PublicAppId =
  | "systemmap"
  | "spino"
  | "builder"
  | "archive"
  | "notes"
  | "news"
  | "moltbook"
  | "relay"
  | "secondscreen"
  | "terminal"
  | "pocketweb";

const PUBLIC_APP_IDS = new Set<string>([
  "systemmap",
  "spino",
  "builder",
  "archive",
  "receive",
  "reader",
  "notes",
  "calendar",
  "news",
  "moltbook",
  "relay",
  "secondscreen",
  "terminal",
  "pocketweb",
]);

const PUBLIC_NAV_APP_IDS = new Set<string>([
  "systemmap",
  "spino",
  "builder",
  "archive",
  "notes",
  "news",
  "moltbook",
  "relay",
  "secondscreen",
  "terminal",
  "pocketweb",
]);

const normalizePublicAppId = (appId: string | null): PublicAppId => {
  const normalized = appId === "receive" || appId === "reader"
    ? "archive"
    : appId === "calendar"
      ? "notes"
      : appId || "";
  return PUBLIC_NAV_APP_IDS.has(normalized)
    ? normalized as PublicAppId
    : "systemmap";
};

const initialPublicAppId = (): PublicAppId => {
  if (typeof window === "undefined") return "systemmap";
  return normalizePublicAppId(new URLSearchParams(window.location.search).get("app"));
};

const apps: Array<{ id: PublicAppId; label: string; detail: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "systemmap", label: "Router", detail: "Baloss panel and system map", icon: Map },
  { id: "spino", label: "Baloss LLM", detail: "Local model, memory and tools", icon: Bot },
  { id: "builder", label: "Builder", detail: "Competition build blocks", icon: FileCode2 },
  { id: "archive", label: "Archive", detail: "Reader, files and packages", icon: Archive },
  { id: "notes", label: "MemoPad", detail: "Notes, tasks and calendar", icon: MessageSquareText },
  { id: "news", label: "NewsFlow", detail: "Sanitized newsletter builder", icon: Newspaper },
  { id: "moltbook", label: "Notebook Agent", detail: "Agent posting interface template", icon: BookOpen },
  { id: "relay", label: "Screen Relay", detail: "Codex relay cockpit", icon: RadioTower },
  { id: "secondscreen", label: "Display", detail: "Second-screen viewer", icon: Cable },
  { id: "terminal", label: "Terminal", detail: "Phone terminal surface", icon: TerminalSquare },
  { id: "pocketweb", label: "Web", detail: "Pocket web workspace", icon: Globe2 },
];

const Loading = () => (
  <div className="flex flex-1 items-center justify-center bg-[#08100d] text-emerald-100">
    Loading PocketFlow module...
  </div>
);

const createPublicFileRecord = async (file: File): Promise<ReceivedFile> => {
  const now = new Date().toISOString();
  const safeName = sanitizeFileName(file.name);
  const record: ReceivedFile = {
    id: `public-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: file.name,
    safeName,
    extension: getFileExtension(file.name),
    mimeType: file.type || "application/octet-stream",
    category: "unknownSafe",
    size: file.size,
    source: "filePicker",
    status: "accepted",
    suggestedDestination: "genericStorage",
    receivedAt: now,
    acceptedAt: now,
    auditLog: [{ type: "file.accepted", at: now, detail: "Imported in public competition shell." }],
  };
  await saveFileMetadata(record);
  await saveFileBlob(record.id, file);
  return record;
};

export default function App() {
  const [currentApp, setCurrentApp] = useState<PublicAppId>(initialPublicAppId);
  const [files, setFiles] = useState<ReceivedFile[]>([]);
  const [activeFile, setActiveFile] = useState<ReceivedFile | null>(null);
  const [notice, setNotice] = useState<{ message: string; type: "success" | "info" | "warn" | "error" } | null>(null);

  const activeMeta = useMemo(() => apps.find((app) => app.id === currentApp) || apps[0], [currentApp]);

  useEffect(() => {
    void (async () => {
      if (!publicReleaseStateIsCurrent()) await resetPublicReleaseBrowserState();
      await initDB();
      return getAllFiles();
    })()
      .then(setFiles)
      .catch(() => setFiles([]));
  }, []);

  const notify = (message: string, type: "success" | "info" | "warn" | "error" = "info") => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 3200);
  };

  const openApp = (appId: PublicAppId) => {
    setCurrentApp(appId);
    if (typeof window === "undefined") return;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("app", appId);
    window.history.replaceState(null, "", nextUrl);
  };

  const openPublicApp = (appId: PocketFlowAppId): SpinoSystemActionResult => {
    const normalized = appId === "receive" || appId === "reader" ? "archive" : appId === "calendar" ? "notes" : appId;
    if (!PUBLIC_APP_IDS.has(normalized)) {
      return { ok: false, response: "That app is private-only in PocketFlowFinal." };
    }
    openApp(normalized as PublicAppId);
    return { ok: true, openedApp: appId, response: `Opened ${normalized}.` };
  };

  const uploadArchiveFile = async (file: File) => {
    const record = await createPublicFileRecord(file);
    setFiles((current) => [record, ...current.filter((item) => item.id !== record.id)]);
    setActiveFile(record);
    notify("File imported into the public Archive shell.", "success");
  };

  return (
    <div className="pf-public-preview-stage bg-[#07100c] text-white">
      <div className="pf-public-phone-frame" aria-label="Android phone preview">
        <div className="pf-public-phone-speaker" aria-hidden="true" />
        <div className="pf-public-phone-screen">
          <div className="flex h-full min-h-0 w-full flex-col bg-[#07100c]">
        <header className="sticky top-0 z-40 border-b border-emerald-300/15 bg-[#07100c]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight">{activeMeta.label}</h1>
            </div>
            <div className="hidden rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-bold text-emerald-100 sm:block">
              Public competition build / private data removed
            </div>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {apps.map((app) => {
              const Icon = app.icon;
              const active = app.id === currentApp;
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => openApp(app.id)}
                  className={`flex min-w-[104px] items-center gap-2 rounded-2xl border px-3 py-2 text-left transition ${active ? "border-emerald-300 bg-emerald-300 text-[#07100c]" : "border-white/10 bg-white/[0.04] text-slate-200 hover:border-emerald-200/50"}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-[0.16em]">{app.label}</span>
                </button>
              );
            })}
          </nav>
        </header>

        {notice && (
          <div className="mx-4 mt-3 rounded-2xl border border-emerald-300/20 bg-[#0e1b15] px-4 py-3 text-sm font-semibold text-emerald-50">
            {notice.message}
          </div>
        )}

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Suspense fallback={<Loading />}>
            {currentApp === "systemmap" && <SystemMapApp onNotify={(message, type) => notify(message, type)} onOpenApp={(appId) => openPublicApp(appId)} />}
            {currentApp === "spino" && <SpinoLLMApp onNotify={(message, type) => notify(message, type)} onSystemAction={openPublicApp} />}
            {currentApp === "builder" && <BuilderApp onNotify={(message, type) => notify(message, type)} />}
            {currentApp === "archive" && (
              <ArchivePublicApp
                files={files}
                activeFile={activeFile}
                onSelectFile={setActiveFile}
                onUploadFile={(file) => void uploadArchiveFile(file)}
                onSaveTextEdit={async () => notify("Text save is available in the full phone build.", "info")}
                onNotify={(message, type) => notify(message, type)}
              />
            )}
            {currentApp === "notes" && <CalenotesApp onNotify={(message, type) => notify(message, type)} />}
            {currentApp === "news" && <NewsFlowApp onNotify={(message, type) => notify(message, type)} />}
            {currentApp === "moltbook" && <MoltbookAgentApp onNotify={(message, type) => notify(message, type)} />}
            {currentApp === "relay" && <RelayApp bridgeAvailable={false} origin={window.location.origin} onNotify={(message, type) => notify(message, type)} />}
            {currentApp === "secondscreen" && <SecondScreenApp onNotify={(message, type) => notify(message, type)} />}
            {currentApp === "terminal" && <TerminalApp />}
            {currentApp === "pocketweb" && <PocketWebApp onNotify={(message, type) => notify(message, type)} />}
          </Suspense>
        </main>
          </div>
        </div>
      </div>
    </div>
  );
}
