/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FileCategory, ReceivedFile } from "../types";

export interface DetectionResult {
  category: FileCategory;
  metadata: {
    dashboardTitle?: string;
    dashboardBlockCount?: number;
    builderProjectName?: string;
    builderBoxCount?: number;
    markdownTitle?: string;
    csvColumns?: string[];
    [key: string]: unknown;
  };
}

export function detectFileContent(
  filename: string,
  contentStr: string,
  baseCategory: FileCategory
): DetectionResult {
  const result: DetectionResult = {
    category: baseCategory,
    metadata: {}
  };

  if (!contentStr || contentStr.trim() === "") {
    return result;
  }

  // Handle JSON
  if (filename.endsWith(".json") || baseCategory === "text") {
    try {
      const parsed = JSON.parse(contentStr);
      result.metadata.parsedJson = parsed;

      // Check if it matches Dashboard Schema
      const hasDashboardKey = parsed.dashboard !== undefined;
      const hasBlocks = Array.isArray(parsed.blocks) || Array.isArray(parsed.cards) || Array.isArray(parsed.widgets);
      const isDashboardSpecific = parsed.dashboardId !== undefined || parsed.metrics !== undefined;

      if (hasDashboardKey || (hasBlocks && isDashboardSpecific) || parsed.type === "dashboard") {
        result.category = "dashboard";
        result.metadata.dashboardTitle = 
          parsed.title || 
          parsed.dashboard?.title || 
          parsed.name || 
          "Received Dashboard Design";
        const blocksList = parsed.blocks || parsed.cards || parsed.widgets || parsed.dashboard?.blocks || [];
        result.metadata.dashboardBlockCount = blocksList.length;
        result.metadata.dashboardDetails = parsed.description || "Dashboard Studio JSON Payload";
        return result;
      }

      // Check if it matches PocketFlow Builder Package Schema
      const hasBoxes = Array.isArray(parsed.boxes) || Array.isArray(parsed.architectureBoxes);
      const hasConnections = Array.isArray(parsed.connections);
      const isBuilderSpecific = parsed.projectArchitecture !== undefined || parsed.buildOrder !== undefined || parsed.agentInstructions !== undefined;

      if (isBuilderSpecific || (hasBoxes && hasConnections) || parsed.type === "builder_package") {
        result.category = "builderPackage";
        result.metadata.builderProjectName = 
          parsed.projectName || 
          parsed.projectArchitecture?.name || 
          parsed.name || 
          "Received Builder Architecture";
        const boxesList = parsed.boxes || parsed.architectureBoxes || parsed.projectArchitecture?.boxes || [];
        result.metadata.builderBoxCount = boxesList.length;
        result.metadata.builderDetails = parsed.description || "PocketFlow Builder Node Export";
        return result;
      }
      
      // Generic JSON details
      result.category = "text";
      result.metadata.jsonKeys = Object.keys(parsed).slice(0, 10);
      result.metadata.contentPreview = contentStr.slice(0, 500);
    } catch {
      // JSON failed to parse, leave as text
      result.category = "text";
      result.metadata.contentPreview = contentStr.slice(0, 500);
    }
  }

  // Handle Markdown
  if (filename.endsWith(".md") || filename.endsWith(".markdown") || baseCategory === "markdown") {
    result.category = "markdown";
    
    // Find first Markdown Header
    const headers = contentStr.split("\n").filter(line => line.trim().startsWith("#"));
    if (headers.length > 0) {
      result.metadata.markdownTitle = headers[0].replace(/^#+\s*/, "").trim();
    } else {
      result.metadata.markdownTitle = filename;
    }

    // Try to detect purpose headings
    const lowerContent = contentStr.toLowerCase();
    const hasDashboardKeywords = lowerContent.includes("dashboard") || lowerContent.includes("metric") || lowerContent.includes("chart");
    const hasBuilderKeywords = lowerContent.includes("builder") || lowerContent.includes("architecture") || lowerContent.includes("box connection");

    if (hasDashboardKeywords && filename.toLowerCase().includes("dashboard")) {
      result.category = "dashboard";
    } else if (hasBuilderKeywords && filename.toLowerCase().includes("builder")) {
      result.category = "builderPackage";
    }

    result.metadata.contentPreview = contentStr.slice(0, 800);
  }

  // Handle CSV
  if (filename.endsWith(".csv") || baseCategory === "csv") {
    result.category = "csv";
    const rows = contentStr.split("\n");
    if (rows.length > 0) {
      const headers = rows[0].split(",").map(h => h.trim().replace(/['"]+/g, ""));
      result.metadata.csvColumns = headers;
      result.metadata.csvRowsCount = rows.filter(r => r.trim() !== "").length - 1;
    }
    result.metadata.contentPreview = rows.slice(0, 10).join("\n");
  }

  return result;
}
