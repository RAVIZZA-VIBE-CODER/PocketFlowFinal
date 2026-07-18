const collapseSpaces = (value: string) => value.replace(/\s+/g, " ").trim();

const spokenCorrections: Array<[RegExp, string]> = [
  [/\bcalander\b|\bcalandar\b|\bcallendar\b|\bcallander\b|\bcalender\b|\bcalamender\b|\bcalamendar\b|\bcall ender\b/gi, "calendar"],
  [/\btommorow\b|\btomorow\b|\btomorroww\b/gi, "tomorrow"],
  [/\bremome\b|\bremouve\b|\bremoove\b/gi, "remove"],
  [/\bmoove\b|\bmooving\b/gi, "move"],
  [/\breaserch\b|\bresearchh\b/gi, "research"],
  [/\bdounload\b|\bsownload\b|\bdowload\b/gi, "download"],
  [/\barchieve\b|\barchivio\b/gi, "archive"],
  [/\bblutooth\b|\bbluethoot\b|\bblue tooth\b/gi, "Bluetooth"],
  [/\bwi fi\b|\bwifi\b/gi, "Wi-Fi"],
  [/\bspino llm\b|\bspinollm\b|\bspino lm\b|\bbaloss llm\b|\bbaloss\b/gi, "Baloss LLM"],
  [/\bpocket flow\b|\bpocketflow\b/gi, "PocketFlow"],
  [/\bcall me under\b|\bcall in there\b/gi, "calendar"],
  [/\badd app\b/gi, "add appointment"],
  [/\bmy plans\b/gi, "my plans"],
  [/\bapon?tm?ent\b|\bappuntamento\b|\bappuntamenti\b/gi, "appointment"],
  [/\bcal\b|\bagenda\b|\bdiary\b/gi, "calendar"],
  [/\bnotte\b|\bnota\b|\bmemo\b|\bvoice memo\b/gi, "note"],
  [/\btoo morrow\b|\bto morrow\b|\bdomani\b/gi, "tomorrow"],
  [/\bturin\b|\btorino\b/gi, "Turin"],
  [/\bmilano\b/gi, "Milan"],
  [/\bbuilder task\b|\bbuild task\b|\bworkflow task\b/gi, "builder task"],
  [/\bfull reaserch\b|\breaserch\b|\breaserch it\b/gi, "research"],
];

const fillerPatterns: RegExp[] = [
  /^(?:ok(?:ay)?|so|well|listen|spino|hey spino|ciao spino|baloss|hey baloss|ciao baloss)[, ]+/i,
  /\b(?:uh|um|ehm|erm)\b/gi,
];

const questionStart =
  /^(what|what's|whats|when|where|why|how|who|do|does|did|can|could|should|would|will|is|are|am|have|has|cosa|come|quando|dove|perche|perché|quali)\b/i;

export interface SpinoSpeechNormalization {
  text: string;
  changed: boolean;
  notes: string[];
}

export const normalizeSpinoSpeechInput = (raw: string): SpinoSpeechNormalization => {
  const original = collapseSpaces(raw);
  let text = original;
  const notes: string[] = [];

  for (const filler of fillerPatterns) {
    const next = collapseSpaces(text.replace(filler, " "));
    if (next !== text) {
      notes.push("removed filler words");
      text = next;
    }
  }

  for (const [pattern, replacement] of spokenCorrections) {
    const next = collapseSpaces(text.replace(pattern, replacement));
    if (next !== text) {
      notes.push(`normalized "${replacement}"`);
      text = next;
    }
  }

  text = text
    .replace(/\b(\d{1,2})\s*(?:o clock|oclock)\b/gi, "$1:00")
    .replace(/\bhalf past (\d{1,2})\b/gi, (_match, hour) => `${hour}:30`)
    .replace(/\bquarter past (\d{1,2})\b/gi, (_match, hour) => `${hour}:15`)
    .replace(/\bquarter to (\d{1,2})\b/gi, (_match, hour) => `${Number(hour) - 1}:45`)
    .replace(/\bnoon\b/gi, "12:00")
    .replace(/\bmidnight\b/gi, "00:00")
    .replace(/\b(\d{1,2})\s*(?:am|a m)\b/gi, (_match, hour) => `${Number(hour)}:00`)
    .replace(/\b(\d{1,2})\s*(?:pm|p m)\b/gi, (_match, hour) => `${Number(hour) === 12 ? 12 : Number(hour) + 12}:00`);

  text = collapseSpaces(text);
  if (text && !/[.!?]$/.test(text) && questionStart.test(text)) {
    text = `${text}?`;
  }

  return {
    text,
    changed: text !== original,
    notes: [...new Set(notes)],
  };
};

export const buildDictationUnderstandingContext = (prompt: string) => {
  const normalized = normalizeSpinoSpeechInput(prompt);
  return [
    "DICTATION MODE",
    "The user spoke this message. Treat it as natural speech, not a rigid typed command.",
    "Be tolerant of transcription errors, informal grammar, missing punctuation, mixed English/Italian, and fast-speech word joins.",
    "Infer the intended PocketFlow action only when the intent is clear. If it is ordinary conversation, answer normally.",
    normalized.changed ? `Normalized speech candidate: ${normalized.text}` : "",
  ].filter(Boolean).join("\n");
};
