import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ListChecks,
  Mic,
  MicOff,
  NotebookPen,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  CalenoteAgentCall,
  LifeCalendarEvent,
  LifeNote,
  LifeTaskList,
  addDays,
  analyzeCalenoteText,
  createCalenoteFromText,
  deleteCalendarEvent,
  deleteLifeNote,
  deleteTaskList,
  formatLifeDate,
  labelLifeDate,
  loadCalendarEvents,
  loadLifeNotes,
  loadTaskLists,
  updateTaskItemDone,
  upsertCalendarEvent,
  upsertLifeNote,
} from "../utils/lifeMemory";
import { addPocketNotification } from "../utils/pocketNotifications";

interface CalenotesAppProps {
  onNotify?: (message: string, type: "success" | "info" | "warn") => void;
}

type CalenotesView = "write" | "tasks" | "calendar" | "notes";
type CalenotesSpeechLocale = "auto";

interface SpeechResultDetail {
  ok?: boolean;
  transcript?: string;
  confidence?: number;
  interim?: boolean;
  mode?: string;
  message?: string;
}

const emptyDraft = () => ({
  id: "",
  title: "",
  body: "",
  tags: "",
});

const emptyEventDraft = () => ({
  id: "",
  title: "",
  date: formatLifeDate(new Date()),
  time: "12:00",
  notes: "",
});

const categoryLabels: Record<LifeTaskList["category"], string> = {
  "food-shopping": "Food",
  "home-shopping": "House",
  "wardrobe-shopping": "Wardrobe",
  shopping: "Shopping",
  "calendar-prep": "Calendar",
  work: "Work",
  personal: "Personal",
  generic: "Task",
};

const todayIso = () => formatLifeDate(new Date());
const CALENOTES_DAILY_TASK_NOTICE_KEY = "pocketflow.calenotes.dailyTaskNotice.v1";
const CALENOTES_EVENT_NOTICE_PREFIX = "pocketflow.calenotes.eventNotice.";
const CALENOTES_SPEECH_LOCALE: CalenotesSpeechLocale = "auto";

const resolveSpeechLocale = (locale: CalenotesSpeechLocale) => {
  return locale;
};

