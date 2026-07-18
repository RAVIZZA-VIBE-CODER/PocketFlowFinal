import type { ArchitectureBox, BuilderProject, BoxConnection, BoxType, ReceivedFile } from "../types";
import { getFileExtension, sanitizeFileName } from "./fileValidation";
import { saveBuilderProject, saveFileBlob, saveFileMetadata } from "./storage";

export interface SpinoTaskAttachment {
  id: string;
  name: string;
  path: string;
  type: string;
  size: number;
  addedAt: string;
  excerpt: string;
}

export interface SpinoTaskTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export type SpinoTaskMode =
  | "builder"
  | "research"
  | "email"
  | "personal"
  | "code"
  | "automation"
  | "notes"
  | "general";

export interface SpinoTaskAgentProfile {
  id: Exclude<SpinoTaskMode, "general">;
  label: string;
  shortLabel: string;
  color: string;
  description: string;
  tone: string;
  starter: string;
  workflowCapable: boolean;
}

export interface SpinoTaskSession {
  id: string;
  title: string;
  mode: SpinoTaskMode;
  agentId?: SpinoTaskMode;
  agentColor?: string;
  agentLabel?: string;
  objective?: string;
  createdAt: string;
  updatedAt: string;
  turns: SpinoTaskTurn[];
  attachments: SpinoTaskAttachment[];
  pinnedPoints: string[];
}

export interface SpinoCompiledWorkflow {
  project: BuilderProject;
  markdown: string;
  json: string;
  archiveFile: ReceivedFile;
}

const TASKS_KEY = "pocketflow.spino.taskChats.v1";
const ACTIVE_TASK_KEY = "pocketflow.spino.activeTaskChat.v1";
const MAX_TURNS_PER_TASK = 220;
const MAX_ATTACHMENT_EXCERPT = 2600;

export const SPINO_TASK_AGENT_PROFILES: SpinoTaskAgentProfile[] = [
  {
    id: "builder",
    label: "Builder Architect",
    shortLabel: "Builder",
    color: "#22c55e",
    description: "Turns long task chats into ordered Builder boxes, prompts, files, and archive handoffs.",
    tone: "Direct, architectural, implementation-focused.",
    starter: "Builder task",
    workflowCapable: true,
  },
  {
    id: "research",
    label: "Research Analyst",
    shortLabel: "Research",
    color: "#38bdf8",
    description: "Collects sources, compares facts, keeps useful findings, and writes short briefings.",
    tone: "Evidence-led, concise, source-aware.",
    starter: "Research task",
    workflowCapable: false,
  },
  {
    id: "email",
    label: "Email Writer",
    shortLabel: "Email",
    color: "#f59e0b",
    description: "Uses profile, contacts, and tone memory to draft copy-ready emails and messages.",
    tone: "Professional, natural, short unless asked for detail.",
    starter: "Email task",
    workflowCapable: false,
  },
  {
    id: "personal",
    label: "Personal Memory",
    shortLabel: "Memory",
    color: "#a78bfa",
    description: "Learns facts about you, contacts, preferences, projects, and how you like things done.",
    tone: "Careful, private, confirms what was saved.",
    starter: "Memory task",
    workflowCapable: false,
  },
  {
    id: "code",
    label: "Code Planner",
    shortLabel: "Code",
    color: "#2dd4bf",
    description: "Turns requirements into file maps, implementation plans, tests, and code-agent prompts.",
    tone: "Technical, scoped, build-order aware.",
    starter: "Code task",
    workflowCapable: true,
  },
  {
    id: "automation",
    label: "Automation Operator",
    shortLabel: "Auto",
    color: "#fb7185",
    description: "Plans safe multi-step actions across approved PocketFlow tools and reports completion.",
    tone: "Slow, deliberate, permission-aware.",
    starter: "Automation task",
    workflowCapable: true,
  },
  {
    id: "notes",
    label: "Notes Keeper",
    shortLabel: "Notes",
    color: "#facc15",
    description: "Captures notes, summaries, decisions, and next actions for later recall.",
    tone: "Organized, compact, retrieval-friendly.",
    starter: "Notes task",
    workflowCapable: false,
  },
];

export const getSpinoTaskAgentProfile = (mode: SpinoTaskMode | "" | undefined) =>
  SPINO_TASK_AGENT_PROFILES.find((profile) => profile.id === mode) || null;

const uid = (prefix: string) => {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
};

const nowIso = () => new Date().toISOString();

const cleanText = (value: string) =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00a0]{2,}/g, " ")
    .trim();

const titleFromPrompt = (prompt: string) => {
  const clean = cleanText(prompt)
    .replace(/\b(builder task|research task|email task|writing task|code task|automation task|notes task|memory task|task chat|workflow task|new task)\b[:\s-]*/i, "")
    .slice(0, 72)
    .trim();
  return clean;
};

