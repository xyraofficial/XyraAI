import { useState, useRef, useEffect, useCallback } from "react";
import { Terminal as TerminalIcon, X, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { executeCommand } from "@/lib/api";
import { agentConsole, type AgentLog } from "@/lib/agentConsole";

interface TerminalLine {
  id: string;
  type: "input" | "output" | "error" | "system" | "executing";
  content: string;
  timestamp: Date;
}

interface TerminalSession {
  id: string;
  name: string;
  lines: TerminalLine[];
  currentDirectory: string;
  previousDirectory: string;
  isAgentConsole?: boolean;
  aliases: Record<string, string>;
  envVars: Record<string, string>;
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
      previousDirectory: initialDirectory,
      isAgentConsole: true,
      aliases: {},
      envVars: {},
    },
    {
      id: "1",
      name: "bash",
      lines: [
        {
          id: "welcome",
          type: "system",
          content: "DevSpace Terminal - Connected to real shell. Type 'help' for commands.",
          timestamp: new Date(),
        },
      ],
      currentDirectory: initialDirectory,
      previousDirectory: initialDirectory,
      aliases: {},
      envVars: {},
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
  const [executingCommand, setExecutingCommand] = useState("");
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
  }, [activeSession?.lines, scrollToBottom, isExecuting]);

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

  const updateExecutingLine = (sessionId: string, content: string) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              lines: session.lines.map((line) =>
                line.type === "executing"
                  ? { ...line, content }
                  : line
              ),
            }
          : session
      )
    );
  };

  const removeExecutingLine = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              lines: session.lines.filter((line) => line.type !== "executing"),
            }
          : session
      )
    );
  };

  const processCommand = async (command: string) => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;

    // Expand aliases
    let expandedCommand = trimmedCommand;
    const firstWord = trimmedCommand.split(/\s+/)[0];
    if (activeSession?.aliases[firstWord]) {
      expandedCommand = trimmedCommand.replace(firstWord, activeSession.aliases[firstWord]);
    }

    addLine(activeSessionId, "input", `${activeSession?.currentDirectory || "~"}$ ${trimmedCommand}`);
    setCommandHistory((prev) => [...prev, trimmedCommand]);
    setHistoryIndex(-1);

    // Handle built-in commands
    if (expandedCommand === "clear") {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeSessionId
            ? { ...session, lines: [] }
            : session
        )
      );
      return;
    }

    if (expandedCommand === "exit") {
      addLine(activeSessionId, "system", "Use Ctrl+D to exit or close the terminal tab.");
      return;
    }

    if (expandedCommand === "pwd") {
      addLine(activeSessionId, "output", activeSession?.currentDirectory || "/");
      return;
    }

    if (expandedCommand === "history") {
      const historyOutput = commandHistory
        .map((cmd, i) => `  ${i + 1}  ${cmd}`)
        .join("\n");
      addLine(activeSessionId, "output", historyOutput || "No commands in history.");
      return;
    }

    if (expandedCommand.startsWith("alias ")) {
      const aliasMatch = expandedCommand.match(/^alias\s+(\w+)=['"]?(.+?)['"]?$/);
      if (aliasMatch) {
        const [, name, value] = aliasMatch;
        setSessions((prev) =>
          prev.map((session) =>
            session.id === activeSessionId
              ? { ...session, aliases: { ...session.aliases, [name]: value } }
              : session
          )
        );
        addLine(activeSessionId, "output", `alias ${name}='${value}'`);
      } else {
        const aliases = Object.entries(activeSession?.aliases || {})
          .map(([k, v]) => `alias ${k}='${v}'`)
          .join("\n");
        addLine(activeSessionId, "output", aliases || "No aliases defined.");
      }
      return;
    }

    if (expandedCommand.startsWith("unalias ")) {
      const name = expandedCommand.slice(8).trim();
      setSessions((prev) =>
        prev.map((session) => {
          if (session.id !== activeSessionId) return session;
          const newAliases = { ...session.aliases };
          delete newAliases[name];
          return { ...session, aliases: newAliases };
        })
      );
      addLine(activeSessionId, "output", `Removed alias: ${name}`);
      return;
    }

    if (expandedCommand === "export") {
      const exports = Object.entries(activeSession?.envVars || {})
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");
      addLine(activeSessionId, "output", exports || "No environment variables exported.");
      return;
    }

    if (expandedCommand.startsWith("export ")) {
      const exportMatch = expandedCommand.match(/^export\s+(\w+)=(.+)$/);
      if (exportMatch) {
        const [, name, value] = exportMatch;
        const cleanValue = value.replace(/^["']|["']$/g, '');
        setSessions((prev) =>
          prev.map((session) =>
            session.id === activeSessionId
              ? { ...session, envVars: { ...session.envVars, [name]: cleanValue } }
              : session
          )
        );
        addLine(activeSessionId, "output", `export ${name}=${cleanValue}`);
      }
      return;
    }

    if (expandedCommand === "help") {
      addLine(
        activeSessionId,
        "output",
        `DevSpace Terminal - Complete Shell Environment
================================================

Built-in Commands:
  clear       - Clear terminal screen
  pwd         - Print working directory
  cd <dir>    - Change directory (supports: cd, cd -, cd ~, cd ..)
  history     - Show command history
  alias       - List/create aliases (alias name='command')
  unalias     - Remove an alias
  export      - Set environment variable
  exit        - Exit information
  help        - Show this help

Navigation:
  cd          - Go to home directory
  cd -        - Go to previous directory
  cd ~        - Go to home directory
  cd ..       - Go up one directory

File Commands:
  ls          - List files and directories
  cat <file>  - View file contents
  mkdir       - Create directory
  rm          - Remove files
  mv          - Move/rename files
  cp          - Copy files
  touch       - Create empty file

Development:
  npm install - Install npm packages
  npm run     - Run npm scripts
  node        - Run Node.js
  python      - Run Python
  pip install - Install Python packages

Version Control:
  git status  - Check git status
  git clone   - Clone repository
  git add     - Stage changes
  git commit  - Commit changes
  git push    - Push changes
  git pull    - Pull changes

Keyboard Shortcuts:
  Ctrl+L      - Clear terminal
  Ctrl+C      - Cancel/clear input
  Ctrl+D      - EOF signal
  Ctrl+U      - Clear input line
  Ctrl+A      - Go to beginning of line
  Ctrl+E      - Go to end of line
  Up/Down     - Navigate history

Note: Some system commands may be restricted for security.`
      );
      return;
    }

    // Handle cd command locally for better tracking
    if (expandedCommand === "cd" || expandedCommand === "cd ~") {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeSessionId
            ? {
                ...session,
                previousDirectory: session.currentDirectory,
                currentDirectory: "",
              }
            : session
        )
      );
      addLine(activeSessionId, "output", "Changed to home directory");
      return;
    }

    if (expandedCommand === "cd -") {
      const prevDir = activeSession?.previousDirectory || "";
      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeSessionId
            ? {
                ...session,
                previousDirectory: session.currentDirectory,
                currentDirectory: prevDir,
              }
            : session
        )
      );
      addLine(activeSessionId, "output", prevDir || "~");
      return;
    }

    // Execute real command
    setIsExecuting(true);
    setExecutingCommand(expandedCommand);
    
    // Add executing line with animation
    addLine(activeSessionId, "executing", `Executing: ${expandedCommand}...`);
    
    try {
      const result = await executeCommand(expandedCommand, activeSession?.currentDirectory, activeSession?.envVars);
      
      // Remove the executing line
      removeExecutingLine(activeSessionId);
      
      if (result.stdout) {
        addLine(activeSessionId, "output", result.stdout.trim());
      }
      if (result.stderr) {
        addLine(activeSessionId, result.success ? "output" : "error", result.stderr.trim());
      }
      if (!result.stdout && !result.stderr && result.success) {
        addLine(activeSessionId, "output", `Command completed successfully.`);
      }
      if (!result.success && !result.stderr) {
        addLine(activeSessionId, "error", `Command failed with exit code: ${result.code}`);
      }

      // Handle cd command to track directory
      if (expandedCommand.startsWith("cd ")) {
        const newDir = expandedCommand.slice(3).trim();
        if (result.success) {
          setSessions((prev) =>
            prev.map((session) =>
              session.id === activeSessionId
                ? {
                    ...session,
                    previousDirectory: session.currentDirectory,
                    currentDirectory: newDir.startsWith("/") 
                      ? newDir 
                      : newDir === ".."
                        ? session.currentDirectory.split("/").slice(0, -1).join("/") || ""
                        : `${session.currentDirectory}/${newDir}`.replace(/\/+/g, "/").replace(/^\//, ""),
                  }
                : session
            )
          );
        }
      }
    } catch (error: any) {
      removeExecutingLine(activeSessionId);
      addLine(activeSessionId, "error", `Error: ${error.message}`);
    } finally {
      setIsExecuting(false);
      setExecutingCommand("");
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
      e.preventDefault();
      if (isExecuting) {
        removeExecutingLine(activeSessionId);
        addLine(activeSessionId, "system", "^C - Command interrupted");
        setIsExecuting(false);
        setExecutingCommand("");
      } else {
        setInput("");
        addLine(activeSessionId, "input", `${activeSession?.currentDirectory || "~"}$ ^C`);
      }
    } else if (e.key === "d" && e.ctrlKey) {
      e.preventDefault();
      if (!input) {
        addLine(activeSessionId, "system", "^D - EOF (Use close button to remove terminal tab)");
      }
    } else if (e.key === "u" && e.ctrlKey) {
      e.preventDefault();
      setInput("");
    } else if (e.key === "a" && e.ctrlKey) {
      e.preventDefault();
      const inputEl = inputRef.current;
      if (inputEl) {
        inputEl.setSelectionRange(0, 0);
      }
    } else if (e.key === "e" && e.ctrlKey) {
      e.preventDefault();
      const inputEl = inputRef.current;
      if (inputEl) {
        inputEl.setSelectionRange(input.length, input.length);
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
        name: `bash ${prev.length}`,
        lines: [
          {
            id: "welcome-new",
            type: "system",
            content: "New terminal session started.",
            timestamp: new Date(),
          },
        ],
        currentDirectory: initialDirectory,
        previousDirectory: initialDirectory,
        aliases: {},
        envVars: {},
      },
    ]);
    setActiveSessionId(newId);
  };

  const closeSession = (id: string) => {
    if (id === "agent-console") return; // Don't allow closing agent console
    if (sessions.length <= 2) return; // Keep at least agent console + 1 bash
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) {
      const remaining = sessions.filter((s) => s.id !== id);
      setActiveSessionId(remaining[remaining.length - 1]?.id || "agent-console");
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
            {session.id !== "agent-console" && sessions.length > 2 && (
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
                : line.type === "executing"
                ? "text-yellow-400 flex items-center gap-2"
                : ""
            }`}
          >
            {line.type === "executing" ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin inline-block mr-2" />
                {line.content}
              </>
            ) : (
              line.content
            )}
          </div>
        ))}
        
        {/* Input prompt line */}
        <div className="flex items-center mt-1 flex-wrap gap-1">
          <span className="text-primary text-xs">{activeSession?.currentDirectory || "~"}</span>
          <span className="text-success">$</span>
          {isExecuting ? (
            <div className="flex items-center gap-2 text-yellow-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Running: {executingCommand}</span>
            </div>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent outline-none caret-success min-w-0"
              autoFocus
              spellCheck={false}
              placeholder="Type a command..."
              data-testid="terminal-input"
            />
          )}
        </div>
      </div>
    </div>
  );
}
