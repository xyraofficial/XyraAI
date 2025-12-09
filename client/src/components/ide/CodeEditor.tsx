import { useState, useCallback, useEffect, useRef } from "react";
import { X, Circle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface OpenFile {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  isDirty: boolean;
}

interface CodeEditorProps {
  openFiles: OpenFile[];
  activeFileId: string | null;
  onFileChange: (fileId: string, content: string) => void;
  onFileSave: (fileId: string) => void;
  onFileClose: (fileId: string) => void;
  onTabSelect: (fileId: string) => void;
}

const getLanguageFromExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    html: 'html',
    css: 'css',
    json: 'json',
    md: 'markdown',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
  };
  return langMap[ext || ''] || 'plaintext';
};

const syntaxHighlight = (code: string, language: string): string => {
  let highlighted = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (['javascript', 'typescript'].includes(language)) {
    const keywords = /\b(const|let|var|function|return|if|else|for|while|class|import|export|from|default|async|await|try|catch|throw|new|this|typeof|instanceof|null|undefined|true|false)\b/g;
    highlighted = highlighted.replace(keywords, '<span class="text-purple-400">$1</span>');
    
    highlighted = highlighted.replace(/(\/\/.*$)/gm, '<span class="text-muted-foreground italic">$1</span>');
    highlighted = highlighted.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="text-muted-foreground italic">$1</span>');
    
    highlighted = highlighted.replace(/("[^"]*"|'[^']*'|`[^`]*`)/g, '<span class="text-green-400">$1</span>');
    
    highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, '<span class="text-orange-400">$1</span>');
    
    highlighted = highlighted.replace(/\b([A-Z][a-zA-Z0-9]*)\b/g, '<span class="text-yellow-300">$1</span>');
    
    highlighted = highlighted.replace(/\b(\w+)(?=\s*\()/g, '<span class="text-blue-300">$1</span>');
  } else if (language === 'html') {
    highlighted = highlighted.replace(/(&lt;\/?)([\w-]+)/g, '$1<span class="text-red-400">$2</span>');
    highlighted = highlighted.replace(/\s([\w-]+)=/g, ' <span class="text-yellow-300">$1</span>=');
    highlighted = highlighted.replace(/("[^"]*")/g, '<span class="text-green-400">$1</span>');
  } else if (language === 'css') {
    highlighted = highlighted.replace(/([\w-]+)(?=\s*:)/g, '<span class="text-blue-300">$1</span>');
    highlighted = highlighted.replace(/:\s*([^;{}]+)/g, ': <span class="text-orange-400">$1</span>');
    highlighted = highlighted.replace(/(\.[\w-]+|#[\w-]+)/g, '<span class="text-yellow-300">$1</span>');
  } else if (language === 'python') {
    const keywords = /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|with|lambda|None|True|False|and|or|not|in|is)\b/g;
    highlighted = highlighted.replace(keywords, '<span class="text-purple-400">$1</span>');
    highlighted = highlighted.replace(/(#.*$)/gm, '<span class="text-muted-foreground italic">$1</span>');
    highlighted = highlighted.replace(/("[^"]*"|'[^']*')/g, '<span class="text-green-400">$1</span>');
  } else if (language === 'json') {
    highlighted = highlighted.replace(/("[\w-]+")\s*:/g, '<span class="text-blue-300">$1</span>:');
    highlighted = highlighted.replace(/:\s*("[^"]*")/g, ': <span class="text-green-400">$1</span>');
    highlighted = highlighted.replace(/:\s*(\d+\.?\d*)/g, ': <span class="text-orange-400">$1</span>');
    highlighted = highlighted.replace(/:\s*(true|false|null)/g, ': <span class="text-purple-400">$1</span>');
  }

  return highlighted;
};

export default function CodeEditor({
  openFiles,
  activeFileId,
  onFileChange,
  onFileSave,
  onFileClose,
  onTabSelect,
}: CodeEditorProps) {
  const activeFile = openFiles.find((f) => f.id === activeFileId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (activeFileId) {
        onFileSave(activeFileId);
      }
    }
    
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (textarea && activeFile) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent = activeFile.content.substring(0, start) + '  ' + activeFile.content.substring(end);
        onFileChange(activeFile.id, newContent);
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    }
  }, [activeFileId, activeFile, onFileSave, onFileChange]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (activeFile) {
      onFileChange(activeFile.id, e.target.value);
    }
  };

  const updateCursorPosition = () => {
    const textarea = textareaRef.current;
    if (textarea && activeFile) {
      const text = activeFile.content.substring(0, textarea.selectionStart);
      const lines = text.split('\n');
      setCursorPosition({
        line: lines.length,
        column: (lines[lines.length - 1]?.length || 0) + 1
      });
    }
  };

  const lines = activeFile?.content.split('\n') || [];

  if (openFiles.length === 0) {
    return (
      <div className="flex flex-col h-full bg-card">
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <div className="text-4xl mb-4 opacity-20">{"</>"}</div>
            <p className="text-sm">Select a file to start editing</p>
            <p className="text-xs mt-2">or create a new file from the explorer</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card">
      <div className="flex items-center border-b border-border bg-background/50 overflow-x-auto">
        {openFiles.map((file) => (
          <div
            key={file.id}
            className={`flex items-center gap-2 px-3 py-2 border-r border-border cursor-pointer group min-w-0 ${
              file.id === activeFileId
                ? "bg-card border-b-2 border-b-primary"
                : "hover-elevate"
            }`}
            onClick={() => onTabSelect(file.id)}
            data-testid={`tab-${file.id}`}
          >
            <span className="text-sm truncate max-w-32">{file.name}</span>
            {file.isDirty && (
              <Circle className="w-2 h-2 fill-primary text-primary flex-shrink-0" />
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-4 w-4 opacity-0 group-hover:opacity-100 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onFileClose(file.id);
              }}
              data-testid={`close-tab-${file.id}`}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>

      {activeFile && (
        <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground border-b border-border bg-background/30">
          <span>{activeFile.path}</span>
          <span className="ml-auto">
            {activeFile.language.toUpperCase()}
          </span>
          <span>
            Ln {cursorPosition.line}, Col {cursorPosition.column}
          </span>
          {activeFile.isDirty && (
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-2 text-xs"
              onClick={() => onFileSave(activeFile.id)}
              data-testid="button-save-file"
            >
              <Save className="w-3 h-3 mr-1" />
              Save
            </Button>
          )}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="w-12 flex-shrink-0 bg-background/30 text-right pr-3 py-2 select-none border-r border-border overflow-hidden">
          {lines.map((_, i) => (
            <div
              key={i}
              className={`text-xs leading-6 font-mono ${
                cursorPosition.line === i + 1
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
          ))}
        </div>

        <div className="flex-1 relative overflow-hidden">
          <ScrollArea className="h-full">
            <div className="relative min-h-full">
              <pre
                className="absolute inset-0 p-2 font-mono text-sm leading-6 whitespace-pre-wrap break-words pointer-events-none"
                dangerouslySetInnerHTML={{
                  __html: syntaxHighlight(activeFile?.content || '', activeFile?.language || 'plaintext')
                }}
                aria-hidden="true"
              />
              <textarea
                ref={textareaRef}
                value={activeFile?.content || ''}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                onSelect={updateCursorPosition}
                onClick={updateCursorPosition}
                className="w-full h-full min-h-[500px] p-2 font-mono text-sm leading-6 bg-transparent text-transparent caret-foreground resize-none outline-none"
                spellCheck={false}
                data-testid="code-textarea"
              />
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
