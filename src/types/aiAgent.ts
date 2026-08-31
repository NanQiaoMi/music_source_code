import { Song } from "./song";

export type AgentMessageRole = "system" | "user" | "assistant" | "tool";

export type AgentMessageStatus = "sending" | "streaming" | "done" | "error";

export interface ToolCallFunction {
  name: string;
  arguments: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: ToolCallFunction;
}

export interface ToolParameterSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  description?: string;
  [key: string]: unknown;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: ToolParameterSchema | Record<string, unknown>;
  };
}

export interface SongResult {
  song: Song;
  confidence?: number;
  source: string;
  canPlay: boolean;
  canDownload: boolean;
}

export interface AgentMessage {
  id: string;
  role: AgentMessageRole;
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  songResults?: SongResult[];
  status?: AgentMessageStatus;
  error?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
  songs?: Song[];
}

export type ToolExecutorFn = (
  args: Record<string, unknown>,
  context?: { abortSignal?: AbortSignal }
) => Promise<ToolExecutionResult>;
