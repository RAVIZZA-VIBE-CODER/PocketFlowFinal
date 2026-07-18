/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReceivedFile, ReceiveSettings, StorageFolder } from "../types";
import { withArchiveTrackerMetadata } from "./archiveTracking";

const STORAGE_PREFIX = "pocketflowFinal.public";
const DB_NAME = "PocketFlowFinalPublicDB";
const DB_VERSION = 1;
const STORE_INBOX = "inbox";
const STORE_BLOBS = "fileBlobs";
const INBOX_KEY = `${STORAGE_PREFIX}.receiveHub.inbox`;
const FOLDERS_KEY = `${STORAGE_PREFIX}.receiveHub.folders`;
const SETTINGS_KEY = `${STORAGE_PREFIX}.receiveHub.settings`;
const BUILDER_PROJECTS_KEY = `${STORAGE_PREFIX}.builder.projects`;
const DASHBOARD_LIST_KEY = `${STORAGE_PREFIX}.dashboard.list`;

let dbInstance: IDBDatabase | null = null;
let useLocalStorageFallback = false;

// Fallback registry for blobs in memory
const memoryBlobRegistry = new Map<string, Blob>();

/**
 * Initialize IndexedDB with graceful fallback.
 */
export async function initDB(): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (!window.indexedDB) {
        console.warn("IndexedDB not supported in this environment. Falling back to localStorage.");
        useLocalStorageFallback = true;
        resolve();
        return;
      }

      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_INBOX)) {
          db.createObjectStore(STORE_INBOX, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_BLOBS)) {
          db.createObjectStore(STORE_BLOBS);
        }
      };

      request.onsuccess = (event) => {
        dbInstance = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        console.warn("IndexedDB permission blocked or error occurred. Falling back to localStorage.", event);
        useLocalStorageFallback = true;
        resolve();
      };
    } catch (err) {
      console.warn("Exception during IndexedDB initialization. Falling back to localStorage.", err);
      useLocalStorageFallback = true;
      resolve();
    }
  });
}

/**
 * Get all files from storage.
 */
