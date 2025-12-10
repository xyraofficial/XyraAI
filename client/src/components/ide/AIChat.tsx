import { useState, useRef, useEffect, useCallback } from "react";
import { 
  Send, Bot, User, Loader2, Sparkles, Copy, Check, Trash2, FileCode, Terminal, 
  FolderOpen, Pencil, Trash, CheckCircle, XCircle, Pin, PinOff, History, 
  Download, RotateCcw, Settings2, ChevronDown, Zap, MessageCircle, Code2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { sendChatMessage, getApiStatus, getFileTree, readFile, type ToolCall, type ToolResult, type FileNode, type ChatMode } from "@/lib/api";
import { agentConsole } from "@/lib/agentConsole";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  isPinned?: boolean;
}

interface ChatSession {
  id: string;
  name: string;
  messages: Message[];
  createdAt: Date;
  model: string;
}

interface AgentSettings {
  autoExecute: boolean;
  autoTerminalSwitch: boolean;
  showToolResults: boolean;
  persistSession: boolean;
}

interface AIChatProps {
  currentFile?: {
    path: string;
    content: string;
  };
  onFileChange?: () => void;
  onSwitchToTerminal?: () => void;
}

const STORAGE_KEY = "devspace_chat_session";
const HISTORY_KEY = "devspace_chat_history";
const SETTINGS_KEY = "devspace_agent_settings";

const TOOL_ICONS: Record<string, typeof FileCode> = {
  create_file: FileCode,
  edit_file: Pencil,
  read_file: FolderOpen,
  delete_file: Trash,
  run_command: Terminal,
  list_files: FolderOpen,
  append_file: FileCode,
  search_files: FolderOpen,
  mkdir: FolderOpen,
  move_file: FolderOpen,
  copy_file: FolderOpen,
};

const TOOL_LABELS: Record<string, string> = {
  create_file: "Created file",
  edit_file: "Edited file",
  read_file: "Read file",
  delete_file: "Deleted file",
  run_command: "Ran command",
  list_files: "Listed files",
  append_file: "Appended to file",
  search_files: "Searched files",
  mkdir: "Created directory",
  move_file: "Moved file",
  copy_file: "Copied file",
};

const DEFAULT_SETTINGS: AgentSettings = {
  autoExecute: true,
  autoTerminalSwitch: true,
  showToolResults: true,
  persistSession: true,
};

const WELCOME_MESSAGE_AGENT: Message = {
  id: "welcome",
  role: "assistant",
  content: `**DevSpace AI Agent** - Level-S Autonomous Mode

I'm your intelligent coding assistant with full capabilities:
- Create, edit, delete files without confirmation
- Run ANY shell command (pipes, redirects, chains)
- Auto-fix errors and debug code
- Full project understanding

Just tell me what you need - I'll execute immediately.`,
  timestamp: new Date(),
};

const WELCOME_MESSAGE_CHAT: Message = {
  id: "welcome",
  role: "assistant",
  content: `**Hi! I'm your AI Assistant**

I can help you with anything you need:
- Answer questions on any topic
- Explain concepts and ideas
- Help with writing and editing
- Have a conversation
- And much more!

Feel free to ask me anything!`,
  timestamp: new Date(),
};

