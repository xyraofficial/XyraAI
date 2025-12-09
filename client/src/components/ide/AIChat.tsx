import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, Sparkles, Copy, Check, Trash2, FileCode, Terminal, FolderOpen, Pencil, Trash, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { sendChatMessage, getApiStatus, getFileTree, readFile, type ToolCall, type ToolResult, type FileNode } from "@/lib/api";
import { agentConsole } from "@/lib/agentConsole";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

interface AIChatProps {
  currentFile?: {
    path: string;
    content: string;
  };
  onFileChange?: () => void;
}

const TOOL_ICONS: Record<string, typeof FileCode> = {
  create_file: FileCode,
  edit_file: Pencil,
  read_file: FolderOpen,
  delete_file: Trash,
  run_command: Terminal,
  list_files: FolderOpen,
};

const TOOL_LABELS: Record<string, string> = {
  create_file: "Created file",
  edit_file: "Edited file",
  read_file: "Read file",
  delete_file: "Deleted file",
  run_command: "Ran command",
  list_files: "Listed files",
};

export default function AIChat({ currentFile, onFileChange }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm DevSpace AI, your intelligent coding assistant. I can help you:\n\n- Create and edit files\n- Fix code errors\n- Run terminal commands\n- Debug and explain code\n\nJust tell me what you need!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState("meta-llama/llama-3.2-3b-instruct:free");
  const [apiConnected, setApiConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const models = [
    { id: "meta-llama/llama-3.2-3b-instruct:free", name: "Llama 3.2 3B (Free)", provider: "Meta" },
    { id: "meta-llama/llama-3.1-8b-instruct:free", name: "Llama 3.1 8B (Free)", provider: "Meta" },
    { id: "google/gemma-2-9b-it:free", name: "Gemma 2 9B (Free)", provider: "Google" },
    { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic" },
    { id: "openai/gpt-4-turbo", name: "GPT-4 Turbo", provider: "OpenAI" },
  ];

  useEffect(() => {
    getApiStatus().then((status) => {
      setApiConnected(status.aiConfigured);
    }).catch(() => {
      setApiConnected(false);
    });
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

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
      };

      const response = await sendChatMessage(trimmedInput, selectedModel, context);

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.response || "",
        timestamp: new Date(),
        toolCalls: response.toolCalls,
        toolResults: response.toolResults,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (response.toolResults && response.toolResults.length > 0) {
        response.toolResults.forEach((result) => {
          if (result.tool === "run_command") {
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

        const hasFileChanges = response.toolResults.some(
          (r) => r.success && ["create_file", "edit_file", "delete_file"].includes(r.tool)
        );
        if (hasFileChanges && onFileChange) {
          onFileChange();
        }
      }
    } catch (error: any) {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
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

  const clearChat = () => {
    setMessages([
      {
        id: "welcome-new",
        role: "assistant",
        content: "Chat cleared. How can I help you?",
        timestamp: new Date(),
      },
    ]);
  };

  const renderToolResults = (toolResults: ToolResult[]) => {
    return (
      <div className="mt-2 space-y-2">
        {toolResults.map((result, index) => {
          const Icon = TOOL_ICONS[result.tool] || Terminal;
          const label = TOOL_LABELS[result.tool] || result.tool;
          const isCommand = result.tool === "run_command";
          
          // Extract stdout/stderr for command results
          const stdout = result.result?.stdout || "";
          const stderr = result.result?.stderr || result.error || "";
          const hasOutput = isCommand && (stdout || stderr);
          
          return (
            <div
              key={index}
              className="rounded-md overflow-hidden border border-border"
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
                <div className="bg-zinc-900 dark:bg-zinc-950 p-2 font-mono text-xs">
                  <div className="flex items-center gap-1 text-zinc-400 mb-1">
                    <Terminal className="w-3 h-3" />
                    <span>Console Output</span>
                  </div>
                  {stdout && (
                    <pre className="text-green-400 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                      {stdout}
                    </pre>
                  )}
                  {stderr && (
                    <pre className="text-red-400 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                      {stderr}
                    </pre>
                  )}
                </div>
              )}
              
              {!isCommand && result.error && (
                <div className="bg-red-500/5 px-2 py-1 text-xs text-red-600 dark:text-red-400">
                  {result.error}
                </div>
              )}
              
              {!isCommand && typeof result.result === "string" && result.result && (
                <div className="bg-muted/30 px-2 py-1 text-xs text-muted-foreground truncate">
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
                <pre className="p-3 bg-muted/30 text-sm overflow-x-auto">
                  <code className="font-mono">{code}</code>
                </pre>
              </div>
            );
          }
          return (
            <span key={index} className="whitespace-pre-wrap">
              {part}
            </span>
          );
        })}
        {message.toolResults && message.toolResults.length > 0 && renderToolResults(message.toolResults)}
      </>
    );
  };

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">AI Agent</span>
          <Badge variant={apiConnected ? "default" : "destructive"} className="text-xs">
            {apiConnected ? "Connected" : "Not Configured"}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 text-xs" data-testid="button-select-model">
                <Bot className="w-3 h-3 mr-1" />
                {models.find(m => m.id === selectedModel)?.name || "Select Model"}
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
                    <span className="text-xs text-muted-foreground">{model.provider}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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

      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-3 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
              data-testid={`message-${message.id}`}
            >
              {message.role === "assistant" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <div className="text-sm">{renderContent(message)}</div>
                <div className="text-xs opacity-60 mt-1">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              {message.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border">
        {currentFile && (
          <div className="flex items-center gap-2 mb-2 px-2 py-1 bg-muted/50 rounded-md text-xs text-muted-foreground">
            <FileCode className="w-3 h-3" />
            <span>Context: {currentFile.path}</span>
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me to create, edit, or fix files..."
            className="min-h-[40px] max-h-32 resize-none"
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
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
