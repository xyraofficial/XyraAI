import { useState, useCallback, useEffect } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import {
  PanelLeft,
  PanelRight,
  PanelBottom,
  Package,
  Sparkles,
  Settings,
  Moon,
  Sun,
  RefreshCw,
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

interface OpenFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  isDirty: boolean;
}

export default function IDELayout() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<"ai" | "packages">("ai");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
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
        // Close the file if it's open
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
        // Update open file if renamed
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
                onClick={loadFileTree}
                data-testid="refresh-files"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh Files</TooltipContent>
          </Tooltip>

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
                  onCreateFile={(parentPath, name) => handleCreateFile(parentPath, name)}
                  onCreateFolder={(parentPath, name) => handleCreateFolder(parentPath, name)}
                  onDelete={(path) => handleDelete(path)}
                  onRename={(oldPath, newName) => handleRename(oldPath, newName)}
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
                    {rightPanelTab === "ai" ? (
                      <AIChat 
                        currentFile={activeFileId ? openFiles.find(f => f.id === activeFileId) : undefined}
                        onFileChange={handleAIFileChange}
                      />
                    ) : <PackageManager />}
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
