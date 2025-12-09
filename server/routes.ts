import type { Express } from "express";
import { createServer, type Server } from "http";
import { spawn, exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { promisify } from "util";

const execPromise = promisify(exec);

// Workspace directory for user files
const WORKSPACE_DIR = path.join(process.cwd(), "workspace");

// Ensure workspace directory exists
if (!fs.existsSync(WORKSPACE_DIR)) {
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
}

// OpenRouter API configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

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
      
      // Execute command with timeout
      const { stdout, stderr } = await execPromise(command, {
        cwd: workDir,
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        env: { ...process.env, HOME: WORKSPACE_DIR },
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

  // ============ AI CHAT API ============

  app.post("/api/chat", async (req, res) => {
    try {
      const { message, model = "anthropic/claude-3.5-sonnet" } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      if (!OPENROUTER_API_KEY) {
        return res.status(500).json({ 
          error: "OpenRouter API key not configured",
          response: "I'm sorry, but the AI service is not configured yet. Please add your OpenRouter API key to use the AI assistant."
        });
      }

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://devspace.replit.app",
          "X-Title": "DevSpace IDE",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: "You are a helpful AI coding assistant in a web-based IDE called DevSpace. You help developers with writing code, debugging, explaining concepts, and answering programming questions. Be concise and provide code examples when helpful. Use markdown code blocks with language tags for code snippets."
            },
            {
              role: "user",
              content: message
            }
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error("OpenRouter API error:", errorData);
        return res.status(response.status).json({ 
          error: "AI service error",
          response: "Sorry, there was an error communicating with the AI service. Please try again."
        });
      }

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content || "No response generated";

      res.json({ response: aiResponse });
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
      aiConfigured: !!OPENROUTER_API_KEY,
      workspaceDir: WORKSPACE_DIR,
    });
  });

  return httpServer;
}
