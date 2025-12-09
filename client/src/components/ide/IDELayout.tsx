import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  FolderTree,
  Code,
  Terminal as TerminalIcon,
  Sparkles,
  Package,
  Settings,
  Moon,
  Sun,
  RefreshCw,
  Menu,
} from "lucide-react";
import FileTree, { type FileNode } from "./FileTree";
import CodeEditor, { getLanguageFromExtension } from "./CodeEditor";
import Terminal from "./Terminal";
import AIChat from "./AIChat";
import PackageManager from "./PackageManager";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  getFileTree,
  readFile,
  writeFile,
  createFolder,
  deleteFile,
  renameFile,
  type FileNode as ApiFileNode,
} from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

interface OpenFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  isDirty: boolean;
}

type ActiveTab = "files" | "editor" | "terminal" | "ai" | "packages";

export default function IDELayout() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("editor");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const { toast } = useToast();

  const loadFileTree = useCallback(async () => {
    try {
      setIsLoading(true);
      const { files: apiFiles } = await getFileTree();
      setFiles(apiFiles);
    } catch (error: any) {
      toast({
        title: "Error loading files",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const refreshOpenFiles = useCallback(async () => {
    if (openFiles.length === 0) return;
    
    const updatedFiles = await Promise.all(
      openFiles.map(async (file) => {
        try {
          const { content } = await readFile(file.path);
          return { ...file, content, isDirty: false };
        } catch {
          return file;
        }
      })
    );
    setOpenFiles(updatedFiles);
  }, [openFiles]);

  const handleAIFileChange = useCallback(async () => {
    await loadFileTree();
    await refreshOpenFiles();
  }, [loadFileTree, refreshOpenFiles]);

  useEffect(() => {
    loadFileTree();
  }, [loadFileTree]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle("dark", !isDarkMode);
  };

  const handleFileSelect = useCallback(
    async (file: FileNode) => {
      if (file.type === "folder") return;

      const existing = openFiles.find((f) => f.id === file.id);
      if (existing) {
        setActiveFileId(file.id);
        setActiveTab("editor");
        return;
      }

      try {
        const { content } = await readFile(file.path);
        const newFile: OpenFile = {
          id: file.id,
          name: file.name,
          path: file.path,
          content,
          language: getLanguageFromExtension(file.name),
          isDirty: false,
        };

        setOpenFiles((prev) => [...prev, newFile]);
        setActiveFileId(file.id);
        setActiveTab("editor");
      } catch (error: any) {
        toast({
          title: "Error opening file",
          description: error.message,
          variant: "destructive",
        });
      }
    },
    [openFiles, toast]
  );

  const handleFileChange = useCallback((fileId: string, content: string) => {
    setOpenFiles((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, content, isDirty: true } : f
      )
    );
  }, []);

  const handleFileSave = useCallback(async (fileId: string) => {
    const file = openFiles.find((f) => f.id === fileId);
    if (!file) return;

    try {
      await writeFile(file.path, file.content);
      setOpenFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, isDirty: false } : f))
      );
      toast({
        title: "File saved",
        description: file.name,
      });
    } catch (error: any) {
      toast({
        title: "Error saving file",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [openFiles, toast]);

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
    async (parentPath: string | null, name: string) => {
      try {
        const filePath = parentPath ? `${parentPath}/${name}` : name;
        await writeFile(filePath, "");
        await loadFileTree();
        toast({
          title: "File created",
          description: name,
        });
      } catch (error: any) {
        toast({
          title: "Error creating file",
          description: error.message,
          variant: "destructive",
        });
      }
    },
    [loadFileTree, toast]
  );

  const handleCreateFolder = useCallback(
    async (parentPath: string | null, name: string) => {
      try {
        const folderPath = parentPath ? `${parentPath}/${name}` : name;
        await createFolder(folderPath);
        await loadFileTree();
        toast({
          title: "Folder created",
          description: name,
        });
      } catch (error: any) {
        toast({
          title: "Error creating folder",
          description: error.message,
          variant: "destructive",
        });
      }
    },
    [loadFileTree, toast]
  );

  const handleDelete = useCallback(
    async (filePath: string) => {
      try {
        await deleteFile(filePath);
        await loadFileTree();
        const fileToClose = openFiles.find((f) => f.path === filePath);
        if (fileToClose) {
          handleFileClose(fileToClose.id);
        }
        toast({
          title: "Deleted",
          description: filePath,
        });
      } catch (error: any) {
        toast({
          title: "Error deleting",
          description: error.message,
          variant: "destructive",
        });
      }
    },
    [loadFileTree, openFiles, handleFileClose, toast]
  );

  const handleRename = useCallback(
    async (oldPath: string, newName: string) => {
      try {
        const parts = oldPath.split("/");
        parts[parts.length - 1] = newName;
        const newPath = parts.join("/");
        await renameFile(oldPath, newPath);
        await loadFileTree();
        setOpenFiles((prev) =>
          prev.map((f) =>
            f.path === oldPath ? { ...f, name: newName, path: newPath } : f
          )
        );
        toast({
          title: "Renamed",
          description: `${oldPath} → ${newPath}`,
        });
      } catch (error: any) {
        toast({
          title: "Error renaming",
          description: error.message,
          variant: "destructive",
        });
      }
    },
    [loadFileTree, toast]
  );

  const renderContent = () => {
    switch (activeTab) {
      case "files":
        return (
          <div className="h-full">
            <FileTree
              files={files}
              onFileSelect={handleFileSelect}
              onCreateFile={(parentPath, name) => handleCreateFile(parentPath, name)}
              onCreateFolder={(parentPath, name) => handleCreateFolder(parentPath, name)}
              onDelete={(path) => handleDelete(path)}
              onRename={(oldPath, newName) => handleRename(oldPath, newName)}
              selectedFileId={activeFileId || undefined}
            />
          </div>
        );
      case "editor":
        return (
          <CodeEditor
            openFiles={openFiles}
            activeFileId={activeFileId}
            onFileChange={handleFileChange}
            onFileSave={handleFileSave}
            onFileClose={handleFileClose}
            onTabSelect={setActiveFileId}
          />
        );
      case "terminal":
        return <Terminal />;
      case "ai":
        return (
          <AIChat 
            currentFile={activeFileId ? openFiles.find(f => f.id === activeFileId) : undefined}
            onFileChange={handleAIFileChange}
          />
        );
      case "packages":
        return <PackageManager />;
    }
  };

  const tabs: { id: ActiveTab; icon: React.ReactNode; label: string }[] = [
    { id: "files", icon: <FolderTree className="w-5 h-5" />, label: "Files" },
    { id: "editor", icon: <Code className="w-5 h-5" />, label: "Editor" },
    { id: "terminal", icon: <TerminalIcon className="w-5 h-5" />, label: "Terminal" },
    { id: "ai", icon: <Sparkles className="w-5 h-5" />, label: "AI" },
    { id: "packages", icon: <Package className="w-5 h-5" />, label: "Packages" },
  ];

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border bg-card shrink-0 safe-area-top">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">DS</span>
          </div>
          <span className="font-semibold text-base">DevSpace</span>
        </div>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={loadFileTree}
                className="h-8 w-8"
                data-testid="refresh-files"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh Files</TooltipContent>
          </Tooltip>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <Menu className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[250px] p-4">
              <div className="flex flex-col gap-4 mt-6">
                <h3 className="font-semibold text-lg">Settings</h3>
                <Button
                  variant="ghost"
                  className="justify-start gap-3"
                  onClick={() => {
                    toggleDarkMode();
                    setMenuOpen(false);
                  }}
                >
                  {isDarkMode ? (
                    <Sun className="w-5 h-5" />
                  ) : (
                    <Moon className="w-5 h-5" />
                  )}
                  {isDarkMode ? "Light Mode" : "Dark Mode"}
                </Button>
                <Button
                  variant="ghost"
                  className="justify-start gap-3"
                  onClick={() => setMenuOpen(false)}
                >
                  <Settings className="w-5 h-5" />
                  Settings
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>

      <nav className="flex items-center justify-around border-t border-border bg-card py-3 shrink-0 safe-area-bottom">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`nav-${tab.id}`}
            className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-xl transition-colors min-w-[64px] active:scale-95 ${
              activeTab === tab.id
                ? "text-primary bg-primary/10"
                : "text-muted-foreground active:text-foreground"
            }`}
          >
            {tab.icon}
            <span className="text-[11px] font-medium">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
