import React from "react";
import { emapTokens } from "../tokens";
import { getEMapAvatarDefinition } from "./avatarDefinitions";
import type { EMapAvatarAnimationState } from "../types";

interface PixelAvatarProps {
  avatarId?: string;
  state?: EMapAvatarAnimationState;
  size?: number;
  label?: string;
}

const colorForAvatar = (avatarId?: string) => {
  const avatar = getEMapAvatarDefinition(avatarId);
  const token = avatar.colorToken || "unknown";
  return emapTokens.lines[token as keyof typeof emapTokens.lines] || emapTokens.lines.unknown;
};

export function PixelAvatar({ avatarId, state = "idle", size = 22, label }: PixelAvatarProps) {
  const avatar = getEMapAvatarDefinition(avatarId);
  const color = colorForAvatar(avatarId);
  const warning = state === "error" || state === "offline";
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" role="img" aria-label={label || avatar.name} className={state === "scanning" ? "animate-pulse" : undefined}>
      <rect x="3" y="5" width="16" height="13" rx="2" fill="#05070A" stroke={warning ? emapTokens.status.error : color} strokeWidth="2" shapeRendering="crispEdges" />
      <rect x="6" y="2" width="10" height="5" rx="1" fill={warning ? emapTokens.status.error : color} shapeRendering="crispEdges" />
      <rect x="7" y="10" width="3" height="3" fill={color} shapeRendering="crispEdges" />
      <rect x="13" y="10" width="3" height="3" fill={color} shapeRendering="crispEdges" />
      {avatarId === "avatar-builder" && <path d="M5 6h12v2H5z" fill="#FACC15" shapeRendering="crispEdges" />}
      {avatarId === "avatar-fixer" && <path d="M15 3h3v3h-2v10h-2V6h1z" fill="#FF8A3D" shapeRendering="crispEdges" />}
      {avatarId === "avatar-monitor" && <circle cx="11" cy="11" r="7" fill="none" stroke="#A78BFA" strokeWidth="1" strokeDasharray="2 2" />}
      {avatarId === "avatar-transport" && (
        <path d="M5 12h12M6 15h10M7 8h8l2 4H5zM8 17h1M13 17h1" fill="none" stroke="#14B8A6" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {avatarId === "avatar-learning" && (
        <path d="M6 8c2-3 8-3 10 0v8H6zM8 10h6M8 13h4M15 5l2-2M7 5L5 3" fill="none" stroke="#22C55E" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {avatarId === "avatar-style-teacher" && (
        <path d="M6 15c3-6 7-7 10-7M7 16h8M14 6l3 3-2 2-3-3z" fill="none" stroke="#A3E635" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {avatarId === "avatar-preference-teacher" && (
        <path d="M6 8h10M6 12h10M6 16h10M8 8v8M14 8v8M8 8l3 4 3-4" fill="none" stroke="#84CC16" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {avatarId === "avatar-yard" && (
        <path d="M5 15h12M6 11h10M7 7h8M7 7v8M15 7v8M9 5h4" fill="none" stroke="#64748B" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {avatarId === "avatar-news" && <path d="M5 7h12v10H5zM7 9h4v2H7zm0 4h8v1H7zm0 2h8v1H7z" fill="none" stroke="#F472B6" strokeWidth="1.2" shapeRendering="crispEdges" />}
      {avatarId === "avatar-newsletter" && <path d="M5 8l6 5 6-5v9H5z" fill="none" stroke="#F472B6" strokeWidth="1.3" shapeRendering="crispEdges" />}
      {avatarId === "avatar-moltbook" && <path d="M6 6h10v11H6zM8 8h6v1H8zm0 3h6v1H8z" fill="none" stroke="#FB923C" strokeWidth="1.3" shapeRendering="crispEdges" />}
      {avatarId === "avatar-crm" && <path d="M6 7h10v9H6zM8 9h6v1H8zm0 3h4v1H8z" fill="none" stroke="#38BDF8" strokeWidth="1.2" shapeRendering="crispEdges" />}
      {avatarId === "avatar-relay" && <path d="M5 12h12M8 8l-3 4 3 4M14 8l3 4-3 4" fill="none" stroke="#A3E635" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
      {avatarId === "avatar-radar" && <path d="M11 4v14M4 11h14M7 7l8 8M15 7l-8 8" fill="none" stroke="#7C3AED" strokeWidth="1.2" strokeLinecap="round" />}
      {avatarId === "avatar-payments" && <path d="M11 5v12M8 8c0-2 6-2 6 0 0 3-6 1-6 4 0 2 6 2 6 0" fill="none" stroke="#EF4444" strokeWidth="1.4" strokeLinecap="round" />}
      {avatarId === "avatar-model-runner" && <path d="M7 16h8v2H7zm2-12h4v2H9z" fill="#38BDF8" shapeRendering="crispEdges" />}
      {avatarId === "avatar-security" && <path d="M11 4l6 2v5c0 4-3 6-6 7-3-1-6-3-6-7V6z" fill="none" stroke="#EF4444" strokeWidth="1.5" />}
      {avatarId === "avatar-malware" && <path d="M11 4l6 2v5c0 4-3 6-6 7-3-1-6-3-6-7V6zM8 9h6M8 12h6M10 7v8" fill="none" stroke="#FB7185" strokeWidth="1.25" strokeLinecap="round" />}
      <text x="11" y="16.2" textAnchor="middle" fontFamily="monospace" fontSize={avatar.emojiFallback.length > 1 ? "4.7" : "6"} fontWeight="900" fill="#F8FAFC">
        {avatar.emojiFallback}
      </text>
    </svg>
  );
}
