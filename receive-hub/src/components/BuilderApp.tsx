import React, { useState, useEffect, useRef } from "react";
import { 
  ArchitectureBox, BoxConnection, BuilderProject, BoxType, ReceivedFile
} from "../types";
import { 
  getAllBuilderProjects, saveBuilderProject, deleteBuilderProject, getAllFiles, getStorageFolders, saveStorageFolders, saveFileMetadata, saveFileBlob
} from "../utils/storage";
import { normalizeSpinoSpeechInput } from "../utils/spinoSpeech";
import { formatBytes, sanitizeFileName } from "../utils/fileValidation";
import { LifeNote, loadLifeNotes } from "../utils/lifeMemory";
import { 
  Plus, Trash2, Copy, Download, Cpu, Edit, Settings, Layout, Database, 
  GitCommit, ArrowRight, CornerDownRight, ZoomIn, ZoomOut, Eye, Check, X, ShieldAlert, RefreshCw,
  Undo2, Redo2, Share2, ListOrdered, ArrowUp, ArrowDown, Mic, MicOff, Waves, Search, Paperclip, FileText, FolderOpen, NotebookPen
} from "lucide-react";

interface BuilderAppProps {
  onNotify: (message: string, type: "success" | "info" | "warn") => void;
}

const BOX_TYPES: { type: BoxType; label: string; icon: any; color: string; bg: string }[] = [
  { type: "appScreen", label: "App Screen UI", icon: Layout, color: "text-[#c7ff5d] border-[#c7ff5d]/35", bg: "bg-[#c7ff5d]/10" },
  { type: "backendModule", label: "Backend Core", icon: Cpu, color: "text-[#00ff66] border-[#00ff66]/35", bg: "bg-[#00ff66]/10" },
  { type: "database", label: "Database Entity", icon: Database, color: "text-[#7cffc6] border-[#7cffc6]/35", bg: "bg-[#7cffc6]/10" },
  { type: "apiRoute", label: "API Endpoint", icon: Settings, color: "text-[#33ff99] border-[#33ff99]/35", bg: "bg-[#33ff99]/10" },
  { type: "aiAgentTask", label: "AI Agent Prompt", icon: GitCommit, color: "text-[#ff4d4d] border-[#ff4d4d]/35", bg: "bg-[#ff4d4d]/10" },
  { type: "designSystem", label: "Design Guide", icon: Layout, color: "text-[#e6ff4d] border-[#e6ff4d]/35", bg: "bg-[#e6ff4d]/10" },
  { type: "authSecurity", label: "Security & Auth", icon: ShieldAlert, color: "text-[#ff7a1a] border-[#ff7a1a]/35", bg: "bg-[#ff7a1a]/10" },
  { type: "custom", label: "Custom Node", icon: Cpu, color: "text-[#a6ff00] border-[#a6ff00]/35", bg: "bg-[#a6ff00]/10" }
];

const CANVAS_SIZE = 2000;
const CANVAS_TOUCH_DRAG_THRESHOLD = 20;
const BUILDER_HANDOFF_FOLDER_PATH = "/pocketflow-builder";
const BUILDER_HANDOFF_FOLDER_NAME = "PocketFlow Builder";
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const getBoxBuildOrder = (box: ArchitectureBox, fallbackIndex: number) =>
  Number.isFinite(box.buildOrder) && (box.buildOrder || 0) > 0 ? box.buildOrder as number : fallbackIndex + 1;
