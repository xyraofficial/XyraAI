import { useState, useCallback } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PanelLeft,
  PanelRight,
  PanelBottom,
  Terminal as TerminalIcon,
  Package,
  Sparkles,
  FolderTree,
  Settings,
  Moon,
  Sun,
} from "lucide-react";
import FileTree, { type FileNode } from "./FileTree";
import CodeEditor from "./CodeEditor";
import Terminal from "./Terminal";
import AIChat from "./AIChat";
import PackageManager from "./PackageManager";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// todo: remove mock functionality
const initialFiles: FileNode[] = [
  {
    id: "1",
    name: "src",
    type: "folder",
    children: [
      {
        id: "2",
        name: "components",
        type: "folder",
        children: [
          { id: "3", name: "App.tsx", type: "file", extension: "tsx" },
          { id: "4", name: "Header.tsx", type: "file", extension: "tsx" },
          { id: "5", name: "Footer.tsx", type: "file", extension: "tsx" },
        ],
      },
      { id: "6", name: "index.tsx", type: "file", extension: "tsx" },
      { id: "7", name: "styles.css", type: "file", extension: "css" },
      { id: "8", name: "utils.ts", type: "file", extension: "ts" },
    ],
  },
  {
    id: "9",
    name: "public",
    type: "folder",
    children: [
      { id: "10", name: "index.html", type: "file", extension: "html" },
      { id: "11", name: "favicon.ico", type: "file" },
    ],
  },
  { id: "12", name: "package.json", type: "file", extension: "json" },
  { id: "13", name: "tsconfig.json", type: "file", extension: "json" },
  { id: "14", name: "README.md", type: "file", extension: "md" },
];

const mockFileContents: Record<string, string> = {
  "3": `import { useState } from 'react';
import Header from './Header';
import Footer from './Footer';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 p-4">
        <h1>Welcome to DevSpace</h1>
        <button onClick={() => setCount(c => c + 1)}>
          Count: {count}
        </button>
      </main>
      <Footer />
    </div>
  );
}`,
  "4": `export default function Header() {
  return (
    <header className="bg-primary text-white p-4">
      <nav className="flex items-center justify-between">
        <h1 className="text-xl font-bold">DevSpace</h1>
        <ul className="flex gap-4">
          <li><a href="/">Home</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/contact">Contact</a></li>
        </ul>
      </nav>
    </header>
  );
}`,
  "7": `/* Main styles */
body {
  margin: 0;
  padding: 0;
  font-family: system-ui, sans-serif;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;
  background: #8B5CF6;
  color: white;
  border: none;
  cursor: pointer;
}

.btn:hover {
  background: #7C3AED;
}`,
  "12": `{
  "name": "devspace-project",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}`,
};

interface OpenFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  isDirty: boolean;
}

