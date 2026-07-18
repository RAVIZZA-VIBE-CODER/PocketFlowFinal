/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ReceiveStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "blocked"
  | "imported"
  | "failed"
  | "deleted";

export type FileCategory =
  | "dashboard"
  | "builderPackage"
  | "image"
  | "markdown"
  | "csv"
  | "document"
  | "archive"
  | "text"
  | "unknownSafe"
  | "blocked";

export type ImportDestination =
  | "dashboardStudio"
  | "pocketFlowBuilder"
  | "assetsLibrary"
  | "notes"
  | "genericStorage"
  | "keepInInbox";

export interface AuditLogEntry {
  type:
    | "file.detected"
    | "file.validated"
    | "file.blocked"
    | "file.accepted"
    | "file.declined"
    | "file.previewed"
    | "file.importSuggested"
    | "file.imported"
    | "file.deleted"
    | "native.bridgeEvent"
    | "native.saveAccepted"
    | "error";
  at: string;
  detail?: string;
}

export interface ReceivedFile {
  id: string;
  name: string;
  safeName: string;
  extension: string;
  mimeType: string;
  category: FileCategory;
  size: number;
  source:
    | "filePicker"
    | "dragDrop"
    | "androidShare"
    | "bluetoothFolder"
    | "downloadsFolder"
    | "externalDrive"
    | "nearby"
    | "debug";
  sourceDeviceName?: string;
  status: ReceiveStatus;
  suggestedDestination: ImportDestination;
  folderPath?: string;
  receivedAt: string;
  acceptedAt?: string;
  declinedAt?: string;
  importedAt?: string;
  deletedAt?: string;
  blockedReason?: string;
  failureReason?: string;
  objectUrl?: string; // used for runtime blob urls
  nativeUri?: string; // native source reference
  appPrivateUri?: string; // native storage destination
  metadata?: {
    dashboardTitle?: string;
    dashboardBlockCount?: number;
    builderProjectName?: string;
    builderBoxCount?: number;
    markdownTitle?: string;
    csvColumns?: string[];
    imageWidth?: number;
    imageHeight?: number;
    zipContainsManifest?: boolean;
    contentPreview?: string; // inline content for small md/text/json
    parsedJson?: unknown; // parsed content if JSON
    security?: {
      scanStatus?: "clean" | "suspected" | "quarantined" | "blocked" | "overridden";
      threatLevel?: "clean" | "low" | "medium" | "high" | "critical";
      scannedAt?: string;
      scanner?: string;
      reasons?: string[];
      recommendedAction?: string;
      ownerDecisionAt?: string;
      safeReaderRequired?: boolean;
    };
    [key: string]: unknown;
  };
  auditLog: AuditLogEntry[];
}

