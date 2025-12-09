import { useState, useRef, useEffect, useCallback } from "react";
import { Terminal as TerminalIcon, X, Plus, Trash2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { executeCommand } from "@/lib/api";
import { agentConsole, type AgentLog } from "@/lib/agentConsole";

interface TerminalLine {
  id: string;
  type: "input" | "output" | "error" | "system";
  content: string;
  timestamp: Date;
}

interface TerminalSession {
  id: string;
  name: string;
  lines: TerminalLine[];
  currentDirectory: string;
  isAgentConsole?: boolean;
}

interface TerminalProps {
  initialDirectory?: string;
}

export default function Terminal({ 
  initialDirectory = ""
}: TerminalProps) {
  const [sessions, setSessions] = useState<TerminalSession[]>([
    {
      id: "agent-console",
      name: "Agent Console",
      lines: [
        {
          id: "welcome-agent",
          type: "system",
          content: "Agent Console - Output from AI Agent commands will appear here.",
          timestamp: new Date(),
        },
      ],
      currentDirectory: initialDirectory,
      isAgentConsole: true,
    },
    {
      id: "1",
      name: "bash",
      lines: [
        {
          id: "welcome",
          type: "system",
          content: "DevSpace Terminal - Connected to real shell. Try: ls, pwd, npm, git, python, etc.",
          timestamp: new Date(),
        },
      ],
      currentDirectory: initialDirectory,
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState("agent-console");

  useEffect(() => {
    const unsubscribe = agentConsole.subscribe((log: AgentLog) => {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === "agent-console"
            ? {
                ...session,
                lines: [
                  ...session.lines,
                  {
                    id: log.id,
                    type: log.type === "command" ? "input" : log.type === "error" ? "error" : "output",
                    content: log.content,
                    timestamp: log.timestamp,
                  },
                ],
              }
            : session
        )
      );
    });
    return unsubscribe;
  }, []);
  const [input, setInput] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.lines, scrollToBottom]);

  const addLine = (sessionId: string, type: TerminalLine["type"], content: string) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              lines: [
                ...session.lines,
                {
                  id: `${Date.now()}-${Math.random()}`,
                  type,
                  content,
                  timestamp: new Date(),
                },
              ],
            }
          : session
      )
    );
  };

  const processCommand = async (command: string) => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;

    addLine(activeSessionId, "input", `$ ${trimmedCommand}`);
    setCommandHistory((prev) => [...prev, trimmedCommand]);
    setHistoryIndex(-1);

    // Handle built-in commands
    if (trimmedCommand === "clear") {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeSessionId
            ? { ...session, lines: [] }
            : session
        )
      );
      return;
    }

    if (trimmedCommand === "help") {
      addLine(
        activeSessionId,
        "output",
        `DevSpace Terminal - Real Shell Commands
=========================================
This terminal executes real commands on the server.

Common commands:
  ls          - List files and directories
  pwd         - Print working directory
  cat <file>  - View file contents
  mkdir       - Create directory
  rm          - Remove files
  mv          - Move/rename files
  cp          - Copy files
  
Development:
  npm install - Install npm packages
  npm run     - Run npm scripts
  node        - Run Node.js
  python      - Run Python
  pip install - Install Python packages
  
Version Control:
  git status  - Check git status
  git clone   - Clone repository
  git pull    - Pull changes
  git push    - Push changes
  
System:
  which       - Find command location
  echo        - Print text
  env         - Show environment variables
  clear       - Clear terminal

Note: Some commands may be restricted for security.`
      );
      return;
    }

    // Execute real command
    setIsExecuting(true);
    try {
      const result = await executeCommand(trimmedCommand, activeSession?.currentDirectory);
      
      if (result.stdout) {
        addLine(activeSessionId, "output", result.stdout.trim());
      }
      if (result.stderr) {
        addLine(activeSessionId, result.success ? "output" : "error", result.stderr.trim());
      }
      if (!result.stdout && !result.stderr && result.success) {
        // Command succeeded but no output (like mkdir, touch, etc.)
      }
      if (!result.success && !result.stderr) {
        addLine(activeSessionId, "error", `Command failed with exit code: ${result.code}`);
      }

      // Handle cd command to track directory
      if (trimmedCommand.startsWith("cd ")) {
        const newDir = trimmedCommand.slice(3).trim();
        if (result.success) {
          setSessions((prev) =>
            prev.map((session) =>
              session.id === activeSessionId
                ? {
                    ...session,
                    currentDirectory: newDir.startsWith("/") 
                      ? newDir 
                      : `${session.currentDirectory}/${newDir}`.replace(/\/+/g, "/"),
                  }
                : session
            )
          );
        }
      }
    } catch (error: any) {
      addLine(activeSessionId, "error", `Error: ${error.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isExecuting) {
      processCommand(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || "");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || "");
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput("");
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId ? { ...s, lines: [] } : s
        )
      );
    } else if (e.key === "c" && e.ctrlKey) {
      if (isExecuting) {
        addLine(activeSessionId, "system", "^C");
        setIsExecuting(false);
      }
    }
  };

  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  const addSession = () => {
    const newId = `${Date.now()}`;
    setSessions((prev) => [
      ...prev,
      {
        id: newId,
        name: `bash ${prev.length + 1}`,
        lines: [],
        currentDirectory: initialDirectory,
      },
    ]);
    setActiveSessionId(newId);
  };

  const closeSession = (id: string) => {
    if (sessions.length === 1) return;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) {
      setActiveSessionId(sessions[0].id === id ? sessions[1].id : sessions[0].id);
    }
  };

  return (
    <div className="flex flex-col h-full bg-terminal text-foreground font-mono text-sm">
      <div className="flex items-center gap-1 px-2 py-1 bg-background/80 border-b border-border">
        <TerminalIcon className="w-4 h-4 text-muted-foreground mr-2" />
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`flex items-center gap-1 px-2 py-1 rounded-sm cursor-pointer group ${
              session.id === activeSessionId
                ? "bg-terminal text-foreground"
                : "text-muted-foreground hover-elevate"
            }`}
            onClick={() => setActiveSessionId(session.id)}
            data-testid={`terminal-tab-${session.id}`}
          >
            <span className="text-xs">{session.name}</span>
            {sessions.length > 1 && (
              <Button
                size="icon"
                variant="ghost"
                className="h-4 w-4 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  closeSession(session.id);
                }}
                data-testid={`close-terminal-${session.id}`}
              >
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        ))}
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 ml-1"
          onClick={addSession}
          data-testid="button-new-terminal"
        >
          <Plus className="w-3 h-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 ml-auto"
          onClick={() =>
            setSessions((prev) =>
              prev.map((s) =>
                s.id === activeSessionId ? { ...s, lines: [] } : s
              )
            )
          }
          data-testid="button-clear-terminal"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-2 cursor-text"
        onClick={handleTerminalClick}
        data-testid="terminal-output"
      >
        {activeSession?.lines.map((line) => (
          <div
            key={line.id}
            className={`whitespace-pre-wrap break-all ${
              line.type === "error"
                ? "text-destructive"
                : line.type === "system"
                ? "text-primary"
                : line.type === "input"
                ? "text-success"
                : ""
            }`}
          >
            {line.content}
          </div>
        ))}
        <div className="flex items-center">
          <span className="text-success mr-2">$</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none caret-success"
            autoFocus
            spellCheck={false}
            disabled={isExecuting}
            placeholder={isExecuting ? "Executing..." : ""}
            data-testid="terminal-input"
          />
          {isExecuting && (
            <span className="text-muted-foreground animate-pulse">Running...</span>
          )}
        </div>
      </div>
    </div>
  );
}
