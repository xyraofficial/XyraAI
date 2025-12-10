import type { Express } from "express";
import { createServer, type Server } from "http";
import { spawn, exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";
import OpenAI from "openai";
import archiver from "archiver";
import { WebSocketServer, WebSocket } from "ws";
import * as pty from "node-pty";

const execPromise = promisify(exec);

// Store active PTY sessions
const ptyProcesses = new Map<string, pty.IPty>();

// Workspace directory for user files
const WORKSPACE_DIR = path.join(process.cwd(), "workspace");

// Ensure workspace directory exists
if (!fs.existsSync(WORKSPACE_DIR)) {
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
}

// Settings storage for API key configuration
interface AppSettings {
  groqApiKey: string;
}

const SETTINGS_FILE = path.join(process.cwd(), ".devspace-settings.json");

function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (e) {
    console.error("Failed to load settings:", e);
  }
  return { groqApiKey: process.env.GROQ_API_KEY || "" };
}

function saveSettings(settings: AppSettings): void {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
}

let appSettings = loadSettings();

function getAIClient(): OpenAI | null {
  // Try Groq first, then OpenRouter
  const groqKey = appSettings.groqApiKey || process.env.GROQ_API_KEY || "";
  if (groqKey) {
    return new OpenAI({
      apiKey: groqKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  
  // Fallback to OpenRouter
  const openRouterKey = process.env.OPENROUTER_API_KEY || "";
  if (openRouterKey) {
    return new OpenAI({
      apiKey: openRouterKey,
      baseURL: "https://openrouter.ai/api/v1",
    });
  }
  
  return null;
}

function getAIProvider(): "groq" | "openrouter" | null {
  if (appSettings.groqApiKey || process.env.GROQ_API_KEY) return "groq";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  return null;
}

function isAIConfigured(): boolean {
  return !!(appSettings.groqApiKey || process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY);
}

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
      const { path: filePath, content, createOnly } = req.body;
      if (!filePath) {
        return res.status(400).json({ error: "Path is required" });
      }

      const fullPath = path.join(WORKSPACE_DIR, filePath);
      
      // Security: ensure path is within workspace
      if (!fullPath.startsWith(WORKSPACE_DIR)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Check if file exists when createOnly is true
      if (createOnly && fs.existsSync(fullPath)) {
        return res.status(409).json({ error: "File already exists" });
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
      const { path: folderPath, createOnly } = req.body;
      if (!folderPath) {
        return res.status(400).json({ error: "Path is required" });
      }

      const fullPath = path.join(WORKSPACE_DIR, folderPath);
      
      if (!fullPath.startsWith(WORKSPACE_DIR)) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (fs.existsSync(fullPath)) {
        if (createOnly) {
          return res.status(409).json({ error: "Folder already exists" });
        }
        // If not createOnly, just return success for existing folder
        return res.json({ success: true, path: folderPath });
      }

      fs.mkdirSync(fullPath, { recursive: true });
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

  // Download all files as ZIP
  app.get("/api/files/download-all", (req, res) => {
    try {
      if (!fs.existsSync(WORKSPACE_DIR)) {
        return res.status(404).json({ error: "Workspace directory not found" });
      }

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", "attachment; filename=workspace.zip");

      const archive = archiver("zip", {
        zlib: { level: 9 },
      });

      archive.on("error", (err) => {
        console.error("Archive error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: err.message });
        }
        archive.abort();
      });

      archive.on("warning", (err) => {
        console.warn("Archive warning:", err);
      });

      res.on("close", () => {
        console.log("Download complete:", archive.pointer() + " bytes");
      });

      archive.pipe(res);

      // Add workspace directory to archive, excluding .git folder
      archive.glob("**/*", {
        cwd: WORKSPACE_DIR,
        ignore: [".git/**", "node_modules/**"],
        dot: true,
      });

      archive.finalize();
    } catch (error: any) {
      console.error("Download error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      }
    }
  });

  // ============ TERMINAL API ============

  // Execute command
  app.post("/api/terminal/exec", async (req, res) => {
    try {
      const { command, cwd, env: customEnv } = req.body;
      if (!command) {
        return res.status(400).json({ error: "Command is required" });
      }

      const workDir = cwd ? path.join(WORKSPACE_DIR, cwd) : WORKSPACE_DIR;
      
      // Block only truly dangerous system-level commands
      const blockedPatterns = [
        /^(apt|apt-get|brew|yum|dnf|pacman|apk)\s/,
        /rm\s+(-rf|--recursive.*--force)\s+[\/~]/i,
        /sudo\s+rm/i,
        /mkfs/i,
        /dd\s+if=.*of=\/dev/i,
      ];
      
      for (const pattern of blockedPatterns) {
        if (pattern.test(command)) {
          return res.json({
            success: false,
            stdout: "",
            stderr: `This command is not available in this environment.\nUse pip for Python packages or npm for Node.js packages.`,
            code: 1,
          });
        }
      }

      // Execute command with timeout - inherit full environment PATH and merge custom env vars
      const { stdout, stderr } = await execPromise(command, {
        cwd: workDir,
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        shell: '/bin/bash',
        env: { 
          ...process.env,
          TERM: 'xterm-256color',
          ...(customEnv || {}),
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

  // AI command suggestion for terminal
  app.post("/api/terminal/ai-suggest", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ error: "Query is required" });
      }

      // Limit query length to prevent abuse
      if (query.length > 500) {
        return res.status(400).json({ error: "Query too long", command: null });
      }

      const ai = getAIClient();
      if (!ai) {
        return res.status(200).json({ 
          error: "AI service not available",
          command: null
        });
      }

      const response = await ai.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { 
            role: "system", 
            content: `You are a terminal command assistant. Given a natural language description, respond with ONLY the exact shell command to execute. No explanations, no markdown, just the command.

Examples:
- "list all files" -> ls -la
- "find all javascript files" -> find . -name "*.js"
- "show disk usage" -> df -h
- "create a folder called test" -> mkdir test
- "install express" -> npm install express
- "run python script" -> python script.py
- "check git status" -> git status
- "search for error in logs" -> grep -r "error" .

Only respond with safe, non-destructive commands. Never suggest rm -rf, sudo, or commands that could harm the system.`
          },
          { role: "user", content: query }
        ],
        max_tokens: 100,
      });

      let command = response.choices[0]?.message?.content?.trim() || "";
      
      // Validate and sanitize the generated command
      const dangerousPatterns = [
        /rm\s+(-rf?|--recursive|--force)/i,
        /sudo/i,
        /chmod\s+777/i,
        />\s*\/dev\//i,
        /mkfs/i,
        /dd\s+if=/i,
        /:\(\)\s*{\s*:\|:\s*&\s*}\s*;/i, // fork bomb
        /curl.*\|\s*(ba)?sh/i,
        /wget.*\|\s*(ba)?sh/i,
        /eval\s*\(/i,
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(command)) {
          return res.json({ 
            error: "Generated command contains potentially unsafe patterns",
            command: null 
          });
        }
      }
      
      // Limit command length
      if (command.length > 500) {
        command = command.slice(0, 500);
      }
      
      res.json({ command });
    } catch (error: any) {
      console.error("AI suggestion error:", error);
      res.status(500).json({ 
        error: "Failed to generate suggestion",
        command: null
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
          const { command, cwd } = tool.args;
          
          // Block only truly dangerous commands
          const blockedPatterns = [
            /rm\s+(-rf|--recursive.*--force|--force.*--recursive)\s+[\/~]/i,
            /sudo\s+rm/i,
            /mkfs/i,
            /dd\s+if=.*of=\/dev/i,
            /:\(\)\s*{\s*:\|:\s*&\s*}\s*;/i, // fork bomb
            />\s*\/dev\/(sda|hda|null)/i,
          ];
          
          for (const pattern of blockedPatterns) {
            if (pattern.test(command)) {
              return { tool: tool.tool, success: false, error: `Command blocked for safety` };
            }
          }
          
          try {
            const workDir = cwd ? path.join(WORKSPACE_DIR, cwd) : WORKSPACE_DIR;
            const { stdout, stderr } = await execPromise(command, {
              cwd: workDir,
              timeout: 60000, // 60 second timeout
              maxBuffer: 1024 * 1024 * 50, // 50MB buffer
              shell: '/bin/bash',
              env: { 
                ...process.env,
                TERM: 'xterm-256color',
                HOME: process.env.HOME || '/home/runner',
              },
            });
            return { tool: tool.tool, success: true, result: { stdout: stdout?.slice(0, 10000), stderr: stderr?.slice(0, 5000) } };
          } catch (error: any) {
            return { 
              tool: tool.tool, 
              success: false, 
              error: error.message?.slice(0, 1000), 
              result: { stdout: error.stdout?.slice(0, 5000), stderr: error.stderr?.slice(0, 3000) } 
            };
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
        
        case "append_file": {
          const { path: filePath, content } = tool.args;
          const fullPath = path.join(WORKSPACE_DIR, filePath);
          if (!fullPath.startsWith(WORKSPACE_DIR)) {
            return { tool: tool.tool, success: false, error: "Access denied" };
          }
          if (!fs.existsSync(fullPath)) {
            // Create file if it doesn't exist
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(fullPath, content || "", "utf-8");
          } else {
            fs.appendFileSync(fullPath, content || "", "utf-8");
          }
          return { tool: tool.tool, success: true, result: `Appended to: ${filePath}` };
        }
        
        case "search_files": {
          const { pattern, fileType } = tool.args;
          try {
            const grepCommand = fileType 
              ? `grep -rn "${pattern}" --include="${fileType}" . 2>/dev/null | head -50`
              : `grep -rn "${pattern}" . 2>/dev/null | head -50`;
            
            const { stdout } = await execPromise(grepCommand, {
              cwd: WORKSPACE_DIR,
              timeout: 10000,
              maxBuffer: 1024 * 1024,
              shell: '/bin/bash',
            });
            return { tool: tool.tool, success: true, result: stdout || "No matches found" };
          } catch (error: any) {
            return { tool: tool.tool, success: true, result: error.stdout || "No matches found" };
          }
        }
        
        case "mkdir": {
          const { path: dirPath } = tool.args;
          const fullPath = path.join(WORKSPACE_DIR, dirPath);
          if (!fullPath.startsWith(WORKSPACE_DIR)) {
            return { tool: tool.tool, success: false, error: "Access denied" };
          }
          fs.mkdirSync(fullPath, { recursive: true });
          return { tool: tool.tool, success: true, result: `Directory created: ${dirPath}` };
        }
        
        case "move_file": {
          const { from, to } = tool.args;
          const fromPath = path.join(WORKSPACE_DIR, from);
          const toPath = path.join(WORKSPACE_DIR, to);
          if (!fromPath.startsWith(WORKSPACE_DIR) || !toPath.startsWith(WORKSPACE_DIR)) {
            return { tool: tool.tool, success: false, error: "Access denied" };
          }
          if (!fs.existsSync(fromPath)) {
            return { tool: tool.tool, success: false, error: "Source file not found" };
          }
          fs.renameSync(fromPath, toPath);
          return { tool: tool.tool, success: true, result: `Moved ${from} to ${to}` };
        }
        
        case "copy_file": {
          const { from, to } = tool.args;
          const fromPath = path.join(WORKSPACE_DIR, from);
          const toPath = path.join(WORKSPACE_DIR, to);
          if (!fromPath.startsWith(WORKSPACE_DIR) || !toPath.startsWith(WORKSPACE_DIR)) {
            return { tool: tool.tool, success: false, error: "Access denied" };
          }
          if (!fs.existsSync(fromPath)) {
            return { tool: tool.tool, success: false, error: "Source file not found" };
          }
          fs.copyFileSync(fromPath, toPath);
          return { tool: tool.tool, success: true, result: `Copied ${from} to ${to}` };
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

  const AGENT_SYSTEM_PROMPT = `You are DevSpace AI Agent operating in LEVEL-S AUTONOMOUS MODE.

## CRITICAL RULES
1. NEVER ask for permission - EXECUTE IMMEDIATELY
2. NEVER say "I will", "Let me", "Should I?" - JUST DO IT
3. When user asks to do something, USE TOOLS DIRECTLY
4. If something fails, FIX IT AUTOMATICALLY
5. Be CONCISE - brief explanation then execute

## Tool Format
Use this exact XML format:
<tool name="TOOL_NAME">{"key": "value"}</tool>

## Available Tools

### File Operations
- **create_file** - Create new file
  <tool name="create_file">{"path": "app.js", "content": "code here"}</tool>

- **edit_file** - Replace file content
  <tool name="edit_file">{"path": "app.js", "content": "new code"}</tool>

- **read_file** - Read file
  <tool name="read_file">{"path": "app.js"}</tool>

- **delete_file** - Delete file
  <tool name="delete_file">{"path": "old.js"}</tool>

- **append_file** - Append to file
  <tool name="append_file">{"path": "log.txt", "content": "new line"}</tool>

- **mkdir** - Create directory
  <tool name="mkdir">{"path": "src/components"}</tool>

- **move_file** - Move/rename file
  <tool name="move_file">{"from": "old.js", "to": "new.js"}</tool>

- **copy_file** - Copy file
  <tool name="copy_file">{"from": "src.js", "to": "dest.js"}</tool>

- **list_files** - List workspace files
  <tool name="list_files">{}</tool>

- **search_files** - Search in files
  <tool name="search_files">{"pattern": "TODO", "fileType": "*.js"}</tool>

### Command Execution
- **run_command** - Run ANY bash command
  Full shell: pipes, redirects, chains, subshells
  <tool name="run_command">{"command": "npm install express"}</tool>
  <tool name="run_command">{"command": "ls -la | grep .py"}</tool>
  <tool name="run_command">{"command": "python app.py && echo Done"}</tool>
  <tool name="run_command">{"command": "find . -name '*.ts' | xargs grep 'error'"}</tool>
  <tool name="run_command">{"command": "curl -X POST localhost:3000/api/test"}</tool>

## Autonomous Behavior

IMMEDIATE EXECUTION:
- User: "Create a React component" -> CREATE IT NOW
- User: "Fix this error" -> READ, ANALYZE, FIX NOW
- User: "Install axios" -> RUN npm install axios NOW
- User: "Delete old files" -> DELETE THEM NOW

AUTO-REPAIR:
- Command fails? Try alternative approach
- Syntax error? Fix and retry
- Missing dependency? Install it
- Wrong path? Correct it

MULTI-STEP TASKS:
Execute all steps in sequence without asking.

## Example

User: "Create a flask API with /hello endpoint"

Creating Flask API.

<tool name="run_command">{"command": "pip install flask"}</tool>
<tool name="create_file">{"path": "app.py", "content": "from flask import Flask, jsonify\\n\\napp = Flask(__name__)\\n\\n@app.route('/hello')\\ndef hello():\\n    return jsonify({'message': 'Hello, World!'})\\n\\nif __name__ == '__main__':\\n    app.run(host='0.0.0.0', port=5000)"}</tool>

Done. Run with: python app.py`;

  // General chat system prompt for conversational AI
  const GENERAL_CHAT_PROMPT = `You are a helpful, friendly AI assistant. You can answer questions on any topic, have conversations, help with information, give advice, and assist with various tasks.

Key behaviors:
- Be helpful, accurate, and conversational
- Provide clear and informative responses
- If you don't know something, say so honestly
- Be friendly but professional
- Support multiple languages - respond in the same language the user uses
- For coding questions, provide helpful explanations and examples

You can help with:
- General knowledge and information
- Explanations of concepts
- Writing and editing text
- Math and calculations
- Advice and recommendations
- Creative tasks
- And much more!`;

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, context, mode = "agent" } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const ai = getAIClient();
      const provider = getAIProvider();
      
      if (!ai) {
        return res.status(500).json({ 
          error: "AI not configured",
          response: "AI service is not configured. Please add your Groq API key or OpenRouter API key in the Secrets tab."
        });
      }

      // Determine model based on provider
      const model = provider === "groq" 
        ? "llama-3.3-70b-versatile" 
        : "meta-llama/llama-3.3-70b-instruct";

      // General Chat Mode - simple conversational AI
      if (mode === "chat") {
        const response = await ai.chat.completions.create({
          model: model,
          messages: [
            { role: "system", content: GENERAL_CHAT_PROMPT },
            { role: "user", content: message }
          ],
          max_tokens: 2000,
        });

        const aiContent = response.choices[0]?.message?.content || "No response generated";
        
        return res.json({ 
          response: aiContent,
          toolCalls: [],
          toolResults: [],
        });
      }

      // Agent Mode - coding assistant with tool execution
      // Build context string
      let contextInfo = "";
      if (context?.currentFile) {
        contextInfo += `\n\nCurrent open file: ${context.currentFile.path}\n\`\`\`\n${context.currentFile.content}\n\`\`\``;
      }
      if (context?.fileList) {
        contextInfo += `\n\nFiles in workspace:\n${context.fileList.join("\n")}`;
      }

      const userMessage = message + contextInfo;

      const response = await ai.chat.completions.create({
        model: model,
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

      // Generate follow-up response if there are tool results
      let finalResponse = text;
      if (toolResults.length > 0) {
        const toolSummary = toolResults.map(r => {
          if (r.tool === "run_command") {
            const stdout = r.result?.stdout || "";
            const stderr = r.result?.stderr || r.error || "";
            return `Command result: ${r.success ? "Success" : "Failed"}\nOutput: ${stdout}\nErrors: ${stderr}`;
          }
          return `${r.tool}: ${r.success ? "Success" : "Failed"} - ${r.result || r.error}`;
        }).join("\n");

        try {
          const followUp = await ai.chat.completions.create({
            model: model,
            messages: [
              { role: "system", content: "You are a helpful coding assistant. Briefly summarize what happened and provide helpful next steps if needed. Be concise (1-2 sentences). If there was an error, explain what went wrong." },
              { role: "user", content: `Tool execution results:\n${toolSummary}\n\nProvide a brief summary for the user.` }
            ],
            max_tokens: 200,
          });
          const followUpText = followUp.choices[0]?.message?.content || "";
          if (followUpText) {
            finalResponse = text ? `${text}\n\n${followUpText}` : followUpText;
          }
        } catch (e) {
          // If follow-up fails, just use original text
        }
      }

      res.json({ 
        response: finalResponse,
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
      aiConfigured: isAIConfigured(),
      workspaceDir: WORKSPACE_DIR,
    });
  });

  // ============ SETTINGS API ============
  
  // Get current settings (masks API key for security)
  app.get("/api/settings", (req, res) => {
    const hasKey = !!(appSettings.groqApiKey || process.env.GROQ_API_KEY);
    const keySource = appSettings.groqApiKey ? "settings" : (process.env.GROQ_API_KEY ? "env" : "none");
    res.json({
      hasApiKey: hasKey,
      keySource: keySource,
      maskedKey: appSettings.groqApiKey ? `${appSettings.groqApiKey.slice(0, 8)}...${appSettings.groqApiKey.slice(-4)}` : "",
    });
  });

  // Update API key
  app.post("/api/settings", (req, res) => {
    try {
      const { groqApiKey } = req.body;
      
      if (groqApiKey !== undefined) {
        appSettings.groqApiKey = groqApiKey;
        saveSettings(appSettings);
      }
      
      res.json({ 
        success: true, 
        aiConfigured: isAIConfigured(),
        message: groqApiKey ? "API key saved successfully" : "API key cleared"
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
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

  // ============ PTY WEBSOCKET FOR INTERACTIVE TERMINAL ============
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/terminal" });
  
  wss.on("connection", (ws: WebSocket) => {
    const sessionId = `pty-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create PTY process
    const shell = process.env.SHELL || "/bin/bash";
    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-256color",
      cols: 80,
      rows: 24,
      cwd: WORKSPACE_DIR,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        HOME: process.env.HOME || "/home/runner",
      } as { [key: string]: string },
    });
    
    ptyProcesses.set(sessionId, ptyProcess);
    
    // Send session ID to client
    ws.send(JSON.stringify({ type: "session", sessionId }));
    
    // Forward PTY output to WebSocket
    ptyProcess.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "output", data }));
      }
    });
    
    ptyProcess.onExit(({ exitCode, signal }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "exit", exitCode, signal }));
      }
      ptyProcesses.delete(sessionId);
    });
    
    // Handle messages from client
    ws.on("message", (message: Buffer | string) => {
      try {
        const msg = JSON.parse(message.toString());
        
        switch (msg.type) {
          case "input":
            ptyProcess.write(msg.data);
            break;
          case "resize":
            if (msg.cols && msg.rows) {
              ptyProcess.resize(msg.cols, msg.rows);
            }
            break;
          case "ping":
            ws.send(JSON.stringify({ type: "pong" }));
            break;
        }
      } catch (e) {
        // If not JSON, treat as raw input
        if (typeof message === "string") {
          ptyProcess.write(message);
        }
      }
    });
    
    ws.on("close", () => {
      ptyProcess.kill();
      ptyProcesses.delete(sessionId);
    });
    
    ws.on("error", (err) => {
      console.error("WebSocket error:", err);
      ptyProcess.kill();
      ptyProcesses.delete(sessionId);
    });
  });

  return httpServer;
}