export interface StorageFolder {
  id: string;
  name: string;
  path: string;
  parentPath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NativeFilePayload {
  id: string;
  displayName: string;
  mimeType: string;
  size: number;
  extension?: string;
  source: "androidShare" | "bluetoothFolder" | "downloadsFolder" | "filePicker" | "nearby" | "externalDrive";
  sourceDeviceName?: string;
  nativeUri?: string;
  appPrivateUri?: string;
  receivedAt: string;
  metadata?: Record<string, unknown>;
}

export interface NativeStorageDrive {
  id: string;
  name: string;
  path: string;
  type: "internal" | "removable" | "app" | "unknown";
  removable?: boolean;
  readable?: boolean;
  writable?: boolean;
  totalBytes?: number;
  freeBytes?: number;
}

export interface NativeStorageEntry {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  lastModified: number;
  mimeType?: string;
  extension?: string;
}

export interface NativeStorageDirectoryListing {
  ok: boolean;
  rootPath?: string;
  path?: string;
  relativePath?: string;
  parentRelativePath?: string;
  entries?: NativeStorageEntry[];
  message?: string;
}

export type StorageModuleSlot = "encyclopedia" | "quick_backup" | "archive" | "transfer" | "other";

export interface StorageModulePreference {
  id: string;
  label: string;
  role: string;
  slot: StorageModuleSlot;
  favorite: boolean;
  status: "preferred" | "linked" | "offline" | "pending";
  driveName?: string;
  drivePath?: string;
  capacityLabel?: string;
  lastSeen?: string;
  notes?: string;
}

export interface NativeVoiceMemoResult {
  ok: boolean;
  recording?: boolean;
  fileName?: string;
  path?: string;
  nativeUri?: string;
  mimeType?: string;
  startedAt?: number;
  size?: number;
  durationMs?: number;
  message?: string;
}

export interface NativeMeetingFileResult {
  ok: boolean;
  fileName?: string;
  path?: string;
  nativeUri?: string;
  mimeType?: string;
  size?: number;
  message?: string;
}

export interface BridgePermissionResult {
  ok: boolean;
  granted: string[];
  denied: string[];
  message?: string;
}

export interface NativeDeviceStatus {
  ok: boolean;
  source: "android" | "web";
  model?: string;
  batteryPct?: number;
  batteryCharging?: boolean;
  chipTempC?: number;
  cpuTempC?: number;
  batteryTempC?: number;
  thermalStatus?: string;
  airplaneMode?: boolean;
  network?: {
    online: boolean;
    type?: string;
    name?: string;
    localIp?: string;
    downlinkMbps?: number;
    uplinkMbps?: number;
    pingMs?: number;
  };
  bluetooth?: {
    enabled: boolean;
    state?: string;
    name?: string;
  };
  message?: string;
}

declare global {
  interface Window {
    __pocketflowNativeShell?: boolean;
    PocketFlowReceiveBridge?: {
      isAvailable?: () => boolean;
      getDeviceStatus?: () => Promise<NativeDeviceStatus>;
      measureNetworkLink?: () => Promise<{
        ok: boolean;
        online: boolean;
        type?: string;
        name?: string;
        downlinkMbps?: number;
        uplinkMbps?: number;
        pingMs?: number;
        measuredAt?: string;
        message?: string;
      }>;
      getCurrentLocation?: () => Promise<{
        ok: boolean;
        lat?: number;
        lon?: number;
        accuracyMeters?: number;
        provider?: string;
        message?: string;
      }>;
      httpJsonGet?: (url: string) => Promise<{
        ok: boolean;
        status?: number;
        url?: string;
        body?: string;
        message?: string;
      }>;
      httpJsonPost?: (url: string, body: string, headersJson?: string) => Promise<{
        ok: boolean;
        status?: number;
        url?: string;
        body?: string;
        message?: string;
      }>;
      crmSync?: () => Promise<Record<string, unknown>>;
      crmSendEmail?: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
      requestReceivePermissions?: () => Promise<BridgePermissionResult>;
      openAndroidFilePicker?: () => Promise<NativeFilePayload[]>;
      listNativeReceivedFiles?: () => Promise<NativeFilePayload[]>;
      listStorageDrives?: () => Promise<{ ok: boolean; drives?: NativeStorageDrive[]; message?: string }>;
      listStorageDriveFiles?: (rootPath: string, relativePath?: string) => Promise<NativeStorageDirectoryListing>;
      listConnectedDevices?: () => Promise<Array<{
        id: string;
        name: string;
        detail?: string;
        kind?: string;
        status?: string;
        transport?: string;
      }>>;
      importNativeFile?: (fileId: string) => Promise<NativeFilePayload>;
      saveAcceptedFile?: (file: ReceivedFile) => Promise<{ ok: boolean; nativeUri?: string }>;
      readNativeDownloadedFile?: (uriOrPath: string) => Promise<{
        ok: boolean;
        fileName?: string;
        mimeType?: string;
        size?: number;
        base64?: string;
        message?: string;
      }>;
      saveWebDownload?: (name: string, mimeType: string, base64Data: string) => Promise<{
        ok: boolean;
        fileName?: string;
        mimeType?: string;
        size?: number;
        nativeUri?: string;
        path?: string;
        message?: string;
      }>;
      watchBluetoothFolder?: () => Promise<{ ok: boolean }>;
      requestBluetoothVisibility?: () => Promise<{ ok: boolean; message?: string }>;
      startBluetoothScan?: () => Promise<{ ok: boolean; enabled?: boolean; state?: string; message?: string; devices?: { name: string; address: string }[] }>;
      setBluetoothEnabled?: (enabled: boolean) => Promise<{ ok: boolean; enabled?: boolean; state?: string; message?: string; devices?: { name: string; address: string }[] }>;
      stopBluetoothSession?: () => Promise<{ ok: boolean; enabled?: boolean; state?: string; message?: string }>;
      setWifiEnabled?: (enabled: boolean) => Promise<{ ok: boolean; enabled?: boolean; state?: string; message?: string }>;
      setAirplaneMode?: (enabled: boolean) => Promise<{ ok: boolean; enabled?: boolean; state?: string; message?: string }>;
      openWifiSettings?: () => Promise<{ ok: boolean; message?: string }>;
      openBluetoothSettings?: () => Promise<{ ok: boolean; message?: string }>;
      openAirplaneModeSettings?: () => Promise<{ ok: boolean; message?: string }>;
      openNetworkSettings?: () => Promise<{ ok: boolean; message?: string }>;
      openHotspotSettings?: () => Promise<{ ok: boolean; message?: string }>;
      openSoundSettings?: () => Promise<{ ok: boolean; message?: string }>;
      enforceAudibleAlerts?: () => Promise<{ ok: boolean; message?: string; ringerMode?: number; ring?: number; notification?: number; alarm?: number }>;
      openAppsSettings?: () => Promise<{ ok: boolean; message?: string }>;
      openSystemSettings?: () => Promise<{ ok: boolean; message?: string }>;
      openStorageSettings?: () => Promise<{ ok: boolean; message?: string }>;
      openDeveloperSettings?: () => Promise<{ ok: boolean; message?: string }>;
      openDisplaySettings?: () => Promise<{ ok: boolean; message?: string }>;
      getFullControlStatus?: () => Promise<{
        ok: boolean;
        packageName?: string;
        runtimePermissions?: boolean;
        defaultHome?: boolean;
        allFiles?: boolean;
        accessibility?: boolean;
        usageAccess?: boolean;
        overlay?: boolean;
        writeSettings?: boolean;
        notifications?: boolean;
        batteryUnrestricted?: boolean;
        deviceAdmin?: boolean;
        deviceOwner?: boolean;
        lockTask?: boolean;
        automationReady?: boolean;
        automationLocked?: boolean;
        automationLockedAt?: number;
        osMaskReady?: boolean;
        pocketFlowOsMode?: boolean;
        nextPanel?: string;
        accessibilityWindow?: string;
        message?: string;
      }>;
      requestFullControlPermissions?: () => Promise<{ ok: boolean; message?: string }>;
      lockAutomationControl?: () => Promise<{ ok: boolean; automationLocked?: boolean; automationReady?: boolean; nextPanel?: string; message?: string }>;
      openFullControlPanel?: (panel: string) => Promise<{ ok: boolean; message?: string }>;
      applyPocketFlowSystemMask?: () => Promise<{ ok: boolean; message?: string }>;
      enablePocketFlowOsMode?: () => Promise<{ ok: boolean; osModeArmed?: boolean; nextPanel?: string; message?: string }>;
      startPocketFlowKioskMode?: () => Promise<{ ok: boolean; message?: string }>;
      getLaunchUrl?: () => Promise<{ ok: boolean; url?: string; message?: string }>;
      startBluetoothReceiver?: () => Promise<{ ok: boolean; message?: string }>;
      sendBluetoothPayload?: (payload: string) => Promise<{ ok: boolean; message?: string }>;
      shareText?: (title: string, text: string) => Promise<{ ok: boolean; message?: string }>;
      openUrlInMainWebView?: (url: string) => Promise<{ ok: boolean; message?: string }>;
      setSecondDisplayOrientation?: (mode: "portrait" | "landscape" | "sensor" | "auto") => Promise<{ ok: boolean; orientation?: string; message?: string }>;
      tanukiGateFetch?: (path: string) => Promise<{
        ok: boolean;
        source?: string;
        status?: number;
        latencyMs?: number;
        hasCookie?: boolean;
        url?: string;
        body?: string;
        message?: string;
      }>;
      tanukiGateLogin?: (code: string) => Promise<{
        ok: boolean;
        source?: string;
        status?: number;
        latencyMs?: number;
        cookieSaved?: boolean;
        body?: string;
        message?: string;
      }>;
      openExternalUrl?: (url: string) => Promise<{ ok: boolean; message?: string }>;
      openPocketBrowser?: (url: string) => Promise<{ ok: boolean; message?: string }>;
      openChatGPTApp?: () => Promise<{ ok: boolean; installed?: boolean; storeOpened?: boolean; message?: string }>;
      getPhoneAccessStatus?: () => Promise<{
        ok: boolean;
        mode?: string;
        contactsPermission?: boolean;
        smsPermission?: boolean;
        phoneStatePermission?: boolean;
        callLogPermission?: boolean;
        answerCallsPermission?: boolean;
        defaultSms?: boolean;
        defaultDialer?: boolean;
        contactCount?: number;
        smsInboxCount?: number;
        message?: string;
      }>;
      requestPhoneAccessPermissions?: () => Promise<{ ok: boolean; message?: string }>;
      openDialer?: (number?: string) => Promise<{ ok: boolean; message?: string }>;
      openContacts?: () => Promise<{ ok: boolean; message?: string }>;
      openMessages?: () => Promise<{ ok: boolean; message?: string }>;
      openSmsConversation?: (phone?: string, body?: string) => Promise<{ ok: boolean; message?: string }>;
      answerRingingCall?: () => Promise<{ ok: boolean; message?: string }>;
      openPhoneRoleSettings?: () => Promise<{ ok: boolean; message?: string }>;
      listPhoneContacts?: () => Promise<{ ok: boolean; contacts?: { id: string; name: string; phone?: string }[]; message?: string }>;
      listSmsInbox?: () => Promise<{ ok: boolean; messages?: { id: string; from: string; body: string; date: number; read: boolean; archived?: boolean; locallyEdited?: boolean }[]; message?: string }>;
      editSmsMessage?: (id: string, body: string) => Promise<{ ok: boolean; message?: string }>;
      archiveSmsMessage?: (id: string, archived?: boolean) => Promise<{ ok: boolean; message?: string }>;
      deleteSmsMessage?: (id: string) => Promise<{ ok: boolean; message?: string }>;
      updateSystemLockCode?: (code: string) => Promise<{ ok: boolean; message?: string }>;
      lockPocketFlowNow?: () => Promise<{ ok: boolean; message?: string }>;
      spinoStartSpeechRecognition?: (locale?: string) => Promise<{ ok: boolean; message?: string }>;
      spinoStopSpeechRecognition?: () => Promise<{ ok: boolean; message?: string }>;
      notesStartTranscription?: (mode?: string, locale?: string) => Promise<{ ok: boolean; message?: string }>;
      notesStopTranscription?: () => Promise<{ ok: boolean; message?: string }>;
      notesStartVoiceMemo?: (label?: string) => Promise<NativeVoiceMemoResult>;
      notesStopVoiceMemo?: () => Promise<NativeVoiceMemoResult>;
      notesSaveMeetingFile?: (folderName: string, fileName: string, mimeType: string, base64Data: string) => Promise<NativeMeetingFileResult>;
      notesClearArchive?: () => Promise<{ ok: boolean; deleted?: number; message?: string }>;
      spinoSpeak?: (text: string) => Promise<{ ok: boolean; message?: string }>;
      spinoStopSpeaking?: () => Promise<{ ok: boolean; message?: string }>;
      spinoStartPhoneRuntime?: (modelId: string, profile: string) => Promise<{ ok: boolean; running?: boolean; runtimeEndpoint?: string; message?: string }>;
      spinoStopPhoneRuntime?: () => Promise<{ ok: boolean; running?: boolean; message?: string }>;
      spinoGetRuntimeStats?: () => Promise<{
        ok: boolean;
        backend: string;
        installedModels: number;
        loadedModelId?: string;
        loaded?: boolean;
        modelFileInstalled?: boolean;
        modelFileBytes?: number;
        modelFilePath?: string;
        runtimeEndpoint?: string;
        runtimeKind?: string;
        tokensPerSecond?: number;
        estimatedMemoryMb?: number;
        deviceMemoryAvailableMb?: number;
        swapFreeMb?: number;
	        nativeInferenceInstalled?: boolean;
	        phoneRuntimePackaged?: boolean;
	        runtimeCanAutostart?: boolean;
	        runtimeNeedsStart?: boolean;
	        phoneRuntimeOwned?: boolean;
        phoneRuntimeStartedAt?: number;
        phoneRuntimeModelPath?: string;
        generationActive?: boolean;
        queueDepth?: number;
        memoryPressure?: "normal" | "high" | "critical";
        aetherModelInstalled?: boolean;
        recordAudioPermission?: boolean;
        speechRecognizerAvailable?: boolean;
        speechTranscriptionAvailable?: boolean;
        speechOfflinePreferred?: boolean;
        aetherStorageMounted?: boolean;
        aetherStorageWritable?: boolean;
        semanticRetrievalReady?: boolean;
        vectorIndexWritable?: boolean;
        toolBridgeReady?: boolean;
        approvedToolCount?: number;
        fullControlHint?: string;
        crashed?: boolean;
        health?: "healthy" | "busy" | "ready" | "limit" | "disconnected";
        lastError?: string;
        message?: string;
      }>;
      spinoSetRuntimeEndpoint?: (endpoint: string) => Promise<{ ok: boolean; runtimeEndpoint?: string; message?: string }>;
      spinoGetAetherStorageStats?: () => Promise<{
        ok: boolean;
        mounted: boolean;
        writable: boolean;
        root: string;
        totalBytes: number;
        freeBytes: number;
        usedBytes: number;
        reserveBytes: number;
        reserveFreeBytes: number;
        folders: string[];
        message?: string;
      }>;
      spinoListInstalledModels?: () => Promise<{
        ok: boolean;
        models: {
          id: string;
          name: string;
          path: string;
          size: number;
          importedAt: string;
        }[];
      }>;
      spinoRegisterImportedModel?: (name: string, size: number, uri?: string) => Promise<{
        ok: boolean;
        model?: {
          id: string;
          name: string;
          path: string;
          size: number;
          importedAt: string;
        };
        message?: string;
      }>;
      spinoDeleteModel?: (modelId: string) => Promise<{ ok: boolean; message?: string }>;
      spinoLoadModel?: (modelId: string, profile: string) => Promise<{ ok: boolean; loaded?: boolean; message?: string }>;
      spinoUnloadModel?: () => Promise<{ ok: boolean; loaded?: boolean; message?: string }>;
      spinoGenerate?: (prompt: string, optionsJson?: string) => Promise<{ ok: boolean; text?: string; message?: string }>;
      spinoWriteConversationMemory?: (userText: string, assistantText: string) => Promise<{ ok: boolean; path?: string; message?: string }>;
    };
  }
}

export interface BridgeStatus {
  available: boolean;
  mode: "web" | "androidBridge";
  permissions: {
    bluetoothScan: boolean;
    bluetoothConnect: boolean;
    readMediaImages: boolean;
    readExternalStorage: boolean;
    notifications: boolean;
  };
  receiveMethods: {
    filePicker: boolean;
    dragDrop: boolean;
    androidShare: boolean;
    bluetoothFolderWatch: boolean;
    downloadsWatch: boolean;
    nearbyConnections: boolean;
  };
  lastCheckedAt: string;
}

export interface ReceiveSettings {
  requireAcceptBeforeSave: boolean;
  keepDeclinedHistory: boolean;
  autoSuggestDestination: boolean;
  maxSingleFileMb: number;
  maxBatchSizeMb: number;
  maxFilesPerBatch: number;
  allowUnknownSafeFiles: boolean;
  enableDebugSimulation: boolean;
}

// ==========================================
// PocketFlow Builder Data Models
// ==========================================

export type BoxType =
  | "appScreen"
  | "backendModule"
  | "database"
  | "apiRoute"
  | "aiAgentTask"
  | "designSystem"
  | "authSecurity"
  | "integration"
  | "testing"
  | "deployment"
  | "documentation"
  | "custom";

export interface BoxPosition {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface ArchitectureBox {
  id: string;
  buildOrder?: number;
  title: string;
  type: BoxType;
  objective: string;
  agentPrompt: string;
  implementationInstructions: string;
  dependencies: string; // dependencies/inputs (comma-separated or text)
  deliverables: string; // deliverables/outputs (comma-separated or text)
  acceptanceCriteria: string;
  assets: string; // assets/references (comma-separated or text)
  linkedArchiveFileIds?: string[]; // canonical Archive file records linked to this box
  linkedLifeNoteIds?: string[]; // canonical MemoPad / Calenotes notes linked to this box
  notes: string;
  position: BoxPosition;
}

export interface BoxConnection {
  id: string;
  fromId: string;
  toId: string;
}

export interface BuilderProject {
  id: string;
  projectName: string;
  description: string;
  boxes: ArchitectureBox[];
  connections: BoxConnection[];
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// Dashboard Studio Data Models
// ==========================================

export type BlockType =
  | "metric"
  | "insight"
  | "chart"
  | "table"
  | "note"
  | "header"
  | "image"
  | "file";

export interface MetricBlockContent {
  label: string;
  value: string;
  unit?: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  changeValue: string;
  changeType: "up" | "down" | "neutral";
  status: "success" | "warning" | "danger" | "info";
  description: string;
}

export interface InsightBlockContent {
  summary: string;
  detailedAnalysis: string;
  recommendation: string;
  confidence?: string; // Phase 6 support
}

export interface ChartBlockContent {
  chartType: "bar" | "line" | "area" | "pie";
  labels: string[]; // e.g. ["Jan", "Feb", "Mar"]
  values: number[]; // e.g. [120, 240, 180]
  yAxisLabel?: string;
  notes?: string;   // Phase 6 support
}

export interface TableBlockContent {
  headers: string[];
  rows: string[][];
  notes?: string;   // Phase 6 support
}

export interface NoteBlockContent {
  text: string;
  conclusion?: string;
  tags?: string[];   // Phase 6 support
}

export interface HeaderBlockContent {
  subtitle: string;
}

export interface ImageBlockContent {
  imageRef?: string;
  caption: string;
  source?: string;
  notes?: string;
}

export interface FileBlockContent {
  fileName: string;
  fileType: string;
  fileSize: number;
  source: string;
  importStatus: string;
  notes?: string;
}

export interface DashboardBlock {
  id: string;
  type: BlockType;
  title: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  // Content values based on block type
  metricContent?: MetricBlockContent;
  insightContent?: InsightBlockContent;
  chartContent?: ChartBlockContent;
  tableContent?: TableBlockContent;
  noteContent?: NoteBlockContent;
  headerContent?: HeaderBlockContent;
  imageContent?: ImageBlockContent;
  fileContent?: FileBlockContent;
}

export interface Dashboard {
  id: string;
  title: string;
  description: string;
  goal: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  blocks: DashboardBlock[];
}