export default function CalenotesApp({ onNotify }: CalenotesAppProps) {
  const [view, setView] = useState<CalenotesView>("write");
  const [notes, setNotes] = useState<LifeNote[]>(loadLifeNotes);
  const [events, setEvents] = useState<LifeCalendarEvent[]>(loadCalendarEvents);
  const [taskLists, setTaskLists] = useState<LifeTaskList[]>(loadTaskLists);
  const [draft, setDraft] = useState(emptyDraft);
  const [eventDraft, setEventDraft] = useState(emptyEventDraft);
  const [agentCheck, setAgentCheck] = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [query, setQuery] = useState("");
  const [dictating, setDictating] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [voiceStatus, setVoiceStatus] = useState("Voice ready.");
  const [dictationStartedAt, setDictationStartedAt] = useState<number | null>(null);
  const [dictationSeconds, setDictationSeconds] = useState(0);
  const [dictationChunkCount, setDictationChunkCount] = useState(0);
  const lastTranscriptRef = useRef("");
  const dictatingRef = useRef(false);
  const speechLocaleRef = useRef<CalenotesSpeechLocale>(CALENOTES_SPEECH_LOCALE);
  const draftBodyRef = useRef("");
  const interimTextRef = useRef("");
  const provisionalTranscriptRef = useRef("");
  const provisionalBaseBodyRef = useRef<string | null>(null);
  const dictationChunksRef = useRef<string[]>([]);
  const nativeRestartTimerRef = useRef<number | null>(null);
  const browserRecognitionRef = useRef<any>(null);
  const nativeDictationRef = useRef(false);

  const refresh = () => {
    setNotes(loadLifeNotes());
    setEvents(loadCalendarEvents());
    setTaskLists(loadTaskLists());
  };

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("pocketflow-life-memory-updated", handler);
    return () => window.removeEventListener("pocketflow-life-memory-updated", handler);
  }, []);

  useEffect(() => {
    const today = todayIso();
    if (localStorage.getItem(CALENOTES_DAILY_TASK_NOTICE_KEY) === today) return;
    const incompleteShoppingLists = taskLists.filter((list) =>
      list.agentStatus !== "complete" &&
      list.dueDate <= today &&
      list.category.includes("shopping") &&
      list.items.some((item) => !item.done),
    );
    if (!incompleteShoppingLists.length) return;
    const missingCount = incompleteShoppingLists.reduce((sum, list) => sum + list.items.filter((item) => !item.done).length, 0);
    addPocketNotification({
      title: "MemoPad shopping list still open",
      message: `${missingCount} item${missingCount === 1 ? "" : "s"} still unchecked across ${incompleteShoppingLists.length} list${incompleteShoppingLists.length === 1 ? "" : "s"}.`,
      source: "calenotes",
      severity: "warning",
      actionApp: "notes",
      actionLabel: "Open MemoPad",
      metadata: { persist: true, notificationType: "calenotes_daily_tasks" },
    });
    localStorage.setItem(CALENOTES_DAILY_TASK_NOTICE_KEY, today);
  }, [taskLists]);

  useEffect(() => {
    const checkUpcomingEvents = () => {
      const now = new Date();
      const today = formatLifeDate(now);
      events.forEach((event) => {
        if (event.date !== today || !event.time) return;
        const eventAt = new Date(`${event.date}T${event.time}:00`);
        const minutesUntil = Math.round((eventAt.getTime() - now.getTime()) / 60000);
        if (minutesUntil < 0 || minutesUntil > 30) return;
        const noticeKey = `${CALENOTES_EVENT_NOTICE_PREFIX}${event.id}.${event.date}.${event.time}`;
        if (localStorage.getItem(noticeKey) === "sent") return;
        addPocketNotification({
          title: "Calendar event soon",
          message: `${event.title} starts in ${Math.max(0, minutesUntil)} minute${minutesUntil === 1 ? "" : "s"}.`,
          source: "calenotes",
          severity: "warning",
          actionApp: "notes",
          actionLabel: "Open MemoPad",
          metadata: { persist: true, eventId: event.id, notificationType: "calenotes_event_warning" },
        });
        localStorage.setItem(noticeKey, "sent");
      });
    };
    checkUpcomingEvents();
    const timer = window.setInterval(checkUpcomingEvents, 60_000);
    return () => window.clearInterval(timer);
  }, [events]);

  useEffect(() => () => {
    if (nativeRestartTimerRef.current) window.clearTimeout(nativeRestartTimerRef.current);
    nativeDictationRef.current = false;
    try {
      browserRecognitionRef.current?.abort?.();
    } catch {}
    void window.PocketFlowReceiveBridge?.notesStopTranscription?.();
    void window.PocketFlowReceiveBridge?.spinoStopSpeechRecognition?.();
  }, []);

  useEffect(() => {
    dictatingRef.current = dictating;
  }, [dictating]);

  useEffect(() => {
    draftBodyRef.current = draft.body;
  }, [draft.body]);

  useEffect(() => {
    interimTextRef.current = interimText;
  }, [interimText]);

  useEffect(() => {
    if (!dictationStartedAt) {
      setDictationSeconds(0);
      return undefined;
    }
    const update = () => setDictationSeconds(Math.max(0, Math.floor((Date.now() - dictationStartedAt) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [dictationStartedAt]);

  const analysis = useMemo(() => analyzeCalenoteText(draft.body || draft.title), [draft.body, draft.title]);
  const draftWordCount = useMemo(() => draft.body.trim().split(/\s+/).filter(Boolean).length, [draft.body]);

  const selectedEvents = useMemo(
    () => events.filter((event) => event.date === selectedDate).sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99")),
    [events, selectedDate],
  );

  const upcomingEvents = useMemo(
    () => events.filter((event) => event.date >= todayIso()).sort((a, b) => `${a.date}T${a.time || "99:99"}`.localeCompare(`${b.date}T${b.time || "99:99"}`)).slice(0, 8),
    [events],
  );

  const activeTasks = useMemo(
    () => taskLists.filter((list) => list.agentStatus !== "complete").sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [taskLists],
  );

  const filteredNotes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return notes;
    return notes.filter((note) => `${note.title} ${note.body} ${note.tags.join(" ")}`.toLowerCase().includes(needle));
  }, [notes, query]);

  const normalizeTranscriptKey = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();
  const normalizeTranscriptWord = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

  const collapseRepeatedTranscript = (text: string) => {
    let words = text.replace(/\s+/g, " ").trim().split(/\s+/).filter(Boolean);
    if (words.length < 2) return words.join(" ");

    let changed = true;
    while (changed) {
      changed = false;
      const next: string[] = [];
      let index = 0;
      while (index < words.length) {
        let repeatedSize = 0;
        const maxSize = Math.min(14, Math.floor((words.length - index) / 2));
        for (let size = maxSize; size >= 1; size -= 1) {
          const left = words.slice(index, index + size).map(normalizeTranscriptWord).join(" ");
          const right = words.slice(index + size, index + size * 2).map(normalizeTranscriptWord).join(" ");
          if (left && left === right) {
            repeatedSize = size;
            break;
          }
        }
        next.push(...words.slice(index, index + (repeatedSize || 1)));
        index += repeatedSize ? repeatedSize * 2 : 1;
        if (repeatedSize) changed = true;
      }
      words = next;
    }

    return words.join(" ");
  };

  const trimOverlappingSpeech = (baseBody: string, text: string) => {
    const incomingWords = text.trim().split(/\s+/).filter(Boolean);
    const baseWords = baseBody.trim().split(/\s+/).filter(Boolean);
    if (!incomingWords.length || !baseWords.length) return text.trim();
    const maxOverlap = Math.min(incomingWords.length, baseWords.length, 30);
    for (let size = maxOverlap; size >= 1; size -= 1) {
      const baseTail = baseWords.slice(-size).map(normalizeTranscriptWord).join(" ");
      const incomingHead = incomingWords.slice(0, size).map(normalizeTranscriptWord).join(" ");
      if (baseTail && baseTail === incomingHead) {
        return incomingWords.slice(size).join(" ").trim();
      }
    }
    return text.trim();
  };

  const removeProvisionalFromBody = (body: string) => {
    const provisional = provisionalTranscriptRef.current.trim();
    const current = body.trim();
    if (provisionalBaseBodyRef.current !== null) return provisionalBaseBodyRef.current;
    if (!provisional) return current;
    if (current.endsWith(provisional)) return current.slice(0, -provisional.length).trim();
    return current;
  };

  const setDraftBodyWithTranscript = (text: string, provisional: boolean) => {
    const cleanText = collapseRepeatedTranscript(text.trim());
    if (!cleanText) return;
    const previousProvisional = provisionalTranscriptRef.current.trim();
    setDraft((value) => {
      const current = value.body.trim();
      let base = provisionalBaseBodyRef.current ?? current;
      if (previousProvisional && current.endsWith(previousProvisional)) {
        base = current.slice(0, -previousProvisional.length).trim();
      }
      if (provisional && provisionalBaseBodyRef.current === null) {
        provisionalBaseBodyRef.current = base;
      }
      const nextText = provisional ? cleanText : trimOverlappingSpeech(base, cleanText);
      const next = [base, nextText].filter(Boolean).join(base ? "\n" : "");
      return { ...value, body: next };
    });
    provisionalTranscriptRef.current = provisional ? cleanText : "";
    if (!provisional) provisionalBaseBodyRef.current = null;
  };

  const extractFreshTranscript = (text: string, bodyOverride?: string) => {
    const key = normalizeTranscriptKey(text);
    const previousKey = lastTranscriptRef.current;
    const bodyKey = normalizeTranscriptKey(bodyOverride ?? draftBodyRef.current);
    if (!key) return "";
    if (key === previousKey) return "";
    if (previousKey && key.startsWith(previousKey)) {
      const fresh = text.slice(previousKey.length).replace(/^[\s.,;:!?-]+/, "").trim();
      return fresh;
    }
    if (bodyKey && bodyKey.endsWith(key)) return "";
    return text;
  };

  const appendTranscript = (transcript: string, interim = false) => {
    // Keep the recognizer's words intact in the note. Command normalization
    // belongs to task analysis, not to the visible transcription.
    const transcriptText = collapseRepeatedTranscript(transcript.trim());
    if (!transcriptText) return;
    if (interim) {
      setInterimText(transcriptText);
      setDraftBodyWithTranscript(transcriptText, true);
      return;
    }
    const baseBody = removeProvisionalFromBody(draftBodyRef.current);
    const text = trimOverlappingSpeech(baseBody, extractFreshTranscript(transcriptText, baseBody));
    if (!text) return;
    lastTranscriptRef.current = normalizeTranscriptKey(transcriptText);
    dictationChunksRef.current = [...dictationChunksRef.current, text].slice(-240);
    setDictationChunkCount(dictationChunksRef.current.length);
    setInterimText("");
    setDraftBodyWithTranscript(text, false);
  };

  const commitInterimTranscript = () => {
    const text = interimTextRef.current.trim();
    if (!text) return false;
    const baseBody = removeProvisionalFromBody(draftBodyRef.current);
    const fresh = extractFreshTranscript(text, baseBody) || text;
    lastTranscriptRef.current = normalizeTranscriptKey(text);
    dictationChunksRef.current = [...dictationChunksRef.current, fresh].slice(-240);
    setDictationChunkCount(dictationChunksRef.current.length);
    setDraftBodyWithTranscript(fresh, false);
    setInterimText("");
    return true;
  };

  const startNativeDictation = async () => {
    const locale = resolveSpeechLocale(speechLocaleRef.current);
    if (window.PocketFlowReceiveBridge?.notesStartTranscription) {
      return window.PocketFlowReceiveBridge.notesStartTranscription("calenotes", locale);
    }
    return window.PocketFlowReceiveBridge?.spinoStartSpeechRecognition?.(locale) || { ok: false, message: "Speech bridge unavailable." };
  };

  const stopNativeDictation = async () => {
    nativeDictationRef.current = false;
    if (window.PocketFlowReceiveBridge?.notesStopTranscription) return window.PocketFlowReceiveBridge.notesStopTranscription();
    return window.PocketFlowReceiveBridge?.spinoStopSpeechRecognition?.() || { ok: true };
  };

  const restartNativeDictation = (delay = 550) => {
    if (nativeRestartTimerRef.current) window.clearTimeout(nativeRestartTimerRef.current);
    nativeRestartTimerRef.current = window.setTimeout(() => {
      nativeRestartTimerRef.current = null;
      if (!dictatingRef.current) return;
      void startNativeDictation();
    }, delay);
  };

  const startBrowserDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceStatus("No browser speech recognizer. Use phone native transcription.");
      return false;
    }
    const recognition = new SpeechRecognition();
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event: any) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript?.trim() || "";
        if (text) appendTranscript(text, !result.isFinal);
      }
    };
    recognition.onend = () => {
      if (!dictatingRef.current) {
        setDictating(false);
        return;
      }
      window.setTimeout(() => {
        if (!dictatingRef.current) return;
        try {
          recognition.start();
        } catch {
          restartNativeDictation(900);
        }
      }, 450);
    };
    recognition.onerror = (event: any) => {
      if (!dictatingRef.current) return;
      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        setVoiceStatus("Microphone permission is blocked. Re-enable mic access to continue.");
        return;
      }
      window.setTimeout(() => {
        try {
          if (dictatingRef.current) recognition.start();
        } catch {
          restartNativeDictation(900);
        }
      }, 550);
    };
    browserRecognitionRef.current = recognition;
    recognition.start();
    return true;
  };

  const toggleDictation = async () => {
    if (dictating) {
      if (nativeRestartTimerRef.current) {
        window.clearTimeout(nativeRestartTimerRef.current);
        nativeRestartTimerRef.current = null;
      }
      commitInterimTranscript();
      setDictating(false);
      setInterimText("");
      provisionalTranscriptRef.current = "";
      provisionalBaseBodyRef.current = null;
      setDictationStartedAt(null);
      try {
        browserRecognitionRef.current?.stop?.();
      } catch {}
      await stopNativeDictation();
      setVoiceStatus(`Voice stopped. Context kept: ${dictationChunksRef.current.length} chunk${dictationChunksRef.current.length === 1 ? "" : "s"}.`);
      return;
    }
    setDictating(true);
    setDictationStartedAt(Date.now());
    setDictationChunkCount(0);
    dictationChunksRef.current = [];
    lastTranscriptRef.current = "";
    provisionalTranscriptRef.current = "";
    provisionalBaseBodyRef.current = null;
    setVoiceStatus("Listening continuously. Silence is okay; tap mic again to stop.");
    const nativeResult = await startNativeDictation();
    if (!nativeResult?.ok) {
      nativeDictationRef.current = false;
      const browserStarted = startBrowserDictation();
      if (!browserStarted) {
        setDictating(false);
        setVoiceStatus(nativeResult?.message || "Speech bridge unavailable.");
      }
    } else {
      nativeDictationRef.current = true;
    }
  };

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<SpeechResultDetail>).detail || {};
      if (!detail.ok || !detail.transcript?.trim()) {
        if (dictatingRef.current && detail.mode === "calenotes" && !nativeDictationRef.current) {
          restartNativeDictation(900);
        } else if (detail.message) {
          setVoiceStatus(detail.message);
        }
        return;
      }
      appendTranscript(detail.transcript, Boolean(detail.interim));
      if (!detail.interim && dictatingRef.current && detail.mode === "calenotes" && !nativeDictationRef.current) {
        setVoiceStatus("Listening continuously. Silence is okay; tap mic again to stop.");
        restartNativeDictation(220);
      }
    };
    window.addEventListener("pocketflow-notes-speech-result", handler as EventListener);
    window.addEventListener("pocketflow-spino-speech-result", handler as EventListener);
    return () => {
      window.removeEventListener("pocketflow-notes-speech-result", handler as EventListener);
      window.removeEventListener("pocketflow-spino-speech-result", handler as EventListener);
    };
  }, []);

  const saveDraft = () => {
    const body = draft.body.trim();
    if (!body && !draft.title.trim()) {
      onNotify?.("Write or dictate something first.", "warn");
      return;
    }

    if (draft.id) {
      upsertLifeNote({
        id: draft.id,
        title: draft.title.trim() || "Untitled memo",
        body,
        tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
        source: "manual",
      });
      setDraft(emptyDraft());
      refresh();
      onNotify?.("Memo updated.", "success");
      return;
    }

    const result = createCalenoteFromText({
      title: draft.title,
      body: body || draft.title,
      agentCheck,
    });
    setDraft(emptyDraft());
    setAgentCheck(false);
    refresh();

    if (result.summaryNote) {
      addPocketNotification({
        title: "MemoPad summary created",
        message: `Summary saved for ${result.note.title}.`,
        source: "calenotes",
        severity: "info",
        actionApp: "notes",
        actionLabel: "Open MemoPad",
        metadata: { persist: true, noteId: result.summaryNote.id, notificationType: "calenotes_summary" },
      });
    }

    if (result.memory) {
      addPocketNotification({
        title: "MemoPad memory saved",
        message: `${result.memory.label}: ${result.memory.value}`,
        source: "calenotes",
        severity: "info",
        actionApp: "notes",
        actionLabel: "Open MemoPad",
        metadata: { persist: true, memoryId: result.memory.id, notificationType: "calenotes_memory" },
      });
    }

    if (result.taskList) {
      addPocketNotification({
        title: "Calenotes task list created",
        message: `${result.taskList.title}: ${result.taskList.items.length} item${result.taskList.items.length === 1 ? "" : "s"} to complete.`,
        source: "calenotes",
        severity: "info",
        actionApp: "notes",
        actionLabel: "Open MemoPad",
        metadata: { persist: true, taskListId: result.taskList.id },
      });
      onNotify?.(`${result.taskList.title} added to tasks.`, "success");
      setView("tasks");
      return;
    }
    if (result.event) {
      addPocketNotification({
        title: "Calenotes event created",
        message: `${result.event.title} on ${labelLifeDate(result.event.date)} at ${result.event.time || "all day"}.`,
        source: "calenotes",
        severity: "info",
        actionApp: "notes",
        actionLabel: "Open MemoPad",
        metadata: { persist: true, eventId: result.event.id },
      });
      onNotify?.(`${result.event.title} added to calendar.`, "success");
      setSelectedDate(result.event.date);
      setView("calendar");
      return;
    }
    onNotify?.(result.summaryNote ? "Memo and summary saved." : "Memo saved.", "success");
  };

  const copyQuickCapture = async () => {
    const text = draft.body.trim();
    if (!text) {
      onNotify?.("Quick Capture is empty.", "warn");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    onNotify?.("Quick Capture copied.", "success");
  };

  const editNote = (note: LifeNote) => {
    setDraft({
      id: note.id,
      title: note.title,
      body: note.body,
      tags: note.tags.join(", "),
    });
    setView("write");
  };

  const removeNote = (id: string) => {
    deleteLifeNote(id);
    refresh();
    onNotify?.("Memo removed.", "info");
  };

  const saveEventDraft = () => {
    if (!eventDraft.title.trim()) {
      onNotify?.("Add an event title first.", "warn");
      return;
    }
    const saved = upsertCalendarEvent({
      id: eventDraft.id || undefined,
      title: eventDraft.title.trim(),
      date: eventDraft.date,
      time: eventDraft.time,
      notes: eventDraft.notes.trim(),
      source: "manual",
    });
    setSelectedDate(saved.date);
    setEventDraft(emptyEventDraft());
    refresh();
    onNotify?.("Calendar event saved.", "success");
  };

  const editEvent = (event: LifeCalendarEvent) => {
    setEventDraft({
      id: event.id,
      title: event.title,
      date: event.date,
      time: event.time || "12:00",
      notes: event.notes,
    });
    setSelectedDate(event.date);
    setView("calendar");
  };

  const removeEvent = (id: string) => {
    deleteCalendarEvent(id);
    refresh();
    if (eventDraft.id === id) setEventDraft(emptyEventDraft());
    onNotify?.("Calendar event removed.", "info");
  };

  const toggleTask = (listId: string, itemId: string, done: boolean) => {
    updateTaskItemDone(listId, itemId, done);
    refresh();
  };

  const removeTaskList = (id: string) => {
    deleteTaskList(id);
    refresh();
    onNotify?.("Task list removed.", "info");
  };

  const formatDuration = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(safe / 60).toString().padStart(2, "0");
    const secs = (safe % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const agentCallClass = (call: CalenoteAgentCall) => {
    if (call.status === "complete") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
    if (call.status === "active") return "border-[#f5c84b]/30 bg-[#f5c84b]/10 text-[#f5c84b]";
    if (call.status === "skipped") return "border-slate-500/20 bg-slate-500/10 text-slate-400";
    return "border-[#26352e] bg-[#080b09] text-slate-500";
  };

  const navButton = (id: CalenotesView, label: string, Icon: typeof NotebookPen) => (
    <button
      onClick={() => setView(id)}
      className={`rounded-2xl border px-3 py-3 text-left transition ${
        view === id ? "border-[#f5c84b] bg-[#f5c84b] text-[#11120d]" : "border-[#26352e] bg-[#0f1712] text-slate-300"
      }`}
    >
      <Icon className="h-4 w-4" />
      <div className="mt-2 text-[9px] font-black uppercase tracking-[0.18em]">{label}</div>
    </button>
  );

  return (
    <div className="pocketflow-screen-scroll flex-1 min-h-0 min-w-0 bg-[#080b09] text-slate-100 px-4 pt-4 pb-6 space-y-4 animate-fade-in">
      <header className="rounded-[28px] border border-[#26352e] bg-[#101711] p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#f5c84b] text-[#11120d]">
                <NotebookPen className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white">MemoPad</h1>
                <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#f5c84b]">Notes + calendar + lists</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">
              Write normally, or switch on agent check when the note should become a task, list, or calendar event.
            </p>
          </div>
          <div className="rounded-2xl border border-[#f5c84b]/30 bg-[#f5c84b]/10 px-3 py-2 text-center">
            <div className="text-lg font-black text-[#f5c84b]">{activeTasks.length}</div>
            <div className="text-[8px] font-mono uppercase tracking-widest text-slate-400">open</div>
          </div>
        </div>
      </header>

      <nav className="grid grid-cols-4 gap-2">
        {navButton("write", "Write", Plus)}
        {navButton("tasks", "Tasks", ListChecks)}
        {navButton("calendar", "Calendar", CalendarDays)}
        {navButton("notes", "Archive", NotebookPen)}
      </nav>

      {view === "write" && (
        <section className="space-y-3">
          <div className="rounded-[28px] border border-[#26352e] bg-[#101711] p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-white">{draft.id ? "Edit memo" : "Quick capture"}</h2>
                <p className="text-[10px] text-slate-500">Type, dictate, then choose whether the agent should structure it.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyQuickCapture}
                  className="grid h-11 w-11 place-items-center rounded-2xl border border-[#26352e] bg-[#080b09] text-slate-400 transition hover:border-[#f5c84b]/60 hover:text-[#f5c84b]"
                  aria-label="Copy Quick Capture text"
                  type="button"
                >
                  <Copy className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setAgentCheck((value) => !value)}
                  className={`grid h-11 w-11 place-items-center rounded-2xl border transition ${
                    agentCheck ? "border-[#f5c84b] bg-[#f5c84b] text-[#11120d]" : "border-[#26352e] bg-[#080b09] text-slate-500"
                  }`}
                  aria-label={agentCheck ? "Agent task check enabled" : "Agent task check disabled"}
                  type="button"
                >
                  <Check className="h-5 w-5" />
                </button>
              </div>
            </div>
            <input
              value={draft.title}
              onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
              placeholder="Optional title"
              className="mb-2 w-full rounded-2xl border border-[#26352e] bg-[#080b09] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600"
            />
            <textarea
              value={draft.body}
              onChange={(event) => setDraft((value) => ({ ...value, body: event.target.value }))}
              placeholder="Example: buy bread, water, pasta. Or: Wednesday 26th at 4, dinner with Paolo. Add 'summary' at the beginning or end to create a summary."
              rows={8}
              className="w-full resize-none rounded-3xl border border-[#26352e] bg-[#080b09] px-4 py-4 text-sm leading-6 text-white outline-none placeholder:text-slate-600"
            />
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-[#26352e] bg-[#080b09] px-3 py-2">
                <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Words</div>
                <div className="text-sm font-black text-white">{draftWordCount}</div>
              </div>
              <div className="rounded-2xl border border-[#26352e] bg-[#080b09] px-3 py-2">
                <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Session</div>
                <div className="text-sm font-black text-white">{dictating ? formatDuration(dictationSeconds) : "idle"}</div>
              </div>
              <div className="rounded-2xl border border-[#26352e] bg-[#080b09] px-3 py-2">
                <div className="text-[8px] font-mono uppercase tracking-widest text-slate-500">Chunks</div>
                <div className="text-sm font-black text-white">{dictationChunkCount}</div>
              </div>
            </div>
            {interimText && (
              <div className="mt-2 rounded-2xl border border-[#f5c84b]/30 bg-[#f5c84b]/10 px-3 py-2 text-xs text-[#f5c84b]">
                Hearing: {interimText}
              </div>
            )}
            <div className="mt-3 grid grid-cols-[auto_1fr_auto] gap-2">
              <button
                onClick={toggleDictation}
                className={`h-12 rounded-2xl px-4 ${dictating ? "bg-red-500 text-white" : "bg-[#1e2a22] text-[#f5c84b]"} border border-[#26352e]`}
                aria-label={dictating ? "Stop dictation" : "Start dictation"}
              >
                {dictating ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <button onClick={saveDraft} className="h-12 rounded-2xl bg-[#f5c84b] text-[#11120d] text-[10px] font-black uppercase tracking-[0.18em]">
                <Save className="mr-2 inline h-4 w-4" /> Save
              </button>
              <button
                onClick={() => {
                  setDraft(emptyDraft());
                  setInterimText("");
                  provisionalTranscriptRef.current = "";
                  provisionalBaseBodyRef.current = null;
                  dictationChunksRef.current = [];
                  setDictationChunkCount(0);
                }}
                className="h-12 rounded-2xl border border-[#26352e] bg-[#080b09] px-4 text-[10px] font-black uppercase tracking-widest text-slate-400"
              >
                Clear
              </button>
            </div>
            <p className="mt-3 text-[10px] text-slate-500">{voiceStatus}</p>
          </div>

          {agentCheck && draft.body.trim() && (
            <div className="rounded-[24px] border border-[#f5c84b]/25 bg-[#f5c84b]/10 p-4">
              <div className="flex items-center gap-2 text-[#f5c84b]">
                <Sparkles className="h-4 w-4" />
                <div className="text-[10px] font-black uppercase tracking-[0.2em]">Agent read</div>
              </div>
              <div className="mt-2 text-sm font-black text-white">{analysis.title}</div>
              <div className="mt-1 text-xs leading-5 text-slate-300">
                {analysis.kind} / {categoryLabels[analysis.category]} / {analysis.confidence}% confidence. {analysis.reason}
              </div>
              {analysis.commands.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {analysis.commands.map((command) => (
                    <span key={command} className="rounded-full border border-[#f5c84b]/30 bg-black/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#f5c84b]">{command}</span>
                  ))}
                </div>
              )}
              {analysis.summary && (
                <div className="mt-3 rounded-2xl border border-[#f5c84b]/25 bg-black/20 p-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#f5c84b]">Summary preview</div>
                  <p className="mt-1 text-xs leading-5 text-slate-200">{analysis.summary}</p>
                </div>
              )}
              <div className="mt-3 grid gap-2">
                {analysis.agentCalls.map((call) => (
                  <div key={call.agentId} className={`rounded-2xl border px-3 py-2 ${agentCallClass(call)}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.16em]">{call.label}</span>
                      <span className="text-[9px] font-mono uppercase tracking-widest">{call.status}</span>
                    </div>
                    <p className="mt-1 text-[10px] leading-4 opacity-80">{call.detail}</p>
                  </div>
                ))}
              </div>
              {analysis.items.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {analysis.items.slice(0, 8).map((item) => (
                    <span key={item} className="rounded-full border border-[#f5c84b]/30 bg-black/20 px-3 py-1 text-[10px] text-[#f5c84b]">{item}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {view === "tasks" && (
        <section className="space-y-3">
          {taskLists.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-[#26352e] bg-[#101711] p-6 text-center text-sm text-slate-500">
              No task lists yet. Write a list and switch on the check icon.
            </div>
          ) : (
            taskLists.map((list) => {
              const done = list.items.filter((item) => item.done).length;
              return (
                <div key={list.id} className="rounded-[28px] border border-[#26352e] bg-[#101711] p-4 shadow-xl">
                  <div className="flex items-start justify-between gap-3">
                    <button onClick={() => setSelectedDate(list.dueDate)} className="min-w-0 text-left">
                      <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-[#f5c84b]">
                        {categoryLabels[list.category]} / {labelLifeDate(list.dueDate)}
                      </div>
                      <h3 className="mt-1 text-lg font-black text-white">{list.title}</h3>
                      <p className="mt-1 text-xs text-slate-500">{done}/{list.items.length} complete</p>
                    </button>
                    <button onClick={() => removeTaskList(list.id)} className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-red-300">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-4 space-y-2">
                    {list.items.map((item) => (
                      <label key={item.id} className={`flex items-center gap-3 rounded-2xl border px-3 py-3 ${item.done ? "border-emerald-500/20 bg-emerald-500/10" : "border-[#26352e] bg-[#080b09]"}`}>
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={(event) => toggleTask(list.id, item.id, event.target.checked)}
                          className="h-5 w-5 accent-[#f5c84b]"
                        />
                        <span className={`text-sm ${item.done ? "text-emerald-300 line-through" : "text-slate-100"}`}>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      {view === "calendar" && (
        <section className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[formatLifeDate(new Date()), formatLifeDate(addDays(new Date(), 1)), formatLifeDate(addDays(new Date(), 2))].map((date) => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`rounded-2xl border px-3 py-3 text-left ${selectedDate === date ? "border-[#f5c84b] bg-[#f5c84b] text-[#11120d]" : "border-[#26352e] bg-[#101711] text-slate-300"}`}
              >
                <div className="text-[9px] font-mono uppercase tracking-widest">{labelLifeDate(date)}</div>
                <div className="text-sm font-black">{date.slice(5)}</div>
              </button>
            ))}
          </div>

          <div className="rounded-[28px] border border-[#26352e] bg-[#101711] p-4">
            <h2 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#f5c84b]">{eventDraft.id ? "Edit event" : "New event"}</h2>
            <input value={eventDraft.title} onChange={(event) => setEventDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Event title" className="mb-2 w-full rounded-2xl border border-[#26352e] bg-[#080b09] px-4 py-3 text-sm text-white outline-none" />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={eventDraft.date} onChange={(event) => setEventDraft((value) => ({ ...value, date: event.target.value }))} className="min-w-0 rounded-2xl border border-[#26352e] bg-[#080b09] px-3 py-3 text-xs text-white outline-none" />
              <input type="time" value={eventDraft.time} onChange={(event) => setEventDraft((value) => ({ ...value, time: event.target.value }))} className="min-w-0 rounded-2xl border border-[#26352e] bg-[#080b09] px-3 py-3 text-xs text-white outline-none" />
            </div>
            <textarea value={eventDraft.notes} onChange={(event) => setEventDraft((value) => ({ ...value, notes: event.target.value }))} placeholder="Place, contact, prep..." rows={3} className="mt-2 w-full resize-none rounded-2xl border border-[#26352e] bg-[#080b09] px-4 py-3 text-xs text-white outline-none" />
            <button onClick={saveEventDraft} className="mt-2 h-11 w-full rounded-2xl bg-[#f5c84b] text-[#11120d] text-[10px] font-black uppercase tracking-[0.18em]">
              Save event
            </button>
          </div>

          <div className="rounded-[28px] border border-[#26352e] bg-[#101711] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#f5c84b]" />
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">{labelLifeDate(selectedDate)} schedule</h2>
            </div>
            <div className="space-y-2">
              {selectedEvents.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#26352e] p-4 text-xs text-slate-500">No events for this day.</div>
              ) : (
                selectedEvents.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-[#26352e] bg-[#080b09] p-3">
                    <button onClick={() => editEvent(event)} className="w-full text-left">
                      <div className="text-[10px] font-mono text-[#f5c84b]">{event.time || "All day"} / {event.source}</div>
                      <div className="text-sm font-black text-white">{event.title}</div>
                      {event.notes && <div className="mt-1 text-[10px] leading-5 text-slate-500">{event.notes}</div>}
                    </button>
                    <button onClick={() => removeEvent(event.id)} className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-red-300">
                      Delete
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-[#26352e] bg-[#101711] p-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Upcoming</h2>
            <div className="mt-3 space-y-2">
              {upcomingEvents.map((event) => (
                <button key={event.id} onClick={() => editEvent(event)} className="w-full rounded-2xl border border-[#26352e] bg-[#080b09] p-3 text-left">
                  <div className="text-[9px] font-mono uppercase tracking-widest text-slate-500">{labelLifeDate(event.date)} / {event.time || "all day"}</div>
                  <div className="text-xs font-black text-slate-100">{event.title}</div>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {view === "notes" && (
        <section className="space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search saved memos"
              className="w-full rounded-2xl border border-[#26352e] bg-[#101711] py-3 pl-11 pr-4 text-sm text-white outline-none"
            />
          </div>
          {filteredNotes.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-[#26352e] bg-[#101711] p-6 text-center text-sm text-slate-500">No notes found.</div>
          ) : (
            filteredNotes.map((note) => (
              <div key={note.id} className="rounded-[28px] border border-[#26352e] bg-[#101711] p-4">
                <button onClick={() => editNote(note)} className="w-full text-left">
                  <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.18em] text-[#f5c84b]">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {new Date(note.updatedAt || note.createdAt).toLocaleDateString()}
                  </div>
                  <h3 className="mt-2 text-base font-black text-white">{note.title}</h3>
                  <p className="mt-2 line-clamp-4 text-xs leading-5 text-slate-400">{note.body}</p>
                  {note.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {note.tags.slice(0, 5).map((tag) => (
                        <span key={tag} className="rounded-full border border-[#26352e] bg-[#080b09] px-2 py-1 text-[9px] text-slate-500">{tag}</span>
                      ))}
                    </div>
                  )}
                </button>
                <button onClick={() => removeNote(note.id)} className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-red-300">
                  Delete
                </button>
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
}
