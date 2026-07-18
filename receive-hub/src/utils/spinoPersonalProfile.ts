import { upsertLearnedMemory } from "./lifeMemory";

export interface SpinoBusinessProfile {
  id: string;
  name: string;
  link: string;
  role: string;
  description: string;
}

export interface SpinoProfileLink {
  id: string;
  label: string;
  url: string;
  description: string;
}

export interface SpinoPersonalProfile {
  displayName: string;
  age: string;
  constitution: string;
  character: string;
  likes: string;
  dislikes: string;
  hobbies: string;
  knowledge: string;
  workStyle: string;
  communicationStyle: string;
  businesses: SpinoBusinessProfile[];
  links: SpinoProfileLink[];
  freeform: string;
  updatedAt: string;
}

const PROFILE_KEY = "pocketflow.spino.me.profile.v1";

const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const emptySpinoBusinessProfile = (): SpinoBusinessProfile => ({
  id: newId("biz"),
  name: "",
  link: "",
  role: "",
  description: "",
});

export const emptySpinoProfileLink = (): SpinoProfileLink => ({
  id: newId("link"),
  label: "",
  url: "",
  description: "",
});

export const emptySpinoPersonalProfile = (): SpinoPersonalProfile => ({
  displayName: "",
  age: "",
  constitution: "",
  character: "",
  likes: "",
  dislikes: "",
  hobbies: "",
  knowledge: "",
  workStyle: "",
  communicationStyle: "",
  businesses: [],
  links: [],
  freeform: "",
  updatedAt: "",
});

const ensureProfileShape = (value: Partial<SpinoPersonalProfile> | null): SpinoPersonalProfile => {
  const fallback = emptySpinoPersonalProfile();
  if (!value || typeof value !== "object") return fallback;
  return {
    ...fallback,
    ...value,
    businesses: Array.isArray(value.businesses) ? value.businesses : [],
    links: Array.isArray(value.links) ? value.links : [],
  };
};

export const loadSpinoPersonalProfile = (): SpinoPersonalProfile => {
  try {
    return ensureProfileShape(JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"));
  } catch {
    return emptySpinoPersonalProfile();
  }
};

export const saveSpinoPersonalProfile = (profile: SpinoPersonalProfile) => {
  const next = {
    ...profile,
    businesses: profile.businesses.filter((business) =>
      [business.name, business.link, business.role, business.description].some((part) => part.trim()),
    ),
    links: profile.links.filter((link) => [link.label, link.url, link.description].some((part) => part.trim())),
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("pocketflow:spino-profile-updated", { detail: next }));
  return next;
};

const compact = (value: string, max = 900) => {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max).trim()}...` : text;
};

export const summarizeSpinoPersonalProfile = (profile = loadSpinoPersonalProfile()) => {
  const parts = [
    profile.displayName ? `Name: ${profile.displayName}` : "",
    profile.age ? `Age: ${profile.age}` : "",
    profile.constitution ? `Constitution/body notes: ${profile.constitution}` : "",
    profile.character ? `Character: ${profile.character}` : "",
    profile.likes ? `Likes: ${profile.likes}` : "",
    profile.hobbies ? `Hobbies: ${profile.hobbies}` : "",
    profile.knowledge ? `Knowledge: ${profile.knowledge}` : "",
    profile.workStyle ? `Work style: ${profile.workStyle}` : "",
    profile.communicationStyle ? `Communication style: ${profile.communicationStyle}` : "",
    profile.businesses.length
      ? `Businesses: ${profile.businesses
          .map((business) => `${business.name || "Unnamed"}${business.role ? ` (${business.role})` : ""}${business.link ? ` ${business.link}` : ""}`)
          .join("; ")}`
      : "",
  ].filter(Boolean);
  return parts.join("\n");
};

export const buildSpinoPersonalProfileContext = (profile = loadSpinoPersonalProfile()) => {
  const summary = summarizeSpinoPersonalProfile(profile);
  const businessLines = profile.businesses
    .filter((business) => [business.name, business.link, business.role, business.description].some((part) => part.trim()))
    .map(
      (business, index) =>
        `[B${index + 1}] ${business.name || "Unnamed business"}\nRole: ${business.role || "not set"}\nLink: ${business.link || "not set"}\nDescription: ${compact(business.description, 600)}`,
    )
    .join("\n\n");
  const linkLines = profile.links
    .filter((link) => [link.label, link.url, link.description].some((part) => part.trim()))
    .map((link, index) => `[L${index + 1}] ${link.label || "Link"}: ${link.url || "no url"}${link.description ? ` — ${compact(link.description, 280)}` : ""}`)
    .join("\n");
  const freeform = compact(profile.freeform, 4500);
  const sections = [
    summary,
    businessLines ? `Business context:\n${businessLines}` : "",
    linkLines ? `Important links:\n${linkLines}` : "",
    freeform ? `Personal document:\n${freeform}` : "",
  ].filter(Boolean);
  if (!sections.length) return "";
  return [
    "BALOSS LLM USER PROFILE",
    "Use this as stable local context about User. Adapt tone and suggestions to it. Do not expose private details unless asked.",
    ...sections,
  ].join("\n\n");
};

export const saveSpinoProfileAsLearnedMemory = (profile: SpinoPersonalProfile) => {
  const summary = summarizeSpinoPersonalProfile(profile) || compact(profile.freeform, 900);
  if (!summary) return null;
  return upsertLearnedMemory({
    kind: "profile",
    label: "User personal profile",
    value: summary,
    raw: buildSpinoPersonalProfileContext(profile),
    tags: ["spino", "me", "profile", "personal"],
    source: "manual",
  });
};
