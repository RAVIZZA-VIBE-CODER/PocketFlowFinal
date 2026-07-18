export interface LifeCalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  source: "manual" | "spino" | "calenotes";
}

export interface LifeNote {
  id: string;
  title: string;
  body: string;
  details?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  source: "manual" | "spino" | "calenotes";
}

export type LifeTaskCategory =
  | "food-shopping"
  | "home-shopping"
  | "wardrobe-shopping"
  | "shopping"
  | "calendar-prep"
  | "work"
  | "personal"
  | "generic";

export interface LifeTaskItem {
  id: string;
  label: string;
  done: boolean;
  completedAt?: string;
}

export interface LifeTaskList {
  id: string;
  title: string;
  category: LifeTaskCategory;
  dueDate: string;
  time?: string;
  items: LifeTaskItem[];
  raw: string;
  sourceNoteId?: string;
  createdAt: string;
  updatedAt: string;
  agentStatus: "active" | "review" | "complete";
}

export interface CalenoteAnalysis {
  kind: "note" | "calendar" | "task-list" | "task";
  confidence: number;
  title: string;
  category: LifeTaskCategory;
  dueDate: string;
  time: string;
  items: string[];
  notes: string;
  reason: string;
  commands: CalenoteAgentCommand[];
  summary?: string;
  agentCalls: CalenoteAgentCall[];
}

export type CalenoteAgentCommand = "summary" | "analyze" | "remember" | "calendar" | "task";

export interface CalenoteAgentCall {
  agentId: "dictation" | "summary" | "analysis" | "memory" | "calendar" | "task";
  label: string;
  status: "active" | "parked" | "complete" | "skipped";
  detail: string;
}

export interface LifeLearnedMemory {
  id: string;
  kind: "profile" | "contact" | "preference" | "fact";
  label: string;
  value: string;
  raw: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  source: "spino" | "manual";
}

export type LifeMemoryAction =
  | { type: "calendar_added"; event: LifeCalendarEvent; response: string }
  | { type: "calendar_removed"; event: LifeCalendarEvent; response: string }
  | { type: "calendar_moved"; event: LifeCalendarEvent; previous: Pick<LifeCalendarEvent, "date" | "time">; response: string }
  | { type: "note_added"; note: LifeNote; response: string }
  | { type: "plans_answer"; date: string; events: LifeCalendarEvent[]; notes: LifeNote[]; response: string }
  | { type: "memory_saved"; memory: LifeLearnedMemory; response: string }
  | { type: "memory_answer"; memories: LifeLearnedMemory[]; response: string }
  | null;

const EVENTS_KEY = "pocketflow.life.calendar.v1";
const NOTES_KEY = "pocketflow.life.notes.v1";
const TASK_LISTS_KEY = "pocketflow.life.taskLists.v1";
const LEARNED_MEMORY_KEY = "pocketflow.life.learnedMemory.v1";

const safeParseArray = <T,>(key: string): T[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveArray = <T,>(key: string, value: T[]) => {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("pocketflow-life-memory-updated", { detail: { key } }));
};

export const loadCalendarEvents = () => safeParseArray<LifeCalendarEvent>(EVENTS_KEY);
export const saveCalendarEvents = (events: LifeCalendarEvent[]) => saveArray(EVENTS_KEY, events);
export const loadLifeNotes = () => safeParseArray<LifeNote>(NOTES_KEY);
export const saveLifeNotes = (notes: LifeNote[]) => saveArray(NOTES_KEY, notes);
export const loadTaskLists = () => safeParseArray<LifeTaskList>(TASK_LISTS_KEY);
export const saveTaskLists = (lists: LifeTaskList[]) => saveArray(TASK_LISTS_KEY, lists);
export const loadLearnedMemories = () => safeParseArray<LifeLearnedMemory>(LEARNED_MEMORY_KEY);
export const saveLearnedMemories = (memories: LifeLearnedMemory[]) => saveArray(LEARNED_MEMORY_KEY, memories);

export const formatLifeDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const labelLifeDate = (date: string) => {
  const today = formatLifeDate(new Date());
  const tomorrow = formatLifeDate(addDays(new Date(), 1));
  if (date === today) return "today";
  if (date === tomorrow) return "tomorrow";
  return new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" });
};

export const upsertCalendarEvent = (event: Omit<LifeCalendarEvent, "id" | "createdAt" | "updatedAt"> & { id?: string }) => {
  const now = new Date().toISOString();
  const events = loadCalendarEvents();
  const nextEvent: LifeCalendarEvent = {
    ...event,
    id: event.id || `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: events.find((item) => item.id === event.id)?.createdAt || now,
    updatedAt: now,
  };
  const next = [nextEvent, ...events.filter((item) => item.id !== nextEvent.id)].sort((a, b) =>
    `${a.date}T${a.time || "99:99"}`.localeCompare(`${b.date}T${b.time || "99:99"}`),
  );
  saveCalendarEvents(next);
  return nextEvent;
};

export const upsertLifeNote = (note: Omit<LifeNote, "id" | "createdAt" | "updatedAt"> & { id?: string }) => {
  const now = new Date().toISOString();
  const notes = loadLifeNotes();
  const nextNote: LifeNote = {
    ...note,
    id: note.id || `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: notes.find((item) => item.id === note.id)?.createdAt || now,
    updatedAt: now,
  };
  saveLifeNotes([nextNote, ...notes.filter((item) => item.id !== nextNote.id)]);
  return nextNote;
};

