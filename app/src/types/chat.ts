// Chat-related TypeScript types

import type { Script } from "./script";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  script?: Script;
  metadata?: {
    messageType?: "analysis" | "transformation" | "error" | "progress";
    data?: any;
  };
}

export interface ChatHistory {
  csvPath: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionContext {
  csvPath?: string;
  headers: string[];
  rowCount: number;
  selectedRange?: {
    startRow: number;
    endRow: number;
    startColumn: number;
    endColumn: number;
  };
  filterState?: any;
  sortState?: any;
}