export default function AIChat({ currentFile, onFileChange, onSwitchToTerminal }: AIChatProps) {
  // Load settings from localStorage
  const loadSettings = (): AgentSettings => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  };

  // Load session from localStorage
  const loadSession = (): Message[] => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
      }
    } catch {}
    return [WELCOME_MESSAGE_CHAT];
  };

  // Load chat history
  const loadHistory = (): ChatSession[] => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY);
      if (saved) {
        return JSON.parse(saved).map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          messages: s.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
        }));
      }
    } catch {}
    return [];
  };

  const [messages, setMessages] = useState<Message[]>(loadSession);
  const [settings, setSettings] = useState<AgentSettings>(loadSettings);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>(loadHistory);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("groq-llama3.3-70b");
  const [apiConnected, setApiConnected] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [chatMode, setChatMode] = useState<ChatMode>("chat"); // Default to general chat mode
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Keep refs for cleanup persistence
  const messagesRef = useRef(messages);
  const settingsRef = useRef(settings);
  const chatHistoryRef = useRef(chatHistory);
  
  // Update refs when state changes
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { chatHistoryRef.current = chatHistory; }, [chatHistory]);

  const models = [
    { id: "groq-llama3.3-70b", name: "Llama 3.3 70B", provider: "Groq", description: "Fast & powerful" },
    { id: "meta-llama/llama-3.2-3b-instruct:free", name: "Llama 3.2 3B", provider: "OpenRouter", description: "Free tier" },
    { id: "meta-llama/llama-3.1-8b-instruct:free", name: "Llama 3.1 8B", provider: "OpenRouter", description: "Free tier" },
    { id: "google/gemma-2-9b-it:free", name: "Gemma 2 9B", provider: "OpenRouter", description: "Free tier" },
  ];

  // Persist messages to localStorage immediately when they change
  useEffect(() => {
    if (settings.persistSession) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch (e) {
        console.warn("Failed to persist chat messages:", e);
      }
    }
  }, [messages, settings.persistSession]);

  // Persist settings immediately
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn("Failed to persist settings:", e);
    }
  }, [settings]);

  // Persist history immediately
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(chatHistory));
    } catch (e) {
      console.warn("Failed to persist chat history:", e);
    }
  }, [chatHistory]);
  
  // Ensure state is saved before component unmounts
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (settingsRef.current.persistSession) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(messagesRef.current));
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsRef.current));
          localStorage.setItem(HISTORY_KEY, JSON.stringify(chatHistoryRef.current));
        } catch (e) {}
      }
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Save on unmount
      if (settingsRef.current.persistSession) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(messagesRef.current));
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsRef.current));
          localStorage.setItem(HISTORY_KEY, JSON.stringify(chatHistoryRef.current));
        } catch (e) {}
      }
    };
  }, []);

  useEffect(() => {
    getApiStatus().then((status) => {
      setApiConnected(status.aiConfigured);
    }).catch(() => {
      setApiConnected(false);
    });
  }, []);

  const scrollToBottom = useCallback(() => {
    // Use messagesEndRef for smooth scrolling to the bottom
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    } else if (viewportRef.current) {
      // Fallback to viewport scroll
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    // Small delay to ensure DOM is updated before scrolling
    const timer = setTimeout(() => {
      scrollToBottom();
    }, 50);
    return () => clearTimeout(timer);
  }, [messages, scrollToBottom]);

  // Also scroll when loading state changes (when AI starts responding)
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, scrollToBottom]);

  const flattenFileTree = (nodes: FileNode[], prefix = ""): string[] => {
    let result: string[] = [];
    for (const node of nodes) {
      result.push(`${prefix}${node.name}${node.type === "folder" ? "/" : ""}`);
      if (node.children) {
        result = result.concat(flattenFileTree(node.children, prefix + "  "));
      }
    }
    return result;
  };

  const updateSettings = (key: keyof AgentSettings, value: boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const togglePinMessage = (messageId: string) => {
    setMessages(prev => 
      prev.map(m => 
        m.id === messageId ? { ...m, isPinned: !m.isPinned } : m
      )
    );
  };

  const saveToHistory = () => {
    const session: ChatSession = {
      id: `session-${Date.now()}`,
      name: `Chat ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
      messages: messages.filter(m => m.id !== "welcome"),
      createdAt: new Date(),
      model: selectedModel,
    };
    if (session.messages.length > 0) {
      setChatHistory(prev => [session, ...prev.slice(0, 49)]); // Keep last 50 sessions
    }
  };

  const loadFromHistory = (session: ChatSession) => {
    const welcomeMsg = chatMode === "agent" ? WELCOME_MESSAGE_AGENT : WELCOME_MESSAGE_CHAT;
    setMessages([welcomeMsg, ...session.messages]);
    setSelectedModel(session.model);
    setShowHistory(false);
  };

  const deleteFromHistory = (sessionId: string) => {
    setChatHistory(prev => prev.filter(s => s.id !== sessionId));
  };

  const clearChat = () => {
    // Save current chat to history first
    saveToHistory();
    
    // Keep pinned messages
    const pinnedMessages = messages.filter(m => m.isPinned);
    setMessages([
      {
        id: "welcome-new",
        role: "assistant",
        content: "Chat cleared. Pinned messages preserved. How can I help you?",
        timestamp: new Date(),
      },
      ...pinnedMessages,
    ]);
  };

  const handleModeChange = (newMode: ChatMode) => {
    if (newMode !== chatMode) {
      setChatMode(newMode);
      const welcomeMsg = newMode === "agent" ? WELCOME_MESSAGE_AGENT : WELCOME_MESSAGE_CHAT;
      setMessages([
        {
          ...welcomeMsg,
          id: `welcome-${Date.now()}`,
          timestamp: new Date(),
        },
      ]);
    }
  };

  const exportChat = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      model: selectedModel,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        toolResults: m.toolResults,
      })),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `devspace-chat-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedInput,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const fileTree = await getFileTree();
      const fileList = flattenFileTree(fileTree.files);

      const context = {
        currentFile: currentFile,
        fileList: fileList,
        settings: {
          autoExecute: settings.autoExecute,
          noConfirmation: true, // Always no confirmation in Level-S mode
        },
      };

      const response = await sendChatMessage(trimmedInput, selectedModel, context, chatMode);

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.response || "",
        timestamp: new Date(),
        toolCalls: response.toolCalls,
        toolResults: response.toolResults,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Process tool results
      if (response.toolResults && response.toolResults.length > 0) {
        let hasRunCommand = false;
        
        response.toolResults.forEach((result) => {
          if (result.tool === "run_command") {
            hasRunCommand = true;
            const args = response.toolCalls?.find(t => t.tool === "run_command")?.args;
            agentConsole.emit("command", `$ ${args?.command || "unknown command"}`);
            
            const stdout = result.result?.stdout || "";
            const stderr = result.result?.stderr || result.error || "";
            
            if (stdout) {
              agentConsole.emit("output", stdout);
            }
            if (stderr) {
              agentConsole.emit("error", stderr);
            }
            if (result.success && !stdout && !stderr) {
              agentConsole.emit("info", "Command completed successfully (no output)");
            }
          } else {
            const label = TOOL_LABELS[result.tool] || result.tool;
            agentConsole.emit("info", `${label}: ${result.success ? "Success" : "Failed"}`);
          }
        });

        // Auto switch to terminal if command was run
        if (hasRunCommand && settings.autoTerminalSwitch && onSwitchToTerminal) {
          onSwitchToTerminal();
        }

        const hasFileChanges = response.toolResults.some(
          (r) => r.success && ["create_file", "edit_file", "delete_file", "append_file", "move_file", "copy_file"].includes(r.tool)
        );
        if (hasFileChanges && onFileChange) {
          onFileChange();
        }
      }
    } catch (error: any) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `Error: ${error.message}. Retrying or adjusting approach...`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderToolResults = (toolResults: ToolResult[]) => {
    if (!settings.showToolResults) return null;
    
    return (
      <div className="mt-2 space-y-2 w-full overflow-hidden">
        {toolResults.map((result, index) => {
          const Icon = TOOL_ICONS[result.tool] || Terminal;
          const label = TOOL_LABELS[result.tool] || result.tool;
          const isCommand = result.tool === "run_command";
          
          const stdout = result.result?.stdout || "";
          const stderr = result.result?.stderr || result.error || "";
          const hasOutput = isCommand && (stdout || stderr);
          
          return (
            <div
              key={index}
              className="rounded-md overflow-hidden border border-border w-full"
              data-testid={`tool-result-${result.tool}-${index}`}
            >
              <div
                className={`flex items-center gap-2 px-2 py-1.5 text-xs ${
                  result.success 
                    ? "bg-green-500/10 text-green-700 dark:text-green-400" 
                    : "bg-red-500/10 text-red-700 dark:text-red-400"
                }`}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="font-medium">{label}</span>
                {result.success ? (
                  <CheckCircle className="w-3.5 h-3.5 ml-auto flex-shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 ml-auto flex-shrink-0" />
                )}
              </div>
              
              {hasOutput && (
                <div className="bg-zinc-900 dark:bg-zinc-950 p-2 font-mono text-xs overflow-hidden w-full">
                  <div className="flex items-center gap-1 text-zinc-400 mb-1">
                    <Terminal className="w-3 h-3 shrink-0" />
                    <span>Console Output</span>
                  </div>
                  {stdout && (
                    <pre className="text-green-400 whitespace-pre-wrap break-all max-h-32 overflow-y-auto overflow-x-hidden w-full">
                      {stdout}
                    </pre>
                  )}
                  {stderr && (
                    <pre className="text-red-400 whitespace-pre-wrap break-all max-h-32 overflow-y-auto overflow-x-hidden w-full">
                      {stderr}
                    </pre>
                  )}
                </div>
              )}
              
              {!isCommand && result.error && (
                <div className="bg-red-500/5 px-2 py-1 text-xs text-red-600 dark:text-red-400 break-words overflow-hidden">
                  {result.error}
                </div>
              )}
              
              {!isCommand && typeof result.result === "string" && result.result && (
                <div className="bg-muted/30 px-2 py-1 text-xs text-muted-foreground break-words overflow-hidden">
                  {result.result}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderContent = (message: Message) => {
    const parts = message.content.split(/(```\w*\n[\s\S]*?```)/g);
    
    return (
      <>
        {parts.map((part, index) => {
          const codeMatch = part.match(/```(\w*)\n([\s\S]*?)```/);
          if (codeMatch) {
            const language = codeMatch[1] || "plaintext";
            const code = codeMatch[2].trim();
            const blockId = `${message.id}-${index}`;
            
            return (
              <div key={index} className="my-2 rounded-md overflow-hidden border border-border">
                <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border">
                  <span className="text-xs text-muted-foreground">{language}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(code, blockId)}
                    data-testid={`copy-code-${blockId}`}
                  >
                    {copiedId === blockId ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                <pre className="p-3 bg-muted/30 text-sm overflow-x-auto max-w-full">
                  <code className="font-mono text-xs break-all">{code}</code>
                </pre>
              </div>
            );
          }
          
          // Parse bold text
          const boldParsed = part.split(/\*\*(.*?)\*\*/g).map((segment, i) => {
            if (i % 2 === 1) {
              return <strong key={i}>{segment}</strong>;
            }
            return segment;
          });
          
          return (
            <span key={index} className="whitespace-pre-wrap">
              {boldParsed}
            </span>
          );
        })}
        {message.toolResults && message.toolResults.length > 0 && renderToolResults(message.toolResults)}
      </>
    );
  };

  return (
    <div className="flex flex-col h-full w-full bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-2 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          {/* Mode Toggle */}
          <div className="flex items-center bg-muted rounded-md p-0.5">
            <Button
              size="sm"
              variant={chatMode === "chat" ? "default" : "ghost"}
              className="h-6 px-2 text-xs"
              onClick={() => handleModeChange("chat")}
              data-testid="button-mode-chat"
            >
              <MessageCircle className="w-3 h-3 mr-1" />
              Chat
            </Button>
            <Button
              size="sm"
              variant={chatMode === "agent" ? "default" : "ghost"}
              className="h-6 px-2 text-xs"
              onClick={() => handleModeChange("agent")}
              data-testid="button-mode-agent"
            >
              <Code2 className="w-3 h-3 mr-1" />
              Agent
            </Button>
          </div>
          <Badge variant={apiConnected ? "default" : "destructive"} className="text-xs ml-1">
            {apiConnected ? (chatMode === "agent" ? "Level-S" : "Online") : "Offline"}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {/* Model Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 text-xs" data-testid="button-select-model">
                <Bot className="w-3 h-3 mr-1" />
                {models.find(m => m.id === selectedModel)?.name || "Select Model"}
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Select Model</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {models.map((model) => (
                <DropdownMenuItem
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  data-testid={`model-${model.id}`}
                >
                  <div className="flex flex-col">
                    <span>{model.name}</span>
                    <span className="text-xs text-muted-foreground">{model.provider} - {model.description}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* History Button */}
          <Dialog open={showHistory} onOpenChange={setShowHistory}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7" data-testid="button-history">
                <History className="w-3.5 h-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[70vh]">
              <DialogHeader>
                <DialogTitle>Chat History</DialogTitle>
              </DialogHeader>
              <ScrollArea className="h-[50vh]">
                {chatHistory.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    No chat history yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {chatHistory.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between p-2 rounded-md border border-border hover-elevate cursor-pointer"
                        onClick={() => loadFromHistory(session)}
                        data-testid={`history-${session.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{session.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {session.messages.length} messages
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFromHistory(session.id);
                          }}
                          data-testid={`delete-history-${session.id}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>

          {/* Settings Button */}
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7" data-testid="button-settings">
                <Settings2 className="w-3.5 h-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Agent Settings</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Auto Execute</div>
                    <div className="text-xs text-muted-foreground">Execute tools without confirmation</div>
                  </div>
                  <Switch
                    checked={settings.autoExecute}
                    onCheckedChange={(v) => updateSettings("autoExecute", v)}
                    data-testid="switch-auto-execute"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Auto Terminal Switch</div>
                    <div className="text-xs text-muted-foreground">Switch to terminal on command run</div>
                  </div>
                  <Switch
                    checked={settings.autoTerminalSwitch}
                    onCheckedChange={(v) => updateSettings("autoTerminalSwitch", v)}
                    data-testid="switch-auto-terminal"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Show Tool Results</div>
                    <div className="text-xs text-muted-foreground">Display tool execution results</div>
                  </div>
                  <Switch
                    checked={settings.showToolResults}
                    onCheckedChange={(v) => updateSettings("showToolResults", v)}
                    data-testid="switch-show-results"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">Persist Session</div>
                    <div className="text-xs text-muted-foreground">Keep chat on page refresh</div>
                  </div>
                  <Switch
                    checked={settings.persistSession}
                    onCheckedChange={(v) => updateSettings("persistSession", v)}
                    data-testid="switch-persist-session"
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Export Button */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={exportChat}
            data-testid="button-export-chat"
          >
            <Download className="w-3.5 h-3.5" />
          </Button>

          {/* Clear Button */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={clearChat}
            data-testid="button-clear-chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0 w-full overflow-hidden" ref={scrollRef} viewportRef={viewportRef}>
        <div className="p-3 space-y-4 w-full overflow-hidden">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 w-full overflow-hidden ${
                message.role === "user" ? "justify-end" : "justify-start"
              } ${message.isPinned ? "bg-yellow-500/5 py-2 rounded-md" : ""}`}
              data-testid={`message-${message.id}`}
            >
              {message.role === "assistant" && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[calc(100%-3rem)] rounded-lg px-3 py-2 relative group overflow-hidden break-words ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {/* Pin Button */}
                <button
                  onClick={() => togglePinMessage(message.id)}
                  className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border rounded-full p-1"
                  data-testid={`pin-message-${message.id}`}
                >
                  {message.isPinned ? (
                    <PinOff className="w-3 h-3 text-yellow-500" />
                  ) : (
                    <Pin className="w-3 h-3 text-muted-foreground" />
                  )}
                </button>
                
                <div className="text-sm break-words overflow-hidden">{renderContent(message)}</div>
                <div className="flex items-center gap-2 text-xs opacity-60 mt-1">
                  {message.isPinned && <Pin className="w-3 h-3 text-yellow-500" />}
                  <span>
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
              {message.role === "user" && (
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2 items-start w-full overflow-hidden">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 max-w-[calc(100%-3rem)]">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Executing...</span>
                </div>
              </div>
            </div>
          )}
          {/* Anchor for auto-scroll to bottom */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border shrink-0 w-full overflow-hidden">
        {currentFile && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1 bg-muted/50 rounded-md text-xs text-muted-foreground overflow-hidden">
            <FileCode className="w-3 h-3 shrink-0" />
            <span className="truncate">Context: {currentFile.path}</span>
          </div>
        )}
        <div className="flex gap-2 w-full">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell me what to do..."
            className="min-h-[40px] max-h-32 resize-none flex-1 min-w-0"
            rows={1}
            data-testid="chat-input"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            data-testid="button-send-message"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <div className="text-xs text-muted-foreground mt-2 text-center">
          {chatMode === "agent" ? "Agent Mode: Execute code & commands" : "Chat Mode: Ask anything"}
        </div>
      </div>
    </div>
  );
}