export async function getAllFiles(): Promise<ReceivedFile[]> {
  if (useLocalStorageFallback || !dbInstance) {
    try {
      const data = localStorage.getItem(INBOX_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  return new Promise((resolve) => {
    try {
      const transaction = dbInstance!.transaction(STORE_INBOX, "readonly");
      const store = transaction.objectStore(STORE_INBOX);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        resolve([]);
      };
    } catch {
      resolve([]);
    }
  });
}

export function getStorageFolders(): StorageFolder[] {
  try {
    const data = localStorage.getItem(FOLDERS_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}

  const now = new Date().toISOString();
  const defaults: StorageFolder[] = [
    { id: "folder_root", name: "Inbox Root", path: "/", parentPath: null, createdAt: now, updatedAt: now },
    { id: "folder_assets", name: "Assets", path: "/assets", parentPath: "/", createdAt: now, updatedAt: now },
    { id: "folder_projects", name: "Projects", path: "/projects", parentPath: "/", createdAt: now, updatedAt: now }
  ];
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(defaults));
  return defaults;
}

export function saveStorageFolders(folders: StorageFolder[]): void {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

export function createStorageFolder(name: string, parentPath: string | null = "/"): StorageFolder {
  const folders = getStorageFolders();
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "folder";
  const basePath = parentPath && parentPath !== "/" ? `${parentPath}/${slug}` : `/${slug}`;
  let path = basePath;
  let counter = 2;
  while (folders.some((f) => f.path === path)) {
    path = `${basePath}-${counter++}`;
  }
  const now = new Date().toISOString();
  return { id: `folder_${Math.random().toString(36).slice(2, 10)}`, name: name.trim(), path, parentPath, createdAt: now, updatedAt: now };
}

export function updateStorageFolder(folderPath: string, patch: Partial<Pick<StorageFolder, "name" | "parentPath">>): StorageFolder[] {
  const folders = getStorageFolders();
  const next = folders.map((folder) => {
    if (folder.path !== folderPath) return folder;
    const updatedAt = new Date().toISOString();
    const name = patch.name ?? folder.name;
    const parentPath = patch.parentPath ?? folder.parentPath;
    const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "folder";
    const newPath = parentPath && parentPath !== "/" ? `${parentPath}/${slug}` : `/${slug}`;
    return { ...folder, name, parentPath, path: newPath, updatedAt };
  });
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(next));
  return next;
}

export function deleteStorageFolder(folderPath: string): StorageFolder[] {
  const folders = getStorageFolders().filter((folder) => folder.path !== folderPath && !folder.path.startsWith(`${folderPath}/`));
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  return folders;
}

export async function updateFileFolderPath(fileId: string, folderPath: string): Promise<void> {
  const files = await getAllFiles();
  const updated = files.map((file) => file.id === fileId ? withArchiveTrackerMetadata({ ...file, folderPath }) : file);
  if (useLocalStorageFallback || !dbInstance) {
    localStorage.setItem(INBOX_KEY, JSON.stringify(updated));
    return;
  }
  return new Promise((resolve, reject) => {
    try {
      const transaction = dbInstance!.transaction(STORE_INBOX, "readwrite");
      const store = transaction.objectStore(STORE_INBOX);
      updated.forEach((file) => store.put(file));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Save file metadata.
 */
export async function saveFileMetadata(file: ReceivedFile): Promise<void> {
  const trackedFile = withArchiveTrackerMetadata(file);
  // Always synchronize to localStorage just in case, but rely on DB primarily
  if (useLocalStorageFallback || !dbInstance) {
    try {
      const current = await getAllFiles();
      const updated = current.filter((f) => f.id !== trackedFile.id);
      updated.push(trackedFile);
      localStorage.setItem(INBOX_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Local storage update failed", e);
    }
    return;
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = dbInstance!.transaction(STORE_INBOX, "readwrite");
      const store = transaction.objectStore(STORE_INBOX);
      const request = store.put(trackedFile);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Save binary file blob.
 */
export async function saveFileBlob(id: string, blob: Blob): Promise<void> {
  // Always register in-memory
  memoryBlobRegistry.set(id, blob);

  if (useLocalStorageFallback || !dbInstance) {
    return; // Cannot persistently store huge binaries in LocalStorage securely without hitting quotas
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = dbInstance!.transaction(STORE_BLOBS, "readwrite");
      const store = transaction.objectStore(STORE_BLOBS);
      const request = store.put(blob, id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Get binary file blob.
 */
export async function getFileBlob(id: string): Promise<Blob | null> {
  // First check in-memory cache (works perfectly during active session/previews)
  if (memoryBlobRegistry.has(id)) {
    return memoryBlobRegistry.get(id) || null;
  }

  if (useLocalStorageFallback || !dbInstance) {
    return null;
  }

  return new Promise((resolve) => {
    try {
      const transaction = dbInstance!.transaction(STORE_BLOBS, "readonly");
      const store = transaction.objectStore(STORE_BLOBS);
      const request = store.get(id);

      request.onsuccess = () => {
        const blob = request.result as Blob | undefined;
        if (blob) {
          // Cache in memory for speed
          memoryBlobRegistry.set(id, blob);
          resolve(blob);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

function blobFromBase64(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType || "application/octet-stream" });
}

function nativeFileLocator(file: ReceivedFile): string {
  const metadata = file.metadata || {};
  return (
    file.appPrivateUri ||
    file.nativeUri ||
    (typeof metadata.nativePath === "string" ? metadata.nativePath : "") ||
    (typeof metadata.path === "string" ? metadata.path : "") ||
    (typeof metadata.nativeUri === "string" ? metadata.nativeUri : "")
  );
}

/**
 * Get binary blob for a stored file, including files saved by the Android Archive bridge.
 */
export async function getFileBlobForRecord(file: ReceivedFile): Promise<Blob | null> {
  const storedBlob = await getFileBlob(file.id);
  const expectedSize = Math.max(0, Number(file.size || 0));
  if (storedBlob && (expectedSize <= 0 || storedBlob.size >= expectedSize)) return storedBlob;

  const locator = nativeFileLocator(file);
  const nativeReader = window.PocketFlowReceiveBridge?.readNativeDownloadedFile;
  if (!locator || !nativeReader) return storedBlob || null;

  try {
    const result = await nativeReader(locator);
    if (!result?.ok || !result.base64) return null;
    const blob = blobFromBase64(result.base64, result.mimeType || file.mimeType || "application/octet-stream");
    if (expectedSize > 0 && blob.size < expectedSize) return storedBlob || null;
    await saveFileBlob(file.id, blob);
    return blob;
  } catch {
    return storedBlob || null;
  }
}

/**
 * Delete file.
 */
export async function deleteFileFromStorage(id: string): Promise<void> {
  memoryBlobRegistry.delete(id);

  if (useLocalStorageFallback || !dbInstance) {
    try {
      const current = await getAllFiles();
      const updated = current.filter((f) => f.id !== id);
      localStorage.setItem(INBOX_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
    return;
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = dbInstance!.transaction([STORE_INBOX, STORE_BLOBS], "readwrite");
      
      const inboxStore = transaction.objectStore(STORE_INBOX);
      inboxStore.delete(id);

      const blobStore = transaction.objectStore(STORE_BLOBS);
      blobStore.delete(id);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Clear inbox storage.
 */
export async function clearInboxFromStorage(): Promise<void> {
  memoryBlobRegistry.clear();

  if (useLocalStorageFallback || !dbInstance) {
    localStorage.removeItem(INBOX_KEY);
    return;
  }

  return new Promise((resolve, reject) => {
    try {
      const transaction = dbInstance!.transaction([STORE_INBOX, STORE_BLOBS], "readwrite");
      
      const inboxStore = transaction.objectStore(STORE_INBOX);
      inboxStore.clear();

      const blobStore = transaction.objectStore(STORE_BLOBS);
      blobStore.clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Save settings.
 */
export function saveSettings(settings: ReceiveSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error(e);
  }
}

/**
 * Load settings.
 */
export function loadSettings(): ReceiveSettings {
  const defaults: ReceiveSettings = {
    requireAcceptBeforeSave: true,
    keepDeclinedHistory: true,
    autoSuggestDestination: true,
    maxSingleFileMb: 50,
    maxBatchSizeMb: 150,
    maxFilesPerBatch: 10,
    allowUnknownSafeFiles: true,
    enableDebugSimulation: true
  };

  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    return data ? { ...defaults, ...JSON.parse(data) } : defaults;
  } catch {
    return defaults;
  }
}

// ==========================================
// Builder Storage Helpers
// ==========================================

export function getAllBuilderProjects(): import("../types").BuilderProject[] {
  try {
    const data = localStorage.getItem(BUILDER_PROJECTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveBuilderProject(project: import("../types").BuilderProject): void {
  try {
    const projects = getAllBuilderProjects();
    const updated = projects.filter((p) => p.id !== project.id);
    updated.push(project);
    localStorage.setItem(BUILDER_PROJECTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save builder project", e);
  }
}

export function deleteBuilderProject(id: string): void {
  try {
    const projects = getAllBuilderProjects();
    const updated = projects.filter((p) => p.id !== id);
    localStorage.setItem(BUILDER_PROJECTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to delete builder project", e);
  }
}

// ==========================================
// Dashboard Storage Helpers
// ==========================================

export function getAllDashboards(): import("../types").Dashboard[] {
  try {
    const data = localStorage.getItem(DASHBOARD_LIST_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveDashboard(dashboard: import("../types").Dashboard): void {
  try {
    const dashboards = getAllDashboards();
    const updated = dashboards.filter((d) => d.id !== dashboard.id);
    updated.push(dashboard);
    localStorage.setItem(DASHBOARD_LIST_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to save dashboard", e);
  }
}

export function deleteDashboard(id: string): void {
  try {
    const dashboards = getAllDashboards();
    const updated = dashboards.filter((d) => d.id !== id);
    localStorage.setItem(DASHBOARD_LIST_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("Failed to delete dashboard", e);
  }
}
