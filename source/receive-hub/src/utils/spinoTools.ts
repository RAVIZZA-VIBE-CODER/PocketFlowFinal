import { parseMoltbookInstruction, type MoltbookInstruction } from "./moltbookAgent";

export type PocketFlowAppId =
  | "home"
  | "receive"
  | "builder"
  | "reader"
  | "calendar"
  | "notes"
  | "news"
  | "moltbook"
  | "secondscreen"
  | "relay"
  | "terminal"
  | "www"
  | "pocketweb"
  | "spino"
  | "systemmap"
  | "settings";

export interface PocketFlowAppTool {
  id: PocketFlowAppId;
  label: string;
  aliases: string[];
  summary: string;
  readable: boolean;
  automatable: boolean;
  nativeRequired?: boolean;
}

export type SpinoSystemAction =
  | {
      type: "open_app";
      appId: PocketFlowAppId;
      app: PocketFlowAppTool;
      response: string;
    }
  | {
      type: "list_apps";
      response: string;
    }
  | {
      type: "inspect_system";
      response: string;
    }
  | {
      type: "app_status";
      appId: PocketFlowAppId;
      app: PocketFlowAppTool;
      response: string;
    }
  | {
      type: "app_summary";
      appId: PocketFlowAppId;
      app: PocketFlowAppTool;
      response: string;
    }
  | {
      type: "read_documents";
      appId: "reader" | "receive";
      response: string;
    }
  | {
      type: "moltbook_update";
      instruction: MoltbookInstruction;
      response: string;
    };

export interface SpinoSystemActionResult {
  ok: boolean;
  response: string;
  openedApp?: PocketFlowAppId;
}

export const POCKETFLOW_APP_TOOLS: PocketFlowAppTool[] = [
  {
    id: "systemmap",
    label: "Router / SystemMap",
    aliases: ["system map", "router", "control map", "agent map", "baloss panel", "emap", "e map"],
    summary: "Public Baloss control map for local model, memory, app and automation lanes.",
    readable: true,
    automatable: true,
  },
  {
    id: "spino",
    label: "Baloss LLM",
    aliases: ["baloss", "llm", "assistant", "local model", "chat", "spino"],
    summary: "Local agent chat, memory, voice-aware prompts and public-safe tool routing.",
    readable: true,
    automatable: true,
  },
  {
    id: "builder",
    label: "Builder",
    aliases: ["builder", "build", "blueprint", "nodes", "boxes", "project builder"],
    summary: "Build boxes, blueprint instructions, ordering and package handoff.",
    readable: true,
    automatable: true,
  },
  {
    id: "receive",
    label: "Archive",
    aliases: ["archive", "storage", "files", "folders", "reader", "documents", "docs", "pdf", "file viewer"],
    summary: "Unified file desktop, folder browser, imports, preview, metadata and editable documents.",
    readable: true,
    automatable: true,
  },
  {
    id: "reader",
    label: "Reader",
    aliases: ["reader", "document reader", "read document", "open file", "analyze file", "analyse file"],
    summary: "Document preview and inspection surface inside the Archive system.",
    readable: true,
    automatable: true,
  },
  {
    id: "notes",
    label: "MemoPad",
    aliases: ["notes", "note", "memo", "voice memo", "calendar", "agenda", "shopping list", "tasks"],
    summary: "Notes, dictation, task lists, shopping lists, calendar events and reminders.",
    readable: true,
    automatable: true,
  },
  {
    id: "news",
    label: "NewsFlow",
    aliases: ["news", "newspaper", "headlines", "news flow", "newsletter", "campaign"],
    summary: "Sanitized news and newsletter builder with empty public contact lists and disabled delivery bridge.",
    readable: true,
    automatable: true,
  },
  {
    id: "moltbook",
    label: "Notebook Agent",
    aliases: ["notebook agent", "moltbook", "social agent", "posting agent", "ai posting"],
    summary: "Public template for agent posting plans, queue review and engagement controls without private credentials.",
    readable: true,
    automatable: true,
  },
  {
    id: "relay",
    label: "Codex Relay",
    aliases: ["relay", "codex", "codex relay", "desktop relay", "computer relay"],
    summary: "Local relay handoff interface with user-supplied endpoints and no bundled private server URL.",
    readable: true,
    automatable: true,
    nativeRequired: true,
  },
  {
    id: "secondscreen",
    label: "Screen Relay",
    aliases: ["second screen", "secondary display", "screen relay", "display viewer", "screen share"],
    summary: "Screen relay viewer/controller shell that requires a user-provided host.",
    readable: true,
    automatable: false,
    nativeRequired: true,
  },
  {
    id: "terminal",
    label: "Terminal",
    aliases: ["terminal", "shell", "command line", "cli", "console", "run command"],
    summary: "Mac-style terminal UI with clipboard, history, settings and native bridge hooks.",
    readable: true,
    automatable: true,
    nativeRequired: true,
  },
  {
    id: "pocketweb",
    label: "PocketWeb",
    aliases: ["browser", "web", "pocketweb", "internet", "search", "research", "website"],
    summary: "PocketFlow browser and web search surface.",
    readable: false,
    automatable: true,
  },
  {
    id: "www",
    label: "Web Monitor",
    aliases: ["www", "monitor", "web monitor"],
    summary: "Public-safe web monitor shell with no private endpoints.",
    readable: false,
    automatable: true,
  },
  {
    id: "settings",
    label: "Settings",
    aliases: ["settings", "ai settings", "model settings", "permissions", "system settings"],
    summary: "Local model controls and permission status.",
    readable: true,
    automatable: true,
  },
];

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s./:-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const hasAny = (text: string, words: string[]) => words.some((word) => text.includes(word));

