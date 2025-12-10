import { useState, useRef, useEffect } from "react";
import { 
  ChevronRight, 
  ChevronDown, 
  File, 
  Folder, 
  FolderOpen,
  Upload,
  Download,
  MoreHorizontal,
  Trash2,
  Edit3,
  FilePlus,
  FolderPlus,
  FileCode,
  FileJson,
  FileText,
  Image,
  FileType,
  Settings,
  X
} from "lucide-react";
import { 
  SiPython, 
  SiJavascript, 
  SiTypescript, 
  SiHtml5, 
  SiCss3, 
  SiReact, 
  SiMarkdown, 
  SiGit,
  SiNodedotjs,
  SiJson,
  SiYaml
} from "react-icons/si";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export interface FileNode {
  id: string;
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
  extension?: string;
}

interface FileTreeProps {
  files: FileNode[];
  onFileSelect: (file: FileNode) => void;
  onCreateFile?: (parentPath: string | null, name: string) => void;
  onCreateFolder?: (parentPath: string | null, name: string) => void;
  onDelete?: (path: string) => void;
  onRename?: (path: string, newName: string) => void;
  onUpload?: (files: FileList) => void;
  onDownloadAll?: () => void;
  selectedFileId?: string;
}

const getFileIcon = (name: string, extension?: string) => {
  const iconClass = "w-4 h-4 flex-shrink-0";
  
  // Check for specific files first
  if (name === "package.json" || name === "package-lock.json") {
    return <SiNodedotjs className={`${iconClass} text-green-500`} />;
  }
  if (name === ".gitignore" || name === ".git") {
    return <SiGit className={`${iconClass} text-orange-500`} />;
  }
  if (name === "tsconfig.json" || name === "jsconfig.json") {
    return <SiTypescript className={`${iconClass} text-blue-500`} />;
  }
  if (name === "vite.config.ts" || name === "vite.config.js") {
    return <Settings className={`${iconClass} text-purple-500`} />;
  }
  if (name === ".env" || name.startsWith(".env.")) {
    return <Settings className={`${iconClass} text-yellow-500`} />;
  }

  // Extension-based icons
  switch (extension?.toLowerCase()) {
    case "py":
    case "pyw":
    case "pyx":
      return <SiPython className={`${iconClass} text-yellow-400`} />;
    case "js":
      return <SiJavascript className={`${iconClass} text-yellow-400`} />;
    case "jsx":
      return <SiReact className={`${iconClass} text-cyan-400`} />;
    case "ts":
      return <SiTypescript className={`${iconClass} text-blue-500`} />;
    case "tsx":
      return <SiReact className={`${iconClass} text-blue-400`} />;
    case "html":
    case "htm":
      return <SiHtml5 className={`${iconClass} text-orange-500`} />;
    case "css":
    case "scss":
    case "sass":
    case "less":
      return <SiCss3 className={`${iconClass} text-blue-400`} />;
    case "json":
      return <SiJson className={`${iconClass} text-yellow-500`} />;
    case "md":
    case "mdx":
      return <SiMarkdown className={`${iconClass} text-gray-400`} />;
    case "yaml":
    case "yml":
      return <SiYaml className={`${iconClass} text-red-400`} />;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
    case "ico":
      return <Image className={`${iconClass} text-green-400`} />;
    case "txt":
      return <FileText className={`${iconClass} text-gray-400`} />;
    case "sh":
    case "bash":
    case "zsh":
      return <FileCode className={`${iconClass} text-green-400`} />;
    case "xml":
      return <FileCode className={`${iconClass} text-orange-400`} />;
    case "sql":
      return <FileCode className={`${iconClass} text-blue-300`} />;
    case "java":
      return <FileCode className={`${iconClass} text-red-500`} />;
    case "c":
    case "cpp":
    case "h":
    case "hpp":
      return <FileCode className={`${iconClass} text-blue-600`} />;
    case "go":
      return <FileCode className={`${iconClass} text-cyan-500`} />;
    case "rs":
      return <FileCode className={`${iconClass} text-orange-600`} />;
    case "rb":
      return <FileCode className={`${iconClass} text-red-400`} />;
    case "php":
      return <FileCode className={`${iconClass} text-purple-500`} />;
    default:
      return <File className={`${iconClass} text-muted-foreground`} />;
  }
};

interface TreeItemProps {
  node: FileNode;
  depth: number;
  onFileSelect: (file: FileNode) => void;
  onDelete?: (path: string) => void;
  onRename?: (path: string, newName: string) => void;
  onOpenCreateDialog?: (type: "file" | "folder", parentPath: string) => void;
  selectedFileId?: string;
}

