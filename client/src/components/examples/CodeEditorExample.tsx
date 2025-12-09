import CodeEditor from "../ide/CodeEditor";
import { useState } from "react";

const sampleCode = `import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div className="p-4">
      <h1>Counter: {count}</h1>
      <button onClick={() => setCount(c => c + 1)}>
        Increment
      </button>
    </div>
  );
}`;

export default function CodeEditorExample() {
  const [files, setFiles] = useState([
    {
      id: "1",
      name: "Counter.tsx",
      path: "src/components/Counter.tsx",
      content: sampleCode,
      language: "typescript",
      isDirty: false,
    },
    {
      id: "2",
      name: "App.tsx",
      path: "src/App.tsx",
      content: "// App component",
      language: "typescript",
      isDirty: true,
    },
  ]);
  const [activeId, setActiveId] = useState("1");

  return (
    <div className="h-96 w-full border border-border rounded-md overflow-hidden">
      <CodeEditor
        openFiles={files}
        activeFileId={activeId}
        onFileChange={(fileId, content) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, content, isDirty: true } : f))
          );
        }}
        onFileSave={(fileId) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === fileId ? { ...f, isDirty: false } : f))
          );
          console.log("Saved file:", fileId);
        }}
        onFileClose={(fileId) => {
          setFiles((prev) => prev.filter((f) => f.id !== fileId));
          console.log("Closed file:", fileId);
        }}
        onTabSelect={setActiveId}
      />
    </div>
  );
}