const getBoxesByBuildOrder = (boxes: ArchitectureBox[]) =>
  boxes
    .map((box, index) => ({ box, index, order: getBoxBuildOrder(box, index) }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map((entry, index) => ({ ...entry.box, buildOrder: index + 1 }));
const sanitizeBoxId = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 42);
type BuilderDictationField = "objective" | "implementationInstructions" | "agentPrompt";
type BuilderVoicePhase = "ready" | "listening" | "hearing" | "saved" | "cleaned" | "stopped" | "error";

type BuilderSpeechResultDetail = {
  ok?: boolean;
  transcript?: string;
  confidence?: number;
  message?: string;
  interim?: boolean;
  mode?: string;
};

const ensureBuilderHandoffFolder = () => {
  const folders = getStorageFolders();
  if (folders.some((folder) => folder.path === BUILDER_HANDOFF_FOLDER_PATH)) return;
  const now = new Date().toISOString();
  saveStorageFolders([
    ...folders,
    {
      id: "folder_pocketflow_builder",
      name: BUILDER_HANDOFF_FOLDER_NAME,
      path: BUILDER_HANDOFF_FOLDER_PATH,
      parentPath: "/",
      createdAt: now,
      updatedAt: now,
    },
  ]);
};

const normalizeHandoffFileName = (value: string, fallback: string) => {
  const base = sanitizeFileName(value || fallback).replace(/\.(md|markdown)$/i, "");
  return `${base || "pocketflow_builder_handoff"}.md`;
};

export default function BuilderApp({ onNotify }: BuilderAppProps) {
  const [projects, setProjects] = useState<BuilderProject[]>([]);
  const [activeProject, setActiveProject] = useState<BuilderProject | null>(null);
  
  // Editor & Sheet state
  const [editingBox, setEditingBox] = useState<ArchitectureBox | null>(null);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [handoffPackageName, setHandoffPackageName] = useState("");
  const [isBuildOrderOpen, setIsBuildOrderOpen] = useState(false);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [isSelectionDockMinimized, setIsSelectionDockMinimized] = useState(false);
  const [connectionSourceId, setConnectionSourceId] = useState<string | null>(null);
  const [dictationField, setDictationField] = useState<BuilderDictationField | null>(null);
  const [dictationStatus, setDictationStatus] = useState("Voice dictation ready for Function, Character, and Prompt.");
  const [dictationInterim, setDictationInterim] = useState("");
  const [dictationPhase, setDictationPhase] = useState<BuilderVoicePhase>("ready");
  const [dictationLastSaved, setDictationLastSaved] = useState("");
  const [isPromptPreviewOpen, setIsPromptPreviewOpen] = useState(true);
  const [isArchivePickerOpen, setIsArchivePickerOpen] = useState(false);
  const [archivePickerSearch, setArchivePickerSearch] = useState("");
  const [archivePickerSelectedIds, setArchivePickerSelectedIds] = useState<string[]>([]);
  const [isNotePickerOpen, setIsNotePickerOpen] = useState(false);
  const [notePickerSearch, setNotePickerSearch] = useState("");
  const [notePickerSelectedIds, setNotePickerSelectedIds] = useState<string[]>([]);
  const dictationFieldRef = useRef<BuilderDictationField | null>(null);
  const dictationBoxIdRef = useRef<string | null>(null);
  const dictationRestartTimerRef = useRef<number | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<"canvas" | "list">("canvas");
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const [receivedAssets, setReceivedAssets] = useState<ReceivedFile[]>([]);
  const [lifeNotes, setLifeNotes] = useState<LifeNote[]>([]);
  const canvasViewportRef = useRef<HTMLDivElement | null>(null);

  // Project History (Undo/Redo) State Management
  const [undoStack, setUndoStack] = useState<BuilderProject[]>([]);
  const [redoStack, setRedoStack] = useState<BuilderProject[]>([]);

  const pushToUndo = (project: BuilderProject) => {
    setUndoStack(prev => {
      // Avoid duplicate consecutive states
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (JSON.stringify(last) === JSON.stringify(project)) {
          return prev;
        }
      }
      const next = [...prev, JSON.parse(JSON.stringify(project))];
      if (next.length > 50) next.shift(); // Cap history to 50 items
      return next;
    });
    setRedoStack([]); // Clear redo stack on a new modification action
  };

  const handleUndo = () => {
    if (undoStack.length === 0 || !activeProject) {
      onNotify("Nothing to undo", "info");
      return;
    }
    const prevProject = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    
    // Save current state to redo stack
    setRedoStack(prev => [...prev, JSON.parse(JSON.stringify(activeProject))]);
    setUndoStack(newUndoStack);
    
    // Set state
    setActiveProject(prevProject);
    saveBuilderProject(prevProject);
    setProjects(prev => prev.map(p => p.id === prevProject.id ? prevProject : p));
    
    // Synchronize editingBox fields if active
    if (editingBox) {
      const match = prevProject.boxes.find(b => b.id === editingBox.id);
      setEditingBox(match || null);
    }
    
    onNotify("Undo completed", "info");
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !activeProject) {
      onNotify("Nothing to redo", "info");
      return;
    }
    const nextProject = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    
    // Save current state to undo stack
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(activeProject))]);
    setRedoStack(newRedoStack);
    
    // Set state
    setActiveProject(nextProject);
    saveBuilderProject(nextProject);
    setProjects(prev => prev.map(p => p.id === nextProject.id ? nextProject : p));
    
    // Synchronize editingBox fields if active
    if (editingBox) {
      const match = nextProject.boxes.find(b => b.id === editingBox.id);
      setEditingBox(match || null);
    }
    
    onNotify("Redo completed", "info");
  };

  // Keyboard Shortcuts for Undo / Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if user pressed Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          // Ctrl+Shift+Z or Cmd+Shift+Z is Redo
          e.preventDefault();
          handleRedo();
        } else {
          // Ctrl+Z or Cmd+Z is Undo
          e.preventDefault();
          handleUndo();
        }
      }
      // Check if user pressed Ctrl+Y or Cmd+Y (Alternative Redo shortcut)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [undoStack, redoStack, activeProject, editingBox]);

  // Mouse / Touch Drag States for Free Moving of Boxes & Canvas Panning
  const [draggingBox, setDraggingBox] = useState<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    active: boolean;
  } | null>(null);

  const [panning, setPanning] = useState<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    active: boolean;
  } | null>(null);

  const [pinching, setPinching] = useState<{
    startDistance: number;
    startZoom: number;
    anchorX: number;
    anchorY: number;
  } | null>(null);

  const hasDraggedRef = useRef(false);
  const dragUndoCapturedRef = useRef(false);
  const getCanvasViewportRect = () => canvasViewportRef.current?.getBoundingClientRect() || null;
  const clampCanvasPan = (pan: { x: number; y: number }, zoom = canvasZoom) => {
    const rect = getCanvasViewportRect();
    const viewportWidth = rect?.width || 360;
    const viewportHeight = rect?.height || 520;
    const scaledCanvasSize = CANVAS_SIZE * zoom;
    const minX = Math.min(0, viewportWidth - scaledCanvasSize);
    const minY = Math.min(0, viewportHeight - scaledCanvasSize);
    return {
      x: Math.round(clamp(pan.x, minX, 0)),
      y: Math.round(clamp(pan.y, minY, 0))
    };
  };
  const getTouchDistance = (touches: TouchList | React.TouchList) => {
    const first = touches[0];
    const second = touches[1];
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  };
  const getTouchCenter = (touches: TouchList | React.TouchList) => {
    const first = touches[0];
    const second = touches[1];
    return {
      x: (first.clientX + second.clientX) / 2,
      y: (first.clientY + second.clientY) / 2
    };
  };
  const startPinchZoom = (touches: TouchList | React.TouchList) => {
    if (touches.length < 2) return;
    const rect = getCanvasViewportRect();
    if (!rect) return;
    const center = getTouchCenter(touches);
    const centerX = center.x - rect.left;
    const centerY = center.y - rect.top;
    setDraggingBox(null);
    setPanning(null);
    hasDraggedRef.current = true;
    setPinching({
      startDistance: getTouchDistance(touches),
      startZoom: canvasZoom,
      anchorX: (centerX - canvasPan.x) / canvasZoom,
      anchorY: (centerY - canvasPan.y) / canvasZoom
    });
  };

  // Mouse / Touch Drag Actions
  const handleBoxDragStart = (e: React.MouseEvent, boxId: string) => {
    if (e.button !== 0) return; // Only left mouse button drag
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("select") || target.closest("input") || target.closest("textarea")) {
      return; 
    }
    e.stopPropagation();
    
    hasDraggedRef.current = false;
    dragUndoCapturedRef.current = false;
    
    const box = activeProject?.boxes.find(b => b.id === boxId);
    if (!box) return;

    setDraggingBox({
      id: boxId,
      startX: e.clientX,
      startY: e.clientY,
      origX: box.position.x,
      origY: box.position.y,
      active: false
    });
  };

  const handleBoxDragStartTouch = (e: React.TouchEvent, boxId: string) => {
    if (e.touches.length >= 2) {
      e.stopPropagation();
      startPinchZoom(e.touches);
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("select") || target.closest("input") || target.closest("textarea")) {
      return;
    }
    e.stopPropagation();
    
    hasDraggedRef.current = false;
    dragUndoCapturedRef.current = false;
    
    const box = activeProject?.boxes.find(b => b.id === boxId);
    if (!box) return;

    const touch = e.touches[0];
    setDraggingBox({
      id: boxId,
      startX: touch.clientX,
      startY: touch.clientY,
      origX: box.position.x,
      origY: box.position.y,
      active: false
    });
  };

  const handleCanvasPanStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest(".pointer-events-auto")) {
      return; // Handled by node interactions
    }
    e.stopPropagation();
    hasDraggedRef.current = false;
    dragUndoCapturedRef.current = false;

    setPanning({
      startX: e.clientX,
      startY: e.clientY,
      origX: canvasPan.x,
      origY: canvasPan.y,
      active: false
    });
  };

  const handleCanvasPanStartTouch = (e: React.TouchEvent) => {
    if (e.touches.length >= 2) {
      e.stopPropagation();
      startPinchZoom(e.touches);
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest(".pointer-events-auto")) {
      return;
    }
    e.stopPropagation();
    hasDraggedRef.current = false;
    dragUndoCapturedRef.current = false;

    const touch = e.touches[0];
    setPanning({
      startX: touch.clientX,
      startY: touch.clientY,
      origX: canvasPan.x,
      origY: canvasPan.y,
      active: false
    });
  };

  // Listen for mousemove/touchmove events globally during dragging/panning
  useEffect(() => {
    if (!draggingBox && !panning && !pinching) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (draggingBox) {
        e.preventDefault();
        const screenDx = e.clientX - draggingBox.startX;
        const screenDy = e.clientY - draggingBox.startY;
        const movedEnough = Math.hypot(screenDx, screenDy) >= CANVAS_TOUCH_DRAG_THRESHOLD;
        if (!draggingBox.active && !movedEnough) return;
        if (!draggingBox.active) {
          if (activeProject && !dragUndoCapturedRef.current) {
            pushToUndo(activeProject);
            dragUndoCapturedRef.current = true;
          }
          setDraggingBox(prev => prev ? { ...prev, active: true } : prev);
        }
        const dx = screenDx / canvasZoom;
        const dy = screenDy / canvasZoom;

        hasDraggedRef.current = true;

        // Give abundance of room on the canvas workspace (0 to 1850 bounds)
        const nx = Math.max(0, Math.min(1850, draggingBox.origX + dx));
        const ny = Math.max(0, Math.min(1850, draggingBox.origY + dy));

        const actualBox = activeProject?.boxes.find(b => b.id === draggingBox.id);
        if (actualBox) {
          handleUpdateBoxValue(draggingBox.id, {
            position: {
              ...actualBox.position,
              x: Math.round(nx),
              y: Math.round(ny),
              rotation: 0
            }
          }, { syncEditor: false });
        }
      } else if (panning) {
        e.preventDefault();
        const dx = e.clientX - panning.startX;
        const dy = e.clientY - panning.startY;
        const movedEnough = Math.hypot(dx, dy) >= CANVAS_TOUCH_DRAG_THRESHOLD;
        if (!panning.active && !movedEnough) return;
        if (!panning.active) {
          setPanning(prev => prev ? { ...prev, active: true } : prev);
        }
        hasDraggedRef.current = true;

        setCanvasPan(clampCanvasPan({
          x: panning.origX + dx,
          y: panning.origY + dy
        }));
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (pinching && e.touches.length >= 2) {
        e.preventDefault();
        const rect = getCanvasViewportRect();
        if (!rect || pinching.startDistance <= 0) return;
        const center = getTouchCenter(e.touches);
        const centerX = center.x - rect.left;
        const centerY = center.y - rect.top;
        const nextZoom = clamp(pinching.startZoom * (getTouchDistance(e.touches) / pinching.startDistance), 0.35, 2.2);
        setCanvasZoom(nextZoom);
        setCanvasPan(clampCanvasPan({
          x: centerX - pinching.anchorX * nextZoom,
          y: centerY - pinching.anchorY * nextZoom
        }, nextZoom));
      } else if (draggingBox && e.touches.length > 0 && !pinching) {
        e.preventDefault();
        const touch = e.touches[0];
        const screenDx = touch.clientX - draggingBox.startX;
        const screenDy = touch.clientY - draggingBox.startY;
        const movedEnough = Math.hypot(screenDx, screenDy) >= CANVAS_TOUCH_DRAG_THRESHOLD;
        if (!draggingBox.active && !movedEnough) return;
        if (!draggingBox.active) {
          if (activeProject && !dragUndoCapturedRef.current) {
            pushToUndo(activeProject);
            dragUndoCapturedRef.current = true;
          }
          setDraggingBox(prev => prev ? { ...prev, active: true } : prev);
        }
        const dx = screenDx / canvasZoom;
        const dy = screenDy / canvasZoom;

        hasDraggedRef.current = true;

        const nx = Math.max(0, Math.min(1850, draggingBox.origX + dx));
        const ny = Math.max(0, Math.min(1850, draggingBox.origY + dy));

        const actualBox = activeProject?.boxes.find(b => b.id === draggingBox.id);
        if (actualBox) {
          handleUpdateBoxValue(draggingBox.id, {
            position: {
              ...actualBox.position,
              x: Math.round(nx),
              y: Math.round(ny),
              rotation: 0
            }
          }, { syncEditor: false });
        }
      } else if (panning && e.touches.length > 0 && !pinching) {
        e.preventDefault();
        const touch = e.touches[0];
        const dx = touch.clientX - panning.startX;
        const dy = touch.clientY - panning.startY;
        const movedEnough = Math.hypot(dx, dy) >= CANVAS_TOUCH_DRAG_THRESHOLD;
        if (!panning.active && !movedEnough) return;
        if (!panning.active) {
          setPanning(prev => prev ? { ...prev, active: true } : prev);
        }
        hasDraggedRef.current = true;

        setCanvasPan(clampCanvasPan({
          x: panning.origX + dx,
          y: panning.origY + dy
        }));
      }
    };

    const handleDragEnd = () => {
      setDraggingBox(null);
      setPanning(null);
      setPinching(null);
      setTimeout(() => {
        hasDraggedRef.current = false;
      }, 400);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleDragEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleDragEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleDragEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleDragEnd);
    };
  }, [draggingBox, panning, pinching, canvasZoom, canvasPan, activeProject]);

  // Load projects & assets on mount
  useEffect(() => {
    loadAllProjects();
    loadAssetsFromInbox();
    loadNotesFromMemory();
  }, []);

  useEffect(() => {
    const handleLifeMemoryUpdate = () => loadNotesFromMemory();
    window.addEventListener("pocketflow-life-memory-updated", handleLifeMemoryUpdate);
    return () => window.removeEventListener("pocketflow-life-memory-updated", handleLifeMemoryUpdate);
  }, []);

  useEffect(() => {
    if (!isExportOpen || !activeProject) return;
    setHandoffPackageName((current) =>
      current.trim()
        ? current
        : `${activeProject.projectName || "PocketFlow Builder"} handoff`
    );
  }, [isExportOpen, activeProject?.id]);

  useEffect(() => {
    if (viewMode !== "canvas") return;
    const clampNow = () => {
      setCanvasPan(pan => clampCanvasPan(pan, canvasZoom));
    };
    clampNow();
    window.addEventListener("resize", clampNow);
    window.addEventListener("orientationchange", clampNow);
    return () => {
      window.removeEventListener("resize", clampNow);
      window.removeEventListener("orientationchange", clampNow);
    };
  }, [viewMode, canvasZoom]);

  const loadAllProjects = () => {
    const list = getAllBuilderProjects();
    setProjects(list);
    if (list.length > 0) {
      setActiveProject(list[0]);
    } else {
      // Create initial starter project
      const starter: BuilderProject = {
        id: "p_project_default",
        projectName: "PocketFlow Core App",
        description: "Mobile first workflow for Codex and local LLM micro-agents.",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        boxes: [
          {
            id: "box_1",
            buildOrder: 1,
            title: "Task Intake Interface",
            type: "appScreen",
            objective: "Render incoming list of architecture items files.",
            agentPrompt: "Write a high-performance React functional component list view styled with Tailwind CSS, touch sizes at least 44px.",
            implementationInstructions: "Implement search inputs, pull-state, dynamic filters for categories, and item select triggers.",
            dependencies: "Inbox Database Model, Global Store",
            deliverables: "/src/components/IntakeScreen.tsx",
            acceptanceCriteria: "Builds clearly without TS compile warnings, scroll behavior is smooth on mobile viewport.",
            assets: "blueprint_mockup.png",
            notes: "Make sure swipe actions work.",
            position: { x: 50, y: 40, width: 140, height: 110, rotation: 0 }
          },
          {
            id: "box_2",
            buildOrder: 2,
            title: "Metadata Router API",
            type: "apiRoute",
            objective: "Route accepted file streams into sub-directories.",
            agentPrompt: "Develop an Express.js API endpoint handling POST uploads on /api/import-stream.",
            implementationInstructions: "Authenticate incoming requests, sanitize paths, save payloads safely, list logs.",
            dependencies: "Core Security Middleware",
            deliverables: "/server/api/import.ts",
            acceptanceCriteria: "Returns status ok - 200, handles validation error objects with status code 400 safely.",
            assets: "security_specification.md",
            notes: "Keep latency below 35ms.",
            position: { x: 250, y: 180, width: 140, height: 110, rotation: 0 }
          }
        ],
        connections: [
          { id: "conn_1_2", fromId: "box_1", toId: "box_2" }
        ]
      };
      saveBuilderProject(starter);
      setProjects([starter]);
      setActiveProject(starter);
    }
  };

  const loadAssetsFromInbox = async () => {
    const inbox = await getAllFiles();
    setReceivedAssets(inbox.filter(file => file.status !== "deleted"));
  };

  const loadNotesFromMemory = () => {
    setLifeNotes(loadLifeNotes());
  };

  const handleAssetUploadClick = () => {
    if (!editingBox) {
      onNotify("Open a Builder box first, then link files from PocketFlow Archive.", "warn");
      return;
    }
    openArchivePickerForBox(editingBox);
  };

  const getBoxLinkedArchiveFiles = (box: ArchitectureBox) => {
    const linkedIds = new Set(box.linkedArchiveFileIds || []);
    return receivedAssets.filter(file => linkedIds.has(file.id));
  };

  const getBoxLinkedLifeNotes = (box: ArchitectureBox) => {
    const linkedIds = new Set(box.linkedLifeNoteIds || []);
    return lifeNotes.filter(note => linkedIds.has(note.id));
  };

  const openArchivePickerForBox = async (box: ArchitectureBox) => {
    await loadAssetsFromInbox();
    setEditingBox(box);
    setArchivePickerSelectedIds(box.linkedArchiveFileIds || []);
    setArchivePickerSearch("");
    setIsArchivePickerOpen(true);
  };

  const handleToggleArchivePickerFile = (fileId: string) => {
    setArchivePickerSelectedIds(prev => prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]);
  };

  const handleAttachArchivePickerFiles = () => {
    if (!editingBox) return;
    const selectedFiles = receivedAssets.filter(file => archivePickerSelectedIds.includes(file.id));
    const assetNames = selectedFiles.map(file => file.name).join(", ");
    handleUpdateBoxValue(editingBox.id, {
      linkedArchiveFileIds: archivePickerSelectedIds,
      assets: assetNames || editingBox.assets,
    });
    setIsArchivePickerOpen(false);
    onNotify(`${selectedFiles.length} archive file${selectedFiles.length === 1 ? "" : "s"} linked to box.`, "success");
  };

  const handleUnlinkArchiveFile = (boxId: string, fileId: string) => {
    const box = activeProject?.boxes.find(item => item.id === boxId);
    if (!box) return;
    const nextIds = (box.linkedArchiveFileIds || []).filter(id => id !== fileId);
    const nextNames = receivedAssets.filter(file => nextIds.includes(file.id)).map(file => file.name).join(", ");
    handleUpdateBoxValue(boxId, {
      linkedArchiveFileIds: nextIds,
      assets: nextNames || box.assets,
    });
    setArchivePickerSelectedIds(prev => prev.filter(id => id !== fileId));
    onNotify("Archive file unlinked from box.", "info");
  };

  const openNotePickerForBox = (box: ArchitectureBox) => {
    loadNotesFromMemory();
    setEditingBox(box);
    setNotePickerSelectedIds(box.linkedLifeNoteIds || []);
    setNotePickerSearch("");
    setIsNotePickerOpen(true);
  };

  const handleToggleNotePickerNote = (noteId: string) => {
    setNotePickerSelectedIds(prev => prev.includes(noteId) ? prev.filter(id => id !== noteId) : [...prev, noteId]);
  };

  const handleAttachNotePickerNotes = () => {
    if (!editingBox) return;
    const selectedNotes = lifeNotes.filter(note => notePickerSelectedIds.includes(note.id));
    handleUpdateBoxValue(editingBox.id, {
      linkedLifeNoteIds: notePickerSelectedIds,
    });
    setIsNotePickerOpen(false);
    onNotify(`${selectedNotes.length} MemoPad note${selectedNotes.length === 1 ? "" : "s"} linked to box.`, "success");
  };

  const handleUnlinkLifeNote = (boxId: string, noteId: string) => {
    const box = activeProject?.boxes.find(item => item.id === boxId);
    if (!box) return;
    handleUpdateBoxValue(boxId, {
      linkedLifeNoteIds: (box.linkedLifeNoteIds || []).filter(id => id !== noteId),
    });
    setNotePickerSelectedIds(prev => prev.filter(id => id !== noteId));
    onNotify("MemoPad note unlinked from box.", "info");
  };

  const syncActiveProject = (updated: BuilderProject) => {
    setActiveProject(updated);
    saveBuilderProject(updated);
    // Update local in-memory lists too
    setProjects(prev => prev.map(p => p.id === updated.id ? updated : p));
  };

  const handleCreateNewProject = () => {
    const id = "p_" + Math.random().toString(36).substr(2, 9);
    const proj: BuilderProject = {
      id,
      projectName: "New Custom Architecture",
      description: "Visionary system mapped inside PocketFlow Builder OS.",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      boxes: [],
      connections: []
    };
    saveBuilderProject(proj);
    setProjects(prev => [...prev, proj]);
    setActiveProject(proj);
    setUndoStack([]);
    setRedoStack([]);
    onNotify("New builder project architecture initialized!", "success");
  };

  const handleDeleteProject = () => {
    if (!activeProject) return;
    deleteBuilderProject(activeProject.id);
    const updatedList = projects.filter(p => p.id !== activeProject.id);
    setProjects(updatedList);
    if (updatedList.length > 0) {
      setActiveProject(updatedList[0]);
    } else {
      setActiveProject(null);
    }
    setUndoStack([]);
    setRedoStack([]);
    onNotify("Project architecture deleted successfully.", "warn");
  };

  const handleUpdateProjectName = (name: string) => {
    if (!activeProject) return;
    syncActiveProject({
      ...activeProject,
      projectName: name,
      updatedAt: new Date().toISOString()
    });
  };

  const handleAddBox = () => {
    if (!activeProject) return;
    pushToUndo(activeProject);
    const boxId = "box_" + Math.random().toString(36).substr(2, 9);
    
    // Position elegantly centered or slightly offset
    const lastBox = activeProject.boxes[activeProject.boxes.length - 1];
    const nx = lastBox ? lastBox.position.x + 40 : 100;
    const ny = lastBox ? lastBox.position.y + 70 : 100;

    const newBox: ArchitectureBox = {
      id: boxId,
      buildOrder: activeProject.boxes.length + 1,
      title: "New Code Box",
      type: "custom",
      objective: "Define build requirements here.",
      agentPrompt: "Write code matching standard production rules.",
      implementationInstructions: "Follow standard architectural principles.",
      dependencies: "",
      deliverables: "",
      acceptanceCriteria: "Passes development build successfully.",
      assets: "",
      notes: "Reference code assets here.",
      position: { x: nx, y: ny, width: 140, height: 110, rotation: 0 }
    };

    const nextProject = {
      ...activeProject,
      boxes: [...activeProject.boxes, newBox],
      updatedAt: new Date().toISOString()
    };
    syncActiveProject(nextProject);
    setSelectedBoxId(boxId);
    setIsSelectionDockMinimized(false);
    setEditingBox(newBox);
    onNotify("Architecture Node added to Canvas", "success");
  };

  const handleDuplicateBox = (box: ArchitectureBox) => {
    if (!activeProject) return;
    pushToUndo(activeProject);
    const boxId = "box_" + Math.random().toString(36).substr(2, 9);
    const dup: ArchitectureBox = {
      ...box,
      id: boxId,
      buildOrder: activeProject.boxes.length + 1,
      title: `${box.title} (Copy)`,
      position: {
        ...box.position,
        x: box.position.x + 30,
        y: box.position.y + 30
      }
    };
    const nextProject = {
      ...activeProject,
      boxes: [...activeProject.boxes, dup],
      updatedAt: new Date().toISOString()
    };
    syncActiveProject(nextProject);
    setSelectedBoxId(boxId);
    setIsSelectionDockMinimized(false);
    setEditingBox(dup);
    onNotify("Node duplicated on canvas", "info");
  };

  const handleDeleteBox = (id: string) => {
    if (!activeProject) return;
    pushToUndo(activeProject);
    const updatedBoxes = getBoxesByBuildOrder(activeProject.boxes.filter(b => b.id !== id));
    const updatedConns = activeProject.connections.filter(c => c.fromId !== id && c.toId !== id);
    syncActiveProject({
      ...activeProject,
      boxes: updatedBoxes,
      connections: updatedConns,
      updatedAt: new Date().toISOString()
    });
    setSelectedBoxId(null);
    setIsSelectionDockMinimized(false);
    setEditingBox(null);
    onNotify("Node deleted from workspace", "warn");
  };

  const handleUpdateBoxValue = (
    boxId: string,
    fields: Partial<ArchitectureBox>,
    options?: { syncEditor?: boolean }
  ) => {
    if (!activeProject) return;
    const nextBoxes = activeProject.boxes.map(b => b.id === boxId ? { ...b, ...fields } as ArchitectureBox : b);
    const updatedProject = {
      ...activeProject,
      boxes: nextBoxes,
      updatedAt: new Date().toISOString()
    };
    syncActiveProject(updatedProject);
    if (options?.syncEditor !== false) {
      const match = nextBoxes.find(b => b.id === boxId);
      if (match) setEditingBox(match);
    }
  };

  const canStartBuilderDictation = () => (
    Boolean(window.PocketFlowReceiveBridge?.notesStartTranscription || window.PocketFlowReceiveBridge?.spinoStartSpeechRecognition)
    || "SpeechRecognition" in window
    || "webkitSpeechRecognition" in window
  );

  const builderDictationFieldLabel = (field: BuilderDictationField) => (
    field === "objective" ? "Function" : field === "implementationInstructions" ? "Agent Character" : "Prompt"
  );

  const composeBoxPromptPreview = (box: ArchitectureBox) => [
    `# Builder Box: ${box.title || box.id}`,
    "",
    `Type: ${box.type}`,
    `Build order: ${getBoxBuildOrder(box, activeProject?.boxes.findIndex((item) => item.id === box.id) || 0)}`,
    `System box id: ${box.id}`,
    "",
    "## Function",
    box.objective?.trim() || "Not written yet.",
    "",
    "## Agent Character",
    box.implementationInstructions?.trim() || "Not written yet.",
    "",
    "## Prompt",
    box.agentPrompt?.trim() || "Not written yet.",
    "",
    "## Acceptance Criteria",
    box.acceptanceCriteria?.trim() || "Use the project standards and return a clear implementation summary.",
    "",
    "## Dependencies / Inputs",
    box.dependencies?.trim() || "None listed.",
    "",
    "## Linked Archive Files",
    getBoxLinkedArchiveFiles(box).length
      ? getBoxLinkedArchiveFiles(box).map((file) => `- ${file.name} (${file.extension || "file"}, ${formatBytes(file.size)}, archive id: ${file.id})`).join("\n")
      : box.assets?.trim() || "None linked yet.",
    "",
    "## Linked MemoPad Notes",
    getBoxLinkedLifeNotes(box).length
      ? getBoxLinkedLifeNotes(box).map((note) => [
          `- ${note.title || "Untitled note"} (note id: ${note.id}, source: ${note.source})`,
          `  Tags: ${note.tags?.length ? note.tags.join(", ") : "none"}`,
          `  Context: ${(note.body || note.details || "").trim().slice(0, 700) || "No note body saved."}`,
        ].join("\n")).join("\n")
      : "None linked yet.",
    "",
    "## Deliverables",
    box.deliverables?.trim() || "Working implementation and verification notes.",
  ].join("\n");

  const cleanBuilderDictationText = (value: string, field: BuilderDictationField) => {
    const normalized = normalizeSpinoSpeechInput(value);
    let text = normalized.text
      .replace(/\bnew line\b|\bnewline\b/gi, "\n")
      .replace(/\bfull stop\b/gi, ".")
      .replace(/\bcomma\b/gi, ",")
      .replace(/\bcolon\b/gi, ":")
      .replace(/\bsemicolon\b/gi, ";")
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    text = text.replace(/^(?:ok(?:ay)?|so|basically|i mean|you know|like|listen)[, ]+/i, "").trim();
    if (text && !/^[A-Z0-9#`]/.test(text)) text = `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

    if (field === "agentPrompt" && text && !/^[-#*\d]/.test(text) && text.length > 180) {
      const sentences = text
        .split(/(?<=[.!?])\s+/)
        .map((line) => line.trim())
        .filter(Boolean);
      if (sentences.length > 1) {
        text = sentences.map((line) => `- ${line}`).join("\n");
      }
    }

    return text;
  };

  const handleCleanBuilderField = (field: BuilderDictationField) => {
    if (!editingBox || !activeProject) return;
    const currentValue = String(editingBox[field] || "");
    const cleaned = cleanBuilderDictationText(currentValue, field);
    if (!cleaned) {
      onNotify(`${builderDictationFieldLabel(field)} has no text to clean.`, "warn");
      setDictationStatus(`${builderDictationFieldLabel(field)} has no text to clean.`);
      setDictationPhase("error");
      return;
    }
    if (cleaned === currentValue.trim()) {
      onNotify(`${builderDictationFieldLabel(field)} already looks clean.`, "info");
      setDictationStatus(`${builderDictationFieldLabel(field)} already looks clean.`);
      setDictationPhase("ready");
      return;
    }
    pushToUndo(activeProject);
    handleUpdateBoxValue(editingBox.id, { [field]: cleaned } as Partial<ArchitectureBox>);
    setDictationLastSaved(`${builderDictationFieldLabel(field)} cleaned ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
    setDictationStatus(`${builderDictationFieldLabel(field)} cleaned locally. Check preview before sending.`);
    setDictationPhase("cleaned");
    onNotify(`${builderDictationFieldLabel(field)} cleaned.`, "success");
  };

  const handleClearBuilderField = (field: BuilderDictationField) => {
    if (!editingBox || !activeProject) return;
    const currentValue = String(editingBox[field] || "").trim();
    if (!currentValue && !dictationInterim.trim()) {
      setDictationStatus(`${builderDictationFieldLabel(field)} is already empty.`);
      setDictationPhase("ready");
      return;
    }
    pushToUndo(activeProject);
    handleUpdateBoxValue(editingBox.id, { [field]: "" } as Partial<ArchitectureBox>);
    setDictationInterim("");
    setDictationLastSaved(`${builderDictationFieldLabel(field)} cleared ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
    setDictationStatus(`${builderDictationFieldLabel(field)} cleared. Dictate again or type/edit manually.`);
    setDictationPhase("cleaned");
    onNotify(`${builderDictationFieldLabel(field)} cleared.`, "info");
  };

  const handleCopyPromptPreview = async (box: ArchitectureBox) => {
    await navigator.clipboard.writeText(composeBoxPromptPreview(box));
    onNotify("Prompt preview copied.", "success");
  };

  const stopBuilderDictation = async () => {
    if (dictationRestartTimerRef.current) {
      window.clearTimeout(dictationRestartTimerRef.current);
      dictationRestartTimerRef.current = null;
    }
    dictationFieldRef.current = null;
    dictationBoxIdRef.current = null;
    setDictationField(null);
    setDictationInterim("");
    try {
      if (window.PocketFlowReceiveBridge?.notesStopTranscription) {
        await window.PocketFlowReceiveBridge.notesStopTranscription();
      } else if (window.PocketFlowReceiveBridge?.spinoStopSpeechRecognition) {
        await window.PocketFlowReceiveBridge.spinoStopSpeechRecognition();
      }
    } catch {}
    setDictationStatus("Voice dictation stopped.");
    setDictationPhase("stopped");
  };

  const startNativeBuilderDictation = async () => {
    const locale = "auto";
    if (window.PocketFlowReceiveBridge?.notesStartTranscription) {
      return window.PocketFlowReceiveBridge.notesStartTranscription("builder", locale);
    }
    return window.PocketFlowReceiveBridge?.spinoStartSpeechRecognition?.(locale) || { ok: false, message: "Speech bridge unavailable." };
  };

  const startBrowserBuilderDictation = (field: BuilderDictationField, boxId: string) => {
    const SpeechRecognitionCtor =
      (window as Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition
      || (window as Window & { webkitSpeechRecognition?: any }).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setDictationStatus("Voice dictation is available in the phone app. Browser speech is unavailable here.");
      setDictationPhase("error");
      onNotify("Voice dictation is available in the phone app.", "warn");
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex || 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript?.trim() || "";
        if (!text) continue;
        if (result.isFinal) finalText = [finalText, text].filter(Boolean).join(" ");
        else interimText = [interimText, text].filter(Boolean).join(" ");
      }
      if (interimText) {
        setDictationInterim(interimText);
        setDictationStatus(`Hearing: ${interimText}`);
        setDictationPhase("hearing");
      }
      if (finalText) appendDictationToBox(field, boxId, finalText, false);
    };
    recognition.onerror = () => {
      void stopBuilderDictation().then(() => {
        setDictationStatus("Browser speech paused. Tap mic again to retry.");
        setDictationPhase("error");
      });
    };
    recognition.onend = () => {
      if (dictationFieldRef.current === field && dictationBoxIdRef.current === boxId) {
        dictationRestartTimerRef.current = window.setTimeout(() => startBrowserBuilderDictation(field, boxId), 650);
      }
    };
    recognition.start();
  };

  const startBuilderDictation = async (field: BuilderDictationField) => {
    if (!editingBox) return;
    if (dictationField === field) {
      await stopBuilderDictation();
      return;
    }
    if (!canStartBuilderDictation()) {
      setDictationStatus("No speech engine available. Use the phone app for precise dictation.");
      onNotify("No speech engine available here.", "warn");
      return;
    }
    if (dictationField) await stopBuilderDictation();
    if (activeProject) pushToUndo(activeProject);
    dictationFieldRef.current = field;
    dictationBoxIdRef.current = editingBox.id;
    setDictationField(field);
    setDictationInterim("");
    setDictationStatus(`Listening for ${builderDictationFieldLabel(field)}. Speak clearly; tap stop when done.`);
    setDictationPhase("listening");
    if (window.PocketFlowReceiveBridge?.notesStartTranscription || window.PocketFlowReceiveBridge?.spinoStartSpeechRecognition) {
      try {
        const result = await startNativeBuilderDictation();
        if (!result.ok) {
          setDictationStatus(result.message || "Phone speech bridge unavailable. Trying browser speech.");
          setDictationPhase("error");
          startBrowserBuilderDictation(field, editingBox.id);
        }
      } catch {
        setDictationStatus("Phone speech bridge did not answer. Trying browser speech.");
        setDictationPhase("error");
        startBrowserBuilderDictation(field, editingBox.id);
      }
      return;
    }
    startBrowserBuilderDictation(field, editingBox.id);
  };

  const appendDictationToBox = (field: BuilderDictationField, boxId: string, transcript: string, restartNative: boolean) => {
    const text = transcript.trim();
    if (!text) return;
    const currentBox = activeProject?.boxes.find((box) => box.id === boxId);
    if (!currentBox) return;
    const currentValue = String(currentBox[field] || "").trim();
    const separator = currentValue.endsWith(".") || currentValue.endsWith("\n") ? "\n" : "\n";
    const nextValue = [currentValue, text].filter(Boolean).join(currentValue ? separator : "");
    handleUpdateBoxValue(boxId, { [field]: nextValue } as Partial<ArchitectureBox>);
    setDictationInterim("");
    setDictationStatus(`${builderDictationFieldLabel(field)} dictation added. Keep talking or tap stop.`);
    setDictationPhase("saved");
    setDictationLastSaved(`${builderDictationFieldLabel(field)} saved ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
    if (restartNative && dictationFieldRef.current === field && dictationBoxIdRef.current === boxId) {
      if (dictationRestartTimerRef.current) window.clearTimeout(dictationRestartTimerRef.current);
      dictationRestartTimerRef.current = window.setTimeout(() => {
        void startNativeBuilderDictation();
      }, 650);
    }
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const field = dictationFieldRef.current;
      const boxId = dictationBoxIdRef.current;
      if (!field || !boxId) return;
      const detail = (event as CustomEvent<BuilderSpeechResultDetail>).detail || {};
      if (detail.mode && detail.mode !== "builder" && detail.mode !== "spino") return;
      if (!detail.ok || !detail.transcript?.trim()) {
        setDictationStatus(detail.message || "No speech captured yet. Keep talking or tap stop.");
        setDictationPhase("error");
        if (window.PocketFlowReceiveBridge?.notesStartTranscription || window.PocketFlowReceiveBridge?.spinoStartSpeechRecognition) {
          if (dictationRestartTimerRef.current) window.clearTimeout(dictationRestartTimerRef.current);
          dictationRestartTimerRef.current = window.setTimeout(() => {
            void startNativeBuilderDictation();
          }, 900);
        }
        return;
      }
      const transcript = detail.transcript.trim();
      if (detail.interim) {
        setDictationInterim(transcript);
        setDictationStatus(`Hearing: ${transcript}`);
        setDictationPhase("hearing");
        return;
      }
      appendDictationToBox(field, boxId, transcript, true);
    };
    window.addEventListener("pocketflow-notes-speech-result", handler as EventListener);
    window.addEventListener("pocketflow-speech-result", handler as EventListener);
    return () => {
      window.removeEventListener("pocketflow-notes-speech-result", handler as EventListener);
      window.removeEventListener("pocketflow-speech-result", handler as EventListener);
      if (dictationRestartTimerRef.current) window.clearTimeout(dictationRestartTimerRef.current);
    };
  }, [activeProject]);

  useEffect(() => {
    if (!editingBox && dictationFieldRef.current) {
      void stopBuilderDictation();
    }
  }, [editingBox]);

  const renderDictationButton = (field: BuilderDictationField) => {
    const active = dictationField === field;
    return (
      <button
        type="button"
        onClick={() => void startBuilderDictation(field)}
        className={`h-8 px-2.5 rounded-xl border text-[8px] font-mono font-black uppercase tracking-widest inline-flex items-center gap-1 transition ${
          active
            ? "border-red-400/45 bg-red-500/15 text-red-300"
            : "border-[#22c55e]/35 bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/15"
        }`}
        title={active ? `Stop ${builderDictationFieldLabel(field)} dictation` : `Dictate ${builderDictationFieldLabel(field)}`}
      >
        {active ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        {active ? "Stop" : "Voice"}
      </button>
    );
  };

  const renderCleanButton = (field: BuilderDictationField) => (
    <button
      type="button"
      onClick={() => handleCleanBuilderField(field)}
      className="h-8 px-2.5 rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200 hover:bg-cyan-300/15 text-[8px] font-mono font-black uppercase tracking-widest inline-flex items-center gap-1 transition"
      title={`Clean ${builderDictationFieldLabel(field)} dictation locally`}
    >
      <RefreshCw className="w-3.5 h-3.5" />
      Clean
    </button>
  );

  const voicePhaseClass =
    dictationPhase === "error"
      ? "border-red-400/35 bg-red-500/15 text-red-200"
      : dictationPhase === "listening" || dictationPhase === "hearing"
        ? "border-amber-300/35 bg-amber-300/15 text-amber-100"
        : dictationPhase === "saved" || dictationPhase === "cleaned"
          ? "border-[#22c55e]/35 bg-[#22c55e]/15 text-[#22c55e]"
          : "border-slate-500/25 bg-slate-500/10 text-slate-300";

  const voicePhaseLabel =
    dictationPhase === "error"
      ? "Speech failed"
      : dictationPhase === "listening"
        ? "Listening"
        : dictationPhase === "hearing"
          ? "Hearing"
          : dictationPhase === "saved"
            ? "Saved"
            : dictationPhase === "cleaned"
              ? "Cleaned"
              : dictationPhase === "stopped"
                ? "Stopped"
                : "Mic ready";

  const handleRenameBoxId = (oldId: string, rawNextId: string) => {
    if (!activeProject) return;
    const nextId = sanitizeBoxId(rawNextId);
    if (!nextId || nextId === oldId) return;
    if (activeProject.boxes.some(box => box.id === nextId)) {
      onNotify("Box ID already exists. Pick a unique ID.", "warn");
      return;
    }

    pushToUndo(activeProject);
    const nextBoxes = activeProject.boxes.map(box => box.id === oldId ? { ...box, id: nextId } : box);
    const nextConnections = activeProject.connections.map(conn => ({
      ...conn,
      id: conn.id.includes(oldId) ? conn.id.split(oldId).join(nextId) : conn.id,
      fromId: conn.fromId === oldId ? nextId : conn.fromId,
      toId: conn.toId === oldId ? nextId : conn.toId
    }));
    syncActiveProject({
      ...activeProject,
      boxes: nextBoxes,
      connections: nextConnections,
      updatedAt: new Date().toISOString()
    });
    if (selectedBoxId === oldId) setSelectedBoxId(nextId);
    if (connectionSourceId === oldId) setConnectionSourceId(nextId);
    const renamed = nextBoxes.find(box => box.id === nextId);
    if (editingBox?.id === oldId && renamed) setEditingBox(renamed);
    onNotify("Box ID updated and links preserved.", "success");
  };

  const handleSetBuildOrder = (boxId: string, nextOrder: number) => {
    if (!activeProject) return;
    const ordered = getBoxesByBuildOrder(activeProject.boxes);
    const currentIndex = ordered.findIndex(box => box.id === boxId);
    if (currentIndex < 0) return;
    const targetIndex = clamp(Math.round(nextOrder) - 1, 0, ordered.length - 1);
    if (targetIndex === currentIndex) return;
    pushToUndo(activeProject);
    const [moving] = ordered.splice(currentIndex, 1);
    ordered.splice(targetIndex, 0, moving);
    const orderById = new Map(ordered.map((box, index) => [box.id, index + 1]));
    syncActiveProject({
      ...activeProject,
      boxes: activeProject.boxes.map(box => ({ ...box, buildOrder: orderById.get(box.id) || box.buildOrder })),
      updatedAt: new Date().toISOString()
    });
    onNotify("Build order updated", "info");
  };

  const handleMoveBuildOrder = (boxId: string, direction: -1 | 1) => {
    if (!activeProject) return;
    const ordered = getBoxesByBuildOrder(activeProject.boxes);
    const currentIndex = ordered.findIndex(box => box.id === boxId);
    if (currentIndex < 0) return;
    handleSetBuildOrder(boxId, currentIndex + 1 + direction);
  };

  const normalizeBuildOrder = () => {
    if (!activeProject) return;
    pushToUndo(activeProject);
    syncActiveProject({
      ...activeProject,
      boxes: getBoxesByBuildOrder(activeProject.boxes),
      updatedAt: new Date().toISOString()
    });
    onNotify("Build order normalized", "success");
  };

  // Node connection builder
  const handleInitiateConnection = (fromId: string) => {
    setConnectionSourceId(fromId);
    onNotify(`Pick target node for connector arrow`, "info");
  };

  const handleCompleteConnection = (toId: string) => {
    if (!activeProject || !connectionSourceId) return;
    if (connectionSourceId === toId) {
      onNotify("Cannot connect box to itself", "warn");
      setConnectionSourceId(null);
      return;
    }

    // Check if duplicate connection
    const exists = activeProject.connections.some(c => c.fromId === connectionSourceId && c.toId === toId);
    if (exists) {
      onNotify("Connection link already present", "warn");
      setConnectionSourceId(null);
      return;
    }

    pushToUndo(activeProject);
    const connId = `conn_${connectionSourceId}_${toId}`;
    const newConn: BoxConnection = {
      id: connId,
      fromId: connectionSourceId,
      toId
    };

    syncActiveProject({
      ...activeProject,
      connections: [...activeProject.connections, newConn],
      updatedAt: new Date().toISOString()
    });
    setConnectionSourceId(null);
    onNotify("Directed connection added to model!", "success");
  };

  // Generate Handoff text packages
  const generateHandoffData = () => {
    if (!activeProject) return "";
    const orderedBoxes = getBoxesByBuildOrder(activeProject.boxes);
    const orderedProject = { ...activeProject, boxes: orderedBoxes };
    
    // 1. Map of boxes in Markdown format
    const boxesMarkdown = orderedBoxes.map(b => {
      return `### Build ${b.buildOrder}. Node [${b.type.toUpperCase()}] - ${b.title}
- **Objective:** ${b.objective}
- **Agent Instruction Prompt:** 
\`\`\`text
${b.agentPrompt}
\`\`\`
- **Implementation Rules:** ${b.implementationInstructions}
- **Dependencies / Inputs:** ${b.dependencies || "None"}
- **Linked Archive Files:** ${getBoxLinkedArchiveFiles(b).map((file) => `${file.name} (${file.id})`).join(", ") || b.assets || "None"}
- **Linked MemoPad Notes:** ${getBoxLinkedLifeNotes(b).map((note) => `${note.title || "Untitled note"} (${note.id})`).join(", ") || "None"}
- **Outputs / Deliverables:** ${b.deliverables || "None"}
- **Acceptance Criteria:** ${b.acceptanceCriteria}
- **Notes:** ${b.notes || "N/A"}`;
    }).join("\n\n---\n\n");

    const handoff = `# ARCHITECTURE HANDOFF PACKAGE: ${activeProject.projectName.toUpperCase()}
Generated on PocketFlow Builder • Personal Code Agent Assembly

## README / Context Overview
${activeProject.description || "Project designed on mobile system."}

- **Total Architecture Boxes:** ${activeProject.boxes.length}
- **Total Connections Logs:** ${activeProject.connections.length}

## BUILD_ORDER.md Pipeline
${orderedBoxes.map((b) => `${b.buildOrder}. [${b.type}] **${b.title}** -> Deliver: \`${b.deliverables || "Core module"}\``).join("\n")}

## AGENT_INSTRUCTIONS.md Prompt Config
Deploy Claude / Codex on workspace. Target deliverables in sequence to hit all criteria.

### Schema Blueprint (project-architecture.json)
\`\`\`json
${JSON.stringify(orderedProject, null, 2)}
\`\`\`

## SUB-BOX SPECIFICATIONS
${boxesMarkdown || "No boxes configured. Add modular nodes to start design."}`;

    return handoff;
  };

  const handleCopyToClipboard = () => {
    const text = generateHandoffData();
    navigator.clipboard.writeText(text);
    onNotify("Copied entire Builder code handoff to clipboard!", "success");
  };

  const handleShareHandoff = async () => {
    const title = `PocketFlow Builder - ${activeProject.projectName}`;
    const text = generateHandoffData();
    if (window.PocketFlowReceiveBridge?.shareText) {
      const result = await window.PocketFlowReceiveBridge.shareText(title, text);
      onNotify(result.message || "Share sheet opened.", result.ok ? "success" : "warn");
      setIsExportOpen(false);
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        onNotify("System share sheet opened.", "success");
      } else {
        await navigator.clipboard.writeText(text);
        onNotify("Handoff copied for sharing.", "success");
      }
      setIsExportOpen(false);
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") onNotify("Share is not available here.", "warn");
    }
  };

  const handleDownloadHandoff = async () => {
    if (!activeProject) return;
    const fallbackName = `${activeProject.projectName || "PocketFlow Builder"} handoff`;
    const fileName = normalizeHandoffFileName(handoffPackageName, fallbackName);
    const text = generateHandoffData();
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8;" });
    const now = new Date().toISOString();
    const fileId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? `builder_handoff_${crypto.randomUUID()}`
        : `builder_handoff_${Date.now()}`;

    try {
      ensureBuilderHandoffFolder();
      const record: ReceivedFile = {
        id: fileId,
        name: fileName,
        safeName: sanitizeFileName(fileName),
        extension: "md",
        mimeType: "text/markdown",
        category: "builderPackage",
        size: blob.size,
        source: "debug",
        sourceDeviceName: "PocketFlow Builder",
        status: "accepted",
        suggestedDestination: "pocketFlowBuilder",
        folderPath: BUILDER_HANDOFF_FOLDER_PATH,
        receivedAt: now,
        acceptedAt: now,
        metadata: {
          builderProjectName: activeProject.projectName,
          builderBoxCount: activeProject.boxes.length,
          markdownTitle: fileName.replace(/\.md$/i, ""),
          contentPreview: text.slice(0, 12_000),
          security: {
            scanStatus: "clean",
            threatLevel: "clean",
            scannedAt: now,
            scanner: "PocketFlow Builder export",
            reasons: ["Generated locally by PocketFlow Builder."],
            safeReaderRequired: false,
          },
        },
        auditLog: [
          { type: "file.detected", at: now, detail: "Generated from PocketFlow Builder handoff package." },
          { type: "file.accepted", at: now, detail: `Saved to ${BUILDER_HANDOFF_FOLDER_NAME}.` },
        ],
      };
      await saveFileMetadata(record);
      await saveFileBlob(fileId, blob);
      await loadAssetsFromInbox();
      onNotify(`Saved to Archive / ${BUILDER_HANDOFF_FOLDER_NAME}: ${fileName}`, "success");
    } catch {
      onNotify("Could not save handoff to Archive.", "warn");
      return;
    }
    setIsExportOpen(false);
  };

  const getBoxStyle = (type: BoxType) => {
    const match = BOX_TYPES.find(b => b.type === type);
    return match || BOX_TYPES[BOX_TYPES.length - 1];
  };

  // Canvas visual size definitions
  const boxWidth = 140;
  const boxHeight = 110;
  const archivePickerVisibleFiles = receivedAssets
    .filter(file => {
      const needle = archivePickerSearch.trim().toLowerCase();
      if (!needle) return true;
      return [
        file.name,
        file.safeName,
        file.extension,
        file.mimeType,
        file.category,
        file.folderPath,
        file.metadata?.contentPreview,
      ].some(value => String(value || "").toLowerCase().includes(needle));
    })
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
  const notePickerVisibleNotes = lifeNotes
    .filter(note => {
      const needle = notePickerSearch.trim().toLowerCase();
      if (!needle) return true;
      return [
        note.title,
        note.body,
        note.details,
        note.source,
        note.tags?.join(" "),
      ].some(value => String(value || "").toLowerCase().includes(needle));
    })
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

  return (
    <div className="builder-matrix-shell relative flex-1 flex flex-col overflow-hidden text-[#d8ffe4] font-sans">
      {/* App Header Selector */}
      <div className="builder-matrix-header bg-[#020804]/95 border-b border-[#00ff66]/20 px-4 py-3 select-none flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#00ff66]/10 text-[#00ff66] rounded-lg border border-[#00ff66]/25 shadow-[0_0_18px_rgba(0,255,102,0.14)]">
              <Cpu className="w-4 h-4" />
            </div>
            <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-[#b7ffd0]">
              PocketFlow Builder
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setIsBuildOrderOpen(true)}
              className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase bg-[#001b0b] hover:bg-[#003214] border border-[#00ff66]/25 rounded-lg text-[#00ff66] transition flex items-center gap-1"
              title="Open numbered build order"
            >
              <ListOrdered className="w-3.5 h-3.5" /> Order
            </button>
            <button 
              onClick={() => setViewMode(prev => prev === "canvas" ? "list" : "canvas")}
              className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase bg-[#07120b] hover:bg-[#102018] border border-[#00ff66]/15 rounded-lg text-[#b7ffd0] transition"
              title="Toggle List/Visual Workspace"
            >
              {viewMode === "canvas" ? "List View" : "Canvas Graph"}
            </button>
            <button
              onClick={handleCreateNewProject}
              className="p-1 px-2.5 bg-[#00ff66]/15 hover:bg-[#00ff66]/25 text-[#00ff66] border border-[#00ff66]/30 rounded-lg text-xs font-bold transition flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Project
            </button>
          </div>
        </div>

        {/* Project details select and quick description */}
        {projects.length > 0 && activeProject && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={activeProject.projectName}
                onChange={(e) => handleUpdateProjectName(e.target.value)}
                onFocus={() => {
                  if (activeProject) pushToUndo(activeProject);
                }}
              className="bg-transparent border-0 font-bold text-sm text-[#f1fff5] focus:outline-none focus:ring-0 w-3/4 p-0 font-mono"
                placeholder="Naming workflow..."
              />
              <button 
                onClick={handleDeleteProject}
                className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition"
                title="Delete Architecture Project"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-[#6cff9c]/55 truncate font-sans">
              {activeProject.description || "Micro-agent building pipeline blocks."}
            </p>
          </div>
        )}
      </div>

      {projects.length === 0 || !activeProject ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-12 h-12 rounded-2xl bg-[#151619] border border-[#2a2c32] flex items-center justify-center text-slate-400 text-lg mb-3">
            ⚙️
          </div>
          <h3 className="text-xs font-mono font-bold uppercase text-slate-300">No Projects Configured</h3>
          <p className="text-[11px] text-[#8e9299] max-w-[80%] mt-1">
            Build boxes to define files coding prompt instructions for Codex/Claude agents.
          </p>
          <button
            onClick={handleCreateNewProject}
            className="mt-4 px-4 py-2 bg-[#22c55e] text-black font-semibold rounded-xl text-xs hover:bg-emerald-500 active:scale-95 transition font-mono uppercase tracking-wide"
          >
            Create Architecture
          </button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden relative">
          
          {/* Active Canvas Mode View */}
          {viewMode === "canvas" && (
            <div 
              ref={canvasViewportRef}
              onMouseDown={handleCanvasPanStart}
              onTouchStart={handleCanvasPanStartTouch}
              className="builder-matrix-workspace flex-1 overflow-hidden bg-[#010301] relative relative-workspace select-none cursor-grab active:cursor-grabbing touch-none overscroll-none"
              style={{ touchAction: "none" }}
            >
              {/* Grid Background Pattern */}
              <div 
                className="absolute inset-0 w-[2000px] h-[2000px] pointer-events-none" 
                style={{
                  backgroundImage: "radial-gradient(#006b2a 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                  opacity: 0.32,
                  transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`,
                  transformOrigin: "0 0"
                }}
              />

              {/* Dynamic SVG Connection Draw Layer */}
              <svg 
                className="absolute inset-0 pointer-events-none z-10 w-[2000px] h-[2000px]"
                style={{
                  transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`,
                  transformOrigin: "0 0"
                }}
              >
                <defs>
                  <marker
                    id="arrow"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 2 L 10 5 L 0 8 z" fill="#22c55e" />
                  </marker>
                </defs>

                {activeProject.connections.map(conn => {
                  const fromBox = activeProject.boxes.find(b => b.id === conn.fromId);
                  const toBox = activeProject.boxes.find(b => b.id === conn.toId);
                  if (!fromBox || !toBox) return null;

                  // Center coordinates
                  const x1 = fromBox.position.x + boxWidth / 2;
                  const y1 = fromBox.position.y + boxHeight / 2;
                  const x2 = toBox.position.x + boxWidth / 2;
                  const y2 = toBox.position.y + boxHeight / 2;

                  return (
                    <g key={conn.id}>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#22c55e"
                        strokeWidth="1.5"
                        strokeDasharray="4,4"
                        markerEnd="url(#arrow)"
                      />
                      {/* Delete connection badge trigger */}
                      <circle
                        cx={(x1 + x2) / 2}
                        cy={(y1 + y2) / 2}
                        r="8"
                        fill="#151619"
                        stroke="#2a2c32"
                        className="cursor-pointer pointer-events-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeProject) pushToUndo(activeProject);
                          syncActiveProject({
                            ...activeProject,
                            connections: activeProject.connections.filter(c => c.id !== conn.id),
                            updatedAt: new Date().toISOString()
                          });
                          onNotify("Arrow connection removed", "warn");
                        }}
                      />
                      <text
                        x={(x1 + x2) / 2}
                        y={(y1 + y2) / 2 + 3}
                        fill="#ef4444"
                        fontSize="9"
                        textAnchor="middle"
                        fontWeight="bold"
                        className="cursor-pointer pointer-events-none select-none"
                      >
                        ×
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Box Nodes Container */}
              <div 
                className="absolute w-[2000px] h-[2000px] z-20 pointer-events-none"
                style={{
                  transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`,
                  transformOrigin: "0 0"
                }}
              >
                {activeProject.boxes.map((box, boxIndex) => {
                  const spec = getBoxStyle(box.type);
                  const Icon = spec.icon;
                  const isSelected = selectedBoxId === box.id;
                  const isConnectingActive = connectionSourceId === box.id;
                  const buildOrder = getBoxBuildOrder(box, boxIndex);

                  return (
                    <div
                      key={box.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hasDraggedRef.current) {
                          return;
                        }
                        setSelectedBoxId(box.id);
                        setIsSelectionDockMinimized(false);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (hasDraggedRef.current) {
                          return;
                        }
                        setSelectedBoxId(box.id);
                        setIsSelectionDockMinimized(false);
                        setEditingBox(box);
                      }}
                      onMouseDown={(e) => handleBoxDragStart(e, box.id)}
                      onTouchStart={(e) => handleBoxDragStartTouch(e, box.id)}
                      className={`absolute pointer-events-auto rounded-2xl p-3 border-2 transition shadow-lg shrink-0 flex flex-col justify-between overflow-hidden cursor-pointer active:scale-98 select-none ${
                        isSelected 
                          ? "border-[#22c55e] bg-[#151619] ring-2 ring-[#22c55e]/20" 
                          : isConnectingActive 
                          ? "border-amber-400 bg-[#151619] animate-pulse"
                          : `border-[#2a2c32] bg-[#151619]/90 hover:border-slate-500`
                      }`}
                      style={{
                        left: `${box.position.x}px`,
                        top: `${box.position.y}px`,
                        width: `${boxWidth}px`,
                        height: `${boxHeight}px`,
                        transform: `rotate(${box.position.rotation}deg)`,
                        touchAction: "none"
                      }}
                    >
                      <div>
                        {/* Upper line category indicator */}
                        <div className="flex items-center justify-between border-b border-[#2a2c32] pb-1">
                          <span className={`text-[8px] font-mono uppercase tracking-wider font-semibold ${spec.color}`}>
                            {spec.label}
                          </span>
                          <Icon className={`w-3 h-3 ${spec.color}`} />
                        </div>

                        {/* Title details */}
                        <h4 className="text-[11px] font-bold text-slate-100 truncate mt-1.5 leading-tight select-none">
                          {box.title}
                        </h4>
                        <p className="text-[9px] text-[#8e9299] line-clamp-2 mt-1 leading-normal select-none">
                          {box.objective || "No objectives configured"}
                        </p>
                      </div>

                      {/* Connection quick targets click handlers */}
                      {connectionSourceId && connectionSourceId !== box.id ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCompleteConnection(box.id);
                          }}
                          className="w-full text-center py-1 bg-amber-400 text-black font-semibold text-[8px] font-mono tracking-wider rounded uppercase hover:bg-amber-500 transition mt-0.5"
                        >
                          Target Here ➔
                        </button>
                      ) : (
                        isSelected ? (
                          <label className="pt-1 block">
                            <span className="sr-only">Box ID</span>
                            <input
                              type="text"
                              value={box.id}
                              onClick={(event) => event.stopPropagation()}
                              onMouseDown={(event) => event.stopPropagation()}
                              onTouchStart={(event) => event.stopPropagation()}
                              onChange={(event) => handleRenameBoxId(box.id, event.target.value)}
                              className="w-full h-6 rounded-lg bg-[#0c0c0d] border border-[#2a2c32] px-2 text-[8px] text-[#22c55e] font-mono outline-none focus:border-[#22c55e]/50"
                            />
                          </label>
                        ) : (
                          <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 pt-1 select-none">
                            <span className="truncate max-w-[70%] font-mono text-[8px]">
                              {box.id}
                            </span>
                            <span className="font-bold text-[#22c55e] select-none">#{buildOrder}</span>
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Floating workspace control slider & action buttons unified container */}
              <div className={`absolute bottom-3 left-3 right-3 z-30 flex flex-col sm:flex-row flex-wrap gap-2 items-end sm:items-center justify-between pointer-events-none transition-all duration-200 select-none ${
                draggingBox ? "opacity-0 pointer-events-none translate-y-4" : "opacity-100 translate-y-0"
              }`}>
                {/* Floating workspace control slider */}
                <div className="bg-[#151619]/95 border border-[#2a2c32] rounded-xl p-2 shadow-2xl flex items-center gap-1.5 pointer-events-auto">
                  {/* Undo Button */}
                  <button 
                    onClick={handleUndo} 
                    disabled={undoStack.length === 0}
                    className={`p-1 px-1.5 rounded transition flex items-center justify-center ${
                      undoStack.length === 0 
                        ? "opacity-35 text-slate-500 cursor-not-allowed bg-transparent" 
                        : "bg-[#2a2c32] text-[#22c55e] hover:bg-slate-700 cursor-pointer"
                    }`}
                    title={undoStack.length === 0 ? "Undo (Ctrl+Z) - No steps" : `Undo (Ctrl+Z) - ${undoStack.length} steps available`}
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  
                  {/* Redo Button */}
                  <button 
                    onClick={handleRedo} 
                    disabled={redoStack.length === 0}
                    className={`p-1 px-1.5 rounded transition flex items-center justify-center ${
                      redoStack.length === 0 
                        ? "opacity-35 text-slate-500 cursor-not-allowed bg-transparent" 
                        : "bg-[#2a2c32] text-[#22c55e] hover:bg-slate-700 cursor-pointer"
                    }`}
                    title={redoStack.length === 0 ? "Redo (Ctrl+Y / Ctrl+Shift+Z) - No steps" : `Redo (Ctrl+Y / Ctrl+Shift+Z) - ${redoStack.length} steps available`}
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="w-px h-4 bg-[#2a2c32] mx-1" />

                  <button 
                    onClick={() => setCanvasZoom(z => {
                      const next = Math.max(0.35, z - 0.1);
                      setCanvasPan(pan => clampCanvasPan(pan, next));
                      return next;
                    })} 
                    className="p-1 px-1.5 bg-[#2a2c32] text-slate-300 rounded font-bold font-mono text-xs hover:bg-slate-700 transition"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono text-[#8e9299] font-bold px-1 select-none">
                    {Math.round(canvasZoom * 100)}%
                  </span>
                  <button 
                    onClick={() => setCanvasZoom(z => {
                      const next = Math.min(2.2, z + 0.1);
                      setCanvasPan(pan => clampCanvasPan(pan, next));
                      return next;
                    })} 
                    className="p-1 px-1.5 bg-[#2a2c32] text-slate-300 rounded font-bold font-mono text-xs hover:bg-slate-700 transition"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => {
                      setCanvasZoom(1);
                      setCanvasPan({ x: 0, y: 0 });
                      onNotify("Reset workspace view", "info");
                    }}
                    className="p-1 px-1.5 bg-[#2a2c32] text-slate-300 rounded hover:bg-slate-700 transition"
                    title="Reset Pan & Zoom"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-px h-4 bg-[#2a2c32] mx-1" />
                  <button
                    onClick={() => {
                      if (activeProject) {
                        pushToUndo(activeProject);
                      }
                      const nextProj = { ...activeProject, connections: [], boxes: [] } as BuilderProject;
                      syncActiveProject(nextProj);
                      setSelectedBoxId(null);
                      setIsSelectionDockMinimized(false);
                      setEditingBox(null);
                      onNotify("Cleared canvas workspace items", "warn");
                    }}
                    className="p-1 bg-red-950/25 hover:bg-red-950/45 border border-red-500/10 text-red-400 rounded transition"
                    title="Clear Workflow Canvas"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quick Intake Dock Footer action - nested nested inside Canvas view for proper responsive spacing */}
                <div className="flex items-center gap-2 pointer-events-auto">
                  <button
                    onClick={() => setIsExportOpen(true)}
                    className="py-3 px-4 bg-[#22c55e] text-black hover:bg-emerald-500 rounded-2xl shadow-xl transition active:scale-95 text-xs font-bold font-mono uppercase tracking-widest flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" /> Handoff Package
                  </button>
                  <button
                    onClick={handleAddBox}
                    className="p-3 bg-[#151619] border border-[#2a2c32] hover:border-[#22c55e]/40 text-[#22c55e] rounded-2xl shadow-xl transition active:scale-95"
                    title="Add Box Node"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* List mode display view */}
          {viewMode === "list" && (
            <div className="pocketflow-screen-scroll flex-1 min-h-0 min-w-0 p-4 space-y-3 bg-[#0a0a0b] select-none">
              {activeProject.boxes.length === 0 ? (
                <div className="py-14 text-center select-none flex flex-col items-center justify-center p-6 border border-dashed border-[#2a2c32] rounded-2xl max-w-full">
                  <span className="text-xl">🗂️</span>
                  <h4 className="text-xs font-mono font-bold uppercase mt-2 text-slate-300">File Package Registry Empty</h4>
                  <p className="text-[10px] text-[#8e9299] max-w-[80%] mt-1">
                    Toggle canvas view to configure connected build objects.
                  </p>
                </div>
              ) : (
                getBoxesByBuildOrder(activeProject.boxes).map(box => {
                  const spec = getBoxStyle(box.type);
                  const Icon = spec.icon;
                  const isSelected = selectedBoxId === box.id;

                  return (
                    <div
                      key={box.id}
                      onClick={() => {
                        setSelectedBoxId(box.id);
                        setIsSelectionDockMinimized(false);
                      }}
                      onDoubleClick={() => {
                        setSelectedBoxId(box.id);
                        setIsSelectionDockMinimized(false);
                        setEditingBox(box);
                      }}
                      className={`p-3.5 rounded-2xl border transition flex gap-3 text-left cursor-pointer active:scale-99 ${
                        isSelected 
                          ? "border-[#22c55e] bg-[#151619] shadow-lg" 
                          : "border-[#2a2c32] bg-[#151619]/40 hover:bg-[#151619]/70"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl border shrink-0 ${spec.color} ${spec.bg} flex flex-col items-center justify-center`}>
                        <span className="text-[10px] font-mono font-black text-[#22c55e] leading-none">{box.buildOrder}</span>
                        <Icon className="w-3.5 h-3.5 mt-0.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono text-[#8e9299] uppercase tracking-wide">
                            {spec.label}
                          </span>
                          <span className="text-[9px] font-mono text-[#22c55e]">Build #{box.buildOrder}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-200 mt-0.5 truncate">{box.title}</h4>
                        <p className="text-[10px] text-[#8e9299] mt-0.5 max-w-[90%] line-clamp-1 leading-normal">
                          {box.objective || "No objective outline defined"}
                        </p>
                        {box.deliverables && (
                          <div className="mt-1.5 flex items-center gap-1 text-[9px] font-mono text-emerald-400">
                            <CornerDownRight className="w-2.5 h-2.5 shrink-0 animate-pulse" />
                            <span className="truncate">{box.deliverables}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Floating Action Nudges, Link controls, duplicators on select */}
          {selectedBoxId && !draggingBox && (
            isSelectionDockMinimized ? (
              <button
                onClick={() => setIsSelectionDockMinimized(false)}
                className="absolute bottom-[9.25rem] right-3 z-30 w-11 h-11 bg-[#151619]/95 border border-[#22c55e]/35 text-[#22c55e] rounded-2xl shadow-2xl flex items-center justify-center select-none backdrop-blur-sm hover:bg-[#22c55e]/10 transition"
                title="Open selection controls"
              >
                <Plus className="w-5 h-5" />
              </button>
            ) : (
              <div className="absolute bottom-[9.25rem] right-3 left-3 z-30 bg-[#151619]/95 border border-[#2a2c32] rounded-xl p-2 shadow-2xl flex items-center justify-between gap-2 select-none backdrop-blur-sm">
                <div className="min-w-0 select-none">
                  <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block truncate">
                    Modify Selection
                  </span>
                  <span className="text-[8px] font-mono font-bold text-rose-400 tracking-wide uppercase block truncate">
                    Connected node
                  </span>
                </div>

                <div className="flex items-center gap-1 select-none shrink-0">
                  <button
                    onClick={() => {
                      const sel = activeProject.boxes.find(b => b.id === selectedBoxId);
                      if (sel) {
                        setEditingBox(sel);
                      }
                    }}
                    className="p-2 bg-[#2a2c32] hover:bg-[#2a2c32]/80 text-[#8e9299] hover:text-white rounded-xl text-xs font-semibold tracking-wide transition flex items-center gap-1 font-mono uppercase text-[9px]"
                  >
                    <Edit className="w-3 h-3 text-[#22c55e]" /> Details
                  </button>

                  <button
                    onClick={() => handleInitiateConnection(selectedBoxId)}
                    className="p-2 bg-[#22c55e]/15 hover:bg-[#22c55e]/25 text-[#22c55e] border border-[#22c55e]/20 rounded-xl text-xs font-semibold tracking-wide transition flex items-center gap-1 font-mono uppercase text-[9px]"
                  >
                    <ArrowRight className="w-3 h-3 text-[#22c55e]" /> Link Arrow
                  </button>

                  <button
                    onClick={() => {
                      const sel = activeProject.boxes.find(b => b.id === selectedBoxId);
                      if (sel) handleDuplicateBox(sel);
                    }}
                    className="p-2 bg-[#2a2c32] hover:bg-slate-800 text-slate-300 rounded-xl transition"
                    title="Duplicate Box Spec"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteBox(selectedBoxId)}
                    className="p-2 bg-red-950/30 hover:bg-red-950 border border-red-500/25 text-red-400 rounded-xl transition"
                    title="Delete Selection"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsSelectionDockMinimized(true)}
                    className="p-2 bg-[#2a2c32] hover:bg-slate-800 text-slate-300 rounded-xl transition font-mono font-bold leading-none"
                    title="Minimize selection controls"
                  >
                    -
                  </button>
                  <button
                    onClick={() => {
                      setSelectedBoxId(null);
                      setIsSelectionDockMinimized(false);
                    }}
                    className="p-2 bg-[#0c0c0d] hover:bg-slate-900 text-slate-400 hover:text-white border border-[#2a2c32] rounded-xl transition"
                    title="Close selection controls"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          )}

          {/* Quick Intake Dock Footer action (only if not canvas view, as canvas view has its own responsive layout at the bottom) */}
          {viewMode !== "canvas" && (
            <div className="absolute bottom-4 right-4 z-10 shrink-0 select-none flex items-center gap-2">
              <button
                onClick={() => setIsExportOpen(true)}
                className="py-3 px-4 bg-[#22c55e] text-black hover:bg-emerald-500 rounded-2xl shadow-xl transition active:scale-95 text-xs font-bold font-mono uppercase tracking-widest flex items-center gap-1.5"
              >
                <Download className="w-4 h-4 stroke-[2.5]" /> Handoff Package
              </button>
              <button
                onClick={handleAddBox}
                className="p-3 bg-[#151619] border border-[#2a2c32] hover:border-[#22c55e]/40 text-[#22c55e] rounded-2xl shadow-xl transition active:scale-95"
                title="Add Box Node"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          )}

        </div>
      )}

      {/* MODAL SHEET EDITORS */}

      {/* 1. Box Specifications Sheet editor */}
      {editingBox && (
        <div className="fixed inset-0 bg-[#0c0c0d]/90 backdrop-blur-sm flex items-end justify-center z-50 animate-fade-in p-0 sm:p-3">
          <div className="absolute inset-0" onClick={() => {
            void stopBuilderDictation();
            setEditingBox(null);
          }} />
          
          <div className="relative w-full max-w-[420px] h-[92dvh] max-h-[92dvh] bg-[#151619] border border-[#2a2c32] rounded-t-[28px] sm:rounded-[28px] shadow-2xl z-[55] flex flex-col overflow-hidden animate-slide-up">
            <div className="px-5 pt-5 pb-3 border-b border-[#2a2c32]/70 shrink-0">
              <div className="w-12 h-1 bg-[#2a2c32] rounded-full mx-auto shrink-0 animate-pulse mb-4" />

              <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[9.5px] font-mono font-bold bg-[#0c0c0d] border border-[#2a2c32] px-2 py-0.5 rounded-full uppercase tracking-wider text-[#22c55e]">
                  Modify Box Blueprint
                </span>
                <h3 className="text-sm font-mono font-bold text-white mt-1.5 leading-none">
                  Core Instruction Assembly
                </h3>
              </div>
              <button 
                onClick={() => {
                  void stopBuilderDictation();
                  setEditingBox(null);
                }}
                className="p-1 bg-[#0c0c0d] border border-[#2a2c32] text-slate-400 hover:text-white rounded-full transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
              </div>
            </div>

            {/* Input fields */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-5 py-4 pb-8 space-y-4 [-webkit-overflow-scrolling:touch]">
              <div className={`rounded-2xl border p-3 ${dictationField ? "border-red-400/25 bg-red-500/10" : "border-[#22c55e]/20 bg-[#03140a]"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[8px] font-mono font-black uppercase tracking-[0.24em] text-[#22c55e]">
                      Voice Builder
                    </div>
                    <div className="mt-1 text-[10px] leading-4 text-slate-400">
                      {dictationStatus}
                    </div>
                  </div>
                  <Waves className={`w-5 h-5 shrink-0 ${dictationField ? "text-red-300 animate-pulse" : "text-[#22c55e]"}`} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-[8px] font-mono font-black uppercase tracking-widest ${voicePhaseClass}`}>
                    {voicePhaseLabel}
                  </span>
                  {dictationField && (
                    <span className="rounded-full border border-slate-500/20 bg-slate-500/10 px-2.5 py-1 text-[8px] font-mono font-black uppercase tracking-widest text-slate-300">
                      Target: {builderDictationFieldLabel(dictationField)}
                    </span>
                  )}
                  {dictationLastSaved && (
                    <span className="rounded-full border border-[#22c55e]/20 bg-[#22c55e]/10 px-2.5 py-1 text-[8px] font-mono font-black uppercase tracking-widest text-[#22c55e]">
                      {dictationLastSaved}
                    </span>
                  )}
                  {dictationField && (
                    <button
                      type="button"
                      onClick={() => handleClearBuilderField(dictationField)}
                      className="rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-[8px] font-mono font-black uppercase tracking-widest text-red-200 inline-flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear target
                    </button>
                  )}
                </div>
                {dictationInterim && (
                  <div className="mt-2 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-[10px] leading-4 text-cyan-100">
                    {dictationInterim}
                  </div>
                )}
              </div>
              <div>
                <label className="text-[9px] font-mono font-semibold text-slate-500 uppercase tracking-widest block mb-1">
                  Build Order
                </label>
                <input
                  type="number"
                  min={1}
                  max={activeProject?.boxes.length || 1}
                  value={getBoxBuildOrder(editingBox, Math.max(0, activeProject?.boxes.findIndex(box => box.id === editingBox.id) || 0))}
                  onChange={(e) => handleSetBuildOrder(editingBox.id, Number(e.target.value))}
                  className="w-full bg-[#0c0c0d] border border-[#2a2c32] hover:border-slate-600 focus:border-[#22c55e]/40 rounded-xl py-2 px-3 text-xs text-[#22c55e] focus:outline-none font-mono font-black"
                />
              </div>

              <div>
                <label className="text-[9px] font-mono font-semibold text-slate-500 uppercase tracking-widest block mb-1">
                  Box ID
                </label>
                <div className="w-full rounded-xl border border-[#2a2c32] bg-[#0c0c0d] px-3 py-2 text-xs font-mono text-slate-400">
                  {editingBox.id}
                </div>
                <p className="mt-1 text-[8px] text-slate-600 font-mono">
                  System-managed for links, handoff packages, and agent organization.
                </p>
              </div>

              <div>
                <label className="text-[9px] font-mono font-semibold text-slate-500 uppercase tracking-widest block mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editingBox.title}
                  onChange={(e) => handleUpdateBoxValue(editingBox.id, { title: e.target.value })}
                  onFocus={() => {
                    if (activeProject) pushToUndo(activeProject);
                  }}
                  className="w-full bg-[#0c0c0d] border border-[#2a2c32] hover:border-slate-600 focus:border-[#22c55e]/40 rounded-xl py-2 px-3 text-xs text-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[9px] font-mono font-semibold text-slate-500 uppercase tracking-widest mb-1 flex items-center justify-between gap-2">
                  <span>Function</span>
                  <span className="inline-flex items-center gap-1.5">
                    {renderCleanButton("objective")}
                    {renderDictationButton("objective")}
                  </span>
                </label>
                <textarea
                  value={editingBox.objective}
                  onChange={(e) => handleUpdateBoxValue(editingBox.id, { objective: e.target.value })}
                  onFocus={() => {
                    if (activeProject) pushToUndo(activeProject);
                  }}
                  rows={5}
                  placeholder="Write what this box must do."
                  className="w-full bg-[#0c0c0d] border border-[#2a2c32] hover:border-slate-600 focus:border-[#22c55e]/40 rounded-xl py-2 px-3 text-xs text-slate-300 focus:outline-none leading-relaxed font-sans resize-y min-h-[120px]"
                />
              </div>

              <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[9px] font-mono font-black uppercase tracking-[0.24em] text-[#22c55e]">
                      Archive References
                    </div>
                    <p className="mt-1 text-[10px] leading-4 text-slate-500">
                      Link PDFs, images, docs, prompts, dashboards or any Archive file to this box.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-[#2a2c32] bg-[#151619] px-2 py-1 text-[8px] font-mono font-black uppercase text-slate-400">
                    {getBoxLinkedArchiveFiles(editingBox).length} linked
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openArchivePickerForBox(editingBox)}
                    className="rounded-xl border border-[#22c55e]/25 bg-[#22c55e]/10 px-3 py-2.5 text-[9px] font-mono font-black uppercase tracking-wider text-[#22c55e] inline-flex items-center justify-center gap-1.5"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Link Archive
                  </button>
                  <button
                    type="button"
                    onClick={handleAssetUploadClick}
                    className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2.5 text-[9px] font-mono font-black uppercase tracking-wider text-cyan-200 inline-flex items-center justify-center gap-1.5"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    Upload From Archive
                  </button>
                </div>
                {getBoxLinkedArchiveFiles(editingBox).length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {getBoxLinkedArchiveFiles(editingBox).map((file) => (
                      <div key={file.id} className="flex items-center gap-2 rounded-xl border border-[#2a2c32] bg-[#151619] px-3 py-2">
                        <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-bold text-slate-200">{file.name}</div>
                          <div className="truncate text-[8px] font-mono uppercase tracking-wider text-slate-600">
                            {(file.extension || "file").toUpperCase()} · {formatBytes(file.size)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUnlinkArchiveFile(editingBox.id, file.id)}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-300"
                          aria-label={`Unlink ${file.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-[#2a2c32] px-3 py-4 text-center text-[10px] text-slate-600">
                    No files linked yet.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[9px] font-mono font-black uppercase tracking-[0.24em] text-cyan-200">
                      MemoPad Notes
                    </div>
                    <p className="mt-1 text-[10px] leading-4 text-slate-500">
                      Link captured notes, summaries, tasks, meetings or voice dictations to this Builder box.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-[#2a2c32] bg-[#151619] px-2 py-1 text-[8px] font-mono font-black uppercase text-slate-400">
                    {getBoxLinkedLifeNotes(editingBox).length} linked
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openNotePickerForBox(editingBox)}
                  className="mt-3 w-full rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2.5 text-[9px] font-mono font-black uppercase tracking-wider text-cyan-200 inline-flex items-center justify-center gap-1.5"
                >
                  <NotebookPen className="w-3.5 h-3.5" />
                  Link Notes
                </button>
                {getBoxLinkedLifeNotes(editingBox).length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {getBoxLinkedLifeNotes(editingBox).map((note) => (
                      <div key={note.id} className="flex items-start gap-2 rounded-xl border border-[#2a2c32] bg-[#151619] px-3 py-2">
                        <NotebookPen className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200/70" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[11px] font-bold text-slate-200">{note.title || "Untitled note"}</div>
                          <div className="mt-0.5 line-clamp-2 text-[9px] leading-4 text-slate-500">
                            {(note.body || note.details || "No note body saved.").slice(0, 160)}
                          </div>
                          <div className="mt-1 truncate text-[8px] font-mono uppercase tracking-wider text-slate-600">
                            {note.source} - {new Date(note.updatedAt || note.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUnlinkLifeNote(editingBox.id, note.id)}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-300"
                          aria-label={`Unlink ${note.title || "note"}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-[#2a2c32] px-3 py-4 text-center text-[10px] text-slate-600">
                    No MemoPad notes linked yet.
                  </div>
                )}
              </div>

              <div>
                <label className="text-[9px] font-mono font-semibold text-slate-500 uppercase tracking-widest mb-1 flex items-center justify-between gap-2">
                  <span>Agent Character</span>
                  <span className="inline-flex items-center gap-1.5">
                    {renderCleanButton("implementationInstructions")}
                    {renderDictationButton("implementationInstructions")}
                  </span>
                </label>
                <textarea
                  value={editingBox.implementationInstructions}
                  onChange={(e) => handleUpdateBoxValue(editingBox.id, { implementationInstructions: e.target.value })}
                  onFocus={() => {
                    if (activeProject) pushToUndo(activeProject);
                  }}
                  rows={5}
                  placeholder="Write how the agent should behave."
                  className="w-full bg-[#0c0c0d] border border-[#2a2c32] hover:border-slate-600 focus:border-[#22c55e]/40 rounded-xl py-2 px-3 text-xs text-slate-300 focus:outline-none leading-relaxed font-sans resize-y min-h-[120px]"
                />
              </div>

              <div>
                <label className="text-[9px] font-mono font-semibold text-slate-500 uppercase tracking-widest mb-1 flex items-center justify-between gap-2">
                  <span>Prompt</span>
                  <span className="inline-flex items-center gap-2">
                    <span className="text-[8px] text-[#22c55e] animate-pulse">Codex Ready</span>
                    {renderCleanButton("agentPrompt")}
                    {renderDictationButton("agentPrompt")}
                  </span>
                </label>
                <textarea
                  value={editingBox.agentPrompt}
                  onChange={(e) => handleUpdateBoxValue(editingBox.id, { agentPrompt: e.target.value })}
                  onFocus={() => {
                    if (activeProject) pushToUndo(activeProject);
                  }}
                  rows={9}
                  placeholder="Write the full prompt by hand."
                  className="w-full bg-[#0c0c0d] border border-[#2a2c32] hover:border-slate-600 focus:border-[#22c55e]/40 rounded-xl py-2 px-3 text-xs text-slate-300 focus:outline-none leading-relaxed font-mono resize-y min-h-[220px]"
                />
              </div>

              <div className="rounded-2xl border border-[#22c55e]/20 bg-[#03140a] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsPromptPreviewOpen((value) => !value)}
                  className="w-full px-3 py-3 flex items-center justify-between gap-3 text-left"
                >
                  <div>
                    <div className="text-[8px] font-mono font-black uppercase tracking-[0.24em] text-[#22c55e]">
                      Prompt Preview
                    </div>
                    <div className="mt-1 text-[10px] leading-4 text-slate-400">
                      Final composed instruction before export or sending.
                    </div>
                  </div>
                  <span className="rounded-full border border-[#22c55e]/25 bg-[#22c55e]/10 px-2.5 py-1 text-[8px] font-mono font-black uppercase tracking-widest text-[#22c55e]">
                    {isPromptPreviewOpen ? "Hide" : "Open"}
                  </span>
                </button>
                {isPromptPreviewOpen && (
                  <div className="border-t border-[#22c55e]/10 p-3 space-y-3">
                    <pre className="max-h-[260px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-[#2a2c32] bg-[#0c0c0d] p-3 text-[10px] leading-5 text-slate-300 [-webkit-overflow-scrolling:touch]">{composeBoxPromptPreview(editingBox)}</pre>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopyPromptPreview(editingBox)}
                        className="py-2.5 rounded-xl border border-[#22c55e]/25 bg-[#22c55e]/10 text-[#22c55e] text-[9px] font-mono font-black uppercase tracking-widest inline-flex items-center justify-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCleanBuilderField("agentPrompt")}
                        className="py-2.5 rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200 text-[9px] font-mono font-black uppercase tracking-widest inline-flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Clean Prompt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-[#2a2c32] bg-[#151619] p-5 shrink-0">
                <button
                  onClick={() => {
                    void stopBuilderDictation();
                    handleDeleteBox(editingBox.id);
                  }}
                  className="py-3 px-4 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-500/10 hover:border-red-500/25 font-mono text-[10px] font-bold rounded-2xl transition uppercase tracking-wider text-center"
                >
                  Delete Box Node
                </button>
                <button
                  onClick={() => {
                    void stopBuilderDictation();
                    setEditingBox(null);
                  }}
                  className="py-3 px-4 bg-[#22c55e] hover:bg-emerald-500 text-black font-mono text-[10px] font-bold rounded-2xl transition uppercase tracking-wider text-center"
                >
                  Apply Blueprint
                </button>
            </div>
          </div>
        </div>
      )}

      {isArchivePickerOpen && editingBox && (
        <div className="absolute inset-0 bg-[#0c0c0d]/90 backdrop-blur-sm flex items-end justify-center z-[60] animate-fade-in p-0 select-none">
          <div className="absolute inset-0" onClick={() => setIsArchivePickerOpen(false)} />
          <div className="relative z-[65] flex max-h-[90dvh] w-full max-w-[420px] flex-col overflow-hidden rounded-t-[32px] border-t border-[#2a2c32] bg-[#151619] shadow-2xl animate-slide-up">
            <div className="shrink-0 border-b border-[#2a2c32] px-5 pb-3 pt-5">
              <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-[#2a2c32]" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[9px] font-mono font-black uppercase tracking-[0.24em] text-[#22c55e]">
                    Archive Picker
                  </div>
                  <h3 className="mt-1 truncate text-lg font-black text-white">Link files to box</h3>
                  <p className="mt-1 text-[10px] leading-4 text-slate-500">
                    Select multiple archive files. They stay in Archive and this box stores clean references.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsArchivePickerOpen(false)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#2a2c32] bg-[#0c0c0d] text-slate-400"
                  aria-label="Close archive picker"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={archivePickerSearch}
                  onChange={(event) => setArchivePickerSearch(event.target.value)}
                  placeholder="Search Archive files..."
                  className="w-full rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] py-3 pl-10 pr-3 text-sm text-white placeholder-slate-500 outline-none focus:border-[#22c55e]/40"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 [-webkit-overflow-scrolling:touch]">
              {archivePickerVisibleFiles.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {archivePickerVisibleFiles.map((file) => {
                    const selected = archivePickerSelectedIds.includes(file.id);
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => handleToggleArchivePickerFile(file.id)}
                        className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                          selected
                            ? "border-[#22c55e] bg-[#22c55e]/10"
                            : "border-[#2a2c32] bg-[#0c0c0d]"
                        }`}
                      >
                        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                          selected ? "bg-[#22c55e] text-black" : "bg-[#151619] text-slate-500"
                        }`}>
                          {selected ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-black text-slate-100">{file.name}</div>
                          <div className="mt-1 truncate text-[9px] font-mono uppercase tracking-wider text-slate-500">
                            {(file.extension || "file").toUpperCase()} · {file.category} · {formatBytes(file.size)}
                          </div>
                          {(file.folderPath && file.folderPath !== "/") && (
                            <div className="mt-0.5 truncate text-[9px] text-slate-600">{file.folderPath}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-[#2a2c32] px-6 py-12 text-center">
                  <FolderOpen className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                  <div className="text-sm font-black text-slate-300">No archive files found</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Upload files into Archive first, or clear the search.</p>
                </div>
              )}
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-[#2a2c32] bg-[#151619] p-4">
              <button
                type="button"
                onClick={() => setArchivePickerSelectedIds([])}
                className="rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] px-4 py-3 text-[10px] font-mono font-black uppercase tracking-wider text-slate-300"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleAttachArchivePickerFiles}
                className="rounded-2xl bg-[#22c55e] px-4 py-3 text-[10px] font-mono font-black uppercase tracking-wider text-black"
              >
                Attach {archivePickerSelectedIds.length}
              </button>
            </div>
          </div>
        </div>
      )}

      {isNotePickerOpen && editingBox && (
        <div className="absolute inset-0 bg-[#0c0c0d]/90 backdrop-blur-sm flex items-end justify-center z-[60] animate-fade-in p-0 select-none">
          <div className="absolute inset-0" onClick={() => setIsNotePickerOpen(false)} />
          <div className="relative z-[65] flex max-h-[90dvh] w-full max-w-[420px] flex-col overflow-hidden rounded-t-[32px] border-t border-[#2a2c32] bg-[#151619] shadow-2xl animate-slide-up">
            <div className="shrink-0 border-b border-[#2a2c32] px-5 pb-3 pt-5">
              <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-[#2a2c32]" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[9px] font-mono font-black uppercase tracking-[0.24em] text-cyan-200">
                    MemoPad Picker
                  </div>
                  <h3 className="mt-1 truncate text-lg font-black text-white">Link notes to box</h3>
                  <p className="mt-1 text-[10px] leading-4 text-slate-500">
                    Select captured notes from MemoPad / Calenotes. The notes stay in memory and this box stores clean references.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNotePickerOpen(false)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#2a2c32] bg-[#0c0c0d] text-slate-400"
                  aria-label="Close MemoPad note picker"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="relative mt-4">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={notePickerSearch}
                  onChange={(event) => setNotePickerSearch(event.target.value)}
                  placeholder="Search MemoPad notes..."
                  className="w-full rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] py-3 pl-10 pr-3 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-300/40"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 [-webkit-overflow-scrolling:touch]">
              {notePickerVisibleNotes.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {notePickerVisibleNotes.map((note) => {
                    const selected = notePickerSelectedIds.includes(note.id);
                    return (
                      <button
                        key={note.id}
                        type="button"
                        onClick={() => handleToggleNotePickerNote(note.id)}
                        className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                          selected
                            ? "border-cyan-300 bg-cyan-300/10"
                            : "border-[#2a2c32] bg-[#0c0c0d]"
                        }`}
                      >
                        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                          selected ? "bg-cyan-200 text-black" : "bg-[#151619] text-slate-500"
                        }`}>
                          {selected ? <Check className="h-4 w-4" /> : <NotebookPen className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-black text-slate-100">{note.title || "Untitled note"}</div>
                          <div className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">
                            {(note.body || note.details || "No note body saved.").slice(0, 220)}
                          </div>
                          <div className="mt-2 truncate text-[9px] font-mono uppercase tracking-wider text-slate-600">
                            {note.source} - {new Date(note.updatedAt || note.createdAt).toLocaleDateString()}
                            {note.tags?.length ? ` - ${note.tags.slice(0, 4).join(", ")}` : ""}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-[#2a2c32] px-6 py-12 text-center">
                  <NotebookPen className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                  <div className="text-sm font-black text-slate-300">No MemoPad notes found</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Capture notes in MemoPad first, or clear the search.</p>
                </div>
              )}
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-[#2a2c32] bg-[#151619] p-4">
              <button
                type="button"
                onClick={() => setNotePickerSelectedIds([])}
                className="rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] px-4 py-3 text-[10px] font-mono font-black uppercase tracking-wider text-slate-300"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleAttachNotePickerNotes}
                className="rounded-2xl bg-cyan-200 px-4 py-3 text-[10px] font-mono font-black uppercase tracking-wider text-black"
              >
                Attach {notePickerSelectedIds.length}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Numbered Build Order Sheet */}
      {isBuildOrderOpen && activeProject && (
        <div className="absolute inset-0 bg-[#0c0c0d]/90 backdrop-blur-sm flex items-end justify-center z-50 animate-fade-in p-0 select-none">
          <div className="absolute inset-0" onClick={() => setIsBuildOrderOpen(false)} />
          <div className="relative w-full max-w-[420px] max-h-[88%] bg-[#151619] border-t border-[#2a2c32] rounded-t-[32px] shadow-2xl z-[55] flex flex-col overflow-hidden animate-slide-up">
            <div className="px-5 pt-5 pb-3 border-b border-[#2a2c32] shrink-0">
              <div className="w-12 h-1 bg-[#2a2c32] rounded-full mx-auto mb-4" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[9.5px] font-mono font-bold bg-[#0c0c0d] border border-[#2a2c32] px-2 py-0.5 rounded-full uppercase tracking-wider text-[#22c55e]">
                    Codex Build Logic
                  </span>
                  <h3 className="text-base font-mono font-bold text-white mt-1.5 leading-tight">
                    Numbered Box List
                  </h3>
                </div>
                <button
                  onClick={() => setIsBuildOrderOpen(false)}
                  className="p-1 bg-[#0c0c0d] border border-[#2a2c32] text-slate-400 hover:text-white rounded-full transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-[#8e9299] mt-2 leading-relaxed">
                This order is used by the handoff package. Canvas position stays free.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {activeProject.boxes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#2a2c32] p-6 text-center text-[10px] font-mono text-slate-500">
                  No boxes yet. Add nodes to create a build sequence.
                </div>
              ) : (
                getBoxesByBuildOrder(activeProject.boxes).map((box, index, list) => {
                  const spec = getBoxStyle(box.type);
                  const Icon = spec.icon;
                  const isSelected = selectedBoxId === box.id;
                  return (
                    <div
                      key={box.id}
                      className={`rounded-2xl border p-3 bg-[#0c0c0d] ${isSelected ? "border-[#22c55e]/60" : "border-[#2a2c32]"}`}
                    >
                      <div className="flex items-start gap-3">
                        <label className="shrink-0">
                          <span className="sr-only">Build order</span>
                          <input
                            type="number"
                            min={1}
                            max={list.length}
                            value={box.buildOrder || index + 1}
                            onChange={(event) => handleSetBuildOrder(box.id, Number(event.target.value))}
                            className="w-12 h-10 rounded-xl bg-[#151619] border border-[#2a2c32] text-center text-[#22c55e] text-sm font-mono font-black outline-none focus:border-[#22c55e]/50"
                          />
                        </label>
                        <button
                          onClick={() => {
                            setSelectedBoxId(box.id);
                            setIsSelectionDockMinimized(false);
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex items-center gap-1.5 text-[8px] font-mono uppercase tracking-widest text-slate-500">
                            <Icon className={`w-3 h-3 ${spec.color}`} />
                            <span>{spec.label}</span>
                          </div>
                          <h4 className="mt-1 text-sm font-bold text-slate-100 truncate">{box.title}</h4>
                          <p className="mt-0.5 text-[10px] text-[#8e9299] line-clamp-2 leading-relaxed">
                            {box.objective || "No function written yet."}
                          </p>
                        </button>
                      </div>

                      <label className="mt-3 block">
                        <span className="text-[8px] font-mono uppercase tracking-widest text-slate-600">Box ID</span>
                        <input
                          type="text"
                          value={box.id}
                          onChange={(event) => handleRenameBoxId(box.id, event.target.value)}
                          className="mt-1 w-full h-9 rounded-xl bg-[#151619] border border-[#2a2c32] px-3 text-[10px] text-slate-200 font-mono outline-none focus:border-[#22c55e]/50"
                        />
                      </label>

                      <div className="mt-3 grid grid-cols-4 gap-2">
                        <button
                          disabled={index === 0}
                          onClick={() => handleMoveBuildOrder(box.id, -1)}
                          className="h-9 rounded-xl border border-[#2a2c32] disabled:opacity-30 text-slate-300 flex items-center justify-center"
                          title="Move earlier"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          disabled={index === list.length - 1}
                          onClick={() => handleMoveBuildOrder(box.id, 1)}
                          className="h-9 rounded-xl border border-[#2a2c32] disabled:opacity-30 text-slate-300 flex items-center justify-center"
                          title="Move later"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedBoxId(box.id);
                            setIsSelectionDockMinimized(false);
                            setEditingBox(box);
                          }}
                          className="h-9 rounded-xl border border-[#2a2c32] text-slate-300 text-[9px] font-mono font-bold uppercase"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteBox(box.id)}
                          className="h-9 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 flex items-center justify-center"
                          title="Delete box"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-[#2a2c32] bg-[#151619] p-4 shrink-0">
              <button
                onClick={normalizeBuildOrder}
                className="py-3 px-4 bg-[#2a2c32] hover:bg-slate-700/85 text-slate-200 font-mono text-[10px] font-bold rounded-2xl transition uppercase tracking-wider"
              >
                Normalize
              </button>
              <button
                onClick={() => setIsBuildOrderOpen(false)}
                className="py-3 px-4 bg-[#22c55e] hover:bg-emerald-500 text-black font-mono text-[10px] font-bold rounded-2xl transition uppercase tracking-wider"
              >
                Apply Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Handoff Export Package Modal Sheet */}
      {isExportOpen && (
        <div className="fixed inset-0 bg-[#0c0c0d]/90 backdrop-blur-sm flex items-end justify-center z-50 animate-fade-in p-0 select-none">
          <div className="absolute inset-0" onClick={() => setIsExportOpen(false)} />
          
          <div className="relative w-full max-w-[420px] bg-[#151619] border-t border-[#2a2c32] rounded-t-[32px] p-6 shadow-2xl z-55 flex flex-col gap-4 animate-slide-up max-h-[85%] overflow-y-auto select-none">
            <div className="w-12 h-1 bg-[#2a2c32] rounded-full mx-auto shrink-0" />

            <div className="flex items-start justify-between select-none">
              <div>
                <span className="text-[9.5px] font-mono font-bold bg-[#0c0c0d] border border-[#2a2c32] px-2 py-0.5 rounded-full uppercase tracking-wider text-[#22c55e]">
                  Compilation Deck
                </span>
                <h3 className="text-base font-mono font-bold text-white mt-1.5 leading-tight select-none">
                  AI Agent Codex Package
                </h3>
              </div>
              <button 
                onClick={() => setIsExportOpen(false)}
                className="p-1 bg-[#0c0c0d] border border-[#2a2c32] text-slate-400 hover:text-white rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[10px] text-[#8e9299] leading-relaxed -mt-1 font-sans">
              This package exports your visual diagram nodes into bundled markdown prompts. Any code execution model (Codex, Claude, cursor agents) can intake this data to write code.
            </p>

            <div className="rounded-2xl border border-[#2a2c32] bg-[#0c0c0d] p-3">
              <label className="block text-[9px] font-mono font-black uppercase tracking-[0.18em] text-slate-500">
                Archive package name
              </label>
              <input
                value={handoffPackageName}
                onChange={(event) => setHandoffPackageName(event.target.value)}
                placeholder={`${activeProject.projectName || "PocketFlow Builder"} handoff`}
                className="mt-2 w-full rounded-xl border border-[#2a2c32] bg-[#151619] px-3 py-3 text-sm font-black text-white outline-none placeholder:text-slate-600 focus:border-[#22c55e]/50"
              />
              <div className="mt-2 flex items-center gap-2 text-[9px] font-mono font-black uppercase tracking-wider text-[#22c55e]">
                <FolderOpen className="h-3.5 w-3.5" />
                Saves to Archive / {BUILDER_HANDOFF_FOLDER_NAME}
              </div>
            </div>

            {/* Structured file preview block */}
            <div className="bg-[#0c0c0d] border border-[#2a2c32] rounded-2xl p-4 flex flex-col gap-1 text-[11px] font-mono leading-none">
              <span className="text-yellow-500">📁 {BUILDER_HANDOFF_FOLDER_NAME}</span>
              <span className="text-slate-450 ml-4">└── project-architecture.json</span>
              <span className="text-slate-450 ml-4">└── README.md</span>
              <span className="text-slate-450 ml-4">└── BUILD_ORDER.md</span>
              <span className="text-slate-450 ml-4">└── AGENT_INSTRUCTIONS.md</span>
              <span className="text-slate-450 ml-4 flex items-center gap-1">
                └── 📁 boxes/ 
                <span className="text-slate-600 font-sans">({activeProject.boxes.length} specifications generated)</span>
              </span>
            </div>

            {/* RAW content preview */}
            <div className="space-y-1.5 select-none">
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block">
                Source Handoff Preview
              </span>
              <div className="bg-[#0c0c0d] rounded-xl p-3.5 border border-[#2a2c32] max-h-[140px] overflow-y-auto text-[9.5px] text-slate-400 font-mono leading-relaxed whitespace-pre overflow-x-auto select-all">
                {generateHandoffData()}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5 pt-2 select-none select-none">
              <button
                onClick={handleShareHandoff}
                className="col-span-2 py-3 px-4 bg-[#00ff66]/10 hover:bg-[#00ff66]/15 text-[#9dffbd] border border-[#00ff66]/25 font-mono text-[10px] font-bold rounded-2xl transition uppercase tracking-wider text-center flex items-center justify-center gap-1 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" /> Share Direct
              </button>
              <button
                onClick={handleCopyToClipboard}
                className="py-3 px-4 bg-[#2a2c32] hover:bg-slate-700/85 text-slate-200 border border-transparent font-mono text-[10px] font-bold rounded-2xl transition uppercase tracking-wider text-center flex items-center justify-center gap-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-[#22c55e]" /> Copy Core markdown
              </button>
              <button
                onClick={handleDownloadHandoff}
                className="py-3 px-4 bg-[#22c55e] hover:bg-emerald-500 text-black font-mono text-[10px] font-bold rounded-2xl transition uppercase tracking-wider text-center flex items-center justify-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" /> Save to Builder
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
