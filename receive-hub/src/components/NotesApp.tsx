import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, FileText, FolderOpen, Mic, MicOff, NotebookPen, Plus, Save, Search, Settings, Tag, Trash2, Waves } from "lucide-react";
import { LifeNote, deleteLifeNote, loadLifeNotes, saveLifeNotes, upsertLifeNote } from "../utils/lifeMemory";
import { normalizeSpinoSpeechInput } from "../utils/spinoSpeech";

interface NotesAppProps {
  onNotify?: (message: string, type: "success" | "info" | "warn") => void;
}

type CaptureMode = "dictation" | "memo" | "meeting";
type NotesView = "notes" | "meeting" | "settings";

interface SpeechResultDetail {
  ok?: boolean;
  transcript?: string;
  confidence?: number;
  interim?: boolean;
  mode?: string;
  message?: string;
}

interface VoiceMemoRecord {
  id: string;
  fileName: string;
  path?: string;
  nativeUri?: string;
  durationMs?: number;
  size?: number;
  savedAt: string;
}

interface MeetingSegment {
  id: string;
  at: string;
  elapsedSec: number;
  text: string;
  speaker: string;
  interim?: boolean;
}

interface VoiceProfile {
  id: string;
  label: string;
  sampleCount: number;
  updatedAt: string;
  lastText?: string;
}

interface MeetingPackage {
  id: string;
  title: string;
  folderName: string;
  createdAt: string;
  status: "ready" | "transcription_pending" | "capture_failed";
  segmentCount: number;
  audioFileName?: string;
  audioPath?: string;
  transcriptPath?: string;
  summaryPath?: string;
  wordPath?: string;
  htmlPath?: string;
  manifestPath?: string;
  audioLinkPath?: string;
  durationMs?: number;
  transcriptReady: boolean;
  summaryReady: boolean;
  audioReady: boolean;
}

interface MeetingTerminalEntry {
  id: string;
  at: string;
  level: "info" | "success" | "warn";
  text: string;
  progress?: number;
}

interface MeetingPipelineStep {
  id: string;
  label: string;
  status: "idle" | "active" | "done" | "warn";
  detail: string;
}

const emptyDraft = () => ({
  id: "",
  title: "",
  body: "",
  tags: "",
  details: "",
  memoLabel: "",
});

const voiceMemoStorageKey = "pocketflow.notes.voiceMemos.v1";
const meetingPackageStorageKey = "pocketflow.notes.meetingPackages.v1";
const voiceProfileStorageKey = "pocketflow.notes.voiceProfiles.v1";
const notesResetStorageKey = "pocketflow.notes.reset.2026-06-28.v1";
const emptyCapturePurgeStorageKey = "pocketflow.notes.emptyCapturePurge.2026-06-29.v1";

const resetStoredNotesAndMeetingsOnce = () => {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(notesResetStorageKey) === "done") return false;
    localStorage.removeItem(voiceMemoStorageKey);
    localStorage.removeItem(meetingPackageStorageKey);
    localStorage.removeItem(voiceProfileStorageKey);
    saveLifeNotes([]);
    localStorage.setItem(notesResetStorageKey, "done");
    return true;
  } catch {
    return false;
  }
};

const isEmptyCaptureNote = (note: LifeNote) => {
  const text = `${note.title ?? ""}\n${note.body ?? ""}\n${note.details ?? ""}`.toLowerCase();
  const tags = Array.isArray(note.tags)
    ? note.tags.join(" ").toLowerCase()
    : String(note.tags ?? "").toLowerCase();

  return tags.includes("meeting") && (
    text.includes("no questions detected")
    || text.includes("no transcription detected")
    || text.includes("transcription_pending")
    || text.includes("no audio file was returned")
    || text.includes("no trusted meeting audio or transcript was captured")
    || text.includes("no reliable transcript chunks")
  );
};

const purgeEmptyCaptureDataOnce = () => {
  if (typeof window === "undefined") return 0;
  try {
    if (localStorage.getItem(emptyCapturePurgeStorageKey) === "done") return 0;
    let removed = 0;

    const notes = loadLifeNotes();
    const filteredNotes = notes.filter((note) => {
      const remove = isEmptyCaptureNote(note);
      if (remove) removed += 1;
      return !remove;
    });
    if (filteredNotes.length !== notes.length) saveLifeNotes(filteredNotes);

    const meetings = loadStoredMeetingPackages();
    const filteredMeetings = meetings.filter((meeting) => {
      const remove = meeting.status === "capture_failed" || (!meeting.transcriptReady && !meeting.audioReady);
      if (remove) removed += 1;
      return !remove;
    });
    if (filteredMeetings.length !== meetings.length) {
      localStorage.setItem(meetingPackageStorageKey, JSON.stringify(filteredMeetings.slice(0, 20)));
    }

    localStorage.setItem(emptyCapturePurgeStorageKey, "done");
    return removed;
  } catch {
    return 0;
  }
};