export const upsertLearnedMemory = (
  memory: Omit<LifeLearnedMemory, "id" | "createdAt" | "updatedAt"> & { id?: string },
) => {
  const now = new Date().toISOString();
  const memories = loadLearnedMemories();
  const normalizedLabel = normalize(memory.label);
  const existing = memories.find((item) => item.id === memory.id || (item.kind === memory.kind && normalize(item.label) === normalizedLabel));
  const nextMemory: LifeLearnedMemory = {
    ...memory,
    id: existing?.id || memory.id || `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  saveLearnedMemories([nextMemory, ...memories.filter((item) => item.id !== nextMemory.id)]);
  return nextMemory;
};

export const deleteCalendarEvent = (id: string) => {
  saveCalendarEvents(loadCalendarEvents().filter((event) => event.id !== id));
};

export const deleteLifeNote = (id: string) => {
  saveLifeNotes(loadLifeNotes().filter((note) => note.id !== id));
};

export const upsertTaskList = (list: Omit<LifeTaskList, "id" | "createdAt" | "updatedAt"> & { id?: string }) => {
  const now = new Date().toISOString();
  const lists = loadTaskLists();
  const existing = lists.find((item) => item.id === list.id);
  const nextList: LifeTaskList = {
    ...list,
    id: list.id || `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  saveTaskLists([nextList, ...lists.filter((item) => item.id !== nextList.id)]);
  return nextList;
};

const normalizeTaskLabel = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const shouldMergeOpenTaskList = (category: LifeTaskCategory) =>
  category === "food-shopping" || category === "home-shopping" || category === "wardrobe-shopping" || category === "shopping";

export const upsertMergedTaskList = (list: Omit<LifeTaskList, "id" | "createdAt" | "updatedAt"> & { id?: string }) => {
  if (!shouldMergeOpenTaskList(list.category)) return upsertTaskList(list);
  const now = new Date().toISOString();
  const lists = loadTaskLists();
  const openList = lists.find((item) =>
    item.category === list.category &&
    item.agentStatus !== "complete" &&
    item.items.some((taskItem) => !taskItem.done)
  );
  if (!openList) return upsertTaskList(list);

  const existingLabels = new Set(openList.items.map((item) => normalizeTaskLabel(item.label)));
  const newItems = list.items.filter((item) => {
    const key = normalizeTaskLabel(item.label);
    if (!key || existingLabels.has(key)) return false;
    existingLabels.add(key);
    return true;
  });
  const nextList: LifeTaskList = {
    ...openList,
    title: openList.title || list.title,
    dueDate: openList.dueDate || list.dueDate,
    time: openList.time || list.time,
    items: [...openList.items, ...newItems],
    raw: [openList.raw, list.raw].filter(Boolean).join("\n---\n"),
    sourceNoteId: list.sourceNoteId || openList.sourceNoteId,
    updatedAt: now,
    agentStatus: "active",
  };
  saveTaskLists([nextList, ...lists.filter((item) => item.id !== nextList.id)]);
  return nextList;
};

export const updateTaskItemDone = (listId: string, itemId: string, done: boolean) => {
  const now = new Date().toISOString();
  const lists = loadTaskLists();
  const next = lists.map((list) => {
    if (list.id !== listId) return list;
    const items = list.items.map((item) => (
      item.id === itemId ? { ...item, done, completedAt: done ? now : undefined } : item
    ));
    const complete = items.length > 0 && items.every((item) => item.done);
    return { ...list, items, updatedAt: now, agentStatus: complete ? "complete" as const : "active" as const };
  });
  saveTaskLists(next);
};

export const deleteTaskList = (id: string) => {
  saveTaskLists(loadTaskLists().filter((list) => list.id !== id));
};

export const deleteLearnedMemory = (id: string) => {
  saveLearnedMemories(loadLearnedMemories().filter((memory) => memory.id !== id));
};

export const getEventsForDate = (date: string) =>
  loadCalendarEvents()
    .filter((event) => event.date === date)
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));

export const getNotesForDateText = (date: string) => {
  const label = labelLifeDate(date).toLowerCase();
  return loadLifeNotes().filter((note) => {
    const haystack = `${note.title} ${note.body} ${note.tags.join(" ")}`.toLowerCase();
    return haystack.includes(date) || haystack.includes(label);
  });
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const compactValue = (value: string, max = 140) => {
  const compact = value.replace(/\s+/g, " ").replace(/[.]+$/g, "").trim();
  return compact.length > max ? `${compact.slice(0, max).trim()}...` : compact;
};

const parseDateFromText = (text: string) => {
  const normalized = normalize(text);
  if (/\b(day after tomorrow|dopodomani)\b/.test(normalized)) return formatLifeDate(addDays(new Date(), 2));
  if (/\b(tomorrow|tommorow|tomorow|domani)\b/.test(normalized)) return formatLifeDate(addDays(new Date(), 1));
  if (/\b(today|oggi)\b/.test(normalized)) return formatLifeDate(new Date());
  const iso = normalized.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const european = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/);
  if (european) {
    const year = european[3] || String(new Date().getFullYear());
    return `${year}-${european[2].padStart(2, "0")}-${european[1].padStart(2, "0")}`;
  }
  const thisMonthDay =
    normalized.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(?:this\s+month|month|mese|questo\s+mese)\b/) ||
    normalized.match(/\b(?:on|the|il)\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (thisMonthDay) {
    const today = new Date();
    const day = Number(thisMonthDay[1]);
    const candidate = new Date(today.getFullYear(), today.getMonth(), day);
    if (day > 0 && candidate.getMonth() === today.getMonth()) return formatLifeDate(candidate);
  }
  const weekdays: Record<string, number> = {
    sunday: 0,
    domenica: 0,
    monday: 1,
    lunedi: 1,
    lunedì: 1,
    tuesday: 2,
    martedi: 2,
    martedì: 2,
    wednesday: 3,
    mercoledi: 3,
    mercoledì: 3,
    thursday: 4,
    giovedi: 4,
    giovedì: 4,
    friday: 5,
    venerdi: 5,
    venerdì: 5,
    saturday: 6,
    sabato: 6,
  };
  const weekday = normalized.match(/\b(next|this|prossimo|prossima)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday|domenica|lunedi|lunedì|martedi|martedì|mercoledi|mercoledì|giovedi|giovedì|venerdi|venerdì|sabato)\b/);
  if (weekday) {
    const target = weekdays[weekday[2]];
    const today = new Date();
    let delta = (target - today.getDay() + 7) % 7;
    if (delta === 0 || /\b(next|prossimo|prossima)\b/.test(weekday[1] || "")) delta += 7;
    return formatLifeDate(addDays(today, delta));
  }
  return "";
};

const commandWantsCalendar = (text: string) => {
  const normalized = normalize(text);
  return /\b(cal|calendar|calender|calander|calandar|callendar|callander|calamnder|calamendar|calendario|schedule|agenda|appt|appointment|meeting|call|event|reminder|appuntamento|riunione|plans?|trip|travel|visit|viaggio|partenza)\b/i.test(normalized);
};

const resolveCalendarDate = (text: string) =>
  parseDateFromText(text) || (commandWantsCalendar(text) ? formatLifeDate(new Date()) : "");

