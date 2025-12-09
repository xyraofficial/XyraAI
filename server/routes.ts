import type { Express } from "express";
import { createServer, type Server } from "http";
import { spawn, exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import OpenAI from "openai";

const execPromise = promisify(exec);

// Workspace directory for user files
const WORKSPACE_DIR = path.join(process.cwd(), "workspace");

// Ensure workspace directory exists
if (!fs.existsSync(WORKSPACE_DIR)) {
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
}

// Groq API configuration (OpenAI-compatible)
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const ai = GROQ_API_KEY ? new OpenAI({
  apiKey: GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
}) : null;

interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  path: string;
  extension?: string;
  children?: FileNode[];
}

function getFileExtension(filename: string): string | undefined {
  const ext = filename.split(".").pop();
  return ext !== filename ? ext : undefined;
}

function buildFileTree(dirPath: string, basePath: string = ""): FileNode[] {
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  const result: FileNode[] = [];

  for (const item of items) {
    // Skip hidden files and node_modules
    if (item.name.startsWith(".") || item.name === "node_modules") continue;

    const fullPath = path.join(dirPath, item.name);
    const relativePath = path.join(basePath, item.name);
    const id = Buffer.from(relativePath).toString("base64");

    if (item.isDirectory()) {
      result.push({
        id,
        name: item.name,
        type: "folder",
        path: relativePath,
        children: buildFileTree(fullPath, relativePath),
      });
    } else {
      result.push({
        id,
        name: item.name,
        type: "file",
        path: relativePath,
        extension: getFileExtension(item.name),
      });
    }
  }

  // Sort: folders first, then files
  return result.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "folder" ? -1 : 1;
  });
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ============ FILE SYSTEM API ============

  // Get file tree
  app.get("/api/files", (req, res) => {
    try {
      const tree = buildFileTree(WORKSPACE_DIR);
      res.json({ files: tree, workspaceDir: WORKSPACE_DIR });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Read file content
  app.get("/api/files/read", (req, res) => {
    try {
      const filePath = req.query.path as string;
      if (!filePath) {
        return res.status(400).json({ error: "Path is required" });
      }

      const fullPath = path.join(WORKSPACE_DIR, filePath);
      
      // Security: ensure path is within workspace
      if (!fullPath.startsWith(WORKSPACE_DIR)) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "File not found" });
      }

      const content = fs.readFileSync(fullPath, "utf-8");
      res.json({ content, path: filePath });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Write/Create file
  app.post("/api/files/write", (req, res) => {
    try {
      const { path: filePath, content } = req.body;
      if (!filePath) {
        return res.status(400).json({ error: "Path is required" });
      }

      const fullPath = path.join(WORKSPACE_DIR, filePath);
      
      // Security: ensure path is within workspace
      if (!fullPath.startsWith(WORKSPACE_DIR)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Ensure directory exists
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, content || "");
      res.json({ success: true, path: filePath });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create folder
  app.post("/api/files/mkdir", (req, res) => {
    try {
      const { path: folderPath } = req.body;
      if (!folderPath) {
        return res.status(400).json({ error: "Path is required" });
      }

      const fullPath = path.join(WORKSPACE_DIR, folderPath);
      
      if (!fullPath.startsWith(WORKSPACE_DIR)) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }

      res.json({ success: true, path: folderPath });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete file or folder
  app.delete("/api/files", (req, res) => {
    try {
      const filePath = req.query.path as string;
      if (!filePath) {
        return res.status(400).json({ error: "Path is required" });
      }

      const fullPath = path.join(WORKSPACE_DIR, filePath);
      
      if (!fullPath.startsWith(WORKSPACE_DIR)) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: "File not found" });
      }

      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        fs.rmSync(fullPath, { recursive: true });
      } else {
        fs.unlinkSync(fullPath);
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Rename file or folder
  app.post("/api/files/rename", (req, res) => {
    try {
      const { oldPath, newPath } = req.body;
      if (!oldPath || !newPath) {
        return res.status(400).json({ error: "Old and new paths are required" });
      }

      const fullOldPath = path.join(WORKSPACE_DIR, oldPath);
      const fullNewPath = path.join(WORKSPACE_DIR, newPath);
      
      if (!fullOldPath.startsWith(WORKSPACE_DIR) || !fullNewPath.startsWith(WORKSPACE_DIR)) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!fs.existsSync(fullOldPath)) {
        return res.status(404).json({ error: "File not found" });
      }

      fs.renameSync(fullOldPath, fullNewPath);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TERMINAL API ============

  // Execute command
  app.post("/api/terminal/exec", async (req, res) => {
    try {
      const { command, cwd } = req.body;
      if (!command) {
        return res.status(400).json({ error: "Command is required" });
      }

      const workDir = cwd ? path.join(WORKSPACE_DIR, cwd) : WORKSPACE_DIR;
      
      // Block apt/brew/yum commands with helpful message
      const blockedCommands = ['apt', 'apt-get', 'brew', 'yum', 'dnf', 'pacman', 'apk'];
      const firstWord = command.trim().split(/\s+/)[0];
      if (blockedCommands.includes(firstWord)) {
        return res.json({
          success: false,
          stdout: "",
          stderr: `Tools like apt, brew, and yum are not available in this environment.\nUse pip for Python packages: pip install <package>\nOr ask the developer to add system dependencies.`,
          code: 1,
        });
      }

      // Execute command with timeout
      const { stdout, stderr } = await execPromise(command, {
        cwd: workDir,
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        shell: '/bin/bash',
        env: { 
          ...process.env, 
          HOME: WORKSPACE_DIR,
          PATH: process.env.PATH || '/usr/bin:/bin',
        },
      });

      res.json({
        success: true,
        stdout: stdout || "",
        stderr: stderr || "",
      });
    } catch (error: any) {
      res.json({
        success: false,
        stdout: error.stdout || "",
        stderr: error.stderr || error.message,
        code: error.code,
      });
    }
  });

  // ============ AI AGENT API ============

  // Tool definitions for the AI agent
  interface ToolCall {
    tool: string;
    args: Record<string, any>;
  }

  interface ToolResult {
    tool: string;
    success: boolean;
    result?: any;
    error?: string;
  }

  // Execute a tool and return the result
  async function executeTool(tool: ToolCall): Promise<ToolResult> {
    try {
      switch (tool.tool) {
        case "create_file": {
          const { path: filePath, content } = tool.args;
          const fullPath = path.join(WORKSPACE_DIR, filePath);
          if (!fullPath.startsWith(WORKSPACE_DIR)) {
            return { tool: tool.tool, success: false, error: "Access denied" };
          }
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(fullPath, content || "", "utf-8");
          return { tool: tool.tool, success: true, result: `File created: ${filePath}` };
        }
        
        case "edit_file": {
          const { path: filePath, content } = tool.args;
          const fullPath = path.join(WORKSPACE_DIR, filePath);
          if (!fullPath.startsWith(WORKSPACE_DIR)) {
            return { tool: tool.tool, success: false, error: "Access denied" };
          }
          if (!fs.existsSync(fullPath)) {
            return { tool: tool.tool, success: false, error: "File not found" };
          }
          fs.writeFileSync(fullPath, content, "utf-8");
          return { tool: tool.tool, success: true, result: `File updated: ${filePath}` };
        }
        
        case "read_file": {
          const { path: filePath } = tool.args;
          const fullPath = path.join(WORKSPACE_DIR, filePath);
          if (!fullPath.startsWith(WORKSPACE_DIR)) {
            return { tool: tool.tool, success: false, error: "Access denied" };
          }
          if (!fs.existsSync(fullPath)) {
            return { tool: tool.tool, success: false, error: "File not found" };
          }
          const content = fs.readFileSync(fullPath, "utf-8");
          return { tool: tool.tool, success: true, result: content };
        }
        
        case "delete_file": {
          const { path: filePath } = tool.args;
          const fullPath = path.join(WORKSPACE_DIR, filePath);
          if (!fullPath.startsWith(WORKSPACE_DIR)) {
            return { tool: tool.tool, success: false, error: "Access denied" };
          }
          if (!fs.existsSync(fullPath)) {
            return { tool: tool.tool, success: false, error: "File not found" };
          }
          fs.unlinkSync(fullPath);
          return { tool: tool.tool, success: true, result: `File deleted: ${filePath}` };
        }
        
        case "run_command": {
          const { command } = tool.args;
          
          // Validate command - only allow safe development commands
          const allowedCommands = ['node', 'npm', 'npx', 'python', 'python3', 'pip', 'pip3', 'ls', 'cat', 'echo', 'pwd', 'mkdir', 'touch', 'head', 'tail', 'grep', 'find', 'git'];
          const firstWord = command.trim().split(/\s+/)[0];
          
          // Block dangerous commands
          const blockedPatterns = ['rm -rf', 'sudo', 'chmod', 'chown', 'curl', 'wget', 'ssh', 'scp', '>', '>>', '|', '&&', ';', '`', '$(' ];
          for (const pattern of blockedPatterns) {
            if (command.includes(pattern)) {
              return { tool: tool.tool, success: false, error: `Command contains blocked pattern: ${pattern}` };
            }
          }
          
          if (!allowedCommands.includes(firstWord)) {
            return { tool: tool.tool, success: false, error: `Command '${firstWord}' is not allowed. Allowed: ${allowedCommands.join(', ')}` };
          }
          
          try {
            const { stdout, stderr } = await execPromise(command, {
              cwd: WORKSPACE_DIR,
              timeout: 30000,
              maxBuffer: 1024 * 1024 * 10,
              shell: '/bin/bash',
              env: { PATH: process.env.PATH || '/usr/bin:/bin', HOME: WORKSPACE_DIR },
            });
            return { tool: tool.tool, success: true, result: { stdout: stdout?.slice(0, 5000), stderr: stderr?.slice(0, 1000) } };
          } catch (error: any) {
            return { tool: tool.tool, success: false, error: error.message?.slice(0, 500), result: { stdout: error.stdout?.slice(0, 2000), stderr: error.stderr?.slice(0, 1000) } };
          }
        }
        
        case "list_files": {
          const tree = buildFileTree(WORKSPACE_DIR);
          const flattenTree = (nodes: FileNode[], prefix = ""): string[] => {
            let result: string[] = [];
            for (const node of nodes) {
              result.push(`${prefix}${node.name}${node.type === "folder" ? "/" : ""}`);
              if (node.children) {
                result = result.concat(flattenTree(node.children, prefix + "  "));
              }
            }
            return result;
          };
          return { tool: tool.tool, success: true, result: flattenTree(tree).join("\n") };
        }
        
        default:
          return { tool: tool.tool, success: false, error: `Unknown tool: ${tool.tool}` };
      }
    } catch (error: any) {
      return { tool: tool.tool, success: false, error: error.message };
    }
  }

  // Parse tool calls from AI response
  function parseToolCalls(content: string): { text: string; tools: ToolCall[] } {
    const tools: ToolCall[] = [];
    let text = content;
    
    // Match tool blocks: <tool name="toolname">{"args": "values"}</tool>
    const toolRegex = /<tool\s+name="([^"]+)">([\s\S]*?)<\/tool>/g;
    let match;
    
    while ((match = toolRegex.exec(content)) !== null) {
      try {
        const toolName = match[1];
        const argsJson = match[2].trim();
        const args = JSON.parse(argsJson);
        tools.push({ tool: toolName, args });
        text = text.replace(match[0], "");
      } catch (e) {
        // Invalid JSON, skip this tool call
      }
    }
    
    return { text: text.trim(), tools };
  }

  const AGENT_SYSTEM_PROMPT = `You are DevSpace AI, an intelligent coding assistant. You MUST use tools to help users with file operations and commands.

## CRITICAL: Tool Usage Format

When performing actions, you MUST use this exact XML format:
<tool name="TOOL_NAME">{"key": "value"}</tool>

## Available Tools

1. **create_file** - Create a new file
   <tool name="create_file">{"path": "app.js", "content": "console.log('Hello');"}</tool>

2. **edit_file** - Edit an existing file (replaces entire content)
   <tool name="edit_file">{"path": "app.js", "content": "console.log('Updated!');"}</tool>

3. **read_file** - Read file contents
   <tool name="read_file">{"path": "app.js"}</tool>

4. **delete_file** - Delete a file
   <tool name="delete_file">{"path": "old.js"}</tool>

5. **run_command** - Run terminal command (allowed: node, npm, npx, python, pip, ls, cat, echo, mkdir, git)
   <tool name="run_command">{"command": "npm install express"}</tool>

6. **list_files** - List all files
   <tool name="list_files">{}</tool>

## Rules
1. ALWAYS use tools when user asks to create, edit, fix, or run something
2. Explain briefly what you will do, then use the tool
3. For fixing code: if file content is provided, analyze and use edit_file with the fix
4. JSON in tools must be valid - escape quotes in strings
5. One tool call per action
6. Be concise - don't repeat file contents in your explanation

## Example Response
User: "Create a hello world file"
Response: I'll create a hello.js file for you.

<tool name="create_file">{"path": "hello.js", "content": "console.log('Hello, World!');"}</tool>`;

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, context } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      if (!ai) {
        return res.status(500).json({ 
          error: "Groq API key not configured",
          response: "I'm sorry, but the AI service is not configured yet. Please add your Groq API key to use the AI assistant."
        });
      }

      // Build context string
      let contextInfo = "";
      if (context?.currentFile) {
        contextInfo += `\n\nCurrent open file: ${context.currentFile.path}\n\`\`\`\n${context.currentFile.content}\n\`\`\``;
      }
      if (context?.fileList) {
        contextInfo += `\n\nFiles in workspace:\n${context.fileList.join("\n")}`;
      }

      const userMessage = message + contextInfo;

      // Use Groq API (OpenAI-compatible)
      const response = await ai.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: AGENT_SYSTEM_PROMPT },
          { role: "user", content: userMessage }
        ],
        max_tokens: 2000,
      });

      const aiContent = response.choices[0]?.message?.content || "No response generated";

      // Parse and execute tool calls
      const { text, tools } = parseToolCalls(aiContent);
      const toolResults: ToolResult[] = [];

      for (const tool of tools) {
        const result = await executeTool(tool);
        toolResults.push(result);
      }

      res.json({ 
        response: text,
        toolCalls: tools,
        toolResults: toolResults,
        rawResponse: aiContent
      });
    } catch (error: any) {
      console.error("Chat API error:", error);
      res.status(500).json({ 
        error: error.message,
        response: "Sorry, an unexpected error occurred. Please try again."
      });
    }
  });

  // Check API status
  app.get("/api/status", (req, res) => {
    res.json({
      aiConfigured: !!GROQ_API_KEY,
      workspaceDir: WORKSPACE_DIR,
    });
  });

  // ============ ONLYFANS API ============
  const ONLYFANS_API_KEY = process.env.ONLYFANS_API_KEY || "";

  // Get OnlyFans profile
  app.get("/api/profiles/:username", async (req, res) => {
    try {
      const { username } = req.params;
      
      if (!username) {
        return res.status(400).json({ error: "Username is required" });
      }

      if (!ONLYFANS_API_KEY) {
        return res.status(500).json({ error: "OnlyFans API key not configured" });
      }

      const response = await fetch(`https://app.onlyfansapi.com/api/profiles/${username}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ONLYFANS_API_KEY}`,
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json({ error: data.error || "Failed to fetch profile" });
      }

      res.json(data);
    } catch (error: any) {
      console.error("OnlyFans API error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