const matchApp = (normalizedPrompt: string) =>
  POCKETFLOW_APP_TOOLS.find((app) => app.aliases.some((alias) => normalizedPrompt.includes(normalizeText(alias))));

const hasStatusIntent = (normalizedPrompt: string) =>
  /\b(status|check|working|works|running|ready|available|installed|online|offline|down|healthy|health|ok|missing|show me)\b/i.test(
    normalizedPrompt,
  );

const hasSummaryIntent = (normalizedPrompt: string) =>
  /\b(what is|what does|where is|where can i find|do i have|show me|tell me about)\b/i.test(normalizedPrompt);

export const describePocketFlowApps = () =>
  POCKETFLOW_APP_TOOLS.map((app) => `${app.label}: ${app.summary}`).join("\n");

export const parseSpinoSystemAction = (prompt: string): SpinoSystemAction | null => {
  const normalized = normalizeText(prompt);
  if (!normalized) return null;

  const moltbookInstruction = parseMoltbookInstruction(prompt);
  if (moltbookInstruction) {
    return {
      type: "moltbook_update",
      instruction: moltbookInstruction,
      response: "Updating Notebook Agent settings from your instruction.",
    };
  }

  if (
    hasAny(normalized, [
      "what apps can you control",
      "what can you control",
      "what can you open",
      "list apps",
      "show apps",
      "available apps",
      "tool list",
      "tools available",
    ])
  ) {
    return {
      type: "list_apps",
      response: `I can control these public PocketFlow apps and surfaces:\n\n${describePocketFlowApps()}`,
    };
  }

  if (hasAny(normalized, ["system status", "what can you access", "permissions status", "access status"])) {
    return {
      type: "inspect_system",
      response:
        "Baloss LLM can route through the public PocketFlow shell: model, memory, Builder, Archive, MemoPad, NewsFlow, Notebook Agent, Relay, Screen Relay, Terminal and Web surfaces. Private phone apps, private servers, contacts, wallet data and live credentials are not included in this public release.",
    };
  }

  if (
    hasAny(normalized, ["read document", "read file", "analyze document", "analyse document", "inspect document", "open document", "open file", "pdf", "docx"]) &&
    !hasAny(normalized, ["browser", "web"])
  ) {
    return {
      type: "read_documents",
      appId: "receive",
      response: "Opening Archive. Pick or open the file there and I can inspect, summarize, edit or route it from the unified Archive reader.",
    };
  }

  const app = matchApp(normalized);
  const isOpenCommand = hasAny(normalized, ["open ", "go to ", "show ", "start ", "launch ", "switch to ", "take me to ", "bring me to "]);
  if (app && isOpenCommand) {
    return {
      type: "open_app",
      appId: app.id,
      app,
      response: `Opening ${app.label}.`,
    };
  }

  if (app && hasStatusIntent(normalized)) {
    return {
      type: "app_status",
      appId: app.id,
      app,
      response: `${app.label} is part of the public PocketFlow release. ${app.summary}`,
    };
  }

  if (app && hasSummaryIntent(normalized)) {
    return {
      type: "app_summary",
      appId: app.id,
      app,
      response: `${app.label}: ${app.summary}`,
    };
  }

  return null;
};
