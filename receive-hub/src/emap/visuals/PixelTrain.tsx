import React from "react";
import { emapTokens } from "../tokens";
import type { EMapPayloadType, EMapTrainStatus, EMapTrainType } from "../types";

interface PixelTrainProps {
  trainType: EMapTrainType;
  status?: EMapTrainStatus;
  payloadType?: EMapPayloadType;
  scale?: number;
}

const trainColor: Record<EMapTrainType, string> = {
  steam: "#FF8A3D",
  shinkansen: "#38BDF8",
  cargo: "#22C55E",
};

const payloadLabel: Record<EMapPayloadType, string> = {
  task: "T",
  model_call: "M",
  tool_call: "W",
  memory: "R",
  file: "F",
  monitoring: "S",
  backup: "B",
  security: "P",
};

export function PixelTrain({ trainType, status = "moving", payloadType, scale = 1 }: PixelTrainProps) {
  const color =
    status === "error" || status === "blocked"
      ? emapTokens.status.error
      : status === "delayed"
        ? "#F59E0B"
        : status === "standby" || status === "idle" || status === "offline" || status === "waiting_planning"
          ? "#0F172A"
          : trainColor[trainType];
  const dark = status === "standby" || status === "idle" || status === "offline" || status === "waiting_planning" ? "#F8FAFC" : "#05070A";
  return (
    <g transform={`scale(${scale})`} className={status === "monitoring" ? "animate-pulse" : undefined}>
      {trainType === "steam" && (
        <>
          <rect x="-14" y="-6" width="19" height="10" fill={color} stroke={dark} strokeWidth="1.5" shapeRendering="crispEdges" />
          <rect x="1" y="-10" width="7" height="14" fill={color} stroke={dark} strokeWidth="1.5" shapeRendering="crispEdges" />
          <rect x="-10" y="-11" width="4" height="5" fill="#FACC15" shapeRendering="crispEdges" />
          <circle cx="-8" cy="6" r="3" fill={dark} stroke={color} strokeWidth="1.3" />
          <circle cx="3" cy="6" r="3" fill={dark} stroke={color} strokeWidth="1.3" />
        </>
      )}
      {trainType === "shinkansen" && (
        <>
          <path d="M-17 -6H8L17 0 8 6h-25z" fill={color} stroke={dark} strokeWidth="1.5" shapeRendering="crispEdges" />
          <rect x="-10" y="-3" width="13" height="2" fill="#E0F2FE" shapeRendering="crispEdges" />
          <rect x="6" y="-2" width="5" height="2" fill="#E0F2FE" shapeRendering="crispEdges" />
        </>
      )}
      {trainType === "cargo" && (
        <>
          <rect x="-17" y="-6" width="9" height="11" fill={color} stroke={dark} strokeWidth="1.5" shapeRendering="crispEdges" />
          <rect x="-6" y="-6" width="9" height="11" fill="#A3E635" stroke={dark} strokeWidth="1.5" shapeRendering="crispEdges" />
          <rect x="5" y="-6" width="9" height="11" fill={color} stroke={dark} strokeWidth="1.5" shapeRendering="crispEdges" />
          <circle cx="-12" cy="7" r="2.5" fill={dark} stroke={color} strokeWidth="1" />
          <circle cx="9" cy="7" r="2.5" fill={dark} stroke={color} strokeWidth="1" />
        </>
      )}
      {payloadType && (
        <g transform="translate(0 -15)">
          <rect x="-6" y="-5" width="12" height="10" rx="2" fill="#05070A" stroke={color} strokeWidth="1.2" />
          <text x="0" y="3" textAnchor="middle" fill="#F8FAFC" fontFamily="monospace" fontSize="7" fontWeight="900">
            {payloadLabel[payloadType]}
          </text>
        </g>
      )}
      {(status === "blocked" || status === "error") && (
        <text x="19" y="4" fill={emapTokens.status.error} fontFamily="monospace" fontSize="12" fontWeight="900">!</text>
      )}
      {(status === "waiting_planning" || status === "delayed") && (
        <text x="19" y="4" fill={status === "delayed" ? "#F59E0B" : "#94A3B8"} fontFamily="monospace" fontSize="12" fontWeight="900">?</text>
      )}
    </g>
  );
}
