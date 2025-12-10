import { useState, useRef, useEffect, useCallback } from "react";
import { Terminal as TerminalIcon, X, Plus, Trash2, Loader2, Search, Sparkles, ChevronUp, ChevronDown, StopCircle, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface BasicTerminalProps {
  initialDirectory?: string;
  onSwitchToPTY: () => void;
}

const TERMINAL_STORAGE_KEY = "devspace_terminal_sessions";
const TERMINAL_ACTIVE_KEY = "devspace_terminal_active";
const TERMINAL_HISTORY_KEY = "devspace_terminal_history";

function getInitialSessions(initialDirectory: string): TerminalSession[] {
  try {
    const saved = localStorage.getItem(TERMINAL_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((session: any) => ({
          ...session,
          lines: session.lines.map((line: any) => ({
            ...line,
            timestamp: new Date(line.timestamp),
            type: line.type === "executing" ? "system" : line.type,
          })),
        }));
      }
    }
  } catch (e) {
    console.warn("Failed to restore terminal sessions:", e);
  }
  
  return [
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
  ];
}

function getInitialActiveSession(): string {
  try {
    const saved = localStorage.getItem(TERMINAL_ACTIVE_KEY);
    if (saved) return saved;
  } catch (e) {}
  return "agent-console";
}

function getInitialHistory(): string[] {
  try {
    const saved = localStorage.getItem(TERMINAL_HISTORY_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [];
}

export default function BasicTerminal({ 
  initialDirectory = "",
  onSwitchToPTY
}: BasicTerminalProps) {
  const [sessions, setSessions] = useState<TerminalSession[]>(() => getInitialSessions(initialDirectory));
  const [activeSessionId, setActiveSessionId] = useState(() => getInitialActiveSession());

  // Save sessions to localStorage whenever they change (but not executing lines)
  useEffect(() => {
    try {
      const sessionsToSave = sessions.map(s => ({
        ...s,
        lines: s.lines.filter(l => l.type !== "executing").slice(-500),
      }));
      localStorage.setItem(TERMINAL_STORAGE_KEY, JSON.stringify(sessionsToSave));
    } catch (e) {
      console.warn("Failed to save terminal sessions:", e);
    }
  }, [sessions]);

  // Save active session to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(TERMINAL_ACTIVE_KEY, activeSessionId);
    } catch (e) {}
  }, [activeSessionId]);

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
  const [commandHistory, setCommandHistory] = useState<string[]>(() => getInitialHistory());
  const [historyIndex, setHistoryIndex] = useState(-1);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Save command history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(TERMINAL_HISTORY_KEY, JSON.stringify(commandHistory.slice(-100)));
    } catch (e) {}
  }, [commandHistory]);
  
  // Search feature states
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  
  // AI assistance states
  const [showAiInput, setShowAiInput] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");
  
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeSession?.lines, scrollToBottom, isExecuting]);

  useEffect(() => {
    lineRefs.current.clear();
  }, [activeSessionId, activeSession?.lines.length]);

  useEffect(() => {
    if (!searchQuery || !activeSession) {
      setSearchMatches([]);
      setCurrentMatchIndex(0);
      return;
    }
    
    const matches: number[] = [];
    const lowerQuery = searchQuery.toLowerCase();
    activeSession.lines.forEach((line, index) => {
      if (line.content.toLowerCase().includes(lowerQuery)) {
        matches.push(index);
      }
    });
    setSearchMatches(matches);
    setCurrentMatchIndex(matches.length > 0 ? 0 : -1);
  }, [searchQuery, activeSession?.lines]);

  const scrollToMatch = useCallback((matchIndex: number) => {
    if (searchMatches.length === 0) return;
    const lineIndex = searchMatches[matchIndex];
    const element = lineRefs.current.get(lineIndex);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [searchMatches]);

  const nextMatch = () => {
    if (searchMatches.length === 0) return;
    const newIndex = (currentMatchIndex + 1) % searchMatches.length;
    setCurrentMatchIndex(newIndex);
    scrollToMatch(newIndex);
  };

  const prevMatch = () => {
    if (searchMatches.length === 0) return;
    const newIndex = currentMatchIndex === 0 ? searchMatches.length - 1 : currentMatchIndex - 1;
    setCurrentMatchIndex(newIndex);
    scrollToMatch(newIndex);
  };

  const generateAiCommand = async () => {
    if (!aiQuery.trim()) return;
    
    setIsAiLoading(true);
    try {
      const response = await fetch("/api/terminal/ai-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: aiQuery }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.command) {
          setAiSuggestion(data.command);
          setInput(data.command);
          setShowAiInput(false);
          setAiQuery("");
          inputRef.current?.focus();
        }
      } else {
        addLine(activeSessionId, "error", "AI suggestion failed. Please try again.");
      }
    } catch (error) {
      addLine(activeSessionId, "error", "AI service unavailable.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const highlightContent = (content: string, lineIndex: number) => {
    if (!searchQuery || !searchMatches.includes(lineIndex)) {
      return content;
    }
    
    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = content.split(regex);
    const isCurrentMatch = searchMatches[currentMatchIndex] === lineIndex;
    
    return parts.map((part, i) => {
      if (part.toLowerCase() === searchQuery.toLowerCase()) {
        return (
          <mark 
            key={i} 
            className={`${isCurrentMatch ? 'bg-yellow-400 text-black' : 'bg-yellow-600/50 text-white'} rounded px-0.5`}
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  };

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

  const cancelExecution = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    removeExecutingLine(activeSessionId);
    addLine(activeSessionId, "system", "^C - Command cancelled");
    setIsExecuting(false);
    setExecutingCommand("");
  };

  const processCommand = async (command: string) => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;

    let expandedCommand = trimmedCommand;
    const firstWord = trimmedCommand.split(/\s+/)[0];
    if (activeSession?.aliases[firstWord]) {
      expandedCommand = trimmedCommand.replace(firstWord, activeSession.aliases[firstWord]);
    }

    addLine(activeSessionId, "input", `${activeSession?.currentDirectory || "~"}$ ${trimmedCommand}`);
    setCommandHistory((prev) => [...prev, trimmedCommand]);
    setHistoryIndex(-1);
    setAiSuggestion("");

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
  cd <dir>    - Change directory
  history     - Show command history
  alias       - List/create aliases
  unalias     - Remove an alias
  export      - Set environment variable
  help        - Show this help

Keyboard Shortcuts:
  Ctrl+L      - Clear terminal
  Ctrl+C      - Cancel/clear input
  Ctrl+F      - Search in output
  Ctrl+G      - AI command generator
  Up/Down     - Navigate history

For interactive scripts (like Python input()), click the 
monitor icon to switch to Interactive Mode (PTY).`
      );
      return;
    }

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

    setIsExecuting(true);
    setExecutingCommand(expandedCommand);
    addLine(activeSessionId, "executing", `Executing: ${expandedCommand}...`);
    abortControllerRef.current = new AbortController();
    
    try {
      const result = await executeCommand(expandedCommand, activeSession?.currentDirectory, activeSession?.envVars);
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
      if (error.name === 'AbortError') {
        addLine(activeSessionId, "system", "Command was cancelled.");
      } else {
        addLine(activeSessionId, "error", `Error: ${error.message}`);
      }
    } finally {
      setIsExecuting(false);
      setExecutingCommand("");
      abortControllerRef.current = null;
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
    } else if (e.key === "f" && e.ctrlKey) {
      e.preventDefault();
      setShowSearch(true);
      setShowAiInput(false);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else if (e.key === "g" && e.ctrlKey) {
      e.preventDefault();
      setShowAiInput(true);
      setShowSearch(false);
      setTimeout(() => aiInputRef.current?.focus(), 50);
    } else if (e.key === "c" && e.ctrlKey) {
      e.preventDefault();
      if (isExecuting) {
        cancelExecution();
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

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setShowSearch(false);
      setSearchQuery("");
      inputRef.current?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        prevMatch();
      } else {
        nextMatch();
      }
    }
  };

  const handleAiKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setShowAiInput(false);
      setAiQuery("");
      inputRef.current?.focus();
    } else if (e.key === "Enter") {
      e.preventDefault();
      generateAiCommand();
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
    if (id === "agent-console") return;
    if (sessions.length <= 2) return;
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
          className={`h-6 w-6 ml-auto ${showSearch ? 'bg-accent' : ''}`}
          onClick={() => {
            setShowSearch(!showSearch);
            setShowAiInput(false);
            if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
          }}
          title="Search (Ctrl+F)"
          data-testid="button-search-terminal"
        >
          <Search className="w-3 h-3" />
        </Button>
        
        <Button
          size="icon"
          variant="ghost"
          className={`h-6 w-6 ${showAiInput ? 'bg-accent' : ''}`}
          onClick={() => {
            setShowAiInput(!showAiInput);
            setShowSearch(false);
            if (!showAiInput) setTimeout(() => aiInputRef.current?.focus(), 50);
          }}
          title="AI Command Generator (Ctrl+G)"
          data-testid="button-ai-terminal"
        >
          <Sparkles className="w-3 h-3" />
        </Button>
        
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={onSwitchToPTY}
          title="Switch to Interactive Mode (PTY) - supports keyboard input"
          data-testid="button-switch-pty"
        >
          <Monitor className="w-3 h-3" />
        </Button>
        
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
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

      {showSearch && (
        <div className="flex items-center gap-2 px-2 py-1 bg-muted/50 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search in output... (Enter: next, Shift+Enter: prev, Esc: close)"
            className="h-7 text-xs flex-1"
            data-testid="input-search-terminal"
          />
          {searchMatches.length > 0 && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {currentMatchIndex + 1} / {searchMatches.length}
            </span>
          )}
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={prevMatch} disabled={searchMatches.length === 0}>
            <ChevronUp className="w-3 h-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={nextMatch} disabled={searchMatches.length === 0}>
            <ChevronDown className="w-3 h-3" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-6 w-6" 
            onClick={() => { setShowSearch(false); setSearchQuery(""); inputRef.current?.focus(); }}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      {showAiInput && (
        <div className="flex items-center gap-2 px-2 py-1 bg-muted/50 border-b border-border">
          <Sparkles className="w-4 h-4 text-primary" />
          <Input
            ref={aiInputRef}
            type="text"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={handleAiKeyDown}
            placeholder="Describe what you want to do... (e.g., 'list all js files')"
            className="h-7 text-xs flex-1"
            disabled={isAiLoading}
            data-testid="input-ai-terminal"
          />
          <Button 
            size="sm" 
            variant="default" 
            className="h-7 text-xs"
            onClick={generateAiCommand}
            disabled={isAiLoading || !aiQuery.trim()}
            data-testid="button-generate-command"
          >
            {isAiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Generate"}
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-6 w-6" 
            onClick={() => { setShowAiInput(false); setAiQuery(""); inputRef.current?.focus(); }}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-2 cursor-text"
        onClick={handleTerminalClick}
        data-testid="terminal-output"
      >
        {activeSession?.lines.map((line, index) => (
          <div
            key={line.id}
            ref={(el) => { if (el) lineRefs.current.set(index, el); }}
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
              highlightContent(line.content, index)
            )}
          </div>
        ))}
        
        <div className="flex items-center mt-1 flex-wrap gap-1">
          <span className="text-primary text-xs">{activeSession?.currentDirectory || "~"}</span>
          <span className="text-success">$</span>
          {isExecuting ? (
            <div className="flex items-center gap-2 text-yellow-400 flex-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="flex-1 truncate">Running: {executingCommand}</span>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-destructive"
                onClick={cancelExecution}
                title="Cancel execution (Ctrl+C)"
                data-testid="button-cancel-execution"
              >
                <StopCircle className="w-4 h-4" />
              </Button>
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
              placeholder={aiSuggestion ? `AI suggested: ${aiSuggestion}` : "Type a command..."}
              data-testid="terminal-input"
            />
          )}
        </div>
      </div>
    </div>
  );
}
