import React, { useEffect, useState } from "react";
import type { ReceivedFile } from "./types";
import ArchivePublicApp from "./components/ArchivePublicApp";
import { getFileExtension, sanitizeFileName } from "./utils/fileValidation";
import { getAllFiles, initDB, saveFileBlob, saveFileMetadata } from "./utils/storage";

export default function App() {
  const [files, setFiles] = useState<ReceivedFile[]>([]);
  const [activeFile, setActiveFile] = useState<ReceivedFile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    initDB()
      .then(getAllFiles)
      .then((storedFiles) => {
        if (mounted) setFiles(storedFiles);
      })
      .catch(() => {
        if (mounted) setFiles([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const uploadArchiveFile = async (rawFile: File) => {
    const extension = getFileExtension(rawFile.name);
    const timestamp = new Date().toISOString();
    const record: ReceivedFile = {
      id: `public_archive_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: rawFile.name,
      safeName: sanitizeFileName(rawFile.name),
      extension,
      mimeType: rawFile.type || "application/octet-stream",
      category: extension === "zip" ? "archive" : rawFile.type.startsWith("image/") ? "image" : "document",
      size: rawFile.size,
      source: "filePicker",
      status: "accepted",
      suggestedDestination: "genericStorage",
      folderPath: "/inbox",
      receivedAt: timestamp,
      acceptedAt: timestamp,
      metadata: {
        tracker: { code: `PUB-${extension || "FILE"}`, label: "Public demo import" },
      },
      auditLog: [
        { type: "file.detected", at: timestamp, detail: "Imported in public Archive demo" },
        { type: "file.accepted", at: timestamp, detail: "Stored in public Archive demo" },
      ],
    };
    await saveFileBlob(record.id, rawFile);
    await saveFileMetadata(record);
    const nextFiles = await getAllFiles();
    setFiles(nextFiles);
    setActiveFile(record);
    setNotice("File added to public Archive demo.");
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#080f0c]">
      {notice && (
        <div className="border-b border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-100">
          {notice}
        </div>
      )}
      <ArchivePublicApp
        files={files}
        activeFile={activeFile}
        onSelectFile={setActiveFile}
        onUploadFile={(file) => void uploadArchiveFile(file)}
        onSaveTextEdit={async () => setNotice("Text saving is handled by the full PocketFlow shell.")}
        onNotify={(message) => setNotice(message)}
      />
    </main>
  );
}
