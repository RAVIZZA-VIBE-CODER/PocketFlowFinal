import { loadCalendarEvents, loadLearnedMemories, loadLifeNotes, type LifeLearnedMemory } from "./lifeMemory";
import { getSpinoTaskAgentProfile, type SpinoTaskAgentProfile, type SpinoTaskSession } from "./spinoTaskChats";

const compact = (value: string, max = 180) => {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max).trim()}...` : clean;
};

const rankMemories = (query: string, memories: LifeLearnedMemory[]) => {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9@.+-]+/i)
    .filter((term) => term.length > 2);
  return memories
    .map((memory) => {
      const haystack = `${memory.kind} ${memory.label} ${memory.value} ${memory.tags.join(" ")} ${memory.raw}`.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      const kindBoost = memory.kind === "contact" ? 2 : memory.kind === "profile" ? 1.5 : memory.kind === "preference" ? 1 : 0;
      return { memory, score: score + kindBoost };
    })
    .sort((a, b) => b.score - a.score || b.memory.updatedAt.localeCompare(a.memory.updatedAt))
    .map((item) => item.memory);
};

const formatMemories = (memories: LifeLearnedMemory[]) =>
  memories.map((memory) => `- ${memory.kind.toUpperCase()} / ${memory.label}: ${compact(memory.value, 220)}`).join("\n");

const formatTaskContext = (task: SpinoTaskSession | null, selectedProfile: SpinoTaskAgentProfile | null) => {
  const profile = selectedProfile || getSpinoTaskAgentProfile(task?.agentId || task?.mode);
  if (!task && !profile) return "";
  const recentTurns = task?.turns.slice(-8).map((turn) => `${turn.role.toUpperCase()}: ${compact(turn.content, 240)}`).join("\n") || "";
  const attachments = task?.attachments.slice(0, 8).map((file) => `- ${file.path} (${file.type}) ${compact(file.excerpt, 180)}`).join("\n") || "";
  return [
    "ACTIVE TASK CHAT",
    profile ? `Agent: ${profile.label} (${profile.shortLabel}, color ${profile.color})` : "",
    profile ? `Agent purpose: ${profile.description}` : "",
    profile ? `Tone: ${profile.tone}` : "",
    task ? `Session: ${task.title}` : "Session: no active saved task yet",
    task?.objective ? `Objective: ${task.objective}` : "",
    recentTurns ? `Recent turns:\n${recentTurns}` : "",
    attachments ? `Attached context:\n${attachments}` : "",
    "Rules: keep this task context active until the user selects no task. If the task is an email, produce copy-ready drafts. If it is Builder/Code/Automation, preserve build order and actionable steps.",
  ].filter(Boolean).join("\n");
};

export const buildSpinoLearningContext = (
  query: string,
  options: {
    activeTask?: SpinoTaskSession | null;
    selectedTaskAgent?: SpinoTaskAgentProfile | null;
    maxMemories?: number;
  } = {},
) => {
  const learned = rankMemories(query, loadLearnedMemories()).slice(0, options.maxMemories || 14);
  const contacts = learned.filter((memory) => memory.kind === "contact").slice(0, 6);
  const profile = learned.filter((memory) => memory.kind === "profile").slice(0, 6);
  const preferences = learned.filter((memory) => memory.kind === "preference").slice(0, 6);
  const facts = learned.filter((memory) => memory.kind === "fact").slice(0, 6);
  const upcomingEvents = loadCalendarEvents().slice(0, 8).map((event) => `- ${event.date} ${event.time || "--:--"} ${event.title}${event.notes ? ` (${compact(event.notes, 100)})` : ""}`).join("\n");
  const recentNotes = loadLifeNotes().slice(0, 6).map((note) => `- ${note.title}: ${compact(note.body, 140)}`).join("\n");
  const taskContext = formatTaskContext(options.activeTask || null, options.selectedTaskAgent || null);

  return [
    "BALOSS LLM LEARNING AND WRITING CORE",
    "Identity: Baloss LLM is the PocketFlow local assistant. Be brief, practical, warm, and precise. Answer like a normal chat unless the user asks for a document, plan, or workflow.",
    "Learning rule: save explicit personal data only when the user tells you facts such as emails, phone numbers, contacts, preferences, project details, or says remember/learn/save. Treat commands for calendar/notes/tasks as actions, not general chat.",
    "Writing rule: when asked to write email/messages, use known profile/contact/tone memories and return copy-ready text. If a critical recipient or topic is missing, ask one short question.",
    "Task rule: if an active task chat exists, keep replies inside that task and use its agent purpose. If no agent is selected, just chat normally.",
    taskContext,
    profile.length ? `PROFILE MEMORY\n${formatMemories(profile)}` : "",
    contacts.length ? `CONTACT MEMORY\n${formatMemories(contacts)}` : "",
    preferences.length ? `PREFERENCE MEMORY\n${formatMemories(preferences)}` : "",
    facts.length ? `FACT MEMORY\n${formatMemories(facts)}` : "",
    upcomingEvents ? `UPCOMING CALENDAR\n${upcomingEvents}` : "",
    recentNotes ? `RECENT NOTES\n${recentNotes}` : "",
  ].filter(Boolean).join("\n\n");
};