export default function IDELayout() {
  const [files, setFiles] = useState<FileNode[]>(initialFiles);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<"ai" | "packages">("ai");
  const [isDarkMode, setIsDarkMode] = useState(true);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle("dark", !isDarkMode);
  };

  const getFilePath = (fileId: string, nodes: FileNode[], path: string = ""): string => {
    for (const node of nodes) {
      const currentPath = path ? `${path}/${node.name}` : node.name;
      if (node.id === fileId) return currentPath;
      if (node.children) {
        const found = getFilePath(fileId, node.children, currentPath);
        if (found) return found;
      }
    }
    return "";
  };

  const getLanguage = (filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      html: "html",
      css: "css",
      json: "json",
      md: "markdown",
      py: "python",
    };
    return langMap[ext || ""] || "plaintext";
  };

  const handleFileSelect = useCallback(
    (file: FileNode) => {
      if (file.type === "folder") return;

      const existing = openFiles.find((f) => f.id === file.id);
      if (existing) {
        setActiveFileId(file.id);
        return;
      }

      const content = mockFileContents[file.id] || `// ${file.name}\n`;
      const newFile: OpenFile = {
        id: file.id,
        name: file.name,
        path: getFilePath(file.id, files),
        content,
        language: getLanguage(file.name),
        isDirty: false,
      };

      setOpenFiles((prev) => [...prev, newFile]);
      setActiveFileId(file.id);
    },
    [openFiles, files]
  );

  const handleFileChange = useCallback((fileId: string, content: string) => {
    setOpenFiles((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, content, isDirty: true } : f
      )
    );
  }, []);

  const handleFileSave = useCallback((fileId: string) => {
    setOpenFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, isDirty: false } : f))
    );
    console.log(`File saved: ${fileId}`);
  }, []);

  const handleFileClose = useCallback(
    (fileId: string) => {
      setOpenFiles((prev) => prev.filter((f) => f.id !== fileId));
      if (activeFileId === fileId) {
        const remaining = openFiles.filter((f) => f.id !== fileId);
        setActiveFileId(remaining.length > 0 ? remaining[remaining.length - 1].id : null);
      }
    },
    [activeFileId, openFiles]
  );

  const handleCreateFile = useCallback(
    (parentId: string | null, name: string) => {
      const newId = `new-${Date.now()}`;
      const extension = name.split(".").pop() || "";
      const newFile: FileNode = {
        id: newId,
        name,
        type: "file",
        extension,
      };

      if (parentId === null) {
        setFiles((prev) => [...prev, newFile]);
      } else {
        const addToParent = (nodes: FileNode[]): FileNode[] => {
          return nodes.map((node) => {
            if (node.id === parentId && node.type === "folder") {
              return {
                ...node,
                children: [...(node.children || []), newFile],
              };
            }
            if (node.children) {
              return { ...node, children: addToParent(node.children) };
            }
            return node;
          });
        };
        setFiles(addToParent);
      }
    },
    []
  );

  const handleCreateFolder = useCallback(
    (parentId: string | null, name: string) => {
      const newFolder: FileNode = {
        id: `folder-${Date.now()}`,
        name,
        type: "folder",
        children: [],
      };

      if (parentId === null) {
        setFiles((prev) => [...prev, newFolder]);
      } else {
        const addToParent = (nodes: FileNode[]): FileNode[] => {
          return nodes.map((node) => {
            if (node.id === parentId && node.type === "folder") {
              return {
                ...node,
                children: [...(node.children || []), newFolder],
              };
            }
            if (node.children) {
              return { ...node, children: addToParent(node.children) };
            }
            return node;
          });
        };
        setFiles(addToParent);
      }
    },
    []
  );

  const handleDelete = useCallback((id: string) => {
    const removeNode = (nodes: FileNode[]): FileNode[] => {
      return nodes
        .filter((node) => node.id !== id)
        .map((node) => ({
          ...node,
          children: node.children ? removeNode(node.children) : undefined,
        }));
    };
    setFiles(removeNode);
    setOpenFiles((prev) => prev.filter((f) => f.id !== id));
    if (activeFileId === id) {
      setActiveFileId(null);
    }
  }, [activeFileId]);

  const handleRename = useCallback((id: string, newName: string) => {
    const renameNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((node) => {
        if (node.id === id) {
          const extension = newName.split(".").pop();
          return { ...node, name: newName, extension };
        }
        if (node.children) {
          return { ...node, children: renameNode(node.children) };
        }
        return node;
      });
    };
    setFiles(renameNode);
    setOpenFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: newName } : f))
    );
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">DS</span>
            </div>
            <span className="font-semibold text-lg">DevSpace</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
                data-testid="toggle-left-panel"
              >
                <PanelLeft className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle File Explorer</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setBottomPanelCollapsed(!bottomPanelCollapsed)}
                data-testid="toggle-bottom-panel"
              >
                <PanelBottom className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Terminal</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
                data-testid="toggle-right-panel"
              >
                <PanelRight className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle AI & Packages</TooltipContent>
          </Tooltip>

          <div className="w-px h-6 bg-border mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleDarkMode}
                data-testid="toggle-theme"
              >
                {isDarkMode ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Toggle Theme</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost" data-testid="button-settings">
                <Settings className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {!leftPanelCollapsed && (
            <>
              <ResizablePanel defaultSize={18} minSize={12} maxSize={30}>
                <FileTree
                  files={files}
                  onFileSelect={handleFileSelect}
                  onCreateFile={handleCreateFile}
                  onCreateFolder={handleCreateFolder}
                  onDelete={handleDelete}
                  onRename={handleRename}
                  selectedFileId={activeFileId || undefined}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
            </>
          )}

          <ResizablePanel defaultSize={rightPanelCollapsed ? 82 : 57}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={bottomPanelCollapsed ? 100 : 70}>
                <CodeEditor
                  openFiles={openFiles}
                  activeFileId={activeFileId}
                  onFileChange={handleFileChange}
                  onFileSave={handleFileSave}
                  onFileClose={handleFileClose}
                  onTabSelect={setActiveFileId}
                />
              </ResizablePanel>
              {!bottomPanelCollapsed && (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={30} minSize={15} maxSize={50}>
                    <Terminal />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>

          {!rightPanelCollapsed && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
                <div className="h-full flex flex-col">
                  <div className="flex items-center gap-1 p-1 border-b border-border bg-background/50">
                    <Button
                      size="sm"
                      variant={rightPanelTab === "ai" ? "secondary" : "ghost"}
                      className="flex-1 h-8"
                      onClick={() => setRightPanelTab("ai")}
                      data-testid="tab-ai-assistant"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      AI Assistant
                    </Button>
                    <Button
                      size="sm"
                      variant={rightPanelTab === "packages" ? "secondary" : "ghost"}
                      className="flex-1 h-8"
                      onClick={() => setRightPanelTab("packages")}
                      data-testid="tab-packages"
                    >
                      <Package className="w-3.5 h-3.5 mr-1.5" />
                      Packages
                    </Button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {rightPanelTab === "ai" ? <AIChat /> : <PackageManager />}
                  </div>
                </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