const normalizeTaskSession = (session: Partial<SpinoTaskSession>): SpinoTaskSession | null => {
  if (!session.id || !session.title) return null;
  const rawMode = (session.mode || session.agentId || "builder") as SpinoTaskMode;
  const mode: SpinoTaskMode = rawMode === "general" ? "builder" : rawMode;
  const profile = getSpinoTaskAgentProfile(mode);
  return {
    id: session.id,
    title: session.title,
    mode,
    agentId: session.agentId || mode,
    agentColor: session.agentColor || profile?.color,
    agentLabel: session.agentLabel || profile?.label,
    objective: session.objective || "",
    createdAt: session.createdAt || nowIso(),
    updatedAt: session.updatedAt || nowIso(),
    turns: Array.isArray(session.turns) ? session.turns : [],
    attachments: Array.isArray(session.attachments) ? session.attachments : [],
    pinnedPoints: Array.isArray(session.pinnedPoints) ? session.pinnedPoints : [],
  };
};

export const loadSpinoTaskSessions = (): SpinoTaskSession[] => {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((session) => normalizeTaskSession(session)).filter(Boolean) as SpinoTaskSession[];
  } catch {
    return [];
  }
};

export const saveSpinoTaskSessions = (sessions: SpinoTaskSession[]) => {
  localStorage.setItem(TASKS_KEY, JSON.stringify(sessions));
};

export const getActiveSpinoTaskId = () => localStorage.getItem(ACTIVE_TASK_KEY) || "";

export const setActiveSpinoTaskId = (taskId: string) => {
  if (taskId) localStorage.setItem(ACTIVE_TASK_KEY, taskId);
  else localStorage.removeItem(ACTIVE_TASK_KEY);
};

export const createSpinoTaskSession = (titleSeed = "", mode: SpinoTaskMode = "builder"): SpinoTaskSession => {
  const profile = getSpinoTaskAgentProfile(mode) || SPINO_TASK_AGENT_PROFILES[0];
  const title = titleFromPrompt(titleSeed) || `${profile.shortLabel} ${new Date().toISOString().slice(0, 10)}`;
  return {
    id: uid("sptask"),
    title,
    mode: profile.id,
    agentId: profile.id,
    agentColor: profile.color,
    agentLabel: profile.label,
    objective: cleanText(titleSeed).slice(0, 360),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    turns: [],
    attachments: [],
    pinnedPoints: [],
  };
};

export const upsertSpinoTaskSession = (sessions: SpinoTaskSession[], session: SpinoTaskSession) => {
  const next = sessions.filter((item) => item.id !== session.id);
  next.unshift({ ...session, updatedAt: nowIso() });
  saveSpinoTaskSessions(next);
  return next;
};

export const appendSpinoTaskTurn = (
  sessions: SpinoTaskSession[],
  taskId: string,
  role: SpinoTaskTurn["role"],
  content: string,
) => {
  const clean = cleanText(content);
  if (!taskId || !clean) return sessions;
  const next = sessions.map((session) => {
    if (session.id !== taskId) return session;
    return {
      ...session,
      updatedAt: nowIso(),
      turns: [
        ...session.turns,
        { id: uid("spturn"), role, content: clean, createdAt: nowIso() },
      ].slice(-MAX_TURNS_PER_TASK),
    };
  });
  saveSpinoTaskSessions(next);
  return next;
};

const readFileExcerpt = async (file: File) => {
  const mime = file.type || "";
  const ext = getFileExtension(file.name);
  const readable =
    mime.startsWith("text/") ||
    ["md", "markdown", "txt", "json", "csv", "html", "css", "ts", "tsx", "js", "jsx", "py", "yaml", "yml"].includes(ext);
  if (!readable) return `[${file.name}] binary or rich document attached. Use Reader extraction for full preview.`;
  const blob = file.size > MAX_ATTACHMENT_EXCERPT ? file.slice(0, MAX_ATTACHMENT_EXCERPT) : file;
  return cleanText(await blob.text()).slice(0, MAX_ATTACHMENT_EXCERPT);
};

export const addSpinoTaskAttachments = async (
  sessions: SpinoTaskSession[],
  taskId: string,
  files: File[],
) => {
  if (!taskId || files.length === 0) return { sessions, added: 0 };
  const attachments = await Promise.all(files.map(async (file) => ({
    id: uid("spattach"),
    name: file.name,
    path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
    type: file.type || getFileExtension(file.name) || "file",
    size: file.size,
    addedAt: nowIso(),
    excerpt: await readFileExcerpt(file),
  })));
  const next = sessions.map((session) => {
    if (session.id !== taskId) return session;
    return {
      ...session,
      updatedAt: nowIso(),
      attachments: [...attachments, ...session.attachments].slice(0, 80),
    };
  });
  saveSpinoTaskSessions(next);
  return { sessions: next, added: attachments.length };
};

