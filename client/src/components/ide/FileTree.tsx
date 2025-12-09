import { useState } from "react";
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
  FolderPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";

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
  selectedFileId?: string;
}

const getFileIcon = (extension?: string) => {
  const iconClass = "w-4 h-4 flex-shrink-0";
  switch (extension) {
    case "js":
    case "jsx":
      return <File className={`${iconClass} text-yellow-400`} />;
    case "ts":
    case "tsx":
      return <File className={`${iconClass} text-blue-400`} />;
    case "html":
      return <File className={`${iconClass} text-orange-400`} />;
    case "css":
      return <File className={`${iconClass} text-purple-400`} />;
    case "json":
      return <File className={`${iconClass} text-green-400`} />;
    case "md":
      return <File className={`${iconClass} text-gray-400`} />;
    case "py":
      return <File className={`${iconClass} text-blue-300`} />;
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
  onCreateFile?: (parentPath: string, name: string) => void;
  onCreateFolder?: (parentPath: string, name: string) => void;
  selectedFileId?: string;
}

function TreeItem({ 
  node, 
  depth, 
  onFileSelect, 
  onDelete, 
  onRename,
  onCreateFile,
  onCreateFolder,
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
  };

  const contextMenuItems = (
    <>
      {node.type === "folder" && (
        <>
          <ContextMenuItem 
            onClick={() => onCreateFile?.(node.path, "untitled.js")}
            data-testid={`context-new-file-${node.id}`}
          >
            <FilePlus className="w-4 h-4 mr-2" />
            New File
          </ContextMenuItem>
          <ContextMenuItem 
            onClick={() => onCreateFolder?.(node.path, "new-folder")}
            data-testid={`context-new-folder-${node.id}`}
          >
            <FolderPlus className="w-4 h-4 mr-2" />
            New Folder
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuItem 
        onClick={() => setIsRenaming(true)}
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
                {getFileIcon(node.extension)}
              </>
            )}
            {isRenaming ? (
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") setIsRenaming(false);
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
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
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
  selectedFileId,
}: FileTreeProps) {
  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-sidebar-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => onCreateFile?.(null, "untitled.js")}
            data-testid="button-new-file"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => onCreateFolder?.(null, "new-folder")}
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
              <DropdownMenuItem data-testid="menu-upload">
                <Upload className="w-4 h-4 mr-2" />
                Upload Files
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="menu-download">
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
                onCreateFile={onCreateFile}
                onCreateFolder={onCreateFolder}
                selectedFileId={selectedFileId}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
