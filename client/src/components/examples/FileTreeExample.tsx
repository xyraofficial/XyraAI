import FileTree, { type FileNode } from "../ide/FileTree";
import { useState } from "react";

const mockFiles: FileNode[] = [
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
        ],
      },
      { id: "5", name: "index.tsx", type: "file", extension: "tsx" },
      { id: "6", name: "styles.css", type: "file", extension: "css" },
    ],
  },
  { id: "7", name: "package.json", type: "file", extension: "json" },
  { id: "8", name: "README.md", type: "file", extension: "md" },
];

export default function FileTreeExample() {
  const [selectedId, setSelectedId] = useState<string | undefined>();

  return (
    <div className="h-80 w-64 border border-border rounded-md overflow-hidden">
      <FileTree
        files={mockFiles}
        onFileSelect={(file) => {
          setSelectedId(file.id);
          console.log("Selected file:", file.name);
        }}
        onCreateFile={(parentId, name) => console.log("Create file:", name, "in", parentId)}
        onCreateFolder={(parentId, name) => console.log("Create folder:", name, "in", parentId)}
        onDelete={(id) => console.log("Delete:", id)}
        onRename={(id, newName) => console.log("Rename:", id, "to", newName)}
        selectedFileId={selectedId}
      />
    </div>
  );
}