const inferBoxType = (text: string): BoxType => {
  const lower = text.toLowerCase();
  if (/\b(auth|login|permission|security|encrypt|password|token)\b/.test(lower)) return "authSecurity";
  if (/\b(api|endpoint|route|request|webhook|server)\b/.test(lower)) return "apiRoute";
  if (/\b(database|db|storage|schema|table|vector|memory)\b/.test(lower)) return "database";
  if (/\b(agent|llm|prompt|model|reasoning|automation)\b/.test(lower)) return "aiAgentTask";
  if (/\b(ui|screen|page|view|mobile|component|layout)\b/.test(lower)) return "appScreen";
  if (/\b(test|qa|verify|validation|acceptance)\b/.test(lower)) return "testing";
  if (/\b(deploy|install|release|apk|build)\b/.test(lower)) return "deployment";
  if (/\b(style|brand|theme|design)\b/.test(lower)) return "designSystem";
  if (/\b(doc|readme|manual|guide)\b/.test(lower)) return "documentation";
  return "custom";
};

const extractCandidateLines = (session: SpinoTaskSession) => {
  const taskText = session.turns
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.content)
    .join("\n");
  const attachmentText = session.attachments.map((file) => `${file.path}\n${file.excerpt}`).join("\n");
  const merged = cleanText(`${taskText}\n${attachmentText}`);
  const rawLines = merged
    .split(/\n|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((line) => line.replace(/^[-*#\d.)\s]+/, "").trim())
    .filter((line) => line.length > 18 && line.length < 360);
  const strong = rawLines.filter((line) =>
    /\b(add|build|create|make|need|must|should|fix|connect|save|open|read|index|agent|app|page|workflow|model|archive|builder|reader|calendar|notes|research)\b/i.test(line),
  );
  const unique = Array.from(new Set(strong.length ? strong : rawLines));
  return unique.slice(0, 14);
};

const makeBox = (line: string, order: number, session: SpinoTaskSession): ArchitectureBox => {
  const type = inferBoxType(line);
  const title = line
    .replace(/\b(i need|we need|make sure|should be able of|should be able to|please)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 56) || `Build Step ${order}`;
  const x = 110 + ((order - 1) % 2) * 270;
  const y = 110 + Math.floor((order - 1) / 2) * 165;
  return {
    id: `spino_task_${order}_${Math.random().toString(36).slice(2, 8)}`,
    buildOrder: order,
    title: `${order}. ${title}`,
    type,
    objective: line,
    agentPrompt: [
      `You are implementing step ${order} for ${session.title}.`,
      `Goal: ${line}`,
      "Use attached task-chat context and instruction files first.",
      "Return clean, file-divided implementation notes and code-ready instructions.",
    ].join("\n"),
    implementationInstructions: [
      "Translate the task-chat requirement into production architecture.",
      "Identify files/modules, data contracts, UI states, and permission gates.",
      "Keep changes scoped and verify with a phone-first preview.",
    ].join("\n"),
    dependencies: order === 1 ? "Task brief, uploaded instruction files, current PocketFlow codebase" : `Step ${order - 1}`,
    deliverables: "Builder-ready implementation notes, code file map, verification checklist",
    acceptanceCriteria: "Requirement is visible in PocketFlow, works on phone preview, and is saved in Archive/Builder package.",
    assets: session.attachments.map((file) => file.path).join(", ") || "Baloss LLM task chat transcript",
    notes: `Compiled from ${session.turns.length} task chat turns and ${session.attachments.length} attached file(s).`,
    position: { x, y, width: 220, height: 130, rotation: 0 },
  };
};

const buildMarkdown = (session: SpinoTaskSession, project: BuilderProject) => [
  `# ${project.projectName}`,
  "",
  project.description,
  "",
  `Compiled: ${new Date(project.createdAt).toLocaleString()}`,
  `Task chat: ${session.title}`,
  "",
  "## Operating Method",
  "",
  "1. Keep the task chat as the source of intent.",
  "2. Use attached files as architecture/instruction corpus.",
  "3. Build in numeric order.",
  "4. Each box should produce clean file-divided instructions for the coding agent or third-party builder.",
  "5. Save finished outputs into Archive and keep the Builder project updated.",
  "",
  "## Attachments",
  "",
  ...(session.attachments.length
    ? session.attachments.map((file) => `- ${file.path} (${file.type}, ${file.size} bytes)`)
    : ["- No files attached."]),
  "",
  "## Build Order",
  "",
  ...project.boxes.map((box) => [
    `### ${box.buildOrder}. ${box.title.replace(/^\d+\.\s*/, "")}`,
    "",
    `Type: ${box.type}`,
    "",
    `Objective: ${box.objective}`,
    "",
    "Agent prompt:",
    "```text",
    box.agentPrompt,
    "```",
    "",
    `Dependencies: ${box.dependencies}`,
    `Deliverables: ${box.deliverables}`,
    `Acceptance: ${box.acceptanceCriteria}`,
    "",
  ].join("\n")),
  "## Task Chat Transcript",
  "",
  ...session.turns.map((turn) => `**${turn.role.toUpperCase()} ${new Date(turn.createdAt).toLocaleTimeString()}**\n\n${turn.content}\n`),
].join("\n");

export const compileSpinoTaskWorkflow = async (session: SpinoTaskSession): Promise<SpinoCompiledWorkflow> => {
  const createdAt = nowIso();
  const date = createdAt.slice(0, 10);
  const projectName = `${session.title} - ${date}`;
  const lines = extractCandidateLines(session);
  const boxes = (lines.length ? lines : [
    "Define the target system and core user workflow.",
    "Map required screens, data models, agents, integrations, and permissions.",
    "Create build order, acceptance tests, and archive handoff package.",
  ]).map((line, index) => makeBox(line, index + 1, session));
  const connections: BoxConnection[] = boxes.slice(1).map((box, index) => ({
    id: `conn_${boxes[index].id}_${box.id}`,
    fromId: boxes[index].id,
    toId: box.id,
  }));
  const project: BuilderProject = {
    id: uid("spbuilder"),
    projectName,
    description: `Compiled by Baloss LLM from dedicated task chat "${session.title}". Includes ${session.turns.length} turns and ${session.attachments.length} attachment(s).`,
    boxes,
    connections,
    createdAt,
    updatedAt: createdAt,
  };
  const markdown = buildMarkdown(session, project);
  const json = JSON.stringify({ project, taskSession: session }, null, 2);
  saveBuilderProject(project);

  const safeBase = sanitizeFileName(projectName.toLowerCase()).replace(/_+/g, "_");
  const blob = new Blob([markdown, "\n\n---\n\n## Builder JSON\n\n```json\n", json, "\n```\n"], {
    type: "text/markdown;charset=utf-8",
  });
  const archiveFile: ReceivedFile = {
    id: uid("spworkflow"),
    name: `${safeBase}.md`,
    safeName: `${safeBase}.md`,
    extension: "md",
    mimeType: "text/markdown",
    category: "builderPackage",
    size: blob.size,
    source: "filePicker",
    sourceDeviceName: "Baloss LLM Task Chat",
    status: "accepted",
    suggestedDestination: "pocketFlowBuilder",
    folderPath: "/projects",
    receivedAt: createdAt,
    acceptedAt: createdAt,
    metadata: {
      builderProjectName: project.projectName,
      builderBoxCount: project.boxes.length,
      markdownTitle: project.projectName,
      contentPreview: markdown.slice(0, 3000),
      parsedJson: { projectId: project.id, taskId: session.id },
    },
    auditLog: [
      { type: "file.accepted", at: createdAt, detail: "Compiled from Baloss LLM dedicated task chat." },
      { type: "file.imported", at: createdAt, detail: "Saved as Builder workflow package." },
    ],
  };
  await saveFileMetadata(archiveFile);
  await saveFileBlob(archiveFile.id, blob);
  return { project, markdown, json, archiveFile };
};

export const isBuilderTaskCommand = (prompt: string) =>
  /\b(builder task|task chat|workflow task|start builder|new builder task)\b/i.test(prompt);

export const isSpinoTaskChatCommand = (prompt: string) =>
  /\b(builder task|research task|email task|writing task|code task|automation task|notes task|memory task|task chat|new task|start task)\b/i.test(prompt);

export const inferSpinoTaskModeFromPrompt = (prompt: string): SpinoTaskMode => {
  const lower = prompt.toLowerCase();
  if (/\b(email|mail|message|reply|write to|scrivi)\b/.test(lower)) return "email";
  if (/\b(research|search|news|sources|compare|analys|ricerca)\b/.test(lower)) return "research";
  if (/\b(code|repo|component|function|api|typescript|react|bug|fix)\b/.test(lower)) return "code";
  if (/\b(automat|workflow|run task|operator|agent action)\b/.test(lower)) return "automation";
  if (/\b(notes task|take notes|summary|summarize)\b/.test(lower)) return "notes";
  if (/\b(note|memo|remember|memory|learn|contact|phone|email address)\b/.test(lower)) return "personal";
  return "builder";
};

export const isWorkflowBuildCommand = (prompt: string) =>
  /\b(build entire workflow|compile workflow|build workflow|generate workflow|create workflow package|save workflow)\b/i.test(prompt);
