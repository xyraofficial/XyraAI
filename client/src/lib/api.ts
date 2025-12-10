// API helper functions for the IDE

export interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  path: string;
  extension?: string;
  children?: FileNode[];
}

export interface ApiResponse<T> {
  success?: boolean;
  error?: string;
  data?: T;
}

// File System API
export async function getFileTree(): Promise<{ files: FileNode[]; workspaceDir: string }> {
  const res = await fetch("/api/files");
  if (!res.ok) throw new Error("Failed to fetch files");
  return res.json();
}

export async function readFile(filePath: string): Promise<{ content: string; path: string }> {
  const res = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to read file");
  }
  return res.json();
}

export async function writeFile(filePath: string, content: string, createOnly?: boolean): Promise<void> {
  const res = await fetch("/api/files/write", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: filePath, content, createOnly }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to write file");
  }
}

export async function createFolder(folderPath: string, createOnly?: boolean): Promise<void> {
  const res = await fetch("/api/files/mkdir", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: folderPath, createOnly }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to create folder");
  }
}

export async function deleteFile(filePath: string): Promise<void> {
  const res = await fetch(`/api/files?path=${encodeURIComponent(filePath)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to delete");
  }
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  const res = await fetch("/api/files/rename", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ oldPath, newPath }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to rename");
  }
}

// Terminal API
export interface TerminalResult {
  success: boolean;
  stdout: string;
  stderr: string;
  code?: number;
}

export async function executeCommand(
  command: string, 
  cwd?: string, 
  env?: Record<string, string>
): Promise<TerminalResult> {
  const res = await fetch("/api/terminal/exec", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, cwd, env }),
  });
  return res.json();
}

// AI Chat API
export interface ToolCall {
  tool: string;
  args: Record<string, any>;
}

export interface ToolResult {
  tool: string;
  success: boolean;
  result?: any;
  error?: string;
}

export interface ChatContext {
  currentFile?: {
    path: string;
    content: string;
  };
  fileList?: string[];
}

export interface ChatResponse {
  response: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  rawResponse?: string;
  error?: string;
}

export async function sendChatMessage(message: string, model?: string, context?: ChatContext): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, model, context }),
  });
  const data = await res.json();
  if (data.error && !data.response) {
    throw new Error(data.error);
  }
  return data;
}

// Status API
export async function getApiStatus(): Promise<{ aiConfigured: boolean; workspaceDir: string }> {
  const res = await fetch("/api/status");
  return res.json();
}