function TreeItem({ 
  node, 
  depth, 
  onFileSelect, 
  onDelete, 
  onRename,
  onOpenCreateDialog,
  selectedFileId 
}: TreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(depth === 0);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(node.name);
  const isSelected = node.id === selectedFileId;

  const handleClick = () => {
    if (node.type === "folder") {
      setIsExpanded(!isExpanded);
    } else {
      onFileSelect(node);
    }
  };

  const handleRename = () => {
    if (newName.trim() && newName !== node.name) {
      onRename?.(node.path, newName.trim());
    }
    setIsRenaming(false);
    setNewName(node.name);
  };

  const handleStartRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNewName(node.name);
    setIsRenaming(true);
  };

  const contextMenuItems = (
    <>
      {node.type === "folder" && (
        <>
          <ContextMenuItem 
            onClick={() => onOpenCreateDialog?.("file", node.path)}
            data-testid={`context-new-file-${node.id}`}
          >
            <FilePlus className="w-4 h-4 mr-2" />
            New File
          </ContextMenuItem>
          <ContextMenuItem 
            onClick={() => onOpenCreateDialog?.("folder", node.path)}
            data-testid={`context-new-folder-${node.id}`}
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            New Folder
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuItem 
        onClick={handleStartRename}
        data-testid={`context-rename-${node.id}`}
      >
        <Edit3 className="w-4 h-4 mr-2" />
        Rename
      </ContextMenuItem>
      <ContextMenuItem 
        onClick={() => onDelete?.(node.path)}
        className="text-destructive"
        data-testid={`context-delete-${node.id}`}
      >
        <Trash2 className="w-4 h-4 mr-2" />
        Delete
      </ContextMenuItem>
    </>
  );

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className={`flex items-center gap-1 py-1 px-2 cursor-pointer hover-elevate rounded-sm group ${
              isSelected ? "bg-sidebar-accent" : ""
            }`}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            onClick={handleClick}
            data-testid={`file-item-${node.id}`}
          >
            {node.type === "folder" ? (
              <>
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                )}
                {isExpanded ? (
                  <FolderOpen className="w-4 h-4 flex-shrink-0 text-yellow-500" />
                ) : (
                  <Folder className="w-4 h-4 flex-shrink-0 text-yellow-500" />
                )}
              </>
            ) : (
              <>
                <span className="w-4" />
                {getFileIcon(node.name, node.extension)}
              </>
            )}
            {isRenaming ? (
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") {
                    setIsRenaming(false);
                    setNewName(node.name);
                  }
                }}
                className="h-5 py-0 px-1 text-sm"
                autoFocus
                onClick={(e) => e.stopPropagation()}
                data-testid={`rename-input-${node.id}`}
              />
            ) : (
              <span className="text-sm truncate flex-1">{node.name}</span>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>{contextMenuItems}</ContextMenuContent>
      </ContextMenu>
      {node.type === "folder" && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onFileSelect={onFileSelect}
              onDelete={onDelete}
              onRename={onRename}
              onOpenCreateDialog={onOpenCreateDialog}
              selectedFileId={selectedFileId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({
  files,
  onFileSelect,
  onCreateFile,
  onCreateFolder,
  onDelete,
  onRename,
  onUpload,
  onDownloadAll,
  selectedFileId,
}: FileTreeProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createType, setCreateType] = useState<"file" | "folder">("file");
  const [createParentPath, setCreateParentPath] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");

  useEffect(() => {
    if (createDialogOpen && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [createDialogOpen]);

  const openCreateDialog = (type: "file" | "folder", parentPath: string | null) => {
    setCreateType(type);
    setCreateParentPath(parentPath);
    setCreateName(type === "file" ? "untitled.txt" : "new-folder");
    setCreateDialogOpen(true);
  };

  const handleCreateSubmit = () => {
    const trimmedName = createName.trim();
    if (!trimmedName) {
      toast({
        title: "Name required",
        description: "Please enter a name for the " + createType,
        variant: "destructive",
      });
      return;
    }
    if (createType === "file") {
      onCreateFile?.(createParentPath, trimmedName);
    } else {
      onCreateFolder?.(createParentPath, trimmedName);
    }
    setCreateDialogOpen(false);
    setCreateName("");
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (onUpload) {
      onUpload(files);
    } else {
      // Default upload behavior - upload each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const content = reader.result as string;
            const response = await fetch("/api/files/write", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: file.name, content }),
            });
            if (response.ok) {
              toast({
                title: "File uploaded",
                description: file.name,
              });
              // Refresh will happen through parent component
              window.location.reload();
            }
          } catch (error: any) {
            toast({
              title: "Upload failed",
              description: error.message,
              variant: "destructive",
            });
          }
        };
        reader.readAsText(file);
      }
    }
    e.target.value = "";
  };

  const handleDownloadAll = async () => {
    if (onDownloadAll) {
      onDownloadAll();
    } else {
      try {
        const response = await fetch("/api/files/download-all");
        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "workspace.zip";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast({
            title: "Download started",
            description: "Your files are being downloaded as a zip",
          });
        } else {
          throw new Error("Download failed");
        }
      } catch (error: any) {
        toast({
          title: "Download failed",
          description: error.message || "Could not download files",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
        data-testid="file-upload-input"
      />
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-sidebar-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => openCreateDialog("file", null)}
            data-testid="button-new-file"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => openCreateDialog("folder", null)}
            data-testid="button-new-folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                data-testid="button-file-menu"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleUploadClick} data-testid="menu-upload">
                <Upload className="w-4 h-4 mr-2" />
                Upload Files
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadAll} data-testid="menu-download">
                <Download className="w-4 h-4 mr-2" />
                Download All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="py-2">
          {files.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground text-center">
              <p>No files yet</p>
              <p className="text-xs mt-1">Create a file or use terminal</p>
            </div>
          ) : (
            files.map((node) => (
              <TreeItem
                key={node.id}
                node={node}
                depth={0}
                onFileSelect={onFileSelect}
                onDelete={onDelete}
                onRename={onRename}
                onOpenCreateDialog={openCreateDialog}
                selectedFileId={selectedFileId}
              />
            ))
          )}
        </div>
      </ScrollArea>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {createType === "file" ? "Create New File" : "Create New Folder"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              ref={nameInputRef}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateSubmit();
                if (e.key === "Escape") setCreateDialogOpen(false);
              }}
              placeholder={createType === "file" ? "filename.txt" : "folder-name"}
              data-testid="input-create-name"
            />
            {createParentPath && (
              <p className="text-xs text-muted-foreground mt-2">
                Location: {createParentPath}/
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} data-testid="button-cancel-create">
              Cancel
            </Button>
            <Button onClick={handleCreateSubmit} data-testid="button-confirm-create">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