const loadStoredVoiceMemos = (): VoiceMemoRecord[] => {
  try {
    const value = JSON.parse(localStorage.getItem(voiceMemoStorageKey) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

const loadStoredMeetingPackages = (): MeetingPackage[] => {
  try {
    const value = JSON.parse(localStorage.getItem(meetingPackageStorageKey) || "[]");
    if (!Array.isArray(value)) return [];
    return value.map((item) => {
      const status = item.status || (item.segmentCount > 0 ? "ready" : item.audioPath ? "transcription_pending" : "capture_failed");
      return {
        ...item,
        status,
        transcriptReady: typeof item.transcriptReady === "boolean" ? item.transcriptReady : item.segmentCount > 0,
        summaryReady: typeof item.summaryReady === "boolean" ? item.summaryReady : item.segmentCount > 0,
        audioReady: typeof item.audioReady === "boolean" ? item.audioReady : Boolean(item.audioPath || item.audioFileName),
      };
    });
  } catch {
    return [];
  }
};

const voiceNumberFromId = (voiceId: string) => {
  const parsed = Number(voiceId.replace(/\D+/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const voiceIdForIndex = (index: number) => `voice-${Math.max(1, Math.min(12, index))}`;

const defaultVoiceProfiles = (): VoiceProfile[] => ([
  { id: "voice-1", label: "Voice 1", sampleCount: 0, updatedAt: new Date().toISOString() },
  { id: "voice-2", label: "Voice 2", sampleCount: 0, updatedAt: new Date().toISOString() },
]);

const sortVoiceProfiles = (profiles: VoiceProfile[]) => [...profiles].sort((a, b) => voiceNumberFromId(a.id) - voiceNumberFromId(b.id));

const loadStoredVoiceProfiles = (): VoiceProfile[] => {
  try {
    const value = JSON.parse(localStorage.getItem(voiceProfileStorageKey) || "[]");
    if (!Array.isArray(value) || !value.length) return defaultVoiceProfiles();
    return sortVoiceProfiles(value.map((item) => ({
      id: item.id || voiceIdForIndex(1),
      label: item.label || `Voice ${voiceNumberFromId(item.id || "voice-1")}`,
      sampleCount: Number(item.sampleCount || 0),
      updatedAt: item.updatedAt || new Date().toISOString(),
      lastText: item.lastText,
    }))).slice(0, 12);
  } catch {
    return defaultVoiceProfiles();
  }
};

export default function NotesApp({ onNotify }: NotesAppProps) {
  const [storedNotesResetApplied] = useState(resetStoredNotesAndMeetingsOnce);
  const [emptyCapturePurgeCount] = useState(() => (storedNotesResetApplied ? 0 : purgeEmptyCaptureDataOnce()));
  const [notes, setNotes] = useState<LifeNote[]>(() => (storedNotesResetApplied ? [] : loadLifeNotes()));
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(emptyDraft);
  const [notesView, setNotesView] = useState<NotesView>("notes");
  const [captureMode, setCaptureMode] = useState<CaptureMode | null>(null);
  const [speechStatus, setSpeechStatus] = useState("Voice note ready.");
  const [interimText, setInterimText] = useState("");
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceMemos, setVoiceMemos] = useState<VoiceMemoRecord[]>(() => (storedNotesResetApplied ? [] : loadStoredVoiceMemos()));
  const [meetingPackages, setMeetingPackages] = useState<MeetingPackage[]>(() => (storedNotesResetApplied ? [] : loadStoredMeetingPackages()));
  const [meetingProcessing, setMeetingProcessing] = useState(false);
  const [meetingTerminal, setMeetingTerminal] = useState<MeetingTerminalEntry[]>([]);
  const [meetingProgress, setMeetingProgress] = useState(0);
  const [meetingPipelineMessage, setMeetingPipelineMessage] = useState("Ready for long meeting capture.");
  const [meetingNativeAudio, setMeetingNativeAudio] = useState<VoiceMemoRecord | null>(null);
  const [liveMeetingSegments, setLiveMeetingSegments] = useState<MeetingSegment[]>([]);
  const [liveInterimMeetingSegment, setLiveInterimMeetingSegment] = useState<MeetingSegment | null>(null);
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>(() => (storedNotesResetApplied ? defaultVoiceProfiles() : loadStoredVoiceProfiles()));
  const [dictationFocusActive, setDictationFocusActive] = useState(false);
  const captureModeRef = useRef<CaptureMode | null>(null);
  const activeMeetingRef = useRef<{ id: string; title: string; folderName: string; startedAt: string } | null>(null);
  const meetingSegmentsRef = useRef<MeetingSegment[]>([]);
  const voiceProfilesRef = useRef<VoiceProfile[]>([]);
  const meetingSpeakerIndexRef = useRef(1);
  const lastMeetingSegmentAtRef = useRef<number | null>(null);
  const browserRecognitionRef = useRef<any>(null);
  const restartTimerRef = useRef<number | null>(null);
  const listeningRef = useRef(false);
  const lastInterimTranscriptRef = useRef("");
  const lastCommittedTranscriptRef = useRef("");
  const recentCommittedTranscriptRef = useRef<string[]>([]);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const refresh = () => setNotes(loadLifeNotes());

  useEffect(() => {
    if (!storedNotesResetApplied) return;
    onNotify?.("Old Notes meetings and recordings cleared.", "success");
    void window.PocketFlowReceiveBridge?.notesClearArchive?.();
  }, [storedNotesResetApplied, onNotify]);

  useEffect(() => {
    if (!emptyCapturePurgeCount || storedNotesResetApplied) return;
    refresh();
    onNotify?.(`${emptyCapturePurgeCount} empty meeting placeholders removed. Real audio packages were kept.`, "success");
  }, [emptyCapturePurgeCount, storedNotesResetApplied, onNotify]);

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("pocketflow-life-memory-updated", handler);
    return () => window.removeEventListener("pocketflow-life-memory-updated", handler);
  }, []);

  useEffect(() => {
    localStorage.setItem(voiceMemoStorageKey, JSON.stringify(voiceMemos.slice(0, 20)));
  }, [voiceMemos]);

  useEffect(() => {
    localStorage.setItem(meetingPackageStorageKey, JSON.stringify(meetingPackages.slice(0, 20)));
  }, [meetingPackages]);

  useEffect(() => {
    voiceProfilesRef.current = voiceProfiles;
    localStorage.setItem(voiceProfileStorageKey, JSON.stringify(voiceProfiles.slice(0, 12)));
  }, [voiceProfiles]);

  useEffect(() => () => {
    if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
    try {
      browserRecognitionRef.current?.abort?.();
    } catch {}
    void window.PocketFlowReceiveBridge?.notesStopTranscription?.();
    void window.PocketFlowReceiveBridge?.spinoStopSpeechRecognition?.();
    void window.PocketFlowReceiveBridge?.notesStopVoiceMemo?.();
  }, []);

  useEffect(() => {
    if (!recordingStartedAt) {
      setRecordingSeconds(0);
      return undefined;
    }
    const updateTimer = () => setRecordingSeconds(Math.max(0, Math.floor((Date.now() - recordingStartedAt) / 1000)));
    updateTimer();
    const timer = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timer);
  }, [recordingStartedAt]);

  const filteredNotes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return notes;
    return notes.filter((note) => `${note.title} ${note.body} ${note.tags.join(" ")}`.toLowerCase().includes(needle));
  }, [notes, query]);

  const pushMeetingTerminal = (text: string, level: MeetingTerminalEntry["level"] = "info", progress?: number) => {
    const nextProgress = typeof progress === "number" ? Math.max(0, Math.min(100, Math.round(progress))) : undefined;
    if (typeof nextProgress === "number") setMeetingProgress(nextProgress);
    setMeetingTerminal((entries) => [
      ...entries,
      {
        id: `${Date.now()}-${entries.length}`,
        at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        level,
        text,
        progress: nextProgress,
      },
    ].slice(-32));
  };

  const normalizeTranscript = (transcript: string) => {
    const normalized = normalizeSpinoSpeechInput(transcript);
    return normalized.text || transcript.trim();
  };

  const normalizedTranscriptKey = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

  const extractFreshTranscript = (text: string) => {
    const current = text.toLowerCase().replace(/\s+/g, " ").trim();
    const previous = normalizedTranscriptKey(lastCommittedTranscriptRef.current);
    if (!current) return "";
    if (recentCommittedTranscriptRef.current.includes(current)) return "";
    if (previous && current === previous) return "";
    if (previous && current.startsWith(previous)) {
      const fresh = text.slice(previous.length).replace(/^[\s.,;:!?-]+/, "").trim();
      return fresh;
    }
    return text;
  };

  const speakerWordToNumber = (value: string) => {
    const normalized = value.toLowerCase();
    const words: Record<string, number> = {
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      uno: 1,
      due: 2,
      tre: 3,
      quattro: 4,
      a: 1,
      b: 2,
      c: 3,
      d: 4,
    };
    const parsed = words[normalized] ?? Number(normalized);
    return Number.isFinite(parsed) ? Math.max(1, Math.min(4, parsed)) : 1;
  };

  const splitSpeakerPrefix = (text: string) => {
    const match = text.match(/^(?:speaker|spkr|person|persona|voice|voce)\s*(one|two|three|four|uno|due|tre|quattro|[a-d]|[1-4])\s*[:,-]?\s+(.+)$/i);
    if (!match) return null;
    return {
      index: speakerWordToNumber(match[1]),
      text: match[2].trim(),
    };
  };

  const getVoiceLabel = (voiceId: string, profiles = voiceProfilesRef.current) => {
    const voiceNumber = voiceNumberFromId(voiceId);
    return profiles.find((profile) => profile.id === voiceId)?.label?.trim() || `Voice ${voiceNumber}`;
  };

  const rememberVoiceProfile = (voiceId: string, text: string) => {
    const trimmed = text.trim();
    setVoiceProfiles((profiles) => {
      const now = new Date().toISOString();
      const existing = profiles.find((profile) => profile.id === voiceId);
      if (existing) {
        return sortVoiceProfiles(profiles.map((profile) => (
          profile.id === voiceId
            ? { ...profile, sampleCount: profile.sampleCount + 1, updatedAt: now, lastText: trimmed.slice(0, 140) }
            : profile
        )));
      }
      return sortVoiceProfiles([
        ...profiles,
        {
          id: voiceId,
          label: getVoiceLabel(voiceId, profiles),
          sampleCount: 1,
          updatedAt: now,
          lastText: trimmed.slice(0, 140),
        },
      ]).slice(0, 12);
    });
  };

  const renameVoiceProfile = (voiceId: string, label: string) => {
    setVoiceProfiles((profiles) => sortVoiceProfiles(profiles.map((profile) => (
      profile.id === voiceId ? { ...profile, label } : profile
    ))));
  };

  const addVoiceProfile = () => {
    setVoiceProfiles((profiles) => {
      const next = Math.max(0, ...profiles.map((profile) => voiceNumberFromId(profile.id))) + 1;
      if (next > 12) return profiles;
      return sortVoiceProfiles([
        ...profiles,
        { id: voiceIdForIndex(next), label: `Voice ${next}`, sampleCount: 0, updatedAt: new Date().toISOString() },
      ]);
    });
  };

  const resolveMeetingSpeaker = (text: string) => {
    const prefixed = splitSpeakerPrefix(text);
    if (prefixed) {
      meetingSpeakerIndexRef.current = prefixed.index;
      lastMeetingSegmentAtRef.current = Date.now();
      return { speaker: voiceIdForIndex(prefixed.index), text: prefixed.text };
    }

    const now = Date.now();
    const previousAt = lastMeetingSegmentAtRef.current;
    const previousSegment = meetingSegmentsRef.current[meetingSegmentsRef.current.length - 1];
    const trimmed = text.trim();
    const looksLikeReply = Boolean(previousSegment?.text?.trim().endsWith("?"))
      || /^(yes|no|yeah|yep|nope|ok|okay|sure|right|si|sì|certo|allora|ma|però|but|so|well)\b/i.test(trimmed);
    if (previousAt && (now - previousAt > 5500 || looksLikeReply)) {
      meetingSpeakerIndexRef.current = meetingSpeakerIndexRef.current === 1 ? 2 : 1;
    }
    lastMeetingSegmentAtRef.current = now;
    return { speaker: voiceIdForIndex(meetingSpeakerIndexRef.current), text };
  };

  const previewInterimTranscript = (transcript: string, mode: CaptureMode) => {
    const text = normalizeTranscript(transcript);
    if (!text) return;
    if (mode !== "meeting") {
      setInterimText(text);
      return;
    }
    const elapsedSec = recordingStartedAt ? Math.max(0, Math.floor((Date.now() - recordingStartedAt) / 1000)) : 0;
    const previousSegment = meetingSegmentsRef.current[meetingSegmentsRef.current.length - 1];
    const speaker = previousSegment?.speaker || voiceIdForIndex(meetingSpeakerIndexRef.current);
    setLiveInterimMeetingSegment({
      id: "live-interim-meeting-segment",
      at: new Date().toISOString(),
      elapsedSec,
      text,
      speaker,
      interim: true,
    });
    setInterimText(text);
  };

  const setDictationFocus = (active: boolean, mode: CaptureMode | null) => {
    setDictationFocusActive(active);
    window.dispatchEvent(new CustomEvent("pocketflow-dictation-focus", { detail: { active, mode } }));
  };

  const canStartNativeTranscription = () => (
    Boolean(window.PocketFlowReceiveBridge?.notesStartTranscription || window.PocketFlowReceiveBridge?.spinoStartSpeechRecognition)
  );

  const startNativeTranscription = async (mode: CaptureMode) => {
    const locale = "auto";
    if (window.PocketFlowReceiveBridge?.notesStartTranscription) {
      return window.PocketFlowReceiveBridge.notesStartTranscription(mode, locale);
    }
    return window.PocketFlowReceiveBridge?.spinoStartSpeechRecognition?.(locale) || { ok: false, message: "Speech bridge unavailable." };
  };

  const stopNativeTranscription = async () => {
    if (window.PocketFlowReceiveBridge?.notesStopTranscription) {
      return window.PocketFlowReceiveBridge.notesStopTranscription();
    }
    return window.PocketFlowReceiveBridge?.spinoStopSpeechRecognition?.() || { ok: true };
  };

  const appendTranscript = (transcript: string, mode: CaptureMode, source: "final" | "partial" | "browser" = "final") => {
    const normalized = normalizeTranscript(transcript);
    const text = extractFreshTranscript(normalized);
    if (!text) return;
    setLiveInterimMeetingSegment(null);
    setInterimText("");
    lastCommittedTranscriptRef.current = normalized;
    recentCommittedTranscriptRef.current = [
      ...recentCommittedTranscriptRef.current,
      normalizedTranscriptKey(text),
    ].filter(Boolean).slice(-10);
    const stamp = new Date().toLocaleString([], {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (mode === "meeting") {
      const meeting = activeMeetingRef.current;
      const elapsedSec = recordingStartedAt ? Math.max(0, Math.floor((Date.now() - recordingStartedAt) / 1000)) : 0;
      const speakerTurn = resolveMeetingSpeaker(text);
      const segment: MeetingSegment = {
        id: `${Date.now()}-${meetingSegmentsRef.current.length}`,
        at: new Date().toISOString(),
        elapsedSec,
        text: speakerTurn.text,
        speaker: speakerTurn.speaker,
      };
      meetingSegmentsRef.current = [...meetingSegmentsRef.current, segment];
      rememberVoiceProfile(segment.speaker, segment.text);
      setLiveMeetingSegments(meetingSegmentsRef.current.slice(-120));
      if (meetingSegmentsRef.current.length === 1 || meetingSegmentsRef.current.length % 5 === 0 || source === "partial") {
        const speakerLabel = getVoiceLabel(segment.speaker);
        pushMeetingTerminal(
          `${source === "partial" ? "Recovered partial speech" : "Live turn captured"}: ${speakerLabel}.`,
          source === "partial" ? "success" : "info"
        );
      }
      const line = `[${formatDuration(elapsedSec)}] ${getVoiceLabel(segment.speaker)}: ${segment.text}`;
      setDraft((value) => ({
        ...value,
        title: value.title || meeting?.title || draft.memoLabel.trim() || "Meeting notes",
        body: [value.body.trim(), line].filter(Boolean).join(value.body.trim() ? "\n" : ""),
        tags: value.tags.includes("meeting") ? value.tags : [value.tags, "meeting", "transcript", "audio"].filter(Boolean).join(", "),
      }));
      return;
    }
    if (mode === "memo") {
      const label = draft.memoLabel.trim() || "Voice memo";
      const block = [`[${stamp}] ${label}`, text].join("\n");
      setDraft((value) => ({
        ...value,
        title: value.title || label,
        body: [value.body.trim(), block].filter(Boolean).join("\n\n"),
        tags: value.tags.includes("voice-memo") ? value.tags : [value.tags, "voice-memo"].filter(Boolean).join(", "),
      }));
      return;
    }
    setDraft((value) => ({
      ...value,
      body: [value.body.trim(), text].filter(Boolean).join(value.body.trim() ? "\n" : ""),
    }));
  };

  const commitLastInterim = (mode: CaptureMode, reason: string) => {
    const text = lastInterimTranscriptRef.current.trim();
    if (!text) return false;
    appendTranscript(text, mode, "partial");
    lastInterimTranscriptRef.current = "";
    setInterimText("");
    setLiveInterimMeetingSegment(null);
    if (mode === "meeting") pushMeetingTerminal(reason, "success");
    return true;
  };

  const clearEditableVoiceText = (scope: "draft" | "meeting" = "draft") => {
    setDraft((value) => ({ ...value, body: "" }));
    setInterimText("");
    lastInterimTranscriptRef.current = "";
    lastCommittedTranscriptRef.current = "";
    recentCommittedTranscriptRef.current = [];
    if (scope === "meeting") {
      meetingSegmentsRef.current = [];
      setLiveMeetingSegments([]);
      setLiveInterimMeetingSegment(null);
      pushMeetingTerminal("Editable transcript cleared. Raw audio file was not deleted.", "warn");
      setMeetingPipelineMessage("Transcript text cleared. Recording/audio remains available when saved.");
    }
    setSpeechStatus(scope === "meeting" ? "Meeting transcript cleared. Keep recording or dictate again." : "Draft text cleared. Dictate again or type manually.");
    onNotify?.(scope === "meeting" ? "Meeting transcript text cleared." : "Note draft text cleared.", "info");
  };

  const restartNativeSpeech = (delay = 650) => {
    if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = window.setTimeout(() => {
      restartTimerRef.current = null;
      if (!captureModeRef.current || !listeningRef.current) return;
      void startNativeTranscription(captureModeRef.current);
    }, delay);
  };

  const saveDraft = () => {
    const details = draft.details.trim();
    const body = [details ? `Details: ${details}` : "", draft.body.trim()].filter(Boolean).join("\n\n");
    const title = draft.title.trim() || (body.length > 42 ? `${body.slice(0, 42).trim()}...` : body);
    if (!title && !body) {
      onNotify?.("Write something before saving a note.", "warn");
      return;
    }
    upsertLifeNote({
      id: draft.id || undefined,
      title: title || "Untitled note",
      body,
      tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      source: "manual",
    });
    refresh();
    setDraft(emptyDraft());
    onNotify?.("Note saved.", "success");
  };

  const editNote = (note: LifeNote) => {
    const body = note.body.replace(/^Details:\s*(.+?)\n\n/s, "");
    const details = note.body.match(/^Details:\s*(.+?)\n\n/s)?.[1] || "";
    setDraft({
      id: note.id,
      title: note.title,
      body,
      tags: note.tags.join(", "),
      details,
      memoLabel: "",
    });
  };

  const removeNote = (id: string) => {
    deleteLifeNote(id);
    refresh();
    if (draft.id === id) setDraft(emptyDraft());
    onNotify?.("Note removed.", "info");
  };

  function formatDuration(seconds: number) {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(safeSeconds / 60).toString().padStart(2, "0");
    const secs = (safeSeconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  }

  const safeSlug = (value: string) => {
    const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return slug || "meeting";
  };

  const encodeBase64 = (text: string) => {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  };

  const escapeHtml = (text: string) => text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const saveMeetingArtifact = async (folderName: string, fileName: string, mimeType: string, content: string) => {
    const base64 = encodeBase64(content);
    if (window.PocketFlowReceiveBridge?.notesSaveMeetingFile) {
      return window.PocketFlowReceiveBridge.notesSaveMeetingFile(folderName, fileName, mimeType, base64);
    }
    if (window.PocketFlowReceiveBridge?.saveWebDownload) {
      return window.PocketFlowReceiveBridge.saveWebDownload(`${folderName}-${fileName}`, mimeType, base64);
    }
    return { ok: false, message: "Meeting archive saving is available in the phone app." };
  };

  const buildMeetingSummary = (title: string, startedAt: string, segments: MeetingSegment[], audio?: VoiceMemoRecord) => {
    const transcript = segments.map((segment) => `[${formatDuration(segment.elapsedSec)}] ${getVoiceLabel(segment.speaker)}: ${segment.text}`).join("\n");
    const allText = segments.map((segment) => segment.text).join(" ");
    const sentences = allText.split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
    const actionMatches = sentences.filter((sentence) => /\b(need|should|will|todo|follow|send|build|fix|decide|prepare|call|email|test|demo|next|action|review|check)\b/i.test(sentence));
    const decisionMatches = sentences.filter((sentence) => /\b(decided|agreed|confirmed|approved|blocked|risk|problem|issue|important|priority)\b/i.test(sentence));
    const questions = sentences.filter((sentence) => sentence.endsWith("?"));
    const keyPoints = (sentences.length ? sentences : segments.map((segment) => segment.text)).slice(0, 8);
    const duration = segments.length ? formatDuration(segments[segments.length - 1].elapsedSec) : formatDuration(recordingSeconds);
    if (!segments.length) {
      return [
        `# Meeting Capture - ${title}`,
        "",
        `Date: ${new Date(startedAt).toLocaleString()}`,
        `Duration: ${audio?.durationMs ? formatDuration(Math.round(audio.durationMs / 1000)) : duration}`,
        audio?.fileName ? `Audio: ${audio.fileName}` : "Audio: not attached",
        audio?.path ? `Audio path: ${audio.path}` : "",
        "",
        "## Status",
        audio?.fileName
          ? "- Audio recording was saved, but no live transcript chunks were captured."
          : "- No transcript or audio was captured. Check microphone permission and keep the Notes app open during the meeting.",
        "- Transcript: pending",
        "- Summary: pending transcript",
        "",
        "## Next Step",
        "- Keep the audio file. The saved recording is the source of truth for this meeting.",
        "- Live speech recognition can stop early on Android; the archive package preserves the audio for the offline pass.",
        "- Required pipeline: voice activity detection -> speech transcription -> speaker clustering -> Baloss summary.",
        "",
        "## Full Transcript",
        "TRANSCRIPTION_PENDING: no speech chunks were captured during this session.",
      ].filter(Boolean).join("\n");
    }
    const lines = [
      `# Meeting Summary - ${title}`,
      "",
      `Date: ${new Date(startedAt).toLocaleString()}`,
      `Duration: ${duration}`,
      audio?.fileName ? `Audio: ${audio.fileName}` : "Audio: not attached",
      audio?.path ? `Audio path: ${audio.path}` : "",
      "Voice separation: anonymous local labels are saved in Notes. Rename Voice 1, Voice 2, etc. when needed.",
      "",
      "## Executive Summary",
      keyPoints.slice(0, 4).map((item) => `- ${item}`).join("\n"),
      "",
      "## Key Points",
      keyPoints.map((item) => `- ${item}`).join("\n"),
      "",
      "## Full Transcript",
      transcript,
    ];
    if (actionMatches.length) {
      lines.splice(lines.length - 3, 0, "## Action Items", actionMatches.slice(0, 12).map((item) => `- ${item}`).join("\n"), "");
    }
    if (decisionMatches.length) {
      lines.splice(lines.length - 3, 0, "## Decisions / Risks", decisionMatches.slice(0, 10).map((item) => `- ${item}`).join("\n"), "");
    }
    if (questions.length) {
      lines.splice(lines.length - 3, 0, "## Questions", questions.slice(0, 10).map((item) => `- ${item}`).join("\n"), "");
    }
    return lines.filter((line, index, source) => line.trim() || source[index - 1]?.trim()).join("\n");
  };

  const buildMeetingDoc = (summary: string, title: string) => `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family: Arial, sans-serif; line-height: 1.45; color: #111;">
${summary.split("\n").map((line) => {
    if (line.startsWith("# ")) return `<h1>${escapeHtml(line.slice(2))}</h1>`;
    if (line.startsWith("## ")) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
    if (line.startsWith("- ")) return `<p>• ${escapeHtml(line.slice(2))}</p>`;
    if (!line.trim()) return "<br>";
    return `<p>${escapeHtml(line)}</p>`;
  }).join("\n")}
</body>
</html>`;

  const finalizeMeetingPackage = async (audio?: VoiceMemoRecord) => {
    const meeting = activeMeetingRef.current;
    if (!meeting) return;
    setMeetingProcessing(true);
    pushMeetingTerminal("Packaging meeting: audio link, transcript, summary, readable HTML, and manifest.", "info", 15);
    const segments = [...meetingSegmentsRef.current];
    const hasTranscript = segments.length > 0;
    const hasAudio = Boolean(audio?.fileName || audio?.path || audio?.nativeUri);
    const status: MeetingPackage["status"] = hasTranscript ? "ready" : hasAudio ? "transcription_pending" : "capture_failed";
    if (!hasTranscript && !hasAudio) {
      pushMeetingTerminal("Nothing was captured, so no empty meeting package was saved.", "warn", 100);
      setMeetingProcessing(false);
      setMeetingProgress(0);
      setMeetingPipelineMessage("No audio or transcript captured. Check microphone permission, then start Meeting again.");
      activeMeetingRef.current = null;
      meetingSegmentsRef.current = [];
      setLiveMeetingSegments([]);
      setLiveInterimMeetingSegment(null);
      setSpeechStatus("No meeting data captured. No empty files saved.");
      onNotify?.("No meeting data captured; empty file was not saved.", "warn");
      return;
    }
    const transcript = segments.map((segment) => `[${formatDuration(segment.elapsedSec)}] ${getVoiceLabel(segment.speaker)}: ${segment.text}`).join("\n");
    const titleSlug = safeSlug(meeting.title);
    const summary = buildMeetingSummary(meeting.title, meeting.startedAt, segments, audio);
    const doc = buildMeetingDoc(summary, meeting.title);
    const audioLink = [
      `# Meeting Audio - ${meeting.title}`,
      "",
      `Status: ${hasAudio ? "saved" : "not captured"}`,
      `Started: ${new Date(meeting.startedAt).toLocaleString()}`,
      `Ended: ${new Date().toLocaleString()}`,
      audio?.fileName ? `File: ${audio.fileName}` : "",
      audio?.path ? `Path: ${audio.path}` : "",
      audio?.nativeUri ? `URI: ${audio.nativeUri}` : "",
      audio?.durationMs ? `Duration: ${formatDuration(Math.round(audio.durationMs / 1000))}` : "",
      audio?.size ? `Size: ${audio.size} bytes` : "",
      "",
      "Open this audio file from Reader or Archive. If transcriptReady is false, run the meeting analysis engine against this audio before trusting the summary.",
    ].filter(Boolean).join("\n");
    const transcriptFile = transcript || [
      "TRANSCRIPTION_PENDING",
      "",
      hasAudio
        ? "Audio was saved, but no reliable transcript chunks were captured during the live session."
        : "No audio file was returned by the recorder.",
      hasAudio ? "Next analysis step: run offline VAD + ASR + speaker diarization, then rewrite this file as a speaker-by-speaker transcript." : "",
      audio?.path ? `Audio path: ${audio.path}` : "",
    ].filter(Boolean).join("\n");
    const manifest = JSON.stringify({
      id: meeting.id,
      title: meeting.title,
      createdAt: new Date().toISOString(),
      startedAt: meeting.startedAt,
      status,
      segmentCount: segments.length,
      transcriptReady: hasTranscript,
      summaryReady: hasTranscript,
      audioReady: hasAudio,
      analysisStatus: hasTranscript ? "complete" : hasAudio ? "audio_saved_transcription_pending" : "capture_failed",
      humanReadableStatus: hasTranscript
        ? "Transcript, summary, documents, and manifest are ready."
        : hasAudio
          ? "Audio is saved. Offline transcription and speaker separation are still required."
          : "No trusted meeting audio or transcript was captured.",
      speakerDiarizationReady: false,
      voiceLabelingReady: segments.length > 0,
      voiceProfiles: voiceProfilesRef.current.map(({ id, label, sampleCount, updatedAt }) => ({
        id,
        label,
        sampleCount,
        updatedAt,
      })),
      postProcessingRequired: !hasTranscript || !hasAudio,
      requiredAnalysisPipeline: {
        vad: "voice activity detection",
        asr: "offline speech-to-text",
        diarization: "speaker separation and clustering",
        summary: "Baloss LLM meeting summary",
      },
      audioFileName: audio?.fileName,
      audioPath: audio?.path,
      audioUri: audio?.nativeUri,
      durationMs: audio?.durationMs,
      size: audio?.size,
      files: {
        audioLink: `${titleSlug}-audio-link.txt`,
        transcript: `${titleSlug}-transcript.txt`,
        summary: `${titleSlug}-summary.txt`,
        html: `${titleSlug}-summary.html`,
        word: `${titleSlug}-summary.doc`,
      },
    }, null, 2);

    if (!segments.length) {
      pushMeetingTerminal(hasAudio ? "Audio saved. Live transcript is pending because no speech chunks arrived." : "No audio or transcript was captured. Check microphone permission.", "warn", 25);
    } else {
      pushMeetingTerminal(`Transcript ready with ${segments.length} captured chunks.`, "success", 30);
    }
    const audioLinkResult = await saveMeetingArtifact(meeting.folderName, `${titleSlug}-audio-link.txt`, "text/plain", audioLink);
    pushMeetingTerminal("Audio reference file saved.", audioLinkResult.ok ? "success" : "warn", 35);
    const transcriptResult = await saveMeetingArtifact(meeting.folderName, `${titleSlug}-transcript.txt`, "text/plain", transcriptFile);
    pushMeetingTerminal("Transcript file saved.", transcriptResult.ok ? "success" : "warn", 45);
    const summaryResult = await saveMeetingArtifact(meeting.folderName, `${titleSlug}-summary.txt`, "text/plain", summary);
    pushMeetingTerminal(hasTranscript ? "Summary text saved." : "Audio marker saved. Summary waits for transcription.", summaryResult.ok ? "success" : "warn", 62);
    const htmlResult = await saveMeetingArtifact(meeting.folderName, `${titleSlug}-summary.html`, "text/html", doc);
    pushMeetingTerminal("Reader-friendly HTML summary saved.", htmlResult.ok ? "success" : "warn", 78);
    const wordResult = await saveMeetingArtifact(meeting.folderName, `${titleSlug}-summary.doc`, "application/msword", doc);
    pushMeetingTerminal("Word-compatible document saved.", wordResult.ok ? "success" : "warn", 90);
    const manifestResult = await saveMeetingArtifact(meeting.folderName, `${titleSlug}-manifest.json`, "application/json", manifest);
    pushMeetingTerminal(hasTranscript ? "Meeting package complete in PocketFlow Archive." : "Meeting package saved with transcription pending.", hasTranscript ? "success" : "warn", 100);

    const meetingPackage: MeetingPackage = {
      id: meeting.id,
      title: meeting.title,
      folderName: meeting.folderName,
      createdAt: new Date().toISOString(),
      status,
      segmentCount: segments.length,
      audioFileName: audio?.fileName,
      audioPath: audio?.path,
      transcriptPath: transcriptResult.path,
      summaryPath: summaryResult.path,
      wordPath: wordResult.path,
      htmlPath: htmlResult.path,
      manifestPath: manifestResult.path,
      audioLinkPath: audioLinkResult.path,
      durationMs: audio?.durationMs,
      transcriptReady: hasTranscript,
      summaryReady: hasTranscript,
      audioReady: hasAudio,
    };
    setMeetingPackages((value) => [meetingPackage, ...value].slice(0, 20));
    if (hasTranscript) {
      upsertLifeNote({
        title: `Meeting: ${meeting.title}`,
        body: `${summary}\n\nArchive folder: ${meeting.folderName}`,
        tags: ["meeting", "summary", "transcript", hasAudio ? "audio" : "audio-missing"],
        source: "manual",
      });
      refresh();
    }
    activeMeetingRef.current = null;
    meetingSegmentsRef.current = [];
    setMeetingProcessing(false);
    setMeetingProgress(100);
    setMeetingNativeAudio(audio ?? null);
    setMeetingPipelineMessage(hasTranscript
      ? "Meeting package is ready in Archive with transcript, summary, HTML, Word, and manifest."
      : hasAudio
        ? "Audio is saved in Archive. Offline transcription and speaker separation are pending."
        : "Meeting package saved as failed capture. Check microphone permission before the next meeting.");
    setSpeechStatus(hasTranscript ? "Meeting package saved to PocketFlow Archive." : "Audio saved. Transcript and summary are marked pending.");
    onNotify?.(hasTranscript ? "Meeting package ready in Archive." : "Audio saved; transcript pending in Archive.", hasTranscript ? "success" : "warn");
  };

  const appendVoiceMemoFile = (memo: VoiceMemoRecord) => {
    const stamp = new Date().toLocaleString([], {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const duration = memo.durationMs ? `Duration: ${formatDuration(Math.round(memo.durationMs / 1000))}` : "";
    const block = [
      `[${stamp}] Voice memo saved`,
      memo.fileName,
      duration,
      memo.path ? `Archive: ${memo.path}` : "",
    ].filter(Boolean).join("\n");
    setDraft((value) => ({
      ...value,
      title: value.title || draft.memoLabel.trim() || "Meeting voice memo",
      body: [value.body.trim(), block].filter(Boolean).join("\n\n"),
      tags: value.tags.includes("voice-memo") ? value.tags : [value.tags, "voice-memo", "audio"].filter(Boolean).join(", "),
    }));
  };

  const stopCapture = async () => {
    const modeBeforeStop = captureModeRef.current;
    if (modeBeforeStop === "meeting") {
      pushMeetingTerminal("Stop requested. Closing microphone and saving audio.", "info", 10);
    }
    if (modeBeforeStop && lastInterimTranscriptRef.current.trim()) {
      commitLastInterim(modeBeforeStop, "Last partial speech chunk committed before packaging.");
      if (modeBeforeStop === "meeting") {
        pushMeetingTerminal("Closing meeting capture and packaging files.", "info");
      }
    }
    captureModeRef.current = null;
    setCaptureMode(null);
    listeningRef.current = false;
    setDictationFocus(false, null);
    setInterimText("");
    setLiveInterimMeetingSegment(null);
    setSpeechStatus("Voice note stopped.");
    setRecordingStartedAt(null);
    if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
    try {
      browserRecognitionRef.current?.abort?.();
    } catch {}
    browserRecognitionRef.current = null;
    await stopNativeTranscription();
    if ((modeBeforeStop === "memo" || modeBeforeStop === "meeting") && window.PocketFlowReceiveBridge?.notesStopVoiceMemo) {
      try {
        const result = await window.PocketFlowReceiveBridge.notesStopVoiceMemo();
        if (result.ok && result.fileName) {
          const memo: VoiceMemoRecord = {
            id: `${Date.now()}-${result.fileName}`,
            fileName: result.fileName,
            path: result.path,
            nativeUri: result.nativeUri,
            durationMs: result.durationMs,
            size: result.size,
            savedAt: new Date().toISOString(),
          };
          setVoiceMemos((value) => [memo, ...value].slice(0, 8));
          if (modeBeforeStop === "meeting") {
            setMeetingNativeAudio(memo);
            setMeetingPipelineMessage("Audio returned by the recorder. Building transcript, summary, HTML, Word, and manifest.");
            await finalizeMeetingPackage(memo);
          } else {
            appendVoiceMemoFile(memo);
            setSpeechStatus("Voice memo saved to PocketFlow Archive.");
            onNotify?.("Voice memo saved in Archive.", "success");
          }
        } else {
          setSpeechStatus(result.message || "Voice memo stopped, but no audio file was saved.");
          onNotify?.(result.message || "Voice memo was too short to save.", "warn");
          if (modeBeforeStop === "meeting") await finalizeMeetingPackage();
        }
      } catch {
        setSpeechStatus("Voice memo recorder did not answer.");
        onNotify?.("Voice memo recorder did not answer.", "warn");
        if (modeBeforeStop === "meeting") await finalizeMeetingPackage();
      }
    } else if (modeBeforeStop === "meeting") {
      await finalizeMeetingPackage();
    }
  };

  const restartBrowserCapture = (delay = 350) => {
    if (!captureModeRef.current || !listeningRef.current) return;
    if (restartTimerRef.current) window.clearTimeout(restartTimerRef.current);
    restartTimerRef.current = window.setTimeout(() => {
      restartTimerRef.current = null;
      if (captureModeRef.current && listeningRef.current) startBrowserCapture();
    }, delay);
  };

  const startBrowserCapture = () => {
    const SpeechRecognitionCtor =
      (window as Window & { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition
      || (window as Window & { webkitSpeechRecognition?: any }).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setSpeechStatus("Speech transcription is available in the phone app, not this browser.");
      onNotify?.("Speech transcription is not available in this browser.", "warn");
      void stopCapture();
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let index = event.resultIndex || 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript?.trim() || "";
        if (!text) continue;
        if (result.isFinal) finalTranscript = `${finalTranscript} ${text}`.trim();
        else interimTranscript = `${interimTranscript} ${text}`.trim();
      }
      if (interimTranscript) {
        lastInterimTranscriptRef.current = interimTranscript;
        if (captureModeRef.current) previewInterimTranscript(interimTranscript, captureModeRef.current);
        setSpeechStatus(`Hearing: ${interimTranscript}`);
      }
      if (finalTranscript && captureModeRef.current) {
        lastInterimTranscriptRef.current = "";
        appendTranscript(finalTranscript, captureModeRef.current, "browser");
        setInterimText("");
        setSpeechStatus("Listening continuously. Silence is okay; tap again to stop.");
      }
    };

    recognition.onerror = (event: { error?: string }) => {
      const mode = captureModeRef.current;
      if (!mode) return;
      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        listeningRef.current = false;
        captureModeRef.current = null;
        setCaptureMode(null);
        setSpeechStatus("Microphone permission blocked. Re-enable it, then start again.");
        onNotify?.("Microphone permission blocked.", "warn");
        return;
      }
      if (lastInterimTranscriptRef.current.trim()) {
        commitLastInterim(mode, "Browser speech paused; partial words were kept.");
      }
      restartBrowserCapture(250);
    };

    recognition.onend = () => {
      const mode = captureModeRef.current;
      browserRecognitionRef.current = null;
      if (!mode || !listeningRef.current) return;
      if (lastInterimTranscriptRef.current.trim()) {
        commitLastInterim(mode, "Browser speech restarted; partial words were kept.");
      }
      restartBrowserCapture(350);
    };

    browserRecognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      restartBrowserCapture(850);
    }
  };

  const startCapture = async (mode: CaptureMode) => {
    if (captureModeRef.current === mode) {
      await stopCapture();
      return;
    }
    if (captureModeRef.current) await stopCapture();
    captureModeRef.current = mode;
    listeningRef.current = true;
    setCaptureMode(mode);
    setInterimText("");
    if (mode === "meeting") {
      const title = draft.memoLabel.trim() || draft.title.trim() || "Meeting";
      const folderName = `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}-${safeSlug(title)}`;
      activeMeetingRef.current = {
        id: `${Date.now()}-${folderName}`,
        title,
        folderName,
        startedAt: new Date().toISOString(),
      };
      meetingSegmentsRef.current = [];
      setLiveMeetingSegments([]);
      setLiveInterimMeetingSegment(null);
      meetingSpeakerIndexRef.current = 1;
      lastMeetingSegmentAtRef.current = null;
      lastCommittedTranscriptRef.current = "";
      recentCommittedTranscriptRef.current = [];
      lastInterimTranscriptRef.current = "";
      setMeetingProgress(0);
      setMeetingNativeAudio(null);
      setMeetingPipelineMessage("Meeting pipeline started. Arming audio recorder and live transcript.");
      pushMeetingTerminal(`Meeting capture started: ${title}.`, "success", 0);
      pushMeetingTerminal("Native audio recorder is saving continuously to Archive.", "info");
      pushMeetingTerminal("Anonymous voice labels are active. Rename Voice 1, Voice 2, etc. after capture if needed.", "info");
      pushMeetingTerminal("Dictation focus active: BalossLLM background work should stay quiet while recording.", "success");
      setDraft((value) => ({
        ...value,
        title: value.title || title,
        tags: value.tags.includes("meeting") ? value.tags : [value.tags, "meeting", "transcript", "audio"].filter(Boolean).join(", "),
      }));
    }
    setDictationFocus(true, mode);
    setSpeechStatus(mode === "meeting" ? "Meeting mode recording. Audio, transcript, and notes are active." : mode === "memo" ? "Voice memo recording. Tap again to stop." : "Dictation recording. Tap again to stop.");
    if (mode === "memo" || mode === "meeting") {
      if (window.PocketFlowReceiveBridge?.notesStartVoiceMemo) {
        try {
          const meeting = activeMeetingRef.current;
          const label = mode === "meeting" && meeting
            ? `meeting|${meeting.folderName}|${meeting.title}`
            : draft.memoLabel.trim() || draft.title.trim() || "meeting-note";
          const result = await window.PocketFlowReceiveBridge.notesStartVoiceMemo(label);
          if (result.ok) {
            setRecordingStartedAt(result.startedAt || Date.now());
            setSpeechStatus(mode === "meeting" ? "Meeting recording to PocketFlow Archive. Keep talking or tap stop." : "Voice memo recording to PocketFlow Archive. Keep talking or tap stop.");
            if (mode === "meeting") {
              const liveAudio: VoiceMemoRecord = {
                id: `${Date.now()}-recording`,
                fileName: result.fileName || `${meeting?.folderName || "meeting"}-recording.m4a`,
                path: result.path,
                nativeUri: result.nativeUri,
                savedAt: new Date().toISOString(),
              };
              setMeetingNativeAudio(liveAudio);
              setMeetingPipelineMessage("Audio recorder is running. Transcript is captured live when Android speech returns chunks.");
              pushMeetingTerminal("Long-call recorder armed. Keep this screen open for the cleanest capture.", "success");
            }
          } else {
            setSpeechStatus(result.message || (mode === "meeting" ? "Native audio failed. Meeting transcript-only mode active." : "Native voice memo failed. Transcript-only mode active."));
            onNotify?.(result.message || "Native voice memo failed. Transcript-only mode active.", "warn");
            if (mode === "meeting") {
              setMeetingPipelineMessage("Audio recorder failed. The meeting is running in transcript-only fallback mode.");
              pushMeetingTerminal(result.message || "Native audio failed. Transcript-only mode active.", "warn");
            }
          }
        } catch {
          setSpeechStatus(mode === "meeting" ? "Native recorder did not answer. Meeting transcript-only mode active." : "Native voice memo did not answer. Transcript-only mode active.");
          onNotify?.("Native recorder did not answer. Transcript-only mode active.", "warn");
          if (mode === "meeting") {
            setMeetingPipelineMessage("Native recorder did not answer. Transcript-only fallback is active.");
            pushMeetingTerminal("Native recorder did not answer. Transcript-only mode active.", "warn");
          }
        }
      } else {
        setSpeechStatus(mode === "meeting" ? "Meeting audio saving is available in the phone app. Transcript-only mode active here." : "Voice memo audio saving is available in the phone app. Transcript-only mode active here.");
        if (mode === "meeting") {
          setMeetingPipelineMessage("Desktop preview cannot save native audio. Use the phone build for full recording.");
          pushMeetingTerminal("Desktop preview cannot save native audio. Use the phone app for full meeting capture.", "warn");
        }
      }
    }

    if (canStartNativeTranscription()) {
      try {
        const result = await startNativeTranscription(mode);
        if (!result.ok) {
          setSpeechStatus(result.message || "Phone speech bridge unavailable. Trying browser capture.");
          startBrowserCapture();
        }
      } catch {
        setSpeechStatus("Phone speech bridge did not answer. Trying browser capture.");
        startBrowserCapture();
      }
      return;
    }

    startBrowserCapture();
  };

  useEffect(() => {
    const handler = (event: Event) => {
      if (!captureModeRef.current) return;
      const detail = (event as CustomEvent<SpeechResultDetail>).detail || {};
      if (!detail.ok || !detail.transcript?.trim()) {
        if (captureModeRef.current && lastInterimTranscriptRef.current.trim()) {
          commitLastInterim(captureModeRef.current, "Speech service paused; saved the last partial words before restart.");
        }
        if (captureModeRef.current && listeningRef.current && canStartNativeTranscription()) restartNativeSpeech(900);
        return;
      }
      const transcript = detail.transcript.trim();
      if (detail.interim) {
        lastInterimTranscriptRef.current = transcript;
        previewInterimTranscript(transcript, captureModeRef.current);
        setSpeechStatus(`Hearing: ${transcript}`);
        return;
      }
      lastInterimTranscriptRef.current = "";
      appendTranscript(transcript, captureModeRef.current, "final");
      setInterimText("");
      setSpeechStatus("Listening continuously. Silence is okay; tap again to stop.");
      if (captureModeRef.current && listeningRef.current && canStartNativeTranscription()) restartNativeSpeech(650);
    };
    window.addEventListener("pocketflow-speech-result", handler as EventListener);
    window.addEventListener("pocketflow-notes-speech-result", handler as EventListener);
    return () => {
      window.removeEventListener("pocketflow-speech-result", handler as EventListener);
      window.removeEventListener("pocketflow-notes-speech-result", handler as EventListener);
    };
  }, [draft.memoLabel, draft.tags]);

  const latestMeetingPackage = meetingPackages[0];
  const visibleMeetingSegments = liveInterimMeetingSegment
    ? [...liveMeetingSegments.slice(-119), liveInterimMeetingSegment]
    : liveMeetingSegments;
  const liveVoiceCount = new Set(visibleMeetingSegments.map((segment) => segment.speaker)).size;
  const meetingPipelineSteps: MeetingPipelineStep[] = [
    {
      id: "audio",
      label: "Audio recording",
      status: captureMode === "meeting" && meetingNativeAudio
        ? "active"
        : latestMeetingPackage?.audioReady
          ? "done"
          : captureMode === "meeting"
            ? "active"
            : latestMeetingPackage
              ? "warn"
              : "idle",
      detail: captureMode === "meeting" && meetingNativeAudio
        ? `Recording ${meetingNativeAudio.fileName} for ${formatDuration(recordingSeconds)}.`
        : latestMeetingPackage?.audioReady
          ? `Saved ${latestMeetingPackage.audioFileName || "meeting audio"} in Archive.`
          : captureMode === "meeting"
            ? "Recorder is arming. Keep the phone open until the meeting ends."
            : "Waiting for Meeting mode.",
    },
    {
      id: "transcript",
      label: "Live transcript",
      status: visibleMeetingSegments.length > 0
        ? "active"
        : latestMeetingPackage?.transcriptReady
          ? "done"
          : latestMeetingPackage?.status === "transcription_pending"
            ? "warn"
            : captureMode === "meeting"
              ? "active"
              : "idle",
      detail: visibleMeetingSegments.length > 0
        ? `${liveMeetingSegments.length} turns${liveInterimMeetingSegment ? " + live speech" : ""} across ${Math.max(1, liveVoiceCount)} voice slot${liveVoiceCount === 1 ? "" : "s"}.`
        : latestMeetingPackage?.transcriptReady
          ? `${latestMeetingPackage.segmentCount} transcript turns saved.`
          : latestMeetingPackage?.status === "transcription_pending"
            ? "No live chunks arrived. Offline ASR still needs to process the saved audio."
            : captureMode === "meeting"
              ? canStartNativeTranscription() ? "Android speech bridge active. Waiting for words." : "Speech bridge unavailable; audio remains the source."
              : "No transcript session active.",
    },
    {
      id: "summary",
      label: "Summary + docs",
      status: meetingProcessing
        ? "active"
        : latestMeetingPackage?.summaryReady
          ? "done"
          : latestMeetingPackage
            ? "warn"
            : "idle",
      detail: meetingProcessing
        ? "Writing summary, HTML, Word-compatible file, and manifest."
        : latestMeetingPackage?.summaryReady
          ? "Summary files are ready for Reader."
          : latestMeetingPackage
            ? "Pending summary saved; final summary needs transcript."
            : "Generated after Stop Meeting.",
    },
    {
      id: "archive",
      label: "Archive package",
      status: latestMeetingPackage
        ? latestMeetingPackage.status === "ready"
          ? "done"
          : "warn"
        : meetingProcessing
          ? "active"
          : "idle",
      detail: latestMeetingPackage
        ? `${latestMeetingPackage.folderName} • ${latestMeetingPackage.status.replace(/_/g, " ")}`
        : meetingProcessing
          ? "Saving to PocketFlow Archive."
          : "Folder appears here after packaging.",
    },
  ];
  const pipelineTone = (status: MeetingPipelineStep["status"]) => {
    if (status === "done") return "border-[#22c55e]/25 bg-[#22c55e]/10 text-[#22c55e]";
    if (status === "active") return "border-cyan-300/25 bg-cyan-300/10 text-cyan-200";
    if (status === "warn") return "border-amber-300/25 bg-amber-300/10 text-amber-200";
    return "border-[#2a2c32] bg-black/25 text-slate-500";
  };
  const pipelineBadge = (status: MeetingPipelineStep["status"]) => {
    if (status === "done") return "ready";
    if (status === "active") return "live";
    if (status === "warn") return "needs pass";
    return "idle";
  };
  const dictationPreviewLines = useMemo(() => {
    const lines = draft.body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-5);
    if (interimText.trim()) lines.push(interimText.trim());
    return lines.slice(-6);
  }, [draft.body, interimText]);
  const captureConsoleMode = captureMode === "meeting"
    ? "Meeting"
    : captureMode === "memo"
      ? "Voice Memo"
      : captureMode === "dictation"
        ? "Dictation"
      : "Ready";

  const handleSwipeStart = (x: number, y: number) => {
    swipeStartRef.current = { x, y };
  };

  const handleSwipeEnd = (x: number, y: number) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const dx = x - start.x;
    const dy = y - start.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (dx > 0 && notesView === "notes") setNotesView("meeting");
    if (dx < 0 && notesView !== "notes") setNotesView("notes");
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (touch) handleSwipeStart(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.changedTouches[0];
    if (touch) handleSwipeEnd(touch.clientX, touch.clientY);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    handleSwipeStart(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    handleSwipeEnd(event.clientX, event.clientY);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    handleSwipeStart(event.clientX, event.clientY);
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    handleSwipeEnd(event.clientX, event.clientY);
  };

  const renderStatusPanel = () => (
    <div className="rounded-xl border border-[#2a2c32] bg-[#0c0c0d] px-3 py-2 text-[10px] leading-5 text-slate-400">
      <span className="font-mono uppercase tracking-widest text-slate-500">Voice</span>
      <span className="ml-2">{speechStatus}</span>
      {(captureMode === "memo" || captureMode === "meeting") && recordingStartedAt && (
        <div className="mt-1 flex items-center gap-2 text-red-300 font-mono uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          {captureMode === "meeting" ? "Meeting" : "Recording"} {formatDuration(recordingSeconds)}
        </div>
      )}
      {meetingProcessing && (
        <div className="mt-1 text-amber-300 font-mono uppercase tracking-widest">
          Building transcript, summary, and Word file...
        </div>
      )}
      {interimText && <div className="mt-1 text-cyan-200">{interimText}</div>}
      {dictationFocusActive && (
        <div className="mt-1 text-[#22c55e] font-mono uppercase tracking-widest">
          Dictation focus: model power reserved for listening.
        </div>
      )}
    </div>
  );

  const renderLiveTranscript = (compact = false) => (
    <div className="rounded-2xl border border-[#22c55e]/25 bg-[#06130d] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-3 py-3 border-b border-[#22c55e]/15">
        <div>
          <div className="text-[9px] font-mono font-bold uppercase tracking-[0.28em] text-[#22c55e]">
            Live Transcript
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            {captureMode ? "Listening is active." : "Words appear while the phone listens."}
          </div>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-200">
          {captureConsoleMode}
        </div>
      </div>
      <div className={`${compact ? "max-h-56" : "max-h-64"} overflow-y-auto p-3 space-y-2`}>
        {(captureMode === "meeting" || visibleMeetingSegments.length > 0) ? (
          visibleMeetingSegments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#1f3b2b] bg-black/20 px-3 py-4 text-[10px] leading-5 text-slate-500">
              Waiting for speech.
            </div>
          ) : (
            visibleMeetingSegments.slice(compact ? -8 : -10).map((segment) => (
              <div
                key={`live-${segment.id}`}
                className={`rounded-xl border px-3 py-2 ${segment.interim ? "border-cyan-300/35 bg-cyan-300/10" : "border-[#1f3b2b] bg-black/35"}`}
              >
                <div className="flex items-center justify-between gap-2 text-[9px] font-mono uppercase tracking-widest">
                  <span className={segment.interim ? "text-cyan-200" : "text-[#22c55e]"}>
                    {segment.interim ? `${getVoiceLabel(segment.speaker, voiceProfiles)} live` : getVoiceLabel(segment.speaker, voiceProfiles)}
                  </span>
                  <span className="text-slate-600">{formatDuration(segment.elapsedSec)}</span>
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-200">{segment.text}</div>
              </div>
            ))
          )
        ) : dictationPreviewLines.length > 0 ? (
          dictationPreviewLines.map((line, index) => (
            <div key={`${line}-${index}`} className="rounded-xl border border-[#1f3b2b] bg-black/35 px-3 py-2">
              <div className="text-[9px] font-mono uppercase tracking-widest text-[#22c55e]">
                {index === dictationPreviewLines.length - 1 && interimText.trim() ? "Live" : "You"}
              </div>
              <div className="mt-1 text-xs leading-5 text-slate-200">{line}</div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-[#1f3b2b] bg-black/20 px-3 py-4 text-[10px] leading-5 text-slate-500">
            No live words yet.
          </div>
        )}
      </div>
    </div>
  );

  const renderHeader = (title = "Notes", subtitle = "Spino memory and manual note board") => (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {notesView === "notes" ? (
            <NotebookPen className="w-6 h-6 text-[#22c55e]" />
          ) : (
            <button
              type="button"
              onClick={() => setNotesView("notes")}
              className="w-9 h-9 rounded-xl border border-[#2a2c32] bg-[#0c0c0d] text-slate-300 flex items-center justify-center"
              aria-label="Back to notes"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h1 className="text-xl font-bold text-white">{title}</h1>
        </div>
        <p className="text-[9px] font-mono uppercase tracking-[0.22em] text-[#8e9299] truncate">
          {subtitle}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {notesView === "notes" && (
          <button
            type="button"
            onClick={() => setNotesView("meeting")}
            className="w-10 h-10 rounded-xl border border-amber-400/25 bg-amber-400/10 text-amber-300 flex items-center justify-center"
            aria-label="Open meeting notes"
          >
            <Waves className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setNotesView(notesView === "settings" ? "notes" : "settings")}
          className="w-10 h-10 rounded-xl border border-[#2a2c32] bg-[#0c0c0d] text-slate-300 flex items-center justify-center"
          aria-label="Notes settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="pocketflow-screen-scroll flex-1 min-h-0 min-w-0 flex flex-col pt-4 pb-6 px-4 space-y-4 animate-fade-in"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {notesView === "meeting" ? (
        <>
          {renderHeader("Meeting Notes", "live capture and transcript package")}
          <section className="bg-[#151619] border border-[#2a2c32] rounded-2xl p-4 shadow-xl space-y-3">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                value={draft.memoLabel || draft.title}
                onChange={(event) => setDraft((value) => ({ ...value, memoLabel: event.target.value, title: value.title || event.target.value }))}
                placeholder="Meeting title"
                className="min-w-0 bg-[#0c0c0d] border border-[#2a2c32] rounded-xl px-3 py-3 text-sm text-slate-200 outline-none"
              />
              <button
                type="button"
                onClick={() => void startCapture("meeting")}
                className={`h-12 px-4 rounded-xl border text-[10px] font-mono font-bold uppercase tracking-widest flex items-center justify-center gap-2 ${captureMode === "meeting" ? "border-red-400/40 bg-red-500/15 text-red-300" : "border-amber-400/30 bg-amber-400/10 text-amber-300"}`}
              >
                {captureMode === "meeting" ? <MicOff className="w-4 h-4" /> : <Waves className="w-4 h-4" />}
                {captureMode === "meeting" ? "Stop" : "Start"}
              </button>
            </div>
            {renderStatusPanel()}
            {renderLiveTranscript(true)}
            {(draft.body.trim() || liveMeetingSegments.length > 0 || interimText.trim()) && (
              <button
                type="button"
                onClick={() => clearEditableVoiceText("meeting")}
                className="h-10 w-full rounded-xl border border-red-500/25 bg-red-500/10 text-red-200 text-[10px] font-mono font-bold uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Clear editable transcript
              </button>
            )}
            <div className="rounded-2xl border border-cyan-400/20 bg-[#071015] p-3 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[9px] font-mono font-bold uppercase tracking-[0.28em] text-cyan-200">
                    Meeting Pipeline
                  </div>
                  <div className="mt-1 text-[10px] leading-4 text-slate-500">
                    {meetingPipelineMessage}
                  </div>
                </div>
                <div className="shrink-0 rounded-full border border-cyan-300/20 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-200">
                  {captureMode === "meeting"
                    ? "Live"
                    : meetingProcessing
                      ? "Saving"
                      : latestMeetingPackage
                        ? latestMeetingPackage.status.replace(/_/g, " ")
                        : "Idle"}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {meetingPipelineSteps.map((step) => (
                  <div key={step.id} className={`rounded-xl border p-2 ${pipelineTone(step.status)}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[8px] font-mono font-bold uppercase tracking-[0.2em]">
                        {step.label}
                      </span>
                      <span className="text-[8px] font-mono uppercase tracking-widest opacity-75">
                        {pipelineBadge(step.status)}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] leading-4 text-slate-300">
                      {step.detail}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      ) : notesView === "settings" ? (
        <>
          {renderHeader("Notes Settings", "capture labels, voices and archives")}
          <section className="bg-[#151619] border border-[#2a2c32] rounded-2xl p-4 shadow-xl space-y-3">
            <textarea
              value={draft.details}
              onChange={(event) => setDraft((value) => ({ ...value, details: event.target.value }))}
              placeholder="Document details, context, purpose..."
              rows={2}
              className="w-full bg-[#0c0c0d] border border-[#2a2c32] rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none resize-none leading-relaxed"
            />
            <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
              <Tag className="w-4 h-4 text-slate-500" />
              <input
                value={draft.tags}
                onChange={(event) => setDraft((value) => ({ ...value, tags: event.target.value }))}
                placeholder="tags, comma separated"
                className="min-w-0 bg-[#0c0c0d] border border-[#2a2c32] rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none"
              />
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
              <Waves className="w-4 h-4 text-slate-500" />
              <input
                value={draft.memoLabel}
                onChange={(event) => setDraft((value) => ({ ...value, memoLabel: event.target.value }))}
                placeholder="voice memo label, optional"
                className="min-w-0 bg-[#0c0c0d] border border-[#2a2c32] rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none"
              />
            </div>
          </section>
          {(captureMode === "meeting" || visibleMeetingSegments.length > 0) && (
            <section className="rounded-2xl border border-[#22c55e]/25 bg-[#06130d] overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-3 py-3 border-b border-[#22c55e]/15">
                <div>
                  <div className="text-[9px] font-mono font-bold uppercase tracking-[0.28em] text-[#22c55e]">
                    Anonymous Voice Transcript
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">
                    Rename voice slots when needed.
                  </div>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-cyan-200">
                  {liveMeetingSegments.length}{liveInterimMeetingSegment ? " + live" : ""} turns
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {voiceProfiles.slice(0, 6).map((profile) => (
                    <label key={profile.id} className="rounded-xl border border-[#1f3b2b] bg-black/25 p-2">
                      <span className="block text-[8px] font-mono uppercase tracking-[0.2em] text-slate-600">
                        Voice slot
                      </span>
                      <input
                        value={profile.label}
                        onChange={(event) => renameVoiceProfile(profile.id, event.target.value)}
                        className="mt-1 w-full bg-transparent text-xs font-bold text-[#22c55e] outline-none"
                      />
                      <span className="mt-1 block text-[8px] font-mono uppercase tracking-widest text-slate-600">
                        {profile.sampleCount} turns
                      </span>
                    </label>
                  ))}
                  {voiceProfiles.length < 12 && (
                    <button
                      type="button"
                      onClick={addVoiceProfile}
                      className="rounded-xl border border-dashed border-[#22c55e]/30 bg-[#22c55e]/5 p-2 text-[9px] font-mono font-bold uppercase tracking-widest text-[#22c55e] flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add voice
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}
          <section className="rounded-2xl border border-[#2a2c32] bg-[#08090a] overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-3 py-3 border-b border-[#2a2c32]">
              <div>
                <div className="text-[9px] font-mono font-bold uppercase tracking-[0.28em] text-cyan-200">
                  Meeting Analysis Terminal
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  {captureMode === "meeting"
                    ? `Recording ${formatDuration(recordingSeconds)}`
                    : meetingProcessing
                      ? "Packaging files"
                      : meetingProgress === 100
                        ? "Ready in Archive"
                        : "Idle"}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-lg font-mono font-bold text-white">{meetingProgress}%</div>
                <div className="text-[8px] font-mono uppercase tracking-widest text-slate-600">
                  {captureMode === "meeting" ? "Live" : meetingProcessing ? "<1 min" : meetingProgress === 100 ? "Done" : "ETA"}
                </div>
              </div>
            </div>
            <div className="h-1 bg-[#111318]">
              <div className="h-full bg-[#22c55e] transition-all duration-500" style={{ width: `${meetingProgress}%` }} />
            </div>
            <div className="max-h-40 overflow-y-auto p-3 space-y-2">
              {meetingTerminal.length === 0 ? (
                <div className="text-[10px] text-slate-600">
                  Recorder and archive status will appear here.
                </div>
              ) : (
                meetingTerminal.map((entry) => (
                  <div key={entry.id} className="grid grid-cols-[48px_1fr_auto] gap-2 items-start text-[9px] leading-4">
                    <span className="font-mono text-slate-600">{entry.at}</span>
                    <span className={entry.level === "success" ? "text-[#22c55e]" : entry.level === "warn" ? "text-amber-300" : "text-slate-400"}>
                      {entry.text}
                    </span>
                    {typeof entry.progress === "number" && (
                      <span className="font-mono text-slate-600">{entry.progress}%</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
          {meetingPackages.length > 0 && (
            <section className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-[9px] font-mono font-bold uppercase tracking-widest text-amber-200">
                <FolderOpen className="w-4 h-4" /> Meeting Packages
              </div>
              {meetingPackages.map((meeting) => (
                <div key={meeting.id} className="rounded-lg border border-[#2a2c32] bg-[#0c0c0d] p-2 text-[9px] text-slate-400">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-200 truncate">{meeting.title}</span>
                    <span className={`font-mono shrink-0 uppercase ${meeting.status === "ready" ? "text-[#22c55e]" : meeting.status === "transcription_pending" ? "text-amber-300" : "text-red-300"}`}>
                      {meeting.status === "ready" ? "ready" : meeting.status === "transcription_pending" ? "pending" : "failed"}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1">
                    <span className={`rounded-md border px-2 py-1 text-center font-mono uppercase ${meeting.audioReady ? "border-cyan-400/20 bg-cyan-400/10 text-cyan-200" : "border-red-400/20 bg-red-400/10 text-red-300"}`}>
                      Audio
                    </span>
                    <span className={`rounded-md border px-2 py-1 text-center font-mono uppercase ${meeting.transcriptReady ? "border-[#22c55e]/20 bg-[#22c55e]/10 text-[#22c55e]" : "border-amber-400/20 bg-amber-400/10 text-amber-300"}`}>
                      Transcript
                    </span>
                    <span className={`rounded-md border px-2 py-1 text-center font-mono uppercase ${meeting.summaryReady ? "border-[#22c55e]/20 bg-[#22c55e]/10 text-[#22c55e]" : "border-amber-400/20 bg-amber-400/10 text-amber-300"}`}>
                      Summary
                    </span>
                  </div>
                  <div className="mt-2 text-slate-500">
                    {meeting.segmentCount} transcript chunk{meeting.segmentCount === 1 ? "" : "s"}
                    {meeting.durationMs ? ` • ${formatDuration(Math.round(meeting.durationMs / 1000))}` : ""}
                  </div>
                </div>
              ))}
            </section>
          )}
          {voiceMemos.length > 0 && (
            <section className="rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-[9px] font-mono font-bold uppercase tracking-widest text-cyan-200">
                <Waves className="w-4 h-4" /> Saved Voice Memos
              </div>
              {voiceMemos.map((memo) => (
                <div key={memo.id} className="rounded-lg border border-[#2a2c32] bg-[#0c0c0d] p-2 text-[9px] text-slate-400">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-200 truncate">{memo.fileName}</span>
                    <span className="font-mono text-cyan-300 shrink-0">{formatDuration(Math.round((memo.durationMs || 0) / 1000))}</span>
                  </div>
                  {memo.path && <div className="mt-1 truncate text-slate-600">{memo.path}</div>}
                </div>
              ))}
            </section>
          )}
        </>
      ) : (
        <>
          {renderHeader()}
          <div className="px-3 py-1.5 self-start rounded-full border border-[#22c55e]/25 bg-[#22c55e]/10 text-[#22c55e] text-[9px] font-mono font-bold uppercase tracking-widest">
            {notes.length} notes
          </div>

      <section className="bg-[#151619] border border-[#2a2c32] rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center gap-2 border-b border-[#2a2c32] pb-2">
          <Plus className="w-4 h-4 text-amber-400" />
          <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-300">
            {draft.id ? "Edit Note" : "New Note"}
          </h2>
        </div>
        <input
          value={draft.title}
          onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
          placeholder="Document title"
          className="w-full bg-[#0c0c0d] border border-[#2a2c32] rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none"
        />
        <textarea
          value={draft.body}
          onChange={(event) => setDraft((value) => ({ ...value, body: event.target.value }))}
          placeholder="Write or dictate here..."
          rows={4}
          className="w-full bg-[#0c0c0d] border border-[#2a2c32] rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none resize-none leading-relaxed"
        />
        {(draft.body.trim() || interimText.trim()) && (
          <button
            type="button"
            onClick={() => clearEditableVoiceText("draft")}
            className="h-10 rounded-xl border border-red-500/25 bg-red-500/10 text-red-200 text-[10px] font-mono font-bold uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear text
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => void startCapture("dictation")}
            className={`h-12 rounded-xl border text-[10px] font-mono font-bold uppercase tracking-widest flex items-center justify-center gap-2 ${captureMode === "dictation" ? "border-red-400/40 bg-red-500/15 text-red-300" : "border-[#22c55e]/25 bg-[#22c55e]/10 text-[#22c55e]"}`}
          >
            {captureMode === "dictation" ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {captureMode === "dictation" ? "Stop" : "Dictate"}
          </button>
          <button
            onClick={() => void startCapture("memo")}
            className={`h-12 rounded-xl border text-[10px] font-mono font-bold uppercase tracking-widest flex items-center justify-center gap-2 ${captureMode === "memo" ? "border-red-400/40 bg-red-500/15 text-red-300" : "border-cyan-400/25 bg-cyan-400/10 text-cyan-300"}`}
          >
            {captureMode === "memo" ? <MicOff className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            {captureMode === "memo" ? "Stop Memo" : "Voice Memo"}
          </button>
        </div>
        {renderStatusPanel()}
        {renderLiveTranscript()}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button onClick={saveDraft} className="h-11 rounded-xl bg-[#22c55e] text-black text-[10px] font-mono font-bold uppercase tracking-widest flex items-center justify-center gap-2">
            <Save className="w-4 h-4" /> Save Document
          </button>
          {draft.id && (
            <button onClick={() => setDraft(emptyDraft())} className="h-11 px-4 rounded-xl border border-[#2a2c32] text-slate-300 text-[10px] font-mono font-bold uppercase">
              New
            </button>
          )}
        </div>
      </section>

      <section className="bg-[#151619] border border-[#2a2c32] rounded-2xl p-4 shadow-xl space-y-3">
        <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
          <Search className="w-4 h-4 text-[#22c55e]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes"
            className="min-w-0 bg-[#0c0c0d] border border-[#2a2c32] rounded-xl px-3 py-2.5 text-xs text-slate-200 outline-none"
          />
        </div>
        <div className="space-y-2">
          {filteredNotes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#2a2c32] p-4 text-xs text-slate-500">No notes found.</div>
          ) : (
            filteredNotes.map((note) => (
              <div key={note.id} className="rounded-xl border border-[#2a2c32] bg-[#0c0c0d] p-3 space-y-2">
                <button onClick={() => editNote(note)} className="w-full text-left">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-bold text-white truncate">{note.title}</h3>
                    <span className="text-[8px] font-mono uppercase text-slate-600 shrink-0">{note.source}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed mt-1 whitespace-pre-wrap">{note.body}</p>
                  {note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {note.tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 rounded-lg border border-[#22c55e]/20 bg-[#22c55e]/10 text-[#22c55e] text-[8px] font-mono uppercase">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
                <button onClick={() => removeNote(note.id)} className="h-8 px-3 rounded-lg border border-red-500/20 text-red-400 bg-red-500/10 text-[9px] font-mono font-bold uppercase flex items-center gap-1">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            ))
          )}
        </div>
      </section>
        </>
      )}
    </div>
  );
}
