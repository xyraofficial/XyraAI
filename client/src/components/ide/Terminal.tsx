import { useState, useRef, useEffect, useCallback } from "react";
import { Terminal as TerminalIcon, X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

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
}

interface TerminalProps {
  onCommand?: (command: string) => Promise<string>;
  initialDirectory?: string;
}

export default function Terminal({ 
  onCommand,
  initialDirectory = "~/workspace"
}: TerminalProps) {
  const [sessions, setSessions] = useState<TerminalSession[]>([
    {
      id: "1",
      name: "bash",
      lines: [
        {
          id: "welcome",
          type: "system",
          content: "Welcome to DevSpace Terminal. Type 'help' for available commands.",
          timestamp: new Date(),
        },
      ],
      currentDirectory: initialDirectory,
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState("1");
  const [input, setInput] = useState("");
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

    const [cmd, ...args] = trimmedCommand.split(" ");

    // todo: remove mock functionality - replace with real backend integration
    switch (cmd.toLowerCase()) {
      case "help":
        addLine(
          activeSessionId,
          "output",
          `Available commands:
  help      - Show this help message
  clear     - Clear terminal
  ls        - List files
  cd        - Change directory
  pwd       - Print working directory
  echo      - Print text
  date      - Show current date/time
  whoami    - Show current user
  npm       - Node package manager
  node      - Run Node.js`
        );
        break;
      case "clear":
        setSessions((prev) =>
          prev.map((session) =>
            session.id === activeSessionId
              ? { ...session, lines: [] }
              : session
          )
        );
        break;
      case "ls":
        addLine(
          activeSessionId,
          "output",
          `src/           package.json    README.md
node_modules/  tsconfig.json   vite.config.ts`
        );
        break;
      case "pwd":
        addLine(activeSessionId, "output", activeSession?.currentDirectory || "~");
        break;
      case "cd":
        if (args[0]) {
          setSessions((prev) =>
            prev.map((session) =>
              session.id === activeSessionId
                ? {
                    ...session,
                    currentDirectory:
                      args[0] === ".."
                        ? session.currentDirectory.split("/").slice(0, -1).join("/") || "~"
                        : `${session.currentDirectory}/${args[0]}`,
                  }
                : session
            )
          );
        } else {
          addLine(activeSessionId, "error", "cd: missing operand");
        }
        break;
      case "echo":
        addLine(activeSessionId, "output", args.join(" "));
        break;
      case "date":
        addLine(activeSessionId, "output", new Date().toString());
        break;
      case "whoami":
        addLine(activeSessionId, "output", "developer");
        break;
      case "npm":
        if (args[0] === "install" || args[0] === "i") {
          addLine(activeSessionId, "output", `Installing ${args[1] || "dependencies"}...`);
          setTimeout(() => {
            addLine(activeSessionId, "output", "added 127 packages in 3.2s");
          }, 1000);
        } else if (args[0] === "run") {
          addLine(activeSessionId, "output", `> ${args[1]}`);
          addLine(activeSessionId, "output", "Starting development server...");
        } else {
          addLine(activeSessionId, "output", "npm <command>");
        }
        break;
      case "node":
        if (args[0]) {
          addLine(activeSessionId, "output", `Running ${args[0]}...`);
        } else {
          addLine(activeSessionId, "output", "Welcome to Node.js v20.0.0");
        }
        break;
      default:
        if (onCommand) {
          try {
            const result = await onCommand(trimmedCommand);
            addLine(activeSessionId, "output", result);
          } catch (error) {
            addLine(activeSessionId, "error", `Error: ${error}`);
          }
        } else {
          addLine(activeSessionId, "error", `Command not found: ${cmd}`);
        }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
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
        prev.map((session) =>
          session.id === activeSessionId ? { ...session, lines: [] } : session
        )
      );
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
          <span className="text-success mr-2">
            {activeSession?.currentDirectory}$
          </span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent outline-none caret-success"
            autoFocus
            spellCheck={false}
            data-testid="terminal-input"
          />
        </div>
      </div>
    </div>
  );
}