const parseTimeFromText = (text: string) => {
  const normalized = normalize(text);
  if (/\bnoon\b|\bmezzogiorno\b/.test(normalized)) return "12:00";
  if (/\bmidnight\b|\bmezzanotte\b/.test(normalized)) return "00:00";
  const oClock = normalized.match(/\b(?:at|by|from|around|about|alle|ore|verso)?\s*(\d{1,2})\s*(?:o'clock|oclock|o clock)\s*(am|pm)?\b/);
  if (oClock) {
    let hour = Number(oClock[1]);
    const suffix = oClock[2];
    if (!suffix && hour >= 1 && hour <= 7) hour += 12;
    if (suffix === "pm" && hour < 12) hour += 12;
    if (suffix === "am" && hour === 12) hour = 0;
    if (hour > 23) return "";
    return `${String(hour).padStart(2, "0")}:00`;
  }
  const match =
    normalized.match(/\b(?:at|by|from|around|about|alle|ore|verso)\s*(\d{1,2})(?::|\.|h)?(\d{2})?\s*(am|pm)?\b/) ||
    normalized.match(/\b(\d{1,2})(?::|\.|h)(\d{2})\s*(am|pm)?\b/) ||
    normalized.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (!match) return "";
  let hour = Number(match[1]);
  let minuteText = match[2] || "0";
  let suffix = match[3];
  if (/^(am|pm)$/.test(minuteText)) {
    suffix = minuteText;
    minuteText = "0";
  }
  const minute = Number(minuteText || "0");
  if (suffix === "pm" && hour < 12) hour += 12;
  if (suffix === "am" && hour === 12) hour = 0;
  if (hour > 23 || Number.isNaN(minute) || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const extractExplicitNotes = (text: string) => {
  const match = text.match(/\b(?:notes?|note|memo|details?|description|descrizione)\s*[:=-]\s*(.+)$/i);
  return (match?.[1] || "").trim();
};

const extractExplicitTitle = (text: string) => {
  const match = text.match(/\b(?:title|titolo|summary|summery|name|nome|event)\s*[:=-]\s*(.+?)(?=\s+\b(?:notes?|note|memo|details?|description|descrizione|date|day|time|ora)\s*[:=-]|$)/i);
  return (match?.[1] || "").replace(/[.]+$/g, "").trim();
};

const cleanTitle = (text: string) => {
  const explicitTitle = extractExplicitTitle(text);
  if (explicitTitle) return explicitTitle;
  const withoutNotes = text.replace(/\b(?:notes?|note|memo|details?|description|descrizione)\s*[:=-]\s*.+$/i, "");
  const afterDash = withoutNotes.match(/[-–—]\s*([^–—-]+)$/)?.[1]?.trim();
  if (afterDash && afterDash.length > 1) return afterDash.replace(/[.]+$/g, "").trim();
  const cleaned = text
    .replace(/\b(i have|i've got|i got|i need|please|pls|can you|could you|add|create|book|schedule|go to|going to|travel to|visit|andare a|vado a|metti|aggiungi|put|insert|set|save|remove|delete|cancel|erase|drop|move|reschedule|postpone|shift|sposta|cancella|elimina|rimuovi|annulla|modifica)\b/gi, "")
    .replace(/\b(on|in|to|from)\s+(my\s+)?(cal|calendar|calender|calander|calandar|callendar|callander|calamnder|calamendar|calendario|agenda)\b/gi, "")
    .replace(/\b(cal|calendar|calender|calander|calandar|callendar|callander|calamnder|calamendar|calendario|agenda)\b/gi, "")
    .replace(/\b(an?|my)?\s*(appointment|meeting|call|event|reminder|app|appuntamento|riunione)\b/gi, "")
    .replace(/\b(today|tomorrow|tommorow|tomorow|day after tomorrow|domani|dopodomani|oggi)\b/gi, "")
    .replace(/\b(?:on|the|il)?\s*\d{1,2}(?:st|nd|rd|th)?\s+(?:of\s+)?(?:this\s+month|month|mese|questo\s+mese)\b/gi, "")
    .replace(/\b(next|this|prossimo|prossima)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday|domenica|lunedi|lunedì|martedi|martedì|mercoledi|mercoledì|giovedi|giovedì|venerdi|venerdì|sabato)\b/gi, "")
    .replace(/\b(at|by|from|around|about|alle|ore|verso)\s*(noon|midnight|mezzogiorno|mezzanotte|\d{1,2}(:|\.|h)?\d{0,2}\s*(am|pm)?|\d{1,2}\s*(?:o'clock|oclock|o clock)\s*(am|pm)?)\b/gi, "")
    .replace(/\b\d{1,2}\s*(?:o'clock|oclock|o clock)\s*(am|pm)?\b/gi, "")
    .replace(/\b\d{1,2}(:|\.|h)\d{2}\s*(am|pm)?\b/gi, "")
    .replace(/\b\d{1,2}\s*(am|pm)\b/gi, "")
    .replace(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/gi, "")
    .replace(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}))?\b/gi, "")
    .replace(/\b(?:notes?|note|memo|details?|description|descrizione)\s*[:=-]\s*.+$/i, "")
    .replace(/[-–—]/g, " ")
    .replace(/[.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(to|a|in|per)\s+/i, "")
    .trim();
  return cleaned || "Appointment";
};

type CalendarCommandIntent = "add" | "remove" | "move";

interface ParsedCalendarCommand {
  intent: CalendarCommandIntent;
  title: string;
  date: string;
  time: string;
  notes: string;
  destinationDate?: string;
  destinationTime?: string;
}

const detectCalendarIntent = (text: string): CalendarCommandIntent => {
  const normalized = normalize(text);
  if (/\b(move|moove|reschedule|rescedule|postpone|shift|change time|change date|sposta|rimanda|modifica)\b/.test(normalized)) return "move";
  if (/\b(remove|remome|remouve|delete|cancel|erase|drop|take off|clear|cancella|elimina|rimuovi|annulla|togli)\b/.test(normalized)) return "remove";
  return "add";
};

const hasCalendarAction = (text: string) =>
  /\b(add|create|book|schedule|put|insert|set|save|go|going|travel|visit|andare|vado|viaggio|partire|remove|remome|remouve|delete|cancel|erase|drop|take off|clear|move|moove|reschedule|rescedule|postpone|shift|change time|change date|metti|aggiungi|segna|programma|sposta|rimanda|modifica|cancella|elimina|rimuovi|annulla|togli)\b/.test(normalize(text));

const stripMoveDestination = (text: string) =>
  text
    .replace(/\b(?:to|for|onto|at|alle|ore|a|per)\s+(.+)$/i, "")
    .trim();

const extractMoveDestinationText = (text: string) => {
  const normalized = text.replace(/\s+/g, " ").trim();
  const match =
    normalized.match(/\b(?:move|reschedule|postpone|shift|sposta|rimanda|modifica)\b.+?\b(?:to|for|onto|alle|ore|a|per)\b\s+(.+)$/i) ||
    normalized.match(/\b(?:to|for|onto|alle|ore|a|per)\b\s+(.+)$/i);
  return (match?.[1] || "").trim();
};

const parseCalendarCommand = (text: string): ParsedCalendarCommand | null => {
  const hasDateOrTime = Boolean(parseDateFromText(text) || parseTimeFromText(text));
  if (!commandWantsCalendar(text) && !(hasCalendarAction(text) && hasDateOrTime)) return null;
  const intent = detectCalendarIntent(text);
  const destinationText = intent === "move" ? extractMoveDestinationText(text) : "";
  const searchText = intent === "move" && destinationText ? stripMoveDestination(text) : text;
  const date = intent === "add" ? resolveCalendarDate(text) : parseDateFromText(searchText);
  const time = parseTimeFromText(searchText);
  const destinationDate = destinationText ? parseDateFromText(destinationText) || parseDateFromText(text) : undefined;
  const destinationTime = destinationText ? parseTimeFromText(destinationText) || parseTimeFromText(text) : undefined;

  if (intent === "add" && !date) return null;
  if (intent === "move" && !destinationDate && !destinationTime) return null;

  return {
    intent,
    title: cleanTitle(searchText),
    date,
    time,
    notes: intent === "add" ? extractExplicitNotes(text) || text.trim() : extractExplicitNotes(text),
    destinationDate,
    destinationTime,
  };
};

const titleTokens = (value: string) =>
  normalize(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(" ")
    .filter((token) => token.length > 2 && !["the", "and", "for", "with", "calendar", "calander", "callendar", "appointment", "meeting", "event", "reminder"].includes(token));

const findCalendarMatch = (command: ParsedCalendarCommand) => {
  const events = loadCalendarEvents();
  const tokens = titleTokens(command.title);
  const candidates = events
    .filter((event) => !command.date || event.date === command.date)
    .filter((event) => !command.time || event.time === command.time)
    .map((event) => {
      let score = 0;
      if (command.date) score += event.date === command.date ? 8 : -4;
      if (command.time) score += event.time === command.time ? 6 : -2;
      const eventTitle = normalize(event.title);
      const commandTitle = normalize(command.title);
      if (commandTitle && eventTitle.includes(commandTitle)) score += 8;
      if (eventTitle && commandTitle.includes(eventTitle)) score += 6;
      const eventTokens = new Set(titleTokens(event.title));
      const tokenHits = tokens.filter((token) => eventTokens.has(token) || eventTitle.includes(token)).length;
      score += tokenHits * 3;
      if (!tokens.length && (command.date || command.time)) score += 1;
      return { event, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.score >= 5 ? candidates[0].event : null;
};

const extractNoteBody = (text: string) => {
  const match = text.match(/\b(take notes?|take a note|note this|save note|voice memo|memo archive|save memo)\b[:\s-]*(.*)$/i);
  return (match?.[2] || "").trim();
};

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/;

const memoryStopWords = new Set([
  "what",
  "where",
  "when",
  "why",
  "how",
  "can",
  "could",
  "would",
  "should",
  "do",
  "does",
  "did",
  "is",
  "are",
  "am",
  "please",
    "calendar",
    "calander",
    "calamnder",
    "callendar",
  "note",
  "notes",
  "remember",
  "learn",
  "save",
  "tell",
  "show",
  "list",
  "about",
]);

const tokenSet = (value: string) =>
  normalize(value)
    .replace(/[^a-z0-9@.+\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !memoryStopWords.has(token));

const classifyMemory = (label: string, value: string): LifeLearnedMemory["kind"] => {
  const normalized = normalize(`${label} ${value}`);
  if (EMAIL_RE.test(value) || /\b(email|mail|phone|telefono|number|numero|contact|contatto|address|indirizzo)\b/.test(normalized)) return "contact";
  if (/\b(like|love|prefer|favorite|favourite|odio|mi piace|preferisco|non mi piace)\b/.test(normalized)) return "preference";
  if (/\b(name|birthday|birthdate|live|work|company|role|job|sono|abito|lavoro)\b/.test(normalized)) return "profile";
  return "fact";
};

const memoryTagsFor = (kind: LifeLearnedMemory["kind"], label: string, value: string) => {
  const tags = new Set<string>(["spino", kind]);
  const normalized = normalize(`${label} ${value}`);
  if (EMAIL_RE.test(value) || normalized.includes("email")) tags.add("email");
  if (PHONE_RE.test(value) || /\b(phone|telefono|number|numero)\b/.test(normalized)) tags.add("phone");
  if (/\b(address|indirizzo|live|abito)\b/.test(normalized)) tags.add("address");
  if (/\b(contact|contatto)\b/.test(normalized)) tags.add("contact");
  return Array.from(tags);
};

const extractExplicitMemory = (text: string) => {
  const match = text.match(/\b(?:remember|learn|save|memorize|memorizza|ricorda|impara)(?:\s+(?:that|this|questo|che))?\b[:\s-]*(.+)$/i);
  return (match?.[1] || "").trim();
};

const labelFromRawFact = (raw: string) => {
  const compact = compactValue(raw, 70);
  const beforeIs = compact.match(/^(.{2,48}?)\s+(?:is|are|=|:)\s+/i)?.[1];
  if (beforeIs) return compactValue(beforeIs, 48);
  return compactValue(compact.split(/[,.]/)[0] || compact, 48);
};

const parseLearnedMemory = (prompt: string): Omit<LifeLearnedMemory, "id" | "createdAt" | "updatedAt"> | null => {
  const normalized = normalize(prompt);
  const explicit = extractExplicitMemory(prompt);
  const body = explicit || prompt.trim();
  const normalizedBody = normalize(body);
  const isQuestion = /[?？]\s*$/.test(prompt) || /^(what|where|when|why|how|who|quali|cosa|come|dove|quando)\b/.test(normalized);

  if (isQuestion && !explicit) return null;
  if (isPlansQuery(prompt) || isNoteCommand(prompt) || isCalendarCommand(prompt)) return null;

  const email = body.match(EMAIL_RE)?.[0];
  if (email) {
    const ownerMatch =
      body.match(/\b(?:my|mio|mia)\s+(?:email|mail)\s+(?:is|=|:)?\s*/i) ||
      body.match(/\b(?:email|mail)\s+(?:is|=|:)\s*/i);
    const namedOwner = body.match(/\b([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{1,42})\s+(?:email|mail)\s+(?:is|=|:)?\s*/i)?.[1]?.trim();
    const label = ownerMatch ? "my email" : namedOwner ? `${namedOwner} email` : "email contact";
    return {
      kind: "contact",
      label: compactValue(label, 54),
      value: email,
      raw: body,
      tags: ["spino", "contact", "email"],
      source: "spino",
    };
  }

  const phone = body.match(PHONE_RE)?.[0]?.trim();
  if (phone && /\b(my|phone|telefono|number|numero|contact|contatto|cell|mobile)\b/i.test(body)) {
    const namedOwner = body.match(/\b([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{1,42})\s+(?:phone|telefono|number|numero|mobile|cell)\b/i)?.[1]?.trim();
    const label = /\b(my|mio|mia)\b/i.test(body) ? "my phone" : namedOwner ? `${namedOwner} phone` : "phone contact";
    return {
      kind: "contact",
      label: compactValue(label, 54),
      value: phone,
      raw: body,
      tags: ["spino", "contact", "phone"],
      source: "spino",
    };
  }

  const myFact =
    body.match(/\b(?:my|mio|mia)\s+([A-Za-zÀ-ÿ0-9 _.'-]{2,42}?)\s+(?:is|are|=|:)\s+(.+)$/i) ||
    body.match(/\b(?:i am|i'm|im|io sono|sono)\s+(.+)$/i) ||
    body.match(/\b(?:i live in|i live at|abito a|vivo a)\s+(.+)$/i) ||
    body.match(/\b(?:i work at|i work for|lavoro da|lavoro per)\s+(.+)$/i) ||
    body.match(/\b(?:i like|i love|i prefer|mi piace|amo|preferisco)\s+(.+)$/i) ||
    body.match(/\b(?:i don't like|i do not like|non mi piace|odio)\s+(.+)$/i);

  if (myFact) {
    let label = "profile fact";
    let value = "";
    if (myFact.length >= 3 && myFact[2]) {
      label = `my ${myFact[1].trim()}`;
      value = myFact[2].trim();
    } else {
      const prefix = normalize(body).includes("live") || normalize(body).includes("abito") || normalize(body).includes("vivo")
        ? "where I live"
        : normalize(body).includes("work") || normalize(body).includes("lavoro")
          ? "where I work"
          : normalize(body).includes("like") || normalize(body).includes("prefer") || normalize(body).includes("piace") || normalize(body).includes("odio")
            ? "preference"
            : "profile fact";
      label = prefix;
      value = myFact[1].trim();
    }
    const kind = classifyMemory(label, value);
    return {
      kind,
      label: compactValue(label, 54),
      value: compactValue(value, 180),
      raw: body,
      tags: memoryTagsFor(kind, label, value),
      source: "spino",
    };
  }

  if (explicit || /\b(this is important|for training|for you to know|remember this)\b/i.test(prompt)) {
    const label = labelFromRawFact(body);
    const kind = classifyMemory(label, body);
    return {
      kind,
      label,
      value: compactValue(body, 220),
      raw: body,
      tags: memoryTagsFor(kind, label, body),
      source: "spino",
    };
  }

  if (!isQuestion && /\b(my|i am|i'm|im|i live|i work|i like|i love|i prefer|my email|my phone|my address|my company|my birthday)\b/i.test(prompt)) {
    const label = labelFromRawFact(body);
    const kind = classifyMemory(label, body);
    return {
      kind,
      label,
      value: compactValue(body, 220),
      raw: body,
      tags: memoryTagsFor(kind, label, body),
      source: "spino",
    };
  }

  return null;
};

export const searchLearnedMemories = (query: string, limit = 6) => {
  const terms = tokenSet(query);
  const normalizedQuery = normalize(query);
  const memories = loadLearnedMemories();
  if (!terms.length && !/\b(about me|contacts?|email|phone|preferences?|remember|memory|memories)\b/.test(normalizedQuery)) {
    return [];
  }
  return memories
    .map((memory) => {
      const haystack = normalize(`${memory.kind} ${memory.label} ${memory.value} ${memory.raw} ${memory.tags.join(" ")}`);
      let score = 0;
      for (const term of terms) {
        if (haystack.includes(term)) score += term.includes("@") ? 8 : 2;
      }
      if (normalizedQuery.includes("about me") && memory.kind === "profile") score += 4;
      if (normalizedQuery.includes("contact") && memory.kind === "contact") score += 5;
      if (normalizedQuery.includes("email") && memory.tags.includes("email")) score += 8;
      if (normalizedQuery.includes("phone") && memory.tags.includes("phone")) score += 8;
      if (normalizedQuery.includes("prefer") && memory.kind === "preference") score += 5;
      return { memory, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.memory.updatedAt.localeCompare(a.memory.updatedAt))
    .slice(0, limit)
    .map((item) => item.memory);
};

export const buildLearnedMemoryContext = (query: string, limit = 8) => {
  const memories = searchLearnedMemories(query, limit);
  if (!memories.length) return "";
  return memories.map((memory, index) => `[M${index + 1}] ${memory.kind.toUpperCase()} / ${memory.label}: ${memory.value}`).join("\n");
};

const isMemoryQuery = (text: string) => {
  const normalized = normalize(text);
  return (
    /\b(what|whats|what's|show|tell|list|quali|cosa|dimmi|mostra|do you know|who am i)\b/.test(normalized) &&
    /\b(remember|memory|memories|know about me|about me|contacts?|email|mail|phone|telefono|preferences?|preferenze|profile)\b/.test(normalized)
  );
};

const answerMemoryQuery = (prompt: string): LifeMemoryAction => {
  if (!isMemoryQuery(prompt)) return null;
  const memories = searchLearnedMemories(prompt, 10);
  if (!memories.length) {
    return {
      type: "memory_answer",
      memories: [],
      response: "I do not have a saved local memory for that yet. Tell me the detail once, and I will store it in Baloss LLM memory.",
    };
  }
  const grouped = memories.reduce<Record<string, LifeLearnedMemory[]>>((acc, memory) => {
    acc[memory.kind] = [...(acc[memory.kind] || []), memory];
    return acc;
  }, {});
  const lines = [
    "Local Baloss LLM memory:",
    ...(["profile", "contact", "preference", "fact"] as LifeLearnedMemory["kind"][]).flatMap((kind) =>
      (grouped[kind] || []).length
        ? [`\n${kind.toUpperCase()}:`, ...(grouped[kind] || []).map((memory) => `- ${memory.label}: ${memory.value}`)]
        : [],
    ),
  ];
  return { type: "memory_answer", memories, response: lines.join("\n") };
};

const isCalendarCommand = (text: string) => {
  const normalized = normalize(text);
  const hasAction = /\b(add|create|book|schedule|put|insert|set|save|go|going|travel|visit|andare|vado|viaggio|partire|remove|delete|cancel|erase|drop|move|reschedule|postpone|shift|metti|aggiungi|segna|programma|sposta|cancella|elimina|rimuovi|annulla)\b/.test(normalized);
  const hasNaturalAdd = /\b(i have|i've got|i got|i need|ho|avrò|devo)\b/.test(normalized);
  const hasCalendarTarget = commandWantsCalendar(normalized);
  const hasDateOrTime = Boolean(parseDateFromText(normalized) || parseTimeFromText(normalized));
  return (hasAction && hasCalendarTarget) || (hasAction && hasDateOrTime) || (hasNaturalAdd && hasCalendarTarget && hasDateOrTime);
};

const isPlansQuery = (text: string) => {
  const normalized = normalize(text);
  return /\b(what|show|tell|list|collect|quali|cosa)\b/.test(normalized) &&
    /\b(plans|calendar|appointments|events|schedule|impegni|appuntamenti)\b/.test(normalized) &&
    /\b(today|tomorrow|tommorow|tomorow|domani|oggi|20\d{2}[-/]\d{1,2}[-/]\d{1,2})\b/.test(normalized);
};

const isNoteCommand = (text: string) => /\b(take notes?|take a note|note this|save note|voice memo|memo archive|save memo)\b/i.test(text);

const listItemStopWords = new Set([
  "shopping",
  "list",
  "lista",
  "buy",
  "bought",
  "need",
  "devo",
  "comprare",
  "week",
  "weekly",
  "this",
  "for",
  "per",
  "the",
  "and",
  "con",
]);

const cleanTaskItem = (value: string) =>
  value
    .replace(/^[-*•\d.)\s]+/, "")
    .replace(/^(?:to\s+)?(?:buy|purchase|get|grab|pick up|comprare|prendere|comprar|comprar\s+un[ao]?|devo comprare|need to buy|i need|mi serve)\s+/i, "")
    .replace(/\b(?:and|e|y)\b/gi, "")
    .replace(/[.;]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

const uniqueItems = (items: string[]) => {
  const seen = new Set<string>();
  return items
    .map(cleanTaskItem)
    .filter((item) => item.length > 1)
    .filter((item) => {
      const key = normalize(item);
      if (!key || listItemStopWords.has(key)) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 40);
};

const extractListItems = (text: string) => {
  const rawLines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const bulletItems = rawLines
    .filter((line) => /^[-*•\d.)\s]+/.test(line))
    .map(cleanTaskItem);

  if (bulletItems.length >= 2) return uniqueItems(bulletItems);

  const afterColon = text.match(/(?:shopping list|lista|buy|comprare|comprar|need|devo|items?|cose)\s*[:=-]\s*(.+)$/i)?.[1] || text;
  const commaItems = afterColon
    .replace(/\band\b/gi, ",")
    .replace(/\be\b/gi, ",")
    .replace(/\by\b/gi, ",")
    .split(/[,;]+/)
    .map(cleanTaskItem);

  return uniqueItems(commaItems);
};

const classifyTaskCategory = (text: string, items: string[]): LifeTaskCategory => {
  const normalized = normalize(`${text} ${items.join(" ")}`);
  if (/\b(food|grocery|groceries|supermarket|bread|water|milk|pasta|rice|vegetables|fruit|sausage|sausages|sushi|spring onion|spring onions|spring roll|spring rolls|pane|acqua|latte|spesa|cibo|salsiccia|salsicce|riso|sigarette|cigarettes)\b/.test(normalized)) {
    return "food-shopping";
  }
  if (/\b(house|home|cleaning|detergent|soap|toilet|kitchen|bathroom|casa|detersivo|sapone|bagno|cucina)\b/.test(normalized)) {
    return "home-shopping";
  }
  if (/\b(wardrobe|dress|shoes|shirt|tuxedo|tie|papillon|black shoes|jacket|vestito|scarpe|camicia|giacca)\b/.test(normalized)) {
    return "wardrobe-shopping";
  }
  if (/\b(shop|shopping|buy|purchase|comprare|spesa|lista)\b/.test(normalized)) return "shopping";
  if (/\b(meeting|call|appointment|calendar|prep|agenda|riunione|appuntamento)\b/.test(normalized)) return "calendar-prep";
  if (/\b(work|client|project|build|email|call|office|lavoro|cliente|progetto)\b/.test(normalized)) return "work";
  if (/\b(personal|family|home|doctor|health|famiglia|personale|medico)\b/.test(normalized)) return "personal";
  return "generic";
};

const titleForTaskCategory = (category: LifeTaskCategory, text: string) => {
  const explicitTitle = extractExplicitTitle(text);
  if (explicitTitle) return compactValue(explicitTitle, 64);
  if (category === "food-shopping") return "Food shopping list";
  if (category === "home-shopping") return "House shopping list";
  if (category === "wardrobe-shopping") return "Wardrobe shopping list";
  if (category === "shopping") return "Shopping list";
  if (category === "calendar-prep") return "Calendar preparation";
  return compactValue(cleanTitle(text), 64) || "Task list";
};

const detectCalenoteCommands = (text: string): CalenoteAgentCommand[] => {
  const normalized = normalize(text);
  const commands = new Set<CalenoteAgentCommand>();
  if (/^(write|make|create|add)?\s*(summary|summarize|summery|riassunto)\b/.test(normalized) || /\b(write|make|create|add)?\s*(summary|summarize|summery|riassunto)\s*$/.test(normalized)) {
    commands.add("summary");
  }
  if (/^(analyze|analyse|analysis|analizza)\b/.test(normalized) || /\b(analyze this|analyse this|analyze note|analysis)\s*$/.test(normalized)) {
    commands.add("analyze");
  }
  if (/\b(remember|learn|save to memory|memorizza|ricorda|impara)\b/.test(normalized)) {
    commands.add("remember");
  }
  if (commandWantsCalendar(text) || /\b(calendar|agenda|event|meeting|appointment|reminder|calendario|appuntamento|riunione)\b/.test(normalized)) {
    commands.add("calendar");
  }
  if (/\b(task|todo|to do|shopping list|lista|buy|comprare|complete|checklist)\b/.test(normalized)) {
    commands.add("task");
  }
  return Array.from(commands);
};

const stripCalenoteCommands = (text: string) =>
  text
    .replace(/^\s*(write|make|create|add)?\s*(summary|summarize|summery|riassunto|analyze|analyse|analysis|analizza)\s*[:,;-]?\s*/i, "")
    .replace(/\s*[:,;-]?\s*(write|make|create|add)?\s*(summary|summarize|summery|riassunto|analyze|analyse|analysis|analizza)\s*$/i, "")
    .trim();

const buildCalenoteSummary = (text: string) => {
  const clean = stripCalenoteCommands(text).replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const actionSentences = sentences.filter((sentence) => /\b(need|must|should|todo|task|buy|call|send|build|fix|remember|devo|comprare|mandare|chiamare)\b/i.test(sentence));
  const picked = [...actionSentences, ...sentences].filter((sentence, index, source) => source.indexOf(sentence) === index).slice(0, 4);
  const summary = picked.length ? picked.join(" ") : clean;
  return compactValue(summary, 520);
};

const buildCalenoteAgentCalls = (
  commands: CalenoteAgentCommand[],
  kind: CalenoteAnalysis["kind"],
  summary: string,
): CalenoteAgentCall[] => {
  const wantsTask = kind === "task" || kind === "task-list" || commands.includes("task");
  const wantsCalendar = kind === "calendar" || commands.includes("calendar");
  return [
    {
      agentId: "dictation",
      label: "Dictation Context Agent",
      status: "complete",
      detail: "Keeps the full note/session text as the source of truth until you stop or save.",
    },
    {
      agentId: "summary",
      label: "Summary Agent",
      status: commands.includes("summary") ? "complete" : "parked",
      detail: commands.includes("summary") ? summary || "Summary requested, but no stable text was available." : "Parked until the note says summary/summarize.",
    },
    {
      agentId: "analysis",
      label: "Context Analysis Agent",
      status: commands.includes("analyze") || wantsTask || wantsCalendar ? "complete" : "parked",
      detail: commands.includes("analyze") ? "Analyzed the note context and routed detected tasks/events." : "Parked unless command words or actionable context are detected.",
    },
    {
      agentId: "memory",
      label: "Memory Agent",
      status: commands.includes("remember") ? "active" : "parked",
      detail: commands.includes("remember") ? "Will try to save explicit facts into local Baloss memory." : "Parked until remember/learn/save-to-memory is present.",
    },
    {
      agentId: "calendar",
      label: "Calendar Agent",
      status: wantsCalendar ? "active" : "parked",
      detail: wantsCalendar ? "Calendar parser is unparked for add/move/remove/query style event work." : "Parked because no calendar event was detected.",
    },
    {
      agentId: "task",
      label: "Task/List Agent",
      status: wantsTask ? "active" : "parked",
      detail: wantsTask ? "Task/list parser is unparked for checklist or shopping-list work." : "Parked because no task/list was detected.",
    },
  ];
};

export const analyzeCalenoteText = (text: string): CalenoteAnalysis => {
  const body = stripCalenoteCommands(text.trim());
  const date = parseDateFromText(body);
  const time = parseTimeFromText(body);
  const calendarCommand = parseCalendarCommand(body);
  const items = extractListItems(body);
  const category = classifyTaskCategory(body, items);
  const normalized = normalize(body);
  const commands = detectCalenoteCommands(text);
  const summary = commands.includes("summary") ? buildCalenoteSummary(text) : "";
  const looksLikeList =
    items.length >= 2 &&
    (/\b(shopping list|lista|buy|purchase|comprare|spesa|items?|things to get|need to buy|devo comprare)\b/.test(normalized)
      || category.includes("shopping")
      || body.includes("\n")
      || body.includes(","));

  if (calendarCommand && (isCalendarCommand(body) || date || time)) {
    const kind = "calendar" as const;
    return {
      kind,
      confidence: time || date ? 88 : 70,
      title: calendarCommand.title,
      category: "calendar-prep",
      dueDate: calendarCommand.date || date || formatLifeDate(new Date()),
      time: calendarCommand.time || time,
      items,
      notes: calendarCommand.notes || body,
      reason: "Date/time or calendar vocabulary detected.",
      commands,
      summary,
      agentCalls: buildCalenoteAgentCalls(commands, kind, summary),
    };
  }

  if (looksLikeList) {
    const kind = "task-list" as const;
    return {
      kind,
      confidence: category.includes("shopping") ? 92 : 78,
      title: titleForTaskCategory(category, body),
      category,
      dueDate: date || formatLifeDate(new Date()),
      time,
      items,
      notes: body,
      reason: `${items.length} list item${items.length === 1 ? "" : "s"} detected.`,
      commands,
      summary,
      agentCalls: buildCalenoteAgentCalls(commands, kind, summary),
    };
  }

  if (/\b(todo|to do|task|remind|remember to|devo|need to|should|must)\b/.test(normalized)) {
    const kind = "task" as const;
    return {
      kind,
      confidence: 68,
      title: compactValue(cleanTitle(body), 64) || "Task",
      category,
      dueDate: date || formatLifeDate(new Date()),
      time,
      items: [compactValue(cleanTitle(body), 90)].filter(Boolean),
      notes: body,
      reason: "Action/task wording detected.",
      commands,
      summary,
      agentCalls: buildCalenoteAgentCalls(commands, kind, summary),
    };
  }

  const kind = "note" as const;
  return {
    kind,
    confidence: 55,
    title: compactValue(cleanTitle(body), 64) || "Note",
    category: "generic",
    dueDate: date || "",
    time,
    items,
    notes: body,
    reason: "No actionable task/calendar signal strong enough.",
    commands,
    summary,
    agentCalls: buildCalenoteAgentCalls(commands, kind, summary),
  };
};

export const createCalenoteFromText = (input: { title?: string; body: string; agentCheck: boolean }) => {
  const body = input.body.trim();
  const analysis = analyzeCalenoteText(body);
  const title = input.title?.trim() || analysis.title || (body.length > 42 ? `${body.slice(0, 42).trim()}...` : body || "Untitled memo");
  const agentDetails = input.agentCheck
    ? [
      `Calenotes agent: ${analysis.kind} (${analysis.confidence}%). ${analysis.reason}`,
      analysis.commands.length ? `Commands: ${analysis.commands.join(", ")}` : "Commands: none",
      analysis.summary ? `Summary: ${analysis.summary}` : "",
      `Agent calls: ${analysis.agentCalls.map((call) => `${call.label}=${call.status}`).join("; ")}`,
    ].filter(Boolean).join("\n")
    : undefined;
  const note = upsertLifeNote({
    title,
    body,
    details: agentDetails,
    tags: ["calenotes", input.agentCheck ? analysis.kind : "note", analysis.category].filter(Boolean),
    source: "calenotes",
  });

  const summaryNote = input.agentCheck && analysis.summary
    ? upsertLifeNote({
      title: `Summary - ${title}`,
      body: analysis.summary,
      details: `Generated by Calenotes Summary Agent for note ${note.id}.`,
      tags: ["calenotes", "summary", analysis.category],
      source: "calenotes",
    })
    : null;

  const memory = input.agentCheck && analysis.commands.includes("remember")
    ? (() => {
      const learnedMemory = parseLearnedMemory(body);
      return learnedMemory ? upsertLearnedMemory(learnedMemory) : null;
    })()
    : null;

  if (!input.agentCheck || analysis.kind === "note") {
    return { analysis, note, summaryNote, memory, event: null as LifeCalendarEvent | null, taskList: null as LifeTaskList | null };
  }

  if (analysis.kind === "calendar") {
    const event = upsertCalendarEvent({
      title: analysis.title,
      date: analysis.dueDate || formatLifeDate(new Date()),
      time: analysis.time,
      notes: analysis.notes,
      source: "calenotes",
    });
    return { analysis, note, summaryNote, memory, event, taskList: null as LifeTaskList | null };
  }

  const taskItems = (analysis.items.length ? analysis.items : [analysis.title]).map((label, index) => ({
    id: `item_${Date.now().toString(36)}_${index}_${Math.random().toString(36).slice(2, 5)}`,
    label,
    done: false,
  }));
  const taskList = upsertMergedTaskList({
    title: analysis.title,
    category: analysis.category,
    dueDate: analysis.dueDate || formatLifeDate(new Date()),
    time: analysis.time,
    items: taskItems,
    raw: body,
    sourceNoteId: note.id,
    agentStatus: "active",
  });
  return { analysis, note, summaryNote, memory, event: null as LifeCalendarEvent | null, taskList };
};

export const handleLifeMemoryPrompt = (prompt: string): LifeMemoryAction => {
  const date = resolveCalendarDate(prompt);
  const calendarCommand = parseCalendarCommand(prompt);

  if (isPlansQuery(prompt) && date) {
    const events = getEventsForDate(date);
    const notes = getNotesForDateText(date);
    const lines = [
      `Plans for ${labelLifeDate(date)} (${date}):`,
      events.length
        ? events.map((event) => `- ${event.time || "All day"} ${event.title}${event.notes ? ` — ${event.notes}` : ""}`).join("\n")
        : "- No calendar events saved.",
      notes.length ? `\nRelated notes:\n${notes.map((note) => `- ${note.title}: ${note.body}`).join("\n")}` : "",
    ];
    return { type: "plans_answer", date, events, notes, response: lines.filter(Boolean).join("\n") };
  }

  const memoryAnswer = answerMemoryQuery(prompt);
  if (memoryAnswer) return memoryAnswer;

  if (calendarCommand && isCalendarCommand(prompt)) {
    if (calendarCommand.intent === "remove") {
      const event = findCalendarMatch(calendarCommand);
      if (!event) {
        return {
          type: "plans_answer",
          date: calendarCommand.date || formatLifeDate(new Date()),
          events: [],
          notes: [],
          response: "I understood this is a calendar removal, but I could not confidently match the event. Add the date/time or exact title and I will remove it.",
        };
      }
      deleteCalendarEvent(event.id);
      return {
        type: "calendar_removed",
        event,
        response: [
          "Calendar automation complete.",
          `Removed: ${event.title}`,
          `Date: ${labelLifeDate(event.date)} (${event.date})`,
          `Time: ${event.time || "All day"}`,
        ].join("\n"),
      };
    }

    if (calendarCommand.intent === "move") {
      const event = findCalendarMatch(calendarCommand);
      if (!event) {
        return {
          type: "plans_answer",
          date: calendarCommand.destinationDate || calendarCommand.date || formatLifeDate(new Date()),
          events: [],
          notes: [],
          response: "I understood this is a calendar move, but I could not confidently match the original event. Tell me the current date/time or exact title and the new date/time.",
        };
      }
      const previous = { date: event.date, time: event.time };
      const moved = upsertCalendarEvent({
        ...event,
        date: calendarCommand.destinationDate || event.date,
        time: calendarCommand.destinationTime || event.time,
        notes: calendarCommand.notes || event.notes,
        source: "spino",
      });
      return {
        type: "calendar_moved",
        event: moved,
        previous,
        response: [
          "Calendar automation complete.",
          `Moved: ${moved.title}`,
          `From: ${labelLifeDate(previous.date)} (${previous.date}) ${previous.time || "All day"}`,
          `To: ${labelLifeDate(moved.date)} (${moved.date}) ${moved.time || "All day"}`,
        ].join("\n"),
      };
    }

    const event = upsertCalendarEvent({
      title: calendarCommand.title,
      date: calendarCommand.date,
      time: calendarCommand.time,
      notes: calendarCommand.notes,
      source: "spino",
    });
    return {
      type: "calendar_added",
      event,
      response: [
        "Calendar automation complete.",
        `Event: ${event.title}`,
        `Date: ${labelLifeDate(event.date)} (${event.date})`,
        `Time: ${event.time || "All day"}`,
        `Notes: ${event.notes || "None"}`,
      ].join("\n"),
    };
  }

  if (isNoteCommand(prompt)) {
    const body = extractNoteBody(prompt) || prompt.trim();
    const title = body.length > 42 ? `${body.slice(0, 42).trim()}...` : body || "Untitled note";
    const tags = /\b(voice memo|memo archive|save memo)\b/i.test(prompt) ? ["spino", "voice-memo"] : ["spino"];
    const note = upsertLifeNote({
      title,
      body,
      tags,
      source: "spino",
    });
    return { type: "note_added", note, response: `Saved note: ${note.title}` };
  }

  const learnedMemory = parseLearnedMemory(prompt);
  if (learnedMemory) {
    const memory = upsertLearnedMemory(learnedMemory);
    return {
      type: "memory_saved",
      memory,
      response: [
        "Saved to local Baloss LLM memory.",
        `Type: ${memory.kind}`,
        `Label: ${memory.label}`,
        `Value: ${memory.value}`,
      ].join("\n"),
    };
  }

  return null;
};
